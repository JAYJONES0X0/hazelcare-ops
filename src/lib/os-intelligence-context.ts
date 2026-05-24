import type { CareEntry } from './types';
import type { FullClient, VaultDoc } from './client-store';
import type { RosterShift } from './roster-store';

type RosterLike = Partial<RosterShift> & {
  staffId?: string;
  hours?: number;
};

interface OsContextInput {
  clientName: string;
  entry?: CareEntry | null;
  entries?: CareEntry[];
  clientProfile?: FullClient | null;
  rosterShifts?: RosterLike[];
  refineInstructions?: string;
  maxChars?: number;
}

function norm(value: string | undefined | null): string {
  return (value || '').toLowerCase().trim();
}

function sameClient(a: string | undefined, b: string | undefined): boolean {
  const left = norm(a);
  const right = norm(b);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function toIso(date: string | undefined): string {
  if (!date) return '';
  const p = date.split('/');
  return p.length === 3 ? `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}` : date;
}

function excerpt(text: string | undefined, max = 420): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function rosterCarers(shift: RosterLike): string[] {
  const names = Array.isArray(shift.carers) ? shift.carers : [];
  if (shift.staffId) names.push(shift.staffId);
  return [...new Set(names.filter(Boolean))];
}

function formatRosterShift(shift: RosterLike): string {
  const carers = rosterCarers(shift).join(' / ') || 'staff not named';
  const time = [shift.startTime, shift.endTime].filter(Boolean).join('-') || 'time not stated';
  const hours = shift.durationHours ?? shift.hours;
  return `${shift.date || 'date not stated'} ${time}: ${carers}${hours ? ` (${hours}h)` : ''}`;
}

function buildProfileContext(profile: FullClient): string[] {
  const parts: string[] = [];
  if (profile.diagnoses?.length) parts.push(`Diagnoses: ${profile.diagnoses.join(', ')}`);
  if (profile.carePlan?.criticalInfo) parts.push(`Critical information: ${excerpt(profile.carePlan.criticalInfo, 900)}`);
  if (profile.carePlan?.biography) parts.push(`Biography: ${excerpt(profile.carePlan.biography, 900)}`);
  const domains = profile.carePlan?.domains?.filter(domain => domain.enabled && (domain.howToAchieve || domain.identifiedNeed)).slice(0, 8) || [];
  if (domains.length) {
    parts.push(`Care-plan strategies:\n${domains.map(domain => `- ${domain.title}: ${excerpt(domain.howToAchieve || domain.identifiedNeed, 520)}`).join('\n')}`);
  }
  const risks = profile.risk?.risks?.slice(0, 8) || [];
  if (risks.length) {
    parts.push(`Risk controls:\n${risks.map(risk => `- ${risk.title}: ${excerpt([...(risk.triggers || []), ...(risk.controls || [])].join('; '), 520)}`).join('\n')}`);
  }
  return parts;
}

function buildVaultContext(docs: VaultDoc[] | undefined, maxChars: number): string[] {
  if (!docs?.length) return [];
  const perDoc = Math.max(1000, Math.floor(maxChars / docs.length));
  return docs.slice(0, 8).map(doc => `[DOCUMENT: ${doc.name}]\n${excerpt(doc.text, perDoc)}`);
}

export function buildOsIntelligenceContextFromState(input: OsContextInput): string {
  const clientName = input.clientName || input.entry?.client || '';
  const entryDate = input.entry?.date || '';
  const allEntries = input.entries || [];
  const clientEntries = allEntries
    .filter(entry => sameClient(entry.client, clientName))
    .sort((a, b) => toIso(a.date).localeCompare(toIso(b.date)) || (a.time || '').localeCompare(b.time || ''));
  const sameDay = entryDate
    ? clientEntries.filter(entry => entry.date === entryDate && entry.id !== input.entry?.id)
    : [];
  const before = entryDate
    ? [...clientEntries].reverse().filter(entry => toIso(entry.date) < toIso(entryDate)).slice(0, 3).reverse()
    : clientEntries.slice(-3);
  const after = entryDate
    ? clientEntries.filter(entry => toIso(entry.date) > toIso(entryDate)).slice(0, 3)
    : [];
  const roster = (input.rosterShifts || [])
    .filter(shift => (!entryDate || shift.date === entryDate) && sameClient(shift.client || shift.clientRaw || shift.house, clientName))
    .slice(0, 12);

  const sections: string[] = [];
  sections.push([
    '[OS INTELLIGENCE CONTRACT]',
    'Use the raw note as the primary evidence for what happened in this exact shift.',
    'Use OS context for client identity, care-plan strategies, rostered staff, surrounding continuity, and source conflict checks.',
    'If raw note and OS context conflict, do not silently fix it. Flag the conflict in professional wording or follow the stronger source only when explicitly evidenced.',
    'Do not invent medication administration, meals eaten, community access, incidents, refusals, or personal care that is not evidenced.',
  ].join('\n'));

  sections.push([
    '[ACTIVE RECORD]',
    `Client: ${clientName || 'not selected'}`,
    `Date: ${entryDate || 'not supplied'}`,
    input.entry?.time ? `Time: ${input.entry.time}` : '',
    input.entry?.carer ? `Recorded staff: ${input.entry.carer}` : '',
    input.entry?.type ? `Entry type: ${input.entry.type}` : '',
  ].filter(Boolean).join('\n'));

  if (roster.length) {
    sections.push(`[ROSTER / 1:1 COVERAGE EVIDENCE]\n${roster.map(formatRosterShift).join('\n')}`);
  }

  if (sameDay.length) {
    sections.push(`[SAME-DAY DIARY EVIDENCE]\n${sameDay.slice(0, 8).map(entry => `- ${entry.time || 'no time'} · ${entry.carer}: ${excerpt(entry.entry, 360)}`).join('\n')}`);
  }

  if (before.length || after.length) {
    const continuity = [
      ...before.map(entry => `Before ${entry.date} ${entry.time || ''}: ${excerpt(entry.entry, 320)}`),
      ...after.map(entry => `After ${entry.date} ${entry.time || ''}: ${excerpt(entry.entry, 320)}`),
    ];
    sections.push(`[CONTINUITY EVIDENCE]\n${continuity.join('\n')}`);
  }

  if (input.clientProfile) {
    const profile = buildProfileContext(input.clientProfile);
    if (profile.length) sections.push(`[CLIENT PROFILE / CARE PLAN]\n${profile.join('\n\n')}`);
    const vault = buildVaultContext(input.clientProfile.vaultDocs, Math.floor((input.maxChars || 70_000) * 0.45));
    if (vault.length) sections.push(`[INTELLIGENCE VAULT DOCUMENTS]\n${vault.join('\n\n')}`);
  }

  if (input.refineInstructions?.trim()) {
    sections.push(`[USER REFINEMENT INSTRUCTION]\n${input.refineInstructions.trim()}`);
  }

  const context = sections.join('\n\n');
  const max = input.maxChars || 70_000;
  return context.length > max ? `${context.slice(0, max)}\n[...OS context truncated...]` : context;
}
