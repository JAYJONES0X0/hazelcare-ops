import { describe, expect, it } from 'vitest';
import { buildCareCircleInternalDraftText } from './care-circle-draft-copy';

describe('buildCareCircleInternalDraftText', () => {
  it('wraps an unsaved Care Circle draft as internal review copy', () => {
    const text = buildCareCircleInternalDraftText({
      clientName: 'Ryan Shade',
      draft: 'Family can know Ryan enjoyed lunch and music today.',
      sourceCount: 7,
      shareability: 'amber',
    });

    expect(text).toContain('INTERNAL CARE CIRCLE REVIEW DRAFT - DO NOT SHARE EXTERNALLY');
    expect(text).toContain('Person: Ryan Shade');
    expect(text).toContain('Status: Not reviewed / not released');
    expect(text).toContain('Shareability signal: amber');
    expect(text).toContain('Source entries scanned: 7');
    expect(text).toContain('Family can know Ryan enjoyed lunch and music today.');
    expect(text).toContain('Use the reviewed update or share pack controls for external circulation.');
  });

  it('uses a clear fallback when the draft is empty', () => {
    const text = buildCareCircleInternalDraftText({
      clientName: 'Jamie Morton',
      draft: '   ',
      sourceCount: 0,
      shareability: 'red',
    });

    expect(text).toContain('Person: Jamie Morton');
    expect(text).toContain('No draft text recorded.');
  });
});
