import fs from 'fs';

function findCol(headers, ...aliases) {
  return headers.findIndex(h => {
    const norm = h.toLowerCase().trim();
    return aliases.some(a => norm.includes(a.toLowerCase()));
  });
}

const text = fs.readFileSync('C:/Users/brook/Downloads/type of datasets extracts from careplanner or similar/Client-diary (26).csv', 'utf8');

// Find first line (header)
const firstLine = text.slice(0, text.indexOf('\n'));
console.log('First line raw:', JSON.stringify(firstLine.slice(0,300)));

// Parse headers manually
const headers = [];
let cur = '', inQ = false;
for (let i = 0; i < firstLine.length; i++) {
  const ch = firstLine[i];
  if (ch === '"') { inQ = !inQ; }
  else if (ch === ',' && !inQ) { headers.push(cur.trim()); cur = ''; }
  else cur += ch;
}
headers.push(cur.trim());

console.log('\nParsed headers:');
headers.forEach((h, i) => console.log(`  [${i}] "${h}" (len=${h.length}) charCodes: ${[...h.slice(0,5)].map(c=>c.charCodeAt(0)).join(',')}`));

// Test findCol
const iEntry = findCol(headers, 'diary entry', 'entry', 'notes', 'details', 'description', 'note', 'comment', 'body');
console.log('\niEntry (diary entry):', iEntry);

// Manual check
console.log('\nManual check - does headers[6] include "diary entry"?', headers[6]?.toLowerCase().trim().includes('diary entry'));
console.log('headers[6] charCodes:', [...(headers[6]||'')].map(c=>c.charCodeAt(0)));
