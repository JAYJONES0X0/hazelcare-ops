import type { FullClient, CarePlanData, CarePlanDomain, RiskData, RiskItem, PBSData, DiagnosisRow, FunctionRow, WarningSignRow, MedicationRow, AgencyRow, SupportPlanData, SupportPlanNeed } from './client-store';
import { emptyRisk, emptyRisk_item } from './client-store';

/**
 * HAZELCARE INTEL MERGE — Additive Data Syncing
 * Ensures that new imports/uploads append to or refine existing data rather than wiping it.
 */

function clean(text: string | undefined | null): string {
  if (!text) return '';
  return text.split('\u0000').join('').replace(/\s+/g, ' ').trim();
}

function hasText(text: string | undefined | null): boolean {
  return clean(text).length > 0;
}

export function hasMeaningfulRiskData(risk: RiskData | null | undefined): boolean {
  if (!risk) return false;
  return (risk.risks || []).some((r) =>
    hasText(r.title) ||
    hasText(r.description) ||
    (r.controls || []).some(hasText) ||
    (r.triggers || []).some(hasText) ||
    (r.earlyWarnings || []).some(hasText)
  );
}

export function hasMeaningfulCarePlanData(carePlan: CarePlanData | null | undefined): boolean {
  if (!carePlan) return false;
  if (hasText(carePlan.biography) || hasText(carePlan.criticalInfo) || hasText(carePlan.emergencyInfo)) return true;
  return (carePlan.domains || []).some((d) =>
    d.enabled ||
    hasText(d.identifiedNeed) ||
    hasText(d.plannedOutcomes) ||
    hasText(d.howToAchieve) ||
    hasText(d.riskTitle) ||
    hasText(d.riskMitigation)
  );
}

function hasMeaningfulSupportPlanData(plan: SupportPlanData | null | undefined): boolean {
  if (!plan) return false;
  return (plan.needs || []).some((n) =>
    hasText(n.area) ||
    hasText(n.canDoMyself) ||
    hasText(n.risks) ||
    hasText(n.howToSupport)
  );
}

function splitSentences(text: string): string[] {
  return clean(text)
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 3);
}

function mergeText(base: string, incoming: string): string {
  const baseNorm = clean(base);
  const incNorm = clean(incoming);
  if (!incNorm) return baseNorm;
  if (!baseNorm) return incNorm;

  const baseSentences = splitSentences(baseNorm);
  const incSentences = splitSentences(incNorm);

  const merged = [...baseSentences];
  for (const s of incSentences) {
    if (!merged.some(existing => existing.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(existing.toLowerCase()))) {
      merged.push(s);
    }
  }

  return merged.join('. ') + (merged.length > 0 ? '.' : '');
}

function mergeArrays(base: string[], incoming: string[]): string[] {
  const seen = new Set(base.map(s => s.toLowerCase().trim()));
  const merged = [...base];
  for (const s of incoming) {
    const norm = s.toLowerCase().trim();
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      merged.push(s.trim());
    }
  }
  return merged;
}

// ─── RISK MERGING ─────────────────────────────────────────────────────────────

function mergeRiskItem(base: RiskItem, incoming: RiskItem): RiskItem {
  return {
    ...base,
    description: mergeText(base.description, incoming.description),
    behaviours: mergeArrays(base.behaviours, incoming.behaviours),
    affectedPeople: mergeArrays(base.affectedPeople, incoming.affectedPeople),
    triggers: mergeArrays(base.triggers, incoming.triggers),
    earlyWarnings: mergeArrays(base.earlyWarnings, incoming.earlyWarnings),
    controls: mergeArrays(base.controls, incoming.controls),
    dynamicControls: mergeArrays(base.dynamicControls, incoming.dynamicControls),
    secondaryRisk: mergeText(base.secondaryRisk, incoming.secondaryRisk),
    contingencyPlan: mergeText(base.contingencyPlan, incoming.contingencyPlan),
    leastRestrictive: mergeText(base.leastRestrictive, incoming.leastRestrictive),
    // Use higher risk scores if they differ
    likelihood: Math.max(base.likelihood, incoming.likelihood),
    impact: Math.max(base.impact, incoming.impact),
    reviewTrigger: mergeText(base.reviewTrigger, incoming.reviewTrigger),
  };
}

export function mergeRiskData(base: RiskData | null, incoming: RiskData | null, today: string): RiskData {
  const target = base || emptyRisk(today);
  if (!incoming) return target;

  const mergedRisks = [...target.risks];
  for (const incRisk of incoming.risks) {
    if (!incRisk.title) continue;
    const existingIdx = mergedRisks.findIndex(r => r.title.toLowerCase().trim() === incRisk.title.toLowerCase().trim());
    if (existingIdx >= 0) {
      mergedRisks[existingIdx] = mergeRiskItem(mergedRisks[existingIdx], incRisk);
    } else {
      mergedRisks.push({ ...emptyRisk_item(), ...incRisk });
    }
  }

  return {
    ...target,
    leastRestrictivePractice: mergeText(target.leastRestrictivePractice, incoming.leastRestrictivePractice),
    escalationProcedure: mergeText(target.escalationProcedure, incoming.escalationProcedure),
    reviewSchedule: mergeText(target.reviewSchedule, incoming.reviewSchedule),
    risks: mergedRisks.filter(r => r.title || r.description),
    planDate: incoming.planDate || target.planDate || today,
  };
}

// ─── CARE PLAN MERGING ────────────────────────────────────────────────────────

function mergeDomain(base: CarePlanDomain, incoming: CarePlanDomain): CarePlanDomain {
  if (!incoming.enabled && !incoming.identifiedNeed) return base;

  return {
    ...base,
    enabled: base.enabled || incoming.enabled,
    identifiedNeed: mergeText(base.identifiedNeed, incoming.identifiedNeed),
    plannedOutcomes: mergeText(base.plannedOutcomes, incoming.plannedOutcomes),
    howToAchieve: mergeText(base.howToAchieve, incoming.howToAchieve),
    riskTitle: mergeText(base.riskTitle, incoming.riskTitle),
    riskMitigation: mergeText(base.riskMitigation, incoming.riskMitigation),
    // Use the non-zero / more specific values
    levelOfNeed: Math.max(base.levelOfNeed, incoming.levelOfNeed),
    riskLikelihood: Math.max(base.riskLikelihood, incoming.riskLikelihood),
    riskImpact: Math.max(base.riskImpact, incoming.riskImpact),
    reviewNote: mergeText(base.reviewNote, incoming.reviewNote),
  };
}

export function mergeCarePlanData(base: CarePlanData | null, incoming: CarePlanData | null, today: string): CarePlanData | null {
  if (!incoming) return base;
  if (!hasMeaningfulCarePlanData(incoming)) return base;
  if (!base) return incoming;

  const mergedDomains = base.domains.map(baseDom => {
    const incDom = incoming.domains.find(d => d.title === baseDom.title);
    return incDom ? mergeDomain(baseDom, incDom) : baseDom;
  });

  return {
    ...base,
    biography: mergeText(base.biography, incoming.biography),
    criticalInfo: mergeText(base.criticalInfo, incoming.criticalInfo),
    emergencyInfo: mergeText(base.emergencyInfo, incoming.emergencyInfo),
    domains: mergedDomains,
    planDate: incoming.planDate || base.planDate || today,
  };
}

function supportNeedKey(need: SupportPlanNeed): string {
  const area = clean(need.area).toLowerCase();
  if (area) return area;
  return [clean(need.canDoMyself), clean(need.risks), clean(need.howToSupport)].join('|').toLowerCase();
}

function mergeSupportNeed(base: SupportPlanNeed, incoming: SupportPlanNeed): SupportPlanNeed {
  return {
    area: clean(incoming.area) || clean(base.area),
    canDoMyself: mergeText(base.canDoMyself, incoming.canDoMyself),
    risks: mergeText(base.risks, incoming.risks),
    howToSupport: mergeText(base.howToSupport, incoming.howToSupport),
  };
}

export function mergeSupportPlanData(base: SupportPlanData | null, incoming: SupportPlanData | null): SupportPlanData | null {
  if (!incoming) return base;
  if (!hasMeaningfulSupportPlanData(incoming)) return base;
  if (!base) return incoming;

  const out: SupportPlanNeed[] = [...base.needs];
  const indexByKey = new Map<string, number>();
  out.forEach((need, idx) => indexByKey.set(supportNeedKey(need), idx));

  for (const need of incoming.needs || []) {
    const key = supportNeedKey(need);
    if (!key) continue;
    const existingIdx = indexByKey.get(key);
    if (existingIdx === undefined) {
      indexByKey.set(key, out.length);
      out.push({
        area: clean(need.area),
        canDoMyself: clean(need.canDoMyself),
        risks: clean(need.risks),
        howToSupport: clean(need.howToSupport),
      });
      continue;
    }
    out[existingIdx] = mergeSupportNeed(out[existingIdx], need);
  }

  return {
    ...base,
    needs: out,
    planDate: incoming.planDate || base.planDate,
  };
}

// ─── PBS MERGING ──────────────────────────────────────────────────────────────

export function mergePBSData(base: PBSData | null, incoming: PBSData | null): PBSData | null {
  if (!incoming) return base;
  if (!base) return incoming;

  const mergeRows = <T extends object>(b: T[], i: T[], keyField: keyof T): T[] => {
    const merged = [...b];
    for (const row of i) {
      const val = clean(row[keyField] as string).toLowerCase();
      if (val && !merged.some(existing => clean(existing[keyField] as string).toLowerCase() === val)) {
        merged.push(row);
      }
    }
    return merged;
  };

  return {
    ...base,
    aboutText: mergeText(base.aboutText, incoming.aboutText),
    whatMatters: mergeArrays(base.whatMatters, incoming.whatMatters),
    communicatesBest: mergeArrays(base.communicatesBest, incoming.communicatesBest),
    findsDifficult: mergeArrays(base.findsDifficult, incoming.findsDifficult),
    diagnosisRows: mergeRows(base.diagnosisRows, incoming.diagnosisRows, 'diagnosis'),
    functionRows: mergeRows(base.functionRows, incoming.functionRows, 'behaviour'),
    envStrategies: mergeArrays(base.envStrategies, incoming.envStrategies),
    routineStrategies: mergeArrays(base.routineStrategies, incoming.routineStrategies),
    relationshipStrategies: mergeArrays(base.relationshipStrategies, incoming.relationshipStrategies),
    communicationStrategies: mergeArrays(base.communicationStrategies, incoming.communicationStrategies),
    onlineSafetyStrategies: mergeArrays(base.onlineSafetyStrategies, incoming.onlineSafetyStrategies),
    warningSignRows: mergeRows(base.warningSignRows, incoming.warningSignRows, 'sign'),
    whatWorks: mergeArrays(base.whatWorks, incoming.whatWorks),
    doesntWork: mergeArrays(base.doesntWork, incoming.doesntWork),
    medicationRows: mergeRows(base.medicationRows, incoming.medicationRows, 'name'),
    agencyRows: mergeRows(base.agencyRows, incoming.agencyRows, 'service'),
    planDate: incoming.planDate || base.planDate,
  };
}
