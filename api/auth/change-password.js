import { HC_SESSION_COOKIE, verifyHcSession, secureCookieSuffix } from '../_lib/hc-session.js';
import { parseCookies } from '../_lib/parse-cookies.js';
import { replaceActivePassword } from '../_lib/ovsite-credentials.js';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
const rateLimitBuckets = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const current = (rateLimitBuckets.get(key) || []).filter((time) => now - time < windowMs);
  if (current.length >= max) {
    rateLimitBuckets.set(key, current);
    return true;
  }
  current.push(now);
  rateLimitBuckets.set(key, current);
  return false;
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  let sameOrigin = false;
  if (origin && host) {
    try { sameOrigin = new URL(origin).host === host; } catch { sameOrigin = false; }
  }
  const allowed = !origin || sameOrigin || (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin));
  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return allowed;
}

function clearSession(res) {
  res.setHeader(
    'Set-Cookie',
    `${HC_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieSuffix()}`,
  );
}

export default async function handler(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ ok: false, error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = clientIp(req);
  if (isRateLimited(`password-change:${ip}`, 6, 15 * 60 * 1000)) {
    return res.status(429).json({ ok: false, error: 'Too many password-change attempts' });
  }

  const cookies = parseCookies(req);
  if (!verifyHcSession(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }

  // Accept the current Settings UI contract and the old stub contract during migration.
  const currentPassword = req.body?.currentPassword ?? req.body?.current ?? '';
  const newPassword = req.body?.newPassword ?? '';

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: 'Current and new password are required' });
  }

  const changed = await replaceActivePassword({
    currentPassword,
    newPassword,
    bootstrapPassword: AUTH_PASSWORD,
  });

  if (!changed.ok) {
    return res.status(changed.status || 500).json({ ok: false, error: changed.error || 'Password change failed' });
  }

  // Re-authentication is required after a credential rotation.
  clearSession(res);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    signedOut: true,
    message: 'Password changed. Sign in again with the new password.',
  });
}
