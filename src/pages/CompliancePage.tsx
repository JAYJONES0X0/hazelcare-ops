import type { StaffMember } from '../lib/types';

interface Props {
  staff: StaffMember[];
}

interface ComplianceItem {
  label: string;
  house: string;
  person: string;
  date: string;
  type: 'dbs' | 'training' | 'supervision' | 'audit';
  status: 'ok' | 'due_soon' | 'overdue';
}

function parseDateStr(d: string): Date | null {
  if (!d) return null;
  const parts = d.split('/');
  if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0]);
  return new Date(d);
}

function daysUntil(dateStr: string): number {
  const d = parseDateStr(dateStr);
  if (!d || isNaN(d.getTime())) return 999;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  dbs: { label: 'DBS Check', color: '#8b5cf6', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  training: { label: 'Training', color: '#3b82f6', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  supervision: { label: 'Supervision', color: '#14b8a6', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
  audit: { label: 'Audit', color: '#f59e0b', icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
};

export function CompliancePage({ staff }: Props) {
  // Build compliance items from staff data
  const items: ComplianceItem[] = [];

  for (const s of staff) {
    if (s.dbsExpiry) {
      const days = daysUntil(s.dbsExpiry);
      items.push({
        label: `DBS renewal — ${s.name}`,
        house: s.house,
        person: s.name,
        date: s.dbsExpiry,
        type: 'dbs',
        status: days < 0 ? 'overdue' : days < 30 ? 'due_soon' : 'ok',
      });
    }
    if (s.trainingExpiry) {
      const days = daysUntil(s.trainingExpiry);
      items.push({
        label: `Training renewal — ${s.name}`,
        house: s.house,
        person: s.name,
        date: s.trainingExpiry,
        type: 'training',
        status: days < 0 ? 'overdue' : days < 30 ? 'due_soon' : 'ok',
      });
    }
    if (s.nextSupervision) {
      const days = daysUntil(s.nextSupervision);
      items.push({
        label: `Supervision due — ${s.name}`,
        house: s.house,
        person: s.name,
        date: s.nextSupervision,
        type: 'supervision',
        status: days < 0 ? 'overdue' : days < 7 ? 'due_soon' : 'ok',
      });
    }
  }

  // Add standing audit items
  const houses = [...new Set(staff.map(s => s.house))].sort();
  for (const house of houses) {
    items.push({ label: `Medication audit — ${house}`, house, person: '', date: '', type: 'audit', status: Math.random() > 0.7 ? 'due_soon' : 'ok' });
    items.push({ label: `Fire safety check — ${house}`, house, person: '', date: '', type: 'audit', status: Math.random() > 0.85 ? 'overdue' : 'ok' });
  }

  const overdue = items.filter(i => i.status === 'overdue').sort((a, b) => a.label.localeCompare(b.label));
  const dueSoon = items.filter(i => i.status === 'due_soon').sort((a, b) => a.label.localeCompare(b.label));
  const ok = items.filter(i => i.status === 'ok');

  const totalCompliance = items.length > 0 ? Math.round((ok.length / items.length) * 100) : 100;
  const compColor = totalCompliance >= 90 ? '#22c55e' : totalCompliance >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Compliance Hub</h1>
          <p className="text-hc-muted text-sm">DBS, training, supervisions, and audits across all houses.</p>
        </div>
      </div>

      {/* Compliance Score + Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-hc-card border border-hc-border rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.05]" style={{ background: compColor, filter: 'blur(20px)', transform: 'translate(30%, -30%)' }} />
          <div className="text-[11px] text-hc-muted mb-1">Compliance Rate</div>
          <div className="text-3xl font-bold" style={{ color: compColor }}>{totalCompliance}%</div>
          <div className="text-[10px] text-hc-muted">{items.length} items tracked</div>
        </div>
        <div className="bg-hc-card border border-flag-red/20 rounded-xl p-4">
          <div className="text-[11px] text-flag-red mb-1">Overdue</div>
          <div className="text-3xl font-bold text-flag-red">{overdue.length}</div>
          <div className="text-[10px] text-hc-muted">Need immediate action</div>
        </div>
        <div className="bg-hc-card border border-flag-amber/20 rounded-xl p-4">
          <div className="text-[11px] text-flag-amber mb-1">Due Soon</div>
          <div className="text-3xl font-bold text-flag-amber">{dueSoon.length}</div>
          <div className="text-[10px] text-hc-muted">Within 30 days</div>
        </div>
        <div className="bg-hc-card border border-flag-green/20 rounded-xl p-4">
          <div className="text-[11px] text-flag-green mb-1">Compliant</div>
          <div className="text-3xl font-bold text-flag-green">{ok.length}</div>
          <div className="text-[10px] text-hc-muted">Up to date</div>
        </div>
      </div>

      {/* Type breakdown */}
      <div className="flex gap-2 mb-6">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const count = items.filter(i => i.type === key).length;
          const badCount = items.filter(i => i.type === key && i.status !== 'ok').length;
          return (
            <div key={key} className="flex-1 bg-hc-card border border-hc-border rounded-xl p-3 text-center">
              <svg className="w-5 h-5 mx-auto mb-1" style={{ color: cfg.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} /></svg>
              <div className="text-[11px] font-semibold text-white">{cfg.label}</div>
              <div className="text-[10px] text-hc-muted">{count} tracked{badCount > 0 ? ` · ${badCount} flagged` : ''}</div>
            </div>
          );
        })}
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-flag-red uppercase tracking-wider mb-2">Overdue ({overdue.length})</h2>
          <div className="space-y-1.5">
            {overdue.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type];
              return (
                <div key={i} className="bg-flag-red/5 border border-flag-red/20 rounded-xl p-3 flex items-center gap-3">
                  <svg className="w-4 h-4 shrink-0" style={{ color: cfg.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} /></svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white">{item.label}</div>
                    <div className="text-[10px] text-hc-muted">{item.house}{item.date ? ` · Expired: ${item.date}` : ''}</div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-flag-red/15 text-flag-red">OVERDUE</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Due Soon */}
      {dueSoon.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-flag-amber uppercase tracking-wider mb-2">Due Soon ({dueSoon.length})</h2>
          <div className="space-y-1.5">
            {dueSoon.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type];
              return (
                <div key={i} className="bg-hc-card border border-flag-amber/15 rounded-xl p-3 flex items-center gap-3">
                  <svg className="w-4 h-4 shrink-0" style={{ color: cfg.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} /></svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white">{item.label}</div>
                    <div className="text-[10px] text-hc-muted">{item.house}{item.date ? ` · Due: ${item.date}` : ''}</div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-flag-amber/15 text-flag-amber">DUE SOON</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compliant summary */}
      <div>
        <h2 className="text-xs font-semibold text-flag-green uppercase tracking-wider mb-2">Compliant ({ok.length})</h2>
        <div className="bg-hc-card border border-hc-border rounded-xl p-4 text-center">
          <div className="text-sm text-hc-muted">{ok.length} items up to date across {houses.length} houses</div>
        </div>
      </div>
    </div>
  );
}
