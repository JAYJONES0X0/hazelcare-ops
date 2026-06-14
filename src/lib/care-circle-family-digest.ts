import type { CareCircleMode, CareCircleUpdate, FullClient } from './client-store';
import type { CareEntry } from './types';
import { careCircleModeLabel } from './care-circle-status';

const SENSITIVE_PATTERN = /\b(?:safeguard|safeguarding|abuse|alleg|police|financial|finance|money|medication error|self-harm|suicide|assault|violence|injur|capacity|deprivation|domestic|exploitation|complaint|cqc|section|restraint|missing|abscond|neglect)\b/i;

function todayUk() {
  return new Date().toLocaleDateString('en-GB');
}

function firstName(client: FullClient) {
  return client.preferredName || client.name.split(' ')[0] || 'this person';
}

function cleanLine(input: string | undefined, max = 180) {
  const text = (input || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text;
}

function listOrFallback(items: string[], fallback: string) {
  return items.length ? items.join(', ') : fallback;
}

export function isCareCircleFamilySensitiveEntry(entry: CareEntry) {
  const text = `${entry.type} ${entry.entry} ${(entry.flags || []).join(' ')} ${entry.category || ''}`;
  return SENSITIVE_PATTERN.test(text) || entry.severity === 'red' || entry.category === 'safeguarding';
}

export function careCircleEntrySourceRef(entry: CareEntry) {
  const bits = [entry.date, entry.time, entry.house, entry.type].filter(Boolean).join(' / ');
  return `${bits || 'Care entry'}: ${cleanLine(entry.entry, 170)}`;
}

export function careCircleClientEvidenceRefs(client: FullClient) {
  const refs: string[] = [];
  const domains = client.carePlan?.domains?.filter((domain) => domain.enabled) || [];
  for (const domain of domains.slice(0, 8)) {
    const detail = cleanLine(domain.identifiedNeed || domain.howToAchieve || domain.plannedOutcomes || domain.reviewNote, 170);
    refs.push(`Care plan / ${domain.title}: ${detail || 'Domain enabled for support planning.'}`);
  }
  if (client.supportPlan?.needs?.length) {
    for (const need of client.supportPlan.needs.slice(0, 6)) {
      refs.push(`Support plan / ${need.area}: ${cleanLine(need.canDoMyself || need.howToSupport || need.risks, 170)}`);
    }
  }
  if (client.clinicalBriefing) refs.push(`Clinical briefing: ${cleanLine(client.clinicalBriefing, 190)}`);
  if (client.vaultDocs?.length) {
    for (const doc of client.vaultDocs.slice(0, 4)) refs.push(`Evidence vault / ${doc.name}: ${cleanLine(doc.text, 170)}`);
  }
  return refs.filter(Boolean);
}

function inferMood(entries: CareEntry[]) {
  const text = entries.map((entry) => entry.entry).join(' ').toLowerCase();
  if (/happy|chatty|laugh|good spirits|settled|calm|relaxed|bright|smil/.test(text)) return 'Settled, engaged, or in good spirits at points during the period.';
  if (/anxious|low mood|upset|distress|agitated|withdrawn/.test(text)) return 'Some changes in mood or presentation were noted and should be reviewed before sharing.';
  return 'No clear mood pattern was identified from the selected evidence.';
}

function supportCovered(entries: CareEntry[]) {
  const types = Array.from(new Set(entries.map((entry) => cleanLine(entry.type, 60)).filter(Boolean))).slice(0, 5);
  return listOrFallback(types, 'General support, wellbeing checks, and daily living support where evidenced.');
}

function timeWindow(entries: CareEntry[]) {
  const timed = entries.filter((entry) => entry.date || entry.time);
  if (!timed.length) return 'Not recorded';
  const first = timed[timed.length - 1];
  const last = timed[0];
  if (first.id === last.id) return [first.date, first.time].filter(Boolean).join(' ') || 'Not recorded';
  if (first.date && first.date === last.date && first.time && last.time) return `${first.time} to ${last.time}`;
  return `${[first.date, first.time].filter(Boolean).join(' ')} to ${[last.date, last.time].filter(Boolean).join(' ')}`;
}

function safeMeaningfulNotes(entries: CareEntry[]) {
  return entries
    .map((entry) => cleanLine(entry.entry, 150))
    .filter(Boolean)
    .slice(0, 3);
}

export function buildCareCircleFamilyDigest(client: FullClient, entries: CareEntry[], mode: CareCircleMode) {
  const name = firstName(client);
  const safeEntries = entries.filter((entry) => !isCareCircleFamilySensitiveEntry(entry)).slice(0, 8);
  const sensitiveCount = entries.length - safeEntries.length;
  const evidenceBase = safeEntries.length ? safeEntries : entries.filter((entry) => entry.severity !== 'red').slice(0, 3);
  const careDomains = client.carePlan?.domains?.filter((domain) => domain.enabled).slice(0, 4).map((domain) => domain.title) || [];
  const notes = safeMeaningfulNotes(evidenceBase);

  return [
    `Family update for ${name} - ${todayUk()}`,
    '',
    `Mode: ${careCircleModeLabel(mode)}. This is a manager-reviewed summary, not a raw care record.`,
    '',
    `Visit window: ${timeWindow(entries)}`,
    `Mood / presentation: ${inferMood(evidenceBase.length ? evidenceBase : entries)}`,
    `Support completed: ${supportCovered(evidenceBase.length ? evidenceBase : entries)}`,
    careDomains.length ? `Care areas in view: ${careDomains.join(', ')}.` : '',
    notes.length ? `Notes family can see: ${notes.join(' ')}` : `Notes family can see: No share-ready diary evidence is available yet for ${name}.`,
    sensitiveCount > 0 ? `Held for manager review: ${sensitiveCount} source entr${sensitiveCount === 1 ? 'y was' : 'ies were'} not included because they may contain risk, safeguarding, medication, finance, complaint, or other sensitive detail.` : 'Held for manager review: No high-sensitivity source entries were detected in this draft.',
    '',
    'Before sharing: confirm consent, relationship permissions, restrictions, and whether any detail should be removed.',
  ].filter(Boolean).join('\n');
}

export function careCircleDigestShareability(entries: CareEntry[], mode: CareCircleMode): CareCircleUpdate['shareability'] {
  if (mode === 'off') return 'red';
  const sensitive = entries.filter(isCareCircleFamilySensitiveEntry).length;
  if (sensitive >= 2) return 'red';
  if (sensitive === 1 || mode === 'professional_access') return 'amber';
  return 'green';
}
