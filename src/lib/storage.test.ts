import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeekSummary } from './types';

function makeWeekSummary(): WeekSummary {
  return {
    dateFrom: '01/04/2026',
    dateTo: '02/04/2026',
    totalEntries: 1,
    houses: {},
    allFlags: { red: [], amber: [], green: [] },
    entryTypes: {},
    clients: [],
    carers: [],
    clientDiary: {},
  };
}

function createLocalStorageMock(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
  };
}

describe('storage session week data', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('restores the persisted weekly import after a reload', async () => {
    const localStorage = createLocalStorageMock({
      'hc-schema-v': '3',
    });
    vi.stubGlobal('localStorage', localStorage);

    const storage = await import('./storage');
    const week = makeWeekSummary();

    storage.saveWeekData(week);

    expect(storage.loadWeekData()).toEqual(week);
    vi.resetModules();
    const reloaded = await import('./storage');
    expect(reloaded.loadWeekData()).toEqual(week);
  });

  it('includes weekData in exported backup snapshots', async () => {
    const localStorage = createLocalStorageMock({
      'hc-schema-v': '3',
      'hazelcare-ops': JSON.stringify({ actions: [{ id: 'a1' }], incidents: [], staff: [] }),
      'hc-clients-v2': JSON.stringify([{ id: 'c1' }]),
    });
    vi.stubGlobal('localStorage', localStorage);

    const storage = await import('./storage');
    storage.saveWeekData(makeWeekSummary());

    const snapshot = storage.exportOpsSnapshot();

    expect(snapshot.data.appState.weekData).toEqual(makeWeekSummary());
    expect(snapshot.data.appState.actions).toEqual([{ id: 'a1' }]);
    expect(snapshot.data.clients).toEqual([{ id: 'c1' }]);
  });

  it('restores weekly data alongside operational records', async () => {
    const localStorage = createLocalStorageMock({
      'hc-schema-v': '3',
      'hazelcare-ops': JSON.stringify({
        weekData: makeWeekSummary(),
        actions: [{ id: 'a1' }],
        incidents: [{ id: 'i1' }],
        staff: [{ id: 's1' }],
      }),
    });
    vi.stubGlobal('localStorage', localStorage);

    const storage = await import('./storage');
    storage.saveWeekData(makeWeekSummary());

    const restore = storage.importOpsSnapshot({
      version: 1,
      source: 'hazelcare-ops',
      data: {
        appState: { weekData: makeWeekSummary(), actions: [], incidents: [], staff: [] },
        clients: [],
        staffNotes: [],
      },
    });

    expect(restore).toEqual({ ok: true });
    expect(storage.loadWeekData()).toEqual(makeWeekSummary());
    expect(storage.loadActions()).toEqual([]);
    expect(storage.loadIncidents()).toEqual([]);
  });
});


describe('storage write failures', () => {
  it('keeps saved actions when the replacement exceeds quota', async () => {
    vi.resetModules();
    const localStorage = createLocalStorageMock({ 'hc-schema-v': '3', 'hazelcare-ops': JSON.stringify({ actions: [{ id: 'previous' }] }) });
    vi.stubGlobal('localStorage', localStorage);
    const storage = await import('./storage');
    localStorage.setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => storage.saveActions([])).toThrow('previous saved data is preserved');
    expect(storage.loadActions()).toEqual([{ id: 'previous' }]);
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });
  it('keeps the previous weekly import in memory and storage after a failed replacement', async () => {
    vi.resetModules();
    const localStorage = createLocalStorageMock({ 'hc-schema-v': '3' });
    vi.stubGlobal('localStorage', localStorage);
    const storage = await import('./storage');
    const previous = makeWeekSummary();
    storage.saveWeekData(previous);
    localStorage.setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => storage.saveWeekData({ ...previous, totalEntries: 500 })).toThrow('Save failed');
    expect(storage.loadWeekData()).toEqual(previous);
    vi.resetModules();
    expect((await import('./storage')).loadWeekData()).toEqual(previous);
  });
  it('rolls back earlier restore writes when a later key fails', async () => {
    vi.resetModules();
    const localStorage = createLocalStorageMock({ 'hc-schema-v': '3', 'hazelcare-ops': JSON.stringify({ actions: [{ id: 'previous' }] }), 'hc-clients-v2': '[{"id":"existing"}]' });
    vi.stubGlobal('localStorage', localStorage);
    const storage = await import('./storage');
    const original = localStorage.setItem.getMockImplementation()!;
    let failed = false;
    localStorage.setItem.mockImplementation((key, value) => {
      if (key === 'hc-clients-v2' && !failed) { failed = true; throw new DOMException('Full', 'QuotaExceededError'); }
      original(key, value);
    });
    const result = storage.importOpsSnapshot({ version: 1, source: 'hazelcare-ops', data: { appState: { actions: [] }, clients: [], staffNotes: [] } });
    expect(result.ok).toBe(false);
    expect(storage.loadActions()).toEqual([{ id: 'previous' }]);
    expect(localStorage.getItem('hc-clients-v2')).toBe('[{"id":"existing"}]');
  });
});
