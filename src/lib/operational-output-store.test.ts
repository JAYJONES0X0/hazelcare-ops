import { describe, expect, it, beforeEach } from 'vitest';
import type { EvidenceItem, OutputDraft } from './types';
import {
  clearOperationalOutputRecords,
  loadCommunicationRecords,
  loadOutputDrafts,
  saveCommunicationRecordForDraft,
  saveOutputDraft,
} from './operational-output-store';

const evidence: EvidenceItem = {
  id: 'ev-e1',
  sourceType: 'diary_entry',
  sourceId: 'e1',
  title: 'Alistair Gunn - Daily Support',
  resident: 'Alistair Gunn',
  house: 'Station House',
  date: '18/06/2026',
  excerpt: 'Support offered and accepted.',
  confidence: 0.78,
  reviewState: 'unreviewed',
  usedForOutput: true,
};

function draft(): OutputDraft {
  return {
    id: 'draft-1',
    type: 'weekly_update',
    recipientType: 'family',
    resident: 'Alistair Gunn',
    house: 'Station House',
    dateFrom: '18/06/2026',
    dateTo: '18/06/2026',
    text: 'FAMILY UPDATE - Alistair Gunn',
    sourceEvidence: [evidence],
    missingEvidence: ['Contact consent missing.'],
    reviewRequired: true,
    createdAt: '2026-06-18T10:00:00.000Z',
  };
}

describe('operational output store', () => {
  beforeEach(() => {
    clearOperationalOutputRecords();
  });

  it('persists output drafts with source evidence and logs communication records against the draft', () => {
    const savedDraft = saveOutputDraft(draft());
    const savedRecord = saveCommunicationRecordForDraft(savedDraft, {
      status: 'copied',
      summary: 'Family update copied for manager review.',
      recipientName: 'Mother',
    });

    expect(loadOutputDrafts()).toHaveLength(1);
    expect(loadOutputDrafts()[0].sourceEvidence[0]).toMatchObject({
      id: 'ev-e1',
      sourceId: 'e1',
      reviewState: 'unreviewed',
    });
    expect(loadCommunicationRecords()).toHaveLength(1);
    expect(savedRecord).toMatchObject({
      outputDraftId: 'draft-1',
      recipientType: 'family',
      recipientName: 'Mother',
      status: 'copied',
      sourceEvidenceIds: ['ev-e1'],
    });
  });
});
