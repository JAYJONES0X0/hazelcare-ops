import { describe, expect, it } from 'vitest';
import { getCareCircleOperationalInsight } from './care-circle-insights';
import type { CareCircleData } from './client-store';

const readyCircle: CareCircleData = {
  mode: 'standard_family_window',
  notes: '',
  contacts: [{
    id: 'contact-1',
    name: 'Sarah',
    relationship: 'Daughter',
    email: 'sarah@example.com',
    phone: '',
    permissionLevel: 'reassurance',
    verified: true,
    consentBasis: 'Consent confirmed.',
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
    summary: 'Reviewed reassurance update.',
    sourceEntryIds: [],
    reviewedBy: 'Manager',
    reviewedAt: '2026-06-14T10:00:00.000Z',
    createdAt: '2026-06-14T10:00:00.000Z',
  }],
  concerns: [],
  activity: [],
};

describe('care circle operational insights', () => {
  it('explains when a family window is ready to release', () => {
    const insight = getCareCircleOperationalInsight(readyCircle, {
      ready: true,
      issues: [],
      contactsInScope: readyCircle.contacts,
      latestUpdate: readyCircle.updates[0],
      openItems: [],
    });

    expect(insight.releaseState).toBe('ready');
    expect(insight.nextMove).toContain('Ready to release');
    expect(insight.controls).toContain('Read-only family visibility with manager review before circulation.');
  });

  it('prioritises unresolved family items before sharing', () => {
    const blockedCircle: CareCircleData = {
      ...readyCircle,
      concerns: [{
        id: 'concern-1',
        type: 'question',
        source: 'Family',
        detail: 'Can we confirm weekend leave?',
        owner: 'Manager',
        priority: 'high',
        status: 'open',
        createdAt: '2026-06-14T10:00:00.000Z',
        response: '',
      }],
    };
    const insight = getCareCircleOperationalInsight(blockedCircle, {
      ready: false,
      issues: ['1 open family item needs resolution or manager sign-off.'],
      contactsInScope: blockedCircle.contacts,
      latestUpdate: blockedCircle.updates[0],
      openItems: blockedCircle.concerns,
    });

    expect(insight.releaseState).toBe('blocked');
    expect(insight.nextMove).toContain('Resolve or manager-sign off 1 open family item');
    expect(insight.pressureLine).toContain('1 high-priority family item');
  });
});
