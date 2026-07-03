import type { CommunicationRecord, OutputDraft } from './types';
import { getStorage, uid } from './storage';
import { logAuditAction } from './audit';

const OUTPUT_DRAFTS_KEY = 'hc-operational-output-drafts-v1';
const COMMUNICATIONS_KEY = 'hc-operational-communications-v1';

function loadArray<T>(key: string): T[] {
  try {
    const raw = getStorage().getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveArray<T>(key: string, items: T[]) {
  getStorage().setItem(key, JSON.stringify(items));
}

export function loadOutputDrafts(): OutputDraft[] {
  return loadArray<OutputDraft>(OUTPUT_DRAFTS_KEY);
}

export function saveOutputDraft(draft: OutputDraft): OutputDraft {
  const drafts = loadOutputDrafts().filter(item => item.id !== draft.id);
  const next = [draft, ...drafts].slice(0, 200);
  saveArray(OUTPUT_DRAFTS_KEY, next);
  logAuditAction('document_generated', `${draft.type.replace(/_/g, ' ')} draft created`, {
    outputDraftId: draft.id,
    type: draft.type,
    resident: draft.resident,
    house: draft.house,
    sourceEvidenceIds: draft.sourceEvidence.map(item => item.id),
    reviewRequired: draft.reviewRequired,
  });
  return draft;
}

export function loadCommunicationRecords(): CommunicationRecord[] {
  return loadArray<CommunicationRecord>(COMMUNICATIONS_KEY);
}

export function saveCommunicationRecord(record: CommunicationRecord): CommunicationRecord {
  const records = loadCommunicationRecords().filter(item => item.id !== record.id);
  const next = [record, ...records].slice(0, 300);
  saveArray(COMMUNICATIONS_KEY, next);
  logAuditAction('export_created', `${record.recipientType} communication ${record.status}`, {
    communicationRecordId: record.id,
    outputDraftId: record.outputDraftId,
    recipientType: record.recipientType,
    resident: record.resident,
    house: record.house,
    sourceEvidenceIds: record.sourceEvidenceIds,
  });
  return record;
}

export function saveCommunicationRecordForDraft(draft: OutputDraft, input: {
  status?: CommunicationRecord['status'];
  summary?: string;
  recipientName?: string;
  createdAt?: string;
} = {}): CommunicationRecord {
  return saveCommunicationRecord({
    id: `comm-${uid()}`,
    resident: draft.resident,
    house: draft.house,
    recipientType: draft.recipientType,
    recipientName: input.recipientName,
    status: input.status || 'draft',
    createdAt: input.createdAt || new Date().toISOString(),
    sourceEvidenceIds: draft.sourceEvidence.map(item => item.id),
    outputDraftId: draft.id,
    summary: input.summary || draft.text.split('\n').find(Boolean) || `${draft.type.replace(/_/g, ' ')} draft`,
  });
}

export function clearOperationalOutputRecords() {
  const storage = getStorage();
  storage.removeItem(OUTPUT_DRAFTS_KEY);
  storage.removeItem(COMMUNICATIONS_KEY);
}
