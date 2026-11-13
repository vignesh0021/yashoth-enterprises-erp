// Yasoth Enterprises — Production Scrap ERP
// Domain Model & Type Definitions

export type UserRole = 
  | 'owner_admin' 
  | 'manager' 
  | 'purchase_operator' 
  | 'weighment_operator' 
  | 'weighbridge_operator'
  | 'sales_operator' 
  | 'accounts_operator' 
  | 'store_operator' 
  | 'hr_operator' 
  | 'auditor';

export interface UserSession {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId?: string;
  token?: string;
  expiresAt?: number;
  lastActiveAt?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId?: string;
  passwordHash?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CompanySettings {
  id: string;
  code?: string;
  name?: string;
  companyName: string; // compatibility with existing views
  legalName: string;
  tradeName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateName: string;
  stateCode: string; // e.g. "33" for Tamil Nadu
  pincode: string;
  gstin: string;
  pan?: string;
  cin?: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccountNo: string;
  bankBranch?: string;
  bankBranchIfsc: string; // compatibility
  invoicePrefix: string;
  purchasePrefix?: string;
  quotationPrefix?: string;
  defaultBaseUnit: string;
  currency?: string;
  isActive?: boolean;
  isDefault?: boolean;
  logoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Company extends CompanySettings {
  code: string;
  name: string;
  bankBranch: string;
  purchasePrefix: string;
  currency: string;
  isActive: boolean;
}

export interface Yard {
  id: string;
  companyId?: string;
  code: string;
  name: string;
  locationAddress: string;
  isActive: boolean;
}

export type ScrapCategory = 'Steel' | 'Iron' | 'Aluminium' | 'Copper' | 'Brass' | 'Plastic' | 'Other';

export interface Material {
  id: string;
  companyId?: string;
  code: string;
  name: string;
  category: ScrapCategory;
  baseUnit: string; // e.g. 'KG'
  hsnCode: string; // e.g. '7204'
  defaultPurchaseRate: number;
  defaultSalesRate: number;
  defaultGstRate: number; // e.g. 18.0
  minStockAlert: number;
  isActive: boolean;
}

export interface MaterialGrade {
  id: string;
  materialId: string;
  gradeCode: string;
  gradeName: string;
  rateAdjustment: number;
  isActive: boolean;
}

export type PartyType = 'SUPPLIER' | 'CUSTOMER' | 'BOTH';

export interface Party {
  id: string;
  companyId?: string;
  partyCode: string;
  legalName: string;
  tradeName?: string;
  partyType: PartyType;
  contactPerson: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateName: string;
  stateCode: string;
  gstin?: string;
  pan?: string;
  paymentTerms: string;
  creditLimit: number;
  openingBalance: number; // positive = customer owes us; negative = we owe supplier
  openingBalanceDate: string;
  isActive: boolean;

  // Scrap Buyer & Agent CRM Fields (Phase 7)
  buyerType?: 'SCRAP_BUYER' | 'AGENT' | 'BROKER' | 'REGULAR_CUSTOMER' | 'PROSPECT';
  whatsApp?: string;
  location?: string;
  interestedMaterials?: string[];
  materialGrade?: string;
  preferredQuantity?: number;
  expectedBuyingRate?: number;
  minQuantity?: number;
  maxQuantity?: number;
  creditTerms?: string;
  transportArrangements?: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  assignedEmployee?: string;
  crmStatus?: 'LEAD' | 'CONTACTED' | 'QUOTED' | 'NEGOTIATING' | 'ACTIVE' | 'INACTIVE';
  notes?: string;
}

export type WeighingMethod = 'MANUAL_SCALE' | 'WEIGHBRIDGE_SLIP' | 'HARDWARE_LINK';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';

export interface Weighment {
  id: string;
  companyId?: string;
  weighmentNo: string;
  weighingMethod: WeighingMethod;
  slipReference?: string;
  vehicleRegistration?: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number; // calculated: gross - tare
  approvedDeductions: number;
  payableWeight: number; // net - deductions
  unit: string; // 'KG'
  firstWeightTime?: string;
  secondWeightTime?: string;
  operatorName: string;
  slipImageUrl?: string;
  verificationStatus: VerificationStatus;
  notes?: string;
  createdAt: string;
}

export type CollectionStatus = 'REQUESTED' | 'ASSIGNED' | 'IN_TRANSIT' | 'WEIGHED' | 'COMPLETED' | 'CANCELLED';

export interface CollectionJob {
  id: string;
  companyId?: string;
  jobNo: string;
  supplierPartyId: string;
  pickupLocation: string;
  materialId: string;
  plannedDate: string;
  assignedVehicleId?: string;
  assignedStaffId?: string;
  estimatedQuantity: number;
  actualWeight?: number;
  transportExpenses: number;
  status: CollectionStatus;
  resultingPurchaseId?: string;
  notes?: string;
  createdAt: string;
}

export type PurchaseStatus = 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
export type PurchaseSourceType = 'DIRECT_SUPPLIER' | 'COLLECTION_PICKUP' | 'GATE_PURCHASE';

export interface PurchaseLine {
  id: string;
  materialId: string;
  gradeId?: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  deductions: number;
  payableWeight: number;
  ratePerUnit: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface PurchaseHeader {
  id: string;
  companyId?: string;
  purchaseNo: string;
  transactionDate: string;
  supplierPartyId: string;
  sourceType: PurchaseSourceType;
  collectionJobId?: string;
  yardId: string;
  vehicleRegistration?: string;
  weighmentId?: string;
  lines: PurchaseLine[];
  subtotalAmount: number;
  taxAmount: number;
  otherCharges: number;
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  status: PurchaseStatus;
  createdBy: string;
  approvedBy?: string;
  postedAt?: string;
  createdAt: string;
}

export interface InventoryLot {
  id: string;
  companyId?: string;
  lotNumber: string;
  materialId: string;
  gradeId?: string;
  yardId: string;
  sourcePurchaseId?: string;
  initialQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  receivedAt: string;
  isExhausted: boolean;
}

export type MovementType = 
  | 'PURCHASE_RECEIPT'
  | 'COLLECTION_RECEIPT'
  | 'SALES_DISPATCH'
  | 'YARD_TRANSFER_IN'
  | 'YARD_TRANSFER_OUT'
  | 'STOCK_ADJUSTMENT'
  | 'STOCK_LOSS'
  | 'REVERSAL'
  | 'OPENING_STOCK';

export interface StockMovement {
  id: string;
  companyId?: string;
  movementType: MovementType;
  transactionRef: string;
  materialId: string;
  gradeId?: string;
  yardId: string;
  lotId?: string;
  quantity: number; // positive = inward, negative = outward
  unitCost: number;
  totalCost: number;
  reversalMovementId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export type SalesStatus = 'DRAFT' | 'CONFIRMED' | 'DISPATCHED' | 'INVOICED' | 'CANCELLED';

export interface SalesLotAllocation {
  id: string;
  lotId: string;
  lotNumber: string;
  allocatedQuantity: number;
  unitCost: number;
  totalCost: number;
}

export interface SalesLine {
  id: string;
  materialId: string;
  gradeId?: string;
  quantity: number;
  ratePerUnit: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  lotAllocations: SalesLotAllocation[];
}

export interface SalesHeader {
  id: string;
  companyId?: string;
  salesNo: string;
  orderDate: string;
  customerPartyId: string;
  yardId: string;
  vehicleRegistration?: string;
  weighmentId?: string;
  lines: SalesLine[];
  status: SalesStatus;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  allocatedCogs: number;
  invoiceId?: string;
  notes?: string;
  dispatchedAt?: string;
  createdBy: string;
  createdAt: string;
}

export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface InvoiceLine {
  id: string;
  serialNo: number;
  descriptionOfGoods: string;
  hsnSac: string;
  unit: string;
  quantity: number;
  rate: number;
  taxableValue: number;
}

export interface Invoice {
  id: string;
  companyId?: string;
  invoiceNo: string;
  invoiceDate: string;
  salesHeaderId?: string;
  customerPartyId: string;
  customerName: string;
  billingAddress: string;
  shippingAddress: string;
  customerGstin?: string;
  customerStateName: string;
  customerStateCode: string;
  placeOfSupply: string;
  destination?: string;
  ewayBillNo?: string;
  deliveryNote?: string;
  vehicleRegistration?: string;
  lines: InvoiceLine[];
  subtotalTaxable: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  taxAmountInWords: string;
  paymentStatus: InvoicePaymentStatus;
  amountPaid: number;
  outstandingBalance: number;
  immutableSnapshotJson: string; // JSON copy of entire issued invoice
  isCancelled: boolean;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
}

export type PaymentDirection = 'INFLOW_RECEIPT' | 'OUTFLOW_PAYMENT';
export type PaymentMethod = 'CASH' | 'NEFT_RTGS' | 'UPI' | 'CHEQUE' | 'IMPS';

export interface PaymentAllocation {
  id: string;
  invoiceId?: string;
  purchaseHeaderId?: string;
  allocatedAmount: number;
}

export interface Payment {
  id: string;
  companyId?: string;
  paymentNo: string;
  paymentDate: string;
  direction: PaymentDirection;
  partyId: string;
  accountId: string;
  totalAmount: number;
  unallocatedAmount: number;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  notes?: string;
  allocations: PaymentAllocation[];
  createdBy: string;
  createdAt: string;
}

export type AccountType = 'CASH' | 'BANK';
export type TransactionType = 
  | 'CUSTOMER_RECEIPT'
  | 'SUPPLIER_PAYMENT'
  | 'CONTRA_TRANSFER_IN'
  | 'CONTRA_TRANSFER_OUT'
  | 'OPERATING_EXPENSE'
  | 'EMPLOYEE_ADVANCE'
  | 'OWNER_INJECTION'
  | 'OWNER_DRAWING'
  | 'OPENING_BALANCE'
  | 'ACCOUNT_ADJUSTMENT';

export interface CashBankAccount {
  id: string;
  companyId?: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  openingBalance: number;
  openingBalanceDate: string;
  isActive: boolean;
}

export interface AccountTransaction {
  id: string;
  companyId?: string;
  accountId: string;
  transactionDate: string;
  transactionType: TransactionType;
  direction: 'DEBIT' | 'CREDIT'; // DEBIT = money in; CREDIT = money out
  amount: number;
  contraAccountId?: string;
  paymentId?: string;
  referenceNo?: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

export const EXPENSE_CATEGORIES = [
  'Daily Labour',
  'Food / Lunch',
  'Tea / Drinking Water',
  'Loading / Unloading',
  'Vehicle Rent',
  'Diesel / Petrol',
  'Electricity',
  'Repair / Maintenance',
  'Office Expenses',
  'Other Expenses'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number] | string;

export interface Expense {
  id: string;
  companyId?: string;
  voucherNo: string;
  expenseDate: string;
  category: ExpenseCategory;
  description?: string;
  amount: number;
  accountId: string;
  paymentMode?: 'CASH' | 'BANK' | 'UNPAID';
  status?: 'PAID' | 'UNPAID' | 'REVERSED';
  approvalStatus?: 'APPROVED' | 'PENDING' | 'REJECTED';
  enteredBy?: string;
  vehicleId?: string;
  paidTo: string;
  billReference?: string;
  attachmentUrl?: string;
  notes?: string;
  reversalExpenseId?: string;
  reversalReason?: string;
  createdBy: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  companyId?: string;
  registrationNo: string;
  vehicleType: string;
  ownershipType: 'OWNED' | 'HIRED' | 'CUSTOMER_VEHICLE' | 'SUPPLIER_VEHICLE';
  driverName?: string;
  driverPhone?: string;
  tareWeight: number;
  isActive: boolean;
}

export interface VehicleDocument {
  id: string;
  companyId?: string;
  vehicleId: string;
  documentType: 'RC' | 'INSURANCE' | 'FITNESS' | 'PERMIT' | 'POLLUTION' | 'ROAD_TAX';
  documentNumber?: string;
  issueDate?: string;
  expiryDate: string;
  reminderDaysBefore: number;
  attachmentUrl?: string;
  notes?: string;
}

export interface Employee {
  id: string;
  companyId?: string;
  employeeCode: string;
  fullName: string;
  designation: string;
  department: string;
  phone: string;
  joiningDate: string;
  dailyWageRate: number;
  monthlySalary: number;
  overtimeHourlyRate?: number;
  currentAdvanceBalance: number;
  isActive: boolean;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'OVERTIME' | 'DOUBLE_SHIFT';

export interface AttendanceEntry {
  id: string;
  companyId?: string;
  employeeId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  overtimeHours: number;
  remarks?: string;
  markedBy: string;
  isCorrected: boolean;
  correctionReason?: string;
}

export interface StockCountLine {
  id: string;
  materialId: string;
  gradeId?: string;
  systemQuantity: number;
  physicalQuantity: number;
  varianceQuantity: number; // physical - system
  reason?: string;
}

export interface StockCount {
  id: string;
  companyId?: string;
  countNo: string;
  countDate: string;
  yardId: string;
  conductedBy: string;
  status: 'DRAFT' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  notes?: string;
  lines: StockCountLine[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  companyId?: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldState?: string;
  newState?: string;
  timestamp: string;
}

export const DOMAIN_TYPE_REGISTRY = 'YE_DOMAIN_TYPES_V1';

// Phase 4: Commercial Documents & Double-Entry Accounting
export type CommercialDocType = 
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_ORDER'
  | 'QUOTATION'
  | 'PROFORMA_INVOICE'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'PAYMENT_RECEIPT';

export interface CommercialDocLine {
  id: string;
  serialNo: number;
  materialId?: string;
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  rate: number;
  taxableValue: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export interface CommercialDocument {
  id: string;
  companyId: string;
  documentType: CommercialDocType;
  documentNo: string;
  documentDate: string;
  dueDate?: string;
  referenceNo?: string;
  originalDocumentId?: string;
  partyId: string;
  partyName: string;
  partyGstin?: string;
  partyAddress: string;
  placeOfSupply: string;
  stateCode: string;
  lines: CommercialDocLine[];
  subtotalTaxable: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  outstandingBalance: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  notes?: string;
  termsAndConditions?: string;
  createdBy: string;
  createdAt: string;
}

export type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export interface ChartOfAccount {
  code: string;
  name: string;
  category: AccountCategory;
  normalBalance: 'DEBIT' | 'CREDIT';
  isSystem: boolean;
}

export interface JournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  partyId?: string;
  partyName?: string;
  lineNarration?: string;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  entryNo: string;
  entryDate: string;
  sourceType: 
    | 'SALES_INVOICE' 
    | 'PURCHASE_INVOICE' 
    | 'PAYMENT' 
    | 'CONTRA' 
    | 'EXPENSE' 
    | 'CREDIT_NOTE' 
    | 'DEBIT_NOTE' 
    | 'MANUAL'
    | 'MANUAL_JOURNAL' 
    | 'OPENING_BALANCE'
    | 'REVERSAL';
  sourceId?: string;
  referenceNo?: string;
  narration: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  isPosted: boolean;
  createdBy: string;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// PHASE 5 — BACKUP & RESTORE TYPES
// ----------------------------------------------------------------------------

export type BackupType = 'FULL_DATABASE' | 'COMPANY_SCOPED' | 'SAFETY_PRE_RESTORE';
export type BackupDestination = 'LOCAL_FILE' | 'ENCRYPTED_ARCHIVE' | 'GOOGLE_DRIVE' | 'CLOUD_STORAGE';
export type BackupStatus = 'SUCCESS' | 'FAILED' | 'VERIFIED';
export type RestoreStatus = 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
export type BackupFrequency = 'MANUAL_ONLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface BackupManifest {
  version: string;
  generatedAt: string;
  type: BackupType;
  companyId?: string | null;
  companyName?: string;
  sha256: string;
  recordCounts: Record<string, number>;
  financialTotals: Record<string, number>;
  appVersion: string;
  actor: string;
}

export interface BackupDatabasePayload {
  companies?: Company[];
  activeCompanyId?: string;
  companySettings?: CompanySettings[];
  yards?: Yard[];
  materials?: Material[];
  materialGrades?: MaterialGrade[];
  parties?: Party[];
  vehicles?: Vehicle[];
  vehicleDocuments?: VehicleDocument[];
  employees?: Employee[];
  attendance?: AttendanceEntry[];
  accounts?: CashBankAccount[];
  accountTransactions?: AccountTransaction[];
  expenses?: Expense[];
  weighments?: Weighment[];
  collectionJobs?: CollectionJob[];
  purchases?: PurchaseHeader[];
  inventoryLots?: InventoryLot[];
  stockMovements?: StockMovement[];
  sales?: SalesHeader[];
  invoices?: Invoice[];
  payments?: Payment[];
  stockCounts?: StockCount[];
  auditLogs?: AuditLog[];
  commercialDocuments?: CommercialDocument[];
  journalEntries?: JournalEntry[];
  dailyTasks?: DailyTask[];
  workNotes?: WorkNote[];
  uploadedDocuments?: UploadedDocument[];
  salaryRecords?: MonthlySalaryRecord[];
  employeeAdvances?: EmployeeAdvance[];
  dailyLabourEntries?: DailyLabourEntry[];
  labourPayments?: LabourPayment[];
  contractors?: Contractor[];
  contractorWorkEntries?: ContractorWorkEntry[];
  contractorPayments?: ContractorPayment[];
  dailyCashClosings?: DailyCashClosingRecord[];
}

export interface BackupArchive {
  manifest: BackupManifest;
  data: BackupDatabasePayload;
}

export interface EncryptedBackupArchive {
  isEncrypted: true;
  algorithm: 'AES-256-GCM';
  iv: string;
  salt: string;
  ciphertext: string;
  manifest: BackupManifest;
}

export interface BackupHistoryItem {
  id: string;
  companyId?: string | null;
  backupName: string;
  backupType: BackupType;
  destination: BackupDestination;
  fileSizeBytes: number;
  sha256Checksum: string;
  isEncrypted: boolean;
  encryptionAlgorithm?: string;
  schemaVersion: string;
  totalRecords: number;
  recordCountsJson: Record<string, number>;
  financialTotalsJson: Record<string, number>;
  status: BackupStatus;
  errorMessage?: string;
  createdBy: string;
  createdAt: string;
}

export interface RestoreLog {
  id: string;
  backupId: string;
  preRestoreBackupId: string;
  companyId?: string | null;
  restoredBy: string;
  restorationType: 'FULL_RESTORE' | 'COMPANY_RESTORE';
  recordsRestoredJson: Record<string, number>;
  sha256Verified: boolean;
  status: RestoreStatus;
  notes?: string;
  errorMessage?: string;
  restoredAt: string;
}

export interface BackupScheduleConfig {
  id: string;
  companyId?: string | null;
  frequency: BackupFrequency;
  isEnabled: boolean;
  destination: 'LOCAL_FILE' | 'ENCRYPTED_ARCHIVE' | 'GOOGLE_DRIVE';
  encryptByDefault: boolean;
  retentionCount: number;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  nextRunAt?: string | null;
  googleDriveFolderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestorePreviewResult {
  isValid: boolean;
  schemaVersion: string;
  isCompatible: boolean;
  manifest: BackupManifest;
  recordCounts: Record<string, number>;
  financialTotals: Record<string, number>;
  targetCompany?: string;
  warnings: string[];
  errors: string[];
}

// Daily Task & Work Notes
export type TaskPriority = 'URGENT' | 'HIGH' | 'NORMAL';
export type TaskStatus = 'PENDING' | 'DONE';

export interface DailyTask {
  id: string;
  companyId?: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  assignedTo?: string;
  notes?: string;
  createdAt: string;
}

export interface WorkNote {
  id: string;
  companyId?: string;
  title: string;
  content: string;
  category: 'YARD' | 'CLIENT' | 'ACCOUNTS' | 'DISPATCH' | 'GENERAL';
  date: string;
  updatedAt: string;
}

// Uploaded Historical Documents (Vehicle Docs, Previous Invoices, Previous POs, Quotations)
export type UploadCategory = 'VEHICLE_DOC' | 'PREVIOUS_INVOICE' | 'PREVIOUS_PO' | 'PREVIOUS_QUOTATION' | 'EWAY_BILL';

export interface UploadedDocument {
  id: string;
  companyId?: string;
  category: UploadCategory;
  relatedId?: string;
  referenceNo: string; // e.g. "INV-2023-89", "PO-059-2024", "RC-TN04"
  title: string;
  partyName?: string;
  documentDate: string;
  amount?: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileDataUrl: string; // Base64 data URL
  notes?: string;
  createdAt: string;
}

// -------------------------------------------------------------
// Finance Management Models (Yashoth Enterprises Small-Business ERP)
// -------------------------------------------------------------

export interface MonthlySalaryRecord {
  id: string;
  companyId?: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  salaryMonth: string; // e.g. "2026-10"
  grossSalary: number;
  allowances: number;
  deductions: number;
  advanceRecovery: number;
  netSalaryPayable: number;
  amountPaid: number;
  remainingBalance: number;
  paymentDate?: string;
  paymentMode?: 'CASH' | 'BANK';
  accountId?: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REVERSED';
  notes?: string;
  accrualJournalId?: string;
  paymentJournalId?: string;
  idempotencyKey?: string;
  createdAt: string;
  createdBy: string;
}

export interface EmployeeAdvance {
  id: string;
  companyId?: string;
  employeeId: string;
  employeeName: string;
  advanceDate: string;
  amount: number;
  recoveredAmount: number;
  remainingBalance: number;
  status: 'OPEN' | 'PARTIALLY_RECOVERED' | 'FULLY_RECOVERED' | 'REVERSED';
  paymentMode: 'CASH' | 'BANK';
  accountId: string;
  voucherNo?: string;
  journalId?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface DailyLabourEntry {
  id: string;
  companyId?: string;
  workDate: string;
  workerNameOrGroup: string;
  workerCount: number;
  workingDays: number;
  dailyRate: number;
  overtimeAmount: number;
  additionalCharges: number;
  totalLabourCost: number; // workerCount * workingDays * dailyRate + overtimeAmount + additionalCharges
  advanceAmount: number;
  amountPaid: number;
  remainingBalance: number; // totalLabourCost - advanceAmount - amountPaid
  paymentMode: 'CASH' | 'BANK' | 'UNPAID';
  accountId?: string;
  status?: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REVERSED';
  accrualJournalId?: string;
  idempotencyKey?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface LabourPayment {
  id: string;
  companyId?: string;
  dailyLabourId: string;
  workerNameOrGroup: string;
  paymentDate: string;
  amount: number;
  paymentMode: 'CASH' | 'BANK';
  accountId: string;
  voucherNo: string;
  status?: 'POSTED' | 'REVERSED';
  journalId?: string;
  idempotencyKey?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface Contractor {
  id: string;
  companyId?: string;
  contractorName: string;
  phone: string;
  address: string;
  workDescription: string;
  contractType: 'DAILY_RATE' | 'FIXED_CONTRACT' | 'QUANTITY_BASED';
  isActive: boolean;
  createdAt: string;
}

export interface ContractorWorkEntry {
  id: string;
  companyId?: string;
  contractorId: string;
  contractorName: string;
  workDate: string;
  workDescription: string;
  workerCount: number;
  quantityCompleted: number;
  agreedRate: number;
  totalContractAmount: number;
  advancePaid: number;
  previousPayments: number;
  currentPayment: number;
  remainingBalance: number;
  paymentMode: 'CASH' | 'BANK' | 'UNPAID';
  accountId?: string;
  status?: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REVERSED';
  accrualJournalId?: string;
  idempotencyKey?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface ContractorPayment {
  id: string;
  companyId?: string;
  contractorId: string;
  contractorWorkId: string;
  contractorName: string;
  paymentDate: string;
  amount: number;
  paymentMode: 'CASH' | 'BANK';
  accountId: string;
  voucherNo: string;
  journalId?: string;
  idempotencyKey?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface DailyCashClosingRecord {
  id: string;
  companyId?: string;
  closingDate: string;
  openingCash: number;
  todayCashInflow: number;
  todayCashOutflow: number;
  expectedCashInHand: number;
  physicallyCountedCash: number;
  cashDifference: number; // physicallyCountedCash - expectedCashInHand (+ = excess, - = shortage)
  discrepancyReason?: string;
  journalId?: string;
  idempotencyKey?: string;
  notes?: string;
  closedBy: string;
  closedAt: string;
}

