import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyClient } from './client-store';
import { extractFileText } from './universal-extractor';
import { applyIntelToClient, buildIntelSessionFromRaw } from './client-docs-intelligence';

const LM_SUPPORT_PLAN_PDF = 'C:\\Users\\brook\\Downloads\\345683 LM Support Plan.pdf';
const LM_EMERGENCY_ADMISSION_PDF = 'C:\\Users\\brook\\Downloads\\emergency-admission-pack-livingstone-mcfie-1-1_27052026_1426.pdf';
const BCC_SUPPORT_PLAN_PDF = 'C:\\Users\\brook\\Downloads\\BCClplan.pdf';
const PASTED_BCC_TEXT = 'C:\\Users\\brook\\.codex\\attachments\\6989aa1c-b09f-42f3-9e3c-86aac8f05082\\pasted-text.txt';

async function extractPdf(filePath: string) {
  const bytes = fs.readFileSync(filePath);
  const file = new File([bytes], path.basename(filePath), { type: 'application/pdf' });
  const text = await extractFileText(file);
  return { fileName: file.name, text };
}

describe('client document intelligence import', () => {
  it('maps the council LM support plan as support-plan areas, not zero CQC domains', async () => {
    if (!fs.existsSync(LM_SUPPORT_PLAN_PDF)) return;

    const { fileName, text } = await extractPdf(LM_SUPPORT_PLAN_PDF);
    const session = buildIntelSessionFromRaw(fileName, text);

    expect(session.summary.kind).toBe('support-plan');
    expect(session.summary.countLabel).toBe('Support Plan Areas');
    expect(session.summary.count).toBeGreaterThan(0);
    expect(session.result.client.name).toMatch(/Livingstone Mcfie/i);
    expect(session.result.client.supportPlan?.needs.length).toBeGreaterThan(0);
  });

  it('commits support-plan needs into the selected profile', async () => {
    if (!fs.existsSync(LM_SUPPORT_PLAN_PDF)) return;

    const { fileName, text } = await extractPdf(LM_SUPPORT_PLAN_PDF);
    const session = buildIntelSessionFromRaw(fileName, text);
    const client = emptyClient();
    client.name = 'Livingstone Mcfie';

    const updated = applyIntelToClient(client, session.result, '27/05/2026');

    expect(updated.supportPlan?.needs.length).toBeGreaterThan(0);
    expect(updated.name).toMatch(/Livingstone Mcfie/i);
  });

  it('auto-builds safe derived documents when committing support-plan evidence', () => {
    if (!fs.existsSync(PASTED_BCC_TEXT)) return;

    const text = fs.readFileSync(PASTED_BCC_TEXT, 'utf8');
    const session = buildIntelSessionFromRaw('pasted-text.txt', text);
    const client = emptyClient();
    const updated = applyIntelToClient(client, session.result, '01/06/2026');

    expect(updated.supportPlan?.needs.length).toBeGreaterThan(3);
    expect(updated.risk?.risks.map((risk) => risk.title)).toEqual(
      expect.arrayContaining(['Behaviour Issues', 'Self Neglect', 'Risk to others'])
    );
    expect(updated.carePlan?.domains.filter((domain) => domain.enabled).length).toBeGreaterThan(0);
    expect(updated.pbs?.aboutText).toBeTruthy();
    expect(updated.pbs?.routineStrategies.some((strategy) => strategy.trim())).toBe(true);
  });

  it('reports import status so users know what was detected, built, missing, and recommended', () => {
    if (!fs.existsSync(PASTED_BCC_TEXT)) return;

    const text = fs.readFileSync(PASTED_BCC_TEXT, 'utf8');
    const session = buildIntelSessionFromRaw('pasted-text.txt', text);

    expect(session.status.documentType).toBe('support-plan');
    expect(session.status.confidence).toBe('high');
    expect(session.status.personMatch).toMatch(/Ryan Shade/i);
    expect(session.status.canBuild).toEqual(expect.arrayContaining(['Risk', 'Care Plan', 'PBS']));
    expect(session.status.recommendedAction).toMatch(/commit/i);
    expect(session.status.missing.length).toBeGreaterThan(0);
  });

  it('maps the BCC support-plan header identity as well as support areas', async () => {
    if (!fs.existsSync(BCC_SUPPORT_PLAN_PDF)) return;

    const { fileName, text } = await extractPdf(BCC_SUPPORT_PLAN_PDF);
    const session = buildIntelSessionFromRaw(fileName, text);

    expect(session.summary.kind).toBe('support-plan');
    expect(session.summary.count).toBeGreaterThan(0);
    expect(session.result.client.name).toBe('RYAN SHADE');
    expect(session.result.client.preferredName).toBe('RYAN');
    expect(session.result.client.dob).toBe('16/03/1971');
    expect(session.result.client.phone).toBe('07526170380');
  });

  it('maps pasted BCC support-plan text without relying on the PDF filename', () => {
    if (!fs.existsSync(PASTED_BCC_TEXT)) return;

    const text = fs.readFileSync(PASTED_BCC_TEXT, 'utf8');
    const session = buildIntelSessionFromRaw('pasted-text.txt', text);

    expect(session.summary.kind).toBe('support-plan');
    expect(session.result.client.name).toBe('RYAN SHADE');
    expect(session.result.client.dob).toBe('16/03/1971');
    expect(session.result.client.supportPlan?.needs.length).toBeGreaterThan(3);
    expect(session.result.risk.risks.map((risk) => risk.title)).toEqual(
      expect.arrayContaining(['Behaviour Issues', 'Self Neglect', 'Risk to others'])
    );
  });

  it('keeps emergency admission packs on the 21-domain admission path', async () => {
    if (!fs.existsSync(LM_EMERGENCY_ADMISSION_PDF)) return;

    const { fileName, text } = await extractPdf(LM_EMERGENCY_ADMISSION_PDF);
    const session = buildIntelSessionFromRaw(fileName, text);

    expect(session.summary.kind).toBe('admission');
    expect(session.summary.countLabel).toBe('CQC Domains');
    expect(session.result.client.name).toMatch(/Livingstone Mcfie/i);
    expect(session.result.carePlan.domains.filter((domain) => domain.enabled).length).toBeGreaterThan(0);
  });
});
