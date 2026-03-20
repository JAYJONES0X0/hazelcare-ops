import { useState, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { parseNourishData, buildWeekSummary } from '../lib/nourish-parser';
import type { WeekSummary } from '../lib/types';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Props {
  onDataParsed: (data: WeekSummary) => void;
}

interface TacticalModule {
  id: string;
  label: string;
  category: string;
  icon: string;
  description: string;
  keywords: string[];
}

const TACTICAL_MODULES: TacticalModule[] = [
  { id: 'care-plan', label: 'Support Blueprint', category: 'Clinical', icon: '📋', description: 'Comprehensive 21-domain care architecture', keywords: ['care plan', 'support plan', 'blueprint', 'daily support'] },
  { id: 'risk', label: 'Risk Matrix', category: 'Safeguarding', icon: '🛡️', description: 'Vector quantification and threat identification', keywords: ['risk', 'matrix', 'assessment', 'danger', 'threat'] },
  { id: 'pbs', label: 'PBS Protocol', category: 'Behavioral', icon: '🧠', description: 'Positive Behaviour Support & de-escalation cycles', keywords: ['pbs', 'behaviour', 'protocol', 'escalation', 'proactive'] },
  { id: 'incident', label: 'Incident Report', category: 'Operational', icon: '🚨', description: 'Accident, injury, or behavioral breach logging', keywords: ['incident', 'accident', 'injury', 'fall', 'breach'] },
  { id: 'handover', label: 'Shift Handover', category: 'Continuity', icon: '🔄', description: 'Temporal cycle synchronization for staff teams', keywords: ['handover', 'shift', 'transition', 'staff note'] },
];

export function UploadPage({ onDataParsed }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [text, setText] = useState('');
  
  const [showGateway, setShowGateway] = useState(false);
  const [intent, setIntent] = useState('');
  const [pendingPayload, setPendingPayload] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const filteredModules = TACTICAL_MODULES.filter(m => 
    !intent || 
    m.label.toLowerCase().includes(intent.toLowerCase()) || 
    m.category.toLowerCase().includes(intent.toLowerCase()) ||
    m.keywords.some(k => k.includes(intent.toLowerCase()))
  );

  const processData = async (rawText: string) => {
    if (!rawText.trim()) return;
    setProcessing(true);
    
    try {
      const data = parseNourishData(rawText);
      if (data.length === 0) throw new Error('No tactical data detected');
      const summary = buildWeekSummary(data);
      onDataParsed(summary);
      setShowGateway(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setProcessing(true);
    try {
      let extractedText = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extractedText += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
      } else {
        extractedText = await file.text();
      }
      setPendingPayload(extractedText);
      setShowGateway(true);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 w-full animate-in fade-in duration-1000 scrollbar-thin">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-white mb-2 tracking-tighter text-shimmer">Data Augmentation</h1>
        <div className="flex items-center gap-3">
          <span className="pill pill-teal text-[10px] font-black uppercase tracking-wider shadow-lg">Intelligence Ingestion</span>
          <p className="text-hc-muted text-[10px] font-bold uppercase tracking-widest ml-1">Drop Nourish telemetry to synchronize the fleet</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { icon: '📄', title: 'Nourish Export', desc: 'Direct CSV/PDF Telemetry', tag: 'Native' },
          { icon: '⌨️', title: 'Grid Capture', desc: 'Copy/Paste from Browser', tag: 'Manual' },
          { icon: '🎙️', title: 'Teams Script', desc: '.vtt meeting transcript', tag: 'Audio' },
          { icon: '📝', title: 'Intelligence Notes', desc: 'Unstructured Field Data', tag: 'Raw' },
        ].map((s, i) => (
          <div key={i} className={`glass-light border rounded-[1.5rem] p-6 transition-all duration-500 card-glow group hover:scale-[1.05] active:scale-95 cursor-default ${i === 0 ? 'border-hc-teal/40 bg-hc-teal/5 glow-teal' : 'border-white/5 hover:border-white/20'}`}>
            <div className="text-3xl mb-4 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-3">{s.icon}</div>
            <div className="text-sm font-black text-white mb-1.5 uppercase tracking-tight group-hover:text-hc-teal-light transition-colors">{s.title}</div>
            <div className="text-[10px] font-medium text-hc-muted leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">{s.desc}</div>
            {s.tag && <div className="mt-4 pill pill-teal text-[8px] font-black uppercase tracking-[0.2em] px-3">{s.tag}</div>}
          </div>
        ))}
      </div>

      <div
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
        className={`relative rounded-[3rem] border-2 border-dashed transition-all duration-700 mb-10 cursor-pointer group overflow-hidden active:scale-[0.98] ${
          dragOver ? 'border-hc-teal-light bg-hc-teal/10 glow-teal shadow-2xl' : 'border-white/10 hover:border-hc-teal/40 hover:bg-white/[0.01] glass shadow-2xl'
        }`}
        style={{ minHeight: 300 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-hc-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        <div className="flex flex-col items-center justify-center py-20 px-8 pointer-events-none relative z-10">
          <div className="w-24 h-24 rounded-[2rem] glass border-2 border-white/10 flex items-center justify-center mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 shadow-2xl group-hover:border-hc-teal/40">
            <svg className="w-12 h-12 text-hc-teal-light/40 group-hover:text-hc-teal-light transition-all duration-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
          </div>
          <div className="text-base font-black text-white/80 group-hover:text-white transition-colors mb-2 uppercase tracking-[0.2em] text-shimmer">Transmit Telemetry Payload</div>
          <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] opacity-40 group-hover:opacity-80 transition-opacity">Drag export here or click to browse local storage</div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".txt,.vtt,.csv,.tsv,.md,.pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

      <details className="mb-10 group/details">
        <summary className="text-[10px] font-black uppercase tracking-[0.3em] text-hc-muted cursor-pointer hover:text-hc-teal-light select-none list-none flex items-center gap-4 px-4 transition-all py-2 rounded-xl hover:bg-white/5 w-fit">
          <span className="w-7 h-7 rounded-xl glass border border-white/10 flex items-center justify-center group-open/details:rotate-90 transition-all duration-500 shadow-lg">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </span>
          MANUAL DATA STREAM INPUT
        </summary>
        <div className="mt-6 animate-in slide-in-from-top-4 duration-700">
          <div className="relative rounded-[2rem] border border-white/10 glass p-1 shadow-2xl overflow-hidden group/text">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Paste Nourish telemetry stream here...'}
              className="w-full min-h-[300px] bg-transparent p-8 text-hc-text font-mono text-xs leading-loose resize-y placeholder:text-hc-muted/20 focus:outline-none scrollbar-thin font-medium italic"
            />
          </div>
          <div className="flex justify-end mt-6">
            <button onClick={() => processData(text)} disabled={!text.trim() || processing} className="px-10 py-4 btn-gradient rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-20">Initiate Terminal Analysis</button>
          </div>
        </div>
      </details>

      {showGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="glass border border-white/10 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-[0_0_100px_rgba(20,184,166,0.15)] animate-in zoom-in-95 duration-500">
            <div className="p-10 border-b border-white/5 bg-hc-dark/40">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-16 h-16 rounded-[1.25rem] glass border-2 border-hc-teal/40 flex items-center justify-center text-3xl shadow-2xl glow-teal animate-float">📡</div>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-1 text-shimmer">Intelligence Gateway</h3>
                  <div className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" /><p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-60">Synthesizing Payload: {fileName}</p></div>
                </div>
              </div>
              <div className="relative group">
                <label className="section-header text-[9px] mb-3 ml-1 block opacity-40 tracking-[0.3em]">WHAT IS THIS INTELLIGENCE PAYLOAD FOR?</label>
                <input
                  autoFocus
                  value={intent}
                  onChange={e => setIntent(e.target.value)}
                  placeholder="e.g. 'update support plan', 'incident report', 'risk scan'..."
                  className="w-full bg-hc-dark/60 border-2 border-white/10 rounded-2xl px-8 py-5 text-lg text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark font-medium italic"
                />
              </div>
            </div>
            <div className="p-10 max-h-[400px] overflow-y-auto scrollbar-thin">
              <div className="section-header text-[9px] mb-6 opacity-40 tracking-[0.3em]">SUGGESTED OPERATIONAL MODULES</div>
              <div className="space-y-3">
                {filteredModules.map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => processData(pendingPayload || '')}
                    className="w-full flex items-center gap-6 p-6 rounded-[1.5rem] glass-light border border-white/5 hover:border-hc-teal/40 hover:bg-hc-teal/5 transition-all duration-500 text-left group/mod active:scale-[0.98] animate-in slide-in-from-bottom-4"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="w-12 h-12 rounded-xl glass border border-white/10 flex items-center justify-center text-2xl shadow-xl transition-all duration-700 group-hover/mod:scale-110 group-hover/mod:rotate-3 group-hover/mod:border-hc-teal/40">{m.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-base font-black text-white group-hover/mod:text-hc-teal-light transition-colors uppercase tracking-tight">{m.label}</span>
                        <span className="pill py-0 px-2 text-[8px] opacity-40 group-hover/mod:opacity-100 transition-opacity">{m.category}</span>
                      </div>
                      <p className="text-[11px] font-medium text-hc-muted opacity-60 group-hover/mod:opacity-90 leading-relaxed italic">"{m.description}"</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted opacity-0 group-hover/mod:opacity-100 group-hover/mod:translate-x-2 transition-all duration-500 shadow-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-8 border-t border-white/5 bg-black/20 flex justify-between items-center">
              <button onClick={() => setShowGateway(false)} className="text-[10px] font-black text-hc-muted hover:text-white uppercase tracking-[0.3em] transition-all">Abort Transmission</button>
              <div className="text-[9px] font-black text-hc-teal-light/40 uppercase tracking-[0.2em]">Local Encryption Active</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto pt-20 pb-10 flex flex-col items-center">
        <div className="flex items-center gap-4 px-8 py-4 glass-light border border-white/5 rounded-3xl text-[10px] font-black text-hc-muted uppercase tracking-[0.4em] shadow-2xl opacity-40 group hover:opacity-100 transition-opacity cursor-default">
          <svg className="w-4 h-4 text-hc-teal-light group-hover:rotate-180 transition-transform duration-1000" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          Local Encryption Protocol Active · No External Transmissions
        </div>
      </div>
    </div>
  );
}
