import { describe, expect, it } from 'vitest';
import { buildCareCircleOversightCsv, buildCareCircleOversightReportHtml, buildCareCircleOversightRows } from './care-circle-oversight';
import type { FullClient } from './client-store';

function client(overrides: Partial<FullClient>): FullClient {
  return {
    id: 'client-1',
    name: 'Ryan Shade',
    preferredName: 'Ryan',
    dob: '',
    address: '',
    nhs: '',
    phone: '',
    diagnoses: [],
    keyWorker: '',
    responsible: '',
    completedBy: '',
    dateOfAdmission: '',
    reviewDate: '',
    createdAt: '2026-06-14T10:00:00.000Z',
    updatedAt: '2026-06-14T10:00:00.000Z',
    pbs: null,
    risk: null,
    carePlan: null,
    supportPlan: null,
    documents: [],
    ...overrides,
  };
}

describe('care circle oversight queue', () => {
  it('prioritises overdue family responses over ready rows', () => {
    const rows = buildCareCircleOversightRows([
      client({
        id: 'ready',
        name: 'Ready Person',
        careCircle: {
          mode: 'standard_family_window',
          notes: '',
          contacts: [{ id: 'c1', name: 'A', relationship: 'Daughter', email: 'a@example.com', phone: '', permissionLevel: 'reassurance', verified: true, consentBasis: '', restrictions: '', reviewDate: '30/12/2026' }],
          updates: [{ id: 'u1', dateFrom: '', dateTo: '', mode: 'standard_family_window', status: 'reviewed', shareability: 'green', summary: 'Reviewed.', sourceEntryIds: [], reviewedBy: 'Manager', reviewedAt: '2026-06-14T10:00:00.000Z', createdAt: '2026-06-14T10:00:00.000Z' }],
          concerns: [],
          activity: [],
        },
      }),
      client({
        id: 'overdue',
        name: 'Overdue Person',
        careCircle: {
          mode: 'standard_family_window',
          notes: '',
          contacts: [],
          updates: [],
          concerns: [{ id: 'q1', type: 'question', source: 'Family', detail: 'Need an answer.', owner: 'Manager', priority: 'high', status: 'open', createdAt: '2026-06-01T10:00:00.000Z', response: '', dueDate: '01/06/2026' }],
          activity: [],
        },
      }),
    ], new Date('2026-06-14T12:00:00.000Z'));

    expect(rows[0].client.name).toBe('Overdue Person');
    expect(rows[0].queueLabel).toBe('Overdue response');
    expect(rows[0].waitingResponses).toBe(1);
    expect(rows[0].overdueItems).toBe(1);
    expect(rows[1].queueLabel).toBe('Ready to release');
  });

  it('keeps recently shared inactive rows visible as evidence', () => {
    const rows = buildCareCircleOversightRows([
      client({
        careCircle: {
          mode: 'off',
          notes: '',
          contacts: [],
          updates: [],
          concerns: [],
          activity: [{ id: 'a1', type: 'share_pack_copied', label: 'Share pack copied', detail: 'Copied.', createdAt: '2026-06-14T10:00:00.000Z', actor: 'Manager' }],
        },
      }),
    ], new Date('2026-06-14T12:00:00.000Z'));

    expect(rows).toHaveLength(1);
    expect(rows[0].queueLabel).toBe('Recently shared');
  });

  it('builds a printable report without leaking raw unsafe HTML', () => {
    const rows = buildCareCircleOversightRows([
      client({
        name: 'Ryan <script>alert(1)</script>',
        careCircle: {
          mode: 'standard_family_window',
          notes: '',
          contacts: [{ id: 'c1', name: 'A', relationship: 'Daughter', email: 'a@example.com', phone: '', permissionLevel: 'reassurance', verified: true, consentBasis: '', restrictions: '', reviewDate: '30/12/2026' }],
          updates: [{ id: 'u1', dateFrom: '', dateTo: '', mode: 'standard_family_window', status: 'reviewed', shareability: 'green', summary: 'Reviewed.', sourceEntryIds: [], reviewedBy: 'Manager', reviewedAt: '2026-06-14T10:00:00.000Z', createdAt: '2026-06-14T10:00:00.000Z' }],
          concerns: [{ id: 'q1', type: 'question', source: 'Family', detail: 'Need <urgent> reply.', owner: 'Manager', priority: 'high', status: 'open', createdAt: '2026-06-01T10:00:00.000Z', response: '', dueDate: '01/06/2026' }],
          activity: [],
        },
      }),
    ], new Date('2026-06-14T12:00:00.000Z'));

    const html = buildCareCircleOversightReportHtml(rows, new Date('2026-06-14T12:00:00.000Z'));

    expect(html).toContain('Care Circle Oversight Report');
    expect(html).toContain('Overdue response');
    expect(html).toContain('Ryan &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('Ryan <script>alert(1)</script>');
    expect(html).not.toContain('Need <urgent> reply.');
  });

  it('exports oversight rows to spreadsheet-safe CSV', () => {
    const rows = buildCareCircleOversightRows([
      client({
        name: 'Ryan "The Shade"',
        careCircle: {
          mode: 'standard_family_window',
          notes: '',
          contacts: [{ id: 'c1', name: 'A', relationship: 'Daughter', email: 'a@example.com', phone: '', permissionLevel: 'reassurance', verified: true, consentBasis: '', restrictions: '', reviewDate: '30/12/2026' }],
          updates: [{ id: 'u1', dateFrom: '', dateTo: '', mode: 'standard_family_window', status: 'reviewed', shareability: 'green', summary: 'Reviewed.', sourceEntryIds: [], reviewedBy: 'Manager', reviewedAt: '2026-06-14T10:00:00.000Z', createdAt: '2026-06-14T10:00:00.000Z' }],
          concerns: [{ id: 'q1', type: 'question', source: 'Family', detail: 'Need reply.', owner: 'Manager', priority: 'high', status: 'open', createdAt: '2026-06-01T10:00:00.000Z', response: '', dueDate: '01/06/2026' }],
          activity: [],
        },
      }),
    ], new Date('2026-06-14T12:00:00.000Z'));

    const csv = buildCareCircleOversightCsv(rows);

    expect(csv.split('\n')[0]).toBe('client_id,client_name,queue_state,mode,ready,verified_contacts,total_contacts,open_items,waiting_responses,overdue_responses,recent_share,issues,open_item_summary');
    expect(csv).toContain('"Ryan ""The Shade"""');
    expect(csv).toContain('"Overdue response"');
    expect(csv).toContain('question / high / Needs response due 01/06/2026: Need reply.');
  });
});
