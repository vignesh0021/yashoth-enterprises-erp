// Inventory & Stock Ledger Business Rules Tests
import { describe, it, expect } from 'vitest';
import { 
  calculateCurrentStock, 
  allocateLotsFifo, 
  createStockMovement, 
  reverseStockMovement 
} from '../backend/business-rules/inventoryEngine.ts';
import type { InventoryLot, StockMovement } from '../src/types/index.ts';

describe('Inventory & Stock Ledger Engine', () => {
  const materialId = 'mat-steel-01';
  const yardId = 'yard-main-01';

  it('should calculate authoritative current stock from append-only movements', () => {
    const movements: StockMovement[] = [
      {
        id: 'm1',
        movementType: 'PURCHASE_RECEIPT',
        transactionRef: 'PUR-001',
        materialId,
        yardId,
        quantity: 5000,
        unitCost: 30,
        totalCost: 150000,
        createdBy: 'user1',
        createdAt: '2026-10-10T10:00:00Z',
      },
      {
        id: 'm2',
        movementType: 'SALES_DISPATCH',
        transactionRef: 'SAL-001',
        materialId,
        yardId,
        quantity: -2000,
        unitCost: 30,
        totalCost: 60000,
        createdBy: 'user1',
        createdAt: '2026-10-11T10:00:00Z',
      },
    ];

    const currentStock = calculateCurrentStock(movements, materialId, yardId);
    expect(currentStock).toBe(3000);
  });

  it('should strictly reject outward movements that would cause negative stock', () => {
    const movements: StockMovement[] = [
      {
        id: 'm1',
        movementType: 'PURCHASE_RECEIPT',
        transactionRef: 'PUR-001',
        materialId,
        yardId,
        quantity: 1000,
        unitCost: 30,
        totalCost: 30000,
        createdBy: 'user1',
        createdAt: '2026-10-10T10:00:00Z',
      },
    ];

    expect(() =>
      createStockMovement(movements, {
        movementType: 'SALES_DISPATCH',
        transactionRef: 'SAL-002',
        materialId,
        yardId,
        quantity: -1500, // 1500 > 1000 available
        unitCost: 30,
        createdBy: 'user1',
      })
    ).toThrow(/Negative stock violation/);
  });

  it('should allocate lots using FIFO and calculate exact Cost of Goods Sold (COGS)', () => {
    const activeLots: InventoryLot[] = [
      {
        id: 'lot-1',
        lotNumber: 'LOT-PUR-001',
        materialId,
        yardId,
        initialQuantity: 1000,
        remainingQuantity: 1000,
        unitCost: 25, // ₹25/kg
        receivedAt: '2026-10-01T10:00:00Z',
        isExhausted: false,
      },
      {
        id: 'lot-2',
        lotNumber: 'LOT-PUR-002',
        materialId,
        yardId,
        initialQuantity: 2000,
        remainingQuantity: 2000,
        unitCost: 30, // ₹30/kg
        receivedAt: '2026-10-05T10:00:00Z',
        isExhausted: false,
      },
    ];

    // Dispatch 1,500 KG. FIFO must take 1,000 KG from lot-1 (@ ₹25) and 500 KG from lot-2 (@ ₹30)
    // Total COGS = (1000 * 25) + (500 * 30) = 25,000 + 15,000 = ₹40,000
    const { updatedLots, result } = allocateLotsFifo(activeLots, materialId, yardId, 1500);

    expect(result.allocations.length).toBe(2);
    expect(result.allocations[0].lotNumber).toBe('LOT-PUR-001');
    expect(result.allocations[0].allocatedQuantity).toBe(1000);
    expect(result.allocations[0].unitCost).toBe(25);

    expect(result.allocations[1].lotNumber).toBe('LOT-PUR-002');
    expect(result.allocations[1].allocatedQuantity).toBe(500);
    expect(result.allocations[1].unitCost).toBe(30);

    expect(result.totalCogs).toBe(40000);

    // Verify lot remaining quantities
    const lot1 = updatedLots.find((l) => l.id === 'lot-1');
    const lot2 = updatedLots.find((l) => l.id === 'lot-2');

    expect(lot1?.remainingQuantity).toBe(0);
    expect(lot1?.isExhausted).toBe(true);

    expect(lot2?.remainingQuantity).toBe(1500);
    expect(lot2?.isExhausted).toBe(false);
  });

  it('should reject FIFO allocation when requested quantity exceeds available lot stock', () => {
    const activeLots: InventoryLot[] = [
      {
        id: 'lot-1',
        lotNumber: 'LOT-PUR-001',
        materialId,
        yardId,
        initialQuantity: 500,
        remainingQuantity: 500,
        unitCost: 25,
        receivedAt: '2026-10-01T10:00:00Z',
        isExhausted: false,
      },
    ];

    expect(() => allocateLotsFifo(activeLots, materialId, yardId, 800)).toThrow(/Insufficient stock/);
  });

  it('should create reversing movement that restores stock and flags original movement', () => {
    const original: StockMovement = {
      id: 'mov-orig',
      movementType: 'SALES_DISPATCH',
      transactionRef: 'SAL-001',
      materialId,
      yardId,
      quantity: -500,
      unitCost: 30,
      totalCost: 15000,
      createdBy: 'user1',
      createdAt: '2026-10-10T10:00:00Z',
    };

    const reversal = reverseStockMovement([original], original, 'Customer returned damaged goods', 'admin');
    expect(reversal.movementType).toBe('REVERSAL');
    expect(reversal.quantity).toBe(500); // positive restore
  });

  it('should strictly allocate from oldest lot first even when array is unsorted', () => {
    // Newer lot placed at index 0, older lot placed at index 1
    const unsortedLots: InventoryLot[] = [
      {
        id: 'lot-newer',
        lotNumber: 'LOT-OCT-15',
        materialId,
        yardId,
        initialQuantity: 1000,
        remainingQuantity: 1000,
        unitCost: 35,
        receivedAt: '2026-10-15T10:00:00Z',
        isExhausted: false,
      },
      {
        id: 'lot-older',
        lotNumber: 'LOT-OCT-01',
        materialId,
        yardId,
        initialQuantity: 1000,
        remainingQuantity: 1000,
        unitCost: 20,
        receivedAt: '2026-10-01T10:00:00Z',
        isExhausted: false,
      },
    ];

    // Request 500 KG. FIFO must consume from lot-older (OCT-01 @ ₹20) NOT lot-newer (OCT-15 @ ₹35)
    const { updatedLots, result } = allocateLotsFifo(unsortedLots, materialId, yardId, 500);

    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0].lotNumber).toBe('LOT-OCT-01');
    expect(result.allocations[0].allocatedQuantity).toBe(500);
    expect(result.allocations[0].unitCost).toBe(20);
    expect(result.totalCogs).toBe(10000);

    const olderLot = updatedLots.find((l) => l.id === 'lot-older');
    const newerLot = updatedLots.find((l) => l.id === 'lot-newer');
    expect(olderLot?.remainingQuantity).toBe(500);
    expect(newerLot?.remainingQuantity).toBe(1000); // Intact
  });
});

