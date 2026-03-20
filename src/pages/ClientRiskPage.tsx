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
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#22c55e';
      default: return '#7a95b0';
    }
  };

  const getRiskPill = (level: ClientRiskProfile['riskLevel']) => {
    switch (level) {
      case 'critical': return 'pill-red animate-pulse-soft';
      case 'high': return 'pill-amber';
      case 'medium': return 'pill-blue';
      case 'low': return 'pill-green';
      default: return 'pill-blue opacity-40';
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-2 tracking-tighter text-shimmer">Strategic Risk Stratification</h1>
        <div className="flex items-center gap-3">
          <span className="pill pill-purple text-[10px] font-black uppercase tracking-wider shadow-lg">Pattern Analytics Engine</span>
          <p className="text-hc-muted text-[10px] font-bold uppercase tracking-widest ml-1">
            Real-time vulnerability mapping across {stats.total} tactical nodes
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {[
          { label: 'Population', value: stats.total, color: '#7a95b0', pill: 'pill-blue opacity-40' },
          { label: 'Critical Breaches', value: stats.critical, color: '#ef4444', pill: 'pill-red animate-pulse-soft' },
          { label: 'High Risk Vectors', value: stats.high, color: '#f59e0b', pill: 'pill-amber' },
          { label: 'Moderate Alerts', value: stats.medium, color: '#3b82f6', pill: 'pill-blue' },
          { label: 'Secure Status', value: stats.low, color: '#22c55e', pill: 'pill-green' },
        ].map(s => (
          <div key={s.label} className="glass-light border border-white/5 rounded-[1.5rem] p-6 shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.05] group-hover:opacity-[0.1] transition-opacity blur-3xl -translate-y-1/2 translate-x-1/2" style={{ background: s.color }} />
            <div className="text-3xl font-black tabular-nums tracking-tighter shadow-lg" style={{ color: s.color, textShadow: `0 0 20px ${s.color}40` }}>{s.value}</div>
            <div className="section-header text-[9px] mt-2 opacity-60 tracking-[0.2em]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-8 bg-black/20 backdrop-blur-md rounded-2xl p-1.5 border border-white/5 shadow-2xl w-fit">
        {(['all', 'critical', 'high', 'medium'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all duration-500
              ${filter === f
                ? 'bg-hc-teal/20 text-hc-teal-light border-hc-teal/30 shadow-lg'
                : 'border-transparent text-hc-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {f === 'all' ? 'Entire Fleet' : `${f} Nodes`}
            {f !== 'all' && (
              <span className={`ml-3 px-2 py-0.5 rounded-lg tabular-nums ${filter === f ? 'bg-hc-teal/30' : 'bg-white/5 opacity-40'}`}>
                {stats[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Client List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredProfiles.length === 0 ? (
          <div className="text-center py-32 glass border border-white/5 rounded-[2.5rem] animate-in zoom-in duration-700">
            <div className="text-5xl mb-6 opacity-20 grayscale">📡</div>
            <div className="text-lg font-extrabold text-white mb-2 uppercase tracking-tight">Zero Matches in Matrix</div>
            <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">Adjust sensor parameters to restore visibility</div>
          </div>
        ) : (
          filteredProfiles.map((profile, idx) => (
            <div
              key={profile.name}
              onClick={() => setSelectedClient(profile)}
              className={`glass-light border transition-all duration-500 rounded-[2rem] p-6 cursor-pointer card-glow interactive-row group animate-in slide-in-from-bottom-4
                ${profile.riskLevel === 'critical' ? 'border-flag-red/30 bg-flag-red/[0.02] glow-red' : 'border-white/5 hover:border-hc-teal/30'}`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1 min-w-0">
                  {/* Risk Score Circle */}
                  <div className={`w-16 h-16 rounded-2xl glass border-2 flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 duration-500`}
                    style={{ borderColor: getRiskColor(profile.riskLevel) + '60', background: getRiskColor(profile.riskLevel) + '15' }}>
                    <span className="text-xl font-black tabular-nums tracking-tighter" style={{ color: getRiskColor(profile.riskLevel) }}>{profile.riskScore}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-1.5 flex-wrap">
                      <span className="text-xl font-black text-white group-hover:text-hc-teal-light transition-colors tracking-tighter uppercase leading-none">{profile.name}</span>
                      <span className={`pill ${getRiskPill(profile.riskLevel)} text-[9px] font-black px-3`}>
                        {profile.riskLevel} STRAT
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-60">{profile.house} Node</span>
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                      <span className="text-[10px] font-bold text-hc-teal-light/60 uppercase tracking-widest">Active Surveillance Protocol</span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center gap-8 px-8 md:border-x md:border-white/5 relative z-10">
                  {profile.redFlags > 0 && (
                    <div className="text-center group/stat">
                      <div className="text-xl font-black text-flag-red tabular-nums tracking-tighter group-hover/stat:scale-110 transition-transform">{profile.redFlags}</div>
                      <div className="section-header text-[8px] opacity-50 tracking-[0.2em]">RED</div>
                    </div>
                  )}
                  {profile.amberFlags > 0 && (
                    <div className="text-center group/stat">
                      <div className="text-xl font-black text-flag-amber tabular-nums tracking-tighter group-hover/stat:scale-110 transition-transform">{profile.amberFlags}</div>
                      <div className="section-header text-[8px] opacity-50 tracking-[0.2em]">AMB</div>
                    </div>
                  )}
                  {profile.medicationIssues > 0 && (
                    <div className="text-center group/stat">
                      <div className="text-xl font-black text-hc-blue tabular-nums tracking-tighter group-hover/stat:scale-110 transition-transform">{profile.medicationIssues}</div>
                      <div className="section-header text-[8px] opacity-50 tracking-[0.2em]">MED</div>
                    </div>
                  )}
                  {profile.safeguardingFlags > 0 && (
                    <div className="text-center group/stat">
                      <div className="text-xl font-black text-flag-red tabular-nums tracking-tighter group-hover/stat:scale-110 transition-transform">{profile.safeguardingFlags}</div>
                      <div className="section-header text-[8px] opacity-50 tracking-[0.2em]">S/G</div>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div className="w-10 h-10 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted group-hover:text-hc-teal-light group-hover:border-hc-teal/30 group-hover:translate-x-1 transition-all duration-500 shadow-xl">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>

              {/* Concerns Tags */}
              {profile.topConcerns.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6 pl-20 relative z-10">
                  <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.3em] mr-2 flex items-center">DETECTED CONCERNS:</span>
                  {profile.topConcerns.map((concern) => (
                    <span key={concern} className="text-[9px] font-black px-3 py-1 rounded-lg bg-black/40 text-hc-text/60 border border-white/5 uppercase tracking-widest group-hover:text-hc-text group-hover:border-hc-teal/20 transition-all">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setSelectedClient(null)}>
          <div className="glass border border-white/10 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.05] blur-[100px] -translate-y-1/2 translate-x-1/2`} style={{ background: getRiskColor(selectedClient.riskLevel) }} />
            
            <div className={`p-10 border-b border-white/5 relative z-10 ${selectedClient.riskLevel === 'critical' ? 'bg-flag-red/[0.03]' : ''}`}>
              <div className="flex items-start justify-between gap-8">
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tighter uppercase text-shimmer mb-2">{selectedClient.name}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-hc-muted uppercase tracking-[0.2em]">{selectedClient.house} Node</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    <span className="text-xs font-black text-hc-teal-light uppercase tracking-widest">In-Depth Stratification</span>
                  </div>
                </div>
                <div className={`px-8 py-6 rounded-3xl text-4xl font-black tabular-nums shadow-2xl shadow-black/40 border-2 ${getRiskPill(selectedClient.riskLevel)}`} style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  {selectedClient.riskScore}
                </div>
              </div>
            </div>

            <div className="p-10 space-y-10 relative z-10">
              {/* Risk Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'RED FLAGS', value: selectedClient.redFlags, color: '#ef4444' },
                  { label: 'ALERTS', value: selectedClient.amberFlags, color: '#f59e0b' },
                  { label: 'MED VECTORS', value: selectedClient.medicationIssues, color: '#3b82f6' },
                  { label: 'SAFEGUARD', value: selectedClient.safeguardingFlags, color: '#ef4444' },
                ].map(stat => (
                  <div key={stat.label} className="glass-light border border-white/5 rounded-2xl p-5 text-center shadow-inner group/sub">
                    <div className="text-3xl font-black tabular-nums tracking-tighter group-hover/sub:scale-110 transition-transform mb-1" style={{ color: stat.color }}>{stat.value}</div>
                    <div className="section-header text-[8px] opacity-50 tracking-[0.2em]">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Concerns */}
              {selectedClient.topConcerns.length > 0 && (
                <div className="animate-in slide-in-from-left-4 duration-700">
                  <h3 className="section-header text-[10px] font-black text-flag-red uppercase tracking-[0.3em] mb-5 flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-flag-red animate-pulse" />
                    Priority Intercepts
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {selectedClient.topConcerns.map((concern) => (
                      <span key={concern} className="pill pill-red text-[11px] font-black uppercase tracking-widest px-5 py-2 shadow-xl shadow-red-950/20 border-white/10">
                        {concern}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="animate-in slide-in-from-bottom-4 duration-700 delay-300">
                <h3 className="section-header text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] mb-5">Historical Telemetry</h3>
                <div className="space-y-3">
                  {selectedClient.recentEntries.map((entry) => (
                    <div key={entry.id} className="glass-light border border-white/5 rounded-2xl p-5 group/entry hover:bg-white/[0.03] transition-all interactive-row">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full shadow-lg ${
                            entry.severity === 'red' ? 'bg-flag-red glow-red animate-pulse' :
                            entry.severity === 'amber' ? 'bg-flag-amber glow-amber' :
                            'bg-flag-green shadow-flag-green/20'
                          }`} />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest group-hover/entry:text-hc-teal-light transition-colors">{entry.type}</span>
                        </div>
                        <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest tabular-nums opacity-40">{entry.date}</span>
                      </div>
                      <p className="text-[13px] text-hc-text font-medium leading-relaxed italic opacity-80 group-hover/entry:opacity-100 transition-opacity">"{entry.entry}"</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button
                  onClick={() => setSelectedClient(null)}
                  className="flex-1 btn-gradient rounded-2xl py-4 text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] transition-all"
                >
                  Confirm Strategic Read
                </button>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="px-10 glass-light border border-white/10 text-hc-muted py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:text-white transition-all shadow-xl"
                >
                  Abort
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
