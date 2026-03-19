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

// Detect if text is from pdf.js (flat, space-separated) vs manually pasted (newline-separated)
function isFlat(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim());
  // If most content is on very few lines, it's flat pdf.js output
  if (lines.length < 10 && text.length > 500) return true;
  // If average line length is very long, it's flat
  const avgLen = text.length / Math.max(lines.length, 1);
  return avgLen > 200;
}

// Smart field extraction that works with both \n and space separators
function extractFieldSmart(text: string, field: string, nextFields: string[]): string {
  // Try newline version first
  let result = extractField(text, field + '\n', nextFields);
  if (result) return result.split('\n')[0].trim();
  // Try space-separated version
  result = extractField(text, field + ' ', nextFields);
  if (result) {
    // For space-separated, take until we hit something that looks like a new field
    return result.split(/\s{2,}/)[0].trim();
  }
  // Try with no separator (field immediately followed by value)
  result = extractField(text, field, nextFields);
  return result.split('\n')[0].trim();
}

// Parse the "Care Plan" report format from Nourish
// Header: "Care Plan – [Name] Report run on [date]"
// Then: "Nourish Support [First] [First] [Last] [Age] years [Address]"
// Then: "2. Care Plans [DOMAIN] Description – CARE PLAN [NAME] ..."
function parseCarePlanReport(text: string, warnings: string[]): { client: Partial<FullClient>; carePlan: CarePlanData } {
  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  const carePlan = emptyCarePlan(today, reviewDate);

  // Extract name from "Care Plan – [Name] Report run on"
  let name = '';
  let preferredName = '';
  const headerMatch = text.match(/Care Plan\s*[–\-]\s*(.+?)\s*Report run on/i);
  if (headerMatch) {
    name = headerMatch[1].trim();
    preferredName = name.split(' ')[0];
  }

  // Try to extract from "Nourish Support [First] [First] [Last] [Age] years [Address]"
  let address = '';
  const nourishMatch = text.match(/Nourish Support\s+(\w+)\s+\w+\s+(\w+)\s+(\d+)\s+years?\s+(.+?)(?:,\s*\d+\.\s*Needs|$)/i);
  if (nourishMatch) {
    if (!name) {
      name = `${nourishMatch[1]} ${nourishMatch[2]}`.trim();
      preferredName = nourishMatch[1];
    }
    address = nourishMatch[4]?.trim() || '';
  }

  // Extract date of report
  const dateMatch = text.match(/Report run on\s+(\d{2}\/\d{2}\/\d{4})/);

  // Find all domain sections in the text
  // Nourish Care Plan format: "[DOMAIN NAME] Description – CARE PLAN [NAME] [content]"
  // Or: "[DOMAIN NAME] Description –" (with content after)
  const domainKeys = Object.keys(DOMAIN_MAP);
  const upper = text.toUpperCase();

  for (const domainKey of domainKeys) {
    const mappedName = DOMAIN_MAP[domainKey];
    const domainIdx = carePlan.domains.findIndex(d => d.title === mappedName);
    if (domainIdx === -1) continue;

    // Find this domain in the text (case-insensitive)
    const keyIdx = upper.indexOf(domainKey);
    if (keyIdx === -1) continue;

    // Find next domain or end of text
    let sectionEnd = text.length;
    for (const otherKey of domainKeys) {
      if (otherKey === domainKey) continue;
      const otherIdx = upper.indexOf(otherKey, keyIdx + domainKey.length + 10);
      if (otherIdx !== -1 && otherIdx < sectionEnd) sectionEnd = otherIdx;
    }
    // Also check for section boundaries like "3. " or "Page "
    const nextSectionMatch = text.slice(keyIdx + domainKey.length).match(/\d+\.\s+(Needs Assessing|Care Plans|Assessments)/i);
    if (nextSectionMatch && nextSectionMatch.index !== undefined) {
      const possibleEnd = keyIdx + domainKey.length + nextSectionMatch.index;
      if (possibleEnd < sectionEnd) sectionEnd = possibleEnd;
    }

    const section = text.slice(keyIdx, sectionEnd);

    // Extract the content after "Description –" or "Description -"
    let content = '';
    const descMatch = section.match(/Description\s*[–\-]\s*(.*)/is);
    if (descMatch) {
      content = descMatch[1].trim();
    }

    // Try to extract "CARE PLAN [NAME] [actual content]"
    const carePlanMatch = content.match(/CARE PLAN\s+\w+\s+(.*)/is);
    if (carePlanMatch) {
      content = carePlanMatch[1].trim();
    }

    // Try structured fields (these may appear with spaces or newlines)
    const identifiedNeed = extractFieldSmart(section, 'Identified Need', ['Level of need', 'Planned Outcomes', 'Description']);
    const levelText = extractFieldSmart(section, 'Level of need', ['Planned Outcomes', 'How to', 'Description']);
    const plannedOutcomes = extractFieldSmart(section, 'Planned Outcomes', ['How to Achieve', 'Risk', 'Description']);
    const howToAchieve = extractFieldSmart(section, 'How to Achieve', ['Risk', 'Review', 'Likelihood', 'Description']);

    // Risk fields
    const riskTitle = extractFieldSmart(section, 'Risk', ['Likelihood', 'Review note', 'Reviewer', 'Description']);
    const likelihoodText = extractFieldSmart(section, 'Likelihood', ['Impact', 'Total', 'Review']);
    const impactText = extractFieldSmart(section, 'Impact', ['Total', 'Review', 'Risk']);

    // Review fields
    const reviewNote = extractFieldSmart(section, 'Review note', ['Reviewer', 'Page', 'Next']);
    const reviewer = extractFieldSmart(section, 'Reviewer', ['Review date', 'Page', 'Next']);
    const reviewDateVal = extractFieldSmart(section, 'Review date', ['Page', 'Next review']);
    const nextReviewDateVal = extractFieldSmart(section, 'Next review date', ['Identified Need', 'Level', 'Description']);

    // Parse level of need
    let levelOfNeed = 0;
    const levelLower = levelText.toLowerCase();
    for (const [key, val] of Object.entries(LEVEL_MAP)) {
      if (levelLower.includes(key)) { levelOfNeed = val; break; }
    }
    // Also check the section content for level indicators
    if (levelOfNeed === 0) {
      const sectionLower = section.toLowerCase();
      for (const [key, val] of Object.entries(LEVEL_MAP)) {
        if (sectionLower.includes(key)) { levelOfNeed = val; break; }
      }
    }

    // Use content as identified need if structured extraction failed
    const finalNeed = identifiedNeed || content.slice(0, 500);

    // Only enable if we found real content (not just the domain header)
    const hasContent = !!(finalNeed && finalNeed.length > 5);

    const domain: CarePlanDomain = {
      ...carePlan.domains[domainIdx],
      identifiedNeed: finalNeed,
      levelOfNeed,
      plannedOutcomes: plannedOutcomes,
      howToAchieve: howToAchieve,
      riskTitle: riskTitle.split(/[\n]/)[0].trim(),
      riskLikelihood: parseLikelihood(likelihoodText),
      riskImpact: parseImpact(impactText),
      riskMitigation: '',
      reviewNote: reviewNote,
      reviewer: reviewer,
      reviewDate: reviewDateVal || (dateMatch ? dateMatch[1] : ''),
      nextReviewDate: nextReviewDateVal,
      enabled: hasContent,
    };

    carePlan.domains[domainIdx] = domain;
  }

  return {
    client: {
      name,
      preferredName,
      address,
    },
    carePlan,
  };
}

export function parseNourishText(rawText: string): ParseResult {
  const warnings: string[] = [];
  const text = rawText.replace(/\r\n/g, '\n');
  const flat = isFlat(text);

  // Detect format: "Care Plan –" header = Care Plan report format
  const isCarePlanReport = /Care Plan\s*[–\-]\s*.+Report run on/i.test(text);

  if (isCarePlanReport || flat) {
    // Use the Care Plan report parser (handles flat pdf.js output)
    const result = parseCarePlanReport(text, warnings);
    const enabledCount = result.carePlan.domains.filter(d => d.enabled).length;

    if (enabledCount === 0) {
      // Even if structured parsing failed, mark domains as enabled if their header was found
      const upper = text.toUpperCase();
      const domainKeys = Object.keys(DOMAIN_MAP);
      for (const domainKey of domainKeys) {
        if (upper.includes(domainKey)) {
          const mappedName = DOMAIN_MAP[domainKey];
          const idx = result.carePlan.domains.findIndex(d => d.title === mappedName);
          if (idx !== -1) {
            result.carePlan.domains[idx].enabled = true;
            result.carePlan.domains[idx].identifiedNeed = result.carePlan.domains[idx].identifiedNeed || 'Imported from Nourish — needs review';
          }
        }
      }
      const foundCount = result.carePlan.domains.filter(d => d.enabled).length;
      if (foundCount === 0) {
        warnings.push('No support plan areas were detected — check the pasted text format.');
      } else {
        warnings.push(`Found ${foundCount} of ${CARE_PLAN_DOMAINS.length} areas. Content needs review — PDF text was compressed.`);
      }
    } else {
      warnings.push(`Found ${enabledCount} of ${CARE_PLAN_DOMAINS.length} areas of this person's life.`);
    }

    return { client: result.client, carePlan: result.carePlan, warnings };
  }

  // Original newline-delimited parser (manually pasted text)
  const firstName = extractField(text, 'First Name\n', ['Last Name', 'Preferred Name']).split('\n')[0].trim();
  const lastName = extractField(text, 'Last Name\n', ['Preferred Name', 'Gender']).split('\n')[0].trim();
  const preferredName = extractField(text, 'Preferred Name\n', ['Gender', 'Date of Birth']).split('\n')[0].trim();
  const dob = extractField(text, 'Date of Birth\n', ['Email', 'NHS']).split('\n')[0].trim();
  const nhs = extractField(text, 'NHS / CHI No.\n', ['Deprivation', 'Gold']).split('\n')[0].trim();
  const phone = extractField(text, 'Contact Number\n', ['Quick notes', 'CRITICAL']).split('\n')[0].trim();
  const name = `${firstName} ${lastName}`.trim();

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
    let nextCarePlanIdx = text.indexOf('2. Care Plans', sectionStart + domainKey.length);
    if (nextCarePlanIdx !== -1 && nextCarePlanIdx < sectionEnd) sectionEnd = nextCarePlanIdx;

    const section = text.slice(sectionStart, sectionEnd);

    const identifiedNeed = extractField(section, 'Identified Need\n', ['Level of need', 'Planned Outcomes']);
    const levelText = extractField(section, 'Level of need\n', ['Planned Outcomes', 'How to']);
    const plannedOutcomes = extractField(section, 'Planned Outcomes\n', ['How to Achieve', 'Risk\n']);
    const howToAchieve = extractField(section, 'How to Achieve Outcomes\n', ['Risk\n', 'Review note', 'Likelihood']);

    const riskTitle = extractField(section, 'Risk\n', ['Likelihood', 'Review note', 'Reviewer']);
    const likelihoodText = extractField(section, 'Likelihood\n', ['=', 'Impact']);
    const impactText = extractField(section, 'Impact\n', ['Risk\n', 'Total score', 'Review']);

    const reviewNote = extractField(section, 'Review note\n', ['Reviewer', 'Page']);
    const reviewer = extractField(section, 'Reviewer\n', ['Review date', 'Page', '2. Care Plans']);
    const reviewDateVal = extractField(section, 'Review date\n', ['Page', '2. Care Plans', '\n\n']);
    const nextReviewDate = extractField(section, 'Next review date\n', ['Identified Need', 'Level of need']);

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
