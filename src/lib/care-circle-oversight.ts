import type { CareCircleConcern, FullClient } from './client-store';
import { getCareCircleResponseStatus } from './care-circle-response';
import { getCareCircleStatus } from './care-circle-status';
import { escapeHtml } from './html-escape';

function parseDueDate(value: string | undefined) {
  if (!value) return 0;
  const parts = value.split(/[/-]/).map((part) => part.trim());
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (a && b && c) {
      if (String(c).length === 4) return new Date(c, b - 1, a).getTime();
      return new Date(a, b - 1, c).getTime();
    }
  }
  return Date.parse(value) || 0;
}

function isOverdue(concern: CareCircleConcern, now: Date) {
  const due = parseDueDate(concern.dueDate);
  return concern.status !== 'resolved' && !!due && due < now.getTime();
}

function severity(waitingResponses: number, overdueItems: number, openItems: number, ready: boolean, recentShare: boolean) {
  if (overdueItems) return 0;
  if (waitingResponses) return 1;
  if (openItems) return 2;
  if (!ready && !recentShare) return 3;
  if (ready) return 4;
  return 5;
}

function queueLabel(row: { waitingResponses: number; overdueItems: number; openItems: number; ready: boolean; recentShare: boolean }) {
  if (row.overdueItems) return 'Overdue response';
  if (row.waitingResponses) return 'Response waiting';
  if (row.openItems) return 'Release blocked';
  if (row.ready) return 'Ready to release';
  if (row.recentShare) return 'Recently shared';
  return 'Setup needed';
}

export function buildCareCircleOversightRows(clients: FullClient[], now = new Date()) {
  return clients
    .map((client) => {
      const status = getCareCircleStatus(client);
      const openItems = status.openConcerns.length;
      const waitingResponses = status.openConcerns.filter((concern) => !getCareCircleResponseStatus(concern).canCopy).length;
      const overdueItems = status.openConcerns.filter((concern) => isOverdue(concern, now)).length;
      const recentShare = Boolean(status.recentShare);
      const row = {
        client,
        status,
        openItems,
        waitingResponses,
        overdueItems,
        recentShare,
        ready: status.ready,
        queueRank: severity(waitingResponses, overdueItems, openItems, status.ready, recentShare),
        queueLabel: '',
      };
      return { ...row, queueLabel: queueLabel(row) };
    })
    .filter((row) => row.status.active || row.openItems > 0 || row.status.contacts.length > 0 || row.recentShare)
    .sort((a, b) => {
      if (a.queueRank !== b.queueRank) return a.queueRank - b.queueRank;
      if (b.overdueItems !== a.overdueItems) return b.overdueItems - a.overdueItems;
      if (b.waitingResponses !== a.waitingResponses) return b.waitingResponses - a.waitingResponses;
      return b.openItems - a.openItems;
    });
}

type CareCircleOversightRow = ReturnType<typeof buildCareCircleOversightRows>[number];

function formatDate(date: Date) {
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function openItemSummary(row: CareCircleOversightRow) {
  const concerns = row.status.openConcerns.slice(0, 3);
  if (!concerns.length) return '<span class="muted">No open family items.</span>';
  return `<ul>${concerns.map((concern) => {
    const response = getCareCircleResponseStatus(concern);
    const due = concern.dueDate ? ` / due ${escapeHtml(concern.dueDate)}` : '';
    return `<li><strong>${escapeHtml(concern.type.replace('_', ' '))}</strong> / ${escapeHtml(concern.priority)} / ${escapeHtml(response.label)}${due}<br/><span>${escapeHtml(concern.detail || 'No detail recorded.')}</span></li>`;
  }).join('')}</ul>`;
}

export function buildCareCircleOversightReportHtml(rows: CareCircleOversightRow[], generatedAt = new Date()) {
  const ready = rows.filter((row) => row.ready).length;
  const waiting = rows.reduce((sum, row) => sum + row.waitingResponses, 0);
  const overdue = rows.reduce((sum, row) => sum + row.overdueItems, 0);
  const open = rows.reduce((sum, row) => sum + row.openItems, 0);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Care Circle Oversight Report</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: Inter, Arial, sans-serif; color: #163434; margin: 0; line-height: 1.42; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    .meta { color: #667; font-size: 10px; text-transform: uppercase; letter-spacing: .14em; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 18px; }
    .metric { border: 1px solid #d7d0bf; border-radius: 10px; padding: 10px; background: #fbf8ed; }
    .metric strong { display: block; font-size: 20px; }
    .metric span { font-size: 9px; text-transform: uppercase; letter-spacing: .12em; color: #667; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { text-align: left; text-transform: uppercase; letter-spacing: .12em; font-size: 8px; color: #667; border-bottom: 2px solid #163434; padding: 8px 6px; }
    td { vertical-align: top; border-bottom: 1px solid #d7d0bf; padding: 9px 6px; }
    .pill { display: inline-block; border-radius: 999px; border: 1px solid #d7d0bf; padding: 3px 7px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .red { color: #b91c1c; border-color: #fecaca; background: #fff1f2; }
    .amber { color: #92400e; border-color: #fed7aa; background: #fffbeb; }
    .green { color: #0f766e; border-color: #99f6e4; background: #f0fdfa; }
    .muted { color: #667; }
    ul { margin: 0; padding-left: 14px; }
    li { margin-bottom: 5px; }
    .footer { margin-top: 16px; font-size: 9px; color: #667; border-top: 1px solid #d7d0bf; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>Care Circle Oversight Report</h1>
  <div class="meta">Generated ${escapeHtml(formatDate(generatedAt))} / Manager review copy</div>
  <div class="grid">
    <div class="metric"><strong>${rows.length}</strong><span>People in queue</span></div>
    <div class="metric"><strong>${ready}</strong><span>Ready to release</span></div>
    <div class="metric"><strong>${waiting}</strong><span>Responses waiting</span></div>
    <div class="metric"><strong>${overdue}</strong><span>Overdue responses</span></div>
  </div>
  <div class="grid">
    <div class="metric"><strong>${open}</strong><span>Open family items</span></div>
    <div class="metric"><strong>${rows.filter((row) => row.recentShare).length}</strong><span>Recent shares</span></div>
    <div class="metric"><strong>${rows.filter((row) => row.queueLabel === 'Release blocked').length}</strong><span>Release blocked</span></div>
    <div class="metric"><strong>${rows.filter((row) => row.queueLabel === 'Setup needed').length}</strong><span>Setup needed</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Person</th>
        <th>Queue state</th>
        <th>Contacts</th>
        <th>Open items</th>
        <th>Waiting / overdue</th>
        <th>Current blockers</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => {
        const className = row.queueLabel === 'Ready to release' ? 'green' : row.queueLabel === 'Overdue response' || row.queueLabel === 'Release blocked' ? 'red' : 'amber';
        return `<tr>
          <td><strong>${escapeHtml(row.client.name)}</strong><br/><span class="muted">${escapeHtml(row.client.dob || 'DOB not recorded')}</span></td>
          <td><span class="pill ${className}">${escapeHtml(row.queueLabel)}</span></td>
          <td>${row.status.verifiedContacts.length}/${row.status.contacts.length} verified</td>
          <td>${row.openItems}</td>
          <td>${row.waitingResponses} waiting / ${row.overdueItems} overdue</td>
          <td>${openItemSummary(row)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div class="footer">Care Circle is an optional visibility layer. This report is for internal governance and manager review; it is not a family-facing document.</div>
</body>
</html>`;
}
