import { Activity, ChevronRight, Shield, Printer, Zap, AlertTriangle } from 'lucide-react';
import type { WeekSummary, Action, Incident } from '../lib/types';
import type { Page } from '../App';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page, ctx?: any) => void;
  actions: Action[];
  incidents: Incident[];
}

export function Dashboard({ weekData, setPage, actions, incidents }: Props) {
  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-[2.5rem] hc-clay-inset flex items-center justify-center mb-8 animate-float">
          <Zap className="w-12 h-12 text-hc-teal" />
        </div>
        <h2 className="text-2xl font-black text-hc-text mb-3 uppercase tracking-tight">Intelligence Feed Offline</h2>
        <p className="text-hc-muted text-[11px] font-bold uppercase tracking-widest mb-10 text-center max-w-xs leading-relaxed">Injest a clinical data stream to initialize the Sitrep Center.</p>       
        <button onClick={() => setPage('upload')} className="btn-tactical">Initialize Ingest Vector</button>
      </div>
    );
  }

  const houseStats = Object.entries(weekData.houses).map(([name, data]) => {
    const red = data.entries.filter(e => e.severity === 'red').length;
    return { name, entries: data.entries, red };
  });

  const totalEntries = weekData.totalEntries || 0;
  const activeStaff = new Set(Object.values(weekData.houses).flatMap(h => h.entries.map(e => e.carer))).size;
  const pendingActions = actions.filter(a => a.status !== 'completed').length;
  const activeIncidents = incidents.filter(i => i.stage !== 'closed').length;

  return (
    <div className="p-6 lg:p-12 max-w-[1800px] mx-auto animate-in fade-in duration-1000 space-y-16">

      {/* ── SITREP HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-hc-border pb-12">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <span className="pill pill-teal text-[10px]">HAZEL CARE · COMMAND INTEL</span>
            <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
            <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">LIVE SITREP</span>
          </div>
          <h1 className="text-5xl font-black text-hc-text tracking-tighter uppercase leading-none">Sitrep Center</h1>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setPage('briefing')} className="px-6 py-3 hc-clay-raised text-[11px] font-black uppercase text-hc-text hover:text-hc-teal transition-all rounded-xl">Mission Briefing</button>
           <button onClick={() => setPage('staff-monitoring')} className="px-6 py-3 bg-hc-teal text-hc-bone text-[11px] font-black uppercase tracking-widest rounded-xl shadow-xl hover:scale-105 transition-all">Staff Monitoring</button>
        </div>
      </div>

      {/* ── PERSISTENCE MATRIX (STATS) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Personnel Active', val: activeStaff, sub: 'Field Strength', color: 'text-hc-text' },
          { label: 'Intelligence Records', val: totalEntries.toLocaleString(), sub: 'Diagnostic Vol.', color: 'text-hc-text' },
          { label: 'Critical Escalations', val: weekData.allFlags?.red.length || 0, sub: 'Immediate Action', color: 'text-flag-red' },
          { label: 'Open Command Tasks', val: pendingActions, sub: 'Pipeline', color: 'text-flag-amber' },
          { label: 'Active Incidents', val: activeIncidents, sub: 'Force Protection', color: 'text-flag-red' }
        ].map(s => (
          <div key={s.label} className="hc-clay-raised p-8 flex flex-col gap-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
            <div className={`absolute top-2 right-4 w-1.5 h-1.5 rounded-full bg-hc-text opacity-20`} />
            <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest">{s.label}</div>
            <div className={`text-4xl font-black tabular-nums tracking-tighter ${s.color}`}>{s.val}</div>
            <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-60">{s.sub}</div>
          </div>
        ))}
      </div>
      {/* ── REGIONAL OPERATIONS MATRIX (HOUSE CARDS) ── */}
      <div className="space-y-8">
         <div className="flex items-center justify-between px-2">
            <h2 className="text-[12px] font-black text-hc-muted uppercase tracking-[0.4em]">Regional Operations Matrix</h2>
            <button onClick={() => setPage('client-docs')} className="text-[11px] font-black text-hc-teal hover:underline uppercase tracking-widest">Expand All Residences »</button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {houseStats.map(h => (
               <div key={h.name} onClick={() => setPage('client-diary', { house: h.name })} className="hc-clay-raised p-6 rounded-[2.25rem] flex flex-col gap-6 group cursor-pointer hover:shadow-2xl transition-all relative overflow-hidden border border-hc-border/5">
                  {h.red > 0 && <div className="absolute top-0 right-0 w-24 h-24 bg-flag-red/5 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2" />}
                  <div className="flex items-center justify-between relative z-10">
                     <h3 className="text-sm font-black text-hc-text uppercase tracking-tight group-hover:text-hc-teal transition-colors">{h.name}</h3>
                     <div className={`w-2 h-2 rounded-full ${h.red > 0 ? 'bg-flag-red animate-pulse shadow-[0_0_8px_#d94e4e]' : 'bg-flag-green'}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 relative z-10">
                     <div className="hc-clay-inset p-4 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-black text-hc-muted uppercase opacity-60">Signals</span>
                        <span className="text-2xl font-black text-hc-text tabular-nums">{h.entries.length}</span>
                     </div>
                     <div className={`hc-clay-inset p-4 flex flex-col items-center gap-1 transition-all hover:bg-hc-clay-dark/10 ${h.red > 0 ? 'bg-flag-red/5' : ''}`}>
                        <span className="text-[9px] font-black text-hc-muted uppercase opacity-60">Audit</span>
                        <Activity className={`w-5 h-5 ${h.red > 0 ? 'text-flag-red' : 'text-hc-teal'}`} />
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {/* ── COMMAND VECTOR SHORTCUTS ── */}
      <div className="flex flex-col gap-8 pb-20">
         <h2 className="text-[12px] font-black text-hc-muted uppercase tracking-[0.4em] px-2">Command Vector Shortcuts</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {[
              { label: 'Force Protection', desc: 'Readiness & Diagnostic', icon: <Activity />, id: 'staff-monitoring' },
              { label: 'Incident Governance', desc: 'Active Escalations', icon: <AlertTriangle />, id: 'incidents' },
              { label: 'Command Vectors', desc: 'Deployment Queue', icon: <Zap />, id: 'actions' },
              { label: 'Regulatory Audit', desc: 'Compliance Readiness', icon: <Shield />, id: 'compliance' },
              { label: 'Audit Archives', desc: 'Advanced Data Export', icon: <Printer />, id: 'reports' }
            ].map(btn => (
               <div key={btn.label} onClick={() => setPage(btn.id as Page)} className="hc-clay-raised p-8 rounded-[2rem] flex flex-col gap-10 group cursor-pointer hover:translate-y-[-6px] transition-all border border-hc-border/5">
                  <div className="w-16 h-16 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal transition-transform group-hover:scale-110">
                     {btn.icon}
                  </div>
                  <div className="flex flex-col gap-2">
                     <div className="text-sm font-black text-hc-text uppercase tracking-wider group-hover:text-hc-teal transition-colors">{btn.label}</div>
                     <div className="flex items-center justify-between text-[11px] font-black text-hc-muted uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
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
