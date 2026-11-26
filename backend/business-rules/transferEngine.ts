// Yasoth Enterprises Scrap ERP — Phase 3 Internal Godown Transfer Workflow Engine
// Transfer is NOT a purchase and NOT a sale.
// Enforces 8-state lifecycle, source deduction on dispatch, destination addition ONLY on receipt,
// partial receipts, shortage/excess tracking, dispute management, and duplicate receipt prevention.

import type {
  GodownTransfer,
  GodownTransferReceipt,
  GodownTransferStatus,
  InventoryLot,
  StockMovement,
} from '../../src/types/index.ts';
import { roundTo2, roundTo3 } from '../../src/utils/calculations.ts';
import {
  allocateLotsExplicit,
  allocateLotsFifo,
  createStockMovement,
  type ExplicitLotRequest,
} from './inventoryEngine.ts';

export interface CreateTransferInput {
  companyId: string;
  sourceYardId: string;
  destinationYardId: string;
  materialId: string;
  gradeId?: string;
  gradeName?: string;
  quantityDispatched: number;
  dispatchWeighmentId?: string;
  vehicleRegistration: string;
  driverName?: string;
  driverPhone?: string;
  dispatchEmployee: string;
  transferDate: string;
  expectedDate?: string;
  supportingDocumentIds?: string[];
  status?: Extract<GodownTransferStatus, 'DRAFT' | 'APPROVED' | 'PENDING'>;
  idempotencyKey?: string;
  notes?: string;
  createdBy: string;
}

export function createGodownTransfer(
  input: CreateTransferInput,
  existingTransfers: GodownTransfer[]
): GodownTransfer {
  if (input.sourceYardId === input.destinationYardId) {
    throw new Error('Source godown and destination godown must be different.');
  }
  const qty = roundTo3(input.quantityDispatched);
  if (qty <= 0) {
    throw new Error('Transfer dispatched quantity must be greater than zero.');
  }

  if (input.idempotencyKey) {
    const dup = existingTransfers.find(
      (t) => t.companyId === input.companyId && t.idempotencyKey === input.idempotencyKey
    );
    if (dup) {
      throw new Error(`Duplicate transfer prevented: idempotency key already used by ${dup.transferNo}.`);
    }
  }

  const seq = existingTransfers.length + 1;
  const now = new Date().toISOString();

  return {
    id: 'trf-' + Math.random().toString(36).substring(2, 11),
    companyId: input.companyId,
    transferNo: `TRF-26-${String(seq).padStart(4, '0')}`,
    sourceYardId: input.sourceYardId,
    destinationYardId: input.destinationYardId,
    materialId: input.materialId,
    gradeId: input.gradeId,
    gradeName: input.gradeName,
    lotAllocations: [],
    quantityDispatched: qty,
    quantityReceived: 0,
    shortageQuantity: 0,
    excessQuantity: 0,
    dispatchWeighmentId: input.dispatchWeighmentId,
    vehicleRegistration: input.vehicleRegistration.trim().toUpperCase(),
    driverName: input.driverName,
    driverPhone: input.driverPhone,
    dispatchEmployee: input.dispatchEmployee,
    transferDate: input.transferDate,
    expectedDate: input.expectedDate,
    supportingDocumentIds: input.supportingDocumentIds || [],
    status: input.status || 'APPROVED',
    receipts: [],
    idempotencyKey: input.idempotencyKey,
    notes: input.notes,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Posts dispatch of a transfer from source godown.
 * Deducts stock ONLY from source godown (YARD_TRANSFER_OUT). Destination stock is NOT added until receipt is confirmed.
 */
export function dispatchGodownTransfer(
  transfer: GodownTransfer,
  activeLots: InventoryLot[],
  existingMovements: StockMovement[],
  actor: string,
  explicitLotRequests?: ExplicitLotRequest[]
): {
  updatedTransfer: GodownTransfer;
  updatedLots: InventoryLot[];
  newMovements: StockMovement[];
} {
  if (!['DRAFT', 'APPROVED', 'PENDING'].includes(transfer.status)) {
    throw new Error(
      `Transfer ${transfer.transferNo} cannot be dispatched from status "${transfer.status}".`
    );
  }

  let updatedLots: InventoryLot[];
  let lotAllocations: GodownTransfer['lotAllocations'];

  if (explicitLotRequests && explicitLotRequests.length > 0) {
    const exp = allocateLotsExplicit(activeLots, explicitLotRequests, {
      companyId: transfer.companyId,
      yardId: transfer.sourceYardId,
      materialId: transfer.materialId,
    });
    if (Math.abs(exp.totalAllocated - transfer.quantityDispatched) > 0.005) {
      throw new Error(
        `Transfer allocation (${exp.totalAllocated} KG) must equal dispatched quantity (${transfer.quantityDispatched} KG).`
      );
    }
    updatedLots = exp.updatedLots;
    lotAllocations = exp.allocations;
  } else {
    const fifo = allocateLotsFifo(
      activeLots,
      transfer.materialId,
      transfer.sourceYardId,
      transfer.quantityDispatched,
      transfer.companyId
    );
    updatedLots = fifo.updatedLots;
    lotAllocations = fifo.result.allocations.map((a) => {
      const orig = activeLots.find((l) => l.id === a.lotId);
      return {
        id: 'talloc-' + Math.random().toString(36).substring(2, 10),
        lotId: a.lotId,
        lotNumber: a.lotNumber,
        sourceType: orig?.sourceType || 'PURCHASE',
        supplierPartyId: orig?.supplierPartyId,
        supplierName: orig?.supplierName,
        sourcePurchaseId: orig?.sourcePurchaseId,
        originalInvoiceNo: orig?.originalInvoiceNo,
        allocatedQuantity: a.allocatedQuantity,
        unitCost: a.unitCost,
        totalCost: a.totalCost,
      };
    });
  }

  const allMovements = [...existingMovements];
  const createdMovements: StockMovement[] = [];

  for (const alloc of lotAllocations) {
    const mov = createStockMovement(allMovements, {
      companyId: transfer.companyId,
      movementType: 'YARD_TRANSFER_OUT',
      transactionRef: transfer.transferNo,
      materialId: transfer.materialId,
      gradeId: transfer.gradeId,
      yardId: transfer.sourceYardId,
      lotId: alloc.lotId,
      quantity: -alloc.allocatedQuantity,
      unitCost: alloc.unitCost,
      notes: `Internal transfer out ${transfer.transferNo} to yard ${transfer.destinationYardId} from lot ${alloc.lotNumber}`,
      createdBy: actor,
    });
    allMovements.push(mov);
    createdMovements.push(mov);
  }

  const updatedTransfer: GodownTransfer = {
    ...transfer,
    lotAllocations,
    status: 'IN_TRANSIT',
    updatedAt: new Date().toISOString(),
  };

  return { updatedTransfer, updatedLots, newMovements: createdMovements };
}

/**
 * Confirms full or partial receipt of an IN_TRANSIT or PARTIALLY_RECEIVED transfer at destination godown.
 * Adds stock ONLY when receipt is confirmed (YARD_TRANSFER_IN), prevents duplicate receipts via idempotencyKey,
 * and tracks shortages, excess receipts, and source-supplier traceability on the destination lot.
 */
export function receiveGodownTransfer(
  transfer: GodownTransfer,
  params: {
    receivedQuantity: number;
    receivedDate: string;
    receivingEmployee: string;
    receivingWeighmentId?: string;
    idempotencyKey?: string;
    finalizeWithShortage?: boolean;
    notes?: string;
  },
  existingLots: InventoryLot[],
  existingMovements: StockMovement[]
): {
  updatedTransfer: GodownTransfer;
  receipt: GodownTransferReceipt;
  newDestinationLot: InventoryLot;
  newMovement: StockMovement;
} {
  if (!['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(transfer.status)) {
    throw new Error(
      `Transfer ${transfer.transferNo} cannot accept receipts in status "${transfer.status}". Duplicate or invalid receipt blocked.`
    );
  }

  const recvQty = roundTo3(params.receivedQuantity);
  if (recvQty <= 0) {
    throw new Error('Received quantity must be greater than zero.');
  }

  // Prevent duplicate receipt via idempotencyKey
  if (
    params.idempotencyKey &&
    transfer.receipts.some((r) => r.idempotencyKey === params.idempotencyKey)
  ) {
    throw new Error(
      `Duplicate receipt prevented: receipt key "${params.idempotencyKey}" already recorded for ${transfer.transferNo}.`
    );
  }

  const totalReceived = roundTo3(transfer.quantityReceived + recvQty);
  const diff = roundTo3(totalReceived - transfer.quantityDispatched);
  const shortageQuantity = diff < 0 ? roundTo3(Math.abs(diff)) : 0;
  const excessQuantity = diff > 0 ? roundTo3(diff) : 0;

  let nextStatus: GodownTransferStatus;
  if (diff < -0.001) {
    nextStatus = params.finalizeWithShortage ? 'DISPUTED' : 'PARTIALLY_RECEIVED';
  } else if (diff > 0.001) {
    nextStatus = 'DISPUTED'; // Flag excess for owner review while still recording received stock
  } else {
    nextStatus = 'RECEIVED';
  }

  const receiptSeq = transfer.receipts.length + 1;
  const receiptNo = `${transfer.transferNo}-RCV-${String(receiptSeq).padStart(2, '0')}`;
  const now = new Date().toISOString();

  // Compute weighted average unit cost & preserve source traceability from dispatched lots
  const totalAllocQty = transfer.lotAllocations.reduce((s, a) => s + a.allocatedQuantity, 0);
  const totalAllocCost = transfer.lotAllocations.reduce((s, a) => s + a.totalCost, 0);
  const weightedUnitCost = totalAllocQty > 0 ? roundTo2(totalAllocCost / totalAllocQty) : 0;
  const primarySource = transfer.lotAllocations[0];

  const newDestinationLot: InventoryLot = {
    id: 'lot-trf-' + Math.random().toString(36).substring(2, 10),
    companyId: transfer.companyId,
    lotNumber: `LOT-${receiptNo}`,
    materialId: transfer.materialId,
    gradeId: transfer.gradeId,
    gradeName: transfer.gradeName,
    yardId: transfer.destinationYardId,
    sourceType: 'TRANSFER_IN',
    sourceTransferId: transfer.id,
    sourcePurchaseId: primarySource?.sourcePurchaseId,
    supplierPartyId: primarySource?.supplierPartyId,
    supplierName: primarySource?.supplierName
      ? `${primarySource.supplierName} (via ${transfer.transferNo})`
      : `Transfer ${transfer.transferNo}`,
    originalInvoiceNo: primarySource?.originalInvoiceNo || transfer.transferNo,
    initialQuantity: recvQty,
    allocatedQuantity: 0,
    dispatchedQuantity: 0,
    returnedQuantity: 0,
    remainingQuantity: recvQty,
    unitCost: weightedUnitCost,
    receivedAt: now,
    isExhausted: false,
  };

  const newMovement = createStockMovement(existingMovements, {
    companyId: transfer.companyId,
    movementType: 'YARD_TRANSFER_IN',
    transactionRef: transfer.transferNo,
    materialId: transfer.materialId,
    gradeId: transfer.gradeId,
    yardId: transfer.destinationYardId,
    lotId: newDestinationLot.id,
    quantity: recvQty,
    unitCost: weightedUnitCost,
    notes: `Transfer receipt ${receiptNo} (${recvQty} KG received${shortageQuantity > 0 ? `, shortage ${shortageQuantity} KG` : ''}${excessQuantity > 0 ? `, excess ${excessQuantity} KG` : ''})`,
    createdBy: params.receivingEmployee,
  });

  const receipt: GodownTransferReceipt = {
    id: 'trcv-' + Math.random().toString(36).substring(2, 10),
    receiptNo,
    receivedDate: params.receivedDate,
    receivedQuantity: recvQty,
    shortageQuantity,
    excessQuantity,
    receivingWeighmentId: params.receivingWeighmentId,
    receivingEmployee: params.receivingEmployee,
    idempotencyKey: params.idempotencyKey,
    notes: params.notes,
    createdAt: now,
  };

  const updatedTransfer: GodownTransfer = {
    ...transfer,
    quantityReceived: totalReceived,
    shortageQuantity,
    excessQuantity,
    receivingWeighmentId: params.receivingWeighmentId || transfer.receivingWeighmentId,
    receivingEmployee: params.receivingEmployee,
    receivingDate: params.receivedDate,
    status: nextStatus,
    disputeReason:
      nextStatus === 'DISPUTED'
        ? excessQuantity > 0
          ? `Excess receipt of ${excessQuantity} KG recorded.`
          : `Shortage of ${shortageQuantity} KG finalized as dispute.`
        : transfer.disputeReason,
    receipts: [...transfer.receipts, receipt],
    updatedAt: now,
  };

  // Ensure existingLots reference is not unused (caller adds newDestinationLot)
  void existingLots;

  return { updatedTransfer, receipt, newDestinationLot, newMovement };
}

export function flagTransferDispute(transfer: GodownTransfer, reason: string): GodownTransfer {
  if (!reason.trim()) {
    throw new Error('Dispute reason is required.');
  }
  return {
    ...transfer,
    status: 'DISPUTED',
    disputeReason: reason.trim(),
    updatedAt: new Date().toISOString(),
  };
}

export function cancelGodownTransfer(transfer: GodownTransfer, reason?: string): GodownTransfer {
  if (['RECEIVED', 'PARTIALLY_RECEIVED', 'IN_TRANSIT'].includes(transfer.status)) {
    throw new Error(
      `Cannot cancel transfer ${transfer.transferNo} after stock dispatch/receipt (status: ${transfer.status}). Raise a dispute or reversal instead.`
    );
  }
  return {
    ...transfer,
    status: 'CANCELLED',
    notes: reason ? `${transfer.notes ? transfer.notes + ' | ' : ''}Cancelled: ${reason}` : transfer.notes,
    updatedAt: new Date().toISOString(),
  };
}
