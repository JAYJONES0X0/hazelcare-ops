import { useMemo } from 'react';
import type { WeekSummary, Action, Incident } from '../lib/types';
import type { Page } from '../App';
import { detectTrends } from '../lib/trends';

interface Props {
  weekData: WeekSummary | null;
  actions: Action[];
  incidents: Incident[];
  setPage: (p: Page) => void;
}

export function BriefingPage({ weekData, actions, incidents, setPage }: Props) {
  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="w-16 h-16 rounded-2xl bg-hc-card border border-hc-border flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-hc-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">No Data for Briefing</h2>
        <p className="text-hc-muted text-sm mb-4 text-center">Import data to generate your morning briefing.</p>
        <button onClick={() => setPage('upload')} className="px-5 py-2 bg-hc-teal text-white text-sm font-semibold rounded-xl hover:bg-hc-teal-light">Import Data</button>
      </div>
    );
  }

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const redFlags = weekData.allFlags.red;
  const amberFlags = weekData.allFlags.amber;
  const houseList = Object.values(weekData.houses).sort((a, b) => (b.flags.red * 10 + b.flags.amber) - (a.flags.red * 10 + a.flags.amber));

  const overdueActions = actions.filter(a => a.status !== 'completed' && a.priority === 'critical');
  const openActions = actions.filter(a => a.status === 'open' || a.status === 'in_progress');
  const activeIncidents = incidents.filter(i => i.stage !== 'closed' && i.stage !== 'resolved');

  // Trend detection
  const allEntries = useMemo(() => Object.values(weekData.houses).flatMap(h => h.entries), [weekData]);
  const trends = useMemo(() => detectTrends(allEntries), [allEntries]);

  // Houses that need attention (have red flags)
  const hotHouses = houseList.filter(h => h.flags.red > 0);
  // Houses all clear
  const clearHouses = houseList.filter(h => h.flags.red === 0 && h.flags.amber === 0);

  // Severity score
  const severityScore = Math.max(0, 100 - (redFlags.length * 8) - (amberFlags.length * 3) - (overdueActions.length * 5));
  const scoreColor = severityScore >= 80 ? '#22c55e' : severityScore >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = severityScore >= 80 ? 'Stable' : severityScore >= 50 ? 'Attention Needed' : 'Critical';

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="text-hc-muted text-xs mb-1">{dateStr}</div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">{greeting}</h1>
        <p className="text-hc-muted text-sm">Here's what needs your attention today across {houseList.length} houses.</p>
      </div>

      {/* Operations Score */}
      <div className="bg-hc-card border border-hc-border rounded-xl p-5 mb-4 flex items-center gap-5">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1e3050" strokeWidth="3" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={scoreColor} strokeWidth="3" strokeDasharray={`${severityScore}, 100`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold" style={{ color: scoreColor }}>{severityScore}</span>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-white mb-0.5">Operations Score: <span style={{ color: scoreColor }}>{scoreLabel}</span></div>
          <div className="text-xs text-hc-muted">
            {redFlags.length} red flags · {amberFlags.length} amber flags · {overdueActions.length} critical actions · {activeIncidents.length} active incidents
          </div>
        </div>
      </div>

      {/* Immediate Attention */}
      {(redFlags.length > 0 || overdueActions.length > 0) && (
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-flag-red uppercase tracking-wider mb-2">Immediate Attention</h2>
          <div className="space-y-2">
            {redFlags.slice(0, 5).map((flag, i) => (
              <div key={`rf${i}`} className="bg-flag-red/5 border border-flag-red/20 rounded-xl p-3.5 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-flag-red mt-1.5 shrink-0 dot-pulse" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-white">{flag.house}</span>
                    {flag.client && <span className="text-[10px] text-hc-teal-light">{flag.client}</span>}
                  </div>
                  <p className="text-xs text-hc-text line-clamp-2">{flag.entry}</p>
                  <div className="flex gap-1 mt-1.5">
                    {flag.flags.map((f, fi) => (
                      <span key={fi} className="text-[9px] px-1.5 py-0.5 rounded bg-flag-red/10 text-flag-red border border-flag-red/15">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {overdueActions.map((action, i) => (
              <div key={`oa${i}`} className="bg-flag-red/5 border border-flag-red/20 rounded-xl p-3.5 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-hc-blue mt-1.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">{action.title}</div>
                  <div className="text-[10px] text-hc-muted">{action.house} · {action.owner} · Due: {action.dueDate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monitor */}
      {amberFlags.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-flag-amber uppercase tracking-wider mb-2">Monitor Today</h2>
          <div className="space-y-1.5">
            {amberFlags.slice(0, 5).map((flag, i) => (
              <div key={`af${i}`} className="bg-hc-card border border-flag-amber/15 rounded-xl p-3 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-flag-amber mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-white">{flag.house}</span>
                    <span className="text-[10px] text-hc-muted">{flag.client}</span>
                  </div>
                  <p className="text-[11px] text-hc-text line-clamp-2">{flag.entry}</p>
                </div>
              </div>
            ))}
            {amberFlags.length > 5 && (
              <div className="text-[11px] text-hc-muted text-center py-1">+ {amberFlags.length - 5} more amber items</div>
            )}
          </div>
        </div>
      )}

      {/* Trends & Patterns */}
      {trends.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-hc-blue uppercase tracking-wider mb-2">
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Trends & Patterns ({trends.length})
            </span>
          </h2>
          <div className="space-y-1.5">
            {trends.map(trend => (
              <div
                key={trend.id}
                className={`rounded-xl p-3.5 flex items-start gap-3 border ${
                  trend.severity === 'critical'
                    ? 'bg-flag-red/5 border-flag-red/20'
                    : trend.severity === 'warning'
                    ? 'bg-flag-amber/5 border-flag-amber/15'
                    : 'bg-hc-blue/5 border-hc-blue/15'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  trend.severity === 'critical'
                    ? 'bg-flag-red/15'
                    : trend.severity === 'warning'
                    ? 'bg-flag-amber/15'
                    : 'bg-hc-blue/15'
                }`}>
                  {trend.severity === 'critical' ? (
                    <svg className="w-3.5 h-3.5 text-flag-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  ) : trend.severity === 'warning' ? (
                    <svg className="w-3.5 h-3.5 text-flag-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-hc-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-white">{trend.title}</span>
                    {trend.metric && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                        trend.severity === 'critical'
                          ? 'bg-flag-red/10 text-flag-red border-flag-red/20'
                          : trend.severity === 'warning'
                          ? 'bg-flag-amber/10 text-flag-amber border-flag-amber/20'
                          : 'bg-hc-blue/10 text-hc-blue border-hc-blue/20'
                      }`}>{trend.metric}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-hc-muted leading-relaxed">{trend.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* House Status */}
      <div className="mb-4">
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">House Status</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {houseList.map(house => {
            const hasRed = house.flags.red > 0;
            const hasAmber = house.flags.amber > 0;
            return (
              <div key={house.name} className={`bg-hc-card border rounded-xl p-3 text-center ${hasRed ? 'border-flag-red/25' : hasAmber ? 'border-flag-amber/25' : 'border-hc-border'}`}>
                <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${hasRed ? 'bg-flag-red dot-pulse' : hasAmber ? 'bg-flag-amber' : 'bg-flag-green'}`} />
                <div className="text-[11px] font-semibold text-white truncate">{house.name.replace(' House', '')}</div>
                <div className="text-[10px] text-hc-muted">{house.entries.length} entries</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <button onClick={() => setPage('actions')} className="bg-hc-card border border-hc-border rounded-xl p-3 text-left hover:border-hc-border-light transition-all">
          <div className="text-xl font-bold text-hc-blue">{openActions.length}</div>
          <div className="text-[10px] text-hc-muted">Open Actions</div>
        </button>
        <button onClick={() => setPage('incidents')} className="bg-hc-card border border-hc-border rounded-xl p-3 text-left hover:border-hc-border-light transition-all">
          <div className="text-xl font-bold text-hc-purple">{activeIncidents.length}</div>
          <div className="text-[10px] text-hc-muted">Active Incidents</div>
        </button>
        <div className="bg-hc-card border border-hc-border rounded-xl p-3">
          <div className="text-xl font-bold text-flag-green">{clearHouses.length}</div>
          <div className="text-[10px] text-hc-muted">Houses All Clear</div>
        </div>
        <div className="bg-hc-card border border-hc-border rounded-xl p-3">
          <div className="text-xl font-bold text-flag-red">{hotHouses.length}</div>
          <div className="text-[10px] text-hc-muted">Houses Flagged</div>
        </div>
      </div>

      {/* Quick Nav */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPage('dashboard')} className="px-4 py-2 bg-hc-teal text-white text-xs font-semibold rounded-xl hover:bg-hc-teal-light">Full Dashboard</button>
        <button onClick={() => setPage('templates')} className="px-4 py-2 bg-hc-card border border-hc-border text-xs text-hc-muted rounded-xl hover:text-white">Generate Report</button>
        <button onClick={() => setPage('notes')} className="px-4 py-2 bg-hc-card border border-hc-border text-xs text-hc-muted rounded-xl hover:text-white">Write Note</button>
      </div>
    </div>
  );
}
