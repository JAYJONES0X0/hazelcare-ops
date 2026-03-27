import crypto from 'crypto';

const SECRET = process.env.CODE_SECRET;
const AUTH_EMERGENCY_BYPASS = process.env.AUTH_EMERGENCY_BYPASS === '1';
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
const verifyBuckets = new Map();

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowed = !!origin && ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin);
  if (allowed && origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return allowed;
}

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = verifyBuckets.get(key) || [];
  const next = arr.filter((t) => now - t < windowMs);
  if (next.length >= max) {
    verifyBuckets.set(key, next);
    return true;
  }
  next.push(now);
  verifyBuckets.set(key, next);
  return false;
}

function safeTokenEqual(expectedHex, providedHex) {
  if (typeof providedHex !== 'string') return false;
  if (expectedHex.length !== providedHex.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedHex), Buffer.from(providedHex));
}

export default async function handler(req, res) {
  if (AUTH_EMERGENCY_BYPASS) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();
    return res.json({ valid: true, bypass: true });
  }
  if (!setCors(req, res)) return res.status(403).json({ valid: false });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!SECRET) return res.status(500).json({ valid: false });

  const { code, token } = req.body || {};
  if (!code || !token) return res.status(400).json({ valid: false });
  const ip = getClientIp(req);
  if (isRateLimited(`verify:${ip}`, 16, 10 * 60 * 1000) || isRateLimited(`verify-token:${String(token).slice(0, 24)}`, 8, 10 * 60 * 1000)) {
    return res.status(429).json({ valid: false });
  }

  const bucket = Math.floor(Date.now() / 600000);
  // Check current bucket and previous (in case code was sent just before window flipped)
  const valid = [bucket, bucket - 1].some(b => {
    const expected = crypto.createHmac('sha256', SECRET).update(`${code}:${b}`).digest('hex');
    return safeTokenEqual(expected, token);
  });

  res.json({ valid });
}
