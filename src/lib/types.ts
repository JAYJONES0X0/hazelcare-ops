export interface NourishEntry {
  date: string;
  house: string;
  type: string;
  carer: string;
  client: string;
  entry: string;
  severity: 'red' | 'amber' | 'green' | 'none';
  flags: string[];
}

export interface HouseSummary {
  name: string;
  coordinator: string;
  entries: NourishEntry[];
  incidents: NourishEntry[];
  safeguarding: NourishEntry[];
  medication: NourishEntry[];
  staffPerformance: NourishEntry[];
  healthSafety: NourishEntry[];
  handovers: NourishEntry[];
  dailySupport: NourishEntry[];
  flags: { red: number; amber: number; green: number };
}

export interface WeekSummary {
  dateFrom: string;
  dateTo: string;
  totalEntries: number;
  houses: Record<string, HouseSummary>;
  allFlags: { red: NourishEntry[]; amber: NourishEntry[]; green: NourishEntry[] };
  entryTypes: Record<string, number>;
  clients: string[];
  carers: string[];
}

export type TemplateType =
  | 'quality_meeting'
  | 'daily_quality'
  | 'incident_report'
  | 'handover'
  | 'supervision'
  | 'safeguarding'
  | 'medication_audit'
  | 'finance';

export interface Template {
  id: TemplateType;
  name: string;
  icon: string;
  desc: string;
  color: string;
}

export const TEMPLATES: Template[] = [
  { id: 'quality_meeting', name: 'Quality & Performance Meeting', icon: '📋', desc: 'Friday weekly ops review', color: '#0f766e' },
  { id: 'daily_quality', name: 'Daily Quality Meeting', icon: '📊', desc: 'Morning ops briefing', color: '#1e40af' },
  { id: 'incident_report', name: 'Incident Report', icon: '🚨', desc: 'Individual incident documentation', color: '#dc2626' },
  { id: 'handover', name: 'Shift Handover', icon: '🔄', desc: 'Night/day shift handover', color: '#d97706' },
  { id: 'supervision', name: 'Supervision Record', icon: '👤', desc: 'Staff 1:1 supervision notes', color: '#7c3aed' },
  { id: 'safeguarding', name: 'Safeguarding Report', icon: '🛡️', desc: 'Safeguarding concern docs', color: '#be185d' },
  { id: 'medication_audit', name: 'Medication Audit', icon: '💊', desc: 'Medication review & audit', color: '#0891b2' },
  { id: 'finance', name: 'Finance Meeting', icon: '💷', desc: 'Budget & finance review', color: '#059669' },
];
