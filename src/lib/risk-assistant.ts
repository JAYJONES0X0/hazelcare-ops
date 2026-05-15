import type { RiskItem } from './client-store';

export interface RiskCluster {
  key: string;
  label: string;
  count: number;
  hotspot: boolean;
  items: RiskItem[];
  topScore: number;
  triggers: string[];
  controls: string[];
  summary: string;
}

type RiskClusterDefinition = {
  key: string;
  label: string;
  keywords: RegExp[];
};

const RISK_CLUSTER_DEFINITIONS: RiskClusterDefinition[] = [
  { key: 'medication', label: 'Medication Safety', keywords: [/medic/i, /\bmar\b/i, /tablet/i, /dose/i, /prescribed/i, /drug/i] },
  { key: 'mobility', label: 'Mobility & Falls', keywords: [/fall/i, /mobility/i, /transfer/i, /hoist/i, /walk/i, /stairs?/i, /slip/i, /trip/i] },
  { key: 'safeguarding', label: 'Safeguarding', keywords: [/safeguard/i, /abuse/i, /exploit/i, /incident/i, /concern/i, /harass/i] },
  { key: 'mental_health', label: 'Mental Health', keywords: [/mental health/i, /anxious/i, /low mood/i, /depress/i, /distress/i, /paranoi/i, /hallucinat/i] },
  { key: 'nutrition', label: 'Nutrition & Hydration', keywords: [/nutrition/i, /meal/i, /food/i, /eat/i, /drink/i, /hydrat/i, /swallow/i, /chok/i] },
  { key: 'personal_care', label: 'Personal Care', keywords: [/personal care/i, /wash/i, /dress/i, /hygiene/i, /bath/i, /shower/i, /oral hygiene/i] },
  { key: 'skin_integrity', label: 'Skin Integrity', keywords: [/skin/i, /pressure/i, /wound/i, /rash/i, /sore/i, /ulcer/i, /cream/i] },
  { key: 'fire_safety', label: 'Fire & Environment', keywords: [/fire/i, /smoke/i, /hazard/i, /clutter/i, /environment/i, /clean/i, /security/i] },
  { key: 'engagement', label: 'Engagement & Activity', keywords: [/engag/i, /activity/i, /social/i, /recreation/i, /occupation/i] },
  { key: 'finance', label: 'Finance & Admin', keywords: [/finance/i, /money/i, /budget/i, /admin/i, /payment/i] },
];

function clean(text: string | undefined | null): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function fingerprint(item: RiskItem): string {
  return [
    clean(item.title),
    clean(item.description),
    clean((item.triggers || []).join(' ')),
    clean((item.controls || []).join(' ')),
    clean((item.earlyWarnings || []).join(' ')),
  ].join(' | ').toLowerCase();
}

function scoreOf(item: RiskItem): number {
  const likelihood = Number(item.likelihood) || 1;
  const impact = Number(item.impact) || 1;
  return likelihood * impact;
}

function inferCluster(item: RiskItem): RiskClusterDefinition {
  const haystack = [
    item.title,
    item.description,
    item.secondaryRisk,
    item.contingencyPlan,
    (item.triggers || []).join(' '),
    (item.earlyWarnings || []).join(' '),
    (item.controls || []).join(' '),
  ]
    .join(' ')
    .toLowerCase();

  for (const def of RISK_CLUSTER_DEFINITIONS) {
    if (def.key === 'fire_safety') {
      if (def.keywords.some((re) => re.test(haystack)) && !/security/i.test(haystack)) return def;
      continue;
    }
    if (def.keywords.some((re) => re.test(haystack))) return def;
  }

  const title = clean(item.title).toLowerCase();
  if (title.includes('fire')) return RISK_CLUSTER_DEFINITIONS.find((d) => d.key === 'fire_safety')!;
  if (title.includes('fall') || title.includes('mobility')) return RISK_CLUSTER_DEFINITIONS.find((d) => d.key === 'mobility')!;
  if (title.includes('medic') || title.includes('mar')) return RISK_CLUSTER_DEFINITIONS.find((d) => d.key === 'medication')!;
  if (title.includes('meal') || title.includes('nutrition')) return RISK_CLUSTER_DEFINITIONS.find((d) => d.key === 'nutrition')!;

  return { key: 'general', label: 'General / Other', keywords: [] };
}

export function clusterRiskItems(items: RiskItem[]): RiskCluster[] {
  const deduped = items.filter((item, index, arr) => {
    const key = fingerprint(item);
    return key && arr.findIndex((candidate) => fingerprint(candidate) === key) === index;
  });

  const buckets = new Map<string, RiskCluster>();
  for (const item of deduped) {
    const cluster = inferCluster(item);
    const existing = buckets.get(cluster.key);
    const nextItem = item.title ? item : { ...item, title: 'Imported Risk' };
    if (!existing) {
      buckets.set(cluster.key, {
        key: cluster.key,
        label: cluster.label,
        count: 1,
        hotspot: false,
        items: [nextItem],
        topScore: scoreOf(nextItem),
        triggers: [...(nextItem.triggers || [])].map(clean).filter(Boolean),
        controls: [...(nextItem.controls || [])].map(clean).filter(Boolean),
        summary: clean(nextItem.description),
      });
      continue;
    }

    existing.count += 1;
    existing.items.push(nextItem);
    existing.topScore = Math.max(existing.topScore, scoreOf(nextItem));
    existing.triggers = [...new Set([...existing.triggers, ...(nextItem.triggers || []).map(clean).filter(Boolean)])].slice(0, 8);
    existing.controls = [...new Set([...existing.controls, ...(nextItem.controls || []).map(clean).filter(Boolean)])].slice(0, 8);
    if (!existing.summary && clean(nextItem.description)) existing.summary = clean(nextItem.description);
  }

  return [...buckets.values()]
    .map((cluster) => ({
      ...cluster,
      hotspot: cluster.count >= 3,
      items: cluster.items.slice().sort((a, b) => scoreOf(b) - scoreOf(a)),
    }))
    .sort((a, b) => {
      if (a.hotspot !== b.hotspot) return a.hotspot ? -1 : 1;
      if (b.count !== a.count) return b.count - a.count;
      return b.topScore - a.topScore;
    });
}

export function buildClusterTitle(cluster: RiskCluster): string {
  return `${cluster.label} - ${cluster.count} risk${cluster.count === 1 ? '' : 's'}`;
}

export function buildClusterNote(cluster: RiskCluster): string {
  const names = cluster.items
    .slice(0, 5)
    .map((item) => clean(item.title))
    .filter(Boolean);
  const controls = [...cluster.controls.slice(0, 4)];
  const triggers = [...cluster.triggers.slice(0, 4)];

  const lines = [
    `Risk category: ${cluster.label}`,
    `Risk count: ${cluster.count}${cluster.hotspot ? ' (hotspot)' : ''}`,
  ];

  if (cluster.summary) lines.push(`Summary: ${cluster.summary}`);
  if (names.length) lines.push(`Included risks: ${names.join(' | ')}`);
  if (triggers.length) lines.push(`Triggers: ${triggers.join(' | ')}`);
  if (controls.length) lines.push(`Controls: ${controls.join(' | ')}`);
  lines.push('Record: what was observed, what action was taken, the client response, and any escalation.');
  return lines.join('\n');
}

export function buildRiskItemCopy(risk: RiskItem): string {
  const blocks = [
    `Risk: ${clean(risk.title) || 'Imported Risk'}`,
    risk.description ? `Description: ${clean(risk.description)}` : '',
    (risk.triggers || []).filter(Boolean).length ? `Triggers: ${(risk.triggers || []).map(clean).filter(Boolean).join(' | ')}` : '',
    (risk.earlyWarnings || []).filter(Boolean).length ? `Warning signs: ${(risk.earlyWarnings || []).map(clean).filter(Boolean).join(' | ')}` : '',
    (risk.controls || []).filter(Boolean).length ? `Controls: ${(risk.controls || []).map(clean).filter(Boolean).join(' | ')}` : '',
    risk.reviewTrigger ? `Review trigger: ${clean(risk.reviewTrigger)}` : '',
  ].filter(Boolean);

  return blocks.join('\n');
}
