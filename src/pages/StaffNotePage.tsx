import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { uid } from '../lib/storage';
import { Sparkles, RefreshCw, ChevronRight, FileText } from 'lucide-react';

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

// ============================================================
// VOICE-TO-NOTE Â· Web Speech API
// ============================================================
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
  { code: 'hi-IN', label: 'Hindi', flag: '🇮🇳' },
  { code: 'bn-IN', label: 'Bengali', flag: '🇮🇳' },
  { code: 'ne-NP', label: 'Nepali', flag: '🇳🇵' },
  { code: 'si-LK', label: 'Sinhala', flag: '🇱🇰' },
  { code: 'ta-IN', label: 'Tamil', flag: '🇮🇳' },
  { code: 'ur-PK', label: 'Urdu', flag: '🇵🇰' },
  { code: 'gu-IN', label: 'Gujarati', flag: '🇮🇳' },
  { code: 'pa-Guru-IN', label: 'Punjabi', flag: '🇮🇳' },
  { code: 'ml-IN', label: 'Malayalam', flag: '🇮🇳' },
  { code: 'te-IN', label: 'Telugu', flag: '🇮🇳' },
  { code: 'fil-PH', label: 'Filipino', flag: '🇵🇭' },
  { code: 'zh-CN', label: 'Mandarin', flag: '🇨🇳' },
  { code: 'zh-HK', label: 'Cantonese', flag: '🇭🇰' },
  { code: 'vi-VN', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'sw-KE', label: 'Kiswahili', flag: '🇰🇪' },
  { code: 'yo-NG', label: 'Yorùbá', flag: '🇳🇬' },
  { code: 'ig-NG', label: 'Igbo', flag: '🇳🇬' },
  { code: 'am-ET', label: 'Amharic', flag: '🇪🇹' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  { code: 'pl-PL', label: 'Polski', flag: '🇵🇱' },
  { code: 'ro-RO', label: 'Română', flag: '🇷🇴' },
  { code: 'pt-PT', label: 'Português', flag: '🇵🇹' },
  { code: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'lt-LT', label: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv-LV', label: 'Latviešu', flag: '🇱🇻' },
  { code: 'sk-SK', label: 'Slovenčina', flag: '🇸🇰' },
];

let _voiceLang = 'en-GB';
export function setVoiceLang(lang: string) { _voiceLang = lang; }
export function getVoiceLang() { return _voiceLang; }

function useSpeechToText(onResult: (transcript: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);

  const stop = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!speechSupported) return;
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    const recognition = new (SpeechRecognitionAPI as SpeechRecognitionCtor)();
    recognition.lang = _voiceLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = '';
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) { finalTranscript += t; onResult(finalTranscript); finalTranscript = ''; }
      }
    };
    recognition.onerror = () => { setListening(false); recognitionRef.current = null; };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [onResult]);

  const toggle = useCallback(() => { if (listening) stop(); else start(); }, [listening, start, stop]);
  useEffect(() => () => { if (recognitionRef.current) recognitionRef.current.stop(); }, []);
  return { listening, toggle };
}

function MicButton({ fieldKey, onTranscript }: { fieldKey: string; onTranscript: (key: string, text: string) => void }) {
  const handleResult = useCallback((t: string) => onTranscript(fieldKey, t), [fieldKey, onTranscript]);
  const { listening, toggle } = useSpeechToText(handleResult);
  const lang = VOICE_LANGUAGES.find(l => l.code === _voiceLang);
  if (!speechSupported) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      title={`Tap to speak in ${lang?.label ?? _voiceLang}`}
      className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 select-none shadow-xl
        ${listening
          ? 'bg-flag-red/20 border-2 border-flag-red text-flag-red glow-red animate-pulse'
          : 'hc-clay-raised border border-hc-teal/20 text-hc-teal hover:bg-hc-teal/5 hover:scale-105 active:scale-95'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${listening ? 'bg-flag-red animate-ping' : 'bg-hc-teal'}`} />
      <span>
        {listening ? 'RECORDING VOICE...' : `${lang?.flag} DICTATE ${lang?.label?.split(' ')[0]}`}
      </span>
    </button>
  );
}

interface NoteType {
  id: string;
  label: string;
  group: 'client' | 'staff' | 'meeting' | 'auto';
  color: string;
  prompts: { key: string; label: string; placeholder: string; required?: boolean }[];
}

const NOTE_TYPES: NoteType[] = [
  {
    id: 'daily_support', label: 'Daily Support Entry', group: 'client', color: '#1c4e4e',
    prompts: [
      { key: 'mood', label: 'How was the person\'s mood and presentation?', placeholder: 'e.g. Appeared calm and engaged, good eye contact, responded well to prompts...', required: true },
      { key: 'activities', label: 'What activities or support was provided?', placeholder: 'e.g. Supported with personal care, attended community group, cooked lunch together...' },
      { key: 'concerns', label: 'Any concerns or observations?', placeholder: 'e.g. Mentioned feeling anxious about upcoming appointment, appeared quieter than usual...' },
      { key: 'followup', label: 'Follow-up actions needed?', placeholder: 'e.g. Monitor mood, remind about Thursday appointment, inform key worker...' },
    ],
  },
  {
    id: 'keyworker_session', label: 'Key Worker Session', group: 'client', color: '#1c4e4e',
    prompts: [
      { key: 'topics', label: 'What topics were discussed in the session?', placeholder: 'e.g. Reviewed support plan goals, discussed community access...' },
      { key: 'feedback', label: 'What feedback did the person provide?', placeholder: 'e.g. Expressed happiness with current activities, requested more swimming sessions...' },
      { key: 'actions', label: 'Agreed actions or next steps?', placeholder: 'e.g. Update support plan, book swimming for next Tuesday...' },
    ],
  },
  {
    id: 'staff_supervision', label: 'Staff Supervision', group: 'staff', color: '#6b5b9e',
    prompts: [
      { key: 'wellbeing', label: 'Staff wellbeing and performance?', placeholder: 'e.g. Expressed confidence in role, discussed recent training completion...' },
      { key: 'concerns', label: 'Any challenges or development needs?', placeholder: 'e.g. Requested more shadow shifts for manual handling...' },
      { key: 'goals', label: 'Agreed development goals?', placeholder: 'e.g. Complete Level 3 Diploma by year end...' },
    ],
  },
];

const HOUSES = [
  'Lingfield House', 'Church House', 'Laurel House', 'Station House',
  'Canterbury', 'Glenfrome House', 'Woburn House', 'Hazelbury House',
  'Courtney Lodge', 'Cottrell House',
];

const GROUPS = [
  { id: 'client', label: 'Service User', color: '#1c4e4e' },
  { id: 'staff', label: 'Personnel', color: '#6b5b9e' },
  { id: 'meeting', label: 'Meetings', color: '#d9974e' },
] as const;

export function StaffNotePage() {
  const [voiceLang, _setVoiceLangState] = useState(_voiceLang);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [selectedType, setSelectedType] = useState<NoteType>(NOTE_TYPES[0]);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [activeGroup, setActiveGroup] = useState<NoteType['group']>('client');
  const [search] = useState('');
  const [house, setHouse] = useState(HOUSES[0]);
  const [client, setClient] = useState('');
  const [mode, setMode] = useState<'guided' | 'free'>('guided');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedNote, setEnhancedNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedNotes, setSavedNotes] = useState<{ id: string; text: string; date: string; type: string; house: string; client?: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('hc-saved-notes') || '[]'); } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);

  const [quickRaw, setQuickRaw] = useState('');
  const [quickResult, setQuickResult] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickCopied, setQuickCopied] = useState(false);

  const handleLangChange = (code: string) => { setVoiceLang(code); _setVoiceLangState(code); setShowLangPicker(false); };
  const setAnswer = (key: string, val: string) => setAnswers(prev => ({ ...prev, [key]: val }));
  const appendToAnswer = (key: string, val: string) => setAnswers(prev => ({ ...prev, [key]: (prev[key] || '') + ' ' + val }));
  const appendToFreeText = (_: string, val: string) => setFreeText(prev => prev + ' ' + val);

  const filteredTypes = NOTE_TYPES.filter(t => (t.group === activeGroup || !!search) && t.label.toLowerCase().includes(search.toLowerCase()));
  const currentLang = VOICE_LANGUAGES.find(l => l.code === voiceLang) || VOICE_LANGUAGES[0];

  const generatedNote = useMemo(() => {
    if (mode === 'guided') {
      return selectedType.prompts
        .map(p => answers[p.key] ? `${p.label.replace('?', '')}: ${answers[p.key]}` : '')
        .filter(Boolean)
        .join('\n\n');
    }
    return freeText;
  }, [mode, selectedType, answers, freeText]);

  const wordCount = generatedNote.split(/\s+/).filter(Boolean).length;

  const enhanceNote = async () => {
    if (!generatedNote.trim()) return;
    setEnhancing(true); setEnhancedNote('');
    try {
      const res = await fetch('/api/staff/enhance-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ text: generatedNote, noteType: selectedType.label, clientName: client }),
      });
      if (!res.ok) throw new Error('Offline');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
        setEnhancedNote(result);
      }
    } catch (e) { console.error(e); }
    finally { setEnhancing(false); }
  };

  const quickFix = async () => {
    if (!quickRaw.trim()) return;
    setQuickLoading(true); setQuickResult('');
    try {
      const res = await fetch('/api/staff/enhance-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ text: quickRaw, noteType: 'Quick Fix', clientName: 'N/A' }),
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
        setQuickResult(result);
      }
    } catch { setQuickResult('FAILED: Clinical engine offline.'); }
    finally { setQuickLoading(false); }
  };

  const saveNote = () => {
    const text = enhancedNote || generatedNote;
    if (!text.trim()) return;
    const newNote = { id: uid(), text, date: new Date().toLocaleString('en-GB'), type: selectedType.label, house, client };
    const updated = [newNote, ...savedNotes].slice(0, 100);
    setSavedNotes(updated);
    localStorage.setItem('hc-saved-notes', JSON.stringify(updated));
    setAnswers({}); setFreeText(''); setEnhancedNote('');
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1700px] mx-auto animate-in fade-in duration-700">
      
      {/* QUICK FIX HEADER */}
      <div className="mb-12 hc-clay-raised overflow-hidden border border-hc-teal/20 shadow-2xl">
        <div className="bg-hc-teal px-8 py-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-hc-bone" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-hc-bone">Intelligence Vector // Quick Standardise</span>
           </div>
           <span className="text-[9px] font-black text-hc-bone/40 uppercase tracking-widest">Forensic Polish Engine</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-hc-border/20 p-2">
          {/* Input */}
          <div className="p-6 space-y-4">
            <textarea
              value={quickRaw}
              onChange={e => setQuickRaw(e.target.value)}
              placeholder="Paste any note here Â· any format Â· good or bad... (e.g. James went to shops, he enjoyed it)"
              className="w-full hc-clay-inset p-5 text-[12px] text-hc-text font-medium leading-relaxed resize-none focus:outline-none min-h-[160px] scrollbar-thin italic"
            />
            <button
              onClick={quickFix}
              disabled={!quickRaw.trim() || quickLoading}
              className="w-full py-4 btn-tactical text-[11px] uppercase tracking-[0.2em] shadow-xl disabled:opacity-40 transition-all flex items-center justify-center gap-3"
            >
              {quickLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Gold Standard
            </button>
          </div>
          {/* Output */}
          <div className="p-6 space-y-4 bg-hc-teal/[0.02]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black tracking-widest uppercase text-hc-muted">Standardised Output</label>
              {quickResult && <span className="text-[10px] font-black text-hc-teal uppercase animate-pulse">Ready</span>}
            </div>
            <textarea
              value={quickResult}
              readOnly
              placeholder="Your polished clinical note will stream here..."
              className="w-full hc-clay-inset p-5 text-[12px] text-hc-text font-black leading-relaxed resize-none focus:outline-none min-h-[160px] scrollbar-thin bg-transparent"
            />
            <button
              onClick={() => { navigator.clipboard.writeText(quickResult); setQuickCopied(true); setTimeout(() => setQuickCopied(false), 2000); }}
              disabled={!quickResult.trim()}
              className={`w-full py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl transition-all ${quickCopied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
            >
              {quickCopied ? 'COPIED TO CLIPBOARD' : 'COPY REWRITTEN NOTE'}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <h1 className="text-2xl md:text-3xl font-black text-hc-text mb-2 tracking-[0.1em] uppercase">Notes Assistant</h1>
        <div className="flex items-center gap-3">
          <span className="pill pill-teal text-[10px] font-black px-4 py-1">Operational Protocol</span>
          <p className="text-hc-muted text-[11px] font-black uppercase tracking-widest">
            Guided prompts + Voice dictation Â· Polished by Intelligence
          </p>
        </div>
      </div>

      {/* LANGUAGE BANNER */}
      {speechSupported ? (
        <button
          onClick={() => setShowLangPicker(!showLangPicker)}
          className="w-full mb-10 flex items-center justify-between hc-clay-raised p-6 hover:bg-hc-teal/5 transition-all group"
        >
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl hc-clay-inset flex items-center justify-center text-2xl shadow-xl">{currentLang.flag}</div>
            <div className="text-left">
              <div className="text-[10px] text-hc-muted font-black uppercase tracking-widest mb-1">Voice Language // Tap to switch</div>
              <div className="text-base font-black text-hc-text uppercase tracking-tight">{currentLang.label}</div>
            </div>
          </div>
          <ChevronRight className={`w-5 h-5 text-hc-muted transition-transform duration-500 ${showLangPicker ? 'rotate-90' : ''}`} />
        </button>
      ) : (
        <div className="mb-10 hc-clay-inset p-6 text-[11px] font-black text-hc-muted uppercase tracking-widest text-center">Voice dictation requires Chrome or Edge browser.</div>
      )}

      {/* Flag grid dropdown */}
      {showLangPicker && (
        <div className="mb-10 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-3 animate-in zoom-in-95 duration-300">
          {VOICE_LANGUAGES.map(l => (
            <button key={l.code} onClick={() => handleLangChange(l.code)}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300 ${voiceLang === l.code ? 'hc-clay-inset text-hc-teal' : 'hc-clay-raised text-hc-muted hover:text-hc-text'}`}>
              <span className="text-2xl">{l.flag}</span>
              <span className="text-[9px] font-black uppercase tracking-widest">{l.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3 space-y-10">
          
          {/* Note type selector */}
          <div className="hc-clay-raised p-8">
            <div className="flex items-center justify-between mb-6">
               <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em]">1. Note Category Selection</span>
               <button onClick={() => setShowCategoryPanel(!showCategoryPanel)} className="text-[9px] font-black text-hc-teal uppercase hover:underline">{showCategoryPanel ? 'Collapse' : 'Change'}</button>
            </div>
            
            {!showCategoryPanel ? (
              <div className="flex items-center gap-4">
                 <div className="w-3 h-3 rounded-full bg-hc-teal shadow-[0_0_10px_#1c4e4e]" />
                 <span className="text-lg font-black text-hc-text uppercase tracking-tight">{selectedType.label}</span>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-2 p-2 hc-clay-inset rounded-2xl overflow-x-auto scrollbar-none">
                  {GROUPS.map(g => (
                    <button key={g.id} onClick={() => setActiveGroup(g.id)}
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeGroup === g.id ? 'bg-hc-teal text-hc-bone shadow-xl' : 'text-hc-muted hover:text-hc-text'}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                  {filteredTypes.map(t => (
                    <button key={t.id} onClick={() => { setSelectedType(t); setShowCategoryPanel(false); }}
                      className={`text-left px-5 py-4 rounded-2xl transition-all ${selectedType.id === t.id ? 'hc-clay-inset text-hc-teal shadow-inner' : 'hc-clay-raised text-hc-text hover:bg-hc-teal/5'}`}>
                      <div className="text-[11px] font-black uppercase tracking-tight">{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="hc-clay-raised p-8">
             <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] mb-8 block">2. Clinical Meta-Data</span>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                   <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Site / House</label>
                   <select value={house} onChange={e => setHouse(e.target.value)} className="w-full hc-clay-inset px-5 py-4 text-[11px] font-black uppercase text-hc-text outline-none shadow-inner bg-transparent">
                      {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                   </select>
                </div>
                <div className="space-y-3">
                   <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Service User</label>
                   <input value={client} onChange={e => setClient(e.target.value)} placeholder="Full name..." className="w-full hc-clay-inset px-5 py-4 text-[11px] font-black uppercase text-hc-text outline-none shadow-inner placeholder:text-hc-muted/30" />
                </div>
             </div>
             <div className="mt-8 flex gap-2 p-1 hc-clay-inset rounded-2xl">
                {(['guided', 'free'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === m ? 'bg-hc-teal text-hc-bone shadow-xl' : 'text-hc-muted hover:text-hc-text'}`}>
                    {m === 'guided' ? 'Guided Interview' : 'Free Intelligence Stream'}
                  </button>
                ))}
             </div>
          </div>

          {/* Input Fields */}
          {mode === 'guided' ? (
            <div className="space-y-8">
              {selectedType.prompts.map((p, i) => (
                <div key={p.key} className="hc-clay-raised p-8 animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                  <label className="flex items-center gap-4 text-[11px] font-black text-hc-text uppercase tracking-widest mb-6">
                    <span className="w-8 h-8 rounded-xl hc-clay-inset flex items-center justify-center text-[10px] font-black text-hc-teal shadow-inner">{i + 1}</span>
                    {p.label}
                  </label>
                  <textarea
                    value={answers[p.key] || ''}
                    onChange={e => setAnswer(p.key, e.target.value)}
                    placeholder={p.placeholder}
                    className="w-full hc-clay-inset p-6 text-[13px] text-hc-text font-medium leading-relaxed resize-none focus:outline-none mb-6 italic"
                    rows={3}
                  />
                  <MicButton fieldKey={p.key} onTranscript={appendToAnswer} />
                </div>
              ))}
            </div>
          ) : (
            <div className="hc-clay-raised p-8">
              <div className="flex items-center justify-between mb-8">
                 <span className="text-[11px] font-black text-hc-text uppercase tracking-widest">Clinical Free Stream</span>
                 <MicButton fieldKey="freetext" onTranscript={appendToFreeText} />
              </div>
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="Type or dictate in any language... Intelligence will translate and polish..."
                className="w-full hc-clay-inset p-8 text-[14px] text-hc-text font-black leading-loose resize-none focus:outline-none italic min-h-[400px]"
              />
            </div>
          )}
        </div>

        {/* Right Preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-10 space-y-8">
            <div className="hc-clay-raised overflow-hidden shadow-2xl border border-hc-teal/10">
              <div className="p-8 bg-hc-teal/[0.03] border-b border-hc-border/10">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-hc-text uppercase tracking-tight">Clinical Preview</h3>
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest tabular-nums">{wordCount} Words Â· Forensic Grade</span>
                 </div>
              </div>

              <div className="p-8 min-h-[350px]">
                {enhancedNote ? (
                  <div className="animate-in slide-in-from-top-4 duration-500">
                    <span className="pill pill-teal text-[10px] font-black px-4 py-1.5 mb-6 shadow-lg inline-block animate-pulse">âœ¦ FORENSIC POLISHED</span>
                    <pre className="text-[13px] text-hc-text font-black leading-relaxed whitespace-pre-wrap italic">"{enhancedNote}"</pre>
                  </div>
                ) : enhancing ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <RefreshCw className="w-12 h-12 text-hc-teal animate-spin mb-6" />
                    <div className="text-[11px] font-black text-hc-teal uppercase tracking-[0.3em]">Refining Clinical Logic...</div>
                  </div>
                ) : generatedNote ? (
                  <pre className="text-[13px] text-hc-text/80 font-black leading-relaxed whitespace-pre-wrap italic animate-in fade-in duration-700">"{generatedNote}"</pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center opacity-30">
                    <FileText className="w-16 h-16 text-hc-muted mb-6" />
                    <div className="text-[11px] font-black uppercase tracking-widest text-hc-text">Clinical preview will appear here...</div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-black/[0.02] flex flex-col gap-4">
                 {generatedNote && !enhancing && !enhancedNote && (
                   <button onClick={enhanceNote} className="w-full py-4 btn-tactical text-[11px] uppercase tracking-[0.3em] shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3">
                      <Sparkles className="w-4 h-4" /> AI Enhance Note
                   </button>
                 )}
                 <div className="flex gap-4">
                   <button onClick={() => { const n = enhancedNote || generatedNote; if(n) { navigator.clipboard.writeText(n); setCopied(true); setTimeout(()=>setCopied(false),2000); } }} disabled={!generatedNote}
                     className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl ${copied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}>
                     {copied ? 'COPIED' : 'COPY TO CLIPBOARD'}
                   </button>
                   <button onClick={saveNote} disabled={!generatedNote} className="px-8 py-4 hc-clay-inset text-[10px] font-black text-hc-muted hover:text-hc-text uppercase tracking-widest transition-all">SAVE ENTRY</button>
                 </div>
              </div>
            </div>

            {savedNotes.length > 0 && (
              <div className="space-y-6">
                <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-3 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] hover:text-hc-teal transition-all">
                  <ChevronRight className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
                  Archive Trail ({savedNotes.length})
                </button>
                {showHistory && (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                    {savedNotes.map(n => (
                      <div key={n.id} className="hc-clay-raised p-5 space-y-3 group hover:bg-hc-teal/5 transition-all">
                        <div className="flex justify-between items-center">
                           <span className="text-[11px] font-black text-hc-text uppercase">{n.type}</span>
                           <span className="text-[9px] font-black text-hc-muted tabular-nums">{n.date}</span>
                        </div>
                        <p className="text-[11px] text-hc-text/60 italic line-clamp-2">"{n.text}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
