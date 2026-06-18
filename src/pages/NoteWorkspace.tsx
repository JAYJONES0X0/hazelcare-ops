import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FileText, Search, Sparkles, Copy, CheckCircle, Download, Trash2, Users, Calendar, RefreshCw, AlertTriangle, Shield, PenLine, ChevronRight, Paperclip, Layers } from 'lucide-react';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { flattenWeekEntries } from '../lib/staff-monitoring';
import { detectClinicalGaps, type ClinicalGap } from '../lib/continuity-engine';
import { parseRosterCSV } from '../lib/universal-parser';
import type { CareEntry, Shift } from '../lib/types';
import { extractFileText } from '../lib/universal-extractor';
import { getAllEntriesAsync, appendEntriesAsync, getStoreBoundsAsync, upsertEntryAsync, deleteEntriesByIdsAsync } from '../lib/entry-store';
import { DateRangePicker, type DateRange } from '../components/DateRangePicker';
import { loadClients, saveClient, emptyClient, type FullClient, type VaultDoc } from '../lib/client-store';
import { buildShiftContext, computeCoverageSummary, loadCoveragePlan, clearCoveragePlan, SUPPORT_HOUR_CAP, type CoveragePlan } from '../lib/coverage-plan';
import { splitEvidenceTrail } from '../lib/evidence-trail';
import { assessNoteStandard, buildProfessionalNoteDirective } from '../lib/note-quality-standard';
import { buildOsIntelligenceContextFromState } from '../lib/os-intelligence-context';
import { getAllRosterShifts, type RosterShift } from '../lib/roster-store';

type TimelineEntry = CareEntry & { type: 'entry' };
type TimelineGap = ClinicalGap & { type: 'gap'; entry: ''; carer: 'SYSTEM_AUDIT' };
type TimelineItem = TimelineEntry | TimelineGap;

const INTERNAL_TEMPLATES = [
  {
    id: 'hazel-golden-structure',
    name: 'Hazel Golden Structure',
    content: buildProfessionalNoteDirective()
  },
  {
    id: 'narrative-v2',
    name: 'Story-Led Narrative',
    content: `Write this as a single flowing account of the shift — no headings, no bullet points. Tell the story of what happened, in the order it happened, from the moment you arrived to the moment you left. Write in first person. The reader should be able to picture the whole shift just from reading this. Start with how the client was when you arrived, move through the day naturally, and end with how they were when you left and what the next shift needs to know.`
  },
  {
    id: 'audit-forensic',
    name: 'Structured Handover',
    content: `How they presented at the start of the shift:


What support was provided and how it went:


Meals, medication and physical health:


Any concerns, incidents or notable moments:


How they were at handover and what the next shift needs to know:`
  },
  {
    id: 'behavioral-complex',
    name: 'Behavioural Support Note',
    content: `What was happening before the behaviour occurred (the build-up, the environment, what had just happened):


What the behaviour looked like and how long it lasted:


How I responded and what I did to support them through it:


How they came through it and how they were afterwards:


What this tells us and what to watch for next time:`
  },
  {
    id: 'elite-1to1-narrative',
    name: 'Person-Centred 1:1',
    content: `What mattered to them today:


How the day actually went:


The moments that stand out (good or difficult):


How they communicated and what they were telling us:


Nutrition, hydration and physical wellbeing:


Where things stand at the end of the shift:`
  }
];

// Builds the full intelligence context for a client, prioritising structured profile data
// then distributing remaining budget evenly across vault documents so all files get fair coverage.
function buildClientIntelContext(profile: FullClient, maxChars = 72_000): string {
  const parts: string[] = [];

  // Structured profile data first — always included, concise and highest clinical value
  if (profile.diagnoses?.length) {
    parts.push(`DIAGNOSES: ${profile.diagnoses.join(', ')}`);
  }
  if (profile.carePlan) {
    if (profile.carePlan.biography) parts.push(`BIOGRAPHY: ${profile.carePlan.biography}`);
    if (profile.carePlan.criticalInfo) parts.push(`CRITICAL INFORMATION: ${profile.carePlan.criticalInfo}`);
    const active = profile.carePlan.domains.filter(d => d.enabled).map(d => `[${d.title}]: ${d.howToAchieve}`);
    if (active.length) parts.push(`CARE PLAN STRATEGIES:\n${active.join('\n')}`);
  }
  if (profile.pbs) {
    const routines = profile.pbs.routineStrategies.filter(Boolean);
    const works = profile.pbs.whatWorks.filter(Boolean);
    const doesnt = profile.pbs.doesntWork.filter(Boolean);
    if (routines.length) parts.push(`DAILY ROUTINES: ${routines.join('; ')}`);
    if (works.length) parts.push(`WHAT WORKS: ${works.join('; ')}`);
    if (doesnt.length) parts.push(`WHAT DOES NOT WORK: ${doesnt.join('; ')}`);
  }
  if (profile.risk?.risks?.length) {
    const summary = profile.risk.risks.map(r =>
      `[${r.title}]: triggers: ${r.triggers.slice(0, 2).join(', ')}; controls: ${r.controls.slice(0, 2).join('; ')}`
    );
    parts.push(`KEY RISKS:\n${summary.join('\n')}`);
  }

  // Resolve vault documents — new vaultDocs array or fall back to legacy clinicalBriefing
  const vaultDocs: VaultDoc[] = profile.vaultDocs?.length
    ? profile.vaultDocs
    : profile.clinicalBriefing
      ? [{ id: 'legacy', name: 'Uploaded Documents', text: profile.clinicalBriefing, uploadedAt: '' }]
      : [];

  if (vaultDocs.length) {
    const structuredLen = parts.join('\n\n').length;
    const vaultBudget = Math.max(8_000, maxChars - structuredLen);
    const perDoc = Math.floor(vaultBudget / vaultDocs.length);

    for (const doc of vaultDocs) {
      const excerpt = doc.text.length > perDoc
        ? doc.text.slice(0, perDoc) + `\n[...${Math.round((doc.text.length - perDoc) / 1000)}K chars of ${doc.name} omitted]`
        : doc.text;
      parts.push(`[DOCUMENT: ${doc.name}]\n${excerpt}`);
    }
  }

  return parts.join('\n\n');
}

function summariseVaultBriefing(docs: VaultDoc[]): string {
  if (!docs.length) return '';
  const preview = docs
    .slice(0, 4)
    .map((doc) => `${doc.name} (${Math.max(1, Math.round(doc.text.length / 1000))}K)`)
    .join('; ');
  const suffix = docs.length > 4 ? ` +${docs.length - 4} more` : '';
  return `Vault docs: ${docs.length} file${docs.length === 1 ? '' : 's'} · ${preview}${suffix}`;
}

function loadUserTemplates(): { name: string; content: string }[] {
  try {
    const saved = localStorage.getItem('hc_user_templates');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is { name: string; content: string } => (
      item
      && typeof item.name === 'string'
      && typeof item.content === 'string'
    ));
  } catch {
    try { localStorage.removeItem('hc_user_templates'); } catch { /* ignore */ }
    return [];
  }
}

function saveUserTemplates(templates: { name: string; content: string }[]) {
  try {
    localStorage.setItem('hc_user_templates', JSON.stringify(templates));
  } catch { /* ignore local persistence failures */ }
}

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
  const [userTemplates, setUserTemplates] = useState<{name: string, content: string}[]>(loadUserTemplates);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;

    // Fail-safe: never block the full workspace UI indefinitely on hydration.
    const bootGuard = window.setTimeout(() => {
      if (alive) setBooting(false);
    }, 2500);

    void getAllEntriesAsync().then(rows => {
      if (!alive) return;
      setEntries(rows);
      setBooting(false);
    }).catch(() => {
      if (alive) setBooting(false);
    });

    void getStoreBoundsAsync()
      .then(b => { if (alive) setStoreBounds(b); })
      .catch(() => { if (alive) setStoreBounds(null); });

    void getAllRosterShifts()
      .then(shifts => { if (alive) setRosterShifts(shifts); })
      .catch(() => { if (alive) setRosterShifts([]); });

    return () => {
      alive = false;
      window.clearTimeout(bootGuard);
    };
     
  }, []);

  useEffect(() => {
    const plan = loadCoveragePlan();
    if (!plan) return;
    
    // FORENSIC BLOCK: If the saved plan is for a blacklisted artifact, clear it.
    const EXCLUDED = ['shaun rodgers', 'shaun redgers', 'shaun'];
    if (EXCLUDED.includes(plan.client.toLowerCase().trim())) {
      clearCoveragePlan();
      return;
    }

    setCoveragePlan(plan);
    setSelectedClient(plan.client);
    setClientSearch(plan.client);
    setDateRange({ from: plan.dateFrom, to: plan.dateTo });
    setExpectedNotesPerDay(plan.windows.length || 1);
  }, []);

  const [rewriteMap, setRewriteMap] = useState<Record<string, string>>({});
  const [rewriteEvidenceMap, setRewriteEvidenceMap] = useState<Record<string, string[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [ghostMap, setGhostMap] = useState<Record<string, string>>({});
  const [ghostEvidenceMap, setGhostEvidenceMap] = useState<Record<string, string[]>>({});
  const [ghostLoadingMap, setGhostLoadingMap] = useState<Record<string, boolean>>({});
  const [ghostCopiedMap, setGhostCopiedMap] = useState<Record<string, boolean>>({});
  const [ghostSavedMap, setGhostSavedMap] = useState<Record<string, boolean>>({});
  const [ghostContextMap, setGhostContextMap] = useState<Record<string, string>>({});
  const [replaceLoadingMap, setReplaceLoadingMap] = useState<Record<string, boolean>>({});
  const [mergeActionLoadingMap, setMergeActionLoadingMap] = useState<Record<string, boolean>>({});
  const [linkedEntryIds, setLinkedEntryIds] = useState<Record<string, boolean>>({});
  const [expectedNotesPerDay, setExpectedNotesPerDay] = useState(3);
  const [displayCount, setDisplayCount] = useState(30);
  const [clientProfile, setClientProfile] = useState<FullClient | null>(null);
  const [coveragePlan, setCoveragePlan] = useState<CoveragePlan | null>(() => loadCoveragePlan());
  const [rosterShifts, setRosterShifts] = useState<RosterShift[]>([]);
  const hasVaultContext = Boolean(clientProfile?.vaultDocs?.length || clientProfile?.clinicalBriefing);

  // Reload client profile whenever selection changes
  useEffect(() => {
    if (!selectedClient) { setClientProfile(null); return; }
    const clients = loadClients();
    const p = clients.find(c => c.name.toLowerCase().trim() === selectedClient.toLowerCase().trim()) || null;
    setClientProfile(p);
  }, [selectedClient, importInfo]); // re-check after doc upload

  const allClients = useMemo(() => {
    const names = new Set<string>();
    const SKIP = new Set(['unknown', 'service user unassigned', 'personnel unassigned', 'shaun rodgers', 'shaun redgers']);
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

  // Memoize roster shifts from vault documents
  const activeRoster = useMemo(() => {
    if (!clientProfile?.vaultDocs?.length) return [];
    const rosterDocs = clientProfile.vaultDocs.filter(d => 
      d.name.toLowerCase().includes('roster') || 
      d.name.toLowerCase().includes('rota') ||
      d.text.toLowerCase().includes('roster')
    );
    
    let allShifts: Shift[] = [];
    for (const doc of rosterDocs) {
      try {
        const shifts = parseRosterCSV(doc.text, doc.name);
        allShifts = [...allShifts, ...shifts];
      } catch (e) {
        console.error('Failed to parse roster doc:', doc.name, e);
      }
    }
    return allShifts;
  }, [clientProfile]);

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

    const gaps = detectClinicalGaps(raw, activeRoster);
    const combined: TimelineItem[] = [
      ...raw.map(e => ({ ...e, type: 'entry' as const })),
      ...gaps.map(g => ({ ...g, type: 'gap' as const, entry: '' as const, carer: 'SYSTEM_AUDIT' as const }))
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
  }, [activeRoster, entries, selectedClient, dateRange]);

  const filtered = visibleItems;

  const sameDayGroups = useMemo(() => {
    const buckets = new Map<string, CareEntry[]>();
    for (const item of visibleItems) {
      if (item.type !== 'entry') continue;
      const entry = item;
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
      rawTotalHours: 0,
      hourCap: SUPPORT_HOUR_CAP,
      capApplied: false,
    };
  }, [entries, selectedClient, dateRange, expectedNotesPerDay, coveragePlan]);

  // Reset display count and transient maps on filter change
  useEffect(() => {
    setDisplayCount(30);
    setGhostContextMap({});
    setGhostMap({});
    setGhostEvidenceMap({});
    setRewriteMap({});
    setRewriteEvidenceMap({});
    setLoadingMap({});
    setGhostLoadingMap({});
  }, [selectedClient, dateRange]);

  useEffect(() => {
    if (!coveragePlan || !reviewCoverage || !selectedClient) return;
    // CRITICAL: Only generate context if the plan belongs to the ACTIVE client
    if (coveragePlan.client.toLowerCase().trim() !== selectedClient.toLowerCase().trim()) return;

    setGhostContextMap(prev => {
      const next = { ...prev };
      let changed = false;
      for (const day of reviewCoverage.missingDays) {
        const key = `audit-${day.date}`;
        if (!next[key]) {
          next[key] = buildShiftContext(
            coveragePlan,
            day.date,
            coveragePlan.windows,
          );
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [coveragePlan, reviewCoverage, selectedClient]);

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
        profile = { ...emptyClient(), name: selectedClient, preferredName: selectedClient.split(' ')[0] };
      }
      const newDoc: VaultDoc = {
        id: `vault-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        text,
        uploadedAt: new Date().toISOString(),
      };
      profile.vaultDocs = [...(profile.vaultDocs || []), newDoc];
      // Keep only a compact compatibility summary in clinicalBriefing.
      profile.clinicalBriefing = summariseVaultBriefing(profile.vaultDocs);
      saveClient(profile);
      // Reload clientProfile so UI updates immediately
      setClientProfile({ ...profile });
      const kb = Math.round(text.length / 1000);
      const total = profile.vaultDocs.length;
      setImportInfo(`Absorbed: ${file.name} · ${kb}K chars · ${total} doc${total !== 1 ? 's' : ''} in vault`);
    } catch (e) {
      setImportInfo(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleRemoveVaultDoc = (docId: string) => {
    if (!selectedClient) return;
    const clients = loadClients();
    const profile = clients.find(c => c.name.toLowerCase().trim() === selectedClient.toLowerCase().trim());
    if (!profile) return;
    profile.vaultDocs = (profile.vaultDocs || []).filter(d => d.id !== docId);
    profile.clinicalBriefing = summariseVaultBriefing(profile.vaultDocs);
    saveClient(profile);
    setClientProfile({ ...profile });
  };

  const runRewrite = async (entryKey: string, text: string, clientName: string, refineInstructions?: string) => {
    const clients = loadClients();
    const profile = clients.find(c => c.name.toLowerCase().trim() === clientName.toLowerCase().trim());

    const entry = entries.find(e => e.id === entryKey);
    const structuredContext = buildOsIntelligenceContextFromState({
      clientName,
      entry,
      entries,
      clientProfile: profile || null,
      rosterShifts,
      refineInstructions,
      maxChars: 72_000,
    });
    const legacyProfileContext = profile ? buildClientIntelContext(profile, 18_000) : '';
    const intelContext = [structuredContext, legacyProfileContext && `LEGACY CLIENT PROFILE CONTEXT:\n${legacyProfileContext}`]
      .filter(Boolean)
      .join('\n\n');
    let finalInstructions = refineInstructions || '';
    finalInstructions = [
      buildProfessionalNoteDirective(clientName),
      finalInstructions,
    ].filter(Boolean).join('\n\n');
    if (entry && (entry.carer.toLowerCase().includes('region') || entry.carer.toLowerCase().includes('unassigned'))) {
      const rosterSource: Array<RosterShift | Shift> = rosterShifts.length ? rosterShifts : activeRoster;
      const rostered = rosterSource
        .filter(s => s.date === entry.date && ('carers' in s ? s.carers.length > 0 : Boolean(s.staffId || s.id)))
        .flatMap(s => ('carers' in s && s.carers.length) ? s.carers : [('staffId' in s ? s.staffId : undefined) || s.id || 'Unknown Carer']);
      if (rostered.length > 0) {
        finalInstructions = `${finalInstructions}\nNOTE: The original record lists a generic carer ('${entry.carer}'), but the official roster for this date (${entry.date}) indicates the staff member on shift was: ${rostered.join(', ')}. Please update the narrative to reflect the correct personnel identity in the first person.`.trim();
      }
    }

    setLoadingMap(prev => ({ ...prev, [entryKey]: true }));
    setRewriteEvidenceMap(prev => ({ ...prev, [entryKey]: [] }));
    try {
      const groqRes = await fetch('/api/staff/enhance-note', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          noteType: 'Shift Note',
          clientName,
          referenceTemplate: goldTemplate || INTERNAL_TEMPLATES[0].content,
          refineInstructions: finalInstructions,
          previousOutput: rewriteMap[entryKey],
          clinicalContext: intelContext,
          includeEvidenceTrail: true,
        })
      });

      const reader = groqRes.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setRewriteMap(prev => ({ ...prev, [entryKey]: result }));
      }
      result += decoder.decode();
      const parsed = splitEvidenceTrail(result);
      setRewriteMap(prev => ({ ...prev, [entryKey]: parsed.note }));
      setRewriteEvidenceMap(prev => ({ ...prev, [entryKey]: parsed.evidence }));
      if (refineInstructions) {
        setRefineInputs(prev => ({ ...prev, [entryKey]: '' }));
      }
    } catch (e) {
      setRewriteMap(prev => ({ ...prev, [entryKey]: `Intelligence Failure: ${e instanceof Error ? e.message : 'Unknown Connection Error'}` }));
      setRewriteEvidenceMap(prev => ({ ...prev, [entryKey]: [] }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [entryKey]: false }));
    }
  };

  const isGhostFailure = (text: string) => {
    const normalized = text.toLowerCase();
    return (
      normalized.startsWith('ghost write failed')
      || normalized.startsWith('generation failed')
      || normalized.startsWith('ai models are at capacity')
      || normalized.includes('unauthorized')
      || normalized.includes('request failed')
      || normalized.includes('session not configured')
    );
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
    const clinicalContext = buildOsIntelligenceContextFromState({
      clientName: client,
      entry: null,
      entries,
      clientProfile: profile || null,
      rosterShifts,
      maxChars: 55_000,
    });

    const shiftContextRaw = ghostContextMap[gapId]?.trim() || '';
    
    // Find rostered personnel for this gap
    const gapItem = visibleItems.find((item): item is TimelineGap => item.type === 'gap' && item.id === gapId);
    const personnel = gapItem?.likelyCarers || [];
    const personnelCtx = personnel.length > 0 ? `\nPERSONNEL ON SHIFT (According to Roster): ${personnel.join(', ')}` : '';
    
    const shiftContext = (shiftContextRaw + personnelCtx).trim();

    setGhostLoadingMap(prev => ({ ...prev, [gapId]: true }));
    setGhostMap(prev => ({ ...prev, [gapId]: '' }));
    setGhostEvidenceMap(prev => ({ ...prev, [gapId]: [] }));
    try {
      const res = await fetch('/api/staff/ghost-write', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          clientName: client,
          prevNote: prevEntry ? `[${prevEntry.date} — ${prevEntry.carer}]: ${prevEntry.entry}` : '',
          nextNote: nextEntry ? `[${nextEntry.date} — ${nextEntry.carer}]: ${nextEntry.entry}` : '',
          referenceTemplate: goldTemplate || INTERNAL_TEMPLATES[0].content,
          clinicalContext,
          shiftContext,
          includeEvidenceTrail: true,
        })
      });
      if (!res.ok) {
        let message = '';
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await res.json().catch(() => null);
          message = body?.error || body?.message || '';
        }
        if (!message) {
          message = await res.text().catch(() => '');
        }
        throw new Error(message || `Request failed (${res.status})`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setGhostMap(prev => ({ ...prev, [gapId]: result }));
      }
      result += decoder.decode();
      const parsed = splitEvidenceTrail(result);
      setGhostMap(prev => ({ ...prev, [gapId]: parsed.note }));
      setGhostEvidenceMap(prev => ({ ...prev, [gapId]: parsed.evidence }));
    } catch (e) {
      setGhostMap(prev => ({ ...prev, [gapId]: `Ghost write failed: ${e instanceof Error ? e.message : 'Unknown error'}` }));
      setGhostEvidenceMap(prev => ({ ...prev, [gapId]: [] }));
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

  const parseTimeToMinutes = (raw?: string) => {
    if (!raw) return null;
    const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null;
    return (hour * 60) + minute;
  };

  const tokenize = (text: string) => text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2);

  const textSimilarity = (a: string, b: string) => {
    const setA = new Set(tokenize(a));
    const setB = new Set(tokenize(b));
    if (!setA.size || !setB.size) return 0;
    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) intersection += 1;
    }
    const union = new Set([...setA, ...setB]).size;
    return union ? intersection / union : 0;
  };

  const scoreEntryQuality = (entry: CareEntry) => {
    const lengthScore = Math.min(80, (entry.entry?.length || 0) / 20);
    const hasStructure = /(handover|medication|presentation|risk|outcome|nutrition|support)/i.test(entry.entry || '');
    const hasTime = /\b\d{1,2}[:.]\d{2}\b/.test(entry.entry || '') || Boolean(entry.time);
    const hasParagraphs = (entry.entry || '').split(/\n+/).length > 3;
    return lengthScore + (hasStructure ? 12 : 0) + (hasTime ? 8 : 0) + (hasParagraphs ? 6 : 0);
  };

  const getSuggestedLinkedIds = (groupEntries: CareEntry[]) => {
    if (groupEntries.length < 2) return [];
    const selected = new Set<string>();
    for (let i = 0; i < groupEntries.length; i += 1) {
      for (let j = i + 1; j < groupEntries.length; j += 1) {
        const first = groupEntries[i];
        const second = groupEntries[j];
        const similarity = textSimilarity(first.entry || '', second.entry || '');
        const firstMinutes = parseTimeToMinutes(first.time);
        const secondMinutes = parseTimeToMinutes(second.time);
        const closeInTime = firstMinutes !== null && secondMinutes !== null
          ? Math.abs(firstMinutes - secondMinutes) <= 210
          : false;
        if (similarity >= 0.38 || (similarity >= 0.22 && closeInTime)) {
          selected.add(first.id);
          selected.add(second.id);
        }
      }
    }
    return [...selected];
  };

  const applySuggestedLinks = (groupEntries: CareEntry[]) => {
    const suggested = getSuggestedLinkedIds(groupEntries);
    if (suggested.length < 2) return;
    setLinkedEntryIds(prev => {
      const next = { ...prev };
      for (const entry of groupEntries) delete next[entry.id];
      for (const id of suggested) next[id] = true;
      return next;
    });
  };

  const keepBestAndRemoveOthers = async (entryKey: string, groupEntries: CareEntry[]) => {
    if (groupEntries.length < 2) return;
    setMergeActionLoadingMap(prev => ({ ...prev, [entryKey]: true }));
    try {
      const best = groupEntries
        .slice()
        .sort((a, b) => scoreEntryQuality(b) - scoreEntryQuality(a))[0];
      const removeIds = groupEntries.filter(entry => entry.id !== best.id).map(entry => entry.id);
      await deleteEntriesByIdsAsync(removeIds);
      const all = await getAllEntriesAsync();
      setEntries(all);
      setLinkedEntryIds(prev => {
        const next = { ...prev };
        for (const entry of groupEntries) delete next[entry.id];
        return next;
      });
    } finally {
      setMergeActionLoadingMap(prev => ({ ...prev, [entryKey]: false }));
    }
  };

  const saveGhostAsEntry = async (ghostKey: string, date: string, client: string, carer: string, text: string) => {
    if (!text.trim()) return;
    setGhostLoadingMap(prev => ({ ...prev, [ghostKey]: true }));
    try {
      const newEntry: CareEntry = {
        id: crypto.randomUUID(),
        date,
        client,
        carer: carer || 'Personnel Unassigned',
        entry: text.trim(),
        type: 'Ghost Written',
        severity: 'none',
        flags: [],
        house: 'UNASSIGNED',
        category: 'daily_support'
      };
      await upsertEntryAsync(newEntry);
      const all = await getAllEntriesAsync();
      setEntries(all);
      setGhostSavedMap(prev => ({ ...prev, [ghostKey]: true }));
      setGhostMap(prev => {
        const next = { ...prev };
        delete next[ghostKey];
        return next;
      });
      setGhostEvidenceMap(prev => {
        const next = { ...prev };
        delete next[ghostKey];
        return next;
      });
    } catch (e) {
      console.error('Failed to save ghost entry:', e);
    } finally {
      setGhostLoadingMap(prev => ({ ...prev, [ghostKey]: false }));
    }
  };

  const runLinkedRewrite = async (entryKey: string, original: CareEntry, groupEntries: CareEntry[]) => {
    const linkedEntries = groupEntries.filter(entry => linkedEntryIds[entry.id]);
    if (linkedEntries.length < 2) return;
    const combinedText = linkedEntries
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.id.localeCompare(b.id))
      .map(entry => `[${entry.time || 'no time'} - ${entry.carer}]: ${entry.entry}`)
      .join('\n\n');
    await runRewrite(entryKey, combinedText, original.client, 'Merge these observations into a single, high-quality clinical narrative.');
  };

  const handleApplyRewrite = async (entryKey: string, original: CareEntry, rewritten: string) => {
    if (!rewritten.trim()) return;
    setReplaceLoadingMap(prev => ({ ...prev, [entryKey]: true }));
    try {
      const updated: CareEntry = { ...original, entry: rewritten.trim() };
      await upsertEntryAsync(updated);
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
      setRewriteMap(prev => {
        const next = { ...prev };
        delete next[entryKey];
        return next;
      });
      setRewriteEvidenceMap(prev => {
        const next = { ...prev };
        delete next[entryKey];
        return next;
      });
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
      setRewriteMap(prev => {
        const next = { ...prev };
        delete next[entryKey];
        return next;
      });
      setRewriteEvidenceMap(prev => {
        const next = { ...prev };
        delete next[entryKey];
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
    saveUserTemplates(updated);
    setNewTemplateName('');
    setShowTemplateMenu(false);
  };

  const deleteUserTemplate = (index: number) => {
    const updated = userTemplates.filter((_, i) => i !== index);
    setUserTemplates(updated);
    saveUserTemplates(updated);
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
          {booting && hasData ? (
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
                      <div className={`p-3 rounded-xl border space-y-2 transition-colors ${hasVaultContext ? 'bg-flag-green/5 border-flag-green/20' : 'bg-hc-teal/5 border-hc-teal/20'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Shield className={`w-3 h-3 ${hasVaultContext ? 'text-flag-green' : 'text-hc-teal'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${hasVaultContext ? 'text-flag-green' : 'text-hc-teal'}`}>
                              Intelligence Vault
                            </span>
                          </div>
                          {hasVaultContext && (
                            <div className="w-1.5 h-1.5 rounded-full bg-flag-green animate-pulse" />
                          )}
                        </div>

                        {hasVaultContext && clientProfile ? (
                          <div className="space-y-1.5">
                            {/* Per-document list */}
                            {(clientProfile.vaultDocs?.length
                              ? clientProfile.vaultDocs
                              : [{ id: 'legacy', name: 'Uploaded Documents', text: clientProfile.clinicalBriefing || '', uploadedAt: '' }]
                            ).map(doc => (
                              <div key={doc.id} className="flex items-center justify-between gap-1">
                                <span className="text-[9px] text-flag-green font-bold truncate max-w-[120px]" title={doc.name}>
                                  {doc.name}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[8px] text-hc-muted/60 font-bold tabular-nums">
                                    {Math.round(doc.text.length / 1000)}K
                                  </span>
                                  {doc.id !== 'legacy' && (
                                    <button
                                      onClick={() => handleRemoveVaultDoc(doc.id)}
                                      className="text-hc-muted/40 hover:text-flag-red transition-colors"
                                      title={`Remove ${doc.name}`}
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {/* Structured profile badges */}
                            {clientProfile.pbs && (
                              <p className="text-[9px] text-hc-muted/70 font-bold uppercase tracking-wider">+ PBS active</p>
                            )}
                            {clientProfile.risk?.risks?.length ? (
                              <p className="text-[9px] text-hc-muted/70 font-bold uppercase tracking-wider">+ {clientProfile.risk.risks.length} risk{clientProfile.risk.risks.length > 1 ? 's' : ''}</p>
                            ) : null}
                            {clientProfile.carePlan?.domains?.filter(d => d.enabled).length ? (
                              <p className="text-[9px] text-hc-muted/70 font-bold uppercase tracking-wider">+ care plan ({clientProfile.carePlan.domains.filter(d => d.enabled).length} domains)</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-[9px] text-hc-muted leading-tight font-bold uppercase tracking-wider italic">
                            Upload care plans, PBS, risk assessments or diary exports to activate full intelligence.
                          </p>
                        )}

                        <button
                          onClick={() => document.getElementById('intel-doc-upload')?.click()}
                          disabled={importLoading}
                          className={`w-full py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${hasVaultContext ? 'bg-flag-green/10 hover:bg-flag-green/20 text-flag-green border-flag-green/10' : 'bg-hc-teal/10 hover:bg-hc-teal/20 text-hc-teal border-hc-teal/10'}`}
                        >
                          {importLoading ? 'Reading...' : hasVaultContext ? '+ Add More Docs' : '+ Add Context Doc'}
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
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-lg animate-in fade-in duration-500 ${hasVaultContext ? 'bg-flag-green/10' : 'bg-hc-teal/10'}`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${hasVaultContext ? 'bg-flag-green' : 'bg-hc-teal'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${hasVaultContext ? 'text-flag-green' : 'text-hc-teal'}`}>
                      {hasVaultContext ? 'Vault Active' : 'Client Selected'}
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
            <div className="sticky top-2 z-30 flex justify-center pointer-events-none">
              <div className="hc-clay-raised px-4 py-2 rounded-xl flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-hc-teal/20 border-t-hc-teal rounded-full animate-spin" />
                <div className="text-[10px] font-black text-hc-teal uppercase tracking-widest">Hydrating records in background...</div>
              </div>
            </div>
          )}
          {!hasData && (
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
                    {reviewCoverage.capApplied ? ` (capped at ${reviewCoverage.hourCap}h)` : ''}
                  </span>
                )}
                <span className={`text-[10px] font-black uppercase tracking-widest ${reviewCoverage.totalMissing > 0 ? 'text-flag-amber' : 'text-flag-green'}`}>
                  Missing: {reviewCoverage.totalMissing}
                </span>
              </div>
              {reviewCoverage.missingDays.length > 0 && (
                <div className="space-y-2">
                  {reviewCoverage.missingDays.slice(0, 10).map((day) => (
                    <div key={day.date} className="space-y-2">
                      <div className="hc-clay-inset rounded-xl px-4 py-3 flex items-center justify-between gap-4">
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
                      {(ghostLoadingMap[`audit-${day.date}`] || ghostMap[`audit-${day.date}`]) && (
                        <div className="hc-clay-raised rounded-xl border border-hc-teal/15 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-black text-hc-teal uppercase tracking-widest">
                              Ghost Written — {day.date} · {selectedClient}
                            </span>
                            {ghostMap[`audit-${day.date}`] && !isGhostFailure(ghostMap[`audit-${day.date}`]) && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const key = `audit-${day.date}`;
                                    const text = ghostMap[key] || '';
                                    void navigator.clipboard.writeText(text);
                                    setGhostCopiedMap(prev => ({ ...prev, [key]: true }));
                                    setTimeout(() => setGhostCopiedMap(prev => ({ ...prev, [key]: false })), 2000);
                                  }}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ghostCopiedMap[`audit-${day.date}`] ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
                                >
                                  {ghostCopiedMap[`audit-${day.date}`] ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  {ghostCopiedMap[`audit-${day.date}`] ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void saveGhostAsEntry(`audit-${day.date}`, day.date, selectedClient || '', '', ghostMap[`audit-${day.date}`] || '')}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${ghostSavedMap[`audit-${day.date}`] ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'}`}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  {ghostSavedMap[`audit-${day.date}`] ? 'Saved' : 'Save Entry'}
                                </button>
                              </div>
                            )}
                          </div>
                          {ghostLoadingMap[`audit-${day.date}`] && !ghostMap[`audit-${day.date}`] ? (
                            <div className="flex items-center gap-3 text-hc-muted animate-pulse">
                              <Sparkles className="w-4 h-4 text-hc-teal animate-spin" />
                              <span className="text-[11px] font-black uppercase tracking-widest">Reconstructing shift from clinical evidence...</span>
                            </div>
                          ) : isGhostFailure(ghostMap[`audit-${day.date}`] || '') ? (
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-flag-amber/10 border border-flag-amber/20">
                              <AlertTriangle className="w-4 h-4 text-flag-amber shrink-0" />
                              <p className="text-[11px] font-black text-flag-amber uppercase tracking-wide">{ghostMap[`audit-${day.date}`]}</p>
                            </div>
                          ) : (
                            <p className="text-[12px] font-medium text-hc-text leading-relaxed whitespace-pre-wrap">{ghostMap[`audit-${day.date}`]}</p>
                          )}
                          {!ghostLoadingMap[`audit-${day.date}`]
                            && !isGhostFailure(ghostMap[`audit-${day.date}`] || '')
                            && (ghostEvidenceMap[`audit-${day.date}`] || []).length > 0 && (
                              <div className="mt-4 rounded-xl border border-hc-border/20 bg-hc-bg/30 p-3">
                                <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-2">Evidence Trail</div>
                                <div className="space-y-1.5">
                                  {(ghostEvidenceMap[`audit-${day.date}`] || []).map((line, idx) => (
                                    <div key={`${day.date}-ev-${idx}`} className="text-[10px] text-hc-muted leading-relaxed">
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
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
              const ghostEvidence = ghostEvidenceMap[g.id] || [];
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
                        {ghostResult && !isGhostFailure(ghostResult) && (
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
                        ) : isGhostFailure(ghostResult || '') ? (
                          <div className="flex items-center gap-3 p-4 rounded-xl bg-flag-amber/10 border border-flag-amber/20">
                            <AlertTriangle className="w-4 h-4 text-flag-amber shrink-0" />
                            <p className="text-[11px] font-black text-flag-amber uppercase tracking-wide">{ghostResult}</p>
                          </div>
                        ) : (
                          <p className="text-[12px] font-medium text-hc-text leading-relaxed whitespace-pre-wrap">{ghostResult}</p>
                        )}
                        {!ghostLoading && !isGhostFailure(ghostResult || '') && ghostEvidence.length > 0 && (
                          <div className="mt-4 rounded-xl border border-hc-border/20 bg-hc-bg/30 p-3">
                            <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-2">Evidence Trail</div>
                            <div className="space-y-1.5">
                              {ghostEvidence.map((line, idx) => (
                                <div key={`${g.id}-ev-${idx}`} className="text-[10px] text-hc-muted leading-relaxed">
                                  {line}
                                </div>
                              ))}
                            </div>
                          </div>
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
            const rewriteEvidence = rewriteEvidenceMap[key] || [];
            const isLoading = loadingMap[key];
            const isCopied = copiedMap[key];
            const isReplacing = replaceLoadingMap[key];
            const sameDay = sameDayGroups.get(e.id);
            const linkedSameDayCount = sameDay?.entries.filter(entry => linkedEntryIds[entry.id]).length || 0;
            const isLinked = Boolean(linkedEntryIds[e.id]);
            const suggestedLinkedIds = sameDay ? getSuggestedLinkedIds(sameDay.entries) : [];
            const hasSuggested = suggestedLinkedIds.length > 1;
            const isMergeActionLoading = mergeActionLoadingMap[key];
            const noteAssessment = assessNoteStandard(e.entry || '');
            const bestId = sameDay
              ? sameDay.entries.slice().sort((a, b) => scoreEntryQuality(b) - scoreEntryQuality(a))[0]?.id
              : null;
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
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                      noteAssessment.status === 'strong'
                        ? 'bg-flag-green/10 text-flag-green border border-flag-green/20'
                        : noteAssessment.status === 'needs-review'
                          ? 'bg-flag-amber/10 text-flag-amber border border-flag-amber/20'
                          : 'bg-flag-red/10 text-flag-red border border-flag-red/20'
                    }`}>
                      {noteAssessment.score}% note
                    </span>
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
                          {entryIndex + 1} · {entry.time || 'no time'} · {entry.carer.split(' ')[0] || 'staff'}{entry.id === bestId ? ' · best' : ''}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={!hasSuggested || isLoading}
                        onClick={() => applySuggestedLinks(sameDay.entries)}
                        className="px-4 py-1.5 rounded-xl hc-clay-inset text-[9px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-text disabled:opacity-40"
                      >
                        Use Suggested
                      </button>
                      <button
                        type="button"
                        disabled={linkedSameDayCount < 2 || isLoading}
                        onClick={() => void runLinkedRewrite(key, e, sameDay.entries)}
                        className="px-4 py-1.5 rounded-xl btn-tactical text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
                      >
                        Merge Selected
                      </button>
                      <button
                        type="button"
                        disabled={isMergeActionLoading}
                        onClick={() => void keepBestAndRemoveOthers(key, sameDay.entries)}
                        className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-flag-amber/10 text-flag-amber border border-flag-amber/20 hover:bg-flag-amber/20 disabled:opacity-40"
                      >
                        {isMergeActionLoading ? 'Keeping...' : 'Keep Best'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-hc-border/20">
                  <div className="p-6 space-y-3">
                    <div className="text-[11px] font-black text-hc-muted uppercase tracking-widest">Original</div>
                    <p className="text-[12px] font-medium text-hc-text/80 leading-relaxed">{e.entry}</p>
                    {(noteAssessment.missingIds.length > 0 || noteAssessment.risks.length > 0) && (
                      <div className="rounded-xl border border-hc-border/20 bg-hc-bg/30 p-3 space-y-2">
                        <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest">Golden Structure Review</div>
                        {noteAssessment.risks.map((risk) => (
                          <div key={risk.id} className="text-[10px] font-bold text-flag-amber leading-relaxed">
                            {risk.label}: {risk.guidance}
                          </div>
                        ))}
                        {noteAssessment.missingIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {noteAssessment.checks.filter(check => !check.passed).slice(0, 5).map((check) => (
                              <span key={check.id} className="px-2 py-1 rounded-lg bg-hc-border/20 text-[9px] font-black uppercase tracking-widest text-hc-muted">
                                Missing {check.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-6 space-y-3 bg-hc-teal/[0.02] flex flex-col">
                    <div className="text-[11px] font-black text-hc-teal uppercase tracking-widest shrink-0">Refined Output</div>
                    {rewrite ? (
                      <div className="animate-in fade-in duration-500 flex flex-col flex-1">
                        <div className="flex-1">
                          {rewrite.startsWith('AI models are at capacity') || rewrite.startsWith('Generation failed') ? (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-flag-amber/10 border border-flag-amber/20">
                              <AlertTriangle className="w-4 h-4 text-flag-amber shrink-0" />
                              <p className="text-[11px] font-black text-flag-amber uppercase tracking-wide">{rewrite}</p>
                            </div>
                          ) : (
                            <p className="text-[12px] font-medium text-hc-text leading-relaxed whitespace-pre-wrap">{rewrite}</p>
                          )}
                          {!rewrite.startsWith('AI models are at capacity')
                            && !rewrite.startsWith('Generation failed')
                            && !rewrite.startsWith('Intelligence Failure')
                            && rewriteEvidence.length > 0 && (
                              <div className="mt-4 rounded-xl border border-hc-border/20 bg-hc-bg/30 p-3">
                                <div className="text-[9px] font-black text-hc-muted uppercase tracking-widest mb-2">Evidence Trail</div>
                                <div className="space-y-1.5">
                                  {rewriteEvidence.map((line, idx) => (
                                    <div key={`${key}-ev-${idx}`} className="text-[10px] text-hc-muted leading-relaxed">
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                        <div className="mt-6 pt-6 border-t border-hc-border/10 flex flex-wrap items-center justify-between gap-4 shrink-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(key, rewrite)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                isCopied ? 'bg-flag-green text-hc-bone' : 'hc-clay-raised text-hc-text hover:text-hc-teal'
                              }`}
                            >
                              {isCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {isCopied ? 'Copied' : 'Copy'}
                            </button>
                            {!isLinked && (
                              <button
                                onClick={() => void handleApplyRewrite(key, e, rewrite)}
                                disabled={isReplacing}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hc-clay-raised text-hc-text hover:text-hc-teal disabled:opacity-50"
                              >
                                {isReplacing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                {isReplacing ? 'Replacing...' : 'Apply Over Original'}
                              </button>
                            )}
                            {isLinked && (
                              <button
                                onClick={() => void mergeReplaceAndRemoveLinked(key, e, sameDay!.entries, rewrite)}
                                disabled={isReplacing}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-hc-teal text-hc-bone shadow-md disabled:opacity-50"
                              >
                                {isReplacing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                                {isReplacing ? 'Merging...' : 'Replace All Selected'}
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                             <input 
                               value={refineInputs[key] || ''}
                               onChange={e => setRefineInputs(prev => ({ ...prev, [key]: e.target.value }))}
                               onKeyDown={ev => { if (ev.key === 'Enter') void runRewrite(key, e.entry, e.client, refineInputs[key]); }}
                               placeholder="Refine further..."
                               className="w-48 hc-clay-inset bg-hc-surface/50 rounded-xl px-3 py-2 text-[10px] font-black text-hc-text outline-none placeholder:text-hc-muted/50"
                             />
                             <button
                               onClick={() => void runRewrite(key, e.entry, e.client, refineInputs[key])}
                               disabled={isLoading}
                               className="p-2 hc-clay-raised text-hc-teal hover:scale-110 transition-transform disabled:opacity-50"
                             >
                               <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                             </button>
                          </div>
                          <p className="text-[9px] font-bold text-hc-muted/70 uppercase tracking-wider mt-1">AI assist sends the selected note text to a configured AI provider.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-hc-teal/[0.01] rounded-2xl border border-dashed border-hc-teal/20">
                        {isLoading ? (
                          <div className="flex flex-col items-center gap-4">
                            <Sparkles className="w-8 h-8 text-hc-teal animate-spin-slow" />
                            <div className="text-[10px] font-black text-hc-teal uppercase tracking-widest animate-pulse">Consulting intelligence vault...</div>
                          </div>
                        ) : (
                          <>
                            <p className="text-[11px] font-bold text-hc-muted uppercase tracking-widest mb-4">{goldTemplate ? 'Template selected' : 'Intelligence ready'}</p>
                            <button
                              onClick={() => void runRewrite(key, e.entry, e.client)}
                              className="btn-tactical text-[10px] px-8 py-3 rounded-2xl flex items-center gap-3 group"
                            >
                              <Sparkles className="w-4 h-4 text-hc-teal group-hover-scale-125 transition-transform" />
                              Refine Observation
                            </button>
                            <p className="mt-4 text-[10px] text-hc-muted/80 leading-relaxed max-w-xs">
                              Selected text is sent to configured AI providers (Gemini → OpenRouter → Groq; Groq first for task refinement) to rewrite the observation. No data is sent until you click Refine. See Subprocessor List for retention &amp; training terms.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {displayCount < filtered.length && (
            <div className="flex justify-center pt-8">
              <button
                onClick={() => setDisplayCount(prev => prev + 30)}
                className="btn-tactical text-[11px] font-black px-12 py-4 rounded-[2rem]"
              >
                Load {Math.min(30, filtered.length - displayCount)} More Records
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
