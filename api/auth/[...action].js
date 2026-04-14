import crypto from 'crypto';
import { attachHcSessionCookie } from '../../_lib/attach-session.js';
import { getAllowedLoginEmails, isLoginEmailAllowed } from '../../_lib/auth-login-allowlist.js';
import { consumeOnce } from '../../_lib/durable-once.js';
import { HC_SESSION_COOKIE, verifyHcSession, secureCookieSuffix } from '../../_lib/hc-session.js';
import { parseCookies } from '../../_lib/parse-cookies.js';
import { STAFF_SAC_COOKIE, verifyAnyStaffSacCookie } from '../../_lib/staff-sac-cookie.js';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const AUTH_EMERGENCY_BYPASS = process.env.AUTH_EMERGENCY_BYPASS === '1';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SECRET = process.env.CODE_SECRET;
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
const TOTP_SECRET = process.env.AUTH_TOTP_SECRET || '';
const RECOVERY_CODES = (process.env.AUTH_RECOVERY_CODES || '')
  .split(',')
  .map((x) => x.trim().toUpperCase())
  .filter(Boolean);
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';
const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET || '';

const rateLimitBuckets = new Map();

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = rateLimitBuckets.get(key) || [];
  const next = arr.filter((t) => now - t < windowMs);
  if (next.length >= max) {
    rateLimitBuckets.set(key, next);
    return true;
  }
  next.push(now);
  rateLimitBuckets.set(key, next);
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

// TOTP Utils
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
    if (safeEq(expected, userCode)) return true;
  }
  return false;
}

function verifyRecovery(userCode) {
  const normalized = String(userCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return false;
  const match = RECOVERY_CODES.some((stored) => safeEq(stored.replace(/[^A-Z0-9]/g, ''), normalized));
  return match ? normalized : null;
}

export default async function handler(req, res) {
  const { action } = req.query;
  const route = action?.[0];

  if (!route) return res.status(404).json({ error: 'Not found' });

  switch (route) {
    case 'login': return handleLogin(req, res);
    case 'send-code': return handleSendCode(req, res);
    case 'verify-code': return handleVerifyCode(req, res);
    case 'verify-backup': return handleVerifyBackup(req, res);
    case 'session': return handleSession(req, res);
    case 'change-password': return handleChangePassword(req, res);
    default: return res.status(404).json({ error: 'Unknown auth action' });
  }
}

async function handleLogin(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!AUTH_PASSWORD) return res.status(500).json({ ok: false, recognized: false, error: 'Server configuration error' });

  const ip = getClientIp(req);
  if (isRateLimited(`login:${ip}`, 20, 15 * 60 * 1000)) {
    return res.status(429).json({ ok: false, error: 'Too many attempts' });
  }

  const { email, password, probe } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, recognized: false });
  if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ ok: false, error: 'Invalid email format' });
  const normalizedEmail = email.trim().toLowerCase();
  
  const allowedEmails = getAllowedLoginEmails();
  if (allowedEmails.length === 0) {
    return res.status(503).json({
      ok: false,
      recognized: false,
      error: 'Login allowlist not configured. Set AUTH_LOGIN_EMAIL in the server environment.',
    });
  }
  
  const recognized = isLoginEmailAllowed(normalizedEmail);
  
  if (probe) {
    if (!recognized) return res.status(403).json({ ok: false, recognized: false, error: 'Not recognised' });
    return res.json({ ok: true, recognized: true });
  }
  
  if (!password) return res.status(400).json({ ok: false, recognized });
  if (!recognized) return res.status(403).json({ ok: false, recognized: false, error: 'Not recognised' });
  if (!safeEq(password, AUTH_PASSWORD)) return res.status(401).json({ ok: false, recognized: true, error: 'Incorrect password' });

  attachHcSessionCookie(res);
  return res.json({ ok: true, skip2fa: AUTH_EMERGENCY_BYPASS });
}

async function handleSendCode(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!SECRET || !BOT_TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Auth service not configured' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  const normalizedEmail = String(email).trim().toLowerCase();
  if (getAllowedLoginEmails().length === 0) {
    return res.status(503).json({ error: 'Auth allowlist not configured' });
  }
  if (!isLoginEmailAllowed(normalizedEmail)) {
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

async function handleVerifyCode(req, res) {
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
  const valid = [bucket, bucket - 1].some(b => {
    const expected = crypto.createHmac('sha256', SECRET).update(`${code}:${b}`).digest('hex');
    return String(token).length === expected.length && crypto.timingSafeEqual(Buffer.from(String(token)), Buffer.from(expected));
  });

  if (valid) attachHcSessionCookie(res);
  res.json({ valid });
}

async function handleVerifyBackup(req, res) {
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
    const ok = verifyTotp(normalizedCode);
    if (ok) attachHcSessionCookie(res);
    return res.json({ valid: ok });
  }
  if (method === 'recovery') {
    const normalizedRecovery = verifyRecovery(normalizedCode);
    if (!normalizedRecovery) return res.json({ valid: false });
    const digest = crypto.createHash('sha256').update(normalizedRecovery).digest('hex');
    const once = await consumeOnce(`recovery:${digest}`, 365 * 24 * 60 * 60);
    if (!once.ok) return res.status(500).json({ valid: false, error: once.error });
    if (once.firstUse) attachHcSessionCookie(res);
    return res.json({ valid: once.firstUse });
  }

  return res.status(400).json({ valid: false, error: 'Unsupported method' });
}

async function handleSession(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'DELETE') return res.status(405).end();

  if (req.method === 'DELETE') {
    const secure = secureCookieSuffix();
    res.setHeader('Set-Cookie', `${HC_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return res.json({ ok: true });
  }

  const cookies = parseCookies(req);
  return res.json({
    authed: verifyHcSession(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET),
    staffScoped: verifyAnyStaffSacCookie(cookies[STAFF_SAC_COOKIE], STAFF_LINK_SECRET),
  });
}

async function handleChangePassword(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const cookies = parseCookies(req);
  if (!verifyHcSession(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }

  const { current } = req.body || {};
  if (!current) return res.status(400).json({ ok: false, error: 'Current password required' });

  if (!AUTH_PASSWORD || !safeEq(current, AUTH_PASSWORD)) {
    return res.status(403).json({ ok: false, error: 'Current password is incorrect' });
  }

  return res.status(200).json({
    ok: false,
    error: 'To change your password, update AUTH_PASSWORD in your Vercel project environment variables and redeploy.',
  });
}
