import { useState, useRef, useEffect } from 'react';
import { Activity, Check, CheckCircle, AlertTriangle, Upload, FileText, Calendar, Trash2, Archive, Users } from 'lucide-react';
import JSZip from 'jszip';
import { emptyClient, loadClients, type FullClient } from '../lib/client-store';
import { loadWeekData, mergeWeekSummaries, uid } from '../lib/storage';
import type { WeekSummary, Page } from '../lib/types';
import type { NormalizedImportEnvelope, ImportTarget } from '../lib/import-intelligence';
import { emptyEnvelope } from '../lib/import-intelligence';
import { buildEnvelopeFromRaw } from '../lib/import-profiles';
import { routeImport, type ClientMode } from '../lib/import-router';
import { mergeClientIdentity } from '../lib/client-identity-merge';
import { mergeCarePlanData, mergeRiskData, mergeSupportPlanData } from '../lib/intel-merge';
import type { ParseResult } from '../lib/universal-import';
import { parseRosterCSV as parseGroupedRosterCSV } from '../lib/universal-parser';
import { extractFileText } from '../lib/universal-extractor';
import { appendEntries } from '../lib/entry-store';
import { parseClientRosterCSV, saveRosterShifts, getRosterSummary, type RosterSummary } from '../lib/roster-store';
import { enrichEntriesWithRoster } from '../lib/roster-store';

type UploadDetectedType = 'diary' | 'admission' | 'support-plan' | 'roster' | 'unknown';
type Step = 'choose' | 'extracting' | 'preview' | 'done' | 'error';

interface Props {
  onDataParsed: (data: WeekSummary) => void;
  setPage: (p: Page) => void;
}

interface PreviewData {
  type: UploadDetectedType;
  fileName: string;
  envelope: NormalizedImportEnvelope;
  confidence: number;
  entryCount?: number;
  dateRange?: string;
  shiftCount?: number;
  houseCount?: number;
  clientCount?: number;
  redFlags?: number;
  amberFlags?: number;
  clientName?: string;
  dob?: string;
  nhs?: string;
  domainsDetected?: number;
  supportNeeds?: number;
  warnings?: string[];
  unmappedFields?: string[];
  rawItems?: VerificationItem[];
}

interface VerificationItem {
  date?: string;
  time?: string;
  client?: string;
  staffId?: string;
  house?: string;
  entry?: string;
  hours?: string | number;
  [key: string]: unknown;
}

function errorMessage(error: unknown, fallback = 'unknown error'): string {
  return error instanceof Error ? error.message : fallback;
}

interface ZipGuidanceRow {
  id: string;
  fileName: string;
  detectedType: UploadDetectedType;
  parserProfile: string;
  confidence: number;
  suggestedTargets: ImportTarget[];
  suggestedClient: string;
  envelope: NormalizedImportEnvelope;
  selectedTarget: ImportTarget | 'skip';
  clientMode: ClientMode;
  selectedClientId: string | null;
  include: boolean;
  parseError?: string;
}

interface SourceBasketItem {
  id: string;
  fileName: string;
  envelope: NormalizedImportEnvelope;
  confidence: number;
}

function inferClientFromFileName(fileName: string): string {
  const base = fileName.split('/').pop() || fileName;
  const cleaned = base.replace(/\.[^.]+$/, '');
  const match = cleaned.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
  return match ? match[1] : 'Unclear';
}

function findClientIdByNameHint(nameHint: string): string | null {
  const hint = (nameHint || '').trim().toLowerCase();
  if (!hint || hint === 'unclear') return null;
  const clients = loadClients();
  const direct = clients.find(c => c.name.trim().toLowerCase() === hint);
  if (direct) return direct.id;
  return clients.find(c => c.name.trim().toLowerCase().includes(hint) || hint.includes(c.name.trim().toLowerCase()))?.id || null;
}

function isUsableClientHint(name: string | undefined): name is string {
  const cleaned = (name || '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'unclear') return false;
  if (/\b(experienced|support|plan|diary|medication|administration|report|client|unknown)\b/i.test(cleaned)) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 4;
}

function getClientHintFromEnvelope(envelope: NormalizedImportEnvelope, fileName: string): string {
  const candidate = envelope.clientCandidates.find(c => isUsableClientHint(c.name))?.name;
  if (candidate) return candidate;

  if (envelope.diaryEntries?.length) {
    const counts = new Map<string, number>();
    envelope.diaryEntries.forEach(entry => {
      if (isUsableClientHint(entry.client)) counts.set(entry.client, (counts.get(entry.client) || 0) + 1);
    });
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (best) return best;
  }

  const houseHint = Object.keys(envelope.weekSummary?.houses || {}).find(isUsableClientHint);
  if (houseHint) return houseHint;

  const admissionName = envelope.admission?.client?.name;
  if (isUsableClientHint(admissionName)) return admissionName;

  const fileHint = inferClientFromFileName(fileName);
  return isUsableClientHint(fileHint) ? fileHint : 'Unclear';
}

function buildEnvelopeWithExtractionGuard(fileName: string, text: string): NormalizedImportEnvelope {
  const env = buildEnvelopeFromRaw(fileName, text);
  if (!text.trim()) {
    env.warnings.push('No extractable text found in this file. Detection used filename hints only.');
  }
  return env;
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    work
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

async function extractZipGuidance(file: File, onProgress?: (p: number) => void): Promise<{ combined: string; rows: ZipGuidanceRow[]; readErrors: string[] }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  const supported = entries.filter(entry => /\.(txt|csv|tsv|md|pdf|docx|xlsx|xls|xlsm)$/i.test(entry.name));
  if (!supported.length) return { combined: '', rows: [], readErrors: [] };

  let combined = '';
  const rows: ZipGuidanceRow[] = [];
  const readErrors: string[] = [];
  const results = await Promise.all(supported.map(async (entry, i) => {
    const displayName = entry.name.split('/').pop() || entry.name;
    try {
      const ext = entry.name.split('.').pop()?.toLowerCase();
      let text = '';
      if (ext === 'pdf' || ext === 'docx' || ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
        const blob = await entry.async('blob');
        const nestedFile = new File([blob], displayName);
        text = await withTimeout(extractFileText(nestedFile), 15_000, displayName);
      } else {
        text = await withTimeout(entry.async('text'), 8_000, displayName);
      }
      const envelope = buildEnvelopeWithExtractionGuard(displayName, text);
      const suggestedClient = getClientHintFromEnvelope(envelope, displayName);
      if (onProgress) onProgress(Math.round(((i + 1) / supported.length) * 100));
      return {
        text: text.trim() ? `\n\n--- FILE: ${displayName} ---\n${text}` : '',
        row: {
          id: `${entry.name}-${uid()}`,
          fileName: displayName,
          detectedType: envelope.source.detectedType,
          parserProfile: envelope.source.parserProfile,
          confidence: envelope.source.confidence,
          suggestedTargets: envelope.suggestedTargets,
          suggestedClient,
          envelope,
          selectedTarget: envelope.suggestedTargets[0] || 'skip',
          clientMode: 'global' as ClientMode,
          selectedClientId: findClientIdByNameHint(suggestedClient),
          include: true,
        }
      };
    } catch (e) {
      if (onProgress) onProgress(Math.round(((i + 1) / supported.length) * 100));
      return { error: `${displayName}: ${errorMessage(e, 'failed')}` };
    }
  }));

  results.filter(r => r && !r.error).forEach(r => {
    combined += r!.text;
    rows.push(r!.row);
  });
  const dominantClient = rows
    .map(row => row.suggestedClient)
    .filter(isUsableClientHint)
    .reduce((acc, name) => {
      acc.set(name, (acc.get(name) || 0) + 1);
      return acc;
    }, new Map<string, number>());
  const packClient = [...dominantClient.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (packClient) {
    rows.forEach(row => {
      if (!isUsableClientHint(row.suggestedClient)) {
        row.suggestedClient = packClient;
        row.selectedClientId = findClientIdByNameHint(packClient);
      }
    });
  }
  results.filter(r => r && r.error).forEach(r => readErrors.push(r!.error));

  if (onProgress) onProgress(100);
  return { combined, rows, readErrors };
}

function buildPreview(envelope: NormalizedImportEnvelope): PreviewData {
  const base: PreviewData = {
    type: envelope.source.detectedType,
    fileName: envelope.source.fileName,
    envelope,
    confidence: envelope.source.confidence,
    warnings: envelope.warnings,
    unmappedFields: envelope.unmappedFields,
  };
  if (envelope.weekSummary) {
    base.entryCount = envelope.weekSummary.totalEntries;
    base.dateRange = envelope.weekSummary.dateFrom && envelope.weekSummary.dateTo ? `${envelope.weekSummary.dateFrom} to ${envelope.weekSummary.dateTo}` : 'N/A';
    base.houseCount = Object.keys(envelope.weekSummary.houses).length;
    base.redFlags = envelope.weekSummary.allFlags.red.length;
  }
  if (envelope.shifts?.length) {
    base.shiftCount = envelope.shifts.length;
    const dates = envelope.shifts.map(s => s.date).sort();
    base.dateRange = dates.length > 0 ? `${dates[0]} to ${dates[dates.length-1]}` : 'N/A';
  }
  if (envelope.admission) {
    base.clientName = envelope.admission.client.name;
    base.dob = envelope.admission.client.dob;
    base.domainsDetected = envelope.admission.carePlan.domains.filter(d => d.enabled).length;
  }
  if (envelope.diaryEntries?.length) base.rawItems = envelope.diaryEntries;
  else if (envelope.shifts?.length) base.rawItems = envelope.shifts;
  return base;
}

function mergeEnvelopes(envelopes: NormalizedImportEnvelope[]): NormalizedImportEnvelope {
  if (envelopes.length === 1) return envelopes[0];

  const merged = emptyEnvelope(
    'Batch',
    envelopes.map(e => `\n\n===== ${e.source.fileName} =====\n${e.rawText || ''}`).join('')
  );
  const today = new Date().toLocaleDateString('en-GB');

  const mergeAdmissionPayload = (base: ParseResult | null, incoming: ParseResult): ParseResult => {
    if (!base) return incoming;
    const identitySeed = { ...emptyClient(), ...base.client } as FullClient;
    const mergedIdentity = mergeClientIdentity(identitySeed, incoming.client);
    const mergedCarePlan = mergeCarePlanData(base.carePlan || null, incoming.carePlan || null, today) || base.carePlan;
    const mergedRisk = mergeRiskData(base.client.risk || null, incoming.client.risk || null, today);
    return {
      client: {
        ...base.client,
        ...incoming.client,
        name: mergedIdentity.name,
        preferredName: mergedIdentity.preferredName,
        dob: mergedIdentity.dob,
        nhs: mergedIdentity.nhs,
        address: mergedIdentity.address,
        phone: mergedIdentity.phone,
        keyWorker: mergedIdentity.keyWorker,
        dateOfAdmission: mergedIdentity.dateOfAdmission,
        risk: mergedRisk,
      },
      carePlan: mergedCarePlan,
      warnings: [...(base.warnings || []), ...(incoming.warnings || [])],
    };
  };

  envelopes.forEach(e => {
    if (e.weekSummary) merged.weekSummary = mergeWeekSummaries(merged.weekSummary, e.weekSummary);
    if (e.admission) merged.admission = mergeAdmissionPayload(merged.admission, e.admission);
    if (e.supportPlan) merged.supportPlan = mergeSupportPlanData(merged.supportPlan, e.supportPlan);
    merged.diaryEntries.push(...e.diaryEntries);
    merged.shifts.push(...(e.shifts || []));
    merged.clientCandidates.push(...e.clientCandidates);
    merged.suggestedTargets.push(...e.suggestedTargets);
    merged.warnings.push(...e.warnings);
    // Carry the first non-unknown detectedType so buildPreview routes correctly
    if (merged.source.detectedType === 'unknown' && e.source.detectedType !== 'unknown') {
      merged.source.detectedType = e.source.detectedType;
      merged.source.parserProfile = e.source.parserProfile;
      merged.source.confidence = e.source.confidence;
    }
  });
  merged.suggestedTargets = Array.from(new Set(merged.suggestedTargets));
  return merged;
}

function VerificationGrid({ items, type, onUpdate }: { items: VerificationItem[], type: UploadDetectedType, onUpdate: (items: VerificationItem[]) => void }) {
  if (!items?.length) return null;
  const handleChange = (i: number, f: string, v: string) => {
    const n = [...items];
    n[i] = { ...n[i], [f]: v };
    onUpdate(n);
  };
  return (
    <div className="hc-clay-raised rounded-[2rem] overflow-hidden mb-6 flex flex-col max-h-[400px]">
      <div className="p-5 border-b border-hc-muted/10 text-[11px] font-black uppercase tracking-widest text-hc-teal bg-black/[0.02]">Document Ingest Audit ({items.length} Records)</div>
      <div className="overflow-auto scrollbar-thin">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead className="sticky top-0 bg-hc-bg z-20 shadow-sm">
            <tr className="border-b border-hc-muted/10">
              {type === 'roster' ? (
                ['Personnel', 'Asset', 'Temporal', 'Duration'].map(h => <th key={h} className="px-6 py-4 text-[11px] font-black uppercase text-hc-muted tracking-widest">{h}</th>)
              ) : (
                ['Temporal', 'Subject', 'Asset', 'Diagnostic'].map(h => <th key={h} className="px-6 py-4 text-[11px] font-black uppercase text-hc-muted tracking-widest">{h}</th>)
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-hc-muted/5 bg-hc-bg/30">
            {items.map((it, idx) => (
              <tr key={idx} className="hover:bg-black/[0.02] transition-colors">
                <td className="px-6 py-3 text-[11px] text-hc-text font-black tabular-nums tracking-tighter">{it.date} {it.time || ''}</td>
                <td className="px-6 py-3"><input value={it.client || it.staffId || ''} onChange={e => handleChange(idx, it.client ? 'client' : 'staffId', e.target.value)} className="bg-transparent text-[11px] font-black text-hc-text w-full focus:outline-none focus:text-hc-teal uppercase tracking-tighter" /></td>
                <td className="px-6 py-3"><input value={it.house || ''} onChange={e => handleChange(idx, 'house', e.target.value)} className="bg-transparent text-[11px] font-black text-hc-text w-full focus:outline-none focus:text-hc-teal uppercase tracking-tighter" /></td>
                <td className="px-6 py-3 text-[11px] text-hc-muted font-black truncate max-w-[300px] uppercase italic">{it.entry || it.hours || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UploadPage({ onDataParsed, setPage }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [sourceBasket, setSourceBasket] = useState<SourceBasketItem[]>([]);
  const [zipGuidance, setZipGuidance] = useState<ZipGuidanceRow[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<ImportTarget[]>([]);
  const [clientMode, setClientMode] = useState<ClientMode>('global');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [rosterStatus, setRosterStatus] = useState<RosterSummary | null>(null);
  const [manualText, setManualText] = useState('');
  const [manualName, setManualName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const clients = loadClients();

  useEffect(() => {
    getRosterSummary().then(setRosterStatus).catch(() => {});
  }, []);

  const reset = () => {
    setStep('choose'); setPreview(null); setProgress(0); setErrorMsg('');
    setSourceBasket([]); setZipGuidance([]);
    setManualText(''); setManualName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePastedText = () => {
    const raw = manualText.trim();
    if (!raw) {
      setErrorMsg('Paste text first, then run intake.');
      setStep('error');
      return;
    }

    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = (manualName.trim() || `pasted-intake-${stamp}.txt`).replace(/\s+/g, ' ').trim();
      const env = buildEnvelopeFromRaw(fileName, raw);
      const item = { id: uid(), fileName, envelope: env, confidence: env.source.confidence };
      const nextBasket = [...sourceBasket, item];
      setSourceBasket(nextBasket);
      const combined = mergeEnvelopes(nextBasket.map(i => i.envelope));
      setPreview(buildPreview(combined));
      setSelectedTargets(combined.suggestedTargets.length ? combined.suggestedTargets : ['client-docs']);
      setStep('preview');
    } catch (e) {
      setErrorMsg(`Text intake failed: ${errorMessage(e)}`);
      setStep('error');
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    setStep('extracting'); setErrorMsg('');
    let nextBasket = [...sourceBasket];
    let nextZipGuidance: ZipGuidanceRow[] = [];
    for (const file of Array.from(files)) {
      try {
        let text = ''; const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf' || ext === 'docx' || ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') text = await extractFileText(file, setProgress);
        else if (ext === 'zip') {
          const zip = await extractZipGuidance(file, setProgress);
          nextZipGuidance = [...nextZipGuidance, ...zip.rows];
          setZipGuidance(nextZipGuidance);
          const combined = mergeEnvelopes(zip.rows.map(r => r.envelope));
          combined.source.fileName = file.name;
          combined.rawText = zip.combined;
          if (zip.readErrors.length) {
            combined.warnings.push(...zip.readErrors.map(err => `ZIP entry skipped: ${err}`));
          }
          const item = { id: uid(), fileName: file.name, envelope: combined, confidence: combined.source.confidence };
          nextBasket = [...nextBasket, item];
          setSourceBasket(nextBasket);
          setPreview(buildPreview(combined));
          setSelectedTargets(combined.suggestedTargets.length ? combined.suggestedTargets : ['reports']);
          setStep('preview');
          continue;
        } else text = await file.text();

        const env = buildEnvelopeWithExtractionGuard(file.name, text);
        const item = { id: uid(), fileName: file.name, envelope: env, confidence: env.source.confidence };
        nextBasket = [...nextBasket, item];
        setSourceBasket(nextBasket);
        
        const combined = mergeEnvelopes(nextBasket.map(i => i.envelope));
        setPreview(buildPreview(combined));
        setSelectedTargets(combined.suggestedTargets.length ? combined.suggestedTargets : ['reports']);
        setStep('preview');
      } catch (e) { setErrorMsg(`Fault: ${errorMessage(e)}`); setStep('error'); break; }
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    if (zipGuidance.length > 0) {
      const active = zipGuidance.filter(r => r.include && r.selectedTarget !== 'skip');
      await applyZipRows(active);
      return;
    }
    if (!selectedTargets.length) { setErrorMsg('Select where this import should go.'); return; }

    // ── ROSTER UPLOAD PATH ──────────────────────────────────────────────────
    // If this is a roster file, parse and save to IndexedDB, then done.
    if (preview.type === 'roster' || selectedTargets.includes('roster')) {
      try {
        const rawText = preview.envelope.rawText || '';
        let shifts = parseClientRosterCSV(rawText);
        if (shifts.length === 0) {
          // Fallback for roster exports that arrive in the grouped roster layout.
          const grouped = parseGroupedRosterCSV(rawText, preview.fileName);
          shifts = grouped.map(shift => ({
            id: shift.id,
            client: shift.house || shift.staffId || 'Unassigned',
            clientRaw: shift.house || shift.staffId || 'Unassigned',
            house: '',
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            carers: shift.staffId ? [shift.staffId] : [],
            durationHours: shift.hours,
            shiftType: shift.type === 'long_day' ? 'long' : shift.type,
          }));
        }
        if (shifts.length === 0) {
          setErrorMsg('No shifts could be parsed from this roster file. Check the format.');
          setStep('error');
          return;
        }
        await saveRosterShifts(shifts);
        const summary = await getRosterSummary();
        setRosterStatus(summary);
        setResultMsg(`Roster loaded: ${shifts.length} shifts across ${summary?.totalClients || 0} clients and ${summary?.totalCarers || 0} staff. Diary uploads from now will auto-resolve carer names.`);
        setStep('done');
        return;
      } catch (e) {
        setErrorMsg(`Roster parse failed: ${errorMessage(e)}`);
        setStep('error');
        return;
      }
    }

    // ── DIARY UPLOAD PATH ───────────────────────────────────────────────────
    const res = routeImport(preview.envelope, { targets: selectedTargets, clientMode, selectedClientId });
    if (res.ok) {
      // Persist raw entries — enriched with roster if available
      if (preview.envelope.diaryEntries?.length) {
        const enriched = await enrichEntriesWithRoster(preview.envelope.diaryEntries);
        const resolved = enriched.filter(e => e.carer !== 'Region Entry' && e.carer !== 'Personnel Unassigned').length;
        const added = appendEntries(enriched);
        if (added > 0) {
          res.messages.push(`${added} entries ingested.`);
          if (resolved > 0) res.messages.push(`${resolved} carer identities resolved via roster.`);
        }
      }
      if (selectedTargets.includes('reports')) {
        const data = loadWeekData();
        if (data) onDataParsed(data);
      }
      setResultMsg(res.messages.join(' ')); setStep('done');
    } else { setErrorMsg(res.warnings.join(' | ')); setStep('error'); }
  };

  const applyZipRows = async (rows: ZipGuidanceRow[]) => {
    let success = 0;
    let entriesAdded = 0;
    let shiftsAdded = 0;
    for (const r of rows) {
      const selectedTarget = r.selectedTarget as ImportTarget;
      if (selectedTarget === 'roster') {
        let shifts = parseClientRosterCSV(r.envelope.rawText || '');
        if (shifts.length === 0) {
          const grouped = parseGroupedRosterCSV(r.envelope.rawText || '', r.fileName);
          shifts = grouped.map(shift => ({
            id: shift.id,
            client: shift.house || shift.staffId || 'Unassigned',
            clientRaw: shift.house || shift.staffId || 'Unassigned',
            house: '',
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            carers: shift.staffId ? [shift.staffId] : [],
            durationHours: shift.hours,
            shiftType: shift.type === 'long_day' ? 'long' : shift.type,
          }));
        }
        if (shifts.length > 0) {
          await saveRosterShifts(shifts);
          shiftsAdded += shifts.length;
          success++;
        }
        continue;
      }

      const res = routeImport(r.envelope, { targets: [selectedTarget], clientMode: r.clientMode, selectedClientId: r.selectedClientId });
      if (res.ok) {
        success++;
        if (r.envelope.diaryEntries?.length) {
          const enriched = await enrichEntriesWithRoster(r.envelope.diaryEntries);
          entriesAdded += appendEntries(enriched);
        }
      }
    }
    if (success > 0) {
      const data = loadWeekData();
      if (data) onDataParsed(data);
      getRosterSummary().then(setRosterStatus).catch(() => {});
      setResultMsg(`Processed ${rows.length} files: ${success} imported. ${entriesAdded} diary entries and ${shiftsAdded} roster shifts added.`);
      setStep('done');
    } else { setErrorMsg('Unit ingestion failed.'); setStep('error'); }
  };

  const updateZipRow = (id: string, patch: Partial<ZipGuidanceRow>) => {
    setZipGuidance(rows => rows.map(row => (row.id === id ? { ...row, ...patch } : row)));
  };

  const zipIncludedCount = zipGuidance.filter(row => row.include && row.selectedTarget !== 'skip').length;
  const zipTypeCounts = zipGuidance.reduce<Record<string, number>>((acc, row) => {
    acc[row.detectedType] = (acc[row.detectedType] || 0) + 1;
    return acc;
  }, {});

  const zipMetric = (row: ZipGuidanceRow) => {
    const diaryEntries = row.envelope.diaryEntries?.length || row.envelope.weekSummary?.totalEntries || 0;
    const shifts = row.envelope.shifts?.length || 0;
    const supportNeeds = row.envelope.supportPlan?.needs?.length || 0;
    if (row.parseError) return 'Parse fault';
    if (row.detectedType === 'roster') return `${shifts} shifts`;
    if (row.detectedType === 'support-plan') return `${supportNeeds} needs`;
    if (row.detectedType === 'admission') return `${row.envelope.clientCandidates?.length || 0} clients`;
    if (diaryEntries > 0) return `${diaryEntries} entries`;
    return 'No rows';
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-hc-bg overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-12">
        {/* Header */}
        <div className="mb-12 pb-10 border-b border-hc-border/30 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-hc-text tracking-tighter uppercase leading-none mb-3">Import Hub</h1>
            <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em]">High-Density Operational Intake Protocol</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Roster status pill */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
              rosterStatus
                ? 'bg-hc-teal/5 border-hc-teal/20 text-hc-teal'
                : 'bg-flag-amber/5 border-flag-amber/20 text-flag-amber'
            }`}>
              <Users size={10} />
              {rosterStatus
                ? `Roster Active · ${rosterStatus.totalCarers} Staff · ${rosterStatus.totalClients} Clients`
                : 'No Roster Loaded · Upload Roster First'}
            </div>
            <button onClick={() => setPage('dashboard')} className="px-8 py-3.5 rounded-2xl hc-clay-raised text-[11px] font-black uppercase tracking-widest text-hc-text hover:brightness-95 transition-all">Command Center</button>
            <button onClick={reset} className="px-8 py-3.5 rounded-2xl hc-clay-raised border border-hc-muted/5 text-[11px] font-black uppercase tracking-widest text-hc-muted hover:text-hc-text transition-all">Purge Buffer</button>
          </div>
        </div>

        {step === 'choose' && (
          <div className="flex flex-col lg:flex-row gap-10 animate-in slide-in-from-bottom-4 duration-700">
            <label className="flex-[3] group relative flex flex-col items-center justify-center border-4 border-dashed border-hc-muted/10 bg-black/[0.01] p-24 rounded-[3rem] cursor-pointer hover:border-hc-teal transition-all duration-700">
              <input type="file" ref={fileRef} multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
              <div className="w-24 h-24 rounded-[2rem] hc-clay-raised flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-700 border border-hc-muted/5 shadow-2xl">
                 <Upload className="w-10 h-10 text-hc-teal" />
              </div>
              <div className="text-center">
                <div className="text-xl font-black text-hc-text uppercase tracking-[0.3em] mb-4">Initialise Intake Stream</div>
                <p className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] leading-loose">
                  Drop ZIP packs, PDF assessments, CSV/Excel diary exports,<br />or roster files
                </p>
                <div className="flex items-center justify-center gap-3 mt-6">
                  {['.zip', '.csv', '.xlsx', '.pdf', '.txt', '.docx'].map(ext => (
                    <span key={ext} className="pill pill-teal text-[11px] font-black px-2 py-1 flex items-center gap-1">
                      {ext === '.zip' && <Archive className="w-3 h-3" />}
                      {ext}
                    </span>
                  ))}
                </div>
              </div>
            </label>
            <div className="flex-1 hc-clay-raised rounded-[3rem] p-10 flex flex-col shadow-2xl border border-hc-muted/5 bg-black/[0.01]">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-hc-muted mb-10 flex items-center gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
                 Ingest Buffer [{sourceBasket.length}]
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin pr-2">
                {sourceBasket.map(i => (
                  <div key={i.id} className="p-5 hc-clay-inset rounded-2xl flex items-center justify-between group animate-in slide-in-from-right-4">
                    <span className="text-[11px] text-hc-text truncate uppercase font-black tracking-tighter">{i.fileName}</span>
                    <button onClick={() => setSourceBasket(b => b.filter(x => x.id !== i.id))} className="text-hc-muted hover:text-flag-red p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {sourceBasket.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-hc-muted py-20 grayscale">
                      <Activity className="w-10 h-10 mb-4" />
                      <div className="text-[11px] font-black uppercase tracking-widest">Buffer Empty</div>
                   </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-hc-muted/10">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-hc-muted mb-3">Raw Text Intake</div>
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Optional label e.g. Lewis reassessment"
                  className="w-full hc-clay-inset rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-wider text-hc-text mb-3 focus:outline-none"
                />
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  rows={7}
                  placeholder="Paste council assessment, support-plan text, or copied document text here..."
                  className="w-full hc-clay-inset rounded-xl px-4 py-3 text-[10px] font-black tracking-wide text-hc-text resize-y focus:outline-none"
                />
                <button
                  onClick={handlePastedText}
                  className="mt-3 w-full py-3 rounded-xl btn-tactical text-hc-bg text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
                >
                  Parse Pasted Text
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'extracting' && (
          <div className="flex-1 flex flex-col items-center justify-center py-40">
            <div className="w-full max-sm mb-8 hc-clay-inset h-5 rounded-full overflow-hidden p-1 shadow-inner">
              <div className="bg-hc-teal h-full rounded-full transition-all duration-300 shadow-[0_0_15px_#14b8a6]" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[11px] font-black text-hc-teal uppercase tracking-[0.4em] animate-pulse">Decoding Intelligence: {progress}%</div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {(preview.type === 'admission' ? [
                { l: 'Client Detected', v: preview.clientName || '—', i: <FileText className="w-4 h-4" /> },
                { l: 'Date of Birth', v: preview.dob || '—', i: <Calendar className="w-4 h-4" /> },
                { l: 'Care Domains Mapped', v: preview.domainsDetected ?? 0, i: <Activity className="w-4 h-4" /> },
                { l: 'Source Type', v: 'Admission Pack', i: <CheckCircle className="w-4 h-4" /> },
              ] : [
                { l: 'Parsed Items', v: preview.entryCount || preview.shiftCount || 0, i: <FileText className="w-4 h-4" /> },
                { l: 'Temporal Scope', v: preview.dateRange || '—', i: <Calendar className="w-4 h-4" /> },
                { l: 'Entities Active', v: preview.houseCount || 0, i: <Activity className="w-4 h-4" /> },
                { l: 'Threat Indicators', v: preview.redFlags || 0, c: 'text-flag-red', i: <AlertTriangle className="w-4 h-4" /> },
              ]).map(s => (
                <div key={s.l} className="hc-clay-raised p-8 rounded-[2rem] relative overflow-hidden group/stat border border-hc-muted/5 transition-all hover:translate-y-[-2px]">
                  <div className="absolute top-0 right-0 p-6 text-hc-muted group-hover/stat:scale-125 transition-transform">{s.i}</div>
                  <div className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] mb-4">{s.l}</div>
                  <div className={`text-2xl font-black tabular-nums tracking-tighter ${s.c || 'text-hc-text'}`}>{s.v}</div>
                </div>
              ))}
            </div>

            {zipGuidance.length > 0 ? (
              <div className="hc-clay-raised rounded-[2rem] border border-hc-muted/5 overflow-hidden shadow-2xl bg-black/[0.01]">
                <div className="p-6 border-b border-hc-muted/10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                  <div>
                    <div className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em] flex items-center gap-3">
                      <Archive className="w-4 h-4 text-hc-teal" />
                      ZIP Contents Mapping
                    </div>
                    <div className="text-[10px] font-black text-hc-muted uppercase tracking-[0.22em] mt-2">
                      {zipIncludedCount} of {zipGuidance.length} files queued · Diary {zipTypeCounts.diary || 0} · Docs {(zipTypeCounts.admission || 0) + (zipTypeCounts['support-plan'] || 0)} · Roster {zipTypeCounts.roster || 0} · Unknown {zipTypeCounts.unknown || 0}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setZipGuidance(rows => rows.map(row => ({ ...row, include: true, selectedTarget: row.selectedTarget === 'skip' ? (row.suggestedTargets[0] || 'reports') : row.selectedTarget })))}
                      className="px-4 py-3 rounded-xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-text"
                    >
                      Include All
                    </button>
                    <button
                      onClick={() => setZipGuidance(rows => rows.map(row => row.detectedType === 'unknown' ? { ...row, include: false, selectedTarget: 'skip' } : row))}
                      className="px-4 py-3 rounded-xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-muted"
                    >
                      Skip Unknown
                    </button>
                    <button
                      onClick={() => setZipGuidance(rows => rows.map(row => row.detectedType === 'diary' ? { ...row, include: true, selectedTarget: 'reports' } : row))}
                      className="px-4 py-3 rounded-xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-muted"
                    >
                      Diaries to Reports
                    </button>
                    <button
                      onClick={() => setZipGuidance(rows => rows.map(row => (row.detectedType === 'admission' || row.detectedType === 'support-plan') ? { ...row, include: true, selectedTarget: 'client-docs' } : row))}
                      className="px-4 py-3 rounded-xl hc-clay-raised text-[10px] font-black uppercase tracking-widest text-hc-muted"
                    >
                      Docs to Clients
                    </button>
                  </div>
                </div>

                <div className="max-h-[560px] overflow-auto scrollbar-thin">
                  <table className="w-full min-w-[1180px] text-left border-collapse">
                    <thead className="sticky top-0 bg-hc-bg z-10 shadow-sm">
                      <tr className="text-[9px] font-black uppercase tracking-[0.24em] text-hc-muted">
                        <th className="px-5 py-4 w-24">Use</th>
                        <th className="px-5 py-4">File</th>
                        <th className="px-5 py-4 w-44">Detected</th>
                        <th className="px-5 py-4 w-36">Evidence</th>
                        <th className="px-5 py-4 w-44">Client Hint</th>
                        <th className="px-5 py-4 w-48">Target</th>
                        <th className="px-5 py-4 w-56">Client Routing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zipGuidance.map(row => {
                        const hasWarning = row.parseError || row.envelope.warnings?.[0];
                        return (
                          <tr key={row.id} className={`border-t border-hc-muted/10 ${row.include ? 'bg-white/[0.015]' : 'opacity-55'}`}>
                            <td className="px-5 py-4 align-top">
                              <label className="inline-flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={row.include}
                                  onChange={e => updateZipRow(row.id, {
                                    include: e.target.checked,
                                    selectedTarget: e.target.checked && row.selectedTarget === 'skip' ? (row.suggestedTargets[0] || 'reports') : row.selectedTarget,
                                  })}
                                  className="sr-only"
                                />
                                <span className={`w-10 h-6 rounded-full p-1 transition-all ${row.include ? 'bg-hc-teal' : 'bg-hc-muted/20'}`}>
                                  <span className={`block w-4 h-4 rounded-full bg-hc-bg transition-transform ${row.include ? 'translate-x-4' : 'translate-x-0'}`} />
                                </span>
                              </label>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="text-[11px] font-black text-hc-text tracking-wide break-all">{row.fileName}</div>
                              {hasWarning && (
                                <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-flag-amber line-clamp-2">
                                  {row.parseError || row.envelope.warnings?.[0]}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-hc-teal/10 text-hc-teal text-[9px] font-black uppercase tracking-widest">
                                {row.detectedType.replace('-', ' ')}
                              </div>
                              <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-hc-muted">
                                {Math.round(row.confidence * 100)}% · {row.parserProfile}
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top text-[10px] font-black uppercase tracking-widest text-hc-text">
                              {zipMetric(row)}
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="text-[10px] font-black uppercase tracking-widest text-hc-text">{row.suggestedClient}</div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <select
                                value={row.selectedTarget}
                                onChange={e => updateZipRow(row.id, { selectedTarget: e.target.value as ImportTarget | 'skip', include: e.target.value !== 'skip' })}
                                className="w-full hc-clay-inset px-4 py-3 rounded-xl text-[10px] font-black uppercase text-hc-text tracking-widest outline-none"
                              >
                                <option value="reports">Reports</option>
                                <option value="templates">Templates</option>
                                <option value="client-docs">Client Docs</option>
                                <option value="roster">Roster</option>
                                <option value="skip">Skip</option>
                              </select>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <select
                                value={row.clientMode}
                                onChange={e => updateZipRow(row.id, {
                                  clientMode: e.target.value as ClientMode,
                                  selectedClientId: e.target.value === 'specific' ? (row.selectedClientId || findClientIdByNameHint(row.suggestedClient)) : null,
                                })}
                                className="w-full hc-clay-inset px-4 py-3 rounded-xl text-[10px] font-black uppercase text-hc-text tracking-widest outline-none"
                              >
                                <option value="global">Global Ledger</option>
                                <option value="auto">Auto Resolve</option>
                                <option value="specific">Specific Client</option>
                              </select>
                              {row.clientMode === 'specific' && (
                                <select
                                  value={row.selectedClientId || ''}
                                  onChange={e => updateZipRow(row.id, { selectedClientId: e.target.value || null })}
                                  className="mt-3 w-full hc-clay-inset px-4 py-3 rounded-xl text-[10px] font-black uppercase text-hc-text tracking-widest outline-none"
                                >
                                  <option value="">Select Client...</option>
                                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <VerificationGrid items={preview.rawItems || []} type={preview.type} onUpdate={items => setPreview({ ...preview, rawItems: items })} />
            )}

            <div className="hc-clay-raised p-12 rounded-[3rem] border border-hc-muted/5 bg-black/[0.01] shadow-2xl">
              {preview.type === 'diary' && !rosterStatus && (
               <div className="hc-clay-inset p-10 rounded-[3rem] border-2 border-flag-amber/30 bg-flag-amber/5 mb-10 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-150 transition-transform duration-700">
                    <Users className="w-40 h-40 text-flag-amber" />
                 </div>
                 <h3 className="text-xl font-black text-flag-amber uppercase tracking-widest mb-4 flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 animate-pulse" />
                    Missing Temporal Boundaries
                 </h3>
                 <p className="text-[12px] font-black text-hc-text/70 uppercase tracking-widest leading-relaxed mb-8 max-w-2xl relative z-10">
                    To audit 1:1 appointments correctly and group scattered task notes into shifts, the OS needs the Master Roster. Please export the Client or Carer Roster from CarePlanner and drop it below.
                 </p>
                 <div className="flex gap-4 relative z-10 mb-8">
                   <a href="https://hazelcare.nourishcare.com/roster/client-roster" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-flag-amber text-hc-bg text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-flag-amber/20">
                     Open Client Roster
                   </a>
                   <a href="https://hazelcare.nourishcare.com/roster/carer-roster" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-flag-amber text-hc-bg text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-flag-amber/20">
                     Open Carer Roster
                   </a>
                 </div>
                 <div className="p-8 border-2 border-dashed border-flag-amber/30 rounded-2xl bg-black/[0.02] relative flex flex-col items-center justify-center cursor-pointer hover:bg-flag-amber/10 transition-all z-10">
                    <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files && handleFiles(e.target.files)} />
                    <Upload className="w-8 h-8 text-flag-amber mb-3" />
                    <span className="text-[11px] font-black text-flag-amber uppercase tracking-widest">Drop Roster CSV here to unlock audit</span>
                 </div>
               </div>
              )}

              <div className="text-[11px] font-black text-hc-text uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-hc-teal shadow-[0_0_10px_#14b8a6]" />
                 Operational Routing Configuration
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
                <div className="space-y-6">
                  <label className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] ml-1">Dispatch Targets</label>
                  <div className="grid grid-cols-2 gap-4">
                    {['reports', 'templates', 'client-docs', 'roster'].map(t => (
                      <label key={t} className={`flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all border
                        ${selectedTargets.includes(t as ImportTarget) ? 'hc-clay-inset bg-hc-bg/50 border-hc-teal/30' : 'hc-clay-raised border-hc-muted/5 hover:border-hc-muted/20'}`}>
                        <input type="checkbox" className="hidden" checked={selectedTargets.includes(t as ImportTarget)} onChange={() => setSelectedTargets(p => p.includes(t as ImportTarget) ? p.filter(x => x !== t) : [...p, t as ImportTarget])} />
                        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${selectedTargets.includes(t as ImportTarget) ? 'bg-hc-teal border-hc-teal' : 'border-hc-muted/20'}`}>
                          {selectedTargets.includes(t as ImportTarget) && <Check className="w-3 h-3 text-hc-bg" strokeWidth={4} />}
                        </div>
                        <span className="text-[11px] font-black uppercase text-hc-text tracking-widest">{t.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-6">
                   <label className="text-[11px] font-black text-hc-muted uppercase tracking-[0.3em] ml-1">Entity Resolution Strategy</label>
                   <select value={clientMode} onChange={e => setClientMode(e.target.value as ClientMode)} className="w-full hc-clay-inset px-6 py-4 rounded-2xl text-[11px] font-black uppercase text-hc-text tracking-widest outline-none shadow-inner mb-4">
                     <option value="global">Ingest to Global Ledger</option>
                     <option value="auto">Auto-Synthesise Intelligence</option>
                     <option value="specific">Import into one selected client</option>
                   </select>
                   {clientMode === 'specific' && (
                     <select value={selectedClientId || ''} onChange={e => setSelectedClientId(e.target.value)} className="w-full hc-clay-inset px-6 py-4 rounded-2xl text-[11px] font-black uppercase text-hc-text tracking-widest outline-none shadow-inner animate-in slide-in-from-top-2">
                        <option value="">Select Personnel Record...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                   )}
                </div>
              </div>

              <div className="flex gap-6 pt-10 border-t border-hc-muted/10">
                <button onClick={() => handleConfirm()} className="flex-1 py-5 rounded-[1.5rem] btn-tactical text-hc-bg text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">Execute Intake Mapping</button>
                <button onClick={reset} className="px-12 hc-clay-raised border border-hc-muted/5 text-hc-muted py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:text-hc-text active:scale-95 transition-all shadow-xl">Discard Cycle</button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 animate-in zoom-in-95 duration-700">
            <div className="w-28 h-24 rounded-[2.5rem] bg-flag-green/10 border-2 border-flag-green/30 flex items-center justify-center mb-12 shadow-2xl shadow-flag-green/10">
               <Check className="w-12 h-12 text-flag-green" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-black text-hc-text tracking-tighter uppercase mb-4">Stream Ingest Successful</h2>
            <p className="text-[11px] text-hc-muted text-center max-w-sm mb-16 uppercase leading-relaxed tracking-[0.2em] font-black">"{resultMsg}"</p>
            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
              <button onClick={() => setPage('dashboard')} className="py-5 hc-clay-raised rounded-2xl text-[11px] font-black uppercase tracking-widest text-hc-text hover:brightness-95 transition-all shadow-xl">Command Center</button>
              <button onClick={reset} className="py-5 btn-tactical text-hc-bg rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-2xl">Next Segment</button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center py-24">
            <AlertTriangle className="w-16 h-16 text-flag-red mb-8 animate-pulse" />
            <h2 className="text-2xl font-black text-flag-red uppercase tracking-tighter mb-4">Ingest Fault Protocol</h2>
            <p className="text-[11px] text-hc-muted text-center max-w-md mb-12 font-mono italic">"{errorMsg}"</p>
            <button onClick={reset} className="px-12 py-4 hc-clay-raised border border-hc-muted/10 text-hc-text text-[11px] font-black uppercase tracking-widest rounded-2xl hover:brightness-95 transition-all shadow-xl">Reset Intake Module</button>
          </div>
        )}
      </div>

      <div className="mt-auto p-8 flex justify-center border-t border-hc-muted/10 bg-black/[0.02]">
        <div className="flex items-center gap-3 text-[11px] font-black text-hc-muted uppercase tracking-[0.4em]">
           <div className="w-1.5 h-1.5 rounded-full bg-hc-teal animate-pulse" />
           Import extraction audit // Local browser processing
        </div>
      </div>
    </div>
  );
}
