import type { WeekSummary, CareEntry, Shift } from './types';
import type { ParseResult } from './universal-import';
import type { SupportPlanData } from './client-store';

export type ImportTarget = 'templates' | 'reports' | 'client-docs' | 'roster';
export type ImportType = 'diary' | 'admission' | 'support-plan' | 'roster' | 'unknown';

export interface SourceMeta {
  fileName: string;
  ext: string;
  parserProfile: string;
  detectedType: ImportType;
  confidence: number;
}

export interface ExtractedClientIdentity {
  name?: string;
  preferredName?: string;
  dob?: string;
  nhs?: string;
}

export interface NormalizedImportEnvelope {
  source: SourceMeta;
  rawText: string;
  clientCandidates: ExtractedClientIdentity[];
  diaryEntries: CareEntry[];
  weekSummary: WeekSummary | null;
  admission: ParseResult | null;
  supportPlan: SupportPlanData | null;
  shifts: Shift[];
  warnings: string[];
  unmappedFields: string[];
  suggestedTargets: ImportTarget[];
}

export function emptyEnvelope(fileName: string, rawText: string): NormalizedImportEnvelope {
  const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
  return {
    source: {
      fileName,
      ext: ext.toLowerCase(),
      parserProfile: 'unknown',
      detectedType: 'unknown',
      confidence: 0,
    },
    rawText,
    clientCandidates: [],
    diaryEntries: [],
    weekSummary: null,
    admission: null,
    supportPlan: null,
    shifts: [],
    warnings: [],
    unmappedFields: [],
    suggestedTargets: [],
  };
}

export function confidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}
