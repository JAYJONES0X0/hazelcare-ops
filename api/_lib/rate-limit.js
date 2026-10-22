import crypto from 'node:crypto';
import { redisCommand, redisNamespace } from './redis.js';

const localBuckets = new Map();
const incrementWithExpiry = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return n";

export async function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const digest = crypto.createHash('sha256').update(key).digest('hex');
  const redisKey = `${redisNamespace()}:ratelimit:${digest}:${bucket}`;
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' || process.env.UPSTASH_REDIS_REST_URL) {
    const count = await redisCommand(['EVAL', incrementWithExpiry, '1', redisKey, String(windowMs * 2)]);
    return Number(count) > max;
  }
  // Tests and offline local development only. Production always uses shared state.
  for (const [id, entry] of localBuckets) if (entry.expires <= now) localBuckets.delete(id);
  const entry = localBuckets.get(redisKey) || { count: 0, expires: now + windowMs * 2 };
  entry.count++;
  localBuckets.set(redisKey, entry);
  return entry.count > max;
}
