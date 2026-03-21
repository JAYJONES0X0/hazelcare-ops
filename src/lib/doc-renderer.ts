// ============================================================
// DOC RENDERER — Refined for Person-Centered Precision
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
  if (score <= 3) { color = GREEN; label = 'Low'; }
  else if (score <= 6) { color = '#84cc16'; label = 'Moderate'; }
  else if (score <= 12) { color = AMBER; label = 'Significant'; }
  else if (score <= 16) { color = RED; label = 'High'; }
  else { color = '#7f1d1d'; label = 'Critical'; }
  return { score, color, label };
}

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  
  @page { margin: 0; }

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
    width: 210mm;
    min-height: 297mm;
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
      width: 210mm !important; 
      height: 297mm !important;
      border: none !important; 
      box-shadow: none !important;
      page-break-after: always !important;
      overflow: hidden;
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
`;

function renderCover(title: string, client: FullClient, planDate: string) {
  return `<div class="page"><div class="cover">
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="/logo-icon-dark.png" style="height: 48px; border-radius: 8px;" onerror="this.style.display='none'"/>
          <div style="font-weight: 800; font-size: 14px; color: ${NAVY};">HAZEL CARE LTD</div>
        </div>
        <div class="badge">Confidential</div>
      </div>
      <div style="margin-top: 80px;">
        <div class="accent-bar"></div>
        <h1>${title}</h1>
        <p style="font-size: 16px; color: ${MUTED}; font-weight: 500; margin-top: 8px;">Prepared for ${client.name}</p>
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
      <p style="margin: 0; font-size: 9px; line-height: 1.4; color: ${NAVY};">This document is confidential and intended for authorised Hazel Care personnel only. It contains personal and sensitive information protected under the Data Protection Act 2018 and UK GDPR.</p>
    </div>
  </div></div>`;
}

function renderSigBlock(sigs?: Sig[]) {
  const rows = sigs && sigs.length ? sigs : [
    { role: 'Completed By', name: 'Brooklyn Ruvinga', date: '', data: '' },
    { role: 'Responsible Manager', name: '', date: '', data: '' },
    { role: 'Key Worker', name: '', date: '', data: '' }
  ];
  
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

// ─── Document Generators ─────────────────────────────────────────────────────

export function buildPBSHtml(client: FullClient, sigs?: Sig[]): string {
  const pbs = client.pbs;
  if (!pbs) return 'No data';
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>`;
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

export function buildRiskHtml(client: FullClient, sigs?: Sig[]): string {
  const risk = client.risk;
  if (!risk) return 'No data';
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>`;
  html += renderCover('Risk Assessment', client, risk.planDate);

  html += `<div class="page">
    <h2>Identified Risks</h2>
    ${risk.risks.map((r, i) => `
      <div style="margin-bottom: 30px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="opacity: 0.5; margin-bottom: 4px; font-size: 8px; color: ${MUTED}; font-weight: 700; text-transform: uppercase;">Risk Area ${i + 1}</div>
            <h3 style="margin: 0; font-size: 16px; color: ${NAVY}; text-transform: none; letter-spacing: 0;">${r.title}</h3>
          </div>
          <div style="width: 180px;">${riskWidget(r.likelihood, r.impact)}</div>
        </div>
        <p style="margin-top: 10px; font-size: 12px;">${r.description}</p>
        <div class="grid-2" style="margin-top: 15px;">
          <div class="sig-card" style="padding: 12px; background: #fff;"><div class="info-label">How We Manage This</div><div style="font-size: 10px; margin-top: 6px;">${r.controls.filter(c => c).map(c => `&bull; ${c}`).join('<br/>')}</div></div>
          <div class="sig-card" style="padding: 12px; background: #fff;"><div class="info-label">Early Warning Signs</div><div style="font-size: 10px; margin-top: 6px;">${r.earlyWarnings.filter(w => w).map(w => `&bull; ${w}`).join('<br/>')}</div></div>
        </div>
      </div>
    `).join('')}
    ${renderSigBlock(sigs)}
  </div></body></html>`;
  return html;
}

export function buildCarePlanHtml(client: FullClient): string {
  const cp = client.carePlan;
  if (!cp) return 'No data';
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>`;
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

  html += `</body></html>`;
  return html;
}

export function buildEasyReadHtml(client: FullClient): string {
  const cp = client.carePlan;
  if (!cp) return 'No care plan data';

  const name = client.preferredName || client.name.split(' ')[0] || client.name;
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    @page { margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
    body { font-family: 'Inter', sans-serif; color: #1a1a2e; line-height: 1.6; margin: 0; padding: 0; font-size: 16px; }
    .page { width: 210mm; min-height: 297mm; padding: 18mm; margin: 0 auto; background: #fff; display: flex; flex-direction: column; }
    .page:not(:first-child) { page-break-before: always; }
    @media print { body { padding: 10mm; } .page { margin: 0; padding: 0; width: 100%; min-height: 297mm; } }
    h1 { font-size: 32px; font-weight: 800; color: #0f766e; margin: 0 0 10px; }
    h2 { font-size: 24px; font-weight: 800; color: #0f766e; margin: 30px 0 15px; border-bottom: 3px solid #0f766e; }
    .card { background: #f0fdfa; border: 2px solid #0f766e; border-radius: 12px; padding: 20px; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; border: 2px solid #e2e8f0; margin: 20px 0; }
    th { background: #0f766e; color: #fff; padding: 12px; font-size: 14px; text-align: left; }
    td { padding: 15px; border: 1px solid #e2e8f0; font-size: 16px; vertical-align: top; }
  </style></head><body>`;

  // Cover
  html += `<div class="page" style="justify-content: center; text-align: center;">
    <img src="/logo-icon-dark.png" style="height: 80px; margin-bottom: 30px;" onerror="this.style.display='none'"/>
    <h1 style="font-size: 42px;">My Support Plan</h1>
    <p style="font-size: 24px; color: #64748b; font-weight: 600;">This plan is for ${client.name}</p>
    <div style="margin-top: 40px; font-size: 18px; color: #94a3b8;">Date: ${cp.planDate}</div>
  </div>`;

  // About Me
  html += `<div class="page">
    <h2>About Me</h2>
    <div class="card"><p>${cp.biography || 'Information about me will be here.'}</p></div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
      <div class="card"><strong>My Name:</strong><br/>${client.name}</div>
      <div class="card"><strong>I like to be called:</strong><br/>${name}</div>
    </div>
    ${cp.criticalInfo ? `<div class="card" style="background:#fef2f2; border-color:#ef4444;"><strong>Important for staff to know:</strong><br/>${cp.criticalInfo}</div>` : ''}
  </div>`;

  // Domains
  cp.domains.filter(d => d.enabled).forEach(d => {
    html += `<div class="page">
      <h1 style="border-bottom: 4px solid #0f766e; padding-bottom: 10px;">${d.title}</h1>
      <table>
        <tr>
          <th style="width: 25%;">What I need help with</th>
          <th style="width: 25%;">What I can do myself</th>
          <th style="width: 25%;">Risks to watch for</th>
          <th style="width: 25%;">How staff can help me</th>
        </tr>
        <tr>
          <td>${d.identifiedNeed || '—'}</td>
          <td>I can do some things on my own and staff help me with the rest.</td>
          <td>${d.riskTitle || 'No big risks here.'}</td>
          <td>${d.howToAchieve || 'Staff will support me as needed.'}</td>
        </tr>
      </table>
      <div style="margin-top: auto; font-size: 12px; color: #94a3b8;">This is my Easy Read plan.</div>
    </div>`;
  });

  html += `</body></html>`;
  return html;
}
