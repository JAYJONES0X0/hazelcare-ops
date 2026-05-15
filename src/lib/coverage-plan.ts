import type { CareEntry } from './types';

const COVERAGE_PLAN_KEY = 'hc-coverage-plan-v1';

export interface SupportWindow {
  id: string;
  label: string;
  start: string;
  end: string;
  hours: number;
}

export interface CoveragePlan {
  client: string;
  dateFrom: string;
  dateTo: string;
  windows: SupportWindow[];
}

export interface CoverageDay {
  date: string;
  expected: number;
  actual: number;
  missing: number;
  missingWindows: SupportWindow[];
}

export interface CoverageSummary {
  days: CoverageDay[];
  missingDays: CoverageDay[];
  totalExpected: number;
  totalActual: number;
  totalMissing: number;
  coveragePct: number;
  dailyHours: number;
  totalHours: number;
  rawTotalHours: number;
  hourCap: number;
  capApplied: boolean;
}

export const DEFAULT_SUPPORT_WINDOWS: SupportWindow[] = [
  { id: 'am', label: 'Morning 1:1', start: '10:00', end: '12:00', hours: 2 },
  { id: 'pm', label: 'Afternoon 1:1', start: '14:00', end: '15:00', hours: 1 },
  { id: 'eve', label: 'Evening 1:1', start: '17:00', end: '19:00', hours: 2 },
];
export const SUPPORT_HOUR_CAP = 15;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(date: string): string {
  const p = date.split('/');
  return p.length === 3 ? `${p[2]}-${pad(Number(p[1]))}-${pad(Number(p[0]))}` : '';
}

export function fromIsoDate(iso: string): string {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function parseClockToMinutes(value: string): number | null {
  const raw = value.trim().toLowerCase().replace(/\s+/g, '');
  const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridian = match[3];
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatClock(minutes: number): string {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return `${pad(Math.floor(bounded / 60))}:${pad(bounded % 60)}`;
}

function windowFromRange(range: string, index: number): SupportWindow | null {
  const parts = range.split(/\s*(?:-|to|until)\s*/i).filter(Boolean);
  if (parts.length !== 2) return null;
  const startMin = parseClockToMinutes(parts[0]);
  const endMin = parseClockToMinutes(parts[1]);
  if (startMin === null || endMin === null || endMin <= startMin) return null;
  const start = formatClock(startMin);
  const end = formatClock(endMin);
  const hours = Math.round(((endMin - startMin) / 60) * 10) / 10;
  return { id: `w${index + 1}`, label: `${start}-${end} 1:1`, start, end, hours };
}

export function parseSupportWindows(input: string): SupportWindow[] {
  const chunks = input
    .replace(/\band\b/gi, ',')
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed = chunks
    .map((chunk, index) => windowFromRange(chunk, index))
    .filter((w): w is SupportWindow => Boolean(w));
  return parsed.length ? parsed : DEFAULT_SUPPORT_WINDOWS;
}

export function formatSupportWindows(windows: SupportWindow[]): string {
  return windows.map((w) => `${w.start}-${w.end}`).join(', ');
}

export function loadCoveragePlan(): CoveragePlan | null {
  try {
    const raw = localStorage.getItem(COVERAGE_PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoveragePlan;
    if (!parsed.client || !parsed.dateFrom || !parsed.dateTo || !Array.isArray(parsed.windows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCoveragePlan(plan: CoveragePlan): void {
  localStorage.setItem(COVERAGE_PLAN_KEY, JSON.stringify(plan));
}

export function clearCoveragePlan() {
  localStorage.removeItem(COVERAGE_PLAN_KEY);
}

export function buildShiftContext(plan: CoveragePlan, date: string, windowsForDay: SupportWindow[] = plan.windows): string {
  const windows = windowsForDay.map((w) => `${w.start}-${w.end} 1:1 support`).join('; ');
  return `${plan.client} expected 1:1 support on ${date}: ${windows}. Use these exact support windows and evidence the support, intervention, client response, and handover outcome.`;
}

export function isDailySupportEntry(entry: CareEntry): boolean {
  const haystack = `${entry.category || ''} ${entry.type || ''} ${entry.entry || ''}`.toLowerCase();
  return entry.category === 'daily_support'
    || haystack.includes('daily support')
    || haystack.includes('1:1')
    || haystack.includes('one to one')
    || haystack.includes('support');
}

function windowDurationMinutes(window: SupportWindow): number {
  const start = parseClockToMinutes(window.start);
  const end = parseClockToMinutes(window.end);
  if (start !== null && end !== null && end > start) {
    return end - start;
  }
  return Math.max(0, Math.round(window.hours * 60));
}

function cloneWindowWithDuration(window: SupportWindow, minutes: number): SupportWindow {
  const duration = Math.max(1, minutes);
  const start = parseClockToMinutes(window.start);
  if (start === null) {
    return {
      ...window,
      hours: Math.round((duration / 60) * 10) / 10,
    };
  }
  const end = formatClock(start + duration);
  return {
    ...window,
    end,
    label: `${window.start}-${end} 1:1`,
    hours: Math.round((duration / 60) * 10) / 10,
  };
}

function allocateDayWindows(windows: SupportWindow[], remainingMinutes: number): { windows: SupportWindow[]; usedMinutes: number } {
  if (remainingMinutes <= 0) return { windows: [], usedMinutes: 0 };
  let remaining = remainingMinutes;
  let used = 0;
  const picked: SupportWindow[] = [];
  for (const window of windows) {
    if (remaining <= 0) break;
    const duration = windowDurationMinutes(window);
    if (duration <= 0) continue;
    if (duration <= remaining) {
      picked.push(window);
      remaining -= duration;
      used += duration;
      continue;
    }
    picked.push(cloneWindowWithDuration(window, remaining));
    used += remaining;
    remaining = 0;
    break;
  }
  return { windows: picked, usedMinutes: used };
}

export function computeCoverageSummary(entries: CareEntry[], plan: CoveragePlan | null): CoverageSummary | null {
  if (!plan || !plan.client || !plan.dateFrom || !plan.dateTo || plan.windows.length === 0) return null;
  const fromIso = toIsoDate(plan.dateFrom);
  const toIso = toIsoDate(plan.dateTo);
  if (!fromIso || !toIso || fromIso > toIso) return null;

  const byDay = new Map<string, CareEntry[]>();
  for (const entry of entries) {
    if ((entry.client || '').trim().toLowerCase() !== plan.client.trim().toLowerCase()) continue;
    const iso = toIsoDate(entry.date);
    if (!iso || iso < fromIso || iso > toIso) continue;
    if (!entry.entry?.trim() || !isDailySupportEntry(entry)) continue;
    if (!byDay.has(iso)) byDay.set(iso, []);
    byDay.get(iso)!.push(entry);
  }

  const days: CoverageDay[] = [];
  const cursor = new Date(fromIso);
  const end = new Date(toIso);
  const rawDailyHours = Math.round((plan.windows.reduce((sum, w) => sum + windowDurationMinutes(w), 0) / 60) * 10) / 10;
  let remainingCapMinutes = Math.round(SUPPORT_HOUR_CAP * 60);
  let cappedMinutes = 0;
  while (cursor <= end) {
    const iso = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    const actual = byDay.get(iso)?.length || 0;
    const allocation = allocateDayWindows(plan.windows, remainingCapMinutes);
    const expectedWindows = allocation.windows;
    const expected = expectedWindows.length;
    const missing = Math.max(0, expected - actual);
    remainingCapMinutes = Math.max(0, remainingCapMinutes - allocation.usedMinutes);
    cappedMinutes += allocation.usedMinutes;
    days.push({
      date: fromIsoDate(iso),
      expected,
      actual,
      missing,
      missingWindows: expectedWindows.slice(actual, actual + missing),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalExpected = days.reduce((sum, day) => sum + day.expected, 0);
  const totalActual = days.reduce((sum, day) => sum + Math.min(day.actual, day.expected), 0);
  const totalMissing = Math.max(0, totalExpected - totalActual);
  const totalHours = Math.round((cappedMinutes / 60) * 10) / 10;
  const rawTotalHours = Math.round(rawDailyHours * days.length * 10) / 10;
  return {
    days,
    missingDays: days.filter((day) => day.missing > 0),
    totalExpected,
    totalActual,
    totalMissing,
    coveragePct: totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 100,
    dailyHours: rawDailyHours,
    totalHours,
    rawTotalHours,
    hourCap: SUPPORT_HOUR_CAP,
    capApplied: rawTotalHours > SUPPORT_HOUR_CAP && totalHours < rawTotalHours,
  };
}
