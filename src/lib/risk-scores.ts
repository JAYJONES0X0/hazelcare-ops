import type { NourishEntry, WeekSummary } from './types';

export interface ClientRiskProfile {
  name: string;
  house: string;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  redFlags: number;
  amberFlags: number;
  medicationIssues: number;
  safeguardingFlags: number;
  incidentCount: number;
  recentEntries: NourishEntry[];
  topConcerns: string[];
  lastActivity: string;
}

const RISK_WEIGHTS = {
  redFlag: 10,
  amberFlag: 5,
  medicationIssue: 8,
  safeguarding: 15,
  incident: 12,
  behaviouralConcern: 6,
  refusalPattern: 7,
};

export function calculateClientRisk(
  clientName: string,
  entries: NourishEntry[],
  house: string
): ClientRiskProfile {
  const clientEntries = entries.filter(e => e.client === clientName).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const redFlags = clientEntries.filter(e => e.severity === 'red').length;
  const amberFlags = clientEntries.filter(e => e.severity === 'amber').length;

  // Medication issues
  const medicationIssues = clientEntries.filter(e =>
    e.category === 'medication' ||
    e.entry.toLowerCase().includes('refused') ||
    e.entry.toLowerCase().includes('medication') && e.severity !== 'green'
  ).length;

  // Safeguarding flags
  const safeguardingFlags = clientEntries.filter(e =>
    e.category === 'safeguarding' ||
    e.flags.some(f => f.toLowerCase().includes('safeguard'))
  ).length;

  // Incidents
  const incidentCount = clientEntries.filter(e =>
    e.category === 'incident' ||
    e.type.toLowerCase().includes('incident') ||
    e.type.toLowerCase().includes('accident')
  ).length;

  // Calculate weighted score
  let riskScore =
    redFlags * RISK_WEIGHTS.redFlag +
    amberFlags * RISK_WEIGHTS.amberFlag +
    medicationIssues * RISK_WEIGHTS.medicationIssue +
    safeguardingFlags * RISK_WEIGHTS.safeguarding +
    incidentCount * RISK_WEIGHTS.incident;

  // Pattern detection - multiple entries same day = escalation
  const entriesByDate = clientEntries.reduce((acc, e) => {
    acc[e.date] = (acc[e.date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const multiEntryDays = Object.values(entriesByDate).filter(c => c > 1).length;
  riskScore += multiEntryDays * 3;

  // Recent activity boost (entries in last 3 days)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const recentEntries = clientEntries.filter(e => new Date(e.date) >= threeDaysAgo);
  if (recentEntries.length > 2) {
    riskScore += recentEntries.length * 2;
  }

  // Determine risk level
  let riskLevel: ClientRiskProfile['riskLevel'] = 'low';
  if (riskScore >= 40 || redFlags >= 3 || safeguardingFlags > 0) {
    riskLevel = 'critical';
  } else if (riskScore >= 25 || redFlags >= 2 || medicationIssues >= 3) {
    riskLevel = 'high';
  } else if (riskScore >= 10 || amberFlags >= 3) {
    riskLevel = 'medium';
  }

  // Extract top concerns
  const topConcerns = extractConcerns(clientEntries);

  return {
    name: clientName,
    house,
    riskScore,
    riskLevel,
    redFlags,
    amberFlags,
    medicationIssues,
    safeguardingFlags,
    incidentCount,
    recentEntries: clientEntries.slice(0, 5),
    topConcerns,
    lastActivity: clientEntries[0]?.date || 'No activity',
  };
}

function extractConcerns(entries: NourishEntry[]): string[] {
  const concerns: string[] = [];
  const entriesText = entries.map(e => e.entry.toLowerCase()).join(' ');

  if (entries.some(e => e.category === 'safeguarding')) {
    concerns.push('Safeguarding concern');
  }
  if (entries.some(e => e.category === 'medication' && e.severity !== 'green')) {
    concerns.push('Medication compliance issues');
  }
  if (entriesText.includes('refused') || entriesText.includes('refusal')) {
    concerns.push('Refusal patterns');
  }
  if (entriesText.includes('behaviour') || entriesText.includes('aggressive')) {
    concerns.push('Behavioural concerns');
  }
  if (entriesText.includes('fall') || entriesText.includes('injury')) {
    concerns.push('Fall/injury risk');
  }
  if (entries.some(e => e.category === 'incident')) {
    concerns.push('Recent incidents');
  }
  if (entries.filter(e => e.severity === 'red').length >= 2) {
    concerns.push('Multiple red flags');
  }

  return concerns.slice(0, 3);
}

export function generateRiskProfiles(weekData: WeekSummary | null): ClientRiskProfile[] {
  if (!weekData) return [];

  const profiles: ClientRiskProfile[] = [];

  Object.entries(weekData.houses).forEach(([houseName, house]) => {
    const clients = [...new Set(house.entries.map(e => e.client))];

    clients.forEach(client => {
      const profile = calculateClientRisk(client, house.entries, houseName);
      profiles.push(profile);
    });
  });

  // Sort by risk score descending
  return profiles.sort((a, b) => b.riskScore - a.riskScore);
}

export function getRiskStats(profiles: ClientRiskProfile[]) {
  return {
    critical: profiles.filter(p => p.riskLevel === 'critical').length,
    high: profiles.filter(p => p.riskLevel === 'high').length,
    medium: profiles.filter(p => p.riskLevel === 'medium').length,
    low: profiles.filter(p => p.riskLevel === 'low').length,
    total: profiles.length,
    avgScore: profiles.length > 0
      ? Math.round(profiles.reduce((sum, p) => sum + p.riskScore, 0) / profiles.length)
      : 0,
  };
}
