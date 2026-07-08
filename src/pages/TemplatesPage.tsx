import { useMemo, useRef, useState } from 'react';
import type { TemplateType, WeekSummary } from '../lib/types';
import { TEMPLATES } from '../lib/types';
import { getLineageForEntries, logAuditAction } from '../lib/audit';
import { buildTemplateDocument, type TemplateImportContext } from '../lib/template-doc-renderer';

interface Props {
  weekData: WeekSummary | null;
}

const TEMPLATE_CONTEXT_KEY = 'hc-template-import-context';

function readTemplateImportContext(): TemplateImportContext | null {
  try {
    const raw = localStorage.getItem(TEMPLATE_CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TemplateImportContext;
  } catch {
    return null;
  }
}

function loadRecommendedTemplateIds(): TemplateType[] {
  return readTemplateImportContext()?.selectedTemplateIds || [];
}

export function TemplatesPage({ weekData }: Props) {
  const [recIds] = useState<TemplateType[]>(() => loadRecommendedTemplateIds());
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(
    () => recIds[0] || TEMPLATES[0]?.id || null,
  );
  const [reviewer, setReviewer] = useState('');
  const [reviewApproved, setReviewApproved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const selectedDefinition = TEMPLATES.find((template) => template.id === selectedTemplate);

  const html = useMemo(() => {
    if (!weekData || !selectedTemplate) return null;
    const ctx = readTemplateImportContext();
    const allEntryIds = Object.values(weekData.houses).flatMap((house) => house.entries.map((entry) => entry.id));
    const lineage = getLineageForEntries(allEntryIds);

    logAuditAction(
      'document_generated',
      `Generated ${selectedTemplate} report`,
      { templateId: selectedTemplate, house: ctx?.house },
      lineage,
    );

    return buildTemplateDocument(weekData, selectedTemplate, ctx, {
      reviewer,
      approved: reviewApproved,
    });
  }, [selectedTemplate, weekData, reviewer, reviewApproved]);

  function handleReleaseToPhysical() {
    if (!reviewApproved || !reviewer.trim() || !selectedTemplate) return;
    logAuditAction('review_signed_off', `Review signoff for ${selectedTemplate}`, {
      templateId: selectedTemplate,
      reviewer: reviewer.trim(),
      approved: true,
    });
    iframeRef.current?.contentWindow?.print();
  }

  if (!weekData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-16 animate-in fade-in duration-500">
        <div className="hc-clay-raised w-20 h-20 rounded-[2rem] flex items-center justify-center mb-8">
          <span className="text-xs font-black tracking-[0.2em] text-hc-muted">DOC</span>
        </div>
        <div className="text-[11px] font-black text-hc-teal uppercase tracking-[0.3em] mb-3">Preview Offline</div>
        <h2 className="text-xl font-black text-hc-text mb-3 uppercase tracking-tight">No documents yet</h2>
        <p className="text-hc-muted text-[11px] font-bold text-center max-w-xs uppercase tracking-widest leading-relaxed">
          Import diary entries or paste support plans to generate operational documents.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col animate-in fade-in duration-500">
      <div className="shrink-0 border-b border-hc-border/30 px-8 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-hc-text tracking-[0.2em] uppercase mb-1">Document Library</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-black text-hc-teal tracking-[0.2em] uppercase">Build and print care documents</span>
            <div className="h-3 w-px bg-hc-border/40" />
            <span className="text-[11px] font-bold text-hc-muted uppercase tracking-widest">{TEMPLATES.length} Templates</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 shrink-0 border-r border-hc-border/30 flex flex-col min-w-0">
          <div className="p-4 border-b border-hc-border/20">
            <span className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em]">Template Selection</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
            {TEMPLATES.map((template) => {
              const isRecommended = recIds.includes(template.id);
              const isSelected = selectedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all flex flex-col gap-1 ${
                    isSelected ? 'hc-clay-inset' : 'hover:bg-black/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-black uppercase tracking-tight leading-snug break-words ${isSelected ? 'text-hc-teal' : 'text-hc-text'}`}>
                      {template.name}
                    </span>
                    {isRecommended && (
                      <span className="text-[10px] font-black bg-hc-teal text-hc-bg px-1.5 py-0.5 rounded uppercase tracking-widest">
                        REC
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-hc-muted uppercase tracking-widest leading-tight break-words">{template.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              <div className="shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4 px-8 py-3 border-b border-hc-border/20">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                  <div className="w-1.5 h-4 rounded-full bg-hc-teal shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-black text-hc-text uppercase tracking-[0.25em] break-words leading-snug">
                      {selectedDefinition?.name || selectedTemplate}
                    </div>
                    <div className="text-[10px] font-bold text-hc-muted uppercase tracking-widest break-words leading-snug">
                      {selectedDefinition?.desc || 'Operational document'}
                    </div>
                  </div>
                  <input
                    value={reviewer}
                    onChange={(event) => setReviewer(event.target.value)}
                    placeholder="Reviewer name"
                    className="ml-3 px-3 py-1.5 rounded-lg border border-hc-border/30 text-[10px] font-bold uppercase tracking-widest text-hc-text bg-transparent min-w-[180px]"
                  />
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-hc-muted">
                    <input
                      type="checkbox"
                      checked={reviewApproved}
                      onChange={(event) => setReviewApproved(event.target.checked)}
                    />
                    Review complete
                  </label>
                </div>
                <button
                  onClick={handleReleaseToPhysical}
                  disabled={!reviewApproved || !reviewer.trim()}
                  className="btn-tactical px-8 py-2.5 text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Print Document
                </button>
              </div>
              <div className="flex-1 p-4 lg:p-8 overflow-auto scrollbar-thin">
                <div className="doc-preview-frame mx-auto bg-white shadow-2xl relative min-h-[1123px]">
                  <iframe
                    ref={iframeRef}
                    srcDoc={html || ''}
                    className="w-full h-full min-h-[1123px] border-0 block"
                    title="Document Preview"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="hc-clay-raised w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-xs font-black tracking-[0.2em] text-hc-muted">DOC</span>
              </div>
              <p className="text-[11px] font-black tracking-widest text-hc-muted uppercase text-center">Select a template to synthesise</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
