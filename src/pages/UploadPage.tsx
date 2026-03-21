import { useState, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import { parseUniversalData, buildWeekSummary } from '../lib/universal-parser';
import { parseUniversalText, parseSupportPlanText } from '../lib/universal-import';
import { saveClient, emptyClient, findExistingClient, loadClients, clearClientData, clearStaffNotes, purgeSystemData } from '../lib/client-store';
import { clearWeekData, clearActions, clearIncidents, loadWeekData, loadActions, loadIncidents } from '../lib/storage';
import type { WeekSummary } from '../lib/types';
import type { FullClient } from '../lib/client-store';
import type { Page } from '../App';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type ImportType = 'diary' | 'admission' | 'support-plan';
type Step = 'choose' | 'extracting' | 'preview' | 'done' | 'error';

interface Props {
  onDataParsed: (data: WeekSummary) => void;
  setPage: (p: Page) => void;
}

interface PreviewData {
  type: ImportType;
  fileName: string;
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
  // raw for processing
  rawText: string;
}

// ─── Auto-detect what kind of file/text this is ───────────────────────────────
function detectType(text: string, fileName: string): ImportType | null {
  const lower = text.toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'docx') return 'support-plan';

  // Admission pack / Care plan PDF
  if (/emergency admission pack/i.test(text) || /care plan\s*[–-]\s*.+report run on/i.test(text)) {
    return 'admission';
  }

  // Support plan markers
  if (lower.includes('my support plan') || (lower.includes('what i can do') && lower.includes('how to support'))) {
    return 'support-plan';
  }

  // CSV diary export or pasted diary
  if (ext === 'csv' || lower.includes('display from') || lower.includes('incident type') || lower.includes('diary entry')) {
    return 'diary';
  }

  // PDF with diary table
  if (lower.includes('diary for') && lower.includes('display')) {
    return 'diary';
  }

  // Fallback: dates + separators = diary
  if (/\d{2}\/\d{2}\/\d{4}/.test(text) && (text.includes(',') || text.includes('|') || text.includes('\t'))) {
    return 'diary';
  }

  return null;
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

// ─── Build preview data from raw text ─────────────────────────────────────────
function buildPreview(rawText: string, type: ImportType, fileName: string): PreviewData {
  const base: PreviewData = { type, fileName, rawText, warnings: [] };

  if (type === 'diary') {
    const entries = parseUniversalData(rawText);
    if (entries.length === 0) {
      base.warnings = ['No diary entries detected. Check the file format.'];
      return base;
    }
    const summary = buildWeekSummary(entries);
    base.entryCount = summary.totalEntries;
    base.dateRange = summary.dateFrom && summary.dateTo ? `${summary.dateFrom} to ${summary.dateTo}` : 'Dates not detected';
    base.houseCount = Object.keys(summary.houses).length;
    base.clientCount = summary.clients.length;
    base.redFlags = summary.allFlags.red.length;
    base.amberFlags = summary.allFlags.amber.length;
    return base;
  }

  if (type === 'admission') {
    const result = parseUniversalText(rawText);
    base.clientName = result.client.name || 'Not detected';
    base.dob = result.client.dob || 'Not detected';
    base.nhs = result.client.nhs || 'Not detected';
    base.domainsDetected = result.carePlan.domains.filter(d => d.enabled).length;
    base.warnings = result.warnings;
    return base;
  }

  if (type === 'support-plan') {
    const result = parseSupportPlanText(rawText);
    base.supportNeeds = result.needs.length;
    // Try to extract name from text
    const nameMatch = rawText.match(/(?:support plan|my plan)\s*(?:for\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
    base.clientName = nameMatch ? nameMatch[1] : 'Not detected from text';
    base.warnings = result.needs.length > 0
      ? [`Found ${result.needs.length} support areas.`]
      : ['No support areas detected. Check the document format.'];
    return base;
  }

  return base;
}

// ─── TYPE CONFIG ──────────────────────────────────────────────────────────────
const TYPE_INFO: Record<ImportType, { label: string; desc: string; icon: string; accepts: string; help: string; destination: string }> = {
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
  const actions = loadActions();
  const incidents = loadIncidents();
  const notes = (() => { try { return JSON.parse(localStorage.getItem('hazelcare-staff-notes') || '[]'); } catch { return []; } })();

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
      } else {
        rawText = await file.text();
      }

      if (!rawText.trim()) {
        setErrorMsg('File appears to be empty. Try a different export format.');
        setStep('error');
        return;
      }

      const type = detectType(rawText, file.name);
      if (!type) {
        setErrorMsg(`Could not identify this file. Supported formats:\n- Hazel Care Client Diary CSV\n- Emergency Admission Pack PDF\n- Support Plan DOCX\n\nTry exporting from your provider as CSV, or paste the text below.`);
        setStep('error');
        return;
      }

      const previewData = buildPreview(rawText, type, file.name);
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

    const type = detectType(pasteText, 'paste.txt');
    if (!type) {
      setErrorMsg('Could not identify this text. Make sure you\'re pasting a diary export, admission pack, or support plan.');
      setStep('error');
      return;
    }

    const previewData = buildPreview(pasteText, type, 'Pasted text');
    setPreview(previewData);
    setStep('preview');
  };

  // ─── Confirm and process ─────────────────────────────────────────────────────
  const [goTo, setGoTo] = useState<Page | null>(null);
  const [targetClient, setImportTargetClient] = useState<string | null>(null);

  const handleConfirm = (destination?: Page) => {
    if (!preview) return;

    if (preview.type === 'diary') {
      const entries = parseUniversalData(preview.rawText);
      if (entries.length === 0) {
        setErrorMsg('No entries could be parsed. Try exporting as CSV from your provider.');
        setStep('error');
        return;
      }
      const summary = buildWeekSummary(entries);
      onDataParsed(summary);
      const target = destination || goTo || 'briefing';
      setResultMsg(`${summary.totalEntries} diary entries loaded across ${Object.keys(summary.houses).length} houses.`);
      setStep('done');
      setTimeout(() => setPage(target), 1500);
      return;
    }

    if (preview.type === 'admission') {
      const result = parseUniversalText(preview.rawText);
      const existing = targetClient ? loadClients().find(c => c.id === targetClient) : findExistingClient(result.client.name || '', result.client.nhs || '');
      const client = existing ? { ...existing } : emptyClient();
      Object.assign(client, result.client);
      if (existing) {
        client.name = existing.name || result.client.name || '';
      }
      client.carePlan = result.carePlan;
      saveClient(client);
      const domains = result.carePlan.domains.filter(d => d.enabled).length;
      const verb = existing ? 'updated' : 'created';
      setResultMsg(`${client.name || 'Client'} ${verb} with ${domains} care plan domains.`);
      setStep('done');
      setTimeout(() => setPage(destination || goTo || 'client-docs'), 1500);
      return;
    }

    if (preview.type === 'support-plan') {
      const spResult = parseSupportPlanText(preview.rawText);
      const clientName = preview.clientName || 'Imported Client';
      const existing = targetClient ? loadClients().find(c => c.id === targetClient) : findExistingClient(clientName, '');
      const client = existing ? { ...existing } : emptyClient();
      if (!existing) {
        client.name = clientName;
        client.preferredName = clientName.split(' ')[0] || 'Client';
      }
      (client as any).supportPlan = spResult;
      saveClient(client as FullClient);
      const verb = existing ? 'updated' : 'created';
      setResultMsg(`${client.name} ${verb} with ${spResult.needs.length} support areas.`);
      setStep('done');
      setTimeout(() => setPage(destination || goTo || 'client-docs'), 1500);
      return;
    }
  };

  // ─── Reset ───────────────────────────────────────────────────────────────────
  const reset = () => {
    setStep('choose');
    setPreview(null);
    setProgress(0);
    setErrorMsg('');
    setPasteText('');
    setResultMsg('');
  };

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
            {(Object.entries(TYPE_INFO) as [ImportType, typeof TYPE_INFO['diary']][]).map(([key, info]) => (
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
              <div className="text-[11px] text-hc-muted/50">CSV, PDF, DOCX, or TXT — we'll auto-detect the format</div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.vtt,.csv,.tsv,.md,.pdf,.docx" className="hidden"
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
                  {TYPE_INFO[preview.type].icon}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tighter uppercase text-shimmer">{TYPE_INFO[preview.type].label} Identified</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
                    <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60">Intelligence layer active — Select guided action</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {/* Decision Row 1: Target Mapping */}
                <div className="space-y-3">
                  <label className="section-header text-[9px] opacity-40 uppercase tracking-[0.2em] ml-1">Target Mapping</label>
                  <div className="glass-light border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-hc-teal/30 transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">👤</span>
                      <div>
                        <div className="text-[11px] font-black text-white uppercase">Link to Profile</div>
                        <div className="text-[9px] text-hc-muted">Associate data with a specific person</div>
                      </div>
                    </div>
                    <select
                      value={targetClient || ''}
                      onChange={e => setImportTargetClient(e.target.value || null)}
                      className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] font-black text-white focus:outline-none focus:border-hc-teal/50 shadow-inner">
                      <option value="">Global Import</option>
                      {loadClients().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Decision Row 2: Landing Page */}
                <div className="space-y-3">
                  <label className="section-header text-[9px] opacity-40 uppercase tracking-[0.2em] ml-1">Landing Destination</label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { page: 'briefing' as Page, icon: '☀️' },
                      { page: 'dashboard' as Page, icon: '📊' },
                      { page: 'client-docs' as Page, icon: '📋' },
                      { page: 'templates' as Page, icon: '📄' },
                    ]).map(opt => (
                      <button key={opt.page} onClick={() => setGoTo(opt.page)}
                        className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all active:scale-95 text-xl ${
                          (goTo || (preview.type === 'diary' ? 'briefing' : 'client-docs')) === opt.page
                            ? 'border-hc-teal/40 bg-hc-teal/10 glow-teal shadow-lg'
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                        }`} title={opt.page}>
                        {opt.icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.955 0 013.598 6.223a12.02 12.02 0 003 9c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          All data stays on this device — nothing is sent externally
        </div>
      </div>
    </div>
  );
}
