import { buildWeekSummary, parseUniversalData, parseRosterCSV } from './universal-parser';
import { parseSupportPlanText, parseUniversalText } from './universal-import';
import type { NormalizedImportEnvelope, ImportType, ImportTarget } from './import-intelligence';
import { emptyEnvelope } from './import-intelligence';

interface ProfileMatch {
  id: string;
  type: ImportType;
  confidence: number;
}

const TARGETS_BY_TYPE: Record<ImportType, ImportTarget[]> = {
  diary: ['reports', 'templates'],
  admission: ['client-docs', 'templates'],
  'support-plan': ['client-docs'],
  roster: ['roster'],
  unknown: [],
};

export function detectProfile(fileName: string, rawText: string): ProfileMatch {
  const lower = rawText.toLowerCase();
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const lowerName = fileName.toLowerCase();

  // 1. HIGH PRIORITY: Explicit Filename Hints (If content is messy/short)
  if (lowerName.includes('admission') || lowerName.includes('admission-pack')) {
    return { id: 'careplan-admission-pdf', type: 'admission', confidence: 0.85 };
  }
  if (lowerName.includes('diary') || lowerName.includes('notes')) {
    return { id: 'generic-diary-hint', type: 'diary', confidence: 0.8 };
  }
  if (lowerName.includes('roster')) {
    return { id: 'care-planner-roster', type: 'roster', confidence: 0.85 };
  }

  // 2. Content-Based Policy/Governance
  if (
    lower.includes('controlled drugs policy') ||
    lower.includes('daily quality meeting') ||
    lower.includes('quality meeting minutes') ||
    lowerName.includes('policy') ||
    lowerName.includes('quality meeting')
  ) {
    return { id: 'ops-governance', type: 'unknown', confidence: 0.9 };
  }

  // 3. Legacy & Generic CSV/PDF Diaries
  if (ext === 'csv' && (lower.includes('diary entry') || lower.includes('incident type') || lower.includes('display from') || lower.includes('carer'))) {
    return { id: 'legacy-csv-diary', type: 'diary', confidence: 0.95 };
  }
  if (lower.includes('carer,day,time,client') || (ext === 'csv' && lowerName.includes('roster') && lower.includes('carer'))) {
    return { id: 'care-planner-roster', type: 'roster', confidence: 0.98 };
  }
  if (
    lower.includes('weekly activity plan') ||
    lower.includes('daily 1:1 support') ||
    lowerName.includes('activity planner') ||
    lower.includes('support notes')
  ) {
    return { id: 'daily-support-notes', type: 'diary', confidence: 0.72 };
  }
  if (ext === 'pdf' && (lower.includes('client diary') || lower.includes('diary for') || lower.includes('display from') || lower.includes('occurred'))) {
    return { id: 'legacy-pdf-diary', type: 'diary', confidence: 0.82 };
  }
  if (ext === 'pdf' && (lower.includes('emergency admission') || lower.includes('care plan') || lower.includes('report run on'))) {
    return { id: 'careplan-admission-pdf', type: 'admission', confidence: 0.9 };
  }
  
  // 4. Incident/Crisis Docs
  if (
    lower.includes('incident report') ||
    lower.includes('crisis & contingency plan') ||
    lower.includes('crisis and contingency plan') ||
    lowerName.includes('incident')
  ) {
    return { id: 'incident-crisis-doc', type: 'support-plan', confidence: 0.88 };
  }

  // 5. Support Plans
  if (ext === 'docx' || lower.includes('my support plan') || (lower.includes('what i can do') && lower.includes('how to support'))) {
    return { id: 'support-plan', type: 'support-plan', confidence: ext === 'docx' ? 0.93 : 0.72 };
  }

  // 6. Generic Fallbacks
  if (ext === 'csv') return { id: 'generic-csv-diary', type: 'diary', confidence: 0.65 };
  if (/\d{2}\/\d{2}\/\d{4}/.test(rawText) && (rawText.includes(',') || rawText.includes('|') || rawText.includes('\t'))) {
    return { id: 'generic-delimited-diary', type: 'diary', confidence: 0.58 };
  }
  
  return { id: 'unknown', type: 'unknown', confidence: 0.2 };
}

export function buildEnvelopeFromRaw(fileName: string, rawText: string): NormalizedImportEnvelope {
  const env = emptyEnvelope(fileName, rawText);
  const profile = detectProfile(fileName, rawText);
  env.source.parserProfile = profile.id;
  env.source.detectedType = profile.type;
  env.source.confidence = profile.confidence;
  env.suggestedTargets = TARGETS_BY_TYPE[profile.type];

  if (profile.type === 'diary') {
    const entries = parseUniversalData(rawText);
    env.diaryEntries = entries;
    env.weekSummary = entries.length > 0 ? buildWeekSummary(entries) : null;
    if (!entries.length) env.warnings.push('No diary entries parsed from this file.');
    return env;
  }

  if (profile.type === 'roster') {
    const shifts = parseRosterCSV(rawText, fileName);
    env.shifts = shifts;
    if (!shifts.length) env.warnings.push('No shifts parsed from this roster file.');
    return env;
  }

  if (profile.type === 'admission') {
    const admission = parseUniversalText(rawText);
    env.admission = admission;
    env.clientCandidates = [{
      name: admission.client.name,
      preferredName: admission.client.preferredName,
      dob: admission.client.dob,
      nhs: admission.client.nhs,
    }];
    env.warnings.push(...admission.warnings);
    if (!admission.client.name) env.unmappedFields.push('client.name');
    return env;
  }

  if (profile.type === 'support-plan') {
    const supportPlan = parseSupportPlanText(rawText);
    env.supportPlan = supportPlan;
    const nameMatch = rawText.match(/(?:support plan|my plan)\s*(?:for\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
    env.clientCandidates = nameMatch ? [{ name: nameMatch[1] }] : [];
    if (!supportPlan.needs.length) env.warnings.push('No support areas were detected in this support plan.');
    return env;
  }

  env.warnings.push('File type could not be confidently detected. Choose targets manually.');
  return env;
}
