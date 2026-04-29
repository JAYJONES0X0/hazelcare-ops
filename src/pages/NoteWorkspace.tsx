import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FileText, Search, Sparkles, Copy, CheckCircle, Download, Trash2, ChevronRight, Users, Calendar, ArrowUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { flattenWeekEntries } from '../lib/staff-monitoring';
import { detectClinicalGaps, type ClinicalGap } from '../lib/continuity-engine';
import type { CareEntry } from '../lib/types';
import { extractFileText } from '../lib/universal-extractor';
import { getAllEntriesAsync, appendEntriesAsync, getStoreBoundsAsync } from '../lib/entry-store';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';

export function NoteWorkspace() {
  const [importLoading, setImportLoading] = useState(false);
  const [importInfo, setImportInfo] = useState('');
  const [booting, setBooting] = useState(true);

  // Load from IndexedDB async on mount — no 5MB localStorage cap
  const [entries, setEntries] = useState<CareEntry[]>([]);
  const [storeBounds, setStoreBounds] = useState<{ from: string; to: string; count: number } | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [goldTemplate, setGoldTemplate] = useState('');
  const [showGoldSuite, setShowGoldSuite] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void getAllEntriesAsync().then(rows => {
      if (!alive) return;
      setEntries(rows);
      setBooting(false);
    });
    void getStoreBoundsAsync().then(b => { if (alive) setStoreBounds(b); });
    return () => { alive = false; };
  }, []);

  // AUTO-SNAP: When filters change, jump to the start of the intelligence
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [selectedClient, dateRange]);
  const [showJumpTop, setShowJumpTop] = useState(false);
  const [rewriteMap, setRewriteMap] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [displayCount, setDisplayCount] = useState(30);

  const allClients = useMemo(() => {
    const names = new Set<string>();
    const SKIP = new Set(['unknown', 'service user unassigned', 'personnel unassigned']);
    for (const e of entries) {
      if (e.client && e.client.trim() && !SKIP.has(e.client.toLowerCase().trim())) names.add(e.client.trim());
    }
    return Array.from(names).sort();
  }, [entries]);

  // Filtered clients by search
  const visibleClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients;
    return allClients.filter(c => c.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [allClients, clientSearch]);

  // Filtered entries + Continuity Gaps
  const { visibleItems, stats } = useMemo(() => {
    const raw = entries.filter(e => {
      if (selectedClient && !e.client?.toLowerCase().includes(selectedClient.toLowerCase())) return false;
      if (dateRange.from || dateRange.to) {
        const dparts = e.date.split('/');
        if (dparts.length !== 3) return false;
        const iso = `${dparts[2]}-${dparts[1].padStart(2, '0')}-${dparts[0].padStart(2, '0')}`;
        const from = dateRange.from ? dateRange.from.split('/').reverse().map(s => s.padStart(2, '0')).join('-') : null;
        const to = dateRange.to ? dateRange.to.split('/').reverse().map(s => s.padStart(2, '0')).join('-') : null;
        if (from && iso < from) return false;
        if (to && iso > to) return false;
      }
      return true;
    });

    const gaps = detectClinicalGaps(raw);
    const combined = [
      ...raw.map(e => ({ ...e, type: 'entry' as const })),
      ...gaps.map(g => ({ ...g, type: 'gap' as const, entry: '', carer: 'SYSTEM_AUDIT' }))
    ];

    const sorted = combined.sort((a, b) => {
      const pa = a.date.split('/'); const pb = b.date.split('/');
      const da = `${pa[2]}-${pa[1].padStart(2, '0')}-${pa[0].padStart(2, '0')}`;
      const db = `${pb[2]}-${pb[1].padStart(2, '0')}-${pb[0].padStart(2, '0')}`;
      if (db !== da) return db.localeCompare(da);
      return (b.type === 'gap' ? 1 : 0) - (a.type === 'gap' ? 1 : 0);
    });

    return { 
      visibleItems: sorted,
      stats: { entries: raw.length, gaps: gaps.length, criticalGaps: gaps.filter(g => g.severity === 'red').length }
    };
  }, [entries, selectedClient, dateRange]);

  const filtered = visibleItems;

  // Reset display count on filter change
  useEffect(() => { setDisplayCount(30); }, [selectedClient, dateRange]);

  // Entry count per client (for sidebar badges)
  const clientEntryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      if (e.client?.trim()) map[e.client.trim()] = (map[e.client.trim()] || 0) + 1;
    }
    return map;
  }, [entries]);

  const handleImportFile = useCallback(async (file: File) => {
    setImportLoading(true);
    setImportInfo('');
    try {
      const text = await extractFileText(file);
      const envelope = buildEnvelopeFromRaw(file.name, text);
      let loaded: CareEntry[] = [];
      if (envelope.diaryEntries?.length) {
        loaded = envelope.diaryEntries;
      } else if (envelope.weekSummary) {
        loaded = flattenWeekEntries(envelope.weekSummary);
      }
      // Write to IndexedDB (no cap) and then reload from IDB for real count
      const added = await appendEntriesAsync(loaded);
      const all = await getAllEntriesAsync();
      setEntries(all);
      const bounds = await getStoreBoundsAsync();
      setStoreBounds(bounds);
      setImportInfo(`${loaded.length} entries parsed · ${added} new · ${all.length} total in store · ${file.name}`);
    } catch (e) {
      setImportInfo(`Failed to parse: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setImportLoading(false);
    }
  }, []);

  const runRewrite = async (entryKey: string, text: string, clientName: string) => {
    setLoadingMap(prev => ({ ...prev, [entryKey]: true }));
    try {
      const res = await fetch('/api/staff/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, noteType: '1:1 Support', clientName, referenceTemplate: goldTemplate }),
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
        setRewriteMap(prev => ({ ...prev, [entryKey]: result }));
      }
    } catch (e) {
      setRewriteMap(prev => ({ ...prev, [entryKey]: `ERR: ${e instanceof Error ? e.message : 'Unknown'}` }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [entryKey]: false }));
    }
  };

  const copyToClipboard = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedMap(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setCopiedMap(prev => ({ ...prev, [key]: false })), 2000);
  };

  const hasData = entries.length > 0;

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden animate-in fade-in duration-500">

      {/* ── Left: Client Switcher ─────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-hc-border/20 flex flex-col bg-hc-surface overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-hc-border/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-hc-teal" />
              <span className="text-[11px] font-black text-hc-muted uppercase tracking-widest">
                {allClients.length} Clients
              </span>
            </div>
            {storeBounds && (
              <span className="text-[11px] font-black text-hc-muted/40 tabular-nums">
                {storeBounds.count.toLocaleString()} entries
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-hc-muted/50" />
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Search clients…"
              className="hc-clay-inset w-full rounded-xl pl-9 pr-4 py-2.5 text-[11px] font-black text-hc-text focus:outline-none placeholder:text-hc-muted/40"
            />
          </div>
        </div>

        {/* Import button */}
        <div className="p-4 border-b border-hc-border/20">
          <input type="file" id="workspace-upload" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />
          <button onClick={() => document.getElementById('workspace-upload')?.click()}
            disabled={importLoading}
            className="w-full flex items-center justify-center gap-2 btn-tactical text-[10px] py-2.5 rounded-xl">
            <Download className="w-3.5 h-3.5" />
            {importLoading ? 'Loading...' : hasData ? 'Add More Data' : 'Import CSV / Excel'}
          </button>
          {importInfo && (
            <p className={`mt-2 text-[11px] font-black uppercase tracking-widest leading-relaxed ${importInfo.includes('Failed') ? 'text-flag-red' : 'text-hc-teal'}`}>
              {importInfo}
            </p>
          )}
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {booting ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-hc-muted text-center animate-pulse">
              <Sparkles className="w-10 h-10 text-hc-teal/40 mb-4 animate-spin-slow" />
              <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Hydrating...</div>
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-hc-muted text-center">
              <FileText className="w-10 h-10 text-hc-muted mb-4" />
              <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest">No data loaded</div>
              <div className="text-[11px] text-hc-muted mt-1">Import a diary CSV or ZIP to begin</div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setSelectedClient(null)}
                className={`w-full text-left px-5 py-3.5 flex items-center justify-between border-b border-hc-border/10 transition-all ${
                  !selectedClient
                    ? 'bg-hc-teal/10 border-l-2 border-l-hc-teal'
                    : 'hover:bg-hc-border/10'
                }`}
              >
                <span className="text-[11px] font-black text-hc-text uppercase tracking-wider">All Clients</span>
                <span className="text-[11px] font-black text-hc-muted tabular-nums">{entries.length}</span>
              </button>
              {visibleClients.map(client => (
                <button
                  key={client}
                  onClick={() => setSelectedClient(client)}
                  className={`w-full text-left px-5 py-3 flex items-center justify-between border-b border-hc-border/10 transition-all group ${
                    selectedClient === client
                      ? 'bg-hc-teal/10 border-l-2 border-l-hc-teal'
                      : 'hover:bg-hc-border/10'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                      selectedClient === client ? 'bg-hc-teal text-hc-bone' : 'bg-hc-border/30 text-hc-muted group-hover:bg-hc-teal/20 group-hover:text-hc-teal'
                    }`}>
                      {client[0].toUpperCase()}
                    </div>
                    <span className={`text-[11px] font-black truncate ${selectedClient === client ? 'text-hc-teal' : 'text-hc-text'}`}>
                      {client}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] font-black text-hc-muted tabular-nums">{clientEntryCounts[client] || 0}</span>
                    <ChevronRight className={`w-3 h-3 text-hc-muted/40 transition-transform ${selectedClient === client ? 'rotate-90' : ''}`} />
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Main Workspace ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Workspace header */}
        <div className="px-8 py-5 border-b border-hc-border/20 flex items-center justify-between gap-6 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-black text-hc-text uppercase tracking-[0.15em]">
                {selectedClient || 'All Clients'}
              </h1>
              <span className="pill pill-teal text-[11px] font-black px-3 py-1">Note Workspace</span>
            </div>
            <p className="text-[11px] text-hc-muted font-black uppercase tracking-widest mt-1">
              {filtered.length.toLocaleString()} entries in view
              {!selectedClient && filtered.length > 0 && ' · Select a client to focus'}
              {filtered.length === 0 && hasData && storeBounds && ` · Data range: ${storeBounds.from} → ${storeBounds.to}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {storeBounds && (
              <div className="flex items-center gap-2 hc-clay-inset px-4 py-2 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-hc-teal" />
                <span className="text-[11px] font-black text-hc-muted uppercase tracking-widest">
                  Store: {storeBounds.from} → {storeBounds.to}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Date range + Gold Standard controls (Sticky Tactical Bar) */}
        <div className="px-8 py-4 border-b border-hc-border/20 flex flex-col gap-4 shrink-0 bg-hc-bg/80 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
          <DateRangePicker range={dateRange} onChange={setDateRange} entryCount={filtered.length} compact />

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => setShowGoldSuite(!showGoldSuite)}
              className="flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 text-[10px] font-black text-hc-teal uppercase tracking-widest group-hover:opacity-70 transition-opacity">
                <Sparkles className="w-3 h-3" />
                {showGoldSuite ? 'Hide Gold Standard Assistant' : 'Show Gold Standard Assistant'}
              </div>
              {!showGoldSuite && goldTemplate && (
                <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest italic truncate max-w-[300px]">
                  Rubric active: "{goldTemplate.slice(0, 40)}..."
                </span>
              )}
            </button>
            
            {showGoldSuite && (
              <div className="animate-in slide-in-from-top-2 duration-300 flex items-start gap-4">
                <div className="flex-1 relative">
                  <textarea
                    value={goldTemplate}
                    onChange={e => setGoldTemplate(e.target.value)}
                    placeholder="Paste your gold standard note here — the AI will use this as the target rubric for all rewrites..."
                    rows={3}
                    className="w-full hc-clay-inset p-4 text-[13px] text-hc-text/90 italic focus:outline-none resize-none scrollbar-thin"
                  />
                  {!goldTemplate && (
                    <div className="absolute inset-0 pointer-events-none flex items-center p-4">
                      <div className="flex items-center gap-3 opacity-20">
                        <FileText className="w-5 h-5 text-hc-teal" />
                      </div>
                    </div>
                  )}
                </div>
                {goldTemplate && (
                  <button onClick={() => setGoldTemplate('')}
                    className="shrink-0 p-2.5 hc-clay-raised rounded-xl text-hc-muted hover:text-flag-red transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Entry list */}
        <div 
          ref={listRef}
          onScroll={(e) => {
            const top = (e.target as HTMLElement).scrollTop;
            setShowJumpTop(top > 400);
          }}
          className="flex-1 overflow-y-auto scrollbar-thin p-8 space-y-6 relative scroll-smooth"
        >
          {showJumpTop && (
            <button 
              onClick={() => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-10 right-10 z-50 p-4 rounded-2xl hc-clay-raised text-hc-teal animate-in fade-in zoom-in duration-300 hover:scale-110 active:scale-95 transition-all shadow-2xl"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
          {booting && (
            <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-hc-surface/50">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-hc-teal/20 border-t-hc-teal rounded-full animate-spin mb-4" />
                <div className="text-[11px] font-black text-hc-teal animate-pulse uppercase tracking-[0.3em]">Booting Intelligence Matrix</div>
                <div className="text-[10px] text-hc-muted uppercase mt-2">Hydrating 13,000+ clinical records</div>
              </div>
            </div>
          )}
          {!booting && !hasData && (
            <div className="flex flex-col items-center justify-center h-full text-hc-muted text-center">
              <FileText className="w-16 h-16 text-hc-muted mb-6" />
              <div className="text-sm font-black text-hc-text uppercase tracking-[0.2em]">Import a diary export to begin</div>
              <p className="text-[11px] text-hc-muted mt-2 uppercase tracking-widest">Supports CSV, Excel, PDF, ZIP — one import covers all clients</p>
            </div>
          )}

          {hasData && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-hc-muted text-center">
              <Search className="w-16 h-16 text-hc-muted mb-6" />
              <div className="text-sm font-black text-hc-text uppercase tracking-[0.2em]">No entries matched</div>
              <p className="text-[11px] text-hc-muted mt-2 uppercase tracking-widest">Adjust the date range or select a different client</p>
              {storeBounds && (
                <p className="text-[11px] text-hc-teal mt-3 font-black uppercase tracking-widest">
                  Store covers {storeBounds.from} → {storeBounds.to}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-6 mb-8 px-4">
             <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Clinical Density:</span>
                <span className="text-[11px] font-black text-hc-text tabular-nums">{stats.entries} Records</span>
             </div>
             <div className="h-4 w-px bg-hc-border/30" />
             <div className="flex items-center gap-2">
                <span className={`text-[11px] font-black uppercase tracking-widest ${stats.gaps > 0 ? 'text-flag-amber' : 'text-hc-muted'}`}>
                  Continuity Gaps: {stats.gaps}
                </span>
                {stats.criticalGaps > 0 && (
                  <span className="btn-clay !bg-flag-red/10 !text-flag-red text-[9px] px-2 py-0.5 rounded-lg animate-pulse">
                    {stats.criticalGaps} DEEP SILENCE
                  </span>
                )}
             </div>
          </div>

          {visibleItems.slice(0, displayCount).map((item, i) => {
            if (item.type === 'gap') {
              const g = item as ClinicalGap;
              return (
                <div key={g.id} className="hc-clay-inset border border-flag-amber/20 bg-flag-amber/[0.03] p-6 rounded-[2rem] flex items-center justify-between group animate-in slide-in-from-left-4">
                  <div className="flex items-center gap-8">
                    <div className="w-12 h-12 rounded-2xl bg-flag-amber/10 border border-flag-amber/30 flex items-center justify-center">
                       <AlertTriangle className={`w-5 h-5 ${g.severity === 'red' ? 'text-flag-red animate-pulse' : 'text-flag-amber'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[11px] font-black text-flag-amber uppercase tracking-widest">Forensic Gap Detected</span>
                        <span className="text-flag-amber/30">/</span>
                        <span className="text-[12px] font-black text-hc-text tabular-nums">{g.date}</span>
                      </div>
                      <p className="text-[11px] font-medium text-hc-muted uppercase tracking-wider">
                        {g.severity === 'red' 
                          ? 'Zero clinical evidence found for this entire site window.' 
                          : `No diary entries for ${g.client} on this date.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {g.likelyCarers.length > 0 && (
                      <div className="text-right">
                        <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] block mb-1">Personnel on Shift</span>
                        <div className="flex gap-1 justify-end">
                          {g.likelyCarers.slice(0, 3).map(c => (
                            <span key={c} className="text-[9px] font-bold bg-hc-border/20 px-2 py-0.5 rounded-lg">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <ChevronRight className="text-flag-amber/20 group-hover:text-flag-amber transition-colors" />
                  </div>
                </div>
              );
            }

            const e = item as CareEntry;
            const key = e.id || `${e.date}-${e.carer}-${i}`;
            const rewrite = rewriteMap[key];
            const isLoading = loadingMap[key];
            const isCopied = copiedMap[key];
            return (
              <div key={key} className="hc-clay-raised overflow-hidden group">
                <div className="px-6 py-4 border-b border-hc-border/20 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="hc-clay-inset px-3 py-1.5 rounded-xl text-[11px] font-black text-hc-teal tabular-nums">{e.date}</span>
                    <span className="text-[11px] font-black text-hc-muted uppercase tracking-wide">{e.carer}</span>
                    <span className="text-hc-muted/30 font-black">→</span>
                    <span className="text-[11px] font-black text-hc-text uppercase tracking-wide">{e.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.category && (
                      <span className="pill pill-teal text-[11px] font-black px-2.5 py-1">
                        {e.category.replace(/_/g, ' ')}
                      </span>
                    )}
                    {e.severity === 'red' && <span className="pill pill-red text-[11px] font-black px-2.5 py-1">FLAG</span>}
                    {e.severity === 'amber' && <span className="pill pill-amber text-[11px] font-black px-2.5 py-1">AMBER</span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-hc-border/20">
                  <div className="p-6 space-y-3">
                    <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Original</div>
                    <p className="text-[12px] font-medium text-hc-text/80 leading-relaxed">{e.entry}</p>
                  </div>

                  <div className="p-6 space-y-3 bg-hc-teal/[0.02]">
                    <div className="text-[11px] font-black text-hc-teal uppercase tracking-widest">Refined Output</div>
                    {rewrite ? (
                      <div className="animate-in fade-in duration-500">
                        <p className="text-[12px] font-medium text-hc-text leading-relaxed italic">{rewrite}</p>
                        <div className="mt-6 flex gap-3">
                          <button onClick={() => copyToClipboard(key, rewrite)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${isCopied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}>
                            {isCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? 'Copied' : 'Copy to Clipboard'}
                          </button>
                          <button onClick={() => void runRewrite(key, e.entry, e.client)}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest hc-clay-inset text-hc-muted hover:text-hc-text transition-all disabled:opacity-50">
                            <Sparkles className="w-3.5 h-3.5" />
                            Regenerate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-start justify-center gap-4 py-4 text-hc-muted group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => void runRewrite(key, e.entry, e.client)}
                          disabled={isLoading || !goldTemplate}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl btn-tactical text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                          {isLoading ? 'Refining...' : goldTemplate ? 'Refine Entry' : 'Add Gold Standard above first'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length > displayCount && (
            <div className="flex justify-center pt-8 pb-12">
              <button 
                onClick={() => setDisplayCount(prev => prev + 30)}
                className="btn-clay px-12 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl group flex items-center gap-3"
              >
                <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                Load Clinical History
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
