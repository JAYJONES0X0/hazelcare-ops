import type { Page, PageContext } from './types';
export interface PageVisit { page: Page; context: PageContext | null; scrollTop: number }
export interface PageHistory { entries: PageVisit[]; index: number }
export function pushPage(history: PageHistory, visit: PageVisit, scrollTop: number): PageHistory {
  const current = history.entries[history.index];
  if (current.page === visit.page && JSON.stringify(current.context) === JSON.stringify(visit.context)) return history;
  const entries = history.entries.slice(0, history.index + 1);
  entries[history.index] = { ...current, scrollTop };
  entries.push(visit);
  const bounded = entries.slice(-50);
  return { entries: bounded, index: bounded.length - 1 };
}
export function historyTarget(history: PageHistory, direction: -1 | 1, allowed: (page: Page) => boolean): number | null {
  for (let index = history.index + direction; index >= 0 && index < history.entries.length; index += direction) {
    if (allowed(history.entries[index].page)) return index;
  }
  return null;
}
export function movePage(history: PageHistory, direction: -1 | 1, scrollTop: number, allowed: (page: Page) => boolean): PageHistory {
  const index = historyTarget(history, direction, allowed);
  if (index === null) return history;
  const entries = [...history.entries];
  entries[history.index] = { ...entries[history.index], scrollTop };
  return { entries, index };
}
