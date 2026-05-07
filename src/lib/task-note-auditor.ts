/**
 * task-note-auditor.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Audits 1:1 support evidence across appointments for funder compliance.
 *
 * THE 3-TIER HIERARCHY (how Nourish/CarePlanner actually works):
 *
 *   TIER 1 — APPOINTMENT BLOCK (e.g. 1pm visit)
 *     ├─ Task: Medication     → brief tick note = ACCEPTABLE
 *     ├─ Task: Personal care  → brief tick note = ACCEPTABLE
 *     └─ APPOINTMENT NOTE     → THIS must evidence the 1:1 support ← AUDIT THIS
 *
 *   TIER 2 — END OF DAY
 *     └─ 1:1 Daily diary note → Full clinical evidence ← AUDIT THIS HARDEST
 *
 *   TIER 3 — TASK TICKS (inside appointments)
 *     └─ "Not required" / "Done" / blank → THESE ARE FINE — not the evidence
 *
 * The audit checks: for each client on each day, is there a qualifying
 * narrative note (appointment note OR daily 1:1 note) that evidences the
 * 1:1 support? If not, the APPOINTMENT is flagged — not each task tick.
 */

import type { CareEntry } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TaskNoteFailureReason =
  | 'blank'
  | 'too_short'
  | 'no_outcome'
  | 'no_client_response'
  | 'medication_incomplete'
  | 'meals_incomplete'
  | 'personal_care_incomplete'
  | 'generic_placeholder'
  | 'appointment_missing_narrative'
  | 'daily_1to1_missing';

export type TaskCategory =
  | 'medication'
  | 'meals_nutrition'
  | 'personal_care'
  | 'mental_health'
  | 'engagement_activity'
  | 'hygiene'
  | 'fire_safety'
  | 'room_security'
  | 'alcohol_check'
  | 'skin_integrity'
  | 'weekly_room'
  | 'safeguarding'
  | 'mobility'
  | 'generic_task'
  | 'maintenance'
  | 'appointment_note'
  | 'daily_1to1';

export interface TaskNoteGap {
  entryId: string;
  date: string;
  client: string;
  carer: string;
  house: string;
  taskCategory: TaskCategory;
  taskCategoryLabel: string;
  noteText: string;
  failures: TaskNoteFailureReason[];
  failureMessages: string[];
  severity: 'critical' | 'high' | 'medium';
  goldStandard: string;
  score: number; // 0–100
  // New: context about the appointment this gap belongs to
  appointmentTime?: string;
  appointmentId?: string;
  gapType: 'task_tick' | 'appointment_narrative' | 'daily_1to1';
}

export interface TaskNoteCarerSummary {
  carer: string;
  totalTaskNotes: number;
  failingTaskNotes: number;
  complianceScore: number; // 0–100
  gaps: TaskNoteGap[];
  criticalCount: number;
  highCount: number;
  // New: breakdown by gap type
  missingAppointmentNarratives: number;
  missingDaily1to1s: number;
  poorQualityNarratives: number;
}

export interface TaskNoteAuditResult {
  totalTaskNotes: number;
  failingTaskNotes: number;
  overallComplianceScore: number;
  byStaff: TaskNoteCarerSummary[];
  allGaps: TaskNoteGap[];
  // New: summary of what the audit actually found
  auditMode: 'appointment_evidence' | 'task_tick';
  totalAppointments: number;
  appointmentsMissingNarrative: number;
  clientDaysMissingDaily1to1: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY TYPE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const TASK_TICK_SIGNALS = [
  'task note generated via mobile app',
  'task note generated',
  'mobile app task',
];

const APPOINTMENT_NOTE_SIGNALS = [
  'appointment note',
  'visit note',
  'appointment',
  'keywork',
  'key work',
  '1:1 appointment',
];

const DAILY_1TO1_SIGNALS = [
  'daily 1:1',
  '1:1 daily',
  'daily support',
  'daily note',
  '1:1 support',
  'one to one',
  'one-to-one',
  '1to1',
];

export function isTaskTickEntry(entry: CareEntry): boolean {
  const t = (entry.type || '').toLowerCase().trim();
  return TASK_TICK_SIGNALS.some(sig => t.includes(sig));
}

export function isAppointmentNoteEntry(entry: CareEntry): boolean {
  const t = (entry.type || '').toLowerCase().trim();
  const cat = (entry.category || '').toLowerCase().trim();
  return APPOINTMENT_NOTE_SIGNALS.some(sig => t.includes(sig) || cat.includes(sig));
}

export function isDaily1to1Entry(entry: CareEntry): boolean {
  const t = (entry.type || '').toLowerCase().trim();
  const cat = (entry.category || '').toLowerCase().trim();
  const e = (entry.entry || '').toLowerCase();
  return DAILY_1TO1_SIGNALS.some(sig =>
    t.includes(sig) || cat.includes(sig) || e.slice(0, 50).includes(sig)
  );
}

// Keep backward compatibility
export function isTaskNoteEntry(entry: CareEntry): boolean {
  return isTaskTickEntry(entry);
}

// ─────────────────────────────────────────────────────────────────────────────
// NARRATIVE QUALITY SCORING (for appointment notes & daily 1:1s)
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_PLACEHOLDERS = [
  /^done\.?$/i,
  /^done and recorded\.?$/i,
  /^completed\.?$/i,
  /^not required\.?$/i,
  /^n\/a\.?$/i,
  /^no issues\.?$/i,
  /^ok\.?$/i,
  /^noted\.?$/i,
  /^recorded\.?$/i,
  /^na$/i,
  /^all good\.?$/i,
  /^fine\.?$/i,
];

/**
 * Scores a narrative note (appointment note or 1:1 diary note) for
 * whether it evidences 1:1 support to a funder-acceptable standard.
 * Returns 0–100.
 */
function scoreNarrativeNote(text: string, isDaily1to1: boolean): {
  score: number;
  failures: TaskNoteFailureReason[];
  messages: string[];
} {
  const failures: TaskNoteFailureReason[] = [];
  const messages: string[] = [];
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed || trimmed.replace(/\s/g, '').length === 0) {
    return {
      score: 0,
      failures: ['blank'],
      messages: ['Note is completely blank. This appointment has no evidence of 1:1 support.'],
    };
  }

  if (GENERIC_PLACEHOLDERS.some(p => p.test(trimmed))) {
    return {
      score: 5,
      failures: ['generic_placeholder'],
      messages: [
        `"${trimmed}" is a placeholder. It gives no evidence of the 1:1 support delivered. Funders reviewing this file will find nothing here.`,
      ],
    };
  }

  // Minimum length: appointment note needs at least 80 chars, daily 1:1 needs 150
  const minLen = isDaily1to1 ? 150 : 80;
  if (trimmed.length < minLen) {
    failures.push('too_short');
    messages.push(
      isDaily1to1
        ? `Daily 1:1 note is only ${trimmed.length} characters. This is the primary evidence of 1:1 support for funding purposes — it needs to cover the full day's engagement, the client's presentation, and outcomes.`
        : `Appointment note is only ${trimmed.length} characters. It should evidence what happened during this visit — the client's presentation, what support was provided, and the outcome.`
    );
  }

  let score = 100;

  // Has first-person accountability (I supported / I prompted / I assisted)?
  const hasFirstPerson = /\bI (support|assist|help|prompt|accompan|deliver|provide|complet|encour|monitor|observ|led|maintained|ensured|attended|spoke|sat|stayed|went|took|gave|offered)/i.test(trimmed);
  if (!hasFirstPerson) {
    score -= 15;
    messages.push('Write in first person — "I supported…" instead of "Staff supported…". This tells the reader exactly who delivered the care.');
  }

  // Has client response/presentation?
  const hasClientPresentation = /calm|settled|engag|cooperat|mood|present|respond|accept|declin|refus|distress|anxious|upset|low|well|happy|agitat|confused|orient/i.test(lower);
  if (!hasClientPresentation) {
    failures.push('no_client_response');
    score -= 20;
    messages.push('Record how the client was — their mood, presentation, and response to support. This is the core of 1:1 evidence.');
  }

  // Has outcome/what was done?
  const hasOutcome = /support(ed)?|assist(ed)?|complet(ed)?|achiev(ed)?|encour(aged)?|prompted|accompan(ied)?|deliver(ed)?|provid(ed)?|no concern|no incident|handover/i.test(lower);
  if (!hasOutcome) {
    failures.push('no_outcome');
    score -= 20;
    messages.push('State the outcome of the visit — what was achieved, what was declined, what was passed to the next shift.');
  }

  // Daily 1:1 should cover safeguarding
  if (isDaily1to1) {
    const hasSafeguarding = /no (safeguard|concern|incident)|safeguard|no issues identified|nothing of concern|no concern/i.test(lower);
    if (!hasSafeguarding) {
      score -= 10;
      messages.push('Daily 1:1 notes should confirm safeguarding status — even "No concerns or incidents identified during this support period" is sufficient.');
    }
  }

  if (failures.includes('too_short')) score -= 20;

  return { score: Math.max(0, Math.min(100, score)), failures, messages };
}

function buildGoldStandardForAppointment(client: string, isDaily: boolean): string {
  const name = (client || 'the client').split(/[\s(]/)[0];
  if (isDaily) {
    return `I provided 1:1 support to ${name} throughout today's shift. ${name} was calm and engaged well with all prompts and activities offered. Morning routine was completed with minimal prompting — ${name} managed [specific tasks] independently. Afternoon support focused on [activity/engagement]. ${name}'s mood remained [stable/good/low — with reason] throughout the day. No safeguarding concerns or incidents were identified during this support period. All relevant information has been passed to the incoming shift team.`;
  }
  return `I supported ${name} during this visit. ${name} was [calm/settled/agitated] on arrival and [accepted/initially declined] support. [Specific support provided: e.g. personal care, medication prompt, meal preparation]. ${name} [responded well/required encouragement/declined X]. No concerns identified during this visit. All tasks completed as per care plan / [note any deviations]. Information passed to next shift.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK CATEGORY DETECTION (for task ticks — kept for reference/display)
// ─────────────────────────────────────────────────────────────────────────────

const TASK_CATEGORY_PATTERNS: { category: TaskCategory; label: string; patterns: RegExp[] }[] = [
  { category: 'medication', label: 'Medication', patterns: [/medic/i, /mar\b/i, /tablet/i, /dose/i, /prescribed/i, /drug/i] },
  { category: 'meals_nutrition', label: 'Meals & Nutrition', patterns: [/breakfast/i, /lunch/i, /dinner/i, /supper/i, /meal/i, /food/i, /eat/i, /nutrition/i, /snack/i, /fluid/i, /hydrat/i] },
  { category: 'personal_care', label: 'Personal Care', patterns: [/personal care/i, /shower/i, /bath/i, /wash/i, /hygiene/i, /toothbrush/i, /oral hygiene/i, /dress/i, /hair/i, /groom/i] },
  { category: 'mental_health', label: 'Mental Health Check', patterns: [/mental health/i, /mood check/i, /wellbeing check/i, /welfare check/i] },
  { category: 'engagement_activity', label: 'Engagement & Activity', patterns: [/engag/i, /activit/i, /social/i, /recreation/i, /occupation/i] },
  { category: 'fire_safety', label: 'Fire & Environmental Safety', patterns: [/fire.?safe/i, /clutter/i, /hazard/i, /smoke/i, /environ/i] },
  { category: 'room_security', label: 'Room Security', patterns: [/room.?lock/i, /lock/i, /security check/i, /secure/i] },
  { category: 'alcohol_check', label: 'Alcohol Use Check', patterns: [/alcohol/i, /substance/i, /beer/i, /wine/i] },
  { category: 'skin_integrity', label: 'Skin Integrity', patterns: [/skin/i, /rash/i, /pressure/i, /wound/i, /redness/i, /sore/i, /cream/i] },
  { category: 'weekly_room', label: 'Weekly Room Support', patterns: [/clean/i, /laundry/i, /bin/i, /declutter/i, /room support/i, /mop/i, /hoover/i, /vacuum/i] },
  { category: 'safeguarding', label: 'Safeguarding', patterns: [/safeguard/i, /exploit/i, /concern/i, /incident/i, /abuse/i] },
  { category: 'mobility', label: 'Mobility Support', patterns: [/mobilit/i, /transfer/i, /hoist/i, /physio/i, /exercise/i] },
  { category: 'maintenance', label: 'Maintenance / Admin', patterns: [/maintenanc/i, /repair/i, /admin/i] },
];

function detectTaskCategory(entry: CareEntry): { category: TaskCategory; label: string } {
  const combined = ((entry.entry || '') + ' ' + (entry.client || '') + ' ' + (entry.type || '')).toLowerCase();
  for (const { category, label, patterns } of TASK_CATEGORY_PATTERNS) {
    if (patterns.some(p => p.test(combined))) return { category, label };
  }
  return { category: 'generic_task', label: 'General Task' };
}

function failureSeverity(failures: TaskNoteFailureReason[], score: number): 'critical' | 'high' | 'medium' {
  if (failures.includes('blank') || failures.includes('appointment_missing_narrative') || failures.includes('daily_1to1_missing') || score <= 10) return 'critical';
  if (failures.includes('generic_placeholder') || failures.includes('too_short') || score < 35) return 'high';
  return 'medium';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AUDIT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function auditTaskNotes(entries: CareEntry[]): TaskNoteAuditResult {
  const allGaps: TaskNoteGap[] = [];

  // Separate entry types
  const taskTicks = entries.filter(isTaskTickEntry);
  const appointmentNotes = entries.filter(isAppointmentNoteEntry);
  const daily1to1Notes = entries.filter(isDaily1to1Entry);

  // ── STRATEGY: Group appointments by client + date ──────────────────────────
  // For each unique (client, date) pair, check:
  // 1. Is there a qualifying appointment narrative? (appointment note OR daily 1:1)
  // 2. If there are appointment notes, are they of sufficient quality?
  // 3. If there are daily 1:1 notes, are they of sufficient quality?

  // Build a lookup: clientKey → set of dates with qualifying narratives
  const qualifyingNarrativesByClientDate = new Map<string, Set<string>>();

  // Index daily 1:1 notes by client+date
  const daily1to1ByClientDate = new Map<string, CareEntry[]>();
  for (const entry of daily1to1Notes) {
    if (!entry.client || !entry.date) continue;
    const key = `${(entry.client || '').toLowerCase().trim()}|${entry.date}`;
    if (!daily1to1ByClientDate.has(key)) daily1to1ByClientDate.set(key, []);
    daily1to1ByClientDate.get(key)!.push(entry);
  }

  // Index appointment notes by client+date
  const appointmentNotesByClientDate = new Map<string, CareEntry[]>();
  for (const entry of appointmentNotes) {
    if (!entry.client || !entry.date) continue;
    const key = `${(entry.client || '').toLowerCase().trim()}|${entry.date}`;
    if (!appointmentNotesByClientDate.has(key)) appointmentNotesByClientDate.set(key, []);
    appointmentNotesByClientDate.get(key)!.push(entry);
  }

  // Build the set of client+date combos that appear in task ticks
  // (these are the appointments we need evidence for)
  const appointmentClientDates = new Set<string>();
  for (const entry of taskTicks) {
    if (!entry.client || !entry.date) continue;
    const key = `${(entry.client || '').toLowerCase().trim()}|${entry.date}`;
    appointmentClientDates.add(key);
  }

  let totalAppointments = 0;
  let appointmentsMissingNarrative = 0;
  let clientDaysMissingDaily1to1 = 0;

  // ── AUDIT APPOINTMENT NARRATIVES ──────────────────────────────────────────
  for (const clientDateKey of appointmentClientDates) {
    const [clientLower, date] = clientDateKey.split('|');
    totalAppointments++;

    // Find the actual client name from entries
    const repEntry = taskTicks.find(
      e => (e.client || '').toLowerCase().trim() === clientLower && e.date === date
    );
    const client = repEntry?.client || clientLower;
    const carer = repEntry?.carer || 'Unknown';
    const house = repEntry?.house || '—';

    // Does this client+date have a daily 1:1 note?
    const daily1to1s = daily1to1ByClientDate.get(clientDateKey) || [];
    const appointmentNarratives = appointmentNotesByClientDate.get(clientDateKey) || [];
    const hasAnyNarrative = daily1to1s.length > 0 || appointmentNarratives.length > 0;

    if (!hasAnyNarrative) {
      // No narrative at all for this appointment day — critical gap
      appointmentsMissingNarrative++;
      const gap: TaskNoteGap = {
        entryId: `missing-narrative-${clientDateKey}`,
        date,
        client,
        carer,
        house,
        taskCategory: 'appointment_note',
        taskCategoryLabel: 'Appointment Note',
        noteText: '',
        failures: ['appointment_missing_narrative'],
        failureMessages: [
          `No appointment note or 1:1 narrative found for this client on this date. Task ticks exist (tasks were opened) but there is no narrative evidence of the 1:1 support delivered. Funders reviewing this file will see task activity with no supporting documentation.`,
        ],
        severity: 'critical',
        goldStandard: buildGoldStandardForAppointment(client, false),
        score: 0,
        gapType: 'appointment_narrative',
      };
      allGaps.push(gap);
    } else {
      // There are narratives — audit their quality
      const allNarratives = [...daily1to1s, ...appointmentNarratives];
      for (const narrative of allNarratives) {
        const isDaily = daily1to1s.includes(narrative);
        const { score, failures, messages } = scoreNarrativeNote(narrative.entry || '', isDaily);
        if (score < 70 || failures.length > 0) {
          const gap: TaskNoteGap = {
            entryId: narrative.id || `narrative-${clientDateKey}`,
            date,
            client,
            carer: narrative.carer || carer,
            house: narrative.house || house,
            taskCategory: isDaily ? 'daily_1to1' : 'appointment_note',
            taskCategoryLabel: isDaily ? 'Daily 1:1 Note' : 'Appointment Note',
            noteText: (narrative.entry || '').trim(),
            failures,
            failureMessages: messages,
            severity: failureSeverity(failures, score),
            goldStandard: buildGoldStandardForAppointment(client, isDaily),
            score,
            gapType: isDaily ? 'daily_1to1' : 'appointment_narrative',
          };
          allGaps.push(gap);
        }
      }
    }
  }

  // ── ALSO AUDIT DAILY 1:1 NOTES THAT EXIST BUT ARE POOR QUALITY ────────────
  // (client days that have a daily 1:1 but it's not up to standard)
  // This is already covered above for clients with task ticks.
  // Also check client days with daily 1:1 notes but NO task ticks (direct diary entries)
  for (const [key, dailyEntries] of daily1to1ByClientDate) {
    if (appointmentClientDates.has(key)) continue; // Already audited above
    for (const entry of dailyEntries) {
      const { score, failures, messages } = scoreNarrativeNote(entry.entry || '', true);
      if (score < 70 || failures.length > 0) {
        clientDaysMissingDaily1to1++;
        allGaps.push({
          entryId: entry.id || `daily-${key}`,
          date: entry.date || '—',
          client: entry.client || '—',
          carer: entry.carer || 'Unknown',
          house: entry.house || '—',
          taskCategory: 'daily_1to1',
          taskCategoryLabel: 'Daily 1:1 Note',
          noteText: (entry.entry || '').trim(),
          failures,
          failureMessages: messages,
          severity: failureSeverity(failures, score),
          goldStandard: buildGoldStandardForAppointment(entry.client || '', true),
          score,
          gapType: 'daily_1to1',
        });
      }
    }
  }

  // ── FALLBACK: If no appointment structure detected, audit task ticks ───────
  // (handles legacy/simple CSV exports that don't have appointment note rows)
  const hasAppointmentStructure = appointmentNotes.length > 0 || daily1to1Notes.length > 0;
  if (!hasAppointmentStructure && taskTicks.length > 0) {
    // Fall back to legacy task-tick audit mode
    for (const entry of taskTicks) {
      const { category } = detectTaskCategory(entry);
      const text = (entry.entry || '').trim();
      const isBlank = !text || GENERIC_PLACEHOLDERS.some(p => p.test(text));
      if (!isBlank) continue; // In fallback mode, only flag actual blanks

      allGaps.push({
        entryId: entry.id,
        date: entry.date || '—',
        client: entry.client || '—',
        carer: entry.carer || 'Unknown',
        house: entry.house || '—',
        taskCategory: category,
        taskCategoryLabel: detectTaskCategory(entry).label,
        noteText: text,
        failures: text ? ['generic_placeholder'] : ['blank'],
        failureMessages: [
          text
            ? `"${text}" is a placeholder — no evidence of care delivered.`
            : 'Task note is blank — no evidence of care delivered.',
        ],
        severity: 'high',
        goldStandard: `Task completed for ${(entry.client || 'the client').split(' ')[0]}. Client accepted/declined support. Outcome: [specific result]. No concerns identified.`,
        score: text ? 20 : 0,
        gapType: 'task_tick',
      });
    }
  }

  // ── GROUP BY CARER ─────────────────────────────────────────────────────────
  const byCarer = new Map<string, TaskNoteGap[]>();
  for (const gap of allGaps) {
    if (!byCarer.has(gap.carer)) byCarer.set(gap.carer, []);
    byCarer.get(gap.carer)!.push(gap);
  }

  // Total scored = appointment days + daily 1:1 notes audited
  const totalScored = hasAppointmentStructure
    ? totalAppointments + daily1to1Notes.length
    : taskTicks.length;

  const byStaff: TaskNoteCarerSummary[] = [];
  for (const [carer, gaps] of byCarer) {
    const failing = gaps.length;
    // Estimate total for this carer
    const carerTaskTicks = taskTicks.filter(e => (e.carer || 'Unknown') === carer).length;
    const total = Math.max(failing, carerTaskTicks, 1);
    const complianceScore = Math.round(((total - failing) / total) * 100);

    byStaff.push({
      carer,
      totalTaskNotes: total,
      failingTaskNotes: failing,
      complianceScore,
      gaps: gaps.sort((a, b) => {
        const sv = { critical: 0, high: 1, medium: 2 };
        return sv[a.severity] - sv[b.severity];
      }),
      criticalCount: gaps.filter(g => g.severity === 'critical').length,
      highCount: gaps.filter(g => g.severity === 'high').length,
      missingAppointmentNarratives: gaps.filter(g => g.gapType === 'appointment_narrative').length,
      missingDaily1to1s: gaps.filter(g => g.gapType === 'daily_1to1').length,
      poorQualityNarratives: gaps.filter(g => g.gapType !== 'task_tick' && g.score > 0 && g.score < 70).length,
    });
  }

  byStaff.sort((a, b) => a.complianceScore - b.complianceScore);

  const overallScore = totalScored > 0
    ? Math.round(((totalScored - allGaps.length) / totalScored) * 100)
    : 100;

  return {
    totalTaskNotes: totalScored,
    failingTaskNotes: allGaps.length,
    overallComplianceScore: Math.max(0, overallScore),
    byStaff,
    allGaps,
    auditMode: hasAppointmentStructure ? 'appointment_evidence' : 'task_tick',
    totalAppointments,
    appointmentsMissingNarrative,
    clientDaysMissingDaily1to1,
  };
}
