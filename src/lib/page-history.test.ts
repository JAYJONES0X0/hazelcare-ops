import { expect, it } from 'vitest';
import { pushPage, movePage, historyTarget, type PageHistory } from './page-history';
const initial: PageHistory = { entries: [{ page: 'briefing', context: null, scrollTop: 0 }], index: 0 };
it('returns to the previous page and restores its scroll position', () => {
  const next = pushPage(initial, { page: 'client-diary', context: { client: 'Synthetic' }, scrollTop: 0 }, 420);
  const back = movePage(next, -1, 30, () => true);
  expect(back.entries[back.index]).toEqual({ page: 'briefing', context: null, scrollTop: 420 });
  const forward = movePage(back, 1, 420, () => true);
  expect(forward.entries[forward.index].context).toEqual({ client: 'Synthetic' });
  expect(forward.entries[forward.index].scrollTop).toBe(30);
});
it('drops forward history after navigating to a new destination', () => {
  const next = pushPage(initial, { page: 'dashboard', context: null, scrollTop: 0 }, 0);
  const back = movePage(next, -1, 0, () => true);
  const branch = pushPage(back, { page: 'reports', context: null, scrollTop: 0 }, 0);
  expect(historyTarget(branch, 1, () => true)).toBeNull();
  expect(branch.entries.map(v => v.page)).toEqual(['briefing', 'reports']);
});
it('skips history destinations the current role cannot access', () => {
  const next = pushPage(initial, { page: 'admin', context: null, scrollTop: 0 }, 0);
  const third = pushPage(next, { page: 'dashboard', context: null, scrollTop: 0 }, 0);
  expect(movePage(third, -1, 0, p => p !== 'admin').index).toBe(0);
});
