import type { FullClient } from './client-store';
import { emptyClient, loadClients, resolveClientMatch, saveClient } from './client-store';
import type { ImportTarget, NormalizedImportEnvelope } from './import-intelligence';
import type { TemplateType } from './types';
import { exportOpsSnapshot, importOpsSnapshot, saveWeekData } from './storage';
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

  if (opts.clientMode !== 'global') {
    const candidate = envelope.clientCandidates[0] || {};
    const resolution = resolveClientMatch({
      name: candidate.name,
      nhs: candidate.nhs,
      dob: candidate.dob,
    });
    if (resolution.best) {
      return {
        client: { ...resolution.best.client },
        existed: true,
        requiresManualSelection: resolution.requiresManualSelection,
      };
    }
  }

  return { client: emptyClient(), existed: false, requiresManualSelection: opts.clientMode !== 'global' };
}

export function routeImport(envelope: NormalizedImportEnvelope, opts: RouteImportOptions): RouteImportResult {
  const messages: string[] = [];
  const warnings: string[] = [...envelope.warnings];
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
        saveWeekData(envelope.weekSummary);
        messages.push(`Loaded ${envelope.weekSummary.totalEntries} diary entries into reporting state.`);
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
      const context = {
        at: new Date().toISOString(),
        parserProfile: envelope.source.parserProfile,
        detectedType: envelope.source.detectedType,
        hasWeekSummary: !!envelope.weekSummary,
        hasAdmission: !!envelope.admission,
        hasSupportPlan: !!envelope.supportPlan,
        selectedTemplateIds: opts.selectedTemplateIds || [],
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
      : 'reports';

    return { ok: true, page, messages, warnings, requiresManualClientSelection };
  } catch (err) {
    const rollback = importOpsSnapshot(snapshot);
    const msg = err instanceof Error ? err.message : 'Unknown import error';
    const rollbackMsg = rollback.ok ? '' : ` Rollback failed: ${rollback.error}`;
    return { ok: false, page: 'upload', messages: [], warnings: [`Import rolled back: ${msg}.${rollbackMsg}`.trim()] };
  }
}
