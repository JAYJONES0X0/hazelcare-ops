import { useState, useRef, useEffect } from 'react';
import type { WeekSummary } from '../lib/types';
import { clearClientData, clearStaffNotes, purgeSystemData, type FullClient } from '../lib/client-store';
import { clearWeekData, clearActions, clearIncidents, loadActions, loadIncidents, exportOpsSnapshot, importOpsSnapshot } from '../lib/storage';
import {
  downloadText,
  careEntriesToEvidenceCsv,
  buildCoordinatorReadme,
  buildCoordinatorEvidenceHtml,
  filterEntriesForCoordinatorPack,
} from '../lib/coordinator-export-pack';
import type { MonitoringFilters } from '../lib/staff-monitoring';
import { getAllEntriesAsync } from '../lib/entry-store';

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
      
      // Filter the full dataset manually for the pack
      const entries = all.filter(e => {
        if (house !== 'all' && e.house !== house) return false;
        if (typeFilter && !JSON.stringify(e).toLowerCase().includes(typeFilter.toLowerCase())) return false;
        if (filters.dateFrom || filters.dateTo) {
          const parts = e.date.split('/');
          const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
          const from = filters.dateFrom?.split('/').reverse().join('-');
          const to = filters.dateTo?.split('/').reverse().join('-');
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

function DataManagerProp({ clients, onClearEverything, onClearType }: {
  clients: FullClient[];
  onClearEverything: () => void;
  onClearType: (type: 'diary' | 'actions' | 'incidents' | 'clients' | 'notes') => void;
}) {
  const [realCount, setRealCount] = useState(0);
  const restoreRef = useRef<HTMLInputElement>(null);
  const actions = loadActions();
  const incidents = loadIncidents();
  const notes = (() => { try { return JSON.parse(localStorage.getItem('hazelcare-staff-notes') || '[]'); } catch { return []; } })();

  useEffect(() => {
    void getAllEntriesAsync().then(all => setRealCount(all.length));
  }, []);

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
    { key: 'notes', label: 'Staff Notes', present: notes.length > 0, desc: notes.length > 0 ? `${notes.length} saved notes` : 'Local registry empty' },
  ];

  return (
    <div className="hc-clay-raised border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-hc-text tracking-tighter uppercase text-shimmer">Stored Intelligence</h2>
          <p className="text-[11px] font-bold text-hc-muted uppercase tracking-[0.2em] mt-1">Manage local care datasets and privacy</p>
        </div>
        {datasets.some(d => d.present) && (
          <button onClick={() => { if (confirm('Delete ALL data from this device?')) onClearEverything(); }}
            className="text-[11px] font-black text-flag-red hover:text-hc-text uppercase tracking-[0.2em] px-4 py-2 hc-clay-raised border border-flag-red/20 rounded-xl transition-all hover:bg-flag-red/20">
            Purge All Data
          </button>
        )}
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

      <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-3">
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

  const handleClearEverything = () => {
    purgeSystemData();
    window.location.reload();
  };

  const handleClearType = (type: any) => {
    if (type === 'diary') clearWeekData();
    else if (type === 'clients') clearClientData();
    else if (type === 'actions') clearActions();
    else if (type === 'incidents') clearIncidents();
    else if (type === 'notes') clearStaffNotes();
    window.location.reload();
  };

  return (
    <div className="p-10 max-w-6xl mx-auto animate-in fade-in duration-700">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-hc-text tracking-tighter uppercase text-shimmer">Admin Hub</h1>
        <p className="text-hc-muted text-[11px] font-bold uppercase tracking-widest mt-1">Operations & Data Management</p>
      </div>

      {weekData && <CoordinatorExportCard weekData={weekData} />}
      
      <DataManagerProp 
        clients={clients} 
        onClearEverything={handleClearEverything} 
        onClearType={handleClearType} 
      />
    </div>
  );
}
