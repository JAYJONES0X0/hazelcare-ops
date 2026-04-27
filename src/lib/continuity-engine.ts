import type { CareEntry } from './types';
import { parseDateMs } from './entry-store';

export interface ClinicalGap {
  id: string;
  client: string;
  house: string;
  date: string;
  timestamp: number;
  likelyCarers: string[];
  severity: 'red' | 'amber';
}

/**
 * Sweeps a dataset to find missing days in clinical evidence per client.
 * Uses cross-client data in the same house to infer who was on shift.
 */
export function detectClinicalGaps(entries: CareEntry[]): ClinicalGap[] {
  if (entries.length === 0) return [];

  // 1. Group by Client and House
  const clientMap = new Map<string, { house: string; entries: CareEntry[]; dates: Set<number> }>();
  // 2. House Attendance Map: House -> DateMs -> Set of CarerNames
  const attendanceMap = new Map<string, Map<number, Set<string>>>();

  let minMs = Infinity;
  let maxMs = -Infinity;

  for (const e of entries) {
    if (!e.client || !e.date) continue;
    
    const ms = parseDateMs(e.date);
    if (!ms) continue;

    minMs = Math.min(minMs, ms);
    maxMs = Math.max(maxMs, ms);

    // Client tracking
    if (!clientMap.has(e.client)) {
      clientMap.set(e.client, { house: e.house || 'UNASSIGNED', entries: [], dates: new Set() });
    }
    const cData = clientMap.get(e.client)!;
    cData.entries.push(e);
    cData.dates.add(ms);

    // House attendance tracking
    const hKey = e.house || 'UNASSIGNED';
    if (!attendanceMap.has(hKey)) attendanceMap.set(hKey, new Map());
    const hDates = attendanceMap.get(hKey)!;
    if (!hDates.has(ms)) hDates.set(ms, new Set());
    if (e.carer && e.carer !== 'Unassigned') {
      hDates.get(ms)!.add(e.carer);
    }
  }

  const gaps: ClinicalGap[] = [];
  const oneDay = 86400000;

  // 3. Find gaps per client
  for (const [client, data] of clientMap) {
    // Only check from the first time they appear in the data to the last
    const cDates = Array.from(data.dates).sort((a, b) => a - b);
    const start = cDates[0];
    const end = maxMs; // Sweep until the latest date in the entire store

    for (let day = start; day <= end; day += oneDay) {
      if (!data.dates.has(day)) {
        // GAP FOUND
        const dateStr = new Date(day).toLocaleDateString('en-GB');
        const hKey = data.house;
        const likelyCarers = Array.from(attendanceMap.get(hKey)?.get(day) || []);

        gaps.push({
          id: `gap-${client}-${day}`,
          client,
          house: hKey,
          date: dateStr,
          timestamp: day,
          likelyCarers,
          severity: likelyCarers.length > 0 ? 'amber' : 'red' // Red is a "Deep Silence" (nobody in the house)
        });
      }
    }
  }

  // Sort gaps: Newest first, then deep silence (red) first
  return gaps.sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    if (a.severity === 'red' && b.severity !== 'red') return -1;
    if (b.severity === 'red' && a.severity !== 'red') return 1;
    return 0;
  });
}
