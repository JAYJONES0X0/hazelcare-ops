import { afterEach, expect, it, vi } from 'vitest';
import { prepareTextStream } from '../_lib/ai-stream.js';
const encode = value => new TextEncoder().encode(value);
afterEach(() => vi.useRealTimers());
it('ignores keepalives and preserves the first real token', async () => {
  const res = new Response(new ReadableStream({ start(c) { c.enqueue(encode(': keepalive\ndata: {"choices":[{"delta":{"role":"assistant"}}]}\n')); c.enqueue(encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\ndata: {"choices":[{"delta":{"content":" world"}}]}\n')); c.close(); } }));
  const stream = await prepareTextStream({ res, provider: 'groq' });
  let text = ''; for await (const chunk of stream) text += chunk;
  expect(text).toBe('Hello world');
});
it('rejects an empty successful stream before choosing a provider', async () => {
  await expect(prepareTextStream({ res: new Response('data: [DONE]\n'), provider: 'groq' })).rejects.toThrow('no generated text');
});
it('rejects silent streams within the first-token deadline and cancels them', async () => {
  vi.useFakeTimers(); const cancel = vi.fn();
  const pending = prepareTextStream({ res: new Response(new ReadableStream({ cancel })), provider: 'groq' }, 100);
  const assertion = expect(pending).rejects.toThrow('stalled');
  await vi.advanceTimersByTimeAsync(101); await assertion; expect(cancel).toHaveBeenCalled();
});
it('rejects a stalled stream after output instead of treating a partial draft as complete', async () => {
  vi.useFakeTimers(); const cancel = vi.fn();
  const stream = await prepareTextStream({ res: new Response(new ReadableStream({ start(c) { c.enqueue(encode('data: {"choices":[{"delta":{"content":"Partial"}}]}\n')); }, cancel })), provider: 'groq' }, 100, 100);
  const iterator = stream[Symbol.asyncIterator](); expect((await iterator.next()).value).toBe('Partial');
  const assertion = expect(iterator.next()).rejects.toThrow('stalled');
  await vi.advanceTimersByTimeAsync(101); await assertion; expect(cancel).toHaveBeenCalled();
});
it('falls back from a header-only provider and skips it during cooldown', async () => {
  vi.resetModules(); vi.useFakeTimers();
  const { mintHcSession } = await import('../_lib/hc-session.js');
  const secret = 'synthetic-stream-fallback-test-secret';
  vi.stubEnv('AUTH_SESSION_SECRET', secret); vi.stubEnv('GEMINI_API_KEY', 'synthetic'); vi.stubEnv('GROQ_API_KEY', 'synthetic');
  vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {});
  const fetchMock = vi.fn(url => Promise.resolve(String(url).includes('googleapis')
    ? new Response(new ReadableStream())
    : new Response('data: {"choices":[{"delta":{"content":"Synthetic output"}}]}\n')));
  vi.stubGlobal('fetch', fetchMock);
  const { default: handler } = await import('../staff/[...action].js');
  const req = { method: 'POST', url: '/api/staff/enhance-note', headers: { cookie: `hc_session=${mintHcSession(secret, 1, { role: 'manager' }).value}` }, body: { text: 'Synthetic test only.' } };
  function response() { return { chunks: [], setHeader() {}, write(text) { this.chunks.push(text); }, end() {}, status() { return this; } }; }
  const first = response(); const pending = handler(req, first);
  await vi.advanceTimersByTimeAsync(12100); await pending;
  expect(first.chunks.join('')).toBe('Synthetic output');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  const second = response(); await handler(req, second);
  expect(second.chunks.join('')).toBe('Synthetic output');
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(String(fetchMock.mock.calls[2][0])).toContain('groq.com');
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks();
});
