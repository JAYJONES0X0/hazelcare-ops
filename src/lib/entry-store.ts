import type { CareEntry } from './types';

const STORE_KEY = 'hc-entry-store-v2';
const MAX_ENTRIES = 25000;

function fingerprint(e: CareEntry): string {
  return [e.date || '', e.time || '', e.house || '', e.carer || '', e.client || '', (e.entry || '').slice(0, 80)]
    .join('|').toLowerCase().trim();
}

export function getAllEntries(): CareEntry[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

function isValidEntry(e: CareEntry): boolean {
  // Must have a recognisable DD/MM/YYYY date and non-trivial entry text
  return DATE_RE.test((e.date || '').trim()) && (e.entry || '').trim().length >= 10;
}

export function appendEntries(incoming: CareEntry[]): number {
  if (!incoming.length) return 0;
  const valid = incoming.filter(isValidEntry);
  if (!valid.length) return 0;
  const existing = getAllEntries();
  const seen = new Set(existing.map(fingerprint));
  const toAdd = valid.filter(e => !seen.has(fingerprint(e)));
  if (!toAdd.length) return 0;

  const merged = [...existing, ...toAdd];
  const trimmed = merged.length > MAX_ENTRIES
    ? merged.sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date)).slice(merged.length - MAX_ENTRIES)
    : merged;

  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded — keep most recent 5k
    const slim = trimmed.slice(trimmed.length - 5000);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(slim)); } catch { /* give up */ }
  }
  return toAdd.length;
}

export function parseDateMs(s: string): number {
  if (!s) return 0;
  const parts = s.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    const t = new Date(y, m - 1, d).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

export function getEntriesForRange(from: string | null, to: string | null): CareEntry[] {
  const all = getAllEntries();
  if (!from && !to) return all;
  const fromMs = from ? parseDateMs(from) : 0;
  const toMs = to ? parseDateMs(to) + 86_400_000 : Infinity; // include end date
  return all.filter(e => {
    const ms = parseDateMs(e.date);
    return ms > 0 && ms >= fromMs && ms <= toMs;
  });
}

export function getStoreBounds(): { from: string; to: string; count: number } | null {
  const all = getAllEntries();
  if (!all.length) return null;
  const sorted = [...all].sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));
  return { from: sorted[0].date, to: sorted[sorted.length - 1].date, count: all.length };
}

export function clearEntryStore(): void {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}
