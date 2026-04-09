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

  it('keeps weekData in session memory only', async () => {
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorage);

    const storage = await import('./storage');
    const week = makeWeekSummary();

    storage.saveWeekData(week);

    expect(storage.loadWeekData()).toEqual(week);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('excludes weekData from exported backup snapshots', async () => {
    const localStorage = createLocalStorageMock({
      'hazelcare-ops': JSON.stringify({ actions: [{ id: 'a1' }], incidents: [], staff: [] }),
      'hc-clients-v2': JSON.stringify([{ id: 'c1' }]),
    });
    vi.stubGlobal('localStorage', localStorage);

    const storage = await import('./storage');
    storage.saveWeekData(makeWeekSummary());

    const snapshot = storage.exportOpsSnapshot();

    expect(snapshot.data.appState.weekData).toBeNull();
    expect(snapshot.data.appState.actions).toEqual([{ id: 'a1' }]);
    expect(snapshot.data.clients).toEqual([{ id: 'c1' }]);
  });

  it('normalizes legacy persisted app state and clears session week data on restore', async () => {
    const localStorage = createLocalStorageMock({
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
    expect(storage.loadWeekData()).toBeNull();
    expect(storage.loadActions()).toEqual([]);
    expect(storage.loadIncidents()).toEqual([]);
  });
});
