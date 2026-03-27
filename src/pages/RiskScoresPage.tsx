import { useMemo, useState } from 'react';
import type { WeekSummary } from '../lib/types';
import { generateRiskProfiles, getRiskStats, type ClientRiskProfile } from '../lib/risk-scores';

interface Props {
  weekData: WeekSummary | null;
}

export function RiskScoresPage({ weekData }: Props) {
  const [filterLevel, setFilterLevel] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientRiskProfile | null>(null);

  const profiles = useMemo(() => weekData ? generateRiskProfiles(weekData) : [], [weekData]);
  const stats = useMemo(() => getRiskStats(profiles), [profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchesLevel = filterLevel === 'all' || p.riskLevel === filterLevel;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.house.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }, [profiles, filterLevel, searchTerm]);

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-2xl glass border border-hc-teal/20 flex items-center justify-center mb-8 glow-teal animate-float">
          <svg className="w-12 h-12 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3 text-gradient">Risk Scores</h2>
        <p className="text-hc-muted text-sm mb-8 text-center max-w-xs leading-relaxed">Import care data to generate risk profiles and scores for each person.</p>
      </div>
    );
  }

  function getRiskPill(level: string) {
    switch (level) {
      case 'critical': return 'pill-red';
      case 'high': return 'pill-amber';
      case 'medium': return 'pill-blue';
      default: return 'pill-green';
    }
  }

  function getRiskBorder(level: string) {
    switch (level) {
      case 'critical': return 'border-flag-red/30 glow-red shadow-flag-red/5 bg-flag-red/[0.02]';
      case 'high': return 'border-flag-amber/25 glow-amber shadow-flag-amber/5 bg-flag-amber/[0.01]';
      default: return 'border-white/5 hover:border-hc-teal/30';
    }
  }

  return (
    <div className="p-6 lg:p-10 w-full max-w-[1700px] mx-auto animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white mb-1 tracking-tight text-shimmer uppercase leading-none">Risk Overview</h1>
          <div className="flex items-center gap-3">
            <span className="pill pill-amber text-xs font-black uppercase tracking-[0.08em] shadow-lg">Risk Levels</span>
            <p className="text-hc-muted text-sm font-semibold uppercase tracking-[0.08em] ml-1">
              Reviewing risk levels across all people
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-6 mb-10 glass-light border border-white/5 p-6 rounded-[2rem] shadow-2xl backdrop-blur-xl">
        <div className="flex gap-2 flex-wrap items-center relative z-10">
          <span className="section-header text-xs mr-2 opacity-90 tracking-[0.08em]">Risk Stratification</span>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.08em] transition-all duration-500 ease-out active:scale-90 ${
                filterLevel === level
                  ? level === 'all' ? 'bg-hc-teal/20 text-hc-teal-light border border-hc-teal/30 shadow-lg scale-105' : `pill ${getRiskPill(level)} shadow-xl scale-105 z-10`
                  : 'bg-white/5 text-hc-muted hover:text-white hover:bg-white/10'
              }`}
            >
              {level === 'all' ? 'All Houses' : level}
              {level !== 'all' && (
                <span className={`ml-3 px-2 py-0.5 rounded-lg tabular-nums ${filterLevel === level ? 'bg-white/20' : 'bg-white/5 opacity-40'}`}>
                  {stats[level as keyof typeof stats]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 relative group">
          <input
            type="text"
            placeholder="Search by name or house..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-12 py-3 text-sm text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      </div>

      {/* Client List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {filteredProfiles.length === 0 ? (
          <div className="col-span-full text-center py-32 glass border border-white/5 rounded-3xl animate-in zoom-in duration-700">
            <div className="text-5xl mb-6 opacity-20 grayscale">📡</div>
            <div className="text-lg font-extrabold text-white mb-2 uppercase tracking-tight">No Strategic Matches</div>
            <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">Clear filters to restore visibility</div>
          </div>
        ) : (
          filteredProfiles.map((client, idx) => (
            <div
              key={client.name}
              onClick={() => setSelectedClient(client)}
              className={`glass-light border transition-all duration-500 rounded-[2.5rem] p-6 cursor-pointer card-glow interactive-row group animate-in slide-in-from-bottom-4 active:scale-95 shadow-2xl
                ${getRiskBorder(client.riskLevel)}`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl transition-transform group-hover:scale-110 duration-500 border border-white/10 ${getRiskPill(client.riskLevel)}`}>
                    {client.riskScore}
                  </div>
                  <div>
                    <div className="text-lg font-black text-white group-hover:text-hc-teal-light transition-colors tracking-tighter uppercase leading-none mb-1.5">{client.name}</div>
                    <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-60">{client.house}</div>
                  </div>
                </div>
                <span className={`pill text-[9px] font-black uppercase tracking-widest shadow-xl ${getRiskPill(client.riskLevel)} px-3 py-1`}>
                  {client.riskLevel}                </span>
              </div>

              <div className="flex items-center gap-6 mb-6 pb-5 border-b border-white/5 relative z-10">
                {client.redFlags > 0 && (
                  <div className="flex items-center gap-2 group/stat">
                    <div className="w-2.5 h-2.5 rounded-full bg-flag-red shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" />
                    <span className="text-[10px] font-black text-flag-red uppercase tracking-[0.1em]">{client.redFlags} CRITICAL</span>
                  </div>
                )}
                {client.amberFlags > 0 && (
                  <div className="flex items-center gap-2 group/stat">
                    <div className="w-2.5 h-2.5 rounded-full bg-flag-amber shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                    <span className="text-[10px] font-black text-flag-amber uppercase tracking-[0.1em]">{client.amberFlags} ALERTS</span>
                  </div>
                )}
                {client.medicationIssues > 0 && (
                  <div className="flex items-center gap-2 group/stat">
                    <div className="w-2.5 h-2.5 rounded-full bg-hc-blue shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                    <span className="text-[10px] font-black text-hc-blue uppercase tracking-[0.1em]">{client.medicationIssues} MEDS</span>
                  </div>
                )}
              </div>

              {/* Concerns */}
              {client.topConcerns.length > 0 && (
                <div className="flex flex-wrap gap-2 relative z-10 min-h-[60px]">
                  {client.topConcerns.slice(0, 4).map((concern, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-black px-3 py-1.5 rounded-lg bg-black/40 text-hc-muted border border-white/5 uppercase tracking-widest group-hover:border-hc-teal/20 group-hover:text-hc-text transition-all"
                    >
                      {concern}
                    </span>
                  ))}
                  {client.topConcerns.length > 4 && (
                    <span className="text-[9px] font-black text-hc-muted/40 uppercase self-center ml-1">+{client.topConcerns.length - 4}</span>
                  )}
                </div>
              )}
              
              <div className="mt-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all -translate-y-2 group-hover:translate-y-0 relative z-10">
                <span className="text-[9px] font-black text-hc-teal-light uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-hc-teal shadow-[0_0_5px_#14b8a6]" />
                  View Details
                </span>
                <div className="w-8 h-8 rounded-xl glass border border-white/10 flex items-center justify-center shadow-lg group-hover:bg-hc-teal/10 transition-colors">
                  <svg className="w-4 h-4 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass border border-white/10 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="p-10 border-b border-white/5 bg-hc-dark/40 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-2xl font-black shadow-2xl border border-white/10 ${getRiskPill(selectedClient.riskLevel)}`}>
                  {selectedClient.riskScore}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">{selectedClient.name}</h3>
                  <div className="flex items-center gap-3">
                    <span className={`pill text-[10px] font-black uppercase tracking-widest ${getRiskPill(selectedClient.riskLevel)}`}>{selectedClient.riskLevel} STRAT</span>
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60">{selectedClient.house}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="w-10 h-10 rounded-2xl glass border border-white/10 flex items-center justify-center text-hc-muted hover:text-white transition-all shadow-xl active:scale-90">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-10 space-y-8">
              <section>
                <div className="section-header text-[10px] mb-4 opacity-40 tracking-[0.3em]">PATTERN ANOMALIES</div>
                <div className="flex flex-wrap gap-2.5">
                  {selectedClient.topConcerns.map((c, i) => (
                    <span key={i} className="px-4 py-2 rounded-xl bg-black/40 border border-white/5 text-[11px] font-bold text-hc-text uppercase tracking-widest">{c}</span>
                  ))}
                </div>
              </section>
              <section>
                <div className="section-header text-[10px] mb-4 opacity-40 tracking-[0.3em]">RECOMMENDED ACTION</div>
                <p className="text-hc-text text-sm leading-relaxed italic border-l-2 border-hc-teal pl-6 font-medium">"Review care notes more frequently. Look at any recent changes in environment or routine. Keyworker should check in within the next 24 hours."</p>
              </section>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setSelectedClient(null)}
                  className="px-8 py-3.5 glass-light border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:text-white hover:border-hc-teal/30 transition-all active:scale-95 shadow-xl"
                >
                  Close Terminal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
