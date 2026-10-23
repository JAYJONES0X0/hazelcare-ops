import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeOnce } from './durable-once.js';

const usedProductionKeys = ['recovery:already-used', 'staff-jti:already-used'];

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.invalid');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'synthetic-token');
  const consumed = new Set(usedProductionKeys);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    const [, key] = JSON.parse(options.body);
    const firstUse = !consumed.has(key);
    consumed.add(key);
    return { ok: true, json: async () => ({ result: firstUse ? 'OK' : null }) };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('replay protection across deployment environments', () => {
  it.each(usedProductionKeys)('preserves consumed production keys for %s', async key => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(await consumeOnce(key, 600)).toEqual({ ok: true, firstUse: false });
  });

  it.each(usedProductionKeys)('isolates preview replay state for %s even with a production Node build', async key => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(await consumeOnce(key, 600)).toEqual({ ok: true, firstUse: true });
    expect(await consumeOnce(key, 600)).toEqual({ ok: true, firstUse: false });
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(await consumeOnce(key, 600)).toEqual({ ok: true, firstUse: false });
  });
});
