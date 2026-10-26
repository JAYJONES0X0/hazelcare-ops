import { persistSafely } from './persistence';
import type { AppState, Action, CareEntry, Incident, WeekSummary, StaffMember, Shift } from './types';

const STORAGE_KEY = 'hazelcare-ops';
const WEEK_DATA_KEY = 'hc-week-data-v2';
const CLIENTS_KEY = 'hc-clients-v2';
const STAFF_KEY = 'hc-staff-register-v1';
const STAFF_NOTES_KEY = 'hazelcare-staff-notes';
const SCHEMA_VERSION_KEY = 'hc-schema-v';
const CURRENT_SCHEMA = '3';
let sessionWeekData: WeekSummary | null = null;

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isStorageAdapter(value: unknown): value is StorageAdapter {
  const candidate = value as Partial<StorageAdapter> | null | undefined;
  return !!candidate &&
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function';
}

const memoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
})();

export function getStorage(): StorageAdapter {
  if (typeof window !== 'undefined' && isStorageAdapter(window.localStorage)) return window.localStorage;

  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  if (descriptor && 'value' in descriptor && descriptor.value) {
    if (isStorageAdapter(descriptor.value)) return descriptor.value;
  }

  return memoryStorage;
}

// Clear stale state if schema version changed (new deploy with breaking changes)
(function migrateSchema() {
  try {
    const storage = getStorage();
    if (storage.getItem(SCHEMA_VERSION_KEY) !== CURRENT_SCHEMA) {
      storage.removeItem(STORAGE_KEY);
      storage.removeItem('hc_current_page');
      storage.removeItem('hc-registered-sessions');
      storage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA);
    }
  } catch { /* ignore */ }
})();

function normalizeState(raw: Partial<AppState> | null | undefined): AppState {
  return {
    weekData: null,
    actions: Array.isArray(raw?.actions) ? raw.actions : [],
    incidents: Array.isArray(raw?.incidents) ? raw.incidents : [],
    staff: Array.isArray(raw?.staff) ? raw.staff : [],
    shifts: Array.isArray(raw?.shifts) ? raw.shifts : [],
  };
}

function load(): AppState {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw) as Partial<AppState>);
  } catch { /* empty */ }
  return normalizeState(null);
}

function save(state: Partial<AppState>) {
  const merged = normalizeState({ ...load(), ...state, weekData: null });
  persistSafely(getStorage(), STORAGE_KEY, JSON.stringify(merged));
}

export function loadWeekData(): WeekSummary | null {
  if (sessionWeekData) return sessionWeekData;
  const raw = getStorage().getItem(WEEK_DATA_KEY);
  if (!raw) return null;
  try { sessionWeekData = JSON.parse(raw) as WeekSummary; }
  catch { throw new Error('Saved weekly import could not be read. Preserve your browser data and restore a backup.'); }
  return sessionWeekData;
}

export function saveWeekData(data: WeekSummary | null) {
  if (data) persistSafely(getStorage(), WEEK_DATA_KEY, JSON.stringify(data));
  else getStorage().removeItem(WEEK_DATA_KEY);
  sessionWeekData = data;
}

function entryFingerprint(entry: CareEntry): string {
  return [
    entry.date || '',
    entry.time || '',
    entry.house || '',
    entry.type || '',
    entry.carer || '',
    entry.client || '',
    entry.entry || '',
  ].join('|').toLowerCase().trim();
}

function dedupeEntries(entries: CareEntry[]): CareEntry[] {
  const seen = new Set<string>();
  const out: CareEntry[] = [];
  for (const entry of entries) {
    const key = entryFingerprint(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function parseDDMMYYYY(s: string): number {
  if (!s) return 0;
  const parts = s.split(/[ /.-]/);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    if (parts[0].length === 4) { // YYYY-MM-DD
       const [yr, mo, dy] = parts.map(Number);
       return new Date(yr, mo - 1, dy).getTime();
    }
    const t = new Date(y, m - 1, d).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(s) || 0;
}

function compareDateAsc(a: string, b: string): number {
  const da = parseDDMMYYYY(a);
  const db = parseDDMMYYYY(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return a.localeCompare(b);
  return da - db;
}

export function mergeWeekSummaries(existing: WeekSummary | null, incoming: WeekSummary): WeekSummary {
  if (!existing) return incoming;

  const mergedHouses: WeekSummary['houses'] = {};
  const houseNames = new Set([...Object.keys(existing.houses), ...Object.keys(incoming.houses)]);
  for (const houseName of houseNames) {
    const left = existing.houses[houseName];
    const right = incoming.houses[houseName];
    if (!left && right) {
      mergedHouses[houseName] = right;
      continue;
    }
    if (left && !right) {
      mergedHouses[houseName] = left;
      continue;
    }
    if (!left || !right) continue;

    const entries = dedupeEntries([...left.entries, ...right.entries]);
    const incidents = entries.filter((e) => e.category === 'incident');
    const safeguarding = entries.filter((e) => e.category === 'safeguarding');
    const medication = entries.filter((e) => e.category === 'medication');
    const handovers = entries.filter((e) => e.category === 'handover');
    const dailySupport = entries.filter((e) => e.category === 'daily_support');
    const staffPerformance = entries.filter((e) => e.category === 'staff');
    const healthSafety = entries.filter((e) => e.category === 'health_safety');

    mergedHouses[houseName] = {
      ...left,
      ...right,
      entries,
      incidents,
      safeguarding,
      medication,
      handovers,
      dailySupport,
      staffPerformance,
      healthSafety,
      flags: {
        red: entries.filter((e) => e.severity === 'red').length,
        amber: entries.filter((e) => e.severity === 'amber').length,
        green: entries.filter((e) => e.severity === 'green').length,
      },
    };
  }

  const allEntries = dedupeEntries(Object.values(mergedHouses).flatMap((house) => house.entries));
  const sortedDates = allEntries.map((entry) => entry.date).filter(Boolean).sort(compareDateAsc);
  const entryTypes: Record<string, number> = {};
  const clients = new Set<string>();
  const carers = new Set<string>();
  const clientDiary: Record<string, CareEntry[]> = {};
  const red: CareEntry[] = [];
  const amber: CareEntry[] = [];
  const green: CareEntry[] = [];

  for (const entry of allEntries) {
    if (entry.type) entryTypes[entry.type] = (entryTypes[entry.type] || 0) + 1;
    if (entry.client) clients.add(entry.client);
    if (entry.carer) carers.add(entry.carer);
    if (entry.client) {
      if (!clientDiary[entry.client]) clientDiary[entry.client] = [];
      clientDiary[entry.client].push(entry);
    }
    if (entry.severity === 'red') red.push(entry);
    else if (entry.severity === 'amber') amber.push(entry);
    else if (entry.severity === 'green') green.push(entry);
  }

  return {
    dateFrom: sortedDates[0] || incoming.dateFrom || existing.dateFrom,
    dateTo: sortedDates[sortedDates.length - 1] || incoming.dateTo || existing.dateTo,
    totalEntries: allEntries.length,
    houses: mergedHouses,
    allFlags: { red, amber, green },
    entryTypes,
    clients: Array.from(clients),
    carers: Array.from(carers),
    clientDiary,
  };
}

export function loadActions(): Action[] {
  return load().actions;
}

export function saveActions(actions: Action[]) {
  save({ actions });
}

export function loadIncidents(): Incident[] {
  return load().incidents;
}

export function saveIncidents(incidents: Incident[]) {
  save({ incidents });
}

export function loadStaff(): StaffMember[] {
  try {
    const raw = getStorage().getItem(STAFF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStaff(staff: StaffMember[]) {
  persistSafely(getStorage(), STAFF_KEY, JSON.stringify(staff));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hc-staff-updated'));
}

export function loadShifts(): Shift[] {
  return load().shifts;
}

export function saveShifts(shifts: Shift[]) {
  save({ shifts });
}

export function clearWeekData() {
  sessionWeekData = null;
  try { getStorage().removeItem(WEEK_DATA_KEY); } catch { /* ignore */ }
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      delete parsed.weekData;
      getStorage().setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch { /* ignore */ }
}

export function clearActions() {
  save({ actions: [] });
}

export function clearIncidents() {
  save({ incidents: [] });
}

export function clearSelectedData(type: 'diary' | 'actions' | 'incidents') {
  if (type === 'diary') {
    sessionWeekData = null;
    save({ weekData: null });
  }
  else if (type === 'actions') save({ actions: [] });
  else if (type === 'incidents') save({ incidents: [] });
}

export function clearAllData() {
  sessionWeekData = null;
  const storage = getStorage();
  storage.removeItem(WEEK_DATA_KEY);
  storage.removeItem(STORAGE_KEY);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export interface OpsSnapshot {
  version: 1;
  exportedAt: string;
  source: 'hazelcare-ops';
  data: {
    appState: AppState;
    clients: unknown[];
    staffNotes: unknown[];
  };
}

export function exportOpsSnapshot(): OpsSnapshot {
  let clients: unknown[] = [];
  let staffNotes: unknown[] = [];
  try {
    const raw = getStorage().getItem(CLIENTS_KEY);
    clients = raw ? JSON.parse(raw) : [];
  } catch {
    clients = [];
  }
  try {
    const raw = getStorage().getItem(STAFF_NOTES_KEY);
    staffNotes = raw ? JSON.parse(raw) : [];
  } catch {
    staffNotes = [];
  }

  // Include the separately persisted weekly import in the backup.
  const appState = load();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'hazelcare-ops',
    data: {
      appState: { ...appState, weekData: loadWeekData() },
      clients,
      staffNotes,
    },
  };
}

export function importOpsSnapshot(snapshot: unknown): { ok: true } | { ok: false; error: string } {
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, error: 'Snapshot is not a valid object.' };
  }

  const s = snapshot as Partial<OpsSnapshot>;
  if (s.version !== 1 || s.source !== 'hazelcare-ops' || !s.data) {
    return { ok: false, error: 'Snapshot format is not recognised.' };
  }

  const data = s.data as Partial<OpsSnapshot['data']>;
  if (!data.appState || typeof data.appState !== 'object') {
    return { ok: false, error: 'Snapshot is missing app state.' };
  }

  const appState: AppState = {
    weekData: (data.appState as Partial<AppState>).weekData ?? null,
    actions: Array.isArray((data.appState as Partial<AppState>).actions) ? (data.appState as Partial<AppState>).actions as Action[] : [],
    incidents: Array.isArray((data.appState as Partial<AppState>).incidents) ? (data.appState as Partial<AppState>).incidents as Incident[] : [],
    staff: Array.isArray((data.appState as Partial<AppState>).staff) ? (data.appState as Partial<AppState>).staff as AppState['staff'] : [],
    shifts: Array.isArray((data.appState as Partial<AppState>).shifts) ? (data.appState as Partial<AppState>).shifts as Shift[] : [],
  };

  const storage = getStorage();
  const writes: [string, string | null][] = [
    [STORAGE_KEY, JSON.stringify({ ...appState, weekData: null })],
    [CLIENTS_KEY, JSON.stringify(Array.isArray(data.clients) ? data.clients : [])],
    [STAFF_NOTES_KEY, JSON.stringify(Array.isArray(data.staffNotes) ? data.staffNotes : [])],
    [WEEK_DATA_KEY, appState.weekData ? JSON.stringify(appState.weekData) : null],
  ];
  const previous = writes.map(([key]) => [key, storage.getItem(key)] as const);
  try {
    for (const [key, value] of writes) {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    }
  } catch {
    for (const [key, value] of previous) {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch { return { ok: false, error: 'Restore failed and rollback was incomplete. Keep the backup file and do not clear browser data.' }; }
    }
    return { ok: false, error: 'Restore failed. Existing saved data was restored. Free browser storage and retry.' };
  }
  sessionWeekData = appState.weekData;
  return { ok: true };
}
