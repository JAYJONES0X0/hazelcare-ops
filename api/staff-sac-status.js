import { STAFF_SAC_COOKIE, verifyStaffSacCookie } from './_lib/staff-sac-cookie.js';

const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET;

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join('=') || '');
    return acc;
  }, {});
}

export default async function handler(req, res) {
  const secure =
    process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' ? '; Secure' : '';

  if (req.method === 'DELETE') {
    res.setHeader(
      'Set-Cookie',
      `${STAFF_SAC_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    );
    return res.json({ ok: true });
  }

  if (req.method !== 'GET') return res.status(405).end();
  if (!STAFF_LINK_SECRET) return res.status(500).json({ ok: false });

  const toolId = req.query?.toolId;
  if (!toolId || typeof toolId !== 'string') {
    return res.status(400).json({ ok: false });
  }

  const cookies = parseCookies(req);
  const raw = cookies[STAFF_SAC_COOKIE];
  const ok = verifyStaffSacCookie(raw, toolId, STAFF_LINK_SECRET);
  return res.json({ ok });
}
