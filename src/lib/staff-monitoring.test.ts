import { describe, it, expect } from 'vitest';
import { computeStaffMonitoring, flattenWeekEntries, filterEntries } from './staff-monitoring';
import type { WeekSummary, CareEntry } from './types';

function entry(p: Partial<CareEntry> & Pick<CareEntry, 'id' | 'house' | 'carer' | 'entry'>): CareEntry {
  return {
    date: '02/04/2026',
    time: '10:00',
    type: 'Daily',
    client: 'C',
    severity: 'green',
    flags: [],
    ...p,
  };
}

describe('staff-monitoring', () => {
  it('computes staff scorecards from week data', () => {
    const week: WeekSummary = {
      dateFrom: '01/04/2026',
      dateTo: '02/04/2026',
      totalEntries: 3,
      houses: {
        Lingfield: {
          name: 'Lingfield',
          coordinator: 'Coord',
          entries: [
            entry({ id: '1', house: 'Lingfield', carer: 'Alex Test', entry: 'x'.repeat(200) }),
            entry({ id: '2', house: 'Lingfield', carer: 'Alex Test', entry: 'short', severity: 'amber' }),
            entry({ id: '3', house: 'Lingfield', carer: 'Jamie Other', entry: 'y'.repeat(150) }),
          ],
          incidents: [],
          safeguarding: [],
          medication: [],
          staffPerformance: [],
          healthSafety: [],
          handovers: [],
          dailySupport: [],
          flags: { red: 0, amber: 1, green: 2 },
        },
      },
      allFlags: { red: [], amber: [], green: [] },
      entryTypes: {},
      clients: [],
      carers: ['Alex Test', 'Jamie Other'],
      clientDiary: {},
    };

    const snap = computeStaffMonitoring(week, { house: 'all' });
    expect(snap.staff.length).toBe(2);
    const alex = snap.staff.find((s) => s.carer === 'Alex Test');
    expect(alex).toBeDefined();
    expect(alex!.entryCount).toBe(2);
    expect(snap.escalations.length).toBeGreaterThan(0);
  });

  it('flattenWeekEntries dedupes by id', () => {
    const week: WeekSummary = {
      dateFrom: '1',
      dateTo: '2',
      totalEntries: 1,
      houses: {
        H: {
          name: 'H',
          coordinator: '',
          entries: [entry({ id: 'same', house: 'H', carer: 'A', entry: 'text' })],
          incidents: [],
          safeguarding: [],
          medication: [],
          staffPerformance: [],
          healthSafety: [],
          handovers: [],
          dailySupport: [],
          flags: { red: 0, amber: 0, green: 0 },
        },
      },
      allFlags: { red: [], amber: [], green: [] },
      entryTypes: {},
      clients: [],
      carers: [],
      clientDiary: {},
    };
    expect(flattenWeekEntries(week).length).toBe(1);
  });

  it('filterEntries respects house', () => {
    const entries: CareEntry[] = [
      entry({ id: '1', house: 'Lingfield', carer: 'A', entry: 'ok' }),
      entry({ id: '2', house: 'Other', carer: 'B', entry: 'ok' }),
    ];
    const f = filterEntries(entries, { house: 'Lingfield' });
    expect(f.length).toBe(1);
    expect(f[0].house).toBe('Lingfield');
  });
});
