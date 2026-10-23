export function sanitizeEnvValue(value) {
  return String(value || '').split(/\r?\n/)[0].trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
}

export function redisNamespace() {
  return `careops:${process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'}`;
}

export async function redisCommand(command) {
  const url = sanitizeEnvValue(process.env.UPSTASH_REDIS_REST_URL);
  const token = sanitizeEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) throw new Error('Authentication storage is not configured');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Authentication storage is unavailable');
  const body = await response.json();
  if (body.error) throw new Error('Authentication storage rejected the request');
  return body.result;
}
