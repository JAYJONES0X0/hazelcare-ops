import { escapeHtml } from './html-escape';
import type { CareEntry, WeekSummary } from './types';
import { buildExportRecommendations } from './export-recommendations';
import {
  computeStaffMonitoring,
  filterEntries,
  flattenWeekEntries,
  type MonitoringFilters,
  type StaffMonitoringSnapshot,
} from './staff-monitoring';

export interface CoordinatorPackMeta {
  generatedAt: string;
  source: 'upload-hub' | 'staff-monitoring';
  windowLabel: string;
  houseScope: string;
  dateFrom?: string;
  dateTo?: string;
  entryCount: number;
  typeFilter?: string;
  exportHints?: { label: string; detail: string }[];
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Evidence-oriented CSV: full entry text, id, category, flags — suitable for audits and spreadsheets. */
export function careEntriesToEvidenceCsv(entries: CareEntry[]): string {
  const header =
    'id,date,time,house,type,category,carer,client,severity,flags,entry';
  const rows = entries.map((e) => {
    const flags = (e.flags || []).join('; ');
    const cells = [
      e.id || '',
      e.date || '',
      e.time || '',
      e.house || '',
      e.type || '',
      e.category || '',
      e.carer || '',
      e.client || '',
      e.severity || '',
      flags,
      e.entry || '',
    ];
    return cells.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',');
  });
  return [header, ...rows].join('\n');
}

export function buildCoordinatorReadme(meta: CoordinatorPackMeta): string {
  const lines: string[] = [
    '# Hazel Care — coordinator evidence pack',
    `Generated (UTC): ${meta.generatedAt}`,
    `Source: ${meta.source === 'upload-hub' ? 'Upload Hub' : 'Staff Intelligence'}`,
    `Window: ${meta.windowLabel}`,
    `House scope: ${meta.houseScope}`,
    `Rows in this extract: ${meta.entryCount}`,
  ];
  if (meta.dateFrom || meta.dateTo) {
    lines.push(`Date filter: ${meta.dateFrom || '—'} – ${meta.dateTo || '—'}`);
  }
  if (meta.typeFilter?.trim()) {
    lines.push(`Entry type filter (contains): ${meta.typeFilter.trim()}`);
  }
  lines.push('');
  lines.push('## Next exports to consider');
  if (meta.exportHints?.length) {
    for (const h of meta.exportHints) {
      lines.push(`- **${h.label}**: ${h.detail}`);
    }
  } else {
    lines.push('- (No automated hints for this snapshot.)');
  }
  lines.push('');
  lines.push('## Use');
  lines.push('- CSV: open in Excel; join on id/date/house for triangulation.');
  lines.push('- HTML: print to PDF for meetings / handover packs.');
  return lines.join('\n');
}

function ex(s: string | undefined | null): string {
  return escapeHtml(s == null ? '' : String(s));
}

/** Printable, chronology-style table; entry text truncated in table (full text in CSV). */
export function buildCoordinatorEvidenceHtml(entries: CareEntry[], meta: CoordinatorPackMeta): string {
  const title = meta.source === 'upload-hub' ? 'Coordinator evidence extract' : 'Staff monitoring evidence extract';
  const typeNote = meta.typeFilter?.trim()
    ? `<p style="margin:8px 0 0;font-size:11px;color:#64748b;">Type filter (contains): <strong>${ex(meta.typeFilter.trim())}</strong></p>`
    : '';
  let rows = '';
  for (const e of entries) {
    const ent = (e.entry || '').length > 600 ? `${(e.entry || '').slice(0, 600)}…` : e.entry || '';
    rows += `<tr>
      <td style="padding:8px;border:1px solid #e2e8f0;vertical-align:top;font-size:11px;white-space:nowrap;">${ex(e.date)} ${ex(e.time)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;vertical-align:top;font-size:11px;">${ex(e.house)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;vertical-align:top;font-size:11px;">${ex(e.type)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;vertical-align:top;font-size:11px;">${ex(e.carer)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;vertical-align:top;font-size:11px;">${ex(e.client)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;vertical-align:top;font-size:11px;">${ex(e.severity)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;vertical-align:top;font-size:11px;line-height:1.45;">${ex(ent)}</td>
    </tr>`;
  }
  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/><title>${ex(title)}</title>
<style>
  body{font-family:Segoe UI,Tahoma,sans-serif;color:#1e293b;background:#f8fafc;margin:0;padding:24px;}
  @media print{ body{padding:0;background:#fff;} }
  table{border-collapse:collapse;width:100%;font-size:12px;background:#fff;}
  th{background:#f1f5f9;text-align:left;padding:10px;border:1px solid #cbd5e1;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;}
</style></head><body>
  <div style="border-bottom:4px solid #0d9488;padding-bottom:16px;margin-bottom:20px;">
    <h1 style="margin:0;font-size:20px;color:#0f766e;text-transform:uppercase;letter-spacing:-0.02em;">${ex(title)}</h1>
    <p style="margin:8px 0 0;font-size:12px;color:#64748b;">Window: <strong>${ex(meta.windowLabel)}</strong> · House: <strong>${ex(meta.houseScope)}</strong> · Rows: <strong>${meta.entryCount}</strong></p>
    <p style="margin:6px 0 0;font-size:10px;color:#94a3b8;">Generated: ${ex(meta.generatedAt)} · Source: ${ex(meta.source)}</p>
    ${typeNote}
  </div>
  <table>
    <thead><tr>
      <th>Date/time</th><th>House</th><th>Type</th><th>Carer</th><th>Client</th><th>Severity</th><th>Entry (preview)</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="7" style="padding:16px;color:#94a3b8;">No rows in this filter.</td></tr>`}</tbody>
  </table>
  <p style="margin-top:20px;font-size:10px;color:#94a3b8;">Full text for each row is in the companion CSV. This HTML is for review and print-to-PDF.</p>
</body></html>`;
}

/** Applies house/date filters plus optional substring match on entry type (e.g. <code>1:1</code>, <code>handover</code>). */
export function filterEntriesForCoordinatorPack(
  week: WeekSummary,
  filters: MonitoringFilters,
  typeSubstr?: string,
): CareEntry[] {
  let list = filterEntries(flattenWeekEntries(week), filters);
  const t = typeSubstr?.trim().toLowerCase();
  if (t) {
    list = list.filter((e) => (e.type || '').toLowerCase().includes(t));
  }
  return list;
}

export function buildCoordinatorPackMeta(
  snapshot: StaffMonitoringSnapshot,
  source: 'upload-hub' | 'staff-monitoring',
  opts?: { typeFilter?: string; entryCount?: number },
): CoordinatorPackMeta {
  const hints = buildExportRecommendations(snapshot);
  const entryCount = opts?.entryCount ?? snapshot.dataFreshness.entryCount;
  return {
    generatedAt: new Date().toISOString(),
    source,
    windowLabel: snapshot.windowLabel,
    houseScope: snapshot.filters.house === 'all' ? 'All houses' : String(snapshot.filters.house),
    dateFrom: snapshot.filters.dateFrom,
    dateTo: snapshot.filters.dateTo,
    entryCount,
    typeFilter: opts?.typeFilter,
    exportHints: hints.map((h) => ({ label: h.label, detail: h.detail })),
  };
}

export function buildSnapshotForPack(week: WeekSummary | null, filters: MonitoringFilters): StaffMonitoringSnapshot {
  return computeStaffMonitoring(week, filters);
}
