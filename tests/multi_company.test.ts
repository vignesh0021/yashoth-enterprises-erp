import { describe, it, expect } from 'vitest';
import { 
  validateGSTIN, 
  validatePAN, 
  validateCompanyRegistration, 
  filterByCompany, 
  assertCompanyOwnership, 
  generateCompanyDocumentNumber, 
  calculateCompanyFinancialTotals,
  CompanyValidationError,
  CompanyIsolationError
} from '../backend/business-rules/companyEngine.ts';
import { INITIAL_COMPANIES, INITIAL_COMPANY_SETTINGS } from '../src/services/mockData.ts';
import type { Company, Invoice, PurchaseHeader, Expense } from '../src/types/index.ts';

describe('Multi-Company Engine & Tenant Isolation', () => {

  describe('GSTIN and PAN Validation', () => {
    it('validates authentic Indian GSTIN numbers accurately', () => {
      // Valid Yashoth Enterprises GSTIN (Tamil Nadu state code 33)
      expect(validateGSTIN('33AXVPN9382L1ZF')).toBe(true);
      // Valid sample GSTIN
      expect(validateGSTIN('33AABCL1234F1Z1')).toBe(true);

      // Invalid GSTINs
      expect(validateGSTIN('')).toBe(false);
      expect(validateGSTIN('33AXVPN9382L')).toBe(false); // too short
      expect(validateGSTIN('33AXVPN9382L1Z99')).toBe(false); // too long
      expect(validateGSTIN('INVALIDGSTIN1234')).toBe(false);
    });

    it('validates authentic Indian PAN format accurately', () => {
      expect(validatePAN('AXVPN9382L')).toBe(true);
      expect(validatePAN('AABCL1234F')).toBe(true);

      // Invalid PANs
      expect(validatePAN('')).toBe(false);
      expect(validatePAN('AXVPN9382')).toBe(false); // 9 chars
      expect(validatePAN('12345AXVPN')).toBe(false); // numbers first
      expect(validatePAN('AXVPN938211')).toBe(false); // too long
    });
  });

  describe('Company Registration & Master Setup', () => {
    it('successfully registers a sister company with valid details', () => {
      const existing = [...INITIAL_COMPANIES];
      const newFirm = validateCompanyRegistration({
        code: 'YE-STEEL',
        name: 'Yashoth Steel Processing',
        legalName: 'YASHOTH STEEL PROCESSORS LLP',
        gstin: '33AABCS5678K1Z5',
        phone: '+91 94440 88776',
        email: 'steel@yasoth.com',
        addressLine1: 'Plot 12, SIPCOT Industrial Complex',
        city: 'Gummidipoondi',
        stateName: 'Tamil Nadu',
        stateCode: '33',
        pincode: '601201',
        bankName: 'INDIAN OVERSEAS BANK',
        bankAccountNo: '012302000004567',
        bankBranch: 'GUMMIDIPOONDI',
        invoicePrefix: 'YS/'
      }, existing);

      expect(newFirm.id).toBeDefined();
      expect(newFirm.code).toBe('YE-STEEL');
      expect(newFirm.gstin).toBe('33AABCS5678K1Z5');
      expect(newFirm.pan).toBe('AABCS5678K'); // Automatically derived from GSTIN
      expect(newFirm.invoicePrefix).toBe('YS/');
      expect(newFirm.isActive).toBe(true);
      expect(newFirm.currency).toBe('INR');
    });

    it('rejects registration with duplicate company code', () => {
      expect(() => {
        validateCompanyRegistration({
          code: 'YE-MAIN', // Duplicate of Yashoth Enterprises primary code
          name: 'Fake Duplicate Corp',
          gstin: '33AABCS5678K1Z5',
          phone: '+91 94440 00000',
          email: 'dup@test.com',
          addressLine1: 'Some address',
          city: 'Chennai',
          pincode: '600001',
          bankName: 'HDFC',
          bankAccountNo: '12345',
          bankBranch: 'MAIN'
        }, INITIAL_COMPANIES);
      }).toThrow('already in use');
    });

    it('rejects registration with invalid GSTIN', () => {
      expect(() => {
        validateCompanyRegistration({
          code: 'YE-BAD',
          name: 'Bad GSTIN Corp',
          gstin: 'NOT_A_GSTIN',
          phone: '+91 94440 00000',
          email: 'bad@test.com',
          addressLine1: 'Address',
          city: 'Chennai',
          pincode: '600001',
          bankName: 'SBI',
          bankAccountNo: '123',
          bankBranch: 'CH'
        }, INITIAL_COMPANIES);
      }).toThrow('Invalid GSTIN format');
    });

    it('rejects registration with missing mandatory banking information', () => {
      expect(() => {
        validateCompanyRegistration({
          code: 'YE-NOBANK',
          name: 'No Bank Corp',
          gstin: '33AABCL1234F1Z1',
          phone: '+91 94440 00000',
          email: 'nobank@test.com',
          addressLine1: 'Address',
          city: 'Chennai',
          pincode: '600001',
          bankName: '',
          bankAccountNo: '',
          bankBranch: ''
        }, INITIAL_COMPANIES);
      }).toThrow('Bank details');
    });
  });

  describe('Company Document Sequences', () => {
    it('generates distinct company-specific document numbers for each company', () => {
      const companyA = INITIAL_COMPANY_SETTINGS; // Yashoth Enterprises (prefix YE/)
      const companyB: Company = {
        ...INITIAL_COMPANY_SETTINGS,
        id: 'comp-sister-02',
        code: 'YE-LOGISTICS',
        name: 'Yashoth Logistics',
        invoicePrefix: 'YL/',
        purchasePrefix: 'YLP/',
        quotationPrefix: 'YLQ/'
      };

      const invA = generateCompanyDocumentNumber(companyA, 'INVOICE', 1, '26-27');
      const invB = generateCompanyDocumentNumber(companyB, 'INVOICE', 1, '26-27');

      expect(invA).toBe('YE/26-27/0001');
      expect(invB).toBe('YL/26-27/0001');
      expect(invA).not.toBe(invB);

      const poA = generateCompanyDocumentNumber(companyA, 'PURCHASE', 42, '26-27');
      const poB = generateCompanyDocumentNumber(companyB, 'PURCHASE', 42, '26-27');
      expect(poA).toBe('PO/26-27/0042');
      expect(poB).toBe('YLP/26-27/0042');
    });
  });

  describe('Multi-Tenant Data Isolation Enforcement', () => {
    const compAId = 'comp-yasoth-01';
    const compBId = 'comp-yasoth-logistics';

    const testInvoices: Invoice[] = [
      {
        id: 'inv-ye-01',
        companyId: compAId,
        invoiceNo: 'YE/26-27/0001',
        invoiceDate: '2026-04-01',
        customerPartyId: 'pty-cust-01',
        customerName: 'Kaveri Steels',
        billingAddress: 'Chennai',
        shippingAddress: 'Chennai',
        customerStateName: 'Tamil Nadu',
        customerStateCode: '33',
        placeOfSupply: 'Tamil Nadu',
        lines: [],
        subtotalTaxable: 100000,
        cgstRate: 9,
        cgstAmount: 9000,
        sgstRate: 9,
        sgstAmount: 9000,
        igstRate: 0,
        igstAmount: 0,
        roundOff: 0,
        grandTotal: 118000,
        amountInWords: '',
        taxAmountInWords: '',
        paymentStatus: 'UNPAID',
        amountPaid: 0,
        outstandingBalance: 118000,
        immutableSnapshotJson: '{}',
        isCancelled: false,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-01T10:00:00.000Z'
      },
      {
        id: 'inv-logistics-01',
        companyId: compBId,
        invoiceNo: 'YL/26-27/0001',
        invoiceDate: '2026-04-02',
        customerPartyId: 'pty-cust-02',
        customerName: 'Tata Projects Haulage',
        billingAddress: 'Ponneri',
        shippingAddress: 'Ponneri',
        customerStateName: 'Tamil Nadu',
        customerStateCode: '33',
        placeOfSupply: 'Tamil Nadu',
        lines: [],
        subtotalTaxable: 50000,
        cgstRate: 9,
        cgstAmount: 4500,
        sgstRate: 9,
        sgstAmount: 4500,
        igstRate: 0,
        igstAmount: 0,
        roundOff: 0,
        grandTotal: 59000,
        amountInWords: '',
        taxAmountInWords: '',
        paymentStatus: 'UNPAID',
        amountPaid: 0,
        outstandingBalance: 59000,
        immutableSnapshotJson: '{}',
        isCancelled: false,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-02T10:00:00.000Z'
      }
    ];

    it('strictly isolates records so Company A only views Company A data', () => {
      const recordsForA = filterByCompany(testInvoices, compAId);
      expect(recordsForA.length).toBe(1);
      expect(recordsForA[0].id).toBe('inv-ye-01');
      expect(recordsForA[0].invoiceNo).toBe('YE/26-27/0001');

      // Ensure Company B's invoice is absent
      const hasCompanyBInvoice = recordsForA.some((i) => i.id === 'inv-logistics-01');
      expect(hasCompanyBInvoice).toBe(false);
    });

    it('strictly isolates records so Company B only views Company B data', () => {
      const recordsForB = filterByCompany(testInvoices, compBId);
      expect(recordsForB.length).toBe(1);
      expect(recordsForB[0].id).toBe('inv-logistics-01');
      expect(recordsForB[0].invoiceNo).toBe('YL/26-27/0001');

      // Ensure Company A's invoice is absent
      const hasCompanyAInvoice = recordsForB.some((i) => i.id === 'inv-ye-01');
      expect(hasCompanyAInvoice).toBe(false);
    });

    it('safely associates legacy baseline records without explicit companyId with Company A', () => {
      const legacyInvoice: Invoice = {
        ...testInvoices[0],
        id: 'inv-legacy-baseline',
        companyId: undefined // legacy record
      };

      const filteredA = filterByCompany([legacyInvoice], compAId, compAId);
      expect(filteredA.length).toBe(1);
      expect(filteredA[0].id).toBe('inv-legacy-baseline');

      // Company B must NOT see legacy Company A records
      const filteredB = filterByCompany([legacyInvoice], compBId, compAId);
      expect(filteredB.length).toBe(0);
    });

    it('assertCompanyOwnership throws CompanyIsolationError when accessing foreign company entity', () => {
      const recordB = testInvoices[1]; // belongs to compBId

      // Accessing with Company A context must throw
      expect(() => {
        assertCompanyOwnership(recordB, compAId, 'Invoice', compAId);
      }).toThrow('Cross-company isolation violation');

      // Accessing with Company B context succeeds
      expect(() => {
        assertCompanyOwnership(recordB, compBId, 'Invoice', compAId);
      }).not.toThrow();
    });
  });

  describe('Company Financial Totals Isolation', () => {
    const compAId = 'comp-yasoth-01';
    const compBId = 'comp-yasoth-logistics';

    const testInvoices: Invoice[] = [
      {
        id: 'inv-ye-01',
        companyId: compAId,
        invoiceNo: 'YE/26-27/0001',
        invoiceDate: '2026-04-01',
        customerPartyId: 'pty-1',
        customerName: 'A',
        billingAddress: '',
        shippingAddress: '',
        customerStateName: '',
        customerStateCode: '33',
        placeOfSupply: '33',
        lines: [],
        subtotalTaxable: 200000,
        cgstRate: 9,
        cgstAmount: 18000,
        sgstRate: 9,
        sgstAmount: 18000,
        igstRate: 0,
        igstAmount: 0,
        roundOff: 0,
        grandTotal: 236000,
        amountInWords: '',
        taxAmountInWords: '',
        paymentStatus: 'PAID',
        amountPaid: 236000,
        outstandingBalance: 0,
        immutableSnapshotJson: '{}',
        isCancelled: false,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-01T10:00:00.000Z'
      },
      {
        id: 'inv-logistics-01',
        companyId: compBId,
        invoiceNo: 'YL/26-27/0001',
        invoiceDate: '2026-04-02',
        customerPartyId: 'pty-2',
        customerName: 'B',
        billingAddress: '',
        shippingAddress: '',
        customerStateName: '',
        customerStateCode: '33',
        placeOfSupply: '33',
        lines: [],
        subtotalTaxable: 75000,
        cgstRate: 9,
        cgstAmount: 6750,
        sgstRate: 9,
        sgstAmount: 6750,
        igstRate: 0,
        igstAmount: 0,
        roundOff: 0,
        grandTotal: 88500,
        amountInWords: '',
        taxAmountInWords: '',
        paymentStatus: 'PAID',
        amountPaid: 88500,
        outstandingBalance: 0,
        immutableSnapshotJson: '{}',
        isCancelled: false,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-02T10:00:00.000Z'
      }
    ];

    const testPurchases: PurchaseHeader[] = [
      {
        id: 'pur-ye-01',
        companyId: compAId,
        purchaseNo: 'PO/26-27/0001',
        transactionDate: '2026-04-01',
        supplierPartyId: 'sup-1',
        sourceType: 'DIRECT_SUPPLIER',
        yardId: 'yd-01',
        lines: [],
        subtotalAmount: 120000,
        taxAmount: 21600,
        otherCharges: 0,
        totalAmount: 141600,
        amountPaid: 141600,
        outstandingBalance: 0,
        status: 'POSTED',
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-01T10:00:00.000Z'
      }
    ];

    const testExpenses: Expense[] = [
      {
        id: 'exp-ye-01',
        companyId: compAId,
        voucherNo: 'EXP-001',
        expenseDate: '2026-04-01',
        category: 'Yard Operations',
        amount: 8000,
        accountId: 'acc-cash',
        paidTo: 'Labor Team',
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-01T10:00:00.000Z'
      },
      {
        id: 'exp-log-01',
        companyId: compBId,
        voucherNo: 'EXP-002',
        expenseDate: '2026-04-02',
        category: 'Fuel & Toll',
        amount: 15000,
        accountId: 'acc-cash',
        paidTo: 'Diesel Bunk',
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-02T10:00:00.000Z'
      }
    ];

    it('calculates isolated financial totals for Company A without pollution from Company B', () => {
      const totalsA = calculateCompanyFinancialTotals(
        compAId,
        testInvoices,
        testPurchases,
        testExpenses,
        compAId
      );

      // Company A Sales: 200,000 taxable; GST: 36,000; Total Invoices: 236,000
      expect(totalsA.totalSalesTaxable).toBe(200000);
      expect(totalsA.totalGstCollected).toBe(36000);
      expect(totalsA.totalInvoiceAmount).toBe(236000);

      // Company A Purchases: 141,600
      expect(totalsA.totalPurchasesAmount).toBe(141600);

      // Company A Expenses: 8,000 (15,000 fuel from Company B excluded!)
      expect(totalsA.totalExpensesAmount).toBe(8000);

      // Gross Profit A = 200,000 - 141,600 - 8,000 = 50,400
      expect(totalsA.netGrossProfit).toBe(50400);
    });

    it('calculates isolated financial totals for Company B without pollution from Company A', () => {
      const totalsB = calculateCompanyFinancialTotals(
        compBId,
        testInvoices,
        testPurchases,
        testExpenses,
        compAId
      );

      // Company B Sales: 75,000 taxable; GST: 13,500; Total: 88,500
      expect(totalsB.totalSalesTaxable).toBe(75000);
      expect(totalsB.totalGstCollected).toBe(13500);
      expect(totalsB.totalInvoiceAmount).toBe(88500);

      // Company B Purchases: 0 (Company A 141,600 excluded!)
      expect(totalsB.totalPurchasesAmount).toBe(0);

      // Company B Expenses: 15,000 (Company A 8,000 excluded!)
      expect(totalsB.totalExpensesAmount).toBe(15000);

      // Gross Profit B = 75,000 - 0 - 15,000 = 60,000
      expect(totalsB.netGrossProfit).toBe(60000);
    });
  });

});
