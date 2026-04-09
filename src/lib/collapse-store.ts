import { useState, useCallback } from 'react';

const STORAGE_PREFIX = 'hc-collapse-';

function load(pageKey: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + pageKey);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persist(pageKey: string, state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_PREFIX + pageKey, JSON.stringify(state));
}

/**
 * Persistent per-page collapse state.
 * `defaultCollapsed` — if true, items are collapsed unless explicitly expanded.
 */
export function useCollapseStore(pageKey: string, defaultCollapsed = false) {
  const [state, setState] = useState<Record<string, boolean>>(() => load(pageKey));

  const isCollapsed = useCallback(
    (id: string) => (id in state ? state[id] : defaultCollapsed),
    [state, defaultCollapsed],
  );

  const toggle = useCallback(
    (id: string) => {
      setState(prev => {
        const next = { ...prev, [id]: !(id in prev ? prev[id] : defaultCollapsed) };
        persist(pageKey, next);
        return next;
      });
    },
    [pageKey, defaultCollapsed],
  );

  const collapseAll = useCallback(
    (ids: string[]) => {
      setState(prev => {
        const next = { ...prev };
        ids.forEach(id => { next[id] = true; });
        persist(pageKey, next);
        return next;
      });
    },
    [pageKey],
  );

  const expandAll = useCallback(
    (ids: string[]) => {
      setState(prev => {
        const next = { ...prev };
        ids.forEach(id => { next[id] = false; });
        persist(pageKey, next);
        return next;
      });
    },
    [pageKey],
  );

  const allCollapsed = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every(id => isCollapsed(id)),
    [isCollapsed],
  );

  return { isCollapsed, toggle, collapseAll, expandAll, allCollapsed };
}
