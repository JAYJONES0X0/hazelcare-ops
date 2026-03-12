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
  function advanceStage(incident: Incident) {
    const stageOrder: IncidentStage[] = ['logged', 'investigating', 'resolved', 'reported', 'closed'];
    const idx = stageOrder.indexOf(incident.stage);
    if (idx < stageOrder.length - 1) {
      const updated = incidents.map(i => i.id === incident.id ? { ...i, stage: stageOrder[idx + 1] } : i);
      onUpdate(updated);
    }
  }

  const byStage = STAGES.map(stage => ({
    ...stage,
    items: incidents.filter(i => i.stage === stage.id),
  }));

  const totalActive = incidents.filter(i => i.stage !== 'closed').length;
  const totalRed = incidents.filter(i => i.severity === 'red').length;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Incident Pipeline</h1>
          <p className="text-hc-muted text-sm">
            {totalActive} active incidents · {totalRed} red severity
          </p>
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="flex gap-1 mb-6">
        {STAGES.map(stage => {
          const count = incidents.filter(i => i.stage === stage.id).length;
          return (
            <div key={stage.id} className="flex-1 text-center">
              <div className="text-xs font-semibold mb-1" style={{ color: stage.color }}>{stage.label}</div>
              <div className="h-1.5 rounded-full" style={{ background: `${stage.color}20` }}>
                <div className="h-full rounded-full transition-all" style={{ background: stage.color, width: count > 0 ? '100%' : '0%', opacity: count > 0 ? 1 : 0.2 }} />
              </div>
              <div className="text-[10px] text-hc-muted mt-1">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Kanban-style columns */}
      <div className="grid grid-cols-5 gap-3 min-h-[500px]">
        {byStage.map(stage => (
          <div key={stage.id} className="bg-hc-card/30 border border-hc-border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-hc-border">
              <span>{stage.icon}</span>
              <span className="text-xs font-semibold" style={{ color: stage.color }}>{stage.label}</span>
              <span className="ml-auto text-[10px] text-hc-muted bg-hc-dark px-1.5 py-0.5 rounded">{stage.items.length}</span>
            </div>

            <div className="space-y-2">
              {stage.items.map(incident => (
                <div
                  key={incident.id}
                  className={`bg-hc-card border rounded-xl p-3 hover:bg-hc-card-hover transition-all cursor-pointer ${
                    incident.severity === 'red' ? 'border-flag-red/25' : 'border-flag-amber/25'
                  }`}
                  onClick={() => advanceStage(incident)}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className="text-[11px] font-semibold text-white leading-tight">{incident.title}</span>
                    <span className={`shrink-0 w-2 h-2 rounded-full mt-1 ${incident.severity === 'red' ? 'bg-flag-red' : 'bg-flag-amber'}`} />
                  </div>
                  <div className="text-[10px] text-hc-teal-light mb-1">{incident.house}</div>
                  {incident.client && <div className="text-[10px] text-hc-muted mb-1">{incident.client}</div>}
                  <p className="text-[10px] text-hc-text leading-relaxed line-clamp-3 mb-2">{incident.description}</p>

                  {/* Actions */}
                  {incident.actions.length > 0 && (
                    <div className="space-y-0.5 mb-2">
                      {incident.actions.slice(0, 3).map((a, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[9px] text-hc-muted">
                          <svg className="w-2.5 h-2.5 text-hc-teal-light shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          {a}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-hc-muted">{incident.date}</span>
                    {incident.stage !== 'closed' && (
                      <span className="ml-auto text-[9px] text-hc-teal-light opacity-0 group-hover:opacity-100">Click to advance →</span>
                    )}
                  </div>

                  {/* Flags */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {incident.flags.map((f, i) => (
                      <span key={i} className={`text-[8px] px-1.5 py-0.5 rounded ${
                        incident.severity === 'red' ? 'bg-flag-red/10 text-flag-red border border-flag-red/20' : 'bg-flag-amber/10 text-flag-amber border border-flag-amber/20'
                      }`}>{f}</span>
                    ))}
                  </div>
                </div>
              ))}

              {stage.items.length === 0 && (
                <div className="text-center py-6 text-[11px] text-hc-muted opacity-50">
                  No incidents
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
