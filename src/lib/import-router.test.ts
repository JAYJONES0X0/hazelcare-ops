import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeekSummary } from './types';

function makeWeekSummary(tag: string): WeekSummary {
  return {
    dateFrom: `01/04/${tag}`,
    dateTo: `02/04/${tag}`,
    totalEntries: 1,
    houses: {},
    allFlags: { red: [], amber: [], green: [] },
    entryTypes: {},
    clients: [],
    carers: [],
    clientDiary: {},
  };
}

function createLocalStorageMock() {
  return {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => {
      throw new Error('quota hit during template context write');
    }),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(() => null),
    length: 0,
  };
}

describe('import-router rollback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('restores prior session weekData if a later import step fails', async () => {
    const previousWeekData = makeWeekSummary('2025');
    const mergedWeekData = makeWeekSummary('2026');
    const saveWeekData = vi.fn();
    const importOpsSnapshot = vi.fn(() => ({ ok: true as const }));

    vi.stubGlobal('localStorage', createLocalStorageMock());

    vi.doMock('./client-store', () => ({
      emptyClient: () => ({}),
      loadClients: () => [],
      resolveClientMatch: () => ({ best: null, requiresManualSelection: false, score: 0 }),
      saveClient: vi.fn(),
    }));

    vi.doMock('./storage', () => ({
      exportOpsSnapshot: vi.fn(() => ({ version: 1 })),
      importOpsSnapshot,
      loadWeekData: vi.fn(() => previousWeekData),
      mergeWeekSummaries: vi.fn(() => mergedWeekData),
      saveWeekData,
    }));

    const { routeImport } = await import('./import-router');

    const result = routeImport(
      {
        source: {
          fileName: 'batch.csv',
          ext: 'csv',
          parserProfile: 'diary',
          detectedType: 'diary',
          confidence: 0.99,
        },
        rawText: 'x',
        clientCandidates: [],
        diaryEntries: [],
        weekSummary: mergedWeekData,
        admission: null,
        supportPlan: null,
        warnings: [],
        unmappedFields: [],
        suggestedTargets: ['reports', 'templates'],
      },
      {
        targets: ['reports', 'templates'],
        clientMode: 'global',
        selectedTemplateIds: [],
      }
    );

    expect(result.ok).toBe(false);
    expect(importOpsSnapshot).toHaveBeenCalledTimes(1);
    expect(saveWeekData).toHaveBeenNthCalledWith(1, mergedWeekData);
    expect(saveWeekData).toHaveBeenNthCalledWith(2, previousWeekData);
  });
});
