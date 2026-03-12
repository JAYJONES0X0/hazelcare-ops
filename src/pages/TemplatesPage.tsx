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
    Generated by Hazelcare Ops Engine · ${new Date().toLocaleDateString('en-GB')} · Zero Cost — All processing local
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
    Generated by Hazelcare Ops Engine · ${new Date().toLocaleDateString('en-GB')}
  </div></div>`;
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
    Generated by Hazelcare Ops Engine · ${new Date().toLocaleDateString('en-GB')}
  </div></div>`;
  return html;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function generateTemplate(type: TemplateType, data: WeekSummary): string {
  const tpl = TEMPLATES.find(t => t.id === type);
  switch (type) {
    case 'quality_meeting': return generateQualityMeeting(data);
    case 'incident_report': return generateIncidentReport(data);
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
