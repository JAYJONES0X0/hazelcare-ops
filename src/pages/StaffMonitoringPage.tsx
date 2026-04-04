import { useMemo, useState, useCallback, useEffect } from 'react';
import type { WeekSummary } from '../lib/types';
import type { Page } from '../App';
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
} from '../lib/staff-monitoring-store';
import { mergeMonitoringIntoTemplateContext, type MonitoringTemplateContext } from '../lib/staff-monitoring-template-context';
import {
  downloadText,
  careEntriesToEvidenceCsv,
  buildCoordinatorReadme,
  buildCoordinatorEvidenceHtml,
  buildCoordinatorPackMeta,
} from '../lib/coordinator-export-pack';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
  generateStaffLink: (toolId: string) => Promise<{ link: string; code: string }>;
}

export function StaffMonitoringPage({ weekData, setPage, generateStaffLink }: Props) {
  const def = useMemo(() => defaultMondayWindow(), []);
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

  return (
    <div className="p-6 lg:p-10 w-full max-w-[1700px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter text-shimmer">Staff Intelligence</h1>
          <p className="text-hc-muted text-sm font-medium mt-1">
            House and documentation monitoring — Monday 9am flow, hourly refresh, call prep, staff tools.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPage('upload')}
            className="px-4 py-2 rounded-xl btn-gradient text-[10px] font-black uppercase tracking-wide"
          >
            Sync Data
          </button>
          <button
            type="button"
            onClick={() => {
              onRecompute();
              setPage('templates');
            }}
            className="px-4 py-2 rounded-xl glass-light border border-white/10 text-[10px] font-black uppercase tracking-wide text-hc-muted hover:text-white"
          >
            Templates (context loaded)
          </button>
        </div>
      </div>

      {/* Header strip */}
      <div className="glass border border-hc-teal/25 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="text-xs text-hc-muted">
          <span className="text-white font-bold">Window:</span> {snapshot.windowLabel}{' '}
          <span className="opacity-50">|</span> <span className="text-white font-bold">Entries in filter:</span>{' '}
          {snapshot.dataFreshness.entryCount}
          {snapshot.dataFreshness.lastEntryDate && (
            <>
              {' '}
              <span className="opacity-50">|</span> <span className="text-white font-bold">Last dated entry:</span>{' '}
              {snapshot.dataFreshness.lastEntryDate}
              {snapshot.dataFreshness.staleHours != null && (
                <span className="text-flag-amber"> (~{snapshot.dataFreshness.staleHours}h ago)</span>
              )}
            </>
          )}
        </div>
        <div className="text-[10px] font-mono text-hc-teal-light">
          Computed: {new Date(snapshot.computedAt).toLocaleString('en-GB')}
        </div>
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

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-hc-muted uppercase">House</span>
          <select
            value={house}
            onChange={(e) => setHouse(e.target.value)}
            className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          >
            {houseOptions.map((h) => (
              <option key={h} value={h}>
                {h === 'all' ? 'All houses' : h}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-hc-muted uppercase">From (DD/MM/YYYY)</span>
          <input
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-hc-muted uppercase">Until</span>
          <input
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => {
              const d = defaultMondayWindow();
              setDateFrom(d.dateFrom);
              setDateTo(d.dateTo);
            }}
            className="w-full px-3 py-2 rounded-xl border border-hc-teal/40 text-hc-teal-light text-[10px] font-black uppercase"
          >
            Friday → today
          </button>
        </div>
      </div>

      {/* Export recommendations */}
      <div className="glass-light border border-white/10 rounded-2xl p-4 mb-6">
        <div className="text-xs font-black text-white uppercase tracking-wide mb-2">What to export next (CarePlanner)</div>
        <ul className="space-y-2 text-[11px] text-hc-muted">
          {exportHints.map((h) => (
            <li key={h.id}>
              <span className="text-hc-teal-light font-semibold">{h.label}:</span> {h.detail}
              <div className="text-[10px] opacity-70 mt-0.5">Hint: {h.carePlannerHint}</div>
            </li>
          ))}
        </ul>
      </div>

      {!weekData && (
        <div className="glass border border-flag-amber/30 rounded-2xl p-8 text-center text-hc-muted">
          No diary data yet. Use <button type="button" className="text-hc-teal-light underline" onClick={() => setPage('upload')}>Sync Data</button> to import Client Diary CSV/PDF.
        </div>
      )}

      {weekData && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Houses */}
          <div className="space-y-3">
            <div className="section-header text-xs opacity-90 uppercase tracking-[0.08em]">House health</div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin">
              {snapshot.houses.map((h) => (
                <button
                  key={h.name}
                  type="button"
                  onClick={() => setHouse(h.name)}
                  className={`w-full text-left glass-light border rounded-xl p-3 transition-all ${
                    house === h.name ? 'border-hc-teal/50 bg-hc-teal/10' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="text-sm font-black text-white">{h.name}</div>
                  <div className="text-[10px] text-hc-muted mt-1">
                    Entries {h.entryCount} · Staff {h.staffCount} · Avg quality {h.avgQuality}
                    {h.tierWorst && (
                      <span className="text-flag-amber"> · Tier {h.tierWorst} escalation</span>
                    )}
                  </div>
                  <div className="text-[10px] text-hc-muted">R/A flags {h.redFlags}/{h.amberFlags}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Staff leaderboard */}
          <div className="space-y-3">
            <div className="section-header text-xs opacity-90 uppercase tracking-[0.08em]">Staff quality</div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin">
              {snapshot.staff.map((s) => (
                <div
                  key={s.carer}
                  className="glass-light border border-white/10 rounded-xl p-3 text-[11px]"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-white">{s.carer}</span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded ${
                        s.qualityScore >= 70 ? 'bg-flag-green/20 text-flag-green' : s.qualityScore >= 45 ? 'bg-flag-amber/20 text-flag-amber' : 'bg-flag-red/20 text-flag-red'
                      }`}
                    >
                      {s.qualityScore}
                    </span>
                  </div>
                  <div className="text-hc-muted mt-1">
                    {s.entryCount} notes · avg {s.avgEntryChars} chars · {Math.round(s.shortEntryRatio * 100)}% short · R{s.redCount} A{s.amberCount}
                  </div>
                  {s.tier && <div className="text-flag-amber text-[10px] mt-1">Tier {s.tier}: {s.reasons[0]}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Escalations + call prep */}
          <div className="space-y-3">
            <div className="section-header text-xs opacity-90 uppercase tracking-[0.08em]">Escalations & call prep</div>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              {snapshot.escalations.length === 0 && (
                <div className="text-[11px] text-hc-muted">No tiered escalations for this filter.</div>
              )}
              {snapshot.escalations.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelectedEscId(e.id)}
                  className={`w-full text-left rounded-xl p-3 border text-[11px] ${
                    selectedEscId === e.id ? 'border-hc-teal/50 bg-hc-teal/10' : 'border-white/10 glass-light'
                  }`}
                >
                  <span className="text-flag-red font-black">T{e.tier}</span> {e.carer} — {e.summary}
                </button>
              ))}
            </div>

            {selectedEsc && script && (
              <div className="glass border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={callVariant}
                    onChange={(e) => setCallVariant(e.target.value as CallPrepVariant)}
                    className="bg-hc-dark/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                  >
                    <option value="coaching">Coaching</option>
                    <option value="urgent">Urgent</option>
                    <option value="support">Support-first</option>
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

            <button
              type="button"
              onClick={exportMonitoringPack}
              className="w-full py-3 rounded-xl glass-light border border-white/10 text-[10px] font-black uppercase text-white"
            >
              Download evidence pack (CSV + readme + HTML)
            </button>
            <button type="button" onClick={onRecompute} className="w-full py-2 text-[10px] text-hc-muted uppercase">
              Save run & push template context
            </button>
          </div>
        </div>
      )}

      {/* Recent outcomes */}
      <div className="mt-8 glass-light border border-white/5 rounded-2xl p-4">
        <div className="text-xs font-black text-white uppercase mb-2">Recent call outcomes</div>
        <div className="space-y-1 max-h-32 overflow-y-auto text-[10px] text-hc-muted">
          {loadCallOutcomes()
            .slice(0, 8)
            .map((o) => (
              <div key={o.id}>
                {new Date(o.at).toLocaleString('en-GB')} — {o.carer}: {o.outcome}
                {o.notes && ` — ${o.notes}`}
              </div>
            ))}
          {loadCallOutcomes().length === 0 && <span className="opacity-50">None logged yet.</span>}
        </div>
      </div>
    </div>
  );
}
