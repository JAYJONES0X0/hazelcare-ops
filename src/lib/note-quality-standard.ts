export type NoteStandardStatus = 'strong' | 'needs-review' | 'weak';

export type NoteStandardCheckId =
  | 'time'
  | 'medication'
  | 'nutrition'
  | 'mood'
  | 'activity'
  | 'outcome';

export interface NoteStandardCheck {
  id: NoteStandardCheckId;
  label: string;
  passed: boolean;
  guidance: string;
}

export interface NoteStandardRisk {
  id: string;
  label: string;
  guidance: string;
}

export interface NoteStandardAssessment {
  score: number;
  status: NoteStandardStatus;
  checks: NoteStandardCheck[];
  missingIds: NoteStandardCheckId[];
  risks: NoteStandardRisk[];
  directive: string;
}

const TIME_PATTERN = /\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b|\b(?:morning|afternoon|evening|night|handover|start of shift|end of shift|around|approximately)\b/i;
const MEDICATION_PATTERN = /\b(?:medicat|mar|tablet|dose|administered|prescribed|took|taken|given|refused|declined|supported with (?:his|her|their)? ?medication)\b/i;
const NUTRITION_PATTERN = /\b(?:ate|drank|breakfast|lunch|dinner|tea|meal|snack|water|juice|hydrat|ate well|ate poorly)\b/i;
const MOOD_PATTERN = /\b(?:mood|settled|calm|happy|sad|angry|upset|anxious|agitated|relaxed|cheerful|presented|appeared|seemed)\b/i;
const ACTIVITY_PATTERN = /\b(?:walk|tv|telly|music|garden|room|out|community|engage|chat|talk|shower|bath|clean|activity)\b/i;
const OUTCOME_PATTERN = /\b(?:outcome|afterwards|following|remained|settled|handover|next shift|continued|end of shift|shift ended|overall)\b/i;

const CHECKS: Array<Omit<NoteStandardCheck, 'passed'>> = [
  { id: 'time', label: 'Time or shift period', guidance: 'Include when events happened or which shift this covers.' },
  { id: 'medication', label: 'Medication', guidance: 'Document any medication given, refused, or observed.' },
  { id: 'nutrition', label: 'Nutrition & hydration', guidance: 'Note what the client ate or drank.' },
  { id: 'mood', label: 'Mood & presentation', guidance: 'Describe how the client presented during the shift.' },
  { id: 'activity', label: 'Activity & engagement', guidance: 'Note what the client did: walked, watched TV, engaged, showered, etc.' },
  { id: 'outcome', label: 'Outcome or handover', guidance: 'End with a summary of the client\'s status for the next shift.' },
];

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildChecks(text: string): NoteStandardCheck[] {
  const normalized = normalize(text);
  const checks: Record<NoteStandardCheckId, boolean> = {
    time: TIME_PATTERN.test(normalized),
    medication: MEDICATION_PATTERN.test(normalized),
    nutrition: NUTRITION_PATTERN.test(normalized),
    mood: MOOD_PATTERN.test(normalized),
    activity: ACTIVITY_PATTERN.test(normalized),
    outcome: OUTCOME_PATTERN.test(normalized),
  };
  return CHECKS.map((check) => ({ ...check, passed: checks[check.id] }));
}

function detectRisks(text: string): NoteStandardRisk[] {
  const normalized = normalize(text).toLowerCase();
  const risks: NoteStandardRisk[] = [];

  if (/\b(?:no concerns|all fine|nothing to report|settled throughout)\b/.test(normalized) && normalized.length < 120) {
    risks.push({ id: 'thin-reassurance', label: 'Thin reassurance', guidance: '"No concerns" needs evidence — what did you observe that led to that conclusion?' });
  }

  if (normalized.split(/\s+/).filter(Boolean).length < 30) {
    risks.push({ id: 'too-short', label: 'Very brief', guidance: 'Expand with what happened during the shift: medication, meals, mood, activities.' });
  }

  return risks;
}

export function buildProfessionalNoteDirective(clientName?: string, extraInstruction?: string): string {
  const subject = clientName?.trim() ? ` for ${clientName.trim()}` : '';
  const extra = extraInstruction?.trim() ? `\n\nAdditional instruction:\n${extraInstruction.trim()}` : '';

  return [
    `Write a clear shift note${subject} based on the raw data provided.`,
    'Use simple, chronological language — like a real care worker speaking.',
    'Cover: medication given or refused, meals eaten, mood and presentation, activities, and end-of-shift status.',
    'Write short, factual sentences. Include times where available.',
    'Do not invent details. If something is not in the raw data, leave it out.',
    'Use first person ("I supported...") or third person ("Staff supported...") to match the tone of the raw data.',
  ].join('\n') + extra;
}

export function assessNoteStandard(text: string, enhancedText?: string): NoteStandardAssessment {
  if (enhancedText) return assessNoteStandard(enhancedText);
  const checks = buildChecks(text);
  const risks = detectRisks(text);
  const passed = checks.filter((check) => check.passed).length;
  const baseScore = Math.round((passed / checks.length) * 100);
  const riskPenalty = risks.length * 15;
  const score = Math.max(0, Math.min(100, baseScore - riskPenalty));
  const missingIds = checks.filter((check) => !check.passed).map((check) => check.id);
  const status: NoteStandardStatus =
    score >= 80 && risks.length === 0 ? 'strong'
      : score >= 50 ? 'needs-review'
        : 'weak';

  return { score, status, checks, missingIds, risks, directive: buildProfessionalNoteDirective() };
}
