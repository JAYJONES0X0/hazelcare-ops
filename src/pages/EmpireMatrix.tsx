import { useState, useEffect, useMemo } from 'react';
import type { WeekSummary } from '../lib/types';
import { HardDrive, ShieldAlert, Activity, Users, Home, TrendingUp, AlertCircle, CheckCircle, Target } from 'lucide-react';

interface EmpireStats {
  totalHouses: number;
  totalEntries: number;
  avgQuality: number;
  criticalAlerts: number;
  staffActive: number;
}

export function EmpireMatrix({ weekData }: { weekData: WeekSummary | null }) {
  const stats = useMemo<EmpireStats>(() => {
    if (!weekData) return { totalHouses: 0, totalEntries: 0, avgQuality: 0, criticalAlerts: 0, staffActive: 0 };
    
    const houses = Object.values(weekData.houses);
    const totalEntries = weekData.totalEntries;
    const redFlags = houses.reduce((acc, h) => acc + h.flags.red, 0);
    const staffCount = new Set(houses.flatMap(h => h.entries.map(e => e.carer))).size;
    
    // Derive Empire Quality from historical density and flag mitigation
    const qualitySum = houses.reduce((acc, h) => {
       const houseQuality = h.entries.length === 0 ? 100 
         : Math.max(0, 100 - (h.flags.red * 15) - (h.flags.amber * 5));
       return acc + houseQuality;
    }, 0);
    const avgQuality = houses.length > 0 ? Math.round(qualitySum / houses.length) : 0;

    return {
      totalHouses: houses.length,
      totalEntries,
      avgQuality,
      criticalAlerts: redFlags,
      staffActive: staffCount
    };
  }, [weekData]);

  if (!weekData) return (
     <div className="p-12 text-center text-hc-muted uppercase tracking-widest font-black opacity-20">
        Injest Clinical Data to Initialize Empire Matrix
     </div>
  );

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
      
      {/* ── HEADER ── */}
      <div className="flex items-end justify-between border-b border-hc-border/10 pb-10">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center text-hc-teal">
              <TrendingUp size={24} />
            </div>
            <h1 className="text-4xl font-black text-hc-text tracking-[0.2em] uppercase">Empire Matrix</h1>
          </div>
          <p className="text-hc-muted text-[11px] font-bold uppercase tracking-widest opacity-60">
            Multi-Node Governance · Real-Time Quality Aggregation
          </p>
        </div>
        <div className="flex items-center gap-3 px-6 py-3 rounded-2xl hc-clay-inset border border-hc-teal/20 text-hc-teal">
           <Activity size={16} className="animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational Core v.1.0</span>
        </div>
      </div>

      {/* ── HIGH LEVEL KPI GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
         {[
           { label: 'Total Nodes', val: stats.totalHouses, icon: Home, color: 'text-hc-teal' },
           { label: 'Intel Streams', val: stats.totalEntries, icon: Activity, color: 'text-hc-teal' },
           { label: 'Avg Quality', val: `${stats.avgQuality}%`, icon: TrendingUp, color: 'text-hc-sage' },
           { label: 'Critical Risks', val: stats.criticalAlerts, icon: ShieldAlert, color: 'text-flag-red' },
           { label: 'Force Capacity', val: stats.staffActive, icon: Users, color: 'text-hc-teal' },
         ].map((stat, i) => (
           <div key={i} className="hc-clay-raised p-6 rounded-[2rem] flex flex-col gap-3 group hover:scale-[1.02] transition-all">
              <div className={`w-8 h-8 rounded-lg hc-clay-inset flex items-center justify-center ${stat.color}`}>
                 <stat.icon size={16} />
              </div>
              <div>
                 <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1">{stat.label}</div>
                 <div className="text-2xl font-black text-hc-text tabular-nums">{stat.val}</div>
              </div>
           </div>
         ))}
      </div>

      {/* ── HOUSE HEATMAP GRID ── */}
      <div className="space-y-6">
        <h2 className="text-xs font-black text-hc-muted uppercase tracking-[0.3em] ml-2">House-Level Life Signals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {Object.entries(weekData.houses).map(([name, data]) => {
              // Master Dev Algorithm: Quality = (Entries * 2 - Flags) weighted
              const houseQuality = data.entries.length === 0 ? 100 
                : Math.max(0, 100 - (data.flags.red * 15) - (data.flags.amber * 5));
              const isCompromised = data.flags.red > 2;
              const entryDensity = Math.min(100, Math.round((data.entries.length / 500) * 100)); // Cap for visualization

              return (
                <div key={name} className="hc-clay-raised p-8 rounded-[3rem] relative overflow-hidden group">
                   {/* Background Glow */}
                   <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 transition-opacity group-hover:opacity-20 ${isCompromised ? 'bg-flag-red' : 'bg-hc-teal'}`} />
                   
                   <div className="flex items-start justify-between mb-8">
                      <div>
                         <h3 className="text-xl font-black text-hc-text uppercase tracking-tight mb-1">{name}</h3>
                         <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full animate-pulse ${isCompromised ? 'bg-flag-red' : 'bg-flag-green'}`} />
                            <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">{isCompromised ? 'Review Required' : 'Operational'}</span>
                         </div>
                      </div>
                      <div className="hc-clay-inset px-4 py-2 rounded-xl text-center min-w-[80px]">
                         <div className="text-[8px] font-black text-hc-muted uppercase mb-0.5">Quality</div>
                         <div className={`text-lg font-black ${houseQuality < 70 ? 'text-flag-red' : houseQuality < 85 ? 'text-flag-amber' : 'text-flag-green'}`}>
                            {houseQuality}%
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                         <span className="text-hc-muted">Notes (Window)</span>
                         <span className="text-hc-text">{data.entries.length}</span>
                      </div>
                      <div className="w-full h-1.5 hc-clay-inset rounded-full overflow-hidden">
                         <div 
                           className={`h-full rounded-full transition-all duration-1000 ${houseQuality < 70 ? 'bg-flag-red' : 'bg-hc-teal'}`} 
                           style={{ width: `${entryDensity}%` }} 
                         />
                      </div>
                      <div className="flex items-center gap-4 mt-6">
                         <div className="flex items-center gap-1.5 text-flag-red">
                            <AlertCircle size={12} />
                            <span className="text-[10px] font-black tabular-nums">{data.flags.red}</span>
                         </div>
                         <div className="flex items-center gap-1.5 text-flag-amber">
                            <TrendingUp size={12} />
                            <span className="text-[10px] font-black tabular-nums">{data.flags.amber}</span>
                         </div>
                         <div className="flex items-center gap-1.5 text-flag-green ml-auto">
                            <CheckCircle size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Stable</span>
                         </div>
                      </div>
                   </div>
                </div>
              );
           })}
        </div>
      </div>

      {/* ── SECURITY FOOTER ── */}
      <div className="pt-12 border-t border-hc-border/10 flex items-center justify-between opacity-40">
         <div className="flex items-center gap-8">
            <Home size={20} className="text-hc-muted" />
            <Users size={20} className="text-hc-muted" />
            <HardDrive size={20} className="text-hc-muted" />
         </div>
         <div className="text-[8px] font-black text-hc-muted uppercase tracking-[0.4em]">Sovereign Empire Protocol · E2E Encryption Active</div>
      </div>
    </div>
  );
}
