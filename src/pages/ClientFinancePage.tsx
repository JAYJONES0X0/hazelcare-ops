import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSearch,
  Link2,
  Receipt,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { loadClients } from '../lib/client-store';
import { logAuditAction } from '../lib/audit';
import {
  assignFinancialException,
  auditLegacyBalanceChain,
  approveReconciliationSession,
  approveReceiptLedgerMatch,
  buildFinanceWidgets,
  buildFinanceAuditPack,
  buildLegacyFinanceImportSummary,
  captureReceiptBatchEvidence,
  captureReceiptEvidence,
  confirmFinancialTransaction,
  createManualFinancialTransaction,
  createReviewedTransactionCorrection,
  createReconciliationSession,
  detectFinancialExceptions,
  loadFinanceState,
  matchReceiptsToLedgerRows,
  parseLegacyLedgerText,
  proposeTransactionFromReceipt,
  recalculateBalanceChain,
  rejectReceiptLedgerMatch,
  resolveFinancialException,
  saveFinanceState,
  type ClientMoneyAccount,
  type FinancialException,
  type FinanceState,
  type FinancialTransaction,
  type ReceiptEvidence,
  type ReconciliationSession,
} from '../lib/client-finance';

function money(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'GBP 0.00';
  return `GBP ${value.toFixed(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function accountId() {
  return `finance-account-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function Pill({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'purple' }) {
  const color = {
    neutral: 'border-hc-border/30 text-hc-muted',
    green: 'border-hc-green/30 text-hc-green bg-hc-green/5',
    amber: 'border-hc-amber/30 text-hc-amber bg-hc-amber/5',
    red: 'border-flag-red/30 text-flag-red bg-flag-red/5',
    purple: 'border-purple-500/30 text-purple-700 bg-purple-500/5',
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${color}`}>{children}</span>;
}

export function ClientFinancePage() {
  const clients = useMemo(() => loadClients(), []);
  const [state, setState] = useState<FinanceState>(() => loadFinanceState());
  const [selectedAccountId, setSelectedAccountId] = useState(() => loadFinanceState().accounts[0]?.id || '');
  const [personName, setPersonName] = useState(clients[0]?.name || '');
  const [openingBalance, setOpeningBalance] = useState('50.00');
  const [receiptText, setReceiptText] = useState('TESCO EXPRESS 04/07/2026 10:30 TOTAL GBP 12.40 CASH REF TX-123');
  const [receiptName, setReceiptName] = useState('receipt.jpg');
  const [batchReceiptText, setBatchReceiptText] = useState(`TESCO EXPRESS
04/07/2026 10:30
TOTAL GBP 12.40
CASH REF TX-123

COMMUNITY CAFE
05/07/2026 12:15
TOTAL GBP 5.00
CARD REF CF-77`);
  const [supportPurpose, setSupportPurpose] = useState('Weekly food shopping');
  const [staffName, setStaffName] = useState('Current staff member');
  const [pendingTransaction, setPendingTransaction] = useState<FinancialTransaction | null>(null);
  const [expectedBalance, setExpectedBalance] = useState('');
  const [legacyLedgerText, setLegacyLedgerText] = useState(`04/07/2026 Weekly food shopping OUT 12.40 BAL 37.60 LM
05/07/2026 D/A OUT 5.00 BAL 32.60
06/07/2026 Cash allowance IN 20.00 BAL 52.60 SB`);
  const [correctionTarget, setCorrectionTarget] = useState<FinancialTransaction | null>(null);
  const [correctionAmount, setCorrectionAmount] = useState('');
  const [correctionReason, setCorrectionReason] = useState('Reviewed correction event created for client money ledger.');
  const [exceptionResolutionReason, setExceptionResolutionReason] = useState('Reviewed against client money evidence and recorded as resolved.');
  const [manualAmount, setManualAmount] = useState('5.00');
  const [manualMerchant, setManualMerchant] = useState('');
  const [manualPurpose, setManualPurpose] = useState('Client spending support awaiting receipt evidence.');
  const [manualCategory, setManualCategory] = useState('client_spending');
  const [manualDirection, setManualDirection] = useState<FinancialTransaction['direction']>('out');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<ReceiptEvidence['paymentMethod']>('cash');

  const selectedAccount = state.accounts.find(account => account.id === selectedAccountId) || state.accounts[0] || null;
  const accountReceipts = selectedAccount ? state.receipts.filter(receipt => receipt.accountId === selectedAccount.id) : [];
  const accountTransactions = selectedAccount ? state.transactions.filter(transaction => transaction.accountId === selectedAccount.id) : [];
  const latestReceiptBatch = selectedAccount
    ? state.receiptBatches.find(batch => batch.accountId === selectedAccount.id) || null
    : null;
  const latestLegacyImport = selectedAccount
    ? state.legacyImports.find(item => item.accountId === selectedAccount.id) || null
    : null;
  const legacyMatchProposals = latestLegacyImport ? matchReceiptsToLedgerRows(accountReceipts, latestLegacyImport.rows) : [];
  const legacyBalanceIssues = selectedAccount && latestLegacyImport ? auditLegacyBalanceChain(selectedAccount, latestLegacyImport.rows) : [];
  const legacySummary = latestLegacyImport
    ? buildLegacyFinanceImportSummary({
      importResult: latestLegacyImport,
      receipts: accountReceipts,
      matchProposals: legacyMatchProposals,
      balanceIssues: legacyBalanceIssues,
    })
    : null;
  const detectedExceptions = selectedAccount
    ? detectFinancialExceptions({ account: selectedAccount, receipts: accountReceipts, transactions: accountTransactions })
    : [];
  const exceptionOverrides = new Map(state.exceptionLog.map(exception => [exception.id, exception]));
  const reviewExceptions = detectedExceptions.map(exception => exceptionOverrides.get(exception.id) || exception);
  const openExceptions = reviewExceptions.filter(exception =>
    exception.status !== 'resolved' && exception.status !== 'deferred'
  );
  const widgets = buildFinanceWidgets({
    accounts: selectedAccount ? [selectedAccount] : state.accounts,
    receipts: state.receipts,
    transactions: state.transactions,
    exceptions: reviewExceptions,
  });
  const balanceChain = selectedAccount ? recalculateBalanceChain(selectedAccount, accountTransactions) : [];
  const latestBalance = balanceChain.at(-1)?.balanceAfter ?? selectedAccount?.openingBalance ?? 0;

  function commit(next: FinanceState) {
    setState(next);
    saveFinanceState(next);
  }

  function createAccount() {
    const trimmedName = personName.trim() || clients[0]?.name || 'Draft client';
    const client = clients.find(item => item.name.toLowerCase() === trimmedName.toLowerCase()) || clients[0];
    const account: ClientMoneyAccount = {
      id: accountId(),
      personId: client?.id || `person-${trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      personName: trimmedName,
      house: 'Unassigned service',
      label: `${trimmedName} personal money`,
      type: 'cash',
      openingBalance: Number(openingBalance) || 0,
      openingBalanceAt: nowIso(),
      currency: 'GBP',
      lowBalanceThreshold: 10,
      reviewState: 'unreviewed',
      createdAt: nowIso(),
    };
    commit({ ...state, accounts: [account, ...state.accounts] });
    setSelectedAccountId(account.id);
  }

  function captureReceipt() {
    if (!selectedAccount) return;
    const receipt = captureReceiptEvidence({
      sourceName: receiptName || 'receipt.jpg',
      text: receiptText,
      capturedBy: staffName || 'Current staff member',
      capturedAt: nowIso(),
      personId: selectedAccount.personId,
      house: selectedAccount.house,
      accountId: selectedAccount.id,
    });
    const proposed = typeof receipt.total === 'number'
      ? proposeTransactionFromReceipt(selectedAccount, receipt, {
        supportPurpose: supportPurpose || 'Client spending support',
        staffName: staffName || 'Current staff member',
        at: nowIso(),
      })
      : null;
    commit({ ...state, receipts: [receipt, ...state.receipts] });
    setPendingTransaction(proposed);
  }

  function captureReceiptBatch() {
    if (!selectedAccount) return;
    const batch = captureReceiptBatchEvidence({
      sourceName: 'receipt-batch-ocr.txt',
      text: batchReceiptText,
      capturedBy: staffName || 'Current staff member',
      capturedAt: nowIso(),
      personId: selectedAccount.personId,
      house: selectedAccount.house,
      accountId: selectedAccount.id,
    });
    commit({
      ...state,
      receipts: [...batch.receipts, ...state.receipts],
      receiptBatches: [batch, ...state.receiptBatches],
    });
  }

  function handleReceiptFile(file: File | null) {
    if (!file) return;
    setReceiptName(file.name);
    if (file.type.startsWith('text/') || /\.(csv|txt|vtt)$/i.test(file.name)) {
      file.text().then(setReceiptText).catch(() => undefined);
    } else {
      setReceiptText('');
    }
  }

  function confirmPending() {
    if (!selectedAccount || !pendingTransaction) return;
    const confirmed = confirmFinancialTransaction(selectedAccount, accountTransactions, pendingTransaction, {
      by: staffName || 'Current staff member',
      statement: 'Receipt, person, account and support purpose checked before posting.',
      at: nowIso(),
    });
    const receipts = state.receipts.map(receipt =>
      pendingTransaction.receiptIds.includes(receipt.id)
        ? { ...receipt, linkedTransactionId: confirmed.id, status: 'matched' as const }
        : receipt
    );
    commit({
      ...state,
      receipts,
      transactions: [confirmed, ...state.transactions],
    });
    setPendingTransaction(null);
  }

  function createManualTransaction() {
    if (!selectedAccount) return;
    try {
      const transaction = createManualFinancialTransaction(selectedAccount, accountTransactions, {
        occurredAt: nowIso(),
        direction: manualDirection,
        amount: Number(manualAmount),
        merchant: manualMerchant,
        category: manualCategory,
        supportPurpose: manualPurpose,
        paymentMethod: manualPaymentMethod,
        by: staffName || 'Current staff member',
        statement: manualDirection === 'out'
          ? 'Manual transaction entered; receipt evidence still required or explicitly deferred by review.'
          : 'Manual money received entry recorded with staff attestation.',
      });
      commit({ ...state, transactions: [transaction, ...state.transactions] });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Manual transaction could not be recorded.');
    }
  }

  function parseLegacyLedger() {
    if (!selectedAccount) return;
    const imported = parseLegacyLedgerText(selectedAccount, {
      sourceName: 'legacy-ledger-ocr.txt',
      text: legacyLedgerText,
      importedBy: staffName || 'Current staff member',
      importedAt: nowIso(),
    });
    commit({
      ...state,
      legacyImports: [imported, ...state.legacyImports],
    });
  }

  function acceptLedgerMatch(proposal: typeof legacyMatchProposals[number]) {
    if (!selectedAccount || !latestLegacyImport) return;
    const receipt = state.receipts.find(item => item.id === proposal.receiptId);
    const ledgerRow = latestLegacyImport.rows.find(row => row.id === proposal.ledgerRowId);
    if (!receipt || !ledgerRow) return;
    const approved = approveReceiptLedgerMatch(selectedAccount, proposal, receipt, ledgerRow, {
      reviewedBy: staffName || 'Current staff member',
      reviewedAt: nowIso(),
      reviewNote: 'Receipt and ledger row accepted as describing the same client money event.',
    });
    commit({
      ...state,
      receipts: state.receipts.map(item => item.id === approved.receipt.id ? approved.receipt : item),
      legacyImports: state.legacyImports.map(importItem =>
        importItem.id === latestLegacyImport.id
          ? { ...importItem, rows: importItem.rows.map(row => row.id === approved.ledgerRow.id ? approved.ledgerRow : row) }
          : importItem
      ),
    });
    setPendingTransaction(approved.transaction);
  }

  function rejectLedgerMatch(proposal: typeof legacyMatchProposals[number]) {
    if (!latestLegacyImport) return;
    const receipt = state.receipts.find(item => item.id === proposal.receiptId);
    const ledgerRow = latestLegacyImport.rows.find(row => row.id === proposal.ledgerRowId);
    if (!receipt || !ledgerRow) return;
    const rejected = rejectReceiptLedgerMatch(proposal, receipt, ledgerRow, {
      reviewedBy: staffName || 'Current staff member',
      reviewedAt: nowIso(),
      reason: 'Reviewer rejected this receipt-ledger match.',
    });
    commit({
      ...state,
      receipts: state.receipts.map(item => item.id === rejected.receipt.id ? rejected.receipt : item),
      legacyImports: state.legacyImports.map(importItem =>
        importItem.id === latestLegacyImport.id
          ? { ...importItem, rows: importItem.rows.map(row => row.id === rejected.ledgerRow.id ? rejected.ledgerRow : row) }
          : importItem
      ),
    });
  }

  function runReconciliation() {
    if (!selectedAccount) return;
    const expected = expectedBalance ? Number(expectedBalance) : latestBalance;
    const reconciliation = createReconciliationSession({
      account: selectedAccount,
      transactions: accountTransactions,
      expectedBalance: expected,
      openedBy: staffName || 'Current staff member',
      openedAt: nowIso(),
    });
    commit({ ...state, reconciliations: [reconciliation, ...state.reconciliations] });
  }

  function approveReconciliation(item: ReconciliationSession) {
    try {
      const approved = approveReconciliationSession(item, {
        transactions: accountTransactions,
        exceptions: openExceptions,
        reviewedBy: staffName || 'Current staff member',
        reviewedAt: nowIso(),
      });
      const approvedById = new Map(approved.transactions.map(transaction => [transaction.id, transaction]));
      commit({
        ...state,
        transactions: state.transactions.map(transaction => approvedById.get(transaction.id) || transaction),
        reconciliations: state.reconciliations.map(reconciliation =>
          reconciliation.id === approved.session.id ? approved.session : reconciliation
        ),
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Reconciliation approval is blocked.');
    }
  }

  function upsertExceptionLog(exception: FinancialException) {
    setState(previous => {
      const next = {
        ...previous,
        exceptionLog: [
          exception,
          ...previous.exceptionLog.filter(item => item.id !== exception.id),
        ],
      };
      saveFinanceState(next);
      return next;
    });
  }

  function assignException(exception: FinancialException) {
    try {
      upsertExceptionLog(assignFinancialException(exception, {
        assignedTo: staffName || 'Current staff member',
        assignedBy: staffName || 'Current staff member',
        assignedAt: nowIso(),
        note: 'Accepted for client money review.',
      }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Exception could not be assigned.');
    }
  }

  function closeException(exception: FinancialException, outcome: 'resolved' | 'deferred' = 'resolved') {
    try {
      upsertExceptionLog(resolveFinancialException(exception, {
        resolvedBy: staffName || 'Current staff member',
        resolvedAt: nowIso(),
        outcome,
        reason: exceptionResolutionReason || 'Reviewed against client money evidence.',
      }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Exception could not be closed.');
    }
  }

  function openCorrection(transaction: FinancialTransaction) {
    setCorrectionTarget(transaction);
    setCorrectionAmount(transaction.amount.toFixed(2));
    setCorrectionReason('Reviewed correction event created for client money ledger.');
  }

  function submitCorrection() {
    if (!selectedAccount || !correctionTarget) return;
    const correctedAmount = Number(correctionAmount);
    try {
      const corrected = createReviewedTransactionCorrection(selectedAccount, accountTransactions, correctionTarget, {
        correctedAmount,
        correctedSupportPurpose: correctionTarget.supportPurpose,
        by: staffName || 'Current staff member',
        reason: correctionReason,
        at: nowIso(),
      });
      commit({
        ...state,
        transactions: [
          corrected.correction,
          corrected.original,
          ...state.transactions.filter(item => item.id !== correctionTarget.id),
        ],
      });
      setCorrectionTarget(null);
      setCorrectionAmount('');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Correction could not be created.');
    }
  }

  function createCorrection(transaction: FinancialTransaction) {
    if (!selectedAccount) return;
    openCorrection(transaction);
  }

  function exportAuditPack() {
    if (!selectedAccount) return;
    const pack = buildFinanceAuditPack({
      account: selectedAccount,
      transactions: accountTransactions,
      receipts: accountReceipts,
      exceptions: reviewExceptions,
      reconciliations: state.reconciliations.filter(item => item.accountId === selectedAccount.id),
    });
    const blob = new Blob([pack.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = pack.fileName;
    link.click();
    URL.revokeObjectURL(url);
    logAuditAction('finance_export_generated', 'Client money financial safeguarding audit pack downloaded.', {
      accountId: selectedAccount.id,
      fileName: pack.fileName,
    });
  }

  return (
    <div className="px-4 sm:px-8 lg:px-12 py-8 max-w-[1800px] mx-auto space-y-8 text-hc-text">
      <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 border-b border-hc-border/20 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full hc-clay-inset px-3 py-1 text-[9px] font-black uppercase tracking-widest text-hc-teal">
            <ShieldCheck size={13} /> Client Money & Financial Safeguarding
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black uppercase tracking-[0.16em] text-hc-text leading-tight">
            Money Safeguarding
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold text-hc-muted leading-relaxed">
            Controlled evidence ledger for receipts, spending, balances, reconciliation, and review. CareOps records and evidences client money activity; it does not hold funds, move funds, or approve transactions automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Accounts', 'Transactions', 'Receipt Inbox', 'Allowances', 'Reconciliation', 'Exceptions', 'Audit Packs'].map(surface => (
            <Pill key={surface} tone={surface === 'Exceptions' && openExceptions.length ? 'red' : 'neutral'}>{surface}</Pill>
          ))}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {widgets.map(widget => (
          <div key={widget.id} className="hc-clay-raised p-5 rounded-2xl min-h-[112px]">
            <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">{widget.label}</div>
            <div className={`mt-4 text-3xl font-black ${widget.state === 'urgent' ? 'text-flag-red' : widget.state === 'review' ? 'text-hc-amber' : 'text-hc-teal'}`}>{widget.count}</div>
            <div className="mt-2">
              <Pill tone={widget.state === 'urgent' ? 'red' : widget.state === 'review' ? 'amber' : 'green'}>
                {widget.state === 'clear' ? 'Clear' : 'Review'}
              </Pill>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="hc-clay-raised p-6 rounded-3xl space-y-5">
          <div className="flex items-center gap-3">
            <WalletCards className="text-hc-teal" size={20} />
            <div>
              <h2 className="text-lg font-black uppercase tracking-widest">Account Control</h2>
              <p className="text-xs font-semibold text-hc-muted">Select the person and cash/card account before capturing evidence.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Person</span>
              <input className="w-full hc-clay-inset px-4 py-3 text-sm font-bold" value={personName} onChange={e => setPersonName(e.target.value)} placeholder="Person name" />
            </label>
            <label className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Opening balance</span>
              <input className="w-full hc-clay-inset px-4 py-3 text-sm font-bold" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="50.00" />
            </label>
          </div>
          <button onClick={createAccount} className="btn-tactical px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-hc-bg">
            Create client money account
          </button>

          {state.accounts.length > 0 && (
            <div className="space-y-3">
              <label className="space-y-2 block">
                <span className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Active account</span>
                <select className="w-full hc-clay-inset px-4 py-3 text-sm font-black bg-transparent" value={selectedAccount?.id || ''} onChange={e => setSelectedAccountId(e.target.value)}>
                  {state.accounts.map(item => (
                    <option key={item.id} value={item.id}>{item.personName} - {item.label}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="hc-clay-inset p-4 rounded-2xl">
                  <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Opening</div>
                  <div className="mt-2 text-xl font-black">{money(selectedAccount?.openingBalance)}</div>
                </div>
                <div className="hc-clay-inset p-4 rounded-2xl">
                  <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Calculated</div>
                  <div className="mt-2 text-xl font-black text-hc-teal">{money(latestBalance)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="hc-clay-raised p-6 rounded-3xl space-y-5">
          <div className="flex items-center gap-3">
            <Camera className="text-hc-teal" size={20} />
            <div>
              <h2 className="text-lg font-black uppercase tracking-widest">Receipt Inbox</h2>
              <p className="text-xs font-semibold text-hc-muted">Capture text or a file. Low-confidence evidence stays in review.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="hc-clay-inset px-4 py-3 text-sm font-bold" value={receiptName} onChange={e => setReceiptName(e.target.value)} placeholder="receipt.jpg" />
            <input className="hc-clay-inset px-4 py-3 text-sm font-bold" type="file" accept="image/*,.txt,.csv,.pdf" onChange={e => handleReceiptFile(e.target.files?.[0] || null)} />
          </div>
          <textarea className="w-full min-h-32 hc-clay-inset px-4 py-3 text-sm font-semibold leading-relaxed" value={receiptText} onChange={e => setReceiptText(e.target.value)} placeholder="Paste receipt text or upload a receipt image/file." />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="hc-clay-inset px-4 py-3 text-sm font-bold" value={supportPurpose} onChange={e => setSupportPurpose(e.target.value)} placeholder="Support purpose" />
            <input className="hc-clay-inset px-4 py-3 text-sm font-bold" value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="Staff attesting" />
          </div>
          <button disabled={!selectedAccount} onClick={captureReceipt} className="btn-tactical disabled:opacity-40 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-hc-bg">
            Capture receipt evidence
          </button>

          <div className="border-t border-hc-border/20 pt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Batch Receipt Intake</h3>
                <p className="mt-1 text-xs font-semibold text-hc-muted">Paste OCR from a receipt pile. Blank lines split receipts; weak or duplicate blocks stay review-visible.</p>
              </div>
              {latestReceiptBatch && (
                <div className="flex flex-wrap gap-2">
                  <Pill tone="neutral">{`${latestReceiptBatch.receiptsCaptured} captured`}</Pill>
                  <Pill tone={latestReceiptBatch.receiptsNeedReview ? 'amber' : 'green'}>{`${latestReceiptBatch.receiptsNeedReview} review`}</Pill>
                  <Pill tone={latestReceiptBatch.duplicateCandidateCount ? 'red' : 'green'}>{`${latestReceiptBatch.duplicateCandidateCount} duplicates`}</Pill>
                </div>
              )}
            </div>
            <textarea
              className="w-full min-h-32 hc-clay-inset px-4 py-3 text-sm font-semibold leading-relaxed"
              value={batchReceiptText}
              onChange={e => setBatchReceiptText(e.target.value)}
              placeholder="Paste multiple receipt OCR blocks here..."
            />
            <button disabled={!selectedAccount} onClick={captureReceiptBatch} className="hc-clay-raised disabled:opacity-40 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">
              Capture batch receipts
            </button>
          </div>
        </div>
      </section>

      {pendingTransaction && (
        <section className="hc-clay-raised p-6 rounded-3xl border border-hc-amber/20">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex items-center gap-2 text-hc-amber">
                <Receipt size={18} />
                <h2 className="text-lg font-black uppercase tracking-widest">Proposed Transaction</h2>
              </div>
              <p className="text-sm font-semibold text-hc-muted">
                This is not posted yet. Confirm person, account, receipt evidence, and support context before CareOps recalculates the balance.
              </p>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="hc-clay-inset p-4 rounded-2xl"><div className="text-[9px] font-black uppercase text-hc-muted">Merchant</div><div className="font-black">{pendingTransaction.merchant || 'Unknown'}</div></div>
                <div className="hc-clay-inset p-4 rounded-2xl"><div className="text-[9px] font-black uppercase text-hc-muted">Amount</div><div className="font-black">{money(pendingTransaction.amount)}</div></div>
                <div className="hc-clay-inset p-4 rounded-2xl"><div className="text-[9px] font-black uppercase text-hc-muted">State</div><div className="font-black uppercase">{pendingTransaction.transactionState}</div></div>
                <div className="hc-clay-inset p-4 rounded-2xl"><div className="text-[9px] font-black uppercase text-hc-muted">Balance impact</div><div className="font-black">Not posted</div></div>
              </div>
            </div>
            <button onClick={confirmPending} className="btn-tactical px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-hc-bg shrink-0">
              Confirm and post
            </button>
          </div>
        </section>
      )}

      <section className="hc-clay-raised p-6 rounded-3xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="flex items-start gap-3">
            <ClipboardList className="text-hc-teal mt-1" size={21} />
            <div>
              <h2 className="text-lg font-black uppercase tracking-widest">Legacy Ledger Bridge</h2>
              <p className="mt-2 max-w-4xl text-sm font-semibold text-hc-muted leading-relaxed">
                Paste OCR or typed rows from a paper money sheet. CareOps creates reviewable ledger evidence, proposes receipt matches, and audits the balance chain. It does not post imported rows as trusted transactions.
              </p>
            </div>
          </div>
          {legacySummary && (
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral">{`${legacySummary.rowsImported} rows`}</Pill>
              <Pill tone={legacySummary.rowsNeedReview ? 'amber' : 'green'}>{`${legacySummary.rowsNeedReview} need review`}</Pill>
              <Pill tone={legacySummary.receiptMatches ? 'green' : 'neutral'}>{`${legacySummary.receiptMatches} receipt matches`}</Pill>
              <Pill tone={legacySummary.balanceIssues ? 'red' : 'green'}>{`${legacySummary.balanceIssues} balance issues`}</Pill>
            </div>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <textarea
              className="w-full min-h-48 hc-clay-inset px-4 py-3 text-sm font-semibold leading-relaxed"
              value={legacyLedgerText}
              onChange={e => setLegacyLedgerText(e.target.value)}
              placeholder="Paste paper ledger OCR or typed rows here..."
            />
            <button disabled={!selectedAccount} onClick={parseLegacyLedger} className="btn-tactical disabled:opacity-40 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-hc-bg">
              Parse ledger evidence
            </button>
          </div>

          <div className="space-y-3">
            {!latestLegacyImport && (
              <div className="hc-clay-inset p-5 rounded-2xl text-sm font-bold text-hc-muted">
                No legacy ledger evidence parsed for this account yet.
              </div>
            )}
            {latestLegacyImport && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="hc-clay-inset p-4 rounded-2xl">
                    <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Source</div>
                    <div className="mt-2 text-sm font-black break-words">{latestLegacyImport.sourceName}</div>
                  </div>
                  <div className="hc-clay-inset p-4 rounded-2xl">
                    <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Unmatched receipts</div>
                    <div className="mt-2 text-xl font-black text-hc-amber">{legacySummary?.unmatchedReceipts ?? 0}</div>
                  </div>
                  <div className="hc-clay-inset p-4 rounded-2xl">
                    <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Unmatched rows</div>
                    <div className="mt-2 text-xl font-black text-hc-amber">{legacySummary?.unmatchedLedgerRows ?? 0}</div>
                  </div>
                  <div className="hc-clay-inset p-4 rounded-2xl">
                    <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Balance review</div>
                    <div className="mt-2 text-xl font-black text-flag-red">{legacySummary?.balanceIssues ?? 0}</div>
                  </div>
                </div>

                <div className="max-h-[360px] overflow-y-auto pr-1 space-y-3">
                  {latestLegacyImport.rows.map(row => (
                    <div key={row.id} className="hc-clay-inset p-4 rounded-2xl">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Row {row.rowNumber}</div>
                          <div className="mt-1 font-black break-words">{row.description}</div>
                          <div className="mt-1 text-xs font-semibold text-hc-muted break-words">{row.rawText}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-black">{row.direction.toUpperCase()} {row.amount === null ? 'unknown' : money(row.amount)}</div>
                          <div className="text-xs font-black text-hc-teal">Ledger balance {row.statedBalance === null ? 'unknown' : money(row.statedBalance)}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill tone={row.reviewRequired ? 'amber' : 'green'}>{row.reviewRequired ? 'Needs review' : 'Readable draft'}</Pill>
                        <Pill tone="neutral">{`${Math.round(row.confidence * 100)}% confidence`}</Pill>
                        {row.staffInitials && <Pill tone="neutral">{`Staff ${row.staffInitials}`}</Pill>}
                      </div>
                      {row.rejectedReasons.length > 0 && (
                        <div className="mt-3 text-xs font-semibold text-hc-amber">
                          {row.rejectedReasons.join(' ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="hc-clay-inset p-4 rounded-2xl">
                    <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted">Receipt match proposals</div>
                    <div className="mt-3 space-y-2">
                      {legacyMatchProposals.length === 0 && <div className="text-xs font-semibold text-hc-muted">No receipt matches proposed yet.</div>}
                      {legacyMatchProposals.map(proposal => {
                        const row = latestLegacyImport.rows.find(item => item.id === proposal.ledgerRowId);
                        const accepted = Boolean(row?.proposedTransactionId);
                        return (
                          <div key={proposal.id} className="rounded-xl border border-hc-border/20 p-3 text-xs font-bold leading-relaxed">
                            <div>
                              Receipt {proposal.receiptId} to row {row?.rowNumber ?? '?'} - {Math.round(proposal.confidence * 100)}% - {proposal.reviewRequired ? 'review required' : 'ready for review'}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={accepted}
                                onClick={() => acceptLedgerMatch(proposal)}
                                className="btn-tactical disabled:opacity-40 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-bg"
                              >
                                {accepted ? 'Proposed' : 'Accept as proposed transaction'}
                              </button>
                              <button
                                type="button"
                                disabled={accepted}
                                onClick={() => rejectLedgerMatch(proposal)}
                                className="hc-clay-raised disabled:opacity-40 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest"
                              >
                                Reject match
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="hc-clay-inset p-4 rounded-2xl">
                    <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted">Balance chain audit</div>
                    <div className="mt-3 space-y-2">
                      {legacyBalanceIssues.length === 0 && <div className="text-xs font-semibold text-hc-muted">No arithmetic discrepancy detected in parsed rows.</div>}
                      {legacyBalanceIssues.map(issue => (
                        <div key={issue.id} className="text-xs font-bold leading-relaxed text-hc-amber">
                          Row {issue.rowNumber}: {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="hc-clay-raised p-6 rounded-3xl">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <Link2 className="text-hc-teal" size={20} />
              <h2 className="text-lg font-black uppercase tracking-widest">Transactions</h2>
            </div>
          </div>
          <div className="mb-5 hc-clay-inset p-4 rounded-2xl space-y-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">Manual Transaction Capture</h3>
              <p className="mt-1 text-xs font-semibold text-hc-muted">
                Use when money movement is known but receipt evidence is missing, delayed, or held elsewhere. The entry remains review-required.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="hc-clay-inset px-4 py-3 text-sm font-bold" value={manualMerchant} onChange={event => setManualMerchant(event.target.value)} placeholder="Payee or source, e.g. Community Cafe" />
              <input className="hc-clay-inset px-4 py-3 text-sm font-bold" value={manualAmount} onChange={event => setManualAmount(event.target.value)} placeholder="Amount" />
              <select className="hc-clay-inset px-4 py-3 text-sm font-bold" value={manualDirection} onChange={event => setManualDirection(event.target.value as FinancialTransaction['direction'])}>
                <option value="out">Money out</option>
                <option value="in">Money in</option>
              </select>
              <select className="hc-clay-inset px-4 py-3 text-sm font-bold" value={manualPaymentMethod} onChange={event => setManualPaymentMethod(event.target.value as ReceiptEvidence['paymentMethod'])}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="unknown">Unknown</option>
              </select>
              <input className="hc-clay-inset px-4 py-3 text-sm font-bold" value={manualCategory} onChange={event => setManualCategory(event.target.value)} placeholder="Category" />
              <input className="hc-clay-inset px-4 py-3 text-sm font-bold" value={manualPurpose} onChange={event => setManualPurpose(event.target.value)} placeholder="Support context" />
            </div>
            <button disabled={!selectedAccount} onClick={createManualTransaction} className="btn-tactical disabled:opacity-40 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-hc-bg">
              Record review-required transaction
            </button>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {accountTransactions.length === 0 && <div className="hc-clay-inset p-5 rounded-2xl text-sm font-bold text-hc-muted">No confirmed client money transactions yet.</div>}
            {accountTransactions.map(transaction => (
              <div key={transaction.id} className="hc-clay-inset p-4 rounded-2xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-black">{transaction.merchant || 'Unknown payee'}</div>
                    <div className="text-xs font-semibold text-hc-muted">{transaction.supportPurpose}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black">{transaction.direction === 'out' ? '-' : '+'}{money(transaction.amount)}</div>
                    <div className="text-xs font-black text-hc-teal">Balance {money(transaction.calculatedBalance)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone={transaction.receiptIds.length ? 'green' : 'red'}>{transaction.receiptIds.length ? 'Receipt linked' : 'Receipt missing'}</Pill>
                  <Pill tone={transaction.reviewState === 'reviewed' ? 'green' : 'amber'}>{transaction.reviewState.replace(/_/g, ' ')}</Pill>
                  <Pill>{transaction.transactionState}</Pill>
                </div>
                {(transaction.reviewState === 'reviewed' || transaction.transactionState === 'reconciled') && (
                  <button
                    type="button"
                    onClick={() => createCorrection(transaction)}
                    className="mt-3 hc-clay-raised rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest"
                  >
                    Open correction review
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="hc-clay-raised p-6 rounded-3xl">
          <div className="flex items-center gap-3 mb-5">
            <ClipboardList className="text-hc-teal" size={20} />
            <h2 className="text-lg font-black uppercase tracking-widest">Correction Review</h2>
          </div>
          {!correctionTarget && (
            <div className="hc-clay-inset p-5 rounded-2xl text-sm font-bold text-hc-muted">
              Select a reviewed or reconciled transaction to create a correction event. Reviewed finance records are never silently overwritten.
            </div>
          )}
          {correctionTarget && (
            <div className="space-y-4">
              <div className="hc-clay-inset p-4 rounded-2xl">
                <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">Source transaction</div>
                <div className="mt-2 font-black">{correctionTarget.merchant || 'Unknown payee'} - {money(correctionTarget.amount)}</div>
                <div className="mt-1 text-xs font-semibold text-hc-muted">{correctionTarget.supportPurpose}</div>
              </div>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-hc-muted">Corrected amount</span>
                <input className="mt-2 w-full hc-clay-inset px-4 py-3 text-sm font-bold" value={correctionAmount} onChange={event => setCorrectionAmount(event.target.value)} />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-hc-muted">Correction reason</span>
                <textarea className="mt-2 w-full hc-clay-inset px-4 py-3 text-sm font-semibold min-h-[110px]" value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={submitCorrection} className="btn-tactical rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-hc-bg">
                  Create correction event
                </button>
                <button type="button" onClick={() => setCorrectionTarget(null)} className="hc-clay-raised rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="hc-clay-raised p-6 rounded-3xl">
          <div className="flex items-center gap-3 mb-5">
            <FileSearch className="text-hc-teal" size={20} />
            <h2 className="text-lg font-black uppercase tracking-widest">Exceptions</h2>
          </div>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-hc-muted">Resolution note</span>
              <textarea className="mt-2 w-full hc-clay-inset px-4 py-3 text-xs font-semibold min-h-[88px]" value={exceptionResolutionReason} onChange={event => setExceptionResolutionReason(event.target.value)} />
            </label>
            {openExceptions.length === 0 && <div className="hc-clay-inset p-5 rounded-2xl text-sm font-bold text-hc-muted">No open financial safeguarding exceptions detected for this account.</div>}
            {openExceptions.map(exception => (
              <div key={exception.id} className="hc-clay-inset p-4 rounded-2xl border border-hc-amber/20">
                <div className="flex gap-3">
                  <AlertTriangle className={exception.severity === 'urgent' ? 'text-flag-red shrink-0' : 'text-hc-amber shrink-0'} size={18} />
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-widest text-hc-muted">{exception.type.replace(/_/g, ' ')}</div>
                    <div className="mt-1 text-sm font-semibold leading-relaxed">{exception.message}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill tone={exception.status === 'assigned' ? 'purple' : 'amber'}>{exception.status.replace(/_/g, ' ')}</Pill>
                      {exception.assignedTo && <Pill tone="purple">{`Assigned to ${exception.assignedTo}`}</Pill>}
                      <Pill>{`${exception.transactionIds.length} transactions`}</Pill>
                      <Pill>{`${exception.evidenceIds.length} evidence links`}</Pill>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {exception.status === 'raised' && (
                        <button
                          type="button"
                          onClick={() => assignException(exception)}
                          className="hc-clay-raised rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest"
                        >
                          Assign to me
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => closeException(exception, 'resolved')}
                        className="btn-tactical rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-bg"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => closeException(exception, 'deferred')}
                        className="hc-clay-raised rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest"
                      >
                        Defer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="hc-clay-raised p-6 rounded-3xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="text-hc-teal" size={20} />
              <h2 className="text-lg font-black uppercase tracking-widest">Reconciliation</h2>
            </div>
            <p className="text-sm font-semibold text-hc-muted">
              Enter the counted balance. CareOps compares it to the calculated balance and records discrepancy state without accusing anyone.
            </p>
          </div>
          <input className="hc-clay-inset px-4 py-3 text-sm font-bold" value={expectedBalance} onChange={e => setExpectedBalance(e.target.value)} placeholder={`Counted balance, e.g. ${latestBalance.toFixed(2)}`} />
          <button disabled={!selectedAccount} onClick={runReconciliation} className="btn-tactical disabled:opacity-40 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-hc-bg">
            Run reconciliation
          </button>
        </div>
        {state.reconciliations.length > 0 && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {state.reconciliations.slice(0, 6).map(item => (
              <div key={item.id} className="hc-clay-inset p-4 rounded-2xl">
                <div className="text-[9px] font-black uppercase tracking-widest text-hc-muted">{item.status.replace(/_/g, ' ')}</div>
                <div className="mt-2 text-sm font-bold">Expected {money(item.expectedBalance)} / Calculated {money(item.calculatedBalance)}</div>
                <div className={item.discrepancy ? 'text-flag-red text-xs font-black mt-2' : 'text-hc-green text-xs font-black mt-2'}>
                  Difference {money(item.discrepancy)}
                </div>
                {item.status === 'resolved' && (
                  <button
                    type="button"
                    onClick={() => approveReconciliation(item)}
                    className="mt-3 btn-tactical rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hc-bg"
                  >
                    Approve reconciliation
                  </button>
                )}
                {item.status === 'approved' && item.reviewedBy && (
                  <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-hc-green">
                    Approved by {item.reviewedBy}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="hc-clay-raised p-6 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Download className="text-hc-teal" size={20} />
            <h2 className="text-lg font-black uppercase tracking-widest">Audit Pack</h2>
          </div>
          <p className="mt-2 text-sm font-semibold text-hc-muted">Export a plain text evidence pack covering account, transactions, receipts, balances, and exceptions.</p>
        </div>
        <button disabled={!selectedAccount} onClick={exportAuditPack} className="btn-tactical disabled:opacity-40 px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-hc-bg">
          Export finance evidence pack
        </button>
      </section>
    </div>
  );
}
