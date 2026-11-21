// Yashoth Enterprises ERP — Dedicated Owner Summary Reports Engine
// Pure, authoritative, ledger-reconciled calculations using persisted ERP/Supabase records only.
// Strictly separates Business Revenue (4xxx) from Owner Capital (3010), Loans (2150), and Transfers,
// and Operating Expenses (5xxx) from Owner Drawings (3030) and Transfers.

import type {
  AccountTransaction,
  AttendanceEntry,
  CashBankAccount,
  Contractor,
  ContractorPayment,
  ContractorWorkEntry,
  DailyLabourEntry,
  Employee,
  Expense,
  Invoice,
  JournalEntry,
  LabourPayment,
  MonthlySalaryRecord,
  Party,
  Payment,
  PurchaseHeader,
  SalesHeader,
  Yard,
} from '../../src/types/index.ts';
import { calculateReconciledAccountBalance } from './financeEngine.ts';
import { generateProfitAndLoss } from './accountingEngine.ts';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface OwnerReportInput {
  companyId?: string;
  accounts: CashBankAccount[];
  accountTransactions: AccountTransaction[];
  expenses: Expense[];
  invoices: Invoice[];
  purchases: PurchaseHeader[];
  sales: SalesHeader[];
  payments: Payment[];
  parties: Party[];
  employees: Employee[];
  attendance: AttendanceEntry[];
  salaryRecords: MonthlySalaryRecord[];
  dailyLabourEntries: DailyLabourEntry[];
  labourPayments: LabourPayment[];
  contractors: Contractor[];
  contractorWorkEntries: ContractorWorkEntry[];
  contractorPayments: ContractorPayment[];
  journalEntries: JournalEntry[];
  yards: Yard[];
}

export interface OwnerBusinessOverview {
  totalBusinessIncome: number;
  totalBusinessExpenses: number;
  netProfitLoss: number;
  totalCashBalance: number;
  totalBankBalance: number;
  totalCustomerReceivables: number;
  totalSupplierPayables: number;
  workerSalaryLiabilities: number;
  unpaidExpensePayables: number;
  currentFinancialPosition: number;
  ownerCapitalInjected: number;
  ownerDrawings: number;
  dataWarnings: string[];
}

export interface OwnerPeriodBreakdown {
  startDate: string;
  endDate: string;
  businessIncome: number;
  businessExpenses: number;
  netProfitLoss: number;
  cashInflows: number;
  cashOutflows: number;
  bankInflows: number;
  bankOutflows: number;
  ownerCapitalInflows: number;
  ownerDrawingsOutflows: number;
  expenseByCategory: { category: string; amount: number; count: number }[];
  salaryPaid: number;
  labourPaid: number;
  contractorPaid: number;
  customerPaymentsReceived: number;
  supplierPaymentsMade: number;
  purchaseSummary: { count: number; totalAmount: number; paidAmount: number; outstanding: number };
  supplierPurchaseHistory: { partyId: string; partyName: string; count: number; totalAmount: number; outstanding: number }[];
  customerTransactionHistory: { partyId: string; partyName: string; invoiceCount: number; totalBilled: number; outstanding: number }[];
  attendanceSummary: { present: number; halfDay: number; absent: number; totalEntries: number };
  yardSummary: { yardId: string; yardName: string; purchaseCount: number; purchaseTotal: number; salesCount: number; salesTotal: number }[];
  monthlyTrends: { month: string; income: number; expenses: number; profitLoss: number }[];
  drillDownTransactions: {
    id: string;
    date: string;
    source: 'JOURNAL' | 'EXPENSE' | 'ACCOUNT_TX' | 'INVOICE' | 'PURCHASE' | 'PAYMENT';
    reference: string;
    partyOrCategory: string;
    debit: number;
    credit: number;
    classification: string;
  }[];
  alerts: string[];
}

export function getPeriodDateRange(
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'CUSTOM',
  anchorDate: string,
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } {
  if (period === 'CUSTOM' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }
  const dt = new Date((anchorDate || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
  if (period === 'DAILY') {
    const s = dt.toISOString().slice(0, 10);
    return { startDate: s, endDate: s };
  }
  if (period === 'WEEKLY') {
    const day = dt.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const mon = new Date(dt);
    mon.setUTCDate(dt.getUTCDate() + mondayOffset);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);
    return { startDate: mon.toISOString().slice(0, 10), endDate: sun.toISOString().slice(0, 10) };
  }
  if (period === 'ANNUAL') {
    const y = dt.getUTCFullYear();
    return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
  }
  // MONTHLY
  const ym = dt.toISOString().slice(0, 7);
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { startDate: `${ym}-01`, endDate: `${ym}-${String(lastDay).padStart(2, '0')}` };
}

export function computeOwnerBusinessOverview(
  input: OwnerReportInput,
  fromDate = '2000-01-01',
  toDate = '2099-12-31'
): OwnerBusinessOverview {
  const dataWarnings: string[] = [];

  // 1. Cash & Bank balances from reconciled account ledger
  const totalCashBalance = r2(
    input.accounts
      .filter((a) => a.accountType === 'CASH')
      .reduce((s, a) => s + calculateReconciledAccountBalance(a, input.accountTransactions), 0)
  );
  const totalBankBalance = r2(
    input.accounts
      .filter((a) => a.accountType === 'BANK')
      .reduce((s, a) => s + calculateReconciledAccountBalance(a, input.accountTransactions), 0)
  );

  // 2. Authoritative P&L from posted Journal Entries (4xxx Income, 5xxx Expense)
  const postedJournals = input.journalEntries.filter(
    (j) => j.isPosted && j.entryDate >= fromDate && j.entryDate <= toDate
  );

  let totalBusinessIncome = 0;
  let totalBusinessExpenses = 0;
  let ownerCapitalInjected = 0;
  let ownerDrawings = 0;

  if (postedJournals.length > 0) {
    const pnl = generateProfitAndLoss(postedJournals, fromDate, toDate);
    totalBusinessIncome = r2(pnl.totalRevenue);
    totalBusinessExpenses = r2(pnl.totalCOGS + pnl.totalOperatingExpenses);

    for (const je of postedJournals) {
      for (const line of je.lines) {
        if (line.accountCode === '3010') ownerCapitalInjected += line.credit - line.debit;
        if (line.accountCode === '3030') ownerDrawings += line.debit - line.credit;
      }
    }
  } else {
    // Fallback when legacy 1.0.0 data has 0 journal entries: derive strictly from non-cancelled invoices & non-reversed expenses
    dataWarnings.push('No posted journal entries found in range; Income/Expense derived from Invoices & Expenses.');
    totalBusinessIncome = r2(
      input.invoices
        .filter((i) => !i.isCancelled && i.invoiceDate >= fromDate && i.invoiceDate <= toDate)
        .reduce((s, i) => s + (i.grandTotal || 0), 0)
    );
    totalBusinessExpenses = r2(
      input.expenses
        .filter((e) => e.status !== 'REVERSED' && e.expenseDate >= fromDate && e.expenseDate <= toDate)
        .reduce((s, e) => s + (e.amount || 0), 0)
    );
    for (const tx of input.accountTransactions) {
      if (tx.transactionDate < fromDate || tx.transactionDate > toDate) continue;
      if (tx.transactionType === 'OWNER_INJECTION' || tx.transactionType === 'OPENING_BALANCE') {
        ownerCapitalInjected += tx.direction === 'DEBIT' ? tx.amount : -tx.amount;
      } else if (tx.transactionType === 'OWNER_DRAWING') {
        ownerDrawings += tx.direction === 'CREDIT' ? tx.amount : -tx.amount;
      }
    }
  }

  // 3. Outstanding Receivables, Payables & Worker Liabilities
  const totalCustomerReceivables = r2(
    input.invoices
      .filter((i) => !i.isCancelled && i.paymentStatus !== 'CANCELLED')
      .reduce((s, i) => s + Math.max(0, i.outstandingBalance || 0), 0)
  );
  const totalSupplierPayables = r2(
    input.purchases
      .filter((p) => p.status !== 'CANCELLED')
      .reduce((s, p) => s + Math.max(0, p.outstandingBalance || 0), 0)
  );
  const unpaidExpensePayables = r2(
    input.expenses
      .filter((e) => e.status === 'UNPAID')
      .reduce((s, e) => s + (e.amount || 0), 0)
  );

  const salaryLiab = input.salaryRecords.reduce(
    (s, r) => s + Math.max(0, (r.netSalaryPayable || 0) - (r.amountPaid || 0)),
    0
  );
  const labourLiab = input.dailyLabourEntries.reduce(
    (s, l) => s + Math.max(0, l.remainingBalance || 0),
    0
  );
  const contractorLiab = input.contractorWorkEntries.reduce(
    (s, c) => s + Math.max(0, c.remainingBalance ?? (c.totalContractAmount || 0) - (c.currentPayment || 0)),
    0
  );
  const workerSalaryLiabilities = r2(salaryLiab + labourLiab + contractorLiab);

  const netProfitLoss = r2(totalBusinessIncome - totalBusinessExpenses);
  const currentFinancialPosition = r2(
    totalCashBalance +
      totalBankBalance +
      totalCustomerReceivables -
      totalSupplierPayables -
      unpaidExpensePayables -
      workerSalaryLiabilities
  );

  return {
    totalBusinessIncome,
    totalBusinessExpenses,
    netProfitLoss,
    totalCashBalance,
    totalBankBalance,
    totalCustomerReceivables,
    totalSupplierPayables,
    workerSalaryLiabilities,
    unpaidExpensePayables,
    currentFinancialPosition,
    ownerCapitalInjected: r2(ownerCapitalInjected),
    ownerDrawings: r2(ownerDrawings),
    dataWarnings,
  };
}

export function computeOwnerPeriodSummary(
  input: OwnerReportInput,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'CUSTOM',
  anchorDate: string,
  customStart?: string,
  customEnd?: string,
  yardId?: string
): OwnerPeriodBreakdown {
  const { startDate, endDate } = getPeriodDateRange(period, anchorDate, customStart, customEnd);
  const overview = computeOwnerBusinessOverview(input, startDate, endDate);

  const cashIds = new Set(input.accounts.filter((a) => a.accountType === 'CASH').map((a) => a.id));
  const bankIds = new Set(input.accounts.filter((a) => a.accountType === 'BANK').map((a) => a.id));

  let cashInflows = 0;
  let cashOutflows = 0;
  let bankInflows = 0;
  let bankOutflows = 0;
  let ownerCapitalInflows = 0;
  let ownerDrawingsOutflows = 0;

  const drillDownTransactions: OwnerPeriodBreakdown['drillDownTransactions'] = [];

  for (const tx of input.accountTransactions) {
    if (tx.transactionDate < startDate || tx.transactionDate > endDate) continue;
    if (cashIds.has(tx.accountId)) {
      if (tx.direction === 'DEBIT') cashInflows += tx.amount;
      else cashOutflows += tx.amount;
    } else if (bankIds.has(tx.accountId)) {
      if (tx.direction === 'DEBIT') bankInflows += tx.amount;
      else bankOutflows += tx.amount;
    }
    if (tx.transactionType === 'OWNER_INJECTION' || tx.transactionType === 'OPENING_BALANCE') {
      ownerCapitalInflows += tx.amount;
    } else if (tx.transactionType === 'OWNER_DRAWING') {
      ownerDrawingsOutflows += tx.amount;
    }
    drillDownTransactions.push({
      id: tx.id,
      date: tx.transactionDate,
      source: 'ACCOUNT_TX',
      reference: tx.referenceNo || tx.id,
      partyOrCategory: tx.description,
      debit: tx.direction === 'DEBIT' ? tx.amount : 0,
      credit: tx.direction === 'CREDIT' ? tx.amount : 0,
      classification: tx.transactionType,
    });
  }

  // Expense breakdown
  const catMap = new Map<string, { amount: number; count: number }>();
  for (const exp of input.expenses) {
    if (exp.status === 'REVERSED' || exp.expenseDate < startDate || exp.expenseDate > endDate) continue;
    const cur = catMap.get(exp.category) || { amount: 0, count: 0 };
    cur.amount = r2(cur.amount + exp.amount);
    cur.count += 1;
    catMap.set(exp.category, cur);
  }
  const expenseByCategory = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);

  const salaryPaid = r2(
    input.salaryRecords
      .filter((s) => {
        const dt = (s.paymentDate || `${s.salaryMonth}-01`).slice(0, 10);
        return dt >= startDate && dt <= endDate;
      })
      .reduce((sum, s) => sum + (s.amountPaid || 0), 0)
  );
  const labourPaid = r2(
    input.labourPayments
      .filter((p) => p.paymentDate >= startDate && p.paymentDate <= endDate)
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  );
  const contractorPaid = r2(
    input.contractorPayments
      .filter((p) => p.paymentDate >= startDate && p.paymentDate <= endDate)
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  );

  const completedPayments = input.payments.filter(
    (p) => (!p.status || p.status === 'COMPLETED') && p.paymentDate >= startDate && p.paymentDate <= endDate
  );
  const customerPaymentsReceived = r2(
    completedPayments.filter((p) => p.direction === 'INFLOW_RECEIPT').reduce((s, p) => s + p.totalAmount, 0)
  );
  const supplierPaymentsMade = r2(
    completedPayments.filter((p) => p.direction === 'OUTFLOW_PAYMENT').reduce((s, p) => s + p.totalAmount, 0)
  );

  // Purchases & Supplier History
  const filteredPurchases = input.purchases.filter(
    (p) =>
      p.status !== 'CANCELLED' &&
      p.transactionDate.slice(0, 10) >= startDate &&
      p.transactionDate.slice(0, 10) <= endDate &&
      (!yardId || yardId === 'ALL' || p.yardId === yardId)
  );
  const purchaseSummary = {
    count: filteredPurchases.length,
    totalAmount: r2(filteredPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0)),
    paidAmount: r2(filteredPurchases.reduce((s, p) => s + (p.amountPaid || 0), 0)),
    outstanding: r2(filteredPurchases.reduce((s, p) => s + (p.outstandingBalance || 0), 0)),
  };

  const supMap = new Map<string, { count: number; totalAmount: number; outstanding: number }>();
  for (const p of filteredPurchases) {
    const cur = supMap.get(p.supplierPartyId) || { count: 0, totalAmount: 0, outstanding: 0 };
    cur.count += 1;
    cur.totalAmount = r2(cur.totalAmount + (p.totalAmount || 0));
    cur.outstanding = r2(cur.outstanding + (p.outstandingBalance || 0));
    supMap.set(p.supplierPartyId, cur);
  }
  const supplierPurchaseHistory = Array.from(supMap.entries()).map(([partyId, v]) => ({
    partyId,
    partyName: input.parties.find((pt) => pt.id === partyId)?.legalName || partyId,
    ...v,
  }));

  // Customer History
  const filteredInvoices = input.invoices.filter(
    (i) => !i.isCancelled && i.invoiceDate >= startDate && i.invoiceDate <= endDate
  );
  const custMap = new Map<string, { invoiceCount: number; totalBilled: number; outstanding: number }>();
  for (const inv of filteredInvoices) {
    const cur = custMap.get(inv.customerPartyId) || { invoiceCount: 0, totalBilled: 0, outstanding: 0 };
    cur.invoiceCount += 1;
    cur.totalBilled = r2(cur.totalBilled + (inv.grandTotal || 0));
    cur.outstanding = r2(cur.outstanding + (inv.outstandingBalance || 0));
    custMap.set(inv.customerPartyId, cur);
  }
  const customerTransactionHistory = Array.from(custMap.entries()).map(([partyId, v]) => ({
    partyId,
    partyName: input.parties.find((pt) => pt.id === partyId)?.legalName || partyId,
    ...v,
  }));

  // Attendance Summary
  const periodAtt = input.attendance.filter((a) => a.attendanceDate >= startDate && a.attendanceDate <= endDate);
  const attendanceSummary = {
    present: periodAtt.filter((a) => a.status === 'PRESENT').length,
    halfDay: periodAtt.filter((a) => a.status === 'HALF_DAY').length,
    absent: periodAtt.filter((a) => a.status === 'ABSENT').length,
    totalEntries: periodAtt.length,
  };

  // Yard-wise Summary
  const yardSummary = input.yards
    .filter((y) => !yardId || yardId === 'ALL' || y.id === yardId)
    .map((y) => {
      const yp = filteredPurchases.filter((p) => p.yardId === y.id);
      const ys = input.sales.filter(
        (s) => s.yardId === y.id && s.status !== 'CANCELLED' && s.orderDate.slice(0, 10) >= startDate && s.orderDate.slice(0, 10) <= endDate
      );
      return {
        yardId: y.id,
        yardName: y.name,
        purchaseCount: yp.length,
        purchaseTotal: r2(yp.reduce((s, p) => s + (p.totalAmount || 0), 0)),
        salesCount: ys.length,
        salesTotal: r2(ys.reduce((s, sl) => s + (sl.totalAmount || 0), 0)),
      };
    });

  // Monthly P&L Trends (last 6 months with activity)
  const monthKeys = Array.from(
    new Set([
      ...input.journalEntries.map((j) => j.entryDate.slice(0, 7)),
      ...input.invoices.map((i) => i.invoiceDate.slice(0, 7)),
      ...input.expenses.map((e) => e.expenseDate.slice(0, 7)),
    ])
  )
    .filter(Boolean)
    .sort()
    .slice(-6);

  const monthlyTrends = monthKeys.map((m) => {
    const mStart = `${m}-01`;
    const mEnd = `${m}-31`;
    const mOv = computeOwnerBusinessOverview(input, mStart, mEnd);
    return {
      month: m,
      income: mOv.totalBusinessIncome,
      expenses: mOv.totalBusinessExpenses,
      profitLoss: mOv.netProfitLoss,
    };
  });

  // Financial & Operational Alerts
  const alerts: string[] = [...overview.dataWarnings];
  if (overview.totalCashBalance < 5000) {
    alerts.push(`Low Cash Alert: Total cash balance is ₹${overview.totalCashBalance.toLocaleString('en-IN')}.`);
  }
  if (overview.unpaidExpensePayables > 0) {
    alerts.push(`Unpaid Expenses Pending: ₹${overview.unpaidExpensePayables.toLocaleString('en-IN')} awaiting settlement.`);
  }
  if (overview.workerSalaryLiabilities > 0) {
    alerts.push(`Worker / Contractor Liabilities: ₹${overview.workerSalaryLiabilities.toLocaleString('en-IN')} due.`);
  }

  return {
    startDate,
    endDate,
    businessIncome: overview.totalBusinessIncome,
    businessExpenses: overview.totalBusinessExpenses,
    netProfitLoss: overview.netProfitLoss,
    cashInflows: r2(cashInflows),
    cashOutflows: r2(cashOutflows),
    bankInflows: r2(bankInflows),
    bankOutflows: r2(bankOutflows),
    ownerCapitalInflows: r2(ownerCapitalInflows),
    ownerDrawingsOutflows: r2(ownerDrawingsOutflows),
    expenseByCategory,
    salaryPaid,
    labourPaid,
    contractorPaid,
    customerPaymentsReceived,
    supplierPaymentsMade,
    purchaseSummary,
    supplierPurchaseHistory,
    customerTransactionHistory,
    attendanceSummary,
    yardSummary,
    monthlyTrends,
    drillDownTransactions: drillDownTransactions.sort((a, b) => b.date.localeCompare(a.date)),
    alerts,
  };
}

export function generateOwnerReportCsv(
  title: string,
  headers: string[],
  rows: (string | number)[][]
): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    '\uFEFF' +
    [title, `Generated,${new Date().toISOString()}`, '', headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  );
}
