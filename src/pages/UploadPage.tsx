import { useState, useRef } from 'react';
import { parseNourishData, buildWeekSummary } from '../lib/nourish-parser';
import type { WeekSummary } from '../lib/types';

interface Props {
  onDataParsed: (data: WeekSummary) => void;
}

export function UploadPage({ onDataParsed }: Props) {
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleProcess() {
    if (!text.trim()) return;
    setProcessing(true);
    setError('');

    try {
      await new Promise(r => setTimeout(r, 300));
      const entries = parseNourishData(text);
      if (entries.length === 0) {
        setError('No structured data found. Try copying directly from the Nourish Client Diary table.');
        setProcessing(false);
        return;
      }
      const summary = buildWeekSummary(entries);
      onDataParsed(summary);
    } catch (e) {
      setError('Parse error: ' + (e as Error).message);
    }
    setProcessing(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Import Data</h1>
        <p className="text-hc-muted text-sm">
          Paste from Nourish Client Diary, Teams transcript, or meeting notes.
          All processing happens locally — zero API calls.
        </p>
      </div>

      {/* Quick guide */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { step: '1', title: 'Open Nourish', desc: 'Client Diary → set date range → Run Report' },
          { step: '2', title: 'Select All + Copy', desc: 'Ctrl+A on the table, then Ctrl+C' },
          { step: '3', title: 'Paste Below', desc: 'Ctrl+V into the text box, hit Analyse' },
        ].map(s => (
          <div key={s.step} className="bg-hc-card border border-hc-border rounded-lg p-4">
            <div className="w-7 h-7 rounded-full bg-hc-teal/20 text-hc-teal-light text-sm font-bold flex items-center justify-center mb-2">{s.step}</div>
            <div className="text-sm font-semibold text-white mb-1">{s.title}</div>
            <div className="text-xs text-hc-muted">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="bg-hc-card border-2 border-dashed border-hc-border rounded-xl p-5 mb-4 focus-within:border-hc-teal-light transition-colors">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Paste Nourish Client Diary data here...\n\nSupported formats:\n• Nourish table (copy from browser)\n• Tab-separated data\n• Meeting transcript text\n• Teams .vtt transcript'}
          className="w-full min-h-[280px] bg-hc-dark border border-hc-border rounded-lg p-4 text-hc-text font-mono text-xs leading-relaxed resize-y placeholder:text-hc-muted/50 focus:outline-none focus:border-hc-teal-light"
        />

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 bg-hc-border text-hc-muted text-xs rounded-lg hover:bg-white/10 hover:text-white transition-colors"
          >
            Upload .txt / .vtt / .csv
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.vtt,.csv,.tsv,.md"
            className="hidden"
            onChange={handleFile}
          />
          <span className="text-xs text-hc-muted">{wordCount} words</span>

          <button
            onClick={handleProcess}
            disabled={!text.trim() || processing}
            className="ml-auto px-6 py-2.5 bg-hc-teal text-white text-sm font-semibold rounded-lg hover:bg-hc-teal-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analysing...
              </>
            ) : (
              'Analyse Data'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-flag-red/10 border border-flag-red/30 rounded-lg p-4 text-sm text-flag-red">
          {error}
        </div>
      )}

      {/* Nourish link */}
      <div className="mt-6 p-4 bg-hc-card/50 rounded-lg border border-hc-border">
        <div className="text-xs text-hc-muted">
          <strong className="text-white">Quick access:</strong>{' '}
          <a href="https://hazelcare.nourishcare.com/user/login?destination=reporting/clientdiary" target="_blank" rel="noopener" className="text-hc-teal-light hover:underline">
            Nourish Client Diary
          </a>
          {' · '}
          <a href="https://org.nourishcare.co.uk/hazel-care-ltd+nc-hazelcare#/" target="_blank" rel="noopener" className="text-hc-teal-light hover:underline">
            Nourish Portal
          </a>
        </div>
      </div>
    </div>
  );
}
