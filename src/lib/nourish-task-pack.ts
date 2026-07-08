import type { CarePlanDomain, FullClient } from './client-store';

export type TaskFrequency = 'daily' | 'weekly' | 'event';

export interface NourishTask {
  id: string;
  name: string;
  notes: string;
  frequency: TaskFrequency;
  mandatory: boolean;
  source: string;
  domain: string;
  evidence: string[];
}

function cleanLine(input: string, max = 2000): string {
  const normalized = (input || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, max - 3).trimEnd() + '...';
}

function firstSentence(input: string, max = 180): string {
  const clean = cleanLine(input, max);
  const sentence = clean.match(/^(.+?[.!?])\s/)?.[1];
  return sentence && sentence.length <= max ? sentence : clean;
}

function fieldSummary(label: string, input: string | undefined, max = 180): string | null {
  const summary = firstSentence(input || '', max);
  return summary ? `${label}: ${summary}` : null;
}

function hasAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some(word => lower.includes(word));
}

function extractSourceCues(...values: Array<string | undefined>): string[] {
  const text = values.join(' ').toLowerCase();
  const cues: string[] = [];
  if (hasAny(text, ['privacy', 'private', 'bedroom', 'personal space'])) cues.push('privacy/personal space');
  if (hasAny(text, ['shared', 'communal', 'kitchen', 'lounge', 'bathroom', 'hallway'])) cues.push('shared-space responsibility');
  if (hasAny(text, ['prompt', 'encourage', 'remind', 'guidance'])) cues.push('prompting/encouragement');
  if (hasAny(text, ['refuse', 'decline', 'reluctant', 'does not want'])) cues.push('refusal/choice');
  if (hasAny(text, ['risk', 'safety', 'hazard', 'maintenance', 'fire', 'clutter'])) cues.push('safety risk');
  if (hasAny(text, ['independent', 'independently', 'can do', 'able to'])) cues.push('promote independence');
  if (hasAny(text, ['anxious', 'distress', 'agitated', 'overwhelmed', 'mental health'])) cues.push('emotional presentation');
  if (hasAny(text, ['medication', 'mar', 'tablet', 'dose'])) cues.push('medication evidence');
  if (hasAny(text, ['meal', 'food', 'breakfast', 'lunch', 'dinner', 'hydrate', 'fluid'])) cues.push('nutrition/hydration');
  return Array.from(new Set(cues)).slice(0, 4);
}

function domainTaskLogic(title: string, sourceText: string): { purpose: string; action: string; watch: string } {
  const lower = title.toLowerCase();
  if (lower.includes('environment') || lower.includes('adaptive living')) {
    return {
      purpose: 'Keep the home environment safe while respecting privacy, choice and independence.',
      action: 'Offer choice-led prompts for bedroom/shared-area upkeep, agree what support is wanted, and address hazards without taking over tasks the person can do.',
      watch: 'Escalate safety, maintenance, fire, hygiene or neighbour/shared-space concerns.',
    };
  }
  if (lower.includes('communication') || lower.includes('sensory')) {
    return {
      purpose: 'Make communication clear, respectful and accessible before support is delivered.',
      action: 'Check preferred communication style, give time to respond, adapt prompts to sensory needs, and confirm understanding before moving on.',
      watch: 'Watch for frustration, withdrawal, overload, misunderstanding or refusal caused by communication barriers.',
    };
  }
  if (lower.includes('social') || lower.includes('relationship')) {
    return {
      purpose: 'Support safe social connection without forcing engagement.',
      action: 'Offer realistic activity/social options, support planning or travel if needed, and respect declined contact while keeping opportunities open.',
      watch: 'Watch for isolation, conflict, exploitation, unsafe contact or deterioration in mood after social contact.',
    };
  }
  if (lower.includes('life skills') || lower.includes('daily routine')) {
    return {
      purpose: 'Maintain routine and daily living skills with the least support needed.',
      action: 'Break the routine into small steps, prompt rather than take over, and reinforce what the person completes independently.',
      watch: 'Watch for missed routines, overload, declining motivation, household task build-up or avoidable dependency.',
    };
  }
  if (lower.includes('nutrition') || lower.includes('hydration') || hasAny(sourceText, ['meal', 'hydrate', 'fluid'])) {
    return {
      purpose: 'Maintain safe nutrition and hydration in line with preference and care-plan need.',
      action: 'Offer meal/fluid prompts, support preparation or access where needed, and record intake concerns or refusal clearly.',
      watch: 'Escalate repeated refusal, poor intake, choking/reflux concerns, weight/appetite change or dehydration indicators.',
    };
  }
  if (lower.includes('medication')) {
    return {
      purpose: 'Support medication safely and evidence the outcome.',
      action: 'Follow MAR/prescribed instructions, prompt at the agreed time, record taken/refused/missed, and follow refusal/escalation procedure.',
      watch: 'Escalate missed doses, refusal, side effects, stock/MAR errors or change in presentation.',
    };
  }
  if (lower.includes('mental health') || lower.includes('wellbeing')) {
    return {
      purpose: 'Monitor emotional wellbeing and respond early to changes in presentation.',
      action: 'Check mood/presentation, offer agreed coping support, maintain calm engagement, and record what changed or helped.',
      watch: 'Escalate self-harm indicators, crisis presentation, withdrawal, agitation, safeguarding concerns or refusal of essential support.',
    };
  }
  if (lower.includes('personal care') || lower.includes('hygiene') || lower.includes('continence')) {
    return {
      purpose: 'Support dignity, hygiene and presentation using the least intrusive approach.',
      action: 'Offer discreet prompts or practical help, respect privacy, confirm consent, and record support accepted or declined.',
      watch: 'Escalate skin issues, hygiene deterioration, continence concerns, pain, refusal patterns or infection-control risks.',
    };
  }
  if (lower.includes('mobility') || lower.includes('movement') || lower.includes('exercise')) {
    return {
      purpose: 'Support safe movement and independence.',
      action: 'Use the agreed mobility approach/equipment, prompt pacing, and support transfers or community movement only within the care plan.',
      watch: 'Escalate falls, pain, breathlessness, equipment issues, reduced mobility or unsafe transfer attempts.',
    };
  }
  if (lower.includes('skin') || lower.includes('pressure')) {
    return {
      purpose: 'Protect skin integrity and spot deterioration early.',
      action: 'Complete agreed skin/pressure-area checks or prompts, support repositioning/comfort, and record any visible change.',
      watch: 'Escalate redness, soreness, broken skin, swelling, pain or refusal of pressure-care support.',
    };
  }
  return {
    purpose: 'Deliver the agreed care-plan support in a person-centred, evidence-based way.',
    action: 'Offer the planned support, use least-restrictive prompts, respect choice, and adapt support to the person\'s response.',
    watch: 'Escalate refusal of essential support, change in risk/presentation, safeguarding concern or unmet need.',
  };
}

const DAILY_DOMAIN_KEYWORDS = [
  'medication', 'mental health', 'personal care', 'hygiene', 'nutrition',
  'hydration', 'daily routine', 'continence', 'mobility', 'pain',
  'sleep', 'infection', 'communication', 'engagement', 'social',
];

const WEEKLY_DOMAIN_KEYWORDS = [
  'skin integrity', 'pressure care', 'financial', 'cultural', 'spiritual',
  'environmental', 'rights', 'intimacy', 'adaptive',
];

const EVENT_DOMAIN_KEYWORDS = [
  'safeguarding', 'incident', 'aggression', 'deterioration',
];

const VAULT_DOMAIN_SPECS: Array<{ title: string; keywords: string[] }> = [
  { title: 'Medication Management & Safety', keywords: ['medication', 'medicine', 'mar', 'tablet', 'dose', 'prescribed'] },
  { title: 'Mental Health & Emotional Wellbeing', keywords: ['mental health', 'wellbeing', 'mood', 'anxious', 'distress', 'self-harm', 'crisis'] },
  { title: 'Personal Care & Physical Presentation', keywords: ['personal care', 'shower', 'bath', 'dress', 'groom', 'presentation'] },
  { title: 'Continence & Personal Hygiene', keywords: ['continence', 'toilet', 'toileting', 'hygiene', 'incontinence'] },
  { title: 'Nutrition, Hydration & Diet', keywords: ['nutrition', 'hydration', 'meal', 'food', 'breakfast', 'lunch', 'dinner', 'fluids'] },
  { title: 'Environment & Physical Safety', keywords: ['environment', 'bedroom', 'room', 'clutter', 'fire', 'hazard', 'maintenance', 'safe room'] },
  { title: 'Mobility, Movement & Exercise', keywords: ['mobility', 'transfer', 'walking', 'falls', 'exercise', 'breathless'] },
  { title: 'Communication & Sensory Integration', keywords: ['communication', 'sensory', 'prompt', 'understanding', 'speech'] },
  { title: 'Social Engagement & Relationships', keywords: ['social', 'relationship', 'community', 'activity', 'isolation'] },
  { title: 'Financial Management & Autonomy', keywords: ['finance', 'money', 'budget', 'debt', 'exploitation'] },
  { title: 'Skin Integrity & Pressure Care', keywords: ['skin', 'pressure', 'redness', 'sore', 'reposition'] },
  { title: 'Life Skills & Daily Routine', keywords: ['routine', 'life skills', 'domestic', 'laundry', 'cleaning'] },
];

function inferFrequency(domainTitle: string): TaskFrequency {
  const lower = domainTitle.toLowerCase();
  if (EVENT_DOMAIN_KEYWORDS.some(k => lower.includes(k))) return 'event';
  if (WEEKLY_DOMAIN_KEYWORDS.some(k => lower.includes(k))) return 'weekly';
  if (DAILY_DOMAIN_KEYWORDS.some(k => lower.includes(k))) return 'daily';
  return 'daily';
}

function isMandatoryTask(domainTitle: string, notes: string): boolean {
  const lower = domainTitle.toLowerCase() + ' ' + notes.toLowerCase();
  return (
    lower.includes('medication') ||
    lower.includes('mental health') ||
    lower.includes('fire') ||
    lower.includes('risk') ||
    lower.includes('safeguarding') ||
    lower.includes('aggression')
  );
}

function buildTaskName(domain: Pick<CarePlanDomain, 'title' | 'identifiedNeed'>, clientName: string): string {
  const title = domain.title;
  const firstName = clientName.split(' ')[0] || 'Client';
  const need = (domain.identifiedNeed || '').toLowerCase();
  let action = '';

  if (title.includes('Nutrition')) {
    if (need.includes('breakfast')) action = 'with Breakfast';
    else if (need.includes('lunch')) action = 'with Lunch';
    else if (need.includes('dinner') || need.includes('tea')) action = 'with Dinner';
    else action = 'with Meals & Hydration';
  } else if (title.includes('Personal Care')) {
    if (need.includes('shower')) action = 'to Shower';
    else if (need.includes('bath')) action = 'to Bath';
    else if (need.includes('dress')) action = 'to Dress & Groom';
    else action = 'with Personal Care';
  } else if (title.includes('Environment')) {
    action = 'to maintain a Safe Environment';
  } else if (title.includes('Social')) {
    action = 'to engage in Social Activities';
  }

  const taskNames: Record<string, string> = {
    'Medication Management & Safety': `Support ${firstName} with Medication`,
    'Mental Health & Emotional Wellbeing': `${firstName}'s Emotional Wellbeing Check`,
    'Personal Care & Physical Presentation': `Support ${firstName} ${action || 'with Personal Care'}`,
    'Continence & Personal Hygiene': `Support ${firstName} with Hygiene & Continence`,
    'Nutrition, Hydration & Diet': `Help ${firstName} ${action || 'with Nutrition & Hydration'}`,
    'Life Skills & Daily Routine': `Support ${firstName}'s Daily Routine`,
    'Social Engagement & Relationships': `Help ${firstName} ${action || 'Socialise & Connect'}`,
    'Mobility, Movement & Exercise': `Support ${firstName} with Mobility`,
    'Pain Management & Comfort': `Pain & Comfort Check for ${firstName}`,
    'Rest & Sleep Patterns': `Support ${firstName}'s Sleep Pattern`,
    'Infection Control & Public Health': `Infection Control for ${firstName}`,
    'Communication & Sensory Integration': `Support ${firstName}'s Communication`,
    'Environment & Physical Safety': `Help ${firstName} ${action || 'stay Safe & Secure'}`,
    'Adaptive Living Environment': `Support ${firstName} in their Home`,
    'Skin Integrity & Pressure Care': `Skin & Pressure Care for ${firstName}`,
    'Financial Management & Autonomy': `Support ${firstName} with Finances`,
    'Rights, Choice & Inclusion': `Support ${firstName}'s Rights & Choices`,
    'Holistic Health & Vitality': `Health & Vitality Check for ${firstName}`,
    'Respiratory Health & Support': `Support ${firstName}'s Respiratory Health`,
    'Cultural, Spiritual & Personal Beliefs': `Support ${firstName}'s Beliefs & Culture`,
    'Intimacy & Personal Expression': `Support ${firstName}'s Personal Expression`,
  };

  return taskNames[title] || `${title} (${firstName})`;
}

function buildTaskNotes(domain: CarePlanDomain, clientName: string): string {
  const firstName = clientName.split(' ')[0] || 'the person';
  const sourceText = [
    domain.identifiedNeed,
    domain.howToAchieve,
    domain.plannedOutcomes,
    domain.riskTitle,
    domain.riskMitigation,
  ].join(' ');
  const logic = domainTaskLogic(domain.title, sourceText);
  const cues = extractSourceCues(sourceText);
  const parts: string[] = [];

  // Purpose: use the actual identified need — why this task exists for this person
  const need = firstSentence(domain.identifiedNeed || '', 220);
  parts.push(`Purpose: ${need || logic.purpose}`);

  // Staff action: use the agreed support method from the care plan, template as fallback
  const agreedMethod = cleanLine(domain.howToAchieve || '', 400);
  parts.push(`Staff action: ${agreedMethod || logic.action}`);

  // Watch for: surface the actual risk title + mitigation, then escalation guidance
  const riskTitle = (domain.riskTitle || '').trim();
  const mitigation = firstSentence(domain.riskMitigation || '', 200);
  if (riskTitle) {
    const riskDetail = mitigation ? `${riskTitle} — ${mitigation}` : riskTitle;
    parts.push(`Watch for: ${riskDetail}. ${logic.watch}`);
  } else {
    parts.push(`Watch for: ${logic.watch}`);
  }

  if (cues.length) parts.push(`Source cues: ${cues.join(', ')}.`);
  parts.push('Record: support offered; accepted/declined; outcome; risk or presentation change; escalation/follow-up.');
  parts.push(`Avoid: "done", "all fine", "support given" — ${firstName} deserves a full account of what was offered and how they responded.`);
  return parts.join('\n');
}

function collectEvidence(domain: CarePlanDomain): string[] {
  return [
    fieldSummary('Need', domain.identifiedNeed, 220),
    fieldSummary('Risk', domain.riskTitle, 160),
    fieldSummary('Mitigation', domain.riskMitigation, 220),
    fieldSummary('Support method', domain.howToAchieve, 220),
  ].filter(Boolean) as string[];
}

function generateTasksFromCarePlan(client: FullClient): NourishTask[] {
  if (!client.carePlan?.domains) return [];

  const enabledDomains = client.carePlan.domains.filter(d => d.enabled);
  if (enabledDomains.length === 0) return [];

  return enabledDomains
    .map(domain => {
      const evidence = collectEvidence(domain);
      const notes = buildTaskNotes(domain, client.name);
      const frequency = inferFrequency(domain.title);
      const name = buildTaskName(domain, client.name);
      const mandatory = isMandatoryTask(domain.title, notes);
      const source = `Care Plan - ${domain.title}${domain.riskTitle ? ` / Risk: ${domain.riskTitle}` : ''}`;

      return {
        id: `cp-${client.id}-${domain.title.replace(/\s+/g, '-')}`,
        name, notes, frequency, mandatory, source, domain: domain.title, evidence,
      };
    })
    .filter(task => task.evidence.length > 0);
}

function generateTasksFromRiskAssessment(client: FullClient): NourishTask[] {
  const risk = client.risk;
  if (!risk?.risks?.length) return [];

  return risk.risks
    .filter(r => (r.title || '').trim().length > 0)
    .map(riskItem => {
      const controls = (riskItem.controls || []).map(c => cleanLine(c, 120)).filter(Boolean);
      const description = cleanLine(riskItem.description, 160);
      const notesLines: string[] = [];
      if (description) notesLines.push(`Risk context: ${description}`);
      if (controls.length) notesLines.push(`Controls: ${controls.slice(0, 2).join(' | ')}`);
      notesLines.push('Evidence required: trigger observed, immediate action taken, client response, who was informed, and whether the risk reduced/escalated.');

      return {
        id: `risk-${riskItem.title.replace(/\s+/g, '-')}`,
        name: `Risk Response - ${cleanLine(riskItem.title, 72)}`,
        notes: notesLines.join('\n'),
        frequency: 'event' as TaskFrequency,
        mandatory: true,
        source: `Risk Assessment - ${riskItem.title}`,
        domain: 'Risk Assessment',
        evidence: [
          `Risk: ${riskItem.title}`,
          ...controls.map(c => `Control: ${c}`),
        ],
      };
    });
}

function generateTasksFromSupportPlan(client: FullClient): NourishTask[] {
  const needs = client.supportPlan?.needs || [];
  if (!needs.length) return [];
  const firstName = client.name.split(' ')[0] || 'the person';

  return needs
    .filter(need => (need.area || '').trim().length > 0)
    .map(need => {
      const area = cleanLine(need.area, 90);
      const sourceText = [need.canDoMyself, need.howToSupport, need.risks].join(' ');
      const logic = domainTaskLogic(area, sourceText);
      const cues = extractSourceCues(sourceText);

      // Person-centred: use what's in the plan directly
      const canDo = firstSentence(need.canDoMyself || '', 200);
      const howTo = cleanLine(need.howToSupport || '', 400);
      const riskContext = firstSentence(need.risks || '', 200);

      const notes: string[] = [
        `Purpose: ${canDo || logic.purpose}`,
        `Staff action: ${howTo || logic.action}`,
        riskContext
          ? `Watch for: ${riskContext}. ${logic.watch}`
          : `Watch for: ${logic.watch}`,
      ];
      if (cues.length) notes.push(`Source cues: ${cues.join(', ')}.`);
      notes.push('Record: support offered; accepted/declined; outcome; risk or presentation change; escalation/follow-up.');
      notes.push(`Avoid: "done", "all fine", "support given" — ${firstName} deserves a full account of what was offered and how they responded.`);

      const mandatory = /risk|safeguard|medication|aggress|falls|self-harm|incident/i.test(sourceText);

      return {
        id: `sp-${area.replace(/\s+/g, '-')}`,
        name: `Support Plan - ${area}`,
        notes: notes.join('\n'),
        frequency: inferFrequency(area),
        mandatory,
        source: `Support Plan - ${area}`,
        domain: area,
        evidence: [
          need.canDoMyself ? `Need: ${cleanLine(need.canDoMyself, 180)}` : '',
          need.howToSupport ? `Support method: ${cleanLine(need.howToSupport, 180)}` : '',
          need.risks ? `Risk: ${cleanLine(need.risks, 150)}` : '',
        ].filter(Boolean),
      };
    });
}

function matchingEvidence(text: string, keywords: string[]): string[] {
  const chunks = text
    .split(/(?:\r?\n|(?<=[.!?])\s+)/)
    .map(chunk => cleanLine(chunk, 220))
    .filter(Boolean);
  const matches = chunks.filter(chunk => hasAny(chunk, keywords));
  return matches.slice(0, 3).map(chunk => `Vault evidence: ${chunk}`);
}

function generateTasksFromVaultDocs(client: FullClient): NourishTask[] {
  const docs = client.vaultDocs || [];
  if (!docs.length) return [];

  const tasks: NourishTask[] = [];
  for (const doc of docs) {
    const text = cleanLine(doc.text, 12000);
    if (text.length < 20) continue;

    for (const spec of VAULT_DOMAIN_SPECS) {
      if (!hasAny(text, spec.keywords)) continue;

      const evidence = matchingEvidence(text, spec.keywords);
      if (!evidence.length) continue;

      const sourceText = evidence.join(' ');
      const logic = domainTaskLogic(spec.title, sourceText);
      const cues = extractSourceCues(sourceText);
      const notes = [
        `Purpose: ${logic.purpose}`,
        `Staff action: ${logic.action}`,
        `Watch for: ${logic.watch}`,
        cues.length ? `Source cues: ${cues.join(', ')}.` : '',
        'Record: support offered; accepted/declined; outcome; risk or presentation change; escalation/follow-up.',
        'Avoid: converting vault text into a task unless staff can evidence the support actually offered.',
      ].filter(Boolean).join('\n');

      tasks.push({
        id: `vault-${doc.id}-${spec.title.replace(/\s+/g, '-')}`,
        name: buildTaskName({ title: spec.title, identifiedNeed: sourceText }, client.name),
        notes,
        frequency: inferFrequency(spec.title),
        mandatory: isMandatoryTask(spec.title, `${notes} ${sourceText}`),
        source: `Intelligence Vault - ${doc.name}`,
        domain: spec.title,
        evidence,
      });
    }
  }

  return tasks;
}

function dedupeTasks(tasks: NourishTask[]): NourishTask[] {
  const seen = new Set<string>();
  const out: NourishTask[] = [];
  for (const task of tasks) {
    const key = task.name.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(task);
  }
  return out;
}

export function clientHasTaskSources(client: FullClient): boolean {
  return (
    !!client.carePlan?.domains?.some(d => d.enabled) ||
    !!client.supportPlan?.needs?.some(n => (n.area || '').trim().length > 0) ||
    !!client.risk?.risks?.some(r => (r.title || '').trim().length > 0) ||
    !!client.vaultDocs?.some(doc => cleanLine(doc.text, 80).length > 0)
  );
}

export function generateTasksForClient(client: FullClient): NourishTask[] {
  const fromCarePlan = generateTasksFromCarePlan(client);
  const fromRisk = generateTasksFromRiskAssessment(client);
  const fromSupportPlan = generateTasksFromSupportPlan(client);
  const fromVaultDocs = generateTasksFromVaultDocs(client);
  return dedupeTasks([...fromCarePlan, ...fromRisk, ...fromSupportPlan, ...fromVaultDocs]).filter(task => task.evidence.length > 0);
}

export function formatForExport(client: FullClient, tasks: NourishTask[]): string {
  const daily = tasks.filter(t => t.frequency === 'daily');
  const weekly = tasks.filter(t => t.frequency === 'weekly');
  const event = tasks.filter(t => t.frequency === 'event');
  const date = new Date().toLocaleDateString('en-GB');

  let out = `NOTE TITLE: Care Ops Personalised Tasks (Care Plan Aligned) - ${client.name}\n`;
  out += `Generated: ${date} | Source: Care Ops - Care Plan Builder\n\n`;
  out += `PURPOSE\n`;
  out += `These tasks are derived directly from ${client.name}'s current care plans, support plans, risk assessments and attached source documents to show what support needs to happen and how it should be evidenced.\n\n`;
  out += `RULES\n`;
  out += `- Build as client task records in CareOps or the chosen care/task system.\n`;
  out += `- Set Task Notes mandatory for all tasks marked [MANDATORY].\n`;
  out += `- Staff must record what was offered, accepted/declined, outcome, and escalation.\n`;
  out += `- Do not change tasks without updating the underlying care plan/risk assessment first.\n`;
  out += `- Do not create tasks without evidence from care plan, support plan, risk fields, or attached client source documents.\n\n`;

  function section(title: string, list: NourishTask[]) {
    if (!list.length) return;
    out += `-----------------------------------------------------\n`;
    out += `${title.toUpperCase()} (${list.length})\n`;
    out += `-----------------------------------------------------\n\n`;

    list.forEach((t, i) => {
      out += `${i + 1}. ${t.name}${t.mandatory ? ' [MANDATORY]' : ''}\n`;
      out += `Frequency: ${t.frequency}\n`;
      out += `Source: ${t.source}\n`;
      out += `Task Notes:\n${t.notes}\n`;
      if (t.evidence.length) {
        out += `Evidence:\n`;
        t.evidence.forEach(ev => { out += `   - ${ev}\n`; });
      }
      out += `\n`;
    });
  }

  section('Daily Tasks', daily);
  section('Weekly Tasks', weekly);
  section('Event Driven / Trigger Tasks', event);

  out += `-----------------------------------------------------\n`;
  out += `REVIEW\n`;
  out += `Review tasks at the next scheduled care plan review, or sooner if there is a significant change in risk, presentation, medication, or environmental safety.\n`;

  return out;
}
