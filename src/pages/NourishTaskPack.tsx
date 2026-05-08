import { useState, useMemo } from 'react';
import { loadClients, type FullClient, type CarePlanDomain } from '../lib/client-store';
import {
  ClipboardList, Copy, Check, ChevronDown, ChevronRight,
  User, Calendar, AlertTriangle, Clock, Zap, FileText,
  Download, RefreshCw, Info
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TASK GENERATION ENGINE
// Maps care plan domains → Nourish task definitions
// ─────────────────────────────────────────────────────────────────────────────

type TaskFrequency = 'daily' | 'weekly' | 'event';

interface NourishTask {
  name: string;
  notes: string;
  frequency: TaskFrequency;
  mandatory: boolean;
  source: string;
  domain: string;
  evidence: string[];
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

function buildTaskName(domain: CarePlanDomain): string {
  const title = domain.title;
  // Build a human task name from the domain title
  const taskNames: Record<string, string> = {
    'Medication Management & Safety': 'Medication — Administer & MAR Record',
    'Mental Health & Emotional Wellbeing': 'Mental Health Check-In',
    'Personal Care & Physical Presentation': 'Personal Care Prompt (Wash / Dress)',
    'Continence & Personal Hygiene': 'Continence & Oral Hygiene Prompt',
    'Nutrition, Hydration & Diet': 'Meals Prompt + Intake Check',
    'Life Skills & Daily Routine': 'Daily Routine Support & Engagement',
    'Social Engagement & Relationships': 'Engagement Offer (Reduce Isolation)',
    'Mobility, Movement & Exercise': 'Mobility / Exercise Support',
    'Pain Management & Comfort': 'Pain Check & Comfort Assessment',
    'Rest & Sleep Patterns': 'Sleep & Rest Check',
    'Infection Control & Public Health': 'Infection Control Check',
    'Communication & Sensory Integration': 'Communication Support & Sensory Check',
    'Environment & Physical Safety': 'Environment & Fire-Safety Check',
    'Adaptive Living Environment': 'Home Environment & Safety Check',
    'Skin Integrity & Pressure Care': 'Skin Integrity Check',
    'Financial Management & Autonomy': 'Finance Support & Autonomy Check',
    'Rights, Choice & Inclusion': 'Rights, Choice & Inclusion Support',
    'Holistic Health & Vitality': 'Health & Appointment Planning',
    'Respiratory Health & Support': 'Respiratory Health Check',
    'Cultural, Spiritual & Personal Beliefs': 'Cultural & Spiritual Expression Support',
    'Intimacy & Personal Expression': 'Personal Expression & Dignity Check',
  };
  return taskNames[title] || title;
}

function buildTaskNotes(domain: CarePlanDomain): string {
  const parts: string[] = [];
  if (domain.identifiedNeed?.trim()) {
    parts.push(`Identified need: ${domain.identifiedNeed.trim()}`);
  }
  if (domain.howToAchieve?.trim()) {
    parts.push(`How to support: ${domain.howToAchieve.trim()}`);
  }
  if (domain.plannedOutcomes?.trim()) {
    parts.push(`Planned outcome: ${domain.plannedOutcomes.trim()}`);
  }
  if (domain.riskMitigation?.trim()) {
    parts.push(`Risk mitigation: ${domain.riskMitigation.trim()}`);
  }
  if (parts.length === 0) {
    return 'Record support provided, client response, and any concerns or actions taken.';
  }
  return parts.join('\n') + '\n\nRecord: actions taken, client response, any refusals, concerns, or escalations.';
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
      const name = buildTaskName(domain);
      const notes = buildTaskNotes(domain);
      const frequency = inferFrequency(domain.title);
      const mandatory = isMandatoryTask(domain.title, notes);
      const source = `Care Plan - ${domain.title}${domain.riskTitle ? ` / Risk: ${domain.riskTitle}` : ''}`;

      return { name, notes, frequency, mandatory, source, domain: domain.title, evidence };
    })
    .filter(task => task.evidence.length > 0);
}

function formatForExport(client: FullClient, tasks: NourishTask[]): string {
  const daily = tasks.filter(t => t.frequency === 'daily');
  const weekly = tasks.filter(t => t.frequency === 'weekly');
  const event = tasks.filter(t => t.frequency === 'event');
  const date = new Date().toLocaleDateString('en-GB');

  let out = `NOTE TITLE: CarePlanner Personalised Tasks (Care Plan Aligned) - ${client.name}\n`;
  out += `Generated: ${date} | Source: Hazel Care Ops - Care Plan Builder\n\n`;
  out += `PURPOSE\n`;
  out += `These tasks are derived directly from ${client.name}'s current care plans and risk assessments to evidence support delivery and ensure consistency across staff.\n\n`;
  out += `RULES\n`;
  out += `- Build as Client Tasks in Nourish.\n`;
  out += `- Set Task Notes mandatory for all tasks marked [MANDATORY].\n`;
  out += `- Do not change tasks without updating the underlying care plan/risk assessment first.\n`;
  out += `- Do not create tasks without evidence from care plan or risk fields.\n\n`;
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
// COMPONENTS
const FREQ_CONFIG = {
  daily: { label: 'Daily', icon: <Clock size={12} />, color: 'text-hc-teal', bg: 'bg-hc-teal/10 border-hc-teal/20' },
  weekly: { label: 'Weekly', icon: <Calendar size={12} />, color: 'text-flag-amber', bg: 'bg-flag-amber/10 border-flag-amber/20' },
  event: { label: 'Event-Driven', icon: <Zap size={12} />, color: 'text-flag-red', bg: 'bg-flag-red/10 border-flag-red/20' },
};

function TaskCard({ task, index }: { task: NourishTask; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const freq = FREQ_CONFIG[task.frequency];

  return (
    <div className={`hc-clay-raised rounded-2xl overflow-hidden border ${task.mandatory ? 'border-flag-red/20' : 'border-hc-border/5'} transition-all`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-all"
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
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${freq.bg} ${freq.color}`}>
              {freq.icon} {freq.label}
            </span>
            <span className="text-[9px] text-hc-muted truncate max-w-[200px]">{task.source}</span>
          </div>
        </div>

        <span className="text-hc-muted shrink-0 mt-1">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-hc-border/10 pt-3 animate-in slide-in-from-top-2 duration-200">
          <div>
            <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1.5">Task Notes Instruction</div>
            <div className="hc-clay-inset rounded-xl p-3 text-[11px] text-hc-text/80 leading-relaxed whitespace-pre-line">
              {task.notes}
            </div>
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
  label, tasks, freq, icon
}: {
  label: string;
  tasks: NourishTask[];
  freq: TaskFrequency;
  icon: React.ReactNode;
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
            <TaskCard key={`${freq}-${i}`} task={t} index={i + 1} />
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
  const [clients] = useState<FullClient[]>(() => loadClients());
  const [selectedId, setSelectedId] = useState<string>(() => {
    // Default to first client with a care plan
    const first = clients.find(c => c.carePlan?.domains?.some(d => d.enabled));
    return first?.id || clients[0]?.id || '';
  });
  const [copied, setCopied] = useState(false);

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedId) || null,
    [clients, selectedId]
  );

  const tasks = useMemo(
    () => (selectedClient ? generateTasksFromCarePlan(selectedClient) : []),
    [selectedClient]
  );

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

  const handleDownload = () => {
    if (!exportText || !selectedClient) return;
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nourish-task-pack-${selectedClient.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clientsWithPlans = clients.filter(c => c.carePlan?.domains?.some(d => d.enabled));
  const clientsNoPlan = clients.filter(c => !c.carePlan?.domains?.some(d => d.enabled));

  return (
    <div className="flex h-full min-h-screen">

      {/* ── LEFT: Client picker ── */}
      <aside className="w-72 shrink-0 border-r border-hc-border/10 p-4 space-y-3 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList size={16} className="text-hc-teal" />
          <span className="text-[10px] font-black text-hc-teal uppercase tracking-widest">Select Client</span>
        </div>

        {clientsWithPlans.length === 0 && (
          <div className="hc-clay-raised rounded-2xl p-4 text-center">
            <Info size={20} className="text-hc-muted mx-auto mb-2" />
            <p className="text-[10px] font-black text-hc-muted uppercase tracking-wide">No care plans found</p>
            <p className="text-[9px] text-hc-muted/60 mt-1">Build a care plan in the Care Plan Builder first</p>
          </div>
        )}

        {clientsWithPlans.length > 0 && (
          <div className="space-y-1">
            <div className="text-[8px] font-black text-hc-teal uppercase tracking-widest px-1 mb-2">
              Has Care Plan ({clientsWithPlans.length})
            </div>
            {clientsWithPlans.map(c => {
              const taskCount = generateTasksFromCarePlan(c).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
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
                  <span className="shrink-0 px-1.5 py-0.5 rounded-full hc-clay-inset text-[9px] font-black text-hc-muted">
                    {taskCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {clientsNoPlan.length > 0 && (
          <div className="space-y-1 opacity-40">
            <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest px-1 mb-2">
              No Care Plan Yet ({clientsNoPlan.length})
            </div>
            {clientsNoPlan.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-4 py-3">
                <User size={12} className="opacity-40" />
                <span className="text-[10px] font-black uppercase tracking-wide text-hc-muted truncate">{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* ── RIGHT: Task pack ── */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[11px] font-black text-hc-teal uppercase tracking-widest mb-1">
              Nourish Task Pack Generator
            </h1>
            <p className="text-[10px] text-hc-muted font-bold">
              {selectedClient
                ? `${tasks.length} tasks derived from ${selectedClient.name}'s care plan`
                : 'Select a client to generate their care-plan-aligned task pack'}
            </p>
          </div>

          {tasks.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2.5 hc-clay-raised rounded-xl text-[10px] font-black text-hc-muted hover:text-hc-teal transition-all uppercase tracking-widest"
              >
                <Download size={13} /> Download
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

        {/* No client / no tasks */}
        {!selectedClient && (
          <div className="hc-clay-raised rounded-3xl p-12 text-center space-y-4">
            <ClipboardList size={48} className="text-hc-teal/30 mx-auto" />
            <div>
              <p className="text-[11px] font-black text-hc-text uppercase tracking-widest">No client selected</p>
              <p className="text-[10px] text-hc-muted mt-1">Pick a client from the left panel</p>
            </div>
          </div>
        )}

        {selectedClient && tasks.length === 0 && (
          <div className="hc-clay-raised rounded-3xl p-12 text-center space-y-4">
            <RefreshCw size={32} className="text-hc-muted/30 mx-auto" />
            <div>
              <p className="text-[11px] font-black text-hc-text uppercase tracking-widest">No enabled care plan domains</p>
              <p className="text-[10px] text-hc-muted mt-1">
                Go to the Care Plan Builder and enable domains for {selectedClient.name} first.
              </p>
            </div>
          </div>
        )}

        {selectedClient && tasks.length > 0 && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-3">
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

            {/* Info banner */}
            <div className="flex items-start gap-3 hc-clay-inset rounded-2xl p-4">
              <Info size={14} className="text-hc-teal shrink-0 mt-0.5" />
              <div className="text-[10px] text-hc-muted leading-relaxed">
                <span className="font-black text-hc-text">How to use: </span>
                Copy or download this pack → paste it at the bottom of {selectedClient.name}'s admission pack under a heading <em>"CarePlanner Personalised Tasks (Care Plan Aligned)"</em>. Staff upload each task into Nourish exactly as listed. Tasks are locked to the care plan — any change requires updating the care plan first.
              </div>
            </div>

            {/* Task sections */}
            <div className="space-y-6">
              <FreqSection
                label="Daily Tasks"
                tasks={daily}
                freq="daily"
                icon={<Clock size={12} />}
              />
              <FreqSection
                label="Weekly Tasks"
                tasks={weekly}
                freq="weekly"
                icon={<Calendar size={12} />}
              />
              <FreqSection
                label="Event-Driven Tasks"
                tasks={event}
                freq="event"
                icon={<Zap size={12} />}
              />
            </div>

            {/* Export preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black text-hc-muted uppercase tracking-widest flex items-center gap-2">
                  <FileText size={11} /> Export Preview (paste into admission pack)
                </span>
                <button
                  onClick={handleCopy}
                  className="text-[9px] font-black text-hc-teal hover:underline uppercase tracking-widest"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="hc-clay-inset rounded-2xl p-4 font-mono text-[10px] text-hc-text/70 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto scrollbar-thin">
                {exportText}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}




