import { useState, useRef, useCallback } from 'react';
import { loadClients, saveClient, emptyCarePlan, LEVEL_OF_NEED_LABELS } from '../lib/client-store';
import { buildCarePlanHtml } from '../lib/doc-renderer';
import type { FullClient, CarePlanDomain } from '../lib/client-store';

interface Props {
  clientId: string;
  onBack: () => void;
}

const DOMAIN_ICONS: Record<string, string> = {
  'Accommodation Cleanliness and Comfort': '🏠',
  'Breathing': '🫁',
  'Communication and Senses': '💬',
  'Companionship, Social Interaction and Recreation': '🤝',
  'Daily Routine': '📋',
  'Eating and Drinking': '🍽️',
  'Elimination': '🚻',
  'Environment': '🌿',
  'Equality, Diversity and Inclusion': '⚖️',
  'Expressing Sexuality': '❤️',
  'Financial': '💷',
  'Health and Wellbeing': '🩺',
  'Infection Prevention and Control': '🧴',
  'Medication': '💊',
  'Mental Health and Cognition': '🧠',
  'Mobility': '🦽',
  'Pain': '⚡',
  'Personal Care and Dressing': '🪥',
  'Skin Integrity': '🩹',
  'Sleeping': '😴',
  'Spirituality, Religion and Culture': '🕊️',
};

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

function NeedLevelSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = ['#16a34a', '#65a30d', '#d97706', '#ea580c', '#dc2626'];
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">How Much Support I Need</label>
      <div className="flex gap-2">
        {LEVEL_OF_NEED_LABELS.map((label, i) => (
          <button key={i} onClick={() => onChange(i)}
            className={`flex-1 text-[11px] font-semibold py-2 px-1 rounded-lg border transition-all ${
              value === i
                ? 'text-white border-transparent'
                : 'text-gray-500 border-[#1e3050] hover:border-[#2a4060]'
            }`}
            style={value === i ? { background: colors[i], borderColor: colors[i] } : {}}>
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
  else if (score <= 6) { color = '#65a30d'; label = 'Low–Medium'; }
  else if (score <= 12) { color = '#d97706'; label = 'Medium–High'; }
  else if (score <= 16) { color = '#dc2626'; label = 'High'; }
  else { color = '#7f1d1d'; label = 'Critical'; }

  const likelihoodLabels = ['', 'Very Low', 'Low', 'Medium', 'High', 'Very High'];
  const impactLabels = ['', 'Insignificant', 'Tolerable', 'Undesirable', 'Major', 'Catastrophic'];

  return (
    <div className="bg-[#0a1120] border border-[#1e3050] rounded-xl p-4 mb-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">How We Measure This Risk</p>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">Likelihood: {likelihood} — {likelihoodLabels[likelihood]}</label>
          <input type="range" min={1} max={5} value={likelihood} onChange={e => onLikelihood(Number(e.target.value))}
            className="w-full accent-teal-500" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">Impact: {impact} — {impactLabels[impact]}</label>
          <input type="range" min={1} max={5} value={impact} onChange={e => onImpact(Number(e.target.value))}
            className="w-full accent-teal-500" />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-3 border-t border-[#1e3050]">
        <span className="text-sm text-gray-400">Risk Score:</span>
        <span className="text-xl font-black" style={{ color }}>{score}</span>
        <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: color }}>{label}</span>
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
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">{DOMAIN_ICONS[domain.title] || '📄'}</span>
        <div>
          <h2 className="text-base font-bold text-white">{domain.title}</h2>
          <p className="text-xs text-gray-500">Tell us about this area of {domain.title.toLowerCase()}.</p>
        </div>
      </div>

      <NeedLevelSelector value={domain.levelOfNeed} onChange={v => up({ levelOfNeed: v })} />

      <Field label="About Me — What I Need" value={domain.identifiedNeed} onChange={v => up({ identifiedNeed: v })}
        area rows={5} placeholder="In their own words where possible — what challenges do they face in this area?" />

      <Field label="What Good Looks Like for Me" value={domain.plannedOutcomes} onChange={v => up({ plannedOutcomes: v })}
        area rows={4} placeholder="What would they say 'good' looks like? Use their words." />

      <Field label="How My Team Supports Me" value={domain.howToAchieve} onChange={v => up({ howToAchieve: v })}
        area rows={6} placeholder="How should the team support them day-to-day? Include routines, preferences, and what to do if things change." />

      <Field label="What Could Go Wrong" value={domain.riskTitle} onChange={v => up({ riskTitle: v })}
        placeholder="e.g. Risk of falls if mobility support isn't provided" />

      <RiskScoreWidget
        likelihood={domain.riskLikelihood} impact={domain.riskImpact}
        onLikelihood={v => up({ riskLikelihood: v })} onImpact={v => up({ riskImpact: v })} />

      <Field label="How We Keep Me Safe" value={domain.riskMitigation} onChange={v => up({ riskMitigation: v })}
        area rows={3} placeholder="What does the team do to reduce this risk? What should they watch for?" />

      <div className="border-t border-[#1e3050] pt-4 mt-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Review</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="When We Check Again" value={domain.nextReviewDate} onChange={v => up({ nextReviewDate: v })} />
          <Field label="Who Checked" value={domain.reviewer} onChange={v => up({ reviewer: v })} />
        </div>
        <Field label="What's Working / What's Not" value={domain.reviewNote} onChange={v => up({ reviewNote: v })}
          area rows={3} placeholder="What's working well? What needs to change? Include their own views." />
        <Field label="When They Checked" value={domain.reviewDate} onChange={v => up({ reviewDate: v })}
          placeholder="DD/MM/YYYY" />
      </div>
    </div>
  );
}

export function CarePlanBuilder({ clientId, onBack }: Props) {
  const [client, setClient] = useState<FullClient>(() => {
    const all = loadClients();
    return all.find(c => c.id === clientId) || all[0];
  });
  const [activeDomain, setActiveDomain] = useState<number | null>(null);
  const [saved, setSaved] = useState(true);
  const [showOverview, setShowOverview] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
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
    const html = buildCarePlanHtml(client);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
  };

  const enabledCount = carePlan.domains.filter(d => d.enabled).length;
  const filledCount = carePlan.domains.filter(d => d.enabled && d.identifiedNeed).length;

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
          <span className="text-sm font-semibold text-white">{client.name || 'New Person'}</span>
          <span className="text-xs text-gray-500 ml-2">Support Plan</span>
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-gray-500">{filledCount}/{enabledCount} areas complete</span>
        <span className={`text-[11px] font-medium ${saved ? 'text-teal-500' : 'text-amber-400'}`}>
          {saved ? '✓ Saved' : '● Unsaved'}
        </span>
        <button onClick={generatePDF}
          className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Create My Document
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Domain sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-[#1e3050] overflow-y-auto bg-[#060b14]">
          {/* Overview button */}
          <button onClick={() => { setShowOverview(true); setActiveDomain(null); }}
            className={`w-full text-left px-4 py-2.5 text-[12px] font-medium flex items-center gap-2 transition-colors border-b border-[#1e3050]
              ${showOverview && activeDomain === null ? 'bg-teal-900/40 text-teal-400 border-r-2 border-teal-500' : 'text-gray-400 hover:text-white hover:bg-[#111b2e]'}`}>
            📊 Overview & Bio
          </button>

          {carePlan.domains.map((domain, i) => {
            const hasContent = domain.enabled && domain.identifiedNeed;
            const isActive = activeDomain === i;
            return (
              <button key={i} onClick={() => { setActiveDomain(i); setShowOverview(false); }}
                className={`w-full text-left px-3 py-2 text-[11px] font-medium flex items-center gap-2 transition-colors
                  ${isActive ? 'bg-teal-900/40 text-teal-400 border-r-2 border-teal-500' : 'text-gray-400 hover:text-white hover:bg-[#111b2e]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  hasContent ? 'bg-teal-500' : domain.enabled ? 'bg-amber-500' : 'bg-[#1e3050]'
                }`} />
                <span className="truncate">{domain.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">

            {/* Overview mode */}
            {(showOverview || activeDomain === null) && (
              <div>
                <h2 className="text-base font-bold text-white mb-1">My Support Plan</h2>
                <p className="text-xs text-gray-500 mb-5">Toggle on the areas that apply to this person. Click any area to edit.</p>

                {/* Bio + Emergency */}
                <Field label="My Life Story" value={carePlan.biography} onChange={v => updateMeta({ biography: v })}
                  area rows={4} placeholder="A brief personal history — who is this person, what is their background?" />
                <Field label="Important Things About Me" value={carePlan.criticalInfo} onChange={v => updateMeta({ criticalInfo: v })}
                  area rows={3} placeholder="Mobility aids, diet type, allergies, medical conditions…" />
                <Field label="In an Emergency" value={carePlan.emergencyInfo} onChange={v => updateMeta({ emergencyInfo: v })}
                  area rows={3} placeholder="Emergency contacts, evacuation plan, rescue medication…" />

                <div className="border-t border-[#1e3050] mt-6 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white">Areas of My Life ({enabledCount} active)</h3>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setClient(prev => {
                          const cp = prev.carePlan || emptyCarePlan(today, reviewDate);
                          const domains = cp.domains.map(d => ({ ...d, enabled: true }));
                          const next = { ...prev, carePlan: { ...cp, domains } };
                          persist(next);
                          return next;
                        });
                      }} className="text-[11px] text-teal-400 hover:text-teal-300 font-medium">Enable All</button>
                      <span className="text-gray-600">|</span>
                      <button onClick={() => {
                        setClient(prev => {
                          const cp = prev.carePlan || emptyCarePlan(today, reviewDate);
                          const domains = cp.domains.map(d => ({ ...d, enabled: false }));
                          const next = { ...prev, carePlan: { ...cp, domains } };
                          persist(next);
                          return next;
                        });
                      }} className="text-[11px] text-gray-500 hover:text-gray-400 font-medium">Disable All</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {carePlan.domains.map((domain, i) => {
                      const hasContent = domain.identifiedNeed;
                      const score = domain.riskLikelihood * domain.riskImpact;
                      let riskColor = '#1e3050';
                      if (domain.enabled && domain.riskTitle) {
                        if (score <= 3) riskColor = '#16a34a';
                        else if (score <= 6) riskColor = '#65a30d';
                        else if (score <= 12) riskColor = '#d97706';
                        else if (score <= 16) riskColor = '#dc2626';
                        else riskColor = '#7f1d1d';
                      }

                      return (
                        <div key={i}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                            domain.enabled ? 'bg-[#111b2e] border-[#1e3050] hover:border-[#2a4060]' : 'bg-[#080e1a] border-[#111b2e] opacity-60'
                          }`}
                          onClick={() => { setActiveDomain(i); setShowOverview(false); }}>
                          {/* Toggle */}
                          <button onClick={e => { e.stopPropagation(); toggleDomain(i); }}
                            className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${
                              domain.enabled ? 'bg-teal-700 border-teal-600' : 'border-[#2a4060]'
                            }`}>
                            {domain.enabled && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>}
                          </button>

                          <span className="text-base">{DOMAIN_ICONS[domain.title] || '📄'}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-white block truncate">{domain.title}</span>
                            {domain.enabled && hasContent && (
                              <span className="text-[10px] text-gray-500">
                                Level {domain.levelOfNeed} — {LEVEL_OF_NEED_LABELS[domain.levelOfNeed]}
                                {domain.riskTitle && ` · Risk: ${score}`}
                              </span>
                            )}
                          </div>

                          {domain.enabled && domain.riskTitle && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: riskColor }} />
                          )}

                          {domain.enabled && (
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasContent ? 'bg-teal-500' : 'bg-amber-500'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
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
              <div className="flex justify-between mt-8 pt-6 border-t border-[#1e3050]">
                <button onClick={() => {
                  if (activeDomain > 0) setActiveDomain(activeDomain - 1);
                  else { setShowOverview(true); setActiveDomain(null); }
                }}
                  className="text-sm text-gray-400 hover:text-white font-medium">← Previous</button>
                {activeDomain < carePlan.domains.length - 1
                  ? <button onClick={() => setActiveDomain(activeDomain + 1)}
                      className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                      Next Domain →
                    </button>
                  : <button onClick={generatePDF}
                      className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                      Create My Document
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
