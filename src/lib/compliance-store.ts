// ============================================================
// COMPLIANCE STORE — Service Audits (Staff now in main store)
// ============================================================

export interface ComplianceAudit {
  id: string;
  house: string;
  type: 'medication' | 'fire_safety' | 'finance' | 'cqc' | 'health_safety';
  lastCompleted: string;  // DD/MM/YYYY
  dueDate: string;        // DD/MM/YYYY
  completedBy: string;
  notes: string;
}

const AUDIT_KEY = 'hazelcare-compliance-audits';

export function loadComplianceAudits(): ComplianceAudit[] {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; }
}

export function saveComplianceAudits(audits: ComplianceAudit[]) {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(audits));
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function parseDateStr(d: string): Date | null {
  if (!d) return null;
  const parts = d.split('/');
  if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0]);
  return new Date(d);
}

export function daysUntil(dateStr: string): number {
  const d = parseDateStr(dateStr);
  if (!d || isNaN(d.getTime())) return 9999;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function staffStatus(dateStr: string, warnDays = 30): 'ok' | 'due_soon' | 'overdue' {
  if (!dateStr) return 'ok';
  const days = daysUntil(dateStr);
  if (days < 0) return 'overdue';
  if (days < warnDays) return 'due_soon';
  return 'ok';
}

export const HAZELCARE_HOUSES = [
  'Lingfield House', 'Church House', 'Laurel House', 'Station House',
  'Canterbury', 'Glenfrome House', 'Woburn House', 'Hazelbury House',
  'Courtney Lodge', 'Cottrell House',
];

export const ROLES = [
  'Support Worker', 'Senior Support Worker', 'House Coordinator',
  'Team Leader', 'Deputy Manager', 'Registered Manager', 'Bank Staff', 'Agency',
];

export const AUDIT_TYPES: { id: ComplianceAudit['type']; label: string; freqWeeks: number; color: string }[] = [
  { id: 'medication', label: 'Medication Audit', freqWeeks: 4, color: '#0891b2' },
  { id: 'fire_safety', label: 'Fire Safety Check', freqWeeks: 4, color: '#ef4444' },
  { id: 'finance', label: 'Finance Audit', freqWeeks: 4, color: '#059669' },
  { id: 'cqc', label: 'CQC Readiness Check', freqWeeks: 13, color: '#be185d' },
  { id: 'health_safety', label: 'Health & Safety', freqWeeks: 4, color: '#d97706' },
];
