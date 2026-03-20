import { useState, useMemo } from 'react';
import type { WeekSummary, NourishEntry } from '../lib/types';
import { loadClients } from '../lib/client-store';
import type { Page } from '../App';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
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

function ClientStats({ entries }: { entries: NourishEntry[] }) {
  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    entries.forEach(e => { m[e.type] = (m[e.type] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const red = entries.filter(e => e.severity === 'red').length;
  const amber = entries.filter(e => e.severity === 'amber').length;
  const total = entries.length;

  return (
    <div className="space-y-6 mb-8">
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-light border border-white/5 rounded-xl p-4 transition-all hover:scale-[1.02] shadow-lg">
          <div className="text-2xl font-black text-white mb-0.5">{total}</div>
          <div className="section-header text-[10px]">Total Entries</div>
        </div>
        <div className={`glass-light border border-flag-red/20 rounded-xl p-4 transition-all hover:scale-[1.02] shadow-lg ${red > 0 ? 'glow-red' : ''}`}>
          <div className={`text-2xl font-black mb-0.5 ${red > 0 ? 'text-flag-red' : 'text-hc-muted'}`}>{red}</div>
          <div className="section-header text-[10px]">Red Flags</div>
        </div>
        <div className={`glass-light border border-flag-amber/20 rounded-xl p-4 transition-all hover:scale-[1.02] shadow-lg ${amber > 0 ? 'glow-amber' : ''}`}>
          <div className={`text-2xl font-black mb-0.5 ${amber > 0 ? 'text-flag-amber' : 'text-hc-muted'}`}>{amber}</div>
          <div className="section-header text-[10px]">Amber Flags</div>
        </div>
      </div>

      {/* Type breakdown bar */}
      <div className="glass-light border border-white/5 rounded-xl p-5">
        <h3 className="section-header mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
          Pattern Intelligence
        </h3>
        <div className="space-y-3">
          {byType.slice(0, 8).map(([type, count]) => (
            <div key={type} className="flex items-center gap-4 group/row cursor-default">
              <div className="text-[10px] font-bold text-hc-muted w-40 truncate group-hover/row:text-hc-text transition-colors uppercase tracking-wider">{type}</div>
              <div className="flex-1 h-2 bg-hc-dark/80 rounded-full overflow-hidden shadow-inner">
                <div className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(20,184,166,0.2)]" 
                  style={{ width: `${(count / total) * 100}%`, background: `linear-gradient(90deg, ${typeColor(type)}99, ${typeColor(type)})` }} />
              </div>
              <div className="text-xs font-black text-white w-8 text-right tabular-nums">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClientDiaryPage({ weekData, setPage }: Props) {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const storedClients = useMemo(() => loadClients().map(c => c.name.toLowerCase()), []);

  const clientDiary = weekData?.clientDiary || {};
  const allClients = useMemo(() =>
    Object.keys(clientDiary)
      .filter(name => name && !['Maintenance', 'Station', 'On Call'].includes(name))
      .sort((a, b) => {
        // Sort by red flags first, then amber, then name
        const ra = clientDiary[a].filter(e => e.severity === 'red').length;
        const rb = clientDiary[b].filter(e => e.severity === 'red').length;
        if (rb !== ra) return rb - ra;
        const aa = clientDiary[a].filter(e => e.severity === 'amber').length;
        const ab = clientDiary[b].filter(e => e.severity === 'amber').length;
        if (ab !== aa) return ab - aa;
        return a.localeCompare(b);
      }),
    [clientDiary]
  );

  const filteredClients = useMemo(() =>
    search.trim()
      ? allClients.filter(n => n.toLowerCase().includes(search.toLowerCase()))
      : allClients,
    [allClients, search]
  );

  const allTypes = useMemo(() => {
    const s = new Set<string>();
    Object.values(clientDiary).flat().forEach(e => s.add(e.type));
    return [...s].sort();
  }, [clientDiary]);

  const selectedEntries = useMemo(() => {
    if (!selectedClient) return [];
    let entries = clientDiary[selectedClient] || [];
    if (typeFilter) entries = entries.filter(e => e.type === typeFilter);
    if (severityFilter) {
      if (severityFilter === 'none') entries = entries.filter(e => e.severity === 'none');
      else entries = entries.filter(e => e.severity === severityFilter);
    }
    return [...entries].sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedClient, clientDiary, typeFilter, severityFilter]);

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 rounded-2xl glass border border-hc-teal/20 flex items-center justify-center mb-8 glow-teal animate-float">
          <span className="text-4xl">📋</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3 text-gradient">No diary data loaded</h2>
        <p className="text-hc-muted text-sm mb-8 max-w-xs leading-relaxed">
          Drop a Nourish CSV export to see all client diaries with ArbiFlow pattern intelligence.
        </p>
        <button onClick={() => setPage('upload')}
          className="px-8 py-3 btn-gradient rounded-xl shadow-lg hover:shadow-hc-teal/20 transition-all">
          Import Data
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden animate-in fade-in duration-700">
      {/* Client list sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-white/5 flex flex-col glass backdrop-blur-3xl">
        <div className="p-4 border-b border-white/5 bg-black/20">
          <p className="section-header text-[9px] mb-3 px-1">
            {allClients.length} clients · {weekData.dateFrom}–{weekData.dateTo}
          </p>
          <div className="relative group">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search intelligence…"
              className="w-full bg-hc-dark/60 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-hc-teal/50 focus:bg-hc-dark transition-all placeholder-hc-muted/50 shadow-inner"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
              <svg className="w-3.5 h-3.5 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredClients.map(name => {
            const entries = clientDiary[name] || [];
            const red = entries.filter(e => e.severity === 'red').length;
            const amber = entries.filter(e => e.severity === 'amber').length;
            const hasDocs = storedClients.some(n => n.includes(name.toLowerCase().split(' ')[0]));
            const isSelected = selectedClient === name;
            return (
              <button key={name} onClick={() => { setSelectedClient(name); setTypeFilter(''); setSeverityFilter(''); }}
                className={`w-full text-left px-4 py-4 border-b border-white/5 transition-all duration-500 group active:scale-95
                  ${isSelected ? 'bg-hc-teal/10 accent-bar z-10' : 'hover:bg-white/5'}`}>
                <div className="flex items-start justify-between gap-3 mb-2 relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                  <span className={`text-[14px] font-black tracking-tight leading-tight transition-colors group-hover:text-white
                    ${isSelected ? 'text-hc-teal-light' : 'text-hc-text'}`}>
                    {name}
                  </span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {red > 0 && <span className="pill pill-red text-[9px] px-1.5 py-0 shadow-lg animate-pulse-soft">{red}</span>}
                    {amber > 0 && <span className="pill pill-amber text-[9px] px-1.5 py-0 shadow-lg">{amber}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                  <span className="text-[10px] font-black text-hc-muted group-hover:text-hc-muted/80 transition-colors uppercase tracking-[0.15em] tabular-nums">
                    {entries.length} TRANSMISSIONS
                  </span>
                  {hasDocs && (
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-hc-teal-light/70 uppercase tracking-widest animate-pulse-soft">
                      <div className="w-1 h-1 rounded-full bg-hc-teal shadow-[0_0_5px_#14b8a6]" />
                      STRAT-FILE
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
            <div className="w-24 h-24 rounded-3xl glass border border-white/10 flex items-center justify-center mb-8 glow-blue opacity-20 group">
              <span className="text-5xl grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110 group-hover:rotate-3">👤</span>
            </div>
            <p className="text-white font-black tracking-[0.3em] uppercase text-xs opacity-40">Tactical Node Selection Required</p>
            <div className="h-px w-12 bg-white/10 my-4" />
            <p className="text-[10px] text-hc-muted font-bold uppercase tracking-[0.4em] opacity-30">{allClients.length} NODES DISCOVERED IN GRID</p>
          </div>
        ) : (
          <div className="p-8 lg:p-12 max-w-[1200px] mx-auto animate-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10">
              <div>
                <h2 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase text-shimmer">{selectedClient}</h2>
                <div className="flex items-center gap-3">
                  <span className="pill pill-teal text-[10px] uppercase tracking-[0.2em] font-black shadow-xl">Subject Pattern Registry</span>
                  <span className="text-hc-muted text-[10px] font-black uppercase tracking-[0.2em] ml-2 tabular-nums">
                    TEMPORAL RANGE: {weekData.dateFrom} – {weekData.dateTo}
                  </span>
                </div>
              </div>
              <div className="flex gap-4">
                {storedClients.some(n => n.includes(selectedClient.toLowerCase().split(' ')[0])) && (
                  <button onClick={() => setPage('client-docs')}
                    className="px-8 py-3.5 glass-light border border-hc-teal/30 text-[10px] font-black uppercase tracking-[0.2em] text-hc-teal-light rounded-2xl hover:bg-hc-teal/10 hover:shadow-hc-teal/20 transition-all shadow-xl active:scale-95 group/btn">
                    <svg className="w-4 h-4 inline-block mr-2 group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Open Strat-Matrix
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <ClientStats entries={clientDiary[selectedClient] || []} />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-10 glass-light border border-white/5 p-5 rounded-[2rem] shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="section-header text-[9px] tracking-[0.3em] opacity-60">Pattern Sensor:</span>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="bg-hc-dark/80 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[180px]">
                  <option value="">All Streams</option>
                  {allTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
                  className="bg-hc-dark/80 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[180px]">
                  <option value="">All Vectors</option>
                  <option value="red">🔴 RED-STRAT ONLY</option>
                  <option value="amber">🟡 AMBER MONITOR</option>
                  <option value="none">STABLE STATUS</option>
                </select>
              </div>
              
              <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />
              
              {(typeFilter || severityFilter) && (
                <button onClick={() => { setTypeFilter(''); setSeverityFilter(''); }}
                  className="text-[9px] font-black uppercase tracking-[0.3em] text-hc-muted hover:text-white transition-colors underline decoration-white/10 underline-offset-8">
                  Reset Sensor
                </button>
              )}
              
              <span className="text-[10px] font-black text-hc-teal-light/60 uppercase tracking-[0.2em] ml-auto tabular-nums">
                {selectedEntries.length} INTELLIGENCE POINTS CAPTURED
              </span>
            </div>

            {/* Entries */}
            <div className="space-y-4">
              {selectedEntries.length === 0 ? (
                <div className="text-center py-24 glass border border-white/5 rounded-3xl animate-in zoom-in duration-700">
                  <div className="text-4xl mb-4 opacity-20 grayscale">🔍</div>
                  <div className="text-lg font-extrabold text-white mb-2 uppercase tracking-tight">Zero Intercepts</div>
                  <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">Adjust sensor parameters to restore stream visibility</div>
                </div>
              ) : selectedEntries.map((entry, idx) => (
                <div key={entry.id}
                  className={`glass-light border transition-all duration-500 rounded-[2rem] px-8 py-6 card-glow interactive-row group/entry animate-in slide-in-from-left-4
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
                        <span className="text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-xl group-hover/entry:scale-105 transition-transform"
                          style={{ background: typeColor(entry.type) + '22', color: typeColor(entry.type), border: `1px solid ${typeColor(entry.type)}44` }}>
                          {entry.type}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] tabular-nums opacity-60">{entry.date}</span>
                          {entry.carer && entry.carer !== 'Staff' && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-white/10" />
                              <span className="text-[10px] font-black text-hc-teal-light/60 uppercase tracking-widest group-hover/entry:text-hc-teal-light transition-colors">AGENT: {entry.carer}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-[15px] text-hc-text font-medium leading-relaxed whitespace-pre-wrap italic group-hover/entry:text-white transition-colors opacity-90 group-hover:opacity-100 px-1">"{entry.entry}"</p>
                      {entry.flags.length > 0 && (
                        <div className="flex flex-wrap gap-2.5 mt-6">
                          {entry.flags.map((f, i) => (
                            <span key={i} className={`pill text-[9px] font-black uppercase tracking-[0.15em] shadow-2xl py-1 px-3
                              ${entry.severity === 'red' ? 'pill-red shadow-flag-red/10' : 'pill-amber shadow-flag-amber/10'}`}>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted opacity-0 group-hover/entry:opacity-100 group-hover/entry:translate-x-1 transition-all duration-500 shadow-xl">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
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
