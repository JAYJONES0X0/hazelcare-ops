import { expect, it, vi } from 'vitest';
import { saveClients } from './client-store';
it('does not delete the saved client register or notify success after quota failure', () => {
  const setItem = vi.fn(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  const removeItem = vi.fn();
  vi.stubGlobal('localStorage', { setItem, removeItem, getItem: () => '[{"id":"existing"}]' });
  expect(() => saveClients([])).toThrow('Save failed');
  expect(removeItem).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
