import { useMemo, useState, useCallback, useEffect } from 'react';
import type { WeekSummary, CareEntry, Page } from '../lib/types';
import { useCollapseStore } from '../lib/collapse-store';
import {
  computeStaffMonitoring,
  defaultMondayWindow,
  flattenWeekEntries,
  type MonitoringFilters,
} from '../lib/staff-monitoring';
import { scoreEntry } from '../lib/entry-rubric';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { RefreshCw, ChevronRight, Activity, MessageSquare, History, FileText, Copy, CheckCheck, AlertTriangle, TrendingDown, BookOpen, Zap, Award, ShieldAlert } from 'lucide-react';
import type { StaffScorecard } from '../lib/staff-monitoring';
import { extractFileText } from '../lib/universal-extractor';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';
import { getAllEntriesAsync, getStoreBoundsAsync } from '../lib/entry-store';
import { buildWeekSummary } from '../lib/universal-parser';
import {
  DEFAULT_SUPPORT_WINDOWS,
  computeCoverageSummary,
  formatSupportWindows,
  loadCoveragePlan,
  parseSupportWindows,
  saveCoveragePlan,
  type CoveragePlan,
} from '../lib/coverage-plan';
import {
  enrollInSequence,
  loadActiveSequences,
  advanceSequence,
  STANDARD_SEQUENCES,
  logCoachingAction,
  recordCoachingEvents,
  recordModuleScores,
  detectGrowthAlerts,
  type ActiveSequence,
  type GrowthAlert,
} from '../lib/staff-monitoring-store';

interface Props {
  weekData: WeekSummary | null;
  onDataParsed: (data: WeekSummary) => void;
  setPage?: (p: Page, ctx?: any) => void;
}

export function StaffMonitoringPage({ weekData, onDataParsed, setPage }: Props) {
  const def = useMemo(() => defaultMondayWindow(), []);
  const [importLoading, setImportLoading] = useState(false);
  const [importDragging, setImportDragging] = useState(false);
  const [booting, setBooting] = useState(true);
  const [house] = useState<string>('all');
  const savedPlan = useMemo(() => loadCoveragePlan(), []);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: savedPlan?.dateFrom || def.dateFrom,
    to: savedPlan?.dateTo || def.dateTo,
  });
  const [selectedClient, setSelectedClient] = useState(savedPlan?.client || '');
  const [windowText, setWindowText] = useState(formatSupportWindows(savedPlan?.windows || DEFAULT_SUPPORT_WINDOWS));

  // Automatically hydrate from main IndexedDB on mount
  useEffect(() => {
    let alive = true;
    void getAllEntriesAsync().then(all => {
      if (!alive && all.length === 0) return;
      onDataParsed(buildWeekSummary(all));
      setBooting(false);
    });
    return () => { alive = false; };
  }, []);

  const handleImportFile = useCallback(async (file: File) => {
    setImportLoading(true);
    try {
      const text = await extractFileText(file);
      if (!text.trim()) return;
      const envelope = buildEnvelopeFromRaw(file.name, text);
      if (envelope.weekSummary && envelope.weekSummary.totalEntries > 0) {
        if (weekData) {
          const merged: WeekSummary = JSON.parse(JSON.stringify(weekData));
          let newAdded = 0;
          const getHash = (e: CareEntry) => `${e.date}-${e.carer}-${e.client}-${(e.entry || '').slice(0, 40)}`;
          const existingHashes = new Set(flattenWeekEntries(weekData).map(getHash));
          Object.entries(envelope.weekSummary.houses).forEach(([houseName, houseData]) => {
            if (!merged.houses[houseName]) { merged.houses[houseName] = houseData; newAdded += houseData.entries.length; }
            else { houseData.entries.forEach(e => { if (!existingHashes.has(getHash(e))) { merged.houses[houseName].entries.push(e); newAdded++; } }); }
          });
          if (newAdded > 0) { merged.totalEntries = flattenWeekEntries(merged).length; onDataParsed(merged); }
        } else { onDataParsed(envelope.weekSummary); }
      }
    } catch (e) { console.error(e); }
    finally { setImportLoading(false); }
  }, [onDataParsed, weekData]);

  const { isCollapsed, toggle, expandAll, collapseAll, allCollapsed } = useCollapseStore('staff-monitoring-cards');

  const allClients = useMemo(() => {
    const names = new Set<string>();
    for (const entry of weekData ? flattenWeekEntries(weekData) : []) {
      if (entry.client?.trim()) names.add(entry.client.trim());
    }
    return [...names].sort();
  }, [weekData]);

  const supportWindows = useMemo(() => parseSupportWindows(windowText), [windowText]);
  const coveragePlan = useMemo<CoveragePlan | null>(() => {
    if (!selectedClient || !dateRange.from || !dateRange.to) return null;
    return { client: selectedClient, dateFrom: dateRange.from, dateTo: dateRange.to, windows: supportWindows };
  }, [selectedClient, dateRange, supportWindows]);

  const filters: MonitoringFilters = useMemo(() => ({
    house,
    dateFrom: dateRange.from || '',
    dateTo: dateRange.to || '',
    client: selectedClient || undefined,
    coveragePlan,
  }), [house, dateRange, selectedClient, coveragePlan]);
  const snapshot = useMemo(() => computeStaffMonitoring(weekData, filters), [weekData, filters]);
  const coverage = snapshot.coverage || computeCoverageSummary(weekData ? flattenWeekEntries(weekData) : [], coveragePlan);

  // Record scores and detect improvements whenever snapshot changes
  useEffect(() => {
    if (snapshot.staff.length === 0) return;
    recordCoachingEvents(snapshot.staff);
    recordModuleScores(snapshot.staff);
    const alerts = detectGrowthAlerts(snapshot.staff);
    setGrowthAlerts(alerts);
    setActiveSequences(loadActiveSequences());
  }, [snapshot]);

  const [coachStaff, setCoachStaff] = useState<string | null>(null);
  const [coachCopied, setCoachCopied] = useState(false);
  const [activeSequences, setActiveSequences] = useState<ActiveSequence[]>(() => loadActiveSequences());
  const [growthAlerts, setGrowthAlerts] = useState<GrowthAlert[]>([]);
  const [sequenceNote, setSequenceNote] = useState('');
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const STAFF_IDS = useMemo(() => snapshot.staff.map(s => s.carer), [snapshot.staff]);

  const coachRecord = useMemo<StaffScorecard | null>(
    () => coachStaff ? (snapshot.staff.find(s => s.carer === coachStaff) ?? null) : null,
    [coachStaff, snapshot.staff]
  );

  // Get the 3 worst-scoring entries for a carer from weekData
  function getWorstEntries(carer: string): CareEntry[] {
    if (!weekData) return [];
    const all = flattenWeekEntries(weekData).filter(e => (e.carer || '').trim() === carer);
    return all
      .map(e => ({ entry: e, score: scoreEntry(e).total }))
      .filter(({ score }) => score < 70)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(({ entry }) => entry);
  }

  // Transform an entry into gold standard first-person format
  function buildGoldStandard(entry: CareEntry): string {
    let text = (entry.entry || '').trim();
    if (!text) {
      const client = entry.client?.trim() || 'the client';
      const firstName = client.split(' ')[0];
      return `I supported ${firstName} with personal care, meal preparation, and medication prompt. ${firstName} was calm and engaged well with support throughout. No incidents or safeguarding concerns were identified during this period. All support was delivered in line with ${firstName}'s care plan.`;
    }

    // Third-person → first-person transformations
    const subs: [RegExp, string][] = [
      [/\bstaff (supported|assisted|helped|provided|led|maintained|promoted|ensured|acted|encouraged|followed|documented|worked|completed|delivered|administered|gave|offered|observed|monitored|prompted|accompanied)\b/gi, 'I $1'],
      [/\bstaff members? (supported|assisted|helped|provided|led|maintained|were|was)\b/gi, 'I $1'],
      [/\bstaff member\b/gi, 'I'],
      [/\bthe (carer|support worker|worker)\b/gi, 'I'],
      [/\b(a carer|a support worker|a worker)\b/gi, 'I'],
    ];
    for (const [pat, rep] of subs) text = text.replace(pat, rep);

    // Clean up double spaces
    text = text.replace(/\s{2,}/g, ' ').trim();

    // Ensure ends with a full stop
    if (!/[.!?]$/.test(text)) text += '.';

    const result = scoreEntry(entry);
    const client = (entry.client?.trim() || '').split(' ')[0] || 'the client';
    const isCore = !entry.client || entry.category === 'handover' || entry.category === 'health_safety';

    // Append what was missing
    const presScore = result.modules.find(m => m.name === 'Presentation & Outcomes')?.score ?? 100;
    const taskScore = result.modules.find(m => m.name === 'Support Tasks')?.score ?? 100;
    const sgScore = result.modules.find(m => m.name === 'Safeguarding Overview')?.score ?? 100;
    const resScore = result.modules.find(m => m.name === 'Resident Welfare Overview')?.score ?? 100;

    if (!isCore && presScore < 60) {
      text += ` ${client} was calm and co-operative throughout the visit and engaged well with all prompts offered.`;
    }
    if (!isCore && taskScore < 60) {
      text += ` Support provided included personal care, medication prompt, and meal preparation — all completed in line with the care plan.`;
    }
    if (isCore && resScore < 60) {
      text += ` All residents were observed and presented as settled during the shift. No concerns regarding welfare were noted.`;
    }
    if ((isCore || entry.category === 'handover') && sgScore < 60) {
      text += ` No incidents or safeguarding concerns were identified during this period. All relevant information has been documented and passed to the next shift.`;
    } else if (!isCore) {
      const hasSg = /incident|safeguard|no concern|no issues/i.test(text);
      if (!hasSg) text += ` No safeguarding concerns were identified during this visit.`;
    }

    return text;
  }

  function buildCoachingNote(r: StaffScorecard): string {
    const firstName = r.carer.split(' ')[0];
    const worstEntries = getWorstEntries(r.carer);

    // Build natural-language improvement points from actual gaps
    const allMissing = r.moduleBreakdown.flatMap(m => m.missing);
    const points: string[] = [];
    if (allMissing.some(g => /first person|carer action|who provided/i.test(g))) {
      points.push(`Start each entry by stating what you actually did — "I supported ${firstName === r.carer.split(' ')[0] ? (worstEntries[0]?.client?.split(' ')[0] || 'them') : firstName} with..." gives the note an owner straight away.`);
    }
    if (allMissing.some(g => /support tasks|specific tasks/i.test(g))) {
      points.push('Be specific about the tasks. "Provided support" tells us nothing. "Supported with shower, prompted for medication, prepared lunch" tells us everything.');
    }
    if (allMissing.some(g => /presentation|outcome|responded/i.test(g))) {
      points.push(`Always say how they were. Mood, engagement, any refusals. Even "calm throughout and accepted all prompts" is better than nothing — it's the evidence.`);
    }
    if (allMissing.some(g => /safeguarding|incident/i.test(g))) {
      points.push('If nothing happened, say so. "No concerns or incidents during this visit" is a statement of fact, and it matters on a CQC file.');
    }
    if (r.shortEntryRatio > 0.3) {
      points.push(`Some of the entries are very short — a few words at most. That won't hold up if we're ever asked to evidence the care. A solid entry takes two minutes to write properly.`);
    }

    const openingLine = r.qualityScore >= 60
      ? `I've been going through your entries from this period and there's a lot of good work in there. A few things would make a real difference to the standard though, so I wanted to flag them.`
      : `I've been reviewing your recent entries and I want to have a quiet word about the documentation. The care is there — I can see you're putting in the work. But what's written down needs to show that, and right now it isn't quite getting there.`;

    const lines: string[] = [
      `Subject: Documentation Feedback — ${r.carer}`,
      '',
      `Hi ${firstName},`,
      '',
      openingLine,
      '',
    ];

    if (points.length > 0) {
      points.forEach(p => lines.push(`• ${p}`, ''));
    }

    if (r.isRepeatTarget && r.repeatGaps.length) {
      lines.push(`I do want to be straight with you — we've spoken about some of this before. I need to see a real change in the entries going forward, not just this week.`, '');
    }

    if (worstEntries.length > 0) {
      const primary = worstEntries[0];
      const clientLabel = primary.client || 'the house note';
      lines.push(
        `To show you what I mean, here's one of your entries from ${primary.date || 'this week'} for ${clientLabel}:`,
        '',
        (primary.entry || '').trim(),
        '',
        `And here's how that same shift reads when it's written to the standard we need:`,
        '',
        buildGoldStandard(primary),
        '',
        `Same shift. Same information. Just written in a way that actually evidences what you did.`,
        '',
      );

      if (worstEntries.length > 1) {
        lines.push(`One more example — ${worstEntries[1].date || ''} for ${worstEntries[1].client || 'the house'}:`, '');
        lines.push(
          `As written:`,
          (worstEntries[1].entry || '').trim(),
          '',
          `Should look more like:`,
          buildGoldStandard(worstEntries[1]),
          '',
        );
      }
    }

    lines.push(
      `Have a look at your upcoming entries with this in mind. I'll do another review in two weeks. Come and find me if you want to go through it together — happy to sit down.`,
      '',
      `Regards,`,
      `Management Team`,
    );

    return lines.join('\n');
  }

  const commitCoveragePlan = () => {
    if (!coveragePlan) return;
    saveCoveragePlan(coveragePlan);
  };

  const openCoverageWorkspace = () => {
    if (!coveragePlan) return;
    saveCoveragePlan(coveragePlan);
    setPage?.('note-workspace', { coveragePlan });
  };

  return (
    <div className="p-6 lg:p-10 w-full max-w-[2560px] mx-auto animate-in fade-in duration-500"
      onDragOver={e => { e.preventDefault(); setImportDragging(true); }}
      onDragLeave={() => setImportDragging(false)}
      onDrop={e => { e.preventDefault(); setImportDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleImportFile(f); }}
    >
      {importDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-hc-bg/90 backdrop-blur-md border-[8px] border-dashed border-hc-teal/30">
          <div className="rounded-[3rem] p-16 flex flex-col items-center gap-6 hc-clay-raised border border-hc-teal/20 shadow-2xl">
            <RefreshCw className="w-20 h-20 text-hc-teal animate-spin-slow" strokeWidth={1} />
            <div className="text-hc-text font-black text-2xl tracking-tighter uppercase">Drop Intelligence Stream</div>
          </div>
        </div>
      )}
      <input type="file" accept=".csv,.txt,.tsv" className="hidden" id="daily-sync-input"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />

      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-hc-border pb-10">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-hc-text tracking-[0.2em] uppercase flex items-center gap-4">Force Protection</h1>
          <p className="text-hc-text text-[11px] font-bold mt-3 max-w-2xl leading-relaxed uppercase tracking-wider">Clinical analysis of diary exports · Scored to protect registration.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => allCollapsed(STAFF_IDS) ? expandAll(STAFF_IDS) : collapseAll(STAFF_IDS)} className="px-6 py-3.5 rounded-2xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-text hover:text-hc-teal transition-all shadow-xl active:hc-clay-pressed">
            {allCollapsed(STAFF_IDS) ? 'Expand All Units' : 'Collapse All Matrix'}
          </button>
          <button type="button" onClick={() => document.getElementById('daily-sync-input')?.click()} disabled={importLoading}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl btn-tactical text-[11px] font-black cursor-pointer shadow-2xl">
            <RefreshCw className={`w-4 h-4 ${importLoading ? 'animate-spin' : ''}`} />
            {importLoading ? 'Analysing…' : 'Sync daily CSV'}
          </button>
        </div>
      </div>

      <div className="mb-6 z-20 relative">
        <DateRangePicker range={dateRange} onChange={setDateRange} compact />
      </div>

      <div className="mb-8 hc-clay-raised border border-hc-teal/20 rounded-2xl p-5">
        <div className="flex flex-col xl:flex-row gap-4 xl:items-end">
          <div className="flex-1 min-w-[220px]">
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.25em] mb-2">Client Coverage Target</div>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full hc-clay-inset rounded-xl px-4 py-3 text-[11px] font-black text-hc-text bg-hc-surface focus:outline-none"
            >
              <option value="">All clients</option>
              {allClients.map((client) => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>
          <div className="flex-[2] min-w-[280px]">
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.25em] mb-2">Expected 1:1 Windows</div>
            <input
              value={windowText}
              onChange={(e) => setWindowText(e.target.value)}
              placeholder="10am-12, 2pm-3pm, 5pm-7pm"
              className="w-full hc-clay-inset rounded-xl px-4 py-3 text-[11px] font-black text-hc-text bg-hc-surface focus:outline-none placeholder:text-hc-muted/50"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={commitCoveragePlan}
              disabled={!coveragePlan}
              className="px-5 py-3 rounded-xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-text disabled:opacity-40"
            >
              Save Target
            </button>
            <button
              type="button"
              onClick={openCoverageWorkspace}
              disabled={!coveragePlan || !setPage}
              className="px-5 py-3 rounded-xl btn-tactical text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Work Missing Notes
            </button>
          </div>
        </div>
        {coverage && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Expected', value: String(coverage.totalExpected) },
              { label: 'Found', value: String(coverage.totalActual) },
              { label: 'Missing', value: String(coverage.totalMissing) },
              { label: 'Coverage', value: `${coverage.coveragePct}%` },
              { label: '1:1 Hours', value: `${coverage.totalHours}h` },
            ].map((item) => (
              <div key={item.label} className="hc-clay-inset rounded-xl px-4 py-3">
                <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-1">{item.label}</div>
                <div className={`text-lg font-black tabular-nums ${item.label === 'Missing' && coverage.totalMissing > 0 ? 'text-flag-amber' : 'text-hc-text'}`}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
        {coverage && coverage.missingDays.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {coverage.missingDays.slice(0, 14).map((day) => (
              <span key={day.date} className="pill pill-amber text-[9px]">
                {day.date} · {day.actual}/{day.expected}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Growth alerts banner */}
      {growthAlerts.length > 0 && (
        <div className="mb-8 p-5 rounded-2xl bg-flag-green/10 border border-flag-green/30 flex items-start gap-4">
          <Award className="w-5 h-5 text-flag-green shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-black text-flag-green uppercase tracking-widest mb-2">Improvement Detected</div>
            <div className="flex flex-wrap gap-3">
              {growthAlerts.map(a => (
                <span key={a.carer} className="text-[11px] text-hc-muted">
                  <span className="font-black text-flag-green">{a.carer.split(' ')[0]}</span> — {a.module} +{a.delta}pts
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Intelligence Window', value: snapshot.windowLabel, icon: <Activity className="w-4 h-4" /> },
          { label: 'Scored Entries', value: String(snapshot.dataFreshness.entryCount), icon: <FileText className="w-4 h-4" /> },
          { label: 'Clinical Freshness', value: snapshot.dataFreshness.lastEntryDate || '—', icon: <RefreshCw className="w-4 h-4" /> },
          { label: 'Snapshot Time', value: new Date(snapshot.computedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), icon: <History className="w-4 h-4" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="hc-clay-raised px-8 py-6 relative overflow-hidden group/stat transition-all hover:translate-y-[-2px]">
            <div className="absolute top-0 right-0 p-6 opacity-5 text-hc-teal">{icon}</div>
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] mb-3">{label}</div>
            <div className={`text-xl font-black text-hc-text truncate tracking-tighter tabular-nums`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-10 relative">
        {booting && (
          <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-hc-surface/50 min-h-[600px]">
             <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-hc-teal/20 border-t-hc-teal rounded-full animate-spin mb-4" />
                <div className="text-[11px] font-black text-hc-teal animate-pulse uppercase tracking-[0.3em]">Quantifying Clinical Matrix</div>
                <div className="text-[10px] text-hc-muted uppercase mt-2 tracking-widest">Scanning 13,000+ Personnel Signals</div>
             </div>
          </div>
        )}
        <div className="flex-1 flex flex-col gap-10">
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-4 mb-6">
              <div className="w-2.5 h-2.5 rounded-full bg-flag-amber glow-amber" />
              <h2 className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em]">Critical Review · {snapshot.staff.length}</h2>
            </div>
            <div className="space-y-4">
              {snapshot.staff.map((s) => {
                const scoreColor = s.qualityScore >= 70 ? 'text-flag-green' : s.qualityScore >= 45 ? 'text-flag-amber' : 'text-flag-red';
                const collapsed = isCollapsed(s.carer);

                return (
                  <div key={s.carer} className="hc-clay-raised overflow-hidden">
                    <div className="p-6 flex items-center justify-between cursor-pointer group active:hc-clay-pressed" onClick={() => toggle(s.carer)}>
                      <div className="flex items-center gap-8 min-w-0">
                         <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center font-black text-hc-text text-sm uppercase">{s.carer.charAt(0)}</div>        
                         <div>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="text-base font-black text-hc-text uppercase leading-none group-hover:text-hc-teal transition-colors">{s.carer}</div>
                              {s.tier === 3 && <span className="pill !bg-flag-red/20 !text-flag-red border-flag-red/30 text-[8px]">T3 · Disciplinary</span>}
                              {s.tier === 2 && <span className="pill !bg-flag-amber/20 !text-flag-amber border-flag-amber/30 text-[8px]">T2 · Formal Review</span>}
                              {s.tier === 1 && <span className="pill !bg-hc-teal/20 !text-hc-teal border-hc-teal/30 text-[8px]">T1 · Coaching</span>}
                              {activeSequences.some(seq => seq.carer === s.carer && seq.status === 'active') && (
                                <span className="pill !bg-flag-amber/10 !text-flag-amber border-flag-amber/20 text-[8px]">▶ Sequence Active</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {s.categoryBreakdown.map(({ category, count }) => (
                                <span key={category} className="pill pill-teal !bg-hc-bg border-hc-teal/20 text-[9px]">
                                  {count}× {category.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                         </div>
                      </div>
                     <div className="flex items-center gap-10">
                         <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-black tabular-nums ${s.dailySupportCoveragePct === null ? 'text-hc-muted' : s.dailySupportCoveragePct >= 90 ? 'text-flag-green' : s.dailySupportCoveragePct >= 70 ? 'text-flag-amber' : 'text-flag-red'}`}>
                              Coverage {s.actualDailySupportEntries}/{s.expectedDailySupportEntries}
                            </span>
                            <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">{s.dailySupportCoveragePct === null ? 'N/A' : `${s.dailySupportCoveragePct}%`}</span>
                         </div>
                         <div className="flex flex-col items-end gap-1">
                            <span className={`text-[11px] font-black tabular-nums ${scoreColor}`}>{s.qualityScore}%</span>
                            <div className="h-1 w-24 rounded-full bg-black/10 overflow-hidden"><div className={`h-full ${scoreColor.replace('text-', 'bg-')}`} style={{width: `${s.qualityScore}%`}} /></div>
                         </div>
                         <div className={`w-8 h-8 rounded-full hc-clay-inset flex items-center justify-center text-hc-muted transition-transform duration-500 ${collapsed ? '' : 'rotate-180'}`}>
                            <ChevronRight size={14} />
                         </div>
                      </div>
                    </div>
                    {!collapsed && (
                      <div className="px-8 pb-8 pt-4 animate-in slide-in-from-top-4 duration-500 flex flex-col gap-8">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {s.moduleBreakdown.map((m) => (
                              <div key={m.name} className="hc-clay-inset p-5">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">{m.name}</span>
                                  <span className={`text-[11px] font-black tabular-nums ${m.score >= 70 ? 'text-flag-green' : m.score >= 45 ? 'text-flag-amber' : 'text-flag-red'}`}>{m.score}%</span> 
                                </div>
                                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                                  <div className={`h-full ${m.score >= 70 ? 'bg-flag-green' : m.score >= 45 ? 'bg-flag-amber' : 'bg-flag-red'}`} style={{width: `${m.score}%`}} />
                                </div>
                              </div>
                            ))}
                         </div>
                         <div className="flex justify-end gap-4 border-t border-hc-border pt-6">
                            <button onClick={(e) => { e.stopPropagation(); setCoachStaff(s.carer); }}
                              className="px-8 py-3.5 rounded-2xl btn-tactical shadow-2xl">Contextual Coaching &rsaquo;</button>
                         </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        
        <div className="w-full xl:w-[500px] shrink-0">
          {coachRecord ? (
            <div className="hc-clay-raised overflow-hidden sticky top-10 animate-in slide-in-from-right-8 duration-700">
              {/* Header */}
              <div className="p-6 border-b border-hc-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-lg font-black text-hc-teal">{coachRecord.carer.charAt(0)}</div>
                  <div>
                    <h2 className="text-base font-black text-hc-text uppercase leading-none mb-1">{coachRecord.carer}</h2>
                    <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em]">Coaching Studio</p>
                  </div>
                </div>
                <button onClick={() => setCoachStaff(null)} className="w-9 h-9 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-flag-red transition-all text-lg">&times;</button>
              </div>

              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto scrollbar-thin">
                {/* Score headline */}
                <div className="hc-clay-inset p-5 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-1">Overall Quality</div>
                    <div className={`text-3xl font-black tabular-nums ${coachRecord.qualityScore >= 70 ? 'text-flag-green' : coachRecord.qualityScore >= 45 ? 'text-flag-amber' : 'text-flag-red'}`}>
                      {coachRecord.qualityScore}%
                    </div>
                  </div>
                    <div className="text-right text-[10px] font-black text-hc-muted uppercase space-y-1">
                      <div>{coachRecord.scoreableCount} entries scored</div>
                      <div>{coachRecord.avgEntryChars} avg chars</div>
                      <div className={coachRecord.shortEntryRatio > 0.3 ? 'text-flag-red' : ''}>{Math.round(coachRecord.shortEntryRatio * 100)}% short entries</div>
                      <div className={coachRecord.dailySupportCoveragePct !== null && coachRecord.dailySupportCoveragePct < 80 ? 'text-flag-red' : ''}>
                        Coverage {coachRecord.expectedDailySupportEntries > 0 ? `${coachRecord.actualDailySupportEntries}/${coachRecord.expectedDailySupportEntries}` : 'N/A'}
                      </div>
                    </div>
                </div>

                {/* Repeat target warning */}
                {coachRecord.isRepeatTarget && (
                  <div className="flex items-start gap-3 p-4 bg-flag-red/10 border border-flag-red/30 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-flag-red shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-black text-flag-red uppercase tracking-widest mb-1">Repeat Coaching Target</div>
                      <div className="text-[11px] text-hc-muted">Gaps persisting from previous review period.</div>
                    </div>
                  </div>
                )}

                {/* Module breakdown */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-3.5 h-3.5 text-hc-muted" />
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Module Breakdown</span>
                  </div>
                  <div className="space-y-3">
                    {[...coachRecord.moduleBreakdown].sort((a, b) => a.score - b.score).map(m => (
                      <div key={m.name} className="hc-clay-inset p-4 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-hc-text uppercase tracking-widest">{m.name}</span>
                          <span className={`text-[11px] font-black tabular-nums ${m.score >= 70 ? 'text-flag-green' : m.score >= 45 ? 'text-flag-amber' : 'text-flag-red'}`}>{m.score}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-black/10 overflow-hidden mb-2">
                          <div className={`h-full ${m.score >= 70 ? 'bg-flag-green' : m.score >= 45 ? 'bg-flag-amber' : 'bg-flag-red'}`} style={{ width: `${m.score}%` }} />
                        </div>
                        {m.missing.length > 0 && (
                          <div className="text-[10px] text-hc-muted leading-relaxed">
                            Missing: {m.missing.slice(0, 3).join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top gaps */}
                {coachRecord.topGaps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-3.5 h-3.5 text-hc-muted" />
                      <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Recurring Gaps</span>
                    </div>
                    <div className="space-y-1.5">
                      {coachRecord.topGaps.slice(0, 5).map((gap, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-hc-muted">
                          <span className="text-flag-amber shrink-0 mt-0.5">›</span>
                          {gap}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reasons / flags */}
                {coachRecord.reasons.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-2">Flagged Reasons</div>
                    <div className="space-y-1.5">
                      {coachRecord.reasons.slice(0, 4).map((r, i) => (
                        <div key={i} className="text-[11px] text-flag-red flex items-start gap-2">
                          <span className="shrink-0">!</span>{r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Growth alert for this carer */}
                {growthAlerts.find(a => a.carer === coachRecord.carer) && (() => {
                  const alert = growthAlerts.find(a => a.carer === coachRecord.carer)!;
                  return (
                    <div className="flex items-start gap-3 p-4 bg-flag-green/10 border border-flag-green/30 rounded-xl">
                      <Award className="w-4 h-4 text-flag-green shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-black text-flag-green uppercase tracking-widest mb-1">Growth Detected</div>
                        <div className="text-[11px] text-hc-muted">{alert.module}: {alert.previousScore}% → {alert.currentScore}% (+{alert.delta}pts)</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Escalation pathway */}
                {coachRecord.tier && (
                  <div className="border border-hc-border/20 rounded-2xl overflow-hidden">
                    <div className={`px-5 py-3 flex items-center gap-3 ${coachRecord.tier === 3 ? 'bg-flag-red/10' : coachRecord.tier === 2 ? 'bg-flag-amber/10' : 'bg-hc-teal/10'}`}>
                      <ShieldAlert size={14} className={coachRecord.tier === 3 ? 'text-flag-red' : coachRecord.tier === 2 ? 'text-flag-amber' : 'text-hc-teal'} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${coachRecord.tier === 3 ? 'text-flag-red' : coachRecord.tier === 2 ? 'text-flag-amber' : 'text-hc-teal'}`}>
                        {coachRecord.tier === 3 ? 'Tier 3 — Disciplinary Pathway' : coachRecord.tier === 2 ? 'Tier 2 — Formal Supervision' : 'Tier 1 — Coaching Required'}
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Active sequence status */}
                      {(() => {
                        const seq = activeSequences.find(s => s.carer === coachRecord.carer && s.status === 'active');
                        if (seq) {
                          const template = STANDARD_SEQUENCES.find(t => t.id === seq.sequenceId);
                          const step = template?.steps[seq.currentStepIndex];
                          return (
                            <div className="hc-clay-inset p-4 rounded-xl space-y-3">
                              <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Active: {template?.name}</div>
                              <div className="text-[11px] font-black text-hc-text">Step {seq.currentStepIndex + 1}: {step?.label}</div>
                              <div className="space-y-2">
                                <input
                                  value={sequenceNote}
                                  onChange={e => setSequenceNote(e.target.value)}
                                  placeholder="Add note for this step…"
                                  className="w-full hc-clay-inset rounded-lg px-3 py-2 text-[10px] text-hc-text bg-transparent outline-none placeholder:text-hc-muted/40"
                                />
                                <button
                                  onClick={() => {
                                    advanceSequence(seq.id, sequenceNote);
                                    setSequenceNote('');
                                    setActiveSequences(loadActiveSequences());
                                  }}
                                  className="w-full py-2.5 rounded-xl btn-tactical text-[9px] font-black uppercase tracking-widest"
                                >
                                  Mark Step Complete &rsaquo;
                                </button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-2">Enrol in Pathway</div>
                            {STANDARD_SEQUENCES.map(seq => (
                              <button
                                key={seq.id}
                                onClick={() => {
                                  if (enrolling === seq.id) {
                                    enrollInSequence(coachRecord.carer, seq.id);
                                    logCoachingAction(coachRecord.carer);
                                    setActiveSequences(loadActiveSequences());
                                    setEnrolling(null);
                                  } else {
                                    setEnrolling(seq.id);
                                  }
                                }}
                                className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                  enrolling === seq.id
                                    ? 'bg-flag-amber text-hc-bone'
                                    : 'hc-clay-raised text-hc-muted hover:text-hc-text active:hc-clay-pressed'
                                }`}
                              >
                                <Zap size={10} className="inline mr-1.5" />
                                {enrolling === seq.id ? `Confirm: ${seq.name}` : seq.name}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Live entry review — actual vs expected */}
                {(() => {
                  const worst = getWorstEntries(coachRecord.carer);
                  if (worst.length === 0) return null;
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-3.5 h-3.5 text-hc-muted" />
                        <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Live Entry Review</span>
                      </div>
                      <div className="space-y-4">
                        {worst.map((entry, i) => {
                          const result = scoreEntry(entry);
                          const missing = result.modules.flatMap(m => m.missing);
                          return (
                            <div key={entry.id} className="rounded-2xl overflow-hidden border border-hc-border/20">
                              <div className="px-4 py-2.5 bg-hc-bg/60 flex items-center justify-between border-b border-hc-border/10">
                                <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">
                                  Entry {i + 1} · {entry.date || '—'} · {entry.client || 'House note'}
                                </span>
                                <span className={`text-[9px] font-black tabular-nums ${result.total >= 60 ? 'text-flag-green' : result.total >= 40 ? 'text-flag-amber' : 'text-flag-red'}`}>
                                  {result.total}%
                                </span>
                              </div>

                              {/* Actual bad entry */}
                              <div className="px-4 py-3 border-b border-hc-border/10">
                                <div className="text-[8px] font-black text-flag-red uppercase tracking-widest mb-1.5">as written</div>
                                <p className="text-[10px] text-hc-muted leading-relaxed italic">
                                  "{(entry.entry || '').trim().slice(0, 250)}{(entry.entry || '').length > 250 ? '…' : ''}"
                                </p>
                              </div>

                              {/* What's missing */}
                              {missing.length > 0 && (
                                <div className="px-4 py-3 border-b border-hc-border/10 bg-flag-red/5">
                                  <div className="text-[8px] font-black text-flag-red uppercase tracking-widest mb-1.5">Missing</div>
                                  {missing.map((gap, j) => (
                                    <div key={j} className="text-[10px] text-flag-red/80 flex items-start gap-1.5 mb-1">
                                      <span className="shrink-0">›</span>{gap}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Gold standard rewrite */}
                              <div className="px-4 py-3 bg-flag-green/5">
                                <div className="text-[8px] font-black text-flag-green uppercase tracking-widest mb-1.5">gold standard</div>
                                <p className="text-[10px] text-hc-text leading-relaxed">
                                  {buildGoldStandard(entry)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Copy coaching note */}
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(buildCoachingNote(coachRecord));
                    setCoachCopied(true);
                    setTimeout(() => setCoachCopied(false), 2500);
                  }}
                  className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest transition-all shadow-xl
                    ${coachCopied ? 'bg-flag-green/20 text-flag-green border border-flag-green/30' : 'btn-tactical'}`}
                >
                  {coachCopied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {coachCopied ? 'Coaching Note Copied' : 'Copy Coaching Note'}
                </button>
              </div>
            </div>
          ) : (
            <div className="hc-clay-raised p-16 flex flex-col items-center justify-center opacity-30 text-center sticky top-10 bg-hc-bg/30 h-[400px]">
               <MessageSquare className="w-16 h-16 text-hc-muted mb-8" strokeWidth={1} />
               <div className="text-[12px] font-black uppercase tracking-[0.4em] mb-4">Command Awaiting Input</div>
               <p className="text-[10px] font-bold uppercase tracking-widest max-w-xs">Select personnel record to initialise studio.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
