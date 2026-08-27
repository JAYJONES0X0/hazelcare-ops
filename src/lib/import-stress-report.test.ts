import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildEnvelopeFromRaw } from './import-profiles';
import { extractFileText } from './universal-extractor';

const ROOTS = [
  process.env.CAREOPS_STRESS_DIR || 'C:\\Users\\brook\\Downloads\\02_CAREOPS_HAZELCARE',
];
const HAS_STRESS_CORPUS = ROOTS.some((root) => fs.existsSync(root));

const SUPPORTED = new Set(['txt', 'csv', 'tsv', 'md', 'pdf', 'docx', 'xlsx', 'xls', 'xlsm', 'zip']);
const BINARY_TEXT_EXTS = new Set(['pdf', 'docx', 'xlsx', 'xls', 'xlsm']);
const REPORT_PATH = path.join(process.cwd(), 'docs', 'audits', 'import-stress-report-2026-05-21.json');

type StressCase = {
  source: string;
  fileName: string;
  size: number;
  kind: 'file' | 'zip-entry';
  zipPath?: string;
};

type CaseResult = StressCase & {
  detectedType?: string;
  parserProfile?: string;
  diaryEntries?: number;
  weekEntries?: number;
  clientCandidates?: number;
  supportNeeds?: number;
  warnings?: string[];
  textLength?: number;
  ms?: number;
  error?: string;
};

function extOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function collectFiles(inputPath: string): StressCase[] {
  if (!fs.existsSync(inputPath)) return [];
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) {
    const ext = extOf(inputPath);
    return SUPPORTED.has(ext)
      ? [{ source: inputPath, fileName: path.basename(inputPath), size: stat.size, kind: 'file' }]
      : [];
  }

  const out: StressCase[] = [];
  const stack = [inputPath];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (item.name.startsWith('~$')) continue;
      const ext = extOf(item.name);
      if (SUPPORTED.has(ext)) {
        out.push({ source: full, fileName: item.name, size: fs.statSync(full).size, kind: 'file' });
      }
    }
  }
  return out;
}

async function expandZip(file: StressCase): Promise<StressCase[]> {
  const zip = await JSZip.loadAsync(fs.readFileSync(file.source));
  const cases: StressCase[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const innerName = entry.name.split('/').pop() || entry.name;
    if (innerName.startsWith('~$')) continue;
    const ext = extOf(innerName);
    if (!SUPPORTED.has(ext) || ext === 'zip') continue;
    cases.push({
      source: entry.name,
      fileName: innerName,
      size: 0,
      kind: 'zip-entry',
      zipPath: file.source,
    });
  }
  return cases;
}

async function readCaseText(testCase: StressCase): Promise<string> {
  const ext = extOf(testCase.fileName);
  if (testCase.kind === 'zip-entry') {
    if (!testCase.zipPath) throw new Error('Zip entry missing zipPath');
    const zip = await JSZip.loadAsync(fs.readFileSync(testCase.zipPath));
    const entry = zip.file(testCase.source);
    if (!entry) throw new Error(`Zip entry not found: ${testCase.source}`);
    if (BINARY_TEXT_EXTS.has(ext)) {
      const blob = await entry.async('blob');
      return extractFileText(new File([blob], testCase.fileName));
    }
    return entry.async('text');
  }

  if (BINARY_TEXT_EXTS.has(ext)) {
    return extractFileText(new File([fs.readFileSync(testCase.source)], testCase.fileName));
  }
  return fs.readFileSync(testCase.source, 'utf8');
}

describe.skipIf(!HAS_STRESS_CORPUS)('import stress report', () => {
  it('parses the selected real files and zip entries and writes a report', async () => {
    const directFiles = ROOTS.flatMap(collectFiles);
    const expanded: StressCase[] = [];
    for (const file of directFiles) {
      if (extOf(file.fileName) === 'zip') {
        expanded.push(...await expandZip(file));
      } else {
        expanded.push(file);
      }
    }

    const seen = new Set<string>();
    const cases = expanded.filter((item) => {
      const key = `${item.kind}:${item.zipPath || ''}:${item.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const results: CaseResult[] = [];
    for (const testCase of cases) {
      const started = Date.now();
      try {
        const text = await readCaseText(testCase);
        const envelope = buildEnvelopeFromRaw(testCase.fileName, text);
        results.push({
          ...testCase,
          detectedType: envelope.source.detectedType,
          parserProfile: envelope.source.parserProfile,
          diaryEntries: envelope.diaryEntries?.length || 0,
          weekEntries: envelope.weekSummary?.totalEntries || 0,
          clientCandidates: envelope.clientCandidates?.length || 0,
          supportNeeds: envelope.supportPlan?.needs?.length || 0,
          warnings: envelope.warnings,
          textLength: text.length,
          ms: Date.now() - started,
        });
      } catch (error) {
        results.push({
          ...testCase,
          error: error instanceof Error ? error.message : String(error),
          ms: Date.now() - started,
        });
      }
    }

    const typeCounts = results.reduce<Record<string, number>>((acc, item) => {
      const key = item.error ? 'error' : item.detectedType || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const totals = {
      roots: ROOTS.filter((root) => fs.existsSync(root)).length,
      cases: results.length,
      failures: results.filter((item) => item.error).length,
      diaryEntries: results.reduce((sum, item) => sum + (item.diaryEntries || 0), 0),
      weekEntries: results.reduce((sum, item) => sum + (item.weekEntries || 0), 0),
      clientCandidates: results.reduce((sum, item) => sum + (item.clientCandidates || 0), 0),
      supportNeeds: results.reduce((sum, item) => sum + (item.supportNeeds || 0), 0),
      typeCounts,
      slowest: [...results].sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, 10),
      largestText: [...results].sort((a, b) => (b.textLength || 0) - (a.textLength || 0)).slice(0, 10),
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), totals, results }, null, 2));

     
    console.log('[import stress report]', totals);

    expect(results.length).toBeGreaterThan(0);
    expect(totals.failures).toBe(0);
    expect(totals.diaryEntries + totals.weekEntries).toBeGreaterThan(0);
  }, 180000);
});
