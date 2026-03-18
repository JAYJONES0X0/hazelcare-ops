import { useState, useMemo, useRef } from 'react';
import type { WeekSummary, NourishEntry } from '../lib/types';
import type { Page } from '../App';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
}

type ReportType = 'weekly_summary' | 'flag_report' | 'house_detail' | 'entry_log' | 'staff_activity';

const REPORT_TYPES: { id: ReportType; label: string; desc: string; color: string; icon: string }[] = [
  { id: 'weekly_summary', label: 'Weekly Summary', desc: 'Full week KPIs, house breakdown, printable', color: '#14b8a6', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'flag_report', label: 'Flag Report', desc: 'All red and amber flagged entries with details', color: '#ef4444', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
  { id: 'house_detail', label: 'House Detail', desc: 'Deep dive into one house — all entries by category', color: '#3b82f6', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'entry_log', label: 'Full Entry Log', desc: 'Searchable list of every diary entry', color: '#8b5cf6', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { id: 'staff_activity', label: 'Staff Activity', desc: 'Who logged what, across all houses', color: '#f59e0b', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
];

function EntryRow({ entry }: { entry: NourishEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bg-[#0a1120] border rounded-xl transition-all ${entry.severity === 'red' ? 'border-red-900/40' : entry.severity === 'amber' ? 'border-amber-900/30' : 'border-[#1e3050]'}`}>
      <button className="w-full text-left px-4 py-3 flex items-start gap-3" onClick={() => setOpen(!open)}>
        <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${entry.severity === 'red' ? 'bg-red-400' : entry.severity === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[11px] font-semibold text-white">{entry.house}</span>
            <span className="text-[10px] text-teal-400">{entry.type}</span>
            {entry.client && <span className="text-[10px] text-gray-400">{entry.client}</span>}
            {entry.date && <span className="text-[10px] text-gray-600 ml-auto">{entry.date}</span>}
          </div>
          <p className={`text-[11px] text-gray-300 leading-relaxed ${open ? '' : 'line-clamp-2'}`}>{entry.entry}</p>
          {entry.flags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {entry.flags.map((f, i) => (
                <span key={i} className={`text-[8px] px-1.5 py-0.5 rounded border ${entry.severity === 'red' ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-amber-900/20 text-amber-400 border-amber-900/30'}`}>{f}</span>
              ))}
            </div>
          )}
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-600 shrink-0 mt-1 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
      {open && entry.carer && entry.carer !== 'Staff' && (
        <div className="px-4 pb-3 text-[10px] text-gray-500 border-t border-[#1e3050] pt-2">Staff: {entry.carer}</div>
      )}
    </div>
  );
}

// ── WEEKLY SUMMARY ────────────────────────────────────────
function WeeklySummaryReport({ weekData }: { weekData: WeekSummary }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const houses = Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber));

  const html = `<!DOCTYPE html><html><head><style>
    body { font-family: 'Segoe UI', sans-serif; margin: 24px; color: #1e293b; }
    h1 { font-size: 20px; color: #0f766e; margin: 0; }
    h2 { font-size: 14px; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 4px; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
    th { background: #f1f5f9; padding: 7px 10px; text-align: left; border: 1px solid #e2e8f0; }
    td { padding: 7px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
    .stat { display: inline-block; padding: 8px 16px; border-radius: 8px; margin: 4px; text-align: center; min-width: 80px; }
    .red { background: #fef2f2; color: #ef4444; }
    .amber { background: #fffbeb; color: #f59e0b; }
    .green { background: #f0fdf4; color: #22c55e; }
    .teal { background: #f0fdfa; color: #0f766e; }
    .num { font-size: 22px; font-weight: 700; display: block; }
    .lbl { font-size: 10px; color: #64748b; }
    .flag-red { color: #ef4444; font-weight: 600; }
    .flag-amber { color: #f59e0b; font-weight: 600; }
    @media print { body { margin: 0; } }
  </style></head><body>
  <div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #0f766e;padding-bottom:12px;margin-bottom:20px;">
    <img src="/hazelcare-logo.png" style="height:44px;" />
    <div><h1>Weekly Summary Report</h1>
    <div style="font-size:12px;color:#64748b;">${weekData.dateFrom || '—'} — ${weekData.dateTo || '—'} &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-GB')}</div></div>
  </div>
  <div>
    <span class="stat teal"><span class="num">${weekData.totalEntries}</span><span class="lbl">Total Entries</span></span>
    <span class="stat red"><span class="num">${weekData.allFlags.red.length}</span><span class="lbl">Red Flags</span></span>
    <span class="stat amber"><span class="num">${weekData.allFlags.amber.length}</span><span class="lbl">Amber Flags</span></span>
    <span class="stat green"><span class="num">${weekData.totalEntries - weekData.allFlags.red.length - weekData.allFlags.amber.length}</span><span class="lbl">Routine</span></span>
    <span class="stat teal"><span class="num">${Object.keys(weekData.houses).length}</span><span class="lbl">Houses</span></span>
    <span class="stat teal"><span class="num">${Object.keys(weekData.clientDiary || {}).length}</span><span class="lbl">Clients</span></span>
  </div>
  ${weekData.allFlags.red.length > 0 ? `
  <h2>🔴 Red Flags — Immediate Action Required</h2>
  <table><tr style="background:#fef2f2;"><th>House</th><th>Client</th><th>Date</th><th>Entry</th><th>Flags</th></tr>
  ${weekData.allFlags.red.map(e => `<tr><td>${e.house}</td><td>${e.client || '—'}</td><td>${e.date}</td><td>${e.entry.slice(0, 150)}${e.entry.length > 150 ? '…' : ''}</td><td class="flag-red">${e.flags.join(', ')}</td></tr>`).join('')}
  </table>` : ''}
  ${weekData.allFlags.amber.length > 0 ? `
  <h2>🟡 Amber Flags — Monitor</h2>
  <table><tr style="background:#fffbeb;"><th>House</th><th>Client</th><th>Date</th><th>Entry</th><th>Flags</th></tr>
  ${weekData.allFlags.amber.slice(0, 20).map(e => `<tr><td>${e.house}</td><td>${e.client || '—'}</td><td>${e.date}</td><td>${e.entry.slice(0, 120)}${e.entry.length > 120 ? '…' : ''}</td><td class="flag-amber">${e.flags.join(', ')}</td></tr>`).join('')}
  ${weekData.allFlags.amber.length > 20 ? `<tr><td colspan="5" style="color:#64748b;font-style:italic;">+ ${weekData.allFlags.amber.length - 20} more amber flags</td></tr>` : ''}
  </table>` : ''}
  <h2>House-by-House Breakdown</h2>
  <table><tr><th>House</th><th>Total</th><th>Red</th><th>Amber</th><th>Incidents</th><th>Safeguarding</th><th>Medication</th><th>Coordinator</th></tr>
  ${houses.map(h => `<tr${h.flags.red > 0 ? ' style="background:#fef2f2;"' : h.flags.amber > 0 ? ' style="background:#fffbeb;"' : ''}><td><strong>${h.name}</strong></td><td>${h.entries.length}</td><td class="flag-red">${h.flags.red || '—'}</td><td class="flag-amber">${h.flags.amber || '—'}</td><td>${h.incidents.length || '—'}</td><td>${h.safeguarding.length || '—'}</td><td>${h.medication.length || '—'}</td><td>${h.coordinator || '—'}</td></tr>`).join('')}
  </table>
  <h2>Entry Type Breakdown</h2>
  <table><tr><th>Type</th><th>Count</th><th>%</th></tr>
  ${Object.entries(weekData.entryTypes).sort(([,a],[,b])=>b-a).slice(0,15).map(([t,c]) => `<tr><td>${t}</td><td>${c}</td><td>${Math.round(c/weekData.totalEntries*100)}%</td></tr>`).join('')}
  </table>
  <div style="text-align:center;color:#94a3b8;font-size:10px;margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div></body></html>`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{weekData.totalEntries} entries · {weekData.allFlags.red.length} red · {weekData.allFlags.amber.length} amber · {Object.keys(weekData.houses).length} houses</p>
        <button onClick={() => iframeRef.current?.contentWindow?.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print / Save PDF
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden border border-[#1e3050]">
        <iframe ref={iframeRef} srcDoc={html} className="w-full" style={{ minHeight: 700 }} title="Weekly Summary" />
      </div>
    </div>
  );
}

// ── FLAG REPORT ───────────────────────────────────────────
function FlagReport({ weekData }: { weekData: WeekSummary }) {
  const [filter, setFilter] = useState<'both' | 'red' | 'amber'>('both');
  const entries = filter === 'red' ? weekData.allFlags.red : filter === 'amber' ? weekData.allFlags.amber : [...weekData.allFlags.red, ...weekData.allFlags.amber];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-[#0a1120] border border-[#1e3050] rounded-xl p-1">
          {(['both', 'red', 'amber'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[11px] rounded-lg font-medium transition-all ${filter === f ? f === 'red' ? 'bg-red-900/50 text-red-400' : f === 'amber' ? 'bg-amber-900/40 text-amber-400' : 'bg-teal-900/40 text-teal-300' : 'text-gray-500 hover:text-white'}`}>
              {f === 'both' ? `All Flags (${weekData.allFlags.red.length + weekData.allFlags.amber.length})` : f === 'red' ? `Red (${weekData.allFlags.red.length})` : `Amber (${weekData.allFlags.amber.length})`}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-600">{entries.length} entries</span>
      </div>
      <div className="space-y-1.5">
        {entries.map((e, i) => <EntryRow key={i} entry={e} />)}
        {entries.length === 0 && <div className="text-center py-10 text-gray-600 text-sm">No flagged entries in this dataset</div>}
      </div>
    </div>
  );
}

// ── HOUSE DETAIL ──────────────────────────────────────────
function HouseDetailReport({ weekData }: { weekData: WeekSummary }) {
  const houses = Object.keys(weekData.houses).sort();
  const [selected, setSelected] = useState(houses[0] || '');
  const house = weekData.houses[selected];

  const sections: { label: string; entries: NourishEntry[]; color: string }[] = house ? [
    { label: 'Incidents', entries: house.incidents, color: '#ef4444' },
    { label: 'Safeguarding', entries: house.safeguarding, color: '#be185d' },
    { label: 'Medication', entries: house.medication, color: '#0891b2' },
    { label: 'Health & Safety', entries: house.healthSafety, color: '#d97706' },
    { label: 'Staff Notes', entries: house.staffPerformance, color: '#7c3aed' },
    { label: 'Handovers', entries: house.handovers, color: '#3b82f6' },
    { label: 'Daily Support', entries: house.dailySupport, color: '#14b8a6' },
    { label: 'Other', entries: house.entries.filter(e => !['incident','safeguarding','medication','health_safety','staff','handover','daily_support'].includes(e.category || '')), color: '#475569' },
  ].filter(s => s.entries.length > 0) : [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="bg-[#0a1120] border border-[#1e3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500">
          {houses.map(h => <option key={h} value={h}>{h} ({weekData.houses[h].entries.length} entries)</option>)}
        </select>
        {house && (
          <div className="flex gap-3 text-xs">
            {house.flags.red > 0 && <span className="text-red-400 font-semibold">{house.flags.red} red</span>}
            {house.flags.amber > 0 && <span className="text-amber-400 font-semibold">{house.flags.amber} amber</span>}
            <span className="text-gray-500">{house.entries.length} total</span>
          </div>
        )}
      </div>
      {house && (
        <div className="space-y-5">
          {sections.map(section => (
            <div key={section.label}>
              <h3 className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: section.color }}>
                {section.label} — {section.entries.length}
              </h3>
              <div className="space-y-1.5">
                {section.entries.map((e, i) => <EntryRow key={i} entry={e} />)}
              </div>
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
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries, clients, staff..."
            className="w-full pl-9 pr-4 py-2 bg-[#0a1120] border border-[#1e3050] rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500" />
        </div>
        <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)}
          className="bg-[#0a1120] border border-[#1e3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500">
          <option value="all">All Houses</option>
          {houses.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-[#0a1120] border border-[#1e3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500">
          <option value="all">All Types</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex gap-0.5 bg-[#0a1120] border border-[#1e3050] rounded-xl p-1">
          {(['all', 'red', 'amber', 'none'] as const).map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1 text-[11px] rounded-lg transition-all ${severityFilter === s ? 'bg-teal-900/40 text-teal-300 font-semibold' : 'text-gray-500 hover:text-white'}`}>
              {s === 'none' ? 'Routine' : s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1120] border border-[#1e3050] text-xs text-gray-400 rounded-xl hover:text-white">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          CSV
        </button>
        <span className="text-xs text-gray-600 self-center">{filtered.length} entries</span>
      </div>
      <div className="space-y-1.5">
        {filtered.slice(0, 200).map((e, i) => <EntryRow key={i} entry={e} />)}
        {filtered.length > 200 && <div className="text-center text-xs text-gray-600 py-3">Showing 200 of {filtered.length}. Use filters to narrow down.</div>}
        {filtered.length === 0 && <div className="text-center py-10 text-gray-600 text-sm">No entries match your filters</div>}
      </div>
    </div>
  );
}

// ── STAFF ACTIVITY ────────────────────────────────────────
function StaffActivityReport({ weekData }: { weekData: WeekSummary }) {
  const allEntries = useMemo(() => Object.values(weekData.houses).flatMap(h => h.entries), [weekData]);

  const byStaff = useMemo(() => {
    const m: Record<string, { entries: NourishEntry[]; houses: Set<string>; red: number; amber: number }> = {};
    for (const e of allEntries) {
      const name = e.carer && e.carer !== 'Staff' ? e.carer : 'Unknown / Auto';
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
    <div>
      <p className="text-xs text-gray-500 mb-4">{byStaff.length} staff members · {allEntries.length} entries total</p>
      <div className="space-y-2">
        {byStaff.map(([name, data]) => (
          <div key={name} className={`bg-[#0a1120] border rounded-xl overflow-hidden transition-all ${data.red > 0 ? 'border-red-900/30' : data.amber > 0 ? 'border-amber-900/20' : 'border-[#1e3050]'}`}>
            <button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => setExpanded(expanded === name ? null : name)}>
              <div className="w-8 h-8 rounded-full bg-teal-900/40 flex items-center justify-center text-[10px] font-bold text-teal-400 shrink-0">
                {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{name}</div>
                <div className="text-[10px] text-gray-500">{[...data.houses].join(', ')}</div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-white font-semibold">{data.entries.length}</span>
                {data.red > 0 && <span className="text-red-400 font-semibold">{data.red}🔴</span>}
                {data.amber > 0 && <span className="text-amber-400 font-semibold">{data.amber}🟡</span>}
                <svg className={`w-3.5 h-3.5 text-gray-600 transition-transform ${expanded === name ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
            {expanded === name && (
              <div className="border-t border-[#1e3050] px-4 py-3 space-y-1.5 max-h-[400px] overflow-y-auto">
                {data.entries.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${e.severity === 'red' ? 'bg-red-400' : e.severity === 'amber' ? 'bg-amber-400' : 'bg-gray-600'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-teal-400 mr-1.5">{e.type}</span>
                      {e.client && <span className="text-gray-400 mr-1.5">{e.client} ·</span>}
                      <span className="text-gray-300">{e.entry.slice(0, 120)}{e.entry.length > 120 ? '…' : ''}</span>
                    </div>
                    <span className="text-gray-600 shrink-0">{e.date}</span>
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
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="w-16 h-16 rounded-2xl bg-[#0a1120] border border-[#1e3050] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Import Data for Reports</h2>
        <p className="text-gray-500 text-sm mb-4">Load Nourish data to generate reports.</p>
        <button onClick={() => setPage('upload')} className="px-5 py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold rounded-xl">Import Data</button>
      </div>
    );
  }

  const active = REPORT_TYPES.find(r => r.id === selectedReport);

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Reports</h1>
          <p className="text-gray-500 text-sm">
            {weekData.dateFrom && weekData.dateTo ? `${weekData.dateFrom} — ${weekData.dateTo}` : 'Current period'}
            {' · '}{weekData.totalEntries} entries · {weekData.allFlags.red.length} red · {weekData.allFlags.amber.length} amber
          </p>
        </div>
        {selectedReport && (
          <button onClick={() => setSelectedReport(null)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white border border-[#1e3050] px-3 py-2 rounded-xl">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            All Reports
          </button>
        )}
      </div>

      {/* Report type selector */}
      {!selectedReport && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {REPORT_TYPES.map(rt => (
            <button key={rt.id} onClick={() => setSelectedReport(rt.id)}
              className="bg-[#0a1120] border border-[#1e3050] rounded-xl p-4 text-left hover:border-teal-700/40 hover:bg-teal-900/5 transition-all group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${rt.color}15` }}>
                <svg className="w-4.5 h-4.5" style={{ color: rt.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={rt.icon} /></svg>
              </div>
              <div className="text-xs font-bold text-white mb-1 group-hover:text-teal-300 transition-colors">{rt.label}</div>
              <div className="text-[10px] text-gray-500 leading-relaxed">{rt.desc}</div>
              <div className="mt-3 text-[10px] font-semibold flex items-center gap-1" style={{ color: rt.color }}>
                Open <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active report header */}
      {active && (
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${active.color}20` }}>
            <svg className="w-4 h-4" style={{ color: active.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={active.icon} /></svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{active.label}</h2>
            <p className="text-[10px] text-gray-500">{active.desc}</p>
          </div>
        </div>
      )}

      {/* Report content */}
      {selectedReport === 'weekly_summary' && <WeeklySummaryReport weekData={weekData} />}
      {selectedReport === 'flag_report' && <FlagReport weekData={weekData} />}
      {selectedReport === 'house_detail' && <HouseDetailReport weekData={weekData} />}
      {selectedReport === 'entry_log' && <EntryLogReport weekData={weekData} />}
      {selectedReport === 'staff_activity' && <StaffActivityReport weekData={weekData} />}
    </div>
  );
}
