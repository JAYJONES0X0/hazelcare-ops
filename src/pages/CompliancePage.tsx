import { useState, useMemo, useEffect } from 'react';
import type { StaffMember } from '../lib/types';
import { HAZELCARE_HOUSES } from '../lib/compliance-store';
import { ORG_CONFIG } from '../lib/config';
import { Shield, ChevronRight, Search, FileCheck, UserPlus } from 'lucide-react';

import { getAllEntriesAsync } from '../lib/entry-store';
import { computeStaffMonitoring } from '../lib/staff-monitoring';
import { detectClinicalGaps, type ClinicalGap } from '../lib/continuity-engine';
import { History, UserX, AlertCircle } from 'lucide-react';

interface Props {
  staff: StaffMember[];
  onUpdate: (staff: StaffMember[]) => void;
}

export function CompliancePage({ staff }: Props) {
  const [search, setSearch] = useState('');
  const [houseFilter, setHouseFilter] = useState('all');
  const [dbStaff, setDbStaff] = useState<any[]>([]);
  const [booting, setBooting] = useState(true);
  const [gaps, setGaps] = useState<ClinicalGap[]>([]);
  const [tab, setTab] = useState<'personnel' | 'integrity'>('integrity');

  useEffect(() => {
    void getAllEntriesAsync().then(all => {
      if (all.length === 0) { setBooting(false); return; }
      
      const summary: any = { 
        totalEntries: all.length,
        dateFrom: '', dateTo: '', allFlags: [], entryTypes: {}, housePerformance: {}, 
        houses: {} as any 
      };
      all.forEach(e => {
        const h = e.house || 'UNASSIGNED';
        if (!summary.houses[h]) {
          summary.houses[h] = { 
            name: h, 
            entries: [],
            incidents: [],
            safeguarding: [],
            medication: [],
            staffPerformance: [],
            healthSafety: [],
            handovers: [],
            dailySupport: [],
            flags: { red: 0, amber: 0, green: 0 }
          };
        }
        summary.houses[h].entries.push(e);
        if (e.severity === 'red') summary.houses[h].flags.red++;
        if (e.severity === 'amber') summary.houses[h].flags.amber++;
        if (e.severity === 'green') summary.houses[h].flags.green++;
      });

      const analytics = computeStaffMonitoring(summary, { house: 'all', dateFrom: '', dateTo: '' });
      
      // RUN CONTINUITY AUDIT
      const clinicalGaps = detectClinicalGaps(all);
      setGaps(clinicalGaps);
      
      // Combine ledger staff with discovered staff
      const discovered = analytics.staff.map(s => {
        const ledgerMatch = staff.find(ls => ls.name === s.carer);
        return {
          id: s.carer,
          name: s.carer,
          house: s.categoryBreakdown[0]?.category || 'Unknown',
          qualityScore: s.qualityScore,
          entryCount: s.categoryBreakdown.reduce((sum, c) => sum + c.count, 0),
          lastEntry: 'Active', // Ideally extract the latest date
          status: ledgerMatch ? 'Registered' : 'Discovered'
        };
      });

      setDbStaff(discovered);
      setBooting(false);
    });
  }, [staff]);

  const stats = useMemo(() => {
    const total = dbStaff.length;
    const compliant = dbStaff.filter(s => s.qualityScore >= 70).length;
    const pending = dbStaff.filter(s => s.qualityScore < 70 && s.qualityScore >= 45).length;
    const missing = dbStaff.filter(s => s.qualityScore < 45).length;
    return { total, compliant, pending, missing, rate: total ? Math.round((compliant / total) * 100) : 0 };
  }, [dbStaff]);

  const filteredStaff = useMemo(() => {
    return dbStaff.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchHouse = houseFilter === 'all' || s.house.includes(houseFilter);
      return matchSearch && matchHouse;
    });
  }, [dbStaff, search, houseFilter]);

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

      {/* ── Tab Matrix ── */}
      <div className="flex gap-4 mb-12 border-b border-hc-border/10">
         <button 
           onClick={() => setTab('integrity')}
           className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-2 
             ${tab === 'integrity' ? 'border-hc-teal text-hc-teal bg-hc-teal/5' : 'border-transparent text-hc-muted hover:text-hc-text opacity-40'}`}
         >
           Clinical Integrity Audit
         </button>
         <button 
           onClick={() => setTab('personnel')}
           className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] transition-all border-b-2 
             ${tab === 'personnel' ? 'border-hc-teal text-hc-teal bg-hc-teal/5' : 'border-transparent text-hc-muted hover:text-hc-text opacity-40'}`}
         >
           Personnel Compliance
         </button>
      </div>

      {/* ── Tactical Filters (Only show for Personnel for now) ── */}
      {tab === 'personnel' && (
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
      )}

      {/* ── CONTENT SWITCHER ── */}
      {tab === 'integrity' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Gaps List */}
           <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-2 mb-4">
                 <h2 className="text-[11px] font-black text-hc-text uppercase tracking-[0.4em]">Evidence Continuity Gaps</h2>
                 <span className="pill !bg-flag-red text-hc-bone">{gaps.length} GAPS DETECTED</span>
              </div>
              <div className="space-y-3">
                 {gaps.slice(0, 50).map(gap => (
                   <div key={gap.id} className="hc-clay-raised p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:scale-[1.01] transition-transform relative overflow-hidden group">
                      {/* Operational Tag */}
                      <div className="absolute top-0 right-0 px-3 py-1 bg-hc-teal/10 border-b border-l border-hc-teal/20 text-[8px] font-black text-hc-teal uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                         Forensic Recon Active
                      </div>
                      
                      <div className="flex items-center gap-6">
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${gap.severity === 'red' ? 'bg-flag-red/10 text-flag-red' : 'bg-flag-amber/10 text-flag-amber'}`}>
                            {gap.severity === 'red' ? <UserX size={24} /> : <History size={24} />}
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                               <div className="text-[13px] font-black text-hc-text uppercase tracking-tight">{gap.client}</div>
                               {gap.likelyCarers.length > 0 && <span className="text-[8px] font-black bg-hc-teal/20 text-hc-teal px-2 py-0.5 rounded-full uppercase">Inferred</span>}
                            </div>
                            <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mt-1">Station: {gap.house} · {gap.date}</div>
                         </div>
                      </div>

                      <div className="flex flex-col gap-3 md:items-end">
                         <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-60">Prime Attendance Witness</div>
                         <div className="flex flex-wrap gap-2 justify-end">
                            {gap.likelyCarers.length > 0 ? (
                               gap.likelyCarers.map(c => (
                                 <span key={c} className="pill-teal !px-4 !py-1.5 border-hc-teal/40">{c.toUpperCase()}</span>
                               ))
                            ) : (
                               <span className="pill-red !px-4 !py-1.5 opacity-60 italic text-[8px]">No Witness Identified (Deep Silence)</span>
                            )}
                         </div>
                      </div>
                   </div>
                 ))}
                 {gaps.length > 50 && (
                    <div className="hc-clay-inset p-4 text-center rounded-2xl text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-40">
                       + {gaps.length - 50} additional continuity gaps identified in historical data
                    </div>
                 )}
                 {gaps.length === 0 && !booting && (
                    <div className="hc-clay-inset p-20 text-center rounded-[3rem]">
                       <FileCheck className="w-16 h-16 text-hc-teal mx-auto mb-6 opacity-40" />
                       <div className="text-[11px] font-black text-hc-teal uppercase tracking-[0.5em]">Forensic Integrity: 100% — No Coverage Gaps Found.</div>
                    </div>
                 )}
              </div>
           </div>

           {/* Audit Intelligence Sidebar */}
           <div className="space-y-8">
              <div className="hc-clay-raised p-8 space-y-6">
                 <div className="flex items-center gap-3">
                    <AlertCircle className="text-hc-teal" />
                    <h3 className="text-xs font-black text-hc-text uppercase tracking-widest">Audit Context</h3>
                 </div>
                 <p className="text-[10px] font-bold text-hc-muted uppercase tracking-wider leading-relaxed">
                   The Sovereign continuity engine scans cross-client telemetry. If Andrew has a gap, but Sarah was recording notes for other clients, the system identifies Sarah as the witness for that missing shift.
                 </p>
                 <div className="h-px bg-hc-border opacity-10" />
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] font-black text-hc-muted uppercase tracking-tighter">Database Scan Rank</span>
                       <span className="text-[10px] font-black text-hc-teal">FORENSIC GRADE</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] font-black text-hc-muted uppercase tracking-tighter">Cross-Inference</span>
                       <span className="text-[10px] font-black text-hc-green">ACTIVE</span>
                    </div>
                 </div>
              </div>

              <div className="hc-clay-inset p-8 space-y-6 opacity-60">
                 <h3 className="text-[10px] font-black text-hc-text uppercase tracking-widest">Recovery Protocol</h3>
                 <p className="text-[9px] font-bold text-hc-muted uppercase tracking-wider leading-relaxed">
                   Use the identified witness list to initiate "Legacy Reconstruction" sessions with relevant personnel to close all clinical gaps.
                 </p>
              </div>
           </div>
        </div>
      ) : (
        <div className="hc-clay-raised overflow-hidden relative">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/5 border-b border-hc-muted/10">
                  <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Carer Identity</th>
                  <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Station</th>
                  <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Documentation Role</th>
                  <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Clinical Accuracy</th>
                  <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Log Volume</th>
                  <th className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">Operational Status</th>
                  <th className="px-8 py-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hc-muted/5">
                {filteredStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-black/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center font-black text-hc-muted text-xs uppercase">{s.name.charAt(0)}</div>
                          <div className="font-black text-sm text-hc-text tracking-tight uppercase">{s.name}</div>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-[10px] font-black text-hc-muted uppercase tracking-widest">{s.house}</td>
                    <td className="px-8 py-6 text-[10px] font-bold text-hc-muted uppercase tracking-widest">Support Personnel</td>
                    <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                           <span className={`text-[10px] font-black uppercase tracking-widest ${s.qualityScore >= 70 ? 'text-flag-green' : s.qualityScore >= 45 ? 'text-flag-amber' : 'text-flag-red'}`}>
                             {s.qualityScore}% Standard Adherence
                           </span>
                           <div className="h-1 w-24 rounded-full bg-black/10 overflow-hidden">
                              <div className={`h-full ${s.qualityScore >= 70 ? 'bg-flag-green' : s.qualityScore >= 45 ? 'bg-flag-amber' : 'bg-flag-red'}`} style={{width: `${s.qualityScore}%`}} />
                           </div>
                        </div>
                    </td>
                    <td className="px-8 py-6 text-[10px] font-bold text-hc-muted uppercase tracking-widest">{s.entryCount} Intelligence Points</td>
                    <td className="px-8 py-6">
                        <span className={`pill !bg-hc-bg border border-hc-muted/10 ${s.status === 'Registered' ? 'text-hc-teal' : 'text-hc-amber'}`}>
                          {s.status}
                        </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <button className="p-3 rounded-xl hc-clay-raised text-hc-muted hover:text-hc-teal transition-all active:scale-90">
                          <ChevronRight className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                ))}
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
      )}

    </div>
  );
}
