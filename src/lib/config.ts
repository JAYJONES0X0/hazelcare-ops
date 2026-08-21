/**
 * OVSITE — GLOBAL CONFIGURATION
 * This file controls the branding and identity of the entire engine.
 */

export const ORG_CONFIG = {
  name: 'OVSITE',
  fullName: 'OVSITE',
  shortName: 'OV',
  domain: 'ovsite.co.uk',
  supportEmail: 'support@ovsite.co.uk',
  tagline: 'Operational oversight for UK care providers',

  // Demo provider shown in showcase data (fictional — not a real provider)
  demoProvider: 'Meadowview Care',

  // Canonical runtime storage namespace.
  storagePrefix: 'ovsite',

  // Visuals
  logoIcon: '/ovsite-mark.png',
  logoFull: '/ovsite-mark.png',

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

const ORG_SETTINGS_KEY = 'ovsite-org-settings-v1';
const LEGACY_ORG_SETTINGS_KEY = 'hc-org-settings';

function readOrgSettingsRaw(): string | null {
  try {
    const current = localStorage.getItem(ORG_SETTINGS_KEY);
    if (current) return current;

    // One-way compatibility copy. Historical key is retained during the
    // migration window so rollback does not destroy an operator's settings.
    const legacy = localStorage.getItem(LEGACY_ORG_SETTINGS_KEY);
    if (legacy) {
      localStorage.setItem(ORG_SETTINGS_KEY, legacy);
      return legacy;
    }
  } catch { /* ignore */ }
  return null;
}

export function loadOrgSettings(): typeof ORG_CONFIG & OrgSettingsOverride {
  try {
    const raw = readOrgSettingsRaw();
    if (raw) return { ...ORG_CONFIG, ...(JSON.parse(raw) as OrgSettingsOverride) };
  } catch { /* ignore */ }
  return ORG_CONFIG;
}

export function saveOrgSettings(settings: OrgSettingsOverride): void {
  try { localStorage.setItem(ORG_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export function loadRawOrgSettings(): OrgSettingsOverride {
  try {
    const raw = readOrgSettingsRaw();
    return raw ? (JSON.parse(raw) as OrgSettingsOverride) : {};
  } catch { return {}; }
}
