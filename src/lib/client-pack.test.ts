import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyEnvelope } from './import-intelligence';
import { buildEnvelopeFromRaw } from './import-profiles';
import { routeImport } from './import-router';
import { emptyClient, loadClients } from './client-store';
import {
  applyPackClientIdentity,
  buildPackFileManifestRow,
  buildPackImport,
  clientLiveGateSummary,
  consolidateDuplicatePackClients,
  resolvePackClientIdentity,
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

  it('uses evidence-backed identity for a pack and rejects document titles inferred from filenames', () => {
    const tenancy = emptyEnvelope('AG Tenancy.pdf', '');
    tenancy.clientCandidates = [{ name: 'AG Tenancy' }];

    const finance = emptyEnvelope('Financial Assessment.pdf', 'Financial assessment and benefits review.');
    finance.clientCandidates = [{ name: 'Financial Assessment' }];

    const mentalHealth = emptyEnvelope('Mental Health act AG.pdf', 'Mental Health Act review document.');
    mentalHealth.clientCandidates = [{ name: 'Mental Health' }];

    const carePlan = buildEnvelopeFromRaw(
      'Alistair Gunn Care Plan.pdf',
      'Person ID Full name Date of Birth Gender 102142 MR Alistair Gunn 11/03/1992 Care Plan Nutrition Medication'
    );

    const admission = buildEnvelopeFromRaw(
      'Emergency Admisssion Pack Alistair.pdf',
      'Person ID Full name Date of Birth Gender 102142 MR Alistair Gunn 11/03/1992 Emergency Admission Pack'
    );
    admission.clientCandidates = [{
      name: 'Alistair Gunn',
      preferredName: 'Alistair',
      dob: '11/03/1992',
    }];

    const resolved = resolvePackClientIdentity([tenancy, finance, mentalHealth, carePlan, admission]);

    expect(resolved).toEqual(expect.objectContaining({
      candidate: expect.objectContaining({
        name: 'Alistair Gunn',
        dob: '11/03/1992',
      }),
      confidence: expect.any(Number),
      ambiguous: false,
    }));
    expect(resolved.confidence).toBeGreaterThanOrEqual(0.9);
    expect(resolved.rejectedNames).toEqual(expect.arrayContaining([
      'AG Tenancy',
      'Financial Assessment',
      'Mental Health',
    ]));

    const canonical = applyPackClientIdentity(
      [tenancy, finance, mentalHealth, carePlan, admission],
      resolved,
    );
    expect(canonical.every(envelope => envelope.clientCandidates[0]?.name === 'Alistair Gunn')).toBe(true);
    expect(canonical.every(envelope => envelope.clientCandidates[0]?.dob === '11/03/1992')).toBe(true);
  });

  it('consolidates duplicate profiles created from one pack without losing vault evidence', () => {
    const makeClient = (name: string, fileName: string, hasIdentity = false) => {
      const client = emptyClient();
      client.id = `client-${name.toLowerCase().replace(/\s+/g, '-')}`;
      client.name = name;
      client.preferredName = name.split(/\s+/)[0];
      if (hasIdentity) {
        client.dob = '11/03/1992';
        client.nhs = '486 846 3039';
      }
      client.vaultDocs = [{
        id: `vault-${fileName}`,
        name: fileName,
        text: fileName,
        uploadedAt: '2026-06-24T10:00:00.000Z',
        packId: 'pack-alistair',
        fileId: `file-${fileName}`,
        category: 'unknown',
        parseStatus: 'ATTACHED_ONLY',
        classificationConfidence: 0.2,
        reviewRequired: true,
        sourceFileName: fileName,
        targetScreen: 'Review Queue',
        rejectedReasons: [],
      }];
      client.packImports = [{
        packId: 'pack-alistair',
        uploadedAt: '2026-06-24T10:00:00.000Z',
        uploadedBy: 'local-session',
        sourceName: 'OneDrive_1_6-15-2026.zip',
        sourceType: 'zip',
        status: 'DRAFT_CLIENT',
        candidateClientId: client.id,
        candidateClientName: name,
        identityConfidence: hasIdentity ? 0.95 : 0.2,
        filesTotal: 3,
        filesParsed: 1,
        filesAttached: 2,
        filesFailed: 0,
        filesNeedsReview: 2,
        manifestRows: [],
        auditEventIds: [],
      }];
      return client;
    };

    const result = consolidateDuplicatePackClients([
      makeClient('Mental Health', 'Mental Health act AG.pdf'),
      makeClient('Financial Assessment', 'Financial Assessment.pdf'),
      makeClient('Alistair Gunn', 'Alistair Gunn Care Plan.pdf', true),
    ]);

    expect(result.changed).toBe(true);
    expect(result.clients).toHaveLength(1);
    expect(result.clients[0].name).toBe('Alistair Gunn');
    expect(result.clients[0].vaultDocs?.map(doc => doc.name)).toEqual(expect.arrayContaining([
      'Mental Health act AG.pdf',
      'Financial Assessment.pdf',
      'Alistair Gunn Care Plan.pdf',
    ]));
    expect(result.clients[0].packImports).toHaveLength(1);
    expect(result.removedClientNames).toEqual(expect.arrayContaining([
      'Mental Health',
      'Financial Assessment',
    ]));
  });
});
