import { parseCookies } from './_lib/parse-cookies.js';
import { HC_SESSION_COOKIE, verifyHcSession } from './_lib/hc-session.js';

const ALLOWED_ORIGINS = (process.env.AUTH_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || '';

const CARE_PLAN_DOMAINS = [
  'Environment & Physical Safety', 'Respiratory Health & Support', 'Communication & Sensory Integration',
  'Social Engagement & Relationships', 'Life Skills & Daily Routine', 'Nutrition, Hydration & Diet',
  'Continence & Personal Hygiene', 'Adaptive Living Environment', 'Rights, Choice & Inclusion',
  'Intimacy & Personal Expression', 'Financial Management & Autonomy', 'Holistic Health & Vitality',
  'Infection Control & Public Health', 'Medication Management & Safety', 'Mental Health & Emotional Wellbeing',
  'Mobility, Movement & Exercise', 'Pain Management & Comfort', 'Personal Care & Physical Presentation',
  'Skin Integrity & Pressure Care', 'Rest & Sleep Patterns', 'Cultural, Spiritual & Personal Beliefs'
];

const SYSTEM_PROMPT = `You are a Clinical Intelligence Specialist for a premium UK supported living provider. Your job is to extract highly structured clinical data from raw, unstructured text (social worker reports, hospital discharge notes, or old care plans).

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this raw clinical text and map it to the CQC structure:\n\n${text}` },
        ],
        temperature: 0.1, // Low temperature for precise mapping
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
