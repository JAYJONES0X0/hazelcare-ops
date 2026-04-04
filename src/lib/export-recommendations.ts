import type { StaffMonitoringSnapshot } from './staff-monitoring';

export interface ExportRecommendation {
  id: string;
  label: string;
  detail: string;
  carePlannerHint: string;
}

export function buildExportRecommendations(snapshot: StaffMonitoringSnapshot): ExportRecommendation[] {
  const out: ExportRecommendation[] = [];
  const { dataFreshness, staff, escalations, filters } = snapshot;

  if (dataFreshness.entryCount === 0) {
    out.push({
      id: 'diary-full',
      label: 'Client Diary (full window)',
      detail: 'No entries in the current filter — import a Client Diary CSV/PDF for the selected dates.',
      carePlannerHint: 'Reports → Client Reports → Diary → run for date range, export CSV or PDF.',
    });
    return out;
  }

  if ((dataFreshness.staleHours ?? 0) > 4) {
    out.push({
      id: 'refresh-hourly',
      label: 'Re-export diary (last few hours)',
      detail: `Latest diary activity looks stale (~${dataFreshness.staleHours}h since last dated entry). Export again from CarePlanner for “today”.`,
      carePlannerHint: 'Client Diary: narrow date to today / last shift, All types, Run report → CSV.',
    });
  }

  const weakAttribution = staff.filter((s) => s.carer === 'Unknown' || s.entryCount > 0 && s.carer.length < 3);
  if (weakAttribution.length > 0) {
    out.push({
      id: 'carer-report',
      label: 'Carer roster / Stats by carer',
      detail: 'Some rows may lack clear carer names in parsed data — cross-check with a carer report export.',
      carePlannerHint: 'Reports → Carer Reports → Stats by carer or Carer roster (Excel if available).',
    });
  }

  const incidentHeavy = escalations.filter((e) => e.tier >= 2);
  if (incidentHeavy.length > 0) {
    out.push({
      id: 'incident-types',
      label: 'Client Diary filtered by incident types',
      detail: 'Escalations suggest reviewing incident / medication / safeguarding entry types.',
      carePlannerHint: 'Client Diary: filter Incident types (e.g. Accident, Medication, Safeguarding), same date window.',
    });
  }

  if (filters.house !== 'all') {
    out.push({
      id: 'house-diary',
      label: `House-scoped diary: ${filters.house}`,
      detail: 'Confirm all entries for this house are included in the export (users/regions filter in CarePlanner).',
      carePlannerHint: 'Client Diary: set house/region filters if your tenant supports them, then CSV.',
    });
  }

  if (out.length === 0) {
    out.push({
      id: 'routine',
      label: 'Routine refresh',
      detail: 'Data looks recent. Optional: export Client Diary CSV each shift for continuous merge in Sync Data.',
      carePlannerHint: 'Same as your Monday 9am flow: Friday → today, All types, CSV.',
    });
  }

  return out;
}
