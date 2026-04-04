import { uid } from './storage';
import type { EscalationItem } from './staff-monitoring';

const KEY = 'hc-staff-monitoring-runs-v1';
const OUTCOMES_KEY = 'hc-staff-monitoring-outcomes-v1';

export interface MonitoringRunRecord {
  id: string;
  at: string;
  snapshotSummary: string;
  escalationCount: number;
}

export interface CallOutcomeRecord {
  id: string;
  escalationId: string;
  carer: string;
  at: string;
  outcome: 'reached' | 'voicemail' | 'refused' | 'callback' | 'resolved';
  notes: string;
}

export function loadMonitoringRuns(): MonitoringRunRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function saveMonitoringRun(summary: string, escalationCount: number): MonitoringRunRecord {
  const rec: MonitoringRunRecord = {
    id: uid(),
    at: new Date().toISOString(),
    snapshotSummary: summary,
    escalationCount,
  };
  const prev = loadMonitoringRuns();
  localStorage.setItem(KEY, JSON.stringify([rec, ...prev].slice(0, 50)));
  return rec;
}

export function loadCallOutcomes(): CallOutcomeRecord[] {
  try {
    const raw = localStorage.getItem(OUTCOMES_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function saveCallOutcome(
  esc: EscalationItem,
  outcome: CallOutcomeRecord['outcome'],
  notes: string,
): CallOutcomeRecord {
  const rec: CallOutcomeRecord = {
    id: uid(),
    escalationId: esc.id,
    carer: esc.carer,
    at: new Date().toISOString(),
    outcome,
    notes,
  };
  const prev = loadCallOutcomes();
  localStorage.setItem(OUTCOMES_KEY, JSON.stringify([rec, ...prev].slice(0, 200)));
  return rec;
}

export function lastHourlyCheckAt(): number | null {
  try {
    const raw = localStorage.getItem('hc-staff-monitoring-hourly-v1');
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function touchHourlyCheck(): void {
  localStorage.setItem('hc-staff-monitoring-hourly-v1', String(Date.now()));
}
