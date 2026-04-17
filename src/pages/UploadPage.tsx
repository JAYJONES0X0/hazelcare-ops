import { useState, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { loadClients, clearClientData, clearStaffNotes, purgeSystemData } from '../lib/client-store';
import { clearWeekData, clearActions, clearIncidents, loadWeekData, loadActions, loadIncidents, exportOpsSnapshot, importOpsSnapshot, mergeWeekSummaries, uid } from '../lib/storage';
import { TEMPLATES } from '../lib/types';
import type { WeekSummary, TemplateType } from '../lib/types';
import type { FullClient } from '../lib/client-store';
import type { Page } from '../App';
import type { NormalizedImportEnvelope, ImportTarget } from '../lib/import-intelligence';
import { emptyEnvelope } from '../lib/import-intelligence';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { routeImport, type ClientMode } from '../lib/import-router';
import type { MonitoringFilters } from '../lib/staff-monitoring';
import {
  downloadText,
  careEntriesToEvidenceCsv,
  buildCoordinatorReadme,
  buildCoordinatorEvidenceHtml,
  buildCoordinatorPackMeta,
  buildSnapshotForPack,
  filterEntriesForCoordinatorPack,
} from '../lib/coordinator-export-pack';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type UploadDetectedType = 'diary' | 'admission' | 'support-plan' | 'unknown';
type Step = 'choose' | 'extracting' | 'preview' | 'done' | 'error';

interface Props {
  onDataParsed: (data: WeekSummary) => void;
  setPage: (p: Page) => void;
}

interface PreviewData {
  type: UploadDetectedType;
  fileName: string;
  envelope: NormalizedImportEnvelope;
  confidence: number;
  // diary
  entryCount?: number;
  dateRange?: string;
  houseCount?: number;
  clientCount?: number;
  redFlags?: number;
  amberFlags?: number;
  // admission / support plan
  clientName?: string;
  dob?: string;
  nhs?: string;
  domainsDetected?: number;
  supportNeeds?: number;
  warnings?: string[];
  unmappedFields?: string[];
}

interface ZipGuidanceRow {
  id: string;
  fileName: string;
  detectedType: UploadDetectedType;
  parserProfile: string;
  confidence: number;
  suggestedTargets: ImportTarget[];
  suggestedClient: string;
  envelope: NormalizedImportEnvelope;
  selectedTarget: ImportTarget | 'skip';
  clientMode: ClientMode;
  selectedClientId: string | null;
  include: boolean;
  parseError?: string;
}

interface ImportGap {
  id: string;
  label: string;
  why: string;
  recommendedSource: string;
  critical: boolean;
}

interface SourceBasketItem {
  id: string;
  fileName: string;
  envelope: NormalizedImportEnvelope;
  confidence: number;
}

type IntentPreset = 'custom' | 'risk_quality_all_houses' | 'client_docs_plus_risk' | 'incident_governance_pack';

// ─── PDF text extraction with Y-position newline reconstruction ───────────────
async function extractPdfText(file: File, onProgress?: (p: number) => void): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(Math.round((i / pdf.numPages) * 100));
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let pageText = '';
    for (const item of content.items as any[]) {
      if (!item.str) continue;
      const y = item.transform ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        pageText += '\n';
      } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
        pageText += ' ';
      }
      pageText += item.str;
      lastY = y;
    }
    fullText += pageText + '\n';
  }

  return fullText;
}

// ─── DOCX text extraction via mammoth ─────────────────────────────────────────
async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function inferClientFromFileName(fileName: string): string {
  const base = fileName.split('/').pop() || fileName;
  const cleaned = base.replace(/\.[^.]+$/, '');
  // Try to extract a likely name pattern (two capitalised words)
  const match = cleaned.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
  return match ? match[1] : 'Unclear';
}

/** Extract date from CarePlanner filename patterns like:
 *  ClientRoster-from-13_04_2026-to-13_04_2026.csv
 *  Client-diary (19).csv
 *  client_roster_2026-04-13.csv
 * Returns [DD, MM, YYYY] if found, or null if no date detected */
function extractDateFromFileName(fileName: string): { dateFrom: string; dateTo: string } | null {
  const base = (fileName.split('/').pop() || fileName).replace(/\.[^.]+$/, '');

  // Pattern 1: ClientRoster-from-DD_MM_YYYY-to-DD_MM_YYYY
  const m1 = base.match(/from-(\d{2})[_-](\d{2})[_-](\d{4})/);
  if (m1) {
    const d = `${m1[1]}/${m1[2]}/${m1[3]}`;
    const m2 = base.match(/to[_-](\d{2})[_-](\d{2})[_-](\d{4})/);
    const d2 = m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : d;
    return { dateFrom: d, dateTo: d2 };
  }

  // Pattern 2: client_roster_YYYY-MM-DD or diary_YYYY-MM-DD
  const m3 = base.match(/(\d{4})[_-](\d{2})[_-](\d{2})/);
  if (m3) {
    return { dateFrom: `${m3[3]}/${m3[2]}/${m3[1]}`, dateTo: `${m3[3]}/${m3[2]}/${m3[1]}` };
  }

  return null;
}

function findClientIdByNameHint(nameHint: string): string | null {
  const hint = (nameHint || '').trim().toLowerCase();
  if (!hint || hint === 'unclear') return null;
  const clients = loadClients();
  const direct = clients.find((c) => c.name.trim().toLowerCase() === hint);
  if (direct) return direct.id;
  const partial = clients.find((c) => c.name.trim().toLowerCase().includes(hint) || hint.includes(c.name.trim().toLowerCase()));
  return partial?.id || null;
}

async function extractZipGuidance(file: File, onProgress?: (p: number) => void): Promise<{ combined: string; rows: ZipGuidanceRow[]; readErrors: string[] }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const supported = entries.filter((entry) => /\.(txt|csv|tsv|md|pdf|docx)$/i.test(entry.name));
  if (!supported.length) return { combined: '', rows: [], readErrors: [] };

  let combined = '';
  const rows: ZipGuidanceRow[] = [];
  const readErrors: string[] = [];
  for (let i = 0; i < supported.length; i += 1) {
    const entry = supported[i];
    const displayName = entry.name.split('/').pop() || entry.name;
    try {
      const ext = entry.name.split('.').pop()?.toLowerCase();
      let text = '';

      if (ext === 'pdf' || ext === 'docx') {
        const blob = await entry.async('blob');
        const nestedFile = new File([blob], displayName);
        text = ext === 'pdf' ? await extractPdfText(nestedFile) : await extractDocxText(nestedFile);
      } else {
        text = await entry.async('text');
      }

      if (text.trim()) {
        combined += `\n\n--- FILE: ${displayName} ---\n${text}`;
        const envelope = buildEnvelopeFromRaw(displayName, text);
        rows.push({
          id: `${entry.name}-${i}`,
          fileName: displayName,
          detectedType: envelope.source.detectedType,
          parserProfile: envelope.source.parserProfile,
          confidence: envelope.source.confidence,
          suggestedTargets: envelope.suggestedTargets,
          suggestedClient: envelope.clientCandidates[0]?.name || inferClientFromFileName(displayName),
          envelope,
          selectedTarget: envelope.suggestedTargets[0] || 'skip',
          clientMode: 'global',
          selectedClientId: findClientIdByNameHint(envelope.clientCandidates[0]?.name || inferClientFromFileName(displayName)),
          include: true,
        });
      } else {
        readErrors.push(`${displayName}: no readable text detected`);
      }
    } catch (err: any) {
      const msg = err?.message || 'read failed';
      readErrors.push(`${displayName}: ${msg}`);
      rows.push({
        id: `${entry.name}-${i}`,
        fileName: displayName,
        detectedType: 'unknown',
        parserProfile: 'read-error',
        confidence: 0,
        suggestedTargets: [],
        suggestedClient: inferClientFromFileName(displayName),
        envelope: buildEnvelopeFromRaw(displayName, ''),
        selectedTarget: 'skip',
        clientMode: 'global',
        selectedClientId: null,
        include: false,
        parseError: msg,
      });
    }
    if (onProgress) onProgress(Math.round(((i + 1) / supported.length) * 100));
  }

  return { combined: combined.trim(), rows, readErrors };
}

// ─── Build preview data from normalized envelope ──────────────────────────────
function buildPreview(envelope: NormalizedImportEnvelope): PreviewData {
  const base: PreviewData = {
    type: envelope.source.detectedType,
    fileName: envelope.source.fileName,
    envelope,
    confidence: envelope.source.confidence,
    warnings: envelope.warnings,
    unmappedFields: envelope.unmappedFields,
  };

  if (envelope.weekSummary) {
    base.entryCount = envelope.weekSummary.totalEntries;
    base.dateRange = envelope.weekSummary.dateFrom && envelope.weekSummary.dateTo
      ? `${envelope.weekSummary.dateFrom} to ${envelope.weekSummary.dateTo}`
      : 'Dates not detected';
    base.houseCount = Object.keys(envelope.weekSummary.houses).length;
    base.clientCount = envelope.weekSummary.clients.length;
    base.redFlags = envelope.weekSummary.allFlags.red.length;
    base.amberFlags = envelope.weekSummary.allFlags.amber.length;
  }

  if (envelope.admission) {
    base.clientName = envelope.admission.client.name || 'Not detected';
    base.dob = envelope.admission.client.dob || 'Not detected';
    base.nhs = envelope.admission.client.nhs || 'Not detected';
    base.domainsDetected = envelope.admission.carePlan.domains.filter(d => d.enabled).length;
  }

  if (envelope.supportPlan) {
    base.supportNeeds = envelope.supportPlan.needs.length;
    base.clientName = base.clientName || envelope.clientCandidates[0]?.name || 'Not detected from text';
  }

  return base;
}

function detectImportGaps(envelope: NormalizedImportEnvelope, targets: ImportTarget[]): ImportGap[] {
  const gaps: ImportGap[] = [];
  const needsReports = targets.includes('reports');
  const needsTemplates = targets.includes('templates');
  const needsClientDocs = targets.includes('client-docs');
  const wantsDocsOrTemplates = needsClientDocs || needsTemplates;

  const clientName = envelope.clientCandidates[0]?.name || envelope.admission?.client.name || '';
  const hasIdentity = !!clientName.trim();

  if ((needsReports || needsTemplates) && !envelope.weekSummary) {
    gaps.push({
      id: 'missing-week-summary',
      label: 'No weekly summary detected',
      why: 'Reports and diary-based templates need structured entries and dates.',
      recommendedSource: 'Upload a diary export (CSV/PDF/TXT) with dated entries.',
      critical: needsReports,
    });
  }

  if (wantsDocsOrTemplates && !hasIdentity) {
    gaps.push({
      id: 'missing-client-identity',
      label: 'Person identity not detected',
      why: 'Care, risk, and PBS outputs must be attached to the correct person.',
      recommendedSource: 'Add an admission/care-plan document with full name, DOB, or NHS number.',
      critical: true,
    });
  }

  if (needsClientDocs && !envelope.admission && !envelope.supportPlan) {
    gaps.push({
      id: 'missing-care-source',
      label: 'No care/support source detected',
      why: 'Client docs require support needs, risks, or care-plan sections.',
      recommendedSource: 'Add emergency admission pack, support plan, or assessment notes.',
      critical: true,
    });
  }

  return gaps;
}

function mergeEnvelopes(envelopes: NormalizedImportEnvelope[]): NormalizedImportEnvelope {
  if (!envelopes.length) return emptyEnvelope('Batch import', '');
  if (envelopes.length === 1) return envelopes[0];

  const merged = emptyEnvelope('Batch import', envelopes.map((e) => e.source.fileName).join(', '));
  merged.source.parserProfile = 'batch-merge';
  merged.source.detectedType = 'unknown';
  merged.source.confidence = Math.max(...envelopes.map((e) => e.source.confidence));
  merged.rawText = envelopes.map((e) => e.rawText).filter(Boolean).join('\n\n');

  for (const env of envelopes) {
    if (merged.source.detectedType === 'unknown' && env.source.detectedType !== 'unknown') {
      merged.source.detectedType = env.source.detectedType;
    }
    if (!merged.admission && env.admission) merged.admission = env.admission;
    if (!merged.supportPlan && env.supportPlan) merged.supportPlan = env.supportPlan;
    if (env.weekSummary) merged.weekSummary = mergeWeekSummaries(merged.weekSummary, env.weekSummary);
    merged.diaryEntries.push(...env.diaryEntries);
    merged.clientCandidates.push(...env.clientCandidates);
    merged.warnings.push(...env.warnings);
    merged.unmappedFields.push(...env.unmappedFields);
    merged.suggestedTargets.push(...env.suggestedTargets);
  }

  // Merge date range from filenames when weekSummary has no dateFrom/dateTo
  if (merged.weekSummary && (!merged.weekSummary.dateFrom || !merged.weekSummary.dateTo)) {
    for (const env of envelopes) {
      if (env.weekSummary?.dateFrom && env.weekSummary.dateFrom !== merged.weekSummary.dateFrom) {
        merged.weekSummary.dateFrom = env.weekSummary.dateFrom;
      }
      if (env.weekSummary?.dateTo && env.weekSummary.dateTo !== merged.weekSummary.dateTo) {
        merged.weekSummary.dateTo = env.weekSummary.dateTo;
      }
    }
    // Also try extracting from filenames directly if still missing
    for (const env of envelopes) {
      const extracted = extractDateFromFileName(env.source.fileName);
      if (extracted) {
        if (!merged.weekSummary.dateFrom) merged.weekSummary.dateFrom = extracted.dateFrom;
        if (!merged.weekSummary.dateTo) merged.weekSummary.dateTo = extracted.dateTo;
      }
    }
  }

  merged.clientCandidates = merged.clientCandidates.filter((c, idx, arr) => {
    const key = `${(c.name || '').toLowerCase()}|${c.dob || ''}|${c.nhs || ''}`;
    return arr.findIndex((x) => `${(x.name || '').toLowerCase()}|${x.dob || ''}|${x.nhs || ''}` === key) === idx;
  });
  merged.warnings = Array.from(new Set(merged.warnings));
  merged.unmappedFields = Array.from(new Set(merged.unmappedFields));
  merged.suggestedTargets = Array.from(new Set(merged.suggestedTargets));

  return merged;
}

// ─── TYPE CONFIG ──────────────────────────────────────────────────────────────
const TYPE_INFO: Record<Exclude<UploadDetectedType, 'unknown'>, { label: string; desc: string; icon: string; accepts: string; help: string; destination: string }> = {
  diary: {
    label: 'Weekly Diary',
    desc: 'Universal diary export — populates dashboard, briefing, and all house views',
    icon: '📊',
    accepts: '.csv,.txt,.pdf',
    help: 'Export CSV from CarePlanner or similar',
    destination: 'Briefing',
  },
  admission: {
    label: 'Person Import',
    desc: 'Emergency Admission Pack or Care Plan — creates a new client profile with all 21 premium care domains',
    icon: '👤',
    accepts: '.pdf,.txt',
    help: 'Reports → Emergency Admission Pack → PDF',
    destination: 'Client Documents',
  },
  'support-plan': {
    label: 'Support Plan',
    desc: 'Council or funding authority support plan — imports needs, risks, and support strategies',
    icon: '📋',
    accepts: '.docx,.txt,.pdf',
    help: 'Usually received as .docx from the local authority',
    destination: 'Client Documents',
  },
};

function CoordinatorExportCard({ weekData }: { weekData: WeekSummary }) {
  const houseKeys = Object.keys(weekData.houses).sort();
  const [house, setHouse] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(weekData.dateFrom || '');
  const [dateTo, setDateTo] = useState(weekData.dateTo || '');
  const [typeFilter, setTypeFilter] = useState('');

  function runCoordinatorPack() {
    const filters: MonitoringFilters = {
      house: house as MonitoringFilters['house'],
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
    };
    const snapshot = buildSnapshotForPack(weekData, filters);
    const entries = filterEntriesForCoordinatorPack(weekData, filters, typeFilter);
    const meta = buildCoordinatorPackMeta(snapshot, 'upload-hub', {
      typeFilter: typeFilter.trim() || undefined,
      entryCount: entries.length,
    });
    const day = new Date().toISOString().slice(0, 10);
    downloadText(`hazelcare-coordinator-evidence-${day}.csv`, careEntriesToEvidenceCsv(entries), 'text/csv;charset=utf-8');
    downloadText(`hazelcare-coordinator-readme-${day}.txt`, buildCoordinatorReadme(meta), 'text/plain;charset=utf-8');
    downloadText(`hazelcare-coordinator-evidence-${day}.html`, buildCoordinatorEvidenceHtml(entries, meta), 'text/html;charset=utf-8');
  }

  return (
    <div className="glass border border-hc-teal/30 rounded-[2rem] p-6 mb-8 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-black text-white tracking-tighter uppercase text-shimmer">Coordinator evidence pack</h2>
          <p className="text-[11px] text-hc-muted mt-1 max-w-xl leading-relaxed">
            Evidence-grade CSV (full text + ids), readme with next-export hints from your current registry, and printable HTML — same shape as Staff Intelligence exports. Filter by house, dates, and optional diary type substring (e.g. <span className="text-hc-teal-light">1:1</span>,{' '}
            <span className="text-hc-teal-light">handover</span>).
          </p>
        </div>
        <button
          type="button"
          onClick={runCoordinatorPack}
          className="shrink-0 px-5 py-3 rounded-xl btn-gradient text-[10px] font-black uppercase tracking-wide"
        >
          Download all 3 files
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5 text-[10px] font-bold text-hc-muted uppercase tracking-wider">
          House
          <select
            value={house}
            onChange={(e) => setHouse(e.target.value)}
            className="glass border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white bg-transparent"
          >
            <option value="all">All houses</option>
            {houseKeys.map((h) => (
              <option key={h} value={h}>
                {weekData.houses[h]?.name || h}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[10px] font-bold text-hc-muted uppercase tracking-wider">
          Date from
          <input
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="glass border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-hc-muted/40"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[10px] font-bold text-hc-muted uppercase tracking-wider">
          Date to
          <input
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="glass border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-hc-muted/40"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[10px] font-bold text-hc-muted uppercase tracking-wider">
          Type contains (optional)
          <input
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder="e.g. 1:1, handover"
            className="glass border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-hc-muted/40"
          />
        </label>
      </div>
    </div>
  );
}

function DataManagerProp({ weekData, clients, onClearEverything, onClearType }: {
  weekData: WeekSummary | null;
  clients: FullClient[];
  onClearEverything: () => void;
  onClearType: (type: 'diary' | 'actions' | 'incidents' | 'clients' | 'notes') => void;
}) {
  const restoreRef = useRef<HTMLInputElement>(null);
  const actions = loadActions();
  const incidents = loadIncidents();
  const notes = (() => { try { return JSON.parse(localStorage.getItem('hazelcare-staff-notes') || '[]'); } catch { return []; } })();

  function handleExportBackup() {
    const snapshot = exportOpsSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hazelcare-ops-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestoreBackup(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = importOpsSnapshot(parsed);
      if (!result.ok) {
        alert(`Restore failed: ${result.error}`);
        return;
      }
      alert('Backup restored successfully. Reloading...');
      window.location.reload();
    } catch {
      alert('Restore failed: Invalid backup file.');
    }
  }

  const datasets = [
    { key: 'diary', label: 'Diary & Briefing', present: !!weekData, desc: weekData ? `${weekData.totalEntries} entries, ${weekData.dateFrom} – ${weekData.dateTo}` : 'Local registry empty' },
    { key: 'clients', label: 'People & Support Plans', present: clients.length > 0, desc: clients.length > 0 ? `${clients.length} people configured` : 'Local registry empty' },
    { key: 'actions', label: 'Action Tracker', present: actions.length > 0, desc: actions.length > 0 ? `${actions.length} tasks logged` : 'Local registry empty' },
    { key: 'incidents', label: 'Incident Logs', present: incidents.length > 0, desc: incidents.length > 0 ? `${incidents.length} events recorded` : 'Local registry empty' },
    { key: 'notes', label: 'Staff Notes', present: notes.length > 0, desc: notes.length > 0 ? `${notes.length} saved notes` : 'Local registry empty' },
  ];
  if (!datasets[0].present) datasets[0].desc = 'Session empty — re-upload diary export';

  return (
    <div className="glass border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden mt-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-white tracking-tighter uppercase text-shimmer">Stored Intelligence</h2>
          <p className="text-[10px] font-bold text-hc-muted uppercase tracking-[0.2em] mt-1 opacity-60">Manage local care datasets and privacy</p>
        </div>
        {datasets.some(d => d.present) && (
          <button onClick={() => { if (confirm('Delete ALL data from this device?')) onClearEverything(); }}
            className="text-[9px] font-black text-flag-red hover:text-white uppercase tracking-[0.2em] px-4 py-2 glass-light border border-flag-red/20 rounded-xl transition-all hover:bg-flag-red/20">
            Purge All Data
          </button>
        )}
      </div>

      <div className="space-y-3">
        {datasets.map(d => (
          <div key={d.key} className={`glass-light border border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:bg-white/[0.02] transition-all ${!d.present && 'opacity-40'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${d.present ? 'bg-flag-green glow-green' : 'bg-white/5'}`} />
              <div>
                <div className="text-xs font-black text-white uppercase tracking-tight">{d.label}</div>
                <div className="text-[10px] text-hc-muted">{d.desc}</div>
              </div>
            </div>
            {d.present && (
              <button onClick={() => { if (confirm(`Clear ${d.label}?`)) onClearType(d.key as any); }} 
                className="text-[9px] font-black text-hc-muted hover:text-flag-red uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Clear</button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-3">
        <button
          onClick={handleExportBackup}
          className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2.5 glass-light border border-hc-teal/30 text-hc-teal-light rounded-xl transition-all hover:bg-hc-teal/10"
        >
          Export Persistent Backup
        </button>
        <button
          onClick={() => restoreRef.current?.click()}
          className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2.5 glass-light border border-white/10 text-hc-muted hover:text-white rounded-xl transition-all hover:bg-white/5"
        >
          Restore Backup
        </button>
        <input
          ref={restoreRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleRestoreBackup(file);
            e.currentTarget.value = '';
          }}
        />
      </div>
      <div className="mt-3 text-[10px] text-hc-muted leading-relaxed">
        Backups include people, actions, incidents, and saved notes. Diary/briefing data is session-only to avoid browser storage failures, so re-upload the source export when needed.
      </div>
    </div>
  );
}

export function UploadPage({ onDataParsed, setPage }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<ImportTarget[]>([]);
  const [templateMode, setTemplateMode] = useState<'all' | 'specific'>('all');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<TemplateType[]>([]);
  const [clientMode, setClientMode] = useState<ClientMode>('global');
  const [zipGuidance, setZipGuidance] = useState<ZipGuidanceRow[]>([]);
  const [zipFilter, setZipFilter] = useState<'all' | 'needs-decision' | 'will-create' | 'failed-last'>('all');
  const [zipSearch, setZipSearch] = useState('');
  const [zipBulkTarget, setZipBulkTarget] = useState<ImportTarget | 'skip'>('client-docs');
  const [zipBulkClientMode, setZipBulkClientMode] = useState<ClientMode>('global');
  const [zipBulkClientId, setZipBulkClientId] = useState<string>('');
  const [zipPendingCreateRows, setZipPendingCreateRows] = useState<ZipGuidanceRow[] | null>(null);
  const [zipRunSummary, setZipRunSummary] = useState<{ total: number; success: number; failed: number; failedIds: string[]; nextPage: Page } | null>(null);
  const [showZipGuidance, setShowZipGuidance] = useState(false);
  const [zipReadErrors, setZipReadErrors] = useState<string[]>([]);
  const [importGaps, setImportGaps] = useState<ImportGap[]>([]);
  const [pendingConfirmDestination, setPendingConfirmDestination] = useState<Page | undefined>(undefined);
  const [pendingConfirmBypassGaps, setPendingConfirmBypassGaps] = useState(false);
  const [sourceBasket, setSourceBasket] = useState<SourceBasketItem[]>([]);
  const [intentPreset, setIntentPreset] = useState<IntentPreset>('custom');
  const fileRef = useRef<HTMLInputElement>(null);

  const weekData = loadWeekData();
  const clients = loadClients();

  const selectedZipCount = zipGuidance.filter((r) => r.include).length;

  function applyIntentPreset(preset: IntentPreset) {
    setIntentPreset(preset);
    if (preset === 'risk_quality_all_houses') {
      setSelectedTargets(['reports', 'templates']);
      setTemplateMode('specific');
      setSelectedTemplateIds(['quality_meeting', 'daily_quality', 'incident_report', 'safeguarding']);
      setClientMode('global');
      return;
    }
    if (preset === 'client_docs_plus_risk') {
      setSelectedTargets(['client-docs', 'templates']);
      setTemplateMode('specific');
      setSelectedTemplateIds(['incident_report', 'safeguarding']);
      setClientMode('auto');
      return;
    }
    if (preset === 'incident_governance_pack') {
      setSelectedTargets(['reports', 'templates']);
      setTemplateMode('specific');
      setSelectedTemplateIds(['incident_report', 'quality_meeting', 'handover', 'medication_audit']);
      setClientMode('global');
      return;
    }
  }

  function refreshPreviewFromBasket(nextBasket: SourceBasketItem[]) {
    if (!nextBasket.length) return;
    const combined = mergeEnvelopes(nextBasket.map((item) => item.envelope));
    const previewData = buildPreview(combined);
    const defaults: ImportTarget[] = combined.suggestedTargets.length ? combined.suggestedTargets : ['reports'];
    setPreview(previewData);
    setSelectedTargets(defaults);
    setStep('preview');
  }

  function rowWillCreatePerson(row: ZipGuidanceRow): boolean {
    if (row.selectedTarget === 'skip') return false;
    if (!(row.selectedTarget === 'client-docs' || row.selectedTarget === 'templates')) return false;
    if (row.clientMode === 'specific') return false;
    const candidateName = row.envelope.clientCandidates[0]?.name || row.suggestedClient;
    if (!candidateName || candidateName.toLowerCase() === 'unclear') return false;
    const matched = findClientIdByNameHint(candidateName);
    return !matched;
  }

  function rowNeedsDecision(row: ZipGuidanceRow): boolean {
    if (!row.include || row.selectedTarget === 'skip') return false;
    if (row.clientMode === 'specific' && !row.selectedClientId) return true;
    if (row.clientMode === 'auto' && row.confidence < 0.75) return true;
    return false;
  }

  function applyZipRows(rows: ZipGuidanceRow[]) {
    const failedIds: string[] = [];
    let success = 0;
    let sawClientDocs = false;
    let sawTemplates = false;
    let sawReports = false;
    const messages: string[] = [];
    const warnings: string[] = [];

    for (const row of rows) {
      const target = row.selectedTarget as ImportTarget;
      const result = routeImport(row.envelope, {
        targets: [target],
        clientMode: row.clientMode,
        selectedClientId: row.selectedClientId,
        selectedTemplateIds: target === 'templates'
          ? (templateMode === 'all' ? [] : selectedTemplateIds)
          : [],
      });

      if (result.ok) {
        success += 1;
        messages.push(`${row.fileName}: ${result.messages.join(' ') || 'Imported.'}`);
        if (target === 'client-docs') sawClientDocs = true;
        if (target === 'templates') sawTemplates = true;
        if (target === 'reports') sawReports = true;
        if (target === 'reports' && row.envelope.weekSummary) {
          const mergedWeekData = loadWeekData();
          if (mergedWeekData) onDataParsed(mergedWeekData);
        }
      } else {
        failedIds.push(row.id);
        warnings.push(`${row.fileName}: ${result.warnings.join(' | ') || 'Import failed.'}`);
      }
    }

    const nextPage: Page = sawClientDocs ? 'client-docs' : (sawTemplates ? 'templates' : (sawReports ? 'reports' : 'upload'));
    setZipRunSummary({
      total: rows.length,
      success,
      failed: failedIds.length,
      failedIds,
      nextPage,
    });

    if (success === 0) {
      setErrorMsg(warnings.join('\n') || 'ZIP import failed.');
      setStep('error');
      return;
    }

    setResultMsg(
      `Processed ${rows.length} file(s): ${success} applied, ${failedIds.length} failed.` +
      (warnings.length ? ` Warnings: ${warnings.slice(0, 3).join(' | ')}` : '')
    );
    setStep('done');
  }

  const handleClearEverything = () => {
    purgeSystemData();
    window.location.reload();
  };

  const handleClearType = (type: any) => {
    if (type === 'diary') clearWeekData();
    else if (type === 'clients') clearClientData();
    else if (type === 'actions') clearActions();
    else if (type === 'incidents') clearIncidents();
    else if (type === 'notes') clearStaffNotes();
    window.location.reload();
  };

  // ─── Handle file drop or select ──────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setStep('extracting');
    setProgress(0);
    setErrorMsg('');

    try {
      let rawText = '';
      const ext = file.name.split('.').pop()?.toLowerCase();
      let zipRows: ZipGuidanceRow[] = [];

      if (ext === 'pdf') {
        rawText = await extractPdfText(file, setProgress);
      } else if (ext === 'docx') {
        rawText = await extractDocxText(file);
      } else if (ext === 'zip') {
        setSourceBasket([]);
        const zipData = await extractZipGuidance(file, setProgress);
        rawText = zipData.combined;
        zipRows = zipData.rows;
        setZipReadErrors(zipData.readErrors);
        setZipGuidance(zipRows);
      } else {
        rawText = await file.text();
        setZipReadErrors([]);
        setZipGuidance([]);
      }

      if (!rawText.trim()) {
        setErrorMsg('File appears empty or has no supported files. Use ZIP containing CSV/TXT/PDF/DOCX, or upload a direct export.');
        setStep('error');
        return;
      }

      // Yield before heavy parse — prevents browser freeze on large exports
      await new Promise<void>(res => setTimeout(res, 10));

      const envelope = buildEnvelopeFromRaw(file.name, rawText);
      const previewData = buildPreview(envelope);
      const targetUnion = ext === 'zip'
        ? Array.from(new Set(zipRows.flatMap((row) => row.suggestedTargets)))
        : envelope.suggestedTargets;
      if (ext !== 'zip') {
        const nextBasket = [...sourceBasket, { id: uid(), fileName: file.name, envelope, confidence: envelope.source.confidence }];
        setSourceBasket(nextBasket);
        refreshPreviewFromBasket(nextBasket);
      } else {
        setSelectedTargets(targetUnion.length ? targetUnion : (envelope.suggestedTargets.length ? envelope.suggestedTargets : ['reports']));
        setTemplateMode('all');
        setSelectedTemplateIds([]);
        setImportTargetClient(null);
        setPreview(previewData);
        setStep('preview');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMsg(`Failed to read file: ${err.message || 'Unknown error'}. Try a different format or paste the text manually.`);
      setStep('error');
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      // Process sequentially so basket/order and progress are predictable.
      await handleFile(file);
    }
  };

  // ─── Handle pasted text ──────────────────────────────────────────────────────
  const handlePaste = () => {
    if (!pasteText.trim()) return;
    setStep('extracting');
    setProgress(100);
    try {
      setZipGuidance([]);
      setZipReadErrors([]);
      const envelope = buildEnvelopeFromRaw('Pasted text', pasteText);
      const nextBasket = [...sourceBasket, { id: uid(), fileName: `Pasted text ${sourceBasket.length + 1}`, envelope, confidence: envelope.source.confidence }];
      setSourceBasket(nextBasket);
      refreshPreviewFromBasket(nextBasket);
    } catch (err: any) {
      setErrorMsg(`Failed to analyse pasted text: ${err?.message || 'Unknown error'}`);
      setStep('error');
    }
  };

  // ─── Confirm and process ─────────────────────────────────────────────────────
  const [targetClient, setImportTargetClient] = useState<string | null>(null);

  const handleConfirm = (destination?: Page, bypassGapGate = false) => {
    if (!preview) return;
    setErrorMsg('');

    if (zipGuidance.length > 0) {
      const selectedRows = zipGuidance.filter((row) => row.include && row.selectedTarget !== 'skip');
      if (!selectedRows.length) {
        setErrorMsg('Select at least one ZIP row to import.');
        return;
      }
      const createRows = selectedRows.filter((row) => rowWillCreatePerson(row));
      if (createRows.length > 0) {
        setZipPendingCreateRows(createRows);
        return;
      }
      applyZipRows(selectedRows);
      return;
    }

    if (!selectedTargets.length) {
      setErrorMsg('Select at least one output target.');
      setStep('error');
      return;
    }
    if (selectedTargets.includes('templates') && templateMode === 'specific' && selectedTemplateIds.length === 0) {
      setErrorMsg('Select at least one template or switch to "all templates".');
      setStep('error');
      return;
    }

    const gaps = detectImportGaps(preview.envelope, selectedTargets);
    if (!bypassGapGate && gaps.some((g) => g.critical)) {
      setImportGaps(gaps);
      setPendingConfirmDestination(destination);
      setPendingConfirmBypassGaps(true);
      return;
    }

    const result = routeImport(preview.envelope, {
      targets: selectedTargets,
      clientMode,
      selectedClientId: targetClient,
      selectedTemplateIds: selectedTargets.includes('templates')
        ? (templateMode === 'all' ? [] : selectedTemplateIds)
        : [],
    });

    if (!result.ok) {
      if (result.requiresManualClientSelection) {
        setClientMode('specific');
        setErrorMsg(result.warnings.join('\n') || 'Client match needs confirmation. Select a specific client and retry.');
        return;
      }
      setErrorMsg(result.warnings.join('\n') || 'Import failed.');
      setStep('error');
      return;
    }

    if (preview.envelope.weekSummary && selectedTargets.includes('reports')) {
      const mergedWeekData = loadWeekData();
      if (mergedWeekData) onDataParsed(mergedWeekData);
    }

    const target = destination || result.page;
    const warnings = result.warnings.length ? ` Warnings: ${result.warnings.join(' | ')}` : '';
    const manual = result.requiresManualClientSelection ? ' Client confidence is low; verify selected client.' : '';
    setResultMsg(`${result.messages.join(' ')}${manual}${warnings}`);
    setStep('done');
    setTimeout(() => setPage(target), 1500);
  };

  // ─── Reset ───────────────────────────────────────────────────────────────────
  const reset = () => {
    setStep('choose');
    setPreview(null);
    setProgress(0);
    setErrorMsg('');
    setPasteText('');
    setResultMsg('');
    setSelectedTargets([]);
    setTemplateMode('all');
    setSelectedTemplateIds([]);
    setClientMode('global');
    setImportTargetClient(null);
    setZipGuidance([]);
    setZipFilter('all');
    setZipSearch('');
    setZipBulkTarget('client-docs');
    setZipBulkClientMode('global');
    setZipBulkClientId('');
    setZipPendingCreateRows(null);
    setZipRunSummary(null);
    setShowZipGuidance(false);
    setZipReadErrors([]);
    setImportGaps([]);
    setPendingConfirmDestination(undefined);
    setPendingConfirmBypassGaps(false);
    setSourceBasket([]);
    setIntentPreset('custom');
  };

  const detectedInfo = preview && preview.type !== 'unknown'
    ? TYPE_INFO[preview.type]
    : { icon: '🧠', label: 'Unknown Source', desc: 'Manual routing required' };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-6 lg:p-10 w-full animate-in fade-in duration-700 scrollbar-thin max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-white mb-1 tracking-tighter text-shimmer">Import Hub</h1>
        <p className="text-hc-muted text-sm font-medium">Upload data from your provider or your local authority. We'll detect the format and route it to the right place.</p>
      </div>

      {/* ─── STEP: CHOOSE ─────────────────────────────────────────────────────── */}
      {step === 'choose' && (
        <>
          {/* What can you import */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {(Object.entries(TYPE_INFO) as [Exclude<UploadDetectedType, 'unknown'>, typeof TYPE_INFO['diary']][]).map(([key, info]) => (
              <div key={key} className="glass-light border border-white/5 rounded-2xl p-6 hover:border-hc-teal/30 transition-all group cursor-default">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{info.icon}</div>
                <div className="text-sm font-black text-white mb-1 uppercase tracking-tight">{info.label}</div>
                <p className="text-[11px] text-hc-muted leading-relaxed mb-3">{info.desc}</p>
                <div className="text-[9px] font-bold text-hc-teal-light/60 uppercase tracking-wider">{info.help}</div>
                <div className="mt-3 flex items-center gap-1.5 text-[9px] font-bold text-hc-muted/50 uppercase tracking-wider">
                  <span>→</span> <span>{info.destination}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`relative rounded-3xl border-2 border-dashed transition-all duration-500 mb-8 cursor-pointer group overflow-hidden active:scale-[0.99] ${
              dragOver ? 'border-hc-teal-light bg-hc-teal/10 shadow-2xl' : 'border-white/10 hover:border-hc-teal/40 glass shadow-xl'
            }`}
          >
            <div className="flex flex-col items-center justify-center py-16 px-8 pointer-events-none">
              <div className="w-20 h-20 rounded-2xl glass border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-hc-teal/40 transition-all shadow-xl">
                <svg className="w-10 h-10 text-hc-teal-light/40 group-hover:text-hc-teal-light transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
              </div>
              <div className="text-sm font-bold text-white/80 group-hover:text-white mb-2">Drop any file here, or click to browse</div>
              <div className="text-[11px] text-hc-muted/50">CSV, PDF, DOCX, TXT, or ZIP bundle — we'll auto-detect the format</div>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept=".txt,.vtt,.csv,.tsv,.md,.pdf,.docx,.zip,application/zip" className="hidden"
            onChange={(e) => { if (e.target.files?.length) void handleFiles(e.target.files); }} />

          {/* Paste option */}
          <details className="mb-8 group/details" open={showPaste} onToggle={(e) => setShowPaste((e.target as HTMLDetailsElement).open)}>
            <summary className="text-[11px] font-bold text-hc-muted cursor-pointer hover:text-hc-teal-light select-none list-none flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 w-fit transition-all">
              <span className="w-6 h-6 rounded-lg glass border border-white/10 flex items-center justify-center group-open/details:rotate-90 transition-transform">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </span>
              Or paste text manually
            </summary>
            <div className="mt-4 animate-in slide-in-from-top-2 duration-500">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste diary export, admission pack text, or support plan here..."
                className="w-full min-h-[200px] glass border border-white/10 rounded-2xl p-6 text-sm text-white font-mono leading-relaxed resize-y placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/40 scrollbar-thin"
              />
              <div className="flex justify-end mt-4">
                <button onClick={handlePaste} disabled={!pasteText.trim()}
                  className="px-8 py-3 btn-gradient rounded-xl text-[11px] font-bold uppercase tracking-wider disabled:opacity-20 hover:scale-105 active:scale-95 transition-all">
                  Analyse Text
                </button>
              </div>
            </div>
          </details>

          {weekData && (
            <CoordinatorExportCard
              key={`${weekData.totalEntries}-${weekData.dateFrom}-${weekData.dateTo}-${Object.keys(weekData.houses).sort().join(',')}`}
              weekData={weekData}
            />
          )}
        </>
      )}

      {/* ─── STEP: EXTRACTING ─────────────────────────────────────────────────── */}
      {step === 'extracting' && (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-2xl glass border border-hc-teal/40 flex items-center justify-center mb-6 shadow-xl glow-teal">
            <svg className="w-8 h-8 text-hc-teal-light animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-lg font-bold text-white mb-2">Reading file...</div>
          {progress > 0 && progress < 100 && (
            <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-hc-teal-light rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="text-[11px] text-hc-muted mt-2">{progress}% extracted</div>
        </div>
      )}

      {/* ─── STEP: PREVIEW ────────────────────────────────────────────────────── */}
      {step === 'preview' && preview && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Intelligence Layer: Decision Matrix */}
          <div className="glass border border-hc-teal/30 rounded-[2.5rem] p-8 mb-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-teal/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-hc-teal/10 border border-hc-teal/20 flex items-center justify-center shadow-lg glow-teal text-4xl">
                  {detectedInfo.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tighter uppercase text-shimmer">{detectedInfo.label} Identified</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
                    <p className="text-xs font-semibold text-hc-muted uppercase tracking-[0.08em] opacity-90">Profile: {preview.envelope.source.parserProfile} · Confidence {(preview.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-3 md:col-span-2">
                  <label className="section-header text-xs opacity-90 uppercase tracking-[0.08em] ml-1">Intent Preset</label>
                  <div className="glass-light border border-white/10 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <button onClick={() => applyIntentPreset('risk_quality_all_houses')} className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border ${intentPreset === 'risk_quality_all_houses' ? 'border-hc-teal/50 text-hc-teal-light bg-hc-teal/10' : 'border-white/10 text-hc-muted'}`}>Risk + Quality (All Houses)</button>
                    <button onClick={() => applyIntentPreset('client_docs_plus_risk')} className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border ${intentPreset === 'client_docs_plus_risk' ? 'border-hc-teal/50 text-hc-teal-light bg-hc-teal/10' : 'border-white/10 text-hc-muted'}`}>Client Docs + Risk</button>
                    <button onClick={() => applyIntentPreset('incident_governance_pack')} className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border ${intentPreset === 'incident_governance_pack' ? 'border-hc-teal/50 text-hc-teal-light bg-hc-teal/10' : 'border-white/10 text-hc-muted'}`}>Incident Governance</button>
                    <button onClick={() => applyIntentPreset('custom')} className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border ${intentPreset === 'custom' ? 'border-hc-teal/50 text-hc-teal-light bg-hc-teal/10' : 'border-white/10 text-hc-muted'}`}>Custom</button>
                  </div>
                </div>

                {/* Decision Row 1: Target Mapping */}
                <div className="space-y-3">
                  <label className="section-header text-xs opacity-90 uppercase tracking-[0.08em] ml-1">Output Targets</label>
                  <div className="glass-light border border-white/10 rounded-2xl p-4 group hover:border-hc-teal/30 transition-all space-y-2">
                    {(['templates', 'reports', 'client-docs'] as ImportTarget[]).map(target => (
                      <label key={target} className="flex items-center gap-2 text-sm text-white font-bold uppercase tracking-wide">
                        <input
                          type="checkbox"
                          checked={selectedTargets.includes(target)}
                          onChange={() =>
                            setSelectedTargets(prev =>
                              prev.includes(target) ? prev.filter(t => t !== target) : [...prev, target]
                            )
                          }
                        />
                        {target}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="section-header text-xs opacity-90 uppercase tracking-[0.08em] ml-1">Client Resolution</label>
                  <div className="glass-light border border-white/10 rounded-2xl p-4 space-y-3 group hover:border-hc-teal/30 transition-all">
                    <select
                      value={clientMode}
                      onChange={e => setClientMode(e.target.value as ClientMode)}
                      className="w-full bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2 text-sm font-black text-white focus:outline-none focus:border-hc-teal/50 shadow-inner uppercase"
                    >
                      <option value="auto">Auto Match</option>
                      <option value="specific">Specific Client</option>
                      <option value="global">Global Import</option>
                    </select>
                    <select
                      value={targetClient || ''}
                      onChange={e => setImportTargetClient(e.target.value || null)}
                      disabled={clientMode !== 'specific'}
                      className="w-full bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2 text-sm font-black text-white focus:outline-none focus:border-hc-teal/50 shadow-inner disabled:opacity-40"
                    >
                      <option value="">Select client...</option>
                      {loadClients().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {preview.clientName && (
                      <div className="text-sm text-hc-muted">
                        Detected candidate: <span className="text-white font-bold">{preview.clientName}</span>
                      </div>
                    )}
                    <div className="text-xs text-hc-muted/80 leading-relaxed">
                      Use <span className="text-white font-semibold">Global Import</span> to create/update from the dataset directly.
                      Use <span className="text-white font-semibold">Specific Client</span> when you want to pin import to one person.
                    </div>
                  </div>
                </div>

              </div>

              {!!sourceBasket.length && (
                <div className="mb-6 glass-light border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="section-header text-xs opacity-90 uppercase tracking-[0.08em]">Source Basket ({sourceBasket.length})</div>
                    <button
                      onClick={() => { setSourceBasket([]); setIntentPreset('custom'); }}
                      className="text-[10px] font-black uppercase tracking-wide text-flag-red"
                    >
                      Clear Basket
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                    {sourceBasket.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs border border-white/10 rounded-lg px-2.5 py-1.5">
                        <span className="text-hc-muted truncate">{item.fileName}</span>
                        <button
                          onClick={() => {
                            const next = sourceBasket.filter((x) => x.id !== item.id);
                            setSourceBasket(next);
                            if (next.length) refreshPreviewFromBasket(next);
                            else setStep('choose');
                          }}
                          className="text-flag-red font-black uppercase tracking-wide text-[10px]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTargets.includes('templates') && (
                <div className="mb-6 glass-light border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <label className="section-header text-xs opacity-90 uppercase tracking-[0.08em]">Template Inclusion</label>
                    <select
                      value={templateMode}
                      onChange={(e) => setTemplateMode(e.target.value as 'all' | 'specific')}
                      className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-1.5 text-sm font-black text-white focus:outline-none focus:border-hc-teal/50 shadow-inner uppercase"
                    >
                      <option value="all">Populate All Compatible Templates</option>
                      <option value="specific">Choose Specific Templates</option>
                    </select>
                  </div>
                  {templateMode === 'specific' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {TEMPLATES.map((tpl) => (
                        <label key={tpl.id} className="flex items-center gap-2 text-sm text-white font-bold uppercase tracking-wide">
                          <input
                            type="checkbox"
                            checked={selectedTemplateIds.includes(tpl.id)}
                            onChange={() =>
                              setSelectedTemplateIds((prev) =>
                                prev.includes(tpl.id)
                                  ? prev.filter((id) => id !== tpl.id)
                                  : [...prev, tpl.id]
                              )
                            }
                          />
                          {tpl.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!!preview.warnings?.length && (
                <div className="mb-6 text-[10px] text-flag-amber uppercase tracking-wider font-bold">
                  Warnings: {preview.warnings.join(' | ')}
                </div>
              )}
              {(() => {
                const gaps = detectImportGaps(preview.envelope, selectedTargets);
                if (!gaps.length) return null;
                return (
                  <div className="mb-6 border border-flag-amber/30 bg-flag-amber/10 rounded-xl px-4 py-3">
                    <div className="text-xs text-flag-amber font-black uppercase tracking-wide mb-2">
                      Missing data detected ({gaps.length})
                    </div>
                    <div className="space-y-2">
                      {gaps.map((gap) => (
                        <div key={gap.id} className="text-xs text-hc-muted">
                          <span className="text-white font-semibold">{gap.label}</span> - {gap.why} Suggested source: <span className="text-white">{gap.recommendedSource}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {!!zipGuidance.length && (
                <div className="mb-6 glass-light border border-hc-teal/30 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="section-header text-xs opacity-90 uppercase tracking-[0.08em]">ZIP Guidance</div>
                    <div className="text-xs text-hc-muted">{zipGuidance.length} files analysed</div>
                  </div>
                  <button
                    onClick={() => setShowZipGuidance((v) => !v)}
                    className="mb-3 w-full text-left px-3 py-2 rounded-lg border border-white/10 text-xs text-hc-muted hover:text-white hover:bg-white/5 transition-all"
                    title="Show or hide detailed per-file controls"
                  >
                    {showZipGuidance ? 'Hide detailed file controls' : 'Show detailed file controls'}
                  </button>
                  {!showZipGuidance && (
                    <div className="mb-3 text-xs text-hc-muted/80">
                      Expand to bulk edit and map each file quickly. Hover each row after expanding to confirm target and client mode.
                    </div>
                  )}
                  {showZipGuidance && (
                    <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setZipGuidance((prev) => prev.map((r) => ({ ...r, include: true })))}
                      className="px-3 py-1 rounded-lg border border-white/10 text-xs text-white"
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setZipGuidance((prev) => prev.map((r) => ({ ...r, include: false })))}
                      className="px-3 py-1 rounded-lg border border-white/10 text-xs text-hc-muted"
                    >
                      Select none
                    </button>
                    <span className="text-xs text-hc-muted">{selectedZipCount} selected</span>
                  </div>
                  <div className="mb-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                    <select
                      value={zipBulkTarget}
                      onChange={(e) => setZipBulkTarget(e.target.value as ImportTarget | 'skip')}
                      className="bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                    >
                      <option value="skip">Bulk target: Skip</option>
                      <option value="reports">Bulk target: Reports</option>
                      <option value="templates">Bulk target: Templates</option>
                      <option value="client-docs">Bulk target: Client Docs</option>
                    </select>
                    <select
                      value={zipBulkClientMode}
                      onChange={(e) => setZipBulkClientMode(e.target.value as ClientMode)}
                      className="bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                    >
                      <option value="global">Bulk mode: Global</option>
                      <option value="auto">Bulk mode: Auto</option>
                      <option value="specific">Bulk mode: Specific</option>
                    </select>
                    <select
                      value={zipBulkClientId}
                      onChange={(e) => setZipBulkClientId(e.target.value)}
                      disabled={zipBulkClientMode !== 'specific'}
                      className="bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white disabled:opacity-40"
                    >
                      <option value="">Bulk client...</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                      onClick={() => {
                        setZipGuidance((prev) => prev.map((r) => r.include ? {
                          ...r,
                          selectedTarget: zipBulkTarget,
                          clientMode: zipBulkClientMode,
                          selectedClientId: zipBulkClientMode === 'specific' ? (zipBulkClientId || null) : r.selectedClientId,
                        } : r));
                      }}
                      className="px-3 py-1 rounded-lg border border-hc-teal/40 text-xs text-hc-teal-light"
                    >
                      Apply to selected
                    </button>
                    <input
                      value={zipSearch}
                      onChange={(e) => setZipSearch(e.target.value)}
                      placeholder="Search file/client"
                      className="bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white placeholder:text-hc-muted/60"
                    />
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {(['all', 'needs-decision', 'will-create', 'failed-last'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setZipFilter(f)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${
                          zipFilter === f ? 'border-hc-teal/50 text-hc-teal-light bg-hc-teal/10' : 'border-white/10 text-hc-muted'
                        }`}
                      >
                        {f.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-hc-muted/80 mb-3">
                    Guided recommendation: keep <span className="text-white font-semibold">Global Import</span> for mixed-client ZIP packs, then review each client page after import.
                  </div>
                  {!!zipReadErrors.length && (
                    <div className="mb-3 border border-flag-amber/30 bg-flag-amber/10 rounded-xl px-3 py-2 text-xs text-flag-amber">
                      Some files could not be read and were auto-skipped: {zipReadErrors.slice(0, 3).join(' | ')}{zipReadErrors.length > 3 ? ` (+${zipReadErrors.length - 3} more)` : ''}
                    </div>
                  )}
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {zipGuidance
                      .filter((row) => {
                        const q = zipSearch.trim().toLowerCase();
                        const matchesSearch = !q || row.fileName.toLowerCase().includes(q) || row.suggestedClient.toLowerCase().includes(q);
                        if (!matchesSearch) return false;
                        if (zipFilter === 'needs-decision') return rowNeedsDecision(row);
                        if (zipFilter === 'will-create') return rowWillCreatePerson(row);
                        if (zipFilter === 'failed-last') return zipRunSummary?.failedIds.includes(row.id) || false;
                        return true;
                      })
                      .map((row) => (
                      <div key={row.id} className="border border-white/10 rounded-xl px-3 py-2 bg-hc-dark/30">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) => setZipGuidance((prev) => prev.map((it) => it.id === row.id ? { ...it, include: e.target.checked } : it))}
                          />
                          <div className="text-xs text-white font-semibold truncate">{row.fileName}</div>
                        </div>
                        <div className="text-[11px] text-hc-muted">
                          Client: <span className="text-white">{row.suggestedClient}</span> · Type: <span className="text-white">{row.detectedType}</span> · Confidence {(row.confidence * 100).toFixed(0)}%
                        </div>
                        {row.parseError && (
                          <div className="text-[11px] text-flag-red">Read error: {row.parseError}</div>
                        )}
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {rowNeedsDecision(row) && <span className="text-[10px] px-2 py-0.5 rounded-full border border-flag-amber/40 text-flag-amber">Needs decision</span>}
                          {rowWillCreatePerson(row) && <span className="text-[10px] px-2 py-0.5 rounded-full border border-hc-teal/40 text-hc-teal-light">Will create person</span>}
                          {zipRunSummary?.failedIds.includes(row.id) && <span className="text-[10px] px-2 py-0.5 rounded-full border border-flag-red/40 text-flag-red">Failed last run</span>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                          <select
                            value={row.selectedTarget}
                            onChange={(e) => setZipGuidance((prev) => prev.map((it) => it.id === row.id ? { ...it, selectedTarget: e.target.value as ImportTarget | 'skip' } : it))}
                            className="bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                          >
                            <option value="skip">Skip</option>
                            <option value="reports">Reports</option>
                            <option value="templates">Templates</option>
                            <option value="client-docs">Client Docs</option>
                          </select>
                          <select
                            value={row.clientMode}
                            onChange={(e) => setZipGuidance((prev) => prev.map((it) => it.id === row.id ? { ...it, clientMode: e.target.value as ClientMode } : it))}
                            className="bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                          >
                            <option value="global">Global</option>
                            <option value="auto">Auto</option>
                            <option value="specific">Specific</option>
                          </select>
                          <select
                            value={row.selectedClientId || ''}
                            disabled={row.clientMode !== 'specific'}
                            onChange={(e) => setZipGuidance((prev) => prev.map((it) => it.id === row.id ? { ...it, selectedClientId: e.target.value || null } : it))}
                            className="bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white disabled:opacity-40"
                          >
                            <option value="">Select client...</option>
                            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                    </>
                  )}
                </div>
              )}
              {!!errorMsg && (
                <div className="mb-6 text-xs text-flag-red border border-flag-red/30 bg-flag-red/10 rounded-xl px-4 py-3 whitespace-pre-line">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => handleConfirm()}
                  className="flex-[2] btn-gradient text-white text-[11px] font-black uppercase tracking-[0.3em] py-5 rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                  Confirm Intelligence Mapping
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
                <button onClick={reset}
                  className="flex-1 glass-light border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-white py-5 rounded-2xl transition-all">
                  Discard
                </button>
              </div>
            </div>
          </div>

          {/* Stats Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {preview.type === 'diary' && (
              <>
                <div className="glass-light border border-white/5 rounded-2xl p-5 shadow-xl">
                  <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1 opacity-40">Entry Volume</div>
                  <div className="text-3xl font-black text-white tabular-nums">{preview.entryCount || 0}</div>
                </div>
                <div className="glass-light border border-white/5 rounded-2xl p-5 shadow-xl">
                  <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1 opacity-40">Timeline</div>
                  <div className="text-sm font-black text-white uppercase">{preview.dateRange}</div>
                </div>
                <div className="glass-light border border-white/5 rounded-2xl p-5 shadow-xl">
                  <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1 opacity-40">Houses Active</div>
                  <div className="text-3xl font-black text-hc-teal-light tabular-nums">{preview.houseCount || 0}</div>
                </div>
                <div className="glass-light border border-white/5 rounded-2xl p-5 shadow-xl">
                  <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1 opacity-40">High Priority</div>
                  <div className="text-3xl font-black text-flag-red tabular-nums">{preview.redFlags || 0}</div>
                </div>
              </>
            )}
            {preview.type === 'admission' && (
              <>
                <div className="glass-light border border-white/5 rounded-2xl p-5 shadow-xl">
                  <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1 opacity-40">Identified Name</div>
                  <div className="text-lg font-black text-white truncate">{preview.clientName}</div>
                </div>
                <div className="glass-light border border-white/5 rounded-2xl p-5 shadow-xl">
                  <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1 opacity-40">Temporal ID</div>
                  <div className="text-sm font-black text-white tabular-nums">{preview.dob}</div>
                </div>
                <div className="glass-light border border-white/5 rounded-2xl p-5 shadow-xl">
                  <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1 opacity-40">Net ID</div>
                  <div className="text-sm font-black text-white tabular-nums">{preview.nhs}</div>
                </div>
                <div className="glass-light border border-white/5 rounded-2xl p-5 shadow-xl">
                  <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1 opacity-40">Premium Domains</div>
                  <div className="text-3xl font-black text-hc-teal-light tabular-nums">{preview.domainsDetected} / 21</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP: DONE ───────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 rounded-full glass border-2 border-flag-green/40 flex items-center justify-center mb-6 shadow-xl">
            <svg className="w-10 h-10 text-flag-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div className="text-xl font-black text-white mb-2">Import Complete</div>
          <div className="text-sm text-hc-muted mb-6">{resultMsg}</div>
          {zipRunSummary ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setPage(zipRunSummary.nextPage)}
                className="px-5 py-2.5 rounded-xl btn-gradient text-[11px] font-black uppercase tracking-wide"
              >
                Open {zipRunSummary.nextPage}
              </button>
              {!!zipRunSummary.failed && (
                <button
                  onClick={() => {
                    setZipGuidance((prev) =>
                      prev.map((r) => ({ ...r, include: zipRunSummary.failedIds.includes(r.id) }))
                    );
                    setStep('preview');
                    setErrorMsg('Retry mode: only previously failed rows are selected.');
                  }}
                  className="px-5 py-2.5 rounded-xl border border-flag-amber/40 text-flag-amber text-[11px] font-black uppercase tracking-wide"
                >
                  Retry failed only
                </button>
              )}
              <button
                onClick={() => setStep('preview')}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-hc-muted text-[11px] font-black uppercase tracking-wide"
              >
                Back to mapping
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-hc-teal-light animate-pulse">Redirecting...</div>
          )}
        </div>
      )}

      {/* ─── STEP: ERROR ──────────────────────────────────────────────────────── */}
      {step === 'error' && (
        <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-2xl glass border border-flag-red/30 flex items-center justify-center mb-6 shadow-xl">
            <svg className="w-8 h-8 text-flag-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="text-lg font-bold text-white mb-2">Import Failed</div>
          <div className="text-sm text-hc-muted mb-6 max-w-md text-center whitespace-pre-line">{errorMsg}</div>
          <button onClick={reset}
            className="px-8 py-3 glass-light border border-white/10 text-sm font-bold text-white rounded-xl hover:bg-white/5 transition-all">
            Try Again
          </button>
        </div>
      )}

      {zipPendingCreateRows && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass border border-white/10 rounded-2xl p-6">
            <div className="text-lg font-black text-white mb-2">Confirm New People Creation</div>
            <div className="text-sm text-hc-muted mb-4">
              These selected rows will create new people if no match exists. Continue or go back and remap them.
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-5">
              {zipPendingCreateRows.map((row) => (
                <div key={row.id} className="border border-white/10 rounded-lg px-3 py-2 bg-hc-dark/30">
                  <div className="text-xs text-white font-semibold truncate">{row.fileName}</div>
                  <div className="text-[11px] text-hc-muted">Detected person: <span className="text-white">{row.suggestedClient}</span></div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setZipPendingCreateRows(null)}
                className="px-4 py-2 rounded-lg border border-white/10 text-hc-muted text-xs font-black uppercase tracking-wide"
              >
                Back to mapping
              </button>
              <button
                onClick={() => {
                  const rows = zipGuidance.filter((row) => row.include && row.selectedTarget !== 'skip');
                  setZipPendingCreateRows(null);
                  applyZipRows(rows);
                }}
                className="px-4 py-2 rounded-lg btn-gradient text-xs font-black uppercase tracking-wide"
              >
                Create and continue
              </button>
            </div>
          </div>
        </div>
      )}
      {!!importGaps.length && pendingConfirmBypassGaps && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass border border-flag-amber/30 rounded-2xl p-6">
            <div className="text-lg font-black text-white mb-2">More Source Data Recommended</div>
            <div className="text-sm text-hc-muted mb-4">
              Some required fields are missing. Add another document now for better output quality, or continue anyway.
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-5">
              {importGaps.map((gap) => (
                <div key={gap.id} className="border border-white/10 rounded-lg px-3 py-2 bg-hc-dark/30">
                  <div className="text-xs text-white font-semibold">{gap.label}</div>
                  <div className="text-[11px] text-hc-muted">{gap.why}</div>
                  <div className="text-[11px] text-hc-teal-light mt-1">Add: {gap.recommendedSource}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setImportGaps([]);
                  setPendingConfirmBypassGaps(false);
                  setStep('choose');
                }}
                className="px-4 py-2 rounded-lg border border-white/10 text-hc-muted text-xs font-black uppercase tracking-wide"
              >
                Add more source files
              </button>
              <button
                onClick={() => {
                  setImportGaps([]);
                  setPendingConfirmBypassGaps(false);
                  handleConfirm(pendingConfirmDestination, true);
                }}
                className="px-4 py-2 rounded-lg btn-gradient text-xs font-black uppercase tracking-wide"
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DATA MANAGEMENT ─────────────────────────────────────────────────── */}
      {step === 'choose' && <DataManagerProp weekData={weekData} clients={clients} onClearEverything={handleClearEverything} onClearType={handleClearType} />}

      {/* Footer */}
      <div className="mt-auto pt-16 pb-6 flex justify-center">
        <div className="flex items-center gap-3 text-[10px] font-bold text-hc-muted/30 uppercase tracking-widest cursor-default">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 3.75c-2.59 0-4.97.824-6.882 2.234A11.955 11.955 0 003.75 12c0 5.268 3.435 9.732 8.25 11.273 4.815-1.541 8.25-6.005 8.25-11.273 0-2.338-.672-4.52-1.832-6.016z" />
          </svg>
          All data stays on this device — nothing is sent externally
        </div>
      </div>
    </div>
  );
}
