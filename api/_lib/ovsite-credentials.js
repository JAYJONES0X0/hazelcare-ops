import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const CREDENTIAL_KEY = 'ovsite:auth:credential:v1';
const SECURITY_AUDIT_KEY = 'ovsite:audit:security:v1';

function safeEq(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function hasDurableCredentialStore() {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

async function redis(command) {
  if (!hasDurableCredentialStore()) {
    return { ok: false, error: 'Durable credential storage is not configured' };
  }

  try {
    const response = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      return { ok: false, error: `Credential store responded ${response.status}` };
    }

    const body = await response.json().catch(() => null);
    if (!body || body.error) {
      return { ok: false, error: body?.error || 'Invalid credential-store response' };
    }

    return { ok: true, result: body.result };
  } catch {
    return { ok: false, error: 'Credential store is unavailable' };
  }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derived = await scryptAsync(String(password), salt, 64);
  return {
    algorithm: 'scrypt',
    salt,
    hash: Buffer.from(derived).toString('base64url'),
  };
}

async function verifyHash(password, record) {
  if (!record || record.algorithm !== 'scrypt' || !record.salt || !record.hash) return false;
  const derived = await scryptAsync(String(password), record.salt, 64);
  return safeEq(Buffer.from(derived).toString('base64url'), record.hash);
}

async function readCredentialRecord() {
  if (!hasDurableCredentialStore()) return { ok: true, record: null, durable: false };

  const response = await redis(['GET', CREDENTIAL_KEY]);
  if (!response.ok) return response;
  if (!response.result) return { ok: true, record: null, durable: true };

  try {
    const record = JSON.parse(response.result);
    if (record?.version !== 1 || record?.algorithm !== 'scrypt') {
      return { ok: false, error: 'Stored credential record is invalid' };
    }
    return { ok: true, record, durable: true };
  } catch {
    return { ok: false, error: 'Stored credential record is unreadable' };
  }
}

export async function verifyActivePassword(candidate, bootstrapPassword = '') {
  const stored = await readCredentialRecord();
  if (!stored.ok) return { ok: false, verified: false, error: stored.error };

  if (stored.record) {
    try {
      const verified = await verifyHash(candidate, stored.record);
      return { ok: true, verified, source: 'durable' };
    } catch {
      return { ok: false, verified: false, error: 'Credential verification failed' };
    }
  }

  if (!bootstrapPassword) {
    return { ok: true, verified: false, source: 'none' };
  }

  return {
    ok: true,
    verified: safeEq(candidate, bootstrapPassword),
    source: 'bootstrap',
  };
}

/**
 * Checks whether a signed session was minted after the most recent durable
 * password rotation. Before the first durable rotation there is no server-side
 * credential epoch, so bootstrap-era sessions continue to use normal expiry.
 */
export async function verifySessionCredentialState(claims) {
  if (!claims) return { ok: true, current: false };

  const stored = await readCredentialRecord();
  if (!stored.ok) return { ok: false, current: false, error: stored.error };
  if (!stored.record) return { ok: true, current: true, source: 'bootstrap' };

  const changedAt = Date.parse(stored.record.updatedAt || '');
  if (!Number.isFinite(changedAt)) {
    return { ok: false, current: false, error: 'Stored credential rotation timestamp is invalid' };
  }

  const issuedAt = Number(claims.iat || 0);
  return {
    ok: true,
    current: issuedAt >= changedAt,
    source: 'durable',
    changedAt,
  };
}

async function recordSecurityEvent(event) {
  if (!hasDurableCredentialStore()) return;
  const payload = JSON.stringify({ event, at: new Date().toISOString() });
  const push = await redis(['LPUSH', SECURITY_AUDIT_KEY, payload]);
  if (push.ok) await redis(['LTRIM', SECURITY_AUDIT_KEY, '0', '99']);
}

export async function replaceActivePassword({ currentPassword, newPassword, bootstrapPassword = '' }) {
  if (!hasDurableCredentialStore()) {
    return {
      ok: false,
      status: 503,
      error: 'Password changes require durable credential storage. Configure the OVSITE Upstash Redis environment first.',
    };
  }

  const current = await verifyActivePassword(currentPassword, bootstrapPassword);
  if (!current.ok) return { ok: false, status: 503, error: current.error };
  if (!current.verified) return { ok: false, status: 403, error: 'Current password is incorrect' };

  const next = String(newPassword || '');
  if (next.length < 12) {
    return { ok: false, status: 400, error: 'New password must be at least 12 characters' };
  }
  if (safeEq(currentPassword, next)) {
    return { ok: false, status: 400, error: 'New password must be different from the current password' };
  }

  const digest = await hashPassword(next);
  const record = {
    version: 1,
    ...digest,
    updatedAt: new Date().toISOString(),
  };

  const saved = await redis(['SET', CREDENTIAL_KEY, JSON.stringify(record)]);
  if (!saved.ok) return { ok: false, status: 503, error: saved.error };

  await recordSecurityEvent('password_changed');
  return { ok: true, sourceBeforeChange: current.source };
}
