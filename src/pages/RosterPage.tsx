import { useState, useMemo } from 'react';
import type { StaffMember, Shift } from '../lib/types';
import { HAZELCARE_HOUSES, staffStatus, uid } from '../lib/compliance-store';

interface Props {
  staff: StaffMember[];
  shifts: Shift[];
  onUpdateShifts: (shifts: Shift[]) => void;
}

const SHIFT_TYPES = [
  { id: 'day', label: 'Day', time: '07:00–15:00', hours: 8, color: '#14b8a6' },
  { id: 'night', label: 'Night', time: '23:00–07:00', hours: 8, color: '#6366f1' },
  { id: 'long_day', label: 'Long Day', time: '07:00–19:00', hours: 12, color: '#f59e0b' },
] as const;

export function RosterPage({ staff, shifts, onUpdateShifts }: Props) {
  const [selectedShift, setSelectedShift] = useState<{ house: string; date: string; type: Shift['type'] } | null>(null);
  const [filterHouse, setFilterHouse] = useState('all');

  // Generate next 7 days
  const days = useMemo(() => {
    const d = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      d.push({
        full: date.toLocaleDateString('en-GB'),
        short: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
      });
    }
    return d;
  }, []);

  const filteredHouses = filterHouse === 'all' ? HAZELCARE_HOUSES : [filterHouse];

  function assignStaff(staffId: string) {
    if (!selectedShift) return;

    const existingShift = shifts.find(
      s => s.house === selectedShift.house && s.date === selectedShift.date && s.type === selectedShift.type
    );

    const sMember = staff.find(s => s.id === staffId);
    if (!sMember) return;

    // Hard compliance block
    const dbsS = staffStatus(sMember.dbsExpiry || '', 0);
    if (dbsS === 'overdue') {
      alert(`COMPLIANCE BLOCK: ${sMember.name} cannot be assigned due to expired DBS.`);
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

    const updated = existingShift
      ? shifts.map(s => s.id === existingShift.id ? newShift : s)
      : [...shifts, newShift];

    onUpdateShifts(updated);
    setSelectedShift(null);
  }

  function unassignShift(shiftId: string) {
    onUpdateShifts(shifts.filter(s => s.id !== shiftId));
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1700px] mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter text-shimmer">Live Roster</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="pill pill-blue text-[10px] font-black uppercase tracking-widest px-3 shadow-lg">7-Day Operations</span>
            <p className="text-hc-muted text-xs font-bold uppercase tracking-widest opacity-60">Compliance-validated shift management</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-black/20 p-2 rounded-2xl border border-white/5">
          <select 
            value={filterHouse} 
            onChange={e => setFilterHouse(e.target.value)}
            className="bg-hc-dark border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[200px]"
          >
            <option value="all">View All Houses</option>
            {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <div className="h-6 w-px bg-white/5 mx-2" />
          <div className="flex gap-4 px-4">
             {SHIFT_TYPES.map(t => (
               <div key={t.id} className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full" style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
                 <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">{t.label}</span>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Roster Grid */}
      <div className="glass-light border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-black/30 border-b border-white/10">
                <th className="p-6 text-left section-header text-[10px] tracking-[0.2em] w-[200px] sticky left-0 bg-hc-dark/95 backdrop-blur-xl z-20">Location Profile</th>
                {days.map(day => (
                  <th key={day.full} className="p-6 text-center border-l border-white/5 bg-black/10">
                    <div className="text-xs font-black text-white uppercase tracking-widest mb-1">{day.short.split(' ')[0]}</div>
                    <div className="text-[10px] font-bold text-hc-muted uppercase tracking-tighter opacity-50 tabular-nums">{day.full.split('/')[0]}/{day.full.split('/')[1]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredHouses.map((house, hIdx) => (
                <tr key={house} className={`border-b border-white/5 hover:bg-white/[0.01] transition-colors ${hIdx % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                  <td className="p-6 sticky left-0 bg-hc-dark/95 backdrop-blur-xl z-10 border-r border-white/10 group cursor-default">
                    <div className="text-[13px] font-black text-white uppercase tracking-tight group-hover:text-hc-teal-light transition-colors">{house}</div>
                    <div className="text-[8px] font-bold text-hc-muted mt-1 uppercase tracking-widest opacity-40">Active Unit</div>
                  </td>
                  {days.map(day => (
                    <td key={day.full} className="p-2 border-l border-white/5 min-w-[140px]">
                      <div className="flex flex-col gap-1.5">
                        {SHIFT_TYPES.map(type => {
                          const shift = shifts.find(s => s.house === house && s.date === day.full && s.type === type.id);
                          const sMember = staff.find(s => s.id === shift?.staffId);
                          const isSelected = selectedShift?.house === house && selectedShift?.date === day.full && selectedShift?.type === type.id;

                          return (
                            <div 
                              key={type.id}
                              onClick={() => setSelectedShift({ house, date: day.full, type: type.id })}
                              className={`group/slot relative rounded-xl p-2.5 transition-all duration-500 cursor-pointer border overflow-hidden
                                ${shift ? 'glass-light border-white/10 hover:border-white/20' : isSelected ? 'bg-hc-teal/20 border-hc-teal shadow-lg' : 'border-dashed border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                            >
                              <div className="flex items-center justify-between relative z-10">
                                <span className={`text-[8px] font-black uppercase tracking-widest ${shift ? 'text-hc-muted' : isSelected ? 'text-hc-teal-light' : 'text-white/20'}`}>{type.label}</span>
                                {shift && (
                                  <button onClick={(e) => { e.stopPropagation(); unassignShift(shift.id); }} className="opacity-0 group-hover/slot:opacity-100 transition-opacity">
                                    <svg className="w-3 h-3 text-flag-red hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                )}
                              </div>
                              
                              <div className="mt-1 relative z-10">
                                {sMember ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded overflow-hidden bg-hc-teal/10 flex items-center justify-center text-[7px] font-black text-hc-teal-light border border-hc-teal/20">
                                      {sMember.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="truncate text-[11px] font-black text-white group-hover/slot:text-hc-teal-light transition-colors">{sMember.name.split(' ')[1] || sMember.name}</div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-bold text-white/5 uppercase tracking-tighter italic group-hover/slot:text-hc-teal-light/40 transition-colors">{isSelected ? 'Assigning...' : 'Open Slot'}</div>
                                )}
                              </div>

                              {/* Indicator dot */}
                              <div className="absolute top-1 right-1 w-1 h-1 rounded-full opacity-40" style={{ background: type.color }} />
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

      {/* Assignment Modal */}
      {selectedShift && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setSelectedShift(null)}>
          <div className="glass border border-white/10 rounded-[2.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-teal/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />
            
            <div className="p-8 border-b border-white/5 relative z-10 flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tighter">Assign Shift</h3>
                <div className="flex items-center gap-3 mt-2">
                  <span className="pill pill-teal text-[9px] font-black uppercase px-2">{selectedShift.house}</span>
                  <span className="text-hc-muted text-[10px] font-black uppercase tracking-widest">{selectedShift.date} · {selectedShift.type.toUpperCase()}</span>
                </div>
              </div>
              <button onClick={() => setSelectedShift(null)} className="w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center text-hc-muted hover:text-white transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-8 relative z-10 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <div className="section-header text-[9px] mb-4 opacity-60 tracking-[0.2em]">AVAILABLE COMPLIANT STAFF</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {staff.sort((a, b) => a.name.localeCompare(b.name)).map(sMember => {
                  const dbsS = staffStatus(sMember.dbsExpiry || '', 60);
                  const trainS = staffStatus(sMember.trainingExpiry || '', 30);
                  const isBlocked = dbsS === 'overdue';
                  const isWarning = dbsS === 'due_soon' || trainS !== 'ok';

                  return (
                    <button 
                      key={sMember.id}
                      disabled={isBlocked || sMember.status !== 'active'}
                      onClick={() => assignStaff(sMember.id)}
                      className={`flex items-center gap-4 p-4 rounded-[1.5rem] border transition-all text-left group
                        ${isBlocked || sMember.status !== 'active' ? 'opacity-30 cursor-not-allowed border-flag-red/20' : 'glass-light border-white/5 hover:border-hc-teal/40 hover:bg-hc-teal/[0.02] active:scale-95'}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-lg shadow-black/40
                        ${isBlocked ? 'bg-flag-red/20 text-flag-red' : 'bg-hc-teal/20 text-hc-teal-light'}`}>
                        {sMember.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-white group-hover:text-hc-teal-light transition-colors truncate">{sMember.name}</div>
                        <div className="flex gap-2 mt-1">
                          {isBlocked ? (
                            <span className="text-[8px] font-black text-flag-red uppercase tracking-widest animate-pulse">DBS EXPIRED - BLOCKED</span>
                          ) : isWarning ? (
                            <span className="text-[8px] font-black text-flag-amber uppercase tracking-widest">COMPLIANCE ADVISORY</span>
                          ) : (
                            <span className="text-[8px] font-black text-flag-green uppercase tracking-widest opacity-60">Verified & Compliant</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-8 bg-black/20 border-t border-white/5 relative z-10">
              <p className="text-[10px] text-hc-muted italic leading-relaxed text-center opacity-60">
                Staff compliance is checked in real-time against current DBS and Training logs.
                Assignments to non-compliant staff are restricted to maintain CQC safety standards.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
