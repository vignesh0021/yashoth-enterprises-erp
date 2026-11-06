import { describe, it, expect } from 'vitest';
import {
  buildXlsxArchive,
  buildZipArchive,
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
  escapeXml,
} from '../backend/business-rules/excelEngine.ts';
import { 
  INITIAL_COMPANIES, 
  INITIAL_PARTIES, 
  INITIAL_INVOICES,
  INITIAL_MATERIALS,
  INITIAL_ACCOUNTS,
  INITIAL_JOURNAL_ENTRIES
} from '../src/services/mockData.ts';
import type { 
  BackupDatabasePayload, 
  Company, 
  Party, 
  Invoice, 
  PurchaseHeader, 
  SalesHeader, 
  Expense, 
  Payment,
  JournalEntry 
} from '../src/types/index.ts';

describe('Phase 6: Excel Export Engine & Reconciled Workbooks', () => {
  const companyA: Company = {
    ...INITIAL_COMPANIES[0],
    id: 'a0000000-0000-0000-0000-000000000001',
    code: 'YE-MAIN',
    companyName: 'Yashoth Enterprises',
    gstin: '33AABFY1234F1Z1',
    pan: 'AABFY1234F',
    bankAccountNo: '50200012345678',
    bankName: 'HDFC Bank Ltd',
    bankBranch: 'Coimbatore Main',
    bankBranchIfsc: 'HDFC0001234',
  };

  const companyB: Company = {
    ...INITIAL_COMPANIES[1],
    id: 'b0000000-0000-0000-0000-000000000002',
    code: 'CS-BRANCH',
    companyName: 'Cauvery Scrap Metals',
    gstin: '33AAAC1234C1Z5',
    pan: 'AAAC1234C',
  };

  // Build isolated test state
  const mockState: BackupDatabasePayload = {
    companies: [companyA, companyB],
    activeCompanyId: companyA.id,
    yards: [
      {
        id: 'yd-01',
        companyId: companyA.id,
        code: 'YD-01',
        name: 'Coimbatore Demolition & Processing Yard',
        locationAddress: 'Coimbatore Industrial Estate',
        isActive: true,
      },
    ],
    parties: [
      {
        id: 'pty-cust-a1',
        companyId: companyA.id,
        partyCode: 'CUST-01',
        partyType: 'CUSTOMER',
        legalName: 'Lakshmi Steel Rolling Mills Pvt Ltd',
        tradeName: 'Lakshmi Steel',
        contactPerson: 'S. Sundaram',
        phone: '9842100001',
        email: 'sales@lakshmisteel.com',
        addressLine1: 'Phase 2, SIDCO Industrial Estate',
        city: 'Coimbatore',
        gstin: '33AAACL1234A1Z1',
        stateCode: '33',
        stateName: 'Tamil Nadu',
        paymentTerms: 'NET 30',
        creditLimit: 1000000,
        openingBalance: 25000,
        openingBalanceDate: '2026-04-01',
        isActive: true,
      },
      {
        id: 'pty-supp-a1',
        companyId: companyA.id,
        partyCode: 'SUPP-01',
        partyType: 'SUPPLIER',
        legalName: 'Coimbatore Scrap Traders & Contractors',
        tradeName: 'Coimbatore Scrap Traders',
        contactPerson: 'K. Ranganathan',
        phone: '9842100002',
        email: 'contact@cbescrap.com',
        addressLine1: 'Mettupalayam Road',
        city: 'Coimbatore',
        gstin: '33AABCC5678B1Z2',
        stateCode: '33',
        stateName: 'Tamil Nadu',
        paymentTerms: 'IMMEDIATE',
        creditLimit: 0,
        openingBalance: 40000,
        openingBalanceDate: '2026-04-01',
        isActive: true,
      },
      {
        id: 'pty-cust-b1',
        companyId: companyB.id,
        partyCode: 'CUST-B01',
        partyType: 'CUSTOMER',
        legalName: 'Salem Foundry Alloys Ltd',
        tradeName: 'Salem Alloys',
        contactPerson: 'M. Selvam',
        phone: '9842199999',
        addressLine1: 'Steel Plant Road',
        city: 'Salem',
        gstin: '33AAACS9999D1Z9',
        stateCode: '33',
        stateName: 'Tamil Nadu',
        paymentTerms: 'NET 15',
        creditLimit: 500000,
        openingBalance: 10000,
        openingBalanceDate: '2026-04-01',
        isActive: true,
      },
    ],
    sales: [
      {
        id: 'so-01',
        companyId: companyA.id,
        salesNo: 'SO/2026/001',
        orderDate: '2026-04-10',
        customerPartyId: 'pty-cust-a1',
        yardId: 'yd-01',
        lines: [
          {
            id: 'sl-01',
            materialId: 'mat-01',
            quantity: 12500,
            ratePerUnit: 38.00,
            gstRate: 18,
            taxableAmount: 475000.00,
            gstAmount: 85500.00,
            totalAmount: 560500.00,
            lotAllocations: [],
          },
        ],
        subtotalAmount: 475000.00,
        taxAmount: 85500.00,
        totalAmount: 560500.00,
        allocatedCogs: 318500.00,
        status: 'DISPATCHED',
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-10T10:00:00.000Z',
      },
    ],
    purchases: [
      {
        id: 'po-01',
        companyId: companyA.id,
        purchaseNo: 'PO/2026/001',
        transactionDate: '2026-04-05',
        supplierPartyId: 'pty-supp-a1',
        sourceType: 'DIRECT_SUPPLIER',
        yardId: 'yd-01',
        vehicleRegistration: 'TN 38 AA 1234',
        lines: [
          {
            id: 'pl-01',
            materialId: 'mat-01',
            grossWeight: 16500,
            tareWeight: 6500,
            netWeight: 10000,
            deductions: 200,
            payableWeight: 9800,
            ratePerUnit: 32.50,
            taxableAmount: 318500.00,
            gstRate: 18,
            gstAmount: 57330.00,
            totalAmount: 375830.00,
          },
        ],
        subtotalAmount: 318500.00,
        taxAmount: 57330.00,
        otherCharges: 0,
        totalAmount: 375830.00,
        amountPaid: 200000.00,
        outstandingBalance: 175830.00,
        status: 'POSTED',
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-05T14:00:00.000Z',
      },
    ],
    invoices: [
      {
        id: 'inv-01',
        companyId: companyA.id,
        invoiceNo: 'YE/2026/INV-001',
        invoiceDate: '2026-04-10',
        customerPartyId: 'pty-cust-a1',
        customerName: 'Lakshmi Steel Rolling Mills Pvt Ltd',
        billingAddress: 'Phase 2, SIDCO Industrial Estate, Coimbatore',
        shippingAddress: 'Phase 2, SIDCO Industrial Estate, Coimbatore',
        customerGstin: '33AAACL1234A1Z1',
        customerStateName: 'Tamil Nadu',
        customerStateCode: '33',
        placeOfSupply: 'Tamil Nadu (33)',
        subtotalTaxable: 475000.00,
        cgstRate: 9,
        cgstAmount: 42750.00,
        sgstRate: 9,
        sgstAmount: 42750.00,
        igstRate: 0,
        igstAmount: 0.00,
        roundOff: 0,
        grandTotal: 560500.00,
        amountInWords: 'INR Five Lakh Sixty Thousand Five Hundred Only',
        taxAmountInWords: 'INR Eighty Five Thousand Five Hundred Only',
        paymentStatus: 'UNPAID',
        lines: [
          {
            id: 'il-01',
            serialNo: 1,
            descriptionOfGoods: 'Heavy Melting Steel Scrap (HMS 1&2)',
            hsnSac: '72044900',
            unit: 'KG',
            quantity: 12500,
            rate: 38.00,
            taxableValue: 475000.00,
          },
        ],
        amountPaid: 0,
        outstandingBalance: 560500.00,
        immutableSnapshotJson: '{}',
        isCancelled: false,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-10T10:30:00.000Z',
      },
    ],
    expenses: [
      {
        id: 'exp-01',
        companyId: companyA.id,
        voucherNo: 'EXP/2026/001',
        expenseDate: '2026-04-11',
        category: 'TRANSPORT',
        notes: 'Trailer transport freight for factory demolition scrap dispatch',
        amount: 18500.00,
        accountId: 'acc-bank-01',
        paidTo: 'Vetrivel Transport Carriers',
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-11T12:00:00.000Z',
      },
      {
        id: 'exp-02',
        companyId: companyA.id,
        voucherNo: 'EXP/2026/002',
        expenseDate: '2026-04-12',
        category: 'LABOR',
        notes: 'Gas cutting and sorting labor charges at demolition site',
        amount: 12000.00,
        accountId: 'acc-cash-01',
        paidTo: 'Site Demolition Team',
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-12T16:00:00.000Z',
      },
    ],
    payments: [
      {
        id: 'pay-01',
        companyId: companyA.id,
        paymentNo: 'REC/2026/001',
        paymentDate: '2026-04-15',
        direction: 'INFLOW_RECEIPT',
        partyId: 'pty-cust-a1',
        accountId: 'acc-bank-01',
        totalAmount: 250000.00,
        unallocatedAmount: 0,
        paymentMethod: 'NEFT_RTGS',
        referenceNo: 'HDFCR520260415123',
        allocations: [],
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-15T11:00:00.000Z',
      },
      {
        id: 'pay-02',
        companyId: companyA.id,
        paymentNo: 'PAY/2026/001',
        paymentDate: '2026-04-16',
        direction: 'OUTFLOW_PAYMENT',
        partyId: 'pty-supp-a1',
        accountId: 'acc-bank-01',
        totalAmount: 200000.00,
        unallocatedAmount: 0,
        paymentMethod: 'NEFT_RTGS',
        referenceNo: 'HDFCR520260416999',
        allocations: [],
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-16T15:00:00.000Z',
      },
    ],
    journalEntries: [
      // Inward Purchase Journal
      {
        id: 'je-po-01',
        companyId: companyA.id,
        entryNo: 'JV/2026/001',
        sourceType: 'PURCHASE_INVOICE',
        entryDate: '2026-04-05',
        narration: 'Purchase of Cast Iron Scrap from Coimbatore Scrap Traders',
        sourceId: 'po-01',
        totalDebit: 375830.00,
        totalCredit: 375830.00,
        isPosted: true,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-05T14:00:00.000Z',
        lines: [
          {
            id: 'jl-01',
            accountCode: '5010',
            accountName: 'Scrap Raw Material Purchases',
            debit: 318500.00,
            credit: 0,
            lineNarration: 'Scrap Purchase',
          },
          {
            id: 'jl-02',
            accountCode: '1150',
            accountName: 'Input Tax Credit — CGST',
            debit: 28665.00,
            credit: 0,
            lineNarration: 'Input CGST on Scrap',
          },
          {
            id: 'jl-03',
            accountCode: '1160',
            accountName: 'Input Tax Credit — SGST',
            debit: 28665.00,
            credit: 0,
            lineNarration: 'Input SGST on Scrap',
          },
          {
            id: 'jl-04',
            accountCode: '2010',
            accountName: 'Sundry Creditors (Suppliers A/P)',
            partyId: 'pty-supp-a1',
            partyName: 'Coimbatore Scrap Traders',
            debit: 0,
            credit: 375830.00,
            lineNarration: 'Vendor credit',
          },
        ],
      },
      // Sales Invoice Journal
      {
        id: 'je-inv-01',
        companyId: companyA.id,
        entryNo: 'JV/2026/002',
        sourceType: 'SALES_INVOICE',
        entryDate: '2026-04-10',
        narration: 'Tax Invoice YE/2026/INV-001 to Lakshmi Steel',
        sourceId: 'inv-01',
        totalDebit: 560500.00,
        totalCredit: 560500.00,
        isPosted: true,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-10T10:30:00.000Z',
        lines: [
          {
            id: 'jl-05',
            accountCode: '1100',
            accountName: 'Sundry Debtors (Customers A/R)',
            partyId: 'pty-cust-a1',
            partyName: 'Lakshmi Steel Rolling Mills',
            debit: 560500.00,
            credit: 0,
            lineNarration: 'Customer debit',
          },
          {
            id: 'jl-06',
            accountCode: '4010',
            accountName: 'Scrap Sales Revenue',
            debit: 0,
            credit: 475000.00,
            lineNarration: 'Revenue from Scrap Sale',
          },
          {
            id: 'jl-07',
            accountCode: '2050',
            accountName: 'Output Tax Liability — CGST',
            debit: 0,
            credit: 42750.00,
            lineNarration: 'Output CGST liability',
          },
          {
            id: 'jl-08',
            accountCode: '2060',
            accountName: 'Output Tax Liability — SGST',
            debit: 0,
            credit: 42750.00,
            lineNarration: 'Output SGST liability',
          },
        ],
      },
      // Expense JV
      {
        id: 'je-exp-01',
        companyId: companyA.id,
        entryNo: 'JV/2026/003',
        sourceType: 'EXPENSE',
        entryDate: '2026-04-11',
        narration: 'Freight and Site Labor Expenses',
        sourceId: 'exp-01',
        totalDebit: 30500.00,
        totalCredit: 30500.00,
        isPosted: true,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-11T12:00:00.000Z',
        lines: [
          {
            id: 'jl-09',
            accountCode: '5030',
            accountName: 'Freight, Haulage & Crane Charges',
            debit: 18500.00,
            credit: 0,
            lineNarration: 'Transport charges',
          },
          {
            id: 'jl-10',
            accountCode: '5020',
            accountName: 'Demolition Direct Labor & Cutting',
            debit: 12000.00,
            credit: 0,
            lineNarration: 'Labor cutting',
          },
          {
            id: 'jl-11',
            accountCode: '1020',
            accountName: 'Bank Accounts (Current/OD)',
            debit: 0,
            credit: 18500.00,
            lineNarration: 'Bank payment',
          },
          {
            id: 'jl-12',
            accountCode: '1010',
            accountName: 'Cash on Hand',
            debit: 0,
            credit: 12000.00,
            lineNarration: 'Cash payment',
          },
        ],
      },
      // Receipt JV
      {
        id: 'je-pay-01',
        companyId: companyA.id,
        entryNo: 'JV/2026/004',
        sourceType: 'PAYMENT',
        entryDate: '2026-04-15',
        narration: 'Receipt from Lakshmi Steel',
        sourceId: 'pay-01',
        totalDebit: 250000.00,
        totalCredit: 250000.00,
        isPosted: true,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-15T11:00:00.000Z',
        lines: [
          {
            id: 'jl-13',
            accountCode: '1020',
            accountName: 'Bank Accounts (Current/OD)',
            debit: 250000.00,
            credit: 0,
            lineNarration: 'NEFT credit',
          },
          {
            id: 'jl-14',
            accountCode: '1100',
            accountName: 'Sundry Debtors (Customers A/R)',
            partyId: 'pty-cust-a1',
            partyName: 'Lakshmi Steel Rolling Mills',
            debit: 0,
            credit: 250000.00,
            lineNarration: 'Customer payment credit',
          },
        ],
      },
      // Payment JV
      {
        id: 'je-pay-02',
        companyId: companyA.id,
        entryNo: 'JV/2026/005',
        sourceType: 'PAYMENT',
        entryDate: '2026-04-16',
        narration: 'Payment to Coimbatore Scrap Traders',
        sourceId: 'pay-02',
        totalDebit: 200000.00,
        totalCredit: 200000.00,
        isPosted: true,
        createdBy: 'usr-admin-01',
        createdAt: '2026-04-16T15:00:00.000Z',
        lines: [
          {
            id: 'jl-15',
            accountCode: '2010',
            accountName: 'Sundry Creditors (Suppliers A/P)',
            partyId: 'pty-supp-a1',
            partyName: 'Coimbatore Scrap Traders',
            debit: 200000.00,
            credit: 0,
            lineNarration: 'Vendor debit',
          },
          {
            id: 'jl-16',
            accountCode: '1020',
            accountName: 'Bank Accounts (Current/OD)',
            debit: 0,
            credit: 200000.00,
            lineNarration: 'RTGS debit',
          },
        ],
      },
    ],
  };

  // --------------------------------------------------------------------------
  // TEST 1: OpenXML (.xlsx) Packaging & PKZIP Specification
  // --------------------------------------------------------------------------
  it('should generate valid OpenXML ZIP binary package conforming to PKZIP spec', () => {
    const wb = generateCompanyProfileWorkbook(companyA);
    const bytes = buildXlsxArchive(wb);

    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(500);

    // Verify PKZIP local file header signature: 0x50, 0x4B, 0x03, 0x04
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    // Verify raw zip archive builder
    const zipBytes = buildZipArchive([
      { name: 'test.txt', data: 'Yashoth Enterprises ERP' },
    ]);
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);
  });

  // --------------------------------------------------------------------------
  // TEST 2: XML Character Escaping
  // --------------------------------------------------------------------------
  it('should safely escape XML special characters to maintain OpenXML XML validity', () => {
    const escaped = escapeXml('Yashoth & Sons <Scrap> "Heavy" \'HMS\' & 100%');
    expect(escaped).toBe('Yashoth &amp; Sons &lt;Scrap&gt; &quot;Heavy&quot; &apos;HMS&apos; &amp; 100%');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Company_Profile.xlsx Generation
  // --------------------------------------------------------------------------
  it('should generate Company_Profile.xlsx matching Company Master data', () => {
    const wb = generateCompanyProfileWorkbook(companyA);
    expect(wb.filename).toBe('Company_Profile_YE-MAIN.xlsx');
    expect(wb.sheets).toHaveLength(1);

    const sheet = wb.sheets[0];
    expect(sheet.name).toBe('Company Profile');
    expect(sheet.headers).toEqual(['Property', 'Value']);

    // Check specific rows
    const legalNameRow = sheet.rows.find((r) => r[0] === 'Legal Entity Name');
    expect(legalNameRow).toBeDefined();
    expect(legalNameRow![1]).toBe('YASHOTH ENTERPRISES');

    const gstinRow = sheet.rows.find((r) => r[0] === 'GSTIN');
    expect(gstinRow).toBeDefined();
    expect(gstinRow![1]).toBe('33AABFY1234F1Z1');

    const panRow = sheet.rows.find((r) => r[0] === 'PAN');
    expect(panRow).toBeDefined();
    expect(panRow![1]).toBe('AABFY1234F');

    // Build binary
    const bytes = buildXlsxArchive(wb);
    expect(bytes.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Customers.xlsx Generation & Isolation
  // --------------------------------------------------------------------------
  it('should generate Customers.xlsx containing only Company A customers', () => {
    const wb = generateCustomersWorkbook(mockState.parties || [], companyA.id);
    expect(wb.filename).toBe('Customers.xlsx');
    const sheet = wb.sheets[0];
    expect(sheet.name).toBe('Customers Register');

    // Lakshmi Steel (Company A) must be present
    const custA = sheet.rows.find((r) => r[0] === 'CUST-01');
    expect(custA).toBeDefined();
    expect(custA![1]).toBe('Lakshmi Steel');
    expect(custA![3]).toBe('33AAACL1234A1Z1');

    // Salem Alloys (Company B) must NOT be present in Company A export
    const custB = sheet.rows.find((r) => r[0] === 'CUST-B01');
    expect(custB).toBeUndefined();

    // Coimbatore Scrap Traders (Supplier) must NOT be present in Customers sheet
    const supp = sheet.rows.find((r) => r[0] === 'SUPP-01');
    expect(supp).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // TEST 5: Suppliers.xlsx Generation & Isolation
  // --------------------------------------------------------------------------
  it('should generate Suppliers.xlsx containing only Company A suppliers', () => {
    const wb = generateSuppliersWorkbook(mockState.parties || [], companyA.id);
    expect(wb.filename).toBe('Suppliers.xlsx');
    const sheet = wb.sheets[0];

    // Supplier present
    const supp = sheet.rows.find((r) => r[0] === 'SUPP-01');
    expect(supp).toBeDefined();
    expect(supp![1]).toBe('Coimbatore Scrap Traders');
    expect(supp![3]).toBe('33AABCC5678B1Z2');

    // Customers must NOT be present in Suppliers sheet
    const cust = sheet.rows.find((r) => r[0] === 'CUST-01');
    expect(cust).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // TEST 6: Sales_Register.xlsx Financial Reconciliation
  // --------------------------------------------------------------------------
  it('should generate Sales_Register.xlsx with exact mathematical reconciliation', () => {
    const wb = generateSalesRegisterWorkbook(mockState.sales || [], companyA.id);
    expect(wb.filename).toBe('Sales_Register.xlsx');
    const sheet = wb.sheets[0];

    expect(sheet.rows).toHaveLength(1);
    const row = sheet.rows[0];

    expect(row[0]).toBe('SO/2026/001');
    expect(row[4]).toBe(12500); // Net Weight
    expect(row[5]).toBe(475000.00); // Taxable subtotal
    expect(row[6]).toBe(85500.00); // Tax amount
    expect(row[7]).toBe(560500.00); // Total amount

    // Summary row reconciliation
    expect(sheet.summaryRow).toBeDefined();
    expect(sheet.summaryRow![4]).toBe(12500);
    expect(sheet.summaryRow![5]).toBe(475000.00);
    expect(sheet.summaryRow![6]).toBe(85500.00);
    expect(sheet.summaryRow![7]).toBe(560500.00);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Purchase_Register.xlsx Weighment & Financial Reconciliation
  // --------------------------------------------------------------------------
  it('should generate Purchase_Register.xlsx with Gross/Tare/Net weighment reconciliation', () => {
    const wb = generatePurchaseRegisterWorkbook(mockState.purchases || [], companyA.id);
    expect(wb.filename).toBe('Purchase_Register.xlsx');
    const sheet = wb.sheets[0];

    expect(sheet.rows).toHaveLength(1);
    const row = sheet.rows[0];

    expect(row[0]).toBe('PO/2026/001');
    expect(row[3]).toBe('TN 38 AA 1234');
    expect(row[4]).toBe(16500); // Gross
    expect(row[5]).toBe(6500);  // Tare
    expect(row[6]).toBe(10000); // Net (Gross - Tare)
    expect(row[7]).toBe(9800);  // Payable Weight
    expect(row[8]).toBe(318500.00); // Line Subtotal
    expect(row[9]).toBe(57330.00);  // Tax amount
    expect(row[10]).toBe(375830.00); // Line Total

    // Summary row reconciliation
    expect(sheet.summaryRow).toBeDefined();
    expect(sheet.summaryRow![6]).toBe(10000);
    expect(sheet.summaryRow![7]).toBe(9800);
    expect(sheet.summaryRow![8]).toBe(318500.00);
    expect(sheet.summaryRow![9]).toBe(57330.00);
    expect(sheet.summaryRow![10]).toBe(375830.00);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Invoice_Register.xlsx GST Breakdown Reconciliation
  // --------------------------------------------------------------------------
  it('should generate Invoice_Register.xlsx reconciling Taxable, CGST, SGST, IGST, and Grand Total', () => {
    const wb = generateInvoiceRegisterWorkbook(mockState.invoices || [], companyA.id);
    expect(wb.filename).toBe('Invoice_Register.xlsx');
    const sheet = wb.sheets[0];

    expect(sheet.rows).toHaveLength(1);
    const invRow = sheet.rows[0];

    expect(invRow[0]).toBe('YE/2026/INV-001');
    expect(invRow[6]).toBe(475000.00); // Taxable
    expect(invRow[7]).toBe(42750.00);  // CGST (9%)
    expect(invRow[8]).toBe(42750.00);  // SGST (9%)
    expect(invRow[9]).toBe(0.00);      // IGST
    expect(invRow[11]).toBe(560500.00); // Grand Total

    // Summary row
    expect(sheet.summaryRow![6]).toBe(475000.00);
    expect(sheet.summaryRow![7]).toBe(42750.00);
    expect(sheet.summaryRow![8]).toBe(42750.00);
    expect(sheet.summaryRow![9]).toBe(0.00);
    expect(sheet.summaryRow![11]).toBe(560500.00);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Expenses.xlsx & Payments.xlsx Reconciliation
  // --------------------------------------------------------------------------
  it('should generate Expenses.xlsx and Payments.xlsx with verified voucher totals', () => {
    // 1. Expenses
    const expWb = generateExpensesWorkbook(mockState.expenses || [], companyA.id);
    expect(expWb.filename).toBe('Expenses.xlsx');
    const expSheet = expWb.sheets[0];
    expect(expSheet.rows).toHaveLength(2);
    expect(expSheet.summaryRow![5]).toBe(30500.00); // 18500 + 12000

    // 2. Payments
    const payWb = generatePaymentsWorkbook(mockState.payments || [], companyA.id);
    expect(payWb.filename).toBe('Payments.xlsx');
    const paySheet = payWb.sheets[0];
    expect(paySheet.rows).toHaveLength(2);

    const recRow = paySheet.rows.find((r) => r[0] === 'REC/2026/001');
    expect(recRow).toBeDefined();
    expect(recRow![5]).toBe(250000.00); // Receipt

    const payRow = paySheet.rows.find((r) => r[0] === 'PAY/2026/001');
    expect(payRow).toBeDefined();
    expect(payRow![5]).toBe(200000.00); // Outward payment
  });

  // --------------------------------------------------------------------------
  // TEST 10: Customer_Ledger.xlsx & Supplier_Ledger.xlsx Statement Verification
  // --------------------------------------------------------------------------
  it('should generate Customer_Ledger.xlsx and Supplier_Ledger.xlsx with running balance proof', () => {
    // Customer Ledger
    const custLedgerWb = generateCustomerLedgerWorkbook(
      mockState.parties || [],
      mockState.journalEntries || [],
      companyA.id
    );
    expect(custLedgerWb.filename).toBe('Customer_Ledger.xlsx');
    const custSheet = custLedgerWb.sheets[0];
    expect(custSheet.rows.length).toBeGreaterThan(0);

    // Opening balance row exists
    const obRow = custSheet.rows.find((r) => String(r[4]).includes('OPENING_BALANCE') || String(r[5]).includes('Opening Balance'));
    expect(obRow).toBeDefined();

    // Closing balance matches double-entry: Opening (25000) + Invoice (560500) - Receipt (250000) = 335500
    const finalCustRow = custSheet.rows[custSheet.rows.length - 1];
    expect(finalCustRow[8]).toBe(335500.00);

    // Supplier Ledger
    const suppLedgerWb = generateSupplierLedgerWorkbook(
      mockState.parties || [],
      mockState.journalEntries || [],
      companyA.id
    );
    expect(suppLedgerWb.filename).toBe('Supplier_Ledger.xlsx');
    const suppSheet = suppLedgerWb.sheets[0];
    expect(suppSheet.rows.length).toBeGreaterThan(0);

    // Supplier math: Opening Credit (40000) + Purchase (375830) - Payment (200000) = 215830
    const finalSuppRow = suppSheet.rows[suppSheet.rows.length - 1];
    expect(finalSuppRow[8]).toBe(215830.00);
  });

  // --------------------------------------------------------------------------
  // TEST 11: General_Ledger.xlsx Double-Entry Audit Trail
  // --------------------------------------------------------------------------
  it('should generate General_Ledger.xlsx covering all active chart of accounts', () => {
    const wb = generateGeneralLedgerWorkbook(companyA.id, mockState.journalEntries || []);
    expect(wb.filename).toBe('General_Ledger.xlsx');
    const sheet = wb.sheets[0];
    expect(sheet.rows.length).toBeGreaterThan(5);

    // Check header
    expect(sheet.headers).toEqual([
      'Account Code',
      'Account Name',
      'Category',
      'Date',
      'Entry No',
      'Source Type',
      'Narration',
      'Debit (INR)',
      'Credit (INR)',
      'Running Balance (INR)',
    ]);

    // Ensure sum of all debits equals sum of all credits in posted general ledger
    const totalDebits = sheet.rows.reduce((sum, r) => sum + (typeof r[7] === 'number' ? r[7] : 0), 0);
    const totalCredits = sheet.rows.reduce((sum, r) => sum + (typeof r[8] === 'number' ? r[8] : 0), 0);
    expect(Math.abs(totalDebits - totalCredits)).toBeLessThan(0.01);
  });

  // --------------------------------------------------------------------------
  // TEST 12: Trial_Balance.xlsx Mathematical Proof
  // --------------------------------------------------------------------------
  it('should generate Trial_Balance.xlsx proving Total Debits === Total Credits', () => {
    const wb = generateTrialBalanceWorkbook(companyA.id, mockState.journalEntries || []);
    expect(wb.filename).toBe('Trial_Balance.xlsx');
    const sheet = wb.sheets[0];

    expect(sheet.summaryRow).toBeDefined();
    const sumDebits = sheet.summaryRow![3] as number;
    const sumCredits = sheet.summaryRow![4] as number;

    // Strict Double-Entry Invariant: Debits === Credits
    expect(sumDebits).toBeGreaterThan(0);
    expect(sumCredits).toBeGreaterThan(0);
    expect(sumDebits).toBe(sumCredits);
  });

  // --------------------------------------------------------------------------
  // TEST 13: Profit_Loss.xlsx Statement Reconciles With Revenues & Expenses
  // --------------------------------------------------------------------------
  it('should generate Profit_Loss.xlsx calculating exact Net Profit', () => {
    const wb = generateProfitLossWorkbook(companyA.id, mockState.journalEntries || []);
    expect(wb.filename).toBe('Profit_Loss.xlsx');
    const sheet = wb.sheets[0];

    // Find revenue line: Scrap Sales Revenue (4010) = 475000
    const salesRow = sheet.rows.find((r) => r[1] === '4010');
    expect(salesRow).toBeDefined();
    expect(salesRow![3]).toBe(475000.00);

    // Find COGS: Scrap Purchases (5010) = 318500
    const cogsRow = sheet.rows.find((r) => r[1] === '5010');
    expect(cogsRow).toBeDefined();
    expect(cogsRow![3]).toBe(318500.00);

    // Gross Profit = 475000 - (318500 + 12000 + 18500) = 126000
    const grossProfitRow = sheet.rows.find((r) => r[0] === 'GROSS PROFIT / (LOSS)');
    expect(grossProfitRow).toBeDefined();
    expect(grossProfitRow![3]).toBe(126000.00);

    // Net profit = 156500 - 30500 = 126000
    const netProfitRow = sheet.rows.find((r) => String(r[0]).includes('NET PROFIT / (LOSS)'));
    expect(netProfitRow).toBeDefined();
    expect(netProfitRow![3]).toBe(126000.00);
  });

  // --------------------------------------------------------------------------
  // TEST 14: Balance_Sheet.xlsx Assets Reconcile With Liabilities & Equity
  // --------------------------------------------------------------------------
  it('should generate Balance_Sheet.xlsx verifying Assets === Liabilities + Equity', () => {
    const wb = generateBalanceSheetWorkbook(companyA.id, mockState.journalEntries || []);
    expect(wb.filename).toBe('Balance_Sheet.xlsx');
    const sheet = wb.sheets[0];

    // Check that Balance Sheet has Assets, Liabilities, and Equity sections
    const hasAssets = sheet.rows.some((r) => r[0] === 'TOTAL ASSETS');
    const hasLiabEquity = sheet.rows.some((r) => r[0] === 'TOTAL LIABILITIES & EQUITY');
    expect(hasAssets).toBe(true);
    expect(hasLiabEquity).toBe(true);

    const assetRow = sheet.rows.find((r) => r[0] === 'TOTAL ASSETS');
    const liabEquityRow = sheet.rows.find((r) => r[0] === 'TOTAL LIABILITIES & EQUITY');
    expect(assetRow![3]).toBe(liabEquityRow![3]);
  });

  // --------------------------------------------------------------------------
  // TEST 15: Consolidated_Master.xlsx Multi-Sheet Workbook
  // --------------------------------------------------------------------------
  it('should generate Consolidated_Master.xlsx containing all 11 consolidated sheets', () => {
    const wb = generateConsolidatedMasterWorkbook(mockState, companyA.id);
    expect(wb.filename).toBe('Consolidated_Master_YE-MAIN.xlsx');
    expect(wb.sheets).toHaveLength(11);

    const sheetNames = wb.sheets.map((s) => s.name);
    expect(sheetNames).toContain('Profile');
    expect(sheetNames).toContain('Customers');
    expect(sheetNames).toContain('Suppliers');
    expect(sheetNames).toContain('Sales Orders');
    expect(sheetNames).toContain('Purchases');
    expect(sheetNames).toContain('Invoices');
    expect(sheetNames).toContain('Expenses');
    expect(sheetNames).toContain('Payments');
    expect(sheetNames).toContain('Trial Balance');
    expect(sheetNames).toContain('P&L Statement');
    expect(sheetNames).toContain('Balance Sheet');

    // Build binary and verify PKZIP structure
    const bytes = buildXlsxArchive(wb);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  // --------------------------------------------------------------------------
  // TEST 16: generateAllCompanyWorkbooks Returns All 15 Workbooks
  // --------------------------------------------------------------------------
  it('should generate the full dictionary of 14 independent workbooks plus consolidated master', () => {
    const allWorkbooks = generateAllCompanyWorkbooks(mockState, companyA.id);
    const filenames = Object.keys(allWorkbooks);

    expect(filenames).toContain('Company_Profile.xlsx');
    expect(filenames).toContain('Customers.xlsx');
    expect(filenames).toContain('Suppliers.xlsx');
    expect(filenames).toContain('Sales_Register.xlsx');
    expect(filenames).toContain('Purchase_Register.xlsx');
    expect(filenames).toContain('Invoice_Register.xlsx');
    expect(filenames).toContain('Expenses.xlsx');
    expect(filenames).toContain('Payments.xlsx');
    expect(filenames).toContain('Customer_Ledger.xlsx');
    expect(filenames).toContain('Supplier_Ledger.xlsx');
    expect(filenames).toContain('General_Ledger.xlsx');
    expect(filenames).toContain('Profit_Loss.xlsx');
    expect(filenames).toContain('Balance_Sheet.xlsx');
    expect(filenames).toContain('Trial_Balance.xlsx');
    expect(filenames).toContain('Consolidated_Master.xlsx');

    // Ensure all 15 workbooks build into valid binary XLSX archives without throwing
    for (const [name, wb] of Object.entries(allWorkbooks)) {
      const bytes = buildXlsxArchive(wb);
      expect(bytes.length).toBeGreaterThan(0);
      expect(bytes[0]).toBe(0x50);
      expect(bytes[1]).toBe(0x4b);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 17: Company Isolation Between Company A and Company B
  // --------------------------------------------------------------------------
  it('should enforce strict isolation: Company B export contains zero Company A transactions', () => {
    const compBWorkbooks = generateAllCompanyWorkbooks(mockState, companyB.id);

    // Customers of Company B should only have Salem Alloys, never Lakshmi Steel
    const bCustSheet = compBWorkbooks['Customers.xlsx'].sheets[0];
    const hasLakshmi = bCustSheet.rows.some((r) => r[0] === 'CUST-01');
    const hasSalem = bCustSheet.rows.some((r) => r[0] === 'CUST-B01');
    expect(hasLakshmi).toBe(false);
    expect(hasSalem).toBe(true);

    // Sales of Company B should be empty (Company A had 1 sale)
    const bSalesSheet = compBWorkbooks['Sales_Register.xlsx'].sheets[0];
    expect(bSalesSheet.rows).toHaveLength(0);

    // Purchases of Company B should be empty (Company A had 1 purchase)
    const bPurchSheet = compBWorkbooks['Purchase_Register.xlsx'].sheets[0];
    expect(bPurchSheet.rows).toHaveLength(0);
  });
});
