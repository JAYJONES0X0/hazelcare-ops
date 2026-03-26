import { useState } from 'react';
import type { Incident, IncidentStage } from '../lib/types';

interface Props {
  incidents: Incident[];
  onUpdate: (incidents: Incident[]) => void;
}

const STAGES: { id: IncidentStage; label: string; color: string; icon: string }[] = [
  { id: 'logged', label: 'Logged', color: '#3b82f6', icon: '📝' },
  { id: 'investigating', label: 'Investigating', color: '#f59e0b', icon: '🔍' },
  { id: 'resolved', label: 'Resolved', color: '#22c55e', icon: '✅' },
  { id: 'reported', label: 'Reported', color: '#8b5cf6', icon: '📤' },
  { id: 'closed', label: 'Closed', color: '#64748b', icon: '🔒' },
];

export function IncidentsPage({ incidents, onUpdate }: Props) {
  const [lastTransition, setLastTransition] = useState<{ id: string; previous: IncidentStage } | null>(null);

  function advanceStage(incident: Incident) {
    const stageOrder: IncidentStage[] = ['logged', 'investigating', 'resolved', 'reported', 'closed'];
    const idx = stageOrder.indexOf(incident.stage);
    if (idx < stageOrder.length - 1) {
      const updated = incidents.map(i => i.id === incident.id ? { ...i, stage: stageOrder[idx + 1] } : i);
      setLastTransition({ id: incident.id, previous: incident.stage });
      onUpdate(updated);
    }
  }

  function undoLastTransition() {
    if (!lastTransition) return;
    const updated = incidents.map(i => i.id === lastTransition.id ? { ...i, stage: lastTransition.previous } : i);
    onUpdate(updated);
    setLastTransition(null);
  }

  const byStage = STAGES.map(stage => ({
    ...stage,
    items: incidents.filter(i => i.stage === stage.id),
  }));

  const totalActive = incidents.filter(i => i.stage !== 'closed').length;
  const totalRed = incidents.filter(i => i.severity === 'red').length;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white mb-1 tracking-tight text-shimmer">Incident Pipeline</h1>
          <div className="flex items-center gap-3">
            <span className="pill pill-red text-[10px] uppercase tracking-wider font-bold shadow-lg animate-pulse-soft">
              {totalActive} Active Incidents
            </span>
            <span className="text-hc-muted text-[10px] font-bold uppercase tracking-widest ml-1">
              {totalRed} Critical Red Alerts
            </span>
          </div>
        </div>
        {lastTransition && (
          <button
            onClick={undoLastTransition}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] glass-light border border-hc-teal/30 text-hc-teal-light rounded-xl hover:bg-hc-teal/10 transition-all"
          >
            Undo Last Stage Change
          </button>
        )}
      </div>

      {/* Pipeline progress visualization */}
      <div className="grid grid-cols-5 gap-4 mb-10 glass border border-white/5 p-4 rounded-2xl shadow-2xl">
        {STAGES.map(stage => {
          const count = incidents.filter(i => i.stage === stage.id).length;
          return (
            <div key={stage.id} className="relative group cursor-default">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] transition-colors group-hover:text-white" style={{ color: stage.color }}>{stage.label}</span>
                <span className="text-[10px] font-bold text-white/40 group-hover:text-white transition-colors">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-hc-dark/60 overflow-hidden shadow-inner border border-white/5">
                <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(255,255,255,0.1)]" 
                  style={{ background: `linear-gradient(90deg, ${stage.color}88, ${stage.color})`, width: count > 0 ? '100%' : '0%', opacity: count > 0 ? 1 : 0.1 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban-style columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 min-h-[600px]">
        {byStage.map((stage, sIdx) => (
          <div key={stage.id} className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${sIdx * 100}ms` }}>
            <div className="flex items-center justify-between px-3 py-1.5 glass border-l-2 border-white/5 rounded-xl bg-white/[0.02]" style={{ borderLeftColor: stage.color }}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{stage.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">{stage.label}</span>
              </div>
              <span className="pill pill-teal text-[9px] px-1.5 py-0 shadow-sm opacity-60 group-hover:opacity-100">{stage.items.length}</span>
            </div>

            <div className="flex-1 space-y-3 bg-black/10 rounded-2xl p-2 border border-white/5 overflow-y-auto max-h-[70vh] scrollbar-thin shadow-inner group/stage">
              {stage.items.map(incident => (
                <div
                  key={incident.id}
                  className={`glass-light border transition-all duration-500 rounded-2xl p-5 card-glow interactive-row group/card active:scale-95 animate-in slide-in-from-bottom-4
                    ${incident.severity === 'red' ? 'border-flag-red/30 glow-red shadow-flag-red/5 bg-flag-red/[0.02]' : 'border-flag-amber/20 bg-flag-amber/[0.01]'}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3 relative z-10">
                    <span className="text-[13px] font-black text-white leading-tight group-hover/card:text-hc-teal-light transition-colors tracking-tight uppercase">{incident.title}</span>
                    {incident.severity === 'red' ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-flag-red shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse shrink-0 mt-1" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-flag-amber shadow-[0_0_10px_rgba(245,158,11,0.8)] shrink-0 mt-1" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-[9px] font-black text-hc-teal-light/80 uppercase tracking-widest">{incident.house}</span>
                    {incident.client && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <span className="text-[10px] font-bold text-hc-muted uppercase tracking-tighter opacity-60">{incident.client}</span>
                      </>
                    )}
                  </div>

                  <p className="text-[11px] text-hc-text/80 leading-relaxed line-clamp-3 mb-4 font-medium opacity-80 group-hover/card:opacity-100 transition-opacity italic px-1">"{incident.description}"</p>

                  {/* Actions */}
                  {incident.actions.length > 0 && (
                    <div className="space-y-2 mb-5 bg-black/30 p-3 rounded-xl border border-white/5 shadow-inner">
                      <div className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1.5 opacity-40">Actions Taken</div>
                      {incident.actions.slice(0, 3).map((a, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-[9px] font-black text-hc-teal-light/70 uppercase tracking-widest group-hover/card:text-hc-teal-light transition-colors">
                          <svg className="w-3 h-3 text-hc-teal-light/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          {a}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-40 tabular-nums">{incident.date}</span>
                    {incident.stage !== 'closed' && (
                      <button
                        onClick={() => advanceStage(incident)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-black text-hc-teal-light uppercase tracking-widest border border-hc-teal/30 hover:bg-hc-teal/10 transition-all"
                      >
                        Advance
                        <svg className="w-3.5 h-3.5 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    )}
                  </div>

                  {/* Flags */}
                  {incident.flags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {incident.flags.map((f, i) => (
                        <span key={i} className={`pill text-[8px] font-black uppercase tracking-widest py-0.5 px-2 shadow-sm
                          ${incident.severity === 'red' ? 'pill-red' : 'pill-amber'}`}>{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {stage.items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 opacity-20 grayscale group-hover/stage:opacity-40 group-hover/stage:grayscale-0 transition-all duration-700">
                  <div className="text-3xl mb-3 animate-float">🛡️</div>
                  <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">No Incidents</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
