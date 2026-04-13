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
