import crypto from 'node:crypto';
import { attachHcSessionCookieWithClaims } from '../_lib/attach-session.js';
import { getAllowedLoginEmails, getRoleForLoginEmail, isLoginEmailAllowed } from '../_lib/auth-login-allowlist.js';
import { consumeOnce } from '../_lib/durable-once.js';
import { isRateLimited } from '../_lib/rate-limit.js';
import { issueAuthChallenge, readAuthChallenge, clearAuthChallengeCookie } from '../_lib/auth-challenge.js';
import { HC_SESSION_COOKIE, readHcSessionClaims, verifyHcSession, secureCookieSuffix } from '../_lib/hc-session.js';
import { parseCookies } from '../_lib/parse-cookies.js';
import { STAFF_SAC_COOKIE, verifyAnyStaffSacCookie } from '../_lib/staff-sac-cookie.js';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const AUTH_EMERGENCY_BYPASS = process.env.AUTH_EMERGENCY_BYPASS === '1';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SECRET = process.env.CODE_SECRET;
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
const TOTP_SECRET = process.env.AUTH_TOTP_SECRET || '';
const RECOVERY_CODES = (process.env.AUTH_RECOVERY_CODES || '').split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';
const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET || '';
const AUTH_DEFAULT_ROLE = (process.env.AUTH_DEFAULT_ROLE || 'manager').toLowerCase();
const VALID_ROLES = new Set(['admin', 'manager', 'senior', 'viewer']);

function sanitizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return VALID_ROLES.has(value) ? value : 'manager';
}

function getClientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function safeEq(a, b) {
  const aa = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function setCors(req, res) {
  const origin = req.headers.origin, host = req.headers.host;
  let sameOrigin = false;
  try { sameOrigin = !!origin && new URL(origin).host === host; } catch { /* invalid Origin */ }
  const allowed = !origin || sameOrigin || ALLOWED_ORIGINS.includes(origin);
  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin, Cookie');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return allowed;
}

function methods() {
  return [TOTP_SECRET && 'totp', SECRET && BOT_TOKEN && CHAT_ID && 'telegram', RECOVERY_CODES.length && 'recovery'].filter(Boolean);
}

function pendingChallenge(req, res) {
  const pending = readAuthChallenge(req, AUTH_SESSION_SECRET);
  if (!pending || !isLoginEmailAllowed(pending.email)) {
    res.status(401).json({ valid: false, error: 'Sign in with your email and password before entering a verification code.' });
    return null;
  }
  return pending;
}

async function finishLogin(res, pending) {
  const once = await consumeOnce(`challenge:${pending.jti}`, 600);
  if (!once.ok) return res.status(503).json({ valid: false, error: once.error });
  if (!once.firstUse) return res.status(401).json({ valid: false, error: 'This sign-in request has already been used. Start again.' });
  const cookie = attachHcSessionCookieWithClaims(res, { email: pending.email, role: sanitizeRole(pending.role) });
  res.setHeader('Set-Cookie', [cookie, clearAuthChallengeCookie()]);
  return res.json({ ok: true, valid: true, role: sanitizeRole(pending.role), email: pending.email });
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
  if (!TOTP_SECRET) return null;
  const key = base32Decode(TOTP_SECRET);
  if (!key.length) return null;

  const timeStep = 30;
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  for (const drift of [-1, 0, 1]) {
    const expected = hotp(key, counter + drift, 6);
    if (safeEq(expected, userCode)) return counter + drift;
  }
  return null;
}

function verifyRecovery(userCode) {
  const normalized = String(userCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return false;
  const match = RECOVERY_CODES.some((stored) => safeEq(stored.replace(/[^A-Z0-9]/g, ''), normalized));
  return match ? normalized : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Surrogate-Control', 'no-store');
  if (!setCors(req, res)) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  const route = (req.url || '').split('?')[0].replace(/^\/api\/auth\/?/, '').split('/')[0] || (Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action);
  try {
    switch (route) {
      case 'login': return await handleLogin(req, res);
      case 'send-code': return await handleSendCode(req, res);
      case 'verify-code': return await handleVerifyCode(req, res);
      case 'verify-backup': return await handleVerifyBackup(req, res);
      case 'session': return handleSession(req, res);
      case 'change-password': return handleChangePassword(req, res);
      default: return res.status(404).json({ error: 'Unknown auth action' });
    }
  } catch {
    console.error('[auth] Authentication request could not complete');
    return res.status(503).json({ ok: false, error: 'The sign-in service is unavailable. Please retry.' });
  }
}

async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!AUTH_PASSWORD || !AUTH_SESSION_SECRET) return res.status(503).json({ ok: false, error: 'Sign-in is not configured. Contact the administrator.' });
  if (await isRateLimited(`login:${getClientIp(req)}`, 20, 15 * 60 * 1000)) return res.status(429).json({ ok: false, error: 'Too many attempts. Wait and retry.' });
  const { email, password, probe } = req.body || {};
  if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ ok: false, recognized: false, error: 'Enter a valid email address.' });
  if (!getAllowedLoginEmails().length) return res.status(503).json({ ok: false, recognized: false, error: 'Login allowlist is not configured.' });
  const normalizedEmail = email.trim().toLowerCase();
  const recognized = isLoginEmailAllowed(normalizedEmail);
  if (!recognized) return res.status(403).json({ ok: false, recognized: false, error: 'Not recognised' });
  if (probe) return res.json({ ok: true, recognized: true });
  if (typeof password !== 'string' || !safeEq(password, AUTH_PASSWORD)) return res.status(401).json({ ok: false, recognized: true, error: 'Incorrect password' });
  const claims = { email: normalizedEmail, role: sanitizeRole(getRoleForLoginEmail(normalizedEmail, AUTH_DEFAULT_ROLE)) };
  if (AUTH_EMERGENCY_BYPASS) {
    attachHcSessionCookieWithClaims(res, claims);
    return res.json({ ok: true, requires2fa: false, ...claims });
  }
  const availableMethods = methods();
  if (!availableMethods.length) return res.status(503).json({ ok: false, error: 'Verification is not configured. Contact the administrator.' });
  const pending = issueAuthChallenge(res, AUTH_SESSION_SECRET, claims);
  return res.json({ ok: true, requires2fa: true, methods: availableMethods, expiresAt: pending.exp });
}

async function handleSendCode(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const pending = pendingChallenge(req, res);
  if (!pending) return;
  if (!SECRET || !BOT_TOKEN || !CHAT_ID) return res.status(503).json({ error: 'Code delivery is not configured.' });
  if (await isRateLimited(`send:${getClientIp(req)}`, 8, 10 * 60 * 1000) || await isRateLimited(`send-email:${pending.email}`, 4, 10 * 60 * 1000)) return res.status(429).json({ error: 'Too many code requests. Wait and retry.' });
  const code = String(crypto.randomInt(100000, 1000000));
  const bucket = Math.floor(Date.now() / 600000);
  const token = crypto.createHmac('sha256', SECRET).update(`${pending.jti}:${code}:${bucket}`).digest('hex');
  const message = `OVSITE access request\nEmail: ${pending.email}\nCode: ${code}\nValid for this sign-in request only.`;
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: message }), signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) return res.status(502).json({ error: 'Could not deliver a code. Try another verification method.' });
  return res.json({ token });
}

async function handleVerifyCode(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const pending = pendingChallenge(req, res);
  if (!pending) return;
  if (!SECRET) return res.status(503).json({ valid: false, error: 'Code verification is not configured.' });
  const { code, token } = req.body || {};
  if (typeof code !== 'string' || typeof token !== 'string' || !/^\d{6}$/.test(code)) return res.status(400).json({ valid: false, error: 'Enter the six-digit code.' });
  if (await isRateLimited(`verify:${pending.jti}`, 8, 10 * 60 * 1000) || await isRateLimited(`verify-ip:${getClientIp(req)}`, 16, 10 * 60 * 1000)) return res.status(429).json({ valid: false, error: 'Too many attempts. Start a new sign-in request.' });
  const bucket = Math.floor(Date.now() / 600000);
  const valid = [bucket, bucket - 1].some(value => safeEq(token, crypto.createHmac('sha256', SECRET).update(`${pending.jti}:${code}:${value}`).digest('hex')));
  if (!valid) return res.status(401).json({ valid: false, error: 'The verification code is incorrect or expired.' });
  return finishLogin(res, pending);
}

async function handleVerifyBackup(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const pending = pendingChallenge(req, res);
  if (!pending) return;
  const { code, method } = req.body || {};
  if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ valid: false, error: 'Enter a verification code.' });
  if (await isRateLimited(`backup:${pending.jti}`, 8, 10 * 60 * 1000) || await isRateLimited(`backup-ip:${getClientIp(req)}`, 16, 10 * 60 * 1000)) return res.status(429).json({ valid: false, error: 'Too many attempts. Start a new sign-in request.' });
  if (method === 'totp') {
    const counter = verifyTotp(code.trim());
    if (counter === null) return res.status(401).json({ valid: false, error: 'The authenticator code is incorrect or expired.' });
    const once = await consumeOnce(`totp:${counter}`, 120);
    if (!once.ok) return res.status(503).json({ valid: false, error: once.error });
    if (!once.firstUse) return res.status(401).json({ valid: false, error: 'This authenticator code has already been used. Wait for the next code.' });
  } else if (method === 'recovery') {
    const recovery = verifyRecovery(code);
    if (!recovery) return res.status(401).json({ valid: false, error: 'The recovery code is incorrect or already used.' });
    const digest = crypto.createHash('sha256').update(recovery).digest('hex');
    const once = await consumeOnce(`recovery:${digest}`, 365 * 24 * 60 * 60);
    if (!once.ok) return res.status(503).json({ valid: false, error: once.error });
    if (!once.firstUse) return res.status(401).json({ valid: false, error: 'The recovery code is incorrect or already used.' });
  } else return res.status(400).json({ valid: false, error: 'Unsupported verification method.' });
  return finishLogin(res, pending);
}

function handleSession(req, res) {
  if (req.method !== 'GET' && req.method !== 'DELETE') return res.status(405).end();
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [`${HC_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieSuffix()}`, clearAuthChallengeCookie()]);
    return res.json({ ok: true });
  }
  if (!AUTH_SESSION_SECRET) return res.status(503).json({ authed: false, error: 'Session is not configured.' });
  const cookies = parseCookies(req);
  const claims = readHcSessionClaims(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET);
  return res.json({ authed: !!claims, staffScoped: verifyAnyStaffSacCookie(cookies[STAFF_SAC_COOKIE], STAFF_LINK_SECRET), role: sanitizeRole(claims?.role || AUTH_DEFAULT_ROLE), email: claims?.email || '' });
}

function handleChangePassword(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!verifyHcSession(parseCookies(req)[HC_SESSION_COOKIE], AUTH_SESSION_SECRET)) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!safeEq(req.body?.current || '', AUTH_PASSWORD)) return res.status(403).json({ ok: false, error: 'Current password is incorrect' });
  return res.status(409).json({ ok: false, error: 'Update AUTH_PASSWORD in the Vercel project environment variables and redeploy to change the access key.' });
}
