import fs from 'fs';

// Check encoding of each CSV
const dir = 'C:/Users/brook/Downloads/type of datasets extracts from careplanner or similar';
const files = [
  'Client-diary (26).csv',
  'Client-diary (30).csv',
  'hazelcare-evidence-2026-04-09 (2).csv',
];

for (const f of files) {
  const buf = fs.readFileSync(`${dir}/${f}`);
  // Check BOM
  const b0 = buf[0], b1 = buf[1], b2 = buf[2];
  let encoding = 'UTF-8 (no BOM)';
  if (b0 === 0xFF && b1 === 0xFE) encoding = 'UTF-16 LE';
  else if (b0 === 0xFE && b1 === 0xFF) encoding = 'UTF-16 BE';
  else if (b0 === 0xEF && b1 === 0xBB && b2 === 0xBF) encoding = 'UTF-8 BOM';
  
  // Read first 200 chars both ways
  const asUtf8 = buf.slice(0, 200).toString('utf8');
  const asUtf16 = buf.slice(0, 200).toString('utf16le');
  
  console.log(`\n=== ${f} ===`);
  console.log(`Encoding: ${encoding}  (BOM bytes: ${b0.toString(16)} ${b1.toString(16)} ${b2.toString(16)})`);
  console.log(`UTF-8 read: "${asUtf8.slice(0, 100).replace(/\0/g, '[NUL]').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`);
  console.log(`UTF-16LE read: "${asUtf16.slice(0, 100).replace(/\0/g, '[NUL]').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`);

  // Try to parse as UTF-16LE if that's the detected encoding
  if (encoding === 'UTF-16 LE') {
    const text16 = buf.toString('utf16le');
    const firstNewline = text16.indexOf('\n');
    console.log(`UTF-16LE first line: "${text16.slice(0, firstNewline).slice(0,150)}"`);
  } else {
    const textUtf8 = buf.toString('utf8').replace(/^\uFEFF/, '');
    const firstNewline = textUtf8.indexOf('\n');
    console.log(`UTF-8 first line: "${textUtf8.slice(0, Math.min(firstNewline, 200))}"`);
    // Count commas in first line
    const firstLine = textUtf8.slice(0, firstNewline);
    console.log(`Columns in header: ${firstLine.split(',').length}`);
    // Check first data row col[6]
    const lines = textUtf8.split('\n');
    if (lines[1]) {
      console.log(`Row[1] raw start: "${lines[1].slice(0,100).replace(/\r/g,'\\r')}"`);
    }
  }
}
