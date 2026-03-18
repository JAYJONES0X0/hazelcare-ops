// ============================================================
// NOURISH IMPORT PARSER — parses Nourish PDF text into person data
// ============================================================
import type { FullClient, CarePlanDomain, CarePlanData, SupportPlanData, SupportPlanNeed } from './client-store';
import { emptyCarePlan, CARE_PLAN_DOMAINS } from './client-store';

// ─── NOURISH EMERGENCY ADMISSION PACK PARSER ────────────────────────────────────
// Parses text extracted from Nourish's "Emergency Admission Pack" PDF export
// Creates a person-centred support plan from the imported data

const DOMAIN_MAP: Record<string, string> = {
  'ACCOMMODATION CLEANLINESS AND COMFORT': 'Accommodation Cleanliness and Comfort',
  'BREATHING': 'Breathing',
  'COMMUNICATION AND SENSES': 'Communication and Senses',
  'COMPANIONSHIP, SOCIAL INTERACTION AND RECREATION': 'Companionship, Social Interaction and Recreation',
  'DAILY ROUTINE': 'Daily Routine',
  'EATING AND DRINKING': 'Eating and Drinking',
  'ELIMINATION': 'Elimination',
  'ENVIRONMENT': 'Environment',
  'EQUALITY, DIVERSITY AND INCLUSION': 'Equality, Diversity and Inclusion',
  'EXPRESSING SEXUALITY': 'Expressing Sexuality',
  'FINANCIAL': 'Financial',
  'HEALTH AND WELLBEING': 'Health and Wellbeing',
  'INFECTION PREVENTION AND CONTROL': 'Infection Prevention and Control',
  'MEDICATION': 'Medication',
  'MENTAL HEALTH AND COGNITION': 'Mental Health and Cognition',
  'MOBILITY': 'Mobility',
  'PAIN': 'Pain',
  'PERSONAL CARE AND DRESSING': 'Personal Care and Dressing',
  'SKIN INTEGRITY': 'Skin Integrity',
  'SLEEPING': 'Sleeping',
  'SPIRITUALITY, RELIGION AND CULTURE': 'Spirituality, Religion and Culture',
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

export interface ParseResult {
  client: Partial<FullClient>;
  carePlan: CarePlanData;
  warnings: string[];
}

export function parseNourishText(rawText: string): ParseResult {
  const warnings: string[] = [];
  const text = rawText.replace(/\r\n/g, '\n');

  // Extract basic person details
  const firstName = extractField(text, 'First Name\n', ['Last Name', 'Preferred Name']).split('\n')[0].trim();
  const lastName = extractField(text, 'Last Name\n', ['Preferred Name', 'Gender']).split('\n')[0].trim();
  const preferredName = extractField(text, 'Preferred Name\n', ['Gender', 'Date of Birth']).split('\n')[0].trim();
  const dob = extractField(text, 'Date of Birth\n', ['Email', 'NHS']).split('\n')[0].trim();
  const nhs = extractField(text, 'NHS / CHI No.\n', ['Deprivation', 'Gold']).split('\n')[0].trim();
  const phone = extractField(text, 'Contact Number\n', ['Quick notes', 'CRITICAL']).split('\n')[0].trim();
  const name = `${firstName} ${lastName}`.trim();

  // Address
  const street = extractField(text, 'Street Address\n', ['Town', 'County']).split('\n')[0].trim();
  const town = extractField(text, 'Town\n', ['County', 'Post Code']).split('\n')[0].trim();
  const postCode = extractField(text, 'Post Code\n', ['Country', 'National']).split('\n')[0].trim();
  const address = [street, town, postCode].filter(Boolean).join(', ');

  // Admission date
  const dateOfAdmission = extractField(text, 'Date of Admission\n', ['Leave date', 'Key Workers']).split('\n')[0].trim();

  // Key worker
  const keyWorker = extractField(text, 'Key Workers\n', ['Last modified', 'BIOGRAPHY']).split('\n')[0].trim();

  // Biography
  const biography = extractBetween(text, 'BIOGRAPHY\n', ['2. Care Plans', 'CARE PLAN']);
  const bioClean = biography.replace(/^[A-Z\s]+\n/, '').trim();

  // Critical info
  const criticalInfo = extractBetween(text, 'CRITICAL INFORMATION\n', ['SLEEPING', 'ABILITIES', 'EMERGENCY']);

  // Emergency info
  const emergencyInfo = extractBetween(text, 'EMERGENCY INFORMATION\n', ['ADDITIONAL INFO', 'Street Address']);

  // Parse care plan domains
  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  const carePlan = emptyCarePlan(today, reviewDate);
  carePlan.biography = bioClean;
  carePlan.criticalInfo = criticalInfo;
  carePlan.emergencyInfo = emergencyInfo;

  // Split text into care plan sections
  const domainKeys = Object.keys(DOMAIN_MAP);
  for (const domainKey of domainKeys) {
    const mappedName = DOMAIN_MAP[domainKey];
    const domainIdx = carePlan.domains.findIndex(d => d.title === mappedName);
    if (domainIdx === -1) continue;

    // Find this domain section in the text
    const sectionStart = text.indexOf(domainKey);
    if (sectionStart === -1) continue;

    // Find next domain or end
    let sectionEnd = text.length;
    for (const otherKey of domainKeys) {
      if (otherKey === domainKey) continue;
      const otherIdx = text.indexOf(otherKey, sectionStart + domainKey.length + 50);
      if (otherIdx !== -1 && otherIdx < sectionEnd) sectionEnd = otherIdx;
    }
    // Also check for "2. Care Plans" as a section boundary
    let nextCarePlanIdx = text.indexOf('2. Care Plans', sectionStart + domainKey.length);
    if (nextCarePlanIdx !== -1 && nextCarePlanIdx < sectionEnd) sectionEnd = nextCarePlanIdx;

    const section = text.slice(sectionStart, sectionEnd);

    // Extract fields
    const identifiedNeed = extractField(section, 'Identified Need\n', ['Level of need', 'Planned Outcomes']);
    const levelText = extractField(section, 'Level of need\n', ['Planned Outcomes', 'How to']);
    const plannedOutcomes = extractField(section, 'Planned Outcomes\n', ['How to Achieve', 'Risk\n']);
    const howToAchieve = extractField(section, 'How to Achieve Outcomes\n', ['Risk\n', 'Review note', 'Likelihood']);

    // Risk
    const riskTitle = extractField(section, 'Risk\n', ['Likelihood', 'Review note', 'Reviewer']);
    const likelihoodText = extractField(section, 'Likelihood\n', ['=', 'Impact']);
    const impactText = extractField(section, 'Impact\n', ['Risk\n', 'Total score', 'Review']);

    // Review
    const reviewNote = extractField(section, 'Review note\n', ['Reviewer', 'Page']);
    const reviewer = extractField(section, 'Reviewer\n', ['Review date', 'Page', '2. Care Plans']);
    const reviewDateVal = extractField(section, 'Review date\n', ['Page', '2. Care Plans', '\n\n']);
    const nextReviewDate = extractField(section, 'Next review date\n', ['Identified Need', 'Level of need']);

    // Parse level of need
    let levelOfNeed = 0;
    const levelLower = levelText.toLowerCase().trim();
    for (const [key, val] of Object.entries(LEVEL_MAP)) {
      if (levelLower.includes(key)) { levelOfNeed = val; break; }
    }

    const domain: CarePlanDomain = {
      ...carePlan.domains[domainIdx],
      identifiedNeed: identifiedNeed.trim(),
      levelOfNeed,
      plannedOutcomes: plannedOutcomes.trim(),
      howToAchieve: howToAchieve.trim(),
      riskTitle: riskTitle.split('\n')[0].trim(),
      riskLikelihood: parseLikelihood(likelihoodText),
      riskImpact: parseImpact(impactText),
      riskMitigation: riskTitle.includes('\n') ? riskTitle.split('\n').slice(1).join('\n').trim() : '',
      reviewNote: reviewNote.trim(),
      reviewer: reviewer.split('\n')[0].trim(),
      reviewDate: reviewDateVal.split('\n')[0].trim(),
      nextReviewDate: nextReviewDate.split('\n')[0].trim(),
      enabled: !!identifiedNeed.trim(),
    };

    carePlan.domains[domainIdx] = domain;
  }

  const enabledCount = carePlan.domains.filter(d => d.enabled).length;
  if (enabledCount === 0) {
    warnings.push('No support plan areas were detected — check the pasted text format.');
  } else {
    warnings.push(`Found ${enabledCount} of ${CARE_PLAN_DOMAINS.length} areas of this person's life.`);
  }

  return {
    client: {
      name,
      preferredName,
      dob,
      address,
      nhs,
      phone,
      keyWorker,
      dateOfAdmission,
    },
    carePlan,
    warnings,
  };
}

// ─── SUPPORT PLAN PARSER (Word doc table format) ──────────────────────────────
// Parses pasted text from "My Support Plan" DOCX format (table with 4 cols)

export function parseSupportPlanText(rawText: string): SupportPlanData {
  const text = rawText.replace(/\r\n/g, '\n');
  const needs: SupportPlanNeed[] = [];

  // The support plan has sections like "My mental health", "My physical Health", etc.
  // Each with: area | what I can do | risk | how to support
  const areaPatterns = [
    'My mental health', 'My physical Health', 'My annual health check', 'My dental health',
    'Medication', 'Nutrition', 'Persona hygiene', 'Personal hygiene', 'Keeping Warm',
    'Toilet needs', 'Going to bed', 'Managing finance', 'Safety', 'Education',
    'Social inclusion', 'Communication', 'Transport',
  ];

  // Split by table separators or known section headers
  const lines = text.split('\n');
  let currentArea = '';
  let canDo = '';
  let risks = '';
  let howToSupport = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineLower = line.toLowerCase();

    // Check if this line starts a new area
    const isNewArea = areaPatterns.some(p => lineLower.includes(p.toLowerCase()));
    if (isNewArea && line.length < 100) {
      // Save previous if exists
      if (currentArea && (canDo || risks || howToSupport)) {
        needs.push({ area: currentArea, canDoMyself: canDo, risks, howToSupport });
      }
      currentArea = line;
      canDo = '';
      risks = '';
      howToSupport = '';
      continue;
    }

    // Try to detect columns by pipes or tabs
    if (line.includes('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4) {
        if (currentArea) {
          needs.push({ area: currentArea, canDoMyself: canDo, risks, howToSupport });
        }
        currentArea = cols[0];
        canDo = cols[1];
        risks = cols[2];
        howToSupport = cols[3];
      }
    }
  }

  // Save last
  if (currentArea && (canDo || risks || howToSupport)) {
    needs.push({ area: currentArea, canDoMyself: canDo, risks, howToSupport });
  }

  return {
    needs,
    planDate: new Date().toLocaleDateString('en-GB'),
  };
}
