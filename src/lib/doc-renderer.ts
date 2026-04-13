// ============================================================
// DOC RENDERER — Refined for Person-Centered Precision
// ============================================================
import { LEVEL_OF_NEED_LABELS } from './client-store';
import type { FullClient } from './client-store';
import type { Sig } from '../components/SignaturePad';
import { ORG_CONFIG } from './config';
export type ExportLayout = 'portrait' | 'landscape';

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
  if (score <= 3) { color = GREEN; label = 'Low'; }
  else if (score <= 6) { color = '#84cc16'; label = 'Moderate'; }
  else if (score <= 12) { color = AMBER; label = 'Significant'; }
  else if (score <= 16) { color = RED; label = 'High'; }
  else { color = '#7f1d1d'; label = 'Critical'; }
  return { score, color, label };
}

function pageSize(layout: ExportLayout) {
  return layout === 'landscape'
    ? { width: '297mm', minHeight: '210mm' }
    : { width: '210mm', minHeight: '297mm' };
}

function baseStyles(layout: ExportLayout = 'portrait') {
  const size = pageSize(layout);
  return `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  
  @page { size: A4 ${layout}; margin: 0; }

  * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
  body { 
    font-family: 'Inter', -apple-system, sans-serif; 
    color: ${SLATE}; 
    line-height: 1.5; 
    margin: 0; 
    padding: 0;
    background: #fff;
  }
  
  .page {
    position: relative;
    width: ${size.width};
    min-height: ${size.minHeight};
    padding: 20mm;
    margin: 0 auto;
    background: #fff;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 20px rgba(0,0,0,0.05);
  }

  /* Fix for blank pages and scaling */
  @media print {
    html, body { height: auto; }
    .page { 
      margin: 0 !important; 
      padding: 15mm !important; 
      width: ${size.width} !important;
      min-height: ${size.minHeight} !important;
      height: auto !important;
      border: none !important; 
      box-shadow: none !important;
      page-break-after: always !important;
      break-after: page !important;
      overflow: visible !important;
    }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  }

  h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: ${NAVY}; }
  h2 { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: ${TEAL}; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 25px 0 12px; display: flex; align-items: center; gap: 10px; }
  h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${MUTED}; margin: 15px 0 6px; }
  
  p { font-size: 11px; margin: 0 0 10px; color: ${SLATE}; text-align: left; }

  .cover {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border: 1px solid #e2e8f0;
    padding: 40px;
    position: relative;
  }

  .accent-bar { width: 60px; height: 6px; background: ${TEAL}; margin-bottom: 24px; }
  .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 2px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; background: ${NAVY}; color: #fff; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #edf2f7; table-layout: fixed; }
  th { background: #fcfdfe; color: ${NAVY}; font-size: 9px; font-weight: 800; text-transform: uppercase; text-align: left; padding: 10px; border: 1px solid #edf2f7; letter-spacing: 0.05em; }
  td { padding: 10px; border: 1px solid #edf2f7; font-size: 10px; vertical-align: top; word-wrap: break-word; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; }
  .info-item { margin-bottom: 12px; }
  .info-label { font-size: 8px; font-weight: 700; text-transform: uppercase; color: ${MUTED}; margin-bottom: 2px; letter-spacing: 0.05em; }
  .info-val { font-size: 12px; font-weight: 600; color: ${NAVY}; }

  .risk-indicator { width: 100%; height: 6px; background: #f1f5f9; border-radius: 3px; margin: 6px 0; overflow: hidden; }
  .risk-fill { height: 100%; border-radius: 3px; }
  
  .doc-footer { margin-top: auto; padding-top: 15px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: ${MUTED}; }
  .sig-card { border: 1px solid #edf2f7; padding: 15px; border-radius: 6px; background: #fcfdfe; break-inside: avoid; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

  /* 5x5 Risk Matrix Styles */
  .matrix-table { width: 200px; height: 200px; border-collapse: separate; border-spacing: 2px; }
  .matrix-table td { width: 40px; height: 40px; padding: 0; border: none; font-size: 8px; font-weight: 800; text-align: center; vertical-align: middle; color: rgba(0,0,0,0.2); }
  .matrix-table .cell-active { box-shadow: inset 0 0 0 2px #000; color: #000 !important; font-size: 11px !important; }
  .matrix-label { font-size: 7px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: ${MUTED}; }
`;
}

function renderCover(title: string, client: FullClient, planDate: string) {
  return `<div class="page"><div class="cover">
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <img src="${ORG_CONFIG.logoIcon}" style="height: 50px; width: 50px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" onerror="this.style.display='none'"/>
          <div>
            <div style="font-weight: 900; font-size: 16px; color: ${NAVY}; letter-spacing: -0.02em; line-height: 1;">${ORG_CONFIG.name.toUpperCase()}</div>
            <div style="font-weight: 800; font-size: 9px; color: ${TEAL}; letter-spacing: 0.2em; margin-top: 4px; opacity: 0.8;">OPERATIONS</div>
          </div>
        </div>
        <div class="badge" style="background: ${RED}15; color: ${RED}; border: 1px solid ${RED}30;">Confidential</div>
      </div>
      <div style="margin-top: 100px;">
        <div class="accent-bar" style="width: 80px; height: 8px;"></div>
        <h1 style="font-size: 38px; line-height: 1.1;">${title}</h1>
        <p style="font-size: 18px; color: ${MUTED}; font-weight: 600; margin-top: 12px; letter-spacing: -0.01em;">Prepared for ${client.name}</p>
      </div>
      <div class="info-grid">
        <div>
          <div class="info-item"><div class="info-label">Full Name</div><div class="info-val">${client.name}</div></div>
          <div class="info-item"><div class="info-label">Date of Birth</div><div class="info-val">${client.dob || '—'}</div></div>
          <div class="info-item"><div class="info-label">NHS Number</div><div class="info-val">${client.nhs || '—'}</div></div>
        </div>
        <div>
          <div class="info-item"><div class="info-label">Key Worker</div><div class="info-val">${client.keyWorker || '—'}</div></div>
          <div class="info-item"><div class="info-label">Plan Date</div><div class="info-val">${planDate || '—'}</div></div>
          <div class="info-item"><div class="info-label">Review Date</div><div class="info-val">${client.reviewDate || '—'}</div></div>
        </div>
      </div>
    </div>
    <div style="display: flex; gap: 20px; align-items: center; opacity: 0.7;">
      <div style="width: 3px; height: 40px; background: ${TEAL};"></div>
      <p style="margin: 0; font-size: 9px; line-height: 1.4; color: ${NAVY};">This document is confidential and intended for authorised ${ORG_CONFIG.name} personnel only. It contains personal and sensitive information protected under the ${ORG_CONFIG.dataProtectionAct} and ${ORG_CONFIG.gdpr}.</p>
    </div>
  </div></div>`;
}

function renderSigBlock(sigs?: Sig[]) {
  let profileName = 'Registered Manager';
  let profileRole = 'Operations Manager';
  
  try {
    const raw = localStorage.getItem('hc-profile-v1');
    if (raw) {
      const p = JSON.parse(raw);
      if (p.name) profileName = p.name;
      if (p.role) profileRole = p.role;
    }
  } catch { /* fallback */ }

  const rows = sigs && sigs.length
    ? sigs.filter((s) => s.include !== false)
    : [
    { role: profileRole, name: profileName, date: '', data: '' },
    { role: 'Key Worker', name: '', date: '', data: '' }
  ];
  if (!rows.length) return '';
  
  return `
    <div style="margin-top: 40px; break-inside: avoid;">
      <h2 style="color: ${NAVY}; border-color: ${NAVY};">Signatures</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
        ${rows.map(r => `
          <div class="sig-card">
            <div class="info-label">${r.role}</div>
            <div style="height: 40px; border-bottom: 1px dashed #cbd5e1; margin: 8px 0; display: flex; align-items: center;">
              ${r.data ? `<img src="${r.data}" style="max-height: 35px;"/>` : ''}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; color: ${NAVY};">
              <span>${r.name || ''}</span>
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
    <div style="margin: 8px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <span style="font-weight: 800; color: ${color}; font-size: 9px;">Risk Level: ${score} (${label})</span>
        <span style="opacity: 0.5; font-size: 8px; color: ${MUTED};">L${likelihood} x I${impact}</span>
      </div>
      <div class="risk-indicator">
        <div class="risk-fill" style="width: ${(score / 25) * 100}%; background: ${color};"></div>
      </div>
    </div>
  `;
}

function riskMatrix(likelihood: number, impact: number) {
  const cells: string[] = [];
  for (let i = 5; i >= 1; i--) { // Impact (Y)
    for (let j = 1; j <= 5; j++) { // Likelihood (X)
      const { color } = riskInfo(j, i);
      const active = likelihood === j && impact === i;
      cells.push(`<td style="background: ${color};" class="${active ? 'cell-active' : ''}">${j * i}</td>`);
    }
  }
  return `
    <div style="display: flex; gap: 10px; align-items: center; margin: 10px 0;">
      <div style="transform: rotate(-90deg); width: 0; white-space: nowrap; margin-right: 15px;" class="matrix-label">Impact &rarr;</div>
      <table class="matrix-table">
        ${Array.from({ length: 5 }).map((_, i) => `<tr>${cells.slice(i * 5, i * 5 + 5).join('')}</tr>`).join('')}
      </table>
      <div style="align-self: flex-end; margin-bottom: -15px;" class="matrix-label">Likelihood &rarr;</div>
    </div>
  `;
}

// ─── Document Generators ─────────────────────────────────────────────────────

export function buildPBSHtml(client: FullClient, sigs?: Sig[], layout: ExportLayout = 'portrait'): string {
  const pbs = client.pbs;
  if (!pbs) return 'No data';
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyles(layout)}</style></head><body>`;
  html += renderCover('Positive Behaviour Support Plan', client, pbs.planDate);

  html += `<div class="page">
    <h2>1. About Me</h2>
    <p style="font-size: 13px; font-style: italic; border-left: 4px solid #f1f5f9; padding: 10px 15px; background: #fcfdfe;">${pbs.aboutText}</p>
    
    <h3>What Matters to Me</h3>
    <div class="grid-2" style="margin-top: 10px;">
      <div class="sig-card">
        <div class="info-label" style="color:${GREEN}">Important to Me</div>
        <div style="font-size: 11px; margin-top: 8px; line-height: 1.6;">${pbs.whatMatters.filter(m => m).map(m => `&bull; ${m}`).join('<br/>')}</div>
      </div>
      <div class="sig-card">
        <div class="info-label" style="color:${TEAL}">Communication</div>
        <div style="font-size: 11px; margin-top: 8px; line-height: 1.6;">${pbs.communicatesBest.filter(c => c).map(c => `&bull; ${c}`).join('<br/>')}</div>
      </div>
    </div>

    <h2>2. My Diagnoses</h2>
    <table><tr><th>Diagnosis</th><th>Details</th></tr>
      ${pbs.diagnosisRows.map(r => `<tr><td style="font-weight: 700; width: 35%; color: ${NAVY};">${r.diagnosis}</td><td>${r.presentation}</td></tr>`).join('')}
    </table>
    
    ${pbs.keyPrinciple ? `<div style="background: ${NAVY}; color: #fff; padding: 20px; border-radius: 6px; margin-top: 15px;"><div class="info-label" style="color: #94a3b8; margin-bottom: 8px;">Guiding Principle</div><div style="font-size: 13px; font-weight: 600;">${pbs.keyPrinciple}</div></div>` : ''}
  </div>`;

  html += `<div class="page">
    <h2>3. When Things Get Difficult</h2>
    <div style="border-left: 4px solid ${RED}; padding-left: 20px; margin-top: 20px;">
      ${[pbs.reactiveStep1, pbs.reactiveStep2, pbs.reactiveStep3, pbs.reactiveStep4, pbs.reactiveStep5, pbs.reactiveStep6, pbs.reactiveStep7].map((s, i) => s ? `
        <div style="margin-bottom: 20px;">
          <div style="color: ${RED}; font-weight: 900; font-size: 9px; margin-bottom: 4px; text-transform: uppercase;">Step ${i + 1}</div>
          <div style="font-size: 13px; font-weight: 600; color: ${NAVY};">${s}</div>
        </div>
      ` : '').join('')}
    </div>
    ${renderSigBlock(sigs)}
  </div></body></html>`;
  return html;
}

export function buildRiskHtml(client: FullClient, sigs?: Sig[], layout: ExportLayout = 'portrait'): string {
  const risk = client.risk;
  if (!risk) return 'No data';
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyles(layout)}</style></head><body>`;
  html += renderCover('Clinical Risk Assessment', client, risk.planDate);

  const risks = risk.risks && risk.risks.length ? risk.risks : [];

  if (!risks.length) {
    html += `<div class="page"><h2>Identified Risks</h2><p>No structured risks were detected from the imported source.</p>${renderSigBlock(sigs)}</div>`;
    html += `</body></html>`;
    return html;
  }

  // Global Principles Page
  html += `<div class="page">
    <h2>1. Risk Management Principles</h2>
    <div style="background: #fcfdfe; border: 1px solid #edf2f7; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
      <div class="info-label" style="color: ${TEAL}; margin-bottom: 10px;">Least Restrictive Practice Statement</div>
      <div style="font-size: 12px; line-height: 1.7; color: ${NAVY};">${risk.leastRestrictivePractice}</div>
    </div>
    
    <div style="background: #fff5f5; border: 1px solid #fed7d7; border-left: 5px solid ${RED}; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
      <div class="info-label" style="color: ${RED}; margin-bottom: 10px;">Emergency Escalation Procedure</div>
      <div style="font-size: 12px; line-height: 1.7; color: ${NAVY};">${risk.escalationProcedure}</div>
    </div>

    <h3>Review Cycle</h3>
    <p style="font-size: 12px;">${risk.reviewSchedule}</p>

    <h2>2. Multi-Agency Involvement</h2>
    <table><tr><th>Service</th><th>Role</th><th>Status</th></tr>
      ${risk.multiAgencyRows.map(r => `<tr><td style="font-weight:700;">${r.service}</td><td>${r.role}</td><td>${r.status}</td></tr>`).join('')}
    </table>
  </div>`;

  // Per-risk detailed pages
  risks.forEach((r, idx) => {
    const { score, color, label } = riskInfo(r.likelihood, r.impact);
    html += `<div class="page">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${NAVY}; padding-bottom: 10px; margin-bottom: 20px;">
        <h1 style="font-size: 24px;">Risk Area ${idx + 1}: ${r.title}</h1>
        <div class="badge" style="background: ${color};">${label} Risk (${score})</div>
      </div>

      <div class="grid-2">
        <div>
          <h3>Risk Description</h3>
          <p style="font-size: 12px;">${r.description}</p>
          
          <h3>Triggers & Context</h3>
          <div style="font-size: 11px;">${r.triggers.filter(t=>t).map(t => `&bull; ${t}`).join('<br/>') || 'No specific triggers identified.'}</div>
          
          <h3>Secondary Risks</h3>
          <p style="font-size: 11px; font-style: italic;">${r.secondaryRisk || 'None identified.'}</p>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; background: #fcfdfe; border: 1px solid #edf2f7; padding: 15px; border-radius: 12px;">
          <div class="info-label" style="margin-bottom: 10px;">Risk Stratification Matrix</div>
          ${riskMatrix(r.likelihood, r.impact)}
          <div style="font-size: 10px; font-weight: 700; color: ${color}; text-align: center;">Score: ${r.likelihood} (Likelihood) &times; ${r.impact} (Impact) = ${score}</div>
        </div>
      </div>

      <h2>Risk Control Protocol</h2>
      <div class="grid-2">
        <div class="sig-card" style="background: #f0fdfa; border-color: ${TEAL}30;">
          <div class="info-label" style="color: ${TEAL}">Primary Controls (Standard)</div>
          <div style="font-size: 11px; margin-top: 8px;">${r.controls.filter(c=>c).map(c => `&bull; ${c}`).join('<br/>') || 'Refer to standard support protocols.'}</div>
        </div>
        <div class="sig-card" style="background: #fffbeb; border-color: ${AMBER}30;">
          <div class="info-label" style="color: ${AMBER}">Dynamic Controls (Change-Responsive)</div>
          <div style="font-size: 11px; margin-top: 8px;">${r.dynamicControls.filter(c=>c).map(c => `&bull; ${c}`).join('<br/>') || 'None specified.'}</div>
        </div>
      </div>

      <div style="margin-top: 20px;" class="sig-card">
        <div class="info-label" style="color: ${RED}">Contingency Plan (If controls fail)</div>
        <div style="font-size: 12px; font-weight: 600; color: ${NAVY}; margin-top: 8px;">${r.contingencyPlan || 'Escalate immediately to senior on-call manager.'}</div>
      </div>

      <div class="grid-2" style="margin-top: 20px;">
        <div>
          <h3>Review Triggers</h3>
          <p style="font-size: 11px;">${r.reviewTrigger}</p>
        </div>
        <div>
          <h3>Affected People</h3>
          <p style="font-size: 11px;">${r.affectedPeople.join(', ')}</p>
        </div>
      </div>

      <div style="margin-top: auto; padding: 15px; border-top: 1px dashed #e2e8f0;">
        <div class="info-label">Regulatory Compliance Justification</div>
        <div style="font-size: 10px; font-style: italic;">${r.leastRestrictive || 'Support is delivered in the least restrictive manner possible to ensure safety while respecting autonomy.'}</div>
      </div>
    </div>`;
  });

  html += `<div class="page">${renderSigBlock(sigs)}</div>`;
  html += `</body></html>`;
  return html;
}

export function buildCarePlanHtml(client: FullClient, sigs?: Sig[], layout: ExportLayout = 'portrait'): string {
  const cp = client.carePlan;
  if (!cp) return 'No data';
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${baseStyles(layout)}</style></head><body>`;
  html += renderCover('My Support Plan', client, cp.planDate);

  html += `<div class="page">
    <h2>About Me</h2>
    <p style="font-size: 13px; font-style: italic; color: ${MUTED}; margin-bottom: 20px;">${cp.biography}</p>
    
    <div class="grid-2" style="margin: 30px 0;">
      <div style="background: #fff5f5; padding: 20px; border-radius: 6px; border-left: 4px solid ${RED};">
        <div class="info-label" style="color:${RED}; margin-bottom: 8px;">Important Information</div>
        <div style="font-size: 11px; line-height: 1.6;">${cp.criticalInfo}</div>
      </div>
      <div style="background: #fffaf0; padding: 20px; border-radius: 6px; border-left: 4px solid ${AMBER};">
        <div class="info-label" style="color:${AMBER}; margin-bottom: 8px;">In an Emergency</div>
        <div style="font-size: 11px; line-height: 1.6;">${cp.emergencyInfo}</div>
      </div>
    </div>

    <h3>Summary of Care Needs</h3>
    <table><tr><th>Area of Care</th><th>Level of Need</th><th>Risk Level</th></tr>
      ${cp.domains.filter(d => d.enabled).map(d => {
        const { label, color } = riskInfo(d.riskLikelihood, d.riskImpact);
        return `<tr>
          <td style="font-weight: 700; color: ${NAVY};">${d.title}</td>
          <td>${LEVEL_OF_NEED_LABELS[d.levelOfNeed]}</td>
          <td><span style="color: ${color}; font-weight: 900; font-size: 9px;">${label}</span></td>
        </tr>`;
      }).join('')}
    </table>
  </div>`;

  cp.domains.filter(d => d.enabled).forEach((d, i) => {
    html += `<div class="page">
      <div class="badge" style="margin-bottom: 8px;">Area ${i + 1}</div>
      <h1 style="border-bottom: 2px solid ${NAVY}; padding-bottom: 12px; margin-bottom: 25px;">${d.title}</h1>
      
      <div class="grid-2" style="margin-bottom: 30px;">
        <div><h3 style="margin-top:0;">What I Need Help With</h3><p style="font-size: 12px;">${d.identifiedNeed || '—'}</p></div>
        <div style="background: #fcfdfe; border: 1px solid #edf2f7; padding: 15px; border-radius: 6px;">
          <h3 style="margin-top:0;">What We're Working Towards</h3><p style="font-weight:700; font-size:11px; color:${TEAL};">${d.plannedOutcomes || '—'}</p>
        </div>
      </div>

      <h2>How Staff Should Help</h2>
      <p style="font-size: 13px; line-height: 1.7; color: ${NAVY};">${d.howToAchieve || '—'}</p>

      ${d.riskTitle ? `<div style="margin-top: 40px; padding: 25px; background: #fff; border: 1px solid #edf2f7; border-left: 5px solid ${AMBER};">
        <div class="info-label" style="margin-bottom: 12px;">Managing Risk: ${d.riskTitle}</div>
        <div style="max-width: 300px;">${riskWidget(d.riskLikelihood, d.riskImpact)}</div>
        <p style="margin-top: 12px; font-size: 11px; color: ${MUTED}; line-height: 1.6;">${d.riskMitigation}</p>
      </div>` : ''}

      <div class="doc-footer">
        <span>Next review: ${d.nextReviewDate}</span>
        <span>Reviewed by: ${d.reviewer}</span>
      </div>
    </div>`;
  });

  html += `<div class="page">${renderSigBlock(sigs)}</div>`;
  html += `</body></html>`;
  return html;
}

export function buildEasyReadHtml(client: FullClient, layout: ExportLayout = 'portrait'): string {
  const cp = client.carePlan;
  if (!cp) return 'No care plan data';

  const name = client.preferredName || client.name.split(' ')[0] || client.name;
  
  const domainIcons: Record<string, string> = {
    'Environment & Physical Safety': '🛡️',
    'Respiratory Health & Support': '🫁',
    'Communication & Sensory Integration': '💬',
    'Social Engagement & Relationships': '🤝',
    'Life Skills & Daily Routine': '📋',
    'Nutrition, Hydration & Diet': '🍽️',
    'Continence & Personal Hygiene': '🚻',
    'Adaptive Living Environment': '🌿',
    'Rights, Choice & Inclusion': '⚖️',
    'Intimacy & Personal Expression': '❤️',
    'Financial Management & Autonomy': '💷',
    'Holistic Health & Vitality': '🩺',
    'Infection Control & Public Health': '🧴',
    'Medication Management & Safety': '💊',
    'Mental Health & Emotional Wellbeing': '🧠',
    'Mobility, Movement & Exercise': '🏃',
    'Pain Management & Comfort': '⚡',
    'Personal Care & Physical Presentation': '🪥',
    'Skin Integrity & Pressure Care': '🩹',
    'Rest & Sleep Patterns': '😴',
    'Cultural, Spiritual & Personal Beliefs': '🕊️',
  };

  const size = pageSize(layout);
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    @page { size: A4 ${layout}; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
    body { font-family: 'Inter', sans-serif; color: #1a1a2e; line-height: 1.6; margin: 0; padding: 0; font-size: 18px; background: #f8fafc; }
    .page { width: ${size.width}; min-height: ${size.minHeight}; padding: 25mm; margin: 0 auto; background: #fff; display: flex; flex-direction: column; position: relative; }
    .page:not(:first-child) { page-break-before: always; }
    @media print { body { background: #fff; } .page { margin: 0; padding: 15mm; width: ${size.width}; min-height: ${size.minHeight}; border: none; box-shadow: none; height: auto; overflow: visible; } }
    
    .logo-box { display: flex; align-items: center; gap: 20px; margin-bottom: 40px; border-bottom: 4px solid #0f766e; padding-bottom: 20px; }
    .logo-img { height: 60px; width: 60px; border-radius: 12px; object-fit: contain; }
    .brand-text { font-weight: 900; font-size: 20px; color: #0c1829; letter-spacing: -0.02em; }
    
    h1 { font-size: 48px; font-weight: 800; color: #0f766e; margin: 40px 0 10px; letter-spacing: -0.04em; line-height: 1; }
    h2 { font-size: 28px; font-weight: 800; color: #0f766e; margin: 0 0 20px; border-bottom: 3px solid #f1f5f9; padding-bottom: 10px; }
    
    .intro-card { background: #f0fdfa; border: 3px solid #0f766e; border-radius: 24px; padding: 30px; margin-bottom: 30px; font-size: 22px; font-weight: 600; color: #0f766e; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .info-pill { background: #fff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center; }
    .info-label { font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
    
    .domain-header { display: flex; align-items: center; gap: 20px; margin-bottom: 25px; }
    .domain-icon { font-size: 50px; background: #f0fdfa; width: 90px; height: 90px; display: flex; align-items: center; justify-content: center; border-radius: 24px; border: 3px solid #0f766e; }
    .domain-title { font-size: 32px; font-weight: 900; color: #0c1829; line-height: 1.1; }
    
    .grid-box { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .content-card { background: #fff; border: 2px solid #e2e8f0; border-radius: 20px; padding: 20px; height: 100%; }
    .card-label { font-size: 14px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .card-text { font-size: 18px; font-weight: 500; color: #1e293b; line-height: 1.5; }
    
    .footer { margin-top: auto; padding-top: 20px; border-top: 2px solid #f1f5f9; text-align: center; font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
  </style></head><body>`;

  // Cover Page
  html += `<div class="page">
    <div class="logo-box">
      <img src="${ORG_CONFIG.logoIcon}" class="logo-img" onerror="this.style.display='none'"/>
      <div class="brand-text">${ORG_CONFIG.name.toUpperCase()} OPERATIONS</div>
    </div>
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
      <div style="font-size: 120px; margin-bottom: 20px;">👋</div>
      <h1>Hello ${name}</h1>
      <p style="font-size: 24px; color: #64748b; font-weight: 600; margin-bottom: 60px;">This is your Support Plan.</p>
      
      <div class="intro-card">It helps staff know how to support you best.</div>
      
      <div class="info-grid" style="width: 100%; max-width: 500px;">
        <div class="info-pill"><div class="info-label">Today's Date</div><div style="font-weight: 800;">${new Date().toLocaleDateString('en-GB')}</div></div>
        <div class="info-pill"><div class="info-label">Plan Version</div><div style="font-weight: 800;">${cp.planDate}</div></div>
      </div>
    </div>
    <div class="footer">${ORG_CONFIG.fullName}</div>
  </div>`;

  // About Me Page
  html += `<div class="page">
    <h2>About Me</h2>
    <div class="content-card" style="margin-bottom: 30px; border-color: #0f766e; border-width: 3px;">
      <div class="card-label">My Story</div>
      <div class="card-text" style="font-size: 20px;">${cp.biography || 'Information about me will be here.'}</div>
    </div>
    
    <div class="grid-box">
      <div class="content-card">
        <div class="card-label">My Full Name</div>
        <div class="card-text">${client.name}</div>
      </div>
      <div class="content-card">
        <div class="card-label">Call Me</div>
        <div class="card-text">${name}</div>
      </div>
    </div>

    ${cp.criticalInfo ? `
    <div class="content-card" style="background: #fef2f2; border-color: #ef4444; margin-top: 20px;">
      <div class="card-label" style="color: #ef4444;">⚠️ Important for staff to know</div>
      <div class="card-text" style="font-weight: 700; color: #b91c1c;">${cp.criticalInfo}</div>
    </div>` : ''}
    <div class="footer">${ORG_CONFIG.fullName}</div>
  </div>`;

  // Domain Pages
  cp.domains.filter(d => d.enabled).forEach(d => {
    html += `<div class="page">
      <div class="domain-header">
        <div class="domain-icon">${domainIcons[d.title] || '📄'}</div>
        <div class="domain-title">${d.title}</div>
      </div>
      
      <div class="grid-box">
        <div class="content-card" style="border-left: 8px solid #0f766e;">
          <div class="card-label">🟢 What I can do</div>
          <div class="card-text">I can do some things on my own and staff help me with the rest.</div>
        </div>
        <div class="content-card" style="border-left: 8px solid #f59e0b;">
          <div class="card-label">🟡 What I need help with</div>
          <div class="card-text">${d.identifiedNeed || '—'}</div>
        </div>
      </div>

      <div class="content-card" style="border-top: 8px solid #0f766e; margin-bottom: 30px;">
        <div class="card-label">🤝 How staff can help me</div>
        <div class="card-text" style="font-size: 20px; font-weight: 600;">${d.howToAchieve || 'Staff will support me as needed.'}</div>
      </div>

      ${d.riskTitle ? `
      <div class="content-card" style="background: #fffbeb; border-color: #f59e0b;">
        <div class="card-label" style="color: #b45309;">⚠️ Risks to watch for</div>
        <div class="card-text" style="font-weight: 700;">${d.riskTitle}</div>
      </div>` : ''}
      
      <div class="footer">${ORG_CONFIG.fullName}</div>
    </div>`;
  });

  html += `</body></html>`;
  return html;
}
