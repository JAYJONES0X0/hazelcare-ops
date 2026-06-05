/**
 * CLINCAL INTELLIGENCE PIPELINE
 * Maps unstructured raw text to structured CQC domains and risk matrices.
 */

import type { FullClient, CarePlanData, RiskData } from './client-store';
import { emptyRisk } from './client-store';

export interface IntelAnalysisResult {
  client: Partial<FullClient>;
  carePlan: CarePlanData;
  risk: RiskData;
  gaps: string[]; // Areas where information is missing in the source
}

/**
 * Analyzes unstructured text via the Intelligence API.
 * This is the "Brain" of the ops engine.
 */
export async function analyzeIntel(rawText: string): Promise<IntelAnalysisResult> {
  const res = await fetch('/api/staff/analyze-intel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text: rawText }),
  });

  if (!res.ok) {
    let message = '';
    try {
      const error = await res.json();
      message = error.message || error.error || '';
    } catch {
      message = await res.text().catch(() => '');
    }
    if (res.status === 401) throw new Error('Your session has expired. Sign in again, then retry AI analysis.');
    if (res.status === 403) throw new Error(message || 'AI analysis is blocked by role or domain access.');
    if (res.status === 503) throw new Error(message || 'Staff session service is not configured.');
    throw new Error(message || 'Intelligence analysis failed');
  }

  return await res.json();
}

/** 
 * Fallback to legacy parser if API unavailable
 */
import { parseUniversalText } from './universal-import';
export function analyzeIntelFallback(rawText: string): IntelAnalysisResult {
  const result = parseUniversalText(rawText);
  return {
    client: result.client,
    carePlan: result.carePlan,
    risk: result.client.risk || emptyRisk(new Date().toLocaleDateString('en-GB')),
    gaps: result.warnings,
  };
}
