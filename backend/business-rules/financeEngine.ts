// Yasoth Enterprises Scrap ERP — Finance & Accounting Rules Engine
// Enforces payment allocation limits, party ledger derivation, and contra-account integrity

import { 
  Payment, 
  Invoice, 
  PurchaseHeader, 
  AccountTransaction, 
  CashBankAccount, 
  Party 
} from '../../src/types/index.ts';
import { roundTo2 } from '../../src/utils/calculations.ts';

export interface PaymentPostingResult {
  updatedPayment: Payment;
  updatedInvoices: Invoice[];
  updatedPurchases: PurchaseHeader[];
  newAccountTransaction: AccountTransaction;
}

export function postPaymentVoucher(
  params: {
    paymentNo: string;
    paymentDate: string;
    direction: 'INFLOW_RECEIPT' | 'OUTFLOW_PAYMENT';
    party: Party;
    account: CashBankAccount;
    totalAmount: number;
    paymentMethod: Payment['paymentMethod'];
    referenceNo?: string;
    notes?: string;
    allocations: {
      invoiceId?: string;
      purchaseHeaderId?: string;
      allocatedAmount: number;
    }[];
    allInvoices: Invoice[];
    allPurchases: PurchaseHeader[];
    actor: string;
  }
): PaymentPostingResult {
  const { direction, totalAmount, allocations, allInvoices, allPurchases, actor } = params;

  if (totalAmount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const sumAllocated = roundTo2(allocations.reduce((sum, a) => sum + a.allocatedAmount, 0));
  if (sumAllocated > totalAmount) {
    throw new Error(
      `Total allocated amount (₹${sumAllocated}) cannot exceed payment amount (₹${totalAmount}).`
    );
  }

  const unallocatedAmount = roundTo2(totalAmount - sumAllocated);
  const now = new Date().toISOString();

  const updatedInvoices: Invoice[] = [];
  const updatedPurchases: PurchaseHeader[] = [];

  // Apply allocations to invoices if receipt
  if (direction === 'INFLOW_RECEIPT') {
    for (const alloc of allocations) {
      if (!alloc.invoiceId) continue;
      const inv = allInvoices.find((i) => i.id === alloc.invoiceId);
      if (!inv) throw new Error(`Invoice ${alloc.invoiceId} not found.`);

      const newPaid = roundTo2(inv.amountPaid + alloc.allocatedAmount);
      const newOutstanding = roundTo2(Math.max(0, inv.grandTotal - newPaid));
      const newStatus = newOutstanding <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

      updatedInvoices.push({
        ...inv,
        amountPaid: newPaid,
        outstandingBalance: newOutstanding,
        paymentStatus: newStatus,
      });
    }
  } else {
    // Apply allocations to purchases if payment
    for (const alloc of allocations) {
      if (!alloc.purchaseHeaderId) continue;
      const pur = allPurchases.find((p) => p.id === alloc.purchaseHeaderId);
      if (!pur) throw new Error(`Purchase ${alloc.purchaseHeaderId} not found.`);

      const newPaid = roundTo2(pur.amountPaid + alloc.allocatedAmount);
      const newOutstanding = roundTo2(Math.max(0, pur.totalAmount - newPaid));

      updatedPurchases.push({
        ...pur,
        amountPaid: newPaid,
        outstandingBalance: newOutstanding,
      });
    }
  }

  const payment: Payment = {
    id: 'pay-' + Math.random().toString(36).substring(2, 11),
    paymentNo: params.paymentNo,
    paymentDate: params.paymentDate,
    direction,
    partyId: params.party.id,
    accountId: params.account.id,
    totalAmount: roundTo2(totalAmount),
    unallocatedAmount,
    paymentMethod: params.paymentMethod,
    referenceNo: params.referenceNo,
    notes: params.notes,
    allocations: allocations.map((a) => ({
      id: 'pa-' + Math.random().toString(36).substring(2, 9),
      ...a,
    })),
    createdBy: actor,
    createdAt: now,
  };

  // Create account transaction: DEBIT for incoming receipts, CREDIT for outgoing payments
  const txDirection = direction === 'INFLOW_RECEIPT' ? 'DEBIT' : 'CREDIT';
  const txType = direction === 'INFLOW_RECEIPT' ? 'CUSTOMER_RECEIPT' : 'SUPPLIER_PAYMENT';
  const description = `${direction === 'INFLOW_RECEIPT' ? 'Receipt from' : 'Payment to'} ${params.party.legalName}`;

  const accountTx: AccountTransaction = {
    id: 'atx-' + Math.random().toString(36).substring(2, 11),
    accountId: params.account.id,
    transactionDate: params.paymentDate,
    transactionType: txType,
    direction: txDirection,
    amount: roundTo2(totalAmount),
    paymentId: payment.id,
    referenceNo: params.referenceNo,
    description,
    createdBy: actor,
    createdAt: now,
  };

  return {
    updatedPayment: payment,
    updatedInvoices,
    updatedPurchases,
    newAccountTransaction: accountTx,
  };
}

export interface ContraTransferResult {
  outflowTx: AccountTransaction;
  inflowTx: AccountTransaction;
}

/**
 * Executes a Cash <-> Bank inter-account contra transfer.
 * Atomically decreases source account (Credit) and increases destination account (Debit).
 * Does NOT generate revenue or expense.
 */
export function executeContraTransfer(
  sourceAccount: CashBankAccount,
  destAccount: CashBankAccount,
  amount: number,
  date: string,
  referenceNo: string,
  actor: string
): ContraTransferResult {
  if (sourceAccount.id === destAccount.id) {
    throw new Error('Source and destination accounts must be different.');
  }

  if (amount <= 0) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  const now = new Date().toISOString();
  const amt = roundTo2(amount);

  const outflowTx: AccountTransaction = {
    id: 'atx-' + Math.random().toString(36).substring(2, 11),
    accountId: sourceAccount.id,
    transactionDate: date,
    transactionType: 'CONTRA_TRANSFER_OUT',
    direction: 'CREDIT', // Money leaves source
    amount: amt,
    contraAccountId: destAccount.id,
    referenceNo,
    description: `Contra transfer to ${destAccount.accountName}`,
    createdBy: actor,
    createdAt: now,
  };

  const inflowTx: AccountTransaction = {
    id: 'atx-' + Math.random().toString(36).substring(2, 11),
    accountId: destAccount.id,
    transactionDate: date,
    transactionType: 'CONTRA_TRANSFER_IN',
    direction: 'DEBIT', // Money enters destination
    amount: amt,
    contraAccountId: sourceAccount.id,
    referenceNo,
    description: `Contra transfer from ${sourceAccount.accountName}`,
    createdBy: actor,
    createdAt: now,
  };

  return { outflowTx, inflowTx };
}

/**
 * Reconciles an account balance from its opening balance and transactions.
 */
export function calculateReconciledAccountBalance(
  account: CashBankAccount,
  transactions: AccountTransaction[]
): number {
  const accountTxs = transactions.filter((t) => t.accountId === account.id);
  const debits = accountTxs
    .filter((t) => t.direction === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);
  const credits = accountTxs
    .filter((t) => t.direction === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);

  return roundTo2(account.openingBalance + debits - credits);
}

/**
 * Reconciles party outstanding net balance strictly from authoritative records.
 */
export function calculatePartyNetBalance(
  party: Party,
  invoices: Invoice[],
  purchases: PurchaseHeader[],
  payments: Payment[]
): number {
  const partyInvoices = invoices.filter((i) => i.customerPartyId === party.id && !i.isCancelled);
  const totalInvoiced = partyInvoices.reduce((sum, i) => sum + i.grandTotal, 0);

  const partyPurchases = purchases.filter((p) => p.supplierPartyId === party.id && p.status === 'POSTED');
  const totalPurchased = partyPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

  const partyReceipts = payments.filter((p) => p.partyId === party.id && p.direction === 'INFLOW_RECEIPT');
  const totalReceived = partyReceipts.reduce((sum, p) => sum + p.totalAmount, 0);

  const partyOutflows = payments.filter((p) => p.partyId === party.id && p.direction === 'OUTFLOW_PAYMENT');
  const totalPaid = partyOutflows.reduce((sum, p) => sum + p.totalAmount, 0);

  // Positive = Customer owes us; Negative = We owe supplier
  return roundTo2(party.openingBalance + totalInvoiced - totalReceived - totalPurchased + totalPaid);
}
