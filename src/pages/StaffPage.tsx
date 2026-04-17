import { useState } from 'react';
import type { StaffMember } from '../lib/types';
import { uid, HAZELCARE_HOUSES, ROLES, staffStatus, daysUntil } from '../lib/compliance-store';

interface Props {
  staff: StaffMember[];
  onUpdate: (staff: StaffMember[]) => void;
}

function emptyStaff(): StaffMember {
  return { 
    id: uid(), 
    name: '', 
    role: 'Support Worker', 
    house: HAZELCARE_HOUSES[0], 
    dbsExpiry: '', 
    trainingExpiry: '', 
    nextSupervision: '', 
    supervisionFreq: 4,
    sicknessThisMonth: 0,
    latenessThisMonth: 0,
    status: 'active'
  };
}

function StaffModal({ staff, onSave, onClose }: { staff: StaffMember; onSave: (s: StaffMember) => void; onClose: () => void }) {
  const [form, setForm] = useState<StaffMember>({ ...staff });
  const set = (k: keyof StaffMember, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="glass border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-teal/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="p-8 border-b border-white/5 relative z-10">
          <h3 className="text-2xl font-black text-white tracking-tighter text-shimmer">{staff.name ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
          <p className="text-xs font-semibold text-hc-muted uppercase tracking-[0.08em] mt-1">Management and roster details</p>
        </div>
        <div className="p-8 space-y-6 relative z-10">
          <div className="space-y-4">
            <div className="group">
              <label className="section-header mb-2 ml-1 block opacity-90">Full Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sarah Mitchell"
                className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="section-header mb-2 ml-1 block opacity-90">Job Role</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="section-header mb-2 ml-1 block opacity-90">Primary House</label>
                <select value={form.house} onChange={e => set('house', e.target.value)}
                  className="w-full bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner">
                  {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">Employment Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as any)}
                className="w-full bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner">
                <option value="active">Active</option>
                <option value="sickness">Sickness</option>
                <option value="leave">On Leave</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">Sickness (Month)</label>
              <input type="number" value={form.sicknessThisMonth} onChange={e => set('sicknessThisMonth', parseInt(e.target.value) || 0)}
                className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">Lateness (Month)</label>
              <input type="number" value={form.latenessThisMonth} onChange={e => set('latenessThisMonth', parseInt(e.target.value) || 0)}
                className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
          </div>
          
          <div className="flex gap-4 pt-4">
            <button onClick={() => { if (form.name.trim()) onSave(form); }}
              disabled={!form.name.trim()}
              className="flex-[2] btn-gradient disabled:opacity-20 text-white text-[11px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-all">
              Save Staff Member
            </button>
            <button onClick={onClose} className="flex-1 glass-light border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-white py-4 rounded-2xl transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'ok' | 'due_soon' | 'overdue' }) {
  if (status === 'overdue') return <span className="pill pill-red text-[8px] font-black px-2 shadow-lg animate-pulse-soft">OVERDUE</span>;
  if (status === 'due_soon') return <span className="pill pill-amber text-[8px] font-black px-2 shadow-lg">DUE SOON</span>;
  return null;
}

export function StaffPage({ staff, onUpdate }: Props) {
  const [search, setSearch] = useState('');
  const [houseFilter, setHouseFilter] = useState('all');
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const houses = [...new Set(staff.map(s => s.house))].sort();
  if (houses.length === 0) houses.push(...HAZELCARE_HOUSES);

  const filtered = staff.filter(s => {
    if (houseFilter !== 'all' && s.house !== houseFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.role.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function saveMember(s: StaffMember) {
    const updated = staff.find(x => x.id === s.id)
      ? staff.map(x => x.id === s.id ? s : x)
      : [...staff, s];
    onUpdate(updated);
    setEditMember(null);
  }

  function deleteMember(id: string) {
    onUpdate(staff.filter(s => s.id !== id));
    setDeleteConfirm(null);
  }

  const totalActive = staff.filter(s => s.status === 'active').length;
  const totalSickness = staff.filter(s => s.status === 'sickness').length;
  const totalSicknessEvents = staff.reduce((sum, s) => sum + s.sicknessThisMonth, 0);
  const totalLatenessEvents = staff.reduce((sum, s) => sum + s.latenessThisMonth, 0);

  // Group by house
  const byHouse: Record<string, StaffMember[]> = {};
  for (const s of filtered) {
    (byHouse[s.house] ??= []).push(s);
  }

  const getStatusPill = (status: string) => {
    switch (status) {
      case 'active': return 'pill-green';
      case 'sickness': return 'pill-red animate-pulse-soft';
      case 'leave': return 'pill-amber';
      case 'suspended': return 'pill-purple shadow-lg shadow-hc-purple/20';
      default: return 'pill-blue';
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white mb-1 tracking-tight text-shimmer">Staff Team</h1>
          <div className="flex items-center gap-3">
            <span className="pill pill-blue text-[10px] uppercase tracking-wider font-bold shadow-lg">Team Overview</span>
            <span className="text-hc-muted text-[10px] font-bold uppercase tracking-widest ml-1">
              {staff.length} staff across {houses.length} houses
            </span>
          </div>
        </div>
        <button onClick={() => setEditMember(emptyStaff())}
          className="flex items-center gap-2.5 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl shadow-xl transition-all hover:scale-105">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Staff Member
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Staff', value: totalActive, color: '#22c55e', pill: 'pill-green' },
          { label: 'Off Sick', value: totalSickness, color: '#ef4444', pill: 'pill-red' },
          { label: 'Sickness This Month', value: totalSicknessEvents, sub: 'Events', color: '#f59e0b', pill: 'pill-amber' },
          { label: 'Lateness This Month', value: totalLatenessEvents, sub: 'Events', color: '#3b82f6', pill: 'pill-blue' },
        ].map(kpi => (
          <div key={kpi.label} className="glass-light border border-white/5 rounded-[1.5rem] p-6 shadow-xl transition-all duration-500 hover:scale-[1.02] active:scale-95 group relative overflow-hidden cursor-default">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.05] group-hover:opacity-[0.1] transition-opacity blur-3xl -translate-y-1/2 translate-x-1/2" style={{ background: kpi.color }} />
            <div className="section-header text-[9px] mb-2 opacity-60 uppercase tracking-[0.2em]">{kpi.label}</div>
            <div className="flex items-baseline gap-2 relative z-10">
              <div className="text-3xl font-black text-white tabular-nums tracking-tighter group-hover:scale-110 transition-transform duration-500" style={{ textShadow: `0 0 20px ${kpi.color}44` }}>{kpi.value}</div>
              {kpi.sub && <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-40">{kpi.sub}</span>}
            </div>
            <div className={`h-1 w-8 rounded-full mt-4 opacity-30 group-hover:opacity-100 group-hover:w-12 transition-all duration-700 ${kpi.pill.replace('pill', 'bg')}`} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-10 glass-light border border-white/5 p-5 rounded-[2rem] shadow-2xl backdrop-blur-xl">
        <div className="relative group flex-1 max-w-md">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff by name or role..."
            className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm text-white focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all placeholder-hc-muted/20 focus:bg-hc-dark"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="section-header text-[9px] tracking-[0.3em] opacity-60">House:</span>
          <select
            value={houseFilter}
            onChange={e => setHouseFilter(e.target.value)}
            className="bg-hc-dark/80 border border-white/10 rounded-xl px-6 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[220px]"
          >
            <option value="all">All Houses</option>
            {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-black text-hc-teal-light/60 uppercase tracking-[0.2em] tabular-nums">
            Showing: {filtered.length} Staff
          </span>
        </div>
      </div>

      {/* Staff by house */}
      <div className="space-y-12">
        {Object.entries(byHouse).sort(([a], [b]) => a.localeCompare(b)).map(([house, members], hIdx) => (
          <div key={house} className="animate-in slide-in-from-bottom-6 duration-700" style={{ animationDelay: `${hIdx * 100}ms` }}>
            <div className="flex items-center gap-4 mb-6 px-2 group cursor-default">
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase group-hover:text-shimmer group-hover:translate-x-1 transition-all duration-500">{house}</h2>
              <span className="pill pill-teal text-[10px] font-black px-3 py-0.5 shadow-lg opacity-80">{members.length} Staff</span>
              {members.some(m => m.status === 'sickness') && (
                <span className="pill pill-red text-[10px] font-black px-3 py-0.5 shadow-xl shadow-red-950/20 animate-pulse">
                  {members.filter(m => m.status === 'sickness').length} OFF SICK
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {members.map((member, idx) => {
                const isSick = member.status === 'sickness';
                const dbsS = staffStatus(member.dbsExpiry || '', 60);
                const trainS = staffStatus(member.trainingExpiry || '', 30);
                const supS = staffStatus(member.nextSupervision || '', 7);
                const hasComplianceWarning = dbsS !== 'ok' || trainS !== 'ok' || supS !== 'ok';

                return (
                  <div key={member.id} className={`glass-light border transition-all duration-500 rounded-[2rem] p-6 card-glow group/card interactive-row active:scale-95 animate-in slide-in-from-bottom-4
                    ${isSick ? 'border-flag-red/30 bg-flag-red/[0.02] glow-red shadow-flag-red/5' : hasComplianceWarning ? 'border-flag-amber/30 glow-amber' : 'border-white/5 hover:border-hc-teal/20'}`}
                    style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="flex items-start justify-between mb-5 relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl glass border border-white/10 flex items-center justify-center text-lg font-black text-hc-teal-light shadow-xl transition-transform group-hover/card:scale-110 duration-500">
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[15px] font-black text-white group-hover/card:text-hc-teal-light transition-colors tracking-tight leading-none mb-1">{member.name}</div>
                          <div className="text-[9px] font-bold text-hc-muted uppercase tracking-widest opacity-60">{member.role}</div>
                        </div>
                      </div>
                      <span className={`pill text-[9px] font-black uppercase tracking-widest shadow-2xl shadow-black/40 px-3 py-1 ${getStatusPill(member.status)}`}>
                        {member.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center mb-6 p-4 bg-black/20 rounded-2xl border border-white/5 shadow-inner relative z-10">
                      <div className="group/stat cursor-default">
                        <div className={`text-xl font-black transition-transform duration-500 group-hover/stat:scale-110 tabular-nums ${member.sicknessThisMonth > 2 ? 'text-flag-red' : member.sicknessThisMonth > 0 ? 'text-flag-amber' : 'text-flag-green'}`}>
                          {member.sicknessThisMonth}
                        </div>
                        <div className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-40">SICK</div>
                      </div>
                      <div className="group/stat cursor-default">
                        <div className={`text-xl font-black transition-transform duration-500 group-hover/stat:scale-110 tabular-nums ${member.latenessThisMonth > 2 ? 'text-flag-red' : member.latenessThisMonth > 0 ? 'text-flag-amber' : 'text-flag-green'}`}>
                          {member.latenessThisMonth}
                        </div>
                        <div className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-40">LATE</div>
                      </div>
                      <div className="group/stat cursor-default">
                        <div className="text-[11px] font-black text-hc-blue h-7 flex items-center justify-center transition-transform duration-500 group-hover/stat:scale-110 uppercase tracking-tighter">
                          {member.nextSupervision ? daysUntil(member.nextSupervision) + 'D' : '—'}
                        </div>
                        <div className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-40">SUP.</div>
                      </div>
                    </div>

                    {/* Compliance Mini Tags */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {dbsS !== 'ok' && <StatusBadge status={dbsS} />}
                      {trainS !== 'ok' && <StatusBadge status={trainS} />}
                      {supS !== 'ok' && <StatusBadge status={supS} />}
                    </div>
                    
                    <div className="flex items-center justify-between opacity-0 group-hover/card:opacity-100 transition-all -translate-y-2 group-hover/card:translate-y-0 relative z-10">
                      <div className="flex gap-2">
                        <button onClick={() => setEditMember(member)} className="w-8 h-8 rounded-lg glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-white hover:bg-hc-teal/10 hover:border-hc-teal/30 transition-all shadow-lg group/btn">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {deleteConfirm === member.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => deleteMember(member.id)} className="px-3 py-1 bg-flag-red/20 border border-flag-red/40 text-flag-red text-[8px] font-black uppercase tracking-widest rounded-lg">DEL</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 glass-light border border-white/10 text-hc-muted text-[8px] font-black uppercase tracking-widest rounded-lg">ESC</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(member.id)} className="w-8 h-8 rounded-lg glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-flag-red hover:bg-flag-red/5 hover:border-flag-red/30 transition-all shadow-lg group/btn">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                      <span className="text-[9px] font-black text-hc-teal-light uppercase tracking-[0.3em] flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-hc-teal shadow-[0_0_5px_#14b8a6]" />
                        Management
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-24 glass border border-white/5 rounded-3xl animate-in zoom-in duration-700">
          <div className="text-5xl mb-6 opacity-20">👥</div>
          <div className="text-lg font-extrabold text-white mb-2 uppercase tracking-tight">No Staff Found</div>
          <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">Clear filters to see all staff</div>
        </div>
      )}

      {editMember && <StaffModal staff={editMember} onSave={saveMember} onClose={() => setEditMember(null)} />}
    </div>
  );
}
