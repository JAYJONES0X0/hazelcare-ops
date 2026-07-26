// ============================================================
// HAZEL CARE UNIVERSAL IMPORT — Intelligent Data Mapping
// ============================================================
import type { FullClient, CarePlanData, CarePlanDomain, SupportPlanData, SupportPlanNeed, RiskData, RiskItem } from './client-store';
import { emptyCarePlan, emptyRisk, emptyRisk_item, CARE_PLAN_DOMAINS } from './client-store';

// Maps legacy industry jargon to Premium OVSITE Domains
const DOMAIN_MAP: Record<string, string> = {
  'ACCOMMODATION CLEANLINESS': 'Environment & Physical Safety',
  'BREATHING': 'Respiratory Health & Support',
  'COMMUNICATION AND SENSES': 'Communication & Sensory Integration',
  'COMPANIONSHIP, SOCIAL INTERACTION AND RECREATION': 'Social Engagement & Relationships',
  'DAILY ROUTINE': 'Life Skills & Daily Routine',
  'EATING AND DRINKING': 'Nutrition, Hydration & Diet',
  'ELIMINATION': 'Continence & Personal Hygiene',
  'ENVIRONMENT': 'Adaptive Living Environment',
  'EQUALITY, DIVERSITY AND INCLUSION': 'Rights, Choice & Inclusion',
  'EXPRESSING SEXUALITY': 'Intimacy & Personal Expression',
  'FINANCIAL': 'Financial Management & Autonomy',
  'HEALTH AND WELLBEING': 'Holistic Health & Vitality',
  'INFECTION PREVENTION AND CONTROL': 'Infection Control & Public Health',
  'MEDICATION': 'Medication Management & Safety',
  'MENTAL HEALTH AND COGNITION': 'Mental Health & Emotional Wellbeing',
  'MOBILITY': 'Mobility, Movement & Exercise',
  'PAIN': 'Pain Management & Comfort',
  'PERSONAL CARE AND DRESSING': 'Personal Care & Physical Presentation',
  'SKIN INTEGRITY': 'Skin Integrity & Pressure Care',
  'SLEEPING': 'Rest & Sleep Patterns',
  'SPIRITUALITY, RELIGION AND CULTURE': 'Cultural, Spiritual & Personal Beliefs',
};

const LEVEL_MAP: Record<string, number> = {
  '0 - independent': 0,
  '1 - low need': 1,
  '2 - moderate need': 2,
  '3 - substantial need': 3,
  '4 - high need': 4,
};

function extractBetween(text: string, start: string, ends: string[]): string {
  const startIdx = text.indexOf(start);
  if (startIdx === -1) return '';
  const after = text.slice(startIdx + start.length);
  let endIdx = after.length;
  for (const end of ends) {
    const idx = after.indexOf(end);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  return after.slice(0, endIdx).trim();
}

function extractField(section: string, field: string, nextFields: string[]): string {
  const lower = section.toLowerCase();
  const fieldLower = field.toLowerCase();
  const idx = lower.indexOf(fieldLower);
  if (idx === -1) return '';
  const after = section.slice(idx + field.length);
  let endIdx = after.length;
  for (const nf of nextFields) {
    const nfIdx = after.toLowerCase().indexOf(nf.toLowerCase());
    if (nfIdx !== -1 && nfIdx < endIdx) endIdx = nfIdx;
  }
  return after.slice(0, endIdx).trim();
}

function parseLikelihood(text: string): number {
  const lower = text.toLowerCase();
  if (lower.includes('very low')) return 1;
  if (lower.includes('very high')) return 5;
  if (lower.includes('low')) return 2;
  if (lower.includes('medium') || lower.includes('moderate')) return 3;
  if (lower.includes('high')) return 4;
  return 1;
}

function parseImpact(text: string): number {
  const lower = text.toLowerCase();
  if (lower.includes('insignificant')) return 1;
  if (lower.includes('tolerat')) return 2;
  if (lower.includes('undesirable')) return 3;
  if (lower.includes('major') || lower.includes('severe')) return 4;
  if (lower.includes('catastroph')) return 5;
  return 1;
}

function clampRiskScore(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(5, Math.max(1, Math.round(v)));
}

function parseNumericTriplet(section: string): { likelihood: number; impact: number; total: number } | null {
  const matches = [...section.matchAll(/(\d)\s+(\d)\s+(\d)(?!\d)/g)];
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const m = matches[i];
    const l = Number(m[1]);
    const impact = Number(m[2]);
    const total = Number(m[3]);
    if (l >= 1 && l <= 5 && impact >= 1 && impact <= 5 && total >= 1 && total <= 25) {
      return { likelihood: l, impact, total };
    }
  }
  return null;
}

function splitSectionLines(input: string): string[] {
  return input
    .split('\n')
    .map((l) => l.replaceAll('\0', '').trim())
    .filter(Boolean);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function parseRiskItemsFromNotes(text: string): RiskItem[] {
  const noteChunks = text.split(/\nNOTE\s+/i);
  const risks: RiskItem[] = [];
  for (const chunk of noteChunks) {
    if (!/risk assessment/i.test(chunk) && !/RISK:/i.test(chunk)) continue;
    const riskTitleMatch = chunk.match(/RISK:\s*([^\n]+)/i);
    const fallbackTitleMatch = chunk.match(/Risk of\s+([^\n]+)/i);
    const title = (riskTitleMatch?.[1] || fallbackTitleMatch?.[0] || '').trim();
    if (!title) continue;

    const lines = splitSectionLines(chunk);
    const summaryLines: string[] = [];
    const triggerLines: string[] = [];
    const controlLines: string[] = [];

    let active: 'summary' | 'triggers' | 'controls' | null = null;
    for (const line of lines) {
      if (/Risk Summary:/i.test(line)) {
        active = 'summary';
        continue;
      }
      if (/Triggers\s*&\s*Warning Signs:/i.test(line)) {
        active = 'triggers';
        continue;
      }
      if (/Staff Management Actions:/i.test(line)) {
        active = 'controls';
        continue;
      }
      if (/Consent\s*\/\s*Mental Capacity:/i.test(line) || /Linked Documents/i.test(line) || /Fluctuating Risk/i.test(line)) {
        active = null;
        continue;
      }
      if (/Risk Level/i.test(line) || /Score:\s*\d+/i.test(line)) continue;
      if (active === 'summary') summaryLines.push(line);
      if (active === 'triggers') triggerLines.push(line);
      if (active === 'controls') controlLines.push(line);
    }

    const levelMatch = chunk.match(/Likelihood is\s+([a-z]+).*?Impact is\s+([a-z]+)/is);
    const scoreMatch = chunk.match(/Score:\s*(\d{1,2})/i);
    let likelihood = levelMatch ? parseLikelihood(levelMatch[1]) : 3;
    let impact = levelMatch ? parseImpact(levelMatch[2]) : 3;
    const score = scoreMatch ? Number(scoreMatch[1]) : null;
    if ((!levelMatch || (likelihood === 1 && impact === 1)) && score && score > 0) {
      const approx = Math.sqrt(score);
      likelihood = clampRiskScore(approx);
      impact = clampRiskScore(score / likelihood);
    }

    const allTriggerLines = dedupe(triggerLines);
    const earlyWarnings = allTriggerLines.filter((t) => /warning|sign|pacing|muttering|refusal|hostility|agitation|shouting|clenched/i.test(t));
    const triggers = allTriggerLines.filter((t) => !earlyWarnings.includes(t));

    risks.push({
      ...emptyRisk_item(),
      title,
      description: dedupe(summaryLines).join(' ').slice(0, 1200),
      triggers: triggers.length ? triggers : ['See source risk note for triggers.'],
      earlyWarnings: earlyWarnings.length ? earlyWarnings : ['See source risk note for warning signs.'],
      controls: dedupe(controlLines).length ? dedupe(controlLines) : ['Follow source plan controls and escalation pathway.'],
      likelihood: clampRiskScore(likelihood),
      impact: clampRiskScore(impact),
      reviewTrigger: 'Review after incident, refusal pattern change, or professional update.',
    });
  }
  return risks;
}

function buildRiskFromCarePlan(text: string, carePlan: CarePlanData): RiskData {
  const risk = emptyRisk(new Date().toLocaleDateString('en-GB'));
  const escalation = extractEscalationProcedure(text);
  if (escalation) risk.escalationProcedure = escalation;
  const noteRisks = parseRiskItemsFromNotes(text);
  if (noteRisks.length) {
    risk.risks = noteRisks;
    return risk;
  }

  const domainRisks = carePlan.domains
    .filter((d) => d.enabled && (d.riskTitle || d.identifiedNeed || d.howToAchieve))
    .map((d) => ({
      ...emptyRisk_item(),
      title: d.riskTitle || `Risk linked to ${d.title}`,
      description: d.identifiedNeed || d.plannedOutcomes || 'Risk derived from imported care domain.',
      triggers: d.riskTitle ? [d.riskTitle] : ['See care plan domain notes.'],
      earlyWarnings: ['Changes in mood, behaviour, or adherence from baseline.'],
      controls: d.howToAchieve ? [d.howToAchieve] : ['Follow support guidance in care plan.'],
      likelihood: clampRiskScore(d.riskLikelihood || 3),
      impact: clampRiskScore(d.riskImpact || 3),
      reviewTrigger: d.nextReviewDate || 'Review at next scheduled care plan review.',
    }));

  risk.risks = domainRisks.length ? domainRisks : [emptyRisk_item()];
  return risk;
}

function extractEscalationProcedure(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const direct = normalized.match(/(Escalation Policy\s*&?\s*Procedure[\s\S]{0,2200})/i);
  if (direct) {
    return direct[1]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 24)
      .join(' ')
      .slice(0, 1800);
  }
  const policyLike = normalized.match(/(escalat(?:e|ion)[\s\S]{0,900}(?:safeguard|on-?call|manager|999|emergency|incident))/i);
  return policyLike ? policyLike[1].replace(/\s+/g, ' ').trim().slice(0, 900) : '';
}

export interface ParseResult {
  client: Partial<FullClient>;
  carePlan: CarePlanData;
  warnings: string[];
}

function isFlat(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 10 && text.length > 500) return true;
  const avgLen = text.length / Math.max(lines.length, 1);
  return avgLen > 200;
}

function extractFieldSmart(text: string, field: string, nextFields: string[]): string {
  let result = extractField(text, field + '\n', nextFields);
  if (result) return result.split('\n')[0].trim();
  result = extractField(text, field + ' ', nextFields);
  if (result) return result.split(/\s{2,}/)[0].trim();
  result = extractField(text, field, nextFields);
  return result.split('\n')[0].trim();
}

function normalizeSectionText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findFirstRegexIndex(text: string, patterns: RegExp[]): number {
  let best = -1;
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m || m.index === undefined) continue;
    if (best === -1 || m.index < best) best = m.index;
  }
  return best;
}

function extractSectionByMarkers(text: string, startPattern: RegExp, endPatterns: RegExp[]): string {
  const startMatch = text.match(startPattern);
  if (!startMatch || startMatch.index === undefined) return '';
  const from = startMatch.index + startMatch[0].length;
  const tail = text.slice(from);
  const endRel = findFirstRegexIndex(tail, endPatterns);
  return normalizeSectionText(endRel === -1 ? tail : tail.slice(0, endRel));
}

function parseListFromSection(section: string): string[] {
  const normalized = normalizeSectionText(section).replace(/\s+•/g, '\n•');
  return dedupe(
    normalized
      .split(/\n|•/g)
      .map((line) => line.replace(/^[-\u2022]+\s*/, '').trim())
      .filter(Boolean)
  );
}

function parseLikelihoodImpactFromSection(section: string): { likelihood: number; impact: number } {
  const scoreForm = section.match(/Score\s*[:=]?\s*(\d)\s*\(\s*Likelihood\s*\)\s*[x×]\s*(\d)\s*\(\s*Impact\s*\)/i);
  if (scoreForm) {
    return { likelihood: clampRiskScore(Number(scoreForm[1])), impact: clampRiskScore(Number(scoreForm[2])) };
  }

  const alt = section.match(/Likelihood[^0-9]{0,40}(\d)[\s\S]{0,40}Impact[^0-9]{0,40}(\d)/i);
  if (alt) {
    return { likelihood: clampRiskScore(Number(alt[1])), impact: clampRiskScore(Number(alt[2])) };
  }

  const triplet = parseNumericTriplet(section);
  if (triplet) {
    return { likelihood: clampRiskScore(triplet.likelihood), impact: clampRiskScore(triplet.impact) };
  }

  return { likelihood: 3, impact: 3 };
}

function parseRiskItemsFromAssessment(text: string): RiskItem[] {
  const normalized = normalizeSectionText(text);
  const markers = [...normalized.matchAll(/Risk\s*Area\s*(\d+)\s*:/gi)];
  if (!markers.length) return [];

  const out: RiskItem[] = [];
  for (let i = 0; i < markers.length; i += 1) {
    const current = markers[i];
    if (current.index === undefined) continue;
    const start = current.index;
    const end = i + 1 < markers.length && markers[i + 1].index !== undefined
      ? markers[i + 1].index!
      : normalized.length;
    const chunk = normalized.slice(start, end);

    const titleTail = chunk.replace(/^Risk\s*Area\s*\d+\s*:\s*/i, '');
    const title = normalizeSectionText(
      titleTail.split(/(?:RISK\s+DESCRIPTION|SIGNIFICANT\s+RISK|RISK\s+STRATIFICATION|RISK\s+CONTROL\s+PROTOCOL)/i)[0] || ''
    ).slice(0, 180);
    if (!title) continue;

    const description = extractSectionByMarkers(chunk, /RISK\s+DESCRIPTION/i, [
      /TRIGGERS?\s*(?:&|AND)?\s*(?:CONTEXT|WARNING)/i,
      /SECONDARY\s+RISKS/i,
      /RISK\s+STRATIFICATION/i,
      /RISK\s+CONTROL\s+PROTOCOL/i,
    ]).slice(0, 1500);

    const triggersRaw = extractSectionByMarkers(chunk, /TRIGGERS?\s*(?:&|AND)?\s*(?:CONTEXT|WARNING SIGNS?)?/i, [
      /SECONDARY\s+RISKS/i,
      /RISK\s+STRATIFICATION/i,
      /RISK\s+CONTROL\s+PROTOCOL/i,
    ]);
    const secondaryRisk = extractSectionByMarkers(chunk, /SECONDARY\s+RISKS/i, [
      /RISK\s+STRATIFICATION/i,
      /RISK\s+CONTROL\s+PROTOCOL/i,
      /PRIMARY\s+CONTROLS/i,
    ]);
    const controlsRaw = extractSectionByMarkers(chunk, /PRIMARY\s+CONTROLS/i, [
      /DYNAMIC\s+CONTROLS/i,
      /CONTINGENCY\s+PLAN/i,
      /REVIEW\s+TRIGGERS/i,
    ]);
    const dynamicRaw = extractSectionByMarkers(chunk, /DYNAMIC\s+CONTROLS/i, [
      /CONTINGENCY\s+PLAN/i,
      /REVIEW\s+TRIGGERS/i,
      /AFFECTED\s+PEOPLE/i,
    ]);
    const contingencyPlan = extractSectionByMarkers(chunk, /CONTINGENCY\s+PLAN/i, [
      /REVIEW\s+TRIGGERS/i,
      /AFFECTED\s+PEOPLE/i,
      /REGULATORY\s+COMPLIANCE/i,
    ]);
    const reviewTrigger = extractSectionByMarkers(chunk, /REVIEW\s+TRIGGERS/i, [
      /AFFECTED\s+PEOPLE/i,
      /REGULATORY\s+COMPLIANCE/i,
      /SIGNATURES/i,
    ]);
    const affectedRaw = extractSectionByMarkers(chunk, /AFFECTED\s+PEOPLE/i, [
      /REGULATORY\s+COMPLIANCE/i,
      /SIGNATURES/i,
      /Risk\s*Area\s*\d+\s*:/i,
    ]);

    const triggerLines = parseListFromSection(triggersRaw);
    const earlyWarnings = triggerLines.filter((line) => /warning|sign|early|pacing|muttering|refusal|hostility|agitation|shouting|clenched/i.test(line));
    const triggers = triggerLines.filter((line) => !earlyWarnings.includes(line));
    const controls = parseListFromSection(controlsRaw);
    const dynamicControls = parseListFromSection(dynamicRaw);
    const affectedPeople = parseListFromSection(affectedRaw);
    const { likelihood, impact } = parseLikelihoodImpactFromSection(chunk);

    out.push({
      ...emptyRisk_item(),
      title,
      description,
      triggers: triggers.length ? triggers : ['See source risk note for triggers.'],
      earlyWarnings: earlyWarnings.length ? earlyWarnings : ['See source risk note for warning signs.'],
      controls: controls.length ? controls : ['Follow source plan controls and escalation pathway.'],
      dynamicControls: dynamicControls.length ? dynamicControls : emptyRisk_item().dynamicControls,
      secondaryRisk: secondaryRisk || '',
      contingencyPlan: contingencyPlan || '',
      reviewTrigger: reviewTrigger || 'Review after incident, refusal pattern change, or professional update.',
      affectedPeople: affectedPeople.length ? affectedPeople : emptyRisk_item().affectedPeople,
      likelihood,
      impact,
    });
  }
  return out;
}

function parseRiskAssessmentReport(text: string): ParseResult {
  const normalized = normalizeSectionText(text);
  const warnings: string[] = [];
  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  const planDate = (normalized.match(/PLAN\s*DATE\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || today).trim();
  const parsedReviewDate = (normalized.match(/REVIEW\s*DATE\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || reviewDate).trim();
  const name = extractPreparedForName(normalized);
  const preferredName = preferredFromName(name);
  const dob = (normalized.match(/DATE\s*OF\s*BIRTH[^0-9]{0,20}(\d{2}\/\d{2}\/\d{4})/i)?.[1] || '').trim();
  const keyWorkerRaw = extractSectionByMarkers(normalized, /KEY\s*WORKER/i, [/PLAN\s*DATE/i, /REVIEW\s*DATE/i]).split(/\n/)[0] || '';
  const keyWorker = /^[-–—\s]*$/.test(keyWorkerRaw) ? '' : keyWorkerRaw.trim();

  const carePlan = emptyCarePlan(planDate, parsedReviewDate);
  const risk = emptyRisk(planDate);
  const parsedRiskItems = parseRiskItemsFromAssessment(normalized);
  const noteRiskItems = parsedRiskItems.length ? [] : parseRiskItemsFromNotes(normalized);
  const combinedRiskItems = parsedRiskItems.length ? parsedRiskItems : noteRiskItems;
  if (combinedRiskItems.length) {
    risk.risks = combinedRiskItems;
    warnings.push(`Imported ${combinedRiskItems.length} risk area(s) from clinical risk assessment.`);
  } else {
    warnings.push('Risk assessment detected but no structured risk areas were parsed. Review manually.');
  }

  const leastRestrictive = extractSectionByMarkers(normalized, /LEAST\s+RESTRICTIVE\s+PRACTICE\s+STATEMENT/i, [
    /EMERGENCY\s+ESCALATION\s+PROCEDURE/i,
    /REVIEW\s+CYCLE/i,
    /Risk\s*Area\s*1\s*:/i,
  ]);
  const escalation = extractSectionByMarkers(normalized, /EMERGENCY\s+ESCALATION\s+PROCEDURE/i, [
    /REVIEW\s+CYCLE/i,
    /2\.\s*MULTI\s*-\s*AGENCY/i,
    /Risk\s*Area\s*1\s*:/i,
  ]);
  const reviewCycle = extractSectionByMarkers(normalized, /REVIEW\s+CYCLE/i, [
    /2\.\s*MULTI\s*-\s*AGENCY/i,
    /Risk\s*Area\s*1\s*:/i,
    /SIGNATURES/i,
  ]);

  if (leastRestrictive) risk.leastRestrictivePractice = leastRestrictive.slice(0, 2000);
  if (escalation) risk.escalationProcedure = escalation.slice(0, 2000);
  if (reviewCycle) risk.reviewSchedule = reviewCycle.slice(0, 1400);

  return {
    client: {
      name,
      preferredName,
      dob,
      keyWorker,
      reviewDate: parsedReviewDate,
      risk,
    },
    carePlan,
    warnings,
  };
}

function sentenceSummary(text: string, maxSentences = 3, maxChars = 1200): string {
  const cleaned = normalizeSectionText(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const sentences = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  const selected = dedupe(sentences).slice(0, maxSentences);
  const result = selected.join(' ');
  return result.slice(0, maxChars).trim();
}

function riskScoreFromText(text: string): { likelihood: number; impact: number } {
  const t = text.toLowerCase();
  let likelihood = 2;
  let impact = 2;

  if (/\b(risk|unsafe|unable|needs support|requires support|vulnerab|problem|concern|difficult|struggle)\b/i.test(t)) {
    likelihood = 3;
  }
  if (/\b(safeguard|exploit|abuse|neglect|debt|fall|overdose|injury|harm|crisis|self-neglect|temperature|breath|reflux|anxiety|depression)\b/i.test(t)) {
    impact = 4;
  }
  if (/\b(always|significant|serious|high|cannot|unable to|at risk|scamming|financial exploitation)\b/i.test(t)) {
    likelihood = Math.max(likelihood, 4);
  }
  if (/\b(emergency|hospital|multi-agency|safeguarding|overdose|serious harm)\b/i.test(t)) {
    impact = Math.max(impact, 5);
  }

  return {
    likelihood: clampRiskScore(likelihood),
    impact: clampRiskScore(impact),
  };
}

function riskTitleFromReassessment(title: string, text: string): string {
  const t = text.toLowerCase();
  if (/safeguard|exploit|abuse|neglect|vulnerab/.test(t)) return `Risk of safeguarding / vulnerability in ${title.toLowerCase()}`;
  if (/budget|debt|money|finance|bills/.test(t)) return 'Risk of financial instability and debt';
  if (/nutrition|meal|food|drink|eat|swallow|reflux|hernia/.test(t)) return 'Risk of poor nutrition / reflux / meal safety';
  if (/personal care|hygiene|shower|bath|temperature|shave|laundry/.test(t)) return 'Risk of hygiene support failure or temperature injury';
  if (/toilet|continence|toileting/.test(t)) return 'Risk related to continence and toileting support';
  if (/habitable home|domestic|clean|safe living environment/.test(t)) return 'Risk of environmental neglect or unsafe home conditions';
  if (/breath|mobility|moving around|out and about|shopping/.test(t)) return 'Risk of fatigue, breathlessness, or unsafe community access';
  if (/relationship|partner|family|emotion|mood|anxious|depress|personality disorder/.test(t)) return 'Risk of emotional / relational vulnerability';
  if (/medication|health|smoker|smoke|medical history/.test(t)) return 'Risk of unmanaged health conditions';
  return `Risk linked to ${title}`;
}

function sectionBlock(text: string, start: RegExp, ends: RegExp[], maxChars = 3000): string {
  return extractSectionByMarkers(text, start, ends).slice(0, maxChars);
}

function setCarePlanDomainFromText(
  carePlan: CarePlanData,
  title: string,
  rawSection: string,
  overrides?: Partial<Pick<CarePlanDomain, 'riskTitle' | 'riskLikelihood' | 'riskImpact'>>
) {
  const idx = carePlan.domains.findIndex((d) => d.title === title);
  if (idx === -1) return false;

  const summary = sentenceSummary(rawSection, 3, 1400);
  const desiredOutcome = normalizeSectionText(
    rawSection.match(/desired outcome\/what does the person want to achieve\?\s*([\s\S]{0,1200}?)(?=(?:the needs identified above|are these needs being currently met|outcomes\s*[-–]\s*|assessment summary and personal outcomes|risk assessments|other needs|$))/i)?.[1] || ''
  ).replace(/\s+/g, ' ').trim().slice(0, 1000);
  const supportLead = sentenceSummary(rawSection, 2, 900);
  const { likelihood, impact } = riskScoreFromText(rawSection);

  carePlan.domains[idx] = {
    ...carePlan.domains[idx],
    identifiedNeed: desiredOutcome || summary || supportLead,
    plannedOutcomes: desiredOutcome || summary,
    howToAchieve: summary || desiredOutcome,
    riskTitle: overrides?.riskTitle || riskTitleFromReassessment(title, rawSection),
    riskLikelihood: overrides?.riskLikelihood || likelihood,
    riskImpact: overrides?.riskImpact || impact,
    reviewNote: sentenceSummary(rawSection, 2, 900) || carePlan.domains[idx].reviewNote,
    enabled: true,
  };

  return true;
}

function parseNeedsReassessmentCarePlan(text: string): CarePlanData {
  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  const carePlan = emptyCarePlan(today, reviewDate);
  const normalized = normalizeSectionText(text);

  carePlan.biography = sentenceSummary(
    extractSectionByMarkers(normalized, /Background Information/i, [
      /Outcomes - Managing Nutrition/i,
      /Reported health conditions leading to social care needs/i,
      /Assessment Summary and Personal Outcomes/i,
    ]),
    4,
    1600
  );

  carePlan.criticalInfo = sentenceSummary(
    extractSectionByMarkers(normalized, /Medical history/i, [
      /Outcomes - Managing Nutrition/i,
      /Reported health conditions leading to social care needs/i,
      /Outcomes - Personal Care/i,
    ]),
    4,
    1600
  );

  carePlan.emergencyInfo = sentenceSummary(
    extractSectionByMarkers(normalized, /Risk Assessments/i, [
      /Managing Finances/i,
      /Risks - emotional wellbeing/i,
      /Worker Recommendation/i,
    ]),
    4,
    1200
  );

  const sectionSpecs: Array<{
    title: string;
    start: RegExp;
    ends: RegExp[];
    riskTitle?: string;
    riskLikelihood?: number;
    riskImpact?: number;
  }> = [
    {
      title: 'Nutrition, Hydration & Diet',
      start: /Outcomes - Managing Nutrition/i,
      ends: [/Outcomes - Personal Care/i, /Outcomes - Practical Aspects of Daily Living/i, /Managing Nutrition/i],
      riskTitle: 'Risk of poor nutrition / reflux / meal safety',
    },
    {
      title: 'Personal Care & Physical Presentation',
      start: /Outcomes - Personal Care/i,
      ends: [/Managing Toileting Needs/i, /Outcomes - Practical Aspects of Daily Living/i],
      riskTitle: 'Risk of hygiene support failure or temperature injury',
    },
    {
      title: 'Continence & Personal Hygiene',
      start: /Managing Toileting Needs/i,
      ends: [/Dressing\/Undressing/i, /Outcomes - Practical Aspects of Daily Living/i],
      riskTitle: 'Risk related to continence and toileting support',
    },
    {
      title: 'Personal Care & Physical Presentation',
      start: /Dressing\/Undressing/i,
      ends: [/Outcomes - Practical Aspects of Daily Living/i, /Maintaining a Habitable Home Environment/i],
      riskTitle: 'Risk of clothing / presentation support failure',
    },
    {
      title: 'Adaptive Living Environment',
      start: /Maintaining a Habitable Home Environment/i,
      ends: [/Moving around and staying comfortable/i, /Getting out and about/i],
      riskTitle: 'Risk of environmental neglect or unsafe home conditions',
    },
    {
      title: 'Mobility, Movement & Exercise',
      start: /Moving around and staying comfortable/i,
      ends: [/Getting out and about/i, /Outcomes - Engaging with Others/i],
      riskTitle: 'Risk of fatigue, breathlessness, or unsafe community access',
    },
    {
      title: 'Rights, Choice & Inclusion',
      start: /Getting out and about/i,
      ends: [/Outcomes - Engaging with Others/i, /Maintaining Family Relationships/i],
      riskTitle: 'Risk of isolation or reduced community access',
    },
    {
      title: 'Social Engagement & Relationships',
      start: /Maintaining Family Relationships/i,
      ends: [/Assessment Summary and Personal Outcomes/i, /Other Needs/i],
      riskTitle: 'Risk of emotional / relational vulnerability',
    },
    {
      title: 'Financial Management & Autonomy',
      start: /Managing Finances/i,
      ends: [/Risk Assessments/i, /Risks - emotional wellbeing/i, /Worker Recommendation/i],
      riskTitle: 'Risk of financial instability and debt',
    },
    {
      title: 'Holistic Health & Vitality',
      start: /Medical history/i,
      ends: [/Outcomes - Managing Nutrition/i, /Reported health conditions leading to social care needs/i],
      riskTitle: 'Risk of unmanaged health conditions',
    },
    {
      title: 'Mental Health & Emotional Wellbeing',
      start: /Background Information/i,
      ends: [/Outcomes - Managing Nutrition/i, /Reported health conditions leading to social care needs/i, /Assessment Summary and Personal Outcomes/i],
      riskTitle: 'Risk of emotional / relational vulnerability',
    },
    {
      title: 'Environment & Physical Safety',
      start: /Risk Assessments/i,
      ends: [/Managing Finances/i, /Risks - emotional wellbeing/i],
      riskTitle: 'Risk of safeguarding concern or exploitation',
    },
  ];

  for (const spec of sectionSpecs) {
    const block = sectionBlock(normalized, spec.start, spec.ends);
    if (!block) continue;
    setCarePlanDomainFromText(carePlan, spec.title, block, {
      riskTitle: spec.riskTitle,
      riskLikelihood: spec.riskLikelihood,
      riskImpact: spec.riskImpact,
    });
  }

  const reassessmentSummary = sentenceSummary(
    extractSectionByMarkers(normalized, /Assessment Summary and Personal Outcomes/i, [
      /Your Current or Informal Support/i,
      /Other Needs/i,
      /Risk Assessments/i,
    ]),
    6,
    1800
  );
  if (reassessmentSummary) {
    carePlan.biography = [carePlan.biography, reassessmentSummary].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  return carePlan;
}

function parseReassessmentRiskItems(text: string): RiskItem[] {
  const normalized = normalizeSectionText(text);
  const items: RiskItem[] = [];

  const add = (title: string, description: string, extra: Partial<RiskItem> = {}) => {
    if (!title && !description) return;
    items.push({
      ...emptyRisk_item(),
      title,
      description,
      triggers: extra.triggers || ['See reassessment notes.'],
      earlyWarnings: extra.earlyWarnings || ['See reassessment notes.'],
      controls: extra.controls || ['Follow support plan and reassessment actions.'],
      likelihood: extra.likelihood || 3,
      impact: extra.impact || 3,
      reviewTrigger: extra.reviewTrigger || 'Review after change in presentation or annual reassessment.',
      ...extra,
    });
  };

  const sections = [
    {
      start: /Risk Assessments/i,
      end: [/Managing Finances/i, /Risks - emotional wellbeing/i, /Worker Recommendation/i],
    },
    {
      start: /Managing Finances/i,
      end: [/Risks - emotional wellbeing/i, /Case Progression Meeting/i, /Worker Recommendation/i],
    },
    {
      start: /Risks - emotional wellbeing/i,
      end: [/Case Progression Meeting/i, /Worker Recommendation/i, /Page 28 of 31/i],
    },
  ];

  for (const section of sections) {
    const block = sectionBlock(normalized, section.start, section.end, 4000);
    if (!block) continue;
    const lower = block.toLowerCase();

    if (/safeguard|exploit|abuse|scam|coercion|cuckooing|financial affairs|vulnerab/.test(lower)) {
      add(
        'Risk of financial exploitation / safeguarding',
        sentenceSummary(block, 3, 900),
        {
          triggers: ['New acquaintances', 'Sharing sensitive information', 'Financial pressure'],
          earlyWarnings: ['Giving out details', 'Anxiety about money', 'Escalating safeguarding concern'],
          controls: ['Discuss boundaries and safe disclosure', 'Escalate safeguarding concerns', 'Monitor finances'],
          likelihood: 4,
          impact: 4,
        }
      );
    }

    if (/nutrition|meal|food|drink|swallow|reflux|hernia|dentist|kitchen|cook/i.test(lower)) {
      add(
        'Risk of poor nutrition / reflux / meal safety',
        sentenceSummary(block, 3, 900),
        {
          triggers: ['Low mood', 'Distraction', 'Poor meal planning', 'Unsafe kitchen practice'],
          earlyWarnings: ['Skipping meals', 'Reduced intake', 'Digestive discomfort'],
          controls: ['Support meal planning', 'Promote soft diet', 'Monitor medication before breakfast'],
          likelihood: 3,
          impact: 4,
        }
      );
    }

    if (/personal care|hygiene|shower|bath|temperature|laundry|shave/i.test(lower)) {
      add(
        'Risk of hygiene support failure or temperature injury',
        sentenceSummary(block, 3, 900),
        {
          triggers: ['Poor prompting', 'Temperature not checked', 'Low motivation'],
          earlyWarnings: ['Missed personal care', 'Unsafe water temperature', 'Dirty laundry'],
          controls: ['Prompt hygiene tasks', 'Set safe water temperature', 'Support shaving and laundry'],
          likelihood: 3,
          impact: 3,
        }
      );
    }

    if (/budget|debt|money|bills|financial|invoiced|citizens advice/i.test(lower)) {
      add(
        'Risk of financial instability and debt',
        sentenceSummary(block, 3, 900),
        {
          triggers: ['Budgeting pressure', 'Difficulty reading/writing', 'Debt history'],
          earlyWarnings: ['Missed bills', 'Anxiety about money', 'Poor understanding of invoices'],
          controls: ['Support budgeting', 'Provide admin support', 'Escalate debt concerns early'],
          likelihood: 3,
          impact: 4,
        }
      );
    }

    if (/relationship|partner|family|social|partner being in his life|vulnerable position/i.test(lower)) {
      add(
        'Risk of emotional / relational vulnerability',
        sentenceSummary(block, 3, 900),
        {
          triggers: ['New relationships', 'Sensitivity around personal information', 'Trauma history'],
          earlyWarnings: ['Withdrawing', 'Anxiety', 'Sharing private details'],
          controls: ['Provide safe relationship guidance', 'Use reflective support', 'Monitor safeguarding concerns'],
          likelihood: 3,
          impact: 4,
        }
      );
    }

    if (/breath|smoker|lung capacity|out of breathe|mobility|moving around|community access|walk/i.test(lower)) {
      add(
        'Risk of fatigue, breathlessness, or unsafe community access',
        sentenceSummary(block, 3, 900),
        {
          triggers: ['Physical exertion', 'Smoking', 'Long distances'],
          earlyWarnings: ['Breathlessness', 'Fatigue', 'Slowed pace'],
          controls: ['Pace activity', 'Support community access', 'Monitor breathlessness'],
          likelihood: 3,
          impact: 3,
        }
      );
    }
  }

  return items;
}

function normalizeNameCandidate(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/\s+\(1:1\)\s*$/i, '')
    .replace(/\s+—\s*$/, '')
    .trim();
}

function preferredFromName(fullName: string): string {
  const tokens = normalizeNameCandidate(fullName).split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';
  const title = tokens[0].toLowerCase().replace('.', '');
  if (['mr', 'mrs', 'ms', 'miss', 'mx', 'dr'].includes(title)) {
    return tokens[1] || tokens[0];
  }
  return tokens[0];
}

function normalizeOptionalField(value: string): string {
  const cleaned = normalizeNameCandidate(value);
  return cleaned === '-' ? '' : cleaned;
}

function cleanPhone(value: string): string {
  const compact = value.replace(/[^\d+]/g, '');
  if (compact.startsWith('+44') && compact.length >= 12) return `0${compact.slice(3)}`;
  return compact;
}

function extractBasicProfileFields(text: string): Partial<FullClient> {
  const normalized = normalizeSectionText(text);
  const compact = normalized.replace(/\n/g, ' ');
  const client: Partial<FullClient> = {};

  const nameMatch = compact.match(/\bTitle\s+First Name\s+Last Name\s+(?:Mr|Mrs|Ms|Miss|Mx|Dr)\.?\s+([A-Z][A-Za-z'-]+)\s+([A-Z][A-Za-z'-]+)\b/i);
  if (nameMatch) {
    client.name = `${nameMatch[1]} ${nameMatch[2]}`;
    client.preferredName = nameMatch[1];
  }

  const preferredDobMatch = compact.match(/\bPreferred Name\s+Gender Identity\s+Date of Birth\s+(.+?)\s+(?:male|female|non[-\s]?binary|other|not\s+known|prefer\s+not\s+to\s+say)\s+(\d{2}\/\d{2}\/\d{4})\b/i);
  if (preferredDobMatch) {
    const preferred = normalizeOptionalField(preferredDobMatch[1] || '');
    if (preferred) client.preferredName = preferred;
    client.dob = preferredDobMatch[2];
  } else {
    const dobMatch = compact.match(/\bDate of Birth\s+\S{0,40}?\s*(\d{2}\/\d{2}\/\d{4})\b/i);
    if (dobMatch) client.dob = dobMatch[1];
  }

  const emailNhsMatch = compact.match(/\bEmail\s+NHS\s*\/\s*CHI No\.?\s+\S+@\S+\s+([\d\s]{10,16})(?=\s+Deprivation|\s+Gold|\s+Quick notes|$)/i);
  if (emailNhsMatch) client.nhs = emailNhsMatch[1].replace(/\s+/g, '');

  const contactSection = compact.match(/\bContact Number\s+(.{0,240})/i)?.[1] || compact;
  const phoneMatches = [...contactSection.matchAll(/(?:\+44\s?\d{4}|\b0\d{4})[\s-]?\d{3}[\s-]?\d{3}\b/g)];
  if (phoneMatches.length) {
    client.phone = cleanPhone(phoneMatches[0][0]);
  }

  return client;
}

function extractPreparedForName(text: string): string {
  const prepared = text.match(/Prepared for\s+([^\n|]+)/i);
  if (!prepared) return '';
  const candidate = normalizeNameCandidate(prepared[1] || '');
  if (!candidate) return '';
  if (/^hazel\s*care/i.test(candidate)) return '';
  if (/^(clinical risk assessment|my support plan|positive behaviour support plan)$/i.test(candidate)) return '';
  return candidate;
}

function parseCarePlanReport(text: string): { client: Partial<FullClient>; carePlan: CarePlanData } {
  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  const carePlan = emptyCarePlan(today, reviewDate);

  let name = '';
  let preferredName = '';
  const headerMatch = text.match(/(?:Care\s*Plan|Emergency\s+Admission\s+Pack)\s*[–—-]\s*([\s\S]{1,180}?)\s*Report\s*run\s*on/i);
  if (headerMatch) {
    const candidate = normalizeNameCandidate(headerMatch[1]);
    if (candidate && !/^hazel\s*care/i.test(candidate)) {
      name = candidate;
      preferredName = preferredFromName(name);
    }
  }

  let address = '';
  const hcMatch = text.match(/(?:OVSITE Support|OVSITE)\s+(\w+)\s+\w+\s+(\w+)\s+(\d+)\s+years?\s+(.+?)(?:,\s*\d+\.\s*Needs|$)/i);
  if (hcMatch) {
    const first = (hcMatch[1] || '').toLowerCase();
    const second = (hcMatch[2] || '').toLowerCase();
    const looksLikeOrgName =
      ['hazel', 'care', 'support', 'operations', 'ops'].includes(first) ||
      ['hazel', 'care', 'support', 'ltd', 'limited', 'operations', 'ops'].includes(second);
    if (!name) {
      if (!looksLikeOrgName) {
        name = `${hcMatch[1]} ${hcMatch[2]}`.trim();
        preferredName = preferredFromName(name);
      }
    }
    address = hcMatch[4]?.trim() || '';
  }

  if (!name) {
    const preparedFor = extractPreparedForName(text);
    if (preparedFor) {
      name = preparedFor;
      preferredName = preferredFromName(preparedFor);
    }
  }

  const dateMatch = text.match(/Report run on\s+(\d{2}\/\d{2}\/\d{4})/);
  const domainKeys = Object.keys(DOMAIN_MAP);
  const upper = text.toUpperCase();

  for (const domainKey of domainKeys) {
    const mappedName = DOMAIN_MAP[domainKey];
    const domainIdx = carePlan.domains.findIndex(d => d.title === mappedName);
    if (domainIdx === -1) continue;

    const keyIdx = upper.indexOf(domainKey);
    if (keyIdx === -1) continue;

    let sectionEnd = text.length;
    for (const otherKey of domainKeys) {
      if (otherKey === domainKey) continue;
      const otherIdx = upper.indexOf(otherKey, keyIdx + domainKey.length + 10);
      if (otherIdx !== -1 && otherIdx < sectionEnd) sectionEnd = otherIdx;
    }
    const nextSectionMatch = text.slice(keyIdx + domainKey.length).match(/\d+\.\s+(Needs Assessing|Care Plans|Assessments)/i);
    if (nextSectionMatch && nextSectionMatch.index !== undefined) {
      const possibleEnd = keyIdx + domainKey.length + nextSectionMatch.index;
      if (possibleEnd < sectionEnd) sectionEnd = possibleEnd;
    }

    const section = text.slice(keyIdx, sectionEnd);
    let content = '';
    const descMatch = section.match(/Description\s*[–-]\s*(.*)/is);
    if (descMatch) content = descMatch[1].trim();

    const carePlanMatch = content.match(/CARE PLAN\s+\w+\s+(.*)/is);
    if (carePlanMatch) content = carePlanMatch[1].trim();

    const identifiedNeed = extractFieldSmart(section, 'Identified Need', ['Level of need', 'Planned Outcomes', 'Description']);
    const levelText = extractFieldSmart(section, 'Level of need', ['Planned Outcomes', 'How to', 'Description']);
    const plannedOutcomes = extractFieldSmart(section, 'Planned Outcomes', ['How to Achieve', 'Risk', 'Description']);
    const howToAchieve = extractFieldSmart(section, 'How to Achieve', ['Risk', 'Review', 'Likelihood', 'Description']);
    const riskTitle = extractFieldSmart(section, 'Risk', ['Likelihood', 'Review note', 'Reviewer', 'Description']);
    const likelihoodText = extractFieldSmart(section, 'Likelihood', ['Impact', 'Total', 'Review']);
    const impactText = extractFieldSmart(section, 'Impact', ['Total', 'Review', 'Risk']);
    const numericTriplet = parseNumericTriplet(section);
    const reviewNote = extractFieldSmart(section, 'Review note', ['Reviewer', 'Page', 'Next']);
    const reviewer = extractFieldSmart(section, 'Reviewer', ['Review date', 'Page', 'Next']);
    const reviewDateVal = extractFieldSmart(section, 'Review date', ['Page', 'Next review']);
    const nextReviewDateVal = extractFieldSmart(section, 'Next review date', ['Identified Need', 'Level', 'Description']);

    let levelOfNeed = 0;
    const levelLower = levelText.toLowerCase();
    for (const [key, val] of Object.entries(LEVEL_MAP)) {
      if (levelLower.includes(key)) { levelOfNeed = val; break; }
    }
    if (levelOfNeed === 0) {
      const sectionLower = section.toLowerCase();
      for (const [key, val] of Object.entries(LEVEL_MAP)) {
        if (sectionLower.includes(key)) { levelOfNeed = val; break; }
      }
    }

    const finalNeed = identifiedNeed || content.slice(0, 500);
    const hasContent = !!(finalNeed && finalNeed.length > 5);

    carePlan.domains[domainIdx] = {
      ...carePlan.domains[domainIdx],
      identifiedNeed: finalNeed,
      levelOfNeed,
      plannedOutcomes,
      howToAchieve,
      riskTitle: riskTitle.split(/[\n]/)[0].trim(),
      riskLikelihood: numericTriplet ? numericTriplet.likelihood : parseLikelihood(likelihoodText),
      riskImpact: numericTriplet ? numericTriplet.impact : parseImpact(impactText),
      riskMitigation: '',
      reviewNote,
      reviewer,
      reviewDate: reviewDateVal || (dateMatch ? dateMatch[1] : ''),
      nextReviewDate: nextReviewDateVal,
      enabled: hasContent,
    };
  }

  return { client: { name, preferredName, address }, carePlan };
}

export function parseUniversalText(rawText: string): ParseResult {
  const warnings: string[] = [];
  const text = rawText.replace(/\r\n/g, '\n');
  const flat = isFlat(text);
  const isNeedsReassessment =
    /adult\s*-\s*needs\s*re-?assessment/i.test(text) ||
    /assessment\s+summary\s+and\s+personal\s+outcomes/i.test(text);

  const isCarePlanReport = /(?:Care\s*Plan|Emergency\s+Admission\s+Pack)[\s\S]{0,220}Report\s*run\s*on/i.test(text);
  const isRiskAssessmentReport =
    /clinical\s+risk\s+assessment/i.test(text) ||
    /risk\s+compatibility\s+assessment/i.test(text) ||
    /compatibility\s+risk\s+assessment/i.test(text) ||
    /Risk\s*Area\s*\d+\s*:/i.test(text);

  if (isNeedsReassessment) {
    const today = new Date().toLocaleDateString('en-GB');
    const planDate = (text.match(/DATE\s+ASSESSMENT\s+COMmenced\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || text.match(/Date Assessment Commenced\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || today).trim();
    const reassessmentCarePlan = parseNeedsReassessmentCarePlan(text);
    const risk = emptyRisk(planDate);
    risk.risks = parseReassessmentRiskItems(text);
    if (risk.risks.length === 0) {
      risk.risks = buildRiskFromCarePlan(text, reassessmentCarePlan).risks;
    }

    const client: Partial<FullClient> = {
      name: text.match(/Person Name:\s*([^\n]+)/i)?.[1]?.replace(/\s+Person ID:.*/, '').trim() || '',
      preferredName: text.match(/\bMr\s+([A-Za-z'-]+)/i)?.[1] || text.match(/\bMrs\s+([A-Za-z'-]+)/i)?.[1] || text.match(/\bMs\s+([A-Za-z'-]+)/i)?.[1] || '',
      dob: text.match(/Date of Birth\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || '',
      address: text.match(/Permanent Address[\s\S]{0,160}?([0-9][^\n]+(?:\n[^\n]+){0,2})/i)?.[1]?.replace(/\n+/g, ', ').trim() || '',
      nhs: text.match(/NHS No\.?\s*(\d[\d\s]{6,})/i)?.[1]?.replace(/\s+/g, '') || '',
      risk,
      supportPlan: parseSupportPlanText(text),
    };

    const enabledCount = reassessmentCarePlan.domains.filter((d) => d.enabled).length;
    warnings.push(enabledCount > 0
      ? `Identified ${enabledCount} reassessment care domains for this profile.`
      : 'No support plan areas detected — verify text format.');
    if (risk.risks.length > 0) {
      warnings.push(`Imported ${risk.risks.length} risk assessment item(s) from reassessment notes.`);
    }
    return { client, carePlan: reassessmentCarePlan, warnings };
  }

  if (isRiskAssessmentReport && !isCarePlanReport) {
    return parseRiskAssessmentReport(text);
  }

  if (isCarePlanReport && flat) {
    const result = parseCarePlanReport(text);
    const enabledCount = result.carePlan.domains.filter(d => d.enabled).length;

    if (enabledCount === 0) {
      const upper = text.toUpperCase();
      const domainKeys = Object.keys(DOMAIN_MAP);
      for (const domainKey of domainKeys) {
        if (upper.includes(domainKey)) {
          const mappedName = DOMAIN_MAP[domainKey];
          const idx = result.carePlan.domains.findIndex(d => d.title === mappedName);
          if (idx !== -1) {
            result.carePlan.domains[idx].enabled = true;
            result.carePlan.domains[idx].identifiedNeed = result.carePlan.domains[idx].identifiedNeed || 'Imported — verification required';
          }
        }
      }
      const foundCount = result.carePlan.domains.filter(d => d.enabled).length;
      if (foundCount === 0) {
        warnings.push('No support plan areas detected — verify text format.');
      } else {
        warnings.push(`Found ${foundCount} of ${CARE_PLAN_DOMAINS.length} premium areas. Verify content precision.`);
      }
    } else {
      warnings.push(`Identified ${enabledCount} core care domains for this profile.`);
    }

    const risk = buildRiskFromCarePlan(text, result.carePlan);
    return { client: { ...result.client, risk }, carePlan: result.carePlan, warnings };
  }

  // New Line Delimited Parser
  const basicProfile = extractBasicProfileFields(text);
  const firstName = extractField(text, 'First Name\n', ['Last Name', 'Preferred Name']).split('\n')[0].trim();
  const lastName = extractField(text, 'Last Name\n', ['Preferred Name', 'Gender']).split('\n')[0].trim();
  let preferredNameNL = extractField(text, 'Preferred Name\n', ['Gender', 'Date of Birth']).split('\n')[0].trim();
  const dob = extractField(text, 'Date of Birth\n', ['Email', 'NHS']).split('\n')[0].trim();
  const nhs = extractField(text, 'NHS / CHI No.\n', ['Deprivation', 'Gold']).split('\n')[0].trim();
  const phone = extractField(text, 'Contact Number\n', ['Quick notes', 'CRITICAL']).split('\n')[0].trim();
  let name = basicProfile.name || `${firstName} ${lastName}`.trim();
  preferredNameNL = basicProfile.preferredName || preferredNameNL;

  if (!name || name.length < 2) {
    const hdrMatch = text.match(/(?:Care\s*Plan|Emergency\s+Admission\s+Pack)\s*[–—-]\s*([\s\S]{1,180}?)(?:\n|Report\s*run\s*on)/i);
    if (hdrMatch) {
      name = normalizeNameCandidate(hdrMatch[1]);
      preferredNameNL = preferredNameNL || preferredFromName(name);
    }
  }

  if (!name || name.length < 2) {
    const preparedFor = extractPreparedForName(text);
    if (preparedFor) {
      name = preparedFor;
      preferredNameNL = preferredNameNL || preferredFromName(preparedFor);
    }
  }

  const street = extractField(text, 'Street Address\n', ['Town', 'County']).split('\n')[0].trim();
  const town = extractField(text, 'Town\n', ['County', 'Post Code']).split('\n')[0].trim();
  const postCode = extractField(text, 'Post Code\n', ['Country', 'National']).split('\n')[0].trim();
  const address = [street, town, postCode].filter(Boolean).join(', ');

  const dateOfAdmission = extractField(text, 'Date of Admission\n', ['Leave date', 'Key Workers']).split('\n')[0].trim();
  const keyWorker = extractField(text, 'Key Workers\n', ['Last modified', 'BIOGRAPHY']).split('\n')[0].trim();

  const biography = extractBetween(text, 'BIOGRAPHY\n', ['2. Care Plans', 'CARE PLAN']);
  const bioClean = biography.replace(/^[A-Z\s]+\n/, '').trim();
  const criticalInfo = extractBetween(text, 'CRITICAL INFORMATION\n', ['SLEEPING', 'ABILITIES', 'EMERGENCY']);
  const emergencyInfo = extractBetween(text, 'EMERGENCY INFORMATION\n', ['ADDITIONAL INFO', 'Street Address']);

  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  const carePlan = emptyCarePlan(today, reviewDate);
  carePlan.biography = bioClean;
  carePlan.criticalInfo = criticalInfo;
  carePlan.emergencyInfo = emergencyInfo;

  const domainKeys = Object.keys(DOMAIN_MAP);
  for (const domainKey of domainKeys) {
    const mappedName = DOMAIN_MAP[domainKey];
    const domainIdx = carePlan.domains.findIndex(d => d.title === mappedName);
    if (domainIdx === -1) continue;

    const sectionStart = text.indexOf(domainKey);
    if (sectionStart === -1) continue;

    let sectionEnd = text.length;
    for (const otherKey of domainKeys) {
      if (otherKey === domainKey) continue;
      const otherIdx = text.indexOf(otherKey, sectionStart + domainKey.length + 50);
      if (otherIdx !== -1 && otherIdx < sectionEnd) sectionEnd = otherIdx;
    }
    const nextCarePlanIdx = text.indexOf('2. Care Plans', sectionStart + domainKey.length);
    if (nextCarePlanIdx !== -1 && nextCarePlanIdx < sectionEnd) sectionEnd = nextCarePlanIdx;

    const section = text.slice(sectionStart, sectionEnd);

    const identifiedNeed = extractField(section, 'Identified Need\n', ['Level of need', 'Planned Outcomes']);
    const levelText = extractField(section, 'Level of need\n', ['Planned Outcomes', 'How to']);
    const plannedOutcomes = extractField(section, 'Planned Outcomes\n', ['How to Achieve', 'Risk\n']);
    const howToAchieve = extractField(section, 'How to Achieve Outcomes\n', ['Risk\n', 'Review note', 'Likelihood']);
    const riskTitle = extractField(section, 'Risk\n', ['Likelihood', 'Review note', 'Reviewer']);
    const likelihoodText = extractField(section, 'Likelihood\n', ['=', 'Impact']);
    const impactText = extractField(section, 'Impact\n', ['Risk\n', 'Total score', 'Review']);
    const numericTriplet = parseNumericTriplet(section);
    const reviewNote = extractField(section, 'Review note\n', ['Reviewer', 'Page']);
    const reviewer = extractField(section, 'Reviewer\n', ['Review date', 'Page', '2. Care Plans']);
    const reviewDateVal = extractField(section, 'Review date\n', ['Page', '2. Care Plans', '\n\n']);
    const nextReviewDate = extractField(section, 'Next review date\n', ['Identified Need', 'Level of need']);

    let levelOfNeed = 0;
    const levelLower = levelText.toLowerCase().trim();
    for (const [key, val] of Object.entries(LEVEL_MAP)) {
      if (levelLower.includes(key)) { levelOfNeed = val; break; }
    }

    carePlan.domains[domainIdx] = {
      ...carePlan.domains[domainIdx],
      identifiedNeed: identifiedNeed.trim(),
      levelOfNeed,
      plannedOutcomes: plannedOutcomes.trim(),
      howToAchieve: howToAchieve.trim(),
      riskTitle: riskTitle.split('\n')[0].trim(),
      riskLikelihood: numericTriplet ? numericTriplet.likelihood : parseLikelihood(likelihoodText),
      riskImpact: numericTriplet ? numericTriplet.impact : parseImpact(impactText),
      riskMitigation: riskTitle.includes('\n') ? riskTitle.split('\n').slice(1).join('\n').trim() : '',
      reviewNote: reviewNote.trim(),
      reviewer: reviewer.split('\n')[0].trim(),
      reviewDate: reviewDateVal.split('\n')[0].trim(),
      nextReviewDate: nextReviewDate.split('\n')[0].trim(),
      enabled: !!identifiedNeed.trim(),
    };
  }

  const enabledCount = carePlan.domains.filter(d => d.enabled).length;
  if (enabledCount === 0) warnings.push('No support plan areas detected — verify text format.');
  else warnings.push(`Identified ${enabledCount} core care domains for this profile.`);

  const risk = buildRiskFromCarePlan(text, carePlan);
  return {
    client: {
      name,
      preferredName: preferredNameNL || preferredFromName(name),
      dob: basicProfile.dob || dob,
      address,
      nhs: basicProfile.nhs || nhs,
      phone: basicProfile.phone || phone,
      keyWorker,
      dateOfAdmission,
      risk,
    },
    carePlan,
    warnings,
  };
}

export function parseSupportPlanText(rawText: string): SupportPlanData {
  const text = rawText.replace(/\r\n/g, '\n');
  const needs: SupportPlanNeed[] = [];
  const areaPatterns = [
    'My mental health', 'My physical Health', 'My annual health check', 'My dental health',
    'Medication', 'Nutrition', 'Personal hygiene', 'Keeping Warm', 'Toilet needs',
    'Going to bed', 'Managing finance', 'Safety', 'Education', 'Social inclusion',
    'Communication', 'Transport',
    'Being part of the Community', 'Having work and learning opportunities',
    'Making important decisions and planning your life', 'Running your home', 'Running a home',
    'Eating, drinking and preparing meals', 'Personal care', 'Persona hygiene',
    'Dressing', 'Isolation', 'Preparing meals', 'Shopping', 'Managing bills & correspondences',
    'Managing appointments', 'Access- areas of the home', 'Access to the community',
    'Awareness roads & routes', 'Vehicle- safety', 'Road & pavements safety',
    'Managing crowds/passer-by’s', 'Managing personal space', 'Lifts/escalators',
    'Managing medical procedures', 'College', 'Paid work', 'Voluntary work', 'Hobbies',
    'Other interest', 'Forming friendships', 'Use of internet/social media', 'Going on holiday',
    'My wishes about dying', 'My end of life care', 'My, money and estate', 'My funeral',
  ];

  const lines = text.split('\n');
  let currentArea = '';
  let canDo = '';
  let risks = '';
  let howToSupport = '';
  let currentBody = '';

  const cleanSupportText = (value: string, max = 1400): string =>
    normalizeSectionText(value)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);

  const parseSmartLines = (section: string, maxItems = 8): string[] => {
    const listLike = parseListFromSection(section)
      .map((line) => cleanSupportText(line, 260))
      .filter((line) => line.length > 12)
      .filter((line) => !/^section\s*\d+/i.test(line));
    if (listLike.length >= 2) return listLike.slice(0, maxItems);

    const linear = cleanSupportText(section, 6000);
    const sentenceLike = linear
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
      .map((line) => cleanSupportText(line, 260))
      .filter((line) => line.length > 12)
      .filter((line) => !/^section\s*\d+/i.test(line));
    return dedupe(sentenceLike).slice(0, maxItems);
  };

  const pushNeed = (need: SupportPlanNeed) => {
    const area = cleanSupportText(need.area, 120);
    const canDoMyself = cleanSupportText(need.canDoMyself, 1100);
    const needRisks = cleanSupportText(need.risks, 800);
    const support = cleanSupportText(need.howToSupport, 1300);
    if (!area) return;
    if (!canDoMyself && !needRisks && !support) return;

    const mergePipeText = (a: string, b: string, max = 1200): string => {
      const left = cleanSupportText(a, max);
      const right = cleanSupportText(b, max);
      if (!left) return right;
      if (!right) return left;
      if (left.toLowerCase() === right.toLowerCase()) return left;
      const merged = dedupe([...left.split('|'), ...right.split('|')].map((s) => s.trim())).join(' | ');
      return cleanSupportText(merged, max);
    };

    const existingIdx = needs.findIndex((n) => n.area.toLowerCase() === area.toLowerCase());
    if (existingIdx >= 0) {
      const existing = needs[existingIdx];
      needs[existingIdx] = {
        area,
        canDoMyself: canDoMyself.length > (existing.canDoMyself || '').length ? canDoMyself : existing.canDoMyself,
        risks: mergePipeText(existing.risks || '', needRisks, 900),
        howToSupport: support.length > (existing.howToSupport || '').length ? support : existing.howToSupport,
      };
      return;
    }

    needs.push({ area, canDoMyself, risks: needRisks, howToSupport: support });
  };

  const findAreaMatch = (line: string): { area: string; remainder: string } | null => {
    const lower = line.toLowerCase();
    for (const pattern of areaPatterns) {
      const idx = lower.indexOf(pattern.toLowerCase());
      if (idx === -1) continue;
      const area = line.slice(idx, idx + pattern.length).trim();
      const remainder = line.slice(idx + pattern.length).trim();
      return { area: area || pattern, remainder };
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const areaMatch = findAreaMatch(line);
    if (areaMatch) {
      if (currentArea && (canDo || currentBody || risks || howToSupport)) {
        pushNeed({ area: currentArea, canDoMyself: currentBody || canDo, risks, howToSupport: howToSupport || currentBody });
      }
      currentArea = areaMatch.area;
      canDo = '';
      risks = '';
      howToSupport = '';
      currentBody = areaMatch.remainder;
      continue;
    }
    if (line.includes('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4) {
        if (currentArea) pushNeed({ area: currentArea, canDoMyself: currentBody || canDo, risks, howToSupport: howToSupport || currentBody });
        currentArea = cols[0]; canDo = cols[1]; risks = cols[2]; howToSupport = cols[3];
        currentBody = '';
      }
      continue;
    }

    if (currentArea && line && !/^page\s+\d+\s+of\s+\d+/i.test(line) && !/^section\s*\d+/i.test(line)) {
      currentBody = currentBody ? `${currentBody} ${line}` : line;
    }
  }
  if (currentArea && (canDo || currentBody || risks || howToSupport)) {
    pushNeed({ area: currentArea, canDoMyself: currentBody || canDo, risks, howToSupport: howToSupport || currentBody });
  }

  // Council / Care Act style fallback parser (e.g. "Need Description / Need Comment / Outcome Comment").
  if (needs.length === 0) {
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const compact = text.replace(/\r\n/g, '\n');
    const sectionStart = compact.search(/Need Description\s+Need Comment\s+Outcome Comment/i);
    const sectionEndCandidates = [
      compact.search(/Services Brokerage To Source/i),
      compact.search(/Risk Screening/i),
    ].filter((idx) => idx > sectionStart);
    const sectionEnd = sectionEndCandidates.length ? Math.min(...sectionEndCandidates) : compact.length;
    const needSection = sectionStart >= 0 ? compact.slice(sectionStart, sectionEnd) : '';

    const careActNeedTitles = [
      'Managing and maintaining nutrition',
      'Maintaining personal hygiene',
      'Managing toilet needs',
      'Being appropriately clothed',
      'Maintaining a habitable home environment',
      'Being able to make use of the home safely',
      'Developing and maintaining family or other personal relationships',
      'Accessing and engaging in work, training, education or volunteering',
      'Making use of necessary facilities or services in the local community including public transport and recreational facilities or services',
      'Carrying out any caring responsibilities the adult has for a child',
    ];

    if (needSection) {
      const matches = careActNeedTitles
        .map((title) => {
          const tokenPattern = title.split(/\s+/).map(escapeRegExp).join('\\s+');
          const re = new RegExp(tokenPattern, 'i');
          const m = needSection.match(re);
          return m && m.index !== undefined ? { title, index: m.index } : null;
        })
        .filter((m): m is { title: string; index: number } => !!m)
        .sort((a, b) => a.index - b.index);

      for (let i = 0; i < matches.length; i += 1) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        const from = currentMatch.index + currentMatch.title.length;
        const to = nextMatch ? nextMatch.index : needSection.length;
        const block = needSection.slice(from, to).replace(/\s+/g, ' ').trim();
        if (!block) continue;

        const outcomeIdx = block.search(/(?:-For|To have|To continue to|No needs identified\.)/i);
        const needComment = (outcomeIdx > -1 ? block.slice(0, outcomeIdx) : block).replace(/\s+/g, ' ').trim();
        const outcomeComment = (outcomeIdx > -1 ? block.slice(outcomeIdx) : '').replace(/\s+/g, ' ').trim();
        const noNeeds = /no needs identified/i.test(block);

        pushNeed({
          area: currentMatch.title,
          canDoMyself: noNeeds ? 'No needs identified' : needComment.slice(0, 900),
          risks: '',
          howToSupport: (outcomeComment || needComment).slice(0, 1200),
        });
      }
    }
  }

  // Extra council fallback: recover structured Care Act needs from linearized OCR text.
  if (needs.length < 3) {
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const careActNeedTitles = [
      'Managing and maintaining nutrition',
      'Maintaining personal hygiene',
      'Managing toilet needs',
      'Being appropriately clothed',
      'Maintaining a habitable home environment',
      'Being able to make use of the home safely',
      'Developing and maintaining family or other personal relationships',
      'Accessing and engaging in work, training, education or volunteering',
      'Making use of necessary facilities or services in the local community including public transport and recreational facilities or services',
      'Carrying out any caring responsibilities the adult has for a child',
    ];
    const linear = text.replace(/\s+/g, ' ').trim();
    const hits = careActNeedTitles
      .map((title) => {
        const pattern = new RegExp(title.split(/\s+/).map(escapeRegExp).join('\\s+'), 'i');
        const m = linear.match(pattern);
        return m && m.index !== undefined ? { title, index: m.index, length: m[0].length } : null;
      })
      .filter((m): m is { title: string; index: number; length: number } => !!m)
      .sort((a, b) => a.index - b.index);

    for (let i = 0; i < hits.length; i += 1) {
      const current = hits[i];
      const next = hits[i + 1];
      if (needs.some(n => n.area.toLowerCase() === current.title.toLowerCase())) continue;
      const from = current.index + current.length;
      const to = next ? next.index : Math.min(linear.length, from + 2000);
      const block = linear.slice(from, to).trim();
      if (!block) continue;
      const outcomeIdx = block.search(/(?:-For|To have|To continue to|No needs identified\.)/i);
      const needComment = (outcomeIdx > -1 ? block.slice(0, outcomeIdx) : block).replace(/\s+/g, ' ').trim();
      const outcomeComment = (outcomeIdx > -1 ? block.slice(outcomeIdx) : '').replace(/\s+/g, ' ').trim();
      pushNeed({
        area: current.title,
        canDoMyself: needComment.slice(0, 900),
        risks: '',
        howToSupport: (outcomeComment || needComment).slice(0, 1200),
      });
    }
  }

  // Hazel/Nourish "My Support Plan" fallback parser (AREA 1/2/3 block layout).
  if (needs.length === 0) {
    const compact = normalizeSectionText(text.replace(/\t/g, ' '));
    const areaMarkers = [...compact.matchAll(/A\s*R\s*E\s*A\s*\d+/gi)];
    for (let i = 0; i < areaMarkers.length; i += 1) {
      const current = areaMarkers[i];
      if (current.index === undefined) continue;
      const from = current.index;
      const to = i + 1 < areaMarkers.length && areaMarkers[i + 1].index !== undefined
        ? areaMarkers[i + 1].index!
        : compact.length;
      const chunk = compact.slice(from, to);

      const title = (chunk.match(/A\s*R\s*E\s*A\s*\d+\s+([A-Za-z][A-Za-z,&'’/-\s]{3,100}?)(?=\s+WHAT\s+I\s+NEED\s+HELP\s+WITH|\s+WHAT\s+WE\s*['’]?\s*RE\s+WORKING\s+TOWARDS|$)/i)?.[1] || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!title) continue;

      const canDoMyself = extractSectionByMarkers(
        chunk,
        /WHAT\s+I\s+NEED\s+HELP\s+WITH/i,
        [/WHAT\s+WE\s*['’]?\s*RE\s+WORKING\s+TOWARDS/i, /RISK\s+LEVEL/i, /A\s*R\s*E\s*A\s*\d+/i]
      ).slice(0, 1200);

      const howToSupport = extractSectionByMarkers(
        chunk,
        /WHAT\s+WE\s*['’]?\s*RE\s+WORKING\s+TOWARDS/i,
        [/RISK\s+LEVEL/i, /A\s*R\s*E\s*A\s*\d+/i]
      ).slice(0, 1400);

      const risks = extractSectionByMarkers(
        chunk,
        /RISK\s+LEVEL/i,
        [/A\s*R\s*E\s*A\s*\d+/i]
      ).slice(0, 700);

      if (canDoMyself || howToSupport || risks) {
        pushNeed({
          area: title,
          canDoMyself,
          risks,
          howToSupport,
        });
      }
    }
  }

  // Care Act re-assessment fallback: parse "Outcomes - ..." sectioned assessments from LA exports/pasted text.
  if (
    /adult\s*-\s*needs\s*re-?assessment/i.test(text) ||
    /assessment\s+summary\s+and\s+personal\s+outcomes/i.test(text)
  ) {
    const compact = normalizeSectionText(text.replace(/\t/g, ' ')).replace(/\n+/g, ' ');
    const sections: Array<{ area: string; patterns: RegExp[] }> = [
      { area: 'Managing and maintaining nutrition', patterns: [/outcomes\s*[-–]\s*managing\s+nutrition/i, /\bmanaging and maintaining nutrition\b/i, /\bmanaging nutrition\b/i] },
      { area: 'Maintaining personal hygiene', patterns: [/maintaining\s+personal\s+hygiene/i, /outcomes\s*[-–]\s*personal\s+care/i] },
      { area: 'Managing toilet needs', patterns: [/managing\s+toilet(?:ing)?\s+needs/i] },
      { area: 'Being appropriately clothed', patterns: [/dressing\s*\/\s*undressing/i, /being appropriately clothed/i] },
      { area: 'Maintaining a habitable home environment', patterns: [/maintaining\s+a\s+habitable\s+home\s+environment/i] },
      { area: 'Being able to make use of the home safely', patterns: [/moving\s+around\s+and\s+staying\s+comfortable/i, /being able to make use of (?:the )?home safely/i] },
      { area: 'Making use of necessary facilities or services in the local community including public transport and recreational facilities or services', patterns: [/getting\s+out\s+and\s+about/i, /making use of necessary facilities or services in the local community/i] },
      { area: 'Developing and maintaining family or other personal relationships', patterns: [/maintaining\s+family\s+relationships/i, /developing and maintaining family or other personal relationships/i] },
      { area: 'Accessing and engaging in work, training, education or volunteering', patterns: [/accessing and engaging in work,\s*training,\s*education or volunteering/i] },
      { area: 'Carrying out any caring responsibilities the adult has for a child', patterns: [/carrying out any caring responsibilities/i] },
    ];

    const findHeading = (patterns: RegExp[]): { index: number; length: number } | null => {
      let best: { index: number; length: number } | null = null;
      for (const pattern of patterns) {
        const m = compact.match(pattern);
        if (!m || m.index === undefined) continue;
        if (!best || m.index < best.index) best = { index: m.index, length: m[0].length };
      }
      return best;
    };

    const hits = sections
      .map((section) => {
        const pos = findHeading(section.patterns);
        return pos ? { area: section.area, index: pos.index, length: pos.length } : null;
      })
      .filter((x): x is { area: string; index: number; length: number } => !!x)
      .sort((a, b) => a.index - b.index);

    for (let i = 0; i < hits.length; i += 1) {
      const current = hits[i];
      const next = hits[i + 1];
      const from = current.index + current.length;
      const to = next ? next.index : Math.min(compact.length, from + 2600);
      const block = compact.slice(from, to).trim();
      if (!block) continue;

      const desired = cleanSupportText(
        block.match(/desired outcome\/what does the person want to achieve\?\s*([\s\S]{0,1200}?)(?=(?:the needs identified above|are these needs being currently met|outcomes\s*[-–]\s*|assessment summary and personal outcomes|condition\s*\d|risks?\s*[-–]|$))/i)?.[1] || '',
        950
      );

      const supportLines = parseSmartLines(block, 9).filter((line) =>
        /needs|support|requires|prompt|assist|encourage|maintain|safe|safely|appointment|community|budget|hygiene|meal|diet|relationship|boundary|toileting|clothes/i.test(line)
      );
      const risks = supportLines
        .filter((line) => /risk|exploit|abuse|neglect|lost|debt|safeguard|harm|vulnerab/i.test(line))
        .slice(0, 4)
        .join(' | ');

      const primaryNeed = desired || supportLines.slice(0, 2).join(' | ') || cleanSupportText(block, 800);
      const supportPlan = supportLines.slice(0, 6).join(' | ') || cleanSupportText(block, 1200);

      pushNeed({
        area: current.area,
        canDoMyself: primaryNeed,
        risks,
        howToSupport: supportPlan,
      });
    }
  }

  // PBS fallback parser: derive support needs from sectioned Positive Behaviour Support plans.
  if (
    needs.length < 3 &&
    (
      /positive\s+behaviour\s+support\s+plan/i.test(text) ||
      /section\s*4\s*[—-]\s*proactive\s+strategies/i.test(text) ||
      /section\s*6\s*[—-]\s*reactive\s+strategies/i.test(text)
    )
  ) {
    const compact = normalizeSectionText(text.replace(/\t/g, ' '));
    const envStrategies = extractSectionByMarkers(compact, /4\.1\s*Environmental\s+Strategies/i, [
      /4\.2\s*Routine\s+and\s+Structure/i,
      /4\.3\s*Relationship(?:-|\s*)Based\s+Strategies/i,
      /Section\s*5/i,
    ]);
    const routineStrategies = extractSectionByMarkers(compact, /4\.2\s*Routine\s+and\s+Structure/i, [
      /4\.3\s*Relationship(?:-|\s*)Based\s+Strategies/i,
      /4\.4\s*Communication\s+Strategies/i,
      /Section\s*5/i,
    ]);
    const relationshipStrategies = extractSectionByMarkers(compact, /4\.3\s*Relationship(?:-|\s*)Based\s+Strategies/i, [
      /4\.4\s*Communication\s+Strategies/i,
      /Section\s*5/i,
    ]);
    const communicationStrategies = extractSectionByMarkers(compact, /4\.4\s*Communication\s+Strategies/i, [
      /Section\s*5/i,
      /Section\s*6/i,
    ]);
    const earlyWarnings = extractSectionByMarkers(compact, /Section\s*5\s*[—-]\s*Early\s+Warning\s+Signs/i, [
      /Section\s*6/i,
    ]);
    const reactive = extractSectionByMarkers(compact, /Section\s*6\s*[—-]\s*Reactive\s+Strategies/i, [
      /Section\s*7/i,
    ]);
    const postIncident = extractSectionByMarkers(compact, /Section\s*7\s*[—-]\s*Post-?Incident\s+Support/i, [
      /Section\s*8/i,
      /Section\s*9/i,
    ]);
    const whatWorks = extractSectionByMarkers(compact, /Section\s*8\s*[—-]\s*What\s+Works[\s\S]*?What\s+Does\s+NOT\s+Work/i, [
      /Section\s*9/i,
      /Section\s*11/i,
    ]);

    const proactiveLines = [
      ...parseSmartLines(envStrategies, 4),
      ...parseSmartLines(routineStrategies, 4),
      ...parseSmartLines(relationshipStrategies, 4),
      ...parseSmartLines(communicationStrategies, 4),
    ];
    const warningLines = parseSmartLines(earlyWarnings, 6);
    const reactiveLines = parseSmartLines(reactive, 8);
    const postIncidentLines = parseSmartLines(postIncident, 7);
    const whatWorksLines = parseSmartLines(whatWorks, 7);

    pushNeed({
      area: 'Behaviour Support - Proactive Strategies',
      canDoMyself: 'Use predictable routines, calm communication, and collaborative choices to prevent escalation.',
      risks: warningLines.slice(0, 3).join(' | '),
      howToSupport: dedupe(proactiveLines).join(' | '),
    });

    pushNeed({
      area: 'Behaviour Support - Early Warning Signs',
      canDoMyself: 'Observe and record early signs before behaviour escalates.',
      risks: warningLines.join(' | '),
      howToSupport: 'Lower demands, offer space, use calm tone, and document trigger/context at handover.',
    });

    pushNeed({
      area: 'Behaviour Support - Reactive Response',
      canDoMyself: 'During escalation, prioritise safety and de-escalation over confrontation.',
      risks: 'Escalation can involve verbal aggression, threats, refusal, or unsafe exit from placement.',
      howToSupport: reactiveLines.join(' | '),
    });

    pushNeed({
      area: 'Behaviour Support - Post Incident',
      canDoMyself: 'When calm, reflect with the person and agree preventative steps for next time.',
      risks: 'Risk of repeated incidents if debrief and plan updates are missed.',
      howToSupport: postIncidentLines.join(' | '),
    });

    pushNeed({
      area: 'Behaviour Support - What Works',
      canDoMyself: 'Reinforce known calming supports and avoid known escalation triggers.',
      risks: 'Using non-recommended approaches can increase distress and incident risk.',
      howToSupport: whatWorksLines.join(' | '),
    });
  }

  return { needs, planDate: new Date().toLocaleDateString('en-GB') };
}
