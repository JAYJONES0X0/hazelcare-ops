import { useState, useRef, useCallback } from 'react';
import { parseNourishData, buildWeekSummary } from '../lib/nourish-parser';
import type { WeekSummary } from '../lib/types';

interface Props {
  onDataParsed: (data: WeekSummary) => void;
}

export function UploadPage({ onDataParsed }: Props) {
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<{ entries: number; houses: number; flags: { red: number; amber: number } } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleProcess() {
    if (!text.trim()) return;
    setProcessing(true);
    setError('');
    setParseResult(null);

    try {
      await new Promise(r => setTimeout(r, 400));
      const entries = parseNourishData(text);
      if (entries.length === 0) {
        setError('No structured data found. Try copying directly from the Nourish Client Diary table (Ctrl+A then Ctrl+C on the report).');
        setProcessing(false);
        return;
      }
      const summary = buildWeekSummary(entries);
      setParseResult({
        entries: summary.totalEntries,
        houses: Object.keys(summary.houses).length,
        flags: { red: summary.allFlags.red.length, amber: summary.allFlags.amber.length },
      });

      // Brief pause to show results before navigating
      await new Promise(r => setTimeout(r, 800));
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
      setText(content);
    };
    reader.readAsText(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
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
          Paste from Nourish Client Diary, Teams transcript, or upload a file. All processing happens locally.
        </p>
      </div>

      {/* Source cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" /></svg>, title: 'Nourish Table', desc: 'Client Diary report', tag: 'Recommended' },
          { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>, title: 'Teams Transcript', desc: '.vtt file from meeting', tag: null },
          { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>, title: 'Meeting Notes', desc: 'Free-text minutes', tag: null },
          { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>, title: 'File Upload', desc: '.txt .vtt .csv .tsv', tag: null },
        ].map((s, i) => (
          <div key={i} className="bg-hc-card border border-hc-border rounded-xl p-4 hover:border-hc-border-light transition-all">
            <div className="text-hc-teal-light mb-2">{s.icon}</div>
            <div className="text-xs font-semibold text-white mb-0.5">{s.title}</div>
            <div className="text-[10px] text-hc-muted">{s.desc}</div>
            {s.tag && <div className="mt-2 text-[9px] text-hc-teal-light bg-hc-teal/15 px-2 py-0.5 rounded-full inline-block border border-hc-teal/20">{s.tag}</div>}
          </div>
        ))}
      </div>

      {/* How to guide */}
      <div className="bg-hc-card border border-hc-border rounded-xl p-5 mb-6">
        <div className="text-xs font-semibold text-white mb-3">Quick Guide — Nourish Client Diary</div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Open Nourish', desc: 'Reporting → Client Diary → set date range → Run Report', color: '#14b8a6' },
            { step: '2', title: 'Select All + Copy', desc: 'Ctrl+A on the results table, then Ctrl+C to copy everything', color: '#3b82f6' },
            { step: '3', title: 'Paste Below', desc: 'Click the text area below and Ctrl+V, then hit Analyse', color: '#8b5cf6' },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: `${s.color}20`, color: s.color }}>
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

      {/* Drop zone + textarea */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-xl border-2 border-dashed transition-all mb-4 ${
          dragOver
            ? 'border-hc-teal-light bg-hc-teal/5'
            : 'border-hc-border hover:border-hc-border-light bg-hc-card/50'
        }`}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-hc-teal/5 rounded-xl z-10">
            <div className="text-center">
              <svg className="w-12 h-12 text-hc-teal-light mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              <div className="text-sm font-semibold text-hc-teal-light">Drop file here</div>
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); setParseResult(null); setError(''); }}
          placeholder={'Paste Nourish Client Diary data here...\n\nSupported formats:\n  • Nourish table copy (Ctrl+A → Ctrl+C from browser)\n  • Tab-separated or pipe-separated data\n  • Teams .vtt transcript\n  • Free-text meeting notes\n\nOr drag & drop a file onto this area.'}
          className="w-full min-h-[300px] bg-transparent p-5 text-hc-text font-mono text-xs leading-relaxed resize-y placeholder:text-hc-muted/40 focus:outline-none"
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 bg-hc-card border border-hc-border text-hc-muted text-xs rounded-xl hover:bg-hc-card-hover hover:text-white hover:border-hc-border-light transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
          Upload File
        </button>
        <input ref={fileRef} type="file" accept=".txt,.vtt,.csv,.tsv,.md" className="hidden" onChange={handleFileInput} />

        <div className="flex items-center gap-3 text-[11px] text-hc-muted">
          <span>{wordCount.toLocaleString()} words</span>
          <span className="text-hc-border">|</span>
          <span>{lineCount.toLocaleString()} lines</span>
        </div>

        {text.trim() && (
          <button
            onClick={() => { setText(''); setParseResult(null); setError(''); }}
            className="text-[11px] text-hc-muted hover:text-flag-red transition-colors"
          >
            Clear
          </button>
        )}

        <button
          onClick={handleProcess}
          disabled={!text.trim() || processing}
          className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-hc-teal text-white text-sm font-semibold rounded-xl hover:bg-hc-teal-light transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-teal"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analysing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Analyse Data
            </>
          )}
        </button>
      </div>

      {/* Parse result */}
      {parseResult && (
        <div className="bg-flag-green/5 border border-flag-green/20 rounded-xl p-4 mb-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-flag-green/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-flag-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Data parsed successfully</div>
            <div className="text-xs text-hc-muted">
              {parseResult.entries} entries found across {parseResult.houses} houses — {parseResult.flags.red} red flags, {parseResult.flags.amber} amber flags
            </div>
          </div>
          <div className="ml-auto text-xs text-flag-green">Redirecting to dashboard...</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-flag-red/5 border border-flag-red/20 rounded-xl p-4 mb-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-flag-red/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-flag-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Parse failed</div>
            <div className="text-xs text-hc-muted">{error}</div>
          </div>
        </div>
      )}

      {/* Nourish links */}
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
