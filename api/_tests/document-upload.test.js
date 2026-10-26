import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mintHcSession } from '../_lib/hc-session.js';

const { handleUpload, get } = vi.hoisted(() => ({ handleUpload: vi.fn(), get: vi.fn() }));
vi.mock('@vercel/blob/client', () => ({ handleUpload }));
vi.mock('@vercel/blob', () => ({ get }));
const secret = 'synthetic-document-session-secret';
function response() { return { statusCode: 200, headers: {}, chunks: [], status(code) { this.statusCode = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; }, write(chunk) { this.chunks.push(chunk); return true; }, end() { return this; } }; }
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
  it('streams a migrated reference from the private store after authentication', async () => {
    const reference = 'a'.repeat(64);
    vi.stubEnv('EVIDENCE_LEGACY_DOCUMENT_MAP', JSON.stringify({ [reference]: 'evidence/migrated.pdf' }));
    get.mockResolvedValue({ statusCode: 200, blob: { contentType: 'application/pdf' }, stream: (async function* () { yield Buffer.from('synthetic-document'); })() });
    const { default: handler } = await import('../staff/[...action].js');
    const res = response();
    await handler({ ...request('manager'), method: 'GET', url: '/api/staff/document', query: { legacy: reference } }, res);
    expect(res.statusCode).toBe(200);
    expect(get).toHaveBeenCalledWith('evidence/migrated.pdf', { access: 'private', token: 'synthetic-private-store-token', useCache: false });
    expect(Buffer.concat(res.chunks).toString()).toBe('synthetic-document');
    expect(res.headers['Cache-Control']).toContain('no-store');
  });
  it('does not reveal whether a legacy reference exists without authentication', async () => {
    vi.stubEnv('EVIDENCE_LEGACY_DOCUMENT_MAP', '{}');
    const { default: handler } = await import('../staff/[...action].js');
    const res = response();
    await handler({ method: 'GET', url: '/api/staff/document', headers: {}, query: { legacy: 'a'.repeat(64) } }, res);
    expect(res.statusCode).toBe(401); expect(get).not.toHaveBeenCalled();
  });
  it('does not fall back to a public URL for an unknown legacy reference', async () => {
    vi.stubEnv('EVIDENCE_LEGACY_DOCUMENT_MAP', '{}');
    const { default: handler } = await import('../staff/[...action].js');
    const res = response();
    await handler({ ...request('manager'), method: 'GET', url: '/api/staff/document', query: { legacy: 'b'.repeat(64) } }, res);
    expect(res.statusCode).toBe(404); expect(get).not.toHaveBeenCalled();
  });
  it('rejects an ambiguous private and legacy document selection', async () => {
    const { default: handler } = await import('../staff/[...action].js');
    const res = response();
    await handler({ ...request('manager'), method: 'GET', url: '/api/staff/document', query: { legacy: 'a'.repeat(64), pathname: 'evidence/other.pdf' } }, res);
    expect(res.statusCode).toBe(400); expect(get).not.toHaveBeenCalled();
  });
  it('fails clearly when the migration mapping is malformed', async () => {
    vi.stubEnv('EVIDENCE_LEGACY_DOCUMENT_MAP', 'invalid-json');
    const { default: handler } = await import('../staff/[...action].js');
    const res = response();
    await handler({ ...request('manager'), method: 'GET', url: '/api/staff/document', query: { legacy: 'a'.repeat(64) } }, res);
    expect(res.statusCode).toBe(503); expect(get).not.toHaveBeenCalled();
  });
});
