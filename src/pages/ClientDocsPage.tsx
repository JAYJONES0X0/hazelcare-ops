import { useMemo, useRef, useState } from 'react';
import { loadClients, saveClient, deleteClient, emptyClient, resolveClientMatch, type ClientDocument, type FullClient } from '../lib/client-store';
import { purgeSystemDataAsync } from '../lib/governance-utils';
import { buildPBSHtml, buildRiskHtml, buildCarePlanHtml, buildEasyReadHtml, riskInfo } from '../lib/doc-renderer';
import type { ExportLayout } from '../lib/doc-renderer';
import { analyzeIntel, type IntelAnalysisResult } from '../lib/intelligence';
import { applyIntelToClient, buildIntelSessionFromRaw, mergeIntelAnalysis, summarizeIntelResult, type IntelImportStatus, type IntelImportSummary } from '../lib/client-docs-intelligence';
import { buildClusterNote, buildClusterTitle, clusterRiskItems } from '../lib/risk-assistant';
import { PBSBuilder } from './PBSBuilder';
import { RiskBuilder } from './RiskBuilder';
import { CarePlanBuilder } from './CarePlanBuilder';
import { CareCirclePanel } from './CareCirclePanel';
import { Trash2, AlertTriangle, Sparkles, Loader2, FileText, CheckCircle, Upload, ExternalLink, X, Users } from 'lucide-react';
import { uid } from '../lib/storage';
import { extractFileText } from '../lib/universal-extractor';
import { buildCareCircleOversightReportHtml, buildCareCircleOversightRows } from '../lib/care-circle-oversight';
import { careCircleModeLabel } from '../lib/care-circle-status';

type SubView = 'list' | 'pbs' | 'risk' | 'careplan' | 'carecircle' | 'import';

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
  const [importPreview, setImportPreview] = useState<{ name: string; dob: string; nhs: string; summary: IntelImportSummary; status: IntelImportStatus } | null>(null);
  const [importFileName, setImportFileName] = useState('pasted-text.txt');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [exportLayout, setExportLayout] = useState<ExportLayout>('portrait');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [copiedToken, setCopiedToken] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docUploadRef = useRef<HTMLInputElement>(null);
  const [sessionIntel, setSessionIntel] = useState<IntelAnalysisResult | null>(null);

  const refresh = () => setClients(loadClients());

  const openPBS = (id: string) => { setSelectedId(id); setSubView('pbs'); };
  const openRisk = (id: string) => { setSelectedId(id); setSubView('risk'); };
  const openCarePlan = (id: string) => { setSelectedId(id); setSubView('careplan'); };
  const openCareCircle = (id: string) => { setSelectedId(id); setSubView('carecircle'); };
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

  const handleDocUpload = async (clientId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(clientId);
    try {
      const url = `/api/staff/upload-document?filename=${encodeURIComponent(file.name)}`;
      const res = await fetch(url, {
        method: 'POST',
        body: file,
        credentials: 'include',
      });

      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json();
          detail = body?.error || body?.message || '';
        } catch {
          detail = await res.text().catch(() => '');
        }

        if (res.status === 401) throw new Error('Your session has expired. Sign in again, then retry the upload.');
        if (res.status === 403) throw new Error(detail || 'Upload blocked. This profile requires senior/admin access or an allowed production domain.');
        if (res.status === 503) throw new Error(detail || 'Staff session service is not configured.');
        throw new Error(detail || `Upload failed with status ${res.status}.`);
      }
      const blob = await res.json();

      const all = loadClients();
      const client = all.find(c => c.id === clientId);
      if (client) {
        const newDoc: ClientDocument = {
          id: uid(),
          name: file.name,
          url: blob.url,
          type: file.type,
          uploadedAt: new Date().toISOString(),
        };
        client.documents = [...(client.documents || []), newDoc];
        saveClient(client);
        refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Document upload failed.');
    } finally {
      setIsUploading(null);
      if (docUploadRef.current) docUploadRef.current.value = '';
    }
  };

  const deleteDoc = (clientId: string, docId: string) => {
    if (!confirm('Remove this document reference? The file will remain in blob storage but be unlinked from this profile.')) return;
    const all = loadClients();
    const client = all.find(c => c.id === clientId);
    if (client) {
      client.documents = (client.documents || []).filter(d => d.id !== docId);
      saveClient(client);
      refresh();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setImportResult(['Reading PDF Content...']);

    try {
      const fullText = await extractFileText(file);
      setImportFileName(file.name);
      setImportText(fullText);
      setImportResult(['Document text extracted. Use "Map Document" for deterministic support-plan/admission parsing, or "Use AI" for model analysis.']);
      setShowAiPanel(false);
    } catch (err) {
      setImportResult(['Failed to read this file. Try copy-pasting the text manually, or attach it as source evidence.']);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePreview = async (useAI = false) => {
    if (!importText.trim()) return;

    if (useAI) {
      setIsAnalyzing(true);
      setImportResult(['Initiating Clinical AI Intelligence Pipeline...']);
      try {
        const mapped = buildIntelSessionFromRaw(importFileName, importText);
        const ai = await analyzeIntel(importText);
        const result = mergeIntelAnalysis(mapped.result, ai, new Date().toLocaleDateString('en-GB'));
        setImportResult([...result.gaps, 'Clinical analysis complete. Deterministic document map preserved and AI analysis layered on top.']);
        setImportPreview({
          name: result.client.name || 'Not detected',
          dob: result.client.dob || 'Not detected',
          nhs: result.client.nhs || 'Not detected',
          summary: mapped.summary.count > 0 ? mapped.summary : summarizeIntelResult(result, 'ai'),
          status: mapped.status,
        });
        setSessionIntel(result);
      } catch (err) {
        setImportResult(['AI Intelligence failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'Switching to pattern-match fallback...']);
        runLegacyPreview();
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      runLegacyPreview();
    }
  };

  const runLegacyPreview = () => {
    const session = buildIntelSessionFromRaw(importFileName, importText);
    const result = session.result;
    setImportResult(result.gaps);
    setImportPreview({
      name: result.client.name || 'Not detected',
      dob: result.client.dob || 'Not detected',
      nhs: result.client.nhs || 'Not detected',
      summary: session.summary,
      status: session.status,
    });
    setSessionIntel(result);
  };

  const riskItems = useMemo(
    () => (sessionIntel?.risk?.risks || []).filter((risk) =>
      Boolean(
        risk.title?.trim() ||
        risk.description?.trim() ||
        risk.secondaryRisk?.trim() ||
        risk.controls?.some((control) => control.trim()) ||
        risk.triggers?.some((trigger) => trigger.trim())
      )
    ),
    [sessionIntel?.risk?.risks]
  );
  const riskClusters = useMemo(() => clusterRiskItems(riskItems), [riskItems]);

  const copyText = async (token: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken((current) => (current === token ? '' : current)), 1600);
  };

  const openAiPanel = async () => {
    if (!importText.trim()) return;
    await handlePreview(true);
    setShowAiPanel(true);
  };

  const handleImport = () => {
    const result = sessionIntel;
    if (!result) return;
    const today = new Date().toLocaleDateString('en-GB');
    const clearImportState = () => {
      refresh();
      setImportText('');
      setImportPreview(null);
      setImportTarget(null);
      setSubView('list');
      setSessionIntel(null);
    };

    if (importTarget) {
      const all = loadClients();
      const existing = all.find(c => c.id === importTarget);
      if (existing) {
        const updated = applyIntelToClient(existing, result, today);
        saveClient(updated);
        clearImportState();
      }
    } else {
      const resolution = resolveClientMatch({
        name: result.client.name,
        nhs: result.client.nhs,
        dob: result.client.dob,
      });
      const target = resolution.best && !resolution.requiresManualSelection
        ? resolution.best.client
        : emptyClient();
      saveClient(applyIntelToClient(target, result, today));
      clearImportState();
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
  if (subView === 'carecircle' && selectedId) return <CareCirclePanel clientId={selectedId} onBack={goBack} />;

  if (subView === 'import') {
    return (
      <div className="p-6 lg:p-10 xl:px-16 2xl:px-24 w-full animate-in fade-in duration-700">
        <button onClick={() => { setSubView('list'); setImportResult([]); setImportText(''); setImportPreview(null); }}
          className="group flex items-center gap-2 text-hc-muted hover:text-hc-text text-xs font-black uppercase tracking-[0.08em] mb-8 transition-all">
          <span className="w-6 h-6 rounded-lg hc-clay-inset flex items-center justify-center">←</span>
          Back
        </button>

        <h1 className="text-3xl font-extrabold text-hc-text mb-2 tracking-tight flex items-center gap-3">
          Intelligence Sync
          <span className="pill pill-teal text-[10px] font-black uppercase tracking-widest px-3 py-1">Operational Pipeline</span>
        </h1>
        <p className="text-hc-muted text-sm mb-10 max-w-2xl font-medium leading-relaxed">
          Upload person-centred clinical documents or raw unstructured text. Map Document uses deterministic support-plan/admission parsing; Use AI runs optional model analysis.
        </p>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting || isAnalyzing}
            className="flex-1 flex items-center justify-center gap-3 hc-clay-raised text-hc-text text-[11px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all hover:brightness-105"
          >
            <FileText className="w-5 h-5 text-hc-teal" />
            {isExtracting ? 'Extracting Text...' : 'Upload Document'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.xlsm"
            className="hidden"
          />
        </div>

        <div className="bg-hc-teal/5 border border-hc-teal/20 rounded-2xl px-6 py-4 mb-8 flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-hc-teal/10 border border-hc-teal/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-hc-teal animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-hc-teal font-black uppercase tracking-wide mb-0.5">Clinical Protocol</p>
            <p className="text-sm text-hc-muted font-medium italic leading-relaxed">
              For social worker reports, council support plans, hospital discharge notes, or admission packs, start with Map Document. Use AI when the source is too unstructured for deterministic parsing.
            </p>
          </div>
        </div>

        {importTarget && (
          <div className="pill pill-teal text-[10px] font-black px-4 py-2 mb-6 inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
            TARGET OVERWRITE: {clients.find(c => c.id === importTarget)?.name || 'Unknown'}
          </div>
        )}

        <div className={`hc-clay-inset rounded-2xl p-1 overflow-hidden ${importPreview ? 'mb-4' : 'mb-6'}`}>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={importPreview ? 8 : 12}
            placeholder="Paste raw unstructured clinical text here..."
            className={`w-full bg-transparent p-6 text-hc-text font-mono text-sm leading-relaxed resize-y placeholder:text-hc-muted/60 focus:outline-none scrollbar-thin ${importPreview ? 'max-h-[220px]' : 'min-h-[320px]'}`}
          />
        </div>

        {importResult.length > 0 && (
          <div className={`bg-hc-border/10 border border-hc-border/30 rounded-2xl px-6 py-4 space-y-1 ${importPreview ? 'mb-4' : 'mb-6'}`}>
            {importResult.map((w, i) => (
              <p key={i} className="text-xs font-bold text-hc-muted uppercase tracking-wide leading-relaxed flex items-center gap-2">
                {w.includes('AI Analysis Complete') || w.includes('Clinical analysis complete')
                  ? <CheckCircle className="w-3 h-3 text-flag-green" />
                  : <span className="w-1 h-1 rounded-full bg-hc-teal/40" />
                }
                {w}
              </p>
            ))}
          </div>
        )}

        {importPreview && (
          <div className={`grid gap-6 mb-8 ${showAiPanel ? 'lg:grid-cols-[1.45fr_0.95fr]' : 'grid-cols-1'}`}>
            <div className="hc-clay-raised border-2 border-hc-teal/30 rounded-[2rem] p-8 animate-in zoom-in-95 duration-500 glow-teal relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-teal/5 blur-[80px] -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <p className="section-header text-[10px] mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-hc-teal animate-pulse" />
                  Detected Profile Structure
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                  <div className="hc-clay-inset rounded-2xl p-4">
                    <div className="section-header text-xs mb-1">Clinical Designation</div>
                    <div className="text-sm font-black text-hc-text truncate">{importPreview.name}</div>
                  </div>
                  <div className="hc-clay-inset rounded-2xl p-4">
                    <div className="section-header text-xs mb-1">Temporal ID</div>
                    <div className="text-sm font-black text-hc-text tabular-nums">{importPreview.dob}</div>
                  </div>
                  <div className="hc-clay-inset rounded-2xl p-4">
                    <div className="section-header text-xs mb-1">{importPreview.summary.countLabel}</div>
                    <div className="text-sm font-black text-hc-teal tabular-nums">
                      {importPreview.summary.total
                        ? `${importPreview.summary.count} / ${importPreview.summary.total}`
                        : importPreview.summary.count}
                    </div>
                  </div>
                  <div className="hc-clay-inset rounded-2xl p-4">
                    <div className="section-header text-xs mb-1">Risk Logic</div>
                    <div className="text-sm font-black text-hc-teal">{riskClusters.length ? `${riskClusters.length} clusters` : 'ENABLED'}</div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr] mb-8">
                  <div className="rounded-2xl bg-hc-teal/5 border border-hc-teal/20 p-4">
                    <div className="section-header text-[10px] mb-3">Import Status</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted mb-1">Document Type</div>
                        <div className="text-xs font-black text-hc-text uppercase tracking-wide">{importPreview.status.documentType}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted mb-1">Confidence</div>
                        <div className={`text-xs font-black uppercase tracking-wide ${importPreview.status.confidence === 'high' ? 'text-flag-green' : importPreview.status.confidence === 'medium' ? 'text-flag-amber' : 'text-flag-red'}`}>
                          {importPreview.status.confidence}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted mb-1">Person Match</div>
                      <div className="text-xs font-bold text-hc-text">{importPreview.status.personMatch}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-hc-border/10 border border-hc-border/30 p-4">
                    <div className="section-header text-[10px] mb-3">Build Plan</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {importPreview.status.canBuild.length ? importPreview.status.canBuild.map((item) => (
                        <span key={item} className="pill pill-teal text-[9px] font-black uppercase tracking-widest">{item}</span>
                      )) : (
                        <span className="pill pill-red text-[9px] font-black uppercase tracking-widest">Evidence only</span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-hc-text leading-relaxed mb-3">{importPreview.status.recommendedAction}</div>
                    {importPreview.status.missing.length > 0 && (
                      <div className="text-[10px] text-hc-muted font-bold uppercase tracking-wide leading-relaxed">
                        Missing: {importPreview.status.missing.slice(0, 3).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>

                {riskClusters.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="section-header text-[10px] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-flag-amber animate-pulse" />
                        Risk Hotspots
                      </div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">
                        {riskClusters.filter((cluster) => cluster.hotspot).length} clusters at 3+
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {riskClusters.map((cluster) => {
                        const title = buildClusterTitle(cluster);
                        const note = buildClusterNote(cluster);
                        const token = `cluster:${cluster.key}`;
                        return (
                          <div
                            key={cluster.key}
                            className={`rounded-2xl p-4 border transition-all ${cluster.hotspot ? 'bg-flag-amber/8 border-flag-amber/30 shadow-[0_0_0_1px_rgba(250,204,21,0.05)]' : 'bg-hc-bone/50 border-hc-border/20'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-hc-text truncate">
                                  {title}
                                </div>
                                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-hc-muted mt-1">
                                  {cluster.hotspot ? 'Hotspot cluster' : 'Cluster building'}
                                </div>
                              </div>
                              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${cluster.hotspot ? 'bg-flag-amber/15 text-flag-amber border border-flag-amber/25' : 'bg-hc-border/15 text-hc-muted border border-hc-border/20'}`}>
                                {cluster.count}
                              </span>
                            </div>
                            <div className="mt-3 text-[10px] text-hc-text/70 leading-relaxed max-h-24 overflow-hidden whitespace-pre-line">
                              {note}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => copyText(`${token}:title`, title)}
                                className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hc-clay-raised text-hc-muted hover:text-hc-teal transition-colors"
                              >
                                {copiedToken === `${token}:title` ? 'Copied title' : 'Copy title'}
                              </button>
                              <button
                                onClick={() => copyText(`${token}:note`, note)}
                                className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest hc-clay-raised text-hc-muted hover:text-hc-teal transition-colors"
                              >
                                {copiedToken === `${token}:note` ? 'Copied note' : 'Copy note'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <button onClick={handleImport}
                    className="flex-1 btn-tactical text-[11px] py-4 rounded-xl">
                    Commit Intelligence to Profile
                  </button>
                  <button onClick={() => setImportPreview(null)}
                    className="px-8 btn-clay text-[11px] py-4 rounded-xl">
                    Discard
                  </button>
                </div>
              </div>
            </div>

            {showAiPanel && (
              <div className="hc-clay-raised border-2 border-hc-teal/20 rounded-[2rem] p-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-hc-bone/90">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-hc-teal">AI Sidecar</div>
                    <div className="text-[11px] text-hc-muted font-medium">Appears only when you click Use AI.</div>
                  </div>
                  <button
                    onClick={() => setShowAiPanel(false)}
                    className="w-9 h-9 rounded-xl hc-clay-inset text-hc-muted hover:text-hc-text transition-colors"
                    title="Close AI panel"
                  >
                    <X className="w-4 h-4 mx-auto" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl p-4 border border-hc-border/20 bg-white/30">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-hc-muted mb-2">What I can see</div>
                    <div className="text-[11px] text-hc-text/75 leading-relaxed">
                      {sessionIntel
                        ? `I can see ${riskClusters.length} risk cluster${riskClusters.length === 1 ? '' : 's'} and ${riskClusters.filter((cluster) => cluster.hotspot).length} hotspot${riskClusters.filter((cluster) => cluster.hotspot).length === 1 ? '' : 's'} in the extracted document.`
                        : 'Click "Use AI" to run the optional analysis pass and compare it with the deterministic cluster view.'}
                    </div>
                  </div>

                  <div className="rounded-2xl p-4 border border-hc-border/20 bg-white/30">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-hc-muted mb-2">Recommended move</div>
                    <div className="text-[11px] text-hc-text/75 leading-relaxed">
                      Build out the hotspot categories first, then paste each generated note into Nourish under the matching category heading. That keeps the pack readable when printed and gives you a fast manual fallback if AI is not needed.
                    </div>
                  </div>

                  {sessionIntel?.gaps?.length > 0 && (
                    <div className="rounded-2xl p-4 border border-hc-border/20 bg-white/30">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-hc-muted mb-2">AI gap cues</div>
                      <div className="space-y-1">
                        {sessionIntel.gaps.slice(0, 4).map((gap: string, idx: number) => (
                          <div key={idx} className="text-[10px] text-hc-text/70 leading-relaxed">
                            • {gap}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={openAiPanel}
                    disabled={isAnalyzing || !importText.trim()}
                    className="w-full btn-tactical text-[10px] py-3 rounded-xl flex items-center justify-center gap-3 disabled:opacity-40"
                  >
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isAnalyzing ? 'Thinking...' : 'Re-run AI'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!importPreview && (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <button
              onClick={() => handlePreview(false)}
              disabled={!importText.trim() || isAnalyzing}
              className="w-full md:w-auto btn-clay disabled:opacity-20 text-[11px] px-8 py-4 rounded-xl"
            >
              Map Document
            </button>
            <button
              onClick={openAiPanel}
              disabled={!importText.trim() || isAnalyzing}
              className="w-full md:w-auto btn-clay disabled:opacity-20 text-[11px] px-8 py-4 rounded-xl border border-hc-teal/20 text-hc-teal"
            >
              Use AI
            </button>
            {!importTarget && (
              <div className="flex items-center gap-4 hc-clay-inset px-5 py-3 rounded-2xl ml-auto">
                <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Target Map:</span>
                <select
                  value={importTarget || ''}
                  onChange={e => setImportTarget(e.target.value || null)}
                  className="bg-hc-bone border border-hc-border/30 rounded-xl px-4 py-2 text-[11px] font-black text-hc-text focus:outline-none focus:border-hc-teal/50 min-w-[180px]">
                  <option value="">New Clinical Profile</option>
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
  const circleCount = clients.filter(c => c.careCircle && c.careCircle.mode !== 'off').length;
  const circleRows = buildCareCircleOversightRows(clients);
  const circleReady = circleRows.filter(row => row.status.ready).length;
  const circleNeedsReview = circleRows.filter(row => !row.status.ready).length;
  const circleOpenItems = circleRows.reduce((sum, row) => sum + row.openItems, 0);
  const circleWaitingResponses = circleRows.reduce((sum, row) => sum + row.waitingResponses, 0);
  const circleOverdueResponses = circleRows.reduce((sum, row) => sum + row.overdueItems, 0);
  const circleRecentShares = circleRows.filter(row => row.status.recentShare).length;

  function printCareCircleOversight() {
    const win = window.open('', '_blank', 'width=1200,height=900');
    if (!win) return;
    win.document.open();
    win.document.write(buildCareCircleOversightReportHtml(circleRows));
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 300);
  }

  return (
    <div className="p-6 lg:p-10 xl:px-16 2xl:px-24 w-full animate-in fade-in duration-700">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-hc-text mb-1 tracking-tight">People & Support Plans</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="pill pill-blue text-xs font-black uppercase tracking-wide">{clients.length} People</span>
            <span className="pill pill-teal text-xs font-black uppercase tracking-wide">{pbsCount} PBS Profiles</span>
            <span className="pill pill-amber text-xs font-black uppercase tracking-wide">{riskCount} Risk Matrices</span>
            <span className="pill pill-purple text-xs font-black uppercase tracking-wide">{cpCount} Support Plans</span>
            <span className="pill text-xs font-black uppercase tracking-wide bg-[#5d0565]/10 text-[#5d0565] border border-[#5d0565]/20">{circleCount} Care Circles</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={exportLayout}
            onChange={e => setExportLayout(e.target.value as ExportLayout)}
            className="bg-hc-bone border border-hc-border/30 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-hc-text focus:outline-none"
            title="Default export orientation"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
          <button onClick={() => { setImportTarget(null); setSubView('import'); }}
            className="flex items-center gap-2.5 btn-clay text-[10px] px-5 py-3 rounded-xl group">
            <Sparkles className="w-4 h-4 text-hc-teal group-hover:scale-110 transition-transform" />
            Intelligence Sync
          </button>
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2.5 btn-tactical text-[10px] px-6 py-3 rounded-xl">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Person
          </button>
        </div>
      </div>

      {/* Hidden inputs for document management */}
      <input
        type="file"
        ref={docUploadRef}
        onChange={(e) => selectedId && handleDocUpload(selectedId, e)}
        accept=".pdf,.doc,.docx"
        className="hidden"
      />

      {/* Search filter */}
      {clients.length > 2 && (
        <div className="mb-8 relative group max-w-md">
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Search people…"
            className="hc-clay-inset w-full rounded-xl px-10 py-3 text-sm text-hc-text focus:outline-none transition-all placeholder:text-hc-muted/50"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 group-focus-within:opacity-80 transition-opacity">
            <svg className="w-4 h-4 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      )}

      {circleRows.length > 0 && (
        <section className="mb-8 hc-clay-raised rounded-[2rem] p-6 border border-hc-border/20">
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-5">
            <div>
              <div className="section-header text-[10px] mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#5d0565]" />
                Care Circle Oversight
              </div>
              <p className="text-xs text-hc-muted font-medium max-w-3xl leading-relaxed">
                Operational view of family and professional visibility across people: readiness, contact review, unresolved items, and recent sharing activity.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterText('')}
                className="btn-clay rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-hc-muted">
                Full queue
              </button>
              <button onClick={printCareCircleOversight}
                className="btn-tactical rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">
                Print Oversight
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 mb-5">
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-2xl font-black text-hc-teal">{circleReady}</div>
              <div className="section-header text-[9px]">Share-ready</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-2xl font-black text-flag-amber">{circleNeedsReview}</div>
              <div className="section-header text-[9px]">Needs review</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-2xl font-black text-flag-red">{circleOpenItems}</div>
              <div className="section-header text-[9px]">Open family items</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-2xl font-black text-flag-amber">{circleWaitingResponses}</div>
              <div className="section-header text-[9px]">Responses waiting</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-2xl font-black text-flag-red">{circleOverdueResponses}</div>
              <div className="section-header text-[9px]">Overdue responses</div>
            </div>
            <div className="hc-clay-inset rounded-2xl p-4">
              <div className="text-2xl font-black text-[#5d0565]">{circleRecentShares}</div>
              <div className="section-header text-[9px]">Recent shares</div>
            </div>
          </div>
          <div className="space-y-3">
            {circleRows.slice(0, 6).map(({ client, status, queueLabel, waitingResponses, overdueItems, openItems }) => (
              <div key={client.id} className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 bg-hc-border/10 border border-hc-border/20 rounded-2xl p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-sm font-black text-hc-text">{client.name}</span>
                    <span className={`pill text-[8px] font-black uppercase tracking-widest ${queueLabel === 'Ready to release' ? 'pill-green' : queueLabel === 'Overdue response' || queueLabel === 'Release blocked' ? 'pill-red' : 'pill-amber'}`}>
                      {queueLabel}
                    </span>
                    <span className="pill text-[8px] font-black uppercase tracking-widest bg-[#5d0565]/10 text-[#5d0565] border border-[#5d0565]/20">
                      {careCircleModeLabel(client.careCircle?.mode)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest">{status.verifiedContacts.length}/{status.contacts.length} verified contacts</span>
                    <span className="text-[10px] font-bold text-hc-muted uppercase tracking-widest">{openItems} open items</span>
                    {waitingResponses > 0 && <span className="text-[10px] font-bold text-flag-amber uppercase tracking-widest">{waitingResponses} waiting response</span>}
                    {overdueItems > 0 && <span className="text-[10px] font-bold text-flag-red uppercase tracking-widest">{overdueItems} overdue</span>}
                    {status.recentShare && <span className="text-[10px] font-bold text-hc-teal uppercase tracking-widest">shared {new Date(status.recentShare.createdAt).toLocaleDateString('en-GB')}</span>}
                  </div>
                  {!status.ready && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {status.issues.slice(0, 5).map(issue => (
                        <span key={issue} className="pill pill-amber text-[8px] font-black uppercase tracking-widest">{issue}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openCareCircle(client.id)}
                    className="btn-tactical rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">
                    Open Care Circle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Client cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 hc-clay-raised rounded-3xl animate-in zoom-in duration-700">
          <div className="text-5xl mb-6 opacity-20">👥</div>
          <div className="text-lg font-extrabold text-hc-text mb-2 uppercase tracking-tight">{filterText ? 'No matches found' : 'No People Added Yet'}</div>
          <div className="text-[10px] text-hc-muted uppercase tracking-[0.2em] font-bold">{filterText ? 'Try a different search' : 'Click "Add Person" to get started'}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {filtered.map((client, idx) => {
            const hasPBS = !!(client.pbs && client.pbs.aboutText);
            const hasRisk = !!(client.risk && client.risk.risks.some(r => r.title));
            const hasCarePlan = !!(client.carePlan && client.carePlan.domains.some(d => d.enabled));
            const hasCareCircle = !!(client.careCircle && client.careCircle.mode !== 'off');
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
                className="hc-clay-raised rounded-[2rem] overflow-hidden transition-all duration-500 group animate-in slide-in-from-bottom-4"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Client header */}
                <div className="px-8 py-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.03] blur-[60px] -translate-y-1/2 translate-x-1/2 transition-opacity group-hover:opacity-[0.08]" style={{ background: riskColor }} />
                  <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-hc-teal/10 border border-hc-border/20 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-500">
                      <span className="text-xl font-black text-hc-teal">
                        {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h2 className="text-2xl font-black text-hc-text tracking-tight group-hover:text-hc-teal transition-colors">{client.name}</h2>
                        {topRisk > 0 && (
                          <span className="pill text-[9px] font-black uppercase tracking-widest animate-pulse-soft"
                            style={{ background: riskColor + '22', color: riskColor, border: `1px solid ${riskColor}44` }}>
                            RISK: {topRisk}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        {client.dob && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">DOB:</span>
                            <span className="text-[11px] font-bold text-hc-text/70 tabular-nums">{client.dob}</span>
                          </div>
                        )}
                        {client.nhs && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest">NHS:</span>
                            <span className="text-[11px] font-bold text-hc-text/70 tabular-nums">{client.nhs}</span>
                          </div>
                        )}
                        <div className="h-3 w-px bg-hc-border/40 hidden md:block" />
                        <div className="flex items-center gap-2">
                          {client.diagnoses.slice(0, 3).map((d, i) => (
                            <span key={i} className="text-[9px] font-black bg-hc-border/20 border border-hc-border/20 px-2.5 py-0.5 rounded-lg text-hc-muted uppercase tracking-tighter truncate max-w-[140px]">
                              {d}
                            </span>
                          ))}
                          {client.diagnoses.length > 3 && (
                            <span className="text-[9px] font-black text-hc-teal/60">+{client.diagnoses.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {topRisk > 0 && (
                      <div className="hidden lg:flex flex-col items-end shrink-0 pl-6 border-l border-hc-border/30">
                        <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] mb-1">Risk Status</span>
                        <span className="text-[13px] font-black uppercase tracking-widest" style={{ color: riskColor }}>{riskLabel}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Document actions */}
                <div className="border-t border-hc-border/20 px-8 py-5 bg-hc-border/10">
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
                    <span className={`pill text-[9px] font-black uppercase tracking-wide ${hasCareCircle ? 'bg-[#5d0565]/10 text-[#5d0565] border border-[#5d0565]/25' : 'pill-blue'}`}>
                      Care Circle {hasCareCircle ? 'On' : 'Off'}
                    </span>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-8">
                      {/* PBS */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shadow-sm ${hasPBS ? 'bg-hc-teal glow-teal' : 'bg-hc-border'}`} />
                          <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">PBS</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openPBS(client.id)}
                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition-all
                              ${hasPBS ? 'bg-hc-teal/10 text-hc-teal border border-hc-teal/30 hover:bg-hc-teal/20' : 'bg-hc-border/20 text-hc-muted border border-hc-border/20 hover:text-hc-text'}`}>
                            {hasPBS ? 'Edit' : 'Create'}
                          </button>
                          {hasPBS && (
                            <button onClick={() => printDoc(client, 'pbs')}
                              className="text-[10px] font-black text-hc-muted/50 hover:text-hc-text transition-colors p-1.5">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Risk */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shadow-sm ${hasRisk ? 'bg-flag-amber glow-amber' : 'bg-hc-border'}`} />
                          <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Risk</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openRisk(client.id)}
                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition-all
                              ${hasRisk ? 'bg-flag-amber/10 text-flag-amber border border-flag-amber/30 hover:bg-flag-amber/20' : 'bg-hc-border/20 text-hc-muted border border-hc-border/20 hover:text-hc-text'}`}>
                            {hasRisk ? 'Edit' : 'Create'}
                          </button>
                          {hasRisk && (
                            <button onClick={() => printDoc(client, 'risk')}
                              className="text-[10px] font-black text-hc-muted/50 hover:text-hc-text transition-colors p-1.5">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Support Plan */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shadow-sm ${hasCarePlan ? 'bg-hc-sage glow-blue' : 'bg-hc-border'}`} />
                          <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Plan</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openCarePlan(client.id)}
                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition-all
                              ${hasCarePlan ? 'bg-hc-blue/10 text-hc-blue border border-hc-blue/30 hover:bg-hc-blue/20' : 'bg-hc-border/20 text-hc-muted border border-hc-border/20 hover:text-hc-text'}`}>
                            {hasCarePlan ? `Update (${cpFilled}/${cpDomains.length})` : 'Create'}
                          </button>
                          {hasCarePlan && (
                            <>
                              <button onClick={() => printDoc(client, 'careplan')}
                                className="text-[10px] font-black text-hc-muted/50 hover:text-hc-text transition-colors p-1.5" title="Print care plan">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                              </button>
                              <button onClick={() => printDoc(client, 'easyread')}
                                className="text-[10px] font-black text-hc-teal/50 hover:text-hc-teal transition-colors px-2 py-1 rounded-lg hover:bg-hc-teal/10" title="Easy Read version">
                                📖
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                      <button onClick={() => openCareCircle(client.id)}
                        className="inline-flex items-center gap-2 text-[10px] font-black text-[#5d0565] uppercase tracking-widest hover:text-hc-text transition-colors">
                        <Users className="w-3.5 h-3.5" />
                        Care Circle
                      </button>
                      <div className="h-4 w-px bg-hc-border/40" />
                      <button onClick={() => { setImportTarget(client.id); setSubView('import'); }}
                        className="text-[10px] font-black text-hc-teal uppercase tracking-widest hover:text-hc-text transition-colors">
                        Intelligence Sync
                      </button>
                      <div className="h-4 w-px bg-hc-border/40" />
                      <button onClick={() => handleDelete(client.id, client.name)}
                        className="text-[10px] font-black text-hc-muted/40 hover:text-flag-red transition-colors uppercase tracking-widest">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* External Document Storage */}
                <div className="border-t border-hc-border/20 px-8 py-6 bg-hc-border/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="section-header text-[10px] tracking-widest opacity-60">External Evidence Pack</span>
                      <span className="pill pill-blue text-[8px] font-black px-2">VERCEL BLOB NATIVE</span>
                    </div>
                    <button
                      disabled={isUploading === client.id}
                      onClick={() => { setSelectedId(client.id); docUploadRef.current?.click(); }}
                      className="flex items-center gap-2 px-4 py-2 btn-clay text-hc-teal hover:text-hc-teal text-[10px] font-black uppercase tracking-widest rounded-xl"
                    >
                      {isUploading === client.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {isUploading === client.id ? 'Uploading...' : 'Upload Document'}
                    </button>
                  </div>

                  {(!client.documents || client.documents.length === 0) ? (
                    <div className="py-8 text-center bg-hc-border/10 border border-dashed border-hc-border/40 rounded-2xl">
                      <p className="text-[10px] text-hc-muted font-bold uppercase tracking-widest italic">No external files attached to this profile</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {client.documents.map(doc => (
                        <div key={doc.id} className="bg-hc-bone border border-hc-border/20 rounded-xl p-3 flex items-center justify-between group/doc hover:border-hc-teal/20 transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-hc-teal/10 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-hc-teal" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-black text-hc-text truncate pr-2" title={doc.name}>{doc.name}</p>
                              <p className="text-[8px] text-hc-muted font-bold uppercase tracking-tighter">
                                {new Date(doc.uploadedAt).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-hc-muted hover:text-hc-teal transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button onClick={() => deleteDoc(client.id, doc.id)} className="p-1.5 text-hc-muted hover:text-flag-red transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Care plan domains preview */}
                {hasCarePlan && cpDomains.length > 0 && (
                  <div className="border-t border-hc-border/20 px-8 py-4 bg-hc-border/10 overflow-hidden relative">
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
                        <span className="text-[9px] font-black text-hc-muted/50 uppercase tracking-widest flex items-center">+{cpDomains.length - 12} more protocol areas</span>
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
      <div className="mt-32 pt-12 border-t border-hc-border/30 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
        <div className="bg-flag-red/5 rounded-[2rem] p-8 border border-flag-red/20 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6 text-center md:text-left flex-col md:flex-row">
            <div className="w-16 h-16 rounded-3xl bg-flag-red/10 flex items-center justify-center text-flag-red glow-red shrink-0">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-black text-flag-red uppercase tracking-[0.3em] mb-2">Clear All Data</h3>
              <p className="text-hc-muted text-xs font-medium max-w-md leading-relaxed">
                Delete all people, support plans, and documents from this device. This cannot be undone.
              </p>
            </div>
          </div>
          <button
            onClick={async () => { if(confirm('Are you sure? This will delete every person and every document. This cannot be undone.')) await purgeSystemDataAsync(); }}
            className="px-10 py-4 bg-flag-red text-hc-bone rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-red-500 transition-all flex items-center gap-3 shadow-xl shadow-red-900/20 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* New Person Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-hc-text/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="hc-clay-raised rounded-[2.5rem] p-10 w-full max-w-lg animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-hc-teal/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />

            <div className="relative z-10">
              <h2 className="text-3xl font-black text-hc-text mb-2 tracking-tighter">Add New Person</h2>
              <p className="text-hc-muted text-sm mb-8 font-medium leading-relaxed">
                Add a new person to the system. You will be taken to the PBS builder straight away.
              </p>

              <div className="mb-10">
                <label className="section-header text-[9px] mb-2 ml-1 block tracking-[0.2em]">Full Name</label>
                <div className="relative group">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="e.g. Sarah Johnson"
                    className="hc-clay-inset w-full rounded-2xl px-6 py-4 text-lg font-bold text-hc-text focus:outline-none transition-all placeholder:text-hc-muted/40"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-hc-teal/10 flex items-center justify-center opacity-0 group-focus-within:opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-hc-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => { setShowNewModal(false); setNewName(''); }}
                  className="flex-1 btn-clay text-[11px] py-4 rounded-2xl">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={!newName.trim()}
                  className="flex-[2] btn-tactical disabled:opacity-20 disabled:grayscale text-[11px] py-4 rounded-2xl">
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
