import { attachHcSessionCookieWithClaims } from '../_lib/attach-session.js';
import { getAllowedLoginEmails, getRoleForLoginEmail, isLoginEmailAllowed } from '../_lib/auth-login-allowlist.js';
import { verifyActivePassword } from '../_lib/ovsite-credentials.js';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const AUTH_EMERGENCY_BYPASS = process.env.AUTH_EMERGENCY_BYPASS === '1';
const AUTH_DEFAULT_ROLE = (process.env.AUTH_DEFAULT_ROLE || 'manager').toLowerCase();
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
const VALID_ROLES = new Set(['admin', 'manager', 'senior', 'viewer']);
const rateLimitBuckets = new Map();

function sanitizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return VALID_ROLES.has(value) ? value : 'manager';
}

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

export default async function handler(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ ok: false, error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = clientIp(req);
  if (isRateLimited(`login:${ip}`, 20, 15 * 60 * 1000)) {
    return res.status(429).json({ ok: false, error: 'Too many attempts' });
  }

  const { email, password, probe } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, recognized: false });
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ ok: false, recognized: false, error: 'Invalid email format' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (getAllowedLoginEmails().length === 0) {
    return res.status(503).json({
      ok: false,
      recognized: false,
      error: 'Login allowlist is not configured',
    });
  }

  const recognized = isLoginEmailAllowed(normalizedEmail);
  if (probe) {
    if (!recognized) return res.status(403).json({ ok: false, recognized: false, error: 'Not recognised' });
    return res.json({ ok: true, recognized: true });
  }

  if (!password) return res.status(400).json({ ok: false, recognized });
  if (!recognized) return res.status(403).json({ ok: false, recognized: false, error: 'Not recognised' });

  const verification = await verifyActivePassword(password, AUTH_PASSWORD);
  if (!verification.ok) {
    return res.status(503).json({ ok: false, recognized: true, error: verification.error || 'Credential service unavailable' });
  }
  if (!verification.verified) {
    return res.status(401).json({ ok: false, recognized: true, error: 'Incorrect password' });
  }

  const role = sanitizeRole(getRoleForLoginEmail(normalizedEmail, AUTH_DEFAULT_ROLE));
  attachHcSessionCookieWithClaims(res, { email: normalizedEmail, role });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    ok: true,
    skip2fa: AUTH_EMERGENCY_BYPASS,
    role,
    email: normalizedEmail,
  });
}
