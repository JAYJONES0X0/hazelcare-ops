function sanitizeEnvValue(v) {
  const firstLine = String(v || '').split(/\r?\n/)[0];
  return firstLine.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
}
const UPSTASH_URL = sanitizeEnvValue(process.env.UPSTASH_REDIS_REST_URL);
const UPSTASH_TOKEN = sanitizeEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN);
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
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', key, '1', 'EX', String(ttlSeconds), 'NX']),
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    console.warn('[durable-once] upstash rejected:', res.status, bodyText.slice(0, 300));
    return { ok: false, firstUse: false, error: `Redis responded ${res.status}` };
  }
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
