import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockRes } from './test-utils.js';
import { mintHcSession, HC_SESSION_COOKIE } from './_lib/hc-session.js';

const STAFF = 'unit-test-staff-link-secret-32chars!!';
const AUTH = 'unit-test-auth-session-secret-32b!!!';

describe('issue-staff-link handler', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.STAFF_LINK_SECRET = STAFF;
    process.env.AUTH_SESSION_SECRET = AUTH;
    delete process.env.APP_ORIGIN;
  });

  it('returns 401 when hc_session is missing', async () => {
    const { default: handler } = await import('./issue-staff-link.js');
    const res = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: { cookie: '', host: 'ops.example.com', 'x-forwarded-proto': 'https' },
        body: { toolId: 'notes' },
      },
      res,
    );
    expect(res.statusCode).toBe(401);
    expect(res._json?.error).toBe('Sign in required');
  });

  it('returns 200 with link and code when session is valid', async () => {
    const { value } = mintHcSession(AUTH, 12);
    const { default: handler } = await import('./issue-staff-link.js');
    const res = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: {
          cookie: `${HC_SESSION_COOKIE}=${value}`,
          host: 'ops.example.com',
          'x-forwarded-proto': 'https',
        },
        body: { toolId: 'notes' },
      },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res._json?.link).toContain('https://ops.example.com#staff/notes?t=');
    expect(res._json?.code).toMatch(/^([A-Z0-9]{4}-){2}[A-Z0-9]{4}$/);
    expect(typeof res._json?.expiresAt).toBe('number');
  });

  it('returns 400 for invalid toolId', async () => {
    const { value } = mintHcSession(AUTH, 12);
    const { default: handler } = await import('./issue-staff-link.js');
    const res = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: { cookie: `${HC_SESSION_COOKIE}=${value}` },
        body: { toolId: 'not-a-real-tool' },
      },
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 405 for GET', async () => {
    const { default: handler } = await import('./issue-staff-link.js');
    const res = createMockRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 503 when AUTH_SESSION_SECRET unset', async () => {
    vi.resetModules();
    process.env.STAFF_LINK_SECRET = STAFF;
    delete process.env.AUTH_SESSION_SECRET;
    const { default: handler } = await import('./issue-staff-link.js');
    const res = createMockRes();
    await handler(
      { method: 'POST', headers: { cookie: 'x=1' }, body: { toolId: 'notes' } },
      res,
    );
    expect(res.statusCode).toBe(503);
  });
});
