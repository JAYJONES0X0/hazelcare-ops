import type { CareCircleConcern, FullClient } from './client-store';
import { getCareCircleResponseStatus } from './care-circle-response';
import { getCareCircleStatus } from './care-circle-status';

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
