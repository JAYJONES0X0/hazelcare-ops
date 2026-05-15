export interface ParsedEvidenceTrail {
  note: string;
  evidence: string[];
}

const HEADING_RE = /\n\s*(?:\[)?evidence\s+trail(?:\])?\s*:?\s*\n/i;

export function splitEvidenceTrail(raw: string): ParsedEvidenceTrail {
  const text = (raw || '').trim();
  if (!text) return { note: '', evidence: [] };

  const match = HEADING_RE.exec(`\n${text}\n`);
  if (!match) return { note: text, evidence: [] };

  const markerIndex = Math.max(0, (match.index || 0) - 1);
  const note = text.slice(0, markerIndex).trim();
  const tail = text.slice(markerIndex).replace(/^\s*(?:\[)?evidence\s+trail(?:\])?\s*:?\s*/i, '').trim();
  const evidence = tail
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length >= 8)
    .slice(0, 8);

  return {
    note: note || text,
    evidence,
  };
}
