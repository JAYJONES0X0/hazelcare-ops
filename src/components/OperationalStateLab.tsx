import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  GitCompareArrows,
  Network,
  ShieldCheck,
} from 'lucide-react';
import {
  OPERATIONAL_CONTROL_KEYS,
  OPERATIONAL_CONTROL_LABELS,
  buildDemoOperationalState,
  evaluateSnapshot,
  type ControlObservation,
  type OperationalStatus,
} from '../lib/operational-state-intelligence';

const STATUS_CLASS: Record<OperationalStatus, string> = {
  VERIFIED: 'text-flag-green border-flag-green/30 bg-flag-green/10',
  READY: 'text-hc-teal border-hc-teal/30 bg-hc-teal/10',
  PARTIAL: 'text-flag-amber border-flag-amber/30 bg-flag-amber/10',
  BLOCKED: 'text-flag-red border-flag-red/30 bg-flag-red/10',
  UNKNOWN: 'text-hc-muted border-hc-border/30 bg-hc-surface-2/60',
};

function controlGlyph(observation: ControlObservation) {
  if (observation.value === 'yes' && observation.epistemic === 'OBSERVED' && observation.evidence.length > 0) {
    return { label: 'YES', cls: 'text-flag-green bg-flag-green/10 border-flag-green/20' };
  }
  if (observation.value === 'no') {
    return { label: 'NO', cls: 'text-flag-red bg-flag-red/10 border-flag-red/20' };
  }
  if (observation.value === 'partial') {
    return { label: 'PART', cls: 'text-flag-amber bg-flag-amber/10 border-flag-amber/20' };
  }
  if (observation.value === 'yes') {
    return { label: observation.epistemic, cls: 'text-flag-amber bg-flag-amber/10 border-flag-amber/20' };
  }
  return { label: '?', cls: 'text-hc-muted bg-hc-surface-2 border-hc-border/20' };
}

export function OperationalStateLab() {
  const snapshot = useMemo(() => evaluateSnapshot(buildDemoOperationalState()), []);
  const services = snapshot.topology.filter(node => node.kind === 'service');
  const statusCounts = snapshot.capabilities.reduce<Record<OperationalStatus, number>>((acc, item) => {
    acc[item.status] += 1;
    return acc;
  }, { VERIFIED: 0, READY: 0, PARTIAL: 0, BLOCKED: 0, UNKNOWN: 0 });

  const serviceName = (id: string) => snapshot.topology.find(node => node.id === id)?.name || id;

  return (
    <section className="space-y-6 rounded-[2.5rem] border border-hc-teal/20 bg-hc-surface/40 p-5 lg:p-7">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.32em] text-hc-teal mb-2">
            <Network size={13} /> Operational State Intelligence
          </div>
          <h2 className="text-2xl lg:text-3xl font-black uppercase tracking-[0.08em] text-hc-text">State Model Lab</h2>
          <p className="mt-2 max-w-3xl text-[11px] leading-relaxed font-semibold text-hc-muted">
            This panel is intentionally using a fictional provider fixture. It demonstrates the control-plane model only and makes no claim about a live provider. A capability is not verified merely because a feature exists or is enabled.
          </p>
        </div>
        <div className="rounded-2xl border border-flag-amber/20 bg-flag-amber/5 px-4 py-3 text-[9px] font-black uppercase tracking-[0.22em] text-flag-amber">
          MODELED DEMO · NOT LIVE PROVIDER STATE
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(statusCounts) as OperationalStatus[]).map(status => (
          <div key={status} className={`rounded-2xl border p-4 ${STATUS_CLASS[status]}`}>
            <div className="text-[8px] font-black uppercase tracking-[0.24em] opacity-80">{status}</div>
            <div className="mt-2 text-2xl font-black tabular-nums">{statusCounts[status]}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-5">
        <div className="hc-clay-raised rounded-[2rem] p-4 lg:p-5 overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-[9px] font-black text-hc-muted uppercase tracking-[0.24em]">Capability Matrix</div>
              <div className="text-sm font-black text-hc-text mt-1">Desired state vs what is actually observed</div>
            </div>
            <GitCompareArrows size={18} className="text-hc-teal" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-hc-muted">Service / capability</th>
                  {OPERATIONAL_CONTROL_KEYS.map(key => (
                    <th key={key} className="px-2 py-2 text-center text-[8px] font-black uppercase tracking-widest text-hc-muted">
                      {OPERATIONAL_CONTROL_LABELS[key]}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center text-[8px] font-black uppercase tracking-widest text-hc-muted">State</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.capabilities.map(item => (
                  <tr key={item.id} className="bg-hc-surface-2/55">
                    <td className="rounded-l-xl px-3 py-3">
                      <div className="text-[10px] font-black text-hc-text">{item.label}</div>
                      <div className="mt-1 text-[8px] font-bold uppercase tracking-widest text-hc-muted">{serviceName(item.serviceId)} · {item.sourceSystem}</div>
                    </td>
                    {OPERATIONAL_CONTROL_KEYS.map(key => {
                      const glyph = controlGlyph(item.observed[key]);
                      return (
                        <td key={key} className="px-2 py-3 text-center">
                          <span title={item.observed[key].note || item.observed[key].epistemic} className={`inline-flex min-w-[44px] justify-center rounded-lg border px-2 py-1 text-[8px] font-black uppercase tracking-wider ${glyph.cls}`}>
                            {glyph.label}
                          </span>
                        </td>
                      );
                    })}
                    <td className="rounded-r-xl px-3 py-3 text-center">
                      <span className={`inline-flex rounded-lg border px-2 py-1 text-[8px] font-black uppercase tracking-wider ${STATUS_CLASS[item.status]}`}>
                        {item.status} · {item.readinessScore}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="hc-clay-raised rounded-[2rem] p-5">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={17} className="text-flag-amber" />
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.24em] text-hc-muted">Delta Queue</div>
                <div className="text-sm font-black text-hc-text">What must change before verification</div>
              </div>
            </div>
            <div className="space-y-3 max-h-[470px] overflow-y-auto pr-1">
              {snapshot.deltas.slice(0, 10).map(delta => (
                <div key={`${delta.capabilityRecordId}:${delta.control}`} className="rounded-xl border border-hc-border/15 bg-hc-surface-2/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black text-hc-text">{delta.capabilityLabel}</div>
                      <div className="text-[8px] font-bold uppercase tracking-widest text-hc-muted mt-1">{serviceName(delta.serviceId)} · {OPERATIONAL_CONTROL_LABELS[delta.control]}</div>
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-wider ${delta.severity === 'critical' || delta.severity === 'high' ? 'text-flag-red' : delta.severity === 'medium' ? 'text-flag-amber' : 'text-hc-muted'}`}>
                      {delta.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-hc-muted">{delta.reason}</p>
                  <p className="mt-2 text-[9px] font-bold text-hc-text">Next: {delta.nextAction}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="hc-clay-raised rounded-[2rem] p-5">
          <div className="flex items-center gap-3 mb-4">
            <Activity size={17} className="text-hc-teal" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-hc-muted">Emergence Detection</div>
              <div className="text-sm font-black text-hc-text">Local gap vs repeated system pattern</div>
            </div>
          </div>
          {snapshot.patterns.length === 0 ? (
            <div className="rounded-xl border border-hc-border/15 p-4 text-[10px] font-semibold text-hc-muted">No repeated cross-service patterns detected.</div>
          ) : (
            <div className="space-y-3">
              {snapshot.patterns.map(pattern => (
                <div key={pattern.id} className="rounded-xl border border-flag-amber/20 bg-flag-amber/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black text-hc-text">{pattern.summary}</div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-flag-amber">{pattern.scope}</span>
                  </div>
                  <div className="mt-2 text-[9px] font-semibold text-hc-muted">
                    {pattern.services.map(serviceName).join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hc-clay-raised rounded-[2rem] p-5">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck size={17} className="text-flag-green" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-hc-muted">Evidence Contracts</div>
              <div className="text-sm font-black text-hc-text">Claims require a complete evidence chain</div>
            </div>
          </div>
          <div className="space-y-4">
            {snapshot.contracts.map(contract => (
              <div key={contract.id} className="rounded-xl border border-hc-border/15 bg-hc-surface-2/55 p-4">
                <div className="flex items-start gap-3">
                  <CircleHelp size={15} className="text-hc-teal mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] font-black text-hc-text">{contract.name}</div>
                    <p className="mt-1 text-[9px] leading-relaxed text-hc-muted">{contract.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {contract.chain.map((step, index) => (
                    <div key={`${contract.id}:${step}`} className="flex items-center gap-1.5">
                      <span className="rounded-lg border border-hc-teal/15 bg-hc-teal/5 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-hc-teal">{step}</span>
                      {index < contract.chain.length - 1 && <span className="text-hc-muted/50">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-hc-teal/15 bg-hc-teal/5 p-4 flex items-start gap-3">
        <CheckCircle2 size={16} className="text-hc-teal mt-0.5 shrink-0" />
        <p className="text-[10px] leading-relaxed font-semibold text-hc-muted">
          Design boundary: source systems remain execution/record systems. OVSITE owns the model of desired state, evidence provenance, unresolved deltas and verification logic. Live provider state should only enter this surface through explicit configuration or imported evidence.
        </p>
      </div>

      <div className="text-[8px] font-black uppercase tracking-[0.28em] text-hc-muted/60">
        Model services in fixture: {services.map(service => service.name).join(' · ')}
      </div>
    </section>
  );
}
