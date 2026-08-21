import { beforeEach, describe, expect, it, vi } from 'vitest';

function clearCredentialEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

describe('OVSITE durable credentials', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    clearCredentialEnv();
  });

  it('uses AUTH_PASSWORD-compatible bootstrap verification when durable storage is not configured', async () => {
    const { verifyActivePassword, verifySessionCredentialState } = await import('../_lib/ovsite-credentials.js');

    await expect(verifyActivePassword('Bootstrap-Secret-123', 'Bootstrap-Secret-123')).resolves.toMatchObject({
      ok: true,
      verified: true,
      source: 'bootstrap',
    });

    await expect(verifyActivePassword('wrong', 'Bootstrap-Secret-123')).resolves.toMatchObject({
      ok: true,
      verified: false,
      source: 'bootstrap',
    });

    await expect(verifySessionCredentialState({ iat: Date.now() - 60_000 })).resolves.toMatchObject({
      ok: true,
      current: true,
      source: 'bootstrap',
    });
  });

  it('refuses an in-app password change when durable storage is unavailable', async () => {
    const { replaceActivePassword } = await import('../_lib/ovsite-credentials.js');

    await expect(replaceActivePassword({
      currentPassword: 'Bootstrap-Secret-123',
      newPassword: 'New-Durable-Secret-456',
      bootstrapPassword: 'Bootstrap-Secret-123',
    })).resolves.toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it('rotates from bootstrap to a durable scrypt hash, rejects the old password, and invalidates older sessions', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example-upstash.invalid';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    let storedRecord = null;
    const fetchMock = vi.fn(async (_url, options = {}) => {
      const command = JSON.parse(options.body);
      const [operation, key, value] = command;

      if (operation === 'GET') {
        return {
          ok: true,
          json: async () => ({ result: storedRecord }),
        };
      }

      if (operation === 'SET') {
        expect(key).toBe('ovsite:auth:credential:v1');
        storedRecord = value;
        return {
          ok: true,
          json: async () => ({ result: 'OK' }),
        };
      }

      if (operation === 'LPUSH' || operation === 'LTRIM') {
        return {
          ok: true,
          json: async () => ({ result: 1 }),
        };
      }

      throw new Error(`Unexpected Redis command: ${operation}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const {
      replaceActivePassword,
      verifyActivePassword,
      verifySessionCredentialState,
    } = await import('../_lib/ovsite-credentials.js');

    const changed = await replaceActivePassword({
      currentPassword: 'Bootstrap-Secret-123',
      newPassword: 'New-Durable-Secret-456',
      bootstrapPassword: 'Bootstrap-Secret-123',
    });

    expect(changed).toMatchObject({ ok: true, sourceBeforeChange: 'bootstrap' });
    expect(storedRecord).toBeTruthy();

    const parsed = JSON.parse(storedRecord);
    expect(parsed).toMatchObject({ version: 1, algorithm: 'scrypt' });
    expect(parsed.hash).not.toContain('New-Durable-Secret-456');

    await expect(verifyActivePassword('New-Durable-Secret-456', 'Bootstrap-Secret-123')).resolves.toMatchObject({
      ok: true,
      verified: true,
      source: 'durable',
    });

    await expect(verifyActivePassword('Bootstrap-Secret-123', 'Bootstrap-Secret-123')).resolves.toMatchObject({
      ok: true,
      verified: false,
      source: 'durable',
    });

    const changedAt = Date.parse(parsed.updatedAt);
    await expect(verifySessionCredentialState({ iat: changedAt - 1 })).resolves.toMatchObject({
      ok: true,
      current: false,
      source: 'durable',
    });
    await expect(verifySessionCredentialState({ iat: changedAt + 1 })).resolves.toMatchObject({
      ok: true,
      current: true,
      source: 'durable',
    });
  });
});
