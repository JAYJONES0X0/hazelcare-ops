// ============================================================
// COMPLIANCE STORE — Service Audits (Staff now in main store)
// ============================================================

export interface ComplianceAudit {
  id: string;
  house: string;
  type: 'medication' | 'fire_safety' | 'finance' | 'cqc' | 'health_safety';
  lastCompleted: string;  // DD/MM/YYYY
  dueDate: string;        // DD/MM/YYYY
  completedBy: string;
  notes: string;
}

export interface LegalDocument {
  id: string;
  title: string;
  lastUpdated: string;
  content: string;
  isDraft: boolean;
}

const AUDIT_KEY = 'hazelcare-compliance-audits';

export function loadComplianceAudits(): ComplianceAudit[] {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; }
}

export function saveComplianceAudits(audits: ComplianceAudit[]) {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(audits));
}

const LEGAL_DOCS_KEY_PREFIX = 'hazelcare-legal-';

export function loadLegalDocument(id: string): LegalDocument | null {
  try {
    const data = localStorage.getItem(LEGAL_DOCS_KEY_PREFIX + id);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function saveLegalDocument(doc: LegalDocument) {
  localStorage.setItem(LEGAL_DOCS_KEY_PREFIX + doc.id, JSON.stringify(doc));
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function parseDateStr(d: string): Date | null {
  if (!d) return null;
  const parts = d.split('/');
  if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0]);
  return new Date(d);
}

export function daysUntil(dateStr: string): number {
  const d = parseDateStr(dateStr);
  if (!d || isNaN(d.getTime())) return 9999;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function staffStatus(dateStr: string, warnDays = 30): 'ok' | 'due_soon' | 'overdue' {
  if (!dateStr) return 'ok';
  const days = daysUntil(dateStr);
  if (days < 0) return 'overdue';
  if (days < warnDays) return 'due_soon';
  return 'ok';
}

export const HAZELCARE_HOUSES = [
  'Maple House', 'Elm House', 'Rowan House', 'Willow House',
  'Cedar House', 'Hawthorn House', 'Linden House', 'Birch Lodge',
  'Aspen House', 'Holly House',
];

export const ROLES = [
  'Support Worker', 'Senior Support Worker', 'House Coordinator',
  'Team Leader', 'Deputy Manager', 'Registered Manager', 'Bank Staff', 'Agency',
];

export const AUDIT_TYPES: { id: ComplianceAudit['type']; label: string; freqWeeks: number; color: string }[] = [
  { id: 'medication', label: 'Medication Audit', freqWeeks: 4, color: '#0891b2' },
  { id: 'fire_safety', label: 'Fire Safety Check', freqWeeks: 4, color: '#ef4444' },
  { id: 'finance', label: 'Finance Audit', freqWeeks: 4, color: '#059669' },
  { id: 'cqc', label: 'CQC Readiness Check', freqWeeks: 13, color: '#be185d' },
  { id: 'health_safety', label: 'Health & Safety', freqWeeks: 4, color: '#d97706' },
];

// ============================================================
// UK LEGAL TEMPLATES (BOILERPLATES)
// ============================================================
export const LEGAL_TEMPLATES: Record<string, string> = {
  tos: `# Terms of Service
**Jurisdiction: England & Wales**
**Organization: {{ORG_NAME}}**

## 1. Introduction
These terms govern the use of the operational management platform provided by {{ORG_NAME}}. By accessing this service, you agree to comply with these terms.

## 2. Scope of Service
Our platform provides organizational intelligence, staff monitoring, and document generation tools for the care sector. It is intended for professional use by registered care providers.

## 3. Data Ownership
{{ORG_NAME}} acknowledges that all care-related data uploaded to the platform remains the property of the Customer (The Controller). {{ORG_NAME}} acts as a Processor under UK GDPR.

## 4. Liability
While we strive for 100% accuracy in OVSITE operating workflows, operational decisions remain the responsibility of the registered manager. {{ORG_NAME}} is not liable for clinical outcomes or regulatory findings resulting from system interactions.

## 5. Governing Law
These terms are governed by the laws of England and Wales. Each party submits to the exclusive jurisdiction of the English courts.`,

  privacy: `# Privacy Policy
**Last Updated: {{DATE}}**
**Data Controller: {{ORG_NAME}}**

## 1. Compliance Statement
This policy confirms how {{ORG_NAME}} handles personal data in compliance with the UK GDPR and the Data Protection Act 2018.

## 2. Data We Process
We process operational data, staff performance metrics, and care-related logs to provide organizational oversight. This includes sensitive health data ("Special Category Data") where necessary for care provision.

## 3. Lawful Basis
Our processing is based on:
- **Contractual Necessity**: To provide the platform services.
- **Legal Obligation**: To comply with health and social care regulations.
- **Substantial Public Interest**: For the provision of health or social care.

## 4. Your Rights
Under UK GDPR, data subjects have the right to access, rectification, and erasure. Requests should be sent to the Data Protection lead at {{ORG_NAME}}.

## 5. Reporting
If you have concerns about how we handle your data, you have the right to lodge a complaint with the Information Commissioner's Office (ICO).`,

  dpa: `# Data Processing Agreement (DPA)
**Between: {{ORG_NAME}} ("The Processor") and The Customer ("The Controller")**

## 1. Scope and Purpose
This agreement satisfies the requirements of Article 28(3) of the UK GDPR. It governs the processing of personal data by the Processor on behalf of the Controller.

## 2. Processor Obligations
The Processor shall:
- Process data only on documented instructions from the Controller.
- Ensure all persons processing the data are committed to confidentiality.
- Implement appropriate technical and organizational measures as per Article 32.

## 3. Sub-Processors
The Controller provides general authorization for the Processor to engage sub-processors (e.g., cloud hosting providers). The Processor remains fully liable for the performance of sub-processors.

## 4. Term and Termination
Upon termination of the service, the Processor shall delete or return all personal data at the Controller's choice, unless UK law requires storage.`,

  ropa: `# Records of Processing Activities (RoPA)
**UK GDPR Article 30 Requirement**

**Organization:** {{ORG_NAME}}
**DPO/Lead:** [TBC]

## 1. Staff Monitoring & Performance
- **Purpose**: Managerial oversight and quality assurance.
- **Subject Categories**: Employees, Contractors.
- **Data Categories**: Names, Shift Logs, Performance Indices.
- **Retention**: Employment duration + 6 years.

## 2. Care Intelligence (Diary Logs)
- **Purpose**: Clinical governance and CQC readiness.
- **Subject Categories**: Residents/Service Users.
- **Data Categories**: Health status, incident reports, task completion.
- **Retention**: CQC regulatory requirement (typically 3-8 years).

## 3. Security Measures
- AES-256 Encryption at rest.
- Role-Based Access Control (RBAC).
- Local-only data processing options where configured.`,
};

export const STAFF_TEMPLATES: Record<string, string> = {
  contract: `# Statement of Terms and Conditions of Employment
**Organization: {{ORG_NAME}}**
**Employee: {{STAFF_NAME}}**
**Date: {{DATE}}**

## 1. Job Title and Role
Your job title is **{{STAFF_ROLE}}**. You will be based at **{{STAFF_HOUSE}}**, although you may be required to work at other locations within {{ORG_NAME}} as reasonably required.

## 2. Commencement of Employment
Your employment with {{ORG_NAME}} commenced on [Insert Start Date]. Your period of continuous employment began on [Insert Date].

## 3. Remuneration
Your salary is [Insert Rate] per hour, payable monthly in arrears by BACS.

## 4. Hours of Work
Your normal hours of work are [Insert Hours] per week. You may be required to work additional hours and shift patterns, including nights and weekends, as required for the operational needs of the service.

## 5. Compliance and Training
It is a condition of your employment that you maintain a valid Enhanced DBS check and complete all mandatory training as required by CQC regulations. Failure to maintain these may result in suspension or termination of employment.

## 6. Confidentiality
You must not disclose any confidential information regarding the people we support or the business operations of {{ORG_NAME}} to any third party.

---
**Signed for the Employer:** ____________________
**Signed by the Employee:** ____________________`,

  induction: `# Staff Induction & Orientation Checklist
**Staff Member: {{STAFF_NAME}}**
**House: {{STAFF_HOUSE}}**
**Job Role: {{STAFF_ROLE}}**

## Phase 1: Organizational Overview
- [ ] Introduction to {{ORG_NAME}} vision and values.
- [ ] Review of Staff Handbook and Code of Conduct.
- [ ] Access to operational systems initialized.

## Phase 2: Health & Safety / Compliance
- [ ] Fire safety orientation and exit locations.
- [ ] First Aid kit and Incident Book locations.
- [ ] Review of Safeguarding policy and reporting procedures.
- [ ] **DBS Verification Completed** (Ref: {{STAFF_DBS}}).

## Phase 3: Role Specific Training
- [ ] Medication administration training (if applicable).
- [ ] Positive Behavior Support (PBS) overview.
- [ ] Introduction to individual support plans for residents at {{STAFF_HOUSE}}.

## Phase 4: Completion
The staff member has completed the initial orientation and is authorized to begin supervised shifts.

---
**Manager Signature:** ____________________  **Date:** {{DATE}}`,

  review: `# Staff Performance Review
**Staff Member: {{STAFF_NAME}}**
**Review Period: [Insert Period]**
**Manager: {{REVIEWER_NAME}}**

## 1. Compliance Audit
- **DBS Status**: {{STAFF_DBS_STATUS}}
- **Training Compliance**: {{STAFF_TRAINING_STATUS}}

## 2. Competency Review
- **Quality of Care**: [Manager Feedback]
- **Documentation Accuracy**: [Manager Feedback]
- **Team Collaboration**: [Manager Feedback]

## 3. Areas of Development
[Insert areas for improvement or training needs discussed]

## 4. Objectives for Next Period
1. [Objective 1]
2. [Objective 2]

## 5. Staff Comments
[Staff member feedback regarding their role and support]

---
**Manager Signature:** ____________________
**Employee Signature:** ____________________
**Date:** {{DATE}}`,
};
