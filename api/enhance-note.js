import { parseCookies } from './_lib/parse-cookies.js';
import { HC_SESSION_COOKIE, verifyHcSession } from './_lib/hc-session.js';

const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';

const SYSTEM_PROMPT = `You are a professional care note writer for a UK supported living service (Hazel Care Ltd). Your job is to take rough notes, casual language, or notes written in ANY language, and rewrite them as professional, clear, third-person care notes suitable for a Nourish care management system.

RULES:
- Write in third person ("The client" / "Client presented" / "Staff supported")
- Use professional UK supported-living terminology
- Keep factual accuracy — do not add information not given
- Structure naturally: what happened → staff response → outcome/follow-up
- UK English spelling throughout (behaviour, medication, authorised, centre)
- Output ONLY the care note — no preamble, no title, no explanation, no quotation marks
- Be concise but complete — every key fact included
- If input is in another language, translate accurately and reformat professionally`;

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowed = !!origin && ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin);
  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return allowed;
}

export default async function handler(req, res) {
  if (!setCors(req, res)) return res.status(403).end();
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!AUTH_SESSION_SECRET) return res.status(503).json({ error: 'Session not configured' });
  const cookies = parseCookies(req);
  if (!verifyHcSession(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { text, noteType, clientName } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).send('No text provided');
  if (text.length > 24_000) return res.status(413).send('Input too large');

  const userPrompt = [
    noteType ? `Note type: ${noteType}` : '',
    clientName ? `Client/subject: ${clientName}` : '',
    '',
    'Convert this to a professional care note:',
    '',
    text.trim(),
  ]
    .filter((l) => l !== null)
    .join('\n');

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      max_tokens: 600,
      temperature: 0.25,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    return res.status(502).send(`Groq error: ${err}`);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const reader = groqRes.body?.getReader();
  if (!reader) return res.status(502).send('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) res.write(chunk);
        } catch {
          /* skip malformed */
        }
      }
    }
  } finally {
    res.end();
  }
}
