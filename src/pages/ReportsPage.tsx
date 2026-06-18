import { useState, useRef, useMemo, useEffect } from 'react';
import type { WeekSummary, Page } from '../lib/types';
import { ORG_CONFIG } from '../lib/config';
import { flattenWeekEntries } from '../lib/staff-monitoring';
import { generateRiskProfiles } from '../lib/risk-scores';
import { logAuditAction } from '../lib/audit';
import {
  FileText, Download, History, Activity, AlertTriangle, Clock, LayoutGrid
} from 'lucide-react';

interface Props {
  weekData: WeekSummary | null;
  setPage: (p: Page) => void;
}

type ReportType = 'weekly_summary' | 'risk_matrix' | 'entry_log' | 'staff_activity';

function buildWeeklySummaryHtml(weekData: WeekSummary): string {
  const houses = Object.entries(weekData.houses);
  const today = new Date().toLocaleDateString('en-GB');
  const houseRows = houses.map(([name, h]) => {
    const flags = h.entries.filter(e => e.flags?.length).length;
    return `<tr><td style="padding:10px 16px;font-weight:700;text-transform:uppercase">${name}</td>
      <td style="padding:10px 16px;text-align:center">${h.entries.length}</td>
      <td style="padding:10px 16px;text-align:center;color:${flags > 0 ? '#ef4444' : '#22c55e'}">${flags}</td></tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,sans-serif;color:#1e293b;padding:40px;max-width:900px;margin:0 auto}
    h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #14b8a6;padding-bottom:12px}
    h2{font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-top:28px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:#f1f5f9;padding:10px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px}
    td{border-bottom:1px solid #e2e8f0;font-size:12px}
    .meta{color:#64748b;font-size:12px;margin-top:4px}
    @media print{body{padding:20px}}</style></head><body>
    <h1>${ORG_CONFIG.name} — Weekly Clinical Summary</h1>
    <p class="meta">Generated: ${today} | Total entries: ${weekData.totalEntries} | Houses: ${houses.length}</p>
    <h2>House Performance</h2>
    <table><thead><tr><th>House</th><th style="text-align:center">Entries</th><th style="text-align:center">Flags</th></tr></thead>
    <tbody>${houseRows}</tbody></table></body></html>`;
}

function buildEntryLogHtml(weekData: WeekSummary): string {
  const entries = flattenWeekEntries(weekData).slice(0, 200);
  const today = new Date().toLocaleDateString('en-GB');
  const rows = entries.map(e =>
    `<tr><td style="padding:8px 12px">${e.date || ''}</td>
     <td style="padding:8px 12px;font-weight:600">${e.carer || ''}</td>
     <td style="padding:8px 12px">${e.client || ''}</td>
     <td style="padding:8px 12px">${e.house || ''}</td>
     <td style="padding:8px 12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(e.entry || '').slice(0, 120)}</td></tr>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,sans-serif;color:#1e293b;padding:40px}
    h1{font-size:20px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #14b8a6;padding-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px}
    td{border-bottom:1px solid #f1f5f9}
    @media print{body{padding:10px}th{background:#e2e8f0}}</style></head><body>
    <h1>${ORG_CONFIG.name} — Personnel Entry Log</h1>
    <p style="color:#64748b;font-size:12px">Generated: ${today} | ${entries.length} entries shown (max 200)</p>
    <table><thead><tr><th>Date</th><th>Carer</th><th>Client</th><th>House</th><th>Entry Preview</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
}

function buildStaffActivityHtml(weekData: WeekSummary): string {
  const entries = flattenWeekEntries(weekData);
  const today = new Date().toLocaleDateString('en-GB');
  const byStaff = new Map<string, { count: number; shortCount: number; totalChars: number }>();
  entries.forEach(e => {
    const name = e.carer || 'Unknown';
    const existing = byStaff.get(name) || { count: 0, shortCount: 0, totalChars: 0 };
    const len = (e.entry || '').length;
    byStaff.set(name, { count: existing.count + 1, shortCount: existing.shortCount + (len < 90 ? 1 : 0), totalChars: existing.totalChars + len });
  });
  const rows = [...byStaff.entries()].sort((a, b) => b[1].count - a[1].count).map(([name, s]) => {
    const avg = s.count > 0 ? Math.round(s.totalChars / s.count) : 0;
    const shortPct = s.count > 0 ? Math.round((s.shortCount / s.count) * 100) : 0;
    return `<tr><td style="padding:8px 12px;font-weight:600">${name}</td>
      <td style="padding:8px 12px;text-align:center">${s.count}</td>
      <td style="padding:8px 12px;text-align:center">${avg}</td>
      <td style="padding:8px 12px;text-align:center;color:${shortPct > 30 ? '#ef4444' : '#22c55e'}">${shortPct}%</td></tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,sans-serif;color:#1e293b;padding:40px}
    h1{font-size:20px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #14b8a6;padding-bottom:12px}
    table{width:100%;border-collapse:collapse}
    th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px}
    td{border-bottom:1px solid #f1f5f9;font-size:12px}
    @media print{body{padding:10px}}</style></head><body>
    <h1>${ORG_CONFIG.name} — Operational KPI Report</h1>
    <p style="color:#64748b;font-size:12px">Generated: ${today} | ${byStaff.size} staff members</p>
    <table><thead><tr><th>Staff Member</th><th style="text-align:center">Entries</th><th style="text-align:center">Avg Chars</th><th style="text-align:center">Short Entry %</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
}function buildRiskMatrixHtml(weekData: WeekSummary): string {
  const today = new Date().toLocaleDateString('en-GB');
  const profiles = generateRiskProfiles(weekData);
  const LEVEL_COLOR: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
  const rows = profiles.map(p => {
    const color = LEVEL_COLOR[p.riskLevel] || '#64748b';
    const topFlag = p.topConcerns[0]?.slice(0, 80) || p.recentEntries[0]?.entry?.slice(0, 80) || 'No lead indicator';
    return `<tr>
      <td style="padding:9px 14px;font-weight:700;border-bottom:1px solid #e2e8f0">${p.name}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0">${p.house}</td>
      <td style="padding:9px 14px;text-align:center;border-bottom:1px solid #e2e8f0;font-weight:900;color:${color}">${p.riskLevel.toUpperCase()}</td>
      <td style="padding:9px 14px;text-align:center;border-bottom:1px solid #e2e8f0;color:#ef4444">${p.redFlags}</td>
      <td style="padding:9px 14px;text-align:center;border-bottom:1px solid #e2e8f0;color:#f59e0b">${p.amberFlags}</td>
      <td style="padding:9px 14px;font-size:10px;color:#64748b;border-bottom:1px solid #e2e8f0;max-width:220px">${topFlag}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,sans-serif;color:#1e293b;padding:36px;max-width:1100px;margin:0 auto}
    h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #ef4444;padding-bottom:12px;margin-bottom:6px}
    .meta{color:#64748b;font-size:11px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#1e293b;color:#fff;padding:9px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px}
    tr:nth-child(even) td{background:#f8fafc}
    @media print{body{padding:20px}}
  </style></head><body>
  <h1>${ORG_CONFIG.name} — CQC Risk Matrix</h1>
  <div class="meta">Generated: ${today} · ${profiles.length} clients assessed · Source: clinical diary intelligence</div>
  <table><thead><tr>
    <th>Client</th><th>Site</th><th>Risk Level</th><th>Critical Flags</th><th>Amber Flags</th><th>Lead Indicator</th>
  </tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}


function printHtml(html: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 2000);
  };
}

export function ReportsPage({ weekData }: Props) {
  const [selectedReport, setSelectedReport] = useState<ReportType>('weekly_summary');
  const [reviewer, setReviewer] = useState('');
  const [reviewApproved, setReviewApproved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const REPORTS = [
    { id: 'weekly_summary' as ReportType, label: 'Weekly Clinical Summary', icon: Activity, desc: 'House-by-house clinical overview and flag report.' },
    { id: 'risk_matrix' as ReportType, label: 'CQC Risk Matrix', icon: AlertTriangle, desc: 'Impact/likelihood mapping for all active risks.' },
    { id: 'entry_log' as ReportType, label: 'Personnel Entry Log', icon: FileText, desc: 'Consolidated audit trail of all staff documentation.' },
    { id: 'staff_activity' as ReportType, label: 'Operational KPI Report', icon: History, desc: 'Staff quality scores, short entry ratios, and coaching events.' },
  ];

  const reportHtml = useMemo(() => {
    if (!weekData) return '';
    if (selectedReport === 'weekly_summary') return buildWeeklySummaryHtml(weekData);
    if (selectedReport === 'risk_matrix') return buildRiskMatrixHtml(weekData);
    if (selectedReport === 'entry_log') return buildEntryLogHtml(weekData);
    if (selectedReport === 'staff_activity') return buildStaffActivityHtml(weekData);
    return '';
  }, [weekData, selectedReport]);

  const previewUrl = useMemo(() => {
    if (!reportHtml) return '';
    const blob = new Blob([reportHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [reportHtml]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const houses = weekData ? Object.entries(weekData.houses) : [];
  const totalEntries = weekData?.totalEntries ?? 0;
  const totalFlags = weekData ? flattenWeekEntries(weekData).filter(e => e.flags?.length).length : 0;
  const staffSet = weekData ? new Set(flattenWeekEntries(weekData).map(e => e.carer)) : new Set();

  function exportPack() {
    if (!weekData || !reviewApproved || !reviewer.trim()) return;
    const combined = [
      buildWeeklySummaryHtml(weekData),
      '<div style="page-break-after:always"></div>',
      buildEntryLogHtml(weekData),
      '<div style="page-break-after:always"></div>',
      buildStaffActivityHtml(weekData),
    ].join('');
    logAuditAction('review_signed_off', 'Full report pack signoff', { reviewer: reviewer.trim(), reportType: 'full_pack' });
    logAuditAction('data_exported', 'Exported full report pack', { reviewer: reviewer.trim() });
    printHtml(combined);
  }

  function exportCurrentReport() {
    if (!reportHtml || !reviewApproved || !reviewer.trim()) return;
    logAuditAction('review_signed_off', `Report signoff for ${selectedReport}`, { reviewer: reviewer.trim(), reportType: selectedReport });
    logAuditAction('data_exported', `Exported ${selectedReport}`, { reviewer: reviewer.trim() });
    printHtml(reportHtml);
  }

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-hc-muted">
        <div className="w-16 h-16 hc-clay-raised flex items-center justify-center mb-6">
          <FileText className="w-8 h-8 text-hc-muted" />
        </div>
        <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.4em]">No clinical data loaded.</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[2560px] mx-auto animate-in fade-in duration-700">
      <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-hc-border/20 pb-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <LayoutGrid className="w-6 h-6 text-hc-teal" />
            <h1 className="text-2xl md:text-4xl font-black text-hc-text tracking-[0.2em] uppercase">Diagnostic Reports</h1>
          </div>
          <p className="text-hc-muted text-[11px] font-bold uppercase tracking-wider leading-relaxed">
            {totalEntries} entries · {houses.length} houses · {staffSet.size} staff · {totalFlags} flags
          </p>
        </div>
        <button onClick={exportPack} disabled={!reviewApproved || !reviewer.trim()} className="px-8 py-3.5 btn-tactical shadow-2xl flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
          <Download className="w-4 h-4" /> Export Full Pack
        </button>
      </div>
      <div className="mb-6 flex items-center gap-3">
        <input
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          placeholder="Reviewer name"
          className="px-3 py-2 rounded-lg border border-hc-border/30 text-[10px] font-bold uppercase tracking-widest text-hc-text bg-transparent min-w-[220px]"
        />
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-hc-muted">
          <input type="checkbox" checked={reviewApproved} onChange={(e) => setReviewApproved(e.target.checked)} />
          Review complete
        </label>
      </div>

      <div className="flex flex-col xl:flex-row gap-10">
        <div className="w-full xl:w-[450px] shrink-0 space-y-4">
          <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] mb-6 ml-2">Available Vectors</div>
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => setSelectedReport(r.id)}
              className={`w-full text-left p-6 rounded-2xl border transition-all duration-500 group
                ${selectedReport === r.id ? 'hc-clay-inset bg-hc-bg/50 border-hc-teal/30 scale-[1.02]' : 'hc-clay-raised border-transparent hover:border-hc-muted/20'}`}>
              <div className="flex items-start gap-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors
                  ${selectedReport === r.id ? 'bg-hc-teal text-hc-bg shadow-xl' : 'hc-clay-inset text-hc-muted group-hover:text-hc-teal'}`}>
                  <r.icon className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-black uppercase tracking-tight mb-1 transition-colors ${selectedReport === r.id ? 'text-hc-text' : 'text-hc-muted group-hover:text-hc-text'}`}>{r.label}</div>
                  <div className="text-[11px] font-bold text-hc-muted/60 leading-relaxed uppercase tracking-widest">{r.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-[600px] hc-clay-raised overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-hc-teal" />
          <div className="p-6 pb-0 flex items-center justify-between border-b border-hc-border/20">
            <div className="flex items-center gap-4 pb-4">
              <Clock className="w-4 h-4 text-hc-muted" />
              <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">
                {houses.length} houses · {totalEntries} entries · {new Date().toLocaleDateString('en-GB')}
              </span>
            </div>
            {selectedReport !== 'risk_matrix' && reportHtml && (
              <button onClick={exportCurrentReport} disabled={!reviewApproved || !reviewer.trim()} className="flex items-center gap-2 px-5 py-2 mb-4 rounded-xl hc-clay-raised text-[11px] font-black text-hc-teal uppercase hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
            )}
          </div>

          {selectedReport === 'risk_matrix' ? (
            <div className="p-8 space-y-4">
              <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest mb-4">House Risk Overview — Live Data</div>
              {houses.map(([name, h]) => {
                const flags = h.entries.filter(e => e.flags?.length).length;
                const risk = flags > 5 ? 'HIGH' : flags > 2 ? 'MEDIUM' : 'LOW';
                const color = risk === 'HIGH' ? 'text-flag-red' : risk === 'MEDIUM' ? 'text-flag-amber' : 'text-flag-green';
                return (
                  <div key={name} className="hc-clay-inset p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-hc-text uppercase">{name}</div>
                      <div className="text-[10px] text-hc-muted mt-1">{h.entries.length} entries · {flags} flags</div>
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{risk}</span>
                  </div>
                );
              })}
            </div>
          ) : previewUrl ? (
            <iframe ref={iframeRef} src={previewUrl} className="w-full border-0" style={{ height: '600px' }} title="report-preview" />
          ) : (
            <div className="flex items-center justify-center h-64 text-hc-muted text-[11px] font-black uppercase tracking-widest opacity-30">No data</div>
          )}
        </div>
      </div>
    </div>
  );
}
