import { useState, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { loadClients, saveClient, deleteClient, emptyClient, purgeSystemData } from '../lib/client-store';
import { buildPBSHtml, buildRiskHtml, buildCarePlanHtml, buildEasyReadHtml, riskInfo } from '../lib/doc-renderer';
import type { ExportLayout } from '../lib/doc-renderer';
import { parseUniversalText } from '../lib/universal-import';
import { PBSBuilder } from './PBSBuilder';
import { RiskBuilder } from './RiskBuilder';
import { CarePlanBuilder } from './CarePlanBuilder';
import type { FullClient } from '../lib/client-store';
import { Trash2, AlertTriangle } from 'lucide-react';

// Set up pdfjs worker for Vite
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

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
  const [importPreview, setImportPreview] = useState<{ name: string; dob: string; nhs: string; domainsDetected: number } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [exportLayout, setExportLayout] = useState<ExportLayout>('portrait');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setImportResult(['Reading PDF...']);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let lastY: number | null = null;
        let pageText = '';
        for (const item of content.items as any[]) {
          if (!item.str) continue;
          const y = item.transform ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
            pageText += '\n';
          } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            pageText += ' ';
          }
          pageText += item.str;
          lastY = y;
        }
        fullText += pageText + '\n';
      }

      setImportText(fullText);
      setImportResult(['PDF text extracted successfully. Press "Preview Import" to continue.']);
    } catch (err) {
      console.error('PDF extract error:', err);
      setImportResult(['Failed to read PDF. Try copy-pasting the text manually instead.']);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePreview = () => {
    if (!importText.trim()) return;
    const result = parseUniversalText(importText);
    setImportResult(result.warnings);
    const domainsDetected = result.carePlan.domains.filter(d => d.enabled).length;
    setImportPreview({
      name: result.client.name || 'Not detected',
      dob: result.client.dob || 'Not detected',
      nhs: result.client.nhs || 'Not detected',
      domainsDetected,
    });
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const result = parseUniversalText(importText);
    setImportResult(result.warnings);

    if (importTarget) {
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
        setImportPreview(null);
        setSubView('list');
      }
    } else {
      const client = emptyClient();
      Object.assign(client, result.client);
      client.carePlan = result.carePlan;
      saveClient(client);
      refresh();
      setImportText('');
      setImportPreview(null);
      setSubView('list');
    }
  };

  const printDoc = (client: FullClient, type: 'pbs' | 'risk' | 'careplan' | 'easyread') => {
    let html = '';
    if (type === 'pbs') html = buildPBSHtml(client, undefined, exportLayout);
    else if (type === 'risk') html = buildRiskHtml(client, undefined, exportLayout);
    else if (type === 'easyread') html = buildEasyReadHtml(client, exportLayout);
    else html = buildCarePlanHtml(client, undefined, exportLayout);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframeRef.current?.contentWindow?.print(), 400);
  };

  if (subView === 'pbs' && selectedId) return <PBSBuilder clientId={selectedId} onBack={goBack} />;
  if (subView === 'risk' && selectedId) return <RiskBuilder clientId={selectedId} onBack={goBack} />;
  if (subView === 'careplan' && selectedId) return <CarePlanBuilder clientId={selectedId} onBack={goBack} />;

  if (subView === 'import') {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto animate-in fade-in duration-700">
        <button onClick={() => { setSubView('list'); setImportResult([]); setImportText(''); setImportPreview(null); }}
          className="group flex items-center gap-2 text-hc-muted hover:text-white text-xs font-black uppercase tracking-[0.08em] mb-8 transition-all">
          <span className="w-6 h-6 rounded-lg glass border border-white/10 flex items-center justify-center group-hover:bg-white/5">←</span>
          Back
        </button>

        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight text-shimmer">Import Data</h1>
        <p className="text-hc-muted text-sm mb-10 max-w-2xl font-medium opacity-80 leading-relaxed">
          Upload person-centred "Emergency Admission Pack" PDF. The system will map all 21 premium domains of care and build a support plan automatically.
        </p>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting}
            className="flex-1 flex items-center justify-center gap-3 btn-gradient disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all shadow-xl hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            {isExtracting ? 'Processing...' : 'Upload Care Plan PDF'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf"
            className="hidden"
          />
        </div>

        <div className="glass-light border border-hc-teal/20 rounded-2xl px-6 py-4 mb-8 flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-hc-teal/10 border border-hc-teal/20 flex items-center justify-center shrink-0">
            <span className="text-xl">💡</span>
          </div>
          <div>
            <p className="text-xs text-hc-teal-light font-black uppercase tracking-wide mb-0.5">Tip</p>
            <p className="text-sm text-hc-muted font-medium italic opacity-90 group-hover:opacity-100 transition-opacity">
              On mobile: Tap upload and select the PDF from your device. No extra steps needed.
            </p>
          </div>
        </div>

        {importTarget && (
          <div className="pill pill-teal text-[10px] font-black px-4 py-2 mb-6 shadow-lg inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
            TARGET OVERWRITE: {clients.find(c => c.id === importTarget)?.name || 'Unknown'}
          </div>
        )}

        <div className="relative rounded-2xl border border-white/5 glass p-1 shadow-2xl mb-6 overflow-hidden">
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={12}
            placeholder="Or drop manual stream content here…"
            className="w-full bg-transparent p-6 text-hc-text font-mono text-sm leading-relaxed resize-y placeholder:text-hc-muted/60 focus:outline-none scrollbar-thin"
          />
        </div>

        {importResult.length > 0 && (
          <div className="glass-light border border-white/5 rounded-2xl px-6 py-4 mb-6 space-y-1">
            {importResult.map((w, i) => (
              <p key={i} className="text-xs font-bold text-hc-muted/95 uppercase tracking-wide leading-relaxed flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-hc-teal/40" /> {w}
              </p>
            ))}
          </div>
        )}

        {importPreview && (
          <div className="glass border-2 border-hc-teal/30 rounded-[2rem] p-8 mb-8 animate-in zoom-in-95 duration-500 shadow-2xl glow-teal relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-teal/5 blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <p className="section-header text-[10px] mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-hc-teal animate-pulse" />
                Preview
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="glass-light border border-white/5 rounded-2xl p-4 shadow-inner">
                  <div className="section-header text-xs opacity-90 mb-1">Designation</div>
                  <div className="text-sm font-black text-white truncate">{importPreview.name}</div>
                </div>
                <div className="glass-light border border-white/5 rounded-2xl p-4 shadow-inner">
                  <div className="section-header text-xs opacity-90 mb-1">Temporal ID</div>
                  <div className="text-sm font-black text-white tabular-nums">{importPreview.dob}</div>
                </div>
                <div className="glass-light border border-white/5 rounded-2xl p-4 shadow-inner">
                  <div className="section-header text-xs opacity-90 mb-1">Net ID</div>
                  <div className="text-sm font-black text-white tabular-nums">{importPreview.nhs}</div>
                </div>
                <div className="glass-light border border-white/5 rounded-2xl p-4 shadow-inner">
                  <div className="section-header text-xs opacity-90 mb-1">Domains</div>
                  <div className="text-sm font-black text-hc-teal-light tabular-nums">{importPreview.domainsDetected} / 21</div>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={handleImport}
                  className="flex-1 btn-gradient text-white text-[11px] font-black uppercase tracking-[0.2em] py-4 rounded-xl shadow-xl hover:scale-[1.02] transition-all">
                  Confirm & Sync Profile
                </button>
                <button onClick={() => setImportPreview(null)}
                  className="px-8 glass-light border border-white/10 text-hc-muted hover:text-white text-[11px] font-black uppercase tracking-[0.2em] py-4 rounded-xl transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {!importPreview && (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <button onClick={handlePreview} disabled={!importText.trim()}
              className="w-full md:w-auto btn-gradient disabled:opacity-20 disabled:grayscale text-white text-[11px] font-black uppercase tracking-[0.2em] px-10 py-4 rounded-xl shadow-xl transition-all">
              Initiate Preview
            </button>
            {!importTarget && (
              <div className="flex items-center gap-4 glass-light border border-white/5 px-5 py-3 rounded-2xl shadow-xl">
                <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Target Mapping:</span>
                <select
                  value={importTarget || ''}
                  onChange={e => setImportTarget(e.target.value || null)}
                  className="bg-hc-dark/80 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-black text-white focus:outline-none focus:border-hc-teal/50 shadow-inner min-w-[180px]">
                  <option value="">Add New Person</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
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
    <div className="p-6 lg:p-10 max-w-[2560px] mx-auto animate-in fade-in duration-700">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white mb-1 tracking-tight text-shimmer">People & Support Plans</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="pill pill-blue text-xs font-black uppercase tracking-wide">{clients.length} People</span>
            <span className="pill pill-teal text-xs font-black uppercase tracking-wide">{pbsCount} PBS Profiles</span>
            <span className="pill pill-amber text-xs font-black uppercase tracking-wide">{riskCount} Risk Matrices</span>
            <span className="pill pill-purple text-xs font-black uppercase tracking-wide">{cpCount} Support Plans</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={exportLayout}
            onChange={e => setExportLayout(e.target.value as ExportLayout)}
            className="bg-hc-dark/80 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white"
            title="Default export orientation"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
          <button onClick={() => { setImportTarget(null); setSubView('import'); }}
            className="flex items-center gap-2.5 glass-light border border-white/10 text-hc-muted hover:text-white text-[10px] font-black uppercase tracking-[0.2em] px-5 py-3 rounded-xl transition-all hover:bg-white/5 hover:border-hc-teal/30 group">
            <svg className="w-4 h-4 text-hc-teal-light group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2.5 btn-gradient text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl shadow-xl transition-all hover:scale-105">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Person
          </button>
        </div>
      </div>

      {/* Search filter */}
      {clients.length > 2 && (
        <div className="mb-8 relative group max-w-md">
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Search people…"
            className="w-full bg-hc-dark/60 border border-white/10 rounded-xl px-10 py-3 text-sm text-white focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all placeholder-hc-muted/40 focus:bg-hc-dark"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      )}

      {/* Client cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 glass border border-white/5 rounded-3xl animate-in zoom-in duration-700">
          <div className="text-5xl mb-6 opacity-20">👥</div>
          <div className="text-lg font-extrabold text-white mb-2 uppercase tracking-tight">{filterText ? 'No matches found' : 'No People Added Yet'}</div>
          <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">{filterText ? 'Try a different search' : 'Click "Add Person" to get started'}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filtered.map((client, idx) => {
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
              : { color: '#5a7a9a', label: 'STABLE' };

            return (
              <div key={client.id}
                className="glass border border-white/10 rounded-[2rem] overflow-hidden transition-all duration-500 card-glow group animate-in slide-in-from-bottom-4"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Client header */}
                <div className="px-8 py-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.03] blur-[60px] -translate-y-1/2 translate-x-1/2 transition-opacity group-hover:opacity-[0.06]" style={{ background: riskColor }} />
                  <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-hc-teal/10 border border-white/10 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-500">
                      <span className="text-xl font-black text-hc-teal-light">
                        {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h2 className="text-2xl font-black text-white tracking-tight group-hover:text-hc-teal-light transition-colors">{client.name}</h2>
                        {topRisk > 0 && (
                          <span className="pill text-[9px] font-black uppercase tracking-widest shadow-lg animate-pulse-soft"
                            style={{ background: riskColor + '22', color: riskColor, border: `1px solid ${riskColor}44` }}>
                            RISK: {topRisk}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        {client.dob && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">DOB:</span>
                            <span className="text-[11px] font-bold text-white/70 tabular-nums">{client.dob}</span>
                          </div>
                        )}
                        {client.nhs && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">NHS:</span>
                            <span className="text-[11px] font-bold text-white/70 tabular-nums">{client.nhs}</span>
                          </div>
                        )}
                        <div className="h-3 w-px bg-white/10 hidden md:block" />
                        <div className="flex items-center gap-2">
                          {client.diagnoses.slice(0, 3).map((d, i) => (
                            <span key={i} className="text-[9px] font-black bg-black/40 border border-white/5 px-2.5 py-0.5 rounded-lg text-hc-muted/80 uppercase tracking-tighter truncate max-w-[140px]">
                              {d}
                            </span>
                          ))}
                          {client.diagnoses.length > 3 && (
                            <span className="text-[9px] font-black text-hc-teal-light/60">+{client.diagnoses.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {topRisk > 0 && (
                      <div className="hidden lg:flex flex-col items-end shrink-0 pl-6 border-l border-white/5">
                        <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1">Risk Status</span>
                        <span className="text-[13px] font-black uppercase tracking-widest" style={{ color: riskColor }}>{riskLabel}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Document actions */}
                <div className="border-t border-white/5 px-8 py-5 bg-black/20 backdrop-blur-md">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className={`pill text-[9px] font-black uppercase tracking-wide ${hasRisk ? 'pill-amber' : 'pill-blue'}`}>
                      Risk Assessment {hasRisk ? 'Ready' : 'Missing'}
                    </span>
                    <span className={`pill text-[9px] font-black uppercase tracking-wide ${hasCarePlan ? 'pill-teal' : 'pill-blue'}`}>
                      Care Plan {hasCarePlan ? `Ready (${cpFilled}/${cpDomains.length})` : 'Missing'}
                    </span>
                    <span className={`pill text-[9px] font-black uppercase tracking-wide ${hasPBS ? 'pill-teal' : 'pill-blue'}`}>
                      PBS {hasPBS ? 'Ready' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-8">
                      {/* PBS */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shadow-sm ${hasPBS ? 'bg-hc-teal glow-teal' : 'bg-white/10'}`} />
                          <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">PBS</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openPBS(client.id)}
                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition-all
                              ${hasPBS ? 'bg-hc-teal/10 text-hc-teal-light border border-hc-teal/30 hover:bg-hc-teal/20' : 'bg-white/5 text-hc-muted border border-white/5 hover:text-white'}`}>
                            {hasPBS ? 'Edit' : 'Create'}
                          </button>
                          {hasPBS && (
                            <button onClick={() => printDoc(client, 'pbs')}
                              className="text-[10px] font-black text-white/40 hover:text-white transition-colors p-1.5">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Risk */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shadow-sm ${hasRisk ? 'bg-flag-amber glow-amber' : 'bg-white/10'}`} />
                          <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Risk</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openRisk(client.id)}
                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition-all
                              ${hasRisk ? 'bg-flag-amber/10 text-flag-amber border border-flag-amber/30 hover:bg-flag-amber/20' : 'bg-white/5 text-hc-muted border border-white/5 hover:text-white'}`}>
                            {hasRisk ? 'Edit' : 'Create'}
                          </button>
                          {hasRisk && (
                            <button onClick={() => printDoc(client, 'risk')}
                              className="text-[10px] font-black text-white/40 hover:text-white transition-colors p-1.5">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Support Plan */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shadow-sm ${hasCarePlan ? 'bg-hc-blue glow-blue' : 'bg-white/10'}`} />
                          <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Plan</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openCarePlan(client.id)}
                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition-all
                              ${hasCarePlan ? 'bg-hc-blue/10 text-hc-blue border border-hc-blue/30 hover:bg-hc-blue/20' : 'bg-white/5 text-hc-muted border border-white/5 hover:text-white'}`}>
                            {hasCarePlan ? `Update (${cpFilled}/${cpDomains.length})` : 'Create'}
                          </button>
                          {hasCarePlan && (
                            <>
                              <button onClick={() => printDoc(client, 'careplan')}
                                className="text-[10px] font-black text-white/40 hover:text-white transition-colors p-1.5" title="Print care plan">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                              </button>
                              <button onClick={() => printDoc(client, 'easyread')}
                                className="text-[10px] font-black text-hc-teal-light/50 hover:text-hc-teal-light transition-colors px-2 py-1 rounded-lg hover:bg-hc-teal/10" title="Easy Read version">
                                📖
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                      <button onClick={() => { setImportTarget(client.id); setSubView('import'); }}
                        className="text-[10px] font-black text-hc-teal-light uppercase tracking-widest hover:text-white transition-colors">
                        Re-Sync
                      </button>
                      <div className="h-4 w-px bg-white/10" />
                      <button onClick={() => handleDelete(client.id, client.name)}
                        className="text-[10px] font-black text-white/20 hover:text-flag-red transition-colors uppercase tracking-widest">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Care plan domains preview */}
                {hasCarePlan && cpDomains.length > 0 && (
                  <div className="border-t border-white/5 px-8 py-4 bg-hc-dark/40 overflow-hidden relative">
                    <div className="flex flex-wrap gap-2 relative z-10">
                      {cpDomains.slice(0, 12).map((d, i) => {
                        const colors = ['pill-green', 'pill-blue', 'pill-amber', 'pill-red', 'pill-red'];
                        return (
                          <span key={i} className={`pill ${colors[d.levelOfNeed] || 'pill-teal'} text-[8px] font-black uppercase tracking-tighter py-0.5`}>
                            {d.title.length > 30 ? d.title.slice(0, 30) + '…' : d.title}
                          </span>
                        );
                      })}
                      {cpDomains.length > 12 && (
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest flex items-center">+{cpDomains.length - 12} more protocol areas</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Danger Zone */}
      <div className="mt-32 pt-12 border-t border-white/5 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
        <div className="bg-flag-red/5 rounded-[2rem] p-8 border border-flag-red/20 flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-sm">
          <div className="flex items-center gap-6 text-center md:text-left flex-col md:flex-row">
            <div className="w-16 h-16 rounded-3xl bg-flag-red/10 flex items-center justify-center text-flag-red glow-red shrink-0">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-black text-flag-red uppercase tracking-[0.3em] mb-2">Clear All Data</h3>
              <p className="text-hc-muted text-xs font-medium max-w-md leading-relaxed opacity-70">
                Delete all people, support plans, and documents from this device. This cannot be undone.
              </p>
            </div>
          </div>
          <button 
            onClick={() => { if(confirm('Are you sure? This will delete every person and every document. This cannot be undone.')) purgeSystemData(); }}
            className="px-10 py-4 bg-flag-red text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-red-500 transition-all flex items-center gap-3 shadow-xl shadow-red-900/20 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* New Person Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="glass border border-white/10 rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-teal/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative z-10">
              <h2 className="text-3xl font-black text-white mb-2 tracking-tighter text-shimmer">Add New Person</h2>
              <p className="text-hc-muted text-sm mb-8 font-medium opacity-80 leading-relaxed">
                Add a new person to the system. You will be taken to the PBS builder straight away.
              </p>
              
              <div className="mb-10">
                <label className="section-header text-[9px] mb-2 ml-1 block opacity-60 tracking-[0.2em]">Full Name</label>
                <div className="relative group">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="e.g. Sarah Johnson"
                    className="w-full bg-hc-dark/60 border border-white/10 rounded-2xl px-6 py-4 text-lg font-bold text-white focus:outline-none focus:border-hc-teal/50 shadow-inner transition-all placeholder:text-hc-muted/20 focus:bg-hc-dark"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-hc-teal/10 flex items-center justify-center opacity-0 group-focus-within:opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-hc-teal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button onClick={() => { setShowNewModal(false); setNewName(''); }}
                  className="flex-1 glass-light border border-white/10 text-hc-muted hover:text-white text-[11px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={!newName.trim()}
                  className="flex-[2] btn-gradient disabled:opacity-20 disabled:grayscale text-white text-[11px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-all">
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <iframe ref={iframeRef} style={{ display: 'none' }} title="doc-print" />
    </div>
  );
}
