import { useState, useRef } from 'react';
import type { WeekSummary, NourishEntry, TemplateType } from '../lib/types';
import { TEMPLATES } from '../lib/types';

interface Props {
  weekData: WeekSummary | null;
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

const FOOTER_HTML = `
  <div style="text-align: center; color: #94a3b8; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; margin-top: 40px; padding-top: 16px; border-top: 2px solid #f1f5f9; text-transform: uppercase;">
    HAZEL CARE LTD
  </div>
`;

function generateQualityMeeting(data: WeekSummary): string {
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  const redFlags = data.allFlags.red;
  const amberFlags = data.allFlags.amber;

  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px;">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f766e; text-transform: uppercase; letter-spacing: -0.02em;">Quality & Performance Meeting</h1>
      <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b;">WEEK: ${data.dateFrom || '___'} — ${data.dateTo || '___'} · ${data.totalEntries} ENTRIES ANALYSED</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-weight: 900; font-size: 12px; color: #0f766e; text-align: right; line-height: 1;">HAZEL CARE<br/><span style="font-size: 8px; opacity: 0.6;">OPERATIONS</span></div>
      <img src="/logo-icon-dark.png" style="height: 40px; border-radius: 8px;" />
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
    <tr><td style="padding: 10px 15px; background: #f8fafc; font-weight: 700; width: 180px; border: 1px solid #e2e8f0; text-transform: uppercase; font-size: 11px;">Date</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">${new Date().toLocaleDateString('en-GB')}</td></tr>
    <tr><td style="padding: 10px 15px; background: #f8fafc; font-weight: 700; border: 1px solid #e2e8f0; text-transform: uppercase; font-size: 11px;">Chair</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 10px 15px; background: #f8fafc; font-weight: 700; border: 1px solid #e2e8f0; text-transform: uppercase; font-size: 11px;">Attendees</td><td style="padding: 10px 15px; border: 1px solid #e2e8f0;">${data.carers.slice(0, 8).join(', ')}</td></tr>
  </table>

  <h2 style="font-size: 15px; font-weight: 800; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 6px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">Weekly Summary</h2>
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
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
      <div style="font-size: 32px; font-weight: 900; color: #0f766e; line-height: 1;">${houses.length}</div>
      <div style="font-size: 9px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Houses</div>
    </div>
  </div>`;

  if (redFlags.length > 0) {
    html += `<h2 style="font-size: 15px; font-weight: 800; color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">🔴 RED FLAG ALERTS — IMMEDIATE ATTENTION</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
      <tr style="background: #f8fafc;"><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 120px;">House</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 120px;">Client</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Details</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 150px;">Flags</th></tr>`;
    for (const e of redFlags) {
      html += `<tr><td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 700;">${e.house}</td><td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 700;">${e.client || '—'}</td><td style="padding: 10px; border: 1px solid #e2e8f0; line-height: 1.5;">${e.entry}</td><td style="padding: 10px; border: 1px solid #e2e8f0; color: #ef4444; font-weight: 700;">${e.flags.join(', ')}</td></tr>`;
    }
    html += `</table>`;
  }

  html += `<h2 style="font-size: 15px; font-weight: 800; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 6px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">House Breakdown</h2>`;
  for (const house of houses) {
    const hasIssues = house.flags.red > 0 || house.flags.amber > 0;
    html += `
    <div style="page-break-inside: avoid; margin-bottom: 20px; border: 1px solid ${hasIssues ? '#fecaca' : '#e2e8f0'}; border-radius: 12px; overflow: hidden; background: #fff;">
      <div style="background: ${hasIssues ? '#fef2f2' : '#f8fafc'}; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${hasIssues ? '#fecaca' : '#e2e8f0'};">
        <div>
          <strong style="font-size: 15px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.02em;">${house.name}</strong>
          ${house.coordinator ? `<span style="font-size: 11px; font-weight: 700; color: #64748b; margin-left: 12px; text-transform: uppercase; letter-spacing: 0.05em;">LEAD: ${house.coordinator}</span>` : ''}
        </div>
        <div style="display: flex; gap: 8px;">
          ${house.flags.red > 0 ? `<span style="background: #ef4444; color: white; font-size: 9px; font-weight: 900; padding: 3px 10px; border-radius: 99px; text-transform: uppercase;">${house.flags.red} RED</span>` : ''}
          ${house.flags.amber > 0 ? `<span style="background: #f59e0b; color: white; font-size: 9px; font-weight: 900; padding: 3px 10px; border-radius: 99px; text-transform: uppercase;">${house.flags.amber} AMBER</span>` : ''}
          <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(0,0,0,0.05); padding: 3px 10px; border-radius: 99px;">${house.entries.length} LOGS</span>
        </div>
      </div>
      <div style="padding: 16px 20px; font-size: 12px;">`;

    const sections: [string, NourishEntry[]][] = [
      ['Incidents & Safety', house.incidents],
      ['Safeguarding', house.safeguarding],
      ['Medication Management', house.medication],
      ['Operational Support', house.dailySupport],
    ];

    for (const [label, items] of sections) {
      if (items.length > 0) {
        html += `<div style="margin-bottom: 12px;"><strong style="color: #0f766e; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">${label}:</strong>`;
        for (const item of items.slice(0, 10)) {
          html += `<div style="margin-left: 12px; margin-top: 6px; color: #475569; line-height: 1.5; position: relative; padding-left: 12px;">
            <span style="position: absolute; left: 0; color: #94a3b8;">•</span>
            ${item.client ? `<strong>${item.client}:</strong> ` : ''}${truncate(item.entry, 250)}
          </div>`;
        }
        html += `</div>`;
      }
    }
    html += `</div></div>`;
  }

  html += `
  <h2 style="font-size: 15px; font-weight: 800; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 6px; margin-top: 32px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">Decisions & Actions</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 32px;">
    <tr style="background: #f8fafc;"><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 40px;">ID</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Strategic Action</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 150px;">Owner</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 100px;">Deadline</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase; width: 80px;">Status</th></tr>
    <tr><td style="padding: 15px 10px; border: 1px solid #e2e8f0;">1</td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #94a3b8;">OPEN</td></tr>
    <tr><td style="padding: 15px 10px; border: 1px solid #e2e8f0;">2</td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 15px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #94a3b8;">OPEN</td></tr>
  </table>
  ${FOOTER_HTML}
</div>`;
  return html;
}

function generateIncidentReport(data: WeekSummary): string {
  const incidents = [...data.allFlags.red, ...data.allFlags.amber.filter(e => e.flags.some(f => f.includes('incident') || f.includes('police') || f.includes('ambulance')))];
  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid #dc2626; padding-bottom: 16px; margin-bottom: 24px;">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #dc2626; text-transform: uppercase; letter-spacing: -0.02em;">Incident Report</h1>
      <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b;">PERIOD: ${data.dateFrom || '___'} — ${data.dateTo || '___'}</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-weight: 900; font-size: 12px; color: #dc2626; text-align: right; line-height: 1;">HAZEL CARE<br/><span style="font-size: 8px; opacity: 0.6;">OPERATIONS</span></div>
      <img src="/logo-icon-dark.png" style="height: 40px; border-radius: 8px;" />
    </div>
  </div>
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
        ${e.entry}
      </div>
    </div>`;
  }
  html += FOOTER_HTML + `</div>`;
  return html;
}

function generateDailyQuality(data: WeekSummary): string {
  const COLOR = '#1e40af';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  const redFlags = data.allFlags.red;
  const amberFlags = data.allFlags.amber;
  const allFlagged = [...redFlags, ...amberFlags];

  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid ${COLOR}; padding-bottom: 16px; margin-bottom: 24px;">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: ${COLOR}; text-transform: uppercase; letter-spacing: -0.02em;">Daily Quality Briefing</h1>
      <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b;">DATE: ${new Date().toLocaleDateString('en-GB').toUpperCase()}</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-weight: 900; font-size: 12px; color: ${COLOR}; text-align: right; line-height: 1;">HAZEL CARE<br/><span style="font-size: 8px; opacity: 0.6;">OPERATIONS</span></div>
      <img src="/logo-icon-dark.png" style="height: 40px; border-radius: 8px;" />
    </div>
  </div>

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
      <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 800;">${house.name}</td>
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
        <strong>${e.house}:</strong> ${truncate(e.entry, 200)}
      </div>`;
    }
  }
  html += FOOTER_HTML + `</div>`;
  return html;
}

function generateFinanceReport(data: WeekSummary): string {
  const financeEntries = Object.values(data.houses).flatMap(h => h.entries.filter(e => e.flags.some(f => f.toLowerCase().includes('finance') || f.toLowerCase().includes('money') || f.toLowerCase().includes('shopping'))));
  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid #059669; padding-bottom: 16px; margin-bottom: 24px;">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #059669; text-transform: uppercase; letter-spacing: -0.02em;">Finance & Petty Cash Audit</h1>
      <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b;">PERIOD: ${data.dateFrom || '___'} — ${data.dateTo || '___'}</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-weight: 900; font-size: 12px; color: #059669; text-align: right; line-height: 1;">HAZEL CARE<br/><span style="font-size: 8px; opacity: 0.6;">OPERATIONS</span></div>
      <img src="/logo-icon-dark.png" style="height: 40px; border-radius: 8px;" />
    </div>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
    <tr style="background: #f0fdf4;"><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">House</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Client</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Transaction Details</th></tr>`;
  for (const e of financeEntries) {
    html += `<tr><td style="padding: 10px; border: 1px solid #e2e8f0;">${e.house}</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${e.client}</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${e.entry}</td></tr>`;
  }
  html += `</table>` + FOOTER_HTML + `</div>`;
  return html;
}

function generateMedicationAudit(data: WeekSummary): string {
  const medEntries = Object.values(data.houses).flatMap(h => h.medication);
  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid #0891b2; padding-bottom: 16px; margin-bottom: 24px;">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0891b2; text-transform: uppercase; letter-spacing: -0.02em;">Medication Administration Audit</h1>
      <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b;">PERIOD: ${data.dateFrom || '___'} — ${data.dateTo || '___'}</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-weight: 900; font-size: 12px; color: #0891b2; text-align: right; line-height: 1;">HAZEL CARE<br/><span style="font-size: 8px; opacity: 0.6;">OPERATIONS</span></div>
      <img src="/logo-icon-dark.png" style="height: 40px; border-radius: 8px;" />
    </div>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
    <tr style="background: #ecfeff;"><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">House</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Client</th><th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0; text-transform: uppercase;">Admin Details</th></tr>`;
  for (const e of medEntries) {
    html += `<tr><td style="padding: 10px; border: 1px solid #e2e8f0;">${e.house}</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${e.client}</td><td style="padding: 10px; border: 1px solid #e2e8f0;">${e.entry}</td></tr>`;
  }
  html += `</table>` + FOOTER_HTML + `</div>`;
  return html;
}

function generateHandoverReport(data: WeekSummary): string {
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid #d97706; padding-bottom: 16px; margin-bottom: 24px;">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #d97706; text-transform: uppercase; letter-spacing: -0.02em;">Shift Handover Report</h1>
      <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b;">DATE: ${new Date().toLocaleDateString('en-GB')} · ALL HOUSES</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-weight: 900; font-size: 12px; color: #d97706; text-align: right; line-height: 1;">HAZEL CARE<br/><span style="font-size: 8px; opacity: 0.6;">OPERATIONS</span></div>
      <img src="/logo-icon-dark.png" style="height: 40px; border-radius: 8px;" />
    </div>
  </div>`;

  for (const house of houses) {
    const concerns = [...house.incidents, ...house.safeguarding, ...(house.flags.red > 0 ? house.entries.filter(e => e.severity === 'red') : [])];
    html += `
    <div style="margin-bottom: 30px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #fffbeb; padding: 12px 20px; border-bottom: 1px solid #fde68a; font-weight: 900; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em;">${house.name}</div>
      <div style="padding: 20px;">
        <div style="margin-bottom: 15px;"><strong style="font-size: 10px; color: #d97706; text-transform: uppercase;">Key Concerns:</strong>
          ${concerns.length > 0 ? concerns.slice(0, 5).map(c => `<div style="margin-top: 8px; font-size: 12px; border-left: 3px solid #fde68a; padding-left: 12px; color: #475569;">${c.client ? `<strong>${c.client}:</strong> ` : ''}${truncate(c.entry, 200)}</div>`).join('') : '<div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">No critical concerns flagged for this period.</div>'}
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

function generateSupervisionReport(data: WeekSummary): string {
  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #7c3aed; text-transform: uppercase; letter-spacing: -0.02em;">Staff Supervision Record</h1>
      <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b;">CONFIDENTIAL PERSONNEL DOCUMENT</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-weight: 900; font-size: 12px; color: #7c3aed; text-align: right; line-height: 1;">HAZEL CARE<br/><span style="font-size: 8px; opacity: 0.6;">OPERATIONS</span></div>
      <img src="/logo-icon-dark.png" style="height: 40px; border-radius: 8px;" />
    </div>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 30px;">
    <tr><td style="padding: 12px; background: #f8fafc; font-weight: 700; width: 150px; border: 1px solid #e2e8f0;">Staff Name</td><td style="padding: 12px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px; background: #f8fafc; font-weight: 700; width: 150px; border: 1px solid #e2e8f0;">Supervisor</td><td style="padding: 12px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px; background: #f8fafc; font-weight: 700; border: 1px solid #e2e8f0;">Date</td><td style="padding: 12px; border: 1px solid #e2e8f0;">${new Date().toLocaleDateString('en-GB')}</td><td style="padding: 12px; background: #f8fafc; font-weight: 700; border: 1px solid #e2e8f0;">Location</td><td style="padding: 12px; border: 1px solid #e2e8f0;"></td></tr>
  </table>
  <div style="margin-bottom: 25px;"><h2 style="font-size: 11px; text-transform: uppercase; color: #7c3aed; border-bottom: 1px solid #ddd; padding-bottom: 5px;">1. Performance Review</h2><div style="height: 120px; border: 1px solid #e2e8f0; margin-top: 10px; border-radius: 8px;"></div></div>
  <div style="margin-bottom: 25px;"><h2 style="font-size: 11px; text-transform: uppercase; color: #7c3aed; border-bottom: 1px solid #ddd; padding-bottom: 5px;">2. Professional Development</h2><div style="height: 120px; border: 1px solid #e2e8f0; margin-top: 10px; border-radius: 8px;"></div></div>
  <div style="margin-bottom: 25px;"><h2 style="font-size: 11px; text-transform: uppercase; color: #7c3aed; border-bottom: 1px solid #ddd; padding-bottom: 5px;">3. Health & Wellbeing</h2><div style="height: 100px; border: 1px solid #e2e8f0; margin-top: 10px; border-radius: 8px;"></div></div>
  <div style="margin-top: 40px; display: flex; justify-content: space-between;"><div style="width: 45%; border-top: 1px solid #334155; padding-top: 8px; font-size: 10px; font-weight: 700;">Supervisor Signature</div><div style="width: 45%; border-top: 1px solid #334155; padding-top: 8px; font-size: 10px; font-weight: 700;">Staff Signature</div></div>
  ` + FOOTER_HTML + `</div>`;
  return html;
}

function generateSafeguardingReport(data: WeekSummary): string {
  const safeguarding = Object.values(data.houses).flatMap(h => h.safeguarding);
  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px solid #be185d; padding-bottom: 16px; margin-bottom: 24px;">
    <div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #be185d; text-transform: uppercase; letter-spacing: -0.02em;">Safeguarding Concern Audit</h1>
      <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b;">STRICTLY CONFIDENTIAL · PROTECTED DATA</p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-weight: 900; font-size: 12px; color: #be185d; text-align: right; line-height: 1;">HAZEL CARE<br/><span style="font-size: 8px; opacity: 0.6;">OPERATIONS</span></div>
      <img src="/logo-icon-dark.png" style="height: 40px; border-radius: 8px;" />
    </div>
  </div>
  <div style="background: #fdf2f8; border: 1px solid #fbcfe8; padding: 15px 20px; border-radius: 12px; margin-bottom: 25px; color: #9d174d; font-size: 13px; font-weight: 700;">
    ${safeguarding.length} SAFEGUARDING CONCERNS IDENTIFIED IN THIS PERIOD
  </div>`;

  for (const e of safeguarding) {
    html += `
    <div style="border: 1px solid #fbcfe8; border-radius: 12px; margin-bottom: 15px; overflow: hidden; page-break-inside: avoid;">
      <div style="background: #fdf2f8; padding: 10px 15px; display: flex; justify-content: space-between; border-bottom: 1px solid #fbcfe8;">
        <span style="font-weight: 900; font-size: 11px;">${e.house} · ${e.client}</span>
        <span style="font-weight: 900; font-size: 11px;">${e.date}</span>
      </div>
      <div style="padding: 15px; font-size: 13px; line-height: 1.6; color: #334155;">${e.entry}</div>
    </div>`;
  }
  html += FOOTER_HTML + `</div>`;
  return html;
}

function generateTemplate(type: TemplateType, data: WeekSummary): string {
  switch (type) {
    case 'quality_meeting':   return generateQualityMeeting(data);
    case 'daily_quality':     return generateDailyQuality(data);
    case 'incident_report':   return generateIncidentReport(data);
    case 'handover':          return generateHandoverReport(data);
    case 'supervision':       return generateSupervisionReport(data);
    case 'safeguarding':      return generateSafeguardingReport(data);
    case 'medication_audit':  return generateMedicationAudit(data);
    case 'finance':           return generateFinanceReport(data);
    default: return generateQualityMeeting(data);
  }
}

export function TemplatesPage({ weekData }: Props) {
  const [selected, setSelected] = useState<TemplateType | null>(null);
  const [generated, setGenerated] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function handleGenerate(type: TemplateType) {
    if (!weekData) return;
    setSelected(type);
    const html = generateTemplate(type, weekData);
    setGenerated(html);
  }

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
        <p className="text-hc-muted text-sm mb-8 text-center max-w-xs leading-relaxed">Import Nourish data to auto-fill templates with up-to-date care information.</p>
        <button onClick={() => window.location.reload()} className="btn-gradient px-8 py-3 rounded-xl shadow-lg transition-all">Import Data</button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-extrabold text-white mb-1 tracking-tight text-shimmer">Report Templates</h1>
        <div className="flex items-center gap-3">
          <span className="pill pill-teal text-[10px] font-black uppercase tracking-wider shadow-lg">Report Generator</span>
          <p className="text-hc-muted text-[10px] font-bold uppercase tracking-widest ml-1 tabular-nums">
            Processing {weekData.totalEntries} entries across {Object.keys(weekData.houses).length} houses
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 lg:mb-8">
        {TEMPLATES.map((tpl, idx) => (
          <button
            key={tpl.id}
            onClick={() => handleGenerate(tpl.id)}
            className={`text-left p-6 rounded-[2rem] border transition-all duration-500 group relative overflow-hidden card-glow animate-in slide-in-from-bottom-4 ${
              selected === tpl.id
                ? 'border-hc-teal/40 bg-hc-teal/10 glow-teal'
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
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
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
