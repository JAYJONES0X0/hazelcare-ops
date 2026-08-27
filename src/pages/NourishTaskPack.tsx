import { useState, useMemo, useEffect, type MouseEvent } from 'react';
import { loadClients, saveClient, type FullClient, type VaultDoc } from '../lib/client-store';
import {
  clientHasTaskSources,
  formatForExport,
  generateTasksForClient,
  type NourishTask,
  type TaskFrequency,
} from '../lib/nourish-task-pack';
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
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function taskSourceLabels(tasks: NourishTask[]): string[] {
  const labels = new Set<string>();
  for (const task of tasks) {
    if (task.source.startsWith('Care Plan')) labels.add('care plan');
    else if (task.source.startsWith('Support Plan')) labels.add('support plan');
    else if (task.source.startsWith('Risk Assessment')) labels.add('risk assessment');
    else if (task.source.startsWith('Intelligence Vault')) labels.add('attached source documents');
    else labels.add('source evidence');
  }
  return Array.from(labels);
}

function joinSourceLabels(labels: string[]): string {
  if (labels.length === 0) return 'care/source evidence';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function taskPackSourceSummary(client: FullClient, tasks: NourishTask[]): string {
  const taskLabel = tasks.length === 1 ? 'task' : 'tasks';
  return `${tasks.length} ${taskLabel} derived from ${client.name}'s ${joinSourceLabels(taskSourceLabels(tasks))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCX GENERATION
// ─────────────────────────────────────────────────────────────────────────────

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
                new TextRun({ text: "OVSITE · OPERATIONS HUB", bold: true, size: 18, color: "0D9488" })
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
            new TextRun({ text: taskPackSourceSummary(client, tasks), size: 24, color: "6B7280" })
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
  a.download = `CareOps-Task-Pack-${client.name.replace(/\s+/g, '-')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// COMPONENTS
const FREQ_CONFIG: Record<TaskFrequency, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  daily: { label: 'Daily', icon: <Clock size={12} />, color: 'text-hc-teal', bg: 'bg-hc-teal/10 border-hc-teal/20' },
  weekly: { label: 'Weekly', icon: <Calendar size={12} />, color: 'text-flag-amber', bg: 'bg-flag-amber/10 border-flag-amber/20' },
  event: { label: 'Event-Driven', icon: <Zap size={12} />, color: 'text-flag-red', bg: 'bg-flag-red/10 border-flag-red/20' },
};

function TaskCard({ task, index, onUpdate, isUpdated }: { task: NourishTask; index: number; onUpdate?: (id: string, notes: string) => void; isUpdated?: boolean }) {
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
    <div className={`hc-clay-raised rounded-2xl overflow-hidden border transition-all duration-500 ${
      isUpdated ? 'border-hc-teal/50 ring-2 ring-hc-teal/20 shadow-[0_0_12px_rgba(13,148,136,0.15)]' :
      task.mandatory ? 'border-flag-red/20' : 'border-hc-border/5'
    }`}>
      <div
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-3 sm:p-4 text-left hover:bg-white/[0.02] transition-all cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((current) => !current);
          }
        }}
      >
        <span className="w-6 h-6 rounded-lg hc-clay-inset flex items-center justify-center text-[10px] font-black text-hc-muted shrink-0 mt-0.5">
          {index}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-hc-text uppercase tracking-wide leading-snug">{task.name}</span>
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
        <div className="px-3 sm:px-4 pb-4 space-y-4 border-t border-hc-border/10 pt-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
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
                className="w-full hc-clay-inset rounded-xl p-3 text-[12px] text-hc-text bg-hc-surface font-mono outline-none focus:ring-1 focus:ring-hc-teal/30 leading-relaxed"
              />
            ) : (
              <div className="hc-clay-inset rounded-xl p-3 text-[12px] text-hc-text/85 leading-relaxed whitespace-pre-line max-h-52 overflow-y-auto">
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
            <div className="rounded-xl border border-hc-border/10 bg-hc-surface/35 p-3 space-y-3 min-w-0">
              <div>
                <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Source</div>
                <div className="text-[10px] text-hc-muted font-bold leading-relaxed break-words">{task.source}</div>
              </div>
              {task.evidence.length > 0 && (
                <div>
                  <div className="text-[8px] font-black text-hc-muted uppercase tracking-widest mb-1">Evidence Summary</div>
                  <ul className="list-disc pl-4 space-y-1.5 text-[10px] text-hc-muted leading-relaxed max-h-48 overflow-y-auto">
                    {task.evidence.map((ev, i) => (
                      <li key={i} className="break-words">{ev}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FreqSection({
  label, tasks, freq, icon, onTaskUpdate, updatedIds
}: {
  label: string;
  tasks: NourishTask[];
  freq: TaskFrequency;
  icon: React.ReactNode;
  onTaskUpdate?: (id: string, notes: string) => void;
  updatedIds?: Set<string>;
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
            <TaskCard key={`${freq}-${t.id}-${t.notes}`} task={t} index={i + 1} onUpdate={onTaskUpdate} isUpdated={updatedIds?.has(t.id)} />
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

  const [selectedId, setSelectedId] = useState<string>(() => {
    const all = loadClients();
    const first = all.find(c => clientHasTaskSources(c));
    return first?.id || all[0]?.id || '';
  });

  const [copied, setCopied] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importInfo, setImportInfo] = useState('');
  const [refineInput, setRefineInput] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineStatus, setRefineStatus] = useState<{ count: number; message: string } | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());

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

  const triggerStressTest = import.meta.env.DEV
    ? async () => {
        try {
          const stressClient = await runTaskStressTest();
          setClients(prev => [stressClient, ...prev]);
          setSelectedId(stressClient.id);
          setImportInfo('STRESS TEST ACTIVE: 1,000 TASKS INJECTED');
        } catch (e) {
          alert(e instanceof Error ? e.message : 'Stress test failed');
        }
      }
    : undefined;

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedId) || null,
    [clients, selectedId]
  );

  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setManualOverrides({});
    setRefineStatus(null);
    setRecentlyUpdated(new Set());
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
    } catch {
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
    a.download = `careops-task-pack-${selectedClient.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
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

      saveClient({ ...profile, vaultDocs: [...(profile.vaultDocs || []), newDoc] });
      setClients(loadClients());
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
    saveClient({ ...profile, vaultDocs: (profile.vaultDocs || []).filter(d => d.id !== docId) });
    setClients(loadClients());
    setImportInfo('Document removed');
  };

  const runAIRefinement = async () => {
    if (!refineInput.trim() || !selectedClient || tasks.length === 0) return;
    setRefining(true);
    setRefineStatus(null);
    try {
      const res = await fetch('/api/staff/refine-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: refineInput,
          clientName: selectedClient.name,
          tasks: tasks.map(t => ({ id: t.id, name: t.name, notes: t.notes, frequency: t.frequency })),
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'AI at capacity');
      const updates: Record<string, string> = await res.json();
      const count = Object.keys(updates).length;

      if (count > 0) {
        setManualOverrides(prev => ({ ...prev, ...updates }));
        const updatedSet = new Set(Object.keys(updates));
        setRecentlyUpdated(updatedSet);
        setTimeout(() => setRecentlyUpdated(new Set()), 3500);
        setRefineStatus({ count, message: `${count} task${count === 1 ? '' : 's'} updated` });
      } else {
        setRefineStatus({ count: 0, message: 'No changes needed for that instruction' });
      }
    } catch (error) {
      setRefineStatus({ count: -1, message: error instanceof Error ? error.message : 'Refinement failed — try again' });
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
              onClick={triggerStressTest ? (e) => e.detail === 3 && triggerStressTest() : undefined}
              className="text-[11px] font-black text-hc-teal uppercase tracking-widest mb-1 cursor-default select-none"
            >
              CareOps Task Pack Generator
            </h1>
            <p className="text-[10px] text-hc-muted font-bold">
              {selectedClient
                ? taskPackSourceSummary(selectedClient, tasks)
                : 'Select a client to generate their care/source aligned task pack'}
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
                updatedIds={recentlyUpdated}
              />
              <FreqSection
                label="Weekly Tasks"
                tasks={weekly}
                freq="weekly"
                icon={<Calendar size={12} />}
                onTaskUpdate={handleTaskUpdate}
                updatedIds={recentlyUpdated}
              />
              <FreqSection
                label="Event-Driven Tasks"
                tasks={event}
                freq="event"
                icon={<Zap size={12} />}
                onTaskUpdate={handleTaskUpdate}
                updatedIds={recentlyUpdated}
              />
            </div>
          </>
        )}
      </main>

      {/* AI Task Refinement Bar */}
      {selectedClient && tasks.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 lg:bottom-6 lg:right-6 lg:left-[20rem] z-50">
          <div className="max-w-4xl mx-auto hc-clay-raised rounded-3xl border border-hc-teal/20 backdrop-blur-xl bg-hc-surface/90 overflow-hidden">

            {/* Label row */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-hc-border/10">
              <Sparkles size={12} className="text-hc-teal shrink-0" />
              <span className="text-[9px] font-black uppercase tracking-widest text-hc-teal">AI Task Refinement</span>
              <span className="text-[9px] text-hc-muted font-medium">
                — describe a change and AI will rewrite the full pack. E.g. <em>"make medication notes shorter"</em> or <em>"add seizure protocol to risk tasks"</em>
              </span>
            </div>

            <div className="p-3 space-y-3">
              {refineStatus && (
                <div className={`rounded-2xl px-4 py-2.5 flex items-center gap-3 animate-in fade-in duration-300 ${
                  refineStatus.count > 0
                    ? 'bg-hc-teal/10 border border-hc-teal/20'
                    : refineStatus.count === 0
                    ? 'bg-hc-border/10 border border-hc-border/20'
                    : 'bg-flag-red/10 border border-flag-red/20'
                }`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${
                    refineStatus.count > 0 ? 'text-hc-teal' : refineStatus.count === 0 ? 'text-hc-muted' : 'text-flag-red'
                  }`}>
                    {refineStatus.count > 0 ? '✓ ' : ''}{refineStatus.message}
                  </span>
                  {refineStatus.count > 0 && (
                    <span className="text-[8px] text-hc-muted font-medium ml-auto">cards updated above — download docx to export</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Sparkles size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 text-hc-teal ${refining ? 'animate-spin' : ''}`} />
                  <input
                    value={refineInput}
                    onChange={e => setRefineInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runAIRefinement()}
                    placeholder={`Refine ${selectedClient.name.split(' ')[0]}'s task pack — describe what to change…`}
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
        </div>
      )}
    </div>
  );
}
