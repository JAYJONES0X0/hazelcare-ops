import crypto from 'crypto';
import { consumeOnce } from './lib/durable-once.js';

const TOTP_SECRET = process.env.AUTH_TOTP_SECRET || '';
const RECOVERY_CODES = (process.env.AUTH_RECOVERY_CODES || '')
  .split(',')
  .map((x) => x.trim().toUpperCase())
  .filter(Boolean);
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
const verifyBuckets = new Map();

function timingSafeStringEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(input || '').toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of clean) {
    const val = alphabet.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuf, counter, digits = 6) {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuf).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(codeInt % mod).padStart(digits, '0');
}

function verifyTotp(userCode) {
  if (!TOTP_SECRET) return false;
  const key = base32Decode(TOTP_SECRET);
  if (!key.length) return false;

  const timeStep = 30;
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  for (const drift of [-1, 0, 1]) {
    const expected = hotp(key, counter + drift, 6);
    if (timingSafeStringEqual(expected, userCode)) return true;
  }
  return false;
}

function verifyRecovery(userCode) {
  const normalized = String(userCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return false;
  const match = RECOVERY_CODES.some((stored) => timingSafeStringEqual(stored.replace(/[^A-Z0-9]/g, ''), normalized));
  return match ? normalized : null;
}

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

export default async function handler(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ valid: false, error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { code, method } = req.body || {};
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return res.status(400).json({ valid: false, error: 'Code required' });
  const ip = getClientIp(req);
  if (isRateLimited(`backup:${ip}`, 12, 10 * 60 * 1000)) {
    return res.status(429).json({ valid: false, error: 'Too many attempts' });
  }

  if (method === 'totp') {
    return res.json({ valid: verifyTotp(normalizedCode) });
  }
  if (method === 'recovery') {
    const normalizedRecovery = verifyRecovery(normalizedCode);
    if (!normalizedRecovery) return res.json({ valid: false });
    const digest = crypto.createHash('sha256').update(normalizedRecovery).digest('hex');
    const once = await consumeOnce(`recovery:${digest}`, 365 * 24 * 60 * 60);
    if (!once.ok) return res.status(500).json({ valid: false, error: once.error });
    return res.json({ valid: once.firstUse });
  }

  return res.status(400).json({ valid: false, error: 'Unsupported method' });
}
