import type {
  CareCircleContact,
  CareCircleData,
  CareCirclePermissionLevel,
  CareCircleUpdate,
  FullClient,
} from './client-store';
import { careCircleModeLabel, isCareCircleContactExpired } from './care-circle-status';
import { escapeHtml } from './html-escape';

const PERMISSION_LABELS: Record<CareCirclePermissionLevel, string> = {
  reassurance: 'Reassurance',
  care_plan: 'Care Plan',
  risk_aware: 'Risk Aware',
  professional: 'Professional',
};

const PERMISSION_RANK: Record<CareCirclePermissionLevel, number> = {
  reassurance: 1,
  care_plan: 2,
  risk_aware: 3,
  professional: 4,
};

function safeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function todayUk() {
  return new Date().toLocaleDateString('en-GB');
}

export function careCirclePermissionLabel(level?: CareCirclePermissionLevel | string) {
  return (level && PERMISSION_LABELS[level as CareCirclePermissionLevel]) || 'Reassurance';
}

export function careCirclePermissionRank(level?: CareCirclePermissionLevel | string) {
  return (level && PERMISSION_RANK[level as CareCirclePermissionLevel]) || 0;
}

export function careCircleConcernTypeLabel(type?: string) {
  return safeText(type).replace('_', ' ') || 'concern';
}

export function careCircleContactHasRoute(contact: Partial<CareCircleContact>) {
  return Boolean(safeText(contact.email) || safeText(contact.phone));
}

export function careCircleContactAllowed(contact: Partial<CareCircleContact>, audience: CareCirclePermissionLevel) {
  return careCirclePermissionRank(contact.permissionLevel) >= careCirclePermissionRank(audience);
}

export function latestReviewedCareCircleUpdate(updates: CareCircleUpdate[] | undefined) {
  return (updates || []).find((update) => update.status === 'reviewed' || update.status === 'shared') || null;
}

export function getCareCircleShareReadiness(circle: Partial<CareCircleData>, audience: CareCirclePermissionLevel) {
  const contactsInScope = (circle.contacts || []).filter((contact) => careCircleContactAllowed(contact, audience));
  const latestUpdate = latestReviewedCareCircleUpdate(circle.updates);
  const openItems = (circle.concerns || []).filter((item) => item.status !== 'resolved');
  const issues = [
    circle.mode === 'off' ? 'Care Circle mode is Off.' : '',
    !latestUpdate ? 'No reviewed update has been saved yet.' : '',
    contactsInScope.length === 0 ? `No ${careCirclePermissionLabel(audience)} contacts are in scope.` : '',
    contactsInScope.some((contact) => !contact.verified) ? 'One or more contacts need verification.' : '',
    contactsInScope.some((contact) => !careCircleContactHasRoute(contact)) ? 'One or more contacts have no email or phone route.' : '',
    contactsInScope.some((contact) => isCareCircleContactExpired(safeText(contact.reviewDate))) ? 'One or more contacts have an expired review date.' : '',
    openItems.length ? `${openItems.length} open family item${openItems.length === 1 ? '' : 's'} need${openItems.length === 1 ? 's' : ''} resolution or manager sign-off.` : '',
  ].filter(Boolean);
  return { ready: issues.length === 0, issues, contactsInScope, latestUpdate, openItems };
}

export function canReleaseCareCircleSharePack(readiness: { ready: boolean }, managerOverride: boolean) {
  return readiness.ready || managerOverride;
}

function asParagraphs(input: string | undefined) {
  return escapeHtml(input || '').split(/\n{2,}/).map((part) => `<p>${part.replace(/\n/g, '<br/>')}</p>`).join('');
}

export function buildCareCircleSharePackText(client: FullClient, circle: Partial<CareCircleData>, audience: CareCirclePermissionLevel) {
  const update = latestReviewedCareCircleUpdate(circle.updates);
  const contacts = (circle.contacts || []).filter((contact) => careCircleContactAllowed(contact, audience));
  const openItems = (circle.concerns || []).filter((item) => item.status !== 'resolved').slice(0, 6);
  const lines = [
    `Care Circle Pack - ${client.name}`,
    `Audience: ${careCirclePermissionLabel(audience)}`,
    `Generated: ${todayUk()}`,
    `Mode: ${careCircleModeLabel(circle.mode)}`,
    '',
    'Reviewed Update',
    update?.summary || 'No reviewed update has been saved yet.',
    '',
    'Sharing Controls',
    `Approved contacts in scope: ${contacts.length}`,
    ...contacts.map((contact) => {
      const routeStatus = careCircleContactHasRoute(contact) ? '' : ', no route recorded';
      return `- ${safeText(contact.name) || 'Unnamed contact'} (${safeText(contact.relationship) || 'relationship not recorded'}): ${careCirclePermissionLabel(contact.permissionLevel)}${contact.verified ? ', verified' : ', not verified'}${isCareCircleContactExpired(safeText(contact.reviewDate)) ? ', review expired' : ''}${routeStatus}`;
    }),
    circle.notes ? `Boundaries: ${circle.notes}` : '',
    '',
    'Open Family Items',
    openItems.length ? openItems.map((item) => `- ${careCircleConcernTypeLabel(item.type)} / ${item.priority || 'medium'} / ${item.status || 'open'}: ${item.detail || 'No detail recorded.'}`).join('\n') : 'No open Care Circle items.',
  ].filter(Boolean);
  return lines.join('\n');
}

export function buildCareCircleSharePackHtml(client: FullClient, circle: Partial<CareCircleData>, audience: CareCirclePermissionLevel) {
  const update = latestReviewedCareCircleUpdate(circle.updates);
  const contacts = (circle.contacts || []).filter((contact) => careCircleContactAllowed(contact, audience));
  const openItems = (circle.concerns || []).filter((item) => item.status !== 'resolved').slice(0, 6);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Care Circle Pack - ${escapeHtml(client.name)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Inter, Arial, sans-serif; color: #163434; margin: 0; line-height: 1.45; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .14em; margin: 24px 0 8px; color: #5d0565; }
    .meta { color: #667; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
    .box { border: 1px solid #d7d0bf; border-radius: 12px; padding: 14px; margin-top: 10px; break-inside: avoid; }
    .pill { display: inline-block; border: 1px solid #d7d0bf; border-radius: 999px; padding: 4px 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; margin: 3px 4px 3px 0; }
    p, li { font-size: 12px; }
    .footer { margin-top: 28px; border-top: 1px solid #d7d0bf; padding-top: 10px; font-size: 10px; color: #667; }
  </style>
</head>
<body>
  <h1>Care Circle Pack</h1>
  <div class="meta">${escapeHtml(client.name)} / ${escapeHtml(careCirclePermissionLabel(audience))} / ${escapeHtml(todayUk())}</div>
  <div class="box">
    <span class="pill">Mode: ${escapeHtml(careCircleModeLabel(circle.mode))}</span>
    <span class="pill">Contacts in scope: ${contacts.length}</span>
    <span class="pill">Open items: ${openItems.length}</span>
  </div>
  <h2>Reviewed Update</h2>
  <div class="box">${update ? asParagraphs(update.summary) : '<p>No reviewed update has been saved yet.</p>'}</div>
  <h2>Sharing Controls</h2>
  <div class="box">
    <ul>
      ${contacts.length ? contacts.map((contact) => `<li><strong>${escapeHtml(safeText(contact.name) || 'Unnamed contact')}</strong> - ${escapeHtml(safeText(contact.relationship) || 'relationship not recorded')} / ${escapeHtml(careCirclePermissionLabel(contact.permissionLevel))} / ${contact.verified ? 'verified' : 'not verified'}${isCareCircleContactExpired(safeText(contact.reviewDate)) ? ' / review expired' : ''}${careCircleContactHasRoute(contact) ? '' : ' / no route recorded'}</li>`).join('') : '<li>No contacts are currently in scope for this permission level.</li>'}
    </ul>
    ${circle.notes ? `<p><strong>Boundaries:</strong> ${escapeHtml(circle.notes)}</p>` : ''}
  </div>
  <h2>Open Family Items</h2>
  <div class="box">
    <ul>
      ${openItems.length ? openItems.map((item) => `<li><strong>${escapeHtml(careCircleConcernTypeLabel(item.type))}</strong> / ${escapeHtml(item.priority || 'medium')} / ${escapeHtml(item.status || 'open')}: ${escapeHtml(item.detail || 'No detail recorded.')}</li>`).join('') : '<li>No open Care Circle items.</li>'}
    </ul>
  </div>
  <div class="footer">Manager reviewed pack. Internal evidence references remain in Care Ops and are not printed for family-facing circulation unless separately authorised.</div>
</body>
</html>`;
}
