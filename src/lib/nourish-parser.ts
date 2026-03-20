import type { NourishEntry, HouseSummary, WeekSummary } from './types';
import { uid } from './storage';

// ============================================================
// FLAG KEYWORDS
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

// ============================================================
// HOUSE NAME NORMALIZATION
// ============================================================
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
  'nc hazelcare': 'General',
  'hazelcare houses': 'General',
  'hazelcare medical': 'Medical',
};

function normalizeHouse(raw: string): string {
  const lower = raw.toLowerCase().trim();
  for (const [key, value] of Object.entries(HOUSE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return raw.trim() || 'General';
}

function isKnownHouse(raw: string): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase().trim();
  // Check if this value matches any known house pattern
  for (const key of Object.keys(HOUSE_MAP)) {
    if (lower.includes(key)) return true;
  }
  // Also catch generic patterns like "X House", "X Lodge", standalone "Office"
  if (/\b(house|lodge|flats?|management)\b/i.test(raw)) return true;
  if (/^office$/i.test(raw.trim())) return true;
  return false;
}

// ============================================================
// ENTRY CATEGORY
// ============================================================
type Category = 'incident' | 'safeguarding' | 'medication' | 'handover' | 'daily_support' | 'finance' | 'staff' | 'health_safety' | 'other';

function categorizeEntry(type: string, text: string): Category {
  const t = type.toLowerCase();
  const x = text.toLowerCase();
  if (t.includes('accident') || t.includes('incident')) return 'incident';
  if (t.includes('safeguard')) return 'safeguarding';
  if (t.includes('medication')) return 'medication';
  if (t.includes('handover')) return 'handover';
  if (t.includes('daily 1:1') || t.includes('1to1') || t.includes('daily support')) return 'daily_support';
  if (t.includes('finance') || t.includes('expense') || t.includes('mileage') || t.includes('financial')) return 'finance';
  if (t.includes('repair')) return 'health_safety';
  if (t.includes('supervision') || t.includes('spot check') || t.includes('quality meeting')) return 'staff';
  if (x.includes('safeguard')) return 'safeguarding';
  if (x.includes('medication') || x.includes('prescribed')) return 'medication';
  if (x.includes('incident') || x.includes('police') || x.includes('ambulance')) return 'incident';
  if (t.includes('professional notes')) return 'staff';
  return 'other';
}

// ============================================================
// FLAG DETECTION
// ============================================================
function detectFlags(text: string): { severity: NourishEntry['severity']; flags: string[] } {
  const lower = text.toLowerCase();
  const flags: string[] = [];
  for (const kw of RED_FLAGS) {
    if (lower.includes(kw)) flags.push(kw);
  }
  if (flags.length > 0) return { severity: 'red', flags };
  for (const kw of AMBER_FLAGS) {
    if (lower.includes(kw)) flags.push(kw);
  }
  if (flags.length > 0) return { severity: 'amber', flags };
  return { severity: 'none', flags: [] };
}

// ============================================================
// HELPERS
// ============================================================
function extractHouseFromCarers(carers: string): string {
  const match = carers.match(/region:\s*([^,]+)/i);
  if (match) return match[1].trim();
  return 'General';
}

function cleanCarerName(raw: string): string {
  return raw
    .replace(/All carers in region:[^,]+,?\s*/gi, '')
    .split(',')[0]
    .trim() || 'Staff';
}

// Non-person "clients" to exclude from per-client diary
const NON_CLIENT = new Set(['Maintenance', 'Station', 'On Call', 'On-call', '', 'Management']);

// ============================================================
// ROBUST COLUMN FINDER — tries multiple name variants
// ============================================================
function findCol(headers: string[], ...variants: string[]): number {
  for (const v of variants) {
    const i = headers.findIndex(h => h.includes(v));
    if (i >= 0) return i;
  }
  return -1;
}

function safeCell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  return (row[idx] || '').trim();
}

// ============================================================
// PROPER RFC 4180 CSV PARSER
// ============================================================
function parseCSVRaw(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  const push = () => {
    current.push(field.replace(/\r/g, '').trim());
    field = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      push();
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      push();
      if (current.some(f => f)) rows.push(current);
      current = [];
    } else {
      field += ch;
    }
  }
  push();
  if (current.some(f => f)) rows.push(current);
  return rows;
}

// ============================================================
// DETECT IF TEXT IS LIKELY A CSV
// ============================================================
function looksLikeCSV(text: string): boolean {
  const firstLine = text.trim().split('\n')[0] || '';
  // Has commas and looks like a header row
  return firstLine.includes(',') && (
    firstLine.toLowerCase().includes('diary') ||
    firstLine.toLowerCase().includes('display') ||
    firstLine.toLowerCase().includes('entry') ||
    firstLine.toLowerCase().includes('client') ||
    firstLine.toLowerCase().includes('carer') ||
    firstLine.toLowerCase().includes('incident')
  );
}

// ============================================================
// PARSE NOURISH CSV EXPORT — robust version
// ============================================================
export function parseNourishCSV(text: string): NourishEntry[] {
  const clean = text.replace(/^\uFEFF/, ''); // strip BOM
  const rows = parseCSVRaw(clean);
  if (rows.length < 2) return [];

  // Normalise headers: lowercase, replace non-alpha with underscore
  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));

  // Flexible column detection — try many variants Nourish might use
  const iDate  = findCol(headers, 'entry_occurred', 'display_from', 'occurred', 'date', 'entry_date', 'record_date');
  const iType  = findCol(headers, 'incident_type', 'entry_type', 'type', 'category', 'record_type', 'diary_type');
  const iCarers = findCol(headers, 'carers_involved', 'carer', 'carers', 'staff_involved', 'staff', 'worker');
  const iClient = findCol(headers, 'clients_involved', 'client', 'clients', 'service_user', 'resident', 'person');
  const iEntry  = findCol(headers, 'diary_entry', 'entry', 'notes', 'details', 'description', 'note', 'text', 'content', 'body');
  const iHouse  = findCol(headers, 'house', 'location', 'property', 'address', 'home');

  // We absolutely need at least an entry/notes column
  if (iEntry < 0) return [];

  const entries: NourishEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip rows that are clearly empty
    if (row.every(cell => !cell.trim())) continue;

    const dateRaw   = safeCell(row, iDate);
    const typeRaw   = safeCell(row, iType);
    const carersRaw = safeCell(row, iCarers);
    const clientRaw = safeCell(row, iClient);
    const entryRaw  = safeCell(row, iEntry);
    const houseRaw  = safeCell(row, iHouse);

    if (!entryRaw && !typeRaw) continue;

    // Nourish "Clients involved" often contains the HOUSE name instead of a person.
    // Also sometimes contains carer region strings that leaked into the wrong column.
    const clientIsRegionLeak = /all carers in region/i.test(clientRaw);
    const clientLooksLikeHouse = isKnownHouse(clientRaw) || clientIsRegionLeak;

    // House: explicit house column → client-as-house fallback → carers region field
    let house: string;
    let client: string;
    if (houseRaw) {
      house = normalizeHouse(houseRaw);
      client = clientLooksLikeHouse ? '' : clientRaw;
    } else if (clientLooksLikeHouse) {
      house = normalizeHouse(clientRaw);
      client = '';
    } else {
      house = normalizeHouse(extractHouseFromCarers(carersRaw));
      client = clientRaw;
    }

    const carer = cleanCarerName(carersRaw);
    const { severity, flags } = detectFlags(entryRaw + ' ' + typeRaw);
    const category = categorizeEntry(typeRaw, entryRaw);

    entries.push({
      id: uid(),
      date: dateRaw,
      house,
      type: typeRaw || 'Diary Entry',
      carer,
      client,
      entry: entryRaw,
      severity,
      flags,
      category,
    });
  }

  return entries;
}

// ============================================================
// PARSE NOURISH PASTED TEXT (pipe | tab copy-paste from browser)
// ============================================================
export function parseNourishData(rawText: string): NourishEntry[] {
  const trimmed = rawText.trim();

  // Detect CSV: starts with BOM or looks like a CSV header
  if (trimmed.startsWith('\uFEFF') || looksLikeCSV(trimmed)) {
    const result = parseNourishCSV(trimmed);
    if (result.length > 0) return result;
    // Fall through to text parsing if CSV parse got nothing
  }

  const entries: NourishEntry[] = [];
  const lines = trimmed.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Pipe-delimited
    if (line.includes('|')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 4) {
        const dateCandidate = parts.find(p => /\d{2}\/\d{2}\/\d{4}/.test(p)) || '';
        const entryText = parts[parts.length - 1] || parts[parts.length - 2] || '';
        if (!entryText) continue;
        const house = normalizeHouse(extractHouseFromCarers(parts[3] || ''));
        const { severity, flags } = detectFlags(entryText);
        entries.push({
          id: uid(), date: dateCandidate, house,
          type: parts[2] || 'Diary Entry', carer: cleanCarerName(parts[3] || ''),
          client: parts[4] || '', entry: entryText, severity, flags,
          category: categorizeEntry(parts[2] || '', entryText),
        });
      }
      continue;
    }

    // Tab-delimited
    const tabs = line.split('\t');
    if (tabs.length >= 4) {
      const dateCandidate = tabs.find(p => /\d{2}\/\d{2}\/\d{4}/.test(p)) || '';
      const entryText = tabs[tabs.length - 1] || '';
      if (!entryText) continue;
      const house = normalizeHouse(extractHouseFromCarers(tabs[3] || ''));
      const { severity, flags } = detectFlags(entryText);
      entries.push({
        id: uid(), date: dateCandidate, house,
        type: tabs[2] || 'Diary Entry', carer: cleanCarerName(tabs[3] || ''),
        client: tabs[4] || '', entry: entryText, severity, flags,
        category: categorizeEntry(tabs[2] || '', entryText),
      });
    }
  }

  if (entries.length === 0) return parseFreeText(rawText);
  return entries;
}

// ============================================================
// FREE TEXT FALLBACK
// ============================================================
function parseFreeText(text: string): NourishEntry[] {
  const entries: NourishEntry[] = [];
  const lines = text.split('\n');
  let currentHouse = 'General';
  let currentCarer = '';

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    const houseMatch = l.match(/^(lingfield|church|laurel|station|canterbury|glenfrome|woburn|hazelbury|courtney|cottrell|flat)/i);
    if (houseMatch) {
      currentHouse = normalizeHouse(l);
      const m = l.match(/[-–—]\s*(.+)/);
      if (m) currentCarer = m[1].trim();
      continue;
    }
    const catMatch = l.match(/^(incidents?|safeguarding|medication|staff performance|cqc|sickness|health & safety|h&s|supervisions?)[:\s]+(.+)/i);
    if (catMatch) {
      const { severity, flags } = detectFlags(catMatch[2]);
      entries.push({
        id: uid(), date: '', house: currentHouse, type: catMatch[1],
        carer: currentCarer, client: '', entry: catMatch[2],
        severity, flags, category: categorizeEntry(catMatch[1], catMatch[2]),
      });
    }
  }
  return entries;
}

// ============================================================
// BUILD WEEK SUMMARY
// ============================================================
export function buildWeekSummary(entries: NourishEntry[]): WeekSummary {
  const houses: Record<string, HouseSummary> = {};
  const clientDiary: Record<string, NourishEntry[]> = {};
  const allFlags = { red: [] as NourishEntry[], amber: [] as NourishEntry[], green: [] as NourishEntry[] };
  const entryTypes: Record<string, number> = {};
  const clientSet = new Set<string>();
  const carerSet = new Set<string>();
  const dates: string[] = [];

  for (const entry of entries) {
    if (entry.date) dates.push(entry.date);
    if (entry.client) clientSet.add(entry.client);
    if (entry.carer && entry.carer !== 'Staff') carerSet.add(entry.carer);
    entryTypes[entry.type] = (entryTypes[entry.type] || 0) + 1;

    if (entry.severity === 'red') allFlags.red.push(entry);
    else if (entry.severity === 'amber') allFlags.amber.push(entry);

    if (entry.client && !NON_CLIENT.has(entry.client)) {
      if (!clientDiary[entry.client]) clientDiary[entry.client] = [];
      clientDiary[entry.client].push(entry);
    }

    const houseName = entry.house || 'General';
    if (!houses[houseName]) {
      houses[houseName] = {
        name: houseName, coordinator: '', entries: [],
        incidents: [], safeguarding: [], medication: [],
        staffPerformance: [], healthSafety: [], handovers: [], dailySupport: [],
        flags: { red: 0, amber: 0, green: 0 },
      };
    }
    const h = houses[houseName];
    h.entries.push(entry);
    if (entry.carer && entry.carer !== 'Staff') h.coordinator = entry.carer;
    const cat = categorizeEntry(entry.type, entry.entry);
    switch (cat) {
      case 'incident': h.incidents.push(entry); break;
      case 'safeguarding': h.safeguarding.push(entry); break;
      case 'medication': h.medication.push(entry); break;
      case 'handover': h.handovers.push(entry); break;
      case 'daily_support': h.dailySupport.push(entry); break;
      case 'health_safety': h.healthSafety.push(entry); break;
      case 'staff': h.staffPerformance.push(entry); break;
    }
    if (entry.severity === 'red') h.flags.red++;
    else if (entry.severity === 'amber') h.flags.amber++;
    else h.flags.green++;
  }

  // Sort dates as DD/MM/YYYY properly
  const sorted = dates.filter(Boolean).sort((a, b) => {
    const [da, ma, ya] = a.split('/').map(Number);
    const [db, mb, yb] = b.split('/').map(Number);
    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
  });

  return {
    dateFrom: sorted[0] || '',
    dateTo: sorted[sorted.length - 1] || '',
    totalEntries: entries.length,
    houses,
    allFlags,
    entryTypes,
    clients: [...clientSet],
    carers: [...carerSet],
    clientDiary,
  };
}
