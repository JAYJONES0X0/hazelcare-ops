import { describe, expect, it } from 'vitest';
import { buildEnvelopeFromRaw, detectProfile } from './import-profiles';

describe('detectProfile', () => {
  it('detects council support plan PDFs by filename', () => {
    const result = detectProfile('support plan BCC.pdf', 'Person ID Full name ...');
    expect(result.type).toBe('support-plan');
  });

  it('detects careplan PDFs by filename', () => {
    const result = detectProfile('LJohnson CAREPLAN.pdf', '');
    expect(result.type).toBe('admission');
    expect(result.id).toBe('careplan-filename');
  });

  it('prioritizes admission parsing over generic support-plan phrases for careplan PDFs', () => {
    const raw = 'Emergency Admission Pack - Lewis Johnson ... support plan ... report run on 15/05/2026';
    const result = detectProfile('LJohnson CAREPLAN.pdf', raw);
    expect(result.type).toBe('admission');
  });

  it('detects clinical risk assessment PDFs by content', () => {
    const text = 'Clinical Risk Assessment Prepared for Mr X Risk Area 1: Falls risk RISK CONTROL PROTOCOL';
    const result = detectProfile('export.pdf', text);
    expect(result.type).toBe('admission');
    expect(result.id).toBe('risk-assessment-pdf');
  });

  it('extracts candidate name from PBS support plan header', () => {
    const raw = 'Positive Behaviour Support Plan Service User Name Jamie Morton Date of Birth 08/08/2006 NHS No. 648 235 9604';
    const env = buildEnvelopeFromRaw('Jamie Morton - PBS Plan.pdf', raw);
    expect(env.source.detectedType).toBe('support-plan');
    expect(env.clientCandidates[0]?.name).toBe('Jamie Morton');
  });

  it('detects care act needs reassessment text as support-plan', () => {
    const raw = `
Person Name: Lewis Johnson Person ID: 1554538 Adult - Needs Re-Assessment
Assessment Summary and Personal Outcomes
Care Act Domain
Managing and maintaining nutrition
Condition 1 Condition 2 Condition 3
`;
    const env = buildEnvelopeFromRaw('lewis-needs-reassessment.txt', raw);
    expect(env.source.detectedType).toBe('support-plan');
    expect(env.source.parserProfile).toBe('care-act-needs-reassessment');
    expect(env.clientCandidates[0]?.name).toBe('Lewis Johnson');
  });

  it('routes compatibility risk assessments to admission/risk parsing', () => {
    const raw = 'Risk Compatibility Assessment Prepared for Mr Lewis Johnson Clinical Risk Assessment Risk Area 1: self-neglect RISK CONTROL PROTOCOL';
    const result = detectProfile('compatibility risk asses - Nourish Care.pdf', raw);
    expect(result.type).toBe('admission');
  });
});
