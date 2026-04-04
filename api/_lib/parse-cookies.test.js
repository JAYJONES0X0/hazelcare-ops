import { describe, it, expect } from 'vitest';
import { parseCookies } from './parse-cookies.js';

describe('parseCookies', () => {
  it('parses multiple cookies', () => {
    const req = { headers: { cookie: 'a=1; b=two%20three; c=' } };
    expect(parseCookies(req)).toEqual({ a: '1', b: 'two three', c: '' });
  });

  it('handles empty header', () => {
    const req = { headers: {} };
    expect(parseCookies(req)).toEqual({});
  });
});
