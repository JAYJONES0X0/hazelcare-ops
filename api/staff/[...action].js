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

const ENHANCE_SYSTEM_PROMPT = `You are a senior support worker and clinical documentation specialist with 30 years of frontline and management experience in UK supported living, specialist care, and complex needs services. You have worked across learning disabilities, autism, acquired brain injury, mental health, and forensic settings. Your notes are consistently cited by CQC inspectors as examples of outstanding practice.

You write shift notes with three qualities: clinical precision, genuine human warmth, and professional accountability. You never sound robotic, bureaucratic, or template-filling. You sound like someone who genuinely knows this person and cares about them.

RULES:
1. UK ENGLISH only — summarise, recognise, behaviour, practise, centre, etc.
2. PERSONA: Write in first person as the staff member who was on shift. You are documenting what you observed and did, not describing the client from a distance.
3. TEMPLATE IS STRUCTURE ONLY: If a [MANDATORY LAYOUT / TEMPLATE] is provided, it is a SKELETON — headers, time blocks, spacing. IGNORE all example text and facts inside the template. Never let template content bleed into the output.
4. RAW DATA IS SOVEREIGN: The [RAW DATA TO PROCESS] is the ONLY source of facts about what happened. You may infer mood and context from the facts, but you may NOT add events, locations, or actions that are not in the raw data.
5. CONTEXT KNOWLEDGE: If [ESSENTIAL CONTEXT] is provided (absorbed PDFs, PBS, care plan, risk assessments), use it as your professional knowledge base. Apply it the way an experienced worker uses their knowledge — to describe events with proper professional language, to notice and name relevant behaviours, to reference support strategies in passing ("In line with his PBS..."), and to write with genuine insight into the person's needs.
6. PRESERVE WHITESPACE: Mirror the exact line breaks, blank lines, and headers of the template.
7. ORGANIC NARRATIVE: Within the structure, write with warmth. Avoid robotic phrases like "the service user was observed to be" — instead write "he appeared settled" or "I found him in good spirits."
8. Output ONLY the finished note. No preamble, no explanation.`;

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

// ── Empire AI Router ────────────────────────────────────────────────────────
// Priority: Gemini FREE (1M tokens/day, 1M ctx) → OpenRouter free → Groq

async function callGemini(messages, options = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');
  const contents = userMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const body = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.25,
      maxOutputTokens: options.max_tokens ?? 2000,
    },
    ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
  };

  // Empire key supports 2.5-flash — use it first
  const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-001'];
  const action = options.stream ? 'streamGenerateContent?alt=sse' : 'generateContent';

  for (const model of geminiModels) {
    const sep = action.includes('?') ? '&' : '?';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}${sep}key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) return { res, provider: 'gemini' };
    const err = await res.json().catch(() => ({}));
    console.warn(`[Gemini] ${model} failed: ${res.status} ${err?.error?.message || ''}`);
  }
  throw new Error('All Gemini models failed');
}

async function callOpenRouter(messages, options = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');

  // Free models on OpenRouter
  const models = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
  ];

  for (const model of models) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hazelcare-ops.vercel.app',
        'X-Title': 'Hazel Care Ops',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.25,
        max_tokens: options.max_tokens ?? 2000,
        stream: options.stream || false,
      }),
    });

    if (res.ok) return { res, provider: 'openrouter', model };
    const err = await res.json().catch(() => ({}));
    console.warn(`[OpenRouter] ${model} failed: ${res.status} ${err?.error?.message || ''}`);
  }
  throw new Error('All OpenRouter models failed');
}

async function callGroq(messages, options = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant'];
  for (const model of models) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages,
        temperature: options.temperature ?? 0.25,
        stream: options.stream || false,
        max_tokens: options.max_tokens ?? 2000,
        response_format: options.response_format,
      }),
    });
    if (res.ok) return { res, provider: 'groq', model };
    if (res.status === 401) throw new Error('Groq auth failed');
    const err = await res.json().catch(() => ({}));
    console.warn(`[Groq] ${model} failed: ${res.status} ${err?.error?.message || ''}`);
  }
  throw new Error('All Groq models rate limited');
}

async function callEmpireStack(messages, options = {}) {
  const providers = [
    () => callGemini(messages, options),
    () => callOpenRouter(messages, options),
    () => callGroq(messages, options),
  ];

  let lastError;
  for (const attempt of providers) {
    try {
      const result = await attempt();
      console.log(`[Empire Router] Using: ${result.provider}`);
      return result;
    } catch (e) {
      lastError = e;
      console.warn(`[Empire Router] Provider failed: ${e.message}`);
    }
  }
  throw lastError || new Error('All AI providers unavailable. Please try again in a moment.');
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
    const messages = [
      { role: 'system', content: INTEL_SYSTEM_PROMPT },
      { role: 'user', content: `Analyse this raw text and map it to the CQC structure:\n\n${text}` },
    ];

    // For JSON analysis, use non-streaming — try Groq first (supports json_object), then OpenRouter, then Gemini
    let rawContent;
    try {
      const { res: groqRes } = await callGroq(messages, { response_format: { type: 'json_object' }, stream: false });
      const data = await groqRes.json();
      rawContent = data.choices[0].message.content;
    } catch {
      const { res: orRes, provider } = await callOpenRouter(messages, { stream: false }).catch(() => callGemini(messages, { stream: false }));
      if (provider === 'gemini') {
        const data = await orRes.json();
        rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      } else {
        const data = await orRes.json();
        rawContent = data.choices[0].message.content;
      }
    }

    // Extract JSON even if model wraps it in markdown
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
    res.status(200).json(result);
  } catch (error) {
    console.error('Intel Analysis Error:', error);
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

  const { text, noteType, clientName, referenceTemplate, refineInstructions, previousOutput, clinicalContext } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).send('No text provided');
  if (text.length > 24_000) return res.status(413).send('Input too large');

  // Smart context truncation — Groq models have ~128K token windows.
  // We budget: 500 system + 6000 context + 2000 template + 4000 note + 2000 output = ~14500 tokens safe.
  // 1 token ≈ 4 chars, so 6000 tokens ≈ 24000 chars for context.
  const CTX_MAX = 20_000;
  const TPL_MAX = 4_000;
  const PREV_MAX = 4_000;

  const safeContext = clinicalContext
    ? clinicalContext.slice(0, CTX_MAX) + (clinicalContext.length > CTX_MAX ? '\n[...context truncated to fit model window...]' : '')
    : '';
  const safeTemplate = referenceTemplate
    ? referenceTemplate.slice(0, TPL_MAX)
    : '';
  const safePrev = previousOutput
    ? previousOutput.slice(0, PREV_MAX)
    : '';

  const userPrompt = [
    noteType ? `Note type: ${noteType}` : '',
    clientName ? `Client/subject: ${clientName}` : '',
    safeContext ? `\n[ESSENTIAL CONTEXT — READ THIS AS YOUR STAFF KNOWLEDGE BEFORE WRITING]:\n${safeContext}\n` : '',
    safeTemplate ? `\n[MANDATORY LAYOUT — USE STRUCTURE ONLY, IGNORE ITS CONTENT]:\n${safeTemplate}\n` : '',
    safePrev ? `\n[PREVIOUS DRAFT]:\n${safePrev}\n` : '',
    refineInstructions ? `\n[REFINEMENT INSTRUCTION — PRIORITISE THIS]:\n${refineInstructions}\n` : '',
    '',
    'TASK:',
    refineInstructions
      ? 'Apply the refinement instruction to the previous draft while maintaining the layout of the template.'
      : 'Extract the facts from the [RAW DATA TO PROCESS] and map them into the structure of the [MANDATORY LAYOUT]. Do NOT use any facts from the template itself.',
    '',
    '[RAW DATA TO PROCESS — THIS IS WHAT HAPPENED ON SHIFT]:',
    text.trim(),
  ].filter((l) => l !== '').join('\n');

  const messages = [
    { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
  const opts = { stream: true, max_tokens: 2000, temperature: 0.25 };

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const { res: aiRes, provider } = await callEmpireStack(messages, opts);
    const reader = aiRes.body?.getReader();
    if (!reader) return res.status(502).end('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

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
          let chunk = '';
          if (provider === 'gemini') {
            // Gemini SSE: candidates[0].content.parts[0].text
            chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            // OpenAI-compatible (Groq, OpenRouter)
            chunk = parsed.choices?.[0]?.delta?.content || '';
          }
          if (chunk) res.write(chunk);
        } catch { /* skip malformed chunks */ }
      }
    }
  } catch (e) {
    const msg = e?.message || '';
    const friendly = msg.includes('unavailable') || msg.includes('rate') || msg.includes('limit') || msg.includes('saturated')
      ? 'AI models are at capacity — wait 30 seconds and try again.'
      : `Generation failed: ${msg}`;
    res.write(friendly);
  } finally {
    res.end();
  }
}
