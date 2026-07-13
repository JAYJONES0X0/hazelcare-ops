import { describe, expect, it } from 'vitest';
import {
  activateMedicineOrderVersion,
  activateMedicationChangeRequest,
  buildMARAuditExport,
  canRecordMedicationOutcome,
  createMARCorrection,
  createMedicationChangeRequest,
  createMedicationProfile,
  createMedicineOrderVersion,
  detectMARExceptions,
  evidenceFromMedicationAuditText,
  evidenceFromNourishMARHtml,
  generateMARChartPeriod,
  recordMAROutcome,
  recordPRNAdministration,
  startMARRecording,
  type MARAdministrationEvent,
  type MedicationAccessProfile,
  type MedicationProfile,
  type MedicineOrderVersion,
  type PRNProtocol,
} from './client-medication';

const profile: MedicationProfile = createMedicationProfile({
  id: 'med-profile-tony',
  residentId: 'resident-tony',
  residentName: 'Anthony Cook',
  dateOfBirth: '1965-04-10',
  house: 'Station House',
  allergies: [{ substance: 'Penicillin', reaction: 'Rash', severity: 'standard' }],
  createdAt: '2026-07-08T08:00:00.000Z',
});

function activeOrder(overrides: Partial<MedicineOrderVersion> = {}): MedicineOrderVersion {
  return activateMedicineOrderVersion(createMedicineOrderVersion({
    id: overrides.id || 'order-metformin-v1',
    orderId: overrides.orderId || 'order-metformin',
    residentId: profile.residentId,
    medicineName: overrides.medicineName || 'Metformin',
    formulation: overrides.formulation || 'tablets',
    strength: overrides.strength || '500mg',
    dose: overrides.dose || '1 tablet',
    route: overrides.route || 'Oral',
    schedule: overrides.schedule || {
      kind: 'fixed_times',
      times: ['08:00', '18:00'],
      windowMinutesBefore: 30,
      windowMinutesAfter: 90,
    },
    instructions: overrides.instructions || 'Take with food.',
    authorisationSourceType: overrides.authorisationSourceType || 'pharmacy_label',
    authorisationEvidenceId: overrides.authorisationEvidenceId || 'ev-pharmacy-label',
    authorisedByExternalProfessional: overrides.authorisedByExternalProfessional || 'Priory Surgery',
    sourceReceivedAt: overrides.sourceReceivedAt || '2026-07-07T16:00:00.000Z',
    verifiedBy: overrides.verifiedBy || 'Medication Lead',
    verifiedAt: overrides.verifiedAt || '2026-07-07T17:00:00.000Z',
    effectiveFrom: overrides.effectiveFrom || '2026-07-08T00:00:00.000Z',
    effectiveTo: overrides.effectiveTo,
    reviewDate: overrides.reviewDate || '2026-10-08',
    createdAt: overrides.createdAt || '2026-07-07T16:10:00.000Z',
  }));
}

function firstEvent(): MARAdministrationEvent {
  const chart = generateMARChartPeriod({
    profile,
    activeOrderVersions: [activeOrder()],
    date: '2026-07-08',
    createdAt: '2026-07-08T00:00:00.000Z',
  });
  return chart.events[0];
}

describe('Core MAR V1 medication governance', () => {
  it('creates a verified medication profile and authorised order without implying clinical approval', () => {
    const draft = createMedicineOrderVersion({
      orderId: 'order-atorvastatin',
      residentId: profile.residentId,
      medicineName: 'Atorvastatin',
      formulation: 'tablets',
      strength: '20mg',
      dose: '1 tablet',
      route: 'Oral',
      schedule: { kind: 'fixed_times', times: ['20:00'] },
      instructions: 'Night dose.',
      authorisationSourceType: 'discharge_summary',
      authorisationEvidenceId: 'ev-discharge',
      authorisedByExternalProfessional: 'Hospital discharge team',
      sourceReceivedAt: '2026-07-08T10:00:00.000Z',
      verifiedBy: 'Manager',
      verifiedAt: '2026-07-08T11:00:00.000Z',
      effectiveFrom: '2026-07-08T20:00:00.000Z',
    });

    const active = activateMedicineOrderVersion(draft);

    expect(profile.allergies[0]).toMatchObject({ substance: 'Penicillin', reaction: 'Rash' });
    expect(active).toMatchObject({
      status: 'active',
      authorisationSourceType: 'discharge_summary',
      authorisationEvidenceId: 'ev-discharge',
      authorisedByExternalProfessional: 'Hospital discharge team',
      activationMeaning: 'authorised_instructions_verified_not_clinically_approved',
    });
  });

  it('generates MAR events from active order versions with scheduled windows', () => {
    const chart = generateMARChartPeriod({
      profile,
      activeOrderVersions: [activeOrder()],
      date: '2026-07-08',
      createdAt: '2026-07-08T00:00:00.000Z',
    });

    expect(chart.events).toHaveLength(2);
    expect(chart.events[0]).toMatchObject({
      residentId: profile.residentId,
      medicineOrderVersionId: 'order-metformin-v1',
      scheduledFor: '2026-07-08T08:00:00.000Z',
      scheduledWindowStart: '2026-07-08T07:30:00.000Z',
      scheduledWindowEnd: '2026-07-08T09:30:00.000Z',
      outcome: null,
      status: 'due',
      eventVersion: 1,
    });
  });

  it('records actual support time separately from recording time and requires reasons for exception outcomes', () => {
    const event = firstEvent();

    expect(() => recordMAROutcome(event, {
      outcome: 'refused',
      supportedOrAdministeredAt: '2026-07-08T08:15:00.000Z',
      recordedAt: '2026-07-08T08:20:00.000Z',
      recordedBy: 'Staff A',
      reason: '',
      idempotencyKey: 'idem-refusal-1',
      expectedEventVersion: 1,
    })).toThrow('Reason is required for refused medication outcomes.');

    const recorded = recordMAROutcome(event, {
      outcome: 'administered',
      supportedOrAdministeredAt: '2026-07-08T08:10:00.000Z',
      recordedAt: '2026-07-08T09:45:00.000Z',
      recordedBy: 'Staff A',
      reason: '',
      notes: 'Taken with breakfast.',
      idempotencyKey: 'idem-admin-1',
      expectedEventVersion: 1,
    });

    expect(recorded).toMatchObject({
      outcome: 'administered',
      supportedOrAdministeredAt: '2026-07-08T08:10:00.000Z',
      recordedAt: '2026-07-08T09:45:00.000Z',
      finalisedBy: 'Staff A',
      status: 'recorded_late',
      eventVersion: 2,
    });
  });

  it('protects against duplicate recording and stale event overwrites', () => {
    const event = firstEvent();
    const started = startMARRecording(event, {
      by: 'Staff A',
      at: '2026-07-08T08:00:00.000Z',
      expectedEventVersion: 1,
    });

    expect(() => startMARRecording(started, {
      by: 'Staff B',
      at: '2026-07-08T08:01:00.000Z',
      expectedEventVersion: 2,
    })).toThrow('MAR event is already being recorded by Staff A.');

    const recorded = recordMAROutcome(started, {
      outcome: 'supported_taken',
      supportedOrAdministeredAt: '2026-07-08T08:05:00.000Z',
      recordedAt: '2026-07-08T08:06:00.000Z',
      recordedBy: 'Staff A',
      reason: '',
      idempotencyKey: 'idem-supported-1',
      expectedEventVersion: 2,
    });

    const duplicate = recordMAROutcome(recorded, {
      outcome: 'supported_taken',
      supportedOrAdministeredAt: '2026-07-08T08:05:00.000Z',
      recordedAt: '2026-07-08T08:06:00.000Z',
      recordedBy: 'Staff A',
      reason: '',
      idempotencyKey: 'idem-supported-1',
      expectedEventVersion: 3,
    });

    expect(duplicate).toBe(recorded);
    expect(() => recordMAROutcome(recorded, {
      outcome: 'missed',
      supportedOrAdministeredAt: '2026-07-08T08:30:00.000Z',
      recordedAt: '2026-07-08T08:31:00.000Z',
      recordedBy: 'Staff B',
      reason: 'Trying stale overwrite.',
      idempotencyKey: 'idem-stale-1',
      expectedEventVersion: 1,
    })).toThrow('Stale MAR event version cannot overwrite a newer record.');
  });

  it('gates self-administered outcomes behind a current assessment', () => {
    const event = firstEvent();

    expect(() => recordMAROutcome(event, {
      outcome: 'self_administered',
      supportedOrAdministeredAt: '2026-07-08T08:05:00.000Z',
      recordedAt: '2026-07-08T08:07:00.000Z',
      recordedBy: 'Staff A',
      reason: '',
      idempotencyKey: 'idem-self-1',
      expectedEventVersion: 1,
    })).toThrow('Self-administration requires a current authorised assessment.');

    const assessed = {
      ...event,
      selfAdministrationAssessmentId: 'self-assess-1',
      selfAdministrationAuthorised: true,
      assessmentReviewDate: '2026-09-01',
      supportLevel: 'Staff observe storage and prompt only.',
      storageArrangement: 'Locked resident cabinet.',
    };

    expect(recordMAROutcome(assessed, {
      outcome: 'self_administered',
      supportedOrAdministeredAt: '2026-07-08T08:05:00.000Z',
      recordedAt: '2026-07-08T08:07:00.000Z',
      recordedBy: 'Staff A',
      reason: '',
      idempotencyKey: 'idem-self-2',
      expectedEventVersion: 1,
    }).outcome).toBe('self_administered');
  });

  it('detects overdue, no-outcome, refusal, and review-due exceptions', () => {
    const event = firstEvent();
    const refused = recordMAROutcome(event, {
      outcome: 'refused',
      supportedOrAdministeredAt: '2026-07-08T08:20:00.000Z',
      recordedAt: '2026-07-08T08:22:00.000Z',
      recordedBy: 'Staff A',
      reason: 'Resident declined after two prompts.',
      idempotencyKey: 'idem-refused-2',
      expectedEventVersion: 1,
    });

    const exceptions = detectMARExceptions({
      events: [firstEvent(), refused],
      orderVersions: [activeOrder({ reviewDate: '2026-07-01' })],
      now: '2026-07-08T10:00:00.000Z',
    });

    expect(exceptions.map(item => item.type)).toEqual(expect.arrayContaining([
      'no_outcome_recorded',
      'overdue',
      'refusal_recorded',
      'medicine_review_overdue',
    ]));
  });

  it('appends manager corrections without erasing the original MAR event', () => {
    const original = recordMAROutcome(firstEvent(), {
      outcome: 'missed',
      supportedOrAdministeredAt: '2026-07-08T08:35:00.000Z',
      recordedAt: '2026-07-08T08:40:00.000Z',
      recordedBy: 'Staff A',
      reason: 'Medicine was not available during round.',
      idempotencyKey: 'idem-missed-1',
      expectedEventVersion: 1,
    });

    const corrected = createMARCorrection(original, {
      by: 'Manager',
      at: '2026-07-08T10:00:00.000Z',
      reason: 'Pharmacy record confirmed medicine was available; outcome corrected after review.',
      correctedOutcome: 'administered',
      correctedSupportedOrAdministeredAt: '2026-07-08T08:45:00.000Z',
      correctedRecordedAt: '2026-07-08T10:00:00.000Z',
    });

    expect(corrected.outcome).toBe('administered');
    expect(corrected.correctionHistory[0]).toMatchObject({
      originalOutcome: 'missed',
      correctedOutcome: 'administered',
      by: 'Manager',
    });
  });

  it('enforces medication capability, competency, and location scope before recording', () => {
    const access: MedicationAccessProfile = {
      userId: 'staff-a',
      capabilities: ['medicines.view', 'medicines.record_outcome'],
      scopes: [{ house: 'Station House' }],
      medicationCompetency: {
        current: true,
        expiresAt: '2026-12-31',
        assessor: 'Medication Lead',
      },
    };

    expect(canRecordMedicationOutcome(access, { house: 'Station House', now: '2026-07-08T08:00:00.000Z' }).allowed).toBe(true);
    expect(canRecordMedicationOutcome({ ...access, medicationCompetency: { ...access.medicationCompetency, current: false } }, {
      house: 'Station House',
      now: '2026-07-08T08:00:00.000Z',
    })).toMatchObject({ allowed: false, reason: 'Medication competency is not current.' });
  });

  it('builds a MAR export with resident, order, event, corrections, and audit data', () => {
    const order = activeOrder();
    const event = recordMAROutcome(firstEvent(), {
      outcome: 'administered',
      supportedOrAdministeredAt: '2026-07-08T08:05:00.000Z',
      recordedAt: '2026-07-08T08:07:00.000Z',
      recordedBy: 'Staff A',
      reason: '',
      idempotencyKey: 'idem-export-1',
      expectedEventVersion: 1,
    });

    const pack = buildMARAuditExport({
      profile,
      orderVersions: [order],
      events: [event],
      exceptions: [],
      generatedAt: '2026-07-08T12:00:00.000Z',
    });

    expect(pack.text).toContain('MAR AUDIT PACK');
    expect(pack.text).toContain('Anthony Cook');
    expect(pack.text).toContain('Metformin tablets 500mg');
    expect(pack.text).toContain('Outcome: administered');
    expect(pack.csv).toContain('residentName,medicineName,scheduledFor,outcome,recordedBy,recordedAt');
  });

  it('records PRN administration as a protocol-driven event with reason and effect review', () => {
    const prnProtocol: PRNProtocol = {
      id: 'prn-paracetamol-1',
      medicineOrderVersionId: 'order-prn-v1',
      indication: 'Pain reported by resident.',
      dose: '500mg',
      route: 'Oral',
      minimumIntervalHours: 4,
      maxAdministrationsPer24h: 4,
      actionsBeforeAdministration: ['Offer fluids', 'Check pain location'],
      effectReviewMinutes: 60,
      escalationInstructions: 'Escalate to nurse/manager if pain persists.',
      reviewDate: '2026-09-01',
      authorisedEvidenceId: 'ev-prn-protocol',
    };
    const prnOrder = activeOrder({
      id: 'order-prn-v1',
      orderId: 'order-prn',
      medicineName: 'Paracetamol',
      schedule: { kind: 'fixed_times', times: ['14:00'], windowMinutesBefore: 0, windowMinutesAfter: 60 },
    });

    const prnEvent = recordPRNAdministration({
      profile,
      orderVersion: prnOrder,
      protocol: prnProtocol,
      reason: 'Resident reported headache 7/10.',
      administeredAt: '2026-07-08T14:00:00.000Z',
      recordedAt: '2026-07-08T14:03:00.000Z',
      recordedBy: 'Staff A',
      idempotencyKey: 'idem-prn-1',
    });

    expect(prnEvent.outcome).toBe('administered');
    expect(prnEvent.status).toBe('awaiting_effect_review');
    expect(prnEvent.prnReason).toBe('Resident reported headache 7/10.');
    expect(prnEvent.prnProtocolId).toBe('prn-paracetamol-1');
    expect(prnEvent.effectReviewDueAt).toBe('2026-07-08T15:00:00.000Z');
  });

  it('creates and activates a medicine change request with second-check', () => {
    const currentOrder = activeOrder({ id: 'order-change-v1', orderId: 'order-change' });
    const proposed = createMedicineOrderVersion({
      orderId: 'order-change',
      residentId: profile.residentId,
      medicineName: 'Metformin',
      formulation: 'tablets',
      strength: '500mg',
      dose: '2 tablets',
      route: 'Oral',
      schedule: { kind: 'fixed_times', times: ['08:00', '18:00'], windowMinutesBefore: 30, windowMinutesAfter: 90 },
      instructions: 'Dose increased.',
      authorisationSourceType: 'gp_instruction',
      authorisationEvidenceId: 'ev-gp-change',
      authorisedByExternalProfessional: 'Priory Surgery',
      sourceReceivedAt: '2026-07-08T10:00:00.000Z',
      verifiedBy: 'Medication Lead',
      verifiedAt: '2026-07-08T10:30:00.000Z',
      effectiveFrom: '2026-07-09T00:00:00.000Z',
      createdAt: '2026-07-08T10:30:00.000Z',
    });

    const request = createMedicationChangeRequest({
      residentId: profile.residentId,
      sourceType: 'gp_instruction',
      sourceReceivedAt: '2026-07-08T10:00:00.000Z',
      sourceDocumentId: 'ev-gp-change',
      recordedBy: 'Senior',
      effectiveFrom: '2026-07-09',
      proposedVersion: proposed,
      affectedFutureEventIds: [`mar-${currentOrder.id}-2026-07-09-08-00`],
    });

    expect(request.reviewStatus).toBe('pending');
    expect(request.proposedVersion).toBeDefined();

    const activated = activateMedicationChangeRequest(request, {
      verifiedBy: 'Registered Manager',
      secondCheckedBy: 'Nurse Reviewer',
      activatedAt: '2026-07-08T13:00:00.000Z',
    });

    expect(activated.reviewStatus).toBe('verified');
    expect(activated.activatedVersion?.status).toBe('active');
    expect(activated.activatedVersion?.dose).toBe('2 tablets');
    expect(activated.activatedVersion?.activationMeaning).toBe('authorised_instructions_verified_not_clinically_approved');
  });

  it('includes downtime procedure in the MAR audit export', () => {
    const order = activeOrder();
    const event = recordMAROutcome(firstEvent(), {
      outcome: 'administered',
      supportedOrAdministeredAt: '2026-07-08T08:05:00.000Z',
      recordedAt: '2026-07-08T08:07:00.000Z',
      recordedBy: 'Staff A',
      reason: '',
      idempotencyKey: 'idem-downtime-1',
      expectedEventVersion: 1,
    });

    const pack = buildMARAuditExport({
      profile,
      orderVersions: [order],
      events: [event],
      exceptions: [],
      generatedAt: '2026-07-08T12:00:00.000Z',
      downtimeProcedure: {
        label: 'Emergency paper MAR',
        summary: 'If the electronic system is unavailable, print/read the emergency MAR and reconcile paper entries.',
        emergencyPrintAvailable: true,
      },
    });

    expect(pack.text).toContain('DOWNTIME PROCEDURE');
    expect(pack.text).toContain('Emergency paper MAR');
    expect(pack.text).toContain('Emergency print available: Yes');
  });

  it('enforces round-level assignment when currentAssignments are specified', () => {
    const access: MedicationAccessProfile = {
      userId: 'staff-b',
      capabilities: ['medicines.view', 'medicines.record_outcome'],
      scopes: [{ house: 'Station House' }],
      medicationCompetency: { current: true, expiresAt: '2026-12-31', assessor: 'Medication Lead' },
      currentAssignments: [{ house: 'Station House', residentId: 'resident-tony', roundId: 'round-morning' }],
    };

    expect(canRecordMedicationOutcome(access, {
      house: 'Station House',
      residentId: 'resident-tony',
      roundId: 'round-morning',
      now: '2026-07-08T08:00:00.000Z',
    }).allowed).toBe(true);

    expect(canRecordMedicationOutcome(access, {
      house: 'Station House',
      residentId: 'resident-tony',
      roundId: 'round-afternoon',
      now: '2026-07-08T08:00:00.000Z',
    }).allowed).toBe(false);
  });

  it('maps external MAR/audit uploads to unverified evidence instead of active orders', () => {
    const marEvidence = evidenceFromNourishMARHtml({
      id: 'ev-nourish-html',
      sourceName: 'Medication administration report.html',
      html: 'Metformin tablets Dose 1 tablet twice daily Route Oral Frequency Every day Time period Morning (08:15 - 11:59) Instruction Support',
      receivedAt: '2026-07-08T08:00:00.000Z',
    });
    const auditEvidence = evidenceFromMedicationAuditText({
      id: 'ev-cook-audit',
      sourceName: 'Cook_Mar-Jul2026.Med Audit.pdf',
      text: 'Medication Management Audit Form - CM54 365 Administered/Supported, 136 No Outcome Recorded Flucloxacillin started 26/06 for leg cellulitis',
      receivedAt: '2026-07-08T08:00:00.000Z',
    });

    expect(marEvidence.reviewState).toBe('review_required');
    expect(marEvidence.extractedFields).toEqual(expect.arrayContaining(['medicineName', 'dose', 'route', 'frequency', 'timePeriod', 'instruction']));
    expect(auditEvidence.reviewState).toBe('review_required');
    expect(auditEvidence.excerpt).toContain('136 No Outcome Recorded');
  });
});
