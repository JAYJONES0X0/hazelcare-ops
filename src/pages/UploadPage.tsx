import { useState, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import { parseNourishData, buildWeekSummary } from '../lib/nourish-parser';
import { parseNourishText, parseSupportPlanText } from '../lib/nourish-import';
import { saveClient, emptyClient } from '../lib/client-store';
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
    const entries = parseNourishData(rawText);
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
    const result = parseNourishText(rawText);
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
    desc: 'Nourish diary export — populates dashboard, briefing, and all house views',
    icon: '📊',
    accepts: '.csv,.txt,.pdf',
    help: 'Nourish → Client Diary → Export CSV',
    destination: 'Briefing',
  },
  admission: {
    label: 'Person Import',
    desc: 'Nourish Emergency Admission Pack or Care Plan — creates a new client profile with all 21 care plan domains',
    icon: '👤',
    accepts: '.pdf,.txt',
    help: 'Nourish → Reports → Emergency Admission Pack → PDF',
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
        setErrorMsg(`Could not identify this file. Supported formats:\n- Nourish Client Diary CSV\n- Emergency Admission Pack PDF\n- Support Plan DOCX\n\nTry exporting from Nourish as CSV, or paste the text below.`);
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
      setErrorMsg('Could not identify this text. Make sure you\'re pasting a Nourish export, admission pack, or support plan.');
      setStep('error');
      return;
    }

    const previewData = buildPreview(pasteText, type, 'Pasted text');
    setPreview(previewData);
    setStep('preview');
  };

  // ─── Confirm and process ─────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!preview) return;

    if (preview.type === 'diary') {
      const entries = parseNourishData(preview.rawText);
      if (entries.length === 0) {
        setErrorMsg('No entries could be parsed. Try exporting as CSV from Nourish.');
        setStep('error');
        return;
      }
      const summary = buildWeekSummary(entries);
      onDataParsed(summary);
      setResultMsg(`${summary.totalEntries} diary entries loaded across ${Object.keys(summary.houses).length} houses.`);
      setStep('done');
      setTimeout(() => setPage('briefing'), 1500);
      return;
    }

    if (preview.type === 'admission') {
      const result = parseNourishText(preview.rawText);
      const client = emptyClient();
      Object.assign(client, result.client);
      client.carePlan = result.carePlan;
      saveClient(client);
      const domains = result.carePlan.domains.filter(d => d.enabled).length;
      setResultMsg(`${result.client.name || 'Client'} created with ${domains} care plan domains.`);
      setStep('done');
      setTimeout(() => setPage('client-docs'), 1500);
      return;
    }

    if (preview.type === 'support-plan') {
      const spResult = parseSupportPlanText(preview.rawText);
      const client = emptyClient();
      client.name = preview.clientName || 'Imported Client';
      client.preferredName = (preview.clientName || '').split(' ')[0] || 'Client';
      (client as any).supportPlan = spResult;
      saveClient(client as FullClient);
      setResultMsg(`${client.name} created with ${spResult.needs.length} support areas.`);
      setStep('done');
      setTimeout(() => setPage('client-docs'), 1500);
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
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-2 tracking-tighter text-shimmer">Import Hub</h1>
        <p className="text-hc-muted text-sm font-medium">Upload data from Nourish or your local authority. We'll detect the format and route it to the right place.</p>
      </div>

      {/* ─── STEP: CHOOSE ─────────────────────────────────────────────────────── */}
      {step === 'choose' && (
        <>
          {/* What can you import */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
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
                placeholder="Paste Nourish export, admission pack text, or support plan here..."
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
          {/* Detected type banner */}
          <div className="glass border border-hc-teal/30 rounded-2xl p-6 mb-6 flex items-center gap-5">
            <div className="text-4xl">{TYPE_INFO[preview.type].icon}</div>
            <div className="flex-1">
              <div className="text-lg font-black text-white mb-0.5">{TYPE_INFO[preview.type].label} Detected</div>
              <div className="text-[11px] text-hc-muted">{preview.fileName}</div>
            </div>
            <div className="pill pill-teal text-[10px] font-bold uppercase tracking-wider">
              → {TYPE_INFO[preview.type].destination}
            </div>
          </div>

          {/* Preview details */}
          <div className="glass-light border border-white/5 rounded-2xl p-6 mb-6">
            {preview.type === 'diary' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">Entries</div>
                  <div className="text-2xl font-black text-white">{preview.entryCount || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">Date Range</div>
                  <div className="text-sm font-bold text-white">{preview.dateRange}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">Houses</div>
                  <div className="text-2xl font-black text-white">{preview.houseCount || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">People</div>
                  <div className="text-2xl font-black text-white">{preview.clientCount || 0}</div>
                </div>
                {(preview.redFlags || 0) > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-flag-red uppercase tracking-wider mb-1">Red Flags</div>
                    <div className="text-2xl font-black text-flag-red">{preview.redFlags}</div>
                  </div>
                )}
                {(preview.amberFlags || 0) > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-flag-amber uppercase tracking-wider mb-1">Amber Flags</div>
                    <div className="text-2xl font-black text-flag-amber">{preview.amberFlags}</div>
                  </div>
                )}
              </div>
            )}

            {preview.type === 'admission' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">Name</div>
                  <div className="text-lg font-black text-white">{preview.clientName}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">Date of Birth</div>
                  <div className="text-sm font-bold text-white">{preview.dob}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">NHS Number</div>
                  <div className="text-sm font-bold text-white">{preview.nhs}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">Care Domains</div>
                  <div className="text-2xl font-black text-hc-teal-light">{preview.domainsDetected}<span className="text-sm text-hc-muted font-normal"> / 21</span></div>
                </div>
              </div>
            )}

            {preview.type === 'support-plan' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">Name</div>
                  <div className="text-lg font-black text-white">{preview.clientName}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">Support Areas</div>
                  <div className="text-2xl font-black text-hc-teal-light">{preview.supportNeeds}</div>
                </div>
              </div>
            )}
          </div>

          {/* Warnings */}
          {preview.warnings && preview.warnings.length > 0 && (
            <div className="glass-light border border-flag-amber/20 rounded-2xl p-4 mb-6">
              {preview.warnings.map((w, i) => (
                <div key={i} className="text-[11px] text-flag-amber flex items-start gap-2 mb-1 last:mb-0">
                  <span className="mt-0.5">!</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button onClick={handleConfirm}
              className="flex-[2] btn-gradient text-white text-sm font-bold py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
              Import and go to {TYPE_INFO[preview.type].destination}
            </button>
            <button onClick={reset}
              className="flex-1 glass-light border border-white/10 text-sm font-bold text-hc-muted hover:text-white py-4 rounded-2xl transition-all">
              Cancel
            </button>
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

      {/* Footer */}
      <div className="mt-auto pt-16 pb-6 flex justify-center">
        <div className="flex items-center gap-3 text-[10px] font-bold text-hc-muted/30 uppercase tracking-widest cursor-default">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          All data stays on this device — nothing is sent externally
        </div>
      </div>
    </div>
  );
}
