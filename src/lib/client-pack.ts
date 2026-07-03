import type { ExtractedClientIdentity, NormalizedImportEnvelope } from './import-intelligence';
import type {
  ClientLiveGateSummary,
  PackFileCategory,
  PackFileManifestRow,
  PackImport,
  PackParseStatus,
  PackTargetScreen,
} from './client-store';
export { consolidateDuplicatePackClients } from './client-pack-consolidation';

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanText(value: string | undefined | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

const NON_PERSON_IDENTITY_TERMS = new Set([
  'admission',
  'assessment',
  'behaviour',
  'behavioural',
  'benefits',
  'care',
  'client',
  'contact',
  'details',
  'emergency',
  'finance',
  'financial',
  'health',
  'legal',
  'medication',
  'mental',
  'pack',
  'pbs',
  'plan',
  'positive',
  'profile',
  'report',
  'risk',
  'support',
  'tenancy',
  'welcome',
]);

function normalizedName(value: string | undefined | null) {
  return cleanText(value)
    .replace(/^(mr|mrs|ms|miss|mx|dr)\.?\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .trim();
}

function isPlausiblePersonName(value: string | undefined | null) {
  const normalized = normalizedName(value);
  if (!normalized) return false;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (words.some(word => NON_PERSON_IDENTITY_TERMS.has(word))) return false;
  if (words.some(word => word.length < 2)) return false;
  return true;
}

function rawTextContainsName(envelope: NormalizedImportEnvelope, name: string) {
  const raw = normalizedName(envelope.rawText);
  const candidate = normalizedName(name);
  return !!candidate && raw.includes(candidate);
}

export interface PackClientIdentityResolution {
  candidate: ExtractedClientIdentity | null;
  confidence: number;
  ambiguous: boolean;
  reason: string;
  rejectedNames: string[];
}

export function resolvePackClientIdentity(envelopes: NormalizedImportEnvelope[]): PackClientIdentityResolution {
  const rejectedNames = new Set<string>();
  const signals = new Map<string, {
    candidate: ExtractedClientIdentity;
    score: number;
    strongSignals: number;
    files: Set<string>;
  }>();

  const addSignal = (
    envelope: NormalizedImportEnvelope,
    candidate: ExtractedClientIdentity | undefined | null,
    score: number,
    strong: boolean,
  ) => {
    const name = cleanText(candidate?.name);
    if (!name) return;
    if (!isPlausiblePersonName(name)) {
      rejectedNames.add(name);
      return;
    }
    const key = normalizedName(name);
    const current = signals.get(key) || {
      candidate: { name },
      score: 0,
      strongSignals: 0,
      files: new Set<string>(),
    };
    current.score += score;
    current.strongSignals += strong ? 1 : 0;
    current.files.add(envelope.source.fileName);
    current.candidate = {
      name,
      preferredName: candidate?.preferredName || current.candidate.preferredName || name.split(/\s+/)[0],
      dob: candidate?.dob || current.candidate.dob,
      nhs: candidate?.nhs || current.candidate.nhs,
    };
    signals.set(key, current);
  };

  for (const envelope of envelopes) {
    const admissionIdentity = envelope.admission?.client;
    if (admissionIdentity?.name) {
      addSignal(envelope, admissionIdentity, admissionIdentity.dob || admissionIdentity.nhs ? 1 : 0.88, true);
    }

    if (envelope.contactDetails?.clientName) {
      addSignal(envelope, {
        name: envelope.contactDetails.clientName,
        preferredName: envelope.contactDetails.clientName.split(/\s+/)[0],
      }, 0.9, true);
    }

    for (const candidate of envelope.clientCandidates || []) {
      const hasIdentityAnchor = !!(candidate.dob || candidate.nhs);
      const appearsInText = rawTextContainsName(envelope, candidate.name || '');
      if (!hasIdentityAnchor && !appearsInText) {
        if (candidate.name) rejectedNames.add(cleanText(candidate.name));
        continue;
      }
      addSignal(envelope, candidate, hasIdentityAnchor ? 0.92 : 0.7, hasIdentityAnchor);
    }

    const diaryCounts = new Map<string, number>();
    for (const entry of envelope.diaryEntries || []) {
      const name = cleanText(entry.client);
      if (!isPlausiblePersonName(name)) {
        if (name) rejectedNames.add(name);
        continue;
      }
      diaryCounts.set(name, (diaryCounts.get(name) || 0) + 1);
    }
    for (const [name, count] of diaryCounts) {
      addSignal(envelope, { name }, Math.min(0.85, 0.55 + count * 0.05), count >= 3);
    }
  }

  const ranked = [...signals.values()].sort((a, b) =>
    b.strongSignals - a.strongSignals ||
    b.score - a.score ||
    b.files.size - a.files.size
  );
  const best = ranked[0];
  if (!best) {
    return {
      candidate: null,
      confidence: 0,
      ambiguous: false,
      reason: 'No identity was supported by document content or structured identity fields.',
      rejectedNames: [...rejectedNames],
    };
  }

  const second = ranked[1];
  const ambiguous = !!second &&
    best.strongSignals > 0 &&
    second.strongSignals > 0 &&
    second.score >= best.score * 0.85;
  if (ambiguous) {
    return {
      candidate: null,
      confidence: 0,
      ambiguous: true,
      reason: `Conflicting evidence-backed identities were found: ${best.candidate.name} and ${second.candidate.name}.`,
      rejectedNames: [...rejectedNames],
    };
  }

  const confidence = Math.min(0.99, Math.max(
    best.strongSignals > 0 ? 0.9 : 0.72,
    best.score / Math.max(1, best.files.size),
  ));
  return {
    candidate: best.candidate,
    confidence,
    ambiguous: false,
    reason: best.strongSignals > 0
      ? 'Identity resolved from structured document evidence.'
      : 'Identity resolved from repeated document content and requires review.',
    rejectedNames: [...rejectedNames],
  };
}

export function applyPackClientIdentity(
  envelopes: NormalizedImportEnvelope[],
  resolution = resolvePackClientIdentity(envelopes),
) {
  if (!resolution.candidate || resolution.ambiguous) {
    return envelopes.map(envelope => ({ ...envelope, clientCandidates: [] }));
  }
  return envelopes.map(envelope => ({
    ...envelope,
    clientCandidates: [
      { ...resolution.candidate! },
      ...(envelope.clientCandidates || []).filter(candidate =>
        normalizedName(candidate.name) === normalizedName(resolution.candidate?.name)
      ),
    ],
  }));
}

function haystack(envelope: NormalizedImportEnvelope, fileName: string) {
  return `${fileName} ${envelope.rawText || ''}`.toLowerCase().replace(/\s+/g, ' ');
}

function extOf(fileName: string, envelope?: NormalizedImportEnvelope) {
  return (envelope?.source.ext || fileName.split('.').pop() || '').toLowerCase();
}

export function inferPackFileCategory(envelope: NormalizedImportEnvelope, fileName = envelope.source.fileName): PackFileCategory {
  const ext = extOf(fileName, envelope);
  const h = haystack(envelope, fileName);

  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'profile_image';
  if (['vtt'].includes(ext) || /transcript|teams meeting|meeting transcript/.test(h)) return 'transcript';
  if (/screenshot|screen shot/.test(h) || (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) && /browser|web image|logo|icon/.test(h))) return 'screenshot';
  if (/removebg|stock|unsplash|facebook|instagram|whatsapp|decorative/.test(h)) return 'irrelevant';
  if (envelope.source.detectedType === 'contact-details' || h.includes('contact details')) return 'contact_details';
  if (envelope.source.detectedType === 'roster') return 'roster';
  if (envelope.source.detectedType === 'diary') return 'diary';
  if (/care\s*plan/.test(h) && !/emergency admission|admission pack|admisssion pack/.test(h)) return 'care_plan';
  if (/emergency admission|admission pack|admisssion pack/.test(h)) return 'admission';
  if (/positive behaviour|positive behavioural|pbs\b|behaviour support/.test(h)) return 'pbs';
  if (envelope.source.detectedType === 'support-plan') return 'support_plan';
  if (/mental health act|section 117|section 2|section 3|mha\b/.test(h)) return 'mental_health_legal';
  if (/medication|medicine|mar chart|administration support/.test(h)) return 'medication';
  if (/financial|finance|benefit|money|appointee/.test(h)) return 'finance';
  if (/tenancy|licence agreement|placement agreement/.test(h)) return 'tenancy';
  if (/welcome letter|welcome pack/.test(h)) return 'welcome_admin';
  if (/clinical risk assessment|risk compatibility|risk assessment|risk area \d+|risk control protocol/.test(h)) return 'risk';
  if (envelope.source.detectedType === 'admission') return 'admission';
  return 'unknown';
}

export function targetScreenForCategory(category: PackFileCategory): PackTargetScreen {
  switch (category) {
    case 'contact_details': return 'Care Circle';
    case 'risk': return 'Risk/PBS';
    case 'pbs': return 'Risk/PBS';
    case 'care_plan':
    case 'support_plan':
    case 'admission': return 'Care Plan';
    case 'medication': return 'Medication';
    case 'finance':
    case 'tenancy':
    case 'mental_health_legal': return 'Finance/Legal';
    case 'diary': return 'Task Packs';
    case 'transcript': return 'Review Queue';
    case 'screenshot': return 'Review Queue';
    case 'irrelevant': return 'Review Queue';
    case 'roster': return 'Client Records';
    case 'profile_image':
    case 'welcome_admin': return 'Client Records';
    case 'unknown': return 'Review Queue';
    default: return 'Unknown';
  }
}

function extractedFieldsCount(envelope: NormalizedImportEnvelope): number {
  let count = 0;
  if (envelope.admission) {
    const client = envelope.admission.client;
    count += [client.name, client.preferredName, client.dob, client.nhs, client.address, client.phone].filter(Boolean).length;
    count += envelope.admission.carePlan?.domains?.filter(d => d.enabled || d.identifiedNeed || d.howToAchieve).length || 0;
    count += envelope.admission.client.risk?.risks?.filter(r => r.title || r.description).length || 0;
  }
  count += envelope.supportPlan?.needs?.filter(n => n.area || n.howToSupport || n.risks).length || 0;
  count += envelope.contactDetails?.contacts?.length || 0;
  count += envelope.diaryEntries?.length || 0;
  count += envelope.shifts?.length || 0;
  return count;
}

function parseStatusFor(envelope: NormalizedImportEnvelope, category: PackFileCategory, fileName: string): PackParseStatus {
  const ext = extOf(fileName, envelope);
  const text = cleanText(envelope.rawText);
  if (envelope.warnings.some(w => /timed out|failed/i.test(w))) return 'FAILED';
  if (category === 'profile_image') return 'ATTACHED_ONLY';
  if (!text && ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'xlsm'].includes(ext)) return 'OCR_REQUIRED';
  if (!text) return 'ATTACHED_ONLY';
  if (category === 'unknown' || category === 'transcript' || category === 'screenshot' || category === 'irrelevant') return 'ATTACHED_ONLY';
  if (['finance', 'tenancy', 'mental_health_legal', 'medication', 'welcome_admin'].includes(category)) return 'ATTACHED_ONLY';
  if (category === 'contact_details') return envelope.contactDetails?.contacts?.length ? 'PARSED' : 'PARTIAL';
  if (category === 'support_plan' || category === 'pbs') return envelope.supportPlan?.needs?.length ? 'PARSED' : 'PARTIAL';
  return extractedFieldsCount(envelope) > 0 || text.length > 20 ? 'PARSED' : 'PARTIAL';
}

function rejectedReasonsFor(envelope: NormalizedImportEnvelope, category: PackFileCategory, status: PackParseStatus): string[] {
  const reasons = [...envelope.warnings];
  if (category === 'unknown') reasons.push('Document category could not be confidently identified.');
  if (category === 'irrelevant') reasons.push('File appears unrelated to client onboarding evidence and is excluded from generated outputs until reviewed.');
  if (category === 'screenshot') reasons.push('Screenshot/image evidence is preserved but not used for automated conclusions until reviewed.');
  if (category === 'transcript') reasons.push('Transcript detected; manager review is required before using it as care evidence.');
  if (status === 'OCR_REQUIRED') reasons.push('No extractable text was found; OCR or manual review is required.');
  if (status === 'ATTACHED_ONLY') reasons.push('Attached to the client vault but excluded from automated conclusions until review.');
  if (status === 'PARTIAL') reasons.push('Only partial structured evidence was extracted; manager review is required.');
  return Array.from(new Set(reasons.map(cleanText).filter(Boolean)));
}

export function buildPackFileManifestRow(input: {
  packId: string;
  envelope: NormalizedImportEnvelope;
  fileName: string;
  fileId?: string;
  clientId?: string | null;
  clientName?: string | null;
  clientConfidence?: number;
  matchReason?: string;
  sizeBytes?: number;
}): PackFileManifestRow {
  const category = inferPackFileCategory(input.envelope, input.fileName);
  const parseStatus = parseStatusFor(input.envelope, category, input.fileName);
  const reasons = rejectedReasonsFor(input.envelope, category, parseStatus);
  const reviewRequired =
    parseStatus !== 'PARSED' ||
    ['contact_details', 'profile_image', 'finance', 'tenancy', 'mental_health_legal', 'medication', 'welcome_admin', 'unknown'].includes(category);
  const candidate = input.envelope.clientCandidates?.[0];
  const clientName = input.clientName || candidate?.name || null;

  return {
    fileId: input.fileId || id('file'),
    packId: input.packId,
    originalFileName: input.fileName,
    fileType: extOf(input.fileName, input.envelope),
    sizeBytes: input.sizeBytes ?? input.envelope.source.sizeBytes ?? cleanText(input.envelope.rawText).length,
    category,
    classificationConfidence: input.envelope.source.confidence || (category === 'unknown' ? 0.2 : 0.65),
    parseStatus,
    targetScreen: targetScreenForCategory(category),
    clientMatch: {
      clientId: input.clientId || null,
      name: clientName,
      confidence: input.clientConfidence ?? (clientName ? 0.72 : 0),
      matchReason: input.matchReason || (clientName ? 'Candidate identity inferred from source document.' : 'No client identity found.'),
    },
    extractedFieldsCount: extractedFieldsCount(input.envelope),
    evidenceLinksCreated: parseStatus === 'PARSED' ? Math.max(1, extractedFieldsCount(input.envelope)) : 0,
    reviewRequired,
    rejectedReasons: reasons,
    vaultAttachmentStatus: parseStatus === 'FAILED' || parseStatus === 'SKIPPED_WITH_REASON' ? 'not_attached' : 'attached',
  };
}

export function buildPackImport(input: {
  packId: string;
  sourceName: string;
  rows: PackFileManifestRow[];
  candidateClientId?: string | null;
  candidateClientName?: string | null;
  identityConfidence?: number;
  uploadedBy?: string;
  auditEventIds?: string[];
  sourceType?: PackImport['sourceType'];
}): PackImport {
  const filesParsed = input.rows.filter(r => r.parseStatus === 'PARSED').length;
  const filesFailed = input.rows.filter(r => r.parseStatus === 'FAILED' || r.parseStatus === 'SKIPPED_WITH_REASON').length;
  const filesNeedsReview = input.rows.filter(r => r.reviewRequired).length;
  const filesAttached = input.rows.filter(r => !['PARSED', 'FAILED', 'SKIPPED_WITH_REASON'].includes(r.parseStatus)).length;
  const hasCandidate = !!(input.candidateClientId || input.candidateClientName);
  return {
    packId: input.packId,
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy || 'local-session',
    sourceName: input.sourceName,
    sourceType: input.sourceType || (input.sourceName.toLowerCase().endsWith('.zip') ? 'zip' : 'single-file'),
    status: filesFailed === input.rows.length && input.rows.length > 0 ? 'FAILED' : hasCandidate ? 'DRAFT_CLIENT' : 'PACK_RECEIVED',
    candidateClientId: input.candidateClientId || null,
    candidateClientName: input.candidateClientName || null,
    identityConfidence: input.identityConfidence ?? (hasCandidate ? 0.7 : 0),
    filesTotal: input.rows.length,
    filesParsed,
    filesAttached,
    filesFailed,
    filesNeedsReview,
    manifestRows: input.rows,
    auditEventIds: input.auditEventIds || [],
  };
}

export function clientLiveGateSummary(input: {
  identityReviewed: boolean;
  hasCarePlanSource: boolean;
  riskReviewed: boolean;
  contactsReviewed: boolean;
  unresolvedFiles: number;
  consentBoundariesReviewed?: boolean;
  hasRiskSource?: boolean;
  hasPbsSource?: boolean;
  hasMedicationSource?: boolean;
  financeLegalReviewed?: boolean;
  unknownDocumentsReviewedOrDeferred?: boolean;
}): ClientLiveGateSummary {
  const consentBoundariesReviewed = input.consentBoundariesReviewed ?? input.contactsReviewed;
  const hasRiskSource = input.hasRiskSource ?? input.riskReviewed;
  const hasPbsSource = input.hasPbsSource ?? input.riskReviewed;
  const hasMedicationSource = input.hasMedicationSource ?? false;
  const financeLegalReviewed = input.financeLegalReviewed ?? false;
  const unknownDocumentsReviewedOrDeferred = input.unknownDocumentsReviewedOrDeferred ?? input.unresolvedFiles === 0;
  const gates = [
    {
      id: 'identity',
      label: 'Identity reviewed',
      status: input.identityReviewed ? 'passed' as const : 'blocked' as const,
      detail: input.identityReviewed ? 'Core identity has been manager reviewed.' : 'Confirm name, DOB, NHS/person ID, and duplicate/merge decision.',
    },
    {
      id: 'care-plan',
      label: 'Care/support plan source',
      status: input.hasCarePlanSource ? 'passed' as const : 'review' as const,
      detail: input.hasCarePlanSource ? 'Care/support plan evidence is present.' : 'Attach a current care/support plan or record an explicit missing-plan reason.',
    },
    {
      id: 'risk',
      label: 'Risk state reviewed',
      status: input.riskReviewed ? 'passed' as const : 'blocked' as const,
      detail: input.riskReviewed ? 'Risk state has been reviewed.' : 'Review risk/PBS evidence before live operational use.',
    },
    {
      id: 'contacts',
      label: 'Contacts and consent reviewed',
      status: input.contactsReviewed && consentBoundariesReviewed ? 'passed' as const : 'blocked' as const,
      detail: input.contactsReviewed && consentBoundariesReviewed ? 'Contacts and sharing boundaries are reviewed.' : 'Verify contacts, consent basis, restrictions, and sharing boundaries.',
    },
    {
      id: 'files',
      label: 'Pack review items resolved',
      status: input.unresolvedFiles === 0 ? 'passed' as const : 'blocked' as const,
      detail: input.unresolvedFiles === 0 ? 'No unresolved pack files remain.' : `${input.unresolvedFiles} imported file${input.unresolvedFiles === 1 ? '' : 's'} still need review.`,
    },
  ];
  const missingGates = gates.filter(gate => gate.status !== 'passed');
  return {
    liveReady: gates.every(gate => gate.status === 'passed'),
    gates,
    missingGates,
    blockedReasons: missingGates.map(gate => gate.detail),
    openReviewItems: input.unresolvedFiles,
    identityReviewed: input.identityReviewed,
    contactsReviewed: input.contactsReviewed,
    consentBoundariesReviewed,
    careSupportPlanSource: input.hasCarePlanSource ? 'present' : 'missing',
    riskSource: hasRiskSource ? 'present' : 'missing',
    pbsSource: hasPbsSource ? 'present' : 'missing',
    medicationSource: hasMedicationSource ? 'present' : 'missing',
    financeLegalReviewed,
    unknownDocumentsReviewedOrDeferred,
  };
}
