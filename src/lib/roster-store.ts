/**
 * roster-store.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Roster Intelligence Layer
 *
 * Parses the Nourish ClientRoster CSV (Client | Day | Time | Carer format),
 * stores it in IndexedDB, and provides a resolver that answers:
 *   "Who was on shift for [client] on [date] at [time]?"
 *
 * This fixes the "Region Entry" / "UNASSIGNED" carer problem — when a diary
 * entry says "All carers in region: Glenfrome House" with no individual name,
 * the resolver cross-references the roster to find the actual person on shift.
 *
 * UPLOAD ORDER (recommended):
 *   1. ClientRoster CSV — uploaded first thing, covers today or the week
 *   2. Client-diary CSV — the monthly baseline
 *   3. Client-diary incremental CSVs — uploaded every few hours as ops run
 *
 * The roster persists in IndexedDB so it survives refreshes. New roster
 * uploads merge with existing data (newer shifts overwrite matching slots).
 */

import { normalizeHouse } from './universal-parser';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RosterShift {
  id: string;
  client: string;           // Normalised client name e.g. "Jamie Morton"
  clientRaw: string;        // As it appeared in the CSV
  house: string;            // Resolved house name
  date: string;             // DD/MM/YYYY
  startTime: string;        // HH:MM (24h)
  endTime: string;          // HH:MM (24h)
  carers: string[];         // One or more carer names for this slot
  durationHours: number;
  shiftType: 'day' | 'night' | 'long';
}

export interface RosterSummary {
  totalShifts: number;
  totalClients: number;
  totalCarers: number;
  dateFrom: string;
  dateTo: string;
  uploadedAt: string;
  clients: string[];
  carers: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// NATIVE INDEXEDDB STORE (matches entry-store.ts pattern)
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'hazelcare-roster';
const DB_VERSION = 1;
const STORE = 'shifts';

let _db: IDBDatabase | null = null;

function openRosterDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER — handles the Nourish ClientRoster CSV format
// Client | Day | Time | Carer
// ─────────────────────────────────────────────────────────────────────────────

function parseRosterDate(dayStr: string, impliedYear: number): string {
  // "Wed 6 May" → "06/05/2026"
  const match = dayStr.match(/(\d{1,2})\s+([A-Za-z]+)/);
  if (!match) return '';
  const day = match[1].padStart(2, '0');
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const month = monthMap[match[2].toLowerCase().slice(0, 3)] || '01';
  return `${day}/${month}/${impliedYear}`;
}

function parseTimeRange(timeStr: string): { start: string; end: string; hours: number } {
  // "8:00 am - 11:59 am (3 hours and 59 minutes)"
  // "8:00 pm - 7:00 am (11 hours)"
  const timeMatch = timeStr.match(/(\d{1,2}:\d{2})\s*(am|pm)\s*-\s*(\d{1,2}:\d{2})\s*(am|pm)/i);
  if (!timeMatch) return { start: '', end: '', hours: 0 };

  function to24h(t: string, ampm: string): string {
    const [hh, mm] = t.split(':').map(Number);
    let h = hh;
    if (ampm.toLowerCase() === 'pm' && h !== 12) h += 12;
    if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  }

  const start = to24h(timeMatch[1], timeMatch[2]);
  const end   = to24h(timeMatch[3], timeMatch[4]);

  const hoursMatch = timeStr.match(/\((\d+)\s+hours?(?:\s+and\s+(\d+)\s+min)?/i);
  const hours = hoursMatch
    ? parseInt(hoursMatch[1], 10) + (parseInt(hoursMatch[2] || '0', 10) / 60)
    : 0;

  return { start, end, hours };
}

function normalizeClientName(raw: string): string {
  // "Mr Aaron Preece (1:1) - 22 hours and 57 minutes" → "Aaron Preece"
  return raw
    .replace(/^(Mr|Mrs|Miss|Ms|Dr|Prof)\.?\s+/i, '')
    .replace(/\s*\([^)]+\)\s*/g, '')   // remove (1:1), (Core) etc.
    .replace(/\s*-\s*\d+\s+hours?.*/i, '') // remove "- 22 hours and 57 minutes"
    .replace(/\s+/g, ' ')
    .trim();
}

function shiftType(start: string, hours: number): 'day' | 'night' | 'long' {
  if (hours >= 10) return 'long';
  const h = parseInt((start || '08').split(':')[0], 10);
  if (h >= 20 || h < 6) return 'night';
  return 'day';
}

export function parseClientRosterCSV(text: string): RosterShift[] {
  const clean = text.replace(/^\uFEFF/, '');
  const rows = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (rows.length < 2) return [];

  // Detect implied year from filename hint embedded in text, or use current year
  const yearMatch = text.match(/(\d{4})/);
  const impliedYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  const shifts: RosterShift[] = [];

  // The CSV has headers: Client | Day | Time | Carer
  // Rows are grouped: the Client field is only filled on the first row of each client block
  // Subsequent rows for the same client have Client blank, Day blank, Time & Carer filled

  let currentClient = '';
  let currentClientRaw = '';
  let currentDate = '';

  // Parse CSV respecting quotes
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const parsedRows = rows.map(parseRow);
  const headers = parsedRows[0].map(h => h.toLowerCase().trim());

  // Find columns
  const isCarerFirst = iCarer < iClient;

  let currentCarerList: string[] = [];

  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.some(c => /grand total|generated on/i.test(c))) continue;

    const rawClient = iClient >= 0 ? row[iClient]?.trim() || '' : '';
    const rawDay    = iDay >= 0    ? row[iDay]?.trim()    || '' : '';
    const rawTime   = iTime >= 0   ? row[iTime]?.trim()   || '' : '';
    const rawCarer  = iCarer >= 0  ? row[iCarer]?.trim()  || '' : '';

    if (isCarerFirst) {
      if (rawCarer) currentCarerList = rawCarer.split(',').map(c => c.trim()).filter(Boolean);
      if (rawDay) currentDate = parseRosterDate(rawDay, impliedYear);
      if (rawClient) {
        currentClientRaw = rawClient;
        currentClient = normalizeClientName(rawClient);
      }
    } else {
      if (rawClient) {
        currentClientRaw = rawClient;
        currentClient = normalizeClientName(rawClient);
      }
      if (rawDay) currentDate = parseRosterDate(rawDay, impliedYear);
      if (rawCarer) currentCarerList = rawCarer.split(',').map(c => c.trim()).filter(Boolean);
    }

    if (!rawTime || !currentCarerList.length || !currentClient || !currentDate) continue;
    if (currentCarerList.some(c => /time off|annual leave|sick/i.test(c))) continue;

    const { start, end, hours } = parseTimeRange(rawTime);
    if (!start) continue;

    const carerList = currentCarerList;

    // Determine house from client raw name if it's a core/house entry
    const isCore = /\(core\)/i.test(currentClientRaw);
    const house = isCore
      ? normalizeHouse(currentClientRaw)
      : ''; // for 1:1 clients, house resolved at query time via diary

    shifts.push({
      id: `${currentClient}|${currentDate}|${start}`,
      client: currentClient,
      clientRaw: currentClientRaw,
      house,
      date: currentDate,
      startTime: start,
      endTime: end,
      carers: carerList,
      durationHours: Number(hours.toFixed(2)),
      shiftType: shiftType(start, hours),
    });
  }

  return shifts;
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEXEDDB OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function saveRosterShifts(shifts: RosterShift[]): Promise<void> {
  const db = await openRosterDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const shift of shifts) store.put(shift);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllRosterShifts(): Promise<RosterShift[]> {
  try {
    const db = await openRosterDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as RosterShift[]);
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

export async function clearRosterShifts(): Promise<void> {
  const db = await openRosterDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRosterSummary(): Promise<RosterSummary | null> {
  const shifts = await getAllRosterShifts();
  if (shifts.length === 0) return null;

  const allDates = shifts.map(s => s.date).filter(Boolean).sort();
  const allClients = [...new Set(shifts.map(s => s.client))].sort();
  const allCarers = [...new Set(shifts.flatMap(s => s.carers))].sort();

  return {
    totalShifts: shifts.length,
    totalClients: allClients.length,
    totalCarers: allCarers.length,
    dateFrom: allDates[0] || '',
    dateTo: allDates[allDates.length - 1] || '',
    uploadedAt: new Date().toISOString(),
    clients: allClients,
    carers: allCarers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVER — the core intelligence function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves who was on shift for a given client on a given date.
 * Optionally pass a time string (HH:MM 24h) to narrow to the specific slot.
 *
 * Returns:
 *   { carers: string[], confidence: 'exact' | 'date_only' | 'none' }
 *
 * Used to replace "Region Entry" with real names.
 */
export async function resolveCarerFromRoster(
  client: string,
  date: string,
  time?: string
): Promise<{ carers: string[]; confidence: 'exact' | 'date_only' | 'none' }> {
  const shifts = await getAllRosterShifts();
  if (shifts.length === 0) return { carers: [], confidence: 'none' };

  // Normalize the client name to match roster format
  const clientNorm = normalizeClientName(client).toLowerCase();

  // Find all shifts for this client on this date
  const dateShifts = shifts.filter(s =>
    s.date === date &&
    (
      s.client.toLowerCase() === clientNorm ||
      s.client.toLowerCase().includes(clientNorm) ||
      clientNorm.includes(s.client.toLowerCase())
    )
  );

  if (dateShifts.length === 0) return { carers: [], confidence: 'none' };

  // If no time provided, return all carers for that day
  if (!time) {
    const allCarers = [...new Set(dateShifts.flatMap(s => s.carers))];
    return { carers: allCarers, confidence: 'date_only' };
  }

  // Parse the time to minutes since midnight for comparison
  const timeToMins = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const entryMins = timeToMins(time);

  // Find exact time match — shift that covers this time
  const exactShifts = dateShifts.filter(s => {
    if (!s.startTime || !s.endTime) return false;
    const start = timeToMins(s.startTime);
    let end = timeToMins(s.endTime);
    // Handle overnight shifts (end < start means crosses midnight)
    if (end < start) end += 24 * 60;
    return entryMins >= start && entryMins <= end;
  });

  if (exactShifts.length > 0) {
    const carers = [...new Set(exactShifts.flatMap(s => s.carers))];
    return { carers, confidence: 'exact' };
  }

  // Fallback: nearest shift start
  const allCarers = [...new Set(dateShifts.flatMap(s => s.carers))];
  return { carers: allCarers, confidence: 'date_only' };
}

/**
 * Bulk-resolves carers for an array of diary entries.
 * Replaces "Region Entry" and "Personnel Unassigned" with real names.
 * Returns a new array — does not mutate the originals.
 */
export async function enrichEntriesWithRoster(
  entries: import('./types').CareEntry[]
): Promise<import('./types').CareEntry[]> {
  const shifts = await getAllRosterShifts();
  if (shifts.length === 0) return entries;

  // Build a quick lookup map: "clientNorm|date" → shifts[]
  const lookup = new Map<string, RosterShift[]>();
  for (const shift of shifts) {
    const key = `${shift.client.toLowerCase()}|${shift.date}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push(shift);
  }

  return entries.map(entry => {
    const isUnresolved =
      !entry.carer ||
      entry.carer === 'Region Entry' ||
      entry.carer === 'Personnel Unassigned' ||
      entry.carer === 'Unknown';

    if (!isUnresolved) return entry;

    const clientNorm = normalizeClientName(entry.client || '').toLowerCase();
    const date = entry.date || '';

    // Try exact client+date lookup
    let matched: RosterShift[] = lookup.get(`${clientNorm}|${date}`) || [];

    // If no exact match, try partial client name match
    if (matched.length === 0) {
      for (const [key, shiftList] of lookup.entries()) {
        const [keyClient, keyDate] = key.split('|');
        if (keyDate !== date) continue;
        if (keyClient.includes(clientNorm) || clientNorm.includes(keyClient)) {
          matched = shiftList;
          break;
        }
      }
    }

    if (matched.length === 0) return entry;

    // Get all unique carers for this client+date
    const resolvedCarers = [...new Set(matched.flatMap(s => s.carers))];
    if (resolvedCarers.length === 0) return entry;

    // If one carer: use their name directly
    // If multiple: join as "Name1 / Name2" — still better than "Region Entry"
    const resolvedCarer = resolvedCarers.length === 1
      ? resolvedCarers[0]
      : resolvedCarers.join(' / ');

    return {
      ...entry,
      carer: resolvedCarer,
      // Also fix house if it's UNASSIGNED and we have a shift with a house
      house: (entry.house && entry.house !== 'UNASSIGNED')
        ? entry.house
        : matched.find(s => s.house)?.house || entry.house,
    };
  });
}
