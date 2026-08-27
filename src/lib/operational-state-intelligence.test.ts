import { describe, expect, it } from 'vitest';
import {
  OPERATIONAL_CONTROL_KEYS,
  createEmptyOperationalLedger,
  createServiceCapability,
  detectCrossServicePatterns,
  evaluateOperationalLedger,
  evaluateServiceCapability,
  type ControlObservationRecord,
  type EvidenceBinding,
  type EvidenceItem,
  type OperationalControlKey,
  type OperationalStateLedger,
  type ServiceCapability,
} from './operational-state-intelligence';

const NOW = '2026-08-27T00:00:00.000Z';

function baseLedger(): OperationalStateLedger {
  const ledger = createEmptyOperationalLedger('Test Provider', NOW);
  ledger.providerId = 'org-test';
  ledger.topology = [
    { id: 'org-test', name: 'Test Provider', kind: 'organisation' },
    { id: 'service-a', name: 'Service A', kind: 'service', parentId: 'org-test' },
    { id: 'service-b', name: 'Service B', kind: 'service', parentId: 'org-test' },
  ];
  return ledger;
}

function addCapability(ledger: OperationalStateLedger, serviceId = 'service-a', definitionId = 'handover'): ServiceCapability {
  const capability = createServiceCapability(ledger, serviceId, definitionId, 'Test source', NOW);
  ledger.serviceCapabilities.push(capability);
  return capability;
}

function observe(
  ledger: OperationalStateLedger,
  capability: ServiceCapability,
  control: OperationalControlKey,
  value: ControlObservationRecord['value'] = 'yes',
  plane: ControlObservationRecord['plane'] = 'OBSERVED',
  idSuffix = '',
): ControlObservationRecord {
  const record: ControlObservationRecord = {
    id: `obs:${capability.id}:${control}:${plane}${idSuffix}`,
    capabilityRecordId: capability.id,
    control,
    plane,
    value,
    sourceLabel: 'Test observation',
    observedAt: NOW,
    recordedAt: NOW,
  };
  ledger.observations.push(record);
  return record;
}

function bindControlEvidence(
  ledger: OperationalStateLedger,
  capability: ServiceCapability,
  control: OperationalControlKey,
  options: Partial<EvidenceItem> = {},
): EvidenceItem {
  const evidence: EvidenceItem = {
    id: options.id || `ev:${capability.id}:${control}:${ledger.evidence.length}`,
    title: options.title || 'Reviewed evidence',
    sourceType: options.sourceType || 'audit',
    sourceRef: options.sourceRef || `test://${capability.id}/${control}`,
    scopeNodeId: options.scopeNodeId || capability.serviceId,
    observedAt: options.observedAt || NOW,
    reviewedAt: options.reviewedAt || NOW,
    reviewedBy: options.reviewedBy || 'Manager',
    reviewState: options.reviewState || 'ACCEPTED',
    expiresAt: options.expiresAt,
    supersedesEvidenceId: options.supersedesEvidenceId,
  };
  const binding: EvidenceBinding = {
    id: `bind:${evidence.id}:${control}`,
    evidenceId: evidence.id,
    capabilityRecordId: capability.id,
    targetType: 'control',
    control,
    createdAt: NOW,
  };
  ledger.evidence.push(evidence);
  ledger.evidenceBindings.push(binding);
  return evidence;
}

function verifyAllControls(ledger: OperationalStateLedger, capability: ServiceCapability): void {
  for (const control of OPERATIONAL_CONTROL_KEYS) {
    observe(ledger, capability, control);
    bindControlEvidence(ledger, capability, control);
  }
}

function bindCompleteContract(ledger: OperationalStateLedger, capability: ServiceCapability): void {
  const definition = ledger.capabilityDefinitions.find(item => item.id === capability.definitionId)!;
  const contract = ledger.contracts.find(item => item.id === definition.contractId)!;
  contract.requirements.filter(item => item.required).forEach(requirement => {
    const evidence: EvidenceItem = {
      id: `ev:req:${capability.id}:${requirement.id}`,
      title: requirement.label,
      sourceType: requirement.acceptedSourceTypes?.[0] || 'audit',
      sourceRef: `test://requirement/${requirement.id}`,
      scopeNodeId: capability.serviceId,
      observedAt: NOW,
      reviewedAt: NOW,
      reviewedBy: 'Manager',
      reviewState: 'ACCEPTED',
    };
    ledger.evidence.push(evidence);
    ledger.evidenceBindings.push({
      id: `bind:req:${capability.id}:${requirement.id}`,
      evidenceId: evidence.id,
      capabilityRecordId: capability.id,
      targetType: 'contract_requirement',
      contractId: contract.id,
      requirementId: requirement.id,
      createdAt: NOW,
    });
  });
}

describe('OVSITE Phase 2 operational truth kernel', () => {
  it('does not confuse enabled functionality with verified operational state', () => {
    const ledger = baseLedger();
    const capability = addCapability(ledger);
    observe(ledger, capability, 'available');
    observe(ledger, capability, 'enabled');
    bindControlEvidence(ledger, capability, 'available');
    bindControlEvidence(ledger, capability, 'enabled');

    const evaluated = evaluateServiceCapability(ledger, capability, NOW);

    expect(evaluated.status).not.toBe('VERIFIED');
    expect(evaluated.controls.enabled.verified).toBe(true);
    expect(evaluated.controls.workflowDefined.epistemic).toBe('UNKNOWN');
    expect(evaluated.deltas.some(delta => delta.control === 'workflowDefined')).toBe(true);
  });

  it('requires direct observation and an exact accepted control binding before a control is verified', () => {
    const ledger = baseLedger();
    const capability = addCapability(ledger);
    observe(ledger, capability, 'enabled', 'yes', 'BELIEVED');
    bindControlEvidence(ledger, capability, 'enabled');

    let evaluated = evaluateServiceCapability(ledger, capability, NOW);
    expect(evaluated.controls.enabled.verified).toBe(false);
    expect(evaluated.controls.enabled.epistemic).toBe('BELIEVED');

    observe(ledger, capability, 'enabled', 'yes', 'OBSERVED', ':direct');
    evaluated = evaluateServiceCapability(ledger, capability, NOW);
    expect(evaluated.controls.enabled.verified).toBe(true);
    expect(evaluated.controls.enabled.epistemic).toBe('EVIDENCED');
  });

  it('does not allow rejected, expired, superseded or out-of-scope evidence to verify a control', () => {
    const ledger = baseLedger();
    const capability = addCapability(ledger);
    observe(ledger, capability, 'enabled');

    bindControlEvidence(ledger, capability, 'enabled', { id: 'rejected', reviewState: 'REJECTED' });
    bindControlEvidence(ledger, capability, 'enabled', { id: 'expired', expiresAt: '2026-08-26T00:00:00.000Z' });
    bindControlEvidence(ledger, capability, 'enabled', { id: 'wrong-scope', scopeNodeId: 'service-b' });
    bindControlEvidence(ledger, capability, 'enabled', { id: 'old-accepted' });
    ledger.evidence.push({
      id: 'replacement',
      title: 'Replacement pending review',
      sourceType: 'audit',
      sourceRef: 'test://replacement',
      scopeNodeId: 'service-a',
      observedAt: NOW,
      reviewState: 'PENDING_REVIEW',
      supersedesEvidenceId: 'old-accepted',
    });

    const evaluated = evaluateServiceCapability(ledger, capability, NOW);
    expect(evaluated.controls.enabled.verified).toBe(false);
    expect(evaluated.controls.enabled.evidenceIds).toEqual([]);
  });

  it('uses the Evidence Contract as an additional verification gate', () => {
    const ledger = baseLedger();
    const capability = addCapability(ledger, 'service-a', 'one-to-one');
    verifyAllControls(ledger, capability);

    let evaluated = evaluateServiceCapability(ledger, capability, NOW);
    expect(evaluated.contract?.complete).toBe(false);
    expect(evaluated.status).toBe('READY');
    expect(evaluated.deltas.some(delta => delta.targetType === 'contract_requirement')).toBe(true);

    bindCompleteContract(ledger, capability);
    evaluated = evaluateServiceCapability(ledger, capability, NOW);
    expect(evaluated.contract?.complete).toBe(true);
    expect(evaluated.status).toBe('VERIFIED');
  });

  it('blocks verification while current observations are explicitly disputed', () => {
    const ledger = baseLedger();
    const capability = addCapability(ledger);
    verifyAllControls(ledger, capability);
    observe(ledger, capability, 'adopted', 'no', 'DISPUTED', ':challenge');

    let evaluated = evaluateServiceCapability(ledger, capability, NOW);
    expect(evaluated.status).toBe('DISPUTED');
    expect(evaluated.controls.adopted.disputed).toBe(true);

    const accepted = ledger.observations.find(item => item.capabilityRecordId === capability.id && item.control === 'adopted' && item.plane === 'OBSERVED')!;
    ledger.disputeResolutions.push({
      id: 'resolution-1',
      capabilityRecordId: capability.id,
      control: 'adopted',
      resolvedAt: '2026-08-27T00:01:00.000Z',
      decisionNote: 'Manager reviewed the conflicting assertion and retained the evidenced observation.',
      acceptedObservationId: accepted.id,
    });

    evaluated = evaluateServiceCapability(ledger, capability, '2026-08-27T00:02:00.000Z');
    expect(evaluated.controls.adopted.disputed).toBe(false);
    expect(evaluated.controls.adopted.verified).toBe(true);
  });

  it('treats a no on a required foundation control as BLOCKED', () => {
    const ledger = baseLedger();
    const capability = addCapability(ledger);
    observe(ledger, capability, 'available', 'no');
    bindControlEvidence(ledger, capability, 'available');

    const evaluated = evaluateServiceCapability(ledger, capability, NOW);
    expect(evaluated.status).toBe('BLOCKED');
  });

  it('keeps action ownership attached to deterministic delta keys across recomputation', () => {
    const ledger = baseLedger();
    const capability = addCapability(ledger);
    observe(ledger, capability, 'available');
    bindControlEvidence(ledger, capability, 'available');

    const first = evaluateServiceCapability(ledger, capability, NOW);
    const delta = first.deltas.find(item => item.control === 'enabled')!;
    ledger.actions.push({
      deltaKey: delta.key,
      capabilityRecordId: capability.id,
      assignee: 'Operations Manager',
      targetDate: '2026-09-01',
      status: 'IN_PROGRESS',
      note: 'Configuration review booked.',
      updatedAt: NOW,
    });

    const second = evaluateServiceCapability(ledger, capability, NOW);
    const same = second.deltas.find(item => item.key === delta.key)!;
    expect(same.ownership).toMatchObject({ assignee: 'Operations Manager', status: 'IN_PROGRESS' });
  });

  it('only promotes a repeated gap after it exists at two distinct services', () => {
    const ledger = baseLedger();
    const first = addCapability(ledger, 'service-a', 'handover');
    const second = addCapability(ledger, 'service-b', 'handover');
    observe(ledger, first, 'available');
    bindControlEvidence(ledger, first, 'available');

    let state = evaluateOperationalLedger(ledger, NOW);
    expect(detectCrossServicePatterns(state.capabilities, 2).some(pattern => pattern.definitionId === 'handover')).toBe(false);

    observe(ledger, second, 'available');
    bindControlEvidence(ledger, second, 'available');
    state = evaluateOperationalLedger(ledger, NOW);
    const patterns = detectCrossServicePatterns(state.capabilities, 2);
    expect(patterns.some(pattern => pattern.definitionId === 'handover' && pattern.count === 2)).toBe(true);
  });

  it('is deterministic: evaluation creates no random identifiers or state mutation', () => {
    const ledger = baseLedger();
    const capability = addCapability(ledger);
    observe(ledger, capability, 'available');
    bindControlEvidence(ledger, capability, 'available');
    const before = JSON.stringify(ledger);

    const a = evaluateOperationalLedger(ledger, NOW);
    const b = evaluateOperationalLedger(ledger, NOW);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(ledger)).toBe(before);
  });
});
