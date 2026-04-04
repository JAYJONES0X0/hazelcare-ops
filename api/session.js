import { HC_SESSION_COOKIE, verifyHcSession, secureCookieSuffix } from './_lib/hc-session.js';
import { parseCookies } from './_lib/parse-cookies.js';
import { STAFF_SAC_COOKIE, verifyAnyStaffSacCookie } from './_lib/staff-sac-cookie.js';

const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';
const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET || '';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'DELETE') return res.status(405).end();

  if (req.method === 'DELETE') {
    const secure = secureCookieSuffix();
    res.setHeader('Set-Cookie', `${HC_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return res.json({ ok: true });
  }

  const cookies = parseCookies(req);
  return res.json({
    authed: verifyHcSession(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET),
    staffScoped: verifyAnyStaffSacCookie(cookies[STAFF_SAC_COOKIE], STAFF_LINK_SECRET),
  });
}
