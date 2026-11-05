// Purchase Workflow & Posting Tests
import { describe, it, expect } from 'vitest';
import { postPurchaseTransaction } from '../backend/business-rules/purchaseEngine.ts';
import type { PurchaseHeader, StockMovement } from '../src/types/index.ts';

describe('Purchase Workflow & Stock Posting', () => {
  const dummyPurchase: PurchaseHeader = {
    id: 'pur-001',
    purchaseNo: 'PUR-26-001',
    transactionDate: '2026-10-15T09:00:00Z',
    supplierPartyId: 'sup-1',
    sourceType: 'DIRECT_SUPPLIER',
    yardId: 'yard-1',
    vehicleRegistration: 'TN 18 BY 0420',
    lines: [
      {
        id: 'line-1',
        materialId: 'mat-steel-01',
        grossWeight: 10000,
        tareWeight: 4000,
        netWeight: 6000,
        deductions: 200,
        payableWeight: 5800,
        ratePerUnit: 28,
        gstRate: 18,
        taxableAmount: 162400,
        gstAmount: 29232,
        totalAmount: 191632,
      },
    ],
    subtotalAmount: 162400,
    taxAmount: 29232,
    otherCharges: 0,
    totalAmount: 191632,
    amountPaid: 0,
    outstandingBalance: 191632,
    status: 'APPROVED',
    createdBy: 'operator1',
    createdAt: '2026-10-15T09:00:00Z',
  };

  it('should post purchase and create inventory lot and stock inward movement exactly once', () => {
    const existingMovements: StockMovement[] = [];
    const result = postPurchaseTransaction(dummyPurchase, existingMovements, 'admin');

    expect(result.updatedPurchase.status).toBe('POSTED');
    expect(result.newLots.length).toBe(1);
    expect(result.newLots[0].lotNumber).toBe('LOT-PUR-26-001-1');
    expect(result.newLots[0].initialQuantity).toBe(5800);
    expect(result.newLots[0].remainingQuantity).toBe(5800);
    expect(result.newLots[0].unitCost).toBe(28);

    expect(result.newMovements.length).toBe(1);
    expect(result.newMovements[0].movementType).toBe('PURCHASE_RECEIPT');
    expect(result.newMovements[0].quantity).toBe(5800);
    expect(result.newMovements[0].unitCost).toBe(28);
  });

  it('should reject duplicate posting of an already posted purchase', () => {
    const postedPurchase: PurchaseHeader = {
      ...dummyPurchase,
      status: 'POSTED',
      postedAt: '2026-10-15T09:30:00Z',
    };

    expect(() => postPurchaseTransaction(postedPurchase, [], 'admin')).toThrow(
      /is already posted/
    );
  });

  it('should reject posting of a cancelled purchase', () => {
    const cancelledPurchase: PurchaseHeader = {
      ...dummyPurchase,
      status: 'CANCELLED',
    };

    expect(() => postPurchaseTransaction(cancelledPurchase, [], 'admin')).toThrow(
      /Cannot post cancelled purchase/
    );
  });
});
