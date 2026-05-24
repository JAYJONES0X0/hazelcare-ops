import { loadWeekData } from './storage';

export type AuditAction = 
  | 'document_generated' 
  | 'data_imported' 
  | 'data_exported' 
  | 'action_completed' 
  | 'incident_resolved' 
  | 'compliance_updated'
  | 'settings_changed'
  | 'review_signed_off';

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
  metadata?: Record<string, any>;
  lineage?: EvidenceLineage[];
}

const AUDIT_KEY = 'hc-audit-trail-v1';

export function loadAuditTrail(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logAuditAction(action: AuditAction, details: string, metadata?: Record<string, any>, lineage?: EvidenceLineage[]) {
  const trail = loadAuditTrail();
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    userId: 'current-user', // Placeholder for local-first identity
    details,
    metadata,
    lineage,
  };
  
  trail.unshift(entry);
  // Keep last 1000 entries to prevent localStorage bloat
  const limitedTrail = trail.slice(0, 1000);
  localStorage.setItem(AUDIT_KEY, JSON.stringify(limitedTrail));
  
  window.dispatchEvent(new CustomEvent('hc-audit-updated', { detail: entry }));
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
