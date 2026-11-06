import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  validateJournalEntry,
  createSalesInvoiceJournal,
  createPurchaseInvoiceJournal,
  createPaymentJournal,
  createContraJournal,
  createExpenseJournal,
  generateGeneralLedger,
  generateTrialBalance,
  generateProfitAndLoss,
  generateBalanceSheet,
  generatePartyStatement,
  AccountingImbalanceError
} from '../backend/business-rules/accountingEngine.ts';
import {
  calculateDocumentTotals,
  createCommercialDocument,
  convertDocument,
  createCreditNote,
  createDebitNote,
  CommercialDocumentError
} from '../backend/business-rules/commercialDocumentEngine.ts';
import { INITIAL_COMPANIES, INITIAL_PARTIES, INITIAL_INVOICES } from '../src/services/mockData.ts';
import type { Company, Party, Invoice, PurchaseHeader, Payment, Expense, JournalEntry, CommercialDocument } from '../src/types/index.ts';

describe('Phase 4: Accounting & Commercial Documents Engine', () => {
  const companyA: Company = INITIAL_COMPANIES[0]; // Yashoth Enterprises (TN - 33)
  const localParty: Party = INITIAL_PARTIES[0]; // Balaji Steels (TN - 33)
  const interstateParty: Party = INITIAL_PARTIES[1]; // JSW Steel Ltd (KA - 29)

  describe('1. Double-Entry Invariants & Validation', () => {
    it('throws AccountingImbalanceError when debits do not equal credits', () => {
      const unbalancedEntry: JournalEntry = {
        id: 'je-unbalanced-01',
        companyId: companyA.id,
        entryNo: 'JV-001',
        entryDate: '2026-04-10',
        sourceType: 'MANUAL',
        narration: 'Unbalanced test entry',
        lines: [
          { id: 'l1', accountCode: '1010', accountName: 'Cash', debit: 5000, credit: 0 },
          { id: 'l2', accountCode: '4010', accountName: 'Sales', debit: 0, credit: 4900 }
        ],
        totalDebit: 5000,
        totalCredit: 4900,
        isPosted: true,
        createdBy: 'Admin',
        createdAt: '2026-04-10T10:00:00Z'
      };

      expect(() => validateJournalEntry(unbalancedEntry)).toThrow();
    });

    it('passes validation when journal entry is perfectly balanced', () => {
      const balancedEntry: JournalEntry = {
        id: 'je-balanced-01',
        companyId: companyA.id,
        entryNo: 'JV-002',
        entryDate: '2026-04-10',
        sourceType: 'MANUAL',
        narration: 'Balanced test entry',
        lines: [
          { id: 'l1', accountCode: '1010', accountName: 'Cash', debit: 5000, credit: 0 },
          { id: 'l2', accountCode: '4010', accountName: 'Sales', debit: 0, credit: 5000 }
        ],
        totalDebit: 5000,
        totalCredit: 5000,
        isPosted: true,
        createdBy: 'Admin',
        createdAt: '2026-04-10T10:00:00Z'
      };

      expect(() => validateJournalEntry(balancedEntry)).not.toThrow();
    });

    it('rejects journal entries with no lines or zero totals', () => {
      const emptyEntry: JournalEntry = {
        id: 'je-empty',
        companyId: companyA.id,
        entryNo: 'JV-003',
        entryDate: '2026-04-10',
        sourceType: 'MANUAL',
        narration: 'Empty',
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
        isPosted: true,
        createdBy: 'Admin',
        createdAt: '2026-04-10T10:00:00Z'
      };

      expect(() => validateJournalEntry(emptyEntry)).toThrow();
    });
  });

  describe('2. Sales Invoice Double-Entry Journal Posting', () => {
    it('creates perfectly balanced journal for intra-state sales invoice with CGST/SGST and roundoff', () => {
      const sampleInvoice: Invoice = {
        id: 'inv-test-intra',
        companyId: companyA.id,
        invoiceNo: 'YE/26-27/0001',
        invoiceDate: '2026-04-15',
        salesHeaderId: 'so-01',
        customerPartyId: localParty.id,
        customerName: localParty.legalName,
        billingAddress: 'Salem, TN',
        shippingAddress: 'Salem, TN',
        customerStateName: 'Tamil Nadu',
        customerStateCode: '33',
        placeOfSupply: 'Tamil Nadu (33)',
        lines: [
          {
            id: 'inv-l-1',
            serialNo: 1,
            descriptionOfGoods: 'Heavy Melting Steel Scrap (HMS 1&2)',
            hsnSac: '7204',
            quantity: 3.2,
            unit: 'TON',
            rate: 38762.50,
            taxableValue: 124040.00,
          }
        ],
        subtotalTaxable: 124040.00,
        cgstRate: 9,
        cgstAmount: 11163.60,
        sgstRate: 9,
        sgstAmount: 11163.60,
        igstRate: 0,
        igstAmount: 0,
        roundOff: -0.20,
        grandTotal: 146367.00,
        amountInWords: 'One Lakh Forty Six Thousand Three Hundred Sixty Seven Only',
        taxAmountInWords: 'Twenty Two Thousand Three Hundred Twenty Seven and Twenty Paise',
        amountPaid: 0,
        outstandingBalance: 146367.00,
        paymentStatus: 'UNPAID',
        ewayBillNo: 'EB3391029102',
        vehicleRegistration: 'TN-30-AA-1234',
        immutableSnapshotJson: '{}',
        isCancelled: false,
        createdBy: 'Sales Head',
        createdAt: '2026-04-15T10:00:00Z'
      };

      const journal = createSalesInvoiceJournal(sampleInvoice, companyA);

      expect(journal.totalDebit).toBe(journal.totalCredit);
      expect(journal.totalDebit).toBe(146367.20);
      expect(journal.companyId).toBe(companyA.id);

      // Verify lines
      const debtorLine = journal.lines.find((l) => l.accountCode === '1100');
      const salesLine = journal.lines.find((l) => l.accountCode === '4010');
      const cgstLine = journal.lines.find((l) => l.accountCode === '2050');
      const sgstLine = journal.lines.find((l) => l.accountCode === '2060');
      const roundOffLine = journal.lines.find((l) => l.accountCode === '5090');

      expect(debtorLine?.debit).toBe(146367.00);
      expect(salesLine?.credit).toBe(124040.00);
      expect(cgstLine?.credit).toBe(11163.60);
      expect(sgstLine?.credit).toBe(11163.60);
      expect(roundOffLine?.debit).toBe(0.20); // -0.20 round-off becomes debit expense 0.20
    });

    it('creates perfectly balanced journal for inter-state sales invoice with IGST', () => {
      const interstateInvoice: Invoice = {
        id: 'inv-test-inter',
        companyId: companyA.id,
        invoiceNo: 'YE/26-27/0002',
        invoiceDate: '2026-04-16',
        salesHeaderId: 'so-02',
        customerPartyId: interstateParty.id,
        customerName: interstateParty.legalName,
        billingAddress: 'Bellary, KA',
        shippingAddress: 'Bellary, KA',
        customerStateName: 'Karnataka',
        customerStateCode: '29',
        placeOfSupply: 'Karnataka (29)',
        lines: [
          {
            id: 'inv-l-2',
            serialNo: 1,
            descriptionOfGoods: 'Cast Iron Scrap',
            hsnSac: '7204',
            quantity: 5,
            unit: 'TON',
            rate: 35000,
            taxableValue: 175000.00,
          }
        ],
        subtotalTaxable: 175000.00,
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        igstRate: 18,
        igstAmount: 31500.00,
        roundOff: 0,
        grandTotal: 206500.00,
        amountInWords: 'Two Lakh Six Thousand Five Hundred Only',
        taxAmountInWords: 'Thirty One Thousand Five Hundred Only',
        amountPaid: 0,
        outstandingBalance: 206500.00,
        paymentStatus: 'UNPAID',
        immutableSnapshotJson: '{}',
        isCancelled: false,
        createdBy: 'Sales Head',
        createdAt: '2026-04-16T10:00:00Z'
      };

      const journal = createSalesInvoiceJournal(interstateInvoice, companyA);

      expect(journal.totalDebit).toBe(journal.totalCredit);
      expect(journal.totalDebit).toBe(206500.00);

      const igstLine = journal.lines.find((l) => l.accountCode === '2070');
      expect(igstLine?.credit).toBe(31500.00);
      expect(journal.lines.some((l) => l.accountCode === '2050')).toBe(false);
    });
  });

  describe('3. Purchase Invoice Double-Entry Journal Posting', () => {
    it('creates balanced journal for raw material purchase with Input Tax Credit', () => {
      const samplePurchase: PurchaseHeader = {
        id: 'po-test-01',
        companyId: companyA.id,
        purchaseNo: 'PUR/26-27/0001',
        transactionDate: '2026-04-12',
        supplierPartyId: localParty.id,
        sourceType: 'GATE_PURCHASE',
        yardId: 'yard-01',
        lines: [
          {
            id: 'pl-1',
            materialId: 'mat-01',
            grossWeight: 5,
            tareWeight: 0.5,
            netWeight: 4.5,
            deductions: 0,
            payableWeight: 4.5,
            ratePerUnit: 32000,
            gstRate: 18,
            taxableAmount: 144000.00,
            gstAmount: 25920.00,
            totalAmount: 169920.00
          }
        ],
        subtotalAmount: 144000.00,
        taxAmount: 25920.00,
        otherCharges: 0,
        totalAmount: 169920.00,
        amountPaid: 0,
        outstandingBalance: 169920.00,
        status: 'POSTED',
        createdBy: 'Purchase Head',
        createdAt: '2026-04-12T10:00:00Z'
      };

      const journal = createPurchaseInvoiceJournal(samplePurchase, localParty, companyA);

      expect(journal.totalDebit).toBe(journal.totalCredit);
      expect(journal.totalDebit).toBe(169920.00);

      const purchaseExpLine = journal.lines.find((l) => l.accountCode === '5010');
      const inputCgst = journal.lines.find((l) => l.accountCode === '1150');
      const inputSgst = journal.lines.find((l) => l.accountCode === '1160');
      const creditorsLine = journal.lines.find((l) => l.accountCode === '2010');

      expect(purchaseExpLine?.debit).toBe(144000.00);
      expect(inputCgst?.debit).toBe(12960.00);
      expect(inputSgst?.debit).toBe(12960.00);
      expect(creditorsLine?.credit).toBe(169920.00);
    });
  });

  describe('4. Payments, Contras, and Operating Expenses Posting', () => {
    it('creates customer payment journal debiting bank and crediting debtors', () => {
      const samplePayment: Payment = {
        id: 'pay-01',
        paymentNo: 'PAY/26-27/0001',
        paymentDate: '2026-04-20',
        direction: 'INFLOW_RECEIPT',
        partyId: localParty.id,
        accountId: 'acc-hdfc',
        totalAmount: 50000,
        unallocatedAmount: 0,
        paymentMethod: 'NEFT_RTGS',
        referenceNo: 'NEFT920192',
        allocations: [],
        notes: 'Part payment',
        createdBy: 'Accounts',
        createdAt: '2026-04-20T10:00:00Z'
      };

      const journal = createPaymentJournal(samplePayment, localParty, '1020', companyA);
      expect(journal.totalDebit).toBe(journal.totalCredit);
      expect(journal.totalDebit).toBe(50000);

      const bankLine = journal.lines.find((l) => l.accountCode === '1020');
      const debtorLine = journal.lines.find((l) => l.accountCode === '1100');
      expect(bankLine?.debit).toBe(50000);
      expect(debtorLine?.credit).toBe(50000);
    });

    it('creates contra journal debiting destination and crediting source bank/cash', () => {
      const contraJournal = createContraJournal(25000, '1010', '1020', '2026-04-21', 'CHQ-10029', companyA);
      expect(contraJournal.totalDebit).toBe(contraJournal.totalCredit);
      expect(contraJournal.totalDebit).toBe(25000);

      const cashLine = contraJournal.lines.find((l) => l.accountCode === '1010');
      const bankLine = contraJournal.lines.find((l) => l.accountCode === '1020');
      expect(cashLine?.credit).toBe(25000);
      expect(bankLine?.debit).toBe(25000);
    });

    it('creates operating expense journal debiting expense account and crediting bank', () => {
      const sampleExpense: Expense = {
        id: 'exp-01',
        voucherNo: 'EXP/26-27/0001',
        expenseDate: '2026-04-22',
        category: 'YARD_MAINTENANCE',
        paidTo: 'Salem Crane Services',
        amount: 14500,
        accountId: 'acc-hdfc',
        createdBy: 'Accounts',
        createdAt: '2026-04-22T10:00:00Z'
      };

      const journal = createExpenseJournal(sampleExpense, '1020', companyA);
      expect(journal.totalDebit).toBe(journal.totalCredit);
      expect(journal.totalDebit).toBe(14500);

      const expLine = journal.lines.find((l) => l.accountCode === '5030');
      const bankLine = journal.lines.find((l) => l.accountCode === '1020');
      expect(expLine?.debit).toBe(14500);
      expect(bankLine?.credit).toBe(14500);
    });
  });

  describe('5. Commercial Documents Lifecycle (Quotations, Proformas, Credit/Debit Notes)', () => {
    it('creates Quotation with correct intra-state GST breakdown and roundoff', () => {
      const doc = createCommercialDocument({
        company: companyA,
        party: localParty,
        documentType: 'QUOTATION',
        documentDate: '2026-04-10',
        lines: [
          { description: 'Scrap Copper Armature Wire', quantity: 250, unit: 'KG', rate: 720.50, gstRate: 18 }
        ],
        sequenceIndex: 1,
        createdBy: 'Sales Officer'
      });

      expect(doc.documentType).toBe('QUOTATION');
      expect(doc.subtotalTaxable).toBe(180125.00); // 250 * 720.50
      expect(doc.cgstAmount).toBe(16211.25);
      expect(doc.sgstAmount).toBe(16211.25);
      expect(doc.igstAmount).toBe(0);
      expect(doc.grandTotal).toBe(212548.00);
      expect(doc.roundOff).toBe(0.50); // 180125 + 32422.50 = 212547.50 -> 212548 (+0.50)
      expect(doc.status).toBe('ISSUED');
    });

    it('converts Quotation to Proforma Invoice and preserves totals and originalDoc reference', () => {
      const quote = createCommercialDocument({
        company: companyA,
        party: localParty,
        documentType: 'QUOTATION',
        documentDate: '2026-04-10',
        lines: [
          { description: 'Aluminium Section Scrap', quantity: 1000, unit: 'KG', rate: 165, gstRate: 18 }
        ],
        sequenceIndex: 2,
        createdBy: 'Sales Officer'
      });

      const proforma = convertDocument(quote, 'PROFORMA_INVOICE', companyA, 1, '26-27', 'Finance Head');
      expect(proforma.documentType).toBe('PROFORMA_INVOICE');
      expect(proforma.originalDocumentId).toBe(quote.id);
      expect(proforma.documentNo).toContain('PI/26-27/0001');
      expect(proforma.grandTotal).toBe(quote.grandTotal);
    });

    it('creates Credit Note against sales invoice for returned scrap and reverses tax', () => {
      const invoiceRef = {
        id: 'inv-ref-01',
        invoiceNo: 'YE/26-27/0099',
        customerPartyId: localParty.id,
        customerName: localParty.legalName,
        lines: []
      };

      const creditNote = createCreditNote(
        invoiceRef,
        localParty,
        companyA,
        'Tare difference and un-meltable slag deduction',
        [{ description: 'Slag weight deduction', quantity: 200, unit: 'KG', rate: 40, gstRate: 18 }],
        1,
        'QC Inspector'
      );

      expect(creditNote.documentType).toBe('CREDIT_NOTE');
      expect(creditNote.documentNo).toContain('CN/26-27/0001');
      expect(creditNote.subtotalTaxable).toBe(8000);
      expect(creditNote.cgstAmount).toBe(720);
      expect(creditNote.sgstAmount).toBe(720);
      expect(creditNote.grandTotal).toBe(9440);
    });

    it('creates Debit Note against purchase order for rejected materials', () => {
      const purchaseRef = {
        id: 'pur-ref-01',
        purchaseNo: 'PUR/26-27/0088',
        supplierPartyId: localParty.id,
        lines: []
      };

      const debitNote = createDebitNote(
        purchaseRef,
        localParty,
        companyA,
        'Moisture / oil sludge in motor scrap',
        [{ description: 'Sludge deduction', quantity: 150, unit: 'KG', rate: 35, gstRate: 18 }],
        1,
        'Yard Incharge'
      );

      expect(debitNote.documentType).toBe('DEBIT_NOTE');
      expect(debitNote.documentNo).toContain('DN/26-27/0001');
      expect(debitNote.subtotalTaxable).toBe(5250);
      expect(debitNote.grandTotal).toBe(6195);
    });
  });

  describe('6. Official Financial Reports (Double-Entry Ledger, Trial Balance, P&L, Balance Sheet)', () => {
    // Build a realistic set of balanced journals representing a complete trading cycle
    const testCustomer: Party = {
      ...localParty,
      id: 'party-cust-test-01',
      legalName: 'Tejas Steels & Scrap Re-rollers',
      partyType: 'CUSTOMER'
    };

    const tradingJournals: JournalEntry[] = [
      // 1. Opening Balances
      {
        id: 'je-op',
        companyId: companyA.id,
        entryNo: 'JV-OP-01',
        entryDate: '2026-04-01',
        sourceType: 'OPENING_BALANCE',
        narration: 'Opening balances for FY 26-27',
        lines: [
          { id: 'op-1', accountCode: '1010', accountName: 'Cash on Hand', debit: 50000, credit: 0 },
          { id: 'op-2', accountCode: '1020', accountName: 'HDFC Current Account', debit: 200000, credit: 0 },
          { id: 'op-3', accountCode: '1100', accountName: 'Sundry Debtors', debit: 150000, credit: 0, partyId: testCustomer.id },
          { id: 'op-4', accountCode: '1200', accountName: 'Scrap Stock in Yard', debit: 300000, credit: 0 },
          { id: 'op-5', accountCode: '2010', accountName: 'Sundry Creditors', debit: 0, credit: 100000, partyId: localParty.id },
          { id: 'op-6', accountCode: '3010', accountName: "Owner's Equity Capital", debit: 0, credit: 600000 }
        ],
        totalDebit: 700000,
        totalCredit: 700000,
        isPosted: true,
        createdBy: 'Admin',
        createdAt: '2026-04-01T10:00:00Z'
      },
      // 2. Scrap Raw Material Purchase on Credit: ₹1,00,000 + 18% GST = ₹1,18,000
      {
        id: 'je-pur',
        companyId: companyA.id,
        entryNo: 'JV-PUR-01',
        entryDate: '2026-04-05',
        sourceType: 'PURCHASE_INVOICE',
        narration: 'Purchase of HMS 1 scrap',
        lines: [
          { id: 'p-1', accountCode: '5010', accountName: 'Scrap Raw Material Purchases', debit: 100000, credit: 0 },
          { id: 'p-2', accountCode: '1150', accountName: 'Input CGST', debit: 9000, credit: 0 },
          { id: 'p-3', accountCode: '1160', accountName: 'Input SGST', debit: 9000, credit: 0 },
          { id: 'p-4', accountCode: '2010', accountName: 'Sundry Creditors', debit: 0, credit: 118000, partyId: localParty.id }
        ],
        totalDebit: 118000,
        totalCredit: 118000,
        isPosted: true,
        createdBy: 'Purchase Head',
        createdAt: '2026-04-05T10:00:00Z'
      },
      // 3. Scrap Sales Invoice on Credit: ₹2,00,000 + 18% GST = ₹2,36,000
      {
        id: 'je-sale',
        companyId: companyA.id,
        entryNo: 'JV-SALE-01',
        entryDate: '2026-04-10',
        sourceType: 'SALES_INVOICE',
        narration: 'Sale to Tejas Steels',
        lines: [
          { id: 's-1', accountCode: '1100', accountName: 'Sundry Debtors', debit: 236000, credit: 0, partyId: testCustomer.id },
          { id: 's-2', accountCode: '4010', accountName: 'Scrap Sales Revenue', debit: 0, credit: 200000 },
          { id: 's-3', accountCode: '2050', accountName: 'Output CGST', debit: 0, credit: 18000 },
          { id: 's-4', accountCode: '2060', accountName: 'Output SGST', debit: 0, credit: 18000 }
        ],
        totalDebit: 236000,
        totalCredit: 236000,
        isPosted: true,
        createdBy: 'Sales Head',
        createdAt: '2026-04-10T10:00:00Z'
      },
      // 4. Operating Expense: Electricity & Yard Rent = ₹20,000 paid via Bank (5040 OPEX)
      {
        id: 'je-exp',
        companyId: companyA.id,
        entryNo: 'JV-EXP-01',
        entryDate: '2026-04-15',
        sourceType: 'EXPENSE',
        narration: 'Yard Rent & Utilities',
        lines: [
          { id: 'e-1', accountCode: '5040', accountName: 'Yard Utilities & Maintenance', debit: 20000, credit: 0 },
          { id: 'e-2', accountCode: '1020', accountName: 'HDFC Current Account', debit: 0, credit: 20000 }
        ],
        totalDebit: 20000,
        totalCredit: 20000,
        isPosted: true,
        createdBy: 'Accounts Head',
        createdAt: '2026-04-15T10:00:00Z'
      }
    ];

    it('generates General Ledger with running debit/credit balances', () => {
      const glBank = generateGeneralLedger(tradingJournals, '1020');
      expect(glBank.accountCode).toBe('1020');
      expect(glBank.totalDebit).toBe(200000);
      expect(glBank.totalCredit).toBe(20000);
      expect(glBank.closingBalance).toBe(180000); // 2,00,000 Dr - 20,000 Cr = 1,80,000 Dr
    });

    it('generates a balanced Trial Balance where Total Debits exactly equal Total Credits', () => {
      const tb = generateTrialBalance(tradingJournals, '2026-04-30');
      expect(tb.isBalanced).toBe(true);
      expect(tb.difference).toBe(0);
      expect(tb.totalDebits).toBe(tb.totalCredits);

      // Verify specific account balances in TB
      const salesAccount = tb.rows.find((r) => r.accountCode === '4010');
      const purchaseAccount = tb.rows.find((r) => r.accountCode === '5010');
      expect(salesAccount?.creditBalance).toBe(200000);
      expect(purchaseAccount?.debitBalance).toBe(100000);
    });

    it('computes Profit and Loss statement accurately (Gross Profit & Net Profit)', () => {
      const pnl = generateProfitAndLoss(tradingJournals, '2026-04-01', '2026-04-30');
      expect(pnl.totalRevenue).toBe(200000);
      expect(pnl.totalCogs).toBe(100000);
      expect(pnl.grossProfit).toBe(100000); // 2,00,000 - 1,00,000 = 1,00,000
      expect(pnl.totalOperatingExpenses).toBe(20000);
      expect(pnl.netProfit).toBe(80000); // 1,00,000 - 20,000 = 80,000
    });

    it('reconciles Balance Sheet: Total Assets === Total Liabilities + Equity + Net Profit', () => {
      const pnl = generateProfitAndLoss(tradingJournals, '2026-04-01', '2026-04-30');
      const bs = generateBalanceSheet(tradingJournals, '2026-04-30', pnl.netProfit);

      expect(bs.isBalanced).toBe(true);
      expect(bs.difference).toBe(0);
      expect(bs.totalAssets).toBe(bs.totalLiabilitiesAndEquity);

      // Total Assets breakdown:
      // Cash: 50,000
      // Bank: 180,000 (200k - 20k)
      // Debtors: 386,000 (150k + 236k)
      // Yard Stock: 300,000
      // Input CGST: 9,000
      // Input SGST: 9,000
      // Total Assets = 50k + 180k + 386k + 300k + 9k + 9k = 934,000
      expect(bs.totalAssets).toBe(934000);

      // Total Liabilities breakdown:
      // Creditors: 218,000 (100k + 118k)
      // Output CGST: 18,000
      // Output SGST: 18,000
      // Total Liabilities = 254,000

      // Equity:
      // Capital: 600,000
      // Current Net Profit: 80,000
      // Total Equity: 680,000

      // Total Liabilities + Equity = 254,000 + 680,000 = 934,000. Perfect match!
      expect(bs.totalLiabilitiesAndEquity).toBe(934000);
    });

    it('generates Party Statement with running balances and opening balance for Customer', () => {
      const statement = generatePartyStatement(testCustomer, tradingJournals, '2026-04-01', '2026-04-30');
      expect(statement.partyId).toBe(testCustomer.id);
      expect(statement.openingBalance).toBe(150000); // from opening balance journal
      expect(statement.totalDebit).toBe(236000); // from sales invoice
      expect(statement.totalCredit).toBe(0);
      expect(statement.closingBalance).toBe(386000); // 150000 + 236000 = 386000
    });

    it('generates Party Statement with running balances and opening balance for Supplier', () => {
      const statement = generatePartyStatement(localParty, tradingJournals, '2026-04-01', '2026-04-30');
      expect(statement.partyId).toBe(localParty.id);
      expect(statement.openingBalance).toBe(100000); // from opening balance credit
      expect(statement.totalDebit).toBe(0);
      expect(statement.totalCredit).toBe(118000); // from purchase
      expect(statement.closingBalance).toBe(218000); // 100000 + 118000 = 218000
    });
  });
});
