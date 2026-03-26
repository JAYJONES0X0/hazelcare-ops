import crypto from 'crypto';
import { consumeOnce } from './lib/durable-once.js';

const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET;
const verifyBuckets = new Map();

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

function parseToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', STAFF_LINK_SECRET).update(payload).digest('base64url');
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const raw = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!STAFF_LINK_SECRET) return res.status(500).json({ valid: false });

  const { token, code, toolId } = req.body || {};
  if (!token || !code || !toolId) return res.status(400).json({ valid: false });
  if (isRateLimited(`staff:${String(token).slice(0, 24)}`, 8, 10 * 60 * 1000)) {
    return res.status(429).json({ valid: false });
  }

  const payload = parseToken(token);
  if (!payload) return res.json({ valid: false });
  if (payload.toolId !== toolId) return res.json({ valid: false });
  if (!payload.exp || Date.now() > payload.exp) return res.json({ valid: false });
  if (!payload.jti) return res.json({ valid: false });

  const normalizedCode = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const hash = crypto.createHash('sha256').update(`${normalizedCode}:${STAFF_LINK_SECRET}`).digest('hex');
  if (hash.length !== String(payload.codeHash || '').length) return res.json({ valid: false });
  const ok = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(payload.codeHash));
  if (!ok) return res.json({ valid: false });

  const once = await consumeOnce(`staff-jti:${payload.jti}`, 24 * 60 * 60);
  if (!once.ok) return res.status(500).json({ valid: false, error: once.error });
  if (!once.firstUse) return res.json({ valid: false });

  return res.json({ valid: true });
}
