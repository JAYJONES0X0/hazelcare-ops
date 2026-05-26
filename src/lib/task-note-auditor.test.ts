import { describe, expect, it } from 'vitest';
import { auditTaskNotes } from './task-note-auditor';
import type { CareEntry } from './types';

function entry(overrides: Partial<CareEntry>): CareEntry {
  return {
    id: 'entry-1',
    date: '12/05/2026',
    time: '10:00',
    house: 'Lingfield',
    type: 'Task Note Generated via Mobile App',
    carer: 'Alex Worker',
    client: 'Jane Person',
    entry: '',
    severity: 'none',
    flags: [],
    ...overrides,
  };
}

describe('task-note-auditor', () => {
  it('flags placeholder task notes without inventing a clean outcome', () => {
    const result = auditTaskNotes([
      entry({ id: 'task-1', entry: 'Done' }),
    ]);

    const placeholderGap = result.allGaps.find((gap) => gap.failures.includes('generic_placeholder'));
    expect(result.auditMode).toBe('task_tick');
    expect(placeholderGap).toBeDefined();
    expect(placeholderGap!.goldStandard).toContain('Do not invent completion');
    expect(placeholderGap!.goldStandard).not.toContain('No concerns identified');
  });

  it('asks for evidenced appointment notes when task ticks have no narrative', () => {
    const result = auditTaskNotes([
      entry({ id: 'task-1', entry: 'Medication task opened' }),
      entry({ id: 'task-2', entry: 'Meal support task opened' }),
    ]);

    expect(result.allGaps[0].goldStandard).toContain('use the source record only');
    expect(result.allGaps[0].goldStandard).not.toContain('was calm');
    expect(result.allGaps[0].goldStandard).not.toContain('No concerns identified');
  });
});
