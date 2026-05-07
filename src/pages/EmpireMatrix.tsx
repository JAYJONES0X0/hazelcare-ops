import { useState, useEffect, useMemo } from 'react';
import type { WeekSummary, Page } from '../lib/types';
import { getAllEntriesAsync } from '../lib/entry-store';
import { buildWeekSummary } from '../lib/universal-parser';
import { computeStaffMonitoring, flattenWeekEntries } from '../lib/staff-monitoring';
import {
  TrendingUp, AlertCircle, Users, Home, Activity, ShieldAlert,
  ChevronRight, RefreshCw, CheckCircle,
} from 'lucide-react';

interface Props {
  weekData: WeekSummary | null;
  setPage?: (p: Page, ctx?: any) => void;
}

export function EmpireMatrix({ weekData: weekDataProp, setPage }: Props) {
  const [weekData, setWeekData] = useState<WeekSummary | null>(weekDataProp);
  const [hydrating, setHydrating] = useState(!weekDataProp);

  useEffect(() => {
    if (weekDataProp) { setWeekData(weekDataProp); setHydrating(false); return; }
    getAllEntriesAsync().then(entries => {
      if (entries.length > 0) setWeekData(buildWeekSummary(entries));
      setHydrating(false);
    }).catch(() => setHydrating(false));
  }, [weekDataProp]);

  // Use the REAL staff quality scores per house
  const snapshot = useMemo(() => computeStaffMonitoring(weekData, {}), [weekData]);

  const houseData = useMemo(() => {
    if (!weekData) return [];
    return Object.entries(weekData.houses).map(([name, house]) => {
      // Get all staff for this house from the monitoring snapshot
      const allEntries = flattenWeekEntries(weekData);
      const houseEntries = allEntries.filter(e => (e.house || '').toLowerCase().includes(name.toLowerCase()));
      const staffInHouse = snapshot.staff.filter(s =>
        houseEntries.some(e => e.carer === s.carer)
      );
      const avgQuality = staffInHouse.length > 0
        ? Math.round(staffInHouse.reduce((sum, s) => sum + s.qualityScore, 0) / staffInHouse.length)
        : null;

      const uniqueClients = new Set(house.entries.map(e => e.client).filter(Boolean)).size;
      const uniqueStaff = new Set(house.entries.map(e => e.carer).filter(Boolean)).size;
      const redFlags = house.flags.red;
      const amberFlags = house.flags.amber;
      const totalEntries = house.entries.length;

      return {
        name,
        totalEntries,
        uniqueClients,
        uniqueStaff,
        redFlags,
        amberFlags,
        avgQuality,
        status: redFlags > 2 ? 'critical' : redFlags > 0 ? 'review' : 'operational',
      };
    }).sort((a, b) => {
      // Rank: critical first, then by red flags, then quality descending
      const statusOrder = { critical: 0, review: 1, operational: 2 };
      return statusOrder[a.status] - statusOrder[b.status] || b.redFlags - a.redFlags;
    });
  }, [weekData, snapshot]);

  const summaryStats = useMemo(() => ({
    totalSites: houseData.length,
    totalEntries: weekData?.totalEntries || 0,
    totalStaff: snapshot.staff.length,
    avgQuality: snapshot.staff.length > 0
      ? Math.round(snapshot.staff.reduce((s, st) => s + st.qualityScore, 0) / snapshot.staff.length)
      : 0,
    criticalSites: houseData.filter(h => h.status === 'critical').length,
    reviewSites: houseData.filter(h => h.status === 'review').length,
  }), [houseData, snapshot, weekData]);

  if (hydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hc-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-hc-teal/20 border-t-hc-teal rounded-full animate-spin" />
          <div className="text-[10px] font-black text-hc-teal uppercase tracking-[0.3em] animate-pulse">Calibrating Empire Matrix</div>
        </div>
      </div>
    );
  }

  if (!weekData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-hc-bg animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-3xl hc-clay-raised flex items-center justify-center mb-8">
          <Home className="w-12 h-12 text-hc-teal opacity-20" />
        </div>
        <h2 className="text-3xl font-black text-hc-text tracking-[0.4em] uppercase mb-4 text-center">No Sites Registered</h2>
        <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.4em] mb-10 text-center max-w-sm">Upload a CSV export to initialise the multi-site governance view.</p>
        <button onClick={() => setPage?.('upload')} className="btn-clay btn-clay-teal h-[60px] px-10">Field Ingest</button>
      </div>
    );
  }

  const STATUS_CONFIG = {
    critical:    { label: 'Critical',    dot: 'bg-flag-red animate-pulse shadow-[0_0_8px_#d94e4e]', badge: 'bg-flag-red/10 text-flag-red border-flag-red/30',   glow: 'bg-flag-red/5' },
    review:      { label: 'Review',      dot: 'bg-flag-amber animate-pulse',                         badge: 'bg-flag-amber/10 text-flag-amber border-flag-amber/30', glow: 'bg-flag-amber/5' },
    operational: { label: 'Operational', dot: 'bg-flag-green',                                       badge: 'bg-flag-green/10 text-flag-green border-flag-green/30', glow: '' },
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1800px] mx-auto space-y-10 animate-in fade-in duration-700">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-hc-border/20 pb-10">
        <div>
          <div className="text-[10px] font-black text-hc-teal uppercase tracking-[0.3em] mb-2">Multi-Site Governance</div>
          <h1 className="text-4xl font-black text-hc-text tracking-[0.2em] uppercase">Empire Matrix</h1>
          <p className="text-[10px] font-black text-hc-muted uppercase tracking-widest mt-2">
            Cross-site quality intelligence · {houseData.length} sites in scope
          </p>
        </div>
        <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl hc-clay-inset border border-hc-teal/20">
          <RefreshCw size={12} className="text-hc-teal animate-spin-slow" />
          <span className="text-[9px] font-black text-hc-teal uppercase tracking-[0.3em]">Live · {snapshot.staff.length} Personnel Scored</span>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Active Sites',     val: summaryStats.totalSites,   icon: Home,       color: 'text-hc-teal'   },
          { label: 'Intel Streams',    val: summaryStats.totalEntries.toLocaleString(), icon: Activity, color: 'text-hc-teal' },
          { label: 'Personnel Scored', val: summaryStats.totalStaff,   icon: Users,      color: 'text-hc-teal'   },
          { label: 'Avg Doc Quality',  val: `${summaryStats.avgQuality}%`, icon: TrendingUp, color: summaryStats.avgQuality >= 70 ? 'text-flag-green' : summaryStats.avgQuality >= 45 ? 'text-flag-amber' : 'text-flag-red' },
          { label: 'Sites Critical',   val: summaryStats.criticalSites, icon: ShieldAlert, color: summaryStats.criticalSites > 0 ? 'text-flag-red' : 'text-hc-muted' },
          { label: 'Sites Under Review', val: summaryStats.reviewSites, icon: AlertCircle, color: summaryStats.reviewSites > 0 ? 'text-flag-amber' : 'text-hc-muted' },
        ].map(s => (
          <div key={s.label} className="hc-clay-raised p-5 rounded-2xl flex flex-col gap-3">
            <div className={`w-8 h-8 rounded-xl hc-clay-inset flex items-center justify-center ${s.color}`}>
              <s.icon size={15} />
            </div>
            <div>
              <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1">{s.label}</div>
              <div className={`text-2xl font-black tabular-nums ${s.color}`}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Site League Table + Cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <div className="w-2 h-2 rounded-full bg-hc-teal" />
          <h2 className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em]">Site Performance League · Ranked by Risk</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {houseData.map((h, rank) => {
            const cfg = STATUS_CONFIG[h.status];
            const qualityColor = h.avgQuality === null ? 'text-hc-muted'
              : h.avgQuality >= 70 ? 'text-flag-green'
              : h.avgQuality >= 45 ? 'text-flag-amber'
              : 'text-flag-red';

            return (
              <div
                key={h.name}
                onClick={() => setPage?.('staff-monitoring')}
                className={`hc-clay-raised p-6 rounded-[2.5rem] relative overflow-hidden group cursor-pointer hover:scale-[1.01] transition-all border border-hc-border/5 hover:border-hc-teal/20 ${h.status !== 'operational' ? cfg.glow : ''}`}
              >
                {/* Rank badge */}
                <div className="absolute top-5 right-5 w-8 h-8 rounded-xl hc-clay-inset flex items-center justify-center text-[10px] font-black text-hc-muted tabular-nums">
                  #{rank + 1}
                </div>

                {/* Site name + status */}
                <div className="mb-5 pr-10">
                  <h3 className="text-lg font-black text-hc-text uppercase tracking-tight group-hover:text-hc-teal transition-colors mb-2">{h.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${cfg.badge}`}>{cfg.label}</span>
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="hc-clay-inset rounded-xl p-3 text-center">
                    <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Doc Quality</div>
                    <div className={`text-xl font-black tabular-nums ${qualityColor}`}>
                      {h.avgQuality !== null ? `${h.avgQuality}%` : '—'}
                    </div>
                  </div>
                  <div className="hc-clay-inset rounded-xl p-3 text-center">
                    <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Intel Streams</div>
                    <div className="text-xl font-black text-hc-text tabular-nums">{h.totalEntries}</div>
                  </div>
                </div>

                {/* Flags + staff + clients */}
                <div className="flex items-center gap-3 flex-wrap">
                  {h.redFlags > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-black text-flag-red">
                      <AlertCircle size={10} /> {h.redFlags} critical
                    </span>
                  )}
                  {h.amberFlags > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-black text-flag-amber">
                      <TrendingUp size={10} /> {h.amberFlags} amber
                    </span>
                  )}
                  {h.redFlags === 0 && h.amberFlags === 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-black text-flag-green">
                      <CheckCircle size={10} /> No flags
                    </span>
                  )}
                  <span className="text-[9px] font-black text-hc-muted ml-auto flex items-center gap-1">
                    <Users size={9} /> {h.uniqueStaff} staff · {h.uniqueClients} clients
                  </span>
                </div>

                {/* Nav arrow */}
                <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-all">
                  <ChevronRight size={14} className="text-hc-teal" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-8 border-t border-hc-border/10 flex items-center justify-between opacity-30">
        <div className="flex items-center gap-6">
          <Home size={16} className="text-hc-muted" />
          <Users size={16} className="text-hc-muted" />
          <Activity size={16} className="text-hc-muted" />
        </div>
        <div className="text-[8px] font-black text-hc-muted uppercase tracking-[0.4em]">Sovereign Empire Protocol · Quality sourced from Force Protection Engine</div>
      </div>
    </div>
  );
}
