import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FileText, Search, Sparkles, Copy, CheckCircle, Download, Trash2, Users, Calendar, RefreshCw, AlertTriangle, Shield, PenLine, ChevronRight, Paperclip } from 'lucide-react';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { flattenWeekEntries } from '../lib/staff-monitoring';
import { detectClinicalGaps, type ClinicalGap } from '../lib/continuity-engine';
import type { CareEntry } from '../lib/types';
import { extractFileText } from '../lib/universal-extractor';
import { getAllEntriesAsync, appendEntriesAsync, getStoreBoundsAsync, upsertEntryAsync, deleteEntriesByIdsAsync } from '../lib/entry-store';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';
import { loadClients, saveClient, emptyClient, type FullClient } from '../lib/client-store';
import { buildShiftContext, computeCoverageSummary, loadCoveragePlan, type CoveragePlan } from '../lib/coverage-plan';

const INTERNAL_TEMPLATES = [
  {
    id: 'narrative-v2',
    name: 'Organic Narrative (Forensic)',
    content: `Atmosphere & Shift Commencement:
[Describe the initial environment and the client's first presentation of the day.]

Engagement & Individual Progress:
[Detail the specific 1:1 support delivered, focusing on the quality of engagement, any goals worked on, and the client's response to staff prompts.]

Clinical Presentation & Wellbeing:
[Provide a synthesis of the client's mood, physical health indicators, and general mental wellbeing throughout the period.]

Summary of Outcome:
[Reflect on the day's successes or challenges and confirm the state in which the client was handed over.]`
  },
  {
    id: 'audit-forensic',
    name: 'Forensic Timeline (Humanized)',
    content: `08:00 - 10:00 (The Morning Period)
[Provide a narrative of the morning routine, breakfast, and initial settling.]

10:00 - 14:00 (Active Engagement)
[Detail community access, social interactions, or focused 1:1 sessions. Focus on client choice and autonomy.]

14:00 - 17:00 (The Afternoon/Evening Period)
[Capture the wind-down or late afternoon activities, including meal prep and welfare checks.]

Safety & Significant Observations:
[Detail any specific incidents, risks managed, or deviations from the care plan with a focus on staff response.]

Handover & End of Day Presentation:
[Briefly state the final wellbeing check and handover status.]`
  },
  {
    id: 'behavioral-complex',
    name: 'Behavioral Reasoning',
    content: `Presentation & Baseline:
[Synthesis of the client's state before any identified events.]

The Support Context:
[Describe any triggers or environmental factors that required staff intervention. Explain the "why" behind the behaviors.]

Staff Response & De-escalation:
[Narrative of how staff supported the client, including verbal and non-verbal techniques used.]

Post-Event Resolution:
[The client's recovery process and current wellbeing status.]`
  }
];

export function NoteWorkspace() {
  const [importLoading, setImportLoading] = useState(false);
  const [importInfo, setImportInfo] = useState('');
  const [booting, setBooting] = useState(true);

  // Load from IndexedDB async on mount — no 5MB localStorage cap
  const [entries, setEntries] = useState<CareEntry[]>([]);
  const [storeBounds, setStoreBounds] = useState<{ from: string; to: string; count: number } | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [goldTemplate, setGoldTemplate] = useState('');
  const [showGoldSuite, setShowGoldSuite] = useState(false);
  const [userTemplates, setUserTemplates] = useState<{name: string, content: string}[]>(() => {
    const saved = localStorage.getItem('hc_user_templates');
    return saved ? JSON.parse(saved) : [];
  });
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void getAllEntriesAsync().then(rows => {
      if (!alive) return;
      setEntries(rows);
      setBooting(false);
    });
    void getStoreBoundsAsync().then(b => { if (alive) setStoreBounds(b); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const plan = loadCoveragePlan();
    if (!plan) return;
    setCoveragePlan(plan);
    setSelectedClient(plan.client);
    setClientSearch(plan.client);
    setDateRange({ from: plan.dateFrom, to: plan.dateTo });
    setExpectedNotesPerDay(plan.windows.length || 1);
  }, []);

  const [rewriteMap, setRewriteMap] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [ghostMap, setGhostMap] = useState<Record<string, string>>({});
  const [ghostLoadingMap, setGhostLoadingMap] = useState<Record<string, boolean>>({});
  const [ghostCopiedMap, setGhostCopiedMap] = useState<Record<string, boolean>>({});
  const [ghostSavedMap, setGhostSavedMap] = useState<Record<string, boolean>>({});
  const [ghostContextMap, setGhostContextMap] = useState<Record<string, string>>({});
  const [replaceLoadingMap, setReplaceLoadingMap] = useState<Record<string, boolean>>({});
  const [linkedEntryIds, setLinkedEntryIds] = useState<Record<string, boolean>>({});
  const [expectedNotesPerDay, setExpectedNotesPerDay] = useState(3);
  const [displayCount, setDisplayCount] = useState(30);
  const [clientProfile, setClientProfile] = useState<FullClient | null>(null);
  const [coveragePlan, setCoveragePlan] = useState<CoveragePlan | null>(() => loadCoveragePlan());

  // Reload client profile whenever selection changes
  useEffect(() => {
    if (!selectedClient) { setClientProfile(null); return; }
    const clients = loadClients();
    const p = clients.find(c => c.name.toLowerCase().trim() === selectedClient.toLowerCase().trim()) || null;
    setClientProfile(p);
  }, [selectedClient, importInfo]); // re-check after doc upload

  const allClients = useMemo(() => {
    const names = new Set<string>();
    const SKIP = new Set(['unknown', 'service user unassigned', 'personnel unassigned']);
    for (const e of entries) {
      if (e.client && e.client.trim() && !SKIP.has(e.client.toLowerCase().trim())) names.add(e.client.trim());
    }
    return Array.from(names).sort();
  }, [entries]);

  // Filtered clients by search
  const visibleClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients;
    return allClients.filter(c => c.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [allClients, clientSearch]);

  // Filtered entries + Continuity Gaps
  const { visibleItems, stats } = useMemo(() => {
    const raw = entries.filter(e => {
      if (selectedClient && !e.client?.toLowerCase().includes(selectedClient.toLowerCase())) return false;
      if (dateRange.from || dateRange.to) {
        const dparts = e.date.split('/');
        if (dparts.length !== 3) return false;
        const iso = `${dparts[2]}-${dparts[1].padStart(2, '0')}-${dparts[0].padStart(2, '0')}`;
        const from = dateRange.from ? dateRange.from.split('/').reverse().map(s => s.padStart(2, '0')).join('-') : null;
        const to = dateRange.to ? dateRange.to.split('/').reverse().map(s => s.padStart(2, '0')).join('-') : null;
        if (from && iso < from) return false;
        if (to && iso > to) return false;
      }
      return true;
    });

    const gaps = detectClinicalGaps(raw);
    const combined = [
      ...raw.map(e => ({ ...e, type: 'entry' as const })),
      ...gaps.map(g => ({ ...g, type: 'gap' as const, entry: '', carer: 'SYSTEM_AUDIT' }))
    ];

    const sorted = combined.sort((a, b) => {
      const pa = a.date.split('/'); const pb = b.date.split('/');
      const da = `${pa[2]}-${pa[1].padStart(2, '0')}-${pa[0].padStart(2, '0')}`;
      const db = `${pb[2]}-${pb[1].padStart(2, '0')}-${pb[0].padStart(2, '0')}`;
      if (db !== da) return db.localeCompare(da);
      return (b.type === 'gap' ? 1 : 0) - (a.type === 'gap' ? 1 : 0);
    });

    return { 
      visibleItems: sorted,
      stats: { entries: raw.length, gaps: gaps.length, criticalGaps: gaps.filter(g => g.severity === 'red').length }
    };
  }, [entries, selectedClient, dateRange]);

  const filtered = visibleItems;

  const sameDayGroups = useMemo(() => {
    const buckets = new Map<string, CareEntry[]>();
    for (const item of visibleItems) {
      if ((item as any).type !== 'entry') continue;
      const entry = item as CareEntry;
      const groupKey = `${entry.client.trim().toLowerCase()}|${entry.date}`;
      if (!buckets.has(groupKey)) buckets.set(groupKey, []);
      buckets.get(groupKey)!.push(entry);
    }

    const info = new Map<string, { position: number; total: number; entries: CareEntry[] }>();
    for (const groupEntries of buckets.values()) {
      groupEntries
        .slice()
        .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.id.localeCompare(b.id))
        .forEach((entry, index, sorted) => {
          info.set(entry.id, { position: index + 1, total: sorted.length, entries: sorted });
        });
    }
    return info;
  }, [visibleItems]);

  const reviewCoverage = useMemo(() => {
    if (
      coveragePlan
      && selectedClient
      && coveragePlan.client.trim().toLowerCase() === selectedClient.trim().toLowerCase()
      && coveragePlan.dateFrom === dateRange.from
      && coveragePlan.dateTo === dateRange.to
    ) {
      return computeCoverageSummary(entries, coveragePlan);
    }
    if (!selectedClient || !dateRange.from || !dateRange.to) return null;
    const toIso = (d: string) => {
      const p = d.split('/');
      return p.length === 3 ? `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}` : '';
    };
    const fromIso = toIso(dateRange.from);
    const toIsoDate = toIso(dateRange.to);
    if (!fromIso || !toIsoDate || fromIso > toIsoDate) return null;

    const byDay = new Map<string, number>();
    for (const e of entries) {
      if (e.client?.toLowerCase().trim() !== selectedClient.toLowerCase().trim()) continue;
      const dayIso = toIso(e.date);
      if (!dayIso || dayIso < fromIso || dayIso > toIsoDate) continue;
      if (!e.entry?.trim()) continue;
      byDay.set(dayIso, (byDay.get(dayIso) || 0) + 1);
    }

    const days: { date: string; expected: number; actual: number; missing: number }[] = [];
    const cursor = new Date(fromIso);
    const end = new Date(toIsoDate);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;
      const actual = byDay.get(iso) || 0;
      const expected = expectedNotesPerDay;
      days.push({
        date: `${d}/${m}/${y}`,
        expected,
        actual,
        missing: Math.max(0, expected - actual),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const missingDays = days.filter(day => day.missing > 0);
    const totalExpected = days.reduce((sum, day) => sum + day.expected, 0);
    const totalActual = days.reduce((sum, day) => sum + day.actual, 0);
    return {
      days,
      missingDays,
      totalExpected,
      totalActual,
      totalMissing: Math.max(0, totalExpected - totalActual),
      coveragePct: totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 100,
      dailyHours: 0,
      totalHours: 0,
    };
  }, [entries, selectedClient, dateRange, expectedNotesPerDay, coveragePlan]);

  // Reset display count on filter change
  useEffect(() => { setDisplayCount(30); }, [selectedClient, dateRange]);

  useEffect(() => {
    if (!coveragePlan || !reviewCoverage) return;
    setGhostContextMap(prev => {
      const next = { ...prev };
      let changed = false;
      for (const day of reviewCoverage.missingDays) {
        const key = `audit-${day.date}`;
        if (!next[key]) {
          next[key] = buildShiftContext(coveragePlan, day.date);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [coveragePlan, reviewCoverage]);

  // Entry count per client (for sidebar badges)
  const clientEntryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      if (e.client?.trim()) map[e.client.trim()] = (map[e.client.trim()] || 0) + 1;
    }
    return map;
  }, [entries]);

  const handleImportFile = useCallback(async (file: File) => {
    setImportLoading(true);
    setImportInfo('');
    try {
      const text = await extractFileText(file);
      const envelope = buildEnvelopeFromRaw(file.name, text);
      let loaded: CareEntry[] = [];
      if (envelope.diaryEntries?.length) {
        loaded = envelope.diaryEntries;
      } else if (envelope.weekSummary) {
        loaded = flattenWeekEntries(envelope.weekSummary);
      }
      // Write to IndexedDB (no cap) and then reload from IDB for real count
      const added = await appendEntriesAsync(loaded);
      const all = await getAllEntriesAsync();
      setEntries(all);
      const bounds = await getStoreBoundsAsync();
      setStoreBounds(bounds);
      setImportInfo(`${loaded.length} entries parsed · ${added} new · ${all.length} total in store · ${file.name}`);
    } catch (e) {
      setImportInfo(`Failed to parse: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setImportLoading(false);
    }
  }, []);

  const handleClinicalDocUpload = async (file: File) => {
    if (!selectedClient) return;
    setImportLoading(true);
    setImportInfo(`Reading ${file.name}...`);
    try {
      const text = await extractFileText(file);
      const clients = loadClients();
      let profile = clients.find(c => c.name.toLowerCase().trim() === selectedClient.toLowerCase().trim());
      if (!profile) {
        // Auto-create a profile for this client so vault works even without admin setup
        profile = { ...emptyClient(), name: selectedClient, preferredName: selectedClient.split(' ')[0] };
      }
      const separator = profile.clinicalBriefing
        ? `\n\n━━━ ${file.name} ━━━\n`
        : `━━━ ${file.name} ━━━\n`;
      profile.clinicalBriefing = (profile.clinicalBriefing || '') + separator + text;
      saveClient(profile);
      const kb = Math.round(text.length / 1000);
      setImportInfo(`Loaded: ${file.name} · ${kb}K characters absorbed`);
    } catch (e) {
      setImportInfo(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setImportLoading(false);
    }
  };

  const runRewrite = async (entryKey: string, text: string, clientName: string, refineInstructions?: string) => {
    const clients = loadClients();
    const profile = clients.find(c => c.name.toLowerCase().trim() === clientName.toLowerCase().trim());
    let intelContext = '';

    if (profile) {
      const parts = [];
      if (profile.clinicalBriefing) parts.push(`[ABSORBED KNOWLEDGE]:\n${profile.clinicalBriefing}`);
      if (profile.diagnoses.length) parts.push(`DIAGNOSES: ${profile.diagnoses.join(', ')}`);
      if (profile.carePlan) {
        const active = profile.carePlan.domains.filter(d => d.enabled).map(d => `[${d.title}]: ${d.howToAchieve}`);
        if (active.length) parts.push(`CARE PLAN STRATEGIES:\n${active.join('\n')}`);
      }
      if (profile.pbs) {
        parts.push(`SUPPORT STRATEGIES (PBS): ${profile.pbs.routineStrategies.filter(Boolean).join('; ')}`);
        parts.push(`DE-ESCALATION (What works): ${profile.pbs.whatWorks.filter(Boolean).join('; ')}`);
      }
      if (profile.risk) {
        const topRisks = profile.risk.risks.map(r => `[Risk: ${r.title}]: ${r.controls.join('; ')}`);
        parts.push(`RISK MITIGATION:\n${topRisks.join('\n')}`);
      }
      intelContext = parts.join('\n\n');
    }

    setLoadingMap(prev => ({ ...prev, [entryKey]: true }));
    try {
      const groqRes = await fetch('/api/staff/enhance-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          noteType: 'Shift Note',
          clientName,
          referenceTemplate: goldTemplate || INTERNAL_TEMPLATES[0].content,
          refineInstructions,
          previousOutput: rewriteMap[entryKey],
          clinicalContext: intelContext
        })
      });

      const reader = groqRes.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
        setRewriteMap(prev => ({ ...prev, [entryKey]: result }));
      }
      if (refineInstructions) {
        setRefineInputs(prev => ({ ...prev, [entryKey]: '' }));
      }
    } catch (e) {
      setRewriteMap(prev => ({ ...prev, [entryKey]: `Intelligence Failure: ${e instanceof Error ? e.message : 'Unknown Connection Error'}` }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [entryKey]: false }));
    }
  };

  const runGhostWrite = async (gapId: string, date: string, client: string) => {
    // Find closest note before and after the gap date for this client
    const toIso = (d: string) => {
      const p = d.split('/');
      return p.length === 3 ? `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}` : '';
    };
    const gapIso = toIso(date);
    const clientEntries = entries
      .filter(e => e.client?.toLowerCase().trim() === client.toLowerCase().trim() && e.entry?.trim())
      .sort((a, b) => toIso(a.date).localeCompare(toIso(b.date)));

    const prevEntry = [...clientEntries].reverse().find(e => toIso(e.date) < gapIso);
    const nextEntry = clientEntries.find(e => toIso(e.date) > gapIso);

    const clients = loadClients();
    const profile = clients.find(c => c.name.toLowerCase().trim() === client.toLowerCase().trim());
    const parts: string[] = [];
    if (profile) {
      if (profile.clinicalBriefing) parts.push(`[ABSORBED KNOWLEDGE]:\n${profile.clinicalBriefing}`);
      if (profile.diagnoses.length) parts.push(`DIAGNOSES: ${profile.diagnoses.join(', ')}`);
      if (profile.carePlan) {
        const active = profile.carePlan.domains.filter(d => d.enabled).map(d => `[${d.title}]: ${d.howToAchieve}`);
        if (active.length) parts.push(`CARE PLAN STRATEGIES:\n${active.join('\n')}`);
      }
      if (profile.pbs) {
        parts.push(`DAILY ROUTINES: ${profile.pbs.routineStrategies.filter(Boolean).join('; ')}`);
        parts.push(`WHAT WORKS: ${profile.pbs.whatWorks.filter(Boolean).join('; ')}`);
      }
      if (profile.risk?.risks?.length) {
        parts.push(`KEY RISKS: ${profile.risk.risks.map(r => `${r.title} — ${r.controls.slice(0,2).join('; ')}`).join(' | ')}`);
      }
    }

    const shiftContext = ghostContextMap[gapId]?.trim() || '';

    setGhostLoadingMap(prev => ({ ...prev, [gapId]: true }));
    try {
      const res = await fetch('/api/staff/ghost-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          clientName: client,
          prevNote: prevEntry ? `[${prevEntry.date} — ${prevEntry.carer}]: ${prevEntry.entry}` : '',
          nextNote: nextEntry ? `[${nextEntry.date} — ${nextEntry.carer}]: ${nextEntry.entry}` : '',
          referenceTemplate: goldTemplate || INTERNAL_TEMPLATES[0].content,
          clinicalContext: parts.join('\n\n'),
          shiftContext // Added to AI prompt context
        })
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
        setGhostMap(prev => ({ ...prev, [gapId]: result }));
      }
    } catch (e) {
      setGhostMap(prev => ({ ...prev, [gapId]: `Ghost write failed: ${e instanceof Error ? e.message : 'Unknown error'}` }));
    } finally {
      setGhostLoadingMap(prev => ({ ...prev, [gapId]: false }));
    }
  };

  const toggleLinkedEntry = (entryId: string) => {
    setLinkedEntryIds(prev => {
      const next = { ...prev };
      if (next[entryId]) delete next[entryId];
      else next[entryId] = true;
      return next;
    });
  };

  const buildMergedText = (groupEntries: CareEntry[], linkedIds: string[]) => groupEntries
    .filter(entry => linkedIds.includes(entry.id))
    .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.id.localeCompare(b.id))
    .map((entry, index) => [
      `[Linked note ${index + 1} of ${linkedIds.length}]`,
      `Date: ${entry.date}`,
      entry.time ? `Time: ${entry.time}` : '',
      `Staff: ${entry.carer}`,
      `Type: ${entry.type}`,
      '',
      entry.entry,
    ].filter(Boolean).join('\n'))
    .join('\n\n---\n\n');

  const runLinkedRewrite = async (anchorKey: string, anchor: CareEntry, groupEntries: CareEntry[]) => {
    const linkedIds = groupEntries.map(entry => entry.id).filter(id => linkedEntryIds[id]);
    if (linkedIds.length < 2) return;
    const mergedText = buildMergedText(groupEntries, linkedIds);
    await runRewrite(
      anchorKey,
      mergedText,
      anchor.client,
      `Merge these ${linkedIds.length} same-day source notes into one complete shift note. Remove duplication, keep all clinically relevant facts, preserve chronological order, and return one cohesive final note.`
    );
  };

  const saveGhostAsEntry = async (ghostId: string, date: string, client: string, carer: string, text: string) => {
    if (!text.trim()) return;
    const newEntry: CareEntry = {
      id: `ghost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      house: entries.find(e => e.client?.toLowerCase().trim() === client.toLowerCase().trim())?.house || 'UNKNOWN',
      type: 'Daily Support',
      carer: carer || 'AI Assisted',
      client,
      entry: text.trim(),
      severity: 'green',
      flags: [],
      category: 'daily_support',
    };
    const added = await appendEntriesAsync([newEntry]);
    if (!added) return;
    const all = await getAllEntriesAsync();
    setEntries(all);
    setGhostSavedMap(prev => ({ ...prev, [ghostId]: true }));
    setTimeout(() => setGhostSavedMap(prev => ({ ...prev, [ghostId]: false })), 2000);
  };

  const replaceEntryWithRewrite = async (entryKey: string, original: CareEntry, rewritten: string) => {
    if (!rewritten.trim()) return;
    setReplaceLoadingMap(prev => ({ ...prev, [entryKey]: true }));
    try {
      const updated: CareEntry = { ...original, entry: rewritten.trim() };
      await upsertEntryAsync(updated);
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    } finally {
      setReplaceLoadingMap(prev => ({ ...prev, [entryKey]: false }));
    }
  };

  const mergeReplaceAndRemoveLinked = async (entryKey: string, original: CareEntry, groupEntries: CareEntry[], rewritten: string) => {
    if (!rewritten.trim()) return;
    const linkedIds = groupEntries.map(entry => entry.id).filter(id => linkedEntryIds[id]);
    if (linkedIds.length < 2) return;
    const removeIds = linkedIds.filter(id => id !== original.id);
    setReplaceLoadingMap(prev => ({ ...prev, [entryKey]: true }));
    try {
      const linkedCarers = groupEntries
        .filter(entry => linkedIds.includes(entry.id))
        .map(entry => entry.carer)
        .filter(Boolean);
      const updated: CareEntry = {
        ...original,
        type: original.type || 'Daily Support',
        carer: [...new Set(linkedCarers)].join(' / ') || original.carer,
        entry: rewritten.trim(),
        category: original.category || 'daily_support',
      };
      await upsertEntryAsync(updated);
      await deleteEntriesByIdsAsync(removeIds);
      const all = await getAllEntriesAsync();
      setEntries(all);
      setLinkedEntryIds(prev => {
        const next = { ...prev };
        for (const id of linkedIds) delete next[id];
        return next;
      });
    } finally {
      setReplaceLoadingMap(prev => ({ ...prev, [entryKey]: false }));
    }
  };

  const copyToClipboard = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedMap(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setCopiedMap(prev => ({ ...prev, [key]: false })), 2000);
  };

  const saveCustomTemplate = () => {
    if (!goldTemplate || !newTemplateName) return;
    const updated = [...userTemplates, { name: newTemplateName, content: goldTemplate }];
    setUserTemplates(updated);
    localStorage.setItem('hc_user_templates', JSON.stringify(updated));
    setNewTemplateName('');
    setShowTemplateMenu(false);
  };

  const deleteUserTemplate = (index: number) => {
    const updated = userTemplates.filter((_, i) => i !== index);
    setUserTemplates(updated);
    localStorage.setItem('hc_user_templates', JSON.stringify(updated));
  };

  const hasData = entries.length > 0;

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden animate-in fade-in duration-500">

      {/* ── Left: Client Switcher ─────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-hc-border/20 flex flex-col bg-hc-surface overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-hc-border/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-hc-teal" />
              <span className="text-[11px] font-black text-hc-muted uppercase tracking-widest">
                {allClients.length} Clients
              </span>
            </div>
            {storeBounds && (
              <span className="text-[11px] font-black text-hc-muted/40 tabular-nums">
                {storeBounds.count.toLocaleString()} entries
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-hc-muted/50" />
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Search clients…"
              className="hc-clay-inset w-full rounded-xl pl-9 pr-4 py-2.5 text-[11px] font-black text-hc-text focus:outline-none placeholder:text-hc-muted/40"
            />
          </div>
        </div>

        {/* Import button */}
        <div className="p-4 border-b border-hc-border/20">
          <input type="file" id="workspace-upload" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />
          <button onClick={() => document.getElementById('workspace-upload')?.click()}
            disabled={importLoading}
            className="w-full flex items-center justify-center gap-2 btn-tactical text-[10px] py-2.5 rounded-xl">
            <Download className="w-3.5 h-3.5" />
            {importLoading ? 'Loading...' : hasData ? 'Add More Data' : 'Import CSV / Excel'}
          </button>
          {importInfo && (
            <p className={`mt-2 text-[11px] font-black uppercase tracking-widest leading-relaxed ${importInfo.includes('Failed') ? 'text-flag-red' : 'text-hc-teal'}`}>
              {importInfo}
            </p>
          )}
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {booting ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-hc-muted text-center animate-pulse">
              <Sparkles className="w-10 h-10 text-hc-teal/40 mb-4 animate-spin-slow" />
              <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Hydrating...</div>
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-hc-muted text-center">
              <FileText className="w-10 h-10 text-hc-muted mb-4" />
              <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest">No data loaded</div>
              <div className="text-[11px] text-hc-muted mt-1">Import a diary CSV or ZIP to begin</div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setSelectedClient(null)}
                className={`w-full text-left px-5 py-3.5 flex items-center justify-between border-b border-hc-border/10 transition-all ${
                  !selectedClient
                    ? 'bg-hc-teal/10 border-l-2 border-l-hc-teal'
                    : 'hover:bg-hc-border/10'
                }`}
              >
                <span className="text-[11px] font-black text-hc-text uppercase tracking-wider">All Clients</span>
                <span className="text-[11px] font-black text-hc-muted tabular-nums">{entries.length}</span>
              </button>
              {visibleClients.map(client => (
                <div key={client} className="flex flex-col border-b border-hc-border/10">
                  <button
                    onClick={() => setSelectedClient(client)}
                    className={`w-full text-left px-5 py-3 flex items-center justify-between transition-all group ${
                      selectedClient === client
                        ? 'bg-hc-teal/10 border-l-2 border-l-hc-teal'
                        : 'hover:bg-hc-border/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                        selectedClient === client ? 'bg-hc-teal text-hc-bone' : 'bg-hc-border/30 text-hc-muted group-hover:bg-hc-teal/20 group-hover:text-hc-teal'
                      }`}>
                        {client[0].toUpperCase()}
                      </div>
                      <span className={`text-[11px] font-black truncate ${selectedClient === client ? 'text-hc-teal' : 'text-hc-text'}`}>
                        {client}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-black text-hc-muted tabular-nums">{clientEntryCounts[client] || 0}</span>
                      <ChevronRight className={`w-3 h-3 text-hc-muted/40 transition-transform ${selectedClient === client ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {/* INTELLIGENCE VAULT: Active when client selected */}
                  {selectedClient === client && (
                    <div className="px-5 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div className={`p-3 rounded-xl border space-y-2 transition-colors ${clientProfile?.clinicalBriefing ? 'bg-flag-green/5 border-flag-green/20' : 'bg-hc-teal/5 border-hc-teal/20'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Shield className={`w-3 h-3 ${clientProfile?.clinicalBriefing ? 'text-flag-green' : 'text-hc-teal'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${clientProfile?.clinicalBriefing ? 'text-flag-green' : 'text-hc-teal'}`}>
                              Intelligence Vault
                            </span>
                          </div>
                          {clientProfile?.clinicalBriefing && (
                            <div className="w-1.5 h-1.5 rounded-full bg-flag-green animate-pulse" />
                          )}
                        </div>

                        {clientProfile?.clinicalBriefing ? (
                          <div className="space-y-1.5">
                            <p className="text-[9px] text-flag-green font-black uppercase tracking-wider">
                              {Math.round(clientProfile.clinicalBriefing.length / 1000)}K chars loaded · AI reads full context
                            </p>
                            {clientProfile.pbs && (
                              <p className="text-[9px] text-hc-muted/70 font-bold uppercase tracking-wider">+ PBS Plan active</p>
                            )}
                            {clientProfile.risk?.risks?.length ? (
                              <p className="text-[9px] text-hc-muted/70 font-bold uppercase tracking-wider">+ {clientProfile.risk.risks.length} Risk{clientProfile.risk.risks.length > 1 ? 's' : ''} active</p>
                            ) : null}
                            {clientProfile.carePlan?.domains?.filter(d => d.enabled).length ? (
                              <p className="text-[9px] text-hc-muted/70 font-bold uppercase tracking-wider">+ Care Plan active ({clientProfile.carePlan.domains.filter(d => d.enabled).length} domains)</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-[9px] text-hc-muted leading-tight font-bold uppercase tracking-wider italic">
                            Attach PBS, risk assessments or care plans to activate professional context.
                          </p>
                        )}

                        <button
                          onClick={() => document.getElementById('intel-doc-upload')?.click()}
                          disabled={importLoading}
                          className={`w-full py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${clientProfile?.clinicalBriefing ? 'bg-flag-green/10 hover:bg-flag-green/20 text-flag-green border-flag-green/10' : 'bg-hc-teal/10 hover:bg-hc-teal/20 text-hc-teal border-hc-teal/10'}`}
                        >
                          {importLoading ? 'Reading...' : clientProfile?.clinicalBriefing ? '+ Add More Docs' : '+ Add Context Doc'}
                        </button>
                        <input
                          type="file"
                          id="intel-doc-upload"
                          className="hidden"
                          accept=".pdf,.txt,.docx,.csv"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) void handleClinicalDocUpload(f);
                            if (e.target) e.target.value = '';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Main Workspace ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Workspace header */}
        <div className="px-8 py-5 border-b border-hc-border/20 flex items-center justify-between gap-6 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-black text-hc-text uppercase tracking-[0.15em]">
                {selectedClient || 'All Clients'}
              </h1>
              <span className="pill pill-teal text-[11px] font-black px-3 py-1">Note Workspace</span>
            </div>
            <p className="text-[11px] text-hc-muted font-black uppercase tracking-widest mt-1">
              {filtered.length.toLocaleString()} entries in view
              {!selectedClient && filtered.length > 0 && ' · Select a client to focus'}
              {filtered.length === 0 && hasData && storeBounds && ` · Data range: ${storeBounds.from} → ${storeBounds.to}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {storeBounds && (
              <div className="flex items-center gap-2 hc-clay-inset px-4 py-2 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-hc-teal" />
                <span className="text-[11px] font-black text-hc-muted uppercase tracking-widest">
                  Store: {storeBounds.from} → {storeBounds.to}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Date range + Gold Standard controls (Sticky Tactical Bar) */}
        <div className="px-8 py-4 border-b border-hc-border/20 flex flex-col gap-4 shrink-0 bg-hc-bg/80 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
          <DateRangePicker range={dateRange} onChange={setDateRange} entryCount={filtered.length} compact />

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => setShowGoldSuite(!showGoldSuite)}
              className="flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-black text-hc-teal uppercase tracking-widest group-hover:opacity-70 transition-opacity">
                  <Sparkles className="w-3 h-3" />
                  {showGoldSuite ? 'Hide Gold Standard Assistant' : 'Show Gold Standard Assistant'}
                </div>
                
                {selectedClient && (
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-lg animate-in fade-in duration-500 ${clientProfile?.clinicalBriefing ? 'bg-flag-green/10' : 'bg-hc-teal/10'}`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${clientProfile?.clinicalBriefing ? 'bg-flag-green' : 'bg-hc-teal'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${clientProfile?.clinicalBriefing ? 'text-flag-green' : 'text-hc-teal'}`}>
                      {clientProfile?.clinicalBriefing ? 'Vault Active' : 'Client Selected'}
                    </span>
                  </div>
                )}
              </div>

              {!showGoldSuite && goldTemplate && (
                <span className="text-[9px] font-black text-hc-muted uppercase tracking-widest italic truncate max-w-[300px]">
                  Rubric active: "{goldTemplate.slice(0, 40)}..."
                </span>
              )}
            </button>
            
            {showGoldSuite && (
              <div className="animate-in slide-in-from-top-2 duration-300 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="relative">
                      <textarea
                        value={goldTemplate}
                        onChange={e => setGoldTemplate(e.target.value)}
                        placeholder="Paste or select a template below..."
                        rows={6}
                        className="w-full hc-clay-inset p-5 text-[13px] text-hc-text/90 italic focus:outline-none resize-none scrollbar-thin rounded-2xl"
                      />
                      
                      {/* Template Selector Dropdown */}
                      <div className="absolute right-3 top-3 z-50">
                        <div className="relative">
                          <button 
                            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl hc-clay-raised text-[10px] font-black uppercase tracking-widest transition-all ${showTemplateMenu ? 'text-hc-teal scale-95' : 'text-hc-muted hover:text-hc-teal'}`}
                          >
                            Templates
                            <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${showTemplateMenu ? 'rotate-180' : 'rotate-90'}`} />
                          </button>

                          {showTemplateMenu && (
                            <div className="absolute right-0 mt-2 w-72 hc-clay-raised bg-hc-surface/95 backdrop-blur-xl rounded-2xl border border-hc-border/20 shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-200">
                              <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-none">
                                {/* System Templates */}
                                <div>
                                  <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] px-2">Templates</span>
                                  <div className="mt-2 space-y-1">
                                    {INTERNAL_TEMPLATES.map(t => (
                                      <button 
                                        key={t.id}
                                        onClick={() => { setGoldTemplate(t.content); setShowTemplateMenu(false); }}
                                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-hc-teal/10 text-[11px] font-bold text-hc-text transition-colors flex items-center justify-between group"
                                      >
                                        {t.name}
                                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* User Templates */}
                                {userTemplates.length > 0 && (
                                  <div>
                                    <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] px-2">Your Rubrics</span>
                                    <div className="mt-2 space-y-1">
                                      {userTemplates.map((t, i) => (
                                        <div key={i} className="flex items-center gap-1 group">
                                          <button 
                                            onClick={() => { setGoldTemplate(t.content); setShowTemplateMenu(false); }}
                                            className="flex-1 text-left px-3 py-2.5 rounded-xl hover:bg-hc-teal/10 text-[11px] font-bold text-hc-text transition-colors truncate"
                                          >
                                            {t.name}
                                          </button>
                                          <button onClick={() => deleteUserTemplate(i)} className="p-2 text-hc-muted hover:text-flag-red opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Save New Section */}
                                <div className="pt-3 border-t border-hc-border/20">
                                  <div className="flex gap-2">
                                    <input 
                                      value={newTemplateName}
                                      onChange={e => setNewTemplateName(e.target.value)}
                                      placeholder="Name current rubric..."
                                      className="flex-1 bg-hc-border/10 rounded-lg px-3 py-1.5 text-[10px] font-bold text-hc-text focus:outline-none"
                                    />
                                    <button 
                                      onClick={saveCustomTemplate}
                                      disabled={!newTemplateName || !goldTemplate}
                                      className="hc-clay-raised p-1.5 rounded-lg text-hc-teal disabled:opacity-30"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {goldTemplate && (
                    <button onClick={() => setGoldTemplate('')}
                      className="shrink-0 p-3 hc-clay-raised rounded-2xl text-hc-muted hover:text-flag-red transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Entry list */}
        <div 
          ref={listRef}
          id="clinical-workspace-list"
          className="flex-1 overflow-y-auto scrollbar-thin p-8 space-y-6 relative scroll-smooth"
        >
          {booting && (
            <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-hc-surface/50">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-hc-teal/20 border-t-hc-teal rounded-full animate-spin mb-4" />
                <div className="text-[11px] font-black text-hc-teal animate-pulse uppercase tracking-[0.3em]">Booting Intelligence Matrix</div>
                <div className="text-[10px] text-hc-muted uppercase mt-2">Hydrating 13,000+ clinical records</div>
              </div>
            </div>
          )}
          {!booting && !hasData && (
            <div className="flex flex-col items-center justify-center h-full text-hc-muted text-center">
              <FileText className="w-16 h-16 text-hc-muted mb-6" />
              <div className="text-sm font-black text-hc-text uppercase tracking-[0.2em]">Import a diary export to begin</div>
              <p className="text-[11px] text-hc-muted mt-2 uppercase tracking-widest">Supports CSV, Excel, PDF, ZIP — one import covers all clients</p>
            </div>
          )}

          {hasData && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-hc-muted text-center">
              <Search className="w-16 h-16 text-hc-muted mb-6" />
              <div className="text-sm font-black text-hc-text uppercase tracking-[0.2em]">No entries matched</div>
              <p className="text-[11px] text-hc-muted mt-2 uppercase tracking-widest">Adjust the date range or select a different client</p>
              {storeBounds && (
                <p className="text-[11px] text-hc-teal mt-3 font-black uppercase tracking-widest">
                  Store covers {storeBounds.from} → {storeBounds.to}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-6 mb-8 px-4">
             <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Entry Density:</span>
                <span className="text-[11px] font-black text-hc-text tabular-nums">{stats.entries} Records</span>
             </div>
             <div className="h-4 w-px bg-hc-border/30" />
             <div className="flex items-center gap-2">
                <span className={`text-[11px] font-black uppercase tracking-widest ${stats.gaps > 0 ? 'text-flag-amber' : 'text-hc-muted'}`}>
                  Continuity Gaps: {stats.gaps}
                </span>
                {stats.criticalGaps > 0 && (
                  <span className="btn-clay !bg-flag-red/10 !text-flag-red text-[9px] px-2 py-0.5 rounded-lg animate-pulse">
                    {stats.criticalGaps} DEEP SILENCE
                  </span>
                )}
             </div>
          </div>

          {reviewCoverage && (
            <div className="hc-clay-raised border border-hc-teal/20 rounded-[2rem] p-5 mb-8">
              <div className="flex flex-wrap items-center gap-4 justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-hc-teal" />
                  <span className="text-[11px] font-black text-hc-text uppercase tracking-widest">
                    Coverage Audit · {selectedClient}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">Expected notes/day</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={expectedNotesPerDay}
                    disabled={Boolean(coveragePlan)}
                    onChange={(e) => setExpectedNotesPerDay(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                    className="w-16 hc-clay-inset rounded-lg px-2 py-1 text-[11px] font-black text-hc-text focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>
              {coveragePlan && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {coveragePlan.windows.map((w) => (
                    <span key={w.id} className="pill pill-teal text-[9px]">
                      {w.start}-{w.end} · {w.hours}h
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-6 mb-4">
                <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">
                  {reviewCoverage.totalActual}/{reviewCoverage.totalExpected} notes · {reviewCoverage.coveragePct}% coverage
                </span>
                {reviewCoverage.totalHours > 0 && (
                  <span className="text-[10px] font-black text-hc-muted uppercase tracking-widest">
                    {reviewCoverage.totalHours} planned 1:1 hours
                  </span>
                )}
                <span className={`text-[10px] font-black uppercase tracking-widest ${reviewCoverage.totalMissing > 0 ? 'text-flag-amber' : 'text-flag-green'}`}>
                  Missing: {reviewCoverage.totalMissing}
                </span>
              </div>
              {reviewCoverage.missingDays.length > 0 && (
                <div className="space-y-2">
                  {reviewCoverage.missingDays.slice(0, 10).map((day) => (
                    <div key={day.date} className="hc-clay-inset rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                      <div className="text-[11px] font-black text-hc-text tabular-nums">{day.date}</div>
                      <div className="text-[10px] font-black text-hc-muted uppercase tracking-widest">
                        {day.actual}/{day.expected} present · {day.missing} missing
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <input 
                          placeholder="Optional shift context (e.g. 10am-12pm 1:1)..."
                          value={ghostContextMap[`audit-${day.date}`] || ''}
                          onChange={(e) => setGhostContextMap(prev => ({ ...prev, [`audit-${day.date}`]: e.target.value }))}
                          className="flex-1 hc-clay-inset bg-hc-surface/50 rounded-xl px-4 py-2 text-[11px] font-black text-hc-text outline-none placeholder:text-hc-muted/50"
                        />
                        <button
                          onClick={() => void runGhostWrite(`audit-${day.date}`, day.date, selectedClient || '')}
                          disabled={ghostLoadingMap[`audit-${day.date}`]}
                          className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-hc-teal/10 text-hc-teal border border-hc-teal/20 disabled:opacity-50 shadow-sm hover:bg-hc-teal/20 transition-all"
                        >
                          {ghostLoadingMap[`audit-${day.date}`] ? 'Writing...' : 'Create Note'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {visibleItems.slice(0, displayCount).map((item, i) => {
            if (item.type === 'gap') {
              const g = item as ClinicalGap;
              const ghostResult = ghostMap[g.id];
              const ghostLoading = ghostLoadingMap[g.id];
              const ghostCopied = ghostCopiedMap[g.id];
              const gapClient = g.client || selectedClient || '';
              return (
                <div key={g.id} className="space-y-3 animate-in slide-in-from-left-4">
                  <div className="hc-clay-inset border border-flag-amber/20 bg-flag-amber/[0.03] p-6 rounded-[2rem] flex items-center justify-between group">
                    <div className="flex items-center gap-8">
                      <div className="w-12 h-12 rounded-2xl bg-flag-amber/10 border border-flag-amber/30 flex items-center justify-center shrink-0">
                        <AlertTriangle className={`w-5 h-5 ${g.severity === 'red' ? 'text-flag-red animate-pulse' : 'text-flag-amber'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[11px] font-black text-flag-amber uppercase tracking-widest">Forensic Gap Detected</span>
                          <span className="text-flag-amber/30">/</span>
                          <span className="text-[12px] font-black text-hc-text tabular-nums">{g.date}</span>
                        </div>
                        <p className="text-[11px] font-medium text-hc-muted uppercase tracking-wider">
                          {g.severity === 'red'
                            ? 'Zero clinical evidence found for this entire site window.'
                            : `No diary entries for ${gapClient || g.client} on this date.`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {g.likelyCarers.length > 0 && (
                        <div className="text-right">
                          <span className="text-[9px] font-black text-hc-muted uppercase tracking-[0.2em] block mb-1">Personnel on Shift</span>
                          <div className="flex gap-1 justify-end">
                            {g.likelyCarers.slice(0, 3).map(c => (
                              <span key={c} className="text-[9px] font-bold bg-hc-border/20 px-2 py-0.5 rounded-lg">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {gapClient && (
                        <div className="flex items-center gap-3">
                          <input
                            placeholder="Optional shift context..."
                            value={ghostContextMap[g.id] || ''}
                            onChange={(e) => setGhostContextMap(prev => ({ ...prev, [g.id]: e.target.value }))}
                            className="w-56 hc-clay-inset bg-hc-surface/50 rounded-xl px-3 py-2 text-[11px] font-black text-hc-text outline-none placeholder:text-hc-muted/50"
                          />
                          <button
                            onClick={() => void runGhostWrite(g.id, g.date, gapClient)}
                            disabled={ghostLoading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-flag-amber/10 hover:bg-flag-amber/20 text-flag-amber border border-flag-amber/20 disabled:opacity-50 shrink-0"
                          >
                            <PenLine className={`w-3.5 h-3.5 ${ghostLoading ? 'animate-pulse' : ''}`} />
                            {ghostLoading ? 'Writing...' : ghostResult ? 'Rewrite' : 'Create Note'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {(ghostLoading || ghostResult) && (
                    <div className="hc-clay-raised border border-hc-teal/20 rounded-[2rem] overflow-hidden animate-in slide-in-from-top-2 duration-300">
                      <div className="px-6 py-3 border-b border-hc-border/20 flex items-center justify-between bg-hc-teal/[0.03]">
                        <div className="flex items-center gap-2">
                          <PenLine className="w-3.5 h-3.5 text-hc-teal" />
                          <span className="text-[10px] font-black text-hc-teal uppercase tracking-widest">
                            Ghost Written — {g.date} · {gapClient}
                          </span>
                        </div>
                        {ghostResult && !ghostResult.startsWith('Ghost write failed') && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                void navigator.clipboard.writeText(ghostResult);
                                setGhostCopiedMap(prev => ({ ...prev, [g.id]: true }));
                                setTimeout(() => setGhostCopiedMap(prev => ({ ...prev, [g.id]: false })), 2000);
                              }}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ghostCopied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
                            >
                              {ghostCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {ghostCopied ? 'Copied' : 'Copy'}
                            </button>
                            <button
                              onClick={() => void saveGhostAsEntry(g.id, g.date, gapClient, g.likelyCarers[0] || '', ghostResult)}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ghostSavedMap[g.id] ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {ghostSavedMap[g.id] ? 'Saved' : 'Save Entry'}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        {ghostLoading && !ghostResult ? (
                          <div className="flex items-center gap-3 text-hc-muted animate-pulse">
                            <Sparkles className="w-4 h-4 text-hc-teal animate-spin" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Reconstructing shift from clinical evidence...</span>
                          </div>
                        ) : ghostResult?.startsWith('Ghost write failed') || ghostResult?.startsWith('AI models') ? (
                          <div className="flex items-center gap-3 p-4 rounded-xl bg-flag-amber/10 border border-flag-amber/20">
                            <AlertTriangle className="w-4 h-4 text-flag-amber shrink-0" />
                            <p className="text-[11px] font-black text-flag-amber uppercase tracking-wide">{ghostResult}</p>
                          </div>
                        ) : (
                          <p className="text-[12px] font-medium text-hc-text leading-relaxed whitespace-pre-wrap">{ghostResult}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            const e = item as CareEntry;
            const key = e.id || `${e.date}-${e.carer}-${i}`;
            const rewrite = rewriteMap[key];
            const isLoading = loadingMap[key];
            const isCopied = copiedMap[key];
            const isReplacing = replaceLoadingMap[key];
            const sameDay = sameDayGroups.get(e.id);
            const linkedSameDayCount = sameDay?.entries.filter(entry => linkedEntryIds[entry.id]).length || 0;
            const isLinked = Boolean(linkedEntryIds[e.id]);
            return (
              <div key={key} className="hc-clay-raised group">
                <div className="px-6 py-4 border-b border-hc-border/20 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="hc-clay-inset px-3 py-1.5 rounded-xl text-[11px] font-black text-hc-teal tabular-nums">{e.date}</span>
                    {sameDay && sameDay.total > 1 && (
                      <span className="hc-clay-inset px-2.5 py-1 rounded-xl text-[10px] font-black text-flag-amber tabular-nums">
                        {sameDay.position} of {sameDay.total}
                      </span>
                    )}
                    <span className="text-[11px] font-black text-hc-muted uppercase tracking-wide">{e.carer}</span>
                    <span className="text-hc-muted/30 font-black">→</span>
                    <span className="text-[11px] font-black text-hc-text uppercase tracking-wide">{e.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sameDay && sameDay.total > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleLinkedEntry(e.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          isLinked ? 'bg-hc-teal text-hc-bone shadow-md' : 'hc-clay-inset text-hc-muted hover:text-hc-teal'
                        }`}
                        title={isLinked ? 'Unlink this source note' : 'Link this source note for same-day merge'}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {isLinked ? 'Linked' : 'Link'}
                      </button>
                    )}
                    {e.category && (
                      <span className="pill pill-teal text-[11px] font-black px-2.5 py-1">
                        {e.category.replace(/_/g, ' ')}
                      </span>
                    )}
                    {e.severity === 'red' && <span className="pill pill-red text-[11px] font-black px-2.5 py-1">FLAG</span>}
                    {e.severity === 'amber' && <span className="pill pill-amber text-[11px] font-black px-2.5 py-1">AMBER</span>}
                  </div>
                </div>

                {sameDay && sameDay.total > 1 && (
                  <div className="px-6 py-3 border-b border-hc-border/10 bg-hc-teal/[0.025] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-black text-hc-muted uppercase tracking-widest">
                      <Paperclip className="w-3.5 h-3.5 text-hc-teal" />
                      Same-day set: {sameDay.total} notes for {e.client} on {e.date}
                      {linkedSameDayCount > 0 && <span className="text-hc-teal">· {linkedSameDayCount} selected</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sameDay.entries.map((entry, entryIndex) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => toggleLinkedEntry(entry.id)}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                            linkedEntryIds[entry.id] ? 'bg-hc-teal text-hc-bone' : 'hc-clay-inset text-hc-muted hover:text-hc-text'
                          }`}
                        >
                          {entryIndex + 1} · {entry.time || 'no time'} · {entry.carer.split(' ')[0] || 'staff'}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={linkedSameDayCount < 2 || isLoading}
                        onClick={() => void runLinkedRewrite(key, e, sameDay.entries)}
                        className="px-4 py-1.5 rounded-xl btn-tactical text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        Merge Selected
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-hc-border/20">
                  <div className="p-6 space-y-3">
                    <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Original</div>
                    <p className="text-[12px] font-medium text-hc-text/80 leading-relaxed">{e.entry}</p>
                  </div>

                  <div className="p-6 space-y-3 bg-hc-teal/[0.02]">
                    <div className="text-[11px] font-black text-hc-teal uppercase tracking-widest">Refined Output</div>
                    {rewrite ? (
                      <div className="animate-in fade-in duration-500 flex flex-col">
                        <div className="flex-1">
                          {rewrite.startsWith('AI models are at capacity') || rewrite.startsWith('Generation failed') ? (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-flag-amber/10 border border-flag-amber/20">
                              <AlertTriangle className="w-4 h-4 text-flag-amber shrink-0" />
                              <p className="text-[11px] font-black text-flag-amber uppercase tracking-wide leading-relaxed">{rewrite}</p>
                            </div>
                          ) : (
                            <p className="text-[12px] font-medium text-hc-text leading-relaxed whitespace-pre-wrap">{rewrite}</p>
                          )}
                        </div>
                        
                        <div className="mt-6 space-y-4">
                          <div className="relative group/refine">
                            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-hc-teal/40 group-focus-within/refine:text-hc-teal transition-colors" />
                            <input 
                              value={refineInputs[key] || ''}
                              onChange={e => setRefineInputs(prev => ({ ...prev, [key]: e.target.value }))}
                              onKeyDown={evt => {
                                if (evt.key === 'Enter' && refineInputs[key]?.trim() && !isLoading) {
                                  void runRewrite(key, e.entry, e.client, refineInputs[key]);
                                }
                              }}
                              placeholder="Precise refinement (e.g. 'Add gaming detail', 'Make it shorter')..."
                              className="w-full hc-clay-inset bg-hc-teal/[0.03] pl-9 pr-4 py-2.5 rounded-xl text-[11px] font-black text-hc-text focus:outline-none placeholder:text-hc-muted/40 transition-all border border-transparent focus:border-hc-teal/20"
                            />
                          </div>

                          <div className="flex gap-3 flex-wrap">
                            <button onClick={() => copyToClipboard(key, rewrite)}
                              className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${isCopied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}>
                              {isCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {isCopied ? 'Copied' : 'Copy'}
                            </button>
                            <button 
                              onClick={() => void runRewrite(key, e.entry, e.client, refineInputs[key])}
                              disabled={isLoading}
                              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest hc-clay-inset text-hc-muted hover:text-hc-text transition-all disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                              {refineInputs[key] ? 'Refine' : 'Regenerate'}
                            </button>
                            <button
                              onClick={() => void replaceEntryWithRewrite(key, e, rewrite)}
                              disabled={isReplacing}
                              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest hc-clay-inset text-hc-muted hover:text-hc-text transition-all disabled:opacity-50"
                            >
                              <CheckCircle className={`w-3.5 h-3.5 ${isReplacing ? 'animate-pulse' : ''}`} />
                              {isReplacing ? 'Replacing...' : 'Replace Original'}
                            </button>
                            {sameDay && linkedSameDayCount > 1 && (
                              <button
                                onClick={() => void mergeReplaceAndRemoveLinked(key, e, sameDay.entries, rewrite)}
                                disabled={isReplacing}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-flag-amber/10 text-flag-amber border border-flag-amber/20 hover:bg-flag-amber/20 transition-all disabled:opacity-50"
                              >
                                <Paperclip className={`w-3.5 h-3.5 ${isReplacing ? 'animate-pulse' : ''}`} />
                                Merge + Remove Linked
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-start justify-center gap-4 py-4 text-hc-muted group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => void runRewrite(key, e.entry, e.client)}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl btn-tactical text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                          {isLoading ? 'Refining...' : 'Refine Entry'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length > displayCount && (
            <div className="flex justify-center pt-8 pb-12">
              <button 
                onClick={() => setDisplayCount(prev => prev + 30)}
                className="btn-clay px-12 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl group flex items-center gap-3"
              >
                <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
