import type { WeekSummary, Action, Incident } from '../lib/types';
import type { Page } from '../App';
import { useCollapseStore } from '../lib/collapse-store';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
  actions: Action[];
  incidents: Incident[];
}

export function Dashboard({ weekData, setPage, actions, incidents }: Props) {
  // Hooks must be unconditional — compute safe defaults for the null case
  const houseList = weekData
    ? Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber))
    : [];
  const houseIds = houseList.map(h => h.name);
  const { isCollapsed: isHouseCollapsed, toggle: toggleHouse, collapseAll: collapseAllHouses, expandAll: expandAllHouses, allCollapsed: allHousesCollapsed } = useCollapseStore('dashboard-houses');
  const housesAllCollapsed = allHousesCollapsed(houseIds);
  function toggleAllHouses() {
    if (housesAllCollapsed) expandAllHouses(houseIds);
    else collapseAllHouses(houseIds);
  }
  const openActions = weekData ? actions.filter(a => a.status === 'open' || a.status === 'in_progress') : [];
  const activeIncidents = weekData ? incidents.filter(i => i.stage !== 'closed' && i.stage !== 'resolved') : [];

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 animate-in fade-in duration-700 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-hc-teal/[0.04] blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
          {/* Icon */}
          <div className="w-28 h-28 rounded-3xl glass border border-hc-teal/25 flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(20,184,166,0.12)] animate-float">
            <svg className="w-14 h-14 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>
          </div>

          <div className="text-[10px] font-black tracking-[0.25em] text-hc-teal uppercase mb-3">Service Hub</div>
          <h2 className="text-4xl font-black text-white mb-4 tracking-tighter text-center">No data loaded</h2>
          <p className="text-hc-muted text-base mb-10 text-center max-w-sm leading-relaxed">Sync this week's care records to see your full service overview — house statuses, flags, incidents, and team data.</p>

          <button onClick={() => setPage('upload')} className="btn-gradient px-10 py-4 rounded-2xl shadow-2xl text-sm font-black uppercase tracking-[0.08em] hover:scale-105 active:scale-95 transition-all">
            Sync Records
          </button>

          {/* Feature hint tiles */}
          <div className="grid grid-cols-3 gap-3 mt-12 w-full">
            {[
              { label: 'House Status', desc: 'Live red & amber flags per location', color: '#ef4444' },
              { label: 'Team Overview', desc: 'Active carers, entries, incidents', color: '#14b8a6' },
              { label: 'Action Tracker', desc: 'Open tasks and critical priorities', color: '#f59e0b' },
            ].map(f => (
              <div key={f.label} className="glass-light border border-white/8 rounded-2xl p-4 text-center">
                <div className="w-2 h-2 rounded-full mx-auto mb-2" style={{ background: f.color }} />
                <div className="text-xs font-black text-white mb-1">{f.label}</div>
                <div className="text-[10px] text-hc-muted leading-relaxed opacity-70">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="p-6 lg:p-10 w-full max-w-[2560px] mx-auto animate-in fade-in duration-1000">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
import { ORG_CONFIG } from '../lib/config';

// ...
          <p className="text-[10px] font-black tracking-[0.25em] text-hc-teal uppercase mb-1">{ORG_CONFIG.name}</p>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Service Hub</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPage('briefing')} className="cursor-pointer px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.08em] text-hc-muted border border-white/[0.08] hover:border-white/20 hover:text-white transition-all duration-200 backdrop-blur-xl" style={{background:'rgba(14,16,22,0.7)'}}>Morning Briefing</button>
          <button onClick={() => setPage('staff-monitoring')} className="cursor-pointer px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.08em] text-hc-teal-light border border-hc-teal/20 hover:border-hc-teal/40 hover:bg-hc-teal/5 transition-all duration-200 backdrop-blur-xl" style={{background:'rgba(14,16,22,0.7)'}}>Staff Intelligence</button>
          <button onClick={() => setPage('upload')} className="cursor-pointer btn-gradient px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.08em] shadow-lg hover:scale-105 active:scale-95 transition-all duration-200">Sync Data</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {[
          { label: 'Carers Active', val: weekData.carers.length, sub: 'This period', color: '#14b8a6', bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.2)' },
          { label: 'Total Entries', val: weekData.totalEntries, sub: 'Imported', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' },
          { label: 'Critical Overdue', val: actions.filter(a => a.priority === 'critical' && a.status !== 'completed').length, sub: 'Needs action', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.22)' },
          { label: 'Open Tasks', val: openActions.length, sub: 'In progress', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
          { label: 'Active Incidents', val: activeIncidents.length, sub: 'Being tracked', color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.2)' },
        ].map(s => (
          <div key={s.label} className="group relative rounded-2xl p-5 overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1"
            style={{
              background: `linear-gradient(145deg, ${s.bg}, rgba(10,12,18,0.7))`,
              backdropFilter: 'blur(28px)',
              border: `1px solid ${s.border}`,
              boxShadow: `0 4px 24px ${s.bg}, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}>
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{background: `linear-gradient(90deg, ${s.color}, transparent)`}} />
            {/* Ambient glow */}
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500" style={{background: s.color}} />
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{color:`${s.color}99`}}>{s.label}</div>
            <div className="text-4xl font-black tabular-nums tracking-tighter leading-none mb-2" style={{color: s.color}}>{s.val}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest opacity-60" style={{color: s.color}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Houses Grid */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-5 rounded-full bg-hc-teal" style={{boxShadow:'0 0 12px rgba(20,184,166,0.6)'}} />
          <h2 className="text-sm font-black text-white tracking-widest uppercase">House Status</h2>
          <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-50">{houseList.length} locations</span>
          <button
            type="button"
            onClick={toggleAllHouses}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
            style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#64748b'}}
            title={housesAllCollapsed ? 'Expand all houses' : 'Collapse all houses'}
          >
            <svg className="w-3 h-3 transition-transform duration-200" style={{transform: housesAllCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            {housesAllCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {houseList.map((house, idx) => {
            const hasRed = house.flags.red > 0;
            const hasAmber = house.flags.amber > 0;
            const totalIssues = house.flags.red + house.flags.amber;
            const redPct = (house.flags.red / Math.max(1, house.entries.length)) * 100;
            const amberPct = (house.flags.amber / Math.max(1, house.entries.length)) * 100;
            const accentColor = hasRed ? '#ef4444' : hasAmber ? '#f59e0b' : '#14b8a6';
            const collapsed = isHouseCollapsed(house.name);
            return (
              <div
                key={house.name}
                className="group/house relative rounded-2xl overflow-hidden transition-all duration-300"
                style={{
                  background: hasRed
                    ? '#1a0d0d'
                    : hasAmber
                    ? '#181208'
                    : '#111827',
                  border: `1px solid ${hasRed ? 'rgba(239,68,68,0.2)' : hasAmber ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: hasRed
                    ? '0 8px 40px rgba(239,68,68,0.1), inset 0 1px 0 rgba(255,255,255,0.04)'
                    : hasAmber
                    ? '0 8px 40px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.04)'
                    : '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
                  animationDelay: `${idx * 40}ms`,
                }}
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl" style={{background: `linear-gradient(90deg, ${accentColor}70, transparent)`}} />

                {/* Header — always visible, click to collapse */}
                <div
                  className="flex items-center justify-between gap-2 p-5 cursor-pointer"
                  onClick={() => toggleHouse(house.name)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white tracking-tight group-hover/house:text-hc-teal-light transition-colors duration-200">{house.name}</div>
                    {house.coordinator && !collapsed && <div className="text-[10px] text-hc-muted mt-0.5 font-medium opacity-50 uppercase tracking-wide">{house.coordinator}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {totalIssues > 0 && (
                      <>
                        {hasRed && <span className="pill pill-red text-[10px] font-black animate-pulse-soft">{house.flags.red}R</span>}
                        {hasAmber && <span className="pill pill-amber text-[10px] font-black">{house.flags.amber}A</span>}
                      </>
                    )}
                    <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-300 shrink-0" style={{transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>

                {/* Collapsable body */}
                {!collapsed && (
                  <div className="px-5 pb-5">
                    {/* Mini stats */}
                    <div className="grid grid-cols-4 gap-1 mb-4">
                      {[
                        { n: house.entries.length, l: 'Notes', c: '#94a3b8' },
                        { n: house.incidents.length, l: 'Incid.', c: '#ef4444' },
                        { n: house.safeguarding.length, l: 'Safe.', c: '#f59e0b' },
                        { n: house.medication.length, l: 'Meds', c: '#14b8a6' },
                      ].map(s => (
                        <div key={s.l} className="text-center rounded-xl py-2 px-1"
                          style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)'}}>
                          <div className="text-base font-black tabular-nums leading-none" style={{color: s.c}}>{s.n}</div>
                          <div className="text-[9px] font-bold mt-1 uppercase tracking-wide" style={{color:'#4a5568'}}>{s.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Severity bar */}
                    <div className="h-1.5 rounded-full overflow-hidden flex" style={{background:'rgba(255,255,255,0.06)'}}>
                      {redPct > 0 && <div className="h-full transition-all duration-700" style={{width:`${Math.max(redPct,4)}%`,background:'#ef4444',boxShadow:'0 0 6px rgba(239,68,68,0.6)'}} />}
                      {amberPct > 0 && <div className="h-full transition-all duration-700" style={{width:`${Math.max(amberPct,4)}%`,background:'#f59e0b',boxShadow:'0 0 4px rgba(245,158,11,0.5)'}} />}
                      <div className="h-full flex-1" style={{background:'rgba(20,184,166,0.2)'}} />
                    </div>

                    {(house.incidents[0] || house.safeguarding[0]) && (
                      <div className="mt-3 pt-3" style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                        <p className="text-[10px] text-hc-muted/60 line-clamp-2 leading-relaxed italic">
                          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{background: accentColor}} />
                          {(house.incidents[0] || house.safeguarding[0]).entry.slice(0, 90)}…
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick access */}
      <div className="mt-8 pt-6" style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
        <p className="text-[10px] font-black tracking-[0.25em] text-hc-muted uppercase mb-4 opacity-50">Quick access</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pb-8">
          {[
            { id: 'staff-monitoring', label: 'Staff Intelligence', desc: 'Monitoring & escalations', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
            { id: 'incidents', label: 'Incidents', desc: 'Active incident log', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
            { id: 'actions', label: 'Action Tracker', desc: 'Open tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
            { id: 'compliance', label: 'Compliance', desc: 'DBS, training, audits', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
            { id: 'reports', label: 'Reports', desc: 'Advanced analysis', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setPage(btn.id as Page)}
              className="group/btn cursor-pointer text-left rounded-2xl p-5 transition-all duration-250 hover:-translate-y-0.5 active:scale-95"
              style={{
                background: '#111827',
                backdropFilter: 'blur(48px) saturate(2.2) brightness(1.05)',
                WebkitBackdropFilter: 'blur(48px) saturate(2.2) brightness(1.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 0.5px rgba(255,255,255,0.04)',
              }}
              onMouseEnter={e => (e.currentTarget.style.border = '1px solid rgba(20,184,166,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)')}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover/btn:scale-110"
                style={{background:'rgba(20,184,166,0.08)', border:'1px solid rgba(20,184,166,0.15)'}}>
                <svg className="w-5 h-5 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={btn.icon} /></svg>
              </div>
              <div className="text-sm font-black text-white uppercase tracking-tight mb-1 group-hover/btn:text-hc-teal-light transition-colors duration-200">{btn.label}</div>
              <div className="text-[10px] font-semibold text-hc-muted uppercase tracking-widest opacity-50 flex items-center justify-between">
                {btn.desc}
                <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
