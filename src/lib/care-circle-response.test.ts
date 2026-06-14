import { describe, expect, it } from 'vitest';
import { buildCareCircleFamilyResponseText, getCareCircleResponseStatus } from './care-circle-response';
import type { CareCircleConcern } from './client-store';

const concern: CareCircleConcern = {
  id: 'concern-1',
  type: 'question',
  source: 'Sarah Family',
  detail: 'Can we confirm weekend leave?',
  owner: 'Manager',
  priority: 'high',
  status: 'open',
  createdAt: '2026-06-14T10:00:00.000Z',
  response: '',
  dueDate: '2026-06-17',
};

describe('care circle response workflow', () => {
  it('requires a recorded response before a family item is response-ready', () => {
    expect(getCareCircleResponseStatus(concern)).toEqual({
      label: 'Needs response',
      tone: 'amber',
      canCopy: false,
      canResolve: false,
    });
  });

  it('allows copying and closure when a response has been recorded', () => {
    const withResponse = { ...concern, response: 'We will confirm with the manager after the morning handover.' };

    expect(getCareCircleResponseStatus(withResponse)).toMatchObject({
      label: 'Response drafted',
      tone: 'green',
      canCopy: true,
      canResolve: true,
    });
    expect(buildCareCircleFamilyResponseText('Ryan Shade', withResponse)).toContain('Response for Ryan Shade');
    expect(buildCareCircleFamilyResponseText('Ryan Shade', withResponse)).toContain('Item type: question');
    expect(buildCareCircleFamilyResponseText('Ryan Shade', withResponse)).toContain('Response status: Response drafted');
    expect(buildCareCircleFamilyResponseText('Ryan Shade', withResponse)).toContain('We will confirm with the manager after the morning handover.');
  });

  it('does not copy raw original concern detail into family response text', () => {
    const withSensitiveDetail = {
      ...concern,
      detail: 'Medication error and safeguarding allegation discussed internally.',
      response: 'Thank you for raising this. The manager has reviewed the matter and will update you after the planned check.',
    };

    const text = buildCareCircleFamilyResponseText('Ryan Shade', withSensitiveDetail);

    expect(text).toContain('Thank you for raising this.');
    expect(text).not.toContain('Medication error and safeguarding allegation discussed internally.');
    expect(text).not.toContain('Item:');
  });

  it('marks resolved items as closed but still preserves response copy', () => {
    const resolved = { ...concern, status: 'resolved' as const, response: 'Family informed and no further action requested.' };

    expect(getCareCircleResponseStatus(resolved)).toMatchObject({
      label: 'Closed',
      tone: 'muted',
      canCopy: true,
      canResolve: true,
    });
  });
});
