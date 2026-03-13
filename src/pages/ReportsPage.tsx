import { useState } from 'react';
import type { WeekSummary } from '../lib/types';
import type { Page } from '../App';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
}

type ReportType = 'weekly_summary' | 'house_detail' | 'flag_report' | 'staff_activity' | 'entry_log';

const REPORT_TYPES: { id: ReportType; label: string; desc: string; color: string }[] = [
  { id: 'weekly_summary', label: 'Weekly Summary', desc: 'Full week overview with KPIs, flags, and house breakdown', color: '#14b8a6' },
  { id: 'flag_report', label: 'Flag Report', desc: 'All red and amber flagged entries with details', color: '#ef4444' },
  { id: 'house_detail', label: 'House Detail', desc: 'Deep dive into a specific house\'s week', color: '#3b82f6' },
  { id: 'entry_log', label: 'Full Entry Log', desc: 'Searchable list of every diary entry', color: '#8b5cf6' },
  { id: 'staff_activity', label: 'Staff Activity', desc: 'Who logged what, across all houses', color: '#f59e0b' },
];

export function ReportsPage({ weekData, setPage }: Props) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [houseFilter, setHouseFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'red' | 'amber' | 'green'>('all');

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="w-16 h-16 rounded-2xl bg-hc-card border border-hc-border flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-hc-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Import Data for Reports</h2>
        <p className="text-hc-muted text-sm mb-4">Load Nourish data to generate reports.</p>
        <button onClick={() => setPage('upload')} className="px-5 py-2 bg-hc-teal text-white text-sm font-semibold rounded-xl hover:bg-hc-teal-light">Import Data</button>
      </div>
    );
  }

  const houses = Object.keys(weekData.houses).sort();
  const allEntries = Object.values(weekData.houses).flatMap(h => h.entries);

  // Apply filters
  let filtered = allEntries;
  if (houseFilter !== 'all') filtered = filtered.filter(e => e.house === houseFilter);
  if (severityFilter !== 'all') {
    if (severityFilter === 'red') filtered = filtered.filter(e => e.severity === 'red');
    else if (severityFilter === 'amber') filtered = filtered.filter(e => e.severity === 'amber');
    else filtered = filtered.filter(e => e.severity !== 'red' && e.severity !== 'amber');
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(e =>
      e.entry.toLowerCase().includes(s) ||
      e.client.toLowerCase().includes(s) ||
      e.carer.toLowerCase().includes(s) ||
      e.house.toLowerCase().includes(s) ||
      e.type.toLowerCase().includes(s)
    );
  }

  function printReport() {
    window.print();
  }

  function exportCSV() {
    const header = 'Date,House,Type,Client,Carer,Severity,Flags,Entry\n';
    const rows = filtered.map(e =>
      `"${e.date}","${e.house}","${e.type}","${e.client}","${e.carer}","${e.severity}","${e.flags.join('; ')}","${e.entry.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hazelcare-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Reports</h1>
          <p className="text-hc-muted text-sm">
            {weekData.dateFrom && weekData.dateTo ? `${weekData.dateFrom} — ${weekData.dateTo}` : 'Current period'}
            {' · '}{allEntries.length} total entries
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-4 py-2 bg-hc-card border border-hc-border text-xs text-hc-muted rounded-xl hover:text-white hover:border-hc-border-light">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
          <button onClick={printReport} className="flex items-center gap-1.5 px-4 py-2 bg-hc-teal text-white text-xs font-semibold rounded-xl hover:bg-hc-teal-light">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print
          </button>
        </div>
      </div>

      {/* Report type selector */}
      {!selectedReport && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
          {REPORT_TYPES.map(rt => (
            <button
              key={rt.id}
              onClick={() => setSelectedReport(rt.id)}
              className="bg-hc-card border border-hc-border rounded-xl p-4 text-left hover:border-hc-border-light transition-all"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${rt.color}15` }}>
                <div className="w-3 h-3 rounded-full" style={{ background: rt.color }} />
              </div>
              <div className="text-xs font-semibold text-white mb-0.5">{rt.label}</div>
              <div className="text-[10px] text-hc-muted">{rt.desc}</div>
            </button>
          ))}
        </div>
      )}

      {selectedReport && (
        <button onClick={() => setSelectedReport(null)} className="flex items-center gap-1.5 text-xs text-hc-muted hover:text-white mb-4">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to report types
        </button>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hc-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries, clients, staff..." className="w-full pl-9 pr-4 py-2 bg-hc-card border border-hc-border rounded-xl text-sm text-white placeholder:text-hc-muted/50 focus:outline-none focus:border-hc-teal-light" />
        </div>
        <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)} className="bg-hc-card border border-hc-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-hc-teal-light">
          <option value="all">All Houses</option>
          {houses.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <div className="flex gap-1 bg-hc-card border border-hc-border rounded-xl p-1">
          {(['all', 'red', 'amber', 'green'] as const).map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)} className={`px-3 py-1 text-[11px] rounded-lg ${severityFilter === s ? 'bg-hc-teal/15 text-hc-teal-light font-semibold' : 'text-hc-muted hover:text-white'}`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="text-xs text-hc-muted self-center">{filtered.length} entries</div>
      </div>

      {/* Results */}
      <div className="space-y-1.5">
        {filtered.slice(0, 100).map((entry, i) => (
          <div key={i} className={`bg-hc-card border rounded-xl p-3 flex items-start gap-3 ${
            entry.severity === 'red' ? 'border-flag-red/20' : entry.severity === 'amber' ? 'border-flag-amber/20' : 'border-hc-border'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
              entry.severity === 'red' ? 'bg-flag-red' : entry.severity === 'amber' ? 'bg-flag-amber' : 'bg-flag-green'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-[11px] font-semibold text-white">{entry.house}</span>
                <span className="text-[10px] text-hc-teal-light">{entry.type}</span>
                {entry.client && <span className="text-[10px] text-hc-muted">{entry.client}</span>}
                {entry.date && <span className="text-[10px] text-hc-muted ml-auto">{entry.date}</span>}
              </div>
              <p className="text-[11px] text-hc-text leading-relaxed">{entry.entry}</p>
              {entry.flags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {entry.flags.map((f, fi) => (
                    <span key={fi} className={`text-[8px] px-1.5 py-0.5 rounded border ${
                      entry.severity === 'red' ? 'bg-flag-red/10 text-flag-red border-flag-red/20' : 'bg-flag-amber/10 text-flag-amber border-flag-amber/20'
                    }`}>{f}</span>
                  ))}
                </div>
              )}
              {entry.carer && entry.carer !== 'Staff' && (
                <div className="text-[10px] text-hc-muted mt-1">Staff: {entry.carer}</div>
              )}
            </div>
          </div>
        ))}
        {filtered.length > 100 && (
          <div className="text-center text-xs text-hc-muted py-3">Showing first 100 of {filtered.length} entries. Use filters to narrow down.</div>
        )}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-hc-muted text-sm">No entries match your filters</div>
        )}
      </div>
    </div>
  );
}
