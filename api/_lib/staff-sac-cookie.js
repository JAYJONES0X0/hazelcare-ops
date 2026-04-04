import crypto from 'crypto';

export const STAFF_SAC_COOKIE = 'hc_staff_sac';

/** @param {string} toolId @param {string} secret */
export function signStaffSacCookie(toolId, secret) {
  const exp = Date.now() + 30 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ v: 1, toolId, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return { value: `${payload}.${sig}`, maxAgeSec: 30 * 60 };
}

/**
 * @param {string | undefined} rawCookieVal
 * @param {string} expectedToolId
 * @param {string} secret
 * @returns {boolean}
 */
export function verifyStaffSacCookie(rawCookieVal, expectedToolId, secret) {
  if (!rawCookieVal || !secret || !expectedToolId) return false;
  const [payload, sig] = String(rawCookieVal).split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (expectedSig.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig))) {
    return false;
  }
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (obj.v !== 1 || obj.toolId !== expectedToolId) return false;
    if (typeof obj.exp !== 'number' || Date.now() > obj.exp) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string | undefined} rawCookieVal
 * @param {string} secret
 * @returns {boolean}
 */
export function verifyAnyStaffSacCookie(rawCookieVal, secret) {
  if (!rawCookieVal || !secret) return false;
  const [payload, sig] = String(rawCookieVal).split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (expectedSig.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig))) {
    return false;
  }
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (obj.v !== 1 || !obj.toolId) return false;
    if (typeof obj.exp !== 'number' || Date.now() > obj.exp) return false;
    return true;
  } catch {
    return false;
  }
}
