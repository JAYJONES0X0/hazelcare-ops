import { useState, useCallback, useMemo } from 'react';
import { FileText, Search, User, Sparkles, Copy, CheckCircle, Download, Trash2 } from 'lucide-react';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { flattenWeekEntries } from '../lib/staff-monitoring';
import type { CareEntry } from '../lib/types';

import { extractFileText } from '../lib/universal-extractor';

export function NoteWorkspace() {
  const [importLoading, setImportLoading] = useState(false);
  const [entries, setEntries] = useState<CareEntry[]>([]);
  
  const [targetClient, setTargetClient] = useState('Max Nicholson');
  const [dateFrom, setDateFrom] = useState('2026-03-09');
  const [dateTo, setDateTo] = useState('2026-03-23');
  const [goldTemplate, setTargetTemplate] = useState('');

  const [rewriteMap, setRewriteMap] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});

  const handleImportFile = useCallback(async (file: File) => {
    setImportLoading(true);
    try {
      const text = await extractFileText(file);
      const envelope = buildEnvelopeFromRaw(file.name, text);
      if (envelope.diaryEntries) {
        setEntries(envelope.diaryEntries);
      } else if (envelope.weekSummary) {
        const flat = flattenWeekEntries(envelope.weekSummary);
        setEntries(flat);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setImportLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const clientMatch = !targetClient || e.client.toLowerCase().includes(targetClient.toLowerCase());
      if (!clientMatch) return false;
      
      if (dateFrom || dateTo) {
        // Parse DD/MM/YYYY to YYYY-MM-DD for comparison
        const parts = e.date.split('/');
        if (parts.length === 3) {
          const entryDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          if (dateFrom && entryDate < dateFrom) return false;
          if (dateTo && entryDate > dateTo) return false;
        }
      }
      return true;
    });
  }, [entries, targetClient, dateFrom, dateTo]);

  const runRewrite = async (entryId: string, text: string, clientName: string) => {
    setLoadingMap(prev => ({ ...prev, [entryId]: true }));
    try {
      const res = await fetch('/api/staff/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          noteType: '1:1 Support', 
          clientName,
          referenceTemplate: goldTemplate 
        }),
      });
      if (!res.ok) throw new Error('Rewrite engine offline');
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
        setRewriteMap(prev => ({ ...prev, [entryId]: result }));
      }
    } catch (e) {
      setRewriteMap(prev => ({ ...prev, [entryId]: `ERR: ${e instanceof Error ? e.message : 'Unknown'}` }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [entryId]: false }));
    }
  };

  const copyToClipboard = (entryId: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedMap(prev => ({ ...prev, [entryId]: true }));
    setTimeout(() => setCopiedMap(prev => ({ ...prev, [entryId]: false })), 2000);
  };

  return (
    <div className="p-6 lg:p-10 w-full max-w-[2560px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-hc-muted/10 pb-10">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-hc-text tracking-[0.2em] uppercase flex items-center gap-4">
            Note Workspace
            <span className="pill pill-teal text-[10px] font-black tracking-[0.2em] px-4 py-1">Clinical Refinement</span>
          </h1>
          <p className="text-hc-text text-sm font-bold mt-3 max-w-2xl leading-relaxed uppercase tracking-wider">
            Surgical Note Replacement Logic. Calibrate diary entries against Gold Standard templates.
          </p>
        </div>
        <div className="flex gap-4">
           <input type="file" id="workspace-upload" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f) void handleImportFile(f); }} />
           <button onClick={() => document.getElementById('workspace-upload')?.click()} disabled={importLoading}
             className="flex items-center gap-3 px-8 py-3.5 rounded-2xl btn-tactical text-[11px] font-black shadow-2xl hover:scale-105 transition-all">
             <Download className="w-4 h-4" /> 
             {importLoading ? 'Analyzing Stream...' : 'Injest Diary Vector'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        
        {/* Left Column: Calibration Controls */}
        <div className="xl:col-span-4 flex flex-col gap-8">
          <div className="hc-clay-raised p-8 space-y-8">
            <h2 className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em] flex items-center gap-3">
              <Search className="w-4 h-4 text-hc-teal" /> Target Calibration
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[9px] font-black text-hc-text uppercase tracking-widest opacity-60">Client Subject</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-hc-teal" />
                  <input value={targetClient} onChange={e => setTargetClient(e.target.value)}
                    className="w-full hc-clay-inset pl-12 pr-4 py-4 text-xs font-black text-hc-text uppercase tracking-widest outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-hc-text uppercase tracking-widest opacity-60">Date From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full hc-clay-inset px-4 py-4 text-xs font-black text-hc-text outline-none" />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-hc-text uppercase tracking-widest opacity-60">Date To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full hc-clay-inset px-4 py-4 text-xs font-black text-hc-text outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="hc-clay-raised p-8 flex flex-col gap-6">
            <h2 className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em] flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-hc-teal" /> Gold Standard Template
            </h2>
            <p className="text-[10px] text-hc-text font-black uppercase tracking-widest leading-loose opacity-60">
              Paste your "Jamie-grade" clinical note here. The engine will use this as the target rubric for all rewrites.
            </p>
            <textarea 
              value={goldTemplate}
              onChange={e => setTargetTemplate(e.target.value)}
              placeholder="PASTE OPTIMAL STANDING NOTE HERE..."
              className="w-full min-h-[300px] hc-clay-inset p-6 text-xs font-black text-hc-text uppercase tracking-widest leading-relaxed outline-none scrollbar-thin resize-none"
            />
            {goldTemplate && (
              <button onClick={() => setTargetTemplate('')} className="flex items-center gap-2 text-[9px] font-black text-flag-red uppercase tracking-widest self-end hover:brightness-90 transition-all">
                <Trash2 className="w-3.5 h-3.5" /> Purge Template
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Refinement Matrix */}
        <div className="xl:col-span-8 space-y-8">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-hc-teal animate-pulse" />
              <span className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em]">Refinement Matrix — {filtered.length} Vectors</span>
            </div>
          </div>

          <div className="space-y-6">
            {filtered.map((e, i) => {
              const rewrite = rewriteMap[e.id || i];
              const isLoading = loadingMap[e.id || i];
              const isCopied = copiedMap[e.id || i];
              
              return (
                <div key={e.id || i} className="hc-clay-raised overflow-hidden group">
                  <div className="p-6 bg-black/[0.02] border-b border-hc-muted/5 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="px-4 py-2 rounded-lg hc-clay-inset text-[10px] font-black text-hc-teal tabular-nums">{e.date}</div>
                      <div className="text-[10px] font-black text-hc-text uppercase tracking-[0.2em]">{e.carer} ➔ {e.client}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="pill !bg-hc-bg text-hc-text text-[9px] uppercase font-black">{e.type}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-hc-muted/10">
                    <div className="p-8 space-y-4">
                      <div className="text-[9px] font-black text-hc-text uppercase tracking-widest opacity-40">Original Source</div>
                      <p className="text-[13px] font-black text-hc-text/80 leading-relaxed uppercase">{e.entry}</p>
                    </div>
                    
                    <div className="p-8 space-y-4 bg-hc-teal/[0.02] relative">
                      <div className="text-[9px] font-black text-hc-teal uppercase tracking-widest">Refined Output</div>
                      {rewrite ? (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                          <p className="text-[13px] font-black text-hc-text leading-relaxed italic uppercase">{rewrite}</p>
                          <div className="mt-8 flex justify-end gap-3">
                            <button onClick={() => copyToClipboard(e.id || String(i), rewrite)}
                              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isCopied ? 'bg-flag-green text-hc-bg' : 'hc-clay-raised text-hc-text hover:bg-black/5'}`}>
                              {isCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {isCopied ? 'Copied' : 'Copy for Nourish'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center py-10 gap-6 opacity-40 group-hover:opacity-100 transition-opacity">
                          <Sparkles className={`w-8 h-8 text-hc-teal ${isLoading ? 'animate-spin' : ''}`} />
                          <button onClick={() => void runRewrite(e.id || String(i), e.entry, e.client)} disabled={isLoading || !goldTemplate}
                            className="px-8 py-3 rounded-2xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-text hover:bg-hc-teal hover:text-hc-bg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            {isLoading ? 'Processing...' : goldTemplate ? 'Refine Vector' : 'Template Required'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filtered.length === 0 && (
              <div className="hc-clay-raised p-20 flex flex-col items-center justify-center opacity-40 text-center">
                <FileText className="w-16 h-16 text-hc-text mb-8" />
                <div className="text-sm font-black text-hc-text uppercase tracking-[0.3em]">No Vectors Matched in Current Aperture</div>
                <p className="text-xs text-hc-text mt-4 font-bold uppercase tracking-widest">Adjust filters or injest a new diary export.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
