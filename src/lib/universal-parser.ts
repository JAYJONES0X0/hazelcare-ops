import type { CareEntry, WeekSummary, Shift } from './types';
import { uid } from './storage';

// ============================================================
// FLAG KEYWORDS — Hazel Care Intelligent Detection
// ============================================================
const RED_FLAGS = [
  'refused medication', 'medication refused', 'he refused', 'she refused',
  'safeguarding', 'self-neglect', 'self neglect', 'self-harm', 'self harm',
  'police', 'ambulance', 'hospital', 'a&e', 'arrested',
  'assault', 'struck', 'hit', 'attacked', 'threatened',
  'missing', 'absconded', 'left without',
  'fire', 'short circuit', 'electrical fault',
  'death', 'deceased', 'passed away',
  'controlled drug', 'cd discrepancy',
  'injury', 'fall', 'collapsed', 'seizure',
  'cancel night shift', 'called in sick',
];

const AMBER_FLAGS = [
  'hearing voices', 'talked to himself', 'talking to herself',
  'escalated', 'escalation', 'agitated', 'aggressive', 'anxious',
  'property damage', 'damaged', 'broke',
  'complaint', 'complained',
  'concern', 'concerns raised',
  'not sleeping', 'refused food', 'refused to eat',
  'medication discrepancy', 'medication cups', 'medication spill',
  'late', 'lateness', 'did not attend', 'no show',
  'incomplete', 'outstanding', 'overdue',
  'soiling', 'infection control',
  'not around', 'did not answer', 'no response',
];

const HOUSE_MAP: Record<string, string> = {
  'glenfrome': 'Glenfrome House',
  'laurel house': 'Laurel House',
  'hazelbury': 'Hazelbury House',
  'station': 'Station House',
  'church': 'Church House',
  'woburn': 'Woburn House',
  'courtney': 'Courtney Lodge',
  'canterbury': 'Canterbury',
  'lingfield': 'Lingfield House',
  'cottrell': 'Cottrell House',
  'old bakery': 'Flats (Old Bakery)',
  'management': 'Management',
  'unassigned': 'UNASSIGNED',
};

export function normalizeHouse(raw: string): string {
  if (!raw) return '';
  const lower = raw.toLowerCase().trim();
  for (const [key, value] of Object.entries(HOUSE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return raw.trim();
}

/** Scans free text (e.g. a diary entry body) for mentions of known house names */
export function extractHouseFromText(text: string): string {
  if (!text) return '';
  const lower = text.toLowerCase();
  for (const [key, value] of Object.entries(HOUSE_MAP)) {
    if (key === 'unassigned' || key === 'management') continue;
    if (lower.includes(key)) return value;
  }
  return '';
}

type Category = 'incident' | 'safeguarding' | 'medication' | 'handover' | 'daily_support' | 'finance' | 'staff' | 'health_safety' | 'other';

function categorizeEntry(type: string, text: string): Category {
  const t = (type || '').toLowerCase().trim();
  const x = (text || '').toLowerCase();
  if (t.includes('handover') || x.includes('handover')) return 'handover';
  if (t.includes('task') || t.includes('1:1') || t.includes('1to1') || t.includes('daily support') || t.includes('personal care')) return 'daily_support';
  if (t.includes('accident') || t.includes('incident') || t.includes('abc') || x.includes('incident')) return 'incident';
  if (t.includes('safeguard') || x.includes('safeguard')) return 'safeguarding';
  if (t.includes('medication') || x.includes('medication') || x.includes('prescribed')) return 'medication';
  if (t.includes('finance') || t.includes('expense') || t.includes('money')) return 'finance';
  if (t.includes('supervision') || t.includes('probation') || t.includes('interview')) return 'staff';
  return 'other';
}

function detectFlags(text: string): { severity: CareEntry['severity']; flags: string[] } {
  const lower = (text || '').toLowerCase();
  const flags: string[] = [];
  for (const kw of RED_FLAGS) if (lower.includes(kw)) flags.push(kw);
  if (flags.length > 0) return { severity: 'red', flags };
  for (const kw of AMBER_FLAGS) if (lower.includes(kw)) flags.push(kw);
  if (flags.length > 0) return { severity: 'amber', flags };
  return { severity: 'none', flags: [] };
}

function parseDateMs(s: string): number {
  if (!s) return 0;
  const parts = s.split(/[ /:-]/);
  if (parts.length >= 3) {
    if (parts[0].length === 4) return new Date(s).getTime();
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    return new Date(y, m, d).getTime();
  }
  return new Date(s).getTime() || 0;
}

// ─── CSV ROW PARSER (handles quoted multi-line fields) ────────────────────────
function parseCSVRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, ''); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        // escaped quote
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur.trim());
      cur = '';
    } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
      if (ch === '\r') i++; // skip \n of \r\n
      row.push(cur.trim());
      // only keep non-empty rows
      if (row.some(c => c.length > 0)) rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  // flush last row
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some(c => c.length > 0)) rows.push(row);
  }

  return rows;
}

/**
 * Precision column finder.
 * Priority: exact match → starts-with → whole-word substring.
 * This prevents "entry" matching "Entry occurred" (date col) before "Diary entry".
 */
function findCol(headers: string[], ...aliases: string[]): number {
  const normed = headers.map(h => h.toLowerCase().trim());

  // 1. Exact match
  for (const a of aliases) {
    const idx = normed.findIndex(n => n === a.toLowerCase());
    if (idx >= 0) return idx;
  }
  // 2. Starts-with
  for (const a of aliases) {
    const al = a.toLowerCase();
    const idx = normed.findIndex(n => n.startsWith(al));
    if (idx >= 0) return idx;
  }
  // 3. Whole-word substring (alias must be a standalone word, not buried in another word)
  for (const a of aliases) {
    const al = a.toLowerCase();
    const re = new RegExp(`\\b${al.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const idx = normed.findIndex(n => re.test(n));
    if (idx >= 0) return idx;
  }
  return -1;
}

function safeCell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  return (row[idx] || '').trim();
}

// ─── MAIN CSV DIARY PARSER ────────────────────────────────────────────────────
export function parseUniversalCSV(text: string, rows?: string[][]): CareEntry[] {
  const parsedRows = rows ?? parseCSVRows(text);
  if (parsedRows.length < 2) return [];

  const headers = parsedRows[0];

  // STEP 1 — Precision header matching using the real CarePlanner column names
  const iDate   = findCol(headers, 'entry occurred', 'display from', 'occurred', 'date', 'entry_date');
  const iType   = findCol(headers, 'incident type', 'entry type', 'type', 'category');
  const iCarer  = findCol(headers, 'carers involved', 'carer', 'staff', 'worker');
  const iClient = findCol(headers, 'clients involved', 'client', 'service user', 'resident');
  const iEntry  = findCol(headers, 'diary entry', 'entry', 'notes', 'details', 'description', 'note');
  const iHouse  = findCol(headers, 'house', 'location', 'property', 'unit', 'site');

  // STEP 2 — Only run heuristics if we have NO entry column at all
  // (this prevents treating notes-in-cells as client names)
  let gDate = iDate, gType = iType, gCarer = iCarer, gClient = iClient, gEntry = iEntry, gHouse = iHouse;

  if (gEntry < 0) {
    // True headerless file — scan a data row for the longest text block
    const sample = parsedRows[1] || [];
    for (let c = 0; c < sample.length; c++) {
      const val = sample[c].trim();
      if (val.length > 60 && gEntry < 0) gEntry = c;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(val) && gDate < 0) gDate = c;
    }
    // Only guess client/carer if we're in true headerless mode AND have an entry col
    // Use short Proper-Case cells that aren't dates or the entry
    if (gEntry >= 0) {
      for (let c = 0; c < sample.length; c++) {
        if (c === gEntry || c === gDate) continue;
        const val = sample[c].trim();
        const isName = val.length > 2 && val.length < 50 && /^[A-Z]/.test(val) && !/^\d/.test(val);
        if (isName && gClient < 0) { gClient = c; continue; }
        if (isName && gCarer < 0) { gCarer = c; }
      }
    }
  }

  // If we still have no entry column, nothing to parse
  if (gEntry < 0) return [];

  // STEP 3 — Row transformation (skip header row)
  // No cap — parse the entire file (storage handles deduplication)
  const entries: CareEntry[] = [];

  for (let i = 1; i < parsedRows.length; i++) {
    const r = parsedRows[i];
    const rawEntry = safeCell(r, gEntry);
    if (rawEntry.length < 5) continue;

    const dateRaw   = safeCell(r, gDate);
    const typeRaw   = safeCell(r, gType);
    const carerRaw  = safeCell(r, gCarer);
    const clientRaw = safeCell(r, gClient);
    const houseRaw  = safeCell(r, gHouse);

    // Skip rows where "entry" looks like a header label
    if (rawEntry.toLowerCase() === 'diary entry' || rawEntry.toLowerCase() === 'entry' || rawEntry.toLowerCase() === 'notes') continue;
    // Skip rows that are clearly just date values repeated (artifact of multi-line CSV parse)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawEntry)) continue;

    const date   = dateRaw || new Date().toLocaleDateString('en-GB');
    const carer  = carerRaw || 'Personnel Unassigned';
    // Guard: CarePlanner sometimes fills the client column with a house name
    const isHouseName = !!normalizeHouse(clientRaw) && Object.keys(HOUSE_MAP).some(k => clientRaw.toLowerCase().trim() === k || clientRaw.toLowerCase().trim() === normalizeHouse(clientRaw).toLowerCase());
    const client = (!clientRaw || isHouseName) ? 'Service User Unassigned' : clientRaw;
    const type   = typeRaw || 'Standard Entry';
    // If no explicit house column, try to extract from entry text or client name
    const house  = normalizeHouse(houseRaw) || extractHouseFromText(rawEntry) || extractHouseFromText(clientRaw) || 'UNASSIGNED';

    // Validate date is parseable
    const ms = parseDateMs(date);
    if (ms === 0 && dateRaw) continue; // garbage date

    const { severity, flags } = detectFlags(rawEntry + ' ' + type);

    entries.push({
      id: uid(),
      date,
      house,
      carer,
      client,
      type,
      entry: rawEntry,
      severity,
      flags,
      category: categorizeEntry(type, rawEntry),
    });
  }

  // Descending temporal sort
  return entries.sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));
}

// ─── WEEK SUMMARY BUILDER ────────────────────────────────────────────────────
export function buildWeekSummary(entries: CareEntry[]): WeekSummary {
  const summary: WeekSummary = {
    totalEntries: entries.length,
    dateFrom: entries.length ? entries[entries.length - 1].date : '',
    dateTo: entries.length ? entries[0].date : '',
    entryTypes: {},
    clients: Array.from(new Set(entries.map(e => e.client).filter(Boolean))),
    carers: Array.from(new Set(entries.map(e => e.carer).filter(Boolean))),
    clientDiary: {},
    houses: {},
    allFlags: { red: [], amber: [], green: [] },
  };

  entries.forEach(e => {
    const h = e.house || 'UNASSIGNED';
    if (!summary.houses[h]) {
      summary.houses[h] = {
        name: h, entries: [], flags: { red: 0, amber: 0, green: 0 },
        medication: [], incidents: [], safeguarding: [],
        handovers: [], dailySupport: [], coordinator: 'Unassigned',
        staffPerformance: [], healthSafety: [],
      };
    }
    const house = summary.houses[h];
    house.entries.push(e);
    if (e.severity === 'red')   { house.flags.red++;   summary.allFlags.red.push(e); }
    if (e.severity === 'amber') { house.flags.amber++;  summary.allFlags.amber.push(e); }

    if (e.category === 'medication')    house.medication.push(e);
    if (e.category === 'incident')      house.incidents.push(e);
    if (e.category === 'safeguarding')  house.safeguarding.push(e);
    if (e.category === 'handover')      house.handovers.push(e);
    if (e.category === 'daily_support') house.dailySupport.push(e);
    if (e.category === 'health_safety') house.healthSafety.push(e);

    if (e.client) {
      if (!summary.clientDiary[e.client]) summary.clientDiary[e.client] = [];
      summary.clientDiary[e.client].push(e);
    }
  });

  return summary;
}

export function parseUniversalData(rawText: string): CareEntry[] {
  return parseUniversalCSV(rawText);
}

/**
 * Parses a grouped Roster CSV (CarePlanner format)
 * Carer, Day, Time, Client, Notes
 */
export function parseRosterCSV(text: string, fileName: string): Shift[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const rows = lines.map(parseRow);
  const yearMatch = fileName.match(/_(\d{4})/);
  const impliedYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  const shifts: Shift[] = [];
  let currentCarer = '';
  let currentDay = '';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 4) continue;
    if (row.some(c => c.includes('GRAND TOTAL'))) break;

    const rawCarer  = row[0]?.trim() || '';
    const rawDay    = row[1]?.trim() || '';
    const rawTime   = row[2]?.trim() || '';
    const rawClient = row[3]?.trim() || '';

    if (rawCarer) currentCarer = rawCarer.split(' - ')[0].trim();
    if (rawDay)   currentDay   = rawDay.trim();
    if (!rawTime || !rawClient) continue;
    if (rawClient.toLowerCase().includes('time off')) continue;

    const dateMatch = currentDay.match(/(\d{1,2})\s+([A-Za-z]{3})/);
    let date = '';
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const monthMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      };
      const month = monthMap[dateMatch[2].toLowerCase()] || '01';
      date = `${day}/${month}/${impliedYear}`;
    }

    const timesMatch = rawTime.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
    const startTime = timesMatch?.[1] || '';
    const endTime   = timesMatch?.[2] || '';

    const hoursMatch = rawTime.match(/\((\d+)\s+hours?(?:\s+and\s+(\d+)\s+min)?\)/);
    let hours = 0;
    if (hoursMatch) hours = parseInt(hoursMatch[1], 10) + (parseInt(hoursMatch[2] || '0', 10) / 60);

    const startHour = startTime ? parseInt(startTime.split(':')[0], 10) : 8;
    let type: Shift['type'] = 'day';
    if (hours >= 10) type = 'long_day';
    if (startHour >= 18 || startHour < 6) type = 'night';

    shifts.push({
      id: uid(),
      staffId: currentCarer,
      house: normalizeHouse(rawClient) || rawClient,
      date, startTime, endTime, type,
      hours: Number(hours.toFixed(2)),
      status: 'confirmed',
    });
  }

  return shifts;
}
