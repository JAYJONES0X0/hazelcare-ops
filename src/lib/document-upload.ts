import { upload } from '@vercel/blob/client';

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/png', 'image/jpeg', 'image/webp'];

export async function uploadPrivateDocument(file: File) {
  if (!file.size) throw new Error('Choose a non-empty document.');
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error('File too large. The maximum size is 25 MB.');
  if (!DOCUMENT_TYPES.includes(file.type)) throw new Error('Choose a PDF, Word document, text file or supported image.');
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
  if (!/^(pdf|doc|docx|txt|png|jpe?g|webp)$/.test(extension)) throw new Error('Unsupported document extension.');
  try {
    const blob = await upload(`evidence/${crypto.randomUUID()}.${extension}`, file, {
      access: 'private',
      contentType: file.type,
      handleUploadUrl: '/api/staff/upload-document',
      multipart: true,
      abortSignal: AbortSignal.timeout(120000),
    });
    return { url: `/api/staff/document?pathname=${encodeURIComponent(blob.pathname)}` };
  } catch (error) {
    if (error instanceof Error) throw new Error(`Document upload failed: ${error.message}`);
    throw new Error('Document upload failed. Check your connection and retry.');
  }
}
