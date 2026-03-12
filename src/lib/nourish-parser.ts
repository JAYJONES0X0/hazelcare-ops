import type { NourishEntry, HouseSummary, WeekSummary } from './types';
import { uid } from './storage';

// ============================================================
// FLAG KEYWORDS — auto-severity from diary text
// ============================================================
const RED_FLAGS = [
  'refused medication', 'medication refused', 'he refused', 'she refused',
  'safeguarding', 'self-neglect', 'self neglect', 'self-harm', 'self harm',
  'police', 'ambulance', 'hospital', 'a&e', 'arrested',
  'assault', 'struck', 'hit', 'attacked', 'threatened',
  'missing', 'absconded', 'left without',
  'fire', 'short circuit', 'electrical',
  'death', 'deceased', 'passed away',
  'controlled drug', 'cd discrepancy',
  'injury', 'fall', 'collapsed', 'seizure',
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
];

// ============================================================
// HOUSE NAME NORMALIZATION
// ============================================================
const HOUSE_MAP: Record<string, string> = {
  'glenfrome house': 'Glenfrome House',
  'glenfrome': 'Glenfrome House',
  'laurel house': 'Laurel House',
  'laurel house ': 'Laurel House',
  'hazelbury house': 'Hazelbury House',
  'hazelbury': 'Hazelbury House',
  'station house': 'Station House',
  'station': 'Station House',
  'church house': 'Church House',
  'church': 'Church House',
  'woburn house': 'Woburn House',
  'woburn': 'Woburn House',
  'courtney lodge': 'Courtney Lodge',
  '1b courtney way': 'Courtney Lodge',
  'courtney way': 'Courtney Lodge',
  'canterbury': 'Canterbury',
  'lingfield house': 'Lingfield House',
  'lingfield': 'Lingfield House',
  'cottrell house': 'Cottrell House',
  'cottrell': 'Cottrell House',
  'flat 2 old bakery': 'Flats (Old Bakery)',
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
  return raw.trim();
}

// ============================================================
// ENTRY TYPE CATEGORIZATION
// ============================================================
type Category = 'incident' | 'safeguarding' | 'medication' | 'handover' | 'daily_support' | 'finance' | 'staff' | 'health_safety' | 'other';

function categorizeEntry(type: string, text: string): Category {
  const lowerType = type.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerType.includes('accident') || lowerType.includes('incident')) return 'incident';
  if (lowerType.includes('safeguard')) return 'safeguarding';
  if (lowerType.includes('medication')) return 'medication';
  if (lowerType.includes('handover')) return 'handover';
  if (lowerType.includes('daily 1:1') || lowerType.includes('1to1')) return 'daily_support';
  if (lowerType.includes('finance') || lowerType.includes('expense')) return 'finance';
  if (lowerType.includes('repair')) return 'health_safety';
  if (lowerType.includes('supervision') || lowerType.includes('spot check')) return 'staff';

  // Infer from content
  if (lowerText.includes('safeguard')) return 'safeguarding';
  if (lowerText.includes('medication') || lowerText.includes('prescribed')) return 'medication';
  if (lowerText.includes('incident') || lowerText.includes('police') || lowerText.includes('ambulance')) return 'incident';

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
// PARSE NOURISH TABLE DATA (copied from browser)
// ============================================================
export function parseNourishData(rawText: string): NourishEntry[] {
  const entries: NourishEntry[] = [];
  const lines = rawText.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Try pipe-delimited (from table copy)
    if (line.includes('|')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 7 && /\d{2}\/\d{2}\/\d{4}/.test(parts[0])) {
        const houseRaw = extractHouseFromCarers(parts[4]);
        const { severity, flags } = detectFlags(parts[6]);
        entries.push({
          id: uid(),
          date: parts[2] || parts[0],
          house: normalizeHouse(houseRaw),
          type: parts[3],
          carer: cleanCarerName(parts[4]),
          client: parts[5],
          entry: parts[6],
          severity,
          flags,
        });
      }
      continue;
    }

    // Try tab-delimited
    const tabs = line.split('\t');
    if (tabs.length >= 7 && /\d{2}\/\d{2}\/\d{4}/.test(tabs[0])) {
      const houseRaw = extractHouseFromCarers(tabs[4]);
      const { severity, flags } = detectFlags(tabs[6]);
      entries.push({
        id: uid(),
        date: tabs[2] || tabs[0],
        house: normalizeHouse(houseRaw),
        type: tabs[3],
        carer: cleanCarerName(tabs[4]),
        client: tabs[5],
        entry: tabs[6],
        severity,
        flags,
      });
    }
  }

  // If no structured data found, try free-text parsing
  if (entries.length === 0) {
    return parseFreeText(rawText);
  }

  return entries;
}

// ============================================================
// PARSE FREE TEXT (meeting notes, transcripts)
// ============================================================
function parseFreeText(text: string): NourishEntry[] {
  const entries: NourishEntry[] = [];
  const lines = text.split('\n');

  let currentHouse = 'General';
  let currentCarer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect house headers
    const houseMatch = line.match(/^(lingfield|church|laurel|station|canterbury|glenfrome|woburn|hazelbury|courtney|cottrell|flat)/i);
    if (houseMatch) {
      currentHouse = normalizeHouse(line);
      const coordMatch = line.match(/[-–—]\s*(.+)/);
      if (coordMatch) currentCarer = coordMatch[1].trim();
      continue;
    }

    // Detect category lines
    const catMatch = line.match(/^(incidents?|safeguarding|medication|staff performance|cqc|sickness|health & safety|h&s|supervisions?)[:\s]+(.+)/i);
    if (catMatch) {
      const { severity, flags } = detectFlags(catMatch[2]);
      entries.push({
        id: uid(),
        date: '',
        house: currentHouse,
        type: catMatch[1],
        carer: currentCarer,
        client: '',
        entry: catMatch[2],
        severity,
        flags,
      });
    }
  }

  return entries;
}

// ============================================================
// HELPERS
// ============================================================
function extractHouseFromCarers(carers: string): string {
  const match = carers.match(/region:\s*([^,]+)/);
  if (match) return match[1].trim();
  return 'General';
}

function cleanCarerName(raw: string): string {
  return raw
    .replace(/All carers in region:[^,]+,?\s*/g, '')
    .replace(/All carers in region:[^,]+/g, '')
    .trim() || 'Staff';
}

// ============================================================
// BUILD WEEK SUMMARY
// ============================================================
export function buildWeekSummary(entries: NourishEntry[]): WeekSummary {
  const houses: Record<string, HouseSummary> = {};
  const allFlags = { red: [] as NourishEntry[], amber: [] as NourishEntry[], green: [] as NourishEntry[] };
  const entryTypes: Record<string, number> = {};
  const clientSet = new Set<string>();
  const carerSet = new Set<string>();

  let minDate = '99/99/9999';
  let maxDate = '00/00/0000';

  for (const entry of entries) {
    // Track dates
    if (entry.date && entry.date < minDate) minDate = entry.date;
    if (entry.date && entry.date > maxDate) maxDate = entry.date;

    // Track unique
    if (entry.client) clientSet.add(entry.client);
    if (entry.carer && entry.carer !== 'Staff') carerSet.add(entry.carer);
    entryTypes[entry.type] = (entryTypes[entry.type] || 0) + 1;

    // Track flags
    if (entry.severity === 'red') allFlags.red.push(entry);
    if (entry.severity === 'amber') allFlags.amber.push(entry);

    // Build house summary
    const houseName = entry.house || 'General';
    if (!houses[houseName]) {
      houses[houseName] = {
        name: houseName,
        coordinator: '',
        entries: [],
        incidents: [],
        safeguarding: [],
        medication: [],
        staffPerformance: [],
        healthSafety: [],
        handovers: [],
        dailySupport: [],
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

  return {
    dateFrom: minDate !== '99/99/9999' ? minDate : '',
    dateTo: maxDate !== '00/00/0000' ? maxDate : '',
    totalEntries: entries.length,
    houses,
    allFlags,
    entryTypes,
    clients: [...clientSet],
    carers: [...carerSet],
  };
}
