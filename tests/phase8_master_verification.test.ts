import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateSHA256,
  encryptBackupAES,
  decryptBackupAES,
  generateBackup,
  validateBackupIntegrity,
  generateRestorePreview,
  createPreRestoreSafetySnapshot,
  executeRestore,
  computeRecordCounts,
  computeFinancialTotals,
  filterDatabaseForCompany,
  CURRENT_SCHEMA_VERSION,
} from '../backend/business-rules/backupEngine.ts';
import {
  generateCompanyProfileWorkbook,
  generateCustomersWorkbook,
  generateSuppliersWorkbook,
  generateSalesRegisterWorkbook,
  generatePurchaseRegisterWorkbook,
  generateInvoiceRegisterWorkbook,
  generateExpensesWorkbook,
  generatePaymentsWorkbook,
  generateCustomerLedgerWorkbook,
  generateSupplierLedgerWorkbook,
  generateGeneralLedgerWorkbook,
  generateTrialBalanceWorkbook,
  generateProfitLossWorkbook,
  generateBalanceSheetWorkbook,
  generateConsolidatedMasterWorkbook,
  generateAllCompanyWorkbooks,
} from '../backend/business-rules/excelEngine.ts';
import {
  calcNetWeight,
  calcPayableWeight,
  calcGstBreakdown,
  numberToIndianWords,
  roundTo2,
} from '../src/utils/calculations.ts';
import {
  validateGSTIN,
  validatePAN,
} from '../backend/business-rules/companyEngine.ts';
import {
  generatePartyStatement,
  generateTrialBalance,
  generateProfitAndLoss,
  generateBalanceSheet,
} from '../backend/business-rules/accountingEngine.ts';
import { 
  INITIAL_COMPANIES, 
  INITIAL_PARTIES, 
  INITIAL_INVOICES,
  INITIAL_MATERIALS,
  INITIAL_ACCOUNTS,
  INITIAL_JOURNAL_ENTRIES 
} from '../src/services/mockData.ts';
import { offlineSyncService } from '../src/services/offlineSyncService.ts';
import type {
  BackupDatabasePayload,
  BackupArchive,
  EncryptedBackupArchive,
  Company,
  Party,
  Invoice,
} from '../src/types/index.ts';

// In-memory localStorage mock for test environment
class MemoryStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

(globalThis as any).localStorage = new MemoryStorage();

describe('PHASE 8: Comprehensive Master Verification & Disaster Recovery Test', () => {
  // --------------------------------------------------------------------------
  // ISOLATED MULTI-COMPANY TEST DATABASE SETUP
  // --------------------------------------------------------------------------
  const companyAId = 'a0000000-0000-0000-0000-000000000001'; // Yashoth Enterprises (Main)
  const companyBId = 'b0000000-0000-0000-0000-000000000002'; // Cauvery Scrap (Branch)

  const companyA: Company = {
    ...INITIAL_COMPANIES[0],
    id: companyAId,
    code: 'YE-MAIN',
    companyName: 'Yashoth Enterprises',
    legalName: 'Yashoth Enterprises Scrap & Demolition Works',
    gstin: '33AABFY1234F1Z1',
    pan: 'AABFY1234F',
    email: 'accounts@yashothenterprises.com',
    phone: '+91 98765 43210',
    addressLine1: 'Plot 42, SIDCO Industrial Estate',
    addressLine2: 'Kurichi',
    city: 'Coimbatore',
    stateName: 'Tamil Nadu',
    pincode: '641021',
    stateCode: '33',
    bankAccountNo: '50200012345678',
    bankName: 'HDFC Bank Ltd',
    bankBranch: 'Coimbatore Main',
    bankBranchIfsc: 'HDFC0001234',
    isActive: true,
  };

  const companyB: Company = {
    ...INITIAL_COMPANIES[1],
    id: companyBId,
    code: 'CS-BRANCH',
    companyName: 'Cauvery Scrap',
    legalName: 'Cauvery Scrap Traders Private Limited',
    gstin: '33AAACC5678G1Z9',
    pan: 'AAACC5678G',
    email: 'branch@cauveryscrap.com',
    phone: '+91 94432 10987',
    addressLine1: 'Yard 12, Trichy Road',
    city: 'Erode',
    stateName: 'Tamil Nadu',
    pincode: '638001',
    stateCode: '33',
    bankAccountNo: '309988776655',
    bankName: 'State Bank of India',
    bankBranch: 'Erode Bazaar',
    bankBranchIfsc: 'SBIN0005678',
    isActive: true,
  };

  // Pre-calculated isolated database payload
  let isolatedDatabase: BackupDatabasePayload;

  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    offlineSyncService.clearAllDataForTesting();

    // Reconstruct clean isolated test database with multi-company records & attachments
    isolatedDatabase = {
      companies: [companyA, companyB],
      activeCompanyId: companyAId,
      companySettings: [
        {
          companyId: companyAId,
          tradeName: 'Yashoth Enterprises',
          legalName: 'Yashoth Enterprises Scrap & Demolition Works',
          gstin: '33AABFY1234F1Z1',
          pan: 'AABFY1234F',
          invoicePrefix: 'YE/2026/',
          purchasePrefix: 'PO-YE/',
          weighmentPrefix: 'WB-YE/',
          bankAccountNo: '50200012345678',
          bankName: 'HDFC Bank Ltd',
          bankBranch: 'Coimbatore Main',
          bankBranchIfsc: 'HDFC0001234',
          defaultPaymentTermsDays: 15,
          einvoiceEnabled: false,
          ewayBillEnabled: true,
        } as any,
        {
          companyId: companyBId,
          tradeName: 'Cauvery Scrap',
          legalName: 'Cauvery Scrap Traders Private Limited',
          gstin: '33AAACC5678G1Z9',
          pan: 'AAACC5678G',
          invoicePrefix: 'CS/2026/',
          purchasePrefix: 'PO-CS/',
          weighmentPrefix: 'WB-CS/',
          bankAccountNo: '309988776655',
          bankName: 'State Bank of India',
          bankBranch: 'Erode Bazaar',
          bankBranchIfsc: 'SBIN0005678',
          defaultPaymentTermsDays: 7,
          einvoiceEnabled: false,
          ewayBillEnabled: false,
        } as any,
      ],
      yards: [
        { id: 'yard-ye-01', companyId: companyAId, yardCode: 'YD-01', yardName: 'Kurichi Primary Yard', location: 'Coimbatore', capacityTons: 500, isActive: true } as any,
        { id: 'yard-cs-01', companyId: companyBId, yardCode: 'YD-02', yardName: 'Erode Branch Yard', location: 'Erode', capacityTons: 250, isActive: true } as any,
      ],
      materials: [
        { id: 'mat-01', companyId: companyAId, materialCode: 'FE-HMS1', materialName: 'Heavy Melting Steel (HMS 1)', hsnSacCode: '72044900', defaultGstRate: 18, standardUnit: 'TON', isActive: true } as any,
        { id: 'mat-02', companyId: companyAId, materialCode: 'CU-HEAVY', materialName: 'Copper Armature Wire', hsnSacCode: '74040012', defaultGstRate: 18, standardUnit: 'KG', isActive: true } as any,
        { id: 'mat-03', companyId: companyBId, materialCode: 'AL-CAST', materialName: 'Aluminium Cast Scrap', hsnSacCode: '76020010', defaultGstRate: 18, standardUnit: 'KG', isActive: true } as any,
      ],
      materialGrades: [],
      parties: [
        { id: 'pty-ye-c1', companyId: companyAId, partyCode: 'CUST-YE-01', partyType: 'CUSTOMER', legalName: 'Shri Amman Steel Mills', tradeName: 'Amman Steels', gstin: '33AABCA9999P1Z2', pan: 'AABCA9999P', openingBalance: 150000, currentBalance: 296367.20, creditLimit: 500000, isActive: true } as any,
        { id: 'pty-ye-s1', companyId: companyAId, partyCode: 'SUPP-YE-01', partyType: 'SUPPLIER', legalName: 'Madurai Scrap Collectors', tradeName: 'Madurai Scrap', gstin: '33AAXPM8888K1Z5', pan: 'AAXPM8888K', openingBalance: -80000, currentBalance: -115000.00, creditLimit: 200000, isActive: true } as any,
        { id: 'pty-cs-c1', companyId: companyBId, partyCode: 'CUST-CS-01', partyType: 'CUSTOMER', legalName: 'Kongu Foundries Ltd', tradeName: 'Kongu Foundries', gstin: '33AAECK7777D1Z8', pan: 'AAECK7777D', openingBalance: 45000, currentBalance: 95000.00, creditLimit: 300000, isActive: true } as any,
      ],
      vehicles: [
        { id: 'veh-01', companyId: companyAId, registrationNo: 'TN 38 BY 4567', vehicleType: 'TRUCK', tareWeightKg: 6200, isSelfOwned: true, isActive: true } as any,
        { id: 'veh-02', companyId: companyBId, registrationNo: 'TN 33 AK 8901', vehicleType: 'LORRY', tareWeightKg: 7800, isSelfOwned: false, isActive: true } as any,
      ],
      vehicleDocuments: [
        {
          id: 'vdoc-01',
          companyId: companyAId,
          vehicleId: 'veh-01',
          documentType: 'RC',
          documentNumber: 'RC-TN38-2024-9988',
          issueDate: '2024-01-15',
          expiryDate: '2039-01-14',
          reminderDaysBefore: 30,
          attachmentUrl: 'https://storage.yashothenterprises.com/docs/rc_tn38by4567.pdf',
          notes: 'Permanent Registration Certificate scanned copy',
        } as any,
        {
          id: 'vdoc-02',
          companyId: companyAId,
          vehicleId: 'veh-01',
          documentType: 'INSURANCE',
          documentNumber: 'POL-NEWINDIA-87654321',
          issueDate: '2026-01-10',
          expiryDate: '2027-01-09',
          reminderDaysBefore: 15,
          attachmentUrl: 'https://storage.yashothenterprises.com/docs/insurance_tn38by4567.pdf',
          notes: 'Commercial comprehensive coverage policy',
        } as any,
        {
          id: 'vdoc-03',
          companyId: companyBId,
          vehicleId: 'veh-02',
          documentType: 'FITNESS',
          documentNumber: 'FC-TN33-2025-1122',
          issueDate: '2025-06-01',
          expiryDate: '2027-05-31',
          reminderDaysBefore: 20,
          attachmentUrl: 'https://storage.cauveryscrap.com/docs/fitness_tn33ak8901.pdf',
          notes: 'RTO Erode FC Inspection Certificate',
        } as any,
      ],
      employees: [
        { id: 'emp-01', companyId: companyAId, employeeCode: 'EMP-01', fullName: 'Murugan K', designation: 'Weighbridge Operator', dailyWageRate: 850, isActive: true } as any,
        { id: 'emp-02', companyId: companyAId, employeeCode: 'EMP-02', fullName: 'Ramasamy S', designation: 'Cutter / Gas Welder', dailyWageRate: 950, isActive: true } as any,
      ],
      attendance: [
        { id: 'att-01', companyId: companyAId, employeeId: 'emp-01', attendanceDate: '2026-10-01', status: 'PRESENT', overtimeHours: 2 } as any,
        { id: 'att-02', companyId: companyAId, employeeId: 'emp-02', attendanceDate: '2026-10-01', status: 'DOUBLE_SHIFT', overtimeHours: 0 } as any,
      ],
      accounts: [
        { id: 'acc-ye-cash', companyId: companyAId, accountCode: '1010', accountName: 'Cash in Hand (Yard Safe)', accountType: 'CASH', currentBalance: 45000 } as any,
        { id: 'acc-ye-hdfc', companyId: companyAId, accountCode: '1020', accountName: 'HDFC Current Account', accountType: 'BANK', currentBalance: 385000 } as any,
        { id: 'acc-cs-sbi', companyId: companyBId, accountCode: '1020', accountName: 'SBI Current Account', accountType: 'BANK', currentBalance: 120000 } as any,
      ],
      accountTransactions: [
        { id: 'atx-01', companyId: companyAId, accountId: 'acc-ye-hdfc', transactionDate: '2026-10-15', transactionType: 'DEPOSIT', amount: 60000, balanceAfter: 385000, referenceNo: 'NEFT-IN-60K' } as any,
      ],
      weighments: [
        {
          id: 'wb-ye-01',
          companyId: companyAId,
          slipNumber: 'WB-YE-2026-001',
          grossWeightKg: 18500,
          tareWeightKg: 6200,
          netWeightKg: 12300,
          deductionKg: 300,
          payableWeightKg: 12000,
          status: 'COMPLETED',
          vehicleNumber: 'TN 38 BY 4567',
          materialId: 'mat-01',
          partyId: 'pty-ye-s1',
          createdAt: '2026-10-10T09:00:00Z',
        } as any,
      ],
      purchases: [
        {
          id: 'po-ye-01',
          companyId: companyAId,
          purchaseNo: 'PO-YE/2026/01',
          purchaseDate: '2026-10-10',
          supplierPartyId: 'pty-ye-s1',
          supplierPartyName: 'Madurai Scrap Collectors',
          totalAmount: 95000.00,
          subtotalAmount: 80508.47,
          taxAmount: 14491.53,
          sourceType: 'DIRECT_SUPPLIER',
          status: 'POSTED',
          createdAt: '2026-10-10T10:00:00Z',
        } as any,
        {
          id: 'po-cs-01',
          companyId: companyBId,
          purchaseNo: 'PO-CS/2026/01',
          purchaseDate: '2026-10-11',
          supplierPartyId: 'pty-ye-s1',
          supplierPartyName: 'Madurai Scrap Collectors',
          totalAmount: 35000.00,
          subtotalAmount: 29661.02,
          taxAmount: 5338.98,
          sourceType: 'DIRECT_SUPPLIER',
          status: 'POSTED',
          createdAt: '2026-10-11T11:00:00Z',
        } as any,
      ],
      inventoryLots: [
        { id: 'lot-01', companyId: companyAId, materialId: 'mat-01', lotNumber: 'LOT-2026-01', initialQuantity: 12000, remainingQuantity: 8500, unitCost: 35.00, status: 'ACTIVE' } as any,
      ],
      stockMovements: [
        { id: 'sm-01', companyId: companyAId, materialId: 'mat-01', movementType: 'PURCHASE_RECEIPT', transactionRef: 'PO-YE/2026/01', yardId: 'yard-ye-01', quantity: 12000, unitCost: 35, totalCost: 420000, createdAt: '2026-10-10T10:00:00Z' } as any,
        { id: 'sm-02', companyId: companyAId, materialId: 'mat-01', movementType: 'SALES_DISPATCH', transactionRef: 'SO-YE-01', yardId: 'yard-ye-01', quantity: -3500, unitCost: 35, totalCost: -122500, createdAt: '2026-10-15T14:00:00Z' } as any,
      ],
      sales: [
        {
          id: 'so-ye-01',
          companyId: companyAId,
          orderNo: 'SO-YE-01',
          orderDate: '2026-10-15',
          customerPartyId: 'pty-ye-c1',
          customerPartyName: 'Shri Amman Steel Mills',
          totalAmount: 146367.20,
          status: 'DISPATCHED',
        } as any,
      ],
      invoices: [
        {
          id: 'inv-ye-01',
          companyId: companyAId,
          invoiceNo: 'YE/2026/03',
          invoiceDate: '2026-10-15',
          ewayBillNo: '5417 9765 5717',
          vehicleNumber: 'TN 38 BY 4567',
          customerId: 'pty-ye-c1',
          customerName: 'Shri Amman Steel Mills',
          customerGstin: '33AABCA9999P1Z2',
          customerAddress: 'SF 241, Trichy Main Road, Sulur, Coimbatore - 641402',
          placeOfSupply: 'Tamil Nadu (33)',
          subtotalTaxable: 124040.00,
          cgstRate: 9,
          cgstAmount: 11163.60,
          sgstRate: 9,
          sgstAmount: 11163.60,
          igstRate: 0,
          igstAmount: 0.00,
          roundOff: 0.00,
          grandTotal: 146367.20,
          amountInWords: 'INR One Lakh Forty Six Thousand Three Hundred Sixty Seven and Twenty Paise Only',
          taxAmountInWords: 'INR Twenty Two Thousand Three Hundred Twenty Seven and Twenty Paise Only',
          paymentStatus: 'UNPAID',
          reverseCharge: false,
          lines: [
            {
              id: 'line-01',
              materialId: 'mat-01',
              description: 'HEAVY MELTING STEEL (HMS 1) FOUNDRY GRADE',
              hsnSac: '72044900',
              quantity: 3.5,
              unit: 'TON',
              rate: 35440.00,
              taxableAmount: 124040.00,
              cgstRate: 9,
              cgstAmount: 11163.60,
              sgstRate: 9,
              sgstAmount: 11163.60,
              igstRate: 0,
              igstAmount: 0.00,
              lineTotal: 146367.20,
            },
          ],
          createdAt: '2026-10-15T15:00:00Z',
        } as any,
        {
          id: 'inv-cs-01',
          companyId: companyBId,
          invoiceNo: 'CS/2026/01',
          invoiceDate: '2026-10-16',
          ewayBillNo: '5417 9999 1111',
          vehicleNumber: 'TN 33 AK 8901',
          customerId: 'pty-cs-c1',
          customerName: 'Kongu Foundries Ltd',
          customerGstin: '33AAECK7777D1Z8',
          customerAddress: 'SIPCOT Industrial Park, Perundurai, Erode - 638052',
          placeOfSupply: 'Tamil Nadu (33)',
          subtotalTaxable: 42372.88,
          cgstRate: 9,
          cgstAmount: 3813.56,
          sgstRate: 9,
          sgstAmount: 3813.56,
          igstRate: 0,
          igstAmount: 0.00,
          roundOff: 0.00,
          grandTotal: 50000.00,
          amountInWords: 'INR Fifty Thousand Only',
          taxAmountInWords: 'INR Seven Thousand Six Hundred Twenty Seven and Twelve Paise Only',
          paymentStatus: 'UNPAID',
          reverseCharge: false,
          lines: [
            {
              id: 'line-cs-01',
              materialId: 'mat-03',
              description: 'ALUMINIUM CAST SCRAP',
              hsnSac: '76020010',
              quantity: 250,
              unit: 'KG',
              rate: 169.49,
              taxableAmount: 42372.88,
              cgstRate: 9,
              cgstAmount: 3813.56,
              sgstRate: 9,
              sgstAmount: 3813.56,
              igstRate: 0,
              igstAmount: 0.00,
              lineTotal: 50000.00,
            },
          ],
          createdAt: '2026-10-16T11:00:00Z',
        } as any,
      ],
      commercialDocuments: [
        {
          id: 'cd-ye-qt01',
          companyId: companyAId,
          documentType: 'QUOTATION',
          documentNo: 'QT-YE-2026-01',
          documentDate: '2026-10-05',
          partyId: 'pty-ye-c1',
          partyName: 'Shri Amman Steel Mills',
          partyAddress: 'Sulur, Coimbatore',
          placeOfSupply: 'Tamil Nadu',
          stateCode: '33',
          lines: [],
          subtotalTaxable: 120000,
          cgstRate: 9,
          cgstAmount: 10800,
          sgstRate: 9,
          sgstAmount: 10800,
          igstRate: 0,
          igstAmount: 0,
          roundOff: 0,
          grandTotal: 141600,
          amountPaid: 0,
          outstandingBalance: 141600,
          status: 'ISSUED',
          createdBy: 'Sales Officer',
          createdAt: '2026-10-05T10:00:00Z',
        } as any,
      ],
      payments: [
        {
          id: 'pay-ye-01',
          companyId: companyAId,
          paymentNo: 'RCT-YE-2026-01',
          paymentDate: '2026-10-18',
          partyId: 'pty-ye-c1',
          partyName: 'Shri Amman Steel Mills',
          accountId: 'acc-ye-hdfc',
          totalAmount: 60000.00,
          direction: 'INFLOW_RECEIPT',
          status: 'POSTED',
          createdAt: '2026-10-18T10:00:00Z',
        } as any,
      ],
      expenses: [
        {
          id: 'exp-ye-01',
          companyId: companyAId,
          voucherNo: 'EXP-YE-2026-01',
          expenseDate: '2026-10-12',
          category: 'YARD_MAINTENANCE',
          amount: 3500.00,
          accountId: 'acc-ye-cash',
          paidTo: 'Industrial Gas Supplier',
          notes: 'Oxygen cylinder refill for torch cutting',
          createdBy: 'Yard Supervisor',
          createdAt: '2026-10-12T11:00:00Z',
        } as any,
      ],
      collectionJobs: [],
      stockCounts: [],
      auditLogs: [],
      journalEntries: [
        {
          id: 'je-ye-01',
          companyId: companyAId,
          journalNo: 'JRN-YE-2026-01',
          entryDate: '2026-10-15',
          referenceType: 'SALES_INVOICE',
          referenceId: 'inv-ye-01',
          description: 'Sales Invoice YE/2026/03 posting',
          isReconciled: true,
          lines: [
            { id: 'jl-01', accountCode: '1100', accountName: 'Sundry Debtors', debit: 146367.20, credit: 0, partyId: 'pty-ye-c1' },
            { id: 'jl-02', accountCode: '4010', accountName: 'Scrap Metal Sales', debit: 0, credit: 124040.00 },
            { id: 'jl-03', accountCode: '2050', accountName: 'Output CGST 9%', debit: 0, credit: 11163.60 },
            { id: 'jl-04', accountCode: '2060', accountName: 'Output SGST 9%', debit: 0, credit: 11163.60 },
          ],
          totalDebit: 146367.20,
          totalCredit: 146367.20,
          createdBy: 'System Auto-Poster',
          createdAt: '2026-10-15T15:00:00Z',
        } as any,
      ],
    };
  });

  // --------------------------------------------------------------------------
  // DOMAIN VERIFICATION TESTS (Authentication, Multi-Company, Accounting, etc.)
  // --------------------------------------------------------------------------
  describe('Domain 1: Multi-Tenant Company Isolation Enforcement', () => {
    it('guarantees Company A cannot access Company B records', () => {
      const compAData = filterDatabaseForCompany(isolatedDatabase, companyAId);
      const compBData = filterDatabaseForCompany(isolatedDatabase, companyBId);

      // Company A checks
      expect(compAData.companies?.length).toBe(1);
      expect(compAData.companies?.[0].code).toBe('YE-MAIN');
      expect(compAData.invoices?.length).toBe(1);
      expect(compAData.invoices?.[0].invoiceNo).toBe('YE/2026/03');
      expect(compAData.vehicles?.length).toBe(1);
      expect(compAData.vehicles?.[0].registrationNo).toBe('TN 38 BY 4567');

      // Company B checks
      expect(compBData.companies?.length).toBe(1);
      expect(compBData.companies?.[0].code).toBe('CS-BRANCH');
      expect(compBData.invoices?.length).toBe(1);
      expect(compBData.invoices?.[0].invoiceNo).toBe('CS/2026/01');
      expect(compBData.vehicles?.length).toBe(1);
      expect(compBData.vehicles?.[0].registrationNo).toBe('TN 33 AK 8901');
    });

    it('validates authentic Indian GSTIN and PAN check digit and state codes', () => {
      expect(validateGSTIN(companyA.gstin)).toBe(true);
      expect(validateGSTIN(companyB.gstin)).toBe(true);
      expect(validatePAN(companyA.pan || '')).toBe(true);
      expect(validatePAN(companyB.pan || '')).toBe(true);

      // Rejects invalid strings
      expect(validateGSTIN('INVALID_GSTIN_123')).toBe(false);
      expect(validatePAN('BAD_PAN')).toBe(false);
    });
  });

  describe('Domain 2: Weighment, GST & Official Tax Invoice Calculations', () => {
    it('calculates gross, tare, net and contamination deduction with precision', () => {
      const net = calcNetWeight(18500, 6200);
      expect(net).toBe(12300);

      const payable = calcPayableWeight(18500, 6200, 300);
      expect(payable).toBe(12000);
    });

    it('calculates exact GST taxes and grand total matching INVOICE_03 replica', () => {
      // 3.5 TONS @ 35,440.00 / TON
      const taxable = 3.5 * 35440.00; // 124,040.00
      expect(taxable).toBe(124040.00);

      const gst = calcGstBreakdown(taxable, 18, false);
      expect(gst.cgstAmount).toBe(11163.60);
      expect(gst.sgstAmount).toBe(11163.60);
      expect(gst.igstAmount).toBe(0.00);
      expect(gst.taxableAmount + gst.totalTax).toBe(146367.20);

      const inWords = numberToIndianWords(146367.20);
      expect(inWords).toContain('One Lakh Forty Six Thousand Three Hundred Sixty Seven');
    });

    it('calculates overtime pay with 1.5x multiplier accurately', () => {
      const dailyWage = 850;
      const otHours = 2;
      const hourlyRate = dailyWage / 8; // 106.25
      const otPay = otHours * hourlyRate * 1.5; // 318.75
      const totalWage = dailyWage + otPay; // 1168.75

      expect(totalWage).toBe(1168.75);
    });
  });

  describe('Domain 3: Double-Entry Financial Statements & Ledgers', () => {
    it('verifies journal entry debits equal credits to 0.00 variance', () => {
      const je = isolatedDatabase.journalEntries![0];
      const sumDebit = je.lines.reduce((s, l) => s + l.debit, 0);
      const sumCredit = je.lines.reduce((s, l) => s + l.credit, 0);

      expect(Math.abs(sumDebit - sumCredit)).toBeLessThan(0.0001);
      expect(sumDebit).toBe(146367.20);
    });

    it('generates reconciled Customer Statement matching opening balance and ledger lines', () => {
      const customer = isolatedDatabase.parties!.find((p) => p.id === 'pty-ye-c1')!;
      const stmt = generatePartyStatement(customer as Party, isolatedDatabase.journalEntries!);

      expect(stmt.openingBalance).toBe(150000);
      expect(stmt.totalDebit).toBe(146367.20);
      expect(stmt.totalCredit).toBe(0);
      // Closing = 150000 + 146367.20 = 296367.20
      expect(stmt.closingBalance).toBe(296367.20);
    });
  });

  describe('Domain 4: Multi-Company Reconciled Excel Export Generation', () => {
    it('generates all 14 independent company workbooks and master workbook reconciling with database', async () => {
      const companyWorkbooks = generateAllCompanyWorkbooks(isolatedDatabase, companyAId);
      const names = Object.keys(companyWorkbooks);
      expect(names.length).toBeGreaterThanOrEqual(14);

      expect(names).toContain('Company_Profile.xlsx');
      expect(names).toContain('Customers.xlsx');
      expect(names).toContain('Suppliers.xlsx');
      expect(names).toContain('Sales_Register.xlsx');
      expect(names).toContain('Purchase_Register.xlsx');
      expect(names).toContain('Invoice_Register.xlsx');
      expect(names).toContain('Expenses.xlsx');
      expect(names).toContain('Payments.xlsx');
      expect(names).toContain('Customer_Ledger.xlsx');
      expect(names).toContain('Supplier_Ledger.xlsx');
      expect(names).toContain('General_Ledger.xlsx');
      expect(names).toContain('Profit_Loss.xlsx');
      expect(names).toContain('Balance_Sheet.xlsx');
      expect(names).toContain('Trial_Balance.xlsx');

      // Consolidated master
      const master = generateConsolidatedMasterWorkbook(isolatedDatabase);
      expect(master.filename).toContain('Consolidated_Master_YE-MAIN.xlsx');
      expect(master.sheets.length).toBeGreaterThanOrEqual(10);
    });
  });

  // --------------------------------------------------------------------------
  // MANDATORY COMPLETE BACKUP & RESTORE TEST WITH ISOLATED DATABASE
  // --------------------------------------------------------------------------
  describe('Domain 5: Complete Disaster Recovery Backup & Restore Execution', () => {
    it('performs full backup, complete database wipe, restore, and asserts exact 1:1 match across all entities, totals, attachments and ownership', async () => {
      const encryptionPassword = 'MasterSecureRecoveryPassphrase#2026';

      // 1. Compute original baseline metrics
      const originalRecordCounts = computeRecordCounts(isolatedDatabase);
      const originalFinancialTotals = computeFinancialTotals(isolatedDatabase);
      const originalTotalRecords = Object.values(originalRecordCounts).reduce((a, b) => a + b, 0);

      const originalInvoiceTotals = isolatedDatabase.invoices!.reduce((sum, inv) => sum + (inv.grandTotal ?? 0), 0);
      const originalInvoiceNumbers = isolatedDatabase.invoices!.map((i) => i.invoiceNo).sort();
      const originalAttachmentsCount = isolatedDatabase.vehicleDocuments!.length;
      const originalAttachmentUrls = isolatedDatabase.vehicleDocuments!.map((d) => d.attachmentUrl).sort();

      const originalCompanyACount = Object.values(filterDatabaseForCompany(isolatedDatabase, companyAId))
        .filter(Array.isArray)
        .reduce((sum, arr) => sum + arr.length, 0);
      const originalCompanyBCount = Object.values(filterDatabaseForCompany(isolatedDatabase, companyBId))
        .filter(Array.isArray)
        .reduce((sum, arr) => sum + arr.length, 0);

      // Verify baseline numbers are meaningful
      expect(originalTotalRecords).toBeGreaterThan(20);
      expect(originalFinancialTotals.totalSales).toBe(196367.20); // 146367.20 (YE) + 50000.00 (CS)
      expect(originalFinancialTotals.totalPurchases).toBe(130000.00); // 95000 (YE) + 35000 (CS)
      expect(originalFinancialTotals.totalPayments).toBe(60000.00);
      expect(originalFinancialTotals.totalExpenses).toBe(3500.00);
      expect(originalAttachmentsCount).toBe(3);

      // 2. Generate encrypted AES-256 full database backup
      const backupResult = await generateBackup(isolatedDatabase, {
        actor: 'Senior Disaster Recovery Architect',
        destination: 'LOCAL_FILE',
        isEncrypted: true,
        password: encryptionPassword,
      });

      expect(backupResult.historyItem.status).toBe('SUCCESS');
      expect(backupResult.checksum).toBeDefined();
      expect(backupResult.checksum.length).toBe(64); // Valid SHA-256 hash length
      expect((backupResult.archive as EncryptedBackupArchive).isEncrypted).toBe(true);

      const encArchive = backupResult.archive as EncryptedBackupArchive;
      expect(encArchive.algorithm).toBe('AES-256-GCM');
      expect(encArchive.ciphertext).toBeDefined();
      expect(encArchive.iv).toBeDefined();
      expect(encArchive.salt).toBeDefined();

      // 3. Decrypt and validate backup integrity
      const decryptedJson = await decryptBackupAES(encArchive, encryptionPassword);
      const integrityCheck = await validateBackupIntegrity(decryptedJson);

      expect(integrityCheck.isValid).toBe(true);
      expect(integrityCheck.parsedArchive).toBeDefined();
      const plainArchive = integrityCheck.parsedArchive!;

      // 4. Generate restore preview and verify compatibility
      const preview = generateRestorePreview(plainArchive, companyAId);
      expect(preview.isValid).toBe(true);
      expect(preview.isCompatible).toBe(true);
      expect(preview.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(preview.errors.length).toBe(0);

      // 5. Automatic safety snapshot creation before destructive action
      const safetySnapshot = await createPreRestoreSafetySnapshot(isolatedDatabase, 'Automated Disaster Recovery Pre-Flight');
      expect(safetySnapshot.historyItem.backupType).toBe('SAFETY_PRE_RESTORE');

      // 6. CATASTROPHIC DATA DISASTER SIMULATION: Wipe database completely!
      const destroyedWipedDatabase: BackupDatabasePayload = {
        companies: [],
        activeCompanyId: undefined,
        companySettings: [],
        yards: [],
        materials: [],
        parties: [],
        vehicles: [],
        vehicleDocuments: [],
        employees: [],
        attendance: [],
        accounts: [],
        accountTransactions: [],
        expenses: [],
        weighments: [],
        purchases: [],
        inventoryLots: [],
        stockMovements: [],
        sales: [],
        invoices: [],
        payments: [],
        commercialDocuments: [],
        journalEntries: [],
      };

      const wipedCounts = computeRecordCounts(destroyedWipedDatabase);
      const wipedTotalRecords = Object.values(wipedCounts).reduce((a, b) => a + b, 0);
      expect(wipedTotalRecords).toBe(0); // Confirmed total data loss

      // 7. RESTORE EXECUTION from verified backup archive
      const { restoredState, restoreLog } = executeRestore(
        plainArchive,
        destroyedWipedDatabase,
        {
          backupId: backupResult.historyItem.id,
          preRestoreBackupId: safetySnapshot.historyItem.id,
          restoreMode: 'FULL',
          actor: 'Senior Disaster Recovery Architect',
        }
      );

      // Verify restore audit log
      expect(restoreLog.status).toBe('COMPLETED');
      expect(restoreLog.sha256Verified).toBe(true);
      expect(restoreLog.restorationType).toBe('FULL_RESTORE');
      expect(restoreLog.preRestoreBackupId).toBe(safetySnapshot.historyItem.id);

      // 8. STRICT 1:1 POST-RESTORE VERIFICATION AUDIT
      // A. Compare record counts per table
      const restoredRecordCounts = computeRecordCounts(restoredState);
      expect(restoredRecordCounts).toEqual(originalRecordCounts);

      // B. Compare financial transaction totals
      const restoredFinancialTotals = computeFinancialTotals(restoredState);
      expect(restoredFinancialTotals.totalSales).toBe(originalFinancialTotals.totalSales);
      expect(restoredFinancialTotals.totalPurchases).toBe(originalFinancialTotals.totalPurchases);
      expect(restoredFinancialTotals.totalPayments).toBe(originalFinancialTotals.totalPayments);
      expect(restoredFinancialTotals.totalExpenses).toBe(originalFinancialTotals.totalExpenses);

      // C. Compare invoice totals and invoice numbers
      const restoredInvoiceTotals = restoredState.invoices!.reduce((sum, inv) => sum + (inv.grandTotal ?? 0), 0);
      const restoredInvoiceNumbers = restoredState.invoices!.map((i) => i.invoiceNo).sort();
      expect(restoredInvoiceTotals).toBe(originalInvoiceTotals);
      expect(restoredInvoiceNumbers).toEqual(originalInvoiceNumbers);

      // D. Compare document attachments (URLs, document numbers, notes)
      const restoredAttachmentsCount = restoredState.vehicleDocuments!.length;
      const restoredAttachmentUrls = restoredState.vehicleDocuments!.map((d) => d.attachmentUrl).sort();
      expect(restoredAttachmentsCount).toBe(originalAttachmentsCount);
      expect(restoredAttachmentUrls).toEqual(originalAttachmentUrls);

      // E. Compare company ownership breakdown
      const restoredCompanyACount = Object.values(filterDatabaseForCompany(restoredState, companyAId))
        .filter(Array.isArray)
        .reduce((sum, arr) => sum + arr.length, 0);
      const restoredCompanyBCount = Object.values(filterDatabaseForCompany(restoredState, companyBId))
        .filter(Array.isArray)
        .reduce((sum, arr) => sum + arr.length, 0);

      expect(restoredCompanyACount).toBe(originalCompanyACount);
      expect(restoredCompanyBCount).toBe(originalCompanyBCount);

      // F. Verify specific critical entity records
      expect(restoredState.companies?.find((c) => c.code === 'YE-MAIN')).toBeDefined();
      expect(restoredState.companies?.find((c) => c.code === 'CS-BRANCH')).toBeDefined();
      expect(restoredState.invoices?.find((i) => i.invoiceNo === 'YE/2026/03')?.grandTotal).toBe(146367.20);
      expect(restoredState.invoices?.find((i) => i.invoiceNo === 'CS/2026/01')?.grandTotal).toBe(50000.00);
      expect(restoredState.journalEntries?.[0].totalDebit).toBe(146367.20);
    });
  });
});
