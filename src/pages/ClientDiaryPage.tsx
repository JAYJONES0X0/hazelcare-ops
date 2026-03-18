import { useState, useMemo } from 'react';
import type { WeekSummary, NourishEntry } from '../lib/types';
import { loadClients } from '../lib/client-store';
import type { Page } from '../App';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
}

const TYPE_COLORS: Record<string, string> = {
  'Daily 1:1 Support': '#0f766e',
  'Task note generated via Mobile App': '#1e40af',
  'Handover note generated via Mobile App': '#7c3aed',
  'Handover': '#7c3aed',
  'Accident /Incident': '#dc2626',
  'Accident/Incident': '#dc2626',
  'Medication collected': '#0891b2',
  'Financial Transaction': '#059669',
  'Expenses/Mileage': '#059669',
  'Repairs': '#d97706',
  'Professional Notes': '#9333ea',
  'Daily Quality Meeting': '#475569',
  'Daily Maintenance Meeting': '#475569',
  'CQC': '#be185d',
  'Complaints': '#dc2626',
  'Compliments': '#16a34a',
  'Care Review': '#0f766e',
  'Concern': '#d97706',
  'Safeguarding': '#dc2626',
};

function typeColor(type: string): string {
  for (const [k, v] of Object.entries(TYPE_COLORS)) {
    if (type.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return '#475569';
}

function severityDot(s: NourishEntry['severity']) {
  if (s === 'red') return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />;
  if (s === 'amber') return <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />;
  return <span className="w-2 h-2 rounded-full bg-[#1e3050] flex-shrink-0 mt-1.5" />;
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
    <div className="space-y-3 mb-5">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0a1120] border border-[#1e3050] rounded-lg p-3 text-center">
          <div className="text-xl font-black text-white">{total}</div>
          <div className="text-[10px] text-gray-500">Total Entries</div>
        </div>
        <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 text-center">
          <div className="text-xl font-black text-red-400">{red}</div>
          <div className="text-[10px] text-gray-500">Red Flags</div>
        </div>
        <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3 text-center">
          <div className="text-xl font-black text-amber-400">{amber}</div>
          <div className="text-[10px] text-gray-500">Amber Flags</div>
        </div>
      </div>

      {/* Type breakdown bar */}
      <div>
        <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wide">Entry breakdown</p>
        <div className="space-y-1.5">
          {byType.slice(0, 6).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="text-[10px] text-gray-400 w-40 truncate">{type}</div>
              <div className="flex-1 h-1.5 bg-[#1e3050] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, background: typeColor(type) }} />
              </div>
              <div className="text-[10px] text-gray-500 w-6 text-right">{count}</div>
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
    if (severityFilter) entries = entries.filter(e => e.severity === severityFilter);
    return [...entries].sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedClient, clientDiary, typeFilter, severityFilter]);

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="text-5xl mb-4">📋</div>
        <h2 className="text-lg font-bold text-white mb-2">No diary data loaded</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          Drop a Nourish CSV export to see all client diaries here. Go to Import to upload your data.
        </p>
        <button onClick={() => setPage('upload')}
          className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg">
          Import CSV
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* Client list sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-[#1e3050] flex flex-col bg-[#060b14]">
        <div className="p-3 border-b border-[#1e3050]">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
            {allClients.length} clients · {weekData.dateFrom}–{weekData.dateTo}
          </p>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client…"
            className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 placeholder-gray-600"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredClients.map(name => {
            const entries = clientDiary[name] || [];
            const red = entries.filter(e => e.severity === 'red').length;
            const amber = entries.filter(e => e.severity === 'amber').length;
            const hasDocs = storedClients.some(n => n.includes(name.toLowerCase().split(' ')[0]));
            const isSelected = selectedClient === name;
            return (
              <button key={name} onClick={() => { setSelectedClient(name); setTypeFilter(''); setSeverityFilter(''); }}
                className={`w-full text-left px-3 py-3 border-b border-[#1e3050] transition-colors
                  ${isSelected ? 'bg-teal-900/30 border-l-2 border-l-teal-500' : 'hover:bg-[#111b2e]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[12px] font-semibold leading-tight ${isSelected ? 'text-teal-300' : 'text-white'}`}>
                    {name}
                  </span>
                  <div className="flex gap-1 flex-shrink-0 mt-0.5">
                    {red > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-900/60 text-red-400">{red}</span>}
                    {amber > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400">{amber}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-600">{entries.length} entries</span>
                  {hasDocs && <span className="text-[10px] text-teal-600">● PBS/Risk</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedClient ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-4xl mb-3">👤</div>
            <p className="text-gray-400 font-medium">Select a client</p>
            <p className="text-sm text-gray-600 mt-1">{allClients.length} clients in this dataset</p>
          </div>
        ) : (
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedClient}</h2>
                <p className="text-xs text-gray-500">
                  Client Diary · {weekData.dateFrom} – {weekData.dateTo}
                </p>
              </div>
              <div className="flex gap-2">
                {storedClients.some(n => n.includes(selectedClient.toLowerCase().split(' ')[0])) && (
                  <button onClick={() => setPage('client-docs')}
                    className="text-xs bg-teal-900/40 border border-teal-800 text-teal-400 px-3 py-1.5 rounded-lg hover:bg-teal-800/50">
                    Open PBS / Risk
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <ClientStats entries={clientDiary[selectedClient] || []} />

            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="bg-[#0a1120] border border-[#1e3050] text-sm text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-500">
                <option value="">All entry types</option>
                {allTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
                className="bg-[#0a1120] border border-[#1e3050] text-sm text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-500">
                <option value="">All severities</option>
                <option value="red">🔴 Red flags only</option>
                <option value="amber">🟡 Amber flags only</option>
                <option value="none">No flags</option>
              </select>
              {(typeFilter || severityFilter) && (
                <button onClick={() => { setTypeFilter(''); setSeverityFilter(''); }}
                  className="text-xs text-gray-500 hover:text-white border border-[#1e3050] px-3 py-1.5 rounded-lg">
                  Clear filters
                </button>
              )}
              <span className="text-xs text-gray-600 flex items-center">{selectedEntries.length} entries shown</span>
            </div>

            {/* Entries */}
            <div className="space-y-2">
              {selectedEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-sm">No entries match the current filters.</div>
              ) : selectedEntries.map(entry => (
                <div key={entry.id}
                  className={`bg-[#0a1120] border rounded-xl px-4 py-3
                    ${entry.severity === 'red' ? 'border-red-900/60' : entry.severity === 'amber' ? 'border-amber-900/40' : 'border-[#1e3050]'}`}>
                  <div className="flex items-start gap-3">
                    {severityDot(entry.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: typeColor(entry.type) + '33', color: typeColor(entry.type), border: `1px solid ${typeColor(entry.type)}55` }}>
                          {entry.type}
                        </span>
                        <span className="text-[10px] text-gray-500">{entry.date}</span>
                        {entry.carer && entry.carer !== 'Staff' && (
                          <span className="text-[10px] text-gray-600">— {entry.carer}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{entry.entry}</p>
                      {entry.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {entry.flags.map((f, i) => (
                            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-medium
                              ${entry.severity === 'red' ? 'bg-red-900/40 text-red-400' : 'bg-amber-900/30 text-amber-400'}`}>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
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
