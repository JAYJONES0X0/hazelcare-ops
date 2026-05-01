/**
 * HAZELCARE OPS — GLOBAL CONFIGURATION
 * This file controls the branding and identity of the entire engine.
 */

export const ORG_CONFIG = {
  name: 'Hazel Care',
  fullName: 'Hazel Care Ltd',
  shortName: 'HC',
  domain: 'hazelcare.co.uk',
  supportEmail: 'support@hazelcare.co.uk',
  tagline: 'Precision Care Operations',
  
  // Storage keys — keep these stable to avoid data loss during branding changes
  storagePrefix: 'hazelcare',
  
  // Visuals
  logoIcon: '/logo-icon-dark.png',
  logoFull: '/hazelcare-logo.png',
  
  // Compliance
  cqcReady: true,
  dataProtectionAct: 'Data Protection Act 2018',
  gdpr: 'UK GDPR',
};

/** Utility to get a branded storage key */
export function getStorageKey(key: string): string {
  return `${ORG_CONFIG.storagePrefix}-${key}`;
}

export interface OrgSettingsOverride {
  name?: string;
  fullName?: string;
  cqcNumber?: string;
  address?: string;
  phone?: string;
  supportEmail?: string;
  tagline?: string;
}

const ORG_SETTINGS_KEY = 'hc-org-settings';

export function loadOrgSettings(): typeof ORG_CONFIG & OrgSettingsOverride {
  try {
    const raw = localStorage.getItem(ORG_SETTINGS_KEY);
    if (raw) return { ...ORG_CONFIG, ...(JSON.parse(raw) as OrgSettingsOverride) };
  } catch { /* ignore */ }
  return ORG_CONFIG;
}

export function saveOrgSettings(settings: OrgSettingsOverride): void {
  try { localStorage.setItem(ORG_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export function loadRawOrgSettings(): OrgSettingsOverride {
  try {
    const raw = localStorage.getItem(ORG_SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as OrgSettingsOverride) : {};
  } catch { return {}; }
}
