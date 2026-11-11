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
          (!companyId ? true : (m as any).companyId === companyId)
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
  requestedQuantity: number,
  companyId?: string
): { updatedLots: InventoryLot[]; result: LotAllocationResult } {
  if (requestedQuantity <= 0) {
    throw new Error('Requested dispatch quantity must be greater than zero');
  }

  // Filter lots for material, yard, and company, sorted strictly chronologically (FIFO)
  const eligibleLots = activeLots
    .filter(
      (lot) =>
        lot.materialId === materialId &&
        lot.yardId === yardId &&
        (!companyId ? true : (lot as any).companyId === companyId) &&
        !lot.isExhausted &&
        lot.remainingQuantity > 0
    )
    .sort((a, b) => {
      const timeDiff = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (a.lotNumber || a.id).localeCompare(b.lotNumber || b.id);
    });

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

export interface FifoCogsVerificationResult {
  isValid: boolean;
  verifiedCogs: number;
  totalAllocatedQuantity: number;
  unverifiedReason?: string;
  discrepancies: string[];
}

export interface FifoCogsFilter {
  companyId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Validates actual FIFO Cost of Goods Sold (COGS) from inventory lots and outward dispatches.
 * Prohibits blind certification: requires companyId on all lots and movements, rejects cross-company references,
 * validates movement totalCost against quantity × historical unit cost (without comparing against mutable current lot costs),
 * validates cumulative lot allocations against initial and remaining quantities, and enforces consistent date/company filtering.
 */
export function verifyFifoCogsIntegrity(
  movements: StockMovement[],
  lots: InventoryLot[],
  filter?: FifoCogsFilter
): FifoCogsVerificationResult {
  const discrepancies: string[] = [];

  // Filter lots by company if filter.companyId specified
  const targetLots = filter?.companyId
    ? lots.filter((l) => l.companyId === filter.companyId)
    : lots;

  const lotMap = new Map(targetLots.map((l) => [l.id, l]));

  // 1. Check companyId and valid non-negative quantities on lots
  for (const l of targetLots) {
    if (!l.companyId) {
      discrepancies.push(`Inventory lot ${l.id} (${l.lotNumber}) is missing companyId.`);
    }
    if (l.remainingQuantity < 0) {
      discrepancies.push(`Inventory lot ${l.id} (${l.lotNumber}) has negative remaining quantity: ${l.remainingQuantity}.`);
    }
    if (l.initialQuantity <= 0) {
      discrepancies.push(`Inventory lot ${l.id} (${l.lotNumber}) has invalid non-positive initial quantity: ${l.initialQuantity}.`);
    }
  }

  // 2. Check for duplicate stock movements and ensure sales dispatch movements are negative
  const seenAllMovementIds = new Set<string>();
  for (const m of movements) {
    if (seenAllMovementIds.has(m.id)) {
      discrepancies.push(`Duplicate stock movement ${m.id} (${m.transactionRef}) detected.`);
    }
    seenAllMovementIds.add(m.id);

    if (m.movementType === 'SALES_DISPATCH' && m.quantity >= 0) {
      discrepancies.push(`Sales dispatch movement ${m.id} (${m.transactionRef}) has non-negative quantity ${m.quantity}. Outward dispatches must have negative quantity.`);
    }
  }

  // Filter outward movements
  let targetMovements = movements.filter((m) => m.quantity < 0 && m.movementType === 'SALES_DISPATCH');
  if (filter?.companyId) {
    targetMovements = targetMovements.filter((m) => m.companyId === filter.companyId);
  }
  if (filter?.startDate) {
    targetMovements = targetMovements.filter((m) => {
      const d = m.createdAt ? m.createdAt.slice(0, 10) : '';
      return !d || d >= filter.startDate!;
    });
  }
  if (filter?.endDate) {
    targetMovements = targetMovements.filter((m) => {
      const d = m.createdAt ? m.createdAt.slice(0, 10) : '';
      return !d || d <= filter.endDate!;
    });
  }

  let verifiedCogs = 0;
  let totalAllocatedQuantity = 0;
  const cumulativeLotAllocations = new Map<string, number>();

  for (const m of targetMovements) {
    const qty = Math.abs(m.quantity);
    totalAllocatedQuantity = roundTo3(totalAllocatedQuantity + qty);

    // Validate companyId on movement
    if (!m.companyId) {
      discrepancies.push(`Stock movement ${m.id} (${m.transactionRef}) is missing companyId.`);
    }

    // Validate lot link
    if (!m.lotId) {
      discrepancies.push(`Stock movement ${m.id} (${m.transactionRef}) has no linked FIFO lot.`);
      continue;
    }

    const lot = lotMap.get(m.lotId);
    if (!lot) {
      discrepancies.push(`Stock movement ${m.id} references non-existent lot ${m.lotId}.`);
      continue;
    }

    // Material and yard consistency check
    if (m.materialId !== lot.materialId) {
      discrepancies.push(
        `Material mismatch in movement ${m.id}: movement material ${m.materialId} does not match lot material ${lot.materialId}.`
      );
    }
    if (m.yardId !== lot.yardId) {
      discrepancies.push(
        `Yard mismatch in movement ${m.id}: movement yard ${m.yardId} does not match lot yard ${lot.yardId}.`
      );
    }

    // Reject cross-company lot references
    if (m.companyId && lot.companyId && m.companyId !== lot.companyId) {
      discrepancies.push(
        `Cross-company lot reference in movement ${m.id}: movement belongs to company ${m.companyId} but lot belongs to company ${lot.companyId}.`
      );
    }

    // Validate unitCost
    if (m.unitCost <= 0) {
      discrepancies.push(`Stock movement ${m.id} from Lot ${lot.lotNumber} has invalid unitCost ₹${m.unitCost}.`);
      continue;
    }

    // Validate movement totalCost against quantity * historical unitCost (NOT against mutable lot.unitCost)
    const expectedCost = roundTo2(qty * m.unitCost);
    if (Math.abs(Math.abs(m.totalCost) - expectedCost) > 0.01) {
      discrepancies.push(
        `Stock movement ${m.id} totalCost mismatch: recorded ₹${m.totalCost} vs expected ₹${expectedCost} (${qty} × ₹${m.unitCost}).`
      );
      continue;
    }

    // Track cumulative allocation for lot
    const prevAllocated = cumulativeLotAllocations.get(m.lotId) || 0;
    cumulativeLotAllocations.set(m.lotId, roundTo3(prevAllocated + qty));

    verifiedCogs = roundTo2(verifiedCogs + expectedCost);
  }

  // 7. Validate cumulative lot allocations against initial and remaining quantities
  for (const [lotId, allocated] of cumulativeLotAllocations.entries()) {
    const lot = lotMap.get(lotId);
    if (!lot) continue;

    if (allocated > roundTo3(lot.initialQuantity + 0.005)) {
      discrepancies.push(
        `Cumulative lot allocation overflow for Lot ${lot.lotNumber}: allocated ${allocated} exceeds initial quantity ${lot.initialQuantity}.`
      );
    }

    // If no date filters were applied, cumulative allocations should match initial - remaining
    if (!filter?.startDate && !filter?.endDate) {
      const expectedConsumed = roundTo3(lot.initialQuantity - lot.remainingQuantity);
      if (Math.abs(allocated - expectedConsumed) > 0.01) {
        discrepancies.push(
          `Cumulative allocation mismatch for Lot ${lot.lotNumber}: allocated ${allocated} vs expected consumed ${expectedConsumed} (initial ${lot.initialQuantity} - remaining ${lot.remainingQuantity}).`
        );
      }
    }
  }

  const isValid = discrepancies.length === 0;
  return {
    isValid,
    verifiedCogs: isValid ? verifiedCogs : 0,
    totalAllocatedQuantity,
    unverifiedReason: isValid ? undefined : `FIFO COGS audit failed with ${discrepancies.length} discrepancy/discrepancies.`,
    discrepancies,
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
