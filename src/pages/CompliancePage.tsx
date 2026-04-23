import { useState, useMemo } from 'react';
import type { StaffMember } from '../lib/types';
import { HAZELCARE_HOUSES } from '../lib/compliance-store';
import { ORG_CONFIG } from '../lib/config';
import { Shield, Clock, ChevronRight, Search, FileCheck, UserPlus } from 'lucide-react';

interface Props {
  staff: StaffMember[];
  onUpdate: (staff: StaffMember[]) => void;
}

export function CompliancePage({ staff }: Props) {
  const [search, setSearch] = useState('');
  const [houseFilter, setHouseFilter] = useState('all');

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchHouse = houseFilter === 'all' || s.house === houseFilter;
      return matchSearch && matchHouse;
    });
  }, [staff, search, houseFilter]);

  const stats = useMemo(() => {
    const total = staff.length;
    const compliant = staff.filter(s => s.complianceStatus === 'compliant').length;
    const pending = staff.filter(s => s.complianceStatus === 'pending').length;
    const missing = staff.filter(s => s.complianceStatus === 'missing').length;
    return { total, compliant, pending, missing, rate: total ? Math.round((compliant / total) * 100) : 0 };
  }, [staff]);

  return (
    <div className="p-6 lg:p-10 max-w-[2560px] mx-auto animate-in fade-in duration-700">
      
      {/* ── Page Header ── */}
      <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-hc-muted/10 pb-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
             <Shield className="w-6 h-6 text-hc-teal" />
             <h1 className="text-2xl md:text-4xl font-black text-hc-text tracking-[0.2em] uppercase">Regulatory Audit</h1>
          </div>
          <p className="text-hc-muted text-sm font-bold opacity-80 uppercase tracking-wider leading-relaxed">
            Personnel Compliance & Credentialing Matrix — {ORG_CONFIG.name} Governance Standard.
          </p>
        </div>
        
        {/* KPI Slabs */}
        <div className="flex flex-wrap gap-6">
          {[
            { label: 'Network Health', value: `${stats.rate}%`, color: 'text-hc-teal' },
            { label: 'Missing Docs', value: stats.missing, color: 'text-flag-red' },
            { label: 'Pending Review', value: stats.pending, color: 'text-flag-amber' }
          ].map(kpi => (
            <div key={kpi.label} className="hc-clay-raised px-8 py-5 min-w-[160px]">
              <div className="text-[9px] font-black text-hc-muted uppercase tracking-[0.3em] mb-2">{kpi.label}</div>
              <div className={`text-2xl font-black ${kpi.color} tabular-nums tracking-tighter`}>{kpi.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tactical Filters ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="md:col-span-2 relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-hc-muted group-focus-within:text-hc-teal transition-colors w-4 h-4" />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="QUERY PERSONNEL RECORDS..." 
            className="w-full h-[60px] hc-clay-inset pl-16 pr-8 text-[11px] font-black uppercase tracking-[0.2em] text-hc-text focus:outline-none transition-all" 
          />
        </div>
        <select 
          value={houseFilter}
          onChange={e => setHouseFilter(e.target.value)}
          className="h-[60px] hc-clay-inset px-6 text-[10px] font-black uppercase tracking-[0.2em] text-hc-text outline-none"
        >
          <option value="all">ALL STATIONS</option>
          {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h.toUpperCase()}</option>)}
        </select>
        <button className="h-[60px] btn-tactical flex items-center justify-center gap-3 shadow-xl">
           <UserPlus className="w-4 h-4" /> Add Personnel
        </button>
      </div>

      {/* ── Personnel Compliance Matrix ── */}
      <div className="hc-clay-raised overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/5 border-b border-hc-muted/10">
                <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Carer Identity</th>
                <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Station</th>
                <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">DBS Status</th>
                <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Training</th>
                <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Supervision</th>
                <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Status</th>
                <th className="px-8 py-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hc-muted/5">
              {filteredStaff.map((s) => {
                const statusColor = s.complianceStatus === 'compliant' ? 'text-flag-green' : s.complianceStatus === 'pending' ? 'text-flag-amber' : 'text-flag-red';
                return (
                  <tr key={s.id} className="hover:bg-black/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center font-black text-hc-muted text-xs uppercase">{s.name.charAt(0)}</div>
                          <div className="font-black text-sm text-hc-text tracking-tight uppercase">{s.name}</div>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-widest">{s.house}</td>
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${s.dbsChecked ? 'bg-flag-green' : 'bg-flag-red'}`} />
                          <span className="text-[10px] font-black text-hc-text uppercase tracking-widest">{s.dbsChecked ? 'Verified' : 'Missing'}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-hc-text uppercase tracking-widest">{s.trainingCompletion}% Complete</span>
                          <div className="h-1 w-24 rounded-full bg-black/10 overflow-hidden">
                             <div className="h-full bg-hc-teal" style={{width: `${s.trainingCompletion}%`}} />
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-2 text-hc-muted">
                          <Clock className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest italic">{s.lastSupervision || 'Not Logged'}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                       <span className={`pill !bg-hc-bg border border-hc-muted/10 ${statusColor}`}>{s.complianceStatus}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <button className="p-3 rounded-xl hc-clay-raised text-hc-muted hover:text-hc-teal transition-all active:scale-90">
                          <ChevronRight className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredStaff.length === 0 && (
            <div className="py-24 text-center">
               <FileCheck className="w-12 h-12 text-hc-muted mx-auto mb-6 opacity-20" />
               <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.4em]">No personnel records matched query.</div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
