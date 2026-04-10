import { useEffect, useState, useRef, useCallback } from 'react';
import type { WeekSummary, CareEntry, TemplateType } from '../lib/types';
import { TEMPLATES } from '../lib/types';
import { escapeHtml } from '../lib/html-escape';

/** Escape user-derived strings embedded in report HTML. */
function ex(s: string | undefined | null): string {
  return escapeHtml(s == null ? '' : String(s));
}

interface Props {
  weekData: WeekSummary | null;
}

const TEMPLATE_CONTEXT_KEY = 'hc-template-import-context';

interface TemplateImportContext {
  selectedTemplateIds?: TemplateType[];
  /** Set when arriving from Staff Intelligence monitoring */
  source?: string;
  at?: string;
  monitoringRunId?: string;
  house?: string;
  dateFrom?: string;
  dateTo?: string;
  escalationCount?: number;
  avgHouseQuality?: number;
}

function readTemplateImportContext(): TemplateImportContext | null {
  try {
    const raw = localStorage.getItem(TEMPLATE_CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TemplateImportContext;
  } catch {
    return null;
  }
}

function loadRecommendedTemplateIds(): TemplateType[] {
  return readTemplateImportContext()?.selectedTemplateIds || [];
}

/** Inline block inside document body (after header) when Staff Intelligence context is active. */
function monitoringContextBlock(ctx: TemplateImportContext | null): string {
  if (!ctx || ctx.source !== 'staff-monitoring') return '';
  const win =
    ctx.dateFrom && ctx.dateTo ? `${ex(ctx.dateFrom)} — ${ex(ctx.dateTo)}` : 'See registry / monitoring filters';
  const esc =
    ctx.escalationCount != null && ctx.escalationCount > 0
      ? `<div style="margin-top:6px;"><strong>Open escalations (monitoring):</strong> ${ctx.escalationCount}</div>`
      : '';
  const q =
    ctx.avgHouseQuality != null
      ? `<div style="margin-top:4px;"><strong>Avg house quality (monitoring):</strong> ${ctx.avgHouseQuality}/100</div>`
      : '';
  const scope = ctx.house ? ex(ctx.house) : 'All houses';
  return `
  <div style="background:#f0fdfa;border:2px solid #5eead4;border-radius:10px;padding:14px 18px;margin-bottom:22px;font-size:12px;color:#134e4a;line-height:1.5;">
    <div style="font-weight:900;text-transform:uppercase;letter-spacing:0.06em;color:#0f766e;">Staff Intelligence context</div>
    <div style="margin-top:6px;"><strong>Window:</strong> ${win} · <strong>Scope:</strong> ${scope}</div>
    ${esc}
    ${q}
    <div style="margin-top:8px;font-size:10px;color:#64748b;">Context saved: ${ex(ctx.at || '')}</div>
  </div>`;
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

const FOOTER_HTML = `
  <div style="margin-top: auto; padding-top: 30px; text-align: center; border-top: 1px solid #f1f5f9;">
    <div style="color: #94a3b8; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase;">HAZEL CARE LTD</div>
    <div style="color: #cbd5e1; font-size: 8px; font-weight: 600; margin-top: 4px; letter-spacing: 0.1em;">SECURE OPERATIONAL DOCUMENT</div>
  </div>
`;

function renderHeader(title: string, subtitle: string, color: string) {
  const t = ex(title);
  const s = ex(subtitle);
  return `
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid ${color}; padding-bottom: 20px; margin-bottom: 30px;">
    <div>
      <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: ${color}; text-transform: uppercase; letter-spacing: -0.03em; line-height: 1.1;">${t}</h1>
      <p style="margin: 8px 0 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">${s}</p>
    </div>
    <div style="display: flex; align-items: center; gap: 14px; background: #f8fafc; padding: 10px 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
      <img src="/logo-icon-dark.png" style="height: 38px; width: 38px; border-radius: 8px; object-fit: contain;" />
      <div style="text-align: left;">
        <div style="font-weight: 900; font-size: 13px; color: ${color}; line-height: 1; letter-spacing: -0.02em;">HAZEL CARE</div>
        <div style="font-weight: 800; font-size: 7px; color: ${color}; opacity: 0.6; letter-spacing: 0.2em; margin-top: 3px;">OPERATIONS</div>
      </div>
    </div>
  </div>`;
}

function generateQualityMeeting(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#0f766e';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  const redFlags = data.allFlags.red;
  const amberFlags = data.allFlags.amber;

  let html = `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff; min-height: 100%; display: flex; flex-direction: column; padding: 40px;">`;
  html += renderHeader('Quality & Performance Meeting', `WEEK: ${data.dateFrom || '___'} — ${data.dateTo || '___'} · ${data.totalEntries} ENTRIES`, COLOR);
  html += monitoringContextBlock(mon);

  html += `
  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
    <tr><td style="padding: 10px 15px; background: #f8fafc; font-weight: 700; width: 180px; border: 1px solid #e2e8f0; text-transform: uppercase; font-size: 11px;">Date</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">${new Date().toLocaleDateString('en-GB')}</td></tr>
    <tr><td style="padding: 10px 15px; background: #f8fafc; font-weight: 700; border: 1px solid #e2e8f0; text-transform: uppercase; font-size: 11px;">Chair</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 10px 15px; background: #f8fafc; font-weight: 700; border: 1px solid #e2e8f0; text-transform: uppercase; font-size: 11px;">Attendees</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">${data.carers.slice(0, 8).join(', ')}</td></tr>
  </table>

  <h2 style="font-size: 15px; font-weight: 800; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">Weekly Summary</h2>
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px;">
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; text-align: center;">
      <div style="font-size: 32px; font-weight: 900; color: #ef4444; line-height: 1;">${redFlags.length}</div>
      <div style="font-size: 9px; font-weight: 700; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Red Flags</div>
    </div>
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; text-align: center;">
      <div style="font-size: 32px; font-weight: 900; color: #f59e0b; line-height: 1;">${amberFlags.length}</div>
      <div style="font-size: 9px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Amber Flags</div>
    </div>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center;">
      <div style="font-size: 32px; font-weight: 900; color: #22c55e; line-height: 1;">${data.totalEntries - redFlags.length - amberFlags.length}</div>
      <div style="font-size: 9px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Routine</div>
    </div>
    <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 16px; text-align: center;">
      <div style="font-size: 32px; font-weight: 900; color: ${COLOR}; line-height: 1;">${houses.length}</div>
      <div style="font-size: 9px; font-weight: 700; color: ${COLOR}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Houses</div>
    </div>
  </div>`;

  if (redFlags.length > 0) {
    html += `<h2 style="font-size: 15px; font-weight: 800; color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">🔴 RED FLAG ALERTS — IMMEDIATE ATTENTION</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
      <tr style="background: #f8fafc;"><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 120px;">House</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 120px;">Client</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Details</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 150px;">Flags</th></tr>`;
    for (const e of redFlags) {
      html += `<tr><td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 700;">${ex(e.house)}</td><td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 700;">${e.client ? ex(e.client) : '—'}</td><td style="padding: 10px; border: 1px solid #e2e8f0; line-height: 1.5;">${ex(e.entry)}</td><td style="padding: 10px; border: 1px solid #e2e8f0; color: #ef4444; font-weight: 700;">${ex(e.flags.join(', '))}</td></tr>`;
    }
    html += `</table>`;
  }

  html += `<h2 style="font-size: 15px; font-weight: 800; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">House Breakdown</h2>`;
  for (const house of houses) {
    const hasIssues = house.flags.red > 0 || house.flags.amber > 0;
    html += `
    <div style="page-break-inside: avoid; margin-bottom: 20px; border: 1px solid ${hasIssues ? '#fecaca' : '#e2e8f0'}; border-radius: 12px; overflow: hidden; background: #fff;">
      <div style="background: ${hasIssues ? '#fef2f2' : '#f8fafc'}; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${hasIssues ? '#fecaca' : '#e2e8f0'};">
        <div>
          <strong style="font-size: 15px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.02em;">${ex(house.name)}</strong>
          ${house.coordinator ? `<span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 12px; text-transform: uppercase; letter-spacing: 0.05em;">LEAD: ${ex(house.coordinator)}</span>` : ''}
        </div>
        <div style="display: flex; gap: 8px;">
          ${house.flags.red > 0 ? `<span style="background: #ef4444; color: white; font-size: 9px; font-weight: 900; padding: 3px 10px; border-radius: 99px; text-transform: uppercase;">${house.flags.red} RED</span>` : ''}
          ${house.flags.amber > 0 ? `<span style="background: #f59e0b; color: white; font-size: 9px; font-weight: 900; padding: 3px 10px; border-radius: 99px; text-transform: uppercase;">${house.flags.amber} AMBER</span>` : ''}
          <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(0,0,0,0.05); padding: 3px 10px; border-radius: 99px;">${house.entries.length} LOGS</span>
        </div>
      </div>
      <div style="padding: 16px 20px; font-size: 12px;">`;

    const sections: [string, CareEntry[]][] = [
      ['Incidents & Safety', house.incidents],
      ['Safeguarding', house.safeguarding],
      ['Medication Management', house.medication],
      ['Operational Support', house.dailySupport],
    ];

    for (const [label, items] of sections) {
      if (items.length > 0) {
        html += `<div style="margin-bottom: 12px;"><strong style="color: ${COLOR}; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">${label}:</strong>`;
        for (const item of items.slice(0, 10)) {
          html += `<div style="margin-left: 12px; margin-top: 6px; color: #475569; line-height: 1.5; position: relative; padding-left: 12px;">
            <span style="position: absolute; left: 0; color: #94a3b8;">•</span>
            ${item.client ? `<strong>${ex(item.client)}:</strong> ` : ''}${ex(truncate(item.entry, 250))}
          </div>`;
        }
        html += `</div>`;
      }
    }
    html += `</div></div>`;
  }

  html += `
  <h2 style="font-size: 15px; font-weight: 800; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-top: 32px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">Decisions & Actions</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 32px;">
    <tr style="background: #f8fafc;"><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 40px;">ID</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Strategic Action</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 150px;">Owner</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 100px;">Deadline</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 80px;">Status</th></tr>
    <tr><td style="padding: 15px 10px; border: 1px solid #e2e8f0;">1</td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #94a3b8;">OPEN</td></tr>
    <tr><td style="padding: 15px 10px; border: 1px solid #e2e8f0;">2</td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #94a3b8;">OPEN</td></tr>
  </table>
  ${FOOTER_HTML}
</div>`;
  return html;
}

function generateIncidentReport(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#dc2626';
  const incidents = [...data.allFlags.red, ...data.allFlags.amber.filter(e => e.flags.some(f => f.includes('incident') || f.includes('police') || f.includes('ambulance')))];
  let html = `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff; min-height: 100%; display: flex; flex-direction: column; padding: 40px;">`;
  html += renderHeader('Incident Report', `PERIOD: ${data.dateFrom || '___'} — ${data.dateTo || '___'}`, COLOR);
  html += monitoringContextBlock(mon);

  html += `
  <p style="font-size: 13px; font-weight: 600; margin-bottom: 24px; background: #fef2f2; color: #b91c1c; padding: 12px 20px; border-radius: 8px; border: 1px solid #fecaca;">
    ${incidents.length} CRITICAL INCIDENTS IDENTIFIED FROM ${data.totalEntries} REGISTRY ENTRIES
  </p>`;

  for (const [i, e] of incidents.entries()) {
    html += `
    <div style="border: 1px solid ${e.severity === 'red' ? '#fecaca' : '#fde68a'}; border-radius: 12px; padding: 20px; margin-bottom: 16px; page-break-inside: avoid; background: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <strong style="font-size: 15px; font-weight: 900; text-transform: uppercase;">${i + 1}. ${e.house}</strong>
        <span style="background: ${e.severity === 'red' ? '#ef4444' : '#f59e0b'}; color: white; font-size: 10px; font-weight: 900; padding: 3px 12px; border-radius: 99px; text-transform: uppercase;">${e.severity === 'red' ? 'CRITICAL' : 'MONITOR'}</span>
      </div>
      <div style="padding: 16px; background: #f8fafc; border-radius: 8px; font-size: 13px; line-height: 1.7; border: 1px solid #e2e8f0; color: #334155;">
        ${ex(e.entry)}
      </div>
    </div>`;
  }
  html += FOOTER_HTML + `</div>`;
  return html;
}

function generateDailyQuality(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#1e40af';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  const redFlags = data.allFlags.red;
  const amberFlags = data.allFlags.amber;
  const allFlagged = [...redFlags, ...amberFlags];

  const dailySub =
    mon?.source === 'staff-monitoring' && mon.dateFrom && mon.dateTo
      ? `DATE: ${new Date().toLocaleDateString('en-GB').toUpperCase()} · MONITORING WINDOW: ${mon.dateFrom} — ${mon.dateTo}`
      : `DATE: ${new Date().toLocaleDateString('en-GB').toUpperCase()}`;

  let html = `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff; min-height: 100%; display: flex; flex-direction: column; padding: 40px;">`;
  html += renderHeader('Daily Quality Briefing', dailySub, COLOR);
  html += monitoringContextBlock(mon);

  html += `
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 32px;">
    <tr style="background: #eff6ff;">
      <th style="padding: 10px; text-align: left; border: 1px solid #bfdbfe; text-transform: uppercase;">House</th>
      <th style="padding: 10px; text-align: center; border: 1px solid #bfdbfe; text-transform: uppercase; width: 60px;">Logs</th>
      <th style="padding: 10px; text-align: center; border: 1px solid #bfdbfe; text-transform: uppercase; width: 60px;">Red</th>
      <th style="padding: 10px; text-align: left; border: 1px solid #bfdbfe; text-transform: uppercase;">Status</th>
    </tr>`;

  for (const house of houses) {
    const rowBg = house.flags.red > 0 ? '#fef2f2' : '#fff';
    html += `<tr style="background: ${rowBg};">
      <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 800;">${ex(house.name)}</td>
      <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700;">${house.entries.length}</td>
      <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; color: ${house.flags.red > 0 ? '#ef4444' : '#64748b'}; font-weight: 900;">${house.flags.red || '0'}</td>
      <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;">${house.flags.red > 0 ? 'INTERVENTION' : 'NOMINAL'}</td>
    </tr>`;
  }
  html += `</table>`;

  if (allFlagged.length > 0) {
    html += `<h2 style="font-size: 15px; font-weight: 800; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">Overnight Notes</h2>`;
    for (const e of allFlagged.slice(0, 15)) {
      const badge = e.severity === 'red' ? '#ef4444' : '#f59e0b';
      html += `<div style="background: #f8fafc; border-left: 5px solid ${badge}; padding: 12px 16px; margin-bottom: 8px; border-radius: 0 8px 8px 0; font-size: 12px; border: 1px solid #e2e8f0; border-left-width: 5px;">
        <strong>${ex(e.house)}:</strong> ${ex(truncate(e.entry, 200))}
      </div>`;
    }
  }
  html += FOOTER_HTML + `</div>`;
  return html;
}

function generateFinanceReport(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#059669';
  const financeEntries = Object.values(data.houses).flatMap(h => h.entries.filter(e => e.flags.some(f => f.toLowerCase().includes('finance') || f.toLowerCase().includes('money') || f.toLowerCase().includes('shopping'))));
  let html = `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff; min-height: 100%; display: flex; flex-direction: column; padding: 40px;">`;
  html += renderHeader('Finance & Petty Cash Audit', `PERIOD: ${data.dateFrom || '___'} — ${data.dateTo || '___'}`, COLOR);
  html += monitoringContextBlock(mon);

  html += `
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
    <tr style="background: #f0fdf4;"><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">House</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Client</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Transaction Details</th></tr>`;
  for (const e of financeEntries) {
    html += `<tr><td style="padding: 10px; border: 1px solid #e2e8f0;">${e.house}</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${e.client}</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${e.entry}</td></tr>`;
  }
  html += `</table>` + FOOTER_HTML + `</div>`;
  return html;
}

function generateMedicationAudit(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#0891b2';
  const medEntries = Object.values(data.houses).flatMap(h => h.medication);
  let html = `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff; min-height: 100%; display: flex; flex-direction: column; padding: 40px;">`;
  html += renderHeader('Medication Administration Audit', `PERIOD: ${data.dateFrom || '___'} — ${data.dateTo || '___'}`, COLOR);
  html += monitoringContextBlock(mon);

  html += `
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
    <tr style="background: #ecfeff;"><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">House</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Client</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Admin Details</th></tr>`;
  for (const e of medEntries) {
    html += `<tr><td style="padding: 10px; border: 1px solid #e2e8f0;">${ex(e.house)}</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${ex(e.client)}</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${ex(e.entry)}</td></tr>`;
  }
  html += `</table>` + FOOTER_HTML + `</div>`;
  return html;
}

function generateHandoverReport(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#d97706';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  let html = `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff; min-height: 100%; display: flex; flex-direction: column; padding: 40px;">`;
  html += renderHeader('Shift Handover Report', `DATE: ${new Date().toLocaleDateString('en-GB')} · ALL HOUSES`, COLOR);
  html += monitoringContextBlock(mon);

  for (const house of houses) {
    const concerns = [...house.incidents, ...house.safeguarding, ...(house.flags.red > 0 ? house.entries.filter(e => e.severity === 'red') : [])];
    html += `
    <div style="margin-bottom: 30px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #fffbeb; padding: 12px 20px; border-bottom: 1px solid #fde68a; font-weight: 900; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em;">${house.name}</div>
      <div style="padding: 20px;">
        <div style="margin-bottom: 15px;"><strong style="font-size: 10px; color: ${COLOR}; text-transform: uppercase;">Key Concerns:</strong>
          ${concerns.length > 0 ? concerns.slice(0, 5).map(c => `<div style="margin-top: 8px; font-size: 12px; border-left: 3px solid #fde68a; padding-left: 12px; color: #475569;">${c.client ? `<strong>${ex(c.client)}:</strong> ` : ''}${ex(truncate(c.entry, 200))}</div>`).join('') : '<div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">No critical concerns flagged for this period.</div>'}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
          <div><strong style="font-size: 10px; color: #64748b; text-transform: uppercase;">Medication:</strong><div style="font-size: 11px; margin-top: 5px;">${house.medication.length} updates logged</div></div>
          <div><strong style="font-size: 10px; color: #64748b; text-transform: uppercase;">Logs:</strong><div style="font-size: 11px; margin-top: 5px;">${house.entries.length} total entries</div></div>
        </div>
      </div>
    </div>`;
  }
  html += FOOTER_HTML + `</div>`;
  return html;
}

function generateSupervisionReport(mon: TemplateImportContext | null): string {
  const COLOR = '#7c3aed';
  const meetingDate = mon?.at ? new Date(mon.at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  let html = `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff; min-height: 100%; display: flex; flex-direction: column; padding: 40px;">`;
  html += renderHeader('Staff Supervision Record', `CONFIDENTIAL PERSONNEL DOCUMENT`, COLOR);
  html += monitoringContextBlock(mon);

  html += `
  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 30px;">
    <tr><td style="padding: 12px; background: #f8fafc; font-weight: 700; width: 150px; border: 1px solid #e2e8f0;">Staff Name</td><td style="padding: 12px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px; background: #f8fafc; font-weight: 700; width: 150px; border: 1px solid #e2e8f0;">Supervisor</td><td style="padding: 12px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px; background: #f8fafc; font-weight: 700; border: 1px solid #e2e8f0;">Date</td><td style="padding: 12px; border: 1px solid #e2e8f0;">${meetingDate}</td><td style="padding: 12px; background: #f8fafc; font-weight: 700; border: 1px solid #e2e8f0;">Location</td><td style="padding: 12px; border: 1px solid #e2e8f0;"></td></tr>
  </table>
  <div style="margin-bottom: 25px;"><h2 style="font-size: 11px; text-transform: uppercase; color: ${COLOR}; border-bottom: 1px solid #ddd; padding-bottom: 5px;">1. Performance Review</h2><div style="height: 120px; border: 1px solid #e2e8f0; margin-top: 10px; border-radius: 8px;"></div></div>
  <div style="margin-bottom: 25px;"><h2 style="font-size: 11px; text-transform: uppercase; color: ${COLOR}; border-bottom: 1px solid #ddd; padding-bottom: 5px;">2. Professional Development</h2><div style="height: 120px; border: 1px solid #e2e8f0; margin-top: 10px; border-radius: 8px;"></div></div>
  <div style="margin-bottom: 25px;"><h2 style="font-size: 11px; text-transform: uppercase; color: ${COLOR}; border-bottom: 1px solid #ddd; padding-bottom: 5px;">3. Health & Wellbeing</h2><div style="height: 100px; border: 1px solid #e2e8f0; margin-top: 10px; border-radius: 8px;"></div></div>
  <div style="margin-top: 40px; display: flex; justify-content: space-between;"><div style="width: 45%; border-top: 1px solid #334155; padding-top: 8px; font-size: 10px; font-weight: 700;">Supervisor Signature</div><div style="width: 45%; border-top: 1px solid #334155; padding-top: 8px; font-size: 10px; font-weight: 700;">Staff Signature</div></div>
  ` + FOOTER_HTML + `</div>`;
  return html;
}

function generateSafeguardingReport(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#be185d';
  const safeguarding = Object.values(data.houses).flatMap(h => h.safeguarding);
  let html = `<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff; min-height: 100%; display: flex; flex-direction: column; padding: 40px;">`;
  html += renderHeader('Safeguarding Concern Audit', `STRICTLY CONFIDENTIAL · PROTECTED DATA`, COLOR);
  html += monitoringContextBlock(mon);

  html += `
  <div style="background: #fdf2f8; border: 1px solid #fbcfe8; padding: 15px 20px; border-radius: 12px; margin-bottom: 25px; color: #9d174d; font-size: 13px; font-weight: 700;">
    ${safeguarding.length} SAFEGUARDING CONCERNS IDENTIFIED IN THIS PERIOD
  </div>`;

  for (const e of safeguarding) {
    html += `
    <div style="border: 1px solid #fbcfe8; border-radius: 12px; margin-bottom: 15px; overflow: hidden; page-break-inside: avoid;">
      <div style="background: #fdf2f8; padding: 10px 15px; display: flex; justify-content: space-between; border-bottom: 1px solid #fbcfe8;">
        <span style="font-weight: 900; font-size: 11px;">${ex(e.house)} · ${ex(e.client)}</span>
        <span style="font-weight: 900; font-size: 11px;">${ex(e.date)}</span>
      </div>
      <div style="padding: 15px; font-size: 13px; line-height: 1.6; color: #334155;">${ex(e.entry)}</div>
    </div>`;
  }
  html += FOOTER_HTML + `</div>`;
  return html;
}

function generateTemplate(type: TemplateType, data: WeekSummary, importCtx: TemplateImportContext | null): string {
  const mon = importCtx?.source === 'staff-monitoring' ? importCtx : null;
  let html: string;
  switch (type) {
    case 'quality_meeting':
      html = generateQualityMeeting(data, mon);
      break;
    case 'daily_quality':
      html = generateDailyQuality(data, mon);
      break;
    case 'incident_report':
      html = generateIncidentReport(data, mon);
      break;
    case 'handover':
      html = generateHandoverReport(data, mon);
      break;
    case 'supervision':
      html = generateSupervisionReport(mon);
      break;
    case 'safeguarding':
      html = generateSafeguardingReport(data, mon);
      break;
    case 'medication_audit':
      html = generateMedicationAudit(data, mon);
      break;
    case 'finance':
      html = generateFinanceReport(data, mon);
      break;
    default:
      html = generateQualityMeeting(data, mon);
  }
  return html;
}

export function TemplatesPage({ weekData }: Props) {
  const [selected, setSelected] = useState<TemplateType | null>(null);
  const [generated, setGenerated] = useState('');
  const [recommendedTemplateIds] = useState<TemplateType[]>(() => loadRecommendedTemplateIds());
  const [monitoringSnapshot, setMonitoringSnapshot] = useState<TemplateImportContext | null>(() => readTemplateImportContext());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function templateSignal(type: TemplateType): { label: string; value: number } {
    if (!weekData) return { label: 'Signals', value: 0 };
    const houses = Object.values(weekData.houses);
    switch (type) {
      case 'incident_report':
        return { label: 'Incidents', value: houses.reduce((sum, h) => sum + h.incidents.length, 0) };
      case 'safeguarding':
        return { label: 'Safeguarding', value: houses.reduce((sum, h) => sum + h.safeguarding.length, 0) };
      case 'medication_audit':
        return { label: 'Medication', value: houses.reduce((sum, h) => sum + h.medication.length, 0) };
      case 'finance':
        return {
          label: 'Finance Flags',
          value: Object.values(weekData.houses).flatMap((h) => h.entries).filter((e) =>
            e.flags.some((f) => {
              const k = f.toLowerCase();
              return k.includes('finance') || k.includes('money') || k.includes('shopping');
            })
          ).length,
        };
      default:
        return { label: 'Entries', value: weekData.totalEntries };
    }
  }

  const handleGenerate = useCallback((type: TemplateType) => {
    if (!weekData) return;
    setSelected(type);
    const ctx = readTemplateImportContext();
    setMonitoringSnapshot(ctx);
    const html = generateTemplate(type, weekData, ctx?.source === 'staff-monitoring' ? ctx : null);
    setGenerated(html);
  }, [weekData]);

  useEffect(() => {
    if (recommendedTemplateIds.length > 0 && weekData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleGenerate(recommendedTemplateIds[0]);
    }
  }, [handleGenerate, recommendedTemplateIds, weekData]);

  function handlePrint() {
    const win = iframeRef.current?.contentWindow;
    if (win) win.print();
  }

  if (!weekData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-2xl glass border border-hc-teal/20 flex items-center justify-center mb-8 glow-teal animate-float">
          <span className="text-4xl">📋</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3 text-gradient">Template Generator</h2>
        <p className="text-hc-muted text-sm mb-8 text-center max-w-xs leading-relaxed">Import care data to auto-fill templates with up-to-date care information.</p>
        <button onClick={() => window.location.reload()} className="btn-gradient px-8 py-3 rounded-xl shadow-lg transition-all">Import Data</button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1700px] mx-auto animate-in fade-in duration-700">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-extrabold text-white mb-1 tracking-tight text-shimmer">Report Templates</h1>
        <div className="flex items-center gap-3">
          <span className="pill pill-teal text-[10px] font-black uppercase tracking-wider shadow-lg">Report Generator</span>
          <p className="text-hc-muted text-[10px] font-bold uppercase tracking-widest ml-1 tabular-nums">
            Processing {weekData.totalEntries} entries across {Object.keys(weekData.houses).length} houses
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="pill text-[10px] font-black uppercase tracking-wide border border-flag-red/30 text-flag-red bg-flag-red/10">
            Red Flags {weekData.allFlags.red.length}
          </span>
          <span className="pill text-[10px] font-black uppercase tracking-wide border border-flag-amber/30 text-flag-amber bg-flag-amber/10">
            Amber Flags {weekData.allFlags.amber.length}
          </span>
        </div>
        {monitoringSnapshot?.source === 'staff-monitoring' && (
          <div className="mt-4 glass-light border border-hc-teal/35 rounded-2xl px-4 py-3 text-sm text-hc-text max-w-3xl">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-hc-teal-light mb-1">Staff Intelligence context loaded</div>
            <p className="text-xs text-white/90 leading-relaxed">
              {monitoringSnapshot.dateFrom && monitoringSnapshot.dateTo
                ? `Window ${monitoringSnapshot.dateFrom} — ${monitoringSnapshot.dateTo}`
                : 'Monitoring window from registry'}
              {monitoringSnapshot.house ? ` · House: ${monitoringSnapshot.house}` : ' · All houses'}
              {monitoringSnapshot.escalationCount != null && monitoringSnapshot.escalationCount > 0
                ? ` · ${monitoringSnapshot.escalationCount} escalation(s) queued`
                : ''}
              {monitoringSnapshot.avgHouseQuality != null ? ` · Avg quality ${monitoringSnapshot.avgHouseQuality}/100` : ''}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 lg:mb-8">
        {TEMPLATES.map((tpl, idx) => (
          <button
            key={tpl.id}
            onClick={() => handleGenerate(tpl.id)}
            className={`text-left p-6 rounded-[2rem] border transition-all duration-500 group relative overflow-hidden card-glow animate-in slide-in-from-bottom-4 ${
              selected === tpl.id
                ? 'border-hc-teal/40 bg-hc-teal/10 glow-teal'
                : recommendedTemplateIds.includes(tpl.id)
                ? 'border-hc-teal/20 glass-light hover:border-hc-teal/30 hover:bg-white/[0.02]'
                : 'border-white/10 glass-light hover:border-hc-teal/30 hover:bg-white/[0.02]'
            }`}
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.03] blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:opacity-[0.08] transition-opacity" style={{ background: tpl.color }} />
            <div className="text-3xl mb-4 flex items-center justify-center w-14 h-14 rounded-2xl glass border border-white/5 shadow-2xl">
              {tpl.icon}
            </div>
            <div className="text-sm font-black text-white mb-2 group-hover:text-hc-teal-light transition-colors tracking-tight leading-tight uppercase">{tpl.name}</div>
            <div className="text-[10px] font-medium text-hc-muted leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity mb-6">{tpl.desc}</div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-hc-muted">{templateSignal(tpl.id).label}</span>
              <span className="text-[10px] font-black text-white tabular-nums">{templateSignal(tpl.id).value}</span>
            </div>
            {recommendedTemplateIds.includes(tpl.id) && (
              <div className="mb-3 text-[9px] font-black text-hc-teal-light uppercase tracking-[0.2em]">
                Recommended from import
              </div>
            )}
            <div className="mt-auto text-[9px] font-black flex items-center gap-2 uppercase tracking-[0.2em] transition-all group-hover:gap-3" style={{ color: tpl.color }}>
              Generate Report <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </div>
          </button>
        ))}
      </div>

      {generated && (
        <div className="animate-in zoom-in-95 duration-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 glass-light border border-white/5 p-6 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-hc-teal/10 border border-hc-teal/20 flex items-center justify-center shrink-0 shadow-lg glow-teal">
                <span className="text-2xl">📄</span>
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase text-shimmer">Report Ready</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
                  <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60">Review the document below before printing</p>
                </div>
              </div>
            </div>
            <button onClick={handlePrint} className="w-full md:w-auto flex items-center justify-center gap-3 px-10 py-4 btn-gradient text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:scale-[1.02] transition-all group">
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.821V21m0 0h10.56m-10.56 0V13.821m10.56 7.179V13.821M17.28 21h3.36V13.821m-3.36 7.179H17.28m-10.56 0H3.36V13.821m0 7.179h3.36m13.92-7.179a1.44 1.44 0 00-1.44-1.44h-15.84a1.44 1.44 0 00-1.44 1.44v5.76a1.44 1.44 0 001.44 1.44h15.84a1.44 1.44 0 001.44-1.44v-5.76zm-13.92-3.6h12.48a1.44 1.44 0 001.44-1.44V4.8a1.44 1.44 0 00-1.44-1.44H6.72a1.44 1.44 0 00-1.44 1.44v4.32a1.44 1.44 0 001.44 1.44z" />
              </svg>
              Print / Save as PDF
            </button>
          </div>
          <div className="bg-white rounded-[3rem] overflow-hidden border-4 border-white/5 shadow-2xl p-1">
            <iframe ref={iframeRef} srcDoc={`<!DOCTYPE html><html><head><style>body{margin:0;padding:40px;background:#f8fafc;}@media print{body{padding:0;background:#fff;}}</style></head><body>${generated}</body></html>`} className="w-full" style={{ minHeight: '900px' }} title="Generated Template" />
          </div>
        </div>
      )}
    </div>
  );
}
