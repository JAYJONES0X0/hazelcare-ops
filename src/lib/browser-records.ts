// Large record payloads live in IndexedDB. Preferences remain in localStorage.
type Adapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const KEYS = new Set(['hazelcare-ops', 'hc-week-data-v2', 'hc-clients-v2', 'hc-staff-register-v1', 'hazelcare-staff-notes', 'hc-entry-store-v3']);
const cache = new Map<string, string>();
const durable = new Map<string, string>();
const pending = new Map<string, string | null>();
let database: IDBDatabase | null = null;
let running: Promise<void> | null = null;
let lastError: Error | null = null;
let reportedError: unknown = null;
let legacyStore: Adapter | null = null;
let ready = false;
let writerLockHeld = false;
function commit(values: Map<string, string | null>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ready && legacyStore) {
      for (const key of KEYS) {
        const old = legacyStore.getItem(key);
        if (old !== null && old !== durable.get(key)) throw new Error('An older OS tab changed saved records. Close older tabs and preserve both copies before retrying.');
      }
    }
    const tx = database!.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    for (const [key, value] of values) {
      if (value === null) store.delete(key);
      else store.put(value, key);
    }
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(new Error('Record storage commit failed. Your last saved records are preserved.'));
  });
}
export async function initialiseBrowserRecords(legacy: Adapter): Promise<void> {
  if (!writerLockHeld && typeof navigator !== 'undefined' && navigator.locks) {
    await new Promise<void>((resolve, reject) => {
      void navigator.locks.request('ovsite-record-writer', { ifAvailable: true }, async lock => {
        if (!lock) { reject(new Error('Another OS tab is already editing records. Close it before continuing.')); return; }
        writerLockHeld = true;
        resolve();
        await new Promise<void>(() => { /* The browser releases this lock when the document closes. */ });
      }).catch(reject);
    });
  }
  ready = false;
  legacyStore = legacy;
  database = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('ovsite-records', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('records');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('IndexedDB is unavailable. Existing browser data has not been cleared.'));
    req.onblocked = () => reject(new Error('Record storage is blocked by another tab. Close older OS tabs and retry.'));
  });
  const restored = await new Promise<Map<string, string>>((resolve, reject) => {
    const tx = database!.transaction('records', 'readonly');
    const store = tx.objectStore('records');
    const values = new Map<string, string>();
    for (const key of KEYS) {
      const req = store.get(key);
      req.onsuccess = () => { if (typeof req.result === 'string') values.set(key, req.result); };
    }
    tx.oncomplete = () => resolve(values);
    tx.onabort = tx.onerror = () => reject(new Error('Saved records could not be loaded. Browser data has not been cleared.'));
  });
  const migration = new Map<string, string | null>();
  for (const key of KEYS) {
    const old = legacy.getItem(key);
    if (restored.has(key) && old !== null && old !== restored.get(key)) throw new Error('Conflicting records from an older tab. Both copies have been preserved.');
    if (!restored.has(key) && old !== null) migration.set(key, old);
  }
  // Delete the legacy copy only after the entire migration transaction commits.
  if (migration.size) await commit(migration);
  for (const [key, value] of migration) if (value !== null) restored.set(key, value);
  cache.clear(); durable.clear();
  for (const [key, value] of restored) { cache.set(key, value); durable.set(key, value); }
  for (const [key, value] of restored) { try { if (legacy.getItem(key) === value) legacy.removeItem(key); } catch { /* Keep recoverable duplicate if removal is denied. */ } }
  ready = true;
  window.addEventListener('beforeunload', event => {
    if (running || pending.size) { event.preventDefault(); event.returnValue = ''; }
  });
}
export function flushRecordWrites(): Promise<void> {
  if (!database) return Promise.resolve();
  if (running) return running;
  if (!pending.size) return lastError ? Promise.reject(lastError) : Promise.resolve();
  running = (async () => {
    while (pending.size) {
      const batch = new Map(pending); pending.clear();
      try {
        await commit(batch);
        for (const [key, value] of batch) { if (value === null) durable.delete(key); else durable.set(key, value); }
      } catch (error) {
        for (const key of batch.keys()) {
          if (pending.has(key)) continue;
          const previous = durable.get(key);
          if (previous === undefined) cache.delete(key); else cache.set(key, previous);
        }
        lastError = error instanceof Error ? error : new Error('Record save failed');
        throw lastError;
      }
    }
  })().finally(() => { running = null; });
  return running;
}
function queue(key: string, value: string | null) {
  lastError = null;
  if (value === null) cache.delete(key); else cache.set(key, value);
  pending.set(key, value);
  queueMicrotask(() => {
    void flushRecordWrites().catch(error => {
      if (reportedError === error) return;
      reportedError = error;
      window.alert('Record save failed. Your last saved records are preserved. Keep this tab open, export a backup, and retry after checking available device storage.');
    });
  });
}
export function recordStorage(legacy: Adapter): Adapter {
  return {
    getItem: key => database && KEYS.has(key) ? cache.get(key) ?? null : legacy.getItem(key),
    setItem: (key, value) => { if (database && KEYS.has(key)) queue(key, value); else legacy.setItem(key, value); },
    removeItem: key => { if (database && KEYS.has(key)) queue(key, null); else legacy.removeItem(key); },
  };
}
