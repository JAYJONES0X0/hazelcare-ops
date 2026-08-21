import crypto from 'crypto';
import { attachHcSessionCookie } from '../_lib/attach-session.js';
import { consumeOnce } from '../_lib/durable-once.js';
import { HC_SESSION_COOKIE, readHcSessionClaims, secureCookieSuffix } from '../_lib/hc-session.js';
import { verifySessionCredentialState } from '../_lib/ovsite-credentials.js';
import { parseCookies } from '../_lib/parse-cookies.js';
import { STAFF_SAC_COOKIE, verifyAnyStaffSacCookie } from '../_lib/staff-sac-cookie.js';
import loginHandler from './login.js';
import sendCodeHandler from './send-code.js';
import changePasswordHandler from './change-password.js';

const SECRET = process.env.CODE_SECRET;
const TOTP_SECRET = process.env.AUTH_TOTP_SECRET || '';
const RECOVERY_CODES = (process.env.AUTH_RECOVERY_CODES || '')
  .split(',')
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';
const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET || '';
const AUTH_DEFAULT_ROLE = (process.env.AUTH_DEFAULT_ROLE || 'manager').toLowerCase();
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
const VALID_ROLES = new Set(['admin', 'manager', 'senior', 'viewer']);
const rateLimitBuckets = new Map();

function sanitizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return VALID_ROLES.has(value) ? value : 'manager';
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const current = (rateLimitBuckets.get(key) || []).filter((time) => now - time < windowMs);
  if (current.length >= max) {
    rateLimitBuckets.set(key, current);
    return true;
  }
  current.push(now);
  rateLimitBuckets.set(key, current);
  return false;
}

function safeEq(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  let sameOrigin = false;
  if (origin && host) {
    try { sameOrigin = new URL(origin).host === host; } catch { sameOrigin = false; }
  }
  const allowed = !origin || sameOrigin || (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin));
  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return allowed;
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(input || '').toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const character of clean) {
    const value = alphabet.indexOf(character);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter, digits = 6) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % (10 ** digits)).padStart(digits, '0');
}

function verifyTotp(userCode) {
  if (!TOTP_SECRET) return false;
  const key = base32Decode(TOTP_SECRET);
  if (!key.length) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  return [-1, 0, 1].some((drift) => safeEq(hotp(key, counter + drift, 6), userCode));
}

function verifyRecovery(userCode) {
  const normalized = String(userCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return null;
  const match = RECOVERY_CODES.some((stored) => safeEq(stored.replace(/[^A-Z0-9]/g, ''), normalized));
  return match ? normalized : null;
}

async function handleVerifyCode(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ valid: false, error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!SECRET) return res.status(500).json({ valid: false, error: 'Auth service not configured' });

  const { code, token } = req.body || {};
  if (!code || !token) return res.status(400).json({ valid: false });

  const ip = clientIp(req);
  if (isRateLimited(`verify:${ip}`, 16, 10 * 60 * 1000) || isRateLimited(`verify-token:${String(token).slice(0, 24)}`, 8, 10 * 60 * 1000)) {
    return res.status(429).json({ valid: false });
  }

  const bucket = Math.floor(Date.now() / 600000);
  const valid = [bucket, bucket - 1].some((candidateBucket) => {
    const expected = crypto.createHmac('sha256', SECRET).update(`${code}:${candidateBucket}`).digest('hex');
    return String(token).length === expected.length && safeEq(token, expected);
  });

  if (valid) attachHcSessionCookie(res);
  return res.json({ valid });
}

async function handleVerifyBackup(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ valid: false, error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { code, method } = req.body || {};
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return res.status(400).json({ valid: false, error: 'Code required' });

  const ip = clientIp(req);
  if (isRateLimited(`backup:${ip}`, 12, 10 * 60 * 1000)) {
    return res.status(429).json({ valid: false, error: 'Too many attempts' });
  }

  if (method === 'totp') {
    const valid = verifyTotp(normalizedCode);
    if (valid) attachHcSessionCookie(res);
    return res.json({ valid });
  }

  if (method === 'recovery') {
    const recoveryCode = verifyRecovery(normalizedCode);
    if (!recoveryCode) return res.json({ valid: false });
    const digest = crypto.createHash('sha256').update(recoveryCode).digest('hex');
    const once = await consumeOnce(`recovery:${digest}`, 365 * 24 * 60 * 60);
    if (!once.ok) return res.status(500).json({ valid: false, error: once.error });
    if (once.firstUse) attachHcSessionCookie(res);
    return res.json({ valid: once.firstUse });
  }

  return res.status(400).json({ valid: false, error: 'Unsupported method' });
}

async function handleSession(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ authed: false, error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'DELETE') return res.status(405).end();

  if (req.method === 'DELETE') {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', `${HC_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieSuffix()}`);
    return res.json({ ok: true });
  }

  const cookies = parseCookies(req);
  let claims = readHcSessionClaims(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET);
  if (claims) {
    const sessionState = await verifySessionCredentialState(claims);
    if (!sessionState.ok) {
      return res.status(503).json({ authed: false, error: sessionState.error || 'Credential service unavailable' });
    }
    if (!sessionState.current) {
      claims = null;
      res.setHeader('Set-Cookie', `${HC_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieSuffix()}`);
    }
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Vary', 'Origin, Cookie');

  return res.json({
    authed: Boolean(claims),
    staffScoped: verifyAnyStaffSacCookie(cookies[STAFF_SAC_COOKIE], STAFF_LINK_SECRET),
    role: claims?.role ? sanitizeRole(claims.role) : sanitizeRole(AUTH_DEFAULT_ROLE),
    email: claims?.email || '',
  });
}

export default async function handler(req, res) {
  const urlPath = (req.url || '').split('?')[0];
  const segments = urlPath.replace(/^\/api\/auth\/?/, '').split('/').filter(Boolean);
  const route = segments[0] || (req.query?.action ? (Array.isArray(req.query.action) ? req.query.action[0] : req.query.action) : null);

  switch (route) {
    case 'login': return loginHandler(req, res);
    case 'send-code': return sendCodeHandler(req, res);
    case 'verify-code': return handleVerifyCode(req, res);
    case 'verify-backup': return handleVerifyBackup(req, res);
    case 'session': return handleSession(req, res);
    case 'change-password': return changePasswordHandler(req, res);
    default: return res.status(404).json({ error: 'Auth route not found' });
  }
}
