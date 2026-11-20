import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  createAccountTransactionJournal,
  createExpenseJournal,
  createPayUnpaidExpenseJournal,
  createPaymentJournal,
  createReversingJournal,
  generateBalanceSheet,
  generateProfitAndLoss,
  assertPeriodNotClosed,
} from '../backend/business-rules/accountingEngine.ts';
import {
  validateCashBankTransaction,
  postPaymentVoucher,
  computeCashBookSummary,
  assertNoDuplicateTripFreight,
  isOwnerPayrollExcluded,
} from '../backend/business-rules/financeEngine.ts';
import { csvBankImportAdapter } from '../src/services/attachmentService.ts';
import type {
  AccountTransaction,
  CashBankAccount,
  Company,
  Expense,
  Invoice,
  Party,
  PurchaseHeader,
} from '../src/types/index.ts';

const projectRoot = process.cwd();
const readRepo = (rel: string) => fs.readFileSync(path.join(projectRoot, rel), 'utf8');

const testCompany: Company = {
  id: 'comp-test-01',
  code: 'YE-TEST',
  name: 'Yashoth Enterprises',
  companyName: 'Yashoth Enterprises',
  legalName: 'YASHOTH ENTERPRISES',
  gstin: '33AXVPN9382L1ZF',
  pan: 'AXVPN9382L',
  email: 'test@yashoth.in',
  phone: '9999999999',
  addressLine1: '128/40 Ambedkar St',
  city: 'Ponneri',
  stateName: 'Tamil Nadu',
  stateCode: '33',
  pincode: '601206',
  bankName: 'City Union Bank',
  bankAccountNo: '510909010195638',
  bankBranch: 'Ponneri',
  bankBranchIfsc: 'CIUB0000439',
  invoicePrefix: 'YE/',
  purchasePrefix: 'PO/',
  quotationPrefix: 'QT/',
  defaultBaseUnit: 'KG',
  currency: 'INR',
  isActive: true,
  closedPeriodBefore: '2026-09-30',
};

const activeCash: CashBankAccount = {
  id: 'acc-cash-1',
  companyId: 'comp-test-01',
  accountCode: 'CASH-MAIN',
  accountName: 'Business Cash Box',
  accountType: 'CASH',
  openingBalance: 0,
  openingBalanceDate: '2026-10-01',
  isActive: true,
};

const inactiveBank: CashBankAccount = {
  id: 'acc-bank-inactive',
  companyId: 'comp-test-01',
  accountCode: 'BANK-CUB',
  accountName: 'City Union Bank (Inactive)',
  accountType: 'BANK',
  openingBalance: 0,
  openingBalanceDate: '2026-10-01',
  isActive: false,
};

describe('Finance Hardening, Owner-Operator & Receipt Attachment Suite', () => {
  it('posts balanced Owner Capital (3010) without inflating Revenue (4xxx)', () => {
    const je = createAccountTransactionJournal(
      {
        id: 'atx-cap-27k',
        transactionDate: '2026-10-01',
        transactionType: 'OWNER_INJECTION',
        direction: 'DEBIT',
        amount: 27000,
        referenceNo: 'CAP-001',
        description: 'Owner introduced business cash',
      },
      '1010',
      testCompany
    );

    expect(je.totalDebit).toBe(27000);
    expect(je.totalCredit).toBe(27000);
    expect(je.lines.some((l) => l.accountCode === '1010' && l.debit === 27000)).toBe(true);
    expect(je.lines.some((l) => l.accountCode === '3010' && l.credit === 27000)).toBe(true);

    const pnl = generateProfitAndLoss([je], '2026-10-01', '2026-10-31');
    expect(pnl.totalRevenue).toBe(0);
    expect(pnl.netProfit).toBe(0);
  });

  it('posts Owner Drawings (3030) separately from Operating Expenses (5xxx) and reduces Balance Sheet Equity', () => {
    const capJe = createAccountTransactionJournal(
      {
        id: 'atx-cap-1',
        transactionDate: '2026-10-01',
        transactionType: 'OWNER_INJECTION',
        direction: 'DEBIT',
        amount: 27000,
        description: 'Capital',
      },
      '1010',
      testCompany
    );
    const drawJe = createAccountTransactionJournal(
      {
        id: 'atx-draw-1',
        transactionDate: '2026-10-02',
        transactionType: 'OWNER_DRAWING',
        direction: 'CREDIT',
        amount: 5000,
        description: 'Owner personal withdrawal',
      },
      '1010',
      testCompany
    );

    expect(drawJe.lines.some((l) => l.accountCode === '3030' && l.debit === 5000)).toBe(true);
    expect(drawJe.lines.some((l) => l.accountCode === '1010' && l.credit === 5000)).toBe(true);

    const pnl = generateProfitAndLoss([capJe, drawJe], '2026-10-01', '2026-10-31');
    expect(pnl.totalOperatingExpenses).toBe(0);
    expect(pnl.netProfit).toBe(0);

    const bs = generateBalanceSheet([capJe, drawJe], '2026-10-31', pnl.netProfit);
    expect(bs.totalAssets).toBe(22000);
    expect(bs.totalEquity).toBe(22000);
    expect(bs.isBalanced).toBe(true);
  });

  it('handles Paid, Unpaid, One-Time Settlement, Owner Personal (2150), and Reversal expense accounting', () => {
    const paidExp: Expense = {
      id: 'exp-paid-1',
      voucherNo: 'EXP-01',
      expenseDate: '2026-10-05',
      category: 'Tea / Drinking Water',
      amount: 300,
      accountId: activeCash.id,
      paymentMode: 'CASH',
      status: 'PAID',
      paidTo: 'Tea Stall',
      createdBy: 'Admin',
      createdAt: '2026-10-05T10:00:00Z',
    };
    const paidJe = createExpenseJournal(paidExp, '1010', testCompany);
    expect(paidJe.lines.some((l) => l.accountCode === '5070' && l.debit === 300)).toBe(true);
    expect(paidJe.lines.some((l) => l.accountCode === '1010' && l.credit === 300)).toBe(true);

    const unpaidExp: Expense = {
      id: 'exp-unpaid-1',
      voucherNo: 'EXP-02',
      expenseDate: '2026-10-06',
      category: 'Repair / Maintenance',
      amount: 1200,
      accountId: '',
      paymentMode: 'UNPAID',
      status: 'UNPAID',
      paidTo: 'Welder',
      createdBy: 'Admin',
      createdAt: '2026-10-06T10:00:00Z',
    };
    const unpaidJe = createExpenseJournal(unpaidExp, '1010', testCompany);
    expect(unpaidJe.lines.some((l) => l.accountCode === '2020' && l.credit === 1200)).toBe(true);

    const settleJe = createPayUnpaidExpenseJournal(unpaidExp, '1010', testCompany, 'Admin');
    expect(settleJe.lines.some((l) => l.accountCode === '2020' && l.debit === 1200)).toBe(true);
    expect(settleJe.lines.some((l) => l.accountCode === '1010' && l.credit === 1200)).toBe(true);

    const ownerExp: Expense = {
      ...paidExp,
      id: 'exp-owner-1',
      voucherNo: 'EXP-03',
      category: 'Diesel / Petrol',
      amount: 1500,
      paidByType: 'OWNER_PERSONAL',
    };
    const ownerJe = createExpenseJournal(ownerExp, '1010', testCompany);
    expect(ownerJe.lines.some((l) => l.accountCode === '5060' && l.debit === 1500)).toBe(true);
    expect(ownerJe.lines.some((l) => l.accountCode === '2150' && l.credit === 1500)).toBe(true);

    const revJe = createReversingJournal(paidJe, 'Duplicate entry', 'Admin');
    expect(revJe.lines.some((l) => l.accountCode === '1010' && l.debit === 300)).toBe(true);
    expect(revJe.lines.some((l) => l.accountCode === '5070' && l.credit === 300)).toBe(true);
  });

  it('rejects inactive bank accounts and non-COMPLETED (PENDING/FAILED) UPI payments', () => {
    expect(() =>
      validateCashBankTransaction({
        account: inactiveBank,
        amount: 500,
        direction: 'CREDIT',
        currentBalance: 10000,
      })
    ).toThrow(/inactive/i);

    const supplier: Party = {
      id: 'sup-1',
      partyCode: 'SUP-01',
      legalName: 'Raja Scrap',
      partyType: 'SUPPLIER',
      contactPerson: 'Raja',
      phone: '9000000000',
      addressLine1: 'Chennai',
      city: 'Chennai',
      stateName: 'Tamil Nadu',
      stateCode: '33',
      paymentTerms: 'Net 15',
      creditLimit: 100000,
      openingBalance: 0,
      openingBalanceDate: '2026-10-01',
      isActive: true,
    };

    const purchase: PurchaseHeader = {
      id: 'pur-1',
      purchaseNo: 'PO-1',
      transactionDate: '2026-10-05',
      supplierPartyId: 'sup-1',
      sourceType: 'DIRECT_SUPPLIER',
      yardId: 'yard-1',
      weighmentId: 'w-1',
      lines: [],
      subtotalAmount: 5000,
      taxAmount: 0,
      otherCharges: 0,
      totalAmount: 5000,
      amountPaid: 0,
      outstandingBalance: 5000,
      status: 'POSTED',
      createdBy: 'Admin',
      createdAt: '2026-10-05T10:00:00Z',
    };

    expect(() =>
      postPaymentVoucher({
        paymentNo: 'PAY-UPI-FAIL',
        paymentDate: '2026-10-06',
        direction: 'OUTFLOW_PAYMENT',
        party: supplier,
        account: activeCash,
        totalAmount: 5000,
        paymentMethod: 'UPI',
        status: 'FAILED',
        allocations: [{ purchaseHeaderId: 'pur-1', allocatedAmount: 5000 }],
        allInvoices: [] as Invoice[],
        allPurchases: [purchase],
        actor: 'Admin',
      })
    ).toThrow(/FAILED/);

    expect(() =>
      createPaymentJournal(
        {
          id: 'pay-pend',
          paymentNo: 'PAY-UPI-PEND',
          paymentDate: '2026-10-06',
          direction: 'OUTFLOW_PAYMENT',
          partyId: 'sup-1',
          accountId: activeCash.id,
          totalAmount: 1000,
          unallocatedAmount: 0,
          paymentMethod: 'UPI',
          status: 'PENDING',
          allocations: [],
          createdBy: 'Admin',
          createdAt: '2026-10-06T10:00:00Z',
        },
        supplier,
        '1010',
        testCompany
      )
    ).toThrow(/PENDING/);
  });

  it('routes TRANSPORTER payables to 2015, enforces closed periods, duplicate trip freight, and owner payroll exclusion', () => {
    const transporter: Party = {
      id: 'tr-1',
      partyCode: 'TR-01',
      legalName: 'Sri Murugan Transport',
      partyType: 'TRANSPORTER',
      contactPerson: 'Murugan',
      phone: '9888888888',
      addressLine1: 'Ponneri',
      city: 'Ponneri',
      stateName: 'Tamil Nadu',
      stateCode: '33',
      paymentTerms: 'Net 15',
      creditLimit: 100000,
      openingBalance: 0,
      openingBalanceDate: '2026-10-01',
      isActive: true,
    };

    const je = createPaymentJournal(
      {
        id: 'pay-tr-1',
        paymentNo: 'PAY-TR-1',
        paymentDate: '2026-10-07',
        direction: 'OUTFLOW_PAYMENT',
        partyId: 'tr-1',
        beneficiaryPartyId: 'tr-1',
        recipientPersonId: 'person-driver-1',
        authorizationId: 'auth-1',
        accountId: activeCash.id,
        totalAmount: 2500,
        unallocatedAmount: 0,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        allocations: [],
        createdBy: 'Admin',
        createdAt: '2026-10-07T10:00:00Z',
      },
      transporter,
      '1010',
      testCompany
    );
    expect(je.lines.some((l) => l.accountCode === '2015' && l.debit === 2500)).toBe(true);

    expect(() => assertPeriodNotClosed('2026-09-30', testCompany.closedPeriodBefore)).toThrow(/closed/i);

    expect(() =>
      assertNoDuplicateTripFreight({
        tripId: 'trip-1',
        purchaseOtherCharges: 1500,
        existingTripFreightExpenses: [{ tripId: 'trip-1', category: 'Vehicle Rent', status: 'PAID' }],
      })
    ).toThrow(/duplicate 5030 freight/i);

    expect(isOwnerPayrollExcluded({ isOwner: true, payrollEligible: true })).toBe(true);
    expect(isOwnerPayrollExcluded({ isOwner: false, payrollEligible: false })).toBe(true);
    expect(isOwnerPayrollExcluded({ isOwner: false, payrollEligible: true })).toBe(false);
  });

  it('reconciles Cash Book accurately while excluding unpaid expenses from cash outflows', () => {
    const txs: AccountTransaction[] = [
      {
        id: 'tx-1',
        accountId: activeCash.id,
        transactionDate: '2026-10-01',
        transactionType: 'OWNER_INJECTION',
        direction: 'DEBIT',
        amount: 27000,
        description: 'Owner introduced cash',
        createdBy: 'Admin',
        createdAt: '2026-10-01T09:00:00Z',
      },
      {
        id: 'tx-2',
        accountId: activeCash.id,
        transactionDate: '2026-10-02',
        transactionType: 'CUSTOMER_RECEIPT',
        direction: 'DEBIT',
        amount: 8000,
        description: 'Scrap sale receipt',
        createdBy: 'Admin',
        createdAt: '2026-10-02T10:00:00Z',
      },
      {
        id: 'tx-3',
        accountId: activeCash.id,
        transactionDate: '2026-10-02',
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: 1500,
        description: 'Diesel',
        createdBy: 'Admin',
        createdAt: '2026-10-02T12:00:00Z',
      },
      {
        id: 'tx-4',
        accountId: activeCash.id,
        transactionDate: '2026-10-03',
        transactionType: 'OWNER_DRAWING',
        direction: 'CREDIT',
        amount: 2000,
        description: 'Personal drawing',
        createdBy: 'Admin',
        createdAt: '2026-10-03T15:00:00Z',
      },
      {
        id: 'tx-5',
        accountId: activeCash.id,
        transactionDate: '2026-10-04',
        transactionType: 'ACCOUNT_ADJUSTMENT',
        direction: 'DEBIT',
        amount: 500,
        description: 'Expense refund',
        createdBy: 'Admin',
        createdAt: '2026-10-04T11:00:00Z',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'exp-u1',
        voucherNo: 'EXP-U1',
        expenseDate: '2026-10-03',
        category: 'Repair / Maintenance',
        amount: 4500,
        accountId: '',
        paymentMode: 'UNPAID',
        status: 'UNPAID',
        paidTo: 'Mechanic',
        createdBy: 'Admin',
        createdAt: '2026-10-03T16:00:00Z',
      },
    ];

    const summary = computeCashBookSummary({
      cashAccounts: [activeCash],
      accountTransactions: txs,
      expenses,
      startDate: '2026-10-01',
      endDate: '2026-10-07',
    });

    expect(summary.openingCash).toBe(0);
    expect(summary.receipts).toBe(8000);
    expect(summary.capitalAndOtherInflows).toBe(27000);
    expect(summary.paidExpenses).toBe(1500);
    expect(summary.drawings).toBe(2000);
    expect(summary.refunds).toBe(500);
    expect(summary.expectedClosingCash).toBe(32000); // 27000 + 8000 - 1500 - 2000 + 500
    expect(summary.unpaidExpensesCount).toBe(1);
    expect(summary.unpaidExpensesTotal).toBe(4500);
  });

  it('parses future bank statement CSV rows via csvBankImportAdapter', () => {
    const csv = 'ref,date,direction,amount,description,party\nUTR123,2026-10-10,DEBIT,15000,NEFT Scrap Buyer,ABC Steels';
    const parsed = csvBankImportAdapter.parseStatement(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].externalTxRef).toBe('UTR123');
    expect(parsed[0].amount).toBe(15000);
    expect(parsed[0].direction).toBe('DEBIT');
  });

  it('verifies SQL migrations 012/013 and Edge Function security invariants', () => {
    const m12 = readRepo('database/migrations/012_finance_hardening_and_owner_operator.sql');
    expect(m12).toContain('uq_journal_active_source');
    expect(m12).toContain('fn_post_account_transaction_atomic');
    expect(m12).toContain('fn_post_expense_atomic');
    expect(m12).toContain('fn_pay_unpaid_expense_atomic');
    expect(m12).toContain('fn_reverse_expense_atomic');
    expect(m12).toContain('vehicle_trips');
    expect(m12).toContain('payment_authorizations');

    const m13 = readRepo('database/migrations/013_receipt_attachments_and_storage_rls.sql');
    expect(m13).toContain("'PENDING_UPLOAD', 'UPLOAD_FAILED', 'COMMITTED', 'REJECTED', 'EXPIRED'");
    expect(m13).toContain('JOIN vehicles v ON v.id = vd.vehicle_id');
    expect(m13).toContain('FOR UPDATE');
    expect(m13).toContain('erp_receipts_insert_policy');

    const edgeFn = readRepo('supabase/functions/verify-and-commit-attachment/index.ts');
    expect(edgeFn).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(edgeFn).toContain("upload_status: 'REJECTED'");
    expect(edgeFn).toContain("upload_status: 'COMMITTED'");
  });

  it('separates 009 salary/labour/contractor OPERATING_EXPENSE rows into salaryLabourContractorPayments in Cash Book', () => {
    const txs: AccountTransaction[] = [
      {
        id: 'tx-sal',
        accountId: activeCash.id,
        transactionDate: '2026-10-05',
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: 6000,
        description: 'Salary Disbursement: Ravi (2026-10)',
        createdBy: 'Admin',
        createdAt: '2026-10-05T10:00:00Z',
      },
      {
        id: 'tx-lab',
        accountId: activeCash.id,
        transactionDate: '2026-10-05',
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: 1500,
        description: 'Daily Labour Settlement: Crew A',
        createdBy: 'Admin',
        createdAt: '2026-10-05T11:00:00Z',
      },
      {
        id: 'tx-tea',
        accountId: activeCash.id,
        transactionDate: '2026-10-05',
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: 200,
        description: 'Expense: Tea / Drinking Water - Stall',
        createdBy: 'Admin',
        createdAt: '2026-10-05T12:00:00Z',
      },
    ];
    const summary = computeCashBookSummary({
      cashAccounts: [activeCash],
      accountTransactions: txs,
      expenses: [],
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    expect(summary.salaryLabourContractorPayments).toBe(7500);
    expect(summary.paidExpenses).toBe(200);
    expect(summary.expectedClosingCash).toBe(-7700);
  });
});
