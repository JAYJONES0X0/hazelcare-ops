import type { CareEntry, HouseSummary, TemplateType, WeekSummary } from './types';
import { TEMPLATES } from './types';
import { escapeHtml } from './html-escape';

const NAVY = '#0c1829';
const AUTHORITY = '#5d0565';
const SLATE = '#334155';
const MUTED = '#64748b';
const BORDER = '#dbe4ed';
const SURFACE = '#f8fafc';
const RED = '#dc2626';
const AMBER = '#d97706';
const GREEN = '#16a34a';

export interface TemplateImportContext {
  selectedTemplateIds?: TemplateType[];
  source?: string;
  at?: string;
  monitoringRunId?: string;
  house?: string;
  dateFrom?: string;
  dateTo?: string;
  escalationCount?: number;
  avgHouseQuality?: number;
}

export interface TemplateDocumentOptions {
  reviewer?: string;
  approved?: boolean;
}

interface TemplateLens {
  title: string;
  subtitle: string;
  purpose: string;
  evidenceTitle: string;
  actionTitle: string;
  accent: string;
  source: (house: HouseSummary) => CareEntry[];
}

function ex(value: string | number | undefined | null): string {
  return escapeHtml(value == null ? '' : String(value));
}

function dateStamp(): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} at ${time}`;
}

function compact(value: string, max = 440): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trim()}...`;
}

function allEntries(house: HouseSummary): CareEntry[] {
  return house.entries;
}

function byCategory(category: CareEntry['category']) {
  return (house: HouseSummary) => house.entries.filter((entry) => entry.category === category);
}

const TEMPLATE_LENSES: Record<TemplateType, TemplateLens> = {
  quality_meeting: {
    title: 'Quality & Compliance Report',
    subtitle: 'Service quality and compliance review',
    purpose: 'Board-ready review of unit compliance, risk pressure, open incidents, medication exposure, and required quality actions.',
    evidenceTitle: 'Quality Exceptions',
    actionTitle: 'Quality Action Register',
    accent: AUTHORITY,
    source: allEntries,
  },
  daily_quality: {
    title: 'Morning Briefing',
    subtitle: 'Start-of-day operational priorities',
    purpose: 'A concise operational handover for the next duty cycle, highlighting pressure points, people affected, and follow-up moves.',
    evidenceTitle: 'Priority Signals',
    actionTitle: 'Duty Cycle Actions',
    accent: '#1e40af',
    source: allEntries,
  },
  incident_report: {
    title: 'Incident Log & Analysis',
    subtitle: 'Incident documentation and review trail',
    purpose: 'Structured incident review pack with severity, immediate learning, evidence references, and escalation ownership.',
    evidenceTitle: 'Incident Evidence',
    actionTitle: 'Incident Closure Actions',
    accent: RED,
    source: (house) => house.incidents,
  },
  handover: {
    title: 'Shift Handover',
    subtitle: 'Night and day shift continuity record',
    purpose: 'Shift-to-shift continuity record covering resident changes, staff actions, risk controls, and unresolved handover items.',
    evidenceTitle: 'Handover Notes',
    actionTitle: 'Handover Follow-Ups',
    accent: AMBER,
    source: (house) => house.handovers,
  },
  supervision: {
    title: 'Staff Supervision Record',
    subtitle: 'Staff supervision and capability notes',
    purpose: 'Staff readiness review for performance trends, training gaps, conduct risks, and supervision follow-up.',
    evidenceTitle: 'Staff Signals',
    actionTitle: 'Supervision Actions',
    accent: '#7c3aed',
    source: (house) => house.staffPerformance,
  },
  safeguarding: {
    title: 'Safeguarding Record',
    subtitle: 'Safeguarding concern documentation',
    purpose: 'Safeguarding-focused governance record that separates concern, immediate protection, escalation path, and review evidence.',
    evidenceTitle: 'Safeguarding Evidence',
    actionTitle: 'Protection Actions',
    accent: '#be185d',
    source: (house) => house.safeguarding,
  },
  medication_audit: {
    title: 'Medication Audit',
    subtitle: 'Medication review and MAR governance',
    purpose: 'Medication safety audit covering errors, omissions, stock movement, clinical review requirements, and accountability.',
    evidenceTitle: 'Medication Evidence',
    actionTitle: 'Medication Safety Actions',
    accent: '#0891b2',
    source: (house) => house.medication,
  },
  finance: {
    title: 'Finance Review',
    subtitle: 'Budget and finance review',
    purpose: 'Finance governance review for client money, petty cash, benefits support, audit evidence, and exception handling.',
    evidenceTitle: 'Finance Evidence',
    actionTitle: 'Finance Control Actions',
    accent: '#059669',
    source: byCategory('finance'),
  },
  care_review: {
    title: 'Care Plan Review',
    subtitle: 'Care plan review and clinical stability',
    purpose: 'Person-level care review summary showing changes in presentation, support plan needs, risks, and next review actions.',
    evidenceTitle: 'Care Review Evidence',
    actionTitle: 'Care Review Actions',
    accent: '#0369a1',
    source: (house) => [...house.dailySupport, ...house.healthSafety, ...house.safeguarding],
  },
  complaint_concern: {
    title: 'Complaints & Concerns',
    subtitle: 'Complaints and concerns log',
    purpose: 'Complaint and concern log with triage, response pathway, lessons learned, and proof of closure.',
    evidenceTitle: 'Feedback Signals',
    actionTitle: 'Rectification Actions',
    accent: '#b45309',
    source: allEntries,
  },
  cqc_report: {
    title: 'Statutory Compliance Pack',
    subtitle: 'CQC-ready regulatory documentation',
    purpose: 'Inspection-ready compliance pack summarising safe, effective, caring, responsive, and well-led evidence.',
    evidenceTitle: 'Compliance Evidence',
    actionTitle: 'Regulatory Actions',
    accent: AUTHORITY,
    source: allEntries,
  },
  house_meeting: {
    title: 'Team Briefing',
    subtitle: 'House-level team meeting',
    purpose: 'Team meeting record for operational priorities, decisions, resident updates, staffing, and owner-based actions.',
    evidenceTitle: 'Team Discussion Evidence',
    actionTitle: 'Team Actions',
    accent: AUTHORITY,
    source: allEntries,
  },
  family_feedback: {
    title: 'Family Feedback Record',
    subtitle: 'Client and family feedback record',
    purpose: 'Feedback matrix for family contact, concerns, compliments, response actions, and evidence of resolution.',
    evidenceTitle: 'Feedback Evidence',
    actionTitle: 'Family Communication Actions',
    accent: AUTHORITY,
    source: allEntries,
  },
  gp_appointment: {
    title: 'GP Visit Record',
    subtitle: 'GP visit and outcome record',
    purpose: 'Health appointment record that captures presenting issue, advice, medication changes, follow-up, and staff ownership.',
    evidenceTitle: 'Clinical Evidence',
    actionTitle: 'Clinical Follow-Up Actions',
    accent: '#0891b2',
    source: byCategory('daily_support'),
  },
  medication_review: {
    title: 'Clinical Pharma Review',
    subtitle: 'Clinical medication review',
    purpose: 'Clinical medication review pack covering current risks, prescriber actions, consent, capacity, and review triggers.',
    evidenceTitle: 'Clinical Medication Evidence',
    actionTitle: 'Pharma Review Actions',
    accent: '#0369a1',
    source: (house) => house.medication,
  },
  medication_transaction: {
    title: 'Pharma Supply Log',
    subtitle: 'Collected, ordered, returned',
    purpose: 'Medication supply chain record for ordered, collected, returned, disposed, and reconciled medication activity.',
    evidenceTitle: 'Supply Chain Evidence',
    actionTitle: 'Stock Control Actions',
    accent: '#0891b2',
    source: (house) => house.medication,
  },
  finance_audit: {
    title: 'Finance Audit',
    subtitle: 'Finance audit and transactions',
    purpose: 'Financial audit snapshot covering transaction records, client money controls, discrepancies, and authorisation trail.',
    evidenceTitle: 'Financial Evidence',
    actionTitle: 'Audit Control Actions',
    accent: '#059669',
    source: byCategory('finance'),
  },
  repairs_maintenance: {
    title: 'Property & Repairs',
    subtitle: 'Property repairs log',
    purpose: 'Facilities safety record for property defects, repairs, environmental risk, contractor status, and closure evidence.',
    evidenceTitle: 'Facilities Evidence',
    actionTitle: 'Maintenance Actions',
    accent: '#78350f',
    source: (house) => house.healthSafety,
  },
  weekly_quality_report: {
    title: 'Weekly Performance Report',
    subtitle: 'Weekly quality summary',
    purpose: 'Weekly regional performance report for the quality meeting, using live records to show pressure, assurance, and action.',
    evidenceTitle: 'Regional Signals',
    actionTitle: 'Regional Action Register',
    accent: AUTHORITY,
    source: allEntries,
  },
  performance_improvement: {
    title: 'Performance Rectification',
    subtitle: 'Staff PIP documentation',
    purpose: 'Performance improvement record linking concerns, expected standards, support offered, review cadence, and decision gate.',
    evidenceTitle: 'Performance Evidence',
    actionTitle: 'Improvement Plan Actions',
    accent: '#b45309',
    source: (house) => house.staffPerformance,
  },
  probation_review: {
    title: 'Entry-Level Evaluation',
    subtitle: 'First 3-month staff review',
    purpose: 'Probation review record for performance, conduct, training progress, fit for role, and confirmation decision.',
    evidenceTitle: 'Probation Evidence',
    actionTitle: 'Probation Actions',
    accent: '#059669',
    source: (house) => house.staffPerformance,
  },
  exit_interview: {
    title: 'De-Boarding Interview',
    subtitle: 'Leaver exit interview record',
    purpose: 'Exit interview record for role closure, feedback themes, equipment return, governance risks, and learning actions.',
    evidenceTitle: 'Exit Evidence',
    actionTitle: 'Leaver Closure Actions',
    accent: MUTED,
    source: (house) => house.staffPerformance,
  },
};

function styles(): string {
  return `
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { background: #ffffff; }
  body { margin: 0; background: #ffffff; color: ${SLATE}; font-family: 'Inter', Arial, sans-serif; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
  .page { width: 100%; min-height: calc(297mm - 24mm); display: flex; flex-direction: column; gap: 18px; }
  .brand-strip { height: 8px; background: linear-gradient(90deg, var(--accent), ${NAVY}); border-radius: 999px; }
  .header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; padding-bottom: 14px; border-bottom: 1px solid ${BORDER}; }
  .eyebrow { color: var(--accent); font-size: 9px; font-weight: 900; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 6px; }
  h1 { margin: 0; color: ${NAVY}; font-size: 30px; line-height: 1; letter-spacing: -0.02em; font-weight: 900; }
  h2 { margin: 0 0 10px; color: ${NAVY}; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 900; }
  h3 { margin: 0; color: ${NAVY}; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 900; }
  p { margin: 0; overflow-wrap: anywhere; }
  .meta { color: ${MUTED}; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 8px; }
  .logo { height: 42px; max-width: 120px; object-fit: contain; }
  .org { color: ${MUTED}; font-size: 8px; font-weight: 900; letter-spacing: 0.22em; text-transform: uppercase; text-align: right; margin-top: 8px; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr); gap: 16px; align-items: stretch; }
  .panel { border: 1px solid ${BORDER}; border-radius: 10px; padding: 16px; background: #fff; break-inside: avoid; }
  .panel.tint { background: ${SURFACE}; }
  .purpose { font-size: 13px; line-height: 1.65; color: ${NAVY}; font-weight: 600; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .kpi { border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px; background: #fff; }
  .kpi b { display: block; color: ${NAVY}; font-size: 23px; line-height: 1; font-weight: 900; }
  .kpi span { display: block; color: ${MUTED}; font-size: 8px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; margin-top: 6px; }
  .status { display: inline-flex; align-items: center; border: 1px solid currentColor; border-radius: 999px; padding: 4px 10px; font-size: 8px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
  .grid-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid ${BORDER}; break-inside: auto; }
  th { background: ${SURFACE}; color: ${NAVY}; font-size: 8px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; padding: 9px; border: 1px solid ${BORDER}; text-align: left; }
  td { padding: 9px; border: 1px solid ${BORDER}; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .evidence-list { display: grid; gap: 10px; }
  .evidence { border: 1px solid ${BORDER}; border-left: 5px solid var(--severity); border-radius: 9px; padding: 11px 12px; background: #fff; break-inside: avoid; }
  .evidence-top { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; color: ${MUTED}; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .entry { color: ${SLATE}; font-size: 10px; line-height: 1.55; overflow-wrap: anywhere; }
  .actions { display: grid; gap: 8px; counter-reset: action; }
  .action { display: grid; grid-template-columns: 26px minmax(0, 1fr) 112px; gap: 10px; align-items: start; border: 1px solid ${BORDER}; border-radius: 9px; padding: 10px; background: #fff; break-inside: avoid; }
  .action > div { min-width: 0; }
  .action:before { counter-increment: action; content: counter(action); width: 24px; height: 24px; border-radius: 999px; background: var(--accent); color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 10px; }
  .owner { color: ${NAVY}; font-size: 8px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; text-align: right; }
  .signoff { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: auto; }
  .line { border-bottom: 1px dashed #94a3b8; min-height: 28px; margin-top: 14px; }
  .footer { margin-top: 8px; padding-top: 10px; border-top: 1px solid ${BORDER}; display: flex; justify-content: space-between; gap: 18px; color: ${MUTED}; font-size: 8px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .nil { border: 1px dashed ${BORDER}; border-radius: 10px; padding: 18px; color: ${MUTED}; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.12em; }
  @media screen {
    body { padding: 32px; }
    .page { max-width: 210mm; margin: 0 auto; }
  }
  @media (max-width: 760px) {
    .header, .hero, .grid-2, .signoff { grid-template-columns: 1fr; }
    .org { text-align: left; }
    .kpis { grid-template-columns: repeat(2, 1fr); }
    .action { grid-template-columns: 26px minmax(0, 1fr); }
    .owner { grid-column: 2; text-align: left; }
  }
  @media print {
    html, body { height: auto; background: #fff; }
    .page { min-height: auto; gap: 14px; }
    .panel, .evidence, .action { break-inside: avoid; page-break-inside: avoid; }
  }`;
}

function houses(data: WeekSummary): HouseSummary[] {
  return Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
}

function selectedEntries(data: WeekSummary, lens: TemplateLens): CareEntry[] {
  return houses(data).flatMap((house) => lens.source(house));
}

function severityColor(severity: CareEntry['severity']): string {
  if (severity === 'red') return RED;
  if (severity === 'amber') return AMBER;
  if (severity === 'green') return GREEN;
  return MUTED;
}

function houseStatus(house: HouseSummary): { label: string; color: string } {
  if (house.flags.red > 0) return { label: 'Critical review', color: RED };
  if (house.flags.amber > 0) return { label: 'Active monitoring', color: AMBER };
  return { label: 'Stable', color: GREEN };
}

function kpiCards(data: WeekSummary, entries: CareEntry[]): string {
  const houseCount = houses(data).length;
  const critical = entries.filter((entry) => entry.severity === 'red').length;
  const amber = entries.filter((entry) => entry.severity === 'amber').length;
  const people = new Set(entries.map((entry) => entry.client).filter(Boolean)).size;
  return `
    <div class="kpis">
      <div class="kpi"><b>${data.totalEntries}</b><span>Total records</span></div>
      <div class="kpi"><b>${houseCount}</b><span>Operational units</span></div>
      <div class="kpi"><b style="color:${critical ? RED : NAVY};">${critical}</b><span>Critical exceptions</span></div>
      <div class="kpi"><b style="color:${amber ? AMBER : NAVY};">${people}</b><span>People referenced</span></div>
    </div>`;
}

function monitoringContext(ctx: TemplateImportContext | null): string {
  if (!ctx || ctx.source !== 'staff-monitoring') return '';
  const scope = ctx.house ? ctx.house : 'All units';
  const windowText = ctx.dateFrom && ctx.dateTo ? `${ctx.dateFrom} to ${ctx.dateTo}` : 'Live registry feed';
  return `
    <div class="panel tint">
      <h2>Imported Intelligence Context</h2>
      <table>
        <tr><th>Scope</th><td>${ex(scope)}</td><th>Window</th><td>${ex(windowText)}</td></tr>
        <tr><th>Escalations</th><td>${ex(ctx.escalationCount ?? 0)}</td><th>Quality index</th><td>${ex(ctx.avgHouseQuality != null ? `${ctx.avgHouseQuality}/100` : 'Not scored')}</td></tr>
      </table>
    </div>`;
}

function unitMatrix(data: WeekSummary): string {
  return `
    <div class="panel">
      <h2>Unit Accountability Matrix</h2>
      <table>
        <tr>
          <th style="width:24%;">Operational unit</th>
          <th style="width:18%;">Coordinator</th>
          <th>Records</th>
          <th>Critical</th>
          <th>Incidents</th>
          <th>Medication</th>
          <th style="width:18%;">Status</th>
        </tr>
        ${houses(data).map((house) => {
          const status = houseStatus(house);
          return `<tr>
            <td><strong>${ex(house.name)}</strong></td>
            <td>${ex(house.coordinator || 'Unassigned')}</td>
            <td>${house.entries.length}</td>
            <td style="color:${house.flags.red ? RED : MUTED}; font-weight:900;">${house.flags.red}</td>
            <td>${house.incidents.length}</td>
            <td>${house.medication.length}</td>
            <td><span class="status" style="color:${status.color};">${ex(status.label)}</span></td>
          </tr>`;
        }).join('')}
      </table>
    </div>`;
}

function summaryPanel(data: WeekSummary, lens: TemplateLens, entries: CareEntry[]): string {
  const red = entries.filter((entry) => entry.severity === 'red');
  const amber = entries.filter((entry) => entry.severity === 'amber');
  const hotUnits = houses(data)
    .filter((house) => house.flags.red || house.flags.amber)
    .sort((a, b) => (b.flags.red * 5 + b.flags.amber) - (a.flags.red * 5 + a.flags.amber))
    .slice(0, 3)
    .map((house) => house.name);
  const priority =
    red.length > 0
      ? `${red.length} critical item(s) require same-day manager review.`
      : amber.length > 0
        ? `${amber.length} amber item(s) require active monitoring and named owner.`
        : 'No critical or amber exception was detected in this template lens.';
  return `
    <div class="hero">
      <div class="panel tint">
        <h2>Operational Readout</h2>
        <p class="purpose">${ex(lens.purpose)}</p>
        <p style="margin-top:12px;">${ex(priority)} ${hotUnits.length ? `Highest-pressure units: ${ex(hotUnits.join(', '))}.` : 'All units currently show low exception pressure.'}</p>
      </div>
      <div class="panel">
        <h2>Assurance Position</h2>
        <table>
          <tr><th>Period</th><td>${ex(data.dateFrom)} to ${ex(data.dateTo)}</td></tr>
          <tr><th>Records in lens</th><td>${entries.length}</td></tr>
          <tr><th>Clients</th><td>${data.clients.length}</td></tr>
          <tr><th>Staff</th><td>${data.carers.length}</td></tr>
        </table>
      </div>
    </div>`;
}

function evidenceCards(entries: CareEntry[], lens: TemplateLens): string {
  const ranked = [...entries].sort((a, b) => {
    const score = (entry: CareEntry) => (entry.severity === 'red' ? 3 : entry.severity === 'amber' ? 2 : entry.severity === 'green' ? 1 : 0);
    return score(b) - score(a);
  }).slice(0, 8);

  if (!ranked.length) {
    return `
      <div class="panel">
        <h2>${ex(lens.evidenceTitle)}</h2>
        <div class="nil">Nil return: no matching records were captured for this protocol in the selected reporting window.</div>
      </div>`;
  }

  return `
    <div class="panel">
      <h2>${ex(lens.evidenceTitle)}</h2>
      <div class="evidence-list">
        ${ranked.map((entry) => `
          <div class="evidence" style="--severity:${severityColor(entry.severity)};">
            <div class="evidence-top">
              <span>${ex(entry.house)} / ${ex(entry.client || 'No client')} / ${ex(entry.carer || 'No staff')}</span>
              <span>${ex(entry.date)} ${ex(entry.time || '')}</span>
            </div>
            <div class="entry">${ex(compact(entry.entry))}</div>
            ${entry.flags.length ? `<div class="meta">Flags: ${ex(entry.flags.join(', '))}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
}

function actionRegister(lens: TemplateLens, entries: CareEntry[]): string {
  const critical = entries.filter((entry) => entry.severity === 'red');
  const amber = entries.filter((entry) => entry.severity === 'amber');
  const nilReturn = entries.length === 0;
  const firstCritical = critical[0] || amber[0] || entries[0];
  const actions = nilReturn
    ? [
        'Confirm the nil return is accurate for the reporting period and file supporting evidence.',
        'Check whether records were missed because of upload, category, or staff logging gaps.',
        'Record reviewer sign-off before the document is released to the physical pack.',
      ]
    : [
        critical.length
          ? `Complete same-day review of ${critical.length} critical exception(s), starting with ${firstCritical.house}.`
          : 'Confirm amber and green evidence has been reviewed and no hidden critical concern is present.',
        amber.length
          ? `Assign named owners for ${amber.length} amber item(s) and set target dates.`
          : 'Maintain normal monitoring cadence and document any change in presentation.',
        'Update the relevant client, staff, medication, finance, or facilities record before filing this pack.',
      ];
  return `
    <div class="panel">
      <h2>${ex(lens.actionTitle)}</h2>
      <div class="actions">
        ${actions.map((action, index) => `
          <div class="action">
            <div><h3>${index === 0 ? 'Immediate' : index === 1 ? 'Owner' : 'Evidence'}</h3><p>${ex(action)}</p></div>
            <div class="owner">${index === 0 ? 'Registered manager' : index === 1 ? 'Unit lead' : 'Reviewer'}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function signoff(options: TemplateDocumentOptions): string {
  const reviewer = options.reviewer?.trim();
  const decision = options.approved ? 'Reviewed and approved for physical release' : 'Draft - awaiting reviewer completion';
  return `
    <div class="signoff">
      <div class="panel">
        <h3>Reviewer</h3>
        <div class="line">${reviewer ? ex(reviewer) : ''}</div>
      </div>
      <div class="panel">
        <h3>Decision</h3>
        <div class="line">${ex(decision)}</div>
      </div>
      <div class="panel">
        <h3>Signature / Date</h3>
        <div class="line"></div>
      </div>
    </div>`;
}

function header(lens: TemplateLens, templateId: TemplateType): string {
  const template = TEMPLATES.find((item) => item.id === templateId);
  return `
    <div class="brand-strip"></div>
    <div class="header">
      <div>
        <div class="eyebrow">${ex(template?.name || lens.title)}</div>
        <h1>${ex(lens.title)}</h1>
        <div class="meta">${ex(lens.subtitle)} / Generated ${ex(dateStamp())} / Confidential internal use only</div>
      </div>
      <div>
        <img src="/logo-formal.png" class="logo" alt="Care Ops" onerror="this.style.display='none'" />
        <div class="org">Care Ops</div>
      </div>
    </div>`;
}

export function buildTemplateDocument(
  data: WeekSummary,
  templateId: TemplateType,
  context: TemplateImportContext | null = null,
  options: TemplateDocumentOptions = {},
): string {
  const lens = TEMPLATE_LENSES[templateId] || TEMPLATE_LENSES.quality_meeting;
  const entries = selectedEntries(data, lens);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${ex(lens.title)}</title>
  <style>:root{--accent:${lens.accent};}${styles()}</style>
</head>
<body>
  <main class="page">
    ${header(lens, templateId)}
    ${kpiCards(data, entries)}
    ${monitoringContext(context)}
    ${summaryPanel(data, lens, entries)}
    ${unitMatrix(data)}
    <div class="grid-2">
      ${evidenceCards(entries, lens)}
      ${actionRegister(lens, entries)}
    </div>
    ${signoff(options)}
    <div class="footer">
      <span>Care Ops / controlled document / do not redistribute</span>
      <span>${ex(templateId)}</span>
    </div>
  </main>
</body>
</html>`;
}
