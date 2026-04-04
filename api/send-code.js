import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SECRET = process.env.CODE_SECRET;
const AUTH_LOGIN_EMAIL = (process.env.AUTH_LOGIN_EMAIL || '').trim().toLowerCase();
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
const sendBuckets = new Map();

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const hasAllowlist = ALLOWED_ORIGINS.length > 0;
  const allowed = !origin || !hasAllowlist || ALLOWED_ORIGINS.includes(origin);
  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return allowed;
}

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = sendBuckets.get(key) || [];
  const next = arr.filter((t) => now - t < windowMs);
  if (next.length >= max) {
    sendBuckets.set(key, next);
    return true;
  }
  next.push(now);
  sendBuckets.set(key, next);
  return false;
}

export default async function handler(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!SECRET || !BOT_TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Auth service not configured' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  const normalizedEmail = String(email).trim().toLowerCase();
  if (AUTH_LOGIN_EMAIL && normalizedEmail !== AUTH_LOGIN_EMAIL) {
    return res.status(401).json({ error: 'Not authorised' });
  }
  const ip = getClientIp(req);
  if (isRateLimited(`send:${ip}`, 8, 10 * 60 * 1000) || isRateLimited(`send-email:${normalizedEmail}`, 4, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many code requests. Wait and retry.' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const bucket = Math.floor(Date.now() / 600000); // 10-min window
  const token = crypto.createHmac('sha256', SECRET).update(`${code}:${bucket}`).digest('hex');

  const msg = [
    '🔐 *HazelCare Ops — Access Request*',
    '',
    `📧 Email: \`${normalizedEmail}\``,
    `🔑 Code: \`${code}\``,
    '',
    '_Valid 10 minutes. Forward this code to grant access, or ignore to deny._'
  ].join('\n');

  try {
    const tg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' })
    });
    const body = await tg.json().catch(() => null);
    if (!tg.ok || !body?.ok) {
      return res.status(502).json({ error: 'Failed to send code' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Failed to send code' });
  }

  res.json({ token });
}
