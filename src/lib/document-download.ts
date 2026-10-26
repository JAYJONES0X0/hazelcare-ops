const LEGACY_BLOB_HOST = 'r3wmqgl6ypugf91u.public.blob.vercel-storage.com';

export async function documentDownloadUrl(value: string): Promise<string> {
  if (value.startsWith('/api/staff/document?')) return value;
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Unsupported document link');
  if (url.hostname !== LEGACY_BLOB_HOST) return value;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const reference = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return `/api/staff/document?legacy=${reference}`;
}
