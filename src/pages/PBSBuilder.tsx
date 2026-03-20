import { useState, useRef, useCallback } from 'react';
import { loadClients, saveClient, emptyPBS } from '../lib/client-store';
import { buildPBSHtml } from '../lib/doc-renderer';
import { SignaturePanel, emptySignatories } from '../components/SignaturePad';
import type { FullClient } from '../lib/client-store';
import type { Sig } from '../components/SignaturePad';

interface Props {
  clientId: string;
  onBack: () => void;
}

const SECTIONS = [
  'About Me',
  'Who I Am',
  'Diagnoses & Presentation',
  'Behaviour Communication',
  'Proactive Strategies',
  'Early Warning Signs',
  'Reactive Response',
  'Post-Incident Protocol',
  'Preferences & Triggers',
  'Medication Stream',
  'Network & Reviews',
  'Verification & Sign-Off',
];

// ─── SHARED FIELD COMPONENTS ─────────────────────────────────────────────────

function Field({ label, value, onChange, area = false, rows = 3, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  area?: boolean; rows?: number; placeholder?: string;
}) {
  const cls = 'w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 placeholder:text-hc-muted/20 shadow-inner transition-all focus:bg-hc-dark';
  return (
    <div className="mb-6 group animate-in fade-in slide-in-from-left-2 duration-500">
      <label className="section-header text-[9px] mb-2 ml-1 block opacity-60 tracking-[0.2em] group-focus-within:opacity-100 transition-opacity uppercase">{label}</label>
      {area
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={cls + ' resize-y scrollbar-thin font-medium italic'} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls + ' font-bold'} />}
    </div>
  );
}

function ListField({ label, items, onChange, placeholder = 'Enter objective…', rows = 1 }: {
  label: string; items: string[]; onChange: (items: string[]) => void;
  placeholder?: string; rows?: number;
}) {
  const update = (i: number, v: string) => { const a = [...items]; a[i] = v; onChange(a); };
  const add = () => onChange([...items, '']);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="mb-8 animate-in fade-in slide-in-from-left-2 duration-500">
      <div className="flex items-center justify-between mb-3 px-1">
        <label className="section-header text-[9px] opacity-60 tracking-[0.2em] uppercase">{label}</label>
        <button onClick={add} className="text-[10px] font-black text-hc-teal-light hover:text-white uppercase tracking-widest transition-all">+ Add Entry</button>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 items-start group">
            {rows > 1
              ? <textarea value={item} onChange={e => update(i, e.target.value)} rows={rows} placeholder={placeholder}
                  className="flex-1 bg-hc-dark/60 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 resize-y placeholder:text-hc-muted/20 shadow-inner transition-all font-medium italic" />
              : <input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder}
                  className="flex-1 bg-hc-dark/60 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all font-bold" />}
            <button onClick={() => remove(i)} className="mt-2 w-8 h-8 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-flag-red transition-all opacity-40 group-hover:opacity-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <button onClick={add}
            className="w-full glass-light border-2 border-dashed border-white/5 rounded-[1.5rem] py-6 text-[10px] font-black text-hc-muted hover:text-hc-teal-light hover:border-hc-teal/30 transition-all uppercase tracking-[0.3em] flex items-center justify-center gap-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Initialize Tactical List
          </button>
        )}
      </div>
    </div>
  );
}

function TableEditor({ label, rows, onChange, cols, addRow }: {
  label: string;
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
  cols: { key: string; label: string; area?: boolean }[];
  addRow: () => Record<string, string>;
}) {
  const update = (i: number, key: string, v: string) => {
    const a = [...rows];
    a[i] = { ...a[i], [key]: v };
    onChange(a);
  };
  const add = () => onChange([...rows, addRow()]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  return (
    <div className="mb-8 animate-in fade-in slide-in-from-left-2 duration-500">
      <div className="flex items-center justify-between mb-4 px-1">
        <label className="section-header text-[9px] opacity-60 tracking-[0.2em] uppercase">{label}</label>
        <button onClick={add} className="text-[10px] font-black text-hc-teal-light hover:text-white uppercase tracking-widest transition-all">+ Add Strategy Node</button>
      </div>
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={i} className="glass-light border border-white/5 rounded-[2rem] p-6 relative card-glow group active:scale-[0.99] transition-all">
            <button onClick={() => remove(i)}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-flag-red transition-all opacity-0 group-hover:opacity-100 shadow-xl z-10">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className={`grid gap-6 ${cols.length >= 2 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
              {cols.map(col => (
                <div key={col.key} className={col.area && cols.length === 1 ? 'w-full' : ''}>
                  <label className="section-header text-[8px] mb-2 ml-1 block opacity-40 uppercase tracking-[0.2em]">{col.label}</label>
                  {col.area
                    ? <textarea value={row[col.key] || ''} onChange={e => update(i, col.key, e.target.value)}
                        rows={3} className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 shadow-inner resize-none font-medium italic" />
                    : <input type="text" value={row[col.key] || ''} onChange={e => update(i, col.key, e.target.value)}
                        className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 shadow-inner font-bold" />}
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <button onClick={add}
            className="w-full glass-light border-2 border-dashed border-white/5 rounded-[2rem] py-10 text-[10px] font-black text-hc-muted hover:text-hc-teal-light hover:border-hc-teal/30 transition-all uppercase tracking-[0.3em] flex items-center justify-center gap-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Construct Protocol Grid
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export function PBSBuilder({ clientId, onBack }: Props) {
  const [client, setClient] = useState<FullClient>(() => {
    const all = loadClients();
    return all.find(c => c.id === clientId) || all[0];
  });
  const [section, setSection] = useState(0);
  const [saved, setSaved] = useState(true);
  const [sigs, setSigs] = useState<Sig[]>(() =>
    emptySignatories(
      loadClients().find(c => c.id === clientId)?.completedBy || 'Brooklyn Ruvinga',
      loadClients().find(c => c.id === clientId)?.keyWorker || '',
      loadClients().find(c => c.id === clientId)?.responsible || '',
    )
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const update = useCallback((patch: Partial<FullClient>) => {
    setClient(prev => {
      const next = { ...prev, ...patch };
      saveClient(next);
      setSaved(true);
      return next;
    });
  }, []);

  const updatePBS = useCallback((patch: Partial<NonNullable<FullClient['pbs']>>) => {
    setClient(prev => {
      const today = new Date().toLocaleDateString('en-GB');
      const pbs = { ...(prev.pbs || emptyPBS(today)), ...patch };
      const next = { ...prev, pbs };
      saveClient(next);
      setSaved(true);
      return next;
    });
  }, []);

  const generatePDF = () => {
    const html = buildPBSHtml(client, sigs);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
  };

  const today = new Date().toLocaleDateString('en-GB');
  const pbs = client.pbs || emptyPBS(today);

  const sectionComplete = (i: number) => {
    if (i === 0) return !!(client.name && client.dob);
    if (i === 1) return !!(pbs.aboutText);
    if (i === 2) return pbs.diagnosisRows.some(r => r.diagnosis);
    if (i === 3) return pbs.functionRows.some(r => r.behaviour);
    if (i === 4) return pbs.envStrategies.some(Boolean);
    if (i === 5) return pbs.warningSignRows.some(r => r.sign);
    if (i === 6) return !!(pbs.reactiveStep1);
    if (i === 7) return pbs.postImmediate.some(Boolean);
    if (i === 8) return pbs.whatWorks.some(Boolean);
    if (i === 9) return pbs.medicationRows.some(r => r.name);
    if (i === 10) return !!(pbs.reviewSchedule);
    if (i === 11) return sigs.some(s => s.data);
    return false;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-6 px-8 py-5 glass border-b border-white/10 z-20 shadow-2xl backdrop-blur-3xl">
        <button onClick={onBack}
          className="group flex items-center gap-3 text-hc-muted hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 active:scale-90">
          <span className="w-8 h-8 rounded-xl glass border border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-all">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </span>
          Abort
        </button>
        
        <div className="h-8 w-px bg-white/10 hidden md:block" />
        
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
            <span className="text-shimmer">{client.name || 'UNINITIALIZED NODE'}</span>
            <span className="pill pill-teal text-[9px] font-black tracking-widest px-3 py-0.5 shadow-lg">PBS BLUEPRINT BUILDER</span>
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Strategic Intervention Protocol</span>
            <span className={`text-[10px] font-black uppercase tracking-widest tabular-nums ${saved ? 'text-flag-green' : 'text-flag-amber animate-pulse'}`}>
              {saved ? '✓ DATA SYNCHRONIZED' : '● BUFFERING CHANGES'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={generatePDF}
            className="flex items-center gap-3 px-8 py-3 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all group">
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Transmit Document
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden mesh-bg">
        {/* Section nav */}
        <div className="w-72 flex-shrink-0 border-r border-white/5 overflow-y-auto glass backdrop-blur-3xl scrollbar-thin">
          <div className="p-6 border-b border-white/5 bg-black/20">
            <p className="section-header text-[9px] tracking-[0.3em] opacity-40 uppercase">Module Architecture</p>
          </div>
          <div className="py-4">
            {SECTIONS.map((name, i) => (
              <button key={i} onClick={() => setSection(i)}
                className={`w-full text-left px-6 py-4 text-[11px] font-black uppercase tracking-widest flex items-center gap-4 transition-all duration-500 group relative overflow-hidden active:scale-95
                  ${section === i ? 'bg-hc-teal/10 text-hc-teal-light shadow-[inset_0_0_20px_rgba(20,184,166,0.05)]' : 'text-hc-muted hover:text-white hover:bg-white/5'}`}>
                {section === i && <div className="absolute left-0 top-0 bottom-0 w-1 bg-hc-teal shadow-[0_0_15px_#14b8a6] z-10" />}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-700 relative z-10 ${sectionComplete(i) ? 'bg-hc-teal glow-teal scale-110' : 'bg-white/10 group-hover:bg-white/30'}`} />
                <span className="flex-1 truncate relative z-10 group-hover:translate-x-1 transition-transform duration-500">{name}</span>
                {sectionComplete(i) && (
                  <svg className="w-3.5 h-3.5 text-hc-teal-light/60 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Section content */}
        <div className="flex-1 overflow-y-auto p-10 scrollbar-thin">
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-700">
            
            <div className="mb-12 flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl glass border-2 border-white/10 flex items-center justify-center text-3xl font-black text-hc-teal-light shadow-2xl glow-teal animate-float">
                {section + 1}
              </div>
              <div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase text-shimmer mb-1">{SECTIONS[section]}</h2>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
                  <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-60">Configuring Strategic Data Module {section + 1} of 12</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {/* 0 — About Me */}
              {section === 0 && (
                <div className="animate-in fade-in duration-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <Field label="Personnel Designation" value={client.name} onChange={v => update({ name: v })} />
                    <Field label="Tactical Callsign" value={client.preferredName} onChange={v => update({ preferredName: v })} />
                    <Field label="Temporal ID (DOB)" value={client.dob} onChange={v => update({ dob: v })} />
                    <Field label="Network ID (NHS)" value={client.nhs} onChange={v => update({ nhs: v })} />
                    <Field label="Signal Line (Phone)" value={client.phone} onChange={v => update({ phone: v })} />
                    <Field label="Registry Date" value={client.dateOfAdmission} onChange={v => update({ dateOfAdmission: v })} />
                    <Field label="Recalibration Date" value={client.reviewDate} onChange={v => update({ reviewDate: v })} />
                  </div>
                  <Field label="Operational Sector (Address)" value={client.address} onChange={v => update({ address: v })} area rows={2} />
                  <ListField label="Clinical Classifications" items={client.diagnoses} onChange={v => update({ diagnoses: v })} placeholder="e.g. Spectrum Optimization Protocol" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-8 pt-8 border-t border-white/5">
                    <Field label="Primary Agent" value={client.keyWorker} onChange={v => update({ keyWorker: v })} />
                    <Field label="Command Lead" value={client.responsible} onChange={v => update({ responsible: v })} />
                    <Field label="Intel Specialist" value={client.completedBy} onChange={v => update({ completedBy: v })} />
                    <Field label="Blueprint Version" value={pbs.planDate} onChange={v => updatePBS({ planDate: v })} />
                  </div>
                </div>
              )}

              {/* 1 — Who I Am */}
              {section === 1 && (
                <div className="animate-in fade-in duration-700">
                  <Field label="Strategic Intro (Persona Narrative)" value={pbs.aboutText}
                    onChange={v => updatePBS({ aboutText: v })} area rows={8}
                    placeholder="Synthesize a positive intelligence summary — core strengths, behavioral personality, and operational interests..." />
                  <div className="h-8" />
                  <ListField label="Priority Values" items={pbs.whatMatters}
                    onChange={v => updatePBS({ whatMatters: v })} placeholder="e.g. Autonomous zone — private sanctuary" />
                  <ListField label="Transmission Optimization" items={pbs.communicatesBest}
                    onChange={v => updatePBS({ communicatesBest: v })} placeholder="e.g. Low-latency, calm directive cycles" />
                  <ListField label="Friction Vectors" items={pbs.findsDifficult}
                    onChange={v => updatePBS({ findsDifficult: v })} placeholder="e.g. Real-time frustration management" />
                </div>
              )}

              {/* 2 — Diagnoses */}
              {section === 2 && (
                <div className="animate-in fade-in duration-700">
                  <p className="text-[11px] font-medium text-hc-muted mb-8 leading-relaxed italic border-l-2 border-hc-teal pl-4 py-1">"Analyze how each clinical classification translates into real-time operational behavior for this specific node."</p>
                  <TableEditor
                    label="Intelligence Matrix — Diagnosis Mapping"
                    rows={pbs.diagnosisRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ diagnosisRows: v as unknown as typeof pbs.diagnosisRows })}
                    cols={[
                      { key: 'diagnosis', label: 'Classification' },
                      { key: 'presentation', label: 'Tactical Presentation', area: true },
                    ]}
                    addRow={() => ({ diagnosis: '', presentation: '' })}
                  />
                  <Field label="Universal Operating Principle" value={pbs.keyPrinciple}
                    onChange={v => updatePBS({ keyPrinciple: v })} area rows={4} placeholder="Summarize the core philosophical approach for this node..." />
                </div>
              )}

              {/* 3 — Function */}
              {section === 3 && (
                <div className="animate-in fade-in duration-700">
                  <p className="text-[11px] font-medium text-hc-muted mb-8 leading-relaxed italic border-l-2 border-hc-teal pl-4 py-1">"Decode the behavioral telemetry. Map each action to its underlying unmet signal or communicative function."</p>
                  <TableEditor
                    label="Signal Analysis — Behavioural Mapping"
                    rows={pbs.functionRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ functionRows: v as unknown as typeof pbs.functionRows })}
                    cols={[
                      { key: 'behaviour', label: 'Telemetry Signal' },
                      { key: 'func', label: 'Decoded Unmet Need', area: true },
                    ]}
                    addRow={() => ({ behaviour: '', func: '' })}
                  />
                </div>
              )}

              {/* 4 — Proactive Strategies */}
              {section === 4 && (
                <div className="animate-in fade-in duration-700 space-y-4">
                  <ListField label="Sector Environment Optimization" items={pbs.envStrategies}
                    onChange={v => updatePBS({ envStrategies: v })} />
                  <ListField label="Temporal Structure & Routine" items={pbs.routineStrategies}
                    onChange={v => updatePBS({ routineStrategies: v })} />
                  <ListField label="Human Connection Protocols" items={pbs.relationshipStrategies}
                    onChange={v => updatePBS({ relationshipStrategies: v })} />
                  <ListField label="Signal Transmission Rules" items={pbs.communicationStrategies}
                    onChange={v => updatePBS({ communicationStrategies: v })} />
                  <ListField label="Digital Safety Layer (Optional)" items={pbs.onlineSafetyStrategies || []}
                    onChange={v => updatePBS({ onlineSafetyStrategies: v })} />
                </div>
              )}

              {/* 5 — Early Warning Signs */}
              {section === 5 && (
                <div className="animate-in fade-in duration-700">
                  <p className="text-[11px] font-medium text-hc-muted mb-8 leading-relaxed italic border-l-2 border-hc-teal pl-4 py-1">"Identify pre-incident telemetry patterns and define the immediate neutralizing agent response."</p>
                  <TableEditor
                    label="Surveillance Matrix — Early Warning Signs"
                    rows={pbs.warningSignRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ warningSignRows: v as unknown as typeof pbs.warningSignRows })}
                    cols={[
                      { key: 'sign', label: 'Anomaly Detected', area: true },
                      { key: 'staffAction', label: 'Agent Response Protocol', area: true },
                    ]}
                    addRow={() => ({ sign: '', staffAction: '' })}
                  />
                </div>
              )}

              {/* 6 — Reactive Strategies */}
              {section === 6 && (
                <div className="animate-in fade-in duration-700">
                  <p className="text-[11px] font-medium text-hc-muted mb-8 leading-relaxed italic border-l-2 border-flag-red pl-4 py-1">"Tiered de-escalation cycles in execution order — from initial signal response to emergency backup deployment."</p>
                  <div className="space-y-2">
                    {[
                      ['Phase 1 — Signal Neutralization (Voice/Body)', pbs.reactiveStep1, (v: string) => updatePBS({ reactiveStep1: v })],
                      ['Phase 2 — Tactical Distance (Space)', pbs.reactiveStep2, (v: string) => updatePBS({ reactiveStep2: v })],
                      ['Phase 3 — Demand Shedding', pbs.reactiveStep3, (v: string) => updatePBS({ reactiveStep3: v })],
                      ['Phase 4 — Tactical Redirection (Exact Phrases)', pbs.reactiveStep4, (v: string) => updatePBS({ reactiveStep4: v })],
                      ['Phase 5 — Affective Validation', pbs.reactiveStep5, (v: string) => updatePBS({ reactiveStep5: v })],
                      ['Phase 6 — Conflict Avoidance Protocol', pbs.reactiveStep6, (v: string) => updatePBS({ reactiveStep6: v })],
                      ['Phase 7 — Emergency Escalation / Signal 999', pbs.reactiveStep7, (v: string) => updatePBS({ reactiveStep7: v })],
                    ].map(([label, value, onChange], i) => (
                      <Field key={i} label={label as string} value={value as string} onChange={onChange as (v: string) => void} area rows={2} />
                    ))}
                  </div>
                  <div className="mt-8">
                    <Field label="Self-Regulation Protocols (Optional)" value={pbs.walksNote}
                      onChange={v => updatePBS({ walksNote: v })} area rows={3} placeholder="Define protocols for autonomous regulation cycles..." />
                  </div>
                </div>
              )}

              {/* 7 — Post-Incident */}
              {section === 7 && (
                <div className="animate-in fade-in duration-700 space-y-6">
                  <ListField label="Immediate Post-Event Synthesis" items={pbs.postImmediate}
                    onChange={v => updatePBS({ postImmediate: v })} rows={2} />
                  <ListField label="Deep-Calm Intelligence Debrief" items={pbs.postDebrief}
                    onChange={v => updatePBS({ postDebrief: v })} rows={2} />
                  <ListField label="Agent Responsibilities" items={pbs.staffResponsibilities}
                    onChange={v => updatePBS({ staffResponsibilities: v })} />
                </div>
              )}

              {/* 8 — What Works */}
              {section === 8 && (
                <div className="animate-in fade-in duration-700 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <ListField label="✓ High-Compatibility Factors" items={pbs.whatWorks}
                    onChange={v => updatePBS({ whatWorks: v })} placeholder="e.g. Low-frequency agent vocalization" />
                  <ListField label="✗ System Rejection Vectors" items={pbs.doesntWork}
                    onChange={v => updatePBS({ doesntWork: v })} placeholder="e.g. Escalating vocal pitch or volume" />
                </div>
              )}

              {/* 9 — Medication */}
              {section === 9 && (
                <div className="animate-in fade-in duration-700">
                  <TableEditor
                    label="Pharmacological Stream"
                    rows={pbs.medicationRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ medicationRows: v as unknown as typeof pbs.medicationRows })}
                    cols={[
                      { key: 'name', label: 'Payload Name' },
                      { key: 'dose', label: 'Loadout' },
                      { key: 'when', label: 'Cycle' },
                      { key: 'purpose', label: 'Objective' },
                      { key: 'notes', label: 'Detail' },
                    ]}
                    addRow={() => ({ name: '', dose: '', when: 'AM', purpose: '', notes: '' })}
                  />
                  <div className="mt-8">
                    <Field label="Medication Protocol Notes"
                      value={pbs.medicationNote} onChange={v => updatePBS({ medicationNote: v })} area rows={5}
                      placeholder="Refusal protocols, side-effect telemetry monitoring, and administration preferences..." />
                  </div>
                </div>
              )}

              {/* 10 — Multi-Agency & Review */}
              {section === 10 && (
                <div className="animate-in fade-in duration-700">
                  <TableEditor
                    label="Command Infrastructure (Multi-Agency)"
                    rows={pbs.agencyRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ agencyRows: v as unknown as typeof pbs.agencyRows })}
                    cols={[
                      { key: 'service', label: 'Hub / Agency' },
                      { key: 'role', label: 'Objective Role' },
                      { key: 'status', label: 'Sync Status' },
                    ]}
                    addRow={() => ({ service: '', role: '', status: 'ACTIVE' })}
                  />
                  <div className="h-8" />
                  <Field label="Intelligence Recalibration Schedule" value={pbs.reviewSchedule}
                    onChange={v => updatePBS({ reviewSchedule: v })} area rows={3} />
                  <Field label="Subject Participation Narrative" value={pbs.serviceUserInvolvement}
                    onChange={v => updatePBS({ serviceUserInvolvement: v })} area rows={2} />
                </div>
              )}

              {/* 11 — Signatures */}
              {section === 11 && (
                <div className="animate-in zoom-in-95 duration-700">
                  <SignaturePanel sigs={sigs} onChange={setSigs} />
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-16 pt-8 border-t border-white/5 relative z-10">
              {section > 0
                ? <button onClick={() => setSection(s => s - 1)}
                    className="flex items-center gap-3 px-8 py-4 glass-light border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-white rounded-2xl transition-all duration-500 hover:bg-white/[0.03] active:scale-90 shadow-xl">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    Previous Module
                  </button>
                : <div />}
              {section < SECTIONS.length - 1
                ? <button onClick={() => setSection(s => s + 1)}
                    className="flex items-center gap-3 px-10 py-4 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all">
                    Next Module
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                : <button onClick={generatePDF}
                    className="flex items-center gap-3 px-10 py-4 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all group/btn">
                    <svg className="w-5 h-5 group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Transmit Blueprint
                  </button>}
            </div>
          </div>
        </div>
      </div>

      <iframe ref={iframeRef} style={{ display: 'none' }} title="pbs-print" />
    </div>
  );
}
