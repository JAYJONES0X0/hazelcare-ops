import type { FullClient } from './client-store';
import { emptyCarePlan, emptyRisk, emptyRisk_item, type RiskData, type RiskItem } from './client-store';
import type { IntelAnalysisResult } from './intelligence';
import { mergeClientIdentity } from './client-identity-merge';
import { mergeCarePlanData, mergePBSData, mergeRiskData, mergeSupportPlanData } from './intel-merge';
import { buildEnvelopeFromRaw } from './import-profiles';
import { buildCarePlanFromProfileEvidence, buildPBSFromProfileEvidence } from './profile-intelligence-fill';

export type IntelImportKind = 'admission' | 'support-plan' | 'diary' | 'roster' | 'contact-details' | 'unknown' | 'ai';

export interface IntelImportSummary {
  kind: IntelImportKind;
  countLabel: string;
  count: number;
  total?: number;
  parserProfile?: string;
}

export interface IntelImportStatus {
  documentType: IntelImportKind;
  confidence: 'high' | 'medium' | 'low';
  personMatch: string;
  canBuild: string[];
  missing: string[];
  recommendedAction: string;
}

export interface IntelImportSession {
  result: IntelAnalysisResult;
  summary: IntelImportSummary;
  status: IntelImportStatus;
}

function today(): string {
  return new Date().toLocaleDateString('en-GB');
}

function reviewDate(): string {
  return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
}

function emptyResult(): IntelAnalysisResult {
  const planDate = today();
  return {
    client: {},
    carePlan: emptyCarePlan(planDate, reviewDate()),
    risk: emptyRisk(planDate),
    gaps: [],
  };
}

function importStatus(
  kind: IntelImportKind,
  result: IntelAnalysisResult,
  warnings: string[],
  mappedCount: number,
): IntelImportStatus {
  const name = result.client.name || result.client.preferredName || '';
  const hasIdentity = Boolean(name && result.client.dob);
  const riskCount = result.risk?.risks?.filter((risk) => risk.title || risk.description).length || 0;
  const careCount = result.carePlan?.domains?.filter((domain) => domain.enabled).length || 0;
  const supportCount = result.client.supportPlan?.needs?.length || 0;
  const canBuild = [
    riskCount > 0 ? 'Risk' : '',
    (supportCount > 0 || careCount > 0 || riskCount > 0) ? 'Care Plan' : '',
    (supportCount > 0 || riskCount > 0) ? 'PBS' : '',
  ].filter(Boolean);
  const confidence: IntelImportStatus['confidence'] = hasIdentity && mappedCount > 0
    ? 'high'
    : mappedCount > 0 || hasIdentity
      ? 'medium'
      : 'low';
  const missing = warnings.length
    ? warnings
    : [
        !result.client.nhs ? 'NHS number not detected.' : '',
        !result.client.keyWorker ? 'Key worker not detected.' : '',
        !supportCount && !careCount ? 'No care/support areas mapped.' : '',
      ].filter(Boolean);

  return {
    documentType: kind,
    confidence,
    personMatch: name ? `${name}${result.client.dob ? ` (${result.client.dob})` : ''}` : 'No person confidently detected',
    canBuild,
    missing,
    recommendedAction: confidence === 'low'
      ? 'Attach as evidence or run AI before committing.'
      : `Commit to profile; ${canBuild.length ? `auto-build ${canBuild.join(', ')}` : 'review mapped evidence'} after sync.`,
  };
}

function buildRiskScreeningFromSupportPlan(rawText: string, planDate: string): RiskData {
  const risk = emptyRisk(planDate);
  const linear = rawText.replace(/\s+/g, ' ').trim();
  const labels = [
    'Behaviour Issues',
    'Managing Finances/Benefits',
    'Self Neglect',
    'Smoking',
    'Substance Misuse',
    'Employment/meaningful occupation problems',
    'Recent discharge from hospital',
    'Risk from others external to the property',
    'Risk from others within the property',
    'Risk to others',
  ];
  const hits = labels
    .map((label) => {
      const match = linear.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      return match && match.index !== undefined ? { label, index: match.index, length: match[0].length } : null;
    })
    .filter((hit): hit is { label: string; index: number; length: number } => !!hit)
    .sort((a, b) => a.index - b.index);

  const risks: RiskItem[] = [];
  for (let i = 0; i < hits.length; i += 1) {
    const current = hits[i];
    const next = hits[i + 1];
    const block = linear.slice(current.index + current.length, next ? next.index : current.index + current.length + 800).trim();
    if (!/\bOBSERVED\b/i.test(block)) continue;
    const note = block
      .replace(/^OBSERVED\s+No\s+No\s*/i, '')
      .replace(/^OBSERVED\s+Yes\s+Yes\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 900);
    risks.push({
      ...emptyRisk_item(),
      title: current.label,
      description: note || `Observed risk screening item: ${current.label}.`,
      triggers: current.label === 'Behaviour Issues' ? ['Emotional dysregulation', 'Conflict or perceived threat'] : ['See risk screening context'],
      earlyWarnings: current.label === 'Behaviour Issues' ? ['Shouting', 'Pacing', 'Talking to himself', 'Staring or intimidating presentation'] : ['Change from baseline presentation'],
      controls: ['Follow support plan controls, de-escalation guidance, and escalation pathway.'],
      likelihood: /violence|significant|transition|unsupported|substance|self neglect/i.test(note) ? 3 : 2,
      impact: /violence|retaliation|self neglect|substance|significant/i.test(note) ? 4 : 3,
      reviewTrigger: 'Review after any incident, safeguarding concern, transition issue, or change in risk presentation.',
    });
  }

  risk.risks = risks;
  return risk;
}

export function summarizeIntelResult(result: IntelAnalysisResult, kind: IntelImportKind = 'ai'): IntelImportSummary {
  const supportCount = result.client.supportPlan?.needs?.length || 0;
  if (supportCount > 0 && result.carePlan.domains.filter((domain) => domain.enabled).length === 0) {
    return {
      kind: 'support-plan',
      countLabel: 'Support Plan Areas',
      count: supportCount,
    };
  }

  return {
    kind,
    countLabel: 'CQC Domains',
    count: result.carePlan.domains.filter((domain) => domain.enabled).length,
    total: result.carePlan.domains.length,
  };
}

export function buildIntelSessionFromRaw(fileName: string, rawText: string): IntelImportSession {
  const envelope = buildEnvelopeFromRaw(fileName, rawText);
  const base = emptyResult();

  if (envelope.source.detectedType === 'support-plan') {
    const supportPlan = envelope.supportPlan || null;
    const candidate = envelope.clientCandidates[0] || {};
    const count = supportPlan?.needs?.length || 0;
    const result: IntelAnalysisResult = {
        ...base,
        client: {
          ...candidate,
          supportPlan,
        },
        risk: buildRiskScreeningFromSupportPlan(rawText, today()),
        gaps: [
          ...envelope.warnings,
          count > 0
            ? `Detected ${count} support-plan area${count === 1 ? '' : 's'} from the source document.`
            : 'Support plan detected, but no support areas were parsed. Review the extraction text.',
        ],
      };
    return {
      result,
      summary: {
        kind: 'support-plan',
        countLabel: 'Support Plan Areas',
        count,
        parserProfile: envelope.source.parserProfile,
      },
      status: importStatus('support-plan', result, envelope.warnings, count),
    };
  }

  if (envelope.source.detectedType === 'admission' && envelope.admission) {
    const result: IntelAnalysisResult = {
      client: envelope.admission.client,
      carePlan: envelope.admission.carePlan,
      risk: envelope.admission.client.risk || base.risk,
      gaps: envelope.warnings,
    };
    return {
      result,
      summary: {
        ...summarizeIntelResult(result, 'admission'),
        parserProfile: envelope.source.parserProfile,
      },
      status: importStatus('admission', result, envelope.warnings, result.carePlan.domains.filter((domain) => domain.enabled).length),
    };
  }

  const result: IntelAnalysisResult = {
    ...base,
    gaps: envelope.warnings.length
      ? envelope.warnings
      : ['File type could not be confidently mapped. Use AI or attach it as evidence.'],
  };
  return {
    result,
    summary: {
      kind: envelope.source.detectedType,
      countLabel: 'Mapped Areas',
      count: 0,
      parserProfile: envelope.source.parserProfile,
    },
    status: importStatus(envelope.source.detectedType, result, result.gaps, 0),
  };
}

export function mergeIntelAnalysis(base: IntelAnalysisResult, ai: IntelAnalysisResult, planDate: string): IntelAnalysisResult {
  return {
    client: {
      ...ai.client,
      ...base.client,
      diagnoses: [
        ...new Set([
          ...((base.client.diagnoses as string[] | undefined) || []),
          ...((ai.client.diagnoses as string[] | undefined) || []),
        ].filter(Boolean)),
      ],
      supportPlan: base.client.supportPlan || ai.client.supportPlan,
      pbs: ai.client.pbs || base.client.pbs,
    },
    carePlan: mergeCarePlanData(base.carePlan, ai.carePlan, planDate) || base.carePlan,
    risk: mergeRiskData(base.risk, ai.risk, planDate),
    gaps: [
      ...base.gaps,
      ...ai.gaps.filter((gap) => !base.gaps.some((existing) => existing.toLowerCase() === gap.toLowerCase())),
    ],
  };
}

export function applyIntelToClient(base: FullClient, incoming: IntelAnalysisResult, planDate: string): FullClient {
  const identity = mergeClientIdentity(base, incoming.client);
  const review = identity.reviewDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  const withEvidence: FullClient = {
    ...identity,
    carePlan: mergeCarePlanData(base.carePlan, incoming.carePlan, planDate),
    risk: mergeRiskData(base.risk, incoming.risk, planDate),
    pbs: mergePBSData(base.pbs, incoming.client.pbs || null),
    supportPlan: mergeSupportPlanData(base.supportPlan, incoming.client.supportPlan || null),
  };
  const carePlan = buildCarePlanFromProfileEvidence(withEvidence, planDate, review).carePlan;
  const pbs = buildPBSFromProfileEvidence({ ...withEvidence, carePlan }, planDate).pbs;

  return {
    ...withEvidence,
    carePlan,
    pbs,
  };
}
