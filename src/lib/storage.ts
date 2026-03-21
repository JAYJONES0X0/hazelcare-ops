import type { AppState, Action, Incident, WeekSummary } from './types';

const STORAGE_KEY = 'hazelcare-ops';

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
