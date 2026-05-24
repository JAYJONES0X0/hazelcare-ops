import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildEnvelopeFromRaw } from './import-profiles';
import { extractFileText } from './universal-extractor';

const CORPUS_DIR = 'C:\\Users\\brook\\Downloads\\type of datasets extracts from careplanner or similar';
const ZIP_PATH = path.join(CORPUS_DIR, 'hazelcare-limited-build-pack.zip');

type CorpusCase = {
  fileName: string;
  text: string;
  kind: 'file' | 'zip-entry';
};

type CorpusFailure = {
  fileName: string;
  kind: 'file' | 'zip-entry';
  error: string;
};

function supportedExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

async function extractCorpusCases(): Promise<{ cases: CorpusCase[]; failures: CorpusFailure[] }> {
  const cases: CorpusCase[] = [];
  const failures: CorpusFailure[] = [];
  const files = fs.readdirSync(CORPUS_DIR, { withFileTypes: true });

  for (const entry of files) {
    if (!entry.isFile()) continue;
    const filePath = path.join(CORPUS_DIR, entry.name);
    const ext = supportedExt(entry.name);

    if (ext === 'zip') {
      const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
      for (const zipEntry of Object.values(zip.files)) {
        if (zipEntry.dir) continue;
        const innerName = zipEntry.name.split('/').pop() || zipEntry.name;
        const innerExt = supportedExt(innerName);
        if (!['txt', 'csv', 'tsv', 'md', 'pdf', 'docx'].includes(innerExt)) continue;

        try {
          let text = '';
          if (innerExt === 'pdf' || innerExt === 'docx') {
            const blob = await zipEntry.async('blob');
            text = await extractFileText(new File([blob], innerName));
          } else {
            text = await zipEntry.async('text');
          }

          cases.push({
            fileName: `${entry.name}::${innerName}`,
            text,
            kind: 'zip-entry',
          });
        } catch (error: any) {
          failures.push({
            fileName: `${entry.name}::${innerName}`,
            kind: 'zip-entry',
            error: error?.message || String(error),
          });
        }
      }
      continue;
    }

    if (!['txt', 'csv', 'tsv', 'md', 'pdf', 'docx', 'xlsx', 'xls', 'xlsm'].includes(ext)) continue;

    try {
      const text = ext === 'pdf' || ext === 'docx' || ext === 'xlsx' || ext === 'xls' || ext === 'xlsm'
        ? await extractFileText(new File([fs.readFileSync(filePath)], entry.name))
        : fs.readFileSync(filePath, 'utf8');

      cases.push({
        fileName: entry.name,
        text,
        kind: 'file',
      });
    } catch (error: any) {
      failures.push({
        fileName: entry.name,
        kind: 'file',
        error: error?.message || String(error),
      });
    }
  }

  return { cases, failures };
}

describe('stress corpus import audit', () => {
  it('classifies the real folder corpus and zip entries without breaking core cases', async () => {
    if (!fs.existsSync(CORPUS_DIR)) return;
    expect(fs.existsSync(ZIP_PATH)).toBe(true);

    const { cases, failures } = await extractCorpusCases();
    expect(cases.length).toBeGreaterThan(0);
    expect(failures).toEqual([]);

    const envelopes = cases.map((item) => ({
      ...item,
      envelope: buildEnvelopeFromRaw(item.fileName, item.text),
    }));

    const typeCounts = envelopes.reduce<Record<string, number>>((acc, item) => {
      const key = item.envelope.source.detectedType;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // Keep these spot checks tight so we catch regressions in the actual examples.
    const byName = (name: string) => envelopes.find((item) => item.fileName === name);

    expect(byName('LJohnson CAREPLAN.pdf')?.envelope.source.detectedType).toBe('admission');
    expect(byName('Hazel Care Ltd SUPPORT PLAN.pdf')?.envelope.source.detectedType).toBe('support-plan');
    expect(byName('My support plan JW.docx')?.envelope.source.detectedType).toBe('support-plan');
    expect(byName('Risk compatibility assessment LJ.pdf')?.envelope.source.detectedType).toBe('admission');
    expect(byName('Quality Performance Meeting .docx')?.envelope.source.detectedType).toBe('unknown');
    expect(byName('hazelcare-limited-build-pack.zip::brief.md')?.envelope.source.detectedType).toBe('unknown');
    expect(byName('hazelcare-limited-build-pack.zip::CLAUDE.md')?.envelope.source.detectedType).toBe('unknown');

    const supportPlanIssues = envelopes.filter(
      (item) => item.envelope.source.detectedType === 'support-plan' && (item.envelope.supportPlan?.needs?.length || 0) === 0
    );
    expect(supportPlanIssues).toEqual([]);

    // Print a compact summary for manual inspection during the stress run.
    // This is useful when the corpus changes and a new file starts classifying oddly.
     
    console.log('[stress corpus] cases=', cases.length, 'types=', typeCounts);
  }, 120000);
});
