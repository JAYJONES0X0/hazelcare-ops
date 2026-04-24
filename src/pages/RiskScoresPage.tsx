import { useMemo, useState } from 'react';
import { Search, ArrowRight, X, AlertTriangle, Activity } from 'lucide-react';
import type { WeekSummary } from '../lib/types';
import { generateRiskProfiles, getRiskStats, type ClientRiskProfile } from '../lib/risk-scores';

interface Props {
  weekData: WeekSummary | null;
  onQuickAction: (opts: { type: 'action' | 'incident'; content?: string; house?: string; client?: string }) => void;
}

export function RiskScoresPage({ weekData, onQuickAction }: Props) {
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
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 animate-in fade-in duration-700 bg-hc-bone">
        <div className="w-24 h-24 rounded-2xl hc-clay-inset flex items-center justify-center mb-8 animate-float">
          <AlertTriangle className="w-12 h-12 text-hc-teal" />
        </div>
        <h2 className="text-2xl font-black text-hc-text mb-3">Risk Scores</h2>
        <p className="text-hc-muted text-[11px] font-bold uppercase tracking-widest mb-8 text-center max-w-xs leading-relaxed">Import care data to generate risk profiles and scores for each person.</p>
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
      case 'critical': return 'glow-red';
      case 'high': return 'glow-amber';
      default: return '';
    }
  }

  return (
    <div className="p-12 w-full animate-in fade-in duration-1000 bg-hc-bone min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-black text-hc-text mb-2 tracking-tighter uppercase">Risk Overview</h1>
            <div className="flex items-center gap-3">
              <span className="pill pill-amber text-[11px] font-black uppercase tracking-widest shadow-lg">Risk Stratification</span>
              <p className="text-hc-muted text-[11px] font-bold uppercase tracking-widest ml-1">
                Reviewing risk levels across all residences
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-6 mb-12 hc-clay-raised p-8 rounded-[2.5rem] shadow-2xl">
          <div className="flex gap-2 flex-wrap items-center relative z-10">
            <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mr-4">Filter Magnitude</span>
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(level => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ease-out active:scale-95 ${
                  filterLevel === level
                    ? 'bg-hc-teal text-hc-bone shadow-inner'
                    : 'text-hc-muted hover:text-hc-text hover:bg-hc-clay-dark'
                }`}
              >
                {level === 'all' ? 'All Residences' : level}
                {level !== 'all' && (
                  <span className={`ml-3 px-2 py-0.5 rounded-lg tabular-nums ${filterLevel === level ? 'bg-hc-teal/30' : 'bg-hc-clay-dark text-hc-muted'}`}>
                    {stats[level as keyof typeof stats]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-hc-muted transition-colors group-focus-within:text-hc-teal" />
            <input
              type="text"
              placeholder="Search by name or residence..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-hc-bone hc-clay-inset rounded-2xl px-12 py-3.5 text-[11px] font-black text-hc-text placeholder:text-hc-muted/40 focus:ring-2 ring-hc-teal/30 outline-none transition-all"
            />
          </div>
        </div>

        {/* Client List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProfiles.length === 0 ? (
            <div className="col-span-full text-center py-32 hc-clay-raised rounded-[2.5rem] animate-in zoom-in duration-700">
              <Activity className="w-16 h-16 text-hc-muted mx-auto mb-6 opacity-20" />
              <div className="text-xl font-black text-hc-text mb-2 uppercase tracking-tight">No Strategic Matches</div>
              <div className="text-[11px] text-hc-muted uppercase tracking-[0.2em] font-bold">Clear filters to restore visibility</div>
            </div>
          ) : (
            filteredProfiles.map((client, idx) => (
              <div
                key={client.name}
                onClick={() => setSelectedClient(client)}
                className={`hc-clay-raised transition-all duration-500 rounded-[2.5rem] p-8 cursor-pointer card-glow interactive-row group animate-in slide-in-from-bottom-4 active:scale-95 shadow-2xl
                  ${getRiskBorder(client.riskLevel)}`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl hc-clay-inset flex items-center justify-center font-black text-xl shadow-inner transition-transform group-hover:scale-110 duration-500`}>
                      <span className={client.riskLevel === 'critical' ? 'text-hc-red' : client.riskLevel === 'high' ? 'text-hc-amber' : 'text-hc-teal'}>
                        {client.riskScore}
                      </span>
                    </div>
                    <div>
                      <div className="text-xl font-black text-hc-text group-hover:text-hc-teal transition-colors tracking-tighter uppercase leading-none mb-2">{client.name}</div>
                      <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest">{client.house}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 mb-8 pb-6 border-b border-hc-border relative z-10">
                  {client.redFlags > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-hc-red glow-red" />
                      <span className="text-[11px] font-black text-hc-red uppercase tracking-widest">{client.redFlags} RED</span>
                    </div>
                  )}
                  {client.amberFlags > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-hc-amber glow-amber" />
                      <span className="text-[11px] font-black text-hc-amber uppercase tracking-widest">{client.amberFlags} AMB</span>
                    </div>
                  )}
                  {client.medicationIssues > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-hc-teal shadow-lg" />
                      <span className="text-[11px] font-black text-hc-teal uppercase tracking-widest">{client.medicationIssues} MED</span>
                    </div>
                  )}
                </div>

                {/* Concerns */}
                {client.topConcerns.length > 0 && (
                  <div className="flex flex-wrap gap-2 relative z-10 min-h-[60px]">
                    {client.topConcerns.slice(0, 4).map((concern, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-black px-3 py-1.5 rounded-lg hc-clay-inset text-hc-muted uppercase tracking-widest group-hover:text-hc-text transition-all"
                      >
                        {concern}
                      </span>
                    ))}
                    {client.topConcerns.length > 4 && (
                      <span className="text-[11px] font-black text-hc-muted/40 uppercase self-center ml-1">+{client.topConcerns.length - 4}</span>
                    )}
                  </div>
                )}
                
                <div className="mt-8 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all -translate-y-2 group-hover:translate-y-0 relative z-10">
                  <span className="text-[11px] font-black text-hc-teal uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-hc-teal" />
                    View Details
                  </span>
                  <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center text-hc-muted group-hover:text-hc-teal transition-all duration-500 shadow-xl">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-hc-bone/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="hc-clay-raised rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="p-12 border-b border-hc-border bg-hc-clay-dark/20 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className={`w-20 h-20 rounded-2xl hc-clay-inset flex items-center justify-center text-3xl font-black shadow-inner`}>
                  <span className={selectedClient.riskLevel === 'critical' ? 'text-hc-red' : selectedClient.riskLevel === 'high' ? 'text-hc-amber' : 'text-hc-teal'}>
                    {selectedClient.riskScore}
                  </span>
                </div>
                <div>
                  <h3 className="text-3xl font-black text-hc-text tracking-tighter uppercase mb-2">{selectedClient.name}</h3>
                  <div className="flex items-center gap-4">
                    <span className={`pill text-[11px] font-black uppercase tracking-widest ${getRiskPill(selectedClient.riskLevel)}`}>{selectedClient.riskLevel} STRAT</span>
                    <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">{selectedClient.house}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedClient(null)} className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-muted hover:text-hc-red transition-all shadow-xl active:scale-95">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-12 space-y-10">
              <section>
                <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] mb-6">PATTERN ANOMALIES</div>
                <div className="flex flex-wrap gap-3">
                  {selectedClient.topConcerns.map((c, i) => (
                    <span key={i} className="px-5 py-2.5 rounded-xl hc-clay-inset text-[11px] font-black text-hc-text uppercase tracking-widest">{c}</span>
                  ))}
                </div>
              </section>
              <section>
                <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] mb-6">RECOMMENDED ACTION</div>
                <p className="text-hc-text text-[13px] leading-relaxed italic border-l-4 border-hc-teal pl-8 font-black">"Review care notes more frequently. Look at any recent changes in environment or routine. Key worker should check in within the next 24 hours."</p>
              </section>
              <div className="flex justify-end gap-4 pt-8 border-t border-hc-border">
                <button
                  onClick={() => onQuickAction({ type: 'action', content: `High Risk Review for ${selectedClient.name}: ${selectedClient.topConcerns.join(', ')}`, house: selectedClient.house, client: selectedClient.name })}
                  className="px-10 py-4 btn-tactical rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all"
                >
                  Log Priority Action
                </button>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="px-10 py-4 hc-clay-raised rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-hc-text transition-all active:scale-95 shadow-xl"
                >
                  Exit Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
