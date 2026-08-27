import type { CareCircleConcern } from './client-store';
import type { Action } from './types';

export function syncCareCircleLinkedAction(
  actions: Action[],
  actionId: string | undefined,
  concernStatus: CareCircleConcern['status'],
  timestamp = new Date().toISOString()
) {
  if (!actionId) return actions;
  return actions.map((action) => {
    if (action.id !== actionId) return action;
    if (concernStatus === 'resolved') {
      return { ...action, status: 'completed' as const, completedAt: action.completedAt || timestamp };
    }
    const openAction = { ...action };
    delete openAction.completedAt;
    return {
      ...openAction,
      status: concernStatus === 'in_progress' ? 'in_progress' as const : 'open' as const,
    };
  });
}
