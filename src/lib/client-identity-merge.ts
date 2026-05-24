import type { FullClient } from './client-store';

const ORG_NAME_PATTERNS = [
  /^hazel\s*care/i,
  /^hazelcare/i,
  /^clinical risk assessment$/i,
  /^positive behaviour support plan$/i,
  /^my support plan$/i,
  /^risk assessment$/i,
  /^support plan$/i,
];

const ORG_TOKENS = new Set(['hazel', 'care', 'ltd', 'operations', 'support', 'clinical']);
const PLACEHOLDER_TOKENS = new Set([
  '-',
  '--',
  '—',
  'n/a',
  'na',
  'none',
  'unknown',
  'not known',
  'not provided',
  'nil',
]);

function clean(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.split('\u0000').join('').replace(/\s+/g, ' ').trim();
}

function isPlaceholderValue(input: string): boolean {
  const normalized = clean(input).toLowerCase();
  if (!normalized) return true;
  if (PLACEHOLDER_TOKENS.has(normalized)) return true;
  if (/^[-–—\s]+$/.test(normalized)) return true;
  return false;
}

function isOrgLikeName(name: string): boolean {
  const normalized = clean(name);
  if (!normalized) return true;
  return ORG_NAME_PATTERNS.some((re) => re.test(normalized));
}

function pickText(existing: string, incoming: unknown): string {
  const next = clean(incoming);
  if (!next || isPlaceholderValue(next)) return existing;
  return next;
}

function pickName(existing: string, incoming: unknown): string {
  const next = clean(incoming);
  if (!next || isPlaceholderValue(next)) return existing;
  if (isOrgLikeName(next)) return existing;
  return next;
}

function pickPreferredName(existing: string, incoming: unknown, acceptedNameIncoming: boolean): string {
  const next = clean(incoming);
  if (!next || isPlaceholderValue(next)) return existing;
  if (!acceptedNameIncoming && existing) return existing;
  if (ORG_TOKENS.has(next.toLowerCase())) return existing;
  return next;
}

function pickDate(existing: string, incoming: unknown): string {
  const next = clean(incoming);
  if (!next) return existing;
  if (!/\b\d{2}\/\d{2}\/\d{4}\b/.test(next)) return existing;
  return next.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0] || existing;
}

function pickNhs(existing: string, incoming: unknown): string {
  const next = clean(incoming);
  if (!next) return existing;
  if (next.includes('@')) return existing;
  const digits = next.replace(/\D/g, '');
  if (digits.length < 6) return existing;
  return next;
}

function pickPhone(existing: string, incoming: unknown): string {
  const next = clean(incoming);
  if (!next || isPlaceholderValue(next)) return existing;
  if (next.includes('@')) return existing;
  if (!/^[+()\d\s-]+$/.test(next)) return existing;
  const digits = next.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return existing;
  if (!/^0/.test(digits) && !/^44/.test(digits) && !/^\+44/.test(next)) return existing;
  return next;
}

export function mergeClientIdentity(base: FullClient, incoming: Partial<FullClient> | undefined | null): FullClient {
  if (!incoming) return { ...base };

  const merged: FullClient = { ...base };

  const incomingName = clean(incoming.name);
  const acceptedIncomingName = !!incomingName && !isOrgLikeName(incomingName);
  merged.name = pickName(base.name, incoming.name);
  merged.preferredName = pickPreferredName(base.preferredName, incoming.preferredName, acceptedIncomingName);
  merged.dob = pickDate(base.dob, incoming.dob);
  merged.nhs = pickNhs(base.nhs, incoming.nhs);
  merged.address = pickText(base.address, incoming.address);
  merged.phone = pickPhone(base.phone, incoming.phone);
  merged.keyWorker = pickText(base.keyWorker, incoming.keyWorker);
  merged.dateOfAdmission = pickDate(base.dateOfAdmission, incoming.dateOfAdmission);

  if (!merged.preferredName && merged.name) {
    merged.preferredName = merged.name.split(/\s+/)[0] || '';
  }

  return merged;
}
