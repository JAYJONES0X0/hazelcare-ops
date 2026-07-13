/**
 * ═══════════════════════════════════════════════════════════════
 * ARCHIVED — tests for the superseded medication-mar.ts
 *
 * These tests were written against medication-mar.ts which has
 * been archived due to spec violations. They are kept as a
 * reference for V1B features (PRN, change request, downtime).
 *
 * The canonical test suite is client-medication.test.ts.
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'vitest';
import {
  activateMedicationChangeRequest,
  buildMedicationAuditPack,
  canRecordMedicationOutcome,
  createMARCorrection,
  createMedicationChangeRequest,
  detectMARExceptions,
  generateMARAdministrationEvents,
  recordMAROutcome,
  recordPRNAdministration,
  type MARAdministrationEvent,
  type MedicationAccessProfile,
  type MedicationProfile,
  type MedicineOrder,
  type PRNProtocol,
} from './medication-mar.archived';

const profile: MedicationProfile = {
  id: 'med-profile-tony',
  residentId: 'resident-tony',
  residentName: 'Anthony Cook',
  dateOfBirth: '1965-04-10',
  house: 'Station House',
  allergies: [{ substance: 'Penicillin', reaction: 'Rash', recordedAt: '2026-07-01T09:00:00.000Z' }],
  consentStatus: 'recorded',
  reviewState: 'reviewed',
  retentionPolicy: {
    retainUntil: '2034-07-08',
    basis: 'Adult social care MAR retention policy.',
  },
};

const order: MedicineOrder = {
  id: 'order-metformin-v1',
  profileId: profile.id,
  residentId: profile.residentId,
  medicineName: 'Metformin',
  formulation: 'tablet',
  strength: '500mg',
  dose: '1 tablet',
  route: 'oral',
  frequency: 'daily',
  scheduleKind: 'fixed_window',
  timeWindows: [{ label: 'Morning', start: '08:00', end: '10:00' }],
  instructions: 'Take with breakfast.',
  effectiveFrom: '2026-07-08',
  status: 'active',
  version: 1,
  authorisedSource: {
    type: 'pharmacy_label',
    title: 'Pharmacy label July 2026',
    receivedAt: '2026-07-07T12:00:00.000Z',
    verifiedBy: 'Registered Manager',
    verifiedAt: '2026-07-07T13:00:00.000Z',
  },
  reviewState: 'reviewed',
};

const access: MedicationAccessProfile = {
  userId: 'staff-1',
  displayName: 'Staff One',
  capabilities: ['medicines.view', 'medicines.record_outcome'],
  scopes: [{ house: profile.house, residentId: profile.residentId }],
  competencies: [{
    type: 'medicines_recording',
    house: profile.house,
    validUntil: '2026-12-31',
    status: 'current',
  }],
  currentAssignments: [{ house: profile.house, residentId: profile.residentId, roundId: 'round-morning' }],
};

function firstEvent(overrides: Partial<MARAdministrationEvent> = {}): MARAdministrationEvent {
  return {
    ...generateMARAdministrationEvents({
      profile,
      orders: [order],
      date: '2026-07-08',
      roundId: 'round-morning',
    })[0],
    ...overrides,
  };
}

describe('medication safety and MAR governance (archived — for reference only)', () => {
  it('generates scheduled MAR events only from verified active medicine orders', () => {
    const pending: MedicineOrder = {
      ...order,
      id: 'order-unverified',
      status: 'pending_verification',
      authorisedSource: {
        type: 'discharge_summary',
        title: 'Hospital discharge',
        receivedAt: '2026-07-08T10:00:00.000Z',
      },
    };

    const events = generateMARAdministrationEvents({
      profile,
      orders: [order, pending],
      date: '2026-07-08',
      roundId: 'round-morning',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      residentId: profile.residentId,
      medicineName: 'Metformin',
      scheduledFor: '2026-07-08T08:00:00.000Z',
      windowStart: '2026-07-08T08:00:00.000Z',
      windowEnd: '2026-07-08T10:00:00.000Z',
      systemStatuses: ['due'],
      outcome: undefined,
    });
  });

  it('records staff outcomes separately from derived system statuses and requires supported/recorded times', () => {
    const recorded = recordMAROutcome(firstEvent(), {
      outcome: 'administered',
      supportedOrAdministeredAt: '2026-07-08T08:10:00.000Z',
      recordedAt: '2026-07-08T09:45:00.000Z',
      recordedBy: 'Staff One',
      access,
    });

    expect(recorded.outcome).toBe('administered');
    expect(recorded.supportedOrAdministeredAt).toBe('2026-07-08T08:10:00.000Z');
    expect(recorded.recordedAt).toBe('2026-07-08T09:45:00.000Z');
    expect(recorded.systemStatuses).toContain('recorded_late');
    expect(recorded.systemStatuses).not.toContain('no_outcome_recorded');

    expect(() => recordMAROutcome(firstEvent(), {
      outcome: 'no_outcome_recorded' as never,
      supportedOrAdministeredAt: '2026-07-08T08:10:00.000Z',
      recordedAt: '2026-07-08T08:11:00.000Z',
      recordedBy: 'Staff One',
      access,
    })).toThrow('no_outcome_recorded is a system-derived status, not a staff outcome.');
  });

  it('requires a reason for refused, missed, withheld, cancelled, and not-available outcomes', () => {
    expect(() => recordMAROutcome(firstEvent(), {
      outcome: 'refused',
      supportedOrAdministeredAt: '2026-07-08T08:10:00.000Z',
      recordedAt: '2026-07-08T08:11:00.000Z',
      recordedBy: 'Staff One',
      access,
    })).toThrow('A reason is required for refused medication outcomes.');

    const refused = recordMAROutcome(firstEvent(), {
      outcome: 'refused',
      supportedOrAdministeredAt: '2026-07-08T08:10:00.000Z',
      recordedAt: '2026-07-08T08:11:00.000Z',
      recordedBy: 'Staff One',
      reason: 'Resident declined after two prompts and said they felt nauseous.',
      access,
    });

    expect(refused.reviewRequired).toBe(true);
    expect(refused.systemStatuses).toContain('review_required');
  });

  it('keeps corrections append-only and leaves the original MAR entry visible', () => {
    const refused = recordMAROutcome(firstEvent(), {
      outcome: 'refused',
      supportedOrAdministeredAt: '2026-07-08T08:10:00.000Z',
      recordedAt: '2026-07-08T08:11:00.000Z',
      recordedBy: 'Staff One',
      reason: 'Resident declined.',
      access,
    });

    const corrected = createMARCorrection(refused, {
      correctedOutcome: 'administered',
      correctedSupportedOrAdministeredAt: '2026-07-08T08:45:00.000Z',
      correctedBy: 'Senior',
      correctedAt: '2026-07-08T09:00:00.000Z',
      reason: 'Resident later accepted after breakfast; original refusal remains in audit trail.',
    });

    expect(corrected.outcome).toBe('refused');
    expect(corrected.corrections).toHaveLength(1);
    expect(corrected.corrections[0]).toMatchObject({
      originalOutcome: 'refused',
      correctedOutcome: 'administered',
      correctedBy: 'Senior',
    });
    expect(corrected.systemStatuses).toContain('corrected');
  });

  it('treats PRN as a protocol-driven schedule type with reason and effect review, not an outcome', () => {
    const prn: PRNProtocol = {
      id: 'prn-paracetamol',
      orderId: 'order-paracetamol-prn',
      indication: 'Pain reported by resident.',
      dose: '500mg',
      route: 'oral',
      minimumIntervalHours: 4,
      maxAdministrationsPer24h: 4,
      actionsBeforeAdministration: ['Offer fluids', 'Check pain location'],
      effectReviewMinutes: 60,
      escalationInstructions: 'Escalate to nurse/manager if pain persists.',
      reviewDate: '2026-08-01',
      authorisedEvidenceId: 'ev-prn-source',
    };

    const prnEvent = recordPRNAdministration({
      profile,
      order: { ...order, id: 'order-paracetamol-prn', medicineName: 'Paracetamol', frequency: 'prn', scheduleKind: 'prn' },
      protocol: prn,
      reason: 'Resident reported headache 7/10.',
      administeredAt: '2026-07-08T14:00:00.000Z',
      recordedAt: '2026-07-08T14:03:00.000Z',
      recordedBy: 'Staff One',
      access,
    });

    expect(prnEvent.outcome).toBe('administered');
    expect(prnEvent.scheduleKind).toBe('prn');
    expect(prnEvent.prnReason).toBe('Resident reported headache 7/10.');
    expect(prnEvent.effectReviewDueAt).toBe('2026-07-08T15:00:00.000Z');
    expect(prnEvent.systemStatuses).toContain('awaiting_effect_review');
  });

  it('requires medication capability, current competency, scope, and assignment before recording', () => {
    expect(canRecordMedicationOutcome(access, {
      house: profile.house,
      residentId: profile.residentId,
      roundId: 'round-morning',
      at: '2026-07-08T08:00:00.000Z',
    })).toMatchObject({ allowed: true });

    const expired: MedicationAccessProfile = {
      ...access,
      competencies: [{ ...access.competencies[0], validUntil: '2026-01-01' }],
    };

    expect(canRecordMedicationOutcome(expired, {
      house: profile.house,
      residentId: profile.residentId,
      roundId: 'round-morning',
      at: '2026-07-08T08:00:00.000Z',
    })).toMatchObject({
      allowed: false,
      reason: 'Medication recording competency is not current for this service.',
    });
  });

  it('creates medicine changes as pending evidence until verified and second-checked', () => {
    const request = createMedicationChangeRequest({
      residentId: profile.residentId,
      sourceType: 'hospital_discharge',
      sourceReceivedAt: '2026-07-08T12:00:00.000Z',
      sourceDocumentId: 'ev-discharge',
      recordedBy: 'Senior',
      effectiveFrom: '2026-07-09',
      proposedOrder: {
        ...order,
        id: 'order-metformin-v2',
        dose: '2 tablets',
        version: 2,
        status: 'pending_verification',
      },
      affectedFutureEventIds: ['mar-order-metformin-v1-2026-07-09-Morning'],
    });

    expect(request.reviewStatus).toBe('pending_second_check');
    expect(request.proposedOrder.status).toBe('pending_verification');

    const activated = activateMedicationChangeRequest(request, {
      verifiedBy: 'Registered Manager',
      secondCheckedBy: 'Nurse Reviewer',
      activatedAt: '2026-07-08T13:00:00.000Z',
    });

    expect(activated.reviewStatus).toBe('activated');
    expect(activated.activatedOrder.status).toBe('active');
    expect(activated.activatedOrder.version).toBe(2);
  });

  it('detects no-outcome, outside-window, and repeated refusal exceptions without hiding uncertainty', () => {
    const overdue = firstEvent();
    const outside = recordMAROutcome(firstEvent({ id: 'mar-outside' }), {
      outcome: 'administered',
      supportedOrAdministeredAt: '2026-07-08T11:30:00.000Z',
      recordedAt: '2026-07-08T11:35:00.000Z',
      recordedBy: 'Staff One',
      access,
    });
    const refusedEvents = [0, 1, 2].map(i => recordMAROutcome(firstEvent({ id: `mar-refused-${i}`, scheduledFor: `2026-07-0${6 + i}T08:00:00.000Z` }), {
      outcome: 'refused',
      supportedOrAdministeredAt: `2026-07-0${6 + i}T08:10:00.000Z`,
      recordedAt: `2026-07-0${6 + i}T08:12:00.000Z`,
      recordedBy: 'Staff One',
      reason: 'Resident declined.',
      access,
    }));

    const exceptions = detectMARExceptions({
      events: [overdue, outside, ...refusedEvents],
      now: '2026-07-08T10:30:00.000Z',
    });

    expect(exceptions.map(item => item.type)).toEqual(expect.arrayContaining([
      'no_outcome_recorded',
      'recorded_outside_window',
      'repeated_refusal',
    ]));
    expect(exceptions.every(item => !/blame|fault|neglig/i.test(item.message))).toBe(true);
  });

  it('builds an audit pack with downtime and retention policy without requiring stock or CD modules in V1', () => {
    const recorded = recordMAROutcome(firstEvent(), {
      outcome: 'administered',
      supportedOrAdministeredAt: '2026-07-08T08:10:00.000Z',
      recordedAt: '2026-07-08T08:12:00.000Z',
      recordedBy: 'Staff One',
      access,
    });

    const pack = buildMedicationAuditPack({
      profile,
      orders: [order],
      events: [recorded],
      exceptions: [],
      dateFrom: '2026-07-08',
      dateTo: '2026-07-08',
      generatedAt: '2026-07-08T18:00:00.000Z',
      downtimeProcedure: {
        label: 'Emergency paper MAR',
        summary: 'If the electronic system is unavailable, print/read the emergency MAR and reconcile paper entries back into CareOps as downtime records.',
        emergencyPrintAvailable: true,
      },
    });

    expect(pack.summary).toMatchObject({
      totalEvents: 1,
      recordedEvents: 1,
      openExceptions: 0,
      stockModuleIncluded: false,
      controlledDrugModuleIncluded: false,
    });
    expect(pack.retention).toEqual(profile.retentionPolicy);
    expect(pack.downtimeProcedure.emergencyPrintAvailable).toBe(true);
  });
});
