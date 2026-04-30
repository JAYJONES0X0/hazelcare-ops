// ============================================================
// GOVERNANCE UTILS — System Purge & Intelligence Scrubbing
// ============================================================
import { clearEntryStoreAsync } from './entry-store';

/**
 * TOTAL PURGE: Wipes LocalStorage and IndexedDB Intelligence Store.
 * Used for "Hardware Burn" and "Clear Everything" scenarios.
 */
export async function purgeSystemDataAsync() {
  localStorage.removeItem('hc-clients-v2');
  localStorage.removeItem('hc-week-data-v2');
  localStorage.removeItem('hc-entry-store-v3');
  localStorage.removeItem('hazelcare-staff-notes');
  localStorage.removeItem('hc-registered-sessions');
  localStorage.removeItem('hc-coverage-plan-v1');
  localStorage.removeItem('hazelcare-ops'); // Legacy key cleanup
  
  // Clear the SQL-grade intelligence database
  await clearEntryStoreAsync();
  
  // Force a hard reload to clear any remaining in-memory state
  window.location.href = window.location.origin + '?purge=' + Date.now();
}

export function clearClientRegistry() {
  localStorage.removeItem('hc-clients-v2');
}

export function clearStaffNotesRegistry() {
  localStorage.removeItem('hazelcare-staff-notes');
}
