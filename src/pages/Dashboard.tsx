import type { WeekSummary, Action, Incident } from '../lib/types';
import type { Page } from '../App';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
  actions: Action[];
  incidents: Incident[];
}

function StatCard({ label, value, sub, color, glow }: { label: string; value: string | number; sub?: string; color: string; glow?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-hc-border bg-hc-card p-5 ${glow || ''}`}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.04]" style={{ background: color, filter: 'blur(30px)', transform: 'translate(30%, -30%)' }} />
      <div className="text-[11px] font-medium text-hc-muted mb-1">{label}</div>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-hc-muted mt-1">{sub}</div>}
    </div>
  );
}

export function Dashboard({ weekData, setPage, actions, incidents }: Props) {
  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="w-20 h-20 rounded-2xl bg-hc-card border border-hc-border flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-hc-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Welcome to Ops Engine</h2>
        <p className="text-hc-muted text-sm mb-6 text-center max-w-md">
          Import Nourish diary data or load demo data to see your operations at a glance.
        </p>
        <button onClick={() => setPage('upload')} className="px-6 py-2.5 bg-hc-teal text-white text-sm font-semibold rounded-xl hover:bg-hc-teal-light transition-colors">
          Import Data
        </button>
      </div>
    );
  }

  const houseList = Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber));
  const totalRed = weekData.allFlags.red.length;
  const totalAmber = weekData.allFlags.amber.length;
  const totalGreen = weekData.totalEntries - totalRed - totalAmber;
  const openActions = actions.filter(a => a.status !== 'completed').length;
  const criticalActions = actions.filter(a => a.priority === 'critical' && a.status !== 'completed').length;
  const activeIncidents = incidents.filter(i => i.stage !== 'closed' && i.stage !== 'resolved').length;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Operations Dashboard</h1>
          <p className="text-hc-muted text-sm">
            {weekData.dateFrom && weekData.dateTo ? `${weekData.dateFrom} — ${weekData.dateTo}` : 'Current period'}
            <span className="mx-2 text-hc-border">|</span>
            {weekData.totalEntries} entries across {houseList.length} houses
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPage('templates')} className="px-4 py-2 bg-hc-card border border-hc-border text-sm text-hc-muted rounded-xl hover:text-white hover:border-hc-border-light">
            Generate Report
          </button>
          <button onClick={() => setPage('upload')} className="px-4 py-2 bg-hc-teal text-white text-sm font-semibold rounded-xl hover:bg-hc-teal-light">
            Import Data
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total Entries" value={weekData.totalEntries} sub={`${houseList.length} houses`} color="#14b8a6" />
        <StatCard label="Red Flags" value={totalRed} sub="Immediate attention" color="#ef4444" glow={totalRed > 0 ? 'glow-red' : ''} />
        <StatCard label="Amber Flags" value={totalAmber} sub="Monitor" color="#f59e0b" glow={totalAmber > 0 ? 'glow-amber' : ''} />
        <StatCard label="Routine" value={totalGreen} sub="Business as usual" color="#22c55e" />
        <StatCard label="Open Actions" value={openActions} sub={criticalActions > 0 ? `${criticalActions} critical` : 'On track'} color="#3b82f6" />
        <StatCard label="Active Incidents" value={activeIncidents} sub="In pipeline" color="#8b5cf6" />
      </div>

      {/* Two columns: Flags + Houses */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Flagged Items — left col (2/5) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Flagged Items</h2>
            <span className="text-[10px] text-hc-muted">{totalRed + totalAmber} total</span>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {weekData.allFlags.red.map((entry, i) => (
              <div key={`r${i}`} className="bg-hc-card border border-flag-red/20 rounded-xl p-3.5 hover:border-flag-red/40 transition-all">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-white">{entry.house}</span>
                  <span className="shrink-0 bg-flag-red/15 text-flag-red text-[10px] font-bold px-2 py-0.5 rounded-full border border-flag-red/20">RED</span>
                </div>
                {entry.client && <div className="text-[11px] text-hc-teal-light mb-1">{entry.client}</div>}
                <p className="text-xs text-hc-text leading-relaxed line-clamp-2">{entry.entry}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.flags.map((f, fi) => (
                    <span key={fi} className="text-[9px] px-1.5 py-0.5 rounded bg-flag-red/10 text-flag-red border border-flag-red/20">{f}</span>
                  ))}
                </div>
              </div>
            ))}
            {weekData.allFlags.amber.map((entry, i) => (
              <div key={`a${i}`} className="bg-hc-card border border-flag-amber/20 rounded-xl p-3.5 hover:border-flag-amber/40 transition-all">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-white">{entry.house}</span>
                  <span className="shrink-0 bg-flag-amber/15 text-flag-amber text-[10px] font-bold px-2 py-0.5 rounded-full border border-flag-amber/20">AMBER</span>
                </div>
                {entry.client && <div className="text-[11px] text-hc-teal-light mb-1">{entry.client}</div>}
                <p className="text-xs text-hc-text leading-relaxed line-clamp-2">{entry.entry}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.flags.map((f, fi) => (
                    <span key={fi} className="text-[9px] px-1.5 py-0.5 rounded bg-flag-amber/10 text-flag-amber border border-flag-amber/20">{f}</span>
                  ))}
                </div>
              </div>
            ))}
            {totalRed + totalAmber === 0 && (
              <div className="text-center py-8 text-hc-muted text-sm">No flagged items this period</div>
            )}
          </div>
        </div>

        {/* Houses Grid — right col (3/5) */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Houses</h2>
            <span className="text-[10px] text-hc-muted">{houseList.length} active</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {houseList.map(house => {
              const hasRed = house.flags.red > 0;
              const hasAmber = house.flags.amber > 0;
              return (
                <div
                  key={house.name}
                  className={`bg-hc-card border rounded-xl p-4 hover:bg-hc-card-hover transition-all ${
                    hasRed ? 'border-flag-red/25' : hasAmber ? 'border-flag-amber/25' : 'border-hc-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <div className="text-sm font-semibold text-white">{house.name}</div>
                      {house.coordinator && <div className="text-[10px] text-hc-muted">{house.coordinator}</div>}
                    </div>
                    <div className="flex gap-1">
                      {hasRed && <span className="bg-flag-red text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{house.flags.red}</span>}
                      {hasAmber && <span className="bg-flag-amber text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{house.flags.amber}</span>}
                    </div>
                  </div>

                  {/* Mini stats */}
                  <div className="grid grid-cols-4 gap-1 mb-2.5">
                    {[
                      { n: house.entries.length, l: 'Total', c: '#c8d6e5' },
                      { n: house.incidents.length, l: 'Incidents', c: '#ef4444' },
                      { n: house.safeguarding.length, l: 'Safeguard', c: '#f59e0b' },
                      { n: house.medication.length, l: 'Meds', c: '#14b8a6' },
                    ].map(s => (
                      <div key={s.l} className="text-center">
                        <div className="text-sm font-bold" style={{ color: s.c }}>{s.n}</div>
                        <div className="text-[8px] text-hc-muted">{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Severity bar */}
                  <div className="h-1.5 rounded-full bg-hc-dark overflow-hidden flex">
                    {house.flags.red > 0 && <div className="h-full bg-flag-red" style={{ width: `${(house.flags.red / house.entries.length) * 100}%` }} />}
                    {house.flags.amber > 0 && <div className="h-full bg-flag-amber" style={{ width: `${(house.flags.amber / house.entries.length) * 100}%` }} />}
                    <div className="h-full bg-flag-green flex-1" />
                  </div>

                  {/* Latest notable entry */}
                  {(house.incidents.length > 0 || house.safeguarding.length > 0) && (
                    <div className="mt-2.5 pt-2.5 border-t border-hc-border">
                      {house.incidents.slice(0, 1).map((e, i) => (
                        <div key={i} className="text-[11px] text-hc-text line-clamp-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-flag-red mr-1.5 align-middle" />
                          {e.entry}
                        </div>
                      ))}
                      {house.incidents.length === 0 && house.safeguarding.slice(0, 1).map((e, i) => (
                        <div key={i} className="text-[11px] text-hc-text line-clamp-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-flag-amber mr-1.5 align-middle" />
                          {e.entry}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row: Entry types + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry type breakdown */}
        <div className="lg:col-span-2 bg-hc-card border border-hc-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Entry Types</h2>
          <div className="space-y-2.5">
            {Object.entries(weekData.entryTypes)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([type, count]) => {
                const pct = Math.round((count / weekData.totalEntries) * 100);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-[11px] text-hc-muted w-36 truncate">{type || 'Other'}</span>
                    <div className="flex-1 h-1.5 bg-hc-dark rounded-full overflow-hidden">
                      <div className="h-full rounded-full progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-white w-8 text-right font-medium">{count}</span>
                    <span className="text-[10px] text-hc-muted w-8">{pct}%</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
          {[
            { label: 'Generate Meeting Report', desc: 'Quality & Performance template', icon: '📋', page: 'templates' as Page },
            { label: 'Review Open Actions', desc: `${openActions} items need attention`, icon: '📌', page: 'actions' as Page },
            { label: 'Incident Pipeline', desc: `${activeIncidents} active incidents`, icon: '🚨', page: 'incidents' as Page },
            { label: 'Import More Data', desc: 'Nourish, Teams, or manual', icon: '📥', page: 'upload' as Page },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => setPage(item.page)}
              className="w-full flex items-center gap-3 bg-hc-card border border-hc-border rounded-xl p-3.5 hover:bg-hc-card-hover hover:border-hc-border-light transition-all text-left"
            >
              <div className="text-xl">{item.icon}</div>
              <div>
                <div className="text-xs font-semibold text-white">{item.label}</div>
                <div className="text-[10px] text-hc-muted">{item.desc}</div>
              </div>
              <svg className="w-4 h-4 text-hc-muted ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
