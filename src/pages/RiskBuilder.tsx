import { useState, useRef, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { loadClients, saveClient, emptyRisk, emptyRisk_item } from '../lib/client-store';
import { buildRiskHtml, riskInfo } from '../lib/doc-renderer';
import type { ExportLayout } from '../lib/doc-renderer';
import { SignaturePanel, emptySignatories } from '../components/SignaturePad';
import { parseUniversalText } from '../lib/universal-import';
import { getAllEntries } from '../lib/entry-store';
import { Sparkles, ChevronRight, Download, Shield } from 'lucide-react';
import type { FullClient, RiskItem, AgencyRow } from '../lib/client-store';
import type { Sig } from '../components/SignaturePad';

interface Props {
  clientId: string;
  onBack: () => void;
}

const LIKELIHOOD_LABELS = ['', 'Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const IMPACT_LABELS = ['', 'Negligible', 'Tolerable', 'Undesirable', 'Severe', 'Catastrophic'];

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

function Field({ label, value, onChange, area = false, rows = 3, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  area?: boolean; rows?: number; placeholder?: string;
}) {
  const cls = 'w-full hc-clay-inset px-5 py-4 text-sm font-black text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/20 placeholder:text-hc-muted/40 shadow-inner transition-all';
  return (
    <div className="mb-6 group animate-in fade-in slide-in-from-left-2 duration-500 text-hc-text">
      <label className="text-[10px] mb-2.5 ml-1 block font-black opacity-60 tracking-[0.2em] group-focus-within:opacity-100 transition-opacity uppercase">{label}</label>
      {area
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={cls + ' resize-y scrollbar-thin italic'} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />}
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
    <div className="mb-8 animate-in fade-in slide-in-from-left-2 duration-500 text-hc-text">
      <div className="flex items-center justify-between mb-4 px-1">
        <label className="text-[10px] font-black opacity-60 tracking-[0.2em] uppercase">{label}</label>
        <button onClick={add} className="text-[10px] font-black text-hc-teal hover:brightness-90 uppercase tracking-widest transition-all">+ Add Item</button>
      </div>
      <div className="space-y-3.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4 items-center group">
            <input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder}
              className="flex-1 hc-clay-inset px-5 py-4 text-sm font-black text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/20 shadow-inner transition-all" />
            <button onClick={() => remove(i)} className="w-10 h-10 rounded-xl hc-clay-raised border border-hc-muted/5 flex items-center justify-center text-hc-muted hover:text-flag-red transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <button onClick={add}
            className="w-full hc-clay-raised border-2 border-dashed border-hc-muted/10 rounded-[1.5rem] py-8 text-[11px] font-black text-hc-muted hover:text-hc-teal hover:border-hc-teal/30 transition-all uppercase tracking-[0.3em] flex items-center justify-center gap-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Initialize Tactical List
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
    <div className="mb-8 text-hc-text">
      <div className="flex items-center justify-between mb-4 px-1">
        <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">{label}</label>
        <span className="pill !bg-hc-teal text-hc-bg text-[10px] font-black tracking-widest px-4 py-1.5 shadow-xl uppercase">{value} — {labelArr[value]}</span>
      </div>
      <div className="relative pt-2 px-1">
        <input type="range" min={1} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
          className="w-full h-2.5 hc-clay-inset rounded-full appearance-none cursor-pointer accent-hc-teal shadow-inner" />
        <div className="flex justify-between px-1 mt-4">
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={`text-[10px] font-black tabular-nums transition-all ${value === i + 1 ? 'text-hc-teal scale-125' : 'text-hc-muted/40'}`}>{i + 1}</span>
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
    <div className={`hc-clay-raised transition-all duration-500 rounded-[2.5rem] mb-6 overflow-hidden border border-hc-muted/5
      ${open ? 'shadow-2xl z-10' : 'hover:border-hc-teal/30'}`}>
      {/* Card header */}
      <div className={`flex flex-col md:flex-row md:items-center gap-4 px-8 py-6 cursor-pointer relative overflow-hidden transition-all
        ${open ? 'bg-black/[0.03]' : 'bg-transparent'}`} onClick={() => setOpen(o => !o)}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.03] blur-[60px] -translate-y-1/2 translate-x-1/2 transition-opacity group-hover:opacity-[0.06]" style={{ background: color }} />
        
        <div className="flex items-center gap-5 flex-1 min-w-0 relative z-10">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-hc-bg shadow-xl transition-transform group-hover:scale-110 duration-500"
            style={{ background: color }}>
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-xl font-black tracking-tighter uppercase transition-colors
              ${risk.title ? 'text-hc-text group-hover:text-hc-teal' : 'text-hc-muted italic'}`}>
              {risk.title || 'NEW RISK AREA · CONFIGURE DETAILS'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 relative z-10 shrink-0 md:pl-8 md:border-l md:border-hc-muted/10">
          {risk.title && (
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1">SCORE: {risk.likelihood}×{risk.impact}</span>
              <span className="pill text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1 shadow-xl"
                style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
                {score} · {label}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              className="w-9 h-9 rounded-xl hc-clay-raised border border-hc-muted/5 flex items-center justify-center text-hc-muted hover:text-flag-red transition-all shadow-lg group/del">
              <svg className="w-4 h-4 group-hover/del:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <div className={`w-9 h-9 rounded-xl hc-clay-raised border border-hc-muted/5 flex items-center justify-center text-hc-muted group-hover:text-hc-teal transition-all duration-500 shadow-lg ${open ? 'rotate-180 bg-black/5' : ''}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Card body */}
      {open && (
        <div className="px-8 py-10 border-t border-hc-muted/10 space-y-2 animate-in slide-in-from-top-4 duration-500 bg-black/[0.01]">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-6">
            <Field label="Secondary Risks" value={risk.secondaryRisk} onChange={v => up({ secondaryRisk: v })} area rows={3}
              placeholder="Does managing this risk create other risks? (e.g. social isolation)" />
            <Field label="Contingency Plan" value={risk.contingencyPlan} onChange={v => up({ contingencyPlan: v })} area rows={3}
              placeholder="What must staff do if the primary controls fail?" />
          </div>

          <ListField label="Primary Controls" items={risk.controls}
            onChange={v => up({ controls: v })} placeholder="e.g. Staff to provide steadying support" />
          
          <ListField label="Dynamic Controls" items={risk.dynamicControls}
            onChange={v => up({ dynamicControls: v })} placeholder="e.g. Postpone activity if person is too fatigued" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-6">
            <Field label="Least Restrictive Practice" value={risk.leastRestrictive}
              onChange={v => up({ leastRestrictive: v })} area rows={3}
              placeholder="Explain why this is the least restrictive option..." />
            <Field label="Review Trigger" value={risk.reviewTrigger}
              onChange={v => up({ reviewTrigger: v })}
              placeholder="e.g. Following any fall or change in Mobility, Movement & Exercise" />
          </div>

          {/* Score */}
          <div className="hc-clay-raised border-2 border-hc-muted/5 rounded-[2.5rem] p-10 mt-10 shadow-2xl relative overflow-hidden group/score">
            <div className="absolute inset-0 bg-gradient-to-br from-hc-teal/[0.02] to-transparent opacity-0 group-hover/score:opacity-100 transition-opacity duration-1000" />
            <div className="text-[11px] font-black uppercase tracking-[0.3em] mb-12 flex items-center gap-3 text-hc-text">
              <span className="w-2 h-2 rounded-full bg-hc-teal animate-pulse" />
              Strategic Risk Evaluation
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <ScoreSlider label="Likelihood Factor" value={risk.likelihood} onChange={v => up({ likelihood: v })}
                labelArr={LIKELIHOOD_LABELS} />
              <ScoreSlider label="Clinical Impact" value={risk.impact} onChange={v => up({ impact: v })}
                labelArr={IMPACT_LABELS} />
            </div>
            <div className="flex items-center gap-8 mt-12 pt-10 border-t border-hc-muted/10 relative z-10">
              <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em]">Operational Risk Rating:</div>
              <div className="text-5xl font-black tabular-nums tracking-tighter" style={{ color }}>{score}</div>
              <div className="pill text-[11px] font-black uppercase tracking-[0.3em] px-8 py-2.5 shadow-2xl" style={{ background: color + '33', color, border: `1px solid ${color}60` }}>
                {label}
              </div>
              <span className="text-[10px] font-black text-hc-muted/40 uppercase tracking-[0.4em] ml-auto tabular-nums">MATRIX: {risk.likelihood} × {risk.impact}</span>
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
    <div className="mb-12 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-6 px-1">
        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-hc-text opacity-60">Professional Network — Involved Agencies</label>
        <button onClick={add} className="text-[10px] font-black text-hc-teal hover:brightness-90 uppercase tracking-widest transition-all">+ Add Agency Vector</button>
      </div>
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center group">
            <input value={row.service} onChange={e => update(i, 'service', e.target.value)} placeholder="Service / Agency Name"
              className="hc-clay-inset px-5 py-3.5 text-xs text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/20 shadow-inner font-black uppercase" />
            <input value={row.role} onChange={e => update(i, 'role', e.target.value)} placeholder="Role / Responsibility"
              className="hc-clay-inset px-5 py-3.5 text-xs text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/20 shadow-inner font-black uppercase" />
            <div className="flex gap-4">
              <input value={row.status} onChange={e => update(i, 'status', e.target.value)} placeholder="Current Status"
                className="flex-1 hc-clay-inset px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-hc-teal focus:outline-none focus:ring-2 focus:ring-hc-teal/20 shadow-inner" />
              <button onClick={() => remove(i)} className="w-11 h-11 rounded-2xl hc-clay-raised border border-hc-muted/5 flex items-center justify-center text-hc-muted hover:text-flag-red transition-all shadow-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <button onClick={add}
            className="w-full hc-clay-raised border-2 border-dashed border-hc-muted/10 rounded-2xl py-10 text-[11px] font-black text-hc-muted hover:text-hc-teal hover:border-hc-teal/30 transition-all uppercase tracking-[0.3em] flex items-center justify-center gap-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Initialize Agency Protocol
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
  const [exportLayout, setExportLayout] = useState<ExportLayout>('portrait');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [sigs, setSigs] = useState<Sig[]>(() => {
    const c = loadClients().find(x => x.id === clientId);
    return emptySignatories(c?.completedBy || 'Brooklyn Ruvinga', c?.keyWorker || '', c?.responsible || '');
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

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
    const html = buildRiskHtml(client, sigs, exportLayout);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
  };

  const today = new Date().toLocaleDateString('en-GB');
  const risk = client.risk || emptyRisk(today);

  const [synthesising, setSynthesising] = useState(false);
  const [synthStatus, setSynthStatus] = useState('');

  const handleSynthesiseRisk = () => {
    const all = getAllEntries();
    const clientEntries = all.filter(e =>
      e.client && client.name && e.client.toLowerCase().includes(client.name.split(' ')[0].toLowerCase())
    );
    if (!clientEntries.length) {
      setSynthStatus('No diary entries found for this client. Import a diary CSV first.');
      return;
    }
    setSynthesising(true);
    setSynthStatus(`Analysing ${clientEntries.length} entries...`);

    const RISK_PATTERNS: { title: string; keywords: string[]; likelihood: number; impact: number }[] = [
      { title: 'Falls & Physical Safety', keywords: ['fell', 'fall', 'slip', 'trip', 'floor', 'collapse'], likelihood: 3, impact: 3 },
      { title: 'Challenging Behaviour', keywords: ['agitat', 'aggress', 'distress', 'shout', 'refus', 'upset', 'angry', 'lash', 'kick', 'punch', 'bite'], likelihood: 3, impact: 3 },
      { title: 'Medication Management', keywords: ['medication', 'tablet', 'pill', 'dose', 'refused med', 'missed med', 'prn'], likelihood: 2, impact: 4 },
      { title: 'Choking & Dysphagia', keywords: ['chok', 'swallow', 'cough', 'dysphagia', 'modified diet', 'purée'], likelihood: 2, impact: 5 },
      { title: 'Seizure Risk', keywords: ['seizure', 'epilep', 'fit', 'convuls', 'postictal'], likelihood: 2, impact: 5 },
      { title: 'Skin Integrity', keywords: ['skin', 'pressure', 'wound', 'sore', 'reddening', 'blister', 'grade'], likelihood: 2, impact: 3 },
      { title: 'Mental Health & Emotional Wellbeing', keywords: ['mood', 'anxious', 'depress', 'mental', 'low mood', 'paranoi', 'hallucinat'], likelihood: 3, impact: 3 },
      { title: 'Nutrition & Hydration', keywords: ['refus food', 'refus drink', 'not eaten', 'not drinking', 'weight loss', 'dehydrat'], likelihood: 2, impact: 4 },
    ];

    setClient(prev => {
      const today = new Date().toLocaleDateString('en-GB');
      const existingRisk = prev.risk || emptyRisk(today);
      const existingTitles = new Set(existingRisk.risks.map(r => r.title.toLowerCase()));
      const newItems: RiskItem[] = [];

      RISK_PATTERNS.forEach(pat => {
        if (existingTitles.has(pat.title.toLowerCase())) return;
        const matched = clientEntries.filter(e =>
          pat.keywords.some(kw => (e.entry || '').toLowerCase().includes(kw))
        );
        if (!matched.length) return;

        const sampleEntries = matched.slice(0, 3).map(e => e.entry).join(' | ');
        const item: RiskItem = {
          ...emptyRisk_item(),
          title: pat.title,
          description: `Identified from ${matched.length} diary entries. Sample: ${sampleEntries.slice(0, 200)}`,
          likelihood: pat.likelihood,
          impact: pat.impact,
          behaviours: matched.slice(0, 3).map(e => e.entry.slice(0, 120)),
          triggers: ['See diary entries for context'],
          earlyWarnings: ['Changes in presentation noted in diary'],
          controls: ['Follow existing support plan protocols'],
        };
        newItems.push(item);
      });

      if (!newItems.length) {
        setSynthStatus('No new risk patterns detected beyond what\'s already documented.');
        setSynthesising(false);
        return prev;
      }

      const next = {
        ...prev,
        risk: {
          ...existingRisk,
          risks: [...existingRisk.risks.filter(r => r.title), ...newItems],
        },
      };
      saveClient(next);
      setSynthStatus(`Added ${newItems.length} risk area(s) from ${clientEntries.length} diary entries. Review and refine each.`);
      setSynthesising(false);
      return next;
    });
  };

  const importRiskDataset = async (file: File) => {
    setImporting(true);
    setImportStatus('Reading dataset...');
    try {
      let rawText = '';
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          rawText += (content.items as any[]).map((it) => it?.str || '').join(' ') + '\n';
        }
      } else {
        rawText = await file.text();
      }
      const parsed = parseUniversalText(rawText);
      const importedRisk = parsed.client.risk;
      if (!importedRisk) {
        setImportStatus('No risk dataset detected in file.');
        return;
      }
      const next: FullClient = {
        ...client,
        ...parsed.client,
        risk: {
          ...(client.risk || emptyRisk(today)),
          ...importedRisk,
          planDate: importedRisk.planDate || client.risk?.planDate || today,
        },
      };
      saveClient(next);
      setClient(next);
      setImportStatus(`Imported ${next.risk?.risks.filter((r) => r.title).length || 0} risk area(s) from dataset.`);
    } catch (err: any) {
      setImportStatus(`Import failed: ${err?.message || 'unknown error'}`);
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden animate-in fade-in duration-500 bg-hc-bone">
      {/* Header */}
      <div className="flex items-center gap-6 px-10 py-6 hc-clay-raised z-20 shadow-2xl relative">
        <button onClick={onBack}
          className="group flex items-center gap-3 text-hc-text hover:text-hc-teal text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 active:scale-90">
          <span className="w-10 h-10 rounded-xl hc-clay-raised border border-hc-muted/5 flex items-center justify-center transition-all">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </span>
          Return
        </button>
        
        <div className="h-10 w-px bg-hc-muted/10 hidden md:block" />
        
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-hc-text tracking-tighter uppercase flex items-center gap-4">
            <span>{client.name || 'PERSON PROFILE'}</span>
            <span className="pill !bg-hc-bg text-flag-amber border border-flag-amber/30 text-[10px] font-black tracking-widest px-4 py-1 shadow-lg uppercase">Clinical Risk Builder</span>
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60">Governance & Safeguarding Protocol</span>
            <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest tabular-nums ${saved ? 'text-flag-green' : 'text-flag-amber animate-pulse'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${saved ? 'bg-flag-green' : 'bg-flag-amber animate-pulse'}`} />
              {saved ? 'Matrix Synchronized' : 'Calibrating Data...'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSynthesiseRisk}
            disabled={synthesising}
            className="px-6 py-3.5 rounded-2xl hc-clay-raised border border-hc-teal/20 text-[10px] font-black uppercase tracking-[0.2em] text-hc-teal hover:brightness-90 flex items-center gap-3 transition-all shadow-xl disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> {synthesising ? 'Analysing...' : 'Synthesise Intelligence'}
          </button>
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={importing}
            className="px-6 py-3.5 rounded-2xl hc-clay-raised border border-hc-muted/5 text-[10px] font-black uppercase tracking-[0.2em] text-hc-text hover:brightness-90 transition-all disabled:opacity-50"
          >
            {importing ? 'Injesting...' : 'Injest Dataset'}
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".pdf,.txt,.csv,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importRiskDataset(f);
            }}
          />
          <div className="relative group">
            <select
              value={exportLayout}
              onChange={e => setExportLayout(e.target.value as ExportLayout)}
              className="appearance-none hc-clay-inset hover:border-hc-teal/50 rounded-xl pl-5 pr-12 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-hc-text outline-none cursor-pointer transition-colors shadow-inner"
              title="Export page orientation"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-hc-muted pointer-events-none rotate-90" />
          </div>
          <button onClick={generatePDF}
            className="flex items-center gap-3 px-10 py-3.5 btn-tactical text-hc-bg text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all group">
            <Download className="w-4 h-4" />
            Print Tactical Record
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-12 scrollbar-thin">
        <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-6 duration-700 pb-32">
          {!!synthStatus && (
            <div className={`mb-4 text-[11px] font-black uppercase tracking-widest rounded-2xl px-8 py-5 border flex items-center gap-4 animate-in slide-in-from-top-4 ${synthStatus.includes('No') ? 'bg-flag-amber/10 border-flag-amber/30 text-flag-amber' : 'bg-hc-teal/10 border-hc-teal/30 text-hc-teal'}`}>
              <Sparkles className="w-4 h-4 shrink-0" />
              {synthStatus}
            </div>
          )}
          {!!importStatus && (
            <div className={`mb-10 text-[11px] font-black uppercase tracking-widest rounded-2xl px-8 py-5 border flex items-center gap-4 animate-in slide-in-from-top-4 ${importStatus.includes('failed') ? 'bg-flag-red/10 border-flag-red/30 text-flag-red' : 'bg-hc-teal/10 border-hc-teal/30 text-hc-teal'}`}>
              <div className={`w-2 h-2 rounded-full ${importStatus.includes('failed') ? 'bg-flag-red' : 'bg-hc-teal animate-pulse'}`} />
              {importStatus}
            </div>
          )}
          
          {/* Risk summary bar */}
          {risk.risks.filter(r => r.title).length > 0 && (
            <div className="flex flex-wrap gap-3 mb-16 animate-in fade-in zoom-in-95 duration-700">
              {risk.risks.filter(r => r.title).map((r, i) => {
                const { score, color, label } = riskInfo(r.likelihood, r.impact);
                return (
                  <span key={i} className="pill !bg-hc-bg text-[10px] font-black uppercase tracking-[0.1em] px-5 py-2.5 shadow-xl transition-all duration-500 hover:scale-105 active:scale-95 cursor-default flex items-center gap-3 border border-hc-muted/5"
                    style={{ color }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    {i + 1}. {r.title} — {score} ({label})
                  </span>
                );
              })}
            </div>
          )}

          {/* Header row */}
          <div className="flex items-center justify-between mb-10 px-4">
            <div>
              <h2 className="text-3xl font-black text-hc-text tracking-tighter uppercase mb-2">Identified Risk Matrix</h2>
              <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-60">Quantifying {risk.risks.filter(r => r.title).length} clinical threat vectors</p>
            </div>
            <button onClick={addRisk}
              className="flex items-center gap-4 px-10 py-4 hc-clay-raised border border-hc-teal/20 text-hc-teal text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl hover:brightness-90 transition-all shadow-2xl active:scale-95 group/add">
              <svg className="w-5 h-5 group-hover/add:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Injest New Risk
            </button>
          </div>

          <div className="space-y-6">
            {risk.risks.map((r, i) => (
              <RiskCard key={r.id} risk={r} index={i}
                onUpdate={item => updateRiskItem(i, item)}
                onRemove={() => removeRisk(i)}
                defaultOpen={i === 0 && !r.title} />
            ))}
            
            {risk.risks.length === 0 && (
              <div className="text-center py-32 hc-clay-raised border border-hc-muted/5 rounded-[3rem] animate-in zoom-in duration-700 bg-black/[0.01]">
                <Shield className="w-16 h-16 text-hc-muted mx-auto mb-8 opacity-20" />
                <div className="text-xl font-black text-hc-text mb-3 uppercase tracking-tight">Diagnostic Buffer Empty</div>
                <div className="text-[11px] text-hc-muted uppercase tracking-[0.3em] font-black opacity-60">Injest new risk area protocols to proceed</div>
              </div>
            )}
          </div>

          {/* Global fields */}
          <div className="mt-20 pt-16 border-t border-hc-muted/10 space-y-16">
            <div className="px-4">
              <h3 className="text-3xl font-black text-hc-text tracking-tighter uppercase mb-2 text-shimmer">Operational Safeguards</h3>
              <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-40">Clinical oversight & accountability network</p>
            </div>
            
            <AgencyTable rows={risk.multiAgencyRows} onChange={v => updateRisk({ multiAgencyRows: v })} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <Field label="Least Restrictive Protocol" value={risk.leastRestrictivePractice}
                onChange={v => updateRisk({ leastRestrictivePractice: v })} area rows={6}
                placeholder="Evidential justification for support strategy..." />
              <Field label="Compliance Review Cycle" value={risk.reviewSchedule}
                onChange={v => updateRisk({ reviewSchedule: v })} area rows={6}
                placeholder="Tactical frequency for clinical re-evaluation..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 hc-clay-raised p-10 rounded-[3rem] border border-hc-muted/5 bg-black/[0.01]">
              <Field label="Plan Initialization" value={risk.planDate}
                onChange={v => updateRisk({ planDate: v })} />
              <Field label="Target Audit Date" value={client.reviewDate}
                onChange={v => { const n = { ...client, reviewDate: v }; persist(n); setClient(n); }} />
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-24 pt-16 border-t border-hc-muted/10">
             <div className="mb-12 px-4">
                <h3 className="text-3xl font-black text-hc-text tracking-tighter uppercase mb-2">Protocol Verification</h3>
                <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-40">Attestation & Digital Sign-off</p>
             </div>
            <SignaturePanel sigs={sigs} onChange={setSigs} />
          </div>

          <div className="mt-24 flex justify-center">
            <button onClick={generatePDF}
              className="px-16 py-6 btn-tactical text-hc-bg text-[12px] font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all duration-700 group/btn-transmit">
              <Download className="w-6 h-6 inline-block mr-6 group-hover:rotate-6 transition-transform align-middle" />
              Dispatch Risk Assessment
            </button>
          </div>
        </div>
      </div>

      <iframe ref={iframeRef} style={{ display: 'none' }} title="risk-print" />
    </div>
  );
}
