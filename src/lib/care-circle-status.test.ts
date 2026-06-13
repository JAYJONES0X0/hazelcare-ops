import { describe, expect, it } from 'vitest';
import { getCareCircleStatus, careCircleModeLabel } from './care-circle-status';
import type { FullClient } from './client-store';

describe('care circle status', () => {
  it('marks unresolved family items as not share-ready', () => {
    const status = getCareCircleStatus({
      name: 'Ready With Concern',
      careCircle: {
        mode: 'standard_family_window',
        contacts: [{
          id: 'contact-1',
          name: 'Family Contact',
          relationship: 'Daughter',
          email: 'family@example.com',
          phone: '',
          permissionLevel: 'reassurance',
          verified: true,
          consentBasis: '',
          restrictions: '',
          reviewDate: '30/12/2026',
        }],
        updates: [{
          id: 'update-1',
          dateFrom: '',
          dateTo: '',
          mode: 'standard_family_window',
          status: 'reviewed',
          shareability: 'green',
          summary: 'Reviewed family update.',
          sourceEntryIds: [],
          reviewedBy: 'Manager',
          reviewedAt: '2026-06-13T12:00:00.000Z',
          createdAt: '2026-06-13T12:00:00.000Z',
        }],
        concerns: [{
          id: 'concern-1',
          type: 'question',
          source: 'Family',
          detail: 'Family asked about weekend leave.',
          owner: 'Manager',
          priority: 'medium',
          status: 'open',
          createdAt: '2026-06-13T12:00:00.000Z',
          response: '',
        }],
        activity: [],
        notes: '',
      },
    } as FullClient);

    expect(status.ready).toBe(false);
    expect(status.issues).toContain('1 open item');
  });

  it('does not crash on partial imported contact records', () => {
    const status = getCareCircleStatus({
      name: 'Messy Import',
      careCircle: {
        mode: 'collaborative',
        contacts: [{
          id: 'contact-2',
          name: 'Unfinished Contact',
          relationship: 'Brother',
          permissionLevel: 'reassurance',
          verified: true,
          reviewDate: '30/12/2026',
        }],
        updates: [],
        concerns: [],
        activity: [],
        notes: '',
      },
    } as unknown as FullClient);

    expect(status.ready).toBe(false);
    expect(status.routeMissing).toHaveLength(1);
    expect(status.issues).toContain('No reviewed update');
    expect(status.issues).toContain('No verified route');
  });

  it('returns a safe display label for unknown legacy modes', () => {
    expect(careCircleModeLabel(undefined)).toBe('off');
    expect(careCircleModeLabel('collaborative' as never)).toBe('collaborative');
    expect(careCircleModeLabel('old_family_portal' as never)).toBe('old family portal');
  });
});
