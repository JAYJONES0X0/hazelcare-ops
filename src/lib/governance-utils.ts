import { recordStorage, flushRecordWrites } from './browser-records';
// ============================================================
// GOVERNANCE UTILS — System Purge & Intelligence Scrubbing
// ============================================================
import { clearEntryStoreAsync } from './entry-store';

/**
 * TOTAL PURGE: Wipes LocalStorage and IndexedDB Intelligence Store.
 * Used for "Hardware Burn" and "Clear Everything" scenarios.
 */
export async function purgeSystemDataAsync() {
  const exactKeys = [
    'careops-handovers',
    'hazelcare-compliance-audits',
    'hazelcare-ops',
    'hazelcare-staff',
    'hazelcare-staff-notes',
    'hc-active-sequences-v1',
    'hc-active-tracking-v1',
    'hc-audit-trail-v1',
    'hc-clients-v2',
    'hc-coaching-events-v1',
    'hc-coverage-plan-v1',
    'hc-entry-store-v3',
    'hc-intercept-cache',
    'hc-module-history-v1',
    'hc-operational-communications-v1',
    'hc-operational-output-drafts-v1',
    'hc-registered-sessions',
    'hc-staff-monitoring-hourly-v1',
    'hc-staff-monitoring-outcomes-v1',
    'hc-staff-monitoring-runs-v1',
    'hc-staff-register-v1',
    'hc-template-import-context',
    'hc-week-data-v2',
  ];

  for (const key of exactKeys) {
    recordStorage(localStorage).removeItem(key);
  }

  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('hazelcare-legal-') || key.startsWith('collapse-state:')) {
      recordStorage(localStorage).removeItem(key);
    }
  }
  
  // Clear the SQL-grade intelligence database
  await clearEntryStoreAsync();
  await flushRecordWrites();

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch { /* ignore service worker cleanup failure */ }
  }

  window.dispatchEvent(new Event('hc-clients-updated'));
  
  // Force a hard reload to clear any remaining in-memory state
  window.location.href = window.location.origin + '?purge=' + Date.now();
}

export function clearClientRegistry() {
  recordStorage(localStorage).removeItem('hc-clients-v2');
}

export function clearStaffNotesRegistry() {
  recordStorage(localStorage).removeItem('hazelcare-staff-notes');
}
