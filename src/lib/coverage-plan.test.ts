import { describe, expect, it } from 'vitest';
import { buildShiftContext, computeCoverageSummary, parseSupportWindows, SUPPORT_HOUR_CAP, type SupportWindow } from './coverage-plan';
import type { CareEntry } from './types';

function entry(id: string, date: string, time: string): CareEntry {
  return {
    id,
    date,
    time,
    house: 'Lingfield',
    type: 'Daily Support',
    carer: 'Alex Test',
    client: 'Test Client',
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
      { client: 'Test Client', dateFrom: '06/04/2026', dateTo: '07/04/2026', windows },
    );

    expect(summary?.totalExpected).toBe(6);
    expect(summary?.totalActual).toBe(3);
    expect(summary?.totalMissing).toBe(3);
    expect(summary?.totalHours).toBe(10);
    expect(summary?.rawTotalHours).toBe(10);
    expect(summary?.capApplied).toBe(false);
    expect(summary?.missingDays.map((d) => `${d.date}:${d.missing}`)).toEqual([
      '06/04/2026:1',
      '07/04/2026:2',
    ]);
  });

  it('applies strict 15-hour cap and trims final day windows', () => {
    const windows: SupportWindow[] = [{ id: 'day', label: '10:00-14:00 1:1', start: '10:00', end: '14:00', hours: 4 }];
    const summary = computeCoverageSummary([], {
      client: 'Test Client',
      dateFrom: '06/04/2026',
      dateTo: '09/04/2026',
      windows,
    });

    expect(summary?.rawTotalHours).toBe(16);
    expect(summary?.totalHours).toBe(SUPPORT_HOUR_CAP);
    expect(summary?.capApplied).toBe(true);
    expect(summary?.days.map((d) => `${d.date}:${d.expected}`)).toEqual([
      '06/04/2026:1',
      '07/04/2026:1',
      '08/04/2026:1',
      '09/04/2026:1',
    ]);
    expect(summary?.days[3].missingWindows[0]).toMatchObject({
      start: '10:00',
      end: '13:00',
      hours: 3,
    });
  });

  it('builds shift context from the provided day windows', () => {
    const plan = {
      client: 'Test Client',
      dateFrom: '01/01/2026',
      dateTo: '01/01/2026',
      windows: [{ id: 'am', label: '1:1', start: '10:00', end: '12:00', hours: 2 }],
    };
    const ctx = buildShiftContext(plan, '01/01/2026', [{ id: 'trim', label: 'trim', start: '10:00', end: '11:30', hours: 1.5 }]);
    expect(ctx).toContain('Test Client expected 1:1 support on 01/01/2026');
    expect(ctx).toContain('10:00-11:30 1:1 support');
  });
});
