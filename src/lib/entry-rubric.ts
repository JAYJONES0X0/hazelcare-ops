/**
 * entry-rubric.ts
 * ─────────────────────────────────────────────────────────────────
 * Module-based quality scoring per entry type.
 *
 * Built from two real Hazel Care templates:
 *   • Core Staff Daily Note (handover)
 *   • 1:1 Support Note format (daily_support)
 *
 * Each entry gets a score 0–100 broken into modules with weights.
 * Negative delta deductions applied where risk is present but no response documented.
 */

import type { CareEntry, Category } from './types';

// ── Module result ────────────────────────────────────────────────

export interface ModuleScore {
  name: string;
  score: number;      // 0–100 for this module
  weight: number;     // fraction 0–1, weights sum to 1
  missing: string[];  // what was absent that would improve the score
}

export interface EntryScore {
  total: number;          // 0–100 weighted composite
  modules: ModuleScore[];
  flags: string[];        // specific quality flags (e.g. "No medication outcome documented")
  negativeDelta: number;  // penalty applied (-ve number)
}

// ── Keyword helpers ──────────────────────────────────────────────

function has(text: string, ...words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function countMatches(text: string, words: string[]): number {
  return words.filter((w) => text.includes(w)).length;
}

function present(text: string, words: string[]): string[] {
  return words.filter((w) => text.includes(w));
}

function absent(text: string, words: string[]): string[] {
  return words.filter((w) => !text.includes(w));
}

// ── Length bonus ─────────────────────────────────────────────────

function lengthBonus(text: string, floor = 80, ideal = 300): number {
  const len = text.length;
  if (len >= ideal) return 100;
  if (len < floor) return 0;
  return Math.round(((len - floor) / (ideal - floor)) * 100);
}

// ── HANDOVER rubric ──────────────────────────────────────────────
// Based on: Core Staff Daily Note (Laurel House template)
// Sections: Environmental checks, Resident welfare by name, Risk overview, Handover summary

const ENV_KEYWORDS = ['clean', 'cleaning', 'hazard', 'safe', 'safety', 'kitchen', 'lounge', 'communal', 'surface', 'swept', 'mopped', 'tidy', 'environmental', 'checked', 'maintained', 'hygiene'];
const WELFARE_KEYWORDS = ['settled', 'calm', 'agitated', 'presentation', 'distress', 'monitored', 'welfare', 'observation', 'observed', 'vocalisation', 'engagement', 'mood', 'appeared', 'noted', 'remained'];
const RISK_KEYWORDS = ['risk', 'safeguarding', 'escalation', 'incident', 'self-harm', 'substance', 'behaviour', 'monitoring', 'known risk', 'care plan', 'concern', 'flagged'];
const RESPONSE_KEYWORDS = ['reassurance', 'reassured', 'de-escalation', 'de-escalated', 'prompted', 'reminded', 'redirected', 'informed', 'reported', 'supported', 'intervened'];
const HANDOVER_SUMMARY_KEYWORDS = ['continue', 'monitor', 'handover', 'following shift', 'next shift', 'no concerns', 'no incidents', 'no safeguarding'];

function scoreHandover(text: string): EntryScore {
  const t = text.toLowerCase();
  const flags: string[] = [];
  let negativeDelta = 0;

  // Module 1: Environmental Safety (25%)
  const envHits = countMatches(t, ENV_KEYWORDS);
  const envScore = Math.min(100, envHits * 20);
  const envMissing: string[] = [];
  if (envHits === 0) envMissing.push('No environmental/safety checks documented');
  else if (envHits < 3) envMissing.push('Limited environmental detail — add specific areas checked');

  // Module 2: Resident Welfare & Presentation (35%)
  const welfareHits = countMatches(t, WELFARE_KEYWORDS);
  const hasResidentNames = /[A-Z][a-z]+ (was|remained|appeared|is )/.test(text);
  let welfareScore = Math.min(100, welfareHits * 15 + (hasResidentNames ? 20 : 0));
  const welfareMissing: string[] = [];
  if (!hasResidentNames) {
    welfareMissing.push('No individual resident observations — name each person');
    welfareScore = Math.max(0, welfareScore - 20);
  }
  if (welfareHits < 2) welfareMissing.push('Little presentation detail documented');

  // Module 3: Risk Management (25%)
  const riskHits = countMatches(t, RISK_KEYWORDS);
  const responseHits = countMatches(t, RESPONSE_KEYWORDS);
  let riskScore = Math.min(100, riskHits * 20 + responseHits * 10);
  const riskMissing: string[] = [];

  // Negative delta: risk flagged but no response documented
  if (riskHits > 0 && responseHits === 0) {
    flags.push('Risk indicators present but no staff response documented');
    negativeDelta -= 15;
    riskScore = Math.max(0, riskScore - 20);
    riskMissing.push('Document what action was taken in response to identified risks');
  }
  if (has(t, 'agitated', 'distressed', 'escalation') && !has(t, 'reassurance', 'reassured', 'de-escalat', 'prompted')) {
    flags.push('Behavioural concern documented without de-escalation response');
    negativeDelta -= 10;
  }

  // Module 4: Handover Summary (15%)
  const summaryHits = countMatches(t, HANDOVER_SUMMARY_KEYWORDS);
  const summaryScore = Math.min(100, summaryHits * 30);
  const summaryMissing: string[] = [];
  if (summaryHits === 0) summaryMissing.push('No handover summary — add continuation notes for next shift');

  const modules: ModuleScore[] = [
    { name: 'Environmental Safety', score: envScore, weight: 0.25, missing: envMissing },
    { name: 'Resident Welfare', score: welfareScore, weight: 0.35, missing: welfareMissing },
    { name: 'Risk Management', score: riskScore, weight: 0.25, missing: riskMissing },
    { name: 'Handover Summary', score: summaryScore, weight: 0.15, missing: summaryMissing },
  ];

  const weighted = modules.reduce((sum, m) => sum + m.score * m.weight, 0);
  const total = Math.max(0, Math.min(100, Math.round(weighted + negativeDelta)));

  return { total, modules, flags, negativeDelta };
}

// ── 1:1 SUPPORT NOTE rubric ──────────────────────────────────────
// Based on: 1:1 Support Note format template

const PERSONAL_CARE_KEYWORDS = ['shower', 'bath', 'oral hygiene', 'teeth', 'dressing', 'personal care', 'hygiene', 'washing', 'shaving', 'appearance', 'grooming', 'prompted', 'support with'];
const MEDICATION_KEYWORDS = ['medication', 'meds', 'tablet', 'dose', 'mar', 'prescribed', 'administered', 'prompted', 'declined', 'refused medication'];
const MEDICATION_OUTCOME_KEYWORDS = ['administered', 'taken', 'refused', 'declined', 'accepted', 'prompted and took', 'unable to administer'];
const NUTRITION_KEYWORDS = ['meal', 'breakfast', 'lunch', 'dinner', 'snack', 'food', 'hydration', 'fluid', 'drink', 'squash', 'water', 'cooking', 'prepared', 'ate', 'consumed', 'appetite'];
const ENVIRONMENT_KEYWORDS = ['cleaning', 'laundry', 'kitchen', 'room', 'tidy', 'hoover', 'vacuum', 'safety check', 'hazard', 'environment', 'swept', 'bin', 'dishes'];
const WELLBEING_KEYWORDS = ['calm', 'settled', 'mood', 'presentation', 'engaged', 'engagement', 'distress', 'response', 'reassurance', 'mental', 'behavioural', 'withdrawal', 'observation', 'appeared', 'seemed'];
const FIRST_PERSON_KEYWORDS = ['i supported', 'i prompted', 'i encouraged', 'i assisted', 'i provided', 'i completed', 'i observed', 'i monitored', 'i offered', 'i reminded', 'i helped'];

function scoreOneToOne(text: string): EntryScore {
  const t = text.toLowerCase();
  const flags: string[] = [];
  let negativeDelta = 0;

  // Module 1: Medication (30%)
  const medMentioned = has(t, ...MEDICATION_KEYWORDS);
  const medOutcome = has(t, ...MEDICATION_OUTCOME_KEYWORDS);
  let medScore = 0;
  const medMissing: string[] = [];
  if (!medMentioned) {
    medScore = 60; // not every 1:1 covers medication — don't penalise absence
    medMissing.push('No medication reference — add if medication was due');
  } else {
    medScore = 70;
    if (medOutcome) {
      medScore = 100;
    } else {
      flags.push('Medication mentioned but outcome not documented (administered/declined/prompted)');
      negativeDelta -= 10;
      medMissing.push('Document whether medication was taken, refused, or prompting given');
    }
  }

  // Module 2: Personal Care (20%)
  const careHits = countMatches(t, PERSONAL_CARE_KEYWORDS);
  const careScore = Math.min(100, careHits * 20);
  const careMissing: string[] = [];
  if (careHits === 0) careMissing.push('No personal care documentation — include prompting/support offered');
  else if (careHits < 2) careMissing.push('Brief personal care detail — expand on level of support given');

  // Module 3: Nutrition (15%)
  const nutHits = countMatches(t, NUTRITION_KEYWORDS);
  const nutScore = Math.min(100, nutHits * 20);
  const nutMissing: string[] = [];
  if (nutHits === 0) nutMissing.push('No nutrition/hydration documented');

  // Module 4: Environment (15%)
  const envHits = countMatches(t, ENVIRONMENT_KEYWORDS);
  const envScore = Math.min(100, envHits * 25);
  const envMissing: string[] = [];
  if (envHits === 0) envMissing.push('No environmental tasks documented');

  // Module 5: Wellbeing & Presentation (20%)
  const wbHits = countMatches(t, WELLBEING_KEYWORDS);
  const fpHits = countMatches(t, FIRST_PERSON_KEYWORDS);
  let wbScore = Math.min(100, wbHits * 15 + fpHits * 10);
  const wbMissing: string[] = [];
  if (fpHits === 0) {
    wbMissing.push('Write in first person: "I supported..." rather than "Staff supported..."');
    wbScore = Math.max(0, wbScore - 15);
  }
  if (wbHits === 0) wbMissing.push("No wellbeing/presentation observations — document client's mood and response");

  // Negative delta: refusal with no documentation
  if (has(t, 'refused', 'declined', 'refusal') && !has(t, 'documented', 'noted', 'advised', 'explained', 'risks explained', 'understood')) {
    flags.push('Refusal documented without explanation given to client or risk recorded');
    negativeDelta -= 8;
  }

  const modules: ModuleScore[] = [
    { name: 'Medication', score: medScore, weight: 0.30, missing: medMissing },
    { name: 'Personal Care', score: careScore, weight: 0.20, missing: careMissing },
    { name: 'Nutrition', score: nutScore, weight: 0.15, missing: nutMissing },
    { name: 'Environment', score: envScore, weight: 0.15, missing: envMissing },
    { name: 'Wellbeing & Presentation', score: wbScore, weight: 0.20, missing: wbMissing },
  ];

  const weighted = modules.reduce((sum, m) => sum + m.score * m.weight, 0);
  const total = Math.max(0, Math.min(100, Math.round(weighted + negativeDelta)));

  return { total, modules, flags, negativeDelta };
}

// ── INCIDENT rubric ──────────────────────────────────────────────

const INCIDENT_WHAT_KEYWORDS = ['fall', 'fell', 'struck', 'injury', 'aggress', 'altercation', 'found', 'discovered', 'reported', 'occurred', 'happened'];
const INCIDENT_RESPONSE_KEYWORDS = ['called', 'contacted', 'informed', 'notified', 'applied', 'administered', 'attended', 'assisted', 'supported', '999', 'ambulance', 'paramedic'];
const INCIDENT_OUTCOME_KEYWORDS = ['no injury', 'minor injury', 'hospital', 'gp', 'doctor', 'reviewed', 'recovered', 'stable', 'ongoing', 'monitoring'];

function scoreIncident(text: string): EntryScore {
  const t = text.toLowerCase();
  const flags: string[] = [];
  let negativeDelta = 0;

  const whatHits = countMatches(t, INCIDENT_WHAT_KEYWORDS);
  const responseHits = countMatches(t, INCIDENT_RESPONSE_KEYWORDS);
  const outcomeHits = countMatches(t, INCIDENT_OUTCOME_KEYWORDS);

  // Description (35%)
  const descScore = Math.min(100, whatHits * 25 + lengthBonus(text, 50, 200) * 0.3);
  // Immediate response (30%)
  let respScore = Math.min(100, responseHits * 30);
  // Outcome (20%)
  const outcomeScore = Math.min(100, outcomeHits * 40);
  // Notification/escalation (15%)
  const notified = has(t, 'manager', 'coordinator', 'family', 'gp', 'on call', 'supervisor', 'informed');
  const notifyScore = notified ? 100 : 0;

  if (responseHits === 0) {
    flags.push('No immediate response actions documented in incident note');
    negativeDelta -= 15;
    respScore = 0;
  }
  if (!notified) flags.push('No notification of manager/coordinator/family documented');

  void absent; void present; // suppress unused warnings

  const modules: ModuleScore[] = [
    { name: 'Description', score: Math.round(descScore), weight: 0.35, missing: whatHits === 0 ? ['Document what happened, who was involved, and where'] : [] },
    { name: 'Immediate Response', score: respScore, weight: 0.30, missing: responseHits === 0 ? ['Document actions taken immediately after the incident'] : [] },
    { name: 'Outcome', score: outcomeScore, weight: 0.20, missing: outcomeHits === 0 ? ['Document current status and any injuries/medical review'] : [] },
    { name: 'Notification', score: notifyScore, weight: 0.15, missing: !notified ? ['Record who was notified (manager, family, GP)'] : [] },
  ];

  const weighted = modules.reduce((sum, m) => sum + m.score * m.weight, 0);
  const total = Math.max(0, Math.min(100, Math.round(weighted + negativeDelta)));

  return { total, modules, flags, negativeDelta };
}

// ── MEDICATION rubric ────────────────────────────────────────────

function scoreMedication(text: string): EntryScore {
  const t = text.toLowerCase();
  const flags: string[] = [];
  let negativeDelta = 0;

  const hasOutcome = has(t, 'administered', 'given', 'taken', 'refused', 'declined', 'unable', 'withheld');
  const hasMed = has(t, 'medication', 'tablet', 'dose', 'mar', 'prescribed', 'medication administered');
  const hasDoc = has(t, 'mar', 'signed', 'recorded', 'documented', 'witnessed');
  const hasClient = has(t, 'refused', 'declined') ? has(t, 'explained', 'understood', 'risk', 'noted', 'documented') : true;

  let score = 40;
  if (hasMed) score += 20;
  if (hasOutcome) score += 25;
  if (hasDoc) score += 15;
  if (!hasOutcome) {
    flags.push('No medication outcome documented (administered/refused/declined)');
    negativeDelta -= 15;
  }
  if (!hasClient) {
    flags.push('Medication refusal documented without risk explanation or consent note');
    negativeDelta -= 10;
  }

  const modules: ModuleScore[] = [
    {
      name: 'Medication Administration',
      score: Math.min(100, score),
      weight: 1.0,
      missing: [
        ...(!hasMed ? ['Name the specific medication'] : []),
        ...(!hasOutcome ? ['State outcome: administered/refused/declined'] : []),
        ...(!hasDoc ? ['Note MAR chart signing or witness'] : []),
      ],
    },
  ];

  const total = Math.max(0, Math.min(100, score + negativeDelta));
  return { total, modules, flags, negativeDelta };
}

// ── GENERIC (length + keyword richness) ─────────────────────────

function scoreGeneric(text: string): EntryScore {
  const len = text.length;
  let score = 50;
  if (len >= 200) score = 80;
  else if (len >= 100) score = 65;
  else if (len >= 50) score = 50;
  else score = 20;

  // First-person bonus
  if (/\bI (supported|prompted|observed|assisted|provided|completed)\b/i.test(text)) score += 10;

  const modules: ModuleScore[] = [
    {
      name: 'Documentation Quality',
      score: Math.min(100, score),
      weight: 1.0,
      missing: len < 80 ? ['Entry is too short — expand with context and client response'] : [],
    },
  ];

  return { total: Math.min(100, score), modules, flags: [], negativeDelta: 0 };
}

// ── Public API ───────────────────────────────────────────────────

export function scoreEntry(entry: CareEntry): EntryScore {
  const text = (entry.entry || '').trim();
  if (!text) return { total: 0, modules: [], flags: ['Empty entry'], negativeDelta: 0 };

  const cat: Category = entry.category || 'other';

  switch (cat) {
    case 'handover':
      return scoreHandover(text);
    case 'daily_support':
      return scoreOneToOne(text);
    case 'incident':
      return scoreIncident(text);
    case 'medication':
      return scoreMedication(text);
    default:
      return scoreGeneric(text);
  }
}

/** Returns a single quality score (0–100) for display */
export function entryQualityScore(entry: CareEntry): number {
  return scoreEntry(entry).total;
}

/** Summarise what is missing across a set of entries for one carer */
export function aggregateModuleGaps(entries: CareEntry[]): string[] {
  const gaps = new Map<string, number>();
  for (const e of entries) {
    const result = scoreEntry(e);
    for (const m of result.modules) {
      for (const gap of m.missing) {
        gaps.set(gap, (gaps.get(gap) || 0) + 1);
      }
    }
    for (const f of result.flags) {
      gaps.set(f, (gaps.get(f) || 0) + 1);
    }
  }
  // Sort by frequency, return top gaps
  return [...gaps.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([msg, count]) => (count > 1 ? `${msg} (×${count})` : msg));
}
