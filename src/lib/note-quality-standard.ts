export type NoteStandardStatus = 'strong' | 'needs-review' | 'weak';

export type NoteStandardCheckId =
  | 'time'
  | 'who'
  | 'what'
  | 'why'
  | 'how'
  | 'outcome'
  | 'professional-language'
  | 'detail';

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

const TIME_PATTERN = /\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b|\b(?:morning|afternoon|evening|night|handover|start of shift|end of shift)\b/i;
const WHO_PATTERN = /\b(?:i|we|staff|carer|support worker|senior|manager|nurse|gp|on-call|family|wayne)\b/i;
const WHAT_PATTERN = /\b(?:observed|supported|prompted|encouraged|assisted|provided|offered|completed|administered|monitored|checked|cleaned|reported|contacted|declined|refused|accepted)\b/i;
const WHY_PATTERN = /\b(?:because|due to|as|so that|in order to|to maintain|to support|for safety|risk|hygiene|wellbeing|care plan|identified need|routine|dignity|infection|nutrition|hydration)\b/i;
const HOW_PATTERN = /\b(?:calm|respectful|reassurance|encouragement|prompt|guided|explained|offered choice|gave time|non-intrusive|person-centred|monitored|checked|supported with|approached)\b/i;
const OUTCOME_PATTERN = /\b(?:outcome|afterwards|following this|remained|settled|accepted|declined|refused|completed|resolved|handover|passed to|next shift|continued to|no concerns|left safe|made known)\b/i;
const PROFESSIONAL_PATTERN = /\b(?:shit|shitting|pissed|kicked off|kicking off|mental|crazy|lazy|naughty|attention seeking|dirty|smelly)\b/i;

const CHECKS: Array<Omit<NoteStandardCheck, 'passed'>> = [
  {
    id: 'time',
    label: 'Time or shift point',
    guidance: 'Include the time, support block, or clear shift point so the reader can place the event.',
  },
  {
    id: 'who',
    label: 'Who was involved',
    guidance: 'Name who was present, who witnessed the event, or who was contacted.',
  },
  {
    id: 'what',
    label: 'What happened',
    guidance: 'Describe observable events and behaviours, not just a summary.',
  },
  {
    id: 'why',
    label: 'Why support was needed',
    guidance: 'Explain the reason for intervention, support, monitoring, or escalation.',
  },
  {
    id: 'how',
    label: 'How support was provided',
    guidance: 'Show the quality of care: tone, approach, prompts, choices offered, monitoring, or de-escalation.',
  },
  {
    id: 'outcome',
    label: 'Outcome or ending',
    guidance: 'Complete the story: what happened afterwards and what the next shift needs to know.',
  },
  {
    id: 'professional-language',
    label: 'Professional language',
    guidance: 'Use factual, respectful care language. Avoid graphic, judgemental, or casual wording.',
  },
  {
    id: 'detail',
    label: 'Enough detail',
    guidance: 'Give enough detail for someone who was not there to understand what happened.',
  },
];

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function hasEnoughDetail(text: string): boolean {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  const sentenceCount = normalize(text).split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
  return words.length >= 45 && sentenceCount >= 3;
}

function buildChecks(text: string): NoteStandardCheck[] {
  const normalized = normalize(text);
  const checks: Record<NoteStandardCheckId, boolean> = {
    time: TIME_PATTERN.test(normalized),
    who: WHO_PATTERN.test(normalized),
    what: WHAT_PATTERN.test(normalized),
    why: WHY_PATTERN.test(normalized),
    how: HOW_PATTERN.test(normalized),
    outcome: OUTCOME_PATTERN.test(normalized),
    'professional-language': !PROFESSIONAL_PATTERN.test(normalized),
    detail: hasEnoughDetail(normalized),
  };

  return CHECKS.map((check) => ({ ...check, passed: checks[check.id] }));
}

function detectRisks(text: string): NoteStandardRisk[] {
  const normalized = normalize(text).toLowerCase();
  const risks: NoteStandardRisk[] = [];

  const medicationConflict =
    /\b(refus|declin)\w*\b/.test(normalized)
    && /\b(took|taken|administered|given|prescribed|supported with (?:his|her|their)? ?medication)\b/.test(normalized)
    && /\bmedicat|mar|tablet|dose\b/.test(normalized);

  if (medicationConflict) {
    risks.push({
      id: 'conflicting-medication-status',
      label: 'Medication status needs source alignment',
      guidance: 'If refusal changed to administered later, phrase the chronology clearly and align final wording to the MAR outcome.',
    });
  }

  if (/\b(no concerns|all fine|settled throughout)\b/.test(normalized) && normalized.length < 140) {
    risks.push({
      id: 'thin-reassurance',
      label: 'Thin reassurance',
      guidance: 'Do not rely on "no concerns" without the evidence that led to that conclusion.',
    });
  }

  return risks;
}

export function buildProfessionalNoteDirective(clientName?: string, extraInstruction?: string): string {
  const subject = clientName?.trim() ? ` for ${clientName.trim()}` : '';
  const extra = extraInstruction?.trim() ? `\n\nAdditional source rule:\n${extraInstruction.trim()}` : '';

  return [
    `Apply the Hazel Care golden note structure${subject}.`,
    'Who: name who was present, involved, witnessed the event, or was contacted.',
    'What: describe observable events and behaviours. Do not summarise when description is needed.',
    'Why: explain why support, intervention, monitoring, or escalation was needed.',
    'How: show the quality of support provided, including tone, choices, prompts, reassurance, monitoring, and person-centred approach.',
    'Outcome: complete the story with what happened afterwards, current presentation, and what the next shift needs to know.',
    'Include times or shift blocks where the source provides them.',
    'Preserve source facts only. Do not invent medication, meals, outings, support, times, or professional contacts.',
    'Use professional, respectful language and convert graphic or casual wording into care-sector wording.',
    'If MAR, rota, or source evidence conflicts with the note, flag the conflict or align to the strongest source rather than inventing a resolution.',
  ].join('\n') + extra;
}

export function assessNoteStandard(text: string): NoteStandardAssessment {
  const checks = buildChecks(text);
  const risks = detectRisks(text);
  const passed = checks.filter((check) => check.passed).length;
  const baseScore = Math.round((passed / checks.length) * 100);
  const riskPenalty = risks.length * 10;
  const score = Math.max(0, Math.min(100, baseScore - riskPenalty));
  const missingIds = checks.filter((check) => !check.passed).map((check) => check.id);
  const status: NoteStandardStatus =
    score >= 80 && risks.length === 0 ? 'strong'
      : score >= 55 || risks.length > 0 ? 'needs-review'
        : 'weak';

  return {
    score,
    status,
    checks,
    missingIds,
    risks,
    directive: buildProfessionalNoteDirective(),
  };
}
