import { useEffect, useState, useRef, useCallback } from 'react';
import type { WeekSummary, TemplateType } from '../lib/types';
import { TEMPLATES } from '../lib/types';
import { escapeHtml } from '../lib/html-escape';

/** Escape user-derived strings embedded in report HTML. */
function ex(s: string | undefined | null): string {
  return escapeHtml(s == null ? '' : String(s));
}

interface Props {
  weekData: WeekSummary | null;
}

const TEMPLATE_CONTEXT_KEY = 'hc-template-import-context';

interface TemplateImportContext {
  selectedTemplateIds?: TemplateType[];
  /** Set when arriving from Staff Intelligence monitoring */
  source?: string;
  at?: string;
  monitoringRunId?: string;
  house?: string;
  dateFrom?: string;
  dateTo?: string;
  escalationCount?: number;
  avgHouseQuality?: number;
}

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

/** Inline block inside document body (after header) when Staff Intelligence context is active. */
function monitoringContextBlock(ctx: TemplateImportContext | null): string {
  if (!ctx || ctx.source !== 'staff-monitoring') return '';
  const win =
    ctx.dateFrom && ctx.dateTo ? `${ex(ctx.dateFrom)} — ${ex(ctx.dateTo)}` : 'REGISTRY_FEED';
  const esc =
    ctx.escalationCount != null && ctx.escalationCount > 0
      ? `<div style="margin-top:4px;"><strong>Escalations:</strong> ${ctx.escalationCount}</div>`
      : '';
  const q =
    ctx.avgHouseQuality != null
      ? `<div style="margin-top:2px;"><strong>Quality Index:</strong> ${ctx.avgHouseQuality}/100</div>`
      : '';
  const scope = ctx.house ? ex(ctx.house).toUpperCase() : 'GLOBAL_SCOPE';
  return `
  <div style="background:#f8fafc; border: 1px solid #cbd5e1; padding: 12px 15px; margin-bottom: 20px; font-size: 10px; color: #334155; line-height: 1.4; font-family: 'Consolas', 'Monaco', monospace;">
    <div style="font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #020617; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">INTELLIGENCE_CONTEXT_SITREP</div>
    <div>WINDOW: ${win}</div>
    <div>SCOPE: ${scope}</div>
    ${esc}
    ${q}
    <div style="margin-top: 6px; color: #94a3b8; font-size: 8px;">SNAPSHOT_AT: ${ex(ctx.at || '')}</div>
  </div>`;
}

const FOOTER_HTML = `
  <div style="margin-top: auto; padding-top: 20px; text-align: center; border-top: 2px solid #0f172a; padding-bottom: 10px;">
    <div style="color: #0f172a; font-size: 10px; font-weight: 900; letter-spacing: 0.3em; text-transform: uppercase;">HAZEL CARE OPERATIONS</div>
    <div style="color: #64748b; font-size: 8px; font-weight: 700; margin-top: 4px; letter-spacing: 0.15em;">CLASSIFIED DIAGNOSTIC RECORD // DO NOT REDISTRIBUTE</div>
  </div>
`;

function renderHeader(title: string, subtitle: string, color: string) {
  const t = ex(title).toUpperCase();
  const s = ex(subtitle).toUpperCase();
  return `
  <div style="display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 4px solid ${color || '#0f172a'}; padding-bottom: 15px; margin-bottom: 25px;">
    <div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.04em; line-height: 1;">${t}</h1>
      <p style="margin: 6px 0 0; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em;">${s}</p>
    </div>
    <div style="text-align: right; border-left: 1px solid #e2e8f0; padding-left: 15px;">
      <div style="font-weight: 900; font-size: 12px; color: #0f172a; letter-spacing: -0.02em;">HAZEL CARE LTD</div>
      <div style="font-weight: 800; font-size: 7px; color: #94a3b8; letter-spacing: 0.3em; margin-top: 2px;">OPERATIONAL_DIAGNOSTIC</div>
    </div>
  </div>`;
}

function generateQualityMeeting(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#0f172a';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  let html = renderHeader('Quality & Compliance SITREP', 'Regional Operational Audit Broadcast', COLOR);
  html += monitoringContextBlock(mon);
  html += '<p>Audit of all regional units for clinical compliance and operational safety.</p>';
  html += '<table style="width:100%; border-collapse:collapse; margin-top:15px; font-size:10px;">';
  html += '<tr style="background:#f1f5f9;">' +
    '<th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">OPERATIONAL_UNIT</th>' +
    '<th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">CRITICAL_ALERTS</th>' +
    '<th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">MED_ERRORS</th>' +
    '<th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">INCIDENTS</th>' +
    '</tr>';
  houses.forEach(h => {
    html += `<tr>
      <td style="border:1px solid #cbd5e1; padding:8px; font-weight:700;">${ex(h.name)}</td>
      <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; color:${h.flags.red > 0 ? '#ef4444' : '#64748b'};">${h.flags.red}</td>
      <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${h.medication.filter(e => e.severity === 'red').length}</td>
      <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${h.incidents.length}</td>
    </tr>`;
  });
  html += '</table>' + FOOTER_HTML;
  return html;
}

function generateMonthlyReview(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#0f172a';
  const houses = Object.values(data.houses).sort((a, b) => a.name.localeCompare(b.name));
  let html = renderHeader('Monthly Unit Review', 'Unit-Level Diagnostic Performance Audit', COLOR);
  html += monitoringContextBlock(mon);
  houses.forEach(h => {
    html += `<div style="margin-top:20px; border:1px solid #e2e8f0; padding:15px; page-break-inside:avoid;">
      <div style="font-weight:900; font-size:12px; border-bottom:2px solid #0f172a; padding-bottom:5px; margin-bottom:10px;">UNIT: ${ex(h.name)}</div>
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; font-size:9px;">
        <div><strong>Log Volume:</strong> ${h.entries.length} points</div>
        <div style="color:${h.flags.red > 0 ? '#ef4444' : 'inherit'};"><strong>Critical Flags:</strong> ${h.flags.red}</div>
        <div><strong>Staff Activity:</strong> ${new Set(h.entries.map(e => e.carer)).size} commanders</div>
      </div>
    </div>`;
  });
  html += FOOTER_HTML;
  return html;
}

function generateServiceSitrep(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#0f172a';
  let html = renderHeader('Service SITREP', 'Global Operational Readiness & Status', COLOR);
  html += monitoringContextBlock(mon);
  html += `<div style="background:#0f172a; color:#fff; padding:20px; text-align:center; margin-bottom:25px;">
    <div style="font-size:32px; font-weight:900;">${data.totalEntries}</div>
    <div style="font-size:10px; font-weight:700; letter-spacing:0.2em;">TOTAL_DIAGNOSTIC_POINTS_SYNCED</div>
  </div>`;
  html += FOOTER_HTML;
  return html;
}

function generateIncidentsSitrep(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#ef4444';
  let html = renderHeader('Incident Sitrep', 'High-Severity Operational Intercepts', COLOR);
  html += monitoringContextBlock(mon);
  const allInc = Object.values(data.houses).flatMap(h => h.incidents);
  if (allInc.length === 0) html += '<p style="text-align:center; padding:40px; color:#64748b; font-weight:900;">NO_INCIDENTS_LOGGED_FOR_PERIOD</p>';
  else {
    allInc.forEach(i => {
      html += `<div style="border:2px solid #ef4444; margin-bottom:15px; padding:15px;">
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #fee2e2; padding-bottom:8px; margin-bottom:10px;">
          <span style="font-weight:900; color:#ef4444;">${ex(i.house)} // ${ex(i.client)}</span>
          <span style="font-family:monospace; font-weight:700;">${ex(i.date)}</span>
        </div>
        <div style="font-size:11px; line-height:1.5;">${ex(i.entry)}</div>
      </div>`;
    });
  }
  html += FOOTER_HTML;
  return html;
}

function generateSafeguardingSitrep(data: WeekSummary, mon: TemplateImportContext | null): string {
  const COLOR = '#be185d';
  let html = renderHeader('Safeguarding Sitrep', 'Sensitive Vulnerability & Risk Management', COLOR);
  html += monitoringContextBlock(mon);
  const allSafe = Object.values(data.houses).flatMap(h => h.safeguarding);
  allSafe.forEach(s => {
    html += `<div style="border-left:5px solid #be185d; padding-left:15px; margin-bottom:20px;">
      <div style="font-weight:900; font-size:11px; margin-bottom:5px;">${ex(s.house)} // ${ex(s.client)}</div>
      <div style="font-size:10px; color:#475569;">${ex(s.entry)}</div>
    </div>`;
  });
  html += FOOTER_HTML;
  return html;
}

function generateGeneric(title: string, subtitle: string, color: string): string {
  let html = renderHeader(title, subtitle, color);
  html += `<div style="padding:40px; border:1px dashed #cbd5e1; text-align:center; font-size:10px; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:0.2em;">SYNTHESIZING_DETAILED_TELEMETRY...</div>`;
  html += FOOTER_HTML;
  return html;
}

export function TemplatesPage({ weekData }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [recIds, setRecIds] = useState<TemplateType[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const ids = loadRecommendedTemplateIds();
    setRecIds(ids);
    if (ids.length > 0) {
      setSelectedTemplate(ids[0]);
    }
  }, []);

  const generate = useCallback(() => {
    if (!weekData || !selectedTemplate) return;
    const ctx = readTemplateImportContext();
    let res = '';
    switch (selectedTemplate) {
      case 'quality_meeting':
      case 'weekly_quality_report':
        res = generateQualityMeeting(weekData, ctx);
        break;
      case 'care_review':
        res = generateMonthlyReview(weekData, ctx);
        break;
      case 'daily_quality':
        res = generateServiceSitrep(weekData, ctx);
        break;
      case 'incident_report':
        res = generateIncidentsSitrep(weekData, ctx);
        break;
      case 'safeguarding':
        res = generateSafeguardingSitrep(weekData, ctx);
        break;
      case 'medication_transaction':
        res = generateGeneric('Medication Transaction Ledger', 'Controlled Substance Chain of Custody', '#0891b2');
        break;
      case 'finance_audit':
        res = generateGeneric('Fiscal Audit Snapshot', 'Regional Resource & Petty Cash Recon', '#0f172a');
        break;
      case 'repairs_maintenance':
        res = generateGeneric('Facilities Maintenance Log', 'Infrastructure & Environmental Safety Hub', '#0f172a');
        break;
      case 'performance_improvement':
        res = generateGeneric('Performance Improvement Plan', 'Personnel Engineering & Corrective Action', '#ef4444');
        break;
      case 'probation_review':
        res = generateGeneric('Probation Audit Review', 'Commander Eligibility & Performance Gateway', '#0f172a');
        break;
      case 'exit_interview':
        res = generateGeneric('Personnel Exit Interview', 'Deployment Termination Diagnostic', '#64748b');
        break;
      default:
        res = generateServiceSitrep(weekData, ctx);
        break;
    }
    setHtml(res);
  }, [selectedTemplate, weekData]);

  useEffect(() => { generate(); }, [generate]);

  if (!weekData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-8 bg-slate-950 animate-in fade-in duration-700">
        <div className="text-[11px] font-black tracking-[0.3em] text-hc-teal-light uppercase mb-6 border-b border-hc-teal/30 pb-2">SYNTHESIS OFFLINE</div>
        <div className="w-16 h-px bg-slate-800 mb-8" />
        <h2 className="text-2xl font-black text-white mb-4 tracking-tighter uppercase">No Live Telemetry</h2>
        <p className="text-slate-400 text-[11px] font-bold mb-10 text-center max-w-xs uppercase tracking-widest leading-relaxed">
          Sync regional operational data to initialize document synthesis.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-950 animate-in fade-in duration-700">
      
      {/* ── SYNTHESIS HEADER ── */}
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 px-8 py-6 flex items-center justify-between gap-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-1 uppercase">Synthesis Matrix</h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-hc-teal-light tracking-[0.2em] uppercase">Document Assembly Station</span>
            <div className="h-3 w-px bg-slate-800" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{TEMPLATES.length} PROTOCOLS_LOADED</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Template Selector Rail */}
        <div className="w-80 shrink-0 border-r border-slate-800 bg-slate-950/40 flex flex-col">
          <div className="p-4 border-b border-slate-800 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">PROTOCOL_SELECTION</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
            {TEMPLATES.map(t => {
              const isRecommended = recIds.includes(t.id);
              return (
                <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  className={`w-full text-left px-4 py-3 border transition-all flex flex-col gap-1
                    ${selectedTemplate === t.id 
                      ? 'bg-hc-teal/10 border-hc-teal/40 text-hc-teal-light' 
                      : 'bg-slate-900/20 border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/40'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-tight">{t.name.replace(/ /g, '_')}</span>
                    {isRecommended && <span className="text-[7px] font-black bg-hc-teal text-slate-950 px-1 rounded-none shadow-[0_0_8px_rgba(20,184,166,0.4)]">REC</span>}
                  </div>
                  <span className="text-[8px] font-bold opacity-60 uppercase tracking-widest leading-tight">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview Station */}
        <div className="flex-1 flex flex-col bg-slate-950/20">
          {selectedTemplate ? (
            <>
              <div className="shrink-0 flex items-center justify-between px-8 py-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="w-1 h-3 bg-hc-teal" />
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] font-mono">{selectedTemplate.toUpperCase()}</span>
                </div>
                <button onClick={() => iframeRef.current?.contentWindow?.print()}
                  className="px-10 py-2.5 bg-hc-teal/10 border border-hc-teal/40 text-hc-teal-light text-[10px] font-black uppercase tracking-[0.25em] hover:bg-hc-teal/20 transition-all">
                  RELEASE_TO_PHYSICAL
                </button>
              </div>
              <div className="flex-1 p-8 overflow-y-auto scrollbar-thin flex justify-center">
                <div className="w-full max-w-4xl bg-white p-1 shadow-2xl relative min-h-[1200px]">
                  <iframe ref={iframeRef} srcDoc={html || ''} className="w-full h-full min-h-[1200px]" title="Document Synthesis Preview" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-40">
              <div className="w-16 h-16 border-2 border-dashed border-slate-700 flex items-center justify-center mb-4">
                <span className="text-2xl">📄</span>
              </div>
              <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase text-center">SELECT_TEMPLATE_FOR_SYNTHESIS</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
