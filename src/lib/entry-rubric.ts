/**
 * entry-rubric.ts
 * ─────────────────────────────────────────────────────────────────
 * Module-based quality scoring per entry type.
 *
 * Built from two real Hazel Care templates:
 *   • Core Staff Daily Note (House-level, Environmental, Overview)
 *   • 1:1 Support Note (Client-level, Specific Engagement, Refusals)
 */
import type { CareEntry } from './types';

export interface RubricModule {
  name: string;
  score: number; // 0-100
  missing: string[];
}

export interface EntryScore {
  total: number;
  modules: RubricModule[];
}

function normalizeEntry(entry: string): string {
  return entry.toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

/** 
 * Determines if a note is a Core (House) note or a 1:1 (Client) note.
 * Based on CarePlanner formatting where 1:1s are client-specific handovers.
 */
function determineNoteType(entry: CareEntry): 'core' | '1to1' {
  const e = (entry.entry || '').toLowerCase();
  const c = (entry.client || '').toLowerCase().trim();
  const t = (entry.category || '').toLowerCase();

  // 1. Explicit Category Override
  // Staff notes, handovers, and health/safety are always House/Core level.
  if (t === 'staff' || t === 'handover' || t === 'health_safety' || t === 'finance') {
    return 'core';
  }

  // 2. Client-based detection
  // Any variation of "Unassigned" or a missing client implies a House note.
  const isUnassigned = c.includes('unassigned') || c === '' || c === 'general' || c === 'house';
  
  if (isUnassigned || e.includes('core staff') || e.includes('communal') || e.includes('kitchen, lounge')) {
    return 'core';
  }

  return '1to1';
}

export function scoreEntry(entry: CareEntry): EntryScore {
  const e = normalizeEntry(entry.entry || '');
  const noteType = determineNoteType(entry);
  
  const modules: RubricModule[] = [];

  if (noteType === 'core') {
    // ── CORE STAFF DAILY NOTE RUBRIC ──
    
    // 1. Environmental & Safety (Critical for Core)
    const envTerms = ['clean', 'hazard', 'communal', 'kitchen', 'lounge', 'safe', 'check', 'environment', 'property', 'maintain'];
    const envHits = envTerms.filter(t => e.includes(t)).length;
    let envScore = 0;
    const envMissing: string[] = [];
    if (envHits >= 3) envScore = 100;
    else if (envHits > 0) { envScore = 50; envMissing.push('Add specific rooms checked (e.g. kitchen, lounge)'); }
    else { envScore = 0; envMissing.push('No environmental/safety checks documented for the house'); }
    modules.push({ name: 'Environmental Safety', score: envScore, missing: envMissing });

    // 2. Resident Overview (Must mention multiple or "all")
    const resTerms = ['resident', 'tenant', 'supported', 'monitored', 'presentation', 'room'];
    const resHits = resTerms.filter(t => e.includes(t)).length;
    let resScore = 0;
    const resMissing: string[] = [];
    if (resHits >= 3) resScore = 100;
    else if (resHits > 0) { resScore = 50; resMissing.push('Expand on presentation of residents in communal areas'); }
    else { resScore = 0; resMissing.push('No resident welfare overview documented'); }
    modules.push({ name: 'Resident Welfare Overview', score: resScore, missing: resMissing });

    // 3. Safeguarding & Incidents (Must explicitly state if none)
    const sgTerms = ['incident', 'safeguard', 'conflict', 'aggression', 'self-harm', 'substance', 'no concern', 'stable'];
    const sgHits = sgTerms.filter(t => e.includes(t)).length;
    let sgScore = 0;
    const sgMissing: string[] = [];
    if (sgHits >= 2) sgScore = 100;
    else if (sgHits > 0) { sgScore = 50; sgMissing.push('Explicitly state "no safeguarding concerns" if none occurred'); }
    else { sgScore = 0; sgMissing.push('Missing safeguarding/incident overview'); }
    modules.push({ name: 'Safeguarding Overview', score: sgScore, missing: sgMissing });

  } else {
    // ── 1:1 SUPPORT NOTE RUBRIC ──

    // 1. First-Person Voice & Engagement
    const fpCount = [' i ', ' my ', ' we ', 'me '].filter(t => ` ${e} `.includes(t)).length;
    const tpCount = ['staff', 'carer', 'support worker'].filter(t => ` ${e} `.includes(t)).length;
    let fpScore = 0;
    const fpMissing: string[] = [];
    if (fpCount > 0 && tpCount === 0) fpScore = 100;
    else if (fpCount > 0 && tpCount > 0) { fpScore = 50; fpMissing.push('Mixed perspective — use "I" instead of "staff"'); }
    else { fpScore = 0; fpMissing.push('Written in third person ("staff supported") instead of first person ("I supported")'); }
    modules.push({ name: 'Voice & Accountability', score: fpScore, missing: fpMissing });

    // 2. Specific Support Tasks
    const taskTerms = ['personal care', 'medication', 'nutrition', 'meal', 'fluid', 'shower', 'dress', 'prompt', 'hygiene', 'activity'];
    const taskHits = taskTerms.filter(t => e.includes(t)).length;
    let taskScore = 0;
    const taskMissing: string[] = [];
    if (taskHits >= 3) taskScore = 100;
    else if (taskHits > 0) { taskScore = 50; taskMissing.push('Expand on specific tasks supported (e.g. personal care, meals)'); }
    else { taskScore = 0; taskMissing.push('No specific support tasks detailed'); }
    modules.push({ name: 'Support Tasks', score: taskScore, missing: taskMissing });

    // 3. Presentation & Outcomes
    const moodTerms = ['mood', 'calm', 'settled', 'anxious', 'agitated', 'engaged', 'refused', 'declined', 'outcome', 'stable'];
    const moodHits = moodTerms.filter(t => e.includes(t)).length;
    let moodScore = 0;
    const moodMissing: string[] = [];
    if (moodHits >= 2) moodScore = 100;
    else if (moodHits > 0) { moodScore = 50; moodMissing.push('Add detail on how they responded to support/prompts'); }
    else { moodScore = 0; moodMissing.push('Missing presentation or outcome (e.g. mood, engagement, refusals)'); }
    modules.push({ name: 'Presentation & Outcomes', score: moodScore, missing: moodMissing });
  }

  // Calculate total score
  const total = Math.round(modules.reduce((sum, mod) => sum + mod.score, 0) / Math.max(1, modules.length));
  return { total, modules };
}

export function getTopGaps(entries: CareEntry[]): string[] {
  const gaps = new Map<string, number>();
  for (const entry of entries) {
    const score = scoreEntry(entry);
    for (const mod of score.modules) {
      for (const gap of mod.missing) gaps.set(gap, (gaps.get(gap) || 0) + 1);
    }
  }
  return [...gaps.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([msg, count]) => (count > 1 ? `${msg} (×${count})` : msg));
}