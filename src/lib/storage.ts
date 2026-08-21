import type { AppState, Action, CareEntry, Incident, WeekSummary, StaffMember, Shift } from './types';

const STORAGE_KEY = 'ovsite-state-v1';
const WEEK_DATA_KEY = 'ovsite-week-data-v2';
const CLIENTS_KEY = 'ovsite-clients-v2';
const STAFF_KEY = 'ovsite-staff-register-v1';
const STAFF_NOTES_KEY = 'ovsite-staff-notes-v1';
const SCHEMA_VERSION_KEY = 'ovsite-schema-v';

const LEGACY_STORAGE_KEY = 'hazelcare-ops';
const LEGACY_WEEK_DATA_KEY = 'hc-week-data-v2';
const LEGACY_CLIENTS_KEY = 'hc-clients-v2';
const LEGACY_STAFF_KEY = 'hc-staff-register-v1';
const LEGACY_STAFF_NOTES_KEY = 'hazelcare-staff-notes';
const LEGACY_SCHEMA_VERSION_KEY = 'hc-schema-v';

const CURRENT_SCHEMA = '4';
let sessionWeekData: WeekSummary | null = null;

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

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
  if (typeof window !== 'undefined') return window.localStorage;

  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  if (descriptor && 'value' in descriptor && descriptor.value) {
    const injected = descriptor.value as Partial<StorageAdapter>;
    if (
      typeof injected.getItem === 'function' &&
      typeof injected.setItem === 'function' &&
      typeof injected.removeItem === 'function'
    ) {
      return injected as StorageAdapter;
    }
  }

  return memoryStorage;
}

function copyForward(storage: StorageAdapter, canonicalKey: string, legacyKey: string) {
  if (storage.getItem(canonicalKey) !== null) return;
  const legacy = storage.getItem(legacyKey);
  if (legacy !== null) storage.setItem(canonicalKey, legacy);
}

/**
 * One-way compatibility migration.
 *
 * New runtime writes use OVSITE keys. Legacy keys are deliberately retained
 * during the migration window so an operator can roll back without losing
 * browser-local evidence. They are not treated as current product identity.
 */
(function migrateLegacyStorage() {
  try {
    const storage = getStorage();
    copyForward(storage, STORAGE_KEY, LEGACY_STORAGE_KEY);
    copyForward(storage, CLIENTS_KEY, LEGACY_CLIENTS_KEY);
    copyForward(storage, STAFF_KEY, LEGACY_STAFF_KEY);
    copyForward(storage, STAFF_NOTES_KEY, LEGACY_STAFF_NOTES_KEY);

    // Week data is session-only now; remove stale persisted copies in either namespace.
    storage.removeItem(WEEK_DATA_KEY);
    storage.removeItem(LEGACY_WEEK_DATA_KEY);

    if (storage.getItem(SCHEMA_VERSION_KEY) === null) {
      storage.setItem(
        SCHEMA_VERSION_KEY,
        storage.getItem(LEGACY_SCHEMA_VERSION_KEY) || CURRENT_SCHEMA,
      );
    }
    storage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA);
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

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)
  );
}

/** Slim weekData to reduce payload — keep structure, truncate entry bodies */
function slimWeekData(data: AppState['weekData']): AppState['weekData'] {
  if (!data) return data;
  const houses: typeof data.houses = {};
  for (const [name, house] of Object.entries(data.houses)) {
    houses[name] = {
      ...house,
      entries: house.entries.map((entry) => ({ ...entry, entry: (entry.entry ?? '').slice(0, 300) })),
    };
  }
  return { ...data, houses };
}

function save(state: Partial<AppState>) {
  const current = load();
  const merged = normalizeState({ ...current, ...state, weekData: null });
  const serialised = JSON.stringify(merged);
  try {
    getStorage().setItem(STORAGE_KEY, serialised);
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    try {
      const slim = { ...merged, weekData: slimWeekData(merged.weekData) };
      getStorage().setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      try { getStorage().removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }
}

export function loadWeekData(): WeekSummary | null {
  return sessionWeekData;
}

export function saveWeekData(data: WeekSummary | null) {
  sessionWeekData = data;
  try {
    const storage = getStorage();
    storage.removeItem(WEEK_DATA_KEY);
    storage.removeItem(LEGACY_WEEK_DATA_KEY);
  } catch { /* ignore */ }
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
    if (parts[0].length === 4) {
      const [yr, mo, dy] = parts.map(Number);
      return new Date(yr, mo - 1, dy).getTime();
    }
    const timestamp = new Date(y, m - 1, d).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
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
    const incidents = entries.filter((entry) => entry.category === 'incident');
    const safeguarding = entries.filter((entry) => entry.category === 'safeguarding');
    const medication = entries.filter((entry) => entry.category === 'medication');
    const handovers = entries.filter((entry) => entry.category === 'handover');
    const dailySupport = entries.filter((entry) => entry.category === 'daily_support');
    const staffPerformance = entries.filter((entry) => entry.category === 'staff');
    const healthSafety = entries.filter((entry) => entry.category === 'health_safety');

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
        red: entries.filter((entry) => entry.severity === 'red').length,
        amber: entries.filter((entry) => entry.severity === 'amber').length,
        green: entries.filter((entry) => entry.severity === 'green').length,
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
  try {
    getStorage().setItem(STAFF_KEY, JSON.stringify(staff));
    if (typeof window !== 'undefined') {
      // Legacy event name retained until all listeners migrate in a later compatibility pass.
      window.dispatchEvent(new Event('hc-staff-updated'));
    }
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    getStorage().removeItem(STAFF_KEY);
  }
}

export function loadShifts(): Shift[] {
  return load().shifts;
}

export function saveShifts(shifts: Shift[]) {
  save({ shifts });
}

export function clearWeekData() {
  sessionWeekData = null;
  try {
    const storage = getStorage();
    storage.removeItem(WEEK_DATA_KEY);
    storage.removeItem(LEGACY_WEEK_DATA_KEY);
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      delete parsed.weekData;
      storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
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
  } else if (type === 'actions') save({ actions: [] });
  else if (type === 'incidents') save({ incidents: [] });
}

export function clearAllData() {
  sessionWeekData = null;
  const storage = getStorage();
  [
    WEEK_DATA_KEY,
    STORAGE_KEY,
    CLIENTS_KEY,
    STAFF_KEY,
    STAFF_NOTES_KEY,
    LEGACY_WEEK_DATA_KEY,
    LEGACY_STORAGE_KEY,
    LEGACY_CLIENTS_KEY,
    LEGACY_STAFF_KEY,
    LEGACY_STAFF_NOTES_KEY,
  ].forEach((key) => storage.removeItem(key));
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export interface OpsSnapshot {
  version: 1;
  exportedAt: string;
  source: 'ovsite' | 'hazelcare-ops';
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

  const appState = load();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'ovsite',
    data: {
      appState: { ...appState, weekData: null },
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
  const recognisedSource = s.source === 'ovsite' || s.source === 'hazelcare-ops';
  if (s.version !== 1 || !recognisedSource || !s.data) {
    return { ok: false, error: 'Snapshot format is not recognised.' };
  }

  const data = s.data as Partial<OpsSnapshot['data']>;
  if (!data.appState || typeof data.appState !== 'object') {
    return { ok: false, error: 'Snapshot is missing app state.' };
  }

  const appState: AppState = {
    weekData: null,
    actions: Array.isArray((data.appState as Partial<AppState>).actions) ? (data.appState as Partial<AppState>).actions as Action[] : [],
    incidents: Array.isArray((data.appState as Partial<AppState>).incidents) ? (data.appState as Partial<AppState>).incidents as Incident[] : [],
    staff: Array.isArray((data.appState as Partial<AppState>).staff) ? (data.appState as Partial<AppState>).staff as AppState['staff'] : [],
    shifts: Array.isArray((data.appState as Partial<AppState>).shifts) ? (data.appState as Partial<AppState>).shifts as Shift[] : [],
  };

  sessionWeekData = null;
  const storage = getStorage();
  storage.removeItem(WEEK_DATA_KEY);
  storage.removeItem(LEGACY_WEEK_DATA_KEY);
  storage.setItem(STORAGE_KEY, JSON.stringify(appState));
  storage.setItem(CLIENTS_KEY, JSON.stringify(Array.isArray(data.clients) ? data.clients : []));
  storage.setItem(STAFF_NOTES_KEY, JSON.stringify(Array.isArray(data.staffNotes) ? data.staffNotes : []));
  return { ok: true };
}
