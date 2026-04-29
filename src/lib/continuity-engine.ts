import type { CareEntry } from './types';
import { parseDateMs } from './entry-store';

export interface ClinicalGap {
  id: string;
  client: string;
  house: string;
  date: string;
  timestamp: number;
  likelyCarers: string[];
  severity: 'red' | 'amber';
}

/**
 * Sweeps a dataset to find missing days in clinical evidence per client.
 * Uses cross-client data in the same house to infer who was on shift.
 */
export function detectClinicalGaps(entries: CareEntry[]): ClinicalGap[] {
  if (entries.length === 0) return [];

  // 1. Group by Client and House
  const clientMap = new Map<string, { house: string; entries: CareEntry[]; dates: Set<number> }>();
  // 2. House Attendance Map: House -> DateMs -> Set of CarerNames
  const attendanceMap = new Map<string, Map<number, Set<string>>>();

  let minMs = Infinity;
  let maxMs = -Infinity;

  for (const e of entries) {
    if (!e.client || !e.date) continue;
    
    const ms = parseDateMs(e.date);
    if (!ms) continue;

    minMs = Math.min(minMs, ms);
    maxMs = Math.max(maxMs, ms);

    // Client tracking
    if (!clientMap.has(e.client)) {
      clientMap.set(e.client, { house: e.house || 'UNASSIGNED', entries: [], dates: new Set() });
    }
    const cData = clientMap.get(e.client)!;
    cData.entries.push(e);
    cData.dates.add(ms);

    // House attendance tracking
    const hKey = e.house || 'UNASSIGNED';
    if (!attendanceMap.has(hKey)) attendanceMap.set(hKey, new Map());
    const hDates = attendanceMap.get(hKey)!;
    if (!hDates.has(ms)) hDates.set(ms, new Set());
    if (e.carer && e.carer !== 'Unassigned') {
      hDates.get(ms)!.add(e.carer);
    }
  }

  const gaps: ClinicalGap[] = [];
  const oneDay = 86400000;

  // 3. Find gaps per client
  for (const [client, data] of clientMap) {
    // Only check from the first time they appear in the data to the last
    const cDates = Array.from(data.dates).sort((a, b) => a - b);
    const start = cDates[0];
    const end = maxMs; // Sweep until the latest date in the entire store

    for (let day = start; day <= end; day += oneDay) {
      if (!data.dates.has(day)) {
        // GAP FOUND
        const dateStr = new Date(day).toLocaleDateString('en-GB');
        const hKey = data.house;
        const likelyCarers = Array.from(attendanceMap.get(hKey)?.get(day) || []);

        gaps.push({
          id: `gap-${client}-${day}`,
          client,
          house: hKey,
          date: dateStr,
          timestamp: day,
          likelyCarers,
          severity: likelyCarers.length > 0 ? 'amber' : 'red' // Red is a "Deep Silence" (nobody in the house)
        });
      }
    }
  }

  // Sort gaps: Newest first, then deep silence (red) first
  return gaps.sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    if (a.severity === 'red' && b.severity !== 'red') return -1;
    if (b.severity === 'red' && a.severity !== 'red') return 1;
    return 0;
  });
}

// ============================================================
// ROSTER RECONCILIATION — cross-references a CSV roster against
// the IndexedDB care entries to find clients who SHOULD have had
// entries but didn't (Deep Silence) and identifies the rostered
// carers who failed to log them.
// ============================================================

export interface RosterShift {
  client: string;       // cleaned client name (no trailing hours summary)
  date: string;         // ISO YYYY-MM-DD
  carer: string;        // cleaned carer name
  timeWindow: string;   // raw "8:00 am - 11:59 am (3 hours)" text
}

export interface RosterGap {
  client: string;
  house: string;          // resolved from existing entries or 'UNASSIGNED'
  date: string;           // ISO YYYY-MM-DD
  status: 'DEEP_SILENCE' | 'PARTIAL' | 'PRESENT';
  likelyCarers: string[]; // carers rostered on that client+date who didn't log
  expectedShifts: number; // how many shifts the roster expected
  loggedEntries: number;  // how many CareEntry rows actually exist for that client+date
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function cleanClientName(raw: string): string {
  // "Mr Aaron Preece - 1331 hours and 6 minutes" -> "Mr Aaron Preece"
  if (!raw) return '';
  const match = raw.match(/^(.+?)\s+-\s+\d+\s+hours?/i);
  return (match ? match[1] : raw).trim();
}

function cleanCarerName(raw: string): string {
  return (raw || '').replace(/\s+/g, ' ').trim();
}

function parseDayCellToIso(dayCell: string, year: number): string | null {
  // "Sun 1 Mar" or "Mon 12 Apr"
  const match = dayCell.match(/(\d{1,2})\s+([A-Za-z]{3,})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = MONTH_INDEX[match[2].slice(0, 3).toLowerCase()];
  if (Number.isNaN(day) || month === undefined) return null;
  const dt = new Date(Date.UTC(year, month, day));
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * RFC 4180 minimal CSV parser — handles quoted fields with embedded commas.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parses a roster CSV in the format:
 *   Client,Day,Time,Carer
 *   "Mr Aaron Preece - 1331 hours and 6 minutes","Sun 1 Mar","8:00 am - 11:59 am (3 hours)","Sayed Ahmed"
 *   ,,"12:00 pm - 2:59 pm (3 hours)","Sayed Ahmed"
 *
 * Empty Client/Day cells inherit from the previous row.
 */
export function parseRosterCsv(csvText: string, year: number): RosterShift[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map(s => s.trim().toLowerCase());
  const idxClient = header.indexOf('client');
  const idxDay = header.indexOf('day');
  const idxTime = header.indexOf('time');
  const idxCarer = header.indexOf('carer');

  if (idxClient < 0 || idxDay < 0 || idxCarer < 0) return [];

  const shifts: RosterShift[] = [];
  let lastClient = '';
  let lastDay = '';

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const cClient = (cols[idxClient] || '').trim();
    const cDay = (cols[idxDay] || '').trim();
    const cTime = idxTime >= 0 ? (cols[idxTime] || '').trim() : '';
    const cCarer = (cols[idxCarer] || '').trim();

    if (cClient) lastClient = cleanClientName(cClient);
    if (cDay) lastDay = cDay;

    if (!lastClient || !lastDay || !cCarer) continue;

    const iso = parseDayCellToIso(lastDay, year);
    if (!iso) continue;

    shifts.push({
      client: lastClient,
      date: iso,
      carer: cleanCarerName(cCarer),
      timeWindow: cTime,
    });
  }
  return shifts;
}

/**
 * Reconciles roster shifts against actual care entries.
 * For each (client, date) the roster says SHOULD have happened, checks
 * whether matching CareEntry records exist. Marks gaps and lists the
 * carers who were rostered but didn't log.
 */
export function reconcileRoster(
  roster: RosterShift[],
  entries: CareEntry[],
  opts?: { dateFrom?: string; dateTo?: string }
): RosterGap[] {
  // Build entry index: client|date -> { houses: Set, count }
  const entryIdx = new Map<string, { houses: Set<string>; count: number }>();
  // Also map each client to whatever houses it's been associated with — for the gap house lookup
  const clientToHouse = new Map<string, string>();

  for (const e of entries) {
    if (!e.client || !e.date) continue;
    const key = e.client.trim().toLowerCase() + '|' + e.date;
    let row = entryIdx.get(key);
    if (!row) { row = { houses: new Set(), count: 0 }; entryIdx.set(key, row); }
    row.count++;
    if (e.house) row.houses.add(e.house);
    if (e.house && !clientToHouse.has(e.client.trim().toLowerCase())) {
      clientToHouse.set(e.client.trim().toLowerCase(), e.house);
    }
  }

  // Group roster by client+date so we know expected shifts and rostered carers per (client,date)
  const rosterIdx = new Map<string, { client: string; date: string; carers: Set<string>; count: number }>();
  for (const r of roster) {
    if (opts?.dateFrom && r.date < opts.dateFrom) continue;
    if (opts?.dateTo && r.date > opts.dateTo) continue;
    const key = r.client.trim().toLowerCase() + '|' + r.date;
    let row = rosterIdx.get(key);
    if (!row) {
      row = { client: r.client, date: r.date, carers: new Set(), count: 0 };
      rosterIdx.set(key, row);
    }
    row.count++;
    row.carers.add(r.carer);
  }

  const gaps: RosterGap[] = [];
  for (const [key, ros] of rosterIdx) {
    const ent = entryIdx.get(key);
    const logged = ent?.count || 0;

    let status: RosterGap['status'];
    if (logged === 0) status = 'DEEP_SILENCE';
    else if (logged < ros.count) status = 'PARTIAL';
    else status = 'PRESENT';

    if (status === 'PRESENT') continue; // not a gap

    const house =
      ent?.houses.size ? Array.from(ent.houses)[0] :
      clientToHouse.get(ros.client.trim().toLowerCase()) ||
      'UNASSIGNED';

    gaps.push({
      client: ros.client,
      house,
      date: ros.date,
      status,
      likelyCarers: Array.from(ros.carers).sort(),
      expectedShifts: ros.count,
      loggedEntries: logged,
    });
  }

  // Newest first, deep-silence first within same date
  return gaps.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    if (a.status === 'DEEP_SILENCE' && b.status !== 'DEEP_SILENCE') return -1;
    if (b.status === 'DEEP_SILENCE' && a.status !== 'DEEP_SILENCE') return 1;
    return a.client.localeCompare(b.client);
  });
}

/**
 * Generates a CSV blob string for export with columns:
 *   CLIENT, HOUSE, DATE, STATUS, LIKELY PERSONNEL ON SHIFT, EXPECTED SHIFTS, LOGGED ENTRIES
 */
export function rosterGapsToCsv(gaps: RosterGap[]): string {
  const esc = (s: string) => {
    const v = String(s ?? '');
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };
  const header = ['CLIENT', 'HOUSE', 'DATE', 'STATUS', 'LIKELY PERSONNEL ON SHIFT', 'EXPECTED SHIFTS', 'LOGGED ENTRIES'];
  const rows = [header.join(',')];
  for (const g of gaps) {
    rows.push([
      esc(g.client),
      esc(g.house),
      esc(g.date),
      esc(g.status),
      esc(g.likelyCarers.join('; ')),
      String(g.expectedShifts),
      String(g.loggedEntries),
    ].join(','));
  }
  return rows.join('\n') + '\n';
}

/**
 * Convenience: parse + reconcile + export in one call.
 */
export function reconcileRosterCsv(
  csvText: string,
  entries: CareEntry[],
  year: number,
  opts?: { dateFrom?: string; dateTo?: string }
): { gaps: RosterGap[]; csv: string; rosterRowCount: number } {
  const roster = parseRosterCsv(csvText, year);
  const gaps = reconcileRoster(roster, entries, opts);
  return { gaps, csv: rosterGapsToCsv(gaps), rosterRowCount: roster.length };
}
