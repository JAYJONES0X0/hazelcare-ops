import { describe, it, expect } from 'vitest';
import { escapeHtml } from './html-escape';

describe('escapeHtml', () => {
  it('escapes angle brackets and ampersands', () => {
    expect(escapeHtml('<script>x</script>')).toBe(
      '&lt;script&gt;x&lt;/script&gt;',
    );
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('handles quotes for attribute contexts', () => {
    expect(escapeHtml(`"'`)).toBe('&quot;&#39;');
  });
});
