// Yasoth Enterprises Scrap ERP — Inventory & Stock Ledger Business Rules Engine
// Enforces append-only immutable stock movements, FIFO lot allocation, and non-negative stock guards

import type { InventoryLot, StockMovement, MovementType } from '../../src/types/index.ts';
import { roundTo2, roundTo3 } from '../../src/utils/calculations.ts';

export interface LotAllocationResult {
  allocations: {
    lotId: string;
    lotNumber: string;
    allocatedQuantity: number;
    unitCost: number;
    totalCost: number;
  }[];
  totalCogs: number;
  remainingRequestedQuantity: number;
}

/**
 * Calculates current available stock for a material at a specific yard from posted stock movements.
 */
export function calculateCurrentStock(
  movements: StockMovement[],
  materialId: string,
  yardId?: string,
  companyId?: string
): number {
  return roundTo3(
    movements
      .filter(
        (m) =>
          m.materialId === materialId &&
          (!yardId || m.yardId === yardId) &&
          (!companyId || !(m as any).companyId || (m as any).companyId === companyId)
      )
      .reduce((sum, m) => sum + m.quantity, 0)
  );
}

/**
 * Allocates outward dispatch quantity to active inventory lots using First-In, First-Out (FIFO).
 * Throws an error if available quantity in active lots is insufficient to satisfy the dispatch.
 */
export function allocateLotsFifo(
  activeLots: InventoryLot[],
  materialId: string,
  yardId: string,
  requestedQuantity: number
): { updatedLots: InventoryLot[]; result: LotAllocationResult } {
  if (requestedQuantity <= 0) {
    throw new Error('Requested dispatch quantity must be greater than zero');
  }

  // Filter lots for material and yard, sorted chronologically (FIFO)
  const eligibleLots = activeLots
    .filter(
      (lot) =>
        lot.materialId === materialId &&
        lot.yardId === yardId &&
        !lot.isExhausted &&
        lot.remainingQuantity > 0
    )
    .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

  const totalAvailable = eligibleLots.reduce((sum, l) => sum + l.remainingQuantity, 0);
  if (roundTo3(totalAvailable) < roundTo3(requestedQuantity)) {
    throw new Error(
      `Insufficient stock available in yard. Requested: ${requestedQuantity} KG, Available: ${roundTo3(totalAvailable)} KG`
    );
  }

  let remainingToAllocate = roundTo3(requestedQuantity);
  const allocations: LotAllocationResult['allocations'] = [];
  let totalCogs = 0;

  // Clone lots to avoid mutating caller state directly
  const updatedLots = activeLots.map((l) => ({ ...l }));
  const lotMap = new Map(updatedLots.map((l) => [l.id, l]));

  // Strictly allocate in chronological receivedAt order (FIFO)
  for (const eligible of eligibleLots) {
    if (remainingToAllocate <= 0) break;
    const lot = lotMap.get(eligible.id);
    if (!lot || lot.isExhausted || lot.remainingQuantity <= 0) {
      continue;
    }

    const qtyFromThisLot = Math.min(lot.remainingQuantity, remainingToAllocate);
    const allocQty = roundTo3(qtyFromThisLot);
    const lotCost = roundTo2(allocQty * lot.unitCost);

    allocations.push({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      allocatedQuantity: allocQty,
      unitCost: lot.unitCost,
      totalCost: lotCost,
    });

    totalCogs = roundTo2(totalCogs + lotCost);
    lot.remainingQuantity = roundTo3(lot.remainingQuantity - allocQty);
    if (lot.remainingQuantity <= 0) {
      lot.remainingQuantity = 0;
      lot.isExhausted = true;
    }

    remainingToAllocate = roundTo3(remainingToAllocate - allocQty);
  }

  return {
    updatedLots,
    result: {
      allocations,
      totalCogs,
      remainingRequestedQuantity: remainingToAllocate,
    },
  };
}

/**
 * Creates an append-only stock movement entry with strict validation.
 */
export function createStockMovement(
  existingMovements: StockMovement[],
  params: {
    movementType: MovementType;
    transactionRef: string;
    materialId: string;
    gradeId?: string;
    yardId: string;
    lotId?: string;
    quantity: number;
    unitCost: number;
    notes?: string;
    createdBy: string;
  }
): StockMovement {
  const { movementType, transactionRef, materialId, yardId, quantity, unitCost } = params;

  if (quantity === 0) {
    throw new Error('Stock movement quantity cannot be zero');
  }

  // If outward movement, verify stock balance will not drop below zero
  if (quantity < 0) {
    const currentStock = calculateCurrentStock(existingMovements, materialId, yardId);
    if (currentStock + quantity < -0.0001) {
      throw new Error(
        `Negative stock violation: Attempted outward movement of ${Math.abs(quantity)} KG exceeds current stock of ${currentStock} KG.`
      );
    }
  }

  const movement: StockMovement = {
    id: 'mov-' + Math.random().toString(36).substring(2, 11),
    movementType,
    transactionRef,
    materialId,
    gradeId: params.gradeId,
    yardId,
    lotId: params.lotId,
    quantity: roundTo3(quantity),
    unitCost: roundTo2(unitCost),
    totalCost: roundTo2(Math.abs(quantity) * unitCost),
    notes: params.notes,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
  };

  return movement;
}

/**
 * Creates a reversing movement for a posted movement (immutable correction).
 */
export function reverseStockMovement(
  existingMovements: StockMovement[],
  movementToReverse: StockMovement,
  reason: string,
  actor: string
): StockMovement {
  if (movementToReverse.reversalMovementId) {
    throw new Error('This stock movement has already been reversed.');
  }

  const reversedQty = -movementToReverse.quantity;

  const reversal = createStockMovement(existingMovements, {
    movementType: 'REVERSAL',
    transactionRef: `REV-${movementToReverse.transactionRef}`,
    materialId: movementToReverse.materialId,
    gradeId: movementToReverse.gradeId,
    yardId: movementToReverse.yardId,
    lotId: movementToReverse.lotId,
    quantity: reversedQty,
    unitCost: movementToReverse.unitCost,
    notes: `Reversal of movement ${movementToReverse.id}. Reason: ${reason}`,
    createdBy: actor,
  });

  return reversal;
}
