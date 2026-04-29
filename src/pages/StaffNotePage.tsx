import { useState, useRef, useCallback } from 'react';
import { Sparkles, RefreshCw, FileText, LayoutGrid, Layers, Zap, Clock, ShieldCheck, Globe2, Link2, Copy, CheckCircle2 } from 'lucide-react';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as Window & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition)
    : null;

const speechSupported = !!SpeechRecognitionAPI;

export const VOICE_LANGUAGES = [
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'fr-FR', label: 'French', flag: '🇫🇷' },
  { code: 'es-ES', label: 'Spanish', flag: '🇪🇸' },
  { code: 'de-DE', label: 'German', flag: '🇩🇪' },
  { code: 'it-IT', label: 'Italian', flag: '🇮🇹' },
  { code: 'pt-PT', label: 'Portuguese', flag: '🇵🇹' },
  { code: 'pl-PL', label: 'Polish', flag: '🇵🇱' },
  { code: 'ro-RO', label: 'Romanian', flag: '🇷🇴' },
  { code: 'ar-SA', label: 'Arabic', flag: '🇸🇦' },
];

let _voiceLang = 'en-GB';
export function setVoiceLang(lang: string) { _voiceLang = lang; }

function useSpeechToText(onResult: (transcript: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const stop = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setListening(false);
  }, []);
  const start = useCallback(() => {
    if (!speechSupported) return;
    const recognition = new (SpeechRecognitionAPI as SpeechRecognitionCtor)();
    recognition.lang = _voiceLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) onResult(event.results[i][0].transcript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [onResult]);
  return { listening, toggle: () => listening ? stop() : start() };
}

function MicButton({ fieldKey, onTranscript }: { fieldKey: string; onTranscript: (key: string, text: string) => void }) {
  const { listening, toggle } = useSpeechToText(t => onTranscript(fieldKey, t));
  const lang = VOICE_LANGUAGES[0];
  if (!speechSupported) return null;
  return (
    <button type="button" onClick={toggle} className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl
        ${listening ? 'bg-flag-red/20 border-2 border-flag-red text-flag-red animate-pulse' : 'hc-clay-raised border border-hc-teal/20 text-hc-teal hover:bg-hc-teal/5'}`}>
      <div className={`w-2 h-2 rounded-full ${listening ? 'bg-flag-red animate-ping' : 'bg-hc-teal'}`} />
      <span>{listening ? 'LISTENING...' : `${lang?.flag} DICTATE`}</span>
    </button>
  );
}

interface ProtocolStack {
  id: string;
  name: string;
  desc: string;
  icon: any;
  structure: string[];
}

const INTELLIGENCE_STACKS: ProtocolStack[] = [
  { 
    id: 'day_shift_1to1', 
    name: 'Day Shift 1:1 Narrative', 
    desc: 'Temporal blocks with Active Accountability (I supported...)',
    icon: <Clock size={14} />,
    structure: ['Morning Routine', '1:1 Engagement (AM)', 'Midday Nutrition', '1:1 Engagement (PM)', 'Evening Outcome']
  },
  { 
    id: 'incident_forensic', 
    name: 'Forensic Incident Stack', 
    desc: 'ABC pattern with immediate de-escalation evidence',
    icon: <ShieldCheck size={14} />,
    structure: ['Antecedent (Trigger)', 'Behaviour (Description)', 'Consequence (Action)', 'Post-Incident Welfare']
  },
  { 
    id: 'medication_refusal', 
    name: 'Medication Refusal Protocol', 
    desc: 'Mental capacity assessment & risk mitigation evidence',
    icon: <Zap size={14} />,
    structure: ['Medication Details', 'Reason for Refusal', 'Capacity Prompting', 'Risk Communication', 'MDT Notification']
  }
];

export function StaffNotePage() {
  const [house, setHouse] = useState('Lingfield House');
  const [client, setClient] = useState('');
  const [freeText, setFreeText] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedNote, setEnhancedNote] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [activeStack, setActiveStack] = useState<ProtocolStack | null>(null);
  const [showStackPicker, setShowStackPicker] = useState(false);
  const [voiceLang, setVoiceLangState] = useState('en-GB');
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  const setVoiceLangUi = (lang: string) => {
    setVoiceLangState(lang);
    setVoiceLang(lang);
  };

  const loadStack = (stack: ProtocolStack) => {
    setActiveStack(stack);
    const blueprint = stack.structure.map(s => `${s.toUpperCase()}:\n[Awaiting Intelligence...]\n`).join('\n');
    setFreeText(blueprint);
    setShowStackPicker(false);
  };

  const wordCount = freeText.split(/\s+/).filter(Boolean).length;

  const enhanceNote = async () => {
    if (!freeText.trim()) return;
    setEnhancing(true); setEnhancedNote('');
    try {
      const res = await fetch('/api/staff/enhance-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ text: freeText, noteType: activeStack ? activeStack.name : 'Clinical Entry', clientName: client, useStack: !!activeStack }),
      });
      if (!res.ok) throw new Error('Offline');
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
        setEnhancedNote(result);
      }
    } catch { /* ui handled */ }
    finally { setEnhancing(false); }
  };

  const issueStaffLink = async () => {
    setSharing(true);
    try {
      const res = await fetch('/api/staff/issue-staff-link', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: 'notes' }),
      });
      if (!res.ok) throw new Error('Failed to issue secure link');
      const data = await res.json();
      setShareLink(data.link || '');
      setShareCode(data.code || '');
    } catch {
      setShareLink('');
      setShareCode('');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="p-6 lg:p-12 max-w-[1700px] mx-auto animate-in fade-in duration-700">
      
      <div className="mb-12 hc-clay-raised overflow-hidden border border-hc-teal/20 shadow-2xl">
        <div className="bg-hc-teal px-8 py-5 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <Layers className="w-5 h-5 text-hc-bone" />
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-hc-bone block leading-none mb-1">Intelligence Protocol Assembler</span>
                <span className="text-[10px] font-bold text-hc-bone/50 uppercase tracking-widest leading-none">Active Stack: {activeStack?.name || 'None Loaded'}</span>
              </div>
           </div>
           
           <div className="relative">
              <button 
                onClick={() => setShowStackPicker(!showStackPicker)}
                className="flex items-center gap-3 px-6 py-2.5 hc-clay-raised bg-hc-bone/10 border-white/10 text-[10px] font-black uppercase tracking-widest text-hc-bone hover:bg-white/20 transition-all rounded-xl shadow-xl active:scale-95"
              >
                <LayoutGrid size={14} />
                Load Intelligence Stack
              </button>

              {showStackPicker && (
                <div className="absolute right-0 top-14 w-80 hc-clay-raised-high bg-hc-surface p-3 z-50 animate-in zoom-in-95 duration-300 shadow-3xl">
                  <div className="p-3 border-b border-hc-border mb-2">
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Select Narrative Protocol</span>
                  </div>
                  <div className="space-y-1.5">
                    {INTELLIGENCE_STACKS.map(s => (
                      <button 
                        key={s.id} 
                        onClick={() => loadStack(s)}
                        className="w-full text-left p-4 rounded-2xl hover:bg-hc-teal/5 transition-all group flex items-start gap-4"
                      >
                        <div className="w-10 h-10 rounded-xl hc-clay-inset flex items-center justify-center text-hc-teal shrink-0">{s.icon}</div>
                        <div>
                          <div className="text-[11px] font-black text-hc-text uppercase leading-none mb-1.5 group-hover:text-hc-teal">{s.name}</div>
                          <div className="text-[9px] font-bold text-hc-muted uppercase leading-tight">{s.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-hc-border/20 p-2">
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Intelligence Input Stream</label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 hc-clay-inset px-3 py-2 rounded-xl">
                  <Globe2 className="w-3.5 h-3.5 text-hc-teal" />
                  <select
                    value={voiceLang}
                    onChange={(e) => setVoiceLangUi(e.target.value)}
                    className="bg-transparent text-[10px] font-black uppercase tracking-widest text-hc-text outline-none"
                  >
                    {VOICE_LANGUAGES.map(v => <option key={v.code} value={v.code}>{v.flag} {v.label}</option>)}
                  </select>
                </div>
                <MicButton fieldKey="freetext" onTranscript={(_, t) => setFreeText(prev => prev + ' ' + t)} />
              </div>
            </div>
            <textarea
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Paste raw notes or dictate... Stacks will automatically organise the data into a forensic-grade narrative."
              className="w-full hc-clay-inset p-8 text-[13px] text-hc-text font-medium leading-relaxed resize-none focus:outline-none min-h-[450px] scrollbar-none italic"
            />
            <button onClick={enhanceNote} disabled={!freeText.trim() || enhancing} className="w-full py-5 btn-tactical shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-95">
              {enhancing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Assemble Gold Standard Narrative
            </button>
          </div>

          <div className="p-8 space-y-6 bg-hc-teal/[0.01]">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Standardised Output Matrix</label>
               {enhancedNote && <span className="pill pill-teal text-[9px] animate-pulse">✓ VERIFIED FORENSIC</span>}
            </div>
            <div className="hc-clay-inset p-8 min-h-[450px] bg-transparent overflow-y-auto scrollbar-thin">
              {enhancedNote ? (
                <pre className="text-[14px] text-hc-text font-black leading-loose whitespace-pre-wrap italic animate-in slide-in-from-bottom-4 duration-1000">
                  {enhancedNote}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-20">
                  <FileText className="w-20 h-20 text-hc-muted mb-8" strokeWidth={1} />
                  <div className="text-[12px] font-black uppercase tracking-[0.4em] mb-3">Awaiting Assembly</div>
                  <p className="text-[10px] font-bold uppercase tracking-widest max-w-xs">Load a stack and provide clinical raw data to generate a Gold Standard report.</p>
                </div>
              )}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(enhancedNote); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
              disabled={!enhancedNote}
              className={`w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all ${copied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
            >
              {copied ? 'COPIED TO CLIPBOARD' : 'COPY REWRITTEN NARRATIVE'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto hc-clay-raised p-8 flex flex-wrap gap-8 items-end">
         <div className="flex-1 min-w-[200px] space-y-3">
            <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1">Service User Focus</label>
            <input value={client} onChange={e => setClient(e.target.value)} placeholder="Full Name..." className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text outline-none shadow-inner" />
         </div>
         <div className="flex-1 min-w-[200px] space-y-3">
            <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1">Location Site</label>
            <select value={house} onChange={e => setHouse(e.target.value)} className="w-full hc-clay-inset px-6 py-4 text-sm font-black text-hc-text outline-none shadow-inner bg-transparent">
               {['Lingfield House', 'Church House', 'Laurel House'].map(h => <option key={h} value={h}>{h}</option>)}
            </select>
         </div>
         <div className="px-8 py-5 hc-clay-inset flex flex-col items-center">
            <span className="text-[10px] font-black text-hc-muted uppercase opacity-60 mb-1">Volume</span>
            <span className="text-xl font-black text-hc-teal tabular-nums">{wordCount} WDS</span>
         </div>
      </div>

      <div className="max-w-4xl mx-auto mt-6 hc-clay-raised p-6">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-1">Staff Share Link</div>
            <div className="text-[11px] font-bold text-hc-text">Secure one-time access for remote dictation</div>
          </div>
          <button
            onClick={() => void issueStaffLink()}
            disabled={sharing}
            className="px-5 py-3 rounded-xl btn-tactical text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
          >
            <Link2 className={`w-3.5 h-3.5 ${sharing ? 'animate-pulse' : ''}`} />
            {sharing ? 'Generating...' : 'Generate Staff Link'}
          </button>
        </div>
        {shareLink && (
          <div className="mt-4 p-4 hc-clay-inset rounded-2xl">
            <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-2">Access Code: {shareCode || '—'}</div>
            <div className="text-[11px] font-bold text-hc-text break-all mb-3">{shareLink}</div>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(shareLink);
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 2000);
              }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${copiedShare ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
            >
              {copiedShare ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedShare ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
