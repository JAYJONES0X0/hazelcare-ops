import { beforeEach, describe, expect, it, vi } from 'vitest';

function createReq(body = {}) {
  return {
    method: 'POST',
    body,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    jsonBody: undefined,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

describe('/api/login identifier-first flow', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_PASSWORD = 'TopSecret!123';
    process.env.AUTH_LOGIN_EMAIL = 'ops@hazelcare.co.uk';
    process.env.AUTH_SESSION_SECRET = 'unit-test-auth-session-secret-32b!!';
  });

  it('recognizes known email in probe mode', async () => {
    const { default: handler } = await import('./login.js');
    const req = createReq({ email: 'ops@hazelcare.co.uk', probe: true });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true, recognized: true });
  });

  it('rejects unknown email in probe mode with contact-admin path', async () => {
    const { default: handler } = await import('./login.js');
    const req = createReq({ email: 'unknown@hazelcare.co.uk', probe: true });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toMatchObject({ ok: false, recognized: false });
  });

  it('rejects all probes when AUTH_LOGIN_EMAIL is not configured (fail closed)', async () => {
    delete process.env.AUTH_LOGIN_EMAIL;
    const { default: handler } = await import('./login.js');
    const req = createReq({ email: 'ops@hazelcare.co.uk', probe: true });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.jsonBody).toMatchObject({ ok: false, recognized: false });
    process.env.AUTH_LOGIN_EMAIL = 'ops@hazelcare.co.uk';
  });

  it('allows either of two comma-separated emails', async () => {
    process.env.AUTH_LOGIN_EMAIL = 'ops@hazelcare.co.uk,jane@hazelcare.co.uk';
    const { default: handler } = await import('./login.js');
    const res = createRes();
    await handler(createReq({ email: 'jane@hazelcare.co.uk', probe: true }), res);
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true, recognized: true });
  });

  it('signs in with known email + valid password', async () => {
    const { default: handler } = await import('./login.js');
    const req = createReq({ email: 'ops@hazelcare.co.uk', password: 'TopSecret!123' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toMatchObject({ ok: true });
    expect(String(res.headers['Set-Cookie'] || '')).toContain('hc_session=');
  });
});
