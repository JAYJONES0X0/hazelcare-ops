import { IDBFactory, IDBDatabase } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
function legacy(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), removeItem: vi.fn((key: string) => { values.delete(key); }) };
}
beforeEach(() => { vi.resetModules(); vi.stubGlobal('navigator', {}); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('window', { addEventListener: vi.fn(), alert: vi.fn() }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('migrates existing records before removing their legacy copy', async () => {
  const old = legacy({ 'hc-clients-v2': '[{"id":"synthetic"}]' });
  const records = await import('./browser-records');
  await records.initialiseBrowserRecords(old);
  expect(records.recordStorage(old).getItem('hc-clients-v2')).toBe('[{"id":"synthetic"}]');
  expect(old.getItem('hc-clients-v2')).toBeNull();
});
it('commits and reloads a six MiB record when localStorage writes are unavailable', async () => {
  const old = legacy(); old.setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  const records = await import('./browser-records'); await records.initialiseBrowserRecords(old);
  const payload = JSON.stringify({ text: 'x'.repeat(6 * 1024 * 1024) });
  records.recordStorage(old).setItem('hc-week-data-v2', payload);
  await records.flushRecordWrites();
  await records.initialiseBrowserRecords(old);
  expect(records.recordStorage(old).getItem('hc-week-data-v2')).toBe(payload);
  expect(old.setItem).not.toHaveBeenCalled();
});
it('preserves the legacy copy if the migration cannot commit', async () => {
  const old = legacy({ 'hc-clients-v2': 'original' });
  const original = IDBDatabase.prototype.transaction;
  vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, names, mode, options) {
    if (mode === 'readwrite') throw new DOMException('Full', 'QuotaExceededError');
    return original.call(this, names, mode, options);
  });
  const records = await import('./browser-records');
  await expect(records.initialiseBrowserRecords(old)).rejects.toThrow();
  expect(old.getItem('hc-clients-v2')).toBe('original');
  expect(old.removeItem).not.toHaveBeenCalled();
});
it('rejects failed writes and restores the last committed view', async () => {
  const old = legacy({ 'hc-clients-v2': 'previous' });
  const records = await import('./browser-records'); await records.initialiseBrowserRecords(old);
  vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  records.recordStorage(old).setItem('hc-clients-v2', 'replacement');
  await expect(records.flushRecordWrites()).rejects.toThrow();
  expect(records.recordStorage(old).getItem('hc-clients-v2')).toBe('previous');
});
it('preserves both copies when an older tab has written conflicting legacy data', async () => {
  const old = legacy({ 'hc-clients-v2': 'first' });
  const records = await import('./browser-records'); await records.initialiseBrowserRecords(old);
  old.setItem('hc-clients-v2', 'older-tab-edit');
  await expect(records.initialiseBrowserRecords(old)).rejects.toThrow('Conflicting');
  expect(old.getItem('hc-clients-v2')).toBe('older-tab-edit');
});

it('refuses a second writer tab without changing existing data', async () => {
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, callback: (lock: null) => Promise<void>) => callback(null) } });
  const old = legacy({ 'hc-clients-v2': 'existing' });
  const records = await import('./browser-records');
  await expect(records.initialiseBrowserRecords(old)).rejects.toThrow('Another OS tab');
  expect(old.getItem('hc-clients-v2')).toBe('existing');
  expect(old.removeItem).not.toHaveBeenCalled();
});
