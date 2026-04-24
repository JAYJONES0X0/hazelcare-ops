import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export async function extractPdfText(file: File, onProgress?: (p: number) => void): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(Math.round((i / pdf.numPages) * 100));
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const items = tc.items as any[];
    
    // Improved row-based extraction for tabular data (CSVs inside PDFs)
    const rowMap = new Map<number, { x: number; str: string }[]>();
    for (const it of items) {
      if (!it.str?.trim()) continue;
      const y = Math.round((it.transform?.[5] ?? 0) / 4) * 4; // 4px snap
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x: it.transform?.[4] ?? 0, str: it.str });
    }
    
    const sortedRows = [...rowMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map(c => c.str.trim()).filter(Boolean).join('\t'));
    
    fullText += sortedRows.join('\n') + '\n';
  }
  return fullText;
}

export async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
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
