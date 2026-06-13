import type { CareCircleMode, FullClient } from './client-store';

const PERMISSION_LEVELS = new Set(['reassurance', 'care_plan', 'risk_aware', 'professional']);

function safeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseCareCircleReviewDate(value: string) {
  if (!value) return 0;
  const parts = value.split(/[/-]/).map(part => part.trim());
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (d && m && y) return new Date(y < 100 ? y + 2000 : y, m - 1, d).getTime();
  }
  return Date.parse(value) || 0;
}

export function isCareCircleContactExpired(reviewDate: string) {
  const parsed = parseCareCircleReviewDate(reviewDate);
  return !!parsed && parsed < Date.now() - 24 * 60 * 60 * 1000;
}

export function careCircleModeLabel(mode?: CareCircleMode | string) {
  return safeText(mode).replaceAll('_', ' ') || 'off';
}

export function getCareCircleStatus(client: FullClient) {
  const circle = client.careCircle;
  const contacts = Array.isArray(circle?.contacts) ? circle.contacts : [];
  const updates = Array.isArray(circle?.updates) ? circle.updates : [];
  const concerns = Array.isArray(circle?.concerns) ? circle.concerns : [];
  const activity = Array.isArray(circle?.activity) ? circle.activity : [];
  const active = !!circle && circle.mode !== 'off';
  const reviewedUpdate = updates.some(update => update.status === 'reviewed' || update.status === 'shared');
  const inScopeContacts = contacts.filter(contact => PERMISSION_LEVELS.has(contact.permissionLevel));
  const verifiedContacts = inScopeContacts.filter(contact => {
    const email = safeText(contact.email);
    const phone = safeText(contact.phone);
    return contact.verified && (email || phone) && !isCareCircleContactExpired(safeText(contact.reviewDate));
  });
  const openConcerns = concerns.filter(concern => concern.status !== 'resolved');
  const expiredContacts = contacts.filter(contact => isCareCircleContactExpired(safeText(contact.reviewDate)));
  const unverifiedContacts = contacts.filter(contact => !contact.verified);
  const routeMissing = contacts.filter(contact => !safeText(contact.email) && !safeText(contact.phone));
  const recentShare = activity.find(item => item.type === 'share_pack_copied' || item.type === 'share_pack_printed' || item.type === 'update_copied');
  const issues = [
    active ? '' : 'Mode off',
    active && !reviewedUpdate ? 'No reviewed update' : '',
    active && contacts.length === 0 ? 'No contacts' : '',
    active && contacts.length > 0 && verifiedContacts.length === 0 ? 'No verified route' : '',
    unverifiedContacts.length ? `${unverifiedContacts.length} unverified` : '',
    expiredContacts.length ? `${expiredContacts.length} expired review` : '',
    routeMissing.length ? `${routeMissing.length} no route` : '',
    openConcerns.length ? `${openConcerns.length} open item${openConcerns.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  const ready = active && reviewedUpdate && verifiedContacts.length > 0 && expiredContacts.length === 0 && routeMissing.length === 0 && unverifiedContacts.length === 0 && openConcerns.length === 0;
  return { active, reviewedUpdate, contacts, verifiedContacts, openConcerns, expiredContacts, unverifiedContacts, routeMissing, recentShare, issues, ready };
}
