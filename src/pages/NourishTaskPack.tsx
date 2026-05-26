import { useState, useMemo, useEffect, type MouseEvent } from 'react';
import { loadClients, saveClient, type FullClient, type CarePlanDomain, type VaultDoc } from '../lib/client-store';
import { runTaskStressTest } from '../lib/stress-test-tasks';
import {
  ClipboardList, Copy, Check, ChevronDown, ChevronRight,
  User, Calendar, AlertTriangle, Clock, Zap, FileText,
  Download, RefreshCw, Paperclip, Sparkles, Send, X
} from 'lucide-react';
import { extractFileText } from '../lib/universal-extractor';
import { 
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageNumber
} from 'docx';

// ─────────────────────────────────────────────────────────────────────────────
// TASK GENERATION ENGINE
// Maps care plan domains → Nourish task definitions
// ─────────────────────────────────────────────────────────────────────────────

type TaskFrequency = 'daily' | 'weekly' | 'event';

interface NourishTask {
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

function inferFrequency(domainTitle: string): TaskFrequency {
  const lower = domainTitle.toLowerCase();
  if (EVENT_DOMAIN_KEYWORDS.some(k => lower.includes(k))) return 'event';
  if (WEEKLY_DOMAIN_KEYWORDS.some(k => lower.includes(k))) return 'weekly';
  if (DAILY_DOMAIN_KEYWORDS.some(k => lower.includes(k))) return 'daily';
  return 'daily'; // default
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

function buildTaskName(domain: CarePlanDomain, clientName: string): string {
  const title = domain.title;
  const firstName = clientName.split(' ')[0] || 'Client';
  
  // Try to find a specific action word from the identified need to make it less generic
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

function buildTaskNotes(domain: CarePlanDomain): string {
  const needLine = cleanLine(domain.identifiedNeed, 1000);
  const supportLine = cleanLine(domain.howToAchieve || domain.plannedOutcomes, 1000);
  const riskLine = cleanLine(domain.riskMitigation || domain.riskTitle, 1000);
  const parts: string[] = [];
  if (needLine) parts.push(`Need: ${needLine}`);
  if (supportLine) parts.push(`Support: ${supportLine}`);
  if (riskLine) parts.push(`Watch for: ${riskLine}`);
  parts.push('Evidence required: record the support offered, the response, anything declined, the outcome, and any change in risk/presentation. Do not write generic entries such as "done", "all fine", or "support given" without the facts.');
  return parts.join('\n');
}

function collectEvidence(domain: CarePlanDomain): string[] {
  const evidence: string[] = [];
  if (domain.identifiedNeed?.trim()) evidence.push(`Need: ${domain.identifiedNeed.trim()}`);
  if (domain.riskTitle?.trim()) evidence.push(`Risk: ${domain.riskTitle.trim()}`);
  if (domain.riskDescription?.trim()) evidence.push(`Risk detail: ${domain.riskDescription.trim()}`);
  if (domain.riskMitigation?.trim()) evidence.push(`Mitigation: ${domain.riskMitigation.trim()}`);
  if (domain.howToAchieve?.trim()) evidence.push(`Support method: ${domain.howToAchieve.trim()}`);
  return evidence;
}

function generateTasksFromCarePlan(client: FullClient): NourishTask[] {
  if (!client.carePlan?.domains) return [];

  const enabledDomains = client.carePlan.domains.filter(d => d.enabled);
  if (enabledDomains.length === 0) return [];

  return enabledDomains
    .map(domain => {
      const evidence = collectEvidence(domain);
      const notes = buildTaskNotes(domain);
      const frequency = inferFrequency(domain.title);
      const name = buildTaskName(domain, client.name);
      const mandatory = isMandatoryTask(domain.title, notes);
      const source = `Care Plan - ${domain.title}${domain.riskTitle ? ` / Risk: ${domain.riskTitle}` : ''}`;

      return { 
        id: `cp-${domain.title.replace(/\s+/g, '-')}`,
        name, notes, frequency, mandatory, source, domain: domain.title, evidence 
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

  return needs
    .filter(need => (need.area || '').trim().length > 0)
    .map(need => {
      const area = cleanLine(need.area, 90);
      const support = cleanLine(need.howToSupport || need.canDoMyself, 170);
      const risk = cleanLine(need.risks, 140);
      const notes: string[] = [];
      if (support) notes.push(`Support: ${support}`);
      if (risk) notes.push(`Risk focus: ${risk}`);
      notes.push('Evidence required: what staff offered/did, what the client accepted or declined, outcome, and any escalation or follow-up.');

      const sourceText = [need.canDoMyself, need.howToSupport, need.risks].join(' ').toLowerCase();
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

function generateTasksForClient(client: FullClient): NourishTask[] {
  const fromCarePlan = generateTasksFromCarePlan(client);
  const fromRisk = generateTasksFromRiskAssessment(client);
  const fromSupportPlan = generateTasksFromSupportPlan(client);
  return dedupeTasks([...fromCarePlan, ...fromRisk, ...fromSupportPlan]).filter(task => task.evidence.length > 0);
}

function formatForExport(client: FullClient, tasks: NourishTask[]): string {
  const daily = tasks.filter(t => t.frequency === 'daily');
  const weekly = tasks.filter(t => t.frequency === 'weekly');
  const event = tasks.filter(t => t.frequency === 'event');
  const date = new Date().toLocaleDateString('en-GB');

  let out = `NOTE TITLE: CareOps Personalised Tasks (Care Plan Aligned) - ${client.name}\n`;
  out += `Generated: ${date} | Source: CareOps - Care Plan Builder\n\n`;
  out += `PURPOSE\n`;
  out += `These tasks are derived directly from ${client.name}'s current care plans, support plans and risk assessments to show what support needs to happen and how it should be evidenced.\n\n`;
  out += `RULES\n`;
  out += `- Build as Client Tasks in Nourish.\n`;
  out += `- Set Task Notes mandatory for all tasks marked [MANDATORY].\n`;
  out += `- Keep notes short enough for staff to use on shift.\n`;
  out += `- Do not change tasks without updating the underlying care plan/risk assessment first.\n`;
  out += `- Do not create tasks without evidence from care plan, support plan, or risk fields.\n\n`;
  out += `-----------------------------------------------------\n`;

  if (daily.length > 0) {
    out += `DAILY TASKS\n\n`;
    daily.forEach((t, i) => {
      out += `${i + 1}. Task name: ${t.name}${t.mandatory ? ' [MANDATORY]' : ''}\n`;
      out += `   Frequency: Daily\n`;
      out += `   Task Notes: ${t.notes.replace(/\n/g, '\n   ')}\n`;
      out += `   Source: ${t.source}\n`;
      if (t.evidence.length) {
        out += `   Evidence:\n`;
        t.evidence.forEach(ev => { out += `   - ${ev}\n`; });
      }
      out += `\n`;
    });
  }

  if (weekly.length > 0) {
    out += `WEEKLY TASKS\n\n`;
    weekly.forEach((t, i) => {
      out += `${i + 1}. Task name: ${t.name}${t.mandatory ? ' [MANDATORY]' : ''}\n`;
      out += `   Frequency: Weekly\n`;
      out += `   Task Notes: ${t.notes.replace(/\n/g, '\n   ')}\n`;
      out += `   Source: ${t.source}\n`;
      if (t.evidence.length) {
        out += `   Evidence:\n`;
        t.evidence.forEach(ev => { out += `   - ${ev}\n`; });
      }
      out += `\n`;
    });
  }

  if (event.length > 0) {
    out += `EVENT-DRIVEN TASKS (create only when triggered)\n\n`;
    event.forEach((t, i) => {
      out += `${i + 1}. Task name: ${t.name}\n`;
      out += `   Frequency: When triggered\n`;
      out += `   Task Notes: ${t.notes.replace(/\n/g, '\n   ')}\n`;
      out += `   Source: ${t.source}\n`;
      if (t.evidence.length) {
        out += `   Evidence:\n`;
        t.evidence.forEach(ev => { out += `   - ${ev}\n`; });
      }
      out += `\n`;
    });
  }

  out += `-----------------------------------------------------\n`;
  out += `REVIEW\n`;
  out += `Review tasks at the next scheduled care plan review, or sooner if there is a significant change in risk, presentation, medication, or environmental safety.\n`;

  return out;
}

// DOCX Generation Helper
async function generateBeautifulDocx(client: FullClient, tasks: NourishTask[]) {
  const daily = tasks.filter(t => t.frequency === 'daily');
  const weekly = tasks.filter(t => t.frequency === 'weekly');
  const event = tasks.filter(t => t.frequency === 'event');
  const dateStr = new Date().toLocaleDateString('en-GB');

  const border = { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" };
  const cellMargins = { top: 120, bottom: 120, left: 180, right: 180 };

  const buildTaskRows = (taskList: NourishTask[], label: string) => {
    if (taskList.length === 0) return [];
    
    const rows = [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
            margins: cellMargins,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: label, bold: true, size: 20, color: "4B5563" })
                ]
              })
            ]
          })
        ]
      })
    ];

    taskList.forEach((t, i) => {
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2500, type: WidthType.DXA },
              borders: { bottom: border, right: border },
              margins: cellMargins,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${i + 1}. ${t.name}`, bold: true, size: 22, color: "111827" }),
                    ...(t.mandatory ? [new TextRun({ text: "\n[MANDATORY]", bold: true, size: 16, color: "EF4444" })] : [])
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 7500, type: WidthType.DXA },
              borders: { bottom: border },
              margins: cellMargins,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "TASK NOTES INSTRUCTION:", bold: true, size: 16, color: "9CA3AF" })
                  ],
                  spacing: { after: 120 }
                }),
                ...t.notes.split('\n').map(line => new Paragraph({
                  children: [new TextRun({ text: line, size: 20, color: "374151" })],
                  spacing: { after: 80 }
                }))
              ]
            })
          ]
        })
      );
    });

    return rows;
  };

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 24 } } }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "HAZEL CARE LTD - OPERATIONS HUB", bold: true, size: 18, color: "0D9488" })
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Page ", size: 16, color: "9CA3AF" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "9CA3AF" }),
                new TextRun({ text: " | Generated: " + dateStr, size: 16, color: "9CA3AF" })
              ]
            })
          ]
        })
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({ text: client.name, bold: true, size: 40, color: "111827" })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Full Task Pack for Nourish / Care System Entry", size: 24, color: "6B7280" })
          ],
          spacing: { after: 400 }
        }),
        new Table({
          width: { size: 10000, type: WidthType.DXA },
          rows: [
            ...buildTaskRows(daily, "DAILY TASKS"),
            ...buildTaskRows(weekly, "WEEKLY TASKS"),
            ...buildTaskRows(event, "EVENT-DRIVEN TASKS")
          ]
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Nourish-Task-Pack-${client.name.replace(/\s+/g, '-')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// COMPONENTS
const FREQ_CONFIG = {
  daily: { label: 'Daily', icon: <Clock size={12} />, color: 'text-hc-teal', bg: 'bg-hc-teal/10 border-hc-teal/20' },
  weekly: { label: 'Weekly', icon: <Calendar size={12} />, color: 'text-flag-amber', bg: 'bg-flag-amber/10 border-flag-amber/20' },
  event: { label: 'Event-Driven', icon: <Zap size={12} />, color: 'text-flag-red', bg: 'bg-flag-red/10 border-flag-red/20' },
};

function TaskCard({ task, index, onUpdate }: { task: NourishTask; index: number, onUpdate?: (id: string, notes: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<'name' | 'notes' | ''>('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(task.notes);
  const freq = FREQ_CONFIG[task.frequency];

  const copyValue = async (kind: 'name' | 'notes', text: string, e?: MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied((current) => (current === kind ? '' : current)), 1500);
  };

  return (
    <div className={`hc-clay-raised rounded-2xl overflow-hidden border ${task.mandatory ? 'border-flag-red/20' : 'border-hc-border/5'} transition-all`}>
      <div
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-all cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((current) => !current);
          }
        }}
      >
        {/* Index */}
        <span className="w-6 h-6 rounded-lg hc-clay-inset flex items-center justify-center text-[10px] font-black text-hc-muted shrink-0 mt-0.5">
          {index}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-hc-text uppercase tracking-wide">{task.name}</span>
            {task.mandatory && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-flag-red/10 border border-flag-red/20 text-[9px] font-black text-flag-red uppercase tracking-widest">
                <AlertTriangle size={8} /> Mandatory Notes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              onClick={(e) => copyValue('name', task.name, e)}
              className="px-2.5 py-1 rounded-lg hc-clay-inset text-[9px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-teal transition-colors"
            >
              {copied === 'name' ? 'Copied name' : 'Copy name'}
            </button>
            <button
              onClick={(e) => copyValue('notes', task.notes, e)}
              className="px-2.5 py-1 rounded-lg hc-clay-inset text-[9px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-teal transition-colors"
            >
              {copied === 'notes' ? 'Copied notes' : 'Copy notes'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${freq.bg} ${freq.color}`}>
              {freq.icon} {freq.label}
            </span>
            <span className="text-[9px] text-hc-muted break-words">{task.source}</span>
          </div>
        </div>

        <span className="text-hc-muted shrink-0 mt-1">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-hc-border/10 pt-3 animate-in slide-in-from-top-2 duration-200">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest">Task Notes Instruction</div>
              <button 
                onClick={() => setEditingNotes(!editingNotes)}
                className="text-[8px] font-black text-hc-teal uppercase tracking-widest hover:underline"
              >
                {editingNotes ? 'Preview' : 'Edit Manually'}
              </button>
            </div>
            
            {editingNotes ? (
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => onUpdate?.(task.id, notesDraft)}
                rows={5}
                className="w-full hc-clay-inset rounded-xl p-3 text-[11px] text-hc-text bg-hc-surface font-mono outline-none focus:ring-1 focus:ring-hc-teal/30"
              />
            ) : (
              <div className="hc-clay-inset rounded-xl p-3 text-[11px] text-hc-text/80 leading-relaxed whitespace-pre-line">
                {task.notes}
              </div>
            )}
            
            <button
              onClick={(e) => copyValue('notes', task.notes, e)}
              className="mt-2 text-[9px] font-black uppercase tracking-widest text-hc-teal hover:underline"
            >
              {copied === 'notes' ? 'Copied notes' : 'Copy notes'}
            </button>
          </div>
          <div>
            <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Source</div>
            <div className="text-[10px] text-hc-muted font-bold">{task.source}</div>
          </div>
          {task.evidence.length > 0 && (
            <div>
              <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Evidence</div>
              <ul className="list-disc pl-4 space-y-1 text-[10px] text-hc-muted">
                {task.evidence.map((ev, i) => (
                  <li key={i}>{ev}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FreqSection({
  label, tasks, freq, icon, onTaskUpdate
}: {
  label: string;
  tasks: NourishTask[];
  freq: TaskFrequency;
  icon: React.ReactNode;
  onTaskUpdate?: (id: string, notes: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const cfg = FREQ_CONFIG[freq];

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-1"
      >
        <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>
          {icon} {label}
          <span className="ml-1 px-1.5 py-0.5 rounded-full hc-clay-inset text-hc-muted text-[9px]">
            {tasks.length}
          </span>
        </span>
        <div className="flex-1 h-px bg-hc-border/10" />
        <ChevronDown size={12} className={`text-hc-muted transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
          {tasks.map((t, i) => (
            <TaskCard key={`${freq}-${i}`} task={t} index={i + 1} onUpdate={onTaskUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function NourishTaskPack() {
  const [clients, setClients] = useState<FullClient[]>(() => loadClients());
  const clientHasTaskSources = (client: FullClient) =>
    !!client.carePlan?.domains?.some(d => d.enabled) ||
    !!client.supportPlan?.needs?.some(n => (n.area || '').trim().length > 0) ||
    !!client.risk?.risks?.some(r => (r.title || '').trim().length > 0);
  
  const [selectedId, setSelectedId] = useState<string>(() => {
    const first = clients.find(c => clientHasTaskSources(c));
    return first?.id || clients[0]?.id || '';
  });

  const [copied, setCopied] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importInfo, setImportInfo] = useState('');
  const [refineInput, setRefineInput] = useState('');
  const [refining, setRefining] = useState(false);
  const [refinementResult, setRefinementResult] = useState('');

  useEffect(() => {
    const syncClients = () => setClients(loadClients());
    syncClients();
    window.addEventListener('storage', syncClients);
    window.addEventListener('hc-clients-updated', syncClients);
    return () => {
      window.removeEventListener('storage', syncClients);
      window.removeEventListener('hc-clients-updated', syncClients);
    };
  }, []);

  useEffect(() => {
    if (selectedId && clients.some(c => c.id === selectedId)) return;
    const fallback = clients.find(c => clientHasTaskSources(c)) || clients[0];
    if (fallback) setSelectedId(fallback.id);
  }, [clients, selectedId]);

  // STRESS TEST HANDLER
  const triggerStressTest = async () => {
    try {
      const stressClient = await runTaskStressTest();
      setClients(prev => [stressClient, ...prev]);
      setSelectedId(stressClient.id);
      setImportInfo('STRESS TEST ACTIVE: 1,000 TASKS INJECTED');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Stress test failed');
    }
  };

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedId) || null,
    [clients, selectedId]
  );

  // Local state for manually overridden tasks or refined results
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setManualOverrides({});
    setRefinementResult('');
  }, [selectedId]);

  const tasks = useMemo(() => {
    if (!selectedClient) return [];
    const baseTasks = generateTasksForClient(selectedClient);
    return baseTasks.map(t => ({
      ...t,
      notes: manualOverrides[t.id] || t.notes
    }));
  }, [selectedClient, manualOverrides]);

  const daily = tasks.filter(t => t.frequency === 'daily');
  const weekly = tasks.filter(t => t.frequency === 'weekly');
  const event = tasks.filter(t => t.frequency === 'event');

  const exportText = useMemo(
    () => (selectedClient ? formatForExport(selectedClient, tasks) : ''),
    [selectedClient, tasks]
  );

  const handleCopy = async () => {
    if (!exportText) return;
    await navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDocxExport = async () => {
    if (!selectedClient || tasks.length === 0) return;
    try {
      await generateBeautifulDocx(selectedClient, tasks);
    } catch (e) {
      console.error('DOCX Export Failed:', e);
      alert('Failed to generate Word document. Falling back to text download.');
      handleDownloadTxt();
    }
  };

  const handleDownloadTxt = () => {
    if (!exportText || !selectedClient) return;
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nourish-task-pack-${selectedClient.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTaskUpdate = (id: string, notes: string) => {
    setManualOverrides(prev => ({ ...prev, [id]: notes }));
  };

  const handleVaultUpload = async (file: File) => {
    if (!selectedClient) return;
    setImportLoading(true);
    setImportInfo(`Absorbing ${file.name}...`);
    try {
      const text = await extractFileText(file);
      const clientsList = loadClients();
      const profile = clientsList.find(c => c.id === selectedId);
      if (!profile) return;
      
      const newDoc: VaultDoc = {
        id: `vault-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        text,
        uploadedAt: new Date().toISOString(),
      };
      
      profile.vaultDocs = [...(profile.vaultDocs || []), newDoc];
      saveClient(profile);
      setImportInfo(`Intelligence updated with ${file.name}`);
    } catch (e) {
      setImportInfo(`Import failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleRemoveDoc = (docId: string) => {
    if (!selectedClient) return;
    const profile = clients.find(c => c.id === selectedId);
    if (!profile) return;
    profile.vaultDocs = (profile.vaultDocs || []).filter(d => d.id !== docId);
    saveClient(profile);
    setImportInfo('Document removed');
  };

  const runAIRefinement = async () => {
    if (!refineInput.trim() || !selectedClient) return;
    setRefining(true);
    try {
      const res = await fetch('/api/staff/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: formatForExport(selectedClient, tasks),
          noteType: 'Nourish Task Pack',
          clientName: selectedClient.name,
          refineInstructions: `Update this task pack based on: ${refineInput}. Return the full updated pack.`,
          includeEvidenceTrail: false,
        })
      });

      const draft = await res.text();
      if (!res.ok) throw new Error(draft || 'AI at capacity');
      setRefinementResult(draft.trim());
    } catch (error) {
      setRefinementResult(error instanceof Error ? error.message : 'Refinement failed. Try a smaller request.');
    } finally {
      setRefining(false);
      setRefineInput('');
    }
  };

  const clientsWithPlans = clients.filter(c => clientHasTaskSources(c));
  return (
    <div className="flex h-full min-h-screen flex-col lg:flex-row">

      {/* ── LEFT: Client picker ── */}
      <aside className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-hc-border/10 p-4 space-y-6 overflow-y-auto bg-hc-surface/30 max-h-[42vh] lg:max-h-none">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-hc-teal" />
            <span className="text-[10px] font-black text-hc-teal uppercase tracking-widest">Select Client</span>
          </div>

          <div className="space-y-1">
            {clientsWithPlans.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedId(c.id); setManualOverrides({}); }}
                className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center justify-between gap-2 group ${
                  selectedId === c.id
                    ? 'hc-clay-pressed text-hc-teal'
                    : 'text-hc-text/60 hover:text-hc-text hover:hc-clay-raised'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <User size={12} className="shrink-0 opacity-60" />
                  <span className="text-[10px] font-black uppercase tracking-wide truncate">{c.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Intelligence Vault Section */}
        {selectedClient && (
          <div className="pt-6 border-t border-hc-border/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip size={14} className="text-hc-teal" />
                <span className="text-[9px] font-black text-hc-teal uppercase tracking-widest">Intelligence Vault</span>
              </div>
              <label className="cursor-pointer p-1.5 rounded-lg hc-clay-raised hover:text-hc-teal transition-colors">
                <RefreshCw size={12} className={importLoading ? 'animate-spin' : ''} />
                <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleVaultUpload(e.target.files[0])} />
              </label>
            </div>

            <div className="space-y-2">
              {(selectedClient.vaultDocs || []).map(doc => (
                <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-hc-surface/50 border border-hc-border/5 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={10} className="text-hc-muted shrink-0" />
                    <span className="text-[9px] font-bold text-hc-text truncate">{doc.name}</span>
                  </div>
                  <button onClick={() => handleRemoveDoc(doc.id)} className="opacity-0 group-hover:opacity-100 p-1 text-flag-red hover:bg-flag-red/10 rounded-md transition-all">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {(!selectedClient.vaultDocs || selectedClient.vaultDocs.length === 0) && (
                <div className="text-center py-4 border border-dashed border-hc-border/20 rounded-2xl">
                  <p className="text-[8px] text-hc-muted uppercase tracking-widest">No additional intel</p>
                </div>
              )}
            </div>
            {importInfo && <p className="text-[8px] text-hc-teal italic">{importInfo}</p>}
          </div>
        )}
      </aside>

      {/* ── RIGHT: Task pack ── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-52 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 
              onClick={(e) => e.detail === 3 && triggerStressTest()}
              className="text-[11px] font-black text-hc-teal uppercase tracking-widest mb-1 cursor-default select-none"
              title="Double-click for info, Triple-click for Stress Test"
            >
              Nourish Task Pack Generator
            </h1>
            <p className="text-[10px] text-hc-muted font-bold">
              {selectedClient
                ? `${tasks.length} tasks derived from ${selectedClient.name}'s care plan + risk assessment`
                : 'Select a client to generate their care/risk aligned task pack'}
            </p>
          </div>

          {tasks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleDocxExport}
                className="flex items-center gap-2 px-4 py-2.5 bg-hc-teal text-hc-bone rounded-xl text-[10px] font-black hover:bg-hc-teal-dark transition-all uppercase tracking-widest shadow-lg"
              >
                <Download size={13} /> Beautiful Doc (.docx)
              </button>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  copied
                    ? 'bg-hc-teal/20 text-hc-teal border border-hc-teal/30'
                    : 'hc-clay-raised text-hc-muted hover:text-hc-teal'
                }`}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy All'}
              </button>
            </div>
          )}
        </div>

        {selectedClient && tasks.length > 0 && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Tasks', value: tasks.length, color: 'text-hc-text' },
                { label: 'Daily', value: daily.length, color: 'text-hc-teal' },
                { label: 'Weekly', value: weekly.length, color: 'text-flag-amber' },
                { label: 'Event-Driven', value: event.length, color: 'text-flag-red' },
              ].map(s => (
                <div key={s.label} className="hc-clay-raised rounded-2xl p-4 text-center">
                  <div className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</div>
                  <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Task sections */}
            <div className="space-y-6">
              <FreqSection
                label="Daily Tasks"
                tasks={daily}
                freq="daily"
                icon={<Clock size={12} />}
                onTaskUpdate={handleTaskUpdate}
              />
              <FreqSection
                label="Weekly Tasks"
                tasks={weekly}
                freq="weekly"
                icon={<Calendar size={12} />}
                onTaskUpdate={handleTaskUpdate}
              />
              <FreqSection
                label="Event-Driven Tasks"
                tasks={event}
                freq="event"
                icon={<Zap size={12} />}
                onTaskUpdate={handleTaskUpdate}
              />
            </div>
          </>
        )}
      </main>

      {/* AI Refinement Interaction Layer */}
      {selectedClient && tasks.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 lg:bottom-6 lg:right-6 lg:left-[20rem] z-50">
          <div className="max-w-4xl mx-auto hc-clay-raised rounded-3xl p-3 border border-hc-teal/20 backdrop-blur-xl bg-hc-surface/90 space-y-3">
            {refinementResult && (
              <div className="rounded-2xl border border-hc-teal/20 bg-hc-teal/5 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-hc-teal">AI draft ready</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(refinementResult)}
                    className="text-[9px] font-black uppercase tracking-widest text-hc-teal hover:underline"
                  >
                    Copy draft
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto whitespace-pre-wrap text-[10px] leading-relaxed text-hc-text/80">
                  {refinementResult}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Sparkles size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 text-hc-teal ${refining ? 'animate-spin' : ''}`} />
              <input
                value={refineInput}
                onChange={e => setRefineInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runAIRefinement()}
                placeholder="Ask for a task-pack refinement..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl hc-clay-inset bg-transparent text-[11px] font-bold text-hc-text outline-none placeholder:text-hc-muted/50"
              />
            </div>
            <button
              onClick={runAIRefinement}
              disabled={!refineInput.trim() || refining}
              className="p-3 rounded-2xl bg-hc-teal text-hc-bone hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:grayscale"
            >
              {refining ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




