import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyHcSession, readHcSessionClaims } from '../_lib/hc-session.js';

const SECRET = 'synthetic-session-secret-for-security-tests';
const EMAIL = 'audit@example.invalid';
function response() { return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; }, end() { return this; } }; }
function request(route, body = {}, cookie = '') { return { url: `/api/auth/${route}`, method: 'POST', body, headers: { cookie }, socket: { remoteAddress: '127.0.0.1' } }; }
function cookie(res, name) { return [res.headers['Set-Cookie']].flat().filter(Boolean).find(value => value.startsWith(`${name}=`))?.split(';')[0] || ''; }
function totp() { const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const hmac = crypto.createHmac('sha1', Buffer.from('48656c6c6f21deadbeef', 'hex')).update(counter).digest(); const offset = hmac.at(-1) & 15; return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0'); }

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('AUTH_PASSWORD', 'synthetic-password');
  vi.stubEnv('AUTH_LOGIN_EMAIL', EMAIL);
  vi.stubEnv('AUTH_LOGIN_EMAIL_ROLES', `${EMAIL}:viewer`);
  vi.stubEnv('AUTH_SESSION_SECRET', SECRET);
  vi.stubEnv('AUTH_TOTP_SECRET', 'JBSWY3DPEHPK3PXP');
  vi.stubEnv('AUTH_RECOVERY_CODES', 'SYNTHETIC-RECOVERY-1');
  vi.stubEnv('AUTH_EMERGENCY_BYPASS', '0');
  vi.stubEnv('CODE_SECRET', 'synthetic-code-secret');
  vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function firstFactor(handler) { const res = response(); await handler(request('login', { email: EMAIL, password: 'synthetic-password' }), res); return res; }

describe('authentication boundaries', () => {
  it('never treats the pending challenge as a full session', async () => {
    const { default: handler } = await import('../auth/[...action].js');
    const res = await firstFactor(handler);
    expect(res.body.requires2fa).toBe(true);
    expect(cookie(res, 'hc_session')).toBe('');
    const pending = cookie(res, 'hc_auth_challenge');
    expect(pending).not.toBe('');
    expect(verifyHcSession(pending.slice(pending.indexOf('=') + 1), SECRET)).toBe(false);
  });
  it('requires the first factor for recovery codes', async () => {
    const { default: handler } = await import('../auth/[...action].js');
    const res = response();
    await handler(request('verify-backup', { method: 'recovery', code: 'SYNTHETIC-RECOVERY-1' }), res);
    expect(res.statusCode).toBe(401);
    expect(cookie(res, 'hc_session')).toBe('');
  });
  it('completes TOTP login with the exact original identity and role', async () => {
    const { default: handler } = await import('../auth/[...action].js');
    const pending = await firstFactor(handler);
    const res = response();
    await handler(request('verify-backup', { method: 'totp', code: totp() }, cookie(pending, 'hc_auth_challenge')), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(true);
    const full = cookie(res, 'hc_session');
    expect(readHcSessionClaims(full.slice(full.indexOf('=') + 1), SECRET)).toMatchObject({ email: EMAIL, role: 'viewer' });
    const session = response();
    await handler({ ...request('session', {}, full), method: 'GET' }, session);
    expect(session.body).toMatchObject({ authed: true, email: EMAIL, role: 'viewer' });
  });
  it('rejects a failed second factor without issuing a session', async () => {
    const { default: handler } = await import('../auth/[...action].js');
    const pending = await firstFactor(handler);
    const res = response();
    await handler(request('verify-backup', { method: 'totp', code: 'not-a-code' }, cookie(pending, 'hc_auth_challenge')), res);
    expect(res.statusCode).toBe(401);
    expect(cookie(res, 'hc_session')).toBe('');
  });
  it('consumes recovery codes once across separate login challenges', async () => {
    const { default: handler } = await import('../auth/[...action].js');
    for (const expected of [200, 401]) {
      const pending = await firstFactor(handler);
      const res = response();
      await handler(request('verify-backup', { method: 'recovery', code: 'SYNTHETIC-RECOVERY-1' }, cookie(pending, 'hc_auth_challenge')), res);
      expect(res.statusCode).toBe(expected);
    }
  });
  it('fails clearly when no session secret exists', async () => {
    vi.stubEnv('AUTH_SESSION_SECRET', '');
    const { default: handler } = await import('../auth/[...action].js');
    const res = await firstFactor(handler);
    expect(res.statusCode).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(cookie(res, 'hc_session')).toBe('');
  });
  it('rejects a Telegram token issued for another challenge', async () => {
    const { default: handler } = await import('../auth/[...action].js');
    const pending = await firstFactor(handler);
    const token = crypto.createHmac('sha256', 'synthetic-code-secret').update(`different-challenge:123456:${Math.floor(Date.now() / 600000)}`).digest('hex');
    const res = response();
    await handler(request('verify-code', { code: '123456', token }, cookie(pending, 'hc_auth_challenge')), res);
    expect(res.statusCode).toBe(401);
    expect(cookie(res, 'hc_session')).toBe('');
  });
  it('fails closed when production rate-limit storage is unavailable', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const { default: handler } = await import('../auth/[...action].js');
    const res = await firstFactor(handler);
    expect(res.statusCode).toBe(503);
    expect(cookie(res, 'hc_session')).toBe('');
  });
});
