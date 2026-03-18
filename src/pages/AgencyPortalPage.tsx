import { useState } from 'react';

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

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────

const SHIFTS: Shift[] = [
  { id: 's1', house: 'Church House', date: '18/03/2026', time: '07:00–15:00', hours: 8, role: 'Support Worker', rate: 14.50, urgency: 'critical', status: 'open', notes: 'Must have PBS experience' },
  { id: 's2', house: 'Lingfield House', date: '18/03/2026', time: '15:00–23:00', hours: 8, role: 'Support Worker', rate: 14.50, urgency: 'critical', status: 'open' },
  { id: 's3', house: 'Canterbury', date: '18/03/2026', time: '23:00–07:00', hours: 8, role: 'Senior Support Worker', rate: 16.00, urgency: 'urgent', status: 'submitted' },
  { id: 's4', house: 'Laurel House', date: '19/03/2026', time: '07:00–15:00', hours: 8, role: 'Support Worker', rate: 14.50, urgency: 'urgent', status: 'open' },
  { id: 's5', house: 'Woburn House', date: '19/03/2026', time: '15:00–23:00', hours: 8, role: 'Support Worker', rate: 14.50, urgency: 'standard', status: 'confirmed' },
  { id: 's6', house: 'Hazelbury House', date: '19/03/2026', time: '07:00–15:00', hours: 8, role: 'Senior Support Worker', rate: 16.00, urgency: 'standard', status: 'open' },
  { id: 's7', house: 'Church House', date: '20/03/2026', time: '07:00–19:00', hours: 12, role: 'Registered Manager Cover', rate: 22.00, urgency: 'urgent', status: 'open', notes: 'Level 5 diploma required' },
  { id: 's8', house: 'Lingfield House', date: '20/03/2026', time: '07:00–15:00', hours: 8, role: 'Support Worker', rate: 14.50, urgency: 'standard', status: 'filled' },
];

const WORKERS: AgencyWorker[] = [
  { id: 'w1', name: 'Marcus Thompson', role: 'Senior Support Worker', agency: 'Cucumber Recruitment', dbsRef: 'DBS-2024-7721', dbsExpiry: '12/2026', trainingExpiry: '06/2026', rightToWork: true, status: 'dbs_check', shiftId: 's3', submittedAt: '10:24 today', phone: '07700 900123' },
  { id: 'w2', name: 'Priya Patel', role: 'Support Worker', agency: 'CareerCare Staffing', dbsRef: 'DBS-2025-4482', dbsExpiry: '03/2027', trainingExpiry: '09/2026', rightToWork: true, status: 'confirmed', shiftId: 's5', submittedAt: 'Yesterday 16:45', phone: '07700 900456' },
  { id: 'w3', name: 'James Okafor', role: 'Support Worker', agency: 'Cucumber Recruitment', dbsRef: 'DBS-2023-9901', dbsExpiry: '11/2025', trainingExpiry: '02/2026', rightToWork: true, status: 'declined', shiftId: 's1', submittedAt: '09:12 today', phone: '07700 900789' },
];

const AGENCIES: Agency[] = [
  { id: 'a1', name: 'Cucumber Recruitment', contact: 'Sarah Mitchell', email: 'sarah@cucumber-recruitment.co.uk', phone: '0800 123 4567', fillRate: 87, responseTime: '< 2hrs', activeWorkers: 3, complianceScore: 94, tier: 'preferred' },
  { id: 'a2', name: 'CareerCare Staffing', contact: 'David Osei', email: 'd.osei@careercare.co.uk', phone: '0800 234 5678', fillRate: 79, responseTime: '< 4hrs', activeWorkers: 1, complianceScore: 88, tier: 'approved' },
  { id: 'a3', name: 'NurseFirst Group', contact: 'Lisa Chen', email: 'lisa@nursefirst.co.uk', phone: '0800 345 6789', fillRate: 61, responseTime: '< 8hrs', activeWorkers: 0, complianceScore: 71, tier: 'provisional' },
];

const RATE_CARDS = [
  { role: 'Support Worker', day: 14.50, evening: 15.50, night: 16.50, weekend: 16.00, bank_hol: 21.75 },
  { role: 'Senior Support Worker', day: 16.00, evening: 17.00, night: 18.00, weekend: 17.50, bank_hol: 24.00 },
  { role: 'Team Leader', day: 18.00, evening: 19.00, night: 20.00, weekend: 19.50, bank_hol: 27.00 },
  { role: 'Registered Manager Cover', day: 22.00, evening: 23.00, night: 25.00, weekend: 24.00, bank_hol: 33.00 },
];

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: ShiftUrgency }) {
  const map = {
    critical: 'bg-red-500/20 text-red-300 border-red-500/40',
    urgent: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    standard: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${map[urgency]}`}>
      {urgency === 'critical' ? '⚡ Critical' : urgency === 'urgent' ? '● Urgent' : 'Standard'}
    </span>
  );
}

function StatusBadge({ status }: { status: ShiftStatus | WorkerStatus }) {
  const map: Record<string, string> = {
    open: 'bg-hc-teal/20 text-hc-teal-light border-hc-teal/30',
    submitted: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    confirmed: 'bg-green-500/20 text-green-300 border-green-500/30',
    filled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    dbs_check: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    training_check: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    active: 'bg-green-500/20 text-green-300 border-green-500/30',
    declined: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const labels: Record<string, string> = {
    open: 'Open', submitted: 'Worker Submitted', confirmed: 'Confirmed', filled: 'Filled',
    dbs_check: 'DBS Checking', training_check: 'Training Check', active: 'Active', declined: 'Declined',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${map[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  );
}

function TierBadge({ tier }: { tier: Agency['tier'] }) {
  const map = {
    preferred: 'bg-hc-teal/20 text-hc-teal-light border-hc-teal/30',
    approved: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    provisional: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  };
  const stars = { preferred: '★★★', approved: '★★☆', provisional: '★☆☆' };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${map[tier]}`}>
      {stars[tier]} {tier}
    </span>
  );
}

function WorkerPipeline({ status }: { status: WorkerStatus }) {
  const steps: { key: WorkerStatus; label: string }[] = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'dbs_check', label: 'DBS' },
    { key: 'training_check', label: 'Training' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'active', label: 'Active' },
  ];
  const order = ['submitted', 'dbs_check', 'training_check', 'confirmed', 'active'];
  const currentIdx = order.indexOf(status);

  return (
    <div className="flex items-center gap-1 mt-2">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`flex flex-col items-center gap-0.5`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border
                ${done ? 'bg-hc-teal border-hc-teal text-white' : current ? 'bg-hc-teal/30 border-hc-teal text-hc-teal-light' : 'bg-white/5 border-white/10 text-slate-600'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-[8px] ${current ? 'text-hc-teal-light' : done ? 'text-slate-400' : 'text-slate-600'}`}>{step.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-4 h-px mb-3 ${i < currentIdx ? 'bg-hc-teal' : 'bg-white/10'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB: SHIFT BOARD ─────────────────────────────────────────────────────────

function ShiftBoard() {
  const [filter, setFilter] = useState<'all' | 'open' | 'submitted' | 'confirmed'>('all');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [submitWorker, setSubmitWorker] = useState({ name: '', role: '', agency: '', dbs: '', phone: '' });
  const [submitted, setSubmitted] = useState(false);

  const filtered = SHIFTS.filter(s => filter === 'all' || s.status === filter);
  const open = SHIFTS.filter(s => s.status === 'open').length;
  const critical = SHIFTS.filter(s => s.urgency === 'critical' && s.status === 'open').length;
  const filled = SHIFTS.filter(s => s.status === 'filled' || s.status === 'confirmed').length;
  const totalValue = SHIFTS.filter(s => s.status === 'open').reduce((a, s) => a + s.hours * s.rate, 0);

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Open Shifts', value: open, color: 'text-hc-teal-light', sub: 'Require coverage' },
          { label: 'Critical', value: critical, color: 'text-red-400', sub: 'Fill today' },
          { label: 'Filled / Confirmed', value: filled, color: 'text-green-400', sub: 'This week' },
          { label: 'Open Shift Value', value: `£${totalValue.toFixed(0)}`, color: 'text-amber-300', sub: 'Available earnings' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-white text-xs font-medium mt-0.5">{s.label}</div>
            <div className="text-slate-500 text-[10px] mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'open', 'submitted', 'confirmed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors
              ${filter === f ? 'bg-hc-teal/20 text-hc-teal-light border border-hc-teal/30' : 'text-slate-400 hover:text-white border border-white/5 hover:border-white/10'}`}>
            {f === 'all' ? 'All Shifts' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Shift cards */}
      <div className="grid gap-3">
        {filtered.map(shift => (
          <div key={shift.id}
            className={`bg-white/[0.03] border rounded-xl p-4 transition-all cursor-pointer hover:border-hc-teal/30
              ${shift.urgency === 'critical' && shift.status === 'open' ? 'border-red-500/30' : 'border-white/[0.06]'}
              ${selectedShift?.id === shift.id ? 'border-hc-teal/40 bg-hc-teal/[0.04]' : ''}`}
            onClick={() => setSelectedShift(selectedShift?.id === shift.id ? null : shift)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-sm">{shift.house}</span>
                  <UrgencyBadge urgency={shift.urgency} />
                  <StatusBadge status={shift.status} />
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-slate-400 text-xs flex-wrap">
                  <span>📅 {shift.date}</span>
                  <span>🕐 {shift.time}</span>
                  <span>⏱ {shift.hours}h</span>
                  <span className="text-hc-teal-light font-medium">👤 {shift.role}</span>
                </div>
                {shift.notes && <div className="mt-1.5 text-amber-300/70 text-[11px]">⚠ {shift.notes}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-hc-teal-light text-lg font-bold">£{shift.rate.toFixed(2)}<span className="text-slate-500 text-xs font-normal">/hr</span></div>
                <div className="text-slate-500 text-[11px] mt-0.5">£{(shift.rate * shift.hours).toFixed(2)} total</div>
              </div>
            </div>

            {/* Expanded submit form */}
            {selectedShift?.id === shift.id && shift.status === 'open' && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]" onClick={e => e.stopPropagation()}>
                {!submitted ? (
                  <>
                    <div className="text-hc-teal-light text-xs font-semibold mb-3 uppercase tracking-wide">Submit a Worker for this Shift</div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { key: 'name', placeholder: "Worker's full name" },
                        { key: 'role', placeholder: 'Role / position' },
                        { key: 'agency', placeholder: 'Your agency name' },
                        { key: 'dbs', placeholder: 'DBS certificate ref' },
                        { key: 'phone', placeholder: 'Contact number' },
                      ].map(f => (
                        <input key={f.key} placeholder={f.placeholder}
                          value={(submitWorker as Record<string, string>)[f.key]}
                          onChange={e => setSubmitWorker(w => ({ ...w, [f.key]: e.target.value }))}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-hc-teal/50" />
                      ))}
                    </div>
                    <button onClick={() => setSubmitted(true)}
                      className="bg-hc-teal hover:bg-hc-teal-light text-white font-medium px-5 py-2 rounded-lg text-xs transition-colors">
                      Submit Worker →
                    </button>
                  </>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-center">
                    <div className="text-green-400 font-semibold text-sm">Worker Submitted</div>
                    <div className="text-slate-400 text-xs mt-1">Hazelcare will review and confirm within 2 hours. You'll be notified by email.</div>
                    <button onClick={() => { setSubmitted(false); setSelectedShift(null); }} className="text-hc-teal-light text-xs mt-2 hover:underline">Submit another</button>
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

// ─── TAB: WORKER PIPELINE ─────────────────────────────────────────────────────

function WorkerPipelinePage() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-2">
        {['Submitted', 'DBS Check', 'Training', 'Confirmed', 'Active'].map((label, i) => {
          const counts = [1, 1, 0, 1, 0];
          return (
            <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-hc-teal-light">{counts[i]}</div>
              <div className="text-slate-400 text-[11px] mt-0.5">{label}</div>
            </div>
          );
        })}
      </div>

      {WORKERS.map(w => {
        const shift = SHIFTS.find(s => s.id === w.shiftId);
        const dbsExpired = w.status === 'declined';
        return (
          <div key={w.id} className={`bg-white/[0.03] border rounded-xl p-4 ${dbsExpired ? 'border-red-500/30' : 'border-white/[0.06]'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-sm">{w.name}</span>
                  <StatusBadge status={w.status} />
                  <span className="text-slate-500 text-[10px]">via {w.agency}</span>
                </div>
                <div className="text-slate-400 text-xs mt-1">{w.role} · {w.phone}</div>
                {shift && (
                  <div className="text-hc-teal-light/70 text-[11px] mt-1">
                    Covering: {shift.house} — {shift.date} {shift.time}
                  </div>
                )}
                <div className="flex gap-3 mt-2 text-[10px]">
                  <span className={`${w.dbsExpiry > '06/2026' ? 'text-green-400' : 'text-red-400'}`}>DBS: {w.dbsRef} (exp {w.dbsExpiry})</span>
                  <span className="text-slate-400">Training: exp {w.trainingExpiry}</span>
                  <span className={w.rightToWork ? 'text-green-400' : 'text-red-400'}>RTW: {w.rightToWork ? '✓ Verified' : '✗ Missing'}</span>
                </div>
                {w.status !== 'declined' && <WorkerPipeline status={w.status} />}
                {w.status === 'declined' && (
                  <div className="mt-2 text-red-400 text-[11px] bg-red-500/10 border border-red-500/20 rounded px-3 py-1.5">
                    ✗ Declined — DBS certificate expired. Please resubmit with valid DBS.
                  </div>
                )}
              </div>
              <div className="text-slate-500 text-[10px] shrink-0">Submitted {w.submittedAt}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB: AGENCY DIRECTORY ────────────────────────────────────────────────────

function AgencyDirectory() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-slate-400 text-xs">{AGENCIES.length} registered agencies · Ranked by performance</div>
        <button className="text-hc-teal-light text-xs border border-hc-teal/30 px-3 py-1.5 rounded-lg hover:bg-hc-teal/10 transition-colors">+ Register Agency</button>
      </div>

      {AGENCIES.sort((a, b) => b.fillRate - a.fillRate).map((agency, i) => (
        <div key={agency.id}
          className={`bg-white/[0.03] border rounded-xl p-4 cursor-pointer transition-all hover:border-hc-teal/30
            ${selected === agency.id ? 'border-hc-teal/40 bg-hc-teal/[0.04]' : 'border-white/[0.06]'}`}
          onClick={() => setSelected(selected === agency.id ? null : agency.id)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold">{i + 1}. {agency.name}</span>
                <TierBadge tier={agency.tier} />
                {agency.activeWorkers > 0 && (
                  <span className="bg-hc-teal/20 text-hc-teal-light text-[10px] px-2 py-0.5 rounded border border-hc-teal/30">{agency.activeWorkers} active</span>
                )}
              </div>
              <div className="text-slate-400 text-xs mt-1">{agency.contact} · {agency.email} · {agency.phone}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center shrink-0">
              <div>
                <div className={`text-lg font-bold ${agency.fillRate >= 80 ? 'text-green-400' : agency.fillRate >= 65 ? 'text-amber-300' : 'text-red-400'}`}>{agency.fillRate}%</div>
                <div className="text-slate-500 text-[10px]">Fill Rate</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-300">{agency.responseTime}</div>
                <div className="text-slate-500 text-[10px]">Response</div>
              </div>
              <div>
                <div className={`text-lg font-bold ${agency.complianceScore >= 90 ? 'text-green-400' : agency.complianceScore >= 75 ? 'text-amber-300' : 'text-red-400'}`}>{agency.complianceScore}%</div>
                <div className="text-slate-500 text-[10px]">Compliance</div>
              </div>
            </div>
          </div>

          {selected === agency.id && (
            <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Shifts Filled (All Time)', value: `${Math.round(agency.fillRate * 2.3)}` },
                { label: 'Avg Response Time', value: agency.responseTime },
                { label: 'Active Workers', value: agency.activeWorkers },
                { label: 'Compliance Score', value: `${agency.complianceScore}%` },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.03] rounded-lg p-3 text-center">
                  <div className="text-hc-teal-light font-semibold">{s.value}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5">{s.label}</div>
                </div>
              ))}
              <div className="col-span-2 lg:col-span-4 flex gap-2">
                <button className="bg-hc-teal/20 hover:bg-hc-teal/30 text-hc-teal-light border border-hc-teal/30 px-4 py-2 rounded-lg text-xs font-medium transition-colors">Send Shift Request</button>
                <button className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-4 py-2 rounded-lg text-xs font-medium transition-colors">View All Placements</button>
                <button className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-4 py-2 rounded-lg text-xs font-medium transition-colors">Contact Agency</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TAB: RATE CARDS ─────────────────────────────────────────────────────────

function RateCards() {
  return (
    <div className="space-y-5">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-300/80 text-xs">
        These are standard Hazel Care Ltd agency rates effective 01/04/2026. All rates are per hour excluding agency margin. Payment terms: 30 days. VAT applicable.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-slate-400 text-xs font-medium pb-3 pr-4">Role</th>
              <th className="text-right text-slate-400 text-xs font-medium pb-3 px-3">Day<br/><span className="text-[10px] font-normal text-slate-500">07:00–19:00</span></th>
              <th className="text-right text-slate-400 text-xs font-medium pb-3 px-3">Evening<br/><span className="text-[10px] font-normal text-slate-500">15:00–23:00</span></th>
              <th className="text-right text-slate-400 text-xs font-medium pb-3 px-3">Night<br/><span className="text-[10px] font-normal text-slate-500">23:00–07:00</span></th>
              <th className="text-right text-slate-400 text-xs font-medium pb-3 px-3">Weekend<br/><span className="text-[10px] font-normal text-slate-500">Sat & Sun</span></th>
              <th className="text-right text-slate-400 text-xs font-medium pb-3 pl-3">Bank Holiday<br/><span className="text-[10px] font-normal text-slate-500">×1.5</span></th>
            </tr>
          </thead>
          <tbody>
            {RATE_CARDS.map((r, i) => (
              <tr key={r.role} className={`border-b border-white/[0.04] ${i === 0 ? '' : ''}`}>
                <td className="text-white font-medium py-3 pr-4">{r.role}</td>
                <td className="text-hc-teal-light font-semibold text-right px-3 py-3">£{r.day.toFixed(2)}</td>
                <td className="text-slate-300 text-right px-3 py-3">£{r.evening.toFixed(2)}</td>
                <td className="text-slate-300 text-right px-3 py-3">£{r.night.toFixed(2)}</td>
                <td className="text-slate-300 text-right px-3 py-3">£{r.weekend.toFixed(2)}</td>
                <td className="text-amber-300 text-right pl-3 py-3 font-medium">£{r.bank_hol.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {[
          { title: 'Mandatory Requirements', items: ['Enhanced DBS (< 3 years)', 'Right to Work verification', 'Mandatory training up to date', 'References (2 minimum)', 'Health declaration'] },
          { title: 'Preferred Requirements', items: ['PBS training', 'Autism/learning disability experience', 'Positive behaviour support', 'First aid certificate', 'Medication competency'] },
          { title: 'Invoice & Payment', items: ['Weekly timesheets required', 'Invoice by Monday 12:00', 'Payment within 30 days', 'Dispute window: 5 working days', 'BACs transfer only'] },
        ].map(section => (
          <div key={section.title} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-hc-teal-light text-xs font-semibold mb-2 uppercase tracking-wide">{section.title}</div>
            <ul className="space-y-1">
              {section.items.map(item => (
                <li key={item} className="text-slate-400 text-xs flex items-start gap-1.5"><span className="text-hc-teal mt-0.5">·</span>{item}</li>
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

  const openShifts = SHIFTS.filter(s => s.status === 'open').length;
  const criticalShifts = SHIFTS.filter(s => s.urgency === 'critical' && s.status === 'open').length;
  const pendingWorkers = WORKERS.filter(w => w.status !== 'active' && w.status !== 'declined').length;

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'shifts', label: 'Live Shift Board', badge: openShifts },
    { id: 'pipeline', label: 'Worker Pipeline', badge: pendingWorkers },
    { id: 'agencies', label: 'Agency Directory' },
    { id: 'rates', label: 'Rate Cards' },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-white text-xl font-bold">Agency Portal</h1>
            {criticalShifts > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold uppercase px-2 py-0.5 rounded animate-pulse">
                {criticalShifts} Critical
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm">Live shift board · Worker submission · Compliance pipeline · Hazel Care Ltd</p>
        </div>
        <div className="hidden lg:flex gap-2">
          <div className="text-center bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2">
            <div className="text-hc-teal-light font-bold text-lg">{openShifts}</div>
            <div className="text-slate-500 text-[10px]">Open Shifts</div>
          </div>
          <div className="text-center bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2">
            <div className="text-amber-300 font-bold text-lg">{pendingWorkers}</div>
            <div className="text-slate-500 text-[10px]">Pending</div>
          </div>
          <div className="text-center bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2">
            <div className="text-green-400 font-bold text-lg">{AGENCIES.length}</div>
            <div className="text-slate-500 text-[10px]">Agencies</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white/[0.02] border border-white/[0.05] rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all
              ${tab === t.id ? 'bg-hc-teal/20 text-hc-teal-light border border-hc-teal/30' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold
                ${tab === t.id ? 'bg-hc-teal text-white' : 'bg-white/10 text-slate-300'}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'shifts' && <ShiftBoard />}
      {tab === 'pipeline' && <WorkerPipelinePage />}
      {tab === 'agencies' && <AgencyDirectory />}
      {tab === 'rates' && <RateCards />}
    </div>
  );
}
