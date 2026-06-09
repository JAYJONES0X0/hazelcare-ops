import { useState, useMemo } from 'react';
import type { Incident, IncidentStage } from '../lib/types';
import { useCollapseStore } from '../lib/collapse-store';

interface Props {
  incidents: Incident[];
  onUpdate: (incidents: Incident[]) => void;
}

const STAGES: { id: IncidentStage; label: string; color: string }[] = [
  { id: 'logged', label: '1: INGESTED / LOGGED', color: '#3b82f6' },
  { id: 'investigating', label: '2: CLINICAL INVESTIGATION', color: '#f59e0b' },
  { id: 'resolved', label: '3: INTERNAL RESOLUTION', color: '#22c55e' },
  { id: 'reported', label: '4: STATUTORY REPORTING', color: '#8b5cf6' },
  { id: 'closed', label: '5: FORENSIC ARCHIVE', color: '#64748b' },
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

  const { isCollapsed: isStageCollapsed, toggle: toggleStage } = useCollapseStore('incidents-stages');

  // High-Performance Indexed Grouping
  const byStage = useMemo(() => {
    const groups: Record<IncidentStage, Incident[]> = { logged: [], investigating: [], resolved: [], reported: [], closed: [] };
    incidents.forEach(i => { groups[i.stage]?.push(i); });
    return STAGES.map(stage => ({
      ...stage,
      items: groups[stage.id] || [],
    }));
  }, [incidents]);

  const totalActive = incidents.filter(i => i.stage !== 'closed').length;
  const totalRed = incidents.filter(i => i.severity === 'red').length;

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-hc-text font-mono">

      {/* Tactical Header */}
      <div className="flex-none p-4 lg:p-6 border-b border-hc-border hc-clay-raised">

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1 h-6 bg-hc-teal" />
              <h1 className="text-xl font-black tracking-tighter uppercase text-hc-text">Incident Hub</h1>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-bold">
              <div className="flex items-center gap-2">
                <span className="text-hc-muted">HUB_STATUS:</span>
                <span className="text-blue-400">OPERATIONAL // ENFORCED</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-hc-muted">INCIDENT_LOAD:</span>
                <span className={totalActive > 0 ? "text-orange-500" : "text-green-500"}>{totalActive} ACTIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-hc-muted">CRITICAL_FAULTS:</span>
                <span className={totalRed > 0 ? "text-red-500 animate-pulse" : "text-hc-muted"}>{totalRed} INTERCEPTS</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastTransition && (
              <button
                onClick={undoLastTransition}
                className="px-3 py-1.5 text-[11px] font-black uppercase tracking-widest bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors text-hc-text"
              >
                Undo Last Transition
              </button>
            )}
            <div className="px-3 py-1.5 hc-clay-inset text-[11px] font-black uppercase text-hc-muted">
              SYS_REF: NC-STB-001
            </div>
          </div>
        </div>
      </div>

      {/* Main Kanban Workspace */}
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden p-4 gap-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {byStage.map((stage) => (
          <div 
            key={stage.id} 
            className={`flex-none w-80 flex flex-col border border-hc-border bg-hc-card
              ${isStageCollapsed(stage.id) ? 'w-12 overflow-hidden' : ''} transition-all duration-300`}
          >
            {/* Column Header */}
            <div 
              onClick={() => toggleStage(stage.id)}
              className="flex-none p-3 flex items-center justify-between cursor-pointer border-b border-hc-border hover:bg-hc-card-hover transition-colors"
              style={{ borderTop: `2px solid ${stage.color}` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-1.5 h-1.5 shrink-0`} style={{ backgroundColor: stage.color }} />
                {!isStageCollapsed(stage.id) && (
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] truncate text-hc-muted">
                    {stage.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-hc-muted">{stage.items.length}</span>
              </div>
            </div>

            {/* Column Body */}
            {!isStageCollapsed(stage.id) && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-none">
                {stage.items.map(incident => (
                  <div
                    key={incident.id}
                    className={`p-4 border bg-hc-card shadow-xl relative overflow-hidden group
                      ${incident.severity === 'red' ? 'border-red-900/50 hover:border-red-800' : 'border-hc-border hover:border-hc-border-light'}`}
                  >
                    {/* Severity Indicator */}
                    <div className={`absolute top-0 right-0 w-12 h-1 ${incident.severity === 'red' ? 'bg-red-600 animate-pulse' : 'bg-orange-600'}`} />
                    
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-[11px] font-black text-hc-text uppercase tracking-tighter leading-tight mb-1">
                          {incident.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-hc-muted uppercase tracking-widest">
                          <span>{incident.house}</span>
                          {incident.client && (
                            <>
                              <span className="text-hc-border">//</span>
                              <span>{incident.client}</span>
                            </>
                          )}
                          {incident.flags.some(f => f.toLowerCase().includes('med')) && (
                            <span className="ml-auto flex items-center gap-1.5 text-flag-red animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-flag-red" />
                              MED_ALERT
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-hc-muted leading-relaxed mb-4 border-l border-hc-border pl-3 py-1">
                      {incident.description}
                    </div>

                    {/* Actions Feed */}
                    {incident.actions.length > 0 && (
                      <div className="hc-clay-inset p-2 mb-4 space-y-1">
                        <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1">Response_Log</div>
                        {incident.actions.slice(0, 3).map((a, i) => (
                          <div key={i} className="text-[11px] text-hc-muted leading-tight flex items-start gap-2">
                            <span className="text-blue-500/50 shrink-0">▸</span>
                            <span>{a.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                      <span className="text-[11px] font-bold text-hc-muted uppercase tracking-widest">{incident.date}</span>
                      {incident.stage !== 'closed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); advanceStage(incident); }}
                          className="px-3 py-1.5 text-[11px] font-black uppercase bg-slate-800 border border-slate-700 hover:bg-blue-900 hover:border-blue-700 text-hc-muted hover:text-hc-text transition-all"
                        >
                          Advance Stage ▸
                        </button>
                      )}
                    </div>

                    {/* Tags */}
                    {incident.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {incident.flags.map((f, i) => (
                          <span key={i} className="text-[11px] font-black px-1.5 py-0.5 border border-hc-border hc-clay-inset text-hc-muted uppercase">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {stage.items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 border border-dashed border-hc-border m-2">
                    <span className="text-[11px] font-black uppercase text-hc-muted tracking-[0.2em]">No Incidents</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
