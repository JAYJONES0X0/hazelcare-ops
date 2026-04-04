import crypto from 'crypto';
import { attachHcSessionCookie } from './_lib/attach-session.js';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const AUTH_LOGIN_EMAIL = (process.env.AUTH_LOGIN_EMAIL || '').trim().toLowerCase();
const AUTH_EMERGENCY_BYPASS = process.env.AUTH_EMERGENCY_BYPASS === '1';
const loginBuckets = new Map();

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = loginBuckets.get(key) || [];
  const next = arr.filter((t) => now - t < windowMs);
  if (next.length >= max) {
    loginBuckets.set(key, next);
    return true;
  }
  next.push(now);
  loginBuckets.set(key, next);
  return false;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function safeEq(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!AUTH_PASSWORD) return res.status(500).json({ ok: false, recognized: false });

  const ip = getClientIp(req);
  if (isRateLimited(`login:${ip}`, 20, 15 * 60 * 1000)) {
    return res.status(429).json({ ok: false });
  }

  const { email, password, probe } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, recognized: false });
  if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ ok: false });
  const normalizedEmail = email.trim().toLowerCase();
  const recognized = AUTH_LOGIN_EMAIL ? safeEq(normalizedEmail, AUTH_LOGIN_EMAIL) : true;
  if (probe) {
    if (!recognized) return res.status(403).json({ ok: false, recognized: false, error: 'Not recognised' });
    return res.json({ ok: true, recognized: true });
  }
  if (!password) return res.status(400).json({ ok: false, recognized });
  if (!recognized) return res.status(403).json({ ok: false, recognized: false, error: 'Not recognised' });
  if (!safeEq(password, AUTH_PASSWORD)) return res.status(401).json({ ok: false });

  attachHcSessionCookie(res);

  return res.json({ ok: true, skip2fa: AUTH_EMERGENCY_BYPASS });
}
