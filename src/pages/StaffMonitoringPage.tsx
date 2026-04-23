import { useMemo, useState, useCallback, useEffect } from 'react';
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
  loadCallOutcomes,
  recordCoachingEvents,
  recordModuleScores,
  detectGrowthAlerts,
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
import { Sparkles, Download, RefreshCw, ChevronRight, Activity, MessageSquare, History, FileText, CheckCircle, Search } from 'lucide-react';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
  onDataParsed: (data: WeekSummary) => void;
  staff: StaffMember[];
}

import { extractFileText } from '../lib/universal-extractor';

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
      const text = await extractFileText(file);
      if (!text.trim()) { setImportError('File appears empty.'); return; }

      const envelope = buildEnvelopeFromRaw(file.name, text);
      if (envelope.weekSummary && envelope.weekSummary.totalEntries >= 10_000) {
        setImportError('Large export: showing most recent 10,000 entries. Use house filters to focus the analysis.');
      }
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

  const [selectedStaffCard, setSelectedStaffCard] = useState<string | null>(null);

  const [coachStaff, setCoachStaff] = useState<string | null>(null);
  const [coachEntry, setCoachEntry] = useState<CareEntry | null>(null);
  const [coachRewrite, setCoachRewrite] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachCopied, setCoachCopied] = useState(false);

  const filters: MonitoringFilters = useMemo(() => ({ house, dateFrom, dateTo }), [house, dateFrom, dateTo]);
  const snapshot = useMemo(() => computeStaffMonitoring(weekData, filters), [weekData, filters]);

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

  const onRecompute = useCallback(() => {
    saveMonitoringRun(`${snapshot.windowLabel} · ${snapshot.dataFreshness.entryCount} entries`, snapshot.escalations.length);
    detectGrowthAlerts(snapshot.staff);
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
      const res = await fetch('/api/staff/enhance-note', {
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
    saveCallOutcome(selectedEsc || { id: '', carer: coachStaff || 'Unknown', tier: 1, reasons: [], topGaps: [], summary: '', suggestedTool: 'notes', qualityScore: 0, entryCount: 1, shortEntryRatio: 1, avgEntryChars: 10, house: house }, 'reached', 'Messaged via Chat. Pending review.');
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
          <div className="rounded-[3rem] p-16 flex flex-col items-center gap-6 glass border-2 border-hc-teal/40 shadow-2xl">
            <RefreshCw className="w-20 h-20 text-hc-teal animate-spin-slow" strokeWidth={1} />
            <div className="text-hc-text font-black text-2xl tracking-tighter uppercase">Drop Intelligence Stream</div>
          </div>
        </div>
      )}
      <input type="file" accept=".csv,.txt,.tsv" className="hidden" id="daily-sync-input"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />

      {/* ── Page header ── */}
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-hc-muted/10 pb-10">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-hc-text tracking-[0.2em] uppercase flex items-center gap-4">
            Force Protection
            <span className="pill pill-teal text-[10px] font-black tracking-[0.2em] px-4 py-1">Operational Engine</span>
          </h1>
          <p className="text-hc-text text-sm font-bold mt-3 max-w-2xl leading-relaxed uppercase tracking-wider">
            Clinical analysis of diary exports. Scored to protect {ORG_CONFIG.name} registration.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => document.getElementById('daily-sync-input')?.click()} disabled={importLoading}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl btn-tactical text-[11px] font-black cursor-pointer shadow-2xl hover:scale-105 active:scale-95 transition-all">
            <RefreshCw className={`w-4 h-4 ${importLoading ? 'animate-spin' : ''}`} />
            {importLoading ? 'Analysing…' : 'Sync daily CSV'}
          </button>
          <button type="button" onClick={() => { onRecompute(); setPage('templates'); }}
            className="px-6 py-3.5 rounded-2xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-text hover:brightness-90 transition-all">
            Templates
          </button>
        </div>
      </div>

      {importError && (
        <div className={`mb-10 px-8 py-5 rounded-[2rem] hc-clay-inset text-xs font-black uppercase tracking-widest flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 ${importError.includes('Merged') ? 'text-flag-green' : 'text-flag-red'}`}>
          <div className={`w-2.5 h-2.5 rounded-full ${importError.includes('Merged') ? 'bg-flag-green animate-pulse' : 'bg-flag-red'}`} />
          {importError}
        </div>
      )}

      {/* ── House Tabs ── */}
      <div className="flex flex-wrap gap-2 mb-10 overflow-x-auto scrollbar-none py-2 px-1">
        {['NETWORK', ...Object.keys(weekData?.houses || {})].map((h) => {
          const isActive = h === 'NETWORK' ? house === 'all' : house === h;
          return (
            <button key={h} onClick={() => setHouse(h === 'NETWORK' ? 'all' : h)}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300
                ${isActive ? 'hc-clay-inset text-hc-teal' : 'text-hc-text hover:brightness-75'}`}>
              {h.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Header strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Intelligence Window', value: snapshot.windowLabel, color: 'text-hc-teal', icon: <Activity className="w-4 h-4" /> },
          { label: 'Scored Entries', value: String(snapshot.dataFreshness.entryCount), color: 'text-hc-text', icon: <FileText className="w-4 h-4" /> },
          { label: 'Clinical Freshness', value: snapshot.dataFreshness.lastEntryDate || '—', color: snapshot.dataFreshness.staleHours != null && snapshot.dataFreshness.staleHours > 24 ? 'text-flag-amber' : 'text-hc-text', icon: <RefreshCw className="w-4 h-4" /> },
          { label: 'Snapshot Time', value: new Date(snapshot.computedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), color: 'text-hc-text', icon: <History className="w-4 h-4" /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="hc-clay-raised px-8 py-6 relative overflow-hidden group/stat transition-all hover:translate-y-[-2px]">
            <div className="absolute top-0 right-0 p-6 opacity-5 text-hc-teal group-hover/stat:scale-125 transition-transform">{icon}</div>
            <div className="text-[10px] font-black text-hc-text uppercase tracking-[0.3em] mb-3 opacity-60">{label}</div>
            <div className={`text-xl font-black ${color} truncate tracking-tighter tabular-nums`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mb-12 relative group">
        <div className="absolute left-8 top-1/2 -translate-y-1/2 text-hc-text group-focus-within:text-hc-teal transition-colors">
          <Search className="w-5 h-5" />
        </div>
        <input 
          placeholder="QUERY READINESS COMMAND..." 
          className="w-full h-[70px] hc-clay-inset pl-20 pr-10 text-sm font-black uppercase tracking-[0.3em] text-hc-text focus:outline-none transition-all" 
        />
      </div>

      {/* ── HIGH DENSITY COMMAND CENTER LAYOUT ── */}
      {weekData && (
        <div className="flex flex-col xl:flex-row gap-10">
          <div className="flex-1 flex flex-col gap-10">
            
            {/* Critical Review Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 px-4">
                <div className="w-2.5 h-2.5 rounded-full bg-flag-amber shadow-[0_0_10px_#d9974e]" />
                <h2 className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em]">Critical Review — {snapshot.escalations.length}</h2>
              </div>
              <div className="space-y-3">
                {snapshot.staff.map((s) => {
                  const scoreColor = s.qualityScore >= 70 ? 'text-flag-green' : s.qualityScore >= 45 ? 'text-flag-amber' : 'text-flag-red';
                  const esc = snapshot.escalations.find(e => e.carer === s.carer);
                  const isExpanded = selectedStaffCard === s.carer;
                  
                  return (
                    <div key={s.carer} className="hc-clay-raised overflow-hidden">
                      <div className="p-6 flex items-center justify-between cursor-pointer group" onClick={() => setSelectedStaffCard(isExpanded ? null : s.carer)}>
                        <div className="flex items-center gap-8 min-w-0">
                           <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center font-black text-hc-text text-sm shadow-inner uppercase">{s.carer.charAt(0)}</div>
                           <div>
                              <div className="text-base font-black text-hc-text tracking-tighter uppercase leading-none mb-2 group-hover:text-hc-teal transition-colors">{s.carer}</div>
                              <div className="flex items-center gap-4 text-[9px] font-black text-hc-text uppercase tracking-widest opacity-80">
                                 <span>Injest Vector</span>
                                 <span className="font-mono">{s.entryCount}U</span>
                              </div>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-10">
                           <div className="flex flex-col items-end gap-1">
                              <span className={`text-sm font-black tabular-nums tracking-tighter ${scoreColor}`}>{s.qualityScore}%</span>
                              <div className={`h-1.5 w-20 rounded-full bg-black/5 overflow-hidden`}>
                                 <div className={`h-full ${scoreColor.replace('text-', 'bg-')}`} style={{width: `${s.qualityScore}%`}} />
                              </div>
                           </div>
                           <ChevronRight className={`w-5 h-5 text-hc-text transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-8 pb-8 pt-4 animate-in slide-in-from-top-4 duration-500 flex flex-col gap-6">
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {s.moduleBreakdown.map((m) => (
                                <div key={m.name} className="hc-clay-inset p-5">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-[9px] font-black text-hc-text uppercase tracking-widest opacity-70">{m.name}</span>
                                    <span className={`text-[11px] font-black tabular-nums ${m.score >= 70 ? 'text-flag-green' : m.score >= 45 ? 'text-flag-amber' : 'text-flag-red'}`}>{m.score}%</span>
                                  </div>
                                  <div className="h-1 rounded-full bg-black/5 overflow-hidden">
                                    <div className={`h-full ${m.score >= 70 ? 'bg-flag-green' : m.score >= 45 ? 'bg-flag-amber' : 'bg-flag-red'}`} style={{width: `${m.score}%`}} />
                                  </div>
                                </div>
                              ))}
                           </div>
                           <div className="flex justify-end gap-4">
                              <button onClick={(e) => { e.stopPropagation(); setCoachStaff(s.carer); setCoachEntry(null); setCoachRewrite(''); setSelectedEscId(esc?.id || null); }}
                                className="px-8 py-3.5 rounded-2xl btn-tactical text-[10px] font-black uppercase tracking-widest shadow-xl">Contextual Coaching Studio ➔</button>
                           </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Sidebar Area */}
          <div className="w-full xl:w-[500px] flex flex-col gap-10 shrink-0">
            {coachStaff ? (
              <div className="hc-clay-raised p-8 flex flex-col gap-8 relative overflow-hidden h-fit sticky top-10 animate-in slide-in-from-right-8 duration-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-hc-bg hc-clay-inset flex items-center justify-center text-xl font-black text-hc-teal shadow-xl">{coachStaff.charAt(0)}</div>
                    <div>
                      <h2 className="text-xl font-black text-hc-text tracking-tighter uppercase leading-none mb-1.5">{coachStaff}</h2>
                      <p className="text-[10px] font-black text-hc-text uppercase tracking-[0.2em] opacity-60">Contextual Studio</p>
                    </div>
                  </div>
                  <button onClick={() => setCoachStaff(null)} className="w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-text hover:bg-black/5 transition-all active:scale-90">✕</button>
                </div>

                <div className="space-y-10">
                  <section>
                    <label className="text-[10px] font-black text-hc-text uppercase tracking-[0.3em] mb-5 block opacity-60 uppercase">1. Vector Target Selection</label>
                    <select className="w-full hc-clay-inset px-5 py-4 text-xs font-black uppercase tracking-widest text-hc-text outline-none mb-4 shadow-inner"
                      onChange={(e) => { const entry = entriesByStaff[coachStaff]?.find(x => x.entry === e.target.value); if (entry) { setCoachEntry(entry); setCoachRewrite(''); } }} value={coachEntry?.entry || ''}>
                      <option value="">-- CHOOSE DIAGNOSTIC NODE --</option>
                      {[...(entriesByStaff[coachStaff] || [])].sort((a, b) => scoreEntry(a).total - scoreEntry(b).total).slice(0, 10).map((e, i) => (
                        <option key={i} value={e.entry}>{e.date} :: {scoreEntry(e).total}%</option>
                      ))}
                    </select>
                  </section>

                  {coachEntry && (
                    <section className="space-y-8 animate-in fade-in duration-500">
                      <div className="hc-clay-inset p-6 bg-flag-amber/[0.05] border border-flag-amber/10">
                         <div className="text-[10px] font-black text-flag-amber uppercase tracking-[0.2em] mb-3">Diagnostic Gaps</div>
                         <div className="space-y-2">
                           {scoreEntry(coachEntry).modules.flatMap(m => m.missing).slice(0,2).map((gap, i) => <div key={i} className="text-[11px] font-black text-hc-text opacity-80 leading-relaxed uppercase">• {gap}</div>)}
                         </div>
                      </div>

                      <div className="hc-clay-raised p-8 relative overflow-hidden bg-hc-bg/50">
                        <div className="text-[10px] font-black text-hc-teal uppercase tracking-[0.2em] mb-5 block">Transformation Output</div>
                        <textarea readOnly value={script ? script.lines.join('\n') : coachRewrite} 
                          placeholder={coachLoading ? "Clinical Brain is processing..." : "Initialize Gold Standard pipeline."}
                          className="w-full bg-transparent text-[13px] leading-relaxed text-hc-text font-black italic min-h-[160px] resize-none outline-none mb-6 scrollbar-thin uppercase" />
                        
                        <button onClick={generateGoldStandard} disabled={coachLoading} className="w-full py-4 rounded-2xl btn-tactical text-[11px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-4 transition-all">
                          {coachLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {coachRewrite ? 'Regenerate Standard' : 'Execute Gold Standard'}
                        </button>
                      </div>

                      <div className="space-y-4">
                        <select value={callVariant} onChange={(e) => setCallVariant(e.target.value as CallPrepVariant)} className="w-full hc-clay-inset px-5 py-4 text-[11px] font-black uppercase text-hc-text shadow-inner">
                           <option value="message">WhatsApp / Intercept</option>
                           <option value="coaching">Supportive Call Script</option>
                        </select>
                        <button onClick={copyCoachingMessage} className={`w-full py-5 rounded-2xl flex items-center justify-center gap-4 transition-all font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl ${coachCopied ? 'bg-flag-green text-hc-bg' : 'bg-hc-teal text-hc-bg hover:brightness-110'}`}>
                          {coachCopied ? <CheckCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                          {coachCopied ? 'Message Copied' : 'Dispatch & Log Evidence'}
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            ) : (
              <div className="hc-clay-raised p-16 flex flex-col items-center justify-center h-full opacity-40 text-center sticky top-10 bg-hc-bg/30">
                <MessageSquare className="w-16 h-16 text-hc-text mb-8" strokeWidth={2.5} />
                <div className="text-[12px] font-black text-hc-text uppercase tracking-[0.4em] mb-4">Command Awaiting Input</div>
                <p className="text-[11px] text-hc-text font-black uppercase tracking-widest leading-loose">Select personnel record from the matrix to initialize coaching studio.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-16 hc-clay-raised overflow-hidden mb-20 border border-hc-muted/5 shadow-2xl">
        <div className="px-8 py-6 bg-black/[0.03] border-b border-hc-muted/10 flex items-center justify-between">
           <div className="flex items-center gap-4">
            <History className="w-5 h-5 text-hc-text" />
            <span className="text-[11px] font-black tracking-[0.3em] text-hc-text uppercase">Diagnostic Follow-up Trail</span>
          </div>
          <button onClick={exportMonitoringPack} className="flex items-center gap-3 px-8 py-3 rounded-2xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-text hover:bg-black/5 transition-all shadow-xl active:scale-95">
             <Download className="w-4 h-4" /> Evidence pack
          </button>
        </div>
        <div className="px-8 py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[500px] overflow-y-auto scrollbar-thin">
          {loadCallOutcomes().map((o) => (
            <div key={o.id} className="p-6 rounded-2xl hc-clay-inset flex flex-col gap-4 group hover:bg-black/[0.02] transition-all shadow-inner">
              <div className="flex justify-between items-center">
                <span className="font-black text-sm text-hc-text uppercase tracking-tighter">{o.carer}</span>
                <span className="text-hc-text text-[10px] font-black tabular-nums opacity-50">{new Date(o.at).toLocaleString('en-GB', {day:'2-digit', month:'2-digit', hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="pill !bg-hc-bg text-hc-teal border border-hc-teal/30 text-[9px] shadow-sm">{o.outcome}</span>
                <div className="text-[11px] text-hc-text font-black truncate italic opacity-80 flex-1 uppercase">"{o.notes}"</div>
              </div>
            </div>
          ))}
          {loadCallOutcomes().length === 0 && <div className="text-[11px] font-black text-hc-text opacity-40 col-span-full text-center py-20 uppercase tracking-[0.4em]">No clinical evidence logged.</div>}
        </div>
      </div>
    </div>
  );
}
