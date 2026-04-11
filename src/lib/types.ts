// ============================================================
// CORE DATA TYPES
// ============================================================
export interface CareEntry {
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
  entries: CareEntry[];
  incidents: CareEntry[];
  safeguarding: CareEntry[];
  medication: CareEntry[];
  staffPerformance: CareEntry[];
  healthSafety: CareEntry[];
  handovers: CareEntry[];
  dailySupport: CareEntry[];
  flags: { red: number; amber: number; green: number };
}

export interface WeekSummary {
  dateFrom: string;
  dateTo: string;
  totalEntries: number;
  houses: Record<string, HouseSummary>;
  allFlags: { red: CareEntry[]; amber: CareEntry[]; green: CareEntry[] };
  entryTypes: Record<string, number>;
  clients: string[];
  carers: string[];
  clientDiary: Record<string, CareEntry[]>;  // per-client diary entries
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
  | 'finance'
  | 'care_review'
  | 'complaint_concern'
  | 'cqc_report'
  | 'house_meeting'
  | 'family_feedback'
  | 'gp_appointment'
  | 'medication_review'
  | 'medication_transaction'
  | 'finance_audit'
  | 'repairs_maintenance'
  | 'weekly_quality_report'
  | 'performance_improvement'
  | 'probation_review'
  | 'exit_interview';

export interface Template {
  id: TemplateType;
  name: string;
  icon: string;
  desc: string;
  color: string;
}

export const TEMPLATES: Template[] = [
  { id: 'quality_meeting',        name: 'Quality & Performance Meeting', icon: '📋', desc: 'Friday weekly ops review',           color: '#0f766e' },
  { id: 'daily_quality',          name: 'Daily Quality Meeting',         icon: '📊', desc: 'Morning ops briefing',               color: '#1e40af' },
  { id: 'incident_report',        name: 'Incident Report',               icon: '🚨', desc: 'Individual incident documentation',  color: '#dc2626' },
  { id: 'handover',               name: 'Shift Handover',                icon: '🔄', desc: 'Night/day shift handover',           color: '#d97706' },
  { id: 'supervision',            name: 'Supervision Record',            icon: '👤', desc: 'Staff 1:1 supervision notes',        color: '#7c3aed' },
  { id: 'safeguarding',           name: 'Safeguarding Report',           icon: '🛡️', desc: 'Safeguarding concern documentation', color: '#be185d' },
  { id: 'medication_audit',       name: 'Medication Audit',              icon: '💊', desc: 'Medication review & audit',          color: '#0891b2' },
  { id: 'finance',                name: 'Finance Meeting',               icon: '💷', desc: 'Budget & finance review',            color: '#059669' },
  { id: 'care_review',            name: 'Care Review',                   icon: '📝', desc: 'Client care plan review',            color: '#0369a1' },
  { id: 'complaint_concern',      name: 'Complaint & Concern',           icon: '⚠️', desc: 'Complaints & concerns log',          color: '#b45309' },
  { id: 'cqc_report',             name: 'CQC Report',                    icon: '🏛️', desc: 'CQC regulatory documentation',       color: '#1d4ed8' },
  { id: 'house_meeting',          name: 'House Meeting',                 icon: '🏠', desc: 'House-level team meeting',           color: '#0f766e' },
  { id: 'family_feedback',        name: 'Family Feedback',               icon: '💬', desc: 'Client & family feedback record',    color: '#7c3aed' },
  { id: 'gp_appointment',         name: 'GP Appointment',                icon: '🩺', desc: 'GP visit & outcome record',          color: '#0891b2' },
  { id: 'medication_review',      name: 'Medication Review',             icon: '🔬', desc: 'Clinical medication review',         color: '#0369a1' },
  { id: 'medication_transaction', name: 'Medication Transaction',        icon: '📦', desc: 'Collected / ordered / returned',     color: '#0891b2' },
  { id: 'finance_audit',          name: 'Finance Audit',                 icon: '🧾', desc: 'Finance audit & transactions',       color: '#059669' },
  { id: 'repairs_maintenance',    name: 'Repairs & Maintenance',         icon: '🔧', desc: 'Property repairs log',               color: '#78350f' },
  { id: 'weekly_quality_report',  name: 'Weekly Quality Report',         icon: '📈', desc: 'Regional quality summary',           color: '#1e40af' },
  { id: 'performance_improvement',name: 'Performance Improvement Plan',  icon: '📌', desc: 'Staff PIP documentation',            color: '#b45309' },
  { id: 'probation_review',       name: 'Probation Review',              icon: '✅', desc: 'First 3-month staff review',         color: '#059669' },
  { id: 'exit_interview',         name: 'Exit Interview',                icon: '🚪', desc: 'Leaver exit interview record',       color: '#64748b' },
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
