import { describe, expect, it } from 'vitest';
import { emptyClient } from './client-store';
import { clientHasTaskSources, generateTasksForClient } from './nourish-task-pack';

describe('Nourish task pack generation', () => {
  it('uses Intelligence Vault documents as task sources when structured plans are not present', () => {
    const client = emptyClient();
    client.name = 'Lewis Johnson';
    client.carePlan = null;
    client.supportPlan = null;
    client.risk = null;
    client.vaultDocs = [
      {
        id: 'vault-support-plan',
        name: 'Lewis support plan.pdf',
        uploadedAt: '2026-05-27T09:00:00.000Z',
        text: [
          'Lewis requires prompting with medication and staff must record refused or missed doses.',
          'Lewis needs support to shower, dress and maintain personal hygiene.',
          'Lewis needs encouragement with breakfast, meals and fluids.',
          'There is a fire and clutter risk in the bedroom, staff should prompt safe room upkeep.',
        ].join('\n'),
      },
    ];

    expect(clientHasTaskSources(client)).toBe(true);

    const tasks = generateTasksForClient(client);

    expect(tasks.map((task) => task.domain)).toEqual(
      expect.arrayContaining([
        'Medication Management & Safety',
        'Personal Care & Physical Presentation',
        'Nutrition, Hydration & Diet',
        'Environment & Physical Safety',
      ])
    );
    expect(tasks.every((task) => task.source.includes('Intelligence Vault'))).toBe(true);
    expect(tasks.some((task) => task.mandatory)).toBe(true);
  });
});
