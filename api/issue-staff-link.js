import crypto from 'crypto';

const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET;
const STAFF_LINK_TTL_MINUTES = Number(process.env.STAFF_LINK_TTL_MINUTES || '30');
const APP_ORIGIN = process.env.APP_ORIGIN || '';

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
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!STAFF_LINK_SECRET) return res.status(500).json({ error: 'Staff link service not configured' });

  const { toolId } = req.body || {};
  if (!toolId || !STAFF_TOOLS.has(toolId)) return res.status(400).json({ error: 'Invalid staff tool' });

  const code = generateAccessCode();
  const normalizedCode = code.replace(/-/g, '');
  const now = Date.now();
  const payloadObj = {
    toolId,
    exp: now + STAFF_LINK_TTL_MINUTES * 60 * 1000,
    jti: crypto.randomBytes(12).toString('hex'),
    codeHash: crypto.createHash('sha256').update(`${normalizedCode}:${STAFF_LINK_SECRET}`).digest('hex'),
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = hmac(payload);
  const token = `${payload}.${sig}`;

  const origin = APP_ORIGIN || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  const link = `${origin}#staff/${toolId}?t=${token}`;

  return res.json({ link, code, expiresAt: payloadObj.exp });
}
