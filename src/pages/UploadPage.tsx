import { useState, useRef } from 'react';
import { Activity, Check, AlertTriangle, Upload, FileText, Calendar, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { loadClients } from '../lib/client-store';
import { loadWeekData, mergeWeekSummaries, uid } from '../lib/storage';
import type { WeekSummary } from '../lib/types';
import type { Page } from '../App';
import type { NormalizedImportEnvelope, ImportTarget } from '../lib/import-intelligence';
import { emptyEnvelope } from '../lib/import-intelligence';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { routeImport, type ClientMode } from '../lib/import-router';
import { extractFileText } from '../lib/universal-extractor';

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
        text = await extractFileText(nestedFile);
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

function VerificationGrid({ items, type, onUpdate }: { items: any[], type: UploadDetectedType, onUpdate: (items: any[]) => void }) {
  if (!items?.length) return null;
  const handleChange = (i: number, f: string, v: string) => {
    const n = [...items];
    n[i] = { ...n[i], [f]: v };
    onUpdate(n);
  };
  return (
    <div className="hc-clay-raised rounded-[2rem] overflow-hidden mb-6 flex flex-col max-h-[400px]">
      <div className="p-5 border-b border-hc-muted/10 text-[10px] font-black uppercase tracking-widest text-hc-teal bg-black/[0.02]">Forensic Injest Audit ({items.length} Units)</div>
      <div className="overflow-auto scrollbar-thin">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead className="sticky top-0 bg-hc-bone z-20 shadow-sm">
            <tr className="border-b border-hc-muted/10">
              {type === 'roster' ? (
                ['Personnel', 'Asset', 'Temporal', 'Duration'].map(h => <th key={h} className="px-6 py-4 text-[9px] font-black uppercase text-hc-muted tracking-widest">{h}</th>)
              ) : (
                ['Temporal', 'Subject', 'Asset', 'Diagnostic'].map(h => <th key={h} className="px-6 py-4 text-[9px] font-black uppercase text-hc-muted tracking-widest">{h}</th>)
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-hc-muted/5 bg-hc-bg/30">
            {items.map((it, idx) => (
              <tr key={idx} className="hover:bg-black/[0.02] transition-colors">
                <td className="px-6 py-3 text-[11px] text-hc-text font-black tabular-nums tracking-tighter">{it.date} {it.time || ''}</td>
                <td className="px-6 py-3"><input value={it.client || it.staffId || ''} onChange={e => handleChange(idx, it.client ? 'client' : 'staffId', e.target.value)} className="bg-transparent text-[11px] font-black text-hc-text w-full focus:outline-none focus:text-hc-teal uppercase tracking-tighter" /></td>
                <td className="px-6 py-3"><input value={it.house || ''} onChange={e => handleChange(idx, 'house', e.target.value)} className="bg-transparent text-[11px] font-black text-hc-text w-full focus:outline-none focus:text-hc-teal uppercase tracking-tighter" /></td>
                <td className="px-6 py-3 text-[11px] text-hc-muted font-black truncate max-w-[300px] uppercase opacity-60 italic">{it.entry || it.hours || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
        if (ext === 'pdf' || ext === 'docx') text = await extractFileText(file, setProgress);
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
    <div className="h-[calc(100vh-4rem)] bg-hc-bone overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-12">
        {/* Header */}
        <div className="mb-12 pb-10 border-b border-hc-muted/10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-hc-text tracking-tighter uppercase leading-none mb-3">Field Injest Matrix</h1>
            <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-60">High-Density Operational Intake Protocol</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setPage('dashboard')} className="px-8 py-3.5 rounded-2xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-text hover:brightness-95 transition-all">Command Center</button>
            <button onClick={reset} className="px-8 py-3.5 rounded-2xl hc-clay-raised border border-hc-muted/5 text-[10px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-text transition-all">Purge Buffer</button>
          </div>
        </div>

        {step === 'choose' && (
          <div className="flex flex-col lg:flex-row gap-10 animate-in slide-in-from-bottom-4 duration-700">
            <label className="flex-[3] group relative flex flex-col items-center justify-center border-4 border-dashed border-hc-muted/10 bg-black/[0.01] p-24 rounded-[3rem] cursor-pointer hover:border-hc-teal transition-all duration-700">
              <input type="file" ref={fileRef} multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
              <div className="w-24 h-24 rounded-[2rem] hc-clay-raised flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-700 border border-hc-muted/5 shadow-2xl">
                 <Upload className="w-10 h-10 text-hc-teal" />
              </div>
              <div className="text-center">
                <div className="text-xl font-black text-hc-text uppercase tracking-[0.3em] mb-4">Initialize Intake Stream</div>
                <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-40 leading-loose">Drop Clinical ZIP Packs, PDF Quality Audits,<br />or Roster Intelligence Vectors</p>
              </div>
            </label>
            <div className="flex-1 hc-clay-raised rounded-[3rem] p-10 flex flex-col shadow-2xl border border-hc-muted/5 bg-black/[0.01]">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-hc-muted mb-10 flex items-center gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
                 Injest Buffer [{sourceBasket.length}]
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin pr-2">
                {sourceBasket.map(i => (
                  <div key={i.id} className="p-5 hc-clay-inset rounded-2xl flex items-center justify-between group animate-in slide-in-from-right-4">
                    <span className="text-[11px] text-hc-text truncate uppercase font-black tracking-tighter">{i.fileName}</span>
                    <button onClick={() => setSourceBasket(b => b.filter(x => x.id !== i.id))} className="text-hc-muted hover:text-flag-red p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {sourceBasket.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 grayscale">
                      <Activity className="w-10 h-10 mb-4" />
                      <div className="text-[10px] font-black uppercase tracking-widest">Buffer Empty</div>
                   </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'extracting' && (
          <div className="flex-1 flex flex-col items-center justify-center py-40">
            <div className="w-full max-w-sm mb-8 hc-clay-inset h-5 rounded-full overflow-hidden p-1 shadow-inner">
              <div className="bg-hc-teal h-full rounded-full transition-all duration-300 shadow-[0_0_15px_#14b8a6]" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[11px] font-black text-hc-teal uppercase tracking-[0.4em] animate-pulse">Decoding Intelligence: {progress}%</div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { l: 'Clinical Vectors', v: preview.entryCount || preview.shiftCount || 0, i: <FileText className="w-4 h-4" /> },
                { l: 'Temporal Scope', v: preview.dateRange, i: <Calendar className="w-4 h-4" /> },
                { l: 'Entities Active', v: preview.houseCount || 0, i: <Activity className="w-4 h-4" /> },
                { l: 'Threat Indicators', v: preview.redFlags || 0, c: 'text-flag-red', i: <AlertTriangle className="w-4 h-4" /> },
              ].map(s => (
                <div key={s.l} className="hc-clay-raised p-8 rounded-[2rem] relative overflow-hidden group/stat border border-hc-muted/5 transition-all hover:translate-y-[-2px]">
                  <div className="absolute top-0 right-0 p-6 opacity-5 text-hc-teal group-hover/stat:scale-125 transition-transform">{s.i}</div>
                  <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] mb-4 opacity-60">{s.l}</div>
                  <div className={`text-2xl font-black tabular-nums tracking-tighter ${s.c || 'text-hc-text'}`}>{s.v}</div>
                </div>
              ))}
            </div>

            <VerificationGrid items={preview.rawItems || []} type={preview.type} onUpdate={items => setPreview({ ...preview, rawItems: items })} />

            <div className="hc-clay-raised p-12 rounded-[3rem] border border-hc-muted/5 bg-black/[0.01] shadow-2xl">
              <div className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-hc-teal shadow-[0_0_10px_#14b8a6]" />
                 Operational Routing Configuration
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
                <div className="space-y-6">
                  <label className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] ml-1">Dispatch Targets</label>
                  <div className="grid grid-cols-2 gap-4">
                    {['reports', 'templates', 'client-docs', 'roster'].map(t => (
                      <label key={t} className={`flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all border
                        ${selectedTargets.includes(t as ImportTarget) ? 'hc-clay-inset bg-hc-bg/50 border-hc-teal/30' : 'hc-clay-raised border-hc-muted/5 hover:border-hc-muted/20'}`}>
                        <input type="checkbox" className="hidden" checked={selectedTargets.includes(t as ImportTarget)} onChange={() => setSelectedTargets(p => p.includes(t as ImportTarget) ? p.filter(x => x !== t) : [...p, t as ImportTarget])} />
                        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${selectedTargets.includes(t as ImportTarget) ? 'bg-hc-teal border-hc-teal' : 'border-hc-muted/20'}`}>
                          {selectedTargets.includes(t as ImportTarget) && <Check className="w-3 h-3 text-hc-bg" strokeWidth={4} />}
                        </div>
                        <span className="text-[10px] font-black uppercase text-hc-text tracking-widest">{t.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-6">
                   <label className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] ml-1">Entity Resolution Strategy</label>
                   <select value={clientMode} onChange={e => setClientMode(e.target.value as ClientMode)} className="w-full hc-clay-inset px-6 py-4 rounded-2xl text-[11px] font-black uppercase text-hc-text tracking-widest outline-none shadow-inner mb-4">
                     <option value="global">Injest to Global Ledger</option>
                     <option value="auto">Auto-Synthesise Intelligence</option>
                     <option value="specific">Target Specific Entity Matrix</option>
                   </select>
                   {clientMode === 'specific' && (
                     <select value={selectedClientId || ''} onChange={e => setSelectedClientId(e.target.value)} className="w-full hc-clay-inset px-6 py-4 rounded-2xl text-[11px] font-black uppercase text-hc-text tracking-widest outline-none shadow-inner animate-in slide-in-from-top-2">
                        <option value="">Select Personnel Record...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                   )}
                </div>
              </div>

              <div className="flex gap-6 pt-10 border-t border-hc-muted/10">
                <button onClick={() => handleConfirm()} className="flex-1 py-5 rounded-[1.5rem] btn-tactical text-hc-bg text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">Execute Intake Mapping</button>
                <button onClick={reset} className="px-12 hc-clay-raised border border-hc-muted/5 text-hc-muted py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:text-hc-text active:scale-95 transition-all shadow-xl">Discard Cycle</button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 animate-in zoom-in-95 duration-700">
            <div className="w-28 h-24 rounded-[2.5rem] bg-flag-green/10 border-2 border-flag-green/30 flex items-center justify-center mb-12 shadow-2xl shadow-flag-green/10">
               <Check className="w-12 h-12 text-flag-green" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-black text-hc-text tracking-tighter uppercase mb-4">Stream Injest Successful</h2>
            <p className="text-[11px] text-hc-muted text-center max-w-sm mb-16 uppercase leading-relaxed tracking-[0.2em] font-black opacity-60 italic">"{resultMsg}"</p>
            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
              <button onClick={() => setPage('dashboard')} className="py-5 hc-clay-raised rounded-2xl text-[10px] font-black uppercase tracking-widest text-hc-text hover:brightness-95 transition-all shadow-xl">Command Center</button>
              <button onClick={reset} className="py-5 btn-tactical text-hc-bg rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl">Next Segment</button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center py-24">
            <AlertTriangle className="w-16 h-16 text-flag-red mb-8 animate-pulse" />
            <h2 className="text-2xl font-black text-flag-red uppercase tracking-tighter mb-4">Injest Fault Protocol</h2>
            <p className="text-[11px] text-hc-muted text-center max-w-md mb-12 font-mono italic opacity-60">"{errorMsg}"</p>
            <button onClick={reset} className="px-12 py-4 hc-clay-raised border border-hc-muted/10 text-hc-text text-[10px] font-black uppercase tracking-widest rounded-2xl hover:brightness-95 transition-all shadow-xl">Reset Intake Module</button>
          </div>
        )}
      </div>

      <div className="mt-auto p-8 flex justify-center border-t border-hc-muted/10 bg-black/[0.02]">
        <div className="flex items-center gap-3 text-[10px] font-black text-hc-muted uppercase tracking-[0.4em] opacity-40">
           <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
           Field Extraction Intelligence // End-to-End Encryption Vector
        </div>
      </div>
    </div>
  );
}
