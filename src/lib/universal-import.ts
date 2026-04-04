// ============================================================
// HAZEL CARE UNIVERSAL IMPORT — Intelligent Data Mapping
// ============================================================
import type { FullClient, CarePlanData, SupportPlanData, SupportPlanNeed, RiskData, RiskItem } from './client-store';
import { emptyCarePlan, emptyRisk, emptyRisk_item, CARE_PLAN_DOMAINS } from './client-store';

// Maps legacy industry jargon to Premium Hazel Care Domains
const DOMAIN_MAP: Record<string, string> = {
  'ACCOMMODATION CLEANLINESS AND COMFORT': 'Environment & Physical Safety',
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

function parseCarePlanReport(text: string): { client: Partial<FullClient>; carePlan: CarePlanData } {
  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  const carePlan = emptyCarePlan(today, reviewDate);

  let name = '';
  let preferredName = '';
  const headerMatch = text.match(/(?:Care Plan|Emergency Admission Pack)\s*[–-]\s*(.+?)\s*Report run on/i);
  if (headerMatch) {
    name = headerMatch[1].trim();
    preferredName = name.split(' ')[0];
  }

  let address = '';
  const hcMatch = text.match(/(?:Hazel Care Support|Hazel Care)\s+(\w+)\s+\w+\s+(\w+)\s+(\d+)\s+years?\s+(.+?)(?:,\s*\d+\.\s*Needs|$)/i);
  if (hcMatch) {
    if (!name) {
      name = `${hcMatch[1]} ${hcMatch[2]}`.trim();
      preferredName = hcMatch[1];
    }
    address = hcMatch[4]?.trim() || '';
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

  const isCarePlanReport = /(?:Care Plan|Emergency Admission Pack)\s*[–-]\s*.+Report run on/i.test(text);

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
  const firstName = extractField(text, 'First Name\n', ['Last Name', 'Preferred Name']).split('\n')[0].trim();
  const lastName = extractField(text, 'Last Name\n', ['Preferred Name', 'Gender']).split('\n')[0].trim();
  let preferredNameNL = extractField(text, 'Preferred Name\n', ['Gender', 'Date of Birth']).split('\n')[0].trim();
  const dob = extractField(text, 'Date of Birth\n', ['Email', 'NHS']).split('\n')[0].trim();
  const nhs = extractField(text, 'NHS / CHI No.\n', ['Deprivation', 'Gold']).split('\n')[0].trim();
  const phone = extractField(text, 'Contact Number\n', ['Quick notes', 'CRITICAL']).split('\n')[0].trim();
  let name = `${firstName} ${lastName}`.trim();

  if (!name || name.length < 2) {
    const hdrMatch = text.match(/(?:Care Plan|Emergency Admission Pack)\s*[–-]\s*(.+?)(?:\n|Report run on)/i);
    if (hdrMatch) {
      name = hdrMatch[1].trim();
      preferredNameNL = preferredNameNL || name.split(' ')[0];
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
    client: { name, preferredName: preferredNameNL, dob, address, nhs, phone, keyWorker, dateOfAdmission, risk },
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
  ];

  const lines = text.split('\n');
  let currentArea = '';
  let canDo = '';
  let risks = '';
  let howToSupport = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineLower = line.toLowerCase();
    const isNewArea = areaPatterns.some(p => lineLower.includes(p.toLowerCase()));
    if (isNewArea && line.length < 100) {
      if (currentArea && (canDo || risks || howToSupport)) {
        needs.push({ area: currentArea, canDoMyself: canDo, risks, howToSupport });
      }
      currentArea = line;
      canDo = ''; risks = ''; howToSupport = '';
      continue;
    }
    if (line.includes('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4) {
        if (currentArea) needs.push({ area: currentArea, canDoMyself: canDo, risks, howToSupport });
        currentArea = cols[0]; canDo = cols[1]; risks = cols[2]; howToSupport = cols[3];
      }
    }
  }
  if (currentArea && (canDo || risks || howToSupport)) {
    needs.push({ area: currentArea, canDoMyself: canDo, risks, howToSupport });
  }
  return { needs, planDate: new Date().toLocaleDateString('en-GB') };
}
