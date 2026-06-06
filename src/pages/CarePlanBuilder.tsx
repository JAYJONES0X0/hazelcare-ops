import { useState, useRef, useCallback, useMemo } from 'react';
import { loadClients, saveClient, emptyCarePlan, LEVEL_OF_NEED_LABELS } from '../lib/client-store';
import { buildCarePlanHtml } from '../lib/doc-renderer';
import type { ExportLayout } from '../lib/doc-renderer';
import { SignaturePanel, emptySignatories } from '../components/SignaturePad';
import { loadWeekData } from '../lib/storage';
import { parseUniversalText } from '../lib/universal-import';
import { getAllEntries } from '../lib/entry-store';
import { mergeCarePlanData } from '../lib/intel-merge';
import { Sparkles, ChevronRight, Download } from 'lucide-react';
import type { FullClient, CarePlanDomain } from '../lib/client-store';
import type { Sig } from '../components/SignaturePad';
import { extractFileText } from '../lib/universal-extractor';
import { mergeClientIdentity } from '../lib/client-identity-merge';
import { buildCarePlanFromProfileEvidence } from '../lib/profile-intelligence-fill';

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

function Field({ label, value, onChange, area = false, rows = 3, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  area?: boolean; rows?: number; placeholder?: string;
}) {
  const cls = 'w-full hc-clay-inset px-5 py-4 text-[11px] font-black text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-teal/20 placeholder:text-hc-muted shadow-inner transition-all';
  return (
    <div className="mb-6 group animate-in fade-in slide-in-from-left-2 duration-500 text-hc-text">
      <label className="text-[11px] mb-2.5 ml-1 block font-black tracking-[0.2em] group-focus-within:opacity-100 transition-opacity uppercase text-hc-muted">{label}</label>
      {area
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={cls + ' resize-y scrollbar-thin italic'} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />}
    </div>
  );
}

function NeedLevelSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#ef4444'];
  
  return (
    <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 text-hc-text">
      <label className="text-[11px] mb-5 ml-1 block font-black tracking-[0.2em] uppercase text-hc-muted">Tactical Support Requirement</label>
      <div className="flex flex-wrap gap-3">
        {LEVEL_OF_NEED_LABELS.map((label, i) => (
          <button key={i} onClick={() => onChange(i)}
            className={`flex-1 text-[11px] font-black uppercase tracking-widest py-4 px-2 rounded-2xl transition-all duration-500 shadow-xl active:scale-95 border
              ${value === i
                ? `hc-clay-inset bg-hc-bg/50 border-hc-teal/30 scale-105 z-10`
                : 'hc-clay-raised border-hc-border/20 text-hc-muted hover:text-hc-text'
            }`}
            style={value === i ? { color: colors[i] } : {}}>
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
  if (score <= 3) { color = '#16a34a'; label = 'Low'; }
  else if (score <= 6) { color = '#3b82f6'; label = 'Moderate'; }
  else if (score <= 12) { color = '#f59e0b'; label = 'Significant'; }
  else if (score <= 16) { color = '#ef4444'; label = 'High'; }
  else { color = '#ef4444'; label = 'Critical'; }

  const likelihoodLabels = ['', 'Rare', 'Unlikely', 'Possible', 'Likely', 'Certain'];
  const impactLabels = ['', 'Insignificant', 'Tolerable', 'Undesirable', 'Severe', 'Catastrophic'];

  return (
    <div className="hc-clay-raised rounded-[2.5rem] p-10 mb-10 shadow-2xl relative overflow-hidden group border border-hc-muted/5">
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.03] blur-3xl group-hover:opacity-[0.08] transition-opacity" style={{ background: color }} />
      <p className="section-header text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-shimmer text-hc-muted">Risk Analysis</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="group/slider">
          <div className="flex items-center justify-between mb-3 px-1 transition-transform group-hover/slider:translate-x-1">
            <label className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Likelihood: {likelihoodLabels[likelihood].toUpperCase()}</label>
            <span className="text-[11px] font-black text-hc-text tabular-nums">{likelihood}</span>
          </div>
          <input type="range" min={1} max={5} value={likelihood} onChange={e => onLikelihood(Number(e.target.value))}
            className="w-full h-2 bg-hc-dark/80 rounded-full appearance-none cursor-pointer accent-hc-teal shadow-inner border border-white/5" />
        </div>
        <div className="group/slider">
          <div className="flex items-center justify-between mb-3 px-1 transition-transform group-hover/slider:translate-x-1">
            <label className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Impact: {impactLabels[impact].toUpperCase()}</label>
            <span className="text-[11px] font-black text-hc-text tabular-nums">{impact}</span>
          </div>
          <input type="range" min={1} max={5} value={impact} onChange={e => onImpact(Number(e.target.value))}
            className="w-full h-2 bg-hc-dark/80 rounded-full appearance-none cursor-pointer accent-hc-teal shadow-inner border border-white/5" />
        </div>
      </div>
      <div className="flex items-center gap-6 pt-6 border-t border-hc-border/20 relative z-10">
        <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">Clinical Risk Score:</span>
        <span className="text-4xl font-black tabular-nums tracking-tighter" style={{ color }}>{score}</span>
        <span className="pill !bg-hc-bg text-[11px] font-black uppercase tracking-[0.2em] px-6 py-1.5 shadow-xl border border-hc-border/20" style={{ color }}>{label}</span>
        <span className="text-[11px] font-bold text-hc-muted uppercase tracking-widest ml-auto tabular-nums">{likelihood} × {impact} MATRIX</span>
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
    <div className="animate-in slide-in-from-right-4 duration-700 text-hc-text">
      <div className="flex items-center gap-8 mb-12 group">
        <div className="w-20 h-20 rounded-3xl hc-clay-raised flex items-center justify-center text-4xl shadow-2xl transition-transform group-hover:scale-110 duration-700 border border-hc-muted/5">
          {DOMAIN_ICONS[domain.title] || '📄'}
        </div>
        <div>
          <h2 className="text-4xl font-black text-hc-text tracking-tighter uppercase mb-2">{domain.title}</h2>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-hc-teal animate-pulse" />
            <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em]">Operational Support Parameters</p>
          </div>
        </div>
      </div>

      <NeedLevelSelector value={domain.levelOfNeed} onChange={v => up({ levelOfNeed: v })} />

      <Field label="Identified Clinical Needs" value={domain.identifiedNeed} onChange={v => up({ identifiedNeed: v })}
        area rows={5} placeholder="Describe the challenges and needs in this area — use the person's own words where possible..." />

      <Field label="Planned Tactical Outcomes" value={domain.plannedOutcomes} onChange={v => up({ plannedOutcomes: v })}
        area rows={4} placeholder="What does success look like? What are we working towards?" />

      <Field label="Support Execution Strategy" value={domain.howToAchieve} onChange={v => up({ howToAchieve: v })}
        area rows={6} placeholder="Describe day-to-day support routines, preferences, and how staff can help..." />

      <div className="h-10" />
      <div className="text-[11px] font-black mb-6 ml-1 text-hc-muted tracking-[0.3em] uppercase">Sector Risk Management</div>
      
      <Field label="Risk Summary" value={domain.riskTitle} onChange={v => up({ riskTitle: v })}
        placeholder="e.g. Risk of falls due to limited mobility" />

      <RiskScoreWidget
        likelihood={domain.riskLikelihood} impact={domain.riskImpact}
        onLikelihood={v => up({ riskLikelihood: v })} onImpact={v => up({ riskImpact: v })} />

      <Field label="Mitigation & Safeguarding" value={domain.riskMitigation} onChange={v => up({ riskMitigation: v })}
        area rows={5} placeholder="Describe specific actions staff should take to reduce this risk..." />

      <div className="border-t border-hc-muted/10 pt-16 mt-20 space-y-10">
        <p className="text-3xl font-black text-hc-text tracking-tighter uppercase">Audit Trail</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <Field label="Target Review Date" value={domain.nextReviewDate} onChange={v => up({ nextReviewDate: v })} />
          <Field label="Clinical Reviewer" value={domain.reviewer} onChange={v => up({ reviewer: v })} />
        </div>
        <Field label="Review Note" value={domain.reviewNote} onChange={v => up({ reviewNote: v })}
          area rows={4} placeholder="Summary of the latest review — include feedback from the person..." />
        <Field label="Start Date" value={domain.reviewDate} onChange={v => up({ reviewDate: v })}
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

  const [synthStatus, setSynthStatus] = useState('');

  const handleAutoFill = () => {
    const evidence = buildCarePlanFromProfileEvidence(client, today, reviewDate);
    const evidenceCount = evidence.carePlan?.domains.filter((domain) => domain.enabled && domain.identifiedNeed).length || 0;
    const currentCount = (client.carePlan?.domains || []).filter((domain) => domain.enabled && domain.identifiedNeed).length;
    if (evidenceCount > currentCount) {
      const next = { ...client, carePlan: evidence.carePlan };
      saveClient(next);
      setClient(next);
      setSynthStatus(evidence.message);
      return;
    }

    // Pull from persistent store (all historical data)
    const persistedEntries = getAllEntries().filter(e =>
      e.client && client.name && e.client.toLowerCase().includes(client.name.split(' ')[0].toLowerCase())
    );
    // Also pull current week data as fallback
    const weekData = loadWeekData();
    const weekEntries = (weekData?.clientDiary?.[client.name] || []).map(e => ({ entry: e.entry }));
    const allEntries = persistedEntries.length ? persistedEntries : weekEntries;

    if (!allEntries.length) {
      setSynthStatus(`No diary entries found for ${client.name}. Import a diary CSV first.`);
      return;
    }

    setSynthStatus(`Mapping ${allEntries.length} entries across 21 care domains...`);

    const DOMAIN_MAP: { idx: number; keywords: string[] }[] = [
      { idx: 0,  keywords: ['environment', 'safety', 'hazard', 'risk at home'] },
      { idx: 1,  keywords: ['breathing', 'respiratory', 'nebuliser', 'inhaler', 'oxygen'] },
      { idx: 2,  keywords: ['communication', 'speech', 'sign', 'makaton', 'sensory', 'hearing', 'visual'] },
      { idx: 3,  keywords: ['social', 'friend', 'family', 'visit', 'community', 'relationship'] },
      { idx: 4,  keywords: ['routine', 'schedule', 'life skill', 'daily task', 'independence'] },
      { idx: 5,  keywords: ['food', 'eat', 'drink', 'fluid', 'meal', 'nutrition', 'diet', 'appetite'] },
      { idx: 6,  keywords: ['toilet', 'continence', 'shower', 'wash', 'hygiene', 'personal care', 'catheter', 'pad'] },
      { idx: 7,  keywords: ['home', 'bedroom', 'living', 'environment', 'adapt'] },
      { idx: 8,  keywords: ['choice', 'right', 'decision', 'autonomy', 'inclus', 'advocate'] },
      { idx: 9,  keywords: ['intimate', 'personal express', 'relationship', 'partner'] },
      { idx: 10, keywords: ['finance', 'money', 'budget', 'shopping', 'bank'] },
      { idx: 11, keywords: ['health', 'gp', 'nurse', 'appointm', 'medical', 'check-up'] },
      { idx: 12, keywords: ['infection', 'virus', 'ppe', 'hand wash', 'covid', 'flu'] },
      { idx: 13, keywords: ['medication', 'tablet', 'pill', 'dose', 'prescribed', 'pharmacy', 'mar'] },
      { idx: 14, keywords: ['mood', 'mental', 'anxious', 'depress', 'emotion', 'wellbeing', 'stress'] },
      { idx: 15, keywords: ['walk', 'mobility', 'hoist', 'wheelchair', 'exercise', 'physio', 'transfer'] },
      { idx: 16, keywords: ['pain', 'discomfort', 'ache', 'sore', 'painkiller', 'analgesic'] },
      { idx: 17, keywords: ['shower', 'bath', 'wash', 'shave', 'hair', 'groom', 'dress', 'personal care'] },
      { idx: 18, keywords: ['skin', 'pressure', 'wound', 'blister', 'reddening', 'turning', 'grade'] },
      { idx: 19, keywords: ['sleep', 'night', 'woke', 'insomnia', 'rest', 'bed'] },
      { idx: 20, keywords: ['faith', 'religion', 'culture', 'belief', 'spiritual', 'elm', 'mosque'] },
    ];

    setClient(prev => {
      const cp = prev.carePlan || emptyCarePlan(today, reviewDate);
      const domains = cp.domains.map(d => ({ ...d }));

      allEntries.forEach(e => {
        const text = (e.entry || '').toLowerCase();
        for (const { idx, keywords } of DOMAIN_MAP) {
          if (keywords.some(kw => text.includes(kw))) {
            domains[idx].enabled = true;
            if (domains[idx].identifiedNeed.length < 800) {
              domains[idx].identifiedNeed = (domains[idx].identifiedNeed ? domains[idx].identifiedNeed + '\n' : '') + e.entry.slice(0, 200);
            }
            break;
          }
        }
      });

      const enabledCount = domains.filter(d => d.enabled).length;
      setSynthStatus(`Mapped ${allEntries.length} entries → ${enabledCount} domains enabled. Review and refine each.`);
      const next = { ...prev, carePlan: { ...cp, domains } };
      persist(next);
      return next;
    });
  };

  const importDataset = async (file: File) => {
    setImporting(true);
    setImportStatus('Reading dataset...');
    try {
      const rawText = await extractFileText(file);
      const parsed = parseUniversalText(rawText);

      setClient(prev => {
        const base = mergeClientIdentity(prev, parsed.client);
        const mergedCarePlan = mergeCarePlanData(prev.carePlan, parsed.carePlan, today);
        const next: FullClient = { ...base, carePlan: mergedCarePlan };
        saveClient(next);
        return next;
      });
      setImportStatus(`Dataset imported and merged. ${parsed.carePlan?.domains?.filter((d) => d.enabled).length || 0} domain(s) detected.`);
    } catch (err) {
      setImportStatus(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const enabledCount = carePlan.domains.filter(d => d.enabled).length;
  const filledCount = carePlan.domains.filter(d => d.enabled && d.identifiedNeed).length;

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
            <span className="pill !bg-hc-bg text-hc-purple border border-hc-purple/30 text-[11px] font-black tracking-widest px-4 py-1 shadow-lg uppercase">Clinical Support Plan</span>
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">Tactical Care Delivery</span>
            <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest tabular-nums ${saved ? 'text-flag-green' : 'text-flag-amber animate-pulse'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${saved ? 'bg-flag-green' : 'bg-flag-amber animate-pulse'}`} />
              {saved ? 'Matrix Synchronized' : 'Calibrating Data...'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => importFileRef.current?.click()}
            disabled={importing}
            className="px-6 py-3.5 rounded-2xl hc-clay-raised border border-hc-muted/5 text-[10px] font-black uppercase tracking-[0.2em] text-hc-text hover:brightness-90 transition-all disabled:opacity-50"
          >
            {importing ? 'Ingesting...' : 'Ingest Dataset'}
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
              className="appearance-none hc-clay-inset hover:border-hc-teal/50 rounded-xl pl-5 pr-12 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-hc-text outline-none cursor-pointer transition-colors shadow-inner"
              title="Export page orientation"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-hc-muted pointer-events-none rotate-90" />
          </div>
          <button onClick={handleAutoFill}
            className="flex items-center gap-3 px-8 py-3.5 hc-clay-raised border border-hc-teal/20 text-hc-teal text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:brightness-90 transition-all shadow-xl active:scale-95">
            <Sparkles className="w-4 h-4" /> Fill from Evidence
          </button>
          <button onClick={generatePDF}
            className="flex items-center gap-3 px-10 py-3.5 btn-tactical text-hc-bg text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all group">
            <Download className="w-4 h-4" />
            Print Support Plan
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Domain sidebar */}
        <div className="w-80 flex-shrink-0 border-r border-hc-border/20 overflow-y-auto hc-clay-raised z-10 scrollbar-thin">
          <div className="p-8 border-b border-hc-border/20 flex items-center justify-between">
            <p className="text-[11px] font-black tracking-[0.3em] text-hc-muted uppercase">Sector Nodes</p>
            <span className="pill !bg-hc-bg text-[11px] font-black text-hc-teal px-3 py-1 border border-hc-teal/20 tabular-nums">{filledCount}/{enabledCount}</span>
          </div>
          <div className="py-6">
            <button onClick={() => { setShowOverview(true); setActiveDomain(null); }}
              className={`w-full text-left px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-5 transition-all duration-500 group relative overflow-hidden active:scale-95
                ${showOverview && activeDomain === null ? 'hc-clay-inset text-hc-teal' : 'text-hc-muted hover:text-hc-text'}`}>
              {showOverview && activeDomain === null && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-hc-teal shadow-[0_0_15px_#14b8a6] z-10" />}
              <span className="text-xl group-hover:scale-110 transition-transform duration-500 relative z-10">📊</span>
              <span className="flex-1 relative z-10 group-hover:translate-x-1 transition-transform duration-500">Service Sitrep</span>
            </button>

            {carePlan.domains.map((domain, i) => {
              const hasContent = domain.enabled && domain.identifiedNeed;
              const isActive = activeDomain === i;
              return (
                <button key={i} onClick={() => { setActiveDomain(i); setShowOverview(false); }}
                  className={`w-full text-left px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-5 transition-all duration-500 group relative overflow-hidden active:scale-95
                    ${isActive ? 'hc-clay-inset text-hc-teal' : 'text-hc-muted hover:text-hc-text'}`}>
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-hc-teal shadow-[0_0_15px_#14b8a6] z-10" />}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-700 relative z-10
                    ${hasContent ? 'bg-hc-teal shadow-[0_0_10px_#14b8a6] scale-110' : domain.enabled ? 'bg-flag-amber shadow-[0_0_10px_#d9974e]' : 'bg-hc-muted/20 group-hover:bg-hc-muted/40'}`} />
                  <span className="flex-1 truncate relative z-10 group-hover:translate-x-1 transition-transform duration-500">{domain.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-12 scrollbar-thin bg-hc-bone">
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-6 duration-700 pb-32">
            {!!synthStatus && (
              <div className="mb-4 text-[11px] font-black uppercase tracking-widest rounded-2xl px-8 py-5 border border-hc-teal/30 bg-hc-teal/10 text-hc-teal flex items-center gap-4 animate-in slide-in-from-top-4">
                <Sparkles className="w-4 h-4 shrink-0" />{synthStatus}
              </div>
            )}
            {!!importStatus && (
              <div className={`mb-10 text-[11px] font-black uppercase tracking-widest rounded-2xl px-8 py-5 border flex items-center gap-4 animate-in slide-in-from-top-4 ${importStatus.includes('failed') ? 'bg-flag-red/10 border-flag-red/30 text-flag-red' : 'bg-hc-teal/10 border-hc-teal/30 text-hc-teal'}`}>
                <div className={`w-2 h-2 rounded-full ${importStatus.includes('failed') ? 'bg-flag-red' : 'bg-hc-teal animate-pulse'}`} />
                {importStatus}
              </div>
            )}

            {/* Overview mode */}
            {(showOverview || activeDomain === null) && (
              <div className="animate-in fade-in duration-700">
                <div className="mb-12 flex items-center gap-6">
                  <div className="w-20 h-20 rounded-3xl hc-clay-raised border-2 border-white/10 flex items-center justify-center text-3xl font-black text-hc-teal-light shadow-2xl glow-teal animate-float">
                    📊
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-hc-text tracking-tighter uppercase text-shimmer mb-1">Plan Overview</h2>
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
                      <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em]">Setting up service background and key information</p>
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

                <div className="mt-16 pt-10 border-t border-hc-border/20">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 px-2">
                    <div>
                      <h3 className="text-2xl font-black text-hc-text tracking-tighter uppercase text-shimmer">Care Areas</h3>
                      <p className="text-[11px] font-bold text-hc-muted uppercase tracking-[0.2em] mt-1">{enabledCount} of 21 care areas currently active</p>
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
                      }} className="px-5 py-2.5 hc-clay-raised border border-hc-teal/30 text-hc-teal-light text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-hc-teal/10 hover:text-hc-text transition-all shadow-lg active:scale-95">Activate All Areas</button>
                      <button onClick={() => {
                        setClient(prev => {
                          const cp = prev.carePlan || emptyCarePlan(today, reviewDate);
                          const domains = cp.domains.map(d => ({ ...d, enabled: false }));
                          const next = { ...prev, carePlan: { ...cp, domains } };
                          persist(next);
                          return next;
                        });
                      }} className="px-5 py-2.5 hc-clay-raised border border-hc-border/20 text-hc-muted text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:text-hc-text transition-all active:scale-95">Deactivate All</button>
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
                              ? 'hc-clay-raised border-hc-border/20 bg-white/[0.02] hover:bg-white/[0.05] hover:border-hc-teal/40' 
                              : 'border-hc-border/20 bg-hc-dark/40 text-hc-muted hover:opacity-60'
                            }`}
                          style={{ animationDelay: `${i * 30}ms` }}
                          onClick={() => { setActiveDomain(i); setShowOverview(false); }}>
                          
                          {/* Node Toggle */}
                          <button onClick={e => { e.stopPropagation(); toggleDomain(i); }}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border-2 transition-all duration-500 shadow-xl group-hover/node:scale-110
                              ${domain.enabled ? 'bg-hc-teal/20 border-hc-teal text-hc-teal-light' : 'border-hc-border/20 bg-black/20 text-transparent'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>

                          <span className="text-2xl transition-transform group-hover/node:scale-125 duration-500 select-none">{DOMAIN_ICONS[domain.title] || '📄'}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-black text-hc-text uppercase tracking-tight block truncate group-hover/node:text-hc-teal-light transition-colors">{domain.title}</span>
                            {domain.enabled && (
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[11px] font-black uppercase tracking-widest ${hasContent ? 'text-hc-teal-light' : 'text-flag-amber animate-pulse'}`}>
                                  {hasContent ? 'PLAN CONFIGURED' : 'AWAITING DETAILS'}
                                </span>
                                {domain.riskTitle && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full shadow-lg" style={{ background: riskColor, boxShadow: `0 0 8px ${riskColor}` }} />
                                    <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">RISK LEVEL: {score}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className={`w-8 h-8 rounded-xl hc-clay-inset border border-hc-border/20 flex items-center justify-center text-hc-muted opacity-0 group-hover/node:opacity-100 group-hover/node:translate-x-1 transition-all duration-500`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-16 pt-10 border-t border-hc-border/20">
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
              <div className="flex justify-between mt-16 pt-8 border-t border-hc-border/20 relative z-10">
                <button onClick={() => {
                  if (activeDomain > 0) setActiveDomain(activeDomain - 1);
                  else { setShowOverview(true); setActiveDomain(null); }
                }}
                  className="flex items-center gap-3 px-8 py-4 hc-clay-raised border border-hc-border/20 text-[11px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-hc-text rounded-2xl transition-all duration-500 hover:bg-white/[0.03] active:scale-90 shadow-xl">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  Previous Area
                </button>
                {activeDomain < carePlan.domains.length - 1
                  ? <button onClick={() => setActiveDomain(activeDomain + 1)}
                      className="flex items-center gap-3 px-10 py-4 btn-gradient text-hc-text text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all">
                      Next Area
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  : <button onClick={generatePDF}
                      className="flex items-center gap-3 px-10 py-4 btn-gradient text-hc-text text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all group/btn">
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
