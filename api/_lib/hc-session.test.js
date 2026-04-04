import { describe, it, expect } from 'vitest';
import { mintHcSession, verifyHcSession, HC_SESSION_COOKIE } from './hc-session.js';

const SECRET = 'unit-test-auth-session-secret-32b!!';

describe('hc-session', () => {
  it('mints a verifiable cookie value', () => {
    const { value, maxAgeSec } = mintHcSession(SECRET, 12);
    expect(value).toContain('.');
    expect(maxAgeSec).toBe(12 * 3600);
    expect(verifyHcSession(value, SECRET)).toBe(true);
  });

  it('rejects wrong secret', () => {
    const { value } = mintHcSession(SECRET, 12);
    expect(verifyHcSession(value, 'wrong-secret')).toBe(false);
  });

  it('rejects tampered payload', () => {
    const { value } = mintHcSession(SECRET, 12);
    const [p, s] = value.split('.');
    const tampered = `${p.slice(0, -1)}x.${s}`;
    expect(verifyHcSession(tampered, SECRET)).toBe(false);
  });

  it('rejects empty inputs', () => {
    expect(verifyHcSession('', SECRET)).toBe(false);
    expect(verifyHcSession('a.b', '')).toBe(false);
  });

  it('exports cookie name', () => {
    expect(HC_SESSION_COOKIE).toBe('hc_session');
  });
});
