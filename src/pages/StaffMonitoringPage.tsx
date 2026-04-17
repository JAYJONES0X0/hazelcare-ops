import { useMemo, useState, useCallback, useEffect } from 'react';
import { useCollapseStore } from '../lib/collapse-store';
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
  type GrowthAlert,
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
import { Sparkles, Download, RefreshCw, ChevronRight, Activity, MessageSquare, History, FileText, CheckCircle, Lightbulb, UserCheck, Zap } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

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

  // (Import handled centrally via UploadPage)

  const [house, setHouse] = useState<string>('all');
  const [dateFrom] = useState(def.dateFrom);
  const [dateTo] = useState(def.dateTo);
  const [selectedEscId, setSelectedEscId] = useState<string | null>(null);
  const [callVariant, setCallVariant] = useState<CallPrepVariant>('message');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [outcomeType, setOutcomeType] = useState<'reached' | 'voicemail' | 'refused' | 'callback' | 'resolved'>('reached');
  const [hourlyDismissed, setHourlyDismissed] = useState(false);
  const [hourlyTick, setHourlyTick] = useState(0);

  const [selectedStaffCard, setSelectedStaffCard] = useState<string | null>(null);
  const { isCollapsed: isPanelCollapsed, toggle: togglePanel, collapseAll: collapseAllPanels, expandAll: expandAllPanels, allCollapsed: allPanelsCollapsed } = useCollapseStore('staff-monitoring-panels');
  const PANEL_IDS = ['filters', 'export-hints', 'houses', 'staff', 'escalations', 'coaching', 'outcomes'];
  const allPanelsClosed = allPanelsCollapsed(PANEL_IDS);

  const [growthAlerts, setGrowthAlerts] = useState<GrowthAlert[]>([]);
  const [copiedGrowthAlert, setCopiedGrowthAlert] = useState<string | null>(null);

  const [coachStaff, setCoachStaff] = useState<string | null>(null);
  const [coachEntry, setCoachEntry] = useState<CareEntry | null>(null);
  const [coachRewrite, setCoachRewrite] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachCopied, setCoachCopied] = useState(false);

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
    void hourlyTick;
    const last = lastHourlyCheckAt();
    return !last || (Date.now() - last > 3600000);
  }, [hourlyTick]);

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
      // Data Privacy Mandate: MOCK LOCAL AI (Rule 1 Compliant)
      // Generates a structural coaching rewrite entirely locally to prevent PHI network transmission.
      const rubrics = scoreEntry(coachEntry);
      const gaps = rubrics.modules.flatMap(m => m.missing);
      
      let rewrite = '';
      if (gaps.length === 0) {
        rewrite = `Great entry! No major gaps detected.\n\nOriginal Text:\n${coachEntry.entry}`;
      } else {
        rewrite = `[Locally Synthesised Feedback]\n\nBased on Hazel Care Clinical Standards, this entry is missing crucial context. When writing about ${coachEntry.client || 'the client'}, explicitly detail:\n\n` +
          gaps.map((g, i) => `${i + 1}. ${g}`).join('\n') +
          `\n\nExample Professional Structure:\n"I supported ${coachEntry.client || 'the individual'} with ${coachEntry.category || 'their needs'}. I observed [presentation/mood]. I then took [specific action] to ensure they were comfortable and safe. Changes reported to [role]."\n\nPlease review your notes to meet these core components.`;
      }
      
      // Simulate think time 
      await new Promise(r => setTimeout(r, 600));
      setCoachRewrite(rewrite);
    } catch { setCoachRewrite('Error generating rewrite locally.'); }
    finally { setCoachLoading(false); }
  }

  function copyCoachingMessage() {
    if (!coachEntry || !coachRewrite.trim()) return;
    const staffName = coachStaff || 'Team Member';
    const msg = [
      `Subject: Documentation Feedback - Standards of Care`, ``, `Hi ${staffName},`, ``,
      `I've been reviewing your recent care entries. You're doing the work — I'd just like the notes to reflect that more fully. Moving forward, please:`, ``,
      `• Write in first person ("I supported...")`, `• Show your decision-making`, `• Document presentation changes`, ``,
      `Example based on your entry for ${coachEntry.client || 'the client'}:`, ``, `YOUR ENTRY:`, coachEntry.entry, ``,
      `FEEDBACK / STANDARD EXPECTATION:`, coachRewrite.trim(), ``, `Please adopt this style going forward.`, ``, `Regards,`, `Management Team`,
    ].join('\n');
    void navigator.clipboard.writeText(msg);
    setCoachCopied(true); setTimeout(() => setCoachCopied(false), 2500);
    saveCallOutcome(selectedEsc || { id: '', carer: coachStaff || 'Unknown', tier: 1, reasons: [], topGaps: [], summary: '', suggestedTool: 'notes', qualityScore: 0, entryCount: 1, shortEntryRatio: 1, avgEntryChars: 10, house: house }, outcomeType, outcomeNotes || 'Messaged via Chat. Pending review.');
  }

  return (
    <div className="p-6 lg:p-10 xl:px-16 2xl:px-24 w-full animate-in fade-in duration-500"
    >


      {/* ── Page header ── */}
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter text-shimmer flex items-center gap-4">
            Staff Intelligence
            <span className="pill pill-teal text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1">Operational Engine</span>
          </h1>
          <p className="text-hc-muted text-sm font-medium mt-2 max-w-2xl opacity-80 leading-relaxed">
            Clinical analysis of daily diary exports. Every entry is scored to protect {ORG_CONFIG.name} registration.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => allPanelsClosed ? expandAllPanels(PANEL_IDS) : collapseAllPanels(PANEL_IDS)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all glass-light border border-white/5 hover:bg-white/5 text-hc-muted">
            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${allPanelsClosed ? '' : 'rotate-90'}`} />
            {allPanelsClosed ? 'Expand' : 'Collapse'}
          </button>
          
          {/* Rule #4 Compliance: Synthesise Required Quick Action */}
          <button type="button" onClick={() => { onRecompute(); setPage('templates'); }}
            className="px-5 py-2.5 rounded-xl glass-light border border-hc-purple/30 text-[10px] font-black uppercase tracking-[0.2em] text-hc-purple-light hover:text-white hover:bg-hc-purple/10 flex items-center gap-2 transition-all">
            <Sparkles className="w-4 h-4" /> Synthesise from Intelligence
          </button>

          <button type="button" onClick={() => setPage('upload')}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl btn-gradient text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Daily CSV
          </button>
        </div>
      </div>



      {/* Header strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Intelligence Window', value: snapshot.windowLabel, color: 'text-hc-teal-light', icon: <Activity className="w-5 h-5 text-hc-teal opacity-50" /> },
          { label: 'Scored Entries', value: String(snapshot.dataFreshness.entryCount), color: 'text-white', icon: <FileText className="w-5 h-5 text-white opacity-20" /> },
          { label: 'Clinical Freshness', value: snapshot.dataFreshness.lastEntryDate || '—', color: snapshot.dataFreshness.staleHours != null && snapshot.dataFreshness.staleHours > 24 ? 'text-flag-amber' : 'text-white', icon: <RefreshCw className="w-5 h-5 text-white opacity-20" /> },
          { label: 'Snapshot Time', value: new Date(snapshot.computedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), color: 'text-hc-muted', icon: <History className="w-5 h-5 text-hc-muted opacity-50" /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="glass-light border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden group/stat transition-all hover:bg-white/[0.04]">
            <div className="absolute top-4 right-4">{icon}</div>
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 opacity-80">{label}</div>
            <div className={`text-2xl font-black ${color} tracking-tight`}>{value}</div>
          </div>
        ))}
      </div>

      {hourlyDue && !hourlyDismissed && (
        <div className="mb-8 glass border border-flag-amber/30 rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-right-10 duration-700 glow-amber-soft">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-flag-amber/10 flex items-center justify-center shrink-0">⚠️</div>
            <div>
              <div className="text-sm text-white font-black uppercase tracking-wide">Sync Required</div>
              <div className="text-xs text-hc-muted font-medium mt-0.5">Operational data is over 60 minutes old.</div>
            </div>
          </div>
          <button type="button" onClick={() => { touchHourlyCheck(); setHourlyTick((t) => t + 1); setHourlyDismissed(true); setPage('upload'); }}
            className="px-5 py-2.5 rounded-xl bg-flag-amber/20 hover:bg-flag-amber/30 text-flag-amber text-[10px] font-black uppercase tracking-widest transition-colors">Start Sync</button>
        </div>
      )}

      {/* ── Growth Alerts banner ── */}
      {growthAlerts.length > 0 && (
        <div className="mb-10 glass border border-flag-green/30 rounded-3xl p-6 space-y-4 glow-teal-soft shadow-xl">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-flag-green animate-pulse" />
            <span className="text-base font-black text-white tracking-tight uppercase">High-Performance Indicators</span>
            <button type="button" onClick={() => setGrowthAlerts([])} className="ml-auto text-[10px] font-black uppercase tracking-widest text-hc-muted hover:text-white transition-colors">Dismiss</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {growthAlerts.map((a) => (
              <div key={`${a.carer}-${a.module}`} className="glass-light border border-flag-green/20 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-black text-white mb-0.5">{a.carer}</div>
                    <div className="text-xs text-hc-muted font-medium">
                      <span className="text-flag-green font-bold">{a.module}</span> improved{' '}
                      <span className="font-black text-white">{a.previousScore} → {a.currentScore}</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-flag-green bg-flag-green/10 px-2 py-0.5 rounded-lg border border-flag-green/20 shadow-sm shadow-flag-green/10">+{a.delta} PTS</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                     void navigator.clipboard.writeText(a.message);
                     setCopiedGrowthAlert(`${a.carer}-${a.module}`);
                     setTimeout(() => setCopiedGrowthAlert(null), 2500);
                  }}
                  className="w-full mt-auto py-2 rounded-lg text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all glass-light border border-flag-green/30 text-flag-green hover:bg-flag-green/10"
                >
                  {copiedGrowthAlert === `${a.carer}-${a.module}` ? '✓ Copied' : 'Copy reinforcement message'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HIGH DENSITY COMMAND CENTER LAYOUT ── */}
      {weekData && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr,450px] gap-6">
          <div className="flex flex-col gap-6">
            
            {/* Filter Hub */}
            <div className="glass border border-white/10 rounded-2xl px-5 py-4 shadow-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-4 h-4 text-hc-teal" />
                <span className="text-[11px] font-black tracking-[0.2em] text-white uppercase">Clinical Focus Hub</span>
              </div>
              <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden p-1 shadow-inner">
                 {snapshot.houses.length > 0 ? [{ name: 'all', avgQuality: 100 }, ...snapshot.houses].map((h) => (
                  <button key={h.name} onClick={() => setHouse(h.name)} 
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${house === h.name ? 'bg-hc-teal/20 text-hc-teal-light shadow-md' : 'text-hc-muted hover:text-white'}`}>
                    {h.name === 'all' ? 'Network' : `${h.name} ${h.avgQuality}%`}
                  </button>
                )) : <div className="px-4 py-1.5 text-[10px] text-hc-muted truncate">No active houses</div>}
              </div>
            </div>

            {/* Staff Quality Board */}
            <div className="glass border border-white/10 rounded-2xl shadow-2xl flex flex-col min-h-[500px]">
              <div className="flex-1 p-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
                {snapshot.staff.map((s) => {
                  const scoreHex = s.qualityScore >= 70 ? '#22c55e' : s.qualityScore >= 45 ? '#f59e0b' : '#ef4444';
                  const isExpanded = selectedStaffCard === s.carer;
                  
                  // Entry type breakdown for this carer
                  const staffEntries = entriesByStaff[s.carer] || [];
                  const typeCounts: Record<string, { count: number; icon: string; colorClass: string }> = {};
                  staffEntries.forEach(e => {
                    const { label, icon, colorClass } = entryTypeLabel(e.category, e.type);
                    if (!typeCounts[label]) typeCounts[label] = { count: 0, icon, colorClass };
                    typeCounts[label].count++;
                  });
                  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1].count - a[1].count);
                  
                  // Recharts Data Prep
                  const radarData = s.moduleBreakdown.map(m => ({ 
                    subject: m.name, 
                    A: m.score, 
                    fullMark: 100 
                  }));

                  return (
                    <div key={s.carer} className={`rounded-2xl border transition-all duration-500 overflow-hidden ${isExpanded ? 'border-hc-teal text-white shadow-[0_0_30px_rgba(20,184,166,0.15)] bg-hc-navy' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06] shadow-md'}`}>
                      <div className="p-5 flex items-center justify-between cursor-pointer group" onClick={() => setSelectedStaffCard(isExpanded ? null : s.carer)}>
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shrink-0 transition-colors ${isExpanded ? 'bg-hc-teal text-white shadow-lg shadow-hc-teal/20' : 'bg-black/50 text-hc-muted group-hover:text-white'}`}>
                            {s.carer.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xl font-black tracking-tight mb-1.5">{s.carer}</div>
                            {/* Entry type breakdown chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {typeEntries.slice(0, 5).map(([label, { count, icon, colorClass }]) => (
                                <span key={label} className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-wide whitespace-nowrap ${colorClass}`}>
                                  {icon} {count}× {label}
                                </span>
                              ))}
                              {typeEntries.length === 0 && <span className="text-[9px] text-hc-muted opacity-50">No entries loaded</span>}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] uppercase font-bold tracking-widest text-hc-muted mt-2">
                              <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {s.entryCount} Logs</span>
                              <span className="opacity-30">|</span>
                              <span>{Math.round(s.shortEntryRatio * 100)}% Short</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                           {/* Quality Bar Visualiser */}
                           <div className="hidden md:flex flex-col items-end gap-1.5 min-w-[150px]">
                              <div className="flex justify-between w-full text-[9px] font-black uppercase text-hc-muted">
                                <span>Quality Index</span>
                                <span style={{ color: scoreHex }}>{s.qualityScore}%</span>
                              </div>
                              <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div className="h-full rounded-full transition-all duration-1000 ease-in-out" style={{ width: `${s.qualityScore}%`, backgroundColor: scoreHex, boxShadow: `0 0 10px ${scoreHex}` }} />
                              </div>
                           </div>
                           <ChevronRight className={`w-5 h-5 text-hc-muted transition-transform duration-300 ${isExpanded ? 'rotate-90 text-hc-teal' : ''}`} />
                        </div>
                      </div>

                      {/* Expandable Panel w/ Radar Chart */}
                      {isExpanded && (
                        <div className="px-5 pb-5 animate-in slide-in-from-top-4">
                           <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full mb-6" />
                           <div className="grid grid-cols-1 md:grid-cols-[1fr,300px] gap-8">
                             
                             <div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-hc-muted mb-4 flex items-center gap-2"><Zap className="w-3 h-3 text-hc-teal" /> Clinical Module Breakdown</h3>
                                <div className="space-y-3">
                                  {s.moduleBreakdown.map((m) => {
                                    const mColor = m.score >= 70 ? '#22c55e' : m.score >= 45 ? '#f59e0b' : '#ef4444';
                                    return (
                                      <div key={m.name} className="flex flex-col gap-1.5">
                                        <div className="flex justify-between text-[10px] font-black text-white/80">
                                          <span>{m.name}</span>
                                          <span style={{color: mColor}}>{m.score}%</span>
                                        </div>
                                        <div className="w-full bg-black/30 h-1 rounded-full overflow-hidden">
                                          <div className="h-full bg-white/20 transition-all rounded-full" style={{ width: `${m.score}%`, backgroundColor: mColor }} />
                                        </div>
                                        {m.missing.length > 0 && <div className="text-[9px] text-hc-muted font-medium pt-1 truncate">Missing: {m.missing.join(', ')}</div>}
                                      </div>
                                    )
                                  })}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setCoachStaff(s.carer); setCoachEntry(null); setCoachRewrite(''); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                                  className="mt-6 w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-hc-teal/10 text-hc-teal border border-hc-teal/30 hover:bg-hc-teal hover:text-white shadow-[0_4px_14px_rgba(20,184,166,0.2)]">
                                  Open in Coaching Studio ➔
                                </button>
                             </div>

                             {/* Recharts Radar for visual impact */}
                             <div className="bg-black/20 rounded-2xl border border-white/5 flex items-center justify-center p-3 relative h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 700 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar name={s.carer} dataKey="A" stroke="#14b8a6" fill="#0d9488" fillOpacity={0.4} />
                                  </RadarChart>
                                </ResponsiveContainer>
                             </div>

                           </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
          </div>

          <div className="flex flex-col gap-6 w-full lg:sticky top-4 self-start">
            {coachStaff ? (
              <div className="glass border border-hc-teal/40 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(20,184,166,0.1)] flex flex-col relative overflow-hidden h-[800px]">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-hc-teal to-hc-blue" />
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-black/20 relative z-10 backdrop-blur-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-hc-teal/20 text-hc-teal shadow-inner border border-hc-teal/30 flex items-center justify-center text-lg font-black">{coachStaff.charAt(0)}</div>
                    <div>
                      <div className="text-sm font-black text-white leading-none tracking-tight">{coachStaff}</div>
                      <div className="text-[9px] text-hc-teal-light uppercase tracking-[0.2em] font-bold mt-1">Local Coaching Studio</div>
                    </div>
                  </div>
                  <button onClick={() => setCoachStaff(null)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-hc-muted hover:text-white transition-colors cursor-pointer border border-white/5"><Activity className="w-4 h-4" /></button>
                </div>
                <div className="p-6 flex-1 flex flex-col relative z-10 overflow-y-auto scrollbar-thin bg-black/10">
                  <div className="mb-5">
                    <div className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2.5 flex items-center gap-2">
                      <FileText className="w-3 h-3" /> Select Entry to Analyse
                    </div>
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-thin pr-0.5">
                      {[...(entriesByStaff[coachStaff] || [])]
                        .sort((a, b) => scoreEntry(a).total - scoreEntry(b).total)
                        .slice(0, 15)
                        .map((e, i) => {
                          const { label, icon, colorClass } = entryTypeLabel(e.category, e.type);
                          const score = scoreEntry(e).total;
                          const isSelected = coachEntry?.id === e.id;
                          return (
                            <div key={i}
                              onClick={() => { setCoachEntry(e); setCoachRewrite(''); }}
                              className={`cursor-pointer rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all border ${isSelected ? 'bg-hc-teal/10 border-hc-teal/30 shadow-[0_0_10px_rgba(20,184,166,0.1)]' : 'bg-black/30 border-white/5 hover:bg-white/[0.05] hover:border-white/10'}`}
                            >
                              <span className={`shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-wide whitespace-nowrap ${colorClass}`}>{icon} {label}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-white/90 truncate">{e.client || 'General'} &middot; {e.date}</div>
                                <div className="text-[9px] text-hc-muted truncate opacity-70">{(e.entry || '').slice(0, 65)}…</div>
                              </div>
                              <span className="shrink-0 text-[10px] font-black tabular-nums" style={{ color: score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444' }}>{score}%</span>
                            </div>
                          );
                        })
                      }
                      {!(entriesByStaff[coachStaff]?.length) && (
                        <div className="text-center py-6 text-[10px] text-hc-muted opacity-40">No entries available for this staff member</div>
                      )}
                    </div>
                  </div>

                  {coachEntry && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 flex-1 flex flex-col duration-500">
                      <div className="bg-gradient-to-br from-flag-amber/10 to-transparent border border-flag-amber/20 rounded-xl p-4 mb-5 shadow-lg shadow-flag-amber/5">
                         <div className="text-[10px] font-black text-flag-amber uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><Zap className="w-3 h-3" /> Missing Context Vectors</div>
                         {scoreEntry(coachEntry).modules.flatMap(m => m.missing).slice(0,3).map((gap, i) => <div key={i} className="text-[11px] font-medium text-white/80 leading-relaxed max-w-[90%] mb-1">• {gap}</div>)}
                      </div>
                      
                      <button onClick={generateGoldStandard} disabled={coachLoading} className="w-full py-4 mb-5 rounded-xl btn-gradient text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(20,184,166,0.2)] flex items-center justify-center gap-3 disabled:opacity-50 hover:shadow-[0_0_30px_rgba(20,184,166,0.4)]">
                        {coachLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Synthesise Gold Standard
                      </button>

                      {coachRewrite && (
                        <div className="flex-1 flex flex-col animate-in slide-in-from-bottom-4 duration-500">
                          <div className="flex gap-2 mb-3">
                             <select value={callVariant} onChange={(e) => setCallVariant(e.target.value as CallPrepVariant)} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white font-bold tracking-wide outline-none cursor-pointer">
                                <option value="message">WhatsApp Export</option><option value="coaching">Manager Call Script</option>
                              </select>
                          </div>
                          <textarea readOnly value={script && callVariant === 'coaching' ? script.lines.join('\n') : coachRewrite} className="flex-1 w-full bg-black/40 border border-white/5 rounded-xl p-4 text-[11px] font-mono text-white/90 outline-none scrollbar-thin mb-4 leading-relaxed shadow-inner focus:border-hc-teal/50 transition-colors" />
                          <div className="space-y-4 mb-5">
                            <textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} placeholder="Follow-up notes..." className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[11px] text-white h-20 outline-none shadow-inner focus:border-hc-teal/50 transition-colors" />
                            <select value={outcomeType} onChange={(e) => setOutcomeType(e.target.value as any)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none cursor-pointer">
                              <option value="reached">Resolved via Message</option><option value="callback">Callback Scheduled</option><option value="resolved">Coaching Delivered</option>
                            </select>
                          </div>
                          <button onClick={copyCoachingMessage} className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-black text-[11px] uppercase tracking-widest shadow-xl ${coachCopied ? 'bg-flag-green text-white shadow-flag-green/20' : 'bg-hc-purple text-white hover:bg-hc-purple-light shadow-hc-purple/20'}`}>
                            {coachCopied ? <CheckCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />} {coachCopied ? 'Copied to Clipboard' : 'Copy Dispatch & Log'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass border border-white/5 rounded-2xl flex flex-col items-center justify-center h-full opacity-60 p-10 text-center bg-black/20 shadow-inner min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Activity className="w-8 h-8 text-hc-muted" />
                </div>
                <div className="text-sm font-black text-white uppercase tracking-[0.2em] mb-3">Coaching Studio Offline</div>
                <div className="text-[11px] text-hc-muted leading-relaxed max-w-[200px]">Select a staff member from the Quality Board to initiate gap analysis.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Export Guidance Panels ─────────────────────────────────────────── */}
      {!allPanelsClosed && exportHints.length > 0 && (
        <div className="mt-12 glass border border-hc-teal/20 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative">
          <button type="button" onClick={() => togglePanel('export-hints')} className="w-full flex items-center justify-between p-6 hover:bg-hc-teal/5 transition-colors group cursor-pointer bg-black/40">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-hc-teal/10 flex items-center justify-center group-hover:scale-110 transition-transform"><Lightbulb className="w-4 h-4 text-hc-teal-light" /></div>
              <span className="text-[11px] font-black tracking-[0.2em] text-white uppercase group-hover:text-hc-teal-light transition-colors">Operational Intelligence Insights</span>
            </div>
            <ChevronRight className={`w-5 h-5 text-hc-muted transition-transform ${isPanelCollapsed('export-hints') ? '' : 'rotate-90'}`} />
          </button>
          {!isPanelCollapsed('export-hints') && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in bg-black/20 pt-4">
              {exportHints.map((hint, i) => (
                <div key={i} className="p-5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-hc-teal/30 hover:bg-white/[0.05] transition-all flex flex-col gap-3 group/hint">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-hc-teal group-hover/hint:shadow-[0_0_10px_#14b8a6] transition-shadow" />
                    <div className="text-[11px] font-black text-hc-teal-light uppercase tracking-wider">{hint.label}</div>
                  </div>
                  <div className="text-[11px] text-zinc-400 leading-relaxed font-medium">{hint.detail}</div>
                  <div className="mt-auto pt-3 border-t border-white/5 text-[9px] font-mono text-zinc-500 bg-black/20 px-3 py-2 rounded-lg">{hint.carePlannerHint}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Follow-Up Log ─────────────────────────────── */}
      <div className="mt-8 glass border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="px-6 py-5 bg-black/40 border-b border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-hc-muted" /><span className="text-[11px] font-black tracking-[0.2em] text-white uppercase">Historical Follow-up Log</span>
          </div>
          <button onClick={exportMonitoringPack} className="flex items-center gap-2 px-6 py-2.5 rounded-xl glass-light border border-hc-teal/20 text-hc-teal-light text-[10px] font-black uppercase tracking-widest hover:bg-hc-teal/10 hover:border-hc-teal/40 hover:text-white transition-all shadow-lg hover:shadow-hc-teal/20"><Download className="w-4 h-4" /> Export Evidence Pack</button>
        </div>
        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[350px] overflow-y-auto scrollbar-thin bg-black/10">
          {loadCallOutcomes().map((o) => (
            <div key={o.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all flex flex-col gap-3 group/trail">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-hc-purple/50 group-hover/trail:bg-hc-purple transition-colors" />
                   <span className="font-black text-sm text-white">{o.carer}</span>
                </div>
                <span className="text-hc-muted text-[10px] font-bold tabular-nums bg-black/40 px-2 py-0.5 rounded-md border border-white/5">{new Date(o.at).toLocaleString('en-GB', {day:'2-digit', month:'2-digit', hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="pill pill-purple/20 text-hc-purple-light border border-hc-purple/30 text-[9px] uppercase tracking-widest whitespace-nowrap mt-0.5 shadow-sm shadow-hc-purple/10 px-2">{o.outcome}</span>
                <div className="text-[11px] text-zinc-400 leading-relaxed italic border-l border-white/10 pl-3">"{o.notes}"</div>
              </div>
            </div>
          ))}
          {loadCallOutcomes().length === 0 && <div className="text-[11px] font-medium tracking-wide text-hc-muted opacity-40 col-span-full text-center py-16">No clinical evidence or follow-ups logged yet. Initiate actions via the Coaching Studio.</div>}
        </div>
      </div>
    </div>
  );
}
