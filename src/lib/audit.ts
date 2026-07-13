import { getStorage, loadWeekData } from './storage';

export type AuditAction = 
  | 'document_generated' 
  | 'data_imported' 
  | 'data_exported' 
  | 'action_completed' 
  | 'incident_resolved' 
  | 'compliance_updated'
  | 'settings_changed'
  | 'review_signed_off'
  | 'pack_uploaded'
  | 'file_classified'
  | 'file_parse_started'
  | 'file_parse_completed'
  | 'file_parse_failed'
  | 'client_draft_created'
  | 'client_merge_suggested'
  | 'client_merged'
  | 'document_attached_to_vault'
  | 'contact_imported_unverified'
  | 'profile_image_attached'
  | 'ai_used_for_classification'
  | 'ocr_required'
  | 'ocr_completed'
  | 'task_pack_generated'
  | 'export_created'
  | 'manager_review_completed'
  | 'client_promoted_live'
  | 'finance_receipt_captured'
  | 'finance_receipt_batch_captured'
  | 'finance_receipt_extracted'
  | 'finance_receipt_review_required'
  | 'finance_receipt_extraction_failed'
  | 'finance_transaction_proposed'
  | 'finance_transaction_confirmed'
  | 'finance_transaction_edited'
  | 'finance_transaction_correction_created'
  | 'finance_receipt_linked'
  | 'finance_receipt_unlinked'
  | 'finance_reconciliation_opened'
  | 'finance_reconciliation_completed'
  | 'finance_exception_raised'
  | 'finance_exception_assigned'
  | 'finance_exception_resolved'
  | 'finance_reviewer_approved'
  | 'finance_reviewer_rejected'
  | 'finance_ledger_imported'
  | 'finance_export_generated'
  | 'medication_profile_created'
  | 'medication_order_verified'
  | 'mar_schedule_generated'
  | 'mar_recording_started'
  | 'mar_outcome_recorded'
  | 'mar_correction_created'
  | 'medication_export_generated';

export interface EvidenceLineage {
  sourceType: 'nourish_csv' | 'pdf_import' | 'manual_entry' | 'system_generated';
  sourceId?: string; // e.g., filename or entry ID
  timestamp: string;
  checksum?: string; // To ensure data integrity
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  userId: string; // "manager" or "senior" for local-first
  details: string;
  metadata?: Record<string, unknown>;
  lineage?: EvidenceLineage[];
}

const AUDIT_KEY = 'hc-audit-trail-v1';

// Authenticated identity for attributing audit entries. Set from the session
// fetch in App.tsx; falls back to the stored role, then 'unknown'.
let auditIdentity = '';
export function setAuditIdentity(identity: string) {
  auditIdentity = (identity || '').trim();
}
function resolveUserId(): string {
  if (auditIdentity) return auditIdentity;
  try {
    const role = localStorage.getItem('hc-user-role');
    if (role) return role;
  } catch { /* ignore */ }
  return 'unknown';
}

export function loadAuditTrail(): AuditEntry[] {
  try {
    const raw = getStorage().getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logAuditAction(action: AuditAction, details: string, metadata?: Record<string, unknown>, lineage?: EvidenceLineage[]): AuditEntry {
  const trail = loadAuditTrail();
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    userId: resolveUserId(),
    details,
    metadata,
    lineage,
  };
  
  trail.unshift(entry);
  // Keep last 1000 entries to prevent localStorage bloat
  const limitedTrail = trail.slice(0, 1000);
  getStorage().setItem(AUDIT_KEY, JSON.stringify(limitedTrail));
  
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hc-audit-updated', { detail: entry }));
  }
  return entry;
}

/**
 * Generates evidence lineage for current week data entries.
 * Useful for linking generated reports back to their specific Nourish source.
 */
export function getLineageForEntries(entryIds: string[]): EvidenceLineage[] {
  const weekData = loadWeekData();
  if (!weekData) return [];

  const lineage: EvidenceLineage[] = [];
  const allEntries = Object.values(weekData.houses).flatMap(h => h.entries);
  
  for (const id of entryIds) {
    const entry = allEntries.find(e => e.id === id);
    if (entry) {
      lineage.push({
        sourceType: 'nourish_csv',
        sourceId: entry.id,
        timestamp: entry.date, // Best available timestamp from entry
      });
    }
  }
  
  return lineage;
}
