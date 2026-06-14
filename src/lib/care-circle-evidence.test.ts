import { describe, expect, it } from 'vitest';
import type { FullClient } from './client-store';
import type { CareEntry, WeekSummary } from './types';
import {
  careCircleEntryMatchesClient,
  filterCareCircleEntriesForClient,
  getCareCircleEntriesFromWeek,
  mergeCareCircleEvidenceEntries,
} from './care-circle-evidence';

const client = { name: 'Ryan Shade', preferredName: 'Ryan' } as FullClient;

function entry(overrides: Partial<CareEntry>): CareEntry {
  return {
    id: overrides.id || 'entry-1',
    date: overrides.date || '14/06/2026',
    time: overrides.time || '09:00',
    house: overrides.house || 'Rose House',
    type: overrides.type || 'Daily support',
    carer: overrides.carer || 'Louise T',
    client: overrides.client || 'Ryan Shade',
    entry: overrides.entry || 'Ryan was settled.',
    severity: overrides.severity || 'green',
    flags: overrides.flags || [],
    category: overrides.category || 'daily_support',
  };
}

function week(entriesByClient: Record<string, CareEntry[]>): WeekSummary {
  return {
    totalEntries: Object.values(entriesByClient).flat().length,
    dateFrom: '14/06/2026',
    dateTo: '14/06/2026',
    houses: {},
    clients: Object.keys(entriesByClient),
    carers: [],
    entryTypes: {},
    allFlags: { red: [], amber: [], green: [] },
    clientDiary: entriesByClient,
  };
}

describe('care circle evidence selection', () => {
  it('matches exact client names and preferred-name diary labels', () => {
    expect(careCircleEntryMatchesClient(entry({ client: 'Ryan Shade' }), client)).toBe(true);
    expect(careCircleEntryMatchesClient(entry({ client: 'Ryan' }), client)).toBe(true);
    expect(careCircleEntryMatchesClient(entry({ client: 'Jamie Morton' }), client)).toBe(false);
  });

  it('reads direct week-data diary entries for the person', () => {
    const rows = getCareCircleEntriesFromWeek(client, week({
      'Ryan Shade': [entry({ id: 'a' })],
      'Jamie Morton': [entry({ id: 'b', client: 'Jamie Morton' })],
    }));

    expect(rows.map((row) => row.id)).toEqual(['a']);
  });

  it('falls back to fuzzy client matching across week diary buckets', () => {
    const rows = getCareCircleEntriesFromWeek(client, week({
      'Unassigned': [
        entry({ id: 'a', client: 'Ryan Shade - temporary label' }),
        entry({ id: 'b', client: 'Jamie Morton' }),
      ],
    }));

    expect(rows.map((row) => row.id)).toEqual(['a']);
  });

  it('filters IndexedDB-style entry arrays for the current client', () => {
    const rows = filterCareCircleEntriesForClient(client, [
      entry({ id: 'a', client: 'Ryan Shade' }),
      entry({ id: 'b', client: 'Jamie Morton' }),
      entry({ id: 'c', client: 'Ryan' }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['a', 'c']);
  });

  it('merges week and stored entries without double-counting the same record', () => {
    const duplicate = entry({ id: 'same', entry: 'Same note.' });
    const rows = mergeCareCircleEvidenceEntries(
      client,
      week({ 'Ryan Shade': [duplicate] }),
      [duplicate, entry({ id: 'stored', entry: 'Stored-only note.' })]
    );

    expect(rows.map((row) => row.id)).toEqual(['same', 'stored']);
  });
});
