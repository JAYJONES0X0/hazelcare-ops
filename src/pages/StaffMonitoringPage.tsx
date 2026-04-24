import { useMemo, useState, useCallback } from 'react';
import type { WeekSummary, CareEntry, StaffMember } from '../lib/types';
import { useCollapseStore } from '../lib/collapse-store';
import {
  computeStaffMonitoring,
  defaultMondayWindow,
  flattenWeekEntries,
  type MonitoringFilters,
} from '../lib/staff-monitoring';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { RefreshCw, ChevronRight, Activity, MessageSquare, History, FileText } from 'lucide-react';
import { extractFileText } from '../lib/universal-extractor';

interface Props {
  weekData: WeekSummary | null;
  onDataParsed: (data: WeekSummary) => void;
  staff: StaffMember[];
}

export function StaffMonitoringPage({ weekData, onDataParsed }: Props) {
  const def = useMemo(() => defaultMondayWindow(), []);

  const [importLoading, setImportLoading] = useState(false);
  const [importDragging, setImportDragging] = useState(false);

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

  const [house] = useState<string>('all');
  const [dateFrom] = useState(def.dateFrom);
  const [dateTo] = useState(def.dateTo);

  const { isCollapsed, toggle, expandAll, collapseAll, allCollapsed } = useCollapseStore('staff-monitoring-cards');

  const filters: MonitoringFilters = useMemo(() => ({ house, dateFrom, dateTo }), [house, dateFrom, dateTo]);
  const snapshot = useMemo(() => computeStaffMonitoring(weekData, filters), [weekData, filters]);

  const [coachStaff, setCoachStaff] = useState<string | null>(null);

  const STAFF_IDS = useMemo(() => snapshot.staff.map(s => s.carer), [snapshot.staff]);

  return (
    <div className="p-6 lg:p-10 w-full max-w-[2560px] mx-auto animate-in fade-in duration-500"
      onDragOver={e => { e.preventDefault(); setImportDragging(true); }}
      onDragLeave={() => setImportDragging(false)}
      onDrop={e => { e.preventDefault(); setImportDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleImportFile(f); }}
    >
      {importDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-hc-bone/90 backdrop-blur-md border-[8px] border-dashed border-hc-teal/30">
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
          <p className="text-hc-text text-[11px] font-bold mt-3 max-w-2xl leading-relaxed uppercase tracking-wider">Clinical analysis of diary exports Â· Scored to protect registration.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => allCollapsed(STAFF_IDS) ? expandAll(STAFF_IDS) : collapseAll(STAFF_IDS)} className="px-6 py-3.5 rounded-2xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-text hover:text-hc-teal transition-all shadow-xl active:hc-clay-pressed">
            {allCollapsed(STAFF_IDS) ? 'Expand All Units' : 'Collapse All Matrix'}
          </button>
          <button type="button" onClick={() => document.getElementById('daily-sync-input')?.click()} disabled={importLoading}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl btn-tactical text-[11px] font-black cursor-pointer shadow-2xl">
            <RefreshCw className={`w-4 h-4 ${importLoading ? 'animate-spin' : ''}`} />
            {importLoading ? 'Analysingâ€¦' : 'Sync daily CSV'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Intelligence Window', value: snapshot.windowLabel, icon: <Activity className="w-4 h-4" /> },
          { label: 'Scored Entries', value: String(snapshot.dataFreshness.entryCount), icon: <FileText className="w-4 h-4" /> },
          { label: 'Clinical Freshness', value: snapshot.dataFreshness.lastEntryDate || 'â€”', icon: <RefreshCw className="w-4 h-4" /> },
          { label: 'Snapshot Time', value: new Date(snapshot.computedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), icon: <History className="w-4 h-4" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="hc-clay-raised px-8 py-6 relative overflow-hidden group/stat transition-all hover:translate-y-[-2px]">
            <div className="absolute top-0 right-0 p-6 opacity-5 text-hc-teal">{icon}</div>
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] mb-3">{label}</div>
            <div className={`text-xl font-black text-hc-text truncate tracking-tighter tabular-nums`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-10">
        <div className="flex-1 flex flex-col gap-10">
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-4 mb-6">
              <div className="w-2.5 h-2.5 rounded-full bg-flag-amber glow-amber" />
              <h2 className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em]">Critical Review Â· {snapshot.staff.length}</h2>
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
                            <div className="text-base font-black text-hc-text uppercase leading-none mb-2 group-hover:text-hub-teal transition-colors">{s.carer}</div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {s.categoryBreakdown.map(({ category, count }) => (
                                <span key={category} className="pill pill-teal !bg-hc-bg border-hc-teal/20 text-[9px]">
                                  {count}Ã— {category.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-10">
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
                              className="px-8 py-3.5 rounded-2xl btn-tactical shadow-2xl">Contextual Coaching Â· Summarise Â»</button>
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
          {coachStaff ? (
            <div className="hc-clay-raised p-8 sticky top-10 animate-in slide-in-from-right-8 duration-700">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl hc-clay-inset flex items-center justify-center text-xl font-black text-hc-teal">{coachStaff.charAt(0)}</div>
                    <div>
                      <h2 className="text-xl font-black text-hc-text uppercase leading-none mb-1.5">{coachStaff}</h2>
                      <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em]">Contextual Studio</p>
                    </div>
                  </div>
                  <button onClick={() => setCoachStaff(null)} className="w-10 h-10 rounded-xl hc-clay-raised flex items-center justify-center text-hc-muted hover:text-flag-red transition-all">âœ•</button>
               </div>
               <div className="text-center py-20 opacity-30 text-[10px] font-black uppercase tracking-widest">Coaching Interface Hardware Ready</div>
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
