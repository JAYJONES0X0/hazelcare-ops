import { parseCookies } from './_lib/parse-cookies.js';
import { HC_SESSION_COOKIE, verifyHcSession } from './_lib/hc-session.js';

const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';

const SYSTEM_PROMPT = `You are a documentation specialist for Hazel Care Ltd, a UK supported living provider under active regulatory scrutiny from CQC and local councils. Your job is to rewrite substandard care notes into Gold Standard first-person progress notes that demonstrate active, professional engagement and can withstand regulatory review.

GOLD STANDARD FORMAT:
- Write in FIRST PERSON throughout ("I supported...", "I observed...", "I encouraged...", "I explained...")
- Write as FLOWING PROSE — no bullet points, no numbered lists, no headers
- Show active decision-making: document WHY you did things, not just WHAT happened
- Name de-escalation techniques explicitly (e.g., "I applied a calm, non-intrusive presence and gave her space to self-regulate")
- Show the client's changing presentation and mood throughout the shift
- For any refusal: document the encouragement attempt, the client's response, and how you respected their choice while managing risk
- For 1:1 support: show the interaction quality — the give and take between carer and client
- Include specific times when mentioned in the original
- End with: outcome summary, any handover actions, and note if no incidents/safeguarding concerns were identified
- Professional UK supported-living terminology throughout (behaviour, medication, authorised, centre, wellbeing)

CRITICAL RULES:
- Do NOT invent or add any facts not present in the original note — only reframe and enrich what is already there
- If input is in another language, translate accurately then reformat
- Output ONLY the rewritten note — no title, no subject line, no preamble, no explanation
- This note must demonstrate that a skilled, attentive professional was present and actively supporting the client at all times`;

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
      max_tokens: 1200,
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
