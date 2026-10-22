/** @param {import('http').IncomingMessage} req */
export function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return acc;
    try { acc[k] = decodeURIComponent(v.join('=') || ''); } catch { /* Ignore malformed cookies. */ }
    return acc;
  }, {});
}
