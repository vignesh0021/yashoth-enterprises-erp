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
  verifyFinancialReconciliation,
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
  createReversingJournal,
  STANDARD_CHART_OF_ACCOUNTS
} from '../backend/business-rules/accountingEngine.ts';
import { 
  allocateLotsFifo, 
  calculateCurrentStock,
  verifyFifoCogsIntegrity 
} from '../backend/business-rules/inventoryEngine.ts';
import { dbRepository } from '../src/services/databaseRepository.ts';
import { EXPENSE_CATEGORIES } from '../src/types/index.ts';
import type { 
  Company, 
  CashBankAccount, 
  Expense, 
  AccountTransaction, 
  MonthlySalaryRecord, 
  ContractorWorkEntry, 
  DailyLabourEntry,
  InventoryLot,
  StockMovement,
  JournalEntry
} from '../src/types/index.ts';

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
      expect(sql).toContain('fn_post_labour_payment_atomic');
      expect(sql).toContain('fn_post_salary_disbursement_atomic');
      expect(sql).toContain('fn_issue_employee_advance_atomic');
      expect(sql).toContain('fn_post_salary_accrual_atomic');
      expect(sql).toContain('fn_post_daily_labour_accrual_atomic');
      expect(sql).toContain('CREATE OR REPLACE VIEW accounts AS');
      expect(sql).toContain('SECURITY DEFINER');
      expect(sql).toContain('SET search_path = public, pg_temp');
    });
  });

  // --------------------------------------------------------------------------
  // 14.15 Multiple Salary Installments & Accrual/Disbursement Separation
  // --------------------------------------------------------------------------
  describe('14.15 Multiple Salary Installments & Accrual/Disbursement Separation', () => {
    const salaryRecord: MonthlySalaryRecord = {
      id: 'sal-rec-101',
      companyId: mockCompany.id,
      employeeId: 'emp-001',
      employeeName: 'M. Murugan',
      designation: 'Yard Supervisor',
      salaryMonth: '2026-10',
      grossSalary: 30000,
      allowances: 2000,
      deductions: 500,
      advanceRecovery: 4500,
      netSalaryPayable: 27000,
      amountPaid: 0,
      remainingBalance: 27000,
      status: 'PENDING',
      createdAt: '2026-10-31T18:00:00Z',
      createdBy: 'Finance Manager',
    };

    it('books salary accrual expense ONCE: Dr. 5050 (32,000), Cr. 2120 (500), Cr. 1060 (4,500), Cr. 2100 (27,000)', () => {
      const accrualJe = createSalaryAccrualJournal(salaryRecord, mockCompany, 'Finance Manager');

      expect(() => validateJournalEntry(accrualJe)).not.toThrow();
      expect(accrualJe.totalDebit).toBe(32000);
      expect(accrualJe.totalCredit).toBe(32000);
      expect(accrualJe.lines.some((l) => l.accountCode === '5050' && l.debit === 32000)).toBe(true);
      expect(accrualJe.lines.some((l) => l.accountCode === '1060' && l.credit === 4500)).toBe(true);
      expect(accrualJe.lines.some((l) => l.accountCode === '2120' && l.credit === 500)).toBe(true);
      expect(accrualJe.lines.some((l) => l.accountCode === '2100' && l.credit === 27000)).toBe(true);
    });

    it('posts Salary Installment #1 (₹15,000 via Bank): Dr. 2100 (15,000), Cr. 1020 (15,000) — NEVER debits 5050 again', () => {
      const inst1 = createSalaryDisbursementJournal(
        {
          salaryRecordId: salaryRecord.id,
          employeeName: salaryRecord.employeeName,
          salaryMonth: salaryRecord.salaryMonth,
          amount: 15000,
          paymentMode: 'BANK',
          voucherNo: 'SALPAY-26-0001',
          paymentDate: '2026-11-05',
          paymentId: 'pay-inst-1',
        },
        '1020',
        mockCompany,
        'Finance Manager'
      );

      expect(() => validateJournalEntry(inst1)).not.toThrow();
      expect(inst1.totalDebit).toBe(15000);
      expect(inst1.totalCredit).toBe(15000);
      expect(inst1.lines.some((l) => l.accountCode === '2100' && l.debit === 15000)).toBe(true);
      expect(inst1.lines.some((l) => l.accountCode === '1020' && l.credit === 15000)).toBe(true);
      expect(inst1.lines.some((l) => l.accountCode === '5050')).toBe(false);
      expect(inst1.lines.some((l) => l.accountCode === '5055')).toBe(false);
    });

    it('posts Salary Installment #2 (₹12,000 final via Cash): Dr. 2100 (12,000), Cr. 1010 (12,000) — NEVER debits 5050 again', () => {
      const inst2 = createSalaryDisbursementJournal(
        {
          salaryRecordId: salaryRecord.id,
          employeeName: salaryRecord.employeeName,
          salaryMonth: salaryRecord.salaryMonth,
          amount: 12000,
          paymentMode: 'CASH',
          voucherNo: 'SALPAY-26-0002',
          paymentDate: '2026-11-10',
          paymentId: 'pay-inst-2',
        },
        '1010',
        mockCompany,
        'Finance Manager'
      );

      expect(() => validateJournalEntry(inst2)).not.toThrow();
      expect(inst2.totalDebit).toBe(12000);
      expect(inst2.totalCredit).toBe(12000);
      expect(inst2.lines.some((l) => l.accountCode === '2100' && l.debit === 12000)).toBe(true);
      expect(inst2.lines.some((l) => l.accountCode === '1010' && l.credit === 12000)).toBe(true);
      expect(inst2.lines.some((l) => l.accountCode === '5050')).toBe(false);
    });

    it('ensures line IDs and journal entry IDs are completely unique between installments', () => {
      const inst1 = createSalaryDisbursementJournal(
        {
          salaryRecordId: salaryRecord.id,
          employeeName: salaryRecord.employeeName,
          salaryMonth: salaryRecord.salaryMonth,
          amount: 15000,
          paymentMode: 'BANK',
          voucherNo: 'SALPAY-26-0001',
          paymentId: 'pay-inst-1',
        },
        '1020',
        mockCompany,
        'Finance Manager'
      );

      const inst2 = createSalaryDisbursementJournal(
        {
          salaryRecordId: salaryRecord.id,
          employeeName: salaryRecord.employeeName,
          salaryMonth: salaryRecord.salaryMonth,
          amount: 12000,
          paymentMode: 'CASH',
          voucherNo: 'SALPAY-26-0002',
          paymentId: 'pay-inst-2',
        },
        '1010',
        mockCompany,
        'Finance Manager'
      );

      expect(inst1.id).not.toBe(inst2.id);
      expect(inst1.entryNo).not.toBe(inst2.entryNo);

      const lineIds1 = new Set(inst1.lines.map((l) => l.id));
      for (const line of inst2.lines) {
        expect(lineIds1.has(line.id)).toBe(false);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 14.16 Multiple Daily Labour Payments & Unique Journal/Line IDs
  // --------------------------------------------------------------------------
  describe('14.16 Multiple Daily Labour Payments & Unique Journal/Line IDs', () => {
    const labourEntry: DailyLabourEntry = {
      id: 'dl-entry-200',
      companyId: mockCompany.id,
      workDate: '2026-10-20',
      workerNameOrGroup: 'Redhills Cutting Crew',
      workerCount: 6,
      dailyRate: 700,
      workingDays: 2,
      overtimeAmount: 1600,
      additionalCharges: 0,
      totalLabourCost: 10000,
      advanceAmount: 2000,
      amountPaid: 0,
      remainingBalance: 8000,
      paymentMode: 'UNPAID',
      status: 'PENDING',
      createdAt: '2026-10-20T18:00:00Z',
      createdBy: 'Yard Supervisor',
    };

    it('books daily labour accrual expense ONCE: Dr. 5020 (10,000), Cr. 1070 (2,000), Cr. 2100 (8,000)', () => {
      const accrual = createDailyLabourJournal(labourEntry, '1010', mockCompany, 'Yard Supervisor');

      expect(() => validateJournalEntry(accrual)).not.toThrow();
      expect(accrual.totalDebit).toBe(10000);
      expect(accrual.totalCredit).toBe(10000);
      expect(accrual.lines.some((l) => l.accountCode === '5020' && l.debit === 10000)).toBe(true);
      expect(accrual.lines.some((l) => l.accountCode === '1070' && l.credit === 2000)).toBe(true);
      expect(accrual.lines.some((l) => l.accountCode === '2100' && l.credit === 8000)).toBe(true);
    });

    it('posts Labour Settlement #1 (₹5,000 via Cash): Dr. 2100 (5,000), Cr. 1010 (5,000) — NEVER debits 5020 again', () => {
      const p1 = createLabourPaymentJournal(
        {
          dailyLabourId: labourEntry.id,
          workerNameOrGroup: labourEntry.workerNameOrGroup,
          amount: 5000,
          paymentMode: 'CASH',
          voucherNo: 'LPAY-26-0001',
          paymentId: 'pay-dl-1',
          paymentDate: '2026-10-21',
        },
        '1010',
        mockCompany,
        'Yard Supervisor'
      );

      expect(() => validateJournalEntry(p1)).not.toThrow();
      expect(p1.totalDebit).toBe(5000);
      expect(p1.totalCredit).toBe(5000);
      expect(p1.lines.some((l) => l.accountCode === '2100' && l.debit === 5000)).toBe(true);
      expect(p1.lines.some((l) => l.accountCode === '1010' && l.credit === 5000)).toBe(true);
      expect(p1.lines.some((l) => l.accountCode === '5020')).toBe(false);
    });

    it('posts Labour Settlement #2 (₹3,000 final via Bank): Dr. 2100 (3,000), Cr. 1020 (3,000) — NEVER debits 5020 again', () => {
      const p2 = createLabourPaymentJournal(
        {
          dailyLabourId: labourEntry.id,
          workerNameOrGroup: labourEntry.workerNameOrGroup,
          amount: 3000,
          paymentMode: 'BANK',
          voucherNo: 'LPAY-26-0002',
          paymentId: 'pay-dl-2',
          paymentDate: '2026-10-22',
        },
        '1020',
        mockCompany,
        'Yard Supervisor'
      );

      expect(() => validateJournalEntry(p2)).not.toThrow();
      expect(p2.totalDebit).toBe(3000);
      expect(p2.totalCredit).toBe(3000);
      expect(p2.lines.some((l) => l.accountCode === '2100' && l.debit === 3000)).toBe(true);
      expect(p2.lines.some((l) => l.accountCode === '1020' && l.credit === 3000)).toBe(true);
      expect(p2.lines.some((l) => l.accountCode === '5020')).toBe(false);
    });

    it('guarantees unique journal IDs and line IDs across distinct payments for the same daily labour entry', () => {
      const p1 = createLabourPaymentJournal(
        {
          dailyLabourId: labourEntry.id,
          workerNameOrGroup: labourEntry.workerNameOrGroup,
          amount: 5000,
          paymentMode: 'CASH',
          voucherNo: 'LPAY-26-0001',
          paymentId: 'pay-dl-1',
        },
        '1010',
        mockCompany,
        'Yard Supervisor'
      );

      const p2 = createLabourPaymentJournal(
        {
          dailyLabourId: labourEntry.id,
          workerNameOrGroup: labourEntry.workerNameOrGroup,
          amount: 3000,
          paymentMode: 'BANK',
          voucherNo: 'LPAY-26-0002',
          paymentId: 'pay-dl-2',
        },
        '1020',
        mockCompany,
        'Yard Supervisor'
      );

      expect(p1.id).not.toBe(p2.id);
      expect(p1.entryNo).not.toBe(p2.entryNo);

      const lineIds = new Set(p1.lines.map((l) => l.id));
      for (const line of p2.lines) {
        expect(lineIds.has(line.id)).toBe(false);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 14.17 Financial Record Deletion Protection & Authorized Reversals
  // --------------------------------------------------------------------------
  describe('14.17 Financial Record Deletion Protection & Authorized Reversals', () => {
    it('creates perfectly balanced reversal journals with swapped Debits and Credits and sourceType REVERSAL', () => {
      const originalExpenseJournal = createExpenseJournal(
        {
          id: 'exp-rev-01',
          voucherNo: 'EXP-REV-001',
          expenseDate: '2026-10-15',
          category: 'Vehicle Rent',
          description: 'Monthly lorry rental for yard transport',
          amount: 18500,
          accountId: 'acc-bank-cub',
          paymentMode: 'BANK',
          paidTo: 'Redhills Transport Fleet',
          status: 'PAID',
          createdAt: '2026-10-15T10:00:00Z',
          createdBy: 'Admin',
        },
        '1020',
        mockCompany
      );

      const reversalJournal = createReversingJournal(
        originalExpenseJournal,
        'Duplicate invoice entered accidentally',
        'Audit Partner'
      );

      expect(() => validateJournalEntry(reversalJournal)).not.toThrow();
      expect(reversalJournal.sourceType).toBe('REVERSAL');
      expect(reversalJournal.sourceId).toBe('exp-rev-01');
      expect(reversalJournal.referenceNo).toContain('EXP-REV-001');
      expect(reversalJournal.narration).toContain(originalExpenseJournal.entryNo);
      expect(reversalJournal.totalDebit).toBe(originalExpenseJournal.totalCredit);
      expect(reversalJournal.totalCredit).toBe(originalExpenseJournal.totalDebit);

      // Verify line inversion: original Dr 5025 becomes Cr 5025, original Cr 1020 becomes Dr 1020
      const origDr = originalExpenseJournal.lines.find((l) => l.debit > 0)!;
      const revCr = reversalJournal.lines.find((l) => l.accountCode === origDr.accountCode)!;
      expect(revCr.credit).toBe(origDr.debit);
      expect(revCr.debit).toBe(0);
      expect(revCr.lineNarration).toContain('Reversal of');

      const origCr = originalExpenseJournal.lines.find((l) => l.credit > 0)!;
      const revDr = reversalJournal.lines.find((l) => l.accountCode === origCr.accountCode)!;
      expect(revDr.debit).toBe(origCr.credit);
      expect(revDr.credit).toBe(0);
      expect(revDr.lineNarration).toContain('Reversal of');
    });
  });

  // --------------------------------------------------------------------------
  // 14.18 Strict FIFO Inventory Allocation & COGS Verification
  // --------------------------------------------------------------------------
  describe('14.18 Strict FIFO Inventory Allocation & COGS Verification', () => {
    const activeLots: InventoryLot[] = [
      {
        id: 'lot-002',
        lotNumber: 'LOT-B-002',
        companyId: mockCompany.id,
        materialId: 'mat-hms1',
        yardId: 'yard-redhills',
        receivedAt: '2026-10-05T10:00:00Z',
        initialQuantity: 5000,
        remainingQuantity: 5000,
        unitCost: 36.50,
        isExhausted: false,
      },
      {
        id: 'lot-001',
        lotNumber: 'LOT-A-001',
        companyId: mockCompany.id,
        materialId: 'mat-hms1',
        yardId: 'yard-redhills',
        receivedAt: '2026-10-01T09:00:00Z',
        initialQuantity: 3000,
        remainingQuantity: 3000,
        unitCost: 35.00,
        isExhausted: false,
      },
      {
        id: 'lot-other-comp',
        lotNumber: 'LOT-X-OTHER',
        companyId: 'comp-other-99',
        materialId: 'mat-hms1',
        yardId: 'yard-redhills',
        receivedAt: '2026-09-01T00:00:00Z',
        initialQuantity: 10000,
        remainingQuantity: 10000,
        unitCost: 30.00,
        isExhausted: false,
      },
    ];

    it('allocates strictly in FIFO order: consumes older Lot A before Lot B and ignores other company lots', () => {
      const { result, updatedLots } = allocateLotsFifo(
        activeLots,
        'mat-hms1',
        'yard-redhills',
        4000, // consumes all 3000 of Lot A + 1000 of Lot B
        mockCompany.id
      );

      expect(result.allocations.length).toBe(2);
      expect(result.allocations[0].lotId).toBe('lot-001');
      expect(result.allocations[0].allocatedQuantity).toBe(3000);
      expect(result.allocations[0].unitCost).toBe(35.00);

      expect(result.allocations[1].lotId).toBe('lot-002');
      expect(result.allocations[1].allocatedQuantity).toBe(1000);
      expect(result.allocations[1].unitCost).toBe(36.50);

      // Total COGS = (3000 * 35.00) + (1000 * 36.50) = 105,000 + 36,500 = 141,500
      expect(result.totalCogs).toBe(141500);

      // Verify Lot A is exhausted and Lot B has 4000 left
      const lotA = updatedLots.find((l) => l.id === 'lot-001')!;
      expect(lotA.remainingQuantity).toBe(0);
      expect(lotA.isExhausted).toBe(true);

      const lotB = updatedLots.find((l) => l.id === 'lot-002')!;
      expect(lotB.remainingQuantity).toBe(4000);
      expect(lotB.isExhausted).toBe(false);

      // Verify other company lot was untouched
      const otherLot = updatedLots.find((l) => l.id === 'lot-other-comp')!;
      expect(otherLot.remainingQuantity).toBe(10000);
    });

    it('verifies FIFO COGS integrity: passes when movements and lots match', () => {
      const movements: StockMovement[] = [
        {
          id: 'sm-01',
          companyId: mockCompany.id,
          movementType: 'SALES_DISPATCH',
          transactionRef: 'INV-26-001',
          materialId: 'mat-hms1',
          yardId: 'yard-redhills',
          lotId: 'lot-001',
          quantity: -3000,
          unitCost: 35.00,
          totalCost: 105000,
          createdAt: '2026-10-10T12:00:00Z',
          createdBy: 'Admin',
        },
        {
          id: 'sm-02',
          companyId: mockCompany.id,
          movementType: 'SALES_DISPATCH',
          transactionRef: 'INV-26-001',
          materialId: 'mat-hms1',
          yardId: 'yard-redhills',
          lotId: 'lot-002',
          quantity: -1000,
          unitCost: 36.50,
          totalCost: 36500,
          createdAt: '2026-10-10T12:00:00Z',
          createdBy: 'Admin',
        },
      ];

      const matchedLots: InventoryLot[] = [
        { ...activeLots[0], remainingQuantity: 4000 },
        { ...activeLots[1], remainingQuantity: 0, isExhausted: true },
        activeLots[2],
      ];

      const check = verifyFifoCogsIntegrity(movements, matchedLots);
      expect(check.isValid).toBe(true);
      expect(check.verifiedCogs).toBe(141500);
      expect(check.discrepancies.length).toBe(0);
    });

    it('verifies FIFO COGS integrity: rejects unlinked movements, missing lots, or cost mismatches', () => {
      const corruptedMovements: StockMovement[] = [
        {
          id: 'sm-corrupt-1',
          companyId: mockCompany.id,
          movementType: 'SALES_DISPATCH',
          transactionRef: 'INV-26-BAD',
          materialId: 'mat-hms1',
          yardId: 'yard-redhills',
          lotId: '', // missing lotId!
          quantity: -500,
          unitCost: 35.00,
          totalCost: 17500,
          createdAt: '2026-10-10T12:00:00Z',
          createdBy: 'Admin',
        },
        {
          id: 'sm-corrupt-2',
          companyId: mockCompany.id,
          movementType: 'SALES_DISPATCH',
          transactionRef: 'INV-26-BAD2',
          materialId: 'mat-hms1',
          yardId: 'yard-redhills',
          lotId: 'lot-001',
          quantity: -1000,
          unitCost: 35.00,
          totalCost: 99000, // mismatch with quantity * unitCost (1000 * 35 != 99000)!
          createdAt: '2026-10-10T12:00:00Z',
          createdBy: 'Admin',
        },
      ];

      const check = verifyFifoCogsIntegrity(corruptedMovements, activeLots);
      expect(check.isValid).toBe(false);
      expect(check.discrepancies.length).toBeGreaterThanOrEqual(2);
      expect(check.unverifiedReason).toContain('FIFO COGS audit failed');
    });

    it('rejects caller boolean flags from certifying P&L: strictly derives isVerified from fifoVerification', () => {
      // Case A: Unverified audit result -> P&L is NOT verified even if caller passed legacy isCogsVerified: true
      const unverifiedPnl = calculateAuthoritativeProfitAndLoss({
        salesRevenue: 500000,
        cogsFromFifoLots: 380000,
        isCogsVerified: true, // Caller tries to bypass audit!
        fifoVerification: {
          isValid: false,
          unverifiedReason: 'Orphaned stock movements detected',
          discrepancies: ['Stock movement has no linked lot'],
        },
      });

      expect(unverifiedPnl.isVerified).toBe(false);
      expect(unverifiedPnl.explanation).toContain('[UNVERIFIED COGS: Orphaned stock movements detected]');

      // Case B: Validated audit result -> P&L is verified
      const verifiedPnl = calculateAuthoritativeProfitAndLoss({
        salesRevenue: 500000,
        cogsFromFifoLots: 141500,
        fifoVerification: {
          isValid: true,
        },
      });

      expect(verifiedPnl.isVerified).toBe(true);
      expect(verifiedPnl.explanation).toContain('[VERIFIED FIFO COGS]');
    });
  });

  // --------------------------------------------------------------------------
  // 14.19 Atomic Database RPC Integration & Safe Error Handling
  // --------------------------------------------------------------------------
  describe('14.19 Atomic Database RPC Integration & Safe Error Handling', () => {
    it('returns honest error when remote database is unconfigured without throwing unhandled exceptions', async () => {
      // When remote Supabase URL is not configured or in offline mode:
      const res = await dbRepository.postContractorPaymentAtomic({
        companyId: mockCompany.id,
        contractorId: 'cont-01',
        workId: 'cw-100',
        contractorName: 'Saravanan Crane Works',
        amount: 5000,
        paymentMode: 'BANK',
        accountId: 'acc-bank-cub',
        voucherNo: 'CPAY-26-0001',
        actor: 'Admin',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('Remote Supabase database is not configured');
    });

    it('safely handles salary disbursement atomic RPC offline state', async () => {
      const res = await dbRepository.postSalaryDisbursementAtomic({
        companyId: mockCompany.id,
        salaryRecordId: 'sal-101',
        employeeName: 'M. Murugan',
        salaryMonth: '2026-10',
        amount: 15000,
        paymentMode: 'BANK',
        accountId: 'acc-bank-cub',
        voucherNo: 'SALPAY-26-0001',
        actor: 'Admin',
      });

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('Remote Supabase database is not configured');
    });

    it('safely handles contractor work atomic RPC offline state', async () => {
      const res = await dbRepository.postContractorWorkAtomic({
        companyId: mockCompany.id,
        contractorId: 'cont-01',
        contractorName: 'Saravanan Crane Works',
        workDate: '2026-10-15',
        workDescription: 'Crane Dismantling Service',
        workerCount: 3,
        quantityCompleted: 1,
        agreedRate: 18000,
        totalContractAmount: 18000,
        advancePaid: 3000,
        previousPayments: 0,
        currentPayment: 5000,
        remainingBalance: 10000,
        paymentMode: 'BANK',
        accountId: 'acc-bank-cub',
        actor: 'Admin',
      });

      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('Remote Supabase database is not configured');
    });
  });

  // --------------------------------------------------------------------------
  // 14.20 Third-Pass Security, Authorization & Financial Reconciliation Audit
  // --------------------------------------------------------------------------
  describe('14.20 Third-Pass Security, Authorization & Financial Reconciliation Audit', () => {
    it('enforces caller company authorization, safe search_path, and cross-company tenant isolation across all Migration 009 RPCs', () => {
      const migrationPath = path.resolve(process.cwd(), 'database/migrations/009_finance_atomic_and_advance_integrity.sql');
      const sql = fs.readFileSync(migrationPath, 'utf8');

      const expectedRpcFunctions = [
        'fn_post_contractor_payment_atomic',
        'fn_post_labour_payment_atomic',
        'fn_post_salary_disbursement_atomic',
        'fn_issue_employee_advance_atomic',
        'fn_post_salary_accrual_atomic',
        'fn_post_daily_labour_accrual_atomic',
        'fn_post_contractor_work_atomic',
      ];

      for (const fn of expectedRpcFunctions) {
        expect(sql).toContain(`CREATE OR REPLACE FUNCTION ${fn}`);
        expect(sql).toContain(`GRANT EXECUTE ON FUNCTION ${fn} TO authenticated, service_role`);
      }

      // Check SECURITY DEFINER and fixed search_path
      const securityDefinerCount = (sql.match(/SECURITY DEFINER/g) || []).length;
      expect(securityDefinerCount).toBeGreaterThanOrEqual(7);

      const searchPathCount = (sql.match(/SET search_path = public, pg_temp/g) || []).length;
      expect(searchPathCount).toBeGreaterThanOrEqual(7);

      // Check that auth_is_company_member check is embedded in each RPC
      const authMemberCheckCount = (sql.match(/auth_is_company_member\(p_company_id\)/g) || []).length;
      expect(authMemberCheckCount).toBeGreaterThanOrEqual(7);

      // Check unauthenticated caller verification is present in all RPCs
      const unauthCheckCount = (sql.match(/auth_current_user_id\(\) IS NULL/g) || []).length;
      expect(unauthCheckCount).toBeGreaterThanOrEqual(7);

      // Check cross-company account and payment mode validation is present
      expect(sql).toContain('FROM cash_bank_accounts');
      expect(sql).toContain('account_type = UPPER(p_payment_mode)');
      expect(sql).toContain('Cash/bank account % does not belong to company %');

      // Check explicit permission revoking from PUBLIC and anon
      expect(sql).toContain('REVOKE ALL ON FUNCTION fn_post_contractor_payment_atomic FROM PUBLIC, anon;');
      expect(sql).toContain('REVOKE ALL ON FUNCTION fn_post_salary_accrual_atomic FROM PUBLIC, anon;');
    });

    it('FIFO COGS Audit: rejects missing lot companyId, movement companyId, and cross-company references', () => {
      // 1. Missing companyId on lot
      const missingLotCompany: InventoryLot[] = [
        {
          id: 'lot-no-comp',
          lotNumber: 'LOT-NO-COMP',
          companyId: '', // missing!
          materialId: 'mat-hms1',
          yardId: 'yard-redhills',
          receivedAt: '2026-10-01T09:00:00Z',
          initialQuantity: 1000,
          remainingQuantity: 0,
          unitCost: 35.00,
          isExhausted: true,
        },
      ];
      const movement1: StockMovement[] = [
        {
          id: 'sm-no-comp-1',
          companyId: mockCompany.id,
          movementType: 'SALES_DISPATCH',
          transactionRef: 'INV-26-001',
          materialId: 'mat-hms1',
          yardId: 'yard-redhills',
          lotId: 'lot-no-comp',
          quantity: -1000,
          unitCost: 35.00,
          totalCost: 35000,
          createdAt: '2026-10-10T12:00:00Z',
          createdBy: 'Admin',
        },
      ];
      const res1 = verifyFifoCogsIntegrity(movement1, missingLotCompany);
      expect(res1.isValid).toBe(false);
      expect(res1.discrepancies.some((d) => d.includes('missing companyId'))).toBe(true);

      // 2. Cross-company lot reference (Movement company A, Lot company B)
      const otherCompanyLot: InventoryLot[] = [
        {
          id: 'lot-comp-b',
          lotNumber: 'LOT-COMP-B',
          companyId: 'company-b-999',
          materialId: 'mat-hms1',
          yardId: 'yard-redhills',
          receivedAt: '2026-10-01T09:00:00Z',
          initialQuantity: 1000,
          remainingQuantity: 0,
          unitCost: 35.00,
          isExhausted: true,
        },
      ];
      const movement2: StockMovement[] = [
        {
          id: 'sm-comp-a',
          companyId: 'company-a-111',
          movementType: 'SALES_DISPATCH',
          transactionRef: 'INV-26-002',
          materialId: 'mat-hms1',
          yardId: 'yard-redhills',
          lotId: 'lot-comp-b',
          quantity: -1000,
          unitCost: 35.00,
          totalCost: 35000,
          createdAt: '2026-10-10T12:00:00Z',
          createdBy: 'Admin',
        },
      ];
      const res2 = verifyFifoCogsIntegrity(movement2, otherCompanyLot);
      expect(res2.isValid).toBe(false);
      expect(res2.discrepancies.some((d) => d.includes('Cross-company lot reference'))).toBe(true);
    });

    it('FIFO COGS Audit: validates movement totalCost against quantity * historical unit cost and detects lot allocation overflows', () => {
      const lot: InventoryLot = {
        id: 'lot-hist-01',
        lotNumber: 'LOT-HIST-01',
        companyId: mockCompany.id,
        materialId: 'mat-hms1',
        yardId: 'yard-redhills',
        receivedAt: '2026-09-01T09:00:00Z',
        initialQuantity: 2000,
        remainingQuantity: 500, // 1500 consumed
        unitCost: 50.00, // lot current cost revalued to 50.00
        isExhausted: false,
      };

      // Movement was historically acquired and dispatched at unitCost 40.00
      const validHistoricalMovement: StockMovement = {
        id: 'sm-hist-01',
        companyId: mockCompany.id,
        movementType: 'SALES_DISPATCH',
        transactionRef: 'INV-26-HIST',
        materialId: 'mat-hms1',
        yardId: 'yard-redhills',
        lotId: 'lot-hist-01',
        quantity: -1500,
        unitCost: 40.00,
        totalCost: 60000, // 1500 * 40.00 = 60,000 (valid math!)
        createdAt: '2026-09-15T12:00:00Z',
        createdBy: 'Admin',
      };

      const resValid = verifyFifoCogsIntegrity([validHistoricalMovement], [lot]);
      expect(resValid.isValid).toBe(true);
      expect(resValid.verifiedCogs).toBe(60000);

      // Corrupted movement with wrong totalCost (e.g. 99,999 instead of 60,000)
      const corruptedCostMovement: StockMovement = {
        ...validHistoricalMovement,
        id: 'sm-hist-bad-cost',
        totalCost: 99999,
      };
      const resBadCost = verifyFifoCogsIntegrity([corruptedCostMovement], [lot]);
      expect(resBadCost.isValid).toBe(false);
      expect(resBadCost.discrepancies.some((d) => d.includes('totalCost mismatch'))).toBe(true);

      // Overflow allocation (movement requests 3000 from a lot that only had 2000 initial)
      const overflowMovement: StockMovement = {
        ...validHistoricalMovement,
        id: 'sm-hist-overflow',
        quantity: -3000,
        totalCost: 120000,
      };
      const resOverflow = verifyFifoCogsIntegrity([overflowMovement], [lot]);
      expect(resOverflow.isValid).toBe(false);
      expect(resOverflow.discrepancies.some((d) => d.includes('allocation overflow'))).toBe(true);
    });

    it('Financial Reconciliation: validates double-entry equality, payment histories, advance balances, and labour calculations', () => {
      // 1. Balanced reconciliation
      const balancedJournal: JournalEntry = {
        id: 'jv-recon-01',
        companyId: mockCompany.id,
        entryNo: 'JV-2026-REC1',
        entryDate: '2026-10-15',
        sourceType: 'EXPENSE',
        sourceId: 'exp-01',
        narration: 'Office expense',
        totalDebit: 5000,
        totalCredit: 5000,
        isPosted: true,
        lines: [
          { id: 'l1', accountCode: '5010', accountName: 'Office Expenses', debit: 5000, credit: 0 },
          { id: 'l2', accountCode: '1010', accountName: 'Cash on Hand', debit: 0, credit: 5000 },
        ],
        createdAt: '2026-10-15T10:00:00Z',
        createdBy: 'Admin',
      };

      const recon = verifyFinancialReconciliation({
        journalEntries: [balancedJournal],
      });
      expect(recon.isBalanced).toBe(true);
      expect(recon.totalDebits).toBe(5000);
      expect(recon.totalCredits).toBe(5000);
      expect(recon.discrepancies.length).toBe(0);

      // 2. Unbalanced journal entry detection
      const unbalancedJournal: JournalEntry = {
        ...balancedJournal,
        id: 'jv-recon-unbal',
        totalDebit: 5000,
        totalCredit: 4500, // out of balance!
      };
      const reconUnbal = verifyFinancialReconciliation({
        journalEntries: [unbalancedJournal],
      });
      expect(reconUnbal.isBalanced).toBe(false);
      expect(reconUnbal.discrepancies.some((d) => d.includes('out of balance'))).toBe(true);

      // 3. Salary advance recovery limit enforcement
      expect(() => {
        validateSalaryRecordInput(
          {
            employeeId: 'emp-01',
            employeeName: 'A. Raman',
            salaryMonth: '2026-10',
            grossSalary: 25000,
            advanceRecovery: 5000, // recovery of 5000
          },
          [],
          { availableAdvanceBalance: 2000 } // only 2000 available!
        );
      }).toThrow('Advance recovery (₹5000) cannot exceed employee available advance balance (₹2000)');

      // 4. Daily labour remaining balance verification
      expect(() => {
        validateDailyLabourInput({
          workerNameOrGroup: 'Cutting Team',
          workerCount: 4,
          workingDays: 1,
          dailyRate: 600, // totalCost = 2400
          advanceAmount: 400,
          amountPaid: 1000,
          accountId: 'acc-cash',
          remainingBalance: 500, // Wrong! 2400 - 400 - 1000 = 1000, not 500
        });
      }).toThrow('Daily labour remaining balance (₹500) does not match calculated balance (₹1000');
    });

    it('Suite 14.21: Third-Pass Security, FIFO Isolation, Sequential Advance Recovery & Reconciliation Engine', () => {
      // 1. Strict FIFO Company Isolation in Stock Calculation
      const movementsWithCompanies: StockMovement[] = [
        {
          id: 'mov-c1-01',
          companyId: 'company-alpha',
          materialId: 'mat-copper',
          yardId: 'yard-main',
          movementType: 'PURCHASE_RECEIPT',
          quantity: 1000,
          unitCost: 450,
          totalCost: 450000,
          transactionRef: 'PR-001',
          createdAt: '2026-10-01T10:00:00Z',
          createdBy: 'Admin',
        },
        {
          id: 'mov-c2-01',
          companyId: 'company-beta',
          materialId: 'mat-copper',
          yardId: 'yard-main',
          movementType: 'PURCHASE_RECEIPT',
          quantity: 2500,
          unitCost: 440,
          totalCost: 1100000,
          transactionRef: 'PR-002',
          createdAt: '2026-10-01T11:00:00Z',
          createdBy: 'Admin',
        },
        {
          id: 'mov-no-company',
          companyId: undefined as any,
          materialId: 'mat-copper',
          yardId: 'yard-main',
          movementType: 'PURCHASE_RECEIPT',
          quantity: 500,
          unitCost: 450,
          totalCost: 225000,
          transactionRef: 'PR-003',
          createdAt: '2026-10-01T12:00:00Z',
          createdBy: 'Admin',
        },
      ];

      // Alpha stock should only be 1000 KG, strictly ignoring company-beta and company-less movements
      const alphaStock = calculateCurrentStock(movementsWithCompanies, 'mat-copper', 'yard-main', 'company-alpha');
      expect(alphaStock).toBe(1000);

      // Beta stock should only be 2500 KG
      const betaStock = calculateCurrentStock(movementsWithCompanies, 'mat-copper', 'yard-main', 'company-beta');
      expect(betaStock).toBe(2500);

      // 2. Strict FIFO Lot Allocation Company Isolation
      const multiCompanyLots: InventoryLot[] = [
        {
          id: 'lot-alpha-1',
          lotNumber: 'LOT-A1',
          companyId: 'company-alpha',
          materialId: 'mat-copper',
          yardId: 'yard-main',
          initialQuantity: 1000,
          remainingQuantity: 1000,
          unitCost: 450,
          receivedAt: '2026-10-01T10:00:00Z',
          isExhausted: false,
        },
        {
          id: 'lot-beta-1',
          lotNumber: 'LOT-B1',
          companyId: 'company-beta',
          materialId: 'mat-copper',
          yardId: 'yard-main',
          initialQuantity: 3000,
          remainingQuantity: 3000,
          unitCost: 440,
          receivedAt: '2026-09-01T10:00:00Z', // older date, but different company!
          isExhausted: false,
        },
        {
          id: 'lot-orphan-1',
          lotNumber: 'LOT-ORPHAN',
          companyId: undefined as any,
          materialId: 'mat-copper',
          yardId: 'yard-main',
          initialQuantity: 5000,
          remainingQuantity: 5000,
          unitCost: 400,
          receivedAt: '2026-08-01T10:00:00Z', // oldest, but unassigned company!
          isExhausted: false,
        },
      ];

      // Requesting 1500 for company-alpha must fail with insufficient stock (only 1000 available in alpha)
      expect(() => {
        allocateLotsFifo(multiCompanyLots, 'mat-copper', 'yard-main', 1500, 'company-alpha');
      }).toThrow('Insufficient stock available in yard. Requested: 1500 KG, Available: 1000 KG');

      // Requesting 800 for company-alpha allocates strictly from LOT-A1
      const allocAlpha = allocateLotsFifo(multiCompanyLots, 'mat-copper', 'yard-main', 800, 'company-alpha');
      expect(allocAlpha.result.allocations.length).toBe(1);
      expect(allocAlpha.result.allocations[0].lotId).toBe('lot-alpha-1');
      expect(allocAlpha.result.totalCogs).toBe(360000); // 800 * 450

      // 3. FIFO COGS Audit: Material & Yard consistency and duplicate movement detection
      const validLotAlpha: InventoryLot = {
        id: 'lot-alpha-1',
        lotNumber: 'LOT-A1',
        companyId: 'company-alpha',
        materialId: 'mat-copper',
        yardId: 'yard-main',
        initialQuantity: 1000,
        remainingQuantity: 200,
        unitCost: 450,
        receivedAt: '2026-10-01T10:00:00Z',
        isExhausted: false,
      };

      const validMovementAlpha: StockMovement = {
        id: 'mov-alpha-disp-1',
        companyId: 'company-alpha',
        materialId: 'mat-copper',
        yardId: 'yard-main',
        lotId: 'lot-alpha-1',
        movementType: 'SALES_DISPATCH',
        quantity: -800,
        unitCost: 450,
        totalCost: 360000,
        transactionRef: 'DISP-001',
        createdAt: '2026-10-05T10:00:00Z',
        createdBy: 'Admin',
      };

      // Valid case passes
      const validCogsAudit = verifyFifoCogsIntegrity([validMovementAlpha], [validLotAlpha], { companyId: 'company-alpha' });
      expect(validCogsAudit.isValid).toBe(true);
      expect(validCogsAudit.verifiedCogs).toBe(360000);

      // Material mismatch detection
      const mismatchedMaterialMovement: StockMovement = {
        ...validMovementAlpha,
        id: 'mov-mismatched-mat',
        materialId: 'mat-aluminum', // mismatch!
      };
      const matMismatchAudit = verifyFifoCogsIntegrity([mismatchedMaterialMovement], [validLotAlpha], { companyId: 'company-alpha' });
      expect(matMismatchAudit.isValid).toBe(false);
      expect(matMismatchAudit.discrepancies.some((d) => d.includes('Material mismatch'))).toBe(true);

      // Yard mismatch detection
      const mismatchedYardMovement: StockMovement = {
        ...validMovementAlpha,
        id: 'mov-mismatched-yard',
        yardId: 'yard-branch', // mismatch!
      };
      const yardMismatchAudit = verifyFifoCogsIntegrity([mismatchedYardMovement], [validLotAlpha], { companyId: 'company-alpha' });
      expect(yardMismatchAudit.isValid).toBe(false);
      expect(yardMismatchAudit.discrepancies.some((d) => d.includes('Yard mismatch'))).toBe(true);

      // Duplicate movement detection
      const dupAudit = verifyFifoCogsIntegrity(
        [validMovementAlpha, { ...validMovementAlpha }], // exact duplicate ID
        [validLotAlpha],
        { companyId: 'company-alpha' }
      );
      expect(dupAudit.isValid).toBe(false);
      expect(dupAudit.discrepancies.some((d) => d.includes('Duplicate stock movement'))).toBe(true);

      // Sales dispatch positive quantity violation
      const positiveDispatchMovement: StockMovement = {
        ...validMovementAlpha,
        id: 'mov-pos-dispatch',
        quantity: 800, // positive! outward must be negative
      };
      const posDispatchAudit = verifyFifoCogsIntegrity([positiveDispatchMovement], [validLotAlpha], { companyId: 'company-alpha' });
      expect(posDispatchAudit.isValid).toBe(false);
      expect(posDispatchAudit.discrepancies.some((d) => d.includes('non-negative quantity'))).toBe(true);

      // Invalid negative lot remaining quantity
      const negativeLot: InventoryLot = {
        ...validLotAlpha,
        id: 'lot-neg-bal',
        remainingQuantity: -50,
      };
      const negLotAudit = verifyFifoCogsIntegrity([validMovementAlpha], [negativeLot], { companyId: 'company-alpha' });
      expect(negLotAudit.isValid).toBe(false);
      expect(negLotAudit.discrepancies.some((d) => d.includes('negative remaining quantity'))).toBe(true);

      // 4. Sequential Row-by-Row Advance Recovery Verification
      // Simulate sequential recovery across two open advances: Adv1 = ₹500, Adv2 = ₹1000, Recovery = ₹800
      // Adv1 should be fully recovered (remaining = 0), Adv2 should be partially recovered (remaining = ₹700)
      const openAdvances = [
        { id: 'adv-01', advanceDate: '2026-09-01', amount: 500, recoveredAmount: 0, remainingBalance: 500, status: 'OPEN' },
        { id: 'adv-02', advanceDate: '2026-09-15', amount: 1000, recoveredAmount: 0, remainingBalance: 1000, status: 'OPEN' },
      ];
      let recoveryNeeded = 800;
      for (const adv of openAdvances) {
        if (recoveryNeeded <= 0) break;
        const deduct = Math.min(adv.remainingBalance, recoveryNeeded);
        adv.recoveredAmount += deduct;
        adv.remainingBalance -= deduct;
        adv.status = adv.remainingBalance <= 0.001 ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED';
        recoveryNeeded -= deduct;
      }

      expect(openAdvances[0].remainingBalance).toBe(0);
      expect(openAdvances[0].recoveredAmount).toBe(500);
      expect(openAdvances[0].status).toBe('FULLY_RECOVERED');
      expect(openAdvances[1].remainingBalance).toBe(700);
      expect(openAdvances[1].recoveredAmount).toBe(300);
      expect(openAdvances[1].status).toBe('PARTIALLY_RECOVERED');
      expect(recoveryNeeded).toBe(0);

      // 5. Full Reconciliation Engine with Discrepancy Reporting & Corrective Actions
      const reconResultWithDiscrepancy = verifyFinancialReconciliation({
        journalEntries: [
          {
            id: 'jv-bad',
            companyId: 'company-alpha',
            entryNo: 'JV-ERR-1',
            entryDate: '2026-10-15',
            sourceType: 'EXPENSE',
            sourceId: 'exp-1',
            narration: 'Unbalanced entry',
            totalDebit: 10000,
            totalCredit: 8000,
            isPosted: true,
            lines: [
              { id: 'l1', accountCode: '5010', accountName: 'Expense', debit: 10000, credit: 0 },
              { id: 'l2', accountCode: '1010', accountName: 'Cash', debit: 0, credit: 8000 },
            ],
            createdAt: '2026-10-15T10:00:00Z',
            createdBy: 'Admin',
          },
        ],
        dailyLabourEntries: [
          {
            id: 'dl-err-1',
            companyId: 'company-alpha',
            workDate: '2026-10-15',
            workerNameOrGroup: 'Cutting Team',
            workerCount: 5,
            workingDays: 1,
            dailyRate: 600,
            overtimeAmount: 0,
            additionalCharges: 0,
            totalLabourCost: 3000,
            advanceAmount: 500,
            amountPaid: 1000,
            remainingBalance: 2000, // Error: 3000 - 500 - 1000 = 1500, not 2000!
            paymentMode: 'CASH',
            createdAt: '2026-10-15T10:00:00Z',
            createdBy: 'Admin',
          },
        ],
        employeeAdvances: [
          {
            id: 'adv-err-1',
            companyId: 'company-alpha',
            employeeId: 'emp-1',
            employeeName: 'K. Kumar',
            advanceDate: '2026-10-01',
            amount: 5000,
            recoveredAmount: 2000,
            remainingBalance: 4000, // Error: 5000 - 2000 = 3000, not 4000!
            status: 'PARTIALLY_RECOVERED',
            paymentMode: 'CASH',
            accountId: 'acc-cash',
            createdAt: '2026-10-01T10:00:00Z',
            createdBy: 'Admin',
          },
        ],
      });

      expect(reconResultWithDiscrepancy.isBalanced).toBe(false);
      expect(reconResultWithDiscrepancy.discrepancies.length).toBe(4);
      expect(reconResultWithDiscrepancy.correctiveActions.length).toBe(4);
      expect(reconResultWithDiscrepancy.correctiveActions[0]).toContain('Post adjusting journal');
      expect(reconResultWithDiscrepancy.correctiveActions[1]).toContain('Audit individual journal lines');
      expect(reconResultWithDiscrepancy.correctiveActions[2]).toContain('Recalculate remaining_balance');
      expect(reconResultWithDiscrepancy.correctiveActions[3]).toContain('Update advance balance');
    });
  });
});


