import type { WeekSummary, NourishEntry } from '../lib/types';
import type { Page } from '../App';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
}

function FlagBadge({ severity, text }: { severity: string; text: string }) {
  const colors = {
    red: 'bg-flag-red/15 text-flag-red border-flag-red/30',
    amber: 'bg-flag-amber/15 text-flag-amber border-flag-amber/30',
    green: 'bg-flag-green/15 text-flag-green border-flag-green/30',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${colors[severity as keyof typeof colors] || colors.green}`}>
      {text}
    </span>
  );
}

function FlagCard({ entry }: { entry: NourishEntry }) {
  return (
    <div className={`p-3 rounded-lg border ${
      entry.severity === 'red'
        ? 'bg-flag-red/5 border-flag-red/20'
        : 'bg-flag-amber/5 border-flag-amber/20'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-white">{entry.house}</span>
        <FlagBadge severity={entry.severity} text={entry.severity.toUpperCase()} />
      </div>
      {entry.client && <div className="text-[11px] text-hc-teal-light mb-1">{entry.client}</div>}
      <p className="text-xs text-hc-text leading-relaxed line-clamp-3">{entry.entry}</p>
      <div className="flex items-center gap-2 mt-2">
        {entry.flags.map((f, i) => (
          <FlagBadge key={i} severity={entry.severity} text={f} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-hc-muted">
        {entry.date && <span>{entry.date}</span>}
        {entry.type && <span>{entry.type}</span>}
        {entry.carer && entry.carer !== 'Staff' && <span>{entry.carer}</span>}
      </div>
    </div>
  );
}

export function Dashboard({ weekData, setPage }: Props) {
  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-xl font-bold text-white mb-2">No Data Loaded</h2>
        <p className="text-hc-muted text-sm mb-6 text-center max-w-md">
          Import Nourish Client Diary data to see your week at a glance — flags, house summaries, and actionable insights.
        </p>
        <button
          onClick={() => setPage('upload')}
          className="px-6 py-2.5 bg-hc-teal text-white text-sm font-semibold rounded-lg hover:bg-hc-teal-light transition-colors"
        >
          Import Data
        </button>
      </div>
    );
  }

  const houseList = Object.values(weekData.houses).sort((a, b) => {
    const aScore = a.flags.red * 10 + a.flags.amber;
    const bScore = b.flags.red * 10 + b.flags.amber;
    return bScore - aScore;
  });

  const totalRed = weekData.allFlags.red.length;
  const totalAmber = weekData.allFlags.amber.length;
  const totalGreen = weekData.totalEntries - totalRed - totalAmber;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Week Overview</h1>
        <p className="text-hc-muted text-sm">
          {weekData.dateFrom && weekData.dateTo
            ? `${weekData.dateFrom} — ${weekData.dateTo}`
            : 'Date range not available'}
          {' · '}{weekData.totalEntries} entries across {houseList.length} houses
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <div className="bg-hc-card border border-hc-border rounded-lg p-4">
          <div className="text-xs text-hc-muted mb-1">Total Entries</div>
          <div className="text-2xl font-bold text-white">{weekData.totalEntries}</div>
        </div>
        <div className="bg-hc-card border border-flag-red/30 rounded-lg p-4">
          <div className="text-xs text-flag-red mb-1">Red Flags</div>
          <div className="text-2xl font-bold text-flag-red">{totalRed}</div>
        </div>
        <div className="bg-hc-card border border-flag-amber/30 rounded-lg p-4">
          <div className="text-xs text-flag-amber mb-1">Amber Flags</div>
          <div className="text-2xl font-bold text-flag-amber">{totalAmber}</div>
        </div>
        <div className="bg-hc-card border border-flag-green/30 rounded-lg p-4">
          <div className="text-xs text-flag-green mb-1">Routine</div>
          <div className="text-2xl font-bold text-flag-green">{totalGreen}</div>
        </div>
        <div className="bg-hc-card border border-hc-border rounded-lg p-4">
          <div className="text-xs text-hc-muted mb-1">Houses</div>
          <div className="text-2xl font-bold text-white">{houseList.length}</div>
        </div>
      </div>

      {/* Flagged Items */}
      {(totalRed > 0 || totalAmber > 0) && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            Flagged Items
            <span className="text-xs text-hc-muted font-normal ml-2">Requires attention</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {weekData.allFlags.red.map((entry, i) => (
              <FlagCard key={`r${i}`} entry={entry} />
            ))}
            {weekData.allFlags.amber.map((entry, i) => (
              <FlagCard key={`a${i}`} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* House Cards */}
      <h2 className="text-lg font-semibold text-white mb-3">Houses</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {houseList.map(house => (
          <div key={house.name} className="bg-hc-card border border-hc-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-white">{house.name}</div>
                {house.coordinator && (
                  <div className="text-[11px] text-hc-muted">{house.coordinator}</div>
                )}
              </div>
              <div className="flex gap-1.5">
                {house.flags.red > 0 && (
                  <span className="bg-flag-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {house.flags.red} red
                  </span>
                )}
                {house.flags.amber > 0 && (
                  <span className="bg-flag-amber text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {house.flags.amber} amber
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Entries', count: house.entries.length },
                { label: 'Incidents', count: house.incidents.length },
                { label: 'Safeguard', count: house.safeguarding.length },
                { label: 'Medication', count: house.medication.length },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-sm font-bold text-white">{s.count}</div>
                  <div className="text-[9px] text-hc-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {(house.incidents.length > 0 || house.safeguarding.length > 0) && (
              <div className="mt-3 pt-3 border-t border-hc-border space-y-1.5">
                {house.incidents.slice(0, 2).map((e, i) => (
                  <div key={i} className="text-[11px] text-hc-text truncate">
                    <span className="text-flag-red mr-1">●</span> {e.entry}
                  </div>
                ))}
                {house.safeguarding.slice(0, 2).map((e, i) => (
                  <div key={i} className="text-[11px] text-hc-text truncate">
                    <span className="text-flag-amber mr-1">●</span> {e.entry}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Entry Type Breakdown */}
      <h2 className="text-lg font-semibold text-white mb-3">Entry Types</h2>
      <div className="bg-hc-card border border-hc-border rounded-lg p-4 mb-6">
        <div className="space-y-2">
          {Object.entries(weekData.entryTypes)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => {
              const pct = Math.round((count / weekData.totalEntries) * 100);
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs text-hc-muted w-40 truncate">{type || 'Unknown'}</span>
                  <div className="flex-1 h-2 bg-hc-dark rounded-full overflow-hidden">
                    <div
                      className="h-full bg-hc-teal rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-white w-12 text-right">{count}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setPage('templates')}
          className="px-5 py-2.5 bg-hc-teal text-white text-sm font-semibold rounded-lg hover:bg-hc-teal-light transition-colors"
        >
          Generate Templates
        </button>
        <button
          onClick={() => setPage('upload')}
          className="px-5 py-2.5 bg-hc-card border border-hc-border text-hc-muted text-sm rounded-lg hover:text-white hover:border-white/20 transition-colors"
        >
          Import More Data
        </button>
      </div>
    </div>
  );
}
