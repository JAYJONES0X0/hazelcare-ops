import {
  emptyCarePlan,
  emptyPBS,
  emptyRisk,
  emptyRisk_item,
  type CarePlanDomain,
  type FullClient,
  type PBSData,
  type RiskData,
  type RiskItem,
  type SupportPlanNeed,
} from './client-store';
import { mergeCarePlanData, mergePBSData, mergeRiskData } from './intel-merge';

function clean(value: string | undefined | null, max = 1200): string {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function appendUnique(base: string[], incoming: string[], max = 10): string[] {
  const seen = new Set(base.map((item) => clean(item).toLowerCase()).filter(Boolean));
  const out = base.filter((item) => clean(item));
  for (const item of incoming.map((value) => clean(value)).filter(Boolean)) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, max);
}

function evidenceText(client: FullClient): string {
  return [
    client.clinicalBriefing,
    ...(client.vaultDocs || []).map((doc) => `${doc.name}: ${doc.text}`),
    ...(client.supportPlan?.needs || []).flatMap((need) => [need.area, need.canDoMyself, need.risks, need.howToSupport]),
    ...(client.carePlan?.domains || []).flatMap((domain) => [domain.title, domain.identifiedNeed, domain.howToAchieve, domain.riskTitle, domain.riskMitigation]),
    ...(client.risk?.risks || []).flatMap((risk) => [risk.title, risk.description, ...risk.controls, ...risk.triggers, ...risk.earlyWarnings]),
  ].map((part) => clean(part, 3000)).filter(Boolean).join(' | ');
}

function domainForNeed(need: SupportPlanNeed): string {
  const haystack = `${need.area} ${need.canDoMyself} ${need.howToSupport} ${need.risks}`.toLowerCase();
  if (/medication|tablet|mar|dose/.test(haystack)) return 'Medication Management & Safety';
  if (/mental|mood|anxious|distress|wellbeing/.test(haystack)) return 'Mental Health & Emotional Wellbeing';
  if (/food|meal|nutrition|drink|fluid|hydrat/.test(haystack)) return 'Nutrition, Hydration & Diet';
  if (/hygiene|wash|shower|bath|dress|clothed|personal care/.test(haystack)) return 'Personal Care & Physical Presentation';
  if (/toilet|continence/.test(haystack)) return 'Continence & Personal Hygiene';
  if (/home|flat|bedroom|environment|clean|clutter|fire|safety/.test(haystack)) return 'Environment & Physical Safety';
  if (/community|transport|social|relationship|friend|family/.test(haystack)) return 'Social Engagement & Relationships';
  if (/money|finance|budget|bill|shopping/.test(haystack)) return 'Financial Management & Autonomy';
  if (/appointment|gp|health|medical|procedure/.test(haystack)) return 'Holistic Health & Vitality';
  if (/communication|understand|speech|sensory/.test(haystack)) return 'Communication & Sensory Integration';
  return need.area || 'Life Skills & Daily Routine';
}

function careDomainFromNeed(base: CarePlanDomain, need: SupportPlanNeed): CarePlanDomain {
  return {
    ...base,
    enabled: true,
    identifiedNeed: clean(need.canDoMyself || need.area, 1100),
    plannedOutcomes: clean(need.howToSupport || `Maintain safe support around ${need.area}.`, 900),
    howToAchieve: clean(need.howToSupport || need.canDoMyself, 1300),
    riskTitle: clean(need.risks ? `${need.area} risk` : base.riskTitle, 140),
    riskMitigation: clean(need.risks || base.riskMitigation, 900),
    levelOfNeed: Math.max(base.levelOfNeed || 0, need.howToSupport ? 2 : 1),
    riskLikelihood: Math.max(base.riskLikelihood || 1, need.risks ? 3 : 1),
    riskImpact: Math.max(base.riskImpact || 1, need.risks ? 3 : 1),
  };
}

export function buildCarePlanFromProfileEvidence(client: FullClient, today: string, reviewDate: string): { carePlan: FullClient['carePlan']; message: string } {
  const current = client.carePlan || emptyCarePlan(today, reviewDate);
  const drafted = { ...current, domains: current.domains.map((domain) => ({ ...domain })) };
  let mapped = 0;
  const needs: SupportPlanNeed[] = [
    ...(client.supportPlan?.needs || []),
    ...(client.risk?.risks || []).map((risk) => ({
      area: risk.title,
      canDoMyself: risk.description || risk.secondaryRisk,
      risks: [risk.description, risk.secondaryRisk, ...risk.triggers].filter(Boolean).join(' '),
      howToSupport: [...risk.controls, ...risk.dynamicControls].filter(Boolean).join(' '),
    })),
  ].filter((need) => clean(`${need.area} ${need.canDoMyself} ${need.risks} ${need.howToSupport}`));

  for (const need of needs) {
    const target = domainForNeed(need);
    const idx = drafted.domains.findIndex((domain) => domain.title === target);
    if (idx < 0) continue;
    drafted.domains[idx] = careDomainFromNeed(drafted.domains[idx], need);
    mapped += 1;
  }

  const merged = mergeCarePlanData(current, drafted, today);
  return {
    carePlan: merged,
    message: mapped
      ? `Mapped ${mapped} evidence area(s) into care-plan domains without clearing existing content.`
      : 'No support-plan or risk evidence is attached to this profile yet.',
  };
}

export function buildRiskFromProfileEvidence(client: FullClient, today: string): { risk: RiskData; message: string } {
  const current = client.risk || emptyRisk(today);
  const generated: RiskItem[] = [];

  for (const need of client.supportPlan?.needs || []) {
    if (!clean(need.risks)) continue;
    generated.push({
      ...emptyRisk_item(),
      title: clean(`${need.area} - support-plan risk`, 120),
      description: clean(need.risks, 1200),
      triggers: [clean(need.area, 120)].filter(Boolean),
      controls: [clean(need.howToSupport, 400)].filter(Boolean),
      affectedPeople: [client.name || 'Person supported'],
      likelihood: 3,
      impact: 3,
      reviewTrigger: 'Review after any incident, refusal pattern, safeguarding concern, or change in presentation.',
    });
  }

  const merged = mergeRiskData(current, { ...current, risks: generated }, today);
  return {
    risk: merged,
    message: generated.length
      ? `Merged ${generated.length} support-plan risk(s) into the risk assessment without wiping existing risks.`
      : 'No explicit support-plan risks are attached to this profile yet.',
  };
}

export function buildPBSFromProfileEvidence(client: FullClient, today: string): { pbs: PBSData; message: string } {
  const base = client.pbs || emptyPBS(today);
  const text = evidenceText(client);
  const generated: PBSData = { ...base };
  const needs = client.supportPlan?.needs || [];

  if (!generated.aboutText) {
    generated.aboutText = clean(client.carePlan?.biography || client.clinicalBriefing || text, 1000);
  }
  generated.whatMatters = appendUnique(generated.whatMatters || [], needs.map((need) => need.canDoMyself), 8);
  generated.findsDifficult = appendUnique(generated.findsDifficult || [], needs.map((need) => need.risks), 8);
  generated.routineStrategies = appendUnique(generated.routineStrategies || [], needs.map((need) => need.howToSupport), 8);
  generated.communicationStrategies = appendUnique(generated.communicationStrategies || [], text.match(/communication[^.|;]{20,220}/gi) || [], 6);
  generated.envStrategies = appendUnique(generated.envStrategies || [], needs.filter((need) => /home|environment|safety|clean|fire/i.test(`${need.area} ${need.howToSupport} ${need.risks}`)).map((need) => need.howToSupport || need.risks), 6);
  generated.warningSignRows = generated.warningSignRows?.some((row) => clean(row.sign))
    ? generated.warningSignRows
    : needs.filter((need) => clean(need.risks)).slice(0, 5).map((need) => ({
        sign: clean(need.risks, 220),
        staffAction: clean(need.howToSupport || 'Follow the agreed support plan and escalate changes in risk.', 260),
      }));

  const merged = mergePBSData(base, generated) || generated;
  return {
    pbs: merged,
    message: needs.length || text
      ? `Merged profile evidence into PBS without clearing existing PBS content.`
      : 'No profile evidence is attached yet. Import a support plan or add vault evidence first.',
  };
}
