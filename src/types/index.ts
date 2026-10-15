// Yasoth Enterprises — Production Scrap ERP
// Domain Model & Type Definitions

export type UserRole = 
  | 'owner_admin' 
  | 'manager' 
  | 'purchase_operator' 
  | 'weighment_operator' 
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
}

export interface CompanySettings {
  id: string;
  companyName: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateName: string;
  stateCode: string; // e.g. "33" for Tamil Nadu
  pincode: string;
  gstin: string;
  pan?: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccountNo: string;
  bankBranchIfsc: string;
  invoicePrefix: string;
  defaultBaseUnit: string;
}

export interface Yard {
  id: string;
  code: string;
  name: string;
  locationAddress: string;
  isActive: boolean;
}

export type ScrapCategory = 'Steel' | 'Iron' | 'Aluminium' | 'Copper' | 'Brass' | 'Plastic' | 'Other';

export interface Material {
  id: string;
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
}

export type WeighingMethod = 'MANUAL_SCALE' | 'WEIGHBRIDGE_SLIP' | 'HARDWARE_LINK';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';

export interface Weighment {
  id: string;
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
  | 'OPENING_BALANCE';

export interface CashBankAccount {
  id: string;
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

export interface Expense {
  id: string;
  voucherNo: string;
  expenseDate: string;
  category: string;
  amount: number;
  accountId: string;
  vehicleId?: string;
  paidTo: string;
  billReference?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
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
  employeeCode: string;
  fullName: string;
  designation: string;
  department: string;
  phone: string;
  joiningDate: string;
  dailyWageRate: number;
  monthlySalary: number;
  currentAdvanceBalance: number;
  isActive: boolean;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'OVERTIME';

export interface AttendanceEntry {
  id: string;
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
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldState?: string;
  newState?: string;
  timestamp: string;
}
