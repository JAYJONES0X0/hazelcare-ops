import type { CareEntry, WeekSummary } from './types';
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
  'hazelcare': '',
  'supported living pc': '',
  'medical': 'Medical',
  'time off': 'SKIP',
  'unassigned': 'UNASSIGNED',
  'sickness': 'SKIP',
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

/** 
 * Helper to parse various date formats found in CarePlanner
 * formats: DD/MM/YYYY, DD/MM/YYYY HH:mm, YYYY-MM-DD, etc.
 */
function parseDateToMs(s: string): number {
  if (!s) return 0;
  const parts = s.split(/[ /:-]/);
  if (parts.length >= 3) {
    // Check if first part is year or day
    if (parts[0].length === 4) return new Date(s).getTime();
    // Assume DD/MM/YYYY
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    return new Date(y, m, d).getTime();
  }
  return new Date(s).getTime() || 0;
}

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

  const headerRow = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const findIdx = (keywords: string[]) => headerRow.findIndex(h => keywords.some(k => h.includes(k)));

  let iDate = findIdx(['date', 'occurred', 'time', 'entryat', 'recorded']);
  let iCarer = findIdx(['carer', 'staff', 'worker', 'author', 'user']);
  let iClient = findIdx(['client', 'serviceuser', 'resident', 'person', 'subject']);
  let iType = findIdx(['type', 'category', 'event', 'subject']);
  let iEntry = findIdx(['entry', 'note', 'text', 'detail', 'comment', 'report']);
  let iHouse = findIdx(['house', 'location', 'site', 'unit', 'property']);

  if (iEntry === -1) {
    const sample = rows[1] || rows[0];
    iEntry = sample.findIndex(c => c.length > 40);
    if (iDate === -1) iDate = sample.findIndex(c => /\d{2}\/\d{2}/.test(c));
  }

  const entries: CareEntry[] = [];
  const startAt = (iEntry !== -1 && rows[0][iEntry]?.toLowerCase()?.includes('entry')) ? 1 : 0;

  for (let i = startAt; i < rows.length; i++) {
    const r = rows[i];
    const entryText = r[iEntry] || '';
    if (entryText.length < 5) continue;

    const date = r[iDate] || new Date().toLocaleDateString('en-GB');
    const carer = r[iCarer] || 'Personnel Unassigned';
    const client = r[iClient] || 'Service User Unassigned';
    const type = r[iType] || 'Standard Entry';
    const house = normalizeHouse(r[iHouse] || r[iClient] || '');

    const { severity, flags } = detectFlags(entryText + ' ' + type);
    
    entries.push({
      id: uid(),
      date,
      house: house || 'UNASSIGNED',
      carer,
      client,
      type,
      entry: entryText,
      severity,
      flags,
      category: categorizeEntry(type, entryText)
    });
  }

  // FORCE NEWEST FIRST and LIFT CAP TO 50,000
  return entries
    .sort((a, b) => parseDateToMs(b.date) - parseDateToMs(a.date))
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
        name: h, 
        entries: [], 
        flags: { red: 0, amber: 0, green: 0 }, 
        medication: [], 
        incidents: [], 
        safeguarding: [],
        handovers: [],
        dailySupport: [],
        coordinator: 'Unassigned',
        staffPerformance: [],
        healthSafety: []
      };
    }
    const house = summary.houses[h];
    house.entries.push(e);
    
    if (e.severity === 'red') { house.flags.red++; summary.allFlags.red.push(e); }
    if (e.severity === 'amber') { house.flags.amber++; summary.allFlags.amber.push(e); }

    const cat = e.category;
    if (cat === 'medication') house.medication.push(e);
    if (cat === 'incident') house.incidents.push(e);
    if (cat === 'safeguarding') house.safeguarding.push(e);
    if (cat === 'handover') house.handovers.push(e);
    if (cat === 'daily_support') house.dailySupport.push(e);
    if (cat === 'health_safety') house.healthSafety.push(e);

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

export function parseRosterCSV(_: string, __?: string): any[] { return []; }
