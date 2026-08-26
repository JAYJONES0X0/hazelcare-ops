import { describe, expect, it } from 'vitest';
import {
  blankDesiredControls,
  blankObservedControls,
  buildDemoOperationalState,
  detectCrossServicePatterns,
  evaluateCapability,
  evaluateEvidenceContract,
  evaluateSnapshot,
  type EvidenceContract,
  type EvidenceRef,
  type OperationalCapability,
} from './operational-state-intelligence';

function capability(overrides: Partial<OperationalCapability> = {}): OperationalCapability {
  const observed = blankObservedControls();
  const evidence: EvidenceRef = {
    id: 'ev-1',
    sourceType: 'audit',
    label: 'Manager-reviewed evidence',
  };

  for (const key of Object.keys(observed) as Array<keyof typeof observed>) {
    observed[key] = { value: 'yes', epistemic: 'OBSERVED', evidence: [evidence] };
  }

  return {
    id: 'service-a:handover',
    capabilityId: 'handover',
    label: 'Structured handover',
    domain: 'handover',
    serviceId: 'service-a',
    sourceSystem: 'Care platform',
    desired: blankDesiredControls(true),
    observed,
    ...overrides,
  };
}

describe('operational state intelligence', () => {
  it('does not confuse enabled functionality with verified operational use', () => {
    const item = capability();
    item.observed.workflowDefined = {
      value: 'partial',
      epistemic: 'INFERRED',
      evidence: [],
      note: 'The feature exists, but the operating rule is not yet evidenced.',
    };
    item.observed.adopted = {
      value: 'partial',
      epistemic: 'INFERRED',
      evidence: [],
    };
    item.observed.evidenceVerified = {
      value: 'partial',
      epistemic: 'INFERRED',
      evidence: [],
    };

    const evaluated = evaluateCapability(item);

    expect(evaluated.status).not.toBe('VERIFIED');
    expect(evaluated.deltas).toEqual(expect.arrayContaining([
      expect.objectContaining({ control: 'workflowDefined' }),
      expect.objectContaining({ control: 'adopted' }),
      expect.objectContaining({ control: 'evidenceVerified' }),
    ]));
  });

  it('only returns VERIFIED when required controls are directly observed and evidenced', () => {
    const evaluated = evaluateCapability(capability());

    expect(evaluated.status).toBe('VERIFIED');
    expect(evaluated.readinessScore).toBe(100);
    expect(evaluated.deltas).toHaveLength(0);
  });

  it('treats a hard no on a required control as BLOCKED', () => {
    const item = capability();
    item.observed.permissioned = {
      value: 'no',
      epistemic: 'OBSERVED',
      evidence: [{ id: 'ev-denied', sourceType: 'system', label: 'Role access check' }],
    };

    const evaluated = evaluateCapability(item);

    expect(evaluated.status).toBe('BLOCKED');
    expect(evaluated.deltas).toEqual(expect.arrayContaining([
      expect.objectContaining({ control: 'permissioned', severity: 'high' }),
    ]));
  });

  it('requires the evidence contract rather than accepting a generic evidence item as proof of the whole claim', () => {
    const contract: EvidenceContract = {
      id: 'contract-1to1',
      name: '1:1 support evidence',
      description: 'Evidence chain',
      chain: ['PLAN', 'DELIVER', 'OUTCOME', 'ASSURE'],
      requirements: [
        { id: 'plan', label: 'Plan', required: true, acceptedSourceTypes: ['document'] },
        { id: 'delivery', label: 'Delivery', required: true, acceptedSourceTypes: ['system'] },
        { id: 'assurance', label: 'Assurance', required: true, acceptedSourceTypes: ['audit'] },
      ],
    };

    const evidence: EvidenceRef[] = [
      { id: 'plan-1', sourceType: 'document', label: 'Care plan' },
      { id: 'delivery-1', sourceType: 'system', label: 'Session record' },
    ];

    const result = evaluateEvidenceContract(contract, evidence);

    expect(result.complete).toBe(false);
    expect(result.completeness).toBe(67);
    expect(result.missing.map(item => item.id)).toEqual(['assurance']);
  });

  it('promotes repeated service-level gaps into a cross-service pattern without calling a single local issue organisational', () => {
    const snapshot = evaluateSnapshot(buildDemoOperationalState());
    const patterns = detectCrossServicePatterns(snapshot.capabilities, 2);

    expect(patterns).toEqual(expect.arrayContaining([
      expect.objectContaining({ capabilityId: 'handover', scope: 'CROSS_SERVICE' }),
      expect.objectContaining({ capabilityId: 'one-to-one', scope: 'CROSS_SERVICE' }),
    ]));

    expect(patterns.some(pattern => pattern.capabilityId === 'rostering-integration')).toBe(false);
  });
});
