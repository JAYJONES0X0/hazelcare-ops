import { buildWeekSummary, parseUniversalData, parseRosterCSV } from './universal-parser';
import { parseSupportPlanText, parseUniversalText } from './universal-import';
import type { NormalizedImportEnvelope, ImportType, ImportTarget } from './import-intelligence';
import { emptyEnvelope } from './import-intelligence';

interface ProfileMatch {
  id: string;
  type: ImportType;
  confidence: number;
}

function cleanCandidateName(input: string): string {
  const cleaned = input
    .replace(/\s+\(1:1\)\s*$/i, '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(mr|mrs|ms|miss|mx|dr)\.?\s+/i, '')
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return '';
  if (tokens.some((t) => /^(date|birth|gender|deceased|full|name|person|id)$/i.test(t))) return '';
  return `${tokens[0]} ${tokens[1]}`;
}

function inferNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  const match = base.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
  return match ? `${match[1]} ${match[2]}` : '';
}

function extractSupportPlanCandidate(rawText: string, fileName: string): string {
  const prepared = rawText.match(/prepared\s+for\s+(.+?)(?=\b(full\s*name|date\s*of\s*birth|nhs|plan\s*date|review\s*date|key\s*worker)\b|\n|$)/i);
  if (prepared?.[1]) {
    const cleaned = cleanCandidateName(prepared[1]);
    if (cleaned && !/^prepared for$/i.test(cleaned)) return cleaned;
  }

  const personNameHeader = rawText.match(/person\s*name\s*[:-]\s*([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})\s+person\s*id/i);
  if (personNameHeader?.[1]) {
    const cleaned = cleanCandidateName(personNameHeader[1]);
    if (cleaned) return cleaned;
  }

  const nameKnownAs = rawText.match(/\bname\s+(?:mr|mrs|ms|miss|mx|dr)\.?\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})\s+known\s+as\b/i);
  if (nameKnownAs?.[1]) {
    const cleaned = cleanCandidateName(nameKnownAs[1]);
    if (cleaned) return cleaned;
  }

  const serviceUser = rawText.match(/service\s*user\s*name\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})(?=\s+(date\s*of\s*birth|dob|address|nhs)\b|$)/i);
  if (serviceUser?.[1]) {
    const cleaned = cleanCandidateName(serviceUser[1]);
    if (cleaned) return cleaned;
  }

  const personRow = rawText.match(/person\s*id\s+full\s*name\s+date\s*of\s*birth[\s\S]{0,160}?(?:mr|mrs|ms|miss|mx|dr)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (personRow?.[1]) {
    const cleaned = cleanCandidateName(personRow[1]);
    if (cleaned) return cleaned;
  }

  const titled = rawText.match(/\b(?:mr|mrs|ms|miss|mx|dr)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/i);
  if (titled?.[1]) {
    const cleaned = cleanCandidateName(titled[1]);
    if (cleaned) return cleaned;
  }

  const fullNameRow = rawText.match(/full\s*name[\s:-]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?=\s+(date|dob|nhs|gender|deceased)\b|$)/i);
  if (fullNameRow?.[1]) {
    const cleaned = cleanCandidateName(fullNameRow[1]);
    if (cleaned) return cleaned;
  }

  return inferNameFromFileName(fileName);
}

function looksLikeDelimitedDiaryText(rawText: string): boolean {
  const lines = rawText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) return false;

  const delimiters: Array<',' | '|' | '\t'> = [',', '|', '\t'];
  const diaryHeaders = /(date|entry|note|notes|carer|client|house|time|type|comment|body|text|timestamp|tag|personnel|subject|patient)\b/i;
  const leadingDateRows = lines.filter((line) => /^\s*\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(\s*[,|\t]|\s*$)/.test(line) || /^\s*date\s*[,|\t]/i.test(line)).length;

  for (const delimiter of delimiters) {
    const delimiterLines = lines.filter((line) => line.includes(delimiter));
    if (delimiterLines.length < 3) continue;

    const multiCellLines = delimiterLines.filter((line) => line.split(delimiter).length >= 3).length;
    const hasHeaderSignal = lines.some((line) => diaryHeaders.test(line));

    if (multiCellLines >= 3 && hasHeaderSignal && leadingDateRows >= 2) return true;
  }

  return false;
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
  const normalized = lower.replace(/\s+/g, ' ').trim();
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const lowerName = fileName.toLowerCase();

  // 1. HIGH PRIORITY: Explicit Filename Hints (If content is messy/short)
  if (lowerName.includes('admission') || lowerName.includes('admission-pack')) {
    return { id: 'careplan-admission-pdf', type: 'admission', confidence: 0.85 };
  }
  if (lowerName.includes('careplan') || lowerName.includes('care plan')) {
    return { id: 'careplan-filename', type: 'admission', confidence: 0.86 };
  }
  if (lowerName.includes('risk assessment') || lowerName.includes('risk-assessment')) {
    return { id: 'risk-assessment-pdf', type: 'admission', confidence: 0.93 };
  }
  if (lowerName.includes('risk compatibility') || lowerName.includes('compatibility risk')) {
    return { id: 'risk-compatibility-pdf', type: 'admission', confidence: 0.92 };
  }
  if (lowerName.includes('support plan')) {
    return { id: 'support-plan-filename', type: 'support-plan', confidence: 0.9 };
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

  if (
    normalized.includes('adult - needs re-assessment') ||
    normalized.includes('adult - needs reassessment') ||
    (normalized.includes('assessment summary and personal outcomes') && normalized.includes('care act domain')) ||
    (normalized.includes('condition 1') && normalized.includes('condition 2') && normalized.includes('condition 3') && normalized.includes('managing and maintaining nutrition'))
  ) {
    return { id: 'care-act-needs-reassessment', type: 'support-plan', confidence: 0.9 };
  }

  // 3. High-priority PDF clinical documents (must win before diary heuristics)
  if (
    ext === 'pdf' &&
    (
      normalized.includes('emergency admission') ||
      normalized.includes('report run on') ||
      /(?:care plan|emergency admission pack)\s*[-â€“]\s*/i.test(normalized)
    )
  ) {
    return { id: 'careplan-admission-pdf', type: 'admission', confidence: 0.9 };
  }
  if (
    ext === 'pdf' &&
    (
      normalized.includes('clinical risk assessment') ||
      normalized.includes('risk compatibility assessment') ||
      normalized.includes('compatibility risk assessment') ||
      /risk\s*area\s*\d+\s*:/.test(lower) ||
      normalized.includes('risk control protocol')
    )
  ) {
    return { id: 'risk-assessment-pdf', type: 'admission', confidence: 0.92 };
  }
  if (ext === 'pdf' && (normalized.includes('my support plan') || normalized.includes('support plan'))) {
    return { id: 'support-plan-pdf', type: 'support-plan', confidence: 0.86 };
  }

  // 4. Legacy & Generic CSV/PDF Diaries
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
  
  // 5. Incident/Crisis Docs
  const incidentDocSignal =
    (
      lower.includes('incident report') &&
      (
        lower.includes('incident date') ||
        lower.includes('incident type') ||
        lower.includes('service user') ||
        lower.includes('body map') ||
        lower.includes('antecedent')
      )
    ) ||
    lower.includes('crisis & contingency plan') ||
    lower.includes('crisis and contingency plan') ||
    lowerName.includes('incident');

  if (incidentDocSignal) {
    return { id: 'incident-crisis-doc', type: 'support-plan', confidence: 0.88 };
  }

  const docxSupportHint =
    ext === 'docx' &&
    (
      lowerName.includes('support plan') ||
      normalized.includes('my support plan') ||
      normalized.includes('positive behaviour support plan') ||
      normalized.includes('care act domain') ||
      normalized.includes('adult - needs re-assessment') ||
      normalized.includes('what i need help with') ||
      normalized.includes('what we are working towards') ||
      normalized.includes('need description need comment outcome comment')
    );

  // 6. Support Plans
  if (
    docxSupportHint ||
    normalized.includes('my support plan') ||
    normalized.includes('positive behaviour support plan') ||
    (lower.includes('what i can do') && lower.includes('how to support'))
  ) {
    return { id: 'support-plan', type: 'support-plan', confidence: docxSupportHint ? 0.93 : 0.72 };
  }

  // 7. Generic Fallbacks
  if (ext === 'csv') return { id: 'generic-csv-diary', type: 'diary', confidence: 0.65 };
  if (ext !== 'pdf' && looksLikeDelimitedDiaryText(rawText) && /\d{2}\/\d{2}\/\d{4}/.test(rawText)) {
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
    const fallbackName = admission.client.name || inferNameFromFileName(fileName);
    env.clientCandidates = [{
      name: fallbackName,
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
    const candidateName = extractSupportPlanCandidate(rawText, fileName);
    env.clientCandidates = candidateName ? [{ name: candidateName }] : [];
    if (!supportPlan.needs.length) env.warnings.push('No support areas were detected in this support plan.');
    return env;
  }

  env.warnings.push('File type could not be confidently detected. Choose targets manually.');
  return env;
}

