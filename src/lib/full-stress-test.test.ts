import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildEnvelopeFromRaw } from './import-profiles';
import { extractFileText } from './universal-extractor';

const TEST_DIR = process.env.CAREOPS_STRESS_DIR || 'C:\\Users\\brook\\Downloads\\02_CAREOPS_HAZELCARE';
const HAS_STRESS_CORPUS = fs.existsSync(TEST_DIR);
const SUPPORTED = new Set(['txt', 'csv', 'tsv', 'md', 'pdf', 'docx', 'xlsx', 'xls', 'xlsm', 'zip']);
const BINARY = new Set(['pdf', 'docx', 'xlsx', 'xls', 'xlsm']);

function discover(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      const ext = e.name.split('.').pop()?.toLowerCase();
      if (e.name.startsWith('~$')) continue;
      if (SUPPORTED.has(ext)) out.push({ full, name: e.name, kind: 'file' });
    }
  }
  return out;
}

describe.skipIf(!HAS_STRESS_CORPUS)('careops full stress test', () => {
  it('processes all files in the test corpus without errors', async () => {
    const files = discover(TEST_DIR);
    expect(files.length).toBeGreaterThan(0);
    console.log(`\nFiles discovered: ${files.length}`);

    // Expand zips
    const expanded = [];
    for (const f of files) {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext !== 'zip') { expanded.push(f); continue; }
      try {
        const zip = await JSZip.loadAsync(fs.readFileSync(f.full));
        for (const entry of Object.values(zip.files)) {
          if (entry.dir) continue;
          const iname = entry.name.split('/').pop() || entry.name;
          if (iname.startsWith('~$')) continue;
          const iext = iname.split('.').pop()?.toLowerCase();
          if (SUPPORTED.has(iext) && iext !== 'zip')
            expanded.push({ full: entry.name, name: iname, kind: 'zip-entry', zipPath: f.full });
        }
      } catch (e) {
        expanded.push({ full: f.full, name: f.name, kind: 'file', zipError: e.message });
      }
    }

    console.log(`After zip expansion: ${expanded.length} cases`);

    let passed = 0, failed = 0;
    const errors = [];
    const types = {};
    const profiles = {};
    let diaryTotal = 0, weekTotal = 0, clientTotal = 0, needTotal = 0;

    for (let i = 0; i < expanded.length; i++) {
      const f = expanded[i];
      const ext = f.name.split('.').pop()?.toLowerCase();
      try {
        let text;
        if (f.kind === 'zip-entry') {
          const zip = await JSZip.loadAsync(fs.readFileSync(f.zipPath));
          const entry = zip.file(f.full);
          if (!entry) throw new Error('Entry not found in zip');
          if (BINARY.has(ext)) text = await extractFileText(new File([await entry.async('blob')], f.name));
          else text = await entry.async('text');
        } else {
          if (BINARY.has(ext)) text = await extractFileText(new File([fs.readFileSync(f.full)], f.name));
          else text = fs.readFileSync(f.full, 'utf8');
        }
        const env = buildEnvelopeFromRaw(f.name, text);
        passed++;
        types[env.source.detectedType || 'unknown'] = (types[env.source.detectedType || 'unknown'] || 0) + 1;
        profiles[env.source.parserProfile || 'none'] = (profiles[env.source.parserProfile || 'none'] || 0) + 1;
        diaryTotal += env.diaryEntries?.length || 0;
        weekTotal += env.weekSummary?.totalEntries || 0;
        clientTotal += env.clientCandidates?.length || 0;
        needTotal += env.supportPlan?.needs?.length || 0;
      } catch (err) {
        failed++;
        errors.push({ name: f.name, error: err.message });
      }
      if ((i + 1) % 20 === 0 || i === expanded.length - 1) {
        process.stdout.write(`\r  ${i + 1}/${expanded.length} — ${passed} ok, ${failed} fail`);
      }
    }

    console.log(`\n\n=== RESULTS ===`);
    console.log(`Total: ${expanded.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Diary: ${diaryTotal} | Week: ${weekTotal} | Clients: ${clientTotal} | Needs: ${needTotal}`);
    console.log('\nClassifications:', types);
    console.log('\nProfiles:', profiles);

    if (errors.length > 0) {
      console.log(`\n=== FAILURES (${errors.length}) ===`);
      for (const e of errors.slice(0, 20)) console.log(`  ${e.name}: ${e.error}`);
    }

    expect(failed).toBe(0);
    expect(passed).toBeGreaterThan(0);
  }, 600000);
});
