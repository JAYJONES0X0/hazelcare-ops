import { useMemo } from 'react';
import type { WeekSummary, Action, Incident } from '../lib/types';
import type { Page } from '../App';
import { detectTrends } from '../lib/trends';

interface Props {
  weekData: WeekSummary | null;
  actions: Action[];
  incidents: Incident[];
  setPage: (p: Page) => void;
}

export function BriefingPage({ weekData, actions, incidents, setPage }: Props) {
  const allEntries = useMemo(() => weekData ? Object.values(weekData.houses).flatMap(h => h.entries) : [], [weekData]);
  const trends = useMemo(() => detectTrends(allEntries), [allEntries]);

  // Priority clients
  const priorityClients = useMemo(() => {
    if (!weekData) return [];
    const clientMap: Record<string, { name: string; house: string; red: number; amber: number; latestEntry: string }> = {};
    for (const house of Object.values(weekData.houses)) {
      for (const entry of house.entries) {
        const key = entry.client || 'Unknown';
        if (!clientMap[key]) clientMap[key] = { name: key, house: house.name, red: 0, amber: 0, latestEntry: '' };
        if (entry.severity === 'red') clientMap[key].red++;
        if (entry.severity === 'amber') clientMap[key].amber++;
        if (entry.severity === 'red' || entry.severity === 'amber') clientMap[key].latestEntry = entry.entry.slice(0, 120);
      }
    }
    return Object.values(clientMap)
      .filter(c => c.red > 0 || c.amber > 0)
      .sort((a, b) => (b.red * 10 + b.amber) - (a.red * 10 + a.amber))
      .slice(0, 8);
  }, [weekData]);

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-2xl glass border border-hc-teal/20 flex items-center justify-center mb-8 glow-teal animate-float">
          <svg className="w-12 h-12 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3 text-gradient">Daily Briefing</h2>
        <p className="text-hc-muted text-sm mb-8 text-center max-w-xs leading-relaxed">Sync this week's records to generate your daily briefing report.</p>
        <button onClick={() => setPage('upload')} className="btn-gradient px-8 py-3 rounded-xl shadow-lg transition-all">Update Data</button>
      </div>
    );
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const shift = hour < 14 ? 'Day Shift' : hour < 22 ? 'Late Shift' : 'Night Shift';
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const redFlags = weekData.allFlags.red;
  const amberFlags = weekData.allFlags.amber;
  const houseList = Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber));

  const overdueActions = actions.filter(a => a.status !== 'completed' && a.priority === 'critical');
  const openActions = actions.filter(a => a.status === 'open' || a.status === 'in_progress');
  const activeIncidents = incidents.filter(i => i.stage !== 'closed' && i.stage !== 'resolved');

  // Service score
  const severityScore = Math.max(0, 100 - (redFlags.length * 8) - (amberFlags.length * 3) - (overdueActions.length * 5));
  const isBreach = severityScore === 0;
  const scoreColor = severityScore >= 80 ? '#22c55e' : severityScore >= 50 ? '#f59e0b' : '#ef4444';
  const scorePill = severityScore >= 80 ? 'pill-green' : severityScore >= 50 ? 'pill-amber' : 'pill-red animate-pulse-soft';
  const scoreLabel = severityScore >= 80 ? 'STABLE' : severityScore >= 50 ? 'CAUTION' : 'CRITICAL';
  const scoreBg = severityScore >= 80 ? 'bg-emerald-500/5' : severityScore >= 50 ? 'bg-amber-500/5' : 'bg-red-500/5';
  const scoreBorder = severityScore >= 80 ? 'border-emerald-500/20' : severityScore >= 50 ? 'border-amber-500/20' : 'border-red-500/20';

  return (
    <div className="p-6 lg:p-10 w-full animate-in fade-in duration-1000 scrollbar-thin">
      {/* ── Hero Header ────────────────────────────────────────────────────── */}
      <div className={`glass border-2 ${scoreBorder} ${scoreBg} rounded-[1.5rem] lg:rounded-[2.5rem] p-4 md:p-8 lg:p-10 mb-6 lg:mb-10 relative overflow-hidden shadow-2xl transition-all duration-700`}>
        <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full opacity-[0.05] blur-[140px] -translate-y-1/2 translate-x-1/2" style={{ background: scoreColor }} />
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6 lg:gap-10 relative z-10">
          <div className="flex-1 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
              <span className="text-[10px] font-black tracking-[0.3em] text-hc-muted uppercase">{dateStr}</span>
              <span className="pill pill-teal text-[9px] uppercase tracking-widest font-black shadow-lg">{shift} Updates</span>
            </div>
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-white mb-3 tracking-tighter leading-none text-shimmer">
              {greeting}, Service Team
            </h1>
            <p className="text-hc-muted text-sm md:text-lg lg:text-xl font-medium mb-6 lg:mb-8 opacity-80 max-w-4xl leading-relaxed">
              Overview of <span className="text-white font-black">{houseList.length} houses</span> with <span className="text-white font-black">{weekData.totalEntries}</span> care entries this week. 
              Service status is <span style={{ color: scoreColor }} className={`font-black underline decoration-2 underline-offset-8 ${isBreach ? 'animate-pulse' : ''}`}>{scoreLabel}</span>.
            </p>

            {/* Quick stat pills */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-4">
              {[
                { label: 'Red Flags', val: redFlags.length, borderClass: 'border-flag-red/20', dotClass: 'bg-flag-red animate-pulse shadow-[0_0_15px_#ef4444]' },
                { label: 'Amber Flags', val: amberFlags.length, borderClass: 'border-flag-amber/20', dotClass: 'bg-flag-amber' },
                { label: 'Tasks', val: openActions.length, borderClass: 'border-hc-blue/20', dotClass: 'bg-hc-blue' },
                { label: 'Incidents', val: activeIncidents.length, borderClass: 'border-hc-purple/20', dotClass: 'bg-hc-purple' },
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-2 md:gap-4 px-4 md:px-6 py-2.5 md:py-3 rounded-xl lg:rounded-2xl glass-light border ${s.borderClass} hover:scale-105 hover:bg-white/[0.02] transition-all cursor-default shadow-xl`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${s.dotClass}`} />
                  <span className="text-lg md:text-xl font-black text-white tabular-nums tracking-tighter">{s.val}</span>
                  <span className="text-[9px] md:text-[11px] font-black text-hc-muted uppercase tracking-[0.15em]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Service Score Ring */}
          <div className="shrink-0 group cursor-default relative">
            <div className="relative w-36 h-36 md:w-48 md:h-48 lg:w-56 lg:h-56 transition-all duration-1000 group-hover:scale-105 group-hover:rotate-1">
              <div className="absolute inset-0 rounded-full border-[16px] border-white/[0.01] shadow-inner" />
              <svg className="w-full h-full -rotate-90 overflow-visible" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="2.5" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" 
                  stroke={scoreColor} 
                  strokeWidth={isBreach ? "3.5" : "2.5"} 
                  strokeDasharray={`${isBreach ? 100 : severityScore}, 100`} 
                  strokeLinecap="round" 
                  className={isBreach ? "animate-pulse" : ""}
                  style={{ transition: 'stroke-dasharray 2s ease-out', filter: `drop-shadow(0 0 20px ${scoreColor}${isBreach ? 'AA' : '60'})` }} 
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4">
                <div className="flex flex-col items-center -mt-2">
                  <span className={`text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter transition-transform duration-700 group-hover:scale-110 tabular-nums leading-none ${isBreach ? 'text-flag-red animate-pulse' : ''}`} style={{ color: !isBreach ? scoreColor : undefined, textShadow: `0 0 40px ${scoreColor}40` }}>
                    {severityScore}
                  </span>
                  <div className="mt-4">
                    <span className={`pill ${scorePill} text-[10px] font-black px-5 py-1.5 shadow-2xl transition-all duration-500 group-hover:scale-110 uppercase tracking-[0.2em]`}>
                      {scoreLabel}
                    </span>
                  </div>
                  <span className="text-[9px] font-black text-hc-muted tracking-[0.4em] mt-6 opacity-40 uppercase">Service Health</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-8">
        {/* Left Column — High Priority (8/12) */}
        <div className="xl:col-span-8 space-y-4 lg:space-y-8">
          
          {/* Priority Interventions */}
          {(redFlags.length > 0 || overdueActions.length > 0) && (
            <section className="animate-in slide-in-from-left-4 duration-700">
              <div className="flex items-center justify-between mb-4 lg:mb-6 px-2 lg:px-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full bg-flag-red glow-red animate-pulse" />
                  <h2 className="text-lg md:text-xl font-black text-white tracking-tighter uppercase text-shimmer">Priority Interventions</h2>
                </div>
                <span className="pill pill-red text-[11px] font-black shadow-xl px-6 py-1.5">{redFlags.length + overdueActions.length} URGENT ITEMS</span>
              </div>
              <div className="space-y-4">
                {redFlags.slice(0, 8).map((flag, i) => (
                  <div key={`rf${i}`} className="glass-light border border-flag-red/20 rounded-2xl lg:rounded-[2rem] p-4 md:p-6 flex items-start gap-3 md:gap-5 hover:bg-flag-red/[0.04] hover:border-flag-red/50 transition-all duration-500 card-glow group/alert cursor-pointer active:scale-[0.99] shadow-2xl" onClick={() => setPage('reports')}>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.25rem] bg-flag-red/10 border-2 border-flag-red/30 flex items-center justify-center shrink-0 group-hover/alert:scale-110 group-hover/alert:rotate-3 transition-all duration-700 shadow-xl">
                      <svg className="w-5 h-5 md:w-6 md:h-6 text-flag-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4 mb-3 transition-transform duration-500 group-hover/alert:translate-x-1">
                        <span className="text-sm font-black text-white uppercase tracking-widest">{flag.house}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        {flag.client && <span className="text-xs font-black text-hc-teal-light uppercase tracking-[0.2em] opacity-80">{flag.client}</span>}
                      </div>
                      <p className="text-[16px] text-hc-text leading-relaxed font-medium transition-colors group-hover/alert:text-white line-clamp-2 italic italic-quote px-1">"{flag.entry}"</p>
                      <div className="flex flex-wrap gap-3 mt-6">
                        {flag.flags.map((f, fi) => (
                          <span key={fi} className="pill pill-red text-[9px] font-black uppercase tracking-widest py-1 px-3 shadow-lg">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl glass border border-white/5 flex items-center justify-center text-hc-muted opacity-0 group-hover/alert:opacity-100 group-hover/alert:translate-x-2 transition-all duration-500 shadow-xl">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                ))}
                {redFlags.length > 8 && (
                  <button onClick={() => setPage('reports')} className="w-full text-center py-6 glass border border-white/5 rounded-3xl text-[11px] font-black text-hc-muted hover:text-flag-red hover:bg-white/[0.03] hover:border-flag-red/30 transition-all uppercase tracking-[0.5em] shadow-2xl active:scale-[0.99] group">
                    View all {redFlags.length} Red Flag alerts <span className="inline-block group-hover:translate-x-4 transition-transform ml-4">→</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Client Focus */}
          <section className="animate-in slide-in-from-left-4 duration-700 delay-150">
            <div className="flex items-center gap-3 mb-4 lg:mb-6 px-2 lg:px-4">
              <div className="w-2 h-8 rounded-full bg-hc-teal glow-teal" />
              <h2 className="text-lg md:text-xl font-black text-white tracking-tighter uppercase text-shimmer">Client Support Focus</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 lg:gap-4">
              {priorityClients.map((c) => (
                <div key={c.name} className="glass-light border border-white/10 rounded-2xl lg:rounded-[2rem] p-4 md:p-5 flex items-center gap-3 md:gap-5 hover:bg-white/[0.04] hover:border-hc-teal/50 transition-all duration-500 cursor-pointer card-glow group/client active:scale-95 shadow-xl" onClick={() => setPage('client-diary')}>
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-[1.25rem] bg-gradient-to-br from-hc-teal/20 to-hc-blue/10 border-2 border-white/10 flex items-center justify-center shrink-0 shadow-xl group-hover/client:scale-110 transition-all duration-700">
                    <span className="text-base md:text-lg font-black text-hc-teal-light">{c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm md:text-base font-black text-white group-hover/client:text-hc-teal-light transition-colors truncate tracking-tighter uppercase leading-none mb-1">{c.name}</div>
                    <div className="text-[11px] font-bold text-hc-muted uppercase tracking-widest opacity-60 truncate group-hover/client:opacity-100 transition-opacity">{c.house} · Latest Status</div>
                  </div>
                  <div className="flex flex-col gap-3 shrink-0 pr-4">
                    {c.red > 0 && <span className="pill pill-red text-[10px] font-black tabular-nums shadow-2xl shadow-red-950/40 px-4 py-1 animate-pulse-soft">{c.red}</span>}
                    {c.amber > 0 && <span className="pill pill-amber text-[10px] font-black tabular-nums shadow-2xl shadow-amber-950/40 px-4 py-1">{c.amber}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column — House Matrix (4/12) */}
        <div className="xl:col-span-4 space-y-4 lg:space-y-8">
          
          {/* House Matrix */}
          <section className="animate-in slide-in-from-right-4 duration-700">
            <div className="flex items-center gap-3 mb-4 lg:mb-6 px-2 lg:px-4">
              <div className="w-2 h-8 rounded-full bg-hc-blue glow-blue" />
              <h2 className="text-sm font-black text-white tracking-[0.3em] uppercase opacity-80">House Overview</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              {houseList.map(house => {
                const hasRed = house.flags.red > 0;
                const hasAmber = !hasRed && house.flags.amber > 0;
                const clear = !hasRed && !hasAmber;
                return (
                  <div
                    key={house.name}
                    onClick={() => setPage('reports')}
                    className={`relative overflow-hidden glass border-2 transition-all duration-500 rounded-xl lg:rounded-[1.5rem] p-4 lg:p-6 text-center cursor-pointer card-glow group/node active:scale-95 shadow-xl
                      ${hasRed ? 'border-flag-red/50 bg-flag-red/[0.06] glow-red shadow-flag-red/10' : hasAmber ? 'border-flag-amber/40 bg-flag-amber/[0.04] glow-amber shadow-flag-amber/10' : 'border-white/5 hover:border-flag-green/50 hover:bg-white/[0.03]'}`}
                  >
                    <div className="relative z-10">
                      <div className={`w-3 h-3 rounded-full mx-auto mb-3 lg:mb-4 shadow-2xl transition-all duration-700 group-hover/node:scale-150 ${hasRed ? 'bg-flag-red animate-pulse' : hasAmber ? 'bg-flag-amber' : 'bg-flag-green shadow-flag-green/40'}`} />
                      <div className="text-sm font-black text-white mb-2 uppercase tracking-tighter truncate group-hover/node:text-hc-teal-light transition-colors">{house.name.replace(' House', '')}</div>
                      <div className="text-[10px] font-black text-hc-muted mb-3 lg:mb-4 opacity-40 tabular-nums group-hover/node:opacity-100 transition-opacity tracking-widest">{house.entries.length} ENTRIES</div>
                      <div className="flex justify-center items-center gap-3">
                        {house.flags.red > 0 && <span className="pill pill-red text-[10px] font-black px-3 shadow-2xl">{house.flags.red}</span>}
                        {house.flags.amber > 0 && <span className="pill pill-amber text-[10px] font-black px-3 shadow-2xl">{house.flags.amber}</span>}
                        {clear && <span className="text-[10px] font-black text-flag-green tracking-widest opacity-60 group-hover/node:opacity-100 transition-opacity uppercase animate-shimmer">Stable</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Trends */}
          {trends.length > 0 && (
            <section className="animate-in slide-in-from-right-4 duration-700 delay-150">
              <div className="flex items-center gap-3 mb-4 lg:mb-6 px-2 lg:px-4">
                <div className="w-2 h-8 rounded-full bg-hc-purple glow-purple" />
                <h2 className="text-sm font-black text-white tracking-[0.3em] uppercase opacity-80">Care Patterns</h2>
              </div>
              <div className="space-y-4">
                {trends.map(trend => {
                  const isCritical = trend.severity === 'critical';
                  const isWarning = trend.severity === 'warning';
                  const pillClass = isCritical ? 'pill-red' : isWarning ? 'pill-amber' : 'pill-blue';
                  const borderClass = isCritical ? 'border-flag-red/40' : isWarning ? 'border-flag-amber/40' : 'border-hc-blue/40';
                  
                  return (
                    <div key={trend.id} className={`glass-light border-2 ${borderClass} rounded-[2rem] p-6 transition-all duration-500 hover:bg-white/[0.04] group/trend cursor-default shadow-2xl`}>
                      <div className="flex items-center justify-between mb-4 transition-transform duration-500 group-hover/trend:translate-x-1">
                        <span className="text-[13px] font-black text-white uppercase tracking-tight group-hover/trend:text-hc-teal-light transition-colors">{trend.title}</span>
                        {trend.metric && <span className={`pill ${pillClass} text-[10px] font-black py-1 px-3 shadow-2xl`}>{trend.metric}</span>}
                      </div>
                      <p className="text-[12px] font-medium text-hc-muted leading-relaxed opacity-70 group-hover/trend:opacity-100 transition-opacity italic px-1">"{trend.detail}"</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <button onClick={() => setPage('actions')} className="glass border border-white/10 rounded-xl lg:rounded-[1.5rem] p-4 lg:p-6 text-left hover:border-hc-blue/50 hover:bg-white/[0.03] transition-all duration-500 card-glow group/btn-q active:scale-95 shadow-xl">
              <div className="text-3xl lg:text-4xl font-black text-hc-blue group-hover/btn-q:scale-110 transition-all origin-left tabular-nums mb-1">{openActions.length}</div>
              <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60 group-hover/btn-q:opacity-100 group-hover/btn-q:text-hc-blue transition-all">Open Tasks</div>
            </button>
            <button onClick={() => setPage('incidents')} className="glass border border-white/10 rounded-xl lg:rounded-[1.5rem] p-4 lg:p-6 text-left hover:border-hc-purple/50 hover:bg-white/[0.03] transition-all duration-500 card-glow group/btn-q active:scale-95 shadow-xl">
              <div className="text-3xl lg:text-4xl font-black text-hc-purple group-hover/btn-q:scale-110 transition-all origin-left tabular-nums mb-1">{activeIncidents.length}</div>
              <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60 group-hover/btn-q:opacity-100 group-hover/btn-q:text-hc-purple transition-all">Active Incidents</div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick Nav Footer ───────────────────────────────────────────────── */}
      <div className="mt-8 lg:mt-12 pt-6 lg:pt-8 border-t border-white/5 flex flex-wrap justify-center gap-3 lg:gap-4 animate-in slide-in-from-bottom-4 duration-1000 delay-500 pb-8">
        {[
          { id: 'dashboard', label: 'Service Hub', color: 'btn-gradient' },
          { id: 'templates', label: 'All Templates', color: 'glass-light' },
          { id: 'notes', label: 'Notes Assistant', color: 'glass-light' },
          { id: 'client-docs', label: 'People & Plans', color: 'glass-light' },
        ].map(nav => (
          <button key={nav.id} onClick={() => setPage(nav.id as Page)}
            className={`px-6 md:px-8 py-3 ${nav.color === 'btn-gradient' ? 'btn-gradient text-white shadow-[0_0_20px_rgba(20,184,166,0.2)]' : 'glass border border-white/10 text-hc-muted hover:text-white hover:border-hc-teal/50 hover:bg-white/5'} text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all duration-500 hover:scale-105 active:scale-95 shadow-xl`}>
            {nav.label}
          </button>
        ))}
      </div>
    </div>
  );
}
