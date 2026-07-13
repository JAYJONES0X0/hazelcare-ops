import crypto from 'crypto';
import { put } from '@vercel/blob';
import { HC_SESSION_COOKIE, readHcSessionClaims, verifyHcSession } from '../_lib/hc-session.js';
import { parseCookies } from '../_lib/parse-cookies.js';
import { consumeOnce } from '../_lib/durable-once.js';
import { STAFF_SAC_COOKIE, signStaffSacCookie, verifyStaffSacCookie } from '../_lib/staff-sac-cookie.js';

const STAFF_LINK_SECRET = process.env.STAFF_LINK_SECRET;
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';
const AUTH_DEFAULT_ROLE = (process.env.AUTH_DEFAULT_ROLE || 'manager').toLowerCase();
const STAFF_LINK_TTL_MINUTES = Number(process.env.STAFF_LINK_TTL_MINUTES || '30');
const APP_ORIGIN = process.env.APP_ORIGIN || '';
function sanitizeEnvValue(v) {
  const firstLine = String(v || '').split(/\r?\n/)[0];
  return firstLine.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
}
const UPSTASH_URL = sanitizeEnvValue(process.env.UPSTASH_REDIS_REST_URL);
const UPSTASH_TOKEN = sanitizeEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN);
const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);

const STAFF_TOOLS = new Set(['notes', 'handover', 'actions', 'incidents']);
const verifyBuckets = new Map();
const ROLE_RANK = { viewer: 0, senior: 1, manager: 2, admin: 3 };

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

const INTEL_SYSTEM_PROMPT = `You are a Clinical Intelligence Specialist for a UK supported living provider. You extract structured clinical data from raw documents — social worker reports, hospital discharge summaries, council support plans (Bristol City Council, Adult Social Care, etc.), NHS assessments, and old care plans.

DOCUMENT FORMAT AWARENESS:
- UK council support plans (BCC, adult social care) use table-based layouts. Columns include: "Support need", "What I can do myself", "What support I need", "How I want to be supported", "My goals / outcomes", "Risk". Extract from ALL of these columns.
- Header rows like "GP Name GP Address", "Related Name Relationship Type Communication Method" are METADATA — skip them.
- Section headers like "Personal Care", "Communication", "Health" in council docs map directly to CQC domains.
- If the document has a support plan table, EVERY row with a need description is a domain to map.
- Diagnoses may appear as: "Primary diagnosis", "Presenting needs", "Conditions", or inline in narrative text.

OUTPUT FORMAT — output ONLY a valid JSON object, no preamble, no markdown:
{
  "client": {
    "name": "Full Name",
    "preferredName": "First Name",
    "dob": "DD/MM/YYYY",
    "nhs": "NHS Number if present",
    "diagnoses": ["All diagnoses, conditions, and presenting needs found"],
    "address": "Address if found",
    "keyWorker": "Key worker or allocated worker if found"
  },
  "carePlan": {
    "domains": [
      {
        "title": "One of the 21 specified domains",
        "enabled": true,
        "identifiedNeed": "Specific need — copy the actual wording from the source, do not paraphrase",
        "levelOfNeed": 0-4,
        "plannedOutcomes": "Goals or desired outcomes from the document",
        "howToAchieve": "Exact staff instructions from the source — include communication style, prompting approach, physical support, de-escalation. Be specific.",
        "riskTitle": "Risk name if a risk is described for this domain",
        "riskLikelihood": 1-5,
        "riskImpact": 1-5,
        "riskMitigation": "Mitigation steps from the source",
        "reviewer": "AI Analysis",
        "reviewDate": "today",
        "nextReviewDate": "90 days from today"
      }
    ]
  },
  "risk": {
    "risks": [
      {
        "title": "Risk Name",
        "description": "Full description of the risk",
        "behaviours": ["Observable behaviours"],
        "affectedPeople": ["Who is affected"],
        "triggers": ["Known triggers"],
        "earlyWarnings": ["Early warning signs"],
        "controls": ["Primary staff controls"],
        "dynamicControls": ["Responsive in-the-moment actions"],
        "secondaryRisk": "Collateral/secondary risks",
        "contingencyPlan": "What to do if controls fail",
        "leastRestrictive": "Why this approach is least restrictive",
        "likelihood": 1-5,
        "impact": 1-5,
        "reviewTrigger": "What event forces a review"
      }
    ],
    "leastRestrictivePractice": "Global least restrictive statement",
    "escalationProcedure": "Emergency escalation steps",
    "reviewSchedule": "Review schedule"
  },
  "gaps": ["Specific areas where the source is vague or missing detail"]
}

SPECIFIED DOMAINS (map ALL source needs to these — do not invent new domain names):
${CARE_PLAN_DOMAINS.join(', ')}

RULES:
1. Map EVERY support need or care area found in the document to a domain. Do not skip areas just because they seem minor.
2. "howToAchieve" must contain actual actionable staff instructions copied or closely derived from the source — not generic advice.
3. "identifiedNeed" must reflect what the document actually says about the person, not a template sentence.
4. If a domain is genuinely not mentioned anywhere in the document, set "enabled": false and omit other fields.
5. levelOfNeed: 0 = Independent, 1 = Low, 2 = Moderate, 3 = Substantial, 4 = High/Critical.
6. Risk likelihood/impact: 1 = Rare/Negligible → 5 = Almost Certain/Catastrophic.
7. Identify GAPS where the source is vague (e.g. "Medication is mentioned but no dosage, frequency or MAR details given").
8. Output valid JSON only. No explanation, no markdown fences.`;

const ENHANCE_SYSTEM_PROMPT = `You are a senior support worker and clinical documentation specialist with 30 years of frontline and management experience in UK supported living, specialist care, and complex needs services. You have worked across learning disabilities, autism, acquired brain injury, mental health, and forensic settings. Your notes are consistently cited by CQC inspectors as examples of outstanding practice.

You write shift notes with three qualities: clinical precision, genuine human warmth, and professional accountability. You never sound robotic, bureaucratic, or template-filling. You sound like someone who genuinely knows this person and cares about them.

RULES:
1. UK ENGLISH only - summarise, recognise, behaviour, practise, centre, etc.
2. PERSONA: Write in first person as the staff member who was on shift. You are documenting what you observed and did, not describing the client from a distance.
3. TEMPLATE IS STRUCTURE ONLY: The [MANDATORY LAYOUT / TEMPLATE] is a HOLLOW SKELETON. You must mirror its headers, time-block patterns, and whitespace exactly, but you MUST NOT use any of the names, dates, times, or events described in it. If the template says "Jamie took meds at 12:00" but the raw data says "Sarah took meds at 09:00", you write "09:00: Sarah took meds".
4. EVIDENCE HIERARCHY: [RAW DATA TO PROCESS] is the primary source for what happened in this exact note. [ESSENTIAL CONTEXT] is OS knowledge: care-plan strategy, roster, surrounding diary evidence, vault documents, and conflict checks. Use it to understand the person and identify contradictions, but do not invent events from it.
5. CONFLICTS: If raw data conflicts with OS context, roster, MAR wording, or surrounding evidence, do not silently smooth it over. Align only to the strongest explicit source or state the conflict in professional wording.
6. CLINICAL VACUUM: Treat the template as if it were written by a ghost. It provides the rhythm, you provide the reality.
7. PRESERVE WHITESPACE: Mirror the exact line breaks, blank lines, and headers of the template.
8. ORGANIC NARRATIVE: Within the structure, write with warmth. Avoid robotic phrases like "the service user was observed to be" - instead write "he appeared settled" or "I found him in good spirits."
9. COMPLETE EVERY SECTION: If the template has multiple headings or time blocks, output every heading/time block in order. Do not stop after the first section. If the raw data has limited detail for a later section, write a concise evidence-based note for that section rather than omitting it.
10. Output ONLY the finished note. No preamble, no explanation.`;

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
  const host = req.headers.host;
  let sameOrigin = false;

  if (origin && host) {
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  }

  const allowed = !origin
    || sameOrigin
    || (APP_ORIGIN && origin === APP_ORIGIN)
    || (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin));

  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return allowed;
}

function sanitizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ROLE_RANK, r) ? r : 'manager';
}

function roleAtLeast(currentRole, minRole) {
  const curr = ROLE_RANK[sanitizeRole(currentRole)] ?? ROLE_RANK.manager;
  const min = ROLE_RANK[sanitizeRole(minRole)] ?? ROLE_RANK.manager;
  return curr >= min;
}

function parseModelJson(rawContent, providerLabel) {
  const raw = String(rawContent || '').trim();
  if (!raw) throw new Error(`${providerLabel} returned an empty response`);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  if (!parsed || typeof parsed !== 'object') throw new Error(`${providerLabel} returned non-object JSON`);
  if (!parsed.client || !parsed.carePlan || !parsed.risk || !Array.isArray(parsed.gaps)) {
    throw new Error(`${providerLabel} returned incomplete intelligence JSON`);
  }
  return parsed;
}

function requireSessionRole(req, res, minRole = 'manager') {
  if (!AUTH_SESSION_SECRET) {
    res.status(503).json({ error: 'Session not configured' });
    return null;
  }
  const cookies = parseCookies(req);
  const claims = readHcSessionClaims(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET);
  if (!claims) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const role = sanitizeRole(claims.role || AUTH_DEFAULT_ROLE);
  if (!roleAtLeast(role, minRole)) {
    res.status(403).json({ error: 'Forbidden', requiredRole: minRole, currentRole: role });
    return null;
  }
  return role;
}

// Allows either a manager session (at or above minRole) OR a verified staff share-link cookie
// for a fixed toolId. Staff opening a share link never get an HC session — only the staff-sac
// cookie — so endpoints staff actually use (enhance-note) must accept both. toolId is never
// taken from client input — callers pass the fixed tool the handler actually serves.
function requireSessionOrStaffAccess(req, res, toolId, minRole = 'senior') {
  const cookies = parseCookies(req);
  const managerClaims = AUTH_SESSION_SECRET ? readHcSessionClaims(cookies[HC_SESSION_COOKIE], AUTH_SESSION_SECRET) : null;
  if (managerClaims) {
    const role = sanitizeRole(managerClaims.role || AUTH_DEFAULT_ROLE);
    if (!roleAtLeast(role, minRole)) {
      res.status(403).json({ error: 'Forbidden', requiredRole: minRole, currentRole: role });
      return null;
    }
    return { via: 'manager', role };
  }

  if (STAFF_LINK_SECRET && verifyStaffSacCookie(cookies[STAFF_SAC_COOKIE], toolId, STAFF_LINK_SECRET)) {
    return { via: 'staff-link' };
  }
  res.status(401).json({ error: 'Unauthorized' });
  return null;
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

async function upstashCmd(cmd) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

const PENDING_NOTES_KEY = 'staffnotes:pending';

export default async function handler(req, res) {
  // Extract route from URL path - Vercel catch-all may not populate req.query.action
  const urlPath = (req.url || '').split('?')[0];
  const segments = urlPath.replace(/^\/api\/staff\/?/, '').split('/').filter(Boolean);
  const route = segments[0] || (req.query?.action ? (Array.isArray(req.query.action) ? req.query.action[0] : req.query.action) : null);

  if (!route) return res.status(404).json({ error: 'Staff route not found' });

  switch (route) {
    case 'issue-staff-link': return handleIssueStaffLink(req, res);
    case 'verify-staff-link': return handleVerifyStaffLink(req, res);
    case 'staff-sac-status': return handleStaffSacStatus(req, res);
    case 'submit-note': return handleSubmitNote(req, res);
    case 'pending-notes': return handlePendingNotes(req, res);
    case 'ack-note': return handleAckNote(req, res);
    case 'analyze-intel': return handleAnalyzeIntel(req, res);
    case 'enhance-note': return handleEnhanceNote(req, res);
    case 'ghost-write': return handleGhostWrite(req, res);
    case 'refine-tasks': return handleRefineTasks(req, res);
    case 'upload-document': return handleUploadDocument(req, res);
    default: return res.status(404).json({ error: 'Unknown staff action' });
  }
}

async function handleUploadDocument(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ error: 'Origin is not allowed for document uploads' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!requireSessionRole(req, res, 'senior')) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'External evidence upload is not configured yet. Add BLOB_READ_WRITE_TOKEN in Vercel to enable document storage.',
      code: 'BLOB_NOT_CONFIGURED',
    });
  }

  // Size cap (25MB) — reject before streaming a huge body to Blob.
  const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
  const declaredLen = Number(req.headers['content-length'] || 0);
  if (declaredLen && declaredLen > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: 'File too large (max 25MB).' });
  }

  // MIME allowlist — clinical evidence only (documents + photos).
  const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
  ]);
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (mime && !ALLOWED_MIME.has(mime)) {
    return res.status(415).json({ error: `Unsupported file type: ${mime}` });
  }

  // Sanitize filename — strip path components and unsafe characters.
  const rawName = String(req.query.filename || 'document').split(/[\\/]/).pop();
  const filename = (rawName || 'document').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200) || 'document';

  try {
    const blob = await put(filename, req, {
      access: 'public',
    });
    return res.status(200).json(blob);
  } catch (error) {
    console.error('Blob upload error:', error);
    return res.status(500).json({ error: 'Document storage failed. Check the Vercel Blob configuration and retry.' });
  }
}

async function handleIssueStaffLink(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!STAFF_LINK_SECRET) return res.status(500).json({ error: 'Staff link service not configured' });
  if (!requireSessionRole(req, res, 'manager')) return;

  const { toolId, email } = req.body || {};
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

  // Code is intentionally NOT embedded in the link — link possession alone must not be
  // enough to authenticate. The code stays a separate factor, typed in on the device.
  const link = stored
    ? `${origin}#staff/${toolId}?id=${linkId}`
    : `${origin}#staff/${toolId}?t=${token}`;

  let sent = false;
  if (email && typeof email === 'string' && email.includes('@')) {
    try {
      const origin = APP_ORIGIN || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
      const resendKey = sanitizeEnvValue(process.env.RESEND_API_KEY);
      if (resendKey) {
        const { Resend } = await import('resend');
        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
          from: 'Care Ops <onboarding@resend.dev>',
          to: email.trim().toLowerCase(),
          subject: 'Care Note Request — Access Link',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="margin:0 0 8px">Your care note link</h2>
            <p style="color:#555;font-size:14px;line-height:1.5">Tap the button below, then enter the code shown beneath it to get to your note screen.</p>
            <div style="background:#f5f5f5;border-radius:12px;padding:24px;margin:24px 0;text-align:center">
              <a href="${link}" style="display:inline-block;background:#14b8a6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:14px">Open My Note Screen</a>
            </div>
            <div style="background:#fff;border:2px dashed #ddd;border-radius:12px;padding:20px;text-align:center;font-size:22px;letter-spacing:4px;font-weight:bold;margin:24px 0">${code}</div>
            <p style="color:#999;font-size:12px">Expires in ${STAFF_LINK_TTL_MINUTES} minutes | Works once | If the button doesn't work, copy this link: ${link}</p>
          </div>`
        });
        if (!error) sent = true;
        else console.warn('[staff-link] resend error:', error);
      }
    } catch (e) {
      console.warn('[staff-link] email send failed:', e.message);
    }
  }

  return res.json({ link, code, expiresAt: payloadObj.exp, sent });
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

async function handleSubmitNote(req, res) {
  if (!setCors(req, res)) return res.status(403).end();
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!STAFF_LINK_SECRET) return res.status(500).json({ ok: false, error: 'Staff link service not configured' });

  const cookies = parseCookies(req);
  const { toolId, client, house, noteType, text, evidenceTrail, staffName } = req.body || {};
  if (!toolId || !text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ ok: false, error: 'toolId and text required' });
  }
  const raw = cookies[STAFF_SAC_COOKIE];
  if (!verifyStaffSacCookie(raw, toolId, STAFF_LINK_SECRET)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(503).json({ ok: false, error: 'Queue not configured' });
  }

  const id = crypto.randomBytes(8).toString('hex');
  const note = {
    id,
    toolId,
    client: (client || '').slice(0, 200),
    house: (house || '').slice(0, 200),
    noteType: (noteType || '').slice(0, 100),
    text: text.slice(0, 20_000),
    evidenceTrail: (evidenceTrail || '').slice(0, 8_000),
    staffName: (staffName || '').slice(0, 200),
    submittedAt: Date.now(),
  };

  const result = await upstashCmd(['HSET', PENDING_NOTES_KEY, id, JSON.stringify(note)]);
  if (!result || result.error) return res.status(500).json({ ok: false, error: 'Failed to queue note' });

  return res.json({ ok: true, id });
}

async function handlePendingNotes(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!requireSessionRole(req, res, 'senior')) return;
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return res.json({ notes: [] });

  const result = await upstashCmd(['HGETALL', PENDING_NOTES_KEY]);
  const flat = result?.result || [];
  const notes = [];
  for (let i = 0; i < flat.length; i += 2) {
    try { notes.push(JSON.parse(flat[i + 1])); } catch { /* skip corrupt entry */ }
  }
  notes.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  return res.json({ notes });
}

async function handleAckNote(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireSessionRole(req, res, 'senior')) return;
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return res.status(503).json({ ok: false });

  const result = await upstashCmd(['HDEL', PENDING_NOTES_KEY, id]);
  if (!result || result.error) return res.status(500).json({ ok: false });
  return res.json({ ok: true });
}

// -- Empire AI Router ---------------------------------------------------------
// Priority: Gemini FREE (1M tokens/day, 1M ctx) -> OpenRouter free -> Groq

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

  // Empire key supports 2.5-flash - use it first
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

    if (res.ok) return { res, provider: 'gemini', model };
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
        'HTTP-Referer': 'https://care-ops-os.vercel.app',
        'X-Title': 'Care Ops',
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
  if (!setCors(req, res)) return res.status(403).json({ message: 'Origin is not allowed for intelligence analysis' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!requireSessionRole(req, res, 'senior')) return;

  const { text } = req.body || {};
  if (!text) return res.status(400).json({ message: 'No text provided' });

  try {
    const messages = [
      { role: 'system', content: INTEL_SYSTEM_PROMPT },
      { role: 'user', content: `Analyse this raw text and map it to the CQC structure:\n\n${text}` },
    ];

    // Gemini 2.5 Flash first — best at structured extraction from messy documents, 1M context
    // Groq fallback — json_object mode reliable but weaker extraction
    const TOKEN_LIMIT = 6000;
    const attempts = [
      async () => {
        const { res: gemRes, model } = await callGemini(messages, { stream: false, max_tokens: TOKEN_LIMIT });
        const data = await gemRes.json();
        return { raw: data.candidates?.[0]?.content?.parts?.[0]?.text, label: `Gemini ${model || ''}`.trim() };
      },
      async () => {
        const { res: groqRes, model } = await callGroq(messages, { response_format: { type: 'json_object' }, stream: false, max_tokens: TOKEN_LIMIT });
        const data = await groqRes.json();
        return { raw: data.choices?.[0]?.message?.content, label: `Groq ${model || ''}`.trim() };
      },
      async () => {
        const { res: orRes, model } = await callOpenRouter(messages, { stream: false, max_tokens: TOKEN_LIMIT });
        const data = await orRes.json();
        return { raw: data.choices?.[0]?.message?.content, label: `OpenRouter ${model || ''}`.trim() };
      },
    ];

    const errors = [];
    for (const attempt of attempts) {
      try {
        const { raw, label } = await attempt();
        const result = parseModelJson(raw, label);
        return res.status(200).json(result);
      } catch (providerError) {
        errors.push(providerError.message);
        console.warn('[analyze-intel] provider failed:', providerError.message);
      }
    }

    throw new Error(`All intelligence providers failed: ${errors.join(' | ')}`);
  } catch (error) {
    console.error('Intel Analysis Error:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
}

async function handleEnhanceNote(req, res) {
  if (!setCors(req, res)) return res.status(403).end();
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!requireSessionOrStaffAccess(req, res, 'notes', 'senior')) return;

  const { text, noteType, clientName, referenceTemplate, refineInstructions, previousOutput, clinicalContext, includeEvidenceTrail } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).send('No text provided');
  if (text.length > 24_000) return res.status(413).send('Input too large');

  const CTX_MAX = 80_000;
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
  const evidenceInstruction = includeEvidenceTrail
    ? `\n[EVIDENCE TRAIL REQUIREMENT]:\nAfter the completed note, append this section exactly:\nEvidence Trail:\n- Include 3 to 6 bullet points.\n- Each bullet must include a source label in brackets and a short quoted phrase copied from provided data.\n- Allowed labels: [RAW DATA], [CLINICAL CONTEXT], [PREVIOUS DRAFT], [SHIFT CONTEXT], [PREVIOUS SHIFT NOTE], [NEXT SHIFT NOTE], [DOCUMENT: filename].\n- Do not invent citations or source labels.\n`
    : '';

  const userPrompt = [
    noteType ? `Note type: ${noteType}` : '',
    clientName ? `Client/subject: ${clientName}` : '',
    safeContext ? `\n[ESSENTIAL CONTEXT - READ THIS AS YOUR STAFF KNOWLEDGE BEFORE WRITING]:\n${safeContext}\n` : '',
    safeTemplate ? `\n[MANDATORY LAYOUT - USE STRUCTURE ONLY, IGNORE ITS CONTENT]:\n${safeTemplate}\n` : '',
    safePrev ? `\n[PREVIOUS DRAFT]:\n${safePrev}\n` : '',
    refineInstructions ? `\n[REFINEMENT INSTRUCTION - PRIORITISE THIS]:\n${refineInstructions}\n` : '',
    '',
    'TASK:',
    refineInstructions
      ? 'Apply the refinement instruction to the previous draft while maintaining the layout of the template.'
      : 'Extract the facts from the [RAW DATA TO PROCESS] and map them into the structure of the [MANDATORY LAYOUT]. Do NOT use any facts from the template itself.',
    'Read [ESSENTIAL CONTEXT] before writing. Use it for care-plan strategy, roster identity, continuity, and conflict detection. Do not invent shift events from context.',
    'You must complete every template heading/time block. Return the full finished note, not a partial section.',
    evidenceInstruction,
    '',
    '[RAW DATA TO PROCESS - THIS IS WHAT HAPPENED ON SHIFT]:',
    text.trim(),
  ].filter((l) => l !== '').join('\n');

  const messages = [
    { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
  const opts = { stream: true, max_tokens: 4200, temperature: 0.45 };

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
            chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            chunk = parsed.choices?.[0]?.delta?.content || '';
          }
          if (chunk) res.write(chunk);
        } catch { /* skip malformed chunks */ }
      }
    }
  } catch (e) {
    const msg = e?.message || '';
    const friendly = msg.includes('unavailable') || msg.includes('rate') || msg.includes('limit') || msg.includes('saturated')
      ? 'AI models are at capacity - wait 30 seconds and try again.'
      : `Generation failed: ${msg}`;
    res.write(friendly);
  } finally {
    res.end();
  }
}

const GHOST_SYSTEM_PROMPT = `You are a senior support worker with 30 years of frontline and management experience in UK supported living. You are writing a shift note for a client you know well.

RULES:
- Write entirely in first-person as the support worker who was on shift
- Never mention that notes were missing, that this is a reconstruction, or that you are AI
- Do NOT invent clinical incidents, medication events, falls, or appointments unless evidenced in the context provided
- Base the note on the client's known routines, clinical profile, and notes from surrounding dates - reconstruct a typical day for this person
- The note must be CQC-compliant, professional, and indistinguishable from a genuine shift note written at the end of shift
- Use UK English, past tense, write as if the shift just ended and you are handing over
- Cover: mood and presentation on arrival, meals and hydration, activities and engagement, personal care (if relevant), any observations, handover status
- Match the structure and format of the template provided - use its headings and sections exactly
- Write with concrete operational detail in each section: what happened, staff response, client response, and outcome.
- Avoid generic filler such as "support provided throughout shift" unless you also specify what support.
- Minimum depth target: 350+ words unless source evidence is genuinely sparse.
- Weave in relevant care plan/PBS/risk strategies naturally where appropriate (without copying policy text).`;

// ─────────────────────────────────────────────────────────────────────────────
// REFINE TASKS — returns { [taskId]: updatedNotes } for changed tasks only
// ─────────────────────────────────────────────────────────────────────────────

const REFINE_TASKS_SYSTEM_PROMPT = `You are a UK supported-living care documentation specialist reviewing Nourish task notes.

You will receive a JSON array of tasks and a refinement instruction from a care coordinator.

Your job: apply the instruction and return ONLY the tasks whose notes have changed.

OUTPUT FORMAT: A JSON object where:
- Keys are task IDs exactly as provided
- Values are the complete updated task notes (preserve Purpose / Staff action / Watch for / Record / Avoid structure)

RULES:
1. Only return tasks that actually need changing based on the instruction
2. Preserve the note structure: Purpose, Staff action, Watch for, Source cues (if present), Record, Avoid
3. UK English only — summarise, recognise, behaviour, practise
4. Keep notes concise enough for frontline staff to use on shift
5. Never invent clinical events or care-plan details not in the original
6. Output valid JSON only. No preamble, no explanation, no markdown fences.`;

async function handleRefineTasks(req, res) {
  if (!setCors(req, res)) return res.status(403).end();
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireSessionRole(req, res, 'senior')) return;

  const { tasks, instruction, clientName } = req.body || {};
  if (!instruction || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'tasks array and instruction required' });
  }
  if (tasks.length > 60) return res.status(400).json({ error: 'Too many tasks (max 60)' });

  const slim = tasks.map(t => ({ id: t.id, name: t.name, notes: t.notes, frequency: t.frequency }));

  const userPrompt = [
    clientName ? `Client: ${clientName}` : '',
    `Instruction: ${instruction}`,
    '',
    'Tasks:',
    JSON.stringify(slim, null, 2),
  ].filter(Boolean).join('\n');

  const messages = [
    { role: 'system', content: REFINE_TASKS_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  try {
    let rawContent;

    // Groq preferred — supports json_object mode reliably
    try {
      const { res: groqRes } = await callGroq(messages, {
        response_format: { type: 'json_object' },
        stream: false,
        max_tokens: 4000,
      });
      const data = await groqRes.json();
      rawContent = data.choices?.[0]?.message?.content;
    } catch {
      // Fallback: OpenRouter → Gemini
      try {
        const { res: orRes } = await callOpenRouter(messages, { stream: false, max_tokens: 4000 });
        const data = await orRes.json();
        rawContent = data.choices?.[0]?.message?.content;
      } catch {
        const { res: gemRes } = await callGemini(messages, { stream: false, max_tokens: 4000 });
        const data = await gemRes.json();
        rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      }
    }

    const jsonMatch = (rawContent || '').match(/\{[\s\S]*\}/);
    const updates = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent || '{}');

    // Sanitise: only accept string values for known task IDs
    const validIds = new Set(tasks.map(t => t.id));
    const sanitized = {};
    for (const [id, notes] of Object.entries(updates)) {
      if (validIds.has(id) && typeof notes === 'string' && notes.trim()) {
        sanitized[id] = notes.trim();
      }
    }

    return res.status(200).json(sanitized);
  } catch (error) {
    console.error('[refine-tasks] error:', error);
    return res.status(500).json({ error: error.message || 'Refinement failed' });
  }
}

async function handleGhostWrite(req, res) {
  if (!setCors(req, res)) return res.status(403).end();
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (!requireSessionRole(req, res, 'senior')) return;

  const { date, clientName, prevNote, nextNote, referenceTemplate, clinicalContext, shiftContext, includeEvidenceTrail } = req.body || {};
  if (!date || !clientName) return res.status(400).send('date and clientName required');

  const CTX_MAX = 60_000;
  const TPL_MAX = 6_000;
  const NOTE_MAX = 6_000;

  const safeContext = clinicalContext ? clinicalContext.slice(0, CTX_MAX) : '';
  const safeTemplate = referenceTemplate ? referenceTemplate.slice(0, TPL_MAX) : '';
  const safePrev = prevNote ? prevNote.slice(0, NOTE_MAX) : '';
  const safeNext = nextNote ? nextNote.slice(0, NOTE_MAX) : '';
  const safeShiftCtx = shiftContext ? shiftContext.slice(0, 2000) : '';
  const evidenceInstruction = includeEvidenceTrail
    ? `\nEVIDENCE TRAIL REQUIREMENT:\nAfter the note, append:\nEvidence Trail:\n- Provide 3 to 6 bullets.\n- Each bullet must include a source label and a short quoted phrase from supplied notes/context.\n- Allowed source labels: [SHIFT CONTEXT], [PREVIOUS SHIFT NOTE], [NEXT SHIFT NOTE], [CLINICAL CONTEXT], [DOCUMENT: filename], [RAW DATA].\n- No invented citations.\n`
    : '';

  let dayLabel = '';
  try {
    const parts = date.split('/');
    if (parts.length === 3) {
      const d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
      dayLabel = d.toLocaleDateString('en-GB', { weekday: 'long' });
    }
  } catch { /* ignore */ }

  const userPrompt = [
    `CLIENT: ${clientName}`,
    `DATE: ${date}${dayLabel ? ` (${dayLabel})` : ''}`,
    '',
    safeShiftCtx ? `[SPECIFIC SHIFT CONTEXT - follow these shift-specific details exactly]:\n${safeShiftCtx}` : '',
    '',
    safePrev ? `[PREVIOUS SHIFT NOTE - evidence of what preceded this day]:\n${safePrev}` : '[PREVIOUS SHIFT NOTE]: Not available',
    '',
    safeNext ? `[NEXT SHIFT NOTE - evidence of what followed this day]:\n${safeNext}` : '[NEXT SHIFT NOTE]: Not available',
    '',
    safeContext ? `[INTELLIGENCE PROFILE & KNOWLEDGE BASE]:\n${safeContext}` : '',
    '',
    safeTemplate ? `[NOTE STRUCTURE TO FOLLOW - use these headings and sections exactly]:\n${safeTemplate}` : '',
    '',
    `TASK: Write a complete, professional shift note for ${clientName} on ${date}. Use the surrounding notes and intelligence knowledge, and any shift context provided to reconstruct the support provided. Write as the support worker on shift.`,
    `QUALITY BAR: Include clear specifics for each section (what happened, intervention, client response, end status). Avoid vague one-line summaries.`,
    evidenceInstruction,
  ].filter(l => l !== undefined).join('\n');

  const messages = [
    { role: 'system', content: GHOST_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
  const opts = { stream: true, max_tokens: 4200, temperature: 0.45 };

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
            chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            chunk = parsed.choices?.[0]?.delta?.content || '';
          }
          if (chunk) res.write(chunk);
        } catch { /* skip malformed chunks */ }
      }
    }
  } catch (e) {
    const msg = e?.message || '';
    const friendly = msg.includes('unavailable') || msg.includes('rate') || msg.includes('limit') || msg.includes('saturated')
      ? 'AI models are at capacity - wait 30 seconds and try again.'
      : `Generation failed: ${msg}`;
    res.write(friendly);
  } finally {
    res.end();
  }
}
