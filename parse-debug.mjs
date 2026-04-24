import fs from 'fs';

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
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some(c => c.length > 0)) rows.push(row);
  }
  return rows;
}

const text = fs.readFileSync('C:/Users/brook/Downloads/type of datasets extracts from careplanner or similar/Client-diary (26).csv', 'utf8');
const rows = parseCSVRows(text);

console.log('Total parsed rows:', rows.length);
console.log('\nROW 0 (headers):');
rows[0].forEach((h, i) => console.log(`  [${i}] "${h}"`));

console.log('\nROW 1 (first data row):');
rows[1].forEach((cell, i) => {
  console.log(`  [${i}] len=${cell.length} => "${cell.slice(0, 80).replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`);
});

console.log('\nROW 2:');
if (rows[2]) {
  rows[2].forEach((cell, i) => {
    console.log(`  [${i}] len=${cell.length} "${cell.slice(0, 80).replace(/\n/g, '\\n')}"`);
  });
}
