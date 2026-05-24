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
    '# CAREOPS — COORDINATOR EVIDENCE PACK',
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
  lines.push('## NEXT EXPORTS TO CONSIDER');
  if (meta.exportHints?.length) {
    for (const h of meta.exportHints) {
      lines.push(`- **${h.label}**: ${h.detail}`);
    }
  } else {
    lines.push('- (No automated hints for this snapshot.)');
  }
  lines.push('');
  lines.push('## USE');
  lines.push('- CSV: open in Excel; join on id/date/house for triangulation.');
  lines.push('- HTML: print to PDF for meetings / handover packs.');
  lines.push('');
  lines.push('---');
  lines.push('CAREOPS — AUTHORISED PERSONNEL ONLY');
  return lines.join('\n');
}

function ex(s: string | undefined | null): string {
  return escapeHtml(s == null ? '' : String(s));
}

/** Printable, chronology-style table; entry text truncated in table (full text in CSV). */
export function buildCoordinatorEvidenceHtml(entries: CareEntry[], meta: CoordinatorPackMeta): string {
  const title = meta.source === 'upload-hub' ? 'Import Evidence' : 'Staff Monitoring Diagnostic';
  const typeNote = meta.typeFilter?.trim()
    ? `<p style="margin:8px 0 0;font-size:11px;color:#8a8b82;">Type filter (contains): <strong>${ex(meta.typeFilter.trim())}</strong></p>`
    : '';
  let rows = '';
  for (const e of entries) {
    const ent = (e.entry || '').length > 600 ? `${(e.entry || '').slice(0, 600)}…` : e.entry || '';
    const sevColor = e.severity === 'red' ? '#ef4444' : e.severity === 'amber' ? '#f59e0b' : '#0d2d2d';
    rows += `<tr>
      <td style="padding:12px 8px;border:1px solid #d1c9b8;vertical-align:top;font-size:10px;white-space:nowrap;font-family:monospace;">${ex(e.date)} ${ex(e.time)}</td>
      <td style="padding:12px 8px;border:1px solid #d1c9b8;vertical-align:top;font-size:10px;font-weight:900;text-transform:uppercase;">${ex(e.house)}</td>
      <td style="padding:12px 8px;border:1px solid #d1c9b8;vertical-align:top;font-size:10px;text-transform:uppercase;color:#4c7c7c;">${ex(e.type)}</td>
      <td style="padding:12px 8px;border:1px solid #d1c9b8;vertical-align:top;font-size:10px;font-weight:700;">${ex(e.carer)}</td>
      <td style="padding:12px 8px;border:1px solid #d1c9b8;vertical-align:top;font-size:10px;font-weight:700;">${ex(e.client)}</td>
      <td style="padding:12px 8px;border:1px solid #d1c9b8;vertical-align:top;font-size:10px;font-weight:900;color:${sevColor};text-transform:uppercase;">${ex(e.severity)}</td>
      <td style="padding:12px 8px;border:1px solid #d1c9b8;vertical-align:top;font-size:11px;line-height:1.6;color:#1a1a1a;">${ex(ent)}</td>
    </tr>`;
  }
  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/><title>${ex(title)}</title>
<style>
  @page { margin: 2cm; @bottom-center { content: element(footer); } }
  body{font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;color:#0d2d2d;background:#fff;margin:0;padding:40px;line-height:1.5;}
  @media print{ body{padding:0;} .no-print{display:none;} }
  table{border-collapse:collapse;width:100%;font-size:12px;background:#fff;margin-bottom:60px;}
  th{background:#f3efe0;text-align:left;padding:12px 8px;border:1px solid #d1c9b8;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;font-weight:900;color:#1c4e4e;}
  .footer { position: fixed; bottom: 0; left: 0; right: 0; height: 50px; background: #fff; border-top: 1px solid #d1c9b8; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; letter-spacing: 0.3em; color: #0d2d2d; text-transform: uppercase; }
</style></head><body>
  <div style="border-bottom:6px solid #1c4e4e;padding-bottom:24px;margin-bottom:30px;display:flex;justify-content:between;align-items:end;">
    <div style="flex:1;">
      <h1 style="margin:0;font-size:24px;color:#0d2d2d;text-transform:uppercase;letter-spacing:0.1em;font-weight:900;">${ex(title)}</h1>
      <p style="margin:8px 0 0;font-size:11px;font-weight:700;color:#8a8b82;text-transform:uppercase;letter-spacing:0.2em;">CareOps Operations Portal // Evidence Pack</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-size:10px;font-weight:900;color:#1c4e4e;">WINDOW: ${ex(meta.windowLabel)}</p>
      <p style="margin:4px 0 0;font-size:9px;color:#8a8b82;text-transform:uppercase;">Rows: ${meta.entryCount} // Gen: ${ex(meta.generatedAt)}</p>
    </div>
  </div>
  
  <div style="margin-bottom:30px;background:#f3efe0;padding:15px;border:1px solid #d1c9b8;font-size:10px;font-weight:700;color:#1c4e4e;text-transform:uppercase;letter-spacing:0.1em;">
    Scope: ${ex(meta.houseScope)} ${typeNote ? ' // ' + meta.typeFilter : ''}
  </div>

  <table>
    <thead><tr>
      <th>Timestamp</th><th>Station</th><th>Type</th><th>Personnel</th><th>Asset</th><th>Severity</th><th>Intelligence Preview</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="7" style="padding:32px;text-align:center;color:#8a8b82;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;">No validated intelligence in this selection filter.</td></tr>`}</tbody>
  </table>

  <div class="footer">
    CAREOPS — Precision Care Operations Portals
  </div>
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
