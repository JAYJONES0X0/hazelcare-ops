import { describe, expect, it } from 'vitest';
import { emptyClient, emptyCarePlan, emptyRisk } from './client-store';
import { buildCarePlanHtml, buildPBSHtml, buildRiskHtml } from './doc-renderer';

describe('doc-renderer titles', () => {
  it('injects client-specific document titles for print/export filename defaults', () => {
    (globalThis as unknown as { localStorage: { getItem: (k: string) => string | null } }).localStorage = {
      getItem: () => null,
    };

    const client = emptyClient();
    client.name = 'Jamie Morton';
    client.carePlan = emptyCarePlan('14/05/2026', '14/08/2026');
    client.risk = client.risk || emptyRisk('14/05/2026');

    const pbs = buildPBSHtml(client);
    const risk = buildRiskHtml(client);
    const care = buildCarePlanHtml(client);

    expect(pbs).toContain('<title>Jamie Morton — PBS Plan</title>');
    expect(risk).toContain('<title>Jamie Morton — Risk Assessment</title>');
    expect(care).toContain('<title>Jamie Morton — Care Plan</title>');
  });
});
