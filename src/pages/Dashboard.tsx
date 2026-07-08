import { useState, useEffect, useMemo } from 'react';
import { Activity, Archive, ChevronRight, Shield, Printer, Zap, AlertTriangle, Calendar, RefreshCw, WalletCards } from 'lucide-react';
import type { WeekSummary, Action, Incident, Page, PageContext } from '../lib/types';
import { getEntriesForRangeAsync, getStoreBoundsAsync } from '../lib/entry-store';
import { buildWeekSummary } from '../lib/universal-parser';
import { useCollapseStore } from '../lib/collapse-store';
import { detectClinicalGaps } from '../lib/continuity-engine';
import { loadClients } from '../lib/client-store';
import { ACTION_STATE_LABELS, buildClientPackReviewQueue, buildHouseDailyState, mapActionToOperationalState, reviewStaffSafetyEvidence } from '../lib/operational-spine';
import { buildFinanceOversightSummary, loadFinanceState } from '../lib/client-finance';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page, ctx?: PageContext) => void;
  actions: Action[];
  incidents: Incident[];
}


function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

// Quick preset buttons
const PRESETS = [
  { label: 'Today',    days: 0  },
  { label: '7 Days',   days: 7  },
  { label: '30 Days',  days: 30 },
  { label: '90 Days',  days: 90 },
  { label: 'All Time', days: -1 },
];

function Section({ title, count, children, collapsed, onToggle }: { id: string; title: string; count?: number; children: React.ReactNode; collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <button onClick={onToggle} className="flex items-center justify-between px-2 group">
        <div className="flex items-center gap-6">
          <div className="w-1 h-6 bg-hc-teal rounded-full" />
          <h2 className="text-[12px] font-black text-hc-text uppercase tracking-[0.4em]">{title}</h2>
        </div>
        <div className="flex items-center gap-8">
          {count != null && <div className="text-[11px] font-black text-hc-muted tabular-nums tracking-widest bg-hc-surface-2 px-3 py-1 rounded-lg">{String(count).padStart(3, '0')}</div>}
          <div className={`hc-clay-raised !w-10 !h-10 flex items-center justify-center text-hc-muted transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}>
             <ChevronRight size={16} className="rotate-90" />
          </div>
        </div>
      </button>
      {!collapsed && <div className="animate-in fade-in slide-in-from-top-4 duration-500">{children}</div>}
    </div>
  );
}

export function Dashboard({ weekData, setPage, actions, incidents }: Props) {
  // â”€â”€ Date range state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [storeBounds, setStoreBounds] = useState<{ from: string; to: string; count: number } | null>(null);
  const [dateFrom, setDateFrom] = useState(''); // ISO yyyy-mm-dd
  const [dateTo,   setDateTo]   = useState('');
  const [filteredData, setFilteredData] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalInStore, setTotalInStore] = useState(0);
  const [packReviewRows, setPackReviewRows] = useState(() => buildClientPackReviewQueue(loadClients()));
  const [financeState, setFinanceState] = useState(() => loadFinanceState());
  const packReviewItems = packReviewRows.reduce((sum, row) => sum + row.needsReviewCount, 0);
  const draftPackCount = packReviewRows.filter(row => !row.liveReady).length;
  const financeSummary = useMemo(() => buildFinanceOversightSummary({
    accounts: financeState.accounts,
    receipts: financeState.receipts,
    transactions: financeState.transactions,
    exceptions: financeState.exceptionLog,
  }), [financeState]);
  const financeReviewCount = financeSummary.totals.openExceptions + financeSummary.totals.pendingReviews;

  useEffect(() => {
    const refreshPackQueue = () => setPackReviewRows(buildClientPackReviewQueue(loadClients()));
    refreshPackQueue();
    window.addEventListener('hc-clients-updated', refreshPackQueue);
    window.addEventListener('storage', refreshPackQueue);
    return () => {
      window.removeEventListener('hc-clients-updated', refreshPackQueue);
      window.removeEventListener('storage', refreshPackQueue);
    };
  }, []);

  useEffect(() => {
    const refreshFinanceState = () => setFinanceState(loadFinanceState());
    refreshFinanceState();
    window.addEventListener('hc-client-finance-updated', refreshFinanceState);
    window.addEventListener('storage', refreshFinanceState);
    return () => {
      window.removeEventListener('hc-client-finance-updated', refreshFinanceState);
      window.removeEventListener('storage', refreshFinanceState);
    };
  }, []);

  const {
    collapseAll: collapseAllSections,
    expandAll: expandAllSections,
    allCollapsed: allSectionsCollapsed,
    isCollapsed: isSectionCollapsed,
    toggle: toggleSection,
  } = useCollapseStore('overview-sections');
  
  const SECTION_IDS = ['7-day', 'regional', 'shortcuts'];
  const allCollapsed = allSectionsCollapsed(SECTION_IDS);

  // Load store bounds on mount
  useEffect(() => {
    void (async () => {
      const bounds = await getStoreBoundsAsync();
      if (bounds) {
        setStoreBounds(bounds);
        setTotalInStore(bounds.count);
        // Default to last 30 days
        const to = new Date();
        const from = new Date(); from.setDate(to.getDate() - 30);
        const toISO   = to.toISOString().slice(0, 10);
        const fromISO = from.toISOString().slice(0, 10);
        setDateTo(toISO);
        setDateFrom(fromISO);
      }
    })();
  }, []);

  // Re-query whenever date range changes
  useEffect(() => {
    if (!dateFrom && !dateTo) {
      return;
    }
    let alive = true;
    void (async () => {
      setLoading(true);
      const fromStr = dateFrom ? formatDisplayDate(dateFrom) : null;
      const toStr   = dateTo   ? formatDisplayDate(dateTo)   : null;
      const entries = await getEntriesForRangeAsync(fromStr, toStr);
      if (!alive) return;
      if (entries.length > 0) {
        setFilteredData(buildWeekSummary(entries));
      } else if (weekData) {
        // Fall back to the passed-in weekData if IDB is empty (first import)
        setFilteredData(weekData);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [dateFrom, dateTo, weekData]);

  function applyPreset(days: number) {
    if (days === -1) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const to = new Date();
    const from = new Date(); from.setDate(to.getDate() - days);
    setDateTo(to.toISOString().slice(0, 10));
    setDateFrom(from.toISOString().slice(0, 10));
  }

  // â”€â”€ Optimized Metric Aggregation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { houseStats, metrics } = useMemo(() => {
    const d = dateFrom || dateTo ? (filteredData || weekData) : weekData;
    if (!d) return { houseStats: [], metrics: { totalEntries: 0, activeStaff: 0, pendingActions: 0, activeIncidents: 0, totalRedFlags: 0, totalAmberFlags: 0, uniqueClients: 0, gaps: 0, criticalGaps: 0 } };

    const allEntries = Object.values(d.houses).flatMap(h => h.entries);
    const gaps = detectClinicalGaps(allEntries);

    const stats = Object.entries(d.houses).map(([name, houseData]) => {
      const red = houseData.entries.filter(e => e.severity === 'red').length;
       return { name, entries: houseData.entries, red };
    }).sort((a, b) => b.red - a.red || b.entries.length - a.entries.length);

    const computedMetrics = {
      totalEntries: d.totalEntries || 0,
      activeStaff: new Set(Object.values(d.houses).flatMap(h => h.entries.map(e => e.carer))).size,
      pendingActions: actions.filter(a => a.status !== 'completed').length,
      activeIncidents: incidents.filter(i => i.stage !== 'closed').length,
      totalRedFlags: d.allFlags?.red.length || 0,
      totalAmberFlags: d.allFlags?.amber.length || 0,
      uniqueClients: new Set(Object.values(d.houses).flatMap(h => h.entries.map(e => e.client))).size,
      gaps: gaps.length,
      criticalGaps: gaps.filter(g => g.severity === 'red').length
    };

    return { houseStats: stats, metrics: computedMetrics };
  }, [dateFrom, dateTo, filteredData, weekData, actions, incidents]);

  // Active data reference
  const data = dateFrom || dateTo ? (filteredData || weekData) : weekData;
  const dateLabel = dateFrom || dateTo
    ? `${dateFrom ? formatDisplayDate(dateFrom) : '...'} -> ${dateTo ? formatDisplayDate(dateTo) : 'Today'}`
    : 'All Time';
  const commandHouse = houseStats[0]?.name || Object.keys(data?.houses || {})[0] || 'No house selected';
  const houseCommand = useMemo(
    () => buildHouseDailyState({ weekData: data, actions, house: commandHouse, dateLabel }),
    [data, actions, commandHouse, dateLabel]
  );
  const staffSafetyReview = useMemo(
    () => reviewStaffSafetyEvidence({ entries: data?.houses[commandHouse]?.entries || [], house: commandHouse }),
    [data, commandHouse]
  );

  // â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-[2.5rem] hc-clay-inset flex items-center justify-center mb-8 animate-float">
          <Zap className="w-12 h-12 text-hc-teal" />
        </div>
        <h2 className="text-2xl font-black text-hc-text mb-3 uppercase tracking-tight">No Care Records Loaded</h2>
        <p className="text-hc-muted text-[11px] font-bold uppercase tracking-widest mb-10 text-center max-w-xs leading-relaxed">
          Import a clinical file, roster, ZIP pack, or pasted assessment to start the dashboard.
        </p>
        {packReviewRows.length > 0 && (
          <div className="mb-8 w-full max-w-2xl hc-clay-raised rounded-[2rem] p-5 border border-flag-amber/20">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Archive className="w-4 h-4 text-flag-amber" />
              <span className="text-[11px] font-black text-hc-text uppercase tracking-[0.25em]">Client pack review queue active</span>
            </div>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest text-center">
              {draftPackCount} draft pack{draftPackCount === 1 ? '' : 's'} / {packReviewItems} file review item{packReviewItems === 1 ? '' : 's'}
            </p>
          </div>
        )}
        {financeSummary.rows.length > 0 && (
          <div className="mb-8 w-full max-w-2xl hc-clay-raised rounded-[2rem] p-5 border border-purple-500/20">
            <div className="flex items-center justify-center gap-3 mb-2">
              <WalletCards className="w-4 h-4 text-purple-700" />
              <span className="text-[11px] font-black text-hc-text uppercase tracking-[0.25em]">Client money review active</span>
            </div>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest text-center">
              {financeSummary.totals.accounts} account{financeSummary.totals.accounts === 1 ? '' : 's'} / {financeSummary.totals.openExceptions} open exception{financeSummary.totals.openExceptions === 1 ? '' : 's'} / {financeSummary.totals.missingReceipts} missing receipt{financeSummary.totals.missingReceipts === 1 ? '' : 's'}
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => setPage('upload')} className="btn-tactical shadow-2xl">OPEN IMPORT HUB</button>
          {packReviewRows.length > 0 && (
            <button onClick={() => setPage('client-docs')} className="btn-clay shadow-xl px-6 py-3 text-[11px] font-black uppercase tracking-widest">
              Review Client Packs
            </button>
          )}
          {financeSummary.rows.length > 0 && (
            <button onClick={() => setPage('client-finance')} className="btn-clay shadow-xl px-6 py-3 text-[11px] font-black uppercase tracking-widest">
              Review Client Money
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">

      {/* â”€â”€ DATE RANGE CONTROL BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="sticky top-0 z-30 bg-hc-bg/95 backdrop-blur-xl border-b border-hc-border/30 px-6 lg:px-12 py-4">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center gap-4">

          {/* Store stats */}
          {storeBounds && (
            <div className="flex items-center gap-2 mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
              <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">
                {totalInStore.toLocaleString()} Records · {storeBounds.from} to {storeBounds.to}
              </span>
            </div>
          )}

          <div className="h-4 w-px bg-hc-border/40 hidden md:block" />

          {/* Preset buttons */}
          <div className="flex items-center gap-2">
            {PRESETS.map(p => {
              const active =
                p.days === -1 ? !dateFrom && !dateTo :
                p.days === 0  ? dateFrom === new Date().toISOString().slice(0, 10) :
                false;
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.days)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    active
                      ? 'bg-hc-teal text-hc-bone shadow'
                      : 'hc-clay-raised text-hc-muted hover:text-hc-text'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom date inputs */}
          <div className="flex items-center gap-2 ml-auto">
            <Calendar size={12} className="text-hc-muted" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="hc-clay-inset px-3 py-1.5 text-[11px] font-black text-hc-text rounded-lg outline-none border border-hc-border/20 focus:border-hc-teal/50 transition-all"
            />
            <span className="text-[11px] text-hc-muted font-black">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="hc-clay-inset px-3 py-1.5 text-[11px] font-black text-hc-text rounded-lg outline-none border border-hc-border/20 focus:border-hc-teal/50 transition-all"
            />
            {loading && <RefreshCw size={12} className="text-hc-teal animate-spin" />}
          </div>

        </div>
      </div>

      {/* â”€â”€ MAIN CONTENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="p-6 lg:p-12 max-w-[1800px] mx-auto space-y-12">

        {/* -- SERVICE OVERVIEW HEADER -- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-hc-border pb-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="pill pill-teal text-[10px]">MEADOWVIEW CARE · OVERVIEW</span>
              <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
              <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">LIVE · {dateLabel}</span>
            </div>
            <h1 className="text-5xl font-black text-hc-text tracking-tighter uppercase leading-none">Service Overview</h1>
          </div>
          <div className="flex gap-4">
            <button onClick={() => allCollapsed ? expandAllSections(SECTION_IDS) : collapseAllSections(SECTION_IDS)} className="hc-clay-raised px-6 py-3 text-[11px] font-black text-hc-text hover:text-hc-teal transition-all rounded-xl uppercase tracking-widest">
              {allCollapsed ? 'Expand' : 'Collapse'}
            </button>
            <button onClick={() => setPage('briefing')} className="px-6 py-3 hc-clay-raised text-[11px] font-black uppercase text-hc-text hover:text-hc-teal transition-all rounded-xl">Daily Briefing</button>
            <button onClick={() => setPage('staff-monitoring')} className="px-6 py-3 bg-hc-teal text-hc-bone text-[11px] font-black uppercase tracking-widest rounded-xl shadow-xl hover:scale-105 transition-all">Staff Monitoring</button>
          </div>
        </div>

        {packReviewRows.length > 0 && (
          <div className="hc-clay-raised border border-flag-amber/20 p-5 rounded-2xl flex flex-col xl:flex-row xl:items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-flag-amber/10 flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5 text-flag-amber" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black text-hc-text uppercase tracking-[0.25em]">Client pack review queue</div>
              <p className="text-[11px] text-hc-muted font-semibold mt-1">
                {draftPackCount} draft pack{draftPackCount === 1 ? '' : 's'} still need gate review. {packReviewItems} imported file review item{packReviewItems === 1 ? '' : 's'} remain visible.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {packReviewRows.slice(0, 3).map(row => (
                <span key={`${row.clientName}-${row.packId}`} className="pill pill-amber text-[8px] font-black uppercase tracking-widest">
                  {row.clientName}: {row.needsReviewCount} review
                </span>
              ))}
            </div>
            <button onClick={() => setPage('client-docs')} className="btn-tactical rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest">
              Review Packs
            </button>
          </div>
        )}

        {financeSummary.rows.length > 0 && (
          <div className={`hc-clay-raised p-5 rounded-2xl flex flex-col xl:flex-row xl:items-center gap-4 ${
            financeSummary.totals.urgentRows > 0 ? 'border border-flag-red/25' : 'border border-purple-500/20'
          }`}>
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <WalletCards className="w-5 h-5 text-purple-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black text-hc-text uppercase tracking-[0.25em]">Client money review queue</div>
              <p className="text-[11px] text-hc-muted font-semibold mt-1">
                {financeSummary.totals.openExceptions} open exception{financeSummary.totals.openExceptions === 1 ? '' : 's'},
                {' '}{financeSummary.totals.missingReceipts} missing receipt{financeSummary.totals.missingReceipts === 1 ? '' : 's'},
                {' '}and {financeSummary.totals.pendingReviews} record{financeSummary.totals.pendingReviews === 1 ? '' : 's'} needing review.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {financeSummary.rows.slice(0, 3).map(row => (
                <span key={row.accountId} className={`pill text-[8px] font-black uppercase tracking-widest ${row.state === 'urgent' ? 'pill-red' : 'pill-purple'}`}>
                  {row.personName}: {row.nextAction}
                </span>
              ))}
            </div>
            <button onClick={() => setPage('client-finance')} className="btn-tactical rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest">
              Review Money
            </button>
          </div>
        )}

        <div className="hc-clay-raised border border-hc-teal/20 p-6 rounded-[2rem] space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black text-hc-teal uppercase tracking-[0.35em] mb-2">Daily House Command</div>
              <h2 className="text-2xl font-black text-hc-text uppercase tracking-tight">{houseCommand.house}</h2>
              <p className="text-[11px] text-hc-muted font-bold uppercase tracking-widest mt-1">
                {houseCommand.evidenceCount} evidence items · {houseCommand.residentCount} residents · {houseCommand.openActions.length} open actions
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setPage('client-diary', { house: houseCommand.house })} className="btn-tactical rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">
                Review Diaries
              </button>
              <button onClick={() => setPage('handover')} className="btn-clay rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">
                Generate Handover
              </button>
              <button onClick={() => setPage('actions')} className="btn-clay rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">
                Create Action
              </button>
              <button onClick={() => setPage('communications')} className="btn-clay rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">
                Log Contact
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              ['Waiting staff', houseCommand.waitingFeedback.length],
              ['Waiting professionals', houseCommand.waitingProfessionals.length],
              ['Appointments', houseCommand.appointments.length],
              ['Health follow-up', houseCommand.healthFollowUps.length],
              ['Risk/escalation', houseCommand.escalationFlags.length],
              ['Carry forward', houseCommand.carryForwardItems.length],
              ['Missing evidence', houseCommand.missingEvidence.length],
            ].map(([label, value]) => (
              <div key={label} className="hc-clay-inset rounded-2xl p-4">
                <div className="text-xl font-black text-hc-text tabular-nums">{value}</div>
                <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mt-1">{label}</div>
              </div>
            ))}
          </div>

          {staffSafetyReview.reviewRequired && (
            <div className="rounded-2xl border border-flag-red/20 bg-flag-red/5 p-4 flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1">
                <div className="text-[10px] font-black text-flag-red uppercase tracking-[0.25em] mb-2">Staff Safety Review</div>
                <p className="text-[11px] text-hc-text font-semibold leading-relaxed">
                  {staffSafetyReview.categories.length} category signal{staffSafetyReview.categories.length === 1 ? '' : 's'} found from {staffSafetyReview.evidence.length} evidence item{staffSafetyReview.evidence.length === 1 ? '' : 's'}.
                  {' '}This guides review; it does not decide safeguarding, police, or clinical action.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {staffSafetyReview.categories.slice(0, 4).map(category => (
                  <span key={category} className="pill pill-red text-[8px] font-black uppercase tracking-widest">
                    {category.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              <button onClick={() => setPage('client-diary', { house: houseCommand.house })} className="btn-clay rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-flag-red">
                Review Evidence
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-[10px] font-black text-hc-text uppercase tracking-[0.25em] mb-3">Open loops</div>
              <div className="space-y-2">
                {houseCommand.openActions.slice(0, 4).map(action => (
                  <div key={action.id} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-black text-hc-text uppercase truncate">{action.title}</span>
                    <span className="text-hc-muted font-black uppercase shrink-0">{ACTION_STATE_LABELS[mapActionToOperationalState(action)]}</span>
                  </div>
                ))}
                {!houseCommand.openActions.length && <div className="text-[11px] font-bold text-hc-muted">No open actions recorded for this house.</div>}
              </div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-[10px] font-black text-hc-text uppercase tracking-[0.25em] mb-3">Evidence alerts</div>
              <div className="space-y-2">
                {Array.from(
                  new Map(
                    [...houseCommand.escalationFlags, ...houseCommand.healthFollowUps, ...houseCommand.appointments]
                      .map(item => [item.id, item])
                  ).values()
                ).slice(0, 4).map(item => (
                  <div key={item.id} className="text-[11px] font-semibold text-hc-text leading-relaxed">
                    <span className="font-black uppercase text-hc-teal">{item.resident || 'Resident'}:</span> {item.excerpt}
                  </div>
                ))}
                {!houseCommand.evidenceCount && <div className="text-[11px] font-bold text-flag-amber">No diary evidence loaded for this house.</div>}
              </div>
            </div>
          </div>
        </div>

        {/* -- KPI PODS -- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Care Records',         val: metrics.totalEntries.toLocaleString(), sub: 'In Window',         color: 'text-hc-text'    },
            { label: 'Service Users',         val: metrics.uniqueClients,                sub: 'Active Clients',    color: 'text-hc-text'    },
            { label: 'Staff On Shift',        val: metrics.activeStaff,                  sub: 'Active',            color: 'text-hc-text'    },
            { label: 'Care Gaps',             val: metrics.gaps,                         sub: metrics.criticalGaps > 0 ? `${metrics.criticalGaps} Need Review` : 'Up To Date', color: metrics.gaps > 0 ? 'text-flag-amber' : 'text-hc-muted' },
            { label: 'Urgent Concerns',       val: metrics.totalRedFlags,                sub: 'Immediate Action',  color: 'text-flag-red'   },
            { label: 'Active Incidents',      val: metrics.activeIncidents,              sub: 'Safeguarding',      color: 'text-flag-red'   },
            { label: 'Money Review',           val: financeReviewCount,                   sub: financeSummary.totals.missingReceipts > 0 ? `${financeSummary.totals.missingReceipts} Missing Receipt${financeSummary.totals.missingReceipts === 1 ? '' : 's'}` : 'Financial Evidence', color: financeReviewCount > 0 ? 'text-purple-700' : 'text-hc-muted' },
          ].map(s => (
            <div key={s.label} className="hc-clay-raised p-6 flex flex-col gap-3 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest leading-tight">{s.label}</div>
              <div className={`text-3xl font-black tabular-nums tracking-tighter ${s.color}`}>{s.val}</div>
              <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* â”€â”€ ENTRY TYPE VECTOR FEED â”€â”€ */}
        {data.entryTypes && Object.keys(data.entryTypes).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-black text-hc-muted uppercase tracking-[0.4em] px-2">Record Type Distribution</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {Object.entries(data.entryTypes)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const max = Math.max(...Object.values(data.entryTypes!));
                  const pct = Math.round((count / max) * 100);
                  return (
                    <div key={type} className="hc-clay-raised flex-shrink-0 px-5 py-4 rounded-2xl flex flex-col gap-2 min-w-[130px]">
                      <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest leading-tight truncate">{type}</div>
                      <div className="text-xl font-black text-hc-text tabular-nums">{count.toLocaleString()}</div>
                      <div className="w-full h-1 rounded-full bg-hc-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-hc-teal transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* â”€â”€ AMBER FLAG SUMMARY STRIP â”€â”€ */}
        {metrics.totalAmberFlags > 0 && (
          <div className="hc-clay-raised border border-flag-amber/20 p-4 rounded-xl flex items-center gap-4">
            <AlertTriangle size={16} className="text-flag-amber flex-shrink-0" />
            <span className="text-[11px] font-black text-hc-text uppercase tracking-widest">
              {metrics.totalAmberFlags} amber alert{metrics.totalAmberFlags !== 1 ? 's' : ''} require review in selected window
            </span>
            <button onClick={() => setPage('client-diary', { severity: 'amber' })} className="ml-auto text-[10px] font-black text-flag-amber uppercase tracking-widest hover:underline">
              Review →
            </button>
          </div>
        )}

        {/* â”€â”€ 7-DAY PERSISTENCE MATRIX â”€â”€ */}
        {(() => {
          // Collect all unique dates across all houses, sorted descending, last 7
          const allEntries = Object.values(data.houses).flatMap(h => h.entries);
          const dateSet = new Set(allEntries.map(e => e.date));
          const sortedDates = Array.from(dateSet)
            .sort((a, b) => {
              // DD/MM/YYYY â†’ compare as date
              const [ad, am, ay] = a.split('/'); const [bd, bm, by] = b.split('/');
              return new Date(`${by}-${bm}-${bd}`).getTime() - new Date(`${ay}-${am}-${ad}`).getTime();
            })
            .slice(-7);

          if (sortedDates.length === 0) return null;

          const maxCount = Math.max(1, ...houseStats.map(h =>
            Math.max(1, ...sortedDates.map(d => h.entries.filter(e => e.date === d).length))
          ));

          return (
            <Section id="7-day" title="7-Day Activity" collapsed={isSectionCollapsed('7-day')} onToggle={() => toggleSection('7-day')}>
              <div className="hc-clay-raised p-6 rounded-[2.25rem] overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[9px] font-black text-hc-muted uppercase tracking-widest pb-4 pr-4 w-32">Unit</th>
                      {sortedDates.map(d => (
                        <th key={d} className="text-center text-[9px] font-black text-hc-muted uppercase tracking-widest pb-4 px-2">
                          {d.slice(0, 5)}
                        </th>
                      ))}
                      <th className="text-right text-[9px] font-black text-hc-muted uppercase tracking-widest pb-4 pl-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {houseStats.map(h => (
                      <tr key={h.name} className="group">
                        <td className="pr-4 py-2">
                          <span className="text-[11px] font-black text-hc-text uppercase tracking-tight group-hover:text-hc-teal transition-colors">{h.name}</span>
                        </td>
                        {sortedDates.map(d => {
                          const cnt = h.entries.filter(e => e.date === d).length;
                          const intensity = cnt === 0 ? 0 : Math.max(0.12, cnt / maxCount);
                          return (
                            <td key={d} className="px-2 py-2 text-center">
                              <div
                                className="mx-auto w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black transition-all"
                                style={{
                                  background: cnt === 0
                                    ? 'var(--hc-surface-2)'
                                    : intensity >= 1
                                      ? '#f3efe0'
                                      : `rgba(76, 124, 124, ${Math.max(0.25, intensity)})`,
                                  color: cnt === 0
                                    ? 'var(--hc-muted)'
                                    : intensity >= 1
                                      ? '#0d2d2d'
                                      : '#f3efe0',
                                }}
                              >
                                {cnt === 0 ? '·' : cnt}
                              </div>
                            </td>
                          );
                        })}
                        <td className="pl-4 py-2 text-right">
                          <span className="text-[11px] font-black text-hc-text tabular-nums">{h.entries.length}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          );
        })()}

        {/* â”€â”€ REGIONAL OPERATIONS MATRIX â”€â”€ */}
        <Section id="regional" title="Service Overview" count={houseStats.length} collapsed={isSectionCollapsed('regional')} onToggle={() => toggleSection('regional')}>

          {houseStats.length === 0 ? (
            <div className="hc-clay-raised rounded-2xl p-12 text-center">
              <p className="text-[11px] font-black text-hc-muted uppercase tracking-widest">No data for selected range — try widening the date window</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {houseStats.map(h => (
                <div
                  key={h.name}
                  onClick={() => setPage('client-diary', { house: h.name })}
                  className="hc-clay-raised p-6 rounded-[2.25rem] flex flex-col gap-5 group cursor-pointer hover:shadow-2xl transition-all relative overflow-hidden border border-hc-border/5 hover:border-hc-teal/20"
                >
                  {h.red > 0 && <div className="absolute top-0 right-0 w-24 h-24 bg-flag-red/5 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2" />}
                  <div className="flex items-center justify-between relative z-10">
                    <h3 className="text-sm font-black text-hc-text uppercase tracking-tight group-hover:text-hc-teal transition-colors">{h.name}</h3>
                    <div className={`w-2 h-2 rounded-full ${h.red > 0 ? 'bg-flag-red animate-pulse shadow-[0_0_8px_#d94e4e]' : 'bg-flag-green'}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="hc-clay-inset p-4 flex flex-col items-center gap-1 rounded-xl">
                      <span className="text-[9px] font-black text-hc-muted uppercase opacity-60">Records</span>
                      <span className="text-2xl font-black text-hc-text tabular-nums">{h.entries.length}</span>
                    </div>
                    <div className={`hc-clay-inset p-4 flex flex-col items-center gap-1 rounded-xl transition-all ${h.red > 0 ? 'bg-flag-red/5' : ''}`}>
                      <span className="text-[9px] font-black text-hc-muted uppercase opacity-60">Red Flags</span>
                      <span className={`text-2xl font-black tabular-nums ${h.red > 0 ? 'text-flag-red' : 'text-hc-muted'}`}>{h.red}</span>
                    </div>
                  </div>
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-60">
                      {new Set(h.entries.map(e => e.client)).size} clients
                    </span>
                    <ChevronRight size={14} className="text-hc-muted group-hover:text-hc-teal group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* â”€â”€ COMMAND VECTOR SHORTCUTS â”€â”€ */}
        <Section id="shortcuts" title="Quick Actions" collapsed={isSectionCollapsed('shortcuts')} onToggle={() => toggleSection('shortcuts')}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {[
              { label: 'Staff Monitoring',    desc: 'Cover & wellbeing',      icon: <Activity />,      id: 'staff-monitoring' },
              { label: 'Incidents',           desc: 'Active concerns',        icon: <AlertTriangle />, id: 'incidents'        },
              { label: 'Action Log',          desc: 'Tasks to follow up',     icon: <Zap />,           id: 'actions'          },
              { label: 'Training & DBS',      desc: 'Staff compliance'     ,   icon: <Shield />,        id: 'compliance'       },
              { label: 'Reports',             desc: 'Export & audit packs',   icon: <Printer />,       id: 'reports'          },
            ].map(btn => (
              <div
                key={btn.label}
                onClick={() => setPage(btn.id as Page)}
                className="hc-clay-raised p-8 rounded-[2rem] flex flex-col gap-8 group cursor-pointer hover:translate-y-[-4px] transition-all border border-hc-border/5 hover:border-hc-teal/20"
              >
                <div className="w-14 h-14 rounded-2xl hc-clay-inset flex items-center justify-center text-hc-teal transition-transform group-hover:scale-110">
                  {btn.icon}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-black text-hc-text uppercase tracking-wider group-hover:text-hc-teal transition-colors">{btn.label}</div>
                  <div className="flex items-center justify-between text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                    {btn.desc}
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
