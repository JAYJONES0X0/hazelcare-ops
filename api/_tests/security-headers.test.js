import { describe, expect, it } from 'vitest';
import vercelConfig from '../../vercel.json' with { type: 'json' };

function getGlobalHeader(name) {
  const globalHeaders = vercelConfig.headers.find((entry) => entry.source === '/(.*)')?.headers || [];
  return globalHeaders.find((header) => header.key === name)?.value || '';
}

describe('security headers', () => {
  it('allows the external font sources the app actually loads', () => {
    const csp = getGlobalHeader('Content-Security-Policy');

    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' data: https://fonts.gstatic.com");
  });
});
