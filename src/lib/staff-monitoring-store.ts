import { uid } from './storage';
import type { EscalationItem } from './staff-monitoring';

/** Swallows QuotaExceededError silently — monitoring history is non-critical */
function safeset(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch { /* quota exceeded — skip write */ }
}

const KEY = 'hc-staff-monitoring-runs-v1';
const OUTCOMES_KEY = 'hc-staff-monitoring-outcomes-v1';
const COACHING_EVENTS_KEY = 'hc-coaching-events-v1';
const MODULE_HISTORY_KEY = 'hc-module-history-v1';
const ACTIVE_TRACKING_KEY = 'hc-active-tracking-v1';

// ── Coaching Pipeline (Active 24hr Monitoring) ────────────────

export interface ActiveTrackingRecord {
  carer: string;
  coachedAt: string;        // ISO
  monitoringUntil: string;  // ISO
}

export function loadActiveTracking(): ActiveTrackingRecord[] {
  try {
    const raw = localStorage.getItem(ACTIVE_TRACKING_KEY);
    const parsed = raw ? (JSON.parse(raw) as ActiveTrackingRecord[]) : [];
    // Prune expired records automatically on load
    const now = Date.now();
    const active = parsed.filter(p => new Date(p.monitoringUntil).getTime() > now);
    if (active.length !== parsed.length) {
      safeset(ACTIVE_TRACKING_KEY, JSON.stringify(active));
    }
    return active;
  } catch { return []; }
}

export function logCoachingAction(carer: string): void {
  const prev = loadActiveTracking().filter(r => r.carer !== carer);
  const now = new Date();
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  const rec: ActiveTrackingRecord = { carer, coachedAt: now.toISOString(), monitoringUntil: until.toISOString() };
  safeset(ACTIVE_TRACKING_KEY, JSON.stringify([rec, ...prev]));
}

export function removeActiveTracking(carer: string): void {
  const prev = loadActiveTracking().filter(r => r.carer !== carer);
  safeset(ACTIVE_TRACKING_KEY, JSON.stringify(prev));
}

// ── Coaching event (gap flag per carer per save) ──────────────────

export interface CoachingEvent {
  id: string;
  at: string;          // ISO
  carer: string;
  gaps: string[];      // gap strings from topGaps
}

// ── Module score snapshot per carer per save ──────────────────────

export interface ModuleHistoryRecord {
  id: string;
  at: string;
  carer: string;
  modules: { name: string; score: number }[];
  overallScore: number;
}

export interface MonitoringRunRecord {
  id: string;
  at: string;
  snapshotSummary: string;
  escalationCount: number;
}

export interface CallOutcomeRecord {
  id: string;
  escalationId: string;
  carer: string;
  at: string;
  outcome: 'reached' | 'voicemail' | 'refused' | 'callback' | 'resolved';
  notes: string;
}

export function loadMonitoringRuns(): MonitoringRunRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function saveMonitoringRun(summary: string, escalationCount: number): MonitoringRunRecord {
  const rec: MonitoringRunRecord = {
    id: uid(),
    at: new Date().toISOString(),
    snapshotSummary: summary,
    escalationCount,
  };
  const prev = loadMonitoringRuns();
  safeset(KEY, JSON.stringify([rec, ...prev].slice(0, 50)));
  return rec;
}

export function loadCallOutcomes(): CallOutcomeRecord[] {
  try {
    const raw = localStorage.getItem(OUTCOMES_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function saveCallOutcome(
  esc: EscalationItem,
  outcome: CallOutcomeRecord['outcome'],
  notes: string,
): CallOutcomeRecord {
  const rec: CallOutcomeRecord = {
    id: uid(),
    escalationId: esc.id,
    carer: esc.carer,
    at: new Date().toISOString(),
    outcome,
    notes,
  };
  const prev = loadCallOutcomes();
  safeset(OUTCOMES_KEY, JSON.stringify([rec, ...prev].slice(0, 200)));
  return rec;
}

export function lastHourlyCheckAt(): number | null {
  try {
    const raw = localStorage.getItem('hc-staff-monitoring-hourly-v1');
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function touchHourlyCheck(): void {
  safeset('hc-staff-monitoring-hourly-v1', String(Date.now()));
}

// ── Coaching event log ────────────────────────────────────────────

export function loadCoachingEvents(): CoachingEvent[] {
  try {
    const raw = localStorage.getItem(COACHING_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as CoachingEvent[]) : [];
  } catch { return []; }
}

/** Record which gaps were flagged for each carer in this monitoring run */
export function recordCoachingEvents(staff: { carer: string; topGaps: string[] }[]): void {
  const now = new Date().toISOString();
  const newEvents: CoachingEvent[] = staff
    .filter((s) => s.topGaps.length > 0)
    .map((s) => ({ id: uid(), at: now, carer: s.carer, gaps: s.topGaps }));
  if (newEvents.length === 0) return;
  const prev = loadCoachingEvents();
  // Keep 90 days
  const cutoff = Date.now() - 90 * 86400000;
  const pruned = prev.filter((e) => new Date(e.at).getTime() > cutoff);
  safeset(COACHING_EVENTS_KEY, JSON.stringify([...newEvents, ...pruned].slice(0, 1000)));
}

export interface RepeatTarget {
  carer: string;
  gap: string;
  count: number;   // times flagged in last 7 days
  firstSeen: string;
}

/** Returns staff who have the same gap flagged 3+ times in 7 days → Critical Training Need */
export function getRepeatTargets(): RepeatTarget[] {
  const events = loadCoachingEvents();
  const windowMs = 7 * 86400000;
  const cutoff = Date.now() - windowMs;
  const recent = events.filter((e) => new Date(e.at).getTime() > cutoff);

  // group by carer → gap → count
  const map = new Map<string, Map<string, { count: number; firstSeen: string }>>();
  for (const ev of recent) {
    if (!map.has(ev.carer)) map.set(ev.carer, new Map());
    const carerMap = map.get(ev.carer)!;
    for (const gap of ev.gaps) {
      // Normalise gap key — strip "(×N)" suffix
      const key = gap.replace(/\s*\(×\d+\)$/, '').trim();
      if (!carerMap.has(key)) carerMap.set(key, { count: 0, firstSeen: ev.at });
      carerMap.get(key)!.count += 1;
    }
  }

  const results: RepeatTarget[] = [];
  for (const [carer, gapMap] of map) {
    for (const [gap, { count, firstSeen }] of gapMap) {
      if (count >= 3) results.push({ carer, gap, count, firstSeen });
    }
  }
  return results.sort((a, b) => b.count - a.count);
}

// ── Module score history ─────────────────────────────────────────

export function loadModuleHistory(): ModuleHistoryRecord[] {
  try {
    const raw = localStorage.getItem(MODULE_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ModuleHistoryRecord[]) : [];
  } catch { return []; }
}

export function recordModuleScores(
  staff: { carer: string; qualityScore: number; moduleBreakdown: { name: string; score: number }[] }[],
): void {
  const now = new Date().toISOString();
  const newRecords: ModuleHistoryRecord[] = staff.map((s) => ({
    id: uid(),
    at: now,
    carer: s.carer,
    modules: s.moduleBreakdown.map((m) => ({ name: m.name, score: m.score })),
    overallScore: s.qualityScore,
  }));
  if (newRecords.length === 0) return;
  const prev = loadModuleHistory();
  const cutoff = Date.now() - 30 * 86400000;
  const pruned = prev.filter((r) => new Date(r.at).getTime() > cutoff);
  safeset(MODULE_HISTORY_KEY, JSON.stringify([...newRecords, ...pruned].slice(0, 2000)));
}

export interface GrowthAlert {
  carer: string;
  module: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  message: string;  // Ready-to-send positive reinforcement message
}

/**
 * Compares current staff scores vs the rolling average of their last 5 saves.
 * Returns growth alerts where a module improved by 20+ points.
 */
export function detectGrowthAlerts(
  currentStaff: { carer: string; qualityScore: number; moduleBreakdown: { name: string; score: number }[] }[],
): GrowthAlert[] {
  const history = loadModuleHistory();
  const alerts: GrowthAlert[] = [];

  for (const s of currentStaff) {
    // Get last 5 records for this carer (exclude any from the last 5 mins to avoid self-comparison)
    const cutoff = Date.now() - 5 * 60 * 1000;
    const pastRecords = history
      .filter((r) => r.carer === s.carer && new Date(r.at).getTime() < cutoff)
      .slice(0, 5);

    if (pastRecords.length === 0) continue;

    for (const mod of s.moduleBreakdown) {
      const pastScores = pastRecords
        .map((r) => r.modules.find((m) => m.name === mod.name)?.score)
        .filter((v): v is number => v !== undefined);

      if (pastScores.length === 0) continue;
      const avgPast = Math.round(pastScores.reduce((a, b) => a + b, 0) / pastScores.length);
      const delta = mod.score - avgPast;

      if (delta >= 20) {
        const firstName = s.carer.split(' ')[0];
        const message = buildPositiveMessage(firstName, mod.name, avgPast, mod.score);
        alerts.push({
          carer: s.carer,
          module: mod.name,
          previousScore: avgPast,
          currentScore: mod.score,
          delta,
          message,
        });
      }
    }
  }

  // De-duplicate — one alert per carer (the biggest improvement)
  const best = new Map<string, GrowthAlert>();
  for (const a of alerts) {
    const prev = best.get(a.carer);
    // If they have a growth alert, implicitly remove them from the 24hr punishment/coaching track
    removeActiveTracking(a.carer);

    if (!prev || a.delta > prev.delta) best.set(a.carer, a);
  }

  return [...best.values()].sort((a, b) => b.delta - a.delta);
}

function buildPositiveMessage(firstName: string, module: string, prev: number, now: number): string {
  const moduleMessages: Record<string, string> = {
    'Medication': `Your medication documentation has improved significantly — you are now consistently recording outcomes (administered/declined/prompted) which is exactly what CQC expects to see.`,
    'Personal Care': `Your personal care entries are now capturing the full picture — prompts offered, client response, and level of support. That detail matters when it comes to inspection.`,
    'Nutrition': `Your nutrition and hydration documentation has improved — you are now recording meals, appetite, and fluid intake which directly supports person-centred care records.`,
    'Environment': `The environmental safety detail in your notes has increased — recording specific areas checked and tasks completed shows proactive safe practice.`,
    'Wellbeing & Presentation': `Your wellbeing observations have become much more descriptive — capturing how the client presented and responded shows genuine engagement with their care.`,
    'Resident Welfare': `Your handovers are now capturing individual resident presentations which is exactly what the next shift needs. That level of handover protects the service.`,
    'Environmental Safety': `Your handover notes now consistently document environmental checks. That attention to safety documentation is what keeps the service CQC-ready.`,
    'Risk Management': `Your risk management documentation has significantly improved — you are now recording both the risk identified and the response taken, which is the standard we need.`,
    'Handover Summary': `Your handover summaries are now giving the incoming team clear continuation notes per resident. That is the standard we need across all staff.`,
  };

  const specific = moduleMessages[module] ?? `Your ${module.toLowerCase()} documentation has improved significantly — keep this standard going.`;

  return [
    `Hi ${firstName},`,
    ``,
    `I wanted to take a moment to recognise the improvement in your recent documentation.`,
    ``,
    specific,
    ``,
    `Your score for ${module} has moved from ${prev} to ${now} — that is a real shift and it shows in the quality of the notes.`,
    ``,
    `Keep this up. This is the standard that protects our clients and our service.`,
    ``,
    `Management Team`,
  ].join('\n');
}
