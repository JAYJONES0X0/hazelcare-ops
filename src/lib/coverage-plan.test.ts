import { describe, expect, it } from 'vitest';
import { computeCoverageSummary, parseSupportWindows } from './coverage-plan';
import type { CareEntry } from './types';

function entry(id: string, date: string, time: string): CareEntry {
  return {
    id,
    date,
    time,
    house: 'Lingfield',
    type: 'Daily Support',
    carer: 'Alex Test',
    client: 'Shaun',
    entry: '1:1 daily support completed with clear engagement and handover outcome.',
    severity: 'green',
    flags: [],
    category: 'daily_support',
  };
}

describe('coverage-plan', () => {
  it('parses manager-supplied 1:1 windows and computes missing support notes', () => {
    const windows = parseSupportWindows('10am-12, 2pm-3pm, 5pm-7pm');
    expect(windows).toHaveLength(3);
    expect(windows.map((w) => w.hours)).toEqual([2, 1, 2]);

    const summary = computeCoverageSummary(
      [
        entry('1', '06/04/2026', '10:00'),
        entry('2', '06/04/2026', '14:00'),
        entry('3', '07/04/2026', '17:00'),
      ],
      { client: 'Shaun', dateFrom: '06/04/2026', dateTo: '07/04/2026', windows },
    );

    expect(summary?.totalExpected).toBe(6);
    expect(summary?.totalActual).toBe(3);
    expect(summary?.totalMissing).toBe(3);
    expect(summary?.totalHours).toBe(10);
    expect(summary?.missingDays.map((d) => `${d.date}:${d.missing}`)).toEqual([
      '06/04/2026:1',
      '07/04/2026:2',
    ]);
  });
});
