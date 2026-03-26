const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const ALLOW_INMEMORY_FALLBACK = process.env.ALLOW_INMEMORY_REPLAY_FALLBACK === '1';

const inMemoryExpiries = new Map();

function pruneInMemory() {
  const now = Date.now();
  for (const [key, exp] of inMemoryExpiries.entries()) {
    if (exp <= now) inMemoryExpiries.delete(key);
  }
}

async function consumeOnceInMemory(key, ttlSeconds) {
  pruneInMemory();
  if (inMemoryExpiries.has(key)) return { ok: true, firstUse: false };
  inMemoryExpiries.set(key, Date.now() + ttlSeconds * 1000);
  return { ok: true, firstUse: true };
}

async function consumeOnceUpstash(key, ttlSeconds) {
  const url = `${UPSTASH_URL}/set/${encodeURIComponent(key)}/1?EX=${ttlSeconds}&NX=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
    },
  });
  if (!res.ok) return { ok: false, firstUse: false, error: `Redis responded ${res.status}` };
  const body = await res.json().catch(() => null);
  return { ok: true, firstUse: body?.result === 'OK' };
}

export async function consumeOnce(key, ttlSeconds) {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    return consumeOnceUpstash(key, ttlSeconds);
  }
  if (ALLOW_INMEMORY_FALLBACK) {
    return consumeOnceInMemory(key, ttlSeconds);
  }
  return {
    ok: false,
    firstUse: false,
    error: 'Durable replay protection is not configured',
  };
}
