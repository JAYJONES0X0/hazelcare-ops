import { useMemo, useState } from 'react';
import type { WeekSummary } from '../lib/types';
import { generateRiskProfiles, getRiskStats, type ClientRiskProfile } from '../lib/risk-scores';

interface Props {
  weekData: WeekSummary | null;
}

export function RiskScoresPage({ weekData }: Props) {
  const [filterLevel, setFilterLevel] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [selectedClient, setSelectedClient] = useState<ClientRiskProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const profiles = useMemo(() => generateRiskProfiles(weekData), [weekData]);
  const stats = useMemo(() => getRiskStats(profiles), [profiles]);

  const filteredProfiles = useMemo(() => {
    let filtered = profiles;
    if (filterLevel !== 'all') {
      filtered = filtered.filter(p => p.riskLevel === filterLevel);
    }
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.house.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  }, [profiles, filterLevel, searchTerm]);

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
      case 'critical': return 'bg-flag-red text-white';
      case 'high': return 'bg-flag-amber text-black';
      case 'medium': return 'bg-hc-blue text-white';
      case 'low': return 'bg-emerald-500 text-white';
    }
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white mb-1">Client Risk Scores</h1>
        <p className="text-sm text-hc-muted">Auto-calculated from diary patterns and flags</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-hc-card border border-hc-border rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-hc-muted">Total Clients</div>
        </div>
        <div className="bg-flag-red/10 border border-flag-red/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-flag-red">{stats.critical}</div>
          <div className="text-xs text-flag-red/70">Critical Risk</div>
        </div>
        <div className="bg-flag-amber/10 border border-flag-amber/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-flag-amber">{stats.high}</div>
          <div className="text-xs text-flag-amber/70">High Risk</div>
        </div>
        <div className="bg-hc-blue/10 border border-hc-blue/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-hc-blue">{stats.medium}</div>
          <div className="text-xs text-hc-blue/70">Medium Risk</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">{stats.low}</div>
          <div className="text-xs text-emerald-400/70">Low Risk</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterLevel === level
                  ? level === 'all' ? 'bg-white text-hc-darker' : getRiskBadge(level)
                  : 'bg-hc-card border border-hc-border text-hc-muted hover:text-white'
              }`}
            >
              {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
              {level !== 'all' && (
                <span className="ml-1.5 opacity-70">
                  {stats[level as keyof typeof stats]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search client or house..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-hc-card border border-hc-border rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-hc-muted focus:outline-none focus:border-hc-teal"
          />
        </div>
      </div>

      {/* Client List */}
      <div className="space-y-2">
        {filteredProfiles.length === 0 ? (
          <div className="text-center py-12 text-hc-muted">
            <p>No clients match the selected filters</p>
          </div>
        ) : (
          filteredProfiles.map(client => (
            <div
              key={client.name}
              onClick={() => setSelectedClient(client)}
              className={`bg-hc-card border rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] ${
                getRiskColor(client.riskLevel)
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${getRiskBadge(client.riskLevel)}`}>
                    {client.riskScore}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{client.name}</div>
                    <div className="text-xs text-hc-muted">{client.house}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  {client.redFlags > 0 && (
                    <div className="flex items-center gap-1 text-flag-red">
                      <span className="w-2 h-2 rounded-full bg-flag-red" />
                      {client.redFlags} red
                    </div>
                  )}
                  {client.amberFlags > 0 && (
                    <div className="flex items-center gap-1 text-flag-amber">
                      <span className="w-2 h-2 rounded-full bg-flag-amber" />
                      {client.amberFlags} amber
                    </div>
                  )}
                  {client.medicationIssues > 0 && (
                    <div className="flex items-center gap-1 text-hc-blue">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      {client.medicationIssues} med
                    </div>
                  )}
                  {client.safeguardingFlags > 0 && (
                    <div className="flex items-center gap-1 text-flag-red">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Safeguarding
                    </div>
                  )}
                </div>
              </div>

              {/* Concerns */}
              {client.topConcerns.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {client.topConcerns.map((concern, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80"
                    >
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
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedClient(null)}
        >
          <div
            className="bg-hc-card border border-hc-border rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-6 border-b ${getRiskColor(selectedClient.riskLevel)}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedClient.name}</h2>
                  <p className="text-sm text-hc-muted">{selectedClient.house}</p>
                </div>
                <div className={`px-3 py-1 rounded-lg text-sm font-bold ${getRiskBadge(selectedClient.riskLevel)}`}>
                  {selectedClient.riskLevel.toUpperCase()} — {selectedClient.riskScore}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Risk Breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-hc-muted uppercase tracking-wider mb-3">Risk Factors</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-hc-darker rounded-lg p-3">
                    <div className="text-lg font-bold text-flag-red">{selectedClient.redFlags}</div>
                    <div className="text-xs text-hc-muted">Red Flags</div>
                  </div>
                  <div className="bg-hc-darker rounded-lg p-3">
                    <div className="text-lg font-bold text-flag-amber">{selectedClient.amberFlags}</div>
                    <div className="text-xs text-hc-muted">Amber Flags</div>
                  </div>
                  <div className="bg-hc-darker rounded-lg p-3">
                    <div className="text-lg font-bold text-hc-blue">{selectedClient.medicationIssues}</div>
                    <div className="text-xs text-hc-muted">Medication Issues</div>
                  </div>
                  <div className="bg-hc-darker rounded-lg p-3">
                    <div className="text-lg font-bold text-flag-red">{selectedClient.safeguardingFlags}</div>
                    <div className="text-xs text-hc-muted">Safeguarding Flags</div>
                  </div>
                </div>
              </div>

              {/* Concerns */}
              {selectedClient.topConcerns.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-hc-muted uppercase tracking-wider mb-2">Key Concerns</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedClient.topConcerns.map((concern, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-lg bg-flag-red/10 text-flag-red border border-flag-red/20">
                        {concern}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div>
                <h3 className="text-xs font-semibold text-hc-muted uppercase tracking-wider mb-3">Recent Activity</h3>
                <div className="space-y-2">
                  {selectedClient.recentEntries.map((entry, i) => (
                    <div key={i} className="bg-hc-darker rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          entry.severity === 'red' ? 'bg-flag-red' :
                          entry.severity === 'amber' ? 'bg-flag-amber' :
                          entry.severity === 'green' ? 'bg-emerald-500' :
                          'bg-hc-muted'
                        }`} />
                        <span className="text-white font-medium">{entry.type}</span>
                        <span className="text-hc-muted text-xs">{entry.date}</span>
                      </div>
                      <p className="text-hc-muted text-xs line-clamp-2">{entry.entry}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedClient(null)}
                  className="flex-1 bg-hc-teal text-white py-2.5 rounded-lg text-sm font-medium hover:bg-hc-teal-light transition-colors"
                >
                  Create Action
                </button>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="flex-1 bg-hc-card border border-hc-border text-white py-2.5 rounded-lg text-sm font-medium hover:bg-hc-border transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
