import type { FullClient } from './client-store';
import type { CareEntry, WeekSummary } from './types';

function normaliseName(value: string | undefined) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function entryKey(entry: CareEntry) {
  return entry.id || [entry.date, entry.time, entry.house, entry.client, entry.carer, entry.entry].join('|');
}

export function careCircleClientNameKeys(client: Pick<FullClient, 'name' | 'preferredName'>) {
  return [client.name, client.preferredName]
    .map(normaliseName)
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

export function careCircleEntryMatchesClient(entry: CareEntry, client: Pick<FullClient, 'name' | 'preferredName'>) {
  const entryClient = normaliseName(entry.client);
  if (!entryClient) return false;
  return careCircleClientNameKeys(client).some((key) => entryClient === key || entryClient.includes(key) || key.includes(entryClient));
}

export function filterCareCircleEntriesForClient(client: Pick<FullClient, 'name' | 'preferredName'>, entries: CareEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (!careCircleEntryMatchesClient(entry, client)) return false;
    const key = entryKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getCareCircleEntriesFromWeek(client: Pick<FullClient, 'name' | 'preferredName'>, week: WeekSummary | null | undefined) {
  const diary = week?.clientDiary || {};
  const keys = careCircleClientNameKeys(client);
  const direct = Object.entries(diary).find(([name]) => keys.includes(normaliseName(name)))?.[1] || [];
  if (direct.length) return filterCareCircleEntriesForClient(client, direct);
  return filterCareCircleEntriesForClient(client, Object.values(diary).flat());
}

export function mergeCareCircleEvidenceEntries(
  client: Pick<FullClient, 'name' | 'preferredName'>,
  week: WeekSummary | null | undefined,
  storedEntries: CareEntry[]
) {
  return filterCareCircleEntriesForClient(client, [
    ...getCareCircleEntriesFromWeek(client, week),
    ...storedEntries,
  ]);
}
