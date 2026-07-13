import { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, RefreshCw, FileText, Clock, ShieldCheck, Zap, Link2, Copy, CheckCircle2, MessageSquare, Database, Mail, Inbox, Trash2, Download } from 'lucide-react';
import { HAZELCARE_HOUSES } from '../lib/compliance-store';
import type { CareEntry, Page, PageContext } from '../lib/types';
import { assessNoteStandard, buildProfessionalNoteDirective } from '../lib/note-quality-standard';
import { loadClients } from '../lib/client-store';
import { loadCustomHouses, addCustomHouse } from '../lib/custom-houses';
import { getAllEntriesAsync, appendEntriesAsync } from '../lib/entry-store';
import { getAllRosterShifts } from '../lib/roster-store';
import { buildOsIntelligenceContextFromState } from '../lib/os-intelligence-context';
import { LanguageSearchDropdown } from '../components/LanguageSearchDropdown';
import { SearchSelect } from '../components/SearchSelect';
import { NoteWorkspace } from './NoteWorkspace';
import { TemplatesPage } from './TemplatesPage';

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
  { id: '', label: 'Standard Note', icon: <FileText size={12} />, desc: 'Time-chronological narrative', directive: 'Write a clear shift note in time-chronological order. Cover: medication, meals, mood, activities, and end-of-shift status. Use simple sentences like a real care worker.' },
  { id: 'handover', label: 'Shift Handover', icon: <Clock size={12} />, desc: 'Full shift covering all clients', directive: 'Write a full handover note covering every client in the house. Include: general overview, care and interaction, environment and resident mood, medication administration, cleaning completed, safe balances, and concerns. Use the structure from real handover notes.' },
  { id: 'incident', label: 'Incident', icon: <ShieldCheck size={12} />, desc: 'What happened, actions taken, outcome', directive: 'Document the incident clearly: what happened, time and location, staff actions taken, client response, any injuries or damage, who was notified (GP, manager, family), and follow-up actions. Be factual and precise.' },
  { id: 'medication', label: 'Medication Note', icon: <Zap size={12} />, desc: 'Administration or refusal', directive: 'Document medication administration or refusal: medication name and dose, time given, how it was taken (with water/juice/food), any refusal and reason given, who was informed, and outcome.' },
];

interface PendingStaffNote {
  id: string;
  client: string;
  house: string;
  noteType: string;
  text: string;
  evidenceTrail: string;
  staffName: string;
  submittedAt: number;
}

export function StaffNotePage({ setPage }: { setPage?: (page: Page, ctx?: PageContext) => void } = {}) {
  const [activeTab] = useState<'dictation' | 'workspace' | 'templates'>('dictation');
  const [house, setHouse] = useState('Maple House');
  const [client, setClient] = useState('');
  const [freeText, setFreeText] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedNote, setEnhancedNote] = useState('');
  const [evidenceTrail, setEvidenceTrail] = useState('');
  const [showEvidence, setShowEvidence] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formatId, setFormatId] = useState('');
  const [voiceLang, setVoiceLangState] = useState('en-GB');
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [sentEmail, setSentEmail] = useState(false);
  const [customHouses, setCustomHouses] = useState<string[]>(() => loadCustomHouses());
  const [pendingNotes, setPendingNotes] = useState<PendingStaffNote[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [busyId, setBusyId] = useState('');

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
        if (event.results[i].isFinal) setFreeText(prev => prev + ' ' + event.results[i][0].transcript);
      }
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }, [listening, voiceLang]);

  const wordCount = freeText.split(/\s+/).filter(Boolean).length;
  const noteAssessment = assessNoteStandard(freeText, enhancedNote);

  const currentFormat = FORMATS.find(f => f.id === formatId);

  const enhanceNote = async () => {
    if (!freeText.trim()) return;
    setEnhancing(true); setEnhancedNote('');
    try {
      const [entries, rosterShifts] = await Promise.all([
        getAllEntriesAsync().catch(() => []),
        getAllRosterShifts().catch(() => []),
      ]);
      const profile = loadClients().find(c => c.name.toLowerCase().trim() === client.toLowerCase().trim()) || null;
      const clinicalContext = buildOsIntelligenceContextFromState({
        clientName: client, entry: null, entries, clientProfile: profile, rosterShifts,
        refineInstructions: currentFormat?.directive || '',
        maxChars: 55_000,
      });
      const res = await fetch('/api/staff/enhance-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          text: freeText,
          noteType: currentFormat ? currentFormat.label : 'Clinical Entry',
          clientName: client,
          useStack: !!currentFormat,
          stackId: formatId || undefined,
          stackDirective: currentFormat?.directive || '',
          referenceTemplate: '',
          refineInstructions: buildProfessionalNoteDirective(client, currentFormat ? `PROTOCOL DIRECTIVE: ${currentFormat.directive}` : ''),
          clinicalContext,
          includeEvidenceTrail: true,
        }),
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
      const evIdx = result.lastIndexOf('\n---\nEvidence Trail:');
      if (evIdx !== -1) {
        setEnhancedNote(result.slice(0, evIdx));
        setEvidenceTrail(result.slice(evIdx));
      } else {
        setEnhancedNote(result);
        setEvidenceTrail('');
      }
    } catch { /* ui handled */ }
    finally { setEnhancing(false); }
  };

  const issueStaffLink = async () => {
    setSharing(true);
    setSentEmail(false);
    try {
      const res = await fetch('/api/staff/issue-staff-link', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: 'notes', email: staffEmail || undefined }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setShareLink(data.link || '');
      setShareCode(data.code || '');
      if (staffEmail && data.sent) setSentEmail(true);
    } catch {
      setShareLink('');
      setShareCode('');
    } finally {
      setSharing(false);
    }
  };

  const loadPendingNotes = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await fetch('/api/staff/pending-notes', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPendingNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch {
      /* leave list as-is */
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => { void loadPendingNotes(); }, [loadPendingNotes]);

  const ackNote = async (id: string) => {
    try {
      await fetch('/api/staff/ack-note', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch { /* ignore */ }
    setPendingNotes(prev => prev.filter(n => n.id !== id));
  };

  const importNote = async (note: PendingStaffNote) => {
    setBusyId(note.id);
    try {
      const now = new Date();
      const entry: CareEntry = {
        id: `staff-${note.id}`,
        date: now.toLocaleDateString('en-GB'),
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        house: note.house || house,
        type: note.noteType || 'daily_support',
        carer: note.staffName || 'Staff (via link)',
        client: note.client,
        entry: note.text,
        severity: 'none',
        flags: [],
        category: 'daily_support',
      };
      await appendEntriesAsync([entry]);
      await ackNote(note.id);
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-12 max-w-[1700px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
        <div className="hc-clay-raised px-3 py-2 sm:px-4 sm:py-3 rounded-[1.5rem] text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-hc-teal flex items-center gap-2">
          <MessageSquare size={13} /> Dictation Studio
        </div>
        <button type="button" onClick={() => setPage?.('note-workspace')} disabled={!setPage} className="hc-clay-raised px-3 py-2 sm:px-4 sm:py-3 rounded-[1.5rem] text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-hc-text disabled:opacity-40 flex items-center gap-2">
          <Sparkles size={13} /> Note Workspace
        </button>
        <button type="button" onClick={() => setPage?.('templates')} disabled={!setPage} className="hc-clay-raised px-3 py-2 sm:px-4 sm:py-3 rounded-[1.5rem] text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-hc-text disabled:opacity-40 flex items-center gap-2">
          <Database size={13} /> Templates
        </button>
      </div>

      {pendingNotes.length > 0 && (
        <div className="mb-8 sm:mb-12 hc-clay-raised overflow-hidden border border-flag-amber/30 shadow-2xl">
          <div className="bg-flag-amber/10 px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-flag-amber" />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-flag-amber">
                {pendingNotes.length} Pending Staff Note{pendingNotes.length === 1 ? '' : 's'}
              </span>
            </div>
            <button type="button" onClick={() => void loadPendingNotes()} disabled={loadingPending}
              className="text-[9px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-teal flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loadingPending ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          <div className="divide-y divide-hc-border/20">
            {pendingNotes.map(note => (
              <div key={note.id} className="p-4 sm:p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-black text-hc-text">
                    {note.client || 'Unnamed client'} <span className="text-hc-muted font-bold">· {note.house || 'No house'}</span>
                  </div>
                  <div className="text-[9px] font-bold text-hc-muted uppercase tracking-widest">
                    {note.staffName ? `${note.staffName} · ` : ''}{new Date(note.submittedAt).toLocaleString('en-GB')}
                  </div>
                </div>
                <pre className="text-[12px] text-hc-text font-medium leading-relaxed whitespace-pre-wrap hc-clay-inset p-3 rounded-xl max-h-40 overflow-y-auto">{note.text}</pre>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void importNote(note)} disabled={busyId === note.id || !note.client.trim()}
                    className="px-4 py-2 rounded-xl btn-tactical text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> {busyId === note.id ? 'Importing...' : 'Import to Diary'}
                  </button>
                  <button type="button" onClick={() => void ackNote(note.id)} disabled={busyId === note.id}
                    className="px-4 py-2 rounded-xl hc-clay-raised text-[9px] font-black uppercase tracking-widest text-hc-muted hover:text-flag-red flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'dictation' && (
        <div className="mb-8 sm:mb-12 hc-clay-raised overflow-hidden border border-hc-teal/20 shadow-2xl">
          <div className="bg-hc-teal px-4 sm:px-8 py-4 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-hc-bone">Narrative Builder</span>
                {currentFormat && <span className="text-[8px] sm:text-[9px] font-bold text-hc-bone/50 uppercase tracking-widest ml-2">Format: {currentFormat.label}</span>}
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
                {FORMATS.map(f => (
                  <button key={f.id} onClick={() => setFormatId(f.id)}
                    className={`shrink-0 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all ${
                      formatId === f.id ? 'bg-hc-bone/20 text-hc-bone shadow-lg' : 'text-hc-bone/50 hover:text-hc-bone/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row p-2">
            <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <label className="text-[9px] sm:text-[10px] font-black text-hc-muted uppercase tracking-widest">Notes</label>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <LanguageSearchDropdown value={voiceLang} onChange={setVoiceLangState} />
                  {SpeechRecognitionAPI && (
                    <button type="button" onClick={toggleMic}
                      className={`flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                        listening ? 'bg-flag-red/20 border border-flag-red text-flag-red animate-pulse' : 'hc-clay-raised border border-hc-teal/20 text-hc-teal'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${listening ? 'bg-flag-red animate-ping' : 'bg-hc-teal'}`} />
                      {listening ? 'Listening' : 'Dictate'}
                    </button>
                  )}
                </div>
              </div>

              <textarea value={freeText} onChange={e => setFreeText(e.target.value)}
                placeholder="Paste or dictate your notes here. Select a format above to tell the AI how to organise the output."
                className="w-full hc-clay-inset p-4 sm:p-6 lg:p-8 text-[13px] sm:text-[14px] text-hc-text font-medium leading-relaxed resize-none focus:outline-none min-h-[250px] sm:min-h-[350px] lg:min-h-[450px] scrollbar-thin rounded-2xl"
              />

              <div className="hc-clay-inset p-3 sm:p-4 rounded-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-[9px] sm:text-[10px] font-black text-hc-muted uppercase tracking-widest">Quality Check</span>
                  {noteAssessment && (
                    <span className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${
                      noteAssessment.status === 'strong' ? 'bg-flag-green/10 text-flag-green border border-flag-green/20' :
                      noteAssessment.status === 'needs-review' ? 'bg-flag-amber/10 text-flag-amber border border-flag-amber/20' :
                      'bg-flag-red/10 text-flag-red border border-flag-red/20'
                    }`}>{noteAssessment.score}% standard</span>
                  )}
                </div>
                {noteAssessment && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {noteAssessment.checks.filter(c => !c.passed).slice(0, 6).map(c => (
                      <span key={c.id} className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-hc-border/20 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-hc-muted">
                        Missing {c.label}
                      </span>
                    ))}
                    {noteAssessment.risks.map(r => (
                      <span key={r.id} className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-flag-amber/10 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-flag-amber border border-flag-amber/20">
                        {r.label}
                      </span>
                    ))}
                    {noteAssessment.status === 'strong' && (
                      <span className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-flag-green/10 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-flag-green border border-flag-green/20">
                        Ready for refinement
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button onClick={enhanceNote} disabled={!freeText.trim() || enhancing}
                className="w-full py-4 sm:py-5 btn-tactical shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-40 text-[10px] sm:text-[11px] font-black uppercase tracking-widest"
              >
                {enhancing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {enhancing ? 'Enhancing...' : 'Assemble Gold Standard Narrative'}
              </button>
            </div>

            <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 bg-hc-teal/[0.01] border-t lg:border-t-0 lg:border-l border-hc-border/20">
              <div className="flex items-center justify-between">
                <label className="text-[9px] sm:text-[10px] font-black text-hc-muted uppercase tracking-widest">Enhanced Output</label>
                {enhancedNote && <span className="pill pill-teal text-[8px] sm:text-[9px] animate-pulse">READY</span>}
              </div>
              <div className="hc-clay-inset p-4 sm:p-6 lg:p-8 min-h-[250px] sm:min-h-[350px] lg:min-h-[450px] bg-transparent overflow-y-auto scrollbar-thin rounded-2xl">
                {enhancedNote ? (
                  <div className="space-y-4">
                    <pre className="text-[13px] sm:text-[14px] text-hc-text font-medium leading-relaxed whitespace-pre-wrap animate-in slide-in-from-bottom-4 duration-1000">
                      {enhancedNote}
                    </pre>
                    {evidenceTrail && (
                      <div className="border-t border-hc-border/20 pt-3">
                        <button type="button" onClick={() => setShowEvidence(v => !v)}
                          className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-teal transition-colors"
                        >
                          {showEvidence ? 'Hide' : 'Show'} evidence trail ({evidenceTrail.split('\n').filter(l => l.includes('*')).length} citations)
                        </button>
                        {showEvidence && (
                          <pre className="mt-2 text-[11px] text-hc-muted font-mono leading-relaxed whitespace-pre-wrap">
                            {evidenceTrail}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-12 sm:py-20">
                    <FileText className="w-12 h-12 sm:w-20 sm:h-20 text-hc-muted mb-6 sm:mb-8" strokeWidth={1} />
                    <div className="text-[10px] sm:text-[12px] font-black uppercase tracking-[0.4em] mb-2 sm:mb-3">Awaiting Assembly</div>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest max-w-xs">Paste your notes, select a format, and enhance to generate a professional report.</p>
                  </div>
                )}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(enhancedNote); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                disabled={!enhancedNote}
                className={`w-full py-4 sm:py-5 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-2 ${
                  copied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'
                }`}>
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied to Clipboard' : 'Copy Enhanced Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <button type="button" onClick={() => setShowAdvanced(v => !v)}
          className="w-full hc-clay-raised px-4 sm:px-6 py-3 sm:py-4 rounded-2xl text-left flex items-center justify-between"
        >
          <span className="text-[9px] sm:text-[10px] font-black text-hc-muted uppercase tracking-widest">Advanced: Client Context & Staff Access</span>
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-hc-teal">{showAdvanced ? 'Hide' : 'Show'}</span>
        </button>
      </div>

      {showAdvanced && (
        <>
          <div className="max-w-4xl mx-auto mt-4 sm:mt-6 hc-clay-raised p-4 sm:p-8 flex flex-wrap gap-4 sm:gap-8 items-end">
            <div className="flex-1 min-w-[160px] sm:min-w-[200px] space-y-2 sm:space-y-3">
              <label className="text-[9px] sm:text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1">Service User</label>
              <input value={client} onChange={e => setClient(e.target.value)} placeholder="Full Name..." className="w-full hc-clay-inset px-4 sm:px-6 py-3 sm:py-4 text-sm font-black text-hc-text outline-none shadow-inner rounded-xl" />
            </div>
            <div className="flex-1 min-w-[160px] sm:min-w-[200px] space-y-2 sm:space-y-3">
              <label className="text-[9px] sm:text-[10px] font-black text-hc-muted uppercase tracking-widest ml-1">Location</label>
              <SearchSelect
                options={[...HAZELCARE_HOUSES, ...customHouses].map(h => ({ value: h, label: h }))}
                value={house} onChange={setHouse}
                allowCustom onAddCustom={v => setCustomHouses(addCustomHouse(v))}
              />
            </div>
            <div className="px-4 sm:px-8 py-3 sm:py-5 hc-clay-inset rounded-xl flex flex-col items-center">
              <span className="text-[9px] sm:text-[10px] font-black text-hc-muted uppercase opacity-60 mb-1">Words</span>
              <span className="text-lg sm:text-xl font-black text-hc-teal tabular-nums">{wordCount}</span>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mt-4 sm:mt-6 hc-clay-raised p-4 sm:p-6 space-y-4">
            <div className="text-[9px] sm:text-[10px] font-black text-hc-muted uppercase tracking-widest">Staff Share Link</div>
            <p className="text-[10px] sm:text-[11px] font-bold text-hc-text">Generate a secure link for a staff member to submit notes from their phone. No login required.</p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[8px] sm:text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1 mb-1 block">Staff email (optional)</label>
                <input value={staffEmail} onChange={e => setStaffEmail(e.target.value)} placeholder="staff@email.com" type="email"
                  className="w-full hc-clay-inset px-4 py-3 sm:py-3.5 text-sm font-bold text-hc-text outline-none shadow-inner rounded-xl" />
              </div>
              <button onClick={() => void issueStaffLink()} disabled={sharing}
                className="px-5 py-3 sm:py-3.5 rounded-xl btn-tactical text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 shrink-0"
              >
                <Link2 className={`w-3.5 h-3.5 ${sharing ? 'animate-pulse' : ''}`} />
                {sharing ? 'Generating...' : 'Generate Link'}
              </button>
            </div>

            {shareLink && (
              <div className="p-3 sm:p-4 hc-clay-inset rounded-2xl space-y-2">
                {sentEmail && <p className="text-[9px] sm:text-[10px] font-black text-flag-green uppercase tracking-widest">Link sent to {staffEmail}</p>}
                <div className="text-[9px] sm:text-[10px] font-black text-hc-muted uppercase tracking-widest">Access Code: <span className="text-hc-text text-[11px] tracking-[0.2em]">{shareCode}</span></div>
                <div className="text-[10px] sm:text-[11px] font-bold text-hc-text break-all">{shareLink}</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { void navigator.clipboard.writeText(shareLink); setCopiedShare(true); setTimeout(() => setCopiedShare(false), 2000); }}
                    className={`px-3 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                      copiedShare ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'
                    }`}>
                    {copiedShare ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedShare ? 'Copied' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent('Care Note Request — Access Link');
                      const body = encodeURIComponent(`Open this link to submit your care note:\n${shareLink}\n\nAccess code: ${shareCode}\n\nThis link and code expire shortly, so open it soon.`);
                      const to = encodeURIComponent(staffEmail || '');
                      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`, '_blank', 'noopener');
                    }}
                    className="px-3 sm:px-4 py-2 rounded-xl hc-clay-raised text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-hc-text hover:text-hc-teal"
                  >
                    <Mail className="w-3 h-3" /> Open in Gmail
                  </button>
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent('Care Note Request — Access Link');
                      const body = encodeURIComponent(`Open this link to submit your care note:\n${shareLink}\n\nAccess code: ${shareCode}\n\nThis link and code expire shortly, so open it soon.`);
                      const to = encodeURIComponent(staffEmail || '');
                      window.open(`https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}`, '_blank', 'noopener');
                    }}
                    className="px-3 sm:px-4 py-2 rounded-xl hc-clay-raised text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-hc-text hover:text-hc-teal"
                  >
                    <Mail className="w-3 h-3" /> Open in Outlook
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'workspace' && <div className="-mx-4 sm:-mx-6 lg:-mx-12"><NoteWorkspace /></div>}
      {activeTab === 'templates' && <div className="-mx-4 sm:-mx-6 lg:-mx-12"><TemplatesPage weekData={null} /></div>}
    </div>
  );
}
