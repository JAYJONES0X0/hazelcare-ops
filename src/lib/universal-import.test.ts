import { describe, expect, it } from 'vitest';
import { parseSupportPlanText, parseUniversalText } from './universal-import';

describe('parseUniversalText', () => {
  it('extracts client name from rendered export text using "Prepared for"', () => {
    const raw = `
HAZEL CARE CONFIDENTIAL
OPERATIONS
Clinical Risk Assessment
Prepared for Mr Wayne Jefferson (1:1) | FULL NAME KEY WORKER
DATE OF BIRTH PLAN DATE
26/09/1983 14/05/2026
`;

    const parsed = parseUniversalText(raw);
    expect(parsed.client.name).toBe('Mr Wayne Jefferson');
    expect(parsed.client.preferredName).toBe('Wayne');
  });

  it('parses standalone clinical risk assessments into risk items', () => {
    const raw = `
HAZEL CARE CONFIDENTIAL Clinical Risk Assessment
Prepared for Mr Wayne Jefferson (1:1)
PLAN DATE 14/05/2026 REVIEW DATE 12/08/2026
Risk Area 1: risk of self-neglect in relation to environmental hygiene
RISK DESCRIPTION
Poor environmental hygiene and contaminated flooring may present safeguarding risk.
TRIGGERS & CONTEXT
- Refusal of support
- Cluttered living area
PRIMARY CONTROLS
- Follow source plan controls and escalation pathway.
DYNAMIC CONTROLS
- Remain calm and use non-confrontational communication.
CONTINGENCY PLAN
Escalate immediately to senior on-call manager.
REVIEW TRIGGERS
Review after incident, refusal pattern change, or professional update.
Score : 3 ( Likelihood ) x 3 ( Impact ) = 9
`;

    const parsed = parseUniversalText(raw);
    expect(parsed.client.name).toBe('Mr Wayne Jefferson');
    expect(parsed.client.risk?.risks?.some((r) => /self-neglect/i.test(r.title))).toBe(true);
    const item = parsed.client.risk?.risks?.find((r) => /self-neglect/i.test(r.title));
    expect(item?.likelihood).toBe(3);
    expect(item?.impact).toBe(3);
  });

  it('parses council support-plan style need rows', () => {
    const raw = `
Need Description   Need Comment   Outcome Comment
Managing and maintaining nutrition Matthew needs support to plan meals and prepare food safely.
- For Matthew to continue to be provided with opportunities to participate in meal preparation.
Maintaining personal hygiene Matthew requires prompts to carry out personal care tasks.
- For Matthew to continue to receive sensitive support around personal care routine.
Services Brokerage To Source
`;

    const parsed = parseSupportPlanText(raw);
    expect(parsed.needs.length).toBeGreaterThan(0);
    expect(parsed.needs.some((n) => /nutrition/i.test(n.area))).toBe(true);
  });

  it('parses PBS section layout into support-plan needs', () => {
    const raw = `
Positive Behaviour Support Plan
Service User Name Jamie Morton Date of Birth 08/08/2006
Section 4 - Proactive Strategies
4.1 Environmental Strategies Maintain a calm, predictable home environment. Ensure bedroom privacy.
4.2 Routine and Structure Give 15-minute and 5-minute warnings before gaming ends.
4.3 Relationship-Based Strategies Give choices and validate feelings.
4.4 Communication Strategies Speak calmly and use short clear instructions.
Section 5 - Early Warning Signs Voice raising or becoming sharper. Agitated or pacing.
Section 6 - Reactive Strategies Step 1 Remain Calm. Step 2 Create Space. Step 3 Reduce Demands.
Section 7 - Post-Incident Support Check in once calm. Debrief and agree coping strategy.
Section 8 - What Works / What Does Not Work
What Works Calm voice and space.
What Does NOT Work Raising voices and crowding.
`;

    const parsed = parseSupportPlanText(raw);
    expect(parsed.needs.length).toBeGreaterThanOrEqual(3);
    expect(parsed.needs.some((n) => /Proactive Strategies/i.test(n.area))).toBe(true);
    expect(parsed.needs.some((n) => /Reactive Response/i.test(n.area))).toBe(true);
  });

  it('parses care-act needs reassessment sections into support needs', () => {
    const raw = `
Person Name: Lewis Johnson Person ID: 1554538 Adult - Needs Re-Assessment
Outcomes - Managing Nutrition
Lewis needs support with weekly meal planning and batch cooking.
Desired outcome/what does the person want to achieve?
Lewis requires support to maintain a healthy balanced diet and managing his hernia issues.
Outcomes - Personal Care
Maintaining Personal Hygiene
Lewis needs prompting with personal care and support with laundry.
Desired outcome/what does the person want to achieve?
Lewis needs support to maintain a good standard of hygiene and dignity.
Outcomes - Practical Aspects of Daily Living
Maintaining a Habitable Home Environment
Lewis requires prompting and support with domestic tasks and budgeting.
Desired outcome/what does the person want to achieve?
Lewis requires support managing aspects of his financial affairs to avoid debt.
Assessment Summary and Personal Outcomes
`;

    const parsed = parseSupportPlanText(raw);
    expect(parsed.needs.length).toBeGreaterThanOrEqual(3);
    expect(parsed.needs.some((n) => /nutrition/i.test(n.area))).toBe(true);
    expect(parsed.needs.some((n) => /personal hygiene/i.test(n.area))).toBe(true);
    expect(parsed.needs.some((n) => /habitable home environment/i.test(n.area))).toBe(true);
  });

  it('parses adult needs re-assessment exports into care domains and risks', () => {
    const raw = `
Person Name: Lewis Johnson Person ID: 1554538 Adult - Needs Re-Assessment
Background Information
What others would need to know about me
Lewis has capacity to make wise and unwise choices. He can place himself in vulnerable positions by sharing financial details and this has been reported to safeguarding.
Medical history
Autism, depression/anxiety, obsessive compulsive disorder and physical health needs.
Outcomes - Managing Nutrition
Lewis needs support to maintain a healthy balanced diet and managing his hernia issues.
Desired outcome/what does the person want to achieve?
Lewis requires support to maintain a healthy balanced diet and managing his hernia issues.
Outcomes - Personal Care
Maintaining Personal Hygiene
Lewis needs prompting with personal care and support with laundry.
Desired outcome/what does the person want to achieve?
Lewis needs support to maintain a good standard of hygiene and dignity.
Managing Toileting Needs (using the toilet)
Lewis remains independent with managing his toileting needs.
Dressing/Undressing (being appropriately clothed)
Lewis needs support to wear clean and appropriate clothing.
Outcomes - Practical Aspects of Daily Living
Maintaining a Habitable Home Environment
Lewis requires prompting and support to complete domestic tasks and keep his room clean, safe and habitable.
Moving around and staying comfortable
Lewis advises his lung capacity is at 85%, gets out of breathe easily and struggles to complete tasks.
Getting out and about
Lewis needs support to access the community for shopping and clothes shopping as required.
Maintaining Family Relationships
Lewis feels his partner Eric being in his life is positive.
Managing Finances
Lewis manages his finances independently but has difficulty to budget and is concerned about debt.
Assessment Summary and Personal Outcomes
Risk Assessments
Is the Adult at risk of exploitation?
Yes
Coercion in relation to financial affairs or scamming?
Evidence/comments
Risks - emotional wellbeing
Support around relationships
Case Progression Meeting
Worker Recommendation
`;

    const parsed = parseUniversalText(raw);
    const enabled = parsed.carePlan.domains.filter((d) => d.enabled);
    expect(enabled.length).toBeGreaterThanOrEqual(5);
    expect(enabled.some((d) => /nutrition/i.test(d.title))).toBe(true);
    expect(enabled.some((d) => /financial management/i.test(d.title))).toBe(true);
    expect(parsed.client.supportPlan?.needs.length).toBeGreaterThan(0);
    expect(parsed.client.risk?.risks.length).toBeGreaterThan(1);
    expect(parsed.client.risk?.risks.some((r) => /safeguarding|exploitation/i.test(r.title))).toBe(true);
  });
});
