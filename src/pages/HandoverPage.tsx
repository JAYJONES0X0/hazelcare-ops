import { useState } from 'react';
import { uid } from '../lib/storage';

interface HandoverItem {
  id: string;
  house: string;
  category: 'incident' | 'medication' | 'client_update' | 'task' | 'general';
  text: string;
  severity: 'red' | 'amber' | 'none';
  resolved: boolean;
}

interface Handover {
  id: string;
  date: string;
  shiftFrom: string;
  shiftTo: string;
  house: string;
  staffOut: string;
  staffIn: string;
  items: HandoverItem[];
  createdAt: string;
}

const HOUSES = [
  'Lingfield House', 'Church House', 'Laurel House', 'Station House',
  'Canterbury', 'Glenfrome House', 'Woburn House', 'Hazelbury House',
  'Courtney Lodge', 'Cottrell House',
];

const CATEGORIES: { id: HandoverItem['category']; label: string; color: string; icon: string }[] = [
  { id: 'incident', label: 'Incident', color: '#ef4444', icon: 'M12 9v2m0 4h.01' },
  { id: 'medication', label: 'Medication', color: '#14b8a6', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { id: 'client_update', label: 'Person Update', color: '#3b82f6', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0' },
  { id: 'task', label: 'Outstanding Task', color: '#f59e0b', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'general', label: 'General', color: '#64748b', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
];

const STORAGE_KEY = 'hazelcare-handovers';

function loadHandovers(): Handover[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveHandovers(h: Handover[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

export function HandoverPage() {
  const [house, setHouse] = useState(HOUSES[0]);
  const [shiftFrom, setShiftFrom] = useState('Day');
  const [shiftTo, setShiftTo] = useState('Night');
  const [staffOut, setStaffOut] = useState('');
  const [staffIn, setStaffIn] = useState('');
  const [items, setItems] = useState<HandoverItem[]>([]);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<HandoverItem['category']>('general');
  const [newSeverity, setNewSeverity] = useState<'red' | 'amber' | 'none'>('none');
  const [history, setHistory] = useState<Handover[]>(loadHandovers);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  function addItem() {
    if (!newText.trim()) return;
    setItems([...items, {
      id: uid(),
      house,
      category: newCategory,
      text: newText.trim(),
      severity: newSeverity,
      resolved: false,
    }]);
    setNewText('');
    setNewSeverity('none');
  }

  function removeItem(id: string) {
    setItems(items.filter(i => i.id !== id));
  }

  function toggleResolved(id: string) {
    setItems(items.map(i => i.id === id ? { ...i, resolved: !i.resolved } : i));
  }

  function generateHandoverText(): string {
    const now = new Date();
    let text = `SHIFT HANDOVER — ${house}\n`;
    text += `Date: ${now.toLocaleDateString('en-GB')}\n`;
    text += `Shift: ${shiftFrom} → ${shiftTo}\n`;
    text += `Outgoing Staff: ${staffOut || '___'} | Incoming Staff: ${staffIn || '___'}\n`;
    text += `${'─'.repeat(50)}\n\n`;

    const grouped: Record<string, HandoverItem[]> = {};
    for (const item of items) {
      (grouped[item.category] ??= []).push(item);
    }

    for (const cat of CATEGORIES) {
      const catItems = grouped[cat.id];
      if (!catItems?.length) continue;
      text += `${cat.label.toUpperCase()}\n`;
      for (const item of catItems) {
        const flag = item.severity === 'red' ? ' [RED FLAG]' : item.severity === 'amber' ? ' [AMBER ALERT]' : '';
        const status = item.resolved ? ' ✓ Resolved' : '';
        text += `  • ${item.text}${flag}${status}\n`;
      }
      text += '\n';
    }

    const unresolved = items.filter(i => !i.resolved);
    if (unresolved.length > 0) {
      text += `CARRY FORWARD (${unresolved.length} items)\n`;
      for (const item of unresolved) {
        text += `  → ${item.text}\n`;
      }
      text += '\n';
    }

    text += `${'─'.repeat(50)}\n`;
    text += `Hazel Care Ltd | Confidential`;
    return text;
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generateHandoverText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveHandover() {
    const handover: Handover = {
      id: uid(),
      date: new Date().toLocaleDateString('en-GB'),
      shiftFrom, shiftTo, house, staffOut, staffIn,
      items: [...items],
      createdAt: new Date().toISOString(),
    };
    const updated = [handover, ...history].slice(0, 50);
    setHistory(updated);
    saveHandovers(updated);
    setItems([]);
    setStaffOut('');
    setStaffIn('');
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1700px] mx-auto animate-in fade-in duration-700">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-extrabold text-hc-text mb-1 tracking-tight text-shimmer">Shift Handover Report</h1>
        <div className="flex items-center gap-3">
          <span className="pill pill-blue text-xs uppercase tracking-[0.08em] font-black shadow-lg">Shift Continuity</span>
          <p className="text-hc-muted text-sm font-semibold uppercase tracking-[0.08em] ml-1">
            Preparing information for the next shift team
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        {/* Left — Input */}
        <div className="lg:col-span-3 space-y-6">
          {/* Meta */}
          <div className="glass-light border border-hc-border rounded-xl lg:rounded-2xl p-4 lg:p-5 shadow-xl backdrop-blur-md">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="group">
                <label className="section-header text-xs mb-2 ml-1 block opacity-90 tracking-[0.08em]">House</label>
                <select value={house} onChange={e => setHouse(e.target.value)} className="w-full bg-hc-dark/80 border border-hc-border rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-hc-text focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark">
                  {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="section-header text-xs mb-2 ml-1 block opacity-90 tracking-[0.08em]">Shift Transition</label>
                <div className="flex gap-2 p-1 bg-black/5 rounded-xl border border-hc-border">
                  {['Day → Night', 'Night → Day'].map(s => {
                    const [from, to] = s.split(' → ');
                    const active = shiftFrom === from;
                    return (
                      <button key={s} onClick={() => { setShiftFrom(from); setShiftTo(to); }} className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-lg transition-all duration-500 active:scale-95 ${active ? 'bg-hc-teal/20 text-hc-teal-light border border-hc-teal/20 shadow-lg scale-105 z-10' : 'text-hc-muted hover:text-hc-text hover:bg-white/5'}`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="group">
                <label className="section-header text-xs mb-2 ml-1 block opacity-90 tracking-[0.08em]">Outgoing Staff</label>
                <input value={staffOut} onChange={e => setStaffOut(e.target.value)} placeholder="Name" className="w-full bg-hc-dark/80 border border-hc-border rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-hc-text placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark" />
              </div>
              <div className="group">
                <label className="section-header text-xs mb-2 ml-1 block opacity-90 tracking-[0.08em]">Incoming Staff</label>
                <input value={staffIn} onChange={e => setStaffIn(e.target.value)} placeholder="Name" className="w-full bg-hc-dark/80 border border-hc-border rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-hc-text placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark" />
              </div>
            </div>
          </div>

          {/* Add item */}
          <div className="glass-light border border-hc-teal/20 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-hc-teal/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-wrap gap-2.5 mb-8 relative z-10">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setNewCategory(cat.id)}
                  className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-500 active:scale-90 ${
                    newCategory === cat.id
                      ? 'shadow-xl bg-hc-teal/10 border-hc-teal/30 scale-110 z-10'
                      : 'border-hc-border text-hc-muted hover:text-hc-text hover:bg-white/5'
                  }`}
                  style={newCategory === cat.id ? { color: cat.color, borderColor: `${cat.color}40`, background: `${cat.color}15` } : {}}
                >
                  <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} /></svg>
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-6 relative z-10">
              <textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addItem(); } }}
                placeholder="Enter handover details... (Enter to add)"
                className="flex-1 bg-white border border-hc-border rounded-3xl p-6 text-sm text-hc-text placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark resize-none scrollbar-thin font-medium italic"
                rows={3}
              />
              <div className="flex flex-row md:flex-col justify-between gap-4 shrink-0">
                <div className="flex md:flex-col gap-3 p-2 bg-black/5 rounded-2xl border border-hc-border shadow-inner">
                  {(['none', 'amber', 'red'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setNewSeverity(s)}
                      className={`w-12 h-12 rounded-xl border-2 transition-all duration-500 shadow-xl flex items-center justify-center active:scale-75 ${
                        newSeverity === s ? 'scale-110' : 'opacity-20 hover:opacity-100 grayscale hover:grayscale-0'
                      }`}
                      style={{
                        borderColor: s === 'red' ? '#ef4444' : s === 'amber' ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                        background: s === 'red' ? 'rgba(239,68,68,0.2)' : s === 'amber' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                      }}
                      title={s === 'none' ? 'No priority' : s.toUpperCase()}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full ${s === 'red' ? 'bg-flag-red animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]' : s === 'amber' ? 'bg-flag-amber shadow-[0_0_15px_rgba(245,158,11,0.8)]' : 'bg-white/20'}`} />
                    </button>
                  ))}
                </div>
                <button onClick={addItem} disabled={!newText.trim()} className="flex-1 md:flex-none px-10 py-5 btn-gradient text-hc-text text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-20 transition-all">
                  ADD ITEM
                </button>
              </div>
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-3">
            {items.length > 0 && <div className="section-header text-[9px] mb-4 ml-2 opacity-60 tracking-[0.3em]">ACTIVE HANDOVER LOG — {items.length} ITEMS</div>}
            {items.map((item, idx) => {
              const cat = CATEGORIES.find(c => c.id === item.category);
              const isRed = item.severity === 'red';
              const isAmber = item.severity === 'amber';
              return (
                <div
                  key={item.id}
                  className={`glass-light border transition-all duration-500 rounded-2xl p-5 flex items-start gap-5 card-glow group interactive-row animate-in slide-in-from-left-4
                    ${isRed ? 'border-flag-red/30 bg-flag-red/[0.02] glow-red' : isAmber ? 'border-flag-amber/25 bg-flag-amber/[0.01] glow-amber' : 'border-hc-border'} ${item.resolved ? 'opacity-40 grayscale pointer-events-none' : ''}`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <button onClick={() => toggleResolved(item.id)} className={`mt-1.5 w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-all duration-500 shadow-xl group-hover:scale-110 ${item.resolved ? 'bg-flag-green border-flag-green' : 'border-hc-border hover:border-hc-teal-light'}`}>
                    {item.resolved && <svg className="w-4 h-4 text-hc-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap transition-transform duration-500 group-hover:translate-x-1">
                      <span className="text-[10px] font-black uppercase tracking-widest transition-colors group-hover:text-hc-teal-light" style={{ color: cat?.color }}>{cat?.label}</span>
                      {item.severity !== 'none' && (
                        <span className={`pill text-[8px] font-black uppercase tracking-tighter px-2
                          ${isRed ? 'pill-red animate-pulse-soft' : 'pill-amber'}`}>{item.severity} ALERT</span>
                      )}
                    </div>
                    <div className={`text-[14px] text-hc-text font-medium leading-relaxed transition-all duration-500 group-hover:translate-x-1 ${item.resolved ? 'line-through opacity-60' : ''}`}>{item.text}</div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-xl glass border border-hc-border flex items-center justify-center text-hc-muted hover:text-flag-red hover:border-flag-red/30 transition-all opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              );
            })}
            
            {items.length === 0 && (
              <div className="text-center py-24 glass border border-hc-border rounded-[2.5rem] animate-in zoom-in duration-700">
                <div className="text-5xl mb-6 opacity-20">📝</div>
                <div className="text-lg font-extrabold text-hc-text mb-2 uppercase tracking-tight">Handover List Empty</div>
                <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">Add items above to build your shift handover report</div>
              </div>
            )}
          </div>
        </div>

        {/* Right — Preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-10 space-y-6">
            <div className="glass border-2 border-hc-teal/30 rounded-[2.5rem] overflow-hidden shadow-2xl glow-teal animate-in slide-in-from-right-4 duration-700">
              <div className="p-8 border-b border-hc-border bg-hc-teal/[0.02] flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-hc-text uppercase tracking-tighter text-shimmer">Report Preview</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1 h-1 rounded-full bg-hc-teal animate-pulse" />
                    <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest tabular-nums">{items.length} Items · {items.filter(i => !i.resolved).length} Pending</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={copyToClipboard} className={`px-8 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all duration-500 shadow-2xl hover:scale-105 active:scale-90 ${copied ? 'bg-flag-green text-hc-text shadow-flag-green/30' : 'btn-gradient text-hc-text'}`}>
                    {copied ? 'COPIED' : 'COPY'}
                  </button>
                  <button onClick={saveHandover} disabled={items.length === 0} className="px-6 py-3.5 glass-light border border-hc-border text-[10px] font-black text-hc-muted hover:text-hc-text uppercase tracking-[0.2em] rounded-xl transition-all duration-500 hover:bg-white/5 active:scale-90 disabled:opacity-20 disabled:grayscale">
                    LOG
                  </button>
                </div>
              </div>
              <div className="p-8">
                <pre className="text-[12px] text-hc-text/90 font-mono leading-loose whitespace-pre-wrap max-h-[600px] overflow-y-auto scrollbar-thin italic">
                  {items.length > 0 ? generateHandoverText() : '// Your shift handover report will appear here...'}
                </pre>
              </div>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="px-2 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                <button onClick={() => setShowHistory(!showHistory)} className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-hc-muted hover:text-hc-teal-light w-full transition-all text-left">
                  <span className={`w-6 h-6 rounded-lg glass border border-hc-border flex items-center justify-center transition-all duration-500 ${showHistory ? 'rotate-90 bg-hc-teal/10 border-hc-teal/30 text-hc-teal-light' : 'group-hover:bg-white/5'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </span>
                  HANDOVER HISTORY ({history.length})
                </button>
                {showHistory && (
                  <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin pr-2 animate-in slide-in-from-top-4 duration-700">
                    {history.slice(0, 15).map((h) => (
                      <div key={h.id} className="glass-light border border-hc-border rounded-2xl p-5 transition-all duration-500 hover:bg-hc-teal/5 hover:border-hc-teal/20 group/archive cursor-default active:scale-[0.98]">
                        <div className="flex items-center justify-between mb-2.5 transition-transform duration-500 group-hover/archive:translate-x-1">
                          <span className="text-[12px] font-black text-hc-text group-hover/archive:text-hc-teal-light transition-colors uppercase tracking-tight">{h.house}</span>
                          <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-40 tabular-nums">{h.date}</span>
                        </div>
                        <div className="flex items-center gap-4 transition-transform duration-500 group-hover/archive:translate-x-1">
                          <span className="pill pill-blue text-[8px] font-black py-0 px-2 shadow-sm">{h.shiftFrom} → {h.shiftTo}</span>
                          <span className="text-[9px] font-black text-hc-muted/60 uppercase tracking-[0.3em] tabular-nums">{h.items.length} ITEMS</span>
                        </div>
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
