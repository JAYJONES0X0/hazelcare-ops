import { describe, expect, it } from 'vitest';
import { buildCareCircleSharePackHtml, buildCareCircleSharePackText, canReleaseCareCircleSharePack, getCareCircleShareReadiness } from './care-circle-share-pack';
import type { FullClient } from './client-store';

const client = {
  name: 'Jane <script>alert(1)</script>',
  careCircle: {
    mode: 'old_family_portal',
    notes: 'Do not share <private> raw details.',
    contacts: [{
      id: 'contact-1',
      name: 'Sam <b>Relative</b>',
      relationship: '',
      permissionLevel: 'reassurance',
      verified: true,
      reviewDate: '30/12/2026',
    }],
    updates: [{
      id: 'update-1',
      dateFrom: '',
      dateTo: '',
      mode: 'old_family_portal',
      status: 'reviewed',
      shareability: 'green',
      summary: 'Jane was settled.\n<script>alert("x")</script>',
      sourceEntryIds: [],
      reviewedBy: 'Manager',
      reviewedAt: '2026-06-13T12:00:00.000Z',
      createdAt: '2026-06-13T12:00:00.000Z',
    }],
    concerns: [{
      id: 'concern-1',
      source: 'Family',
      detail: 'Please confirm weekend plan <urgent>.',
      owner: 'Manager',
      priority: 'medium',
      status: 'open',
      createdAt: '2026-06-13T12:00:00.000Z',
      response: '',
    }],
    activity: [],
  },
} as unknown as FullClient;

describe('care circle share pack', () => {
  it('blocks pack readiness while family items remain open', () => {
    const readiness = getCareCircleShareReadiness(client.careCircle!, 'reassurance');

    expect(readiness.ready).toBe(false);
    expect(readiness.issues).toContain('1 open family item needs resolution or manager sign-off.');
  });

  it('requires manager override before releasing a blocked share pack', () => {
    const readiness = getCareCircleShareReadiness(client.careCircle!, 'reassurance');

    expect(canReleaseCareCircleSharePack(readiness, false)).toBe(false);
    expect(canReleaseCareCircleSharePack(readiness, true)).toBe(true);
  });

  it('builds text from partial legacy records without crashing', () => {
    const text = buildCareCircleSharePackText(client, client.careCircle!, 'reassurance');

    expect(text).toContain('Care Circle Pack - Jane <script>alert(1)</script>');
    expect(text).toContain('Mode: old family portal');
    expect(text).toContain('relationship not recorded');
    expect(text).toContain('concern / medium / open: Please confirm weekend plan <urgent>.');
  });

  it('escapes family-facing HTML output', () => {
    const html = buildCareCircleSharePackHtml(client, client.careCircle!, 'reassurance');

    expect(html).toContain('Jane &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Sam &lt;b&gt;Relative&lt;/b&gt;');
    expect(html).toContain('Please confirm weekend plan &lt;urgent&gt;.');
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).not.toContain('<private>');
  });
});
