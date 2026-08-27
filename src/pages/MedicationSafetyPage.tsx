import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSearch,
  Pill as PillIcon,
  Printer,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  buildMARAuditExport,
  canRecordMedicationOutcome,
  createMARCorrection,
  createSyntheticMedicationState,
  detectMARExceptions,
  evidenceFromMedicationAuditText,
  evidenceFromNourishMARHtml,
  generateMARChartPeriod,
  loadMedicationState,
  recordMAROutcome,
  saveMedicationState,
  type MARAdministrationEvent,
  type MARStaffOutcome,
  type MedicationAccessProfile,
  type MedicationState,
} from '../lib/client-medication';

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'purple' }) {
  const color = {
    neutral: 'border-hc-border/30 text-hc-muted',
    green: 'border-hc-green/30 text-hc-green bg-hc-green/5',
    amber: 'border-hc-amber/30 text-hc-amber bg-hc-amber/5',
    red: 'border-flag-red/30 text-flag-red bg-flag-red/5',
    purple: 'border-purple-500/30 text-purple-700 bg-purple-500/5',
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${color}`}>{children}</span>;
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function isReasonRequired(outcome: MARStaffOutcome) {
  return ['refused', 'declined_after_prompt', 'missed', 'not_available', 'withheld_by_instruction', 'hospital_leave'].includes(outcome);
}

const demoAccess: MedicationAccessProfile = {
  userId: 'demo-med-staff',
  displayTitle: 'Medication trained staff',
  capabilities: ['medicines.view', 'medicines.record_outcome', 'medicines.review_mar', 'medicines.export', 'medicines.view_exceptions'],
  scopes: [{ house: 'Demo Care Home' }],
  medicationCompetency: {
    current: true,
    expiresAt: '2026-12-31',
    assessor: 'Medication Lead',
  },
};

export function MedicationSafetyPage() {
  const [state, setState] = useState<MedicationState>(() => loadMedicationState());
  const [reason, setReason] = useState('Resident declined after prompt; manager review required.');
  const [staffName, setStaffName] = useState('Medication trained staff');
  const [status, setStatus] = useState('');

  const profile = state.profiles[0] || null;
  const activeOrders = state.orderVersions.filter(order => order.status === 'active');
  const exceptions = useMemo(
    () => detectMARExceptions({ events: state.events, orderVersions: state.orderVersions, now: nowIso() }),
    [state.events, state.orderVersions]
  );
  const dueEvents = state.events.filter(event => !event.finalisedAt);
  const recordedEvents = state.events.filter(event => event.finalisedAt);
  const reviewEvents = state.events.filter(event => event.reviewState === 'review_required');
  const accessCheck = profile
    ? canRecordMedicationOutcome(demoAccess, { house: profile.house, residentId: profile.residentId, now: nowIso() })
    : { allowed: false, reason: 'No resident loaded.' };

  function commit(next: MedicationState, message?: string) {
    setState(next);
    saveMedicationState(next);
    if (message) setStatus(message);
  }

  function initialiseDemo() {
    commit(createSyntheticMedicationState(nowIso()), 'Synthetic medication profile, authorised order and MAR schedule created.');
  }

  function regenerateSchedule() {
    if (!profile || activeOrders.length === 0) {
      initialiseDemo();
      return;
    }
    const chart = generateMARChartPeriod({ profile, activeOrderVersions: activeOrders, date: todayIsoDate(), createdAt: nowIso() });
    const chartEventIds = new Set(chart.events.map(event => event.id));
    commit({
      ...state,
      chartPeriods: [chart, ...state.chartPeriods.filter(item => item.id !== chart.id)],
      events: [...state.events.filter(event => !chartEventIds.has(event.id)), ...chart.events],
    }, 'Today MAR schedule regenerated from active authorised medicine orders.');
  }

  function record(event: MARAdministrationEvent, outcome: MARStaffOutcome) {
    if (isReasonRequired(outcome) && !reason.trim()) {
      setStatus(`Reason required before recording ${outcome.replace(/_/g, ' ')}.`);
      return;
    }
    try {
      const recorded = recordMAROutcome(event, {
        outcome,
        supportedOrAdministeredAt: nowIso(),
        recordedAt: nowIso(),
        recordedBy: staffName || 'Medication trained staff',
        reason: isReasonRequired(outcome) ? reason : '',
        notes: outcome === 'administered' ? 'Staff-confirmed visible MAR outcome.' : 'Exception outcome requires manager review.',
        idempotencyKey: `mar-${event.id}-${outcome}-${nowIso()}`,
        expectedEventVersion: event.eventVersion,
      });
      const nextEvents = state.events.map(item => item.id === event.id ? recorded : item);
      commit({ ...state, events: nextEvents }, `${outcome.replace(/_/g, ' ')} recorded. Original event remains versioned.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Medication outcome could not be recorded.');
    }
  }

  function attemptDuplicate(event: MARAdministrationEvent) {
    try {
      recordMAROutcome(event, {
        outcome: 'missed',
        supportedOrAdministeredAt: nowIso(),
        recordedAt: nowIso(),
        recordedBy: staffName || 'Medication trained staff',
        reason: 'Duplicate guard test.',
        idempotencyKey: `duplicate-${nowIso()}`,
        expectedEventVersion: event.eventVersion,
      });
      setStatus('Duplicate guard did not block this event.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Duplicate guard blocked the second outcome.');
    }
  }

  function correctEvent(event: MARAdministrationEvent) {
    if (!event.finalisedAt) {
      setStatus('Only finalised MAR outcomes can receive a correction event.');
      return;
    }
    const corrected = createMARCorrection(event, {
      by: 'Manager review',
      at: nowIso(),
      reason: 'Manager correction appended after review; original MAR entry remains visible.',
      correctedOutcome: 'administered',
      correctedSupportedOrAdministeredAt: event.supportedOrAdministeredAt || nowIso(),
      correctedRecordedAt: nowIso(),
    });
    commit({
      ...state,
      events: state.events.map(item => item.id === event.id ? corrected : item),
    }, 'Append-only MAR correction added.');
  }

  function addEvidenceImport(kind: 'mar' | 'audit') {
    const evidence = kind === 'mar'
      ? evidenceFromNourishMARHtml({
        id: `med-ev-mar-${Date.now()}`,
        sourceName: 'external-mar-export.html',
        html: 'Medication administration report Metformin tablets Dose 1 tablet Route Oral Frequency daily Time period Morning Instruction support and record outcome',
        receivedAt: nowIso(),
      })
      : evidenceFromMedicationAuditText({
        id: `med-ev-audit-${Date.now()}`,
        sourceName: 'synthetic-medication-audit.pdf',
        text: 'Medication Management Audit Form MAR Audit Administered Supported Refused No Outcome Recorded change signal from hospital discharge',
        receivedAt: nowIso(),
      });
    commit({ ...state, evidence: [evidence, ...state.evidence] }, 'Medication import stored as review-required evidence, not an active order.');
  }

  function exportAuditPack(format: 'text' | 'csv') {
    if (!profile) {
      setStatus('No MAR profile available to export.');
      return;
    }
    const pack = buildMARAuditExport({
      profile,
      orderVersions: state.orderVersions,
      events: state.events,
      exceptions,
      generatedAt: nowIso(),
    });
    if (format === 'csv') {
      downloadFile(pack.fileName.replace(/\.txt$/, '.csv'), pack.csv, 'text/csv;charset=utf-8');
    } else {
      downloadFile(pack.fileName, pack.text, 'text/plain;charset=utf-8');
    }
    setStatus(`MAR ${format.toUpperCase()} export generated with source and exception state.`);
  }

  return (
    <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="flex flex-col gap-5 border-b border-hc-border/20 pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-hc-teal/30 bg-hc-teal/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-hc-teal">
            <PillIcon className="h-3.5 w-3.5" />
            Medication governance
          </div>
          <h1 className="mt-5 text-3xl sm:text-4xl font-black uppercase tracking-[0.18em] text-hc-text">
            MAR Safety Spine
          </h1>
          <p className="mt-3 max-w-4xl text-xs font-semibold leading-6 text-hc-muted">
            Verified medication profile, authorised medicine order, generated MAR schedule, staff-confirmed outcome, exception review and export. CareOps records and audits support; it does not prescribe or clinically authorise medicines.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={initialiseDemo} className="hc-clay-raised rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest text-hc-teal">
            Initialise demo MAR
          </button>
          <button onClick={regenerateSchedule} className="hc-clay-raised rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest text-hc-teal">
            Generate schedule
          </button>
          <button onClick={() => exportAuditPack('csv')} className="hc-clay-raised rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest text-hc-teal">
            <Download className="mr-2 inline h-3.5 w-3.5" />
            CSV
          </button>
          <button onClick={() => window.print()} className="hc-clay-raised rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest text-hc-teal">
            <Printer className="mr-2 inline h-3.5 w-3.5" />
            PDF/Print
          </button>
        </div>
      </header>

      {status && (
        <div className="hc-clay-raised rounded-2xl border border-hc-teal/20 px-5 py-4 text-xs font-bold text-hc-text">
          {status}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="hc-clay-raised rounded-3xl p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted">Resident</div>
          <div className="mt-3 text-2xl font-black text-hc-text">{profile?.residentName || 'No profile'}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-hc-muted">{profile?.house || 'Initialise synthetic demo'}</div>
        </div>
        <div className="hc-clay-raised rounded-3xl p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted">Active orders</div>
          <div className="mt-3 text-3xl font-black text-hc-text">{activeOrders.length}</div>
          <Pill tone={activeOrders.length ? 'green' : 'amber'}>{activeOrders.length ? 'verified source' : 'none loaded'}</Pill>
        </div>
        <div className="hc-clay-raised rounded-3xl p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted">MAR events</div>
          <div className="mt-3 text-3xl font-black text-hc-text">{state.events.length}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone="neutral">{recordedEvents.length} recorded</Pill>
            <Pill tone={dueEvents.length ? 'amber' : 'green'}>{dueEvents.length} due</Pill>
          </div>
        </div>
        <div className="hc-clay-raised rounded-3xl p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted">Review items</div>
          <div className="mt-3 text-3xl font-black text-hc-text">{exceptions.length + reviewEvents.length}</div>
          <Pill tone={exceptions.length ? 'red' : 'green'}>{exceptions.length ? 'manager queue' : 'clear'}</Pill>
        </div>
        <div className="hc-clay-raised rounded-3xl p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted">Competency gate</div>
          <div className="mt-3 text-sm font-black text-hc-text">{accessCheck.allowed ? 'Allowed' : 'Blocked'}</div>
          <div className="mt-2 text-[10px] font-semibold leading-4 text-hc-muted">{accessCheck.allowed ? 'Capability, scope and competency present.' : accessCheck.reason}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="hc-clay-raised rounded-[2rem] p-6 space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-[0.14em] text-hc-text">Medication round</h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-hc-muted">Only visible staff confirmation records an outcome. Non-standard outcomes require a reason.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={staffName}
                onChange={(event) => setStaffName(event.target.value)}
                className="hc-clay-inset rounded-2xl border border-hc-border/20 px-4 py-3 text-xs font-bold text-hc-text outline-none"
                placeholder="Staff name"
              />
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="hc-clay-inset rounded-2xl border border-hc-border/20 px-4 py-3 text-xs font-bold text-hc-text outline-none"
                placeholder="Required exception reason"
              />
            </div>
          </div>

          <div className="space-y-3">
            {state.events.length === 0 && (
              <div className="rounded-3xl border border-dashed border-hc-border/40 p-8 text-center">
                <CalendarClock className="mx-auto h-8 w-8 text-hc-muted" />
                <div className="mt-4 text-sm font-black uppercase tracking-widest text-hc-text">No MAR schedule loaded</div>
                <div className="mt-2 text-xs font-semibold text-hc-muted">Initialise the synthetic demo or generate a schedule from an active order.</div>
              </div>
            )}

            {state.events.map(event => {
              const order = state.orderVersions.find(item => item.id === event.medicineOrderVersionId);
              const reviewTone = event.reviewState === 'review_required' ? 'red' : event.finalisedAt ? 'green' : 'amber';
              return (
                <article key={event.id} className="rounded-3xl border border-hc-border/20 bg-hc-surface/45 p-4 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={reviewTone}>{event.reviewState}</Pill>
                        <Pill tone={event.finalisedAt ? 'green' : 'amber'}>{event.outcome || event.status}</Pill>
                      </div>
                      <h3 className="mt-3 text-base font-black text-hc-text">{order ? `${order.medicineName} ${order.strength}` : event.medicineOrderVersionId}</h3>
                      <p className="mt-1 text-xs font-semibold leading-5 text-hc-muted">
                        {order?.dose || 'Dose not loaded'} via {order?.route || 'route not loaded'} | Scheduled {new Date(event.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Window {new Date(event.scheduledWindowStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to {new Date(event.scheduledWindowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {event.finalisedAt && (
                        <p className="mt-2 text-xs font-semibold leading-5 text-hc-text">
                          Supported/administered: {event.supportedOrAdministeredAt ? new Date(event.supportedOrAdministeredAt).toLocaleString() : 'not recorded'} | Recorded: {event.recordedAt ? new Date(event.recordedAt).toLocaleString() : 'not recorded'} by {event.recordedBy}
                        </p>
                      )}
                      {event.reason && <p className="mt-2 text-xs font-semibold leading-5 text-hc-muted">Reason: {event.reason}</p>}
                      {event.correctionHistory.length > 0 && <p className="mt-2 text-xs font-black uppercase tracking-widest text-hc-amber">{event.correctionHistory.length} correction event(s) appended</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {!event.finalisedAt && (
                        <>
                          <button onClick={() => record(event, 'administered')} className="hc-clay-raised rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-teal">
                            Administered
                          </button>
                          <button onClick={() => record(event, 'refused')} className="hc-clay-raised rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-flag-red">
                            Refused
                          </button>
                          <button onClick={() => record(event, 'missed')} className="hc-clay-raised rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-amber">
                            Missed
                          </button>
                          <button onClick={() => record(event, 'hospital_leave')} className="hc-clay-raised rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-muted">
                            Hospital leave
                          </button>
                        </>
                      )}
                      {event.finalisedAt && (
                        <>
                          <button onClick={() => attemptDuplicate(event)} className="hc-clay-raised rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-amber">
                            Duplicate test
                          </button>
                          <button onClick={() => correctEvent(event)} className="hc-clay-raised rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-teal">
                            <RotateCcw className="mr-1 inline h-3 w-3" />
                            Correct
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="hc-clay-raised rounded-[2rem] p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-hc-teal" />
              <h2 className="text-sm font-black uppercase tracking-widest text-hc-text">Authorised source state</h2>
            </div>
            <div className="mt-5 space-y-3">
              {activeOrders.length === 0 && <p className="text-xs font-semibold leading-5 text-hc-muted">No active authorised order loaded. Imports remain evidence until reviewed and verified.</p>}
              {activeOrders.map(order => (
                <div key={order.id} className="rounded-2xl border border-hc-border/20 p-4">
                  <div className="text-sm font-black text-hc-text">{order.medicineName} {order.strength}</div>
                  <div className="mt-2 text-[10px] font-semibold leading-4 text-hc-muted">
                    Source: {order.authorisationSourceType} | Evidence: {order.authorisationEvidenceId} | Verified by {order.verifiedBy}
                  </div>
                  <div className="mt-3">
                    <Pill tone="green">instructions verified, not clinically approved by CareOps</Pill>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hc-clay-raised rounded-[2rem] p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-hc-amber" />
              <h2 className="text-sm font-black uppercase tracking-widest text-hc-text">Manager exception queue</h2>
            </div>
            <div className="mt-5 space-y-3">
              {exceptions.length === 0 && <p className="text-xs font-semibold text-hc-muted">No medication exceptions detected in the current MAR state.</p>}
              {exceptions.slice(0, 8).map(exception => (
                <div key={exception.id} className="rounded-2xl border border-hc-amber/25 bg-hc-amber/5 p-4">
                  <Pill tone={exception.severity === 'urgent' ? 'red' : 'amber'}>{exception.type.replace(/_/g, ' ')}</Pill>
                  <p className="mt-3 text-xs font-semibold leading-5 text-hc-text">{exception.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hc-clay-raised rounded-[2rem] p-6">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-hc-teal" />
              <h2 className="text-sm font-black uppercase tracking-widest text-hc-text">Medication evidence imports</h2>
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-hc-muted">
              External MARs and medication audit documents land as review-required evidence. They cannot overwrite active orders.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => addEvidenceImport('mar')} className="hc-clay-raised rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-teal">
                Add MAR evidence
              </button>
              <button onClick={() => addEvidenceImport('audit')} className="hc-clay-raised rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-teal">
                Add audit evidence
              </button>
              <button onClick={() => exportAuditPack('text')} className="hc-clay-raised rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-teal">
                <ClipboardList className="mr-1 inline h-3 w-3" />
                Audit text
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {state.evidence.slice(0, 4).map(item => (
                <div key={item.id} className="rounded-2xl border border-hc-border/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="purple">{item.sourceType.replace(/_/g, ' ')}</Pill>
                    <Pill tone="amber">{Math.round(item.confidence * 100)}% confidence</Pill>
                  </div>
                  <div className="mt-3 text-xs font-black text-hc-text">{item.sourceName}</div>
                  <p className="mt-2 text-[10px] font-semibold leading-4 text-hc-muted">{item.excerpt}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hc-clay-raised rounded-[2rem] p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-hc-green" />
              <h2 className="text-sm font-black uppercase tracking-widest text-hc-text">Downtime fallback</h2>
            </div>
            <p className="mt-4 text-xs font-semibold leading-5 text-hc-muted">
              V1 downtime is an explicit operating path: print the emergency MAR, continue paper recording under policy, then back-enter records after recovery with downtime labels and manager review.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
