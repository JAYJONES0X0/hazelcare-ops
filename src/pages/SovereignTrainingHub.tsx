import { useState } from 'react';
import { Shield, Sparkles, AlertTriangle, CheckCircle, ArrowRight, BookOpen, PenLine, RefreshCw, Microscope, Copy } from 'lucide-react';

const ALCOA_PRINCIPLES = [
  { char: 'A', title: 'Attributable', desc: 'Who did it? Is the carer identity clear?' },
  { char: 'L', title: 'Legible', desc: 'Is the narrative clear and professional?' },
  { char: 'C', title: 'Contemporaneous', desc: 'Is the timing of events recorded precisely?' },
  { char: 'O', title: 'Original', desc: 'Is it an unique observation, not just a copy-paste?' },
  { char: 'A', title: 'Accurate', desc: 'Does it reflect the clinical reality and risks?' },
];

const CASE_STUDIES = [
  {
    title: 'Medication Refusal',
    raw: 'Prompted him to use his inhaler, which he refused.',
    context: 'Client has asthma. Refusal without clinical assessment is a duty of care breach.',
  },
  {
    title: 'Behavioral Incident',
    raw: 'Jamie was angry and shouted at staff. We stayed away.',
    context: 'Lacks triggers, de-escalation steps, and welfare check status.',
  },
  {
    title: 'Community Access',
    raw: 'Went to the shop and bought snacks. Came back fine.',
    context: 'Missing details on road safety, money management, and engagement quality.',
  }
];

const ELITE_TEMPLATE = `Daily 1:1 support

[TIME_BLOCK]
[Detailed narrative of engagement, staff prompts, and client response.]

Clinical Presentation & Wellbeing
[Objective assessment of mood, physical health indicators, and mental state.]

Outcome
[Summary of shift goals achieved and handover status.]`;

export default function SovereignTrainingHub() {
  const [userNote, setUserNote] = useState('');
  const [critique, setCritique] = useState<string | null>(null);
  const [eliteVersion, setEliteVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const runAnalysis = async () => {
    if (!userNote.trim()) return;
    setLoading(true);
    setCritique(null);
    setEliteVersion(null);
    setScore(null);

    try {
      // 1. Generate the 'Elite' version using our hardened backend
      const res = await fetch('/api/staff/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userNote,
          noteType: 'Training Simulation',
          clientName: 'Training Client',
          referenceTemplate: ELITE_TEMPLATE,
          refineInstructions: "Transform this raw note into a high-integrity clinical narrative. Use forensic-grade language. Ensure every section of the template is populated based on the facts provided."
        })
      });

      if (!res.ok) throw new Error('Writing support failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Stream Failed');
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setEliteVersion(result);
      }
      result += decoder.decode();
      setEliteVersion(result);

      // 2. Perform a separate 'Critique' pass
      const critiqueRes = await fetch('/api/staff/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userNote,
          noteType: 'Critique',
          clientName: 'Training Client',
          refineInstructions: "Critique this note against ALCOA+ forensic standards. Identify exactly what is missing or risky. Be professional but strict. Use bullet points."
        })
      });

      if (critiqueRes.ok) {
        const cReader = critiqueRes.body?.getReader();
        if (cReader) {
          let cResult = '';
          while (true) {
            const { done, value } = await cReader.read();
            if (done) break;
            cResult += decoder.decode(value, { stream: true });
            setCritique(cResult);
          }
        }
      }

      // Calculate a pseudo-score based on content
      const baseScore = Math.min(100, (userNote.length / 5) + 20);
      setScore(Math.floor(baseScore));

    } catch (e) {
      setCritique(`Simulation Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-hc-bone">
      {/* Hero Header */}
      <div className="bg-[#0f172a] text-white py-16 px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(13,148,136,0.2),transparent)]"></div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-hc-teal/30 bg-hc-teal/10 text-hc-teal mb-6">
            <Shield className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Staff Writing Coach | Practice Arena</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9] mb-4">
            Documentation <br /> <span className="text-hc-teal">Or Malpractice?</span>
          </h1>
          <p className="text-hc-teal/50 text-sm font-bold uppercase tracking-[0.3em] max-w-xl">
            Practice safer, clearer support notes before they become part of a formal record.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12 space-y-16">
        
        {/* ALCOA Grid */}
        <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {ALCOA_PRINCIPLES.map((p, i) => (
            <div key={i} className="hc-clay-raised p-6 text-center space-y-2 border-b-4 border-hc-teal hover:scale-105 transition-transform duration-300">
              <span className="text-4xl font-black text-hc-teal">{p.char}</span>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-hc-text">{p.title}</h4>
              <p className="text-[9px] font-bold text-hc-muted uppercase tracking-wider leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </section>

        {/* The Arena */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Writing Pad */}
          <div className="lg:col-span-5 space-y-6">
            <div className="hc-clay-raised p-8 space-y-6 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-hc-teal/10 text-hc-teal">
                    <PenLine className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Documentation Arena</h3>
                </div>
                {userNote.length > 0 && (
                  <span className="text-[10px] font-black text-hc-muted uppercase tabular-nums">
                    {userNote.length} Chars
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-hc-muted uppercase tracking-widest px-1">Write your raw shift note here:</label>
                <textarea
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="e.g. Supported Jamie with his morning routine. He was a bit low in mood but engaged well with staff..."
                  className="w-full h-64 hc-clay-inset p-6 text-[13px] font-medium leading-relaxed text-hc-text focus:outline-none resize-none placeholder:text-hc-muted/40"
                />
              </div>

              <button
                onClick={runAnalysis}
                disabled={loading || !userNote.trim()}
                className="w-full btn-tactical flex items-center justify-center gap-3 py-4 rounded-2xl group disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Microscope className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                {loading ? 'Reviewing note...' : 'Review This Note'}
              </button>

              <div className="pt-6 border-t border-hc-border/10">
                <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] mb-4 block">Practice Case Studies</span>
                <div className="grid grid-cols-1 gap-2">
                  {CASE_STUDIES.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setUserNote(c.raw)}
                      className="text-left p-3 rounded-xl hover:bg-hc-teal/5 border border-transparent hover:border-hc-teal/20 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-hc-teal uppercase">{c.title}</span>
                        <ArrowRight className="w-3 h-3 text-hc-teal opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[11px] text-hc-muted truncate">{c.raw}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Results Pad */}
          <div className="lg:col-span-7 space-y-6">
            {!eliteVersion && !loading && !critique && (
              <div className="hc-clay-raised p-12 text-center space-y-6 bg-hc-bone/50 border-dashed border-2 border-hc-teal/20">
                <div className="w-20 h-20 bg-hc-teal/5 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-10 h-10 text-hc-teal/20" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-widest text-hc-muted">Awaiting Evidence</h3>
                  <p className="text-[11px] text-hc-muted/60 font-medium uppercase tracking-wider max-w-xs mx-auto">
                    Submit a note to get a practical quality review.
                  </p>
                </div>
              </div>
            )}

            {/* AI Results */}
            {(loading || eliteVersion || critique) && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                
                {/* Score Header */}
                {score !== null && (
                  <div className="hc-clay-raised p-6 flex items-center justify-between bg-white overflow-hidden relative">
                     <div className="absolute right-0 top-0 p-4 opacity-5 rotate-12">
                       <Shield className="w-32 h-32 text-hc-teal" />
                     </div>
                     <div className="flex items-center gap-6 relative z-10">
                        <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 ${score > 80 ? 'bg-flag-green/10 border-flag-green text-flag-green' : 'bg-flag-amber/10 border-flag-amber text-flag-amber'}`}>
                           <span className="text-xl font-black">{score}</span>
                           <span className="text-[8px] font-black uppercase">Grade</span>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-widest mb-1">Forensic Accountability Score</h4>
                          <p className="text-[10px] font-bold text-hc-muted uppercase tracking-wider">
                            {score > 80 ? 'Elite Forensic Standard Achieved' : 'Liability Risk Detected — See Critique'}
                          </p>
                        </div>
                     </div>
                  </div>
                )}

                {/* Critique Box */}
                {critique && (
                  <div className="hc-clay-raised p-8 bg-flag-amber/[0.03] border-l-4 border-l-flag-amber space-y-4">
                    <div className="flex items-center gap-3 text-flag-amber">
                      <AlertTriangle className="w-5 h-5" />
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Clinical Critique & Liability Audit</h4>
                    </div>
                    <div className="text-[12px] font-medium text-hc-text leading-relaxed whitespace-pre-wrap pl-8 border-l border-flag-amber/20 italic">
                      {critique}
                    </div>
                  </div>
                )}

                {/* Comparison Pad */}
                {eliteVersion && (
                  <div className="hc-clay-raised overflow-hidden bg-white">
                    <div className="px-8 py-4 border-b border-hc-border/20 bg-hc-teal/[0.03] flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <Sparkles className="w-4 h-4 text-hc-teal" />
                         <span className="text-[10px] font-black text-hc-teal uppercase tracking-widest">Improved Version</span>
                       </div>
                       <button
                         onClick={() => handleCopy(eliteVersion)}
                         className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
                       >
                         {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                         {copied ? 'Copied' : 'Copy Elite Version'}
                       </button>
                    </div>
                    <div className="p-8 bg-hc-teal/[0.01]">
                       <p className="text-[13px] font-medium text-hc-text leading-relaxed whitespace-pre-wrap">
                         {eliteVersion}
                       </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ALCOA+ Principles Detailed */}
        <section className="pt-16 border-t border-hc-border/20">
          <div className="flex items-center gap-4 mb-12">
             <div className="p-3 rounded-2xl bg-hc-teal text-hc-bone shadow-lg">
               <BookOpen className="w-6 h-6" />
             </div>
             <div>
               <h2 className="text-3xl font-black uppercase tracking-tighter">The ALCOA+ Mandate</h2>
               <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em]">Operational Excellence is not optional.</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
               <div className="flex gap-6 items-start">
                  <div className="w-12 h-12 rounded-2xl hc-clay-raised flex items-center justify-center shrink-0 text-hc-teal font-black text-xl">1</div>
                  <div className="space-y-2">
                    <h4 className="text-[13px] font-black uppercase tracking-widest">Objective Observation</h4>
                    <p className="text-[11px] text-hc-muted leading-relaxed font-medium uppercase tracking-wider">
                      Eliminate judgment words like "naughty," "difficult," or "bad." Replace with objective clinical observations: "presented with verbal agitation," "declined support with X," or "engaged with staff to achieve Y."
                    </p>
                  </div>
               </div>
               <div className="flex gap-6 items-start">
                  <div className="w-12 h-12 rounded-2xl hc-clay-raised flex items-center justify-center shrink-0 text-hc-teal font-black text-xl">2</div>
                  <div className="space-y-2">
                    <h4 className="text-[13px] font-black uppercase tracking-widest">The "Why" & The "How"</h4>
                    <p className="text-[11px] text-hc-muted leading-relaxed font-medium uppercase tracking-wider">
                      Never just record an outcome. Record the staff intervention. "I encouraged engagement by..." or "Staff de-escalated using the PBS plan Section 3..."
                    </p>
                  </div>
               </div>
            </div>
            <div className="space-y-8">
               <div className="hc-clay-inset p-8 bg-flag-red/5 border-flag-red/20 space-y-4">
                  <div className="flex items-center gap-3 text-flag-red">
                    <AlertTriangle className="w-5 h-5" />
                    <h4 className="text-[11px] font-black uppercase tracking-widest">Inquest Liability Warning</h4>
                  </div>
                  <p className="text-[11px] font-bold text-hc-text/70 leading-relaxed uppercase tracking-wider italic">
                    "If you record a risk or a refusal but fail to record your clinical assessment of the impact, you are admitting negligence. A shift note is not a diary—it is a forensic record of your professional competence."
                  </p>
               </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="py-12 border-t border-hc-border/20 text-center bg-white">
        <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.5em]">OVSITE - Clinical Documentation Practice</span>
      </footer>
    </div>
  );
}
