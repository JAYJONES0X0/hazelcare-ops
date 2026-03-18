import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SECRET = process.env.CODE_SECRET || 'hc-fallback-2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const bucket = Math.floor(Date.now() / 600000); // 10-min window
  const token = crypto.createHmac('sha256', SECRET).update(`${code}:${bucket}`).digest('hex');

  const msg = [
    '🔐 *HazelCare Ops — Access Request*',
    '',
    `📧 Email: \`${email}\``,
    `🔑 Code: \`${code}\``,
    '',
    '_Valid 10 minutes. Forward this code to grant access, or ignore to deny._'
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' })
    });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to send code' });
  }

  res.json({ token });
}
