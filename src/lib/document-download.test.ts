import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { documentDownloadUrl } from './document-download';

describe('document download links', () => {
  it('replaces legacy public links with an authenticated opaque reference', async () => {
    const original = 'https://r3wmqgl6ypugf91u.public.blob.vercel-storage.com/synthetic-document.pdf';
    const result = await documentDownloadUrl(original);
    expect(result).toBe(`/api/staff/document?legacy=${createHash('sha256').update(original).digest('hex')}`);
    expect(result).not.toContain('synthetic-document');
  });
  it('preserves existing authenticated document links', async () => {
    const original = '/api/staff/document?pathname=evidence%2Fsynthetic.pdf';
    expect(await documentDownloadUrl(original)).toBe(original);
  });
  it('does not remap another HTTPS service', async () => {
    expect(await documentDownloadUrl('https://example.invalid/document.pdf')).toBe('https://example.invalid/document.pdf');
  });
  it('rejects executable URLs', async () => {
    await expect(documentDownloadUrl('javascript:alert(1)')).rejects.toThrow('Unsupported document link');
  });
});
