import crypto from 'crypto';
import { getAllowedLoginEmails, isLoginEmailAllowed } from '../_lib/auth-login-allowlist.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SECRET = process.env.CODE_SECRET;
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

export default async function handler(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!SECRET || !BOT_TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Auth service not configured' });

  const { email } = req.body || {};
  if (!email || !String(email).includes('@')) return res.status(400).json({ error: 'Valid email required' });

  const normalizedEmail = String(email).trim().toLowerCase();
  if (getAllowedLoginEmails().length === 0) return res.status(503).json({ error: 'Auth allowlist not configured' });
  if (!isLoginEmailAllowed(normalizedEmail)) return res.status(401).json({ error: 'Not authorised' });

  const ip = clientIp(req);
  if (isRateLimited(`send:${ip}`, 8, 10 * 60 * 1000) || isRateLimited(`send-email:${normalizedEmail}`, 4, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many code requests. Wait and retry.' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const bucket = Math.floor(Date.now() / 600000);
  const token = crypto.createHmac('sha256', SECRET).update(`${code}:${bucket}`).digest('hex');

  const message = [
    '🔐 *OVSITE — Access Request*',
    '',
    `📧 Email: \`${normalizedEmail}\``,
    `🔑 Code: \`${code}\``,
    '',
    '_Valid for 10 minutes. Forward this code to grant access, or ignore to deny._',
  ].join('\n');

  try {
    const telegram = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' }),
    });
    const body = await telegram.json().catch(() => null);
    if (!telegram.ok || !body?.ok) return res.status(502).json({ error: 'Failed to send code' });
  } catch {
    return res.status(500).json({ error: 'Failed to send code' });
  }

  return res.json({ token });
}
