import crypto from 'crypto';
import { HC_SESSION_COOKIE, verifyHcSession } from './_lib/hc-session.js';
import { parseCookies } from './_lib/parse-cookies.js';

const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';

function safeEq(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Must be authenticated
  const cookies = parseCookies(req);
  if (!verifyHcSession(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }

  const { current } = req.body || {};
  if (!current) return res.status(400).json({ ok: false, error: 'Current password required' });

  // Verify the current password is correct
  if (!AUTH_PASSWORD || !safeEq(current, AUTH_PASSWORD)) {
    return res.status(403).json({ ok: false, error: 'Current password is incorrect' });
  }

  // Password changes require updating the AUTH_PASSWORD environment variable
  // in the deployment settings — this cannot be done at runtime.
  return res.status(200).json({
    ok: false,
    error: 'To change your password, update AUTH_PASSWORD in your Vercel project environment variables and redeploy.',
  });
}
