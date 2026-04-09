import type { AppState, Action, CareEntry, Incident, WeekSummary } from './types';

const STORAGE_KEY = 'hazelcare-ops';
const CLIENTS_KEY = 'hc-clients-v2';
const STAFF_NOTES_KEY = 'hazelcare-staff-notes';

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return { weekData: null, actions: [], incidents: [], staff: [] };
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
      entries: house.entries.map(e => ({ ...e, entry: (e.entry ?? '').slice(0, 300) })),
    };
  }
  return { ...data, houses };
}

function save(state: Partial<AppState>) {
  const current = load();
  const merged = { ...current, ...state };
  const serialised = JSON.stringify(merged);
  try {
    localStorage.setItem(STORAGE_KEY, serialised);
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    // Quota exceeded — try again with truncated entry bodies
    try {
      const slim = { ...merged, weekData: slimWeekData(merged.weekData) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      // Still over quota — remove and let the session run in memory only
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }
}

export function loadWeekData(): WeekSummary | null {
  return load().weekData;
}

export function saveWeekData(data: WeekSummary) {
  save({ weekData: data });
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
  const parts = s.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    const t = new Date(y, m - 1, d).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(s);
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

export function clearWeekData() {
  save({ weekData: null });
}

export function clearActions() {
  save({ actions: [] });
}

export function clearIncidents() {
  save({ incidents: [] });
}

export function clearSelectedData(type: 'diary' | 'actions' | 'incidents') {
  if (type === 'diary') save({ weekData: null });
  else if (type === 'actions') save({ actions: [] });
  else if (type === 'incidents') save({ incidents: [] });
}

export function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
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
    const raw = localStorage.getItem(CLIENTS_KEY);
    clients = raw ? JSON.parse(raw) : [];
  } catch {
    clients = [];
  }
  try {
    const raw = localStorage.getItem(STAFF_NOTES_KEY);
    staffNotes = raw ? JSON.parse(raw) : [];
  } catch {
    staffNotes = [];
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'hazelcare-ops',
    data: {
      appState: load(),
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
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(Array.isArray(data.clients) ? data.clients : []));
  localStorage.setItem(STAFF_NOTES_KEY, JSON.stringify(Array.isArray(data.staffNotes) ? data.staffNotes : []));
  return { ok: true };
}
