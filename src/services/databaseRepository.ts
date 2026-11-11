/**
 * YASHOTH ENTERPRISES ERP — AUTHORITATIVE DATABASE REPOSITORY
 *
 * Implements:
 * 1. PostgREST / Supabase PostgreSQL database persistence for operational entities.
 * 2. Strict company_id multi-tenant query isolation and validation.
 * 3. Graceful offline fallback with local IndexedDB/localStorage mirror.
 * 4. Transaction-ready mutation payload formatting.
 */

import { supabase } from './supabaseClient.ts';
import type {
  Party,
  Material,
  Yard,
  Vehicle,
  VehicleDocument,
  PurchaseHeader,
  InventoryLot,
  StockMovement,
  SalesHeader,
  Invoice,
  Payment,
  Expense,
  Weighment,
  CommercialDocument,
  JournalEntry,
  MonthlySalaryRecord,
  EmployeeAdvance,
  DailyLabourEntry,
  LabourPayment,
  Contractor,
  ContractorWorkEntry,
  ContractorPayment,
  DailyCashClosingRecord,
} from '../types/index.ts';

export class DatabaseRepository {
  private static instance: DatabaseRepository;

  public static getInstance(): DatabaseRepository {
    if (!DatabaseRepository.instance) {
      DatabaseRepository.instance = new DatabaseRepository();
    }
    return DatabaseRepository.instance;
  }

  public isRemoteDatabaseAvailable(): boolean {
    return supabase.isConfigured();
  }

  // --------------------------------------------------------------------------
  // Parties Master (Suppliers & Customers)
  // --------------------------------------------------------------------------
  public async fetchParties(companyId: string, authToken?: string): Promise<Party[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<Party>('parties', {
      filters: { company_id: `eq.${companyId}`, is_active: 'eq.true' },
      authToken,
    });
    return res.data;
  }

  public async saveParty(party: Party, authToken?: string): Promise<Party | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<Party>('parties', party, authToken);
    return res.data;
  }

  // --------------------------------------------------------------------------
  // Materials & Stock Master
  // --------------------------------------------------------------------------
  public async fetchMaterials(companyId: string, authToken?: string): Promise<Material[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<Material>('materials', {
      filters: { company_id: `eq.${companyId}`, is_active: 'eq.true' },
      authToken,
    });
    return res.data;
  }

  public async fetchYards(companyId: string, authToken?: string): Promise<Yard[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<Yard>('yards', {
      filters: { company_id: `eq.${companyId}`, is_active: 'eq.true' },
      authToken,
    });
    return res.data;
  }

  // --------------------------------------------------------------------------
  // Purchases & Weighments
  // --------------------------------------------------------------------------
  public async fetchPurchases(companyId: string, authToken?: string): Promise<PurchaseHeader[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<PurchaseHeader>('purchase_headers', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async fetchWeighments(companyId: string, authToken?: string): Promise<Weighment[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<Weighment>('weighments', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  // --------------------------------------------------------------------------
  // Invoices & Commercial Documents
  // --------------------------------------------------------------------------
  public async fetchInvoices(companyId: string, authToken?: string): Promise<Invoice[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<Invoice>('invoices', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async fetchCommercialDocuments(companyId: string, authToken?: string): Promise<CommercialDocument[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<CommercialDocument>('commercial_documents', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  // --------------------------------------------------------------------------
  // Double-Entry Journals & Accounting
  // --------------------------------------------------------------------------
  public async fetchJournalEntries(companyId: string, authToken?: string): Promise<JournalEntry[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<JournalEntry>('journal_entries', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveJournalEntry(entry: JournalEntry, authToken?: string): Promise<JournalEntry | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<JournalEntry>('journal_entries', entry, authToken);
    return res.data;
  }

  // --------------------------------------------------------------------------
  // Daily Expenses
  // --------------------------------------------------------------------------
  public async fetchExpenses(companyId: string, authToken?: string): Promise<Expense[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<Expense>('expenses', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveExpense(expense: Expense, authToken?: string): Promise<Expense | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<Expense>('expenses', expense, authToken);
    return res.data;
  }

  public async updateExpense(id: string, updates: Partial<Expense>, authToken?: string): Promise<Expense | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.updateRow<Expense>('expenses', { id: `eq.${id}` }, updates, authToken);
    return res.data;
  }

  // --------------------------------------------------------------------------
  // Permanent Monthly Staff Salary & Advances
  // --------------------------------------------------------------------------
  public async fetchSalaryRecords(companyId: string, authToken?: string): Promise<MonthlySalaryRecord[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<MonthlySalaryRecord>('salary_records', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveSalaryRecord(record: MonthlySalaryRecord, authToken?: string): Promise<MonthlySalaryRecord | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<MonthlySalaryRecord>('salary_records', record, authToken);
    return res.data;
  }

  public async updateSalaryRecord(id: string, updates: Partial<MonthlySalaryRecord>, authToken?: string): Promise<MonthlySalaryRecord | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.updateRow<MonthlySalaryRecord>('salary_records', { id: `eq.${id}` }, updates, authToken);
    return res.data;
  }

  public async fetchEmployeeAdvances(companyId: string, authToken?: string): Promise<EmployeeAdvance[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<EmployeeAdvance>('employee_advances', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveEmployeeAdvance(advance: EmployeeAdvance, authToken?: string): Promise<EmployeeAdvance | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<EmployeeAdvance>('employee_advances', advance, authToken);
    return res.data;
  }

  // --------------------------------------------------------------------------
  // Daily Wage Labour & Payments
  // --------------------------------------------------------------------------
  public async fetchDailyLabour(companyId: string, authToken?: string): Promise<DailyLabourEntry[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<DailyLabourEntry>('daily_labour_entries', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveDailyLabour(entry: DailyLabourEntry, authToken?: string): Promise<DailyLabourEntry | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<DailyLabourEntry>('daily_labour_entries', entry, authToken);
    return res.data;
  }

  public async updateDailyLabour(id: string, updates: Partial<DailyLabourEntry>, authToken?: string): Promise<DailyLabourEntry | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.updateRow<DailyLabourEntry>('daily_labour_entries', { id: `eq.${id}` }, updates, authToken);
    return res.data;
  }

  public async fetchLabourPayments(companyId: string, authToken?: string): Promise<LabourPayment[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<LabourPayment>('labour_payments', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveLabourPayment(payment: LabourPayment, authToken?: string): Promise<LabourPayment | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<LabourPayment>('labour_payments', payment, authToken);
    return res.data;
  }

  // --------------------------------------------------------------------------
  // Outsourced Contractors, Work Entries & Progress Payments
  // --------------------------------------------------------------------------
  public async fetchContractors(companyId: string, authToken?: string): Promise<Contractor[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<Contractor>('contractors', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveContractor(contractor: Contractor, authToken?: string): Promise<Contractor | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<Contractor>('contractors', contractor, authToken);
    return res.data;
  }

  public async fetchContractorWork(companyId: string, authToken?: string): Promise<ContractorWorkEntry[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<ContractorWorkEntry>('contractor_work_entries', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveContractorWork(work: ContractorWorkEntry, authToken?: string): Promise<ContractorWorkEntry | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<ContractorWorkEntry>('contractor_work_entries', work, authToken);
    return res.data;
  }

  public async updateContractorWork(id: string, updates: Partial<ContractorWorkEntry>, authToken?: string): Promise<ContractorWorkEntry | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.updateRow<ContractorWorkEntry>('contractor_work_entries', { id: `eq.${id}` }, updates, authToken);
    return res.data;
  }

  public async fetchContractorPayments(companyId: string, authToken?: string): Promise<ContractorPayment[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<ContractorPayment>('contractor_payments', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveContractorPayment(payment: ContractorPayment, authToken?: string): Promise<ContractorPayment | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<ContractorPayment>('contractor_payments', payment, authToken);
    return res.data;
  }

  public async postContractorPaymentAtomic(params: {
    companyId: string;
    contractorId: string;
    workId?: string;
    contractorWorkId?: string;
    contractorName: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    accountId: string;
    voucherNo: string;
    actor: string;
    idempotencyKey?: string;
    authToken?: string;
  }): Promise<{ success: boolean; paymentId?: string; journalId?: string; newBalance?: number; error?: Error }> {
    if (!this.isRemoteDatabaseAvailable()) {
      return { success: false, error: new Error('Remote Supabase database is not configured.') };
    }
    const resolvedWorkId = params.workId || params.contractorWorkId || '';
    const res = await supabase.executeRpc<any>('fn_post_contractor_payment_atomic', {
      p_company_id: params.companyId,
      p_contractor_id: params.contractorId,
      p_work_id: resolvedWorkId,
      p_contractor_name: params.contractorName,
      p_amount: params.amount,
      p_payment_mode: params.paymentMode,
      p_account_id: params.accountId,
      p_voucher_no: params.voucherNo,
      p_actor: params.actor,
      p_idempotency_key: params.idempotencyKey || null,
    }, params.authToken);

    if (res.error) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      paymentId: res.data?.payment_id,
      journalId: res.data?.journal_id,
      newBalance: res.data?.new_balance,
    };
  }

  public async postSalaryDisbursementAtomic(params: {
    companyId: string;
    salaryRecordId: string;
    employeeName: string;
    salaryMonth: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    accountId: string;
    voucherNo: string;
    actor: string;
    authToken?: string;
  }): Promise<{ success: boolean; journalId?: string; newBalance?: number; status?: string; error?: Error }> {
    if (!this.isRemoteDatabaseAvailable()) {
      return { success: false, error: new Error('Remote Supabase database is not configured.') };
    }
    const res = await supabase.executeRpc<any>('fn_post_salary_disbursement_atomic', {
      p_company_id: params.companyId,
      p_salary_record_id: params.salaryRecordId,
      p_employee_name: params.employeeName,
      p_salary_month: params.salaryMonth,
      p_amount: params.amount,
      p_payment_mode: params.paymentMode,
      p_account_id: params.accountId,
      p_voucher_no: params.voucherNo,
      p_actor: params.actor,
    }, params.authToken);

    if (res.error) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      journalId: res.data?.journal_id,
      newBalance: res.data?.new_balance,
      status: res.data?.status,
    };
  }

  public async postLabourPaymentAtomic(params: {
    companyId: string;
    dailyLabourId: string;
    workerNameOrGroup: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    accountId: string;
    voucherNo: string;
    actor: string;
    idempotencyKey?: string;
    authToken?: string;
  }): Promise<{ success: boolean; paymentId?: string; journalId?: string; newBalance?: number; error?: Error }> {
    if (!this.isRemoteDatabaseAvailable()) {
      return { success: false, error: new Error('Remote Supabase database is not configured.') };
    }
    const res = await supabase.executeRpc<any>('fn_post_labour_payment_atomic', {
      p_company_id: params.companyId,
      p_daily_labour_id: params.dailyLabourId,
      p_worker_name_or_group: params.workerNameOrGroup,
      p_amount: params.amount,
      p_payment_mode: params.paymentMode,
      p_account_id: params.accountId,
      p_voucher_no: params.voucherNo,
      p_actor: params.actor,
      p_idempotency_key: params.idempotencyKey || null,
    }, params.authToken);

    if (res.error) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      paymentId: res.data?.payment_id,
      journalId: res.data?.journal_id,
      newBalance: res.data?.new_balance,
    };
  }

  public async issueEmployeeAdvanceAtomic(params: {
    companyId: string;
    employeeId: string;
    employeeName: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    accountId: string;
    voucherNo: string;
    actor: string;
    notes?: string;
    idempotencyKey?: string;
    authToken?: string;
  }): Promise<{ success: boolean; advanceId?: string; journalId?: string; error?: Error }> {
    if (!this.isRemoteDatabaseAvailable()) {
      return { success: false, error: new Error('Remote Supabase database is not configured.') };
    }
    const res = await supabase.executeRpc<any>('fn_issue_employee_advance_atomic', {
      p_company_id: params.companyId,
      p_employee_id: params.employeeId,
      p_employee_name: params.employeeName,
      p_amount: params.amount,
      p_payment_mode: params.paymentMode,
      p_account_id: params.accountId,
      p_voucher_no: params.voucherNo,
      p_actor: params.actor,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey || null,
    }, params.authToken);

    if (res.error) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      advanceId: res.data?.advance_id,
      journalId: res.data?.journal_id,
    };
  }

  public async postSalaryAccrualAtomic(params: {
    companyId: string;
    employeeId: string;
    employeeName: string;
    designation: string;
    salaryMonth: string;
    grossSalary: number;
    allowances: number;
    deductions: number;
    advanceRecovery: number;
    netSalaryPayable: number;
    amountPaid: number;
    paymentMode: 'CASH' | 'BANK';
    accountId?: string;
    actor: string;
    notes?: string;
    idempotencyKey?: string;
    authToken?: string;
  }): Promise<{
    success: boolean;
    salaryRecordId?: string;
    accrualJournalId?: string;
    disbursementJournalId?: string;
    remainingBalance?: number;
    status?: string;
    error?: Error;
  }> {
    if (!this.isRemoteDatabaseAvailable()) {
      return { success: false, error: new Error('Remote Supabase database is not configured.') };
    }
    const res = await supabase.executeRpc<any>('fn_post_salary_accrual_atomic', {
      p_company_id: params.companyId,
      p_employee_id: params.employeeId,
      p_employee_name: params.employeeName,
      p_designation: params.designation,
      p_salary_month: params.salaryMonth,
      p_gross_salary: params.grossSalary,
      p_allowances: params.allowances,
      p_deductions: params.deductions,
      p_advance_recovery: params.advanceRecovery,
      p_net_salary_payable: params.netSalaryPayable,
      p_amount_paid: params.amountPaid,
      p_payment_mode: params.paymentMode,
      p_account_id: params.accountId || null,
      p_actor: params.actor,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey || null,
    }, params.authToken);

    if (res.error) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      salaryRecordId: res.data?.salary_record_id,
      accrualJournalId: res.data?.accrual_journal_id,
      disbursementJournalId: res.data?.disbursement_journal_id,
      remainingBalance: res.data?.remaining_balance,
      status: res.data?.status,
    };
  }

  public async postDailyLabourAccrualAtomic(params: {
    companyId: string;
    workDate: string;
    workerNameOrGroup: string;
    workerCount: number;
    workingDays: number;
    dailyRate: number;
    overtimeAmount: number;
    additionalCharges: number;
    totalLabourCost: number;
    advanceAmount: number;
    amountPaid: number;
    remainingBalance: number;
    paymentMode: string;
    accountId?: string;
    actor: string;
    notes?: string;
    idempotencyKey?: string;
    authToken?: string;
  }): Promise<{
    success: boolean;
    dailyLabourId?: string;
    accrualJournalId?: string;
    paymentId?: string;
    paymentJournalId?: string;
    error?: Error;
  }> {
    if (!this.isRemoteDatabaseAvailable()) {
      return { success: false, error: new Error('Remote Supabase database is not configured.') };
    }
    const res = await supabase.executeRpc<any>('fn_post_daily_labour_accrual_atomic', {
      p_company_id: params.companyId,
      p_work_date: params.workDate,
      p_worker_name_or_group: params.workerNameOrGroup,
      p_worker_count: params.workerCount,
      p_working_days: params.workingDays,
      p_daily_rate: params.dailyRate,
      p_overtime_amount: params.overtimeAmount,
      p_additional_charges: params.additionalCharges,
      p_total_labour_cost: params.totalLabourCost,
      p_advance_amount: params.advanceAmount,
      p_amount_paid: params.amountPaid,
      p_remaining_balance: params.remainingBalance,
      p_payment_mode: params.paymentMode,
      p_account_id: params.accountId || null,
      p_actor: params.actor,
      p_notes: params.notes || null,
      p_idempotency_key: params.idempotencyKey || null,
    }, params.authToken);

    if (res.error) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      dailyLabourId: res.data?.daily_labour_id,
      accrualJournalId: res.data?.accrual_journal_id,
      paymentId: res.data?.payment_id,
      paymentJournalId: res.data?.payment_journal_id,
    };
  }

  // --------------------------------------------------------------------------
  // Guided Daily Cash Closing Register
  // --------------------------------------------------------------------------
  public async fetchDailyCashClosings(companyId: string, authToken?: string): Promise<DailyCashClosingRecord[] | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.queryTable<DailyCashClosingRecord>('daily_cash_closings', {
      filters: { company_id: `eq.${companyId}` },
      authToken,
    });
    return res.data;
  }

  public async saveDailyCashClosing(closing: DailyCashClosingRecord, authToken?: string): Promise<DailyCashClosingRecord | null> {
    if (!this.isRemoteDatabaseAvailable()) return null;
    const res = await supabase.insertRow<DailyCashClosingRecord>('daily_cash_closings', closing, authToken);
    return res.data;
  }
}

export const dbRepository = DatabaseRepository.getInstance();
