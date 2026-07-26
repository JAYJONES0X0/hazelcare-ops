import { describe, expect, it } from 'vitest';
import type { FullClient } from './client-store';
import type { CareEntry } from './types';
import {
  buildCareCircleFamilyDigest,
  careCircleClientEvidenceRefs,
  careCircleDigestShareability,
  isCareCircleFamilySensitiveEntry,
} from './care-circle-family-digest';

function entry(overrides: Partial<CareEntry>): CareEntry {
  return {
    id: overrides.id || 'entry-1',
    date: overrides.date || '14/06/2026',
    time: overrides.time || '09:00',
    house: overrides.house || 'Rose House',
    type: overrides.type || 'Daily support',
    carer: overrides.carer || 'Louise T',
    client: overrides.client || 'Ryan Shade',
    entry: overrides.entry || 'Ryan was chatty and in good spirits. Breakfast was prepared and laundry was put on.',
    severity: overrides.severity || 'green',
    flags: overrides.flags || [],
    category: overrides.category,
  };
}

const client = {
  name: 'Ryan Shade',
  preferredName: 'Ryan',
  carePlan: {
    domains: [
      {
        title: 'Social Engagement & Relationships',
        enabled: true,
        identifiedNeed: 'Ryan benefits from reassurance before family visits.',
      },
    ],
  },
  supportPlan: {
    needs: [{ area: 'Daily routine', canDoMyself: 'Can choose breakfast.', howToSupport: 'Prompt gently.', risks: '' }],
  },
  clinicalBriefing: 'Internal formulation should stay in OVSITE.',
} as unknown as FullClient;

describe('care circle family digest', () => {
  it('builds a family-visible day-window update instead of raw pasted records', () => {
    const digest = buildCareCircleFamilyDigest(client, [
      entry({ id: 'a', time: '10:30', entry: 'Ryan enjoyed toast and tea. He was chatty and settled.' }),
      entry({ id: 'b', time: '09:00', type: 'Personal care', entry: 'Personal care support offered and laundry put on.' }),
    ], 'standard_family_window');

    expect(digest).toContain('Family update for Ryan');
    expect(digest).toContain('Visit window: 09:00 to 10:30');
    expect(digest).toContain('Mood / presentation: Settled, engaged, or in good spirits');
    expect(digest).toContain('Support completed: Daily support, Personal care');
    expect(digest).toContain('Notes family can see:');
    expect(digest).toContain('Before sharing: confirm consent');
  });

  it('holds sensitive entries back from the family-facing notes', () => {
    const digest = buildCareCircleFamilyDigest(client, [
      entry({ id: 'safe', entry: 'Ryan was calm and enjoyed breakfast.' }),
      entry({ id: 'risk', entry: 'Medication error and safeguarding concern discussed with police.', severity: 'red', category: 'safeguarding' }),
    ], 'standard_family_window');

    expect(digest).toContain('Ryan was calm and enjoyed breakfast.');
    expect(digest).toContain('Held for manager review: 1 source entry was not included');
    expect(digest).not.toContain('Medication error and safeguarding concern discussed with police.');
  });

  it('grades shareability from family-safety pressure', () => {
    expect(careCircleDigestShareability([entry({})], 'standard_family_window')).toBe('green');
    expect(careCircleDigestShareability([entry({ entry: 'Medication error reviewed.', severity: 'amber' })], 'standard_family_window')).toBe('amber');
    expect(careCircleDigestShareability([
      entry({ id: '1', entry: 'Medication error reviewed.' }),
      entry({ id: '2', entry: 'Safeguarding concern logged.' }),
    ], 'standard_family_window')).toBe('red');
    expect(careCircleDigestShareability([entry({})], 'off')).toBe('red');
  });

  it('identifies sensitive records with category, flags, severity, and wording', () => {
    expect(isCareCircleFamilySensitiveEntry(entry({ category: 'safeguarding' }))).toBe(true);
    expect(isCareCircleFamilySensitiveEntry(entry({ severity: 'red' }))).toBe(true);
    expect(isCareCircleFamilySensitiveEntry(entry({ flags: ['complaint'] }))).toBe(true);
    expect(isCareCircleFamilySensitiveEntry(entry({ entry: 'Had lunch and watched TV.' }))).toBe(false);
  });

  it('builds internal evidence refs from the real care profile fields', () => {
    const refs = careCircleClientEvidenceRefs(client);

    expect(refs).toContain('Care plan / Social Engagement & Relationships: Ryan benefits from reassurance before family visits.');
    expect(refs).toContain('Support plan / Daily routine: Can choose breakfast.');
    expect(refs).toContain('Clinical briefing: Internal formulation should stay in OVSITE.');
  });
});
