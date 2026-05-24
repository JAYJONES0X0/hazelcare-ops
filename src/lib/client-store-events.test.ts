import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyClient, loadClients, saveClient } from './client-store';

function createLocalStorageMock(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
  };
}

describe('client store change events', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('dispatches a client refresh event when a client is saved', async () => {
    const localStorage = createLocalStorageMock({
      'hc-schema-v': '3',
    });
    const dispatchEvent = vi.fn();
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('window', { dispatchEvent } as unknown as Window);

    const client = emptyClient();
    client.name = 'Lewis Johnson';

    saveClient(client);

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect((dispatchEvent.mock.calls[0][0] as Event).type).toBe('hc-clients-updated');
    expect(loadClients()).toHaveLength(1);
  });
});
