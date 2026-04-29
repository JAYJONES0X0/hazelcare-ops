import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mintHcSession } from '../_lib/hc-session.js';
import { signStaffSacCookie } from '../_lib/staff-sac-cookie.js';

function createReq(cookieHeader = '') {
  return {
    method: 'GET',
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  };
}

function createRes() {
  return {
    statusCode: 200,
    jsonBody: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    },
    end() {
      return this;
    },
    setHeader() {},
  };
}

describe('/api/session scope flags', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_SESSION_SECRET = 'unit-test-auth-session-secret-32b!!';
    process.env.STAFF_LINK_SECRET = 'unit-test-staff-link-secret-32chars!';
  });

  it('returns authed + staffScoped when both cookies are present', async () => {
    const { default: handler } = await import('../auth/[...action].js');
    const session = mintHcSession(process.env.AUTH_SESSION_SECRET, 1);
    const staff = signStaffSacCookie('notes', process.env.STAFF_LINK_SECRET);
    const req = createReq(`hc_session=${session.value}; hc_staff_sac=${staff.value}`);
    req.url = '/api/auth/session';
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ authed: true, staffScoped: true });
  });

  it('returns no scope when no cookies are provided', async () => {
    const { default: handler } = await import('../auth/[...action].js');
    const req = createReq();
    req.url = '/api/auth/session';
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ authed: false, staffScoped: false });
  });
});
