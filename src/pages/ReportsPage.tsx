import { useState, useMemo, useRef } from 'react';
import { useCollapseStore } from '../lib/collapse-store';
import type { WeekSummary, CareEntry } from '../lib/types';
import type { Page } from '../App';

type ReportType = 'weekly_summary' | 'flag_report' | 'house_detail' | 'entry_log' | 'staff_activity';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
}

export function ReportsPage({ weekData, setPage }: Props) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);

  if (!weekData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-8 bg-slate-950 animate-in fade-in duration-700">
        <div className="text-[11px] font-black tracking-[0.3em] text-hc-teal-light uppercase mb-6 border-b border-hc-teal/30 pb-2">LEDGER OFFLINE</div>
        <div className="w-16 h-px bg-slate-800 mb-8" />
        <h2 className="text-2xl font-black text-white mb-4 tracking-tighter uppercase">No Live Telemetry</h2>
        <p className="text-slate-400 text-[11px] font-bold mb-10 text-center max-w-xs uppercase tracking-widest leading-relaxed">
          Sync regional operational data to generate diagnostic ledger.
        </p>
        <button onClick={() => setPage('upload')} className="px-10 py-3 border border-hc-teal/40 bg-hc-teal/5 text-hc-teal-light hover:bg-hc-teal/10 text-[10px] font-black uppercase tracking-[0.25em] transition-all">
          Initialize Sync
        </button>
      </div>
    );
  }

  const active = REPORT_TYPES.find(r => r.id === selectedReport);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-950 animate-in fade-in duration-700">
      
      {/* ── LEDGER HEADER ── */}
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 px-8 py-6 flex items-center justify-between gap-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1 uppercase">DIAGNOSTIC LEDGER</h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-hc-teal-light tracking-[0.2em] uppercase">OPERATIONAL AUDIT & TELEMETRY</span>
            <div className="h-3 w-px bg-slate-800" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{weekData.totalEntries} CAPTURED POINTS</span>
          </div>
        </div>
        
        {selectedReport && (
          <button onClick={() => setSelectedReport(null)} className="flex items-center gap-3 px-6 py-2.5 border border-slate-800 bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            BACK TO LEDGER
          </button>
        )}
      </div>

      {/* ── REPORT MATRIX (SELECTOR) ── */}
      {!selectedReport && (
        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-950/20 scrollbar-thin">
          {REPORT_TYPES.map((rt, idx) => {
            const TACTICAL_NAMES: Record<string, string> = {
              'weekly_summary': 'SUMMARY SITREP',
              'flag_report': 'FLIGHT DECK ALERTS',
              'house_detail': 'UNIT TELEMETRY',
              'entry_log': 'DIAGNOSTIC FEED',
              'staff_activity': 'COMMANDER PERFORMANCE'
            };
            return (
              <button key={rt.id} onClick={() => setSelectedReport(rt.id)}
                className="group relative border border-slate-800 bg-slate-900/30 p-6 text-left hover:border-hc-teal/40 hover:bg-slate-900/50 transition-all flex flex-col"
                style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="w-12 h-12 border border-slate-800 bg-slate-950 flex items-center justify-center mb-10 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" style={{ color: rt.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d={rt.icon} /></svg>
                </div>
                <div className="text-sm font-black text-white mb-2 uppercase tracking-tight">{TACTICAL_NAMES[rt.id] || rt.label}</div>
                <div className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest mb-10">{rt.desc}</div>
                <div className="mt-auto text-[9px] font-black flex items-center gap-2 uppercase tracking-[0.25em]" style={{ color: rt.color }}>
                  STATION_INIT <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── REPORT CONTENT ── */}
      {selectedReport && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Active Sub-Header */}
          <div className="shrink-0 bg-slate-950 px-8 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-4 bg-hc-teal" />
              <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">{active?.label}</h2>
            </div>
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{active?.desc}</span>
          </div>
          
          <div className="flex-1 overflow-hidden">
            {selectedReport === 'weekly_summary' && <WeeklySummaryReport weekData={weekData} />}
            {selectedReport === 'flag_report' && <FlagReport weekData={weekData} />}
            {selectedReport === 'house_detail' && <HouseDetailReport weekData={weekData} />}
            {selectedReport === 'entry_log' && <EntryLogReport weekData={weekData} />}
            {selectedReport === 'staff_activity' && <StaffActivityReport weekData={weekData} />}
          </div>
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry }: { entry: CareEntry }) {
  const [open, setOpen] = useState(false);
  const isRed = entry.severity === 'red';
  const isAmber = entry.severity === 'amber';

  return (
    <div className={`border transition-all duration-300 group
      ${isRed ? 'border-red-900 bg-red-950/10' : isAmber ? 'border-amber-900/50 bg-amber-950/5' : 'border-slate-800 bg-slate-900/10 hover:border-slate-700'}`}>
      <button className="w-full text-left px-5 py-3 flex items-start gap-4 group" onClick={() => setOpen(!open)}>
        <div className={`w-1.5 h-1.5 rounded-none mt-1.5 shrink-0 ${isRed ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]' : isAmber ? 'bg-amber-600' : 'bg-slate-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">{entry.house}</span>
            <span className="text-[9px] font-black text-blue-400 uppercase border border-blue-900/40 px-1.5 py-0.5">{entry.type}</span>
            {entry.client && <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{entry.client}</span>}
            {entry.date && <span className="text-[9px] font-black text-slate-600 ml-auto tabular-nums">{entry.date}</span>}
          </div>
          <p className={`text-[12px] text-slate-400 leading-relaxed font-medium transition-all ${open ? '' : 'line-clamp-1 italic'}`}>"{entry.entry}"</p>
          {entry.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {entry.flags.map((f: string, i: number) => (
                <span key={i} className={`text-[8px] font-black px-2 py-0.5 border uppercase tracking-widest
                  ${isRed ? 'bg-red-950 border-red-900 text-red-500' : 'bg-amber-950 border-amber-900 text-amber-500'}`}>{f}</span>
              ))}
            </div>
          )}
        </div>
        <div className={`p-1 text-slate-600 group-hover:text-white transition-transform ${open ? 'rotate-90' : ''}`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </div>
      </button>
      {open && entry.carer && entry.carer !== 'Staff' && (
        <div className="px-11 pb-3 text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] border-t border-slate-800/50 pt-2 bg-slate-900/30 flex items-center gap-2">
          OPERATOR: {entry.carer}
        </div>
      )}
    </div>
  );
}

function WeeklySummaryReport({ weekData }: { weekData: WeekSummary }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const houses = Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber));

  const html = `<!DOCTYPE html><html><head><style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 40px; color: #020617; background: #fff; }
    .header { border-bottom: 4px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.04em; text-transform: uppercase; }
    .meta { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
    h2 { font-size: 13px; font-weight: 900; color: #1e293b; background: #f1f5f9; padding: 8px 12px; margin-top: 40px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em; border-left: 4px solid #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 30px; }
    th { background: #f8fafc; padding: 12px; text-align: left; border: 1px solid #e2e8f0; color: #475569; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 10px 12px; border: 1px solid #e2e8f0; vertical-align: top; line-height: 1.5; }
    .stats { display: flex; gap: 1px; background: #e2e8f0; border: 1px solid #e2e8f0; margin-bottom: 40px; }
    .stat { flex: 1; background: #fff; padding: 20px; text-align: center; }
    .stat-val { font-size: 24px; font-weight: 900; display: block; color: #0f172a; letter-spacing: -0.02em; }
    .stat-lbl { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
    .critical { color: #ef4444; }
    .warning { color: #f59e0b; }
    .footer { text-align: center; color: #94a3b8; font-size: 9px; margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; }
    @media print { body { margin: 20px; } .header { border-bottom-width: 6px; } }
  </style></head><body>
  <div class="header">
    <div>
      <h1>Summary Sitrep</h1>
      <div class="meta">${weekData.dateFrom || '—'} // ${weekData.dateTo || '—'} &nbsp;•&nbsp; ISSUED ${new Date().toLocaleDateString('en-GB').toUpperCase()}</div>
    </div>
    <div style="text-align:right; font-weight:900; font-size:14px; letter-spacing:-0.05em;">HAZEL CARE OPERATIONS</div>
  </div>
  <div class="stats">
    <div class="stat"><span class="stat-val">${weekData.totalEntries}</span><span class="stat-lbl">Points Captured</span></div>
    <div class="stat"><span class="stat-val critical">${weekData.allFlags.red.length}</span><span class="stat-lbl">Critical Alerts</span></div>
    <div class="stat"><span class="stat-val warning">${weekData.allFlags.amber.length}</span><span class="stat-lbl">Monitor Actions</span></div>
    <div class="stat"><span class="stat-val">${Object.keys(weekData.houses).length}</span><span class="stat-lbl">Active Units</span></div>
  </div>
  ${weekData.allFlags.red.length > 0 ? `
  <h2>Active Critical Interventions</h2>
  <table><tr><th style="width:120px;">Unit / Client</th><th>Diagnostic Detail</th><th style="width:150px;">Metadata</th></tr>
  ${weekData.allFlags.red.map((e: any) => `<tr><td><strong>${e.house}</strong><br/><span style="color:#64748b;">${e.client || 'General'}</span></td><td>${e.entry}<br/><small style="color:#94a3b8; font-style:italic;">Operator: ${e.carer}</small></td><td><span class="critical">${e.flags.join(', ')}</span><br/><small>${e.date}</small></td></tr>`).join('')}
  </table>` : ''}
  <h2>Unit Performance Matrix</h2>
  <table><tr><th>Operational Unit</th><th>Captured</th><th>Critical</th><th>Monitor</th><th>Incidents</th><th>Safeguard</th><th>Medication</th></tr>
  ${houses.map(h => `<tr><td><strong>${h.name}</strong></td><td>${h.entries.length}</td><td class="${h.flags.red > 0 ? 'critical' : ''}">${h.flags.red || '0'}</td><td class="${h.flags.amber > 0 ? 'warning' : ''}">${h.flags.amber || '0'}</td><td>${h.incidents.length || '0'}</td><td>${h.safeguarding.length || '0'}</td><td>${h.medication.length || '0'}</td></tr>`).join('')}
  </table>
  <div class="footer">HAZEL CARE LTD | OPERATIONAL INTELLIGENCE | DO NOT REDISTRIBUTE</div>
  </body></html>`;

  return (
    <div className="h-full flex flex-col p-8 bg-slate-950/20 scrollbar-thin overflow-y-auto">
      <div className="shrink-0 flex items-center justify-between mb-8 border border-slate-800 bg-slate-900/50 p-6">
        <div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">STATION PREVIEW</div>
          <p className="text-xl font-black text-white uppercase tracking-tight">{weekData.totalEntries} Data Points Captured</p>
        </div>
        <button onClick={() => iframeRef.current?.contentWindow?.print()}
          className="px-10 py-3 bg-blue-600/10 border border-blue-600/40 text-blue-400 text-[10px] font-black uppercase tracking-[0.25em] hover:bg-blue-600/20 transition-all shadow-[0_0_15px_rgba(37,99,235,0.1)]">
          DEPLOY TO PHYSICAL LEDGER (PDF)
        </button>
      </div>
      <div className="flex-1 bg-white border border-slate-800 p-1 relative">
        <iframe ref={iframeRef} srcDoc={html} className="w-full h-full min-h-[1000px]" title="Sitrep Preview" />
      </div>
    </div>
  );
}

function FlagReport({ weekData }: { weekData: WeekSummary }) {
  const [filter, setFilter] = useState<'both' | 'red' | 'amber'>('both');
  const entries = filter === 'red' ? weekData.allFlags.red : filter === 'amber' ? weekData.allFlags.amber : [...weekData.allFlags.red, ...weekData.allFlags.amber];

  return (
    <div className="h-full flex flex-col p-8 bg-slate-950/20">
      <div className="shrink-0 flex items-center justify-between mb-6">
        <div className="flex border border-slate-800 bg-slate-900/50 p-1">
          {(['both', 'red', 'amber'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
            className={`px-8 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all
                ${filter === f 
                  ? 'bg-slate-800 text-white' 
                  : 'text-slate-500 hover:text-slate-300'}`}>
              {f === 'both' ? `ALL ALERTS` : f === 'red' ? `CRITICAL ONLY` : `MONITOR ONLY`}
              <span className={`ml-4 tabular-nums opacity-60 ${filter === f ? 'text-blue-400' : 'text-slate-600'}`}>
                {f === 'both' ? weekData.allFlags.red.length + weekData.allFlags.amber.length : f === 'red' ? weekData.allFlags.red.length : weekData.allFlags.amber.length}
              </span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
        {entries.map((e, i) => <EntryRow key={i} entry={e} />)}
        {entries.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 grayscale py-32 border border-dashed border-slate-800">
            <div className="text-4xl mb-4">🛡️</div>
            <div className="text-[10px] font-black text-white uppercase tracking-[0.3em]">SECURE SECTOR — NO ALERTS</div>
          </div>
        )}
      </div>
    </div>
  );
}

function HouseDetailReport({ weekData }: { weekData: WeekSummary }) {
  const houses = Object.keys(weekData.houses).sort();
  const [selected, setSelected] = useState(houses[0] || '');
  const house = weekData.houses[selected];

  const sections: { label: string; id: string; entries: CareEntry[]; color: string }[] = house ? [
    { label: 'CRITICAL INCIDENTS', id: 'incident', entries: house.incidents, color: '#ef4444' },
    { label: 'SAFEGUARDING MATTERS', id: 'safeguarding', entries: house.safeguarding, color: '#be185d' },
    { label: 'MEDICATION VECTORS', id: 'medication', entries: house.medication, color: '#0891b2' },
    { label: 'OPERATIONAL SAFETY', id: 'safety', entries: house.healthSafety, color: '#d97706' },
    { label: 'PERSONNEL NOTES', id: 'staff', entries: house.staffPerformance, color: '#7c3aed' },
    { label: 'ROTATION HANDOVERS', id: 'handover', entries: house.handovers, color: '#3b82f6' },
    { label: 'DAILY OPERATIONS', id: 'daily', entries: house.dailySupport, color: '#14b8a6' },
  ].filter(s => s.entries.length > 0) : [];

  const sectionIds = sections.map(s => s.id);
  const { isCollapsed: isSectionCollapsed, toggle: toggleSection, collapseAll, expandAll, allCollapsed } = useCollapseStore('reports-house-sections');
  const allClosed = allCollapsed(sectionIds);

  return (
    <div className="h-full flex gap-1 p-8 bg-slate-950/20 overflow-hidden">
      {/* House Selector Column */}
      <div className="w-80 shrink-0 flex flex-col border border-slate-800 bg-slate-900/30">
        <div className="p-4 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">UNIT SELECTION</div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {houses.map(h => (
            <button key={h} onClick={() => setSelected(h)}
              className={`w-full text-left px-4 py-3 border transition-all flex items-center justify-between
                ${selected === h ? 'bg-blue-600/10 border-blue-600/40 text-blue-400' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}>
              <span className="text-[11px] font-black uppercase tracking-tight">{h}</span>
              <span className="text-[10px] font-mono opacity-40">{weekData.houses[h].entries.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Report Column */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden px-4">
        {house ? (
           <>
            <div className="shrink-0 flex items-center justify-between border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center gap-6">
                <span className="text-xl font-black text-white uppercase tracking-tight">{selected}</span>
                <div className="h-4 w-px bg-slate-800" />
                <div className="flex gap-4 tabular-nums">
                  {house.flags.red > 0 && <span className="text-[11px] font-black text-red-500 border border-red-900 px-2 bg-red-950/20">{house.flags.red} CRIT</span>}
                  {house.flags.amber > 0 && <span className="text-[11px] font-black text-amber-500 border border-amber-900 px-2 bg-amber-950/20">{house.flags.amber} AMB</span>}
                </div>
              </div>
              <button onClick={() => allClosed ? expandAll(sectionIds) : collapseAll(sectionIds)} className="text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest">{allClosed ? 'EXPAND ALL' : 'COLLAPSE ALL'}</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {sections.map(section => (
                <div key={section.id} className="border border-slate-800 bg-slate-900/10">
                  <button onClick={() => toggleSection(section.id)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-3" style={{ background: section.color }} />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">{section.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-600">{section.entries.length}</span>
                  </button>
                  {!isSectionCollapsed(section.id) && (
                    <div className="p-4 space-y-1 bg-slate-950/30 border-t border-slate-800/50">
                      {section.entries.map((e, i) => <EntryRow key={i} entry={e} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
           </>
        ) : (
          <div className="h-full flex items-center justify-center opacity-20 grayscale">
            <div className="text-[10px] font-black text-white uppercase tracking-[0.4em]">SELECT UNIT FOR TELEMETRY</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryLogReport({ weekData }: { weekData: WeekSummary }) {
  const [search, setSearch] = useState('');
  const [houseFilter, setHouseFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'red' | 'amber' | 'none'>('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const houses = Object.keys(weekData.houses).sort();
  const allEntries = useMemo(() => Object.values(weekData.houses).flatMap(h => h.entries).sort((a, b) => b.date.localeCompare(a.date)), [weekData]);
  const allTypes = useMemo(() => [...new Set(allEntries.map(e => e.type))].sort(), [allEntries]);

  const filtered = useMemo(() => {
    let r = allEntries;
    if (houseFilter !== 'all') r = r.filter(e => e.house === houseFilter);
    if (severityFilter !== 'all') r = r.filter(e => severityFilter === 'none' ? (e.severity === 'none' || e.severity === 'green') : e.severity === severityFilter);
    if (typeFilter !== 'all') r = r.filter(e => e.type === typeFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter(e => e.entry.toLowerCase().includes(s) || e.client.toLowerCase().includes(s) || e.carer.toLowerCase().includes(s) || e.type.toLowerCase().includes(s));
    }
    return r;
  }, [allEntries, houseFilter, severityFilter, typeFilter, search]);

  function exportCSV() {
    const header = 'Date,Unit,Type,Client,Operator,Severity,Flags,Entry\n';
    const rows = filtered.map(e => `"${e.date}","${e.house}","${e.type}","${e.client}","${e.carer}","${e.severity}","${e.flags.join('; ')}","${e.entry.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hc-ops-diagnostic-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col p-8 bg-slate-950/20">
      <div className="shrink-0 flex flex-wrap items-center gap-4 mb-6 border border-slate-800 bg-slate-900/50 p-6">
        <div className="relative flex-1 min-w-[300px]">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SCAN DIAGNOSTICS..."
            className="w-full bg-slate-950 border border-slate-800 px-6 py-3 text-[11px] font-black text-white focus:outline-none focus:border-hc-teal/50" />
        </div>
        <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none">
          <option value="all">ALL UNITS</option>
          {houses.map(h => <option key={h} value={h}>{h.toUpperCase()}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none">
          <option value="all">ALL CHANNELS</option>
          {allTypes.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value as any)}
          className="bg-slate-950 border border-slate-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none">
          <option value="all">ALL LEVELS</option>
          <option value="red">CRITICAL_RED</option>
          <option value="amber">ALERT_AMBER</option>
          <option value="none">NOMINAL</option>
        </select>
        <button onClick={exportCSV} className="px-6 py-3 border border-blue-600/40 bg-blue-600/5 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600/10 transition-all">EXTRACT PAYLOAD (CSV)</button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
        <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 pl-2">ACTIVE TELEMETRY STREAM — {filtered.length} POINTS</div>
        {filtered.slice(0, 500).map((e, i) => <EntryRow key={i} entry={e} />)}
      </div>
    </div>
  );
}

function StaffActivityReport({ weekData }: { weekData: WeekSummary }) {
  const allEntries = useMemo(() => Object.values(weekData.houses).flatMap(h => h.entries), [weekData]);
  const byStaff = useMemo(() => {
    const m: Record<string, { entries: CareEntry[]; houses: Set<string>; red: number; amber: number }> = {};
    for (const e of allEntries) {
      const name = e.carer && e.carer !== 'Staff' ? e.carer : 'UNASSIGNED';
      if (!m[name]) m[name] = { entries: [], houses: new Set(), red: 0, amber: 0 };
      m[name].entries.push(e);
      m[name].houses.add(e.house);
      if (e.severity === 'red') m[name].red++;
      else if (e.severity === 'amber') m[name].amber++;
    }
    return Object.entries(m).sort((a, b) => b[1].entries.length - a[1].entries.length);
  }, [allEntries]);

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col p-8 bg-slate-950/20 scrollbar-thin overflow-y-auto">
      <div className="grid grid-cols-1 gap-2">
        {byStaff.map(([name, data]) => (
          <div key={name} className={`border transition-all group ${data.red > 0 ? 'border-red-900 bg-red-950/10' : 'border-slate-800 bg-slate-900/30'}`}>
            <button className="w-full text-left px-6 py-4 flex items-center gap-6" onClick={() => setExpanded(expanded === name ? null : name)}>
              <div className="w-12 h-12 border border-slate-700 bg-slate-800 flex items-center justify-center text-[12px] font-black text-white shrink-0">
                {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-white uppercase tracking-tight mb-1">{name}</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{[...data.houses].join(' · ')}</div>
              </div>
              <div className="flex items-center gap-8 tabular-nums">
                <div className="text-center"><span className="text-xl font-black text-white">{data.entries.length}</span><br/><span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">LOGS</span></div>
                {data.red > 0 && <div className="text-center"><span className="text-xl font-black text-red-500">{data.red}</span><br/><span className="text-[8px] font-black text-red-800 uppercase tracking-widest">CRIT</span></div>}
                <div className={`p-1 text-slate-600 group-hover:text-white transition-transform ${expanded === name ? 'rotate-90' : ''}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></div>
              </div>
            </button>
            {expanded === name && (
              <div className="p-6 border-t border-slate-800/50 bg-slate-950/50 space-y-1">
                {data.entries.map((e, i) => (
                  <div key={i} className="flex items-center gap-4 text-[11px] py-1 border-b border-slate-800/20 last:border-0 hover:bg-slate-900/50 px-2 transition-colors">
                    <span className="text-slate-600 tabular-nums w-24 shrink-0">{e.date}</span>
                    <span className={`w-1.5 h-1.5 rounded-none shrink-0 ${e.severity === 'red' ? 'bg-red-500' : e.severity === 'amber' ? 'bg-amber-500' : 'bg-blue-600'}`} />
                    <span className="text-white font-black w-24 shrink-0 truncate">{e.house}</span>
                    <span className="text-slate-400 italic flex-1 truncate">"{e.entry}"</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const REPORT_TYPES: { id: ReportType; label: string; desc: string; color: string; icon: string }[] = [
  { id: 'weekly_summary', label: 'Summary SITREP', desc: 'Global operational status summary broadcast', color: '#3b82f6', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'flag_report', label: 'Flight Deck Alerts', desc: 'Critical and high-severity intercept log', color: '#ef4444', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
  { id: 'house_detail', label: 'Unit Telemetry', desc: 'Deep-history data grain per operational unit', color: '#2563eb', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'entry_log', label: 'Diagnostic Feed', desc: 'Raw sensor stream and searchable payload', color: '#8b5cf6', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { id: 'staff_activity', label: 'Commander Performance', desc: 'Personnel throughput and activity metrics', color: '#f59e0b', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
];
