import { useState, useMemo } from 'react';
import {
  loadComplianceAudits, saveComplianceAudits,
  uid, daysUntil, staffStatus,
  HAZELCARE_HOUSES, ROLES, AUDIT_TYPES,
  type ComplianceAudit,
} from '../lib/compliance-store';
import type { StaffMember } from '../lib/types';

// ============================================================
// ADD / EDIT STAFF MODAL
// ============================================================
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="glass border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-teal/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="p-8 border-b border-white/5 relative z-10">
          <h3 className="text-2xl font-black text-white tracking-tighter text-shimmer">{staff.id && staff.name ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
          <p className="text-xs font-semibold text-hc-muted uppercase tracking-[0.08em] mt-1">Compliance and roster details</p>
        </div>
        <div className="p-8 space-y-6 relative z-10">
          <div className="space-y-4">
            <div className="group">
              <label className="section-header mb-2 ml-1 block opacity-90">Full Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Sarah Mitchell"
                className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all focus:bg-hc-dark" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="section-header mb-2 ml-1 block opacity-90">Job Role</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="section-header mb-2 ml-1 block opacity-90">Primary House</label>
                <select value={form.house} onChange={e => set('house', e.target.value)}
                  className="w-full bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner">
                  {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">DBS Expiry</label>
              <input value={form.dbsExpiry} onChange={e => set('dbsExpiry', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">Training Expiry</label>
              <input value={form.trainingExpiry} onChange={e => set('trainingExpiry', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">Next Supervision</label>
              <input value={form.nextSupervision} onChange={e => set('nextSupervision', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
          </div>
          
          <div className="flex gap-4 pt-4">
            <button onClick={() => { if (form.name.trim()) onSave(form); }}
              disabled={!form.name.trim()}
              className="flex-[2] btn-gradient disabled:opacity-20 text-white text-[11px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-all">
              Save Staff Member
            </button>
            <button onClick={onClose} className="flex-1 glass-light border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-white py-4 rounded-2xl transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AUDIT MODAL
// ============================================================
function emptyAudit(house = HAZELCARE_HOUSES[0]): ComplianceAudit {
  return { id: uid(), house, type: 'medication', lastCompleted: '', dueDate: '', completedBy: '', notes: '' };
}

function AuditModal({ audit, onSave, onClose }: { audit: ComplianceAudit; onSave: (a: ComplianceAudit) => void; onClose: () => void }) {
  const [form, setForm] = useState<ComplianceAudit>({ ...audit });
  const set = (k: keyof ComplianceAudit, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="glass border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-blue/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="p-8 border-b border-white/5 relative z-10">
          <h3 className="text-2xl font-black text-white tracking-tighter text-shimmer">Log Service Audit</h3>
          <p className="text-xs font-semibold text-hc-muted uppercase tracking-[0.08em] mt-1">Quality control and compliance audit</p>
        </div>
        <div className="p-8 space-y-6 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">House</label>
              <select value={form.house} onChange={e => set('house', e.target.value)}
                className="w-full bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner">
                {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">Audit Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value as ComplianceAudit['type'])}
                className="w-full bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner">
                {AUDIT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">Last Completed</label>
              <input value={form.lastCompleted} onChange={e => set('lastCompleted', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
            <div>
              <label className="section-header mb-2 ml-1 block opacity-90">Next Due</label>
              <input value={form.dueDate} onChange={e => set('dueDate', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
            <div className="col-span-2">
              <label className="section-header mb-2 ml-1 block opacity-90">Completed By</label>
              <input value={form.completedBy} onChange={e => set('completedBy', e.target.value)} placeholder="Name"
                className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 shadow-inner" />
            </div>
            <div className="col-span-2">
              <label className="section-header mb-2 ml-1 block opacity-90">Findings and Observations</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Summary of findings..."
                className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 shadow-inner resize-none" rows={3} />
            </div>
          </div>
          <div className="flex gap-4 pt-2">
            <button onClick={() => onSave(form)} className="flex-[2] btn-gradient text-white text-[11px] font-black uppercase tracking-[0.2em] py-4 rounded-xl shadow-xl hover:scale-[1.02] transition-all">Save Audit Result</button>
            <button onClick={onClose} className="flex-1 glass-light border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-white py-4 rounded-xl transition-all">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STATUS BADGE
// ============================================================
function StatusBadge({ status }: { status: 'ok' | 'due_soon' | 'overdue' }) {
  if (status === 'overdue') return <span className="pill pill-red text-xs font-black px-2 shadow-lg animate-pulse-soft">OVERDUE</span>;
  if (status === 'due_soon') return <span className="pill pill-amber text-xs font-black px-2 shadow-lg">DUE SOON</span>;
  return <span className="pill pill-green text-xs font-black px-2 opacity-80">COMPLIANT</span>;
}

function DaysChip({ dateStr, warnDays = 30 }: { dateStr: string; warnDays?: number }) {
  if (!dateStr) return <span className="text-[10px] text-hc-muted/40 font-bold uppercase italic tracking-widest">—</span>;
  const d = daysUntil(dateStr);
  if (d < 0) return <span className="text-[10px] text-flag-red font-black tabular-nums">{Math.abs(d)}D OVERDUE</span>;
  if (d < warnDays) return <span className="text-[10px] text-flag-amber font-black tabular-nums">{d}D REMAINING</span>;
  return <span className="text-[10px] text-hc-text font-black tabular-nums tracking-widest">{dateStr}</span>;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
type Tab = 'overview' | 'staff' | 'audits';

interface Props {
  staff: StaffMember[];
  onUpdate: (staff: StaffMember[]) => void;
}

export function CompliancePage({ staff, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [audits, setAudits] = useState<ComplianceAudit[]>(loadComplianceAudits);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [editAudit, setEditAudit] = useState<ComplianceAudit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [houseFilter, setHouseFilter] = useState('all');

  function saveStaffRecord(s: StaffMember) {
    const updated = staff.find(x => x.id === s.id)
      ? staff.map(x => x.id === s.id ? s : x)
      : [...staff, s];
    onUpdate(updated);
    setEditStaff(null);
  }

  function deleteStaffRecord(id: string) {
    onUpdate(staff.filter(s => s.id !== id));
    setDeleteConfirm(null);
  }

  function saveAudit(a: ComplianceAudit) {
    const updated = audits.find(x => x.id === a.id)
      ? audits.map(x => x.id === a.id ? a : x)
      : [...audits, a];
    setAudits(updated);
    saveComplianceAudits(updated);
    setEditAudit(null);
  }

  function deleteAudit(id: string) {
    const updated = audits.filter(a => a.id !== id);
    setAudits(updated);
    saveComplianceAudits(updated);
  }

  // Build compliance items from staff + audits
  const items = useMemo(() => {
    const out: { label: string; house: string; person: string; date: string; type: string; status: 'ok' | 'due_soon' | 'overdue'; notes?: string }[] = [];

    for (const s of staff) {
      if (s.dbsExpiry) out.push({ label: `DBS Renewal — ${s.name}`, house: s.house, person: s.name, date: s.dbsExpiry, type: 'DBS', status: staffStatus(s.dbsExpiry, 60) });
      if (s.trainingExpiry) out.push({ label: `Staff Training — ${s.name}`, house: s.house, person: s.name, date: s.trainingExpiry, type: 'Training', status: staffStatus(s.trainingExpiry, 30) });
      if (s.nextSupervision) out.push({ label: `Staff Supervision — ${s.name}`, house: s.house, person: s.name, date: s.nextSupervision, type: 'Supervision', status: staffStatus(s.nextSupervision, 7) });
    }

    for (const a of audits) {
      const cfg = AUDIT_TYPES.find(t => t.id === a.type);
      out.push({ label: `${cfg?.label || a.type} Audit — ${a.house}`, house: a.house, person: a.completedBy, date: a.dueDate, type: cfg?.label || a.type, status: staffStatus(a.dueDate, 14), notes: a.notes });
    }

    return out;
  }, [staff, audits]);

  const overdue = items.filter(i => i.status === 'overdue');
  const dueSoon = items.filter(i => i.status === 'due_soon');
  const ok = items.filter(i => i.status === 'ok');
  const compRate = items.length > 0 ? Math.round((ok.length / items.length) * 100) : 100;
  const compColor = compRate >= 90 ? '#22c55e' : compRate >= 70 ? '#f59e0b' : '#ef4444';

  const filteredStaff = houseFilter === 'all' ? staff : staff.filter(s => s.house === houseFilter);

  const housesInAudits = [...new Set(audits.map(a => a.house))].sort();

  return (
    <div className="p-6 lg:p-10 xl:px-16 2xl:px-24 w-full animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white mb-1 tracking-tight text-shimmer">Compliance & Quality</h1>
          <div className="flex items-center gap-3">
            <span className="pill pill-teal text-[10px] font-black uppercase tracking-wider shadow-lg">Compliance Status</span>
            <p className="text-hc-muted text-[10px] font-bold uppercase tracking-widest ml-1">
              DBS · Training · Supervision · Service Audits
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setEditAudit(emptyAudit())}
            className="flex items-center gap-2.5 glass-light border border-white/10 text-hc-muted hover:text-white text-[10px] font-black uppercase tracking-[0.2em] px-5 py-3 rounded-xl transition-all hover:bg-white/5 hover:border-hc-blue/30 group shadow-xl">
            <svg className="w-4 h-4 text-hc-blue group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Log Audit
          </button>
          <button onClick={() => setEditStaff(emptyStaff())}
            className="flex items-center gap-2.5 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl shadow-xl transition-all hover:scale-105">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Staff Member
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'OVERALL COMPLIANCE', value: `${compRate}%`, color: compColor, sub: `${items.length} items tracked` },
          { label: 'OVERDUE ITEMS', value: overdue.length, color: '#ef4444', sub: 'Action required', glow: 'glow-red' },
          { label: 'DUE SOON', value: dueSoon.length, color: '#f59e0b', sub: 'Next 30 days', glow: 'glow-amber' },
          { label: 'COMPLIANT ITEMS', value: ok.length, color: '#22c55e', sub: 'Status: Good' },
        ].map(s => (
          <div key={s.label} className={`glass-light border border-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-5 shadow-xl transition-all duration-500 hover:scale-[1.02] active:scale-95 group relative overflow-hidden cursor-default ${s.glow || ''}`}>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.05] group-hover:opacity-[0.1] transition-opacity blur-3xl -translate-y-1/2 translate-x-1/2" style={{ background: s.color }} />
            <div className="section-header text-[8px] md:text-[9px] mb-1.5 opacity-60 tracking-[0.15em]">{s.label}</div>
            <div className="text-2xl md:text-3xl font-black tabular-nums tracking-tighter" style={{ color: s.color, textShadow: `0 0 30px ${s.color}40` }}>{s.value}</div>
            <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest mt-2 opacity-40 group-hover:opacity-100 transition-opacity">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-black/20 backdrop-blur-md rounded-xl p-1 border border-white/5 shadow-xl mb-6 w-fit mx-auto md:mx-0">
        {(['overview', 'staff', 'audits'] as const).map(id => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-[1.25rem] transition-all duration-500 ease-out active:scale-95
              ${tab === id ? 'bg-hc-teal/20 text-hc-teal-light border border-hc-teal/30 shadow-lg scale-105 z-10' : 'text-hc-muted hover:text-white hover:bg-white/5'}`}>
            {id === 'overview' ? 'Overview' : id === 'staff' ? 'Staff Records' : 'Audit Logs'}
          </button>
        ))}
      </div>

      {/* === OVERVIEW TAB === */}
      {tab === 'overview' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {staff.length === 0 && audits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center glass border border-white/5 rounded-[2.5rem]">
              <div className="w-20 h-20 rounded-3xl glass border border-white/10 flex items-center justify-center mb-6 glow-blue opacity-30 group">
                <svg className="w-10 h-10 text-hc-muted group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Compliance Data</h2>
              <p className="text-sm text-hc-muted max-w-sm mb-10 font-medium leading-relaxed opacity-80">Add staff profiles and log audits to start tracking compliance.</p>
              <button onClick={() => setEditStaff(emptyStaff())} className="btn-gradient px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all">Add Staff Member</button>
            </div>
          )}

          {overdue.length > 0 && (
            <div className="animate-in slide-in-from-left-4 duration-700">
              <div className="flex items-center gap-3 mb-5 px-2">
                <div className="w-2 h-6 rounded-full bg-flag-red glow-red animate-pulse" />
                <h2 className="text-lg font-black text-white tracking-tight uppercase">Critical Overdue — {overdue.length} Items</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {overdue.map((item, i) => (
                  <div key={i} className="glass-light border border-flag-red/30 bg-flag-red/[0.03] rounded-2xl px-6 py-5 flex items-center gap-5 shadow-xl group card-glow interactive-row">
                    <div className="w-10 h-10 rounded-xl bg-flag-red/10 border border-flag-red/20 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-flag-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-black text-white group-hover:text-flag-red transition-colors truncate tracking-tight">{item.label}</div>
                      <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest mt-1 opacity-60">{item.house} · <DaysChip dateStr={item.date} /></div>
                    </div>
                    <StatusBadge status="overdue" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {dueSoon.length > 0 && (
            <div className="animate-in slide-in-from-left-4 duration-700 delay-150">
              <div className="flex items-center gap-3 mb-5 px-2">
                <div className="w-2 h-6 rounded-full bg-flag-amber glow-amber" />
                <h2 className="text-lg font-black text-white tracking-tight uppercase">Upcoming Expiries — {dueSoon.length} Items</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dueSoon.map((item, i) => (
                  <div key={i} className="glass-light border border-flag-amber/20 bg-flag-amber/[0.01] rounded-2xl px-5 py-4 flex items-center gap-4 shadow-lg group card-glow interactive-row">
                    <div className="w-8 h-8 rounded-lg bg-flag-amber/10 border border-flag-amber/20 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-flag-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-12 0 9 9 0 0112 0z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-black text-white group-hover:text-flag-amber transition-colors truncate tracking-tight">{item.label}</div>
                      <div className="text-[9px] font-bold text-hc-muted uppercase tracking-widest mt-0.5 opacity-60">{item.house} · <DaysChip dateStr={item.date} /></div>
                    </div>
                    <StatusBadge status="due_soon" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {ok.length > 0 && overdue.length === 0 && (
            <div className="animate-in slide-in-from-left-4 duration-700 delay-300">
              <div className="flex items-center gap-3 mb-5 px-2">
                <div className="w-2 h-6 rounded-full bg-flag-green shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                <h2 className="text-lg font-black text-white tracking-tight uppercase">Compliant Status — {ok.length} Items</h2>
              </div>
              <div className="glass-light border border-white/5 rounded-[2rem] px-8 py-6 text-sm text-hc-muted font-medium flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-flag-green/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-flag-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <span className="text-white font-black uppercase tracking-widest block mb-0.5">Service-Wide Compliance</span>
                    <span>All compliance checks are up to date across the service.</span>
                  </div>
                </div>
                <div className="pill pill-teal text-[10px] font-black px-4 py-1 animate-pulse-soft shadow-lg">GOOD STATUS</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === STAFF REGISTER TAB === */}
      {tab === 'staff' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-700">
          <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 glass-light border border-white/5 p-5 rounded-[2rem] shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <span className="section-header text-[10px] tracking-[0.2em]">Filter by House</span>
              <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)}
                className="bg-hc-dark/80 border border-white/10 rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-wider text-white focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[220px]">
                <option value="all">All Staff Members ({staff.length})</option>
                {HAZELCARE_HOUSES.map(h => {
                  const c = staff.filter(s => s.house === h).length;
                  return c > 0 ? <option key={h} value={h}>{h} ({c})</option> : null;
                })}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-black text-hc-teal-light/60 uppercase tracking-[0.2em] tabular-nums">Showing: {filteredStaff.length} Staff</span>
            </div>
          </div>

          {filteredStaff.length === 0 ? (
            <div className="text-center py-32 glass border border-white/5 rounded-[2.5rem]">
              <div className="text-5xl mb-6 opacity-20 grayscale">👥</div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Profiles Found</h2>
              <p className="text-sm text-hc-muted max-w-sm mx-auto mb-10 font-medium leading-relaxed opacity-80">Adjust filter or add a new staff member.</p>
              <button onClick={() => setEditStaff(emptyStaff())} className="btn-gradient px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all">Add Staff Profile</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredStaff.map((s, idx) => {
                const dbsS = staffStatus(s.dbsExpiry || '', 60);
                const trainS = staffStatus(s.trainingExpiry || '', 30);
                const supS = staffStatus(s.nextSupervision || '', 7);
                const worst = [dbsS, trainS, supS].includes('overdue') ? 'overdue' : [dbsS, trainS, supS].includes('due_soon') ? 'due_soon' : 'ok';
                return (
                  <div key={s.id} className={`glass-light border transition-all duration-500 rounded-[2rem] overflow-hidden card-glow group animate-in slide-in-from-bottom-4
                    ${worst === 'overdue' ? 'border-flag-red/30 bg-flag-red/[0.02] glow-red' : worst === 'due_soon' ? 'border-flag-amber/25 bg-flag-amber/[0.01] glow-amber' : 'border-white/5 hover:border-white/10'}`}
                    style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.03] blur-[60px] -translate-y-1/2 translate-x-1/2 transition-opacity group-hover:opacity-[0.06]" style={{ background: worst === 'overdue' ? '#ef4444' : worst === 'due_soon' ? '#f59e0b' : '#14b8a6' }} />
                      
                      <div className="flex items-center gap-6 flex-1 min-w-0 relative z-10">
                        <div className="w-16 h-16 rounded-2xl glass border border-white/10 flex items-center justify-center text-xl font-black text-hc-teal-light shrink-0 shadow-xl transition-transform group-hover:scale-110 duration-500">
                          {s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xl font-black text-white group-hover:text-hc-teal-light transition-colors tracking-tighter leading-none mb-1.5">{s.name}</div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest opacity-60">{s.role}</span>
                            <span className="w-1 h-1 rounded-full bg-white/10" />
                            <span className="text-[10px] font-black text-hc-teal-light uppercase tracking-widest">{s.house}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-8 relative z-10 md:px-10 md:border-x md:border-white/5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-50">DBS EXPIRY</span>
                          <div className="flex items-center gap-2">
                            <DaysChip dateStr={s.dbsExpiry || ''} warnDays={60} />
                            <StatusBadge status={dbsS} />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-50">TRAINING DUE</span>
                          <div className="flex items-center gap-2">
                            <DaysChip dateStr={s.trainingExpiry || ''} />
                            <StatusBadge status={trainS} />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-50">SUPERVISION</span>
                          <div className="flex items-center gap-2">
                            <DaysChip dateStr={s.nextSupervision || ''} warnDays={7} />
                            <StatusBadge status={supS} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 relative z-10 shrink-0 ml-auto">
                        <button onClick={() => setEditStaff(s)} className="w-10 h-10 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-white hover:bg-hc-teal/10 hover:border-hc-teal/30 transition-all shadow-lg group/btn">
                          <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {deleteConfirm === s.id ? (
                          <div className="flex gap-2 animate-in slide-in-from-right-4 duration-300">
                            <button onClick={() => deleteStaffRecord(s.id)} className="px-4 py-2 bg-flag-red/20 border border-flag-red/40 text-flag-red text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-flag-red/30 shadow-lg">DELETE</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 glass-light border border-white/10 text-hc-muted text-[10px] font-black uppercase tracking-widest rounded-xl hover:text-white">CANCEL</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(s.id)} className="w-10 h-10 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-flag-red hover:bg-flag-red/5 hover:border-flag-red/30 transition-all shadow-lg group/btn">
                            <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === AUDIT LOG TAB === */}
      {tab === 'audits' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {audits.length === 0 ? (
            <div className="text-center py-32 glass border border-white/5 rounded-[2.5rem]">
              <div className="w-20 h-20 rounded-3xl glass border border-white/10 flex items-center justify-center mb-6 glow-blue opacity-30 mx-auto">
                <svg className="w-10 h-10 text-hc-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Audit Logs Yet</h2>
              <p className="text-sm text-hc-muted max-w-md mx-auto mb-10 font-medium leading-relaxed opacity-80">Service audits for medication, fire safety, and environmental checks are pending initialization.</p>
              <button onClick={() => setEditAudit(emptyAudit())} className="btn-gradient px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all">Add Audit Record</button>
            </div>
          ) : (
            <div className="space-y-12">
              {AUDIT_TYPES.map((atype, groupIdx) => {
                const typeAudits = audits.filter(a => a.type === atype.id).sort((a, b) => a.house.localeCompare(b.house));
                if (typeAudits.length === 0) return null;
                return (
                  <div key={atype.id} className="animate-in slide-in-from-bottom-6 duration-700" style={{ animationDelay: `${groupIdx * 100}ms` }}>
                    <div className="flex items-center gap-4 mb-5 px-2">
                      <h3 className="text-lg font-black uppercase tracking-tight text-white transition-all" style={{ color: atype.color }}>
                        {atype.label} Records
                      </h3>
                      <span className="pill pill-teal text-[10px] font-black px-3">{typeAudits.length} Audits</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {typeAudits.map(a => {
                        const s = staffStatus(a.dueDate, 14);
                        return (
                          <div key={a.id} className={`glass-light border transition-all duration-500 rounded-[1.5rem] p-6 flex flex-col card-glow interactive-row
                            ${s === 'overdue' ? 'border-flag-red/30 bg-flag-red/[0.02] glow-red' : s === 'due_soon' ? 'border-flag-amber/25 bg-flag-amber/[0.01] glow-amber' : 'border-white/5 hover:border-white/10'}`}>
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="text-[15px] font-black text-white group-hover:text-hc-teal-light transition-colors tracking-tight leading-none mb-1.5">{a.house}</div>
                                <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-60">Service Audit</div>
                              </div>
                              <StatusBadge status={s} />
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-6 mb-6 pb-5 border-b border-white/5">
                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-50">LAST COMPLETED</span>
                                <span className="text-[11px] font-bold text-white/80 tabular-nums tracking-widest">{a.lastCompleted || 'PENDING'}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-50">NEXT DUE</span>
                                <DaysChip dateStr={a.dueDate} warnDays={14} />
                              </div>
                              <div className="flex flex-col gap-1 ml-auto text-right">
                                <span className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] opacity-50">COMPLETED BY</span>
                                <span className="text-[10px] font-black text-hc-teal-light uppercase tracking-widest">{a.completedBy || 'UNASSIGNED'}</span>
                              </div>
                            </div>
                            
                            {a.notes && (
                              <div className="mb-6 p-4 bg-black/20 rounded-xl border border-white/5">
                                <div className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em] mb-2 opacity-50">Audit Findings</div>
                                <p className="text-[11px] font-medium text-hc-text leading-relaxed italic opacity-80 group-hover:opacity-100 transition-opacity">"{a.notes}"</p>
                              </div>
                            )}
                            
                            <div className="mt-auto flex items-center justify-end gap-3 pt-2">
                              <button onClick={() => deleteAudit(a.id)} className="w-9 h-9 rounded-xl glass border border-white/5 flex items-center justify-center text-hc-muted hover:text-flag-red hover:bg-flag-red/5 hover:border-flag-red/30 transition-all opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Houses with no audits */}
              {HAZELCARE_HOUSES.filter(h => !housesInAudits.includes(h)).length > 0 && (
                <div className="animate-in slide-in-from-bottom-4 duration-700 delay-500">
                  <div className="glass border border-flag-amber/30 bg-flag-amber/[0.02] rounded-[2rem] p-8 shadow-2xl glow-amber relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-flag-amber/5 blur-[80px] -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                      <div className="w-16 h-16 rounded-2xl bg-flag-amber/10 border border-flag-amber/20 flex items-center justify-center shrink-0">
                        <svg className="w-8 h-8 text-flag-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-1">Audit Gaps Identified</h3>
                        <p className="text-sm text-flag-amber/70 font-medium leading-relaxed mb-4">The following houses have no documented audit activity. Quality assurance coverage is currently missing.</p>
                        <div className="flex flex-wrap gap-2">
                          {HAZELCARE_HOUSES.filter(h => !housesInAudits.includes(h)).map(h => (
                            <span key={h} className="pill pill-amber text-[10px] font-black px-3 py-1 shadow-lg">{h}</span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setEditAudit(emptyAudit())} className="ml-auto btn-gradient px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all">Log Audit</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {editStaff && <StaffModal staff={editStaff} onSave={saveStaffRecord} onClose={() => setEditStaff(null)} />}
      {editAudit && <AuditModal audit={editAudit} onSave={saveAudit} onClose={() => setEditAudit(null)} />}
    </div>
  );
}
