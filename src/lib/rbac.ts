import type { Page } from './types';

export type UserRole = 'admin' | 'manager' | 'senior' | 'viewer';

const PAGE_ACCESS: Record<Page, UserRole[]> = {
  briefing: ['admin', 'manager', 'senior', 'viewer'],
  dashboard: ['admin', 'manager', 'senior', 'viewer'],
  communications: ['admin', 'manager', 'senior'],
  upload: ['admin', 'manager', 'senior'],
  templates: ['admin', 'manager', 'senior'],
  actions: ['admin', 'manager', 'senior'],
  incidents: ['admin', 'manager', 'senior'],
  staff: ['admin', 'manager'],
  'staff-tools': ['admin', 'manager', 'senior'],
  notes: ['admin', 'manager', 'senior'],
  'note-workspace': ['admin', 'manager', 'senior'],
  'training-hub': ['admin', 'manager', 'senior'],
  handover: ['admin', 'manager', 'senior'],
  compliance: ['admin', 'manager'],
  reports: ['admin', 'manager', 'senior'],
  risk: ['admin', 'manager', 'senior'],
  'client-docs': ['admin', 'manager', 'senior'],
  'client-diary': ['admin', 'manager', 'senior', 'viewer'],
  agency: ['admin', 'manager'],
  'staff-monitoring': ['admin', 'manager', 'senior'],
  settings: ['admin', 'manager'],
  admin: ['admin'],
  'empire-matrix': ['admin', 'manager'],
  'nourish-tasks': ['admin', 'manager', 'senior'],
};

export function normalizeUserRole(value: unknown): UserRole {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin' || role === 'manager' || role === 'senior' || role === 'viewer') {
    return role;
  }
  return 'manager';
}

export function canAccessPage(role: UserRole, page: Page): boolean {
  return PAGE_ACCESS[page]?.includes(role) ?? false;
}
