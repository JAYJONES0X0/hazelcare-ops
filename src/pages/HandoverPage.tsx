import { useState, useEffect } from 'react';
import { uid } from '../lib/storage';
import { ORG_CONFIG } from '../lib/config';
import type { WeekSummary } from '../lib/types';
import { ChevronRight } from 'lucide-react';

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
  clientsOfConcern?: string;
  redFlags?: string;
  createdAt: string;
}

const HOUSES = [
  'Lingfield House', 'Church House', 'Laurel House', 'Station House',
  'Canterbury', 'Glenfrome House', 'Woburn House', 'Hazelbury House',
  'Courtney Lodge', 'Cottrell House',
];

const CATEGORIES: { id: HandoverItem['category']; label: string; color: string; icon: string }[] = [
  { id: 'incident', label: 'Incident', color: '#d94e4e', icon: 'M12 9v2m0 4h.01' },
  { id: 'medication', label: 'Medication', color: '#1c4e4e', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { id: 'client_update', label: 'Person Update', color: '#4c7c7c', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0' },
  { id: 'task', label: 'Outstanding Task', color: '#d9974e', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'general', label: 'General', color: '#8a8b82', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z' },
];

const STORAGE_KEY = 'hazelcare-handovers';

function loadHandovers(): Handover[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveHandovers(h: Handover[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

export function HandoverPage({ weekData }: { weekData: WeekSummary | null }) {
  const [house, setHouse] = useState(HOUSES[0]);
  const [shiftFrom, setShiftFrom] = useState('Day');
  const [shiftTo, setShiftTo] = useState('Night');
  const [staffOut, setStaffOut] = useState('');
  const [staffIn, setStaffIn] = useState('');
  const [items, setItems] = useState<HandoverItem[]>([]);
  const [clientsOfConcern, setClientsOfConcern] = useState('');
  const [redFlags, setRedFlags] = useState('');
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<HandoverItem['category']>('general');
  const [newSeverity, setNewSeverity] = useState<'red' | 'amber' | 'none'>('none');
  const [history, setHistory] = useState<Handover[]>(loadHandovers);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!weekData) return;
    const rfEntries = (weekData.allFlags?.red ?? []).filter(e => e.house === house);
    const rfText = rfEntries.map(e => `• [${e.client}] ${e.entry}`).join('\n');
    const concernKeywords = ['concern', 'incident', 'escalation', 'red flag', 'safeguarding', 'behaviour', 'refusal'];
    const hData = weekData.houses[house];
    if (!hData) return;

    const concernEntries = hData.entries.filter(e => {
      if (e.severity === 'red') return false;
      if (e.severity === 'amber') return true;
      return concernKeywords.some(k => e.entry.toLowerCase().includes(k));
    });

    const cocMap = new Map<string, string[]>();
    concernEntries.forEach(e => {
      const logs = cocMap.get(e.client) || [];
      logs.push(e.entry);
      cocMap.set(e.client, logs);
    });

    const cocText = Array.from(cocMap.entries())
      .map(([client, logs]) => `• ${client}: ${logs.join('; ')}`)
      .join('\n');

    if (rfText && !redFlags) setRedFlags(rfText);
    if (cocText && !clientsOfConcern) setClientsOfConcern(cocText);
  }, [weekData, house, redFlags, clientsOfConcern]);

  function addItem() {
    if (!newText.trim()) return;
    setItems([...items, { id: uid(), house, category: newCategory, text: newText.trim(), severity: newSeverity, resolved: false }]);
    setNewText(''); setNewSeverity('none');
  }

  function removeItem(id: string) { setItems(items.filter(i => i.id !== id)); }
  function toggleResolved(id: string) { setItems(items.map(i => i.id === id ? { ...i, resolved: !i.resolved } : i)); }

  function generateHandoverText(): string {
    const now = new Date();
    let text = `SHIFT HANDOVER · ${house.toUpperCase()}\n`;
    text += `DATE: ${now.toLocaleDateString('en-GB')}\n`;
    text += `SHIFT: ${shiftFrom.toUpperCase()} → ${shiftTo.toUpperCase()}\n`;
    text += `OUTGOING: ${staffOut || '___'} | INCOMING: ${staffIn || '___'}\n`;
    text += `${'─'.repeat(50)}\n\n`;

    if (redFlags.trim()) text += `CRITICAL RED FLAGS\n${redFlags.trim()}\n\n`;
    if (clientsOfConcern.trim()) text += `CLIENTS OF CONCERN\n${clientsOfConcern.trim()}\n\n`;

    const grouped: Record<string, HandoverItem[]> = {};
    for (const item of items) (grouped[item.category] ??= []).push(item);

    for (const cat of CATEGORIES) {
      const catItems = grouped[cat.id];
      if (!catItems?.length) continue;
      text += `${cat.label.toUpperCase()}\n`;
      for (const item of catItems) {
        const flag = item.severity === 'red' ? ' [RED FLAG]' : item.severity === 'amber' ? ' [AMBER ALERT]' : '';
        const status = item.resolved ? ' · Resolved' : '';
        text += `  • ${item.text}${flag}${status}\n`;
      }
      text += '\n';
    }
    text += `${'─'.repeat(50)}\n${ORG_CONFIG.fullName} | CONFIDENTIAL`;
    return text;
  }

  function copyToClipboard() { navigator.clipboard.writeText(generateHandoverText()); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  function saveHandover() {
    const handover: Handover = {
      id: uid(), date: new Date().toLocaleDateString('en-GB'),
      shiftFrom, shiftTo, house, staffOut, staffIn,
      items: [...items], clientsOfConcern, redFlags, createdAt: new Date().toISOString(),
    };
    const updated = [handover, ...history].slice(0, 50);
    setHistory(updated); saveHandovers(updated);
    setItems([]); setStaffOut(''); setStaffIn(''); setClientsOfConcern(''); setRedFlags('');
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1700px] mx-auto animate-in fade-in duration-700">
      <div className="mb-10">
        <h1 className="text-2xl md:text-3xl font-black text-hc-text mb-2 tracking-[0.1em] uppercase">Shift Handover Report</h1>
        <div className="flex items-center gap-3">
          <span className="pill pill-teal text-[10px] font-black px-4 py-1">Shift Continuity</span>
          <p className="text-hc-muted text-[11px] font-black uppercase tracking-widest">
            Preparing information for the next shift team
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3 space-y-10">
          
          <div className="hc-clay-raised p-8">
             <span className="text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] mb-8 block">1. Operational Meta-Data</span>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-3">
                   <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Site / House</label>
                   <select value={house} onChange={e => setHouse(e.target.value)} className="w-full hc-clay-inset px-4 py-3 text-[11px] font-black uppercase text-hc-text outline-none shadow-inner bg-transparent">
                      {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                   </select>
                </div>
                <div className="space-y-3">
                   <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Transition</label>
                   <div className="flex gap-2 p-1 hc-clay-inset rounded-xl">
                      {['Day', 'Night'].map(s => (
                        <button key={s} onClick={() => { setShiftFrom(s); setShiftTo(s === 'Day' ? 'Night' : 'Day'); }} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${shiftFrom === s ? 'bg-hc-teal text-hc-bone shadow-lg' : 'text-hc-muted hover:text-hc-text'}`}>{s}</button>
                      ))}
                   </div>
                </div>
                <div className="space-y-3">
                   <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Outgoing</label>
                   <input value={staffOut} onChange={e => setStaffOut(e.target.value)} placeholder="Staff Name" className="w-full hc-clay-inset px-4 py-3 text-[11px] font-black uppercase text-hc-text outline-none shadow-inner placeholder:text-hc-muted/30" />
                </div>
                <div className="space-y-3">
                   <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Incoming</label>
                   <input value={staffIn} onChange={e => setStaffIn(e.target.value)} placeholder="Staff Name" className="w-full hc-clay-inset px-4 py-3 text-[11px] font-black uppercase text-hc-text outline-none shadow-inner placeholder:text-hc-muted/30" />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="hc-clay-raised p-8 border border-hc-red/20">
               <label className="flex items-center gap-2 text-[10px] font-black text-hc-red uppercase tracking-[0.2em] mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-hc-red animate-pulse" />
                  Critical Red Flags
               </label>
               <textarea value={redFlags} onChange={e => setRedFlags(e.target.value)} placeholder="Scan complete · No red flags detected..." className="w-full hc-clay-inset p-5 text-[12px] text-hc-text font-black leading-relaxed resize-none focus:outline-none min-h-[140px] scrollbar-thin italic placeholder:text-hc-muted/20" />
            </div>

            <div className="hc-clay-raised p-8 border border-hc-amber/20">
               <label className="flex items-center gap-2 text-[10px] font-black text-hc-amber uppercase tracking-[0.2em] mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-hc-amber" />
                  Clients of Concern
               </label>
               <textarea value={clientsOfConcern} onChange={e => setClientsOfConcern(e.target.value)} placeholder="Scan complete · No concerns detected..." className="w-full hc-clay-inset p-5 text-[12px] text-hc-text font-black leading-relaxed resize-none focus:outline-none min-h-[140px] scrollbar-thin italic placeholder:text-hc-muted/20" />
            </div>
          </div>

          <div className="hc-clay-raised p-8">
             <div className="flex flex-wrap gap-2 mb-8 hc-clay-inset p-2 rounded-2xl">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setNewCategory(cat.id)} className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newCategory === cat.id ? 'bg-hc-teal text-hc-bone shadow-xl' : 'text-hc-muted hover:text-hc-text'}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} /></svg>
                    {cat.label}
                  </button>
                ))}
             </div>

             <div className="flex flex-col md:flex-row gap-6">
                <textarea value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();addItem();} }} placeholder="Enter clinical handover detail... (Enter to add)" className="flex-1 hc-clay-inset p-6 text-[13px] text-hc-text font-medium leading-relaxed resize-none focus:outline-none min-h-[120px] scrollbar-thin italic" />
                <div className="flex flex-row md:flex-col gap-4">
                   <div className="flex gap-2 p-2 hc-clay-inset rounded-xl">
                      {(['none', 'amber', 'red'] as const).map(s => (
                        <button key={s} onClick={() => setNewSeverity(s)} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${newSeverity === s ? 'hc-clay-raised scale-110' : 'opacity-20 hover:opacity-100 grayscale'}`}>
                           <div className={`w-3 h-3 rounded-full ${s==='red'?'bg-hc-red animate-pulse':s==='amber'?'bg-hc-amber':'bg-hc-muted'}`} />
                        </button>
                      ))}
                   </div>
                   <button onClick={addItem} disabled={!newText.trim()} className="flex-1 md:flex-none px-8 py-4 btn-tactical text-[10px] font-black uppercase tracking-widest shadow-xl">ADD ITEM</button>
                </div>
             </div>
          </div>

          <div className="space-y-4">
             {items.map((item, i) => {
               const cat = CATEGORIES.find(c => c.id === item.category);
               return (
                 <div key={item.id} className={`hc-clay-raised p-6 flex items-start gap-6 group animate-in slide-in-from-left-4 ${item.resolved ? 'opacity-40 grayscale' : ''}`} style={{animationDelay:`${i*50}ms`}}>
                    <button onClick={() => toggleResolved(item.id)} className={`mt-1 w-6 h-6 rounded-lg hc-clay-inset flex items-center justify-center transition-all ${item.resolved ? 'bg-hc-teal' : 'hover:border-hc-teal/40'}`}>
                       {item.resolved && <svg className="w-4 h-4 text-hc-bone" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest" style={{color:cat?.color}}>{cat?.label}</span>
                          {item.severity !== 'none' && <span className={`pill text-[8px] font-black px-2 ${item.severity==='red'?'pill-red':'pill-amber'}`}>{item.severity} ALERT</span>}
                       </div>
                       <div className={`text-[13px] text-hc-text font-black leading-relaxed ${item.resolved ? 'line-through' : ''}`}>{item.text}</div>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100 text-hc-muted hover:text-hc-red transition-all">âœ•</button>
                 </div>
               );
             })}
          </div>
        </div>

        <div className="lg:col-span-2">
           <div className="sticky top-10 space-y-10">
              <div className="hc-clay-raised overflow-hidden shadow-2xl border border-hc-teal/10">
                 <div className="p-8 bg-hc-teal/[0.03] border-b border-hc-border/10 flex items-center justify-between">
                    <div>
                       <h3 className="text-xl font-black text-hc-text uppercase tracking-tight">Handover Preview</h3>
                       <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest tabular-nums mt-1 block">{items.length} Clinical Nodes Active</span>
                    </div>
                    <div className="flex gap-3">
                       <button onClick={copyToClipboard} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl ${copied ? 'bg-hc-teal text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}>{copied ? 'COPIED' : 'COPY'}</button>
                       <button onClick={saveHandover} disabled={items.length === 0} className="px-6 py-3 hc-clay-inset text-[10px] font-black text-hc-muted hover:text-hc-text uppercase tracking-widest transition-all">LOG</button>
                    </div>
                 </div>
                 <div className="p-8">
                    <pre className="text-[12px] text-hc-text font-black leading-loose whitespace-pre-wrap italic max-h-[500px] overflow-y-auto scrollbar-thin">
                       {items.length > 0 ? generateHandoverText() : '// Report stream awaiting intelligence...'}
                    </pre>
                 </div>
              </div>

              {history.length > 0 && (
                <div className="space-y-6">
                   <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-3 text-[10px] font-black text-hc-muted uppercase tracking-[0.3em] hover:text-hc-teal transition-all">
                      <ChevronRight className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
                      Handover History ({history.length})
                   </button>
                   {showHistory && (
                     <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                        {history.slice(0, 15).map(h => (
                          <div key={h.id} className="hc-clay-raised p-5 space-y-3 hover:bg-hc-teal/5 transition-all cursor-default">
                             <div className="flex justify-between items-center">
                                <span className="text-[11px] font-black text-hc-text uppercase">{h.house}</span>
                                <span className="text-[9px] font-black text-hc-muted tabular-nums">{h.date}</span>
                             </div>
                             <div className="flex items-center gap-4">
                                <span className="pill pill-teal text-[8px] font-black">{h.shiftFrom} âž” {h.shiftTo}</span>
                                <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">{h.items.length} NODES</span>
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
