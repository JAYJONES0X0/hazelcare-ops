export const OPERATIONAL_LEDGER_SCHEMA_VERSION = 2 as const;
export const OPERATIONAL_LEDGER_SOURCE = 'ovsite-operational-state' as const;

export type ControlValue = 'yes' | 'no' | 'partial' | 'unknown';
export type AssertionPlane = 'BELIEVED' | 'OBSERVED' | 'DISPUTED';
export type DerivedEpistemicState = AssertionPlane | 'EVIDENCED' | 'UNKNOWN';
export type OperationalStatus = 'VERIFIED' | 'READY' | 'PARTIAL' | 'BLOCKED' | 'UNKNOWN' | 'DISPUTED';
export type DeltaSeverity = 'critical' | 'high' | 'medium' | 'low';
export type LedgerMode = 'LIVE' | 'DEMO';

export type OperationalControlKey =
  | 'available'
  | 'enabled'
  | 'permissioned'
  | 'workflowDefined'
  | 'trained'
  | 'adopted'
  | 'evidenceVerified';

export const OPERATIONAL_CONTROL_KEYS: OperationalControlKey[] = [
  'available',
  'enabled',
  'permissioned',
  'workflowDefined',
  'trained',
  'adopted',
  'evidenceVerified',
];

export const OPERATIONAL_CONTROL_LABELS: Record<OperationalControlKey, string> = {
  available: 'Available',
  enabled: 'Enabled',
  permissioned: 'Permissioned',
  workflowDefined: 'Workflow',
  trained: 'Trained',
  adopted: 'Adopted',
  evidenceVerified: 'Evidence',
};

export type EvidenceSourceType =
  | 'system'
  | 'document'
  | 'audit'
  | 'observation'
  | 'manager_review'
  | 'integration'
  | 'policy'
  | 'training'
  | 'other';

export type EvidenceReviewState = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED';
export type ActionWorkflowStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'DONE' | 'DEFERRED';
export type CapabilityLifecycleState = 'ACTIVE' | 'PAUSED' | 'RETIRED';

export type DesiredControls = Record<OperationalControlKey, boolean>;

export interface ServiceNode {
  id: string;
  name: string;
  kind: 'organisation' | 'region' | 'service' | 'team';
  parentId?: string;
}

export interface CapabilityDefinition {
  id: string;
  label: string;
  description: string;
  domain: 'care' | 'medication' | 'handover' | 'staffing' | 'governance' | 'integration' | 'other';
  defaultDesired: DesiredControls;
  foundationControls: OperationalControlKey[];
  contractId?: string;
  severityPolicy?: Partial<Record<OperationalControlKey, DeltaSeverity>>;
}

export interface ServiceCapability {
  id: string;
  definitionId: string;
  serviceId: string;
  sourceSystem: string;
  desired: DesiredControls;
  owner?: string;
  nextReviewAt?: string;
  lifecycleState: CapabilityLifecycleState;
  createdAt: string;
  updatedAt: string;
}

export interface ControlObservationRecord {
  id: string;
  capabilityRecordId: string;
  control: OperationalControlKey;
  plane: AssertionPlane;
  value: ControlValue;
  sourceLabel: string;
  sourceRef?: string;
  observedAt: string;
  recordedAt: string;
  note?: string;
  supersedesObservationId?: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  sourceType: EvidenceSourceType;
  sourceRef: string;
  scopeNodeId: string;
  observedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  classification?: string;
  integrityFingerprint?: string;
  reviewState: EvidenceReviewState;
  expiresAt?: string;
  supersedesEvidenceId?: string;
}

export interface EvidenceBinding {
  id: string;
  evidenceId: string;
  capabilityRecordId: string;
  targetType: 'control' | 'contract_requirement';
  control?: OperationalControlKey;
  contractId?: string;
  requirementId?: string;
  createdAt: string;
}

export interface EvidenceContractRequirement {
  id: string;
  label: string;
  required: boolean;
  acceptedSourceTypes?: EvidenceSourceType[];
}

export interface EvidenceContract {
  id: string;
  name: string;
  description: string;
  chain: string[];
  requirements: EvidenceContractRequirement[];
}

export interface DeltaActionOwnership {
  deltaKey: string;
  capabilityRecordId: string;
  assignee?: string;
  targetDate?: string;
  status: ActionWorkflowStatus;
  note?: string;
  updatedAt: string;
}

export interface DisputeResolution {
  id: string;
  capabilityRecordId: string;
  control: OperationalControlKey;
  resolvedAt: string;
  decisionNote: string;
  acceptedObservationId?: string;
}

export interface OperationalStateLedger {
  schemaVersion: typeof OPERATIONAL_LEDGER_SCHEMA_VERSION;
  sourceMarker: typeof OPERATIONAL_LEDGER_SOURCE;
  mode: LedgerMode;
  providerId: string;
  providerName: string;
  createdAt: string;
  updatedAt: string;
  topology: ServiceNode[];
  capabilityDefinitions: CapabilityDefinition[];
  serviceCapabilities: ServiceCapability[];
  observations: ControlObservationRecord[];
  evidence: EvidenceItem[];
  evidenceBindings: EvidenceBinding[];
  contracts: EvidenceContract[];
  actions: DeltaActionOwnership[];
  disputeResolutions: DisputeResolution[];
}

export interface EvaluatedControl {
  control: OperationalControlKey;
  desired: boolean;
  effectiveValue: ControlValue;
  epistemic: DerivedEpistemicState;
  verified: boolean;
  disputed: boolean;
  evidenceIds: string[];
  observationId?: string;
  note?: string;
}

export interface EvidenceContractEvaluation {
  contractId: string;
  totalRequired: number;
  satisfiedRequired: number;
  completeness: number;
  complete: boolean;
  missing: EvidenceContractRequirement[];
  satisfied: EvidenceContractRequirement[];
  evidenceByRequirement: Record<string, string[]>;
}

export interface OperationalDelta {
  key: string;
  capabilityRecordId: string;
  definitionId: string;
  capabilityLabel: string;
  serviceId: string;
  targetType: 'control' | 'contract_requirement';
  control?: OperationalControlKey;
  contractId?: string;
  requirementId?: string;
  severity: DeltaSeverity;
  reason: string;
  nextAction: string;
  ownership?: DeltaActionOwnership;
}

export interface EvaluatedCapability {
  record: ServiceCapability;
  definition: CapabilityDefinition;
  status: OperationalStatus;
  readinessScore: number;
  controls: Record<OperationalControlKey, EvaluatedControl>;
  contract?: EvidenceContractEvaluation;
  deltas: OperationalDelta[];
}

export interface PatternSignal {
  id: string;
  definitionId: string;
  capabilityLabel: string;
  target: string;
  services: string[];
  count: number;
  scope: 'LOCAL' | 'CROSS_SERVICE';
  severity: DeltaSeverity;
  summary: string;
}

export interface EvaluatedOperationalState {
  ledger: OperationalStateLedger;
  capabilities: EvaluatedCapability[];
  deltas: OperationalDelta[];
  patterns: PatternSignal[];
  evaluatedAt: string;
}

let idCounter = 0;

export function createOperationalId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function blankDesiredControls(required = true): DesiredControls {
  return {
    available: required,
    enabled: required,
    permissioned: required,
    workflowDefined: required,
    trained: required,
    adopted: required,
    evidenceVerified: required,
  };
}

function cloneDesired(input: DesiredControls): DesiredControls {
  return { ...input };
}

function epoch(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestByDate<T extends { id: string; observedAt?: string; recordedAt?: string; resolvedAt?: string }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => {
    const at = epoch(a.observedAt || a.recordedAt || a.resolvedAt);
    const bt = epoch(b.observedAt || b.recordedAt || b.resolvedAt);
    return bt - at || b.id.localeCompare(a.id);
  })[0];
}

function activeObservationRecords(records: ControlObservationRecord[]): ControlObservationRecord[] {
  const superseded = new Set(records.map(item => item.supersedesObservationId).filter((id): id is string => !!id));
  return records.filter(item => !superseded.has(item.id));
}

function scopeCovers(topology: ServiceNode[], evidenceScopeId: string, serviceId: string): boolean {
  if (evidenceScopeId === serviceId) return true;
  const byId = new Map(topology.map(node => [node.id, node]));
  let cursor = byId.get(serviceId);
  const visited = new Set<string>();
  while (cursor?.parentId && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    if (cursor.parentId === evidenceScopeId) return true;
    cursor = byId.get(cursor.parentId);
  }
  return false;
}

function evidenceIsCurrent(ledger: OperationalStateLedger, item: EvidenceItem, evaluatedAt: string): boolean {
  if (item.reviewState !== 'ACCEPTED') return false;
  if (item.expiresAt && epoch(item.expiresAt) <= epoch(evaluatedAt)) return false;
  const superseded = ledger.evidence.some(other =>
    other.supersedesEvidenceId === item.id && other.id !== item.id && other.reviewState !== 'REJECTED'
  );
  return !superseded;
}

function validBoundEvidence(
  ledger: OperationalStateLedger,
  capability: ServiceCapability,
  evaluatedAt: string,
  predicate: (binding: EvidenceBinding) => boolean,
): EvidenceItem[] {
  const items = new Map(ledger.evidence.map(item => [item.id, item]));
  return ledger.evidenceBindings
    .filter(binding => binding.capabilityRecordId === capability.id && predicate(binding))
    .map(binding => items.get(binding.evidenceId))
    .filter((item): item is EvidenceItem => !!item)
    .filter(item => evidenceIsCurrent(ledger, item, evaluatedAt))
    .filter(item => scopeCovers(ledger.topology, item.scopeNodeId, capability.serviceId));
}

function observationSetForControl(
  ledger: OperationalStateLedger,
  capability: ServiceCapability,
  control: OperationalControlKey,
): ControlObservationRecord[] {
  const all = ledger.observations.filter(item => item.capabilityRecordId === capability.id && item.control === control);
  const resolution = latestByDate(
    ledger.disputeResolutions.filter(item => item.capabilityRecordId === capability.id && item.control === control)
  );

  if (!resolution) return activeObservationRecords(all);

  const afterResolution = all.filter(item => epoch(item.recordedAt) > epoch(resolution.resolvedAt));
  if (afterResolution.length > 0) return activeObservationRecords(afterResolution);

  if (resolution.acceptedObservationId) {
    const accepted = all.find(item => item.id === resolution.acceptedObservationId);
    return accepted ? [accepted] : [];
  }

  return [];
}

function evaluateControl(
  ledger: OperationalStateLedger,
  capability: ServiceCapability,
  control: OperationalControlKey,
  evaluatedAt: string,
): EvaluatedControl {
  const records = observationSetForControl(ledger, capability, control);
  const observedRecords = records.filter(item => item.plane === 'OBSERVED');
  const believedRecords = records.filter(item => item.plane === 'BELIEVED');
  const disputeRecords = records.filter(item => item.plane === 'DISPUTED');
  const directValues = new Set(observedRecords.map(item => item.value).filter(value => value !== 'unknown'));
  const disputed = disputeRecords.length > 0 || directValues.size > 1;

  const direct = latestByDate(observedRecords);
  const believed = latestByDate(believedRecords);
  const basis = direct || believed;
  const evidence = validBoundEvidence(
    ledger,
    capability,
    evaluatedAt,
    binding => binding.targetType === 'control' && binding.control === control,
  );

  const effectiveValue: ControlValue = disputed ? 'unknown' : basis?.value || 'unknown';
  const verified = !disputed && direct?.value === 'yes' && evidence.length > 0;
  const epistemic: DerivedEpistemicState = disputed
    ? 'DISPUTED'
    : verified
      ? 'EVIDENCED'
      : direct
        ? 'OBSERVED'
        : believed
          ? 'BELIEVED'
          : 'UNKNOWN';

  return {
    control,
    desired: capability.desired[control],
    effectiveValue,
    epistemic,
    verified,
    disputed,
    evidenceIds: evidence.map(item => item.id),
    observationId: basis?.id,
    note: disputed ? 'Conflicting or explicitly disputed current observations require a dated resolution.' : basis?.note,
  };
}

function readinessWeight(value: ControlValue): number {
  if (value === 'yes') return 1;
  if (value === 'partial') return 0.5;
  return 0;
}

function severityFor(definition: CapabilityDefinition, control: OperationalControlKey): DeltaSeverity {
  if (definition.severityPolicy?.[control]) return definition.severityPolicy[control] as DeltaSeverity;
  if (control === 'available') return 'critical';
  if (control === 'enabled' || control === 'permissioned' || control === 'evidenceVerified') return 'high';
  if (control === 'workflowDefined' || control === 'adopted') return 'medium';
  return 'low';
}

function nextActionFor(control: OperationalControlKey, evaluation: EvaluatedControl): string {
  if (evaluation.disputed) return 'Resolve the conflicting state with a dated management decision before further verification.';
  if (evaluation.effectiveValue === 'yes' && !evaluation.verified) {
    return `Bind accepted, in-scope evidence to ${OPERATIONAL_CONTROL_LABELS[control]} and confirm the state by direct observation.`;
  }
  switch (control) {
    case 'available': return 'Confirm entitlement, integration availability, or an approved alternative route.';
    case 'enabled': return 'Enable or configure the capability in the execution/source system.';
    case 'permissioned': return 'Review role access and assign the required permissions.';
    case 'workflowDefined': return 'Define the operating rule, owner, trigger and exception route.';
    case 'trained': return 'Brief or train the roles expected to operate the workflow.';
    case 'adopted': return 'Pilot the workflow and obtain evidence of consistent operational use.';
    case 'evidenceVerified': return 'Collect and review direct evidence that the intended state is operating in reality.';
  }
}

function reasonForControl(control: OperationalControlKey, evaluation: EvaluatedControl): string {
  const label = OPERATIONAL_CONTROL_LABELS[control];
  if (evaluation.disputed) return `${label} has conflicting current observations and is disputed.`;
  if (evaluation.effectiveValue !== 'yes') return `${label} is ${evaluation.effectiveValue}; desired state requires yes.`;
  if (evaluation.epistemic === 'BELIEVED') return `${label} is a belief/assertion and has not been directly observed.`;
  if (evaluation.epistemic === 'OBSERVED' && evaluation.evidenceIds.length === 0) return `${label} is observed as yes but has no accepted requirement-specific evidence binding.`;
  return `${label} is not yet verified.`;
}

export function evaluateEvidenceContractForCapability(
  ledger: OperationalStateLedger,
  capability: ServiceCapability,
  contract: EvidenceContract,
  evaluatedAt = new Date().toISOString(),
): EvidenceContractEvaluation {
  const required = contract.requirements.filter(item => item.required);
  const evidenceByRequirement: Record<string, string[]> = {};

  const satisfied = required.filter(requirement => {
    const evidence = validBoundEvidence(
      ledger,
      capability,
      evaluatedAt,
      binding => binding.targetType === 'contract_requirement'
        && binding.contractId === contract.id
        && binding.requirementId === requirement.id,
    ).filter(item => !requirement.acceptedSourceTypes?.length || requirement.acceptedSourceTypes.includes(item.sourceType));

    evidenceByRequirement[requirement.id] = evidence.map(item => item.id);
    return evidence.length > 0;
  });

  const satisfiedIds = new Set(satisfied.map(item => item.id));
  const missing = required.filter(item => !satisfiedIds.has(item.id));
  const completeness = required.length === 0 ? 100 : Math.round((satisfied.length / required.length) * 100);

  return {
    contractId: contract.id,
    totalRequired: required.length,
    satisfiedRequired: satisfied.length,
    completeness,
    complete: missing.length === 0,
    missing,
    satisfied,
    evidenceByRequirement,
  };
}

export function evaluateServiceCapability(
  ledger: OperationalStateLedger,
  capability: ServiceCapability,
  evaluatedAt = new Date().toISOString(),
): EvaluatedCapability {
  const definition = ledger.capabilityDefinitions.find(item => item.id === capability.definitionId);
  if (!definition) throw new Error(`Missing capability definition: ${capability.definitionId}`);

  const controls = Object.fromEntries(
    OPERATIONAL_CONTROL_KEYS.map(control => [control, evaluateControl(ledger, capability, control, evaluatedAt)])
  ) as Record<OperationalControlKey, EvaluatedControl>;

  const requiredControls = OPERATIONAL_CONTROL_KEYS.filter(control => capability.desired[control]);
  const readinessScore = requiredControls.length === 0
    ? 100
    : Math.round(
        requiredControls.reduce((sum, control) => sum + readinessWeight(controls[control].effectiveValue), 0)
        / requiredControls.length
        * 100
      );

  const contract = definition.contractId
    ? ledger.contracts.find(item => item.id === definition.contractId)
    : undefined;
  const contractEvaluation = contract
    ? evaluateEvidenceContractForCapability(ledger, capability, contract, evaluatedAt)
    : undefined;

  const actionByKey = new Map(ledger.actions.map(action => [action.deltaKey, action]));
  const controlDeltas: OperationalDelta[] = requiredControls
    .filter(control => !controls[control].verified)
    .map(control => {
      const evaluation = controls[control];
      const key = `delta:${capability.id}:control:${control}`;
      return {
        key,
        capabilityRecordId: capability.id,
        definitionId: definition.id,
        capabilityLabel: definition.label,
        serviceId: capability.serviceId,
        targetType: 'control' as const,
        control,
        severity: severityFor(definition, control),
        reason: reasonForControl(control, evaluation),
        nextAction: nextActionFor(control, evaluation),
        ownership: actionByKey.get(key),
      };
    });

  const contractDeltas: OperationalDelta[] = contract && contractEvaluation
    ? contractEvaluation.missing.map(requirement => {
        const key = `delta:${capability.id}:contract:${contract.id}:${requirement.id}`;
        return {
          key,
          capabilityRecordId: capability.id,
          definitionId: definition.id,
          capabilityLabel: definition.label,
          serviceId: capability.serviceId,
          targetType: 'contract_requirement' as const,
          contractId: contract.id,
          requirementId: requirement.id,
          severity: 'high' as const,
          reason: `${requirement.label} has no accepted, in-scope evidence bound to this exact contract requirement.`,
          nextAction: `Bind reviewed evidence to ${requirement.label}; a generic related record does not satisfy this requirement.`,
          ownership: actionByKey.get(key),
        };
      })
    : [];

  const requiredEvaluations = requiredControls.map(control => controls[control]);
  const hasDispute = requiredEvaluations.some(item => item.disputed);
  const allUnknown = requiredEvaluations.length > 0 && requiredEvaluations.every(item => item.effectiveValue === 'unknown');
  const foundation = definition.foundationControls.filter(control => capability.desired[control]);
  const hardBlock = foundation.some(control => controls[control].effectiveValue === 'no' && !controls[control].disputed);
  const foundationComplete = foundation.every(control => controls[control].effectiveValue === 'yes' && !controls[control].disputed);
  const controlsVerified = requiredEvaluations.every(item => item.verified);
  const contractComplete = contractEvaluation?.complete ?? true;

  let status: OperationalStatus = 'PARTIAL';
  if (hasDispute) status = 'DISPUTED';
  else if (hardBlock) status = 'BLOCKED';
  else if (allUnknown) status = 'UNKNOWN';
  else if (controlsVerified && contractComplete) status = 'VERIFIED';
  else if (foundationComplete) status = 'READY';

  return {
    record: capability,
    definition,
    status,
    readinessScore,
    controls,
    contract: contractEvaluation,
    deltas: [...controlDeltas, ...contractDeltas],
  };
}

function patternTarget(delta: OperationalDelta): string {
  return delta.targetType === 'control'
    ? `control:${delta.control}`
    : `contract:${delta.contractId}:${delta.requirementId}`;
}

export function detectOperationalPatterns(capabilities: EvaluatedCapability[], threshold = 2): PatternSignal[] {
  const groups = new Map<string, OperationalDelta[]>();
  capabilities.flatMap(item => item.deltas).forEach(delta => {
    const target = patternTarget(delta);
    const key = `${delta.definitionId}:${target}`;
    const list = groups.get(key) || [];
    list.push(delta);
    groups.set(key, list);
  });

  return Array.from(groups.entries()).map(([key, deltas]) => {
    const first = deltas[0];
    const services = Array.from(new Set(deltas.map(item => item.serviceId))).sort();
    const scope: PatternSignal['scope'] = services.length >= threshold ? 'CROSS_SERVICE' : 'LOCAL';
    return {
      id: `pattern:${key}`,
      definitionId: first.definitionId,
      capabilityLabel: first.capabilityLabel,
      target: patternTarget(first),
      services,
      count: services.length,
      scope,
      severity: first.severity,
      summary: scope === 'CROSS_SERVICE'
        ? `${first.capabilityLabel}: the same ${patternTarget(first).replace(/[:_]/g, ' ')} gap appears across ${services.length} services.`
        : `${first.capabilityLabel}: this gap is currently local to ${services[0] || 'one service'}.`,
    };
  }).sort((a, b) => Number(b.scope === 'CROSS_SERVICE') - Number(a.scope === 'CROSS_SERVICE') || b.count - a.count || a.id.localeCompare(b.id));
}

export function detectCrossServicePatterns(capabilities: EvaluatedCapability[], threshold = 2): PatternSignal[] {
  return detectOperationalPatterns(capabilities, threshold).filter(item => item.scope === 'CROSS_SERVICE');
}

export function evaluateOperationalLedger(
  ledger: OperationalStateLedger,
  evaluatedAt = new Date().toISOString(),
): EvaluatedOperationalState {
  const capabilities = ledger.serviceCapabilities
    .filter(item => item.lifecycleState !== 'RETIRED')
    .map(item => evaluateServiceCapability(ledger, item, evaluatedAt));
  const deltas = capabilities.flatMap(item => item.deltas);
  const patterns = detectOperationalPatterns(capabilities);
  return { ledger, capabilities, deltas, patterns, evaluatedAt };
}

export const BUILTIN_CONTRACTS: EvidenceContract[] = [
  {
    id: 'contract-1to1',
    name: '1:1 support outcome evidence',
    description: 'The evidence chain required before commissioned 1:1 support can be treated as demonstrated.',
    chain: ['PLAN', 'SCHEDULE', 'CONTEXT', 'DELIVER', 'OUTCOME', 'ASSURE', 'PROVENANCE'],
    requirements: [
      { id: 'plan', label: 'Plan / commissioned outcome', required: true, acceptedSourceTypes: ['document', 'system'] },
      { id: 'schedule', label: 'Scheduled support', required: true, acceptedSourceTypes: ['system', 'document'] },
      { id: 'context', label: 'Relevant support context', required: true, acceptedSourceTypes: ['system', 'document', 'policy'] },
      { id: 'deliver', label: 'Delivery evidence', required: true, acceptedSourceTypes: ['system', 'observation', 'document'] },
      { id: 'outcome', label: 'Outcome / refusal / variance record', required: true, acceptedSourceTypes: ['system', 'observation', 'document'] },
      { id: 'assure', label: 'Coordinator assurance', required: true, acceptedSourceTypes: ['audit', 'manager_review'] },
      { id: 'provenance', label: 'Source provenance retained', required: true },
    ],
  },
  {
    id: 'contract-medication',
    name: 'Medication assurance chain',
    description: 'Medication is only treated as assured when the order-to-audit evidence chain is complete.',
    chain: ['ORDER', 'STOCK', 'SCHEDULE', 'ADMINISTRATION', 'OUTCOME', 'EXCEPTION', 'REVIEW', 'AUDIT'],
    requirements: [
      { id: 'order', label: 'Current medication order', required: true, acceptedSourceTypes: ['system', 'document'] },
      { id: 'stock', label: 'Stock / supply evidence', required: true, acceptedSourceTypes: ['system', 'document', 'audit'] },
      { id: 'schedule', label: 'Administration schedule', required: true, acceptedSourceTypes: ['system', 'document'] },
      { id: 'administration', label: 'Administration record', required: true, acceptedSourceTypes: ['system', 'document'] },
      { id: 'outcome', label: 'Administration outcome', required: true, acceptedSourceTypes: ['system', 'document'] },
      { id: 'exception', label: 'Exception / refusal route', required: true, acceptedSourceTypes: ['system', 'document', 'audit'] },
      { id: 'review', label: 'Medication review / reconciliation', required: true, acceptedSourceTypes: ['audit', 'manager_review', 'system'] },
      { id: 'audit', label: 'Medication assurance audit', required: true, acceptedSourceTypes: ['audit', 'manager_review'] },
    ],
  },
];

export const DEFAULT_CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    id: 'handover',
    label: 'Structured handover',
    description: 'A defined, permissioned and evidenced handover workflow between shifts and accountable roles.',
    domain: 'handover',
    defaultDesired: blankDesiredControls(true),
    foundationControls: ['available', 'enabled', 'permissioned', 'workflowDefined'],
  },
  {
    id: 'one-to-one',
    label: '1:1 outcome evidence',
    description: 'Commissioned 1:1 support is connected from planned outcome through delivery and assurance evidence.',
    domain: 'care',
    defaultDesired: blankDesiredControls(true),
    foundationControls: ['available', 'enabled', 'permissioned', 'workflowDefined'],
    contractId: 'contract-1to1',
  },
  {
    id: 'medication-assurance',
    label: 'Medication assurance',
    description: 'Medication workflow state is connected to an explicit order-to-audit evidence chain.',
    domain: 'medication',
    defaultDesired: blankDesiredControls(true),
    foundationControls: ['available', 'enabled', 'permissioned', 'workflowDefined'],
    contractId: 'contract-medication',
  },
  {
    id: 'primary-care-integration',
    label: 'Primary care integration',
    description: 'Primary-care information is available, permissioned and embedded into an agreed reconciliation workflow.',
    domain: 'integration',
    defaultDesired: blankDesiredControls(true),
    foundationControls: ['available', 'enabled', 'permissioned', 'workflowDefined'],
  },
  {
    id: 'rostering-integration',
    label: 'Rostering integration',
    description: 'Approved scheduling capability is available and connected to the provider operating model.',
    domain: 'staffing',
    defaultDesired: blankDesiredControls(true),
    foundationControls: ['available', 'enabled', 'permissioned', 'workflowDefined'],
  },
];

function cloneContracts(): EvidenceContract[] {
  return BUILTIN_CONTRACTS.map(contract => ({
    ...contract,
    chain: [...contract.chain],
    requirements: contract.requirements.map(requirement => ({
      ...requirement,
      acceptedSourceTypes: requirement.acceptedSourceTypes ? [...requirement.acceptedSourceTypes] : undefined,
    })),
  }));
}

function cloneDefinitions(): CapabilityDefinition[] {
  return DEFAULT_CAPABILITY_DEFINITIONS.map(definition => ({
    ...definition,
    defaultDesired: cloneDesired(definition.defaultDesired),
    foundationControls: [...definition.foundationControls],
    severityPolicy: definition.severityPolicy ? { ...definition.severityPolicy } : undefined,
  }));
}

export function createEmptyOperationalLedger(providerName: string, now = new Date().toISOString()): OperationalStateLedger {
  const providerId = createOperationalId('org');
  return {
    schemaVersion: OPERATIONAL_LEDGER_SCHEMA_VERSION,
    sourceMarker: OPERATIONAL_LEDGER_SOURCE,
    mode: 'LIVE',
    providerId,
    providerName: providerName.trim() || 'New provider',
    createdAt: now,
    updatedAt: now,
    topology: [{ id: providerId, name: providerName.trim() || 'New provider', kind: 'organisation' }],
    capabilityDefinitions: cloneDefinitions(),
    serviceCapabilities: [],
    observations: [],
    evidence: [],
    evidenceBindings: [],
    contracts: cloneContracts(),
    actions: [],
    disputeResolutions: [],
  };
}

export function createServiceCapability(
  ledger: OperationalStateLedger,
  serviceId: string,
  definitionId: string,
  sourceSystem = 'To confirm',
  now = new Date().toISOString(),
): ServiceCapability {
  const definition = ledger.capabilityDefinitions.find(item => item.id === definitionId);
  if (!definition) throw new Error(`Unknown capability definition: ${definitionId}`);
  return {
    id: `${serviceId}:${definitionId}`,
    definitionId,
    serviceId,
    sourceSystem,
    desired: cloneDesired(definition.defaultDesired),
    owner: 'Management review',
    lifecycleState: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

function demoAddObservation(
  ledger: OperationalStateLedger,
  capabilityRecordId: string,
  control: OperationalControlKey,
  value: ControlValue,
  plane: AssertionPlane,
  sourceLabel: string,
  withEvidence: boolean,
  at: string,
): void {
  const observationId = `demo-obs:${capabilityRecordId}:${control}:${plane}`;
  ledger.observations.push({
    id: observationId,
    capabilityRecordId,
    control,
    plane,
    value,
    sourceLabel,
    observedAt: at,
    recordedAt: at,
  });
  if (!withEvidence || plane !== 'OBSERVED' || value !== 'yes') return;
  const capability = ledger.serviceCapabilities.find(item => item.id === capabilityRecordId);
  if (!capability) return;
  const evidenceId = `demo-ev:${capabilityRecordId}:${control}`;
  ledger.evidence.push({
    id: evidenceId,
    title: `${sourceLabel} evidence`,
    sourceType: 'observation',
    sourceRef: `fictional://demo/${capabilityRecordId}/${control}`,
    scopeNodeId: capability.serviceId,
    observedAt: at,
    reviewedAt: at,
    reviewedBy: 'Demo manager',
    classification: 'fictional demonstration metadata',
    reviewState: 'ACCEPTED',
  });
  ledger.evidenceBindings.push({
    id: `demo-bind:${capabilityRecordId}:${control}`,
    evidenceId,
    capabilityRecordId,
    targetType: 'control',
    control,
    createdAt: at,
  });
}

export function buildDemoOperationalState(now = '2026-08-26T15:00:00.000Z'): OperationalStateLedger {
  const ledger: OperationalStateLedger = {
    schemaVersion: OPERATIONAL_LEDGER_SCHEMA_VERSION,
    sourceMarker: OPERATIONAL_LEDGER_SOURCE,
    mode: 'DEMO',
    providerId: 'demo-provider',
    providerName: 'Meadowview Care',
    createdAt: now,
    updatedAt: now,
    topology: [
      { id: 'demo-provider', name: 'Meadowview Care', kind: 'organisation' },
      { id: 'service-a', name: 'Riverside House', kind: 'service', parentId: 'demo-provider' },
      { id: 'service-b', name: 'Oak House', kind: 'service', parentId: 'demo-provider' },
      { id: 'service-c', name: 'Meadow Lodge', kind: 'service', parentId: 'demo-provider' },
    ],
    capabilityDefinitions: cloneDefinitions(),
    serviceCapabilities: [],
    observations: [],
    evidence: [],
    evidenceBindings: [],
    contracts: cloneContracts(),
    actions: [],
    disputeResolutions: [],
  };

  const addCapability = (serviceId: string, definitionId: string, sourceSystem: string) => {
    const record = createServiceCapability(ledger, serviceId, definitionId, sourceSystem, now);
    record.owner = 'Demo management';
    ledger.serviceCapabilities.push(record);
    return record;
  };

  const handoverA = addCapability('service-a', 'handover', 'Care platform');
  const handoverB = addCapability('service-b', 'handover', 'Care platform');
  const handoverC = addCapability('service-c', 'handover', 'Care platform');
  const oneA = addCapability('service-a', 'one-to-one', 'Care platform');
  const oneB = addCapability('service-b', 'one-to-one', 'Care platform');
  const medA = addCapability('service-a', 'medication-assurance', 'MAR + care platform');
  const rosterA = addCapability('service-a', 'rostering-integration', 'Approved integration');

  for (const record of [handoverA, handoverB, handoverC, oneA, oneB, medA]) {
    for (const control of ['available', 'enabled', 'permissioned'] as OperationalControlKey[]) {
      demoAddObservation(ledger, record.id, control, 'yes', 'OBSERVED', `${OPERATIONAL_CONTROL_LABELS[control]} checked`, true, now);
    }
  }

  for (const record of [handoverA, handoverB]) {
    demoAddObservation(ledger, record.id, 'workflowDefined', 'partial', 'BELIEVED', 'Workflow definition still under management review', false, now);
    demoAddObservation(ledger, record.id, 'trained', 'partial', 'BELIEVED', 'Training not yet evidenced', false, now);
    demoAddObservation(ledger, record.id, 'adopted', 'partial', 'BELIEVED', 'Adoption not yet evidenced', false, now);
    demoAddObservation(ledger, record.id, 'evidenceVerified', 'partial', 'BELIEVED', 'Live evidence incomplete', false, now);
  }

  demoAddObservation(ledger, handoverC.id, 'workflowDefined', 'yes', 'OBSERVED', 'Handover workflow reviewed', true, now);
  demoAddObservation(ledger, handoverC.id, 'trained', 'yes', 'OBSERVED', 'Training record sampled', true, now);
  demoAddObservation(ledger, handoverC.id, 'adopted', 'yes', 'OBSERVED', 'Recent handover use sampled', true, now);
  demoAddObservation(ledger, handoverC.id, 'evidenceVerified', 'yes', 'OBSERVED', 'Manager evidence review completed', true, now);

  for (const record of [oneA, oneB]) {
    demoAddObservation(ledger, record.id, 'workflowDefined', 'partial', 'BELIEVED', 'Outcome chain requires a defined operating rule', false, now);
    demoAddObservation(ledger, record.id, 'trained', 'partial', 'BELIEVED', 'Training not yet evidenced', false, now);
    demoAddObservation(ledger, record.id, 'adopted', 'partial', 'BELIEVED', 'Session evidence quality varies', false, now);
    demoAddObservation(ledger, record.id, 'evidenceVerified', 'partial', 'BELIEVED', 'Evidence Contract incomplete', false, now);
  }

  for (const control of ['workflowDefined', 'trained', 'adopted'] as OperationalControlKey[]) {
    demoAddObservation(ledger, medA.id, control, 'yes', 'OBSERVED', `${OPERATIONAL_CONTROL_LABELS[control]} checked`, true, now);
  }
  demoAddObservation(ledger, medA.id, 'evidenceVerified', 'partial', 'BELIEVED', 'Order-to-audit contract remains incomplete', false, now);

  demoAddObservation(ledger, rosterA.id, 'available', 'yes', 'BELIEVED', 'Approved integration route identified; entitlement still to confirm', false, now);

  return ledger;
}
