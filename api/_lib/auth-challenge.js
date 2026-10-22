import crypto from 'node:crypto';
import { parseCookies } from './parse-cookies.js';
import { secureCookieSuffix } from './hc-session.js';

export const AUTH_CHALLENGE_COOKIE = 'hc_auth_challenge';
const TTL_SECONDS = 300;

function signature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(`careops:auth-challenge:v1:${payload}`).digest('base64url');
}

export function issueAuthChallenge(res, secret, claims) {
  if (!secret) throw new Error('Session is not configured');
  const challenge = { v: 1, purpose: 'auth-challenge', email: claims.email, role: claims.role, jti: crypto.randomUUID(), exp: Date.now() + TTL_SECONDS * 1000 };
  const payload = Buffer.from(JSON.stringify(challenge)).toString('base64url');
  res.setHeader('Set-Cookie', `${AUTH_CHALLENGE_COOKIE}=${payload}.${signature(payload, secret)}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=${TTL_SECONDS}${secureCookieSuffix()}`);
  return challenge;
}

export function readAuthChallenge(req, secret) {
  if (!secret) return null;
  const value = parseCookies(req)[AUTH_CHALLENGE_COOKIE];
  const [payload, sig, extra] = String(value || '').split('.');
  if (!payload || !sig || extra) return null;
  const expected = signature(payload, secret);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.v !== 1 || claims.purpose !== 'auth-challenge' || typeof claims.exp !== 'number' || claims.exp <= Date.now() || typeof claims.email !== 'string' || typeof claims.role !== 'string' || typeof claims.jti !== 'string') return null;
    return claims;
  } catch { return null; }
}

export function clearAuthChallengeCookie() {
  return `${AUTH_CHALLENGE_COOKIE}=; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=0${secureCookieSuffix()}`;
}
