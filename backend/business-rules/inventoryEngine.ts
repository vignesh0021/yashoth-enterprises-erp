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
    companyId?: string;
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
    const currentStock = calculateCurrentStock(existingMovements, materialId, yardId, params.companyId);
    if (currentStock + quantity < -0.0001) {
      throw new Error(
        `Negative stock violation: Attempted outward movement of ${Math.abs(quantity)} KG exceeds current stock of ${currentStock} KG.`
      );
    }
  }

  const movement: StockMovement = {
    id: 'mov-' + Math.random().toString(36).substring(2, 11),
    companyId: params.companyId,
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

// ============================================================================
// PHASE 1 — EXPLICIT MULTI-SOURCE LOT ALLOCATION & COMPLETE STOCK LEDGER
// ============================================================================

export interface ExplicitLotRequest {
  lotId: string;
  quantity: number;
}

export interface ExplicitLotAllocationDetail {
  id: string;
  lotId: string;
  lotNumber: string;
  sourceType: NonNullable<InventoryLot['sourceType']>;
  supplierPartyId?: string;
  supplierName?: string;
  sourcePurchaseId?: string;
  originalInvoiceNo?: string;
  allocatedQuantity: number;
  unitCost: number;
  totalCost: number;
}

/**
 * Allocates exact user-verified quantities from specific source lots (e.g. IMOP lot + IMH lot + Opening Godown lot).
 * Never merges distinct purchase sources; enforces non-negative remaining quantity and company isolation.
 */
export function allocateLotsExplicit(
  activeLots: InventoryLot[],
  requests: ExplicitLotRequest[],
  options?: { companyId?: string; yardId?: string; materialId?: string }
): {
  updatedLots: InventoryLot[];
  allocations: ExplicitLotAllocationDetail[];
  totalAllocated: number;
  totalCogs: number;
} {
  if (!requests || requests.length === 0) {
    throw new Error('At least one source stock lot allocation is required.');
  }

  const updatedLots = activeLots.map((l) => ({ ...l }));
  const lotMap = new Map(updatedLots.map((l) => [l.id, l]));
  const allocations: ExplicitLotAllocationDetail[] = [];
  let totalAllocated = 0;
  let totalCogs = 0;

  for (const req of requests) {
    const qty = roundTo3(req.quantity);
    if (qty <= 0) {
      throw new Error(`Allocated quantity for lot ${req.lotId} must be greater than zero.`);
    }

    const lot = lotMap.get(req.lotId);
    if (!lot) {
      throw new Error(`Source lot "${req.lotId}" was not found.`);
    }
    if (options?.companyId && lot.companyId && lot.companyId !== options.companyId) {
      throw new Error(`Cross-company stock violation: Lot ${lot.lotNumber} does not belong to active company.`);
    }
    if (options?.yardId && lot.yardId !== options.yardId) {
      throw new Error(`Lot ${lot.lotNumber} belongs to yard ${lot.yardId}, not source yard ${options.yardId}.`);
    }
    if (options?.materialId && lot.materialId !== options.materialId) {
      throw new Error(`Material mismatch on lot ${lot.lotNumber}: expected ${options.materialId}, found ${lot.materialId}.`);
    }
    if (lot.isExhausted || roundTo3(lot.remainingQuantity) < qty) {
      throw new Error(
        `Insufficient stock in lot ${lot.lotNumber} (${lot.supplierName || lot.sourceType || 'Stock'}). Available: ${roundTo3(lot.remainingQuantity)} KG, Requested: ${qty} KG.`
      );
    }

    const cost = roundTo2(qty * lot.unitCost);
    lot.remainingQuantity = roundTo3(lot.remainingQuantity - qty);
    lot.dispatchedQuantity = roundTo3((lot.dispatchedQuantity || 0) + qty);
    if (lot.remainingQuantity <= 0.0001) {
      lot.remainingQuantity = 0;
      lot.isExhausted = true;
    }

    allocations.push({
      id: 'alloc-' + Math.random().toString(36).substring(2, 10),
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      sourceType: lot.sourceType || (lot.sourcePurchaseId ? 'PURCHASE' : 'OPENING_STOCK'),
      supplierPartyId: lot.supplierPartyId,
      supplierName: lot.supplierName,
      sourcePurchaseId: lot.sourcePurchaseId,
      originalInvoiceNo: lot.originalInvoiceNo,
      allocatedQuantity: qty,
      unitCost: lot.unitCost,
      totalCost: cost,
    });

    totalAllocated = roundTo3(totalAllocated + qty);
    totalCogs = roundTo2(totalCogs + cost);
  }

  return { updatedLots, allocations, totalAllocated, totalCogs };
}

export interface StockLedgerBreakdown {
  openingStock: number;
  purchaseInward: number;
  transferIn: number;
  salesReturn: number;
  approvedPositiveAdjustment: number;
  salesOutward: number;
  transferOut: number;
  purchaseReturn: number;
  materialConsumption: number;
  approvedNegativeAdjustment: number;
  reversalsNet: number;
  closingStock: number;
}

/**
 * Computes the complete Phase 1.4 Stock Ledger formula:
 * Opening + Purchase Inward + Transfer In + Sales Return + Approved Positive Adjustment
 * - Sales Outward - Transfer Out - Purchase Return - Material Consumption - Approved Negative Adjustment
 * = Closing Stock
 */
export function computeStockLedgerSummary(
  movements: StockMovement[],
  filter?: {
    companyId?: string;
    yardId?: string;
    materialId?: string;
    gradeId?: string;
    lotId?: string;
    fromDate?: string;
    toDate?: string;
  }
): StockLedgerBreakdown {
  const scoped = movements.filter((m) => {
    if (filter?.companyId && m.companyId && m.companyId !== filter.companyId) return false;
    if (filter?.yardId && m.yardId !== filter.yardId) return false;
    if (filter?.materialId && m.materialId !== filter.materialId) return false;
    if (filter?.gradeId && m.gradeId !== filter.gradeId) return false;
    if (filter?.lotId && m.lotId !== filter.lotId) return false;
    const d = m.createdAt ? m.createdAt.slice(0, 10) : '';
    if (filter?.fromDate && d && d < filter.fromDate) return false;
    if (filter?.toDate && d && d > filter.toDate) return false;
    return true;
  });

  let openingStock = 0;
  let purchaseInward = 0;
  let transferIn = 0;
  let salesReturn = 0;
  let approvedPositiveAdjustment = 0;
  let salesOutward = 0;
  let transferOut = 0;
  let purchaseReturn = 0;
  let materialConsumption = 0;
  let approvedNegativeAdjustment = 0;
  let reversalsNet = 0;

  for (const m of scoped) {
    const q = m.quantity;
    switch (m.movementType) {
      case 'OPENING_STOCK':
        openingStock = roundTo3(openingStock + q);
        break;
      case 'PURCHASE_RECEIPT':
      case 'COLLECTION_RECEIPT':
        purchaseInward = roundTo3(purchaseInward + Math.abs(q));
        break;
      case 'YARD_TRANSFER_IN':
        transferIn = roundTo3(transferIn + Math.abs(q));
        break;
      case 'SALES_RETURN':
        salesReturn = roundTo3(salesReturn + Math.abs(q));
        break;
      case 'APPROVED_POSITIVE_ADJUSTMENT':
        approvedPositiveAdjustment = roundTo3(approvedPositiveAdjustment + Math.abs(q));
        break;
      case 'SALES_DISPATCH':
        salesOutward = roundTo3(salesOutward + Math.abs(q));
        break;
      case 'YARD_TRANSFER_OUT':
        transferOut = roundTo3(transferOut + Math.abs(q));
        break;
      case 'PURCHASE_RETURN':
        purchaseReturn = roundTo3(purchaseReturn + Math.abs(q));
        break;
      case 'MATERIAL_CONSUMPTION':
        materialConsumption = roundTo3(materialConsumption + Math.abs(q));
        break;
      case 'APPROVED_NEGATIVE_ADJUSTMENT':
      case 'STOCK_LOSS':
        approvedNegativeAdjustment = roundTo3(approvedNegativeAdjustment + Math.abs(q));
        break;
      case 'STOCK_ADJUSTMENT':
        if (q >= 0) approvedPositiveAdjustment = roundTo3(approvedPositiveAdjustment + q);
        else approvedNegativeAdjustment = roundTo3(approvedNegativeAdjustment + Math.abs(q));
        break;
      case 'REVERSAL':
        reversalsNet = roundTo3(reversalsNet + q);
        break;
    }
  }

  const closingStock = roundTo3(
    openingStock +
      purchaseInward +
      transferIn +
      salesReturn +
      approvedPositiveAdjustment +
      reversalsNet -
      salesOutward -
      transferOut -
      purchaseReturn -
      materialConsumption -
      approvedNegativeAdjustment
  );

  return {
    openingStock,
    purchaseInward,
    transferIn,
    salesReturn,
    approvedPositiveAdjustment,
    salesOutward,
    transferOut,
    purchaseReturn,
    materialConsumption,
    approvedNegativeAdjustment,
    reversalsNet,
    closingStock,
  };
}

/**
 * Verifies that completed internal godown transfers never artificially inflate or deflate consolidated company stock.
 */
export function verifyInternalTransferNeutrality(
  movements: StockMovement[],
  companyId?: string
): { isNeutral: boolean; totalTransferOut: number; totalTransferIn: number; inTransitDelta: number } {
  const scoped = movements.filter((m) => !companyId || !m.companyId || m.companyId === companyId);
  const totalTransferOut = roundTo3(
    scoped
      .filter((m) => m.movementType === 'YARD_TRANSFER_OUT')
      .reduce((s, m) => s + Math.abs(m.quantity), 0)
  );
  const totalTransferIn = roundTo3(
    scoped
      .filter((m) => m.movementType === 'YARD_TRANSFER_IN')
      .reduce((s, m) => s + Math.abs(m.quantity), 0)
  );
  const inTransitDelta = roundTo3(totalTransferOut - totalTransferIn);
  return {
    isNeutral: Math.abs(inTransitDelta) < 0.001,
    totalTransferOut,
    totalTransferIn,
    inTransitDelta,
  };
}
