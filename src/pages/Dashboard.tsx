import type { WeekSummary, Action, Incident } from '../lib/types';
import type { Page } from '../App';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
  actions: Action[];
  incidents: Incident[];
}

export function Dashboard({ weekData, setPage, actions, incidents }: Props) {
  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-2xl glass border border-hc-teal/20 flex items-center justify-center mb-8 glow-teal animate-float">
          <svg className="w-12 h-12 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3 text-gradient">Dashboard</h2>
        <p className="text-hc-muted text-sm mb-8 text-center max-w-xs leading-relaxed">Import your care data to see the weekly overview, flags, and house summaries.</p>
        <button onClick={() => setPage('upload')} className="btn-gradient px-8 py-3 rounded-xl shadow-lg transition-all">Import Data</button>
      </div>
    );
  }

  const houseList = Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber));
  
  const openActions = actions.filter(a => a.status === 'open' || a.status === 'in_progress');
  const activeIncidents = incidents.filter(i => i.stage !== 'closed' && i.stage !== 'resolved');

  return (
    <div className="p-6 lg:p-10 w-full animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase text-shimmer">Service Hub</h1>
          <p className="text-hc-muted text-xs font-bold uppercase tracking-[0.2em] mt-1">Service-Wide Overview</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setPage('briefing')} className="glass-light border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl hover:text-white hover:border-hc-teal/40 transition-all shadow-xl active:scale-95">Morning Briefing</button>
          <button onClick={() => setPage('upload')} className="btn-gradient px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95">Update Data</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mb-6 lg:mb-8">
        {[
          { label: 'Active Staff', val: '42', sub: 'On shift', color: '#14b8a6' },
          { label: 'Total Entries', val: weekData.totalEntries, sub: 'This week', color: '#3b82f6' },
          { label: 'Critical Overdue', val: actions.filter(a => a.priority === 'critical' && a.status !== 'completed').length, sub: 'Needs attention', color: '#ef4444' },
          { label: 'Open Tasks', val: openActions.length, sub: 'In progress', color: '#f59e0b' },
          { label: 'Active Incidents', val: activeIncidents.length, sub: 'In progress', color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="glass-light border border-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-5 card-glow group relative overflow-hidden active:scale-95 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.03] blur-3xl group-hover:opacity-[0.1] transition-opacity" style={{ background: s.color }} />
            <div className="section-header text-[8px] md:text-[9px] mb-1.5 opacity-60 tracking-[0.15em]">{s.label}</div>
            <div className="text-2xl md:text-3xl font-black text-white tabular-nums tracking-tighter mb-1 group-hover:scale-110 transition-transform duration-500" style={{ textShadow: `0 0 20px ${s.color}40` }}>{s.val}</div>
            <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Houses Grid */}
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center gap-3 mb-4 lg:mb-6 px-1">
          <div className="w-2 h-7 rounded-full bg-hc-teal glow-teal" />
          <h2 className="text-lg md:text-xl font-black text-white tracking-tighter uppercase text-shimmer">House Status Overview</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
          {houseList.map((house, idx) => {
            const hasRed = house.flags.red > 0;
            const hasAmber = house.flags.amber > 0;
            return (
              <div
                key={house.name}
                className={`glass-light border rounded-xl lg:rounded-2xl p-4 lg:p-5 hover:bg-hc-card-hover/40 transition-all duration-500 card-glow group/house animate-in slide-in-from-bottom-4 active:scale-[0.98] shadow-xl
                  ${hasRed ? 'border-flag-red/30 glow-red bg-flag-red/[0.02]' : hasAmber ? 'border-flag-amber/30 glow-amber bg-flag-amber/[0.01]' : 'border-white/5 hover:border-hc-teal/30'}
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-lg font-black text-white tracking-tighter uppercase group-hover/house:text-hc-teal-light transition-colors leading-none mb-1.5">{house.name}</div>
                    {house.coordinator && <div className="text-[9px] text-hc-muted font-bold uppercase tracking-[0.2em] opacity-60">Lead: {house.coordinator}</div>}
                  </div>
                  <div className="flex gap-2">
                    {hasRed && <span className="pill pill-red text-[10px] font-black px-3 shadow-xl animate-pulse-soft">{house.flags.red}</span>}
                    {hasAmber && <span className="pill pill-amber text-[10px] font-black px-3 shadow-xl">{house.flags.amber}</span>}
                  </div>
                </div>

                {/* Mini stats */}
                <div className="grid grid-cols-4 gap-2 mb-4 bg-black/20 p-3 rounded-xl border border-white/5 shadow-inner">
                  {[
                    { n: house.entries.length, l: 'ENTRIES', c: '#d4dfe8' },
                    { n: house.incidents.length, l: 'INCIDENTS', c: '#ef4444' },
                    { n: house.safeguarding.length, l: 'S/G', c: '#f59e0b' },
                    { n: house.medication.length, l: 'MEDS', c: '#14b8a6' },
                  ].map(s => (
                    <div key={s.l} className="text-center group/stat cursor-default">
                      <div className="text-base md:text-lg font-black transition-transform duration-500 group-hover/stat:scale-125 tabular-nums leading-none" style={{ color: s.c }}>{s.n}</div>
                      <div className="text-[8px] text-hc-muted font-black tracking-widest mt-2 opacity-40">{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Severity bar */}
                <div className="h-2 rounded-full bg-hc-dark/80 overflow-hidden flex shadow-inner border border-white/5 mb-4">
                  {house.flags.red > 0 && <div className="h-full bg-flag-red shadow-[0_0_15px_rgba(239,68,68,0.6)] transition-all duration-1000" style={{ width: `${(house.flags.red / Math.max(1, house.entries.length)) * 100}%` }} />}
                  {house.flags.amber > 0 && <div className="h-full bg-flag-amber shadow-[0_0_15px_rgba(245,158,11,0.6)] transition-all duration-1000" style={{ width: `${(house.flags.amber / Math.max(1, house.entries.length)) * 100}%` }} />}
                  <div className="h-full bg-flag-green flex-1 opacity-20" />
                </div>

                {/* Latest entry */}
                {(house.incidents.length > 0 || house.safeguarding.length > 0) && (
                  <div className="mt-2 pt-6 border-t border-white/5">
                    {house.incidents.slice(0, 1).map((e, i) => (
                      <div key={i} className="text-[12px] text-hc-text font-medium line-clamp-2 leading-relaxed italic group-hover/house:text-white transition-colors opacity-80">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-flag-red mr-2 align-middle shadow-[0_0_10px_#ef4444] animate-pulse" />
                        "{e.entry}"
                      </div>
                    ))}
                    {house.incidents.length === 0 && house.safeguarding.slice(0, 1).map((e, i) => (
                      <div key={i} className="text-[12px] text-hc-text font-medium line-clamp-2 leading-relaxed italic group-hover/house:text-white transition-colors opacity-80">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-flag-amber mr-2 align-middle shadow-[0_0_10px_#f59e0b]" />
                        "{e.entry}"
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation footer */}
      <div className="mt-20 pt-10 border-t border-white/5">
        <h3 className="section-header text-[9px] mb-8 ml-2 opacity-40 tracking-[0.4em]">QUICK ACTIONS</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
          {[
            { id: 'incidents', label: 'Monitor Incidents', desc: 'Active incident log', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
            { id: 'actions', label: 'Review Tasks', desc: 'Action tracker', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
            { id: 'staff', label: 'Staff Roster', desc: 'Staff overview', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
            { id: 'reports', label: 'Reports & Audits', desc: 'Advanced analysis', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setPage(btn.id as Page)}
              className="glass-light border border-white/10 rounded-[1.5rem] p-6 text-left hover:border-hc-teal/40 hover:bg-white/[0.03] transition-all duration-500 card-glow group/btn active:scale-95 shadow-xl"
            >
              <div className="w-12 h-12 rounded-xl bg-hc-teal/10 border border-hc-teal/20 flex items-center justify-center mb-6 transition-all duration-700 group-hover/btn:scale-110 group-hover/btn:rotate-3 shadow-2xl">
                <svg className="w-6 h-6 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d={btn.icon} /></svg>
              </div>
              <div className="text-sm font-black text-white mb-1 uppercase tracking-tight group-hover/btn:text-hc-teal-light transition-colors">{btn.label}</div>
              <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60 group-hover/btn:opacity-100 transition-opacity flex items-center justify-between">
                {btn.desc}
                <svg className="w-4 h-4 transition-transform group-hover/btn:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
