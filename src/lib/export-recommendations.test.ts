import { describe, it, expect } from 'vitest';
import { buildExportRecommendations } from './export-recommendations';
import type { StaffMonitoringSnapshot } from './staff-monitoring';

describe('export-recommendations', () => {
  it('suggests diary import when empty', () => {
    const snap: StaffMonitoringSnapshot = {
      computedAt: new Date().toISOString(),
      windowLabel: '—',
      filters: { house: 'all' },
      staff: [],
      houses: [],
      escalations: [],
      dataFreshness: { entryCount: 0 },
    };
    const r = buildExportRecommendations(snap);
    expect(r.some((x) => x.id === 'diary-full')).toBe(true);
  });
});
