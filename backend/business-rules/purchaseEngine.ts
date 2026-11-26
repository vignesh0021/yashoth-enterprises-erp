// Yasoth Enterprises Scrap ERP — Purchase Posting Rules Engine
// Enforces approval workflow, idempotent stock inward generation, and supplier balance linkage

import type { PurchaseHeader, InventoryLot, StockMovement } from '../../src/types/index.ts';
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

  if (purchase.ocrSource && purchase.isUserVerified === false) {
    throw new Error(
      `Purchase ${purchase.purchaseNo} was extracted via OCR and must be verified by a user before posting stock inward.`
    );
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
      companyId: purchase.companyId,
      lotNumber,
      materialId: line.materialId,
      gradeId: line.gradeId,
      yardId: purchase.yardId,
      sourceType: 'PURCHASE',
      sourcePurchaseId: purchase.id,
      supplierPartyId: purchase.supplierPartyId,
      supplierName: purchase.supplierName,
      purchaseOrderNo: purchase.poNumber,
      originalInvoiceNo: purchase.supplierInvoiceNo || purchase.purchaseNo,
      initialQuantity: qty,
      allocatedQuantity: 0,
      dispatchedQuantity: 0,
      returnedQuantity: 0,
      remainingQuantity: qty,
      unitCost: roundTo2(line.ratePerUnit),
      receivedAt: now,
      isExhausted: false,
    };
    newLots.push(newLot);

    const movementType = purchase.sourceType === 'COLLECTION_PICKUP' ? 'COLLECTION_RECEIPT' : 'PURCHASE_RECEIPT';
    const movement = createStockMovement(newMovements, {
      companyId: purchase.companyId,
      movementType,
      transactionRef: purchase.supplierInvoiceNo || purchase.purchaseNo,
      materialId: line.materialId,
      gradeId: line.gradeId,
      yardId: purchase.yardId,
      lotId: newLot.id,
      quantity: qty,
      unitCost: line.ratePerUnit,
      notes: `Purchase Receipt for ${purchase.purchaseNo}${purchase.supplierInvoiceNo ? ` (Inv: ${purchase.supplierInvoiceNo})` : ''} - Line ${idx + 1}`,
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

/**
 * Posts a supplier purchase return against a specific purchase lot without allowing negative lot stock.
 */
export function postPurchaseReturn(params: {
  lot: InventoryLot;
  returnQuantity: number;
  existingMovements: StockMovement[];
  reason: string;
  actor: string;
  returnRef?: string;
}): { updatedLot: InventoryLot; movement: StockMovement } {
  const qty = roundTo3(params.returnQuantity);
  if (qty <= 0) {
    throw new Error('Purchase return quantity must be greater than zero.');
  }
  if (qty > roundTo3(params.lot.remainingQuantity)) {
    throw new Error(
      `Cannot return ${qty} KG from lot ${params.lot.lotNumber}: only ${params.lot.remainingQuantity} KG remains.`
    );
  }

  const movement = createStockMovement(params.existingMovements, {
    companyId: params.lot.companyId,
    movementType: 'PURCHASE_RETURN',
    transactionRef: params.returnRef || `PRET-${params.lot.lotNumber}`,
    materialId: params.lot.materialId,
    gradeId: params.lot.gradeId,
    yardId: params.lot.yardId,
    lotId: params.lot.id,
    quantity: -qty,
    unitCost: params.lot.unitCost,
    notes: `Purchase Return from lot ${params.lot.lotNumber}. Reason: ${params.reason}`,
    createdBy: params.actor,
  });

  const remaining = roundTo3(params.lot.remainingQuantity - qty);
  const updatedLot: InventoryLot = {
    ...params.lot,
    remainingQuantity: remaining,
    returnedQuantity: roundTo3((params.lot.returnedQuantity || 0) + qty),
    isExhausted: remaining <= 0.0001,
  };

  return { updatedLot, movement };
}
