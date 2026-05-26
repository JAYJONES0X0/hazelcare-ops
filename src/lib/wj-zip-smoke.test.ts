import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildEnvelopeFromRaw } from './import-profiles';
import { extractFileText } from './universal-extractor';

const WJ_ZIP = 'C:\\Users\\brook\\Downloads\\WJ.zip';
const SUPPORTED = new Set(['txt', 'csv', 'tsv', 'md', 'pdf', 'docx', 'xlsx', 'xls', 'xlsm']);

function extOf(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

describe('WJ zip smoke parse', () => {
  it('opens the real WJ.zip and classifies every supported inner file without throwing', async () => {
    if (!fs.existsSync(WJ_ZIP)) return;

    const zip = await JSZip.loadAsync(fs.readFileSync(WJ_ZIP));
    const supported = Object.values(zip.files).filter(entry => !entry.dir && SUPPORTED.has(extOf(entry.name)));
    expect(supported.length).toBeGreaterThan(0);

    const failures: Array<{ fileName: string; error: string }> = [];
    const typeCounts: Record<string, number> = {};

    for (const entry of supported) {
      const fileName = path.basename(entry.name);
      const ext = extOf(fileName);
      try {
        const text = ['pdf', 'docx', 'xlsx', 'xls', 'xlsm'].includes(ext)
          ? await extractFileText(new File([await entry.async('blob')], fileName))
          : await entry.async('text');
        const envelope = buildEnvelopeFromRaw(fileName, text);
        typeCounts[envelope.source.detectedType] = (typeCounts[envelope.source.detectedType] || 0) + 1;
      } catch (error) {
        failures.push({ fileName, error: error instanceof Error ? error.message : String(error) });
      }
    }

    expect(failures).toEqual([]);
     
    console.log('[WJ zip smoke]', { files: supported.length, types: typeCounts });
  }, 60000);
});
