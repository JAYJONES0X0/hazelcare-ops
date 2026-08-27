import { describe, expect, it, vi } from 'vitest';
import { createEmptyOperationalLedger, createServiceCapability } from './operational-state-intelligence';
import {
  BrowserOperationalStateRepository,
  OPERATIONAL_STATE_STORAGE_KEY,
  type StorageLike,
} from './operational-state-repository';

const NOW = '2026-08-27T00:00:00.000Z';

function storageMock(initial?: string): StorageLike & { state: Map<string, string> } {
  const state = new Map<string, string>();
  if (initial) state.set(OPERATIONAL_STATE_STORAGE_KEY, initial);
  return {
    state,
    getItem: vi.fn((key: string) => state.get(key) || null),
    setItem: vi.fn((key: string, value: string) => { state.set(key, value); }),
    removeItem: vi.fn((key: string) => { state.delete(key); }),
  };
}

function liveLedger() {
  const ledger = createEmptyOperationalLedger('Test Provider', NOW);
  ledger.providerId = 'org-test';
  ledger.topology = [
    { id: 'org-test', name: 'Test Provider', kind: 'organisation' as const },
    { id: 'service-a', name: 'Service A', kind: 'service' as const, parentId: 'org-test' },
  ];
  ledger.serviceCapabilities.push(createServiceCapability(ledger, 'service-a', 'handover', 'Test source', NOW));
  return ledger;
}

describe('Operational State Repository', () => {
  it('saves and loads a valid live metadata ledger', () => {
    const storage = storageMock();
    const repository = new BrowserOperationalStateRepository(storage);
    const ledger = liveLedger();

    expect(repository.save(ledger)).toMatchObject({ ok: true });
    expect(repository.load().ledger).toEqual(ledger);
  });

  it('preserves corrupt stored data for recovery instead of mutating it', () => {
    const raw = '{not-json';
    const storage = storageMock(raw);
    const repository = new BrowserOperationalStateRepository(storage);

    const result = repository.load();
    expect(result.ledger).toBeNull();
    expect(result.rawRecoveryValue).toBe(raw);
    expect(storage.state.get(OPERATIONAL_STATE_STORAGE_KEY)).toBe(raw);
  });

  it('rejects orphaned references atomically without replacing the existing ledger', () => {
    const storage = storageMock();
    const repository = new BrowserOperationalStateRepository(storage);
    const existing = liveLedger();
    repository.save(existing);
    const before = storage.state.get(OPERATIONAL_STATE_STORAGE_KEY);

    const invalid = liveLedger();
    invalid.serviceCapabilities[0].definitionId = 'missing-definition';
    const raw = JSON.stringify({
      schemaVersion: 2,
      sourceMarker: 'ovsite-operational-state',
      exportedAt: NOW,
      ledger: invalid,
    });

    const result = repository.importSnapshot(raw, { replaceConfirmed: true });
    expect(result.ok).toBe(false);
    expect(storage.state.get(OPERATIONAL_STATE_STORAGE_KEY)).toBe(before);
  });

  it('requires explicit replacement confirmation before importing over a live ledger', () => {
    const storage = storageMock();
    const repository = new BrowserOperationalStateRepository(storage);
    const first = liveLedger();
    repository.save(first);

    const replacement = liveLedger();
    replacement.providerName = 'Replacement Provider';
    replacement.topology[0].name = 'Replacement Provider';
    const snapshot = repository.exportSnapshot(replacement, NOW);

    const blocked = repository.importSnapshot(snapshot);
    expect(blocked).toMatchObject({ ok: false, code: 'REPLACEMENT_CONFIRMATION_REQUIRED' });
    expect(repository.load().ledger?.providerName).toBe('Test Provider');

    const accepted = repository.importSnapshot(snapshot, { replaceConfirmed: true });
    expect(accepted.ok).toBe(true);
    expect(repository.load().ledger?.providerName).toBe('Replacement Provider');
  });

  it('never persists or imports the fictional demo as live provider state', () => {
    const storage = storageMock();
    const repository = new BrowserOperationalStateRepository(storage);
    const demo = liveLedger();
    demo.mode = 'DEMO';

    expect(repository.save(demo)).toMatchObject({ ok: false, code: 'DEMO_NOT_PERSISTABLE' });
    const snapshot = repository.exportSnapshot(demo, NOW);
    expect(repository.importSnapshot(snapshot, { replaceConfirmed: true })).toMatchObject({
      ok: false,
      code: 'DEMO_NOT_PERSISTABLE',
    });
    expect(storage.state.size).toBe(0);
  });

  it('round-trips a metadata-only snapshot without changing the ledger', () => {
    const sourceStorage = storageMock();
    const source = new BrowserOperationalStateRepository(sourceStorage);
    const ledger = liveLedger();
    source.save(ledger);
    const snapshot = source.exportSnapshot(ledger, NOW);

    const targetStorage = storageMock();
    const target = new BrowserOperationalStateRepository(targetStorage);
    const imported = target.importSnapshot(snapshot);

    expect(imported.ok).toBe(true);
    expect(target.load().ledger).toEqual(ledger);
  });

  it('migrates a version 1 Phase 2 snapshot by adding the current ledger envelope fields', () => {
    const storage = storageMock();
    const repository = new BrowserOperationalStateRepository(storage);
    const ledger = liveLedger();
    const v1Ledger = { ...ledger, schemaVersion: 1, actions: undefined, disputeResolutions: undefined };
    const v1 = JSON.stringify({
      schemaVersion: 1,
      sourceMarker: 'ovsite-operational-state',
      exportedAt: NOW,
      ledger: v1Ledger,
    });

    const result = repository.importSnapshot(v1);
    expect(result.ok).toBe(true);
    expect(result.ledger?.schemaVersion).toBe(2);
    expect(result.ledger?.actions).toEqual([]);
    expect(result.ledger?.disputeResolutions).toEqual([]);
  });

  it('rejects snapshots containing raw care record payload fields', () => {
    const storage = storageMock();
    const repository = new BrowserOperationalStateRepository(storage);
    const ledger = liveLedger() as unknown as Record<string, unknown>;
    ledger.rawCareNotes = [{ resident: 'Do not store this' }];
    const raw = JSON.stringify({
      schemaVersion: 2,
      sourceMarker: 'ovsite-operational-state',
      exportedAt: NOW,
      ledger,
    });

    const result = repository.importSnapshot(raw);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_SNAPSHOT' });
    expect(storage.state.size).toBe(0);
  });
});
