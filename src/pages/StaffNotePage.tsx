import { useState, useEffect } from 'react';
import { uid } from '../lib/storage';

// ============================================================
// NOTE TYPES WITH GUIDED PROMPTS
// ============================================================
interface NoteType {
  id: string;
  label: string;
  color: string;
  prompts: { key: string; label: string; placeholder: string; required?: boolean }[];
}

const NOTE_TYPES: NoteType[] = [
  {
    id: 'daily_support',
    label: 'Daily 1:1 Support',
    color: '#14b8a6',
    prompts: [
      { key: 'mood', label: 'How was the client\'s mood and presentation?', placeholder: 'e.g. Client appeared calm and engaged, good eye contact...', required: true },
      { key: 'activities', label: 'What activities or support was provided?', placeholder: 'e.g. Supported with personal care, attended community group...' },
      { key: 'concerns', label: 'Any concerns or observations?', placeholder: 'e.g. Mentioned feeling anxious about upcoming appointment...' },
      { key: 'followup', label: 'Follow-up actions needed?', placeholder: 'e.g. Monitor mood, remind about Thursday appointment...' },
    ],
  },
  {
    id: 'handover',
    label: 'Handover Note',
    color: '#3b82f6',
    prompts: [
      { key: 'events', label: 'Key events this shift?', placeholder: 'e.g. Quiet shift overall. Client A attended day centre...', required: true },
      { key: 'outstanding', label: 'Outstanding tasks for next shift?', placeholder: 'e.g. Medication round at 20:00, laundry needs completing...' },
      { key: 'clients', label: 'Client updates?', placeholder: 'e.g. Client B refused dinner, offered alternative. Client C had good day...' },
      { key: 'nextshift', label: 'Anything for incoming staff to know?', placeholder: 'e.g. GP calling back about Client A tomorrow morning...' },
    ],
  },
  {
    id: 'medication',
    label: 'Medication',
    color: '#0891b2',
    prompts: [
      { key: 'what', label: 'Which medication and client?', placeholder: 'e.g. Olanzapine 10mg — Jamie Morton', required: true },
      { key: 'status', label: 'Was it administered, refused, or missed?', placeholder: 'e.g. Refused at 08:00, attempted again at 09:30...' },
      { key: 'reason', label: 'Reason if refused/missed?', placeholder: 'e.g. Client said they didn\'t want it, appeared drowsy...' },
      { key: 'action', label: 'Action taken?', placeholder: 'e.g. GP informed by phone. Will attempt at lunchtime. MAR chart updated.' },
    ],
  },
  {
    id: 'incident',
    label: 'Incident / Accident',
    color: '#ef4444',
    prompts: [
      { key: 'what', label: 'What happened?', placeholder: 'e.g. Client fell in bathroom while getting out of shower...', required: true },
      { key: 'when', label: 'When did it happen (date/time)?', placeholder: 'e.g. 12/03/2026 at approximately 06:30' },
      { key: 'who', label: 'Who was involved?', placeholder: 'e.g. Client: Jamie Morton. Staff present: Sarah Mitchell...' },
      { key: 'injuries', label: 'Any injuries?', placeholder: 'e.g. Small bruise on left forearm. No head injury. Client alert and oriented.' },
      { key: 'action', label: 'What action was taken?', placeholder: 'e.g. First aid administered. Ice pack applied. GP notified by phone...' },
      { key: 'notified', label: 'Who was notified?', placeholder: 'e.g. House coordinator, on-call manager, GP surgery, family (NOK)...' },
    ],
  },
  {
    id: 'safeguarding',
    label: 'Safeguarding',
    color: '#be185d',
    prompts: [
      { key: 'concern', label: 'What is the safeguarding concern?', placeholder: 'e.g. Client disclosed that another resident made threatening comments...', required: true },
      { key: 'who', label: 'Who is involved?', placeholder: 'e.g. Alleged victim: Robert Ellis. Alleged perpetrator: unnamed resident...' },
      { key: 'disclosure', label: 'How was it disclosed/discovered?', placeholder: 'e.g. Client told staff member during 1:1 session...' },
      { key: 'action', label: 'Immediate actions taken?', placeholder: 'e.g. Ensured client safety. Statements taken. Manager notified...' },
      { key: 'referral', label: 'Referrals made?', placeholder: 'e.g. Local authority safeguarding team contacted. Reference number pending...' },
    ],
  },
  {
    id: 'task_note',
    label: 'Task Note',
    color: '#f59e0b',
    prompts: [
      { key: 'task', label: 'What task was completed?', placeholder: 'e.g. Weekly food shop, maintenance request, cleaning...', required: true },
      { key: 'details', label: 'Details?', placeholder: 'e.g. All items on menu plan purchased. Budget: £85.20. Receipts filed...' },
      { key: 'followup', label: 'Any follow-up needed?', placeholder: 'e.g. Need to order special dietary items for Client C by Thursday...' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance / Expenses',
    color: '#059669',
    prompts: [
      { key: 'type', label: 'Type of transaction?', placeholder: 'e.g. Petty cash, mileage claim, client expenses...', required: true },
      { key: 'amount', label: 'Amount and details?', placeholder: 'e.g. £47.32 petty cash reconciled. All receipts present...' },
      { key: 'authorised', label: 'Authorised by?', placeholder: 'e.g. Signed off by house coordinator Sarah Mitchell' },
    ],
  },
  {
    id: 'supervision',
    label: 'Supervision',
    color: '#7c3aed',
    prompts: [
      { key: 'staff', label: 'Staff member supervised?', placeholder: 'e.g. Amy Rogers — Support Worker', required: true },
      { key: 'discussed', label: 'Topics discussed?', placeholder: 'e.g. Workload manageable. Discussed de-escalation training needs...' },
      { key: 'development', label: 'Development/training needs?', placeholder: 'e.g. Refresher on medication administration. First aid renewal due June...' },
      { key: 'actions', label: 'Actions agreed?', placeholder: 'e.g. Book onto conflict management course. Shadow senior for medication round...' },
      { key: 'next', label: 'Next supervision date?', placeholder: 'e.g. 4 weeks — 09/04/2026' },
    ],
  },
];

// ============================================================
// FLAG DETECTION (inline — matches nourish-parser)
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

// ============================================================
// COMPONENT
// ============================================================
const HOUSES = ['Lingfield House','Church House','Laurel House','Station House','Canterbury','Glenfrome House','Woburn House','Hazelbury House','Courtney Lodge','Cottrell House'];

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

  // Reset answers when type changes
  useEffect(() => { setAnswers({}); }, [selectedType.id]);

  function setAnswer(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  // ============================================================
  // GENERATE PROFESSIONAL NOTE
  // ============================================================
  function generateNote(): string {
    if (mode === 'free') return freeText;

    const now = new Date();
    const parts: string[] = [];

    // Header
    parts.push(`${selectedType.label} — ${house}`);
    if (client) parts.push(`Client: ${client}`);
    parts.push(`Date: ${now.toLocaleDateString('en-GB')} at ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
    parts.push('');

    // Build professional note from answers
    for (const prompt of selectedType.prompts) {
      const answer = answers[prompt.key]?.trim();
      if (!answer) continue;

      // Transform into professional care language
      let text = answer;
      // Capitalize first letter
      text = text.charAt(0).toUpperCase() + text.slice(1);
      // Ensure ends with period
      if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) text += '.';

      parts.push(text);
    }

    if (parts.length <= 3) return ''; // Only header, no content

    parts.push('');
    parts.push(`Recorded by staff via Hazelcare Ops Engine — ${now.toLocaleDateString('en-GB')}`);

    return parts.join('\n');
  }

  const generatedNote = generateNote();
  const allText = mode === 'guided' ? Object.values(answers).join(' ') : freeText;
  const flagResult = detectFlags(allText);
  const wordCount = generatedNote.trim() ? generatedNote.trim().split(/\s+/).length : 0;

  function copyNote() {
    if (!generatedNote) return;
    navigator.clipboard.writeText(generatedNote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveNote() {
    if (!generatedNote) return;
    const note: SavedNote = { id: uid(), type: selectedType.label, house, client, text: generatedNote, date: new Date().toLocaleDateString('en-GB') };
    const updated = [note, ...savedNotes].slice(0, 100);
    setSavedNotes(updated);
    saveNotes(updated);
    // Reset
    setAnswers({});
    setFreeText('');
    setClient('');
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Staff Note Assistant</h1>
        <p className="text-hc-muted text-sm">Write professional care notes in seconds. Guided prompts help you capture everything that matters.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — Input (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Note type selector */}
          <div className="bg-hc-card border border-hc-border rounded-xl p-4">
            <div className="text-[10px] text-hc-muted uppercase tracking-wider font-semibold mb-2">Note Type</div>
            <div className="grid grid-cols-4 gap-1.5">
              {NOTE_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-[11px] transition-all ${
                    selectedType.id === type.id
                      ? 'font-semibold glow-teal'
                      : 'border-hc-border text-hc-muted hover:text-white hover:border-hc-border-light'
                  }`}
                  style={selectedType.id === type.id ? { color: type.color, borderColor: `${type.color}40`, background: `${type.color}08` } : {}}
                >
                  {type.label}
                </button>
              ))}
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
                <label className="text-[10px] text-hc-muted uppercase tracking-wider font-semibold mb-1 block">Client Name</label>
                <input value={client} onChange={e => setClient(e.target.value)} placeholder="e.g. Jamie Morton" className="w-full bg-hc-dark border border-hc-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-hc-muted/50 focus:outline-none focus:border-hc-teal-light" />
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
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: `${selectedType.color}15`, color: selectedType.color }}>
                      {i + 1}
                    </span>
                    {prompt.label}
                    {prompt.required && <span className="text-flag-red text-[10px]">*</span>}
                  </label>
                  <textarea
                    value={answers[prompt.key] || ''}
                    onChange={e => setAnswer(prompt.key, e.target.value)}
                    placeholder={prompt.placeholder}
                    className="w-full bg-hc-dark border border-hc-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-hc-muted/40 focus:outline-none focus:border-hc-teal-light resize-none leading-relaxed"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-hc-card border border-hc-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs font-semibold text-white">Free Text Note</label>
                <div className="flex items-center gap-1.5 ml-auto text-[10px] text-hc-muted">
                  <svg className="w-3.5 h-3.5 text-hc-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  Voice input — coming soon
                </div>
              </div>
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="Type your care note here. Write naturally — just describe what happened, what you observed, and what action you took..."
                className="w-full bg-hc-dark border border-hc-border rounded-lg px-3 py-3 text-sm text-white placeholder:text-hc-muted/40 focus:outline-none focus:border-hc-teal-light resize-y leading-relaxed"
                rows={8}
              />
            </div>
          )}

          {/* Flag warning */}
          {flagResult.severity !== 'none' && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${
              flagResult.severity === 'red'
                ? 'bg-flag-red/5 border-flag-red/25 glow-red'
                : 'bg-flag-amber/5 border-flag-amber/25 glow-amber'
            }`}>
              <svg className={`w-5 h-5 shrink-0 mt-0.5 ${flagResult.severity === 'red' ? 'text-flag-red' : 'text-flag-amber'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              <div>
                <div className="text-xs font-semibold text-white mb-1">
                  {flagResult.severity === 'red' ? 'Red Flag Detected' : 'Amber Flag Detected'}
                </div>
                <div className="text-[11px] text-hc-muted mb-2">
                  {flagResult.severity === 'red'
                    ? 'This note contains keywords that require immediate manager attention.'
                    : 'This note contains keywords that should be monitored.'}
                </div>
                <div className="flex flex-wrap gap-1">
                  {flagResult.flags.map((f, i) => (
                    <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full border ${
                      flagResult.severity === 'red' ? 'bg-flag-red/10 text-flag-red border-flag-red/20' : 'bg-flag-amber/10 text-flag-amber border-flag-amber/20'
                    }`}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — Preview (2/5) */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 space-y-4">
            {/* Generated note */}
            <div className="bg-hc-card border border-hc-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-hc-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Generated Note</div>
                    <div className="text-[10px] text-hc-muted">
                      {wordCount} words · ~{Math.max(1, Math.ceil(wordCount / 200))} min read
                    </div>
                  </div>
                  {flagResult.severity !== 'none' && (
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${
                      flagResult.severity === 'red' ? 'bg-flag-red/15 text-flag-red animate-pulse-soft' : 'bg-flag-amber/15 text-flag-amber'
                    }`}>
                      {flagResult.severity.toUpperCase()} FLAG
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 min-h-[200px]">
                {generatedNote ? (
                  <pre className="text-xs text-hc-text font-mono leading-relaxed whitespace-pre-wrap">{generatedNote}</pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-hc-muted">
                    <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <div className="text-xs text-center">Start filling in the prompts<br/>to see your note build in real-time</div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="p-4 border-t border-hc-border flex gap-2">
                <button
                  onClick={copyNote}
                  disabled={!generatedNote}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-30 ${
                    copied ? 'bg-flag-green text-white' : 'bg-hc-teal text-white hover:bg-hc-teal-light glow-teal'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Copy to Clipboard
                    </>
                  )}
                </button>
                <button
                  onClick={saveNote}
                  disabled={!generatedNote}
                  className="px-4 py-2.5 bg-hc-card border border-hc-border text-sm text-hc-muted rounded-xl hover:text-white hover:border-hc-border-light disabled:opacity-30"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Tip */}
            <div className="bg-hc-teal/5 border border-hc-teal/20 rounded-xl p-3.5">
              <div className="text-[10px] font-semibold text-hc-teal-light mb-1">Tip for staff</div>
              <div className="text-[10px] text-hc-muted leading-relaxed">
                Answer each prompt in your own words — even short answers work. The system builds a professional note you can copy straight into Nourish. Don't worry about perfect English or formatting.
              </div>
            </div>

            {/* History */}
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
                          <button
                            onClick={() => { navigator.clipboard.writeText(note.text); }}
                            className="text-[10px] text-hc-muted hover:text-hc-teal-light opacity-0 group-hover:opacity-100 transition-all"
                          >
                            Copy
                          </button>
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
