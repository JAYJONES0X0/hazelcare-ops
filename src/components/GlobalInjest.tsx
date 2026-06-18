import { useState, useEffect } from 'react';
import { RefreshCw, FileText, CheckCircle, AlertTriangle, Sparkles, Zap, ArrowRight, X, Archive } from 'lucide-react';
import JSZip from 'jszip';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { extractFileText } from '../lib/universal-extractor';
import { routeImport } from '../lib/import-router';
import { loadWeekData } from '../lib/storage';
import { appendEntries } from '../lib/entry-store';
import { enrichEntriesWithRoster, parseClientRosterCSV, saveRosterShifts } from '../lib/roster-store';
import { parseRosterCSV as parseGroupedRosterCSV } from '../lib/universal-parser';
import type { ImportTarget, NormalizedImportEnvelope } from '../lib/import-intelligence';
import type { WeekSummary } from '../lib/types';
import { ORG_CONFIG } from '../lib/config';

interface Props {
  file: File | null;
  onClose: () => void;
  onDataParsed: (data: WeekSummary) => void;
}

export function GlobalInjest({ file, onClose, onDataParsed }: Props) {
  const [loading, setLoading] = useState(false);
  const [envelope, setEnvelope] = useState<NormalizedImportEnvelope | null>(null);
  const [zipEnvelopes, setZipEnvelopes] = useState<NormalizedImportEnvelope[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [resultSummary, setResultSummary] = useState('');

  useEffect(() => {
    if (file) {
      void processFile(file);
    }
  }, [file]);

  const processFile = async (f: File) => {
    setLoading(true);
    setError('');
    try {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext === 'zip') {
        const zip = await JSZip.loadAsync(await f.arrayBuffer());
        const entries = Object.values(zip.files).filter(entry => !entry.dir);
        const supported = entries.filter(entry => /\.(txt|csv|tsv|md|pdf|docx|xlsx|xls|xlsm)$/i.test(entry.name));
        
        if (!supported.length) {
          throw new Error('No supported clinical files found in this ZIP.');
        }

        const envs: NormalizedImportEnvelope[] = [];
        for (const entry of supported) {
          const displayName = entry.name.split('/').pop() || entry.name;
          let text = '';
          const entryExt = entry.name.split('.').pop()?.toLowerCase();
          
          if (entryExt === 'pdf' || entryExt === 'docx' || entryExt === 'xlsx' || entryExt === 'xls' || entryExt === 'xlsm') {
            const blob = await entry.async('blob');
            const nestedFile = new File([blob], displayName);
            text = await extractFileText(nestedFile);
          } else {
            text = await entry.async('text');
          }
          
          const env = buildEnvelopeFromRaw(displayName, text);
          envs.push(env);
        }
        setZipEnvelopes(envs);
        // Create a summary envelope for the UI.
        const summary = buildEnvelopeFromRaw(f.name, '');
        summary.source.detectedType = 'unknown';
        summary.source.confidence = 1.0;
        setEnvelope(summary);
      } else {
        const text = await extractFileText(f);
        const env = buildEnvelopeFromRaw(f.name, text);
        setEnvelope(env);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'File extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const mapBatchTargets = (env: NormalizedImportEnvelope, fallback: ImportTarget): ImportTarget[] => {
    if (env.source.detectedType === 'roster' || env.shifts?.length) return ['roster'];
    if (env.diaryEntries?.length || env.weekSummary) return ['reports'];
    if (env.admission || env.supportPlan || env.contactDetails) return ['client-docs'];
    return [fallback];
  };

  const saveRosterEnvelope = async (env: NormalizedImportEnvelope) => {
    let shifts = parseClientRosterCSV(env.rawText || '');
    if (shifts.length === 0) {
      const grouped = parseGroupedRosterCSV(env.rawText || '', env.source.fileName);
      shifts = grouped.map(shift => ({
        id: shift.id,
        client: shift.house || shift.staffId || 'Unassigned',
        clientRaw: shift.house || shift.staffId || 'Unassigned',
        house: '',
        date: shift.date,
        startTime: shift.startTime || '',
        endTime: shift.endTime || '',
        carers: shift.staffId ? [shift.staffId] : [],
        durationHours: shift.hours,
        shiftType: shift.type === 'long_day' ? 'long' : shift.type,
      }));
    }
    if (shifts.length) await saveRosterShifts(shifts);
    return shifts.length;
  };

  const handleRoute = async (target: 'reports' | 'templates' | 'client-docs') => {
    if (!envelope && !zipEnvelopes.length) return;
    
    setLoading(true);
    try {
      if (zipEnvelopes.length > 0) {
        let totalAdded = 0;
        let totalShifts = 0;
        let successCount = 0;
        
        for (const env of zipEnvelopes) {
          const targets = mapBatchTargets(env, target);
          if (targets.includes('roster')) {
            const added = await saveRosterEnvelope(env);
            if (added > 0) {
              totalShifts += added;
              successCount++;
            }
            continue;
          }

          const res = routeImport(env, { targets, clientMode: 'auto' });
          if (res.ok) {
            successCount++;
            if (env.diaryEntries?.length) {
              const enriched = await enrichEntriesWithRoster(env.diaryEntries);
              totalAdded += appendEntries(enriched);
            }
          }
        }
        
        setResultSummary(`Batch processed: ${successCount} files, ${totalAdded} entries and ${totalShifts} roster shifts added.`);
        if (target === 'reports') {
          const data = loadWeekData();
          if (data) onDataParsed(data);
        }
      } else if (envelope) {
        const res = routeImport(envelope, { targets: [target], clientMode: 'auto' });
        if (res.ok) {
          if (envelope.diaryEntries?.length) {
            const enriched = await enrichEntriesWithRoster(envelope.diaryEntries);
            appendEntries(enriched);
          }
          if (target === 'reports') {
            const data = loadWeekData();
            if (data) onDataParsed(data);
          }
          setResultSummary(res.messages[0] || 'Ingest successful');
        } else {
          throw new Error(res.warnings[0] || 'Routing failed');
        }
      }
      
      setDone(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Routing failed');
    } finally {
      setLoading(false);
    }
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-hc-text/20 backdrop-blur-md" onClick={onClose} />
      
      <div className="w-full max-w-xl hc-clay-raised relative overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        <div className="absolute top-0 left-0 w-full h-1 bg-hc-teal" />
        
        {/* Header */}
        <div className="p-8 border-b border-hc-muted/10 flex items-center justify-between bg-black/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center">
              <Zap className={`w-6 h-6 text-hc-teal ${loading ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h2 className="text-xl font-black text-hc-text tracking-tighter uppercase leading-none">Quick Import</h2>
              <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mt-1.5 opacity-60">File detected: {file.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-hc-muted hover:text-hc-text transition-colors">
            <X className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>

        <div className="p-10">
          {loading && (
            <div className="py-10 flex flex-col items-center gap-6">
              <RefreshCw className="w-12 h-12 text-hc-teal animate-spin" strokeWidth={1.5} />
              <div className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em]">Decoding Clinical Stream...</div>
            </div>
          )}

          {error && (
            <div className="p-8 rounded-2xl hc-clay-inset bg-flag-red/5 border border-flag-red/20 flex flex-col items-center gap-4">
              <AlertTriangle className="w-10 h-10 text-flag-red" />
              <div className="text-[11px] font-black text-flag-red uppercase tracking-widest text-center leading-loose">{error}</div>
              <button onClick={onClose} className="mt-4 px-8 py-3 rounded-xl hc-clay-raised text-[10px] font-black uppercase text-hc-text hover:brightness-90 transition-all">Dismiss Fault</button>
            </div>
          )}

          {envelope && !loading && !done && (
            <div className="animate-in fade-in duration-700 space-y-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="hc-clay-inset p-5 flex items-center gap-4">
                   {zipEnvelopes.length > 0 ? <Archive className="w-5 h-5 text-hc-teal" /> : <Zap className="w-5 h-5 text-hc-teal" />}
                   <div>
                     <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Import Type</div>
                     <div className="text-sm font-black text-hc-teal uppercase tracking-tighter">
                       {zipEnvelopes.length > 0 ? `ZIP BATCH (${zipEnvelopes.length})` : envelope.source.detectedType}
                     </div>
                   </div>
                </div>
                <div className="hc-clay-inset p-5">
                   <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Confidence</div>
                   <div className="text-sm font-black text-hc-text tabular-nums">{Math.round(envelope.source.confidence * 100)}%</div>
                </div>
              </div>

              {zipEnvelopes.length > 0 && (
                <div className="hc-clay-inset p-4 max-h-[120px] overflow-y-auto scrollbar-thin space-y-2">
                   {zipEnvelopes.map((env, i) => (
                     <div key={i} className="flex items-center justify-between text-[9px] font-black uppercase text-hc-muted">
                        <span className="truncate max-w-[70%]">{env.source.fileName}</span>
                        <span className="text-hc-teal">{env.source.detectedType}</span>
                     </div>
                   ))}
                </div>
              )}

              <div className="space-y-4">
                <p className="text-[10px] font-black text-hc-text uppercase tracking-[0.3em] opacity-40 px-1">Choose where this should go</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => handleRoute('reports')}
                    className="w-full p-6 hc-clay-raised hover:border-hc-teal/40 group flex items-center justify-between transition-all active:scale-[0.98]">
                    <div className="flex items-center gap-5">
                      <FileText className="w-5 h-5 text-hc-teal" />
                      <div className="text-left">
                        <div className="text-xs font-black text-hc-text uppercase tracking-widest">Add to Live Records</div>
                        <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mt-1">Route to Client Diaries & Quality Monitoring</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-hc-muted opacity-0 group-hover:opacity-100 transition-all" />
                  </button>

                  <button onClick={() => handleRoute('client-docs')}
                    className="w-full p-6 hc-clay-raised hover:border-hc-teal/40 group flex items-center justify-between transition-all active:scale-[0.98]">
                    <div className="flex items-center gap-5">
                      <Sparkles className="w-5 h-5 text-hc-teal" />
                      <div className="text-left">
                        <div className="text-xs font-black text-hc-text uppercase tracking-widest">Client Documents</div>
                        <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mt-1">Update Care Plans, Risk Matrices & PBS Protocols</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-hc-muted opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {done && (
            <div className="py-12 flex flex-col items-center gap-8 animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 rounded-3xl bg-flag-green/10 border-2 border-flag-green/30 flex items-center justify-center shadow-2xl">
                <CheckCircle className="w-12 h-12 text-flag-green" strokeWidth={3} />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black text-hc-text tracking-tighter uppercase">Import Complete</h3>
                <p className="text-[10px] font-black text-flag-green uppercase tracking-[0.2em] mt-2 font-mono italic">{resultSummary}</p>
                <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mt-4">OS state synchronized with {ORG_CONFIG.name} registration</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
