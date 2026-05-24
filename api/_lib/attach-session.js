import { mintHcSession, HC_SESSION_COOKIE, secureCookieSuffix } from './hc-session.js';

const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';

/** @param {import('http').ServerResponse} res */
export function attachHcSessionCookie(res) {
  attachHcSessionCookieWithClaims(res, {});
}

/** @param {import('http').ServerResponse} res */
export function attachHcSessionCookieWithClaims(res, claims = {}) {
  if (!AUTH_SESSION_SECRET) return;
  try {
    const { value, maxAgeSec } = mintHcSession(AUTH_SESSION_SECRET, 168, claims);
    const secure = secureCookieSuffix();
    res.setHeader(
      'Set-Cookie',
      `${HC_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`,
    );
  } catch {
    /* ignore */
  }
}
