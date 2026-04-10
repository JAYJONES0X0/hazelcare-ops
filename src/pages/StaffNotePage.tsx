import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { uid } from '../lib/storage';

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
// VOICE-TO-NOTE — Web Speech API
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

// eslint-disable-next-line react-refresh/only-export-components
export const VOICE_LANGUAGES = [
  // English
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  // South Asia
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)', flag: '🇧🇩' },
  { code: 'ne-NP', label: 'नेपाली (Nepali)', flag: '🇳🇵' },
  { code: 'si-LK', label: 'සිංහල (Sinhala)', flag: '🇱🇰' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', flag: '🇱🇰' },
  { code: 'ur-PK', label: 'اردو (Urdu)', flag: '🇵🇰' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)', flag: '🇮🇳' },
  { code: 'pa-Guru-IN', label: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)', flag: '🇮🇳' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', flag: '🇮🇳' },
  // South-East & East Asia
  { code: 'fil-PH', label: 'Filipino / Tagalog', flag: '🇵🇭' },
  { code: 'zh-CN', label: '普通话 (Mandarin)', flag: '🇨🇳' },
  { code: 'zh-HK', label: '廣東話 (Cantonese)', flag: '🇭🇰' },
  { code: 'vi-VN', label: 'Tiếng Việt', flag: '🇻🇳' },
  // Africa
  { code: 'sw-KE', label: 'Kiswahili', flag: '🇰🇪' },
  { code: 'yo-NG', label: 'Yorùbá', flag: '🇳🇬' },
  { code: 'ig-NG', label: 'Igbo', flag: '🇳🇬' },
  { code: 'am-ET', label: 'አማርኛ (Amharic)', flag: '🇪🇹' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  // Europe
  { code: 'pl-PL', label: 'Polski', flag: '🇵🇱' },
  { code: 'ro-RO', label: 'Română', flag: '🇷🇴' },
  { code: 'pt-PT', label: 'Português', flag: '🇵🇹' },
  { code: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'lt-LT', label: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv-LV', label: 'Latviešu', flag: '🇱🇻' },
  { code: 'sk-SK', label: 'Slovenčina', flag: '🇸🇰' },
];

// Global lang so all MicButtons share the same setting
let _voiceLang = 'en-GB';
// eslint-disable-next-line react-refresh/only-export-components
export function setVoiceLang(lang: string) { _voiceLang = lang; }
// eslint-disable-next-line react-refresh/only-export-components
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
    const recognition = new SpeechRecognitionAPI();
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
      className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-500 select-none shadow-xl
        ${listening
          ? 'bg-red-500/20 border-2 border-red-500 text-red-400 glow-red animate-pulse'
          : 'glass-light border border-hc-border text-hc-teal-light hover:border-hc-teal hover:text-hc-text hover:bg-hc-teal/5 hover:scale-105 active:scale-95'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${listening ? 'bg-red-500 animate-ping' : 'bg-hc-teal'}`} />
      <span className="text-[10px]">
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
  // ── CLIENT NOTES ───────────────────────────────────────────
  {
    id: 'daily_support', label: 'Daily Support Entry', group: 'client', color: '#14b8a6',
    prompts: [
      { key: 'mood', label: 'How was the person\'s mood and presentation?', placeholder: 'e.g. Appeared calm and engaged, good eye contact, responded well to prompts...', required: true },
      { key: 'activities', label: 'What activities or support was provided?', placeholder: 'e.g. Supported with personal care, attended community group, cooked lunch together...' },
      { key: 'concerns', label: 'Any concerns or observations?', placeholder: 'e.g. Mentioned feeling anxious about upcoming appointment, appeared quieter than usual...' },
      { key: 'followup', label: 'Follow-up actions needed?', placeholder: 'e.g. Monitor mood, remind about Thursday appointment, inform key worker...' },
    ],
  },
  {
    id: 'keyworker_session', label: 'Key Worker Session', group: 'client', color: '#0f766e',
    prompts: [
      { key: 'topics', label: 'What topics were discussed in the session?', placeholder: 'e.g. Reviewed support plan goals, discussed community access, talked through recent concerns...', required: true },
      { key: 'client_views', label: 'What were the person\'s views and wishes?', placeholder: 'e.g. Expressed desire to go to college, happy with current support...' },
      { key: 'progress', label: 'Progress against support plan goals?', placeholder: 'e.g. Making good progress with independence. Has started cooking 2 meals per week independently...' },
      { key: 'risks', label: 'Any risks or safeguarding matters?', placeholder: 'e.g. No new concerns. Previous concern regarding finances resolved...' },
      { key: 'actions', label: 'Agreed actions before next session?', placeholder: 'e.g. Person to try bus journey independently. Review funding application next week...' },
      { key: 'next', label: 'Next key worker session date?', placeholder: 'e.g. 4 weeks — 14/04/2026' },
    ],
  },
  {
    id: 'care_review', label: 'Care & Support Review', group: 'client', color: '#0f766e',
    prompts: [
      { key: 'attendees', label: 'Who attended the review?', placeholder: 'e.g. Client, key worker, social worker, family member, house coordinator...', required: true },
      { key: 'current_plan', label: 'How is the current support plan working?', placeholder: 'e.g. Plan is broadly working well. Achieving most goals. Medication support still required...' },
      { key: 'client_views', label: 'Person\'s views on their care?', placeholder: 'e.g. Happy with support staff. Would like more community access. Finds morning routine rushed...' },
      { key: 'changes', label: 'Changes to support plan agreed?', placeholder: 'e.g. Increase community access to 3x per week. Reduce prompting for personal care...' },
      { key: 'risks', label: 'Risk assessment updates?', placeholder: 'e.g. Risk around finances to be updated. PBS to be reviewed following recent incidents...' },
      { key: 'next_review', label: 'Next review date?', placeholder: 'e.g. 6 months — September 2026' },
    ],
  },
  {
    id: 'handover', label: 'Shift Handover', group: 'client', color: '#3b82f6',
    prompts: [
      { key: 'events', label: 'Key events this shift?', placeholder: 'e.g. Quiet shift overall. Person A attended day centre, Person B had GP appointment...', required: true },
      { key: 'clients', label: 'Client updates?', placeholder: 'e.g. Person B refused dinner, offered alternative and accepted. Person C had positive mood all day...' },
      { key: 'outstanding', label: 'Outstanding tasks for next shift?', placeholder: 'e.g. Medication round at 20:00, laundry needs completing, entry to be submitted...' },
      { key: 'nextshift', label: 'Anything critical for incoming staff?', placeholder: 'e.g. GP calling back about Person A tomorrow morning. Night check required for Person C...' },
    ],
  },
  {
    id: 'abc_chart', label: 'ABC Chart (Behavior)', group: 'client', color: '#ef4444',
    prompts: [
      { key: 'antecedent', label: 'What happened before the behavior?', placeholder: 'e.g. Staff asked to turn off TV at 21:00. Person had not eaten dinner. Loud noise from outside...', required: true },
      { key: 'behaviour', label: 'Behavior — What did the person do?', placeholder: 'e.g. Shouted at staff, threw remote control, paced around room for 10 minutes...', required: true },
      { key: 'consequence', label: 'What happened as a result?', placeholder: 'e.g. Staff used low arousal approach. Person de-escalated after 15 minutes. Offered alternative activity...' },
      { key: 'intensity', label: 'Intensity and duration?', placeholder: 'e.g. High intensity — lasted approximately 15 minutes before de-escalating' },
      { key: 'action', label: 'Actions taken and by whom?', placeholder: 'e.g. PBS strategies followed. Redirected to preferred activity. Key worker notified...' },
    ],
  },
  {
    id: 'incident', label: 'Accident / Incident', group: 'client', color: '#dc2626',
    prompts: [
      { key: 'what', label: 'What happened?', placeholder: 'e.g. Person fell in bathroom while getting out of shower...', required: true },
      { key: 'when', label: 'When did it happen (date/time)?', placeholder: 'e.g. 12/03/2026 at approximately 06:30' },
      { key: 'who', label: 'Who was involved?', placeholder: 'e.g. Person: [Name]. Staff present: Sarah Mitchell...' },
      { key: 'injuries', label: 'Any injuries?', placeholder: 'e.g. Small bruise on left forearm. No head injury. Person alert and oriented.' },
      { key: 'action', label: 'What action was taken?', placeholder: 'e.g. First aid administered. Ice pack applied. GP notified by phone...' },
      { key: 'notified', label: 'Who was notified?', placeholder: 'e.g. House coordinator, on-call manager, GP surgery, family (NOK)...' },
    ],
  },
  {
    id: 'safeguarding', label: 'Safeguarding Record', group: 'client', color: '#be185d',
    prompts: [
      { key: 'concern', label: 'What is the safeguarding concern?', placeholder: 'e.g. Person disclosed that another resident made threatening comments...', required: true },
      { key: 'who', label: 'Who is involved?', placeholder: 'e.g. Alleged victim: Robert Ellis. Alleged perpetrator: unnamed resident...' },
      { key: 'disclosure', label: 'How was it disclosed/discovered?', placeholder: 'e.g. Person told staff member during 1:1 session...' },
      { key: 'action', label: 'Immediate actions taken?', placeholder: 'e.g. Ensured person\'s safety. Statements taken. Manager notified...' },
      { key: 'referral', label: 'Referrals made?', placeholder: 'e.g. Local authority safeguarding team contacted. Reference number pending...' },
    ],
  },
  {
    id: 'gp_appointment', label: 'GP Appointment', group: 'client', color: '#0891b2',
    prompts: [
      { key: 'client', label: 'Person and reason for appointment?', placeholder: 'e.g. [Name] — review of Risperidone dosage and annual health check', required: true },
      { key: 'outcome', label: 'What was the outcome?', placeholder: 'e.g. Medication adjusted. Blood test requested. Follow-up in 4 weeks...' },
      { key: 'actions', label: 'Follow-up actions required?', placeholder: 'e.g. Collect new prescription from pharmacy. Book blood test. Update MAR chart...' },
      { key: 'notified', label: 'Who was notified?', placeholder: 'e.g. Key worker informed. Family updated. Manager copy of letter filed...' },
    ],
  },
  {
    id: 'medication', label: 'Medication Entry', group: 'client', color: '#0891b2',
    prompts: [
      { key: 'what', label: 'Which medication and person?', placeholder: 'e.g. Olanzapine 10mg — [Name]', required: true },
      { key: 'status', label: 'Was it administered, refused, or missed?', placeholder: 'e.g. Refused at 08:00, attempted again at 09:30...' },
      { key: 'reason', label: 'Reason if refused/missed?', placeholder: 'e.g. Said they didn\'t want it, appeared drowsy...' },
      { key: 'action', label: 'Action taken?', placeholder: 'e.g. GP informed by phone. Will attempt at lunchtime. MAR chart updated.' },
    ],
  },
  {
    id: 'finance_transaction', label: 'Financial Transaction', group: 'client', color: '#059669',
    prompts: [
      { key: 'client', label: 'Person and transaction details?', placeholder: 'e.g. [Name] — weekly spending money £30 withdrawn from Halifax', required: true },
      { key: 'purpose', label: 'Purpose of transaction?', placeholder: 'e.g. Food shop, clothing, leisure activity, personal purchase...' },
      { key: 'amount', label: 'Amount and balance?', placeholder: 'e.g. £30 withdrawn. Balance remaining: £145.23. Receipts obtained.' },
      { key: 'witnessed', label: 'Witnessed by?', placeholder: 'e.g. Witnessed by Sarah Mitchell. Person signed transaction record...' },
    ],
  },

  // ── STAFF / TEAM NOTES ────────────────────────────────────
  {
    id: 'supervision', label: 'Staff Supervision', group: 'staff', color: '#7c3aed',
    prompts: [
      { key: 'staff', label: 'Staff member supervised?', placeholder: 'e.g. Amy Rogers — Support Worker, Cottrell House', required: true },
      { key: 'discussed', label: 'Topics discussed?', placeholder: 'e.g. Workload manageable. Discussed de-escalation training needs. Raised concerns about rota...' },
      { key: 'development', label: 'Development and training needs?', placeholder: 'e.g. Refresher on medication administration. First aid renewal due June 2026...' },
      { key: 'actions', label: 'Actions agreed?', placeholder: 'e.g. Book onto conflict management course. Shadow senior for medication round next week...' },
      { key: 'next', label: 'Next supervision date?', placeholder: 'e.g. 4 weeks — 09/04/2026' },
    ],
  },
  {
    id: 'quality_meeting', label: 'Quality & Performance Meeting', group: 'meeting', color: '#0f766e',
    prompts: [
      { key: 'attendees', label: 'Who attended?', placeholder: 'e.g. House coordinator, manager, senior support workers...', required: true },
      { key: 'flags', label: 'Flags raised this week?', placeholder: 'e.g. 1 red flag — fall on Tuesday. 3 amber flags — concerns, lateness, medication...' },
      { key: 'house_updates', label: 'House updates?', placeholder: 'e.g. Cottrell: quiet week. Hazelbury: concern ongoing. Lingfield: CPN visit completed...' },
      { key: 'actions', label: 'Actions agreed?', placeholder: 'e.g. GP referral for Person B by Friday. Training refresher booked for Amy. CCTV to be fixed...' },
    ],
  },
  {
    id: 'task_note', label: 'General Task Note', group: 'staff', color: '#f59e0b',
    prompts: [
      { key: 'task', label: 'What task was completed?', placeholder: 'e.g. Weekly food shop, maintenance request, cleaning, admin task...', required: true },
      { key: 'details', label: 'Details?', placeholder: 'e.g. All items on menu plan purchased. Budget: £85.20. Receipts filed...' },
      { key: 'followup', label: 'Any follow-up needed?', placeholder: 'e.g. Need to order special dietary items for Person C by Thursday...' },
    ],
  },
];

const GROUPS = [
  { id: 'client', label: 'People We Support', color: '#0f766e' },
  { id: 'staff', label: 'Staff Information', color: '#7c3aed' },
  { id: 'meeting', label: 'Team Briefings', color: '#1e40af' },
] as const;

// ============================================================
// FLAG DETECTION
// ============================================================
const RED_KW = ['refused medication','medication refused','safeguarding','self-neglect','self neglect','self-harm','self harm','police','ambulance','hospital','a&e','assault','struck','hit','attacked','threatened','missing','absconded','fire','death','deceased','injury','fall','collapsed','seizure'];
const AMBER_KW = ['hearing voices','talked to himself','talking to herself','escalated','escalation','agitated','aggressive','anxious','property damage','damaged','broke','complaint','complained','concern','concerns raised','not sleeping','refused food','refused to eat','medication discrepancy','late','lateness','did not attend','no show','soiling','infection control'];

function detectFlags(text: string): { severity: 'red' | 'amber' | 'none'; flags: string[] } {
  const lower = text.toLowerCase();
  const redHits = RED_KW.filter(kw => lower.includes(kw));
  if (redHits.length > 0) return { severity: 'red', flags: redHits };
  const amberHits = AMBER_KW.filter(kw => lower.includes(kw));
  if (amberHits.length > 0) return { severity: 'amber', flags: amberHits };
  return { severity: 'none', flags: [] };
}

// ============================================================
// SAVED NOTES
// ============================================================
interface SavedNote { id: string; type: string; house: string; client: string; text: string; date: string; }
const NOTES_KEY = 'hazelcare-staff-notes';
function loadNotes(): SavedNote[] { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { return []; } }
function saveNotes(n: SavedNote[]) { localStorage.setItem(NOTES_KEY, JSON.stringify(n)); }

const HOUSES = ['Lingfield House','Church House','Laurel House','Station House','Canterbury','Glenfrome House','Woburn House','Hazelbury House','Courtney Lodge','Cottrell House'];

// ============================================================
// COMPONENT
// ============================================================
export function StaffNotePage() {
  const [selectedType, setSelectedType] = useState<NoteType>(NOTE_TYPES[0]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState('');
  const [mode, setMode] = useState<'guided' | 'free'>('guided');
  const [house, setHouse] = useState(HOUSES[0]);
  const [client, setClient] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(loadNotes);
  const [showHistory, setShowHistory] = useState(false);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedNote, setEnhancedNote] = useState('');
  const [enhanceError, setEnhanceError] = useState('');
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('client');

  // ── QUICK FIX mode ────────────────────────────────────────────────
  const [quickRaw, setQuickRaw] = useState('');
  const [quickResult, setQuickResult] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickCopied, setQuickCopied] = useState(false);

  async function quickFix() {
    if (!quickRaw.trim() || quickLoading) return;
    setQuickResult('');
    setQuickLoading(true);
    try {
      const res = await fetch('/api/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: quickRaw.trim(), noteType: '1:1 Support' }),
      });
      if (!res.ok || !res.body) throw new Error('Failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setQuickResult(text);
      }
    } catch {
      setQuickResult('Could not reach the AI. Make sure you are logged in.');
    } finally {
      setQuickLoading(false);
    }
  }

  useEffect(() => { setAnswers({}); }, [selectedType.id]);

  const filteredTypes = useMemo(() => {
    const group = NOTE_TYPES.filter(t => t.group === activeGroup);
    if (!search.trim()) return group;
    return NOTE_TYPES.filter(t => t.label.toLowerCase().includes(search.toLowerCase()));
  }, [activeGroup, search]);

  function setAnswer(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  const appendToAnswer = useCallback((key: string, transcript: string) => {
    setAnswers(prev => {
      const existing = prev[key] || '';
      const separator = existing && !existing.endsWith(' ') ? ' ' : '';
      return { ...prev, [key]: existing + separator + transcript };
    });
  }, []);

  const appendToFreeText = useCallback((_key: string, transcript: string) => {
    setFreeText(prev => {
      const separator = prev && !prev.endsWith(' ') ? ' ' : '';
      return prev + separator + transcript;
    });
  }, []);

  function generateNote(): string {
    if (mode === 'free') return freeText;
    const now = new Date();
    const parts: string[] = [];
    parts.push(`${selectedType.label} — ${house}`);
    if (client) parts.push(`Person: ${client}`);
    parts.push(`Date: ${now.toLocaleDateString('en-GB')} at ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
    parts.push('');
    for (const prompt of selectedType.prompts) {
      const answer = answers[prompt.key]?.trim();
      if (!answer) continue;
      let text = answer.charAt(0).toUpperCase() + answer.slice(1);
      if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) text += '.';
      parts.push(text);
    }
    if (parts.length <= 3) return '';
    return parts.join('\n');
  }

  const generatedNote = generateNote();
  const allText = mode === 'guided' ? Object.values(answers).join(' ') : freeText;
  const flagResult = detectFlags(allText);
  const wordCount = generatedNote.trim() ? generatedNote.trim().split(/\s+/).length : 0;

  function saveNote() {
    const noteToSave = enhancedNote || generatedNote;
    if (!noteToSave) return;
    const note: SavedNote = { id: uid(), type: selectedType.label, house, client, text: noteToSave, date: new Date().toLocaleDateString('en-GB') };
    const updated = [note, ...savedNotes].slice(0, 100);
    setSavedNotes(updated);
    saveNotes(updated);
    setAnswers({});
    setFreeText('');
    setClient('');
    setEnhancedNote('');
  }

  async function enhanceNote() {
    const source = generatedNote.trim();
    if (!source || enhancing) return;
    setEnhancing(true);
    setEnhancedNote('');
    setEnhanceError('');
    try {
      const res = await fetch('/api/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: source, noteType: selectedType.label, clientName: client }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Enhancement failed');
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setEnhancedNote(result);
      }
    } catch {
      setEnhanceError('AI enhancement unavailable — note unchanged');
    } finally {
      setEnhancing(false);
    }
  }

  const [voiceLang, setVoiceLangState] = useState(_voiceLang);
  const [showLangPicker, setShowLangPicker] = useState(false);
  function handleLangChange(code: string) {
    setVoiceLang(code);
    setVoiceLangState(code);
    setShowLangPicker(false);
  }
  const currentLang = VOICE_LANGUAGES.find(l => l.code === voiceLang) ?? VOICE_LANGUAGES[0];

  return (
    <div className="p-6 lg:p-10 max-w-[1700px] mx-auto animate-in fade-in duration-700">

      {/* ── QUICK FIX PANEL ─────────────────────────────────── */}
      <div className="mb-8 rounded-2xl p-5" style={{background:'#f8f6ff',backdropFilter:'blur(48px) saturate(2.2) brightness(1.05)',WebkitBackdropFilter:'blur(48px) saturate(2.2) brightness(1.05)',border:'1px solid rgba(139,92,246,0.2)',boxShadow:'0 8px 40px rgba(0,0,0,0.45),0 0 0 1px rgba(139,92,246,0.05),inset 0 1px 0 rgba(255,255,255,0.10)'}}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 rounded-full" style={{background:'#8b5cf6',boxShadow:'0 0 12px rgba(139,92,246,0.7)'}} />
          <span className="text-[10px] font-black tracking-[0.25em] uppercase text-hc-text">Quick Fix</span>
          <span className="text-[10px] text-hc-muted opacity-50 uppercase tracking-wide">Paste any note → get Gold Standard instantly</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Input */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black tracking-widest uppercase text-hc-muted">Original note (paste here)</label>
            <textarea
              value={quickRaw}
              onChange={e => setQuickRaw(e.target.value)}
              placeholder={"Paste the staff note here — any language, any format, good or bad.\n\nExamples:\n• \"Staff supported James with personal care. He refused at first.\"\n• \"Good morning handover completed.\"\n• Third-person notes, brief notes, notes in another language — all fine."}
              className="w-full text-sm text-hc-muted leading-relaxed resize-none focus:outline-none scrollbar-thin"
              style={{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'14px',minHeight:'160px',color:'#c8d4e0'}}
            />
            <button
              type="button"
              onClick={quickFix}
              disabled={!quickRaw.trim() || quickLoading}
              className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-30 cursor-pointer"
              style={{background:'linear-gradient(135deg,#7c3aed,#8b5cf6)',boxShadow:'0 4px 24px rgba(139,92,246,0.4)',color:'white'}}
            >
              {quickLoading ? 'Generating Gold Standard…' : '✦ Generate Gold Standard'}
            </button>
          </div>
          {/* Output */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black tracking-widest uppercase text-hc-muted">Gold Standard rewrite</label>
              {quickResult && !quickLoading && <span className="text-[10px] font-bold text-flag-green uppercase tracking-wide">Ready</span>}
            </div>
            <textarea
              value={quickResult}
              onChange={e => setQuickResult(e.target.value)}
              readOnly={quickLoading}
              placeholder={quickLoading ? 'Writing your Gold Standard note…' : 'The rewritten first-person note will appear here as it streams.'}
              className="flex-1 w-full text-sm leading-relaxed resize-none focus:outline-none scrollbar-thin"
              style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'12px',padding:'14px',minHeight:'160px',color:quickLoading ? '#6b7d94' : '#e2eaf2'}}
            />
            <button
              type="button"
              disabled={!quickResult.trim() || quickLoading}
              onClick={() => { if (!quickResult.trim()) return; void navigator.clipboard.writeText(quickResult); setQuickCopied(true); setTimeout(() => setQuickCopied(false), 2500); }}
              className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-30 cursor-pointer"
              style={{background: quickCopied ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#0f766e,#14b8a6)',boxShadow: quickCopied ? '0 4px 24px rgba(34,197,94,0.4)' : '0 4px 24px rgba(20,184,166,0.35)',color:'white'}}
            >
              {quickCopied ? '✓ Copied to clipboard' : 'Copy rewritten note'}
            </button>
          </div>
        </div>
      </div>

      {/* ── PAGE HEADER ───────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-hc-text mb-1 tracking-tighter text-shimmer">Notes Assistant</h1>
            <div className="flex items-center gap-3">
              <span className="pill pill-teal text-xs font-black uppercase tracking-[0.08em] shadow-lg">Daily Notes Log</span>
              <p className="text-hc-muted text-sm font-semibold uppercase tracking-[0.08em] ml-1">
                Guided prompts + voice dictation in any language
              </p>
            </div>
          </div>
        </div>

        {/* ── LANGUAGE BANNER ─────────────────────────────────── */}
        {speechSupported ? (
          <div className="relative animate-in slide-in-from-top-4 duration-700">
            <button
              type="button"
              onClick={() => setShowLangPicker(v => !v)}
              className="w-full flex items-center gap-3 md:gap-4 glass border-2 border-hc-teal/30 rounded-xl md:rounded-2xl px-4 py-3 hover:bg-hc-teal/5 transition-all group shadow-xl relative overflow-hidden active:scale-[0.99]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-hc-teal/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl glass border border-hc-border flex items-center justify-center text-xl md:text-2xl shrink-0 group-hover:scale-110 transition-transform duration-500 shadow-xl">
                {currentLang.flag}
              </div>
              <div className="flex-1 text-left relative z-10">
                <div className="text-xs text-hc-teal-light uppercase tracking-[0.08em] font-black mb-1">Voice Language — Tap to switch</div>
                <div className="text-sm md:text-base font-black text-hc-text tracking-tight group-hover:text-hc-teal-light transition-colors">{currentLang.label}</div>
              </div>
              <div className="text-hc-muted text-right hidden md:block relative z-10 pr-4">
                <div className="text-[10px] font-black text-hc-teal-light uppercase tracking-widest mb-1">Multi-Language Support</div>
                <div className="text-xs font-medium opacity-60 italic">Speak or dictate in any language — AI translates and polishes</div>
              </div>
              <div className={`w-8 h-8 rounded-xl glass border border-hc-border flex items-center justify-center shrink-0 transition-transform duration-500 ${showLangPicker ? 'rotate-180 bg-hc-teal/10 border-hc-teal/30' : 'group-hover:bg-white/5'}`}>
                <svg className="w-4 h-4 text-hc-muted group-hover:text-hc-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </button>

            {/* Flag grid dropdown */}
            {showLangPicker && (
              <div className="absolute top-full left-0 right-0 mt-4 glass border border-hc-border rounded-[2rem] p-6 z-50 shadow-2xl animate-in zoom-in-95 duration-300 backdrop-blur-3xl">
                <div className="section-header text-xs mb-6 ml-2 opacity-90 tracking-[0.08em]">Select Language</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {VOICE_LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => handleLangChange(l.code)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-500 group/lang active:scale-90 ${
                        voiceLang === l.code
                          ? 'border-hc-teal bg-hc-teal/20 text-hc-text shadow-lg shadow-hc-teal/10 scale-105'
                          : 'border-hc-border glass-light text-hc-muted hover:border-hc-teal/40 hover:bg-white/5 hover:text-hc-text'
                      }`}
                    >
                      <span className="text-2xl leading-none transition-transform group-hover/lang:scale-125 duration-500">{l.flag}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight">{l.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4 glass-light border border-hc-border rounded-[1.5rem] px-6 py-4 text-sm text-hc-muted shadow-xl">
            <svg className="w-6 h-6 text-hc-teal-light shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-medium opacity-80 uppercase tracking-widest text-xs leading-relaxed">For voice-to-text in any language, please open this page in Chrome or Edge browser.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        {/* Left — Input (3/5) */}
        <div className="lg:col-span-3 space-y-6">

          {/* Note type selector */}
          <div className="glass-light border border-hc-border rounded-xl lg:rounded-2xl p-4 lg:p-5 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => setShowCategoryPanel((v) => !v)}
              className="w-full flex items-center justify-between section-header text-xs mb-2 ml-1 opacity-90 tracking-[0.08em] hover:text-hc-text transition-all"
              title="Choose note category and prompt profile"
            >
              <span>Note Category</span>
              <span className="text-hc-muted">{showCategoryPanel ? 'Hide' : 'Show'}</span>
            </button>
            <p className="text-xs text-hc-muted/80 mb-4">Selected: <span className="text-hc-text font-semibold">{selectedType.label}</span></p>
            {showCategoryPanel && (
              <>

            {/* Search + group tabs */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative group flex-1">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search entry types..."
                  className="w-full bg-white border border-hc-border rounded-2xl pl-12 pr-6 py-3.5 text-sm text-hc-text placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
                  <svg className="w-5 h-5 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>
              {!search && (
                <div className="flex gap-2 p-1 bg-black/5 rounded-2xl border border-hc-border">
                  {GROUPS.map(g => (
                    <button key={g.id} onClick={() => setActiveGroup(g.id)}
                      className={`text-[10px] px-5 py-2 rounded-xl font-black uppercase tracking-widest transition-all duration-500 active:scale-95 ${activeGroup === g.id ? 'shadow-lg bg-hc-teal/10 scale-105' : 'text-hc-muted hover:text-hc-text hover:bg-white/5'}`}
                      style={activeGroup === g.id ? { color: g.color, background: `${g.color}15`, border: `1px solid ${g.color}30` } : {}}>
                      {g.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type buttons */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
              {filteredTypes.map(type => (
                <button key={type.id} onClick={() => { setSelectedType(type); setSearch(''); if (!search) setActiveGroup(type.group); }}
                  className={`text-left px-4 py-3 rounded-xl border text-[11px] font-black uppercase tracking-tight transition-all duration-500 group/type relative overflow-hidden active:scale-95
                    ${selectedType.id === type.id ? 'shadow-2xl scale-[1.03] z-10 border-hc-teal/40' : 'border-hc-border glass-light text-hc-muted hover:text-hc-text hover:border-white/20'}`}
                  style={selectedType.id === type.id ? { color: type.color, background: `${type.color}15` } : {}}>
                  <div className="absolute top-0 right-0 w-12 h-12 rounded-full opacity-[0.03] blur-xl group-hover/type:opacity-[0.1] transition-opacity" style={{ background: type.color }} />
                  <span className="relative z-10 group-hover/type:translate-x-1 transition-transform duration-500 block">{type.label}</span>
                </button>
              ))}
            </div>

            {/* Selected type indicator */}
            <div className="mt-6 pt-4 border-t border-hc-border flex items-center gap-3">
              <div className="w-2 h-2 rounded-full animate-pulse shadow-lg" style={{ background: selectedType.color, boxShadow: `0 0 10px ${selectedType.color}` }} />
              <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em]">Selected: <span className="text-hc-text ml-1">{selectedType.label}</span></span>
            </div>
              </>
            )}
          </div>

          {/* Meta row */}
          <div className="glass-light border border-hc-border rounded-[2rem] p-6 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="group">
                <label className="section-header text-[9px] mb-2 ml-1 block opacity-60 tracking-[0.2em]">House</label>
                <select value={house} onChange={e => setHouse(e.target.value)} className="w-full bg-hc-dark/80 border border-hc-border rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-hc-text focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark">
                  {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="group">
                <label className="section-header text-[9px] mb-2 ml-1 block opacity-60 tracking-[0.2em]">Person</label>
                <input value={client} onChange={e => setClient(e.target.value)} placeholder="Full name" className="w-full bg-hc-dark/80 border border-hc-border rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-hc-text placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark" />
              </div>
              <div>
                <label className="section-header text-[9px] mb-2 ml-1 block opacity-60 tracking-[0.2em]">Input Mode</label>
                <div className="flex gap-2 p-1 bg-black/5 rounded-xl border border-hc-border">
                  {(['guided', 'free'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)} className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all duration-500 active:scale-95 ${mode === m ? 'bg-hc-teal/20 text-hc-teal-light border border-hc-teal/20 shadow-lg scale-105' : 'text-hc-muted hover:text-hc-text hover:bg-white/5'}`}>
                      {m === 'guided' ? 'Guided' : 'Free Text'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Guided prompts or free text */}
          {mode === 'guided' ? (
            <div className="space-y-4">
              {selectedType.prompts.map((prompt, i) => (
                <div key={prompt.key} className="glass-light border border-hc-border rounded-[2rem] p-6 focus-within:border-hc-teal/30 transition-all card-glow group animate-in slide-in-from-left-4 active:scale-[0.99]" style={{ animationDelay: `${i * 100}ms` }}>
                  <label className="flex items-center gap-3 text-[11px] font-black text-hc-text uppercase tracking-wider mb-4 transition-transform group-focus-within:translate-x-1">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 shadow-lg" style={{ background: `${selectedType.color}20`, color: selectedType.color, border: `1px solid ${selectedType.color}40` }}>{i + 1}</span>
                    {prompt.label}
                    {prompt.required && <span className="text-flag-red text-xs animate-pulse">*</span>}
                  </label>
                  <textarea
                    value={answers[prompt.key] || ''}
                    onChange={e => setAnswer(prompt.key, e.target.value)}
                    placeholder={prompt.placeholder}
                    className="w-full bg-white border border-hc-border rounded-2xl p-5 text-sm text-hc-text placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark resize-none leading-relaxed mb-4 font-medium"
                    rows={2}
                  />
                  <MicButton fieldKey={prompt.key} onTranscript={appendToAnswer} />
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-light border border-hc-border rounded-[2.5rem] p-8 card-glow group">
              <div className="flex items-center justify-between mb-6">
                <label className="text-sm font-black text-hc-text uppercase tracking-tighter group-focus-within:text-hc-teal-light transition-colors">Free Text Entry</label>
                <MicButton fieldKey="freetext" onTranscript={appendToFreeText} />
              </div>
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="Type or dictate in any language — HazelCare will translate and polish your note into professional English..."
                className="w-full bg-white border border-hc-border rounded-3xl p-8 text-base text-hc-text placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark resize-y leading-loose font-medium italic min-h-[300px]"
              />
            </div>
          )}

          {/* Flag warning */}
          {flagResult.severity !== 'none' && (
            <div className={`flex items-start gap-6 p-8 rounded-[2rem] border-2 shadow-2xl animate-in shake duration-500
              ${flagResult.severity === 'red' ? 'bg-flag-red/[0.03] border-flag-red/30 glow-red' : 'bg-flag-amber/[0.02] border-flag-amber/30 glow-amber'}`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg
                ${flagResult.severity === 'red' ? 'bg-flag-red/10 border border-flag-red/30 text-flag-red' : 'bg-flag-amber/10 border border-flag-amber/30 text-flag-amber'}`}>
                <svg className={`w-8 h-8 ${flagResult.severity === 'red' ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <div>
                <div className="text-xl font-black text-hc-text tracking-tighter uppercase mb-1">{flagResult.severity === 'red' ? 'Red Flag Alert' : 'Amber Monitor Alert'}</div>
                <p className="text-sm font-medium text-hc-muted mb-4 opacity-80 leading-relaxed">{flagResult.severity === 'red' ? 'This entry contains critical concerns requiring immediate manager escalation.' : 'Concerns detected — monitoring recommended for this person.'}</p>
                <div className="flex flex-wrap gap-2">
                  {flagResult.flags.map((f, i) => (
                    <span key={i} className={`pill text-[9px] font-black uppercase tracking-widest px-3
                      ${flagResult.severity === 'red' ? 'pill-red shadow-lg shadow-flag-red/20' : 'pill-amber shadow-lg shadow-flag-amber/20'}`}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — Preview (2/5) */}
        <div className="lg:col-span-2">
          <div className="sticky top-10 space-y-6">
            <div className="glass border border-hc-border rounded-[2.5rem] overflow-hidden shadow-2xl relative group/preview">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-teal/5 blur-[80px] -translate-y-1/2 translate-x-1/2 transition-opacity group-hover/preview:opacity-100" />
              <div className="p-8 border-b border-hc-border bg-black/5 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="transition-transform duration-500 group-hover/preview:translate-x-1">
                    <h3 className="text-lg font-black text-hc-text tracking-tighter uppercase text-shimmer">Preview</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
                      <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest tabular-nums">{wordCount} Words · ~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>
                    </div>
                  </div>
                  {flagResult.severity !== 'none' && (
                    <span className={`pill text-[10px] font-black uppercase tracking-[0.2em] px-4 shadow-xl active:scale-95 cursor-default transition-all
                      ${flagResult.severity === 'red' ? 'pill-red animate-pulse-soft' : 'pill-amber'}`}>
                      {flagResult.severity}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-8 min-h-[300px] relative z-10">
                {enhancedNote ? (
                  <div className="animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 mb-6">
                      <span className="pill pill-teal text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 shadow-lg glow-teal animate-shimmer">✦ AI POLISHED</span>
                      <button onClick={() => setEnhancedNote('')} className="text-[9px] font-black text-hc-muted hover:text-hc-text uppercase tracking-[0.2em] transition-all ml-auto">Reset</button>
                    </div>
                    <pre className="text-sm text-hc-text font-mono leading-loose whitespace-pre-wrap italic group-hover/preview:text-hc-text transition-colors duration-700">"{enhancedNote}{enhancing && <span className="inline-block w-2 h-4 bg-hc-teal-light ml-1 animate-pulse align-middle shadow-[0_0_10px_#14b8a6]" />}"</pre>
                  </div>
                ) : enhancing ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="flex gap-1.5 mb-6">
                      <span className="w-2.5 h-2.5 rounded-full bg-hc-teal animate-bounce shadow-lg" style={{ animationDelay: '0ms' }} />
                      <span className="w-2.5 h-2.5 rounded-full bg-hc-teal animate-bounce shadow-lg" style={{ animationDelay: '150ms' }} />
                      <span className="w-2.5 h-2.5 rounded-full bg-hc-teal animate-bounce shadow-lg" style={{ animationDelay: '300ms' }} />
                    </div>
                    <div className="text-sm font-black text-hc-teal-light uppercase tracking-[0.3em] animate-pulse">Enhancing note...</div>
                    <p className="text-[10px] text-hc-muted font-bold uppercase tracking-widest mt-2 max-w-[200px]">Improving tone · Correcting grammar · Structuring content</p>
                  </div>
                ) : generatedNote ? (
                  <pre className="text-sm text-hc-text font-mono leading-loose whitespace-pre-wrap animate-in fade-in duration-1000 italic opacity-90 group-hover/preview:opacity-100 transition-opacity">"{generatedNote}"</pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-30 group cursor-default">
                    <div className="w-20 h-20 rounded-3xl glass border border-hc-border flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-700">
                      <svg className="w-10 h-10 text-hc-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-[0.3em] max-w-[200px] leading-relaxed">Your note preview will appear here...</div>
                  </div>
                )}
                {enhanceError && <div className="pill pill-red text-[9px] font-black px-4 py-2 mt-6 shadow-lg animate-in shake duration-500 uppercase tracking-widest">{enhanceError}</div>}
              </div>

              {generatedNote && !enhancing && (
                <div className="px-8 pb-6 animate-in slide-in-from-bottom-4 duration-500">
                  <button onClick={enhanceNote}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl glass-light border border-hc-teal/30 hover:bg-hc-teal/10 hover:border-hc-teal/60 text-hc-teal-light text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl hover:scale-[1.02] active:scale-95 group/enhance">
                    <svg className="w-5 h-5 group-hover/enhance:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                    ✦ AI Enhance Note
                  </button>
                </div>
              )}

              <div className="p-8 border-t border-hc-border bg-black/5 flex gap-4 relative z-10">
                <button onClick={() => { const n = enhancedNote || generatedNote; if (n) { navigator.clipboard.writeText(n); setCopied(true); setTimeout(() => setCopied(false), 2000); } }} disabled={!generatedNote && !enhancedNote}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 disabled:opacity-20 disabled:grayscale shadow-2xl hover:scale-105 active:scale-95 ${copied ? 'bg-flag-green text-hc-text shadow-flag-green/20' : 'btn-gradient text-hc-text'}`}>
                  {copied ? (<><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>COPIED</>) : (<><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>COPY TO CLIPBOARD</>)}
                </button>
                <button onClick={saveNote} disabled={!generatedNote && !enhancedNote} className="px-8 py-4 glass-light border border-hc-border text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] rounded-2xl hover:text-hc-text hover:bg-white/5 active:scale-95 disabled:opacity-20 transition-all">SAVE ENTRY</button>
              </div>
            </div>

            <div className="glass-light border border-hc-teal/20 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group cursor-default">
              <div className="absolute top-0 left-0 w-1 h-full bg-hc-teal opacity-40 group-hover:opacity-100 transition-opacity" />
              <div className="text-[10px] font-black text-hc-teal-light mb-2 uppercase tracking-[0.3em] transition-transform group-hover:translate-x-1 duration-500">Helpful Tip</div>
              <p className="text-[11px] text-hc-muted font-medium leading-relaxed italic opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:translate-x-1">"Write or dictate your notes in any language — HazelCare will translate and polish them into professional English for your records."</p>
            </div>

            {savedNotes.length > 0 && (
              <div className="px-2 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                <button onClick={() => setShowHistory(!showHistory)} className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-hc-muted hover:text-hc-teal-light w-full transition-all text-left">
                  <span className={`w-6 h-6 rounded-lg glass border border-hc-border flex items-center justify-center transition-all duration-500 ${showHistory ? 'rotate-90 bg-hc-teal/10 border-hc-teal/30 text-hc-teal-light' : 'group-hover:bg-white/5'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </span>
                  HISTORY ({savedNotes.length})
                </button>
                {showHistory && (
                  <div className="mt-5 space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin pr-2 animate-in slide-in-from-top-4 duration-500">
                    {savedNotes.slice(0, 20).map(note => (
                      <div key={note.id} className="glass-light border border-hc-border rounded-2xl p-5 group/archive interactive-row card-glow relative overflow-hidden active:scale-[0.98] transition-all duration-500">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/[0.02] blur-2xl -translate-y-1/2 translate-x-1/2 group-hover/archive:bg-hc-teal/5 transition-colors" />
                        <div className="flex items-start justify-between gap-4 relative z-10">
                          <div className="min-w-0 transition-transform duration-500 group-hover/archive:translate-x-1">
                            <div className="text-[11px] font-black text-hc-text group-hover/archive:text-hc-teal-light transition-colors uppercase tracking-tight truncate">{note.type}</div>
                            <div className="text-[9px] font-bold text-hc-muted/60 uppercase tracking-widest mt-1">{note.house}{note.client ? ` · ${note.client}` : ''} · <span className="tabular-nums">{note.date}</span></div>
                          </div>
                          <button onClick={() => { navigator.clipboard.writeText(note.text); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="w-8 h-8 rounded-xl glass border border-hc-border flex items-center justify-center text-hc-muted hover:text-hc-teal-light opacity-0 group-hover/archive:opacity-100 transition-all shadow-lg active:scale-90">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </button>
                        </div>
                        <p className="text-[11px] text-hc-text/70 line-clamp-2 mt-3 font-medium leading-relaxed italic group-hover/archive:text-hc-text transition-all duration-500 group-hover/archive:translate-x-1">"{note.text}"</p>
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
