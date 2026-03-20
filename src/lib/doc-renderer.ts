// ============================================================
// DOC RENDERER — Final Architectural Precision Build
// ============================================================
import { LEVEL_OF_NEED_LABELS } from './client-store';
import type { FullClient } from './client-store';
import type { Sig } from '../components/SignaturePad';

const TEAL = '#0f766e';
const NAVY = '#0c1829';
const SLATE = '#1e293b';
const MUTED = '#64748b';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const GREEN = '#22c55e';

export function riskInfo(likelihood: number, impact: number) {
  const score = likelihood * impact;
  let color: string;
  let label: string;
  if (score <= 3) { color = GREEN; label = 'LOW'; }
  else if (score <= 6) { color = '#84cc16'; label = 'STABLE'; }
  else if (score <= 12) { color = AMBER; label = 'MONITOR'; }
  else if (score <= 16) { color = RED; label = 'CRITICAL'; }
  else { color = '#7f1d1d'; label = 'BREACH'; }
  return { score, color, label };
}

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap');
  
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
  body { 
    font-family: 'Inter', -apple-system, sans-serif; 
    color: ${SLATE}; 
    line-height: 1.6; 
    margin: 0; 
    padding: 0;
    background: #fff;
  }
  
  .page {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    padding: 25mm;
    margin: 0 auto;
    background: #fff;
  }

  .page:not(:first-child) {
    page-break-before: always;
  }

  @media print {
    @page { margin: 0; }
    body { background: none; }
    .page { margin: 0; padding: 15mm; width: 100%; border: none; min-height: auto; }
    table, tr, .risk-card, .domain-card, .sig-block, .sig-card, .info-grid, .section-block, .metric-row, .summary-card, .risk-indicator, blockquote, .field-pair {
      page-break-inside: avoid;
    }
    .page > div { page-break-inside: avoid; }
    h2, h3 { page-break-after: avoid; }
    table { page-break-before: auto; }
  }

  /* Executive Typography */
  h1 { font-size: 32px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.02em; margin: 0; color: ${NAVY}; }
  h2 { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: ${TEAL}; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin: 30px 0 15px; display: flex; align-items: center; gap: 10px; }
  h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${MUTED}; margin: 20px 0 8px; }
  
  p { font-size: 12px; margin: 0 0 12px; color: ${SLATE}; text-align: left; }
  .mono { font-family: 'JetBrains Mono', monospace; font-size: 9px; }

  /* Cover Architecture */
  .cover {
    height: 250mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 20px;
    position: relative;
  }
  
  .cover-border {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border: 1px solid #e2e8f0;
    pointer-events: none;
  }

  .accent-bar { width: 60px; height: 6px; background: ${TEAL}; margin-bottom: 24px; }
  
  .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 2px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; background: ${NAVY}; color: #fff; }

  /* Data Grids */
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #edf2f7; }
  th { background: #fcfdfe; color: ${NAVY}; font-size: 9px; font-weight: 800; text-transform: uppercase; text-align: left; padding: 12px; border: 1px solid #edf2f7; letter-spacing: 0.05em; }
  td { padding: 12px; border: 1px solid #edf2f7; font-size: 11px; vertical-align: top; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 40px 0; }
  .info-item { margin-bottom: 15px; }
  .info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: ${MUTED}; margin-bottom: 2px; letter-spacing: 0.05em; }
  .info-val { font-size: 13px; font-weight: 600; color: ${NAVY}; }

  /* Visual Elements */
  .risk-indicator { width: 100%; height: 6px; background: #f1f5f9; border-radius: 3px; margin: 8px 0; overflow: hidden; }
  .risk-fill { height: 100%; border-radius: 3px; }
  
  .doc-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .sig-card { border: 1px solid #edf2f7; padding: 20px; border-radius: 8px; background: #fcfdfe; break-inside: avoid; }
`;

function renderCover(title: string, client: FullClient, planDate: string) {
  return `<div class="page"><div class="cover"><div class="cover-border"></div><div style="padding: 40px;"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="display: flex; align-items: center; gap: 12px;"><img src="/logo-icon-dark.png" style="height: 48px; border-radius: 8px;"/><div style="font-weight: 800; font-size: 14px; color: ${NAVY};">HAZEL CARE LTD</div></div><div class="badge">SECURE PROTOCOL</div></div><div style="margin-top: 100px;"><div class="accent-bar"></div><h1>${title}</h1><p style="font-size: 18px; color: ${MUTED}; font-weight: 500; margin-top: 10px;">Operational Support Specification: ${client.name}</p></div><div class="info-grid"><div><div class="info-item"><div class="info-label">Node Identifier</div><div class="info-val">${client.name}</div></div><div class="info-item"><div class="info-label">Temporal ID (DOB)</div><div class="info-val">${client.dob}</div></div><div class="info-item"><div class="info-label">Network ID (NHS)</div><div class="info-val">${client.nhs}</div></div></div><div><div class="info-item"><div class="info-label">Primary Lead Agent</div><div class="info-val">${client.keyWorker}</div></div><div class="info-item"><div class="info-label">Operational Date</div><div class="info-val">${planDate}</div></div><div class="info-item"><div class="info-label">Blueprint Hash</div><div class="info-val mono" style="color:${TEAL}">${Math.random().toString(36).substring(7).toUpperCase()}</div></div></div></div></div><div style="padding: 40px;"><div style="display: flex; gap: 20px; align-items: center; opacity: 0.7;"><div style="width: 3px; height: 50px; background: ${TEAL};"></div><p class="mono" style="margin: 0; font-size: 10px; line-height: 1.5; color: ${NAVY};">This document contains high-fidelity operational intelligence. Content is strictly confidential and intended for authorized Hazel Care personnel only. Synthesized via ArbiFlow v4.6 Tactical Engine.</p></div></div></div></div>`;
}

function renderSigBlock(sigs?: Sig[]) {
  const rows = sigs && sigs.length ? sigs : [
    { role: 'Completed By', name: 'Brooklyn Ruvinga', date: '', data: '' },
    { role: 'Responsible Manager', name: '', date: '', data: '' },
    { role: 'Primary Key Worker', name: '', date: '', data: '' }
  ];
  
  return `
    <div style="margin-top: 60px; break-inside: avoid;">
      <h2 style="color: ${NAVY}; border-color: ${NAVY};">Authorization & Verification</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-top: 25px;">
        ${rows.map(r => `
          <div class="sig-card">
            <div class="info-label">${r.role}</div>
            <div style="height: 50px; border-bottom: 1px dashed #cbd5e1; margin: 15px 0; display: flex; align-items: center;">
              ${r.data ? `<img src="${r.data}" style="max-height: 45px;"/>` : ''}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: ${NAVY};">
              <span>${r.name || 'Awaiting Sync'}</span>
              <span style="opacity: 0.5;">${r.date || '—'}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function riskWidget(likelihood: number, impact: number) {
  const { score, color, label } = riskInfo(likelihood, impact);
  return `
    <div style="margin: 12px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span class="mono" style="font-weight: 800; color: ${color}; font-size: 10px;">VECTOR INTENSITY: ${score} [${label}]</span>
        <span class="mono" style="opacity: 0.5; font-size: 9px;">Q: ${likelihood}x${impact}</span>
      </div>
      <div class="risk-indicator">
        <div class="risk-fill" style="width: ${(score / 25) * 100}%; background: ${color}; shadow: 0 0 10px ${color}40;"></div>
      </div>
    </div>
  `;
}

// ─── PBS Blueprint Builder ───────────────────────────────────────────────────
export function buildPBSHtml(client: FullClient, sigs?: Sig[]): string {
  const pbs = client.pbs;
  if (!pbs) return 'No data';
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>`;
  html += renderCover('MY PBS PROTOCOL', client, pbs.planDate);

  html += `<div class="page">
    <h2>01. Tactical Biography</h2>
    <p style="font-size: 14px; font-style: italic; border-left: 4px solid #f1f5f9; padding: 10px 20px; background: #fcfdfe;">${pbs.aboutText}</p>
    
    <h3>Strategic Values</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
      <div class="sig-card">
        <div class="info-label" style="color:${GREEN}">Positive Reinforcers</div>
        <div style="font-size: 12px; margin-top: 10px; line-height: 1.8;">${pbs.whatMatters.map(m => `• ${m}`).join('<br/>')}</div>
      </div>
      <div class="sig-card">
        <div class="info-label" style="color:${TEAL}">Transmission Optimization</div>
        <div style="font-size: 12px; margin-top: 10px; line-height: 1.8;">${pbs.communicatesBest.map(c => `• ${c}`).join('<br/>')}</div>
      </div>
    </div>

    <h2>02. Presentation Matrix</h2>
    <table><tr><th>Clinical Classification</th><th>Operational Presentation</th></tr>
      ${pbs.diagnosisRows.map(r => `<tr><td style="font-weight: 700; width: 35%; color: ${NAVY};">${r.diagnosis}</td><td>${r.presentation}</td></tr>`).join('')}
    </table>
    
    ${pbs.keyPrinciple ? `<div style="background: ${NAVY}; color: #fff; padding: 25px; border-radius: 8px; margin-top: 20px;"><div class="info-label" style="color: #94a3b8; margin-bottom: 10px;">Operational Philosophy</div><div style="font-size: 14px; font-weight: 600;">KEY PRINCIPLE: ${pbs.keyPrinciple}</div></div>` : ''}
  </div>`;

  html += `<div class="page">
    <h2>03. Reactive Escalation Protocol</h2>
    <div style="border-left: 4px solid ${RED}; padding-left: 30px; margin-top: 40px;">
      ${[pbs.reactiveStep1, pbs.reactiveStep2, pbs.reactiveStep3, pbs.reactiveStep4, pbs.reactiveStep5, pbs.reactiveStep6, pbs.reactiveStep7].map((s, i) => s ? `
        <div style="margin-bottom: 30px;">
          <div class="mono" style="color: ${RED}; font-weight: 900; font-size: 10px; margin-bottom: 5px;">PHASE 0${i + 1} DEPLOYMENT</div>
          <div style="font-size: 15px; font-weight: 600; color: ${NAVY};">${s}</div>
        </div>
      ` : '').join('')}
    </div>
    ${renderSigBlock(sigs)}
  </div></body></html>`;
  return html;
}

// ─── Risk Matrix Builder ─────────────────────────────────────────────────────
export function buildRiskHtml(client: FullClient, sigs?: Sig[]): string {
  const risk = client.risk;
  if (!risk) return 'No data';
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>`;
  html += renderCover('MY SAFETY MATRIX', client, risk.planDate);

  html += `<div class="page">
    <h2>Threat Node Analysis</h2>
    ${risk.risks.map((r, i) => `
      <div style="margin-bottom: 40px; border-bottom: 1px solid #f1f5f9; padding-bottom: 30px; break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div class="mono" style="opacity: 0.5; margin-bottom: 5px;">NODE VECTOR 0${i + 1}</div>
            <h3 style="margin: 0; font-size: 18px; color: ${NAVY}; text-transform: none; letter-spacing: 0;">${r.title}</h3>
          </div>
          <div style="width: 200px;">${riskWidget(r.likelihood, r.impact)}</div>
        </div>
        <p style="margin-top: 15px; font-size: 13px; line-height: 1.7;">${r.description}</p>
        <div class="grid-2" style="margin-top: 20px;">
          <div class="sig-card" style="padding: 15px; background: #fff;"><div class="info-label">Countermeasures</div><div style="font-size: 11px; margin-top: 8px;">${r.controls.map(c => `• ${c}`).join('<br/>')}</div></div>
          <div class="sig-card" style="padding: 15px; background: #fff;"><div class="info-label">Signal Indicators</div><div style="font-size: 11px; margin-top: 8px;">${r.earlyWarnings.map(w => `⚠ ${w}`).join('<br/>')}</div></div>
        </div>
      </div>
    `).join('')}
    ${renderSigBlock(sigs)}
  </div></body></html>`;
  return html;
}

// ─── Care Plan Builder ───────────────────────────────────────────────────────
export function buildCarePlanHtml(client: FullClient): string {
  const cp = client.carePlan;
  if (!cp) return 'No data';
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>`;
  html += renderCover('MY SUPPORT PLAN', client, cp.planDate);

  html += `<div class="page">
    <h2>System Architecture Overview</h2>
    <p style="font-size: 14px; font-style: italic; color: ${MUTED}; margin-bottom: 30px;">${cp.biography}</p>
    
    <div class="grid-2" style="margin: 40px 0;">
      <div style="background: #fff5f5; padding: 25px; border-radius: 8px; border-left: 4px solid ${RED};">
        <div class="info-label" style="color:${RED}; margin-bottom: 10px;">Critical Infrastructure</div>
        <div style="font-size: 12px; line-height: 1.7;">${cp.criticalInfo}</div>
      </div>
      <div style="background: #fffaf0; padding: 25px; border-radius: 8px; border-left: 4px solid ${AMBER};">
        <div class="info-label" style="color:${AMBER}; margin-bottom: 10px;">Emergency Protocol</div>
        <div style="font-size: 12px; line-height: 1.7;">${cp.emergencyInfo}</div>
      </div>
    </div>

    <h3>Strategic Domain Index</h3>
    <table><tr><th>Protocol Module</th><th>Need Level</th><th>Vector Level</th></tr>
      ${cp.domains.filter(d => d.enabled).map(d => {
        const { label, color } = riskInfo(d.riskLikelihood, d.riskImpact);
        return `<tr>
          <td style="font-weight: 700; color: ${NAVY};">${d.title}</td>
          <td><span class="pill" style="background:#f8fafc; border-color:#e2e8f0; color:${NAVY}">${LEVEL_OF_NEED_LABELS[d.levelOfNeed]}</span></td>
          <td><span class="mono" style="color: ${color}; font-weight: 900;">${label}</span></td>
        </tr>`;
      }).join('')}
    </table>
  </div>`;

  cp.domains.filter(d => d.enabled).forEach((d, i) => {
    html += `<div class="page">
      <div class="badge" style="margin-bottom: 10px;">Sector Module 0${i + 1}</div>
      <h1 style="border-bottom: 2px solid ${NAVY}; padding-bottom: 15px; margin-bottom: 30px;">${d.title}</h1>
      
      <div class="grid-2" style="margin-bottom: 40px;">
        <div><h3 style="margin-top:0;">Requirement Analysis</h3><p style="font-size: 13px;">${d.identifiedNeed}</p></div>
        <div style="background: #fcfdfe; border: 1px solid #edf2f7; padding: 20px; border-radius: 8px;">
          <h3 style="margin-top:0;">Mission Success Criteria</h3><p style="font-weight:700; font-size:12px; color:${TEAL};">${d.plannedOutcomes}</p>
        </div>
      </div>

      <h2>Operational Directive</h2>
      <p style="font-size: 14px; line-height: 1.8; color: ${NAVY};">${d.howToAchieve}</p>

      <div style="margin-top: 50px; padding: 30px; background: #fff; border: 1px solid #edf2f7; border-left: 5px solid ${AMBER}; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <div class="info-label" style="margin-bottom: 15px;">Threat Neutralization: ${d.riskTitle}</div>
        <div style="max-width: 350px;">${riskWidget(d.riskLikelihood, d.riskImpact)}</div>
        <p style="margin-top: 15px; font-size: 12px; color: ${MUTED}; line-height: 1.7;">${d.riskMitigation}</p>
      </div>

      <div class="doc-footer">
        <div class="mono" style="opacity: 0.5;">Recalibration Frequency: ${d.nextReviewDate}</div>
        <div class="mono" style="opacity: 0.5;">Field Agent: ${d.reviewer}</div>
      </div>
    </div>`;
  });

  html += `</body></html>`;
  return html;
}
