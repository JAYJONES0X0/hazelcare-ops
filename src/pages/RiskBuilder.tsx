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

function ListField({ label, items, onChange, placeholder = 'Enter details…' }: {
  label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string;
}) {
  const update = (i: number, v: string) => { const a = [...items]; a[i] = v; onChange(a); };
  const add = () => onChange([...items, '']);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="mb-8 animate-in fade-in slide-in-from-left-2 duration-500">
      <div className="flex items-center justify-between mb-3 px-1">
        <label className="section-header text-[9px] opacity-60 tracking-[0.2em] uppercase">{label}</label>
        <button onClick={add} className="text-[10px] font-black text-hc-teal-light hover:text-white uppercase tracking-widest transition-all">+ Add Item</button>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 items-center group">
            <input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder}
              className="flex-1 bg-hc-dark/60 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all font-bold" />
            <button onClick={() => remove(i)} className="w-8 h-8 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-flag-red transition-all opacity-40 group-hover:opacity-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <button onClick={add}
            className="w-full glass-light border-2 border-dashed border-white/5 rounded-[1.5rem] py-6 text-[10px] font-black text-hc-muted hover:text-hc-teal-light hover:border-hc-teal/30 transition-all uppercase tracking-[0.3em] flex items-center justify-center gap-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Initialize List
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
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <label className="section-header text-[9px] font-black uppercase tracking-[0.2em] opacity-60">{label}</label>
        <span className="pill pill-teal text-[10px] font-black tracking-widest px-3 py-1 shadow-lg">{value} — {labelArr[value].toUpperCase()}</span>
      </div>
      <div className="relative pt-1 px-1">
        <input type="range" min={1} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
          className="w-full h-2 bg-hc-dark/80 rounded-full appearance-none cursor-pointer accent-hc-teal shadow-inner border border-white/5" />
        <div className="flex justify-between px-1 mt-3">
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={`text-[9px] font-black tabular-nums transition-all ${value === i + 1 ? 'text-hc-teal-light scale-125' : 'text-hc-muted/30'}`}>{i + 1}</span>
          ))}
        </div>
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
    <div className={`glass-light border transition-all duration-500 rounded-[2.5rem] mb-6 overflow-hidden card-glow group
      ${open ? 'shadow-2xl z-10' : 'hover:border-hc-teal/30'}`} style={{ borderColor: open ? color + '60' : 'rgba(255,255,255,0.05)' }}>
      {/* Card header */}
      <div className={`flex flex-col md:flex-row md:items-center gap-4 px-8 py-6 cursor-pointer relative overflow-hidden transition-all
        ${open ? 'bg-black/20' : 'bg-transparent'}`} onClick={() => setOpen(o => !o)}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.03] blur-[60px] -translate-y-1/2 translate-x-1/2 transition-opacity group-hover:opacity-[0.06]" style={{ background: color }} />
        
        <div className="flex items-center gap-5 flex-1 min-w-0 relative z-10">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-xl transition-transform group-hover:scale-110 duration-500 border border-white/10"
            style={{ background: color }}>
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-xl font-black tracking-tighter uppercase transition-colors
              ${risk.title ? 'text-white group-hover:text-hc-teal-light' : 'text-hc-muted italic opacity-40'}`}>
              {risk.title || 'NEW RISK AREA — CONFIGURE DETAILS'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 relative z-10 shrink-0 md:pl-8 md:border-l md:border-white/5">
          {risk.title && (
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1 opacity-50">SCORE: {risk.likelihood}×{risk.impact}</span>
              <span className="pill text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1 shadow-xl animate-pulse-soft"
                style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
                {score} — {label}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              className="w-9 h-9 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-flag-red transition-all shadow-lg opacity-40 hover:opacity-100 group/del">
              <svg className="w-4 h-4 group-hover/del:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <div className={`w-9 h-9 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted group-hover:text-white transition-all duration-500 shadow-lg ${open ? 'rotate-180 bg-white/5' : ''}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Card body */}
      {open && (
        <div className="px-8 py-10 border-t border-white/5 space-y-2 animate-in slide-in-from-top-4 duration-500 bg-black/10 backdrop-blur-3xl">
          <Field label="Risk Title" value={risk.title} onChange={v => up({ title: v })}
            placeholder="e.g. Falls risk during morning routine" />
          <Field label="Description & Context" value={risk.description} onChange={v => up({ description: v })} area rows={4}
            placeholder="Describe the nature of this risk and what triggers it..." />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
            <ListField label="Behaviors or Signs" items={risk.behaviours}
              onChange={v => up({ behaviours: v })} placeholder="e.g. Unsteady walking" />
            <ListField label="People Affected" items={risk.affectedPeople}
              onChange={v => up({ affectedPeople: v })} placeholder="e.g. Staff supporting with Mobility, Movement & Exercise" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-6">
            <ListField label="Triggers & Factors" items={risk.triggers}
              onChange={v => up({ triggers: v })} placeholder="e.g. Rushing or uneven floors" />
            <ListField label="Warning Signs" items={risk.earlyWarnings}
              onChange={v => up({ earlyWarnings: v })} placeholder="e.g. Attempting to stand without support" />
          </div>

          <ListField label="Actions to Manage Risk" items={risk.controls}
            onChange={v => up({ controls: v })} placeholder="e.g. Staff to provide steadying support" />
          
          <Field label="Review Trigger" value={risk.reviewTrigger}
            onChange={v => up({ reviewTrigger: v })}
            placeholder="e.g. Following any fall or change in Mobility, Movement & Exercise" />

          {/* Score */}
          <div className="glass border-2 border-white/5 rounded-[2.5rem] p-8 mt-10 shadow-2xl relative overflow-hidden group/score">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover/score:opacity-100 transition-opacity duration-1000" />
            <div className="section-header text-[10px] font-black uppercase tracking-[0.3em] mb-10 text-shimmer flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
              Risk Evaluation
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <ScoreSlider label="Likelihood" value={risk.likelihood} onChange={v => up({ likelihood: v })}
                labelArr={LIKELIHOOD_LABELS} />
              <ScoreSlider label="Impact" value={risk.impact} onChange={v => up({ impact: v })}
                labelArr={IMPACT_LABELS} />
            </div>
            <div className="flex items-center gap-6 mt-10 pt-8 border-t border-white/5 relative z-10">
              <div className="text-sm font-black text-hc-muted uppercase tracking-[0.2em]">Risk Rating:</div>
              <div className="text-4xl font-black tabular-nums tracking-tighter shadow-2xl" style={{ color, textShadow: `0 0 30px ${color}40` }}>{score}</div>
              <div className="pill text-[11px] font-black uppercase tracking-[0.2em] px-6 py-2 shadow-2xl animate-shimmer" style={{ background: color + '33', color, border: `1px solid ${color}60` }}>
                {label}
              </div>
              <span className="text-[10px] font-bold text-hc-muted/40 uppercase tracking-widest ml-auto tabular-nums">CALCULATION: {risk.likelihood} × {risk.impact}</span>
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
  const add = () => onChange([...rows, { service: '', role: '', status: 'ACTIVE' }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  return (
    <div className="mb-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-4 px-1">
        <label className="section-header text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Professional Network — Involved Agencies</label>
        <button onClick={add} className="text-[10px] font-black text-hc-teal-light hover:text-white uppercase tracking-widest transition-all">+ Add Agency</button>
      </div>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center group">
            <input value={row.service} onChange={e => update(i, 'service', e.target.value)} placeholder="Service / Agency Name"
              className="bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-hc-teal/50 shadow-inner font-bold" />
            <input value={row.role} onChange={e => update(i, 'role', e.target.value)} placeholder="Role / Responsibility"
              className="bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-hc-teal/50 shadow-inner font-bold" />
            <div className="flex gap-3">
              <input value={row.status} onChange={e => update(i, 'status', e.target.value)} placeholder="Current Status"
                className="flex-1 bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-hc-teal-light focus:outline-none focus:border-hc-teal/50 shadow-inner" />
              <button onClick={() => remove(i)} className="w-9 h-9 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-flag-red transition-all opacity-40 group-hover:opacity-100 shadow-lg">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <button onClick={add}
            className="w-full glass-light border-2 border-dashed border-white/5 rounded-2xl py-6 text-[10px] font-black text-hc-muted hover:text-hc-teal-light hover:border-hc-teal/30 transition-all uppercase tracking-[0.3em] flex items-center justify-center gap-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Agency Details
          </button>
        )}
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
    <div className="flex flex-col h-screen overflow-hidden animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-6 px-8 py-5 glass border-b border-white/10 z-20 shadow-2xl backdrop-blur-3xl">
        <button onClick={onBack}
          className="group flex items-center gap-3 text-hc-muted hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 active:scale-90">
          <span className="w-8 h-8 rounded-xl glass border border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-all">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </span>
          Back
        </button>
        
        <div className="h-8 w-px bg-white/10 hidden md:block" />
        
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
            <span className="text-shimmer">{client.name || 'PERSON PROFILE'}</span>
            <span className="pill pill-amber text-[9px] font-black tracking-widest px-3 py-0.5 shadow-lg">RISK ASSESSMENT BUILDER</span>
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Service Safety & Risk Planning</span>
            <span className={`text-[10px] font-black uppercase tracking-widest tabular-nums ${saved ? 'text-flag-green' : 'text-flag-amber animate-pulse'}`}>
              {saved ? '✓ DATA SAVED' : '● SAVING CHANGES...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={generatePDF}
            className="flex items-center gap-3 px-8 py-3 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all group">
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Assessment
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mesh-bg p-10 scrollbar-thin">
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-700 pb-24">
          
          {/* Risk summary bar */}
          {risk.risks.filter(r => r.title).length > 0 && (
            <div className="flex flex-wrap gap-2.5 mb-12 animate-in fade-in zoom-in-95 duration-700">
              {risk.risks.filter(r => r.title).map((r, i) => {
                const { score, color, label } = riskInfo(r.likelihood, r.impact);
                return (
                  <span key={i} className="pill text-[9px] font-black uppercase tracking-[0.15em] px-4 py-2 shadow-xl transition-all duration-500 hover:scale-110 active:scale-95 cursor-default"
                    style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
                    {i + 1}. {r.title.length > 30 ? r.title.slice(0, 30) + '…' : r.title} — {score} ({label})
                  </span>
                );
              })}
            </div>
          )}

          {/* Header row */}
          <div className="flex items-center justify-between mb-8 px-3">
            <div className="transition-transform duration-500 hover:translate-x-1">
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase text-shimmer">Identified Risks</h2>
              <p className="text-[10px] font-bold text-hc-muted uppercase tracking-[0.2em] mt-1 opacity-60">Evaluating {risk.risks.filter(r => r.title).length} risk areas</p>
            </div>
            <button onClick={addRisk}
              className="flex items-center gap-3 px-8 py-3.5 glass-light border border-hc-teal/30 text-hc-teal-light text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-hc-teal/10 hover:border-hc-teal/60 hover:text-white transition-all shadow-2xl active:scale-95 group/add">
              <svg className="w-4 h-4 group-hover/add:scale-110 group-hover/add:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Risk Area
            </button>
          </div>

          <div className="space-y-4">
            {risk.risks.map((r, i) => (
              <RiskCard key={r.id} risk={r} index={i}
                onUpdate={item => updateRiskItem(i, item)}
                onRemove={() => removeRisk(i)}
                defaultOpen={i === 0 && !r.title} />
            ))}
            
            {risk.risks.length === 0 && (
              <div className="text-center py-24 glass border border-white/5 rounded-[2.5rem] animate-in zoom-in duration-700">
                <div className="text-5xl mb-6 opacity-20">🛡️</div>
                <div className="text-lg font-extrabold text-white mb-2 uppercase tracking-tight">Risk List Empty</div>
                <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">Add risk areas above to build the assessment</div>
              </div>
            )}
          </div>

          {/* Global fields */}
          <div className="mt-16 pt-10 border-t border-white/10 space-y-10">
            <div className="px-2">
              <h3 className="text-2xl font-black text-white tracking-tighter uppercase text-shimmer mb-1">Service Safeguards</h3>
              <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-40">Professional network & review cycle</p>
            </div>
            
            <AgencyTable rows={risk.multiAgencyRows} onChange={v => updateRisk({ multiAgencyRows: v })} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Field label="Least Restrictive Practice" value={risk.leastRestrictivePractice}
                onChange={v => updateRisk({ leastRestrictivePractice: v })} area rows={5}
                placeholder="Describe how we ensure the least restrictive support..." />
              <Field label="Review Schedule" value={risk.reviewSchedule}
                onChange={v => updateRisk({ reviewSchedule: v })} area rows={5}
                placeholder="Define how often this assessment will be reviewed..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-black/20 p-8 rounded-[2rem] border border-white/5">
              <Field label="Assessment Date" value={risk.planDate}
                onChange={v => updateRisk({ planDate: v })} />
              <Field label="Next Review Date" value={client.reviewDate}
                onChange={v => { const n = { ...client, reviewDate: v }; persist(n); setClient(n); }} />
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-16 pt-10 border-t border-white/10 animate-in zoom-in-95 duration-1000">
            <SignaturePanel sigs={sigs} onChange={setSigs} />
          </div>

          <div className="mt-16 flex justify-center">
            <button onClick={generatePDF}
              className="px-12 py-5 btn-gradient text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[1.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all duration-500 group/btn-transmit">
              <svg className="w-6 h-6 inline-block mr-4 group-hover/btn-transmit:scale-110 group-hover/btn-transmit:rotate-3 transition-transform align-middle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Risk Assessment
            </button>
          </div>
        </div>
      </div>

      <iframe ref={iframeRef} style={{ display: 'none' }} title="risk-print" />
    </div>
  );
}
