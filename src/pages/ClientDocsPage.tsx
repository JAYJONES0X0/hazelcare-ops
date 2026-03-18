import { useState, useRef } from 'react';
import { loadClients, saveClient, deleteClient, emptyClient } from '../lib/client-store';
import { buildPBSHtml, buildRiskHtml, buildCarePlanHtml, riskInfo } from '../lib/doc-renderer';
import { parseNourishText } from '../lib/nourish-import';
import { PBSBuilder } from './PBSBuilder';
import { RiskBuilder } from './RiskBuilder';
import { CarePlanBuilder } from './CarePlanBuilder';
import type { FullClient } from '../lib/client-store';

type SubView = 'list' | 'pbs' | 'risk' | 'careplan' | 'import';

export function ClientDocsPage() {
  const [subView, setSubView] = useState<SubView>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clients, setClients] = useState<FullClient[]>(() => loadClients());
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [filterText, setFilterText] = useState('');
  const [importText, setImportText] = useState('');
  const [importTarget, setImportTarget] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const refresh = () => setClients(loadClients());

  const openPBS = (id: string) => { setSelectedId(id); setSubView('pbs'); };
  const openRisk = (id: string) => { setSelectedId(id); setSubView('risk'); };
  const openCarePlan = (id: string) => { setSelectedId(id); setSubView('careplan'); };
  const goBack = () => { refresh(); setSubView('list'); setSelectedId(null); };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete all documents for ${name}? This cannot be undone.`)) return;
    deleteClient(id);
    refresh();
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const client = emptyClient();
    client.name = newName.trim();
    client.preferredName = newName.trim().split(' ')[0];
    saveClient(client);
    setNewName('');
    setShowNewModal(false);
    refresh();
    openPBS(client.id);
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const result = parseNourishText(importText);
    setImportResult(result.warnings);

    if (importTarget) {
      // Import into existing client
      const all = loadClients();
      const existing = all.find(c => c.id === importTarget);
      if (existing) {
        const updated = {
          ...existing,
          ...result.client,
          name: existing.name || result.client.name || '',
          carePlan: result.carePlan,
        };
        saveClient(updated as FullClient);
        refresh();
        setImportText('');
        setSubView('list');
      }
    } else {
      // Create new client from import
      const client = emptyClient();
      Object.assign(client, result.client);
      client.carePlan = result.carePlan;
      saveClient(client);
      refresh();
      setImportText('');
      setSubView('list');
    }
  };

  const printDoc = (client: FullClient, type: 'pbs' | 'risk' | 'careplan') => {
    let html = '';
    if (type === 'pbs') html = buildPBSHtml(client);
    else if (type === 'risk') html = buildRiskHtml(client);
    else html = buildCarePlanHtml(client);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
  };

  if (subView === 'pbs' && selectedId) return <PBSBuilder clientId={selectedId} onBack={goBack} />;
  if (subView === 'risk' && selectedId) return <RiskBuilder clientId={selectedId} onBack={goBack} />;
  if (subView === 'careplan' && selectedId) return <CarePlanBuilder clientId={selectedId} onBack={goBack} />;

  // Import view
  if (subView === 'import') {
    return (
      <div className="p-4 lg:p-6 max-w-3xl">
        <button onClick={() => { setSubView('list'); setImportResult([]); }}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium mb-6">
          ← Back to Clients
        </button>

        <h1 className="text-xl font-bold text-white mb-1">Import from Nourish</h1>
        <p className="text-sm text-gray-500 mb-6">
          Open the Nourish Emergency Admission Pack PDF, select all text (Ctrl+A), copy it, and paste below.
          We'll parse the client profile, all 21 care plan domains, risk scores, and review notes automatically.
        </p>

        {importTarget && (
          <div className="bg-teal-900/20 border border-teal-800 rounded-lg px-4 py-3 mb-4">
            <span className="text-xs text-teal-400 font-medium">
              Importing into: {clients.find(c => c.id === importTarget)?.name || 'Unknown'}
            </span>
          </div>
        )}

        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          rows={16}
          placeholder="Paste the full text from the Nourish PDF here…"
          className="w-full bg-[#0c1525] border border-[#1e3050] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 placeholder-gray-600 resize-y mb-4 font-mono"
        />

        {importResult.length > 0 && (
          <div className="bg-[#111b2e] border border-[#1e3050] rounded-lg px-4 py-3 mb-4">
            {importResult.map((w, i) => (
              <p key={i} className="text-xs text-gray-400">{w}</p>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleImport} disabled={!importText.trim()}
            className="bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-sm font-semibold px-6 py-2.5 rounded-lg">
            Parse & Import
          </button>
          {!importTarget && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Or import into existing client:</span>
              <select
                value={importTarget || ''}
                onChange={e => setImportTarget(e.target.value || null)}
                className="bg-[#0c1525] border border-[#1e3050] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500">
                <option value="">New client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  }

  const filtered = filterText
    ? clients.filter(c => c.name.toLowerCase().includes(filterText.toLowerCase()))
    : clients;

  const pbsCount = clients.filter(c => c.pbs && c.pbs.aboutText).length;
  const riskCount = clients.filter(c => c.risk && c.risk.risks.some(r => r.title)).length;
  const cpCount = clients.filter(c => c.carePlan && c.carePlan.domains.some(d => d.enabled)).length;

  return (
    <div className="p-4 lg:p-6">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Client Documents</h1>
          <p className="text-sm text-gray-500 mt-1">
            {clients.length} client{clients.length !== 1 ? 's' : ''} · {pbsCount} PBS · {riskCount} Risk · {cpCount} Care Plan{cpCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setImportTarget(null); setSubView('import'); }}
            className="flex items-center gap-2 bg-[#111b2e] hover:bg-[#162035] border border-[#1e3050] text-gray-300 text-sm font-medium px-4 py-2 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import from Nourish
          </button>
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Client
          </button>
        </div>
      </div>

      {/* Search filter */}
      {clients.length > 2 && (
        <div className="mb-4">
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Search clients…"
            className="w-full max-w-sm bg-[#0c1525] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 placeholder-gray-600"
          />
        </div>
      )}

      {/* Client cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400 font-medium">{filterText ? 'No matching clients' : 'No clients yet'}</p>
          <p className="text-sm text-gray-600 mt-1">
            {filterText ? 'Try a different search.' : 'Click "New Client" or "Import from Nourish" to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(client => {
            const hasPBS = !!(client.pbs && client.pbs.aboutText);
            const hasRisk = !!(client.risk && client.risk.risks.some(r => r.title));
            const hasCarePlan = !!(client.carePlan && client.carePlan.domains.some(d => d.enabled));
            const cpDomains = client.carePlan?.domains.filter(d => d.enabled) || [];
            const cpFilled = cpDomains.filter(d => d.identifiedNeed).length;

            const topRisk = client.risk?.risks
              .filter(r => r.title)
              .reduce((max, r) => {
                const s = r.likelihood * r.impact;
                return s > max ? s : max;
              }, 0) ?? 0;
            const { color: riskColor, label: riskLabel } = topRisk > 0
              ? riskInfo(Math.ceil(Math.sqrt(topRisk)), Math.floor(Math.sqrt(topRisk)) || 1)
              : { color: '#5a7a9a', label: 'No data' };

            return (
              <div key={client.id}
                className="bg-[#111b2e] border border-[#1e3050] rounded-xl overflow-hidden hover:border-[#2a4060] transition-colors">
                {/* Client header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-full bg-teal-900/40 border border-teal-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-teal-400">
                      {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-base font-bold text-white">{client.name}</span>
                      {client.dob && (
                        <span className="text-xs text-gray-500">DOB: {client.dob}</span>
                      )}
                      {client.nhs && (
                        <span className="text-xs text-gray-500">NHS: {client.nhs}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {client.diagnoses.slice(0, 3).map((d, i) => (
                        <span key={i} className="text-[10px] bg-[#0a1120] border border-[#1e3050] px-2 py-0.5 rounded-full text-gray-400">
                          {d}
                        </span>
                      ))}
                      {client.diagnoses.length > 3 && (
                        <span className="text-[10px] text-gray-600">+{client.diagnoses.length - 3} more</span>
                      )}
                    </div>
                  </div>
                  {topRisk > 0 && (
                    <div className="flex-shrink-0 text-right">
                      <div className="text-[10px] text-gray-500 mb-0.5">Highest risk</div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: riskColor + '30', color: riskColor, border: `1px solid ${riskColor}` }}>
                        {topRisk} — {riskLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Document actions */}
                <div className="border-t border-[#1e3050] px-5 py-3 flex items-center gap-3 flex-wrap bg-[#0a1120]">
                  {/* PBS */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasPBS ? 'bg-teal-500' : 'bg-gray-600'}`} />
                    <span className="text-xs text-gray-400">PBS</span>
                  </div>
                  <button onClick={() => openPBS(client.id)}
                    className="text-xs bg-teal-900/40 hover:bg-teal-800/50 border border-teal-800 text-teal-400 px-3 py-1 rounded-lg font-medium">
                    {hasPBS ? 'Edit' : 'Create'}
                  </button>
                  {hasPBS && (
                    <button onClick={() => printDoc(client, 'pbs')}
                      className="text-xs text-gray-400 hover:text-white border border-[#1e3050] hover:border-[#2a4060] px-2 py-1 rounded-lg">
                      PDF
                    </button>
                  )}

                  <div className="w-px h-4 bg-[#1e3050]" />

                  {/* Risk */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasRisk ? 'bg-amber-500' : 'bg-gray-600'}`} />
                    <span className="text-xs text-gray-400">Risk</span>
                  </div>
                  <button onClick={() => openRisk(client.id)}
                    className="text-xs bg-amber-900/30 hover:bg-amber-800/40 border border-amber-800 text-amber-400 px-3 py-1 rounded-lg font-medium">
                    {hasRisk ? 'Edit' : 'Create'}
                  </button>
                  {hasRisk && (
                    <button onClick={() => printDoc(client, 'risk')}
                      className="text-xs text-gray-400 hover:text-white border border-[#1e3050] hover:border-[#2a4060] px-2 py-1 rounded-lg">
                      PDF
                    </button>
                  )}

                  <div className="w-px h-4 bg-[#1e3050]" />

                  {/* Care Plan */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasCarePlan ? 'bg-blue-500' : 'bg-gray-600'}`} />
                    <span className="text-xs text-gray-400">Care Plan</span>
                    {hasCarePlan && (
                      <span className="text-[10px] text-gray-600">({cpFilled}/{cpDomains.length})</span>
                    )}
                  </div>
                  <button onClick={() => openCarePlan(client.id)}
                    className="text-xs bg-blue-900/30 hover:bg-blue-800/40 border border-blue-800 text-blue-400 px-3 py-1 rounded-lg font-medium">
                    {hasCarePlan ? 'Edit' : 'Create'}
                  </button>
                  {hasCarePlan && (
                    <button onClick={() => printDoc(client, 'careplan')}
                      className="text-xs text-gray-400 hover:text-white border border-[#1e3050] hover:border-[#2a4060] px-2 py-1 rounded-lg">
                      PDF
                    </button>
                  )}

                  <div className="w-px h-4 bg-[#1e3050]" />

                  {/* Import into this client */}
                  <button onClick={() => { setImportTarget(client.id); setSubView('import'); }}
                    className="text-[11px] text-gray-500 hover:text-teal-400 font-medium">
                    Import
                  </button>

                  <div className="flex-1" />

                  {/* Meta */}
                  {client.keyWorker && (
                    <span className="text-[11px] text-gray-600">Key Worker: {client.keyWorker}</span>
                  )}
                  <button onClick={() => handleDelete(client.id, client.name)}
                    className="text-[11px] text-gray-600 hover:text-red-400">
                    Delete
                  </button>
                </div>

                {/* Care plan domains preview */}
                {hasCarePlan && cpDomains.length > 0 && (
                  <div className="border-t border-[#1e3050] px-5 py-2.5 bg-[#080e1a]">
                    <div className="flex flex-wrap gap-1.5">
                      {cpDomains.map((d, i) => {
                        const levelColors = ['#16a34a', '#65a30d', '#d97706', '#ea580c', '#dc2626'];
                        return (
                          <span key={i}
                            className="text-[10px] px-2 py-0.5 rounded-full border"
                            style={{
                              color: levelColors[d.levelOfNeed],
                              borderColor: levelColors[d.levelOfNeed] + '40',
                              background: levelColors[d.levelOfNeed] + '15',
                            }}>
                            {d.title.length > 25 ? d.title.slice(0, 25) + '…' : d.title}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Client Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111b2e] border border-[#1e3050] rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-bold text-white mb-4">New Client</h2>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Full Name</label>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Jamie Morton"
              className="w-full bg-[#0c1525] border border-[#1e3050] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 mb-4 placeholder-gray-600"
            />
            <p className="text-xs text-gray-500 mb-5">
              You'll be taken straight to the PBS Builder where you can fill in all details.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowNewModal(false); setNewName(''); }}
                className="flex-1 border border-[#1e3050] text-gray-400 hover:text-white text-sm font-medium py-2 rounded-lg">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!newName.trim()}
                className="flex-1 bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg">
                Create & Open
              </button>
            </div>
          </div>
        </div>
      )}

      <iframe ref={iframeRef} style={{ display: 'none' }} title="doc-print" />
    </div>
  );
}
