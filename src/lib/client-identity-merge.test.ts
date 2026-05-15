import { describe, expect, it } from 'vitest';
import { emptyClient } from './client-store';
import { mergeClientIdentity } from './client-identity-merge';

describe('mergeClientIdentity', () => {
  it('preserves existing person name when incoming name is org-like', () => {
    const base = emptyClient();
    base.name = 'Jamie Morton';
    base.preferredName = 'Jamie';
    base.dob = '08/08/2006';

    const merged = mergeClientIdentity(base, {
      name: 'Hazel Care Ltd',
      preferredName: 'Hazel',
      dob: '14/05/2026',
    });

    expect(merged.name).toBe('Jamie Morton');
    expect(merged.preferredName).toBe('Jamie');
    expect(merged.dob).toBe('14/05/2026');
  });

  it('accepts valid incoming client identity fields', () => {
    const base = emptyClient();
    base.name = 'Wayne Jefferson';

    const merged = mergeClientIdentity(base, {
      name: 'Mr Wayne Jefferson',
      preferredName: 'Wayne',
      nhs: '490 674 4699',
      address: '317 Two Mile Hill Road, Bristol',
    });

    expect(merged.name).toBe('Mr Wayne Jefferson');
    expect(merged.preferredName).toBe('Wayne');
    expect(merged.nhs).toBe('490 674 4699');
    expect(merged.address).toContain('Bristol');
  });
});

