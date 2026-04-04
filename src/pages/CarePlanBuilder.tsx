import { useState, useRef, useCallback, useMemo } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { loadClients, saveClient, emptyCarePlan, LEVEL_OF_NEED_LABELS } from '../lib/client-store';
import { buildCarePlanHtml } from '../lib/doc-renderer';
import type { ExportLayout } from '../lib/doc-renderer';
import { SignaturePanel, emptySignatories } from '../components/SignaturePad';
import { loadWeekData } from '../lib/storage';
import { parseUniversalText } from '../lib/universal-import';
import type { FullClient, CarePlanDomain } from '../lib/client-store';
import type { Sig } from '../components/SignaturePad';

interface Props {
  clientId: string;
  onBack: () => void;
}

const DOMAIN_ICONS: Record<string, string> = {
  'Environment & Physical Safety': '🛡️',
  'Respiratory Health & Support': '🫁',
  'Communication & Sensory Integration': '💬',
  'Social Engagement & Relationships': '🤝',
  'Life Skills & Daily Routine': '📋',
  'Nutrition, Hydration & Diet': '🍽️',
  'Continence & Personal Hygiene': '🚻',
  'Adaptive Living Environment': '🌿',
  'Rights, Choice & Inclusion': '⚖️',
  'Intimacy & Personal Expression': '❤️',
  'Financial Management & Autonomy': '💷',
  'Holistic Health & Vitality': '🩺',
  'Infection Control & Public Health': '🧴',
  'Medication Management & Safety': '💊',
  'Mental Health & Emotional Wellbeing': '🧠',
  'Mobility, Movement & Exercise': '🏃',
  'Pain Management & Comfort': '⚡',
  'Personal Care & Physical Presentation': '🪥',
  'Skin Integrity & Pressure Care': '🩹',
  'Rest & Sleep Patterns': '😴',
  'Cultural, Spiritual & Personal Beliefs': '🕊️',
};

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

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

function NeedLevelSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#ef4444'];
  const pills = ['pill-green', 'pill-blue', 'pill-amber', 'pill-red', 'pill-red'];
  
  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <label className="section-header text-[9px] mb-4 ml-1 block opacity-60 tracking-[0.2em] uppercase">Level of Support Needed</label>
      <div className="flex flex-wrap gap-2">
        {LEVEL_OF_NEED_LABELS.map((label, i) => (
          <button key={i} onClick={() => onChange(i)}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest py-3 px-2 rounded-xl border transition-all duration-500 shadow-lg active:scale-95
              ${value === i
                ? `${pills[i]} scale-105 z-10 border-transparent shadow-xl`
                : 'glass-light border-white/5 text-hc-muted hover:border-white/20 hover:text-white'
            }`}
            style={value === i ? { boxShadow: `0 0 20px ${colors[i]}40` } : {}}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RiskScoreWidget({ likelihood, impact, onLikelihood, onImpact }: {
  likelihood: number; impact: number;
  onLikelihood: (v: number) => void; onImpact: (v: number) => void;
}) {
  const score = likelihood * impact;
  let color: string;
  let label: string;
  let pill: string;
  if (score <= 3) { color = '#16a34a'; label = 'Low'; pill = 'pill-green'; }
  else if (score <= 6) { color = '#3b82f6'; label = 'Moderate'; pill = 'pill-blue'; }
  else if (score <= 12) { color = '#f59e0b'; label = 'Significant'; pill = 'pill-amber'; }
  else if (score <= 16) { color = '#ef4444'; label = 'High'; pill = 'pill-red'; }
  else { color = '#ef4444'; label = 'Critical'; pill = 'pill-red animate-pulse-soft'; }

  const likelihoodLabels = ['', 'Rare', 'Unlikely', 'Possible', 'Likely', 'Certain'];
  const impactLabels = ['', 'Insignificant', 'Tolerable', 'Undesirable', 'Severe', 'Catastrophic'];

  return (
    <div className="glass border border-white/5 rounded-[2rem] p-8 mb-8 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.03] blur-3xl group-hover:opacity-[0.08] transition-opacity" style={{ background: color }} />
      <p className="section-header text-[9px] font-black uppercase tracking-[0.3em] mb-8 text-shimmer">Risk Analysis</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="group/slider">
          <div className="flex items-center justify-between mb-3 px-1 transition-transform group-hover/slider:translate-x-1">
            <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Likelihood: {likelihoodLabels[likelihood].toUpperCase()}</label>
            <span className="text-[10px] font-black text-white tabular-nums">{likelihood}</span>
          </div>
          <input type="range" min={1} max={5} value={likelihood} onChange={e => onLikelihood(Number(e.target.value))}
            className="w-full h-2 bg-hc-dark/80 rounded-full appearance-none cursor-pointer accent-hc-teal shadow-inner border border-white/5" />
        </div>
        <div className="group/slider">
          <div className="flex items-center justify-between mb-3 px-1 transition-transform group-hover/slider:translate-x-1">
            <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Impact: {impactLabels[impact].toUpperCase()}</label>
            <span className="text-[10px] font-black text-white tabular-nums">{impact}</span>
          </div>
          <input type="range" min={1} max={5} value={impact} onChange={e => onImpact(Number(e.target.value))}
            className="w-full h-2 bg-hc-dark/80 rounded-full appearance-none cursor-pointer accent-hc-teal shadow-inner border border-white/5" />
        </div>
      </div>
      <div className="flex items-center gap-6 pt-6 border-t border-white/5 relative z-10">
        <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em]">Risk Score:</span>
        <span className="text-4xl font-black tabular-nums tracking-tighter" style={{ color, textShadow: `0 0 30px ${color}40` }}>{score}</span>
        <span className={`pill ${pill} text-[10px] font-black uppercase tracking-[0.2em] px-6 py-1.5 shadow-xl shadow-black/20 animate-shimmer`}>{label}</span>
        <span className="text-[10px] font-bold text-hc-muted/40 uppercase tracking-widest ml-auto tabular-nums">{likelihood} × {impact} MATRIX</span>
      </div>
    </div>
  );
}

function DomainEditor({ domain, onChange }: {
  domain: CarePlanDomain;
  onChange: (d: CarePlanDomain) => void;
}) {
  const up = (patch: Partial<CarePlanDomain>) => onChange({ ...domain, ...patch });

  return (
    <div className="animate-in slide-in-from-right-4 duration-700">
      <div className="flex items-center gap-6 mb-10 group">
        <div className="w-16 h-16 rounded-2xl glass border-2 border-white/10 flex items-center justify-center text-3xl shadow-2xl transition-transform group-hover:scale-110 duration-500">
          {DOMAIN_ICONS[domain.title] || '📄'}
        </div>
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase text-shimmer">{domain.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
            <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-60">Configuring care area support details</p>
          </div>
        </div>
      </div>

      <NeedLevelSelector value={domain.levelOfNeed} onChange={v => up({ levelOfNeed: v })} />

      <Field label="Identified Needs" value={domain.identifiedNeed} onChange={v => up({ identifiedNeed: v })}
        area rows={5} placeholder="Describe the challenges and needs in this area — use the person's own words where possible..." />

      <Field label="Planned Outcomes" value={domain.plannedOutcomes} onChange={v => up({ plannedOutcomes: v })}
        area rows={4} placeholder="What does success look like? What are we working towards?" />

      <Field label="How to Support" value={domain.howToAchieve} onChange={v => up({ howToAchieve: v })}
        area rows={6} placeholder="Describe day-to-day support routines, preferences, and how staff can help..." />

      <div className="h-8" />
      <div className="section-header text-[9px] mb-6 ml-1 opacity-60 tracking-[0.3em] uppercase">Managing Risks</div>
      
      <Field label="Identified Risk" value={domain.riskTitle} onChange={v => up({ riskTitle: v })}
        placeholder="e.g. Risk of falls due to limited mobility" />

      <RiskScoreWidget
        likelihood={domain.riskLikelihood} impact={domain.riskImpact}
        onLikelihood={v => up({ riskLikelihood: v })} onImpact={v => up({ riskImpact: v })} />

      <Field label="Risk Management & Mitigation" value={domain.riskMitigation} onChange={v => up({ riskMitigation: v })}
        area rows={4} placeholder="Describe specific actions staff should take to reduce this risk and what to watch out for..." />

      <div className="border-t border-white/10 pt-10 mt-16 space-y-8">
        <p className="text-2xl font-black text-white tracking-tighter uppercase text-shimmer">Review Details</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Field label="Next Review Date" value={domain.nextReviewDate} onChange={v => up({ nextReviewDate: v })} />
          <Field label="Reviewer Name" value={domain.reviewer} onChange={v => up({ reviewer: v })} />
        </div>
        <Field label="Review Notes" value={domain.reviewNote} onChange={v => up({ reviewNote: v })}
          area rows={4} placeholder="Summary of the latest review — include feedback from the person being supported..." />
        <Field label="Date of Last Review" value={domain.reviewDate} onChange={v => up({ reviewDate: v })}
          placeholder="DD/MM/YYYY" />
      </div>
    </div>
  );
}

function getDates() {
  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  return { today, reviewDate };
}

export function CarePlanBuilder({ clientId, onBack }: Props) {
  const { today, reviewDate } = useMemo(() => getDates(), []);
  const [client, setClient] = useState<FullClient>(() => {
    const all = loadClients();
    return all.find(c => c.id === clientId) || all[0];
  });
  const [activeDomain, setActiveDomain] = useState<number | null>(null);
  const [saved, setSaved] = useState(true);
  const [showOverview, setShowOverview] = useState(true);
  const [exportLayout, setExportLayout] = useState<ExportLayout>('portrait');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [sigs, setSigs] = useState<Sig[]>(() => {
    const c = loadClients().find(x => x.id === clientId);
    return emptySignatories(c?.completedBy || 'Brooklyn Ruvinga', c?.keyWorker || '', c?.responsible || '');
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const carePlan = client.carePlan || emptyCarePlan(today, reviewDate);

  const persist = useCallback((next: FullClient) => {
    saveClient(next);
    setSaved(true);
  }, []);

  const updateDomain = useCallback((index: number, domain: CarePlanDomain) => {
    setClient(prev => {
      const cp = prev.carePlan || emptyCarePlan(today, reviewDate);
      const domains = [...cp.domains];
      domains[index] = { ...domain, enabled: true };
      const next = { ...prev, carePlan: { ...cp, domains } };
      persist(next);
      return next;
    });
  }, [persist, today, reviewDate]);

  const updateMeta = useCallback((patch: Partial<{ biography: string; criticalInfo: string; emergencyInfo: string; planDate: string }>) => {
    setClient(prev => {
      const cp = { ...(prev.carePlan || emptyCarePlan(today, reviewDate)), ...patch };
      const next = { ...prev, carePlan: cp };
      persist(next);
      return next;
    });
  }, [persist, today, reviewDate]);

  const toggleDomain = useCallback((index: number) => {
    setClient(prev => {
      const cp = prev.carePlan || emptyCarePlan(today, reviewDate);
      const domains = [...cp.domains];
      domains[index] = { ...domains[index], enabled: !domains[index].enabled };
      const next = { ...prev, carePlan: { ...cp, domains } };
      persist(next);
      return next;
    });
  }, [persist, today, reviewDate]);

  const generatePDF = () => {
    const html = buildCarePlanHtml(client, sigs, exportLayout);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
  };

  const handleAutoFill = () => {
    const weekData = loadWeekData();
    if (!weekData || !weekData.clientDiary[client.name]) {
      alert(`No intelligence data found for ${client.name}. Ensure you have imported a diary CSV first.`);
      return;
    }

    if (!confirm(`Found ${weekData.clientDiary[client.name].length} entries for ${client.name}. Automatically map these to the 21 care domains?`)) return;

    setClient(prev => {
      const cp = prev.carePlan || emptyCarePlan(today, reviewDate);
      const domains = [...cp.domains];
      const entries = weekData.clientDiary[client.name];

      // Intelligent Mapping Logic
      entries.forEach(e => {
        const text = e.entry.toLowerCase();
        let domainIdx = -1;

        if (text.includes('medication') || text.includes('tablet') || text.includes('prescribed')) domainIdx = 13;
        else if (text.includes('finance') || text.includes('money') || text.includes('shopping')) domainIdx = 10;
        else if (text.includes('mood') || text.includes('anxious') || text.includes('mental')) domainIdx = 14;
        else if (text.includes('walking') || text.includes('mobility') || text.includes('hoist')) domainIdx = 15;
        else if (text.includes('food') || text.includes('eat') || text.includes('drink') || text.includes('fluid')) domainIdx = 5;
        else if (text.includes('shower') || text.includes('wash') || text.includes('shave')) domainIdx = 17;
        else if (text.includes('sleep') || text.includes('night') || text.includes('woke')) domainIdx = 19;
        
        if (domainIdx !== -1) {
          domains[domainIdx].enabled = true;
          domains[domainIdx].identifiedNeed = (domains[domainIdx].identifiedNeed ? domains[domainIdx].identifiedNeed + '\n' : '') + e.entry;
        }
      });

      const next = { ...prev, carePlan: { ...cp, domains } };
      persist(next);
      return next;
    });
  };

  const importDataset = async (file: File) => {
    setImporting(true);
    setImportStatus('Reading dataset...');
    try {
      let rawText = '';
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        const ab = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: ab }).promise;
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          rawText += (content.items as any[]).map((it) => it?.str || '').join(' ') + '\n';
        }
      } else {
        rawText = await file.text();
      }
      const parsed = parseUniversalText(rawText);
      const next: FullClient = {
        ...client,
        ...parsed.client,
        carePlan: parsed.carePlan || client.carePlan,
      };
      saveClient(next);
      setClient(next);
      setImportStatus(`Dataset imported. ${parsed.carePlan.domains.filter((d) => d.enabled).length} domain(s) detected.`);
    } catch (err: any) {
      setImportStatus(`Import failed: ${err?.message || 'unknown error'}`);
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const enabledCount = carePlan.domains.filter(d => d.enabled).length;
  const filledCount = carePlan.domains.filter(d => d.enabled && d.identifiedNeed).length;

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
            <span className="pill pill-purple text-[9px] font-black tracking-widest px-3 py-0.5 shadow-lg">SUPPORT PLAN BUILDER</span>
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-60">Care & Support Planning</span>
            <span className={`text-[10px] font-black uppercase tracking-widest tabular-nums ${saved ? 'text-flag-green' : 'text-flag-amber animate-pulse'}`}>
              {saved ? '✓ DATA SAVED' : '● SAVING CHANGES...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 rounded-xl glass-light border border-hc-teal/30 text-[10px] font-black uppercase tracking-[0.08em] text-hc-teal-light disabled:opacity-50"
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
          <select
            value={exportLayout}
            onChange={e => setExportLayout(e.target.value as ExportLayout)}
            className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white"
            title="Export page orientation"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
          {loadWeekData()?.clientDiary[client.name] && (
            <button onClick={handleAutoFill}
              className="hidden md:flex items-center gap-2 px-5 py-2.5 glass-light border border-hc-teal/30 text-hc-teal-light text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-hc-teal/10 hover:text-white transition-all shadow-lg active:scale-95 animate-shimmer">
              <span className="text-sm">🧠</span> Synthesise from Intelligence
            </button>
          )}
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1 opacity-50">COMPLETION STATUS</span>
            <span className="pill pill-teal text-[10px] font-black px-3 py-0.5 shadow-lg">{filledCount}/{enabledCount} AREAS COMPLETE</span>
          </div>
          <button onClick={generatePDF}
            className="flex items-center gap-3 px-8 py-3 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all group">
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Support Plan
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden mesh-bg">
        {/* Domain sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-white/5 overflow-y-auto glass backdrop-blur-3xl scrollbar-thin">
          <div className="p-6 border-b border-white/5 bg-black/20">
            <p className="section-header text-[9px] tracking-[0.3em] opacity-40 uppercase">Care Areas</p>
          </div>
          <div className="py-2">
            <button onClick={() => { setShowOverview(true); setActiveDomain(null); }}
              className={`w-full text-left px-6 py-5 text-[11px] font-black uppercase tracking-widest flex items-center gap-4 transition-all duration-500 group relative overflow-hidden border-b border-white/5 active:scale-95
                ${showOverview && activeDomain === null ? 'bg-hc-teal/10 text-hc-teal-light shadow-[inset_0_0_20px_rgba(20,184,166,0.05)]' : 'text-hc-muted hover:text-white hover:bg-white/5'}`}>
              {showOverview && <div className="absolute left-0 top-0 bottom-0 w-1 bg-hc-teal shadow-[0_0_15px_#14b8a6] z-10" />}
              <span className="text-xl group-hover:scale-110 transition-transform duration-500 relative z-10">📊</span>
              <span className="flex-1 relative z-10 group-hover:translate-x-1 transition-transform duration-500">Service Overview & Bio</span>
            </button>

            {carePlan.domains.map((domain, i) => {
              const hasContent = domain.enabled && domain.identifiedNeed;
              const isActive = activeDomain === i;
              return (
                <button key={i} onClick={() => { setActiveDomain(i); setShowOverview(false); }}
                  className={`w-full text-left px-6 py-4 text-[11px] font-black uppercase tracking-widest flex items-center gap-4 transition-all duration-500 group relative overflow-hidden active:scale-95
                    ${isActive ? 'bg-hc-teal/10 text-hc-teal-light shadow-[inset_0_0_20px_rgba(20,184,166,0.05)]' : 'text-hc-muted hover:text-white hover:bg-white/5'}`}>
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-hc-teal shadow-[0_0_15px_#14b8a6] z-10" />}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-700 relative z-10
                    ${hasContent ? 'bg-hc-teal glow-teal scale-110' : domain.enabled ? 'bg-flag-amber glow-amber shadow-lg shadow-amber-950/20' : 'bg-white/10 group-hover:bg-white/30'}`} />
                  <span className="flex-1 truncate relative z-10 group-hover:translate-x-1 transition-transform duration-500">{domain.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 scrollbar-thin">
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-700 pb-24">
            {!!importStatus && (
              <div className="mb-6 text-xs rounded-xl px-4 py-3 border border-hc-teal/30 bg-hc-teal/10 text-hc-teal-light">
                {importStatus}
              </div>
            )}

            {/* Overview mode */}
            {(showOverview || activeDomain === null) && (
              <div className="animate-in fade-in duration-700">
                <div className="mb-12 flex items-center gap-6">
                  <div className="w-20 h-20 rounded-3xl glass border-2 border-white/10 flex items-center justify-center text-3xl font-black text-hc-teal-light shadow-2xl glow-teal animate-float">
                    📊
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase text-shimmer mb-1">Plan Overview</h2>
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
                      <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-60">Setting up service background and key information</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Field label="About the Person" value={carePlan.biography} onChange={v => updateMeta({ biography: v })}
                    area rows={6} placeholder="A brief summary of who this person is, their background, and their journey..." />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    <Field label="Important Information" value={carePlan.criticalInfo} onChange={v => updateMeta({ criticalInfo: v })}
                      area rows={4} placeholder="Critical care needs, dietary requirements, allergies, and medical conditions..." />
                    <Field label="In an Emergency" value={carePlan.emergencyInfo} onChange={v => updateMeta({ emergencyInfo: v })}
                      area rows={4} placeholder="Emergency protocols, rescue medication, and primary emergency contacts..." />
                  </div>
                </div>

                <div className="mt-16 pt-10 border-t border-white/10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 px-2">
                    <div>
                      <h3 className="text-2xl font-black text-white tracking-tighter uppercase text-shimmer">Care Areas</h3>
                      <p className="text-[10px] font-bold text-hc-muted uppercase tracking-[0.2em] mt-1 opacity-60">{enabledCount} of 21 care areas currently active</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => {
                        setClient(prev => {
                          const cp = prev.carePlan || emptyCarePlan(today, reviewDate);
                          const domains = cp.domains.map(d => ({ ...d, enabled: true }));
                          const next = { ...prev, carePlan: { ...cp, domains } };
                          persist(next);
                          return next;
                        });
                      }} className="px-5 py-2.5 glass-light border border-hc-teal/30 text-hc-teal-light text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-hc-teal/10 hover:text-white transition-all shadow-lg active:scale-95">Activate All Areas</button>
                      <button onClick={() => {
                        setClient(prev => {
                          const cp = prev.carePlan || emptyCarePlan(today, reviewDate);
                          const domains = cp.domains.map(d => ({ ...d, enabled: false }));
                          const next = { ...prev, carePlan: { ...cp, domains } };
                          persist(next);
                          return next;
                        });
                      }} className="px-5 py-2.5 glass-light border border-white/10 text-hc-muted text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:text-white transition-all active:scale-95">Deactivate All</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {carePlan.domains.map((domain, i) => {
                      const hasContent = domain.identifiedNeed;
                      const score = domain.riskLikelihood * domain.riskImpact;
                      let riskColor = 'transparent';
                      if (domain.enabled && domain.riskTitle) {
                        if (score <= 3) riskColor = '#16a34a';
                        else if (score <= 6) riskColor = '#3b82f6';
                        else if (score <= 12) riskColor = '#f59e0b';
                        else riskColor = '#ef4444';
                      }

                      return (
                        <div key={i}
                          className={`flex items-center gap-4 px-6 py-4 rounded-[1.5rem] border transition-all duration-500 cursor-pointer card-glow group/node animate-in slide-in-from-bottom-2 active:scale-[0.98]
                            ${domain.enabled 
                              ? 'glass-light border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-hc-teal/40' 
                              : 'border-white/5 bg-hc-dark/40 opacity-40 hover:opacity-60'
                            }`}
                          style={{ animationDelay: `${i * 30}ms` }}
                          onClick={() => { setActiveDomain(i); setShowOverview(false); }}>
                          
                          {/* Node Toggle */}
                          <button onClick={e => { e.stopPropagation(); toggleDomain(i); }}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border-2 transition-all duration-500 shadow-xl group-hover/node:scale-110
                              ${domain.enabled ? 'bg-hc-teal/20 border-hc-teal text-hc-teal-light' : 'border-white/10 bg-black/20 text-transparent'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>

                          <span className="text-2xl transition-transform group-hover/node:scale-125 duration-500 select-none">{DOMAIN_ICONS[domain.title] || '📄'}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-black text-white uppercase tracking-tight block truncate group-hover/node:text-hc-teal-light transition-colors">{domain.title}</span>
                            {domain.enabled && (
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[8px] font-black uppercase tracking-widest ${hasContent ? 'text-hc-teal-light' : 'text-flag-amber animate-pulse'}`}>
                                  {hasContent ? 'PLAN CONFIGURED' : 'AWAITING DETAILS'}
                                </span>
                                {domain.riskTitle && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full shadow-lg" style={{ background: riskColor, boxShadow: `0 0 8px ${riskColor}` }} />
                                    <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em]">RISK LEVEL: {score}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className={`w-8 h-8 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted opacity-0 group-hover/node:opacity-100 group-hover/node:translate-x-1 transition-all duration-500`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-16 pt-10 border-t border-white/10">
                  <SignaturePanel sigs={sigs} onChange={setSigs} />
                </div>
              </div>
            )}

            {/* Domain editor */}
            {activeDomain !== null && !showOverview && (
              <DomainEditor
                domain={carePlan.domains[activeDomain]}
                onChange={d => updateDomain(activeDomain, d)}
              />
            )}

            {/* Navigation */}
            {activeDomain !== null && !showOverview && (
              <div className="flex justify-between mt-16 pt-8 border-t border-white/5 relative z-10">
                <button onClick={() => {
                  if (activeDomain > 0) setActiveDomain(activeDomain - 1);
                  else { setShowOverview(true); setActiveDomain(null); }
                }}
                  className="flex items-center gap-3 px-8 py-4 glass-light border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-white rounded-2xl transition-all duration-500 hover:bg-white/[0.03] active:scale-90 shadow-xl">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  Previous Area
                </button>
                {activeDomain < carePlan.domains.length - 1
                  ? <button onClick={() => setActiveDomain(activeDomain + 1)}
                      className="flex items-center gap-3 px-10 py-4 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all">
                      Next Area
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  : <button onClick={generatePDF}
                      className="flex items-center gap-3 px-10 py-4 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all group/btn">
                      <svg className="w-5 h-5 group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print Support Plan
                    </button>}
              </div>
            )}
          </div>
        </div>
      </div>

      <iframe ref={iframeRef} style={{ display: 'none' }} title="careplan-print" />
    </div>
  );
}
