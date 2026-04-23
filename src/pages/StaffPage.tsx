import { useState } from 'react';
import type { StaffMember } from '../lib/types';
import { uid, HAZELCARE_HOUSES, ROLES, staffStatus, daysUntil, STAFF_TEMPLATES, loadLegalDocument, saveLegalDocument, type LegalDocument } from '../lib/compliance-store';
import { Users, Plus, Edit2, Shield, Search } from 'lucide-react';
import { ORG_CONFIG } from '../lib/config';

interface Props {
  staff: StaffMember[];
  onUpdate: (staff: StaffMember[]) => void;
}

function emptyStaff(): StaffMember {
  return { 
    id: uid(), 
    name: '', 
    role: 'Support Worker', 
    house: HAZELCARE_HOUSES[0], 
    dbsExpiry: '', 
    trainingExpiry: '', 
    nextSupervision: '', 
    supervisionFreq: 4,
    sicknessThisMonth: 0,
    latenessThisMonth: 0,
    status: 'active'
  };
}

function StaffModal({ staff, onSave, onClose }: { staff: StaffMember; onSave: (s: StaffMember) => void; onClose: () => void }) {
  const [form, setForm] = useState<StaffMember>({ ...staff });
  const set = (k: keyof StaffMember, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="hc-clay-raised w-full max-w-lg p-10 flex flex-col gap-8 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-2xl font-black text-hc-text tracking-tighter uppercase tabular-nums">Personnel Profile</h3>
          <p className="text-[10px] font-bold text-hc-muted uppercase tracking-[0.4em] mt-2">Governance & Roster Configuration</p>
        </div>
        
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Full Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sarah Mitchell" 
              className="hc-clay-inset w-full p-4 text-sm font-bold text-hc-text outline-none focus:ring-2 focus:ring-hc-teal/20 transition-all placeholder:text-hc-muted/30" />
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Job Role</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className="hc-clay-inset w-full p-4 text-[10px] font-black uppercase tracking-widest text-hc-text">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Primary House</label>
              <select value={form.house} onChange={e => set('house', e.target.value)} className="hc-clay-inset w-full p-4 text-[10px] font-black uppercase tracking-widest text-hc-text">
                {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black text-hc-muted uppercase tracking-widest ml-1">Employment Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value as any)} className="hc-clay-inset w-full p-4 text-[10px] font-black uppercase tracking-widest text-hc-text">
              <option value="active">Active</option>
              <option value="sickness">Sickness</option>
              <option value="leave">On Leave</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={() => { if (form.name.trim()) onSave(form); }} disabled={!form.name.trim()} className="btn-clay btn-clay-teal flex-1 h-[60px] text-[11px]">
            Save Personnel Unit
          </button>
          <button onClick={onClose} className="btn-clay flex-1 h-[60px] text-[11px] text-hc-muted">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffDocumentDrawer({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [docContent, setDocContent] = useState('');
  const [isDraft, setIsDraft] = useState(true);
  const [copied, setCopied] = useState(false);

  function synthesise(templateId: string) {
    const template = STAFF_TEMPLATES[templateId];
    if (!template) return;

    const dbsS = staffStatus(staff.dbsExpiry || '', 60);
    const trainS = staffStatus(staff.trainingExpiry || '', 30);

    let content = template
      .replace(/{{ORG_NAME}}/g, ORG_CONFIG.fullName)
      .replace(/{{STAFF_NAME}}/g, staff.name)
      .replace(/{{STAFF_ROLE}}/g, staff.role)
      .replace(/{{STAFF_HOUSE}}/g, staff.house)
      .replace(/{{STAFF_DBS}}/g, staff.dbsExpiry || '[MISSING]')
      .replace(/{{STAFF_DBS_STATUS}}/g, dbsS === 'ok' ? 'VALID' : dbsS === 'due_soon' ? 'DUE SOON' : 'EXPIRED / MISSING')
      .replace(/{{STAFF_TRAINING_STATUS}}/g, trainS === 'ok' ? 'COMPLIANT' : 'GAPS IDENTIFIED')
      .replace(/{{DATE}}/g, new Date().toLocaleDateString('en-GB'))
      .replace(/{{REVIEWER_NAME}}/g, '[Manager Name]');

    const docId = `staff-${staff.id}-${templateId}`;
    const existing = loadLegalDocument(docId);
    
    setActiveDocId(docId);
    setDocContent(existing ? existing.content : content);
    setIsDraft(existing ? existing.isDraft : true);
  }

  function save() {
    if (!activeDocId) return;
    const doc: LegalDocument = {
      id: activeDocId,
      title: activeDocId.split('-').pop()?.toUpperCase() || 'DOCUMENT',
      lastUpdated: new Date().toLocaleDateString('en-GB'),
      content: docContent,
      isDraft,
    };
    saveLegalDocument(doc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-hc-dark/95 backdrop-blur-3xl border-l border-white/10 z-[60] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-full duration-500 overflow-y-auto scrollbar-thin">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black text-white tracking-tighter">Staff Intelligence</h2>
              <span className="pill pill-teal text-[10px] font-black uppercase tracking-widest px-3 shadow-lg glow-teal animate-shimmer">Live Synthesis</span>
            </div>
            <p className="text-hc-muted text-xs font-bold uppercase tracking-widest opacity-60">Generating documentation for {staff.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center text-hc-muted hover:text-white transition-all hover:rotate-90">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {Object.keys(STAFF_TEMPLATES).map(id => (
            <button key={id} onClick={() => synthesise(id)}
              className={`p-4 rounded-2xl border text-center transition-all duration-500 group relative overflow-hidden ${activeDocId?.endsWith(id) ? 'bg-hc-teal/20 border-hc-teal shadow-2xl scale-105' : 'glass-light border-white/5 hover:border-white/20'}`}>
              <div className="text-[10px] font-black text-white uppercase tracking-widest relative z-10">{id}</div>
              <div className="text-[8px] font-bold text-hc-muted mt-1 uppercase tracking-widest relative z-10 opacity-60 group-hover:opacity-100">Draft Builder</div>
            </button>
          ))}
        </div>

        {activeDocId && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-light border border-white/10 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-hc-teal/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isDraft ? 'bg-flag-amber' : 'bg-flag-green'}`} />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{isDraft ? 'DRAFT BUILD' : 'FINALIZED'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsDraft(!isDraft)} className="px-5 py-2 glass-light border border-white/10 text-[9px] font-black text-hc-muted hover:text-white uppercase tracking-[0.2em] rounded-xl transition-all">Toggle Status</button>
                  <button onClick={save} className={`px-6 py-2 text-[9px] font-black text-white uppercase tracking-[0.2em] rounded-xl transition-all shadow-xl ${copied ? 'bg-flag-green' : 'btn-gradient hover:scale-105 active:scale-95'}`}>
                    {copied ? 'SAVED ✓' : 'SAVE DRAFT'}
                  </button>
                </div>
              </div>
              <textarea
                value={docContent}
                onChange={e => setDocContent(e.target.value)}
                className="w-full bg-hc-dark/40 border border-white/5 rounded-2xl p-6 text-[13px] text-hc-text/90 font-mono leading-loose min-h-[500px] focus:outline-none focus:border-hc-teal/30 scrollbar-thin resize-none italic"
              />
            </div>
            
            <div className="p-6 glass border border-flag-amber/20 bg-flag-amber/[0.03] rounded-[2rem] flex items-start gap-4">
              <span className="text-2xl animate-pulse">📝</span>
              <div>
                <div className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Intelligence Note</div>
                <p className="text-xs text-hc-muted leading-relaxed italic opacity-80">
                  This document has been synthesized from organizational data and UK HR templates. Review carefully before printing or providing to the employee.
                </p>
              </div>
            </div>
          </div>
        )}

        {!activeDocId && (
          <div className="flex flex-col items-center justify-center py-32 opacity-20 hover:opacity-100 transition-opacity duration-1000 group">
            <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-700">🧠</div>
            <div className="text-sm font-black text-white uppercase tracking-widest mb-2">Select a framework</div>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-widest">To begin synthesizing intelligence for {staff.name}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility badge removed in favor of high-fidelity clay pills in render loop

export function StaffPage({ staff, onUpdate }: Props) {
  const [search, setSearch] = useState('');
  const [houseFilter, setHouseFilter] = useState('all');
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [docDrawerMember, setDocDrawerMember] = useState<StaffMember | null>(null);

  const houses = [...new Set(staff.map(s => s.house))].sort();
  if (houses.length === 0) houses.push(...HAZELCARE_HOUSES);

  const filtered = staff.filter(s => {
    if (houseFilter !== 'all' && s.house !== houseFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.role.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function saveMember(s: StaffMember) {
    const updated = staff.find(x => x.id === s.id)
      ? staff.map(x => x.id === s.id ? s : x)
      : [...staff, s];
    onUpdate(updated);
    setEditMember(null);
  }

  const totalActive = staff.filter(s => s.status === 'active').length;
  const totalSickness = staff.filter(s => s.status === 'sickness').length;
  const totalSicknessEvents = staff.reduce((sum, s) => sum + s.sicknessThisMonth, 0);
  const totalLatenessEvents = staff.reduce((sum, s) => sum + s.latenessThisMonth, 0);

  // Group by house
  const byHouse: Record<string, StaffMember[]> = {};
  for (const s of filtered) {
    (byHouse[s.house] ??= []).push(s);
  }

  return (
    <div className="p-10 flex flex-col gap-12 bg-hc-bg">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-10 border-b border-hc-border">
        <div>
          <div className="flex items-center gap-4 mb-2">
             <div className="w-10 h-10 rounded-2xl hc-clay-raised flex items-center justify-center">
                <Users size={20} className="text-hc-teal" />
             </div>
             <h1 className="text-3xl font-black text-hc-text tracking-tighter uppercase">Personnel Ledger</h1>
          </div>
          <p className="text-[10px] font-bold text-hc-muted uppercase tracking-[0.4em] ml-14">Organizational Asset Oversight & Stability Matrix</p>
        </div>
        <button onClick={() => setEditMember(emptyStaff())} className="btn-clay btn-clay-teal h-[64px] px-10">
           <Plus size={16} /> Enroll New Unit
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Active_Personnel', value: totalActive, colorClass: 'text-hc-teal' },
          { label: 'Off_Sick', value: totalSickness, colorClass: 'text-hc-red' },
          { label: 'Sickness_Load', value: totalSicknessEvents, colorClass: 'text-hc-amber' },
          { label: 'Latency_Events', value: totalLatenessEvents, colorClass: 'text-hc-muted' },
        ].map(kpi => (
          <div key={kpi.label} className="hc-clay-raised p-8 flex flex-col gap-4">
             <div className="text-[9px] font-black text-hc-muted uppercase tracking-[0.3em]">{kpi.label}</div>
             <div className={`text-4xl font-black tabular-nums transition-all ${kpi.colorClass}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="hc-clay-raised p-6 flex flex-col md:flex-row gap-6 items-center">
        <div className="relative group flex-1">
           <Search className="w-5 h-5 text-hc-muted absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-hc-teal transition-colors" />
           <input value={search} onChange={e => setSearch(e.target.value)} placeholder="QUERY PERSONNEL DATABASE..." 
              className="hc-clay-inset w-full pl-12 pr-6 py-4 text-sm font-bold text-hc-text outline-none focus:ring-2 focus:ring-hc-teal/20" />
        </div>
        <div className="flex items-center gap-4">
           <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.3em]">Sector_Lock:</span>
           <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)} className="hc-clay-inset px-6 py-4 text-[10px] font-black uppercase tracking-widest text-hc-text min-w-[200px]">
              <option value="all">ALL SECTORS</option>
              {houses.map(h => <option key={h} value={h}>{h}</option>)}
           </select>
        </div>
      </div>

      <div className="space-y-16">
        {Object.entries(byHouse).sort(([a], [b]) => a.localeCompare(b)).map(([house, members]) => (
          <div key={house} className="flex flex-col gap-8">
             <div className="flex items-center gap-6 p-4">
                <h2 className="text-2xl font-black text-hc-text tracking-tighter uppercase">{house} COMMAND</h2>
                <div className="hc-clay-pill px-4 py-1.5 hc-clay-raised text-[10px] font-black text-hc-teal uppercase">{members.length} UNITS</div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                {members.map((member) => (
                   <div key={member.id} className="hc-clay-raised p-8 flex flex-col gap-8 group/card transition-all hover:translate-y-[-6px]">
                      <div className="flex items-center justify-between">
                         <div className="w-14 h-14 rounded-2xl hc-clay-inset flex items-center justify-center text-xl font-black text-hc-teal">
                            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                         </div>
                         <div className={`px-4 py-1.5 hc-clay-raised text-[9px] font-black uppercase tracking-widest ${member.status === 'active' ? 'text-hc-teal' : 'text-hc-red'}`}>
                            {member.status}
                         </div>
                      </div>

                      <div>
                         <div className="text-lg font-black text-hc-text tracking-tight mb-1">{member.name}</div>
                         <div className="text-[10px] font-bold text-hc-muted uppercase tracking-[0.2em]">{member.role}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-6">
                         <div className="flex flex-col items-center">
                            <span className={`text-xl font-black tabular-nums transition-all ${member.sicknessThisMonth > 2 ? 'text-hc-red' : 'text-hc-text'}`}>{member.sicknessThisMonth}</span>
                            <span className="text-[8px] font-black text-hc-muted uppercase opacity-40">SICK</span>
                         </div>
                         <div className="flex flex-col items-center">
                            <span className="text-xl font-black tabular-nums text-hc-text">{member.latenessThisMonth}</span>
                            <span className="text-[8px] font-black text-hc-muted uppercase opacity-40">LATE</span>
                         </div>
                         <div className="flex flex-col items-center">
                            <span className="text-xl font-black tabular-nums text-hc-teal">{member.nextSupervision ? daysUntil(member.nextSupervision) + 'D' : '—'}</span>
                            <span className="text-[8px] font-black text-hc-muted uppercase opacity-40">SUP.</span>
                         </div>
                      </div>

                      <div className="flex gap-3 mt-auto pt-4">
                         <button onClick={() => setEditMember(member)} className="btn-clay !px-3 !py-3 !rounded-xl opacity-0 group-hover/card:opacity-100 transition-all"><Edit2 size={14} /></button>
                         <button onClick={() => setDocDrawerMember(member)} className="btn-clay !px-3 !py-3 !rounded-xl opacity-0 group-hover/card:opacity-100 transition-all"><Shield size={14} /></button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="hc-clay-inset py-32 text-center">
          <div className="text-5xl mb-6 opacity-20">👥</div>
          <div className="text-lg font-black text-hc-text mb-2 uppercase tracking-tight">Personnel Database Empty</div>
          <div className="text-[10px] text-hc-muted uppercase tracking-[0.4em] font-bold">Clear sector filters or enroll a new unit to activate intelligence.</div>
        </div>
      )}

      {editMember && <StaffModal staff={editMember} onSave={saveMember} onClose={() => setEditMember(null)} />}
      {docDrawerMember && <StaffDocumentDrawer staff={docDrawerMember} onClose={() => setDocDrawerMember(null)} />}
    </div>
  );
}
