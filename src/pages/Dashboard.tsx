import { useState, useEffect } from 'react';
import { Activity, ChevronRight, Shield, Printer, Zap, AlertTriangle, Calendar, RefreshCw } from 'lucide-react';
import type { WeekSummary, Action, Incident } from '../lib/types';
import type { Page } from '../App';
import { getEntriesForRangeAsync, getStoreBoundsAsync } from '../lib/entry-store';
import { buildWeekSummary } from '../lib/universal-parser';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page, ctx?: any) => void;
  actions: Action[];
  incidents: Incident[];
}


function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Quick preset buttons
const PRESETS = [
  { label: 'Today',    days: 0  },
  { label: '7 Days',   days: 7  },
  { label: '30 Days',  days: 30 },
  { label: '90 Days',  days: 90 },
  { label: 'All Time', days: -1 },
];

export function Dashboard({ weekData, setPage, actions, incidents }: Props) {
  // ── Date range state ──────────────────────────────────────────────────────
  const [storeBounds, setStoreBounds] = useState<{ from: string; to: string; count: number } | null>(null);
  const [dateFrom, setDateFrom] = useState(''); // ISO yyyy-mm-dd
  const [dateTo,   setDateTo]   = useState('');
  const [filteredData, setFilteredData] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalInStore, setTotalInStore] = useState(0);

  // Load store bounds on mount
  useEffect(() => {
    void (async () => {
      const bounds = await getStoreBoundsAsync();
      if (bounds) {
        setStoreBounds(bounds);
        setTotalInStore(bounds.count);
        // Default to last 30 days
        const to = new Date();
        const from = new Date(); from.setDate(to.getDate() - 30);
        const toISO   = to.toISOString().slice(0, 10);
        const fromISO = from.toISOString().slice(0, 10);
        setDateTo(toISO);
        setDateFrom(fromISO);
      }
    })();
  }, []);

  // Re-query whenever date range changes
  useEffect(() => {
    if (!dateFrom && !dateTo) {
      setFilteredData(weekData);
      return;
    }
    setLoading(true);
    void (async () => {
      const fromStr = dateFrom ? formatDisplayDate(dateFrom) : null;
      const toStr   = dateTo   ? formatDisplayDate(dateTo)   : null;
      const entries = await getEntriesForRangeAsync(fromStr, toStr);
      if (entries.length > 0) {
        setFilteredData(buildWeekSummary(entries));
      } else if (weekData) {
        // Fall back to the passed-in weekData if IDB is empty (first import)
        setFilteredData(weekData);
      }
      setLoading(false);
    })();
  }, [dateFrom, dateTo, weekData]);

  function applyPreset(days: number) {
    if (days === -1) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const to = new Date();
    const from = new Date(); from.setDate(to.getDate() - days);
    setDateTo(to.toISOString().slice(0, 10));
    setDateFrom(from.toISOString().slice(0, 10));
  }

  // Active data = filtered or fallback to passed-in weekData
  const data = filteredData || weekData;

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-[2.5rem] hc-clay-inset flex items-center justify-center mb-8 animate-float">
          <Zap className="w-12 h-12 text-hc-teal" />
        </div>
        <h2 className="text-2xl font-black text-hc-text mb-3 uppercase tracking-tight">Intelligence Feed Offline</h2>
        <p className="text-hc-muted text-[11px] font-bold uppercase tracking-widest mb-10 text-center max-w-xs leading-relaxed">
          Injest a clinical data stream to initialise the Sitrep Center.
        </p>
        <button onClick={() => setPage('upload')} className="btn-tactical shadow-2xl">INITIALISE INGEST VECTOR</button>
      </div>
    );
  }

  const houseStats = Object.entries(data.houses).map(([name, houseData]) => {
    const red = houseData.entries.filter(e => e.severity === 'red').length;
    return { name, entries: houseData.entries, red };
  }).sort((a, b) => b.red - a.red || b.entries.length - a.entries.length);

  const totalEntries     = data.totalEntries || 0;
  const activeStaff      = new Set(Object.values(data.houses).flatMap(h => h.entries.map(e => e.carer))).size;
  const pendingActions   = actions.filter(a => a.status !== 'completed').length;
  const activeIncidents  = incidents.filter(i => i.stage !== 'closed').length;
  const totalRedFlags    = data.allFlags?.red.length || 0;
  const totalAmberFlags  = data.allFlags?.amber.length || 0;
  const uniqueClients    = new Set(Object.values(data.houses).flatMap(h => h.entries.map(e => e.client))).size;

  const dateLabel = dateFrom || dateTo
    ? `${dateFrom ? formatDisplayDate(dateFrom) : '…'} → ${dateTo ? formatDisplayDate(dateTo) : 'Today'}`
    : 'All Time';

  return (
    <div className="animate-in fade-in duration-700">

      {/* ── DATE RANGE CONTROL BAR ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-hc-bg/95 backdrop-blur-xl border-b border-hc-border/30 px-6 lg:px-12 py-4">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center gap-4">

          {/* Store stats */}
          {storeBounds && (
            <div className="flex items-center gap-2 mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
              <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">
                {totalInStore.toLocaleString()} Records · {storeBounds.from} → {storeBounds.to}
              </span>
            </div>
          )}

          <div className="h-4 w-px bg-hc-border/40 hidden md:block" />

          {/* Preset buttons */}
          <div className="flex items-center gap-2">
            {PRESETS.map(p => {
              const active =
                p.days === -1 ? !dateFrom && !dateTo :
                p.days === 0  ? dateFrom === new Date().toISOString().slice(0, 10) :
                false;
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.days)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    active
                      ? 'bg-hc-teal text-hc-bone shadow'
                      : 'hc-clay-raised text-hc-muted hover:text-hc-text'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom date inputs */}
          <div className="flex items-center gap-2 ml-auto">
            <Calendar size={12} className="text-hc-muted" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="hc-clay-inset px-3 py-1.5 text-[11px] font-black text-hc-text rounded-lg outline-none border border-hc-border/20 focus:border-hc-teal/50 transition-all"
            />
            <span className="text-[11px] text-hc-muted font-black">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="hc-clay-inset px-3 py-1.5 text-[11px] font-black text-hc-text rounded-lg outline-none border border-hc-border/20 focus:border-hc-teal/50 transition-all"
            />
            {loading && <RefreshCw size={12} className="text-hc-teal animate-spin" />}
          </div>

        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div className="p-6 lg:p-12 max-w-[1800px] mx-auto space-y-12">

        {/* ── SITREP HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-hc-border pb-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="pill pill-teal text-[10px]">HAZEL CARE · COMMAND INTEL</span>
              <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
              <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">LIVE SITREP · {dateLabel}</span>
            </div>
            <h1 className="text-5xl font-black text-hc-text tracking-tighter uppercase leading-none">Sitrep Center</h1>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setPage('briefing')} className="px-6 py-3 hc-clay-raised text-[11px] font-black uppercase text-hc-text hover:text-hc-teal transition-all rounded-xl">Mission Briefing</button>
            <button onClick={() => setPage('staff-monitoring')} className="px-6 py-3 bg-hc-teal text-hc-bone text-[11px] font-black uppercase tracking-widest rounded-xl shadow-xl hover:scale-105 transition-all">Staff Monitoring</button>
          </div>
        </div>

        {/* ── KPI PODS ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Intelligence Records', val: totalEntries.toLocaleString(), sub: 'In Window',         color: 'text-hc-text'    },
            { label: 'Service Users',         val: uniqueClients,                sub: 'Active Clients',    color: 'text-hc-text'    },
            { label: 'Personnel Active',      val: activeStaff,                  sub: 'Field Strength',    color: 'text-hc-text'    },
            { label: 'Critical Escalations',  val: totalRedFlags,                sub: 'Immediate Action',  color: 'text-flag-red'   },
            { label: 'Open Command Tasks',    val: pendingActions,               sub: 'Pipeline',          color: 'text-flag-amber' },
            { label: 'Active Incidents',      val: activeIncidents,              sub: 'Force Protection',  color: 'text-flag-red'   },
          ].map(s => (
            <div key={s.label} className="hc-clay-raised p-6 flex flex-col gap-3 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest leading-tight">{s.label}</div>
              <div className={`text-3xl font-black tabular-nums tracking-tighter ${s.color}`}>{s.val}</div>
              <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── ENTRY TYPE VECTOR FEED ── */}
        {data.entryTypes && Object.keys(data.entryTypes).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-black text-hc-muted uppercase tracking-[0.4em] px-2">Signal Type Distribution</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {Object.entries(data.entryTypes)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const max = Math.max(...Object.values(data.entryTypes!));
                  const pct = Math.round((count / max) * 100);
                  return (
                    <div key={type} className="hc-clay-raised flex-shrink-0 px-5 py-4 rounded-2xl flex flex-col gap-2 min-w-[130px]">
                      <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest leading-tight truncate">{type}</div>
                      <div className="text-xl font-black text-hc-text tabular-nums">{count.toLocaleString()}</div>
                      <div className="w-full h-1 rounded-full bg-hc-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-hc-teal transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── AMBER FLAG SUMMARY STRIP ── */}
        {totalAmberFlags > 0 && (
          <div className="hc-clay-raised border border-flag-amber/20 p-4 rounded-xl flex items-center gap-4">
            <AlertTriangle size={16} className="text-flag-amber flex-shrink-0" />
            <span className="text-[11px] font-black text-hc-text uppercase tracking-widest">
              {totalAmberFlags} amber alert{totalAmberFlags !== 1 ? 's' : ''} require review in selected window
            </span>
            <button onClick={() => setPage('client-diary')} className="ml-auto text-[10px] font-black text-flag-amber uppercase tracking-widest hover:underline">
              Review →
            </button>
          </div>
        )}

        {/* ── 7-DAY PERSISTENCE MATRIX ── */}
        {(() => {
          // Collect all unique dates across all houses, sorted descending, last 7
          const allEntries = Object.values(data.houses).flatMap(h => h.entries);
          const dateSet = new Set(allEntries.map(e => e.date));
          const sortedDates = Array.from(dateSet)
            .sort((a, b) => {
              // DD/MM/YYYY → compare as date
              const [ad, am, ay] = a.split('/'); const [bd, bm, by] = b.split('/');
              return new Date(`${by}-${bm}-${bd}`).getTime() - new Date(`${ay}-${am}-${ad}`).getTime();
            })
            .slice(-7);

          if (sortedDates.length === 0) return null;

          const maxCount = Math.max(1, ...houseStats.map(h =>
            Math.max(1, ...sortedDates.map(d => h.entries.filter(e => e.date === d).length))
          ));

          return (
            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-hc-muted uppercase tracking-[0.4em] px-2">7-Day Persistence Matrix</h2>
              <div className="hc-clay-raised p-6 rounded-[2.25rem] overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[9px] font-black text-hc-muted uppercase tracking-widest pb-4 pr-4 w-32">Unit</th>
                      {sortedDates.map(d => (
                        <th key={d} className="text-center text-[9px] font-black text-hc-muted uppercase tracking-widest pb-4 px-2">
                          {d.slice(0, 5)}
                        </th>
                      ))}
                      <th className="text-right text-[9px] font-black text-hc-muted uppercase tracking-widest pb-4 pl-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {houseStats.map(h => (
                      <tr key={h.name} className="group">
                        <td className="pr-4 py-2">
                          <span className="text-[11px] font-black text-hc-text uppercase tracking-tight group-hover:text-hc-teal transition-colors">{h.name}</span>
                        </td>
                        {sortedDates.map(d => {
                          const cnt = h.entries.filter(e => e.date === d).length;
                          const intensity = cnt === 0 ? 0 : Math.max(0.12, cnt / maxCount);
                          return (
                            <td key={d} className="px-2 py-2 text-center">
                              <div
                                className="mx-auto w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black transition-all"
                                style={{
                                  background: cnt === 0
                                    ? 'var(--hc-surface-2)'
                                    : intensity >= 1
                                      ? 'var(--hc-bone)'
                                      : `rgba(76, 124, 124, ${Math.max(0.25, intensity)})`,
                                  color: cnt === 0
                                    ? 'var(--hc-muted)'
                                    : intensity >= 1
                                      ? '#0d2d2d'
                                      : 'var(--hc-bone)',
                                }}
                              >
                                {cnt === 0 ? '·' : cnt}
                              </div>
                            </td>
                          );
                        })}
                        <td className="pl-4 py-2 text-right">
                          <span className="text-[11px] font-black text-hc-text tabular-nums">{h.entries.length}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ── REGIONAL OPERATIONS MATRIX ── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[12px] font-black text-hc-muted uppercase tracking-[0.4em]">Regional Operations Matrix</h2>
            <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">{houseStats.length} Units Active</span>
          </div>

          {houseStats.length === 0 ? (
            <div className="hc-clay-raised rounded-2xl p-12 text-center">
              <p className="text-[11px] font-black text-hc-muted uppercase tracking-widest">No data for selected range — try widening the date window</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {houseStats.map(h => (
                <div
                  key={h.name}
                  onClick={() => setPage('client-diary', { house: h.name })}
                  className="hc-clay-raised p-6 rounded-[2.25rem] flex flex-col gap-5 group cursor-pointer hover:shadow-2xl transition-all relative overflow-hidden border border-hc-border/5 hover:border-hc-teal/20"
                >
                  {h.red > 0 && <div className="absolute top-0 right-0 w-24 h-24 bg-flag-red/5 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2" />}
                  <div className="flex items-center justify-between relative z-10">
                    <h3 className="text-sm font-black text-hc-text uppercase tracking-tight group-hover:text-hc-teal transition-colors">{h.name}</h3>
                    <div className={`w-2 h-2 rounded-full ${h.red > 0 ? 'bg-flag-red animate-pulse shadow-[0_0_8px_#d94e4e]' : 'bg-flag-green'}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="hc-clay-inset p-4 flex flex-col items-center gap-1 rounded-xl">
                      <span className="text-[9px] font-black text-hc-muted uppercase opacity-60">Signals</span>
                      <span className="text-2xl font-black text-hc-text tabular-nums">{h.entries.length}</span>
                    </div>
                    <div className={`hc-clay-inset p-4 flex flex-col items-center gap-1 rounded-xl transition-all ${h.red > 0 ? 'bg-flag-red/5' : ''}`}>
                      <span className="text-[9px] font-black text-hc-muted uppercase opacity-60">Red Flags</span>
                      <span className={`text-2xl font-black tabular-nums ${h.red > 0 ? 'text-flag-red' : 'text-hc-muted'}`}>{h.red}</span>
                    </div>
                  </div>
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-60">
                      {new Set(h.entries.map(e => e.client)).size} clients
                    </span>
                    <ChevronRight size={14} className="text-hc-muted group-hover:text-hc-teal group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── COMMAND VECTOR SHORTCUTS ── */}
        <div className="flex flex-col gap-6 pb-20">
          <h2 className="text-[12px] font-black text-hc-muted uppercase tracking-[0.4em] px-2">Command Vector Shortcuts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {[
              { label: 'Force Protection',    desc: 'Readiness & Diagnostic', icon: <Activity />,      id: 'staff-monitoring' },
              { label: 'Incident Governance', desc: 'Active Escalations',     icon: <AlertTriangle />, id: 'incidents'        },
              { label: 'Command Vectors',     desc: 'Deployment Queue',       icon: <Zap />,           id: 'actions'          },
              { label: 'Regulatory Audit',    desc: 'Compliance Readiness',   icon: <Shield />,        id: 'compliance'       },
              { label: 'Audit Archives',      desc: 'Advanced Data Export',   icon: <Printer />,       id: 'reports'          },
            ].map(btn => (
              <div
                key={btn.label}
                onClick={() => setPage(btn.id as Page)}
                className="hc-clay-raised p-8 rounded-[2rem] flex flex-col gap-8 group cursor-pointer hover:translate-y-[-4px] transition-all border border-hc-border/5 hover:border-hc-teal/20"
              >
                <div className="w-14 h-14 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal transition-transform group-hover:scale-110">
                  {btn.icon}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-black text-hc-text uppercase tracking-wider group-hover:text-hc-teal transition-colors">{btn.label}</div>
                  <div className="flex items-center justify-between text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                    {btn.desc}
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
