import { useMemo, useState, useCallback, useEffect } from 'react';
import type { WeekSummary, CareEntry } from '../lib/types';
import { useCollapseStore } from '../lib/collapse-store';
import {
  computeStaffMonitoring,
  defaultMondayWindow,
  flattenWeekEntries,
  type MonitoringFilters,
} from '../lib/staff-monitoring';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { RefreshCw, ChevronRight, Activity, MessageSquare, History, FileText, Copy, CheckCheck, AlertTriangle, TrendingDown, BookOpen } from 'lucide-react';
import type { StaffScorecard } from '../lib/staff-monitoring';
import { extractFileText } from '../lib/universal-extractor';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';
import { getAllEntriesAsync, getStoreBoundsAsync } from '../lib/entry-store';
import { buildWeekSummary } from '../lib/universal-parser';

interface Props {
  weekData: WeekSummary | null;
  onDataParsed: (data: WeekSummary) => void;
}

export function StaffMonitoringPage({ weekData, onDataParsed }: Props) {
  const def = useMemo(() => defaultMondayWindow(), []);
  const [importLoading, setImportLoading] = useState(false);
  const [importDragging, setImportDragging] = useState(false);
  const [booting, setBooting] = useState(true);
  const [house] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: def.dateFrom, to: def.dateTo });

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

  const filters: MonitoringFilters = useMemo(() => ({ house, dateFrom: dateRange.from || '', dateTo: dateRange.to || '' }), [house, dateRange]);
  const snapshot = useMemo(() => computeStaffMonitoring(weekData, filters), [weekData, filters]);

  const [coachStaff, setCoachStaff] = useState<string | null>(null);
  const [coachCopied, setCoachCopied] = useState(false);

  const STAFF_IDS = useMemo(() => snapshot.staff.map(s => s.carer), [snapshot.staff]);

  const coachRecord = useMemo<StaffScorecard | null>(
    () => coachStaff ? (snapshot.staff.find(s => s.carer === coachStaff) ?? null) : null,
    [coachStaff, snapshot.staff]
  );

  function buildCoachingNote(r: StaffScorecard): string {
    const scoreColor = r.qualityScore >= 70 ? 'strong' : r.qualityScore >= 45 ? 'developing' : 'requires improvement';
    const weakest = [...r.moduleBreakdown].sort((a, b) => a.score - b.score).slice(0, 3);
    const lines: string[] = [
      `CLINICAL COACHING NOTE — ${r.carer.toUpperCase()}`,
      `Generated: ${new Date().toLocaleDateString('en-GB')} | Quality Score: ${r.qualityScore}% (${scoreColor})`,
      `Entries reviewed: ${r.scoreableCount} | Avg length: ${r.avgEntryChars} chars | Short entries: ${Math.round(r.shortEntryRatio * 100)}%`,
      `Daily support coverage: ${r.expectedDailySupportEntries > 0 ? `${r.actualDailySupportEntries}/${r.expectedDailySupportEntries} (${r.dailySupportCoveragePct ?? 0}%)` : 'N/A (no daily-support expectation in this window)'}`,
      '',
      'KEY DEVELOPMENT AREAS:',
      ...weakest.map(m => `  • ${m.name} — ${m.score}%${m.missing.length ? '\n    Missing: ' + m.missing.slice(0, 3).join(', ') : ''}`),
      '',
    ];
    if (r.topGaps.length) {
      lines.push('RECURRING GAPS:', ...r.topGaps.slice(0, 4).map(g => `  • ${g}`), '');
    }
    if (r.isRepeatTarget && r.repeatGaps.length) {
      lines.push('⚠ REPEAT COACHING TARGET — gaps persisting from previous review:', ...r.repeatGaps.slice(0, 3).map(g => `  • ${g}`), '');
    }
    lines.push(
      'RECOMMENDED ACTIONS:',
      '  1. Review the entries flagged below with the staff member 1:1.',
      '  2. Demonstrate expected documentation standard using a completed example.',
      '  3. Set a 2-week improvement target and re-score.',
      r.qualityScore < 45 ? '  4. ESCALATE: Consider formal supervision / disciplinary pathway.' : '  4. Positive reinforcement where scores are strong.',
      '',
      `— Generated by Hazelcare Force Protection | ${new Date().toISOString()}`
    );
    return lines.join('\n');
  }

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
                            <div className="text-base font-black text-hc-text uppercase leading-none mb-2 group-hover:text-hc-teal transition-colors">{s.carer}</div>
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
