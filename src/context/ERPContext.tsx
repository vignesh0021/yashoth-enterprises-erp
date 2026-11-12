import React, { createContext, useContext, useState, useEffect } from 'react';
import type { 
  Company,
  CompanySettings, 
  UserRole, 
  UserSession,
  Yard, 
  Material, 
  MaterialGrade, 
  Party, 
  Vehicle, 
  VehicleDocument, 
  Employee, 
  AttendanceEntry, 
  CashBankAccount, 
  AccountTransaction, 
  Expense, 
  Weighment, 
  CollectionJob, 
  PurchaseHeader, 
  InventoryLot, 
  StockMovement, 
  SalesHeader, 
  Invoice, 
  Payment, 
  StockCount, 
  AuditLog, 
  CollectionStatus, 
  AttendanceStatus,
  CommercialDocument,
  CommercialDocType,
  JournalEntry,
  JournalLine,
  BackupHistoryItem,
  RestoreLog,
  BackupScheduleConfig,
  BackupDestination,
  RestorePreviewResult,
  BackupDatabasePayload,
  DailyTask,
  WorkNote,
  UploadedDocument,
  MonthlySalaryRecord,
  EmployeeAdvance,
  DailyLabourEntry,
  LabourPayment,
  Contractor,
  ContractorWorkEntry,
  ContractorPayment,
  DailyCashClosingRecord
} from '../types/index.ts';

import { authService } from '../services/authService.ts';
import { 
  hasPermission, 
  enforceAuthorization, 
  PermissionAction, 
  AuthorizationError,
  createSecurityAuditLog 
} from '../../backend/business-rules/authEngine.ts';
import {
  validateCompanyRegistration,
  filterByCompany,
  assertCompanyOwnership,
  type CompanyRegistrationInput
} from '../../backend/business-rules/companyEngine.ts';
import {
  createSalesInvoiceJournal,
  createPurchaseInvoiceJournal,
  createPaymentJournal,
  createContraJournal,
  createExpenseJournal,
  createPayUnpaidExpenseJournal,
  createSalaryPaymentJournal,
  createSalaryAccrualJournal,
  createSalaryDisbursementJournal,
  createEmployeeAdvanceJournal,
  createDailyLabourJournal,
  createLabourAdvanceJournal,
  createLabourPaymentJournal,
  createContractorWorkJournal,
  createContractorAdvanceJournal,
  createContractorProgressPaymentJournal,
  createCashClosingJournal,
  createReversingJournal,
  generateGeneralLedger,
  generateTrialBalance,
  generateProfitAndLoss,
  generateBalanceSheet,
  generatePartyStatement,
  type GeneralLedgerReport,
  type TrialBalanceReport,
  type ProfitAndLossReport,
  type BalanceSheetReport,
  type PartyStatementReport
} from '../../backend/business-rules/accountingEngine.ts';
import {
  postPaymentVoucher,
  executeContraTransfer,
  calculateMonthlySalary,
  calculateDailyLabourCost,
  calculateDailyLabourBalance,
  calculateContractorBalance,
  computeDailyCashClosing,
  calculateAccountBalanceFromLedger,
  validateCashBankTransaction,
  validateContraTransfer,
  validateSalaryRecordInput,
  validateDailyLabourInput,
  validateContractorWorkInput,
  validateContractorPaymentInput,
  validateExpenseInput,
  calculateProfitAndLoss,
  calculateAuthoritativeProfitAndLoss,
} from '../../backend/business-rules/financeEngine.ts';
import {
  createCommercialDocument,
  convertDocument,
  createCreditNote,
  createDebitNote
} from '../../backend/business-rules/commercialDocumentEngine.ts';
import {
  generateBackup,
  validateBackupIntegrity,
  generateRestorePreview,
  createPreRestoreSafetySnapshot,
  executeRestore,
  calculateNextScheduledRun,
  exportRegistryAsCSV
} from '../../backend/business-rules/backupEngine.ts';
import {
  generateAllCompanyWorkbooks,
  generateConsolidatedMasterWorkbook,
  downloadWorkbookInBrowser,
  downloadAllCompanyWorkbooksInBrowser
} from '../../backend/business-rules/excelEngine.ts';
import { googleDriveService } from '../services/googleDriveService.ts';
import { dbRepository } from '../services/databaseRepository.ts';

import { 
  INITIAL_COMPANY_SETTINGS, 
  INITIAL_COMPANIES,
  INITIAL_YARDS, 
  INITIAL_MATERIALS, 
  INITIAL_MATERIAL_GRADES, 
  INITIAL_PARTIES, 
  INITIAL_VEHICLES, 
  INITIAL_VEHICLE_DOCS, 
  INITIAL_EMPLOYEES, 
  INITIAL_ACCOUNTS, 
  INITIAL_LOTS, 
  INITIAL_STOCK_MOVEMENTS, 
  INITIAL_ACCOUNT_TRANSACTIONS,
  INITIAL_INVOICES,
  INITIAL_ATTENDANCE,
  INITIAL_COMMERCIAL_DOCUMENTS,
  INITIAL_JOURNAL_ENTRIES,
  INITIAL_BACKUP_HISTORY,
  INITIAL_RESTORE_LOGS,
  INITIAL_BACKUP_SCHEDULE,
  INITIAL_DAILY_TASKS,
  INITIAL_WORK_NOTES,
  INITIAL_UPLOADED_DOCS,
  INITIAL_EXPENSES,
  INITIAL_SALARY_RECORDS,
  INITIAL_EMPLOYEE_ADVANCES,
  INITIAL_DAILY_LABOUR,
  INITIAL_LABOUR_PAYMENTS,
  INITIAL_CONTRACTORS,
  INITIAL_CONTRACTOR_WORK,
  INITIAL_CONTRACTOR_PAYMENTS,
  INITIAL_DAILY_CASH_CLOSINGS
} from '../services/mockData.ts';

import { postPurchaseTransaction } from '../../backend/business-rules/purchaseEngine.ts';
import { teamSyncService } from '../services/teamSyncService.ts';
import { dispatchSalesTransaction } from '../../backend/business-rules/salesEngine.ts';
import { migrateParties, migrateOpeningStock } from '../../backend/business-rules/dataMigration.ts';
import { createStockMovement, verifyFifoCogsIntegrity } from '../../backend/business-rules/inventoryEngine.ts';
import { calcNetWeight, calcPayableWeight, roundTo2, roundTo3 } from '../utils/calculations.ts';

interface ERPContextType {
  currentUser: UserSession;
  login: (email: string, password: string) => Promise<{ session: UserSession | null; error: string | null }>;
  logout: () => void;
  register: (params: Parameters<typeof authService.signUp>[0]) => ReturnType<typeof authService.signUp>;
  requestPasswordRecovery: (email: string) => ReturnType<typeof authService.requestPasswordRecovery>;
  switchRole: (role: UserRole) => void;
  checkPermission: (action: PermissionAction) => boolean;
  companies: Company[];
  activeCompanyId: string;
  activeCompany: Company;
  registerCompany: (input: CompanyRegistrationInput) => Company;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  switchCompany: (id: string) => void;
  company: CompanySettings;
  updateCompanySettings: (settings: Partial<CompanySettings>) => void;
  yards: Yard[];
  materials: Material[];
  materialGrades: MaterialGrade[];
  parties: Party[];
  vehicles: Vehicle[];
  vehicleDocuments: VehicleDocument[];
  employees: Employee[];
  attendance: AttendanceEntry[];
  accounts: CashBankAccount[];
  accountTransactions: AccountTransaction[];
  expenses: Expense[];
  weighments: Weighment[];
  collectionJobs: CollectionJob[];
  purchases: PurchaseHeader[];
  inventoryLots: InventoryLot[];
  stockMovements: StockMovement[];
  sales: SalesHeader[];
  invoices: Invoice[];
  payments: Payment[];
  stockCounts: StockCount[];
  auditLogs: AuditLog[];
  commercialDocuments: CommercialDocument[];
  journalEntries: JournalEntry[];

  // Commercial Document Operations
  createCommercialDoc: (params: {
    party: Party;
    documentType: CommercialDocType;
    documentDate: string;
    dueDate?: string;
    referenceNo?: string;
    lines: { description: string; quantity: number; unit: string; rate: number; gstRate: number; materialId?: string }[];
    notes?: string;
    termsAndConditions?: string;
  }) => CommercialDocument;
  updateCommercialDoc: (id: string, updates: Partial<CommercialDocument>) => void;
  deleteCommercialDoc: (id: string) => { success: boolean; message?: string };
  convertCommercialDoc: (sourceDocId: string, targetType: 'PROFORMA_INVOICE' | 'SALES_INVOICE' | 'PURCHASE_INVOICE') => CommercialDocument;
  issueCreditNote: (invoiceId: string, reason: string, returnedLines: { description: string; quantity: number; unit: string; rate: number; gstRate: number }[]) => CommercialDocument;
  issueDebitNote: (purchaseId: string, reason: string, debitedLines: { description: string; quantity: number; unit: string; rate: number; gstRate: number }[]) => CommercialDocument;

  // Double-Entry Accounting & Financial Statements
  getGeneralLedgerReport: (accountCode: string) => GeneralLedgerReport;
  getTrialBalanceReport: (asOfDate?: string) => TrialBalanceReport;
  getProfitAndLossReport: (fromDate: string, toDate: string) => ProfitAndLossReport;
  getBalanceSheetReport: (asOfDate?: string) => BalanceSheetReport;
  getPartyStatementReport: (partyId: string, fromDate?: string, toDate?: string) => PartyStatementReport;

  // Core Business Actions & CRUD
  addParty: (partyData: Omit<Party, 'id'>) => Party;
  updateParty: (id: string, updates: Partial<Party>) => void;
  deleteParty: (id: string) => { success: boolean; message?: string };
  addMaterial: (matData: Omit<Material, 'id'>) => Material;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => { success: boolean; message?: string };
  addVehicle: (vehData: Omit<Vehicle, 'id'>) => Vehicle;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => { success: boolean; message?: string };
  addVehicleDocument: (docData: Omit<VehicleDocument, 'id'>) => VehicleDocument;
  updateVehicleDocument: (id: string, updates: Partial<VehicleDocument>) => void;
  deleteVehicleDocument: (id: string) => { success: boolean; message?: string };
  renewVehicleDocument: (id: string, newExpiryDate?: string, newDocNumber?: string) => VehicleDocument | null;
  addEmployee: (empData: Omit<Employee, 'id'>) => Employee;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => { success: boolean; message?: string };
  updatePurchase: (id: string, updates: Partial<PurchaseHeader>) => void;
  deletePurchase: (id: string) => { success: boolean; message?: string };
  recordWeighment: (data: Omit<Weighment, 'id' | 'weighmentNo' | 'netWeight' | 'payableWeight' | 'createdAt'>) => Weighment;
  createPurchase: (purchaseData: Omit<PurchaseHeader, 'id' | 'purchaseNo' | 'createdAt'>) => PurchaseHeader;
  postPurchase: (purchaseId: string) => void;
  createCollectionJob: (jobData: Omit<CollectionJob, 'id' | 'jobNo' | 'createdAt'>) => CollectionJob;
  updateCollectionStatus: (jobId: string, status: CollectionStatus, actualWeight?: number, transportExpenses?: number) => void;
  createSalesOrder: (salesData: Omit<SalesHeader, 'id' | 'salesNo' | 'createdAt'>) => SalesHeader;
  dispatchSalesOrder: (salesId: string) => Invoice;
  createTaxInvoice: (invoiceData: Omit<Invoice, 'id' | 'createdAt'>) => Invoice;
  recordPayment: (paymentParams: Parameters<typeof postPaymentVoucher>[0]) => Payment;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  deletePayment: (id: string) => { success: boolean; message?: string };
  recordContraTransfer: (sourceAccountId: string, destAccountId: string, amount: number, referenceNo: string) => void;
  recordExpense: (expenseData: Omit<Expense, 'id' | 'voucherNo' | 'createdAt'>) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => { success: boolean; message?: string };
  payUnpaidExpense: (expenseId: string, accountId: string, paymentMode: 'CASH' | 'BANK') => void;
  reverseExpense: (expenseId: string, reason: string) => Expense;

  // Small-Business Finance: Salary, Labour, Contractor, Daily Closing
  salaryRecords: MonthlySalaryRecord[];
  employeeAdvances: EmployeeAdvance[];
  dailyLabourEntries: DailyLabourEntry[];
  labourPayments: LabourPayment[];
  contractors: Contractor[];
  contractorWorkEntries: ContractorWorkEntry[];
  contractorPayments: ContractorPayment[];
  dailyCashClosings: DailyCashClosingRecord[];
  issueEmployeeAdvance: (params: { employeeId: string; employeeName: string; amount: number; paymentMode: 'CASH' | 'BANK'; accountId: string; notes?: string }) => Promise<EmployeeAdvance>;
  recordSalaryPayment: (params: Omit<MonthlySalaryRecord, 'id' | 'createdAt' | 'createdBy'>) => Promise<MonthlySalaryRecord>;
  updateSalaryRecord: (id: string, updates: Partial<MonthlySalaryRecord>) => void;
  deleteSalaryRecord: (id: string) => { success: boolean; message?: string };
  paySalaryInstallment: (params: { salaryRecordId: string; amount: number; paymentMode: 'CASH' | 'BANK'; accountId: string; notes?: string }) => Promise<{ success: boolean; message: string; salaryRecord?: MonthlySalaryRecord }>;
  reverseSalaryRecord: (salaryId: string, reason: string) => MonthlySalaryRecord;
  recordDailyLabour: (params: Omit<DailyLabourEntry, 'id' | 'createdAt' | 'createdBy'>) => Promise<DailyLabourEntry>;
  updateDailyLabour: (id: string, updates: Partial<DailyLabourEntry>) => void;
  deleteDailyLabour: (id: string) => { success: boolean; message?: string };
  reverseDailyLabour: (labourId: string, reason: string) => DailyLabourEntry;
  recordLabourPayment: (params: { dailyLabourId: string; workerNameOrGroup: string; amount: number; paymentMode: 'CASH' | 'BANK'; accountId: string; notes?: string }) => Promise<LabourPayment>;
  addContractor: (params: Omit<Contractor, 'id' | 'createdAt'>) => Contractor;
  updateContractor: (id: string, updates: Partial<Contractor>) => void;
  deleteContractor: (id: string) => { success: boolean; message?: string };
  recordContractorWork: (params: Omit<ContractorWorkEntry, 'id' | 'createdAt' | 'createdBy'>) => Promise<ContractorWorkEntry>;
  updateContractorWork: (id: string, updates: Partial<ContractorWorkEntry>) => void;
  deleteContractorWork: (id: string) => { success: boolean; message?: string };
  reverseContractorWork: (workId: string, reason: string) => ContractorWorkEntry;
  payContractorWork: (workEntryId: string, amount: number, paymentMode: 'CASH' | 'BANK', accountId?: string) => Promise<ContractorPayment>;
  getAuthoritativeProfitAndLossReport: (fromDate?: string, toDate?: string) => ReturnType<typeof calculateAuthoritativeProfitAndLoss>;
  recordDailyCashClosing: (closingData: Omit<DailyCashClosingRecord, 'id' | 'closedAt' | 'closedBy'>) => DailyCashClosingRecord;
  getAccountBalance: (accountId: string) => number;
  addAccount: (accData: Omit<CashBankAccount, 'id'>) => CashBankAccount;
  updateAccount: (id: string, updates: Partial<CashBankAccount>) => void;
  deleteAccount: (id: string) => { success: boolean; message?: string };
  updateAccountTransaction: (id: string, updates: Partial<AccountTransaction>) => void;
  deleteAccountTransaction: (id: string) => { success: boolean; message?: string };
  updateWeighment: (id: string, updates: Partial<Weighment>) => void;
  deleteWeighment: (id: string) => { success: boolean; message?: string };
  updateCollectionJob: (id: string, updates: Partial<CollectionJob>) => void;
  deleteCollectionJob: (id: string) => { success: boolean; message?: string };
  updateSalesOrder: (id: string, updates: Partial<SalesHeader>) => void;
  deleteSalesOrder: (id: string) => { success: boolean; message?: string };
  updateTaxInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteTaxInvoice: (id: string) => { success: boolean; message?: string };
  markAttendance: (employeeId: string, date: string, status: AttendanceStatus, overtimeHours?: number, remarks?: string) => void;
  updateAttendanceEntry: (id: string, updates: Partial<AttendanceEntry>) => void;
  deleteAttendanceEntry: (id: string) => { success: boolean; message?: string };
  addAttendanceRecord: (entryData: Omit<AttendanceEntry, 'id'>) => AttendanceEntry;
  reconcileStockCount: (yardId: string, lines: { materialId: string; physicalQuantity: number; reason?: string }[], notes?: string) => StockCount;
  
  // Data Migration & Backups
  importParties: (rows: any[], dryRun: boolean) => ReturnType<typeof migrateParties>;
  importOpeningStock: (rows: any[], dryRun: boolean) => ReturnType<typeof migrateOpeningStock>;
  resetToDemoData: () => void;
  exportBackup: () => string;
  restoreBackup: (jsonStr: string) => boolean;

  // Phase 5 Dedicated Backup & Restore Manager
  backupHistory: BackupHistoryItem[];
  restoreLogs: RestoreLog[];
  backupSchedule: BackupScheduleConfig;
  createBackup: (options?: {
    companyScoped?: boolean;
    isEncrypted?: boolean;
    password?: string;
    destination?: BackupDestination;
  }) => Promise<{ success: boolean; filename: string; checksum: string; error?: string; rawJson?: string }>;
  previewRestore: (
    fileContent: string,
    password?: string
  ) => Promise<RestorePreviewResult>;
  executeSystemRestore: (
    fileContent: string,
    password?: string,
    mode?: 'FULL' | 'COMPANY_SCOPED'
  ) => Promise<{ success: boolean; recordsRestored: number; error?: string }>;
  updateScheduleConfig: (updates: Partial<BackupScheduleConfig>) => void;
  exportCsvRegister: (registerType: 'CUSTOMERS' | 'SUPPLIERS' | 'INVOICES' | 'PURCHASES' | 'EXPENSES' | 'STOCK') => string;

  // Phase 6 Excel Workbooks
  exportSingleExcelWorkbook: (filename: string) => void;
  exportAllExcelWorkbooks: () => Promise<void>;
  exportConsolidatedMasterWorkbook: () => void;

  // Daily Tasks & Work Notes
  dailyTasks: DailyTask[];
  createDailyTask: (task: Omit<DailyTask, 'id' | 'createdAt'>) => DailyTask;
  updateDailyTask: (id: string, updates: Partial<DailyTask>) => void;
  toggleDailyTask: (id: string) => void;
  deleteDailyTask: (id: string) => void;

  workNotes: WorkNote[];
  createWorkNote: (note: Omit<WorkNote, 'id' | 'updatedAt'>) => WorkNote;
  updateWorkNote: (id: string, updates: Partial<WorkNote>) => void;
  deleteWorkNote: (id: string) => void;

  // Uploaded Historical Documents (Vehicle Docs, Previous Invoices, Previous POs, Quotations)
  uploadedDocuments: UploadedDocument[];
  createUploadedDocument: (doc: Omit<UploadedDocument, 'id' | 'createdAt'>) => UploadedDocument;
  deleteUploadedDocument: (id: string) => void;

  // Option 2 & 3: Multi-Member Team Cloud Sync & Daily Snapshots
  getCurrentDatabasePayload: () => BackupDatabasePayload;
  applyRestoredPayload: (data: BackupDatabasePayload) => void;
  syncPushToCloud: (actorOverride?: string) => Promise<{ success: boolean; revision: number; error?: string }>;
  syncPullFromCloud: () => Promise<{ success: boolean; payload?: BackupDatabasePayload; revision?: number; syncedBy?: string; syncedAt?: string; error?: string }>;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

const STORAGE_PREFIX = 'yasoth_erp_v1_';

export const ERPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserSession>(() => {
    const existing = authService.getSession();
    return existing || {
      id: 'usr-admin-01',
      email: 'admin@yasoth.com',
      fullName: 'Yasoth Owner Admin',
      role: 'owner_admin',
      companyId: 'a0000000-0000-0000-0000-000000000001',
      token: 'tok_default_admin',
      expiresAt: Date.now() + 8 * 3600 * 1000,
      lastActiveAt: Date.now(),
    };
  });

  const load = <T,>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  };

  const [companies, setCompanies] = useState<Company[]>(() => {
    const loaded = load<Company[]>('companies', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_COMPANIES;
  });
  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'activeCompanyId');
    return saved || 'comp-yasoth-01';
  });

  const activeCompany: Company = companies.find((c) => c.id === activeCompanyId) || companies[0] || INITIAL_COMPANY_SETTINGS;
  const company: CompanySettings = activeCompany;

  const [yards, setYards] = useState<Yard[]>(() => load('yards', INITIAL_YARDS));
  const [materials, setMaterials] = useState<Material[]>(() => load('materials', INITIAL_MATERIALS));
  const [materialGrades, setMaterialGrades] = useState<MaterialGrade[]>(() => load('materialGrades', INITIAL_MATERIAL_GRADES));
  const [parties, setParties] = useState<Party[]>(() => {
    const loaded = load<Party[]>('parties', []);
    if (!loaded || loaded.length === 0) return INITIAL_PARTIES;
    const existingIds = new Set(loaded.map((p) => p.id));
    const missing = INITIAL_PARTIES.filter((p) => !existingIds.has(p.id));
    return [...loaded, ...missing];
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => load('vehicles', INITIAL_VEHICLES));
  const [vehicleDocuments, setVehicleDocuments] = useState<VehicleDocument[]>(() => load('vehicleDocuments', INITIAL_VEHICLE_DOCS));
  const [employees, setEmployees] = useState<Employee[]>(() => load('employees', INITIAL_EMPLOYEES));
  const [attendance, setAttendance] = useState<AttendanceEntry[]>(() => load('attendance', INITIAL_ATTENDANCE));
  const [accounts, setAccounts] = useState<CashBankAccount[]>(() => load('accounts', INITIAL_ACCOUNTS));
  const [accountTransactions, setAccountTransactions] = useState<AccountTransaction[]>(() => load('accountTransactions', INITIAL_ACCOUNT_TRANSACTIONS));
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const loaded = load<Expense[]>('expenses', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_EXPENSES;
  });
  const [weighments, setWeighments] = useState<Weighment[]>(() => load('weighments', []));
  const [collectionJobs, setCollectionJobs] = useState<CollectionJob[]>(() => load('collectionJobs', []));
  const [purchases, setPurchases] = useState<PurchaseHeader[]>(() => load('purchases', []));
  const [inventoryLots, setInventoryLots] = useState<InventoryLot[]>(() => load('inventoryLots', INITIAL_LOTS));
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => load('stockMovements', INITIAL_STOCK_MOVEMENTS));
  const [sales, setSales] = useState<SalesHeader[]>(() => load('sales', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const loaded = load<Invoice[]>('invoices', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_INVOICES;
  });
  const [payments, setPayments] = useState<Payment[]>(() => load('payments', []));
  const [stockCounts, setStockCounts] = useState<StockCount[]>(() => load('stockCounts', []));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => load('auditLogs', []));
  const [commercialDocuments, setCommercialDocuments] = useState<CommercialDocument[]>(() => {
    const loaded = load<CommercialDocument[]>('commercialDocuments', []);
    if (!loaded || loaded.length === 0) return INITIAL_COMMERCIAL_DOCUMENTS;
    const existingIds = new Set(loaded.map((d) => d.id));
    const missing = INITIAL_COMMERCIAL_DOCUMENTS.filter((d) => !existingIds.has(d.id));
    return [...missing, ...loaded];
  });
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
    const loaded = load<JournalEntry[]>('journalEntries', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_JOURNAL_ENTRIES;
  });
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>(() => {
    const loaded = load<BackupHistoryItem[]>('backupHistory', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_BACKUP_HISTORY;
  });
  const [restoreLogs, setRestoreLogs] = useState<RestoreLog[]>(() => {
    const loaded = load<RestoreLog[]>('restoreLogs', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_RESTORE_LOGS;
  });
  const [backupSchedule, setBackupSchedule] = useState<BackupScheduleConfig>(() => {
    const loaded = load<BackupScheduleConfig>('backupSchedule', INITIAL_BACKUP_SCHEDULE);
    return loaded || INITIAL_BACKUP_SCHEDULE;
  });
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>(() => {
    const loaded = load<DailyTask[]>('dailyTasks', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_DAILY_TASKS;
  });
  const [workNotes, setWorkNotes] = useState<WorkNote[]>(() => {
    const loaded = load<WorkNote[]>('workNotes', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_WORK_NOTES;
  });
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>(() => {
    const loaded = load<UploadedDocument[]>('uploadedDocuments', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_UPLOADED_DOCS;
  });
  const [salaryRecords, setSalaryRecords] = useState<MonthlySalaryRecord[]>(() => load('salaryRecords', INITIAL_SALARY_RECORDS));
  const [employeeAdvances, setEmployeeAdvances] = useState<EmployeeAdvance[]>(() => load('employeeAdvances', INITIAL_EMPLOYEE_ADVANCES));
  const [dailyLabourEntries, setDailyLabourEntries] = useState<DailyLabourEntry[]>(() => load('dailyLabourEntries', INITIAL_DAILY_LABOUR));
  const [labourPayments, setLabourPayments] = useState<LabourPayment[]>(() => load('labourPayments', INITIAL_LABOUR_PAYMENTS));
  const [contractors, setContractors] = useState<Contractor[]>(() => load('contractors', INITIAL_CONTRACTORS));
  const [contractorWorkEntries, setContractorWorkEntries] = useState<ContractorWorkEntry[]>(() => load('contractorWorkEntries', INITIAL_CONTRACTOR_WORK));
  const [contractorPayments, setContractorPayments] = useState<ContractorPayment[]>(() => load('contractorPayments', INITIAL_CONTRACTOR_PAYMENTS));
  const [dailyCashClosings, setDailyCashClosings] = useState<DailyCashClosingRecord[]>(() => load('dailyCashClosings', INITIAL_DAILY_CASH_CLOSINGS));

  // Persist state updates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'companies', JSON.stringify(companies));
      localStorage.setItem(STORAGE_PREFIX + 'activeCompanyId', activeCompanyId);
      localStorage.setItem(STORAGE_PREFIX + 'company', JSON.stringify(company));
      localStorage.setItem(STORAGE_PREFIX + 'yards', JSON.stringify(yards));
      localStorage.setItem(STORAGE_PREFIX + 'materials', JSON.stringify(materials));
      localStorage.setItem(STORAGE_PREFIX + 'parties', JSON.stringify(parties));
      localStorage.setItem(STORAGE_PREFIX + 'vehicles', JSON.stringify(vehicles));
      localStorage.setItem(STORAGE_PREFIX + 'vehicleDocuments', JSON.stringify(vehicleDocuments));
      localStorage.setItem(STORAGE_PREFIX + 'employees', JSON.stringify(employees));
      localStorage.setItem(STORAGE_PREFIX + 'attendance', JSON.stringify(attendance));
      localStorage.setItem(STORAGE_PREFIX + 'accounts', JSON.stringify(accounts));
      localStorage.setItem(STORAGE_PREFIX + 'accountTransactions', JSON.stringify(accountTransactions));
      localStorage.setItem(STORAGE_PREFIX + 'expenses', JSON.stringify(expenses));
      localStorage.setItem(STORAGE_PREFIX + 'weighments', JSON.stringify(weighments));
      localStorage.setItem(STORAGE_PREFIX + 'collectionJobs', JSON.stringify(collectionJobs));
      localStorage.setItem(STORAGE_PREFIX + 'purchases', JSON.stringify(purchases));
      localStorage.setItem(STORAGE_PREFIX + 'inventoryLots', JSON.stringify(inventoryLots));
      localStorage.setItem(STORAGE_PREFIX + 'stockMovements', JSON.stringify(stockMovements));
      localStorage.setItem(STORAGE_PREFIX + 'sales', JSON.stringify(sales));
      localStorage.setItem(STORAGE_PREFIX + 'invoices', JSON.stringify(invoices));
      localStorage.setItem(STORAGE_PREFIX + 'payments', JSON.stringify(payments));
      localStorage.setItem(STORAGE_PREFIX + 'stockCounts', JSON.stringify(stockCounts));
      localStorage.setItem(STORAGE_PREFIX + 'auditLogs', JSON.stringify(auditLogs));
      localStorage.setItem(STORAGE_PREFIX + 'commercialDocuments', JSON.stringify(commercialDocuments));
      localStorage.setItem(STORAGE_PREFIX + 'journalEntries', JSON.stringify(journalEntries));
      localStorage.setItem(STORAGE_PREFIX + 'backupHistory', JSON.stringify(backupHistory));
      localStorage.setItem(STORAGE_PREFIX + 'restoreLogs', JSON.stringify(restoreLogs));
      localStorage.setItem(STORAGE_PREFIX + 'backupSchedule', JSON.stringify(backupSchedule));
      localStorage.setItem(STORAGE_PREFIX + 'dailyTasks', JSON.stringify(dailyTasks));
      localStorage.setItem(STORAGE_PREFIX + 'workNotes', JSON.stringify(workNotes));
      localStorage.setItem(STORAGE_PREFIX + 'uploadedDocuments', JSON.stringify(uploadedDocuments));
      localStorage.setItem(STORAGE_PREFIX + 'salaryRecords', JSON.stringify(salaryRecords));
      localStorage.setItem(STORAGE_PREFIX + 'employeeAdvances', JSON.stringify(employeeAdvances));
      localStorage.setItem(STORAGE_PREFIX + 'dailyLabourEntries', JSON.stringify(dailyLabourEntries));
      localStorage.setItem(STORAGE_PREFIX + 'labourPayments', JSON.stringify(labourPayments));
      localStorage.setItem(STORAGE_PREFIX + 'contractors', JSON.stringify(contractors));
      localStorage.setItem(STORAGE_PREFIX + 'contractorWorkEntries', JSON.stringify(contractorWorkEntries));
      localStorage.setItem(STORAGE_PREFIX + 'contractorPayments', JSON.stringify(contractorPayments));
      localStorage.setItem(STORAGE_PREFIX + 'dailyCashClosings', JSON.stringify(dailyCashClosings));
    } catch (e) {
      console.warn('Error saving to localStorage', e);
    }
  }, [
    company, yards, materials, parties, vehicles, vehicleDocuments,
    employees, attendance, accounts, accountTransactions, expenses,
    weighments, collectionJobs, purchases, inventoryLots, stockMovements,
    sales, invoices, payments, stockCounts, auditLogs, commercialDocuments, journalEntries,
    backupHistory, restoreLogs, backupSchedule, dailyTasks, workNotes, uploadedDocuments,
    salaryRecords, employeeAdvances, dailyLabourEntries, labourPayments, contractors, contractorWorkEntries, contractorPayments, dailyCashClosings
  ]);

  const logAudit = (action: string, entityType: string, entityId: string, oldState?: any, newState?: any) => {
    const entry: AuditLog = {
      id: 'aud-' + Math.random().toString(36).substring(2, 11),
      actorId: currentUser.id,
      actorName: `${currentUser.fullName} (${currentUser.role})`,
      action,
      entityType,
      entityId,
      oldState: oldState ? JSON.stringify(oldState) : undefined,
      newState: newState ? JSON.stringify(newState) : undefined,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  const login = async (email: string, password: string) => {
    const res = await authService.signIn(email, password);
    if (res.session) {
      setCurrentUser(res.session);
      logAudit('LOGIN_SUCCESS', 'SECURITY_AUTH', res.session.id, null, { email: res.session.email, role: res.session.role });
    } else {
      logAudit('LOGIN_FAILED', 'SECURITY_AUTH', 'anonymous', null, { email, error: res.error });
    }
    return res;
  };

  const logout = () => {
    const prevUser = currentUser;
    authService.signOut();
    const guestSession: UserSession = {
      id: 'usr-guest',
      email: 'guest@yasoth.com',
      fullName: 'Signed Out (Guest)',
      role: 'auditor',
      expiresAt: Date.now() + 3600 * 1000,
      lastActiveAt: Date.now(),
    };
    setCurrentUser(guestSession);
    logAudit('LOGOUT', 'SECURITY_AUTH', prevUser.id, { user: prevUser.email }, null);
  };

  const register = async (params: Parameters<typeof authService.signUp>[0]) => {
    const res = await authService.signUp(params);
    if (res.user) {
      logAudit('REGISTER_USER', 'SECURITY_AUTH', res.user.id, null, { email: res.user.email, role: res.user.role });
    }
    return res;
  };

  const requestPasswordRecovery = async (email: string) => {
    const res = await authService.requestPasswordRecovery(email);
    logAudit('PASSWORD_RECOVERY_REQUEST', 'SECURITY_AUTH', email, null, res);
    return res;
  };

  const switchRole = (role: UserRole) => {
    if (currentUser.role !== 'owner_admin' && role === 'owner_admin') {
      logAudit('ROLE_ELEVATION_REJECTED', 'SECURITY_AUTH', currentUser.id, { role: currentUser.role }, { requested: role });
      throw new AuthorizationError('Role elevation to owner_admin requires administrative credentials.', 'FORBIDDEN');
    }
    setCurrentUser((prev) => ({
      ...prev,
      role,
      fullName: role === 'owner_admin' ? 'Yasoth Admin' : role.replace('_', ' ').toUpperCase(),
    }));
    logAudit('SWITCH_ROLE', 'USER', currentUser.id, null, { role });
  };

  const checkPermission = (action: PermissionAction): boolean => {
    return hasPermission(currentUser.role, action);
  };

  const switchCompany = (companyId: string) => {
    const exists = companies.find((c) => c.id === companyId);
    if (!exists) {
      throw new Error(`Company with id "${companyId}" not found.`);
    }
    setActiveCompanyId(companyId);
    setCurrentUser((prev) => ({ ...prev, companyId }));
    logAudit('SWITCH_COMPANY', 'COMPANY', companyId, activeCompanyId, { companyId, name: exists.name });
  };

  const registerCompany = (input: CompanyRegistrationInput): Company => {
    enforceAuthorization(currentUser, 'company:edit', activeCompanyId);
    const newComp = validateCompanyRegistration(input, companies);
    setCompanies((prev) => [...prev, newComp]);
    logAudit('REGISTER_COMPANY', 'COMPANY', newComp.id, null, newComp);
    return newComp;
  };

  const updateCompany = (id: string, updates: Partial<Company>) => {
    enforceAuthorization(currentUser, 'company:edit', id);
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)));
    logAudit('UPDATE_COMPANY', 'COMPANY', id, null, updates);
  };

  const updateCompanySettings = (settings: Partial<CompanySettings>) => {
    updateCompany(activeCompanyId, settings);
  };

  const addParty = (partyData: Omit<Party, 'id'>) => {
    const newParty: Party = {
      ...partyData,
      id: 'pty-' + Math.random().toString(36).substring(2, 11),
    };
    setParties((prev) => [newParty, ...prev]);
    logAudit('CREATE_PARTY', 'PARTY', newParty.id, null, newParty);
    return newParty;
  };

  const updateParty = (id: string, updates: Partial<Party>) => {
    const existing = parties.find((p) => p.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setParties((prev) => prev.map((p) => (p.id === id ? updated : p)));
    logAudit('UPDATE_PARTY', 'PARTY', id, existing, updated);
  };

  const deleteParty = (id: string): { success: boolean; message?: string } => {
    const existing = parties.find((p) => p.id === id);
    if (!existing) return { success: false, message: 'Party not found.' };

    const hasPurchases = purchases.some((p) => p.supplierPartyId === id);
    const hasSales = sales.some((s) => s.customerPartyId === id);
    const hasInvoices = invoices.some((i) => i.customerPartyId === id);
    const hasPayments = payments.some((p) => p.partyId === id);

    if (hasPurchases || hasSales || hasInvoices || hasPayments) {
      setParties((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: false } : p)));
      logAudit('DEACTIVATE_PARTY', 'PARTY', id, existing, { isActive: false });
      return {
        success: true,
        message: `Party "${existing.legalName}" has transaction history so it has been marked Inactive to preserve audit trails.`,
      };
    }

    setParties((prev) => prev.filter((p) => p.id !== id));
    logAudit('DELETE_PARTY', 'PARTY', id, existing, null);
    return { success: true, message: `Party "${existing.legalName}" deleted successfully.` };
  };

  const addMaterial = (matData: Omit<Material, 'id'>) => {
    const newMat: Material = {
      ...matData,
      id: 'mat-' + Math.random().toString(36).substring(2, 11),
    };
    setMaterials((prev) => [newMat, ...prev]);
    logAudit('CREATE_MATERIAL', 'MATERIAL', newMat.id, null, newMat);
    return newMat;
  };

  const updateMaterial = (id: string, updates: Partial<Material>) => {
    const existing = materials.find((m) => m.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setMaterials((prev) => prev.map((m) => (m.id === id ? updated : m)));
    logAudit('UPDATE_MATERIAL', 'MATERIAL', id, existing, updated);
  };

  const deleteMaterial = (id: string): { success: boolean; message?: string } => {
    const existing = materials.find((m) => m.id === id);
    if (!existing) return { success: false, message: 'Material not found.' };

    const hasLots = inventoryLots.some((l) => l.materialId === id && l.remainingQuantity > 0);
    const hasMovements = stockMovements.some((m) => m.materialId === id);
    const hasPurchases = purchases.some((p) => p.lines.some((l) => l.materialId === id));
    const hasSales = sales.some((s) => s.lines.some((l) => l.materialId === id));

    if (hasLots || hasMovements || hasPurchases || hasSales) {
      setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, isActive: false } : m)));
      logAudit('DEACTIVATE_MATERIAL', 'MATERIAL', id, existing, { isActive: false });
      return {
        success: true,
        message: `Material "${existing.name}" is linked to existing stock or transactions. It has been deactivated instead of permanently deleted.`,
      };
    }

    setMaterials((prev) => prev.filter((m) => m.id !== id));
    logAudit('DELETE_MATERIAL', 'MATERIAL', id, existing, null);
    return { success: true, message: `Material "${existing.name}" deleted successfully.` };
  };

  const addVehicle = (vehData: Omit<Vehicle, 'id'>) => {
    const newVeh: Vehicle = {
      ...vehData,
      id: 'veh-' + Math.random().toString(36).substring(2, 11),
    };
    setVehicles((prev) => [newVeh, ...prev]);
    logAudit('CREATE_VEHICLE', 'VEHICLE', newVeh.id, null, newVeh);
    return newVeh;
  };

  const updateVehicle = (id: string, updates: Partial<Vehicle>) => {
    const existing = vehicles.find((v) => v.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setVehicles((prev) => prev.map((v) => (v.id === id ? updated : v)));
    logAudit('UPDATE_VEHICLE', 'VEHICLE', id, existing, updated);
  };

  const deleteVehicle = (id: string): { success: boolean; message?: string } => {
    const existing = vehicles.find((v) => v.id === id);
    if (!existing) return { success: false, message: 'Vehicle not found.' };
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    setVehicleDocuments((prev) => prev.filter((d) => d.vehicleId !== id));
    logAudit('DELETE_VEHICLE', 'VEHICLE', id, existing, null);
    return { success: true, message: `Vehicle "${existing.registrationNo}" deleted successfully.` };
  };

  const addVehicleDocument = (docData: Omit<VehicleDocument, 'id'>): VehicleDocument => {
    const newDoc: VehicleDocument = {
      ...docData,
      companyId: docData.companyId || activeCompanyId,
      id: 'vdoc-' + Math.random().toString(36).substring(2, 11),
    };
    setVehicleDocuments((prev) => [newDoc, ...prev]);
    logAudit('ADD_VEHICLE_DOCUMENT', 'VEHICLE_DOCUMENT', newDoc.id, null, newDoc);
    return newDoc;
  };

  const updateVehicleDocument = (id: string, updates: Partial<VehicleDocument>) => {
    const existing = vehicleDocuments.find((d) => d.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setVehicleDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    logAudit('UPDATE_VEHICLE_DOCUMENT', 'VEHICLE_DOCUMENT', id, existing, updated);
  };

  const deleteVehicleDocument = (id: string): { success: boolean; message?: string } => {
    const existing = vehicleDocuments.find((d) => d.id === id);
    if (!existing) return { success: false, message: 'Vehicle document not found.' };
    setVehicleDocuments((prev) => prev.filter((d) => d.id !== id));
    logAudit('DELETE_VEHICLE_DOCUMENT', 'VEHICLE_DOCUMENT', id, existing, null);
    return { success: true, message: `${existing.documentType} record removed.` };
  };

  const renewVehicleDocument = (
    id: string,
    newExpiryDate?: string,
    newDocNumber?: string
  ): VehicleDocument | null => {
    const existing = vehicleDocuments.find((d) => d.id === id);
    if (!existing) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    const baseMs =
      existing.expiryDate && new Date(existing.expiryDate).getTime() > Date.now()
        ? new Date(existing.expiryDate).getTime()
        : Date.now();
    const daysToAdd = existing.documentType === 'POLLUTION' ? 180 : 365;
    const computedExpiry =
      newExpiryDate || new Date(baseMs + daysToAdd * 24 * 3600 * 1000).toISOString().split('T')[0];

    const updated: VehicleDocument = {
      ...existing,
      issueDate: todayStr,
      expiryDate: computedExpiry,
      documentNumber: newDocNumber || existing.documentNumber,
      notes: `Renewed on ${todayStr} by ${currentUser.fullName}`,
    };
    setVehicleDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    logAudit('RENEW_VEHICLE_DOCUMENT', 'VEHICLE_DOCUMENT', id, existing, updated);
    return updated;
  };

  const addEmployee = (empData: Omit<Employee, 'id'>) => {
    const newEmp: Employee = {
      ...empData,
      id: 'emp-' + Math.random().toString(36).substring(2, 11),
    };
    setEmployees((prev) => [newEmp, ...prev]);
    logAudit('CREATE_EMPLOYEE', 'EMPLOYEE', newEmp.id, null, newEmp);
    return newEmp;
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    const existing = employees.find((e) => e.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setEmployees((prev) => prev.map((e) => (e.id === id ? updated : e)));
    logAudit('UPDATE_EMPLOYEE', 'EMPLOYEE', id, existing, updated);
  };

  const deleteEmployee = (id: string): { success: boolean; message?: string } => {
    const existing = employees.find((e) => e.id === id);
    if (!existing) return { success: false, message: 'Employee not found.' };
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    logAudit('DELETE_EMPLOYEE', 'EMPLOYEE', id, existing, null);
    return { success: true, message: `Employee "${existing.fullName}" deleted successfully.` };
  };

  const updatePurchase = (id: string, updates: Partial<PurchaseHeader>) => {
    const existing = purchases.find((p) => p.id === id);
    if (!existing) return;
    if (existing.status === 'POSTED') {
      throw new Error('Posted purchases cannot be modified as stock has already moved into inventory.');
    }
    const updated = { ...existing, ...updates };
    setPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
    logAudit('UPDATE_PURCHASE', 'PURCHASE', id, existing, updated);
  };

  const deletePurchase = (id: string): { success: boolean; message?: string } => {
    const existing = purchases.find((p) => p.id === id);
    if (!existing) return { success: false, message: 'Purchase not found.' };
    if (existing.status === 'POSTED') {
      return { success: false, message: 'Posted purchases have affected stock ledgers and cannot be deleted.' };
    }
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    logAudit('DELETE_PURCHASE', 'PURCHASE', id, existing, null);
    return { success: true, message: `Purchase "${existing.purchaseNo}" deleted.` };
  };

  const recordWeighment = (data: Omit<Weighment, 'id' | 'weighmentNo' | 'netWeight' | 'payableWeight' | 'createdAt'>) => {
    const netWeight = calcNetWeight(data.grossWeight, data.tareWeight);
    const payableWeight = calcPayableWeight(data.grossWeight, data.tareWeight, data.approvedDeductions);
    const seq = weighments.length + 1;
    const weighmentNo = `WM-26-${String(seq).padStart(4, '0')}`;

    const newWeighment: Weighment = {
      ...data,
      id: 'wm-' + Math.random().toString(36).substring(2, 11),
      weighmentNo,
      netWeight,
      payableWeight,
      createdAt: new Date().toISOString(),
    };

    setWeighments((prev) => [newWeighment, ...prev]);
    logAudit('RECORD_WEIGHMENT', 'WEIGHMENT', newWeighment.id, null, newWeighment);
    return newWeighment;
  };

  const createPurchase = (purchaseData: Omit<PurchaseHeader, 'id' | 'purchaseNo' | 'createdAt'>) => {
    const seq = purchases.length + 1;
    const purchaseNo = `PUR-26-${String(seq).padStart(4, '0')}`;
    const newPurchase: PurchaseHeader = {
      ...purchaseData,
      id: 'pur-' + Math.random().toString(36).substring(2, 11),
      purchaseNo,
      createdAt: new Date().toISOString(),
    };
    setPurchases((prev) => [newPurchase, ...prev]);
    logAudit('CREATE_PURCHASE', 'PURCHASE', newPurchase.id, null, newPurchase);
    return newPurchase;
  };

  const postPurchase = (purchaseId: string) => {
    enforceAuthorization(currentUser, 'purchase:post', company.id);
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (!purchase) throw new Error('Purchase record not found');

    const result = postPurchaseTransaction(purchase, stockMovements, currentUser.fullName);

    setPurchases((prev) => prev.map((p) => (p.id === purchaseId ? result.updatedPurchase : p)));
    setInventoryLots((prev) => [...result.newLots, ...prev]);
    setStockMovements((prev) => [...result.newMovements, ...prev]);

    // Automatically post balanced double-entry journal
    try {
      const supplier = parties.find((p) => p.id === purchase.supplierPartyId);
      const je = createPurchaseInvoiceJournal(result.updatedPurchase, supplier, activeCompany);
      setJournalEntries((prev) => [je, ...prev]);
    } catch (e) {
      console.warn('Could not post journal for purchase:', e);
    }

    logAudit('POST_PURCHASE', 'PURCHASE', purchaseId, purchase, result.updatedPurchase);
  };

  const createCollectionJob = (jobData: Omit<CollectionJob, 'id' | 'jobNo' | 'createdAt'>) => {
    const seq = collectionJobs.length + 1;
    const jobNo = `COL-26-${String(seq).padStart(4, '0')}`;
    const newJob: CollectionJob = {
      ...jobData,
      id: 'col-' + Math.random().toString(36).substring(2, 11),
      jobNo,
      createdAt: new Date().toISOString(),
    };
    setCollectionJobs((prev) => [newJob, ...prev]);
    logAudit('CREATE_COLLECTION', 'COLLECTION_JOB', newJob.id, null, newJob);
    return newJob;
  };

  const updateCollectionStatus = (
    jobId: string, 
    status: CollectionStatus, 
    actualWeight?: number, 
    transportExpenses?: number
  ) => {
    setCollectionJobs((prev) =>
      prev.map((job) => {
        if (job.id === jobId) {
          const updated = {
            ...job,
            status,
            actualWeight: actualWeight !== undefined ? actualWeight : job.actualWeight,
            transportExpenses: transportExpenses !== undefined ? transportExpenses : job.transportExpenses,
          };
          logAudit('UPDATE_COLLECTION_STATUS', 'COLLECTION_JOB', jobId, job, updated);
          return updated;
        }
        return job;
      })
    );
  };

  const createSalesOrder = (salesData: Omit<SalesHeader, 'id' | 'salesNo' | 'createdAt'>) => {
    const seq = sales.length + 1;
    const salesNo = `SO-26-${String(seq).padStart(4, '0')}`;
    const newSales: SalesHeader = {
      ...salesData,
      id: 'so-' + Math.random().toString(36).substring(2, 11),
      salesNo,
      createdAt: new Date().toISOString(),
    };
    setSales((prev) => [newSales, ...prev]);
    logAudit('CREATE_SALES_ORDER', 'SALES_HEADER', newSales.id, null, newSales);
    return newSales;
  };

  const dispatchSalesOrder = (salesId: string) => {
    enforceAuthorization(currentUser, 'sales:dispatch', company.id);
    const salesOrder = sales.find((s) => s.id === salesId);
    if (!salesOrder) throw new Error('Sales order not found');

    const customer = parties.find((p) => p.id === salesOrder.customerPartyId);
    if (!customer) throw new Error('Customer party not found');

    const nextInvoiceSeq = invoices.length + 10; // Start aligned with verified sample invoice 10

    const result = dispatchSalesTransaction(
      salesOrder,
      inventoryLots,
      stockMovements,
      customer,
      company,
      nextInvoiceSeq,
      currentUser.fullName
    );

    setSales((prev) => prev.map((s) => (s.id === salesId ? result.updatedSales : s)));
    setInventoryLots(result.updatedLots);
    setStockMovements((prev) => [...result.newMovements, ...prev]);
    setInvoices((prev) => [result.generatedInvoice, ...prev]);

    logAudit('DISPATCH_SALES', 'SALES_HEADER', salesId, salesOrder, result.updatedSales);
    logAudit('GENERATE_INVOICE', 'INVOICE', result.generatedInvoice.id, null, result.generatedInvoice);

    // Automatically post balanced double-entry journal
    try {
      const je = createSalesInvoiceJournal(result.generatedInvoice, activeCompany);
      setJournalEntries((prev) => [je, ...prev]);
    } catch (e) {
      console.warn('Could not post journal for sales dispatch:', e);
    }

    return result.generatedInvoice;
  };

  const createTaxInvoice = (invoiceData: Omit<Invoice, 'id' | 'createdAt'>): Invoice => {
    enforceAuthorization(currentUser, 'invoice:create', activeCompanyId);
    const now = new Date().toISOString();
    const newInvoice: Invoice = {
      companyId: invoiceData.companyId || activeCompanyId,
      ...invoiceData,
      id: 'inv-' + Math.random().toString(36).substring(2, 11),
      createdAt: now,
      immutableSnapshotJson: '',
    };
    newInvoice.immutableSnapshotJson = JSON.stringify(newInvoice);

    setInvoices((prev) => [newInvoice, ...prev]);
    logAudit('CREATE_TAX_INVOICE', 'INVOICE', newInvoice.id, null, newInvoice);

    // Automatically post balanced double-entry journal
    try {
      const je = createSalesInvoiceJournal(newInvoice, activeCompany);
      setJournalEntries((prev) => [je, ...prev]);
    } catch (e) {
      console.warn('Could not post journal for sales invoice:', e);
    }

    return newInvoice;
  };

  const recordPayment = (params: Parameters<typeof postPaymentVoucher>[0]) => {
    const result = postPaymentVoucher({
      ...params,
      allInvoices: invoices,
      allPurchases: purchases,
      actor: currentUser.fullName,
    });

    setPayments((prev) => [result.updatedPayment, ...prev]);
    setAccountTransactions((prev) => [result.newAccountTransaction, ...prev]);

    if (result.updatedInvoices.length > 0) {
      setInvoices((prev) =>
        prev.map((inv) => {
          const match = result.updatedInvoices.find((u) => u.id === inv.id);
          return match || inv;
        })
      );
    }

    if (result.updatedPurchases.length > 0) {
      setPurchases((prev) =>
        prev.map((pur) => {
          const match = result.updatedPurchases.find((u) => u.id === pur.id);
          return match || pur;
        })
      );
    }

    // Automatically post balanced double-entry journal
    try {
      const party = parties.find((p) => p.id === params.party.id);
      const acc = accounts.find((a) => a.id === params.account.id);
      const accCode = acc?.accountType === 'CASH' ? '1010' : '1020';
      const je = createPaymentJournal(result.updatedPayment, party, accCode, activeCompany);
      setJournalEntries((prev) => [je, ...prev]);
    } catch (e) {
      console.warn('Could not post journal for payment:', e);
    }

    logAudit('RECORD_PAYMENT', 'PAYMENT', result.updatedPayment.id, null, result.updatedPayment);
    return result.updatedPayment;
  };

  const getAccountBalance = (accountId: string): number => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return 0;
    return calculateAccountBalanceFromLedger(acc, accountTransactions);
  };

  const recordContraTransfer = (
    sourceAccountId: string,
    destAccountId: string,
    amount: number,
    referenceNo: string
  ) => {
    const source = accounts.find((a) => a.id === sourceAccountId);
    const dest = accounts.find((a) => a.id === destAccountId);
    if (!source || !dest) throw new Error('Accounts not found for contra transfer');

    const sourceBal = getAccountBalance(sourceAccountId);
    validateContraTransfer({
      fromAccount: source,
      toAccount: dest,
      amount,
      fromAccountBalance: sourceBal,
    });

    const { outflowTx, inflowTx } = executeContraTransfer(
      source,
      dest,
      amount,
      new Date().toISOString().split('T')[0],
      referenceNo,
      currentUser.fullName
    );

    const srcCode = source.accountType === 'CASH' ? '1010' : '1020';
    const dstCode = dest.accountType === 'CASH' ? '1010' : '1020';
    const je = createContraJournal(amount, srcCode, dstCode, new Date().toISOString().split('T')[0], referenceNo, activeCompany);

    setAccountTransactions((prev) => [inflowTx, outflowTx, ...prev]);
    setJournalEntries((prev) => [je, ...prev]);

    logAudit('CONTRA_TRANSFER', 'ACCOUNT_TRANSACTION', `${sourceAccountId}->${destAccountId}`, null, {
      amount,
      referenceNo,
    });
  };

  const recordExpense = (expenseData: Omit<Expense, 'id' | 'voucherNo' | 'createdAt'>) => {
    validateExpenseInput({
      voucherNo: 'EXP-TEMP',
      category: expenseData.category,
      amount: expenseData.amount,
      paidTo: expenseData.paidTo,
      paymentMode: expenseData.paymentMode,
      accountId: expenseData.accountId,
    });

    const isUnpaid = expenseData.status === 'UNPAID' || expenseData.paymentMode === 'UNPAID';
    const acc = expenseData.accountId ? accounts.find((a) => a.id === expenseData.accountId) : undefined;

    if (!isUnpaid && acc) {
      const curBal = getAccountBalance(acc.id);
      validateCashBankTransaction({
        account: acc,
        amount: expenseData.amount,
        direction: 'CREDIT',
        currentBalance: curBal,
      });
    }

    const seq = expenses.length + 1;
    const voucherNo = `EXP-26-${String(seq).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const newExpense: Expense = {
      ...expenseData,
      id: 'exp-' + Math.random().toString(36).substring(2, 11),
      companyId: activeCompanyId,
      voucherNo,
      status: isUnpaid ? 'UNPAID' : 'PAID',
      paymentMode: expenseData.paymentMode || (isUnpaid ? 'UNPAID' : 'CASH'),
      approvalStatus: expenseData.approvalStatus || 'APPROVED',
      enteredBy: expenseData.enteredBy || currentUser.fullName,
      createdAt: now,
    };

    const accCode = acc?.accountType === 'BANK' ? '1020' : '1010';
    const je = createExpenseJournal(newExpense, accCode, activeCompany);

    if (!isUnpaid && expenseData.accountId) {
      const accountTx: AccountTransaction = {
        id: 'atx-' + Math.random().toString(36).substring(2, 11),
        accountId: expenseData.accountId,
        transactionDate: expenseData.expenseDate,
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: expenseData.amount,
        referenceNo: voucherNo,
        description: `Expense: ${expenseData.category} - ${expenseData.paidTo}`,
        createdBy: currentUser.fullName,
        createdAt: now,
      };
      setAccountTransactions((prev) => [accountTx, ...prev]);
    }

    setExpenses((prev) => [newExpense, ...prev]);
    setJournalEntries((prev) => [je, ...prev]);

    if (dbRepository.isRemoteDatabaseAvailable()) {
      dbRepository.saveExpense(newExpense).catch((e) => console.warn('Sync expense to DB failed', e));
    }

    logAudit('RECORD_EXPENSE', 'EXPENSE', newExpense.id, null, newExpense);
    return newExpense;
  };

  const payUnpaidExpense = (expenseId: string, accountId: string, paymentMode: 'CASH' | 'BANK') => {
    const existing = expenses.find((e) => e.id === expenseId);
    if (!existing) throw new Error('Expense not found');
    if (existing.status !== 'UNPAID') throw new Error('Expense is already paid or reversed');

    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) throw new Error('Payment account not found');

    const curBal = getAccountBalance(accountId);
    validateCashBankTransaction({
      account: acc,
      amount: existing.amount,
      direction: 'CREDIT',
      currentBalance: curBal,
    });

    const accCode = acc.accountType === 'BANK' ? '1020' : '1010';
    const je = createPayUnpaidExpenseJournal(existing, accCode, activeCompany, currentUser.fullName);

    const updated: Expense = {
      ...existing,
      status: 'PAID',
      paymentMode,
      accountId,
    };

    const accountTx: AccountTransaction = {
      id: 'atx-' + Math.random().toString(36).substring(2, 11),
      accountId,
      transactionDate: new Date().toISOString().split('T')[0],
      transactionType: 'OPERATING_EXPENSE',
      direction: 'CREDIT',
      amount: existing.amount,
      referenceNo: existing.voucherNo,
      description: `Payment for unpaid expense: ${existing.category} - ${existing.paidTo}`,
      createdBy: currentUser.fullName,
      createdAt: new Date().toISOString(),
    };

    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? updated : e)));
    setAccountTransactions((prev) => [accountTx, ...prev]);
    setJournalEntries((prev) => [je, ...prev]);

    if (dbRepository.isRemoteDatabaseAvailable()) {
      dbRepository.updateExpense(expenseId, { status: 'PAID', paymentMode, accountId }).catch((e) => console.warn('Sync payUnpaidExpense failed', e));
    }

    logAudit('PAY_UNPAID_EXPENSE', 'EXPENSE', expenseId, existing, updated);
  };

  const reverseExpense = (expenseId: string, reason: string): Expense => {
    const existing = expenses.find((e) => e.id === expenseId);
    if (!existing) throw new Error('Expense not found');

    const now = new Date().toISOString();
    const reversalVoucherNo = `REV-${existing.voucherNo}`;

    // Mark existing as REVERSED
    const updatedExisting: Expense = {
      ...existing,
      status: 'REVERSED',
      reversalReason: reason,
      reversalExpenseId: 'rev-' + existing.id,
    };

    // If it was paid from an account, refund the money (DEBIT)
    if (existing.status === 'PAID' && existing.accountId) {
      const refundTx: AccountTransaction = {
        id: 'atx-rev-' + Math.random().toString(36).substring(2, 11),
        accountId: existing.accountId,
        transactionDate: new Date().toISOString().split('T')[0],
        transactionType: 'ACCOUNT_ADJUSTMENT',
        direction: 'DEBIT', // Money refunded back
        amount: existing.amount,
        referenceNo: reversalVoucherNo,
        description: `Reversal of expense ${existing.voucherNo}: ${reason}`,
        createdBy: currentUser.fullName,
        createdAt: now,
      };
      setAccountTransactions((prev) => [refundTx, ...prev]);
    }

    // Reversing journal entries for any journals posted for this expense
    const associatedJournals = journalEntries.filter((j) => j.sourceId === expenseId);
    const reversalJournals: JournalEntry[] = associatedJournals.map((orig) =>
      createReversingJournal(orig, `Reversal of expense ${existing.voucherNo}: ${reason}`, currentUser.fullName)
    );
    if (reversalJournals.length > 0) {
      setJournalEntries((prev) => [...reversalJournals, ...prev]);
    }

    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? updatedExisting : e)));
    if (dbRepository.isRemoteDatabaseAvailable()) {
      dbRepository.updateExpense(expenseId, { status: 'REVERSED', notes: reason }).catch((e) => console.warn('Update expense reversed in DB failed', e));
    }
    logAudit('REVERSE_EXPENSE', 'EXPENSE', expenseId, existing, updatedExisting);
    return updatedExisting;
  };

  // --- Permanent Staff Salary Management ---
  const issueEmployeeAdvance = async (params: {
    employeeId: string;
    employeeName: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    accountId: string;
    notes?: string;
  }): Promise<EmployeeAdvance> => {
    if (params.amount <= 0) {
      throw new Error('Advance amount must be greater than zero.');
    }
    const acc = accounts.find((a) => a.id === params.accountId);
    if (!acc) throw new Error('Payment account not found.');

    const curBal = getAccountBalance(params.accountId);
    validateCashBankTransaction({
      account: acc,
      amount: params.amount,
      direction: 'CREDIT',
      currentBalance: curBal,
    });

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const id = 'eadv-' + Math.random().toString(36).substring(2, 11);
    const voucherNo = `ADV-26-${String(employeeAdvances.length + 1).padStart(4, '0')}`;

    // Await atomic database persistence if remote database is active
    if (dbRepository.isRemoteDatabaseAvailable()) {
      const rpcRes = await dbRepository.issueEmployeeAdvanceAtomic({
        companyId: activeCompanyId,
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        amount: params.amount,
        paymentMode: params.paymentMode,
        accountId: params.accountId,
        voucherNo,
        actor: currentUser.fullName,
        notes: params.notes,
      });
      if (!rpcRes.success) {
        throw new Error(rpcRes.error?.message || 'Failed to persist employee advance to database.');
      }
    }

    const newAdvance: EmployeeAdvance = {
      id,
      companyId: activeCompanyId,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      advanceDate: today,
      amount: params.amount,
      recoveredAmount: 0,
      remainingBalance: params.amount,
      status: 'OPEN',
      paymentMode: params.paymentMode,
      accountId: params.accountId,
      voucherNo,
      notes: params.notes,
      createdAt: now,
      createdBy: currentUser.fullName,
    };

    const accCode = acc.accountType === 'BANK' ? '1020' : '1010';
    const je = createEmployeeAdvanceJournal(
      {
        id,
        employeeName: params.employeeName,
        advanceDate: today,
        amount: params.amount,
        paymentMode: params.paymentMode,
        voucherNo,
      },
      accCode,
      activeCompany,
      currentUser.fullName
    );

    const accountTx: AccountTransaction = {
      id: 'atx-eadv-' + Math.random().toString(36).substring(2, 11),
      accountId: params.accountId,
      transactionDate: today,
      transactionType: 'OPERATING_EXPENSE',
      direction: 'CREDIT',
      amount: params.amount,
      referenceNo: voucherNo,
      description: `Employee advance issued: ${params.employeeName}`,
      createdBy: currentUser.fullName,
      createdAt: now,
    };

    setEmployeeAdvances((prev) => [newAdvance, ...prev]);
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === params.employeeId
          ? { ...emp, currentAdvanceBalance: roundTo2((emp.currentAdvanceBalance || 0) + params.amount) }
          : emp
      )
    );
    setAccountTransactions((prev) => [accountTx, ...prev]);
    setJournalEntries((prev) => [je, ...prev]);

    logAudit('ISSUE_EMPLOYEE_ADVANCE', 'EMPLOYEE_ADVANCE', id, null, newAdvance);
    return newAdvance;
  };

  const recordSalaryPayment = async (params: Omit<MonthlySalaryRecord, 'id' | 'createdAt' | 'createdBy'>): Promise<MonthlySalaryRecord> => {
    validateSalaryRecordInput(params, salaryRecords);

    const isPaid = (params.amountPaid || 0) > 0;
    const acc = params.accountId ? accounts.find((a) => a.id === params.accountId) : undefined;
    if (isPaid && acc) {
      const curBal = getAccountBalance(acc.id);
      validateCashBankTransaction({
        account: acc,
        amount: params.amountPaid,
        direction: 'CREDIT',
        currentBalance: curBal,
      });
    }

    const id = 'sal-' + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();
    const newRecord: MonthlySalaryRecord = {
      ...params,
      id,
      companyId: activeCompanyId,
      createdAt: now,
      createdBy: currentUser.fullName,
    };

    const accCode = acc?.accountType === 'BANK' ? '1020' : '1010';

    // Await atomic database transaction if remote DB is available
    if (dbRepository.isRemoteDatabaseAvailable()) {
      const rpcRes = await dbRepository.postSalaryAccrualAtomic({
        companyId: activeCompanyId,
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        designation: params.designation,
        salaryMonth: params.salaryMonth,
        grossSalary: params.grossSalary,
        allowances: params.allowances || 0,
        deductions: params.deductions || 0,
        advanceRecovery: params.advanceRecovery || 0,
        netSalaryPayable: params.netSalaryPayable,
        amountPaid: params.amountPaid || 0,
        paymentMode: (params.paymentMode as any) || 'CASH',
        accountId: params.accountId,
        actor: currentUser.fullName,
        notes: params.notes,
      });
      if (!rpcRes.success) {
        throw new Error(rpcRes.error?.message || 'Failed to post salary accrual atomically to database.');
      }
    }

    // Blocker 1: Wire separate accrual and disbursement journals
    // Accrual Journal recognizes total expense strictly ONCE: Dr 5050, Cr 1060, Cr 2120, Cr 2100
    const accrualJe = createSalaryAccrualJournal(newRecord, activeCompany, currentUser.fullName);
    const journalsToAdd: JournalEntry[] = [accrualJe];

    // If immediate payment was disbursed (amountPaid > 0), record disbursement: Dr 2100, Cr 1010/1020
    if (isPaid && params.accountId) {
      const voucherNo = `SAL-${params.salaryMonth}-${params.employeeName.replace(/\s+/g, '')}`;
      const disbJe = createSalaryDisbursementJournal(
        {
          salaryRecordId: id,
          employeeName: params.employeeName,
          salaryMonth: params.salaryMonth,
          amount: params.amountPaid,
          paymentMode: (params.paymentMode as any) || 'CASH',
          voucherNo,
        },
        accCode,
        activeCompany,
        currentUser.fullName
      );
      journalsToAdd.unshift(disbJe);

      const accTx: AccountTransaction = {
        id: 'atx-sal-' + Math.random().toString(36).substring(2, 11),
        accountId: params.accountId,
        transactionDate: params.paymentDate || now.split('T')[0],
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: params.amountPaid,
        referenceNo: voucherNo,
        description: `Monthly Salary Disbursement: ${params.employeeName} (${params.salaryMonth})`,
        createdBy: currentUser.fullName,
        createdAt: now,
      };
      setAccountTransactions((prev) => [accTx, ...prev]);
    }

    // Update advance recovery in local state
    if (params.advanceRecovery > 0) {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id === params.employeeId) {
            return {
              ...emp,
              currentAdvanceBalance: Math.max(0, roundTo2((emp.currentAdvanceBalance || 0) - params.advanceRecovery)),
            };
          }
          return emp;
        })
      );
      setEmployeeAdvances((prev) =>
        prev.map((adv) => {
          if (adv.employeeId === params.employeeId && adv.remainingBalance > 0) {
            const recovery = Math.min(adv.remainingBalance, params.advanceRecovery);
            const rem = roundTo2(adv.remainingBalance - recovery);
            return {
              ...adv,
              recoveredAmount: roundTo2(adv.recoveredAmount + recovery),
              remainingBalance: rem,
              status: rem <= 0.01 ? 'FULLY_RECOVERED' : 'PARTIALLY_RECOVERED',
            };
          }
          return adv;
        })
      );
    }

    setSalaryRecords((prev) => [newRecord, ...prev]);
    setJournalEntries((prev) => [...journalsToAdd, ...prev]);

    logAudit('RECORD_SALARY', 'SALARY_RECORD', id, null, newRecord);
    return newRecord;
  };

  const updateSalaryRecord = (id: string, updates: Partial<MonthlySalaryRecord>) => {
    setSalaryRecords((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    logAudit('UPDATE_SALARY', 'SALARY_RECORD', id, null, updates);
  };

  const deleteSalaryRecord = (id: string): { success: boolean; message?: string } => {
    enforceAuthorization(currentUser, 'finance:delete', company.id);
    const existing = salaryRecords.find((s) => s.id === id);
    if (!existing) return { success: false, message: 'Salary record not found.' };

    // Blocker 8: Prevent direct deletion of disbursed or advance-adjusted salary records
    if ((existing.amountPaid || 0) > 0) {
      throw new Error(
        `Cannot delete salary record for ${existing.employeeName} because payments of ₹${existing.amountPaid} have already been disbursed. Use authorized reversal instead.`
      );
    }
    if ((existing.advanceRecovery || 0) > 0) {
      throw new Error(
        `Cannot delete salary record for ${existing.employeeName} with advance recovery applied. Use authorized reversal instead.`
      );
    }

    setSalaryRecords((prev) => prev.filter((s) => s.id !== id));
    setJournalEntries((prev) => prev.filter((je) => je.sourceId !== id));
    logAudit('DELETE_SALARY', 'SALARY_RECORD', id, existing, null);
    return { success: true, message: `Salary record for ${existing.employeeName} (${existing.salaryMonth}) removed.` };
  };

  // Blocker 1: Multiple salary installment payments without duplicate expense recognition
  const paySalaryInstallment = async (params: {
    salaryRecordId: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    accountId: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; salaryRecord?: MonthlySalaryRecord }> => {
    const existing = salaryRecords.find((s) => s.id === params.salaryRecordId);
    if (!existing) throw new Error('Salary record not found.');
    if (params.amount <= 0) throw new Error('Payment amount must be greater than zero.');
    if (roundTo2(params.amount) > roundTo2(existing.remainingBalance)) {
      throw new Error(`Payment amount (₹${params.amount}) exceeds remaining balance (₹${existing.remainingBalance}).`);
    }

    const acc = accounts.find((a) => a.id === params.accountId);
    if (!acc) throw new Error('Payment account not found.');

    const curBal = getAccountBalance(params.accountId);
    validateCashBankTransaction({
      account: acc,
      amount: params.amount,
      direction: 'CREDIT',
      currentBalance: curBal,
    });

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const voucherNo = `SALPAY-26-${String(salaryRecords.length + 1).padStart(4, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const accCode = acc.accountType === 'BANK' ? '1020' : '1010';

    if (dbRepository.isRemoteDatabaseAvailable()) {
      const rpcRes = await dbRepository.postSalaryDisbursementAtomic({
        companyId: activeCompanyId,
        salaryRecordId: params.salaryRecordId,
        employeeName: existing.employeeName,
        salaryMonth: existing.salaryMonth,
        amount: params.amount,
        paymentMode: params.paymentMode,
        accountId: params.accountId,
        voucherNo,
        actor: currentUser.fullName,
      });
      if (!rpcRes.success) {
        throw new Error(rpcRes.error?.message || 'Failed to post salary disbursement to database.');
      }
    }

    // Double-entry disbursement journal: Dr 2100 Employee Wages Payable, Cr 1010/1020 Cash/Bank
    const disbJe = createSalaryDisbursementJournal(
      {
        salaryRecordId: params.salaryRecordId,
        employeeName: existing.employeeName,
        salaryMonth: existing.salaryMonth,
        amount: params.amount,
        paymentMode: params.paymentMode,
        voucherNo,
      },
      accCode,
      activeCompany,
      currentUser.fullName
    );

    const newAmountPaid = roundTo2((existing.amountPaid || 0) + params.amount);
    const newRemainingBalance = roundTo2(Math.max(0, existing.remainingBalance - params.amount));
    const newStatus = newRemainingBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

    const updatedSalary: MonthlySalaryRecord = {
      ...existing,
      amountPaid: newAmountPaid,
      remainingBalance: newRemainingBalance,
      status: newStatus,
      paymentDate: today,
      paymentMode: params.paymentMode,
      accountId: params.accountId,
    };

    const accTx: AccountTransaction = {
      id: 'atx-sal-pay-' + Math.random().toString(36).substring(2, 11),
      accountId: params.accountId,
      transactionDate: today,
      transactionType: 'OPERATING_EXPENSE',
      direction: 'CREDIT',
      amount: params.amount,
      referenceNo: voucherNo,
      description: `Salary Installment: ${existing.employeeName} (${existing.salaryMonth}) [${voucherNo}]`,
      createdBy: currentUser.fullName,
      createdAt: now,
    };

    setSalaryRecords((prev) => prev.map((s) => (s.id === params.salaryRecordId ? updatedSalary : s)));
    setAccountTransactions((prev) => [accTx, ...prev]);
    setJournalEntries((prev) => [disbJe, ...prev]);

    logAudit('PAY_SALARY_INSTALLMENT', 'SALARY_RECORD', params.salaryRecordId, existing, updatedSalary);
    return { success: true, message: `Disbursed ₹${params.amount} to ${existing.employeeName}.`, salaryRecord: updatedSalary };
  };

  // Blocker 8: Authorized reversal for salary records
  const reverseSalaryRecord = (salaryId: string, reason: string): MonthlySalaryRecord => {
    enforceAuthorization(currentUser, 'finance:delete', company.id);
    const existing = salaryRecords.find((s) => s.id === salaryId);
    if (!existing) throw new Error('Salary record not found.');
    if (existing.status === 'REVERSED') throw new Error('Salary record is already reversed.');

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // If payments were disbursed, refund the account (DEBIT)
    if ((existing.amountPaid || 0) > 0 && existing.accountId) {
      const refundTx: AccountTransaction = {
        id: 'atx-rev-sal-' + Math.random().toString(36).substring(2, 11),
        accountId: existing.accountId,
        transactionDate: today,
        transactionType: 'ACCOUNT_ADJUSTMENT',
        direction: 'DEBIT',
        amount: existing.amountPaid,
        referenceNo: `REV-SAL-${existing.salaryMonth}`,
        description: `Reversal of salary payment: ${existing.employeeName} (${reason})`,
        createdBy: currentUser.fullName,
        createdAt: now,
      };
      setAccountTransactions((prev) => [refundTx, ...prev]);
    }

    // If advance was recovered, restore employee advance balance
    if ((existing.advanceRecovery || 0) > 0) {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === existing.employeeId
            ? { ...emp, currentAdvanceBalance: roundTo2((emp.currentAdvanceBalance || 0) + existing.advanceRecovery) }
            : emp
        )
      );
      setEmployeeAdvances((prev) =>
        prev.map((adv) => {
          if (adv.employeeId === existing.employeeId && adv.recoveredAmount > 0) {
            const restored = Math.min(adv.recoveredAmount, existing.advanceRecovery);
            return {
              ...adv,
              recoveredAmount: roundTo2(adv.recoveredAmount - restored),
              remainingBalance: roundTo2(adv.remainingBalance + restored),
              status: 'PARTIALLY_RECOVERED',
            };
          }
          return adv;
        })
      );
    }

    // Reversing journal entries for any journals posted for this salary record
    const associatedJournals = journalEntries.filter((j) => j.sourceId === salaryId);
    const reversalJournals: JournalEntry[] = associatedJournals.map((orig) =>
      createReversingJournal(orig, `Reversal of salary record for ${existing.employeeName}: ${reason}`, currentUser.fullName)
    );
    if (reversalJournals.length > 0) {
      setJournalEntries((prev) => [...reversalJournals, ...prev]);
    }

    const updatedRecord: MonthlySalaryRecord = {
      ...existing,
      status: 'REVERSED',
      notes: `${existing.notes ? existing.notes + ' | ' : ''}REVERSED: ${reason}`,
    };

    setSalaryRecords((prev) => prev.map((s) => (s.id === salaryId ? updatedRecord : s)));
    logAudit('REVERSE_SALARY', 'SALARY_RECORD', salaryId, existing, updatedRecord);
    return updatedRecord;
  };

  // --- Daily Wage Labour Management ---
  const recordDailyLabour = async (params: Omit<DailyLabourEntry, 'id' | 'createdAt' | 'createdBy'>): Promise<DailyLabourEntry> => {
    validateDailyLabourInput(params);

    const isPaid = (params.amountPaid || 0) > 0;
    const acc = params.accountId ? accounts.find((a) => a.id === params.accountId) : undefined;
    if (isPaid && acc) {
      const curBal = getAccountBalance(acc.id);
      validateCashBankTransaction({
        account: acc,
        amount: params.amountPaid,
        direction: 'CREDIT',
        currentBalance: curBal,
      });
    }

    const id = 'dlab-' + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();
    const newEntry: DailyLabourEntry = {
      ...params,
      id,
      companyId: activeCompanyId,
      status: params.remainingBalance <= 0.01 && isPaid ? 'PAID' : (isPaid ? 'PARTIALLY_PAID' : 'PENDING'),
      createdAt: now,
      createdBy: currentUser.fullName,
    };

    const accCode = acc?.accountType === 'BANK' ? '1020' : '1010';

    if (dbRepository.isRemoteDatabaseAvailable()) {
      const rpcRes = await dbRepository.postDailyLabourAccrualAtomic({
        companyId: activeCompanyId,
        workDate: params.workDate,
        workerNameOrGroup: params.workerNameOrGroup,
        workerCount: params.workerCount,
        workingDays: params.workingDays,
        dailyRate: params.dailyRate,
        overtimeAmount: params.overtimeAmount || 0,
        additionalCharges: params.additionalCharges || 0,
        totalLabourCost: params.totalLabourCost,
        advanceAmount: params.advanceAmount || 0,
        amountPaid: params.amountPaid || 0,
        remainingBalance: params.remainingBalance,
        paymentMode: params.paymentMode,
        accountId: params.accountId,
        actor: currentUser.fullName,
        notes: params.notes,
      });
      if (!rpcRes.success) {
        throw new Error(rpcRes.error?.message || 'Failed to post daily labour to database.');
      }
    }

    const je = createDailyLabourJournal(newEntry, accCode, activeCompany, currentUser.fullName);

    if (isPaid && params.accountId) {
      const voucherNo = `LPAY-26-${String(labourPayments.length + 1).padStart(4, '0')}`;
      const accTx: AccountTransaction = {
        id: 'atx-lab-' + Math.random().toString(36).substring(2, 11),
        accountId: params.accountId,
        transactionDate: params.workDate,
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: params.amountPaid,
        referenceNo: voucherNo,
        description: `Daily Labour Settlement: ${params.workerNameOrGroup} (${params.workDate})`,
        createdBy: currentUser.fullName,
        createdAt: now,
      };
      setAccountTransactions((prev) => [accTx, ...prev]);

      const lpay: LabourPayment = {
        id: 'lpay-' + Math.random().toString(36).substring(2, 11),
        companyId: activeCompanyId,
        dailyLabourId: id,
        workerNameOrGroup: params.workerNameOrGroup,
        paymentDate: params.workDate,
        amount: params.amountPaid,
        paymentMode: (params.paymentMode as any) || 'CASH',
        accountId: params.accountId,
        voucherNo,
        status: 'POSTED',
        createdAt: now,
        createdBy: currentUser.fullName,
      };
      setLabourPayments((prev) => [lpay, ...prev]);
    }

    setDailyLabourEntries((prev) => [newEntry, ...prev]);
    setJournalEntries((prev) => [je, ...prev]);

    logAudit('RECORD_DAILY_LABOUR', 'DAILY_LABOUR', id, null, newEntry);
    return newEntry;
  };

  const updateDailyLabour = (id: string, updates: Partial<DailyLabourEntry>) => {
    setDailyLabourEntries((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    logAudit('UPDATE_DAILY_LABOUR', 'DAILY_LABOUR', id, null, updates);
  };

  const deleteDailyLabour = (id: string): { success: boolean; message?: string } => {
    enforceAuthorization(currentUser, 'finance:delete', company.id);
    const existing = dailyLabourEntries.find((l) => l.id === id);
    if (!existing) return { success: false, message: 'Daily labour entry not found.' };

    // Blocker 8: Prevent direct deletion of disbursed daily labour
    if ((existing.amountPaid || 0) > 0) {
      throw new Error(
        `Cannot delete daily labour entry for ${existing.workerNameOrGroup} because ₹${existing.amountPaid} has already been paid. Use authorized reversal instead.`
      );
    }

    setDailyLabourEntries((prev) => prev.filter((l) => l.id !== id));
    setJournalEntries((prev) => prev.filter((je) => je.sourceId !== id));
    logAudit('DELETE_DAILY_LABOUR', 'DAILY_LABOUR', id, existing, null);
    return { success: true, message: `Daily labour entry for ${existing.workerNameOrGroup} deleted.` };
  };

  // Blocker 8: Authorized reversal for daily labour records
  const reverseDailyLabour = (labourId: string, reason: string): DailyLabourEntry => {
    enforceAuthorization(currentUser, 'finance:delete', company.id);
    const existing = dailyLabourEntries.find((l) => l.id === labourId);
    if (!existing) throw new Error('Daily labour entry not found.');
    if (existing.status === 'REVERSED') throw new Error('Daily labour entry is already reversed.');

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // If payments were disbursed, refund account (DEBIT)
    if ((existing.amountPaid || 0) > 0 && existing.accountId) {
      const refundTx: AccountTransaction = {
        id: 'atx-rev-lab-' + Math.random().toString(36).substring(2, 11),
        accountId: existing.accountId,
        transactionDate: today,
        transactionType: 'ACCOUNT_ADJUSTMENT',
        direction: 'DEBIT',
        amount: existing.amountPaid,
        referenceNo: `REV-DLAB-${existing.id.slice(-6)}`,
        description: `Reversal of labour settlement: ${existing.workerNameOrGroup} (${reason})`,
        createdBy: currentUser.fullName,
        createdAt: now,
      };
      setAccountTransactions((prev) => [refundTx, ...prev]);
    }

    // Reversing journal entries
    const associatedJournals = journalEntries.filter((j) => j.sourceId === labourId);
    const reversalJournals: JournalEntry[] = associatedJournals.map((orig) =>
      createReversingJournal(orig, `Reversal of daily labour for ${existing.workerNameOrGroup}: ${reason}`, currentUser.fullName)
    );
    if (reversalJournals.length > 0) {
      setJournalEntries((prev) => [...reversalJournals, ...prev]);
    }

    const updatedRecord: DailyLabourEntry = {
      ...existing,
      status: 'REVERSED',
      notes: `${existing.notes ? existing.notes + ' | ' : ''}REVERSED: ${reason}`,
    };

    setDailyLabourEntries((prev) => prev.map((l) => (l.id === labourId ? updatedRecord : l)));
    logAudit('REVERSE_DAILY_LABOUR', 'DAILY_LABOUR', labourId, existing, updatedRecord);
    return updatedRecord;
  };

  const recordLabourPayment = async (params: {
    dailyLabourId: string;
    workerNameOrGroup: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    accountId: string;
    notes?: string;
  }): Promise<LabourPayment> => {
    const existing = dailyLabourEntries.find((l) => l.id === params.dailyLabourId);
    if (!existing) throw new Error('Daily labour entry not found.');
    if (params.amount <= 0) throw new Error('Payment amount must be greater than zero.');
    if (roundTo2(params.amount) > roundTo2(existing.remainingBalance)) {
      throw new Error(`Payment amount (₹${params.amount}) exceeds remaining balance (₹${existing.remainingBalance}).`);
    }

    const acc = accounts.find((a) => a.id === params.accountId);
    if (!acc) throw new Error('Payment account not found.');

    const curBal = getAccountBalance(params.accountId);
    validateCashBankTransaction({
      account: acc,
      amount: params.amount,
      direction: 'CREDIT',
      currentBalance: curBal,
    });

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const voucherNo = `LPAY-26-${String(labourPayments.length + 1).padStart(4, '0')}`;
    const accCode = acc.accountType === 'BANK' ? '1020' : '1010';

    // Blocker 4: Await atomic database posting
    if (dbRepository.isRemoteDatabaseAvailable()) {
      const rpcRes = await dbRepository.postLabourPaymentAtomic({
        companyId: activeCompanyId,
        dailyLabourId: params.dailyLabourId,
        workerNameOrGroup: params.workerNameOrGroup,
        amount: params.amount,
        paymentMode: params.paymentMode,
        accountId: params.accountId,
        voucherNo,
        actor: currentUser.fullName,
      });
      if (!rpcRes.success) {
        throw new Error(rpcRes.error?.message || 'Failed to post labour payment atomically to database.');
      }
    }

    // Double-entry: Dr. 2100 Employee Wages Payable, Cr. 1010/1020 Cash/Bank
    const je = createLabourPaymentJournal(
      {
        dailyLabourId: params.dailyLabourId,
        workerNameOrGroup: params.workerNameOrGroup,
        amount: params.amount,
        paymentMode: params.paymentMode,
        voucherNo,
      },
      accCode,
      activeCompany,
      currentUser.fullName
    );

    const updatedLabour: DailyLabourEntry = {
      ...existing,
      amountPaid: roundTo2(existing.amountPaid + params.amount),
      remainingBalance: roundTo2(Math.max(0, existing.remainingBalance - params.amount)),
      status: Math.max(0, existing.remainingBalance - params.amount) <= 0.01 ? 'PAID' : 'PARTIALLY_PAID',
    };

    const lpay: LabourPayment = {
      id: 'lpay-' + Math.random().toString(36).substring(2, 11),
      companyId: activeCompanyId,
      dailyLabourId: params.dailyLabourId,
      workerNameOrGroup: params.workerNameOrGroup,
      paymentDate: today,
      amount: params.amount,
      paymentMode: params.paymentMode,
      accountId: params.accountId,
      voucherNo,
      status: 'POSTED',
      notes: params.notes,
      createdAt: now,
      createdBy: currentUser.fullName,
    };

    const accTx: AccountTransaction = {
      id: 'atx-lpay-' + Math.random().toString(36).substring(2, 11),
      accountId: params.accountId,
      transactionDate: today,
      transactionType: 'OPERATING_EXPENSE',
      direction: 'CREDIT',
      amount: params.amount,
      referenceNo: voucherNo,
      description: `Daily labour settlement: ${params.workerNameOrGroup}`,
      createdBy: currentUser.fullName,
      createdAt: now,
    };

    setDailyLabourEntries((prev) => prev.map((l) => (l.id === params.dailyLabourId ? updatedLabour : l)));
    setLabourPayments((prev) => [lpay, ...prev]);
    setAccountTransactions((prev) => [accTx, ...prev]);
    setJournalEntries((prev) => [je, ...prev]);

    logAudit('RECORD_LABOUR_PAYMENT', 'LABOUR_PAYMENT', lpay.id, null, lpay);
    return lpay;
  };

  // --- Contractor Register Management ---
  const addContractor = (params: Omit<Contractor, 'id' | 'createdAt'>): Contractor => {
    const id = 'contr-' + Math.random().toString(36).substring(2, 11);
    const newContr: Contractor = {
      ...params,
      id,
      companyId: activeCompanyId,
      createdAt: new Date().toISOString(),
    };
    setContractors((prev) => [newContr, ...prev]);

    if (dbRepository.isRemoteDatabaseAvailable()) {
      dbRepository.saveContractor(newContr).catch((e) => console.warn('Sync contractor to DB failed', e));
    }

    logAudit('ADD_CONTRACTOR', 'CONTRACTOR', id, null, newContr);
    return newContr;
  };

  const updateContractor = (id: string, updates: Partial<Contractor>) => {
    setContractors((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    logAudit('UPDATE_CONTRACTOR', 'CONTRACTOR', id, null, updates);
  };

  const deleteContractor = (id: string): { success: boolean; message?: string } => {
    const existing = contractors.find((c) => c.id === id);
    if (!existing) return { success: false, message: 'Contractor not found.' };
    setContractors((prev) => prev.filter((c) => c.id !== id));
    logAudit('DELETE_CONTRACTOR', 'CONTRACTOR', id, existing, null);
    return { success: true, message: `Contractor "${existing.contractorName}" removed.` };
  };

  const recordContractorWork = async (params: Omit<ContractorWorkEntry, 'id' | 'createdAt' | 'createdBy'>): Promise<ContractorWorkEntry> => {
    validateContractorWorkInput(params);

    const isPaid = (params.currentPayment || 0) > 0;
    const acc = params.accountId ? accounts.find((a) => a.id === params.accountId) : undefined;
    if (isPaid && acc) {
      const curBal = getAccountBalance(acc.id);
      validateCashBankTransaction({
        account: acc,
        amount: params.currentPayment,
        direction: 'CREDIT',
        currentBalance: curBal,
      });
    }

    const id = 'cwork-' + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();
    const idempotencyKey = (params as any).idempotencyKey || `idemp-cw-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const voucherNo = `CPAY-26-${String(contractorPayments.length + 1).padStart(4, '0')}`;

    let remoteWorkId = id;
    let remoteAccrualJournalId: string | undefined;
    let remotePaymentId: string | undefined;

    // Await database atomic RPC BEFORE modifying any local React state
    if (dbRepository.isRemoteDatabaseAvailable()) {
      const rpcRes = await dbRepository.postContractorWorkAtomic({
        companyId: activeCompanyId,
        contractorId: params.contractorId,
        contractorName: params.contractorName,
        workDate: params.workDate,
        workDescription: params.workDescription,
        workerCount: params.workerCount,
        quantityCompleted: params.quantityCompleted,
        agreedRate: params.agreedRate,
        totalContractAmount: params.totalContractAmount,
        advancePaid: params.advancePaid || 0,
        previousPayments: params.previousPayments || 0,
        currentPayment: params.currentPayment || 0,
        remainingBalance: params.remainingBalance,
        paymentMode: params.paymentMode,
        accountId: params.accountId,
        actor: currentUser.fullName,
        notes: params.notes,
        idempotencyKey,
      });

      if (!rpcRes.success) {
        throw new Error(rpcRes.error?.message || 'Failed to post contractor work atomically to database.');
      }
      if (rpcRes.workId) remoteWorkId = rpcRes.workId;
      remoteAccrualJournalId = rpcRes.accrualJournalId;
      remotePaymentId = rpcRes.paymentId;
    }

    const totalPaid = (params.advancePaid || 0) + (params.previousPayments || 0) + (params.currentPayment || 0);
    const finalStatus = params.remainingBalance <= 0.01 && totalPaid > 0
      ? 'PAID'
      : (totalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING');

    const newWork: ContractorWorkEntry = {
      ...params,
      id: remoteWorkId,
      companyId: activeCompanyId,
      status: finalStatus,
      accrualJournalId: remoteAccrualJournalId,
      idempotencyKey,
      createdAt: now,
      createdBy: currentUser.fullName,
    };

    const accCode = acc?.accountType === 'BANK' ? '1020' : '1010';
    const je = createContractorWorkJournal(newWork, accCode, activeCompany, currentUser.fullName);
    if (remoteAccrualJournalId) {
      je.id = remoteAccrualJournalId;
    }

    if (isPaid && params.accountId) {
      const accTx: AccountTransaction = {
        id: 'atx-cw-' + Math.random().toString(36).substring(2, 11),
        accountId: params.accountId,
        transactionDate: params.workDate,
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: params.currentPayment,
        referenceNo: voucherNo,
        description: `Contractor Work Payment: ${params.contractorName} (${params.workDescription})`,
        createdBy: currentUser.fullName,
        createdAt: now,
      };
      setAccountTransactions((prev) => [accTx, ...prev]);

      const cpay: ContractorPayment = {
        id: remotePaymentId || ('cpay-' + Math.random().toString(36).substring(2, 11)),
        companyId: activeCompanyId,
        contractorId: params.contractorId,
        contractorWorkId: remoteWorkId,
        contractorName: params.contractorName,
        paymentDate: params.workDate,
        amount: params.currentPayment,
        paymentMode: (params.paymentMode as any) || 'BANK',
        accountId: params.accountId,
        voucherNo,
        createdAt: now,
        createdBy: currentUser.fullName,
      };
      setContractorPayments((prev) => [cpay, ...prev]);
    }

    setContractorWorkEntries((prev) => [newWork, ...prev]);
    setJournalEntries((prev) => [je, ...prev]);

    logAudit('RECORD_CONTRACTOR_WORK', 'CONTRACTOR_WORK', remoteWorkId, null, newWork);
    return newWork;
  };

  const updateContractorWork = (id: string, updates: Partial<ContractorWorkEntry>) => {
    setContractorWorkEntries((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
    logAudit('UPDATE_CONTRACTOR_WORK', 'CONTRACTOR_WORK', id, null, updates);
  };

  const deleteContractorWork = (id: string): { success: boolean; message?: string } => {
    enforceAuthorization(currentUser, 'finance:delete', company.id);
    const existing = contractorWorkEntries.find((w) => w.id === id);
    if (!existing) return { success: false, message: 'Contractor work entry not found.' };

    // Blocker 8: Prevent direct deletion of disbursed contractor work
    const totalPaid = (existing.advancePaid || 0) + (existing.previousPayments || 0) + (existing.currentPayment || 0);
    if (totalPaid > 0) {
      throw new Error(
        `Cannot delete contractor work for ${existing.contractorName} because ₹${totalPaid} has already been paid. Use authorized reversal instead.`
      );
    }

    setContractorWorkEntries((prev) => prev.filter((w) => w.id !== id));
    setJournalEntries((prev) => prev.filter((je) => je.sourceId !== id));
    logAudit('DELETE_CONTRACTOR_WORK', 'CONTRACTOR_WORK', id, existing, null);
    return { success: true, message: `Contractor work for ${existing.contractorName} deleted.` };
  };

  // Blocker 8: Authorized reversal for contractor work
  const reverseContractorWork = (workId: string, reason: string): ContractorWorkEntry => {
    enforceAuthorization(currentUser, 'finance:delete', company.id);
    const existing = contractorWorkEntries.find((w) => w.id === workId);
    if (!existing) throw new Error('Contractor work entry not found.');
    if (existing.status === 'REVERSED') throw new Error('Contractor work entry is already reversed.');

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const totalPaid = (existing.advancePaid || 0) + (existing.previousPayments || 0) + (existing.currentPayment || 0);

    // If payments were made and account recorded, refund account (DEBIT)
    if (totalPaid > 0 && existing.accountId) {
      const refundTx: AccountTransaction = {
        id: 'atx-rev-cw-' + Math.random().toString(36).substring(2, 11),
        accountId: existing.accountId,
        transactionDate: today,
        transactionType: 'ACCOUNT_ADJUSTMENT',
        direction: 'DEBIT',
        amount: totalPaid,
        referenceNo: `REV-CW-${existing.id.slice(-6)}`,
        description: `Reversal of contractor payments: ${existing.contractorName} (${reason})`,
        createdBy: currentUser.fullName,
        createdAt: now,
      };
      setAccountTransactions((prev) => [refundTx, ...prev]);
    }

    // Reversing journal entries
    const associatedJournals = journalEntries.filter((j) => j.sourceId === workId);
    const reversalJournals: JournalEntry[] = associatedJournals.map((orig) =>
      createReversingJournal(orig, `Reversal of contractor work for ${existing.contractorName}: ${reason}`, currentUser.fullName)
    );
    if (reversalJournals.length > 0) {
      setJournalEntries((prev) => [...reversalJournals, ...prev]);
    }

    const updatedRecord: ContractorWorkEntry = {
      ...existing,
      status: 'REVERSED',
      notes: `${existing.notes ? existing.notes + ' | ' : ''}REVERSED: ${reason}`,
    };

    setContractorWorkEntries((prev) => prev.map((w) => (w.id === workId ? updatedRecord : w)));
    logAudit('REVERSE_CONTRACTOR_WORK', 'CONTRACTOR_WORK', workId, existing, updatedRecord);
    return updatedRecord;
  };

  // Blocker 2 & 9: Await atomic database posting and provide user-visible failure handling
  const payContractorWork = async (workEntryId: string, amount: number, paymentMode: 'CASH' | 'BANK', accountId?: string): Promise<ContractorPayment> => {
    const existing = contractorWorkEntries.find((w) => w.id === workEntryId);
    if (!existing) throw new Error('Contractor work entry not found.');

    validateContractorPaymentInput({ contractorWorkId: workEntryId, amount, paymentMode, accountId }, existing);

    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) throw new Error('Payment account not found.');

    const curBal = getAccountBalance(accountId!);
    validateCashBankTransaction({
      account: acc,
      amount,
      direction: 'CREDIT',
      currentBalance: curBal,
    });

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const voucherNo = `CPAY-26-${String(contractorPayments.length + 1).padStart(4, '0')}`;
    const accCode = acc.accountType === 'BANK' ? '1020' : '1010';

    // Blocker 2: Await atomic database posting covering payments, work balance, account transaction and journal lines
    if (dbRepository.isRemoteDatabaseAvailable()) {
      const rpcRes = await dbRepository.postContractorPaymentAtomic({
        companyId: activeCompanyId,
        contractorId: existing.contractorId,
        contractorWorkId: workEntryId,
        contractorName: existing.contractorName,
        amount,
        paymentMode,
        accountId: accountId!,
        voucherNo,
        actor: currentUser.fullName,
      });
      if (!rpcRes.success) {
        throw new Error(rpcRes.error?.message || 'Failed to post contractor payment atomically to database.');
      }
    }

    // Double-entry: Dr. 2110 Contractor & Labour Payable, Cr. 1010/1020 Cash/Bank
    const je = createContractorProgressPaymentJournal(
      {
        contractorWorkId: workEntryId,
        contractorName: existing.contractorName,
        amount,
        paymentDate: today,
        paymentMode,
        voucherNo,
      },
      accCode,
      activeCompany,
      currentUser.fullName
    );

    const newPrevPayments = roundTo2((existing.previousPayments || 0) + amount);
    const newRemaining = roundTo2(Math.max(0, existing.remainingBalance - amount));

    const updated: ContractorWorkEntry = {
      ...existing,
      previousPayments: newPrevPayments,
      currentPayment: amount,
      remainingBalance: newRemaining,
      status: newRemaining <= 0.01 ? 'PAID' : 'PARTIALLY_PAID',
      paymentMode,
      accountId,
    };

    const cpay: ContractorPayment = {
      id: 'cpay-' + Math.random().toString(36).substring(2, 11),
      companyId: activeCompanyId,
      contractorId: existing.contractorId,
      contractorWorkId: workEntryId,
      contractorName: existing.contractorName,
      paymentDate: today,
      amount,
      paymentMode,
      accountId: accountId!,
      voucherNo,
      createdAt: now,
      createdBy: currentUser.fullName,
    };

    const accTx: AccountTransaction = {
      id: 'atx-cw-pay-' + Math.random().toString(36).substring(2, 11),
      accountId: accountId!,
      transactionDate: today,
      transactionType: 'OPERATING_EXPENSE',
      direction: 'CREDIT',
      amount,
      referenceNo: voucherNo,
      description: `Contractor Progress Payment: ${existing.contractorName} (${voucherNo})`,
      createdBy: currentUser.fullName,
      createdAt: now,
    };

    setContractorWorkEntries((prev) => prev.map((w) => (w.id === workEntryId ? updated : w)));
    setContractorPayments((prev) => [cpay, ...prev]);
    setAccountTransactions((prev) => [accTx, ...prev]);
    setJournalEntries((prev) => [je, ...prev]);

    logAudit('PAY_CONTRACTOR_WORK', 'CONTRACTOR_WORK', workEntryId, existing, updated);
    return cpay;
  };

  // --- Guided Daily Cash Closing Management ---
  const recordDailyCashClosing = (closingData: Omit<DailyCashClosingRecord, 'id' | 'closedAt' | 'closedBy'>): DailyCashClosingRecord => {
    const id = 'cls-' + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();
    const newClosing: DailyCashClosingRecord = {
      ...closingData,
      id,
      companyId: activeCompanyId,
      closedAt: now,
      closedBy: currentUser.fullName,
    };

    // If there is a discrepancy, post adjustment journal
    if (Math.abs(closingData.cashDifference) > 0.01) {
      const je = createCashClosingJournal(
        closingData.cashDifference,
        closingData.closingDate,
        closingData.discrepancyReason || 'Cash count audit difference',
        activeCompany,
        currentUser.fullName
      );
      if (je) {
        setJournalEntries((prev) => [je, ...prev]);
        newClosing.journalId = je.id;
      }
    }

    setDailyCashClosings((prev) => [newClosing, ...prev]);

    if (dbRepository.isRemoteDatabaseAvailable()) {
      dbRepository.saveDailyCashClosing(newClosing).catch((e) => console.warn('Sync cash closing to DB failed', e));
    }

    logAudit('DAILY_CASH_CLOSING', 'DAILY_CASH_CLOSING', id, null, newClosing);
    return newClosing;
  };

  // Phase 4: Commercial Documents & Financial Reports Management
  const createCommercialDoc = (params: {
    party?: Party;
    documentType: CommercialDocType;
    documentDate: string;
    dueDate?: string;
    referenceNo?: string;
    lines: { description: string; quantity: number; unit: string; rate: number; gstRate: number; materialId?: string }[];
    notes?: string;
    termsAndConditions?: string;
  }): CommercialDocument => {
    authService.touchActivity();
    if (currentUser) {
      currentUser.lastActiveAt = Date.now();
    }
    enforceAuthorization(currentUser, 'invoice:create', activeCompanyId);
    const count = commercialDocuments.filter((d) => d.documentType === params.documentType).length + 1;
    const effectiveParty = params.party || parties.find((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH') || parties[0] || INITIAL_PARTIES[0];
    const doc = createCommercialDocument({
      company: activeCompany,
      party: effectiveParty,
      documentType: params.documentType,
      documentDate: params.documentDate,
      dueDate: params.dueDate,
      referenceNo: params.referenceNo,
      lines: params.lines,
      notes: params.notes,
      termsAndConditions: params.termsAndConditions,
      sequenceIndex: count,
      createdBy: `${currentUser.fullName} (${currentUser.role})`
    });
    setCommercialDocuments((prev) => [doc, ...prev]);
    logAudit('CREATE_COMMERCIAL_DOC', 'COMMERCIAL_DOC', doc.id, null, doc);
    return doc;
  };

  const updateCommercialDoc = (id: string, updates: Partial<CommercialDocument>) => {
    enforceAuthorization(currentUser, 'invoice:edit', activeCompanyId);
    setCommercialDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    logAudit('UPDATE_COMMERCIAL_DOC', 'COMMERCIAL_DOC', id, null, updates);
  };

  const deleteCommercialDoc = (id: string): { success: boolean; message?: string } => {
    enforceAuthorization(currentUser, 'invoice:delete', activeCompanyId);
    const existing = commercialDocuments.find((d) => d.id === id);
    if (!existing) return { success: false, message: 'Document not found.' };
    setCommercialDocuments((prev) => prev.filter((d) => d.id !== id));
    logAudit('DELETE_COMMERCIAL_DOC', 'COMMERCIAL_DOC', id, existing, null);
    return { success: true, message: `Document ${existing.documentNo} deleted successfully.` };
  };

  const convertCommercialDoc = (
    sourceDocId: string,
    targetType: 'PROFORMA_INVOICE' | 'SALES_INVOICE' | 'PURCHASE_INVOICE'
  ): CommercialDocument => {
    enforceAuthorization(currentUser, 'invoice:create', activeCompanyId);
    const sourceDoc = commercialDocuments.find((d) => d.id === sourceDocId);
    if (!sourceDoc) throw new Error('Source document not found');
    const count = commercialDocuments.filter((d) => d.documentType === targetType).length + 1;
    const converted = convertDocument(
      sourceDoc,
      targetType,
      activeCompany,
      count,
      '26-27',
      `${currentUser.fullName} (${currentUser.role})`
    );
    setCommercialDocuments((prev) => [converted, ...prev]);
    logAudit('CONVERT_COMMERCIAL_DOC', 'COMMERCIAL_DOC', converted.id, sourceDoc, converted);
    return converted;
  };

  const issueCreditNote = (
    invoiceId: string,
    reason: string,
    returnedLines: { description: string; quantity: number; unit: string; rate: number; gstRate: number }[]
  ): CommercialDocument => {
    enforceAuthorization(currentUser, 'invoice:edit', activeCompanyId);
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) throw new Error('Original tax invoice not found.');
    const party = parties.find((p) => p.id === inv.customerPartyId);
    if (!party) throw new Error('Customer party record not found.');

    const count = commercialDocuments.filter((d) => d.documentType === 'CREDIT_NOTE').length + 1;
    const cn = createCreditNote(inv, party, activeCompany, reason, returnedLines, count, currentUser.fullName);
    setCommercialDocuments((prev) => [cn, ...prev]);

    // Generate double-entry journal reversal
    const lines: JournalLine[] = [
      { id: `jl-cn-dr-sales-${cn.id}`, accountCode: '4010', accountName: 'Scrap Sales Revenue', debit: cn.subtotalTaxable, credit: 0, lineNarration: `Credit Note ${cn.documentNo} sales reversal` },
      ...(cn.cgstAmount > 0 ? [{ id: `jl-cn-dr-cgst-${cn.id}`, accountCode: '2050', accountName: 'Output Tax Liability — CGST', debit: cn.cgstAmount, credit: 0, lineNarration: `Output CGST reversal` }] : []),
      ...(cn.sgstAmount > 0 ? [{ id: `jl-cn-dr-sgst-${cn.id}`, accountCode: '2060', accountName: 'Output Tax Liability — SGST', debit: cn.sgstAmount, credit: 0, lineNarration: `Output SGST reversal` }] : []),
      ...(cn.igstAmount > 0 ? [{ id: `jl-cn-dr-igst-${cn.id}`, accountCode: '2070', accountName: 'Output Tax Liability — IGST', debit: cn.igstAmount, credit: 0, lineNarration: `Output IGST reversal` }] : []),
      { id: `jl-cn-cr-ar-${cn.id}`, accountCode: '1100', accountName: 'Sundry Debtors (Customers A/R)', debit: 0, credit: cn.grandTotal, partyId: party.id, partyName: party.legalName, lineNarration: `Credit Note applied against ${inv.invoiceNo}` }
    ];

    const je: JournalEntry = {
      id: `je-cn-${cn.id}`,
      companyId: activeCompany.id,
      entryNo: `JV-CN-${cn.documentNo.replace(/[^A-Za-z0-9]/g, '')}`,
      entryDate: cn.documentDate,
      sourceType: 'CREDIT_NOTE',
      sourceId: cn.id,
      referenceNo: cn.documentNo,
      narration: `Credit Note ${cn.documentNo} for ${party.legalName} (${reason})`,
      lines,
      totalDebit: cn.grandTotal,
      totalCredit: cn.grandTotal,
      isPosted: true,
      createdBy: currentUser.fullName,
      createdAt: new Date().toISOString()
    };
    setJournalEntries((prev) => [je, ...prev]);
    logAudit('ISSUE_CREDIT_NOTE', 'CREDIT_NOTE', cn.id, null, cn);
    return cn;
  };

  const issueDebitNote = (
    purchaseId: string,
    reason: string,
    debitedLines: { description: string; quantity: number; unit: string; rate: number; gstRate: number }[]
  ): CommercialDocument => {
    enforceAuthorization(currentUser, 'purchase:create', activeCompanyId);
    const pur = purchases.find((p) => p.id === purchaseId);
    if (!pur) throw new Error('Original purchase order not found.');
    const party = parties.find((p) => p.id === pur.supplierPartyId);
    if (!party) throw new Error('Supplier party record not found.');

    const count = commercialDocuments.filter((d) => d.documentType === 'DEBIT_NOTE').length + 1;
    const dn = createDebitNote(pur, party, activeCompany, reason, debitedLines, count, currentUser.fullName);
    setCommercialDocuments((prev) => [dn, ...prev]);

    // Generate double-entry journal reversal
    const lines: JournalLine[] = [
      { id: `jl-dn-dr-ap-${dn.id}`, accountCode: '2010', accountName: 'Sundry Creditors (Suppliers A/P)', debit: dn.grandTotal, credit: 0, partyId: party.id, partyName: party.legalName, lineNarration: `Debit Note against purchase ${pur.purchaseNo}` },
      { id: `jl-dn-cr-pur-${dn.id}`, accountCode: '5010', accountName: 'Scrap Raw Material Purchases', debit: 0, credit: dn.subtotalTaxable, lineNarration: `Purchase return / rate reduction` },
      ...(dn.cgstAmount > 0 ? [{ id: `jl-dn-cr-cgst-${dn.id}`, accountCode: '1150', accountName: 'Input Tax Credit — CGST', debit: 0, credit: dn.cgstAmount, lineNarration: `Input CGST reversal` }] : []),
      ...(dn.sgstAmount > 0 ? [{ id: `jl-dn-cr-sgst-${dn.id}`, accountCode: '1160', accountName: 'Input Tax Credit — SGST', debit: 0, credit: dn.sgstAmount, lineNarration: `Input SGST reversal` }] : []),
      ...(dn.igstAmount > 0 ? [{ id: `jl-dn-cr-igst-${dn.id}`, accountCode: '1170', accountName: 'Input Tax Credit — IGST', debit: 0, credit: dn.igstAmount, lineNarration: `Input IGST reversal` }] : [])
    ];

    const je: JournalEntry = {
      id: `je-dn-${dn.id}`,
      companyId: activeCompany.id,
      entryNo: `JV-DN-${dn.documentNo.replace(/[^A-Za-z0-9]/g, '')}`,
      entryDate: dn.documentDate,
      sourceType: 'DEBIT_NOTE',
      sourceId: dn.id,
      referenceNo: dn.documentNo,
      narration: `Debit Note ${dn.documentNo} to ${party.legalName} (${reason})`,
      lines,
      totalDebit: dn.grandTotal,
      totalCredit: dn.grandTotal,
      isPosted: true,
      createdBy: currentUser.fullName,
      createdAt: new Date().toISOString()
    };
    setJournalEntries((prev) => [je, ...prev]);
    logAudit('ISSUE_DEBIT_NOTE', 'DEBIT_NOTE', dn.id, null, dn);
    return dn;
  };

  const getGeneralLedgerReport = (accountCode: string) => {
    return generateGeneralLedger(journalEntries, accountCode);
  };

  const getTrialBalanceReport = (asOfDate?: string) => {
    return generateTrialBalance(journalEntries, asOfDate);
  };

  const getProfitAndLossReport = (fromDate: string, toDate: string) => {
    return generateProfitAndLoss(journalEntries, fromDate, toDate);
  };

  const getAuthoritativeProfitAndLossReport = (fromDate?: string, toDate?: string) => {
    const fifoVerification = verifyFifoCogsIntegrity(stockMovements, inventoryLots, {
      companyId: activeCompanyId,
      startDate: fromDate,
      endDate: toDate,
    });
    const mInvoices = invoices.filter((i) => !i.isCancelled && (!fromDate || i.invoiceDate >= fromDate) && (!toDate || i.invoiceDate <= toDate));
    const salesRevenue = mInvoices.reduce((sum, i) => sum + i.subtotalTaxable, 0);

    const mExpenses = expenses.filter((e) => e.status !== 'REVERSED' && (!fromDate || e.expenseDate >= fromDate) && (!toDate || e.expenseDate <= toDate));
    const operatingExpenses = mExpenses.reduce((sum, e) => sum + e.amount, 0);

    const mSalaries = salaryRecords.filter((s) => s.status !== 'REVERSED' && (!fromDate || s.createdAt >= fromDate) && (!toDate || s.createdAt <= toDate));
    const staffSalaries = mSalaries.reduce((sum, s) => sum + s.grossSalary + s.allowances, 0);

    const mLabour = dailyLabourEntries.filter((l) => l.status !== 'REVERSED' && (!fromDate || l.workDate >= fromDate) && (!toDate || l.workDate <= toDate));
    const dailyLabour = mLabour.reduce((sum, l) => sum + l.totalLabourCost, 0);

    const mContract = contractorWorkEntries.filter((c) => c.status !== 'REVERSED' && (!fromDate || c.workDate >= fromDate) && (!toDate || c.workDate <= toDate));
    const contractorWork = mContract.reduce((sum, c) => sum + c.totalContractAmount, 0);

    return calculateAuthoritativeProfitAndLoss({
      salesRevenue,
      cogs: fifoVerification.verifiedCogs,
      operatingExpenses,
      staffSalaries,
      dailyLabour,
      contractorWork,
      fifoVerification,
    });
  };

  const getBalanceSheetReport = (asOfDate: string = new Date().toISOString().split('T')[0]) => {
    const fromYearStart = `${asOfDate.substring(0, 4)}-04-01`;
    const pnl = generateProfitAndLoss(journalEntries, fromYearStart, asOfDate);
    return generateBalanceSheet(journalEntries, asOfDate, pnl.netProfit);
  };

  const getPartyStatementReport = (partyId: string, fromDate?: string, toDate?: string) => {
    const party = parties.find((p) => p.id === partyId);
    if (!party) throw new Error(`Party with id ${partyId} not found.`);
    return generatePartyStatement(party, journalEntries, fromDate, toDate);
  };

  const markAttendance = (
    employeeId: string, 
    date: string, 
    status: AttendanceStatus, 
    overtimeHours: number = 0, 
    remarks?: string
  ) => {
    setAttendance((prev) => {
      const existing = prev.find((a) => a.employeeId === employeeId && a.attendanceDate === date);
      if (existing) {
        return prev.map((a) =>
          a.employeeId === employeeId && a.attendanceDate === date
            ? { ...a, status, overtimeHours, remarks, isCorrected: true, correctionReason: 'Amended by Supervisor' }
            : a
        );
      } else {
        const newEntry: AttendanceEntry = {
          id: 'att-' + Math.random().toString(36).substring(2, 9),
          employeeId,
          attendanceDate: date,
          status,
          overtimeHours,
          remarks,
          markedBy: currentUser.fullName,
          isCorrected: false,
        };
        return [newEntry, ...prev];
      }
    });
    logAudit('MARK_ATTENDANCE', 'ATTENDANCE', `${employeeId}-${date}`, null, { status, overtimeHours });
  };

  const updateAttendanceEntry = (id: string, updates: Partial<AttendanceEntry>) => {
    const existing = attendance.find((a) => a.id === id);
    if (!existing) return;
    const updated = {
      ...existing,
      ...updates,
      isCorrected: true,
      correctionReason: updates.correctionReason || 'Amended by Supervisor',
    };
    setAttendance((prev) => prev.map((a) => (a.id === id ? updated : a)));
    logAudit('UPDATE_ATTENDANCE', 'ATTENDANCE', id, existing, updated);
  };

  const deleteAttendanceEntry = (id: string): { success: boolean; message?: string } => {
    const existing = attendance.find((a) => a.id === id);
    if (!existing) return { success: false, message: 'Attendance record not found.' };
    setAttendance((prev) => prev.filter((a) => a.id !== id));
    logAudit('DELETE_ATTENDANCE', 'ATTENDANCE', id, existing, null);
    return { success: true, message: 'Attendance record deleted successfully.' };
  };

  const addAttendanceRecord = (entryData: Omit<AttendanceEntry, 'id'>): AttendanceEntry => {
    const newEntry: AttendanceEntry = {
      ...entryData,
      id: 'att-' + Math.random().toString(36).substring(2, 9),
      markedBy: currentUser.fullName,
      isCorrected: false,
    };
    setAttendance((prev) => [newEntry, ...prev]);
    logAudit('CREATE_ATTENDANCE', 'ATTENDANCE', newEntry.id, null, newEntry);
    return newEntry;
  };

  const addAccount = (accData: Omit<CashBankAccount, 'id'>): CashBankAccount => {
    const newAcc: CashBankAccount = {
      ...accData,
      id: 'acc-' + Math.random().toString(36).substring(2, 9),
    };
    setAccounts((prev) => [...prev, newAcc]);
    logAudit('CREATE_ACCOUNT', 'ACCOUNT', newAcc.id, null, newAcc);
    if (dbRepository.isRemoteDatabaseAvailable()) {
      dbRepository.saveAccount(newAcc).catch((e) => console.warn('Sync account to DB failed', e));
    }
    return newAcc;
  };

  const updateAccount = (id: string, updates: Partial<CashBankAccount>) => {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    logAudit('UPDATE_ACCOUNT', 'ACCOUNT', id, existing, updated);
    if (dbRepository.isRemoteDatabaseAvailable()) {
      dbRepository.updateAccount(id, updates).catch((e) => console.warn('Sync update account to DB failed', e));
    }
  };

  const deleteAccount = (id: string): { success: boolean; message?: string } => {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) return { success: false, message: 'Account not found.' };
    const hasTx = accountTransactions.some((tx) => tx.accountId === id);
    if (hasTx) {
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: false } : a)));
      if (dbRepository.isRemoteDatabaseAvailable()) {
        dbRepository.updateAccount(id, { isActive: false }).catch((e) => console.warn('Sync deactivate account failed', e));
      }
      return { success: true, message: `Account "${existing.accountName}" has financial history and was deactivated instead of permanently deleted.` };
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    logAudit('DELETE_ACCOUNT', 'ACCOUNT', id, existing, null);
    if (dbRepository.isRemoteDatabaseAvailable()) {
      dbRepository.deleteAccount(id).catch((e) => console.warn('Sync delete account failed', e));
    }
    return { success: true, message: `Account "${existing.accountName}" deleted.` };
  };

  // Daily Tasks Management
  const createDailyTask = (task: Omit<DailyTask, 'id' | 'createdAt'>): DailyTask => {
    const newTask: DailyTask = {
      ...task,
      id: 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString()
    };
    setDailyTasks((prev) => [newTask, ...prev]);
    logAudit('CREATE_DAILY_TASK', 'DAILY_TASK', newTask.id, null, newTask);
    return newTask;
  };

  const updateDailyTask = (id: string, updates: Partial<DailyTask>) => {
    setDailyTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    logAudit('UPDATE_DAILY_TASK', 'DAILY_TASK', id, null, updates);
  };

  const toggleDailyTask = (id: string) => {
    setDailyTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === 'DONE' ? 'PENDING' : 'DONE' } : t))
    );
  };

  const deleteDailyTask = (id: string) => {
    setDailyTasks((prev) => prev.filter((t) => t.id !== id));
    logAudit('DELETE_DAILY_TASK', 'DAILY_TASK', id, null, null);
  };

  // Work Notes Management
  const createWorkNote = (note: Omit<WorkNote, 'id' | 'updatedAt'>): WorkNote => {
    const newNote: WorkNote = {
      ...note,
      id: 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      updatedAt: new Date().toISOString()
    };
    setWorkNotes((prev) => [newNote, ...prev]);
    logAudit('CREATE_WORK_NOTE', 'WORK_NOTE', newNote.id, null, newNote);
    return newNote;
  };

  const updateWorkNote = (id: string, updates: Partial<WorkNote>) => {
    setWorkNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n))
    );
    logAudit('UPDATE_WORK_NOTE', 'WORK_NOTE', id, null, updates);
  };

  const deleteWorkNote = (id: string) => {
    setWorkNotes((prev) => prev.filter((n) => n.id !== id));
    logAudit('DELETE_WORK_NOTE', 'WORK_NOTE', id, null, null);
  };

  // Uploaded Historical Documents (Vehicle Docs, Previous Invoices, Previous POs)
  const createUploadedDocument = (doc: Omit<UploadedDocument, 'id' | 'createdAt'>): UploadedDocument => {
    const newDoc: UploadedDocument = {
      ...doc,
      id: 'updoc-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString()
    };
    setUploadedDocuments((prev) => [newDoc, ...prev]);
    logAudit('UPLOAD_DOCUMENT', 'UPLOADED_DOCUMENT', newDoc.id, null, newDoc);
    return newDoc;
  };

  const deleteUploadedDocument = (id: string) => {
    setUploadedDocuments((prev) => prev.filter((d) => d.id !== id));
    logAudit('DELETE_UPLOADED_DOCUMENT', 'UPLOADED_DOCUMENT', id, null, null);
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    const existing = expenses.find((e) => e.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    setAccountTransactions((prev) =>
      prev.map((tx) => {
        if (tx.referenceNo === existing.voucherNo) {
          return {
            ...tx,
            amount: updates.amount !== undefined ? updates.amount : tx.amount,
            accountId: updates.accountId !== undefined ? updates.accountId : tx.accountId,
            transactionDate: updates.expenseDate !== undefined ? updates.expenseDate : tx.transactionDate,
            description: `Expense: ${updates.category || existing.category} - ${updates.paidTo || existing.paidTo}`,
          };
        }
        return tx;
      })
    );
    logAudit('UPDATE_EXPENSE', 'EXPENSE', id, existing, updated);
  };

  const deleteExpense = (id: string): { success: boolean; message?: string } => {
    const existing = expenses.find((e) => e.id === id);
    if (!existing) return { success: false, message: 'Expense voucher not found.' };
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setAccountTransactions((prev) => prev.filter((tx) => tx.referenceNo !== existing.voucherNo));
    logAudit('DELETE_EXPENSE', 'EXPENSE', id, existing, null);
    return { success: true, message: `Expense voucher "${existing.voucherNo}" deleted and ledger reversed.` };
  };

  const updateAccountTransaction = (id: string, updates: Partial<AccountTransaction>) => {
    const existing = accountTransactions.find((tx) => tx.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setAccountTransactions((prev) => prev.map((tx) => (tx.id === id ? updated : tx)));
    logAudit('UPDATE_ACCOUNT_TX', 'ACCOUNT_TRANSACTION', id, existing, updated);
  };

  const deleteAccountTransaction = (id: string): { success: boolean; message?: string } => {
    const existing = accountTransactions.find((tx) => tx.id === id);
    if (!existing) return { success: false, message: 'Transaction not found.' };
    setAccountTransactions((prev) => prev.filter((tx) => tx.id !== id));
    logAudit('DELETE_ACCOUNT_TX', 'ACCOUNT_TRANSACTION', id, existing, null);
    return { success: true, message: 'Transaction record deleted.' };
  };

  const updateWeighment = (id: string, updates: Partial<Weighment>) => {
    const existing = weighments.find((w) => w.id === id);
    if (!existing) return;
    const gross = updates.grossWeight !== undefined ? updates.grossWeight : existing.grossWeight;
    const tare = updates.tareWeight !== undefined ? updates.tareWeight : existing.tareWeight;
    const ded = updates.approvedDeductions !== undefined ? updates.approvedDeductions : existing.approvedDeductions;
    const netWeight = calcNetWeight(gross, tare);
    const payableWeight = calcPayableWeight(gross, tare, ded);
    const updated: Weighment = {
      ...existing,
      ...updates,
      grossWeight: gross,
      tareWeight: tare,
      approvedDeductions: ded,
      netWeight,
      payableWeight,
    };
    setWeighments((prev) => prev.map((w) => (w.id === id ? updated : w)));
    logAudit('UPDATE_WEIGHMENT', 'WEIGHMENT', id, existing, updated);
  };

  const deleteWeighment = (id: string): { success: boolean; message?: string } => {
    const existing = weighments.find((w) => w.id === id);
    if (!existing) return { success: false, message: 'Weighment slip not found.' };
    setWeighments((prev) => prev.filter((w) => w.id !== id));
    logAudit('DELETE_WEIGHMENT', 'WEIGHMENT', id, existing, null);
    return { success: true, message: `Weighment slip "${existing.weighmentNo}" deleted.` };
  };

  const updateCollectionJob = (id: string, updates: Partial<CollectionJob>) => {
    const existing = collectionJobs.find((j) => j.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setCollectionJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
    logAudit('UPDATE_COLLECTION_JOB', 'COLLECTION_JOB', id, existing, updated);
  };

  const deleteCollectionJob = (id: string): { success: boolean; message?: string } => {
    const existing = collectionJobs.find((j) => j.id === id);
    if (!existing) return { success: false, message: 'Collection request not found.' };
    setCollectionJobs((prev) => prev.filter((j) => j.id !== id));
    logAudit('DELETE_COLLECTION_JOB', 'COLLECTION_JOB', id, existing, null);
    return { success: true, message: `Collection request "${existing.jobNo}" deleted.` };
  };

  const updateSalesOrder = (id: string, updates: Partial<SalesHeader>) => {
    const existing = sales.find((s) => s.id === id);
    if (!existing) return;
    if (existing.status === 'DISPATCHED' || existing.status === 'INVOICED') {
      throw new Error('Dispatched sales orders cannot be edited.');
    }
    const updated = { ...existing, ...updates };
    setSales((prev) => prev.map((s) => (s.id === id ? updated : s)));
    logAudit('UPDATE_SALES_ORDER', 'SALES_HEADER', id, existing, updated);
  };

  const deleteSalesOrder = (id: string): { success: boolean; message?: string } => {
    const existing = sales.find((s) => s.id === id);
    if (!existing) return { success: false, message: 'Sales order not found.' };
    if (existing.status === 'DISPATCHED' || existing.status === 'INVOICED') {
      return { success: false, message: 'Dispatched sales orders cannot be deleted as inventory lots have been consumed.' };
    }
    setSales((prev) => prev.filter((s) => s.id !== id));
    logAudit('DELETE_SALES_ORDER', 'SALES_HEADER', id, existing, null);
    return { success: true, message: `Sales order "${existing.salesNo}" deleted.` };
  };

  const updateTaxInvoice = (id: string, updates: Partial<Invoice>) => {
    const existing = invoices.find((inv) => inv.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    updated.immutableSnapshotJson = JSON.stringify(updated);
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
    logAudit('UPDATE_TAX_INVOICE', 'INVOICE', id, existing, updated);
  };

  const deleteTaxInvoice = (id: string): { success: boolean; message?: string } => {
    enforceAuthorization(currentUser, 'invoice:delete', company.id);
    const existing = invoices.find((inv) => inv.id === id);
    if (!existing) return { success: false, message: 'Invoice not found.' };
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    logAudit('DELETE_TAX_INVOICE', 'INVOICE', id, existing, null);
    return { success: true, message: `Invoice "${existing.invoiceNo}" deleted.` };
  };

  const updatePayment = (id: string, updates: Partial<Payment>) => {
    const existing = payments.find((p) => p.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
    logAudit('UPDATE_PAYMENT', 'PAYMENT', id, existing, updated);
  };

  const deletePayment = (id: string): { success: boolean; message?: string } => {
    enforceAuthorization(currentUser, 'finance:delete', company.id);
    const existing = payments.find((p) => p.id === id);
    if (!existing) return { success: false, message: 'Payment voucher not found.' };
    setPayments((prev) => prev.filter((p) => p.id !== id));
    setAccountTransactions((prev) => prev.filter((tx) => tx.referenceNo !== existing.paymentNo));
    logAudit('DELETE_PAYMENT', 'PAYMENT', id, existing, null);
    return { success: true, message: `Payment voucher "${existing.paymentNo}" deleted.` };
  };

  const reconcileStockCount = (
    yardId: string,
    lines: { materialId: string; physicalQuantity: number; reason?: string }[],
    notes?: string
  ) => {
    const seq = stockCounts.length + 1;
    const countNo = `STK-CNT-${String(seq).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const countLines = lines.map((l) => {
      const movementsForMat = stockMovements.filter((m) => m.materialId === l.materialId && m.yardId === yardId);
      const systemQty = roundTo3(movementsForMat.reduce((sum, m) => sum + m.quantity, 0));
      const variance = roundTo3(l.physicalQuantity - systemQty);

      return {
        id: 'scl-' + Math.random().toString(36).substring(2, 9),
        materialId: l.materialId,
        systemQuantity: systemQty,
        physicalQuantity: roundTo3(l.physicalQuantity),
        varianceQuantity: variance,
        reason: l.reason || 'Periodic Physical Stock Audit',
      };
    });

    const newStockCount: StockCount = {
      id: 'sc-' + Math.random().toString(36).substring(2, 11),
      countNo,
      countDate: now.split('T')[0],
      yardId,
      conductedBy: currentUser.fullName,
      status: 'APPROVED',
      approvedBy: currentUser.fullName,
      notes,
      lines: countLines,
      createdAt: now,
    };

    // If there are variances, create approved adjustment stock movements
    const adjustmentMovements: StockMovement[] = [];
    for (const cl of countLines) {
      if (Math.abs(cl.varianceQuantity) > 0.001) {
        const mat = materials.find((m) => m.id === cl.materialId);
        const unitCost = mat?.defaultPurchaseRate || 0;
        const mov = createStockMovement([...stockMovements, ...adjustmentMovements], {
          movementType: cl.varianceQuantity > 0 ? 'STOCK_ADJUSTMENT' : 'STOCK_LOSS',
          transactionRef: countNo,
          materialId: cl.materialId,
          yardId,
          quantity: cl.varianceQuantity,
          unitCost,
          notes: `Stock count reconciliation adjustment: ${cl.reason}`,
          createdBy: currentUser.fullName,
        });
        adjustmentMovements.push(mov);
      }
    }

    setStockCounts((prev) => [newStockCount, ...prev]);
    if (adjustmentMovements.length > 0) {
      setStockMovements((prev) => [...adjustmentMovements, ...prev]);
    }

    logAudit('RECONCILE_STOCK', 'STOCK_COUNT', newStockCount.id, null, newStockCount);
    return newStockCount;
  };

  const importParties = (rows: any[], dryRun: boolean) => {
    const res = migrateParties(rows, parties, dryRun);
    if (!dryRun && res.importedRecords.length > 0) {
      setParties((prev) => [...res.importedRecords, ...prev]);
      logAudit('IMPORT_PARTIES', 'PARTY_MIGRATION', 'CSV_BATCH', null, { count: res.importedRecords.length });
    }
    return res;
  };

  const importOpeningStock = (rows: any[], dryRun: boolean) => {
    const res = migrateOpeningStock(rows, materials, yards, currentUser.fullName, dryRun);
    if (!dryRun && res.importedRecords.length > 0) {
      const lots = res.importedRecords.map((r) => r.lot);
      const movs = res.importedRecords.map((r) => r.movement);
      setInventoryLots((prev) => [...lots, ...prev]);
      setStockMovements((prev) => [...movs, ...prev]);
      logAudit('IMPORT_STOCK', 'STOCK_MIGRATION', 'CSV_BATCH', null, { count: lots.length });
    }
    return res;
  };

  const resetToDemoData = () => {
    enforceAuthorization(currentUser, 'admin:full', company.id);
    setCompanies(INITIAL_COMPANIES);
    setActiveCompanyId('comp-yasoth-01');
    setYards(INITIAL_YARDS);
    setMaterials(INITIAL_MATERIALS);
    setMaterialGrades(INITIAL_MATERIAL_GRADES);
    setParties(INITIAL_PARTIES);
    setVehicles(INITIAL_VEHICLES);
    setVehicleDocuments(INITIAL_VEHICLE_DOCS);
    setEmployees(INITIAL_EMPLOYEES);
    setAttendance(INITIAL_ATTENDANCE);
    setAccounts(INITIAL_ACCOUNTS);
    setAccountTransactions(INITIAL_ACCOUNT_TRANSACTIONS);
    setExpenses(INITIAL_EXPENSES);
    setWeighments([]);
    setCollectionJobs([]);
    setPurchases([]);
    setInventoryLots(INITIAL_LOTS);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setSales([]);
    setInvoices(INITIAL_INVOICES);
    setPayments([]);
    setStockCounts([]);
    setAuditLogs([]);
    setCommercialDocuments(INITIAL_COMMERCIAL_DOCUMENTS);
    setJournalEntries(INITIAL_JOURNAL_ENTRIES);
    setSalaryRecords(INITIAL_SALARY_RECORDS);
    setEmployeeAdvances(INITIAL_EMPLOYEE_ADVANCES);
    setDailyLabourEntries(INITIAL_DAILY_LABOUR);
    setLabourPayments(INITIAL_LABOUR_PAYMENTS);
    setContractors(INITIAL_CONTRACTORS);
    setContractorWorkEntries(INITIAL_CONTRACTOR_WORK);
    setContractorPayments(INITIAL_CONTRACTOR_PAYMENTS);
    setDailyCashClosings(INITIAL_DAILY_CASH_CLOSINGS);
    localStorage.clear();
  };

  const exportBackup = () => {
    const backup = {
      timestamp: new Date().toISOString(),
      companies,
      activeCompanyId,
      company,
      yards,
      materials,
      parties,
      vehicles,
      vehicleDocuments,
      employees,
      attendance,
      accounts,
      accountTransactions,
      expenses,
      weighments,
      collectionJobs,
      purchases,
      inventoryLots,
      stockMovements,
      sales,
      invoices,
      payments,
      stockCounts,
      auditLogs,
      commercialDocuments,
      journalEntries,
      dailyTasks,
      workNotes,
      uploadedDocuments,
      salaryRecords,
      employeeAdvances,
      dailyLabourEntries,
      labourPayments,
      contractors,
      contractorWorkEntries,
      contractorPayments,
      dailyCashClosings,
    };
    return JSON.stringify(backup, null, 2);
  };

  const getCurrentDatabasePayload = (): BackupDatabasePayload => ({
    companies,
    activeCompanyId,
    yards,
    materials,
    materialGrades,
    parties,
    vehicles,
    vehicleDocuments,
    employees,
    attendance,
    accounts,
    accountTransactions,
    expenses,
    weighments,
    collectionJobs,
    purchases,
    inventoryLots,
    stockMovements,
    sales,
    invoices,
    payments,
    stockCounts,
    auditLogs,
    commercialDocuments,
    journalEntries,
    dailyTasks,
    workNotes,
    uploadedDocuments,
    salaryRecords,
    employeeAdvances,
    dailyLabourEntries,
    labourPayments,
    contractors,
    contractorWorkEntries,
    contractorPayments,
    dailyCashClosings,
  });

  const applyRestoredPayload = (data: BackupDatabasePayload) => {
    if (data.companies) setCompanies(data.companies);
    if (data.activeCompanyId) setActiveCompanyId(data.activeCompanyId);
    if (data.yards) setYards(data.yards);
    if (data.materials) setMaterials(data.materials);
    if (data.materialGrades) setMaterialGrades(data.materialGrades);
    if (data.parties) setParties(data.parties);
    if (data.vehicles) setVehicles(data.vehicles);
    if (data.vehicleDocuments) {
      setVehicleDocuments((prev) =>
        data.vehicleDocuments!.map((incoming) => {
          const local = prev.find((p) => p.id === incoming.id);
          return {
            ...incoming,
            attachmentUrl: incoming.attachmentUrl || local?.attachmentUrl || '',
          };
        })
      );
    }
    if (data.employees) setEmployees(data.employees);
    if (data.attendance) setAttendance(data.attendance);
    if (data.accounts) setAccounts(data.accounts);
    if (data.accountTransactions) setAccountTransactions(data.accountTransactions);
    if (data.expenses) setExpenses(data.expenses);
    if (data.weighments) setWeighments(data.weighments);
    if (data.collectionJobs) setCollectionJobs(data.collectionJobs);
    if (data.purchases) setPurchases(data.purchases);
    if (data.inventoryLots) setInventoryLots(data.inventoryLots);
    if (data.stockMovements) setStockMovements(data.stockMovements);
    if (data.sales) setSales(data.sales);
    if (data.invoices) setInvoices(data.invoices);
    if (data.payments) setPayments(data.payments);
    if (data.stockCounts) setStockCounts(data.stockCounts);
    if (data.commercialDocuments) setCommercialDocuments(data.commercialDocuments);
    if (data.journalEntries) setJournalEntries(data.journalEntries);
    if (data.dailyTasks) setDailyTasks(data.dailyTasks);
    if (data.workNotes) setWorkNotes(data.workNotes);
    if (data.uploadedDocuments) {
      setUploadedDocuments((prev) =>
        data.uploadedDocuments!.map((incoming) => {
          const local = prev.find((p) => p.id === incoming.id);
          return {
            ...incoming,
            fileDataUrl: incoming.fileDataUrl || local?.fileDataUrl || '',
          };
        })
      );
    }
    if (data.salaryRecords) setSalaryRecords(data.salaryRecords);
    if (data.employeeAdvances) setEmployeeAdvances(data.employeeAdvances);
    if (data.dailyLabourEntries) setDailyLabourEntries(data.dailyLabourEntries);
    if (data.labourPayments) setLabourPayments(data.labourPayments);
    if (data.contractors) setContractors(data.contractors);
    if (data.contractorWorkEntries) setContractorWorkEntries(data.contractorWorkEntries);
    if (data.contractorPayments) setContractorPayments(data.contractorPayments);
    if (data.dailyCashClosings) setDailyCashClosings(data.dailyCashClosings);
  };

  const restoreBackup = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      applyRestoredPayload(data);
      return true;
    } catch {
      return false;
    }
  };

  const syncPushToCloud = async (actorOverride?: string) => {
    const payload = getCurrentDatabasePayload();
    const actor = actorOverride || currentUser.fullName || 'Prop. P. Nandha Kumar';
    return await teamSyncService.pushToCloud(payload, actor);
  };

  const syncPullFromCloud = async () => {
    const res = await teamSyncService.pullFromCloud();
    if (res.success && res.payload) {
      applyRestoredPayload(res.payload);
    }
    return res;
  };

  // Phase 5 Dedicated Backup Manager Implementations
  const createBackup = async (options?: {
    companyScoped?: boolean;
    isEncrypted?: boolean;
    password?: string;
    destination?: BackupDestination;
  }): Promise<{ success: boolean; filename: string; checksum: string; error?: string; rawJson?: string }> => {
    try {
      enforceAuthorization(currentUser, 'settings:backup');
      const currentState = getCurrentDatabasePayload();
      const isScoped = !!options?.companyScoped;

      const backupResult = await generateBackup(currentState, {
        companyId: isScoped ? activeCompanyId : undefined,
        companyName: isScoped ? activeCompany.companyName : undefined,
        actor: currentUser.fullName || 'System Admin',
        isEncrypted: options?.isEncrypted,
        password: options?.password,
        destination: options?.destination || 'LOCAL_FILE',
      });

      // Handle Google Drive destination
      let driveNotice: string | undefined;
      if (options?.destination === 'GOOGLE_DRIVE') {
        const mimeType = options?.isEncrypted ? 'application/octet-stream' : 'application/json';
        const uploadRes = await googleDriveService.uploadBackupFile(backupResult.filename, backupResult.rawJson, mimeType);
        if (!uploadRes.success) {
          if (uploadRes.error && uploadRes.error.includes('downloaded to device local storage')) {
            driveNotice = uploadRes.error;
          } else {
            throw new Error(uploadRes.error || 'Failed to upload backup to Google Drive');
          }
        }
      }

      // Download file to client device if running in browser
      if (typeof window !== 'undefined' && typeof document !== 'undefined' && options?.destination !== 'GOOGLE_DRIVE') {
        const mimeType = options?.isEncrypted ? 'application/octet-stream' : 'application/json';
        if ((window as any).AndroidNative && typeof (window as any).AndroidNative.saveFileToDownloads === 'function') {
          (window as any).AndroidNative.saveFileToDownloads(backupResult.filename, backupResult.rawJson, mimeType);
        }
        const blob = new Blob([backupResult.rawJson], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backupResult.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // Record in backup history
      setBackupHistory((prev) => [backupResult.historyItem, ...prev]);

      // Audit log
      logAudit(
        'BACKUP_CREATED',
        'SYSTEM_BACKUP',
        backupResult.historyItem.id,
        null,
        {
          filename: backupResult.filename,
          checksum: backupResult.checksum,
          records: backupResult.historyItem.totalRecords,
          destination: options?.destination || 'LOCAL_FILE',
        }
      );

      return {
        success: true,
        filename: backupResult.filename,
        checksum: backupResult.checksum,
        rawJson: backupResult.rawJson,
        error: driveNotice,
      };
    } catch (err: any) {
      return {
        success: false,
        filename: '',
        checksum: '',
        error: err.message || 'Backup generation failed',
      };
    }
  };

  const previewRestore = async (
    fileContent: string,
    password?: string
  ): Promise<RestorePreviewResult> => {
    const valResult = await validateBackupIntegrity(fileContent, { password });
    if (!valResult.isValid || !valResult.parsedArchive) {
      return {
        isValid: false,
        schemaVersion: 'UNKNOWN',
        isCompatible: false,
        manifest: {} as any,
        recordCounts: {},
        financialTotals: {},
        warnings: [],
        errors: [valResult.error || 'Invalid or corrupted backup archive.'],
      };
    }

    return generateRestorePreview(valResult.parsedArchive, activeCompanyId);
  };

  const executeSystemRestore = async (
    fileContent: string,
    password?: string,
    mode: 'FULL' | 'COMPANY_SCOPED' = 'FULL'
  ): Promise<{ success: boolean; recordsRestored: number; error?: string }> => {
    try {
      enforceAuthorization(currentUser, 'settings:restore');

      const valResult = await validateBackupIntegrity(fileContent, { password });
      if (!valResult.isValid || !valResult.parsedArchive) {
        throw new Error(valResult.error || 'Integrity validation failed. File may be corrupted or password invalid.');
      }

      const currentState = getCurrentDatabasePayload();

      // Step 1: Pre-restore Safety Snapshot
      const safetySnapshot = await createPreRestoreSafetySnapshot(currentState, currentUser.fullName || 'System Safety Automator');
      setBackupHistory((prev) => [safetySnapshot.historyItem, ...prev]);

      // Step 2: Execute Restore
      const { restoredState, restoreLog } = executeRestore(valResult.parsedArchive, currentState, {
        backupId: valResult.parsedArchive.manifest.sha256,
        preRestoreBackupId: safetySnapshot.historyItem.id,
        restoreMode: mode,
        actor: currentUser.fullName || 'Admin',
        companyId: activeCompanyId,
      });

      // Step 3: Apply Restored State
      applyRestoredPayload(restoredState);

      // Step 4: Record restore log
      setRestoreLogs((prev) => [restoreLog, ...prev]);

      const totalRestored = Object.values(restoreLog.recordsRestoredJson).reduce((a, b) => a + b, 0);

      logAudit(
        'RESTORE_SYSTEM_EXECUTED',
        'SYSTEM_RESTORE',
        restoreLog.id,
        null,
        { mode, totalRestored, safetySnapshotId: safetySnapshot.historyItem.id }
      );

      return {
        success: true,
        recordsRestored: totalRestored,
      };
    } catch (err: any) {
      return {
        success: false,
        recordsRestored: 0,
        error: err.message || 'Restoration failed.',
      };
    }
  };

  const updateScheduleConfig = (updates: Partial<BackupScheduleConfig>) => {
    setBackupSchedule((prev) => {
      const next: BackupScheduleConfig = {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      if (updates.frequency) {
        next.nextRunAt = calculateNextScheduledRun(updates.frequency);
      }
      return next;
    });
  };

  const exportCsvRegister = (
    registerType: 'CUSTOMERS' | 'SUPPLIERS' | 'INVOICES' | 'PURCHASES' | 'EXPENSES' | 'STOCK'
  ): string => {
    switch (registerType) {
      case 'CUSTOMERS': {
        const custs = parties.filter((p) => p.partyType === 'CUSTOMER' && (!p.companyId || p.companyId === activeCompanyId));
        return exportRegistryAsCSV(custs, [
          { header: 'Party Code', key: 'partyCode' },
          { header: 'Company / Trade Name', key: 'tradeName' },
          { header: 'Legal Name', key: 'legalName' },
          { header: 'GSTIN', key: 'gstin' },
          { header: 'Phone', key: 'phone' },
          { header: 'City', key: 'city' },
          { header: 'Current Balance (INR)', key: 'currentBalance' },
        ]);
      }
      case 'SUPPLIERS': {
        const supps = parties.filter((p) => p.partyType === 'SUPPLIER' && (!p.companyId || p.companyId === activeCompanyId));
        return exportRegistryAsCSV(supps, [
          { header: 'Party Code', key: 'partyCode' },
          { header: 'Company / Trade Name', key: 'tradeName' },
          { header: 'Legal Name', key: 'legalName' },
          { header: 'GSTIN', key: 'gstin' },
          { header: 'Phone', key: 'phone' },
          { header: 'City', key: 'city' },
          { header: 'Current Balance (INR)', key: 'currentBalance' },
        ]);
      }
      case 'INVOICES': {
        const invs = invoices.filter((i) => !i.companyId || i.companyId === activeCompanyId);
        return exportRegistryAsCSV(invs, [
          { header: 'Invoice No', key: 'invoiceNo' },
          { header: 'Invoice Date', key: 'invoiceDate' },
          { header: 'Customer Name', key: 'buyerPartyName' },
          { header: 'Subtotal (INR)', key: 'subtotalAmount' },
          { header: 'CGST (INR)', key: 'cgstTotal' },
          { header: 'SGST (INR)', key: 'sgstTotal' },
          { header: 'Total (INR)', key: 'totalAmount' },
          { header: 'Payment Status', key: 'paymentStatus' },
        ]);
      }
      case 'PURCHASES': {
        const purs = purchases.filter((p) => !p.companyId || p.companyId === activeCompanyId);
        return exportRegistryAsCSV(purs, [
          { header: 'Purchase No', key: 'purchaseNo' },
          { header: 'Date', key: 'purchaseDate' },
          { header: 'Supplier Name', key: 'supplierPartyName' },
          { header: 'Subtotal (INR)', key: 'subtotalAmount' },
          { header: 'Tax (INR)', key: 'taxAmount' },
          { header: 'Total Amount (INR)', key: 'totalAmount' },
          { header: 'Status', key: 'status' },
        ]);
      }
      case 'EXPENSES': {
        const exps = expenses.filter((e) => !e.companyId || e.companyId === activeCompanyId);
        return exportRegistryAsCSV(exps, [
          { header: 'Voucher No', key: 'voucherNo' },
          { header: 'Expense Date', key: 'expenseDate' },
          { header: 'Category', key: 'category' },
          { header: 'Description', key: 'description' },
          { header: 'Amount (INR)', key: 'amount' },
          { header: 'Payment Mode', key: 'paymentMode' },
        ]);
      }
      case 'STOCK': {
        const lots = inventoryLots.filter((l) => !l.companyId || l.companyId === activeCompanyId);
        return exportRegistryAsCSV(lots, [
          { header: 'Lot No', key: 'lotNo' },
          { header: 'Material Name', key: 'materialName' },
          { header: 'Current Weight (KG)', key: 'currentNetWeight' },
          { header: 'Unit Rate (INR/KG)', key: 'unitRate' },
          { header: 'Inventory Value (INR)', key: 'totalCost' },
        ]);
      }
      default:
        return '';
    }
  };

  // Phase 6 Excel Workbooks
  const exportSingleExcelWorkbook = (filename: string) => {
    enforceAuthorization(currentUser, 'reports:view');
    const currentState = getCurrentDatabasePayload();
    const workbooks = generateAllCompanyWorkbooks(currentState, activeCompanyId);
    const target = workbooks[filename];
    if (target) {
      downloadWorkbookInBrowser(target);
      logAudit('EXCEL_WORKBOOK_EXPORTED', 'REPORT', target.filename, null, { filename });
    }
  };

  const exportConsolidatedMasterWorkbook = () => {
    enforceAuthorization(currentUser, 'reports:view');
    const currentState = getCurrentDatabasePayload();
    const target = generateConsolidatedMasterWorkbook(currentState, activeCompanyId);
    downloadWorkbookInBrowser(target);
    logAudit('EXCEL_CONSOLIDATED_MASTER_EXPORTED', 'REPORT', target.filename, null, { filename: target.filename });
  };

  const exportAllExcelWorkbooks = async () => {
    enforceAuthorization(currentUser, 'reports:view');
    const currentState = getCurrentDatabasePayload();
    await downloadAllCompanyWorkbooksInBrowser(currentState, activeCompanyId);
    logAudit('ALL_EXCEL_WORKBOOKS_EXPORTED', 'REPORT', activeCompanyId, null, { companyId: activeCompanyId });
  };

  // Automated scheduled backup check (runs on mount and periodic 60s check when app is open)
  useEffect(() => {
    if (!backupSchedule.isEnabled || backupSchedule.frequency === 'MANUAL_ONLY' || !backupSchedule.nextRunAt) {
      return;
    }

    const checkAndRunSchedule = async () => {
      const now = new Date();
      const scheduledTime = new Date(backupSchedule.nextRunAt!);
      if (now >= scheduledTime) {
        console.log(`[BackupScheduler] Triggering scheduled ${backupSchedule.frequency} backup...`);
        const result = await createBackup({
          isEncrypted: backupSchedule.encryptByDefault,
          destination: backupSchedule.destination,
        });

        const nextTime = calculateNextScheduledRun(backupSchedule.frequency, now);
        updateScheduleConfig({
          lastRunAt: now.toISOString(),
          lastRunStatus: result.success ? 'SUCCESS' : 'FAILED',
          nextRunAt: nextTime,
        });
      }
    };

    checkAndRunSchedule();
    const intervalId = setInterval(checkAndRunSchedule, 60000);
    return () => clearInterval(intervalId);
  }, [backupSchedule]);

  return (
    <ERPContext.Provider
      value={{
        currentUser,
        login,
        logout,
        register,
        requestPasswordRecovery,
        switchRole,
        checkPermission,
        companies,
        activeCompanyId,
        activeCompany,
        registerCompany,
        updateCompany,
        switchCompany,
        company,
        updateCompanySettings,
        yards,
        materials,
        materialGrades,
        parties,
        vehicles,
        vehicleDocuments,
        employees,
        attendance,
        accounts,
        accountTransactions,
        expenses,
        weighments,
        collectionJobs,
        purchases,
        inventoryLots,
        stockMovements,
        sales,
        invoices,
        payments,
        stockCounts,
        auditLogs,
        addParty,
        updateParty,
        deleteParty,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        addVehicleDocument,
        updateVehicleDocument,
        deleteVehicleDocument,
        renewVehicleDocument,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        updatePurchase,
        deletePurchase,
        recordWeighment,
        createPurchase,
        postPurchase,
        createCollectionJob,
        updateCollectionStatus,
        createSalesOrder,
        dispatchSalesOrder,
        createTaxInvoice,
        recordPayment,
        updatePayment,
        deletePayment,
        recordContraTransfer,
        recordExpense,
        updateExpense,
        deleteExpense,
        payUnpaidExpense,
        reverseExpense,
        salaryRecords,
        employeeAdvances,
        dailyLabourEntries,
        labourPayments,
        contractors,
        contractorWorkEntries,
        contractorPayments,
        dailyCashClosings,
        issueEmployeeAdvance,
        recordSalaryPayment,
        updateSalaryRecord,
        deleteSalaryRecord,
        paySalaryInstallment,
        reverseSalaryRecord,
        recordDailyLabour,
        updateDailyLabour,
        deleteDailyLabour,
        reverseDailyLabour,
        recordLabourPayment,
        addContractor,
        updateContractor,
        deleteContractor,
        recordContractorWork,
        updateContractorWork,
        deleteContractorWork,
        reverseContractorWork,
        payContractorWork,
        getAuthoritativeProfitAndLossReport,
        recordDailyCashClosing,
        getAccountBalance,
        addAccount,
        updateAccount,
        deleteAccount,
        updateAccountTransaction,
        deleteAccountTransaction,
        updateWeighment,
        deleteWeighment,
        updateCollectionJob,
        deleteCollectionJob,
        updateSalesOrder,
        deleteSalesOrder,
        updateTaxInvoice,
        deleteTaxInvoice,
        markAttendance,
        updateAttendanceEntry,
        deleteAttendanceEntry,
        addAttendanceRecord,
        reconcileStockCount,
        importParties,
        importOpeningStock,
        commercialDocuments,
        journalEntries,
        createCommercialDoc,
        updateCommercialDoc,
        deleteCommercialDoc,
        convertCommercialDoc,
        issueCreditNote,
        issueDebitNote,
        getGeneralLedgerReport,
        getTrialBalanceReport,
        getProfitAndLossReport,
        getBalanceSheetReport,
        getPartyStatementReport,
        resetToDemoData,
        exportBackup,
        restoreBackup,
        backupHistory,
        restoreLogs,
        backupSchedule,
        createBackup,
        previewRestore,
        executeSystemRestore,
        updateScheduleConfig,
        exportCsvRegister,
        exportSingleExcelWorkbook,
        exportAllExcelWorkbooks,
        exportConsolidatedMasterWorkbook,
        dailyTasks,
        createDailyTask,
        updateDailyTask,
        toggleDailyTask,
        deleteDailyTask,
        workNotes,
        createWorkNote,
        updateWorkNote,
        deleteWorkNote,
        uploadedDocuments,
        createUploadedDocument,
        deleteUploadedDocument,
        getCurrentDatabasePayload,
        applyRestoredPayload,
        syncPushToCloud,
        syncPullFromCloud,
      }}
    >
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = () => {
  const context = useContext(ERPContext);
  if (!context) {
    throw new Error('useERP must be used within an ERPProvider');
  }
  return context;
};
