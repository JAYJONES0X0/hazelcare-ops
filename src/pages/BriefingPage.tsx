import { useMemo } from 'react';
import type { WeekSummary, Action, Incident } from '../lib/types';
import type { Page } from '../App';
import { detectTrends } from '../lib/trends';
import { useCollapseStore } from '../lib/collapse-store';

interface Props {
  weekData: WeekSummary | null;
  actions: Action[];
  incidents: Incident[];
  setPage: (p: Page) => void;
}

export function BriefingPage({ weekData, actions, incidents, setPage }: Props) {
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
    isCollapsed: isSectionCollapsed,
    toggle: toggleSection,
    collapseAll: collapseAllSections,
    expandAll: expandAllSections,
    allCollapsed: allSectionsCollapsed,
  } = useCollapseStore('briefing-sections');
  const allCollapsed = allSectionsCollapsed(SECTION_IDS);

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 animate-in fade-in duration-700">
        <div className="text-[10px] font-black tracking-[0.25em] text-hc-teal uppercase mb-3">Morning Briefing</div>
        <h2 className="text-2xl font-black text-white mb-3 tracking-tighter">No data loaded</h2>
        <p className="text-hc-muted text-sm mb-6 text-center max-w-sm">Sync this week's care records to generate your daily briefing.</p>
        <button onClick={() => setPage('upload')} className="btn-gradient px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl">Sync Records</button>
      </div>
    );
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const shift = hour < 14 ? 'Day Shift' : hour < 22 ? 'Late Shift' : 'Night Shift';
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const redFlags = weekData.allFlags?.red ?? [];
  const amberFlags = weekData.allFlags?.amber ?? [];
  const houseList = Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber));

  const overdueActions = actions.filter(a => a.status !== 'completed' && a.priority === 'critical');
  const openActions = actions.filter(a => a.status === 'open' || a.status === 'in_progress');
  const activeIncidents = incidents.filter(i => i.stage !== 'closed' && i.stage !== 'resolved');

  const totalEntries = Math.max(1, weekData.totalEntries);
  const redPct = (redFlags.length / totalEntries) * 100;
  const amberPct = (amberFlags.length / totalEntries) * 100;
  const severityScore = Math.max(0, Math.round(100 - (redPct * 0.65) - (amberPct * 0.2) - (overdueActions.length * 4)));
  const isBreach = redPct >= 80;
  const scoreColor = severityScore >= 80 ? '#22c55e' : severityScore >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = severityScore >= 80 ? 'STABLE' : severityScore >= 50 ? 'CAUTION' : 'CRITICAL';

  const RING = 88; // px

  return (
    <div className="p-4 lg:p-6 xl:px-12 2xl:px-20 w-full animate-in fade-in duration-700">

      {/* ── Header ── */}
      <div className="rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          background: '#111827',
          border: `1px solid ${scoreColor}30`,
          boxShadow: `0 4px 24px ${scoreColor}10, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">{dateStr}</span>
            <span className="pill pill-teal text-[10px] uppercase tracking-wider font-black">{shift} Update</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tighter leading-tight mb-2">{greeting}, Service Team</h1>
          <p className="text-hc-muted text-xs leading-relaxed">
            <span className="text-white font-bold">{houseList.length} houses</span> · <span className="text-white font-bold">{weekData.totalEntries.toLocaleString()}</span> care entries this week · Service status{' '}
            <span className="font-black" style={{color: scoreColor}}>{scoreLabel}</span>
          </p>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { n: redFlags.length, label: 'Red Flags', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
              { n: amberFlags.length, label: 'Amber Flags', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' },
              { n: openActions.length, label: 'Tasks', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
              { n: activeIncidents.length, label: 'Incidents', color: '#c084fc', bg: 'rgba(192,132,252,0.1)', border: 'rgba(192,132,252,0.2)' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-default"
                style={{background: s.bg, border: `1px solid ${s.border}`}}>
                <span className="text-sm font-black tabular-nums" style={{color: s.color}}>{s.n}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{color: `${s.color}99`}}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ring gauge + collapse all */}
        <div className="shrink-0 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => allCollapsed ? expandAllSections(SECTION_IDS) : collapseAllSections(SECTION_IDS)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all self-end"
            style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#64748b'}}
          >
            <svg className="w-3 h-3 transition-transform duration-200" style={{transform: allCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            {allCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <div className="flex flex-col items-center gap-1">
          <div className="relative" style={{width: RING, height: RING}}>
            <svg width={RING} height={RING} viewBox="0 0 36 36" className="-rotate-90 block">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none"
                stroke={scoreColor}
                strokeWidth="3"
                strokeDasharray={`${isBreach ? 100 : severityScore} 100`}
                strokeLinecap="round"
                style={{transition:'stroke-dasharray 1.5s ease-out', filter:`drop-shadow(0 0 6px ${scoreColor}80)`}}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black tabular-nums leading-none" style={{color: scoreColor}}>{severityScore}</span>
              <span className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{color: `${scoreColor}80`}}>{scoreLabel}</span>
            </div>
          </div>
          <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-40">Service Health</span>
          </div>
        </div>
      </div>

      {/* ── Two column body ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">

        {/* LEFT — interventions + clients */}
        <div className="space-y-4">

          {/* Priority Interventions */}
          {(redFlags.length > 0 || overdueActions.length > 0) && (
            <div className="rounded-2xl overflow-hidden"
              style={{background:'#111827',border:'1px solid rgba(239,68,68,0.2)',boxShadow:'0 4px 20px rgba(239,68,68,0.05)'}}>
              <button type="button" onClick={() => toggleSection('interventions')} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer" style={{borderBottom: isSectionCollapsed('interventions') ? 'none' : '1px solid rgba(255,255,255,0.05)'}}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full bg-flag-red animate-pulse" style={{boxShadow:'0 0 8px rgba(239,68,68,0.6)'}} />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Priority Interventions</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="pill pill-red text-[10px] font-black">{redFlags.length + overdueActions.length} urgent</span>
                  <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isSectionCollapsed('interventions') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </button>
              {!isSectionCollapsed('interventions') && <div className="divide-y divide-white/[0.04]">
                {redFlags.slice(0, 8).map((flag, i) => (
                  <div key={`rf${i}`} className="px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    onClick={() => setPage('reports')}>
                    <div className="w-1.5 h-1.5 rounded-full bg-flag-red mt-1.5 shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-black text-white uppercase tracking-wide">{flag.house}</span>
                        {flag.client && <span className="text-[10px] text-hc-teal-light font-semibold">{flag.client}</span>}
                      </div>
                      <p className="text-[11px] text-hc-muted leading-relaxed line-clamp-2">"{flag.entry.slice(0, 120)}"</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {flag.flags.map((f, fi) => (
                          <span key={fi} className="text-[9px] font-black text-flag-red uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)'}}>{f}</span>
                        ))}
                      </div>
                    </div>
                    <svg className="w-3.5 h-3.5 text-hc-muted/30 group-hover:text-flag-red shrink-0 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </div>
                ))}
                {redFlags.length > 8 && (
                  <button onClick={() => setPage('reports')} className="w-full py-2.5 text-[10px] font-black text-flag-red/60 hover:text-flag-red uppercase tracking-widest transition-colors">
                    + {redFlags.length - 8} more red flag entries →
                  </button>
                )}
              </div>}
            </div>
          )}

          {/* Client Focus */}
          {priorityClients.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
              style={{background:'#111827',border:'1px solid rgba(255,255,255,0.07)'}}>
              <button type="button" onClick={() => toggleSection('clients')} className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer" style={{borderBottom: isSectionCollapsed('clients') ? 'none' : '1px solid rgba(255,255,255,0.05)'}}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full bg-hc-teal" style={{boxShadow:'0 0 8px rgba(20,184,166,0.5)'}} />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Client Support Focus</span>
                  <span className="text-[10px] text-hc-muted opacity-50">{priorityClients.length}</span>
                </div>
                <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isSectionCollapsed('clients') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {!isSectionCollapsed('clients') && <div className="divide-y divide-white/[0.04]">
                {priorityClients.map((c) => (
                  <div key={c.name} className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => setPage('client-diary')}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black text-hc-teal-light"
                      style={{background:'rgba(20,184,166,0.1)',border:'1px solid rgba(20,184,166,0.2)'}}>
                      {c.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{c.name}</div>
                      <div className="text-[10px] text-hc-muted opacity-60 truncate">{c.house}</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {c.red > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded text-flag-red" style={{background:'rgba(239,68,68,0.12)'}}>{c.red}R</span>}
                      {c.amber > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded text-flag-amber" style={{background:'rgba(245,158,11,0.12)'}}>{c.amber}A</span>}
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          )}

          {/* Trends */}
          {trends.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
              style={{background:'#111827',border:'1px solid rgba(255,255,255,0.07)'}}>
              <button type="button" onClick={() => toggleSection('trends')} className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer" style={{borderBottom: isSectionCollapsed('trends') ? 'none' : '1px solid rgba(255,255,255,0.05)'}}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full bg-hc-purple" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Care Patterns</span>
                  <span className="text-[10px] text-hc-muted opacity-50">{trends.length}</span>
                </div>
                <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isSectionCollapsed('trends') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {!isSectionCollapsed('trends') && <div className="divide-y divide-white/[0.04]">
                {trends.slice(0,5).map(trend => (
                  <div key={trend.id} className="px-4 py-2.5 flex items-start gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${trend.severity === 'critical' ? 'bg-flag-red' : trend.severity === 'warning' ? 'bg-flag-amber' : 'bg-hc-blue'}`} />
                    <div>
                      <div className="text-xs font-bold text-white">{trend.title}
                        {trend.metric && <span className="ml-2 text-[10px] font-black text-hc-muted opacity-60">{trend.metric}</span>}
                      </div>
                      <p className="text-[11px] text-hc-muted leading-relaxed opacity-70 mt-0.5">{trend.detail}</p>
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          )}
        </div>

        {/* RIGHT — house grid + quick stats */}
        <div className="space-y-4">

          {/* House grid */}
          <div className="rounded-2xl overflow-hidden"
            style={{background:'#111827',border:'1px solid rgba(255,255,255,0.07)'}}>
            <button type="button" onClick={() => toggleSection('houses')} className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer" style={{borderBottom: isSectionCollapsed('houses') ? 'none' : '1px solid rgba(255,255,255,0.05)'}}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-hc-blue" style={{boxShadow:'0 0 8px rgba(59,130,246,0.5)'}} />
                <span className="text-xs font-black text-white uppercase tracking-widest">House Overview</span>
                <span className="text-[10px] text-hc-muted opacity-50">{houseList.length}</span>
              </div>
              <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isSectionCollapsed('houses') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {!isSectionCollapsed('houses') && <div className="p-3 grid grid-cols-2 gap-2">
              {houseList.map(house => {
                const hasRed = house.flags.red > 0;
                const hasAmber = !hasRed && house.flags.amber > 0;
                const statusColor = hasRed ? '#f87171' : hasAmber ? '#fbbf24' : '#22c55e';
                return (
                  <button key={house.name} onClick={() => setPage('reports')}
                    className="text-left rounded-xl p-2.5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                    style={{
                      background: hasRed ? 'rgba(239,68,68,0.06)' : hasAmber ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${hasRed ? 'rgba(239,68,68,0.25)' : hasAmber ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background: statusColor}} />
                      <span className="text-[11px] font-bold text-white truncate">{house.name.replace(' House','')}</span>
                    </div>
                    <div className="text-[10px] text-hc-muted opacity-50">{house.entries.length} entries</div>
                    {(house.flags.red > 0 || house.flags.amber > 0) && (
                      <div className="flex gap-1 mt-1.5">
                        {house.flags.red > 0 && <span className="text-[9px] font-black text-flag-red">{house.flags.red}R</span>}
                        {house.flags.amber > 0 && <span className="text-[9px] font-black text-flag-amber">{house.flags.amber}A</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPage('actions')} className="rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
              style={{background:'rgba(96,165,250,0.08)',border:'1px solid rgba(96,165,250,0.2)'}}>
              <div className="text-xl font-black text-hc-blue tabular-nums">{openActions.length}</div>
              <div className="text-[10px] font-bold text-hc-muted/60 uppercase tracking-wider mt-0.5">Open Tasks</div>
            </button>
            <button onClick={() => setPage('incidents')} className="rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
              style={{background:'rgba(192,132,252,0.08)',border:'1px solid rgba(192,132,252,0.2)'}}>
              <div className="text-xl font-black text-hc-purple tabular-nums">{activeIncidents.length}</div>
              <div className="text-[10px] font-bold text-hc-muted/60 uppercase tracking-wider mt-0.5">Incidents</div>
            </button>
          </div>

          {/* Quick nav */}
          <div className="flex flex-col gap-1.5">
            {[
              { id: 'dashboard', label: 'Service Hub', primary: true },
              { id: 'staff-monitoring', label: 'Staff Intelligence', primary: false },
              { id: 'notes', label: 'Note Assistant', primary: false },
              { id: 'client-docs', label: 'People & Plans', primary: false },
            ].map(nav => (
              <button key={nav.id} onClick={() => setPage(nav.id as Page)}
                className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${nav.primary ? 'btn-gradient text-white' : 'text-hc-muted hover:text-white'}`}
                style={!nav.primary ? {background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'} : {}}>
                {nav.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
