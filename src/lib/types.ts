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
export type OperationalActionState =
  | 'not_started'
  | 'assigned'
  | 'in_progress'
  | 'waiting_staff_feedback'
  | 'waiting_professional'
  | 'waiting_resident_availability'
  | 'completed'
  | 'closed_with_evidence'
  | 'carry_forward'
  | 'escalated';

export type EvidenceSourceType =
  | 'diary_entry'
  | 'client_pack_file'
  | 'vault_document'
  | 'manual_note'
  | 'communication'
  | 'receipt_image'
  | 'atm_slip'
  | 'invoice'
  | 'bank_statement'
  | 'cash_count_photo'
  | 'ledger_import'
  | 'financial_transaction'
  | 'system_generated';

export interface EvidenceItem {
  id: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  title: string;
  resident?: string;
  house?: string;
  date?: string;
  excerpt: string;
  confidence: number;
  reviewState: 'unreviewed' | 'review_required' | 'reviewed' | 'deferred';
  usedForOutput: boolean;
}

export interface ActionStateEvent {
  id: string;
  actionId: string;
  from?: OperationalActionState;
  to: OperationalActionState;
  at: string;
  by: string;
  reason: string;
  evidenceIds: string[];
}

export interface Action {
  id: string;
  title: string;
  description: string;
  house: string;
  resident?: string;
  owner: string;
  priority: ActionPriority;
  status: ActionStatus;
  operationalState?: OperationalActionState;
  createdAt: string;
  dueDate: string;
  completedAt?: string;
  sourceEntry?: string;
  sourceEvidence?: EvidenceItem[];
  stateHistory?: ActionStateEvent[];
  carryForward?: boolean;
  closedWithEvidence?: boolean;
  tags: string[];
}

export interface CommunicationRecord {
  id: string;
  resident?: string;
  house?: string;
  recipientType: 'family' | 'professional' | 'internal' | 'audit';
  recipientName?: string;
  status: 'draft' | 'reviewed' | 'copied' | 'sent' | 'logged';
  createdAt: string;
  reviewedAt?: string;
  sourceEvidenceIds: string[];
  outputDraftId?: string;
  summary: string;
}

export interface OutputDraft {
  id: string;
  type:
    | 'weekly_update'
    | 'handover'
    | 'nourish_export'
    | 'audit_summary'
    | 'client_finance_statement'
    | 'allowance_summary'
    | 'missing_evidence_report'
    | 'reconciliation_report'
    | 'finance_request'
    | 'finance_audit_pack';
  recipientType: CommunicationRecord['recipientType'];
  resident?: string;
  house?: string;
  dateFrom?: string;
  dateTo?: string;
  text: string;
  sourceEvidence: EvidenceItem[];
  missingEvidence: string[];
  reviewRequired: boolean;
  createdAt: string;
}

export interface ResidentPeriodSummary {
  resident: string;
  house?: string;
  dateFrom?: string;
  dateTo?: string;
  entriesReviewed: number;
  supportOffered: string[];
  acceptedOrDeclined: string[];
  activities: string[];
  appointments: string[];
  healthConcerns: string[];
  incidents: string[];
  refusals: string[];
  poorEntries: string[];
  openActionHints: string[];
  evidenceIds: string[];
}

export interface HouseDailyState {
  house: string;
  dateLabel: string;
  residentCount: number;
  evidenceCount: number;
  openActions: Action[];
  waitingFeedback: Action[];
  waitingProfessionals: Action[];
  appointments: EvidenceItem[];
  healthFollowUps: EvidenceItem[];
  escalationFlags: EvidenceItem[];
  carryForwardItems: Action[];
  missingEvidence: string[];
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
  supervisionFreq?: number; // weeks
  sicknessThisMonth: number;
  latenessThisMonth: number;
  status: 'active' | 'sickness' | 'leave' | 'suspended';
  complianceStatus?: 'compliant' | 'pending' | 'missing';
  dbsChecked?: boolean;
  trainingCompletion?: number;
  lastSupervision?: string;
}

export interface Shift {
  id: string;
  staffId?: string;
  house: string;
  date: string; // DD/MM/YYYY
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  type: 'day' | 'night' | 'long_day';
  hours: number;
  status: 'open' | 'filled' | 'confirmed';
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
// COMMUNICATIONS & INTERCEPTS
// ============================================================
export type InterceptVector = 'message' | 'alert' | 'leave' | 'gap';

export interface InterceptedIntel {
  id: string;
  type: InterceptVector;
  timestamp: string;
  sender: string; // or subject
  phone?: string;
  content: string;
  category: string;
  draft: string;
  meta?: {
    client?: string;
    dateRange?: string;
    uncompletedTask?: string;
    priority?: 'critical' | 'high' | 'medium' | 'low';
  };
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
  { id: 'quality_meeting',        name: 'WEEKLY QUALITY REVIEW',       icon: '📋', desc: 'Friday weekly quality review',       color: '#0f766e' },
  { id: 'daily_quality',          name: 'DAILY OPERATIONS BRIEFING',   icon: '📊', desc: 'Morning ops briefing',               color: '#1e40af' },
  { id: 'incident_report',        name: 'INCIDENT LOG & REVIEW',       icon: '🚨', desc: 'Individual incident documentation',  color: '#dc2626' },
  { id: 'handover',               name: 'SHIFT HANDOVER',              icon: '🔄', desc: 'Night/day shift handover',           color: '#d97706' },
  { id: 'supervision',            name: 'STAFF SUPERVISION NOTES',     icon: '👤', desc: 'Staff 1:1 supervision notes',        color: '#7c3aed' },
  { id: 'safeguarding',           name: 'SAFEGUARDING CONCERN',        icon: '🛡️', desc: 'Safeguarding concern documentation', color: '#be185d' },
  { id: 'medication_audit',       name: 'MEDICATION REVIEW',           icon: '💊', desc: 'Medication review & audit',          color: '#0891b2' },
  { id: 'finance',                name: 'FINANCE REVIEW',              icon: '💷', desc: 'Budget & finance review',            color: '#059669' },
  { id: 'care_review',            name: 'CARE PLAN REVIEW',            icon: '📝', desc: 'Client care plan review',            color: '#0369a1' },
  { id: 'complaint_concern',      name: 'COMPLAINTS & CONCERNS',       icon: '⚠️', desc: 'Complaints & concerns log',          color: '#b45309' },
  { id: 'cqc_report',             name: 'CQC COMPLIANCE',              icon: '🏛️', desc: 'CQC regulatory documentation',       color: '#1d4ed8' },
  { id: 'house_meeting',          name: 'HOME TEAM MEETING',           icon: '🏠', desc: 'Home-level team meeting',            color: '#0f766e' },
  { id: 'family_feedback',        name: 'FAMILY FEEDBACK',             icon: '💬', desc: 'Client & family feedback record',    color: '#7c3aed' },
  { id: 'gp_appointment',         name: 'GP APPOINTMENT',              icon: '🩺', desc: 'GP visit & outcome record',          color: '#0891b2' },
  { id: 'medication_review',      name: 'CLINICAL MEDICATION REVIEW',      icon: '🔬', desc: 'Clinical medication review',         color: '#0369a1' },
  { id: 'medication_transaction', name: 'MEDICATION SUPPLY LOG',          icon: '📦', desc: 'Collected / ordered / returned',     color: '#0891b2' },
  { id: 'finance_audit',          name: 'FINANCE AUDIT',            icon: '🧾', desc: 'Finance audit & transactions',       color: '#059669' },
  { id: 'repairs_maintenance',    name: 'PROPERTY & REPAIRS',        icon: '🔧', desc: 'Property repairs log',               color: '#78350f' },
  { id: 'weekly_quality_report',  name: 'WEEKLY PERFORMANCE REVIEW', icon: '📈', desc: 'Regional quality summary',           color: '#1e40af' },
  { id: 'performance_improvement',name: 'PERFORMANCE IMPROVEMENT',   icon: '📌', desc: 'Staff PIP documentation',            color: '#b45309' },
  { id: 'probation_review',       name: 'INDUCTION REVIEW',      icon: '✅', desc: 'First 3-month staff review',         color: '#059669' },
  { id: 'exit_interview',         name: 'EXIT INTERVIEW',       icon: '🚪', desc: 'Leaver exit interview record',       color: '#64748b' },
];

// ============================================================
// APP STATE
// ============================================================
export interface AppState {
  weekData: WeekSummary | null;
  actions: Action[];
  incidents: Incident[];
  staff: StaffMember[];
  shifts: Shift[];
}

export type Page = 'briefing' | 'dashboard' | 'communications' | 'upload' | 'templates' | 'actions' | 'incidents' | 'staff' | 'staff-tools' | 'notes' | 'note-workspace' | 'training-hub' | 'handover' | 'compliance' | 'reports' | 'risk' | 'client-docs' | 'client-diary' | 'agency' | 'staff-monitoring' | 'settings' | 'admin' | 'empire-matrix' | 'nourish-tasks' | 'client-finance' | 'medication-safety';

export interface PageContext {
  client?: string;
  house?: string;
  severity?: string;
  coveragePlan?: unknown;
}

// Moved here from lib/staff-monitoring.ts to break circular dep with staff-monitoring-store.ts
export type EscalationTier = 1 | 2 | 3;

export interface EscalationItem {
  id: string;
  tier: EscalationTier;
  house: string;
  carer: string;
  summary: string;
  reasons: string[];
  suggestedTool: 'notes' | 'handover' | 'actions' | 'incidents';
  qualityScore: number;
  entryCount: number;
  shortEntryRatio: number;
  avgEntryChars: number;
  topGaps: string[];
}
