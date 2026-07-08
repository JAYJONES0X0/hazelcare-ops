import { logAuditAction } from './audit';

export type ClientFinanceCapability =
  | 'client_finance.view'
  | 'client_finance.capture'
  | 'client_finance.create_transaction'
  | 'client_finance.edit_unreviewed'
  | 'client_finance.reconcile'
  | 'client_finance.approve'
  | 'client_finance.export'
  | 'client_finance.view_exceptions';

export type FinancialReviewState = 'unreviewed' | 'review_required' | 'reviewed' | 'deferred';
export type FinancialSensitivity = 'standard' | 'confidential' | 'safeguarding' | 'finance';

export interface ClientFinanceScope {
  organisationId?: string;
  service?: string;
  house?: string;
  personId?: string;
  sensitivity?: FinancialSensitivity;
  expiresAt?: string;
}

export interface ClientFinanceAccessProfile {
  userId: string;
  displayTitle?: string;
  capabilities: ClientFinanceCapability[];
  scopes: ClientFinanceScope[];
}

export interface ClientMoneyAccount {
  id: string;
  personId: string;
  personName: string;
  house: string;
  service?: string;
  label: string;
  type: 'cash' | 'prepaid_card' | 'bank' | 'petty_cash';
  openingBalance: number;
  openingBalanceAt: string;
  currency: 'GBP';
  lowBalanceThreshold?: number;
  expectedAllowanceAmount?: number;
  expectedAllowanceDay?: number;
  reviewState: FinancialReviewState;
  createdAt: string;
}

export interface FinanceActivityEvent {
  id: string;
  at: string;
  by: string;
  action:
    | 'receipt_captured'
    | 'receipt_extracted'
    | 'receipt_review_required'
    | 'transaction_proposed'
    | 'transaction_confirmed'
    | 'transaction_edited'
    | 'transaction_correction_created'
    | 'exception_raised'
    | 'exception_assigned'
    | 'exception_resolved'
    | 'reconciliation_opened'
    | 'reconciliation_completed'
    | 'reviewer_approved'
    | 'reviewer_rejected';
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface ReceiptEvidence {
  id: string;
  sourceName: string;
  capturedAt: string;
  capturedBy: string;
  personId?: string;
  house?: string;
  accountId?: string;
  status: 'received' | 'extracted' | 'matched' | 'attached' | 'reviewed' | 'rejected' | 'review_required';
  extractionMethod: 'image' | 'ocr' | 'text' | 'manual';
  merchant?: string;
  transactionDate?: string;
  total?: number;
  paymentMethod?: 'cash' | 'card' | 'bank_transfer' | 'unknown';
  reference?: string;
  category?: string;
  confidence: number;
  text?: string;
  linkedTransactionId: string | null;
  reviewState: FinancialReviewState;
  rejectedReasons: string[];
  activity: FinanceActivityEvent[];
}

export interface ReceiptBatchImportResult {
  id: string;
  sourceName: string;
  capturedAt: string;
  capturedBy: string;
  personId?: string;
  house?: string;
  accountId?: string;
  receipts: ReceiptEvidence[];
  receiptsCaptured: number;
  receiptsNeedReview: number;
  duplicateCandidateCount: number;
  rejectedReasons: string[];
}

export interface FinancialTransaction {
  id: string;
  accountId: string;
  personId: string;
  personName: string;
  house: string;
  service?: string;
  occurredAt: string;
  direction: 'in' | 'out';
  amount: number;
  calculatedBalance: number | null;
  merchant?: string;
  category?: string;
  supportPurpose: string;
  paymentMethod?: ReceiptEvidence['paymentMethod'];
  receiptIds: string[];
  staffAttestation?: {
    by: string;
    at: string;
    statement: string;
  };
  reviewState: FinancialReviewState;
  transactionState: 'proposed' | 'confirmed' | 'reviewed' | 'reconciled' | 'disputed';
  reviewer?: string;
  discrepancyState: 'clear' | 'missing_receipt' | 'amount_mismatch' | 'duplicate_possible' | 'review_required';
  activity: FinanceActivityEvent[];
}

export interface BalanceChainEntry {
  transactionId: string;
  balanceBefore: number;
  delta: number;
  balanceAfter: number;
  occurredAt: string;
}

export interface FinancialException {
  id: string;
  accountId: string;
  personId?: string;
  house?: string;
  type:
    | 'receipt_amount_mismatch'
    | 'duplicate_receipt'
    | 'transaction_without_receipt'
    | 'receipt_without_transaction'
    | 'unreconciled_cash_withdrawal'
    | 'negative_balance'
    | 'expected_allowance_missing'
    | 'unusual_merchant_or_frequency'
    | 'round_number_cash_pattern'
    | 'late_transaction_entry'
    | 'arithmetic_discrepancy'
    | 'missing_staff_confirmation'
    | 'possible_duplicate_transaction'
    | 'monthly_allowance_exceeded'
    | 'low_balance';
  severity: 'info' | 'review' | 'urgent';
  message: string;
  evidenceIds: string[];
  transactionIds: string[];
  status: 'raised' | 'assigned' | 'under_review' | 'resolved' | 'deferred';
  createdAt: string;
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: string;
  reviewNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionReason?: string;
  activity?: FinanceActivityEvent[];
}

export interface ReconciliationSession {
  id: string;
  accountId: string;
  openedAt: string;
  openedBy: string;
  status: 'open' | 'discrepancy_found' | 'resolved' | 'approved';
  expectedBalance: number;
  calculatedBalance: number;
  discrepancy: number;
  exceptionIds: string[];
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface LegacyLedgerRow {
  id: string;
  importId: string;
  accountId: string;
  sourceName: string;
  rowNumber: number;
  rawText: string;
  occurredAt: string | null;
  description: string;
  direction: 'in' | 'out' | 'unknown';
  amount: number | null;
  statedBalance: number | null;
  staffInitials?: string;
  category?: string;
  confidence: number;
  reviewRequired: boolean;
  rejectedReasons: string[];
  proposedTransactionId: string | null;
  receiptMatchIds: string[];
}

export interface LegacyLedgerImportResult {
  id: string;
  accountId: string;
  sourceName: string;
  importedAt: string;
  importedBy: string;
  rows: LegacyLedgerRow[];
  rowsImported: number;
  rowsNeedReview: number;
}

export interface ReceiptLedgerMatchProposal {
  id: string;
  receiptId: string;
  ledgerRowId: string;
  confidence: number;
  reasons: string[];
  reviewRequired: boolean;
}

export interface ReceiptLedgerReviewInput {
  reviewedBy: string;
  reviewedAt?: string;
  reviewNote?: string;
  reason?: string;
}

export interface ReceiptLedgerApprovalResult {
  transaction: FinancialTransaction;
  receipt: ReceiptEvidence;
  ledgerRow: LegacyLedgerRow;
}

export interface ReceiptLedgerRejectionResult {
  receipt: ReceiptEvidence;
  ledgerRow: LegacyLedgerRow;
}

export interface ManualFinancialTransactionInput {
  occurredAt?: string;
  direction: FinancialTransaction['direction'];
  amount: number;
  merchant?: string;
  category?: string;
  supportPurpose: string;
  paymentMethod?: ReceiptEvidence['paymentMethod'];
  by: string;
  statement?: string;
  receiptIds?: string[];
}

export interface LegacyBalanceAuditIssue {
  id: string;
  ledgerRowId: string;
  rowNumber: number;
  expectedBalance: number;
  statedBalance: number;
  difference: number;
  severity: 'review' | 'urgent';
  message: string;
}

export interface LegacyFinanceImportSummary {
  rowsImported: number;
  rowsNeedReview: number;
  receiptMatches: number;
  unmatchedReceipts: number;
  unmatchedLedgerRows: number;
  balanceIssues: number;
}

export interface ReviewedTransactionCorrectionInput {
  correctedAmount: number;
  correctedSupportPurpose?: string;
  correctedDirection?: FinancialTransaction['direction'];
  by: string;
  reason: string;
  at?: string;
}

export interface ReviewedTransactionCorrectionResult {
  original: FinancialTransaction;
  correction: FinancialTransaction;
  balanceChain: BalanceChainEntry[];
}

export interface ReconciliationApprovalInput {
  transactions?: FinancialTransaction[];
  exceptions?: FinancialException[];
  reviewedBy: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface ReconciliationApprovalResult {
  session: ReconciliationSession;
  transactions: FinancialTransaction[];
}

export interface FinancialExceptionAssignmentInput {
  assignedTo: string;
  assignedBy: string;
  assignedAt?: string;
  note?: string;
}

export interface FinancialExceptionResolutionInput {
  resolvedBy: string;
  resolvedAt?: string;
  outcome: 'resolved' | 'deferred';
  reason: string;
}

export interface FinanceAuditPackInput {
  account: ClientMoneyAccount;
  transactions: FinancialTransaction[];
  receipts: ReceiptEvidence[];
  exceptions: FinancialException[];
  reconciliations: ReconciliationSession[];
  generatedAt?: string;
}

export interface FinanceAuditPack {
  fileName: string;
  text: string;
  generatedAt: string;
}

export const FINANCE_STATE_KEY = 'hc-client-finance-v1';

export interface FinanceState {
  accounts: ClientMoneyAccount[];
  receipts: ReceiptEvidence[];
  transactions: FinancialTransaction[];
  reconciliations: ReconciliationSession[];
  exceptionLog: FinancialException[];
  legacyImports: LegacyLedgerImportResult[];
  receiptBatches: ReceiptBatchImportResult[];
}

export const emptyFinanceState: FinanceState = {
  accounts: [],
  receipts: [],
  transactions: [],
  reconciliations: [],
  exceptionLog: [],
  legacyImports: [],
  receiptBatches: [],
};

export interface FinanceWidget {
  id: 'missing-receipts' | 'unreconciled-withdrawals' | 'pending-approvals' | 'low-balance' | 'monthly-reconciliation' | 'exception-count';
  label: string;
  count: number;
  state: 'clear' | 'review' | 'urgent';
}

export interface FinanceOversightRow {
  accountId: string;
  personId: string;
  personName: string;
  house: string;
  service?: string;
  accountLabel: string;
  balance: number;
  missingReceipts: number;
  openExceptions: number;
  pendingReviews: number;
  lowBalance: boolean;
  blockedReasons: string[];
  nextAction: string;
  state: 'clear' | 'review' | 'urgent';
}

export interface FinanceOversightSummary {
  rows: FinanceOversightRow[];
  totals: {
    accounts: number;
    missingReceipts: number;
    openExceptions: number;
    pendingReviews: number;
    lowBalance: number;
    urgentRows: number;
  };
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function stableId(prefix: string, basis: string) {
  let hash = 0;
  for (let index = 0; index < basis.length; index += 1) {
    hash = ((hash << 5) - hash + basis.charCodeAt(index)) | 0;
  }
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, letter => letter.toUpperCase())
    .trim();
}

function normaliseText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normaliseFinanceState(parsed: Partial<FinanceState> | null | undefined): FinanceState {
  return {
    accounts: Array.isArray(parsed?.accounts) ? parsed.accounts : [],
    receipts: Array.isArray(parsed?.receipts) ? parsed.receipts : [],
    transactions: Array.isArray(parsed?.transactions) ? parsed.transactions : [],
    reconciliations: Array.isArray(parsed?.reconciliations) ? parsed.reconciliations : [],
    exceptionLog: Array.isArray(parsed?.exceptionLog) ? parsed.exceptionLog : [],
    legacyImports: Array.isArray(parsed?.legacyImports) ? parsed.legacyImports : [],
    receiptBatches: Array.isArray(parsed?.receiptBatches) ? parsed.receiptBatches : [],
  };
}

export function loadFinanceState(): FinanceState {
  if (typeof localStorage === 'undefined') return emptyFinanceState;
  try {
    const raw = localStorage.getItem(FINANCE_STATE_KEY);
    if (!raw) return emptyFinanceState;
    return normaliseFinanceState(JSON.parse(raw) as Partial<FinanceState>);
  } catch {
    return emptyFinanceState;
  }
}

export function saveFinanceState(state: FinanceState) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FINANCE_STATE_KEY, JSON.stringify(normaliseFinanceState(state)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hc-client-finance-updated'));
  }
}

function parseReceiptTotal(text: string): number | undefined {
  const patterns = [
    /\btotal(?:\s+gbp)?\s*[£]?\s*(\d+(?:[.,]\d{2})?)/i,
    /\bamount\s*[£]?\s*(\d+(?:[.,]\d{2})?)/i,
    /£\s*(\d+(?:[.,]\d{2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return roundMoney(Number(match[1].replace(',', '.')));
  }
  return undefined;
}

function parseReceiptDate(text: string): string | undefined {
  const dateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (!dateMatch) return undefined;
  const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\b/);
  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  let year = Number(dateMatch[3]);
  if (year < 100) year += 2000;
  const hour = timeMatch ? Number(timeMatch[1]) : 12;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function parseLedgerDate(text: string, defaultYear: number): string | null {
  const match = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : defaultYear;
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseMerchant(text: string): string | undefined {
  const cleaned = normaliseText(text)
    .replace(/\b(total|amount|cash|card|visa|mastercard|gbp|ref|receipt)\b.*$/i, '')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b.*$/i, '')
    .replace(/[^\w &'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || /\d/.test(cleaned)) return undefined;
  return titleCase(cleaned.split(' ').slice(0, 4).join(' '));
}

function parsePaymentMethod(text: string): ReceiptEvidence['paymentMethod'] {
  if (/\bcash\b/i.test(text)) return 'cash';
  if (/\b(card|visa|mastercard|contactless)\b/i.test(text)) return 'card';
  if (/\btransfer|faster payment|bank\b/i.test(text)) return 'bank_transfer';
  return 'unknown';
}

function parseReference(text: string): string | undefined {
  const match = text.match(/\b(?:ref|reference|receipt)\s*[:#-]?\s*([a-z0-9-]{3,})\b/i);
  return match?.[1]?.toUpperCase();
}

function receiptFingerprint(receipt: Pick<ReceiptEvidence, 'merchant' | 'transactionDate' | 'total' | 'reference' | 'sourceName'>): string {
  return [
    receipt.reference || '',
    receipt.merchant || '',
    (receipt.transactionDate || '').slice(0, 10),
    receipt.total ?? '',
    receipt.sourceName || '',
  ].join('|').toLowerCase();
}

function transactionFingerprint(transaction: Pick<FinancialTransaction, 'merchant' | 'occurredAt' | 'amount' | 'direction'>): string {
  return [
    transaction.merchant || '',
    transaction.occurredAt.slice(0, 10),
    transaction.direction,
    transaction.amount,
  ].join('|').toLowerCase();
}

function event(input: Omit<FinanceActivityEvent, 'id'>): FinanceActivityEvent {
  return { id: id('finance-event'), ...input };
}

export function captureReceiptEvidence(input: {
  id?: string;
  sourceName: string;
  text?: string;
  capturedAt?: string;
  capturedBy: string;
  personId?: string;
  house?: string;
  accountId?: string;
  extractionMethod?: ReceiptEvidence['extractionMethod'];
}): ReceiptEvidence {
  const text = normaliseText(input.text || '');
  const total = parseReceiptTotal(text);
  const transactionDate = parseReceiptDate(text);
  const merchant = parseMerchant(text);
  const paymentMethod = parsePaymentMethod(text);
  const reference = parseReference(text);
  let confidence = 0.15;
  if (merchant) confidence += 0.2;
  if (transactionDate) confidence += 0.2;
  if (typeof total === 'number') confidence += 0.35;
  if (paymentMethod !== 'unknown') confidence += 0.1;
  if (reference) confidence += 0.05;
  confidence = Math.min(0.98, roundMoney(confidence));

  const rejectedReasons: string[] = [];
  if (typeof total !== 'number') rejectedReasons.push('Receipt total could not be extracted with confidence.');
  if (!merchant) rejectedReasons.push('Merchant could not be extracted with confidence.');
  if (!transactionDate) rejectedReasons.push('Receipt date could not be extracted with confidence.');
  const reviewRequired = confidence < 0.7 || rejectedReasons.length > 0;
  const capturedAt = input.capturedAt || new Date().toISOString();
  const status: ReceiptEvidence['status'] = reviewRequired ? 'review_required' : 'extracted';
  const receipt: ReceiptEvidence = {
    id: input.id || id('receipt'),
    sourceName: input.sourceName,
    capturedAt,
    capturedBy: input.capturedBy,
    personId: input.personId,
    house: input.house,
    accountId: input.accountId,
    status,
    extractionMethod: input.extractionMethod || (text ? 'text' : 'image'),
    merchant,
    transactionDate,
    total,
    paymentMethod,
    reference,
    category: inferCategory(`${merchant || ''} ${text}`),
    confidence,
    text,
    linkedTransactionId: null,
    reviewState: reviewRequired ? 'review_required' : 'unreviewed',
    rejectedReasons,
    activity: [
      event({
        at: capturedAt,
        by: input.capturedBy,
        action: reviewRequired ? 'receipt_review_required' : 'receipt_extracted',
        reason: reviewRequired ? 'Receipt captured but needs review before use.' : 'Receipt captured and extracted.',
      }),
    ],
  };

  logAuditAction(
    reviewRequired ? 'finance_receipt_review_required' : 'finance_receipt_extracted',
    reviewRequired ? `Receipt ${receipt.sourceName} needs financial review.` : `Receipt ${receipt.sourceName} extracted for financial safeguarding.`,
    { receiptId: receipt.id, confidence: receipt.confidence, rejectedReasons: receipt.rejectedReasons },
  );
  return receipt;
}

function splitReceiptBatchText(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n\s*\n|^-{3,}$/m)
    .map(block => block.trim())
    .filter(Boolean);
}

function receiptBatchFingerprint(receipt: ReceiptEvidence): string {
  return [
    receipt.reference || '',
    receipt.merchant || '',
    (receipt.transactionDate || '').slice(0, 10),
    receipt.total ?? '',
  ].join('|').toLowerCase();
}

export function captureReceiptBatchEvidence(input: {
  sourceName: string;
  text: string;
  capturedAt?: string;
  capturedBy: string;
  personId?: string;
  house?: string;
  accountId?: string;
  extractionMethod?: ReceiptEvidence['extractionMethod'];
}): ReceiptBatchImportResult {
  const capturedAt = input.capturedAt || new Date().toISOString();
  const batchId = id('receipt-batch');
  const blocks = splitReceiptBatchText(input.text);
  const receipts = blocks.map((block, index) => captureReceiptEvidence({
    id: `${batchId}-receipt-${index + 1}`,
    sourceName: `${input.sourceName} #${index + 1}`,
    text: block,
    capturedAt,
    capturedBy: input.capturedBy,
    personId: input.personId,
    house: input.house,
    accountId: input.accountId,
    extractionMethod: input.extractionMethod || 'ocr',
  }));

  const seen = new Set<string>();
  let duplicateCandidateCount = 0;
  for (const receipt of receipts) {
    const fingerprint = receiptBatchFingerprint(receipt);
    if (fingerprint.replace(/\|/g, '').length < 3) continue;
    if (seen.has(fingerprint)) duplicateCandidateCount += 1;
    seen.add(fingerprint);
  }

  const receiptsNeedReview = receipts.filter(receipt => receipt.reviewState === 'review_required').length;
  const rejectedReasons: string[] = [];
  if (receipts.length === 0) rejectedReasons.push('No receipt blocks were detected in the batch.');
  if (receiptsNeedReview > 0) rejectedReasons.push('One or more receipt blocks need review before use.');
  if (duplicateCandidateCount > 0) rejectedReasons.push('One or more receipt blocks may duplicate existing evidence in this batch.');

  logAuditAction('finance_receipt_batch_captured', `Captured receipt batch ${input.sourceName} for financial safeguarding.`, {
    batchId,
    accountId: input.accountId,
    receiptsCaptured: receipts.length,
    receiptsNeedReview,
    duplicateCandidateCount,
  });

  return {
    id: batchId,
    sourceName: input.sourceName,
    capturedAt,
    capturedBy: input.capturedBy,
    personId: input.personId,
    house: input.house,
    accountId: input.accountId,
    receipts,
    receiptsCaptured: receipts.length,
    receiptsNeedReview,
    duplicateCandidateCount,
    rejectedReasons,
  };
}

function inferCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/tesco|asda|sainsbury|aldi|lidl|morrisons|food|grocery|groceries/.test(lower)) return 'groceries';
  if (/cafe|restaurant|lunch|coffee|meal/.test(lower)) return 'community_meal';
  if (/clothing|shoe|primark/.test(lower)) return 'clothing';
  if (/pharmacy|chemist|boots/.test(lower)) return 'health';
  if (/cash|atm|withdrawal/.test(lower)) return 'cash_withdrawal';
  return 'client_spending';
}

function inferLedgerDirection(line: string): LegacyLedgerRow['direction'] {
  const lower = line.toLowerCase();
  if (/\b(in|income|credit|deposit|allowance|received|paid in)\b/.test(lower)) return 'in';
  if (/\b(out|debit|spent|spend|shopping|purchase|paid|cash out|withdrawn|withdrawal|d\/a)\b/.test(lower)) return 'out';
  return 'unknown';
}

function parseLedgerMoneyValues(line: string): number[] {
  return Array.from(line.matchAll(/(?:gbp|bal(?:ance)?|amount|£)?\s*(-?\d+(?:[.,]\d{2}))/gi))
    .map(match => Number(match[1].replace(',', '.')))
    .filter(value => Number.isFinite(value))
    .map(roundMoney);
}

function parseLedgerStaffInitials(line: string): string | undefined {
  const withoutMoney = line.replace(/(?:gbp|bal(?:ance)?|amount|£)?\s*-?\d+(?:[.,]\d{2})/gi, ' ');
  const match = withoutMoney.trim().match(/\b([A-Z]{1,4}(?:\/[A-Z]{1,4})?)$/);
  if (!match) return undefined;
  const value = match[1];
  if (/^(IN|OUT|BAL|GBP)$/i.test(value)) return undefined;
  return value.toUpperCase();
}

function parseLedgerDescription(line: string, staffInitials?: string): string {
  let description = line
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')
    .replace(/(?:gbp|bal(?:ance)?|amount|£)?\s*-?\d+(?:[.,]\d{2})/gi, ' ')
    .replace(/\b(in|out|income|credit|deposit|allowance|received|paid in|debit|spent|spend|purchase|paid|cash out|withdrawn|withdrawal)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (staffInitials) {
    description = description.replace(new RegExp(`\\b${staffInitials.replace('/', '\\/')}\\b$`, 'i'), '').trim();
  }
  return description || 'Unclear ledger entry';
}

function isAmbiguousLedgerDescription(description: string): boolean {
  const compact = description.toLowerCase().replace(/[^a-z0-9]/g, '');
  return !compact || compact.length <= 2 || ['da', 'na', 'misc', 'unknown', 'unclear'].includes(compact);
}

export function parseLegacyLedgerText(account: ClientMoneyAccount, input: {
  sourceName: string;
  text: string;
  importedAt?: string;
  importedBy: string;
}): LegacyLedgerImportResult {
  const importedAt = input.importedAt || new Date().toISOString();
  const importId = id('legacy-ledger-import');
  const defaultYear = new Date(account.openingBalanceAt || importedAt).getUTCFullYear();
  const rows = input.text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index): LegacyLedgerRow => {
      const occurredAt = parseLedgerDate(line, defaultYear);
      const moneyValues = parseLedgerMoneyValues(line);
      const direction = inferLedgerDirection(line);
      const amount = moneyValues.length ? Math.abs(moneyValues[0]) : null;
      const statedBalance = moneyValues.length > 1 ? moneyValues[moneyValues.length - 1] : null;
      const staffInitials = parseLedgerStaffInitials(line);
      const description = parseLedgerDescription(line, staffInitials);
      const rejectedReasons: string[] = [];
      if (!occurredAt) rejectedReasons.push('Ledger date could not be detected.');
      if (direction === 'unknown') rejectedReasons.push('Ledger money-in/out direction could not be detected.');
      if (amount === null) rejectedReasons.push('Ledger amount could not be detected.');
      if (statedBalance === null) rejectedReasons.push('Ledger balance could not be detected.');
      if (!staffInitials) rejectedReasons.push('Staff initials were not detected on this ledger row.');
      if (isAmbiguousLedgerDescription(description)) rejectedReasons.push('Ledger description is too ambiguous to trust without review.');

      let confidence = 0.1;
      if (occurredAt) confidence += 0.2;
      if (direction !== 'unknown') confidence += 0.15;
      if (amount !== null) confidence += 0.2;
      if (statedBalance !== null) confidence += 0.15;
      if (staffInitials) confidence += 0.1;
      if (!isAmbiguousLedgerDescription(description)) confidence += 0.1;
      confidence = Math.min(0.98, roundMoney(confidence));

      return {
        id: `${importId}-row-${index + 1}`,
        importId,
        accountId: account.id,
        sourceName: input.sourceName,
        rowNumber: index + 1,
        rawText: line,
        occurredAt,
        description,
        direction,
        amount,
        statedBalance,
        staffInitials,
        category: inferCategory(description),
        confidence,
        reviewRequired: confidence < 0.75 || rejectedReasons.length > 0,
        rejectedReasons,
        proposedTransactionId: null,
        receiptMatchIds: [],
      };
    });

  logAuditAction('finance_ledger_imported', `Imported legacy client money ledger text for ${account.personName}.`, {
    accountId: account.id,
    sourceName: input.sourceName,
    rowsImported: rows.length,
    rowsNeedReview: rows.filter(row => row.reviewRequired).length,
  });

  return {
    id: importId,
    accountId: account.id,
    sourceName: input.sourceName,
    importedAt,
    importedBy: input.importedBy,
    rows,
    rowsImported: rows.length,
    rowsNeedReview: rows.filter(row => row.reviewRequired).length,
  };
}

function daysBetween(a: string | undefined | null, b: string | undefined | null): number | null {
  if (!a || !b) return null;
  const first = Date.parse(a);
  const second = Date.parse(b);
  if (Number.isNaN(first) || Number.isNaN(second)) return null;
  return Math.abs(first - second) / 86_400_000;
}

function sharedWords(a: string, b: string): number {
  const left = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2));
  const right = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2));
  let count = 0;
  for (const word of left) {
    if (right.has(word)) count += 1;
  }
  return count;
}

export function matchReceiptsToLedgerRows(receipts: ReceiptEvidence[], rows: LegacyLedgerRow[]): ReceiptLedgerMatchProposal[] {
  const proposals: ReceiptLedgerMatchProposal[] = [];
  for (const receipt of receipts) {
    let best: ReceiptLedgerMatchProposal | null = null;
    for (const row of rows) {
      if (row.amount === null || row.direction === 'unknown') continue;
      const reasons: string[] = [];
      let confidence = 0;
      if (typeof receipt.total === 'number' && Math.abs(Math.abs(receipt.total) - row.amount) <= 0.01) {
        confidence += 0.45;
        reasons.push('Amount matches.');
      }
      const dayGap = daysBetween(receipt.transactionDate || receipt.capturedAt, row.occurredAt);
      if (dayGap !== null && dayGap <= 1) {
        confidence += 0.25;
        reasons.push('Date is within one day.');
      }
      if (receipt.category && row.category && receipt.category === row.category) {
        confidence += 0.15;
        reasons.push('Spending category matches.');
      }
      if (receipt.merchant && sharedWords(receipt.merchant, row.description) > 0) {
        confidence += 0.1;
        reasons.push('Merchant text appears in ledger description.');
      }
      if (row.direction === 'out' && receipt.total !== undefined && receipt.total >= 0) {
        confidence += 0.05;
        reasons.push('Receipt direction is compatible with spending row.');
      }
      confidence = roundMoney(Math.min(0.98, confidence));
      if (confidence < 0.5) continue;
      const proposal: ReceiptLedgerMatchProposal = {
        id: id('receipt-ledger-match'),
        receiptId: receipt.id,
        ledgerRowId: row.id,
        confidence,
        reasons,
        reviewRequired: confidence < 0.75 || receipt.reviewState === 'review_required' || row.reviewRequired,
      };
      if (!best || proposal.confidence > best.confidence) best = proposal;
    }
    if (best) proposals.push(best);
  }
  return proposals;
}

export function approveReceiptLedgerMatch(
  account: ClientMoneyAccount,
  proposal: ReceiptLedgerMatchProposal,
  receipt: ReceiptEvidence,
  ledgerRow: LegacyLedgerRow,
  input: ReceiptLedgerReviewInput,
): ReceiptLedgerApprovalResult {
  if (proposal.receiptId !== receipt.id || proposal.ledgerRowId !== ledgerRow.id) {
    throw new Error('Receipt-ledger match proposal does not match the supplied evidence.');
  }
  const reviewedAt = input.reviewedAt || new Date().toISOString();
  const amount = ledgerRow.amount ?? Math.abs(receipt.total || 0);
  const direction: FinancialTransaction['direction'] = ledgerRow.direction === 'in' ? 'in' : 'out';
  const transaction: FinancialTransaction = {
    id: id('finance-tx'),
    accountId: account.id,
    personId: account.personId,
    personName: account.personName,
    house: account.house,
    service: account.service,
    occurredAt: ledgerRow.occurredAt || receipt.transactionDate || receipt.capturedAt,
    direction,
    amount,
    calculatedBalance: null,
    merchant: receipt.merchant || ledgerRow.description,
    category: ledgerRow.category || receipt.category,
    supportPurpose: ledgerRow.description,
    paymentMethod: receipt.paymentMethod,
    receiptIds: [receipt.id],
    reviewState: 'review_required',
    transactionState: 'proposed',
    reviewer: input.reviewedBy,
    discrepancyState: proposal.reviewRequired || ledgerRow.reviewRequired || receipt.reviewState === 'review_required'
      ? 'review_required'
      : 'clear',
    activity: [
      event({
        at: reviewedAt,
        by: input.reviewedBy,
        action: 'reviewer_approved',
        reason: input.reviewNote || 'Receipt-ledger match accepted. Transaction still requires confirmation before posting.',
        after: {
          receiptId: receipt.id,
          ledgerRowId: ledgerRow.id,
          matchProposalId: proposal.id,
          confidence: proposal.confidence,
        },
      }),
    ],
  };
  const nextReceipt: ReceiptEvidence = {
    ...receipt,
    status: 'matched',
    linkedTransactionId: transaction.id,
    activity: [
      event({
        at: reviewedAt,
        by: input.reviewedBy,
        action: 'reviewer_approved',
        reason: input.reviewNote || 'Receipt matched to legacy ledger row for proposed transaction.',
      }),
      ...receipt.activity,
    ],
  };
  const nextLedgerRow: LegacyLedgerRow = {
    ...ledgerRow,
    proposedTransactionId: transaction.id,
    receiptMatchIds: Array.from(new Set([...ledgerRow.receiptMatchIds, proposal.id])),
  };
  logAuditAction('finance_reviewer_approved', `Accepted receipt-ledger match for ${account.personName}.`, {
    accountId: account.id,
    transactionId: transaction.id,
    receiptId: receipt.id,
    ledgerRowId: ledgerRow.id,
    matchProposalId: proposal.id,
    confidence: proposal.confidence,
  });
  return { transaction, receipt: nextReceipt, ledgerRow: nextLedgerRow };
}

export function rejectReceiptLedgerMatch(
  proposal: ReceiptLedgerMatchProposal,
  receipt: ReceiptEvidence,
  ledgerRow: LegacyLedgerRow,
  input: ReceiptLedgerReviewInput,
): ReceiptLedgerRejectionResult {
  if (proposal.receiptId !== receipt.id || proposal.ledgerRowId !== ledgerRow.id) {
    throw new Error('Receipt-ledger match proposal does not match the supplied evidence.');
  }
  const reviewedAt = input.reviewedAt || new Date().toISOString();
  const reason = input.reason || input.reviewNote || 'Receipt-ledger match rejected by reviewer.';
  const nextReceipt: ReceiptEvidence = {
    ...receipt,
    reviewState: 'review_required',
    activity: [
      event({
        at: reviewedAt,
        by: input.reviewedBy,
        action: 'reviewer_rejected',
        reason,
      }),
      ...receipt.activity,
    ],
  };
  const nextLedgerRow: LegacyLedgerRow = {
    ...ledgerRow,
    reviewRequired: true,
    rejectedReasons: Array.from(new Set([
      ...ledgerRow.rejectedReasons,
      `Receipt-ledger match rejected: ${reason}`,
    ])),
  };
  logAuditAction('finance_reviewer_rejected', `Rejected receipt-ledger match for review.`, {
    receiptId: receipt.id,
    ledgerRowId: ledgerRow.id,
    matchProposalId: proposal.id,
    confidence: proposal.confidence,
    reason,
  });
  return { receipt: nextReceipt, ledgerRow: nextLedgerRow };
}

export function auditLegacyBalanceChain(account: ClientMoneyAccount, rows: LegacyLedgerRow[]): LegacyBalanceAuditIssue[] {
  const issues: LegacyBalanceAuditIssue[] = [];
  let balance = account.openingBalance;
  const ordered = rows
    .slice()
    .sort((a, b) => {
      const timeA = a.occurredAt ? Date.parse(a.occurredAt) : Number.MAX_SAFE_INTEGER;
      const timeB = b.occurredAt ? Date.parse(b.occurredAt) : Number.MAX_SAFE_INTEGER;
      return timeA - timeB || a.rowNumber - b.rowNumber;
    });

  for (const row of ordered) {
    if (row.direction === 'unknown' || row.amount === null || row.statedBalance === null) continue;
    const delta = row.direction === 'in' ? row.amount : -row.amount;
    balance = roundMoney(balance + delta);
    const difference = roundMoney(row.statedBalance - balance);
    if (Math.abs(difference) > 0.01) {
      issues.push({
        id: id('legacy-balance-issue'),
        ledgerRowId: row.id,
        rowNumber: row.rowNumber,
        expectedBalance: balance,
        statedBalance: row.statedBalance,
        difference,
        severity: Math.abs(difference) >= 20 ? 'urgent' : 'review',
        message: `Reconciliation required: the recorded balance changed by ${moneyDelta(difference)} more than confirmed ledger arithmetic explains.`,
      });
      balance = row.statedBalance;
    }
  }
  return issues;
}

function moneyDelta(value: number): string {
  return `GBP ${Math.abs(value).toFixed(2)}`;
}

function money(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'GBP 0.00';
  return `GBP ${value.toFixed(2)}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'client';
}

export function buildLegacyFinanceImportSummary(input: {
  importResult: LegacyLedgerImportResult;
  receipts: ReceiptEvidence[];
  matchProposals: ReceiptLedgerMatchProposal[];
  balanceIssues: LegacyBalanceAuditIssue[];
}): LegacyFinanceImportSummary {
  const matchedReceiptIds = new Set(input.matchProposals.filter(item => !item.reviewRequired).map(item => item.receiptId));
  const matchedLedgerRowIds = new Set(input.matchProposals.filter(item => !item.reviewRequired).map(item => item.ledgerRowId));
  return {
    rowsImported: input.importResult.rowsImported,
    rowsNeedReview: input.importResult.rows.filter(row => row.reviewRequired).length,
    receiptMatches: matchedReceiptIds.size,
    unmatchedReceipts: input.receipts.filter(receipt => !matchedReceiptIds.has(receipt.id)).length,
    unmatchedLedgerRows: input.importResult.rows.filter(row => !matchedLedgerRowIds.has(row.id)).length,
    balanceIssues: input.balanceIssues.length,
  };
}

export function proposeTransactionFromReceipt(account: ClientMoneyAccount, receipt: ReceiptEvidence, input: {
  supportPurpose: string;
  staffName: string;
  at?: string;
}): FinancialTransaction {
  const at = input.at || new Date().toISOString();
  const transaction: FinancialTransaction = {
    id: id('finance-tx'),
    accountId: account.id,
    personId: account.personId,
    personName: account.personName,
    house: account.house,
    service: account.service,
    occurredAt: receipt.transactionDate || receipt.capturedAt,
    direction: receipt.total && receipt.total < 0 ? 'in' : 'out',
    amount: Math.abs(receipt.total || 0),
    calculatedBalance: null,
    merchant: receipt.merchant,
    category: receipt.category,
    supportPurpose: input.supportPurpose,
    paymentMethod: receipt.paymentMethod,
    receiptIds: [receipt.id],
    staffAttestation: {
      by: input.staffName,
      at,
      statement: 'Proposed from receipt evidence; staff confirmation required before posting.',
    },
    reviewState: 'review_required',
    transactionState: 'proposed',
    discrepancyState: receipt.reviewState === 'review_required' ? 'review_required' : 'clear',
    activity: [
      event({
        at,
        by: input.staffName,
        action: 'transaction_proposed',
        reason: 'Receipt evidence produced a proposed transaction. Balance not posted until confirmation.',
      }),
    ],
  };
  logAuditAction('finance_transaction_proposed', `Proposed ${account.personName} transaction from receipt evidence.`, {
    transactionId: transaction.id,
    receiptIds: transaction.receiptIds,
    accountId: account.id,
  });
  return transaction;
}

export function createManualFinancialTransaction(
  account: ClientMoneyAccount,
  existing: FinancialTransaction[],
  input: ManualFinancialTransactionInput,
): FinancialTransaction {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Manual transaction amount must be greater than zero.');
  }
  const supportPurpose = input.supportPurpose.trim();
  if (!supportPurpose) {
    throw new Error('Manual transaction support purpose is required.');
  }
  const at = input.occurredAt || new Date().toISOString();
  const staffName = input.by.trim() || 'Current staff member';
  const receiptIds = input.receiptIds || [];
  const transaction: FinancialTransaction = {
    id: id('finance-manual'),
    accountId: account.id,
    personId: account.personId,
    personName: account.personName,
    house: account.house,
    service: account.service,
    occurredAt: at,
    direction: input.direction,
    amount: roundMoney(Math.abs(input.amount)),
    calculatedBalance: null,
    merchant: input.merchant?.trim() || 'Unspecified payee',
    category: input.category?.trim() || 'client_spending',
    supportPurpose,
    paymentMethod: input.paymentMethod || 'unknown',
    receiptIds,
    staffAttestation: {
      by: staffName,
      at,
      statement: input.statement?.trim() || 'Manual transaction entered; supporting evidence requires review.',
    },
    reviewState: 'review_required',
    transactionState: 'confirmed',
    discrepancyState: receiptIds.length === 0 && input.direction === 'out' ? 'missing_receipt' : 'clear',
    activity: [
      event({
        at,
        by: staffName,
        action: 'transaction_confirmed',
        reason: receiptIds.length === 0 && input.direction === 'out'
          ? 'Manual client money transaction recorded; receipt evidence remains reviewable.'
          : 'Manual client money transaction recorded with staff attestation.',
      }),
    ],
  };
  const chain = recalculateBalanceChain(account, [...existing, transaction]);
  const row = chain.find(item => item.transactionId === transaction.id);
  const posted = {
    ...transaction,
    calculatedBalance: row?.balanceAfter ?? null,
  };
  logAuditAction('finance_transaction_confirmed', 'Manual client money transaction recorded.', {
    transactionId: posted.id,
    accountId: account.id,
    receiptIds,
    discrepancyState: posted.discrepancyState,
  });
  return posted;
}

export function recalculateBalanceChain(account: ClientMoneyAccount, transactions: FinancialTransaction[]): BalanceChainEntry[] {
  const confirmed = transactions
    .filter(transaction => transaction.transactionState !== 'proposed')
    .slice()
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
  let balance = account.openingBalance;
  return confirmed.map(transaction => {
    const balanceBefore = roundMoney(balance);
    const delta = transaction.direction === 'in' ? transaction.amount : -transaction.amount;
    balance = roundMoney(balance + delta);
    return {
      transactionId: transaction.id,
      balanceBefore,
      delta: roundMoney(delta),
      balanceAfter: balance,
      occurredAt: transaction.occurredAt,
    };
  });
}

export function confirmFinancialTransaction(account: ClientMoneyAccount, existing: FinancialTransaction[], proposed: FinancialTransaction, input: {
  by: string;
  statement: string;
  at?: string;
}): FinancialTransaction {
  if (proposed.transactionState !== 'proposed') return proposed;
  const at = input.at || new Date().toISOString();
  const confirmed: FinancialTransaction = {
    ...proposed,
    transactionState: 'confirmed',
    staffAttestation: { by: input.by, at, statement: input.statement },
    activity: [
      event({
        at,
        by: input.by,
        action: 'transaction_confirmed',
        reason: 'Staff confirmed transaction context and evidence before posting.',
      }),
      ...proposed.activity,
    ],
  };
  const chain = recalculateBalanceChain(account, [...existing, confirmed]);
  const row = chain.find(item => item.transactionId === confirmed.id);
  const withBalance = { ...confirmed, calculatedBalance: row?.balanceAfter ?? null };
  logAuditAction('finance_transaction_confirmed', `Confirmed ${account.personName} client money transaction.`, {
    transactionId: withBalance.id,
    accountId: account.id,
    calculatedBalance: withBalance.calculatedBalance,
  });
  return withBalance;
}

export function editUnreviewedTransaction(transaction: FinancialTransaction, input: {
  amount?: number;
  supportPurpose?: string;
  category?: string;
  merchant?: string;
  by: string;
  reason: string;
  at?: string;
}): FinancialTransaction {
  if (transaction.reviewState === 'reviewed' || transaction.transactionState === 'reviewed' || transaction.transactionState === 'reconciled') {
    throw new Error('Reviewed financial transactions require a correction event.');
  }
  const at = input.at || new Date().toISOString();
  const before = {
    amount: transaction.amount,
    supportPurpose: transaction.supportPurpose,
    category: transaction.category,
    merchant: transaction.merchant,
  };
  const next: FinancialTransaction = {
    ...transaction,
    amount: input.amount ?? transaction.amount,
    supportPurpose: input.supportPurpose ?? transaction.supportPurpose,
    category: input.category ?? transaction.category,
    merchant: input.merchant ?? transaction.merchant,
    calculatedBalance: null,
    reviewState: 'review_required',
    activity: [
      event({
        at,
        by: input.by,
        action: 'transaction_edited',
        reason: input.reason,
        before,
        after: {
          amount: input.amount ?? transaction.amount,
          supportPurpose: input.supportPurpose ?? transaction.supportPurpose,
          category: input.category ?? transaction.category,
          merchant: input.merchant ?? transaction.merchant,
        },
      }),
      ...transaction.activity,
    ],
  };
  logAuditAction('finance_transaction_edited', `Edited unreviewed client money transaction.`, {
    transactionId: transaction.id,
    reason: input.reason,
  });
  return next;
}

export function createReviewedTransactionCorrection(
  account: ClientMoneyAccount,
  existing: FinancialTransaction[],
  transaction: FinancialTransaction,
  input: ReviewedTransactionCorrectionInput,
): ReviewedTransactionCorrectionResult {
  const isReviewed = transaction.reviewState === 'reviewed'
    || transaction.transactionState === 'reviewed'
    || transaction.transactionState === 'reconciled';
  if (!isReviewed) {
    throw new Error('Unreviewed financial transactions can be edited before review.');
  }

  const at = input.at || new Date().toISOString();
  if (!Number.isFinite(input.correctedAmount) || input.correctedAmount < 0) {
    throw new Error('Correction amount must be a valid non-negative number.');
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error('Correction reason is required.');
  }
  const correctedAmount = roundMoney(Math.abs(input.correctedAmount));
  const correctedDirection = input.correctedDirection || transaction.direction;
  const currentImpact = transaction.direction === 'in' ? transaction.amount : -transaction.amount;
  const correctedImpact = correctedDirection === 'in' ? correctedAmount : -correctedAmount;
  const correctionImpact = roundMoney(correctedImpact - currentImpact);
  if (Math.abs(correctionImpact) < 0.01) {
    throw new Error('Correction event must change the reviewed balance.');
  }

  const original: FinancialTransaction = {
    ...transaction,
    reviewState: 'review_required',
    transactionState: 'disputed',
    discrepancyState: 'review_required',
    activity: [
      event({
        at,
        by: input.by,
        action: 'transaction_correction_created',
        reason,
        before: {
          amount: transaction.amount,
          direction: transaction.direction,
          supportPurpose: transaction.supportPurpose,
        },
        after: {
          correctedAmount,
          correctedDirection,
          correctedSupportPurpose: input.correctedSupportPurpose || transaction.supportPurpose,
        },
      }),
      ...transaction.activity,
    ],
  };

  const correctionDirection: FinancialTransaction['direction'] = correctionImpact > 0 ? 'in' : 'out';
  const correction: FinancialTransaction = {
    id: id('finance-correction'),
    accountId: account.id,
    personId: account.personId,
    personName: account.personName,
    house: account.house,
    service: account.service,
    occurredAt: at,
    direction: correctionDirection,
    amount: roundMoney(Math.abs(correctionImpact)),
    calculatedBalance: null,
    merchant: transaction.merchant,
    category: transaction.category || 'correction',
    supportPurpose: `Correction: ${input.correctedSupportPurpose || transaction.supportPurpose}`,
    paymentMethod: transaction.paymentMethod,
    receiptIds: [...transaction.receiptIds],
    staffAttestation: {
      by: input.by,
      at,
      statement: `Correction event created after review: ${reason}`,
    },
    reviewState: 'review_required',
    transactionState: 'confirmed',
    reviewer: input.by,
    discrepancyState: 'review_required',
    activity: [
      event({
        at,
        by: input.by,
        action: 'transaction_correction_created',
        reason,
        before: {
          sourceTransactionId: transaction.id,
          amount: transaction.amount,
          direction: transaction.direction,
        },
        after: {
          amount: roundMoney(Math.abs(correctionImpact)),
          direction: correctionDirection,
        },
      }),
    ],
  };

  const nextTransactions = [
    ...existing.filter(item => item.id !== transaction.id),
    original,
    correction,
  ];
  const balanceChain = recalculateBalanceChain(account, nextTransactions);
  const correctionRow = balanceChain.find(item => item.transactionId === correction.id);
  const correctionWithBalance = {
    ...correction,
    calculatedBalance: correctionRow?.balanceAfter ?? null,
  };
  const chainWithCorrection = balanceChain.map(row => row.transactionId === correction.id
    ? { ...row, balanceAfter: correctionWithBalance.calculatedBalance ?? row.balanceAfter }
    : row);

  logAuditAction('finance_transaction_correction_created', 'Created reviewed client money correction event.', {
    accountId: account.id,
    sourceTransactionId: transaction.id,
    correctionTransactionId: correctionWithBalance.id,
    reason,
  });

  return {
    original,
    correction: correctionWithBalance,
    balanceChain: chainWithCorrection,
  };
}

export function detectFinancialExceptions(input: {
  account: ClientMoneyAccount;
  receipts: ReceiptEvidence[];
  transactions: FinancialTransaction[];
  asOf?: string;
}): FinancialException[] {
  const now = input.asOf || new Date().toISOString();
  const exceptions: FinancialException[] = [];
  const add = (type: FinancialException['type'], message: string, options: {
    severity?: FinancialException['severity'];
    evidenceIds?: string[];
    transactionIds?: string[];
  } = {}) => {
    const evidenceIds = options.evidenceIds || [];
    const transactionIds = options.transactionIds || [];
    const basis = [
      input.account.id,
      input.account.personId,
      type,
      evidenceIds.slice().sort().join(','),
      transactionIds.slice().sort().join(','),
      message,
    ].join('|');
    exceptions.push({
      id: stableId(`finance-exception-${type}`, basis),
      accountId: input.account.id,
      personId: input.account.personId,
      house: input.account.house,
      type,
      severity: options.severity || 'review',
      message,
      evidenceIds,
      transactionIds,
      status: 'raised',
      createdAt: now,
    });
  };

  const receiptFingerprints = new Map<string, ReceiptEvidence>();
  for (const receipt of input.receipts) {
    const fp = receiptFingerprint(receipt);
    if (receiptFingerprints.has(fp)) {
      add('duplicate_receipt', 'Reconciliation required: two receipt records appear to describe the same purchase.', {
        evidenceIds: [receipt.id, receiptFingerprints.get(fp)!.id],
      });
    } else {
      receiptFingerprints.set(fp, receipt);
    }
    if (!receipt.linkedTransactionId) {
      add('receipt_without_transaction', `Reconciliation required: receipt ${receipt.sourceName} is not linked to a confirmed transaction.`, {
        evidenceIds: [receipt.id],
      });
    }
  }

  const seenTransactions = new Map<string, FinancialTransaction>();
  for (const transaction of input.transactions) {
    if (transaction.transactionState === 'proposed') continue;
    if (transaction.receiptIds.length === 0 && transaction.direction === 'out') {
      add('transaction_without_receipt', `Reconciliation required: ${transaction.merchant || 'a transaction'} has no linked receipt evidence.`, {
        transactionIds: [transaction.id],
      });
    }
    if (!transaction.staffAttestation) {
      add('missing_staff_confirmation', 'Review required: a transaction is missing staff confirmation.', {
        transactionIds: [transaction.id],
      });
    }
    if (transaction.calculatedBalance !== null && transaction.calculatedBalance < 0) {
      add('negative_balance', 'Urgent reconciliation required: calculated balance is below zero.', {
        severity: 'urgent',
        transactionIds: [transaction.id],
      });
    }
    const matchingReceipts = input.receipts.filter(receipt => transaction.receiptIds.includes(receipt.id));
    const isCorrectionTransaction = transaction.supportPurpose.toLowerCase().startsWith('correction:')
      || transaction.activity.some(item => item.action === 'transaction_correction_created');
    for (const receipt of matchingReceipts) {
      if (!isCorrectionTransaction && typeof receipt.total === 'number' && Math.abs(receipt.total - transaction.amount) > 0.01) {
        add('receipt_amount_mismatch', `Reconciliation required: receipt total does not match the confirmed transaction amount.`, {
          evidenceIds: [receipt.id],
          transactionIds: [transaction.id],
        });
      }
    }
    if (transaction.direction === 'out' && transaction.paymentMethod === 'cash' && transaction.amount % 10 === 0 && transaction.amount >= 20) {
      add('round_number_cash_pattern', 'Review required: round-number cash spending should be checked against supporting context.', {
        transactionIds: [transaction.id],
      });
    }
    const fp = transactionFingerprint(transaction);
    if (seenTransactions.has(fp)) {
      add('possible_duplicate_transaction', 'Review required: two transaction records appear to describe the same purchase.', {
        transactionIds: [transaction.id, seenTransactions.get(fp)!.id],
      });
    } else {
      seenTransactions.set(fp, transaction);
    }
  }

  const chain = recalculateBalanceChain(input.account, input.transactions);
  const negative = chain.find(row => row.balanceAfter < 0);
  if (negative) {
    add('negative_balance', 'Urgent reconciliation required: calculated balance is below zero.', {
      severity: 'urgent',
      transactionIds: [negative.transactionId],
    });
  }
  const latestBalance = chain.at(-1)?.balanceAfter ?? input.account.openingBalance;
  if (typeof input.account.lowBalanceThreshold === 'number' && latestBalance < input.account.lowBalanceThreshold) {
    add('low_balance', `Review required: ${input.account.label} balance is below the configured threshold.`, {
      severity: 'review',
    });
  }

  return dedupeExceptions(exceptions);
}

function dedupeExceptions(exceptions: FinancialException[]): FinancialException[] {
  const seen = new Set<string>();
  return exceptions.filter(exception => {
    const key = `${exception.type}|${exception.message}|${exception.evidenceIds.join(',')}|${exception.transactionIds.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function assignFinancialException(
  exception: FinancialException,
  input: FinancialExceptionAssignmentInput,
): FinancialException {
  const assignedTo = input.assignedTo.trim();
  if (!assignedTo) {
    throw new Error('Exception assignee is required.');
  }
  const assignedBy = input.assignedBy.trim() || 'Reviewer';
  const assignedAt = input.assignedAt || new Date().toISOString();
  const note = input.note?.trim() || 'Financial exception assigned for review.';
  const next: FinancialException = {
    ...exception,
    status: 'assigned',
    assignedTo,
    assignedBy,
    assignedAt,
    reviewNote: note,
    activity: [
      event({
        at: assignedAt,
        by: assignedBy,
        action: 'exception_assigned',
        reason: note,
        before: {
          status: exception.status,
          assignedTo: exception.assignedTo,
        },
        after: {
          status: 'assigned',
          assignedTo,
        },
      }),
      ...(exception.activity || []),
    ],
  };
  logAuditAction('finance_exception_assigned', 'Assigned client money exception for review.', {
    exceptionId: exception.id,
    accountId: exception.accountId,
    assignedTo,
    assignedBy,
  });
  return next;
}

export function resolveFinancialException(
  exception: FinancialException,
  input: FinancialExceptionResolutionInput,
): FinancialException {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error('Exception resolution reason is required.');
  }
  const resolvedBy = input.resolvedBy.trim() || 'Reviewer';
  const resolvedAt = input.resolvedAt || new Date().toISOString();
  const status = input.outcome === 'deferred' ? 'deferred' : 'resolved';
  const next: FinancialException = {
    ...exception,
    status,
    resolvedBy,
    resolvedAt,
    resolutionReason: reason,
    activity: [
      event({
        at: resolvedAt,
        by: resolvedBy,
        action: 'exception_resolved',
        reason,
        before: {
          status: exception.status,
        },
        after: {
          status,
        },
      }),
      ...(exception.activity || []),
    ],
  };
  logAuditAction('finance_exception_resolved', 'Resolved client money exception review state.', {
    exceptionId: exception.id,
    accountId: exception.accountId,
    status,
    resolvedBy,
    reason,
  });
  return next;
}

export function canUseFinanceCapability(profile: ClientFinanceAccessProfile, capability: ClientFinanceCapability, scope: ClientFinanceScope = {}): boolean {
  if (!profile.capabilities.includes(capability)) return false;
  const now = Date.now();
  return profile.scopes.some(rule => {
    if (rule.expiresAt && Date.parse(rule.expiresAt) < now) return false;
    if (rule.organisationId && scope.organisationId && rule.organisationId !== scope.organisationId) return false;
    if (rule.service && scope.service && rule.service !== scope.service) return false;
    if (rule.house && scope.house && rule.house !== scope.house) return false;
    if (rule.personId && scope.personId && rule.personId !== scope.personId) return false;
    if (rule.sensitivity && scope.sensitivity && rule.sensitivity !== scope.sensitivity) return false;
    return true;
  });
}

function isOpenFinanceException(exception: FinancialException): boolean {
  return exception.status !== 'resolved' && exception.status !== 'deferred';
}

function mergeDetectedFinanceExceptions(
  detected: FinancialException[],
  persisted: FinancialException[],
): FinancialException[] {
  const persistedById = new Map(persisted.map(exception => [exception.id, exception]));
  const merged = detected.map(exception => persistedById.get(exception.id) || exception);
  const detectedIds = new Set(detected.map(exception => exception.id));
  return [
    ...merged,
    ...persisted.filter(exception => !detectedIds.has(exception.id)),
  ];
}

export function buildFinanceOversightSummary(input: {
  accounts: ClientMoneyAccount[];
  receipts: ReceiptEvidence[];
  transactions: FinancialTransaction[];
  exceptions: FinancialException[];
  scope?: Pick<ClientFinanceScope, 'service' | 'house' | 'personId'>;
}): FinanceOversightSummary {
  const scopedAccounts = input.accounts.filter(account => {
    if (input.scope?.service && account.service !== input.scope.service) return false;
    if (input.scope?.house && account.house !== input.scope.house) return false;
    if (input.scope?.personId && account.personId !== input.scope.personId) return false;
    return true;
  });
  const rows = scopedAccounts.map(account => {
    const receipts = input.receipts.filter(receipt => receipt.accountId === account.id);
    const transactions = input.transactions.filter(transaction => transaction.accountId === account.id);
    const persistedExceptions = input.exceptions.filter(exception => exception.accountId === account.id);
    const detectedExceptions = detectFinancialExceptions({ account, receipts, transactions });
    const exceptions = mergeDetectedFinanceExceptions(detectedExceptions, persistedExceptions);
    const openExceptions = exceptions.filter(isOpenFinanceException);
    const missingReceiptExceptionCount = openExceptions.filter(exception => exception.type === 'transaction_without_receipt').length;
    const missingReceipts = transactions.filter(transaction =>
      transaction.direction === 'out' &&
      transaction.transactionState !== 'proposed' &&
      transaction.receiptIds.length === 0
    ).length;
    const pendingReceiptReviews = receipts.filter(receipt => receipt.reviewState !== 'reviewed' && receipt.status !== 'rejected').length;
    const pendingTransactionReviews = transactions.filter(transaction =>
      transaction.transactionState === 'proposed' ||
      transaction.transactionState === 'disputed' ||
      transaction.reviewState !== 'reviewed'
    ).length;
    const pendingReviews = pendingReceiptReviews + pendingTransactionReviews;
    const balance = recalculateBalanceChain(account, transactions).at(-1)?.balanceAfter ?? account.openingBalance;
    const lowBalance = typeof account.lowBalanceThreshold === 'number' && balance <= account.lowBalanceThreshold;
    const state: FinanceOversightRow['state'] = openExceptions.some(exception => exception.severity === 'urgent')
      ? 'urgent'
      : openExceptions.length || pendingReviews || missingReceipts || lowBalance
        ? 'review'
        : 'clear';
    const blockedReasons = [
      ...openExceptions.slice(0, 4).map(exception => exception.message),
      ...(pendingReviews ? [`${pendingReviews} finance record${pendingReviews === 1 ? '' : 's'} need review.`] : []),
      ...(missingReceipts ? [`${missingReceipts} transaction${missingReceipts === 1 ? '' : 's'} have no linked receipt evidence.`] : []),
      ...(lowBalance ? ['Account balance is at or below the configured low-balance threshold.'] : []),
    ];
    const nextAction = openExceptions.some(exception => exception.severity === 'urgent')
      ? 'Review urgent finance exception'
      : missingReceiptExceptionCount
        ? 'Review missing receipt evidence'
        : openExceptions.length
          ? 'Review finance exceptions'
          : pendingReviews
            ? 'Review pending client money records'
            : lowBalance
              ? 'Review allowance or top-up need'
              : 'No finance review action';

    return {
      accountId: account.id,
      personId: account.personId,
      personName: account.personName,
      house: account.house,
      service: account.service,
      accountLabel: account.label,
      balance: roundMoney(balance),
      missingReceipts,
      openExceptions: openExceptions.length,
      pendingReviews,
      lowBalance,
      blockedReasons,
      nextAction,
      state,
    };
  });

  return {
    rows,
    totals: {
      accounts: rows.length,
      missingReceipts: rows.reduce((sum, row) => sum + row.missingReceipts, 0),
      openExceptions: rows.reduce((sum, row) => sum + row.openExceptions, 0),
      pendingReviews: rows.reduce((sum, row) => sum + row.pendingReviews, 0),
      lowBalance: rows.filter(row => row.lowBalance).length,
      urgentRows: rows.filter(row => row.state === 'urgent').length,
    },
  };
}

export function buildFinanceWidgets(input: {
  accounts: ClientMoneyAccount[];
  receipts: ReceiptEvidence[];
  transactions: FinancialTransaction[];
  exceptions: FinancialException[];
}): FinanceWidget[] {
  const detected = input.accounts.flatMap(account => mergeDetectedFinanceExceptions(
    detectFinancialExceptions({
      account,
      receipts: input.receipts.filter(receipt => receipt.accountId === account.id),
      transactions: input.transactions.filter(transaction => transaction.accountId === account.id),
    }),
    input.exceptions.filter(exception => exception.accountId === account.id),
  ));
  const openDetected = detected.filter(isOpenFinanceException);
  const missingReceipts = detected.filter(item => item.type === 'transaction_without_receipt').length;
  const lowBalances = detected.filter(item => item.type === 'low_balance').length;
  const pendingApprovals = input.transactions.filter(item => item.transactionState === 'confirmed' && item.reviewState !== 'reviewed').length;
  const unreconciledWithdrawals = input.transactions.filter(item =>
    item.category === 'cash_withdrawal' && item.transactionState !== 'reconciled'
  ).length;
  const urgent = openDetected.some(item => item.severity === 'urgent');

  return [
    { id: 'missing-receipts', label: 'Missing receipts', count: missingReceipts, state: missingReceipts ? 'review' : 'clear' },
    { id: 'unreconciled-withdrawals', label: 'Unreconciled withdrawals', count: unreconciledWithdrawals, state: unreconciledWithdrawals ? 'review' : 'clear' },
    { id: 'pending-approvals', label: 'Pending approvals', count: pendingApprovals, state: pendingApprovals ? 'review' : 'clear' },
    { id: 'low-balance', label: 'Low balance', count: lowBalances, state: lowBalances ? 'review' : 'clear' },
    { id: 'monthly-reconciliation', label: 'Monthly reconciliation', count: input.accounts.length, state: input.accounts.length ? 'review' : 'clear' },
    { id: 'exception-count', label: 'Exception count', count: openDetected.length, state: urgent ? 'urgent' : openDetected.length ? 'review' : 'clear' },
  ];
}

export function createReconciliationSession(input: {
  account: ClientMoneyAccount;
  transactions: FinancialTransaction[];
  expectedBalance: number;
  openedBy: string;
  openedAt?: string;
}): ReconciliationSession {
  const openedAt = input.openedAt || new Date().toISOString();
  const calculatedBalance = recalculateBalanceChain(input.account, input.transactions).at(-1)?.balanceAfter ?? input.account.openingBalance;
  const discrepancy = roundMoney(input.expectedBalance - calculatedBalance);
  const status: ReconciliationSession['status'] = Math.abs(discrepancy) > 0.009 ? 'discrepancy_found' : 'resolved';
  logAuditAction('finance_reconciliation_opened', `Opened reconciliation for ${input.account.personName}.`, {
    accountId: input.account.id,
    expectedBalance: input.expectedBalance,
    calculatedBalance,
    discrepancy,
  });
  return {
    id: id('finance-reconciliation'),
    accountId: input.account.id,
    openedAt,
    openedBy: input.openedBy,
    status,
    expectedBalance: roundMoney(input.expectedBalance),
    calculatedBalance,
    discrepancy,
    exceptionIds: [],
  };
}

export function approveReconciliationSession(
  session: ReconciliationSession,
  input: ReconciliationApprovalInput,
): ReconciliationApprovalResult {
  const openExceptions = (input.exceptions || []).filter(exception =>
    exception.status !== 'resolved' && exception.status !== 'deferred'
  );
  if (Math.abs(session.discrepancy) > 0.009 || session.status === 'discrepancy_found' || openExceptions.length > 0) {
    throw new Error('Cannot approve reconciliation while discrepancies or open exceptions remain.');
  }

  const reviewedAt = input.reviewedAt || new Date().toISOString();
  const sessionNote = input.reviewNote || 'Reconciliation approved after counted balance matched calculated evidence.';
  const approvedSession: ReconciliationSession = {
    ...session,
    status: 'approved',
    reviewedBy: input.reviewedBy,
    reviewedAt,
  };
  const transactions = (input.transactions || []).map(transaction => {
    if (transaction.transactionState === 'proposed' || transaction.transactionState === 'disputed') return transaction;
    return {
      ...transaction,
      reviewState: 'reviewed' as const,
      transactionState: 'reconciled' as const,
      reviewer: input.reviewedBy,
      activity: [
        event({
          at: reviewedAt,
          by: input.reviewedBy,
          action: 'reviewer_approved',
          reason: sessionNote,
        }),
        ...transaction.activity,
      ],
    };
  });

  logAuditAction('finance_reconciliation_completed', 'Approved client money reconciliation session.', {
    reconciliationId: session.id,
    accountId: session.accountId,
    reviewedBy: input.reviewedBy,
    transactionCount: transactions.length,
  });

  return { session: approvedSession, transactions };
}

export function buildFinanceAuditPack(input: FinanceAuditPackInput): FinanceAuditPack {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const chain = recalculateBalanceChain(input.account, input.transactions);
  const latestBalance = chain.at(-1)?.balanceAfter ?? input.account.openingBalance;
  const sortedTransactions = input.transactions
    .slice()
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
  const sortedReceipts = input.receipts
    .slice()
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt) || a.id.localeCompare(b.id));
  const sortedReconciliations = input.reconciliations
    .slice()
    .sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt) || a.id.localeCompare(b.id));
  const openExceptions = input.exceptions.filter(exception =>
    exception.status !== 'resolved' && exception.status !== 'deferred'
  );

  const transactionLines = sortedTransactions.length
    ? sortedTransactions.map(transaction => {
      const row = chain.find(item => item.transactionId === transaction.id);
      return [
        transaction.occurredAt,
        transaction.direction.toUpperCase(),
        money(transaction.amount),
        transaction.merchant || 'Unknown merchant',
        transaction.supportPurpose,
        `state=${transaction.transactionState}`,
        `review=${transaction.reviewState}`,
        `balance=${money(row?.balanceAfter ?? transaction.calculatedBalance)}`,
        `receipts=${transaction.receiptIds.length ? transaction.receiptIds.join(', ') : 'missing'}`,
      ].join(' | ');
    })
    : ['No confirmed transactions recorded.'];

  const receiptLines = sortedReceipts.length
    ? sortedReceipts.map(receipt => [
      receipt.id,
      receipt.sourceName,
      receipt.status,
      money(receipt.total),
      receipt.merchant || 'Unknown merchant',
      `confidence=${Math.round(receipt.confidence * 100)}%`,
      `linked=${receipt.linkedTransactionId || 'not linked'}`,
      `review=${receipt.reviewState}`,
    ].join(' | '))
    : ['No receipt evidence attached.'];

  const reconciliationLines = sortedReconciliations.length
    ? sortedReconciliations.map(reconciliation => [
      reconciliation.openedAt,
      reconciliation.status,
      `expected=${money(reconciliation.expectedBalance)}`,
      `calculated=${money(reconciliation.calculatedBalance)}`,
      `difference=${money(reconciliation.discrepancy)}`,
      `reviewedBy=${reconciliation.reviewedBy || 'not reviewed'}`,
    ].join(' | '))
    : ['No reconciliation sessions recorded.'];

  const exceptionLines = openExceptions.length
    ? openExceptions.map(exception => `${exception.type} | ${exception.status} | ${exception.severity} | ${exception.message}`)
    : ['No open exceptions detected.'];

  const text = [
    'CLIENT MONEY & FINANCIAL SAFEGUARDING PACK',
    `Generated: ${new Date(generatedAt).toLocaleString('en-GB')}`,
    `Person: ${input.account.personName}`,
    `Account: ${input.account.label}`,
    `House: ${input.account.house}`,
    '',
    'BALANCE',
    `Opening balance: ${money(input.account.openingBalance)}`,
    `Calculated balance: ${money(latestBalance)}`,
    '',
    'SOURCE EVIDENCE',
    ...receiptLines,
    '',
    'TRANSACTIONS',
    ...transactionLines,
    '',
    'RECONCILIATION',
    ...reconciliationLines,
    '',
    'EXCEPTIONS',
    ...exceptionLines,
  ].join('\n');

  logAuditAction('finance_export_generated', 'Built client money financial safeguarding audit pack.', {
    accountId: input.account.id,
    transactionCount: input.transactions.length,
    receiptCount: input.receipts.length,
    exceptionCount: openExceptions.length,
  });

  return {
    fileName: `client-money-audit-pack-${slug(input.account.personName)}-${Date.parse(generatedAt) || Date.now()}.txt`,
    text,
    generatedAt,
  };
}
