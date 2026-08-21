import crypto from 'crypto';

export const HC_SESSION_COOKIE = 'hc_session';

export function mintHcSession(secret, ttlHours = 12, claims = {}) {
  if (!secret) throw new Error('Session secret required');
  const exp = Date.now() + ttlHours * 3600 * 1000;
  const sessionPayload = {
    v: 2,
    exp,
    role: claims.role || 'manager',
    email: claims.email || '',
  };
  const payload = Buffer.from(JSON.stringify(sessionPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return { value: `${payload}.${sig}`, maxAgeSec: ttlHours * 3600 };
}

function safeEq(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

/** @param {string | undefined} raw @param {string} secret */
export function verifyHcSession(raw, secret) {
  const claims = readHcSessionClaims(raw, secret);
  return !!claims;
}

/** @param {string | undefined} raw @param {string} secret */
export function readHcSessionClaims(raw, secret) {
  if (!raw || !secret) return null;
  const [p, s] = String(raw).split('.');
  if (!p || !s) return null;
  const expected = crypto.createHmac('sha256', secret).update(p).digest('base64url');
  if (!safeEq(expected, s)) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (!(payload.v === 2 && typeof payload.exp === 'number' && Date.now() <= payload.exp)) {
      return null;
    }
    return {
      role: typeof payload.role === 'string' ? payload.role : 'manager',
      email: typeof payload.email === 'string' ? payload.email : '',
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function secureCookieSuffix() {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' ? '; Secure' : '';
}
