import { useState, useMemo, useEffect } from 'react';
import { 
  MessageSquare, Clipboard, Search, Terminal, Zap, Trash2, CheckCircle, 
  Clock, Phone, AlertCircle, Calendar, XCircle, ShieldAlert,
  Activity, Layers, HelpCircle
} from 'lucide-react';
import type { InterceptedIntel, InterceptVector } from '../lib/types';

export function CommunicationsPage() {
  const [rawText, setRawText] = useState('');
  const [intel, setIntel] = useState<InterceptedIntel[]>(() => {
    try {
      const saved = localStorage.getItem('hc-intercept-cache');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<InterceptVector | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [parseError, setParseError] = useState(false);

  // SESSION PERSISTENCE ANCHOR
  useEffect(() => {
    localStorage.setItem('hc-intercept-cache', JSON.stringify(intel));
  }, [intel]);


  const stats = useMemo(() => {
    return {
      total: intel.length,
      alerts: intel.filter(m => m.type === 'alert').length,
      leave: intel.filter(m => m.type === 'leave').length,
      gaps: intel.filter(m => m.type === 'gap').length,
      messages: intel.filter(m => m.type === 'message').length,
    };
  }, [intel]);

  const filteredIntel = useMemo(() => {
    let out = intel;
    if (filterType !== 'all') out = out.filter(m => m.type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      out = out.filter(m => 
        m.sender.toLowerCase().includes(q) || 
        m.content.toLowerCase().includes(q) ||
        (m.phone && m.phone.includes(q))
      );
    }
    return out;
  }, [intel, filterType, searchQuery]);

  function handleIntercept() {
    if (!rawText.trim()) return;

    const newIntel: InterceptedIntel[] = [];
    const text = rawText;

    // --- VECTOR 1: NOTICES & CLINICAL ALERTS ---
    const noticesMatch = text.match(/Notices([\s\S]*?)(?:View all notices|Birthdays)/);
    if (noticesMatch) {
      const section = noticesMatch[1];
      const items = section.split(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}(?:new)?/).filter(i => i.trim());
      items.forEach(item => {
        const lines = item.trim().split('\n').map(l => l.trim()).filter(l => l);
        const title = lines[0] || 'Unknown Notice';
        const body = lines.slice(1).join('\n');
        
        let draft = "Acknowledged. Clinical Lead notified for audit.";
        if (title.toUpperCase().includes('MEDICATION ALERT')) {
          const clientMatch = body.match(/recorded for (.*?) by/);
          const client = clientMatch ? clientMatch[1] : 'Unknown';
          draft = `CRITICAL: Medication discrepancy detected for ${client}. Incident report workflow initialised. Please verify remaining stock immediately.`;
        }

        newIntel.push({
          id: `alert-${Math.random().toString(36).substr(2, 9)}`,
          type: 'alert',
          timestamp: 'RECENT',
          sender: 'SYSTEM_ALERT',
          content: `${title}\n${body}`,
          category: title.toUpperCase().includes('ALERT') ? 'critical' : 'general',
          draft,
          meta: { priority: title.toUpperCase().includes('ALERT') ? 'critical' : 'medium' }
        });
      });
    }

    // --- VECTOR 2: LEAVE REQUESTS ---
    const leaveMatch = text.match(/Outstanding Time Off Requests([\s\S]*?)Incoming Texts/);
    if (leaveMatch) {
      const section = leaveMatch[1];
      const lines = section.split('\n').map(l => l.trim()).filter(l => l && !l.includes('Respond'));
      lines.forEach(line => {
        const parts = line.split('\t'); 
        if (parts.length >= 4) {
          const [name, start, end, type] = parts;
          newIntel.push({
            id: `leave-${Math.random().toString(36).substr(2, 9)}`,
            type: 'leave',
            timestamp: 'PENDING',
            sender: name,
            content: `${type}: ${start} to ${end}`,
            category: type.toLowerCase(),
            draft: `Hi ${name.split(' ')[0]}, we've received your request for ${type} (${start} - ${end}). I've relayed this to the Operations Manager to check the rota coverage. We'll update you once validated.`,
            meta: { dateRange: `${start} - ${end}` }
          });
        }
      });
    }

    // --- VECTOR 3: OPERATIONAL GAPS ---
    const diaryMatch = text.match(/Today's diary([\s\S]*)$/);
    if (diaryMatch) {
      const section = diaryMatch[1];
      const items = section.split(/\r?\n\r?\n/).filter(i => i.toLowerCase().includes('- uncompleted'));
      items.forEach(item => {
        const lines = item.trim().split('\n').map(l => l.trim()).filter(l => l);
        const taskLine = lines.find(l => l.toLowerCase().includes('- uncompleted')) || '';
        const clientLine = lines.find(l => l.startsWith('Clients:')) || '';
        const staffLine = lines.find(l => l.startsWith('Created by:')) || '';

        const task = taskLine.replace(/Created on.*/, '').trim();
        const client = clientLine.replace('Clients:', '').trim();
        const staff = staffLine.replace('Created by:', '').trim();

        newIntel.push({
          id: `gap-${Math.random().toString(36).substr(2, 9)}`,
          type: 'gap',
          timestamp: 'LIVE',
          sender: staff || 'Unknown Staff',
          content: `FAILED_TASK: ${task}`,
          category: 'operational_failure',
          draft: `Hi ${staff.split(' ')[0]}, I see the "${task}" for ${client} is marked as uncompleted. Can you confirm if this was delayed or if there was a barrier to completion? We need this updated for the clinical record.`,
          meta: { client, uncompletedTask: task, priority: 'high' }
        });
      });
    }

    // --- VECTOR 4: INCOMING TEXTS ---
    const sectionStart = text.indexOf('Incoming Texts');
    if (sectionStart !== -1) {
      const content = text.substring(sectionStart + 'Incoming Texts'.length).split(/Birthdays|Today's diary/)[0];
      const messages = content.split(/\breply\b/i).filter(p => p.trim());
      messages.forEach(msg => {
        const lines = msg.trim().split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length >= 2) {
          const timestamp = lines[0];
          const senderLine = lines[1];
          const body = lines.slice(2).join('\n');
          const nameMatch = senderLine.match(/^(.*?)(?:\s*\((.*?)\))?$/);
          const name = nameMatch ? nameMatch[1].trim() : senderLine;
          const phone = nameMatch ? nameMatch[2] : undefined;

          let category = 'general';
          const low = body.toLowerCase();
          if (low.includes('rota') || low.includes('shift')) category = 'rota';
          else if (low.includes('pay') || low.includes('money') || low.includes('timesheet')) category = 'finance';

          const firstName = name.split(' ')[0];
          let draft = `Hi ${firstName}, received. Relayed for review.`;
          if (category === 'rota') draft = `Hi ${firstName}, thanks for the rota update. Relayed to the Rota Manager.`;
          if (category === 'finance') draft = `Hi ${firstName}, thanks. Pushed to Finance Unit to verify against payroll records.`;

          newIntel.push({
            id: `msg-${Math.random().toString(36).substr(2, 9)}`,
            type: 'message',
            timestamp,
            sender: name,
            phone,
            content: body,
            category,
            draft
          });
        }
      });
    }

    if (newIntel.length === 0) {
      setParseError(true);
      setTimeout(() => setParseError(false), 5000);
      return;
    }

    setIntel([...newIntel, ...intel].slice(0, 500));
    setRawText('');
  }

  function copyDraft(msg: InterceptedIntel) {
    void navigator.clipboard.writeText(msg.draft);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col bg-hc-bone font-mono">
      {/* Header telemetry */}
      <div className="px-8 py-5 border-b border-hc-border flex items-center justify-between hc-clay-raised m-4">
        <div>
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-hc-teal" />
            <h1 className="text-xl font-black text-hc-text tracking-widest uppercase">COMMS_INTERCEPT</h1>
          </div>
          <p className="text-[11px] font-bold text-hc-muted uppercase tracking-[0.3em] mt-1 ml-9">Multi-Vector Operational Intel Hub</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setShowGuide(!showGuide)}
            className="flex flex-col items-center justify-center px-4 hc-clay-raised hover:bg-hc-clay-dark transition-all rounded group"
          >
            <HelpCircle className="w-4 h-4 text-hc-teal mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-black text-hc-muted uppercase">Guide</span>
          </button>
          {[
            { label: 'ALERTS', count: stats.alerts, color: 'text-hc-red', bg: 'bg-hc-red/10' },
            { label: 'GAPS', count: stats.gaps, color: 'text-hc-amber', bg: 'bg-hc-amber/10' },
            { label: 'LEAVE', count: stats.leave, color: 'text-hc-sage', bg: 'bg-hc-sage/10' },
            { label: 'TEXTS', count: stats.messages, color: 'text-hc-teal', bg: 'bg-hc-teal/10' }
          ].map(s => (
            <div key={s.label} className={`px-4 py-2 ${s.bg} border border-hc-border rounded-xl flex flex-col items-center min-w-[70px]`}>
              <span className={`text-[11px] font-black uppercase opacity-60 ${s.color}`}>{s.label}</span>
              <span className={`text-[11px] font-black tabular-nums ${s.color}`}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden px-4 pb-4 gap-4">
        {/* Left: Input Terminals */}
        <div className="w-[450px] hc-clay-inset p-6 flex flex-col gap-6">
          
          {showGuide && (
            <div className="bg-hc-teal/10 border border-hc-teal/20 p-4 rounded-lg animate-in fade-in duration-300">
              <div className="text-[11px] font-black text-hc-teal uppercase mb-2">SYSTEM_GUIDANCE</div>
              <p className="text-[11px] text-hc-muted leading-relaxed uppercase">
                1. Navigate to your source operational dashboard.<br/>
                2. Press <span className="text-hc-text font-black">CTRL+A</span> then <span className="text-hc-text font-black">CTRL+C</span>.<br/>
                3. Paste the entire dump into the terminal below.<br/>
                4. Press <span className="text-hc-text font-black">SYNTHESIZE</span> to extract actionable intel.
              </p>
            </div>
          )}

          {parseError && (
            <div className="bg-flag-red/10 border border-flag-red/30 p-3 rounded-xl animate-in fade-in duration-300">
              <div className="text-[10px] font-black text-flag-red uppercase tracking-widest">Signal Loss — No intel detected</div>
              <p className="text-[10px] text-hc-muted mt-1">Ensure you pasted the full dashboard dump including section headers (Notices, Incoming Texts, etc.)</p>
            </div>
          )}

          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-4 h-4 text-hc-teal" />
              <h2 className="text-[11px] font-black text-hc-text uppercase tracking-widest">INGESTION_STREAM</h2>
            </div>
            <div className="relative flex-1 group">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="PROMPT: PASTE FULL DASHBOARD DUMP HERE..."
                className="w-full h-full bg-hc-bone hc-clay-inset rounded-lg p-5 text-[11px] font-mono text-hc-text focus:ring-2 ring-hc-teal/30 outline-none resize-none transition-all placeholder:text-hc-muted/30"
              />
              <div className="absolute top-4 right-4 pointer-events-none opacity-5 group-hover:opacity-10 transition-opacity">
                <ShieldAlert className="w-12 h-12 text-hc-text" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleIntercept}
              disabled={!rawText.trim()}
              className="flex-1 py-4 btn-tactical text-xs font-black uppercase tracking-[0.3em] rounded-lg transition-all shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-20"
            >
              <Zap className="w-4 h-4 fill-current" />
              SYNTHESIZE
            </button>
            {intel.length > 0 && (
              <button
                onClick={() => setIntel([])}
                title="Clear all intel"
                className="px-4 py-4 hc-clay-raised border border-hc-border rounded-lg text-hc-muted hover:text-flag-red transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Intelligence Matrix */}
        <div className="flex-1 flex flex-col bg-transparent">
          <div className="p-4 hc-clay-raised mb-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {[
                { id: 'all', label: 'ALL_VECTORS' },
                { id: 'alert', label: 'CRITICAL_ALERTS' },
                { id: 'gap', label: 'OPS_GAPS' },
                { id: 'leave', label: 'LEAVE_LOG' },
                { id: 'message', label: 'COMMS' }
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${filterType === f.id ? 'bg-hc-teal text-hc-bone shadow-inner' : 'text-hc-muted hover:bg-hc-clay-dark hover:text-hc-text'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-hc-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH_TELEMETRY..."
                className="w-full bg-hc-bone hc-clay-inset rounded-xl px-9 py-2 text-[11px] font-black text-hc-text outline-none focus:ring-2 ring-hc-teal/30 transition-all font-mono"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin">
            {filteredIntel.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <Activity className="w-16 h-16 mb-4 text-hc-muted" />
                <p className="text-sm font-black uppercase tracking-[0.5em] text-hc-muted">Ledger_Empty</p>
              </div>
            )}
            {filteredIntel.map((item) => (
              <div key={item.id} className="group animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="hc-clay-raised rounded-2xl overflow-hidden hover:scale-[1.01] transition-all flex h-42 shadow-xl">
                  {/* Vector Accent */}
                  <div className={`w-1 shrink-0 ${
                    item.type === 'alert' ? 'bg-hc-red' : 
                    item.type === 'gap' ? 'bg-hc-amber' : 
                    item.type === 'leave' ? 'bg-hc-sage' : 'bg-hc-teal'
                  }`} />
                  
                  <div className="flex-1 flex overflow-hidden">
                    {/* Left: Intelligence Detail */}
                    <div className="flex-1 p-5 flex flex-col border-r border-hc-border/50 overflow-hidden">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            item.type === 'alert' ? 'bg-hc-red/20 text-hc-red' : 
                            item.type === 'gap' ? 'bg-hc-amber/20 text-hc-amber' : 
                            item.type === 'leave' ? 'bg-hc-sage/20 text-hc-sage' : 'bg-hc-teal/20 text-hc-teal'
                          }`}>
                            {item.type === 'alert' && <AlertCircle className="w-4 h-4" />}
                            {item.type === 'gap' && <XCircle className="w-4 h-4" />}
                            {item.type === 'leave' && <Calendar className="w-4 h-4" />}
                            {item.type === 'message' && <MessageSquare className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-[11px] font-black text-hc-text tracking-tight uppercase tabular-nums">{item.sender}</div>
                            <div className="flex items-center gap-3 mt-0.5">
                              {item.phone && (
                                <div className="flex items-center gap-1 text-[11px] font-bold text-hc-muted uppercase tracking-widest">
                                  <Phone className="w-2.5 h-2.5" /> {item.phone}
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-[11px] font-bold text-hc-muted uppercase tracking-widest">
                                <Clock className="w-2.5 h-2.5" /> {item.timestamp}
                              </div>
                            </div>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-[0.2em] border ${
                          item.type === 'alert' ? 'bg-hc-red/10 text-hc-red border-hc-red/20' : 
                          item.type === 'gap' ? 'bg-hc-amber/10 text-hc-amber border-hc-amber/20' : 
                          item.type === 'leave' ? 'bg-hc-sage/10 text-hc-sage border-hc-sage/20' : 'bg-hc-teal/10 text-hc-teal border-hc-teal/20'
                        }`}>
                          {item.type === 'gap' ? 'OPERATIONAL_FAILURE' : item.type}
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto scrollbar-thin text-[11px] text-hc-text/80 font-medium leading-relaxed pr-3 font-mono">
                        {item.content.split('\n').map((line, i) => (
                          <div key={i} className="mb-0.5 last:mb-0">
                            {line.startsWith('FAILED_TASK:') ? <span className="text-hc-amber font-black">{line}</span> : line}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Command Draft */}
                    <div className="w-[320px] hc-clay-inset m-2 p-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                         <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em] flex items-center gap-2">
                           <Zap className="w-3.5 h-3.5" /> TACTICAL_DRAFT
                         </div>
                         <button 
                           onClick={() => setIntel(intel.filter(i => i.id !== item.id))}
                           className="text-hc-muted hover:text-hc-red transition-colors"
                         >
                           <Trash2 className="w-3" />
                         </button>
                      </div>
                      <div className="flex-1 bg-hc-bone/50 hc-clay-inset rounded-xl p-3 text-[11px] font-mono text-hc-teal leading-relaxed shadow-inner overflow-y-auto scrollbar-thin italic">
                        {item.draft}
                      </div>
                      <button 
                        onClick={() => copyDraft(item)}
                        className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-[11px] uppercase tracking-[0.2em] shadow-xl ${
                          copiedId === item.id ? 'bg-hc-teal text-hc-bone' : 'hc-clay-raised text-hc-text hover:bg-hc-clay-dark'
                        }`}
                      >
                        {copiedId === item.id ? <CheckCircle className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
                        {copiedId === item.id ? 'COPIED' : 'COPY_DRAFT'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
