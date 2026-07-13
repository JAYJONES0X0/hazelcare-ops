const KEY = 'hc-custom-houses';

export function loadCustomHouses(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function addCustomHouse(name: string): string[] {
  const trimmed = name.trim();
  const existing = loadCustomHouses();
  if (trimmed && !existing.some(h => h.toLowerCase() === trimmed.toLowerCase())) {
    const next = [...existing, trimmed];
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }
  return existing;
}
