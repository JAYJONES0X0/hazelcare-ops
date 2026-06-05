import { normalizeUserRole, type UserRole } from './rbac';

const LOCAL_PREVIEW_AUTH_KEY = 'hc-local-preview-auth';
const LOCAL_PREVIEW_ROLE_KEY = 'hc-local-preview-role';

export function isLocalPreviewHost(hostname = window.location.hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function isJsonResponse(res: Response) {
  return (res.headers.get('content-type') || '').toLowerCase().includes('application/json');
}

export function isMissingLocalApiResponse(res: Response) {
  if (!isLocalPreviewHost()) return false;
  if (res.status === 404 || res.status === 405) return true;
  return res.ok && !isJsonResponse(res);
}

export function enableLocalPreviewAuth(role: UserRole = 'admin') {
  localStorage.setItem(LOCAL_PREVIEW_AUTH_KEY, 'true');
  localStorage.setItem(LOCAL_PREVIEW_ROLE_KEY, role);
  localStorage.setItem('hc-user-role', role);
}

export function clearLocalPreviewAuth() {
  localStorage.removeItem(LOCAL_PREVIEW_AUTH_KEY);
  localStorage.removeItem(LOCAL_PREVIEW_ROLE_KEY);
}

export function getLocalPreviewRole(): UserRole {
  return normalizeUserRole(localStorage.getItem(LOCAL_PREVIEW_ROLE_KEY) || 'admin');
}

export function hasLocalPreviewAuth() {
  return isLocalPreviewHost() && localStorage.getItem(LOCAL_PREVIEW_AUTH_KEY) === 'true';
}
