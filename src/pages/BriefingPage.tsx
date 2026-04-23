import { useMemo } from 'react';
import type { WeekSummary, Action } from '../lib/types';
import type { Page } from '../App';
import { detectTrends } from '../lib/trends';
import { useCollapseStore } from '../lib/collapse-store';

interface Props {
  weekData: WeekSummary | null;
  actions: Action[];
  setPage: (p: Page) => void;
}

export function BriefingPage({ weekData, actions, setPage }: Props) {
  const allEntries = useMemo(() => weekData ? Object.values(weekData.houses).flatMap(h => h.entries) : [], [weekData]);
  const trends = useMemo(() => detectTrends(allEntries), [allEntries]);

  const priorityClients = useMemo(() => {
    if (!weekData) return [];
    const m: Record<string, { name: string; house: string; red: number; amber: number; latest: string }> = {};
    for (const house of Object.values(weekData.houses)) {
      for (const e of house.entries) {
        const k = e.client || 'Unknown';
        if (!m[k]) m[k] = { name: k, house: house.name, red: 0, amber: 0, latest: '' };
        if (e.severity === 'red') { m[k].red++; m[k].latest = e.entry.slice(0, 100); }
        if (e.severity === 'amber') { m[k].amber++; if (!m[k].latest) m[k].latest = e.entry.slice(0, 100); }
      }
    }
    return Object.values(m).filter(c => c.red > 0 || c.amber > 0)
      .sort((a, b) => (b.red * 10 + b.amber) - (a.red * 10 + a.amber)).slice(0, 10);
  }, [weekData]);

  const SECTION_IDS = ['interventions', 'clients', 'trends', 'houses'];
  const {
    collapseAll: collapseAllSections,
    expandAll: expandAllSections,
    allCollapsed: allSectionsCollapsed,
    isCollapsed: isSectionCollapsed,
    toggle: toggleSection,
  } = useCollapseStore('briefing-sections');
  const allCollapsed = allSectionsCollapsed(SECTION_IDS);

  if (!weekData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-950 animate-in fade-in duration-700">
        <div className="text-[11px] font-black tracking-[0.3em] text-hc-teal-light uppercase mb-6 border-b border-hc-teal/30 pb-2">INTELLIGENCE OFFLINE</div>
        <div className="w-16 h-px bg-slate-800 mb-8" />
        <h2 className="text-2xl font-black text-white mb-4 tracking-tighter uppercase">No Live Telemetry</h2>
        <p className="text-slate-400 text-[11px] font-bold mb-10 text-center max-w-xs uppercase tracking-widest leading-relaxed">
          Sync regional operational data to generate service briefing.
        </p>
        <button onClick={() => setPage('upload')} className="px-10 py-3 border border-hc-teal/40 bg-hc-teal/5 text-hc-teal-light hover:bg-hc-teal/10 text-[10px] font-black uppercase tracking-[0.25em] transition-all">
          Initialize Sync
        </button>
      </div>
    );
  }

  const openActions = actions.filter(a => a.status !== 'completed');

  return (
    <div className="min-h-screen flex flex-col bg-transparent animate-in fade-in duration-700 font-mono">

      {/* ── SITREP HEADER ── */}
      <div className="shrink-0 border-b border-hc-border bg-hc-navy/40 px-8 py-6 flex items-center justify-between gap-8 backdrop-blur-xl">

        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1 uppercase">Operational Briefing</h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-hc-teal-light tracking-[0.2em] uppercase">Intelligence SITREP</span>
            <div className="h-3 w-px bg-slate-800" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{weekData.dateFrom} — {weekData.dateTo}</span>
          </div>
        </div>
        <button
          onClick={() => allCollapsed ? expandAllSections(SECTION_IDS) : collapseAllSections(SECTION_IDS)}
          className="px-5 py-2.5 border border-hc-border bg-hc-card text-[10px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-text hover:bg-hc-card-hover transition-all"
        >
          {allCollapsed ? 'EXPAND_ALL' : 'COLLAPSE_ALL'}
        </button>

      </div>

      <div className="flex-1 p-8 bg-transparent">
        <div className="max-w-6xl mx-auto space-y-8">


          {/* Interventions */}
          <Section id="interventions" title="Intervention Backlog" collapsed={isSectionCollapsed('interventions')} onToggle={() => toggleSection('interventions')} count={openActions.length}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {openActions.slice(0, 6).map(a => (
                <button key={a.id} onClick={() => setPage('actions')} className="border border-hc-border bg-hc-card p-4 text-left transition-all hover:bg-hc-card-hover group">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[8px] font-black px-2 py-0.5 uppercase tracking-widest ${a.priority === 'critical' || a.priority === 'high' ? 'bg-red-950/40 text-red-500 border border-red-900/60' : 'bg-blue-950/40 text-blue-500 border border-blue-900/60'}`}>{a.priority}</span>
                    <span className="text-[9px] font-bold text-hc-muted tabular-nums">{a.dueDate}</span>
                  </div>
                  <div className="text-xs font-bold text-hc-text mb-2 uppercase line-clamp-1">{a.title}</div>
                  <div className="text-[10px] font-medium text-hc-muted line-clamp-2 leading-relaxed uppercase">TARGET: {a.owner}</div>
                </button>
              ))}

            </div>
            {openActions.length > 6 && (
              <button onClick={() => setPage('actions')} className="mt-3 text-[10px] font-black text-hc-teal-light uppercase tracking-widest hover:underline">
                + {openActions.length - 6} more →
              </button>
            )}
          </Section>

          {/* Client Matrix */}
          <Section id="clients" title="Client Stability Matrix" collapsed={isSectionCollapsed('clients')} onToggle={() => toggleSection('clients')} count={priorityClients.length}>
            <div className="overflow-hidden border border-hc-border bg-hc-card/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-hc-navy/40 border-b border-hc-border text-[9px] font-black text-hc-muted uppercase tracking-widest">
                    <th className="px-6 py-3">IDENTIFIER</th>
                    <th className="px-6 py-3">STATION</th>
                    <th className="px-6 py-3 text-center">ALERTS</th>
                    <th className="px-6 py-3">LATEST_TELEMETRY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hc-border">
                  {priorityClients.map(c => (
                    <tr
                      key={c.name}
                      onClick={() => setPage('client-diary')}
                      className="hover:bg-white/[0.04] cursor-pointer transition-colors border-b border-hc-border/40 last:border-0 text-[11px]"
                    >
                      <td className="px-6 py-4 font-black text-hc-text uppercase tracking-tight">{c.name}</td>
                      <td className="px-6 py-4 font-bold text-hc-muted uppercase tracking-widest text-[9px]">{c.house}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2 tabular-nums">
                          {c.red > 0 && <span className="bg-red-950/40 text-red-500 px-2 py-0.5 text-[10px] font-black border border-red-900/60 transition-all">{c.red}</span>}
                          {c.amber > 0 && <span className="bg-amber-950/40 text-amber-500 px-2 py-0.5 text-[10px] font-black border border-amber-900/60 transition-all">{c.amber}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-hc-muted italic max-w-xs truncate leading-relaxed text-[10px]">"{c.latest}"</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>


          {/* Trends */}
          <Section id="trends" title="Operational Trends" collapsed={isSectionCollapsed('trends')} onToggle={() => toggleSection('trends')} count={trends.length}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trends.map(t => (
                <div key={t.id} className="border border-hc-border bg-hc-card p-5 flex items-start gap-5">
                  <div className="shrink-0 w-12 h-12 border border-hc-border bg-hc-navy/40 flex items-center justify-center text-xl">
                    {t.severity === 'critical' ? '⚠️' : '📈'}
                  </div>
                  <div>
                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${t.severity === 'critical' ? 'text-red-500' : 'text-hc-teal-light'}`}>{t.title}</div>
                    <p className="text-[11px] font-medium text-hc-muted leading-relaxed uppercase">{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>


          {/* Station Matrix */}
          <Section id="houses" title="Station Performance Index" collapsed={isSectionCollapsed('houses')} onToggle={() => toggleSection('houses')} count={Object.keys(weekData.houses).length}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.values(weekData.houses).map(h => (
                <div key={h.name} className="border border-slate-800 bg-slate-900/30 p-5 flex flex-col">
                  <div className="text-sm font-black text-white uppercase tracking-tight mb-4 border-b border-slate-800 pb-3">{h.name}</div>
                  <div className="space-y-3 mt-auto">
                    <Metric label="CAPTURED" val={h.entries.length} />
                    <Metric label="CRITICAL" val={h.flags.red} red />
                    <Metric label="MONITOR" val={h.flags.amber} amber />
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({ title, count, children, collapsed, onToggle }: { id: string; title: string; count?: number; children: React.ReactNode; collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="border border-slate-800 bg-slate-900/10">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-all border-b border-slate-800/60">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-4 bg-hc-teal" />
          <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] font-mono">{title}</h2>
        </div>
        <div className="flex items-center gap-6">
          {count != null && <span className="text-[10px] font-mono text-slate-600 bg-slate-950 px-2 py-0.5 border border-slate-800">{String(count).padStart(3, '0')}</span>}
          <svg className={`w-3.5 h-3.5 text-slate-600 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>
      {!collapsed && <div className="p-6 bg-slate-950/40 animate-in fade-in slide-in-from-top-1 duration-300">{children}</div>}
    </div>
  );
}

function Metric({ label, val, red, amber }: { label: string; val: number; red?: boolean; amber?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
      <span className={`text-[10px] font-black tabular-nums ${red ? 'text-red-500' : amber ? 'text-amber-500' : 'text-slate-400'}`}>{val}</span>
    </div>
  );
}
