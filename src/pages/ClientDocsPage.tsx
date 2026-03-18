import { useState, useRef } from 'react';
import { loadClients, saveClient, deleteClient, emptyClient } from '../lib/client-store';
import { buildPBSHtml, buildRiskHtml, riskInfo } from '../lib/doc-renderer';
import { PBSBuilder } from './PBSBuilder';
import { RiskBuilder } from './RiskBuilder';
import type { FullClient } from '../lib/client-store';

type SubView = 'list' | 'pbs' | 'risk';

export function ClientDocsPage() {
  const [subView, setSubView] = useState<SubView>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clients, setClients] = useState<FullClient[]>(() => loadClients());
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const refresh = () => setClients(loadClients());

  const openPBS = (id: string) => { setSelectedId(id); setSubView('pbs'); };
  const openRisk = (id: string) => { setSelectedId(id); setSubView('risk'); };
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

  const printDoc = (client: FullClient, type: 'pbs' | 'risk') => {
    const html = type === 'pbs' ? buildPBSHtml(client) : buildRiskHtml(client);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
  };

  if (subView === 'pbs' && selectedId) return <PBSBuilder clientId={selectedId} onBack={goBack} />;
  if (subView === 'risk' && selectedId) return <RiskBuilder clientId={selectedId} onBack={goBack} />;

  const pbsCount = clients.filter(c => c.pbs).length;
  const riskCount = clients.filter(c => c.risk).length;

  return (
    <div className="p-4 lg:p-6">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Client Documents</h1>
          <p className="text-sm text-gray-500 mt-1">
            {clients.length} client{clients.length !== 1 ? 's' : ''} · {pbsCount} PBS plan{pbsCount !== 1 ? 's' : ''} · {riskCount} risk assessment{riskCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Client
        </button>
      </div>

      {/* Client cards */}
      {clients.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400 font-medium">No clients yet</p>
          <p className="text-sm text-gray-600 mt-1">Click "New Client" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map(client => {
            const hasPBS = !!client.pbs;
            const hasRisk = !!client.risk;
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
                    <span className="text-xs text-gray-400">PBS Plan</span>
                  </div>
                  <button onClick={() => openPBS(client.id)}
                    className="text-xs bg-teal-900/40 hover:bg-teal-800/50 border border-teal-800 text-teal-400 px-3 py-1 rounded-lg font-medium">
                    {hasPBS ? 'Edit PBS' : 'Create PBS'}
                  </button>
                  {hasPBS && (
                    <button onClick={() => printDoc(client, 'pbs')}
                      className="text-xs text-gray-400 hover:text-white border border-[#1e3050] hover:border-[#2a4060] px-3 py-1 rounded-lg">
                      Print PDF
                    </button>
                  )}

                  <div className="w-px h-4 bg-[#1e3050]" />

                  {/* Risk */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasRisk ? 'bg-amber-500' : 'bg-gray-600'}`} />
                    <span className="text-xs text-gray-400">Risk Assessment</span>
                  </div>
                  <button onClick={() => openRisk(client.id)}
                    className="text-xs bg-amber-900/30 hover:bg-amber-800/40 border border-amber-800 text-amber-400 px-3 py-1 rounded-lg font-medium">
                    {hasRisk ? 'Edit Risk' : 'Create Risk'}
                  </button>
                  {hasRisk && (
                    <button onClick={() => printDoc(client, 'risk')}
                      className="text-xs text-gray-400 hover:text-white border border-[#1e3050] hover:border-[#2a4060] px-3 py-1 rounded-lg">
                      Print PDF
                    </button>
                  )}

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
