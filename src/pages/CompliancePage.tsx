import { useState, useMemo } from 'react';
import {
  loadComplianceStaff, saveComplianceStaff,
  loadComplianceAudits, saveComplianceAudits,
  uid, daysUntil, staffStatus,
  HAZELCARE_HOUSES, ROLES, AUDIT_TYPES,
  type ComplianceStaff, type ComplianceAudit,
} from '../lib/compliance-store';

// ============================================================
// ADD / EDIT STAFF MODAL
// ============================================================
function emptyStaff(): ComplianceStaff {
  return { id: uid(), name: '', role: 'Support Worker', house: HAZELCARE_HOUSES[0], dbsExpiry: '', trainingExpiry: '', nextSupervision: '', supervisionFreq: 4 };
}

function StaffModal({ staff, onSave, onClose }: { staff: ComplianceStaff; onSave: (s: ComplianceStaff) => void; onClose: () => void }) {
  const [form, setForm] = useState<ComplianceStaff>({ ...staff });
  const set = (k: keyof ComplianceStaff, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0c1525] border border-[#1e3050] rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1e3050]">
          <h3 className="text-sm font-bold text-white">{staff.id && staff.name ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Full Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Amy Rogers"
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Role</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">House</label>
              <select value={form.house} onChange={e => set('house', e.target.value)}
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500">
                {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">DBS Expiry</label>
              <input value={form.dbsExpiry} onChange={e => set('dbsExpiry', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Training Expiry</label>
              <input value={form.trainingExpiry} onChange={e => set('trainingExpiry', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Next Supervision</label>
              <input value={form.nextSupervision} onChange={e => set('nextSupervision', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => { if (form.name.trim()) onSave(form); }}
              disabled={!form.name.trim()}
              className="flex-1 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-40">
              Save
            </button>
            <button onClick={onClose} className="px-5 py-2.5 bg-[#0a1120] border border-[#1e3050] text-sm text-gray-400 rounded-xl hover:text-white">
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0c1525] border border-[#1e3050] rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1e3050]">
          <h3 className="text-sm font-bold text-white">Add Audit Record</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">House</label>
              <select value={form.house} onChange={e => set('house', e.target.value)}
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500">
                {HAZELCARE_HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Audit Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value as ComplianceAudit['type'])}
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500">
                {AUDIT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Last Completed</label>
              <input value={form.lastCompleted} onChange={e => set('lastCompleted', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Next Due</label>
              <input value={form.dueDate} onChange={e => set('dueDate', e.target.value)} placeholder="DD/MM/YYYY"
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Completed By</label>
              <input value={form.completedBy} onChange={e => set('completedBy', e.target.value)} placeholder="Staff name"
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any findings or actions"
                className="w-full bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-teal-500 resize-none" rows={2} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => onSave(form)} className="flex-1 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold py-2.5 rounded-xl">Save</button>
            <button onClick={onClose} className="px-5 py-2.5 bg-[#0a1120] border border-[#1e3050] text-sm text-gray-400 rounded-xl hover:text-white">Cancel</button>
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
  if (status === 'overdue') return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-900/60 text-red-400">OVERDUE</span>;
  if (status === 'due_soon') return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400">DUE SOON</span>;
  return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">OK</span>;
}

function DaysChip({ dateStr, warnDays = 30 }: { dateStr: string; warnDays?: number }) {
  if (!dateStr) return <span className="text-[10px] text-gray-600">No date set</span>;
  const d = daysUntil(dateStr);
  if (d < 0) return <span className="text-[10px] text-red-400">{Math.abs(d)}d overdue</span>;
  if (d < warnDays) return <span className="text-[10px] text-amber-400">{d}d left</span>;
  return <span className="text-[10px] text-gray-500">{dateStr}</span>;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
type Tab = 'overview' | 'staff' | 'audits';

export function CompliancePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [staffList, setStaffList] = useState<ComplianceStaff[]>(loadComplianceStaff);
  const [audits, setAudits] = useState<ComplianceAudit[]>(loadComplianceAudits);
  const [editStaff, setEditStaff] = useState<ComplianceStaff | null>(null);
  const [editAudit, setEditAudit] = useState<ComplianceAudit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [houseFilter, setHouseFilter] = useState('all');

  function saveStaff(s: ComplianceStaff) {
    const updated = staffList.find(x => x.id === s.id)
      ? staffList.map(x => x.id === s.id ? s : x)
      : [...staffList, s];
    setStaffList(updated);
    saveComplianceStaff(updated);
    setEditStaff(null);
  }

  function deleteStaff(id: string) {
    const updated = staffList.filter(s => s.id !== id);
    setStaffList(updated);
    saveComplianceStaff(updated);
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

    for (const s of staffList) {
      if (s.dbsExpiry) out.push({ label: `DBS — ${s.name}`, house: s.house, person: s.name, date: s.dbsExpiry, type: 'DBS', status: staffStatus(s.dbsExpiry, 60) });
      if (s.trainingExpiry) out.push({ label: `Training — ${s.name}`, house: s.house, person: s.name, date: s.trainingExpiry, type: 'Training', status: staffStatus(s.trainingExpiry, 30) });
      if (s.nextSupervision) out.push({ label: `Supervision — ${s.name}`, house: s.house, person: s.name, date: s.nextSupervision, type: 'Supervision', status: staffStatus(s.nextSupervision, 7) });
    }

    for (const a of audits) {
      const cfg = AUDIT_TYPES.find(t => t.id === a.type);
      out.push({ label: `${cfg?.label || a.type} — ${a.house}`, house: a.house, person: a.completedBy, date: a.dueDate, type: cfg?.label || a.type, status: staffStatus(a.dueDate, 14), notes: a.notes });
    }

    return out;
  }, [staffList, audits]);

  const overdue = items.filter(i => i.status === 'overdue');
  const dueSoon = items.filter(i => i.status === 'due_soon');
  const ok = items.filter(i => i.status === 'ok');
  const compRate = items.length > 0 ? Math.round((ok.length / items.length) * 100) : 100;
  const compColor = compRate >= 90 ? '#22c55e' : compRate >= 70 ? '#f59e0b' : '#ef4444';

  const filteredStaff = houseFilter === 'all' ? staffList : staffList.filter(s => s.house === houseFilter);

  const housesInAudits = [...new Set(audits.map(a => a.house))].sort();

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white mb-1">Compliance Hub</h1>
          <p className="text-sm text-gray-500">DBS · Training · Supervisions · Audits · {staffList.length} staff tracked</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditStaff(emptyStaff())}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold rounded-xl">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Staff
          </button>
          <button onClick={() => setEditAudit(emptyAudit())}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0a1120] border border-[#1e3050] text-xs text-gray-400 rounded-xl hover:text-white hover:border-teal-700">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Add Audit
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0a1120] border border-[#1e3050] rounded-xl p-4">
          <div className="text-[10px] text-gray-500 mb-1">Compliance Rate</div>
          <div className="text-2xl font-black" style={{ color: compColor }}>{compRate}%</div>
          <div className="text-[10px] text-gray-600">{items.length} items tracked</div>
        </div>
        <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4">
          <div className="text-[10px] text-red-400 mb-1">Overdue</div>
          <div className="text-2xl font-black text-red-400">{overdue.length}</div>
          <div className="text-[10px] text-gray-600">Need action now</div>
        </div>
        <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4">
          <div className="text-[10px] text-amber-400 mb-1">Due Soon</div>
          <div className="text-2xl font-black text-amber-400">{dueSoon.length}</div>
          <div className="text-[10px] text-gray-600">Within 30 days</div>
        </div>
        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4">
          <div className="text-[10px] text-emerald-400 mb-1">Compliant</div>
          <div className="text-2xl font-black text-emerald-400">{ok.length}</div>
          <div className="text-[10px] text-gray-600">Up to date</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0a1120] border border-[#1e3050] rounded-xl p-1 mb-5 w-fit">
        {([['overview', 'Overview'], ['staff', 'Staff Register'], ['audits', 'Audit Log']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-xs rounded-lg font-medium transition-all ${tab === id ? 'bg-teal-800/60 text-teal-300 border border-teal-700/40' : 'text-gray-500 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* === OVERVIEW TAB === */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {staffList.length === 0 && audits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#0a1120] border border-[#1e3050] flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <p className="text-gray-400 font-semibold mb-1">No compliance records yet</p>
              <p className="text-sm text-gray-600 max-w-sm mb-5">Add staff members with their DBS, training, and supervision dates. Add audit records to track medication, fire safety, and CQC checks.</p>
              <button onClick={() => setEditStaff(emptyStaff())} className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">Add First Staff Member</button>
            </div>
          )}

          {overdue.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2">Overdue — {overdue.length} items</h2>
              <div className="space-y-1.5">
                {overdue.map((item, i) => (
                  <div key={i} className="bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-white">{item.label}</div>
                      <div className="text-[10px] text-gray-500">{item.house} · <DaysChip dateStr={item.date} /></div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-900/60 text-red-400">OVERDUE</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dueSoon.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-2">Due Soon — {dueSoon.length} items</h2>
              <div className="space-y-1.5">
                {dueSoon.map((item, i) => (
                  <div key={i} className="bg-amber-950/10 border border-amber-900/20 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-white">{item.label}</div>
                      <div className="text-[10px] text-gray-500">{item.house} · <DaysChip dateStr={item.date} /></div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400">DUE SOON</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ok.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-2">Compliant — {ok.length} items</h2>
              <div className="bg-[#0a1120] border border-[#1e3050] rounded-xl px-4 py-3 text-sm text-gray-500">
                {ok.length} items up to date across all houses.
              </div>
            </div>
          )}
        </div>
      )}

      {/* === STAFF REGISTER TAB === */}
      {tab === 'staff' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)}
              className="bg-[#0a1120] border border-[#1e3050] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500">
              <option value="all">All Houses ({staffList.length})</option>
              {HAZELCARE_HOUSES.map(h => {
                const c = staffList.filter(s => s.house === h).length;
                return c > 0 ? <option key={h} value={h}>{h} ({c})</option> : null;
              })}
            </select>
            <span className="text-xs text-gray-600">{filteredStaff.length} staff member{filteredStaff.length !== 1 ? 's' : ''}</span>
          </div>

          {filteredStaff.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm mb-4">No staff added yet.</p>
              <button onClick={() => setEditStaff(emptyStaff())} className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">Add Staff Member</button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStaff.map(s => {
                const dbsS = staffStatus(s.dbsExpiry, 60);
                const trainS = staffStatus(s.trainingExpiry, 30);
                const supS = staffStatus(s.nextSupervision, 7);
                const worst = [dbsS, trainS, supS].includes('overdue') ? 'overdue' : [dbsS, trainS, supS].includes('due_soon') ? 'due_soon' : 'ok';
                return (
                  <div key={s.id} className={`bg-[#0a1120] border rounded-xl px-4 py-3 ${worst === 'overdue' ? 'border-red-900/40' : worst === 'due_soon' ? 'border-amber-900/30' : 'border-[#1e3050]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-9 h-9 rounded-full bg-teal-900/40 flex items-center justify-center text-[11px] font-bold text-teal-400 shrink-0">
                          {s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-white">{s.name}</div>
                          <div className="text-[10px] text-gray-500">{s.role} · {s.house}</div>
                          <div className="flex flex-wrap gap-3 mt-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500">DBS</span>
                              <DaysChip dateStr={s.dbsExpiry} warnDays={60} />
                              <StatusBadge status={dbsS} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500">Training</span>
                              <DaysChip dateStr={s.trainingExpiry} />
                              <StatusBadge status={trainS} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500">Supervision</span>
                              <DaysChip dateStr={s.nextSupervision} warnDays={7} />
                              <StatusBadge status={supS} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => setEditStaff(s)} className="text-[10px] text-gray-500 hover:text-white border border-[#1e3050] px-2.5 py-1 rounded-lg hover:border-teal-700">Edit</button>
                        {deleteConfirm === s.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => deleteStaff(s.id)} className="text-[10px] text-red-400 border border-red-900/40 px-2.5 py-1 rounded-lg">Confirm</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-[10px] text-gray-500 border border-[#1e3050] px-2.5 py-1 rounded-lg">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(s.id)} className="text-[10px] text-gray-600 hover:text-red-400 border border-[#1e3050] px-2.5 py-1 rounded-lg">Delete</button>
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
        <div>
          {audits.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm mb-4">No audit records yet. Track medication audits, fire safety, CQC checks and more.</p>
              <button onClick={() => setEditAudit(emptyAudit())} className="bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">Add Audit Record</button>
            </div>
          ) : (
            <div>
              {/* Group by type */}
              {AUDIT_TYPES.map(atype => {
                const typeAudits = audits.filter(a => a.type === atype.id).sort((a, b) => a.house.localeCompare(b.house));
                if (typeAudits.length === 0) return null;
                return (
                  <div key={atype.id} className="mb-5">
                    <h2 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: atype.color }}>{atype.label}</h2>
                    <div className="space-y-1.5">
                      {typeAudits.map(a => {
                        const s = staffStatus(a.dueDate, 14);
                        return (
                          <div key={a.id} className={`bg-[#0a1120] border rounded-xl px-4 py-3 flex items-center gap-3 ${s === 'overdue' ? 'border-red-900/40' : s === 'due_soon' ? 'border-amber-900/30' : 'border-[#1e3050]'}`}>
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-white">{a.house}</div>
                              <div className="flex items-center gap-3 mt-0.5">
                                {a.lastCompleted && <span className="text-[10px] text-gray-500">Last: {a.lastCompleted}</span>}
                                {a.dueDate && <span className="text-[10px] text-gray-500">Due: <DaysChip dateStr={a.dueDate} warnDays={14} /></span>}
                                {a.completedBy && <span className="text-[10px] text-gray-600">by {a.completedBy}</span>}
                              </div>
                              {a.notes && <div className="text-[10px] text-gray-500 mt-1 italic">{a.notes}</div>}
                            </div>
                            <StatusBadge status={s} />
                            <button onClick={() => deleteAudit(a.id)} className="text-gray-600 hover:text-red-400 ml-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Houses with no audits */}
              {HAZELCARE_HOUSES.filter(h => !housesInAudits.includes(h)).length > 0 && (
                <div className="mt-4 p-4 bg-amber-950/10 border border-amber-900/20 rounded-xl">
                  <p className="text-xs text-amber-400 font-semibold mb-1">Houses with no audit records:</p>
                  <p className="text-xs text-gray-500">{HAZELCARE_HOUSES.filter(h => !housesInAudits.includes(h)).join(' · ')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {editStaff && <StaffModal staff={editStaff} onSave={saveStaff} onClose={() => setEditStaff(null)} />}
      {editAudit && <AuditModal audit={editAudit} onSave={saveAudit} onClose={() => setEditAudit(null)} />}
    </div>
  );
}
