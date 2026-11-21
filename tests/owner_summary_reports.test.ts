import { describe, it, expect } from 'vitest';
import {
  computeOwnerBusinessOverview,
  computeOwnerPeriodSummary,
  getPeriodDateRange,
  generateOwnerReportCsv,
  generateOwnerSummaryWorkbook,
  type OwnerReportInput,
} from '../backend/business-rules/ownerReportsEngine.ts';
import type { CashBankAccount, JournalEntry } from '../src/types/index.ts';

const cashAcc: CashBankAccount = {
  id: 'acc-cash',
  companyId: 'comp-1',
  accountCode: 'CASH-1',
  accountName: 'Petty Cash',
  accountType: 'CASH',
  openingBalance: 0,
  openingBalanceDate: '2026-11-01',
  isActive: true,
};

const baseInput: OwnerReportInput = {
  companyId: 'comp-1',
  accounts: [cashAcc],
  accountTransactions: [
    {
      id: 'tx-cap',
      accountId: 'acc-cash',
      transactionDate: '2026-11-01',
      transactionType: 'OWNER_INJECTION',
      direction: 'DEBIT',
      amount: 27000,
      description: 'Owner capital',
      createdBy: 'Admin',
      createdAt: '2026-11-01T09:00:00Z',
    },
    {
      id: 'tx-draw',
      accountId: 'acc-cash',
      transactionDate: '2026-11-02',
      transactionType: 'OWNER_DRAWING',
      direction: 'CREDIT',
      amount: 2000,
      description: 'Owner drawing',
      createdBy: 'Admin',
      createdAt: '2026-11-02T09:00:00Z',
    },
  ],
  expenses: [
    {
      id: 'exp-1',
      voucherNo: 'EXP-1',
      expenseDate: '2026-11-03',
      category: 'Diesel / Petrol',
      amount: 1500,
      accountId: 'acc-cash',
      paymentMode: 'CASH',
      status: 'PAID',
      paidTo: 'Pump',
      createdBy: 'Admin',
      createdAt: '2026-11-03T10:00:00Z',
    },
  ],
  invoices: [],
  purchases: [],
  sales: [],
  payments: [],
  parties: [],
  employees: [],
  attendance: [],
  salaryRecords: [],
  dailyLabourEntries: [],
  labourPayments: [],
  contractors: [],
  contractorWorkEntries: [],
  contractorPayments: [],
  journalEntries: [
    {
      id: 'je-cap',
      companyId: 'comp-1',
      entryNo: 'JV-1',
      entryDate: '2026-11-01',
      sourceType: 'OPENING_BALANCE',
      narration: 'Owner capital',
      lines: [
        { id: 'l1', accountCode: '1010', accountName: 'Cash', debit: 27000, credit: 0 },
        { id: 'l2', accountCode: '3010', accountName: 'Capital', debit: 0, credit: 27000 },
      ],
      totalDebit: 27000,
      totalCredit: 27000,
      isPosted: true,
      createdBy: 'Admin',
      createdAt: '2026-11-01T09:00:00Z',
    },
    {
      id: 'je-draw',
      companyId: 'comp-1',
      entryNo: 'JV-2',
      entryDate: '2026-11-02',
      sourceType: 'MANUAL',
      narration: 'Owner drawing',
      lines: [
        { id: 'l3', accountCode: '3030', accountName: 'Drawings', debit: 2000, credit: 0 },
        { id: 'l4', accountCode: '1010', accountName: 'Cash', debit: 0, credit: 2000 },
      ],
      totalDebit: 2000,
      totalCredit: 2000,
      isPosted: true,
      createdBy: 'Admin',
      createdAt: '2026-11-02T09:00:00Z',
    },
    {
      id: 'je-rev',
      companyId: 'comp-1',
      entryNo: 'JV-3',
      entryDate: '2026-11-03',
      sourceType: 'SALES_INVOICE',
      narration: 'Scrap sale',
      lines: [
        { id: 'l5', accountCode: '1100', accountName: 'AR', debit: 10000, credit: 0 },
        { id: 'l6', accountCode: '4010', accountName: 'Scrap Sales Revenue', debit: 0, credit: 10000 },
      ],
      totalDebit: 10000,
      totalCredit: 10000,
      isPosted: true,
      createdBy: 'Admin',
      createdAt: '2026-11-03T10:00:00Z',
    },
    {
      id: 'je-exp',
      companyId: 'comp-1',
      entryNo: 'JV-4',
      entryDate: '2026-11-03',
      sourceType: 'EXPENSE',
      sourceId: 'exp-1',
      narration: 'Diesel',
      lines: [
        { id: 'l7', accountCode: '5060', accountName: 'Diesel', debit: 1500, credit: 0 },
        { id: 'l8', accountCode: '1010', accountName: 'Cash', debit: 0, credit: 1500 },
      ],
      totalDebit: 1500,
      totalCredit: 1500,
      isPosted: true,
      createdBy: 'Admin',
      createdAt: '2026-11-03T10:00:00Z',
    },
  ] as JournalEntry[],
  yards: [{ id: 'yard-1', code: 'Y1', name: 'Main Yard', locationAddress: 'Ponneri', isActive: true }],
};

describe('Owner Summary Reports Engine', () => {
  it('excludes Owner Capital (3010) from Business Income and Drawings (3030) from Business Expenses', () => {
    const ov = computeOwnerBusinessOverview(baseInput);
    expect(ov.totalBusinessIncome).toBe(10000);
    expect(ov.totalBusinessExpenses).toBe(1500);
    expect(ov.netProfitLoss).toBe(8500);
    expect(ov.ownerCapitalInjected).toBe(27000);
    expect(ov.ownerDrawings).toBe(2000);
    expect(ov.totalCashBalance).toBe(25000);
    expect(ov.reconciliationCheck.reconciled).toBe(true);
    expect(ov.reconciliationCheck.journalRevenue).toBe(10000);
    expect(ov.reconciliationCheck.journalExpenses).toBe(1500);
  });

  it('computes Daily, Weekly (Mon-Sun), Monthly, Annual, Custom ranges and complete drill-down', () => {
    expect(getPeriodDateRange('DAILY', '2026-11-18')).toEqual({ startDate: '2026-11-18', endDate: '2026-11-18' });
    expect(getPeriodDateRange('WEEKLY', '2026-11-18')).toEqual({ startDate: '2026-11-16', endDate: '2026-11-22' });
    expect(getPeriodDateRange('MONTHLY', '2026-11-18')).toEqual({ startDate: '2026-11-01', endDate: '2026-11-30' });
    expect(getPeriodDateRange('ANNUAL', '2026-11-18')).toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(getPeriodDateRange('CUSTOM', '2026-11-18', '2026-11-01', '2026-11-10')).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-10',
    });

    const summary = computeOwnerPeriodSummary(baseInput, 'MONTHLY', '2026-11-15');
    expect(summary.businessIncome).toBe(10000);
    expect(summary.businessExpenses).toBe(1500);
    expect(summary.expenseByCategory[0]).toEqual({ category: 'Diesel / Petrol', amount: 1500, count: 1 });
    // 2 accountTransactions + 1 expense + 4 journalEntries = 7 distinct source rows
    expect(summary.drillDownTransactions).toHaveLength(7);
    expect(new Set(summary.drillDownTransactions.map((d) => d.source))).toEqual(
      new Set(['ACCOUNT_TX', 'EXPENSE', 'JOURNAL'])
    );
  });

  it('enforces multi-company isolation and never mixes comp-2 data into comp-1 report', () => {
    const multiCompInput: OwnerReportInput = {
      ...baseInput,
      companyId: 'comp-1',
      accounts: [
        ...baseInput.accounts,
        {
          id: 'acc-comp2',
          companyId: 'comp-2',
          accountCode: 'BANK-2',
          accountName: 'Other Co Bank',
          accountType: 'BANK',
          openingBalance: 999999,
          openingBalanceDate: '2026-11-01',
          isActive: true,
        },
      ],
      expenses: [
        ...baseInput.expenses,
        {
          id: 'exp-comp2',
          companyId: 'comp-2',
          voucherNo: 'EXP-C2',
          expenseDate: '2026-11-03',
          category: 'Rent',
          amount: 50000,
          accountId: 'acc-comp2',
          paymentMode: 'BANK_TRANSFER',
          status: 'UNPAID',
          paidTo: 'Landlord',
          createdBy: 'Admin',
          createdAt: '2026-11-03T10:00:00Z',
        } as any,
      ],
      journalEntries: [
        ...baseInput.journalEntries,
        {
          id: 'je-comp2',
          companyId: 'comp-2',
          entryNo: 'JV-C2',
          entryDate: '2026-11-03',
          sourceType: 'SALES_INVOICE',
          narration: 'Comp-2 sale',
          lines: [
            { id: 'lc1', accountCode: '1100', accountName: 'AR', debit: 80000, credit: 0 },
            { id: 'lc2', accountCode: '4010', accountName: 'Sales', debit: 0, credit: 80000 },
          ],
          totalDebit: 80000,
          totalCredit: 80000,
          isPosted: true,
          createdBy: 'Admin',
          createdAt: '2026-11-03T10:00:00Z',
        },
      ],
    };

    const ov = computeOwnerBusinessOverview(multiCompInput);
    expect(ov.totalBankBalance).toBe(0);
    expect(ov.totalBusinessIncome).toBe(10000);
    expect(ov.unpaidExpensePayables).toBe(0);
  });

  it('prevents duplicate transactions with identical IDs in overview and drill-down', () => {
    const dupInput: OwnerReportInput = {
      ...baseInput,
      accountTransactions: [...baseInput.accountTransactions, baseInput.accountTransactions[0]],
      expenses: [...baseInput.expenses, baseInput.expenses[0]],
      journalEntries: [...baseInput.journalEntries, baseInput.journalEntries[2]],
    };
    const ov = computeOwnerBusinessOverview(dupInput);
    const summary = computeOwnerPeriodSummary(dupInput, 'MONTHLY', '2026-11-15');
    expect(ov.totalBusinessIncome).toBe(10000);
    expect(ov.totalCashBalance).toBe(25000);
    expect(summary.drillDownTransactions).toHaveLength(7);
  });

  it('warns on partial journal coverage when an invoice or expense lacks a posted journal', () => {
    const partialInput: OwnerReportInput = {
      ...baseInput,
      invoices: [
        {
          id: 'inv-unposted',
          companyId: 'comp-1',
          invoiceNo: 'INV-99',
          invoiceDate: '2026-11-05',
          customerPartyId: 'cust-1',
          grandTotal: 5000,
          outstandingBalance: 5000,
          paymentStatus: 'UNPAID',
          isCancelled: false,
        } as any,
      ],
    };
    const ov = computeOwnerBusinessOverview(partialInput, '2026-11-01', '2026-11-30');
    expect(ov.dataWarnings.some((w) => w.includes('Partial journal coverage'))).toBe(true);
    expect(ov.totalCustomerReceivables).toBe(5000);
  });

  it('handles empty / incomplete datasets cleanly without NaN', () => {
    const emptyInput: OwnerReportInput = {
      companyId: 'comp-1',
      accounts: [],
      accountTransactions: [],
      expenses: [],
      invoices: [],
      purchases: [],
      sales: [],
      payments: [],
      parties: [],
      employees: [],
      attendance: [],
      salaryRecords: [],
      dailyLabourEntries: [],
      labourPayments: [],
      contractors: [],
      contractorWorkEntries: [],
      contractorPayments: [],
      journalEntries: [],
      yards: [],
    };
    const ov = computeOwnerBusinessOverview(emptyInput);
    expect(ov.totalBusinessIncome).toBe(0);
    expect(ov.totalBusinessExpenses).toBe(0);
    expect(ov.currentFinancialPosition).toBe(0);
    expect(ov.dataWarnings.length).toBeGreaterThan(0);
  });

  it('filters yard operations and computes salary, labour, and contractor liabilities', () => {
    const opsInput: OwnerReportInput = {
      ...baseInput,
      yards: [
        { id: 'yard-1', code: 'Y1', name: 'Main Yard', locationAddress: 'Ponneri', isActive: true },
        { id: 'yard-2', code: 'Y2', name: 'North Yard', locationAddress: 'Gummidipoondi', isActive: true },
      ],
      purchases: [
        {
          id: 'pur-1',
          companyId: 'comp-1',
          voucherNo: 'PUR-1',
          transactionDate: '2026-11-04',
          supplierPartyId: 'sup-1',
          yardId: 'yard-1',
          totalAmount: 4000,
          amountPaid: 1000,
          outstandingBalance: 3000,
          status: 'PARTIAL',
        } as any,
        {
          id: 'pur-2',
          companyId: 'comp-1',
          voucherNo: 'PUR-2',
          transactionDate: '2026-11-04',
          supplierPartyId: 'sup-2',
          yardId: 'yard-2',
          totalAmount: 9000,
          amountPaid: 9000,
          outstandingBalance: 0,
          status: 'PAID',
        } as any,
      ],
      salaryRecords: [
        { id: 'sal-1', employeeId: 'emp-1', salaryMonth: '2026-11', netSalaryPayable: 12000, amountPaid: 8000, paymentDate: '2026-11-05' } as any,
      ],
      dailyLabourEntries: [
        { id: 'lab-1', workDate: '2026-11-05', totalWage: 1000, amountPaid: 400, remainingBalance: 600 } as any,
      ],
      contractorWorkEntries: [
        { id: 'con-1', contractorId: 'c-1', totalContractAmount: 5000, currentPayment: 2000, remainingBalance: 3000 } as any,
      ],
    };

    const ov = computeOwnerBusinessOverview(opsInput);
    expect(ov.totalSupplierPayables).toBe(3000);
    expect(ov.workerSalaryLiabilities).toBe(7600); // 4000 salary + 600 labour + 3000 contractor

    const y1Summary = computeOwnerPeriodSummary(opsInput, 'MONTHLY', '2026-11-15', undefined, undefined, 'yard-1');
    expect(y1Summary.purchaseSummary.count).toBe(1);
    expect(y1Summary.purchaseSummary.totalAmount).toBe(4000);
    expect(y1Summary.yardSummary).toHaveLength(1);
    expect(y1Summary.yardSummary[0].yardId).toBe('yard-1');
  });

  it('exports UTF-8 BOM CSV and genuine OpenXML .xlsx workbook matching engine figures', () => {
    const csv = generateOwnerReportCsv('Owner Report', ['Date', 'Amount'], [['2026-11-03', 1500]]);
    expect(csv.startsWith('\uFEFFOwner Report')).toBe(true);
    expect(csv).toContain('Date,Amount');

    const ov = computeOwnerBusinessOverview(baseInput, '2026-11-01', '2026-11-30');
    const summary = computeOwnerPeriodSummary(baseInput, 'MONTHLY', '2026-11-15');
    const xlsx = generateOwnerSummaryWorkbook(ov, summary, 'Yashoth Enterprises', 'MONTHLY (2026-11-01 to 2026-11-30)');
    expect(xlsx[0]).toBe(0x50); // 'P'
    expect(xlsx[1]).toBe(0x4b); // 'K'
    const text = Buffer.from(xlsx).toString('utf8');
    expect(text).toContain('Yashoth Enterprises');
    expect(text).toContain('10000');
    expect(text).toContain('1500');
  });
});
