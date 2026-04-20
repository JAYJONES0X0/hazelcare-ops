import type { FullClient } from './client-store';
import { emptyClient, loadClients, resolveClientMatch, saveClient } from './client-store';
import type { ImportTarget, NormalizedImportEnvelope } from './import-intelligence';
import type { TemplateType } from './types';
import { exportOpsSnapshot, importOpsSnapshot, loadWeekData, mergeWeekSummaries, saveWeekData, loadShifts, saveShifts } from './storage';
import type { Page } from '../App';

const TEMPLATE_CONTEXT_KEY = 'hc-template-import-context';

export type ClientMode = 'specific' | 'auto' | 'global';

export interface RouteImportOptions {
  targets: ImportTarget[];
  clientMode: ClientMode;
  selectedClientId?: string | null;
  selectedTemplateIds?: TemplateType[];
}

export interface RouteImportResult {
  ok: boolean;
  page: Page;
  messages: string[];
  warnings: string[];
  requiresManualClientSelection?: boolean;
}

function pickClient(envelope: NormalizedImportEnvelope, opts: RouteImportOptions): { client: FullClient; existed: boolean; requiresManualSelection: boolean } {
  if (opts.clientMode === 'specific' && opts.selectedClientId) {
    const selected = loadClients().find(c => c.id === opts.selectedClientId);
    if (selected) return { client: { ...selected }, existed: true, requiresManualSelection: false };
  }

  const candidate = envelope.clientCandidates[0] || {};
  const resolution = resolveClientMatch({
    name: candidate.name,
    nhs: candidate.nhs,
    dob: candidate.dob,
  });

  if (resolution.best) {
    // In global mode we still try to prevent duplicates:
    // - always trust deterministic matches (NHS / name+DOB)
    // - trust strong fuzzy matches only (>=0.9)
    const canAutoUseGlobal =
      opts.clientMode === 'global' &&
      (resolution.best.strategy === 'nhs' || resolution.best.strategy === 'name_dob' || resolution.best.score >= 0.9);

    if (opts.clientMode !== 'global' || canAutoUseGlobal) {
      return {
        client: { ...resolution.best.client },
        existed: true,
        requiresManualSelection: opts.clientMode === 'global' ? false : resolution.requiresManualSelection,
      };
    }
  }

  return { client: emptyClient(), existed: false, requiresManualSelection: opts.clientMode !== 'global' };
}

export function routeImport(envelope: NormalizedImportEnvelope, opts: RouteImportOptions): RouteImportResult {
  const messages: string[] = [];
  const warnings: string[] = [...envelope.warnings];
  const previousWeekData = loadWeekData();
  const snapshot = exportOpsSnapshot();

  try {
    const selectedClient = opts.selectedClientId ? loadClients().find(c => c.id === opts.selectedClientId) : null;
    if (opts.clientMode === 'specific' && !opts.selectedClientId) {
      return { ok: false, page: 'upload', messages: [], warnings: ['Specific client mode requires selecting a client.'] };
    }
    if (opts.clientMode === 'specific' && opts.selectedClientId && !selectedClient) {
      return { ok: false, page: 'upload', messages: [], warnings: ['Selected client no longer exists. Choose a valid client and retry.'] };
    }

    const needsClientWrite = (opts.targets.includes('client-docs') || opts.targets.includes('templates')) && !!(envelope.admission || envelope.supportPlan);
    let preValidatedPick: { client: FullClient; existed: boolean; requiresManualSelection: boolean } | null = null;
    if (needsClientWrite) {
      preValidatedPick = pickClient(envelope, opts);
      if (opts.clientMode === 'auto' && preValidatedPick.requiresManualSelection) {
        return {
          ok: false,
          page: 'upload',
          messages: [],
          warnings: ['Client match confidence is low. Select a specific client before importing.'],
          requiresManualClientSelection: true,
        };
      }
    }

    if (opts.targets.includes('reports') || opts.targets.includes('templates')) {
      if (envelope.weekSummary) {
        const currentWeekData = loadWeekData();
        const mergedWeekData = mergeWeekSummaries(currentWeekData, envelope.weekSummary);
        saveWeekData(mergedWeekData);
        messages.push(`Loaded ${envelope.weekSummary.totalEntries} diary entries (${mergedWeekData.totalEntries} total in reporting state).`);
      } else if (opts.targets.includes('reports')) {
        warnings.push('Reports target selected but no diary summary data was parsed.');
      }
    }

    let requiresManualClientSelection = false;
    if (opts.targets.includes('client-docs') || opts.targets.includes('templates')) {
      if (envelope.admission || envelope.supportPlan) {
        const picked = preValidatedPick || pickClient(envelope, opts);
        const client = picked.client;
        requiresManualClientSelection = picked.requiresManualSelection;

        if (envelope.clientCandidates[0]?.name && !client.name) {
          client.name = envelope.clientCandidates[0].name || '';
          client.preferredName = envelope.clientCandidates[0].preferredName || client.name.split(' ')[0] || '';
        }

        if (envelope.admission) {
          Object.assign(client, envelope.admission.client);
          client.carePlan = envelope.admission.carePlan;
          messages.push(`${client.name || 'Client'} ${picked.existed ? 'updated' : 'created'} from admission/care-plan data.`);
        }

        if (envelope.supportPlan) {
          client.supportPlan = envelope.supportPlan;
          messages.push(`${client.name || 'Client'} support plan imported (${envelope.supportPlan.needs.length} areas).`);
        }

        saveClient(client as FullClient);
      } else if (opts.targets.includes('client-docs')) {
        warnings.push('Client docs target selected but no client-doc source fields were parsed.');
      }
    }

    if (opts.targets.includes('templates')) {
      let prev: Record<string, unknown> = {};
      try {
        const raw = localStorage.getItem(TEMPLATE_CONTEXT_KEY);
        if (raw) prev = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      const selectedTemplateIds =
        opts.selectedTemplateIds !== undefined
          ? opts.selectedTemplateIds
          : ((prev.selectedTemplateIds as TemplateType[] | undefined) ?? []);
      const context = {
        ...prev,
        at: new Date().toISOString(),
        parserProfile: envelope.source.parserProfile,
        detectedType: envelope.source.detectedType,
        hasWeekSummary: !!envelope.weekSummary,
        hasAdmission: !!envelope.admission,
        hasSupportPlan: !!envelope.supportPlan,
        selectedTemplateIds,
      };
      localStorage.setItem(TEMPLATE_CONTEXT_KEY, JSON.stringify(context));
      messages.push(
        (opts.selectedTemplateIds?.length || 0) > 0
          ? `Template context prepared (${opts.selectedTemplateIds!.length} selected).`
          : 'Template context prepared from imported source data.'
      );
    }

    const page: Page = opts.targets.includes('templates') && !!envelope.weekSummary
      ? 'templates'
      : opts.targets.includes('client-docs')
      ? 'client-docs'
      : opts.targets.includes('roster')
      ? 'dashboard'
      : 'reports';

    if (opts.targets.includes('roster') && envelope.shifts.length > 0) {
      const existingShifts = loadShifts();
      const staff = (() => {
        try {
          return JSON.parse(localStorage.getItem('hazelcare-staff') || '[]');
        } catch { return []; }
      })();

      const resolvedShifts = envelope.shifts.map(s => {
        const found = staff.find((sm: any) => sm.name.toLowerCase().includes(s.staffId.toLowerCase()) || s.staffId.toLowerCase().includes(sm.name.toLowerCase()));
        return {
          ...s,
          staffId: found ? found.id : s.staffId // fallback to name if not found
        };
      });

      // Filter out duplicate shifts (same staff, same date, same type)
      const merged = [...existingShifts];
      let added = 0;
      for (const rs of resolvedShifts) {
        const isDuplicate = merged.some(es => es.staffId === rs.staffId && es.date === rs.date && es.type === rs.type);
        if (!isDuplicate) {
          merged.push(rs);
          added++;
        }
      }
      saveShifts(merged);
      messages.push(`Imported ${added} new shifts to the Live Roster.`);
    }

    return { ok: true, page, messages, warnings, requiresManualClientSelection };
  } catch (err) {
    const rollback = importOpsSnapshot(snapshot);
    saveWeekData(previousWeekData);
    const msg = err instanceof Error ? err.message : 'Unknown import error';
    const rollbackMsg = rollback.ok ? '' : ` Rollback failed: ${rollback.error}`;
    return { ok: false, page: 'upload', messages: [], warnings: [`Import rolled back: ${msg}.${rollbackMsg}`.trim()] };
  }
}
