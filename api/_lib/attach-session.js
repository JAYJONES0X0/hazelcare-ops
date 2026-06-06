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
    // 24h session for a clinical app (was 168h/7d — too long for sensitive data).
    const { value, maxAgeSec } = mintHcSession(AUTH_SESSION_SECRET, 24, claims);
    const secure = secureCookieSuffix();
    res.setHeader(
      'Set-Cookie',
      `${HC_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`,
    );
  } catch {
    /* ignore */
  }
}
