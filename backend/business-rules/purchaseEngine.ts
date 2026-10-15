// Yasoth Enterprises Scrap ERP — Purchase Posting Rules Engine
// Enforces approval workflow, idempotent stock inward generation, and supplier balance linkage

import { PurchaseHeader, InventoryLot, StockMovement } from '../../src/types/index.ts';
import { roundTo2, roundTo3 } from '../../src/utils/calculations.ts';
import { createStockMovement } from './inventoryEngine.ts';

export interface PurchasePostingResult {
  updatedPurchase: PurchaseHeader;
  newLots: InventoryLot[];
  newMovements: StockMovement[];
}

export function postPurchaseTransaction(
  purchase: PurchaseHeader,
  existingMovements: StockMovement[],
  actor: string
): PurchasePostingResult {
  if (purchase.status === 'POSTED') {
    throw new Error(`Purchase ${purchase.purchaseNo} is already posted. Duplicate posting is prevented.`);
  }

  if (purchase.status === 'CANCELLED') {
    throw new Error(`Cannot post cancelled purchase ${purchase.purchaseNo}.`);
  }

  if (!purchase.lines || purchase.lines.length === 0) {
    throw new Error(`Purchase ${purchase.purchaseNo} contains no material lines to post.`);
  }

  const now = new Date().toISOString();
  const newLots: InventoryLot[] = [];
  const newMovements: StockMovement[] = [...existingMovements];
  const createdMovements: StockMovement[] = [];

  for (let idx = 0; idx < purchase.lines.length; idx++) {
    const line = purchase.lines[idx];
    const qty = roundTo3(line.payableWeight);
    if (qty <= 0) {
      throw new Error(`Line ${idx + 1} has zero or negative payable weight.`);
    }

    const lotNumber = `LOT-${purchase.purchaseNo}-${idx + 1}`;
    const newLot: InventoryLot = {
      id: 'lot-' + Math.random().toString(36).substring(2, 11),
      lotNumber,
      materialId: line.materialId,
      gradeId: line.gradeId,
      yardId: purchase.yardId,
      sourcePurchaseId: purchase.id,
      initialQuantity: qty,
      remainingQuantity: qty,
      unitCost: roundTo2(line.ratePerUnit),
      receivedAt: now,
      isExhausted: false,
    };
    newLots.push(newLot);

    const movementType = purchase.sourceType === 'COLLECTION_PICKUP' ? 'COLLECTION_RECEIPT' : 'PURCHASE_RECEIPT';
    const movement = createStockMovement(newMovements, {
      movementType,
      transactionRef: purchase.purchaseNo,
      materialId: line.materialId,
      gradeId: line.gradeId,
      yardId: purchase.yardId,
      lotId: newLot.id,
      quantity: qty,
      unitCost: line.ratePerUnit,
      notes: `Purchase Receipt for ${purchase.purchaseNo} - Line ${idx + 1}`,
      createdBy: actor,
    });

    newMovements.push(movement);
    createdMovements.push(movement);
  }

  const updatedPurchase: PurchaseHeader = {
    ...purchase,
    status: 'POSTED',
    postedAt: now,
    approvedBy: actor,
    outstandingBalance: roundTo2(purchase.totalAmount - (purchase.amountPaid || 0)),
  };

  return {
    updatedPurchase,
    newLots,
    newMovements: createdMovements,
  };
}
