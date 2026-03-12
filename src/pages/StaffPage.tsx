import { useState } from 'react';
import type { StaffMember } from '../lib/types';

interface Props {
  staff: StaffMember[];
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  sickness: { label: 'Sickness', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  leave: { label: 'Leave', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  suspended: { label: 'Suspended', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
};

export function StaffPage({ staff }: Props) {
  const [search, setSearch] = useState('');
  const [houseFilter, setHouseFilter] = useState('all');

  const houses = [...new Set(staff.map(s => s.house))].sort();
  const filtered = staff.filter(s => {
    if (houseFilter !== 'all' && s.house !== houseFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.role.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalActive = staff.filter(s => s.status === 'active').length;
  const totalSickness = staff.filter(s => s.status === 'sickness').length;
  const totalSicknessEvents = staff.reduce((sum, s) => sum + s.sicknessThisMonth, 0);
  const totalLatenessEvents = staff.reduce((sum, s) => sum + s.latenessThisMonth, 0);

  // Group by house
  const byHouse: Record<string, StaffMember[]> = {};
  for (const s of filtered) {
    (byHouse[s.house] ??= []).push(s);
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Staff Overview</h1>
          <p className="text-hc-muted text-sm">{staff.length} staff across {houses.length} houses</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Staff', value: totalActive, color: '#22c55e' },
          { label: 'On Sickness', value: totalSickness, color: '#ef4444' },
          { label: 'Sickness Events', value: totalSicknessEvents, sub: 'This month', color: '#f59e0b' },
          { label: 'Lateness Events', value: totalLatenessEvents, sub: 'This month', color: '#3b82f6' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-hc-card border border-hc-border rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-[0.05]" style={{ background: kpi.color, filter: 'blur(20px)', transform: 'translate(30%, -30%)' }} />
            <div className="text-[11px] text-hc-muted mb-1">{kpi.label}</div>
            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hc-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff..."
            className="w-full pl-9 pr-4 py-2 bg-hc-card border border-hc-border rounded-xl text-sm text-white placeholder:text-hc-muted/50 focus:outline-none focus:border-hc-teal-light"
          />
        </div>
        <select
          value={houseFilter}
          onChange={e => setHouseFilter(e.target.value)}
          className="bg-hc-card border border-hc-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-hc-teal-light"
        >
          <option value="all">All Houses</option>
          {houses.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      {/* Staff by house */}
      <div className="space-y-6">
        {Object.entries(byHouse).sort(([a], [b]) => a.localeCompare(b)).map(([house, members]) => (
          <div key={house}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-white">{house}</h2>
              <span className="text-[10px] text-hc-muted bg-hc-dark px-2 py-0.5 rounded-full">{members.length} staff</span>
              {members.some(m => m.status === 'sickness') && (
                <span className="text-[10px] text-flag-red bg-flag-red/10 px-2 py-0.5 rounded-full border border-flag-red/20">
                  {members.filter(m => m.status === 'sickness').length} off sick
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {members.map(member => {
                const sb = STATUS_BADGE[member.status];
                return (
                  <div key={member.id} className="bg-hc-card border border-hc-border rounded-xl p-4 hover:bg-hc-card-hover hover:border-hc-border-light transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-white">{member.name}</div>
                        <div className="text-[11px] text-hc-muted">{member.role}</div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sb.color, background: sb.bg }}>
                        {sb.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-hc-border">
                      <div>
                        <div className={`text-sm font-bold ${member.sicknessThisMonth > 2 ? 'text-flag-red' : member.sicknessThisMonth > 0 ? 'text-flag-amber' : 'text-flag-green'}`}>
                          {member.sicknessThisMonth}
                        </div>
                        <div className="text-[9px] text-hc-muted">Sickness</div>
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${member.latenessThisMonth > 2 ? 'text-flag-red' : member.latenessThisMonth > 0 ? 'text-flag-amber' : 'text-flag-green'}`}>
                          {member.latenessThisMonth}
                        </div>
                        <div className="text-[9px] text-hc-muted">Lateness</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-hc-blue">
                          {member.nextSupervision || '—'}
                        </div>
                        <div className="text-[9px] text-hc-muted">Next Sup.</div>
                      </div>
                    </div>

                    {/* Expiry warnings */}
                    {(member.dbsExpiry || member.trainingExpiry) && (
                      <div className="mt-2 pt-2 border-t border-hc-border space-y-1">
                        {member.dbsExpiry && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-hc-muted">DBS Expiry</span>
                            <span className="text-hc-text">{member.dbsExpiry}</span>
                          </div>
                        )}
                        {member.trainingExpiry && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-hc-muted">Training Expiry</span>
                            <span className="text-hc-text">{member.trainingExpiry}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-hc-muted">
          <div className="text-sm">No staff matching your filters</div>
        </div>
      )}
    </div>
  );
}
