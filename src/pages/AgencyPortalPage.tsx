import { useState, useCallback } from 'react';
import { ORG_CONFIG } from '../lib/config';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ShiftUrgency = 'critical' | 'urgent' | 'standard';
type ShiftStatus = 'open' | 'submitted' | 'confirmed' | 'filled';
type WorkerStatus = 'submitted' | 'dbs_check' | 'training_check' | 'confirmed' | 'active' | 'declined';

interface Shift {
  id: string;
  house: string;
  date: string;
  time: string;
  hours: number;
  role: string;
  rate: number;
  urgency: ShiftUrgency;
  status: ShiftStatus;
  notes?: string;
}

interface AgencyWorker {
  id: string;
  name: string;
  role: string;
  agency: string;
  dbsRef: string;
  dbsExpiry: string;
  trainingExpiry: string;
  rightToWork: boolean;
  status: WorkerStatus;
  shiftId: string;
  submittedAt: string;
  phone: string;
}

interface Agency {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  fillRate: number;
  responseTime: string;
  activeWorkers: number;
  complianceScore: number;
  tier: 'preferred' | 'approved' | 'provisional';
}

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────

const LS_SHIFTS = 'hc-agency-shifts';
const LS_WORKERS = 'hc-agency-workers';
const LS_AGENCIES = 'hc-agencies';
const LS_RATES = 'hc-rate-cards';

function lsLoad<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function lsSave<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────

const DEFAULT_SHIFTS: Shift[] = [];
const DEFAULT_WORKERS: AgencyWorker[] = [];
const DEFAULT_AGENCIES: Agency[] = [];

const DEFAULT_RATE_CARDS = [
  { role: 'Support Worker',         day: 0, evening: 0, night: 0, weekend: 0, bank_hol: 0 },
  { role: 'Senior Support Worker',  day: 0, evening: 0, night: 0, weekend: 0, bank_hol: 0 },
  { role: 'Team Leader',            day: 0, evening: 0, night: 0, weekend: 0, bank_hol: 0 },
  { role: 'Registered Manager Cover', day: 0, evening: 0, night: 0, weekend: 0, bank_hol: 0 },
];

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: ShiftUrgency }) {
  if (urgency === 'critical') return <span className="pill pill-red animate-pulse-soft text-[11px] font-black uppercase tracking-widest shadow-lg">⚡ Critical</span>;
  if (urgency === 'urgent') return <span className="pill pill-amber text-[11px] font-black uppercase tracking-widest shadow-md">Urgent</span>;
  return <span className="pill pill-blue text-[11px] font-black uppercase tracking-widest text-hc-muted">Standard Booking</span>;
}

function StatusBadge({ status }: { status: ShiftStatus | WorkerStatus }) {
  const map: Record<string, string> = {
    open: 'pill-teal',
    submitted: 'pill-blue',
    confirmed: 'pill-green shadow-lg shadow-green-900/20',
    filled: 'pill-blue text-hc-muted',
    dbs_check: 'pill-amber animate-pulse-soft',
    training_check: 'pill-purple',
    active: 'pill-green',
    declined: 'pill-red',
  };
  const labels: Record<string, string> = {
    open: 'Open', submitted: 'Submitted', confirmed: 'Confirmed', filled: 'Filled',
    dbs_check: 'DBS Check', training_check: 'Training Check', active: 'Active', declined: 'Declined',
  };
  return (
    <span className={`pill ${map[status] ?? 'pill-blue'} text-[11px] font-black uppercase tracking-widest shadow-sm`}>
      {labels[status] ?? status}
    </span>
  );
}

function TierBadge({ tier }: { tier: Agency['tier'] }) {
  if (tier === 'preferred') return <span className="pill pill-teal text-[11px] font-black uppercase tracking-widest shadow-lg glow-teal">★★★ Preferred</span>;
  if (tier === 'approved') return <span className="pill pill-blue text-[11px] font-black uppercase tracking-widest shadow-md">★★☆ Approved</span>;
  return <span className="pill pill-amber text-[11px] font-black uppercase tracking-widest text-hc-muted">★☆☆ Provisional</span>;
}

function WorkerPipeline({ status }: { status: WorkerStatus }) {
  const steps: { key: WorkerStatus; label: string }[] = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'dbs_check', label: 'DBS' },
    { key: 'training_check', label: 'Training' },
    { key: 'confirmed', label: 'Verify' },
    { key: 'active', label: 'Book' },
  ];
  const order = ['submitted', 'dbs_check', 'training_check', 'confirmed', 'active'];
  const currentIdx = order.indexOf(status);

  return (
    <div className="flex items-center gap-2 mt-4 hc-clay-inset p-3 rounded-2xl border border-white/5">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <div key={step.key} className="flex-1 flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all duration-500
                ${done ? 'bg-hc-teal border-hc-teal text-hc-text shadow-lg' : current ? 'bg-hc-teal/20 border-hc-teal text-hc-teal-light shadow-lg animate-pulse' : 'bg-white/5 border-white/10 text-hc-muted'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-[11px] font-black uppercase tracking-widest ${current ? 'text-hc-teal-light' : done ? 'text-hc-text/60' : 'text-hc-muted'}`}>{step.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-4 h-px ${i < currentIdx ? 'bg-hc-teal' : 'bg-white/10'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB: SHIFT BOARD ─────────────────────────────────────────────────────────

function ShiftBoard({ shifts, onAddWorker, onAddShift }: { shifts: Shift[]; onAddWorker: (w: AgencyWorker) => void; onAddShift: (s: Shift) => void }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'submitted' | 'confirmed'>('all');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [submitWorker, setSubmitWorker] = useState({ name: '', role: '', agency: '', dbs: '', phone: '' });
  const [submitted, setSubmitted] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShift, setNewShift] = useState({ house: '', date: '', time: '', hours: '8', role: 'Support Worker', urgency: 'standard' as ShiftUrgency, notes: '' });

  const filtered = shifts.filter(s => filter === 'all' || s.status === filter);
  const open = shifts.filter(s => s.status === 'open').length;
  const critical = shifts.filter(s => s.urgency === 'critical' && s.status === 'open').length;
  const filled = shifts.filter(s => s.status === 'filled' || s.status === 'confirmed').length;
  const totalHours = shifts.filter(s => s.status === 'open').reduce((a, s) => a + s.hours, 0);

  return (
    <div className="space-y-4 lg:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Open Shifts', value: open, color: '#14b8a6', sub: 'Shifts needing cover' },
          { label: 'Critical Gaps', value: critical, color: '#ef4444', sub: 'Immediate fill required', glow: 'glow-red' },
          { label: 'Confirmed Cover', value: filled, color: '#22c55e', sub: 'Shifts filled' },
          { label: 'Network Hours', value: `${totalHours}H`, color: '#f59e0b', sub: 'Total hours booked' },
        ].map(s => (
          <div key={s.label} className={`hc-clay-raised border border-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-5 shadow-xl transition-all duration-500 hover:scale-[1.02] active:scale-95 group relative overflow-hidden cursor-default ${s.glow || ''}`}>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.05] group-hover:opacity-[0.1] transition-opacity blur-3xl -translate-y-1/2 translate-x-1/2" style={{ background: s.color }} />
            <div className="text-2xl md:text-3xl font-black tabular-nums tracking-tighter" style={{ color: s.color, textShadow: `0 0 20px ${s.color}40` }}>{s.value}</div>
                  <div className="section-header text-hc-text text-xs mt-2 tracking-[0.08em]">{s.label}</div>
                  <div className="text-hc-muted text-xs font-semibold uppercase tracking-[0.08em] mt-2 group-hover:opacity-100 transition-opacity">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Add Shift */}
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAddShift(v => !v)} className="px-6 py-2.5 btn-tactical rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl">+ Log New Shift</button>
      </div>
      {showAddShift && (
        <div className="hc-clay-inset p-6 rounded-2xl border border-hc-teal/20 mb-6 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {[
              { key: 'house', label: 'House', placeholder: 'House name' },
              { key: 'date', label: 'Date (DD/MM/YYYY)', placeholder: 'e.g. 01/05/2026' },
              { key: 'time', label: 'Time', placeholder: 'e.g. 07:00–15:00' },
              { key: 'hours', label: 'Hours', placeholder: '8' },
              { key: 'role', label: 'Role', placeholder: 'Support Worker' },
              { key: 'notes', label: 'Notes (optional)', placeholder: 'Any special requirements' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-1 block">{f.label}</label>
                <input placeholder={f.placeholder}
                  value={(newShift as Record<string, string>)[f.key]}
                  onChange={e => setNewShift(s => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full hc-clay-raised border border-white/10 rounded-xl px-3 py-2 text-xs text-hc-text placeholder:text-hc-muted/30 focus:outline-none focus:border-hc-teal/50" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <select value={newShift.urgency} onChange={e => setNewShift(s => ({ ...s, urgency: e.target.value as ShiftUrgency }))}
              className="hc-clay-raised border border-white/10 rounded-xl px-3 py-2 text-xs text-hc-text focus:outline-none">
              <option value="standard">Standard</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select>
            <button onClick={() => {
              if (!newShift.house || !newShift.date) return;
              onAddShift({ id: `s_${Date.now()}`, house: newShift.house, date: newShift.date, time: newShift.time, hours: Number(newShift.hours) || 8, role: newShift.role || 'Support Worker', rate: 0, urgency: newShift.urgency, status: 'open', notes: newShift.notes || undefined });
              setNewShift({ house: '', date: '', time: '', hours: '8', role: 'Support Worker', urgency: 'standard', notes: '' });
              setShowAddShift(false);
            }} className="px-6 py-2 btn-tactical rounded-xl text-[11px] font-black uppercase tracking-widest">Save Shift</button>
            <button onClick={() => setShowAddShift(false)} className="px-4 py-2 text-[11px] font-black text-hc-muted hover:text-hc-text uppercase">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 hc-clay-inset backdrop-blur-md rounded-2xl p-1.5 border border-white/5 w-fit shadow-2xl mb-8">
        {(['all', 'open', 'submitted', 'confirmed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.08em] transition-all duration-500 ease-out active:scale-90
              ${filter === f ? 'bg-hc-teal/20 text-hc-teal-light border border-hc-teal/30 shadow-lg scale-105 z-10' : 'text-hc-muted hover:text-hc-text hover:bg-white/5'}`}>
            {f === 'all' ? 'Entire Feed' : f}
          </button>
        ))}
      </div>

      {/* Shift cards */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((shift, idx) => (
          <div key={shift.id}
            className={`hc-clay-raised border transition-all duration-500 rounded-[2.5rem] p-8 cursor-pointer card-glow group/shift active:scale-[0.99] animate-in slide-in-from-left-4
              ${shift.urgency === 'critical' && shift.status === 'open' ? 'border-flag-red/40 bg-flag-red/[0.03] glow-red shadow-flag-red/5' : 'border-white/10 hover:border-hc-teal/30'}
              ${selectedShift?.id === shift.id ? 'border-hc-teal/50 bg-hc-teal/[0.05] ring-1 ring-hc-teal/30 shadow-2xl scale-[1.01] z-10' : ''}`}
            style={{ animationDelay: `${idx * 50}ms` }}
            onClick={() => setSelectedShift(selectedShift?.id === shift.id ? null : shift)}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4 flex-wrap mb-4 transition-transform duration-500 group-hover/shift:translate-x-1">
                  <span className="text-xl font-black text-hc-text group-hover/shift:text-hc-teal-light transition-colors tracking-tighter uppercase">{shift.house}</span>
                  <UrgencyBadge urgency={shift.urgency} />
                  <StatusBadge status={shift.status} />
                </div>
                <div className="flex items-center gap-8 text-hc-muted text-[11px] font-black uppercase tracking-[0.2em] flex-wrap group-hover/shift:opacity-100 transition-all duration-500 group-hover/shift:translate-x-1">
                  <div className="flex items-center gap-2.5"><span className="text-xl leading-none grayscale group-hover/shift:grayscale-0 transition-all">📅</span> {shift.date}</div>
                  <div className="flex items-center gap-2.5"><span className="text-xl leading-none grayscale group-hover/shift:grayscale-0 transition-all">🕐</span> {shift.time}</div>
                  <div className="flex items-center gap-2.5 text-hc-teal-light/80"><span className="text-xl leading-none">👤</span> {shift.role}</div>
                </div>
                {shift.notes && (
                  <div className="mt-6 p-4 hc-clay-inset rounded-2xl border border-white/5 flex items-start gap-4 transition-transform duration-500 group-hover/shift:translate-x-1 shadow-inner">
                    <span className="text-amber-400 mt-0.5 animate-pulse">⚠</span>
                    <p className="text-[12px] font-medium text-hc-text leading-relaxed italic opacity-80 group-hover/shift:opacity-100">"{shift.notes}"</p>
                  </div>
                )}
              </div>
              <div className="text-right shrink-0 flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 md:pl-10 md:border-l md:border-white/5 relative">
                <div className="text-4xl font-black text-hc-text tabular-nums tracking-tighter shadow-2xl group-hover/shift:scale-110 transition-transform duration-700">{shift.hours}H</div>
                <div className="pill pill-teal text-[11px] font-black uppercase tracking-[0.3em] py-1 px-3 shadow-lg text-hc-muted group-hover/shift:opacity-100 transition-all">TRANSMISSION LOAD</div>
              </div>
            </div>

            {/* Expanded submit form */}
            {selectedShift?.id === shift.id && shift.status === 'open' && (
              <div className="mt-8 pt-8 border-t border-white/5 animate-in slide-in-from-top-4 duration-500" onClick={e => e.stopPropagation()}>
                {!submitted ? (
                  <div className="max-w-2xl">
                    <h3 className="section-header text-hc-text text-[10px] mb-6 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
                      Staffing Request
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {[
                        { key: 'name', label: 'Full Name', placeholder: "Worker's name" },
                        { key: 'role', label: 'Job Role', placeholder: 'Role title' },
                        { key: 'agency', label: 'Agency', placeholder: 'Agency name' },
                        { key: 'dbs', label: 'DBS Number', placeholder: 'DBS reference' },
                        { key: 'phone', label: 'Phone Number', placeholder: 'Contact number' },
                      ].map(f => (
                        <div key={f.key} className={f.key === 'name' ? 'md:col-span-2' : ''}>
                          <label className="section-header text-hc-muted text-[11px] mb-1.5 ml-1 block">{f.label}</label>
                          <input placeholder={f.placeholder}
                            value={(submitWorker as Record<string, string>)[f.key]}
                            onChange={e => setSubmitWorker(w => ({ ...w, [f.key]: e.target.value }))}
                            className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-hc-text placeholder:text-hc-muted/20 focus:outline-none focus:border-hc-teal/50 shadow-inner" />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-4">
                      <button onClick={() => setSelectedShift(null)} className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-hc-muted hover:text-hc-text transition-all">Cancel</button>
                      <button onClick={() => {
                        if (!submitWorker.name.trim()) return;
                        onAddWorker({
                          id: `w_${Date.now()}`,
                          name: submitWorker.name,
                          role: submitWorker.role || selectedShift!.role,
                          agency: submitWorker.agency,
                          dbsRef: submitWorker.dbs,
                          dbsExpiry: '',
                          trainingExpiry: '',
                          rightToWork: false,
                          status: 'submitted',
                          shiftId: selectedShift!.id,
                          submittedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' today',
                          phone: submitWorker.phone,
                        });
                        setSubmitted(true);
                        setSubmitWorker({ name: '', role: '', agency: '', dbs: '', phone: '' });
                      }}
                        className="px-10 py-3 btn-gradient text-hc-text text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-xl hover:scale-105 transition-all">
                        Submit Worker Details →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="hc-clay-raised border-2 border-flag-green/30 bg-flag-green/[0.02] rounded-3xl p-8 text-center glow-teal shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-flag-green/5 blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="w-16 h-16 rounded-2xl bg-flag-green/10 border border-flag-green/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-flag-green/10">
                      <svg className="w-8 h-8 text-flag-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div className="text-lg font-black text-hc-text uppercase tracking-tight mb-2">Request Sent</div>
                    <p className="text-sm text-hc-muted font-medium max-w-sm mx-auto mb-6">{ORG_CONFIG.name} will check the worker's details and respond within 2 hours.</p>
                    <button onClick={() => { setSubmitted(false); setSelectedShift(null); }} className="text-hc-teal-light text-[10px] font-black uppercase tracking-[0.3em] hover:text-hc-text transition-all underline decoration-hc-teal/30 underline-offset-8 decoration-2">Back to Shifts</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkerPipelinePage({ workers, shifts, onUpdateWorker }: { workers: AgencyWorker[]; shifts: Shift[]; onUpdateWorker: (w: AgencyWorker) => void }) {
  const stageCounts = [
    workers.filter(w => w.status === 'submitted').length,
    workers.filter(w => w.status === 'dbs_check').length,
    workers.filter(w => w.status === 'training_check').length,
    workers.filter(w => w.status === 'confirmed').length,
    workers.filter(w => w.status === 'active').length,
  ];
  const STAGE_ORDER: WorkerStatus[] = ['submitted', 'dbs_check', 'training_check', 'confirmed', 'active'];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        {['Requests', 'DBS Check', 'Audit', 'Verified', 'Active'].map((label, i) => (
          <div key={label} className="hc-clay-raised border border-white/5 rounded-2xl p-5 text-center shadow-lg group hover:bg-white/5 transition-all">
            <div className="text-2xl font-black text-hc-teal-light tabular-nums tracking-tighter mb-1">{stageCounts[i]}</div>
            <div className="section-header text-hc-muted text-[11px] tracking-[0.2em]">{label}</div>
          </div>
        ))}
      </div>

      {workers.length === 0 && (
        <div className="text-center py-20 opacity-30 text-[11px] font-black uppercase tracking-widest text-hc-muted">No workers submitted yet</div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {workers.map((w, idx) => {
          const shift = shifts.find(s => s.id === w.shiftId);
          const isDeclined = w.status === 'declined';
          return (
            <div key={w.id} className={`hc-clay-raised border transition-all duration-500 rounded-[2rem] p-6 card-glow group animate-in slide-in-from-bottom-4
              ${isDeclined ? 'border-flag-red/30 bg-flag-red/[0.02] glow-red' : 'border-white/5 hover:border-white/10'}`}
              style={{ animationDelay: `${idx * 100}ms` }}>
              <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    <div className="w-12 h-12 rounded-xl hc-clay-inset border border-white/10 flex items-center justify-center text-lg font-black text-hc-teal-light shadow-xl group-hover:scale-110 transition-transform duration-500">
                      {w.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-lg font-black text-hc-text group-hover:text-hc-teal-light transition-colors tracking-tighter leading-none mb-1">{w.name}</div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={w.status} />
                        <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest">via {w.agency} Hub</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 text-hc-muted text-[10px] font-bold uppercase tracking-widest px-2">
                    <div className="flex items-center gap-2">Role title: <span className="text-hc-text/80">{w.role}</span></div>
                    <div className="flex items-center gap-2">Phone: <span className="text-hc-text/80 tabular-nums">{w.phone}</span></div>
                    {shift && (
                      <div className="flex items-center gap-2 text-hc-teal-light">
                        Assigned To: <span className="font-black underline decoration-hc-teal/30">{shift.house} — {shift.date}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 hc-clay-inset p-4 rounded-2xl border border-white/5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">SECURITY SCAN (DBS)</span>
                      <span className={`text-[10px] font-black tabular-nums ${w.dbsExpiry > '06/2026' ? 'text-flag-green' : 'text-flag-red'}`}>{w.dbsRef} (exp {w.dbsExpiry})</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">TRAINING AUDIT</span>
                      <span className="text-[10px] font-black text-hc-text/80 tabular-nums uppercase tracking-widest">VALID UNTIL {w.trainingExpiry}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.2em]">LEGAL RTW STATUS</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${w.rightToWork ? 'text-flag-green' : 'text-flag-red'}`}>{w.rightToWork ? '✓ Verified' : '✗ Not Verified'}</span>
                    </div>
                  </div>

                  {w.status !== 'declined' ? <WorkerPipeline status={w.status} /> : (
                    <div className="mt-6 hc-clay-inset border border-flag-red/30 bg-flag-red/[0.05] rounded-2xl p-5 flex items-start gap-4 animate-in shake duration-500">
                      <div className="w-10 h-10 rounded-xl bg-flag-red/10 border border-flag-red/20 flex items-center justify-center shrink-0 shadow-lg">
                        <svg className="w-6 h-6 text-flag-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-hc-text uppercase tracking-[0.1em] mb-1">Booking Blocked</div>
                        <p className="text-xs font-medium text-flag-red/80 leading-relaxed italic">"This worker's DBS has expired. Please provide an updated DBS certificate before booking."</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0 pt-2">
                  <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] tabular-nums">CAPTURED {w.submittedAt}</div>
                  {w.status !== 'declined' && w.status !== 'active' && (
                    <div className="flex gap-2">
                      <button onClick={() => {
                        const idx2 = STAGE_ORDER.indexOf(w.status);
                        if (idx2 < STAGE_ORDER.length - 1) onUpdateWorker({ ...w, status: STAGE_ORDER[idx2 + 1] });
                      }} className="px-3 py-1.5 btn-tactical rounded-lg text-[10px] font-black uppercase">Advance &rsaquo;</button>
                      <button onClick={() => onUpdateWorker({ ...w, status: 'declined' })} className="px-3 py-1.5 hc-clay-raised border border-flag-red/30 text-flag-red rounded-lg text-[10px] font-black uppercase hover:bg-flag-red/10 transition-all">Decline</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgencyDirectory({ agencies, onAddAgency }: { agencies: Agency[]; onAddAgency: (a: Agency) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', contact: '', email: '', phone: '' });

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center justify-between px-2">
        <div className="section-header text-[11px] text-hc-muted tracking-[0.3em] uppercase">{agencies.length} REGISTERED HUB ENTITIES · RANKED BY VECTOR PERFORMANCE</div>
        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-2 px-5 py-2 hc-clay-raised border border-hc-teal/20 text-hc-teal-light text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-hc-teal/10 hover:text-hc-text hover:border-hc-teal/40 transition-all shadow-xl">+ Initialize Hub</button>
      </div>

      {showAdd && (
        <div className="hc-clay-inset p-5 rounded-2xl border border-hc-teal/20 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { key: 'name', label: 'Agency Name', placeholder: 'e.g. Cucumber Recruitment' },
              { key: 'contact', label: 'Contact Name', placeholder: 'Account manager' },
              { key: 'email', label: 'Email', placeholder: 'contact@agency.co.uk' },
              { key: 'phone', label: 'Phone', placeholder: '0800 000 0000' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-black text-hc-muted uppercase tracking-widest mb-1 block">{f.label}</label>
                <input placeholder={f.placeholder} value={(newAgency as Record<string, string>)[f.key]}
                  onChange={e => setNewAgency(a => ({ ...a, [f.key]: e.target.value }))}
                  className="w-full hc-clay-raised border border-white/10 rounded-xl px-3 py-2 text-xs text-hc-text placeholder:text-hc-muted/30 focus:outline-none focus:border-hc-teal/50" />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => {
              if (!newAgency.name.trim()) return;
              onAddAgency({ id: `a_${Date.now()}`, name: newAgency.name, contact: newAgency.contact, email: newAgency.email, phone: newAgency.phone, fillRate: 0, responseTime: 'TBC', activeWorkers: 0, complianceScore: 0, tier: 'provisional' });
              setNewAgency({ name: '', contact: '', email: '', phone: '' });
              setShowAdd(false);
            }} className="px-6 py-2 btn-tactical rounded-xl text-[11px] font-black uppercase tracking-widest">Add Agency</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-[11px] font-black text-hc-muted hover:text-hc-text uppercase">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {[...agencies].sort((a, b) => b.fillRate - a.fillRate).map((agency, i) => (
          <div key={agency.id}
            className={`hc-clay-raised border transition-all duration-500 rounded-[2.5rem] p-6 cursor-pointer card-glow group
              ${selected === agency.id ? 'border-hc-teal/40 bg-hc-teal/[0.04] shadow-2xl' : 'border-white/5 hover:border-white/10'}`}
            onClick={() => setSelected(selected === agency.id ? null : agency.id)}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.03] blur-[60px] -translate-y-1/2 translate-x-1/2 transition-opacity group-hover:opacity-[0.06]" style={{ background: '#14b8a6' }} />
              
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-4 flex-wrap mb-3">
                  <div className="w-12 h-12 rounded-xl hc-clay-inset border border-white/10 flex items-center justify-center text-lg font-black text-hc-teal-light shadow-xl group-hover:scale-110 transition-transform duration-500">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-xl font-black text-hc-text group-hover:text-hc-teal-light transition-colors tracking-tighter leading-none mb-1">{agency.name}</div>
                    <div className="flex items-center gap-3">
                      <TierBadge tier={agency.tier} />
                      {agency.activeWorkers > 0 && (
                        <span className="pill pill-teal text-[11px] font-black px-3 py-0.5 shadow-lg shadow-hc-teal/10 animate-pulse-soft">{agency.activeWorkers} ACTIVE WORKERS</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-hc-muted text-[10px] font-bold uppercase tracking-widest mt-4 flex flex-wrap gap-x-6 gap-y-2 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2">Link: <span className="text-hc-text/80">{agency.contact}</span></div>
                  <div className="flex items-center gap-2">Stream: <span className="text-hc-text/80 lowercase">{agency.email}</span></div>
                  <div className="flex items-center gap-2">Phone: <span className="text-hc-text/80 tabular-nums">{agency.phone}</span></div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8 text-center shrink-0 relative z-10 md:pl-10 md:border-l md:border-white/5">
                <div className="group/stat">
                  <div className={`text-2xl font-black tabular-nums tracking-tighter transition-transform group-hover/stat:scale-110 ${agency.fillRate >= 80 ? 'text-flag-green' : agency.fillRate >= 65 ? 'text-flag-amber' : 'text-flag-red'}`}>{agency.fillRate}%</div>
                  <div className="section-header text-hc-muted text-[11px] tracking-[0.2em]">FILL RATE</div>
                </div>
                <div className="group/stat">
                  <div className="text-2xl font-black text-hc-text/80 tabular-nums tracking-tighter transition-transform group-hover/stat:scale-110">{agency.responseTime}</div>
                  <div className="section-header text-hc-muted text-[11px] tracking-[0.2em]">LATENCY</div>
                </div>
                <div className="group/stat">
                  <div className={`text-2xl font-black tabular-nums tracking-tighter transition-transform group-hover/stat:scale-110 ${agency.complianceScore >= 90 ? 'text-flag-green' : agency.complianceScore >= 75 ? 'text-flag-amber' : 'text-flag-red'}`}>{agency.complianceScore}%</div>
                  <div className="section-header text-hc-muted text-[11px] tracking-[0.2em]">INTEGRITY</div>
                </div>
              </div>
            </div>

            {selected === agency.id && (
              <div className="mt-8 pt-8 border-t border-white/5 animate-in slide-in-from-top-4 duration-500 relative z-10">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Cumulative Syncs', value: `${Math.round(agency.fillRate * 2.3)}` },
                    { label: 'Avg Latency Cycle', value: agency.responseTime },
                    { label: 'Active Workers', value: agency.activeWorkers },
                    { label: 'Integrity Rating', value: `${agency.complianceScore}%` },
                  ].map(s => (
                    <div key={s.label} className="hc-clay-inset rounded-2xl border border-white/5 p-4 text-center shadow-inner group/sub">
                      <div className="text-lg font-black text-hc-teal-light group-hover/sub:scale-110 transition-transform tabular-nums">{s.value}</div>
                      <div className="section-header text-hc-muted text-[11px] mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <button className="flex-1 btn-gradient text-hc-text text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-all">Send Booking Request</button>
                  <button className="px-8 hc-clay-raised border border-white/10 text-hc-text/60 hover:text-hc-text text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all">View History</button>
                  <button className="px-8 hc-clay-raised border border-white/10 text-hc-text/60 hover:text-hc-text text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all">Contact Agency</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type RateCard = typeof DEFAULT_RATE_CARDS[number];

function RateCards({ rateCards, onUpdateRate }: { rateCards: RateCard[]; onUpdateRate: (rates: RateCard[]) => void }) {
  const fields: (keyof Omit<RateCard, 'role'>)[] = ['day', 'evening', 'night', 'weekend', 'bank_hol'];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="hc-clay-raised border border-hc-teal/30 bg-hc-teal/[0.03] rounded-2xl px-8 py-6 flex items-center gap-6 shadow-2xl glow-teal relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-hc-teal/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="w-12 h-12 rounded-2xl bg-hc-teal/10 flex items-center justify-center shrink-0 shadow-lg">
          <span className="text-2xl animate-pulse-soft">💰</span>
        </div>
        <p className="text-xs font-medium text-hc-teal-light leading-relaxed relative z-10">
          <span className="font-black uppercase tracking-widest block mb-1">Cost Alert:</span>
          {ORG_CONFIG.fullName} agency rates are verified directly with the agency. Current data reflects standard rates. Contact the office for a confirmed quote.
        </p>
      </div>

      <div className="hc-clay-raised border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left">
            <thead>
              <tr className="hc-clay-inset border-b border-white/5">
                <th className="px-8 py-5 section-header text-[10px] tracking-[0.2em]">Operational Role title</th>
                <th className="px-6 py-5 section-header text-[10px] tracking-[0.2em] text-center">Day Cycle<br/><span className="text-hc-muted text-[11px] font-bold">07:00–19:00</span></th>
                <th className="px-6 py-5 section-header text-[10px] tracking-[0.2em] text-center">Evening Shift<br/><span className="text-hc-muted text-[11px] font-bold">15:00–23:00</span></th>
                <th className="px-6 py-5 section-header text-[10px] tracking-[0.2em] text-center">Night Patrol<br/><span className="text-hc-muted text-[11px] font-bold">23:00–07:00</span></th>
                <th className="px-6 py-5 section-header text-[10px] tracking-[0.2em] text-center">Weekend Ops<br/><span className="text-hc-muted text-[11px] font-bold">Sat & Sun</span></th>
                <th className="px-8 py-5 section-header text-[10px] tracking-[0.2em] text-center">Bank Alert<br/><span className="text-flag-amber text-[11px] font-bold">×1.5 Multiplier</span></th>
              </tr>
            </thead>
            <tbody>
              {rateCards.map((r, idx) => (
                <tr key={r.role} className={`group hover:bg-white/[0.03] transition-colors border-b border-white/5 ${idx === rateCards.length - 1 ? 'border-none' : ''}`}>
                  <td className="px-8 py-6">
                    <div className="text-sm font-black text-hc-text group-hover:text-hc-teal-light transition-colors uppercase tracking-tight">{r.role}</div>
                    <div className="text-hc-muted text-[11px] font-bold uppercase tracking-widest mt-1">Cover Level</div>
                  </td>
                  {fields.map(f => (
                    <td key={f} className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-hc-muted text-[10px]">£</span>
                        <input
                          type="number"
                          step="0.50"
                          min="0"
                          value={r[f] || ''}
                          placeholder="0.00"
                          onChange={e => {
                            const updated = rateCards.map((rc, i) => i === idx ? { ...rc, [f]: parseFloat(e.target.value) || 0 } : rc);
                            onUpdateRate(updated);
                          }}
                          className="w-16 text-center hc-clay-inset border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-black text-hc-text focus:outline-none focus:border-hc-teal/50 bg-transparent"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { title: 'Mandatory Compliance', items: ['Enhanced DBS DBS Check (< 3y)', 'Right to Work check', 'Mandatory Training completed', 'Two verified references', 'Health declaration'] },
          { title: 'Specialist Requirements', items: ['PBS trained', 'Autism & learning disability awareness', 'Positive behaviour support', 'Critical First Aid Verified', 'Medication trained'] },
          { title: 'Payment Terms', items: ['Weekly timesheets', 'Invoices within 12 hours', 'Payment within 30 days', '5-day dispute window', 'BACS payment only'] },
        ].map((section, idx) => (
          <div key={section.title} className="hc-clay-raised border border-white/5 rounded-3xl p-6 shadow-xl card-glow animate-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 150}ms` }}>
            <div className="text-xs font-black text-hc-teal-light mb-5 uppercase tracking-[0.2em] flex items-center gap-3">
              <span className="w-1 h-4 rounded-full bg-hc-teal" />
              {section.title}
            </div>
            <ul className="space-y-3">
              {section.items.map(item => (
                <li key={item} className="text-[11px] font-medium text-hc-text/70 flex items-start gap-3 group/li">
                  <span className="text-hc-teal-light/40 group-hover/li:text-hc-teal-light transition-colors mt-0.5">▹</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type TabId = 'shifts' | 'pipeline' | 'agencies' | 'rates';

export function AgencyPortalPage() {
  const [tab, setTab] = useState<TabId>('shifts');
  const [shifts, setShifts] = useState<Shift[]>(() => lsLoad(LS_SHIFTS, DEFAULT_SHIFTS));
  const [workers, setWorkers] = useState<AgencyWorker[]>(() => lsLoad(LS_WORKERS, DEFAULT_WORKERS));
  const [agencies, setAgencies] = useState<Agency[]>(() => lsLoad(LS_AGENCIES, DEFAULT_AGENCIES));
  const [rateCards, setRateCards] = useState(() => lsLoad(LS_RATES, DEFAULT_RATE_CARDS));

  const saveShifts = useCallback((s: Shift[]) => { setShifts(s); lsSave(LS_SHIFTS, s); }, []);
  const saveWorkers = useCallback((w: AgencyWorker[]) => { setWorkers(w); lsSave(LS_WORKERS, w); }, []);
  const saveAgencies = useCallback((a: Agency[]) => { setAgencies(a); lsSave(LS_AGENCIES, a); }, []);
  const saveRates = useCallback((r: typeof DEFAULT_RATE_CARDS) => { setRateCards(r); lsSave(LS_RATES, r); }, []);

  const openShifts = shifts.filter(s => s.status === 'open').length;
  const criticalShifts = shifts.filter(s => s.urgency === 'critical' && s.status === 'open').length;
  const pendingWorkers = workers.filter(w => w.status !== 'active' && w.status !== 'declined').length;

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'shifts', label: 'Shift Board', badge: openShifts },
    { id: 'pipeline', label: 'Worker Pipeline', badge: pendingWorkers },
    { id: 'agencies', label: 'Agency List' },
    { id: 'rates', label: 'Rate Cards' },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-[1700px] mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl md:text-2xl font-black text-hc-text tracking-tighter text-shimmer">Agency Staff</h1>
            {criticalShifts > 0 && (
              <span className="pill pill-red animate-pulse-soft text-xs font-black uppercase tracking-[0.08em] shadow-xl shadow-red-950/20 px-4">
                {criticalShifts} Critical Gaps
              </span>
            )}
          </div>
          <p className="text-hc-muted text-sm font-medium opacity-80 max-w-2xl leading-relaxed">
            Monitoring shift coverage, worker bookings, and agency compliance across all houses.
          </p>
        </div>
        
        <div className="flex gap-4">
          {[
            { label: 'Active Gaps', value: openShifts, color: '#14b8a6', pill: 'pill-teal' },
            { label: 'In Scan', value: pendingWorkers, color: '#f59e0b', pill: 'pill-amber' },
            { label: 'Approved Hubs', value: agencies.length, color: '#3b82f6', pill: 'pill-blue' },
          ].map(stat => (
            <div key={stat.label} className="hc-clay-raised border border-white/5 rounded-2xl px-6 py-4 text-center min-w-[120px] shadow-xl group cursor-default">
              <div className="text-2xl font-black tabular-nums tracking-tighter group-hover:scale-110 transition-transform duration-500" style={{ color: stat.color }}>{stat.value}</div>
              <div className="section-header text-hc-muted text-[11px] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 hc-clay-inset backdrop-blur-md rounded-xl p-1 border border-white/5 shadow-xl w-fit mx-auto lg:mx-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-3 px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500
              ${tab === t.id ? 'bg-hc-teal/20 text-hc-teal-light border border-hc-teal/30 shadow-lg' : 'text-hc-muted hover:text-hc-text hover:bg-white/5'}`}>
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`rounded-lg px-2 py-0.5 text-[11px] font-black shadow-inner
                ${tab === t.id ? 'bg-hc-teal text-hc-text' : 'bg-white/5 text-hc-muted'}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10">
        {tab === 'shifts' && <ShiftBoard shifts={shifts} onAddWorker={w => saveWorkers([...workers, w])} onAddShift={s => saveShifts([...shifts, s])} />}
        {tab === 'pipeline' && <WorkerPipelinePage workers={workers} shifts={shifts} onUpdateWorker={w => saveWorkers(workers.map(x => x.id === w.id ? w : x))} />}
        {tab === 'agencies' && <AgencyDirectory agencies={agencies} onAddAgency={a => saveAgencies([...agencies, a])} />}
        {tab === 'rates' && <RateCards rateCards={rateCards} onUpdateRate={saveRates} />}
      </div>
    </div>
  );
}
