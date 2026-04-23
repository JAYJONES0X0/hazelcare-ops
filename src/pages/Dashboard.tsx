import { useState, useEffect } from 'react';
import { Activity, X, ChevronRight } from 'lucide-react';
import type { WeekSummary, Action, Incident, StaffMember, Shift, CareEntry, HouseSummary } from '../lib/types';
import type { Page } from '../App';
import { ORG_CONFIG } from '../lib/config';
import { useCollapseStore } from '../lib/collapse-store';
import { staffStatus } from '../lib/compliance-store';

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

const SHIFT_TYPES = [
  { id: 'day', label: 'Day', time: '07:00–15:00', hours: 8, color: 'var(--hc-teal)' },
  { id: 'night', label: 'Night', time: '23:00–07:00', hours: 8, color: 'var(--hc-purple)' },
  { id: 'long_day', label: 'Long Day', time: '07:00–19:00', hours: 12, color: 'var(--hc-amber)' },
] as const;

function uid() { return Math.random().toString(36).substring(2, 9); }

function LiveStatusWidget({ shifts, weekData }: { shifts: Shift[]; weekData: WeekSummary | null }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  if (!weekData || !shifts || shifts.length === 0) return null;

  const currentDay = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const currentTimeVal = now.getHours() * 60 + now.getMinutes();
  const houseIds = Object.keys(weekData.houses).sort();
  
  return (
    <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-700 shrink-0">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-[11px] font-black text-hc-text tracking-[0.3em] uppercase tabular-nums">Mission Readiness &middot; Active In-Fill</h2>
        <div className="h-px flex-1 bg-hc-border opacity-20" />
        <span className="text-[9px] font-black text-hc-teal-light uppercase tracking-widest animate-pulse flex items-center gap-2">
           Live Signal
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
        {houseIds.map(hId => {
          const activeShifts = shifts.filter(s => {
            if (s.house !== hId || s.date !== currentDay || !s.startTime || !s.endTime) return false;
            const [sh, sm] = s.startTime.split(':').map(Number);
            const [eh, em] = s.endTime.split(':').map(Number);
            const sVal = sh * 60 + sm;
            let eVal = eh * 60 + em;
            if (eVal < sVal) eVal += 1440;
            return currentTimeVal >= sVal && currentTimeVal <= eVal;
          });

          const hasGap = activeShifts.length === 0;
          return (
            <div key={hId} className={`border rounded-lg p-3 transition-all duration-300 relative group/ls min-h-[90px] flex flex-col justify-between
              ${hasGap ? 'bg-flag-red/5 border-flag-red shadow-[0_4px_12px_rgba(239,68,68,0.15)]' : 'border-hc-border bg-hc-card hover:bg-hc-card-hover'}`}>
              <div className="flex items-center justify-between mb-2 relative z-10">
                <span className={`text-[10px] font-black uppercase tracking-widest ${hasGap ? 'text-flag-red' : 'text-hc-muted group-hover/ls:text-hc-text'}`}>{hId.split(' ')[0]}</span>
                {hasGap ? (
                  <span className="text-[8px] font-black text-flag-red bg-flag-red/10 px-1.5 py-0.5 rounded border border-flag-red/30">GAP DETECTED</span>
                ) : (
                  <span className="text-[8px] font-black text-hc-teal-light bg-hc-teal/5 px-1.5 py-0.5 rounded border border-hc-teal/20">READY: {activeShifts.length}</span>
                )}
              </div>
              
              <div className="space-y-1 relative z-10">
                {activeShifts.length > 0 ? activeShifts.map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-hc-teal/10 text-hc-teal flex items-center justify-center text-[7px] font-black border border-hc-teal/20">
                      {(s.staffId || '?').split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="text-[10px] font-black text-hc-text leading-none truncate uppercase tabular-nums">{(s.staffId || '').split(' ')[1] || s.staffId}</div>
                  </div>
                )) : (
                  <div className="text-[8px] font-black text-flag-amber uppercase tracking-widest opacity-60">Searching For Asset...</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HouseDetailDrawer({ house, onClose, onQuickAction }: { house: HouseSummary; onClose: () => void; onQuickAction: (o: any) => void }) {
  const flagged = house.entries.filter(e => e.severity === 'red' || e.severity === 'amber');
  
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-hc-navy border-l border-hc-border z-[60] shadow-2xl animate-in slide-in-from-right-full duration-500 overflow-y-auto scrollbar-thin">
      <div className="p-8">
        <div className="flex items-center justify-between mb-10 pb-6 border-b border-hc-border">
          <div>
            <h2 className="text-xl font-black text-hc-text tracking-[0.2em] uppercase">{house.name} Tactical Audit</h2>
            <p className="text-hc-muted text-[9px] font-black uppercase tracking-[0.3em] mt-1">Operational Intelligence Vector Feed</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded border border-hc-border flex items-center justify-center text-hc-muted hover:text-hc-text transition-all hover:bg-hc-card-hover group">
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="text-[10px] font-black tracking-[0.3em] text-hc-muted mb-6 uppercase">Critical Diagnostics ({flagged.length})</div>
          
          {flagged.length === 0 ? (
            <div className="text-center py-24 bg-hc-card-hover/10 border-dashed border-hc-border rounded-lg border">
              <div className="text-[11px] font-black uppercase tracking-[0.4em] text-hc-muted opacity-40">STABLE: No Field Gaps Detected</div>
            </div>
          ) : (
            flagged.map((entry: CareEntry, idx: number) => (
              <div key={entry.id} className="bg-hc-card border border-hc-border rounded-lg p-6 relative overflow-hidden group animate-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                <div className={`absolute top-0 left-0 w-1 h-full ${entry.severity === 'red' ? 'bg-flag-red' : 'bg-flag-amber'}`} />
                
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-hc-text uppercase tracking-widest tabular-nums">{entry.date}</span>
                    <span className="opacity-20 text-hc-border">|</span>
                    <span className="text-[10px] font-black text-hc-teal uppercase tracking-widest">{entry.carer}</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onQuickAction({ type: 'action', content: entry.entry, house: house.name, client: entry.client })}
                      className="px-4 py-2 bg-hc-card-hover border border-hc-border text-hc-text text-[9px] font-black uppercase tracking-widest rounded hover:bg-hc-text hover:text-hc-navy transition-all"
                    >
                      Log Readiness Action
                    </button>
                    <button 
                      onClick={() => onQuickAction({ type: 'incident', content: entry.entry, house: house.name, client: entry.client })}
                      className="px-4 py-2 bg-flag-red/10 border border-flag-red text-flag-red text-[9px] font-black uppercase tracking-widest rounded hover:bg-flag-red hover:text-white transition-all"
                    >
                      Record Incident
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-hc-text font-mono leading-relaxed mb-4 bg-hc-navy/40 p-5 rounded border border-hc-border/30 italic">
                  "{entry.entry}"
                </div>

                <div className="flex flex-wrap gap-2">
                  {entry.flags.map(f => (
                    <span key={f} className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] bg-hc-navy border border-hc-border px-2 py-1 rounded">{f}</span>
                  ))}
                  <span className="text-[8px] font-black text-hc-muted tracking-widest ml-auto uppercase opacity-50 font-mono">Asset: {entry.client}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CoverageGrid({ staff, shifts, onUpdateShifts }: { staff: StaffMember[]; shifts: Shift[]; onUpdateShifts: (s: Shift[]) => void }) {
  const [selectedShift, setSelectedShift] = useState<{ house: string; date: string; type: Shift['type'] } | null>(null);
  const houseIds = Array.from(new Set(shifts.map(s => s.house))).sort();
  
  const days: { full: string; short: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      full: d.toLocaleDateString('en-GB'),
      short: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
    });
  }

  function assignStaff(staffId: string) {
    if (!selectedShift) return;
    const existingShift = shifts.find(s => s.house === selectedShift.house && s.date === selectedShift.date && s.type === selectedShift.type);
    const sMember = staff.find(s => s.id === staffId);
    if (!sMember) return;
    if (staffStatus(sMember.dbsExpiry || '', 0) === 'overdue') {
      alert(`COMPLIANCE BLOCK: ${sMember.name} has expired DBS.`);
      return;
    }
    const newShift: Shift = {
      id: existingShift?.id || uid(),
      staffId,
      house: selectedShift.house,
      date: selectedShift.date,
      type: selectedShift.type,
      hours: SHIFT_TYPES.find(t => t.id === selectedShift.type)?.hours || 8,
      status: 'confirmed',
    };
    onUpdateShifts(existingShift ? shifts.map(s => s.id === existingShift.id ? newShift : s) : [...shifts, newShift]);
    setSelectedShift(null);
  }

  return (
    <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 shrink-0">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-black text-hc-text tracking-[0.3em] uppercase">7-Day Persistence Matrix</h2>
        </div>
        <div className="flex gap-6">
           {SHIFT_TYPES.map(t => (
             <div key={t.id} className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
               <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">{t.label}</span>
             </div>
           ))}
        </div>
      </div>

      <div className="border border-hc-border bg-hc-card rounded-lg overflow-hidden shadow-2xl">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-hc-card-hover/20 border-b border-hc-border">
                <th className="p-4 text-left text-[9px] font-black text-hc-muted uppercase tracking-[0.3em] w-[140px] sticky left-0 bg-hc-card z-20">Deployment Unit</th>
                {days.map(day => (
                  <th key={day.full} className="p-4 text-center border-l border-hc-border/30 text-[9px] font-black text-hc-text uppercase tracking-widest whitespace-nowrap">
                    {day.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {houseIds.map((house) => (
                <tr key={house} className="border-b border-hc-border/30 hover:bg-hc-card-hover/10 transition-colors">
                  <td className="p-4 sticky left-0 bg-hc-card z-10 border-r border-hc-border text-[10px] font-black text-hc-text uppercase truncate">{house.split(' ')[0]}</td>
                  {days.map(day => (
                    <td key={day.full} className="p-1.5 border-l border-hc-border/30 min-w-[120px]">
                      <div className="flex flex-col gap-1">
                        {SHIFT_TYPES.map(type => {
                          const shift = shifts.find(s => s.house === house && s.date === day.full && s.type === type.id);
                          const sMember = staff.find(s => s.id === shift?.staffId);
                          const isRed = sMember && staffStatus(sMember.dbsExpiry || '', 0) === 'overdue';
                          
                          return (
                            <div key={type.id} onClick={() => setSelectedShift({ house, date: day.full, type: type.id })}
                              className={`group/slot relative rounded px-2 py-1.5 border cursor-pointer transition-all flex items-center justify-between
                                ${isRed ? 'bg-flag-red/20 border-flag-red' : shift ? 'bg-hc-card-hover/40 border-hc-border/50 hover:border-hc-teal' : 'border-dashed border-hc-border opacity-30 hover:opacity-100 hover:bg-hc-card-hover'}`}>
                              <div className="flex flex-col min-w-0">
                                <div className="text-[9px] font-black text-hc-text truncate uppercase leading-none mb-0.5">
                                  {sMember ? (sMember.name.split(' ')[1] || sMember.name) : <span className="opacity-40 italic font-mono">---</span>}
                                </div>
                                <div className="text-[7px] font-black uppercase tracking-tighter opacity-40">{type.label}</div>
                              </div>
                              {shift && (
                                <button onClick={(e) => { e.stopPropagation(); onUpdateShifts(shifts.filter(sx => sx.id !== shift.id)); }} className="opacity-0 group-hover/slot:opacity-100 text-flag-red transition-opacity">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedShift && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setSelectedShift(null)}>
          <div className="glass border border-white/10 rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-500 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/5 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-white tracking-tighter">Assign Shift</h3>
                <div className="text-[10px] font-bold text-hc-muted uppercase mt-1 tracking-widest">{selectedShift.house} &middot; {selectedShift.date}</div>
              </div>
              <button onClick={() => setSelectedShift(null)} className="text-hc-muted hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 max-h-[50vh] overflow-y-auto scrollbar-thin grid grid-cols-1 md:grid-cols-2 gap-2">
              {staff.sort((a,b) => a.name.localeCompare(b.name)).map(sMember => {
                const isBlocked = staffStatus(sMember.dbsExpiry || '', 0) === 'overdue';
                return (
                  <button key={sMember.id} disabled={isBlocked || sMember.status !== 'active'} onClick={() => assignStaff(sMember.id)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group ${isBlocked ? 'opacity-30 cursor-not-allowed grayscale' : 'glass-light border-white/5 hover:border-hc-teal/40 hover:bg-hc-teal/[0.02]'}`}>
                    <div className="w-8 h-8 rounded-lg bg-hc-teal/20 text-hc-teal-light flex items-center justify-center text-[10px] font-black">{sMember.name.split(' ').map(n=>n[0]).join('')}</div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate">{sMember.name}</div>
                      <div className={`text-[7px] font-black uppercase tracking-widest ${isBlocked ? 'text-flag-red' : 'text-flag-green/70'}`}>{isBlocked ? 'DBS Expired' : 'Compliant'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Dashboard({ weekData, setPage, actions, incidents, staff, shifts, onUpdateShifts, onQuickAction }: Props) {
  const [drillHouse, setDrillHouse] = useState<string | null>(null);
  
  const houseList = weekData
    ? Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber))
    : [];
  const houseIds = houseList.map(h => h.name);
  const { isCollapsed: isHouseCollapsed, toggle: toggleHouse, collapseAll: collapseAllHouses, expandAll: expandAllHouses, allCollapsed: allHousesCollapsed } = useCollapseStore('dashboard-houses');
  const housesAllCollapsed = allHousesCollapsed(houseIds);

  const openActions = weekData ? actions.filter(a => a.status === 'open' || a.status === 'in_progress') : [];
  const activeIncidents = weekData ? incidents.filter(i => i.stage !== 'closed' && i.stage !== 'resolved') : [];
  const complianceGaps = shifts.filter((s: Shift) => {
    const sMember = staff.find((sm: StaffMember) => sm.id === s.staffId);
    if (!sMember) return false;
    return staffStatus(sMember.dbsExpiry || '', 0) === 'overdue';
  });

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8 animate-in fade-in duration-700 bg-hc-card-hover/5">
        <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
          <div className="w-24 h-24 rounded-lg bg-hc-card border border-hc-border flex items-center justify-center mb-8 shadow-2xl">
            <Activity className="w-10 h-10 text-hc-muted opacity-20" />
          </div>
          <h2 className="text-2xl font-black text-hc-text mb-4 tracking-tighter text-center uppercase tracking-widest">SITREP: No Data</h2>
          <p className="text-hc-muted text-xs mb-10 text-center max-w-sm leading-relaxed uppercase tracking-wider font-bold">Injest care records to initialize the Operational Command matrix.</p>
          <button onClick={() => setPage('upload')} className="btn-gradient px-10 py-4 rounded-lg text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all">Injest Log Feed</button>
        </div>
      </div>
    );
  }

  const toggleAllHouses = () => {
    if (housesAllCollapsed) expandAllHouses(houseIds);
    else collapseAllHouses(houseIds);
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-transparent overflow-hidden flex-1 flex flex-col">

      <div className="p-4 lg:px-6 xl:px-8 flex-1 overflow-y-auto scrollbar-thin">
        {/* Header (Command Center Style) */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6 pb-4 border-b border-hc-border">

          <div>
            <div className="text-[10px] font-black tracking-[0.3em] text-hc-teal uppercase mb-1">{ORG_CONFIG.name} // Command Intel</div>
            <h1 className="text-[22px] font-black text-hc-text tracking-[0.2em] uppercase">SITREP Center</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPage('briefing')} className="bg-hc-card border border-hc-border px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-hc-text hover:bg-hc-card-hover hover:text-hc-teal transition-all">Mission Briefing</button>
            <button onClick={() => setPage('staff-monitoring')} className="bg-hc-card border border-hc-border px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-hc-teal hover:bg-hc-card-hover transition-all">Staff Monitoring</button>
            <button onClick={() => setPage('upload')} className="btn-gradient px-7 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">Injest Feed</button>
          </div>
        </div>

      {/* Compliance Gap Alert */}
      {complianceGaps.length > 0 && (
        <div className="mb-8 p-6 rounded-[2rem] bg-flag-red/10 border border-flag-red/30 flex items-center justify-between shadow-[0_0_50px_rgba(239,68,68,0.15)] animate-in slide-in-from-top-4 duration-1000 relative overflow-hidden group">
          <div className="absolute inset-0 bg-hc-dark/40 backdrop-blur-2xl -z-10" />
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-flag-red/5 blur-[80px] -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-flag-red/20 flex items-center justify-center text-2xl shadow-xl shadow-red-950/20 border border-flag-red/40 animate-pulse-soft">🚨</div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-3">
                Critical Compliance Gaps Detected
                <span className="pill pill-red text-[10px] font-black uppercase px-3 shadow-lg">{complianceGaps.length} Shifts</span>
              </h3>
              <p className="text-xs text-flag-red/80 font-bold uppercase tracking-widest mt-1">Assignments detected with expired DBS credentials</p>
              <p className="text-[11px] text-hc-muted leading-relaxed mt-2 max-w-xl">Hazel Care expects all staff to have valid DBS clearance before starting a shift. Non-compliant assignments must be corrected immediately to maintain CQC safety standards.</p>
            </div>
          </div>
          <button onClick={() => setPage('staff-monitoring')} className="relative z-10 px-8 py-3 bg-flag-red/20 border border-flag-red/40 text-flag-red text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-flag-red/30 transition-all shadow-xl active:scale-95 group/btn">
            Fix Gaps Now
            <ChevronRight className="w-4 h-4 ml-2 inline-block transition-transform group-hover/btn:translate-x-1" />
          </button>
        </div>
      )}

      {/* Live Status Widget */}
      <LiveStatusWidget shifts={shifts} weekData={weekData} />

      {/* 7-Day Operational Grid */}
      <CoverageGrid staff={staff} shifts={shifts} onUpdateShifts={onUpdateShifts} />

      {/* Operational Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10 shrink-0">
        {[
          { label: 'Personnel Active', val: weekData.carers.length, sub: 'Field Strength', color: 'var(--hc-teal)' },
          { label: 'Intelligence Records', val: weekData.totalEntries, sub: 'Diagnostic Vol.', color: 'var(--hc-text)' },
          { label: 'Critical Escalations', val: actions.filter(a => a.priority === 'critical' && a.status !== 'completed').length, sub: 'Immediate Action', color: 'var(--hc-red)' },
          { label: 'Open Command Tasks', val: openActions.length, sub: 'Pipeline', color: 'var(--hc-amber)' },
          { label: 'Active Incidents', val: activeIncidents.length, sub: 'Force Protection', color: 'var(--hc-purple)' },
        ].map(s => (
          <div key={s.label} className="group relative rounded-lg p-5 bg-hc-card border border-hc-border flex flex-col justify-between h-[120px] transition-all hover:bg-hc-card-hover">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-1" style={{color: s.color}}>{s.label}</div>
            <div>
              <div className="text-3xl font-black tabular-nums tracking-tighter leading-none mb-1 text-hc-text">{s.val}</div>
              <div className="text-[9px] font-black uppercase tracking-widest opacity-60 text-hc-muted">{s.sub}</div>
            </div>
            <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full" style={{backgroundColor: s.color}} />
          </div>
        ))}
      </div>

      {/* Dataset Composition Feed */}
      {weekData.entryTypes && Object.keys(weekData.entryTypes).length > 0 && (() => {
        const ICONS: Record<string, string> = {
          'Handover note generated via Mobile App': '🔄',
          'Handover': '🔄',
          'Task note generated via Mobile App': '✅',
          'Senior support worker role': '👤',
          'Medication collected': '💊',
          'Medication ordered': '💊',
          'Medication returned': '💊',
          'Medication audit': '💊',
          'Expenses/Mileage': '💷',
          'Safeguarding': '🛡️',
        };
        const sorted = Object.entries(weekData.entryTypes).sort((a, b) => b[1] - a[1]).slice(0, 9);
        return (
          <div className="flex items-center gap-2 flex-wrap mb-10 p-4 rounded-lg bg-hc-card border border-hc-border shrink-0">
            <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.3em] shrink-0 mr-2">Loaded Vector Feed (Diagnostic):</span>
            {sorted.map(([type, count]) => (
              <span key={type} className="inline-flex items-center gap-2 text-[9px] font-black px-3 py-1.5 rounded-md bg-hc-card-hover border border-hc-border text-hc-text/80 hover:text-hc-teal transition-all">
                <span className="opacity-60">{ICONS[type] || '📋'}</span> {count} <span className="opacity-40 font-mono">::</span> {type.replace(' generated via Mobile App', '').replace('note', '').trim().toUpperCase()}
              </span>
            ))}
          </div>
        );
      })()}

      {/* Regional Operations Matrix */}
      <div className="mb-10 shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-[11px] font-black text-hc-text tracking-[0.3em] uppercase">Regional Operations Matrix</h2>
          <div className="h-px flex-1 bg-hc-border opacity-20" />
          <span className="text-[10px] font-bold text-hc-muted uppercase tracking-[0.2em]">{houseList.length} Active Units</span>
          <button
            type="button"
            onClick={toggleAllHouses}
            className="flex items-center gap-2 px-4 py-2 rounded border border-hc-border text-[9px] font-black uppercase tracking-widest text-hc-muted hover:bg-hc-card-hover hover:text-hc-text transition-all"
          >
            {housesAllCollapsed ? 'Expand All' : 'Collapse All'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {houseList.map((house) => {
            const hasRed = house.flags.red > 0;
            const hasAmber = house.flags.amber > 0;
            const isCollapsed = isHouseCollapsed(house.name);
            
            return (
              <div key={house.name} className={`group relative rounded-lg border bg-hc-card transition-all duration-300 flex flex-col h-fit
                ${hasRed ? 'border-flag-red shadow-[0_4px_20px_rgba(239,68,68,0.1)]' : hasAmber ? 'border-flag-amber' : 'border-hc-border hover:bg-hc-card-hover'}`}>
                
                <div onClick={() => toggleHouse(house.name)} className="p-4 cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-xs font-black uppercase tracking-widest ${hasRed ? 'text-flag-red' : 'text-hc-text'}`}>{house.name.split(' ')[0]}</h3>
                    <div className="flex gap-1.5">
                      {house.flags.red > 0 && <span className="w-2 h-2 rounded-full bg-flag-red animate-pulse" />}
                      {house.flags.amber > 0 && <span className="w-2 h-2 rounded-full bg-flag-amber" />}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-hc-navy/40 rounded p-2 border border-hc-border/30">
                      <div className="text-[8px] font-black text-hc-muted uppercase tracking-tighter mb-1">Signals</div>
                      <div className="text-xl font-black text-hc-text tabular-nums">{house.entries.length}</div>
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); setDrillHouse(house.name); }} className={`rounded p-2 border transition-all flex flex-col justify-center items-center cursor-pointer
                      ${hasRed ? 'bg-flag-red/10 border-flag-red/30 hover:bg-flag-red/20' : 'bg-hc-navy/40 border-hc-border/30 hover:border-hc-teal'}`}>
                      <div className="text-[8px] font-black text-hc-muted uppercase tracking-tighter">Audit</div>
                      <Activity className={`w-4 h-4 mt-1 ${hasRed ? 'text-flag-red' : 'text-hc-teal'}`} />
                    </div>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="pt-3 border-t border-hc-border/50 space-y-2">
                      {(house.incidents[0] || house.safeguarding[0]) && (
                        <div className="bg-flag-red/5 border border-flag-red/10 rounded p-2.5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-flag-red" />
                            <span className="text-[8px] font-black text-flag-red uppercase tracking-widest">Active Escalation</span>
                          </div>
                          <div className="text-[9px] text-hc-text/70 leading-relaxed font-bold font-mono line-clamp-2 italic">
                            "{(house.incidents[0] || house.safeguarding[0]).entry.slice(0, 70)}..."
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Command Vectors */}
      <div className="mt-8 pt-8 border-t border-hc-border shrink-0">
        <p className="text-[10px] font-black tracking-[0.3em] text-hc-muted uppercase mb-5">Command Vector Shortcuts</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pb-8">
          {[
            { id: 'staff-monitoring', label: 'Force Protection', desc: 'Readiness & Diagnostic', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
            { id: 'incidents', label: 'Incident Governance', desc: 'Active Escalations', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
            { id: 'actions', label: 'Command Vectors', desc: 'Deployment Queue', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
            { id: 'compliance', label: 'Regulatory Audit', desc: 'Compliance Readiness', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
            { id: 'reports', label: 'Audit Archives', desc: 'Advanced Data Export', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14' },
          ].map(btn => (
            <button key={btn.id} onClick={() => setPage(btn.id as Page)} className="group/btn cursor-pointer text-left rounded-lg p-5 transition-all bg-hc-card border border-hc-border hover:bg-hc-card-hover hover:border-hc-teal">
              <div className="w-9 h-9 rounded flex items-center justify-center mb-4 transition-transform duration-200 group-hover/btn:scale-105 bg-hc-navy/40 border border-hc-border">
                <svg className="w-4 h-4 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={btn.icon} /></svg>
              </div>
              <div className="text-[11px] font-black text-hc-text uppercase tracking-wider mb-1 group-hover/btn:text-hc-teal transition-colors">{btn.label}</div>
              <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-60 flex items-center justify-between">
                {btn.desc}
                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {drillHouse && weekData.houses[drillHouse] && (
        <HouseDetailDrawer 
          house={weekData.houses[drillHouse]} 
          onClose={() => setDrillHouse(null)} 
          onQuickAction={onQuickAction}
        />
      )}
      </div>
    </div>
  );
}
