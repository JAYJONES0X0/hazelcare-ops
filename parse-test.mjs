import fs from 'fs';
import path from 'path';

const HOUSE_MAP = {
  'glenfrome': 'Glenfrome House', 'laurel house': 'Laurel House',
  'hazelbury': 'Hazelbury House', 'station': 'Station House',
  'church': 'Church House', 'woburn': 'Woburn House',
  'courtney': 'Courtney Lodge', 'canterbury': 'Canterbury',
  'lingfield': 'Lingfield House', 'cottrell': 'Cottrell House',
  'old bakery': 'Flats (Old Bakery)', 'management': 'Management',
};

function normalizeHouse(raw) {
  if (!raw) return '';
  const lower = raw.toLowerCase().trim();
  for (const [key, value] of Object.entries(HOUSE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return raw.trim();
}

function extractHouseFromText(text) {
  if (!text) return '';
  const lower = text.toLowerCase();
  for (const [key, value] of Object.entries(HOUSE_MAP)) {
    if (key === 'unassigned' || key === 'management') continue;
    if (lower.includes(key)) return value;
  }
  return '';
}

function parseCSVRows(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i], next = clean[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(cur.trim()); cur = '';
    } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
      if (ch === '\r') i++;
      row.push(cur.trim());
      if (row.some(c => c.length > 0)) rows.push(row);
      row = []; cur = '';
    } else { cur += ch; }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some(c => c.length > 0)) rows.push(row);
  }
  return rows;
}

// FIXED findCol — exact match → starts-with → whole-word boundary
function findCol(headers, ...aliases) {
  const normed = headers.map(h => h.toLowerCase().trim());
  for (const a of aliases) {
    const idx = normed.findIndex(n => n === a.toLowerCase());
    if (idx >= 0) return idx;
  }
  for (const a of aliases) {
    const al = a.toLowerCase();
    const idx = normed.findIndex(n => n.startsWith(al));
    if (idx >= 0) return idx;
  }
  for (const a of aliases) {
    const al = a.toLowerCase();
    const re = new RegExp(`\\b${al.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const idx = normed.findIndex(n => re.test(n));
    if (idx >= 0) return idx;
  }
  return -1;
}

function safeCell(row, idx) { return (idx >= 0 && idx < row.length) ? (row[idx] || '').trim() : ''; }

function parseDateMs(s) {
  if (!s) return 0;
  const parts = s.split(/[ /:-]/);
  if (parts.length >= 3) {
    if (parts[0].length === 4) return new Date(s).getTime();
    const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, y = parseInt(parts[2], 10);
    if (d > 0 && m >= 0 && y > 2000) return new Date(y, m, d).getTime();
  }
  const ts = new Date(s).getTime();
  return isNaN(ts) ? 0 : ts;
}

function parseFile(filePath) {
  let text;
  try { text = fs.readFileSync(filePath, 'utf8'); }
  catch { return { entries: 0, error: 'Could not read file' }; }

  const rows = parseCSVRows(text);
  if (rows.length < 2) return { entries: 0, error: `Only ${rows.length} rows` };

  const headers = rows[0];
  const iDate   = findCol(headers, 'entry occurred', 'display from', 'occurred', 'date', 'entry_date', 'start date');
  const iType   = findCol(headers, 'incident type', 'entry type', 'type', 'care category', 'category');
  const iCarer  = findCol(headers, 'carers involved', 'carer', 'worker name', 'key worker', 'staff', 'worker');
  const iClient = findCol(headers, 'clients involved', 'client name', 'client', 'service user', 'resident', 'person');
  const iEntry  = findCol(headers, 'diary entry', 'entry', 'notes', 'details', 'description', 'note', 'comment', 'body');
  const iHouse  = findCol(headers, 'house', 'location', 'property', 'unit', 'site', 'service');

  let gEntry = iEntry, gDate = iDate, gCarer = iCarer, gClient = iClient;

  if (gEntry < 0) {
    const sample = rows[1] || [];
    for (let c = 0; c < sample.length; c++) {
      const val = sample[c].trim();
      if (val.length > 60 && gEntry < 0) gEntry = c;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(val) && gDate < 0) gDate = c;
    }
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

  if (gEntry < 0) return { entries: 0, headers: headers.join(' | ').slice(0, 150), error: 'NO ENTRY COL' };

  const entries = [];
  let badDate = 0, skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawEntry = safeCell(r, gEntry);
    if (rawEntry.length < 5) { skipped++; continue; }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawEntry)) { skipped++; continue; }
    if (['diary entry','entry','notes','details'].includes(rawEntry.toLowerCase())) { skipped++; continue; }

    const dateRaw = safeCell(r, gDate);
    if (dateRaw && parseDateMs(dateRaw) === 0) { badDate++; continue; }

    const houseRaw  = safeCell(r, iHouse);
    const clientRaw = safeCell(r, gClient);
    const house = normalizeHouse(houseRaw) || extractHouseFromText(rawEntry) || extractHouseFromText(clientRaw) || 'UNASSIGNED';

    entries.push({
      date:   dateRaw || 'NO_DATE',
      client: clientRaw || 'UNASSIGNED',
      carer:  safeCell(r, gCarer) || 'UNASSIGNED',
      type:   safeCell(r, iType)  || 'Standard Entry',
      house,
      entry:  rawEntry.slice(0, 80),
    });
  }

  const clients = [...new Set(entries.map(e => e.client))];
  const houses  = [...new Set(entries.map(e => e.house))];
  const sample  = entries[0] || null;
  const dateRange = entries.length
    ? `${entries[entries.length-1].date} → ${entries[0].date}`
    : 'N/A';

  return {
    rawRows: rows.length, headers: headers.join(' | ').slice(0, 200),
    colMap: { iDate, iType, iCarer, iClient, iEntry, iHouse },
    entries: entries.length, badDates: badDate, skipped,
    sample, clients: clients.slice(0, 8), houses, dateRange,
  };
}

const DIR = 'C:/Users/brook/Downloads/type of datasets extracts from careplanner or similar';
const TEST_FILES = [
  'Client-diary (26).csv',
  'Client-diary (29).csv',
  'Client-diary (30).csv',
  'Client-diary (14).csv',
  'Client-diary (20).csv',
  'Client-diary (21).csv',
  'Carer-diary (1).csv',
  'Daily Finance Overview - Attendance report 3-17-26.csv',
  'hazelcare-evidence-2026-04-09 (2).csv',
  'hazelcare_support_roster.csv',
];

let passed = 0, failed = 0;

for (const f of TEST_FILES) {
  const fp = path.join(DIR, f);
  if (!fs.existsSync(fp)) { console.log(`\nSKIP  ${f}`); continue; }
  const r = parseFile(fp);
  const ok = r.entries > 0;
  if (ok) passed++; else failed++;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`\n${status}  ${f}`);
  console.log(`  Rows:${r.rawRows} | Entries:${r.entries} | BadDates:${r.badDates||0} | Skipped:${r.skipped||0}`);
  console.log(`  ColMap: date=${r.colMap?.iDate} type=${r.colMap?.iType} carer=${r.colMap?.iCarer} client=${r.colMap?.iClient} entry=${r.colMap?.iEntry} house=${r.colMap?.iHouse}`);
  if (r.error) console.log(`  ERROR: ${r.error}`);
  if (r.sample) {
    console.log(`  DateRange: ${r.dateRange}`);
    console.log(`  Sample  date:"${r.sample.date}"  client:"${r.sample.client}"  carer:"${r.sample.carer}"  house:"${r.sample.house}"  type:"${r.sample.type}"`);
    console.log(`  Entry:  "${r.sample.entry}"`);
  }
  console.log(`  Clients(${r.clients?.length}): ${r.clients?.join(' | ')}`);
  console.log(`  Houses:  ${r.houses?.join(' | ')}`);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`RESULT: ${passed} PASSED  /  ${failed} FAILED`);
