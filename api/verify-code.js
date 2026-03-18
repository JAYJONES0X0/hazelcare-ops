import crypto from 'crypto';

const SECRET = process.env.CODE_SECRET || 'hc-fallback-2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { code, token } = req.body || {};
  if (!code || !token) return res.status(400).json({ valid: false });

  const bucket = Math.floor(Date.now() / 600000);
  // Check current bucket and previous (in case code was sent just before window flipped)
  const valid = [bucket, bucket - 1].some(b => {
    const expected = crypto.createHmac('sha256', SECRET).update(`${code}:${b}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  });

  res.json({ valid });
}
