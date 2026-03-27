import { buildWeekSummary, parseUniversalData } from './universal-parser';
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
  unknown: [],
};

export function detectProfile(fileName: string, rawText: string): ProfileMatch {
  const lower = rawText.toLowerCase();
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (
    lower.includes('controlled drugs policy') ||
    lower.includes('daily quality meeting') ||
    lower.includes('quality meeting minutes') ||
    lowerName.includes('policy') ||
    lowerName.includes('quality meeting')
  ) {
    return { id: 'ops-governance', type: 'unknown', confidence: 0.9 };
  }

  if (ext === 'csv' && (lower.includes('diary entry') || lower.includes('incident type') || lower.includes('display from'))) {
    return { id: 'nourish-csv-diary', type: 'diary', confidence: 0.95 };
  }
  if (
    lower.includes('weekly activity plan') ||
    lower.includes('daily 1:1 support') ||
    lowerName.includes('activity planner') ||
    lowerName.includes('notes')
  ) {
    return { id: 'daily-support-notes', type: 'diary', confidence: 0.72 };
  }
  if (ext === 'pdf' && (lower.includes('client diary') || lower.includes('diary for') || lower.includes('display from'))) {
    return { id: 'nourish-pdf-diary', type: 'diary', confidence: 0.82 };
  }
  if (ext === 'pdf' && (/emergency admission pack/i.test(rawText) || /care plan\s*[–-]\s*.+report run on/i.test(rawText))) {
    return { id: 'careplan-admission-pdf', type: 'admission', confidence: 0.9 };
  }
  if (
    lower.includes('incident report') ||
    lower.includes('crisis & contingency plan') ||
    lower.includes('crisis and contingency plan') ||
    lowerName.includes('incident report') ||
    lowerName.includes('crisis and contigency plan')
  ) {
    return { id: 'incident-crisis-doc', type: 'support-plan', confidence: 0.88 };
  }
  if (ext === 'docx' || lower.includes('my support plan') || (lower.includes('what i can do') && lower.includes('how to support'))) {
    return { id: 'support-plan', type: 'support-plan', confidence: ext === 'docx' ? 0.93 : 0.72 };
  }
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
