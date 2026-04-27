import { useState, useEffect } from 'react';
import { RefreshCw, FileText, CheckCircle, AlertTriangle, Sparkles, Zap, ArrowRight, X } from 'lucide-react';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { extractFileText } from '../lib/universal-extractor';
import { routeImport } from '../lib/import-router';
import { loadWeekData } from '../lib/storage';
import type { NormalizedImportEnvelope } from '../lib/import-intelligence';
import type { Page } from '../lib/types';
import { ORG_CONFIG } from '../lib/config';

interface Props {
  file: File | null;
  onClose: () => void;
  onDataParsed: (data: any) => void;
  setPage: (p: Page) => void;
}

export function GlobalInjest({ file, onClose, onDataParsed, setPage }: Props) {
  const [loading, setLoading] = useState(false);
  const [envelope, setEnvelope] = useState<NormalizedImportEnvelope | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (file) {
      void processFile(file);
    }
  }, [file]);

  const processFile = async (f: File) => {
    setLoading(true);
    setError('');
    try {
      const text = await extractFileText(f);
      const env = buildEnvelopeFromRaw(f.name, text);
      setEnvelope(env);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vector extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRoute = (target: 'reports' | 'templates' | 'client-docs') => {
    if (!envelope) return;
    const res = routeImport(envelope, { 
      targets: [target], 
      clientMode: 'auto' 
    });
    
    if (res.ok) {
      if (target === 'reports') {
        const data = loadWeekData();
        if (data) onDataParsed(data);
      }
      setDone(true);
      setTimeout(() => {
        setPage(res.page);
        onClose();
      }, 1500);
    } else {
      setError(res.warnings[0] || 'Routing failed');
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
              <h2 className="text-xl font-black text-hc-text tracking-tighter uppercase leading-none">Intelligence Injest</h2>
              <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mt-1.5 opacity-60">Field Vector Detected: {file.name}</p>
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
                <div className="hc-clay-inset p-5">
                   <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Vector Type</div>
                   <div className="text-sm font-black text-hc-teal uppercase tracking-tighter">{envelope.source.detectedType}</div>
                </div>
                <div className="hc-clay-inset p-5">
                   <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Confidence</div>
                   <div className="text-sm font-black text-hc-text tabular-nums">{Math.round(envelope.source.confidence * 100)}%</div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-hc-text uppercase tracking-[0.3em] opacity-40 px-1">Select Dispatch Target</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => handleRoute('reports')}
                    className="w-full p-6 hc-clay-raised hover:border-hc-teal/40 group flex items-center justify-between transition-all active:scale-[0.98]">
                    <div className="flex items-center gap-5">
                      <FileText className="w-5 h-5 text-hc-teal" />
                      <div className="text-left">
                        <div className="text-xs font-black text-hc-text uppercase tracking-widest">Update Live Ledger</div>
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
                        <div className="text-xs font-black text-hc-text uppercase tracking-widest">Clinical Document Suite</div>
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
                <h3 className="text-2xl font-black text-hc-text tracking-tighter uppercase">Injest Vector Active</h3>
                <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mt-2">OS state synchronized with {ORG_CONFIG.name} registration</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
