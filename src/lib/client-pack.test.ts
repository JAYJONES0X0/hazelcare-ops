import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyEnvelope } from './import-intelligence';
import { buildEnvelopeFromRaw } from './import-profiles';
import { routeImport } from './import-router';
import { loadClients } from './client-store';
import {
  buildPackFileManifestRow,
  buildPackImport,
  clientLiveGateSummary,
} from './client-pack';

function storageMock() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => store.clear()),
  };
}

describe('client pack manifest', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storageMock());
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.stubGlobal('CustomEvent', class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    });
  });

  it('keeps every pack file visible with category, parse state, review state, and target', () => {
    const carePlan = buildEnvelopeFromRaw(
      'Alistair Gunn Care Plan.pdf',
      'Person ID Full name Date of Birth Gender 102142 MR Alistair Gunn 11/03/1992 Care Plan Nutrition Medication Risk Area 1: finance'
    );
    const profileImage = emptyEnvelope('AG profile picture.jpg', '');
    profileImage.source.ext = 'jpg';
    profileImage.source.parserProfile = 'profile-image';
    profileImage.source.sizeBytes = 78564;
    profileImage.suggestedTargets = ['client-docs'];

    const scannedTenancy = emptyEnvelope('AG Tenancy.pdf', '');
    scannedTenancy.source.ext = 'pdf';
    scannedTenancy.source.sizeBytes = 10482790;
    scannedTenancy.warnings.push('No extractable text found in this file. Detection used filename hints only.');

    const rows = [
      buildPackFileManifestRow({ packId: 'pack-1', envelope: carePlan, fileName: carePlan.source.fileName }),
      buildPackFileManifestRow({ packId: 'pack-1', envelope: profileImage, fileName: profileImage.source.fileName }),
      buildPackFileManifestRow({ packId: 'pack-1', envelope: scannedTenancy, fileName: scannedTenancy.source.fileName }),
    ];

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'care_plan', parseStatus: 'PARSED', targetScreen: 'Care Plan' }),
      expect.objectContaining({ category: 'profile_image', parseStatus: 'ATTACHED_ONLY', reviewRequired: true }),
      expect.objectContaining({ category: 'tenancy', parseStatus: 'OCR_REQUIRED', reviewRequired: true }),
    ]));
    expect(rows.every(row => row.rejectedReasons.length >= 0)).toBe(true);

    const pack = buildPackImport({
      packId: 'pack-1',
      sourceName: 'OneDrive_1_6-15-2026.zip',
      rows,
      candidateClientId: 'client-alistair',
      candidateClientName: 'Alistair Gunn',
      identityConfidence: 0.86,
    });

    expect(pack.status).toBe('DRAFT_CLIENT');
    expect(pack.filesTotal).toBe(3);
    expect(pack.filesParsed).toBe(1);
    expect(pack.filesAttached).toBe(2);
    expect(pack.filesNeedsReview).toBe(2);
  });

  it('routes attach-only client documents into a draft profile instead of dropping them', () => {
    const envelope = buildEnvelopeFromRaw(
      'Financial Assessment.pdf',
      'Alistair Gunn Financial Next Review Due Alistair requires support in managing his finances and benefits.'
    );
    envelope.clientCandidates = [{ name: 'Alistair Gunn' }];

    const result = routeImport(envelope, { targets: ['client-docs'], clientMode: 'global' });

    expect(result.ok).toBe(true);
    expect(result.messages.join(' ')).toContain('attached');
    const client = loadClients()[0];
    expect(client.name).toBe('Alistair Gunn');
    expect(client.onboardingStatus).toBe('DRAFT_CLIENT');
    expect(client.vaultDocs?.[0]).toEqual(expect.objectContaining({
      name: 'Financial Assessment.pdf',
      category: 'finance',
      parseStatus: 'ATTACHED_ONLY',
      reviewRequired: true,
    }));
    expect(client.packImports?.[0]).toEqual(expect.objectContaining({
      status: 'DRAFT_CLIENT',
      filesTotal: 1,
      filesNeedsReview: 1,
    }));
  });

  it('does not promote a draft client to live while critical gates remain unresolved', () => {
    const summary = clientLiveGateSummary({
      identityReviewed: true,
      hasCarePlanSource: true,
      riskReviewed: false,
      contactsReviewed: false,
      unresolvedFiles: 2,
    });

    expect(summary.liveReady).toBe(false);
    expect(summary.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'risk', status: 'blocked' }),
      expect.objectContaining({ id: 'contacts', status: 'blocked' }),
      expect.objectContaining({ id: 'files', status: 'blocked' }),
    ]));
  });
});
