import { useState, useMemo, useRef, useCallback } from 'react';
import { useCollapseStore } from '../lib/collapse-store';
import type { WeekSummary, CareEntry } from '../lib/types';
import type { Page } from '../App';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
}

type ReportType = 'weekly_summary' | 'flag_report' | 'house_detail' | 'entry_log' | 'staff_activity';

const REPORT_TYPES: { id: ReportType; label: string; desc: string; color: string; icon: string }[] = [
  { id: 'weekly_summary', label: 'Weekly Summary', desc: 'Overview of weekly care activity', color: '#14b8a6', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'flag_report', label: 'Priority Flag Report', desc: 'Red and amber flag report', color: '#ef4444', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
  { id: 'house_detail', label: 'House Detail', desc: 'Detailed report for a specific house', color: '#3b82f6', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'entry_log', label: 'Entry Log', desc: 'Searchable log of all care entries', color: '#8b5cf6', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { id: 'staff_activity', label: 'Staff Activity', desc: 'Staff activity and contributions', color: '#f59e0b', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
];

function EntryRow({ entry }: { entry: CareEntry }) {
  const [open, setOpen] = useState(false);
  const isRed = entry.severity === 'red';
  const isAmber = entry.severity === 'amber';

  return (
    <div className={`glass-light border transition-all duration-300 rounded-[1.25rem] overflow-hidden card-glow interactive-row
      ${isRed ? 'border-flag-red/25 bg-flag-red/[0.02]' : isAmber ? 'border-flag-amber/20 bg-flag-amber/[0.01]' : 'border-white/5 hover:border-white/10'}`}>
      <button className="w-full text-left px-5 py-4 flex items-start gap-4 group" onClick={() => setOpen(!open)}>
        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 shadow-lg ${isRed ? 'bg-flag-red glow-red animate-pulse' : isAmber ? 'bg-flag-amber glow-amber' : 'bg-flag-green shadow-flag-green/20'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-[10px] font-black text-white group-hover:text-hc-teal-light transition-colors uppercase tracking-widest">{entry.house}</span>
            <span className="pill pill-teal text-[8px] font-black uppercase tracking-tighter py-0 px-1.5">{entry.type}</span>
            {entry.client && <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{entry.client}</span>}
            {entry.date && <span className="text-[9px] font-black text-hc-muted/40 group-hover:text-hc-muted/80 ml-auto tabular-nums transition-colors">{entry.date}</span>}
          </div>
          <p className={`text-[13px] text-hc-text leading-relaxed font-medium transition-all duration-500 ${open ? '' : 'line-clamp-2 opacity-80 group-hover:opacity-100'}`}>{entry.entry}</p>
          {entry.flags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {entry.flags.map((f, i) => (
                <span key={i} className={`pill text-[8px] font-black uppercase tracking-widest shadow-sm
                  ${isRed ? 'pill-red' : 'pill-amber'}`}>{f}</span>
              ))}
            </div>
          )}
        </div>
        <div className={`w-6 h-6 rounded-lg glass border border-white/5 flex items-center justify-center shrink-0 mt-1 transition-all duration-500 ${open ? 'rotate-90 bg-white/5 border-white/20' : 'group-hover:translate-x-1'}`}>
          <svg className={`w-3 h-3 text-hc-muted group-hover:text-white transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </div>
      </button>
      {open && entry.carer && entry.carer !== 'Staff' && (
        <div className="px-5 pb-4 text-[10px] text-hc-muted font-bold uppercase tracking-[0.2em] border-t border-white/5 pt-3 bg-black/20 flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
          Staff: {entry.carer}
        </div>
      )}
    </div>
  );
}

// ── WEEKLY SUMMARY ────────────────────────────────────────
function WeeklySummaryReport({ weekData }: { weekData: WeekSummary }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const houses = Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber));

  const html = `<!DOCTYPE html><html><head><style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 40px; color: #0f172a; background: #fff; }
    h1 { font-size: 24px; font-weight: 900; color: #0f766e; margin: 0; letter-spacing: -0.02em; text-transform: uppercase; }
    h2 { font-size: 14px; font-weight: 800; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 6px; margin-top: 32px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }
    th { background: #f8fafc; padding: 10px 12px; text-align: left; border: 1px solid #e2e8f0; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 10px 12px; border: 1px solid #e2e8f0; vertical-align: top; line-height: 1.5; }
    .stat-row { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat { flex: 1; min-width: 100px; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; }
    .red { background: #fef2f2; border-color: #fecaca; color: #ef4444; }
    .amber { background: #fffbeb; border-color: #fef3c7; color: #f59e0b; }
    .green { background: #f0fdf4; border-color: #bbf7d0; color: #22c55e; }
    .teal { background: #f0fdfa; border-color: #99f6e4; color: #0f766e; }
    .num { font-size: 28px; font-weight: 900; display: block; letter-spacing: -0.05em; margin-bottom: 2px; }
    .lbl { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
    .flag-red { color: #ef4444; font-weight: 700; }
    .flag-amber { color: #f59e0b; font-weight: 700; }
    .house-name { font-weight: 800; color: #1e293b; }
    .carer { color: #64748b; font-style: italic; font-size: 10px; margin-top: 4px; }
    @media print { body { margin: 0; } .stat { break-inside: avoid; } table { break-inside: auto; } tr { break-inside: avoid; break-after: auto; } }
  </style></head><body>
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #0f766e;padding-bottom:16px;margin-bottom:32px;">
    <div>
      <h1>Weekly Summary</h1>
      <div style="font-size:13px;font-weight:600;color:#64748b;margin-top:4px;">${weekData.dateFrom || '—'} TO ${weekData.dateTo || '—'} &nbsp;·&nbsp; GENERATED ${new Date().toLocaleDateString('en-GB').toUpperCase()}</div>
    </div>
    <img src="/hazelcare-logo.png" style="height:50px;" />
  </div>
  <div class="stat-row">
    <div class="stat teal"><span class="num">${weekData.totalEntries}</span><span class="lbl">Total Entries</span></div>
    <div class="stat red"><span class="num">${weekData.allFlags.red.length}</span><span class="lbl">Critical Red Flags</span></div>
    <div class="stat amber"><span class="num">${weekData.allFlags.amber.length}</span><span class="lbl">Amber Monitor Alerts</span></div>
    <div class="stat green"><span class="num">${weekData.totalEntries - weekData.allFlags.red.length - weekData.allFlags.amber.length}</span><span class="lbl">Routine Support</span></div>
    <div class="stat teal"><span class="num">${Object.keys(weekData.houses).length}</span><span class="lbl">Houses</span></div>
  </div>
  ${weekData.allFlags.red.length > 0 ? `
  <h2>🔴 RED ALERTS — IMMEDIATE ACTION REQUIRED</h2>
  <table><tr style="background:#fef2f2;"><th>House</th><th>Client</th><th>Date</th><th>Details</th><th>Flags</th></tr>
  ${weekData.allFlags.red.map(e => `<tr><td><span class="house-name">${e.house}</span></td><td><strong>${e.client || '—'}</strong></td><td>${e.date}</td><td>${e.entry}<div class="carer">Staff: ${e.carer}</div></td><td class="flag-red">${e.flags.join(', ')}</td></tr>`).join('')}
  </table>` : ''}
  ${weekData.allFlags.amber.length > 0 ? `
  <h2>🟡 AMBER — MONITORING REQUIRED</h2>
  <table><tr style="background:#fffbeb;"><th>House</th><th>Client</th><th>Date</th><th>Details</th><th>Flags</th></tr>
  ${weekData.allFlags.amber.slice(0, 30).map(e => `<tr><td><span class="house-name">${e.house}</span></td><td><strong>${e.client || '—'}</strong></td><td>${e.date}</td><td>${e.entry}<div class="carer">Staff: ${e.carer}</div></td><td class="flag-amber">${e.flags.join(', ')}</td></tr>`).join('')}
  ${weekData.allFlags.amber.length > 30 ? `<tr><td colspan="5" style="color:#64748b;font-style:italic;text-align:center;padding:15px;">+ ${weekData.allFlags.amber.length - 30} ADDITIONAL AMBER ALERTS TRUNCATED FOR BREVITY</td></tr>` : ''}
  </table>` : ''}
  <h2>House Breakdown</h2>
  <table><tr><th>House</th><th>Entries</th><th>Red</th><th>Amber</th><th>Incidents</th><th>Safeguard</th><th>Medication</th><th>Coordinator</th></tr>
  ${houses.map(h => `<tr${h.flags.red > 0 ? ' style="background:#fef2f2;"' : h.flags.amber > 0 ? ' style="background:#fffbeb;"' : ''}><td><span class="house-name">${h.name}</span></td><td>${h.entries.length}</td><td class="flag-red">${h.flags.red || '—'}</td><td class="flag-amber">${h.flags.amber || '—'}</td><td>${h.incidents.length || '—'}</td><td>${h.safeguarding.length || '—'}</td><td>${h.medication.length || '—'}</td><td>${h.coordinator || '—'}</td></tr>`).join('')}
  </table>
  <div style="text-align:center;color:#94a3b8;font-size:10px;margin-top:40px;padding-top:16px;border-top:2px solid #f1f5f9;font-weight:600;letter-spacing:0.1em;">
    HAZEL CARE LTD | PROPRIETARY TACTICAL DATA | CLASSIFIED — INTERNAL USE ONLY
  </div></body></html>`;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 glass-light border border-white/5 p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-hc-teal/10 border border-hc-teal/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <div className="text-xs font-black text-hc-muted uppercase tracking-[0.08em] mb-0.5">Data Preview</div>
            <p className="text-sm font-semibold text-white opacity-90">{weekData.totalEntries} entries across {Object.keys(weekData.houses).length} houses</p>
          </div>
        </div>
          <button onClick={() => iframeRef.current?.contentWindow?.print()}
            className="flex items-center justify-center gap-2.5 px-8 py-3 btn-gradient text-white text-xs font-black uppercase tracking-[0.08em] rounded-xl shadow-xl hover:scale-[1.02] transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print / Save as PDF
        </button>
      </div>
      <div className="bg-white rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl p-1 relative group">
        <div className="absolute inset-0 bg-hc-teal/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <iframe ref={iframeRef} srcDoc={html} className="w-full relative z-10" style={{ minHeight: 850 }} title="Report Preview" />
      </div>
    </div>
  );
}

// ── FLAG REPORT ───────────────────────────────────────────
function FlagReport({ weekData }: { weekData: WeekSummary }) {
  const [filter, setFilter] = useState<'both' | 'red' | 'amber'>('both');
  const entries = filter === 'red' ? weekData.allFlags.red : filter === 'amber' ? weekData.allFlags.amber : [...weekData.allFlags.red, ...weekData.allFlags.amber];

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 glass-light border border-white/5 p-4 rounded-2xl shadow-xl">
        <div className="flex gap-2 bg-black/20 backdrop-blur-md rounded-xl p-1.5 border border-white/5">
          {(['both', 'red', 'amber'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] rounded-xl transition-all duration-500
                ${filter === f 
                  ? f === 'red' ? 'pill-red shadow-lg' : f === 'amber' ? 'pill-amber shadow-lg' : 'pill-teal shadow-lg'
                  : 'text-hc-muted hover:text-white hover:bg-white/5'}`}>
              {f === 'both' ? `All Flags` : f === 'red' ? `Red Flags` : `Amber Flags`}
              <span className={`ml-3 px-2 py-0.5 rounded-lg tabular-nums ${filter === f ? 'bg-white/20' : 'bg-white/5 opacity-40'}`}>
                {f === 'both' ? weekData.allFlags.red.length + weekData.allFlags.amber.length : f === 'red' ? weekData.allFlags.red.length : weekData.allFlags.amber.length}
              </span>
            </button>
          ))}
        </div>
        <span className="text-xs font-black text-hc-teal-light/80 uppercase tracking-[0.08em] mr-2">Showing {entries.length} entries</span>
      </div>
      
      <div className="space-y-3">
        {entries.map((e, i) => <EntryRow key={i} entry={e} />)}
        {entries.length === 0 && (
          <div className="text-center py-24 glass border border-white/5 rounded-3xl animate-in zoom-in duration-700">
            <div className="text-5xl mb-6 opacity-20">🛡️</div>
            <div className="text-lg font-extrabold text-white mb-2 uppercase tracking-tight">No Issues</div>
            <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">No priority flags detected in this stream</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HOUSE DETAIL ──────────────────────────────────────────
function HouseDetailReport({ weekData }: { weekData: WeekSummary }) {
  const houses = Object.keys(weekData.houses).sort();
  const [selected, setSelected] = useState(houses[0] || '');
  const house = weekData.houses[selected];

  const sections: { label: string; entries: CareEntry[]; color: string; pill: string }[] = house ? [
    { label: 'Incidents & Alerts', entries: house.incidents, color: '#ef4444', pill: 'pill-red' },
    { label: 'Safeguarding', entries: house.safeguarding, color: '#be185d', pill: 'pill-red shadow-lg shadow-red-900/20' },
    { label: 'Medication Management', entries: house.medication, color: '#0891b2', pill: 'pill-teal' },
    { label: 'Health & Safety Scans', entries: house.healthSafety, color: '#d97706', pill: 'pill-amber' },
    { label: 'Staff Notes', entries: house.staffPerformance, color: '#7c3aed', pill: 'pill-purple' },
    { label: 'Shift Transitions', entries: house.handovers, color: '#3b82f6', pill: 'pill-blue' },
    { label: 'Care Operations', entries: house.dailySupport, color: '#14b8a6', pill: 'pill-teal' },
    { label: 'Other Entries', entries: house.entries.filter(e => !['incident','safeguarding','medication','health_safety','staff','handover','daily_support'].includes(e.category || '')), color: '#475569', pill: 'pill-blue opacity-60' },
  ].filter(s => s.entries.length > 0) : [];

  const sectionIds = sections.map(s => s.label);
  const { isCollapsed: isSectionCollapsed, toggle: toggleSection, collapseAll, expandAll, allCollapsed } = useCollapseStore('reports-house-sections');
  const allClosed = allCollapsed(sectionIds);
  const toggleAll = useCallback(() => { allClosed ? expandAll(sectionIds) : collapseAll(sectionIds); }, [allClosed, sectionIds, collapseAll, expandAll]);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 glass-light border border-white/5 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <span className="section-header text-[10px] tracking-[0.2em]">Select House</span>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            className="bg-hc-dark/80 border border-white/10 rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[250px]">
            {houses.map(h => <option key={h} value={h}>{h} ({weekData.houses[h].entries.length} POINTS)</option>)}
          </select>
        </div>
        {house && (
          <div className="flex items-center gap-4 ml-auto flex-wrap">
            {house.flags.red > 0 && <span className="pill pill-red text-[10px] font-black px-4 shadow-lg animate-pulse-soft">{house.flags.red} RED FLAGS</span>}
            {house.flags.amber > 0 && <span className="pill pill-amber text-[10px] font-black px-4 shadow-lg">{house.flags.amber} ALERTS</span>}
            <div className="h-4 w-px bg-white/10 mx-2" />
            <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] tabular-nums">{house.entries.length} TOTAL POINTS</span>
            <button type="button" onClick={toggleAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
              style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#64748b'}}>
              <svg className="w-3 h-3 transition-transform duration-200" style={{transform: allClosed ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              {allClosed ? 'Expand all' : 'Collapse all'}
            </button>
          </div>
        )}
      </div>

      {house && (
        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div key={section.label} className="animate-in slide-in-from-bottom-6 duration-700 rounded-2xl overflow-hidden" style={{ animationDelay: `${idx * 100}ms`, border:'1px solid rgba(255,255,255,0.05)', background:'rgba(10,12,18,0.5)' }}>
              <button type="button" onClick={() => toggleSection(section.label)}
                className="w-full flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                style={{borderBottom: isSectionCollapsed(section.label) ? 'none' : '1px solid rgba(255,255,255,0.05)'}}>
                <div className="w-1 h-4 rounded-full shrink-0" style={{background: section.color, boxShadow:`0 0 8px ${section.color}60`}} />
                <h3 className="text-sm font-black uppercase tracking-tight text-white">{section.label}</h3>
                <span className={`pill ${section.pill} text-[10px] font-black px-3`}>{section.entries.length}</span>
                <div className="flex-1 h-px bg-white/5" />
                <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200 shrink-0" style={{transform: isSectionCollapsed(section.label) ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {!isSectionCollapsed(section.label) && (
                <div className="space-y-3 p-4">
                  {section.entries.map((e, i) => <EntryRow key={i} entry={e} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ENTRY LOG ─────────────────────────────────────────────
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
    const header = 'Date,House,Type,Client,Carer,Severity,Flags,Entry\n';
    const rows = filtered.map(e => `"${e.date}","${e.house}","${e.type}","${e.client}","${e.carer}","${e.severity}","${e.flags.join('; ')}","${e.entry.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hazelcare-entries-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex flex-wrap items-center gap-4 mb-8 glass-light border border-white/5 p-5 rounded-[2rem] shadow-2xl backdrop-blur-xl">
        <div className="relative group flex-1 min-w-[300px]">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries, people, staff..."
            className="w-full pl-12 pr-6 py-3.5 bg-hc-dark/60 border border-white/10 rounded-2xl text-sm text-white placeholder:text-hc-muted/30 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark" />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)}
            className="bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[160px]">
            <option value="all">All Houses</option>
            {houses.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[160px]">
            <option value="all">All Channels</option>
            {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          
          <div className="flex gap-1 bg-black/30 rounded-xl p-1 border border-white/5">
            {(['all', 'red', 'amber', 'none'] as const).map(s => (
              <button key={s} onClick={() => setSeverityFilter(s)}
                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-300
                  ${severityFilter === s ? 'bg-hc-teal/20 text-hc-teal-light border border-hc-teal/20 shadow-lg' : 'text-hc-muted hover:text-white hover:bg-white/5'}`}>
                {s === 'none' ? 'Stable' : s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          
          <button onClick={exportCSV}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-hc-teal/10 border border-hc-teal/20 text-[10px] font-black uppercase tracking-[0.2em] text-hc-teal-light rounded-xl hover:bg-hc-teal/20 hover:text-white transition-all shadow-lg group">
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Payload
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-10">
        <div className="section-header text-[9px] mb-4 ml-2 opacity-60 tracking-[0.3em]">TELEMETRY FEED — {filtered.length} NODES CAPTURED</div>
        {filtered.slice(0, 200).map((e, i) => <EntryRow key={i} entry={e} />)}
        {filtered.length > 200 && (
          <div className="text-center py-10 glass border border-white/5 rounded-2xl">
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Stream Truncated: 200 / {filtered.length}</div>
            <div className="text-[9px] font-bold text-hc-muted/50 uppercase tracking-widest mt-1">Refine filters to access deep-history logs</div>
          </div>
        )}
        {filtered.length === 0 && (
          <div className="text-center py-32 glass border border-white/5 rounded-3xl animate-in zoom-in duration-700">
            <div className="text-5xl mb-6 opacity-20">📡</div>
            <div className="text-lg font-extrabold text-white mb-2 uppercase tracking-tight">No Entries Yet</div>
            <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">Adjust sensor parameters to restore visibility</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── STAFF ACTIVITY ────────────────────────────────────────
function StaffActivityReport({ weekData }: { weekData: WeekSummary }) {
  const allEntries = useMemo(() => Object.values(weekData.houses).flatMap(h => h.entries), [weekData]);

  const byStaff = useMemo(() => {
    const m: Record<string, { entries: CareEntry[]; houses: Set<string>; red: number; amber: number }> = {};
    for (const e of allEntries) {
      const name = e.carer && e.carer !== 'Staff' ? e.carer : 'Unknown / Auto-Gen';
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 mb-8 glass-light border border-white/5 p-4 rounded-2xl shadow-xl">
        <div className="w-10 h-10 rounded-xl bg-hc-purple/10 border border-hc-purple/20 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-hc-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
        </div>
        <div>
          <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mb-0.5">Staff Summary</div>
          <p className="text-[11px] font-bold text-white opacity-80">{byStaff.length} staff on shift · {allEntries.length} entries recorded</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {byStaff.map(([name, data], idx) => (
          <div key={name} className={`glass-light border transition-all duration-500 rounded-2xl overflow-hidden card-glow
            ${data.red > 0 ? 'border-flag-red/25 bg-flag-red/[0.02] glow-red' : data.amber > 0 ? 'border-flag-amber/20 bg-flag-amber/[0.01]' : 'border-white/5 hover:border-white/10'}`}
            style={{ animationDelay: `${idx * 50}ms` }}>
            <button className="w-full text-left px-6 py-5 flex items-center gap-6 group" onClick={() => setExpanded(expanded === name ? null : name)}>
              <div className="w-14 h-14 rounded-2xl glass border border-white/10 flex items-center justify-center text-lg font-black text-hc-teal-light shrink-0 shadow-xl group-hover:scale-110 group-hover:border-hc-teal/30 transition-all duration-500">
                {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-black text-white group-hover:text-hc-teal-light transition-colors tracking-tighter leading-none mb-1.5">{name}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-60">Houses:</span>
                  <span className="text-[10px] font-bold text-hc-text/80 truncate">{[...data.houses].join(', ')}</span>
                </div>
              </div>
              <div className="flex items-center gap-6 pr-4">
                <div className="text-center group/stat">
                  <div className="text-xl font-black text-white tabular-nums tracking-tighter transition-transform group-hover/stat:scale-110">{data.entries.length}</div>
                  <div className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-50">LOGS</div>
                </div>
                {data.red > 0 && (
                  <div className="text-center group/stat">
                    <div className="text-xl font-black text-flag-red tabular-nums tracking-tighter transition-transform group-hover/stat:scale-110">{data.red}</div>
                    <div className="text-[8px] font-black text-flag-red/60 uppercase tracking-[0.2em]">RED</div>
                  </div>
                )}
                {data.amber > 0 && (
                  <div className="text-center group/stat">
                    <div className="text-xl font-black text-flag-amber tabular-nums tracking-tighter transition-transform group-hover/stat:scale-110">{data.amber}</div>
                    <div className="text-[8px] font-black text-flag-amber/60 uppercase tracking-[0.2em]">AMB</div>
                  </div>
                )}
                <div className={`w-8 h-8 rounded-xl glass border border-white/5 flex items-center justify-center transition-all duration-500 ${expanded === name ? 'rotate-90 bg-white/5 border-white/20' : 'group-hover:translate-x-1'}`}>
                  <svg className="w-4 h-4 text-hc-muted group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </button>
            
            {expanded === name && (
              <div className="border-t border-white/5 px-6 py-6 space-y-3 max-h-[500px] overflow-y-auto bg-black/20 backdrop-blur-3xl scrollbar-thin animate-in slide-in-from-top-4 duration-500">
                <div className="section-header text-[8px] mb-4 opacity-40 tracking-[0.3em]">PERSONNEL TELEMETRY FEED — CHRONOLOGICAL</div>
                {data.entries.map((e, i) => (
                  <div key={i} className="flex items-start gap-4 glass-light border border-white/5 p-4 rounded-xl hover:bg-white/5 transition-all group/entry interactive-row">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 shadow-lg ${e.severity === 'red' ? 'bg-flag-red glow-red animate-pulse' : e.severity === 'amber' ? 'bg-flag-amber glow-amber' : 'bg-flag-green'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[9px] font-black text-hc-teal-light/80 uppercase tracking-widest group-hover/entry:text-hc-teal-light transition-colors">{e.type}</span>
                        {e.client && (
                          <>
                            <span className="w-0.5 h-0.5 rounded-full bg-white/10" />
                            <span className="text-[9px] font-bold text-white/60 uppercase tracking-tighter">{e.client}</span>
                          </>
                        )}
                        <span className="text-[9px] font-black text-hc-muted/40 ml-auto tabular-nums">{e.date}</span>
                      </div>
                      <p className="text-[12px] text-hc-text leading-relaxed font-medium opacity-80 group-hover/entry:opacity-100 transition-opacity italic">"{e.entry}"</p>
                    </div>
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

// ── MAIN ──────────────────────────────────────────────────
export function ReportsPage({ weekData, setPage }: Props) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-2xl glass border border-hc-teal/20 flex items-center justify-center mb-8 glow-teal animate-float">
          <svg className="w-12 h-12 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3 text-gradient">Report</h2>
        <p className="text-hc-muted text-sm mb-8 text-center max-w-xs leading-relaxed">Import care data to generate weekly care reports.</p>
        <button onClick={() => setPage('upload')} className="btn-gradient px-8 py-3 rounded-xl shadow-lg transition-all">Import Data</button>
      </div>
    );
  }

  const active = REPORT_TYPES.find(r => r.id === selectedReport);

  return (
    <div className="p-6 lg:p-10 w-full animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white mb-1 tracking-tight text-shimmer">Reports</h1>
          <div className="flex items-center gap-3">
            <span className="pill pill-teal text-[10px] font-black uppercase tracking-wider shadow-lg">Weekly Analysis</span>
            <p className="text-hc-muted text-[10px] font-bold uppercase tracking-widest ml-1 tabular-nums">
              {weekData.totalEntries} entries · {weekData.allFlags.red.length} red flags · {weekData.allFlags.amber.length} alerts
            </p>
          </div>
        </div>
        {selectedReport && (
          <button onClick={() => setSelectedReport(null)} className="group flex items-center gap-3 glass-light border border-white/10 text-[10px] font-black text-hc-muted hover:text-white uppercase tracking-[0.2em] px-6 py-3 rounded-xl transition-all hover:bg-white/5 hover:border-hc-teal/30 shadow-xl">
            <span className="w-5 h-5 rounded-lg glass border border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-all">
              <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </span>
            Back to Reports
          </button>
        )}
      </div>

      {/* Report type selector */}
      {!selectedReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {REPORT_TYPES.map((rt, idx) => (
            <button key={rt.id} onClick={() => setSelectedReport(rt.id)}
              className="glass-light border border-white/10 rounded-xl lg:rounded-2xl p-4 lg:p-5 text-left hover:border-hc-teal/40 hover:bg-white/[0.03] transition-all duration-500 group relative overflow-hidden card-glow animate-in slide-in-from-bottom-4 active:scale-95 shadow-xl"
              style={{ animationDelay: `${idx * 100}ms` }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.03] blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:opacity-[0.1] transition-opacity duration-1000" style={{ background: rt.color }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 shadow-2xl border border-white/10 relative z-10" style={{ background: `${rt.color}15` }}>
                <svg className="w-7 h-7" style={{ color: rt.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d={rt.icon} /></svg>
              </div>
              <div className="text-sm font-black text-white mb-2 group-hover:text-hc-teal-light transition-colors tracking-tight leading-tight uppercase relative z-10">{rt.label}</div>
              <div className="text-[10px] font-medium text-hc-muted leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity mb-8 relative z-10">{rt.desc}</div>
              <div className="mt-auto text-[9px] font-black flex items-center gap-2 uppercase tracking-[0.3em] transition-all group-hover:gap-4 relative z-10" style={{ color: rt.color }}>
                Initialize <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active report header */}
      {active && (
        <div className="flex items-center gap-5 mb-8 animate-in slide-in-from-left-4 duration-700 px-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center glass border border-white/10 shadow-2xl" style={{ background: `${active.color}15` }}>
            <svg className="w-6 h-6" style={{ color: active.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d={active.icon} /></svg>
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{active.label}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
              <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60">{active.desc}</p>
            </div>
          </div>
        </div>
      )}

      {/* Report content */}
      <div className="relative z-10">
        {selectedReport === 'weekly_summary' && <WeeklySummaryReport weekData={weekData} />}
        {selectedReport === 'flag_report' && <FlagReport weekData={weekData} />}
        {selectedReport === 'house_detail' && <HouseDetailReport weekData={weekData} />}
        {selectedReport === 'entry_log' && <EntryLogReport weekData={weekData} />}
        {selectedReport === 'staff_activity' && <StaffActivityReport weekData={weekData} />}
      </div>
    </div>
  );
}
