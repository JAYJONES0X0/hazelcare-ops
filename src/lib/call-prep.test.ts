import { describe, it, expect } from 'vitest';
import { buildCallPrepScript } from './call-prep';

describe('call-prep', () => {
  it('builds deterministic script lines', () => {
    const esc = {
      id: 'e1',
      tier: 1 as const,
      house: 'Lingfield',
      carer: 'Alex Example',
      summary: 'test',
      reasons: ['Short notes'],
      suggestedTool: 'notes' as const,
      qualityScore: 42,
      entryCount: 8,
      shortEntryRatio: 0.75,
      avgEntryChars: 55,
      topGaps: ['First-person voice missing'],
    };
    const s = buildCallPrepScript(esc, 'Lingfield', 'coaching');
    expect(s.lines.length).toBeGreaterThan(5);
    expect(s.lines.join('\n')).toContain('Alex');
    expect(s.lines.join('\n')).toContain('Lingfield');
  });
});
