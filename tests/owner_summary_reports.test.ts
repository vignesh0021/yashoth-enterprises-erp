import { describe, it, expect } from 'vitest';
import {
  computeOwnerBusinessOverview,
  computeOwnerPeriodSummary,
  getPeriodDateRange,
  generateOwnerReportCsv,
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
  });

  it('computes Daily, Weekly (Mon-Sun), Monthly, Annual ranges and period breakdown', () => {
    expect(getPeriodDateRange('WEEKLY', '2026-11-18')).toEqual({ startDate: '2026-11-16', endDate: '2026-11-22' });
    expect(getPeriodDateRange('ANNUAL', '2026-11-18')).toEqual({ startDate: '2026-11-18'.slice(0, 4) + '-01-01', endDate: '2026-12-31' });

    const summary = computeOwnerPeriodSummary(baseInput, 'MONTHLY', '2026-11-15');
    expect(summary.businessIncome).toBe(10000);
    expect(summary.businessExpenses).toBe(1500);
    expect(summary.expenseByCategory[0]).toEqual({ category: 'Diesel / Petrol', amount: 1500, count: 1 });
    expect(summary.drillDownTransactions).toHaveLength(2);
  });

  it('exports UTF-8 BOM CSV for Excel compatibility', () => {
    const csv = generateOwnerReportCsv('Owner Report', ['Date', 'Amount'], [['2026-11-03', 1500]]);
    expect(csv.startsWith('\uFEFFOwner Report')).toBe(true);
    expect(csv).toContain('Date,Amount');
  });
});
