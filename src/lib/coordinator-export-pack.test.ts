import { describe, it, expect } from 'vitest';
import { careEntriesToEvidenceCsv } from './coordinator-export-pack';
import type { CareEntry } from './types';

describe('coordinator-export-pack', () => {
  it('careEntriesToEvidenceCsv escapes quotes and includes id and flags', () => {
    const entries: CareEntry[] = [
      {
        id: 'e1',
        date: '01/04/2026',
        time: '09:00',
        house: 'Test House',
        type: 'Daily 1:1',
        carer: 'Jane "J" Doe',
        client: 'Client A',
        entry: 'Says "hello" and leaves.',
        severity: 'green',
        flags: ['finance', 'note'],
        category: 'daily_support',
      },
    ];
    const csv = careEntriesToEvidenceCsv(entries);
    expect(csv).toContain('id,date,time');
    expect(csv).toContain('Jane ""J"" Doe');
    expect(csv).toContain('finance; note');
  });
});
