import type {
  Action,
  ActionPriority,
  CareEntry,
  EvidenceItem,
  HouseDailyState,
  OperationalActionState,
  OutputDraft,
  ResidentPeriodSummary,
  WeekSummary,
} from './types';
import type { FullClient, PackFileManifestRow, VaultDoc } from './client-store';

export const ACTION_STATE_LABELS: Record<OperationalActionState, string> = {
  not_started: 'Not started',
  assigned: 'Assigned',
  in_progress: 'In progress',
  waiting_staff_feedback: 'Waiting staff feedback',
  waiting_professional: 'Waiting professional',
  waiting_resident_availability: 'Waiting resident availability',
  completed: 'Completed',
  closed_with_evidence: 'Closed with evidence',
  carry_forward: 'Carry forward',
  escalated: 'Escalated',
};

const PROFESSIONAL_WORDS = ['gp', 'doctor', 'nurse', 'hospital', 'social worker', 'ot ', 'physio', 'pharmacy', 'mar'];
const APPOINTMENT_WORDS = ['appointment', 'review', 'visit', 'call', 'meeting', 'assessment'];
const HEALTH_WORDS = ['pain', 'unwell', 'medication', 'health', 'gp', 'hospital', 'seizure', 'fall', 'wound', 'infection'];
const INCIDENT_WORDS = ['incident', 'safeguarding', 'aggression', 'threat', 'police', 'abuse', 'risk', 'escalat'];
const REFUSAL_WORDS = ['declined', 'refused', 'would not', 'did not want', 'not engaging', 'rejected'];
const SUPPORT_WORDS = ['support', 'prompt', 'assist', 'personal care', 'meal', 'medication', 'laundry', 'clean'];
const ACTIVITY_WORDS = ['activity', 'community', 'shopping', 'walk', 'visit', 'club', 'college', 'garden'];
const POOR_ENTRY_WORDS = ['no concerns', 'all fine', 'done', 'ok', 'settled'];

export type StaffSafetyCategory =
  | 'verbal_aggression'
  | 'threats'
  | 'hate_discriminatory_abuse'
  | 'physical_aggression'
  | 'property_damage'
  | 'object_used'
  | 'resident_left_property_heightened'
  | 'other_residents_affected';

export interface ClientPackReviewQueueRow {
  clientId: string;
  clientName: string;
  packId: string;
  packSourceName: string;
  onboardingStatus: FullClient['onboardingStatus'];
  parsedFiles: number;
  totalFiles: number;
  needsReviewCount: number;
  missingCriticalEvidence: string[];
  blockedReasons: string[];
  nextAction: 'Review manifest' | 'Resolve identity' | 'Resolve live gates' | 'Ready for manager sign-off';
  liveReady: boolean;
}

export interface StaffSafetyReviewResult {
  evidence: EvidenceItem[];
  categories: StaffSafetyCategory[];
  reviewRequired: boolean;
  decisionBoundary: string;
  actionCandidates: Action[];
  outputDraft: OutputDraft;
  missingEvidence: string[];
}

function includesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some(word => lower.includes(word));
}

function shortExcerpt(text: string, length = 180) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > length ? `${trimmed.slice(0, length - 1)}...` : trimmed;
}

function clampConfidence(value: number | undefined | null, fallback = 0.5) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function evidenceReviewStateFromParse(input: {
  reviewRequired?: boolean;
  parseStatus?: string;
  category?: string;
  rejectedReasons?: string[];
}): EvidenceItem['reviewState'] {
  if (input.category === 'irrelevant' || input.parseStatus === 'SKIPPED_WITH_REASON') return 'deferred';
  if (input.reviewRequired || input.parseStatus === 'FAILED' || input.parseStatus === 'OCR_REQUIRED' || input.parseStatus === 'AI_REVIEW_REQUIRED' || input.parseStatus === 'PARTIAL') {
    return 'review_required';
  }
  return 'unreviewed';
}

function parseDate(value: string): number {
  if (!value) return 0;
  const parts = value.split(/[/-]/).map(Number);
  if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
    const [day, month, year] = parts[0] > 31 ? [parts[2], parts[1], parts[0]] : parts;
    return new Date(year, month - 1, day).getTime();
  }
  return Date.parse(value) || 0;
}

function inRange(entry: CareEntry, dateFrom?: string, dateTo?: string) {
  const time = parseDate(entry.date);
  if (!time || (!dateFrom && !dateTo)) return true;
  const from = dateFrom ? parseDate(dateFrom) : 0;
  const to = dateTo ? parseDate(dateTo) : Number.MAX_SAFE_INTEGER;
  return time >= from && time <= to;
}

function allEntries(weekData: WeekSummary | null): CareEntry[] {
  if (!weekData) return [];
  return Object.values(weekData.houses).flatMap(house => house.entries);
}

export function evidenceFromPackManifestRow(row: PackFileManifestRow): EvidenceItem {
  const reason = row.rejectedReasons.length ? ` ${row.rejectedReasons.join(' ')}` : '';
  return {
    id: `ev-pack-${row.fileId}`,
    sourceType: 'client_pack_file',
    sourceId: row.fileId,
    title: row.originalFileName,
    resident: row.clientMatch.name || undefined,
    excerpt: shortExcerpt(`${row.category.replace(/_/g, ' ')} source routed to ${row.targetScreen}. Parse status: ${row.parseStatus}.${reason}`),
    confidence: clampConfidence(row.classificationConfidence),
    reviewState: evidenceReviewStateFromParse(row),
    usedForOutput: false,
  };
}

export function evidenceFromVaultDoc(doc: VaultDoc, resident?: string): EvidenceItem {
  return {
    id: `ev-vault-${doc.id}`,
    sourceType: 'vault_document',
    sourceId: doc.id,
    title: doc.sourceFileName || doc.name,
    resident,
    date: doc.uploadedAt,
    excerpt: shortExcerpt(doc.text || `${doc.category || 'document'} source attached to vault.`),
    confidence: clampConfidence(doc.classificationConfidence, doc.parseStatus === 'PARSED' ? 0.75 : 0.45),
    reviewState: evidenceReviewStateFromParse(doc),
    usedForOutput: false,
  };
}

export function evidenceFromClientOnboarding(client: FullClient): EvidenceItem[] {
  const packEvidence = (client.packImports || []).flatMap(pack => pack.manifestRows.map(evidenceFromPackManifestRow));
  const vaultEvidence = (client.vaultDocs || []).map(doc => evidenceFromVaultDoc(doc, client.name));
  return [...packEvidence, ...vaultEvidence];
}

export function buildClientPackReviewQueue(clients: FullClient[]): ClientPackReviewQueueRow[] {
  return clients
    .flatMap(client => (client.packImports || [])
      .filter(pack => (pack.filesTotal || pack.manifestRows?.length || 0) > 0)
      .map(pack => {
      const liveGate = client.liveGateSummary;
      const needsReviewCount = pack.manifestRows.filter(row => row.reviewRequired).length;
      const blockedReasons = liveGate?.blockedReasons?.length
        ? liveGate.blockedReasons
        : (liveGate?.missingGates || []).map(gate => gate.detail);
      const missingCriticalEvidence = Array.from(new Set(blockedReasons.filter(Boolean)));
      const nextAction: ClientPackReviewQueueRow['nextAction'] =
        !pack.candidateClientId && !pack.candidateClientName ? 'Resolve identity'
          : needsReviewCount > 0 ? 'Review manifest'
            : liveGate && !liveGate.liveReady ? 'Resolve live gates'
              : 'Ready for manager sign-off';

      return {
        clientId: client.id,
        clientName: client.name || pack.candidateClientName || 'Draft client',
        packId: pack.packId,
        packSourceName: pack.sourceName,
        onboardingStatus: client.onboardingStatus || pack.status,
        parsedFiles: pack.filesParsed,
        totalFiles: pack.filesTotal,
        needsReviewCount,
        missingCriticalEvidence,
        blockedReasons,
        nextAction,
        liveReady: !!liveGate?.liveReady,
      };
    }))
    .filter(row => row.needsReviewCount > 0 || row.blockedReasons.length > 0 || !row.liveReady)
    .sort((a, b) =>
      Number(a.liveReady) - Number(b.liveReady) ||
      b.needsReviewCount - a.needsReviewCount ||
      b.packId.localeCompare(a.packId)
    );
}

export function mapActionToOperationalState(action: Action): OperationalActionState {
  if (action.operationalState) return action.operationalState;
  if (action.closedWithEvidence) return 'closed_with_evidence';
  if (action.carryForward) return 'carry_forward';
  if (action.status === 'completed') return 'completed';
  if (action.status === 'blocked') {
    const text = `${action.title} ${action.description} ${action.tags.join(' ')}`.toLowerCase();
    if (includesAny(text, PROFESSIONAL_WORDS)) return 'waiting_professional';
    if (text.includes('staff')) return 'waiting_staff_feedback';
    if (text.includes('resident') || text.includes('client')) return 'waiting_resident_availability';
    return 'escalated';
  }
  if (action.status === 'in_progress') return 'in_progress';
  if (action.owner && action.owner !== 'Unassigned') return 'assigned';
  return 'not_started';
}

export function promoteActionCandidate(candidate: Action, options: {
  owner?: string;
  dueDate?: string;
  createdAt?: string;
  by?: string;
} = {}): Action {
  const createdAt = options.createdAt || new Date().toISOString();
  const owner = options.owner || candidate.owner || 'Manager review required';
  const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const evidence = candidate.sourceEvidence || [];
  const to = candidate.operationalState || 'not_started';
  return {
    ...candidate,
    id,
    owner,
    dueDate: options.dueDate ?? candidate.dueDate,
    createdAt,
    status: 'open',
    operationalState: to,
    stateHistory: [{
      id: `state-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      actionId: id,
      to,
      at: createdAt,
      by: options.by || owner,
      reason: 'Promoted from diary review evidence.',
      evidenceIds: evidence.map(item => item.id),
    }, ...(candidate.stateHistory || [])],
    sourceEvidence: evidence,
    carryForward: candidate.carryForward ?? true,
  };
}

export function evidenceFromEntry(entry: CareEntry): EvidenceItem {
  const reviewState = entry.entry.trim().length < 40 || includesAny(entry.entry, POOR_ENTRY_WORDS)
    ? 'review_required'
    : 'unreviewed';
  return {
    id: `ev-${entry.id}`,
    sourceType: 'diary_entry',
    sourceId: entry.id,
    title: `${entry.client || 'Unknown resident'} - ${entry.type || 'Diary entry'}`,
    resident: entry.client,
    house: entry.house,
    date: entry.date,
    excerpt: shortExcerpt(entry.entry),
    confidence: reviewState === 'review_required' ? 0.55 : 0.78,
    reviewState,
    usedForOutput: false,
  };
}

export interface DiaryReviewInput {
  weekData: WeekSummary | null;
  house?: string;
  resident?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface DiaryReviewResult {
  evidence: EvidenceItem[];
  residentSummaries: ResidentPeriodSummary[];
  actionCandidates: Action[];
  carryForwardHints: string[];
  weakEvidence: EvidenceItem[];
  missingEvidence: string[];
}

export function reviewDiaryEvidence(input: DiaryReviewInput): DiaryReviewResult {
  const sourceEntries = allEntries(input.weekData).filter(entry => {
    if (input.house && entry.house?.toLowerCase() !== input.house.toLowerCase()) return false;
    if (input.resident && entry.client?.toLowerCase() !== input.resident.toLowerCase()) return false;
    return inRange(entry, input.dateFrom, input.dateTo);
  });

  const evidence = sourceEntries.map(evidenceFromEntry);
  const grouped = new Map<string, CareEntry[]>();
  for (const entry of sourceEntries) {
    const key = entry.client || 'Unknown resident';
    grouped.set(key, [...(grouped.get(key) || []), entry]);
  }

  const residentSummaries: ResidentPeriodSummary[] = [];
  const actionCandidates: Action[] = [];
  const carryForwardHints: string[] = [];

  for (const [resident, entries] of grouped.entries()) {
    const summary: ResidentPeriodSummary = {
      resident,
      house: input.house || entries.find(e => e.house)?.house,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      entriesReviewed: entries.length,
      supportOffered: [],
      acceptedOrDeclined: [],
      activities: [],
      appointments: [],
      healthConcerns: [],
      incidents: [],
      refusals: [],
      poorEntries: [],
      openActionHints: [],
      evidenceIds: entries.map(entry => `ev-${entry.id}`),
    };

    for (const entry of entries) {
      const text = entry.entry || '';
      if (includesAny(text, SUPPORT_WORDS)) summary.supportOffered.push(shortExcerpt(text, 120));
      if (includesAny(text, REFUSAL_WORDS)) {
        summary.acceptedOrDeclined.push(shortExcerpt(text, 120));
        summary.refusals.push(shortExcerpt(text, 120));
      }
      if (includesAny(text, ACTIVITY_WORDS)) summary.activities.push(shortExcerpt(text, 120));
      if (includesAny(text, APPOINTMENT_WORDS)) summary.appointments.push(shortExcerpt(text, 120));
      if (entry.severity === 'red' || entry.severity === 'amber' || includesAny(text, INCIDENT_WORDS)) {
        summary.incidents.push(shortExcerpt(text, 120));
      }
      if (includesAny(text, HEALTH_WORDS)) summary.healthConcerns.push(shortExcerpt(text, 120));
      if (text.trim().length < 40 || includesAny(text, POOR_ENTRY_WORDS)) summary.poorEntries.push(shortExcerpt(text, 120));
      if (includesAny(text, ['follow up', 'chase', 'waiting', 'book', 'arrange', 'review', 'update'])) {
        summary.openActionHints.push(shortExcerpt(text, 120));
      }
    }

    const priority: ActionPriority = summary.incidents.length ? 'critical' : summary.healthConcerns.length ? 'high' : 'medium';
    for (const hint of summary.openActionHints.slice(0, 3)) {
      const evidenceItems = entries.map(evidenceFromEntry);
      actionCandidates.push({
        id: `candidate-${resident.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${actionCandidates.length}`,
        title: `Follow up ${resident}`,
        description: hint,
        house: summary.house || 'General',
        resident,
        owner: 'Manager review required',
        priority,
        status: 'open',
        operationalState: 'not_started',
        createdAt: new Date().toLocaleDateString('en-GB'),
        dueDate: '',
        sourceEntry: entries[0]?.id,
        sourceEvidence: evidenceItems,
        stateHistory: [],
        carryForward: true,
        tags: ['diary-review', 'evidence-linked'],
      });
      carryForwardHints.push(`${resident}: ${hint}`);
    }

    residentSummaries.push(summary);
  }

  const weakEvidence = evidence.filter(item => item.reviewState === 'review_required');
  const missingEvidence = [
    sourceEntries.length ? '' : 'No diary evidence found for this selection.',
    residentSummaries.length ? '' : 'No resident summaries can be generated until diary evidence is imported.',
  ].filter(Boolean);

  return { evidence, residentSummaries, actionCandidates, carryForwardHints, weakEvidence, missingEvidence };
}

export function buildWeeklyUpdateDraft(input: {
  resident: string;
  recipientType: OutputDraft['recipientType'];
  summary: ResidentPeriodSummary | null;
  evidence: EvidenceItem[];
  dateFrom?: string;
  dateTo?: string;
}): OutputDraft {
  const sourceEvidence = input.evidence
    .filter(item => !input.resident || item.resident === input.resident)
    .map(item => ({ ...item, usedForOutput: true }));
  const missingEvidence = [
    !input.summary ? 'No resident summary is available for this period.' : '',
    sourceEvidence.length === 0 ? 'No source diary evidence is attached to this draft.' : '',
    input.summary?.poorEntries.length ? `${input.summary.poorEntries.length} weak diary entries need review.` : '',
  ].filter(Boolean);

  const lines: string[] = [];
  lines.push(`${input.recipientType.toUpperCase()} UPDATE - ${input.resident}`);
  if (input.dateFrom || input.dateTo) lines.push(`Period: ${input.dateFrom || 'start'} to ${input.dateTo || 'today'}`);
  lines.push('');

  if (!input.summary) {
    lines.push('No reviewed evidence is available for this update yet.');
  } else {
    lines.push(`Entries reviewed: ${input.summary.entriesReviewed}`);
    if (input.summary.supportOffered.length) lines.push(`Support: ${input.summary.supportOffered[0]}`);
    if (input.summary.activities.length) lines.push(`Activity/community: ${input.summary.activities[0]}`);
    if (input.summary.appointments.length) lines.push(`Appointments/follow-up: ${input.summary.appointments[0]}`);
    if (input.summary.healthConcerns.length) lines.push(`Health: ${input.summary.healthConcerns[0]}`);
    if (input.summary.acceptedOrDeclined.length) lines.push(`Accepted/declined support: ${input.summary.acceptedOrDeclined[0]}`);
    if (input.summary.incidents.length) lines.push(`Concerns/escalations: ${input.summary.incidents[0]}`);
    if (!input.summary.supportOffered.length && !input.summary.activities.length && !input.summary.healthConcerns.length) {
      lines.push('No share-ready daily detail has been identified from the selected evidence.');
    }
  }

  if (input.recipientType !== 'family') {
    lines.push('');
    lines.push(`Source evidence retained internally: ${sourceEvidence.length} item(s).`);
  }
  lines.push('');
  lines.push('Review required before copying, sending, or logging externally.');

  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'weekly_update',
    recipientType: input.recipientType,
    resident: input.resident,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    text: lines.join('\n'),
    sourceEvidence,
    missingEvidence,
    reviewRequired: missingEvidence.length > 0 || sourceEvidence.some(item => item.reviewState !== 'reviewed'),
    createdAt: new Date().toISOString(),
  };
}

export function toNourishSafeText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\[[ xX]\]\s*/g, '')
    .replace(/[✅⚠️❌]/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter((line, idx, arr) => line || arr[idx - 1])
    .join('\n');
}

export function buildHouseDailyState(input: {
  weekData: WeekSummary | null;
  actions: Action[];
  house: string;
  dateLabel?: string;
}): HouseDailyState {
  const entries = allEntries(input.weekData).filter(entry => entry.house === input.house);
  const evidence = entries.map(evidenceFromEntry);
  const openActions = input.actions.filter(action => action.house === input.house && action.status !== 'completed');
  const waitingFeedback = openActions.filter(action => mapActionToOperationalState(action) === 'waiting_staff_feedback');
  const waitingProfessionals = openActions.filter(action => mapActionToOperationalState(action) === 'waiting_professional');
  const carryForwardItems = openActions.filter(action => action.carryForward || mapActionToOperationalState(action) === 'carry_forward');

  return {
    house: input.house,
    dateLabel: input.dateLabel || new Date().toLocaleDateString('en-GB'),
    residentCount: new Set(entries.map(entry => entry.client).filter(Boolean)).size,
    evidenceCount: evidence.length,
    openActions,
    waitingFeedback,
    waitingProfessionals,
    appointments: evidence.filter(item => includesAny(item.excerpt, APPOINTMENT_WORDS)),
    healthFollowUps: evidence.filter(item => includesAny(item.excerpt, HEALTH_WORDS)),
    escalationFlags: evidence.filter(item => includesAny(item.excerpt, INCIDENT_WORDS)),
    carryForwardItems,
    missingEvidence: evidence.length ? [] : ['No diary evidence is loaded for this house.'],
  };
}

export function buildHandoverDraft(input: {
  weekData: WeekSummary | null;
  actions: Action[];
  house: string;
  mode?: 'manager' | 'weekend' | 'resident' | 'senior';
  resident?: string;
}): OutputDraft {
  const review = reviewDiaryEvidence({ weekData: input.weekData, house: input.house, resident: input.resident });
  const openActions = input.actions.filter(action => action.house === input.house && action.status !== 'completed');
  const lines: string[] = [];
  lines.push(`${(input.mode || 'manager').toUpperCase()} HANDOVER - ${input.house.toUpperCase()}`);
  if (input.resident) lines.push(`Resident: ${input.resident}`);
  lines.push(`Generated: ${new Date().toLocaleString('en-GB')}`);
  lines.push('');
  lines.push('COMPLETED / REVIEWED TODAY');
  lines.push(review.evidence.length ? `${review.evidence.length} diary evidence item(s) reviewed.` : 'No diary evidence loaded.');
  lines.push('');
  lines.push('RESIDENT UPDATES');
  for (const summary of review.residentSummaries.slice(0, 8)) {
    const detail = summary.incidents[0] || summary.healthConcerns[0] || summary.supportOffered[0] || 'No significant pattern detected from selected evidence.';
    lines.push(`${summary.resident}: ${detail}`);
  }
  lines.push('');
  lines.push('OPEN ACTIONS');
  if (openActions.length) {
    for (const action of openActions.slice(0, 12)) {
      lines.push(`Action: ${action.title}`);
      lines.push(`Status: ${ACTION_STATE_LABELS[mapActionToOperationalState(action)]}`);
      if (action.owner) lines.push(`Owner: ${action.owner}`);
    }
  } else {
    lines.push('No open actions recorded for this house.');
  }
  lines.push('');
  lines.push('CARRY FORWARD');
  const carry = openActions.filter(action => action.carryForward || action.status === 'blocked' || action.status === 'overdue');
  lines.push(carry.length ? carry.map(action => `Carry forward: ${action.title}`).join('\n') : 'No carry-forward items recorded.');

  return {
    id: `handover-${Date.now()}`,
    type: 'handover',
    recipientType: input.mode === 'senior' ? 'audit' : 'internal',
    house: input.house,
    resident: input.resident,
    text: toNourishSafeText(lines.join('\n')),
    sourceEvidence: review.evidence.map(item => ({ ...item, usedForOutput: true })),
    missingEvidence: review.missingEvidence,
    reviewRequired: true,
    createdAt: new Date().toISOString(),
  };
}

function staffSafetyCategories(text: string): StaffSafetyCategory[] {
  const lower = text.toLowerCase();
  const categories: StaffSafetyCategory[] = [];
  if (/verbal|shout|swear|abusive language|verbally aggressive/.test(lower)) categories.push('verbal_aggression');
  if (/threat|threaten/.test(lower)) categories.push('threats');
  if (/hate|racist|homophobic|discriminatory|discrimination/.test(lower)) categories.push('hate_discriminatory_abuse');
  if (/physical|hit|punch|kick|assault|grabbed|pushed/.test(lower)) categories.push('physical_aggression');
  if (/property|damage|damaged|broken|smashed/.test(lower)) categories.push('property_damage');
  if (/object|weapon|knife|threw|used .* item/.test(lower)) categories.push('object_used');
  if (/left the property|left property|abscond|missing|left service/.test(lower)) categories.push('resident_left_property_heightened');
  if (/other residents|others affected|other people|members of the public/.test(lower)) categories.push('other_residents_affected');
  return Array.from(new Set(categories));
}

export function reviewStaffSafetyEvidence(input: {
  entries: CareEntry[];
  house?: string;
}): StaffSafetyReviewResult {
  const entries = input.house ? input.entries.filter(entry => entry.house === input.house) : input.entries;
  const evidence = entries.map(evidenceFromEntry);
  const categories = Array.from(new Set(entries.flatMap(entry => staffSafetyCategories(entry.entry))));
  const highRisk = entries.some(entry => entry.severity === 'red') || categories.some(category =>
    ['threats', 'physical_aggression', 'object_used', 'other_residents_affected'].includes(category)
  );
  const reviewRequired = categories.length > 0 || entries.some(entry => entry.severity === 'red' || entry.severity === 'amber');
  const decisionBoundary = 'This module guides review; it does not make safeguarding, police, or clinical decisions.';
  const house = input.house || entries[0]?.house || 'General';
  const firstEvidence = evidence[0];
  const actionCandidates: Action[] = reviewRequired ? [{
    id: `candidate-staff-safety-${Date.now()}`,
    title: `Review staff safety escalation${house ? ` - ${house}` : ''}`,
    description: categories.length
      ? `Review reported staff safety categories: ${categories.map(c => c.replace(/_/g, ' ')).join(', ')}.`
      : 'Review amber/red staff safety evidence.',
    house,
    owner: 'Manager review required',
    priority: highRisk ? 'critical' : 'high',
    status: 'open',
    operationalState: highRisk ? 'escalated' : 'not_started',
    createdAt: new Date().toLocaleDateString('en-GB'),
    dueDate: '',
    sourceEntry: firstEvidence?.sourceId,
    sourceEvidence: evidence,
    stateHistory: [],
    carryForward: true,
    tags: ['staff-safety', 'review-required', ...categories],
  }] : [];
  const lines = [
    `STAFF SAFETY REVIEW - ${house.toUpperCase()}`,
    '',
    `Evidence reviewed: ${evidence.length} item(s).`,
    `Detected categories: ${categories.length ? categories.map(category => category.replace(/_/g, ' ')).join(', ') : 'none detected'}.`,
    '',
    'Review prompts:',
    'Immediate danger considered:',
    'Management informed:',
    'Staff affected:',
    'Other residents affected:',
    'Support missed or delayed:',
    'Risk/PBS review needed:',
    'Professional update needed:',
    'Handover insert needed:',
    '',
    decisionBoundary,
  ];
  const outputDraft: OutputDraft = {
    id: `staff-safety-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'audit_summary',
    recipientType: 'internal',
    house,
    text: toNourishSafeText(lines.join('\n')),
    sourceEvidence: evidence.map(item => ({ ...item, usedForOutput: true })),
    missingEvidence: evidence.length ? [] : ['No staff safety evidence supplied for review.'],
    reviewRequired: true,
    createdAt: new Date().toISOString(),
  };

  return {
    evidence,
    categories,
    reviewRequired,
    decisionBoundary,
    actionCandidates,
    outputDraft,
    missingEvidence: outputDraft.missingEvidence,
  };
}
