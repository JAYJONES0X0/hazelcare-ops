import { useState, useRef, useCallback } from 'react';
import { loadClients, saveClient, emptyRisk, emptyRisk_item } from '../lib/client-store';
import { buildRiskHtml, riskInfo } from '../lib/doc-renderer';
import { SignaturePanel, emptySignatories } from '../components/SignaturePad';
import type { FullClient, RiskItem, AgencyRow } from '../lib/client-store';
import type { Sig } from '../components/SignaturePad';

interface Props {
  clientId: string;
  onBack: () => void;
}

const LIKELIHOOD_LABELS = ['', 'Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const IMPACT_LABELS = ['', 'Negligible', 'Tolerable', 'Undesirable', 'Severe', 'Catastrophic'];

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

function ListField({ label, items, onChange, placeholder = 'Enter item…' }: {
  label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string;
}) {
  const update = (i: number, v: string) => { const a = [...items]; a[i] = v; onChange(a); };
  const add = () => onChange([...items, '']);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
        <button onClick={add} className="text-[11px] text-teal-400 hover:text-teal-300 font-medium">+ Add</button>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder}
              className="flex-1 bg-[#0c1525] border border-[#1e3050] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 placeholder-gray-600" />
            <button onClick={() => remove(i)} className="text-gray-600 hover:text-red-400 text-lg leading-none px-1">×</button>
          </div>
        ))}
        {items.length === 0 && (
          <button onClick={add} className="w-full border border-dashed border-[#1e3050] rounded-lg py-2 text-xs text-gray-500 hover:text-teal-400">
            + Add item
          </button>
        )}
      </div>
    </div>
  );
}

function ScoreSlider({ label, value, onChange, max = 5, labelArr }: {
  label: string; value: number; onChange: (v: number) => void; max?: number; labelArr: string[];
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
        <span className="text-sm font-bold text-white">{value} — {labelArr[value]}</span>
      </div>
      <input type="range" min={1} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-teal-500" />
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
        {Array.from({ length: max }, (_, i) => <span key={i}>{i + 1}</span>)}
      </div>
    </div>
  );
}

function RiskCard({ risk, index, onUpdate, onRemove, defaultOpen }: {
  risk: RiskItem; index: number; onUpdate: (r: RiskItem) => void;
  onRemove: () => void; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { score, color, label } = riskInfo(risk.likelihood, risk.impact);
  const up = (patch: Partial<RiskItem>) => onUpdate({ ...risk, ...patch });

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden`} style={{ borderColor: open ? color : '#1e3050' }}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#0a1120] cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white flex-shrink-0"
          style={{ background: color }}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">
            {risk.title || <span className="text-gray-500 italic">Untitled risk</span>}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {risk.title && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: color }}>
              {score} — {label}
            </span>
          )}
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            className="text-gray-600 hover:text-red-400 text-lg leading-none px-1">×</button>
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Card body */}
      {open && (
        <div className="px-4 py-4 border-t border-[#1e3050] space-y-1">
          <Field label="Risk Title" value={risk.title} onChange={v => up({ title: v })}
            placeholder="e.g. Emotional Dysregulation Resulting in Unsafe Behaviour" />
          <Field label="Description" value={risk.description} onChange={v => up({ description: v })} area rows={3}
            placeholder="Describe the nature of this risk and when it occurs…" />
          <ListField label="Recorded Behaviours (optional)" items={risk.behaviours}
            onChange={v => up({ behaviours: v })} placeholder="e.g. Verbal aggression towards staff" />
          <ListField label="People Who May Be Affected" items={risk.affectedPeople}
            onChange={v => up({ affectedPeople: v })} placeholder="e.g. Support staff" />
          <ListField label="Triggers / Contributing Factors" items={risk.triggers}
            onChange={v => up({ triggers: v })} placeholder="e.g. Changes to routine without warning" />
          <ListField label="Early Warning Signs" items={risk.earlyWarnings}
            onChange={v => up({ earlyWarnings: v })} placeholder="e.g. Raised voice or increased agitation" />
          <ListField label="Control Measures" items={risk.controls}
            onChange={v => up({ controls: v })} placeholder="e.g. PBS plan in place — all staff must follow it" />
          <Field label="Review Trigger" value={risk.reviewTrigger}
            onChange={v => up({ reviewTrigger: v })}
            placeholder="e.g. Following any significant incident or change in presentation" />

          {/* Score */}
          <div className="bg-[#0a1120] border border-[#1e3050] rounded-xl p-4 mt-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-4">Residual Risk Scoring</p>
            <ScoreSlider label="Likelihood" value={risk.likelihood} onChange={v => up({ likelihood: v })}
              labelArr={LIKELIHOOD_LABELS} />
            <ScoreSlider label="Impact" value={risk.impact} onChange={v => up({ impact: v })}
              labelArr={IMPACT_LABELS} />
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e3050]">
              <span className="text-sm text-gray-400">Residual Risk Score:</span>
              <span className="text-xl font-black" style={{ color }}>{score}</span>
              <span className="text-sm font-bold px-3 py-1 rounded-full text-white" style={{ background: color }}>
                {label}
              </span>
              <span className="text-xs text-gray-500">({risk.likelihood} × {risk.impact})</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgencyTable({ rows, onChange }: { rows: AgencyRow[]; onChange: (r: AgencyRow[]) => void }) {
  const update = (i: number, key: keyof AgencyRow, v: string) => {
    const a = [...rows]; a[i] = { ...a[i], [key]: v }; onChange(a);
  };
  const add = () => onChange([...rows, { service: '', role: '', status: 'Active' }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Multi-Agency Involvement</label>
        <button onClick={add} className="text-[11px] text-teal-400 hover:text-teal-300 font-medium">+ Add Row</button>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <input value={row.service} onChange={e => update(i, 'service', e.target.value)} placeholder="Service"
              className="bg-[#0c1525] border border-[#1e3050] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500" />
            <input value={row.role} onChange={e => update(i, 'role', e.target.value)} placeholder="Role"
              className="bg-[#0c1525] border border-[#1e3050] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500" />
            <div className="flex gap-2">
              <input value={row.status} onChange={e => update(i, 'status', e.target.value)} placeholder="Status"
                className="flex-1 bg-[#0c1525] border border-[#1e3050] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500" />
              <button onClick={() => remove(i)} className="text-gray-600 hover:text-red-400 text-lg leading-none px-1">×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export function RiskBuilder({ clientId, onBack }: Props) {
  const [client, setClient] = useState<FullClient>(() => {
    const all = loadClients();
    return all.find(c => c.id === clientId) || all[0];
  });
  const [saved, setSaved] = useState(true);
  const [sigs, setSigs] = useState<Sig[]>(() => {
    const c = loadClients().find(x => x.id === clientId);
    return emptySignatories(c?.completedBy || 'Brooklyn Ruvinga', c?.keyWorker || '', c?.responsible || '');
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const persist = (next: FullClient) => { saveClient(next); setSaved(true); };

  const updateRisk = useCallback((patch: Partial<NonNullable<FullClient['risk']>>) => {
    setClient(prev => {
      const today = new Date().toLocaleDateString('en-GB');
      const risk = { ...(prev.risk || emptyRisk(today)), ...patch };
      const next = { ...prev, risk };
      persist(next);
      return next;
    });
  }, []);

  const updateRiskItem = (index: number, item: RiskItem) => {
    const risks = [...(client.risk?.risks || [])];
    risks[index] = item;
    updateRisk({ risks });
  };

  const addRisk = () => {
    const risks = [...(client.risk?.risks || []), emptyRisk_item()];
    updateRisk({ risks });
  };

  const removeRisk = (index: number) => {
    const risks = (client.risk?.risks || []).filter((_, i) => i !== index);
    updateRisk({ risks });
  };

  const generatePDF = () => {
    const html = buildRiskHtml(client, sigs);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
  };

  const today = new Date().toLocaleDateString('en-GB');
  const risk = client.risk || emptyRisk(today);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e3050] bg-[#060b14] sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium">
          ← Back
        </button>
        <div className="w-px h-5 bg-[#1e3050]" />
        <div>
          <span className="text-sm font-semibold text-white">{client.name || 'New Client'}</span>
          <span className="text-xs text-gray-500 ml-2">Risk Assessment</span>
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

      <div className="p-6 max-w-3xl mx-auto w-full">
        {/* Risk summary bar */}
        {risk.risks.filter(r => r.title).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {risk.risks.filter(r => r.title).map((r, i) => {
              const { score, color, label } = riskInfo(r.likelihood, r.impact);
              return (
                <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ background: color + '33', color, border: `1px solid ${color}` }}>
                  {i + 1}. {r.title.length > 30 ? r.title.slice(0, 30) + '…' : r.title} — {score} ({label})
                </span>
              );
            })}
          </div>
        )}

        {/* Risk cards */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">
            Risk Items ({risk.risks.filter(r => r.title).length} of {risk.risks.length})
          </h2>
          <button onClick={addRisk}
            className="bg-teal-900/40 hover:bg-teal-800/40 border border-teal-800 text-teal-400 text-sm font-semibold px-4 py-1.5 rounded-lg">
            + Add Risk
          </button>
        </div>

        {risk.risks.map((r, i) => (
          <RiskCard key={r.id} risk={r} index={i}
            onUpdate={item => updateRiskItem(i, item)}
            onRemove={() => removeRisk(i)}
            defaultOpen={i === 0 && !r.title} />
        ))}

        {/* Global fields */}
        <div className="mt-8 pt-6 border-t border-[#1e3050]">
          <h3 className="text-sm font-bold text-white mb-4">Multi-Agency & Policy Statements</h3>
          <AgencyTable rows={risk.multiAgencyRows} onChange={v => updateRisk({ multiAgencyRows: v })} />
          <Field label="Least Restrictive Practice Statement" value={risk.leastRestrictivePractice}
            onChange={v => updateRisk({ leastRestrictivePractice: v })} area rows={4} />
          <Field label="Review Schedule" value={risk.reviewSchedule}
            onChange={v => updateRisk({ reviewSchedule: v })} area rows={3} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of Assessment" value={risk.planDate}
              onChange={v => updateRisk({ planDate: v })} />
            <Field label="Review Date (on client info)" value={client.reviewDate}
              onChange={v => setClient(prev => { const n = { ...prev, reviewDate: v }; persist(n); return n; })} />
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-8 pt-6 border-t border-[#1e3050]">
          <SignaturePanel sigs={sigs} onChange={setSigs} />
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={generatePDF}
            className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-6 py-2.5 rounded-lg">
            Generate Risk Assessment PDF
          </button>
        </div>
      </div>

      <iframe ref={iframeRef} style={{ display: 'none' }} title="risk-print" />
    </div>
  );
}
