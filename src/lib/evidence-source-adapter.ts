import type {
  ControlObservationRecord,
  EvidenceBinding,
  EvidenceItem,
  OperationalStateLedger,
  ServiceCapability,
} from './operational-state-intelligence';

export interface EvidenceSourceContext {
  ledger: Readonly<OperationalStateLedger>;
  capability?: Readonly<ServiceCapability>;
  serviceId?: string;
}

export interface EvidenceProposal {
  id: string;
  adapterId: string;
  proposedAt: string;
  summary: string;
  observations: ControlObservationRecord[];
  evidence: EvidenceItem[];
  bindings: EvidenceBinding[];
  reviewState: 'PENDING_REVIEW';
}

/**
 * Integration boundary for future Nourish/manual-file/source-system readers.
 *
 * Adapters are proposal-only. They may read an approved source and propose
 * metadata, observations and exact evidence bindings. They cannot save the
 * Operational State Ledger and cannot set VERIFIED/EVIDENCED state directly.
 * A manager review path must explicitly accept any proposal before it can
 * contribute to verification.
 */
export interface EvidenceSourceAdapter {
  readonly id: string;
  readonly label: string;
  readonly readOnly: true;
  propose(context: EvidenceSourceContext): Promise<EvidenceProposal[]>;
}

export function proposalIsReviewOnly(proposal: EvidenceProposal): boolean {
  return proposal.reviewState === 'PENDING_REVIEW'
    && proposal.evidence.every(item => item.reviewState === 'PENDING_REVIEW');
}
