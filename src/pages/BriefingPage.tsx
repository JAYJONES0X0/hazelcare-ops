import { useMemo, useState, useEffect } from 'react';
import type { WeekSummary, Action, Page, PageContext } from '../lib/types';
import { detectTrends } from '../lib/trends';
import { useCollapseStore } from '../lib/collapse-store';
import { Activity, ChevronRight, TrendingUp, AlertTriangle, Upload } from 'lucide-react';
import { RadarLoader } from '../components/NexusLoader';
import { getAllEntriesAsync } from '../lib/entry-store';
import { buildWeekSummary } from '../lib/universal-parser';

interface Props {
  weekData: WeekSummary | null;
  actions: Action[];
  setPage: (p: Page, ctx?: PageContext) => void;
}

export function BriefingPage({ weekData: weekDataProp, actions, setPage }: Props) {
  const [storedWeekData, setStoredWeekData] = useState<WeekSummary | null>(null);
  const [hydrating, setHydrating] = useState(!weekDataProp);

  // Self-hydrate from IndexedDB if prop is null
  useEffect(() => {
    if (weekDataProp) return;
    let alive = true;
    getAllEntriesAsync().then(entries => {
      if (alive && entries.length > 0) setStoredWeekData(buildWeekSummary(entries));
      if (alive) setHydrating(false);
    }).catch(() => {
      if (alive) setHydrating(false);
    });
    return () => { alive = false; };
  }, [weekDataProp]);

  const weekData = weekDataProp || storedWeekData;

  const allEntries = useMemo(() => weekData ? Object.values(weekData.houses).flatMap(h => h.entries) : [], [weekData]);
  const trends = useMemo(() => detectTrends(allEntries), [allEntries]);

  const priorityClients = useMemo(() => {
    if (!weekData) return [];
    const matrix: Record<string, { name: string; house: string; red: number; amber: number; latest: string }> = {};
    for (const house of Object.values(weekData.houses)) {
      for (const e of house.entries) {
        const k = e.client || 'Unknown';
        if (!matrix[k]) matrix[k] = { name: k, house: house.name, red: 0, amber: 0, latest: '' };
        if (e.severity === 'red') { matrix[k].red++; matrix[k].latest = e.entry.slice(0, 100); }
        if (e.severity === 'amber') { matrix[k].amber++; if (!matrix[k].latest) matrix[k].latest = e.entry.slice(0, 100); }
      }
    }
    return Object.values(matrix).filter(c => c.red > 0 || c.amber > 0)
      .sort((a, b) => (b.red * 10 + b.amber) - (a.red * 10 + a.amber)).slice(0, 6);
  }, [weekData]);

  const {
    collapseAll: collapseAllSections,
    expandAll: expandAllSections,
    allCollapsed: allSectionsCollapsed,
    isCollapsed: isSectionCollapsed,
    toggle: toggleSection,
  } = useCollapseStore('briefing-sections');
  
  const SECTION_IDS = ['interventions', 'clients', 'trends', 'houses'];
  const allCollapsed = allSectionsCollapsed(SECTION_IDS);

  if (hydrating) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-hc-bg p-4">
        <div className="flex flex-col items-center gap-4">
          <RadarLoader color="#2dd4bf" size={40} />
          <div className="text-[10px] font-black text-hc-teal uppercase tracking-[0.3em] animate-pulse">Initialising Briefing Matrix</div>
        </div>
      </div>
    );
  }

  if (!weekData) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4 sm:p-8 bg-hc-bg animate-in fade-in duration-1000">
        <div className="w-32 h-32 rounded-3xl hc-clay-raised flex items-center justify-center mb-10">
          <Upload className="w-12 h-12 text-hc-teal opacity-20" />
        </div>
        <h2 className="text-3xl font-black text-hc-text tracking-[0.4em] uppercase mb-6 text-center">No Data Yet</h2>
        <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.4em] mb-12 text-center max-w-sm">Drop in a diary CSV/PDF export to initialise the briefing.</p>
        <button onClick={() => setPage('upload')} className="btn-clay btn-clay-teal h-[70px] px-12">Import Hub</button>
      </div>
    );
  }

  const openActions = actions.filter(a => a.status !== 'completed');

  return (
    <div className="min-h-dvh p-4 sm:p-6 lg:p-10 flex flex-col gap-6 sm:gap-8 lg:gap-12 bg-hc-bg overflow-y-auto scrollbar-thin">
      
      {/* ── MISSION HEADER ── */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-10 pb-12 border-b border-hc-border">
        <div>
          <div className="text-[10px] sm:text-[11px] font-black tracking-[0.4em] text-hc-teal uppercase mb-2">OVSITE // Service Overview</div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-hc-text tracking-[0.15em] sm:tracking-[0.3em] uppercase">Daily Briefing</h1>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-[11px] font-black text-hc-teal-light uppercase tracking-widest">Review Period</span>
              <span className="text-[11px] font-black text-hc-muted uppercase tabular-nums">{weekData.dateFrom} — {weekData.dateTo}</span>
           </div>
           <button
             onClick={() => allCollapsed ? expandAllSections(SECTION_IDS) : collapseAllSections(SECTION_IDS)}
             className="btn-clay h-[54px] !rounded-2xl px-8 text-[11px]"
           >
             {allCollapsed ? 'EXPAND ALL' : 'COLLAPSE ALL'}
           </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full space-y-12 pb-24">

        {/* ── PRIORITY INTERVENTIONS ── */}
        <Section id="interventions" title="Priority Follow-ups" collapsed={isSectionCollapsed('interventions')} onToggle={() => toggleSection('interventions')} count={openActions.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {openActions.slice(0, 6).map(a => (
              <div key={a.id} onClick={() => setPage('actions')} className="hc-clay-raised p-8 flex flex-col gap-6 group cursor-pointer transition-all hover:translate-y-[-4px]">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black px-3 py-1 rounded border uppercase tracking-widest ${a.priority === 'critical' ? 'bg-hc-red/10 border-hc-red text-hc-red' : 'bg-hc-teal/10 border-hc-teal text-hc-teal'}`}>{a.priority}</span>
                  <Activity size={14} className="text-hc-muted opacity-20" />
                </div>
                <div className="flex flex-col gap-2">
                   <div className="text-xs font-black text-hc-text uppercase tracking-wider group-hover:text-hc-teal transition-colors">{a.title}</div>
                   <div className="text-[11px] font-black text-hc-muted tracking-widest flex justify-between uppercase">
                      <span>Owner: {a.owner}</span>
                      <span className="tabular-nums">{a.dueDate}</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── CLIENT STABILITY MATRIX ── */}
        <Section id="clients" title="People to Watch" collapsed={isSectionCollapsed('clients')} onToggle={() => toggleSection('clients')} count={priorityClients.length}>
          <div className="hc-clay-inset p-2 overflow-hidden">
            <table className="w-full text-left border-separate border-spacing-2">
              <thead>
                <tr className="text-[11px] font-black text-hc-muted uppercase tracking-[0.4em]">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">House</th>
                  <th className="px-6 py-4 text-center">Alerts</th>
                  <th className="px-6 py-4">Latest Note</th>
                </tr>
              </thead>
              <tbody>
                {priorityClients.map(c => (
                  <tr key={c.name} onClick={() => setPage('client-diary', { client: c.name })} className="group cursor-pointer">
                    <td className="px-6 py-5 bg-hc-surface-2 rounded-l-2xl text-xs font-black text-hc-text uppercase tracking-widest group-hover:bg-hc-surface transition-colors">{c.name}</td>
                    <td className="px-6 py-5 bg-hc-surface-2 text-[11px] font-black text-hc-muted uppercase tracking-widest text-center group-hover:bg-hc-surface transition-colors">{c.house}</td>
                    <td className="px-6 py-5 bg-hc-surface-2 group-hover:bg-hc-surface transition-colors">
                      <div className="flex justify-center gap-3">
                        {c.red > 0 && <span className="bg-hc-red/10 text-hc-red px-2 py-0.5 text-[11px] font-black border border-hc-red/30 rounded">{c.red}</span>}
                        {c.amber > 0 && <span className="bg-hc-amber/10 text-hc-amber px-2 py-0.5 text-[11px] font-black border border-hc-amber/30 rounded">{c.amber}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5 bg-hc-surface-2 rounded-r-2xl text-[11px] font-black text-hc-muted italic truncate max-w-sm group-hover:bg-hc-surface transition-colors">"{c.latest}..."</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── OPERATIONAL TRENDS ── */}
        <Section id="trends" title="Operational Trends" collapsed={isSectionCollapsed('trends')} onToggle={() => toggleSection('trends')} count={trends.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trends.map(t => (
              <div key={t.id} className="hc-clay-raised p-8 flex items-start gap-8">
                <div className="w-14 h-14 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal">
                  {t.severity === 'critical' ? <AlertTriangle size={20} className="text-hc-red" /> : <TrendingUp size={20} />}
                </div>
                <div>
                  <div className={`text-[11px] font-black uppercase tracking-[0.3em] mb-3 ${t.severity === 'critical' ? 'text-hc-red' : 'text-hc-teal'}`}>{t.title}</div>
                  <p className="text-[11px] font-black text-hc-muted leading-relaxed uppercase italic">"{t.detail}"</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── STATION PERFORMANCE ── */}
        <Section id="houses" title="House Performance" collapsed={isSectionCollapsed('houses')} onToggle={() => toggleSection('houses')} count={Object.keys(weekData.houses).length}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.values(weekData.houses).map(h => (
              <div key={h.name} className="hc-clay-raised p-8 flex flex-col gap-8 group">
                <div className="flex items-center justify-between border-b border-hc-border pb-4">
                   <h3 className="text-sm font-black text-hc-text uppercase tracking-widest">{h.name.toUpperCase()}</h3>
                   <div className={`w-2 h-2 rounded-full ${h.flags.red > 0 ? 'bg-hc-red animate-pulse' : 'bg-hc-teal'}`} />
                </div>
                <div className="space-y-4">
                  <Metric label="Captured" val={h.entries.length} />
                  <Metric label="Critical" val={h.flags.red} red />
                  <Metric label="Monitor" val={h.flags.amber} amber />
                </div>
                <button onClick={() => setPage('staff-monitoring')} className="btn-clay !py-2.5 !rounded-xl text-[11px] mt-2 opacity-0 group-hover:opacity-100 transition-all">Staff cover ›</button>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ title, count, children, collapsed, onToggle }: { id: string; title: string; count?: number; children: React.ReactNode; collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <button onClick={onToggle} className="flex items-center justify-between px-2 group">
        <div className="flex items-center gap-6">
          <div className="w-1 h-6 bg-hc-teal rounded-full" />
          <h2 className="text-[12px] font-black text-hc-text uppercase tracking-[0.4em]">{title}</h2>
        </div>
        <div className="flex items-center gap-8">
          {count != null && <div className="text-[11px] font-black text-hc-muted tabular-nums tracking-widest bg-hc-surface-2 px-3 py-1 rounded-lg">{String(count).padStart(3, '0')}</div>}
          <div className={`hc-clay-raised !w-10 !h-10 flex items-center justify-center text-hc-muted transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}>
             <ChevronRight size={16} />
          </div>
        </div>
      </button>
      {!collapsed && <div className="animate-in fade-in slide-in-from-top-4 duration-500">{children}</div>}
    </div>
  );
}

function Metric({ label, val, red, amber }: { label: string; val: number; red?: boolean; amber?: boolean }) {
  return (
    <div className="flex items-center justify-between group/met">
      <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] group-hover/met:text-hc-text transition-opacity">{label}</span>
      <span className={`text-[12px] font-black tabular-nums transition-all ${red ? 'text-hc-red scale-110' : amber ? 'text-hc-amber' : 'text-hc-text'}`}>{val}</span>
    </div>
  );
}
