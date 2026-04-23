import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Activity, RefreshCw, History, FileText, CheckCircle, Sparkles, Download, Lightbulb, Zap, Search, X, ChevronRight, ShieldAlert } from 'lucide-react';
import type { WeekSummary, CareEntry, StaffMember } from '../lib/types';
import type { Page } from '../App';
import { ORG_CONFIG } from '../lib/config';
import { scoreEntry } from '../lib/entry-rubric';
import {
  computeStaffMonitoring,
  defaultMondayWindow,
  filterEntries,
  flattenWeekEntries,
  type MonitoringFilters,
} from '../lib/staff-monitoring';
import { buildCallPrepScript, type CallPrepVariant } from '../lib/call-prep';
import {
  saveMonitoringRun,
  saveCallOutcome,
  lastHourlyCheckAt,
  touchHourlyCheck,
  loadCallOutcomes,
  recordCoachingEvents,
  recordModuleScores,
  detectGrowthAlerts,
  loadActiveTracking,
  logCoachingAction,
  loadActiveSequences,
  enrollInSequence,
  advanceSequence,
  STANDARD_SEQUENCES,
  type GrowthAlert,
  type ActiveSequence,
} from '../lib/staff-monitoring-store';
import { mergeMonitoringIntoTemplateContext, type MonitoringTemplateContext } from '../lib/staff-monitoring-template-context';
import {
  downloadText,
  careEntriesToEvidenceCsv,
  buildCoordinatorReadme,
  buildCoordinatorEvidenceHtml,
  buildCoordinatorPackMeta,
} from '../lib/coordinator-export-pack';
import { buildExportRecommendations } from '../lib/export-recommendations';

interface Props {
  staff: StaffMember[];
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
  onDataParsed: (data: WeekSummary) => void;
}

function entryTypeLabel(category?: string, rawType?: string): { label: string; icon: string; colorClass: string } {
  const cat = (category || '').toLowerCase();
  const t = (rawType || '').toLowerCase();
  if (cat === 'handover' || t.includes('handover')) return { label: 'Handover', icon: '🔄', colorClass: 'text-hc-teal-light bg-hc-teal/10 border-hc-teal/20' };
  if (cat === 'daily_support' || t.includes('task note') || t.includes('daily 1:1') || t.includes('1:1')) return { label: 'Task Note', icon: '✅', colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
  if (cat === 'medication' || t.includes('medication')) return { label: 'Medication', icon: '💊', colorClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
  if (cat === 'safeguarding' || t.includes('safeguard')) return { label: 'Safeguarding', icon: '🛡️', colorClass: 'text-flag-red bg-flag-red/10 border-flag-red/20' };
  if (cat === 'incident' || t.includes('incident') || t.includes('abc')) return { label: 'Incident', icon: '🚨', colorClass: 'text-flag-red bg-flag-red/10 border-flag-red/20' };
  if (cat === 'finance' || t.includes('expense') || t.includes('mileage')) return { label: 'Finance', icon: '💷', colorClass: 'text-flag-green bg-flag-green/10 border-flag-green/20' };
  if (cat === 'staff' || t.includes('senior support') || t.includes('supervision')) return { label: 'Staff Note', icon: '👤', colorClass: 'text-hc-purple-light bg-hc-purple/10 border-hc-purple/20' };
  return { label: 'Entry', icon: '📋', colorClass: 'text-hc-muted bg-white/5 border-white/10' };
}

export function StaffMonitoringPage({ staff: _staff, weekData, setPage }: Omit<Props, 'onDataParsed'> & { onDataParsed?: (data: WeekSummary) => void }) {
  const def = useMemo(() => defaultMondayWindow(), []);
  const detailRef = useRef<HTMLDivElement>(null);

  const [house, setHouse] = useState<string>('all');
  const [dateFrom] = useState(def.dateFrom);
  const [dateTo] = useState(def.dateTo);
  const [selectedEscId, setSelectedEscId] = useState<string | null>(null);
  const [callVariant, setCallVariant] = useState<CallPrepVariant>('message');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [outcomeType, setOutcomeType] = useState<'reached' | 'voicemail' | 'refused' | 'callback' | 'resolved'>('reached');
  const [hourlyDismissed, setHourlyDismissed] = useState(false);

  const [growthAlerts, setGrowthAlerts] = useState<GrowthAlert[]>([]);
  const [copiedGrowthAlert, setCopiedGrowthAlert] = useState<string | null>(null);

  const [coachStaff, setCoachStaff] = useState<string | null>(null);
  const [coachEntry, setCoachEntry] = useState<CareEntry | null>(null);
  const [coachRewrite, setCoachRewrite] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachCopied, setCoachCopied] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [trackingList, setTrackingList] = useState(() => loadActiveTracking());
  const [activeSequences, setActiveSequences] = useState<ActiveSequence[]>(() => loadActiveSequences());

  const filters: MonitoringFilters = useMemo(() => ({ house, dateFrom, dateTo }), [house, dateFrom, dateTo]);
  const snapshot = useMemo(() => computeStaffMonitoring(weekData, filters), [weekData, filters]);
  const exportHints = useMemo(() => buildExportRecommendations(snapshot), [snapshot]);

  const selectedEsc = useMemo(() => {
    if (coachStaff) {
      return snapshot.escalations.find(e => e.carer === coachStaff) || null;
    }
    return snapshot.escalations.find((e) => e.id === selectedEscId) || snapshot.escalations[0] || null;
  }, [snapshot.escalations, selectedEscId, coachStaff]);

  useEffect(() => {
    if (snapshot.escalations.length && !selectedEscId && !coachStaff) {
      setSelectedEscId(snapshot.escalations[0].id);
    }
  }, [snapshot.escalations, selectedEscId, coachStaff]);

  const script = useMemo(() => {
    if (!selectedEsc) return null;
    const hl = house === 'all' ? selectedEsc.house : house;
    return buildCallPrepScript(selectedEsc, hl, callVariant);
  }, [selectedEsc, house, callVariant]);

  const hourlyDue = useMemo(() => {
    const last = lastHourlyCheckAt();
    return !last || (Date.now() - last > 3600000);
  }, []);

  const onRecompute = useCallback(() => {
    saveMonitoringRun(`${snapshot.windowLabel} · ${snapshot.dataFreshness.entryCount} entries`, snapshot.escalations.length);
    const alerts = detectGrowthAlerts(snapshot.staff);
    if (alerts.length > 0) setGrowthAlerts(alerts);
    recordCoachingEvents(snapshot.staff.map((s) => ({ carer: s.carer, topGaps: s.topGaps })));
    recordModuleScores(snapshot.staff.map((s) => ({ carer: s.carer, qualityScore: s.qualityScore, moduleBreakdown: s.moduleBreakdown })));

    const ctx: MonitoringTemplateContext = {
      source: 'staff-monitoring', at: new Date().toISOString(), house: house === 'all' ? undefined : house,
      dateFrom, dateTo, escalationCount: snapshot.escalations.length,
      avgHouseQuality: snapshot.houses.length > 0 ? Math.round(snapshot.houses.reduce((a, h) => a + h.avgQuality, 0) / snapshot.houses.length) : undefined,
    };
    mergeMonitoringIntoTemplateContext(ctx);
  }, [snapshot, house, dateFrom, dateTo]);

  const filteredEntries = useMemo(() => weekData ? filterEntries(flattenWeekEntries(weekData), filters) : [], [weekData, filters]);

  function exportMonitoringPack() {
    const meta = buildCoordinatorPackMeta(snapshot, 'staff-monitoring', { entryCount: filteredEntries.length });
    const day = new Date().toISOString().slice(0, 10);
    downloadText(`${ORG_CONFIG.storagePrefix}-evidence-${day}.csv`, careEntriesToEvidenceCsv(filteredEntries), 'text/csv;charset=utf-8');
    downloadText(`${ORG_CONFIG.storagePrefix}-evidence-readme-${day}.txt`, buildCoordinatorReadme(meta), 'text/plain;charset=utf-8');
    downloadText(`${ORG_CONFIG.storagePrefix}-evidence-${day}.html`, buildCoordinatorEvidenceHtml(filteredEntries, meta), 'text/html;charset=utf-8');
  }

  const entriesByStaff = useMemo(() => {
    const map: Record<string, CareEntry[]> = {};
    for (const entry of filteredEntries) {
      const c = entry.carer || 'Unknown';
      if (!map[c]) map[c] = [];
      map[c].push(entry);
    }
    return map;
  }, [filteredEntries]);

  async function generateGoldStandard() {
    if (!coachEntry) return;
    setCoachRewrite(''); setCoachLoading(true);
    try {
      const rubrics = scoreEntry(coachEntry);
      const gaps = rubrics.modules.flatMap(m => m.missing);
      const isHouseNote = coachEntry.client?.toLowerCase().includes('unassigned') || coachEntry.category === 'staff' || coachEntry.category === 'handover';
      
      let rewrite = '';
      if (gaps.length === 0) {
        rewrite = `Great entry! No major gaps detected.\n\nOriginal Text:\n${coachEntry.entry}`;
      } else {
        const example = isHouseNote 
          ? `Example Professional Structure:\n"Staff completed full property checks of the communal areas. All residents observed and welfare checks completed. No safeguarding concerns identified during this period."`
          : `Example Professional Structure:\n"I supported ${coachEntry.client || 'the individual'} with ${coachEntry.category || 'their needs'}. I observed [presentation/mood]. I then took [specific action] to ensure they were comfortable and safe. Changes reported to [role]."`;

        rewrite = `[Locally Synthesised Feedback]\n\nBased on ${ORG_CONFIG.name} Quality Standards, this entry is missing crucial context. When writing about ${coachEntry.client || 'the individual'}, explicitly detail:\n\n` +
          gaps.map((g, i) => `${i + 1}. ${g}`).join('\n') +
          `\n\n${example}\n\nPlease review your notes to meet these core components.`;
      }
      
      await new Promise(r => setTimeout(r, 600));
      setCoachRewrite(rewrite);
    } catch { setCoachRewrite('Error generating rewrite locally.'); }
    finally { setCoachLoading(false); }
  }

  function copyCoachingMessage() {
    if (!coachEntry || !coachRewrite.trim()) return;

    const dispatchContent = script ? script.lines.join('\n') : coachRewrite.trim();

    const channelOutcomeNote =
      callVariant === 'email' ? 'Formal email drafted and copied. Awaiting confirmation of send.' :
      callVariant === 'message' ? 'Direct message copied. Staff in 24hr monitoring queue.' :
      callVariant === 'urgent' ? 'Urgent call script copied. Manager notified to call immediately.' :
      callVariant === 'support-first' ? 'Support-first call script copied. Wellbeing check initiated.' :
      'Manager coaching call script copied. Pending delivery.';

    void navigator.clipboard.writeText(dispatchContent);
    setCoachCopied(true);
    setTimeout(() => setCoachCopied(false), 2500);

    saveCallOutcome(
      selectedEsc || { id: '', carer: coachStaff || 'Unknown', tier: 1, reasons: [], topGaps: [], summary: '', suggestedTool: 'notes', qualityScore: 0, entryCount: 1, shortEntryRatio: 1, avgEntryChars: 10, house: house },
      outcomeType,
      outcomeNotes || channelOutcomeNote,
    );

    const activeSeq = activeSequences.find(s => s.carer === coachStaff && s.status === 'active');
    if (activeSeq) {
      advanceSequence(activeSeq.id, channelOutcomeNote);
      setActiveSequences(loadActiveSequences());
    }

    if (coachStaff) {
      logCoachingAction(coachStaff);
      setTrackingList(loadActiveTracking());
    }
  }

  function handleEnroll(sequenceId: string) {
    if (!coachStaff) return;
    enrollInSequence(coachStaff, sequenceId);
    setActiveSequences(loadActiveSequences());
  }

  const searchedStaff = snapshot.staff.filter(s => s.carer.toLowerCase().includes(searchQuery.toLowerCase()));
  const trackingNames = new Set(trackingList.map(t => t.carer));
  const activeMonitored = searchedStaff.filter(s => trackingNames.has(s.carer));
  const needsReview = searchedStaff.filter(s => !trackingNames.has(s.carer) && s.qualityScore < 65);
  const goodStanding = searchedStaff.filter(s => !trackingNames.has(s.carer) && s.qualityScore >= 65);
  
  const selectedStaffData = snapshot.staff.find(s => s.carer === coachStaff);

  const renderStaffQueue = (list: typeof searchedStaff, title: string, colorClass: string, borderClass: string, emptyMsg: string) => (
    <div className="mb-6 last:mb-0">
      <div className={`text-[10px] font-black uppercase tracking-widest mb-3 pl-2 flex items-center gap-2 ${colorClass}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${colorClass.replace('text-', 'bg-').split(' ')[0]}`} />
        {title} — {list.length}
      </div>
      <div className="space-y-2">
        {list.length === 0 && <div className="px-4 py-3 text-[10px] text-zinc-500 font-medium italic">{emptyMsg}</div>}
        {list.map(s => {
            const scoreHex = s.qualityScore >= 70 ? '#22c55e' : s.qualityScore >= 45 ? '#f59e0b' : '#ef4444';
            const isExpanded = coachStaff === s.carer;
            const staffEntries = entriesByStaff[s.carer] || [];
            const typeCounts: Record<string, { count: number; icon: string; colorClass: string }> = {};
            staffEntries.forEach(e => {
              const { label, icon, colorClass } = entryTypeLabel(e.category, e.type);
              if (!typeCounts[label]) typeCounts[label] = { count: 0, icon, colorClass };
              typeCounts[label].count++;
            });
            const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 3);
            
            return (
              <div key={s.carer} onClick={() => {
                setCoachStaff(s.carer);
                const esc = snapshot.escalations.find(e => e.carer === s.carer);
                if (esc) setSelectedEscId(esc.id);
                
                // AUTO-DIAGNOSTIC INJECTION: Find lowest score entry and auto-select
                const carerEntries = entriesByStaff[s.carer] || [];
                if (carerEntries.length > 0) {
                  const lowest = [...carerEntries].sort((a, b) => scoreEntry(a).total - scoreEntry(b).total)[0];
                  setCoachEntry(lowest);
                  setCoachRewrite('');
                }

                // Scroll detail into view on mobile
                if (window.innerWidth < 1280) {
                  detailRef.current?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
                className={`cursor-pointer rounded-xl border transition-all duration-300 overflow-hidden px-4 py-3 group flex items-center justify-between ${isExpanded ? borderClass + ' bg-black/40 shadow-lg ring-1 ring-hc-teal/20' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06]'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 transition-colors ${isExpanded ? borderClass.replace('border-','bg-').replace('/30','') + ' text-black' : 'bg-black/50 text-hc-muted group-hover:text-white'}`}>
                      {s.carer.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1 px-4">
                      <div className="text-sm font-black tracking-tight mb-1 truncate text-white/90">{s.carer}</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {typeEntries.map(([label, { count, icon, colorClass }]) => (
                          <span key={label} className={`inline-flex items-center gap-0.5 text-[7px] font-black px-1.5 py-0.5 rounded-[4px] border uppercase tracking-wide whitespace-nowrap ${colorClass}`}>
                            {icon} {count}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Operational Space (Center) */}
                    <div className="hidden lg:flex flex-col items-center justify-center border-l border-white/5 px-6 shrink-0 opacity-40">
                       <span className="text-[7px] font-black uppercase text-hc-muted tracking-widest mb-1">Injest Vector</span>
                       <span className="text-[10px] font-black text-hc-text tabular-nums">{staffEntries.length}U</span>
                    </div>
                  </div>

                  
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4 group-hover:translate-x-1 transition-transform">
                    <div className="flex items-center gap-3">
                       <span style={{ color: scoreHex }} className="text-xs font-black tabular-nums">{s.qualityScore}%</span>
                       <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90 text-white' : 'text-hc-muted group-hover:text-white'}`} />
                    </div>
                    <div className="w-16 bg-black/40 h-1 rounded-full overflow-hidden border border-white/5 shadow-inner">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: s.qualityScore + '%', backgroundColor: scoreHex }} />
                    </div>

                    {(() => {
                      const seq = activeSequences.find(seq => seq.carer === s.carer && seq.status === 'active');
                      if (!seq) return null;
                      const totalSteps = STANDARD_SEQUENCES.find(ss => ss.id === seq.sequenceId)?.steps.length || 1;
                      const progress = ((seq.currentStepIndex) / totalSteps) * 100;
                       return (
                         <div className="mt-1 flex items-center gap-1.5" title="Active Outreach Sequence">
                           <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                             <div className="h-full bg-hc-purple animate-shimmer" style={{ width: `${progress}%` }} />
                           </div>
                         </div>
                       );
                     })()}
                  </div>
              </div>
            );
        })}
      </div>
    </div>
  );

  if (!weekData) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-transparent flex flex-col items-center justify-center p-8">

        <Activity className="w-16 h-16 text-hc-muted opacity-20 mb-8" />
        <h2 className="text-2xl font-black text-hc-text uppercase tracking-[0.4em] mb-3 text-center">Personnel Intel Offline</h2>
        <p className="text-hc-muted text-xs uppercase tracking-[0.2em] mb-10 text-center max-w-md leading-relaxed opacity-60">Injest high-integrity field data to activate diagnostic command and stability pipelines.</p>
        <button onClick={() => setPage('upload')} className="bg-hc-teal text-black px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all">Start Injection Matrix</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center">
      <div className="w-full max-w-7xl p-6 lg:p-10 flex flex-col">

        
        {/* SITREP HEADER */}
        <div className="mb-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-hc-border pb-8">
          <div>
            <h2 className="text-3xl font-black text-hc-text tracking-tighter uppercase tabular-nums">Personnel Readiness Command</h2>
            <p className="text-hc-muted text-[10px] font-bold uppercase tracking-[0.4em] opacity-70 mt-1">Operational Oversight & Stability Tracking Matrix</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
             <div className="bg-hc-card border border-hc-border px-6 py-3 rounded-xl flex items-center gap-8 shadow-inner shrink-0">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-hc-muted uppercase opacity-50 mb-1">Status</span>
                  <span className="text-xs font-black text-hc-teal-light uppercase tracking-widest">ACTIVE</span>
                </div>
                <div className="w-px h-8 bg-hc-border" />
                <div className="flex flex-col items-center text-center items-center">
                   <span className="text-[8px] font-black text-hc-muted uppercase opacity-50 mb-1">Gaps_Found</span>
                   <span className="text-xs font-black text-flag-amber uppercase tracking-widest">{needsReview.length} UNITS</span>
                </div>
             </div>
             <button onClick={() => { onRecompute(); setPage('templates'); }} className="group/btn relative px-8 py-3.5 rounded-xl bg-hc-purple/10 border border-hc-purple/30 text-[10px] font-black uppercase tracking-[.3em] text-hc-purple-light hover:text-white hover:bg-hc-purple/20 flex items-center gap-3 transition-all">
               <Sparkles className="w-5 h-5" /> SYNT_INTELLIGENCE
             </button>
             <button onClick={() => setPage('upload')} className="bg-white/5 border border-white/10 px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-hc-text hover:bg-white/10 transition-all">Sync Feed</button>
          </div>
        </div>

        {hourlyDue && !hourlyDismissed && (
          <div className="mb-10 p-8 rounded-3xl bg-flag-amber/10 border border-flag-amber/30 flex items-center justify-between shadow-2xl relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-hc-dark/60 backdrop-blur-3xl -z-10" />
            <div className="flex items-center gap-8 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-flag-amber/20 flex items-center justify-center text-3xl border border-flag-amber/40 shadow-inner">⚠️</div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight uppercase">Operational Sync Required</h3>
                <p className="text-[10px] text-flag-amber/80 font-bold uppercase tracking-[.3em] mt-2 leading-relaxed max-w-xl">Personnel intel is over 60 minutes old. Field readiness data may be stale and require structural re-validation.</p>
              </div>
            </div>
            <div className="flex gap-4 relative z-10 shrink-0">
              <button onClick={() => setHourlyDismissed(true)} className="px-6 py-3 border border-hc-border text-[10px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-text rounded-xl transition-all">Dismiss</button>
              <button onClick={() => { touchHourlyCheck(); setPage('upload'); }} className="px-10 py-3 bg-flag-amber text-black text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-amber-400 transition-all shadow-2xl active:scale-95">Injest Data</button>
            </div>
          </div>
        )}

        {growthAlerts.length > 0 && (
          <div className="mb-12 p-10 rounded-[3rem] bg-hc-teal/5 border border-hc-teal/20 shadow-2xl overflow-hidden relative group shrink-0">
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.1),transparent_70%)]" />
            <div className="flex items-center justify-between mb-10 relative z-10">
               <div className="flex items-center gap-5">
                  <Sparkles className="w-8 h-8 text-hc-teal" />
                  <h2 className="text-2xl font-black text-white tracking-tighter uppercase tabular-nums">Performance Vector Indicators</h2>
               </div>
               <button onClick={() => setGrowthAlerts([])} className="text-[10px] font-black uppercase tracking-[0.3em] text-hc-muted hover:text-white transition-colors border-b border-dashed border-hc-muted hover:border-white">Clear Matrix Signals</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative z-10">
              {growthAlerts.map((a) => (
                <div key={`${a.carer}-${a.module}`} className="bg-hc-card/60 backdrop-blur-xl border border-hc-border p-6 rounded-2xl flex flex-col gap-5 group/alert hover:border-hc-teal/50 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-black text-hc-text uppercase tracking-widest mb-1.5 truncate">{a.carer}</div>
                      <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest leading-relaxed">
                         <span className="text-hc-teal">{a.module}</span> improved {a.previousScore}% → <span className="text-white font-black">{a.currentScore}%</span>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 bg-hc-teal/10 border border-hc-teal/30 rounded-lg text-[10px] font-black text-hc-teal tabular-nums shadow-inner">+{a.delta} PTS</div>
                  </div>
                  <button
                    onClick={() => {
                       void navigator.clipboard.writeText(a.message);
                       setCopiedGrowthAlert(`${a.carer}-${a.module}`);
                       setTimeout(() => setCopiedGrowthAlert(null), 2500);
                    }}
                    className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-hc-border text-hc-muted hover:bg-hc-teal hover:text-black hover:border-hc-teal transition-all flex items-center justify-center gap-2 group-hover/alert:border-hc-teal/30 shadow-lg"
                  >
                    {copiedGrowthAlert === `${a.carer}-${a.module}` ? <CheckCircle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4 opacity-0 group-hover/alert:opacity-100 transition-opacity" />}
                    {copiedGrowthAlert === `${a.carer}-${a.module}` ? 'REINFORCEMENT LOGGED' : 'Copy Reinforcement'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[380px,1fr] gap-10 items-start">
          
          {/* MASTER PANE: Staff Queue */}
          <div className="bg-hc-card/95 backdrop-blur-3xl border border-hc-border rounded-2xl shadow-2xl flex flex-col overflow-hidden xl:sticky xl:top-6 z-10 h-fit max-h-[calc(100vh-100px)]">
            <div className="p-6 border-b border-hc-border bg-hc-card-hover/20 flex flex-col gap-4 shrink-0">
               <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
                 {snapshot.houses.length > 0 ? [{ name: 'ALL', avgQuality: 100 }, ...snapshot.houses].map((h) => (
                   <button key={h.name} onClick={() => setHouse(h.name)} 
                     className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${house === h.name ? 'bg-hc-teal text-black border-hc-teal' : 'text-hc-muted hover:text-white border-white/5 bg-white/5 hover:bg-white/10'}`}>
                     {h.name === 'all' ? 'NETWORK' : h.name}
                   </button>
                 )) : <div className="px-3 py-1 text-[9px] text-hc-muted">No units</div>}
               </div>
              <div className="relative group">
                <Search className="w-4 h-4 text-hc-muted absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-hc-teal transition-colors" />
                <input type="text" placeholder="QUERY READINESS COMMAND..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                  className="w-full bg-hc-navy/60 border-2 border-white/5 text-hc-text text-sm font-mono font-bold rounded-xl pl-11 pr-4 py-3.5 outline-none focus:border-hc-teal transition-all shadow-inner placeholder:text-zinc-700" />
              </div>
            </div>

            <div className="max-h-[80vh] overflow-y-auto scrollbar-thin p-5 space-y-2 bg-hc-navy/10 flex-1">
               {renderStaffQueue(needsReview, 'CRITICAL REVIEW', 'text-flag-amber', 'border-flag-amber/40', '0 units.')}
               {renderStaffQueue(activeMonitored, 'ACTIVE TRACKING', 'text-hc-teal', 'border-hc-teal/40', '0 units.')}
               {renderStaffQueue(goodStanding, 'OPTIMAL STANDING', 'text-hc-muted', 'border-hc-border', '0 units.')}
            </div>
          </div>

          {/* DETAIL PANE: Command Intelligence */}
          <div ref={detailRef} className="flex-1 flex flex-col gap-10 relative z-20 min-w-0">

            {coachStaff && selectedStaffData ? (
              <div className="bg-hc-card border border-hc-border rounded-3xl flex flex-col relative overflow-hidden shadow-2xl min-h-[800px]">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-hc-teal via-hc-purple to-flag-red" />
                
                {/* Detail Header */}
                <div className="px-8 py-8 border-b border-hc-border flex flex-col md:flex-row md:items-center justify-between gap-6 bg-hc-card-hover/40 sticky top-0 z-10 backdrop-blur-3xl shrink-0">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-2xl border-4 border-white/5 ${selectedStaffData.qualityScore < 65 ? 'bg-flag-amber/20 text-flag-amber' : 'bg-hc-teal/20 text-hc-teal'}`}>
                      {coachStaff.charAt(0)}
                    </div>
                    <div>
                      <div className="text-2xl font-black text-white tracking-tighter uppercase tabular-nums">{coachStaff}</div>
                      <div className="flex items-center gap-4 mt-2">
                         <div className="text-[10px] text-hc-teal-light uppercase font-black tracking-[0.3em]">Operational Readiness Diagnostic</div>
                         <div className="w-1.5 h-1.5 rounded-full bg-hc-border" />
                         <div className="text-[10px] text-hc-muted uppercase font-black tracking-[0.3em]">{selectedStaffData.house || 'Unassigned Unit'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="px-6 py-3 rounded-2xl bg-black/60 border border-hc-border flex flex-col items-center shadow-2xl">
                        <span className="text-[8px] font-black text-hc-muted uppercase opacity-40 mb-1">Impact_Score</span>
                        <span className={`text-xl font-black tabular-nums ${selectedStaffData.qualityScore < 65 ? 'text-flag-amber' : 'text-hc-teal'}`}>{selectedStaffData.qualityScore}%</span>
                     </div>
                     <button onClick={() => { setCoachStaff(null); setCoachEntry(null); setCoachRewrite(''); }} className="w-12 h-12 rounded-2xl border border-hc-border bg-black/20 flex items-center justify-center text-hc-muted hover:bg-flag-red/20 hover:text-flag-red hover:border-flag-red/30 transition-all shadow-xl backdrop-blur-xl group"><X className="w-5 h-5 group-hover:scale-110 transition-transform" /></button>
                  </div>
                </div>

                
                <div className="flex-1 flex flex-col md:flex-row min-h-0">
                   
                   {/* Left: Pipeline & Ledger */}
                   <div className="flex-1 flex flex-col border-r border-hc-border p-8 bg-hc-navy/5">
                        {/* Sequence Tracker */}
                        <div className="mb-12 shrink-0">
                          <div className="text-[11px] font-black text-white/50 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                             <div className="w-6 h-px bg-hc-border" />
                             Stability Pipeline
                          </div>
                          {(() => {
                            const seq = activeSequences.find(s => s.carer === coachStaff && s.status === 'active');
                            if (!seq) {
                              return (
                                <div className="border-2 border-dashed border-hc-border rounded-2xl p-8 bg-hc-card-hover/5 flex flex-col items-center text-center">
                                  <div className="text-[10px] text-hc-muted font-bold mb-6 uppercase tracking-widest opacity-40">No active tracking sequence detected for this personnel unit.</div>
                                  <div className="flex flex-wrap justify-center gap-3">
                                    {STANDARD_SEQUENCES.map(ss => (
                                      <button key={ss.id} onClick={() => handleEnroll(ss.id)} className="px-6 py-3 rounded-xl bg-hc-purple/10 border border-hc-purple/30 text-hc-purple-light text-[10px] font-black uppercase tracking-[0.2em] hover:bg-hc-purple hover:text-white transition-all shadow-lg active:scale-95">
                                        ENROLL: {ss.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            const sequenceData = STANDARD_SEQUENCES.find(ss => ss.id === seq.sequenceId);
                            return (
                              <div className="border-2 border-hc-purple/20 rounded-2xl p-8 bg-hc-purple/[0.03] shadow-inner">
                                <div className="flex items-center justify-between mb-8">
                                  <span className="text-xs font-black text-hc-text uppercase tracking-widest">{sequenceData?.name}</span>
                                  <div className="flex items-center gap-2 px-3 py-1 bg-hc-purple/10 rounded-full border border-hc-purple/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-hc-purple animate-pulse" />
                                    <span className="text-[8px] font-black text-hc-purple-light uppercase tracking-widest">ACTIVE_ENGAGEMENT</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {sequenceData?.steps.map((step, idx) => {
                                    const isDone = idx < seq.currentStepIndex;
                                    const isCurrent = idx === seq.currentStepIndex;
                                    return (
                                      <div key={idx} className={`relative p-4 rounded-xl border-2 transition-all ${isDone ? 'bg-hc-purple/5 border-hc-purple/20 opacity-40' : isCurrent ? 'bg-hc-purple/10 border-hc-purple shadow-xl' : 'bg-black/20 border-white/5 opacity-30'}`}>
                                        <div className={`text-[10px] font-black mb-2 ${isCurrent ? 'text-hc-purple-light' : 'text-hc-muted'}`}>STEP_0{idx + 1}</div>
                                        <div className={`text-[11px] font-black uppercase tracking-tight ${isCurrent ? 'text-white' : 'text-hc-muted'}`}>{step.label}</div>
                                        {isCurrent && <div className="mt-3 h-1 bg-hc-purple/20 rounded-full overflow-hidden"><div className="h-full bg-hc-purple animate-shimmer" style={{ width: '60%' }} /></div>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Diagnostic Ledger */}
                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="text-[11px] font-black text-white/50 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                             <div className="w-6 h-px bg-hc-border" />
                             Diagnostic Ledger
                          </div>
                          <div className="grid grid-cols-1 gap-2 overflow-y-visible">
                            {[...(entriesByStaff[coachStaff!] || [])]
                              .sort((a, b) => scoreEntry(a).total - scoreEntry(b).total)
                              .slice(0, 25)
                              .map((e, i) => {
                                const { icon, colorClass } = entryTypeLabel(e.category, e.type);
                                const score = scoreEntry(e).total;
                                const isSelected = coachEntry?.id === e.id;
                                return (
                                  <div key={i}
                                    onClick={() => { setCoachEntry(e); setCoachRewrite(''); }}
                                    className={`cursor-pointer rounded-xl px-5 py-4 flex items-center gap-6 transition-all border-2 ${isSelected ? 'bg-hc-teal/10 border-hc-teal/40 shadow-2xl ring-2 ring-hc-teal/10' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 shadow-lg'}`}
                                  >
                                    <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl border-2 ${colorClass.split(' ')[2]} ${colorClass.split(' ')[1]} ${colorClass.split(' ')[0]}`}>{icon}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-3 mb-1.5">
                                         <span className="text-xs font-black text-white/90 uppercase tracking-tight tabular-nums">{e.client || 'SYSTEM'}</span>
                                         <span className="text-[9px] font-black text-hc-muted uppercase opacity-50 tabular-nums">{e.date}</span>
                                      </div>
                                      <div className="text-[10px] text-hc-muted truncate opacity-80 font-mono font-medium leading-relaxed italic">"{(e.entry || '').slice(0, 110)}…"</div>
                                    </div>
                                    <div className="flex flex-col items-center shrink-0 ml-4">
                                       <span className="text-xs font-black tabular-nums mb-1" style={{ color: score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444' }}>{score}%</span>
                                       <div className="w-10 h-1 bg-black/40 rounded-full overflow-hidden">
                                          <div className="h-full rounded-full" style={{ width: score + '%', backgroundColor: score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444' }} />
                                       </div>
                                    </div>
                                  </div>
                                );
                              })
                            }
                            {!(entriesByStaff[coachStaff!]?.length) && (
                              <div className="text-center py-24 border-2 border-dashed border-hc-border rounded-2xl bg-white/[0.01]">
                                 <Activity className="w-12 h-12 text-hc-muted mx-auto mb-6 opacity-20" />
                                 <div className="text-[10px] text-hc-muted opacity-40 uppercase font-black tracking-[0.5em]">No Structural Telemetry Available</div>
                              </div>
                            )}
                          </div>
                        </div>
                   </div>

                   {/* Right Side: Command Synthesis */}
                   <div className="w-full md:w-[480px] bg-hc-card-hover/10 border-l border-hc-border p-8 flex flex-col bg-black/20">
                      {coachEntry ? (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-10 duration-500">
                          {/* Integrity Scanner */}
                          <div className="bg-hc-navy/40 border-2 border-flag-amber/20 rounded-2xl p-6 mb-8 shadow-2xl relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldAlert className="w-12 h-12 text-flag-amber" /></div>
                             <div className="text-[11px] font-black text-flag-amber uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                                <Zap className="w-5 h-5 fill-flag-amber" /> Integrity Signals
                             </div>
                             <div className="space-y-4">
                                {scoreEntry(coachEntry).modules.flatMap(m => m.missing).slice(0,6).map((gap, i) => (
                                  <div key={i} className="flex gap-4">
                                     <div className="w-1 h-auto bg-flag-amber/30 rounded-full" />
                                     <div className="text-[11px] font-bold text-white/80 leading-relaxed uppercase tracking-wide">{gap}</div>
                                  </div>
                                ))}
                                {scoreEntry(coachEntry).modules.flatMap(m => m.missing).length === 0 && (
                                   <div className="text-[11px] font-black text-hc-teal uppercase tracking-widest flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4" /> Entry Meets Global Indicators
                                   </div>
                                )}
                             </div>
                          </div>
                          
                          <button onClick={generateGoldStandard} disabled={coachLoading} className="w-full py-5 mb-8 rounded-2xl bg-hc-teal text-black text-[12px] font-black uppercase tracking-[0.4em] shadow-2xl flex items-center justify-center gap-4 hover:bg-teal-400 active:scale-95 transition-all group">
                            {coachLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:scale-125 transition-transform" />} 
                            SYNTHESISE_OUTREACH
                          </button>

                          {coachRewrite && (
                            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-700">
                              <div className="flex flex-col gap-2 mb-6">
                                 <label className="text-[9px] font-black text-hc-teal-light uppercase tracking-[0.3em] mb-1 ml-1">Engagement_Vector</label>
                                 <select value={callVariant} onChange={(e) => setCallVariant(e.target.value as CallPrepVariant)} className="w-full bg-hc-navy border-2 border-white/5 rounded-xl px-5 py-4 text-xs text-white font-black tracking-widest uppercase outline-none cursor-pointer focus:border-hc-teal transition-all shadow-inner hover:bg-white/5">
                                    <option value="message">Direct Outreach (Tactical)</option>
                                    <option value="email">Strategic Email (Gold Standard)</option>
                                    <option value="coaching">Personnel Coaching Script</option>
                                    <option value="urgent">Urgent Operational Notice</option>
                                    <option value="support-first">Wellbeing Readiness Check</option>
                                  </select>
                              </div>

                              <div className="relative flex-1 mb-8 group">
                                <div className="absolute top-4 right-4 z-10"><FileText className="w-5 h-5 text-hc-teal opacity-20 group-hover:opacity-100 transition-opacity" /></div>
                                <textarea readOnly value={script ? script.lines.join('\n') : coachRewrite} className="w-full h-full bg-hc-navy/40 border-2 border-white/5 rounded-2xl p-6 text-[12px] font-mono text-hc-text/90 outline-none scrollbar-thin leading-relaxed shadow-Inner font-medium italic border-hc-teal/10" />
                              </div>
                              
                              <div className="space-y-4 mb-8 shrink-0">
                                <textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} placeholder="Personnel engagement telemetry/notes..." className="w-full bg-hc-navy border-2 border-white/5 rounded-xl p-5 text-[11px] text-hc-text h-28 outline-none shadow-inner focus:border-hc-teal transition-all placeholder:text-zinc-700" />
                                <div className="flex flex-col gap-2">
                                  <label className="text-[9px] font-black text-hc-muted uppercase tracking-[0.3em] mb-1 ml-1">Pipeline_Outcome</label>
                                  <select value={outcomeType} onChange={(e) => setOutcomeType(e.target.value as any)} className="w-full bg-hc-navy border-2 border-white/5 rounded-xl px-5 py-4 text-[10px] font-black text-hc-text uppercase tracking-widest outline-none cursor-pointer focus:border-hc-teal transition-all shadow-inner">
                                    <option value="reached">Resolved via Outreach</option><option value="callback">Follow-up Sequence Queued</option><option value="resolved">Clinical Stability Validated</option>
                                  </select>
                                </div>
                              </div>

                              <button onClick={copyCoachingMessage} className={`w-full py-5 rounded-2xl flex items-center justify-center gap-4 transition-all font-black text-sm uppercase tracking-[0.3em] shadow-2xl active:scale-95 ${coachCopied ? 'bg-flag-green text-white ring-4 ring-flag-green/20' : 'bg-hc-purple text-white hover:bg-hc-purple-light shadow-[0_0_40px_rgba(139,92,246,0.3)]'}`}>
                                {coachCopied ? <CheckCircle className="w-6 h-6 animate-pulse" /> : <Zap className="w-6 h-6 fill-current" />}
                                {coachCopied ? 'STABILITY_LOGGED' : 'INITIATE_DISPATCH'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-center px-12">
                           <div className="w-24 h-24 rounded-3xl bg-hc-card border-2 border-hc-border flex items-center justify-center mb-10 shadow-2xl"><Search className="w-12 h-12 text-hc-muted" /></div>
                           <h3 className="text-sm font-black uppercase tracking-[0.6em] mb-6">Diagnostic_Pending</h3>
                           <p className="text-[11px] leading-loose font-bold uppercase tracking-[0.4em] max-w-[280px]">Select an operational signal from the ledger to activate structural synthesis.</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            ) : (
              <div className="bg-hc-card border-2 border-dashed border-hc-border rounded-3xl flex flex-col items-center justify-center min-h-[700px] opacity-40 p-20 text-center shadow-inner group">
                <div className="w-24 h-24 rounded-3xl bg-hc-navy flex items-center justify-center mb-10 border-2 border-hc-border shadow-2xl group-hover:scale-110 transition-transform">
                  <Activity className="w-12 h-12 text-hc-muted animate-pulse" />
                </div>
                <div className="text-lg font-black text-hc-text uppercase tracking-[0.6em] mb-6">Command Pipeline Stalled</div>
                <p className="text-[11px] text-hc-muted leading-loose max-w-[400px] font-bold uppercase tracking-[0.4em] mx-auto">Choose an operational asset from the Readiness Queue to initiate structural diagnostic analysis and activate the stability vector.</p>
              </div>
            )}
          </div>
        </div>

        {/* GUIDANCE HUB */}
        {exportHints.length > 0 && (
          <div className="mt-16 bg-hc-card border border-hc-border rounded-2xl overflow-hidden shadow-2xl bg-hc-card-hover/10">
             <div className="px-8 py-5 flex items-center gap-4 border-b border-hc-border bg-black/20">
                <Lightbulb className="w-5 h-5 text-hc-teal" />
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-hc-text">Strategic Training Indicators</span>
             </div>
             <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                {exportHints.map((hint, i) => (
                  <div key={i} className="flex flex-col gap-3 group">
                    <div className="text-[10px] font-black text-hc-teal-light uppercase tracking-[0.3em] group-hover:text-white transition-colors">{hint.label}</div>
                    <div className="text-[11px] text-hc-muted font-bold leading-relaxed">{hint.detail}</div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* HISTORICAL LEDGER */}
        <div className="mt-16 bg-hc-card border border-hc-border rounded-2xl overflow-hidden shadow-2xl bg-hc-card-hover/5">
           <div className="px-8 py-6 border-b border-hc-border flex flex-col md:flex-row md:items-center justify-between gap-6 bg-black/30">
              <div className="flex items-center gap-4">
                 <History className="w-5 h-5 text-hc-muted" />
                 <span className="text-[11px] font-black uppercase tracking-[0.4em] text-hc-text">Historical Readiness Ledger</span>
              </div>
              <button onClick={exportMonitoringPack} className="flex items-center gap-3 px-8 py-3 rounded-xl bg-hc-navy border border-white/5 text-hc-text text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/5 hover:border-hc-teal/40 transition-all shadow-xl group"><Download className="w-4 h-4 group-hover:scale-110" /> Export Evidence Pack</button>
           </div>
           <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {loadCallOutcomes().map((o) => (
                <div key={o.id} className="p-5 rounded-2xl bg-hc-navy/40 border border-hc-border flex flex-col gap-4 group/trail hover:bg-hc-navy/60 transition-all shadow-lg hover:shadow-hc-purple/5">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-[12px] text-white tracking-tight uppercase tabular-nums">{o.carer}</span>
                    <span className="text-hc-muted text-[9px] font-mono font-black uppercase opacity-60">{new Date(o.at).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="px-2 py-1 rounded-lg bg-hc-purple/10 text-hc-purple-light border border-hc-purple/30 text-[8px] font-black uppercase tracking-widest mt-0.5 shadow-inner">{o.outcome}</span>
                    <div className="text-[11px] text-hc-muted leading-relaxed italic border-l-2 border-hc-border pl-4 font-medium opacity-80 truncate" title={o.notes}>"{o.notes}"</div>
                  </div>
                </div>
              ))}
              {loadCallOutcomes().length === 0 && <div className="text-[10px] font-black text-hc-muted opacity-40 col-span-full text-center py-20 uppercase tracking-[0.5em]">No Readiness Performance History</div>}
           </div>
        </div>

        {/* Footer padding */}
        <div className="h-20" />
      </div>
    </div>
  );
}
