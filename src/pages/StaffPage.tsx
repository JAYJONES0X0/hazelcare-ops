import { useState, useEffect } from 'react';
import type { HouseSummary, StaffMember, WeekSummary } from '../lib/types';
import { uid, HAZELCARE_HOUSES, ROLES, staffStatus, daysUntil, STAFF_TEMPLATES, loadLegalDocument, saveLegalDocument, type LegalDocument } from '../lib/compliance-store';
import { Users, Plus, Edit2, Shield, Search } from 'lucide-react';
import { ORG_CONFIG } from '../lib/config';
import { getAllEntriesAsync } from '../lib/entry-store';
import { computeStaffMonitoring } from '../lib/staff-monitoring';
import { SearchSelect } from '../components/SearchSelect';

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
    <div className="fixed inset-0 bg-hc-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="hc-clay-raised w-full max-w-lg p-10 flex flex-col gap-8 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-2xl font-black text-hc-text tracking-tighter uppercase tabular-nums">Staff Profile</h3>
          <p className="text-[11px] font-bold text-hc-muted uppercase tracking-[0.4em] mt-2">Governance & Roster Configuration</p>
        </div>
        
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-hc-muted uppercase tracking-widest ml-1">Full Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sarah Mitchell" 
              className="hc-clay-inset w-full p-4 text-sm font-bold text-hc-text outline-none focus:ring-2 focus:ring-hc-teal/20 transition-all placeholder:text-hc-muted/30" />
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-hc-muted uppercase tracking-widest ml-1">Job Role</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className="hc-clay-inset w-full p-4 text-[11px] font-black uppercase tracking-widest text-hc-text">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-hc-muted uppercase tracking-widest ml-1">Primary House</label>
              <SearchSelect options={HAZELCARE_HOUSES.map(h => ({ value: h, label: h }))} value={form.house} onChange={v => set('house', v)} placeholder="Select house" />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-hc-muted uppercase tracking-widest ml-1">Employment Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value as StaffMember['status'])} className="hc-clay-inset w-full p-4 text-[11px] font-black uppercase tracking-widest text-hc-text">
              <option value="active">Active</option>
              <option value="sickness">Sickness</option>
              <option value="leave">On Leave</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button onClick={() => { if (form.name.trim()) onSave(form); }} disabled={!form.name.trim()} className="btn-clay btn-clay-teal flex-1 h-[60px] text-[11px]">
            Save Staff Record
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

    const content = template
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
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-hc-dark/95 backdrop-blur-3xl border-l border-hc-muted/10 z-[60] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-full duration-500 overflow-y-auto scrollbar-thin">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black text-hc-text tracking-tighter">Staff Intelligence</h2>
              <span className="pill pill-teal text-[11px] font-black uppercase tracking-widest px-3 shadow-lg glow-teal animate-shimmer">Live</span>
            </div>
            <p className="text-hc-muted text-xs font-bold uppercase tracking-widest">Generating documentation for {staff.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl hc-clay-raised border border-hc-muted/10 flex items-center justify-center text-hc-muted hover:text-hc-text transition-all hover:rotate-90">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {Object.keys(STAFF_TEMPLATES).map(id => (
            <button key={id} onClick={() => synthesise(id)}
              className={`p-4 rounded-2xl border text-center transition-all duration-500 group relative overflow-hidden ${activeDocId?.endsWith(id) ? 'bg-hc-teal/20 border-hc-teal shadow-2xl scale-105' : 'hc-clay-raised border-hc-muted/5 hover:border-hc-muted/20'}`}>
              <div className="text-[11px] font-black text-hc-text uppercase tracking-widest relative z-10">{id}</div>
              <div className="text-[11px] font-bold text-hc-muted mt-1 uppercase tracking-widest relative z-10 group-hover:opacity-100">Draft Builder</div>
            </button>
          ))}
        </div>

        {activeDocId && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="hc-clay-raised border border-hc-muted/10 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-hc-teal/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isDraft ? 'bg-flag-amber' : 'bg-flag-green'}`} />
                  <span className="text-[11px] font-black text-hc-text uppercase tracking-widest">{isDraft ? 'DRAFT BUILD' : 'FINALIZED'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsDraft(!isDraft)} className="px-5 py-2 hc-clay-raised border border-hc-muted/10 text-[11px] font-black text-hc-muted hover:text-hc-text uppercase tracking-[0.2em] rounded-xl transition-all">Toggle Status</button>
                  <button onClick={save} className={`px-6 py-2 text-[11px] font-black text-hc-text uppercase tracking-[0.2em] rounded-xl transition-all shadow-xl ${copied ? 'bg-flag-green' : 'btn-gradient hover:scale-105 active:scale-95'}`}>
                    {copied ? 'SAVED ✓' : 'SAVE DRAFT'}
                  </button>
                </div>
              </div>
              <textarea
                value={docContent}
                onChange={e => setDocContent(e.target.value)}
                className="w-full bg-hc-dark/40 border border-hc-muted/5 rounded-2xl p-6 text-[13px] text-hc-text/90 font-mono leading-loose min-h-[500px] focus:outline-none focus:border-hc-teal/30 scrollbar-thin resize-none italic"
              />
            </div>
            
            <div className="p-6 hc-clay-raised border border-flag-amber/20 bg-flag-amber/[0.03] rounded-[2rem] flex items-start gap-4">
              <span className="text-2xl animate-pulse">📝</span>
              <div>
                <div className="text-[11px] font-black text-hc-text uppercase tracking-widest mb-1">Intelligence Note</div>
                <p className="text-xs text-hc-muted leading-relaxed italic">
                  This document has been synthesised from organisational data and UK HR templates. Review carefully before printing or providing to the employee.
                </p>
              </div>
            </div>
          </div>
        )}

        {!activeDocId && (
          <div className="flex flex-col items-center justify-center py-32 opacity-20 hover:opacity-100 transition-opacity duration-1000 group">
            <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-700">🧠</div>
            <div className="text-sm font-black text-hc-text uppercase tracking-widest mb-2">Select a framework</div>
            <p className="text-[11px] font-bold text-hc-muted uppercase tracking-widest">To begin synthesising intelligence for {staff.name}</p>
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
  const [integrityScores, setIntegrityScores] = useState<Record<string, number>>({});

  // Background Intelligence: Pull scores from the 13k database
  useEffect(() => {
    void getAllEntriesAsync().then(all => {
      if (all.length === 0) return;
      const summary: WeekSummary = {
        totalEntries: all.length,
        dateFrom: '',
        dateTo: '',
        allFlags: { red: [], amber: [], green: [] },
        entryTypes: {},
        clients: [],
        carers: [],
        clientDiary: {},
        houses: {}
      };
      // Build a house-grouped summary for the scoring engine
      all.forEach(e => {
        const h = e.house || 'UNASSIGNED';
        if (!summary.houses[h]) {
          summary.houses[h] = {
            name: h,
            coordinator: '',
            entries: [],
            incidents: [],
            safeguarding: [],
            medication: [],
            staffPerformance: [],
            healthSafety: [],
            handovers: [],
            dailySupport: [],
            flags: { red: 0, amber: 0, green: 0 },
          } satisfies HouseSummary;
        }
        summary.houses[h].entries.push(e);
        summary.entryTypes[e.type] = (summary.entryTypes[e.type] || 0) + 1;
        if (e.client && !summary.clients.includes(e.client)) summary.clients.push(e.client);
        if (e.carer && !summary.carers.includes(e.carer)) summary.carers.push(e.carer);
        if (e.client) {
          if (!summary.clientDiary[e.client]) summary.clientDiary[e.client] = [];
          summary.clientDiary[e.client].push(e);
        }
        if (e.severity === 'red' || e.severity === 'amber' || e.severity === 'green') {
          summary.allFlags[e.severity].push(e);
        }
      });

      const analytics = computeStaffMonitoring(summary, { house: 'all', dateFrom: '', dateTo: '' });
      const scoreMap: Record<string, number> = {};
      analytics.staff.forEach(s => { scoreMap[s.carer] = s.qualityScore; });
      setIntegrityScores(scoreMap);

      // Auto-Discovery: If we find staff in the notes who aren't in the ledger, we should eventually suggest enrolling them
    });
  }, []);

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
             <h1 className="text-3xl font-black text-hc-text tracking-tighter uppercase">Staff Directory</h1>
          </div>
          <p className="text-[11px] font-bold text-hc-muted uppercase tracking-[0.4em] ml-14">Organisational Asset Oversight & Stability Matrix</p>
        </div>
        <button onClick={() => setEditMember(emptyStaff())} className="btn-clay btn-clay-teal h-[64px] px-10">
           <Plus size={16} /> Enroll New Unit
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Active Staff', value: totalActive, colorClass: 'text-hc-teal' },
          { label: 'Off_Sick', value: totalSickness, colorClass: 'text-hc-red' },
          { label: 'Sickness_Load', value: totalSicknessEvents, colorClass: 'text-hc-amber' },
          { label: 'Latency_Events', value: totalLatenessEvents, colorClass: 'text-hc-muted' },
        ].map(kpi => (
          <div key={kpi.label} className="hc-clay-raised p-8 flex flex-col gap-4">
             <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em]">{kpi.label}</div>
             <div className={`text-4xl font-black tabular-nums transition-all ${kpi.colorClass}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="hc-clay-raised p-6 flex flex-col md:flex-row gap-6 items-center">
        <div className="relative group flex-1">
           <Search className="w-5 h-5 text-hc-muted absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-hc-teal transition-colors" />
           <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff records..." 
              className="hc-clay-inset w-full pl-12 pr-6 py-4 text-sm font-bold text-hc-text outline-none focus:ring-2 focus:ring-hc-teal/20" />
        </div>
        <div className="flex items-center gap-4">
           <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em]">Sector_Lock:</span>
            <SearchSelect options={[{ value: 'all', label: 'ALL SECTORS' }, ...HAZELCARE_HOUSES.map(h => ({ value: h, label: h }))]} value={houseFilter} onChange={setHouseFilter} className="min-w-[200px]" />
        </div>
      </div>

      <div className="space-y-16">
        {Object.entries(byHouse).sort(([a], [b]) => a.localeCompare(b)).map(([house, members]) => (
          <div key={house} className="flex flex-col gap-8">
             <div className="flex items-center gap-6 p-4">
                <h2 className="text-2xl font-black text-hc-text tracking-tighter uppercase">{house} Team</h2>
                <div className="hc-clay-pill px-4 py-1.5 hc-clay-raised text-[11px] font-black text-hc-teal uppercase">{members.length} UNITS</div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                {members.map((member) => (
                   <div key={member.id} className="hc-clay-raised p-8 flex flex-col gap-8 group/card transition-all hover:translate-y-[-6px]">
                      <div className="flex items-center justify-between">
                         <div className="w-14 h-14 rounded-2xl hc-clay-inset flex items-center justify-center text-xl font-black text-hc-teal">
                            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                         </div>
                         <div className={`px-4 py-1.5 hc-clay-raised text-[11px] font-black uppercase tracking-widest ${member.status === 'active' ? 'text-hc-teal' : 'text-hc-red'}`}>
                            {member.status}
                         </div>
                      </div>

                      {integrityScores[member.name] !== undefined && (
                        <div className={`absolute -top-3 -right-3 h-8 px-4 rounded-full hc-clay-raised flex items-center justify-center text-[10px] font-black uppercase tracking-widest z-10 animate-in zoom-in duration-500 ${integrityScores[member.name] >= 70 ? 'text-flag-green bg-flag-green/10' : 'text-flag-red bg-flag-red/10 glow-red animate-pulse'}`}>
                          {integrityScores[member.name]}% Integrity
                        </div>
                      )}

                      <div>
                         <div className="text-lg font-black text-hc-text tracking-tight mb-1">{member.name}</div>
                         <div className="text-[11px] font-bold text-hc-muted uppercase tracking-[0.2em]">{member.role}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-6">
                         <div className="flex flex-col items-center">
                            <span className={`text-xl font-black tabular-nums transition-all ${member.sicknessThisMonth > 2 ? 'text-hc-red' : 'text-hc-text'}`}>{member.sicknessThisMonth}</span>
                            <span className="text-[11px] font-black text-hc-muted uppercase">SICK</span>
                         </div>
                         <div className="flex flex-col items-center">
                            <span className="text-xl font-black tabular-nums text-hc-text">{member.latenessThisMonth}</span>
                            <span className="text-[11px] font-black text-hc-muted uppercase">LATE</span>
                         </div>
                         <div className="flex flex-col items-center">
                            <span className="text-xl font-black tabular-nums text-hc-teal">{member.nextSupervision ? daysUntil(member.nextSupervision) + 'D' : '—'}</span>
                            <span className="text-[11px] font-black text-hc-muted uppercase">SUP.</span>
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
          <div className="text-lg font-black text-hc-text mb-2 uppercase tracking-tight">Staff Directory Empty</div>
          <div className="text-[11px] text-hc-muted uppercase tracking-[0.4em] font-bold">Clear sector filters or enroll a new unit to activate intelligence.</div>
        </div>
      )}

      {editMember && <StaffModal staff={editMember} onSave={saveMember} onClose={() => setEditMember(null)} />}
      {docDrawerMember && <StaffDocumentDrawer staff={docDrawerMember} onClose={() => setDocDrawerMember(null)} />}
    </div>
  );
}
