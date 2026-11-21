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
import { buildXlsxArchive, type ExcelWorkbook } from './excelEngine.ts';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function dedupeById<T extends { id?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (item.id) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
    }
    out.push(item);
  }
  return out;
}

function scopeCollection<T extends { id?: string; companyId?: string }>(
  items: T[],
  companyId?: string
): T[] {
  const deduped = dedupeById(items);
  if (!companyId) return deduped;
  return deduped.filter((item) => !item.companyId || item.companyId === companyId);
}

export function scopeOwnerReportInput(input: OwnerReportInput): OwnerReportInput {
  const cid = input.companyId;
  const scopedEmployees = scopeCollection(input.employees, cid);
  const empIds = new Set(scopedEmployees.map((e) => e.id));
  const scopedContractors = scopeCollection(input.contractors, cid);
  const conIds = new Set(scopedContractors.map((c) => c.id));

  return {
    ...input,
    accounts: scopeCollection(input.accounts, cid),
    accountTransactions: scopeCollection(input.accountTransactions, cid),
    expenses: scopeCollection(input.expenses, cid),
    invoices: scopeCollection(input.invoices, cid),
    purchases: scopeCollection(input.purchases, cid),
    sales: scopeCollection(input.sales, cid),
    payments: scopeCollection(input.payments, cid),
    parties: scopeCollection(input.parties, cid),
    employees: scopedEmployees,
    attendance: scopeCollection(input.attendance, cid).filter((a) => !cid || !a.employeeId || empIds.size === 0 || empIds.has(a.employeeId)),
    salaryRecords: scopeCollection(input.salaryRecords, cid).filter((s) => !cid || !s.employeeId || empIds.size === 0 || empIds.has(s.employeeId)),
    dailyLabourEntries: scopeCollection(input.dailyLabourEntries, cid),
    labourPayments: scopeCollection(input.labourPayments, cid),
    contractors: scopedContractors,
    contractorWorkEntries: scopeCollection(input.contractorWorkEntries, cid).filter((w) => !cid || !w.contractorId || conIds.size === 0 || conIds.has(w.contractorId)),
    contractorPayments: scopeCollection(input.contractorPayments, cid).filter((p) => !cid || !p.contractorId || conIds.size === 0 || conIds.has(p.contractorId)),
    journalEntries: scopeCollection(input.journalEntries, cid),
    yards: scopeCollection(input.yards, cid),
  };
}

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
  reconciliationCheck: {
    journalRevenue: number;
    journalExpenses: number;
    invoiceRevenueInPeriod: number;
    expenseTotalInPeriod: number;
    accountLedgerCashBank: number;
    reconciled: boolean;
  };
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
  rawInput: OwnerReportInput,
  fromDate = '2000-01-01',
  toDate = '2099-12-31'
): OwnerBusinessOverview {
  const input = scopeOwnerReportInput(rawInput);
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

  const periodInvoices = input.invoices.filter(
    (i) => !i.isCancelled && i.invoiceDate >= fromDate && i.invoiceDate <= toDate
  );
  const periodExpenses = input.expenses.filter(
    (e) => e.status !== 'REVERSED' && e.expenseDate >= fromDate && e.expenseDate <= toDate
  );
  const invoiceRevenueInPeriod = r2(periodInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0));
  const expenseTotalInPeriod = r2(periodExpenses.reduce((s, e) => s + (e.amount || 0), 0));

  let totalBusinessIncome = 0;
  let totalBusinessExpenses = 0;
  let ownerCapitalInjected = 0;
  let ownerDrawings = 0;
  let journalRevenue = 0;
  let journalExpenses = 0;

  if (postedJournals.length > 0) {
    const pnl = generateProfitAndLoss(postedJournals, fromDate, toDate);
    journalRevenue = r2(pnl.totalRevenue);
    journalExpenses = r2(pnl.totalCOGS + pnl.totalOperatingExpenses);
    totalBusinessIncome = journalRevenue;
    totalBusinessExpenses = journalExpenses;

    for (const je of postedJournals) {
      for (const line of je.lines) {
        if (line.accountCode === '3010') ownerCapitalInjected += line.credit - line.debit;
        if (line.accountCode === '3030') ownerDrawings += line.debit - line.credit;
      }
    }

    const journalSourceIds = new Set(postedJournals.map((j) => j.sourceId).filter(Boolean));
    const journalRefs = new Set(postedJournals.map((j) => j.referenceNo).filter(Boolean));
    const unpostedInvoices = periodInvoices.filter(
      (i) => !journalSourceIds.has(i.id) && !journalRefs.has(i.invoiceNo)
    );
    const unpostedExpenses = periodExpenses.filter(
      (e) => !journalSourceIds.has(e.id) && !journalRefs.has(e.voucherNo)
    );
    if (unpostedInvoices.length > 0 || unpostedExpenses.length > 0) {
      dataWarnings.push(
        `Partial journal coverage: ${unpostedInvoices.length} invoice(s) and ${unpostedExpenses.length} expense(s) in range lack posted journal entries.`
      );
    }
  } else {
    // Fallback when legacy 1.0.0 data has 0 journal entries: derive strictly from non-cancelled invoices & non-reversed expenses
    dataWarnings.push('No posted journal entries found in range; Income/Expense derived from Invoices & Expenses.');
    totalBusinessIncome = invoiceRevenueInPeriod;
    totalBusinessExpenses = expenseTotalInPeriod;
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
    reconciliationCheck: {
      journalRevenue,
      journalExpenses,
      invoiceRevenueInPeriod,
      expenseTotalInPeriod,
      accountLedgerCashBank: r2(totalCashBalance + totalBankBalance),
      reconciled:
        postedJournals.length === 0
          ? true
          : Math.abs(totalBusinessIncome - journalRevenue) < 0.01 &&
            Math.abs(totalBusinessExpenses - journalExpenses) < 0.01,
    },
  };
}

export function computeOwnerPeriodSummary(
  rawInput: OwnerReportInput,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'CUSTOM',
  anchorDate: string,
  customStart?: string,
  customEnd?: string,
  yardId?: string
): OwnerPeriodBreakdown {
  const input = scopeOwnerReportInput(rawInput);
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
  const seenDrillKeys = new Set<string>();
  const pushDrillRow = (row: OwnerPeriodBreakdown['drillDownTransactions'][number]) => {
    const key = `${row.source}:${row.id}`;
    if (seenDrillKeys.has(key)) return;
    seenDrillKeys.add(key);
    drillDownTransactions.push(row);
  };

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
    pushDrillRow({
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

  // Expense breakdown + drill-down
  const catMap = new Map<string, { amount: number; count: number }>();
  for (const exp of input.expenses) {
    if (exp.status === 'REVERSED' || exp.expenseDate < startDate || exp.expenseDate > endDate) continue;
    const cur = catMap.get(exp.category) || { amount: 0, count: 0 };
    cur.amount = r2(cur.amount + exp.amount);
    cur.count += 1;
    catMap.set(exp.category, cur);
    pushDrillRow({
      id: exp.id,
      date: exp.expenseDate,
      source: 'EXPENSE',
      reference: exp.voucherNo || exp.id,
      partyOrCategory: `${exp.category}${exp.description ? ` — ${exp.description}` : ''}`,
      debit: exp.amount,
      credit: 0,
      classification: `EXPENSE_${exp.status}`,
    });
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
  for (const pay of completedPayments) {
    const partyName = input.parties.find((pt) => pt.id === pay.partyId)?.legalName || pay.partyId;
    pushDrillRow({
      id: pay.id,
      date: pay.paymentDate,
      source: 'PAYMENT',
      reference: pay.paymentNo || pay.id,
      partyOrCategory: partyName,
      debit: pay.direction === 'INFLOW_RECEIPT' ? pay.totalAmount : 0,
      credit: pay.direction === 'OUTFLOW_PAYMENT' ? pay.totalAmount : 0,
      classification: pay.direction,
    });
  }
  const customerPaymentsReceived = r2(
    completedPayments.filter((p) => p.direction === 'INFLOW_RECEIPT').reduce((s, p) => s + p.totalAmount, 0)
  );
  const supplierPaymentsMade = r2(
    completedPayments.filter((p) => p.direction === 'OUTFLOW_PAYMENT').reduce((s, p) => s + p.totalAmount, 0)
  );

  // Purchases & Supplier History + drill-down
  const filteredPurchases = input.purchases.filter(
    (p) =>
      p.status !== 'CANCELLED' &&
      p.transactionDate.slice(0, 10) >= startDate &&
      p.transactionDate.slice(0, 10) <= endDate &&
      (!yardId || yardId === 'ALL' || p.yardId === yardId)
  );
  for (const pur of filteredPurchases) {
    const partyName = input.parties.find((pt) => pt.id === pur.supplierPartyId)?.legalName || pur.supplierPartyId;
    pushDrillRow({
      id: pur.id,
      date: pur.transactionDate.slice(0, 10),
      source: 'PURCHASE',
      reference: pur.purchaseNo || pur.id,
      partyOrCategory: partyName,
      debit: pur.totalAmount || 0,
      credit: 0,
      classification: `PURCHASE_${pur.status}`,
    });
  }
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

  // Customer History + drill-down
  const filteredInvoices = input.invoices.filter(
    (i) => !i.isCancelled && i.invoiceDate >= startDate && i.invoiceDate <= endDate
  );
  for (const inv of filteredInvoices) {
    const partyName = input.parties.find((pt) => pt.id === inv.customerPartyId)?.legalName || inv.customerPartyId;
    pushDrillRow({
      id: inv.id,
      date: inv.invoiceDate,
      source: 'INVOICE',
      reference: inv.invoiceNo || inv.id,
      partyOrCategory: partyName,
      debit: 0,
      credit: inv.grandTotal || 0,
      classification: `INVOICE_${inv.paymentStatus}`,
    });
  }
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

  // Posted Journal Entries drill-down
  for (const je of input.journalEntries) {
    if (!je.isPosted || je.entryDate < startDate || je.entryDate > endDate) continue;
    pushDrillRow({
      id: je.id,
      date: je.entryDate,
      source: 'JOURNAL',
      reference: je.entryNo || je.referenceNo || je.id,
      partyOrCategory: je.narration,
      debit: je.totalDebit || 0,
      credit: je.totalCredit || 0,
      classification: je.sourceType,
    });
  }

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

export function generateOwnerSummaryWorkbook(
  overview: OwnerBusinessOverview,
  summary: OwnerPeriodBreakdown,
  companyName: string,
  periodLabel: string
): Uint8Array {
  const workbook: ExcelWorkbook = {
    filename: `Owner_Summary_${summary.startDate}_to_${summary.endDate}.xlsx`,
    sheets: [
      {
        name: 'Summary',
        headers: ['Company', 'Period', 'Metric', 'Amount (INR)', 'Semantics'],
        rows: [
          [companyName, periodLabel, 'Business Income', summary.businessIncome, 'Selected Period'],
          [companyName, periodLabel, 'Business Expenses', summary.businessExpenses, 'Selected Period'],
          [companyName, periodLabel, 'Net Profit / Loss', summary.netProfitLoss, 'Selected Period'],
          [companyName, periodLabel, 'Cash Inflows', summary.cashInflows, 'Selected Period'],
          [companyName, periodLabel, 'Cash Outflows', summary.cashOutflows, 'Selected Period'],
          [companyName, periodLabel, 'Bank Inflows', summary.bankInflows, 'Selected Period'],
          [companyName, periodLabel, 'Bank Outflows', summary.bankOutflows, 'Selected Period'],
          [companyName, periodLabel, 'Owner Capital Inflows', summary.ownerCapitalInflows, 'Selected Period (Excluded from Revenue)'],
          [companyName, periodLabel, 'Owner Drawings', summary.ownerDrawingsOutflows, 'Selected Period (Excluded from Expenses)'],
          [companyName, periodLabel, 'Current Cash Balance', overview.totalCashBalance, 'Current Balance (As of Today)'],
          [companyName, periodLabel, 'Current Bank Balance', overview.totalBankBalance, 'Current Balance (As of Today)'],
          [companyName, periodLabel, 'Customer Receivables', overview.totalCustomerReceivables, 'Current Balance (As of Today)'],
          [companyName, periodLabel, 'Supplier Payables', overview.totalSupplierPayables, 'Current Balance (As of Today)'],
          [companyName, periodLabel, 'Unpaid Expense Payables', overview.unpaidExpensePayables, 'Current Balance (As of Today)'],
          [companyName, periodLabel, 'Worker / Contractor Liabilities', overview.workerSalaryLiabilities, 'Current Balance (As of Today)'],
          [companyName, periodLabel, 'Current Financial Position', overview.currentFinancialPosition, 'Current Net Position'],
          [companyName, periodLabel, 'Ledger Reconciliation Status', overview.reconciliationCheck.reconciled ? 1 : 0, overview.reconciliationCheck.reconciled ? 'RECONCILED' : 'MISMATCH'],
        ],
      },
      {
        name: 'Expense_Categories',
        headers: ['Category', 'Count', 'Amount (INR)'],
        rows: summary.expenseByCategory.map((c) => [c.category, c.count, c.amount]),
        summaryRow: [
          'TOTAL',
          summary.expenseByCategory.reduce((s, c) => s + c.count, 0),
          r2(summary.expenseByCategory.reduce((s, c) => s + c.amount, 0)),
        ],
      },
      {
        name: 'Parties_And_Yards',
        headers: ['Section', 'Name', 'Count', 'Total Amount (INR)', 'Outstanding / Sales (INR)'],
        rows: [
          ...summary.supplierPurchaseHistory.map((s) => ['Supplier Purchases', s.partyName, s.count, s.totalAmount, s.outstanding]),
          ...summary.customerTransactionHistory.map((c) => ['Customer Billing', c.partyName, c.invoiceCount, c.totalBilled, c.outstanding]),
          ...summary.yardSummary.map((y) => ['Yard Operations', y.yardName, y.purchaseCount + y.salesCount, y.purchaseTotal, y.salesTotal]),
        ],
      },
      {
        name: 'Drill_Down',
        headers: ['Date', 'Source', 'Reference', 'Party / Category', 'Debit (INR)', 'Credit (INR)', 'Classification'],
        rows: summary.drillDownTransactions.map((d) => [d.date, d.source, d.reference, d.partyOrCategory, d.debit, d.credit, d.classification]),
        summaryRow: [
          'TOTAL',
          `${summary.drillDownTransactions.length} rows`,
          '',
          '',
          r2(summary.drillDownTransactions.reduce((s, d) => s + d.debit, 0)),
          r2(summary.drillDownTransactions.reduce((s, d) => s + d.credit, 0)),
          '',
        ],
      },
    ],
  };
  return buildXlsxArchive(workbook);
}
