import { useState, useRef } from 'react';
import type { WeekSummary, NourishEntry, TemplateType } from '../lib/types';
import { TEMPLATES } from '../lib/types';

interface Props {
  weekData: WeekSummary | null;
}

function generateQualityMeeting(data: WeekSummary): string {
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  const redFlags = data.allFlags.red;
  const amberFlags = data.allFlags.amber;

  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b;">
  <div style="display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="/hazelcare-logo.png" style="height: 48px;" />
    <div>
      <h1 style="margin: 0; font-size: 22px; color: #0f766e;">Quality & Performance Meeting</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Week: ${data.dateFrom || '___'} — ${data.dateTo || '___'} · ${data.totalEntries} entries analysed</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
    <tr><td style="padding: 6px 12px; background: #f1f5f9; font-weight: 600; width: 160px;">Date</td><td style="padding: 6px 12px; border: 1px solid #e2e8f0;">${new Date().toLocaleDateString('en-GB')}</td></tr>
    <tr><td style="padding: 6px 12px; background: #f1f5f9; font-weight: 600;">Chair</td><td style="padding: 6px 12px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 6px 12px; background: #f1f5f9; font-weight: 600;">Attendees</td><td style="padding: 6px 12px; border: 1px solid #e2e8f0;">${data.carers.slice(0, 5).join(', ')}</td></tr>
  </table>

  <h2 style="font-size: 16px; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 6px;">Executive Summary</h2>
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${redFlags.length}</div>
      <div style="font-size: 11px; color: #64748b;">Red Flags</div>
    </div>
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${amberFlags.length}</div>
      <div style="font-size: 11px; color: #64748b;">Amber Flags</div>
    </div>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${data.totalEntries - redFlags.length - amberFlags.length}</div>
      <div style="font-size: 11px; color: #64748b;">Routine</div>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 24px; font-weight: 700; color: #1e293b;">${houses.length}</div>
      <div style="font-size: 11px; color: #64748b;">Houses</div>
    </div>
  </div>`;

  // Red flags section
  if (redFlags.length > 0) {
    html += `<h2 style="font-size: 16px; color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 6px;">🔴 Red Flags — Immediate Attention</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
      <tr style="background: #fef2f2;"><th style="padding: 8px; text-align: left; border: 1px solid #fecaca;">House</th><th style="padding: 8px; text-align: left; border: 1px solid #fecaca;">Client</th><th style="padding: 8px; text-align: left; border: 1px solid #fecaca;">Detail</th><th style="padding: 8px; text-align: left; border: 1px solid #fecaca;">Flags</th></tr>`;
    for (const e of redFlags) {
      html += `<tr><td style="padding: 8px; border: 1px solid #e2e8f0;">${e.house}</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${e.client || '—'}</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${truncate(e.entry, 120)}</td><td style="padding: 8px; border: 1px solid #e2e8f0; color: #ef4444;">${e.flags.join(', ')}</td></tr>`;
    }
    html += `</table>`;
  }

  // Amber flags section
  if (amberFlags.length > 0) {
    html += `<h2 style="font-size: 16px; color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 6px;">🟡 Amber Flags — Monitor</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
      <tr style="background: #fffbeb;"><th style="padding: 8px; text-align: left; border: 1px solid #fde68a;">House</th><th style="padding: 8px; text-align: left; border: 1px solid #fde68a;">Client</th><th style="padding: 8px; text-align: left; border: 1px solid #fde68a;">Detail</th><th style="padding: 8px; text-align: left; border: 1px solid #fde68a;">Flags</th></tr>`;
    for (const e of amberFlags) {
      html += `<tr><td style="padding: 8px; border: 1px solid #e2e8f0;">${e.house}</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${e.client || '—'}</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${truncate(e.entry, 120)}</td><td style="padding: 8px; border: 1px solid #e2e8f0; color: #f59e0b;">${e.flags.join(', ')}</td></tr>`;
    }
    html += `</table>`;
  }

  // House-by-house
  for (const house of houses) {
    const hasIssues = house.flags.red > 0 || house.flags.amber > 0;
    html += `
    <div style="page-break-inside: avoid; margin-bottom: 16px; border: 1px solid ${hasIssues ? '#fecaca' : '#e2e8f0'}; border-radius: 8px; overflow: hidden;">
      <div style="background: ${hasIssues ? '#fef2f2' : '#f8fafc'}; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="font-size: 14px;">${house.name}</strong>
          ${house.coordinator ? `<span style="font-size: 12px; color: #64748b; margin-left: 8px;">${house.coordinator}</span>` : ''}
        </div>
        <div style="display: flex; gap: 6px;">
          ${house.flags.red > 0 ? `<span style="background: #ef4444; color: white; font-size: 10px; padding: 2px 8px; border-radius: 99px;">${house.flags.red} red</span>` : ''}
          ${house.flags.amber > 0 ? `<span style="background: #f59e0b; color: white; font-size: 10px; padding: 2px 8px; border-radius: 99px;">${house.flags.amber} amber</span>` : ''}
          <span style="font-size: 11px; color: #64748b;">${house.entries.length} entries</span>
        </div>
      </div>
      <div style="padding: 12px 16px; font-size: 12px;">`;

    const sections: [string, NourishEntry[]][] = [
      ['Incidents', house.incidents],
      ['Safeguarding', house.safeguarding],
      ['Medication', house.medication],
      ['Health & Safety', house.healthSafety],
      ['Staff Performance', house.staffPerformance],
      ['Handovers', house.handovers],
      ['Daily Support', house.dailySupport],
    ];

    for (const [label, items] of sections) {
      if (items.length > 0) {
        html += `<div style="margin-bottom: 8px;"><strong style="color: #0f766e;">${label}:</strong>`;
        for (const item of items) {
          html += `<div style="margin-left: 12px; margin-top: 4px; color: #475569;">• ${truncate(item.entry, 200)}</div>`;
        }
        html += `</div>`;
      }
    }

    if (house.entries.length === 0) {
      html += `<div style="color: #94a3b8; font-style: italic;">No entries this week</div>`;
    }

    html += `</div></div>`;
  }

  html += `
  <h2 style="font-size: 16px; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 6px;">Decisions & Actions</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
    <tr style="background: #f1f5f9;"><th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">#</th><th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Action</th><th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Owner</th><th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Due</th><th style="padding: 8px; text-align: left; border: 1px solid #e2e8f0;">Status</th></tr>
    <tr><td style="padding: 8px; border: 1px solid #e2e8f0;">1</td><td style="padding: 8px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px; border: 1px solid #e2e8f0;">Open</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #e2e8f0;">2</td><td style="padding: 8px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px; border: 1px solid #e2e8f0;">Open</td></tr>
  </table>

  <div style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div>
</div>`;

  return html;
}

function generateIncidentReport(data: WeekSummary): string {
  const incidents = [...data.allFlags.red, ...data.allFlags.amber.filter(e => e.flags.some(f => f.includes('incident') || f.includes('police') || f.includes('ambulance')))];

  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b;">
  <div style="display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #dc2626; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="/hazelcare-logo.png" style="height: 48px;" />
    <div>
      <h1 style="margin: 0; font-size: 22px; color: #dc2626;">Incident Report Summary</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Period: ${data.dateFrom || '___'} — ${data.dateTo || '___'}</p>
    </div>
  </div>
  <p style="font-size: 13px; margin-bottom: 20px;">${incidents.length} incident(s) identified from ${data.totalEntries} diary entries.</p>`;

  for (const [i, e] of incidents.entries()) {
    html += `
    <div style="border: 1px solid ${e.severity === 'red' ? '#fecaca' : '#fde68a'}; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <strong>${i + 1}. ${e.house}</strong>
        <span style="background: ${e.severity === 'red' ? '#ef4444' : '#f59e0b'}; color: white; font-size: 10px; padding: 2px 10px; border-radius: 99px;">${e.severity.toUpperCase()}</span>
      </div>
      <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
        <tr><td style="padding: 4px 8px; color: #64748b; width: 100px;">Date</td><td>${e.date || '—'}</td></tr>
        <tr><td style="padding: 4px 8px; color: #64748b;">Client</td><td>${e.client || '—'}</td></tr>
        <tr><td style="padding: 4px 8px; color: #64748b;">Staff</td><td>${e.carer || '—'}</td></tr>
        <tr><td style="padding: 4px 8px; color: #64748b;">Type</td><td>${e.type || '—'}</td></tr>
        <tr><td style="padding: 4px 8px; color: #64748b;">Flags</td><td style="color: ${e.severity === 'red' ? '#ef4444' : '#f59e0b'};">${e.flags.join(', ')}</td></tr>
      </table>
      <div style="margin-top: 8px; padding: 8px; background: #f8fafc; border-radius: 4px; font-size: 12px; line-height: 1.6;">${e.entry}</div>
    </div>`;
  }

  html += `<div style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div></div>`;
  return html;
}

function generateDailyQuality(data: WeekSummary): string {
  const COLOR = '#1e40af';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  const redFlags = data.allFlags.red;
  const amberFlags = data.allFlags.amber;
  const allFlagged = [...redFlags, ...amberFlags];
  const medicationEntries = allFlagged.filter(e => e.category === 'medication');

  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; gap: 16px; border-bottom: 3px solid ${COLOR}; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="/hazelcare-logo.png" style="height: 48px;" />
    <div>
      <h1 style="margin: 0; font-size: 22px; color: ${COLOR};">Daily Quality Meeting</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Date: ${new Date().toLocaleDateString('en-GB')} · Period: ${data.dateFrom || '___'} — ${data.dateTo || '___'}</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
    <tr><td style="padding: 6px 12px; background: #eff6ff; font-weight: 600; width: 160px; border: 1px solid #bfdbfe;">Date</td><td style="padding: 6px 12px; border: 1px solid #bfdbfe;">${new Date().toLocaleDateString('en-GB')}</td></tr>
    <tr><td style="padding: 6px 12px; background: #eff6ff; font-weight: 600; border: 1px solid #bfdbfe;">Chair</td><td style="padding: 6px 12px; border: 1px solid #bfdbfe;"></td></tr>
    <tr><td style="padding: 6px 12px; background: #eff6ff; font-weight: 600; border: 1px solid #bfdbfe;">Attendees</td><td style="padding: 6px 12px; border: 1px solid #bfdbfe;">${data.carers.slice(0, 6).join(', ') || '—'}</td></tr>
  </table>

  <h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Overnight Summary</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
    <tr style="background: #eff6ff;">
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">House</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">Coordinator</th>
      <th style="padding: 8px 10px; text-align: center; border: 1px solid #bfdbfe;">Entries</th>
      <th style="padding: 8px 10px; text-align: center; border: 1px solid #bfdbfe;">Red Flags</th>
      <th style="padding: 8px 10px; text-align: center; border: 1px solid #bfdbfe;">Amber Flags</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">Incidents</th>
    </tr>`;

  for (const house of houses) {
    const incidentCount = house.incidents.length;
    const rowBg = house.flags.red > 0 ? '#fef2f2' : house.flags.amber > 0 ? '#fffbeb' : '#fff';
    html += `<tr style="background: ${rowBg};">
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600;">${house.name}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; color: #64748b;">${house.coordinator || '—'}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${house.entries.length}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: ${house.flags.red > 0 ? '#ef4444' : '#64748b'}; font-weight: ${house.flags.red > 0 ? '700' : '400'};">${house.flags.red}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: ${house.flags.amber > 0 ? '#f59e0b' : '#64748b'};">${house.flags.amber}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${incidentCount > 0 ? `${incidentCount} incident(s)` : '—'}</td>
    </tr>`;
  }
  html += `</table>`;

  // Today's Priorities
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Today's Priorities</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
    <tr style="background: #eff6ff;">
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">#</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">House</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">Priority Action</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">Owner</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">Status</th>
    </tr>`;

  const criticalItems = redFlags.slice(0, 5);
  if (criticalItems.length === 0) {
    html += `<tr><td colspan="5" style="padding: 10px; border: 1px solid #e2e8f0; color: #94a3b8; font-style: italic; text-align: center;">No critical open actions identified</td></tr>`;
  } else {
    for (const [i, e] of criticalItems.entries()) {
      html += `<tr>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${i + 1}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.house}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${truncate(e.entry, 100)}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.carer || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; color: #ef4444; font-weight: 600;">Open</td>
      </tr>`;
    }
  }
  html += `</table>`;

  // Red/Amber flags overnight
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Red / Amber Flags Overnight</h2>`;
  if (allFlagged.length === 0) {
    html += `<p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">No flags recorded in this period.</p>`;
  } else {
    html += `<div style="margin-bottom: 24px;">`;
    for (const e of allFlagged) {
      const bg = e.severity === 'red' ? '#fef2f2' : '#fffbeb';
      const badge = e.severity === 'red' ? '#ef4444' : '#f59e0b';
      html += `<div style="background: ${bg}; border-left: 4px solid ${badge}; padding: 8px 12px; margin-bottom: 6px; border-radius: 0 4px 4px 0; font-size: 12px;">
        <span style="font-weight: 600;">${e.house}</span>${e.client ? ` — <em>${e.client}</em>` : ''} &nbsp;
        <span style="background: ${badge}; color: white; font-size: 10px; padding: 1px 7px; border-radius: 99px;">${e.severity.toUpperCase()}</span><br/>
        <span style="color: #475569; margin-top: 4px; display: block;">${truncate(e.entry, 160)}</span>
        ${e.flags.length ? `<span style="color: #94a3b8; font-size: 11px;">Flags: ${e.flags.join(', ')}</span>` : ''}
      </div>`;
    }
    html += `</div>`;
  }

  // Medications to monitor
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Medications to Monitor</h2>`;
  if (medicationEntries.length === 0) {
    html += `<p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">No medication flags in this period.</p>`;
  } else {
    html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
      <tr style="background: #eff6ff;">
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">House</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">Client</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">Date</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">Detail</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">Flags</th>
      </tr>`;
    for (const e of medicationEntries) {
      html += `<tr>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.house}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.client || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.date || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${truncate(e.entry, 120)}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; color: #f59e0b;">${e.flags.join(', ')}</td>
      </tr>`;
    }
    html += `</table>`;
  }

  // Signature row
  html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 32px;">Chair Signature</div>
      <div style="border-top: 1px solid #1e293b; padding-top: 4px; font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 32px;">On-Call Manager</div>
      <div style="border-top: 1px solid #1e293b; padding-top: 4px; font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
  </div>
  <div style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div>
</div>`;

  return html;
}

function generateHandover(data: WeekSummary): string {
  const COLOR = '#d97706';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  const redFlags = data.allFlags.red;

  // Collect all medication entries across houses
  const allMedEntries: NourishEntry[] = [];
  for (const house of houses) {
    allMedEntries.push(...house.medication);
  }

  // Task/repair type entries
  const taskEntries: NourishEntry[] = [];
  for (const house of houses) {
    for (const e of house.entries) {
      const typeLower = (e.type || '').toLowerCase();
      if (typeLower.includes('task') || typeLower.includes('repair') || typeLower.includes('maintenance')) {
        taskEntries.push(e);
      }
    }
  }

  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; gap: 16px; border-bottom: 3px solid ${COLOR}; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="/hazelcare-logo.png" style="height: 48px;" />
    <div>
      <h1 style="margin: 0; font-size: 22px; color: ${COLOR};">Shift Handover</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Period: ${data.dateFrom || '___'} — ${data.dateTo || '___'}</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
    <tr>
      <td style="padding: 6px 12px; background: #fffbeb; font-weight: 600; width: 160px; border: 1px solid #fde68a;">House</td>
      <td style="padding: 6px 12px; border: 1px solid #fde68a;"></td>
      <td style="padding: 6px 12px; background: #fffbeb; font-weight: 600; width: 120px; border: 1px solid #fde68a;">Date</td>
      <td style="padding: 6px 12px; border: 1px solid #fde68a;">${new Date().toLocaleDateString('en-GB')}</td>
    </tr>
    <tr>
      <td style="padding: 6px 12px; background: #fffbeb; font-weight: 600; border: 1px solid #fde68a;">Shift</td>
      <td style="padding: 6px 12px; border: 1px solid #fde68a;">
        <span style="margin-right: 16px;">&#9744; Day</span>
        <span>&#9744; Night</span>
      </td>
      <td style="padding: 6px 12px; background: #fffbeb; font-weight: 600; border: 1px solid #fde68a;">Staff Out</td>
      <td style="padding: 6px 12px; border: 1px solid #fde68a;"></td>
    </tr>
    <tr>
      <td style="padding: 6px 12px; background: #fffbeb; font-weight: 600; border: 1px solid #fde68a;">Staff In</td>
      <td colspan="3" style="padding: 6px 12px; border: 1px solid #fde68a;"></td>
    </tr>
  </table>

  <h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Client Updates</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
    <tr style="background: #fffbeb;">
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Client</th>
      <th style="padding: 8px 10px; text-align: center; border: 1px solid #fde68a;">Total Entries</th>
      <th style="padding: 8px 10px; text-align: center; border: 1px solid #fde68a;">Red Flags</th>
      <th style="padding: 8px 10px; text-align: center; border: 1px solid #fde68a;">Amber Flags</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Latest Note</th>
    </tr>`;

  for (const client of data.clients) {
    const clientEntries = data.clientDiary[client] || [];
    const clientRed = clientEntries.filter(e => e.severity === 'red').length;
    const clientAmber = clientEntries.filter(e => e.severity === 'amber').length;
    const latest = clientEntries[0];
    const rowBg = clientRed > 0 ? '#fef2f2' : clientAmber > 0 ? '#fffbeb' : '#fff';
    html += `<tr style="background: ${rowBg};">
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600;">${client}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${clientEntries.length}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: ${clientRed > 0 ? '#ef4444' : '#64748b'}; font-weight: ${clientRed > 0 ? '700' : '400'};">${clientRed}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: ${clientAmber > 0 ? '#f59e0b' : '#64748b'};">${clientAmber}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; color: #475569;">${latest ? truncate(latest.entry, 100) : '—'}</td>
    </tr>`;
  }
  html += `</table>`;

  // Incidents this period
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Incidents This Period</h2>`;
  if (redFlags.length === 0) {
    html += `<p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">No incidents recorded.</p>`;
  } else {
    html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
      <tr style="background: #fef2f2;">
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fecaca;">House</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fecaca;">Client</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fecaca;">Date</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fecaca;">Detail</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fecaca;">Flags</th>
      </tr>`;
    for (const e of redFlags) {
      html += `<tr>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.house}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.client || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.date || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${truncate(e.entry, 120)}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; color: #ef4444;">${e.flags.join(', ')}</td>
      </tr>`;
    }
    html += `</table>`;
  }

  // Medications
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Medications</h2>`;
  if (allMedEntries.length === 0) {
    html += `<p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">No medication entries this period.</p>`;
  } else {
    html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
      <tr style="background: #fffbeb;">
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">House</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Client</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Detail</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Staff</th>
      </tr>`;
    for (const e of allMedEntries) {
      html += `<tr>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.house}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.client || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${truncate(e.entry, 140)}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.carer || '—'}</td>
      </tr>`;
    }
    html += `</table>`;
  }

  // Outstanding Tasks
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Outstanding Tasks</h2>`;
  if (taskEntries.length === 0) {
    html += `<p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">No task or maintenance entries identified.</p>`;
  } else {
    html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
      <tr style="background: #fffbeb;">
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">House</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Type</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Detail</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Staff</th>
      </tr>`;
    for (const e of taskEntries) {
      html += `<tr>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.house}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.type || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${truncate(e.entry, 140)}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${e.carer || '—'}</td>
      </tr>`;
    }
    html += `</table>`;
  }

  // Carry Forward
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Carry Forward</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 32px;">
    <tr style="background: #fffbeb;">
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">#</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Item</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Action Required</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #fde68a;">Priority</th>
    </tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">1</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">2</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">3</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
  </table>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 32px;">Staff Handing Over</div>
      <div style="border-top: 1px solid #1e293b; padding-top: 4px; font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 32px;">Staff Taking Over</div>
      <div style="border-top: 1px solid #1e293b; padding-top: 4px; font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
  </div>
  <div style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div>
</div>`;

  return html;
}

function generateSupervision(_data: WeekSummary): string {
  const COLOR = '#7c3aed';
  const today = new Date();
  const nextDate = new Date(today);
  nextDate.setMonth(nextDate.getMonth() + 3);

  const html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; gap: 16px; border-bottom: 3px solid ${COLOR}; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="/hazelcare-logo.png" style="height: 48px;" />
    <div>
      <h1 style="margin: 0; font-size: 22px; color: ${COLOR};">Supervision Record</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Confidential — Staff Copy &amp; Supervisor Copy</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
    <tr>
      <td style="padding: 6px 12px; background: #f5f3ff; font-weight: 600; width: 200px; border: 1px solid #ddd6fe;">Staff Member</td>
      <td style="padding: 6px 12px; border: 1px solid #ddd6fe;"></td>
      <td style="padding: 6px 12px; background: #f5f3ff; font-weight: 600; width: 160px; border: 1px solid #ddd6fe;">Role</td>
      <td style="padding: 6px 12px; border: 1px solid #ddd6fe;"></td>
    </tr>
    <tr>
      <td style="padding: 6px 12px; background: #f5f3ff; font-weight: 600; border: 1px solid #ddd6fe;">Supervisor</td>
      <td style="padding: 6px 12px; border: 1px solid #ddd6fe;"></td>
      <td style="padding: 6px 12px; background: #f5f3ff; font-weight: 600; border: 1px solid #ddd6fe;">Date</td>
      <td style="padding: 6px 12px; border: 1px solid #ddd6fe;">${today.toLocaleDateString('en-GB')}</td>
    </tr>
    <tr>
      <td style="padding: 6px 12px; background: #f5f3ff; font-weight: 600; border: 1px solid #ddd6fe;">Next Supervision</td>
      <td colspan="3" style="padding: 6px 12px; border: 1px solid #ddd6fe;">${nextDate.toLocaleDateString('en-GB')}</td>
    </tr>
  </table>

  <h2 style="font-size: 14px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 5px; margin-bottom: 10px;">1. Workload &amp; Wellbeing</h2>
  <div style="border: 1px solid #ddd6fe; border-radius: 6px; padding: 12px; min-height: 80px; margin-bottom: 20px; font-size: 12px; color: #94a3b8; font-style: italic;">Notes...</div>

  <h2 style="font-size: 14px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 5px; margin-bottom: 10px;">2. Performance Review</h2>
  <div style="margin-bottom: 20px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px;">
      <tr style="background: #f5f3ff;">
        <th style="padding: 7px 10px; text-align: left; border: 1px solid #ddd6fe;">Area</th>
        <th style="padding: 7px 10px; text-align: center; border: 1px solid #ddd6fe; width: 80px;">Rating (1–5)</th>
        <th style="padding: 7px 10px; text-align: left; border: 1px solid #ddd6fe;">Comments</th>
      </tr>
      <tr><td style="padding: 8px 10px; border: 1px solid #e2e8f0;">Punctuality &amp; Attendance</td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td></tr>
      <tr><td style="padding: 8px 10px; border: 1px solid #e2e8f0;">Client Interaction &amp; Care Quality</td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td></tr>
      <tr><td style="padding: 8px 10px; border: 1px solid #e2e8f0;">Documentation &amp; Record Keeping</td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td></tr>
      <tr><td style="padding: 8px 10px; border: 1px solid #e2e8f0;">Teamwork &amp; Communication</td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td></tr>
      <tr><td style="padding: 8px 10px; border: 1px solid #e2e8f0;">Medication Administration</td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td></tr>
    </table>
  </div>

  <h2 style="font-size: 14px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 5px; margin-bottom: 10px;">3. Training &amp; Development</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
    <tr style="background: #f5f3ff;">
      <th style="padding: 7px 10px; text-align: left; border: 1px solid #ddd6fe;">Training Required</th>
      <th style="padding: 7px 10px; text-align: left; border: 1px solid #ddd6fe;">Expiry / Renewal Date</th>
      <th style="padding: 7px 10px; text-align: left; border: 1px solid #ddd6fe;">Status</th>
    </tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;">Moving &amp; Handling</td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;">Safeguarding Adults</td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;">Medication Administration</td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
  </table>

  <h2 style="font-size: 14px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 5px; margin-bottom: 10px;">4. Concerns or Grievances</h2>
  <div style="border: 1px solid #ddd6fe; border-radius: 6px; padding: 12px; min-height: 70px; margin-bottom: 20px; font-size: 12px; color: #94a3b8; font-style: italic;">Notes...</div>

  <h2 style="font-size: 14px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 5px; margin-bottom: 10px;">5. Actions Agreed</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 32px;">
    <tr style="background: #f5f3ff;">
      <th style="padding: 7px 10px; text-align: left; border: 1px solid #ddd6fe; width: 28px;">#</th>
      <th style="padding: 7px 10px; text-align: left; border: 1px solid #ddd6fe;">Action</th>
      <th style="padding: 7px 10px; text-align: left; border: 1px solid #ddd6fe; width: 120px;">Owner</th>
      <th style="padding: 7px 10px; text-align: left; border: 1px solid #ddd6fe; width: 100px;">Due Date</th>
    </tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">1</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">2</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">3</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">4</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">5</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
  </table>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Staff Member — I confirm this record is accurate</div>
      <div style="border: 1px solid #ddd6fe; border-radius: 4px; height: 48px; margin-bottom: 8px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Supervisor</div>
      <div style="border: 1px solid #ddd6fe; border-radius: 4px; height: 48px; margin-bottom: 8px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
  </div>
  <div style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div>
</div>`;

  return html;
}

function generateSafeguarding(data: WeekSummary): string {
  const COLOR = '#be185d';

  // Pull all safeguarding entries
  const safeguardingEntries: NourishEntry[] = [];
  for (const house of Object.values(data.houses)) {
    safeguardingEntries.push(...house.safeguarding);
  }
  // Also include any entries with category=safeguarding from allFlags
  const allFlaggedSG = [...data.allFlags.red, ...data.allFlags.amber].filter(
    e => e.category === 'safeguarding' && !safeguardingEntries.find(s => s.id === e.id)
  );
  const allSG = [...safeguardingEntries, ...allFlaggedSG];

  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; gap: 16px; border-bottom: 3px solid ${COLOR}; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="/hazelcare-logo.png" style="height: 48px;" />
    <div>
      <h1 style="margin: 0; font-size: 22px; color: ${COLOR};">Safeguarding Concern Report</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">CONFIDENTIAL — Restricted Distribution · Period: ${data.dateFrom || '___'} — ${data.dateTo || '___'}</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
    <tr>
      <td style="padding: 6px 12px; background: #fdf2f8; font-weight: 600; width: 180px; border: 1px solid #f9a8d4;">Date of Report</td>
      <td style="padding: 6px 12px; border: 1px solid #f9a8d4;">${new Date().toLocaleDateString('en-GB')}</td>
      <td style="padding: 6px 12px; background: #fdf2f8; font-weight: 600; width: 160px; border: 1px solid #f9a8d4;">Reporter</td>
      <td style="padding: 6px 12px; border: 1px solid #f9a8d4;"></td>
    </tr>
    <tr>
      <td style="padding: 6px 12px; background: #fdf2f8; font-weight: 600; border: 1px solid #f9a8d4;">Client Involved</td>
      <td style="padding: 6px 12px; border: 1px solid #f9a8d4;"></td>
      <td style="padding: 6px 12px; background: #fdf2f8; font-weight: 600; border: 1px solid #f9a8d4;">House</td>
      <td style="padding: 6px 12px; border: 1px solid #f9a8d4;"></td>
    </tr>
  </table>`;

  // Cases from data
  if (allSG.length > 0) {
    html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 16px;">Identified Safeguarding Entries (${allSG.length})</h2>`;
    for (const [i, e] of allSG.entries()) {
      const badge = e.severity === 'red' ? '#ef4444' : e.severity === 'amber' ? '#f59e0b' : '#64748b';
      html += `<div style="border: 1px solid #f9a8d4; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <strong style="font-size: 13px;">Case ${i + 1} — ${e.house}${e.client ? ' / ' + e.client : ''}</strong>
          <span style="background: ${badge}; color: white; font-size: 10px; padding: 2px 10px; border-radius: 99px;">${e.severity.toUpperCase()}</span>
        </div>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
          <tr><td style="padding: 4px 8px; color: #64748b; width: 130px;">Date</td><td>${e.date || '—'}</td></tr>
          <tr><td style="padding: 4px 8px; color: #64748b;">Client</td><td>${e.client || '—'}</td></tr>
          <tr><td style="padding: 4px 8px; color: #64748b;">Reporting Staff</td><td>${e.carer || '—'}</td></tr>
          <tr><td style="padding: 4px 8px; color: #64748b;">Category</td><td>${e.type || 'Safeguarding'}</td></tr>
          <tr><td style="padding: 4px 8px; color: #64748b;">Flags</td><td style="color: ${badge};">${e.flags.length ? e.flags.join(', ') : '—'}</td></tr>
        </table>
        <div style="margin-top: 10px; padding: 10px; background: #fdf2f8; border-radius: 4px; font-size: 12px; line-height: 1.7;">${e.entry}</div>
      </div>`;
    }
  } else {
    html += `<div style="padding: 16px; background: #fdf2f8; border-radius: 8px; font-size: 13px; color: #94a3b8; font-style: italic; margin-bottom: 20px;">No safeguarding entries identified in this period.</div>`;
  }

  // Nature of concern
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Nature of Concern</h2>
  <div style="margin-bottom: 12px; font-size: 12px;">
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">`;
  const concernTypes = ['Physical Abuse', 'Emotional Abuse', 'Sexual Abuse', 'Financial Abuse', 'Neglect', 'Discriminatory', 'Organisational', 'Domestic Abuse', 'Self-Neglect', 'Modern Slavery', 'Other'];
  for (const ct of concernTypes) {
    html += `<div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">&#9744;</span> <span style="font-size: 12px;">${ct}</span></div>`;
  }
  html += `</div></div>`;

  // Immediate Risk Level
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Immediate Risk Level</h2>
  <div style="display: flex; gap: 20px; margin-bottom: 20px; font-size: 12px;">
    <div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">&#9744;</span> <span style="background: #ef4444; color: white; padding: 2px 10px; border-radius: 99px; font-size: 11px;">HIGH — Immediate danger</span></div>
    <div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">&#9744;</span> <span style="background: #f59e0b; color: white; padding: 2px 10px; border-radius: 99px; font-size: 11px;">MEDIUM — Monitoring needed</span></div>
    <div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">&#9744;</span> <span style="background: #22c55e; color: white; padding: 2px 10px; border-radius: 99px; font-size: 11px;">LOW — Precautionary</span></div>
  </div>

  <h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Actions Taken</h2>
  <div style="border: 1px solid #f9a8d4; border-radius: 6px; padding: 12px; min-height: 80px; margin-bottom: 20px; font-size: 12px; color: #94a3b8; font-style: italic;">Notes...</div>

  <h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Referrals Made</h2>
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 24px; font-size: 12px;">
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 14px;">&#9744;</span> Local Authority Safeguarding Team</div>
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 14px;">&#9744;</span> CQC</div>
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 14px;">&#9744;</span> Police</div>
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 14px;">&#9744;</span> GP / Healthcare Professional</div>
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 14px;">&#9744;</span> Family / Next of Kin Notified</div>
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 14px;">&#9744;</span> Other (specify below)</div>
  </div>

  <h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Multi-Agency Contact Log</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
    <tr style="background: #fdf2f8;">
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #f9a8d4;">Agency</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #f9a8d4;">Contact Name</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #f9a8d4;">Date/Time</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #f9a8d4;">Reference No.</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #f9a8d4;">Outcome</th>
    </tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
  </table>

  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Reporting Staff</div>
      <div style="border: 1px solid #f9a8d4; border-radius: 4px; height: 48px; margin-bottom: 6px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Designated Safeguarding Lead</div>
      <div style="border: 1px solid #f9a8d4; border-radius: 4px; height: 48px; margin-bottom: 6px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Registered Manager</div>
      <div style="border: 1px solid #f9a8d4; border-radius: 4px; height: 48px; margin-bottom: 6px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
  </div>
  <div style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div>
</div>`;

  return html;
}

function generateMedicationAudit(data: WeekSummary): string {
  const COLOR = '#0891b2';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));

  // Discrepancy keywords
  const discrepancyKeywords = ['refused', 'discrepancy', 'error', 'missing', 'incorrect', 'wrong dose', 'not given', 'omitted'];

  const discrepancyEntries: NourishEntry[] = [];
  for (const house of houses) {
    for (const e of house.medication) {
      const entryLower = e.entry.toLowerCase();
      const flagLower = e.flags.map(f => f.toLowerCase()).join(' ');
      if (discrepancyKeywords.some(k => entryLower.includes(k) || flagLower.includes(k))) {
        discrepancyEntries.push(e);
      }
    }
  }

  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; gap: 16px; border-bottom: 3px solid ${COLOR}; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="/hazelcare-logo.png" style="height: 48px;" />
    <div>
      <h1 style="margin: 0; font-size: 22px; color: ${COLOR};">Medication Audit Record</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Period: ${data.dateFrom || '___'} — ${data.dateTo || '___'} · Auditor: ___________________</p>
    </div>
  </div>`;

  // Per-house sections
  for (const house of houses) {
    if (house.medication.length === 0) continue;
    const houseDiscrepancies = house.medication.filter(e => {
      const el = e.entry.toLowerCase();
      const fl = e.flags.map(f => f.toLowerCase()).join(' ');
      return discrepancyKeywords.some(k => el.includes(k) || fl.includes(k));
    });

    html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">${house.name} <span style="font-size: 12px; font-weight: 400; color: #64748b;">(${house.medication.length} medication entries)</span></h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
      <tr style="background: #ecfeff;">
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #a5f3fc;">Client</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #a5f3fc;">Date</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #a5f3fc;">Type</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #a5f3fc;">Entry</th>
        <th style="padding: 8px 10px; text-align: left; border: 1px solid #a5f3fc;">Staff</th>
        <th style="padding: 8px 10px; text-align: center; border: 1px solid #a5f3fc;">Status</th>
      </tr>`;

    for (const e of house.medication) {
      const isDiscrepancy = discrepancyKeywords.some(k => e.entry.toLowerCase().includes(k) || e.flags.join(' ').toLowerCase().includes(k));
      const statusColor = isDiscrepancy ? '#ef4444' : e.severity === 'amber' ? '#f59e0b' : '#22c55e';
      const statusText = isDiscrepancy ? 'Discrepancy' : e.severity === 'red' ? 'Review' : e.severity === 'amber' ? 'Monitor' : 'OK';
      const rowBg = isDiscrepancy ? '#fef2f2' : '#fff';
      html += `<tr style="background: ${rowBg};">
        <td style="padding: 7px 10px; border: 1px solid #e2e8f0;">${e.client || '—'}</td>
        <td style="padding: 7px 10px; border: 1px solid #e2e8f0; white-space: nowrap;">${e.date || '—'}</td>
        <td style="padding: 7px 10px; border: 1px solid #e2e8f0;">${e.type || '—'}</td>
        <td style="padding: 7px 10px; border: 1px solid #e2e8f0;">${truncate(e.entry, 110)}</td>
        <td style="padding: 7px 10px; border: 1px solid #e2e8f0;">${e.carer || '—'}</td>
        <td style="padding: 7px 10px; border: 1px solid #e2e8f0; text-align: center;">
          <span style="background: ${statusColor}; color: white; font-size: 10px; padding: 2px 8px; border-radius: 99px;">${statusText}</span>
        </td>
      </tr>`;
    }
    html += `</table>`;

    if (houseDiscrepancies.length > 0) {
      html += `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 12px; margin-bottom: 20px; font-size: 12px;">
        <strong style="color: #ef4444;">⚠ ${houseDiscrepancies.length} discrepancy(ies) flagged in ${house.name} — requires immediate review</strong>
      </div>`;
    }
  }

  // Summary table
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Summary</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
    <tr style="background: #ecfeff;">
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a5f3fc;">House</th>
      <th style="padding: 8px 10px; text-align: center; border: 1px solid #a5f3fc;">Total Entries</th>
      <th style="padding: 8px 10px; text-align: center; border: 1px solid #a5f3fc;">Discrepancies</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a5f3fc;">Action Required</th>
    </tr>`;

  for (const house of houses) {
    const houseDisc = house.medication.filter(e => {
      const el = e.entry.toLowerCase();
      const fl = e.flags.join(' ').toLowerCase();
      return discrepancyKeywords.some(k => el.includes(k) || fl.includes(k));
    }).length;
    const rowBg = houseDisc > 0 ? '#fef2f2' : '#fff';
    html += `<tr style="background: ${rowBg};">
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600;">${house.name}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${house.medication.length}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: ${houseDisc > 0 ? '#ef4444' : '#22c55e'}; font-weight: ${houseDisc > 0 ? '700' : '400'};">${houseDisc}</td>
      <td style="padding: 8px 10px; border: 1px solid #e2e8f0; color: ${houseDisc > 0 ? '#ef4444' : '#22c55e'};">${houseDisc > 0 ? 'Urgent review required' : 'None'}</td>
    </tr>`;
  }
  html += `</table>`;

  // Discrepancies detail
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Discrepancies Detail</h2>`;
  if (discrepancyEntries.length === 0) {
    html += `<p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">No discrepancies identified in this period.</p>`;
  } else {
    for (const [i, e] of discrepancyEntries.entries()) {
      html += `<div style="border: 1px solid #fecaca; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; background: #fef2f2; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <strong>${i + 1}. ${e.house} — ${e.client || 'Unknown client'}</strong>
          <span style="color: #64748b;">${e.date || '—'} · ${e.carer || '—'}</span>
        </div>
        <div style="color: #475569; line-height: 1.6;">${e.entry}</div>
        ${e.flags.length ? `<div style="margin-top: 6px; color: #ef4444; font-size: 11px;">Flags: ${e.flags.join(', ')}</div>` : ''}
      </div>`;
    }
  }

  // Sign-off
  html += `<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Auditor</div>
      <div style="border: 1px solid #a5f3fc; border-radius: 4px; height: 48px; margin-bottom: 6px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Medication Lead</div>
      <div style="border: 1px solid #a5f3fc; border-radius: 4px; height: 48px; margin-bottom: 6px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Registered Manager</div>
      <div style="border: 1px solid #a5f3fc; border-radius: 4px; height: 48px; margin-bottom: 6px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
  </div>
  <div style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div>
</div>`;

  return html;
}

function generateFinance(data: WeekSummary): string {
  const COLOR = '#059669';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));

  // All finance entries per house
  const houseFinanceMap: Record<string, NourishEntry[]> = {};
  for (const house of houses) {
    const finEntries = house.entries.filter(e => e.category === 'finance');
    if (finEntries.length > 0) houseFinanceMap[house.name] = finEntries;
  }

  // Clients with finance entries
  const clientsWithFinance: string[] = [];
  for (const client of data.clients) {
    const clientEntries = data.clientDiary[client] || [];
    if (clientEntries.some(e => e.category === 'finance')) {
      clientsWithFinance.push(client);
    }
  }

  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; background: #fff;">
  <div style="display: flex; align-items: center; gap: 16px; border-bottom: 3px solid ${COLOR}; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="/hazelcare-logo.png" style="height: 48px;" />
    <div>
      <h1 style="margin: 0; font-size: 22px; color: ${COLOR};">Finance Meeting Record</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Period: ${data.dateFrom || '___'} — ${data.dateTo || '___'}</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
    <tr>
      <td style="padding: 6px 12px; background: #ecfdf5; font-weight: 600; width: 160px; border: 1px solid #a7f3d0;">Date</td>
      <td style="padding: 6px 12px; border: 1px solid #a7f3d0;">${new Date().toLocaleDateString('en-GB')}</td>
      <td style="padding: 6px 12px; background: #ecfdf5; font-weight: 600; width: 120px; border: 1px solid #a7f3d0;">Chair</td>
      <td style="padding: 6px 12px; border: 1px solid #a7f3d0;"></td>
    </tr>
    <tr>
      <td style="padding: 6px 12px; background: #ecfdf5; font-weight: 600; border: 1px solid #a7f3d0;">Attendees</td>
      <td colspan="3" style="padding: 6px 12px; border: 1px solid #a7f3d0;">${data.carers.slice(0, 5).join(', ') || '—'}</td>
    </tr>
  </table>`;

  // Per-house finance tables
  if (Object.keys(houseFinanceMap).length > 0) {
    for (const [houseName, finEntries] of Object.entries(houseFinanceMap)) {
      html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">${houseName} — Finance Entries <span style="font-size: 12px; font-weight: 400; color: #64748b;">(${finEntries.length})</span></h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        <tr style="background: #ecfdf5;">
          <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Client</th>
          <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Date</th>
          <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Type / Description</th>
          <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Staff</th>
          <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Amount / Notes</th>
        </tr>`;
      for (const e of finEntries) {
        html += `<tr>
          <td style="padding: 7px 10px; border: 1px solid #e2e8f0;">${e.client || '—'}</td>
          <td style="padding: 7px 10px; border: 1px solid #e2e8f0; white-space: nowrap;">${e.date || '—'}</td>
          <td style="padding: 7px 10px; border: 1px solid #e2e8f0;">${e.type || '—'}</td>
          <td style="padding: 7px 10px; border: 1px solid #e2e8f0;">${e.carer || '—'}</td>
          <td style="padding: 7px 10px; border: 1px solid #e2e8f0;">${truncate(e.entry, 100)}</td>
        </tr>`;
      }
      html += `</table>`;
    }
  } else {
    html += `<div style="padding: 14px; background: #ecfdf5; border-radius: 6px; font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 20px;">No finance-category entries recorded in this period.</div>`;
  }

  // Client Accounts Status
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Client Accounts Status</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
    <tr style="background: #ecfdf5;">
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Client</th>
      <th style="padding: 8px 10px; text-align: center; border: 1px solid #a7f3d0;">Finance Entries</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Last Entry</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Notes / Concerns</th>
    </tr>`;

  if (clientsWithFinance.length > 0) {
    for (const client of clientsWithFinance) {
      const clientFinEntries = (data.clientDiary[client] || []).filter(e => e.category === 'finance');
      const lastEntry = clientFinEntries[0];
      html += `<tr>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-weight: 600;">${client}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${clientFinEntries.length}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; color: #64748b;">${lastEntry?.date || '—'}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td>
      </tr>`;
    }
  } else {
    // Show all clients with blank rows
    for (const client of data.clients.slice(0, 8)) {
      html += `<tr>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${client}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: #94a3b8;">0</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">—</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;"></td>
      </tr>`;
    }
  }
  html += `</table>`;

  // Outstanding Receipts
  html += `<h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Outstanding Receipts</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
    <tr style="background: #ecfdf5;">
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">House / Client</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Description</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Amount (£)</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Date Required By</th>
    </tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 10px; border: 1px solid #e2e8f0;"></td></tr>
  </table>

  <h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Petty Cash Summary</h2>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
    <div style="border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px;">
      <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Opening Balance</div>
      <div style="font-size: 18px; font-weight: 700; color: ${COLOR};">£ ___</div>
    </div>
    <div style="border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px;">
      <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Total Spent</div>
      <div style="font-size: 18px; font-weight: 700; color: #ef4444;">£ ___</div>
    </div>
    <div style="border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px;">
      <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Closing Balance</div>
      <div style="font-size: 18px; font-weight: 700; color: ${COLOR};">£ ___</div>
    </div>
  </div>

  <h2 style="font-size: 15px; color: ${COLOR}; border-bottom: 2px solid ${COLOR}; padding-bottom: 6px; margin-bottom: 12px;">Actions Agreed</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 32px;">
    <tr style="background: #ecfdf5;">
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0; width: 28px;">#</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">Action</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0; width: 140px;">Owner</th>
      <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0; width: 100px;">Due Date</th>
    </tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">1</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">2</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
    <tr><td style="padding: 12px 10px; border: 1px solid #e2e8f0;">3</td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td><td style="padding: 12px 10px; border: 1px solid #e2e8f0;"></td></tr>
  </table>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Finance Lead</div>
      <div style="border: 1px solid #a7f3d0; border-radius: 4px; height: 48px; margin-bottom: 6px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Registered Manager</div>
      <div style="border: 1px solid #a7f3d0; border-radius: 4px; height: 48px; margin-bottom: 6px;"></div>
      <div style="font-size: 11px; color: #94a3b8;">Signature / Date</div>
    </div>
  </div>
  <div style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div>
</div>`;

  return html;
}

function generateGenericTemplate(data: WeekSummary, templateName: string, color: string): string {
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  let html = `
<div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b;">
  <div style="display: flex; align-items: center; gap: 16px; border-bottom: 3px solid ${color}; padding-bottom: 16px; margin-bottom: 24px;">
    <img src="/hazelcare-logo.png" style="height: 48px;" />
    <div>
      <h1 style="margin: 0; font-size: 22px; color: ${color};">${templateName}</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Period: ${data.dateFrom || '___'} — ${data.dateTo || '___'} · ${data.totalEntries} entries</p>
    </div>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
    <tr><td style="padding: 6px 12px; background: #f1f5f9; font-weight: 600; width: 160px;">Date</td><td style="padding: 6px 12px; border: 1px solid #e2e8f0;">${new Date().toLocaleDateString('en-GB')}</td></tr>
    <tr><td style="padding: 6px 12px; background: #f1f5f9; font-weight: 600;">Prepared By</td><td style="padding: 6px 12px; border: 1px solid #e2e8f0;"></td></tr>
  </table>`;

  for (const house of houses) {
    if (house.entries.length === 0) continue;
    html += `
    <div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background: #f8fafc; padding: 10px 16px; font-weight: 600; font-size: 14px;">${house.name} <span style="font-weight: 400; color: #64748b; font-size: 12px;">(${house.entries.length} entries)</span></div>
      <div style="padding: 12px 16px; font-size: 12px;">`;
    for (const entry of house.entries.slice(0, 10)) {
      const dotColor = entry.severity === 'red' ? '#ef4444' : entry.severity === 'amber' ? '#f59e0b' : '#22c55e';
      html += `<div style="margin-bottom: 6px;"><span style="color: ${dotColor};">●</span> ${truncate(entry.entry, 200)}</div>`;
    }
    if (house.entries.length > 10) {
      html += `<div style="color: #94a3b8; font-style: italic;">+ ${house.entries.length - 10} more entries</div>`;
    }
    html += `</div></div>`;
  }

  html += `<div style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    Hazel Care Ltd | Confidential — Not for distribution outside of the care team
  </div></div>`;
  return html;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function generateTemplate(type: TemplateType, data: WeekSummary): string {
  const tpl = TEMPLATES.find(t => t.id === type);
  switch (type) {
    case 'quality_meeting':   return generateQualityMeeting(data);
    case 'incident_report':   return generateIncidentReport(data);
    case 'daily_quality':     return generateDailyQuality(data);
    case 'handover':          return generateHandover(data);
    case 'supervision':       return generateSupervision(data);
    case 'safeguarding':      return generateSafeguarding(data);
    case 'medication_audit':  return generateMedicationAudit(data);
    case 'finance':           return generateFinance(data);
    default: return generateGenericTemplate(data, tpl?.name || type, tpl?.color || '#0f766e');
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
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="text-6xl mb-4">📋</div>
        <h2 className="text-xl font-bold text-white mb-2">Import Data First</h2>
        <p className="text-hc-muted text-sm text-center max-w-md">
          Load Nourish diary data to auto-populate templates with real entries, flags, and house summaries.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Templates</h1>
        <p className="text-hc-muted text-sm">
          Select a template to auto-generate from your {weekData.totalEntries} imported entries.
        </p>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {TEMPLATES.map(tpl => (
          <button
            key={tpl.id}
            onClick={() => handleGenerate(tpl.id)}
            className={`text-left p-4 rounded-lg border transition-all ${
              selected === tpl.id
                ? 'border-hc-teal-light bg-hc-teal/10'
                : 'border-hc-border bg-hc-card hover:border-white/20'
            }`}
          >
            <div className="text-2xl mb-2">{tpl.icon}</div>
            <div className="text-sm font-semibold text-white mb-1">{tpl.name}</div>
            <div className="text-[11px] text-hc-muted">{tpl.desc}</div>
          </button>
        ))}
      </div>

      {/* Generated Document */}
      {generated && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">
              Generated Document
              <span className="text-xs text-hc-muted font-normal ml-2">
                Review, then Print / Save as PDF
              </span>
            </h2>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-hc-teal text-white text-sm font-semibold rounded-lg hover:bg-hc-teal-light transition-colors"
            >
              Print / Save PDF
            </button>
          </div>
          <div className="bg-white rounded-lg overflow-hidden border border-hc-border">
            <iframe
              ref={iframeRef}
              srcDoc={`<!DOCTYPE html><html><head><style>body{margin:24px;}</style></head><body>${generated}</body></html>`}
              className="w-full"
              style={{ minHeight: '800px' }}
              title="Generated Template"
            />
          </div>
        </div>
      )}
    </div>
  );
}
