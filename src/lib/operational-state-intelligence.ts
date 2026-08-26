export type EpistemicState = 'OBSERVED' | 'INFERRED' | 'MODELED' | 'UNKNOWN' | 'DISPUTED';
export type ControlValue = 'yes' | 'no' | 'partial' | 'unknown';
export type OperationalStatus = 'VERIFIED' | 'READY' | 'PARTIAL' | 'BLOCKED' | 'UNKNOWN';
export type DeltaSeverity = 'critical' | 'high' | 'medium' | 'low';

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

export interface EvidenceRef {
  id: string;
  sourceType: 'system' | 'document' | 'audit' | 'observation' | 'manager_review' | 'integration' | 'other';
  label: string;
  sourceRef?: string;
  observedAt?: string;
  reviewedBy?: string;
}

export interface ControlObservation {
  value: ControlValue;
  epistemic: EpistemicState;
  evidence: EvidenceRef[];
  note?: string;
}

export type OperationalControls = Record<OperationalControlKey, ControlObservation>;
export type DesiredControls = Record<OperationalControlKey, boolean>;

export interface ServiceNode {
  id: string;
  name: string;
  kind: 'organisation' | 'region' | 'service' | 'team';
  parentId?: string;
}

export interface OperationalCapability {
  id: string;
  capabilityId: string;
  label: string;
  domain: 'care' | 'medication' | 'handover' | 'staffing' | 'governance' | 'integration' | 'other';
  serviceId: string;
  sourceSystem: string;
  desired: DesiredControls;
  observed: OperationalControls;
  contractId?: string;
  owner?: string;
  nextReviewAt?: string;
}

export interface OperationalDelta {
  capabilityRecordId: string;
  capabilityId: string;
  capabilityLabel: string;
  serviceId: string;
  control: OperationalControlKey;
  desired: true;
  observed: ControlValue;
  epistemic: EpistemicState;
  severity: DeltaSeverity;
  reason: string;
  nextAction: string;
}

export interface EvaluatedCapability extends OperationalCapability {
  status: OperationalStatus;
  readinessScore: number;
  requiredControls: OperationalControlKey[];
  deltas: OperationalDelta[];
}

export interface EvidenceContractRequirement {
  id: string;
  label: string;
  required: boolean;
  acceptedSourceTypes?: EvidenceRef['sourceType'][];
}

export interface EvidenceContract {
  id: string;
  name: string;
  description: string;
  chain: string[];
  requirements: EvidenceContractRequirement[];
}

export interface EvidenceContractEvaluation {
  contractId: string;
  totalRequired: number;
  satisfiedRequired: number;
  completeness: number;
  complete: boolean;
  missing: EvidenceContractRequirement[];
  satisfied: EvidenceContractRequirement[];
}

export interface PatternSignal {
  id: string;
  capabilityId: string;
  capabilityLabel: string;
  control: OperationalControlKey;
  services: string[];
  count: number;
  scope: 'LOCAL' | 'CROSS_SERVICE';
  severity: DeltaSeverity;
  summary: string;
}

export interface OperationalStateSnapshot {
  organisationId: string;
  generatedAt: string;
  topology: ServiceNode[];
  capabilities: OperationalCapability[];
  contracts: EvidenceContract[];
}

function control(value: ControlValue, epistemic: EpistemicState, label?: string): ControlObservation {
  const hasEvidence = epistemic === 'OBSERVED' && value !== 'unknown';
  return {
    value,
    epistemic,
    evidence: hasEvidence
      ? [{
          id: `demo-evidence-${Math.random().toString(36).slice(2, 8)}`,
          sourceType: 'observation',
          label: label || 'Demo observation',
        }]
      : [],
  };
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

export function blankObservedControls(): OperationalControls {
  return {
    available: control('unknown', 'UNKNOWN'),
    enabled: control('unknown', 'UNKNOWN'),
    permissioned: control('unknown', 'UNKNOWN'),
    workflowDefined: control('unknown', 'UNKNOWN'),
    trained: control('unknown', 'UNKNOWN'),
    adopted: control('unknown', 'UNKNOWN'),
    evidenceVerified: control('unknown', 'UNKNOWN'),
  };
}

function readinessWeight(value: ControlValue): number {
  if (value === 'yes') return 1;
  if (value === 'partial') return 0.5;
  return 0;
}

function severityFor(controlKey: OperationalControlKey, value: ControlValue): DeltaSeverity {
  if (controlKey === 'available' && value === 'no') return 'critical';
  if (controlKey === 'enabled' || controlKey === 'permissioned' || controlKey === 'evidenceVerified') return 'high';
  if (controlKey === 'workflowDefined' || controlKey === 'adopted') return 'medium';
  return 'low';
}

function nextActionFor(controlKey: OperationalControlKey): string {
  switch (controlKey) {
    case 'available': return 'Confirm entitlement, integration availability, or replacement route.';
    case 'enabled': return 'Enable or configure the capability in the source system.';
    case 'permissioned': return 'Review role access and assign the required permissions.';
    case 'workflowDefined': return 'Define the operating rule, owner, trigger, and exception route.';
    case 'trained': return 'Brief or train the roles expected to operate the workflow.';
    case 'adopted': return 'Pilot the workflow and verify consistent use in live operations.';
    case 'evidenceVerified': return 'Collect and review evidence that the intended state is operating in reality.';
  }
}

function deltaReason(controlKey: OperationalControlKey, observation: ControlObservation): string {
  const label = OPERATIONAL_CONTROL_LABELS[controlKey];
  if (observation.value !== 'yes') {
    return `${label} is ${observation.value}; the desired state requires yes.`;
  }
  if (observation.epistemic !== 'OBSERVED') {
    return `${label} is currently ${observation.epistemic.toLowerCase()} rather than directly observed.`;
  }
  if (observation.evidence.length === 0) {
    return `${label} is asserted but has no linked evidence.`;
  }
  return `${label} requires verification.`;
}

export function evaluateCapability(capability: OperationalCapability): EvaluatedCapability {
  const requiredControls = OPERATIONAL_CONTROL_KEYS.filter(key => capability.desired[key]);
  const readinessScore = requiredControls.length === 0
    ? 100
    : Math.round(
        requiredControls.reduce((sum, key) => sum + readinessWeight(capability.observed[key].value), 0)
        / requiredControls.length
        * 100
      );

  const deltas = requiredControls
    .filter(key => {
      const observation = capability.observed[key];
      return observation.value !== 'yes'
        || observation.epistemic !== 'OBSERVED'
        || observation.evidence.length === 0;
    })
    .map<OperationalDelta>(key => {
      const observation = capability.observed[key];
      return {
        capabilityRecordId: capability.id,
        capabilityId: capability.capabilityId,
        capabilityLabel: capability.label,
        serviceId: capability.serviceId,
        control: key,
        desired: true,
        observed: observation.value,
        epistemic: observation.epistemic,
        severity: severityFor(key, observation.value),
        reason: deltaReason(key, observation),
        nextAction: nextActionFor(key),
      };
    });

  const requiredObservations = requiredControls.map(key => capability.observed[key]);
  const hasNoSignal = requiredObservations.every(item => item.value === 'unknown');
  const hasHardBlock = requiredControls.some(key => capability.observed[key].value === 'no');
  const allVerified = requiredControls.every(key => {
    const observation = capability.observed[key];
    return observation.value === 'yes'
      && observation.epistemic === 'OBSERVED'
      && observation.evidence.length > 0;
  });

  const operationalFoundation: OperationalControlKey[] = ['available', 'enabled', 'permissioned', 'workflowDefined'];
  const foundationReady = operationalFoundation
    .filter(key => capability.desired[key])
    .every(key => capability.observed[key].value === 'yes');

  let status: OperationalStatus = 'PARTIAL';
  if (allVerified) status = 'VERIFIED';
  else if (hasHardBlock) status = 'BLOCKED';
  else if (hasNoSignal) status = 'UNKNOWN';
  else if (foundationReady) status = 'READY';

  return { ...capability, status, readinessScore, requiredControls, deltas };
}

export function evaluateSnapshot(snapshot: OperationalStateSnapshot) {
  const capabilities = snapshot.capabilities.map(evaluateCapability);
  const deltas = capabilities.flatMap(item => item.deltas);
  const patterns = detectCrossServicePatterns(capabilities);
  return { ...snapshot, capabilities, deltas, patterns };
}

export function evaluateEvidenceContract(
  contract: EvidenceContract,
  evidence: EvidenceRef[]
): EvidenceContractEvaluation {
  const required = contract.requirements.filter(item => item.required);
  const satisfied = required.filter(requirement => evidence.some(item => {
    if (!requirement.acceptedSourceTypes?.length) return true;
    return requirement.acceptedSourceTypes.includes(item.sourceType);
  }));
  const missing = required.filter(item => !satisfied.includes(item));
  const completeness = required.length === 0 ? 100 : Math.round((satisfied.length / required.length) * 100);
  return {
    contractId: contract.id,
    totalRequired: required.length,
    satisfiedRequired: satisfied.length,
    completeness,
    complete: missing.length === 0,
    missing,
    satisfied,
  };
}

export function detectCrossServicePatterns(capabilities: EvaluatedCapability[], threshold = 2): PatternSignal[] {
  const byGap = new Map<string, OperationalDelta[]>();
  capabilities.flatMap(item => item.deltas).forEach(delta => {
    const key = `${delta.capabilityId}:${delta.control}`;
    const list = byGap.get(key) || [];
    list.push(delta);
    byGap.set(key, list);
  });

  return Array.from(byGap.entries())
    .map(([key, deltas]) => {
      const services = Array.from(new Set(deltas.map(item => item.serviceId)));
      const first = deltas[0];
      const crossService = services.length >= threshold;
      return {
        id: `pattern-${key}`,
        capabilityId: first.capabilityId,
        capabilityLabel: first.capabilityLabel,
        control: first.control,
        services,
        count: services.length,
        scope: crossService ? 'CROSS_SERVICE' as const : 'LOCAL' as const,
        severity: first.severity,
        summary: crossService
          ? `${first.capabilityLabel}: ${OPERATIONAL_CONTROL_LABELS[first.control]} gap appears across ${services.length} services.`
          : `${first.capabilityLabel}: ${OPERATIONAL_CONTROL_LABELS[first.control]} gap is currently local to ${services[0] || 'one service'}.`,
      };
    })
    .filter(signal => signal.scope === 'CROSS_SERVICE')
    .sort((a, b) => b.count - a.count || a.capabilityLabel.localeCompare(b.capabilityLabel));
}

const DEMO_CONTRACTS: EvidenceContract[] = [
  {
    id: 'contract-1to1',
    name: '1:1 support outcome evidence',
    description: 'The chain required before OVSITE may treat commissioned 1:1 support as demonstrated.',
    chain: ['PLAN', 'SCHEDULE', 'CONTEXT', 'DELIVER', 'OUTCOME', 'ASSURE', 'PROVENANCE'],
    requirements: [
      { id: 'plan', label: 'Commissioned need or care-plan outcome', required: true, acceptedSourceTypes: ['document', 'system'] },
      { id: 'delivery', label: 'Delivery record', required: true, acceptedSourceTypes: ['system', 'observation'] },
      { id: 'assurance', label: 'Coordinator assurance', required: true, acceptedSourceTypes: ['audit', 'manager_review'] },
    ],
  },
  {
    id: 'contract-medication',
    name: 'Medication assurance chain',
    description: 'Medication is only treated as assured when the order-to-audit chain is evidenced.',
    chain: ['ORDER', 'STOCK', 'SCHEDULE', 'ADMINISTRATION', 'OUTCOME', 'EXCEPTION', 'REVIEW', 'AUDIT'],
    requirements: [
      { id: 'record', label: 'Medication administration record', required: true, acceptedSourceTypes: ['system', 'document'] },
      { id: 'exception', label: 'Exception/refusal route', required: true, acceptedSourceTypes: ['system', 'document'] },
      { id: 'audit', label: 'Medication assurance review', required: true, acceptedSourceTypes: ['audit', 'manager_review'] },
    ],
  },
];

function observed(value: ControlValue, label: string): ControlObservation {
  return {
    value,
    epistemic: 'OBSERVED',
    evidence: value === 'unknown' ? [] : [{ id: `demo-${label.toLowerCase().replace(/\W+/g, '-')}`, sourceType: 'observation', label }],
  };
}

function inferred(value: ControlValue, note: string): ControlObservation {
  return { value, epistemic: 'INFERRED', evidence: [], note };
}

function capability(
  serviceId: string,
  capabilityId: string,
  label: string,
  domain: OperationalCapability['domain'],
  sourceSystem: string,
  overrides: Partial<OperationalControls>,
  contractId?: string
): OperationalCapability {
  return {
    id: `${serviceId}:${capabilityId}`,
    capabilityId,
    label,
    domain,
    serviceId,
    sourceSystem,
    desired: blankDesiredControls(true),
    observed: { ...blankObservedControls(), ...overrides },
    contractId,
    owner: 'Management review',
  };
}

export function buildDemoOperationalState(generatedAt = '2026-08-26T15:00:00.000Z'): OperationalStateSnapshot {
  const commonHandover = {
    available: observed('yes', 'Handover feature visible'),
    enabled: observed('yes', 'Handover screen enabled'),
    permissioned: observed('yes', 'Coordinator access confirmed'),
    workflowDefined: inferred('partial', 'The feature exists but the organisation-wide handover rule still needs definition.'),
    trained: inferred('partial', 'Training/adoption not yet evidenced.'),
    adopted: inferred('partial', 'Examples show capability but not consistent organisation-wide use.'),
    evidenceVerified: inferred('partial', 'Live-use evidence is not yet complete.'),
  } satisfies Partial<OperationalControls>;

  return {
    organisationId: 'demo-provider',
    generatedAt,
    topology: [
      { id: 'demo-provider', name: 'Meadowview Care', kind: 'organisation' },
      { id: 'service-a', name: 'Riverside House', kind: 'service', parentId: 'demo-provider' },
      { id: 'service-b', name: 'Oak House', kind: 'service', parentId: 'demo-provider' },
      { id: 'service-c', name: 'Meadow Lodge', kind: 'service', parentId: 'demo-provider' },
    ],
    contracts: DEMO_CONTRACTS,
    capabilities: [
      capability('service-a', 'handover', 'Structured handover', 'handover', 'Care platform', commonHandover),
      capability('service-b', 'handover', 'Structured handover', 'handover', 'Care platform', commonHandover),
      capability('service-c', 'handover', 'Structured handover', 'handover', 'Care platform', {
        ...commonHandover,
        adopted: observed('yes', 'Recent handover notes sampled'),
      }),
      capability('service-a', 'one-to-one', '1:1 outcome evidence', 'care', 'Care platform', {
        available: observed('yes', 'Care-plan and interaction functions visible'),
        enabled: observed('yes', 'Interactions enabled'),
        permissioned: observed('yes', 'Staff access confirmed'),
        workflowDefined: inferred('partial', 'Outcome chain requires a defined operating rule.'),
        trained: inferred('partial', 'Training not yet evidenced.'),
        adopted: inferred('partial', 'Evidence quality varies by session.'),
        evidenceVerified: inferred('partial', 'Full evidence contract not yet demonstrated.'),
      }, 'contract-1to1'),
      capability('service-b', 'one-to-one', '1:1 outcome evidence', 'care', 'Care platform', {
        available: observed('yes', 'Care-plan and interaction functions visible'),
        enabled: observed('yes', 'Interactions enabled'),
        permissioned: observed('yes', 'Staff access confirmed'),
        workflowDefined: inferred('partial', 'Outcome chain requires a defined operating rule.'),
        trained: inferred('partial', 'Training not yet evidenced.'),
        adopted: inferred('partial', 'Evidence quality varies by session.'),
        evidenceVerified: inferred('partial', 'Full evidence contract not yet demonstrated.'),
      }, 'contract-1to1'),
      capability('service-a', 'medication-assurance', 'Medication assurance', 'medication', 'MAR + care platform', {
        available: observed('yes', 'Medication workflow available'),
        enabled: observed('yes', 'Medication records in use'),
        permissioned: observed('yes', 'Medication access confirmed'),
        workflowDefined: observed('yes', 'Existing medication governance process'),
        trained: observed('yes', 'Competency route recorded'),
        adopted: observed('yes', 'Administration records observed'),
        evidenceVerified: inferred('partial', 'Paper/digital assurance boundary requires explicit verification.'),
      }, 'contract-medication'),
      capability('service-b', 'medication-assurance', 'Medication assurance', 'medication', 'MAR + care platform', {
        available: observed('yes', 'Medication workflow available'),
        enabled: observed('yes', 'Medication records in use'),
        permissioned: observed('yes', 'Medication access confirmed'),
        workflowDefined: observed('yes', 'Existing medication governance process'),
        trained: inferred('partial', 'Current competency evidence not sampled.'),
        adopted: observed('yes', 'Administration records observed'),
        evidenceVerified: inferred('partial', 'Assurance chain requires review.'),
      }, 'contract-medication'),
      capability('service-a', 'gp-integration', 'Primary care integration', 'integration', 'Care platform', {
        available: observed('yes', 'Primary care integration visible'),
        enabled: observed('yes', 'Integration area accessible'),
        permissioned: observed('yes', 'Manager access observed'),
        workflowDefined: inferred('partial', 'Organisation rule for reconciliation/use is not yet evidenced.'),
        trained: inferred('partial', 'Training not yet evidenced.'),
        adopted: observed('yes', 'Integration used during care review'),
        evidenceVerified: inferred('partial', 'Routine assurance is not yet evidenced.'),
      }),
      capability('service-a', 'rostering-integration', 'Rostering integration', 'staffing', 'Approved integration', {
        available: inferred('yes', 'Approved integration route identified but entitlement is to be confirmed.'),
        enabled: control('unknown', 'UNKNOWN'),
        permissioned: control('unknown', 'UNKNOWN'),
        workflowDefined: control('unknown', 'UNKNOWN'),
        trained: control('unknown', 'UNKNOWN'),
        adopted: control('unknown', 'UNKNOWN'),
        evidenceVerified: control('unknown', 'UNKNOWN'),
      }),
    ],
  };
}
