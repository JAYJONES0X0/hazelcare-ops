import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { uid } from '../lib/storage';

// ============================================================
// VOICE-TO-NOTE — Web Speech API
// ============================================================
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

const speechSupported = !!SpeechRecognitionAPI;

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
export function setVoiceLang(lang: string) { _voiceLang = lang; }
export function getVoiceLang() { return _voiceLang; }

function useSpeechToText(onResult: (transcript: string) => void) {
  const recognitionRef = useRef<any>(null);
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
    recognition.onresult = (event: any) => {
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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all select-none ${
        listening
          ? 'bg-red-500/20 border border-red-500 text-red-400 shadow-lg shadow-red-500/20'
          : 'bg-hc-dark border border-hc-border text-hc-teal-light hover:border-hc-teal hover:text-white hover:bg-hc-teal/10'
      }`}
    >
      <svg className={`w-4 h-4 shrink-0 ${listening ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      <span className="text-xs leading-none">
        {listening ? (
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />Recording…</span>
        ) : (
          <span>{lang?.flag} Speak {lang?.label?.split(' ')[0]}</span>
        )}
      </span>
    </button>
  );
}

// ============================================================
// ALL 43 NOURISH DIARY TYPES — FULL COVERAGE
// ============================================================
interface NoteType {
  id: string;
  label: string;
  group: 'client' | 'carer' | 'meeting' | 'auto';
  color: string;
  prompts: { key: string; label: string; placeholder: string; required?: boolean }[];
}

const NOTE_TYPES: NoteType[] = [
  // ── CLIENT NOTES ───────────────────────────────────────────
  {
    id: 'daily_support', label: 'Daily 1:1 Support', group: 'client', color: '#14b8a6',
    prompts: [
      { key: 'mood', label: 'How was the client\'s mood and presentation?', placeholder: 'e.g. Client appeared calm and engaged, good eye contact, responded well to prompts...', required: true },
      { key: 'activities', label: 'What activities or support was provided?', placeholder: 'e.g. Supported with personal care, attended community group, cooked lunch together...' },
      { key: 'concerns', label: 'Any concerns or observations?', placeholder: 'e.g. Mentioned feeling anxious about upcoming appointment, appeared quieter than usual...' },
      { key: 'followup', label: 'Follow-up actions needed?', placeholder: 'e.g. Monitor mood, remind about Thursday appointment, inform keyworker...' },
    ],
  },
  {
    id: 'keyworker_session', label: 'Keyworker Session', group: 'client', color: '#0f766e',
    prompts: [
      { key: 'topics', label: 'What topics were discussed in the session?', placeholder: 'e.g. Reviewed care plan goals, discussed community access, talked through recent concerns...', required: true },
      { key: 'client_views', label: 'What were the client\'s views and wishes?', placeholder: 'e.g. Client expressed desire to go to college, happy with current support...' },
      { key: 'progress', label: 'Progress against care plan goals?', placeholder: 'e.g. Making good progress with independence. Has started cooking 2 meals per week independently...' },
      { key: 'risks', label: 'Any risks or safeguarding matters?', placeholder: 'e.g. No new concerns. Previous concern regarding finances resolved...' },
      { key: 'actions', label: 'Agreed actions before next session?', placeholder: 'e.g. Client to try bus journey independently. Review funding application next week...' },
      { key: 'next', label: 'Next keyworker session date?', placeholder: 'e.g. 4 weeks — 14/04/2026' },
    ],
  },
  {
    id: 'care_review', label: 'Care Review', group: 'client', color: '#0f766e',
    prompts: [
      { key: 'attendees', label: 'Who attended the review?', placeholder: 'e.g. Client, keyworker, social worker, family member, house coordinator...', required: true },
      { key: 'current_plan', label: 'How is the current care plan working?', placeholder: 'e.g. Plan is broadly working well. Client achieving most goals. Medication support still required...' },
      { key: 'client_views', label: 'Client\'s views on their care?', placeholder: 'e.g. Happy with support staff. Would like more community access. Finds morning routine rushed...' },
      { key: 'changes', label: 'Changes to care plan agreed?', placeholder: 'e.g. Increase community access to 3x per week. Reduce prompting for personal care...' },
      { key: 'risks', label: 'Risk assessment updates?', placeholder: 'e.g. Risk around finances to be updated. PBS to be reviewed following recent incidents...' },
      { key: 'next_review', label: 'Next review date?', placeholder: 'e.g. 6 months — September 2026' },
    ],
  },
  {
    id: 'handover', label: 'Handover', group: 'client', color: '#3b82f6',
    prompts: [
      { key: 'events', label: 'Key events this shift?', placeholder: 'e.g. Quiet shift overall. Client A attended day centre, Client B had GP appointment...', required: true },
      { key: 'clients', label: 'Client updates?', placeholder: 'e.g. Client B refused dinner, offered alternative and accepted. Client C had positive mood all day...' },
      { key: 'outstanding', label: 'Outstanding tasks for next shift?', placeholder: 'e.g. Medication round at 20:00, laundry needs completing, log to be submitted...' },
      { key: 'nextshift', label: 'Anything critical for incoming staff?', placeholder: 'e.g. GP calling back about Client A tomorrow morning. Night check required for Client C...' },
    ],
  },
  {
    id: 'abc_chart', label: 'ABC Chart', group: 'client', color: '#ef4444',
    prompts: [
      { key: 'antecedent', label: 'Antecedent — What happened before the behaviour?', placeholder: 'e.g. Staff asked client to turn off TV at 21:00. Client had not eaten dinner. Loud noise from outside...', required: true },
      { key: 'behaviour', label: 'Behaviour — What did the client do?', placeholder: 'e.g. Client shouted at staff, threw remote control, paced around room for 10 minutes...', required: true },
      { key: 'consequence', label: 'Consequence — What happened as a result?', placeholder: 'e.g. Staff used low arousal approach. Client de-escalated after 15 minutes. Offered alternative activity...' },
      { key: 'intensity', label: 'Intensity and duration?', placeholder: 'e.g. High intensity — lasted approximately 15 minutes before de-escalating' },
      { key: 'action', label: 'Actions taken and by whom?', placeholder: 'e.g. PBS strategies followed. Redirected to preferred activity. Keyworker notified...' },
    ],
  },
  {
    id: 'incident', label: 'Accident / Incident', group: 'client', color: '#dc2626',
    prompts: [
      { key: 'what', label: 'What happened?', placeholder: 'e.g. Client fell in bathroom while getting out of shower...', required: true },
      { key: 'when', label: 'When did it happen (date/time)?', placeholder: 'e.g. 12/03/2026 at approximately 06:30' },
      { key: 'who', label: 'Who was involved?', placeholder: 'e.g. Client: [Name]. Staff present: Sarah Mitchell...' },
      { key: 'injuries', label: 'Any injuries?', placeholder: 'e.g. Small bruise on left forearm. No head injury. Client alert and oriented.' },
      { key: 'action', label: 'What action was taken?', placeholder: 'e.g. First aid administered. Ice pack applied. GP notified by phone...' },
      { key: 'notified', label: 'Who was notified?', placeholder: 'e.g. House coordinator, on-call manager, GP surgery, family (NOK)...' },
    ],
  },
  {
    id: 'incident_audit', label: 'Accident and Incidents Audit', group: 'client', color: '#dc2626',
    prompts: [
      { key: 'period', label: 'Audit period covered?', placeholder: 'e.g. March 2026 — Cottrell House', required: true },
      { key: 'total', label: 'Total number of incidents?', placeholder: 'e.g. 4 incidents recorded this month — 2 falls, 1 challenging behaviour, 1 medication error' },
      { key: 'themes', label: 'Themes or patterns identified?', placeholder: 'e.g. 3 of 4 incidents occurred during evening shift. Falls cluster in Client A...' },
      { key: 'actions', label: 'Actions taken to reduce incidents?', placeholder: 'e.g. Additional risk assessment completed. Moving/handling refresher booked...' },
      { key: 'learning', label: 'Learning outcomes?', placeholder: 'e.g. PBS strategy updated. New grab rail fitted. Night check frequency increased...' },
    ],
  },
  {
    id: 'safeguarding', label: 'Safeguarding', group: 'client', color: '#be185d',
    prompts: [
      { key: 'concern', label: 'What is the safeguarding concern?', placeholder: 'e.g. Client disclosed that another resident made threatening comments...', required: true },
      { key: 'who', label: 'Who is involved?', placeholder: 'e.g. Alleged victim: Robert Ellis. Alleged perpetrator: unnamed resident...' },
      { key: 'disclosure', label: 'How was it disclosed/discovered?', placeholder: 'e.g. Client told staff member during 1:1 session...' },
      { key: 'action', label: 'Immediate actions taken?', placeholder: 'e.g. Ensured client safety. Statements taken. Manager notified...' },
      { key: 'referral', label: 'Referrals made?', placeholder: 'e.g. Local authority safeguarding team contacted. Reference number pending...' },
    ],
  },
  {
    id: 'concern', label: 'Concern', group: 'client', color: '#d97706',
    prompts: [
      { key: 'concern', label: 'What is the concern?', placeholder: 'e.g. Client appeared withdrawn and refused meals for 2 days. Possible deterioration in mental health...', required: true },
      { key: 'context', label: 'Context and background?', placeholder: 'e.g. Client recently had medication review. Family visited last week and reported concerns...' },
      { key: 'risk', label: 'Level of risk?', placeholder: 'e.g. Amber — monitoring required. Not an immediate safety issue but trend is concerning...' },
      { key: 'action', label: 'Actions taken or planned?', placeholder: 'e.g. GP referral made. Manager notified. Increased monitoring frequency...' },
    ],
  },
  {
    id: 'complaint', label: 'Complaints', group: 'client', color: '#dc2626',
    prompts: [
      { key: 'complaint', label: 'What is the complaint?', placeholder: 'e.g. Client/family complained about staff attitude during morning shift on 10/03/2026...', required: true },
      { key: 'who', label: 'Who made the complaint?', placeholder: 'e.g. Client\'s mother — Mrs Singh. Contact number on file.' },
      { key: 'investigation', label: 'Investigation steps taken?', placeholder: 'e.g. Spoke to staff member concerned. Reviewed CCTV footage. Statements taken...' },
      { key: 'outcome', label: 'Outcome and response?', placeholder: 'e.g. Formal apology issued. Staff retraining scheduled. Complaint registered in log...' },
      { key: 'learning', label: 'Learning from this complaint?', placeholder: 'e.g. Communication guidance to be updated. Team discussion at next house meeting...' },
    ],
  },
  {
    id: 'compliment', label: 'Compliments', group: 'client', color: '#16a34a',
    prompts: [
      { key: 'compliment', label: 'What was the compliment about?', placeholder: 'e.g. Family praised staff for excellent communication during hospital visit...', required: true },
      { key: 'who', label: 'Who gave the compliment?', placeholder: 'e.g. Client\'s sister, Mrs Patel, called to say thank you...' },
      { key: 'staff', label: 'Staff member mentioned (if any)?', placeholder: 'e.g. Amy Rogers specifically mentioned for her kindness and professionalism...' },
      { key: 'share', label: 'How will this be shared?', placeholder: 'e.g. Shared at team meeting. Added to staff file. Passed on to manager...' },
    ],
  },
  {
    id: 'family_feedback', label: 'Family Feedback', group: 'client', color: '#059669',
    prompts: [
      { key: 'family', label: 'Who provided feedback?', placeholder: 'e.g. Client\'s mother Mrs Singh visited on 12/03/2026...', required: true },
      { key: 'feedback', label: 'What feedback was given?', placeholder: 'e.g. Happy with overall care. Noted client looks well and happy. Concerns about medication side effects...' },
      { key: 'action', label: 'Any actions arising?', placeholder: 'e.g. Medication review requested. GP appointment arranged. Next visit planned for 26/03/2026...' },
    ],
  },
  {
    id: 'client_feedback', label: 'Client Feedback', group: 'client', color: '#059669',
    prompts: [
      { key: 'feedback', label: 'What feedback did the client give?', placeholder: 'e.g. Client said they are happy with their support worker but would like to do more cooking...', required: true },
      { key: 'method', label: 'How was feedback gathered?', placeholder: 'e.g. Easy Read feedback form. Verbal during 1:1. Client survey...' },
      { key: 'action', label: 'Actions agreed?', placeholder: 'e.g. Weekly cooking session added to care plan. Client to choose recipes...' },
    ],
  },
  {
    id: 'cqc', label: 'CQC', group: 'client', color: '#be185d',
    prompts: [
      { key: 'type', label: 'Type of CQC activity?', placeholder: 'e.g. Scheduled inspection, spot check, quality monitoring, regulatory notification...', required: true },
      { key: 'date', label: 'Date and inspector details?', placeholder: 'e.g. 12/03/2026. Inspector: Jane Doe. Ref: INS-2026-XXX' },
      { key: 'findings', label: 'Key findings or queries raised?', placeholder: 'e.g. Reviewed medication records, staffing levels, care plans. Queried PBS documentation...' },
      { key: 'response', label: 'Our response?', placeholder: 'e.g. All documents produced. Action plan presented. No immediate concerns raised...' },
      { key: 'outcome', label: 'Outcome or next steps?', placeholder: 'e.g. Full report expected within 20 days. Follow-up visit scheduled...' },
    ],
  },
  {
    id: 'gp_appointment', label: 'GP Appointment', group: 'client', color: '#0891b2',
    prompts: [
      { key: 'client', label: 'Client and reason for appointment?', placeholder: 'e.g. [Name] — review of Risperidone dosage and annual health check', required: true },
      { key: 'outcome', label: 'What was the outcome?', placeholder: 'e.g. Medication adjusted. Blood test requested. Follow-up in 4 weeks...' },
      { key: 'actions', label: 'Follow-up actions required?', placeholder: 'e.g. Collect new prescription from pharmacy. Book blood test. Update MAR chart...' },
      { key: 'notified', label: 'Who was notified?', placeholder: 'e.g. Keyworker informed. Family updated. Manager copy of letter filed...' },
    ],
  },
  {
    id: 'medication', label: 'Medication', group: 'client', color: '#0891b2',
    prompts: [
      { key: 'what', label: 'Which medication and client?', placeholder: 'e.g. Olanzapine 10mg — [Name]', required: true },
      { key: 'status', label: 'Was it administered, refused, or missed?', placeholder: 'e.g. Refused at 08:00, attempted again at 09:30...' },
      { key: 'reason', label: 'Reason if refused/missed?', placeholder: 'e.g. Client said they didn\'t want it, appeared drowsy...' },
      { key: 'action', label: 'Action taken?', placeholder: 'e.g. GP informed by phone. Will attempt at lunchtime. MAR chart updated.' },
    ],
  },
  {
    id: 'medication_audit', label: 'Medication Audit', group: 'client', color: '#0891b2',
    prompts: [
      { key: 'period', label: 'Audit period and house?', placeholder: 'e.g. March 2026 — Cottrell House. All clients audited.', required: true },
      { key: 'findings', label: 'Key findings?', placeholder: 'e.g. 2 MAR charts incomplete for Client B. CD book balance correct. Stock levels checked...' },
      { key: 'discrepancies', label: 'Any discrepancies?', placeholder: 'e.g. 1 missing signature on 08/03. Medication returned — count verified and correct...' },
      { key: 'actions', label: 'Actions taken?', placeholder: 'e.g. Missing signature investigated — staff retraining completed. Manager notified of all discrepancies...' },
    ],
  },
  {
    id: 'medication_collected', label: 'Medication Collected', group: 'client', color: '#0891b2',
    prompts: [
      { key: 'client', label: 'Client and medication collected?', placeholder: 'e.g. [Name] — monthly prescription collected from Boots Pharmacy', required: true },
      { key: 'items', label: 'Items collected?', placeholder: 'e.g. Olanzapine 10mg x 30, Metformin 500mg x 60, Vitamin D x 90...' },
      { key: 'check', label: 'Checked against prescription?', placeholder: 'e.g. All items verified against prescription. Quantities correct. Expiry dates checked...' },
      { key: 'stored', label: 'Stored correctly?', placeholder: 'e.g. All medication stored in locked cabinet. CD in CD cupboard. Temperature checked.' },
    ],
  },
  {
    id: 'medication_ordered', label: 'Medication Ordered', group: 'client', color: '#0891b2',
    prompts: [
      { key: 'client', label: 'Client and medication ordered?', placeholder: 'e.g. Repeat prescription ordered for [Name] — Olanzapine 10mg', required: true },
      { key: 'method', label: 'How was it ordered?', placeholder: 'e.g. Online via GP practice portal. Requested 7 days before running out...' },
      { key: 'expected', label: 'Expected collection date?', placeholder: 'e.g. Ready to collect from Boots by 20/03/2026' },
    ],
  },
  {
    id: 'medication_returned', label: 'Medication Returned', group: 'client', color: '#0891b2',
    prompts: [
      { key: 'what', label: 'What medication was returned and why?', placeholder: 'e.g. Risperidone 2mg returned to pharmacy — discontinued by GP on 15/03/2026', required: true },
      { key: 'count', label: 'Count at time of return?', placeholder: 'e.g. 45 tablets returned. Count verified by 2 staff. Witnessed by coordinator...' },
      { key: 'pharmacy', label: 'Pharmacy details?', placeholder: 'e.g. Returned to Boots, High Street. Receipt obtained and filed.' },
    ],
  },
  {
    id: 'medication_review', label: 'Medication Review', group: 'client', color: '#0891b2',
    prompts: [
      { key: 'client', label: 'Client and review details?', placeholder: 'e.g. [Name] — annual medication review with Dr Smith on 12/03/2026', required: true },
      { key: 'outcome', label: 'Outcome of review?', placeholder: 'e.g. Olanzapine dose reduced. Metformin continued. New prescription issued for Vitamin D...' },
      { key: 'changes', label: 'Changes to MAR chart needed?', placeholder: 'e.g. MAR updated for Olanzapine dose change from 10mg to 5mg effective 15/03/2026...' },
      { key: 'actions', label: 'Next steps?', placeholder: 'e.g. Collect new prescription. Update care plan. Inform all shift staff of changes...' },
    ],
  },
  {
    id: 'finance_transaction', label: 'Financial Transaction', group: 'client', color: '#059669',
    prompts: [
      { key: 'client', label: 'Client and transaction details?', placeholder: 'e.g. [Name] — weekly spending money £30 withdrawn from Halifax', required: true },
      { key: 'purpose', label: 'Purpose of transaction?', placeholder: 'e.g. Food shop, clothing, leisure activity, personal purchase...' },
      { key: 'amount', label: 'Amount and balance?', placeholder: 'e.g. £30 withdrawn. Balance remaining: £145.23. Receipts obtained.' },
      { key: 'witnessed', label: 'Witnessed by?', placeholder: 'e.g. Witnessed by Sarah Mitchell. Client signed transaction record...' },
    ],
  },
  {
    id: 'finance_audit', label: 'Finance Audit', group: 'client', color: '#059669',
    prompts: [
      { key: 'period', label: 'Period and house audited?', placeholder: 'e.g. March 2026 — Cottrell House. All client accounts reviewed.', required: true },
      { key: 'findings', label: 'Key findings?', placeholder: 'e.g. All accounts balance. 2 missing receipts found and filed. Petty cash correct...' },
      { key: 'discrepancies', label: 'Any discrepancies?', placeholder: 'e.g. £12.50 unaccounted for in Client B\'s account. Investigation underway...' },
      { key: 'actions', label: 'Actions taken?', placeholder: 'e.g. Manager notified. Policy refresher issued. Additional checks put in place...' },
    ],
  },
  {
    id: 'service_charge', label: 'Service Charge', group: 'client', color: '#059669',
    prompts: [
      { key: 'client', label: 'Client and charge details?', placeholder: 'e.g. [Name] — monthly service charge £XXX.XX for March 2026', required: true },
      { key: 'payment', label: 'Payment method and status?', placeholder: 'e.g. Direct debit received. Payment confirmed by accounts team...' },
      { key: 'notes', label: 'Any notes or queries?', placeholder: 'e.g. Client\'s DWP payment increase applied from April. Funding review due...' },
    ],
  },
  {
    id: 'professional_notes', label: 'Professional Notes', group: 'client', color: '#9333ea',
    prompts: [
      { key: 'professional', label: 'Which professional and purpose?', placeholder: 'e.g. Community Psychiatric Nurse (CPN) home visit — quarterly review', required: true },
      { key: 'outcome', label: 'Outcome and findings?', placeholder: 'e.g. CPN assessed client as stable. No changes to mental health care plan required...' },
      { key: 'recommendations', label: 'Recommendations made?', placeholder: 'e.g. Increase social activities. Refer to OT for independent living assessment...' },
      { key: 'actions', label: 'Actions arising?', placeholder: 'e.g. Referral to OT submitted. Next CPN visit in 3 months. Copy of notes to keyworker...' },
    ],
  },
  {
    id: 'multi_agency', label: 'Multi Agency Meeting', group: 'client', color: '#7c3aed',
    prompts: [
      { key: 'attendees', label: 'Agencies and attendees?', placeholder: 'e.g. Social worker, CPN, OT, House coordinator, client, family representative...', required: true },
      { key: 'purpose', label: 'Purpose of meeting?', placeholder: 'e.g. EHCP review, transition planning, safeguarding strategy, care planning...' },
      { key: 'discussion', label: 'Key discussion points?', placeholder: 'e.g. Client\'s progress reviewed. Transition to supported living discussed. Funding confirmed...' },
      { key: 'decisions', label: 'Decisions and actions agreed?', placeholder: 'e.g. Increase community hours. Review in 3 months. EHCP to be updated by LA by 30/04...' },
      { key: 'next', label: 'Next meeting date?', placeholder: 'e.g. Review meeting — 3 months — July 2026' },
    ],
  },
  {
    id: 'repairs', label: 'Repairs', group: 'client', color: '#d97706',
    prompts: [
      { key: 'issue', label: 'What repair is needed?', placeholder: 'e.g. Bathroom tap leaking. Bedroom door hinge broken. Kitchen ceiling damp patch...', required: true },
      { key: 'reported', label: 'How and when was it reported?', placeholder: 'e.g. Reported at daily maintenance meeting on 12/03/2026. Work order raised...' },
      { key: 'priority', label: 'Priority level?', placeholder: 'e.g. High — health and safety risk. Medium — does not affect daily living. Low — cosmetic...' },
      { key: 'action', label: 'Action taken?', placeholder: 'e.g. Maintenance contractor contacted. Visit booked for 15/03/2026. Client informed...' },
    ],
  },

  // ── CARER / STAFF NOTES ────────────────────────────────────
  {
    id: 'supervision', label: 'Supervision', group: 'carer', color: '#7c3aed',
    prompts: [
      { key: 'staff', label: 'Staff member supervised?', placeholder: 'e.g. Amy Rogers — Support Worker, Cottrell House', required: true },
      { key: 'discussed', label: 'Topics discussed?', placeholder: 'e.g. Workload manageable. Discussed de-escalation training needs. Raised concerns about rota...' },
      { key: 'development', label: 'Development and training needs?', placeholder: 'e.g. Refresher on medication administration. First aid renewal due June 2026...' },
      { key: 'actions', label: 'Actions agreed?', placeholder: 'e.g. Book onto conflict management course. Shadow senior for medication round next week...' },
      { key: 'next', label: 'Next supervision date?', placeholder: 'e.g. 4 weeks — 09/04/2026' },
    ],
  },
  {
    id: 'probation', label: 'Probation Review (1st 3 months)', group: 'carer', color: '#7c3aed',
    prompts: [
      { key: 'staff', label: 'Staff member on probation?', placeholder: 'e.g. Tom Walsh — Support Worker. Started 01/01/2026. Review: 3-month mark.', required: true },
      { key: 'performance', label: 'Overall performance to date?', placeholder: 'e.g. Good progress. Settled into the team well. Punctual and reliable. Good rapport with clients...' },
      { key: 'strengths', label: 'Key strengths observed?', placeholder: 'e.g. Excellent communication with clients. Proactive approach. Completes documentation accurately...' },
      { key: 'development', label: 'Areas for development?', placeholder: 'e.g. Needs more confidence with medication rounds. Still developing PBS knowledge...' },
      { key: 'outcome', label: 'Probation outcome?', placeholder: 'e.g. Probation passed — confirmed in post from 01/04/2026. Extended by 1 month for further review...' },
    ],
  },
  {
    id: 'pip', label: 'Performance Improvement Plan', group: 'carer', color: '#ef4444',
    prompts: [
      { key: 'staff', label: 'Staff member on PIP?', placeholder: 'e.g. Staff member name and role', required: true },
      { key: 'concerns', label: 'Performance concerns identified?', placeholder: 'e.g. Repeated lateness, incomplete documentation, concerns raised by colleagues...' },
      { key: 'targets', label: 'Targets set?', placeholder: 'e.g. Arrive on time for all shifts. Complete all care notes within 30 mins of visit. No further documentation errors...' },
      { key: 'support', label: 'Support offered?', placeholder: 'e.g. 1:1 coaching sessions. Additional training. Mentoring from senior staff...' },
      { key: 'review', label: 'Review period and date?', placeholder: 'e.g. 4-week review on 14/04/2026. Progress to be assessed against targets.' },
    ],
  },
  {
    id: 'exit_interview', label: 'Exit Interview', group: 'carer', color: '#64748b',
    prompts: [
      { key: 'staff', label: 'Departing staff member?', placeholder: 'e.g. Amy Rogers — Support Worker, leaving 31/03/2026 after 2 years service', required: true },
      { key: 'reason', label: 'Reason for leaving?', placeholder: 'e.g. Career progression. Relocation. Personal reasons. Higher salary elsewhere...' },
      { key: 'feedback', label: 'Feedback on working at Hazelcare?', placeholder: 'e.g. Enjoyed working with clients. Found team supportive. Suggested better rota planning...' },
      { key: 'improvements', label: 'Suggestions for improvement?', placeholder: 'e.g. More consistent communication from management. Better supervision structure...' },
      { key: 'learning', label: 'Organisational learning?', placeholder: 'e.g. Concerns about staffing levels noted. Will be raised at next management meeting...' },
    ],
  },
  {
    id: 'expenses', label: 'Expenses / Mileage', group: 'carer', color: '#059669',
    prompts: [
      { key: 'staff', label: 'Staff member claiming?', placeholder: 'e.g. Sarah Mitchell — mileage claim for March 2026', required: true },
      { key: 'type', label: 'Type of claim?', placeholder: 'e.g. Mileage — 142 miles @ 25p per mile. Petty cash — food shop receipt £34.20...' },
      { key: 'amount', label: 'Amount claimed?', placeholder: 'e.g. £35.50 total. All receipts attached.' },
      { key: 'authorised', label: 'Authorised by?', placeholder: 'e.g. Approved and signed by House Coordinator — Sarah Mitchell, 14/03/2026' },
    ],
  },
  {
    id: 'finance', label: 'Finance / Expenses (General)', group: 'carer', color: '#059669',
    prompts: [
      { key: 'type', label: 'Type of transaction?', placeholder: 'e.g. Petty cash, mileage claim, client expenses...', required: true },
      { key: 'amount', label: 'Amount and details?', placeholder: 'e.g. £47.32 petty cash reconciled. All receipts present...' },
      { key: 'authorised', label: 'Authorised by?', placeholder: 'e.g. Signed off by house coordinator Sarah Mitchell' },
    ],
  },

  // ── MEETINGS ───────────────────────────────────────────────
  {
    id: 'quality_meeting', label: 'Quality Performance Meeting', group: 'meeting', color: '#0f766e',
    prompts: [
      { key: 'attendees', label: 'Who attended?', placeholder: 'e.g. House coordinator, manager, senior support workers...', required: true },
      { key: 'flags', label: 'Red and amber flags this week?', placeholder: 'e.g. 1 red flag — Client A fall on Tuesday. 3 amber flags — concerns, lateness, medication...' },
      { key: 'house_updates', label: 'House updates?', placeholder: 'e.g. Cottrell: quiet week. Hazelbury: client concern ongoing. Lingfield: CPN visit completed...' },
      { key: 'actions', label: 'Actions agreed?', placeholder: 'e.g. GP referral for Client B by Friday. Training refresher booked for Amy. CCTV to be fixed...' },
      { key: 'aob', label: 'Any other business?', placeholder: 'e.g. Bank holiday staffing confirmed. New starter joining Monday. CQC prep discussed...' },
    ],
  },
  {
    id: 'daily_quality', label: 'Daily Quality Meeting', group: 'meeting', color: '#1e40af',
    prompts: [
      { key: 'attendees', label: 'Who attended?', placeholder: 'e.g. All house coordinators, on-call manager...', required: true },
      { key: 'overnight', label: 'Overnight and early morning updates?', placeholder: 'e.g. Quiet overnight. Client C woke at 3am — settled within 20 minutes. All medication given...' },
      { key: 'today', label: 'Key priorities for today?', placeholder: 'e.g. GP appointment Client A at 10:30. Maintenance visit at 14:00. Team meeting 15:00...' },
      { key: 'concerns', label: 'Any concerns to flag?', placeholder: 'e.g. Client B mood low — monitor closely. Staff member off sick — cover in place...' },
    ],
  },
  {
    id: 'house_meeting', label: 'House Meeting', group: 'meeting', color: '#475569',
    prompts: [
      { key: 'attendees', label: 'Clients and staff present?', placeholder: 'e.g. 4 clients attended, 2 staff. Apologies from Client C (hospital appointment)...', required: true },
      { key: 'discussions', label: 'What was discussed?', placeholder: 'e.g. Menu planning for next week. Upcoming trip to bowling. House maintenance updates...' },
      { key: 'client_contributions', label: 'Client contributions and decisions?', placeholder: 'e.g. Clients voted for pizza night on Friday. Jamie asked for swimming to be added to schedule...' },
      { key: 'actions', label: 'Actions arising?', placeholder: 'e.g. Book bowling alley for 22/03. Order ingredients for pizza night. Review swimming timetable...' },
      { key: 'next', label: 'Next house meeting date?', placeholder: 'e.g. 4 weeks — 14/04/2026 at 15:00' },
    ],
  },
  {
    id: 'daily_finance_meeting', label: 'Daily Finance Meeting', group: 'meeting', color: '#059669',
    prompts: [
      { key: 'attendees', label: 'Who attended?', placeholder: 'e.g. Finance lead, house coordinators...', required: true },
      { key: 'balances', label: 'Current financial position?', placeholder: 'e.g. All client accounts reviewed. Petty cash balances checked. All within expected range...' },
      { key: 'transactions', label: 'Transactions today?', placeholder: 'e.g. Service charges received. Mileage claims submitted. Food shop £87.40 approved...' },
      { key: 'actions', label: 'Actions?', placeholder: 'e.g. Outstanding receipts to be submitted by Friday. Invoice from contractor to be processed...' },
    ],
  },
  {
    id: 'daily_hr_meeting', label: 'Daily HR Meeting', group: 'meeting', color: '#7c3aed',
    prompts: [
      { key: 'attendees', label: 'Who attended?', placeholder: 'e.g. HR lead, managers, coordinators...', required: true },
      { key: 'staffing', label: 'Staffing position today?', placeholder: 'e.g. Full staffing across all houses. 1 sickness call — cover arranged. 2 staff on leave...' },
      { key: 'hr_issues', label: 'HR issues to address?', placeholder: 'e.g. Supervision overdue for 3 staff. DBS renewal required for Amy Rogers by end of month...' },
      { key: 'actions', label: 'Actions?', placeholder: 'e.g. Contact agency for bank staff. Book supervisions. Chase DBS applications...' },
    ],
  },
  {
    id: 'daily_maintenance_meeting', label: 'Daily Maintenance Meeting', group: 'meeting', color: '#d97706',
    prompts: [
      { key: 'attendees', label: 'Who attended?', placeholder: 'e.g. Maintenance lead, house coordinators...', required: true },
      { key: 'outstanding', label: 'Outstanding repairs or maintenance?', placeholder: 'e.g. Kitchen tap fixed yesterday. Bedroom window still awaiting part — expected 20/03...' },
      { key: 'new_issues', label: 'New issues reported today?', placeholder: 'e.g. Boiler making noise at Church House. Report submitted and contractor contacted...' },
      { key: 'actions', label: 'Actions and priorities?', placeholder: 'e.g. High priority — boiler. Contractor visiting tomorrow. Monitor central heating overnight...' },
    ],
  },
  {
    id: 'weekly_quality_report', label: 'Weekly Quality Report — Regional', group: 'meeting', color: '#0f766e',
    prompts: [
      { key: 'week', label: 'Week covered?', placeholder: 'e.g. Week of 10/03/2026 — 16/03/2026. All 10 Hazelcare houses.', required: true },
      { key: 'summary', label: 'Overall summary?', placeholder: 'e.g. Stable week across all houses. 2 red flags, 5 amber flags. All resolved or being managed...' },
      { key: 'key_issues', label: 'Key issues requiring escalation?', placeholder: 'e.g. Safeguarding referral at Cottrell House — in progress. CQC inspection confirmed for next month...' },
      { key: 'positives', label: 'Positives this week?', placeholder: 'e.g. Client A started college course. Zero incidents at Lingfield for 4th consecutive week...' },
      { key: 'actions', label: 'Regional actions?', placeholder: 'e.g. Training review across all houses. Staffing stability plan to be presented at next board meeting...' },
    ],
  },
  {
    id: 'task_note', label: 'Task Note', group: 'carer', color: '#f59e0b',
    prompts: [
      { key: 'task', label: 'What task was completed?', placeholder: 'e.g. Weekly food shop, maintenance request, cleaning, admin task...', required: true },
      { key: 'details', label: 'Details?', placeholder: 'e.g. All items on menu plan purchased. Budget: £85.20. Receipts filed...' },
      { key: 'followup', label: 'Any follow-up needed?', placeholder: 'e.g. Need to order special dietary items for Client C by Thursday...' },
    ],
  },
];

const GROUPS = [
  { id: 'client', label: 'Client Notes', color: '#0f766e' },
  { id: 'carer', label: 'Staff / Carer Notes', color: '#7c3aed' },
  { id: 'meeting', label: 'Meeting Minutes', color: '#1e40af' },
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
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedNote, setEnhancedNote] = useState('');
  const [enhanceError, setEnhanceError] = useState('');
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('client');

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
    if (client) parts.push(`Client: ${client}`);
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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">

      {/* ── PAGE HEADER ───────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Staff Note Assistant</h1>
            <p className="text-hc-muted text-sm">All {NOTE_TYPES.length} Nourish diary entry types — guided prompts + voice dictation in any language.</p>
          </div>
        </div>

        {/* ── LANGUAGE BANNER ─────────────────────────────────── */}
        {speechSupported ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangPicker(v => !v)}
              className="w-full flex items-center gap-3 bg-hc-card border border-hc-teal/40 rounded-xl px-4 py-3 hover:border-hc-teal transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-hc-teal/10 border border-hc-teal/30 flex items-center justify-center text-2xl shrink-0">
                {currentLang.flag}
              </div>
              <div className="flex-1 text-left">
                <div className="text-xs text-hc-muted uppercase tracking-wider font-semibold mb-0.5">Voice language — tap to change</div>
                <div className="text-white font-semibold text-sm">{currentLang.label}</div>
              </div>
              <div className="text-hc-muted text-xs text-right hidden sm:block">
                <div className="font-medium text-hc-teal-light">Speak, type, or dictate</div>
                <div>in any language — AI translates</div>
              </div>
              <svg className={`w-4 h-4 text-hc-muted shrink-0 transition-transform ${showLangPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {/* Flag grid dropdown */}
            {showLangPicker && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-hc-darker border border-hc-border rounded-xl p-3 z-50 shadow-2xl">
                <div className="text-[10px] text-hc-muted uppercase tracking-wider font-semibold mb-3 px-1">Select your language</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                  {VOICE_LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => handleLangChange(l.code)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-center ${
                        voiceLang === l.code
                          ? 'border-hc-teal bg-hc-teal/10 text-white'
                          : 'border-hc-border bg-hc-card text-hc-muted hover:border-hc-teal/50 hover:text-white'
                      }`}
                    >
                      <span className="text-xl leading-none">{l.flag}</span>
                      <span className="text-[10px] font-medium leading-tight">{l.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-hc-card border border-hc-border rounded-xl px-4 py-3 text-sm text-hc-muted">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            For voice dictation in any language, open this page in Chrome or Edge.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — Input (3/5) */}
        <div className="lg:col-span-3 space-y-4">

          {/* Note type selector */}
          <div className="bg-hc-card border border-hc-border rounded-xl p-4">
            <div className="text-[10px] text-hc-muted uppercase tracking-wider font-semibold mb-3">Note Type</div>

            {/* Search + group tabs */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-hc-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search note types..."
                  className="w-full bg-hc-dark border border-hc-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-hc-muted/50 focus:outline-none focus:border-hc-teal-light"
                />
              </div>
              {!search && GROUPS.map(g => (
                <button key={g.id} onClick={() => setActiveGroup(g.id)}
                  className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${activeGroup === g.id ? 'font-semibold' : 'border-hc-border text-hc-muted hover:text-white'}`}
                  style={activeGroup === g.id ? { color: g.color, borderColor: `${g.color}40`, background: `${g.color}10` } : {}}>
                  {g.label}
                </button>
              ))}
            </div>

            {/* Type buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
              {filteredTypes.map(type => (
                <button key={type.id} onClick={() => { setSelectedType(type); setSearch(''); if (!search) setActiveGroup(type.group); }}
                  className={`text-left px-3 py-2 rounded-lg border text-[11px] transition-all ${selectedType.id === type.id ? 'font-semibold' : 'border-hc-border text-hc-muted hover:text-white hover:border-hc-border-light'}`}
                  style={selectedType.id === type.id ? { color: type.color, borderColor: `${type.color}40`, background: `${type.color}08` } : {}}>
                  {type.label}
                </button>
              ))}
            </div>

            {/* Selected type indicator */}
            <div className="mt-2 pt-2 border-t border-hc-border flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedType.color }} />
              <span className="text-[11px] text-hc-muted">Selected: <span className="text-white font-medium">{selectedType.label}</span></span>
            </div>
          </div>

          {/* Meta row */}
          <div className="bg-hc-card border border-hc-border rounded-xl p-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-hc-muted uppercase tracking-wider font-semibold mb-1 block">House</label>
                <select value={house} onChange={e => setHouse(e.target.value)} className="w-full bg-hc-dark border border-hc-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-hc-teal-light">
                  {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-hc-muted uppercase tracking-wider font-semibold mb-1 block">Client / Staff Name</label>
                <input value={client} onChange={e => setClient(e.target.value)} placeholder="e.g. [Name]" className="w-full bg-hc-dark border border-hc-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-hc-muted/50 focus:outline-none focus:border-hc-teal-light" />
              </div>
              <div>
                <label className="text-[10px] text-hc-muted uppercase tracking-wider font-semibold mb-1 block">Input Mode</label>
                <div className="flex gap-1">
                  {(['guided', 'free'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)} className={`flex-1 text-xs py-2 rounded-lg border transition-all ${mode === m ? 'bg-hc-teal/15 border-hc-teal/30 text-hc-teal-light font-semibold' : 'border-hc-border text-hc-muted hover:text-white'}`}>
                      {m === 'guided' ? 'Guided' : 'Free Text'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Guided prompts or free text */}
          {mode === 'guided' ? (
            <div className="space-y-3">
              {selectedType.prompts.map((prompt, i) => (
                <div key={prompt.key} className="bg-hc-card border border-hc-border rounded-xl p-4 focus-within:border-hc-teal/30 transition-all">
                  <label className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: `${selectedType.color}15`, color: selectedType.color }}>{i + 1}</span>
                    {prompt.label}
                    {prompt.required && <span className="text-flag-red text-[10px]">*</span>}
                  </label>
                  <textarea
                    value={answers[prompt.key] || ''}
                    onChange={e => setAnswer(prompt.key, e.target.value)}
                    placeholder={prompt.placeholder}
                    className="w-full bg-hc-dark border border-hc-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-hc-muted/40 focus:outline-none focus:border-hc-teal-light resize-none leading-relaxed mb-2"
                    rows={2}
                  />
                  <MicButton fieldKey={prompt.key} onTranscript={appendToAnswer} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-hc-card border border-hc-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs font-semibold text-white">Free Text Note</label>
                <div className="ml-auto"><MicButton fieldKey="freetext" onTranscript={appendToFreeText} /></div>
              </div>
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="Type or dictate in any language — English, Bengali, Nepali, Sinhala, Polski, Yorùbá, Tagalog, हिन्दी, Kiswahili... AI will translate and polish it into professional care English."
                className="w-full bg-hc-dark border border-hc-border rounded-lg px-3 py-3 text-sm text-white placeholder:text-hc-muted/40 focus:outline-none focus:border-hc-teal-light resize-y leading-relaxed"
                rows={8}
              />
            </div>
          )}

          {/* Flag warning */}
          {flagResult.severity !== 'none' && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${flagResult.severity === 'red' ? 'bg-flag-red/5 border-flag-red/25' : 'bg-flag-amber/5 border-flag-amber/25'}`}>
              <svg className={`w-5 h-5 shrink-0 mt-0.5 ${flagResult.severity === 'red' ? 'text-flag-red' : 'text-flag-amber'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              <div>
                <div className="text-xs font-semibold text-white mb-1">{flagResult.severity === 'red' ? 'Red Flag Detected' : 'Amber Flag Detected'}</div>
                <div className="text-[11px] text-hc-muted mb-2">{flagResult.severity === 'red' ? 'This note requires immediate manager attention.' : 'This note should be monitored.'}</div>
                <div className="flex flex-wrap gap-1">
                  {flagResult.flags.map((f, i) => (
                    <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full border ${flagResult.severity === 'red' ? 'bg-flag-red/10 text-flag-red border-flag-red/20' : 'bg-flag-amber/10 text-flag-amber border-flag-amber/20'}`}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — Preview (2/5) */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 space-y-4">
            <div className="bg-hc-card border border-hc-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-hc-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Generated Note</div>
                    <div className="text-[10px] text-hc-muted">{wordCount} words · ~{Math.max(1, Math.ceil(wordCount / 200))} min read</div>
                  </div>
                  {flagResult.severity !== 'none' && (
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${flagResult.severity === 'red' ? 'bg-flag-red/15 text-flag-red animate-pulse-soft' : 'bg-flag-amber/15 text-flag-amber'}`}>
                      {flagResult.severity.toUpperCase()} FLAG
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 min-h-[200px]">
                {/* AI Enhanced output — streams in live */}
                {enhancedNote ? (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-hc-teal-light bg-hc-teal/10 border border-hc-teal/20 px-2 py-0.5 rounded">✦ AI Enhanced</span>
                      <button onClick={() => setEnhancedNote('')} className="text-[9px] text-slate-500 hover:text-slate-300 ml-auto">Show original</button>
                    </div>
                    <pre className="text-xs text-hc-text font-mono leading-relaxed whitespace-pre-wrap">{enhancedNote}{enhancing && <span className="inline-block w-1.5 h-3.5 bg-hc-teal-light ml-0.5 animate-pulse align-middle" />}</pre>
                  </div>
                ) : enhancing ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[11px] text-hc-teal-light font-medium">AI is rewriting your note...</span>
                    </div>
                    <pre className="text-xs text-hc-muted/40 font-mono leading-relaxed whitespace-pre-wrap line-clamp-4">{generatedNote}</pre>
                  </div>
                ) : generatedNote ? (
                  <pre className="text-xs text-hc-text font-mono leading-relaxed whitespace-pre-wrap">{generatedNote}</pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-hc-muted">
                    <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <div className="text-xs text-center opacity-60">Fill in the prompts or type/dictate<br/>in any language — AI will polish it</div>
                  </div>
                )}
                {enhanceError && <div className="text-red-400 text-[10px] mt-2">{enhanceError}</div>}
              </div>

              {/* AI enhance button */}
              {generatedNote && !enhancing && (
                <div className="px-4 pb-3">
                  <button onClick={enhanceNote}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-hc-teal/30 bg-hc-teal/5 hover:bg-hc-teal/10 text-hc-teal-light text-xs font-medium transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                    ✦ AI Enhance — make it professional
                  </button>
                </div>
              )}

              <div className="p-4 border-t border-hc-border flex gap-2">
                <button onClick={() => { const n = enhancedNote || generatedNote; if (n) { navigator.clipboard.writeText(n); setCopied(true); setTimeout(() => setCopied(false), 2000); } }} disabled={!generatedNote && !enhancedNote}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-30 ${copied ? 'bg-flag-green text-white' : 'bg-hc-teal text-white hover:bg-hc-teal-light glow-teal'}`}>
                  {copied ? (<><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>) : (<><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy to Clipboard</>)}
                </button>
                <button onClick={saveNote} disabled={!generatedNote && !enhancedNote} className="px-4 py-2.5 bg-hc-card border border-hc-border text-sm text-hc-muted rounded-xl hover:text-white hover:border-hc-border-light disabled:opacity-30">Save</button>
              </div>
            </div>

            <div className="bg-hc-teal/5 border border-hc-teal/20 rounded-xl p-3.5">
              <div className="text-[10px] font-semibold text-hc-teal-light mb-1">Tip for staff</div>
              <div className="text-[10px] text-hc-muted leading-relaxed">Answer each prompt in your own words — even short answers work. Copy the finished note straight into Nourish. Don't worry about perfect English or formatting.</div>
            </div>

            {savedNotes.length > 0 && (
              <div>
                <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-xs text-hc-muted hover:text-white w-full mb-2">
                  <svg className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  Recent Notes ({savedNotes.length})
                </button>
                {showHistory && (
                  <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                    {savedNotes.slice(0, 15).map(note => (
                      <div key={note.id} className="bg-hc-card border border-hc-border rounded-lg p-3 group">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-semibold text-white">{note.type}</div>
                            <div className="text-[10px] text-hc-muted">{note.house}{note.client ? ` · ${note.client}` : ''} · {note.date}</div>
                          </div>
                          <button onClick={() => navigator.clipboard.writeText(note.text)} className="text-[10px] text-hc-muted hover:text-hc-teal-light opacity-0 group-hover:opacity-100 transition-all">Copy</button>
                        </div>
                        <div className="text-[10px] text-hc-text line-clamp-2 mt-1">{note.text}</div>
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
