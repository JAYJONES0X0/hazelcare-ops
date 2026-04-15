import crypto from 'crypto';
import { put } from '@vercel/blob';
import { HC_SESSION_COOKIE, verifyHcSession } from '../_lib/hc-session.js';
import { parseCookies } from '../_lib/parse-cookies.js';
import { consumeOnce } from '../_lib/durable-once.js';
import { STAFF_SAC_COOKIE, signStaffSacCookie, verifyStaffSacCookie } from '../_lib/staff-sac-cookie.js';

const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET;
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';
const STAFF_LINK_TTL_MINUTES = Number(process.env.STAFF_LINK_TTL_MINUTES || '30');
const APP_ORIGIN = process.env.APP_ORIGIN || '';
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);

const STAFF_TOOLS = new Set(['notes', 'handover', 'actions', 'incidents']);
const verifyBuckets = new Map();

// Care Plan Domains
const CARE_PLAN_DOMAINS = [
  'Environment & Physical Safety', 'Respiratory Health & Support', 'Communication & Sensory Integration',
  'Social Engagement & Relationships', 'Life Skills & Daily Routine', 'Nutrition, Hydration & Diet',
  'Continence & Personal Hygiene', 'Adaptive Living Environment', 'Rights, Choice & Inclusion',
  'Intimacy & Personal Expression', 'Financial Management & Autonomy', 'Holistic Health & Vitality',
  'Infection Control & Public Health', 'Medication Management & Safety', 'Mental Health & Emotional Wellbeing',
  'Mobility, Movement & Exercise', 'Pain Management & Comfort', 'Personal Care & Physical Presentation',
  'Skin Integrity & Pressure Care', 'Rest & Sleep Patterns', 'Cultural, Spiritual & Personal Beliefs'
];

const INTEL_SYSTEM_PROMPT = `You are a Clinical Intelligence Specialist for a premium UK supported living provider. Your job is to extract highly structured clinical data from raw, unstructured text (social worker reports, hospital discharge notes, or old care plans).

OUTPUT FORMAT:
You MUST output ONLY a valid JSON object with this exact structure:
{
  "client": {
    "name": "Full Name",
    "preferredName": "First Name",
    "dob": "DD/MM/YYYY",
    "nhs": "NHS Number",
    "diagnoses": ["List of diagnoses"],
    "address": "Address if found",
    "keyWorker": "Name if found"
  },
  "carePlan": {
    "domains": [
      {
        "title": "One of the 21 specified domains",
        "enabled": true/false,
        "identifiedNeed": "Specific clinical need",
        "levelOfNeed": 0-4 (0: Independent, 1: Low, 2: Moderate, 3: Substantial, 4: High),
        "plannedOutcomes": "What we want to achieve",
        "howToAchieve": "Step-by-step staff instructions",
        "riskTitle": "Name of risk associated with this domain",
        "riskLikelihood": 1-5,
        "riskImpact": 1-5,
        "riskMitigation": "Immediate mitigation steps",
        "reviewer": "AI Analysis",
        "reviewDate": "Current Date",
        "nextReviewDate": "90 days from now"
      }
    ]
  },
  "risk": {
    "risks": [
      {
        "title": "Risk Name",
        "description": "Nature of the risk",
        "behaviours": ["List of behaviors"],
        "affectedPeople": ["List of people"],
        "triggers": ["List of triggers"],
        "earlyWarnings": ["List of signs"],
        "controls": ["Primary staff controls"],
        "dynamicControls": ["Responsive actions"],
        "secondaryRisk": "Collateral risks",
        "contingencyPlan": "What if controls fail?",
        "leastRestrictive": "Why this is least restrictive",
        "likelihood": 1-5,
        "impact": 1-5,
        "reviewTrigger": "What forces a review"
      }
    ],
    "leastRestrictivePractice": "Global statement",
    "escalationProcedure": "Emergency steps",
    "reviewSchedule": "Global schedule"
  },
  "gaps": ["List of missing information areas found in source"]
}

SPECIFIED DOMAINS (Use ONLY these):
${CARE_PLAN_DOMAINS.join(', ')}

RULES:
1. Extract as much detail as possible. Do not summarize into single lines.
2. If a domain is not mentioned, set "enabled": false.
3. Be specific with "howToAchieve" — include de-escalation, communication styles, and physical support.
4. Ensure risk Likelihood and Impact are realistic (1: Rare/Negligible, 5: Almost Certain/Catastrophic).
5. Identify GAPS where the source document is vague (e.g., "The source mentions medication but does not specify the dosage").
6. Output valid JSON only. No preamble.`;

const ENHANCE_SYSTEM_PROMPT = `You are a documentation specialist for Hazel Care Ltd, a UK supported living provider under active regulatory scrutiny from CQC and local councils. Your job is to rewrite substandard care notes into Gold Standard first-person progress notes that demonstrate active, professional engagement and can withstand regulatory review.

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

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = verifyBuckets.get(key) || [];
  const next = arr.filter((t) => now - t < windowMs);
  if (next.length >= max) {
    verifyBuckets.set(key, next);
    return true;
  }
  next.push(now);
  verifyBuckets.set(key, next);
  return false;
}

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

// Staff Link Utils
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

function generateLinkId() {
  return crypto.randomBytes(5).toString('base64url').slice(0, 8).toUpperCase();
}

async function storeToken(linkId, token, ttlSeconds) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;
  const url = `${UPSTASH_URL}/set/${encodeURIComponent(`slink:${linkId}`)}/${encodeURIComponent(token)}?EX=${ttlSeconds}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  return res.ok;
}

function parseToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', STAFF_LINK_SECRET).update(payload).digest('base64url');
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const raw = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchTokenByLinkId(linkId) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const url = `${UPSTASH_URL}/get/${encodeURIComponent(`slink:${linkId}`)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.result || null;
}

export default async function handler(req, res) {
  // Extract route from URL path — Vercel catch-all may not populate req.query.action
  const urlPath = (req.url || '').split('?')[0];
  const segments = urlPath.replace(/^\/api\/staff\/?/, '').split('/').filter(Boolean);
  const route = segments[0] || (req.query?.action ? (Array.isArray(req.query.action) ? req.query.action[0] : req.query.action) : null);

  if (!route) return res.status(404).json({ error: 'Staff route not found' });

  switch (route) {
    case 'issue-staff-link': return handleIssueStaffLink(req, res);
    case 'verify-staff-link': return handleVerifyStaffLink(req, res);
    case 'staff-sac-status': return handleStaffSacStatus(req, res);
    case 'analyze-intel': return handleAnalyzeIntel(req, res);
    case 'enhance-note': return handleEnhanceNote(req, res);
    case 'upload-document': return handleUploadDocument(req, res);
    default: return res.status(404).json({ error: 'Unknown staff action' });
  }
}

async function handleUploadDocument(req, res) {
  if (!setCors(req, res)) return res.status(403).end();
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!AUTH_SESSION_SECRET) return res.status(503).json({ error: 'Session not configured' });
  const cookies = parseCookies(req);
  if (!verifyHcSession(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filename = req.query.filename || 'document';
  
  try {
    const blob = await put(filename, req, {
      access: 'public',
    });
    return res.status(200).json(blob);
  } catch (error) {
    console.error('Blob upload error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleIssueStaffLink(req, res) {
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
  const linkId = generateLinkId();
  const stored = await storeToken(linkId, token, Math.ceil(ttlMs / 1000) + 60);

  const link = stored
    ? `${origin}#staff/${toolId}?id=${linkId}`
    : `${origin}#staff/${toolId}?t=${token}`;

  return res.json({ link, code, expiresAt: payloadObj.exp });
}

async function handleVerifyStaffLink(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!STAFF_LINK_SECRET) return res.status(500).json({ valid: false });

  const { token: rawToken, id: linkId, code, toolId } = req.body || {};
  if ((!linkId && !rawToken) || !code || !toolId) return res.status(400).json({ valid: false });

  const rateLimitKey = linkId ? `staff:id:${linkId}` : `staff:${String(rawToken).slice(0, 24)}`;
  if (isRateLimited(rateLimitKey, 8, 10 * 60 * 1000)) {
    return res.status(429).json({ valid: false });
  }

  let token = rawToken;
  if (linkId) {
    token = await fetchTokenByLinkId(linkId);
    if (!token) return res.json({ valid: false, reason: 'expired' });
  }

  const payload = parseToken(token);
  if (!payload) return res.json({ valid: false });
  if (payload.toolId !== toolId) return res.json({ valid: false });
  if (!payload.exp || Date.now() > payload.exp) return res.json({ valid: false, reason: 'expired' });
  if (!payload.jti) return res.json({ valid: false });

  const normalizedCode = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const hash = crypto.createHash('sha256').update(`${normalizedCode}:${STAFF_LINK_SECRET}`).digest('hex');
  if (hash.length !== String(payload.codeHash || '').length) return res.json({ valid: false });
  const ok = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(payload.codeHash));
  if (!ok) return res.json({ valid: false });

  const once = await consumeOnce(`staff-jti:${payload.jti}`, 24 * 60 * 60);
  if (!once.ok) return res.status(500).json({ valid: false, error: once.error });
  if (!once.firstUse) return res.json({ valid: false });

  const { value, maxAgeSec } = signStaffSacCookie(toolId, STAFF_LINK_SECRET);
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${STAFF_SAC_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`,
  );
  return res.json({ valid: true });
}

async function handleStaffSacStatus(req, res) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' ? '; Secure' : '';

  if (req.method === 'DELETE') {
    res.setHeader(
      'Set-Cookie',
      `${STAFF_SAC_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    );
    return res.json({ ok: true });
  }

  if (req.method !== 'GET') return res.status(405).end();
  if (!STAFF_LINK_SECRET) return res.status(500).json({ ok: false });

  const toolId = req.query?.toolId;
  if (!toolId || typeof toolId !== 'string') return res.status(400).json({ ok: false });

  const cookies = parseCookies(req);
  const raw = cookies[STAFF_SAC_COOKIE];
  const ok = verifyStaffSacCookie(raw, toolId, STAFF_LINK_SECRET);
  return res.json({ ok });
}

async function handleAnalyzeIntel(req, res) {
  if (!setCors(req, res)) return res.status(403).end();
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!AUTH_SESSION_SECRET) return res.status(503).json({ error: 'Session not configured' });
  const cookies = parseCookies(req);
  if (!verifyHcSession(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { text } = req.body || {};
  if (!text) return res.status(400).json({ message: 'No text provided' });

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: INTEL_SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this raw clinical text and map it to the CQC structure:\n\n${text}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      throw new Error(`Groq error: ${err}`);
    }

    const data = await groqRes.json();
    const result = JSON.parse(data.choices[0].message.content);
    res.status(200).json(result);
  } catch (error) {
    console.error('Intelligence Analysis Error:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
}

async function handleEnhanceNote(req, res) {
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
  ].filter((l) => l !== '').join('\n');

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
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
        } catch { /* skip */ }
      }
    }
  } finally {
    res.end();
  }
}
