import { useState, useRef, useCallback } from 'react';
import { parseNourishData, buildWeekSummary } from '../lib/nourish-parser';
import type { WeekSummary } from '../lib/types';

interface Props {
  onDataParsed: (data: WeekSummary) => void;
}

interface ParseResult {
  entries: number;
  houses: number;
  clients: number;
  flags: { red: number; amber: number };
  topClients: { name: string; red: number; amber: number; total: number }[];
  summary: WeekSummary;
}

export function UploadPage({ onDataParsed }: Props) {
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function processData(raw: string, name = '') {
    setProcessing(true);
    setError('');
    setParseResult(null);
    if (name) setFileName(name);

    try {
      await new Promise(r => setTimeout(r, 300));
      const entries = parseNourishData(raw);
      if (entries.length === 0) {
        setError('No structured data found. Drop a Nourish CSV export (Client Diary → Export to CSV), or copy directly from the Nourish table.');
        setProcessing(false);
        return;
      }
      const summary = buildWeekSummary(entries);

      // Build top clients sorted by red → amber → total
      const topClients = Object.entries(summary.clientDiary)
        .map(([name, clientEntries]) => ({
          name,
          red: clientEntries.filter(e => e.severity === 'red').length,
          amber: clientEntries.filter(e => e.severity === 'amber').length,
          total: clientEntries.length,
        }))
        .sort((a, b) => b.red - a.red || b.amber - a.amber || b.total - a.total)
        .slice(0, 8);

      const result: ParseResult = {
        entries: summary.totalEntries,
        houses: Object.keys(summary.houses).length,
        clients: Object.keys(summary.clientDiary).length,
        flags: { red: summary.allFlags.red.length, amber: summary.allFlags.amber.length },
        topClients,
        summary,
      };

      setParseResult(result);

      // Brief pause to show results before navigating
      await new Promise(r => setTimeout(r, 1200));
      onDataParsed(summary);
    } catch (e) {
      setError('Parse error: ' + (e as Error).message);
    }
    setProcessing(false);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      let content = ev.target?.result as string;
      if (file.name.endsWith('.vtt')) {
        content = content
          .replace(/WEBVTT\n\n/g, '')
          .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\n/g, '')
          .replace(/<v ([^>]+)>/g, '$1: ')
          .replace(/<\/v>/g, '');
      }
      // Auto-process CSV/TSV files immediately
      if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
        processData(content, file.name);
      } else {
        setText(content);
        setFileName(file.name);
      }
    };
    reader.readAsText(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lineCount = text.trim() ? text.trim().split('\n').length : 0;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Import Data</h1>
        <p className="text-hc-muted text-sm">
          Drop a Nourish CSV export to instantly process all clients across all houses.
        </p>
      </div>

      {/* Source cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {
            icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
            title: 'Nourish CSV Export', desc: 'Client Diary → Export to CSV', tag: 'Auto-process'
          },
          {
            icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" /></svg>,
            title: 'Nourish Table Copy', desc: 'Ctrl+A → Ctrl+C from browser', tag: null
          },
          {
            icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>,
            title: 'Teams Transcript', desc: '.vtt file from meeting', tag: null
          },
          {
            icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>,
            title: 'Free-text Notes', desc: 'Meeting minutes or notes', tag: null
          },
        ].map((s, i) => (
          <div key={i} className={`bg-hc-card border rounded-xl p-4 transition-all ${i === 0 ? 'border-hc-teal/40 bg-hc-teal/5' : 'border-hc-border hover:border-hc-border-light'}`}>
            <div className={`mb-2 ${i === 0 ? 'text-hc-teal-light' : 'text-hc-teal-light'}`}>{s.icon}</div>
            <div className="text-xs font-semibold text-white mb-0.5">{s.title}</div>
            <div className="text-[10px] text-hc-muted">{s.desc}</div>
            {s.tag && <div className="mt-2 text-[9px] text-hc-teal-light bg-hc-teal/15 px-2 py-0.5 rounded-full inline-block border border-hc-teal/20">{s.tag}</div>}
          </div>
        ))}
      </div>

      {/* How to guide */}
      <div className="bg-hc-card border border-hc-border rounded-xl p-5 mb-6">
        <div className="text-xs font-semibold text-white mb-3">Quick Guide — Nourish CSV Export (recommended)</div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Open Nourish Reports', desc: 'Go to Reporting → Client Diary, set your date range, click Run Report', color: '#14b8a6' },
            { step: '2', title: 'Export to CSV', desc: 'Click the Export / Download button at the top of the results — save the .csv file', color: '#3b82f6' },
            { step: '3', title: 'Drop it here', desc: 'Drag the CSV file onto the drop zone — all clients processed instantly, no button needed', color: '#8b5cf6' },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${s.color}20`, color: s.color }}>
                {s.step}
              </div>
              <div>
                <div className="text-[11px] font-semibold text-white">{s.title}</div>
                <div className="text-[10px] text-hc-muted leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed transition-all mb-4 cursor-pointer ${
          dragOver
            ? 'border-hc-teal-light bg-hc-teal/10'
            : 'border-hc-border hover:border-hc-teal/40 hover:bg-hc-teal/3 bg-hc-card/50'
        }`}
        style={{ minHeight: processing ? 120 : undefined }}
      >
        {processing ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-10 h-10 border-2 border-hc-teal/30 border-t-hc-teal-light rounded-full animate-spin mb-4" />
            <div className="text-sm font-semibold text-white mb-1">Processing {fileName || 'data'}…</div>
            <div className="text-xs text-hc-muted">Parsing entries, grouping by client, detecting flags</div>
          </div>
        ) : (
          <>
            {dragOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-hc-teal/5 rounded-xl z-10">
                <div className="text-center">
                  <svg className="w-12 h-12 text-hc-teal-light mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  <div className="text-sm font-semibold text-hc-teal-light">Drop to process</div>
                </div>
              </div>
            )}
            <div className="flex flex-col items-center justify-center py-10 px-6 pointer-events-none">
              <svg className="w-10 h-10 text-hc-muted/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              <div className="text-sm font-medium text-hc-muted mb-1">Drop Nourish CSV here or click to browse</div>
              <div className="text-xs text-hc-muted/60">.csv files process automatically · .txt .vtt also accepted</div>
            </div>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".txt,.vtt,.csv,.tsv,.md" className="hidden" onChange={handleFileInput} />

      {/* Or paste manually */}
      {!parseResult && !processing && (
        <details className="mb-4 group">
          <summary className="text-xs text-hc-muted cursor-pointer hover:text-white select-none list-none flex items-center gap-1.5 px-1">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            Or paste data manually
          </summary>
          <div className="mt-3">
            <div className="relative rounded-xl border border-hc-border bg-hc-card/50 mb-3">
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setParseResult(null); setError(''); }}
                placeholder={'Paste Nourish Client Diary table data here (Ctrl+A → Ctrl+C from browser)\nor any tab/pipe-separated export…'}
                className="w-full min-h-[200px] bg-transparent p-5 text-hc-text font-mono text-xs leading-relaxed resize-y placeholder:text-hc-muted/40 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[11px] text-hc-muted">{wordCount.toLocaleString()} words · {lineCount.toLocaleString()} lines</div>
              {text.trim() && (
                <button onClick={() => { setText(''); setParseResult(null); setError(''); }} className="text-[11px] text-hc-muted hover:text-flag-red transition-colors">Clear</button>
              )}
              <button
                onClick={() => processData(text)}
                disabled={!text.trim() || processing}
                className="ml-auto flex items-center gap-2 px-5 py-2 bg-hc-teal text-white text-sm font-semibold rounded-xl hover:bg-hc-teal-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Analyse
              </button>
            </div>
          </div>
        </details>
      )}

      {/* Parse result */}
      {parseResult && (
        <div className="bg-[#071a10] border border-emerald-900/40 rounded-xl p-5 mb-4">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/30 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white mb-1">
                {fileName ? `${fileName} — ` : ''}Processed successfully
              </div>
              <div className="grid grid-cols-4 gap-3 mt-2">
                <div className="bg-[#0a1120] border border-[#1e3050] rounded-lg p-2.5 text-center">
                  <div className="text-lg font-black text-white">{parseResult.entries.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500">Total entries</div>
                </div>
                <div className="bg-[#0a1120] border border-[#1e3050] rounded-lg p-2.5 text-center">
                  <div className="text-lg font-black text-teal-400">{parseResult.clients}</div>
                  <div className="text-[10px] text-gray-500">Clients</div>
                </div>
                <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-black text-red-400">{parseResult.flags.red}</div>
                  <div className="text-[10px] text-gray-500">Red flags</div>
                </div>
                <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-black text-amber-400">{parseResult.flags.amber}</div>
                  <div className="text-[10px] text-gray-500">Amber flags</div>
                </div>
              </div>
            </div>
            <div className="text-xs text-emerald-400 shrink-0 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Loading dashboard…
            </div>
          </div>

          {/* Top clients with flags */}
          {parseResult.topClients.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Priority clients — top by flags</div>
              <div className="grid grid-cols-2 gap-1.5">
                {parseResult.topClients.map(c => (
                  <div key={c.name} className="flex items-center gap-2 bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2">
                    <div className="w-6 h-6 rounded-full bg-teal-900/40 flex items-center justify-center text-[10px] font-bold text-teal-400 shrink-0">
                      {c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-white truncate">{c.name}</div>
                      <div className="text-[10px] text-gray-600">{c.total} entries</div>
                    </div>
                    <div className="flex gap-1">
                      {c.red > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-900/60 text-red-400">{c.red}</span>}
                      {c.amber > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400">{c.amber}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-flag-red/5 border border-flag-red/20 rounded-xl p-4 mb-4 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-flag-red/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-flag-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-white mb-1">Could not parse file</div>
            <div className="text-xs text-hc-muted">{error}</div>
          </div>
        </div>
      )}

      {/* Nourish quick links */}
      <div className="mt-6 bg-hc-card/50 rounded-xl border border-hc-border p-4 flex items-center justify-between">
        <div className="text-[11px] text-hc-muted">
          <span className="font-semibold text-white mr-2">Quick access:</span>
          <a href="https://hazelcare.nourishcare.com/user/login?destination=reporting/clientdiary" target="_blank" rel="noopener" className="text-hc-teal-light hover:underline">
            Nourish Client Diary
          </a>
          <span className="mx-2 text-hc-border">|</span>
          <a href="https://org.nourishcare.co.uk/hazel-care-ltd+nc-hazelcare#/" target="_blank" rel="noopener" className="text-hc-teal-light hover:underline">
            Nourish Portal
          </a>
        </div>
        <div className="text-[10px] text-hc-muted flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          All data stays local — zero API calls
        </div>
      </div>
    </div>
  );
}
