import { useState, useRef, useCallback } from 'react';
import { loadClients, saveClient, emptyPBS } from '../lib/client-store';
import { buildPBSHtml } from '../lib/doc-renderer';
import type { ExportLayout } from '../lib/doc-renderer';
import { SignaturePanel, emptySignatories } from '../components/SignaturePad';
import { parseUniversalText } from '../lib/universal-import';
import { getAllEntries } from '../lib/entry-store';
import { extractFileText } from '../lib/universal-extractor';
import { mergeClientIdentity } from '../lib/client-identity-merge';
import { mergePBSData } from '../lib/intel-merge';
import { Sparkles, ChevronRight, ArrowLeft, Plus, Printer, Trash2, CheckCircle } from 'lucide-react';
import type { FullClient } from '../lib/client-store';
import type { Sig } from '../components/SignaturePad';

interface Props {
  clientId: string;
  onBack: () => void;
}

const SECTIONS = [
  'Personal Profile',
  'About Me',
  'Diagnoses & Presentation',
  'Behaviour as Communication',
  'Proactive Support',
  'Early Warning Signs',
  'Reactive Strategies',
  'Post-Incident Support',
  'Preferences & Triggers',
  'Medication Management & Safety Support',
  'Reviews & Professionals',
  'Sign-Off',
];

// ─── SHARED FIELD COMPONENTS ─────────────────────────────────────────────────

function Field({ label, value, onChange, area = false, rows = 3, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  area?: boolean; rows?: number; placeholder?: string;
}) {
  const cls = 'w-full hc-clay-inset px-5 py-4 text-[13px] font-black text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/20 placeholder:text-hc-muted/40 shadow-inner transition-all';
  return (
    <div className="mb-6 group animate-in fade-in slide-in-from-left-2 duration-500 text-hc-text">
      <label className="text-[11px] mb-2.5 ml-1 block font-black text-hc-muted tracking-[0.2em] group-focus-within:text-hc-teal transition-colors uppercase">{label}</label>
      {area
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={cls + ' resize-y scrollbar-thin italic'} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />}
    </div>
  );
}

function ListField({ label, items, onChange, placeholder = 'Enter details…', rows = 1 }: {
  label: string; items: string[]; onChange: (items: string[]) => void;
  placeholder?: string; rows?: number;
}) {
  const update = (i: number, v: string) => { const a = [...items]; a[i] = v; onChange(a); };
  const add = () => onChange([...items, '']);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="mb-8 animate-in fade-in slide-in-from-left-2 duration-500 text-hc-text">
      <div className="flex items-center justify-between mb-4 px-1">
        <label className="text-[11px] font-black text-hc-muted tracking-[0.2em] uppercase">{label}</label>
        <button onClick={add} className="text-[11px] font-black text-hc-teal hover:brightness-90 uppercase tracking-widest transition-all">+ Add Protocol</button>
      </div>
      <div className="space-y-3.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4 items-start group">
            {rows > 1
              ? <textarea value={item} onChange={e => update(i, e.target.value)} rows={rows} placeholder={placeholder}
                  className="flex-1 hc-clay-inset px-5 py-4 text-[13px] font-black text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/20 resize-y placeholder:text-hc-muted/40 shadow-inner transition-all italic" />
              : <input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder}
                  className="flex-1 hc-clay-inset px-5 py-4 text-[13px] font-black text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/20 shadow-inner transition-all" />}
            <button onClick={() => remove(i)} className="mt-2 w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-hc-red transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <button onClick={add}
            className="w-full hc-clay-raised border-2 border-dashed border-hc-border rounded-[1.5rem] py-10 text-[11px] font-black text-hc-muted hover:text-hc-teal hover:border-hc-teal/30 transition-all uppercase tracking-[0.3em] flex items-center justify-center gap-4">
            <Plus className="w-4 h-4" />
            Initialise Protocol Array
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
        <label className="section-header text-[11px] text-hc-muted tracking-[0.2em] uppercase">{label}</label>
        <button onClick={add} className="text-[11px] font-black text-hc-teal hover:text-hc-text uppercase tracking-widest transition-all">+ Add New Row</button>
      </div>
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={i} className="hc-clay-raised rounded-[2rem] p-6 relative group transition-all">
            <button onClick={() => remove(i)}
              className="absolute top-4 right-4 w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center text-hc-muted hover:text-hc-red transition-all opacity-0 group-hover:opacity-100 shadow-xl z-10">
              <Trash2 className="w-4 h-4" />
            </button>
            <div className={`grid gap-6 ${cols.length >= 2 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
              {cols.map(col => (
                <div key={col.key} className={col.area && cols.length === 1 ? 'w-full' : ''}>
                  <label className="section-header text-[11px] mb-2 ml-1 block text-hc-muted opacity-60 uppercase tracking-[0.2em]">{col.label}</label>
                  {col.area
                    ? <textarea value={row[col.key] || ''} onChange={e => update(i, col.key, e.target.value)}
                        rows={3} className="w-full hc-clay-inset rounded-2xl px-5 py-3 text-[13px] text-hc-text focus:outline-none focus:ring-2 ring-hc-teal/20 shadow-inner resize-none font-black italic" />
                    : <input type="text" value={row[col.key] || ''} onChange={e => update(i, col.key, e.target.value)}
                        className="w-full hc-clay-inset rounded-2xl px-5 py-3 text-[13px] text-hc-text focus:outline-none focus:ring-2 ring-hc-teal/20 shadow-inner font-black" />}
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <button onClick={add}
            className="w-full hc-clay-raised border-2 border-dashed border-hc-border rounded-[2rem] py-10 text-[11px] font-black text-hc-muted hover:text-hc-teal transition-all uppercase tracking-[0.3em] flex items-center justify-center gap-3">
            <Plus className="w-5 h-5" />
            Add Details
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
  const [exportLayout, setExportLayout] = useState<ExportLayout>('portrait');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [sigs, setSigs] = useState<Sig[]>(() =>
    emptySignatories(
      loadClients().find(c => c.id === clientId)?.completedBy || 'Brooklyn Ruvinga',
      loadClients().find(c => c.id === clientId)?.keyWorker || '',
      loadClients().find(c => c.id === clientId)?.responsible || '',
    )
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

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
    const html = buildPBSHtml(client, sigs, exportLayout);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
  };

  const today = new Date().toLocaleDateString('en-GB');
  const pbs = client.pbs || emptyPBS(today);

  const [synthStatus, setSynthStatus] = useState('');

  const handleSynthesisePBS = () => {
    const all = getAllEntries();
    const clientEntries = all.filter(e =>
      e.client && client.name && e.client.toLowerCase().includes(client.name.split(' ')[0].toLowerCase())
    );
    if (!clientEntries.length) {
      setSynthStatus('No diary entries found for this client. Import a diary CSV first.');
      return;
    }

    setClient(prev => {
      const today = new Date().toLocaleDateString('en-GB');
      const nextPbs = { ...(prev.pbs || emptyPBS(today)) };

      // About text — only if blank
      if (!nextPbs.aboutText) {
        const positiveEntries = clientEntries.filter(e =>
          /enjoyed|happy|smile|laugh|participat|engaged|independ|achieved|positive/.test((e.entry || '').toLowerCase())
        );
        if (positiveEntries.length) {
          nextPbs.aboutText = positiveEntries.slice(0, 2).map(e => e.entry).join(' ');
        }
      }

      // Finds difficult — from incident/challenging entries
      const challengingEntries = clientEntries.filter(e =>
        /refus|agitat|distress|upset|shout|aggress|challeng|difficult|anxious|meltdown/.test((e.entry || '').toLowerCase())
      );
      if (challengingEntries.length) {
        const existing = new Set(nextPbs.findsDifficult.filter(Boolean).map(s => s.toLowerCase()));
        const themes = ['transitions and unexpected changes', 'sensory overload', 'unmet communication needs',
          'crowded environments', 'changes to routine', 'waiting and uncertainty'];
        challengingEntries.forEach(e => {
          const text = e.entry.toLowerCase();
          if (text.includes('wait') && !existing.has('waiting and uncertainty')) { existing.add('waiting and uncertainty'); themes.push('waiting and uncertainty'); }
          if ((text.includes('noise') || text.includes('crowd')) && !existing.has('crowded environments')) existing.add('crowded environments');
          if ((text.includes('routine') || text.includes('change')) && !existing.has('changes to routine')) existing.add('changes to routine');
        });
        const newDifficult = Array.from(existing).filter(t => !nextPbs.findsDifficult.map(s => s.toLowerCase()).includes(t));
        nextPbs.findsDifficult = [...nextPbs.findsDifficult.filter(Boolean), ...newDifficult].slice(0, 7);
      }

      // Warning signs — from entries where escalation occurred
      const incidentEntries = clientEntries.filter(e =>
        (e.type === 'incident' || /incident|escalat|emergency|urgent/.test((e.entry || '').toLowerCase()))
      );
      if (incidentEntries.length && nextPbs.warningSignRows.every(r => !r.sign)) {
        const newWarnings = [
          { sign: 'Increased pacing or restlessness', staffAction: 'Offer a quiet space and calm 1:1 interaction.' },
          { sign: 'Refusing to engage with normal routines', staffAction: 'Do not press. Offer alternatives and allow space.' },
          { sign: 'Raised vocal tone or repetitive speech', staffAction: 'Lower own voice, reduce environmental stimulation.' },
        ];
        nextPbs.warningSignRows = newWarnings;
      }

      // What works — from positive entries
      const positiveEntries = clientEntries.filter(e =>
        /calm|settled|enjoy|happy|participat|help|support|positive|liked|prefer/.test((e.entry || '').toLowerCase())
      );
      if (positiveEntries.length && nextPbs.whatWorks.every(s => !s)) {
        nextPbs.whatWorks = [
          'Consistent 1:1 support from familiar staff',
          'Person-centred communication at their pace',
          'Clear explanations of what is happening and why',
          'Choices offered before transitions',
        ];
      }

      const next = { ...prev, pbs: nextPbs };
      saveClient(next);
      setSynthStatus(`Synthesised from ${clientEntries.length} entries (${challengingEntries.length} challenging, ${incidentEntries.length} incidents). Review each section.`);
      return next;
    });
  };

  const importDataset = async (file: File) => {
    setImporting(true);
    setImportStatus('Reading dataset...');
    try {
      const rawText = await extractFileText(file);
      const parsed = parseUniversalText(rawText);
      const sourceRisk = parsed.client.risk;
      const sourceCarePlan = parsed.carePlan;

      setClient(prev => {
        const nextPbs = mergePBSData(prev.pbs, parsed.pbs || null) || { ...(prev.pbs || emptyPBS(today)) };

        if (sourceCarePlan?.biography && !nextPbs.aboutText) nextPbs.aboutText = sourceCarePlan.biography;
        if (sourceRisk?.risks?.length) {
          const titles = sourceRisk.risks.map((r) => r.title).filter(Boolean);
          if (titles.length) nextPbs.findsDifficult = Array.from(new Set([...(nextPbs.findsDifficult || []), ...titles])).slice(0, 7);
          const warnings = sourceRisk.risks.flatMap((r) => r.earlyWarnings || []).filter(Boolean).slice(0, 8);
          if (warnings.length) {
            const newRows = warnings.map((w) => ({ sign: w, staffAction: 'Follow de-escalation and escalation procedure.' }));
            const existingSigns = new Set(nextPbs.warningSignRows.map(r => r.sign.toLowerCase().trim()));
            for (const row of newRows) {
              if (!existingSigns.has(row.sign.toLowerCase().trim())) {
                nextPbs.warningSignRows.push(row);
              }
            }
          }
        }

        const base = mergeClientIdentity(prev, parsed.client);
        const next: FullClient = { ...base, pbs: nextPbs };
        saveClient(next);
        return next;
      });
      setImportStatus('Dataset imported and merged into PBS draft. Review each section before print.');
    } catch (err) {
      setImportStatus(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

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
    if (i === 9) return pbs.medicationRows?.some(r => r.name);
    if (i === 10) return !!(pbs.reviewSchedule);
    if (i === 11) return sigs.some(s => s.data);
    return false;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-hc-bg animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-6 px-8 py-5 hc-clay-raised m-4 z-20 shadow-2xl">
        <button onClick={onBack}
          className="group flex items-center gap-3 text-hc-muted hover:text-hc-text text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 active:scale-90">
          <span className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center group-hover:bg-hc-clay-dark transition-all">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </span>
          Back
        </button>
        
        <div className="h-8 w-px bg-hc-border hidden md:block" />
        
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-hc-text tracking-tighter uppercase flex items-center gap-3">
            <span>{client.name || 'PERSON PROFILE'}</span>
            <span className="pill pill-teal text-[11px] font-black tracking-widest px-3 py-0.5 shadow-lg">PBS PLAN BUILDER</span>
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] font-bold text-hc-muted uppercase tracking-widest">Positive Behaviour Support Planning</span>
            <span className={`text-[11px] font-black uppercase tracking-widest tabular-nums ${saved ? 'text-flag-green' : 'text-flag-amber animate-pulse'}`}>
              {saved ? '✓ DATA SAVED' : '● SAVING CHANGES...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSynthesisePBS}
            className="px-5 py-2.5 rounded-xl hc-clay-raised text-[11px] font-black uppercase tracking-[0.2em] text-hc-teal hover:text-hc-text hover:bg-hc-clay-dark flex items-center gap-2 transition-all shadow-md">
            <Sparkles className="w-4 h-4" /> Synthesise from Intelligence
          </button>
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={importing}
            className="px-5 py-2.5 rounded-xl hc-clay-raised text-[11px] font-black uppercase tracking-[0.2em] text-hc-teal hover:bg-hc-clay-dark hover:text-hc-text transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import dataset'}
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".pdf,.txt,.csv,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importDataset(f);
            }}
          />
          <div className="relative group">
            <select
              value={exportLayout}
              onChange={e => setExportLayout(e.target.value as ExportLayout)}
              className="appearance-none bg-hc-bone hc-clay-inset border border-hc-border hover:border-hc-teal/50 rounded-xl pl-4 pr-10 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-hc-text outline-none cursor-pointer transition-colors shadow-inner"
              title="Export page orientation"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hc-muted pointer-events-none rotate-90" />
          </div>
          <button onClick={generatePDF}
            className="flex items-center gap-3 px-8 py-3 btn-tactical text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all group">
            <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Print PBS Plan
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden px-4 pb-4 gap-4">
        {/* Section nav */}
        <div className="w-72 flex-shrink-0 hc-clay-inset overflow-y-auto scrollbar-thin">
          <div className="p-6 border-b border-hc-border bg-hc-clay-dark/20">
            <p className="section-header text-[11px] text-hc-muted tracking-[0.3em] uppercase">Plan Sections</p>
          </div>
          <div className="py-4">
            {SECTIONS.map((name, i) => (
              <button key={i} onClick={() => setSection(i)}
                className={`w-full text-left px-6 py-4 text-[11px] font-black uppercase tracking-widest flex items-center gap-4 transition-all duration-500 group relative overflow-hidden active:scale-95
                  ${section === i ? 'bg-hc-teal/10 text-hc-teal shadow-inner' : 'text-hc-muted hover:text-hc-text hover:bg-hc-clay-dark'}`}>
                {section === i && <div className="absolute left-0 top-0 bottom-0 w-1 bg-hc-teal shadow-[0_0_15px_#1c4e4e] z-10" />}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-700 relative z-10 ${sectionComplete(i) ? 'bg-hc-teal scale-110' : 'bg-hc-border group-hover:bg-hc-muted'}`} />
                <span className="flex-1 truncate relative z-10 group-hover:translate-x-1 transition-transform duration-500">{name}</span>
                {sectionComplete(i) && (
                  <CheckCircle className="w-3.5 h-3.5 text-hc-teal/60 relative z-10" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Section content */}
        <div className="flex-1 overflow-y-auto p-10 hc-clay-raised scrollbar-thin">
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-700">
            {!!synthStatus && (
              <div className="mb-4 text-[11px] font-black rounded-xl px-4 py-3 border border-hc-teal/30 bg-hc-teal/10 text-hc-teal flex items-center gap-2 animate-in slide-in-from-top-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />{synthStatus}
              </div>
            )}
            {!!importStatus && (
              <div className="mb-6 text-[11px] font-black rounded-xl px-4 py-3 border border-hc-teal/30 bg-hc-teal/10 text-hc-teal">
                {importStatus}
              </div>
            )}
            
            <div className="mb-12 flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl hc-clay-inset flex items-center justify-center text-3xl font-black text-hc-teal shadow-2xl animate-float">
                {section + 1}
              </div>
              <div>
                <h2 className="text-3xl font-black text-hc-text tracking-tighter uppercase mb-1">{SECTIONS[section]}</h2>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
                  <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em]">Configuring Section {section + 1} of 12</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {/* 0 — Personal Profile */}
              {section === 0 && (
                <div className="animate-in fade-in duration-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <Field label="Full Name" value={client.name} onChange={v => update({ name: v })} />
                    <Field label="Preferred Name" value={client.preferredName} onChange={v => update({ preferredName: v })} />
                    <Field label="Date of Birth" value={client.dob} onChange={v => update({ dob: v })} />
                    <Field label="NHS Number" value={client.nhs} onChange={v => update({ nhs: v })} />
                    <Field label="Phone Number" value={client.phone} onChange={v => update({ phone: v })} />
                    <Field label="Admission Date" value={client.dateOfAdmission} onChange={v => update({ dateOfAdmission: v })} />
                    <Field label="Review Date" value={client.reviewDate} onChange={v => update({ reviewDate: v })} />
                  </div>
                  <Field label="Primary Address" value={client.address} onChange={v => update({ address: v })} area rows={2} />
                  <ListField label="Diagnoses" items={client.diagnoses} onChange={v => update({ diagnoses: v })} placeholder="e.g. Autism Spectrum Disorder" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-8 pt-8 border-t border-hc-border">
                    <Field label="Key Worker" value={client.keyWorker} onChange={v => update({ keyWorker: v })} />
                    <Field label="Responsible Manager" value={client.responsible} onChange={v => update({ responsible: v })} />
                    <Field label="Completed By" value={client.completedBy} onChange={v => update({ completedBy: v })} />
                    <Field label="Plan Date" value={pbs.planDate} onChange={v => updatePBS({ planDate: v })} />
                  </div>
                </div>
              )}

              {/* 1 — About Me */}
              {section === 1 && (
                <div className="animate-in fade-in duration-700">
                  <Field label="About the Person (Summary)" value={pbs.aboutText}
                    onChange={v => updatePBS({ aboutText: v })} area rows={8}
                    placeholder="Summarise the person's core strengths, personality, interests, and how they like to be supported..." />
                  <div className="h-8" />
                  <ListField label="Important to Me" items={pbs.whatMatters}
                    onChange={v => updatePBS({ whatMatters: v })} placeholder="e.g. Spending time in my private space" />
                  <ListField label="How I Communicate Best" items={pbs.communicatesBest}
                    onChange={v => updatePBS({ communicatesBest: v })} placeholder="e.g. Short, clear sentences and visual aids" />
                  <ListField label="What I Find Difficult" items={pbs.findsDifficult}
                    onChange={v => updatePBS({ findsDifficult: v })} placeholder="e.g. Sudden changes to my Life Skills & Daily Routine" />
                </div>
              )}

              {/* 2 — Diagnoses */}
              {section === 2 && (
                <div className="animate-in fade-in duration-700">
                  <p className="text-[13px] font-black text-hc-muted mb-8 leading-relaxed italic border-l-2 border-hc-teal pl-4 py-1">"Describe how each diagnosis affects the person's daily life and support needs."</p>
                  <TableEditor
                    label="Diagnoses & Presentation Table"
                    rows={pbs.diagnosisRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ diagnosisRows: v as unknown as typeof pbs.diagnosisRows })}
                    cols={[
                      { key: 'diagnosis', label: 'Diagnosis' },
                      { key: 'presentation', label: 'How it affects me', area: true },
                    ]}
                    addRow={() => ({ diagnosis: '', presentation: '' })}
                  />
                  <Field label="Key Support Principle" value={pbs.keyPrinciple}
                    onChange={v => updatePBS({ keyPrinciple: v })} area rows={4} placeholder="What is the single most important thing staff should remember when supporting this person?" />
                </div>
              )}

              {/* 3 — Function */}
              {section === 3 && (
                <div className="animate-in fade-in duration-700">
                  <p className="text-[13px] font-black text-hc-muted mb-8 leading-relaxed italic border-l-2 border-hc-teal pl-4 py-1">"Describe specific behaviours and what the person might be trying to communicate through them."</p>
                  <TableEditor
                    label="Behaviour as Communication Analysis"
                    rows={pbs.functionRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ functionRows: v as unknown as typeof pbs.functionRows })}
                    cols={[
                      { key: 'behaviour', label: 'The Behaviour' },
                      { key: 'func', label: 'What they are communicating', area: true },
                    ]}
                    addRow={() => ({ behaviour: '', func: '' })}
                  />
                </div>
              )}

              {/* 4 — Proactive Support */}
              {section === 4 && (
                <div className="animate-in fade-in duration-700 space-y-4">
                  <ListField label="Adaptive Living Environment & Surroundings" items={pbs.envStrategies}
                    onChange={v => updatePBS({ envStrategies: v })} />
                  <ListField label="Structure & Life Skills & Daily Routine" items={pbs.routineStrategies}
                    onChange={v => updatePBS({ routineStrategies: v })} />
                  <ListField label="Relationships & Interaction" items={pbs.relationshipStrategies}
                    onChange={v => updatePBS({ relationshipStrategies: v })} />
                  <ListField label="Communication Strategies" items={pbs.communicationStrategies}
                    onChange={v => updatePBS({ communicationStrategies: v })} />
                  <ListField label="Digital & Online Safety (Optional)" items={pbs.onlineSafetyStrategies || []}
                    onChange={v => updatePBS({ onlineSafetyStrategies: v })} />
                </div>
              )}

              {/* 5 — Early Warning Signs */}
              {section === 5 && (
                <div className="animate-in fade-in duration-700">
                  <p className="text-[13px] font-black text-hc-muted mb-8 leading-relaxed italic border-l-2 border-hc-teal pl-4 py-1">"Identify signs that the person is beginning to feel distressed and how staff should respond immediately."</p>
                  <TableEditor
                    label="Early Warning Signs & Actions"
                    rows={pbs.warningSignRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ warningSignRows: v as unknown as typeof pbs.warningSignRows })}
                    cols={[
                      { key: 'sign', label: 'The Sign/Behaviour', area: true },
                      { key: 'staffAction', label: 'How staff should respond', area: true },
                    ]}
                    addRow={() => ({ sign: '', staffAction: '' })}
                  />
                </div>
              )}

              {/* 6 — Reactive Strategies */}
              {section === 6 && (
                <div className="animate-in fade-in duration-700">
                  <p className="text-[13px] font-black text-hc-muted mb-8 leading-relaxed italic border-l-2 border-hc-red pl-4 py-1">"Step-by-step de-escalation strategies to follow when behaviour has intensified."</p>
                  <div className="space-y-2">
                    {[
                      ['Step 1 — Low Arousal Response (Voice/Body)', pbs.reactiveStep1, (v: string) => updatePBS({ reactiveStep1: v })],
                      ['Step 2 — Giving Space', pbs.reactiveStep2, (v: string) => updatePBS({ reactiveStep2: v })],
                      ['Step 3 — Reducing Demands', pbs.reactiveStep3, (v: string) => updatePBS({ reactiveStep3: v })],
                      ['Step 4 — Redirection (Suggested phrases)', pbs.reactiveStep4, (v: string) => updatePBS({ reactiveStep4: v })],
                      ['Step 5 — Validation & Reassurance', pbs.reactiveStep5, (v: string) => updatePBS({ reactiveStep5: v })],
                      ['Step 6 — Managing Conflict', pbs.reactiveStep6, (v: string) => updatePBS({ reactiveStep6: v })],
                      ['Step 7 — Emergency Response (if required)', pbs.reactiveStep7, (v: string) => updatePBS({ reactiveStep7: v })],
                    ].map(([label, value, onChange], i) => (
                      <Field key={i} label={label as string} value={value as string} onChange={onChange as (v: string) => void} area rows={2} />
                    ))}
                  </div>
                  <div className="mt-8">
                    <Field label="Calming Strategies (Optional)" value={pbs.walksNote}
                      onChange={v => updatePBS({ walksNote: v })} area rows={3} placeholder="Describe specific calming activities or routines..." />
                  </div>
                </div>
              )}

              {/* 7 — Post-Incident Support */}
              {section === 7 && (
                <div className="animate-in fade-in duration-700 space-y-6">
                  <ListField label="Immediate Support for the Person" items={pbs.postImmediate}
                    onChange={v => updatePBS({ postImmediate: v })} rows={2} />
                  <ListField label="Debriefing & Support for Staff" items={pbs.postDebrief}
                    onChange={v => updatePBS({ postDebrief: v })} rows={2} />
                  <ListField label="Required Documentation & Reporting" items={pbs.staffResponsibilities}
                    onChange={v => updatePBS({ staffResponsibilities: v })} />
                </div>
              )}

              {/* 8 — What Works */}
              {section === 8 && (
                <div className="animate-in fade-in duration-700 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <ListField label="✓ What Works Best" items={pbs.whatWorks}
                    onChange={v => updatePBS({ whatWorks: v })} placeholder="e.g. Using a calm and quiet voice" />
                  <ListField label="✗ What to Avoid" items={pbs.doesntWork}
                    onChange={v => updatePBS({ doesntWork: v })} placeholder="e.g. Raising your voice or making sudden moves" />
                </div>
              )}

              {/* 9 — Medication Management & Safety */}
              {section === 9 && (
                <div className="animate-in fade-in duration-700">
                  <TableEditor
                    label="Medication Management & Safety Record"
                    rows={pbs.medicationRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ medicationRows: v as unknown as typeof pbs.medicationRows })}
                    cols={[
                      { key: 'name', label: 'Medication Name' },
                      { key: 'dose', label: 'Dosage' },
                      { key: 'when', label: 'When to take' },
                      { key: 'purpose', label: 'Purpose' },
                      { key: 'notes', label: 'Additional Notes' },
                    ]}
                    addRow={() => ({ name: '', dose: '', when: 'AM', purpose: '', notes: '' })}
                  />
                  <div className="mt-8">
                    <Field label="Administration & Preference Notes"
                      value={pbs.medicationNote} onChange={v => updatePBS({ medicationNote: v })} area rows={5}
                      placeholder="Refusal protocols, side-effect monitoring, and specific preferences for taking Medication Management & Safety..." />
                  </div>
                </div>
              )}

              {/* 10 — Multi-Agency & Review */}
              {section === 10 && (
                <div className="animate-in fade-in duration-700">
                  <TableEditor
                    label="Involved Professionals & Agencies"
                    rows={pbs.agencyRows as unknown as Record<string, string>[]}
                    onChange={v => updatePBS({ agencyRows: v as unknown as typeof pbs.agencyRows })}
                    cols={[
                      { key: 'service', label: 'Service / Agency' },
                      { key: 'role', label: 'Role' },
                      { key: 'status', label: 'Status' },
                    ]}
                    addRow={() => ({ service: '', role: '', status: 'ACTIVE' })}
                  />
                  <div className="h-8" />
                  <Field label="Review Schedule" value={pbs.reviewSchedule}
                    onChange={v => updatePBS({ reviewSchedule: v })} area rows={3} />
                  <Field label="Person's Involvement" value={pbs.serviceUserInvolvement}
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
            <div className="flex justify-between mt-16 pt-8 border-t border-hc-border relative z-10">
              {section > 0
                ? <button onClick={() => setSection(s => s - 1)}
                    className="flex items-center gap-3 px-8 py-4 hc-clay-raised text-[11px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-hc-text transition-all duration-500 hover:bg-hc-clay-dark active:scale-90 shadow-xl">
                    <ArrowLeft className="w-4 h-4" />
                    Previous Section
                  </button>
                : <div />}
              {section < SECTIONS.length - 1
                ? <button onClick={() => setSection(s => s + 1)}
                    className="flex items-center gap-3 px-10 py-4 btn-tactical text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all">
                    Next Section
                    <ChevronRight className="w-4 h-4" />
                  </button>
                : <button onClick={generatePDF}
                    className="flex items-center gap-3 px-10 py-4 btn-tactical text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all group/btn">
                    <Printer className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                    Print PBS Plan
                  </button>}
            </div>
          </div>
        </div>
      </div>

      <iframe ref={iframeRef} style={{ display: 'none' }} title="pbs-print" />
    </div>
  );
}
