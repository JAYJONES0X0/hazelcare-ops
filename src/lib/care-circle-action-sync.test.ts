import { describe, expect, it } from 'vitest';
import { syncCareCircleLinkedAction } from './care-circle-action-sync';
import type { Action } from './types';

const action: Action = {
  id: 'action-1',
  title: 'question - Ryan Shade',
  description: 'Can we confirm weekend leave?',
  house: 'Family Circle',
  owner: 'Manager',
  priority: 'high',
  status: 'open',
  createdAt: '14/06/2026',
  dueDate: '17/06/2026',
  sourceEntry: 'care-circle:client-1:concern-1',
  tags: ['care-circle', 'question', 'Ryan Shade'],
};

describe('care circle linked action sync', () => {
  it('completes the linked action when a concern is resolved', () => {
    const synced = syncCareCircleLinkedAction([action], 'action-1', 'resolved', '2026-06-14T11:30:00.000Z');

    expect(synced[0]).toMatchObject({
      status: 'completed',
      completedAt: '2026-06-14T11:30:00.000Z',
    });
  });

  it('reopens a completed linked action when a concern is moved back to open', () => {
    const completed = { ...action, status: 'completed' as const, completedAt: '2026-06-14T11:30:00.000Z' };

    const synced = syncCareCircleLinkedAction([completed], 'action-1', 'open', '2026-06-14T12:00:00.000Z');

    expect(synced[0]).toMatchObject({ status: 'open' });
    expect(synced[0].completedAt).toBeUndefined();
  });

  it('moves a linked action to in progress when a concern is in progress', () => {
    const synced = syncCareCircleLinkedAction([action], 'action-1', 'in_progress', '2026-06-14T12:00:00.000Z');

    expect(synced[0]).toMatchObject({ status: 'in_progress' });
  });
});
