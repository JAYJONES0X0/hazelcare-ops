import type { CareEntry } from './types';

// ─── IndexedDB Engine (no 5MB cap like localStorage) ─────────────────────────
const DB_NAME = 'hazel-care-ops';
const DB_VERSION = 2;
const STORE_NAME = 'entries';

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('client', 'client', { unique: false });
        store.createIndex('house', 'house', { unique: false });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

export function parseDateMs(s: string): number {
  if (!s) return 0;
  const parts = s.split(/[ /:-]/);
  if (parts.length >= 3) {
    if (parts[0].length === 4) return new Date(s).getTime();
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    if (d > 0 && m >= 0 && y > 2000) return new Date(y, m, d).getTime();
  }
  const ts = new Date(s).getTime();
  return isNaN(ts) ? 0 : ts;
}

function fingerprint(e: CareEntry): string {
  return [e.date || '', e.house || '', e.client || '', e.carer || '', (e.entry || '').slice(0, 80)]
    .join('|').toLowerCase().trim();
}

// ─── ASYNC API ─────────────────────────────────────────────────────────────────

export async function getAllEntriesAsync(): Promise<CareEntry[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const all = (req.result as CareEntry[]).sort(
          (a, b) => parseDateMs(b.date) - parseDateMs(a.date)
        );
        resolve(all);
      };
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

export async function getEntriesForRangeAsync(from: string | null, to: string | null): Promise<CareEntry[]> {
  const all = await getAllEntriesAsync();
  if (!from && !to) return all;
  const fromMs = from ? parseDateMs(from) : 0;
  const toMs   = to   ? parseDateMs(to) + 86400000 : Infinity;
  return all.filter(e => {
    const ms = parseDateMs(e.date);
    return ms >= fromMs && ms <= toMs;
  });
}

export async function appendEntriesAsync(incoming: CareEntry[]): Promise<number> {
  if (!incoming.length) return 0;
  try {
    const db = await openDB();
    const existing = await getAllEntriesAsync();
    const seen = new Set(existing.map(fingerprint));
    const toAdd = incoming.filter(e => !seen.has(fingerprint(e)));
    if (!toAdd.length) return 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let added = 0;
      for (const e of toAdd) {
        store.put(e);
        added++;
      }
      tx.oncomplete = () => resolve(added);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[EntryStore] appendEntriesAsync failed:', err);
    return 0;
  }
}

export async function getStoreBoundsAsync(): Promise<{ from: string; to: string; count: number } | null> {
  const all = await getAllEntriesAsync();
  if (!all.length) return null;
  return { from: all[all.length - 1].date, to: all[0].date, count: all.length };
}

export async function clearEntryStoreAsync(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* ignore */ }
}

export async function getDistinctClientsAsync(): Promise<string[]> {
  const all = await getAllEntriesAsync();
  return [...new Set(all.map(e => e.client).filter(Boolean))].sort();
}

export async function getDistinctHousesAsync(): Promise<string[]> {
  const all = await getAllEntriesAsync();
  return [...new Set(all.map(e => e.house).filter(h => h && h !== 'UNASSIGNED'))].sort();
}

// ─── SYNC SHIMS (for pages not yet migrated, reads localStorage fallback) ─────
// These let the rest of the app keep working while we migrate gradually.

const LS_KEY = 'hc-entry-store-v3';

export function getAllEntries(): CareEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as CareEntry[]).sort(
      (a, b) => parseDateMs(b.date) - parseDateMs(a.date)
    );
  } catch { return []; }
}

export function getEntriesForRange(from: string | null, to: string | null): CareEntry[] {
  const all = getAllEntries();
  if (!from && !to) return all;
  const fromMs = from ? parseDateMs(from) : 0;
  const toMs   = to   ? parseDateMs(to) + 86400000 : Infinity;
  return all.filter(e => {
    const ms = parseDateMs(e.date);
    return ms >= fromMs && ms <= toMs;
  });
}

export function appendEntries(incoming: CareEntry[]): number {
  // Fire-and-forget to IndexedDB
  void appendEntriesAsync(incoming);
  // Also write to LS for sync shim (capped at 5k newest)
  if (!incoming.length) return 0;
  try {
    const existing = getAllEntries();
    const seen = new Set(existing.map(fingerprint));
    const toAdd = incoming.filter(e => !seen.has(fingerprint(e)));
    if (!toAdd.length) return 0;
    const merged = [...existing, ...toAdd]
      .sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date))
      .slice(0, 5000); // LS only holds 5k; IDB holds the full set
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
    return toAdd.length;
  } catch { return 0; }
}

export function getStoreBounds(): { from: string; to: string; count: number } | null {
  const all = getAllEntries();
  if (!all.length) return null;
  return { from: all[all.length - 1].date, to: all[0].date, count: all.length };
}

export function clearEntryStore(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  void clearEntryStoreAsync();
}
/**
 * Deletes entries matching specific criteria for granular governance.
 */
export async function deleteEntriesByFilterAsync(filter: { house?: string; beforeDate?: string; afterDate?: string }) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const entries = await getAllEntriesAsync();
  
  let deletedCount = 0;
  for (const e of entries) {
    let match = true;
    if (filter.house && e.house !== filter.house) match = false;
    
    if (match && (filter.beforeDate || filter.afterDate)) {
      const ms = parseDateMs(e.date);
      if (ms) {
        if (filter.beforeDate) {
          const bMs = parseDateMs(filter.beforeDate);
          if (bMs && ms >= bMs) match = false;
        }
        if (filter.afterDate) {
          const aMs = parseDateMs(filter.afterDate);
          if (aMs && ms <= aMs) match = false;
        }
      }
    }

    if (match) {
      store.delete(e.id); // Standard IDBStore delete
      deletedCount++;
    }
  }
  return deletedCount;
}

/**
 * Calculates storage volume per unit for the Governance heatmap.
 */
export async function getStorageAuditAsync() {
  const all = await getAllEntriesAsync();
  const stats: Record<string, { count: number; size: number }> = {};
  
  for (const e of all) {
    const h = e.house || 'UNASSIGNED';
    if (!stats[h]) stats[h] = { count: 0, size: 0 };
    stats[h].count++;
    stats[h].size += JSON.stringify(e).length; // Approximate byte size
  }
  
  return stats;
}
