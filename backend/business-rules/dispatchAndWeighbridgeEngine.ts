// Yasoth Enterprises Scrap ERP — Phase 2 Material Dispatch & Weighbridge Management Engine
// Supports multi-source lot allocation in a single truck dispatch, weighbridge verification,
// duplicate slip detection via SHA-256 checksum & bill/vehicle details, and exact reconciliation.

import type {
  InventoryLot,
  StockMovement,
  Weighment,
  MaterialDispatch,
  MaterialDispatchAllocation,
} from '../../src/types/index.ts';
import { calcNetWeight, calcPayableWeight, roundTo2, roundTo3 } from '../../src/utils/calculations.ts';
import { allocateLotsExplicit, createStockMovement, type ExplicitLotRequest } from './inventoryEngine.ts';
import { calculateSHA256 } from './backupEngine.ts';

export interface WeighbridgeDuplicateCheck {
  isDuplicate: boolean;
  reason?: string;
  matchedWeighmentId?: string;
}

/**
 * Normalizes vehicle registration for reliable matching (e.g. "TN 18 BY 0420" -> "TN18BY0420").
 */
export function normalizeVehicleNo(raw?: string): string {
  return (raw || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Computes a deterministic SHA-256 checksum for a weighbridge slip attachment or payload.
 */
export async function computeWeighbridgeSlipChecksum(slipData: string): Promise<string> {
  return calculateSHA256(slipData);
}

/**
 * Detects duplicate weighbridge slips using document checksum AND transaction details
 * (companyId + billNumber + vehicleRegistration + date).
 */
export function detectDuplicateWeighbridgeSlip(
  candidate: {
    companyId?: string;
    billNumber?: string;
    slipReference?: string;
    vehicleRegistration?: string;
    weighmentDate?: string;
    grossWeight: number;
    tareWeight: number;
    slipChecksum?: string;
  },
  existingWeighments: Weighment[]
): WeighbridgeDuplicateCheck {
  const candVeh = normalizeVehicleNo(candidate.vehicleRegistration);
  const candBill = (candidate.billNumber || candidate.slipReference || '').trim().toUpperCase();
  const candDate = (candidate.weighmentDate || '').slice(0, 10);

  for (const w of existingWeighments) {
    if (candidate.companyId && w.companyId && w.companyId !== candidate.companyId) {
      continue;
    }

    // 1. Exact SHA-256 document checksum match
    if (candidate.slipChecksum && w.slipChecksum && candidate.slipChecksum === w.slipChecksum) {
      return {
        isDuplicate: true,
        reason: `Duplicate weighbridge slip attachment detected (identical SHA-256 checksum with ${w.weighmentNo}).`,
        matchedWeighmentId: w.id,
      };
    }

    // 2. Transaction details match: Bill Number + Vehicle + Date (or Bill Number + identical weights)
    const existBill = (w.billNumber || w.slipReference || '').trim().toUpperCase();
    const existVeh = normalizeVehicleNo(w.vehicleRegistration);
    const existDate = (w.weighmentDate || w.createdAt || '').slice(0, 10);

    if (candBill && existBill && candBill === existBill) {
      if (candVeh && existVeh && candVeh === existVeh && (!candDate || !existDate || candDate === existDate)) {
        return {
          isDuplicate: true,
          reason: `Duplicate weighbridge slip: Bill #${candBill} for vehicle ${candVeh} on ${existDate} already exists (${w.weighmentNo}).`,
          matchedWeighmentId: w.id,
        };
      }
      if (
        Math.abs(w.grossWeight - candidate.grossWeight) < 0.001 &&
        Math.abs(w.tareWeight - candidate.tareWeight) < 0.001
      ) {
        return {
          isDuplicate: true,
          reason: `Duplicate weighbridge slip: Bill #${candBill} with identical weights (${candidate.grossWeight}/${candidate.tareWeight} KG) already exists (${w.weighmentNo}).`,
          matchedWeighmentId: w.id,
        };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Validates and constructs a Weighbridge Slip entry.
 * Enforces Net Weight = Gross - Tare and prevents posting unverified OCR entries directly to stock.
 */
export function createVerifiedWeighbridgeRecord(
  params: {
    companyId: string;
    billNumber: string;
    weighbridgeName: string;
    weighbridgeLocation?: string;
    partyId?: string;
    partyName?: string;
    vehicleRegistration: string;
    firstWeight: number;
    secondWeight: number;
    approvedDeductions?: number;
    weighbridgeCharge?: number;
    weighmentDate: string;
    firstWeightTime?: string;
    secondWeightTime?: string;
    operatorName: string;
    slipChecksum?: string;
    slipAttachmentId?: string;
    ocrExtracted?: boolean;
    isUserVerified?: boolean;
    transactionType?: Weighment['transactionType'];
    notes?: string;
  },
  existingWeighments: Weighment[]
): Weighment {
  const grossWeight = Math.max(params.firstWeight, params.secondWeight);
  const tareWeight = Math.min(params.firstWeight, params.secondWeight);
  const netWeight = calcNetWeight(grossWeight, tareWeight);
  const deductions = params.approvedDeductions || 0;
  const payableWeight = calcPayableWeight(grossWeight, tareWeight, deductions);

  const dup = detectDuplicateWeighbridgeSlip(
    {
      companyId: params.companyId,
      billNumber: params.billNumber,
      vehicleRegistration: params.vehicleRegistration,
      weighmentDate: params.weighmentDate,
      grossWeight,
      tareWeight,
      slipChecksum: params.slipChecksum,
    },
    existingWeighments
  );
  if (dup.isDuplicate) {
    throw new Error(dup.reason || 'Duplicate weighbridge slip detected.');
  }

  const verified = params.ocrExtracted ? Boolean(params.isUserVerified) : true;
  const seq = existingWeighments.length + 1;

  return {
    id: 'wm-' + Math.random().toString(36).substring(2, 11),
    companyId: params.companyId,
    weighmentNo: `WM-26-${String(seq).padStart(4, '0')}`,
    weighingMethod: 'WEIGHBRIDGE_SLIP',
    slipReference: params.billNumber,
    billNumber: params.billNumber,
    weighbridgeName: params.weighbridgeName,
    weighbridgeLocation: params.weighbridgeLocation,
    partyId: params.partyId,
    partyName: params.partyName,
    weighbridgeCharge: roundTo2(params.weighbridgeCharge || 0),
    vehicleRegistration: normalizeVehicleNo(params.vehicleRegistration),
    grossWeight: roundTo3(grossWeight),
    tareWeight: roundTo3(tareWeight),
    netWeight,
    approvedDeductions: roundTo3(deductions),
    payableWeight,
    unit: 'KG',
    weighmentDate: params.weighmentDate,
    firstWeightTime: params.firstWeightTime,
    secondWeightTime: params.secondWeightTime,
    operatorName: params.operatorName,
    slipAttachmentId: params.slipAttachmentId,
    slipChecksum: params.slipChecksum,
    ocrExtracted: Boolean(params.ocrExtracted),
    ocrVerifiedBy: verified && params.ocrExtracted ? params.operatorName : undefined,
    ocrVerifiedAt: verified && params.ocrExtracted ? new Date().toISOString() : undefined,
    transactionType: params.transactionType,
    verificationStatus: verified ? 'VERIFIED' : 'PENDING',
    notes: params.notes,
    createdAt: new Date().toISOString(),
  };
}

export interface MultiSourceDispatchInput {
  companyId: string;
  dispatchNo?: string;
  customerPartyId?: string;
  destinationName: string;
  destinationYardId?: string;
  materialId: string;
  gradeId?: string;
  gradeName?: string;
  vehicleRegistration: string;
  driverName?: string;
  driverPhone?: string;
  dispatchDateTime: string;
  expectedCompletionDate?: string;
  sourceYardId: string;
  grossWeight: number;
  tareWeight: number;
  lotRequests: ExplicitLotRequest[];
  weighment?: Weighment;
  weighbridgeBillNo?: string;
  weighbridgeName?: string;
  weighbridgeLocation?: string;
  weighbridgeCharge?: number;
  deliveryChallanNo?: string;
  salesHeaderId?: string;
  invoiceId?: string;
  dispatchEmployee: string;
  idempotencyKey?: string;
  allowDiscrepancy?: boolean;
  notes?: string;
}

export interface MultiSourceDispatchResult {
  dispatch: MaterialDispatch;
  updatedLots: InventoryLot[];
  newMovements: StockMovement[];
  lotReconciliation: {
    lotId: string;
    lotNumber: string;
    supplierName?: string;
    originalInvoiceNo?: string;
    beforeRemaining: number;
    allocated: number;
    afterRemaining: number;
  }[];
  discrepancy: number;
  isReconciled: boolean;
}

/**
 * Executes a consolidated Multi-Source Material Dispatch (Phase 2.1 & 2.2):
 * 1. Creates ONE consolidated dispatch header.
 * 2. Creates individual stock allocation records for every source lot (e.g. IMOP + IMH + Godown).
 * 3. Deducts each quantity from its exact verified stock lot.
 * 4. Verifies total allocated weight against dispatch net weight (gross - tare).
 * 5. Preserves purchase-source traceability via append-only SALES_DISPATCH movements.
 * 6. Prevents duplicate posting via idempotencyKey and unverified weighbridge OCR guard.
 */
export function postMultiSourceDispatch(
  input: MultiSourceDispatchInput,
  activeLots: InventoryLot[],
  existingMovements: StockMovement[],
  existingDispatches: MaterialDispatch[],
  actor: string
): MultiSourceDispatchResult {
  // Idempotency / duplicate dispatch prevention
  if (input.idempotencyKey) {
    const existing = existingDispatches.find(
      (d) => d.companyId === input.companyId && d.idempotencyKey === input.idempotencyKey
    );
    if (existing) {
      throw new Error(
        `Duplicate dispatch prevented: idempotency key "${input.idempotencyKey}" already posted as ${existing.dispatchNo}.`
      );
    }
  }

  // OCR / Weighment verification gate
  if (input.weighment && input.weighment.verificationStatus !== 'VERIFIED') {
    throw new Error(
      `Weighbridge slip ${input.weighment.billNumber || input.weighment.weighmentNo} is ${input.weighment.verificationStatus}. User verification is required before posting stock dispatch.`
    );
  }

  // Vehicle matching validation when weighment is linked
  if (input.weighment?.vehicleRegistration && input.vehicleRegistration) {
    const wVeh = normalizeVehicleNo(input.weighment.vehicleRegistration);
    const dVeh = normalizeVehicleNo(input.vehicleRegistration);
    if (wVeh && dVeh && wVeh !== dVeh) {
      throw new Error(
        `Vehicle mismatch: Dispatch vehicle "${dVeh}" does not match weighbridge slip vehicle "${wVeh}".`
      );
    }
  }

  const netWeight = calcNetWeight(input.grossWeight, input.tareWeight);
  if (netWeight <= 0) {
    throw new Error('Dispatch net weight must be greater than zero.');
  }

  // Snapshot before quantities for reconciliation
  const beforeMap = new Map(activeLots.map((l) => [l.id, l.remainingQuantity]));

  // Allocate across all specified verified source lots (does NOT allow negative stock)
  const { updatedLots, allocations, totalAllocated } = allocateLotsExplicit(
    activeLots,
    input.lotRequests,
    { companyId: input.companyId, yardId: input.sourceYardId }
  );

  const discrepancy = roundTo3(totalAllocated - netWeight);
  const isReconciled = Math.abs(discrepancy) < 0.001;

  if (!isReconciled && !input.allowDiscrepancy) {
    throw new Error(
      `Weight reconciliation mismatch: Total allocated stock (${totalAllocated} KG) differs from dispatch net weight (${netWeight} KG) by ${discrepancy > 0 ? '+' : ''}${discrepancy} KG.`
    );
  }

  const seq = existingDispatches.length + 1;
  const dispatchNo = input.dispatchNo || `DSP-26-${String(seq).padStart(4, '0')}`;
  const now = new Date().toISOString();

  // Create append-only outward stock movements per source lot
  const allMovements = [...existingMovements];
  const createdMovements: StockMovement[] = [];
  const dispatchAllocations: MaterialDispatchAllocation[] = [];

  for (const alloc of allocations) {
    const lot = updatedLots.find((l) => l.id === alloc.lotId)!;
    const mov = createStockMovement(allMovements, {
      companyId: input.companyId,
      movementType: 'SALES_DISPATCH',
      transactionRef: dispatchNo,
      materialId: lot.materialId,
      gradeId: lot.gradeId || input.gradeId,
      yardId: input.sourceYardId,
      lotId: alloc.lotId,
      quantity: -alloc.allocatedQuantity,
      unitCost: alloc.unitCost,
      notes: `Dispatch ${dispatchNo} to ${input.destinationName} | Source: ${alloc.supplierName || alloc.sourceType} (${alloc.lotNumber}${alloc.originalInvoiceNo ? `, Inv ${alloc.originalInvoiceNo}` : ''})`,
      createdBy: actor,
    });
    allMovements.push(mov);
    createdMovements.push(mov);
    dispatchAllocations.push(alloc);
  }

  const dispatch: MaterialDispatch = {
    id: 'dsp-' + Math.random().toString(36).substring(2, 11),
    companyId: input.companyId,
    dispatchNo,
    customerPartyId: input.customerPartyId,
    destinationName: input.destinationName,
    destinationYardId: input.destinationYardId,
    materialId: input.materialId,
    gradeId: input.gradeId,
    gradeName: input.gradeName,
    vehicleRegistration: normalizeVehicleNo(input.vehicleRegistration),
    driverName: input.driverName,
    driverPhone: input.driverPhone,
    dispatchDateTime: input.dispatchDateTime,
    expectedCompletionDate: input.expectedCompletionDate,
    sourceYardId: input.sourceYardId,
    allocations: dispatchAllocations,
    grossWeight: roundTo3(input.grossWeight),
    tareWeight: roundTo3(input.tareWeight),
    netWeight,
    totalAllocatedWeight: totalAllocated,
    weightDiscrepancy: discrepancy,
    weighmentId: input.weighment?.id,
    weighbridgeBillNo: input.weighbridgeBillNo || input.weighment?.billNumber,
    weighbridgeName: input.weighbridgeName || input.weighment?.weighbridgeName,
    weighbridgeLocation: input.weighbridgeLocation || input.weighment?.weighbridgeLocation,
    weighbridgeCharge: input.weighbridgeCharge ?? input.weighment?.weighbridgeCharge,
    deliveryChallanNo: input.deliveryChallanNo || `DC-${dispatchNo}`,
    salesHeaderId: input.salesHeaderId,
    invoiceId: input.invoiceId,
    dispatchEmployee: input.dispatchEmployee,
    approvalStatus: isReconciled ? 'DISPATCHED' : 'DISPUTED',
    status: isReconciled ? 'IN_TRANSIT' : 'DISPUTED',
    unloadingStatus: 'PENDING',
    idempotencyKey: input.idempotencyKey,
    notes: input.notes,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };

  const lotReconciliation = dispatchAllocations.map((a) => {
    const afterLot = updatedLots.find((l) => l.id === a.lotId);
    return {
      lotId: a.lotId,
      lotNumber: a.lotNumber,
      supplierName: a.supplierName,
      originalInvoiceNo: a.originalInvoiceNo,
      beforeRemaining: roundTo3(beforeMap.get(a.lotId) || 0),
      allocated: a.allocatedQuantity,
      afterRemaining: roundTo3(afterLot?.remainingQuantity || 0),
    };
  });

  return {
    dispatch,
    updatedLots,
    newMovements: createdMovements,
    lotReconciliation,
    discrepancy,
    isReconciled,
  };
}

/**
 * Posts a Customer Sales Return back into yard stock with traceable return lot.
 */
export function postSalesReturn(params: {
  companyId: string;
  returnRef: string;
  materialId: string;
  gradeId?: string;
  yardId: string;
  returnQuantity: number;
  unitCost: number;
  customerName?: string;
  existingMovements: StockMovement[];
  actor: string;
  reason: string;
}): { newLot: InventoryLot; movement: StockMovement } {
  const qty = roundTo3(params.returnQuantity);
  if (qty <= 0) {
    throw new Error('Sales return quantity must be greater than zero.');
  }

  const now = new Date().toISOString();
  const newLot: InventoryLot = {
    id: 'lot-sret-' + Math.random().toString(36).substring(2, 10),
    companyId: params.companyId,
    lotNumber: `LOT-SRET-${params.returnRef}`,
    materialId: params.materialId,
    gradeId: params.gradeId,
    yardId: params.yardId,
    sourceType: 'SALES_RETURN',
    supplierName: params.customerName ? `Return from ${params.customerName}` : 'Customer Return',
    originalInvoiceNo: params.returnRef,
    initialQuantity: qty,
    allocatedQuantity: 0,
    dispatchedQuantity: 0,
    returnedQuantity: qty,
    remainingQuantity: qty,
    unitCost: roundTo2(params.unitCost),
    receivedAt: now,
    isExhausted: false,
  };

  const movement = createStockMovement(params.existingMovements, {
    companyId: params.companyId,
    movementType: 'SALES_RETURN',
    transactionRef: params.returnRef,
    materialId: params.materialId,
    gradeId: params.gradeId,
    yardId: params.yardId,
    lotId: newLot.id,
    quantity: qty,
    unitCost: params.unitCost,
    notes: `Sales Return (${params.returnRef}). Reason: ${params.reason}`,
    createdBy: params.actor,
  });

  return { newLot, movement };
}
