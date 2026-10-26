import { afterEach, expect, it, vi } from 'vitest';
import { mintHcSession } from '../_lib/hc-session.js';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it('finishes stalled intelligence providers within the shared deadline', async () => {
  vi.resetModules(); vi.useFakeTimers();
  const secret = 'synthetic-ai-deadline-session-secret';
  vi.stubEnv('AUTH_SESSION_SECRET', secret);
  for (const key of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY']) vi.stubEnv(key, 'synthetic-test-key');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
    return controller.signal;
  });
  const stalled = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  vi.stubGlobal('fetch', stalled);
  const { default: handler } = await import('../staff/[...action].js');
  const response = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const pending = handler({ method: 'POST', url: '/api/staff/analyze-intel', query: { action: 'analyze-intel' }, headers: { cookie: `hc_session=${mintHcSession(secret, 1, { role: 'manager' }).value}` }, body: { text: 'Synthetic timeout test; no personal data.' } }, response);
  await vi.advanceTimersByTimeAsync(60_001);
  await pending;
  expect(response.statusCode).toBe(500);
  expect(response.body.message).toContain('All intelligence providers failed');
  expect(stalled).toHaveBeenCalledTimes(3);
});
