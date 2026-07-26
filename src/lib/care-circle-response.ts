import type { CareCircleConcern } from './client-store';

export type CareCircleResponseTone = 'green' | 'amber' | 'muted';

function clean(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function label(value: unknown, fallback: string) {
  return clean(value).replaceAll('_', ' ') || fallback;
}

export function getCareCircleResponseStatus(concern: Partial<CareCircleConcern>) {
  const hasResponse = Boolean(clean(concern.response));
  if (concern.status === 'resolved') {
    return {
      label: 'Closed',
      tone: 'muted' as CareCircleResponseTone,
      canCopy: hasResponse,
      canResolve: hasResponse,
    };
  }
  if (hasResponse) {
    return {
      label: 'Response drafted',
      tone: 'green' as CareCircleResponseTone,
      canCopy: true,
      canResolve: true,
    };
  }
  return {
    label: 'Needs response',
    tone: 'amber' as CareCircleResponseTone,
    canCopy: false,
    canResolve: false,
  };
}

export function buildCareCircleFamilyResponseText(clientName: string, concern: Partial<CareCircleConcern>) {
  const response = clean(concern.response);
  const raisedBy = clean(concern.source) || 'family / representative';
  return [
    `Response for ${clean(clientName) || 'this person'}`,
    `Raised by: ${raisedBy}`,
    `Item type: ${label(concern.type, 'family item')}`,
    `Response status: ${getCareCircleResponseStatus(concern).label}`,
    '',
    response || 'No response has been recorded yet.',
    '',
    'This response is a manager-reviewed family communication. Internal care records and evidence remain in OVSITE.',
  ].join('\n');
}
