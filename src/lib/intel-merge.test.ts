import { describe, expect, it } from 'vitest';
import { mergeSupportPlanData, mergeCarePlanData } from './intel-merge';
import { emptyCarePlan } from './client-store';

describe('intel-merge', () => {
  it('merges support plans additively instead of overwriting', () => {
    const base = {
      needs: [
        {
          area: 'Managing and maintaining nutrition',
          canDoMyself: 'Needs support with meal planning',
          risks: '',
          howToSupport: 'Prompt meal preparation',
        },
      ],
      planDate: '01/05/2026',
    };
    const incoming = {
      needs: [
        {
          area: 'Managing and maintaining nutrition',
          canDoMyself: 'Needs support with meal planning and shopping',
          risks: 'Risk of skipping meals',
          howToSupport: 'Prompt meal preparation and hydration reminders',
        },
        {
          area: 'Maintaining personal hygiene',
          canDoMyself: 'Needs prompts for hygiene tasks',
          risks: '',
          howToSupport: 'Prompt and supervise routine',
        },
      ],
      planDate: '10/05/2026',
    };

    const merged = mergeSupportPlanData(base, incoming);
    expect(merged?.needs.length).toBe(2);
    expect(merged?.needs.find(n => /nutrition/i.test(n.area))?.risks).toMatch(/skipping meals/i);
  });

  it('does not replace existing care plan with empty incoming structure', () => {
    const base = emptyCarePlan('14/05/2026', '14/08/2026');
    base.domains[0].enabled = true;
    base.domains[0].identifiedNeed = 'Needs supervision with environmental safety checks';

    const incoming = emptyCarePlan('14/05/2026', '14/08/2026');
    const merged = mergeCarePlanData(base, incoming, '14/05/2026');
    expect(merged?.domains[0].enabled).toBe(true);
    expect(merged?.domains[0].identifiedNeed).toMatch(/environmental safety/i);
  });
});
