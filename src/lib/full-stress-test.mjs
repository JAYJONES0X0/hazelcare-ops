/**
 * CAREOPS FULL STRESS TEST
 * Tests every file in the test corpus through the intelligence pipeline.
 */
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const TEST_DIR = 'C:\\Users\\brook\\Downloads\\02_CAREOPS_HAZELCARE';
const SUPPORTED = new Set(['txt', 'csv', 'tsv', 'md', 'pdf', 'docx', 'xlsx', 'xls', 'xlsm', 'zip']);
const BINARY = new Set(['pdf', 'docx', 'xlsx', 'xls', 'xlsm']);

// Dynamic import the source modules
const importProfs = await import('./import-profiles.ts');
const { buildEnvelopeFromRaw } = importProfs;
const { extractFileText } = await import('./universal-extractor.ts');

function discoverFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      const ext = e.name.split('.').pop()?.toLowerCase();
      if (SUPPORTED.has(ext)) files.push({ full, name: e.name, kind: 'file' });
    }
  }
  return files;
}

async function expandZips(files) {
  const expanded = [];
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'zip') { expanded.push(f); continue; }
    try {
      const zip = await JSZip.loadAsync(fs.readFileSync(f.full));
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        const innerName = entry.name.split('/').pop() || entry.name;
        const innerExt = innerName.split('.').pop()?.toLowerCase();
        if (SUPPORTED.has(innerExt) && innerExt !== 'zip') {
          expanded.push({ full: entry.name, name: innerName, kind: 'zip-entry', zipPath: f.full });
        }
      }
    } catch (e) {
      expanded.push({ full: f.full, name: f.name, kind: 'file', zipError: e.message });
    }
  }
  return expanded;
}

async function testOne(file) {
  const start = Date.now();
  const ext = file.name.split('.').pop()?.toLowerCase();
  try {
    let text;
    if (file.kind === 'zip-entry') {
      const zip = await JSZip.loadAsync(fs.readFileSync(file.zipPath));
      const entry = zip.file(file.full);
      if (!entry) throw new Error('Entry not found in zip');
      if (BINARY.has(ext)) {
        const blob = await entry.async('blob');
        text = await extractFileText(new File([blob], file.name));
      } else {
        text = await entry.async('text');
      }
    } else {
      if (BINARY.has(ext)) {
        text = await extractFileText(new File([fs.readFileSync(file.full)], file.name));
      } else {
        text = fs.readFileSync(file.full, 'utf8');
      }
    }
    const envelope = buildEnvelopeFromRaw(file.name, text);
    return {
      ...file,
      type: envelope.source.detectedType,
      profile: envelope.source.parserProfile,
      diary: envelope.diaryEntries?.length || 0,
      week: envelope.weekSummary?.totalEntries || 0,
      clients: envelope.clientCandidates?.length || 0,
      needs: envelope.supportPlan?.needs?.length || 0,
      warnings: envelope.warnings?.length || 0,
      chars: text.length,
      ms: Date.now() - start,
    };
  } catch (err) {
    return { ...file, error: err.message, ms: Date.now() - start };
  }
}

const files = discoverFiles(TEST_DIR);
console.log(`\n===== CAREOPS FULL STRESS TEST =====`);
console.log(`Dir: ${TEST_DIR}`);
console.log(`Files found: ${files.length}\n`);

const expanded = await expandZips(files);
console.log(`After zip expansion: ${expanded.length} cases\n`);

// Type stats
const typeStats = {};
for (const f of expanded) {
  const ext = f.name.split('.').pop()?.toLowerCase() || '?';
  typeStats[ext] = (typeStats[ext] || 0) + 1;
}
console.log('By type:', typeStats);

console.log('\nProcessing...');

let passed = 0, failed = 0, errors = [];
let diaryTotal = 0, weekTotal = 0, clientTotal = 0, needTotal = 0;

// Process in batches to keep console responsive
const batchSize = 10;
for (let i = 0; i < expanded.length; i += batchSize) {
  const batch = expanded.slice(i, i + batchSize);
  const results = await Promise.all(batch.map(testOne));
  for (const r of results) {
    if (r.error) {
      failed++;
      errors.push(r);
    } else {
      passed++;
      diaryTotal += r.diary;
      weekTotal += r.week;
      clientTotal += r.clients;
      needTotal += r.needs;
    }
  }
  const pct = Math.round(Math.min(i + batchSize, expanded.length) / expanded.length * 100);
  process.stdout.write(`\r  ${Math.min(i + batchSize, expanded.length)}/${expanded.length} (${pct}%) — ${passed} ok, ${failed} fail`);
}

console.log(`\n\n===== RESULTS =====`);
console.log(`Total cases: ${expanded.length}`);
console.log(`Passed:      ${passed}`);
console.log(`Failed:      ${failed}`);
console.log(`Diary entries:  ${diaryTotal}`);
console.log(`Week entries:   ${weekTotal}`);
console.log(`Client cands:   ${clientTotal}`);
console.log(`Support needs:  ${needTotal}`);

// classification breakdown
const classStats = {};
const profileStats = {};
for (const r of errors.length ? [] : []) { /* skip */ }
// Re-process passed results for stats
let allResults = [];
const batchSize2 = 10;
for (let i = 0; i < expanded.length; i += batchSize2) {
  const batch = expanded.slice(i, i + batchSize2);
  allResults.push(...await Promise.all(batch.map(testOne)));
}
for (const r of allResults) {
  if (!r.error) {
    classStats[r.type || 'unknown'] = (classStats[r.type || 'unknown'] || 0) + 1;
    profileStats[r.profile || 'none'] = (profileStats[r.profile || 'none'] || 0) + 1;
  }
}
console.log('\nClassifications:', classStats);
console.log('\nParser profiles:', profileStats);

if (errors.length > 0) {
  console.log(`\n--- FAILURES (${errors.length}) ---`);
  for (const e of errors.slice(0, 15)) {
    console.log(`  ${e.name}: ${e.error}`);
  }
  if (errors.length > 15) console.log(`  ... and ${errors.length - 15} more`);
}

const report = {
  generatedAt: new Date().toISOString(),
  dir: TEST_DIR,
  total: expanded.length,
  passed, failed,
  diaryEntries: diaryTotal,
  weekEntries: weekTotal,
  clientCandidates: clientTotal,
  supportNeeds: needTotal,
  byType: typeStats,
  classifications: classStats,
  profiles: profileStats,
  errors,
};
const reportDir = path.join(process.cwd(), 'docs', 'audits');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'stress-test-report.json'), JSON.stringify(report, null, 2));
console.log(`\nReport: docs/audits/stress-test-report.json`);

const verdict = failed === 0 ? 'ALL PASS — READY' : failed <= 5 ? `${failed} FAILURES — MINOR FIXES NEEDED` : `${failed} FAILURES — NEEDS WORK`;
console.log(`\n===== VERDICT: ${verdict} =====`);
