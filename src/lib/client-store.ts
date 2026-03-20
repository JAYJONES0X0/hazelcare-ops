// ============================================================
// CLIENT STORE — localStorage persistence for all client data
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
  leastRestrictive: string;
  likelihood: number; // 1-5
  impact: number; // 1-5
  reviewTrigger: string;
}

export interface RiskData {
  leastRestrictivePractice: string;
  reviewSchedule: string;
  multiAgencyRows: AgencyRow[];
  risks: RiskItem[];
  planDate: string;
}

// ─── CARE PLAN DATA ────────────────────────────────────────────────────────────
export const CARE_PLAN_DOMAINS = [
  'Accommodation Cleanliness and Comfort',
  'Breathing',
  'Communication and Senses',
  'Companionship, Social Interaction and Recreation',
  'Daily Routine',
  'Eating and Drinking',
  'Elimination',
  'Environment',
  'Equality, Diversity and Inclusion',
  'Expressing Sexuality',
  'Financial',
  'Health and Wellbeing',
  'Infection Prevention and Control',
  'Medication',
  'Mental Health and Cognition',
  'Mobility',
  'Pain',
  'Personal Care and Dressing',
  'Skin Integrity',
  'Sleeping',
  'Spirituality, Religion and Culture',
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
export interface FullClient extends ClientBasic {
  pbs: PBSData | null;
  risk: RiskData | null;
  carePlan: CarePlanData | null;
  supportPlan: SupportPlanData | null;
}

// ─── STORAGE ───────────────────────────────────────────────────────────────────
const KEY = 'hc-clients-v2';

export function loadClients(): FullClient[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveClients(clients: FullClient[]) {
  localStorage.setItem(KEY, JSON.stringify(clients));
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
    completedBy: 'Brooklyn Ruvinga',
    dateOfAdmission: '',
    reviewDate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pbs: emptyPBS(today),
    risk: emptyRisk(today),
    carePlan: null,
    supportPlan: null,
  };
}

export function purgeSystemData() {
  localStorage.removeItem('hc-clients-v2');
  localStorage.removeItem('hazelcare-ops');
  localStorage.removeItem('hazelcare-staff-notes');
  window.location.reload();
}

export function clearClientData() {
  localStorage.removeItem('hc-clients-v2');
}

export function clearStaffNotes() {
  localStorage.removeItem('hazelcare-staff-notes');
}

