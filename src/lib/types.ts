// ============================================================
// CORE DATA TYPES
// ============================================================
export interface NourishEntry {
  id: string;
  date: string;
  time?: string;
  house: string;
  type: string;
  carer: string;
  client: string;
  entry: string;
  severity: 'red' | 'amber' | 'green' | 'none';
  flags: string[];
  category?: Category;
}

export type Category =
  | 'incident'
  | 'safeguarding'
  | 'medication'
  | 'handover'
  | 'daily_support'
  | 'finance'
  | 'staff'
  | 'health_safety'
  | 'other';

// ============================================================
// ACTION TRACKING
// ============================================================
export type ActionStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'overdue';
export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Action {
  id: string;
  title: string;
  description: string;
  house: string;
  owner: string;
  priority: ActionPriority;
  status: ActionStatus;
  createdAt: string;
  dueDate: string;
  completedAt?: string;
  sourceEntry?: string;
  tags: string[];
}

// ============================================================
// INCIDENT TRACKING
// ============================================================
export type IncidentStage = 'logged' | 'investigating' | 'resolved' | 'reported' | 'closed';

export interface Incident {
  id: string;
  title: string;
  house: string;
  client: string;
  staff: string;
  date: string;
  severity: 'red' | 'amber';
  stage: IncidentStage;
  description: string;
  flags: string[];
  actions: string[];
  outcome?: string;
  reportedToCQC?: boolean;
  createdAt: string;
}

// ============================================================
// STAFF
// ============================================================
export interface StaffMember {
  id: string;
  name: string;
  role: string;
  house: string;
  phone?: string;
  email?: string;
  dbsExpiry?: string;
  trainingExpiry?: string;
  nextSupervision?: string;
  sicknessThisMonth: number;
  latenessThisMonth: number;
  status: 'active' | 'sickness' | 'leave' | 'suspended';
}

// ============================================================
// HOUSE & WEEK SUMMARIES
// ============================================================
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
  clientDiary: Record<string, NourishEntry[]>;  // per-client diary entries
}

// ============================================================
// TEMPLATES
// ============================================================
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

// ============================================================
// APP STATE
// ============================================================
export interface AppState {
  weekData: WeekSummary | null;
  actions: Action[];
  incidents: Incident[];
  staff: StaffMember[];
}
