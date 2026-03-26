import type { AppState, Action, Incident, WeekSummary } from './types';

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

function save(state: Partial<AppState>) {
  const current = load();
  const merged = { ...current, ...state };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function loadWeekData(): WeekSummary | null {
  return load().weekData;
}

export function saveWeekData(data: WeekSummary) {
  save({ weekData: data });
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
