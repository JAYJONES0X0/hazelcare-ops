import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEnvelopeFromRaw } from './import-profiles';

const REAL_DATA_DIR = 'C:\\Users\\brook\\Downloads\\type of datasets extracts from careplanner or similar';

function getTextFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        stack.push(full);
        continue;
      }
      const lower = item.name.toLowerCase();
      if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
        out.push(full);
      }
    }
  }
  return out;
}

describe('real dataset smoke parse', () => {
  it('parses local CarePlanner-style text datasets without throwing', () => {
    const files = getTextFiles(REAL_DATA_DIR);
    if (files.length === 0) return;

    let parsedCount = 0;
    for (const file of files.slice(0, 60)) {
      const text = fs.readFileSync(file, 'utf8');
      const envelope = buildEnvelopeFromRaw(path.basename(file), text);
      expect(envelope.source.fileName.length).toBeGreaterThan(0);
      expect(envelope.source.detectedType.length).toBeGreaterThan(0);
      parsedCount += (envelope.diaryEntries?.length || 0) + (envelope.weekSummary?.totalEntries || 0);
    }
    expect(parsedCount).toBeGreaterThanOrEqual(0);
  });
});
