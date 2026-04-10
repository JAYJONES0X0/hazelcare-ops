import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useCollapseStore } from '../lib/collapse-store';
import type { WeekSummary, CareEntry } from '../lib/types';
import type { Page } from '../App';
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
      // No size limit — CarePlanner exports can be very large (10MB+)
      let text = '';
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (ext === 'pdf') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjsLib = await import('pdfjs-dist') as any;
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          // Reconstruct table structure by grouping items by Y coordinate (row),
          // then sorting each row by X coordinate (column order).
          // This preserves the tabular layout CarePlanner PDFs use.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items = tc.items as any[];
          const rowMap = new Map<number, { x: number; str: string }[]>();
          for (const it of items) {
            if (!it.str?.trim()) continue;
            // transform[5] = Y position, transform[4] = X position
            const y = Math.round((it.transform?.[5] ?? 0) / 4) * 4; // bucket to 4pt rows
            if (!rowMap.has(y)) rowMap.set(y, []);
            rowMap.get(y)!.push({ x: it.transform?.[4] ?? 0, str: it.str });
          }
          // Sort rows top→bottom (descending Y in PDF coords), cells left→right
          const sortedRows = [...rowMap.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map(c => c.str.trim()).filter(Boolean).join('\t'));
          text += sortedRows.join('\n') + '\n';
        }
      } else {
        text = await file.text();
      }
      if (!text.trim()) { setImportError('File appears empty.'); return; }

      // Yield to browser before heavy synchronous parse (prevents freeze on large files)
      await new Promise<void>(res => setTimeout(res, 10));

      const envelope = buildEnvelopeFromRaw(file.name, text);
      if (envelope.weekSummary && envelope.weekSummary.totalEntries > 0) {
        onDataParsed(envelope.weekSummary);
        setImportError('');
      } else {
        setImportError(`Parsed 0 entries. Check your file has columns like: Date, Carer/Staff, Client, Entry/Notes. Got: ${envelope.warnings.slice(0, 2).join('; ') || 'no recognisable columns'}`);
      }
    } catch (e) {
      setImportError(`Could not read file: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setImportLoading(false);
    }
  }, [onDataParsed]);

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

    // Detect growth alerts BEFORE recording new scores (compare vs prior history)
    const alerts = detectGrowthAlerts(snapshot.staff);
    if (alerts.length > 0) setGrowthAlerts(alerts);

    // Now record this run's scores and gaps
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
      await navigator.clipboard.writeText(`Hazel Care staff access\nLink: ${link}\nSecure Access Code: ${code}`);
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
    downloadText(`hazelcare-evidence-${day}.csv`, careEntriesToEvidenceCsv(filteredEntries), 'text/csv;charset=utf-8');
    downloadText(`hazelcare-evidence-readme-${day}.txt`, buildCoordinatorReadme(meta), 'text/plain;charset=utf-8');
    downloadText(`hazelcare-evidence-${day}.html`, buildCoordinatorEvidenceHtml(filteredEntries, meta), 'text/html;charset=utf-8');
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
      `Abraham`,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" style={{background:'rgba(10,12,18,0.9)',backdropFilter:'blur(8px)'}}>
          <div className="rounded-[2rem] p-12 flex flex-col items-center gap-4" style={{border:'2px dashed rgba(20,184,166,0.6)',boxShadow:'0 0 60px rgba(20,184,166,0.2)'}}>
            <svg className="w-16 h-16 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <div className="text-white font-black text-xl">Drop diary CSV here</div>
            <div className="text-hc-muted text-xs opacity-60">Release to import and analyse</div>
          </div>
        </div>
      )}
      <input ref={importFileRef} type="file" accept=".csv,.txt,.tsv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />

      {/* ── Page header ── */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter text-shimmer">Staff Intelligence</h1>
          <p className="text-hc-muted text-sm font-medium mt-1">
            Drop your diary CSV here — scores every entry, flags weak notes, generates call scripts and coaching rewrites.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => allPanelsClosed ? expandAllPanels(PANEL_IDS) : collapseAllPanels(PANEL_IDS)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
            style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'#64748b'}}
          >
            <svg className="w-3 h-3 transition-transform duration-200" style={{transform: allPanelsClosed ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            {allPanelsClosed ? 'Expand all' : 'Collapse all'}
          </button>
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            disabled={importLoading}
            className="px-4 py-2.5 rounded-xl btn-gradient text-[10px] font-black uppercase tracking-wide cursor-pointer"
          >
            {importLoading ? 'Parsing entries…' : weekData ? 'Import new CSV' : 'Import diary CSV'}
          </button>
          <button
            type="button"
            onClick={async () => {
              setImportError('');
              setImportLoading(true);
              try {
                const res = await fetch('/demo-diary.csv');
                const text = await res.text();
                const envelope = buildEnvelopeFromRaw('demo-diary.csv', text);
                if (envelope.weekSummary && envelope.weekSummary.totalEntries > 0) {
                  onDataParsed(envelope.weekSummary);
                } else {
                  setImportError('Demo load failed — check console');
                }
              } catch (e) {
                setImportError(`Demo error: ${e instanceof Error ? e.message : 'Unknown'}`);
              } finally {
                setImportLoading(false);
              }
            }}
            disabled={importLoading}
            className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide cursor-pointer transition-colors"
            style={{background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.3)',color:'#a78bfa'}}
          >
            Load demo data
          </button>
          <button
            type="button"
            onClick={() => {
              onRecompute();
              setPage('templates');
            }}
            className="px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-wide text-hc-muted hover:text-white transition-colors"
            style={{background:'rgba(255,255,255,0.03)'}}
          >
            Templates
          </button>
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs text-flag-red font-semibold" style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)'}}>
          {importError}
        </div>
      )}

      {/* Header strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Window', value: snapshot.windowLabel, color: 'text-hc-teal-light' },
          { label: 'Entries', value: String(snapshot.dataFreshness.entryCount), color: 'text-white' },
          { label: 'Last entry', value: snapshot.dataFreshness.lastEntryDate || '—', color: snapshot.dataFreshness.staleHours != null && snapshot.dataFreshness.staleHours > 24 ? 'text-flag-amber' : 'text-white' },
          { label: 'Computed', value: new Date(snapshot.computedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), color: 'text-hc-muted' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl px-4 py-3" style={{background:'linear-gradient(145deg,rgba(12,16,24,0.30),rgba(8,11,18,0.24))',backdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',WebkitBackdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',border:'1px solid rgba(255,255,255,0.10)',boxShadow:'0 8px 40px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 0 0 0.5px rgba(255,255,255,0.05)'}}>
            <div className="text-[10px] font-bold text-hc-muted uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-sm font-bold ${color} truncate`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Hourly prompt */}
      {hourlyDue && !hourlyDismissed && (
        <div className="mb-6 border border-flag-amber/40 bg-flag-amber/10 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-white font-semibold">Has anything changed in the last hour?</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                touchHourlyCheck();
                setHourlyTick((t) => t + 1);
                setHourlyDismissed(true);
                setPage('upload');
              }}
              className="px-3 py-1.5 rounded-lg bg-flag-amber/20 text-flag-amber text-[10px] font-black uppercase"
            >
              Import update
            </button>
            <button
              type="button"
              onClick={() => {
                touchHourlyCheck();
                setHourlyTick((t) => t + 1);
                setHourlyDismissed(true);
              }}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-hc-muted uppercase"
            >
              Nothing new
            </button>
          </div>
        </div>
      )}

      {/* Growth Alerts banner */}
      {growthAlerts.length > 0 && (
        <div className="mb-6 rounded-2xl p-4 space-y-3" style={{background:'rgba(34,197,94,0.05)',border:'1px solid rgba(34,197,94,0.25)'}}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-flag-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            <span className="text-sm font-black text-flag-green">Growth Detected — Send Positive Reinforcement</span>
            <button type="button" onClick={() => setGrowthAlerts([])} className="ml-auto text-[10px] text-hc-muted hover:text-white cursor-pointer">Dismiss</button>
          </div>
          <div className="space-y-2">
            {growthAlerts.map((a) => (
              <div key={`${a.carer}-${a.module}`} className="rounded-xl p-3 flex items-start justify-between gap-3" style={{background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.15)'}}>
                <div>
                  <div className="text-sm font-bold text-white mb-0.5">{a.carer}</div>
                  <div className="text-xs text-hc-muted">
                    <span className="text-flag-green font-semibold">{a.module}</span> improved{' '}
                    <span className="font-black text-white">{a.previousScore} → {a.currentScore}</span>
                    {' '}(+{a.delta} pts vs last {Math.min(5, 1)} sessions)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(a.message);
                    setCopiedGrowthAlert(`${a.carer}-${a.module}`);
                    setTimeout(() => setCopiedGrowthAlert(null), 2500);
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer transition-colors"
                  style={{
                    background: copiedGrowthAlert === `${a.carer}-${a.module}` ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.35)',
                    color: '#22c55e',
                  }}
                >
                  {copiedGrowthAlert === `${a.carer}-${a.module}` ? '✓ Copied' : 'Copy message'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{background:'linear-gradient(145deg,rgba(12,16,24,0.30),rgba(8,11,18,0.24))',backdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',WebkitBackdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',border:'1px solid rgba(255,255,255,0.10)',boxShadow:'0 8px 40px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 0 0 0.5px rgba(255,255,255,0.05)'}}>
      <button type="button" onClick={() => togglePanel('filters')} className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors" style={{borderBottom: isPanelCollapsed('filters') ? 'none' : '1px solid rgba(255,255,255,0.05)'}}>
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-hc-muted/40" />
          <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase">Filters</span>
          <span className="text-[9px] text-hc-muted opacity-40">{house !== 'all' ? house : 'All houses'} · {dateFrom}→{dateTo}</span>
        </div>
        <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isPanelCollapsed('filters') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {!isPanelCollapsed('filters') && <div className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1.5 min-w-[180px] flex-1">
            <span className="text-xs font-semibold text-hc-muted uppercase tracking-wide">House</span>
            <select
              value={house}
              onChange={(e) => setHouse(e.target.value)}
              className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-hc-teal/50"
            >
              {houseOptions.map((h) => (
                <option key={h} value={h}>
                  {h === 'all' ? 'All houses' : h}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 min-w-[150px]">
            <span className="text-xs font-semibold text-hc-muted uppercase tracking-wide">From</span>
            <input
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-hc-teal/50"
            />
          </label>
          <label className="flex flex-col gap-1.5 min-w-[150px]">
            <span className="text-xs font-semibold text-hc-muted uppercase tracking-wide">Until</span>
            <input
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-hc-teal/50"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const d = defaultMondayWindow();
              setDateFrom(d.dateFrom);
              setDateTo(d.dateTo);
            }}
            className="px-4 py-2.5 rounded-xl border border-hc-teal/40 text-hc-teal-light text-xs font-semibold uppercase tracking-wide hover:bg-hc-teal/10 transition-colors"
          >
            Reset to this week
          </button>
        </div>
      </div>}
      </div>

      {/* Export recommendations */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{background:'linear-gradient(145deg,rgba(12,16,24,0.30),rgba(8,11,18,0.24))',backdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',WebkitBackdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',border:'1px solid rgba(255,255,255,0.10)',boxShadow:'0 8px 40px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 0 0 0.5px rgba(255,255,255,0.05)'}}>
        <button type="button" onClick={() => togglePanel('export-hints')} className="w-full flex items-center justify-between gap-2 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors" style={{borderBottom: isPanelCollapsed('export-hints') ? 'none' : '1px solid rgba(255,255,255,0.05)'}}>
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-hc-teal/60" />
            <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase">What to export next from CarePlanner</span>
          </div>
          <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isPanelCollapsed('export-hints') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {!isPanelCollapsed('export-hints') && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
          {exportHints.map((h) => (
            <div key={h.id} className="bg-black/20 border border-white/5 rounded-xl p-3">
              <div className="text-xs font-bold text-hc-teal-light mb-1">{h.label}</div>
              <div className="text-xs text-hc-muted leading-relaxed">{h.detail}</div>
              <div className="text-xs text-hc-muted/50 mt-1.5 italic">{h.carePlannerHint}</div>
            </div>
          ))}
        </div>}
      </div>

      {!weekData && !importLoading && (
        <div
          onClick={() => importFileRef.current?.click()}
          className="cursor-pointer flex flex-col items-center justify-center py-20 text-center rounded-[2rem] animate-in zoom-in duration-700 relative overflow-hidden transition-all duration-300"
          style={{
            background: importDragging ? 'rgba(20,184,166,0.06)' : 'linear-gradient(145deg,rgba(12,16,24,0.30),rgba(8,11,18,0.24))',
            border: importDragging ? '2px dashed rgba(20,184,166,0.5)' : '2px dashed rgba(255,255,255,0.08)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div className="relative z-10 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 mx-auto" style={{background:'rgba(20,184,166,0.08)',border:'1px solid rgba(20,184,166,0.2)'}}>
              <svg className="w-10 h-10 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
            <div className="text-[10px] font-black tracking-[0.25em] text-hc-teal uppercase mb-3">Staff Intelligence</div>
            <div className="text-2xl font-black text-white mb-3 tracking-tighter">Drop your diary CSV here</div>
            <div className="text-sm text-hc-muted mb-2 leading-relaxed max-w-sm">
              Export the weekly diary from CarePlanner, drop the CSV file here — or click to browse.
            </div>
            <div className="text-xs text-hc-muted opacity-40 mb-8">Accepts .csv · .txt · .tsv</div>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-hc-teal-light" style={{background:'rgba(20,184,166,0.08)',border:'1px solid rgba(20,184,166,0.25)'}}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Click to browse or drag &amp; drop
            </div>
          </div>
        </div>
      )}

      {!weekData && importLoading && (
        <div className="flex items-center justify-center py-20 rounded-[2rem]" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-hc-teal/30 border-t-hc-teal animate-spin" />
            <div className="text-sm font-black text-white">Reading and scoring entries…</div>
          </div>
        </div>
      )}

      {weekData && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1.4fr] gap-6">
          {/* Houses */}
          <div className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(145deg,rgba(12,16,24,0.30),rgba(8,11,18,0.24))',backdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',WebkitBackdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',border:'1px solid rgba(255,255,255,0.10)',boxShadow:'0 8px 40px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 0 0 0.5px rgba(255,255,255,0.05)'}}>
            <button type="button" onClick={() => togglePanel('houses')} className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-hc-teal" style={{boxShadow:'0 0 8px rgba(20,184,166,0.6)'}} />
                <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase">House Health</span>
                <span className="text-[9px] text-hc-muted opacity-40">{snapshot.houses.length}</span>
              </div>
              <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isPanelCollapsed('houses') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {!isPanelCollapsed('houses') && <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin px-4 pb-4">
              {snapshot.houses.map((h) => {
                const isActive = house === h.name;
                const hasEsc = !!h.tierWorst;
                return (
                  <button
                    key={h.name}
                    type="button"
                    onClick={() => setHouse(h.name)}
                    className="w-full text-left rounded-xl p-3.5 transition-all duration-200 cursor-pointer"
                    style={{
                      background: isActive ? 'rgba(20,184,166,0.1)' : hasEsc ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.025)',
                      border: isActive ? '1px solid rgba(20,184,166,0.45)' : hasEsc ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.07)',
                      boxShadow: isActive ? '0 0 16px rgba(20,184,166,0.1)' : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-bold text-white">{h.name}</span>
                      {hasEsc && <span className="pill pill-amber text-[10px]">T{h.tierWorst}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-hc-muted">
                      <span>{h.entryCount} entries</span>
                      <span>·</span>
                      <span>{h.staffCount} staff</span>
                      <span>·</span>
                      <span className={h.avgQuality >= 70 ? 'text-flag-green' : h.avgQuality >= 45 ? 'text-flag-amber' : 'text-flag-red'}>Q:{h.avgQuality}</span>
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      {h.redFlags > 0 && <span className="text-xs text-flag-red font-semibold">{h.redFlags} red</span>}
                      {h.amberFlags > 0 && <span className="text-xs text-flag-amber font-semibold">{h.amberFlags} amber</span>}
                    </div>
                  </button>
                );
              })}
              {snapshot.houses.length === 0 && <div className="text-xs text-hc-muted opacity-40 text-center py-6">No house data for this filter</div>}
            </div>}
          </div>

          {/* Staff leaderboard */}
          <div className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(145deg,rgba(12,16,24,0.30),rgba(8,11,18,0.24))',backdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',WebkitBackdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',border:'1px solid rgba(255,255,255,0.10)',boxShadow:'0 8px 40px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 0 0 0.5px rgba(255,255,255,0.05)'}}>
            <button type="button" onClick={() => togglePanel('staff')} className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-hc-blue" style={{boxShadow:'0 0 8px rgba(59,130,246,0.6)'}} />
                <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase">Staff Quality</span>
                <span className="text-[9px] text-hc-muted opacity-40">{snapshot.staff.length} carers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-hc-muted opacity-40">Click staff to expand</span>
                <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isPanelCollapsed('staff') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </button>
            {!isPanelCollapsed('staff') && <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin px-4 pb-4">
              {snapshot.staff.map((s) => {
                const scoreHex = s.qualityScore >= 70 ? '#22c55e' : s.qualityScore >= 45 ? '#f59e0b' : '#ef4444';
                const isExpanded = selectedStaffCard === s.carer;
                return (
                  <div key={s.carer}>
                    <button
                      type="button"
                      onClick={() => setSelectedStaffCard(isExpanded ? null : s.carer)}
                      className="w-full text-left rounded-xl p-3.5 cursor-pointer transition-all duration-200"
                      style={{
                        background: s.isRepeatTarget ? 'rgba(239,68,68,0.05)' : isExpanded ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.025)',
                        border: s.isRepeatTarget ? '1px solid rgba(239,68,68,0.3)' : isExpanded ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <div className="flex justify-between items-center gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-bold text-white truncate">{s.carer}</span>
                          {s.isRepeatTarget && (
                            <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}}>
                              Critical Training Need
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {s.handoverScore !== null && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{color:'#a78bfa',background:'rgba(139,92,246,0.12)'}}>H:{s.handoverScore}</span>
                          )}
                          {s.dailySupportScore !== null && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{color:'#38bdf8',background:'rgba(56,189,248,0.1)'}}>1:1:{s.dailySupportScore}</span>
                          )}
                          <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{color: scoreHex, background:`${scoreHex}20`}}>
                            {s.qualityScore}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-hc-muted flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{s.entryCount} notes</span>
                        <span>avg {s.avgEntryChars}ch</span>
                        <span>{Math.round(s.shortEntryRatio * 100)}% short</span>
                        <span>R{s.redCount} A{s.amberCount}</span>
                      </div>
                      {s.tier && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <svg className="w-3 h-3 text-flag-amber shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                          <span className="text-flag-amber text-xs font-semibold">Tier {s.tier}: {s.reasons[0]}</span>
                        </div>
                      )}
                    </button>

                    {/* Expanded rubric detail */}
                    {isExpanded && (
                      <div className="mx-1 mb-1 rounded-b-xl p-3 space-y-2.5" style={{background:'rgba(59,130,246,0.04)',border:'1px solid rgba(59,130,246,0.15)',borderTop:'none',marginTop:'-2px'}}>
                        {/* Module bars */}
                        {s.moduleBreakdown.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1">Quality Modules</div>
                            {s.moduleBreakdown.map((m) => {
                              const mc = m.score >= 70 ? '#22c55e' : m.score >= 45 ? '#f59e0b' : '#ef4444';
                              return (
                                <div key={m.name}>
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-[10px] text-hc-muted">{m.name}</span>
                                    <span className="text-[10px] font-bold" style={{color:mc}}>{m.score}</span>
                                  </div>
                                  <div className="h-1 rounded-full" style={{background:'rgba(255,255,255,0.06)'}}>
                                    <div className="h-1 rounded-full transition-all duration-500" style={{width:`${m.score}%`,background:mc,boxShadow:`0 0 6px ${mc}60`}} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Top gaps */}
                        {s.topGaps.length > 0 && (
                          <div>
                            <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1">What's Missing</div>
                            <div className="space-y-0.5">
                              {s.topGaps.slice(0, 4).map((g, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="text-flag-amber shrink-0 mt-0.5">›</span>
                                  <span className="text-[10px] text-hc-muted leading-relaxed">{g}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Repeat target gaps */}
                        {s.repeatGaps.length > 0 && (
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-widest mb-1" style={{color:'#ef4444'}}>Repeat Training Gaps (7-day)</div>
                            <div className="space-y-0.5">
                              {s.repeatGaps.slice(0, 3).map((g, i) => (
                                <div key={i} className="flex items-start gap-1.5 px-2 py-1 rounded" style={{background:'rgba(239,68,68,0.06)'}}>
                                  <span style={{color:'#ef4444'}} className="shrink-0">!</span>
                                  <span className="text-[10px] leading-relaxed" style={{color:'#f87171'}}>{g}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Quick action */}
                        <button
                          type="button"
                          onClick={() => { setCoachStaff(s.carer); setCoachEntry(null); setCoachRewrite(''); }}
                          className="w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer"
                          style={{background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.25)',color:'#a78bfa'}}
                        >
                          Open in Coaching Studio
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {snapshot.staff.length === 0 && <div className="text-xs text-hc-muted opacity-40 text-center py-6">No staff data for this filter</div>}
            </div>}
          </div>

          {/* Escalations + call prep */}
          <div className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(145deg,rgba(12,16,24,0.30),rgba(8,11,18,0.24))',backdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',WebkitBackdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',border:'1px solid rgba(255,255,255,0.10)',boxShadow:'0 8px 40px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 0 0 0.5px rgba(255,255,255,0.05)'}}>
            <button type="button" onClick={() => togglePanel('escalations')} className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-flag-red" style={{boxShadow:'0 0 8px rgba(239,68,68,0.6)'}} />
                <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase">Escalations & Call Prep</span>
                <span className="text-[9px] text-hc-muted opacity-40">{snapshot.escalations.length}</span>
              </div>
              <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isPanelCollapsed('escalations') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {!isPanelCollapsed('escalations') && <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin px-4 pb-4">
              {/* Tier legend */}
              <div className="flex items-center gap-3 mb-3 px-1">
                {[{t:1,label:'Coaching nudge',c:'#f59e0b'},{t:2,label:'Formal coaching',c:'#ef4444'},{t:3,label:'Immediate action',c:'#dc2626'}].map(({t,label,c}) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{color:c,background:`${c}18`}}>T{t}</span>
                    <span className="text-[9px] text-hc-muted">{label}</span>
                  </div>
                ))}
              </div>
              {snapshot.escalations.length === 0 && (
                <div className="text-xs text-hc-muted opacity-60 py-2">No tiered escalations for this filter.</div>
              )}
              {snapshot.escalations.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelectedEscId(e.id)}
                  className="w-full text-left rounded-xl p-3 text-xs cursor-pointer transition-all duration-200"
                  style={{
                    background: selectedEscId === e.id ? 'rgba(20,184,166,0.08)' : 'rgba(255,255,255,0.025)',
                    border: selectedEscId === e.id ? '1px solid rgba(20,184,166,0.4)' : '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <span className="text-flag-red font-black">T{e.tier}</span> {e.carer} — {e.summary}
                </button>
              ))}
            </div>}

            {!isPanelCollapsed('escalations') && selectedEsc && script && (
              <div className="mt-3 rounded-xl p-4 space-y-3" style={{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={callVariant}
                    onChange={(e) => setCallVariant(e.target.value as CallPrepVariant)}
                    className="bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                  >
                    <option value="coaching">Coaching — warm, developmental</option>
                    <option value="urgent">Urgent — Tier 3, formal</option>
                    <option value="support-first">Support-first — curious before challenging</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText([script.title, '', ...script.lines].join('\n'));
                    }}
                    className="px-3 py-1 rounded-lg border border-hc-teal/40 text-[10px] text-hc-teal-light font-black uppercase"
                  >
                    Copy script
                  </button>
                </div>
                <pre className="text-[10px] text-hc-muted whitespace-pre-wrap font-mono leading-relaxed max-h-56 overflow-y-auto scrollbar-thin">
                  {script.lines.join('\n')}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={linkBusy === selectedEsc.suggestedTool}
                    onClick={() => void copyStaffTool(selectedEsc.suggestedTool)}
                    className="px-3 py-2 rounded-xl btn-gradient text-[10px] font-black uppercase"
                  >
                    Staff link: {selectedEsc.suggestedTool}
                  </button>
                  <button type="button" onClick={() => void copyStaffTool('notes')} className="px-3 py-2 rounded-xl border border-white/10 text-[10px] text-hc-muted uppercase">
                    Link: notes
                  </button>
                  <button type="button" onClick={() => void copyStaffTool('handover')} className="px-3 py-2 rounded-xl border border-white/10 text-[10px] text-hc-muted uppercase">
                    Link: handover
                  </button>
                </div>
                <div className="border-t border-white/10 pt-3 space-y-2">
                  <div className="text-[10px] font-black text-hc-muted uppercase">Call outcome</div>
                  <select
                    value={outcomeType}
                    onChange={(e) => setOutcomeType(e.target.value as typeof outcomeType)}
                    className="w-full bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                  >
                    <option value="reached">Reached</option>
                    <option value="voicemail">Voicemail</option>
                    <option value="callback">Callback scheduled</option>
                    <option value="refused">Refused / no answer</option>
                    <option value="resolved">Resolved on call</option>
                  </select>
                  <textarea
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value)}
                    placeholder="Brief notes…"
                    className="w-full min-h-[60px] bg-hc-dark/60 border border-white/10 rounded-lg p-2 text-[11px] text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      saveCallOutcome(selectedEsc, outcomeType, outcomeNotes);
                      setOutcomeNotes('');
                    }}
                    className="w-full py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase text-hc-teal-light"
                  >
                    Log outcome
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={exportMonitoringPack}
                className="w-full py-3 rounded-xl text-xs font-black uppercase text-white cursor-pointer transition-all duration-200 hover:opacity-90"
                style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)'}}
              >
                Download evidence pack
              </button>
              <button type="button" onClick={onRecompute} className="w-full py-2 text-[10px] text-hc-muted uppercase cursor-pointer hover:text-white transition-colors">
                Save run & push template context
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COACHING STUDIO ─────────────────────────────────────────── */}
      {weekData && (
        <div className="mt-8">
          {/* Section header */}
          <button
            type="button"
            onClick={() => togglePanel('coaching')}
            className="w-full flex items-center gap-3 mb-5 cursor-pointer group"
          >
            <div className="w-1 h-5 rounded-full" style={{background:'#8b5cf6', boxShadow:'0 0 12px rgba(139,92,246,0.6)'}} />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Note Coaching Studio</h2>
            <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest opacity-50 flex-1 text-left">Select staff → pick entry → generate gold standard → copy coaching message</span>
            <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200 shrink-0" style={{transform: isPanelCollapsed('coaching') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>

          {!isPanelCollapsed('coaching') && <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Col 1 — Staff list */}
            <div className="rounded-2xl p-4" style={{background:'linear-gradient(145deg,rgba(16,18,26,0.9),rgba(10,12,18,0.85))',backdropFilter:'blur(28px)',border:'1px solid rgba(255,255,255,0.07)',boxShadow:'0 8px 40px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.05)'}}>
              <div className="text-[10px] font-black tracking-[0.2em] text-hc-muted uppercase mb-3">Staff — lowest quality first</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin mb-4">
                {[...snapshot.staff].sort((a, b) => a.qualityScore - b.qualityScore).map(s => {
                  const scoreColor = s.qualityScore >= 70 ? '#22c55e' : s.qualityScore >= 45 ? '#f59e0b' : '#ef4444';
                  const isActive = coachStaff === s.carer;
                  return (
                    <button key={s.carer} type="button"
                      onClick={() => { setCoachStaff(s.carer); setCoachEntry(null); setCoachRewrite(''); }}
                      className="w-full text-left rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200"
                      style={{
                        background: isActive ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)',
                        border: isActive ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.05)',
                      }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white truncate">{s.carer}</span>
                        <span className="text-xs font-black px-2 py-0.5 rounded-lg shrink-0" style={{color: scoreColor, background:`${scoreColor}18`}}>{s.qualityScore}</span>
                      </div>
                      <div className="text-[10px] text-hc-muted mt-0.5 opacity-60">{s.entryCount} notes · {Math.round(s.shortEntryRatio * 100)}% short</div>
                    </button>
                  );
                })}
                {snapshot.staff.length === 0 && <div className="text-[10px] text-hc-muted opacity-40 text-center py-4">No staff data — sync records first</div>}
              </div>

              {/* Entry picker */}
              {coachStaff && entriesByStaff[coachStaff] && (
                <>
                  <div className="text-[10px] font-black tracking-[0.2em] text-hc-muted uppercase mb-2">Entries for {coachStaff}</div>
                  <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-thin">
                    {[...(entriesByStaff[coachStaff] || [])].sort((a, b) => scoreEntry(a).total - scoreEntry(b).total).slice(0, 20).map((e, i) => {
                      const isActive = coachEntry === e;
                      const preview = e.entry.slice(0, 55);
                      const es = scoreEntry(e).total;
                      const ec = es >= 70 ? '#22c55e' : es >= 45 ? '#f59e0b' : '#ef4444';
                      return (
                        <button key={i} type="button"
                          onClick={() => { setCoachEntry(e); setCoachRewrite(''); }}
                          className="w-full text-left rounded-xl px-3 py-2 cursor-pointer transition-all duration-200"
                          style={{
                            background: isActive ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
                            border: isActive ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.04)',
                          }}>
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[10px] text-hc-teal-light font-bold truncate">{e.date} · {e.client || 'Unknown'}</span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0" style={{color:ec,background:`${ec}18`}}>{es}</span>
                          </div>
                          <div className="text-[10px] text-hc-muted leading-relaxed opacity-70">{preview}{e.entry.length > 55 ? '…' : ''}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {!coachStaff && <div className="text-[10px] text-hc-muted opacity-40 text-center py-4">Select a staff member above</div>}
            </div>

            {/* Col 2 — Raw entry */}
            <div className="rounded-2xl p-4 flex flex-col" style={{background:'linear-gradient(145deg,rgba(16,18,26,0.9),rgba(10,12,18,0.85))',backdropFilter:'blur(28px)',border:'1px solid rgba(255,255,255,0.07)',boxShadow:'0 8px 40px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.05)'}}>
              <div className="text-[10px] font-black tracking-[0.2em] text-hc-muted uppercase mb-3">Original Entry</div>
              {coachEntry ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {coachEntry.date && <span className="pill pill-teal text-[10px]">{coachEntry.date}</span>}
                    {coachEntry.client && <span className="pill pill-blue text-[10px]">{coachEntry.client}</span>}
                    {coachEntry.type && <span className="pill" style={{background:'rgba(255,255,255,0.06)',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.08)',fontSize:'10px'}}>{coachEntry.type}</span>}
                    {(() => {
                      const es = scoreEntry(coachEntry);
                      const ec = es.total >= 70 ? '#22c55e' : es.total >= 45 ? '#f59e0b' : '#ef4444';
                      return <span className="text-[10px] font-black px-2 py-0.5 rounded-lg ml-auto" style={{color:ec,background:`${ec}18`}}>Score: {es.total}/100</span>;
                    })()}
                  </div>
                  {/* Rubric flags for this entry */}
                  {(() => {
                    const es = scoreEntry(coachEntry);
                    const allMissing = es.modules.flatMap(m => m.missing).concat(es.flags);
                    if (allMissing.length === 0) return null;
                    return (
                      <div className="mb-3 space-y-1">
                        {allMissing.slice(0, 3).map((gap, i) => (
                          <div key={i} className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg" style={{background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)'}}>
                            <span className="text-flag-amber shrink-0">›</span>
                            <span className="text-[10px] text-flag-amber/80 leading-snug">{gap}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex-1 text-[11px] text-hc-muted leading-relaxed overflow-y-auto scrollbar-thin mb-4 pr-1" style={{maxHeight:'220px'}}>
                    {coachEntry.entry}
                  </div>
                  <button type="button" onClick={generateGoldStandard} disabled={coachLoading}
                    className="w-full py-3 rounded-xl cursor-pointer font-black text-xs uppercase tracking-widest transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    style={{background:'linear-gradient(135deg,#7c3aed,#8b5cf6)',boxShadow:'0 4px 24px rgba(139,92,246,0.35)',color:'white'}}>
                    {coachLoading ? 'Generating…' : '✦ Generate Gold Standard'}
                  </button>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[10px] text-hc-muted opacity-40">
                  Select an entry from the left panel
                </div>
              )}
            </div>

            {/* Col 3 — Rewrite + dispatch */}
            <div className="rounded-2xl p-4 flex flex-col" style={{background:'linear-gradient(145deg,rgba(16,18,26,0.9),rgba(10,12,18,0.85))',backdropFilter:'blur(28px)',border:'1px solid rgba(255,255,255,0.07)',boxShadow:'0 8px 40px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.05)'}}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-black tracking-[0.2em] text-hc-muted uppercase">Gold Standard Rewrite</div>
                {coachRewrite && !coachLoading && (
                  <span className="text-[10px] font-bold text-flag-green uppercase tracking-wide">Ready</span>
                )}
              </div>
              <textarea
                ref={rewriteRef}
                value={coachRewrite}
                onChange={e => setCoachRewrite(e.target.value)}
                placeholder={coachLoading ? 'Generating gold standard note…' : 'Rewrite will appear here. Click "Generate Gold Standard" to produce a first-person coaching example.'}
                className="flex-1 w-full text-[11px] leading-relaxed resize-none focus:outline-none scrollbar-thin mb-4"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '12px',
                  color: coachLoading ? '#6b7d94' : '#e2eaf2',
                  minHeight: '240px',
                }}
              />
              <button
                type="button"
                onClick={copyCoachingMessage}
                disabled={!coachRewrite.trim() || coachLoading}
                className="w-full py-3 rounded-xl cursor-pointer font-black text-xs uppercase tracking-widest transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-30"
                style={{
                  background: coachCopied ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#0f766e,#14b8a6)',
                  boxShadow: coachCopied ? '0 4px 24px rgba(34,197,94,0.35)' : '0 4px 24px rgba(20,184,166,0.35)',
                  color: 'white',
                }}>
                {coachCopied ? '✓ Coaching message copied' : 'Copy coaching message to clipboard'}
              </button>
            </div>
          </div>}
        </div>
      )}

      {/* Recent outcomes */}
      <div className="mt-8 rounded-2xl overflow-hidden" style={{background:'linear-gradient(145deg,rgba(12,16,24,0.30),rgba(8,11,18,0.24))',backdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',WebkitBackdropFilter:'blur(48px) saturate(1.8) brightness(1.06)',border:'1px solid rgba(255,255,255,0.10)',boxShadow:'0 8px 40px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 0 0 0.5px rgba(255,255,255,0.05)'}}>
        <button type="button" onClick={() => togglePanel('outcomes')} className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{background:'#64748b'}} />
            <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase">Recent Call Outcomes</span>
          </div>
          <svg className="w-3.5 h-3.5 text-hc-muted/40 transition-transform duration-200" style={{transform: isPanelCollapsed('outcomes') ? 'rotate(-90deg)' : 'rotate(0deg)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {!isPanelCollapsed('outcomes') && <div className="px-4 pb-4 space-y-1 max-h-32 overflow-y-auto text-[10px] text-hc-muted">
          {loadCallOutcomes()
            .slice(0, 8)
            .map((o) => (
              <div key={o.id}>
                {new Date(o.at).toLocaleString('en-GB')} — {o.carer}: {o.outcome}
                {o.notes && ` — ${o.notes}`}
              </div>
            ))}
          {loadCallOutcomes().length === 0 && <span className="opacity-50">None logged yet.</span>}
        </div>}
      </div>
    </div>
  );
}
