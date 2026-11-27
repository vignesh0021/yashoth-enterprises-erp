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
  closedPeriodBefore?: string; // ISO YYYY-MM-DD: blocks posting/editing on or before this date
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
  defaultGrade?: string;
  specification?: string;
  baseUnit: string; // e.g. 'KG' | 'TON'
  hsnCode: string; // e.g. '7204'
  defaultPurchaseRate: number;
  defaultSalesRate: number;
  defaultGstRate: number; // e.g. 18.0
  minStockAlert: number;
  defaultYardId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
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

export type PartyType = 'SUPPLIER' | 'CUSTOMER' | 'BOTH' | 'TRANSPORTER';

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
  billNumber?: string;
  weighbridgeName?: string;
  weighbridgeLocation?: string;
  partyId?: string;
  partyName?: string;
  weighbridgeCharge?: number;
  vehicleRegistration?: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number; // calculated: gross - tare
  approvedDeductions: number;
  payableWeight: number; // net - deductions
  unit: string; // 'KG'
  firstWeightTime?: string;
  secondWeightTime?: string;
  weighmentDate?: string;
  operatorName: string;
  slipImageUrl?: string;
  slipAttachmentId?: string;
  slipChecksum?: string;
  ocrExtracted?: boolean;
  ocrVerifiedBy?: string;
  ocrVerifiedAt?: string;
  transactionType?: 'PURCHASE_INWARD' | 'SALES_DISPATCH' | 'TRANSFER_DISPATCH' | 'TRANSFER_RECEIPT';
  linkedTransactionId?: string;
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
  poNumber?: string;
  supplierInvoiceNo?: string;
  supplierInvoiceDate?: string;
  transactionDate: string;
  supplierPartyId: string;
  supplierName?: string;
  sourceType: PurchaseSourceType;
  collectionJobId?: string;
  yardId: string;
  vehicleRegistration?: string;
  driverName?: string;
  driverPhone?: string;
  weighmentId?: string;
  grossWeight?: number;
  tareWeight?: number;
  netWeight?: number;
  acceptedWeight?: number;
  rejectedWeight?: number;
  weighbridgeSlipAttachmentId?: string;
  invoiceAttachmentId?: string;
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  ocrSource?: boolean;
  isUserVerified?: boolean;
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

export type InventoryLotSourceType = 'PURCHASE' | 'OPENING_STOCK' | 'TRANSFER_IN' | 'SALES_RETURN';

export interface InventoryLot {
  id: string;
  companyId?: string;
  lotNumber: string;
  materialId: string;
  gradeId?: string;
  gradeName?: string;
  yardId: string;
  sourceType?: InventoryLotSourceType;
  sourcePurchaseId?: string;
  sourceTransferId?: string;
  supplierPartyId?: string;
  supplierName?: string;
  purchaseOrderNo?: string;
  originalInvoiceNo?: string;
  initialQuantity: number;
  allocatedQuantity?: number;
  dispatchedQuantity?: number;
  returnedQuantity?: number;
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
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN'
  | 'MATERIAL_CONSUMPTION'
  | 'APPROVED_POSITIVE_ADJUSTMENT'
  | 'APPROVED_NEGATIVE_ADJUSTMENT'
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

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface Payment {
  id: string;
  companyId?: string;
  paymentNo: string;
  paymentDate: string;
  direction: PaymentDirection;
  partyId: string;
  beneficiaryPartyId?: string;
  recipientPersonId?: string;
  recipientPartyId?: string;
  authorizationId?: string;
  accountId: string;
  totalAmount: number;
  unallocatedAmount: number;
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  idempotencyKey?: string;
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
  | 'OWNER_LOAN_IN'
  | 'OWNER_REIMBURSEMENT'
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
  expenseId?: string;
  journalEntryId?: string;
  idempotencyKey?: string;
  externalTxRef?: string;
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
  paidByType?: 'COMPANY' | 'OWNER_PERSONAL';
  status?: 'PAID' | 'UNPAID' | 'REVERSED';
  approvalStatus?: 'APPROVED' | 'PENDING' | 'REJECTED';
  enteredBy?: string;
  vehicleId?: string;
  tripId?: string;
  paidTo: string;
  billReference?: string;
  attachmentUrl?: string;
  accountTransactionId?: string;
  journalEntryId?: string;
  idempotencyKey?: string;
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
  ownerPartyId?: string;
  transporterPartyId?: string;
  driverPersonId?: string;
  isOwnerDriven?: boolean;
  driverName?: string;
  driverPhone?: string;
  tareWeight: number;
  isActive: boolean;
}

export type PersonRoleType =
  | 'OWNER'
  | 'DRIVER'
  | 'SUPPLIER'
  | 'TRANSPORTER'
  | 'VEHICLE_OWNER'
  | 'EMPLOYEE'
  | 'AUTHORIZED_AGENT';

export interface Person {
  id: string;
  companyId?: string;
  fullName: string;
  phone?: string;
  isOwner: boolean;
  payrollEligible: boolean;
  linkedEmployeeId?: string;
  linkedPartyId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface PersonRole {
  id: string;
  companyId?: string;
  personId: string;
  roleType: PersonRoleType;
  isActive: boolean;
}

export interface VehicleTrip {
  id: string;
  companyId?: string;
  tripNo: string;
  tripDate: string;
  vehicleId: string;
  driverPersonId?: string;
  isOwnerDriven: boolean;
  transporterPartyId?: string;
  freightPayableAmount: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SETTLED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
}

export interface TripStop {
  id: string;
  tripId: string;
  stopSequence: number;
  supplierPartyId?: string;
  locationName: string;
  weighmentId?: string;
  purchaseHeaderId?: string;
  materialSummary?: string;
}

export interface PaymentAuthorization {
  id: string;
  companyId?: string;
  beneficiaryPartyId: string;
  authorizedRecipientPersonId: string;
  maxAmount?: number;
  validFrom: string;
  validUntil?: string;
  status: 'DRAFT' | 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';
  notes?: string;
}

export type AttachmentParentEntityType =
  | 'EXPENSE'
  | 'PURCHASE'
  | 'INVOICE'
  | 'VEHICLE_DOC'
  | 'TRIP'
  | 'PAYMENT_AUTH';

export type AttachmentUploadStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOAD_FAILED'
  | 'COMMITTED'
  | 'REJECTED'
  | 'EXPIRED';

export interface DocumentAttachment {
  id: string;
  companyId: string;
  parentEntityType: AttachmentParentEntityType;
  parentEntityId: string;
  storageBucket: string;
  storagePath: string;
  thumbnailPath?: string;
  originalFilename: string;
  mimeType: 'image/webp' | 'image/jpeg' | 'application/pdf';
  fileSizeBytes: number;
  width?: number;
  height?: number;
  sha256Checksum: string;
  uploadStatus: AttachmentUploadStatus;
  integrityStatus: 'OK' | 'MISSING_OBJECT';
  replacedAttachmentId?: string;
  uploadedBy: string;
  reservedAt: string;
  committedAt?: string;
  deletedAt?: string;
}

export interface BankImportRecord {
  externalTxRef: string;
  txDate: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  description: string;
  counterpartyName?: string;
  paymentMethod?: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'CHEQUE' | 'BANK';
}

export interface BankImportAdapter {
  providerName: string;
  parseStatement(rawPayload: string): BankImportRecord[];
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

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'WEEK_OFF' | 'OVERTIME' | 'DOUBLE_SHIFT';

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
export type BackupDestination = 'LOCAL_FILE' | 'ENCRYPTED_ARCHIVE' | 'GOOGLE_DRIVE' | 'SUPABASE_CLOUD' | 'CLOUD_STORAGE';
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
  attachmentChecksums?: Record<string, string>;
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
  persons?: Person[];
  personRoles?: PersonRole[];
  vehicleTrips?: VehicleTrip[];
  tripStops?: TripStop[];
  paymentAuthorizations?: PaymentAuthorization[];
  documentAttachments?: DocumentAttachment[];
  materialDispatches?: MaterialDispatch[];
  godownTransfers?: GodownTransfer[];
  managedDocuments?: ManagedDocument[];
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
  compressedSizeBytes?: number;
  compressionFormat?: 'NONE' | 'GZIP';
  sha256Checksum: string;
  isEncrypted: boolean;
  encryptionAlgorithm?: string;
  remoteFileId?: string;
  remoteVerified?: boolean;
  remoteVerifiedAt?: string;
  retryCount?: number;
  scheduleTag?: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'PRE_MIGRATION' | 'PRE_RESTORE';
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
  conflicts?: { table: string; duplicateIds: string[]; existingCount: number; incomingCount: number }[];
  attachmentVerification?: { total: number; verified: number; missingOrMismatched: string[] };
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


// ----------------------------------------------------------------------------
// PHASE 2 — MATERIAL DISPATCH & MULTI-SOURCE ALLOCATION
// ----------------------------------------------------------------------------

export type DispatchApprovalStatus =
  | 'DRAFT'
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'DISPUTED'
  | 'CANCELLED';

export type DispatchOperationalStatus =
  | 'PENDING_DISPATCH'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'DISPUTED'
  | 'CANCELLED';

export interface MaterialDispatchAllocation {
  id: string;
  lotId: string;
  lotNumber: string;
  sourceType: InventoryLotSourceType;
  supplierPartyId?: string;
  supplierName?: string;
  sourcePurchaseId?: string;
  originalInvoiceNo?: string;
  allocatedQuantity: number;
  unitCost: number;
  totalCost: number;
}

export interface MaterialDispatch {
  id: string;
  companyId: string;
  dispatchNo: string;
  customerPartyId?: string;
  destinationName: string;
  destinationYardId?: string;
  materialId: string;
  gradeId?: string;
  gradeName?: string;
  vehicleRegistration: string;
  driverName?: string;
  driverPhone?: string;
  dispatchDateTime: string;
  expectedCompletionDate?: string;
  sourceYardId: string;
  allocations: MaterialDispatchAllocation[];
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  totalAllocatedWeight: number;
  weightDiscrepancy: number; // totalAllocatedWeight - netWeight (0 = reconciled)
  weighmentId?: string;
  weighbridgeBillNo?: string;
  weighbridgeName?: string;
  weighbridgeLocation?: string;
  weighbridgeCharge?: number;
  deliveryChallanNo?: string;
  salesHeaderId?: string;
  invoiceId?: string;
  dispatchEmployee: string;
  approvalStatus: DispatchApprovalStatus;
  status: DispatchOperationalStatus;
  unloadingStatus?: 'PENDING' | 'COMPLETED';
  idempotencyKey?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

// ----------------------------------------------------------------------------
// PHASE 3 — INTERNAL GODOWN TRANSFER MANAGEMENT
// ----------------------------------------------------------------------------

export type GodownTransferStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'DISPUTED'
  | 'CANCELLED';

export interface GodownTransferReceipt {
  id: string;
  receiptNo: string;
  receivedDate: string;
  receivedQuantity: number;
  shortageQuantity: number;
  excessQuantity: number;
  receivingWeighmentId?: string;
  receivingEmployee: string;
  idempotencyKey?: string;
  notes?: string;
  createdAt: string;
}

export interface GodownTransfer {
  id: string;
  companyId: string;
  transferNo: string;
  sourceYardId: string;
  destinationYardId: string;
  materialId: string;
  gradeId?: string;
  gradeName?: string;
  lotAllocations: MaterialDispatchAllocation[];
  quantityDispatched: number;
  quantityReceived: number;
  shortageQuantity: number;
  excessQuantity: number;
  dispatchWeighmentId?: string;
  receivingWeighmentId?: string;
  vehicleRegistration: string;
  driverName?: string;
  driverPhone?: string;
  dispatchEmployee: string;
  receivingEmployee?: string;
  transferDate: string;
  expectedDate?: string;
  receivingDate?: string;
  supportingDocumentIds?: string[];
  status: GodownTransferStatus;
  disputeReason?: string;
  receipts: GodownTransferReceipt[];
  idempotencyKey?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

// ----------------------------------------------------------------------------
// PHASES 7 & 9 — DOCUMENT MANAGEMENT & SUPABASE FREE-TIER QUOTA MONITOR
// ----------------------------------------------------------------------------

export type ManagedDocumentType =
  | 'PURCHASE_INVOICE'
  | 'SALES_INVOICE'
  | 'WEIGHBRIDGE_SLIP'
  | 'DELIVERY_CHALLAN'
  | 'VEHICLE_DOC'
  | 'GST_DOCUMENT'
  | 'SUPPORTING_DOC'
  | 'BACKUP_ARCHIVE';

export interface ManagedDocument {
  id: string;
  companyId: string;
  documentType: ManagedDocumentType;
  documentNumber?: string;
  transactionRef?: string;
  partyName?: string;
  storageProvider: 'GOOGLE_DRIVE' | 'SUPABASE_STORAGE' | 'LOCAL_IDB';
  remoteFileId?: string;
  storagePath?: string;
  originalFileName: string;
  originalMimeType: string;
  originalSizeBytes: number;
  previewDataUrl?: string;
  previewMimeType?: 'image/webp' | 'image/jpeg';
  previewSizeBytes?: number;
  sha256Checksum: string;
  ocrText?: string;
  ocrVerified?: boolean;
  uploadStatus: 'PENDING_UPLOAD' | 'UPLOADED' | 'VERIFIED' | 'FAILED';
  migrationStatus?: 'LEGACY_BASE64' | 'MIGRATED' | 'ROLLED_BACK';
  legacyDocumentId?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface StorageQuotaConfig {
  postgresLimitMb: number; // Default configurable assumption: 500 MB
  fileStorageLimitMb: number; // Default configurable assumption: 1024 MB (1 GB)
  egressLimitMb: number; // Default configurable assumption: 5120 MB (5 GB)
  warningThresholdPct: number; // 70
  criticalThresholdPct: number; // 85
  adminAlertThresholdPct: number; // 95
  restrictUploadsAtAdminAlert: boolean;
}

export type QuotaAlertLevel = 'OK' | 'WARNING' | 'CRITICAL' | 'ADMIN_ALERT';

export interface StorageMonitorSnapshot {
  databaseUsedMb: number;
  databaseLimitMb: number;
  databaseUsagePct: number;
  fileStorageUsedMb: number;
  fileStorageLimitMb: number;
  fileStorageUsagePct: number;
  remainingDatabaseMb: number;
  remainingFileStorageMb: number;
  egressLimitMb: number;
  documentCount: number;
  originalTotalBytes: number;
  compressedPreviewTotalBytes: number;
  compressionSavingsBytes: number;
  largestFiles: { id: string; name: string; type: string; sizeBytes: number; provider: string }[];
  monthlyGrowthBytes: number;
  backupTotalBytes: number;
  failedUploadCount: number;
  pendingUploadCount: number;
  alertLevel: QuotaAlertLevel;
  uploadsRestricted: boolean;
  evaluatedAt: string;
}
