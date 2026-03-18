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
  'Client Info',
  'About the Person',
  'Diagnoses',
  'Function of Behaviour',
  'Proactive Strategies',
  'Early Warning Signs',
  'Reactive Strategies',
  'Post-Incident',
  "What Works / Doesn't",
  'Medication',
  'Multi-Agency & Review',
  'Signatures',
];

// ─── SHARED FIELD COMPONENTS ─────────────────────────────────────────────────

function Field({ label, value, onChange, area = false, rows = 3, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  area?: boolean; rows?: number; placeholder?: string;
}) {
  const cls = 'w-full bg-[#0c1525] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 placeholder-gray-600';
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</label>
      {area
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={cls + ' resize-y'} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />}
    </div>
  );
}

function ListField({ label, items, onChange, placeholder = 'Enter item…', rows = 1 }: {
  label: string; items: string[]; onChange: (items: string[]) => void;
  placeholder?: string; rows?: number;
}) {
  const update = (i: number, v: string) => { const a = [...items]; a[i] = v; onChange(a); };
  const add = () => onChange([...items, '']);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
        <button onClick={add} className="text-[11px] text-teal-400 hover:text-teal-300 font-medium">+ Add</button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            {rows > 1
              ? <textarea value={item} onChange={e => update(i, e.target.value)} rows={rows} placeholder={placeholder}
                  className="flex-1 bg-[#0c1525] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 resize-y placeholder-gray-600" />
              : <input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder}
                  className="flex-1 bg-[#0c1525] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 placeholder-gray-600" />}
            <button onClick={() => remove(i)} className="mt-2 text-gray-600 hover:text-red-400 text-lg leading-none px-1">×</button>
          </div>
        ))}
        {items.length === 0 && (
          <button onClick={add}
            className="w-full border border-dashed border-[#1e3050] rounded-lg py-2 text-xs text-gray-500 hover:text-teal-400 hover:border-teal-800">
            + Add item
          </button>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
        <button onClick={add} className="text-[11px] text-teal-400 hover:text-teal-300 font-medium">+ Add Row</button>
      </div>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="bg-[#0a1120] border border-[#1e3050] rounded-lg p-3 relative">
            <button onClick={() => remove(i)}
              className="absolute top-2 right-2 text-gray-600 hover:text-red-400 text-sm">×</button>
            <div className={`grid gap-3 ${cols.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {cols.map(col => (
                <div key={col.key}>
                  <label className="block text-[10px] text-gray-500 mb-1">{col.label}</label>
                  {col.area
                    ? <textarea value={row[col.key] || ''} onChange={e => update(i, col.key, e.target.value)}
                        rows={2} className="w-full bg-[#0c1525] border border-[#1e3050] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 resize-y" />
                    : <input type="text" value={row[col.key] || ''} onChange={e => update(i, col.key, e.target.value)}
                        className="w-full bg-[#0c1525] border border-[#1e3050] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500" />}
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <button onClick={add}
            className="w-full border border-dashed border-[#1e3050] rounded-lg py-2 text-xs text-gray-500 hover:text-teal-400 hover:border-teal-800">
            + Add row
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
    <div className="flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e3050] bg-[#060b14] sticky top-0 z-10">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium">
          ← Back
        </button>
        <div className="w-px h-5 bg-[#1e3050]" />
        <div>
          <span className="text-sm font-semibold text-white">{client.name || 'New Client'}</span>
          <span className="text-xs text-gray-500 ml-2">PBS Plan</span>
        </div>
        <div className="flex-1" />
        <span className={`text-[11px] font-medium ${saved ? 'text-teal-500' : 'text-amber-400'}`}>
          {saved ? '✓ Saved' : '● Unsaved'}
        </span>
        <button onClick={generatePDF}
          className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Generate PDF
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Section nav */}
        <div className="w-48 flex-shrink-0 border-r border-[#1e3050] overflow-y-auto bg-[#060b14]">
          {SECTIONS.map((name, i) => (
            <button key={i} onClick={() => setSection(i)}
              className={`w-full text-left px-4 py-2.5 text-[12px] font-medium flex items-center gap-2 transition-colors
                ${section === i ? 'bg-teal-900/40 text-teal-400 border-r-2 border-teal-500' : 'text-gray-400 hover:text-white hover:bg-[#111b2e]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sectionComplete(i) ? 'bg-teal-500' : 'bg-[#1e3050]'}`} />
              {name}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">

            {/* 0 — Client Info */}
            {section === 0 && (
              <div>
                <h2 className="text-base font-bold text-white mb-5">Client Information</h2>
                <div className="grid grid-cols-2 gap-x-4">
                  <Field label="Full Name" value={client.name} onChange={v => update({ name: v })} />
                  <Field label="Preferred Name" value={client.preferredName} onChange={v => update({ preferredName: v })} />
                  <Field label="Date of Birth (DD/MM/YYYY)" value={client.dob} onChange={v => update({ dob: v })} />
                  <Field label="NHS Number" value={client.nhs} onChange={v => update({ nhs: v })} />
                  <Field label="Phone" value={client.phone} onChange={v => update({ phone: v })} />
                  <Field label="Date of Admission" value={client.dateOfAdmission} onChange={v => update({ dateOfAdmission: v })} />
                  <Field label="Review Date" value={client.reviewDate} onChange={v => update({ reviewDate: v })} />
                </div>
                <Field label="Address" value={client.address} onChange={v => update({ address: v })} />
                <ListField label="Diagnoses" items={client.diagnoses} onChange={v => update({ diagnoses: v })} placeholder="e.g. Autism Spectrum Disorder (ASD)" />
                <div className="grid grid-cols-2 gap-x-4">
                  <Field label="Key Worker" value={client.keyWorker} onChange={v => update({ keyWorker: v })} />
                  <Field label="Responsible Person" value={client.responsible} onChange={v => update({ responsible: v })} />
                  <Field label="Completed By" value={client.completedBy} onChange={v => update({ completedBy: v })} />
                  <Field label="Plan Date" value={pbs.planDate} onChange={v => updatePBS({ planDate: v })} />
                </div>
              </div>
            )}

            {/* 1 — About */}
            {section === 1 && (
              <div>
                <h2 className="text-base font-bold text-white mb-5">About the Person</h2>
                <Field label="About (main paragraph)" value={pbs.aboutText}
                  onChange={v => updatePBS({ aboutText: v })} area rows={5}
                  placeholder="Write a positive introduction to this person — strengths, personality, interests…" />
                <ListField label="What Matters Most to Them" items={pbs.whatMatters}
                  onChange={v => updatePBS({ whatMatters: v })} placeholder="e.g. Their bedroom — their private safe space" />
                <ListField label="Communicates Best When…" items={pbs.communicatesBest}
                  onChange={v => updatePBS({ communicatesBest: v })} placeholder="e.g. Spoken to calmly with time to process" />
                <ListField label="Finds It Difficult To…" items={pbs.findsDifficult}
                  onChange={v => updatePBS({ findsDifficult: v })} placeholder="e.g. Managing frustration in the moment" />
              </div>
            )}

            {/* 2 — Diagnoses */}
            {section === 2 && (
              <div>
                <h2 className="text-base font-bold text-white mb-1">Diagnoses and How They Present</h2>
                <p className="text-xs text-gray-500 mb-5">Describe how each diagnosis presents for this specific person.</p>
                <TableEditor
                  label="Diagnosis Rows"
                  rows={pbs.diagnosisRows as unknown as Record<string, string>[]}
                  onChange={v => updatePBS({ diagnosisRows: v as unknown as typeof pbs.diagnosisRows })}
                  cols={[
                    { key: 'diagnosis', label: 'Diagnosis' },
                    { key: 'presentation', label: 'How it presents', area: true },
                  ]}
                  addRow={() => ({ diagnosis: '', presentation: '' })}
                />
                <Field label="Key Principle (shown below the table)" value={pbs.keyPrinciple}
                  onChange={v => updatePBS({ keyPrinciple: v })} area rows={3} />
              </div>
            )}

            {/* 3 — Function */}
            {section === 3 && (
              <div>
                <h2 className="text-base font-bold text-white mb-1">Function of Behaviour</h2>
                <p className="text-xs text-gray-500 mb-5">What is each behaviour communicating? What unmet need does it express?</p>
                <TableEditor
                  label="Behaviour / Function Rows"
                  rows={pbs.functionRows as unknown as Record<string, string>[]}
                  onChange={v => updatePBS({ functionRows: v as unknown as typeof pbs.functionRows })}
                  cols={[
                    { key: 'behaviour', label: 'Behaviour' },
                    { key: 'func', label: 'Function / Unmet Need', area: true },
                  ]}
                  addRow={() => ({ behaviour: '', func: '' })}
                />
              </div>
            )}

            {/* 4 — Proactive Strategies */}
            {section === 4 && (
              <div>
                <h2 className="text-base font-bold text-white mb-5">Proactive Strategies</h2>
                <ListField label="Environmental Strategies" items={pbs.envStrategies}
                  onChange={v => updatePBS({ envStrategies: v })} />
                <ListField label="Routine & Structure Strategies" items={pbs.routineStrategies}
                  onChange={v => updatePBS({ routineStrategies: v })} />
                <ListField label="Relationship Strategies" items={pbs.relationshipStrategies}
                  onChange={v => updatePBS({ relationshipStrategies: v })} />
                <ListField label="Communication Strategies" items={pbs.communicationStrategies}
                  onChange={v => updatePBS({ communicationStrategies: v })} />
                <ListField label="Online Safety Strategies (optional)" items={pbs.onlineSafetyStrategies || []}
                  onChange={v => updatePBS({ onlineSafetyStrategies: v })} />
              </div>
            )}

            {/* 5 — Early Warning Signs */}
            {section === 5 && (
              <div>
                <h2 className="text-base font-bold text-white mb-1">Early Warning Signs and Staff Response</h2>
                <p className="text-xs text-gray-500 mb-5">Signs that the person is becoming dysregulated — and what staff should do.</p>
                <TableEditor
                  label="Warning Sign Rows"
                  rows={pbs.warningSignRows as unknown as Record<string, string>[]}
                  onChange={v => updatePBS({ warningSignRows: v as unknown as typeof pbs.warningSignRows })}
                  cols={[
                    { key: 'sign', label: 'Early Warning Sign', area: true },
                    { key: 'staffAction', label: 'Recommended Staff Response', area: true },
                  ]}
                  addRow={() => ({ sign: '', staffAction: '' })}
                />
              </div>
            )}

            {/* 6 — Reactive Strategies */}
            {section === 6 && (
              <div>
                <h2 className="text-base font-bold text-white mb-1">Reactive Strategies</h2>
                <p className="text-xs text-gray-500 mb-5">De-escalation steps in order — from early response to emergency contact.</p>
                {[
                  ['Step 1 — Lower voice and body language', pbs.reactiveStep1, (v: string) => updatePBS({ reactiveStep1: v })],
                  ['Step 2 — Give physical space', pbs.reactiveStep2, (v: string) => updatePBS({ reactiveStep2: v })],
                  ['Step 3 — Remove demands', pbs.reactiveStep3, (v: string) => updatePBS({ reactiveStep3: v })],
                  ['Step 4 — Offer coping options (exact words)', pbs.reactiveStep4, (v: string) => updatePBS({ reactiveStep4: v })],
                  ['Step 5 — Validate feelings', pbs.reactiveStep5, (v: string) => updatePBS({ reactiveStep5: v })],
                  ['Step 6 — Avoid physical confrontation', pbs.reactiveStep6, (v: string) => updatePBS({ reactiveStep6: v })],
                  ['Step 7 — Escalate / Emergency', pbs.reactiveStep7, (v: string) => updatePBS({ reactiveStep7: v })],
                ].map(([label, value, onChange], i) => (
                  <Field key={i} label={label as string} value={value as string} onChange={onChange as (v: string) => void} area rows={2} />
                ))}
                <Field label="Note on Self-Regulation / Walks (optional info box)" value={pbs.walksNote}
                  onChange={v => updatePBS({ walksNote: v })} area rows={2} />
              </div>
            )}

            {/* 7 — Post-Incident */}
            {section === 7 && (
              <div>
                <h2 className="text-base font-bold text-white mb-5">Post-Incident Support and Recovery</h2>
                <ListField label="Immediate Post-Incident Actions" items={pbs.postImmediate}
                  onChange={v => updatePBS({ postImmediate: v })} rows={2} />
                <ListField label="Debrief (When Calm)" items={pbs.postDebrief}
                  onChange={v => updatePBS({ postDebrief: v })} rows={2} />
                <ListField label="Staff Responsibilities" items={pbs.staffResponsibilities}
                  onChange={v => updatePBS({ staffResponsibilities: v })} />
              </div>
            )}

            {/* 8 — What Works */}
            {section === 8 && (
              <div>
                <h2 className="text-base font-bold text-white mb-5">What Works Well / What Does Not Work</h2>
                <ListField label="✓ What Works Well" items={pbs.whatWorks}
                  onChange={v => updatePBS({ whatWorks: v })} placeholder="e.g. Calm, quiet voice from staff" />
                <ListField label="✗ What Does Not Work" items={pbs.doesntWork}
                  onChange={v => updatePBS({ doesntWork: v })} placeholder="e.g. Raising voices or matching their agitation" />
              </div>
            )}

            {/* 9 — Medication */}
            {section === 9 && (
              <div>
                <h2 className="text-base font-bold text-white mb-5">Medication</h2>
                <TableEditor
                  label="Medication Rows"
                  rows={pbs.medicationRows as unknown as Record<string, string>[]}
                  onChange={v => updatePBS({ medicationRows: v as unknown as typeof pbs.medicationRows })}
                  cols={[
                    { key: 'name', label: 'Medication Name' },
                    { key: 'dose', label: 'Dose' },
                    { key: 'when', label: 'When' },
                    { key: 'purpose', label: 'Purpose' },
                    { key: 'notes', label: 'Notes' },
                  ]}
                  addRow={() => ({ name: '', dose: '', when: 'Morning', purpose: '', notes: '' })}
                />
                <Field label="Medication Notes (administration preferences, refusal protocol, side effects to monitor)"
                  value={pbs.medicationNote} onChange={v => updatePBS({ medicationNote: v })} area rows={4} />
              </div>
            )}

            {/* 10 — Multi-Agency & Review */}
            {section === 10 && (
              <div>
                <h2 className="text-base font-bold text-white mb-5">Multi-Agency Involvement & Review</h2>
                <TableEditor
                  label="Multi-Agency Rows"
                  rows={pbs.agencyRows as unknown as Record<string, string>[]}
                  onChange={v => updatePBS({ agencyRows: v as unknown as typeof pbs.agencyRows })}
                  cols={[
                    { key: 'service', label: 'Service / Agency' },
                    { key: 'role', label: 'Role' },
                    { key: 'status', label: 'Status' },
                  ]}
                  addRow={() => ({ service: '', role: '', status: 'Active' })}
                />
                <Field label="Review Schedule" value={pbs.reviewSchedule}
                  onChange={v => updatePBS({ reviewSchedule: v })} area rows={3} />
                <Field label="Service User Involvement" value={pbs.serviceUserInvolvement}
                  onChange={v => updatePBS({ serviceUserInvolvement: v })} area rows={2} />
              </div>
            )}

            {/* 11 — Signatures */}
            {section === 11 && (
              <SignaturePanel sigs={sigs} onChange={setSigs} />
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-[#1e3050]">
              {section > 0
                ? <button onClick={() => setSection(s => s - 1)}
                    className="text-sm text-gray-400 hover:text-white font-medium">← Previous</button>
                : <div />}
              {section < SECTIONS.length - 1
                ? <button onClick={() => setSection(s => s + 1)}
                    className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                    Next →
                  </button>
                : <button onClick={generatePDF}
                    className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                    Generate PDF
                  </button>}
            </div>
          </div>
        </div>
      </div>

      <iframe ref={iframeRef} style={{ display: 'none' }} title="pbs-print" />
    </div>
  );
}
