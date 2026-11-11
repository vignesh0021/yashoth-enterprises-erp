// Yasoth Enterprises Scrap ERP — Finance & Accounting Rules Engine
// Enforces payment allocation limits, party ledger derivation, and contra-account integrity

import type { 
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
 * If transactions already include an OPENING_BALANCE transaction, the opening balance
 * is already recorded in the ledger, so we do not double-count account.openingBalance.
 */
export function calculateReconciledAccountBalance(
  account: CashBankAccount,
  transactions: AccountTransaction[]
): number {
  const accountTxs = transactions.filter((t) => t.accountId === account.id);
  const hasOpeningTx = accountTxs.some((t) => t.transactionType === 'OPENING_BALANCE');
  const baseBalance = hasOpeningTx ? 0 : account.openingBalance;

  const debits = accountTxs
    .filter((t) => t.direction === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);
  const credits = accountTxs
    .filter((t) => t.direction === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);

  return roundTo2(baseBalance + debits - credits);
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

/**
 * 1. Permanent Monthly Employee Salary:
 * Gross Salary + Approved Allowances - Deductions - Salary Advance Recovery = Net Salary Payable
 */
export function calculateMonthlySalary(
  grossSalary: number,
  allowances: number = 0,
  deductions: number = 0,
  advanceRecovery: number = 0
): number {
  const net = grossSalary + allowances - deductions - advanceRecovery;
  return roundTo2(Math.max(0, net));
}

/**
 * 2. Daily Wage Labour:
 * Total Labour Cost = Worker Count × Working Days × Daily Rate + Overtime + Approved Additional Charges
 */
export function calculateDailyLabourCost(
  workerCount: number,
  workingDays: number,
  dailyRate: number,
  overtimeAmount: number = 0,
  additionalCharges: number = 0
): number {
  if (workerCount <= 0 || workingDays <= 0 || dailyRate <= 0) {
    return 0;
  }
  const baseCost = workerCount * workingDays * dailyRate;
  return roundTo2(baseCost + (overtimeAmount || 0) + (additionalCharges || 0));
}

/**
 * Daily Labour Balance = Total Labour Cost - Advance Adjustments - Payments
 */
export function calculateDailyLabourBalance(
  totalLabourCost: number,
  advanceAmount: number = 0,
  amountPaid: number = 0
): number {
  return roundTo2(Math.max(0, totalLabourCost - (advanceAmount || 0) - (amountPaid || 0)));
}

/**
 * 3. Outsourced / Contract Labour:
 * Balance = Total Contract Amount - Advance Paid - Previous Payments - Current Payment
 */
export function calculateContractorBalance(
  totalContractAmount: number,
  advancePaid: number = 0,
  previousPayments: number = 0,
  currentPayment: number = 0
): number {
  return roundTo2(Math.max(0, totalContractAmount - (advancePaid || 0) - (previousPayments || 0) - (currentPayment || 0)));
}

/**
 * 4. Guided Daily Cash Closing:
 * Expected Cash in Hand = Opening Cash + Cash Inflow - Cash Outflow
 * Difference = Physically Counted Cash - Expected Cash (+ = excess, - = shortage)
 */
export function computeDailyCashClosing(
  openingCash: number,
  cashInflow: number,
  cashOutflow: number,
  countedCash: number
): {
  expectedCash: number;
  difference: number;
  status: 'MATCHED' | 'EXCESS' | 'SHORTAGE';
} {
  const expectedCash = roundTo2(openingCash + cashInflow - cashOutflow);
  const difference = roundTo2(countedCash - expectedCash);
  let status: 'MATCHED' | 'EXCESS' | 'SHORTAGE' = 'MATCHED';
  if (difference > 0.01) status = 'EXCESS';
  else if (difference < -0.01) status = 'SHORTAGE';
  return { expectedCash, difference, status };
}

/**
 * 5. Profit & Loss:
 * Revenue = Sales Invoices + Other Income
 * Direct Cost = Material Purchases + Inward Freight + Direct Labour
 * Gross Profit = Revenue - Direct Cost
 * Operating Expenses = Daily Expenses + Staff Salaries + Yard Electricity/Rent/Fuel + Maintenance
 * Net Business Profit / Loss = Gross Profit - Operating Expenses
 */
export function calculateProfitAndLoss(params: {
  salesRevenue: number;
  otherIncome?: number;
  materialPurchaseCost: number;
  inwardFreight?: number;
  directLabour?: number;
  operatingExpenses: number;
  staffSalaries?: number;
  yardUtilitiesFuel?: number;
  maintenance?: number;
}): {
  revenue: number;
  directCost: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
} {
  const revenue = roundTo2(params.salesRevenue + (params.otherIncome || 0));
  const directCost = roundTo2(
    params.materialPurchaseCost + (params.inwardFreight || 0) + (params.directLabour || 0)
  );
  const grossProfit = roundTo2(revenue - directCost);
  const operatingExpenses = roundTo2(
    params.operatingExpenses +
    (params.staffSalaries || 0) +
    (params.yardUtilitiesFuel || 0) +
    (params.maintenance || 0)
  );
  const netProfit = roundTo2(grossProfit - operatingExpenses);
  return {
    revenue,
    directCost,
    grossProfit,
    operatingExpenses,
    netProfit,
  };
}

/**
 * 6. Dynamic Account Balance Derivation from General Ledger:
 * Balance = Opening Balance + SUM(Debits) - SUM(Credits) [Asset Accounts: Cash & Bank]
 */
export function calculateAccountBalanceFromLedger(
  account: CashBankAccount,
  transactions: AccountTransaction[]
): number {
  const accountTxs = transactions.filter((t) => t.accountId === account.id);
  let balance = roundTo2(account.openingBalance || 0);
  for (const tx of accountTxs) {
    if (tx.direction === 'DEBIT') {
      balance = roundTo2(balance + tx.amount);
    } else if (tx.direction === 'CREDIT') {
      balance = roundTo2(balance - tx.amount);
    }
  }
  return balance;
}

/**
 * 7. Cash & Bank Transaction Validation:
 * Prevents unauthorized negative cash or bank overdrafts.
 */
export function validateCashBankTransaction(params: {
  account: CashBankAccount;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  currentBalance: number;
}): void {
  if (params.amount <= 0) {
    throw new Error('Transaction amount must be greater than zero.');
  }

  if (params.direction === 'CREDIT') {
    const newBal = roundTo2(params.currentBalance - params.amount);
    if (params.account.accountType === 'CASH' && newBal < -0.01) {
      throw new Error(
        `Insufficient cash in hand. Available: ₹${params.currentBalance}, payment: ₹${params.amount}. Cash balance cannot be negative.`
      );
    }
    if (params.account.accountType === 'BANK' && newBal < -0.01) {
      const isOd =
        params.account.accountCode?.toUpperCase().includes('OD') ||
        params.account.accountName?.toUpperCase().includes('OD') ||
        params.account.accountName?.toUpperCase().includes('OVERDRAFT');
      if (!isOd) {
        throw new Error(
          `Insufficient bank balance. Available: ₹${params.currentBalance}, payment: ₹${params.amount}. Overdraft is not enabled for this bank account.`
        );
      }
    }
  }
}

/**
 * 8. Contra Transfer Validation:
 * Ensures transfers strictly shift liquidity between balance sheet accounts without P&L impact.
 */
export function validateContraTransfer(params: {
  fromAccount?: CashBankAccount;
  toAccount?: CashBankAccount;
  sourceAccount?: CashBankAccount;
  destAccount?: CashBankAccount;
  amount: number;
  fromAccountBalance?: number;
  sourceCurrentBalance?: number;
}): void {
  const fromAcc = params.fromAccount || params.sourceAccount;
  const toAcc = params.toAccount || params.destAccount;
  const fromBal = params.fromAccountBalance ?? params.sourceCurrentBalance ?? 0;

  if (!fromAcc || !toAcc) {
    throw new Error('Source and destination accounts must be selected.');
  }
  if (fromAcc.id === toAcc.id) {
    throw new Error('Source and destination accounts must be different for a contra transfer.');
  }
  if (params.amount <= 0) {
    throw new Error('Transfer amount must be greater than zero.');
  }
  if (fromAcc.accountType === 'CASH' && roundTo2(fromBal - params.amount) < -0.01) {
    throw new Error(
      `Insufficient balance in ${fromAcc.accountName}. Available: ₹${fromBal}, transfer: ₹${params.amount}.`
    );
  }
}

/**
 * 9. Authoritative Profit & Loss (COGS-based with FIFO valuation check):
 * Sales Revenue - Cost of Goods Sold (COGS) = Gross Profit
 * Gross Profit - Operating Expenses - Salaries - Labour - Contractor = Net Operating Profit
 */
export function calculateAuthoritativeProfitAndLoss(params: {
  salesRevenue: number;
  otherIncome?: number;
  cogs?: number;
  cogsFromFifoLots?: number;
  operatingExpenses?: number;
  staffSalaries?: number;
  salariesAndStaffWages?: number;
  dailyLabour?: number;
  directLabourCutting?: number;
  contractorWork?: number;
  contractorCharges?: number;
  freightAndCrane?: number;
  fuelAndDiesel?: number;
  utilitiesAndMaintenance?: number;
  officeFoodAndMisc?: number;
  dateRange?: { startDate: string; endDate: string };
  isCogsVerified?: boolean;
}): {
  revenue: number;
  totalOperatingIncome: number;
  cogs: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  totalOperatingExpenses: number;
  staffSalaries: number;
  dailyLabour: number;
  contractorWork: number;
  totalExpenses: number;
  netProfit: number;
  netOperatingProfit: number;
  explanation: string;
  isVerified: boolean;
} {
  const revenue = roundTo2(params.salesRevenue + (params.otherIncome || 0));
  const cogs = roundTo2(params.cogs ?? params.cogsFromFifoLots ?? 0);
  const grossProfit = roundTo2(revenue - cogs);

  const directLabour = roundTo2(params.dailyLabour ?? params.directLabourCutting ?? 0);
  const staffSalaries = roundTo2(params.staffSalaries ?? params.salariesAndStaffWages ?? 0);
  const contractorWork = roundTo2(params.contractorWork ?? params.contractorCharges ?? 0);

  const directExpensesSum = roundTo2(
    (params.freightAndCrane || 0) +
    (params.fuelAndDiesel || 0) +
    (params.utilitiesAndMaintenance || 0) +
    (params.officeFoodAndMisc || 0)
  );
  const opExp = roundTo2((params.operatingExpenses || 0) + directExpensesSum);
  const totalExpenses = roundTo2(opExp + staffSalaries + directLabour + contractorWork);
  const netProfit = roundTo2(grossProfit - totalExpenses);

  const explanation =
    `Gross Profit (₹${grossProfit.toLocaleString('en-IN')}) = Sales Revenue (₹${revenue.toLocaleString('en-IN')}) - Cost of Goods Sold (₹${cogs.toLocaleString('en-IN')}). ` +
    `Net Operating Profit (₹${netProfit.toLocaleString('en-IN')}) = Gross Profit (₹${grossProfit.toLocaleString('en-IN')}) - ` +
    `Total Operating Expenses (₹${totalExpenses.toLocaleString('en-IN')}) [Operating: ₹${opExp.toLocaleString('en-IN')}, Salaries: ₹${staffSalaries.toLocaleString('en-IN')}, Labour: ₹${directLabour.toLocaleString('en-IN')}, Contractors: ₹${contractorWork.toLocaleString('en-IN')}].`;

  return {
    revenue,
    totalOperatingIncome: revenue,
    cogs,
    costOfGoodsSold: cogs,
    grossProfit,
    operatingExpenses: opExp,
    totalOperatingExpenses: totalExpenses,
    staffSalaries,
    dailyLabour: directLabour,
    contractorWork,
    totalExpenses,
    netProfit,
    netOperatingProfit: netProfit,
    explanation,
    isVerified: Boolean(params.isCogsVerified),
  };
}

/**
 * 10. Financial Form Validators
 */
export function validateSalaryRecordInput(
  record: {
    id?: string;
    employeeId: string;
    employeeName: string;
    salaryMonth: string;
    grossSalary: number;
    allowances?: number;
    deductions?: number;
    advanceRecovery?: number;
    amountPaid?: number;
    paymentMode?: string;
    accountId?: string;
  },
  existingRecords: { id: string; employeeId: string; salaryMonth: string }[] = []
): void {
  if (!record.employeeId) {
    throw new Error('Employee selection is required.');
  }
  if (!record.salaryMonth || !/^\d{4}-\d{2}$/.test(record.salaryMonth)) {
    throw new Error('Invalid salary month format. Must be YYYY-MM.');
  }

  // Duplicate check for same employee and salary month
  const duplicate = existingRecords.find(
    (r) => r.employeeId === record.employeeId && r.salaryMonth === record.salaryMonth && r.id !== record.id
  );
  if (duplicate) {
    throw new Error(`Salary record for ${record.employeeName || 'employee'} for ${record.salaryMonth} already exists.`);
  }

  if (record.grossSalary < 0) {
    throw new Error('Gross salary cannot be negative.');
  }
  if ((record.allowances || 0) < 0) {
    throw new Error('Allowances cannot be negative.');
  }
  if ((record.deductions || 0) < 0) {
    throw new Error('Deductions cannot be negative.');
  }
  if ((record.advanceRecovery || 0) < 0) {
    throw new Error('Advance recovery cannot be negative.');
  }

  const netPayable = calculateMonthlySalary(
    record.grossSalary,
    record.allowances || 0,
    record.deductions || 0,
    record.advanceRecovery || 0
  );

  const amountPaid = record.amountPaid || 0;
  if (amountPaid < 0) {
    throw new Error('Amount paid cannot be negative.');
  }
  if (amountPaid > netPayable) {
    throw new Error(`Amount paid (₹${amountPaid}) cannot exceed net salary payable (₹${netPayable}).`);
  }
  if (amountPaid > 0 && !record.accountId) {
    throw new Error('Payment account (Cash or Bank) must be selected for salary disbursement.');
  }
}

export function validateDailyLabourInput(labour: {
  workerNameOrGroup: string;
  workerCount: number;
  workingDays: number;
  dailyRate: number;
  overtimeAmount?: number;
  additionalCharges?: number;
  advanceAmount?: number;
  amountPaid?: number;
  paymentMode?: string;
  accountId?: string;
}): void {
  if (!labour.workerNameOrGroup || labour.workerNameOrGroup.trim().length === 0) {
    throw new Error('Worker Name or Group is required.');
  }
  if (labour.workerCount <= 0 || !Number.isInteger(labour.workerCount)) {
    throw new Error('Worker count must be a positive integer.');
  }
  if (labour.workingDays <= 0) {
    throw new Error('Working days must be greater than zero.');
  }
  if (labour.dailyRate <= 0) {
    throw new Error('Daily rate must be greater than zero.');
  }
  if ((labour.overtimeAmount || 0) < 0) {
    throw new Error('Overtime amount cannot be negative.');
  }
  if ((labour.additionalCharges || 0) < 0) {
    throw new Error('Additional charges cannot be negative.');
  }

  const totalCost = calculateDailyLabourCost(
    labour.workerCount,
    labour.workingDays,
    labour.dailyRate,
    labour.overtimeAmount || 0,
    labour.additionalCharges || 0
  );

  const advance = labour.advanceAmount || 0;
  const paid = labour.amountPaid || 0;
  if (advance < 0) throw new Error('Advance amount cannot be negative.');
  if (paid < 0) throw new Error('Amount paid cannot be negative.');
  if (roundTo2(advance + paid) > totalCost) {
    throw new Error(`Total payments and advance adjustments (₹${roundTo2(advance + paid)}) cannot exceed total labour cost (₹${totalCost}).`);
  }
  if (paid > 0 && !labour.accountId) {
    throw new Error('Payment account must be selected when payment is made.');
  }
}

export function validateContractorWorkInput(work: {
  contractorId: string;
  contractorName: string;
  workDescription: string;
  contractType?: string;
  quantityCompleted?: number;
  agreedRate?: number;
  totalContractAmount: number;
  advancePaid?: number;
  previousPayments?: number;
  currentPayment?: number;
  accountId?: string;
}): void {
  if (!work.contractorId || !work.contractorName) {
    throw new Error('Contractor selection is required.');
  }
  if (!work.workDescription || work.workDescription.trim().length === 0) {
    throw new Error('Work description is required.');
  }

  if (work.contractType === 'QUANTITY_BASED') {
    const qty = work.quantityCompleted || 0;
    const rate = work.agreedRate || 0;
    if (qty <= 0) throw new Error('Completed quantity must be greater than zero for quantity-based contracts.');
    if (rate <= 0) throw new Error('Agreed rate must be greater than zero for quantity-based contracts.');
    const expectedTotal = roundTo2(qty * rate);
    if (Math.abs(expectedTotal - work.totalContractAmount) > 0.05) {
      throw new Error(`Contract amount (₹${work.totalContractAmount}) does not match Quantity × Rate (₹${expectedTotal}).`);
    }
  }

  if (work.totalContractAmount <= 0) {
    throw new Error('Total contract amount must be greater than zero.');
  }

  const advance = work.advancePaid || 0;
  const prev = work.previousPayments || 0;
  const current = work.currentPayment || 0;
  if (advance < 0) throw new Error('Advance paid cannot be negative.');
  if (prev < 0) throw new Error('Previous payments cannot be negative.');
  if (current < 0) throw new Error('Current payment cannot be negative.');

  const totalDeducted = roundTo2(advance + prev + current);
  if (totalDeducted > work.totalContractAmount) {
    throw new Error(`Total payments and advances (₹${totalDeducted}) cannot exceed total contract amount (₹${work.totalContractAmount}).`);
  }

  if (current > 0 && !work.accountId) {
    throw new Error('Payment account must be selected when payment is made.');
  }
}

export function validateContractorPaymentInput(
  payment: {
    contractorWorkId: string;
    amount: number;
    paymentMode?: string;
    accountId?: string;
  },
  workEntry: { id: string; remainingBalance: number }
): void {
  if (!payment.contractorWorkId) {
    throw new Error('Contractor work reference is required.');
  }
  if (payment.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (roundTo2(payment.amount) > roundTo2(workEntry.remainingBalance)) {
    throw new Error(
      `Payment amount (₹${payment.amount}) exceeds remaining payable balance (₹${workEntry.remainingBalance}).`
    );
  }
  if (!payment.accountId) {
    throw new Error('Payment account must be selected.');
  }
}

export function validateExpenseInput(
  expense: {
    id?: string;
    voucherNo: string;
    category: string;
    amount: number;
    paidTo: string;
    paymentMode?: string;
    accountId?: string;
  },
  existingExpenses: { id: string; voucherNo: string }[] = []
): void {
  if (!expense.voucherNo || expense.voucherNo.trim().length === 0) {
    throw new Error('Voucher number is required.');
  }
  if (!expense.category) {
    throw new Error('Expense category is required.');
  }
  if (expense.amount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }
  if (!expense.paidTo || expense.paidTo.trim().length === 0) {
    throw new Error('Recipient / Paid To name is required.');
  }
  if ((expense.paymentMode === 'CASH' || expense.paymentMode === 'BANK') && !expense.accountId) {
    throw new Error('Payment account must be selected for Cash or Bank payment.');
  }

  const dup = existingExpenses.find((e) => e.voucherNo === expense.voucherNo && e.id !== expense.id);
  if (dup) {
    throw new Error(`Expense voucher ${expense.voucherNo} already exists.`);
  }
}


