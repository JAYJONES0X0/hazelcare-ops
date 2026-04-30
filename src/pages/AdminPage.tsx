import { useState, useRef, useEffect } from 'react';
import type { WeekSummary } from '../lib/types';
import { clearCoveragePlan, loadCoveragePlan } from '../lib/coverage-plan';
import { clearWeekData, clearActions, clearIncidents, loadActions, loadIncidents, exportOpsSnapshot, importOpsSnapshot } from '../lib/storage';
import { clearClientData, clearStaffNotes, type FullClient } from '../lib/client-store';
import {
  downloadText,
  careEntriesToEvidenceCsv,
  buildCoordinatorReadme,
  buildCoordinatorEvidenceHtml,
} from '../lib/coordinator-export-pack';
import type { MonitoringFilters } from '../lib/staff-monitoring';
import { getAllEntriesAsync, getStorageAuditAsync, deleteEntriesByFilterAsync, clearEntryStoreAsync } from '../lib/entry-store';
import { purgeSystemDataAsync } from '../lib/governance-utils';
import { reconcileRosterCsv } from '../lib/continuity-engine';
import { Database, Trash2, Calendar, HardDrive, ShieldAlert, ClipboardCheck, Upload, CheckCircle } from 'lucide-react';

function CoordinatorExportCard({ weekData }: { weekData: WeekSummary }) {
  const houseKeys = Object.keys(weekData.houses).sort();
  const [house, setHouse] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(weekData?.dateFrom || '');
  const [dateTo, setDateTo] = useState(weekData?.dateTo || '');
  const [typeFilter, setTypeFilter] = useState('');
  const [packing, setPacking] = useState(false);

  async function runCoordinatorPack() {
    setPacking(true);
    try {
      const all = await getAllEntriesAsync();
      const filters: MonitoringFilters = {
        house: house as MonitoringFilters['house'],
        dateFrom: dateFrom.trim() || undefined,
        dateTo: dateTo.trim() || undefined,
      };
      
      const entries = all.filter(e => {
        if (house !== 'all' && e.house !== house) return false;
        if (typeFilter && !JSON.stringify(e).toLowerCase().includes(typeFilter.toLowerCase())) return false;
        if (filters.dateFrom || filters.dateTo) {
          const parts = e.date.split('/');
          if (parts.length < 3) return false;
          const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          const from = filters.dateFrom?.split('/').reverse().map(s => s.padStart(2, '0')).join('-');
          const to = filters.dateTo?.split('/').reverse().map(s => s.padStart(2, '0')).join('-');
          if (from && iso < from) return false;
          if (to && iso > to) return false;
        }
        return true;
      });

      const day = new Date().toISOString().slice(0, 10);
      const meta = { title: 'COORDINATOR EVIDENCE PACK', generated: new Date().toISOString(), filters, entryCount: entries.length };
      
      downloadText(`hazelcare-evidence-${day}.csv`, careEntriesToEvidenceCsv(entries), 'text/csv;charset=utf-8');
      downloadText(`hazelcare-readme-${day}.txt`, buildCoordinatorReadme(meta as any), 'text/plain;charset=utf-8');
      downloadText(`hazelcare-evidence-${day}.html`, buildCoordinatorEvidenceHtml(entries, meta as any), 'text/html;charset=utf-8');
    } finally {
      setPacking(false);
    }
  }

  return (
    <div className="hc-clay-raised border border-hc-teal/30 rounded-[2rem] p-6 mb-8 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-black text-hc-text tracking-tighter uppercase text-shimmer">Coordinator evidence pack</h2>
          <p className="text-[11px] text-hc-muted mt-1 max-w-xl leading-relaxed">
            Evidence-grade CSV (full text + ids), readme with next-export hints from your current registry, and printable HTML. Filter by house, dates, and optional diary type substring (e.g. <span className="text-hc-teal-light">1:1</span>, handover).
          </p>
        </div>
        <button
          type="button"
          onClick={runCoordinatorPack}
          disabled={packing}
          className={`shrink-0 px-5 py-3 rounded-xl btn-gradient text-[10px] font-black uppercase tracking-wide text-hc-text ${packing ? 'opacity-50' : ''}`}
        >
          {packing ? 'Packing...' : 'Download all 3 files'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5 text-[10px] font-bold text-hc-muted uppercase tracking-wider">
          House
          <select
            value={house}
            onChange={(e) => setHouse(e.target.value)}
            className="hc-clay-inset border border-white/10 rounded-xl px-3 py-2.5 text-sm text-hc-text bg-transparent"
          >
            <option value="all">All houses</option>
            {houseKeys.map((h) => (
              <option key={h} value={h}>
                {weekData.houses[h]?.name || h}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[10px] font-bold text-hc-muted uppercase tracking-wider">
          Date from
          <input
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="hc-clay-inset border border-white/10 rounded-xl px-3 py-2.5 text-sm text-hc-text placeholder:text-hc-muted"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[10px] font-bold text-hc-muted uppercase tracking-wider">
          Date to
          <input
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="hc-clay-inset border border-white/10 rounded-xl px-3 py-2.5 text-sm text-hc-text placeholder:text-hc-muted"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[10px] font-bold text-hc-muted uppercase tracking-wider">
          Type contains
          <input
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder="e.g. 1:1"
            className="hc-clay-inset border border-white/10 rounded-xl px-3 py-2.5 text-sm text-hc-text placeholder:text-hc-muted"
          />
        </label>
      </div>
    </div>
  );
}

function RosterAccountabilityAudit() {
  const [reconciling, setReconciling] = useState(false);
  const [reconResults, setReconResults] = useState<{ shifts: number; gaps: number } | null>(null);

  async function handleRosterReconcile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReconciling(true);
    try {
      const text = await file.text();
      const entries = await getAllEntriesAsync();
      const result = reconcileRosterCsv(text, entries, 2026);
      
      setReconResults({ shifts: result.rosterRowCount, gaps: result.gaps.length });

      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Forensic-Accountability-Report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Admin] Roster Recon Error:', err);
    } finally {
      setReconciling(false);
    }
  }

  return (
    <div className="hc-clay-raised p-8 rounded-[2.5rem] bg-flag-amber/[0.02] border border-flag-amber/10 flex flex-col gap-6 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-flag-amber/10 flex items-center justify-center text-flag-amber">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black text-hc-text uppercase tracking-tight">Roster Accountability Audit</h3>
            <p className="text-[10px] font-black text-hc-muted uppercase tracking-widest mt-1">Personnel gap reconstruction (ClientRoster.csv)</p>
          </div>
        </div>
        <label className="btn-tactical !bg-flag-amber !text-black flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg">
          <Upload size={14} />
          {reconciling ? 'RUNNING FORENSICS...' : 'UPLOAD ROSTER CSV'}
          <input type="file" accept=".csv" onChange={handleRosterReconcile} className="hidden" />
        </label>
      </div>

      {reconResults && (
        <div className="hc-clay-inset p-5 rounded-2xl bg-flag-green/10 flex items-center justify-between animate-in zoom-in-95 duration-500">
          <div className="flex items-center gap-3">
            <CheckCircle size={16} className="text-flag-green" />
            <div>
              <div className="text-[10px] font-black text-hc-text uppercase tracking-widest">Audit Terminal Output</div>
              <div className="text-[10px] text-hc-muted font-bold uppercase tracking-widest opacity-60">{reconResults.shifts} Shifts Reconciled</div>
            </div>
          </div>
          <div className="text-right">
             <div className="text-lg font-black text-flag-red tabular-nums">{reconResults.gaps}</div>
             <div className="text-[8px] font-black text-hc-muted uppercase tracking-[0.2em]">Clinical Gaps Identified</div>
          </div>
        </div>
      )}

      <p className="text-[10px] font-black text-hc-muted uppercase tracking-[0.2em] leading-relaxed opacity-60 max-w-2xl">
        Upload the official personnel roster to identify which staff members were present in the unit but failed to record clinical intelligence for specific service users. A forensic gap report will download automatically.
      </p>
    </div>
  );
}

function DataManagerProp
({ clients, onClearEverything, onClearType }: {
  clients: FullClient[];
  onClearEverything: () => void;
  onClearType: (type: 'diary' | 'actions' | 'incidents' | 'clients' | 'notes' | 'targets') => void;
}) {
  const [realCount, setRealCount] = useState(0);
  const [storageAudit, setStorageAudit] = useState<Record<string, { count: number; size: number }>>({});
  const [governanceHouse, setGovernanceHouse] = useState('all');
  const [purgeLoading, setPurgeLoading] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);
  const actions = loadActions();
  const incidents = loadIncidents();
  const plan = loadCoveragePlan();
  const notes = (() => { try { return JSON.parse(localStorage.getItem('hazelcare-staff-notes') || '[]'); } catch { return []; } })();

  useEffect(() => {
    void getAllEntriesAsync().then(all => setRealCount(all.length));
    void getStorageAuditAsync().then(setStorageAudit);
    
    // Wire up for global refresh after clear
    (window as any).refreshDataManager = async (count: number) => {
       setRealCount(count);
       setStorageAudit(await getStorageAuditAsync());
    };
  }, []);

  async function handleSurgicalPurge() {
    if (governanceHouse === 'all') return;
    if (!confirm(`SURGICAL PURGE: Delete all intelligence for ${governanceHouse.toUpperCase()}? This action is forensic and irreversible.`)) return;
    
    setPurgeLoading(true);
    await deleteEntriesByFilterAsync({ house: governanceHouse });
    const all = await getAllEntriesAsync();
    setRealCount(all.length);
    setStorageAudit(await getStorageAuditAsync());
    setPurgeLoading(false);
  }

  function handleExportBackup() {
    const snapshot = exportOpsSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hazelcare-ops-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestoreBackup(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = importOpsSnapshot(parsed);
      if (!result.ok) {
        alert(`Restore failed: ${result.error}`);
        return;
      }
      alert('Backup restored successfully. Reloading...');
      window.location.reload();
    } catch {
      alert('Restore failed: Invalid backup file.');
    }
  }

  const datasets = [
    { key: 'diary', label: 'Diary & Briefing', present: realCount > 0, desc: realCount > 0 ? `${realCount.toLocaleString()} entries safely stored` : 'Local registry empty' },
    { key: 'clients', label: 'People & Support Plans', present: clients.length > 0, desc: clients.length > 0 ? `${clients.length} people configured` : 'Local registry empty' },
    { key: 'actions', label: 'Action Tracker', present: actions.length > 0, desc: actions.length > 0 ? `${actions.length} tasks logged` : 'Local registry empty' },
    { key: 'incidents', label: 'Incident Logs', present: incidents.length > 0, desc: incidents.length > 0 ? `${incidents.length} events recorded` : 'Local registry empty' },
    { key: 'targets', label: 'Shift Coverage Targets', present: !!plan, desc: plan ? `Active monitoring for ${plan.client}` : 'No targets configured' },
    { key: 'notes', label: 'Staff Notes', present: notes.length > 0, desc: notes.length > 0 ? `${notes.length} saved notes` : 'Local registry empty' },
  ];

  return (
    <div className="hc-clay-raised border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-hc-text tracking-tighter uppercase text-shimmer">Stored Intelligence</h2>
          <p className="text-[11px] font-bold text-hc-muted uppercase tracking-[0.2em] mt-1">Manage local care datasets and privacy</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { if (confirm('HARD RESET: This will purge ALL local storage and IndexedDB data, then force a clean reload. Irreversible. Continue?')) onClearEverything(); }}
            className="text-[11px] font-black text-flag-red hover:text-hc-text uppercase tracking-[0.2em] px-4 py-2 hc-clay-raised border border-flag-red/20 rounded-xl transition-all hover:bg-flag-red/20">
            Hard Reset System
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {datasets.map(d => (
          <div key={d.key} className={`hc-clay-raised border border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:bg-white/[0.02] transition-all ${!d.present && 'text-hc-muted'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${d.present ? 'bg-flag-green glow-green' : 'bg-white/5'}`} />
              <div>
                <div className="text-xs font-black text-hc-text uppercase tracking-tight">{d.label}</div>
                <div className="text-[10px] text-hc-muted">{d.desc}</div>
              </div>
            </div>
            {d.present && (
              <button onClick={() => { if (confirm(`Clear ${d.label}?`)) onClearType(d.key as any); }} 
                className="text-[11px] font-black text-hc-muted hover:text-flag-red uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Clear</button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-white/5 pt-10">
         {/* Governance Heatmap */}
         <div className="hc-clay-inset p-8 rounded-[2rem] space-y-6">
            <div className="flex items-center gap-3 mb-2">
               <Database className="text-hc-teal" size={18} />
               <h3 className="text-xs font-black text-hc-text uppercase tracking-widest">Intelligence Volume Map</h3>
            </div>
            <div className="space-y-4">
               {Object.entries(storageAudit).length > 0 ? Object.entries(storageAudit).sort((a,b) => b[1].size - a[1].size).map(([house, stats]) => (
                  <div key={house} className="flex items-center justify-between group">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-hc-text uppercase tracking-tighter">{house}</span>
                        <span className="text-[8px] font-black text-hc-muted uppercase tracking-widest">{stats.count.toLocaleString()} Intelligence Points</span>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-hc-teal tabular-nums">{(stats.size / 1024).toFixed(1)} KB</span>
                        <div className="h-1.5 w-16 bg-black/10 rounded-full overflow-hidden">
                           <div className="h-full bg-hc-teal" style={{ width: `${Math.min(100, (stats.size / 500000) * 100)}%` }} />
                        </div>
                     </div>
                  </div>
               )) : (
                 <div className="py-10 text-center text-[9px] font-black text-hc-muted uppercase tracking-widest opacity-40">Local Registry Empty</div>
               )}
            </div>
         </div>

         {/* Surgical Governance Bench */}
         <div className="hc-clay-raised p-8 rounded-[2rem] space-y-6 border border-flag-red/10">
            <div className="flex items-center gap-3">
               <ShieldAlert className="text-flag-red" size={18} />
               <h3 className="text-xs font-black text-flag-red uppercase tracking-widest">Surgical Governance</h3>
            </div>
            <p className="text-[10px] font-bold text-hc-muted uppercase tracking-wider leading-relaxed">
               Target specific units for intelligence deletion. Used for forensic data retention and legal compliance sweeps.
            </p>
            <div className="space-y-4 pt-2">
               <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Target Selection</span>
                  <select 
                    value={governanceHouse}
                    onChange={e => setGovernanceHouse(e.target.value)}
                    className="hc-clay-inset px-4 py-3 text-[10px] font-black uppercase text-hc-text outline-none"
                  >
                     <option value="all">SELECT TARGET...</option>
                     {Object.keys(storageAudit).map(h => <option key={h} value={h}>{h.toUpperCase()}</option>)}
                  </select>
               </div>
               <button 
                 onClick={handleSurgicalPurge}
                 disabled={governanceHouse === 'all' || purgeLoading}
                 className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest shadow-xl
                   ${governanceHouse === 'all' ? 'hc-clay-raised text-hc-muted opacity-40' : 'bg-flag-red text-hc-bone hover:bg-black active:scale-[0.98]'}`}
               >
                  <Trash2 size={14} /> {purgeLoading ? 'PURGING...' : `Surgical Purge: ${governanceHouse}`}
               </button>
            </div>
         </div>
      </div>

      <div className="mt-8 pt-8 flex flex-wrap gap-4 border-t border-white/5 opacity-60">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl hc-clay-raised text-[9px] font-black text-hc-teal uppercase tracking-widest">
           <HardDrive size={12} /> Registry: INDEXED-DB HIGH-CAPACITY (GIGABYTES)
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl hc-clay-raised text-[9px] font-black text-hc-muted uppercase tracking-widest">
           <Calendar size={12} /> Retention Policy: ACTIVE
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap gap-3">
        <button
          onClick={handleExportBackup}
          className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2.5 hc-clay-raised border border-hc-teal/30 text-hc-teal-light rounded-xl transition-all hover:bg-hc-teal/10"
        >
          Export Persistent Backup
        </button>
        <button
          onClick={() => restoreRef.current?.click()}
          className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2.5 hc-clay-raised border border-white/10 text-hc-muted hover:text-hc-text rounded-xl transition-all hover:bg-white/5"
        >
          Restore Backup
        </button>
        <input
          ref={restoreRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleRestoreBackup(file);
            e.currentTarget.value = '';
          }}
        />
      </div>
    </div>
  );
}

export function AdminPage({ weekData, clients }: { weekData: WeekSummary | null, clients: FullClient[] }) {

  const handleClearEverything = async () => {
    if (!confirm('TOTAL PURGE: This will wipe ALL clinical records and registry data. Irreversible. Continue?')) return;
    await purgeSystemDataAsync();
  };

  const handleClearType = async (type: 'diary' | 'actions' | 'incidents' | 'clients' | 'notes' | 'targets') => {
    if (!confirm(`PURGE: Wipe all ${type.toUpperCase()} records?`)) return;
    
    if (type === 'diary') {
      await clearEntryStoreAsync();
    } else if (type === 'targets') {
      clearCoveragePlan();
    } else if (type === 'clients') {
      clearClientData();
    } else if (type === 'notes') {
      clearStaffNotes();
    } else if (type === 'actions') {
      clearActions();
    } else if (type === 'incidents') {
      clearIncidents();
    }
    
    // Refresh the local component state to show 0
    void getAllEntriesAsync().then(all => (window as any).refreshDataManager?.(all.length));
  };

  return (
    <div className="p-10 max-w-6xl mx-auto animate-in fade-in duration-700">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-hc-text tracking-tighter uppercase text-shimmer">Admin Hub</h1>
        <p className="text-hc-muted text-[11px] font-bold uppercase tracking-widest mt-1">Operations & Data Management</p>
      </div>

      {weekData && <CoordinatorExportCard weekData={weekData} />}

      <RosterAccountabilityAudit />
      
      <DataManagerProp 
        clients={clients} 
        onClearEverything={handleClearEverything} 
        onClearType={handleClearType} 
      />
    </div>
  );
}
