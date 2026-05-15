import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractFileText } from './universal-extractor';
import { buildEnvelopeFromRaw } from './import-profiles';

const CAREPLAN_PDF = 'C:\\Users\\brook\\Downloads\\type of datasets extracts from careplanner or similar\\LJohnson CAREPLAN.pdf';
const SUPPORT_PLAN_PDF = 'C:\\Users\\brook\\Downloads\\support plan BCC.pdf';
const WAYNE_EMERGENCY_PDF = 'C:\\Users\\brook\\Downloads\\emergency-admission-pack-wayne-jefferson_15052026_1157.pdf';

async function parsePdf(filePath: string) {
  const bytes = fs.readFileSync(filePath);
  const file = new File([bytes], path.basename(filePath), { type: 'application/pdf' });
  const text = await extractFileText(file);
  const envelope = buildEnvelopeFromRaw(file.name, text);
  return { text, envelope };
}

describe('real PDF import smoke parse', () => {
  it('parses LJohnson CAREPLAN.pdf as admission data', async () => {
    if (!fs.existsSync(CAREPLAN_PDF)) return;
    const { text, envelope } = await parsePdf(CAREPLAN_PDF);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(envelope.source.detectedType).toBe('admission');
  });

  it('parses support plan BCC.pdf as support-plan data', async () => {
    if (!fs.existsSync(SUPPORT_PLAN_PDF)) return;
    const { text, envelope } = await parsePdf(SUPPORT_PLAN_PDF);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(envelope.source.detectedType).toBe('support-plan');
  });

  it('parses Wayne emergency admission PDF without using Hazel Care as the client name', async () => {
    if (!fs.existsSync(WAYNE_EMERGENCY_PDF)) return;
    const { text, envelope } = await parsePdf(WAYNE_EMERGENCY_PDF);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(envelope.source.detectedType).toBe('admission');
    expect(envelope.clientCandidates[0]?.name).toBe('Wayne Jefferson');
    expect(envelope.clientCandidates[0]?.dob).toBe('26/09/1983');
    expect(envelope.clientCandidates[0]?.nhs).toBe('4906744699');
    expect(envelope.clientCandidates[0]?.name).not.toMatch(/Hazel Care/i);
  });
});
