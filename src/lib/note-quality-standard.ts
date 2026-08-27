export type NoteStandardStatus = 'strong' | 'needs-review' | 'weak';

export type NoteStandardCheckId =
  | 'time'
  | 'who'
  | 'what'
  | 'why'
  | 'how'
  | 'detail'
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
const WHO_PATTERN = /\b(?:i|staff|support worker|senior|manager)\b/i;
const WHAT_PATTERN = /\b(?:support(?:ed|ing)?|assist(?:ed|ing)?|prompt(?:ed|ing)?|offer(?:ed|ing)?|declin(?:e|ed)|refus(?:e|ed)|administer(?:ed)?|ate|drank|went|attended|completed|observed|reported|discussed)\b/i;
const WHY_PATTERN = /\b(?:because|due to|after|following|in order to|so that|as .*\b(?:appeared|requested|needed|declined)|why)\b/i;
const HOW_PATTERN = /\b(?:calm(?:ly)?|reassur(?:ed|ance)|explain(?:ed|ing)?|encourag(?:ed|ing)?|prompt(?:ed|ing)?|gave .* time|at .* pace|with .* support|using|by)\b/i;
const DETAIL_PATTERN = /(?:\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b.*\b(?:at|after|following|during|before)\b|\b(?:bedroom|kitchen|lounge|community|handover|senior|manager|monitoring)\b)/i;
const MEDICATION_PATTERN = /\b(?:medicat|mar|tablet|dose|administered|prescribed|took|taken|given|refused|declined|supported with (?:his|her|their)? ?medication)\b/i;
const NUTRITION_PATTERN = /\b(?:ate|drank|breakfast|lunch|dinner|tea|meal|snack|water|juice|hydrat|ate well|ate poorly)\b/i;
const MOOD_PATTERN = /\b(?:mood|settled|calm|happy|sad|angry|upset|anxious|agitated|relaxed|cheerful|presented|appeared|seemed)\b/i;
const ACTIVITY_PATTERN = /\b(?:walk|tv|telly|music|garden|room|out|community|engage|chat|talk|shower|bath|clean|activity)\b/i;
const OUTCOME_PATTERN = /\b(?:outcome|afterwards|following|remained|settled|handover|next shift|continued|end of shift|shift ended|overall)\b/i;

const CHECKS: Array<Omit<NoteStandardCheck, 'passed'>> = [
  { id: 'time', label: 'Time or shift period', guidance: 'Include when events happened or which shift this covers.' },
  { id: 'who', label: 'Who', guidance: 'Identify the person supported and who provided or observed the support.' },
  { id: 'what', label: 'What happened', guidance: 'State the event, support, choice, refusal, activity, or observation.' },
  { id: 'why', label: 'Why', guidance: 'Record the reason or relevant context when it is known.' },
  { id: 'how', label: 'How support was provided', guidance: 'Describe the approach, prompts, reassurance, or reasonable adjustment used.' },
  { id: 'detail', label: 'Specific detail', guidance: 'Include concrete detail such as location, sequence, escalation, or monitoring.' },
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
  const namedPeople = normalized.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const hasWho = WHO_PATTERN.test(normalized)
    || namedPeople.some((word) => !new Set(['At', 'The', 'Client', 'Support', 'No']).has(word));
  const hasWhat = WHAT_PATTERN.test(normalized)
    && !/^client had a good day\. support given\. no concerns\.?$/i.test(normalized);
  const checks: Record<NoteStandardCheckId, boolean> = {
    time: TIME_PATTERN.test(normalized),
    who: hasWho,
    what: hasWhat,
    why: WHY_PATTERN.test(normalized),
    how: HOW_PATTERN.test(normalized),
    detail: DETAIL_PATTERN.test(normalized),
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

  const medicationRefused = /\b(?:refused|declined)\b[^.]{0,80}\b(?:medicat\w*|tablet|dose)\b|\b(?:medicat\w*|tablet|dose)\b[^.]{0,80}\b(?:refused|declined)\b/.test(normalized);
  const medicationTaken = /\b(?:took|taken|administered|given)\b[^.]{0,80}\b(?:medicat\w*|tablet|dose|prescribed)\b|\b(?:medicat\w*|tablet|dose)\b[^.]{0,80}\b(?:took|taken|administered|given)\b/.test(normalized);
  if (medicationRefused && medicationTaken) {
    risks.push({
      id: 'conflicting-medication-status',
      label: 'Conflicting medication status',
      guidance: 'Align the note with the MAR outcome and explain the sequence before recording a final medication status.',
    });
  }

  return risks;
}

export function buildProfessionalNoteDirective(clientName?: string, extraInstruction?: string): string {
  const subject = clientName?.trim() ? ` for ${clientName.trim()}` : '';
  const extra = extraInstruction?.trim() ? `\n\nAdditional instruction:\n${extraInstruction.trim()}` : '';

  return [
    `Apply the OVSITE golden note structure${subject}.`,
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
      : score >= 50 || risks.some((risk) => risk.id === 'conflicting-medication-status') ? 'needs-review'
        : 'weak';

  return { score, status, checks, missingIds, risks, directive: buildProfessionalNoteDirective() };
}
