import {
  OPERATIONAL_CONTROL_KEYS,
  OPERATIONAL_LEDGER_SCHEMA_VERSION,
  OPERATIONAL_LEDGER_SOURCE,
  type AssertionPlane,
  type ControlValue,
  type EvidenceReviewState,
  type OperationalControlKey,
  type OperationalStateLedger,
} from './operational-state-intelligence';

export const OPERATIONAL_STATE_STORAGE_KEY = 'ovsite-operational-state:v2';
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RepositoryLoadResult {
  ledger: OperationalStateLedger | null;
  error?: string;
  rawRecoveryValue?: string;
}

export interface RepositoryWriteResult {
  ok: boolean;
  ledger?: OperationalStateLedger;
  error?: string;
  code?: 'INVALID_LEDGER' | 'INVALID_SNAPSHOT' | 'REPLACEMENT_CONFIRMATION_REQUIRED' | 'DEMO_NOT_PERSISTABLE' | 'STORAGE_ERROR';
}

export interface OperationalStateExport {
  schemaVersion: typeof OPERATIONAL_LEDGER_SCHEMA_VERSION;
  sourceMarker: typeof OPERATIONAL_LEDGER_SOURCE;
  exportedAt: string;
  ledger: OperationalStateLedger;
}

export interface OperationalStateRepository {
  load(): RepositoryLoadResult;
  save(ledger: OperationalStateLedger): RepositoryWriteResult;
  exportSnapshot(ledger: OperationalStateLedger, exportedAt?: string): string;
  importSnapshot(raw: string, options?: { replaceConfirmed?: boolean }): RepositoryWriteResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function hasUniqueIds(items: unknown[]): boolean {
  const ids = items.map(item => isRecord(item) ? item.id : undefined);
  return ids.every(isString) && new Set(ids as string[]).size === ids.length;
}

function containsForbiddenRawPayload(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenRawPayload);
  if (!isRecord(value)) return false;
  const forbidden = /^(raw(record|records|text|payload)|care[_-]?notes?|resident[_-]?notes?|staff[_-]?records?|medication[_-]?records?|special[_-]?category[_-]?data|record[_-]?payload)$/i;
  for (const [key, nested] of Object.entries(value)) {
    if (forbidden.test(key)) return true;
    if (containsForbiddenRawPayload(nested)) return true;
  }
  return false;
}

function topologyIsValid(ledger: OperationalStateLedger, errors: string[]): void {
  const ids = new Set(ledger.topology.map(node => node.id));
  const byId = new Map(ledger.topology.map(node => [node.id, node]));
  const organisations = ledger.topology.filter(node => node.kind === 'organisation');

  if (organisations.length !== 1 || organisations[0]?.id !== ledger.providerId) {
    errors.push('Topology must contain exactly one organisation matching providerId.');
  }

  for (const node of ledger.topology) {
    if (!isString(node.id) || !isString(node.name)) errors.push('Topology nodes require stable id and name values.');
    if (node.parentId && !ids.has(node.parentId)) errors.push(`Topology node ${node.id} has an orphaned parent.`);
    if (node.parentId === node.id) errors.push(`Topology node ${node.id} cannot parent itself.`);

    const visited = new Set<string>();
    let cursor = node;
    while (cursor.parentId) {
      if (visited.has(cursor.id)) {
        errors.push(`Topology cycle detected at ${node.id}.`);
        break;
      }
      visited.add(cursor.id);
      const parent = byId.get(cursor.parentId);
      if (!parent) break;
      cursor = parent;
    }
  }
}

function validControl(value: unknown): value is OperationalControlKey {
  return typeof value === 'string' && (OPERATIONAL_CONTROL_KEYS as string[]).includes(value);
}

function validateLedger(input: unknown): { ok: true; ledger: OperationalStateLedger } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['Ledger must be an object.'] };
  if (containsForbiddenRawPayload(input)) errors.push('Raw care/staff/medication record payloads are not permitted in the operational-state ledger.');
  if (input.schemaVersion !== OPERATIONAL_LEDGER_SCHEMA_VERSION) errors.push(`Unsupported ledger schema version: ${String(input.schemaVersion)}.`);
  if (input.sourceMarker !== OPERATIONAL_LEDGER_SOURCE) errors.push('Invalid operational-state source marker.');
  if (input.mode !== 'LIVE' && input.mode !== 'DEMO') errors.push('Ledger mode must be LIVE or DEMO.');
  if (!isString(input.providerId) || !isString(input.providerName)) errors.push('Provider id and provider name are required.');
  if (!isIsoDate(input.createdAt) || !isIsoDate(input.updatedAt)) errors.push('Ledger createdAt and updatedAt must be valid dates.');

  const arrayKeys = [
    'topology',
    'capabilityDefinitions',
    'serviceCapabilities',
    'observations',
    'evidence',
    'evidenceBindings',
    'contracts',
    'actions',
    'disputeResolutions',
  ] as const;

  for (const key of arrayKeys) {
    if (!Array.isArray(input[key])) errors.push(`${key} must be an array.`);
  }
  if (errors.length) return { ok: false, errors };

  const ledger = input as unknown as OperationalStateLedger;
  for (const key of arrayKeys) {
    if (!hasUniqueIds(ledger[key] as unknown[])) errors.push(`${key} contains missing or duplicate ids.`);
  }

  topologyIsValid(ledger, errors);
  const topology = new Map(ledger.topology.map(node => [node.id, node]));
  const definitions = new Map(ledger.capabilityDefinitions.map(item => [item.id, item]));
  const capabilities = new Map(ledger.serviceCapabilities.map(item => [item.id, item]));
  const contracts = new Map(ledger.contracts.map(item => [item.id, item]));
  const evidence = new Map(ledger.evidence.map(item => [item.id, item]));
  const observations = new Map(ledger.observations.map(item => [item.id, item]));

  for (const definition of ledger.capabilityDefinitions) {
    if (!isString(definition.id) || !isString(definition.label)) errors.push('Capability definitions require id and label.');
    if (!definition.defaultDesired || OPERATIONAL_CONTROL_KEYS.some(key => typeof definition.defaultDesired[key] !== 'boolean')) {
      errors.push(`Capability definition ${definition.id} has invalid default desired controls.`);
    }
    if (!Array.isArray(definition.foundationControls) || definition.foundationControls.some(control => !validControl(control))) {
      errors.push(`Capability definition ${definition.id} has invalid foundation controls.`);
    }
    if (definition.contractId && !contracts.has(definition.contractId)) {
      errors.push(`Capability definition ${definition.id} references missing contract ${definition.contractId}.`);
    }
  }

  for (const contract of ledger.contracts) {
    if (!isString(contract.id) || !isString(contract.name) || !Array.isArray(contract.requirements)) {
      errors.push('Evidence contracts require id, name and requirements.');
      continue;
    }
    if (!hasUniqueIds(contract.requirements as unknown[])) errors.push(`Contract ${contract.id} has duplicate requirement ids.`);
  }

  for (const capability of ledger.serviceCapabilities) {
    const node = topology.get(capability.serviceId);
    if (!node || node.kind !== 'service') errors.push(`Capability ${capability.id} must reference a service topology node.`);
    if (!definitions.has(capability.definitionId)) errors.push(`Capability ${capability.id} references missing definition ${capability.definitionId}.`);
    if (!capability.desired || OPERATIONAL_CONTROL_KEYS.some(key => typeof capability.desired[key] !== 'boolean')) {
      errors.push(`Capability ${capability.id} has invalid desired controls.`);
    }
    if (!isIsoDate(capability.createdAt) || !isIsoDate(capability.updatedAt)) errors.push(`Capability ${capability.id} has invalid timestamps.`);
  }

  const allowedPlanes = new Set<AssertionPlane>(['BELIEVED', 'OBSERVED', 'DISPUTED']);
  const allowedValues = new Set<ControlValue>(['yes', 'no', 'partial', 'unknown']);
  const nowLimit = Date.now() + FUTURE_SKEW_MS;
  for (const observation of ledger.observations) {
    if (!capabilities.has(observation.capabilityRecordId)) errors.push(`Observation ${observation.id} references a missing capability.`);
    if (!validControl(observation.control)) errors.push(`Observation ${observation.id} references an invalid control.`);
    if (!allowedPlanes.has(observation.plane)) errors.push(`Observation ${observation.id} has an invalid state plane.`);
    if (!allowedValues.has(observation.value)) errors.push(`Observation ${observation.id} has an invalid control value.`);
    if (!isIsoDate(observation.observedAt) || !isIsoDate(observation.recordedAt)) errors.push(`Observation ${observation.id} has invalid timestamps.`);
    if (isIsoDate(observation.observedAt) && Date.parse(observation.observedAt) > nowLimit) errors.push(`Observation ${observation.id} is dated too far in the future.`);
    if (observation.supersedesObservationId && !observations.has(observation.supersedesObservationId)) {
      errors.push(`Observation ${observation.id} supersedes a missing observation.`);
    }
  }

  const allowedReviewStates = new Set<EvidenceReviewState>(['PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED']);
  for (const item of ledger.evidence) {
    if (!topology.has(item.scopeNodeId)) errors.push(`Evidence ${item.id} references a missing topology scope.`);
    if (!isString(item.title) || !isString(item.sourceRef)) errors.push(`Evidence ${item.id} requires title and source reference metadata.`);
    if (!allowedReviewStates.has(item.reviewState)) errors.push(`Evidence ${item.id} has an invalid review state.`);
    if (!isIsoDate(item.observedAt)) errors.push(`Evidence ${item.id} has an invalid observed date.`);
    if (isIsoDate(item.observedAt) && Date.parse(item.observedAt) > nowLimit) errors.push(`Evidence ${item.id} is dated too far in the future.`);
    if (item.expiresAt && !isIsoDate(item.expiresAt)) errors.push(`Evidence ${item.id} has an invalid expiry date.`);
    if (item.supersedesEvidenceId && !evidence.has(item.supersedesEvidenceId)) errors.push(`Evidence ${item.id} supersedes a missing evidence item.`);
  }

  for (const binding of ledger.evidenceBindings) {
    const capability = capabilities.get(binding.capabilityRecordId);
    if (!capability) errors.push(`Evidence binding ${binding.id} references a missing capability.`);
    if (!evidence.has(binding.evidenceId)) errors.push(`Evidence binding ${binding.id} references a missing evidence item.`);
    if (binding.targetType === 'control') {
      if (!binding.control || !validControl(binding.control)) errors.push(`Evidence binding ${binding.id} has an invalid control target.`);
      if (binding.contractId || binding.requirementId) errors.push(`Control binding ${binding.id} must not also target a contract requirement.`);
    } else if (binding.targetType === 'contract_requirement') {
      if (!binding.contractId || !binding.requirementId) {
        errors.push(`Contract binding ${binding.id} requires contractId and requirementId.`);
      } else {
        const contract = contracts.get(binding.contractId);
        if (!contract || !contract.requirements.some(requirement => requirement.id === binding.requirementId)) {
          errors.push(`Contract binding ${binding.id} references a missing requirement.`);
        }
        const definition = capability ? definitions.get(capability.definitionId) : undefined;
        if (definition?.contractId !== binding.contractId) {
          errors.push(`Contract binding ${binding.id} does not match the capability Evidence Contract.`);
        }
      }
      if (binding.control) errors.push(`Contract binding ${binding.id} must bind to one exact contract requirement, not a control.`);
    } else {
      errors.push(`Evidence binding ${binding.id} has an invalid target type.`);
    }
    if (!isIsoDate(binding.createdAt)) errors.push(`Evidence binding ${binding.id} has an invalid created date.`);
  }

  for (const action of ledger.actions) {
    if (!capabilities.has(action.capabilityRecordId)) errors.push(`Action ownership ${action.deltaKey} references a missing capability.`);
    if (!isString(action.deltaKey) || !action.deltaKey.startsWith(`delta:${action.capabilityRecordId}:`)) {
      errors.push(`Action ownership for ${action.capabilityRecordId} has an invalid delta key.`);
    }
    if (!isIsoDate(action.updatedAt)) errors.push(`Action ownership ${action.deltaKey} has an invalid updated date.`);
  }

  for (const resolution of ledger.disputeResolutions) {
    if (!capabilities.has(resolution.capabilityRecordId)) errors.push(`Dispute resolution ${resolution.id} references a missing capability.`);
    if (!validControl(resolution.control)) errors.push(`Dispute resolution ${resolution.id} has an invalid control.`);
    if (!isIsoDate(resolution.resolvedAt)) errors.push(`Dispute resolution ${resolution.id} has an invalid resolved date.`);
    if (!isString(resolution.decisionNote)) errors.push(`Dispute resolution ${resolution.id} requires a decision note.`);
    if (resolution.acceptedObservationId) {
      const accepted = observations.get(resolution.acceptedObservationId);
      if (!accepted || accepted.capabilityRecordId !== resolution.capabilityRecordId || accepted.control !== resolution.control) {
        errors.push(`Dispute resolution ${resolution.id} accepts an invalid observation.`);
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, ledger };
}

function migrateSnapshot(input: unknown): { ok: true; export: OperationalStateExport } | { ok: false; error: string } {
  if (!isRecord(input)) return { ok: false, error: 'Snapshot must be a JSON object.' };
  if (input.sourceMarker !== OPERATIONAL_LEDGER_SOURCE) return { ok: false, error: 'Snapshot source marker is not OVSITE operational state.' };

  if (input.schemaVersion === OPERATIONAL_LEDGER_SCHEMA_VERSION) {
    if (!isRecord(input.ledger)) return { ok: false, error: 'Snapshot is missing its ledger payload.' };
    return { ok: true, export: input as unknown as OperationalStateExport };
  }

  if (input.schemaVersion === 1 && isRecord(input.ledger)) {
    const migratedLedger = {
      ...input.ledger,
      schemaVersion: OPERATIONAL_LEDGER_SCHEMA_VERSION,
      sourceMarker: OPERATIONAL_LEDGER_SOURCE,
      mode: input.ledger.mode === 'DEMO' ? 'DEMO' : 'LIVE',
      actions: Array.isArray(input.ledger.actions) ? input.ledger.actions : [],
      disputeResolutions: Array.isArray(input.ledger.disputeResolutions) ? input.ledger.disputeResolutions : [],
    } as unknown as OperationalStateLedger;
    return {
      ok: true,
      export: {
        schemaVersion: OPERATIONAL_LEDGER_SCHEMA_VERSION,
        sourceMarker: OPERATIONAL_LEDGER_SOURCE,
        exportedAt: isIsoDate(input.exportedAt) ? input.exportedAt : new Date().toISOString(),
        ledger: migratedLedger,
      },
    };
  }

  return { ok: false, error: `Unsupported snapshot schema version: ${String(input.schemaVersion)}.` };
}

export class BrowserOperationalStateRepository implements OperationalStateRepository {
  constructor(private readonly storage: StorageLike) {}

  load(): RepositoryLoadResult {
    const raw = this.storage.getItem(OPERATIONAL_STATE_STORAGE_KEY);
    if (!raw) return { ledger: null };
    try {
      const parsed = JSON.parse(raw) as unknown;
      const validation = validateLedger(parsed);
      if (!validation.ok) {
        return {
          ledger: null,
          error: validation.errors.join(' '),
          rawRecoveryValue: raw,
        };
      }
      if (validation.ledger.mode !== 'LIVE') {
        return {
          ledger: null,
          error: 'A demo ledger was found in live storage. It has not been loaded.',
          rawRecoveryValue: raw,
        };
      }
      return { ledger: validation.ledger };
    } catch (error) {
      return {
        ledger: null,
        error: error instanceof Error ? error.message : 'Stored operational-state ledger is corrupted.',
        rawRecoveryValue: raw,
      };
    }
  }

  save(ledger: OperationalStateLedger): RepositoryWriteResult {
    if (ledger.mode !== 'LIVE') {
      return { ok: false, code: 'DEMO_NOT_PERSISTABLE', error: 'Demo state cannot be persisted into the live operational ledger.' };
    }
    const validation = validateLedger(ledger);
    if (!validation.ok) return { ok: false, code: 'INVALID_LEDGER', error: validation.errors.join(' ') };
    try {
      this.storage.setItem(OPERATIONAL_STATE_STORAGE_KEY, JSON.stringify(validation.ledger));
      return { ok: true, ledger: validation.ledger };
    } catch (error) {
      return { ok: false, code: 'STORAGE_ERROR', error: error instanceof Error ? error.message : 'Unable to persist operational-state ledger.' };
    }
  }

  exportSnapshot(ledger: OperationalStateLedger, exportedAt = new Date().toISOString()): string {
    const validation = validateLedger(ledger);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    const snapshot: OperationalStateExport = {
      schemaVersion: OPERATIONAL_LEDGER_SCHEMA_VERSION,
      sourceMarker: OPERATIONAL_LEDGER_SOURCE,
      exportedAt,
      ledger: validation.ledger,
    };
    return JSON.stringify(snapshot, null, 2);
  }

  importSnapshot(raw: string, options: { replaceConfirmed?: boolean } = {}): RepositoryWriteResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, code: 'INVALID_SNAPSHOT', error: 'Snapshot is not valid JSON.' };
    }

    if (containsForbiddenRawPayload(parsed)) {
      return { ok: false, code: 'INVALID_SNAPSHOT', error: 'Snapshot contains raw care/staff/medication payload fields and was rejected.' };
    }

    const migrated = migrateSnapshot(parsed);
    if (!migrated.ok) return { ok: false, code: 'INVALID_SNAPSHOT', error: migrated.error };
    if (migrated.export.ledger.mode !== 'LIVE') {
      return { ok: false, code: 'DEMO_NOT_PERSISTABLE', error: 'A fictional demo snapshot cannot replace a live provider ledger.' };
    }

    const validation = validateLedger(migrated.export.ledger);
    if (!validation.ok) return { ok: false, code: 'INVALID_SNAPSHOT', error: validation.errors.join(' ') };

    const existing = this.storage.getItem(OPERATIONAL_STATE_STORAGE_KEY);
    if (existing && !options.replaceConfirmed) {
      return {
        ok: false,
        code: 'REPLACEMENT_CONFIRMATION_REQUIRED',
        error: 'A live ledger already exists. Explicit replacement confirmation is required.',
      };
    }

    try {
      this.storage.setItem(OPERATIONAL_STATE_STORAGE_KEY, JSON.stringify(validation.ledger));
      return { ok: true, ledger: validation.ledger };
    } catch (error) {
      return { ok: false, code: 'STORAGE_ERROR', error: error instanceof Error ? error.message : 'Snapshot validated but could not be written.' };
    }
  }
}

export function createBrowserOperationalStateRepository(): BrowserOperationalStateRepository {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Operational State Repository requires browser storage in Phase 2.');
  }
  return new BrowserOperationalStateRepository(window.localStorage);
}

export const __test__ = { validateLedger, migrateSnapshot, containsForbiddenRawPayload };
