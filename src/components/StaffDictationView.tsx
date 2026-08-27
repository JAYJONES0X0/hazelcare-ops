import { useState, useRef, useCallback } from 'react';
import { Sparkles, RefreshCw, Copy, CheckCircle2, MessageSquare, Eye, EyeOff, Send } from 'lucide-react';
import { LanguageSearchDropdown } from './LanguageSearchDropdown';
import { assessNoteStandard } from '../lib/note-quality-standard';
import { HAZELCARE_HOUSES } from '../lib/compliance-store';
import { SearchSelect } from './SearchSelect';
import { loadCustomHouses, addCustomHouse } from '../lib/custom-houses';

interface SpeechRecognitionResultLike { isFinal: boolean; 0: { transcript: string } }
interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ||
       (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition)
    : null;

const FORMATS = [
  { id: 'standard', label: 'Standard Note', desc: 'Time-chronological narrative' },
  { id: 'handover', label: 'Shift Handover', desc: 'Full shift covering all clients' },
  { id: 'incident', label: 'Incident', desc: 'What happened, actions, outcome' },
  { id: 'medication', label: 'Medication Note', desc: 'Administration or refusal' },
] as const;

const FORMAT_DIRECTIVES: Record<string, string> = {
  standard: 'Write a clear shift note in time-chronological order. Cover: medication, meals, mood, activities, and end-of-shift status. Use simple sentences like a real care worker.',
  handover: 'Write a full handover note covering every client in the house. Include: general overview, care and interaction, environment and resident mood, medication administration, cleaning completed, safe balances, and concerns.',
  incident: 'Document the incident clearly: what happened, time and location, staff actions taken, client response, any injuries or damage, who was notified, and follow-up actions. Be factual and precise.',
  medication: 'Document medication administration or refusal: medication name and dose, time given, how taken, any refusal and reason given, who was informed, and outcome.',
};

export function StaffDictationView({ hideHeader, toolId, staffName }: { hideHeader?: boolean; toolId?: string; staffName?: string }) {
  const [text, setText] = useState('');
  const [voiceLang, setVoiceLang] = useState('en-GB');
  const [enhanced, setEnhanced] = useState('');
  const [evidenceTrail, setEvidenceTrail] = useState('');
  const [showEvidence, setShowEvidence] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [format, setFormat] = useState('standard');
  const [copied, setCopied] = useState(false);
  const [client, setClient] = useState('');
  const [house, setHouse] = useState('');
  const [customHouses, setCustomHouses] = useState<string[]>(() => loadCustomHouses());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [enhanceError, setEnhanceError] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);

  const toggleMic = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }
    if (!SpeechRecognitionAPI) return;
    const r = new (SpeechRecognitionAPI as SpeechRecognitionCtor)();
    r.lang = voiceLang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event: SpeechRecognitionEventLike) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) setText(prev => prev + ' ' + event.results[i][0].transcript);
      }
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }, [listening, voiceLang]);

  const enhance = async () => {
    if (!text.trim()) return;
    setEnhancing(true);
    setEnhanced('');
    setEnhanceError(false);
    try {
      const res = await fetch('/api/staff/enhance-note', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          text,
          noteType: 'Clinical Entry',
          clientName: '',
          useStack: false,
          stackDirective: FORMAT_DIRECTIVES[format] || FORMAT_DIRECTIVES.golden,
          refineInstructions: FORMAT_DIRECTIVES[format] || FORMAT_DIRECTIVES.golden,
          includeEvidenceTrail: true,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
        setEnhanced(result);
      }
      const evIdx = result.lastIndexOf('\n---\nEvidence Trail:');
      if (evIdx !== -1) {
        setEnhanced(result.slice(0, evIdx));
        setEvidenceTrail(result.slice(evIdx));
      } else {
        setEnhanced(result);
        setEvidenceTrail('');
      }
    } catch {
      setEnhanced('');
      setEnhanceError(true);
    } finally {
      setEnhancing(false);
    }
  };

  const submitNote = async () => {
    if (!enhanced.trim() || !client.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/staff/submit-note', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, client, house, noteType: format, text: enhanced, evidenceTrail, staffName }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed');
      setSubmitted(true);
    } catch {
      setSubmitError('Could not submit. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const noteAssessment = enhanced ? assessNoteStandard(enhanced) : null;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col min-h-dvh bg-hc-surface safe-area">
      {!hideHeader && (
        <div className="px-4 py-3 border-b border-hc-border/20 flex items-center gap-3 shrink-0">
          <MessageSquare className="w-4 h-4 text-hc-teal" />
          <span className="text-[10px] font-black uppercase tracking-widest text-hc-text">Dictation Studio</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-8">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                format === f.id
                  ? 'bg-hc-teal text-hc-bone shadow-lg'
                  : 'hc-clay-raised text-hc-muted hover:text-hc-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <input
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="Service user's full name..."
            className="w-full hc-clay-inset px-4 py-3 text-sm font-black text-hc-text outline-none shadow-inner rounded-xl"
          />
          <SearchSelect
            options={[...HAZELCARE_HOUSES, ...customHouses].map(h => ({ value: h, label: h }))}
            value={house} onChange={setHouse}
            allowCustom onAddCustom={v => setCustomHouses(addCustomHouse(v))}
          />
        </div>

        <div className="flex items-center gap-2">
          <LanguageSearchDropdown value={voiceLang} onChange={setVoiceLang} />
          {SpeechRecognitionAPI && (
            <button
              type="button"
              onClick={toggleMic}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                listening
                  ? 'bg-flag-red/20 border border-flag-red text-flag-red animate-pulse'
                  : 'hc-clay-raised border border-hc-teal/20 text-hc-teal'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${listening ? 'bg-flag-red animate-ping' : 'bg-hc-teal'}`} />
              {listening ? 'Listening...' : 'Dictate'}
            </button>
          )}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your notes here, type, or tap the mic..."
          className="w-full hc-clay-inset p-5 text-[14px] text-hc-text font-medium leading-relaxed resize-none focus:outline-none min-h-[200px] scrollbar-thin rounded-2xl"
          style={{ WebkitAppearance: 'none' }}
        />

        <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-hc-muted">
          <span>{wordCount} words</span>
          {noteAssessment && (
            <span className={`px-2 py-1 rounded-lg font-black uppercase tracking-widest ${
              noteAssessment.status === 'strong' ? 'text-flag-green' :
              noteAssessment.status === 'needs-review' ? 'text-flag-amber' : 'text-flag-red'
            }`}>
              {noteAssessment.score}% quality
            </span>
          )}
        </div>

        <button
          onClick={enhance}
          disabled={!text.trim() || enhancing}
          className="w-full py-4 rounded-2xl bg-hc-teal text-hc-bone text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {enhancing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {enhancing ? 'Enhancing...' : 'Enhance Note'}
        </button>

        {enhanceError && (
          <div className="p-4 rounded-2xl bg-flag-red/10 border border-flag-red/30 text-center space-y-2">
            <p className="text-[10px] font-bold text-flag-red uppercase tracking-widest">
              Could not process your note. Nothing was submitted.
            </p>
            <button
              onClick={() => void enhance()}
              className="px-4 py-2 rounded-xl hc-clay-raised text-[9px] font-black uppercase tracking-widest text-hc-text"
            >
              Try Again
            </button>
          </div>
        )}

        {enhanced && (
          <div className="space-y-3">
            <div className="hc-clay-inset p-5 rounded-2xl bg-transparent">
              <pre className="text-[13px] text-hc-text font-medium leading-relaxed whitespace-pre-wrap">
                {enhanced}
              </pre>
              {evidenceTrail && (
                <div className="border-t border-hc-border/20 pt-3 mt-3">
                  <button type="button" onClick={() => setShowEvidence(v => !v)}
                    className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-teal transition-colors"
                  >
                    {showEvidence ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showEvidence ? 'Hide' : 'Show'} evidence trail
                  </button>
                  {showEvidence && (
                    <pre className="mt-2 text-[11px] text-hc-muted font-mono leading-relaxed whitespace-pre-wrap">
                      {evidenceTrail}
                    </pre>
                  )}
                </div>
              )}
            </div>
            {submitted ? (
              <div className="w-full py-4 rounded-2xl bg-flag-green/10 border border-flag-green/30 text-flag-green text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Submitted for review
              </div>
            ) : (
              <>
                {!client.trim() && (
                  <p className="text-[9px] font-bold text-flag-amber uppercase tracking-widest text-center">
                    Enter the service user's name above to submit
                  </p>
                )}
                {submitError && (
                  <p className="text-[9px] font-bold text-flag-red uppercase tracking-widest text-center">{submitError}</p>
                )}
                <button
                  onClick={() => void submitNote()}
                  disabled={!client.trim() || submitting}
                  className="w-full py-4 rounded-2xl bg-hc-teal text-hc-bone text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(enhanced); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    copied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Note (backup)'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
