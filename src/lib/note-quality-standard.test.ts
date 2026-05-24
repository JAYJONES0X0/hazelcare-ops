import { describe, expect, it } from 'vitest';
import { assessNoteStandard, buildProfessionalNoteDirective } from './note-quality-standard';

describe('note quality standard', () => {
  it('marks a thin task tick as missing the golden structure', () => {
    const result = assessNoteStandard('Client had a good day. Support given. No concerns.');

    expect(result.score).toBeLessThan(55);
    expect(result.missingIds).toContain('time');
    expect(result.missingIds).toContain('who');
    expect(result.missingIds).toContain('what');
    expect(result.missingIds).toContain('why');
    expect(result.missingIds).toContain('how');
    expect(result.missingIds).toContain('detail');
  });

  it('accepts a note that explains who, what, why, how, and outcome', () => {
    const note = [
      'At 08:30 I supported Wayne in his room after he declined personal care and appeared low in mood.',
      'I used a calm tone, explained why hygiene support was being offered, and gave him time before approaching again.',
      'Wayne continued to decline but was able to make his choice known. I respected this and continued monitoring.',
      'At handover I told the senior carer that Wayne had declined hygiene support and that prompts should continue gently.'
    ].join(' ');

    const result = assessNoteStandard(note);

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.missingIds).not.toContain('who');
    expect(result.missingIds).not.toContain('what');
    expect(result.missingIds).not.toContain('why');
    expect(result.missingIds).not.toContain('how');
    expect(result.missingIds).not.toContain('outcome');
  });

  it('flags risky contradiction wording that needs source alignment', () => {
    const result = assessNoteStandard(
      'At 21:00 Wayne refused his medication and later took it as prescribed with staff support.'
    );

    expect(result.risks.some((risk) => risk.id === 'conflicting-medication-status')).toBe(true);
    expect(result.status).toBe('needs-review');
  });

  it('builds a directive for the AI rewrite prompt', () => {
    const directive = buildProfessionalNoteDirective('Wayne Jefferson', 'Use MAR outcome only.');

    expect(directive).toContain('Wayne Jefferson');
    expect(directive).toContain('Who');
    expect(directive).toContain('Outcome');
    expect(directive).toContain('Use MAR outcome only.');
  });
});
