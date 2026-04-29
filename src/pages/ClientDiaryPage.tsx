import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { WeekSummary, CareEntry, Page } from '../lib/types';
import { loadClients } from '../lib/client-store';

// ── PDF import types ──────────────────────────────────────────────────────────
interface PdfDiaryEntry {
  client: string;
  carer: string;
  date: string;
  type: string;
  entry: string;
}

async function parseDiaryPdf(file: File): Promise<PdfDiaryEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = await import('pdfjs-dist') as any;
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fullText += (tc.items as any[]).map((it: { str: string }) => it.str).join(' ') + '\n';
  }

  // Best-effort extraction: split on date patterns and build entries
  const entries: PdfDiaryEntry[] = [];
  // Match lines like: "08/04/2026" or "8 April 2026" followed by content
  const datePattern = /(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})/gi;
  const blocks = fullText.split(datePattern).filter(s => s.trim());

  // Attempt to extract client name from first block
  const clientMatch = fullText.match(/(?:Client|Service User|Name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  const clientName = clientMatch ? clientMatch[1] : file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').replace(/[()]/g, '').trim();

  // Attempt to extract carer names - lines starting with known patterns
  let currentDate = '';
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i].trim();
    if (!b) continue;
    if (datePattern.test(b)) {
      currentDate = b;
      continue;
    }
    if (currentDate && b.length > 10) {
      // Try to extract carer from "Written by" or "Staff:" patterns
      const carerMatch = b.match(/(?:Written by|Staff|Carer|Author)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      const carer = carerMatch ? carerMatch[1] : 'Unknown';

      // Determine type
      const lower = b.toLowerCase();
      const type = lower.includes('medication') ? 'Medication'
        : lower.includes('personal care') || lower.includes('shower') || lower.includes('bath') ? 'Personal Care'
        : lower.includes('incident') ? 'Incident'
        : lower.includes('handover') ? 'Handover'
        : lower.includes('activity') || lower.includes('engagement') ? 'Activity'
        : '1:1 Support';

      entries.push({
        client: clientName,
        carer,
        date: currentDate,
        type,
        entry: b,
      });
      currentDate = '';
    }
  }

  // Fallback: if no structured entries found, create one block per page-worth of text
  if (entries.length === 0 && fullText.trim()) {
    const paragraphs = fullText.split(/\n{2,}/).filter(p => p.trim().length > 20);
    for (const p of paragraphs.slice(0, 50)) {
      entries.push({
        client: clientName,
        carer: 'Unknown',
        date: '',
        type: '1:1 Support',
        entry: p.trim(),
      });
    }
  }

  return entries;
}

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
  pageCtx?: { client?: string; house?: string; severity?: string };
  onQuickAction: (opts: { type: 'action' | 'incident'; content?: string; house?: string; client?: string }) => void;
}

function typeColor(type: string) {
  const t = type?.toLowerCase() || '';
  if (t.includes('incident') || t.includes('safeguarding') || t.includes('police')) return '#ef4444';
  if (t.includes('medication') || t.includes('doctor')) return '#14b8a6';
  if (t.includes('handover') || t.includes('staff')) return '#3b82f6';
  if (t.includes('activity') || t.includes('engagement')) return '#8b5cf6';
  if (t.includes('health') || t.includes('personal')) return '#f59e0b';
  return '#7a95b0';
}

function ClientStats({ entries }: { entries: CareEntry[] }) {
  const byType = useMemo(() => {
    const typeMatrix: Record<string, number> = {};
    entries.forEach(e => { typeMatrix[e.type] = (typeMatrix[e.type] || 0) + 1; });
    return Object.entries(typeMatrix).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const red = entries.filter(e => e.severity === 'red').length;
  const amber = entries.filter(e => e.severity === 'amber').length;
  const total = entries.length;

  return (
    <div className="space-y-6 mb-8">
      <div className="grid grid-cols-3 gap-3">
        <div className="hc-clay-raised border border-white/5 rounded-xl p-4 transition-all hover:scale-[1.02] shadow-lg">
          <div className="text-2xl font-black text-hc-text mb-0.5">{total}</div>
          <div className="section-header text-hc-muted text-[11px]">Total Entries</div>
        </div>
        <div className={`hc-clay-raised border border-flag-red/20 rounded-xl p-4 transition-all hover:scale-[1.02] shadow-lg ${red > 0 ? 'glow-red' : ''}`}>
          <div className={`text-2xl font-black mb-0.5 ${red > 0 ? 'text-flag-red' : 'text-hc-muted'}`}>{red}</div>
          <div className="section-header text-hc-muted text-[11px]">Red Flags</div>
        </div>
        <div className={`hc-clay-raised border border-flag-amber/20 rounded-xl p-4 transition-all hover:scale-[1.02] shadow-lg ${amber > 0 ? 'glow-amber' : ''}`}>
          <div className={`text-2xl font-black mb-0.5 ${amber > 0 ? 'text-flag-amber' : 'text-hc-muted'}`}>{amber}</div>
          <div className="section-header text-hc-muted text-[11px]">Amber Flags</div>
        </div>
      </div>

      {/* Type breakdown bar */}
      <div className="hc-clay-raised border border-white/5 rounded-xl p-5">
        <h3 className="section-header text-hc-text mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
          Weekly Patterns
        </h3>
        <div className="space-y-3">
          {byType.slice(0, 8).map(([type, count]) => (
            <div key={type} className="flex items-center gap-4 group/row cursor-default">
              <div className="text-[11px] font-bold text-hc-muted w-40 truncate group-hover/row:text-hc-text transition-colors uppercase tracking-wider">{type}</div>
              <div className="flex-1 h-2 bg-hc-dark/80 rounded-full overflow-hidden shadow-inner">
                <div className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(20,184,166,0.2)]" 
                  style={{ width: `${(count / total) * 100}%`, background: `linear-gradient(90deg, ${typeColor(type)}99, ${typeColor(type)})` }} />
              </div>
              <div className="text-xs font-black text-hc-text w-8 text-right tabular-nums">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClientDiaryPage({ weekData, setPage, pageCtx, onQuickAction }: Props) {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [houseFilter, setHouseFilter] = useState('');

  // Context Router Receiver
  useEffect(() => {
    if (pageCtx) {
      if (pageCtx.client) setSelectedClient(pageCtx.client);
      if (pageCtx.house) setHouseFilter(pageCtx.house);
      if (pageCtx.severity) setSeverityFilter(pageCtx.severity);
    }
  }, [pageCtx]);

  // PDF import state
  const [pdfEntries, setPdfEntries] = useState<PdfDiaryEntry[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfDrop = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setPdfError('Only PDF files are supported');
      return;
    }
    setPdfError('');
    setPdfLoading(true);
    try {
      const entries = await parseDiaryPdf(file);
      setPdfEntries(entries);
      if (entries.length > 0) setSelectedClient(entries[0].client);
    } catch (e) {
      setPdfError(`Could not parse PDF: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handlePdfDrop(file);
  }, [handlePdfDrop]);

  const storedClients = useMemo(() => loadClients().map(c => c.name.toLowerCase()), []);

  const clientDiary = weekData?.clientDiary || {};

  // Merge PDF entries into clientDiary view
  const mergedDiary = useMemo(() => {
    const d: Record<string, CareEntry[]> = { ...clientDiary };
    for (const pe of pdfEntries) {
      const key = pe.client;
      if (!d[key]) d[key] = [];
      // Avoid duplicates
      const exists = d[key].some(e => e.entry === pe.entry && e.date === pe.date);
      if (!exists) {
        d[key].push({
          id: `pdf-${pe.date}-${pe.carer}-${pe.entry.slice(0, 20)}`,
          client: pe.client,
          carer: pe.carer,
          date: pe.date,
          type: pe.type,
          category: 'daily',
          entry: pe.entry,
          house: '',
          severity: 'none',
          flags: [],
        } as unknown as CareEntry);
      }
    }
    return d;
  }, [clientDiary, pdfEntries]);

  const allClients = useMemo(() =>
    Object.keys(mergedDiary)
      .filter(name => {
        if (!name || ['Maintenance', 'Station', 'On Call'].includes(name)) return false;
        if (houseFilter) {
          const ce = mergedDiary[name];
          if (!ce.some(e => e.house?.toLowerCase() === houseFilter.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ra = (mergedDiary[a] || []).filter(e => e.severity === 'red').length;
        const rb = (mergedDiary[b] || []).filter(e => e.severity === 'red').length;
        if (rb !== ra) return rb - ra;
        const aa = (mergedDiary[a] || []).filter(e => e.severity === 'amber').length;
        const ab = (mergedDiary[b] || []).filter(e => e.severity === 'amber').length;
        if (ab !== aa) return ab - aa;
        return a.localeCompare(b);
      }),
    [mergedDiary]
  );

  const filteredClients = useMemo(() =>
    search.trim()
      ? allClients.filter(n => n.toLowerCase().includes(search.toLowerCase()))
      : allClients,
    [allClients, search]
  );

  const allTypes = useMemo(() => {
    const s = new Set<string>();
    Object.values(mergedDiary).flat().forEach(e => s.add(e.type));
    return [...s].sort();
  }, [mergedDiary]);

  const selectedEntries = useMemo(() => {
    if (!selectedClient) return [];
    let entries = mergedDiary[selectedClient] || [];
    if (houseFilter) entries = entries.filter(e => e.house?.toLowerCase() === houseFilter.toLowerCase());
    if (typeFilter) entries = entries.filter(e => e.type === typeFilter);
    if (severityFilter) {
      if (severityFilter === 'none') entries = entries.filter(e => e.severity === 'none');
      else entries = entries.filter(e => e.severity === severityFilter);
    }
    return [...entries].sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedClient, mergedDiary, houseFilter, typeFilter, severityFilter]);

  // PDF drop zone — shown when no weekData AND no PDF entries yet
  const showDropZone = !weekData && pdfEntries.length === 0;

  if (showDropZone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 animate-in fade-in zoom-in duration-500"
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handlePdfDrop(f); }} />
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-[2rem] p-10 mb-6 transition-all duration-300 flex flex-col items-center gap-4 hc-clay-raised"
          style={{
            border: isDragging ? '2px dashed rgba(20,184,166,0.6)' : '2px dashed rgba(255,255,255,0.1)',
            boxShadow: isDragging ? '0 0 40px rgba(20,184,166,0.15)' : '0 8px 40px rgba(0,0,0,0.5)',
          }}
        >
          <svg className={`w-14 h-14 transition-colors ${isDragging ? 'text-hc-teal' : 'text-hc-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="text-[11px] font-black tracking-[0.3em] text-hc-teal uppercase">
            {pdfLoading ? 'Reading PDF…' : isDragging ? 'Drop it' : 'Client Diary'}
          </div>
          <div className="text-hc-text font-black text-xl tracking-tight">
            {pdfLoading ? 'Parsing entries…' : 'Drop a diary PDF here'}
          </div>
          <div className="text-hc-muted text-xs max-w-xs leading-relaxed">
            Drop a CarePlanner diary export (PDF) directly here. No redirects.
          </div>
          {!pdfLoading && (
            <span className="text-[11px] font-bold text-hc-teal-light uppercase tracking-widest">or click to browse</span>
          )}
        </div>
        {pdfError && <div className="text-flag-red text-xs font-bold mt-2">{pdfError}</div>}
        <div className="h-px w-20 bg-white/5 my-5" />
        <button onClick={() => setPage('upload')} className="text-[11px] text-hc-muted hover:text-hc-text uppercase tracking-widest transition-colors">
          Or sync from global import
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden animate-in fade-in duration-700"
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      {/* Full-screen drop overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{background:'rgba(10,12,18,0.85)',backdropFilter:'blur(8px)'}}>
          <div className="rounded-[2rem] p-12 flex flex-col items-center gap-4"
            style={{border:'2px dashed rgba(20,184,166,0.6)',boxShadow:'0 0 60px rgba(20,184,166,0.2)'}}>
            <svg className="w-16 h-16 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-hc-text font-black text-xl">Drop diary PDF</div>
          </div>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handlePdfDrop(f); }} />

      {/* Client list sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-white/5 flex flex-col hc-clay-raised backdrop-blur-3xl">
        <div className="p-4 border-b border-white/5 hc-clay-inset">
          {/* Import button */}
          <button onClick={() => fileInputRef.current?.click()}
            className="w-full mb-3 py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase text-hc-teal-light cursor-pointer transition-all duration-200 hover:opacity-90"
            style={{background:'rgba(20,184,166,0.08)',border:'1px solid rgba(20,184,166,0.25)'}}>
            {pdfLoading ? 'Reading…' : '+ Import diary PDF'}
          </button>
          {pdfError && <div className="text-flag-red text-[11px] font-bold mb-2">{pdfError}</div>}
          <p className="section-header text-hc-muted text-[11px] mb-3 px-1">
            {allClients.length} clients{weekData ? ` · ${weekData.dateFrom}–${weekData.dateTo}` : ' · PDF import'}
          </p>
          <div className="relative group">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search entries…"
              className="w-full bg-hc-dark/60 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-hc-text focus:outline-none focus:border-hc-teal/50 focus:bg-hc-dark transition-all placeholder:text-hc-muted shadow-inner"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-hc-muted group-focus-within:text-hc-teal-light transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredClients.map(name => {
            const entries = mergedDiary[name] || [];
            const red = entries.filter(e => e.severity === 'red').length;
            const amber = entries.filter(e => e.severity === 'amber').length;
            const hasDocs = storedClients.some(n => n.includes(name.toLowerCase().split(' ')[0]));
            const isSelected = selectedClient === name;
            return (
              <button key={name} onClick={() => { setSelectedClient(name); setTypeFilter(''); setSeverityFilter(''); }}
                className={`w-full text-left px-4 py-4 border-b border-white/5 transition-all duration-500 group active:scale-95
                  ${isSelected ? 'bg-hc-teal/10 accent-bar z-10' : 'hover:bg-white/5'}`}>
                <div className="flex items-start justify-between gap-3 mb-2 relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                  <span className={`text-[14px] font-black tracking-tight leading-tight transition-colors group-hover:text-hc-text
                    ${isSelected ? 'text-hc-teal-light' : 'text-hc-text'}`}>
                    {name}
                  </span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {red > 0 && <span className="pill pill-red text-[11px] px-1.5 py-0 shadow-lg animate-pulse-soft">{red}</span>}
                    {amber > 0 && <span className="pill pill-amber text-[11px] px-1.5 py-0 shadow-lg">{amber}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                  <span className="text-[11px] font-black text-hc-muted group-hover:text-hc-muted/80 transition-colors uppercase tracking-[0.15em] tabular-nums">
                    {entries.length} TRANSMISSIONS
                  </span>
                  {hasDocs && (
                    <span className="flex items-center gap-1.5 text-[11px] font-black text-hc-teal-light/70 uppercase tracking-widest animate-pulse-soft">
                      <div className="w-1 h-1 rounded-full bg-hc-teal shadow-[0_0_5px_#14b8a6]" />
                      VIEW FILE
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin mesh-bg relative">
        {!selectedClient ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in fade-in duration-1000">
            <div className="w-24 h-24 rounded-3xl hc-clay-raised border border-white/10 flex items-center justify-center mb-8 glow-blue group">
              <span className="text-5xl grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 text-hc-muted">👤</span>
            </div>
            <p className="text-hc-text font-black tracking-[0.3em] uppercase text-xs">Select a house to view notes</p>
            <div className="h-px w-12 bg-white/10 my-4" />
            <p className="text-[11px] text-hc-text font-black uppercase tracking-[0.4em]">{allClients.length} people found</p>

          </div>
        ) : (
          <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto animate-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-hc-text mb-1 tracking-tighter uppercase text-shimmer">{selectedClient}</h2>
                <div className="flex items-center gap-3">
                  <span className="pill pill-teal text-[11px] uppercase tracking-[0.2em] font-black shadow-xl">Care Entries</span>
                  {weekData && (
                    <span className="text-hc-muted text-[11px] font-black uppercase tracking-[0.2em] ml-2 tabular-nums">
                      DATE RANGE: {weekData.dateFrom} – {weekData.dateTo}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                {storedClients.some(n => n.includes(selectedClient.toLowerCase().split(' ')[0])) && (
                  <button onClick={() => setPage('client-docs')}
                    className="px-8 py-3.5 hc-clay-raised border border-hc-teal/30 text-[11px] font-black uppercase tracking-[0.2em] text-hc-teal-light rounded-2xl hover:bg-hc-teal/10 hover:shadow-hc-teal/20 transition-all shadow-xl active:scale-95 group/btn">
                    <svg className="w-4 h-4 inline-block mr-2 group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    View Risk Assessment
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <ClientStats entries={mergedDiary[selectedClient] || []} />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6 hc-clay-raised border border-white/5 p-3 md:p-4 rounded-xl lg:rounded-2xl shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="section-header text-hc-muted text-[11px] tracking-[0.3em]">Filter:</span>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="bg-hc-dark/80 border border-white/10 rounded-xl px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-hc-text focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[180px]">
                  <option value="">All Types</option>
                  {allTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
                  className="bg-hc-dark/80 border border-white/10 rounded-xl px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-hc-text focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[180px]">
                  <option value="">All Severities</option>
                  <option value="red">🔴 Red Flags Only</option>
                  <option value="amber">🟡 Amber Alerts</option>
                  <option value="none">No Flags</option>
                </select>
                {houseFilter && (
                  <div className="flex items-center gap-2 bg-hc-teal/20 border border-hc-teal/50 rounded-xl px-4 py-2 text-[11px] font-black uppercase text-hc-teal">
                    <span>🏠 {houseFilter}</span>
                    <button onClick={() => setHouseFilter('')} className="ml-2 hover:text-white">&times;</button>
                  </div>
                )}
              </div>
              
              <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />
              
              {(typeFilter || severityFilter || houseFilter) && (
                <button onClick={() => { setTypeFilter(''); setSeverityFilter(''); setHouseFilter(''); }}
                  className="text-[11px] font-black uppercase tracking-[0.3em] text-hc-muted hover:text-hc-text transition-colors underline decoration-white/10 underline-offset-8">
                  Clear Filter
                </button>
              )}
              
              <span className="text-[11px] font-black text-hc-teal-light tracking-[0.2em] ml-auto tabular-nums">
                {selectedEntries.length} INTELLIGENCE POINTS CAPTURED
              </span>
            </div>

            {/* Entries */}
            <div className="space-y-4">
              {selectedEntries.length === 0 ? (
                <div className="text-center py-24 hc-clay-raised border border-white/5 rounded-3xl animate-in zoom-in duration-700">
                  <div className="text-4xl mb-4 opacity-20 grayscale">🔍</div>
                  <div className="text-lg font-extrabold text-hc-text mb-2 uppercase tracking-tight">Zero Intercepts</div>
                  <div className="text-[11px] text-hc-muted uppercase tracking-[0.2em] font-bold">Adjust sensor parameters to restore stream visibility</div>
                </div>
              ) : selectedEntries.map((entry, idx) => (
                <div key={entry.id}
                  className={`hc-clay-raised border transition-all duration-500 rounded-[2rem] px-8 py-6 card-glow interactive-row group/entry animate-in slide-in-from-left-4
                    ${entry.severity === 'red' ? 'border-flag-red/30 bg-flag-red/[0.02] glow-red shadow-flag-red/5' : entry.severity === 'amber' ? 'border-flag-amber/25 bg-flag-amber/[0.01] glow-amber shadow-flag-amber/5' : 'border-white/5 hover:border-hc-teal/20'}`}
                  style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex items-start gap-6 relative z-10">
                    <div className="mt-2 flex-shrink-0">
                      {entry.severity === 'red' ? (
                        <div className="w-3 h-3 rounded-full bg-flag-red shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse" />
                      ) : entry.severity === 'amber' ? (
                        <div className="w-3 h-3 rounded-full bg-flag-amber shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-hc-border shadow-inner opacity-20 group-hover/entry:opacity-40 transition-opacity" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4 flex-wrap mb-4">
                        <span className="text-[11px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-xl group-hover/entry:scale-105 transition-transform"
                          style={{ background: typeColor(entry.type) + '22', color: typeColor(entry.type), border: `1px solid ${typeColor(entry.type)}44` }}>
                          {entry.type}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] tabular-nums">{entry.date}</span>
                          {entry.carer && entry.carer !== 'Staff' && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-white/10" />
                              <span className="text-[11px] font-black text-hc-teal-light uppercase tracking-widest group-hover/entry:text-hc-teal-light transition-colors">AGENT: {entry.carer}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-[15px] text-hc-text font-medium leading-relaxed whitespace-pre-wrap italic group-hover/entry:text-hc-text transition-colors px-1">"{entry.entry}"</p>
                      {entry.flags.length > 0 && (
                        <div className="flex flex-wrap gap-2.5 mt-6">
                          {entry.flags.map((f, i) => (
                            <span key={i} className={`pill text-[11px] font-black uppercase tracking-[0.15em] shadow-2xl py-1 px-3
                              ${entry.severity === 'red' ? 'pill-red shadow-flag-red/10' : 'pill-amber shadow-flag-amber/10'}`}>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 opacity-0 group-hover/entry:opacity-100 transition-all duration-300">
                      <button 
                        onClick={() => onQuickAction({ type: 'action', content: entry.entry, client: selectedClient, house: entry.house })}
                        className="w-10 h-10 rounded-xl hc-clay-inset border border-hc-teal/20 flex items-center justify-center text-hc-teal hover:bg-hc-teal/20 transition-all shadow-lg shadow-hc-teal/10"
                        title="Convert to Action"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      </button>
                      <button 
                        onClick={() => onQuickAction({ type: 'incident', content: entry.entry, client: selectedClient, house: entry.house })}
                        className="w-10 h-10 rounded-xl hc-clay-inset border border-flag-red/20 flex items-center justify-center text-flag-red hover:bg-flag-red/20 transition-all shadow-lg shadow-flag-red/10"
                        title="Log Incident"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
