import { logAuditAction } from './audit';

export type MedicationCapability =
  | 'medicines.view'
  | 'medicines.manage_profile'
  | 'medicines.record_outcome'
  | 'medicines.review_mar'
  | 'medicines.audit'
  | 'medicines.export'
  | 'medicines.view_exceptions';

export interface MedicationScope {
  organisationId?: string;
  service?: string;
  house?: string;
  residentId?: string;
  expiresAt?: string;
}

export interface MedicationCompetency {
  current: boolean;
  expiresAt?: string;
  assessor?: string;
}

export interface MedicationAccessProfile {
  userId: string;
  displayTitle?: string;
  capabilities: MedicationCapability[];
  scopes: MedicationScope[];
  medicationCompetency: MedicationCompetency;
  currentAssignments?: Array<{
    house: string;
    residentId?: string;
    roundId?: string;
  }>;
}

export type MedicineOrderStatus =
  | 'draft'
  | 'pending_verification'
  | 'active'
  | 'temporarily_held'
  | 'superseded'
  | 'discontinued';

export type MARStaffOutcome =
  | 'administered'
  | 'supported_taken'
  | 'prompted_taken'
  | 'refused'
  | 'declined_after_prompt'
  | 'missed'
  | 'not_available'
  | 'withheld_by_instruction'
  | 'self_administered'
  | 'hospital_leave';

export type MARSystemStatus =
  | 'due'
  | 'overdue'
  | 'recorded_late'
  | 'no_outcome_recorded'
  | 'recorded_outside_window'
  | 'duplicate_attempt'
  | 'awaiting_effect_review'
  | 'recorded'
  | 'review_required';

export type MARLifecycleState =
  | 'cancelled_due_to_order_change'
  | 'cancelled_due_to_duplicate'
  | 'cancelled_due_to_schedule_correction'
  | 'voided_after_review';

export type MARReviewState = 'unreviewed' | 'review_required' | 'reviewed' | 'deferred';

export interface MedicationAllergy {
  substance: string;
  reaction: string;
  severity: 'standard' | 'significant' | 'critical';
}

export interface MedicationProfile {
  id: string;
  residentId: string;
  residentName: string;
  dateOfBirth: string;
  house: string;
  allergies: MedicationAllergy[];
  createdAt: string;
  updatedAt: string;
  reviewState: MARReviewState;
}

export interface MedicineSchedule {
  kind: 'fixed_times';
  times: string[];
  windowMinutesBefore?: number;
  windowMinutesAfter?: number;
}

export interface MedicineOrderVersion {
  id: string;
  orderId: string;
  residentId: string;
  medicineName: string;
  formulation: string;
  strength: string;
  dose: string;
  route: string;
  schedule: MedicineSchedule;
  instructions: string;
  status: MedicineOrderStatus;
  authorisationSourceType: 'pharmacy_label' | 'mar_chart' | 'discharge_summary' | 'gp_instruction' | 'prescription' | 'other';
  authorisationEvidenceId: string;
  authorisedByExternalProfessional: string;
  sourceReceivedAt: string;
  verifiedBy: string;
  verifiedAt: string;
  effectiveFrom: string;
  effectiveTo?: string;
  reviewDate?: string;
  activationMeaning?: 'authorised_instructions_verified_not_clinically_approved';
  createdAt: string;
  updatedAt: string;
}

export interface MedicineOrder {
  id: string;
  residentId: string;
  currentVersionId?: string;
  versions: MedicineOrderVersion[];
}

export interface MARCorrectionEvent {
  id: string;
  eventId: string;
  by: string;
  at: string;
  reason: string;
  originalOutcome: MARStaffOutcome | null;
  correctedOutcome: MARStaffOutcome;
  originalSupportedOrAdministeredAt?: string;
  correctedSupportedOrAdministeredAt: string;
  originalRecordedAt?: string;
  correctedRecordedAt: string;
}

export interface MARAdministrationEvent {
  id: string;
  residentId: string;
  medicineOrderVersionId: string;
  scheduledFor: string;
  scheduledWindowStart: string;
  scheduledWindowEnd: string;
  supportedOrAdministeredAt?: string;
  recordedAt?: string;
  recordedBy?: string;
  outcome: MARStaffOutcome | null;
  status: MARSystemStatus | MARLifecycleState;
  reason: string;
  notes: string;
  evidenceIds: string[];
  reviewState: MARReviewState;
  eventVersion: number;
  idempotencyKey?: string;
  recordingStartedBy?: string;
  recordingStartedAt?: string;
  finalisedAt?: string;
  finalisedBy?: string;
  relatedRecordType?: string;
  relatedRecordId?: string;
  externalAdministration?: boolean;
  externalProfessional?: string;
  crossReferenceNote?: string;
  correctionHistory: MARCorrectionEvent[];
  selfAdministrationAssessmentId?: string;
  selfAdministrationAuthorised?: boolean;
  assessmentReviewDate?: string;
  supportLevel?: string;
  storageArrangement?: string;
  prnProtocolId?: string;
  prnReason?: string;
  effectReviewDueAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MARChartPeriod {
  id: string;
  residentId: string;
  residentName: string;
  date: string;
  createdAt: string;
  events: MARAdministrationEvent[];
}

export interface MedicationException {
  id: string;
  type:
    | 'overdue'
    | 'no_outcome_recorded'
    | 'recorded_late'
    | 'recorded_outside_window'
    | 'refusal_recorded'
    | 'repeated_refusal'
    | 'medicine_review_overdue'
    | 'duplicate_attempt'
    | 'self_administration_unsupported';
  severity: 'info' | 'review' | 'urgent';
  message: string;
  residentId?: string;
  medicineOrderVersionId?: string;
  eventId?: string;
  status: 'raised' | 'assigned' | 'under_review' | 'resolved' | 'deferred';
  createdAt: string;
  evidenceIds: string[];
}

export interface MedicationChangeRequest {
  id: string;
  residentId: string;
  sourceType: MedicineOrderVersion['authorisationSourceType'];
  sourceReceivedAt: string;
  sourceDocumentId: string;
  recordedBy: string;
  secondCheckedBy?: string;
  effectiveFrom: string;
  affectedFutureEventIds: string[];
  reviewStatus: 'pending' | 'verified' | 'rejected';
  proposedVersion?: MedicineOrderVersion;
  activatedVersion?: MedicineOrderVersion;
  activatedAt?: string;
}

export interface MedicationAuditSession {
  id: string;
  residentId: string;
  dateFrom: string;
  dateTo: string;
  reviewedBy: string;
  reviewedAt: string;
  exceptionIds: string[];
  outcomeCounts: Record<string, number>;
}

export interface MedicationEvidenceImport {
  id: string;
  sourceName: string;
  sourceType: 'nourish_mar_html' | 'medication_audit_pdf' | 'external_mar' | 'pharmacy_label';
  receivedAt: string;
  extractedFields: string[];
  excerpt: string;
  confidence: number;
  reviewState: MARReviewState;
  createsActiveOrder: false;
}

export interface PRNProtocol {
  id: string;
  medicineOrderVersionId: string;
  indication: string;
  dose: string;
  route: string;
  minimumIntervalHours: number;
  maxAdministrationsPer24h: number;
  actionsBeforeAdministration: string[];
  effectReviewMinutes: number;
  escalationInstructions: string;
  reviewDate: string;
  authorisedEvidenceId: string;
}

export interface MedicationDowntimeProcedure {
  label: string;
  summary: string;
  emergencyPrintAvailable: boolean;
}

export interface MedicationState {
  profiles: MedicationProfile[];
  orders: MedicineOrder[];
  orderVersions: MedicineOrderVersion[];
  chartPeriods: MARChartPeriod[];
  events: MARAdministrationEvent[];
  exceptions: MedicationException[];
  evidence: MedicationEvidenceImport[];
}

const STORAGE_KEY = 'hc-medication-mar-state-v1';
const NON_STANDARD_REASON_REQUIRED: MARStaffOutcome[] = [
  'refused',
  'declined_after_prompt',
  'missed',
  'not_available',
  'withheld_by_instruction',
  'hospital_leave',
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoNow() {
  return new Date().toISOString();
}

function safeAudit(action: Parameters<typeof logAuditAction>[0], details: string, metadata?: Record<string, unknown>) {
  try {
    logAuditAction(action, details, metadata);
  } catch {
    // Audit writes should not prevent MAR safety records from being produced.
  }
}

function parseIso(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function addMinutes(iso: string, minutes: number) {
  return new Date(parseIso(iso) + minutes * 60_000).toISOString();
}

function dateTimeUtc(date: string, hhmm: string) {
  return `${date}T${hhmm.length === 5 ? hhmm : '00:00'}:00.000Z`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function csvEscape(value: unknown) {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function requiresReason(outcome: MARStaffOutcome) {
  return NON_STANDARD_REASON_REQUIRED.includes(outcome);
}

function statusForRecordedEvent(event: MARAdministrationEvent, outcome: MARStaffOutcome, recordedAt: string) {
  if (outcome === 'hospital_leave') return 'recorded' as const;
  if (parseIso(recordedAt) > parseIso(event.scheduledWindowEnd)) return 'recorded_late' as const;
  if (parseIso(recordedAt) < parseIso(event.scheduledWindowStart)) return 'recorded_outside_window' as const;
  return 'recorded' as const;
}

export function createMedicationProfile(input: {
  id?: string;
  residentId: string;
  residentName: string;
  dateOfBirth: string;
  house: string;
  allergies?: MedicationAllergy[];
  createdAt?: string;
}): MedicationProfile {
  const createdAt = input.createdAt || isoNow();
  const profile: MedicationProfile = {
    id: input.id || uid('med-profile'),
    residentId: input.residentId,
    residentName: input.residentName,
    dateOfBirth: input.dateOfBirth,
    house: input.house,
    allergies: input.allergies || [],
    createdAt,
    updatedAt: createdAt,
    reviewState: 'unreviewed',
  };
  safeAudit('medication_profile_created', 'Medication profile created.', { residentId: profile.residentId });
  return profile;
}

export function createMedicineOrderVersion(input: {
  id?: string;
  orderId?: string;
  residentId: string;
  medicineName: string;
  formulation: string;
  strength: string;
  dose: string;
  route: string;
  schedule: MedicineSchedule;
  instructions?: string;
  status?: MedicineOrderStatus;
  authorisationSourceType: MedicineOrderVersion['authorisationSourceType'];
  authorisationEvidenceId: string;
  authorisedByExternalProfessional: string;
  sourceReceivedAt: string;
  verifiedBy: string;
  verifiedAt: string;
  effectiveFrom: string;
  effectiveTo?: string;
  reviewDate?: string;
  createdAt?: string;
}): MedicineOrderVersion {
  const createdAt = input.createdAt || isoNow();
  return {
    id: input.id || uid('medicine-order-version'),
    orderId: input.orderId || uid('medicine-order'),
    residentId: input.residentId,
    medicineName: input.medicineName,
    formulation: input.formulation,
    strength: input.strength,
    dose: input.dose,
    route: input.route,
    schedule: {
      kind: 'fixed_times',
      times: [...input.schedule.times],
      windowMinutesBefore: input.schedule.windowMinutesBefore ?? 0,
      windowMinutesAfter: input.schedule.windowMinutesAfter ?? 60,
    },
    instructions: input.instructions || '',
    status: input.status || 'pending_verification',
    authorisationSourceType: input.authorisationSourceType,
    authorisationEvidenceId: input.authorisationEvidenceId,
    authorisedByExternalProfessional: input.authorisedByExternalProfessional,
    sourceReceivedAt: input.sourceReceivedAt,
    verifiedBy: input.verifiedBy,
    verifiedAt: input.verifiedAt,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    reviewDate: input.reviewDate,
    createdAt,
    updatedAt: createdAt,
  };
}

export function activateMedicineOrderVersion(version: MedicineOrderVersion): MedicineOrderVersion {
  if (!version.authorisationEvidenceId) {
    throw new Error('Authorisation evidence is required before activating a medicine order.');
  }
  if (!version.verifiedBy || !version.verifiedAt) {
    throw new Error('Medicine order activation requires verification by the service.');
  }
  const active: MedicineOrderVersion = {
    ...version,
    status: 'active',
    activationMeaning: 'authorised_instructions_verified_not_clinically_approved',
    updatedAt: isoNow(),
  };
  safeAudit('medication_order_verified', 'Authorised medicine instructions verified and activated.', {
    residentId: active.residentId,
    orderVersionId: active.id,
    authorisationSourceType: active.authorisationSourceType,
  });
  return active;
}

export function generateMARChartPeriod(input: {
  profile: MedicationProfile;
  activeOrderVersions: MedicineOrderVersion[];
  date: string;
  createdAt?: string;
}): MARChartPeriod {
  const createdAt = input.createdAt || isoNow();
  const startOfDay = `${input.date}T00:00:00.000Z`;
  const endOfDay = `${input.date}T23:59:59.999Z`;
  const events = input.activeOrderVersions
    .filter(order =>
      order.status === 'active' &&
      parseIso(order.effectiveFrom) <= parseIso(endOfDay) &&
      (!order.effectiveTo || parseIso(order.effectiveTo) >= parseIso(startOfDay))
    )
    .flatMap(order => order.schedule.times.map(time => {
      const scheduledFor = dateTimeUtc(input.date, time);
      const before = order.schedule.windowMinutesBefore ?? 0;
      const after = order.schedule.windowMinutesAfter ?? 60;
      const id = `mar-${input.profile.residentId}-${order.id}-${input.date}-${time}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const event: MARAdministrationEvent = {
        id,
        residentId: input.profile.residentId,
        medicineOrderVersionId: order.id,
        scheduledFor,
        scheduledWindowStart: addMinutes(scheduledFor, -before),
        scheduledWindowEnd: addMinutes(scheduledFor, after),
        outcome: null,
        status: 'due',
        reason: '',
        notes: '',
        evidenceIds: [order.authorisationEvidenceId].filter(Boolean),
        reviewState: 'unreviewed',
        eventVersion: 1,
        correctionHistory: [],
        createdAt,
        updatedAt: createdAt,
      };
      return event;
    }));

  const chart: MARChartPeriod = {
    id: `mar-chart-${input.profile.residentId}-${input.date}`,
    residentId: input.profile.residentId,
    residentName: input.profile.residentName,
    date: input.date,
    createdAt,
    events,
  };
  safeAudit('mar_schedule_generated', 'MAR schedule generated from active authorised medicine orders.', {
    residentId: chart.residentId,
    date: chart.date,
    eventCount: chart.events.length,
  });
  return chart;
}

export function startMARRecording(event: MARAdministrationEvent, input: {
  by: string;
  at: string;
  expectedEventVersion: number;
}): MARAdministrationEvent {
  if (event.eventVersion !== input.expectedEventVersion) {
    throw new Error('Stale MAR event version cannot overwrite a newer record.');
  }
  if (event.recordingStartedBy && !event.finalisedAt && event.recordingStartedBy !== input.by) {
    throw new Error(`MAR event is already being recorded by ${event.recordingStartedBy}.`);
  }
  const started = {
    ...event,
    recordingStartedBy: input.by,
    recordingStartedAt: input.at,
    eventVersion: event.eventVersion + 1,
    updatedAt: input.at,
  };
  safeAudit('mar_recording_started', 'Medication outcome recording started.', {
    eventId: event.id,
    by: input.by,
  });
  return started;
}

export function recordMAROutcome(event: MARAdministrationEvent, input: {
  outcome: MARStaffOutcome;
  supportedOrAdministeredAt: string;
  recordedAt: string;
  recordedBy: string;
  reason: string;
  notes?: string;
  evidenceIds?: string[];
  idempotencyKey: string;
  expectedEventVersion: number;
}): MARAdministrationEvent {
  if (event.finalisedAt && event.idempotencyKey === input.idempotencyKey) return event;
  if (event.eventVersion !== input.expectedEventVersion) {
    throw new Error('Stale MAR event version cannot overwrite a newer record.');
  }
  if (event.finalisedAt) {
    throw new Error('Only one active final outcome is allowed per MAR event.');
  }
  if (event.recordingStartedBy && event.recordingStartedBy !== input.recordedBy) {
    throw new Error(`MAR event is already being recorded by ${event.recordingStartedBy}.`);
  }
  if (requiresReason(input.outcome) && !input.reason.trim()) {
    throw new Error(`Reason is required for ${input.outcome} medication outcomes.`);
  }
  if (input.outcome === 'self_administered') {
    const reviewDateOk = event.assessmentReviewDate ? parseIso(`${event.assessmentReviewDate}T23:59:59.999Z`) >= parseIso(input.recordedAt) : false;
    if (!event.selfAdministrationAssessmentId || !event.selfAdministrationAuthorised || !reviewDateOk) {
      throw new Error('Self-administration requires a current authorised assessment.');
    }
  }
  const status = statusForRecordedEvent(event, input.outcome, input.recordedAt);
  const reviewRequired = input.outcome !== 'administered' && input.outcome !== 'supported_taken' && input.outcome !== 'prompted_taken' && input.outcome !== 'self_administered';
  const recorded: MARAdministrationEvent = {
    ...event,
    outcome: input.outcome,
    supportedOrAdministeredAt: input.supportedOrAdministeredAt,
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
    status,
    reason: input.reason.trim(),
    notes: input.notes || '',
    evidenceIds: Array.from(new Set([...(event.evidenceIds || []), ...(input.evidenceIds || [])])),
    reviewState: reviewRequired ? 'review_required' : 'unreviewed',
    idempotencyKey: input.idempotencyKey,
    finalisedAt: input.recordedAt,
    finalisedBy: input.recordedBy,
    eventVersion: event.eventVersion + 1,
    updatedAt: input.recordedAt,
  };
  safeAudit('mar_outcome_recorded', 'Medication MAR outcome recorded with staff confirmation.', {
    eventId: recorded.id,
    residentId: recorded.residentId,
    outcome: recorded.outcome,
    status: recorded.status,
  });
  return recorded;
}

export function createMARCorrection(event: MARAdministrationEvent, input: {
  by: string;
  at: string;
  reason: string;
  correctedOutcome: MARStaffOutcome;
  correctedSupportedOrAdministeredAt: string;
  correctedRecordedAt: string;
}): MARAdministrationEvent {
  if (!input.reason.trim()) throw new Error('MAR correction reason is required.');
  const correction: MARCorrectionEvent = {
    id: uid('mar-correction'),
    eventId: event.id,
    by: input.by,
    at: input.at,
    reason: input.reason,
    originalOutcome: event.outcome,
    correctedOutcome: input.correctedOutcome,
    originalSupportedOrAdministeredAt: event.supportedOrAdministeredAt,
    correctedSupportedOrAdministeredAt: input.correctedSupportedOrAdministeredAt,
    originalRecordedAt: event.recordedAt,
    correctedRecordedAt: input.correctedRecordedAt,
  };
  const corrected: MARAdministrationEvent = {
    ...event,
    outcome: input.correctedOutcome,
    supportedOrAdministeredAt: input.correctedSupportedOrAdministeredAt,
    recordedAt: input.correctedRecordedAt,
    recordedBy: input.by,
    reason: input.reason,
    reviewState: 'review_required',
    correctionHistory: [correction, ...event.correctionHistory],
    eventVersion: event.eventVersion + 1,
    updatedAt: input.at,
  };
  safeAudit('mar_correction_created', 'Medication MAR correction appended; original entry retained.', {
    eventId: event.id,
    originalOutcome: correction.originalOutcome,
    correctedOutcome: correction.correctedOutcome,
  });
  return corrected;
}

export function recordPRNAdministration(input: {
  profile: MedicationProfile;
  orderVersion: MedicineOrderVersion;
  protocol: PRNProtocol;
  reason: string;
  administeredAt: string;
  recordedAt: string;
  recordedBy: string;
  idempotencyKey: string;
}): MARAdministrationEvent {
  if (!input.reason.trim()) throw new Error('PRN administration reason/indication is required.');
  const id = `mar-prn-${input.orderVersion.id}-${input.administeredAt}`.replace(/[^a-zA-Z0-9-]/g, '-');
  const event: MARAdministrationEvent = {
    id,
    residentId: input.profile.residentId,
    medicineOrderVersionId: input.orderVersion.id,
    scheduledFor: input.administeredAt,
    scheduledWindowStart: input.administeredAt,
    scheduledWindowEnd: input.administeredAt,
    outcome: 'administered',
    status: 'awaiting_effect_review',
    reason: input.reason.trim(),
    notes: '',
    evidenceIds: [input.orderVersion.authorisationEvidenceId, input.protocol.authorisedEvidenceId].filter(Boolean),
    reviewState: 'review_required',
    eventVersion: 1,
    idempotencyKey: input.idempotencyKey,
    finalisedAt: input.recordedAt,
    finalisedBy: input.recordedBy,
    supportedOrAdministeredAt: input.administeredAt,
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
    correctionHistory: [],
    prnProtocolId: input.protocol.id,
    prnReason: input.reason.trim(),
    effectReviewDueAt: new Date(Date.parse(input.administeredAt) + input.protocol.effectReviewMinutes * 60_000).toISOString(),
    createdAt: input.recordedAt,
    updatedAt: input.recordedAt,
  };
  safeAudit('mar_outcome_recorded', 'PRN medication recorded with effect review scheduled.', {
    residentId: event.residentId,
    protocolId: input.protocol.id,
  });
  return event;
}

export function createMedicationChangeRequest(input: {
  residentId: string;
  sourceType: MedicineOrderVersion['authorisationSourceType'];
  sourceReceivedAt: string;
  sourceDocumentId: string;
  recordedBy: string;
  effectiveFrom: string;
  proposedVersion: MedicineOrderVersion;
  affectedFutureEventIds: string[];
}): MedicationChangeRequest {
  return {
    id: uid('med-change'),
    residentId: input.residentId,
    sourceType: input.sourceType,
    sourceReceivedAt: input.sourceReceivedAt,
    sourceDocumentId: input.sourceDocumentId,
    recordedBy: input.recordedBy,
    effectiveFrom: input.effectiveFrom,
    proposedVersion: input.proposedVersion,
    affectedFutureEventIds: input.affectedFutureEventIds,
    reviewStatus: 'pending',
  };
}

export function activateMedicationChangeRequest(
  request: MedicationChangeRequest,
  input: {
    verifiedBy: string;
    secondCheckedBy: string;
    activatedAt: string;
  },
): MedicationChangeRequest {
  if (!request.proposedVersion) {
    throw new Error('Medicine change request has no proposed version to activate.');
  }
  if (!input.verifiedBy || !input.secondCheckedBy) {
    throw new Error('Medicine changes require verification and second check before activation.');
  }
  const activatedVersion: MedicineOrderVersion = {
    ...request.proposedVersion,
    status: 'active',
    activationMeaning: 'authorised_instructions_verified_not_clinically_approved',
    updatedAt: input.activatedAt,
  };
  return {
    ...request,
    reviewStatus: 'verified',
    secondCheckedBy: input.secondCheckedBy,
    proposedVersion: activatedVersion,
    activatedVersion,
    activatedAt: input.activatedAt,
  };
}

export function detectMARExceptions(input: {
  events: MARAdministrationEvent[];
  orderVersions: MedicineOrderVersion[];
  now: string;
}): MedicationException[] {
  const exceptions: MedicationException[] = [];
  const nowMs = parseIso(input.now);
  const refusalCounts = new Map<string, number>();

  for (const event of input.events) {
    const windowEnd = parseIso(event.scheduledWindowEnd);
    if (!event.finalisedAt && nowMs > windowEnd) {
      exceptions.push({
        id: `med-ex-overdue-${event.id}`,
        type: 'overdue',
        severity: 'urgent',
        message: 'Medication round item is overdue and needs review.',
        residentId: event.residentId,
        medicineOrderVersionId: event.medicineOrderVersionId,
        eventId: event.id,
        status: 'raised',
        createdAt: input.now,
        evidenceIds: event.evidenceIds,
      });
      exceptions.push({
        id: `med-ex-no-outcome-${event.id}`,
        type: 'no_outcome_recorded',
        severity: 'review',
        message: 'No completed medication outcome has been recorded for this scheduled MAR event.',
        residentId: event.residentId,
        medicineOrderVersionId: event.medicineOrderVersionId,
        eventId: event.id,
        status: 'raised',
        createdAt: input.now,
        evidenceIds: event.evidenceIds,
      });
    }
    if (event.status === 'recorded_late') {
      exceptions.push({
        id: `med-ex-late-${event.id}`,
        type: 'recorded_late',
        severity: 'review',
        message: 'Medication outcome was recorded after the scheduled window.',
        residentId: event.residentId,
        medicineOrderVersionId: event.medicineOrderVersionId,
        eventId: event.id,
        status: 'raised',
        createdAt: input.now,
        evidenceIds: event.evidenceIds,
      });
    }
    if (event.outcome === 'refused' || event.outcome === 'declined_after_prompt') {
      const key = `${event.residentId}:${event.medicineOrderVersionId}`;
      refusalCounts.set(key, (refusalCounts.get(key) || 0) + 1);
      exceptions.push({
        id: `med-ex-refusal-${event.id}`,
        type: 'refusal_recorded',
        severity: 'review',
        message: 'Medication was refused or declined and requires review against the support plan and escalation procedure.',
        residentId: event.residentId,
        medicineOrderVersionId: event.medicineOrderVersionId,
        eventId: event.id,
        status: 'raised',
        createdAt: input.now,
        evidenceIds: event.evidenceIds,
      });
    }
  }

  for (const [key, count] of refusalCounts) {
    if (count < 2) continue;
    const [residentId, medicineOrderVersionId] = key.split(':');
    exceptions.push({
      id: `med-ex-repeated-refusal-${slug(key)}`,
      type: 'repeated_refusal',
      severity: 'urgent',
      message: 'Repeated medication refusal pattern requires manager review.',
      residentId,
      medicineOrderVersionId,
      status: 'raised',
      createdAt: input.now,
      evidenceIds: [],
    });
  }

  for (const order of input.orderVersions) {
    if (order.reviewDate && parseIso(`${order.reviewDate}T23:59:59.999Z`) < nowMs) {
      exceptions.push({
        id: `med-ex-review-${order.id}`,
        type: 'medicine_review_overdue',
        severity: 'review',
        message: 'Medicine review date has passed and needs confirmation or update.',
        residentId: order.residentId,
        medicineOrderVersionId: order.id,
        status: 'raised',
        createdAt: input.now,
        evidenceIds: [order.authorisationEvidenceId],
      });
    }
  }
  return exceptions;
}

export function canRecordMedicationOutcome(access: MedicationAccessProfile, context: {
  house?: string;
  residentId?: string;
  roundId?: string;
  now: string;
}): { allowed: boolean; reason?: string } {
  if (!access.capabilities.includes('medicines.record_outcome')) {
    return { allowed: false, reason: 'Missing medicines.record_outcome capability.' };
  }
  if (!access.medicationCompetency?.current) {
    return { allowed: false, reason: 'Medication competency is not current.' };
  }
  if (access.medicationCompetency.expiresAt && parseIso(`${access.medicationCompetency.expiresAt}T23:59:59.999Z`) < parseIso(context.now)) {
    return { allowed: false, reason: 'Medication competency has expired.' };
  }
  const scoped = access.scopes.some(scope => {
    const houseOk = !scope.house || !context.house || scope.house === context.house;
    const residentOk = !scope.residentId || !context.residentId || scope.residentId === context.residentId;
    const expiryOk = !scope.expiresAt || parseIso(scope.expiresAt) >= parseIso(context.now);
    return houseOk && residentOk && expiryOk;
  });
  if (!scoped) return { allowed: false, reason: 'Medication access does not cover this house or resident.' };

  if (access.currentAssignments && access.currentAssignments.length > 0) {
    const assigned = access.currentAssignments.some(a =>
      (!a.house || !context.house || a.house === context.house)
      && (!a.residentId || !context.residentId || a.residentId === context.residentId)
      && (!context.roundId || !a.roundId || a.roundId === context.roundId)
    );
    if (!assigned) return { allowed: false, reason: 'Staff member is not assigned to this medication round or resident.' };
  }

  return { allowed: true };
}

export function buildMARAuditExport(input: {
  profile: MedicationProfile;
  orderVersions: MedicineOrderVersion[];
  events: MARAdministrationEvent[];
  exceptions: MedicationException[];
  generatedAt: string;
  downtimeProcedure?: MedicationDowntimeProcedure;
}): { fileName: string; text: string; csv: string } {
  const orderById = new Map(input.orderVersions.map(order => [order.id, order]));
  const lines = [
    'MAR AUDIT PACK',
    `Generated: ${input.generatedAt}`,
    `Resident: ${input.profile.residentName}`,
    `Date of birth: ${input.profile.dateOfBirth}`,
    `House: ${input.profile.house}`,
    `Allergies: ${input.profile.allergies.length ? input.profile.allergies.map(a => `${a.substance} (${a.reaction})`).join('; ') : 'None recorded'}`,
    '',
    'MAR EVENTS',
  ];
  for (const event of input.events) {
    const order = orderById.get(event.medicineOrderVersionId);
    lines.push([
      `Scheduled: ${event.scheduledFor}`,
      `Medicine: ${order ? `${order.medicineName} ${order.formulation} ${order.strength}` : event.medicineOrderVersionId}`,
      `Dose/route: ${order ? `${order.dose} via ${order.route}` : 'Unknown'}`,
      `Outcome: ${event.outcome || 'no_outcome_recorded'}`,
      `Supported/administered at: ${event.supportedOrAdministeredAt || 'not recorded'}`,
      `Recorded by: ${event.recordedBy || 'not recorded'}`,
      `Recorded at: ${event.recordedAt || 'not recorded'}`,
      `Reason: ${event.reason || 'none'}`,
      `Corrections: ${event.correctionHistory.length}`,
    ].join(' | '));
  }
  if (input.downtimeProcedure) {
    lines.push('', 'DOWNTIME PROCEDURE');
    lines.push(`Label: ${input.downtimeProcedure.label}`);
    lines.push(`Summary: ${input.downtimeProcedure.summary}`);
    lines.push(`Emergency print available: ${input.downtimeProcedure.emergencyPrintAvailable ? 'Yes' : 'No'}`);
  }

  lines.push('', 'EXCEPTIONS');
  if (input.exceptions.length === 0) lines.push('No open medication exceptions in this export.');
  for (const exception of input.exceptions) lines.push(`${exception.type}: ${exception.message}`);

  const csvRows = [
    ['residentName', 'medicineName', 'scheduledFor', 'outcome', 'recordedBy', 'recordedAt', 'reason', 'corrections'].join(','),
    ...input.events.map(event => {
      const order = orderById.get(event.medicineOrderVersionId);
      return [
        input.profile.residentName,
        order ? `${order.medicineName} ${order.formulation} ${order.strength}` : event.medicineOrderVersionId,
        event.scheduledFor,
        event.outcome || 'no_outcome_recorded',
        event.recordedBy || '',
        event.recordedAt || '',
        event.reason || '',
        event.correctionHistory.length,
      ].map(csvEscape).join(',');
    }),
  ];

  safeAudit('medication_export_generated', 'Medication MAR audit export generated.', {
    residentId: input.profile.residentId,
    eventCount: input.events.length,
    exceptionCount: input.exceptions.length,
  });

  return {
    fileName: `mar-audit-pack-${slug(input.profile.residentName)}-${Date.parse(input.generatedAt) || Date.now()}.txt`,
    text: lines.join('\n'),
    csv: csvRows.join('\n'),
  };
}

export function evidenceFromNourishMARHtml(input: {
  id: string;
  sourceName: string;
  html: string;
  receivedAt: string;
}): MedicationEvidenceImport {
  const text = input.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const fields: string[] = [];
  if (/tablet|capsule|medicine|metformin|atorvastatin|epilim|furosemide|ramipril/i.test(text)) fields.push('medicineName');
  if (/\bDose\b|tablet|mg|ml/i.test(text)) fields.push('dose');
  if (/\bRoute\b|Oral|topical|subcutaneous/i.test(text)) fields.push('route');
  if (/\bFrequency\b|Every day|daily|weekly/i.test(text)) fields.push('frequency');
  if (/Time period|Morning|Lunch|Evening|Night|\d{2}:\d{2}/i.test(text)) fields.push('timePeriod');
  if (/Instruction|Support|Administer|Prompt/i.test(text)) fields.push('instruction');
  return {
    id: input.id,
    sourceName: input.sourceName,
    sourceType: 'nourish_mar_html',
    receivedAt: input.receivedAt,
    extractedFields: fields,
    excerpt: text.slice(0, 240),
    confidence: fields.length >= 5 ? 0.82 : 0.45,
    reviewState: 'review_required',
    createsActiveOrder: false,
  };
}

export function evidenceFromMedicationAuditText(input: {
  id: string;
  sourceName: string;
  text: string;
  receivedAt: string;
}): MedicationEvidenceImport {
  const text = input.text.replace(/\s+/g, ' ').trim();
  const fields: string[] = [];
  if (/Medication Management Audit|CM54|MAR Audit/i.test(text)) fields.push('auditForm');
  if (/No Outcome Recorded|Administered|Supported|Refused/i.test(text)) fields.push('outcomeCounts');
  if (/started|changed|discontinued|hospital|discharge/i.test(text)) fields.push('medicineChangeSignal');
  return {
    id: input.id,
    sourceName: input.sourceName,
    sourceType: 'medication_audit_pdf',
    receivedAt: input.receivedAt,
    extractedFields: fields,
    excerpt: text.slice(0, 260),
    confidence: fields.length >= 2 ? 0.78 : 0.4,
    reviewState: 'review_required',
    createsActiveOrder: false,
  };
}

export function loadMedicationState(): MedicationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMedicationState();
    const parsed = JSON.parse(raw);
    return {
      profiles: parsed.profiles || [],
      orders: parsed.orders || [],
      orderVersions: parsed.orderVersions || [],
      chartPeriods: parsed.chartPeriods || [],
      events: parsed.events || [],
      exceptions: parsed.exceptions || [],
      evidence: parsed.evidence || [],
    };
  } catch {
    return emptyMedicationState();
  }
}

export function saveMedicationState(state: MedicationState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hc-medication-updated', { detail: state }));
  }
}

export function emptyMedicationState(): MedicationState {
  return {
    profiles: [],
    orders: [],
    orderVersions: [],
    chartPeriods: [],
    events: [],
    exceptions: [],
    evidence: [],
  };
}

export function createSyntheticMedicationState(now = '2026-07-08T08:00:00.000Z'): MedicationState {
  const createdProfile = createMedicationProfile({
    id: 'med-profile-demo',
    residentId: 'resident-demo',
    residentName: 'Demo Resident',
    dateOfBirth: '1970-01-01',
    house: 'Demo Care Home',
    allergies: [{ substance: 'No known allergies', reaction: 'Recorded as none known', severity: 'standard' }],
    createdAt: now,
  });
  const order = activateMedicineOrderVersion(createMedicineOrderVersion({
    id: 'order-demo-paracetamol-v1',
    orderId: 'order-demo-paracetamol',
    residentId: createdProfile.residentId,
    medicineName: 'Paracetamol',
    formulation: 'tablets',
    strength: '500mg',
    dose: '2 tablets',
    route: 'Oral',
    schedule: { kind: 'fixed_times', times: ['08:00', '14:00', '20:00'], windowMinutesBefore: 30, windowMinutesAfter: 60 },
    instructions: 'Authorised example order for synthetic demo data.',
    authorisationSourceType: 'pharmacy_label',
    authorisationEvidenceId: 'ev-demo-pharmacy-label',
    authorisedByExternalProfessional: 'Demo GP Practice',
    sourceReceivedAt: now,
    verifiedBy: 'Demo manager',
    verifiedAt: now,
    effectiveFrom: '2026-07-08T00:00:00.000Z',
    reviewDate: '2026-10-08',
    createdAt: now,
  }));
  const chart = generateMARChartPeriod({
    profile: createdProfile,
    activeOrderVersions: [order],
    date: now.slice(0, 10),
    createdAt: now,
  });
  return {
    profiles: [createdProfile],
    orders: [{ id: order.orderId, residentId: createdProfile.residentId, currentVersionId: order.id, versions: [order] }],
    orderVersions: [order],
    chartPeriods: [chart],
    events: chart.events,
    exceptions: detectMARExceptions({ events: chart.events, orderVersions: [order], now }),
    evidence: [],
  };
}
