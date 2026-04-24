import { Activity, ChevronRight, Shield, Printer } from 'lucide-react';
import type { WeekSummary, Action, Incident, StaffMember, Shift } from '../lib/types';
import type { Page } from '../App';
import { ORG_CONFIG } from '../lib/config';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page, ctx?: any) => void;
  actions: Action[];
  incidents: Incident[];
  staff: StaffMember[];
  shifts: Shift[];
  onUpdateShifts: (shifts: Shift[]) => void;
  onQuickAction: (opts: { type: 'action' | 'incident'; content?: string; house?: string; client?: string }) => void;
}

export function Dashboard({ weekData, setPage, actions, incidents }: Pick<Props, 'weekData' | 'setPage' | 'actions' | 'incidents'>) {
  
  const houseList = weekData
    ? Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber))
    : [];

  const openActions = weekData ? actions.filter(a => a.status === 'open' || a.status === 'in_progress') : [];
  const activeIncidents = weekData ? incidents.filter(i => i.stage !== 'closed' && i.stage !== 'resolved') : [];

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-hc-bg p-8 animate-in fade-in duration-1000">
        <div className="w-32 h-32 rounded-3xl hc-clay-raised flex items-center justify-center mb-10">
          <Activity className="w-12 h-12 text-hc-teal opacity-20" />
        </div>
        <h2 className="text-3xl font-black text-hc-text tracking-[0.4em] uppercase mb-6">Signals Offline</h2>
        <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.4em] mb-12 text-center max-w-sm opacity-60">Injest high-integrity log feed to initialize the SITREP diagnostic matrix.</p>
        <button onClick={() => setPage('upload')} className="btn-clay btn-clay-teal h-[70px] px-12">Activate Injest Matrix</button>
      </div>
    );
  }


  return (
    <div className="h-screen bg-hc-bg overflow-y-auto scrollbar-thin p-10 flex flex-col gap-12">
      
      {/* ── HEADER (SITREP CENTER) ── */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-10 pb-12 border-b border-hc-border">
        <div>
          <div className="text-[10px] font-black tracking-[0.4em] text-hc-teal uppercase mb-2">{ORG_CONFIG.name} // Command Intel</div>
          <h1 className="text-4xl font-black text-hc-text tracking-[0.3em] uppercase tabular-nums">Sitrep Center</h1>
        </div>
        
        <div className="flex gap-4 p-2 hc-clay-inset rounded-3xl shrink-0">
          <button onClick={() => setPage('briefing')} className="btn-clay h-[54px] !rounded-2xl text-[9px] px-8 border-none shadow-none hover:bg-hc-clay-light hover:shadow-lg transition-all">Mission Briefing</button>
          <button onClick={() => setPage('staff-monitoring')} className="btn-clay btn-clay-teal h-[54px] !rounded-2xl text-[9px] px-8 border-none transition-all">Staff Monitoring</button>
          <button onClick={() => setPage('upload')} className="btn-clay h-[54px] !rounded-2xl text-[9px] px-8 border-none shadow-none hover:bg-hc-clay-light hover:shadow-lg transition-all">Injest Feed</button>
        </div>
      </div>

      {/* ── 7-DAY PERSISTENCE MATRIX ── */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-[11px] font-black text-hc-text tracking-[0.4em] uppercase">7-Day Persistence Matrix</h2>
           <div className="flex gap-6 items-center">
              <span className="flex items-center gap-2 text-[9px] font-black text-hc-text uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-hc-teal" /> Day</span>
              <span className="flex items-center gap-2 text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-40"><div className="w-2 h-2 rounded-full bg-hc-purple" /> Night</span>
              <span className="flex items-center gap-2 text-[9px] font-black text-hc-amber uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-hc-amber" /> Long Day</span>
           </div>
        </div>

        <div className="grid grid-cols-8 gap-4">
           {/* Deployment Pods (1-7) */}
           <div className="hc-clay-raised p-6 flex flex-col items-center justify-center gap-2">
              <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest leading-none">Deployment</span>
              <span className="text-[11px] font-black text-hc-text uppercase tracking-widest leading-none">Unit</span>
           </div>
           {(() => {
              const days = [];
              const now = new Date();
              for(let i=0; i<7; i++) {
                const d = new Date(now);
                d.setDate(now.getDate() + i);
                days.push(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }).toUpperCase());
              }
              return days.map(d => (
                <div key={d} className="hc-clay-raised p-8 flex items-center justify-center text-[10px] font-black text-hc-text uppercase tracking-[0.2em]">{d}</div>
              ));
           })()}
        </div>
      </div>

      {/* ── OPERATIONAL METRICS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Personnel Active', val: weekData.carers.length, sub: 'Field Strength', color: 'text-hc-teal' },
          { label: 'Intelligence Records', val: weekData.totalEntries, sub: 'Diagnostic Vol.', color: 'text-hc-text' },
          { label: 'Critical Escalations', val: actions.filter(a => a.priority === 'critical' && a.status !== 'completed').length, sub: 'Immediate Action', color: 'text-hc-red' },
          { label: 'Open Command Tasks', val: openActions.length, sub: 'Pipeline', color: 'text-hc-amber' },
          { label: 'Active Incidents', val: activeIncidents.length, sub: 'Force Protection', color: 'text-hc-text' },
        ].map(s => (
          <div key={s.label} className="hc-clay-raised p-8 flex flex-col gap-6 group hover:translate-y-[-4px] transition-all duration-300 relative overflow-hidden">
             <div className="flex items-center justify-between">
                <div className={`text-[9px] font-black uppercase tracking-[0.3em] ${s.label === 'Critical Escalations' ? 'text-hc-red' : 'text-hc-muted'}`}>{s.label}</div>
                <div className={`w-1.5 h-1.5 rounded-full ${s.label === 'Critical Escalations' ? 'bg-hc-red animate-pulse' : 'bg-hc-teal'}`} />
             </div>
             <div className="flex flex-col gap-1">
                <div className={`text-5xl font-black tabular-nums tracking-tighter ${s.color}`}>{s.val}</div>
                <div className="text-[9px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-40">{s.sub}</div>
             </div>
          </div>
        ))}
      </div>

      {/* ── DIAGNOSTIC VECTOR LEDGER ── */}
      <div className="hc-clay-inset p-8 flex items-center gap-6 overflow-hidden">
         <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.4em] shrink-0">Loaded Vector Feed (Diagnostic):</span>
         <div className="flex gap-4 overflow-x-auto scrollbar-none pr-10">
            {Object.entries(weekData.entryTypes || {}).sort((a,b) => b[1]-a[1]).slice(0, 8).map(([type, count]) => (
               <div key={type} className="hc-clay-raised px-4 py-2 flex items-center gap-4 bg-white/20 whitespace-nowrap">
                  <span className="text-[10px] font-black text-hc-text tabular-nums">{count}</span>
                  <span className="text-[9px] font-black text-hc-muted opacity-40">::</span>
                  <span className="text-[9px] font-black text-hc-text uppercase tracking-widest">{type.split(' ')[0]}</span>
               </div>
            ))}
         </div>
      </div>

      {/* ── REGIONAL OPERATIONS MATRIX ── */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-[11px] font-black text-hc-text tracking-[0.4em] uppercase">Regional Operations Matrix</h2>
           <div className="flex items-center gap-6">
              <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-60">2 Active Units</span>
              <button className="btn-clay !px-5 !py-2 !rounded-xl text-[9px]">Expand All</button>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
           {houseList.slice(0, 6).map(h => {
             const hasRed = h.flags.red > 0;
             return (
               <div key={h.name} className="hc-clay-raised p-8 flex flex-col gap-8">
                  <div className="flex items-center justify-between">
                     <h3 className="text-sm font-black text-hc-text uppercase tracking-widest">{h.name.toUpperCase()}</h3>
                     <div className={`w-2 h-2 rounded-full ${hasRed ? 'bg-hc-red animate-pulse' : 'bg-hc-teal'}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="hc-clay-inset p-4 flex flex-col items-center gap-1">
                        <span className="text-[8px] font-black text-hc-muted uppercase opacity-60">Signals</span>
                        <span className="text-2xl font-black text-hc-text tabular-nums">{h.entries.length}</span>
                     </div>
                     <div className={`hc-clay-inset p-4 flex flex-col items-center gap-1 cursor-pointer transition-all hover:bg-hc-clay-dark/20 ${hasRed ? 'bg-hc-red/10' : ''}`}>
                        <span className="text-[8px] font-black text-hc-muted uppercase opacity-60">Audit</span>
                        <Activity className={`w-5 h-5 ${hasRed ? 'text-hc-red' : 'text-hc-teal'}`} />
                     </div>
                  </div>
               </div>
             );
           })}
        </div>
      </div>

      <div className="h-px bg-hc-border opacity-20" />

      {/* ── COMMAND VECTOR SHORTCUTS ── */}
      <div className="flex flex-col gap-8 pb-20">
         <h2 className="text-[11px] font-black text-hc-muted uppercase tracking-[0.4em] px-2">Command Vector Shortcuts</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {[
              { label: 'Force Protection', desc: 'Readiness & Diagnostic', icon: <Activity />, id: 'staff-monitoring' },
              { label: 'Incident Governance', desc: 'Active Escalations', icon: <div className="w-5 h-5 border-2 border-current rounded-full" />, id: 'incidents' },
              { label: 'Command Vectors', desc: 'Deployment Queue', icon: <div className="w-5 h-5 flex items-center justify-center border-2 border-current rounded-md">✓</div>, id: 'actions' },
              { label: 'Regulatory Audit', desc: 'Compliance Readiness', icon: <Shield />, id: 'compliance' },
              { label: 'Audit Archives', desc: 'Advanced Data Export', icon: <Printer />, id: 'reports' }
            ].map(btn => (
               <div key={btn.label} onClick={() => setPage(btn.id as Page)} className="hc-clay-raised p-8 flex flex-col gap-8 group cursor-pointer hover:translate-y-[-6px] transition-all">
                  <div className="w-14 h-14 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal">
                     {btn.icon}
                  </div>
                  <div className="flex flex-col gap-1">
                     <div className="text-[12px] font-black text-hc-text uppercase tracking-wider group-hover:text-hc-teal transition-colors">{btn.label}</div>
                     <div className="flex items-center justify-between text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">
                        {btn.desc}
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>

    </div>
  );
}
