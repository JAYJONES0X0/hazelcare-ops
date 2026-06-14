import type { CareCircleConcern, CareCircleContact, CareCircleData, CareCircleMode, CareCircleUpdate } from './client-store';
import { careCircleModeLabel } from './care-circle-status';

type CareCircleReadiness = {
  ready: boolean;
  issues: string[];
  contactsInScope: CareCircleContact[];
  latestUpdate: CareCircleUpdate | null;
  openItems: CareCircleConcern[];
};

export type CareCircleReleaseState = 'closed' | 'needs_setup' | 'needs_update' | 'blocked' | 'ready';

const MODE_CONTROL_COPY: Record<CareCircleMode, string> = {
  off: 'Family visibility is closed for this profile.',
  light_reassurance: 'Light reassurance only: short wellbeing updates, no raw care record.',
  standard_family_window: 'Read-only family visibility with manager review before circulation.',
  collaborative: 'Collaborative window: family input is accepted but still triaged by staff.',
  professional_access: 'Professional access: share only role-relevant information with verified professionals.',
};

function plural(count: number, singular: string, pluralText = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralText}`;
}

function highPressureItems(items: CareCircleConcern[]) {
  return items.filter((item) => item.priority === 'critical' || item.priority === 'high');
}

function releaseState(circle: Partial<CareCircleData>, readiness: CareCircleReadiness): CareCircleReleaseState {
  if (circle.mode === 'off') return 'closed';
  if (!readiness.contactsInScope.length) return 'needs_setup';
  if (!readiness.latestUpdate) return 'needs_update';
  if (readiness.openItems.length || readiness.issues.length) return 'blocked';
  return 'ready';
}

function nextMoveFor(state: CareCircleReleaseState, readiness: CareCircleReadiness) {
  if (state === 'closed') return 'Keep the family window closed, or choose an optional sharing mode before adding contacts.';
  if (state === 'needs_setup') return 'Add at least one verified contact with a safe email or phone route for this audience.';
  if (state === 'needs_update') return 'Generate and review a family-facing update before releasing anything externally.';
  if (readiness.openItems.length) {
    return `Resolve or manager-sign off ${plural(readiness.openItems.length, 'open family item')} before release.`;
  }
  if (readiness.issues.length) return readiness.issues[0];
  return 'Ready to release a controlled, permission-aware share pack.';
}

function pressureLineFor(items: CareCircleConcern[]) {
  const pressure = highPressureItems(items);
  if (pressure.length) return `${plural(pressure.length, 'high-priority family item')} needs a manager response.`;
  if (items.length) return `${plural(items.length, 'family item')} remains open.`;
  return 'No open family items are blocking release.';
}

export function getCareCircleOperationalInsight(circle: Partial<CareCircleData>, readiness: CareCircleReadiness) {
  const mode = (circle.mode || 'off') as CareCircleMode;
  const state = releaseState(circle, readiness);
  return {
    releaseState: state,
    windowLabel: careCircleModeLabel(mode),
    nextMove: nextMoveFor(state, readiness),
    pressureLine: pressureLineFor(readiness.openItems),
    controls: [
      MODE_CONTROL_COPY[mode] || MODE_CONTROL_COPY.off,
      'Contacts need permission scope, verification, and a live route before release.',
      'Open concerns, questions, or family updates block sharing unless a manager override is recorded.',
    ],
  };
}
