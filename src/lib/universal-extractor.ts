import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from '@e965/xlsx';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  // Use bundled worker URL so PDF parsing does not depend on external CDN availability.
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

export async function extractPdfText(file: File, onProgress?: (p: number) => void): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>>['promise'] extends Promise<infer T> ? T : never;
  if (typeof window === 'undefined') {
    pdf = await pdfjs.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
  } else {
    try {
      pdf = await pdfjs.getDocument({ data: arrayBuffer, disableWorker: false }).promise;
    } catch {
      // Fallback path for environments where Worker setup is restricted.
      pdf = await pdfjs.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
    }
  }
  let fullText = '';
  const supportPlanFlowHint = /(need\s+description\s+need\s+comment\s+outcome\s+comment|my\s+support\s+plan|what\s+i\s+need\s+help\s+with|what\s+we['’]?\s*re\s+working\s+towards)/i;
  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(Math.round((i / pdf.numPages) * 100));
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const items = tc.items as PdfTextItem[];

    // Natural item-flow extraction can outperform row snapping on council/support-plan tables.
    const flowText = items
      .map((it) => (it.str || '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Improved row-based extraction for tabular data (CSVs inside PDFs)
    const rowMap = new Map<number, { x: number; str: string }[]>();
    for (const it of items) {
      if (!it.str?.trim()) continue;
      const y = Math.round((it.transform?.[5] ?? 0) / 4) * 4; // 4px snap
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x: it.transform?.[4] ?? 0, str: it.str });
    }
    
    const rowText = [...rowMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map(c => c.str.trim()).filter(Boolean).join('\t'));

    if (supportPlanFlowHint.test(flowText)) {
      fullText += flowText + '\n';
    } else {
      fullText += rowText.join('\n') + '\n';
    }
  }
  return fullText;
}

export async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  // Mammoth uses different input shapes in Node vs browser.
  // In Node-based tests/imports, Buffer is the reliable path; in the browser,
  // arrayBuffer is the supported input.
  if (typeof Buffer !== 'undefined') {
    try {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
      return result.value;
    } catch {
      // Fall through to the browser-compatible path if Node buffering fails.
    }
  }

  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function extractXlsxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const lines: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    // Convert to CSV — preserves column alignment for our diary parser
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    if (csv.trim()) lines.push(csv);
  }
  return lines.join('\n');
}

export async function extractFileText(file: File, onProgress?: (p: number) => void): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return extractPdfText(file, onProgress);
  if (ext === 'docx') return extractDocxText(file);
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') return extractXlsxText(file);
  return file.text();
}
