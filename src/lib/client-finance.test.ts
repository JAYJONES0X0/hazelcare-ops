import { describe, expect, it } from 'vitest';
import {
  buildFinanceOversightSummary,
  buildFinanceWidgets,
  buildLegacyFinanceImportSummary,
  canUseFinanceCapability,
  auditLegacyBalanceChain,
  assignFinancialException,
  approveReceiptLedgerMatch,
  approveReconciliationSession,
  buildFinanceAuditPack,
  captureReceiptBatchEvidence,
  captureReceiptEvidence,
  confirmFinancialTransaction,
  createManualFinancialTransaction,
  createReviewedTransactionCorrection,
  detectFinancialExceptions,
  editUnreviewedTransaction,
  matchReceiptsToLedgerRows,
  parseLegacyLedgerText,
  proposeTransactionFromReceipt,
  recalculateBalanceChain,
  rejectReceiptLedgerMatch,
  resolveFinancialException,
  type ClientFinanceAccessProfile,
  type ClientMoneyAccount,
  type FinancialTransaction,
  type FinancialException,
  type ReceiptEvidence,
} from './client-finance';

const account: ClientMoneyAccount = {
  id: 'acct-alistair-cash',
  personId: 'client-alistair',
  personName: 'Alistair Gunn',
  house: 'Station House',
  service: 'Meadowview Care',
  label: 'Personal cash tin',
  type: 'cash',
  openingBalance: 50,
  openingBalanceAt: '2026-07-01T09:00:00.000Z',
  currency: 'GBP',
  reviewState: 'unreviewed',
  createdAt: '2026-07-01T09:00:00.000Z',
};

const receipt: ReceiptEvidence = {
  id: 'receipt-1',
  sourceName: 'tesco-receipt.jpg',
  capturedAt: '2026-07-04T12:00:00.000Z',
  capturedBy: 'Staff A',
  personId: 'client-alistair',
  house: 'Station House',
  accountId: account.id,
  status: 'extracted',
  extractionMethod: 'text',
  merchant: 'Tesco',
  transactionDate: '2026-07-04T10:30:00.000Z',
  total: 12.4,
  paymentMethod: 'cash',
  reference: 'TX-123',
  category: 'groceries',
  confidence: 0.91,
  text: 'TESCO 04/07/2026 10:30 TOTAL GBP 12.40 CASH REF TX-123',
  linkedTransactionId: null,
  reviewState: 'unreviewed',
  rejectedReasons: [],
  activity: [],
};

function tx(partial: Partial<FinancialTransaction>): FinancialTransaction {
  return {
    id: partial.id || 'tx-1',
    accountId: account.id,
    personId: account.personId,
    personName: account.personName,
    house: account.house,
    service: account.service,
    occurredAt: partial.occurredAt || '2026-07-04T10:30:00.000Z',
    direction: partial.direction || 'out',
    amount: partial.amount ?? 12.4,
    calculatedBalance: partial.calculatedBalance ?? null,
    merchant: partial.merchant || 'Tesco',
    category: partial.category || 'groceries',
    supportPurpose: partial.supportPurpose || 'Weekly food shopping',
    paymentMethod: partial.paymentMethod || 'cash',
    receiptIds: partial.receiptIds || ['receipt-1'],
    staffAttestation: partial.staffAttestation || {
      by: 'Staff A',
      at: '2026-07-04T12:05:00.000Z',
      statement: 'I confirm this reflects supported spending.',
    },
    reviewState: partial.reviewState || 'unreviewed',
    transactionState: partial.transactionState || 'confirmed',
    reviewer: partial.reviewer,
    discrepancyState: partial.discrepancyState || 'clear',
    activity: partial.activity || [],
  };
}

describe('client money and financial safeguarding', () => {
  it('extracts receipt evidence and creates a proposed transaction without posting it', () => {
    const evidence = captureReceiptEvidence({
      id: 'receipt-auto',
      sourceName: 'receipt.jpg',
      text: 'TESCO EXPRESS 04/07/2026 10:30 TOTAL £12.40 CASH REF TX-123',
      capturedAt: '2026-07-04T12:00:00.000Z',
      capturedBy: 'Staff A',
      personId: account.personId,
      house: account.house,
      accountId: account.id,
    });

    const proposed = proposeTransactionFromReceipt(account, evidence, {
      supportPurpose: 'Weekly food shopping',
      staffName: 'Staff A',
      at: '2026-07-04T12:05:00.000Z',
    });

    expect(evidence).toMatchObject({
      status: 'extracted',
      merchant: 'Tesco Express',
      total: 12.4,
      paymentMethod: 'cash',
      confidence: expect.any(Number),
    });
    expect(proposed).toMatchObject({
      transactionState: 'proposed',
      reviewState: 'review_required',
      calculatedBalance: null,
      receiptIds: [evidence.id],
      supportPurpose: 'Weekly food shopping',
    });
  });

  it('keeps low-confidence receipt extraction in review instead of making fact', () => {
    const evidence = captureReceiptEvidence({
      id: 'receipt-weak',
      sourceName: 'blurred.jpg',
      text: 'unclear image maybe 7',
      capturedAt: '2026-07-04T12:00:00.000Z',
      capturedBy: 'Staff A',
      personId: account.personId,
      house: account.house,
      accountId: account.id,
    });

    expect(evidence.status).toBe('review_required');
    expect(evidence.reviewState).toBe('review_required');
    expect(evidence.rejectedReasons).toContain('Receipt total could not be extracted with confidence.');
  });

  it('creates a manual transaction as review-required evidence instead of a demo test row', () => {
    const transaction = createManualFinancialTransaction(account, [], {
      occurredAt: '2026-07-05T12:30:00.000Z',
      direction: 'out',
      amount: 8.5,
      merchant: 'Community Cafe',
      category: 'community_access',
      supportPurpose: 'Community lunch with staff support.',
      paymentMethod: 'cash',
      by: 'Staff A',
      statement: 'Receipt is not available yet; manager review required.',
    });

    expect(transaction).toMatchObject({
      accountId: account.id,
      personId: account.personId,
      personName: account.personName,
      occurredAt: '2026-07-05T12:30:00.000Z',
      direction: 'out',
      amount: 8.5,
      calculatedBalance: 41.5,
      merchant: 'Community Cafe',
      category: 'community_access',
      supportPurpose: 'Community lunch with staff support.',
      paymentMethod: 'cash',
      receiptIds: [],
      reviewState: 'review_required',
      transactionState: 'confirmed',
      discrepancyState: 'missing_receipt',
    });
    expect(transaction.staffAttestation).toMatchObject({
      by: 'Staff A',
      statement: 'Receipt is not available yet; manager review required.',
    });
    expect(transaction.activity[0]).toMatchObject({
      action: 'transaction_confirmed',
      reason: 'Manual client money transaction recorded; receipt evidence remains reviewable.',
    });
  });

  it('validates manual transaction amount and support context before posting', () => {
    expect(() => createManualFinancialTransaction(account, [], {
      direction: 'out',
      amount: 0,
      supportPurpose: 'Community lunch.',
      by: 'Staff A',
    })).toThrow('Manual transaction amount must be greater than zero.');

    expect(() => createManualFinancialTransaction(account, [], {
      direction: 'out',
      amount: 5,
      supportPurpose: '   ',
      by: 'Staff A',
    })).toThrow('Manual transaction support purpose is required.');
  });

  it('detects duplicate receipts, missing receipts, and unmatched receipts neutrally', () => {
    const duplicate = { ...receipt, id: 'receipt-duplicate', linkedTransactionId: null };
    const confirmed = tx({ id: 'tx-confirmed', receiptIds: ['receipt-1'] });
    const noReceipt = tx({ id: 'tx-no-receipt', receiptIds: [], amount: 8, merchant: 'Cafe' });

    const exceptions = detectFinancialExceptions({
      account,
      receipts: [{ ...receipt, linkedTransactionId: 'tx-confirmed' }, duplicate],
      transactions: [confirmed, noReceipt],
    });

    expect(exceptions.map(item => item.type)).toEqual(expect.arrayContaining([
      'duplicate_receipt',
      'transaction_without_receipt',
      'receipt_without_transaction',
    ]));
    expect(exceptions.every(item => !/fraud|theft|accuse/i.test(item.message))).toBe(true);
  });

  it('calculates balances from confirmed transactions and recalculates after an unreviewed edit', () => {
    const first = tx({ id: 'tx-1', amount: 10, occurredAt: '2026-07-04T09:00:00.000Z' });
    const second = tx({ id: 'tx-2', amount: 5, occurredAt: '2026-07-05T09:00:00.000Z' });

    expect(recalculateBalanceChain(account, [second, first]).map(row => row.balanceAfter)).toEqual([40, 35]);

    const edited = editUnreviewedTransaction(first, {
      amount: 15,
      by: 'Manager',
      reason: 'Receipt total corrected before review.',
      at: '2026-07-05T12:00:00.000Z',
    });
    expect(recalculateBalanceChain(account, [edited, second]).map(row => row.balanceAfter)).toEqual([35, 30]);
    expect(edited.activity[0]).toMatchObject({
      action: 'transaction_edited',
      by: 'Manager',
      reason: 'Receipt total corrected before review.',
    });
  });

  it('blocks editing reviewed transactions unless a correction event is explicitly created', () => {
    expect(() => editUnreviewedTransaction(tx({ reviewState: 'reviewed' }), {
      amount: 20,
      by: 'Manager',
      reason: 'Changing reviewed amount.',
      at: '2026-07-05T12:00:00.000Z',
    })).toThrow('Reviewed financial transactions require a correction event.');
  });

  it('confirms proposed transactions with staff attestation and calculated balance', () => {
    const proposed = proposeTransactionFromReceipt(account, receipt, {
      supportPurpose: 'Weekly food shopping',
      staffName: 'Staff A',
      at: '2026-07-04T12:05:00.000Z',
    });

    const confirmed = confirmFinancialTransaction(account, [], proposed, {
      by: 'Staff A',
      statement: 'Receipt checked against the client cash ledger.',
      at: '2026-07-04T12:10:00.000Z',
    });

    expect(confirmed).toMatchObject({
      transactionState: 'confirmed',
      calculatedBalance: 37.6,
      staffAttestation: {
        by: 'Staff A',
        statement: 'Receipt checked against the client cash ledger.',
      },
    });
  });

  it('checks finance capabilities by capability and scope rather than job title', () => {
    const profile: ClientFinanceAccessProfile = {
      userId: 'reviewer-1',
      displayTitle: 'External Reviewer',
      capabilities: ['client_finance.view', 'client_finance.view_exceptions'],
      scopes: [{ house: 'Station House', personId: account.personId }],
    };

    expect(canUseFinanceCapability(profile, 'client_finance.view_exceptions', { house: 'Station House', personId: account.personId })).toBe(true);
    expect(canUseFinanceCapability(profile, 'client_finance.approve', { house: 'Station House', personId: account.personId })).toBe(false);
    expect(canUseFinanceCapability(profile, 'client_finance.view', { house: 'Other House', personId: account.personId })).toBe(false);
  });

  it('builds financial safeguarding widgets from real exception and reconciliation state', () => {
    const widgets = buildFinanceWidgets({
      accounts: [{ ...account, lowBalanceThreshold: 10 }],
      receipts: [{ ...receipt, linkedTransactionId: null }],
      transactions: [tx({ id: 'tx-no-receipt', receiptIds: [], amount: 45 })],
      exceptions: [],
    });

    expect(widgets.find(widget => widget.id === 'missing-receipts')?.count).toBe(1);
    expect(widgets.find(widget => widget.id === 'exception-count')?.count).toBeGreaterThan(0);
    expect(widgets.find(widget => widget.id === 'low-balance')?.count).toBe(1);
  });

  it('builds finance oversight rows from account evidence and unresolved exceptions', () => {
    const manual = createManualFinancialTransaction(account, [], {
      direction: 'out',
      amount: 12.4,
      occurredAt: '2026-07-04T12:10:00.000Z',
      by: 'Staff A',
      merchant: 'Corner Shop',
      category: 'food_shopping',
      supportPurpose: 'Weekly food shopping',
      paymentMethod: 'cash',
    });

    const summary = buildFinanceOversightSummary({
      accounts: [account],
      receipts: [],
      transactions: [manual],
      exceptions: [],
    });

    expect(summary.totals).toMatchObject({
      accounts: 1,
      missingReceipts: 1,
      openExceptions: 1,
      pendingReviews: 1,
    });
    expect(summary.rows[0]).toMatchObject({
      accountId: account.id,
      personName: 'Alistair Gunn',
      house: 'Station House',
      balance: 37.6,
      missingReceipts: 1,
      openExceptions: 1,
      pendingReviews: 1,
      state: 'review',
      nextAction: 'Review missing receipt evidence',
    });
  });

  it('uses persisted resolved exception status when building finance oversight rows', () => {
    const manual = createManualFinancialTransaction(account, [], {
      direction: 'out',
      amount: 12.4,
      occurredAt: '2026-07-04T12:10:00.000Z',
      by: 'Staff A',
      merchant: 'Corner Shop',
      category: 'food_shopping',
      supportPurpose: 'Weekly food shopping',
      paymentMethod: 'cash',
    });
    const [raised] = detectFinancialExceptions({ account, receipts: [], transactions: [manual] });
    const resolved = resolveFinancialException(raised, {
      resolvedBy: 'Finance Lead',
      reason: 'Receipt replacement declaration accepted.',
      resolvedAt: '2026-07-05T09:00:00.000Z',
      outcome: 'resolved',
    });

    const summary = buildFinanceOversightSummary({
      accounts: [account],
      receipts: [],
      transactions: [manual],
      exceptions: [resolved],
    });

    expect(summary.totals.openExceptions).toBe(0);
    expect(summary.totals.missingReceipts).toBe(1);
    expect(summary.rows[0].openExceptions).toBe(0);
    expect(summary.rows[0].nextAction).toBe('Review pending client money records');
  });

  it('filters finance oversight rows by house and person scope', () => {
    const otherAccount: ClientMoneyAccount = {
      ...account,
      id: 'acct-other',
      personId: 'client-other',
      personName: 'Other Person',
      house: 'Other House',
    };
    const stationTransaction = createManualFinancialTransaction(account, [], {
      direction: 'out',
      amount: 10,
      occurredAt: '2026-07-04T12:00:00.000Z',
      by: 'Staff A',
      supportPurpose: 'Community lunch',
    });
    const otherTransaction = createManualFinancialTransaction(otherAccount, [], {
      direction: 'out',
      amount: 5,
      occurredAt: '2026-07-04T13:00:00.000Z',
      by: 'Staff B',
      supportPurpose: 'Snack purchase',
    });

    const houseSummary = buildFinanceOversightSummary({
      accounts: [account, otherAccount],
      receipts: [],
      transactions: [stationTransaction, otherTransaction],
      exceptions: [],
      scope: { house: 'Station House' },
    });
    const personSummary = buildFinanceOversightSummary({
      accounts: [account, otherAccount],
      receipts: [],
      transactions: [stationTransaction, otherTransaction],
      exceptions: [],
      scope: { personId: 'client-other' },
    });

    expect(houseSummary.rows).toHaveLength(1);
    expect(houseSummary.rows[0].personName).toBe('Alistair Gunn');
    expect(personSummary.rows).toHaveLength(1);
    expect(personSummary.rows[0].personName).toBe('Other Person');
  });

  it('parses a legacy ledger sheet into reviewable draft rows without posting transactions', () => {
    const result = parseLegacyLedgerText(account, {
      sourceName: 'daily-finance-sheet-ocr.txt',
      importedAt: '2026-07-06T09:00:00.000Z',
      importedBy: 'Finance reviewer',
      text: `
        04/07/2026 Weekly food shopping OUT 12.40 BAL 37.60 LM
        05/07/2026 D/A OUT 5.00 BAL 32.60
        06/07/2026 Cash allowance IN 20.00 BAL 52.60 SB
      `,
    });

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      description: 'Weekly food shopping',
      direction: 'out',
      amount: 12.4,
      statedBalance: 37.6,
      staffInitials: 'LM',
      reviewRequired: false,
    });
    expect(result.rows[1]).toMatchObject({
      description: 'D/A',
      reviewRequired: true,
    });
    expect(result.rows[1].rejectedReasons).toEqual(expect.arrayContaining([
      'Ledger description is too ambiguous to trust without review.',
      'Staff initials were not detected on this ledger row.',
    ]));
    expect(result.rows.every(row => row.proposedTransactionId === null)).toBe(true);
  });

  it('proposes receipt-to-ledger matches without linking evidence automatically', () => {
    const result = parseLegacyLedgerText(account, {
      sourceName: 'daily-finance-sheet-ocr.txt',
      importedAt: '2026-07-06T09:00:00.000Z',
      importedBy: 'Finance reviewer',
      text: '04/07/2026 Weekly food shopping OUT 12.40 BAL 37.60 LM',
    });

    const proposals = matchReceiptsToLedgerRows([receipt], result.rows);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      receiptId: receipt.id,
      ledgerRowId: result.rows[0].id,
      reviewRequired: false,
    });
    expect(proposals[0].confidence).toBeGreaterThanOrEqual(0.8);
    expect(receipt.linkedTransactionId).toBeNull();
    expect(result.rows[0].receiptMatchIds).toEqual([]);
  });

  it('audits legacy ledger balance chains with neutral discrepancy language', () => {
    const result = parseLegacyLedgerText(account, {
      sourceName: 'daily-finance-sheet-ocr.txt',
      importedAt: '2026-07-06T09:00:00.000Z',
      importedBy: 'Finance reviewer',
      text: `
        04/07/2026 Weekly food shopping OUT 10.00 BAL 40.00 LM
        05/07/2026 Community lunch OUT 5.00 BAL 36.00 SB
      `,
    });

    const issues = auditLegacyBalanceChain(account, result.rows);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      rowNumber: 2,
      expectedBalance: 35,
      statedBalance: 36,
      difference: 1,
    });
    expect(issues[0].message).toContain('Reconciliation required');
    expect(issues[0].message).not.toMatch(/fraud|theft|accuse/i);
  });

  it('summarises legacy finance imports with unmatched receipts and review work visible', () => {
    const result = parseLegacyLedgerText(account, {
      sourceName: 'daily-finance-sheet-ocr.txt',
      importedAt: '2026-07-06T09:00:00.000Z',
      importedBy: 'Finance reviewer',
      text: `
        04/07/2026 Weekly food shopping OUT 12.40 BAL 37.60 LM
        05/07/2026 D/A OUT 5.00 BAL 32.60
      `,
    });
    const unmatched = { ...receipt, id: 'receipt-unmatched', total: 99.99, sourceName: 'unmatched.jpg' };
    const proposals = matchReceiptsToLedgerRows([receipt, unmatched], result.rows);
    const issues = auditLegacyBalanceChain(account, result.rows);

    const summary = buildLegacyFinanceImportSummary({
      importResult: result,
      receipts: [receipt, unmatched],
      matchProposals: proposals,
      balanceIssues: issues,
    });

    expect(summary).toMatchObject({
      rowsImported: 2,
      rowsNeedReview: 1,
      receiptMatches: 1,
      unmatchedReceipts: 1,
      unmatchedLedgerRows: 1,
      balanceIssues: 0,
    });
  });

  it('captures a loose receipt pile as separate evidence records without posting transactions', () => {
    const batch = captureReceiptBatchEvidence({
      sourceName: 'receipt-pile-ocr.txt',
      capturedAt: '2026-07-06T10:00:00.000Z',
      capturedBy: 'Staff A',
      personId: account.personId,
      house: account.house,
      accountId: account.id,
      text: `
        TESCO EXPRESS
        04/07/2026 10:30
        TOTAL GBP 12.40
        CASH REF TX-123

        COMMUNITY CAFE
        05/07/2026 12:15
        TOTAL GBP 5.00
        CARD REF CF-77
      `,
    });

    expect(batch.receiptsCaptured).toBe(2);
    expect(batch.receiptsNeedReview).toBe(0);
    expect(batch.receipts.map(item => item.sourceName)).toEqual([
      'receipt-pile-ocr.txt #1',
      'receipt-pile-ocr.txt #2',
    ]);
    expect(batch.receipts.map(item => item.total)).toEqual([12.4, 5]);
    expect(batch.receipts.every(item => item.linkedTransactionId === null)).toBe(true);
  });

  it('keeps weak batch receipt blocks in review and reports duplicate candidates', () => {
    const batch = captureReceiptBatchEvidence({
      sourceName: 'receipt-pile-ocr.txt',
      capturedAt: '2026-07-06T10:00:00.000Z',
      capturedBy: 'Staff A',
      personId: account.personId,
      house: account.house,
      accountId: account.id,
      text: `
        TESCO EXPRESS
        04/07/2026 10:30
        TOTAL GBP 12.40
        CASH REF TX-123

        TESCO EXPRESS
        04/07/2026 10:30
        TOTAL GBP 12.40
        CASH REF TX-123

        blurred unreadable fragment
      `,
    });

    expect(batch.receiptsCaptured).toBe(3);
    expect(batch.receiptsNeedReview).toBe(1);
    expect(batch.duplicateCandidateCount).toBe(1);
    expect(batch.receipts[2]).toMatchObject({
      status: 'review_required',
      reviewState: 'review_required',
    });
    expect(batch.rejectedReasons).toContain('One or more receipt blocks need review before use.');
  });

  it('feeds batch receipts into legacy ledger match proposals without auto-linking', () => {
    const batch = captureReceiptBatchEvidence({
      sourceName: 'receipt-pile-ocr.txt',
      capturedAt: '2026-07-06T10:00:00.000Z',
      capturedBy: 'Staff A',
      personId: account.personId,
      house: account.house,
      accountId: account.id,
      text: `
        TESCO EXPRESS
        04/07/2026 10:30
        TOTAL GBP 12.40
        CASH REF TX-123
      `,
    });
    const ledger = parseLegacyLedgerText(account, {
      sourceName: 'daily-finance-sheet-ocr.txt',
      importedAt: '2026-07-06T09:00:00.000Z',
      importedBy: 'Finance reviewer',
      text: '04/07/2026 Weekly food shopping OUT 12.40 BAL 37.60 LM',
    });

    const proposals = matchReceiptsToLedgerRows(batch.receipts, ledger.rows);

    expect(proposals).toHaveLength(1);
    expect(proposals[0].receiptId).toBe(batch.receipts[0].id);
    expect(batch.receipts[0].linkedTransactionId).toBeNull();
    expect(ledger.rows[0].receiptMatchIds).toEqual([]);
  });

  it('approves a receipt-ledger match into a proposed transaction without changing the balance', () => {
    const batch = captureReceiptBatchEvidence({
      sourceName: 'receipt-pile-ocr.txt',
      capturedAt: '2026-07-06T10:00:00.000Z',
      capturedBy: 'Staff A',
      personId: account.personId,
      house: account.house,
      accountId: account.id,
      text: `
        TESCO EXPRESS
        04/07/2026 10:30
        TOTAL GBP 12.40
        CASH REF TX-123
      `,
    });
    const ledger = parseLegacyLedgerText(account, {
      sourceName: 'daily-finance-sheet-ocr.txt',
      importedAt: '2026-07-06T09:00:00.000Z',
      importedBy: 'Finance reviewer',
      text: '04/07/2026 Weekly food shopping OUT 12.40 BAL 37.60 LM',
    });
    const [proposal] = matchReceiptsToLedgerRows(batch.receipts, ledger.rows);

    const approved = approveReceiptLedgerMatch(account, proposal, batch.receipts[0], ledger.rows[0], {
      reviewedBy: 'Manager',
      reviewedAt: '2026-07-06T11:00:00.000Z',
      reviewNote: 'Receipt and ledger entry describe the same purchase.',
    });

    expect(approved.transaction).toMatchObject({
      transactionState: 'proposed',
      reviewState: 'review_required',
      calculatedBalance: null,
      amount: 12.4,
      supportPurpose: 'Weekly food shopping',
      receiptIds: [batch.receipts[0].id],
      reviewer: 'Manager',
    });
    expect(approved.receipt).toMatchObject({
      status: 'matched',
      linkedTransactionId: approved.transaction.id,
    });
    expect(approved.ledgerRow).toMatchObject({
      proposedTransactionId: approved.transaction.id,
      receiptMatchIds: [proposal.id],
    });
    expect(recalculateBalanceChain(account, [approved.transaction])).toEqual([]);
  });

  it('rejects a receipt-ledger match with reason and leaves evidence unposted', () => {
    const ledger = parseLegacyLedgerText(account, {
      sourceName: 'daily-finance-sheet-ocr.txt',
      importedAt: '2026-07-06T09:00:00.000Z',
      importedBy: 'Finance reviewer',
      text: '04/07/2026 Weekly food shopping OUT 12.40 BAL 37.60 LM',
    });
    const [proposal] = matchReceiptsToLedgerRows([receipt], ledger.rows);

    const rejected = rejectReceiptLedgerMatch(proposal, receipt, ledger.rows[0], {
      reviewedBy: 'Manager',
      reviewedAt: '2026-07-06T11:05:00.000Z',
      reason: 'Receipt belongs to a different cash sheet.',
    });

    expect(rejected.receipt).toMatchObject({
      linkedTransactionId: null,
      reviewState: 'review_required',
    });
    expect(rejected.ledgerRow).toMatchObject({
      proposedTransactionId: null,
      reviewRequired: true,
    });
    expect(rejected.ledgerRow.rejectedReasons).toContain('Receipt-ledger match rejected: Receipt belongs to a different cash sheet.');
  });

  it('creates an explicit correction transaction instead of editing a reviewed record', () => {
    const reviewed = tx({
      id: 'tx-reviewed',
      amount: 12.4,
      calculatedBalance: 37.6,
      reviewState: 'reviewed',
      transactionState: 'reviewed',
    });

    const correction = createReviewedTransactionCorrection(account, [reviewed], reviewed, {
      correctedAmount: 10,
      correctedSupportPurpose: 'Weekly food shopping - corrected receipt total.',
      by: 'Manager',
      reason: 'Original reviewed amount included an item that was returned.',
      at: '2026-07-07T09:00:00.000Z',
    });

    expect(correction.original).toMatchObject({
      id: reviewed.id,
      amount: 12.4,
      transactionState: 'disputed',
      reviewState: 'review_required',
    });
    expect(correction.correction).toMatchObject({
      direction: 'in',
      amount: 2.4,
      transactionState: 'confirmed',
      reviewState: 'review_required',
      discrepancyState: 'review_required',
      supportPurpose: 'Correction: Weekly food shopping - corrected receipt total.',
    });
    expect(correction.balanceChain.map(row => row.balanceAfter)).toEqual([37.6, 40]);
  });

  it('does not flag correction transactions as receipt amount mismatches when they reference original evidence', () => {
    const reviewed = tx({
      id: 'tx-reviewed',
      amount: 12.4,
      calculatedBalance: 37.6,
      reviewState: 'reviewed',
      transactionState: 'reviewed',
    });
    const correction = createReviewedTransactionCorrection(account, [reviewed], reviewed, {
      correctedAmount: 10,
      by: 'Manager',
      reason: 'Original reviewed amount included an item that was returned.',
      at: '2026-07-07T09:00:00.000Z',
    });

    const exceptions = detectFinancialExceptions({
      account,
      receipts: [{ ...receipt, linkedTransactionId: reviewed.id }],
      transactions: [correction.original, correction.correction],
    });

    expect(exceptions.map(item => item.type)).not.toContain('receipt_amount_mismatch');
  });

  it('keeps detected financial exception IDs stable for review assignment', () => {
    const transaction = tx({
      id: 'tx-without-receipt',
      receiptIds: [],
      transactionState: 'confirmed',
      reviewState: 'review_required',
    });

    const first = detectFinancialExceptions({ account, receipts: [], transactions: [transaction], asOf: '2026-07-07T09:00:00.000Z' });
    const second = detectFinancialExceptions({ account, receipts: [], transactions: [transaction], asOf: '2026-07-07T10:00:00.000Z' });

    expect(first[0]?.id).toBe(second[0]?.id);
    expect(first[0]?.type).toBe('transaction_without_receipt');
  });

  it('assigns a financial exception to a reviewer with visible activity', () => {
    const exception: FinancialException = {
      id: 'exception-assign',
      accountId: account.id,
      personId: account.personId,
      house: account.house,
      type: 'transaction_without_receipt',
      severity: 'review',
      message: 'Reconciliation required: a transaction has no linked receipt evidence.',
      evidenceIds: [],
      transactionIds: ['tx-1'],
      status: 'raised',
      createdAt: '2026-07-07T09:00:00.000Z',
    };

    const assigned = assignFinancialException(exception, {
      assignedTo: 'Finance lead',
      assignedBy: 'Manager',
      assignedAt: '2026-07-07T09:05:00.000Z',
      note: 'Review receipt drawer before month end close.',
    });

    expect(assigned).toMatchObject({
      status: 'assigned',
      assignedTo: 'Finance lead',
      assignedBy: 'Manager',
      assignedAt: '2026-07-07T09:05:00.000Z',
      reviewNote: 'Review receipt drawer before month end close.',
    });
    expect(assigned.activity?.[0]).toMatchObject({
      action: 'exception_assigned',
      by: 'Manager',
      reason: 'Review receipt drawer before month end close.',
    });
  });

  it('resolves a financial exception with reviewer outcome and reason', () => {
    const exception: FinancialException = {
      id: 'exception-resolve',
      accountId: account.id,
      personId: account.personId,
      house: account.house,
      type: 'receipt_without_transaction',
      severity: 'review',
      message: 'Reconciliation required: receipt is not linked to a confirmed transaction.',
      evidenceIds: ['receipt-1'],
      transactionIds: [],
      status: 'assigned',
      createdAt: '2026-07-07T09:00:00.000Z',
      assignedTo: 'Finance lead',
      assignedBy: 'Manager',
      assignedAt: '2026-07-07T09:05:00.000Z',
    };

    const resolved = resolveFinancialException(exception, {
      resolvedBy: 'Finance lead',
      resolvedAt: '2026-07-07T09:30:00.000Z',
      outcome: 'resolved',
      reason: 'Receipt was linked to the confirmed community shop transaction.',
    });

    expect(resolved).toMatchObject({
      status: 'resolved',
      resolvedBy: 'Finance lead',
      resolvedAt: '2026-07-07T09:30:00.000Z',
      resolutionReason: 'Receipt was linked to the confirmed community shop transaction.',
    });
    expect(resolved.activity?.[0]).toMatchObject({
      action: 'exception_resolved',
      by: 'Finance lead',
    });
  });

  it('requires a valid correction amount and reason for reviewed transaction corrections', () => {
    const reviewed = tx({
      id: 'tx-reviewed-validation',
      amount: 12.4,
      calculatedBalance: 37.6,
      reviewState: 'reviewed',
      transactionState: 'reviewed',
    });

    expect(() => createReviewedTransactionCorrection(account, [reviewed], reviewed, {
      correctedAmount: Number.NaN,
      by: 'Manager',
      reason: 'Input error.',
    })).toThrow('Correction amount must be a valid non-negative number.');

    expect(() => createReviewedTransactionCorrection(account, [reviewed], reviewed, {
      correctedAmount: 10,
      by: 'Manager',
      reason: '   ',
    })).toThrow('Correction reason is required.');
  });

  it('blocks reconciliation approval when open exceptions or discrepancies remain', () => {
    const session = {
      id: 'recon-1',
      accountId: account.id,
      openedAt: '2026-07-07T09:00:00.000Z',
      openedBy: 'Manager',
      status: 'discrepancy_found' as const,
      expectedBalance: 38,
      calculatedBalance: 37.6,
      discrepancy: 0.4,
      exceptionIds: ['exception-1'],
    };
    const exception: FinancialException = {
      id: 'exception-1',
      accountId: account.id,
      personId: account.personId,
      house: account.house,
      type: 'arithmetic_discrepancy',
      severity: 'review',
      message: 'Reconciliation required: counted balance differs from the calculated balance.',
      evidenceIds: [],
      transactionIds: [],
      status: 'raised',
      createdAt: '2026-07-07T09:00:00.000Z',
    };

    expect(() => approveReconciliationSession(session, {
      exceptions: [exception],
      reviewedBy: 'Manager',
      reviewedAt: '2026-07-07T09:10:00.000Z',
    })).toThrow('Cannot approve reconciliation while discrepancies or open exceptions remain.');
  });

  it('approves a clean reconciliation and marks confirmed transactions as reconciled', () => {
    const confirmed = tx({
      id: 'tx-confirmed',
      amount: 12.4,
      calculatedBalance: 37.6,
      reviewState: 'review_required',
      transactionState: 'confirmed',
    });
    const session = {
      id: 'recon-clean',
      accountId: account.id,
      openedAt: '2026-07-07T09:00:00.000Z',
      openedBy: 'Manager',
      status: 'resolved' as const,
      expectedBalance: 37.6,
      calculatedBalance: 37.6,
      discrepancy: 0,
      exceptionIds: [],
    };

    const approved = approveReconciliationSession(session, {
      transactions: [confirmed],
      exceptions: [],
      reviewedBy: 'Manager',
      reviewedAt: '2026-07-07T09:10:00.000Z',
    });

    expect(approved.session).toMatchObject({
      status: 'approved',
      reviewedBy: 'Manager',
      reviewedAt: '2026-07-07T09:10:00.000Z',
    });
    expect(approved.transactions[0]).toMatchObject({
      reviewState: 'reviewed',
      transactionState: 'reconciled',
      reviewer: 'Manager',
    });
  });

  it('builds a source-linked finance audit pack with transactions, receipts, exceptions, and reconciliation state', () => {
    const confirmed = tx({
      id: 'tx-confirmed',
      amount: 12.4,
      calculatedBalance: 37.6,
      reviewState: 'reviewed',
      transactionState: 'reconciled',
    });
    const auditPack = buildFinanceAuditPack({
      account,
      transactions: [confirmed],
      receipts: [{ ...receipt, linkedTransactionId: confirmed.id }],
      exceptions: [],
      reconciliations: [{
        id: 'recon-clean',
        accountId: account.id,
        openedAt: '2026-07-07T09:00:00.000Z',
        openedBy: 'Manager',
        status: 'approved',
        expectedBalance: 37.6,
        calculatedBalance: 37.6,
        discrepancy: 0,
        exceptionIds: [],
        reviewedBy: 'Manager',
        reviewedAt: '2026-07-07T09:10:00.000Z',
      }],
      generatedAt: '2026-07-07T09:15:00.000Z',
    });

    expect(auditPack.fileName).toMatch(/^client-money-audit-pack-alistair-gunn-/);
    expect(auditPack.text).toContain('CLIENT MONEY & FINANCIAL SAFEGUARDING PACK');
    expect(auditPack.text).toContain('SOURCE EVIDENCE');
    expect(auditPack.text).toContain('tesco-receipt.jpg');
    expect(auditPack.text).toContain('TRANSACTIONS');
    expect(auditPack.text).toContain('RECONCILIATION');
    expect(auditPack.text).toContain('reviewed');
    expect(auditPack.text).toContain('No open exceptions detected.');
  });
});
