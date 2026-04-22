import { useState } from 'react';
import type { Incident, IncidentStage } from '../lib/types';
import { useCollapseStore } from '../lib/collapse-store';

interface Props {
  incidents: Incident[];
  onUpdate: (incidents: Incident[]) => void;
}

const STAGES: { id: IncidentStage; label: string; color: string }[] = [
  { id: 'logged', label: 'LOGGED_INBOUND', color: '#3b82f6' },
  { id: 'investigating', label: 'INVESTIGATION_ACTIVE', color: '#f59e0b' },
  { id: 'resolved', label: 'RESOLVED_INTERNAL', color: '#22c55e' },
  { id: 'reported', label: 'STATUTORY_EXTERNAL', color: '#8b5cf6' },
  { id: 'closed', label: 'STATION_CLOSED', color: '#64748b' },
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

  const byStage = STAGES.map(stage => ({
    ...stage,
    items: incidents.filter(i => i.stage === stage.id),
  }));

  const totalActive = incidents.filter(i => i.stage !== 'closed').length;
  const totalRed = incidents.filter(i => i.severity === 'red').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200 font-mono">
      {/* Tactical Header */}
      <div className="flex-none p-4 lg:p-6 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-6 bg-blue-600" />
              <h1 className="text-xl font-black tracking-tighter uppercase text-slate-100">Stability Vector Hub</h1>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">STATION_STATUS:</span>
                <span className="text-blue-400">OPERATIONAL // ENFORCED</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">VECTOR_LOAD:</span>
                <span className={totalActive > 0 ? "text-orange-500" : "text-green-500"}>{totalActive} ACTIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">CRITICAL_FAULTS:</span>
                <span className={totalRed > 0 ? "text-red-500 animate-pulse" : "text-slate-600"}>{totalRed} INTERCEPTS</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastTransition && (
              <button
                onClick={undoLastTransition}
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                Undo Last Transition
              </button>
            )}
            <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-[10px] font-black uppercase text-slate-500">
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
            className={`flex-none w-80 flex flex-col border border-slate-800 bg-slate-900/30
              ${isStageCollapsed(stage.id) ? 'w-12 overflow-hidden' : ''} transition-all duration-300`}
          >
            {/* Column Header */}
            <div 
              onClick={() => toggleStage(stage.id)}
              className="flex-none p-3 flex items-center justify-between cursor-pointer border-b border-slate-800 hover:bg-slate-900/50 transition-colors"
              style={{ borderTop: `2px solid ${stage.color}` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-1.5 h-1.5 shrink-0`} style={{ backgroundColor: stage.color }} />
                {!isStageCollapsed(stage.id) && (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] truncate text-slate-400">
                    {stage.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-600">{stage.items.length}</span>
              </div>
            </div>

            {/* Column Body */}
            {!isStageCollapsed(stage.id) && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-none">
                {stage.items.map(incident => (
                  <div
                    key={incident.id}
                    className={`p-4 border bg-slate-900 shadow-xl relative overflow-hidden group
                      ${incident.severity === 'red' ? 'border-red-900/50 hover:border-red-800' : 'border-slate-800 hover:border-slate-700'}`}
                  >
                    {/* Severity Indicator */}
                    <div className={`absolute top-0 right-0 w-12 h-1 ${incident.severity === 'red' ? 'bg-red-600 animate-pulse' : 'bg-orange-600'}`} />
                    
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-[11px] font-black text-slate-100 uppercase tracking-tighter leading-tight mb-1">
                          {incident.title}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          <span>{incident.house}</span>
                          {incident.client && (
                            <>
                              <span className="text-slate-700">//</span>
                              <span>{incident.client}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 leading-relaxed mb-4 border-l border-slate-800 pl-3 py-1">
                      {incident.description}
                    </div>

                    {/* Actions Feed */}
                    {incident.actions.length > 0 && (
                      <div className="bg-black/40 border border-slate-800/50 p-2 mb-4 space-y-1">
                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Response_Log</div>
                        {incident.actions.slice(0, 3).map((a, i) => (
                          <div key={i} className="text-[9px] text-slate-500 leading-tight flex items-start gap-2">
                            <span className="text-blue-500/50 shrink-0">▸</span>
                            <span>{a.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                      <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{incident.date}</span>
                      {incident.stage !== 'closed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); advanceStage(incident); }}
                          className="px-3 py-1.5 text-[9px] font-black uppercase bg-slate-800 border border-slate-700 hover:bg-blue-900 hover:border-blue-700 text-slate-400 hover:text-white transition-all"
                        >
                          Advance_Vector ▸
                        </button>
                      )}
                    </div>

                    {/* Tags */}
                    {incident.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {incident.flags.map((f, i) => (
                          <span key={i} className="text-[8px] font-black px-1.5 py-0.5 border border-slate-800 bg-slate-950 text-slate-500 uppercase">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {stage.items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20 border border-dashed border-slate-800 m-2">
                    <span className="text-xs font-black uppercase text-slate-600 tracking-[0.2em]">Zero_Vectors</span>
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

