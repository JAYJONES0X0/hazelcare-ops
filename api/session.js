import crypto from 'crypto';

const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join('=') || '');
    return acc;
  }, {});
}

function safeEq(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', AUTH_SESSION_SECRET).update(payloadB64).digest('base64url');
}

function verifySession(token) {
  if (!token || !AUTH_SESSION_SECRET) return false;
  const [p, s] = String(token).split('.');
  if (!p || !s) return false;
  const expected = sign(p);
  if (!safeEq(expected, s)) return false;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    return !!payload.exp && Date.now() <= payload.exp;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'DELETE') return res.status(405).end();

  if (req.method === 'DELETE') {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `hc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return res.json({ ok: true });
  }

  const cookies = parseCookies(req);
  return res.json({ authed: verifySession(cookies.hc_session) });
}
