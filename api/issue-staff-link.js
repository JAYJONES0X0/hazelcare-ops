import crypto from 'crypto';
import { parseCookies } from './_lib/parse-cookies.js';
import { HC_SESSION_COOKIE, verifyHcSession } from './_lib/hc-session.js';

const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET;
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';
const STAFF_LINK_TTL_MINUTES = Number(process.env.STAFF_LINK_TTL_MINUTES || '30');
const APP_ORIGIN = process.env.APP_ORIGIN || '';
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

const STAFF_TOOLS = new Set(['notes', 'handover', 'actions', 'incidents']);

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function hmac(payload) {
  return crypto.createHmac('sha256', STAFF_LINK_SECRET).update(payload).digest('base64url');
}

function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) out += '-';
    out += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return out;
}

/** Generate a short 8-char alphanumeric link ID */
function generateLinkId() {
  return crypto.randomBytes(5).toString('base64url').slice(0, 8).toUpperCase();
}

/** Store token in Upstash Redis with TTL. Falls back to embedding token in URL if Redis unavailable. */
async function storeToken(linkId, token, ttlSeconds) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
  const url = `${UPSTASH_URL}/set/${encodeURIComponent(`slink:${linkId}`)}/${encodeURIComponent(token)}?EX=${ttlSeconds}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!STAFF_LINK_SECRET) return res.status(500).json({ error: 'Staff link service not configured' });
  if (!AUTH_SESSION_SECRET) return res.status(503).json({ error: 'Session not configured' });

  const cookies = parseCookies(req);
  if (!verifyHcSession(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET)) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  const { toolId } = req.body || {};
  if (!toolId || !STAFF_TOOLS.has(toolId)) return res.status(400).json({ error: 'Invalid staff tool' });

  const code = generateAccessCode();
  const normalizedCode = code.replace(/-/g, '');
  const now = Date.now();
  const ttlMs = STAFF_LINK_TTL_MINUTES * 60 * 1000;
  const payloadObj = {
    toolId,
    exp: now + ttlMs,
    jti: crypto.randomBytes(12).toString('hex'),
    codeHash: crypto.createHash('sha256').update(`${normalizedCode}:${STAFF_LINK_SECRET}`).digest('hex'),
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = hmac(payload);
  const token = `${payload}.${sig}`;

  const origin = APP_ORIGIN || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

  // Try to use a short link ID via Redis
  const linkId = generateLinkId();
  const stored = await storeToken(linkId, token, Math.ceil(ttlMs / 1000) + 60);

  const link = stored
    ? `${origin}#staff/${toolId}?id=${linkId}`      // clean short URL
    : `${origin}#staff/${toolId}?t=${token}`;        // fallback: embed token

  return res.json({ link, code, expiresAt: payloadObj.exp });
}
