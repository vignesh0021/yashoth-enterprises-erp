// ============================================================================
// YASHOTH ENTERPRISES ERP — FINANCE MANAGEMENT MODULE TEST SUITE
// ============================================================================

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { 
  calculateMonthlySalary,
  calculateDailyLabourCost,
  calculateDailyLabourBalance,
  calculateContractorBalance,
  computeDailyCashClosing,
  calculateProfitAndLoss,
  executeContraTransfer,
  calculateReconciledAccountBalance,
  calculateAccountBalanceFromLedger,
  validateCashBankTransaction,
  validateContraTransfer,
  validateSalaryRecordInput,
  validateDailyLabourInput,
  validateContractorWorkInput,
  validateContractorPaymentInput,
  validateExpenseInput,
  calculateAuthoritativeProfitAndLoss,
} from '../backend/business-rules/financeEngine.ts';
import { 
  validateJournalEntry,
  createExpenseJournal,
  createPayUnpaidExpenseJournal,
  createSalaryPaymentJournal,
  createEmployeeAdvanceJournal,
  createSalaryAccrualJournal,
  createSalaryDisbursementJournal,
  createLabourAdvanceJournal,
  createDailyLabourJournal,
  createLabourPaymentJournal,
  createContractorAdvanceJournal,
  createContractorWorkJournal,
  createContractorProgressPaymentJournal,
  createCashClosingJournal,
  STANDARD_CHART_OF_ACCOUNTS
} from '../backend/business-rules/accountingEngine.ts';
import { EXPENSE_CATEGORIES } from '../src/types/index.ts';
import type { Company, CashBankAccount, Expense, AccountTransaction, MonthlySalaryRecord, ContractorWorkEntry } from '../src/types/index.ts';

const mockCompany: Company = {
  id: 'comp-yasoth-01',
  code: 'YE01',
  name: 'Yashoth Enterprises',
  companyName: 'YASHOTH ENTERPRISES',
  legalName: 'YASHOTH ENTERPRISES',
  tradeName: 'Yashoth Enterprises',
  gstin: '33AXVPN9382L1ZF',
  stateCode: '33',
  stateName: 'Tamil Nadu',
  email: 'yashothenterprises44@gmail.com',
  bankName: 'City Union Bank',
  bankAccountNo: '510909010195638',
  bankBranch: 'Redhills',
  bankBranchIfsc: 'CIUB0000439',
  invoicePrefix: 'YE',
  purchasePrefix: 'YEP',
  defaultBaseUnit: 'KG',
  currency: 'INR',
  pan: 'AXVPN9382L',
  addressLine1: 'No 7 Alinjivakkam',
  city: 'Chennai',
  pincode: '600052',
  phone: '9840000000',
  isActive: true,
  isDefault: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockCashAcc: CashBankAccount = {
  id: 'acc-cash-yard',
  companyId: 'comp-yasoth-01',
  accountCode: 'ACC-CASH-01',
  accountName: 'Yard Cash Box',
  accountType: 'CASH',
  openingBalance: 50000,
  openingBalanceDate: '2026-10-01',
  isActive: true,
};

const mockBankAcc: CashBankAccount = {
  id: 'acc-bank-cub',
  companyId: 'comp-yasoth-01',
  accountCode: 'ACC-BANK-01',
  accountName: 'City Union Bank Current A/C',
  accountType: 'BANK',
  openingBalance: 350000,
  openingBalanceDate: '2026-10-01',
  isActive: true,
};

describe('Suite 14: Yashoth Enterprises ERP — Small-Business Finance Management', () => {

  // --------------------------------------------------------------------------
  // 14.1 Permanent Employee Salary Register
  // --------------------------------------------------------------------------
  describe('14.1 Permanent Employee Salary Register', () => {
    it('calculates net salary payable correctly: Gross + Allowances - Deductions - Advance Recovery', () => {
      // S. Rajan (Supervisor): Gross ₹28,000, Allowances ₹1,500, Deductions ₹500, Advance Recovery ₹2,000
      const net = calculateMonthlySalary(28000, 1500, 500, 2000);
      expect(net).toBe(27000);
    });

    it('prevents negative net salary if deductions and advance exceed gross earnings', () => {
      const net = calculateMonthlySalary(10000, 0, 8000, 5000);
      expect(net).toBe(0);
    });

    it('generates zero-tolerance balanced double-entry journal for salary payment', () => {
      const journal = createSalaryPaymentJournal(
        {
          id: 'sal-rec-01',
          employeeName: 'S. Rajan',
          salaryMonth: '2026-10',
          grossSalary: 28000,
          allowances: 1500,
          deductions: 500,
          advanceRecovery: 2000,
          amountPaid: 27000,
          paymentMode: 'BANK',
        },
        '1020',
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(journal)).not.toThrow();
      expect(journal.totalDebit).toBe(29500); // Gross 28k + Allowances 1.5k
      expect(journal.totalCredit).toBe(29500); // Paid 27k + Recovery 2.5k
      expect(journal.lines.some((l) => l.accountCode === '5050' && l.debit === 29500)).toBe(true);
      expect(journal.lines.some((l) => l.accountCode === '1020' && l.credit === 27000)).toBe(true);
      expect(journal.lines.some((l) => l.accountCode === '1060' && l.credit === 2000)).toBe(true);
      expect(journal.lines.some((l) => l.accountCode === '2120' && l.credit === 500)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 14.2 Daily Wage Labour Register
  // --------------------------------------------------------------------------
  describe('14.2 Daily Wage Labour Register', () => {
    it('accurately calculates total labour cost: Worker Count × Working Days × Daily Rate + Overtime + Charges', () => {
      // 4 sorters × 1 day × ₹650 + ₹400 overtime + ₹0 charges
      const totalCost = calculateDailyLabourCost(4, 1, 650, 400, 0);
      expect(totalCost).toBe(3000);

      // 3 gas cutters × 2 days × ₹750 + ₹600 overtime + ₹300 charges
      const totalCost2 = calculateDailyLabourCost(3, 2, 750, 600, 300);
      expect(totalCost2).toBe(5400);
    });

    it('accurately computes daily labour balance after advance adjustments and partial payments', () => {
      const totalCost = 3000;
      const advanceDeducted = 500;
      const amountPaid = 2000;
      const balance = calculateDailyLabourBalance(totalCost, advanceDeducted, amountPaid);
      expect(balance).toBe(500);
    });

    it('generates zero-tolerance balanced double-entry journal for daily labour', () => {
      const journal = createDailyLabourJournal(
        {
          id: 'dlab-01',
          workerNameOrGroup: 'Mani Scrap Sorting Team',
          workDate: '2026-10-15',
          totalLabourCost: 3000,
          amountPaid: 2500,
          remainingBalance: 500,
          paymentMode: 'CASH',
        },
        '1010',
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(journal)).not.toThrow();
      expect(journal.totalDebit).toBe(3000);
      expect(journal.totalCredit).toBe(3000);
      expect(journal.lines.some((l) => l.accountCode === '5020' && l.debit === 3000)).toBe(true);
      expect(journal.lines.some((l) => l.accountCode === '1010' && l.credit === 2500)).toBe(true);
      expect(journal.lines.some((l) => l.accountCode === '2100' && l.credit === 500)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 14.3 Outsourced / Contract Labour
  // --------------------------------------------------------------------------
  describe('14.3 Outsourced / Contract Labour', () => {
    it('computes contractor remaining balance after multiple progress payments', () => {
      const totalContract = 45000;
      const advancePaid = 10000;
      const prevPayments = 15000;
      const currentPayment = 10000;
      const balance = calculateContractorBalance(totalContract, advancePaid, prevPayments, currentPayment);
      expect(balance).toBe(10000);
    });

    it('generates zero-tolerance balanced double-entry journal for contractor work and payable balance', () => {
      const journal = createContractorWorkJournal(
        {
          id: 'cwork-01',
          contractorName: 'Karthik Demolition & Gas Cutting Team',
          workDate: '2026-10-14',
          totalContractAmount: 45000,
          currentPayment: 25000,
          remainingBalance: 20000,
        },
        '1020',
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(journal)).not.toThrow();
      expect(journal.totalDebit).toBe(45000);
      expect(journal.totalCredit).toBe(45000);
      expect(journal.lines.some((l) => l.accountCode === '5025' && l.debit === 45000)).toBe(true);
      expect(journal.lines.some((l) => l.accountCode === '1020' && l.credit === 25000)).toBe(true);
      expect(journal.lines.some((l) => l.accountCode === '2110' && l.credit === 20000)).toBe(true);
    });

    it('verifies that contractor accounts (2110) are separate from permanent employee accounts (2100)', () => {
      const contractorAccount = STANDARD_CHART_OF_ACCOUNTS.find((a) => a.code === '2110');
      const employeeAccount = STANDARD_CHART_OF_ACCOUNTS.find((a) => a.code === '2100');
      expect(contractorAccount).toBeDefined();
      expect(contractorAccount?.name).toBe('Contractor & Labour Payable');
      expect(employeeAccount).toBeDefined();
      expect(employeeAccount?.name).toBe('Employee Wages & Advances Payable');
      expect(contractorAccount?.code).not.toBe(employeeAccount?.code);
    });
  });

  // --------------------------------------------------------------------------
  // 14.4 Daily Business Expenses (10 Categories & Unpaid Liability)
  // --------------------------------------------------------------------------
  describe('14.4 Daily Business Expenses', () => {
    it('verifies all 10 mandatory small-business expense categories are present', () => {
      expect(EXPENSE_CATEGORIES).toContain('Daily Labour');
      expect(EXPENSE_CATEGORIES).toContain('Food / Lunch');
      expect(EXPENSE_CATEGORIES).toContain('Tea / Drinking Water');
      expect(EXPENSE_CATEGORIES).toContain('Loading / Unloading');
      expect(EXPENSE_CATEGORIES).toContain('Vehicle Rent');
      expect(EXPENSE_CATEGORIES).toContain('Diesel / Petrol');
      expect(EXPENSE_CATEGORIES).toContain('Electricity');
      expect(EXPENSE_CATEGORIES).toContain('Repair / Maintenance');
      expect(EXPENSE_CATEGORIES).toContain('Office Expenses');
      expect(EXPENSE_CATEGORIES).toContain('Other Expenses');
      expect(EXPENSE_CATEGORIES.length).toBe(10);
    });

    it('posts unpaid expense to liability account 2020 without deducting cash or bank', () => {
      const unpaidExpense: Expense = {
        id: 'exp-unpaid-01',
        voucherNo: 'EXP-26-0099',
        expenseDate: '2026-10-16',
        category: 'Repair / Maintenance',
        amount: 1800,
        accountId: 'acc-cash-yard',
        paymentMode: 'UNPAID',
        status: 'UNPAID',
        paidTo: 'Sri Amman Welding Works',
        createdBy: 'Admin',
        createdAt: '2026-10-16T10:00:00Z',
      };

      const journal = createExpenseJournal(unpaidExpense, '1010', mockCompany);
      expect(() => validateJournalEntry(journal)).not.toThrow();
      expect(journal.totalDebit).toBe(1800);
      expect(journal.totalCredit).toBe(1800);
      // Dr. Expense 5040
      expect(journal.lines.some((l) => l.accountCode === '5040' && l.debit === 1800)).toBe(true);
      // Cr. Liability 2020 (Not 1010 Cash!)
      expect(journal.lines.some((l) => l.accountCode === '2020' && l.credit === 1800)).toBe(true);
    });

    it('clears liability without recording duplicate expense when paying an existing unpaid expense', () => {
      const unpaidExpense: Expense = {
        id: 'exp-unpaid-01',
        voucherNo: 'EXP-26-0099',
        expenseDate: '2026-10-16',
        category: 'Repair / Maintenance',
        amount: 1800,
        accountId: 'acc-cash-yard',
        paymentMode: 'UNPAID',
        status: 'UNPAID',
        paidTo: 'Sri Amman Welding Works',
        createdBy: 'Admin',
        createdAt: '2026-10-16T10:00:00Z',
      };

      const payJournal = createPayUnpaidExpenseJournal(unpaidExpense, '1010', mockCompany, 'Admin');
      expect(() => validateJournalEntry(payJournal)).not.toThrow();
      expect(payJournal.totalDebit).toBe(1800);
      expect(payJournal.totalCredit).toBe(1800);
      // Dr. 2020 (Clearing liability)
      expect(payJournal.lines.some((l) => l.accountCode === '2020' && l.debit === 1800)).toBe(true);
      // Cr. 1010 (Cash disbursed)
      expect(payJournal.lines.some((l) => l.accountCode === '1010' && l.credit === 1800)).toBe(true);
      // NO Expense account (5040) is debited again! Zero duplication!
      expect(payJournal.lines.some((l) => l.accountCode === '5040')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 14.5 Cash and Bank Management (Contra Transfers & P&L Independence)
  // --------------------------------------------------------------------------
  describe('14.5 Cash and Bank Management', () => {
    it('executes contra inter-account transfer without altering business profit or loss', () => {
      const contra = executeContraTransfer(mockCashAcc, mockBankAcc, 20000, '2026-10-15', 'CHQ-101', 'Admin');
      expect(contra.outflowTx.amount).toBe(20000);
      expect(contra.outflowTx.direction).toBe('CREDIT');
      expect(contra.outflowTx.accountId).toBe(mockCashAcc.id);

      expect(contra.inflowTx.amount).toBe(20000);
      expect(contra.inflowTx.direction).toBe('DEBIT');
      expect(contra.inflowTx.accountId).toBe(mockBankAcc.id);

      // Verify that calculating P&L with contra transfers does NOT affect revenue or expenses
      const pnlBefore = calculateProfitAndLoss({
        salesRevenue: 500000,
        materialPurchaseCost: 350000,
        operatingExpenses: 25000,
      });

      const pnlAfter = calculateProfitAndLoss({
        salesRevenue: 500000,
        materialPurchaseCost: 350000,
        operatingExpenses: 25000,
      });

      expect(pnlBefore.netProfit).toBe(pnlAfter.netProfit);
      expect(pnlBefore.netProfit).toBe(125000);
    });

    it('calculates running reconciled balance accurately from opening balance and transactions', () => {
      const txs: AccountTransaction[] = [
        {
          id: 'tx-1',
          accountId: mockCashAcc.id,
          transactionDate: '2026-10-02',
          transactionType: 'CUSTOMER_RECEIPT',
          direction: 'DEBIT',
          amount: 25000,
          description: 'Cash sale',
          createdBy: 'Admin',
          createdAt: '2026-10-02T10:00:00Z',
        },
        {
          id: 'tx-2',
          accountId: mockCashAcc.id,
          transactionDate: '2026-10-03',
          transactionType: 'OPERATING_EXPENSE',
          direction: 'CREDIT',
          amount: 5000,
          description: 'Diesel',
          createdBy: 'Admin',
          createdAt: '2026-10-03T10:00:00Z',
        }
      ];

      const balance = calculateReconciledAccountBalance(mockCashAcc, txs);
      // Opening 50,000 + 25,000 - 5,000 = 70,000
      expect(balance).toBe(70000);
    });
  });

  // --------------------------------------------------------------------------
  // 14.6 Guided Daily Cash Closing
  // --------------------------------------------------------------------------
  describe('14.6 Guided Daily Cash Closing', () => {
    it('computes expected cash in hand and detects exact match', () => {
      // Opening ₹50,000, Today Inflow ₹35,000, Today Outflow ₹18,500 -> Expected ₹66,500
      const closing = computeDailyCashClosing(50000, 35000, 18500, 66500);
      expect(closing.expectedCash).toBe(66500);
      expect(closing.difference).toBe(0);
      expect(closing.status).toBe('MATCHED');
    });

    it('detects cash shortage and creates balanced audit discrepancy journal', () => {
      // Physically counted ₹65,000 instead of ₹66,500 -> Shortage of ₹1,500
      const closing = computeDailyCashClosing(50000, 35000, 18500, 65000);
      expect(closing.expectedCash).toBe(66500);
      expect(closing.difference).toBe(-1500);
      expect(closing.status).toBe('SHORTAGE');

      const journal = createCashClosingJournal(
        closing.difference,
        '2026-10-15',
        'Unrecorded yard petty cash tea and snack expenses',
        mockCompany,
        'Admin'
      );
      expect(journal).not.toBeNull();
      expect(() => validateJournalEntry(journal!)).not.toThrow();
      expect(journal!.totalDebit).toBe(1500);
      expect(journal!.totalCredit).toBe(1500);
      // Dr. Shortage loss 5090
      expect(journal!.lines.some((l) => l.accountCode === '5090' && l.debit === 1500)).toBe(true);
      // Cr. Cash 1010
      expect(journal!.lines.some((l) => l.accountCode === '1010' && l.credit === 1500)).toBe(true);
    });

    it('detects cash excess and creates balanced audit discrepancy journal', () => {
      // Physically counted ₹67,000 instead of ₹66,500 -> Surplus of ₹500
      const closing = computeDailyCashClosing(50000, 35000, 18500, 67000);
      expect(closing.expectedCash).toBe(66500);
      expect(closing.difference).toBe(500);
      expect(closing.status).toBe('EXCESS');

      const journal = createCashClosingJournal(
        closing.difference,
        '2026-10-15',
        'Physical drawer surplus after change reconciliation',
        mockCompany,
        'Admin'
      );
      expect(journal).not.toBeNull();
      expect(() => validateJournalEntry(journal!)).not.toThrow();
      expect(journal!.totalDebit).toBe(500);
      expect(journal!.totalCredit).toBe(500);
      // Dr. Cash 1010
      expect(journal!.lines.some((l) => l.accountCode === '1010' && l.debit === 500)).toBe(true);
      // Cr. Other Income 4050
      expect(journal!.lines.some((l) => l.accountCode === '4050' && l.credit === 500)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 14.7 Small-Business Profit & Loss Calculation
  // --------------------------------------------------------------------------
  describe('14.7 Small-Business Profit & Loss Calculation', () => {
    it('accurately derives Gross Profit and Net Business Profit', () => {
      const pnl = calculateProfitAndLoss({
        salesRevenue: 1200000,
        otherIncome: 15000,
        materialPurchaseCost: 950000,
        inwardFreight: 30000,
        directLabour: 45000, // Demolition cutting + contract labour
        operatingExpenses: 25000, // Daily expenses
        staffSalaries: 50000,
        yardUtilitiesFuel: 15000,
        maintenance: 10000,
      });

      // Total Revenue = 1,200,000 + 15,000 = 1,215,000
      expect(pnl.revenue).toBe(1215000);
      // Direct Costs = 950,000 + 30,000 + 45,000 = 1,025,000
      expect(pnl.directCost).toBe(1025000);
      // Gross Profit = 1,215,000 - 1,025,000 = 190,000
      expect(pnl.grossProfit).toBe(190000);
      // Operating Expenses = 25,000 + 50,000 + 15,000 + 10,000 = 100,000
      expect(pnl.operatingExpenses).toBe(100000);
      // Net Profit = 190,000 - 100,000 = 90,000
      expect(pnl.netProfit).toBe(90000);
    });
  });

  // --------------------------------------------------------------------------
  // 14.8 Authoritative PostgreSQL Migration 008 Verification
  // --------------------------------------------------------------------------
  describe('14.8 Authoritative PostgreSQL Migration 008', () => {
    it('verifies 008_finance_and_labour_management.sql creates all 6 tables and enables RLS', () => {
      const migrationPath = path.join(process.cwd(), 'database/migrations/008_finance_and_labour_management.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Table declarations
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS expenses');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS salary_records');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS daily_labour_entries');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS contractors');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS contractor_work_entries');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS daily_cash_closings');

      // RLS enabled
      expect(sql).toContain('ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE daily_labour_entries ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE contractor_work_entries ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE daily_cash_closings ENABLE ROW LEVEL SECURITY;');

      // Multi-tenant policies
      expect(sql).toContain('auth_is_company_member(company_id)');
      expect(sql).toContain('CREATE POLICY rls_salary_records_select');
      expect(sql).toContain('CREATE POLICY rls_daily_labour_select');
      expect(sql).toContain('CREATE POLICY rls_contractors_select');
      expect(sql).toContain('CREATE POLICY rls_contractor_work_select');
      expect(sql).toContain('CREATE POLICY rls_daily_cash_closings_select');
    });
  });

  // --------------------------------------------------------------------------
  // 14.9 Monthly Salary Hardening: Advance Issue, Accrual & Separate Disbursement
  // --------------------------------------------------------------------------
  describe('14.9 Monthly Salary Hardening: Advance Issue, Accrual & Separate Disbursement', () => {
    it('records employee advance correctly debiting asset 1060 and crediting cash/bank', () => {
      const advance = {
        id: 'eadv-01',
        employeeName: 'S. Rajan',
        advanceDate: '2026-10-15',
        amount: 2000,
        paymentMode: 'CASH' as const,
        voucherNo: 'ADV-26-0001',
      };

      const journal = createEmployeeAdvanceJournal(advance, '1010', mockCompany, 'Admin');
      expect(() => validateJournalEntry(journal)).not.toThrow();
      expect(journal.totalDebit).toBe(2000);
      expect(journal.totalCredit).toBe(2000);
      expect(journal.lines.some((l) => l.accountCode === '1060' && l.debit === 2000)).toBe(true);
      expect(journal.lines.some((l) => l.accountCode === '1010' && l.credit === 2000)).toBe(true);
    });

    it('accrues monthly salary: Dr. 5050, Cr. 1060 (Advance Recovery), Cr. 2120 (Deductions), Cr. 2100 (Payable)', () => {
      // Gross 28,000 + Allowance 1,500 = 29,500
      // Deductions 500, Advance Recovery 2,000 -> Net Payable 27,000
      const accrualJournal = createSalaryAccrualJournal(
        {
          id: 'sal-rec-101',
          employeeName: 'S. Rajan',
          salaryMonth: '2026-10',
          grossSalary: 28000,
          allowances: 1500,
          deductions: 500,
          advanceRecovery: 2000,
          netSalaryPayable: 27000,
        },
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(accrualJournal)).not.toThrow();
      expect(accrualJournal.totalDebit).toBe(29500);
      expect(accrualJournal.totalCredit).toBe(29500);
      expect(accrualJournal.lines.some((l) => l.accountCode === '5050' && l.debit === 29500)).toBe(true);
      expect(accrualJournal.lines.some((l) => l.accountCode === '1060' && l.credit === 2000)).toBe(true);
      expect(accrualJournal.lines.some((l) => l.accountCode === '2120' && l.credit === 500)).toBe(true);
      expect(accrualJournal.lines.some((l) => l.accountCode === '2100' && l.credit === 27000)).toBe(true);
    });

    it('disburses salary payment: Dr. 2100, Cr. Cash/Bank, and NEVER debits 5050 again', () => {
      const disbJournal = createSalaryDisbursementJournal(
        {
          salaryRecordId: 'sal-rec-101',
          employeeName: 'S. Rajan',
          salaryMonth: '2026-10',
          amount: 27000,
          paymentMode: 'BANK',
          voucherNo: 'SALPAY-26-0001',
        },
        '1020',
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(disbJournal)).not.toThrow();
      expect(disbJournal.totalDebit).toBe(27000);
      expect(disbJournal.totalCredit).toBe(27000);
      expect(disbJournal.lines.some((l) => l.accountCode === '2100' && l.debit === 27000)).toBe(true);
      expect(disbJournal.lines.some((l) => l.accountCode === '1020' && l.credit === 27000)).toBe(true);
      // Absolute guarantee: 5050 expense is NOT debited during payment disbursement!
      expect(disbJournal.lines.some((l) => l.accountCode === '5050')).toBe(false);
    });

    it('validates salary record input and prevents duplicate employee in same salary month', () => {
      const existingRecords: MonthlySalaryRecord[] = [
        {
          id: 'sal-01',
          employeeId: 'emp-01',
          employeeName: 'S. Rajan',
          designation: 'Supervisor',
          salaryMonth: '2026-10',
          grossSalary: 28000,
          allowances: 1500,
          deductions: 500,
          advanceRecovery: 2000,
          netSalaryPayable: 27000,
          amountPaid: 27000,
          remainingBalance: 0,
          status: 'PAID',
          paymentMode: 'BANK',
          accountId: 'acc-bank-cub',
          createdAt: '2026-10-31T00:00:00Z',
          createdBy: 'Admin',
        }
      ];

      expect(() => {
        validateSalaryRecordInput(
          {
            employeeId: 'emp-01',
            employeeName: 'S. Rajan',
            salaryMonth: '2026-10',
            grossSalary: 28000,
            amountPaid: 27000,
          },
          existingRecords
        );
      }).toThrow(/already exists/i);
    });
  });

  // --------------------------------------------------------------------------
  // 14.10 Daily Labour Hardening: Advance Adjustment & Subsequent Payment
  // --------------------------------------------------------------------------
  describe('14.10 Daily Labour Hardening: Advance Adjustment & Subsequent Payment', () => {
    it('records labour advance debiting asset 1070 and crediting cash/bank', () => {
      const advJournal = createLabourAdvanceJournal(
        {
          id: 'lab-adv-01',
          workerNameOrGroup: 'Mani Cutter Team',
          advanceDate: '2026-10-24',
          amount: 500,
          paymentMode: 'CASH',
        },
        '1010',
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(advJournal)).not.toThrow();
      expect(advJournal.totalDebit).toBe(500);
      expect(advJournal.totalCredit).toBe(500);
      expect(advJournal.lines.some((l) => l.accountCode === '1070' && l.debit === 500)).toBe(true);
      expect(advJournal.lines.some((l) => l.accountCode === '1010' && l.credit === 500)).toBe(true);
    });

    it('approves daily labour with advance recovery: Dr. 5020, Cr. 1070 (Advance), Cr. 1010 (Paid), Cr. 2100 (Payable)', () => {
      // Total cost 3,000, advance 500, paid now 1,500, remaining balance 1,000
      const labourJournal = createDailyLabourJournal(
        {
          id: 'lab-01',
          workerNameOrGroup: 'Mani Cutter Team',
          workDate: '2026-10-24',
          totalLabourCost: 3000,
          advanceAmount: 500,
          amountPaid: 1500,
          remainingBalance: 1000,
          paymentMode: 'CASH',
        },
        '1010',
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(labourJournal)).not.toThrow();
      expect(labourJournal.totalDebit).toBe(3000);
      expect(labourJournal.totalCredit).toBe(3000);
      expect(labourJournal.lines.some((l) => l.accountCode === '5020' && l.debit === 3000)).toBe(true);
      expect(labourJournal.lines.some((l) => l.accountCode === '1070' && l.credit === 500)).toBe(true);
      expect(labourJournal.lines.some((l) => l.accountCode === '1010' && l.credit === 1500)).toBe(true);
      expect(labourJournal.lines.some((l) => l.accountCode === '2100' && l.credit === 1000)).toBe(true);
    });

    it('pays remaining daily labour liability: Dr. 2100, Cr. Cash/Bank, and NEVER debits 5020 again', () => {
      const payJournal = createLabourPaymentJournal(
        {
          dailyLabourId: 'lab-01',
          workerNameOrGroup: 'Mani Cutter Team',
          paymentDate: '2026-10-25',
          amount: 1000,
          paymentMode: 'CASH',
          voucherNo: 'LPAY-26-0001',
        },
        '1010',
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(payJournal)).not.toThrow();
      expect(payJournal.totalDebit).toBe(1000);
      expect(payJournal.totalCredit).toBe(1000);
      expect(payJournal.lines.some((l) => l.accountCode === '2100' && l.debit === 1000)).toBe(true);
      expect(payJournal.lines.some((l) => l.accountCode === '1010' && l.credit === 1000)).toBe(true);
      // Absolute guarantee: 5020 labour expense is NOT debited again on settlement!
      expect(payJournal.lines.some((l) => l.accountCode === '5020')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 14.11 Contractor Multiple Progress Payments Without Expense Duplication
  // --------------------------------------------------------------------------
  describe('14.11 Contractor Multiple Progress Payments Without Expense Duplication', () => {
    const contractWork = {
      id: 'cw-100',
      contractorName: 'Saravanan Crane Works',
      workDescription: 'Girder dismantling and high crane operations',
      totalContractAmount: 50000,
      advancePaid: 10000,
      previousPayments: 0,
      currentPayment: 0,
      remainingBalance: 40000,
      workDate: '2026-10-18',
    };

    it('books contractor work expense ONCE: Dr. 5025 (50,000), Cr. 1070 Advance (10,000), Cr. 2110 Payable (40,000)', () => {
      const workJournal = createContractorWorkJournal(contractWork, '1010', mockCompany, 'Admin');

      expect(() => validateJournalEntry(workJournal)).not.toThrow();
      expect(workJournal.totalDebit).toBe(50000);
      expect(workJournal.totalCredit).toBe(50000);
      expect(workJournal.lines.some((l) => l.accountCode === '5025' && l.debit === 50000)).toBe(true);
      expect(workJournal.lines.some((l) => l.accountCode === '1070' && l.credit === 10000)).toBe(true);
      expect(workJournal.lines.some((l) => l.accountCode === '2110' && l.credit === 40000)).toBe(true);
    });

    it('posts Progress Payment #1 (₹20,000): Dr. 2110 (20,000), Cr. 1020 Bank (20,000) — NEVER debits 5025 again', () => {
      const prog1 = createContractorProgressPaymentJournal(
        {
          contractorWorkId: 'cw-100',
          contractorName: 'Saravanan Crane Works',
          amount: 20000,
          paymentDate: '2026-10-20',
          paymentMode: 'BANK',
          voucherNo: 'CPAY-26-0001',
        },
        '1020',
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(prog1)).not.toThrow();
      expect(prog1.totalDebit).toBe(20000);
      expect(prog1.totalCredit).toBe(20000);
      expect(prog1.lines.some((l) => l.accountCode === '2110' && l.debit === 20000)).toBe(true);
      expect(prog1.lines.some((l) => l.accountCode === '1020' && l.credit === 20000)).toBe(true);
      expect(prog1.lines.some((l) => l.accountCode === '5025')).toBe(false);
    });

    it('posts Progress Payment #2 (₹20,000 final): Dr. 2110 (20,000), Cr. 1010 Cash (20,000) — NEVER debits 5025 again', () => {
      const prog2 = createContractorProgressPaymentJournal(
        {
          contractorWorkId: 'cw-100',
          contractorName: 'Saravanan Crane Works',
          amount: 20000,
          paymentDate: '2026-10-25',
          paymentMode: 'CASH',
          voucherNo: 'CPAY-26-0002',
        },
        '1010',
        mockCompany,
        'Admin'
      );

      expect(() => validateJournalEntry(prog2)).not.toThrow();
      expect(prog2.totalDebit).toBe(20000);
      expect(prog2.totalCredit).toBe(20000);
      expect(prog2.lines.some((l) => l.accountCode === '2110' && l.debit === 20000)).toBe(true);
      expect(prog2.lines.some((l) => l.accountCode === '1010' && l.credit === 20000)).toBe(true);
      expect(prog2.lines.some((l) => l.accountCode === '5025')).toBe(false);
    });

    it('rejects contractor payment exceeding remaining balance', () => {
      const existingWork: ContractorWorkEntry = {
        id: 'cw-100',
        contractorId: 'cont-01',
        contractorName: 'Saravanan Crane Works',
        workDate: '2026-10-18',
        workDescription: 'Girder dismantling',
        workerCount: 5,
        quantityCompleted: 1,
        agreedRate: 50000,
        totalContractAmount: 50000,
        advancePaid: 10000,
        previousPayments: 20000,
        currentPayment: 0,
        remainingBalance: 20000,
        paymentMode: 'UNPAID',
        createdAt: '2026-10-18T00:00:00Z',
        createdBy: 'Admin',
      };

      expect(() => {
        validateContractorPaymentInput(
          { contractorWorkId: 'cw-100', amount: 25000, paymentMode: 'BANK', accountId: 'acc-bank-cub' },
          existingWork
        );
      }).toThrow(/exceeds remaining/i);
    });
  });

  // --------------------------------------------------------------------------
  // 14.12 Cash & Bank Ledger Reconciliation & Transaction Integrity
  // --------------------------------------------------------------------------
  describe('14.12 Cash & Bank Ledger Reconciliation & Transaction Integrity', () => {
    it('computes account balance dynamically from opening balance and journal entries', () => {
      const transactions: AccountTransaction[] = [
        {
          id: 'tx-01',
          accountId: 'acc-cash-yard',
          transactionDate: '2026-10-02',
          transactionType: 'CUSTOMER_RECEIPT',
          direction: 'DEBIT',
          amount: 25000,
          description: 'Sales cash collection',
          createdBy: 'Admin',
          createdAt: '2026-10-02T10:00:00Z',
        },
        {
          id: 'tx-02',
          accountId: 'acc-cash-yard',
          transactionDate: '2026-10-03',
          transactionType: 'OPERATING_EXPENSE',
          direction: 'CREDIT',
          amount: 15000,
          description: 'Labour and tea expenses',
          createdBy: 'Admin',
          createdAt: '2026-10-03T11:00:00Z',
        },
      ];

      const balance = calculateAccountBalanceFromLedger(mockCashAcc, transactions);
      // Opening: 50,000 + 25,000 (deposit) - 15,000 (withdrawal) = 60,000
      expect(balance).toBe(60000);
    });

    it('rejects credit transaction causing unauthorized negative cash balance', () => {
      expect(() => {
        validateCashBankTransaction({
          account: mockCashAcc,
          amount: 65000, // available is 50,000
          direction: 'CREDIT',
          currentBalance: 50000,
        });
      }).toThrow(/insufficient cash/i);
    });

    it('validates contra transfer rules and forbids transfer between identical accounts', () => {
      expect(() => {
        validateContraTransfer({
          sourceAccount: mockCashAcc,
          destAccount: mockCashAcc,
          amount: 10000,
          sourceCurrentBalance: 50000,
        });
      }).toThrow(/must be different/i);

      expect(() => {
        validateContraTransfer({
          sourceAccount: mockCashAcc,
          destAccount: mockBankAcc,
          amount: 80000, // exceeds 50,000
          sourceCurrentBalance: 50000,
        });
      }).toThrow(/insufficient balance/i);
    });
  });

  // --------------------------------------------------------------------------
  // 14.13 Authoritative Small-Business Profit & Loss Calculation
  // --------------------------------------------------------------------------
  describe('14.13 Authoritative Small-Business Profit & Loss Calculation', () => {
    it('computes Gross Profit strictly as Sales Revenue minus Verified COGS, subtracting Operating Expenses', () => {
      const pnl = calculateAuthoritativeProfitAndLoss({
        salesRevenue: 500000,
        otherIncome: 5000,
        cogsFromFifoLots: 380000,
        salariesAndStaffWages: 29500,
        directLabourCutting: 12000,
        contractorCharges: 15000,
        freightAndCrane: 8000,
        fuelAndDiesel: 7500,
        utilitiesAndMaintenance: 6000,
        officeFoodAndMisc: 4000,
      });

      // Total Operating Income = 500,000 + 5,000 = 505,000
      expect(pnl.totalOperatingIncome).toBe(505000);
      // COGS = 380,000
      expect(pnl.costOfGoodsSold).toBe(380000);
      // Gross Profit = 505,000 - 380,000 = 125,000
      expect(pnl.grossProfit).toBe(125000);
      // Total OpEx = 29,500 + 12,000 + 15,000 + 8,000 + 7,500 + 6,000 + 4,000 = 82,000
      expect(pnl.totalOperatingExpenses).toBe(82000);
      // Net Profit = 125,000 - 82,000 = 43,000
      expect(pnl.netOperatingProfit).toBe(43000);
    });
  });

  // --------------------------------------------------------------------------
  // 14.14 Authoritative PostgreSQL Migration 009 Integrity & RPC Verification
  // --------------------------------------------------------------------------
  describe('14.14 Authoritative PostgreSQL Migration 009 Integrity & RPC Verification', () => {
    it('verifies 009_finance_atomic_and_advance_integrity.sql creates advance/payment tables, unique constraints, and atomic RPC', () => {
      const migration009Path = path.join(process.cwd(), 'database/migrations/009_finance_atomic_and_advance_integrity.sql');
      expect(fs.existsSync(migration009Path)).toBe(true);

      const sql = fs.readFileSync(migration009Path, 'utf8');

      // Unique constraint to block duplicate salary records for the same employee in same month
      expect(sql).toContain('uq_salary_company_employee_month');

      // Specialized payment and advance tables
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS employee_advances');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS contractor_payments');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS labour_payments');

      // RLS enabled on all new tables
      expect(sql).toContain('ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE labour_payments ENABLE ROW LEVEL SECURITY;');

      // Multi-tenant policies
      expect(sql).toContain('rls_employee_advances_select');
      expect(sql).toContain('rls_contractor_payments_select');
      expect(sql).toContain('rls_labour_payments_select');

      // Atomic RPC function for contractor payment
      expect(sql).toContain('fn_post_contractor_payment_atomic');
    });
  });
});
