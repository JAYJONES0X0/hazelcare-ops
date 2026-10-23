import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mintHcSession } from '../_lib/hc-session.js';

const { handleUpload, get } = vi.hoisted(() => ({ handleUpload: vi.fn(), get: vi.fn() }));
vi.mock('@vercel/blob/client', () => ({ handleUpload }));
vi.mock('@vercel/blob', () => ({ get }));
const secret = 'synthetic-document-session-secret';
function response() { return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; }, end() { return this; } }; }
function request(role, pathname = 'evidence/1234-abcd.pdf') { return { method: 'POST', url: '/api/staff/upload-document', headers: { cookie: role ? `hc_session=${mintHcSession(secret, 1, { role }).value}` : '' }, body: { type: 'blob.generate-client-token', payload: { pathname } } }; }
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv('AUTH_SESSION_SECRET', secret); vi.stubEnv('EVIDENCE_BLOB_READ_WRITE_TOKEN', 'synthetic-private-store-token'); });
afterEach(() => vi.unstubAllEnvs());

describe('private document upload boundaries', () => {
  it('rejects unauthenticated upload authorization', async () => {
    const { default: handler } = await import('../staff/[...action].js');
    const res = response(); await handler(request(null), res);
    expect(res.statusCode).toBe(401); expect(handleUpload).not.toHaveBeenCalled();
  });
  it('rejects a viewer before creating an upload token', async () => {
    const { default: handler } = await import('../staff/[...action].js');
    const res = response(); await handler(request('viewer'), res);
    expect(res.statusCode).toBe(403); expect(handleUpload).not.toHaveBeenCalled();
  });
  it('uses only the separate private store and constrains size and MIME types', async () => {
    handleUpload.mockImplementation(async options => { const policy = await options.onBeforeGenerateToken('evidence/1234-abcd.pdf'); expect(policy.maximumSizeInBytes).toBe(25 * 1024 * 1024); expect(policy.allowedContentTypes).not.toContain('text/html'); expect(policy.allowOverwrite).toBe(false); expect(options.token).toBe('synthetic-private-store-token'); return { type: 'blob.generate-client-token', clientToken: 'synthetic-scoped-client-token' }; });
    const { default: handler } = await import('../staff/[...action].js');
    const res = response(); await handler(request('senior'), res);
    expect(res.statusCode).toBe(200); expect(res.body.clientToken).toBe('synthetic-scoped-client-token');
  });
  it('never falls back to the public store when private storage is unavailable', async () => {
    vi.stubEnv('EVIDENCE_BLOB_READ_WRITE_TOKEN', ''); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'synthetic-public-store-token');
    const { default: handler } = await import('../staff/[...action].js');
    const res = response(); await handler(request('manager'), res);
    expect(res.statusCode).toBe(503); expect(handleUpload).not.toHaveBeenCalled();
  });
  it('rejects arbitrary storage paths', async () => {
    handleUpload.mockImplementation(async options => options.onBeforeGenerateToken('../../private.txt'));
    const { default: handler } = await import('../staff/[...action].js');
    const res = response(); await handler(request('manager'), res);
    expect(res.statusCode).toBe(400);
  });
  it('requires a session to read a private document', async () => {
    const { default: handler } = await import('../staff/[...action].js');
    const res = response(); await handler({ method: 'GET', url: '/api/staff/document', headers: {}, query: { pathname: 'evidence/test.pdf' } }, res);
    expect(res.statusCode).toBe(401); expect(get).not.toHaveBeenCalled();
  });
});
