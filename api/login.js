import crypto from 'crypto';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';

function safeEq(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!AUTH_PASSWORD) return res.status(500).json({ ok: false });

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ ok: false });
  if (!safeEq(password, AUTH_PASSWORD)) return res.status(401).json({ ok: false });

  return res.json({ ok: true });
}
