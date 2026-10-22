import { mintHcSession, HC_SESSION_COOKIE, secureCookieSuffix } from './hc-session.js';

export function attachHcSessionCookie(res) {
  return attachHcSessionCookieWithClaims(res, {});
}

export function attachHcSessionCookieWithClaims(res, claims = {}) {
  const secret = process.env.AUTH_SESSION_SECRET || '';
  if (!secret) throw new Error('Session is not configured');
  const { value, maxAgeSec } = mintHcSession(secret, 24, claims);
  const cookie = `${HC_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secureCookieSuffix()}`;
  res.setHeader('Set-Cookie', cookie);
  return cookie;
}
