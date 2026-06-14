import type { CareCircleUpdate } from './client-store';

type CareCircleInternalDraftInput = {
  clientName: string;
  draft: string;
  sourceCount: number;
  shareability: CareCircleUpdate['shareability'];
};

function safeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildCareCircleInternalDraftText({
  clientName,
  draft,
  sourceCount,
  shareability,
}: CareCircleInternalDraftInput) {
  const body = safeText(draft) || 'No draft text recorded.';
  return [
    'INTERNAL CARE CIRCLE REVIEW DRAFT - DO NOT SHARE EXTERNALLY',
    `Person: ${safeText(clientName) || 'Unknown person'}`,
    'Status: Not reviewed / not released',
    `Shareability signal: ${shareability}`,
    `Source entries scanned: ${Math.max(0, sourceCount)}`,
    '',
    'Draft',
    body,
    '',
    'This draft is for manager review inside Care Ops. Use the reviewed update or share pack controls for external circulation.',
  ].join('\n');
}
