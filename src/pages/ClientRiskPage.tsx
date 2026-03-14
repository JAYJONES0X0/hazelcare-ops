import { useMemo, useState } from 'react';
import type { WeekSummary } from '../lib/types';
import { generateRiskProfiles, getRiskStats, type ClientRiskProfile } from '../lib/risk-scores';

interface Props {
  weekData: WeekSummary | null;
}

export function ClientRiskPage({ weekData }: Props) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const [selectedClient, setSelectedClient] = useState<ClientRiskProfile | null>(null);

  const profiles = useMemo(() => generateRiskProfiles(weekData), [weekData]);
  const stats = useMemo(() => getRiskStats(profiles), [profiles]);

  const filteredProfiles = useMemo(() => {
    if (filter === 'all') return profiles;
    return profiles.filter(p => p.riskLevel === filter);
  }, [profiles, filter]);

  const getRiskColor = (level: ClientRiskProfile['riskLevel']) => {
    switch (level) {
      case 'critical': return 'text-flag-red border-flag-red/30 bg-flag-red/10';
      case 'high': return 'text-flag-amber border-flag-amber/30 bg-flag-amber/10';
      case 'medium': return 'text-hc-blue border-hc-blue/30 bg-hc-blue/10';
      case 'low': return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
    }
  };

  const getRiskBadge = (level: ClientRiskProfile['riskLevel']) => {
    switch (level) {
      case 'critical': return 'bg-flag-red/20 text-flag-red border-flag-red/30';
      case 'high': return 'bg-flag-amber/20 text-flag-amber border-flag-amber/30';
      case 'medium': return 'bg-hc-blue/20 text-hc-blue border-hc-blue/30';
      case 'low': return 'bg-emerald-400/20 text-emerald-400 border-emerald-400/30';
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">Client Risk Scores</h1>
        <p className="text-sm text-hc-muted">Auto-calculated from diary patterns and flags</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-hc-card rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-hc-muted">Total Clients</div>
        </div>
        <div className="bg-flag-red/10 rounded-xl p-4 border border-flag-red/20">
          <div className="text-2xl font-bold text-flag-red">{stats.critical}</div>
          <div className="text-xs text-flag-red/70">Critical Risk</div>
        </div>
        <div className="bg-flag-amber/10 rounded-xl p-4 border border-flag-amber/20">
          <div className="text-2xl font-bold text-flag-amber">{stats.high}</div>
          <div className="text-xs text-flag-amber/70">High Risk</div>
        </div>
        <div className="bg-hc-blue/10 rounded-xl p-4 border border-hc-blue/20">
          <div className="text-2xl font-bold text-hc-blue">{stats.medium}</div>
          <div className="text-xs text-hc-blue/70">Medium Risk</div>
        </div>
        <div className="bg-emerald-400/10 rounded-xl p-4 border border-emerald-400/20">
          <div className="text-2xl font-bold text-emerald-400">{stats.low}</div>
          <div className="text-xs text-emerald-400/70">Low Risk</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'critical', 'high', 'medium'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filter === f
                ? 'bg-hc-teal/20 text-hc-teal-light border-hc-teal/40'
                : 'bg-hc-card text-hc-muted border-white/5 hover:border-white/10'
            }`}
          >
            {f === 'all' ? 'All Clients' : `${f.charAt(0).toUpperCase() + f.slice(1)} Risk`}
            {f !== 'all' && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/10">
                {stats[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Client List */}
      <div className="space-y-2">
        {filteredProfiles.length === 0 ? (
          <div className="text-center py-12 text-hc-muted">
            <p>No clients match this filter</p>
          </div>
        ) : (
          filteredProfiles.map((profile) => (
            <div
              key={profile.name}
              onClick={() => setSelectedClient(profile)}
              className="bg-hc-card rounded-xl p-4 border border-white/5 hover:border-white/10 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Risk Score Circle */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${getRiskColor(profile.riskLevel)}`}>
                    <span className="text-sm font-bold">{profile.riskScore}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{profile.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getRiskBadge(profile.riskLevel)}`}>
                        {profile.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-hc-muted mt-0.5">{profile.house}</div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="hidden sm:flex items-center gap-4 text-xs">
                  {profile.redFlags > 0 && (
                    <div className="text-flag-red">
                      <span className="font-semibold">{profile.redFlags}</span> red
                    </div>
                  )}
                  {profile.amberFlags > 0 && (
                    <div className="text-flag-amber">
                      <span className="font-semibold">{profile.amberFlags}</span> amber
                    </div>
                  )}
                  {profile.medicationIssues > 0 && (
                    <div className="text-hc-blue">
                      <span className="font-semibold">{profile.medicationIssues}</span> med
                    </div>
                  )}
                  {profile.safeguardingFlags > 0 && (
                    <div className="text-flag-red">
                      <span className="font-semibold">{profile.safeguardingFlags}</span> SG
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <svg className="w-5 h-5 text-hc-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Concerns Tags */}
              {profile.topConcerns.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pl-16">
                  {profile.topConcerns.map((concern) => (
                    <span key={concern} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-hc-muted border border-white/5">
                      {concern}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-hc-card rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedClient.name}</h2>
                  <p className="text-sm text-hc-muted">{selectedClient.house}</p>
                </div>
                <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${getRiskBadge(selectedClient.riskLevel)}`}>
                  {selectedClient.riskLevel.toUpperCase()} RISK — {selectedClient.riskScore} pts
                </div>
              </div>

              {/* Risk Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-hc-darker rounded-lg p-3 border border-white/5">
                  <div className="text-lg font-semibold text-flag-red">{selectedClient.redFlags}</div>
                  <div className="text-[10px] text-hc-muted">Red Flags</div>
                </div>
                <div className="bg-hc-darker rounded-lg p-3 border border-white/5">
                  <div className="text-lg font-semibold text-flag-amber">{selectedClient.amberFlags}</div>
                  <div className="text-[10px] text-hc-muted">Amber Flags</div>
                </div>
                <div className="bg-hc-darker rounded-lg p-3 border border-white/5">
                  <div className="text-lg font-semibold text-hc-blue">{selectedClient.medicationIssues}</div>
                  <div className="text-[10px] text-hc-muted">Medication Issues</div>
                </div>
                <div className="bg-hc-darker rounded-lg p-3 border border-white/5">
                  <div className="text-lg font-semibold text-flag-red">{selectedClient.safeguardingFlags}</div>
                  <div className="text-[10px] text-hc-muted">Safeguarding</div>
                </div>
              </div>

              {/* Concerns */}
              {selectedClient.topConcerns.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Key Concerns</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedClient.topConcerns.map((concern) => (
                      <span key={concern} className="text-xs px-3 py-1.5 rounded-lg bg-flag-red/10 text-flag-red border border-flag-red/20">
                        {concern}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Recent Activity</h3>
                <div className="space-y-2">
                  {selectedClient.recentEntries.map((entry) => (
                    <div key={entry.id} className="bg-hc-darker rounded-lg p-3 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-hc-muted">{entry.date}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          entry.severity === 'red' ? 'bg-flag-red/20 text-flag-red' :
                          entry.severity === 'amber' ? 'bg-flag-amber/20 text-flag-amber' :
                          'bg-emerald-400/20 text-emerald-400'
                        }`}>
                          {entry.severity}
                        </span>
                      </div>
                      <p className="text-sm text-white line-clamp-2">{entry.entry}</p>
                      <div className="text-[10px] text-hc-muted mt-1">{entry.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelectedClient(null)}
                className="mt-6 w-full py-2.5 bg-hc-teal/20 text-hc-teal-light rounded-lg text-sm font-medium hover:bg-hc-teal/30 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
