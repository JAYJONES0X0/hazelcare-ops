import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
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
import { buildExportRecommendations } from '../lib/export-recommendations';
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
import { Sparkles, LayoutGrid, Users, ShieldAlert, Download, RefreshCw, ChevronRight, Activity, MessageSquare, History } from 'lucide-react';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
  generateStaffLink: (toolId: string) => Promise<{ link: string; code: string }>;
  onDataParsed: (data: WeekSummary) => void;
}

export function StaffMonitoringPage({ weekData, setPage, generateStaffLink, onDataParsed }: Props) {
  const def = useMemo(() => defaultMondayWindow(), []);

  // ── Inline import ─────────────────────────────────────────────────
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importDragging, setImportDragging] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

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

      await new Promise<void>(res => setTimeout(res, 10));

      const envelope = buildEnvelopeFromRaw(file.name, text);
      if (envelope.weekSummary && envelope.weekSummary.totalEntries > 0) {
        // INTELLIGENT MERGE: If we have existing data, merge instead of overwrite
        if (weekData) {
          const merged: WeekSummary = JSON.parse(JSON.stringify(weekData));
          let newAdded = 0;
          
          // Helper to create entry fingerprint
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
            // Re-flatten and re-calculate all stats/flags
            const allEntries = flattenWeekEntries(merged);
            merged.totalEntries = allEntries.length;
            onDataParsed(merged);
            setImportError(`Merged ${newAdded} new entries into existing intelligence.`);
          } else {
            setImportError('No new unique entries found in this file.');
          }
        } else {
          onDataParsed(envelope.weekSummary);
          setImportError('');
        }
      } else {
        setImportError(`Parsed 0 entries. Check your file has columns like: Date, Carer/Staff, Client, Entry/Notes.`);
      }
    } catch (e) {
      setImportError(`Could not read file: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setImportLoading(false);
    }
  }, [onDataParsed, weekData]);

  const [house, setHouse] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(def.dateFrom);
  const [dateTo, setDateTo] = useState(def.dateTo);
  const [selectedEscId, setSelectedEscId] = useState<string | null>(null);
  const [callVariant, setCallVariant] = useState<CallPrepVariant>('coaching');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [outcomeType, setOutcomeType] = useState<'reached' | 'voicemail' | 'refused' | 'callback' | 'resolved'>('reached');
  const [hourlyDismissed, setHourlyDismissed] = useState(false);
  const [hourlyTick, setHourlyTick] = useState(0);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);

  // Staff rubric detail panel
  const [selectedStaffCard, setSelectedStaffCard] = useState<string | null>(null);

  // Collapse state for monitoring panels
  const { isCollapsed: isPanelCollapsed, toggle: togglePanel, collapseAll: collapseAllPanels, expandAll: expandAllPanels, allCollapsed: allPanelsCollapsed } = useCollapseStore('staff-monitoring-panels');
  const PANEL_IDS = ['filters', 'export-hints', 'houses', 'staff', 'escalations', 'coaching', 'outcomes'];
  const allPanelsClosed = allPanelsCollapsed(PANEL_IDS);

  // Growth alerts
  const [growthAlerts, setGrowthAlerts] = useState<GrowthAlert[]>([]);
  const [copiedGrowthAlert, setCopiedGrowthAlert] = useState<string | null>(null);

  // Coaching Studio
  const [coachStaff, setCoachStaff] = useState<string | null>(null);
  const [coachEntry, setCoachEntry] = useState<CareEntry | null>(null);
  const [coachRewrite, setCoachRewrite] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachCopied, setCoachCopied] = useState(false);
  const rewriteRef = useRef<HTMLTextAreaElement>(null);

  const filters: MonitoringFilters = useMemo(
    () => ({ house: house as MonitoringFilters['house'], dateFrom, dateTo }),
    [house, dateFrom, dateTo],
  );

  const snapshot = useMemo(() => computeStaffMonitoring(weekData, filters), [weekData, filters]);
  const exportHints = useMemo(() => buildExportRecommendations(snapshot), [snapshot]);

  const houseOptions = useMemo(() => {
    if (!weekData) return ['all'];
    return ['all', ...Object.keys(weekData.houses).sort()];
  }, [weekData]);

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
    if (!last) return true;
    return Date.now() - last > 3600000;
  }, [hourlyTick]);

  const onRecompute = useCallback(() => {
    saveMonitoringRun(`${snapshot.windowLabel} · ${snapshot.dataFreshness.entryCount} entries`, snapshot.escalations.length);
    const alerts = detectGrowthAlerts(snapshot.staff);
    if (alerts.length > 0) setGrowthAlerts(alerts);
    recordCoachingEvents(snapshot.staff.map((s) => ({ carer: s.carer, topGaps: s.topGaps })));
    recordModuleScores(snapshot.staff.map((s) => ({ carer: s.carer, qualityScore: s.qualityScore, moduleBreakdown: s.moduleBreakdown })));

    const ctx: MonitoringTemplateContext = {
      source: 'staff-monitoring',
      at: new Date().toISOString(),
      house: house === 'all' ? undefined : house,
      dateFrom,
      dateTo,
      escalationCount: snapshot.escalations.length,
      avgHouseQuality:
        snapshot.houses.length > 0
          ? Math.round(snapshot.houses.reduce((a, h) => a + h.avgQuality, 0) / snapshot.houses.length)
          : undefined,
    };
    mergeMonitoringIntoTemplateContext(ctx);
  }, [snapshot, house, dateFrom, dateTo]);

  async function copyStaffTool(tool: string) {
    setLinkBusy(tool);
    try {
      const { link, code } = await generateStaffLink(tool);
      await navigator.clipboard.writeText(`${ORG_CONFIG.name} staff access\nLink: ${link}\nSecure Access Code: ${code}`);
    } catch {
      /* ignore */
    } finally {
      setLinkBusy(null);
    }
  }

  const filteredEntries = useMemo(() => {
    if (!weekData) return [];
    return filterEntries(flattenWeekEntries(weekData), filters);
  }, [weekData, filters]);

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
      const carer = entry.carer || 'Unknown';
      if (!map[carer]) map[carer] = [];
      map[carer].push(entry);
    }
    return map;
  }, [filteredEntries]);

  async function generateGoldStandard() {
    if (!coachEntry) return;
    setCoachRewrite('');
    setCoachLoading(true);
    try {
      const res = await fetch('/api/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: coachEntry.entry,
          noteType: coachEntry.type || '1:1 Support',
          clientName: coachEntry.client || '',
        }),
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
    } catch {
      setCoachRewrite('Error generating rewrite. Check your connection and try again.');
    } finally {
      setCoachLoading(false);
    }
  }

  function copyCoachingMessage() {
    if (!coachEntry || !coachRewrite.trim()) return;
    const staffName = coachStaff || 'Team Member';
    const msg = [
      `Subject: Feedback on Documentation – Active Note Taking`,
      ``,
      `Hi ${staffName},`,
      ``,
      `I've been reviewing your recent care entries and wanted to give you some feedback to help us maintain the documentation standard that protects our service and our clients.`,
      ``,
      `You're clearly doing the work — I'd just like the notes to reflect that more fully. Moving forward, please:`,
      ``,
      `• Write in first person: "I supported..." rather than "Staff supported..."`,
      `• Show your decision-making, especially during de-escalation or when a client refuses`,
      `• Document the client's changing presentation throughout the shift`,
      `• Name the techniques you used (e.g., "I gave her space to self-regulate")`,
      ``,
      `Here is an example based on your recent entry for ${coachEntry.client || 'the client'}:`,
      ``,
      `YOUR ENTRY:`,
      coachEntry.entry,
      ``,
      `GOLD STANDARD VERSION:`,
      coachRewrite.trim(),
      ``,
      `Please adopt this style going forward. Any questions, catch me at handover.`,
      ``,
      `Regards,`,
      `Management Team`,
    ].join('\n');
    void navigator.clipboard.writeText(msg);
    setCoachCopied(true);
    setTimeout(() => setCoachCopied(false), 2500);
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
            <div className="text-hc-muted text-xs font-black tracking-widest opacity-60 uppercase">Merging with current operational data</div>
          </div>
        </div>
      )}
      <input ref={importFileRef} type="file" accept=".csv,.txt,.tsv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />

      {/* ── Page header ── */}
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter text-shimmer flex items-center gap-4">
            Staff Intelligence
            <span className="pill pill-teal text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1">Operational Engine</span>
          </h1>
          <p className="text-hc-muted text-sm font-medium mt-2 max-w-2xl opacity-80 leading-relaxed">
            Clinical analysis of daily diary exports. Every entry is scored to protect {ORG_CONFIG.name} registration and drive documentation quality.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => allPanelsClosed ? expandAllPanels(PANEL_IDS) : collapseAllPanels(PANEL_IDS)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all glass-light border border-white/5 hover:bg-white/5 text-hc-muted"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${allPanelsClosed ? '' : 'rotate-90'}`} />
            {allPanelsClosed ? 'Expand all' : 'Collapse all'}
          </button>
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            disabled={importLoading}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl btn-gradient text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${importLoading ? 'animate-spin' : ''}`} />
            {importLoading ? 'Analysing stream…' : 'Sync daily CSV'}
          </button>
          <button
            type="button"
            onClick={() => { onRecompute(); setPage('templates'); }}
            className="px-5 py-2.5 rounded-xl glass-light border border-white/10 text-[10px] font-black uppercase tracking-widest text-hc-muted hover:text-white transition-all shadow-lg"
          >
            Templates
          </button>
        </div>
      </div>

      {/* Import error/status */}
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
          <div key={label} className="glass-light border border-white/10 rounded-2xl px-6 py-5 shadow-2xl relative overflow-hidden group/stat transition-all hover:scale-[1.02] hover:bg-white/5">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-hc-teal group-hover/stat:scale-125 transition-transform group-hover/stat:opacity-20">{icon}</div>
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 opacity-60">{label}</div>
            <div className={`text-xl font-black ${color} truncate tracking-tighter`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Hourly prompt */}
      {hourlyDue && !hourlyDismissed && (
        <div className="mb-8 glass border border-flag-amber/30 rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-right-10 duration-700 glow-amber-soft">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-flag-amber/10 border border-flag-amber/20 flex items-center justify-center shrink-0">
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <div className="text-sm text-white font-black uppercase tracking-wide">Sync Required</div>
              <div className="text-xs text-hc-muted font-medium mt-0.5">Operational data is over 60 minutes old. Sync latest exports from CarePlanner.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { touchHourlyCheck(); setHourlyTick((t) => t + 1); setHourlyDismissed(true); setPage('upload'); }}
              className="px-5 py-2.5 rounded-xl bg-flag-amber/20 hover:bg-flag-amber/30 text-flag-amber text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Start Sync
            </button>
            <button
              type="button"
              onClick={() => { touchHourlyCheck(); setHourlyTick((t) => t + 1); setHourlyDismissed(true); }}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-[10px] text-hc-muted font-black uppercase tracking-widest hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Growth Alerts banner */}
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

      {weekData && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1.4fr] gap-8">
          {/* Houses */}
          <div className="glass border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 left-0 w-32 h-32 bg-hc-teal/5 blur-[60px] pointer-events-none" />
            <button type="button" onClick={() => togglePanel('houses')} className="w-full flex items-center justify-between gap-2 p-6 cursor-pointer hover:bg-white/[0.02] transition-colors relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 rounded-full bg-hc-teal glow-teal" />
                <span className="text-[11px] font-black tracking-[0.25em] text-white uppercase">House Health</span>
                <span className="pill pill-teal text-[10px] px-2.5">{snapshot.houses.length}</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-hc-muted transition-transform duration-300 ${isPanelCollapsed('houses') ? '' : 'rotate-90'}`} />
            </button>
            {!isPanelCollapsed('houses') && <div className="space-y-3 max-h-[520px] overflow-y-auto scrollbar-thin px-6 pb-6 relative z-10">
              {snapshot.houses.map((h) => {
                const isActive = house === h.name;
                const hasEsc = !!h.tierWorst;
                return (
                  <button
                    key={h.name}
                    type="button"
                    onClick={() => setHouse(h.name)}
                    className="w-full text-left rounded-2xl p-4 transition-all duration-300 cursor-pointer group/house"
                    style={{
                      background: isActive ? 'rgba(20,184,166,0.12)' : hasEsc ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                      border: isActive ? '1px solid rgba(20,184,166,0.4)' : hasEsc ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: isActive ? '0 8px 24px rgba(20,184,166,0.1)' : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-base font-black text-white tracking-tight group-hover/house:text-hc-teal-light transition-colors">{h.name}</span>
                      {hasEsc && <span className="pill pill-red text-[9px] font-black tracking-widest animate-pulse-soft">TIER {h.tierWorst}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 text-[11px] text-hc-muted font-bold uppercase tracking-widest">
                      <div className="flex items-center gap-2"><span className="text-white">{h.entryCount}</span> Entries</div>
                      <div className="flex items-center gap-2"><span className="text-white">{h.staffCount}</span> Staff</div>
                      <div className="flex items-center gap-2">
                        Quality: <span className={h.avgQuality >= 70 ? 'text-flag-green' : h.avgQuality >= 45 ? 'text-flag-amber' : 'text-flag-red'}>{h.avgQuality}%</span>
                      </div>
                      <div className="flex gap-2">
                        {h.redFlags > 0 && <span className="text-flag-red">R:{h.redFlags}</span>}
                        {h.amberFlags > 0 && <span className="text-flag-amber">A:{h.amberFlags}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>}
          </div>

          {/* Staff quality */}
          <div className="glass border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 left-0 w-32 h-32 bg-hc-blue/5 blur-[60px] pointer-events-none" />
            <button type="button" onClick={() => togglePanel('staff')} className="w-full flex items-center justify-between gap-2 p-6 cursor-pointer hover:bg-white/[0.02] transition-colors relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 rounded-full bg-hc-blue glow-blue" />
                <span className="text-[11px] font-black tracking-[0.25em] text-white uppercase">Staff Quality</span>
                <span className="pill pill-blue text-[10px] px-2.5">{snapshot.staff.length}</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-hc-muted transition-transform duration-300 ${isPanelCollapsed('staff') ? '' : 'rotate-90'}`} />
            </button>
            {!isPanelCollapsed('staff') && <div className="space-y-3 max-h-[520px] overflow-y-auto scrollbar-thin px-6 pb-6 relative z-10">
              {snapshot.staff.map((s) => {
                const scoreHex = s.qualityScore >= 70 ? '#22c55e' : s.qualityScore >= 45 ? '#f59e0b' : '#ef4444';
                const isExpanded = selectedStaffCard === s.carer;
                return (
                  <div key={s.carer}>
                    <button
                      type="button"
                      onClick={() => setSelectedStaffCard(isExpanded ? null : s.carer)}
                      className="w-full text-left rounded-2xl p-4 cursor-pointer transition-all duration-300 group/staff"
                      style={{
                        background: s.isRepeatTarget ? 'rgba(239,68,68,0.06)' : isExpanded ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
                        border: s.isRepeatTarget ? '1px solid rgba(239,68,68,0.3)' : isExpanded ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="flex justify-between items-center gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base font-black text-white truncate tracking-tight">{s.carer}</span>
                          {s.isRepeatTarget && (
                            <span className="shrink-0 text-[8px] font-black px-2 py-0.5 rounded bg-flag-red/20 text-flag-red border border-flag-red/30 uppercase tracking-widest animate-pulse">
                              Urgent Training
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-black px-3 py-1 rounded-xl" style={{color: scoreHex, background:`${scoreHex}15`, border:`1px solid ${scoreHex}30`}}>
                            {s.qualityScore}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-y-1 text-[10px] text-hc-muted font-bold uppercase tracking-widest">
                        <div>{s.entryCount} Notes</div>
                        <div>{Math.round(s.shortEntryRatio * 100)}% Short</div>
                        <div>Score: {s.qualityScore}%</div>
                        <div className="flex gap-2">
                          {s.redCount > 0 && <span className="text-flag-red">R:{s.redCount}</span>}
                          {s.amberCount > 0 && <span className="text-flag-amber">A:{s.amberCount}</span>}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mx-2 mb-2 rounded-b-2xl p-5 space-y-4 glass-light border border-hc-blue/20 border-top-none -mt-2 animate-in slide-in-from-top-4 duration-300">
                        {/* Module bars */}
                        <div className="space-y-3">
                          <div className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60">Competency Matrix</div>
                          {s.moduleBreakdown.map((m) => {
                            const mc = m.score >= 70 ? '#22c55e' : m.score >= 45 ? '#f59e0b' : '#ef4444';
                            return (
                              <div key={m.name}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold text-white/80">{m.name}</span>
                                  <span className="text-[10px] font-black" style={{color:mc}}>{m.score}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{width:`${m.score}%`,background:mc,boxShadow:`0 0 10px ${mc}40`}} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Top gaps */}
                        {s.topGaps.length > 0 && (
                          <div className="pt-2 border-t border-white/5">
                            <div className="text-[9px] font-black text-flag-amber uppercase tracking-[0.2em] mb-2">Priority Gaps</div>
                            <div className="space-y-1.5">
                              {s.topGaps.slice(0, 3).map((g, i) => (
                                <div key={i} className="flex items-start gap-2 text-[10px] font-medium text-hc-muted leading-relaxed">
                                  <ChevronRight className="w-3 h-3 text-flag-amber shrink-0 mt-0.5" />
                                  {g}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => { setCoachStaff(s.carer); setCoachEntry(null); setCoachRewrite(''); }}
                          className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer bg-hc-blue/10 text-hc-blue border border-hc-blue/30 hover:bg-hc-blue/20"
                        >
                          Coaching Studio
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>}
          </div>

          {/* Escalations */}
          <div className="glass border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative flex flex-col">
            <div className="absolute top-0 left-0 w-32 h-32 bg-flag-red/5 blur-[60px] pointer-events-none" />
            <button type="button" onClick={() => togglePanel('escalations')} className="w-full flex items-center justify-between gap-2 p-6 cursor-pointer hover:bg-white/[0.02] transition-colors relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 rounded-full bg-flag-red glow-red" />
                <span className="text-[11px] font-black tracking-[0.25em] text-white uppercase">Escalations</span>
                <span className="pill pill-red text-[10px] px-2.5">{snapshot.escalations.length}</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-hc-muted transition-transform duration-300 ${isPanelCollapsed('escalations') ? '' : 'rotate-90'}`} />
            </button>
            
            {!isPanelCollapsed('escalations') && (
              <div className="flex-1 flex flex-col min-h-0 relative z-10">
                <div className="px-6 pb-4 space-y-2 overflow-y-auto scrollbar-thin max-h-48 border-b border-white/5">
                  {snapshot.escalations.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelectedEscId(e.id)}
                      className="w-full text-left rounded-2xl p-4 transition-all duration-300 cursor-pointer group/esc"
                      style={{
                        background: selectedEscId === e.id ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
                        border: selectedEscId === e.id ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-black text-white tracking-tight">{e.carer}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${e.tier === 3 ? 'bg-flag-red text-white' : e.tier === 2 ? 'bg-flag-red/20 text-flag-red' : 'bg-flag-amber/20 text-flag-amber'}`}>TIER {e.tier}</span>
                      </div>
                      <div className="text-[11px] text-hc-muted font-bold truncate opacity-80">{e.summary}</div>
                    </button>
                  ))}
                </div>

                {selectedEsc && script && (
                  <div className="p-6 space-y-5 animate-in fade-in duration-500 overflow-y-auto scrollbar-thin">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black text-hc-teal-light uppercase tracking-widest">Personalised Call Script</div>
                      <select
                        value={callVariant}
                        onChange={(e) => setCallVariant(e.target.value as CallPrepVariant)}
                        className="bg-hc-dark border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-hc-teal/50"
                      >
                        <option value="message">WhatsApp / Chat Message</option>
                        <option value="coaching">Supportive Call (Warm)</option>
                        <option value="urgent">Urgent Call (Tier 3)</option>
                        <option value="support-first">Curiosity First Call</option>
                      </select>
                    </div>

                    <div className="glass-light border border-white/5 rounded-2xl p-5 relative group/script">
                      <button 
                        onClick={() => { 
                          void navigator.clipboard.writeText([script.title, '', ...script.lines].join('\n')); 
                          setCopiedGrowthAlert('script');
                          setTimeout(() => setCopiedGrowthAlert(null), 2000);
                        }}
                        className="absolute top-4 right-4 opacity-0 group-hover/script:opacity-100 transition-opacity p-2 rounded-lg bg-hc-teal/20 text-hc-teal-light hover:bg-hc-teal/30"
                      >
                        {copiedGrowthAlert === 'script' ? <CheckCircle className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                      </button>
                      <div className="space-y-3 font-mono text-[11px] text-white/90 leading-relaxed max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                        {script.lines.map((l, i) => <div key={i} className={l.startsWith('You:') || l.startsWith('Subject:') ? 'text-hc-teal-light font-bold' : ''}>{l}</div>)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => void copyStaffTool(selectedEsc.suggestedTool)} className="btn-gradient py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                        Link: {selectedEsc.suggestedTool}
                      </button>
                      <button onClick={() => void copyStaffTool('handover')} className="glass-light border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 text-hc-muted">
                        Link: Handover
                      </button>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-4">
                      <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-60">Log Clinical Outcome</div>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={outcomeType}
                          onChange={(e) => setOutcomeType(e.target.value as any)}
                          className="bg-hc-dark border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white"
                        >
                          <option value="reached">Reached</option>
                          <option value="voicemail">Voicemail</option>
                          <option value="callback">Callback</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <button
                          onClick={() => { saveCallOutcome(selectedEsc, outcomeType, outcomeNotes); setOutcomeNotes(''); }}
                          className="btn-gradient py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl"
                        >
                          Save Record
                        </button>
                      </div>
                      <textarea
                        value={outcomeNotes}
                        onChange={(e) => setOutcomeNotes(e.target.value)}
                        placeholder="Log clinical notes from the call..."
                        className="w-full bg-hc-dark/60 border border-white/10 rounded-xl p-4 text-xs text-white placeholder:text-hc-muted/30 focus:border-hc-teal/50 outline-none"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-6 mt-auto border-t border-white/5 bg-black/20">
              <button
                onClick={exportMonitoringPack}
                className="w-full py-4 rounded-2xl glass border border-hc-teal/20 text-hc-teal-light text-[11px] font-black uppercase tracking-[0.25em] hover:bg-hc-teal/5 transition-all shadow-2xl flex items-center justify-center gap-3 group"
              >
                <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                Audit Evidence Pack
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COACHING STUDIO ─────────────────────────────────────────── */}
      {weekData && (
        <div className="mt-12 animate-in slide-in-from-bottom-8 duration-1000 delay-300">
          <button
            type="button"
            onClick={() => togglePanel('coaching')}
            className="w-full flex items-center gap-4 mb-8 cursor-pointer group"
          >
            <div className="w-2 h-8 rounded-full bg-hc-purple glow-purple" />
            <div className="text-left">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Clinical Coaching Studio</h2>
              <p className="text-[10px] font-bold text-hc-muted uppercase tracking-[0.2em] opacity-50">High-Precision Note Transformation Pipeline</p>
            </div>
            <ChevronRight className={`w-5 h-5 text-hc-muted/40 ml-auto transition-transform duration-300 ${isPanelCollapsed('coaching') ? '' : 'rotate-90'}`} />
          </button>

          {!isPanelCollapsed('coaching') && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Staff & Entry Selector */}
              <div className="glass border border-white/10 rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[600px]">
                <div className="text-[10px] font-black tracking-[0.25em] text-hc-muted uppercase mb-4 opacity-60">Selection Pipeline</div>
                
                {/* Staff List */}
                <div className="space-y-2 mb-6 overflow-y-auto scrollbar-thin flex-shrink-0 max-h-48">
                  {[...snapshot.staff].sort((a, b) => a.qualityScore - b.qualityScore).map(s => {
                    const scoreColor = s.qualityScore >= 70 ? '#22c55e' : s.qualityScore >= 45 ? '#f59e0b' : '#ef4444';
                    const isActive = coachStaff === s.carer;
                    return (
                      <button key={s.carer} onClick={() => { setCoachStaff(s.carer); setCoachEntry(null); setCoachRewrite(''); }}
                        className={`w-full text-left rounded-xl px-4 py-3 transition-all duration-300 border ${isActive ? 'bg-hc-purple/10 border-hc-purple/40 shadow-lg' : 'bg-white/2 border-white/5 hover:bg-white/5'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-white truncate tracking-tight">{s.carer}</span>
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-lg" style={{color: scoreColor, background:`${scoreColor}15`}}>{s.qualityScore}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Entry Picker */}
                {coachStaff && (
                  <div className="flex-1 flex flex-col min-h-0 border-t border-white/5 pt-6 animate-in fade-in duration-500">
                    <div className="text-[10px] font-black tracking-[0.25em] text-hc-teal-light uppercase mb-4">Select Target Entry</div>
                    <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin pr-2">
                      {[...(entriesByStaff[coachStaff] || [])].sort((a, b) => scoreEntry(a).total - scoreEntry(b).total).slice(0, 20).map((e, i) => {
                        const isActive = coachEntry === e;
                        const es = scoreEntry(e).total;
                        const ec = es >= 70 ? '#22c55e' : es >= 45 ? '#f59e0b' : '#ef4444';
                        return (
                          <button key={i} onClick={() => { setCoachEntry(e); setCoachRewrite(''); }}
                            className={`w-full text-left rounded-xl p-4 transition-all duration-300 border ${isActive ? 'bg-hc-teal/10 border-hc-teal/40' : 'bg-white/2 border-white/5 hover:bg-white/5'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black text-white/60 tracking-widest">{e.date} · {e.client}</span>
                              <span className="text-[10px] font-black" style={{color:ec}}>{es}</span>
                            </div>
                            <div className="text-[11px] text-hc-muted leading-relaxed line-clamp-2">{e.entry}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Analysis & Source */}
              <div className="glass border border-white/10 rounded-[2.5rem] p-8 shadow-2xl flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-hc-purple/5 blur-[60px] pointer-events-none" />
                <div className="text-[10px] font-black tracking-[0.25em] text-hc-muted uppercase mb-6 opacity-60">Source Analysis</div>
                
                {coachEntry ? (
                  <div className="flex-1 flex flex-col min-h-0 animate-in zoom-in-95 duration-500">
                    <div className="glass-light border border-white/5 rounded-2xl p-6 mb-6 flex-1 overflow-y-auto scrollbar-thin shadow-inner">
                      <div className="text-sm text-white/90 leading-relaxed font-medium italic">"{coachEntry.entry}"</div>
                    </div>
                    
                    {/* Rubric Gaps */}
                    <div className="space-y-2 mb-8">
                      {(() => {
                        const es = scoreEntry(coachEntry);
                        return es.modules.flatMap(m => m.missing).slice(0, 3).map((gap, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-flag-amber/5 border border-flag-amber/20">
                            <ShieldAlert className="w-4 h-4 text-flag-amber shrink-0" />
                            <span className="text-[10px] font-bold text-flag-amber uppercase tracking-widest">{gap}</span>
                          </div>
                        ));
                      })()}
                    </div>

                    <button onClick={generateGoldStandard} disabled={coachLoading}
                      className="w-full py-4 rounded-2xl btn-gradient text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3">
                      {coachLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Generate Gold Standard
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                    <LayoutGrid className="w-12 h-12 mb-4 text-hc-muted" />
                    <div className="text-[10px] font-black uppercase tracking-[0.3em]">Awaiting Selection</div>
                  </div>
                )}
              </div>

              {/* Gold Output */}
              <div className="glass border-2 border-hc-purple/30 rounded-[3rem] p-8 shadow-2xl flex flex-col relative overflow-hidden glow-purple-soft">
                <div className="absolute inset-0 bg-hc-purple/5 pointer-events-none" />
                <div className="text-[10px] font-black tracking-[0.25em] text-hc-purple uppercase mb-6 relative z-10">Output: Gold Standard Rewrite</div>
                
                <div className="flex-1 flex flex-col relative z-10">
                  <textarea
                    ref={rewriteRef}
                    value={coachRewrite}
                    onChange={e => setCoachRewrite(e.target.value)}
                    placeholder={coachLoading ? "Clinical Brain is rewriting entry..." : "First-person clinical rewrite will appear here."}
                    className="flex-1 w-full bg-transparent text-[13px] leading-relaxed text-white font-medium resize-none outline-none scrollbar-thin"
                  />
                  
                  <div className="pt-8 mt-auto">
                    <button onClick={copyCoachingMessage} disabled={!coachRewrite.trim() || coachLoading}
                      className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-500 font-black text-[11px] uppercase tracking-[0.25em] shadow-2xl ${coachCopied ? 'bg-flag-green text-white scale-95' : 'bg-hc-purple text-white hover:bg-hc-purple-light'}`}>
                      {coachCopied ? <CheckCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                      {coachCopied ? 'Dispatch Copied' : 'Copy Coaching Dispatch'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent outcomes */}
      <div className="mt-12 glass border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative">
        <button type="button" onClick={() => togglePanel('outcomes')} className="w-full flex items-center justify-between gap-2 p-6 cursor-pointer hover:bg-white/[0.02] transition-colors relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-hc-muted/40" />
            <span className="text-[11px] font-black tracking-[0.25em] text-white uppercase">Historical Audit Trail</span>
            <span className="pill glass-light text-[10px] px-2.5 text-hc-muted">{loadCallOutcomes().length} Events</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-hc-muted transition-transform duration-300 ${isPanelCollapsed('outcomes') ? '' : 'rotate-90'}`} />
        </button>
        {!isPanelCollapsed('outcomes') && <div className="px-8 pb-8 space-y-3 relative z-10">
          {loadCallOutcomes().slice(0, 10).map((o) => (
            <div key={o.id} className="flex items-center gap-4 text-[11px] font-bold text-hc-muted border-b border-white/5 pb-2 last:border-0">
              <span className="tabular-nums opacity-40">{new Date(o.at).toLocaleDateString('en-GB')}</span>
              <span className="w-32 truncate text-white">{o.carer}</span>
              <span className="pill text-[9px] uppercase tracking-widest bg-white/5 border border-white/10">{o.outcome}</span>
              <span className="flex-1 truncate opacity-60 font-medium italic">{o.notes}</span>
            </div>
          ))}
          {loadCallOutcomes().length === 0 && <div className="text-[10px] text-hc-muted opacity-40 text-center py-4">No logged outcomes in clinical history.</div>}
        </div>}
      </div>
    </div>
  );
}
