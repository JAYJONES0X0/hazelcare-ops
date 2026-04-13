import { useMemo, useState, useCallback, useEffect } from 'react';
import { useCollapseStore } from '../lib/collapse-store';
import type { WeekSummary, CareEntry } from '../lib/types';
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
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { buildExportRecommendations } from '../lib/export-recommendations';
import { Sparkles, Download, RefreshCw, ChevronRight, Activity, MessageSquare, History, FileText, CheckCircle, Lightbulb } from 'lucide-react';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
  onDataParsed: (data: WeekSummary) => void;
}

export function StaffMonitoringPage({ weekData, setPage, onDataParsed }: Props) {
  const def = useMemo(() => defaultMondayWindow(), []);

  // ── Inline import ─────────────────────────────────────────────────
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importDragging, setImportDragging] = useState(false);

  const handleImportFile = useCallback(async (file: File) => {
    setImportError('');
    setImportLoading(true);
    try {
      let text = '';
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (ext === 'pdf') {
        const pdfjsLib = await import('pdfjs-dist') as any;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          const items = tc.items as any[];
          const rowMap = new Map<number, { x: number; str: string }[]>();
          for (const it of items) {
            if (!it.str?.trim()) continue;
            const y = Math.round((it.transform?.[5] ?? 0) / 4) * 4;
            if (!rowMap.has(y)) rowMap.set(y, []);
            rowMap.get(y)!.push({ x: it.transform?.[4] ?? 0, str: it.str });
          }
          const sortedRows = [...rowMap.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map(c => c.str.trim()).filter(Boolean).join('\t'));
          text += sortedRows.join('\n') + '\n';
        }
      } else {
        text = await file.text();
      }
      if (!text.trim()) { setImportError('File appears empty.'); return; }

      const envelope = buildEnvelopeFromRaw(file.name, text);
      if (envelope.weekSummary && envelope.weekSummary.totalEntries > 0) {
        if (weekData) {
          const merged: WeekSummary = JSON.parse(JSON.stringify(weekData));
          let newAdded = 0;
          const getHash = (e: CareEntry) => `${e.date}-${e.carer}-${e.client}-${(e.entry || '').slice(0, 40)}`;
          const existingHashes = new Set(flattenWeekEntries(weekData).map(getHash));

          Object.entries(envelope.weekSummary.houses).forEach(([houseName, houseData]) => {
            if (!merged.houses[houseName]) {
              merged.houses[houseName] = houseData;
              newAdded += houseData.entries.length;
            } else {
              houseData.entries.forEach(e => {
                if (!existingHashes.has(getHash(e))) {
                  merged.houses[houseName].entries.push(e);
                  newAdded++;
                }
              });
            }
          });

          if (newAdded > 0) {
            merged.totalEntries = flattenWeekEntries(merged).length;
            onDataParsed(merged);
            setImportError(`Merged ${newAdded} new entries.`);
          } else {
            setImportError('No new unique entries found.');
          }
        } else {
          onDataParsed(envelope.weekSummary);
          setImportError('');
        }
      } else {
        setImportError(`Parsed 0 entries.`);
      }
    } catch (e) {
      setImportError(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setImportLoading(false);
    }
  }, [onDataParsed, weekData]);

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
      const res = await fetch('/api/enhance-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ text: coachEntry.entry, noteType: coachEntry.category || '1:1 Support', clientName: coachEntry.client || '' }),
      });
      if (!res.ok || !res.body) throw new Error('Failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setCoachRewrite(text);
      }
    } catch { setCoachRewrite('Error generating rewrite.'); }
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
      `GOLD STANDARD:`, coachRewrite.trim(), ``, `Please adopt this style going forward.`, ``, `Regards,`, `Management Team`,
    ].join('\n');
    void navigator.clipboard.writeText(msg);
    setCoachCopied(true); setTimeout(() => setCoachCopied(false), 2500);
    saveCallOutcome(selectedEsc || { id: '', carer: coachStaff || 'Unknown', tier: 1, reasons: [], topGaps: [], summary: '', suggestedTool: 'notes', qualityScore: 0, entryCount: 1, shortEntryRatio: 1, avgEntryChars: 10, house: house }, outcomeType, outcomeNotes || 'Messaged via Chat. Pending review.');
  }

  return (
    <div className="p-6 lg:p-10 w-full max-w-[2560px] mx-auto animate-in fade-in duration-500"
      onDragOver={e => { e.preventDefault(); setImportDragging(true); }}
      onDragLeave={() => setImportDragging(false)}
      onDrop={e => { e.preventDefault(); setImportDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleImportFile(f); }}
    >
      {/* Drag overlay */}
      {importDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" style={{background:'rgba(10,12,18,0.95)',backdropFilter:'blur(12px)'}}>
          <div className="rounded-[3rem] p-16 flex flex-col items-center gap-6 glass border-2 border-hc-teal/40 shadow-[0_0_100px_rgba(20,184,166,0.3)]">
            <RefreshCw className="w-20 h-20 text-hc-teal animate-spin-slow" strokeWidth={1} />
            <div className="text-white font-black text-2xl tracking-tighter uppercase">Drop Intelligence Stream</div>
          </div>
        </div>
      )}
      <input type="file" accept=".csv,.txt,.tsv" className="hidden" id="daily-sync-input"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />

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
          <button type="button" onClick={() => document.getElementById('daily-sync-input')?.click()} disabled={importLoading}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl btn-gradient text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${importLoading ? 'animate-spin' : ''}`} />
            {importLoading ? 'Analysing…' : 'Sync daily CSV'}
          </button>
          <button type="button" onClick={() => { onRecompute(); setPage('templates'); }}
            className="px-5 py-2.5 rounded-xl glass-light border border-white/10 text-[10px] font-black uppercase tracking-widest text-hc-muted hover:text-white transition-all">
            Templates
          </button>
        </div>
      </div>

      {importError && (
        <div className={`mb-8 px-6 py-4 rounded-2xl text-xs font-bold uppercase tracking-wide flex items-center gap-3 animate-in slide-in-from-top-4 duration-500 ${importError.includes('Merged') ? 'bg-hc-teal/10 text-hc-teal-light border border-hc-teal/20' : 'bg-flag-red/10 text-flag-red border border-flag-red/20'}`}>
          <div className={`w-2 h-2 rounded-full ${importError.includes('Merged') ? 'bg-hc-teal animate-pulse' : 'bg-flag-red'}`} />
          {importError}
        </div>
      )}

      {/* Header strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Intelligence Window', value: snapshot.windowLabel, color: 'text-hc-teal-light', icon: <Activity className="w-4 h-4" /> },
          { label: 'Scored Entries', value: String(snapshot.dataFreshness.entryCount), color: 'text-white', icon: <FileText className="w-4 h-4" /> },
          { label: 'Clinical Freshness', value: snapshot.dataFreshness.lastEntryDate || '—', color: snapshot.dataFreshness.staleHours != null && snapshot.dataFreshness.staleHours > 24 ? 'text-flag-amber' : 'text-white', icon: <RefreshCw className="w-4 h-4" /> },
          { label: 'Snapshot Time', value: new Date(snapshot.computedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), color: 'text-hc-muted', icon: <History className="w-4 h-4" /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="glass-light border border-white/10 rounded-2xl px-6 py-5 shadow-2xl relative overflow-hidden group/stat transition-all hover:scale-[1.02]">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-hc-teal group-hover/stat:scale-125 transition-transform">{icon}</div>
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 opacity-60">{label}</div>
            <div className={`text-xl font-black ${color} truncate tracking-tighter`}>{value}</div>
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
            className="px-5 py-2.5 rounded-xl bg-flag-amber/20 hover:bg-flag-amber/30 text-flag-amber text-[10px] font-black uppercase tracking-widest">Start Sync</button>
        </div>
      )}

      {/* ── Growth Alerts banner ── */}
      {growthAlerts.length > 0 && (
        <div className="mb-10 glass border border-flag-green/30 rounded-[2rem] p-6 space-y-4 glow-teal-soft">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-flag-green shrink-0 animate-pulse" />
            <span className="text-base font-black text-white tracking-tight uppercase">High-Performance Indicators</span>
            <button type="button" onClick={() => setGrowthAlerts([])} className="ml-auto text-[10px] font-black uppercase tracking-widest text-hc-muted hover:text-white cursor-pointer transition-colors">Dismiss</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {growthAlerts.map((a) => (
              <div key={`${a.carer}-${a.module}`} className="glass-light border border-flag-green/20 rounded-2xl p-4 flex flex-col gap-3 group/alert">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-black text-white mb-0.5">{a.carer}</div>
                    <div className="text-xs text-hc-muted font-medium">
                      <span className="text-flag-green font-bold">{a.module}</span> improved{' '}
                      <span className="font-black text-white">{a.previousScore} → {a.currentScore}</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-flag-green bg-flag-green/10 px-2 py-0.5 rounded-lg">+{a.delta} PTS</div>
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

      {/* ── Export Guidance ─────────────────────────────────────────── */}
      {!allPanelsClosed && exportHints.length > 0 && (
        <div className="mb-8 glass border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <button type="button" onClick={() => togglePanel('export-hints')} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <Lightbulb className="w-4 h-4 text-hc-teal-light" />
              <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase">Operational Intelligence: Next Steps</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-hc-muted transition-transform ${isPanelCollapsed('export-hints') ? '' : 'rotate-90'}`} />
          </button>
          {!isPanelCollapsed('export-hints') && (
            <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
              {exportHints.map((hint, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2">
                  <div className="text-[11px] font-black text-hc-teal-light uppercase tracking-wider">{hint.label}</div>
                  <div className="text-[10px] text-hc-muted leading-relaxed font-medium">{hint.detail}</div>
                  <div className="mt-auto pt-2 text-[9px] font-mono text-white/40">{hint.carePlannerHint}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HIGH DENSITY COMMAND CENTER LAYOUT ── */}
      {weekData && (
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 flex flex-col gap-6">
            <div className="glass border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-0">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-4 rounded-full bg-hc-blue glow-blue" />
                  <span className="text-[11px] font-black tracking-[0.2em] text-white uppercase">Staff Quality Board</span>
                </div>
                <div className="flex gap-2">
                  <span className="pill pill-red text-[9px]">{snapshot.escalations.length} Escalations</span>
                  <span className="pill pill-blue text-[10px]">{snapshot.staff.length} Staff</span>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[500px] scrollbar-thin p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {snapshot.staff.map((s) => {
                  const scoreHex = s.qualityScore >= 70 ? '#22c55e' : s.qualityScore >= 45 ? '#f59e0b' : '#ef4444';
                  const esc = snapshot.escalations.find(e => e.carer === s.carer);
                  const isExpanded = selectedStaffCard === s.carer;
                  return (
                    <div key={s.carer} className={`rounded-xl border transition-all duration-300 ${isExpanded ? 'border-hc-blue/40 bg-hc-blue/5' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                      <div className="p-3 flex items-start justify-between cursor-pointer" onClick={() => setSelectedStaffCard(isExpanded ? null : s.carer)}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-black text-white truncate">{s.carer}</span>
                            {esc && <span className="px-1.5 py-0.5 rounded-md bg-flag-red/20 text-flag-red border border-flag-red/30 text-[8px] font-black uppercase">T{esc.tier}</span>}
                          </div>
                          <div className="text-[9px] text-hc-muted font-bold uppercase tracking-widest flex items-center gap-2">
                            <span>{s.entryCount} N</span> <span className="opacity-50">|</span> <span>{Math.round(s.shortEntryRatio * 100)}% S</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-lg" style={{color: scoreHex, background:`${scoreHex}15`, border:`1px solid ${scoreHex}30`}}>{s.qualityScore}</span>
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-white/5 mt-1 animate-in fade-in">
                           <div className="space-y-1.5 mb-3">
                            {s.moduleBreakdown.map((m) => (
                              <div key={m.name} className="flex items-center justify-between text-[9px] font-bold">
                                <span className="text-white/60">{m.name}</span>
                                <span style={{color: m.score >= 70 ? '#22c55e' : m.score >= 45 ? '#f59e0b' : '#ef4444'}}>{m.score}%</span>
                              </div>
                            ))}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setCoachStaff(s.carer); setCoachEntry(null); setCoachRewrite(''); setSelectedEscId(esc?.id || null); }}
                            className="w-full py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all bg-hc-blue/10 text-hc-blue border border-hc-blue/30 hover:bg-hc-blue/20">Coaching Studio ➔</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="glass border border-white/10 rounded-2xl p-5 shadow-2xl">
              <div className="text-[10px] font-black tracking-[0.2em] text-white uppercase mb-4 flex items-center gap-2"><div className="w-1.5 h-3 bg-hc-teal rounded-full" /> House Overview</div>
              <div className="flex flex-wrap gap-2">
                {snapshot.houses.map((h) => (
                  <button key={h.name} onClick={() => setHouse(h.name === house ? 'all' : h.name)} 
                    className={`px-3 py-2 rounded-xl border text-[10px] font-bold transition-colors ${house === h.name ? 'bg-hc-teal/20 border-hc-teal/50 text-white' : 'bg-white/5 border-white/10 text-hc-muted hover:text-white'}`}>{h.name} {h.avgQuality}%</button>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full xl:w-[450px] flex flex-col gap-6 shrink-0">
            {coachStaff ? (
              <div className="glass border-2 border-hc-purple/30 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden h-full min-h-[600px]">
                <div className="absolute inset-0 bg-hc-purple/5 pointer-events-none" />
                <div className="px-5 py-4 border-b border-hc-purple/20 flex items-center justify-between bg-black/20 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-hc-purple/20 text-hc-purple flex items-center justify-center font-black">{coachStaff.charAt(0)}</div>
                    <div>
                      <div className="text-xs font-black text-white leading-none">{coachStaff}</div>
                      <div className="text-[9px] text-hc-purple uppercase tracking-widest font-bold mt-1">Coaching Studio</div>
                    </div>
                  </div>
                  <button onClick={() => setCoachStaff(null)} className="text-hc-muted hover:text-white"><Activity className="w-4 h-4" /></button>
                </div>
                <div className="p-5 flex-1 flex flex-col relative z-10 overflow-y-auto scrollbar-thin">
                  <select className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] text-white outline-none mb-4"
                    onChange={(e) => { const entry = entriesByStaff[coachStaff]?.find(x => x.entry === e.target.value); if (entry) { setCoachEntry(entry); setCoachRewrite(''); } }} value={coachEntry?.entry || ''}>
                    <option value="">-- Choose entry --</option>
                    {[...(entriesByStaff[coachStaff] || [])].sort((a, b) => scoreEntry(a).total - scoreEntry(b).total).slice(0, 10).map((e, i) => (
                      <option key={i} value={e.entry}>{e.date} ({scoreEntry(e).total}%)</option>
                    ))}
                  </select>
                  {coachEntry && (
                    <div className="animate-in fade-in flex-1 flex flex-col">
                      <div className="bg-flag-amber/5 border border-flag-amber/20 rounded-xl p-3 mb-4">
                         <div className="text-[9px] font-black text-flag-amber uppercase tracking-widest mb-1.5">Gaps</div>
                         {scoreEntry(coachEntry).modules.flatMap(m => m.missing).slice(0,2).map((gap, i) => <div key={i} className="text-[10px]">• {gap}</div>)}
                      </div>
                      <button onClick={generateGoldStandard} disabled={coachLoading} className="w-full py-3 mb-4 rounded-xl btn-gradient text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2">
                        {coachLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Gold Standard
                      </button>
                      {coachRewrite && (
                        <div className="flex-1 flex flex-col animate-in slide-in-from-bottom-4">
                          <div className="flex gap-2 mb-3">
                             <select value={callVariant} onChange={(e) => setCallVariant(e.target.value as CallPrepVariant)} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[9px] text-white">
                                <option value="message">WhatsApp / Chat</option><option value="coaching">Call Script</option>
                              </select>
                          </div>
                          <textarea readOnly value={script ? script.lines.join('\n') : coachRewrite} className="flex-1 w-full bg-black/20 rounded-xl p-3 text-[10px] font-mono text-white/90 outline-none scrollbar-thin mb-3" />
                          <div className="space-y-3 mb-4">
                            <textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} placeholder="Follow-up notes..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] text-white h-16 outline-none" />
                            <select value={outcomeType} onChange={(e) => setOutcomeType(e.target.value as any)} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white">
                              <option value="reached">Messaged</option><option value="callback">Callback</option><option value="resolved">Resolved</option>
                            </select>
                          </div>
                          <button onClick={copyCoachingMessage} className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase shadow-lg ${coachCopied ? 'bg-flag-green text-white' : 'bg-hc-purple text-white'}`}>
                            {coachCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />} {coachCopied ? 'Copied' : 'Copy & Log'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass border border-white/10 rounded-2xl flex flex-col items-center justify-center h-full opacity-50 p-8 text-center">
                <MessageSquare className="w-10 h-10 text-hc-muted mb-4" />
                <div className="text-[11px] font-black text-white uppercase tracking-widest mb-2">Studio</div>
                <div className="text-[10px] text-hc-muted leading-relaxed">Select staff to review.</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-12 glass border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="px-6 py-5 bg-black/20 border-b border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-3">
            <History className="w-4 h-4 text-hc-muted" /><span className="text-[11px] font-black tracking-[0.2em] text-white uppercase">Historical Follow-up Log</span>
          </div>
          <button onClick={exportMonitoringPack} className="flex items-center gap-2 px-5 py-2 rounded-xl glass-light border border-hc-teal/20 text-hc-teal-light text-[10px] font-black uppercase tracking-widest hover:bg-hc-teal/5 transition-all"><Download className="w-3.5 h-3.5" /> Evidence Pack</button>
        </div>
        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto scrollbar-thin">
          {loadCallOutcomes().map((o) => (
            <div key={o.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 group/trail hover:bg-white/[0.04] transition-all">
              <div className="flex justify-between items-center mb-1">
                <span className="font-black text-sm text-white group-hover/trail:text-hc-teal-light transition-colors">{o.carer}</span>
                <span className="text-hc-muted text-[10px] font-bold tabular-nums opacity-40">{new Date(o.at).toLocaleString('en-GB', {day:'2-digit', month:'2-digit', hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="pill pill-purple/20 text-hc-purple border border-hc-purple/30 text-[8px] uppercase tracking-widest">{o.outcome}</span>
                <div className="text-[11px] text-hc-muted truncate italic opacity-80 flex-1">"{o.notes}"</div>
              </div>
            </div>
          ))}
          {loadCallOutcomes().length === 0 && <div className="text-[10px] text-hc-muted opacity-40 col-span-full text-center py-12">No clinical evidence or follow-ups logged yet.</div>}
        </div>
      </div>
    </div>
  );
}
