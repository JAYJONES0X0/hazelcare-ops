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

// ─── FULL CLIENT ───────────────────────────────────────────────────────────────
export interface FullClient extends ClientBasic {
  pbs: PBSData | null;
  risk: RiskData | null;
}

// ─── STORAGE ───────────────────────────────────────────────────────────────────
const KEY = 'hc-clients-v2';

export function loadClients(): FullClient[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : seedClients();
  } catch {
    return seedClients();
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
    keyPrinciple: "This person's behaviours of concern are a form of communication. They tell us they are overwhelmed, distressed, or experiencing unmet needs — they are not deliberate attempts to cause harm. Staff must always respond with this understanding.",
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
    reviewSchedule: 'This PBS plan will be reviewed routinely every 3 months, following any significant incident, if presentation changes, following input from any professional review, or if the service user or their family request a review.',
    serviceUserInvolvement: 'The service user was involved in the development of this plan and their views have been incorporated throughout.',
    planDate,
  };
}

export function emptyRisk(planDate: string): RiskData {
  return {
    leastRestrictivePractice: 'All risk management strategies are based on the principle of least restrictive practice in accordance with the Mental Capacity Act 2005. The service user has capacity in relation to their daily choices and lifestyle. Support must always respect their autonomy, use the least restrictive approach, focus on enabling independence, and only restrict choices where necessary to prevent serious harm in a proportionate manner. Restrictive responses are not routine — they are a last resort.',
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
    affectedPeople: ['The service user', 'Support staff', 'Other residents', 'Members of the public'],
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
  };
}

// ─── SEED DATA (Jamie Morton pre-loaded) ───────────────────────────────────────
function seedClients(): FullClient[] {
  const today = '17/03/2026';
  const reviewDate = '17/06/2026';

  const jamie: FullClient = {
    id: 'jamie-morton',
    name: 'Jamie Morton',
    preferredName: 'Jamie',
    dob: '08/08/2006',
    address: '14 Station Road, Pill, Bristol, BS20 0AB',
    nhs: '648 235 9604',
    phone: '07304297118',
    diagnoses: ['Autism Spectrum Disorder (ASD)', 'Attention Deficit Hyperactivity Disorder (ADHD)', 'Global Developmental Delay', 'Attachment Disorder'],
    keyWorker: 'Ishan Karki',
    responsible: 'Amos Opadeji',
    completedBy: 'Brooklyn Ruvinga',
    dateOfAdmission: '20/08/2025',
    reviewDate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pbs: {
      aboutText: 'Jamie is a 19-year-old young man who lives in a shared supported living environment at 14 Station Road, Pill. Jamie is a young person with a lot of strengths. He is generally independent with daily living tasks, keeps his bedroom clean and tidy, communicates verbally, and is physically mobile and active in the community. He has a good relationship with his mum and nan, who remain involved in his life.',
      whatMatters: ['His bedroom — his private, safe space', 'Gaming (console), listening to music, watching films, reading, swimming, cinema, bookshops', 'Online interaction and gaming communities — where Jamie feels most socially comfortable', 'Contact with his mum and nan', 'Feeling respected, listened to, and in control of his own choices', 'Having his independence acknowledged and supported'],
      communicatesBest: ['Calm, clear, simple language', 'Being given time to process information — do not rush him', 'One instruction or question at a time', 'Being spoken to as an adult, with respect', 'Staff approaching him at a relaxed pace — not confrontationally'],
      findsDifficult: ['Expressing feelings clearly when overwhelmed or anxious', 'Managing frustration in the moment', 'Following rigid or imposed structures', 'Loud or busy environments', 'Unexpected changes to routine or plans', 'Feeling controlled, pressured, or not listened to'],
      diagnosisRows: [
        { diagnosis: 'ASD', presentation: 'Difficulty with change and transitions; sensory sensitivity to noise; preference for routine and predictability; may struggle to understand the emotional impact of his words on others; finds it harder to read social situations.' },
        { diagnosis: 'ADHD', presentation: 'Impulsivity; difficulty regulating attention; frustration when interrupted; difficulty stopping activities (e.g. gaming); restlessness; difficulty waiting.' },
        { diagnosis: 'Global Developmental Delay', presentation: 'May need information presented simply and clearly; may not fully understand consequences of behaviour in the moment; benefits from repeated, patient explanation.' },
        { diagnosis: 'Attachment Disorder', presentation: 'Difficulty trusting others; may test boundaries or relationships; fear of rejection; strong emotional reactions to perceived abandonment or unfairness; can find new or unfamiliar staff challenging.' },
      ],
      keyPrinciple: "Jamie's behaviours of concern are a form of communication. They tell us he is overwhelmed, distressed, or experiencing unmet needs — they are not deliberate attempts to cause harm. Staff must always respond with this understanding.",
      functionRows: [
        { behaviour: 'Verbal aggression / offensive language', func: 'Expressing frustration or overwhelm when words are not available; seeking space/distance.' },
        { behaviour: 'Property damage', func: 'Release of intense emotional distress when regulation strategies have been exhausted.' },
        { behaviour: 'Threatening or striking towards staff', func: "Feeling cornered, not heard, or that his space/autonomy is being violated." },
        { behaviour: 'Leaving the property while distressed', func: 'Self-regulating — seeking space and calm away from the trigger environment.' },
        { behaviour: 'Racial / offensive language', func: 'Not always intentional targeted harm — often reflects emotional dysregulation and poor impulse control linked to ADHD and ASD; Jamie may not fully understand impact.' },
        { behaviour: 'Refusing routines, personal care, medications', func: 'Asserting autonomy; feeling overwhelmed; low motivation; ADHD executive function difficulties.' },
      ],
      envStrategies: [
        'Maintain a calm, predictable home environment — minimise unnecessary noise, raised voices, or conflict in communal areas.',
        "Ensure Jamie's bedroom is always treated as his private space — do not enter without reason or permission.",
        "Keep Jamie's environment tidy and organised — unexpected changes to his physical space can cause distress.",
        'Manage any conflict or disruption between other residents away from Jamie where possible.',
        'Ensure transition warnings are given well in advance — e.g. "In 15 minutes the internet will be going off for the night."',
      ],
      routineStrategies: [
        'Support Jamie to maintain a flexible but consistent daily routine — gentle, not rigid.',
        'Give advance notice before any changes to plans, activities, or expectations.',
        'Agree gaming times with Jamie collaboratively — he is more likely to comply with limits he has helped set.',
        'Give 15-minute and 5-minute warnings before gaming sessions need to end.',
        'Encourage a regular bedtime wind-down — reducing screen stimulation in the final hour before sleep.',
        'Prompt gently for meals, medication, personal care — do not demand or pressure.',
      ],
      relationshipStrategies: [
        'Consistency of staff approach — all staff must follow this plan so Jamie experiences predictability.',
        "Build positive interactions with Jamie during calm periods — talk about his interests (gaming, music, films).",
        'Acknowledge and validate Jamie\'s feelings regularly — "I can see you\'re frustrated, that makes sense."',
        'Give Jamie choices wherever possible — autonomy reduces the likelihood of refusal and escalation.',
        'Praise Jamie genuinely when he manages frustration well, completes tasks, or engages positively.',
      ],
      communicationStrategies: [
        'Speak calmly and at a measured pace at all times.',
        'Use short, clear sentences — one piece of information at a time.',
        'Allow processing time — wait at least 10–15 seconds for a response before repeating or prompting.',
        'Avoid sarcasm, raised voices, or confrontational body language.',
        'If Jamie uses offensive language, do not escalate — address calmly when he is regulated.',
      ],
      onlineSafetyStrategies: [
        "Maintain regular, non-intrusive conversations about who Jamie is speaking to online.",
        '"If anyone online ever asks you for money, you can always come to us first — no judgement."',
        "Work with Jamie's mum to ensure daily spending is managed safely.",
        'Offer information about online safety in a relaxed, non-pressured way.',
      ],
      warningSignRows: [
        { sign: 'Voice raising or becoming sharper', staffAction: 'Lower your own voice. Move to a calmer tone. Do not match his volume.' },
        { sign: 'Agitated, pacing, or restless', staffAction: 'Offer space. Do not follow him around. Give him room to move.' },
        { sign: 'Dismissive, short-tempered, one-word answers', staffAction: 'Back off from requests. Say "I\'ll give you some space."' },
        { sign: 'Repeated demands, escalating frustration', staffAction: '"I can see this is really frustrating. Let\'s sort it calmly."' },
        { sign: 'Upset about something online or gaming', staffAction: 'Acknowledge it — do not minimise. Ask calmly if he wants to talk or needs space.' },
        { sign: 'Sudden withdrawal to his room', staffAction: 'Respect this — it is self-regulation. Check in gently after 20–30 minutes.' },
        { sign: 'Mildly offensive or inappropriate language', staffAction: 'Stay calm. Do not challenge in the moment. Note for later reflection.' },
      ],
      reactiveStep1: 'Lower your own voice and body language. Do not match Jamie\'s energy or frustration. Remind yourself: Jamie is distressed, not dangerous by intent.',
      reactiveStep2: 'Do not crowd Jamie. Give physical room. Do not block doorways or position yourself between Jamie and an exit. Support other residents to move away.',
      reactiveStep3: 'Remove all non-essential demands immediately. Focus only on safety. Do not attempt to reason at length during escalation.',
      reactiveStep4: '"Would it help to spend some time in your room?" / "Do you want to go for a walk?" / "I\'m going to give you some space — I\'m here if you need me."',
      reactiveStep5: '"I can hear you\'re really frustrated. That\'s okay." Do not argue about who is right or wrong. Do not make threats about consequences during escalation.',
      reactiveStep6: 'Avoid physical confrontation at all times unless there is an immediate risk of serious harm to Jamie or others. Maintain a safe distance. Position yourself near an exit.',
      reactiveStep7: 'If the situation is not de-escalating, contact the on-call manager immediately. Contact police/999 if there is immediate risk of serious harm. Ensure other residents are safe throughout.',
      walksNote: "Note on walks: When Jamie goes for a walk to regulate, staff should NOT follow him. Respect this. Ensure he has his mobile phone with him and contact him after a reasonable period to check he is safe.",
      postImmediate: ['Do not immediately confront Jamie about what happened — allow him to settle first.', 'Check in warmly: "How are you feeling now? Is there anything you need?"', 'Ensure Jamie has eaten, had water, and is physically comfortable.'],
      postDebrief: ['Calm, non-judgmental conversation about what happened.', 'Reflective questions: "What do you think set things off?" / "What could we try differently next time?"', 'Acknowledge Jamie\'s feelings — validate the emotion even if not the behaviour.', 'Do not shame or lecture — this will close Jamie down.', 'Explore and agree a coping strategy for next time together.'],
      staffResponsibilities: ['Complete an incident report as soon as possible after the event.', 'Inform the on-call manager and document in the daily log.', 'Discuss at the next team handover.', 'Review this PBS plan if patterns are emerging or strategies need updating.', 'Ensure any injuries (to Jamie, staff, or others) are recorded and treated.'],
      whatWorks: ['Calm, quiet voice from staff', 'Being given genuine choices and control', 'Advance warning of changes or endings', 'Staff giving space rather than pursuing', 'Being treated as an adult with dignity', 'Acknowledgement of feelings without judgement', 'Positive reinforcement during calm periods', 'Access to his bedroom as a safe retreat', 'Independent walks to regulate', 'Music, gaming, and personal interests as de-stressors'],
      doesntWork: ['Raising voices or matching his agitation', 'Giving instructions during escalation', 'Following him when he leaves to self-regulate', 'Entering his bedroom without permission or good reason', 'Pressuring or rushing him to respond', 'Multiple demands or instructions at once', 'Lecturing or moralising during or immediately after an incident', 'Removing all autonomy or control', 'Physically blocking exits or crowding his space', 'Confronting him publicly in front of other residents'],
      medicationRows: [
        { name: 'Elvanse', dose: '30mg', when: 'Morning', purpose: 'ADHD management', notes: '' },
        { name: 'Duloxetine', dose: '30mg', when: 'Morning', purpose: 'Anxiety / mood', notes: '' },
      ],
      medicationNote: 'Jamie prefers to take medication with water or strawberry/banana Nesquik milkshake. Usually self-administers — staff to prompt if forgotten. If refused: do not pressure; explain calmly; retry in 10–15 minutes; log and notify senior if repeated refusal.',
      agencyRows: [
        { service: 'Social Worker', role: 'Ongoing oversight of care and placement', status: 'Active' },
        { service: 'Learning Disability Forensic Team', role: 'Risk management, specialist assessment', status: 'Awaiting' },
        { service: 'Police Services', role: 'Known following racial abuse allegation', status: 'As required' },
        { service: 'Local Authority Safeguarding', role: 'Safeguarding oversight', status: 'As required' },
        { service: "Jamie's Mum", role: 'Financial support, family contact, shopping', status: 'Ongoing' },
        { service: 'GP / Healthcare', role: 'Medication, physical and mental health', status: 'Ongoing' },
      ],
      reviewSchedule: 'This PBS plan will be reviewed routinely every 3 months (next review: 17/06/2026), following any significant incident, if Jamie\'s presentation changes, following input from the Learning Disability Forensic Team, or if Jamie or his family request a review.',
      serviceUserInvolvement: 'Jamie was involved in the development of this plan and his views have been incorporated throughout.',
      planDate: today,
    },
    risk: {
      leastRestrictivePractice: "All risk management strategies for Jamie are based on the principle of least restrictive practice in accordance with the Mental Capacity Act 2005. Jamie has capacity in relation to his daily choices and lifestyle. Support must always respect his autonomy, use the least restrictive approach, focus on enabling independence, and only restrict choices where necessary to prevent serious harm in a proportionate manner. Restrictive responses are not routine — they are a last resort.",
      reviewSchedule: "This risk assessment will be reviewed routinely every 3 months (next review: 17/06/2026), following any significant incident, if Jamie's presentation or circumstances change, following input from the Learning Disability Forensic Team or any other professional review, and as part of care plan reviews.",
      multiAgencyRows: [
        { service: 'Social Worker', role: 'Oversight of care and placement', status: 'Active' },
        { service: 'Learning Disability Forensic Team', role: 'Risk management, specialist assessment', status: 'Awaiting intervention' },
        { service: 'Police Services', role: 'Known following racial abuse allegation', status: 'As required' },
        { service: 'Local Authority Safeguarding Team', role: 'Safeguarding oversight', status: 'As required' },
        { service: "Jamie's Mum", role: 'Financial support, family contact', status: 'Ongoing' },
        { service: 'GP', role: 'Medication, physical and mental health', status: 'Ongoing' },
      ],
      planDate: today,
      risks: [
        { id: 'r1', title: 'Emotional Dysregulation Resulting in Unsafe Behaviour', description: 'Jamie may experience episodes of emotional dysregulation when overwhelmed, frustrated, or distressed. During these episodes, Jamie has previously displayed behaviours that present risk to himself, staff, other residents, and members of the public.', behaviours: ['Verbal aggression and shouting directed at staff or others', 'Use of racially inappropriate or offensive language', 'Property damage within the home environment', 'Threatening behaviour towards staff members', 'Attempts to strike staff during escalation', 'Leaving the property while emotionally distressed', 'Police attendance has been required on some occasions'], affectedPeople: ['Jamie Morton (own wellbeing and safety)', 'Support staff', 'Other residents in the shared property', 'Members of the public', 'The property and its environment'], triggers: ['Frustration or unmet expectations (e.g. gaming limits, requests refused)', 'Changes to routine, structure, or plans without warning', 'Environmental stressors — noise, conflict, raised voices within the home', 'Difficulties linked to online activity or gaming', 'Concerns about personal belongings or property', 'Communication breakdown — feeling misunderstood or not listened to', 'Perceived lack of control or autonomy', 'Fatigue from poor sleep', 'Missed medication'], earlyWarnings: ['Raised voice or shouting', 'Increased agitation, pacing, or restlessness', 'Verbal hostility or inappropriate language', 'Repeated demands or escalating frustration', 'Withdrawal, sullenness, or sudden silence', 'Visible signs of emotional distress (e.g. tears, shaking)'], controls: ['PBS plan in place — all staff must be familiar with and follow the PBS plan', 'Calm, consistent, non-confrontational communication by all staff at all times', 'Staff trained in de-escalation techniques', 'Early warning signs identified and monitored — intervene early where possible', 'Jamie encouraged to use self-regulation strategies (bedroom time, walks, music)', 'Advance notice given for all transitions, changes, and endings', 'Other residents supported and moved away from escalating situations', 'Staff maintain safe positioning — near exits, not blocking Jamie\'s movement', 'Incidents documented and reviewed via Nourish incident reporting', 'On-call management contacted when additional support is required', 'Police/999 contacted where there is immediate risk of serious harm', 'Multi-agency collaboration in place — Learning Disability Forensic Team involvement pending'], dynamicControls: ['Remain calm and use non-confrontational communication.', 'Provide space where possible to reduce stimulation.', 'Avoid arguments, confrontation or escalating language.', 'Offer reassurance and acknowledge feelings.', 'Encourage coping strategies such as going to bedroom or taking a walk.', 'Maintain a safe distance and position near an exit where possible.', 'Ensure other residents are moved away from the situation.', 'Contact additional staff or management if the situation escalates.', 'Contact emergency services if there is an immediate risk to safety.'], leastRestrictive: 'Support provided to Jamie is based on the principle of least restrictive practice. Staff aim to support Jamie in managing his emotions and behaviour without unnecessary restrictions on his freedom or autonomy.', likelihood: 4, impact: 3, reviewTrigger: 'Following any significant incident, change in presentation, or following LD Forensic Team assessment.' },
        { id: 'r2', title: 'Risk of Absconding / Leaving Property Whilst Distressed', description: 'Jamie may leave the property without notice during or following a period of emotional escalation. While leaving to self-regulate is a recognised coping strategy for Jamie, there is a risk that he may leave in a heightened state of distress, potentially placing himself at risk in the community.', behaviours: [], affectedPeople: ['Jamie Morton', 'Members of the public'], triggers: ['Emotional escalation within the home', 'Feeling cornered, not heard, or that his space is being violated', 'Overwhelming situations within communal areas', 'Conflict with other residents or staff'], earlyWarnings: [], controls: ['Jamie carries his mobile phone when out in the community — staff to contact him to check wellbeing', 'Staff to note the time and direction Jamie leaves where possible', 'Staff NOT to follow Jamie — this escalates rather than de-escalates the situation', 'If Jamie does not return within a reasonable period or cannot be reached by phone, follow missing persons protocol and contact management/police as appropriate', "Jamie's mum and relevant emergency contacts to be notified if concern escalates", 'Encourage Jamie to inform staff when he plans to leave the property, even if distressed'], dynamicControls: [], leastRestrictive: '', likelihood: 3, impact: 3, reviewTrigger: '' },
        { id: 'r3', title: 'Financial Exploitation (Online)', description: 'Jamie is active online and within gaming communities. He has previously been approached by individuals online requesting money. Due to his ASD, ADHD, and Attachment Disorder, Jamie may find it difficult to identify when someone has unsafe or exploitative intentions.', behaviours: [], affectedPeople: ['Jamie Morton (financial harm, psychological harm)'], triggers: ['Loneliness or desire for social connection', 'Difficulty recognising unsafe or manipulative behaviour', 'Impulsivity linked to ADHD', 'Desire to please others / attachment needs', 'Access to funds via daily bank card transfers from his mum'], earlyWarnings: [], controls: ["Jamie's mum manages finances — transfers daily spending money to his bank card, reducing the amount available at any one time", 'Staff maintain regular, normalised conversations about online safety — non-pressured', 'Jamie encouraged to speak to staff before sending money or sharing financial details with anyone online', 'Staff provide guidance in a calm, non-judgemental way', 'Safer Online Relationships course to be offered when appropriate'], dynamicControls: [], leastRestrictive: '', likelihood: 3, impact: 3, reviewTrigger: '' },
        { id: 'r4', title: 'Risk of Exploitation Through Personal / Romantic Relationships', description: 'Jamie seeks social connection, including romantic relationships, sometimes through online platforms. His ASD and Attachment Disorder mean he may find it difficult to recognise unhealthy boundaries, manipulative behaviour, or when someone does not have positive intentions toward him.', behaviours: [], affectedPeople: ['Jamie Morton'], triggers: ['Loneliness and desire for connection', 'Difficulty reading social cues or intentions', 'Online interaction with unknown individuals', 'Attachment needs and fear of rejection'], earlyWarnings: [], controls: ['Open, non-judgemental environment for Jamie to discuss relationships', 'Staff provide age-appropriate information about consent, healthy relationships, and online safety', 'Jamie encouraged to speak to staff if anyone makes him uncomfortable', 'Safer Online Relationships course to be offered again when appropriate', 'Privacy and dignity respected in all conversations about relationships'], dynamicControls: [], leastRestrictive: '', likelihood: 3, impact: 3, reviewTrigger: '' },
        { id: 'r5', title: 'Risk Related to Medication Management', description: 'Jamie takes Elvanse 30mg (ADHD) and Duloxetine 30mg (anxiety) every morning. He is largely self-administering but occasionally requires prompting. Missed doses or inconsistent administration could result in deterioration in mental health stability.', behaviours: [], affectedPeople: ['Jamie Morton'], triggers: ['Forgetting to take medication', 'Refusing medication during periods of emotional dysregulation', 'Poor sleep affecting morning routine', 'Disrupted routine'], earlyWarnings: [], controls: ['Staff to prompt medication every morning where needed', 'Check MAR chart and verify correct timing before administration', 'Jamie prefers water or Nesquik milkshake (strawberry or banana) to take tablets — have preferred drink available', 'If refused: do not pressure, explain calmly, retry in 10–15 minutes, log and notify senior/GP if repeated refusal', 'Monitor for side effects: drowsiness, nausea, mood changes, agitation, tics, increased heart rate', 'Any missed doses or side effects logged immediately and communicated at handover', 'Prescriptions ordered and collected proactively — ensure supply does not run out'], dynamicControls: [], leastRestrictive: '', likelihood: 3, impact: 3, reviewTrigger: '' },
        { id: 'r6', title: 'Risk of Poor Sleep Affecting Emotional Regulation', description: "Jamie's sleep pattern is variable. He may stay up late gaming or engaging with his phone. Poor or disrupted sleep directly impacts his emotional regulation the following day, increasing the risk of dysregulation and associated behaviours.", behaviours: [], affectedPeople: ['Jamie Morton', 'Staff and other residents (due to knock-on effects on emotional regulation)'], triggers: ['Extended gaming sessions in the evening', 'Emotional dysregulation carried over from the day', 'Night-time noise or disturbances in the home', 'ADHD-related difficulty switching off'], earlyWarnings: [], controls: ['Gentle evening wind-down prompts — encourage Jamie to reduce stimulating activities before bed', 'Agree reasonable gaming cut-off times collaboratively with Jamie', 'Maintain a calm and quiet environment in the home during night hours', 'Provide reassurance if Jamie is unsettled at night', 'Monitor sleep patterns and record in daily logs — identify patterns', 'Encourage and support healthy sleep habits through positive reinforcement'], dynamicControls: [], leastRestrictive: '', likelihood: 3, impact: 3, reviewTrigger: '' },
        { id: 'r7', title: 'Risk of Conflict and Distress Related to Shared Living', description: 'Jamie lives in shared supported living accommodation with other residents. Environmental noise, interpersonal conflict, or disruptions created by other residents can significantly impact Jamie\'s emotional regulation and wellbeing, particularly given his sensory sensitivities linked to ASD.', behaviours: [], affectedPeople: ['Jamie Morton', 'Other residents', 'Staff'], triggers: ['Raised voices or conflict between other residents', 'Noise from communal areas, particularly at night', 'Perceived unfairness in shared responsibilities or resources', "Disruptions to Jamie's personal space"], earlyWarnings: [], controls: ['Staff to maintain a calm, stable home environment at all times', 'Address conflict between residents early and away from Jamie where possible', "Respect Jamie's bedroom as his private space — a safe retreat", 'Ensure communal responsibilities are shared fairly', "Monitor Jamie's presentation when the home environment becomes unsettled"], dynamicControls: [], leastRestrictive: '', likelihood: 4, impact: 3, reviewTrigger: '' },
        { id: 'r8', title: 'Risk of Using Inappropriate or Offensive Language (Including Racial Language)', description: 'When emotionally dysregulated, Jamie may use inappropriate, offensive, or racially abusive language toward staff, other residents, or members of the public. This has resulted in a police matter (racial abuse allegation). While linked to emotional dysregulation rather than deliberate intent, this behaviour presents risk of harm to others and legal consequences for Jamie.', behaviours: [], affectedPeople: ['Staff', 'Other residents', 'Members of the public', 'Jamie himself (legal consequences, impact on placement stability)'], triggers: ['Emotional escalation and dysregulation', 'Impulsivity linked to ADHD', 'Limited understanding of the impact of his language on others', 'Frustration or feeling misunderstood'], earlyWarnings: [], controls: ['PBS plan in place — de-escalation strategies to prevent escalation to this behaviour', 'If offensive language is used: staff respond calmly and professionally without matching aggression', "Address language at a calm, reflective moment — not during escalation", "Work with Jamie over time to build understanding of the impact of his language", 'Celebrate and reinforce positive, respectful communication', 'Multi-agency awareness — LD Forensic Team involvement and police awareness noted'], dynamicControls: [], leastRestrictive: '', likelihood: 4, impact: 2, reviewTrigger: '' },
      ],
    },
  };

  const clients = [jamie];
  saveClients(clients);
  return clients;
}
