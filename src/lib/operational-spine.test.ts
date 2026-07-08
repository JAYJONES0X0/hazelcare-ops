import { describe, expect, it } from 'vitest';
import { emptyClient, type FullClient, type PackFileManifestRow, type VaultDoc } from './client-store';
import { clientLiveGateSummary } from './client-pack';
import type { Action, CareEntry, WeekSummary } from './types';
import {
  buildClientPackReviewQueue,
  buildHandoverDraft,
  buildHouseDailyState,
  buildWeeklyUpdateDraft,
  evidenceFromPackManifestRow,
  evidenceFromVaultDoc,
  mapActionToOperationalState,
  promoteActionCandidate,
  reviewDiaryEvidence,
  reviewStaffSafetyEvidence,
  toNourishSafeText,
} from './operational-spine';

function entry(partial: Partial<CareEntry>): CareEntry {
  return {
    id: partial.id || `e-${Math.random()}`,
    date: partial.date || '18/06/2026',
    time: partial.time || '09:00',
    house: partial.house || 'Station House',
    type: partial.type || 'Daily Support',
    carer: partial.carer || 'Staff',
    client: partial.client || 'Alistair Gunn',
    entry: partial.entry || 'Support offered and accepted.',
    severity: partial.severity || 'none',
    flags: partial.flags || [],
    category: partial.category || 'daily_support',
  };
}

function week(entries: CareEntry[]): WeekSummary {
  return {
    dateFrom: '18/06/2026',
    dateTo: '18/06/2026',
    totalEntries: entries.length,
    houses: {
      'Station House': {
        name: 'Station House',
        coordinator: 'Manager',
        entries,
        incidents: entries.filter(e => e.category === 'incident'),
        safeguarding: [],
        medication: entries.filter(e => e.category === 'medication'),
        staffPerformance: [],
        healthSafety: [],
        handovers: [],
        dailySupport: entries.filter(e => e.category === 'daily_support'),
        flags: {
          red: entries.filter(e => e.severity === 'red').length,
          amber: entries.filter(e => e.severity === 'amber').length,
          green: entries.filter(e => e.severity === 'green').length,
        },
      },
    },
    allFlags: {
      red: entries.filter(e => e.severity === 'red'),
      amber: entries.filter(e => e.severity === 'amber'),
      green: entries.filter(e => e.severity === 'green'),
    },
    entryTypes: {},
    clients: Array.from(new Set(entries.map(e => e.client))),
    carers: Array.from(new Set(entries.map(e => e.carer))),
    clientDiary: entries.reduce<Record<string, CareEntry[]>>((acc, e) => {
      (acc[e.client] ??= []).push(e);
      return acc;
    }, {}),
  };
}

describe('operational spine', () => {
  it('maps pack manifest and vault documents into review-aware evidence items', () => {
    const row: PackFileManifestRow = {
      fileId: 'file-contact',
      packId: 'pack-1',
      originalFileName: 'Contact-details.pdf',
      fileType: 'pdf',
      sizeBytes: 1234,
      category: 'contact_details',
      classificationConfidence: 0.88,
      parseStatus: 'PARTIAL',
      targetScreen: 'Care Circle',
      clientMatch: {
        clientId: 'client-1',
        name: 'Alistair Gunn',
        confidence: 0.91,
        matchReason: 'Name and DOB candidate match.',
      },
      extractedFieldsCount: 4,
      evidenceLinksCreated: 2,
      reviewRequired: true,
      rejectedReasons: ['Only partial structured evidence was extracted.'],
      vaultAttachmentStatus: 'attached',
    };
    const vaultDoc: VaultDoc = {
      id: 'vault-care-plan',
      name: 'Care Plan.pdf',
      text: 'Current care plan source. Support with nutrition, medication, and community access.',
      uploadedAt: '2026-06-18T10:00:00.000Z',
      packId: 'pack-1',
      fileId: 'file-care-plan',
      category: 'care_plan',
      parseStatus: 'PARSED',
      classificationConfidence: 0.93,
      reviewRequired: false,
      sourceFileName: 'Care Plan.pdf',
      targetScreen: 'Care Plan',
      rejectedReasons: [],
    };

    expect(evidenceFromPackManifestRow(row)).toMatchObject({
      id: 'ev-pack-file-contact',
      sourceType: 'client_pack_file',
      sourceId: 'file-contact',
      title: 'Contact-details.pdf',
      resident: 'Alistair Gunn',
      confidence: 0.88,
      reviewState: 'review_required',
      usedForOutput: false,
    });
    expect(evidenceFromVaultDoc(vaultDoc, 'Alistair Gunn')).toMatchObject({
      id: 'ev-vault-vault-care-plan',
      sourceType: 'vault_document',
      sourceId: 'vault-care-plan',
      title: 'Care Plan.pdf',
      resident: 'Alistair Gunn',
      confidence: 0.93,
      reviewState: 'unreviewed',
      usedForOutput: false,
    });
  });

  it('builds one shared client pack review queue from pack and live-gate state', () => {
    const reviewRow: PackFileManifestRow = {
      fileId: 'file-unknown',
      packId: 'pack-1',
      originalFileName: 'unknown-scan.pdf',
      fileType: 'pdf',
      sizeBytes: 2048,
      category: 'unknown',
      classificationConfidence: 0.22,
      parseStatus: 'OCR_REQUIRED',
      targetScreen: 'Review Queue',
      clientMatch: { clientId: 'client-1', name: 'Alistair Gunn', confidence: 0.72, matchReason: 'Candidate identity inferred.' },
      extractedFieldsCount: 0,
      evidenceLinksCreated: 0,
      reviewRequired: true,
      rejectedReasons: ['No extractable text was found.'],
      vaultAttachmentStatus: 'attached',
    };
    const parsedRow: PackFileManifestRow = {
      ...reviewRow,
      fileId: 'file-care-plan',
      originalFileName: 'Care Plan.pdf',
      category: 'care_plan',
      classificationConfidence: 0.91,
      parseStatus: 'PARSED',
      targetScreen: 'Care Plan',
      extractedFieldsCount: 8,
      evidenceLinksCreated: 8,
      reviewRequired: false,
      rejectedReasons: [],
    };
    const client: FullClient = {
      ...emptyClient(),
      id: 'client-1',
      name: 'Alistair Gunn',
      onboardingStatus: 'DRAFT_CLIENT',
      liveGateSummary: clientLiveGateSummary({
        identityReviewed: false,
        hasCarePlanSource: true,
        riskReviewed: false,
        contactsReviewed: false,
        unresolvedFiles: 1,
      }),
      packImports: [{
        packId: 'pack-1',
        uploadedAt: '2026-06-18T10:00:00.000Z',
        uploadedBy: 'tester',
        sourceName: 'OneDrive_1_6-15-2026.zip',
        sourceType: 'zip',
        status: 'DRAFT_CLIENT',
        candidateClientId: 'client-1',
        candidateClientName: 'Alistair Gunn',
        identityConfidence: 0.72,
        filesTotal: 2,
        filesParsed: 1,
        filesAttached: 1,
        filesFailed: 0,
        filesNeedsReview: 1,
        manifestRows: [reviewRow, parsedRow],
        auditEventIds: [],
      }],
    };

    const rows = buildClientPackReviewQueue([client]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clientId: 'client-1',
      clientName: 'Alistair Gunn',
      onboardingStatus: 'DRAFT_CLIENT',
      parsedFiles: 1,
      totalFiles: 2,
      needsReviewCount: 1,
      liveReady: false,
      nextAction: 'Review manifest',
    });
    expect(rows[0].missingCriticalEvidence).toContain('Confirm name, DOB, NHS/person ID, and duplicate/merge decision.');
  });

  it('does not show phantom pack imports that have no inventoried files', () => {
    const client: FullClient = {
      ...emptyClient(),
      id: 'client-empty-pack',
      name: 'Draft Shell',
      onboardingStatus: 'DRAFT_CLIENT',
      liveGateSummary: clientLiveGateSummary({
        identityReviewed: false,
        hasCarePlanSource: false,
        riskReviewed: false,
        contactsReviewed: false,
        unresolvedFiles: 0,
      }),
      packImports: [{
        packId: 'pack-empty',
        uploadedAt: '2026-06-18T10:00:00.000Z',
        uploadedBy: 'tester',
        sourceName: 'stale-empty-pack',
        sourceType: 'zip',
        status: 'DRAFT_CLIENT',
        candidateClientId: 'client-empty-pack',
        candidateClientName: 'Draft Shell',
        identityConfidence: 0,
        filesTotal: 0,
        filesParsed: 0,
        filesAttached: 0,
        filesFailed: 0,
        filesNeedsReview: 0,
        manifestRows: [],
        auditEventIds: [],
      }],
    };

    expect(buildClientPackReviewQueue([client])).toEqual([]);
  });

  it('reviews diary evidence without hiding weak entries', () => {
    const data = week([
      entry({ id: 'e1', entry: 'Alistair accepted support with breakfast and medication. GP appointment needs follow up.' }),
      entry({ id: 'e2', entry: 'All fine.' }),
    ]);

    const result = reviewDiaryEvidence({ weekData: data, house: 'Station House', resident: 'Alistair Gunn' });

    expect(result.evidence).toHaveLength(2);
    expect(result.weakEvidence.map(e => e.sourceId)).toContain('e2');
    expect(result.actionCandidates[0]).toMatchObject({
      resident: 'Alistair Gunn',
      carryForward: true,
      status: 'open',
    });
    expect(result.actionCandidates[0].sourceEvidence?.[0].sourceType).toBe('diary_entry');
  });

  it('promotes diary action candidates into tracked actions with evidence history', () => {
    const data = week([
      entry({ id: 'e1', entry: 'Alistair accepted support with breakfast. Follow up GP appointment needs booking.' }),
    ]);
    const review = reviewDiaryEvidence({ weekData: data, house: 'Station House', resident: 'Alistair Gunn' });

    const promoted = promoteActionCandidate(review.actionCandidates[0], {
      owner: 'Deputy Manager',
      dueDate: '20/06/2026',
      createdAt: '2026-06-18T10:00:00.000Z',
    });

    expect(promoted.id).not.toContain('candidate-');
    expect(promoted.owner).toBe('Deputy Manager');
    expect(promoted.dueDate).toBe('20/06/2026');
    expect(promoted.operationalState).toBe('not_started');
    expect(promoted.sourceEvidence?.map(e => e.sourceId)).toContain('e1');
    expect(promoted.stateHistory?.[0]).toMatchObject({
      to: 'not_started',
      by: 'Deputy Manager',
      reason: 'Promoted from diary review evidence.',
      evidenceIds: ['ev-e1'],
    });
  });

  it('builds staff-safety review without pretending to decide safeguarding or police action', () => {
    const result = reviewStaffSafetyEvidence({
      entries: [
        entry({
          id: 's1',
          entry: 'Resident became verbally aggressive, made threats to staff, damaged property and other residents were affected.',
          severity: 'red',
          category: 'incident',
        }),
      ],
      house: 'Station House',
    });

    expect(result.categories).toEqual(expect.arrayContaining(['verbal_aggression', 'threats', 'property_damage', 'other_residents_affected']));
    expect(result.reviewRequired).toBe(true);
    expect(result.decisionBoundary).toContain('guides review; it does not make safeguarding, police, or clinical decisions.');
    expect(result.actionCandidates[0]).toMatchObject({
      house: 'Station House',
      priority: 'critical',
      operationalState: 'escalated',
      carryForward: true,
    });
    expect(result.outputDraft.text).toContain('STAFF SAFETY REVIEW');
  });

  it('creates recipient-aware weekly drafts and keeps family text source-safe', () => {
    const data = week([
      entry({ id: 'e1', entry: 'Alistair enjoyed a community walk and accepted support with lunch.' }),
    ]);
    const review = reviewDiaryEvidence({ weekData: data, house: 'Station House', resident: 'Alistair Gunn' });
    const draft = buildWeeklyUpdateDraft({
      resident: 'Alistair Gunn',
      recipientType: 'family',
      summary: review.residentSummaries[0],
      evidence: review.evidence,
    });

    expect(draft.text).toContain('FAMILY UPDATE - Alistair Gunn');
    expect(draft.text).not.toContain('Source evidence retained internally');
    expect(draft.reviewRequired).toBe(true);
  });

  it('normalises output into record-system safe plain text', () => {
    const text = toNourishSafeText('**UPDATE**\n- Action: call GP\n| table | row |\n[ ] checkbox\n✅ done');
    expect(text).toBe('UPDATE\nAction: call GP\ntable   row\ncheckbox\ndone');
  });

  it('builds house command state from real evidence and action states', () => {
    const data = week([
      entry({ id: 'e1', entry: 'GP appointment booked and medication review discussed.' }),
      entry({ id: 'e2', entry: 'Incident escalated to manager for review.', severity: 'red', category: 'incident' }),
    ]);
    const actions: Action[] = [{
      id: 'a1',
      title: 'Chase GP outcome',
      description: 'Waiting for GP response',
      house: 'Station House',
      owner: 'Manager',
      priority: 'high',
      status: 'blocked',
      createdAt: '18/06/2026',
      dueDate: '',
      tags: ['gp'],
    }];

    const state = buildHouseDailyState({ weekData: data, actions, house: 'Station House' });

    expect(state.evidenceCount).toBe(2);
    expect(state.appointments.length).toBeGreaterThan(0);
    expect(state.escalationFlags.length).toBeGreaterThan(0);
    expect(state.waitingProfessionals).toHaveLength(1);
    expect(mapActionToOperationalState(actions[0])).toBe('waiting_professional');
  });

  it('builds a review-required handover draft from evidence and open actions', () => {
    const data = week([
      entry({ id: 'e1', entry: 'Alistair was supported with medication. Follow up GP review tomorrow.' }),
    ]);
    const draft = buildHandoverDraft({
      weekData: data,
      house: 'Station House',
      actions: [{
        id: 'a1',
        title: 'Confirm GP appointment',
        description: 'Waiting professional',
        house: 'Station House',
        owner: 'Coordinator',
        priority: 'high',
        status: 'blocked',
        createdAt: '18/06/2026',
        dueDate: '',
        tags: ['gp'],
      }],
    });

    expect(draft.text).toContain('MANAGER HANDOVER - STATION HOUSE');
    expect(draft.text).toContain('OPEN ACTIONS');
    expect(draft.sourceEvidence).toHaveLength(1);
    expect(draft.reviewRequired).toBe(true);
  });
});
