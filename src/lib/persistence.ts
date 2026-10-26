/** A failed write must never delete the last successfully saved record. */
export function persistSafely(storage: Pick<Storage, 'setItem'>, key: string, value: string) {
  try { storage.setItem(key, value); }
  catch {
    const message = 'Save failed: browser storage is unavailable or full. Your previous saved data is preserved. Export a backup before freeing space, then retry this change.';
    if (typeof window !== 'undefined') window.alert(message);
    throw new Error(message);
  }
}
