import { redisCommand, redisNamespace } from './redis.js';

const localExpiries = new Map();

export async function consumeOnce(key, ttlSeconds) {
  // Preserve consumed production recovery codes and staff links across this release.
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const legacyKey = isProduction && (key.startsWith('recovery:') || key.startsWith('staff-jti:'));
  const namespacedKey = legacyKey ? key : `${redisNamespace()}:once:${key}`;
  if (process.env.NODE_ENV === 'test' || (process.env.ALLOW_INMEMORY_REPLAY_FALLBACK === '1' && process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production')) {
    const now = Date.now();
    for (const [id, expires] of localExpiries) if (expires <= now) localExpiries.delete(id);
    if (localExpiries.has(namespacedKey)) return { ok: true, firstUse: false };
    localExpiries.set(namespacedKey, now + ttlSeconds * 1000);
    return { ok: true, firstUse: true };
  }
  try {
    const result = await redisCommand(['SET', namespacedKey, '1', 'EX', String(ttlSeconds), 'NX']);
    return { ok: true, firstUse: result === 'OK' };
  } catch {
    return { ok: false, firstUse: false, error: 'Authentication storage is unavailable. Please retry.' };
  }
}
