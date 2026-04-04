import type { CareEntry, WeekSummary } from './types';

export type EscalationTier = 1 | 2 | 3;

export interface MonitoringFilters {
  house: string | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface StaffScorecard {
  carer: string;
  house: string | 'multiple';
  entryCount: number;
  avgEntryChars: number;
  shortEntryCount: number;
  shortEntryRatio: number;
  redCount: number;
  amberCount: number;
  qualityScore: number;
  tier: EscalationTier | null;
  reasons: string[];
}

export interface HouseHealth {
  name: string;
  entryCount: number;
  staffCount: number;
  avgQuality: number;
  redFlags: number;
  amberFlags: number;
  tierWorst: EscalationTier | null;
}

export interface EscalationItem {
  id: string;
  tier: EscalationTier;
  house: string;
  carer: string;
  summary: string;
  reasons: string[];
  suggestedTool: 'notes' | 'handover' | 'actions' | 'incidents';
}

export interface StaffMonitoringSnapshot {
  computedAt: string;
  windowLabel: string;
  filters: MonitoringFilters;
  staff: StaffScorecard[];
  houses: HouseHealth[];
  escalations: EscalationItem[];
  dataFreshness: { lastEntryDate?: string; entryCount: number; staleHours?: number };
}

const SHORT_LEN = 90;
const VERY_SHORT = 40;

function parseDateMs(s: string | undefined): number | null {
  if (!s?.trim()) return null;
  const uk = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) {
    const d = Number(uk[1]);
    const m = Number(uk[2]) - 1;
    const y = Number(uk[3]);
    const t = new Date(y, m, d).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const iso = Date.parse(s);
  return Number.isNaN(iso) ? null : iso;
}

export function flattenWeekEntries(week: WeekSummary): CareEntry[] {
  const map = new Map<string, CareEntry>();
  for (const h of Object.values(week.houses)) {
    for (const e of h.entries) {
      map.set(e.id, e);
    }
  }
  return [...map.values()];
}

export function filterEntries(entries: CareEntry[], f: MonitoringFilters): CareEntry[] {
  let out = entries;
  if (f.house && f.house !== 'all') {
    const h = f.house.trim().toLowerCase();
    out = out.filter((e) => {
      const hn = e.house?.trim().toLowerCase() || '';
      return hn.includes(h) || h.includes(hn);
    });
  }
  const fromMs = f.dateFrom ? parseDateMs(f.dateFrom) : null;
  const toMs = f.dateTo ? parseDateMs(f.dateTo) : null;
  if (fromMs !== null || toMs !== null) {
    out = out.filter((e) => {
      const t = parseDateMs(e.date);
      if (t === null) return true;
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs + 86400000 - 1) return false;
      return true;
    });
  }
  return out;
}

function tierForStaff(
  shortRatio: number,
  avgChars: number,
  red: number,
  amber: number,
  entryCount: number,
): { tier: EscalationTier | null; reasons: string[] } {
  const reasons: string[] = [];
  let tier: EscalationTier | null = null;

  if (entryCount >= 1 && avgChars < VERY_SHORT) {
    reasons.push('Notes are extremely short on average; likely insufficient detail.');
    tier = 3;
  } else if (shortRatio >= 0.45 && entryCount >= 2) {
    reasons.push('High proportion of very short notes.');
    tier = tier && tier > 2 ? tier : 2;
  } else if (shortRatio >= 0.25 && entryCount >= 3) {
    reasons.push('Several notes below documentation length expectation.');
    tier = tier && tier > 1 ? tier : 1;
  }

  if ((red > 0 || amber > 0) && avgChars < SHORT_LEN && entryCount >= 1) {
    reasons.push('Severity flags present but narrative detail looks thin.');
    tier = tier && tier > 2 ? tier : 2;
  }

  if (entryCount === 0) {
    return { tier: null, reasons: [] };
  }

  return { tier, reasons };
}

function qualityScore(shortRatio: number, avgChars: number, red: number, amber: number, entryCount: number): number {
  let score = 100;
  score -= Math.min(45, shortRatio * 50);
  score -= Math.min(20, Math.max(0, 200 - avgChars) / 10);
  score -= Math.min(15, red * 3 + amber * 1.5);
  if (entryCount < 2) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeStaffMonitoring(week: WeekSummary | null, filters: MonitoringFilters): StaffMonitoringSnapshot {
  const computedAt = new Date().toISOString();
  if (!week || week.totalEntries === 0) {
    return {
      computedAt,
      windowLabel: week ? `${week.dateFrom} – ${week.dateTo}` : 'No data',
      filters,
      staff: [],
      houses: [],
      escalations: [],
      dataFreshness: { entryCount: 0, staleHours: undefined },
    };
  }

  const all = flattenWeekEntries(week);
  const filtered = filterEntries(all, filters);

  const byCarer = new Map<string, CareEntry[]>();
  for (const e of filtered) {
    const c = (e.carer || 'Unknown').trim() || 'Unknown';
    if (!byCarer.has(c)) byCarer.set(c, []);
    byCarer.get(c)!.push(e);
  }

  const staff: StaffScorecard[] = [];
  for (const [carer, list] of byCarer) {
    const entryCount = list.length;
    const totalChars = list.reduce((s, e) => s + (e.entry?.length || 0), 0);
    const avgEntryChars = entryCount ? totalChars / entryCount : 0;
    const shortEntryCount = list.filter((e) => (e.entry?.length || 0) < SHORT_LEN).length;
    const shortEntryRatio = entryCount ? shortEntryCount / entryCount : 0;
    const redCount = list.filter((e) => e.severity === 'red').length;
    const amberCount = list.filter((e) => e.severity === 'amber').length;
    const houses = new Set(list.map((e) => e.house).filter(Boolean));
    const house = houses.size <= 1 ? [...houses][0] || '—' : 'multiple';
    const { tier, reasons } = tierForStaff(shortEntryRatio, avgEntryChars, redCount, amberCount, entryCount);
    const qs = qualityScore(shortEntryRatio, avgEntryChars, redCount, amberCount, entryCount);
    staff.push({
      carer,
      house,
      entryCount,
      avgEntryChars: Math.round(avgEntryChars),
      shortEntryCount,
      shortEntryRatio: Math.round(shortEntryRatio * 100) / 100,
      redCount,
      amberCount,
      qualityScore: qs,
      tier,
      reasons,
    });
  }

  staff.sort((a, b) => a.qualityScore - b.qualityScore);

  const houseNames = filters.house === 'all' ? Object.keys(week.houses) : [filters.house];
  const houses: HouseHealth[] = houseNames
    .filter((n) => n && week.houses[n])
    .map((name) => {
      const h = week.houses[name];
      const entries = filterEntries(h.entries, { ...filters, house: 'all' });
      const carers = new Set(entries.map((e) => e.carer).filter(Boolean));
      const sc = staff.filter((s) => entries.some((e) => (e.carer || '') === s.carer));
      const avgQ = sc.length ? Math.round(sc.reduce((a, b) => a + b.qualityScore, 0) / sc.length) : 100;
      const tiers = sc.map((s) => s.tier).filter((t): t is EscalationTier => t != null);
      const worst = tiers.length ? (Math.max(...tiers) as EscalationTier) : null;
      return {
        name,
        entryCount: entries.length,
        staffCount: carers.size,
        avgQuality: avgQ,
        redFlags: h.flags.red,
        amberFlags: h.flags.amber,
        tierWorst: worst,
      };
    });

  const escalations: EscalationItem[] = [];
  for (const s of staff) {
    if (!s.tier) continue;
    const suggestedTool: EscalationItem['suggestedTool'] =
      s.redCount > 0 ? 'incidents' : s.amberCount > 1 ? 'handover' : 'notes';
    escalations.push({
      id: `esc-${s.carer}-${s.tier}-${s.qualityScore}`,
      tier: s.tier,
      house: s.house === 'multiple' ? (filters.house === 'all' ? 'All houses' : filters.house) : s.house,
      carer: s.carer,
      summary: `${s.carer}: quality ${s.qualityScore}/100, ${s.entryCount} notes (${Math.round(s.shortEntryRatio * 100)}% short)`,
      reasons: s.reasons,
      suggestedTool,
    });
  }
  escalations.sort((a, b) => b.tier - a.tier);

  let lastMs = 0;
  for (const e of filtered) {
    const t = parseDateMs(e.date);
    if (t !== null && t > lastMs) lastMs = t;
  }
  const staleHours = lastMs ? Math.max(0, (Date.now() - lastMs) / 3600000) : undefined;

  const windowLabel =
    filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom || week.dateFrom} – ${filters.dateTo || week.dateTo}`
      : `${week.dateFrom} – ${week.dateTo}`;

  return {
    computedAt,
    windowLabel,
    filters,
    staff,
    houses,
    escalations,
    dataFreshness: {
      lastEntryDate: lastMs ? new Date(lastMs).toLocaleDateString('en-GB') : undefined,
      entryCount: filtered.length,
      staleHours: staleHours !== undefined ? Math.round(staleHours * 10) / 10 : undefined,
    },
  };
}

export function defaultMondayWindow(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 3 : day === 6 ? 1 : day + 2;
  const fri = new Date(now);
  fri.setDate(now.getDate() - diff);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return { dateFrom: fmt(fri), dateTo: fmt(now) };
}
