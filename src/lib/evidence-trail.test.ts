import { describe, expect, it } from 'vitest';
import { splitEvidenceTrail } from './evidence-trail';

describe('splitEvidenceTrail', () => {
  it('returns note unchanged when no evidence heading exists', () => {
    const parsed = splitEvidenceTrail('I supported Lewis with medication and lunch prep.');
    expect(parsed.note).toBe('I supported Lewis with medication and lunch prep.');
    expect(parsed.evidence).toEqual([]);
  });

  it('extracts bullet evidence trail lines', () => {
    const parsed = splitEvidenceTrail(`I supported Lewis throughout the shift.

Evidence Trail:
- [RAW DATA] "requested morning medication at 11:45"
- [DOCUMENT: support plan BCC.pdf] "prompting with personal care routine"
`);
    expect(parsed.note).toBe('I supported Lewis throughout the shift.');
    expect(parsed.evidence).toEqual([
      '[RAW DATA] "requested morning medication at 11:45"',
      '[DOCUMENT: support plan BCC.pdf] "prompting with personal care routine"',
    ]);
  });
});
