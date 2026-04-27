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
  localStorage.removeItem('hazelcare-ops');
  localStorage.removeItem('hazelcare-staff-notes');
  localStorage.removeItem('hc-registered-sessions');
  
  // Clear the SQL-grade intelligence database
  await clearEntryStoreAsync();
  
  window.location.reload();
}

export function clearClientRegistry() {
  localStorage.removeItem('hc-clients-v2');
}

export function clearStaffNotesRegistry() {
  localStorage.removeItem('hazelcare-staff-notes');
}
