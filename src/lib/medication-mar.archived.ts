/**
 * ═══════════════════════════════════════════════════════════════
 * ARCHIVED — superseded by src/lib/client-medication.ts (Core MAR V1)
 *
 * Reason: This implementation does not comply with the approved
 * Core MAR V1 specification. Key violations:
 *   - `cancelled_with_reason` included as a staff outcome (should be lifecycle-only)
 *   - `missed` included as both a staff outcome AND system status (should be staff-only)
 *   - No duplicate-recording protection (missing eventVersion/idempotencyKey)
 *   - No gating on self_administered (missing assessment check)
 *   - No activationMeaning field for verified orders
 *
 * Kept for reference — valuable V1B features to port:
 *   - PRN protocol with effect review
 *   - Medicine change request workflow with second-check
 *   - Downtime procedure in audit pack
 *   - Assignment-granular access with round-level assignment
 *   - Retention policy on profile
 *
 * Do not import in new code. Use client-medication.ts instead.
 * ═══════════════════════════════════════════════════════════════
 */

export type MedicationCapability =
  | 'medicines.view'
  | 'medicines.manage_profile'
  | 'medicines.record_outcome'
  | 'medicines.review_mar'
  | 'medicines.audit'
  | 'medicines.export'
  | 'medicines.view_exceptions'
  | 'medicines.manage_stock'
  | 'medicines.controlled_drugs';

export type MedicationReviewState = 'unreviewed' | 'review_required' | 'reviewed' | 'deferred';

export interface MedicationProfile {
  id: string;
  residentId: string;
  residentName: string;
  dateOfBirth?: string;
  house: string;
  allergies: Array<{
    substance: string;
    reaction?: string;
    recordedAt: string;
  }>;
  consentStatus: 'unknown' | 'recorded' | 'best_interest' | 'declined' | 'review_required';
  reviewState: MedicationReviewState;
  retentionPolicy?: {
    retainUntil: string;
    basis: string;
  };
}

export interface MedicationCompetency {
  type: 'medicines_recording' | 'medicines_review' | 'controlled_drugs';
  house?: string;
  validUntil: string;
  status: 'current' | 'expired' | 'suspended';
}

export interface MedicationAccessProfile {
  userId: string;
  displayName: string;
  capabilities: MedicationCapability[];
  scopes: Array<{
    organisationId?: string;
    service?: string;
    house?: string;
    residentId?: string;
    sensitivity?: 'standard' | 'clinical' | 'controlled_drug';
    expiresAt?: string;
  }>;
  competencies: MedicationCompetency[];
  currentAssignments: Array<{
    house: string;
    residentId?: string;
    roundId?: string;
  }>;
}

export type MedicineOrderStatus = 'pending_verification' | 'active' | 'held' | 'stopped';
export type MedicineFrequency = 'daily' | 'specific_days' | 'once' | 'temporary_course' | 'prn';
export type MedicineScheduleKind = 'fixed_window' | 'once_only' | 'prn' | 'external_record';

export interface MedicineOrder {
  id: string;
  profileId: string;
  residentId: string;
  medicineName: string;
  formulation?: string;
  strength?: string;
  dose: string;
  route: string;
  frequency: MedicineFrequency;
  scheduleKind: MedicineScheduleKind;
  timeWindows: Array<{
    label: string;
    start: string;
    end: string;
  }>;
  instructions?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: MedicineOrderStatus;
  version: number;
  authorisedSource: {
    type: 'pharmacy_label' | 'mar_import' | 'discharge_summary' | 'gp_instruction' | 'manual_policy_record';
    title: string;
    receivedAt: string;
    verifiedBy?: string;
    verifiedAt?: string;
  };
  reviewState: MedicationReviewState;
}

export type MARStaffOutcome =
  | 'administered'
  | 'supported_taken'
  | 'prompted_taken'
  | 'refused'
  | 'declined_after_prompt'
  | 'not_available'
  | 'withheld_by_instruction'
  | 'self_administered'
  | 'hospital_leave'
  | 'cancelled_with_reason'
  | 'missed';

export type MARSystemStatus =
  | 'due'
  | 'overdue'
  | 'recorded'
  | 'recorded_late'
  | 'recorded_outside_window'
  | 'duplicate_attempt'
  | 'awaiting_effect_review'
  | 'missed'
  | 'no_outcome_recorded'
  | 'review_required'
  | 'corrected';

export interface MARCorrectionEvent {
  id: string;
  eventId: string;
  originalOutcome?: MARStaffOutcome;
  correctedOutcome: MARStaffOutcome;
  correctedSupportedOrAdministeredAt: string;
  correctedBy: string;
  correctedAt: string;
  reason: string;
}

export interface MARAdministrationEvent {
  id: string;
  profileId: string;
  orderId: string;
  orderVersion: number;
  residentId: string;
  residentName: string;
  house: string;
  medicineName: string;
  dose: string;
  route: string;
  instructions?: string;
  roundId?: string;
  scheduleKind: MedicineScheduleKind;
  scheduledFor: string;
  windowStart: string;
  windowEnd: string;
  outcome?: MARStaffOutcome;
  reason?: string;
  note?: string;
  supportedOrAdministeredAt?: string;
  recordedAt?: string;
  recordedBy?: string;
  systemStatuses: MARSystemStatus[];
  reviewRequired: boolean;
  corrections: MARCorrectionEvent[];
  prnProtocolId?: string;
  prnReason?: string;
  effectReviewDueAt?: string;
  relatedRecordType?: 'controlled_drug' | 'insulin' | 'patch' | 'tmar' | 'warfarin' | 'covert' | 'enteral' | 'external_professional';
  relatedRecordId?: string;
  externalAdministration?: boolean;
  externalProfessional?: string;
  crossReferenceNote?: string;
}

export interface PRNProtocol {
  id: string;
  orderId: string;
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

export interface MedicationChangeRequest {
  id: string;
  residentId: string;
  sourceType: 'hospital_discharge' | 'gp_instruction' | 'pharmacy_label' | 'mar_import' | 'other';
  sourceReceivedAt: string;
  sourceDocumentId: string;
  recordedBy: string;
  effectiveFrom: string;
  proposedOrder: MedicineOrder;
  affectedFutureEventIds: string[];
  reviewStatus: 'pending_second_check' | 'activated' | 'rejected';
  verifiedBy?: string;
  secondCheckedBy?: string;
  activatedAt?: string;
  activatedOrder?: MedicineOrder;
}

export interface MedicationException {
  id: string;
  eventId?: string;
  orderId?: string;
  residentId: string;
  house: string;
  type:
    | 'no_outcome_recorded'
    | 'recorded_outside_window'
    | 'recorded_late'
    | 'repeated_refusal'
    | 'missing_exception_reason'
    | 'prn_effect_review_due'
    | 'missing_allergy_record'
    | 'order_review_required';
  severity: 'info' | 'review' | 'urgent';
  message: string;
  status: 'raised' | 'assigned' | 'under_review' | 'resolved' | 'deferred';
  createdAt: string;
  evidenceIds: string[];
}

export interface MedicationDowntimeProcedure {
  label: string;
  summary: string;
  emergencyPrintAvailable: boolean;
}

export interface MedicationAuditPack {
  id: string;
  residentId: string;
  residentName: string;
  house: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  summary: {
    totalEvents: number;
    recordedEvents: number;
    openExceptions: number;
    stockModuleIncluded: false;
    controlledDrugModuleIncluded: false;
  };
  orders: MedicineOrder[];
  events: MARAdministrationEvent[];
  exceptions: MedicationException[];
  retention?: MedicationProfile['retentionPolicy'];
  downtimeProcedure: MedicationDowntimeProcedure;
  exportFormats: Array<'pdf' | 'csv' | 'json'>;
}

const NON_STANDARD_OUTCOMES: MARStaffOutcome[] = [
  'refused',
  'declined_after_prompt',
  'not_available',
  'withheld_by_instruction',
  'cancelled_with_reason',
  'missed',
];

const SYSTEM_ONLY_OUTCOMES = new Set<string>([
  'due',
  'overdue',
  'recorded_late',
  'recorded_outside_window',
  'duplicate_attempt',
  'awaiting_effect_review',
  'no_outcome_recorded',
  'review_required',
  'corrected',
]);

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function dateTimeUtc(date: string, time: string) {
  return `${date}T${time.length === 5 ? `${time}:00` : time}.000Z`;
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function minutesBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
}

function isVerifiedActiveOrder(order: MedicineOrder, date: string) {
  if (order.status !== 'active') return false;
  if (!order.authorisedSource.verifiedBy || !order.authorisedSource.verifiedAt) return false;
  if (order.effectiveFrom > date) return false;
  if (order.effectiveTo && order.effectiveTo < date) return false;
  return true;
}

function uniqueStatuses(statuses: MARSystemStatus[]) {
  return Array.from(new Set(statuses));
}

function scopeMatches(scope: MedicationAccessProfile['scopes'][number], context: {
  house: string;
  residentId: string;
  at: string;
}) {
  if (scope.expiresAt && new Date(scope.expiresAt).getTime() < new Date(context.at).getTime()) return false;
  if (scope.house && scope.house !== context.house) return false;
  if (scope.residentId && scope.residentId !== context.residentId) return false;
  return true;
}

export function canRecordMedicationOutcome(profile: MedicationAccessProfile, context: {
  house: string;
  residentId: string;
  roundId?: string;
  at: string;
}): { allowed: true } | { allowed: false; reason: string } {
  if (!profile.capabilities.includes('medicines.record_outcome')) {
    return { allowed: false, reason: 'Medication recording capability is required.' };
  }

  if (!profile.scopes.some(scope => scopeMatches(scope, context))) {
    return { allowed: false, reason: 'Medication recording access is not scoped to this resident/service.' };
  }

  const hasCurrentCompetency = profile.competencies.some(competency =>
    competency.type === 'medicines_recording'
    && competency.status === 'current'
    && (!competency.house || competency.house === context.house)
    && new Date(competency.validUntil).getTime() >= new Date(context.at).getTime()
  );
  if (!hasCurrentCompetency) {
    return { allowed: false, reason: 'Medication recording competency is not current for this service.' };
  }

  const assigned = profile.currentAssignments.some(assignment =>
    assignment.house === context.house
    && (!assignment.residentId || assignment.residentId === context.residentId)
    && (!context.roundId || !assignment.roundId || assignment.roundId === context.roundId)
  );
  if (!assigned) {
    return { allowed: false, reason: 'Staff member is not assigned to this medication round/resident.' };
  }

  return { allowed: true };
}

export function generateMARAdministrationEvents(input: {
  profile: MedicationProfile;
  orders: MedicineOrder[];
  date: string;
  roundId?: string;
}): MARAdministrationEvent[] {
  return input.orders
    .filter(order => isVerifiedActiveOrder(order, input.date))
    .filter(order => order.scheduleKind !== 'prn' && order.frequency !== 'prn')
    .flatMap(order => order.timeWindows.map(window => ({
      id: `mar-${order.id}-${input.date}-${window.label.replace(/\s+/g, '-').toLowerCase()}`,
      profileId: input.profile.id,
      orderId: order.id,
      orderVersion: order.version,
      residentId: input.profile.residentId,
      residentName: input.profile.residentName,
      house: input.profile.house,
      medicineName: order.medicineName,
      dose: order.dose,
      route: order.route,
      instructions: order.instructions,
      roundId: input.roundId,
      scheduleKind: order.scheduleKind,
      scheduledFor: dateTimeUtc(input.date, window.start),
      windowStart: dateTimeUtc(input.date, window.start),
      windowEnd: dateTimeUtc(input.date, window.end),
      outcome: undefined,
      systemStatuses: ['due'] as MARSystemStatus[],
      reviewRequired: false,
      corrections: [],
    })));
}

export function recordMAROutcome(event: MARAdministrationEvent, input: {
  outcome: MARStaffOutcome;
  supportedOrAdministeredAt: string;
  recordedAt: string;
  recordedBy: string;
  reason?: string;
  note?: string;
  access: MedicationAccessProfile;
}): MARAdministrationEvent {
  if (SYSTEM_ONLY_OUTCOMES.has(input.outcome)) {
    throw new Error(`${input.outcome} is a system-derived status, not a staff outcome.`);
  }
  if (!input.supportedOrAdministeredAt || !input.recordedAt || !input.recordedBy) {
    throw new Error('MAR outcomes require supported/administered time, recorded time, and staff identity.');
  }

  const access = canRecordMedicationOutcome(input.access, {
    house: event.house,
    residentId: event.residentId,
    roundId: event.roundId,
    at: input.recordedAt,
  });
  if (!access.allowed) throw new Error(access.reason);

  if (NON_STANDARD_OUTCOMES.includes(input.outcome) && !input.reason?.trim()) {
    throw new Error(`A reason is required for ${input.outcome.replace(/_/g, ' ')} medication outcomes.`);
  }

  const statuses: MARSystemStatus[] = ['recorded'];
  const actual = new Date(input.supportedOrAdministeredAt).getTime();
  if (actual < new Date(event.windowStart).getTime() || actual > new Date(event.windowEnd).getTime()) {
    statuses.push('recorded_outside_window');
  }
  if (minutesBetween(input.supportedOrAdministeredAt, input.recordedAt) > 30) {
    statuses.push('recorded_late');
  }
  if (input.outcome === 'missed') statuses.push('missed');
  if (NON_STANDARD_OUTCOMES.includes(input.outcome)) statuses.push('review_required');

  return {
    ...event,
    outcome: input.outcome,
    supportedOrAdministeredAt: input.supportedOrAdministeredAt,
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
    reason: input.reason,
    note: input.note,
    systemStatuses: uniqueStatuses(statuses),
    reviewRequired: statuses.includes('review_required') || statuses.includes('recorded_late') || statuses.includes('recorded_outside_window'),
  };
}

export function createMARCorrection(event: MARAdministrationEvent, input: {
  correctedOutcome: MARStaffOutcome;
  correctedSupportedOrAdministeredAt: string;
  correctedBy: string;
  correctedAt: string;
  reason: string;
}): MARAdministrationEvent {
  if (!input.reason.trim()) throw new Error('MAR correction reason is required.');
  const correction: MARCorrectionEvent = {
    id: uid('mar-correction'),
    eventId: event.id,
    originalOutcome: event.outcome,
    correctedOutcome: input.correctedOutcome,
    correctedSupportedOrAdministeredAt: input.correctedSupportedOrAdministeredAt,
    correctedBy: input.correctedBy,
    correctedAt: input.correctedAt,
    reason: input.reason,
  };

  return {
    ...event,
    corrections: [...event.corrections, correction],
    systemStatuses: uniqueStatuses([...event.systemStatuses, 'corrected']),
    reviewRequired: true,
  };
}

export function recordPRNAdministration(input: {
  profile: MedicationProfile;
  order: MedicineOrder;
  protocol: PRNProtocol;
  reason: string;
  administeredAt: string;
  recordedAt: string;
  recordedBy: string;
  access: MedicationAccessProfile;
}): MARAdministrationEvent {
  if (input.order.frequency !== 'prn' && input.order.scheduleKind !== 'prn') {
    throw new Error('PRN administration requires a PRN medicine order.');
  }
  if (!input.reason.trim()) throw new Error('PRN administration reason/indication is required.');

  const access = canRecordMedicationOutcome(input.access, {
    house: input.profile.house,
    residentId: input.profile.residentId,
    at: input.recordedAt,
  });
  if (!access.allowed) throw new Error(access.reason);

  return {
    id: `mar-prn-${input.order.id}-${input.administeredAt}`,
    profileId: input.profile.id,
    orderId: input.order.id,
    orderVersion: input.order.version,
    residentId: input.profile.residentId,
    residentName: input.profile.residentName,
    house: input.profile.house,
    medicineName: input.order.medicineName,
    dose: input.protocol.dose || input.order.dose,
    route: input.protocol.route || input.order.route,
    instructions: input.order.instructions,
    scheduleKind: 'prn',
    scheduledFor: input.administeredAt,
    windowStart: input.administeredAt,
    windowEnd: input.administeredAt,
    outcome: 'administered',
    reason: input.reason,
    prnProtocolId: input.protocol.id,
    prnReason: input.reason,
    supportedOrAdministeredAt: input.administeredAt,
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
    effectReviewDueAt: addMinutes(input.administeredAt, input.protocol.effectReviewMinutes),
    systemStatuses: ['recorded', 'awaiting_effect_review'],
    reviewRequired: true,
    corrections: [],
  };
}

export function createMedicationChangeRequest(input: {
  residentId: string;
  sourceType: MedicationChangeRequest['sourceType'];
  sourceReceivedAt: string;
  sourceDocumentId: string;
  recordedBy: string;
  effectiveFrom: string;
  proposedOrder: MedicineOrder;
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
    proposedOrder: { ...input.proposedOrder, status: 'pending_verification' },
    affectedFutureEventIds: input.affectedFutureEventIds,
    reviewStatus: 'pending_second_check',
  };
}

export function activateMedicationChangeRequest(request: MedicationChangeRequest, input: {
  verifiedBy: string;
  secondCheckedBy: string;
  activatedAt: string;
}): MedicationChangeRequest & { activatedOrder: MedicineOrder } {
  if (!input.verifiedBy || !input.secondCheckedBy) {
    throw new Error('Medicine changes require verification and second check before activation.');
  }

  const activatedOrder: MedicineOrder = {
    ...request.proposedOrder,
    status: 'active',
    effectiveFrom: request.effectiveFrom,
    authorisedSource: {
      ...request.proposedOrder.authorisedSource,
      verifiedBy: input.verifiedBy,
      verifiedAt: input.activatedAt,
    },
    reviewState: 'reviewed',
  };

  return {
    ...request,
    reviewStatus: 'activated',
    verifiedBy: input.verifiedBy,
    secondCheckedBy: input.secondCheckedBy,
    activatedAt: input.activatedAt,
    activatedOrder,
  };
}

function exception(input: Omit<MedicationException, 'id' | 'status'>): MedicationException {
  return {
    ...input,
    id: uid('med-exception'),
    status: 'raised',
  };
}

export function detectMARExceptions(input: {
  events: MARAdministrationEvent[];
  now: string;
}): MedicationException[] {
  const now = new Date(input.now).getTime();
  const exceptions: MedicationException[] = [];

  for (const event of input.events) {
    if (!event.outcome && now > new Date(event.windowEnd).getTime()) {
      exceptions.push(exception({
        eventId: event.id,
        orderId: event.orderId,
        residentId: event.residentId,
        house: event.house,
        type: 'no_outcome_recorded',
        severity: 'review',
        message: `${event.residentName} has a medication event with no recorded outcome after the scheduled window.`,
        createdAt: input.now,
        evidenceIds: [event.id],
      }));
    }

    if (event.systemStatuses.includes('recorded_outside_window')) {
      exceptions.push(exception({
        eventId: event.id,
        orderId: event.orderId,
        residentId: event.residentId,
        house: event.house,
        type: 'recorded_outside_window',
        severity: 'review',
        message: `${event.residentName} has a medication record outside the authorised time window; manager review required.`,
        createdAt: input.now,
        evidenceIds: [event.id],
      }));
    }

    if (event.systemStatuses.includes('recorded_late')) {
      exceptions.push(exception({
        eventId: event.id,
        orderId: event.orderId,
        residentId: event.residentId,
        house: event.house,
        type: 'recorded_late',
        severity: 'info',
        message: `${event.residentName} has a medication entry recorded later than the service prompt window.`,
        createdAt: input.now,
        evidenceIds: [event.id],
      }));
    }
  }

  const refusalGroups = new Map<string, MARAdministrationEvent[]>();
  for (const event of input.events.filter(item => item.outcome === 'refused' || item.outcome === 'declined_after_prompt')) {
    const key = `${event.residentId}:${event.orderId}`;
    refusalGroups.set(key, [...(refusalGroups.get(key) || []), event]);
  }

  for (const group of refusalGroups.values()) {
    if (group.length >= 3) {
      const latest = group.sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))[0];
      exceptions.push(exception({
        eventId: latest.id,
        orderId: latest.orderId,
        residentId: latest.residentId,
        house: latest.house,
        type: 'repeated_refusal',
        severity: 'review',
        message: `${latest.residentName} has repeated medication refusals recorded; review the care plan, prescriber guidance, and escalation pathway.`,
        createdAt: input.now,
        evidenceIds: group.map(item => item.id),
      }));
    }
  }

  return exceptions;
}

export function buildMedicationAuditPack(input: {
  profile: MedicationProfile;
  orders: MedicineOrder[];
  events: MARAdministrationEvent[];
  exceptions: MedicationException[];
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  downtimeProcedure: MedicationDowntimeProcedure;
}): MedicationAuditPack {
  const openExceptions = input.exceptions.filter(item => item.status !== 'resolved' && item.status !== 'deferred');
  return {
    id: `med-audit-${input.profile.residentId}-${input.dateFrom}-${input.dateTo}`,
    residentId: input.profile.residentId,
    residentName: input.profile.residentName,
    house: input.profile.house,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    generatedAt: input.generatedAt,
    summary: {
      totalEvents: input.events.length,
      recordedEvents: input.events.filter(event => !!event.outcome).length,
      openExceptions: openExceptions.length,
      stockModuleIncluded: false,
      controlledDrugModuleIncluded: false,
    },
    orders: input.orders,
    events: input.events,
    exceptions: input.exceptions,
    retention: input.profile.retentionPolicy,
    downtimeProcedure: input.downtimeProcedure,
    exportFormats: ['pdf', 'csv', 'json'],
  };
}
