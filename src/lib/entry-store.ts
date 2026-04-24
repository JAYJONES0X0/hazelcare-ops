import type { CareEntry } from './types';

const STORE_KEY = 'hc-entry-store-v3'; // Bumping version for the new capacity
const MAX_ENTRIES = 100000; // Increased from 25,000 to 100,000

function fingerprint(e: CareEntry): string {
  return [e.date || '', e.time || '', e.house || '', e.carer || '', e.client || '', (e.entry || '').slice(0, 100)]
    .join('|').toLowerCase().trim();
}

function parseDateMs(s: string): number {
  if (!s) return 0;
  const parts = s.split(/[ /:-]/);
  if (parts.length >= 3) {
    if (parts[0].length === 4) return new Date(s).getTime();
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    return new Date(y, m, d).getTime();
  }
  return new Date(s).getTime() || 0;
}

export function getAllEntries(): CareEntry[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as CareEntry[];
    // Ensure always sorted newest first
    return entries.sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));
  } catch { return []; }
}

export function getEntriesForRange(from: string | null, to: string | null): CareEntry[] {
  const all = getAllEntries();
  if (!from && !to) return all;
  
  const fromMs = from ? parseDateMs(from) : 0;
  const toMs = to ? parseDateMs(to) : Infinity;

  return all.filter(e => {
    const entryMs = parseDateMs(e.date);
    return entryMs >= fromMs && entryMs <= (toMs + 86400000); // Include full end day
  });
}

export function appendEntries(incoming: CareEntry[]): number {
  if (!incoming.length) return 0;
  const existing = getAllEntries();
  const seen = new Set(existing.map(fingerprint));
  
  const toAdd = incoming.filter(e => !seen.has(fingerprint(e)));
  if (!toAdd.length) return 0;

  // Merge, sort newest first, and cap at 100k
  const merged = [...existing, ...toAdd]
    .sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date))
    .slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(merged));
    return toAdd.length;
  } catch (e) {
    console.error('Storage full, could not append entries', e);
    return 0;
  }
}

export function getStoreBounds(): { from: string; to: string; count: number } | null {
  const all = getAllEntries();
  if (!all.length) return null;
  // All is already sorted newest first, so [0] is newest, [last] is oldest
  return { 
    from: all[all.length - 1].date, 
    to: all[0].date, 
    count: all.length 
  };
}

export function clearEntryStore(): void {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}
