import { useMemo, useState, useCallback, useEffect } from 'react';
import { Activity, RefreshCw, MessageSquare, History, FileText, CheckCircle, Sparkles, Download, Lightbulb, Zap, Search, X } from 'lucide-react';
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

  const selectedEsc = snapshot.escalations.find((e) => e.id === selectedEscId) || snapshot.escalations[0] || null;

  useEffect(() => {
    if (snapshot.escalations.length && !selectedEscId) {
      setSelectedEscId(snapshot.escalations[0].id);
    }
  }, [snapshot.escalations, selectedEscId]);

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
  
  const selectedStaff = snapshot.staff.find(s => s.carer === coachStaff);

  const renderStaffQueue = (list: typeof searchedStaff, title: string, colorClass: string, borderClass: string, emptyMsg: string) => (
    <div className="mb-6">
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
              <div key={s.carer} onClick={() => setCoachStaff(s.carer)}
                className={`cursor-pointer rounded-xl border transition-all duration-300 overflow-hidden px-4 py-3 group ${isExpanded ? borderClass + ' bg-black/40 shadow-lg' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06]'}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex items-center gap-3 w-full">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 transition-colors ${isExpanded ? borderClass.replace('border-','bg-').replace('/30','') + ' text-black' : 'bg-black/50 text-hc-muted group-hover:text-white'}`}>
                        {s.carer.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black tracking-tight mb-1 truncate">{s.carer}</div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {typeEntries.map(([label, { count, icon, colorClass }]) => (
                            <span key={label} className={`inline-flex items-center gap-0.5 text-[7px] font-black px-1 py-0.5 rounded-[4px] border uppercase tracking-wide whitespace-nowrap ${colorClass}`}>
                              {icon} {count}× {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span style={{ color: scoreHex }} className="text-[10px] font-black">{s.qualityScore}%</span>
                        <div className="w-12 bg-black/40 h-1 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: s.qualityScore + '%', backgroundColor: scoreHex }} />
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
                               <span className="text-[6px] font-black text-hc-purple-light uppercase">Step {seq.currentStepIndex + 1}</span>
                             </div>
                           );
                         })()}
                       </div>
                     </div>
                 </div>
             );
         })}
       </div>
      </div>
    );

  if (!weekData) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-hc-navy flex flex-col items-center justify-center p-8">
        <Activity className="w-12 h-12 text-hc-muted opacity-20 mb-6" />
        <h2 className="text-xl font-black text-hc-text uppercase tracking-widest mb-2">Personnel Intel Readiness</h2>
        <p className="text-hc-muted text-xs uppercase tracking-wider mb-8">Injest daily CSV feed to activate diagnostic command.</p>
        <button onClick={() => setPage('upload')} className="btn-gradient px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl">Begin Field Injest</button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-hc-navy flex flex-col overflow-hidden">
      <div className="p-6 lg:px-10 xl:px-12 flex-1 overflow-y-auto scrollbar-thin">
        {/* SITREP HEADER */}
        <div className="mb-10 flex items-center justify-between shrink-0 border-b border-hc-border pb-6">
          <div>
            <h2 className="text-2xl font-black text-hc-text tracking-tighter uppercase tabular-nums">Personnel Readiness Command</h2>
            <p className="text-hc-muted text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1">Real-time gap detection & stability tracking</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-hc-card border border-hc-border px-5 py-2.5 rounded-lg flex items-center gap-6 shadow-sm">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-hc-muted uppercase opacity-50 mb-0.5">Force Status</span>
                  <span className="text-[10px] font-black text-hc-teal-light uppercase">READY</span>
                </div>
                <div className="w-px h-6 bg-hc-border" />
                <div className="flex flex-col items-center">
                   <span className="text-[8px] font-black text-hc-muted uppercase opacity-50 mb-0.5">Active Gaps</span>
                   <span className="text-[10px] font-black text-flag-amber uppercase">{needsReview.length} UNIT</span>
                </div>
             </div>
             <button onClick={() => { onRecompute(); setPage('templates'); }} className="group/btn relative px-7 py-3 rounded-xl bg-hc-purple/10 border border-hc-purple/30 text-[10px] font-black uppercase tracking-[.2em] text-hc-purple-light hover:text-white hover:bg-hc-purple/20 flex items-center gap-3 transition-all">
               <Sparkles className="w-5 h-5 group-hover/btn:animate-pulse" /> SYNTHESISE FROM INTELLIGENCE
             </button>
             <button onClick={() => setPage('upload')} className="btn-gradient px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl">Sync Daily CSV</button>
          </div>
        </div>

        {hourlyDue && !hourlyDismissed && (
          <div className="mb-8 p-6 rounded-[2rem] bg-flag-amber/10 border border-flag-amber/30 flex items-center justify-between shadow-[0_0_50px_rgba(245,158,11,0.1)] animate-in slide-in-from-top-4 duration-1000 relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-hc-dark/40 backdrop-blur-2xl -z-10" />
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-flag-amber/20 flex items-center justify-center text-2xl border border-flag-amber/40 animate-pulse">⚠️</div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight uppercase">Operational Sync Required</h3>
                <p className="text-[10px] text-flag-amber/80 font-bold uppercase tracking-widest mt-1">Personnel intel is over 60 minutes old. Field readiness data may be stale.</p>
              </div>
            </div>
            <div className="flex gap-4 relative z-10">
              <button onClick={() => setHourlyDismissed(true)} className="px-6 py-3 border border-hc-border text-[9px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-text rounded-xl transition-all">Dismiss</button>
              <button onClick={() => { touchHourlyCheck(); setPage('upload'); }} className="px-8 py-3 bg-flag-amber/20 border border-flag-amber/40 text-flag-amber text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-flag-amber/30 transition-all shadow-xl active:scale-95">Injest Now</button>
            </div>
          </div>
        )}

        {growthAlerts.length > 0 && (
          <div className="mb-10 p-8 rounded-[2.5rem] bg-hc-teal/5 border border-hc-teal/20 shadow-[0_0_60px_rgba(20,184,166,0.1)] animate-in slide-in-from-bottom-6 duration-1000 overflow-hidden relative group shrink-0">
            <div className="absolute top-0 right-0 w-96 h-96 bg-hc-teal/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center justify-between mb-8 relative z-10">
               <div className="flex items-center gap-4">
                  <Sparkles className="w-6 h-6 text-hc-teal animate-pulse" />
                  <h2 className="text-xl font-black text-white tracking-tighter uppercase tabular-nums">High-Performance Vector Indicators</h2>
               </div>
               <button onClick={() => setGrowthAlerts([])} className="text-[10px] font-black uppercase tracking-widest text-hc-muted hover:text-white transition-colors">Clear Signals</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10">
              {growthAlerts.map((a) => (
                <div key={`${a.carer}-${a.module}`} className="bg-hc-card/40 border border-hc-border p-5 rounded-2xl flex flex-col gap-4 group/alert hover:border-hc-teal/40 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-black text-hc-text uppercase tracking-widest mb-1 truncate">{a.carer}</div>
                      <div className="text-[9px] font-bold text-hc-muted uppercase tracking-widest leading-relaxed">
                         <span className="text-hc-teal">{a.module}</span> improved {a.previousScore}% → <span className="text-white">{a.currentScore}%</span>
                      </div>
                    </div>
                    <div className="px-2 py-1 bg-hc-teal/10 border border-hc-teal/30 rounded text-[8px] font-black text-hc-teal tabular-nums">+{a.delta} PTS</div>
                  </div>
                  <button
                    onClick={() => {
                       void navigator.clipboard.writeText(a.message);
                       setCopiedGrowthAlert(`${a.carer}-${a.module}`);
                       setTimeout(() => setCopiedGrowthAlert(null), 2500);
                    }}
                    className="w-full py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider border border-hc-border text-hc-muted hover:border-hc-teal hover:text-hc-teal transition-all flex items-center justify-center gap-2"
                  >
                    {copiedGrowthAlert === `${a.carer}-${a.module}` ? <CheckCircle className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {copiedGrowthAlert === `${a.carer}-${a.module}` ? 'LOGGED' : 'Copy Reinforcement'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[340px,1fr] gap-6 h-[calc(100vh-14rem)] min-h-0">
          
          {/* MASTER PANE: Staff Queue */}
          <div className="bg-hc-card border border-hc-border rounded-xl shadow-xl flex flex-col overflow-hidden min-h-0">
            <div className="p-4 border-b border-hc-border bg-hc-card-hover/40 flex flex-col gap-3 shrink-0">
               <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                 {snapshot.houses.length > 0 ? [{ name: 'ALL', avgQuality: 100 }, ...snapshot.houses].map((h) => (
                   <button key={h.name} onClick={() => setHouse(h.name)} 
                     className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${house === h.name ? 'bg-hc-teal/10 text-hc-teal-light border-hc-teal/30' : 'text-hc-muted hover:text-hc-text border-transparent hover:bg-hc-card'}`}>
                     {h.name === 'all' ? 'NETWORK' : h.name}
                   </button>
                 )) : <div className="px-3 py-1 text-[9px] text-hc-muted">No units</div>}
               </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-hc-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="QUERY READINESS..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                  className="w-full bg-hc-navy/40 border border-hc-border text-hc-text text-[10px] font-mono font-bold rounded-lg pl-9 pr-3 py-2.5 outline-none focus:border-hc-teal transition-colors" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
               {renderStaffQueue(needsReview, 'CRITICAL REVIEW', 'text-flag-amber', 'border-flag-amber/30', '0 units.')}
               {renderStaffQueue(activeMonitored, 'ACTIVE TRACKING', 'text-hc-teal', 'border-hc-teal/30', '0 units.')}
               {renderStaffQueue(goodStanding, 'OPTIMAL STANDING', 'text-hc-muted', 'border-hc-border', '0 units.')}
            </div>
          </div>

          {/* DETAIL PANE: Command Intelligence */}
          <div className="flex flex-col min-h-0">
            {selectedStaff ? (
              <div className="bg-hc-card border border-hc-border rounded-xl flex flex-col relative overflow-hidden h-full shadow-2xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-hc-teal to-hc-purple" />
                
                <div className="px-6 py-5 border-b border-hc-border flex items-center justify-between bg-hc-card-hover/20 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-hc-teal/20 text-hc-teal border border-hc-teal/30 flex items-center justify-center text-lg font-black">{coachStaff!.charAt(0)}</div>
                    <div>
                      <div className="text-sm font-black text-hc-text leading-none tracking-tight uppercase tabular-nums">{coachStaff}</div>
                      <div className="text-[9px] text-hc-teal-light uppercase tracking-[0.2em] font-bold mt-1">Operational Readiness Command</div>
                    </div>
                  </div>
                  <button onClick={() => { setCoachStaff(null); setCoachEntry(null); setCoachRewrite(''); }} className="w-8 h-8 rounded border border-hc-border flex items-center justify-center text-hc-muted hover:text-hc-text transition-colors"><X className="w-4 h-4" /></button>
                </div>
                
                <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-hc-navy/20">
                   
                   <div className="flex-1 flex flex-col border-r border-hc-border overflow-y-auto scrollbar-thin p-6">
                        <div className="mb-8 shrink-0">
                          <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                             <Zap className="w-3.5 h-3.5" /> Stability Pipeline
                          </div>
                          {(() => {
                            const seq = activeSequences.find(s => s.carer === coachStaff && s.status === 'active');
                            if (!seq) {
                              return (
                                <div className="border border-hc-border rounded-lg p-5 bg-hc-card-hover/10">
                                  <div className="text-[10px] text-hc-muted font-bold mb-4 uppercase opacity-60">No active tracking sequence detected.</div>
                                  <div className="flex flex-wrap gap-2">
                                    {STANDARD_SEQUENCES.map(ss => (
                                      <button key={ss.id} onClick={() => handleEnroll(ss.id)} className="px-4 py-2 rounded-lg bg-hc-purple/10 border border-hc-purple/30 text-hc-purple-light text-[9px] font-black uppercase tracking-widest hover:bg-hc-purple/20 transition-all">
                                        ENROLL: {ss.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            const sequenceData = STANDARD_SEQUENCES.find(ss => ss.id === seq.sequenceId);
                            return (
                              <div className="border border-hc-purple/30 rounded-lg p-5 bg-hc-purple/5">
                                <div className="flex items-center justify-between mb-5">
                                  <span className="text-[10px] font-black text-hc-text uppercase tracking-wider">{sequenceData?.name}</span>
                                  <span className="text-[8px] font-black text-hc-purple-light bg-hc-purple/10 px-2 py-1 rounded border border-hc-purple/20">OPERATIONAL TRACKING</span>
                                </div>
                                <div className="space-y-4">
                                  {sequenceData?.steps.map((step, idx) => {
                                    const isDone = idx < seq.currentStepIndex;
                                    const isCurrent = idx === seq.currentStepIndex;
                                    return (
                                      <div key={idx} className={`flex items-center gap-4 ${isDone ? 'opacity-40' : ''}`}>
                                        <div className={`w-6 h-6 rounded border flex items-center justify-center text-[10px] font-black ${isDone ? 'bg-hc-purple text-white border-hc-purple shadow-[0_0_10px_rgba(139,92,246,0.2)]' : isCurrent ? 'bg-hc-purple/20 border-hc-purple text-hc-purple-light' : 'bg-hc-card border-hc-border text-hc-muted'}`}>
                                          {isDone ? '✓' : idx + 1}
                                        </div>
                                        <div className={`text-[11px] font-black uppercase tracking-wide ${isCurrent ? 'text-hc-text' : 'text-hc-muted'}`}>{step.label}</div>
                                        {isCurrent && <span className="ml-auto text-[8px] font-mono font-black text-hc-purple-light animate-pulse uppercase tracking-[0.2em]">ACTIVE SLOT</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                             <FileText className="w-3.5 h-3.5" /> Diagnostic Ledger
                          </div>
                          <div className="space-y-1.5 overflow-y-auto scrollbar-thin pr-2 flex-1">
                            {[...(entriesByStaff[coachStaff!] || [])]
                              .sort((a, b) => scoreEntry(a).total - scoreEntry(b).total)
                              .slice(0, 20)
                              .map((e, i) => {
                                const { label, icon, colorClass } = entryTypeLabel(e.category, e.type);
                                const score = scoreEntry(e).total;
                                const isSelected = coachEntry?.id === e.id;
                                return (
                                  <div key={i}
                                    onClick={() => { setCoachEntry(e); setCoachRewrite(''); }}
                                    className={`cursor-pointer rounded-lg px-4 py-3 flex items-center gap-4 transition-all border ${isSelected ? 'bg-hc-teal/10 border-hc-teal/50 shadow-sm' : 'bg-hc-card-hover/20 border-hc-border hover:bg-hc-card-hover/40'}`}
                                  >
                                    <span className={`shrink-0 text-[8px] font-black px-2 py-1 rounded border uppercase tracking-[0.2em] whitespace-nowrap ${colorClass.replace(/text-[\w-]+ |bg-[\w-]+\/\d+ |border-[\w-]+\/\d+/g, '').trim() + ' border-current opacity-70'}`}>{icon} {label}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[10px] font-black text-hc-text/90 truncate uppercase tabular-nums tracking-tight">{e.client || 'SYSTEM'} &middot; {e.date}</div>
                                      <div className="text-[9px] text-hc-muted truncate opacity-70 font-medium font-mono">{(e.entry || '').slice(0, 90)}…</div>
                                    </div>
                                    <span className="shrink-0 text-[10px] font-black tabular-nums border border-hc-border px-2 py-1 rounded bg-hc-navy/40" style={{ color: score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444' }}>{score}%</span>
                                  </div>
                                );
                              })
                            }
                            {!(entriesByStaff[coachStaff!]?.length) && (
                              <div className="text-center py-16 text-[10px] text-hc-muted opacity-40 uppercase font-black tracking-[0.3em]">No Readiness Data Available</div>
                            )}
                          </div>
                        </div>
                   </div>

                   <div className="w-full md:w-[400px] bg-hc-card-hover/10 border-l border-hc-border p-6 flex flex-col overflow-y-auto scrollbar-thin">
                      {coachEntry ? (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                          <div className="bg-flag-amber/5 border border-flag-amber/20 rounded-xl p-5 mb-6 shadow-Inner">
                             <div className="text-[10px] font-black text-flag-amber uppercase tracking-[0.3em] mb-4 flex items-center gap-2"><Zap className="w-4 h-4" /> Integrity Signals</div>
                             <div className="space-y-3">
                                {scoreEntry(coachEntry).modules.flatMap(m => m.missing).slice(0,4).map((gap, i) => (
                                  <div key={i} className="text-[11px] font-bold text-white/70 leading-relaxed pl-3 border-l grid border-flag-amber/30">{gap}</div>
                                ))}
                             </div>
                          </div>
                          
                          <button onClick={generateGoldStandard} disabled={coachLoading} className="w-full py-4 mb-6 rounded-xl btn-gradient text-[11px] font-black uppercase tracking-[0.3em] shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all">
                            {coachLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Synthesise Readiness Script
                          </button>

                          {coachRewrite && (
                            <div className="flex flex-col animate-in slide-in-from-bottom-2 duration-300">
                              <div className="flex gap-2 mb-4">
                                 <select value={callVariant} onChange={(e) => setCallVariant(e.target.value as CallPrepVariant)} className="flex-1 bg-hc-navy/60 border border-hc-border rounded-lg px-4 py-3 text-[10px] text-white font-black tracking-widest uppercase outline-none cursor-pointer focus:border-hc-teal transition-all shadow-inner">
                                    <option value="message">Direct Message (Tactical)</option>
                                    <option value="email">Email Draft (Strategic)</option>
                                    <option value="coaching">Manager Briefing Script</option>
                                    <option value="urgent">Urgent Command Script</option>
                                    <option value="support-first">Wellness Focus Script</option>
                                  </select>
                              </div>
                              <textarea readOnly value={script ? script.lines.join('\n') : coachRewrite} className="w-full bg-hc-navy/40 border border-hc-border rounded-xl p-5 text-[11px] font-mono text-hc-text/90 outline-none scrollbar-thin mb-5 min-h-[180px] leading-relaxed shadow-inner font-medium italic" />
                              
                              <div className="space-y-3 mb-6">
                                <textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} placeholder="Personnel engagement notes..." className="w-full bg-hc-navy/60 border border-hc-border rounded-xl p-4 text-[11px] text-hc-text h-24 outline-none shadow-inner focus:border-hc-teal transition-all" />
                                <select value={outcomeType} onChange={(e) => setOutcomeType(e.target.value as any)} className="w-full bg-hc-navy/60 border border-hc-border rounded-xl px-4 py-3 text-[10px] font-black text-hc-text uppercase tracking-widest outline-none cursor-pointer focus:border-hc-teal transition-all shadow-inner">
                                  <option value="reached">Resolved via Message</option><option value="callback">Follow-up Queued</option><option value="resolved">Stability Validated</option>
                                </select>
                              </div>

                              <button onClick={copyCoachingMessage} className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl ${coachCopied ? 'bg-flag-green text-white' : 'bg-hc-purple text-white hover:bg-hc-purple-light'}`}>
                                {coachCopied ? <CheckCircle className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                                {coachCopied ? 'LOGGED TO PIPELINE' : 'DISPATCH COMMAND VECTOR'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-40 text-center px-10">
                           <div className="w-16 h-16 rounded-full bg-hc-card border border-hc-border flex items-center justify-center mb-6"><Search className="w-8 h-8 text-hc-muted" /></div>
                           <h3 className="text-xs font-black uppercase tracking-widest mb-3">Diagnostic Ready</h3>
                           <p className="text-[10px] leading-relaxed font-bold uppercase tracking-widest">Select a signal from the ledger to initiate structural synthesis.</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            ) : (
              <div className="bg-hc-card border border-hc-border rounded-xl flex flex-col items-center justify-center h-full opacity-60 p-16 text-center shadow-inner">
                <div className="w-20 h-20 rounded-2xl bg-hc-navy flex items-center justify-center mb-8 border border-hc-border shadow-xl">
                  <Activity className="w-10 h-10 text-hc-muted opacity-40" />
                </div>
                <div className="text-sm font-black text-hc-text uppercase tracking-[0.3em] mb-4">Command Intelligence Pending</div>
                <p className="text-[10px] text-hc-muted leading-relaxed max-w-[300px] font-bold uppercase tracking-widest">Choose an operational asset from the Readiness Queue to initiate structural diagnostic analysis.</p>
              </div>
            )}
          </div>
        </div>

        {/* GUIDANCE HUB */}
        {exportHints.length > 0 && (
          <div className="mt-8 bg-hc-card border border-hc-border rounded-xl overflow-hidden shadow-2xl bg-hc-card-hover/20 shrink-0">
             <div className="px-6 py-4 flex items-center gap-3 border-b border-hc-border">
                <Lightbulb className="w-4 h-4 text-hc-teal" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-hc-text">Strategic Efficiency Indicators</span>
             </div>
             <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {exportHints.map((hint, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="text-[9px] font-black text-hc-teal-light uppercase tracking-widest">{hint.label}</div>
                    <div className="text-[10px] text-hc-muted font-bold leading-relaxed">{hint.detail}</div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* HISTORICAL LEDGER */}
        <div className="mt-8 bg-hc-card border border-hc-border rounded-xl overflow-hidden shadow-2xl shrink-0">
           <div className="px-6 py-4 bg-hc-card-hover/40 border-b border-hc-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <History className="w-4 h-4 text-hc-muted" />
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-hc-text">Historical Readiness Ledger</span>
              </div>
              <button onClick={exportMonitoringPack} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-hc-navy border border-hc-border text-hc-text text-[9px] font-black uppercase tracking-widest hover:bg-hc-card-hover transition-all"><Download className="w-4 h-4" /> Export Evidence Pack</button>
           </div>
           <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 max-h-[300px] overflow-y-auto scrollbar-thin">
              {loadCallOutcomes().map((o) => (
                <div key={o.id} className="p-4 rounded-lg bg-hc-navy/40 border border-hc-border flex flex-col gap-3 group/trail">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-[10px] text-hc-text uppercase tracking-tight">{o.carer}</span>
                    <span className="text-hc-muted text-[8px] font-mono font-bold uppercase">{new Date(o.at).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="px-1.5 py-0.5 rounded bg-hc-purple/10 text-hc-purple-light border border-hc-purple/30 text-[7px] font-black uppercase tracking-widest mt-0.5">{o.outcome}</span>
                    <div className="text-[10px] text-hc-muted leading-relaxed italic border-l border-hc-border pl-3 font-medium">"{o.notes}"</div>
                  </div>
                </div>
              ))}
              {loadCallOutcomes().length === 0 && <div className="text-[10px] font-black text-hc-muted opacity-40 col-span-full text-center py-12 uppercase tracking-[0.2em]">No Readiness Actions Logged</div>}
           </div>
        </div>
      </div>
    </div>
  );
}
