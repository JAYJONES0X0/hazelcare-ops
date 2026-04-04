import { describe, it, expect } from 'vitest';
import { signStaffSacCookie, verifyStaffSacCookie, verifyAnyStaffSacCookie, STAFF_SAC_COOKIE } from './staff-sac-cookie.js';

const SECRET = 'unit-test-staff-link-secret-32chars!';

describe('staff-sac-cookie', () => {
  it('signs and verifies for toolId', () => {
    const { value, maxAgeSec } = signStaffSacCookie('notes', SECRET);
    expect(maxAgeSec).toBe(30 * 60);
    expect(verifyStaffSacCookie(value, 'notes', SECRET)).toBe(true);
    expect(verifyStaffSacCookie(value, 'handover', SECRET)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const { value } = signStaffSacCookie('notes', SECRET);
    expect(verifyStaffSacCookie(value, 'notes', 'other-secret-other-secret-other')).toBe(false);
  });

  it('verifies scoped cookie without tool binding', () => {
    const { value } = signStaffSacCookie('actions', SECRET);
    expect(verifyAnyStaffSacCookie(value, SECRET)).toBe(true);
    expect(verifyAnyStaffSacCookie(value, 'different-secret')).toBe(false);
  });

  it('exports cookie name', () => {
    expect(STAFF_SAC_COOKIE).toBe('hc_staff_sac');
  });
});
