// ============================================================
// DOC RENDERER — builds print-ready HTML for PBS + Risk + Care Plan docs
// ============================================================
import type { FullClient, RiskItem } from './client-store';
import { LEVEL_OF_NEED_LABELS } from './client-store';
import type { Sig } from '../components/SignaturePad';

const TEAL = '#0f766e';

export function riskInfo(likelihood: number, impact: number) {
  const score = likelihood * impact;
  let color: string;
  let label: string;
  if (score <= 3) { color = '#16a34a'; label = 'Low'; }
  else if (score <= 6) { color = '#65a30d'; label = 'Low–Medium'; }
  else if (score <= 12) { color = '#d97706'; label = 'Medium–High'; }
  else if (score <= 16) { color = '#dc2626'; label = 'High'; }
  else { color = '#7f1d1d'; label = 'Critical'; }
  return { score, color, label };
}

const likelihoodLabels = ['', 'Rare (1)', 'Unlikely (2)', 'Possible (3)', 'Likely (4)', 'Almost Certain (5)'];
const impactLabels = ['', 'Negligible (1)', 'Tolerable (2)', 'Undesirable (3)', 'Severe (4)', 'Catastrophic (5)'];

function bullets(items: string[]): string {
  const f = items.filter(Boolean);
  if (!f.length) return '<p style="color:#94a3b8;font-style:italic;font-size:12px;">None recorded.</p>';
  return `<ul style="margin:4px 0;padding-left:18px;">${f.map(i => `<li style="margin-bottom:3px;">${i}</li>`).join('')}</ul>`;
}

function pb(): string {
  return '<div style="page-break-after:always;height:1px;"></div>';
}

function sh(title: string, num?: string | number): string {
  return `<h2 style="font-size:15px;font-weight:700;color:${TEAL};border-bottom:2px solid ${TEAL};padding-bottom:6px;margin:24px 0 12px;">${num != null ? `${num}. ` : ''}${title}</h2>`;
}

function metaTable(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${
    rows.map(([k, v]) => `<tr>
      <td style="padding:5px 10px;background:#f1f5f9;font-weight:600;width:180px;font-size:12px;border:1px solid #e2e8f0;">${k}</td>
      <td style="padding:5px 10px;border:1px solid #e2e8f0;font-size:12px;">${v || '—'}</td>
    </tr>`).join('')
  }</table>`;
}

function docHeader(docTitle: string, meta: [string, string][]): string {
  return `
  <div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid ${TEAL};padding-bottom:16px;margin-bottom:20px;">
    <img src="/hazelcare-logo.png" style="height:52px;" onerror="this.style.display='none'" />
    <div style="flex:1;">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:${TEAL};">${docTitle}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Hazel Care Ltd — Supported Living</p>
    </div>
  </div>
  ${metaTable(meta)}`;
}

function sigBlock(sigs?: Sig[]): string {
  const defaultRows = [
    { role: 'Completed By', name: '', date: '', data: '' },
    { role: 'Responsible Person', name: '', date: '', data: '' },
    { role: 'Senior / Key Worker', name: '', date: '', data: '' },
    { role: 'Service Manager', name: '', date: '', data: '' },
  ];
  const rows = sigs && sigs.length ? sigs : defaultRows;
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:32px;">
    <tr style="background:#f1f5f9;">
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;width:160px;">Role</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;width:160px;">Name</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Signature</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;width:100px;">Date</th>
    </tr>
    ${rows.map(r => `<tr>
      <td style="padding:8px;border:1px solid #e2e8f0;">${r.role}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${r.name || ''}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;height:56px;">
        ${r.data ? `<img src="${r.data}" style="max-height:48px;max-width:220px;display:block;" />` : ''}
      </td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${r.date || ''}</td>
    </tr>`).join('')}
  </table>`;
}

const BASE_STYLES = `
  body { font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 900px; margin: 0 auto; color: #1e293b; font-size: 13px; line-height: 1.5; padding: 20px; }
  @media print { body { padding: 0; } }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  td, th { padding: 6px 10px; border: 1px solid #e2e8f0; }
  th { background: #f1f5f9; font-weight: 600; text-align: left; }
  ul, ol { margin: 4px 0; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  .key-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 4px; margin: 12px 0; }
  .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin: 12px 0; }
  .step-row { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
  .step-num { background: ${TEAL}; color: white; font-weight: 700; border-radius: 50%; min-width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
`;

// ─── PBS HTML BUILDER ─────────────────────────────────────────────────────────
export function buildPBSHtml(client: FullClient, sigs?: Sig[]): string {
  const pbs = client.pbs;
  if (!pbs) return '<p>No PBS data.</p>';
  const name = client.preferredName || client.name.split(' ')[0];

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>`;

  html += docHeader('POSITIVE BEHAVIOUR SUPPORT (PBS) PLAN', [
    ['Service User', client.name],
    ['Preferred Name', client.preferredName || name],
    ['Date of Birth', client.dob],
    ['NHS Number', client.nhs],
    ['Address', client.address],
    ['Diagnoses', client.diagnoses.join(', ')],
    ['Key Worker', client.keyWorker],
    ['Responsible Person', client.responsible],
    ['Completed By', client.completedBy],
    ['Date of Plan', pbs.planDate],
    ['Review Date', client.reviewDate],
  ]);

  // 1 — About
  html += sh('About the Person', 1);
  html += `<p>${pbs.aboutText || '—'}</p>`;
  if (pbs.whatMatters.filter(Boolean).length) {
    html += `<p style="font-weight:600;margin-bottom:4px;">What matters most to ${name}:</p>${bullets(pbs.whatMatters)}`;
  }
  if (pbs.communicatesBest.filter(Boolean).length) {
    html += `<p style="font-weight:600;margin-top:12px;margin-bottom:4px;">${name} communicates best when:</p>${bullets(pbs.communicatesBest)}`;
  }
  if (pbs.findsDifficult.filter(Boolean).length) {
    html += `<p style="font-weight:600;margin-top:12px;margin-bottom:4px;">${name} finds it difficult to:</p>${bullets(pbs.findsDifficult)}`;
  }

  html += pb();

  // 2 — Diagnoses
  html += sh('Diagnoses and How They Present', 2);
  const diagRows = pbs.diagnosisRows.filter(r => r.diagnosis);
  if (diagRows.length) {
    html += `<table><tr><th style="width:170px;">Diagnosis</th><th>How It Presents</th></tr>`;
    for (const r of diagRows) html += `<tr><td style="font-weight:600;">${r.diagnosis}</td><td>${r.presentation}</td></tr>`;
    html += `</table>`;
  }
  if (pbs.keyPrinciple) html += `<div class="key-box"><strong>Key Principle:</strong> ${pbs.keyPrinciple}</div>`;

  // 3 — Function of Behaviour
  html += sh('Function of Behaviour', 3);
  html += `<p style="color:#64748b;font-size:12px;margin-bottom:8px;">Understanding <em>why</em> behaviours occur allows staff to respond to the underlying need rather than the behaviour itself.</p>`;
  const funcRows = pbs.functionRows.filter(r => r.behaviour);
  if (funcRows.length) {
    html += `<table><tr><th style="width:240px;">Behaviour</th><th>Function / Unmet Need</th></tr>`;
    for (const r of funcRows) html += `<tr><td>${r.behaviour}</td><td>${r.func}</td></tr>`;
    html += `</table>`;
  }

  html += pb();

  // 4 — Proactive Strategies
  html += sh('Proactive Strategies', 4);
  const stratPairs: [string, string[]][] = [
    ['Environmental Strategies', pbs.envStrategies],
    ['Routine & Structure Strategies', pbs.routineStrategies],
    ['Relationship Strategies', pbs.relationshipStrategies],
    ['Communication Strategies', pbs.communicationStrategies],
  ];
  if (pbs.onlineSafetyStrategies?.filter(Boolean).length) {
    stratPairs.push(['Online Safety Strategies', pbs.onlineSafetyStrategies]);
  }
  for (const [title, items] of stratPairs) {
    if (items.filter(Boolean).length) {
      html += `<p style="font-weight:600;margin-bottom:4px;">${title}:</p>${bullets(items)}<br/>`;
    }
  }

  // 5 — Early Warning Signs
  html += sh('Early Warning Signs and Staff Response', 5);
  const warnRows = pbs.warningSignRows.filter(r => r.sign);
  if (warnRows.length) {
    html += `<table><tr><th style="width:40%;">Early Warning Sign</th><th>Recommended Staff Response</th></tr>`;
    for (const r of warnRows) html += `<tr><td>${r.sign}</td><td>${r.staffAction}</td></tr>`;
    html += `</table>`;
  }

  html += pb();

  // 6 — Reactive Strategies
  html += sh('Reactive Strategies (De-escalation Steps)', 6);
  const steps = [pbs.reactiveStep1, pbs.reactiveStep2, pbs.reactiveStep3, pbs.reactiveStep4, pbs.reactiveStep5, pbs.reactiveStep6, pbs.reactiveStep7];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i]) html += `<div class="step-row"><div class="step-num">${i + 1}</div><div>${steps[i]}</div></div>`;
  }
  if (pbs.walksNote) html += `<div class="info-box" style="margin-top:12px;">${pbs.walksNote}</div>`;

  // 7 — Post-Incident
  html += sh('Post-Incident Support and Recovery', 7);
  if (pbs.postImmediate.filter(Boolean).length) {
    html += `<p style="font-weight:600;margin-bottom:4px;">Immediate Post-Incident:</p>${bullets(pbs.postImmediate)}`;
  }
  if (pbs.postDebrief.filter(Boolean).length) {
    html += `<p style="font-weight:600;margin-top:12px;margin-bottom:4px;">Debrief (When Calm):</p>${bullets(pbs.postDebrief)}`;
  }
  if (pbs.staffResponsibilities.filter(Boolean).length) {
    html += `<p style="font-weight:600;margin-top:12px;margin-bottom:4px;">Staff Responsibilities:</p>${bullets(pbs.staffResponsibilities)}`;
  }

  html += pb();

  // 8 — What Works
  html += sh('What Works Well / What Does Not Work', 8);
  const works = pbs.whatWorks.filter(Boolean);
  const doesnt = pbs.doesntWork.filter(Boolean);
  html += `<table><tr>
    <th style="width:50%;background:#f0fdf4;color:#16a34a;">✓ What Works Well</th>
    <th style="background:#fef2f2;color:#dc2626;">✗ What Does Not Work</th>
  </tr>`;
  for (let i = 0; i < Math.max(works.length, doesnt.length); i++) {
    html += `<tr><td>${works[i] || ''}</td><td>${doesnt[i] || ''}</td></tr>`;
  }
  html += `</table>`;

  // 9 — Medication
  html += sh('Medication', 9);
  const medRows = pbs.medicationRows.filter(r => r.name);
  if (medRows.length) {
    html += `<table><tr><th>Medication</th><th>Dose</th><th>When</th><th>Purpose</th><th>Notes</th></tr>`;
    for (const r of medRows) html += `<tr><td>${r.name}</td><td>${r.dose}</td><td>${r.when}</td><td>${r.purpose}</td><td>${r.notes || '—'}</td></tr>`;
    html += `</table>`;
  }
  if (pbs.medicationNote) html += `<p>${pbs.medicationNote}</p>`;

  html += pb();

  // 10 — Multi-Agency
  html += sh('Multi-Agency Involvement', 10);
  const agencyRows = pbs.agencyRows.filter(r => r.service);
  if (agencyRows.length) {
    html += `<table><tr><th>Service / Agency</th><th>Role</th><th>Status</th></tr>`;
    for (const r of agencyRows) html += `<tr><td>${r.service}</td><td>${r.role}</td><td>${r.status}</td></tr>`;
    html += `</table>`;
  }

  // 11 — Review
  html += sh('Review and Service User Involvement', 11);
  html += `<p>${pbs.reviewSchedule}</p>`;
  if (pbs.serviceUserInvolvement) {
    html += `<p><strong>Service User Involvement:</strong> ${pbs.serviceUserInvolvement}</p>`;
  }

  html += sh('Signatures');
  html += sigBlock(sigs);
  html += `<div class="footer">Hazel Care Ltd | Nourish Care Systems | Confidential — Not for distribution outside of the care team</div>`;
  html += `</body></html>`;
  return html;
}

// ─── RISK HTML BUILDER ────────────────────────────────────────────────────────
export function buildRiskHtml(client: FullClient, sigs?: Sig[]): string {
  const risk = client.risk;
  if (!risk) return '<p>No risk data.</p>';

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>`;

  html += docHeader('RISK ASSESSMENT', [
    ['Service User', client.name],
    ['Date of Birth', client.dob],
    ['NHS Number', client.nhs],
    ['Address', client.address],
    ['Completed By', client.completedBy],
    ['Responsible Person', client.responsible],
    ['Reviewed By', client.keyWorker],
    ['Date of Assessment', risk.planDate],
    ['Review Date', client.reviewDate],
  ]);

  // Matrix
  html += sh('Risk Rating Matrix');
  html += `<table>
    <tr><th>Likelihood Score</th><th>Descriptor</th><th>Impact Score</th><th>Descriptor</th><th>Risk Score Range</th><th>Rating</th></tr>
    <tr><td>1</td><td>Rare</td><td>1</td><td>Negligible</td><td>1–3</td><td style="color:#16a34a;font-weight:600;">Low</td></tr>
    <tr><td>2</td><td>Unlikely</td><td>2</td><td>Tolerable</td><td>4–6</td><td style="color:#65a30d;font-weight:600;">Low–Medium</td></tr>
    <tr><td>3</td><td>Possible</td><td>3</td><td>Undesirable</td><td>7–12</td><td style="color:#d97706;font-weight:600;">Medium–High</td></tr>
    <tr><td>4</td><td>Likely</td><td>4</td><td>Severe</td><td>13–16</td><td style="color:#dc2626;font-weight:600;">High</td></tr>
    <tr><td>5</td><td>Almost Certain</td><td>5</td><td>Catastrophic</td><td>17–25</td><td style="color:#7f1d1d;font-weight:600;">Critical</td></tr>
  </table>
  <p style="font-size:12px;color:#64748b;"><strong>Risk Score = Likelihood × Impact</strong></p>`;

  // Individual risks
  const validRisks = risk.risks.filter((r: RiskItem) => r.title);
  for (let i = 0; i < validRisks.length; i++) {
    const r = validRisks[i];
    const { score, color, label } = riskInfo(r.likelihood, r.impact);
    html += pb();
    html += `<div style="border:1px solid ${color};border-left:4px solid ${color};padding:16px;border-radius:4px;margin-bottom:20px;">`;
    html += `<h2 style="font-size:15px;font-weight:700;color:${color};margin:0 0 12px;">RISK ${i + 1} — ${r.title.toUpperCase()}</h2>`;
    html += `<p>${r.description || '—'}</p>`;
    if (r.behaviours?.filter(Boolean).length) {
      html += `<p style="font-weight:600;margin-bottom:4px;">Recorded Behaviours Include:</p>${bullets(r.behaviours)}`;
    }
    if (r.affectedPeople?.filter(Boolean).length) {
      html += `<p style="font-weight:600;margin-top:8px;margin-bottom:4px;">People Who May Be Affected:</p>${bullets(r.affectedPeople)}`;
    }
    if (r.triggers.filter(Boolean).length) {
      html += `<p style="font-weight:600;margin-top:8px;margin-bottom:4px;">Triggers / Contributing Factors:</p>${bullets(r.triggers)}`;
    }
    if (r.earlyWarnings.filter(Boolean).length) {
      html += `<p style="font-weight:600;margin-top:8px;margin-bottom:4px;">Early Warning Signs:</p>${bullets(r.earlyWarnings)}`;
    }
    if (r.controls.filter(Boolean).length) {
      html += `<p style="font-weight:600;margin-top:8px;margin-bottom:4px;">Control Measures:</p>${bullets(r.controls)}`;
    }
    html += `<table style="margin-top:12px;width:auto;">
      <tr><th>Likelihood</th><th>Impact</th><th>Risk Score</th><th>Rating</th></tr>
      <tr>
        <td>${likelihoodLabels[r.likelihood]}</td>
        <td>${impactLabels[r.impact]}</td>
        <td style="font-weight:700;color:${color};">${score}</td>
        <td style="font-weight:700;color:${color};">${label}</td>
      </tr>
    </table>`;
    if (r.reviewTrigger) html += `<p style="font-size:12px;color:#64748b;"><strong>Review Trigger:</strong> ${r.reviewTrigger}</p>`;
    html += `</div>`;
  }

  // Summary table
  if (validRisks.length > 1) {
    html += pb();
    html += sh('Risk Summary Table');
    html += `<table><tr><th>Risk</th><th>Likelihood</th><th>Impact</th><th>Score</th><th>Rating</th></tr>`;
    for (let i = 0; i < validRisks.length; i++) {
      const r = validRisks[i];
      const { score, color, label } = riskInfo(r.likelihood, r.impact);
      html += `<tr>
        <td>${i + 1}. ${r.title}</td>
        <td>${r.likelihood}</td><td>${r.impact}</td>
        <td style="font-weight:700;color:${color};">${score}</td>
        <td style="font-weight:700;color:${color};">${label}</td>
      </tr>`;
    }
    html += `</table>`;
  }

  // Multi-agency
  const maRows = risk.multiAgencyRows.filter((r: { service: string }) => r.service);
  if (maRows.length) {
    html += sh('Multi-Agency Involvement');
    html += `<table><tr><th>Service</th><th>Role</th><th>Status</th></tr>`;
    for (const r of maRows) html += `<tr><td>${r.service}</td><td>${r.role}</td><td>${r.status}</td></tr>`;
    html += `</table>`;
  }

  html += sh('Least Restrictive Practice Statement');
  html += `<p>${risk.leastRestrictivePractice}</p>`;

  html += sh('Review Schedule');
  html += `<p>${risk.reviewSchedule}</p>`;

  html += sh('Signatures');
  html += sigBlock(sigs);
  html += `<div class="footer">Hazel Care Ltd | Nourish Care Systems | Confidential — Not for distribution outside of the care team</div>`;
  html += `</body></html>`;
  return html;
}

// ─── CARE PLAN HTML ───────────────────────────────────────────────────────────
export function buildCarePlanHtml(client: FullClient): string {
  const cp = client.carePlan;
  if (!cp) return '<html><body><p>No care plan data.</p></body></html>';

  const enabledDomains = cp.domains.filter(d => d.enabled);
  const levelColors = ['#16a34a', '#65a30d', '#d97706', '#ea580c', '#dc2626'];

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e293b;line-height:1.5;margin:0;padding:20px 30px;}
    h1{font-size:20px;color:${TEAL};margin:0 0 4px;}
    h2{font-size:15px;font-weight:700;color:${TEAL};border-bottom:2px solid ${TEAL};padding-bottom:6px;margin:24px 0 12px;}
    h3{font-size:13px;font-weight:700;color:#334155;margin:12px 0 6px;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    td,th{padding:5px 10px;border:1px solid #e2e8f0;font-size:12px;vertical-align:top;}
    th{background:#f1f5f9;font-weight:600;text-align:left;}
    .level{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;color:white;}
    .risk-badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;color:white;}
    .domain-card{margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;}
    .domain-header{background:#f1f5f9;padding:10px 14px;border-bottom:1px solid #e2e8f0;}
    .domain-body{padding:12px 14px;}
    .footer{margin-top:40px;padding-top:12px;border-top:2px solid ${TEAL};font-size:10px;color:#94a3b8;text-align:center;}
    @media print{.domain-card{break-inside:avoid;}}
  </style></head><body>`;

  html += docHeader('Care Plan', [
    ['Client Name', client.name],
    ['Preferred Name', client.preferredName],
    ['Date of Birth', client.dob],
    ['NHS Number', client.nhs],
    ['Address', client.address],
    ['Key Worker', client.keyWorker],
    ['Date of Admission', client.dateOfAdmission],
    ['Plan Date', cp.planDate],
  ]);

  if (cp.biography) {
    html += sh('Biography');
    html += `<p>${cp.biography}</p>`;
  }
  if (cp.criticalInfo) {
    html += sh('Critical Information');
    html += `<p style="white-space:pre-wrap;">${cp.criticalInfo}</p>`;
  }
  if (cp.emergencyInfo) {
    html += sh('Emergency Information');
    html += `<p style="white-space:pre-wrap;">${cp.emergencyInfo}</p>`;
  }

  // Summary table
  html += sh('Care Plan Domains Summary');
  html += `<table><tr><th>Domain</th><th>Level of Need</th><th>Risk Score</th><th>Next Review</th></tr>`;
  for (const d of enabledDomains) {
    const { score, color, label } = riskInfo(d.riskLikelihood, d.riskImpact);
    html += `<tr>
      <td style="font-weight:600;">${d.title}</td>
      <td><span class="level" style="background:${levelColors[d.levelOfNeed]}">${d.levelOfNeed} — ${LEVEL_OF_NEED_LABELS[d.levelOfNeed]}</span></td>
      <td>${d.riskTitle ? `<span class="risk-badge" style="background:${color}">${score} — ${label}</span>` : '—'}</td>
      <td>${d.nextReviewDate || '—'}</td>
    </tr>`;
  }
  html += `</table>`;

  for (let i = 0; i < enabledDomains.length; i++) {
    const d = enabledDomains[i];
    const { score, color, label } = riskInfo(d.riskLikelihood, d.riskImpact);
    if (i > 0 && i % 3 === 0) html += pb();

    html += `<div class="domain-card">`;
    html += `<div class="domain-header"><h3 style="margin:0;color:${TEAL};">${i + 1}. ${d.title}</h3>
      <span class="level" style="background:${levelColors[d.levelOfNeed]};margin-top:4px;">${LEVEL_OF_NEED_LABELS[d.levelOfNeed]}</span></div>`;
    html += `<div class="domain-body">`;

    if (d.identifiedNeed) html += `<h3>Identified Need</h3><p style="white-space:pre-wrap;">${d.identifiedNeed}</p>`;
    if (d.plannedOutcomes) html += `<h3>Planned Outcomes</h3><p style="white-space:pre-wrap;">${d.plannedOutcomes}</p>`;
    if (d.howToAchieve) html += `<h3>How to Achieve Outcomes</h3><p style="white-space:pre-wrap;">${d.howToAchieve}</p>`;
    if (d.riskTitle) {
      html += `<h3>Risk</h3><p><strong>${d.riskTitle}</strong></p>`;
      html += `<p>Likelihood: ${d.riskLikelihood} × Impact: ${d.riskImpact} = <span class="risk-badge" style="background:${color}">${score} — ${label}</span></p>`;
      if (d.riskMitigation) html += `<p>${d.riskMitigation}</p>`;
    }
    if (d.reviewNote) {
      html += `<h3>Review Note</h3><p>${d.reviewNote}</p>`;
      if (d.reviewer) html += `<p style="font-size:11px;color:#64748b;">Reviewer: ${d.reviewer} · ${d.reviewDate}</p>`;
    }
    html += `</div></div>`;
  }

  html += `<div class="footer">Hazel Care Ltd | Care Plan Document | Confidential — Not for distribution outside of the care team</div>`;
  html += `</body></html>`;
  return html;
}
