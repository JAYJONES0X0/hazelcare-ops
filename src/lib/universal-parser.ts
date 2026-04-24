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

// ─── THE HARDENED INTELLIGENT PARSER ────────────────────────────────────────

export function parseUniversalCSV(text: string): CareEntry[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const rows: string[][] = lines.map(line => {
    const result: string[] = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
      else cur += char;
    }
    result.push(cur.trim());
    return result;
  });

  // 1. Identify Headers (High-Precision)
  const headerRow = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const findIdx = (keywords: string[]) => headerRow.findIndex(h => keywords.some(k => h === k || (h.includes(k) && h.length < k.length + 5)));

  let iDate = findIdx(['date', 'occurred', 'time', 'entryat', 'recorded']);
  let iCarer = findIdx(['carer', 'staff', 'worker', 'author', 'user']);
  let iClient = findIdx(['client', 'serviceuser', 'resident', 'person']); // REMOVED 'subject'
  const iType = findIdx(['type', 'category', 'event']); // REMOVED 'subject'
  let iEntry = findIdx(['entry', 'note', 'text', 'detail', 'comment', 'report', 'subject']); // ADDED 'subject'
  const iHouse = findIdx(['house', 'location', 'site', 'unit', 'property']);

  // 2. Multi-Point Heuristic Fallback (If headers are missing or malformed)
  if (iEntry === -1 || iClient === -1) {
    const sample = rows[1] || rows[0];
    
    // Find the clinical note (usually the longest block)
    if (iEntry === -1) iEntry = sample.findIndex(c => c.length > 50);
    
    // Find the date
    if (iDate === -1) iDate = sample.findIndex(c => /\d{2}\/\d{2}/.test(c));
    
    // Find the client (usually Proper Case, 2-3 words, short length)
    if (iClient === -1) {
      iClient = sample.findIndex((c, idx) => 
        idx !== iEntry && idx !== iDate && c.length > 3 && c.length < 40 && /^[A-Z]/.test(c)
      );
    }

    // Find the carer (same signature as client, but usually different column)
    if (iCarer === -1) {
      iCarer = sample.findIndex((c, idx) => 
        idx !== iEntry && idx !== iDate && idx !== iClient && c.length > 3 && c.length < 40 && /^[A-Z]/.test(c)
      );
    }
  }

  // 3. Transformation
  const entries: CareEntry[] = [];
  const startAt = (iDate !== -1 && rows[0][iDate]?.toLowerCase()?.includes('date')) ? 1 : 0;

  for (let i = startAt; i < rows.length; i++) {
    const r = rows[i];
    const rawEntry = r[iEntry] || '';
    if (rawEntry.length < 5) continue;

    const date = r[iDate] || new Date().toLocaleDateString('en-GB');
    const carer = r[iCarer] || 'Personnel Unassigned';
    const client = r[iClient] || 'Service User Unassigned';
    const type = r[iType] || 'Standard Entry';
    const house = normalizeHouse(r[iHouse] || ''); // Removed client-to-house fallback

    const { severity, flags } = detectFlags(rawEntry + ' ' + type);
    
    entries.push({
      id: uid(),
      date,
      house: house || 'UNASSIGNED',
      carer,
      client,
      type,
      entry: rawEntry,
      severity,
      flags,
      category: categorizeEntry(type, rawEntry)
    });
  }

  // Descending Temporal Sort
  return entries
    .sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date))
    .slice(0, 50000);
}

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
    allFlags: { red: [], amber: [], green: [] }
  };

  entries.forEach(e => {
    const h = e.house || 'UNASSIGNED';
    if (!summary.houses[h]) {
      summary.houses[h] = { 
        name: h, entries: [], flags: { red: 0, amber: 0, green: 0 }, 
        medication: [], incidents: [], safeguarding: [], 
        handovers: [], dailySupport: [], coordinator: 'Unassigned', 
        staffPerformance: [], healthSafety: [] 
      };
    }
    const house = summary.houses[h];
    house.entries.push(e);
    if (e.severity === 'red') { house.flags.red++; summary.allFlags.red.push(e); }
    if (e.severity === 'amber') { house.flags.amber++; summary.allFlags.amber.push(e); }
    
    if (e.category === 'medication') house.medication.push(e);
    if (e.category === 'incident') house.incidents.push(e);
    if (e.category === 'safeguarding') house.safeguarding.push(e);
    if (e.category === 'handover') house.handovers.push(e);
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
 * Carer,Day,Time,Client,Notes
 */
export function parseRosterCSV(text: string, fileName: string): Shift[] {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Inline CSV row parser
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
      else cur += char;
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

    const rawCarer = row[0]?.trim() || '';
    const rawDay = row[1]?.trim() || '';
    const rawTime = row[2]?.trim() || '';
    const rawClient = row[3]?.trim() || '';

    if (rawCarer) currentCarer = rawCarer.split(' - ')[0].trim();
    if (rawDay) currentDay = rawDay.trim();

    if (!rawTime || !rawClient) continue;
    if (rawClient.toLowerCase().includes('time off')) continue;

    const dateMatch = currentDay.match(/(\d{1,2})\s+([A-Za-z]{3})/);
    let date = '';
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const monthMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      const month = monthMap[dateMatch[2].toLowerCase()] || '01';
      date = `${day}/${month}/${impliedYear}`;
    }

    const timesMatch = rawTime.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
    const startTime = timesMatch?.[1] || '';
    const endTime = timesMatch?.[2] || '';

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
      status: 'confirmed'
    });
  }

  return shifts;
}
