import { useState, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { loadClients, clearClientData, clearStaffNotes, purgeSystemData } from '../lib/client-store';
import { clearWeekData, clearActions, clearIncidents, loadWeekData, loadActions, loadIncidents, exportOpsSnapshot, importOpsSnapshot } from '../lib/storage';
import { TEMPLATES } from '../lib/types';
import type { WeekSummary, TemplateType } from '../lib/types';
import type { FullClient } from '../lib/client-store';
import type { Page } from '../App';
import type { NormalizedImportEnvelope, ImportTarget } from '../lib/import-intelligence';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { routeImport, type ClientMode } from '../lib/import-router';

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

async function extractZipText(file: File, onProgress?: (p: number) => void): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const supported = entries.filter((entry) => /\.(txt|csv|tsv|md|pdf|docx)$/i.test(entry.name));
  if (!supported.length) {
    return '';
  }

  let combined = '';
  for (let i = 0; i < supported.length; i += 1) {
    const entry = supported[i];
    const ext = entry.name.split('.').pop()?.toLowerCase();
    let text = '';

    if (ext === 'pdf' || ext === 'docx') {
      const blob = await entry.async('blob');
      const nestedFile = new File([blob], entry.name);
      text = ext === 'pdf' ? await extractPdfText(nestedFile) : await extractDocxText(nestedFile);
    } else {
      text = await entry.async('text');
    }

    if (text.trim()) {
      combined += `\n\n--- FILE: ${entry.name} ---\n${text}`;
    }
    if (onProgress) onProgress(Math.round(((i + 1) / supported.length) * 100));
  }
  return combined.trim();
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
          Export Full Backup
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
  const fileRef = useRef<HTMLInputElement>(null);

  const weekData = loadWeekData();
  const clients = loadClients();

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

      if (ext === 'pdf') {
        rawText = await extractPdfText(file, setProgress);
      } else if (ext === 'docx') {
        rawText = await extractDocxText(file);
      } else if (ext === 'zip') {
        rawText = await extractZipText(file, setProgress);
      } else {
        rawText = await file.text();
      }

      if (!rawText.trim()) {
        setErrorMsg('File appears empty or has no supported files. Use ZIP containing CSV/TXT/PDF/DOCX, or upload a direct export.');
        setStep('error');
        return;
      }

      const envelope = buildEnvelopeFromRaw(file.name, rawText);
      const previewData = buildPreview(envelope);
      setSelectedTargets(envelope.suggestedTargets.length ? envelope.suggestedTargets : ['reports']);
      setTemplateMode('all');
      setSelectedTemplateIds([]);
      setImportTargetClient(null);
      setPreview(previewData);
      setStep('preview');
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMsg(`Failed to read file: ${err.message || 'Unknown error'}. Try a different format or paste the text manually.`);
      setStep('error');
    }
  };

  // ─── Handle pasted text ──────────────────────────────────────────────────────
  const handlePaste = () => {
    if (!pasteText.trim()) return;
    setStep('extracting');
    setProgress(100);
    try {
      const envelope = buildEnvelopeFromRaw('Pasted text', pasteText);
      const previewData = buildPreview(envelope);
      setSelectedTargets(envelope.suggestedTargets.length ? envelope.suggestedTargets : ['reports']);
      setTemplateMode('all');
      setSelectedTemplateIds([]);
      setImportTargetClient(null);
      setPreview(previewData);
      setStep('preview');
    } catch (err: any) {
      setErrorMsg(`Failed to analyse pasted text: ${err?.message || 'Unknown error'}`);
      setStep('error');
    }
  };

  // ─── Confirm and process ─────────────────────────────────────────────────────
  const [targetClient, setImportTargetClient] = useState<string | null>(null);

  const handleConfirm = (destination?: Page) => {
    if (!preview) return;
    setErrorMsg('');
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
      onDataParsed(preview.envelope.weekSummary);
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
  };

  const detectedInfo = preview && preview.type !== 'unknown'
    ? TYPE_INFO[preview.type]
    : { icon: '🧠', label: 'Unknown Source', desc: 'Manual routing required' };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-6 lg:p-10 w-full animate-in fade-in duration-700 scrollbar-thin max-w-5xl mx-auto">
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
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
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
          <input ref={fileRef} type="file" accept=".txt,.vtt,.csv,.tsv,.md,.pdf,.docx,.zip,application/zip" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

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
          <div className="text-[11px] text-hc-teal-light animate-pulse">Redirecting...</div>
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
