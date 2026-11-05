// Yasoth Enterprises Scrap ERP — Defect Audit Regression Test Suite
import { describe, it, expect } from 'vitest';
import { 
  calculateReconciledAccountBalance, 
  executeContraTransfer 
} from '../backend/business-rules/financeEngine.ts';
import { postPurchaseTransaction } from '../backend/business-rules/purchaseEngine.ts';
import { dispatchSalesTransaction } from '../backend/business-rules/salesEngine.ts';
import { reverseStockMovement } from '../backend/business-rules/inventoryEngine.ts';
import { 
  CashBankAccount, 
  AccountTransaction, 
  InventoryLot, 
  StockMovement, 
  PurchaseHeader, 
  SalesHeader, 
  Party, 
  CompanySettings, 
  VehicleDocument 
} from '../src/types/index.ts';
import { roundTo2, roundTo3 } from '../src/utils/calculations.ts';

describe('Defect Audit Regression Tests', () => {
  // 1. Account Funds Reconciliation (Defect 2)
  describe('Account Funds Reconciliation & Double-Counting Guard', () => {
    const yardCashAccount: CashBankAccount = {
      id: 'acc-cash-yard',
      accountCode: 'CASH-YARD',
      accountName: 'Yard Petty Cash Box',
      accountType: 'CASH',
      openingBalance: 50000,
      openingBalanceDate: '2026-10-01',
      isActive: true,
    };

    it('should NOT double-count opening balance when OPENING_BALANCE transaction is in ledger', () => {
      const openingTx: AccountTransaction = {
        id: 'atx-init-01',
        accountId: 'acc-cash-yard',
        transactionDate: '2026-10-01',
        transactionType: 'OPENING_BALANCE',
        direction: 'DEBIT',
        amount: 50000,
        description: 'Yard cash box opening float',
        createdBy: 'admin',
        createdAt: '2026-10-01T08:00:00Z',
      };

      const balance = calculateReconciledAccountBalance(yardCashAccount, [openingTx]);
      // Must be 50,000, NOT 100,000
      expect(balance).toBe(50000);
    });

    it('should use account.openingBalance as base when no OPENING_BALANCE transaction exists', () => {
      const expenseTx: AccountTransaction = {
        id: 'atx-exp-01',
        accountId: 'acc-cash-yard',
        transactionDate: '2026-10-05',
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: 5000,
        description: 'Yard consumable purchases',
        createdBy: 'admin',
        createdAt: '2026-10-05T08:00:00Z',
      };

      const balance = calculateReconciledAccountBalance(yardCashAccount, [expenseTx]);
      // 50,000 - 5,000 = 45,000
      expect(balance).toBe(45000);
    });

    it('should correctly sum initial accounts to ₹4,00,000 genuine funds instead of ₹8,00,000', () => {
      const bankAccount: CashBankAccount = {
        id: 'acc-bank-cub',
        accountCode: 'BANK-CUB',
        accountName: 'City Union Bank',
        accountType: 'BANK',
        openingBalance: 350000,
        openingBalanceDate: '2026-10-01',
        isActive: true,
      };

      const txs: AccountTransaction[] = [
        {
          id: 'atx-init-01',
          accountId: 'acc-cash-yard',
          transactionDate: '2026-10-01',
          transactionType: 'OPENING_BALANCE',
          direction: 'DEBIT',
          amount: 50000,
          description: 'Yard cash box opening float',
          createdBy: 'admin',
          createdAt: '2026-10-01T08:00:00Z',
        },
        {
          id: 'atx-init-02',
          accountId: 'acc-bank-cub',
          transactionDate: '2026-10-01',
          transactionType: 'OPENING_BALANCE',
          direction: 'DEBIT',
          amount: 350000,
          description: 'City Union Bank account opening balance',
          createdBy: 'admin',
          createdAt: '2026-10-01T08:00:00Z',
        },
      ];

      const totalFunds = [yardCashAccount, bankAccount].reduce(
        (sum, acc) => sum + calculateReconciledAccountBalance(acc, txs),
        0
      );

      expect(totalFunds).toBe(400000); // Exactly ₹4,00,000
    });
  });

  // 2. Inventory Valuation & Register Reconciliation (Defects 1 & 10)
  describe('Stock Valuation & Lot Reconciled Register', () => {
    it('should reconcile multi-lot stock valuation strictly from unexhausted lots', () => {
      // MS Boring has 2 lots:
      // Lot 1: 15,000 KG @ ₹27.50 = ₹4,12,500
      // Lot 2: 5,850 KG @ ₹28.00 = ₹1,63,800
      // Total Qty = 20,850 KG, Valuation = ₹5,76,300
      const lots: InventoryLot[] = [
        {
          id: 'lot-1',
          lotNumber: 'LOT-OPEN-BORING-01',
          materialId: 'mat-ms-boring',
          yardId: 'yd-01',
          initialQuantity: 15000,
          remainingQuantity: 15000,
          unitCost: 27.50,
          receivedAt: '2026-10-01T08:00:00Z',
          isExhausted: false,
        },
        {
          id: 'lot-2',
          lotNumber: 'LOT-PUR-26-0001-1',
          materialId: 'mat-ms-boring',
          yardId: 'yd-01',
          initialQuantity: 5850,
          remainingQuantity: 5850,
          unitCost: 28.00,
          receivedAt: '2026-10-15T08:00:00Z',
          isExhausted: false,
        },
      ];

      const totalValuation = lots
        .filter((l) => !l.isExhausted)
        .reduce((sum, l) => sum + l.remainingQuantity * l.unitCost, 0);

      expect(roundTo2(totalValuation)).toBe(576300);

      const totalQty = lots.reduce((sum, l) => sum + l.remainingQuantity, 0);
      expect(totalQty).toBe(20850);

      const weightedAvgCost = roundTo2(totalValuation / totalQty);
      expect(weightedAvgCost).toBe(27.64);
    });
  });

  // 3. Vehicle Expiry Alert Filter (Defect 4)
  describe('Vehicle Compliance & Document Expiry Alerts', () => {
    it('should retain both expired and upcoming expiring documents in alerts', () => {
      const todayStr = '2026-10-16';

      const docs: VehicleDocument[] = [
        {
          id: 'doc-expired',
          vehicleId: 'veh-01',
          documentType: 'INSURANCE',
          documentNumber: 'POL-EXP-01',
          issueDate: '2025-09-01',
          expiryDate: '2026-10-10', // Expired 6 days ago!
          reminderDaysBefore: 30,
        },
        {
          id: 'doc-expiring-soon',
          vehicleId: 'veh-02',
          documentType: 'INSURANCE',
          documentNumber: 'POL-NEWINDIA-2026-11',
          issueDate: '2025-10-25',
          expiryDate: '2026-10-24', // Due in 8 days
          reminderDaysBefore: 15,
        },
        {
          id: 'doc-far-future',
          vehicleId: 'veh-01',
          documentType: 'FITNESS',
          documentNumber: 'FIT-TN18-2026-44',
          issueDate: '2025-12-01',
          expiryDate: '2026-12-31', // Due in 76 days
          reminderDaysBefore: 20,
        },
      ];

      const alertFilter = (d: VehicleDocument) => {
        const diffDays = Math.ceil(
          (new Date(d.expiryDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24)
        );
        return diffDays <= d.reminderDaysBefore;
      };

      const alerts = docs.filter(alertFilter);

      // Must include expired doc AND expiring soon doc, but NOT far future doc
      expect(alerts.length).toBe(2);
      expect(alerts.some((d) => d.id === 'doc-expired')).toBe(true);
      expect(alerts.some((d) => d.id === 'doc-expiring-soon')).toBe(true);
      expect(alerts.some((d) => d.id === 'doc-far-future')).toBe(false);
    });
  });

  // 4. Purchase Posting Idempotency & Workflow (Defect 6)
  describe('Purchase Posting Single-Update Verification', () => {
    const purchase: PurchaseHeader = {
      id: 'pur-101',
      purchaseNo: 'PUR-26-0001',
      transactionDate: '2026-10-15T09:00:00Z',
      supplierPartyId: 'sup-001',
      sourceType: 'DIRECT_SUPPLIER',
      yardId: 'yd-01',
      lines: [
        {
          id: 'line-1',
          materialId: 'mat-ms-boring',
          grossWeight: 14250,
          tareWeight: 8100,
          netWeight: 6150,
          deductions: 300,
          payableWeight: 5850,
          ratePerUnit: 28,
          gstRate: 18,
          taxableAmount: 163800,
          gstAmount: 29484,
          totalAmount: 193284,
        },
      ],
      subtotalAmount: 163800,
      taxAmount: 29484,
      otherCharges: 0,
      totalAmount: 193284,
      amountPaid: 0,
      outstandingBalance: 193284,
      status: 'APPROVED',
      createdBy: 'admin',
      createdAt: '2026-10-15T09:00:00Z',
    };

    it('should post purchase, update payable balance and create inventory exactly once', () => {
      const existingMovements: StockMovement[] = [];
      const result = postPurchaseTransaction(purchase, existingMovements, 'admin');

      expect(result.updatedPurchase.status).toBe('POSTED');
      expect(result.updatedPurchase.outstandingBalance).toBe(193284);
      expect(result.newLots.length).toBe(1);
      expect(result.newLots[0].initialQuantity).toBe(5850);
      expect(result.newMovements.length).toBe(1);
      expect(result.newMovements[0].quantity).toBe(5850);

      // Re-posting must be rejected
      expect(() =>
        postPurchaseTransaction(result.updatedPurchase, result.newMovements, 'admin')
      ).toThrow(/already posted/);
    });
  });

  // 5. Sales Dispatch FIFO and Gross Margin (Defects 3 & 7)
  describe('Sales Dispatch FIFO Lot Allocation & Gross Margin', () => {
    it('should consume FIFO lot, calculate COGS, and prevent duplicate dispatch', () => {
      const company: CompanySettings = {
        id: 'comp-1',
        companyName: 'YASHOTH ENTERPRISES',
        legalName: 'YASHOTH ENTERPRISES',
        addressLine1: 'Peruvayal',
        addressLine2: 'Kavarapettai',
        city: 'Gummidipoondi',
        stateName: 'Tamil Nadu',
        stateCode: '33',
        pincode: '601206',
        gstin: '33AXVPN9382L1ZF',
        phone: '+91 94440 12345',
        email: 'admin@yasoth.com',
        bankName: 'City Union Bank',
        bankAccountNo: '510909010195638',
        bankBranchIfsc: 'CIUB0000439',
        invoicePrefix: 'YE/',
        defaultBaseUnit: 'KG',
      };

      const customer: Party = {
        id: 'cust-01',
        partyCode: 'CUST-001',
        legalName: 'TEJAS STEEL',
        partyType: 'CUSTOMER',
        contactPerson: 'Tejas',
        phone: '+91 98840 99887',
        addressLine1: 'Bypass Road',
        city: 'Gummidipoondi',
        stateName: 'Tamil Nadu',
        stateCode: '33',
        paymentTerms: 'Immediate',
        creditLimit: 500000,
        openingBalance: 0,
        openingBalanceDate: '2026-10-01',
        isActive: true,
      };

      const lots: InventoryLot[] = [
        {
          id: 'lot-old',
          lotNumber: 'LOT-OPEN-BORING-01',
          materialId: 'mat-ms-boring',
          yardId: 'yd-01',
          initialQuantity: 5000,
          remainingQuantity: 5000,
          unitCost: 27.50,
          receivedAt: '2026-10-01T08:00:00Z',
          isExhausted: false,
        },
      ];

      const existingMovements: StockMovement[] = [
        {
          id: 'mov-open-1',
          movementType: 'OPENING_STOCK',
          transactionRef: 'OPENING-2026',
          materialId: 'mat-ms-boring',
          yardId: 'yd-01',
          lotId: 'lot-old',
          quantity: 5000,
          unitCost: 27.50,
          totalCost: 137500,
          createdBy: 'admin',
          createdAt: '2026-10-01T08:00:00Z',
        },
      ];

      const sales: SalesHeader = {
        id: 'so-01',
        salesNo: 'SO-26-0001',
        orderDate: '2026-10-16T10:00:00Z',
        customerPartyId: customer.id,
        yardId: 'yd-01',
        status: 'CONFIRMED',
        subtotalAmount: 63000, // 2000 KG @ 31.50
        taxAmount: 11340,
        totalAmount: 74340,
        allocatedCogs: 0,
        createdBy: 'admin',
        createdAt: '2026-10-16T10:00:00Z',
        lines: [
          {
            id: 'sol-1',
            materialId: 'mat-ms-boring',
            quantity: 2000,
            ratePerUnit: 31.50,
            gstRate: 18,
            taxableAmount: 63000,
            gstAmount: 11340,
            totalAmount: 74340,
            lotAllocations: [],
          },
        ],
      };

      const dispatchResult = dispatchSalesTransaction(
        sales,
        lots,
        existingMovements,
        customer,
        company,
        1,
        'admin'
      );

      // Lot consumption
      expect(dispatchResult.updatedLots[0].remainingQuantity).toBe(3000);
      expect(dispatchResult.updatedLots[0].isExhausted).toBe(false);

      // COGS = 2,000 KG * ₹27.50 = ₹55,000
      expect(dispatchResult.updatedSales.allocatedCogs).toBe(55000);

      // Gross Margin = Subtotal (63,000) - COGS (55,000) = ₹8,000
      const grossMargin =
        dispatchResult.updatedSales.subtotalAmount - dispatchResult.updatedSales.allocatedCogs;
      expect(grossMargin).toBe(8000);

      // Invoice generated
      expect(dispatchResult.generatedInvoice.grandTotal).toBe(74340);
      expect(dispatchResult.generatedInvoice.outstandingBalance).toBe(74340);

      // Duplicate dispatch prevented
      expect(() =>
        dispatchSalesTransaction(
          dispatchResult.updatedSales,
          dispatchResult.updatedLots,
          dispatchResult.newMovements,
          customer,
          company,
          2,
          'admin'
        )
      ).toThrow(/already been dispatched/);
    });
  });

  // 6. Stock Movement Reversal (Workflow 5)
  describe('Stock Movement Reversal Workflow', () => {
    it('should create immutable reversal movement and reject second reversal', () => {
      const originalMovement: StockMovement = {
        id: 'mov-1',
        movementType: 'SALES_DISPATCH',
        transactionRef: 'SO-26-0001',
        materialId: 'mat-ms-boring',
        yardId: 'yd-01',
        quantity: -1000,
        unitCost: 28,
        totalCost: -28000,
        createdBy: 'admin',
        createdAt: '2026-10-16T10:00:00Z',
      };

      const reversal = reverseStockMovement(
        [originalMovement],
        originalMovement,
        'Customer cancelled dispatch at gate',
        'admin'
      );

      expect(reversal.movementType).toBe('REVERSAL');
      expect(reversal.quantity).toBe(1000); // Restores +1,000 KG
      expect(reversal.notes).toContain('Customer cancelled dispatch');

      const updatedOriginal: StockMovement = {
        ...originalMovement,
        reversalMovementId: reversal.id,
      };

      expect(() =>
        reverseStockMovement([updatedOriginal, reversal], updatedOriginal, 'Duplicate', 'admin')
      ).toThrow(/already been reversed/);
    });
  });
});
