// ============================================================

export interface ClientBasic {
  id: string;
  name: string;
  preferredName: string;
  dob: string;
  address: string;
  nhs: string;
  phone: string;
  diagnoses: string[];
  keyWorker: string;
  responsible: string;
  completedBy: string;
  dateOfAdmission: string;
  reviewDate: string;
  createdAt: string;
  updatedAt: string;
}

// ─── PBS PLAN DATA ─────────────────────────────────────────────────────────────
export interface DiagnosisRow { diagnosis: string; presentation: string }
export interface FunctionRow { behaviour: string; func: string }
export interface WarningSignRow { sign: string; staffAction: string }
export interface MedicationRow { name: string; dose: string; when: string; purpose: string; notes: string }
export interface AgencyRow { service: string; role: string; status: string }

export interface PBSData {
  // Section 1
  aboutText: string;
  whatMatters: string[];
  communicatesBest: string[];
  findsDifficult: string[];
  // Section 2
  diagnosisRows: DiagnosisRow[];
  keyPrinciple: string;
  // Section 3
  functionRows: FunctionRow[];
  // Section 4 — proactive
  envStrategies: string[];
  routineStrategies: string[];
  relationshipStrategies: string[];
  communicationStrategies: string[];
  onlineSafetyStrategies: string[];
  // Section 5
  warningSignRows: WarningSignRow[];
  // Section 6 — reactive steps (ordered)
  reactiveStep1: string;
  reactiveStep2: string;
  reactiveStep3: string;
  reactiveStep4: string;
  reactiveStep5: string;
  reactiveStep6: string;
  reactiveStep7: string;
  walksNote: string;
  // Section 7 — post incident
  postImmediate: string[];
  postDebrief: string[];
  staffResponsibilities: string[];
  // Section 8
  whatWorks: string[];
  doesntWork: string[];
  // Section 9
  medicationRows: MedicationRow[];
  medicationNote: string;
  // Section 10
  agencyRows: AgencyRow[];
  // Section 11
  reviewSchedule: string;
  serviceUserInvolvement: string;
  planDate: string;
}

// ─── RISK DATA ──────────────────────────────────────────────────────────────────
export interface RiskItem {
  id: string;
  title: string;
  description: string;
  behaviours: string[];
  affectedPeople: string[];
  triggers: string[];
  earlyWarnings: string[];
  controls: string[];
  dynamicControls: string[];
  secondaryRisk: string;
  contingencyPlan: string;
  leastRestrictive: string;
  likelihood: number; // 1-5
  impact: number; // 1-5
  reviewTrigger: string;
}

export interface RiskData {
  leastRestrictivePractice: string;
  escalationProcedure: string;
  reviewSchedule: string;
  multiAgencyRows: AgencyRow[];
  risks: RiskItem[];
  planDate: string;
}

// ─── CARE PLAN DATA ────────────────────────────────────────────────────────────
export const CARE_PLAN_DOMAINS = [
  'Environment & Physical Safety',
  'Respiratory Health & Support',
  'Communication & Sensory Integration',
  'Social Engagement & Relationships',
  'Life Skills & Daily Routine',
  'Nutrition, Hydration & Diet',
  'Continence & Personal Hygiene',
  'Adaptive Living Environment',
  'Rights, Choice & Inclusion',
  'Intimacy & Personal Expression',
  'Financial Management & Autonomy',
  'Holistic Health & Vitality',
  'Infection Control & Public Health',
  'Medication Management & Safety',
  'Mental Health & Emotional Wellbeing',
  'Mobility, Movement & Exercise',
  'Pain Management & Comfort',
  'Personal Care & Physical Presentation',
  'Skin Integrity & Pressure Care',
  'Rest & Sleep Patterns',
  'Cultural, Spiritual & Personal Beliefs',
] as const;

export type CarePlanDomainName = typeof CARE_PLAN_DOMAINS[number];

export const LEVEL_OF_NEED_LABELS = ['I manage independently', 'A little support', 'Some support needed', 'Quite a lot of support', 'Full support needed'];

export interface CarePlanDomain {
  id: string;
  title: CarePlanDomainName | string;
  nextReviewDate: string;
  identifiedNeed: string;
  levelOfNeed: number; // 0-4
  plannedOutcomes: string;
  howToAchieve: string;
  riskTitle: string;
  riskLikelihood: number; // 1-5
  riskImpact: number; // 1-5
  riskMitigation: string;
  reviewNote: string;
  reviewer: string;
  reviewDate: string;
  enabled: boolean;
}

export interface CarePlanData {
  domains: CarePlanDomain[];
  biography: string;
  criticalInfo: string;
  emergencyInfo: string;
  planDate: string;
}

// ─── SUPPORT PLAN (parsed from external "My Support Plan" docs) ────────────────
export interface SupportPlanNeed {
  area: string;
  canDoMyself: string;
  risks: string;
  howToSupport: string;
}

export interface SupportPlanData {
  needs: SupportPlanNeed[];
  planDate: string;
}

// ─── FULL CLIENT ───────────────────────────────────────────────────────────────
export interface ClientDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
}

export interface VaultDoc {
  id: string;
  name: string;
  text: string;
  uploadedAt: string;
}

export type CareCircleMode =
  | 'off'
  | 'light_reassurance'
  | 'standard_family_window'
  | 'collaborative'
  | 'professional_access';

export type CareCirclePermissionLevel = 'reassurance' | 'care_plan' | 'risk_aware' | 'professional';

export interface CareCircleContact {
  id: string;
  name: string;
  relationship: string;
  email: string;
  phone: string;
  permissionLevel: CareCirclePermissionLevel;
  verified: boolean;
  consentBasis: string;
  restrictions: string;
  reviewDate: string;
}

export interface CareCircleUpdate {
  id: string;
  dateFrom: string;
  dateTo: string;
  mode: CareCircleMode;
  status: 'draft' | 'reviewed' | 'shared';
  shareability: 'green' | 'amber' | 'red';
  summary: string;
  sourceEntryIds: string[];
  sourceRefs?: string[];
  reviewedBy: string;
  reviewedAt: string;
  createdAt: string;
}

export interface CareCircleConcern {
  id: string;
  type: 'concern' | 'compliment' | 'question' | 'family_update';
  source: string;
  detail: string;
  owner: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  response: string;
  dueDate?: string;
  actionId?: string;
}

export interface CareCircleActivity {
  id: string;
  type: 'mode_changed' | 'contact_added' | 'update_generated' | 'update_copied' | 'concern_logged' | 'action_created' | 'status_changed';
  label: string;
  detail: string;
  createdAt: string;
  actor: string;
  refId?: string;
}

export interface CareCircleData {
  mode: CareCircleMode;
  contacts: CareCircleContact[];
  updates: CareCircleUpdate[];
  concerns: CareCircleConcern[];
  activity: CareCircleActivity[];
  notes: string;
}

export interface FullClient extends ClientBasic {
  pbs: PBSData | null;
  risk: RiskData | null;
  carePlan: CarePlanData | null;
  supportPlan: SupportPlanData | null;
  documents: ClientDocument[];
  careCircle?: CareCircleData;
  clinicalBriefing?: string;
  vaultDocs?: VaultDoc[];
}

// ─── STORAGE ───────────────────────────────────────────────────────────────────
const KEY = 'hc-clients-v2';

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)
  );
}

function cleanText(value: string | undefined | null, max = 1200): string {
  return (value || '').split('\u0000').join('').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanMultiline(value: string | undefined | null, max = 2400): string {
  return (value || '')
    .split('\u0000').join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function compactVaultDocs(docs: VaultDoc[] | undefined | null, aggressive = false): VaultDoc[] | undefined {
  if (!docs || !docs.length) return docs || undefined;
  const limit = aggressive ? 2 : 4;
  const textLimit = aggressive ? 1200 : 6000;
  return docs.slice(0, limit).map((doc) => ({
    ...doc,
    name: cleanText(doc.name, 140),
    text: cleanText(doc.text, textLimit),
  }));
}

function compactClientForStorage(client: FullClient, aggressive = false): FullClient {
  const clinicalBriefing = client.clinicalBriefing
    ? cleanText(client.clinicalBriefing, aggressive ? 600 : 2500)
    : client.vaultDocs?.length
      ? cleanText(
          client.vaultDocs
            .slice(0, aggressive ? 2 : 4)
            .map((doc) => `${doc.name}: ${cleanText(doc.text, aggressive ? 300 : 800)}`)
            .join(' | '),
          aggressive ? 1200 : 4000
        )
      : undefined;

  return {
    ...client,
    name: cleanText(client.name, 180),
    preferredName: cleanText(client.preferredName, 120),
    dob: cleanText(client.dob, 32),
    address: cleanText(client.address, 240),
    nhs: cleanText(client.nhs, 32),
    phone: cleanText(client.phone, 32),
    diagnoses: Array.isArray(client.diagnoses) ? client.diagnoses.map((d) => cleanText(d, 160)).filter(Boolean) : [],
    keyWorker: cleanText(client.keyWorker, 120),
    responsible: cleanText(client.responsible, 120),
    completedBy: cleanText(client.completedBy, 120),
    dateOfAdmission: cleanText(client.dateOfAdmission, 32),
    reviewDate: cleanText(client.reviewDate, 32),
    pbs: client.pbs,
    risk: client.risk,
    carePlan: client.carePlan,
    supportPlan: client.supportPlan,
    careCircle: client.careCircle ? {
      ...client.careCircle,
      notes: cleanText(client.careCircle.notes, aggressive ? 500 : 1400),
      contacts: Array.isArray(client.careCircle.contacts)
        ? client.careCircle.contacts.slice(0, aggressive ? 6 : 20).map((contact) => ({
            ...contact,
            name: cleanText(contact.name, 120),
            relationship: cleanText(contact.relationship, 80),
            email: cleanText(contact.email, 160),
            phone: cleanText(contact.phone, 40),
            consentBasis: cleanText(contact.consentBasis, 220),
            restrictions: cleanText(contact.restrictions, 260),
            reviewDate: cleanText(contact.reviewDate, 40),
          }))
        : [],
      updates: Array.isArray(client.careCircle.updates)
        ? client.careCircle.updates.slice(0, aggressive ? 6 : 30).map((update) => ({
            ...update,
            summary: cleanMultiline(update.summary, aggressive ? 900 : 2400),
            sourceRefs: Array.isArray(update.sourceRefs) ? update.sourceRefs.slice(0, aggressive ? 6 : 16).map((ref) => cleanText(ref, 220)) : [],
            reviewedBy: cleanText(update.reviewedBy, 120),
          }))
        : [],
      concerns: Array.isArray(client.careCircle.concerns)
        ? client.careCircle.concerns.slice(0, aggressive ? 8 : 40).map((concern) => ({
            ...concern,
            source: cleanText(concern.source, 120),
            detail: cleanText(concern.detail, aggressive ? 500 : 1400),
            owner: cleanText(concern.owner, 120),
            response: cleanMultiline(concern.response, aggressive ? 500 : 1400),
            dueDate: cleanText(concern.dueDate, 40),
            actionId: cleanText(concern.actionId, 80),
          }))
        : [],
      activity: Array.isArray(client.careCircle.activity)
        ? client.careCircle.activity.slice(0, aggressive ? 12 : 80).map((activity) => ({
            ...activity,
            label: cleanText(activity.label, 160),
            detail: cleanText(activity.detail, aggressive ? 180 : 360),
            actor: cleanText(activity.actor, 120),
            refId: cleanText(activity.refId, 80),
          }))
        : [],
    } : undefined,
    documents: Array.isArray(client.documents)
      ? client.documents.map((doc) => ({
          ...doc,
          name: cleanText(doc.name, 160),
          url: cleanText(doc.url, 400),
          type: cleanText(doc.type, 80),
          uploadedAt: cleanText(doc.uploadedAt, 40),
        }))
      : [],
    vaultDocs: compactVaultDocs(client.vaultDocs, aggressive),
    clinicalBriefing,
    updatedAt: cleanText(client.updatedAt, 40),
    createdAt: cleanText(client.createdAt, 40),
  };
}

function tryPersistClients(clients: FullClient[]) {
  localStorage.setItem(KEY, JSON.stringify(clients));
}

function notifyClientsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('hc-clients-updated'));
}

export function loadClients(): FullClient[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveClients(clients: FullClient[]) {
  const compacted = clients.map((client) => compactClientForStorage(client));
  let notified = false;
  try {
    tryPersistClients(compacted);
    notified = true;
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    try {
      tryPersistClients(compacted.map((client) => compactClientForStorage(client, true)));
      notified = true;
    } catch {
      // Final fallback: keep the app alive, even if persistence has to be dropped.
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      notified = true;
    }
  }
  if (notified) notifyClientsChanged();
}

export function saveClient(client: FullClient) {
  const clients = loadClients();
  const idx = clients.findIndex(c => c.id === client.id);
  if (idx >= 0) clients[idx] = { ...client, updatedAt: new Date().toISOString() };
  else clients.unshift({ ...client, updatedAt: new Date().toISOString() });
  saveClients(clients);
}

export function findExistingClient(name: string, nhs: string): FullClient | undefined {
  const clients = loadClients();
  // Match by NHS number first (most reliable)
  if (nhs && nhs.length > 3) {
    const match = clients.find(c => c.nhs && c.nhs.replace(/\s/g, '') === nhs.replace(/\s/g, ''));
    if (match) return match;
  }
  // Fallback: match by exact name
  if (name && name.length > 2) {
    const match = clients.find(c => c.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (match) return match;
  }
  return undefined;
}

function normalizeName(v: string): string {
  return (v || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreNameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const aParts = new Set(na.split(' '));
  const bParts = new Set(nb.split(' '));
  const overlap = [...aParts].filter(p => bParts.has(p)).length;
  return overlap / Math.max(aParts.size, bParts.size, 1);
}

export interface ClientMatchCandidate {
  client: FullClient;
  score: number;
  strategy: 'nhs' | 'name_dob' | 'name_fuzzy';
}

export interface ClientResolutionResult {
  best: ClientMatchCandidate | null;
  candidates: ClientMatchCandidate[];
  requiresManualSelection: boolean;
}

export function resolveClientMatch(params: { name?: string; nhs?: string; dob?: string }): ClientResolutionResult {
  const clients = loadClients();
  const candidates: ClientMatchCandidate[] = [];
  const nhs = (params.nhs || '').replace(/\s/g, '');
  const name = params.name || '';
  const dob = params.dob || '';

  if (nhs.length > 3) {
    for (const c of clients) {
      const cNhs = (c.nhs || '').replace(/\s/g, '');
      if (cNhs && cNhs === nhs) {
        candidates.push({ client: c, score: 1, strategy: 'nhs' });
      }
    }
  }

  if (!candidates.length && name && dob) {
    for (const c of clients) {
      if ((c.dob || '').trim() && c.dob.trim() === dob.trim() && normalizeName(c.name) === normalizeName(name)) {
        candidates.push({ client: c, score: 0.95, strategy: 'name_dob' });
      }
    }
  }

  if (!candidates.length && name) {
    for (const c of clients) {
      const score = scoreNameSimilarity(c.name, name);
      if (score >= 0.6) {
        candidates.push({ client: c, score, strategy: 'name_fuzzy' });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0] || null;
  const requiresManualSelection = !best || best.score < 0.75;
  return { best, candidates: candidates.slice(0, 5), requiresManualSelection };
}

export function deleteClient(id: string) {
  const clients = loadClients().filter(c => c.id !== id);
  saveClients(clients);
}

export function newClientId() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── EMPTY TEMPLATES ───────────────────────────────────────────────────────────
export function emptyPBS(planDate: string): PBSData {
  return {
    aboutText: '',
    whatMatters: ['', '', '', '', ''],
    communicatesBest: ['', '', '', '', ''],
    findsDifficult: ['', '', '', '', ''],
    diagnosisRows: [{ diagnosis: '', presentation: '' }],
    keyPrinciple: "[Name]'s behaviours of concern are a form of communication. They tell us they are overwhelmed, distressed, or experiencing unmet needs — they are not deliberate attempts to cause harm. Staff must always respond with this understanding.",
    functionRows: [{ behaviour: '', func: '' }],
    envStrategies: ['', '', '', ''],
    routineStrategies: ['', '', '', ''],
    relationshipStrategies: ['', '', '', ''],
    communicationStrategies: ['', '', '', ''],
    onlineSafetyStrategies: [],
    warningSignRows: [{ sign: '', staffAction: '' }],
    reactiveStep1: 'Lower your own voice and body language. Do not match their energy or frustration. Remind yourself: this person is distressed, not dangerous by intent.',
    reactiveStep2: 'Do not crowd them. Give physical room. Do not block doorways or position yourself between them and an exit.',
    reactiveStep3: 'Remove all non-essential demands immediately. Focus only on safety.',
    reactiveStep4: '"Would it help to spend some time in your room?" / "Do you want to go for a walk?" / "I\'m going to give you some space — I\'m here if you need me."',
    reactiveStep5: 'Even brief acknowledgement reduces escalation: "I can hear you\'re really frustrated. That\'s okay." Do not argue about who is right or wrong.',
    reactiveStep6: 'Avoid physical confrontation at all times unless there is an immediate risk of serious harm. Maintain safe distance.',
    reactiveStep7: 'If not de-escalating, contact on-call manager. Contact 999 if there is immediate risk of serious harm.',
    walksNote: '',
    postImmediate: ['Do not immediately confront — allow them to settle.', 'Check in warmly: "How are you feeling now? Is there anything you need?"', 'Ensure they have eaten, had water, and are physically comfortable.'],
    postDebrief: ['Calm, non-judgmental conversation about what happened.', 'Reflective questions: "What do you think set things off?"', 'Validate the emotion — do not shame or lecture.', 'Agree a coping strategy for next time together.'],
    staffResponsibilities: ['Complete incident report as soon as possible.', 'Inform the on-call manager and document in the daily log.', 'Discuss at the next team handover.', 'Review this PBS plan if patterns are emerging.'],
    whatWorks: ['', '', '', '', ''],
    doesntWork: ['', '', '', '', ''],
    medicationRows: [{ name: '', dose: '', when: 'Morning', purpose: '', notes: '' }],
    medicationNote: '',
    agencyRows: [{ service: '', role: '', status: 'Active' }],
    reviewSchedule: 'This PBS plan will be reviewed routinely every 3 months, following any significant incident, if presentation changes, following input from any professional review, or if the person or their family request a review.',
    serviceUserInvolvement: 'This person was involved in the development of this plan and their views have been incorporated throughout.',
    planDate,
  };
}

export function emptyRisk(planDate: string): RiskData {
  return {
    leastRestrictivePractice: 'All risk management strategies are based on the principle of least restrictive practice in accordance with the Mental Capacity Act 2005. This person has capacity in relation to their daily choices and lifestyle. Support must always respect their autonomy, use the least restrictive approach, focus on enabling independence, and only restrict choices where necessary to prevent serious harm in a proportionate manner. Restrictive responses are not routine — they are a last resort.',
    escalationProcedure: 'If risk escalates beyond routine support, staff must follow the Escalation Policy & Procedure immediately: ensure immediate safety, initiate de-escalation steps, alert senior/on-call support, complete incident and safeguarding records, and trigger multi-agency escalation where thresholds are met.',
    reviewSchedule: 'This risk assessment will be reviewed routinely every 3 months, following any significant incident, if there is a change in presentation or needs, following multi-agency input or professional review, and as part of routine care plan reviews.',
    multiAgencyRows: [{ service: '', role: '', status: 'Active' }],
    risks: [emptyRisk_item()],
    planDate,
  };
}

export function emptyRisk_item(): RiskItem {
  return {
    id: `risk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title: '',
    description: '',
    behaviours: [''],
    affectedPeople: ['This person', 'Support staff', 'Other residents', 'Members of the public'],
    triggers: [''],
    earlyWarnings: [''],
    controls: [''],
    dynamicControls: ['Remain calm and use non-confrontational communication.', 'Provide space where possible to reduce stimulation.', 'Offer reassurance and acknowledge feelings.'],
    secondaryRisk: '',
    contingencyPlan: '',
    leastRestrictive: '',
    likelihood: 3,
    impact: 3,
    reviewTrigger: '',
  };
}

export function emptyCarePlanDomain(title: string, reviewDate: string): CarePlanDomain {
  return {
    id: `cpd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title,
    nextReviewDate: reviewDate,
    identifiedNeed: '',
    levelOfNeed: 0,
    plannedOutcomes: '',
    howToAchieve: '',
    riskTitle: '',
    riskLikelihood: 1,
    riskImpact: 1,
    riskMitigation: '',
    reviewNote: '',
    reviewer: '',
    reviewDate: '',
    enabled: false,
  };
}

export function emptyCarePlan(planDate: string, reviewDate: string): CarePlanData {
  return {
    domains: CARE_PLAN_DOMAINS.map(title => emptyCarePlanDomain(title, reviewDate)),
    biography: '',
    criticalInfo: '',
    emergencyInfo: '',
    planDate,
  };
}

export function emptySupportPlan(planDate: string): SupportPlanData {
  return {
    needs: [],
    planDate,
  };
}

export function emptyCareCircle(reviewDate: string): CareCircleData {
  return {
    mode: 'off',
    contacts: [],
    updates: [],
    concerns: [],
    activity: [],
    notes: `Family involvement is optional and must follow the person's consent, best-interest decision-making where relevant, safeguarding boundaries, and provider policy. Review by ${reviewDate}.`,
  };
}

export function emptyClient(): FullClient {
  const today = new Date().toLocaleDateString('en-GB');
  const reviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');
  return {
    id: newClientId(),
    name: '',
    preferredName: '',
    dob: '',
    address: '',
    nhs: '',
    phone: '',
    diagnoses: [],
    keyWorker: '',
    responsible: '',
    completedBy: '',
    dateOfAdmission: '',
    reviewDate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pbs: emptyPBS(today),
    risk: emptyRisk(today),
    carePlan: null,
    supportPlan: null,
    documents: [],
    careCircle: emptyCareCircle(reviewDate),
  };
}

export function clearClientData() {
  localStorage.removeItem('hc-clients-v2');
}

export function clearStaffNotes() {
  localStorage.removeItem('hazelcare-staff-notes');
}

