import { useState, useRef } from 'react';
import { Activity, X, Check, AlertTriangle } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { loadClients } from '../lib/client-store';
import { loadWeekData, mergeWeekSummaries, uid } from '../lib/storage';
import type { WeekSummary } from '../lib/types';
import type { Page } from '../App';
import type { NormalizedImportEnvelope, ImportTarget } from '../lib/import-intelligence';
import { emptyEnvelope } from '../lib/import-intelligence';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { routeImport, type ClientMode } from '../lib/import-router';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type UploadDetectedType = 'diary' | 'admission' | 'support-plan' | 'roster' | 'unknown';
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
  entryCount?: number;
  dateRange?: string;
  shiftCount?: number;
  houseCount?: number;
  clientCount?: number;
  redFlags?: number;
  amberFlags?: number;
  clientName?: string;
  dob?: string;
  nhs?: string;
  domainsDetected?: number;
  supportNeeds?: number;
  warnings?: string[];
  unmappedFields?: string[];
  rawItems?: any[]; 
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

interface SourceBasketItem {
  id: string;
  fileName: string;
  envelope: NormalizedImportEnvelope;
  confidence: number;
}


// ─── Extraction Helpers ────────────────────────────────────────────────────────
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
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) pageText += '\n';
      else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) pageText += ' ';
      pageText += item.str;
      lastY = y;
    }
    fullText += pageText + '\n';
  }
  return fullText;
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function inferClientFromFileName(fileName: string): string {
  const base = fileName.split('/').pop() || fileName;
  const cleaned = base.replace(/\.[^.]+$/, '');
  const match = cleaned.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
  return match ? match[1] : 'Unclear';
}



function findClientIdByNameHint(nameHint: string): string | null {
  const hint = (nameHint || '').trim().toLowerCase();
  if (!hint || hint === 'unclear') return null;
  const clients = loadClients();
  const direct = clients.find(c => c.name.trim().toLowerCase() === hint);
  if (direct) return direct.id;
  return clients.find(c => c.name.trim().toLowerCase().includes(hint) || hint.includes(c.name.trim().toLowerCase()))?.id || null;
}

async function extractZipGuidance(file: File, onProgress?: (p: number) => void): Promise<{ combined: string; rows: ZipGuidanceRow[]; readErrors: string[] }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  const supported = entries.filter(entry => /\.(txt|csv|tsv|md|pdf|docx)$/i.test(entry.name));
  if (!supported.length) return { combined: '', rows: [], readErrors: [] };

  let combined = '';
  const rows: ZipGuidanceRow[] = [];
  const readErrors: string[] = [];
  for (let i = 0; i < supported.length; i++) {
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
      } else readErrors.push(`${displayName}: empty`);
    } catch (err: any) {
      readErrors.push(`${displayName}: failed`);
    }
    if (onProgress) onProgress(Math.round(((i + 1) / supported.length) * 100));
  }
  return { combined, rows, readErrors };
}

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
    base.dateRange = envelope.weekSummary.dateFrom && envelope.weekSummary.dateTo ? `${envelope.weekSummary.dateFrom} to ${envelope.weekSummary.dateTo}` : 'N/A';
    base.houseCount = Object.keys(envelope.weekSummary.houses).length;
    base.redFlags = envelope.weekSummary.allFlags.red.length;
  }
  if (envelope.shifts?.length) {
    base.shiftCount = envelope.shifts.length;
    const dates = envelope.shifts.map(s => s.date).sort();
    base.dateRange = dates.length > 0 ? `${dates[0]} to ${dates[dates.length-1]}` : 'N/A';
  }
  if (envelope.admission) {
    base.clientName = envelope.admission.client.name;
    base.dob = envelope.admission.client.dob;
    base.domainsDetected = envelope.admission.carePlan.domains.filter(d => d.enabled).length;
  }
  if (envelope.diaryEntries?.length) base.rawItems = envelope.diaryEntries;
  else if (envelope.shifts?.length) base.rawItems = envelope.shifts;
  return base;
}


function mergeEnvelopes(envelopes: NormalizedImportEnvelope[]): NormalizedImportEnvelope {
  const merged = emptyEnvelope('Batch', envelopes.map(e => e.source.fileName).join(', '));
  envelopes.forEach(e => {
    if (e.weekSummary) merged.weekSummary = mergeWeekSummaries(merged.weekSummary, e.weekSummary);
    merged.diaryEntries.push(...e.diaryEntries);
    merged.shifts.push(...(e.shifts || []));
    merged.clientCandidates.push(...e.clientCandidates);
    merged.suggestedTargets.push(...e.suggestedTargets);
  });
  merged.suggestedTargets = Array.from(new Set(merged.suggestedTargets));
  return merged;
}

// ─── Verification Grid ────────────────────────────────────────────────────────
function VerificationGrid({ items, type, onUpdate }: { items: any[], type: UploadDetectedType, onUpdate: (items: any[]) => void }) {
  if (!items?.length) return null;
  const handleChange = (i: number, f: string, v: string) => {
    const n = [...items];
    n[i] = { ...n[i], [f]: v };
    onUpdate(n);
  };
  return (
    <div className="bg-hc-card border border-hc-border rounded-lg overflow-hidden mb-6 flex flex-col max-h-[400px]">
      <div className="p-3 border-b border-hc-border text-[9px] font-black uppercase tracking-widest text-hc-teal">Editable Field Audit ({items.length} units)</div>
      <div className="overflow-auto scrollbar-thin">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead className="sticky top-0 bg-hc-navy z-20">
            <tr className="border-b border-hc-border">
              {type === 'roster' ? (
                ['Personnel', 'Asset', 'Temporal', 'Duration'].map(h => <th key={h} className="px-4 py-2 text-[8px] font-black uppercase text-hc-muted">{h}</th>)
              ) : (
                ['Temporal', 'Subject', 'Asset', 'Diagnostic'].map(h => <th key={h} className="px-4 py-2 text-[8px] font-black uppercase text-hc-muted">{h}</th>)
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-hc-border">
            {items.map((it, idx) => (
              <tr key={idx} className="hover:bg-hc-card-hover transition-colors">
                <td className="px-4 py-1.5 text-[10px] text-hc-text tabular-nums">{it.date} {it.time || ''}</td>
                <td className="px-4 py-1.5"><input value={it.client || it.staffId || ''} onChange={e => handleChange(idx, it.client ? 'client' : 'staffId', e.target.value)} className="bg-transparent text-[10px] text-hc-text w-full focus:outline-none focus:text-hc-teal" /></td>
                <td className="px-4 py-1.5"><input value={it.house || ''} onChange={e => handleChange(idx, 'house', e.target.value)} className="bg-transparent text-[10px] text-hc-text w-full focus:outline-none focus:text-hc-teal" /></td>
                <td className="px-4 py-1.5 text-[10px] text-hc-muted truncate max-w-[200px]">{it.entry || it.hours || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function UploadPage({ onDataParsed, setPage }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [sourceBasket, setSourceBasket] = useState<SourceBasketItem[]>([]);
  const [zipGuidance, setZipGuidance] = useState<ZipGuidanceRow[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<ImportTarget[]>([]);
  const [clientMode, setClientMode] = useState<ClientMode>('global');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const clients = loadClients();

  const reset = () => {
    setStep('choose'); setPreview(null); setProgress(0); setErrorMsg('');
    setSourceBasket([]); setZipGuidance([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFiles = async (files: FileList | File[]) => {
    setStep('extracting'); setErrorMsg('');
    for (const file of Array.from(files)) {
      try {
        let text = ''; const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') text = await extractPdfText(file, setProgress);
        else if (ext === 'docx') text = await extractDocxText(file);
        else if (ext === 'zip') {
          const zip = await extractZipGuidance(file, setProgress);
          setZipGuidance(zip.rows);
          text = zip.combined;
        } else text = await file.text();

        if (!text.trim()) continue;
        const env = buildEnvelopeFromRaw(file.name, text);
        const item = { id: uid(), fileName: file.name, envelope: env, confidence: env.source.confidence };
        const nextBasket = [...sourceBasket, item];
        setSourceBasket(nextBasket);
        
        if (ext === 'zip') {
          setPreview(buildPreview(env));
          setStep('preview');
        } else {
          const combined = mergeEnvelopes(nextBasket.map(i => i.envelope));
          setPreview(buildPreview(combined));
          setSelectedTargets(combined.suggestedTargets.length ? combined.suggestedTargets : ['reports']);
          setStep('preview');
        }
      } catch (e: any) { setErrorMsg(`Fault: ${e.message}`); setStep('error'); break; }
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    if (zipGuidance.length > 0) {
      const active = zipGuidance.filter(r => r.include && r.selectedTarget !== 'skip');
      applyZipRows(active);
      return;
    }
    if (!selectedTargets.length) { setErrorMsg('Select target vector.'); return; }
    const res = routeImport(preview.envelope, { targets: selectedTargets, clientMode, selectedClientId });
    if (res.ok) {
       if (selectedTargets.includes('reports')) {
         const data = loadWeekData();
         if (data) onDataParsed(data);
       }
       setResultMsg(res.messages.join(' ')); setStep('done');
    } else { setErrorMsg(res.warnings.join(' | ')); setStep('error'); }
  };

  const applyZipRows = (rows: ZipGuidanceRow[]) => {
    let success = 0;
    for (const r of rows) {
      const res = routeImport(r.envelope, { targets: [r.selectedTarget as ImportTarget], clientMode: r.clientMode, selectedClientId: r.selectedClientId });
      if (res.ok) success++;
    }
    if (success > 0) { 
      const data = loadWeekData();
      if (data) onDataParsed(data);
      setResultMsg(`Processed ${rows.length} units: ${success} active.`); setStep('done'); 
    } else { setErrorMsg('Unit ingestion failed.'); setStep('error'); }
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-transparent overflow-hidden flex flex-col font-mono">

      <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
        {/* Header */}
        <div className="mb-10 pb-6 border-b border-hc-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black tracking-[0.3em] text-hc-teal uppercase mb-1">Operational Intake Hub</div>
            <h1 className="text-xl font-black text-hc-text tracking-[.2em] uppercase leading-none">Field Injest Matrix</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPage('dashboard')} className="bg-hc-card border border-hc-border px-4 py-2 text-[9px] font-black uppercase text-hc-text hover:bg-hc-card-hover rounded">Command Center</button>
            <button onClick={reset} className="bg-hc-card border border-hc-border px-4 py-2 text-[9px] font-black uppercase text-hc-muted hover:text-hc-text rounded">Clear Feed</button>
          </div>
        </div>

        {step === 'choose' && (
          <div className="flex flex-col lg:flex-row gap-6 animate-in slide-in-from-bottom-4 duration-500">
            <label className="flex-[3] group relative flex flex-col items-center justify-center border-2 border-dashed border-hc-border bg-hc-card p-20 rounded-xl cursor-pointer hover:border-hc-teal transition-all">
              <input type="file" ref={fileRef} multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
              <Activity className="w-12 h-12 text-hc-teal opacity-40 mb-6 group-hover:scale-110 transition-transform" />
              <div className="text-center">
                <div className="text-[12px] font-black text-hc-text uppercase tracking-widest mb-2">Injest Log Feed</div>
                <p className="text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-60">Drop ZIP pack, PDF Reports, or Roster Intelligence</p>
                <div className="mt-8 px-10 py-3 bg-hc-text text-hc-navy text-[10px] font-black uppercase tracking-widest">Initiate Load Sequence</div>
              </div>
            </label>
            <div className="flex-1 bg-hc-card border border-hc-border rounded-xl p-6 flex flex-col">
              <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted mb-6">Injest Buffer [{sourceBasket.length}]</div>
              <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin">
                {sourceBasket.map(i => (
                  <div key={i.id} className="p-3 bg-hc-navy/40 border border-hc-border rounded flex items-center justify-between group">
                    <span className="text-[10px] text-hc-text truncate uppercase font-black">{i.fileName}</span>
                    <button onClick={() => setSourceBasket(b => b.filter(x => x.id !== i.id))} className="text-flag-red p-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'extracting' && (
          <div className="flex-1 flex flex-col items-center justify-center py-40">
            <div className="w-full max-w-sm mb-4 bg-hc-card border border-hc-border h-4 rounded-full overflow-hidden">
              <div className="bg-hc-teal h-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[10px] font-black text-hc-teal uppercase tracking-widest animate-pulse">Extracting Intelligence: {progress}%</div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { l: 'Entry Volume', v: preview.entryCount || preview.shiftCount || 0 },
                { l: 'Timeline', v: preview.dateRange },
                { l: 'Assets Active', v: preview.houseCount || 0 },
                { l: 'Critical Hits', v: preview.redFlags || 0, c: 'text-flag-red' },
              ].map(s => (
                <div key={s.l} className="bg-hc-card border border-hc-border p-5 rounded-lg">
                  <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">{s.l}</div>
                  <div className={`text-2xl font-black tabular-nums ${s.c || 'text-hc-text'}`}>{s.v}</div>
                </div>
              ))}
            </div>

            <VerificationGrid items={preview.rawItems || []} type={preview.type} onUpdate={items => setPreview({ ...preview, rawItems: items })} />

            <div className="bg-hc-card border border-hc-border p-8 rounded-lg">
              <div className="text-[10px] font-black text-hc-text uppercase tracking-widest mb-6">Intelligence Routing Options</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Output Targets</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['reports', 'templates', 'client-docs', 'roster'].map(t => (
                      <label key={t} className="flex items-center gap-3 p-3 bg-hc-navy/40 border border-hc-border rounded cursor-pointer hover:bg-hc-card-hover">
                        <input type="checkbox" checked={selectedTargets.includes(t as ImportTarget)} onChange={() => setSelectedTargets(p => p.includes(t as ImportTarget) ? p.filter(x => x !== t) : [...p, t as ImportTarget])} />
                        <span className="text-[10px] font-black uppercase text-hc-text">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                   <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Asset Resolution</label>
                   <select value={clientMode} onChange={e => setClientMode(e.target.value as ClientMode)} className="w-full bg-hc-navy border border-hc-border p-3 rounded text-[10px] font-black uppercase text-hc-text tracking-widest">
                     <option value="global">Injest to Global Ledger</option>
                     <option value="auto">Auto-Synthesise Profiles</option>
                     <option value="specific">Target Specific Entity</option>
                   </select>
                   {clientMode === 'specific' && (
                     <select value={selectedClientId || ''} onChange={e => setSelectedClientId(e.target.value)} className="w-full bg-hc-navy border border-hc-border p-3 rounded text-[10px] font-black uppercase text-hc-text tracking-widest">
                        <option value="">Select Asset...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                   )}
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => handleConfirm()} className="flex-1 bg-hc-teal text-hc-navy py-4 rounded text-[11px] font-black uppercase tracking-[0.2em] hover:bg-teal-400 transition-all">Confirm Injest Mapping</button>
                <button onClick={reset} className="px-10 bg-hc-card border border-hc-border text-hc-muted py-4 rounded text-[11px] font-black uppercase tracking-widest hover:text-hc-text">Discard</button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded bg-flag-green/10 border border-flag-green flex items-center justify-center mb-10"><Check className="w-10 h-10 text-flag-green" /></div>
            <h2 className="text-xl font-black text-hc-text tracking-[0.2em] uppercase mb-4">Injest Complete</h2>
            <p className="text-[10px] text-hc-muted text-center max-w-sm mb-12 uppercase leading-relaxed tracking-widest">{resultMsg}</p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              <button onClick={() => setPage('dashboard')} className="p-4 bg-hc-card border border-hc-border rounded text-[9px] font-black uppercase tracking-widest text-hc-text hover:bg-hc-card-hover transition-all">Return to Command</button>
              <button onClick={reset} className="p-4 bg-hc-teal text-hc-navy rounded text-[9px] font-black uppercase tracking-widest transition-all">Next Segment</button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <AlertTriangle className="w-12 h-12 text-flag-red mb-6" />
            <h2 className="text-lg font-black text-flag-red uppercase tracking-widest mb-4">Injest Fault Detected</h2>
            <p className="text-[10px] text-hc-muted text-center max-w-md mb-10 font-mono italic">"{errorMsg}"</p>
            <button onClick={reset} className="px-10 py-3 bg-hc-card border border-hc-border text-hc-text text-[10px] font-black uppercase tracking-widest rounded">Retest System</button>
          </div>
        )}
      </div>

      <div className="mt-auto p-6 flex justify-center border-t border-hc-border bg-hc-card/30">
        <div className="flex items-center gap-2 text-[9px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-40">
           <div className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
           Local Intelligence Only // Zero Latency Encrypted Environment
        </div>
      </div>
    </div>
  );
}
