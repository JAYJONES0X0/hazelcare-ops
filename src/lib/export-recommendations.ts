import type { StaffMonitoringSnapshot } from './staff-monitoring';

export interface ExportRecommendation {
  id: string;
  label: string;
  detail: string;
  sourceSystemHint: string;
}

export function buildExportRecommendations(snapshot: StaffMonitoringSnapshot): ExportRecommendation[] {
  const out: ExportRecommendation[] = [];
  const { dataFreshness, staff, escalations, filters } = snapshot;

  if (dataFreshness.entryCount === 0) {
    out.push({
      id: 'diary-full',
      label: 'Client Diary (full window)',
      detail: 'No entries in the current filter — import a Client Diary CSV/PDF for the selected dates.',
      sourceSystemHint: 'Source records: run the Client Diary report for the date range, then export CSV or PDF.',
    });
    return out;
  }

  if ((dataFreshness.staleHours ?? 0) > 4) {
    out.push({
      id: 'refresh-hourly',
      label: 'Re-export diary (last few hours)',
      detail: `Latest diary activity looks stale (~${dataFreshness.staleHours}h since last dated entry). Export the latest "today" diary window from the source record system.`,
      sourceSystemHint: 'Source records: narrow the diary date to today / last shift, include all types, then export CSV.',
    });
  }

  const weakAttribution = staff.filter((s) => s.carer === 'Unknown' || s.entryCount > 0 && s.carer.length < 3);
  if (weakAttribution.length > 0) {
    out.push({
      id: 'carer-report',
      label: 'Carer roster / Stats by carer',
      detail: 'Some rows may lack clear carer names in parsed data — cross-check with a carer report export.',
      sourceSystemHint: 'Source records: export a carer report, stats-by-carer report, or carer roster if available.',
    });
  }

  const incidentHeavy = escalations.filter((e) => e.tier >= 2);
  if (incidentHeavy.length > 0) {
    out.push({
      id: 'incident-types',
      label: 'Client Diary filtered by incident types',
      detail: 'Escalations suggest reviewing incident / medication / safeguarding entry types.',
      sourceSystemHint: 'Source records: filter diary entries by incident, medication, safeguarding, or equivalent entry types for the same date window.',
    });
  }

  if (filters.house !== 'all') {
    out.push({
      id: 'house-diary',
      label: `House-scoped diary: ${filters.house}`,
      detail: 'Confirm all entries for this house are included in the export using the available house, region, or user filters.',
      sourceSystemHint: 'Source records: set house/region filters if supported, then export CSV.',
    });
  }

  if (out.length === 0) {
    out.push({
      id: 'routine',
      label: 'Routine refresh',
      detail: 'Data looks recent. Optional: export Client Diary CSV each shift for continuous merge in Sync Data.',
      sourceSystemHint: 'Source records: repeat the usual weekly diary export window, include all entry types, then export CSV.',
    });
  }

  return out;
}
