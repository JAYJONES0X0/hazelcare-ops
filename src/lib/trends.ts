import type { CareEntry, Category } from './types';

export interface Trend {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  house?: string;
  metric?: string;
}

export function detectTrends(entries: CareEntry[]): Trend[] {
  if (!entries.length) return [];

  const trends: Trend[] = [];
  let idCounter = 0;
  const nextId = () => `trend-${++idCounter}`;

  // -- Helpers --
  const houses = [...new Set(entries.map(e => e.house))];
  const entriesByHouse: Record<string, CareEntry[]> = {};
  for (const e of entries) {
    (entriesByHouse[e.house] ??= []).push(e);
  }

  // -- 1. Category Spikes --
  const categories: Category[] = ['incident', 'safeguarding', 'medication', 'handover', 'daily_support', 'finance', 'staff', 'health_safety', 'other'];
  for (const cat of categories) {
    const countsPerHouse: Record<string, number> = {};
    for (const h of houses) countsPerHouse[h] = 0;
    for (const e of entries) {
      if (e.category === cat) countsPerHouse[e.house] = (countsPerHouse[e.house] || 0) + 1;
    }
    const counts = Object.values(countsPerHouse);
    const avg = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
    if (avg < 1) continue;

    for (const [house, count] of Object.entries(countsPerHouse)) {
      const ratio = count / avg;
      if (ratio >= 2.5 && count >= 3) {
        const label = cat.replace(/_/g, ' ');
        const severity = ratio >= 4 ? 'critical' : 'warning';
        trends.push({
          id: nextId(),
          severity,
          title: `${label} spike at ${house}`,
          detail: `${count} ${label} entries — ${ratio.toFixed(1)}x the average across houses.`,
          house,
          metric: `${ratio.toFixed(1)}x average`,
        });
      }
    }
  }

  // -- 2. Flag Concentration --
  const flagCountsByHouse: Record<string, { red: number; amber: number }> = {};
  for (const h of houses) flagCountsByHouse[h] = { red: 0, amber: 0 };
  for (const e of entries) {
    if (e.severity === 'red') flagCountsByHouse[e.house].red++;
    if (e.severity === 'amber') flagCountsByHouse[e.house].amber++;
  }

  const totalRed = Object.values(flagCountsByHouse).reduce((s, h) => s + h.red, 0);
  const totalAmber = Object.values(flagCountsByHouse).reduce((s, h) => s + h.amber, 0);
  const avgRed = totalRed / (houses.length || 1);
  const avgAmber = totalAmber / (houses.length || 1);

  for (const [house, counts] of Object.entries(flagCountsByHouse)) {
    if (counts.red >= 3 && avgRed > 0 && counts.red / avgRed >= 2.5) {
      trends.push({
        id: nextId(),
        severity: 'critical',
        title: `Red flag concentration at ${house}`,
        detail: `${counts.red} red flags — ${(counts.red / avgRed).toFixed(1)}x the house average (${avgRed.toFixed(1)}).`,
        house,
        metric: `${counts.red} red flags`,
      });
    }
    if (counts.amber >= 4 && avgAmber > 0 && counts.amber / avgAmber >= 2.5) {
      trends.push({
        id: nextId(),
        severity: 'warning',
        title: `Amber flag concentration at ${house}`,
        detail: `${counts.amber} amber flags — ${(counts.amber / avgAmber).toFixed(1)}x the house average (${avgAmber.toFixed(1)}).`,
        house,
        metric: `${counts.amber} amber flags`,
      });
    }
  }

  // -- 3. Staff Patterns --
  const flaggedEntries = entries.filter(e => e.severity === 'red' || e.severity === 'amber');
  if (flaggedEntries.length >= 3) {
    const carerFlagCounts: Record<string, number> = {};
    const carerTotalCounts: Record<string, number> = {};
    for (const e of entries) {
      if (!e.carer) continue;
      carerTotalCounts[e.carer] = (carerTotalCounts[e.carer] || 0) + 1;
    }
    for (const e of flaggedEntries) {
      if (!e.carer) continue;
      carerFlagCounts[e.carer] = (carerFlagCounts[e.carer] || 0) + 1;
    }

    const overallFlagRate = flaggedEntries.length / (entries.length || 1);

    for (const [carer, flagCount] of Object.entries(carerFlagCounts)) {
      const total = carerTotalCounts[carer] || 1;
      const carerRate = flagCount / total;
      if (flagCount >= 3 && total >= 4 && carerRate >= overallFlagRate * 2) {
        trends.push({
          id: nextId(),
          severity: carerRate >= overallFlagRate * 3 ? 'critical' : 'warning',
          title: `Staff pattern: ${carer}`,
          detail: `${flagCount} of ${total} entries flagged (${(carerRate * 100).toFixed(0)}%) — overall rate is ${(overallFlagRate * 100).toFixed(0)}%.`,
          metric: `${(carerRate * 100).toFixed(0)}% flag rate`,
        });
      }
    }
  }

  // -- 4. Client Risk --
  const redEntries = entries.filter(e => e.severity === 'red');
  if (redEntries.length >= 2) {
    const clientRedCounts: Record<string, CareEntry[]> = {};
    for (const e of redEntries) {
      if (!e.client) continue;
      (clientRedCounts[e.client] ??= []).push(e);
    }
    for (const [client, clientEntries] of Object.entries(clientRedCounts)) {
      if (clientEntries.length >= 2) {
        const houseSet = [...new Set(clientEntries.map(e => e.house))];
        trends.push({
          id: nextId(),
          severity: clientEntries.length >= 4 ? 'critical' : 'warning',
          title: `At-risk client: ${client}`,
          detail: `${clientEntries.length} red-flagged entries across ${houseSet.join(', ')}.`,
          metric: `${clientEntries.length} red entries`,
        });
      }
    }
  }

  // -- 5. Type Distribution Anomalies --
  for (const [house, houseEntries] of Object.entries(entriesByHouse)) {
    if (houseEntries.length < 5) continue;
    const typeCounts: Record<string, number> = {};
    for (const e of houseEntries) {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCounts)) {
      const share = count / houseEntries.length;
      if (share >= 0.6 && count >= 5) {
        const globalTypeCount = entries.filter(e => e.type === type).length;
        const globalShare = globalTypeCount / entries.length;
        if (share >= globalShare * 1.8) {
          trends.push({
            id: nextId(),
            severity: 'info',
            title: `${type} entries dominate at ${house}`,
            detail: `${(share * 100).toFixed(0)}% of entries are "${type}" — global average is ${(globalShare * 100).toFixed(0)}%.`,
            house,
            metric: `${(share * 100).toFixed(0)}% share`,
          });
        }
      }
    }
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 };
  trends.sort((a, b) => order[a.severity] - order[b.severity]);

  return trends;
}
