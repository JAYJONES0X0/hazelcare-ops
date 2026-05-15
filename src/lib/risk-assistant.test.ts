import { describe, expect, it } from 'vitest';
import { buildClusterNote, buildRiskItemCopy, clusterRiskItems } from './risk-assistant';
import type { RiskItem } from './client-store';

function risk(partial: Partial<RiskItem>): RiskItem {
  return {
    id: partial.id || `risk-${Math.random().toString(36).slice(2, 7)}`,
    title: partial.title || '',
    description: partial.description || '',
    behaviours: partial.behaviours || [],
    affectedPeople: partial.affectedPeople || [],
    triggers: partial.triggers || [],
    earlyWarnings: partial.earlyWarnings || [],
    controls: partial.controls || [],
    dynamicControls: partial.dynamicControls || [],
    secondaryRisk: partial.secondaryRisk || '',
    contingencyPlan: partial.contingencyPlan || '',
    leastRestrictive: partial.leastRestrictive || '',
    likelihood: partial.likelihood || 3,
    impact: partial.impact || 3,
    reviewTrigger: partial.reviewTrigger || '',
  };
}

describe('risk-assistant', () => {
  it('groups related risks and flags hotspots', () => {
    const clusters = clusterRiskItems([
      risk({ title: 'Falls after standing', description: 'Client unsteady when getting up', triggers: ['Standing too quickly'], controls: ['Prompt to stand slowly'] }),
      risk({ title: 'Trip hazard in lounge', description: 'Loose cable causes trip risk', triggers: ['Poor housekeeping'], controls: ['Remove cable'] }),
      risk({ title: 'Slip risk in bathroom', description: 'Wet floor after shower', triggers: ['Wet surfaces'], controls: ['Use bath mat'] }),
      risk({ title: 'Medication refusal', description: 'Refusing tablets', triggers: ['Anxiety'], controls: ['Offer later'] }),
    ]);

    expect(clusters[0].key).toBe('mobility');
    expect(clusters[0].count).toBe(3);
    expect(clusters[0].hotspot).toBe(true);
    expect(clusters[1].key).toBe('medication');
  });

  it('builds copy text for a single risk item', () => {
    const text = buildRiskItemCopy(
      risk({
        title: 'Medication refusal',
        description: 'Client declined morning medication.',
        triggers: ['Anxiety'],
        earlyWarnings: ['Pacing'],
        controls: ['Offer calmly', 'Re-approach later'],
        reviewTrigger: 'After repeated refusal',
      })
    );

    expect(text).toContain('Risk: Medication refusal');
    expect(text).toContain('Controls: Offer calmly | Re-approach later');
    expect(text).toContain('Review trigger: After repeated refusal');
  });

  it('builds a category note from clustered risks', () => {
    const clusters = clusterRiskItems([
      risk({ title: 'Falls after standing', controls: ['Prompt to stand slowly'] }),
      risk({ title: 'Trip hazard in lounge', controls: ['Remove cable'] }),
      risk({ title: 'Slip risk in bathroom', controls: ['Use bath mat'] }),
    ]);

    const note = buildClusterNote(clusters[0]);
    expect(note).toContain('Risk category: Mobility & Falls');
    expect(note).toContain('Risk count: 3 (hotspot)');
    expect(note).toContain('Record: what was observed');
  });
});
