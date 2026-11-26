// Yasoth Enterprises Scrap ERP — Sales, Dispatch & Invoice Generation Rules Engine
// Enforces stock availability checks, FIFO lot allocation, COGS computation, and immutable invoice snapshot creation

import type { 
  SalesHeader, 
  InventoryLot, 
  StockMovement, 
  Invoice, 
  InvoiceLine, 
  Party, 
  CompanySettings,
  Material
} from '../../src/types/index.ts';
import { 
  roundTo2, 
  roundTo3, 
  calcGstBreakdown, 
  numberToIndianWords 
} from '../../src/utils/calculations.ts';
import { allocateLotsFifo, allocateLotsExplicit, createStockMovement } from './inventoryEngine.ts';

export interface DispatchSalesResult {
  updatedSales: SalesHeader;
  updatedLots: InventoryLot[];
  newMovements: StockMovement[];
  generatedInvoice: Invoice;
}

export function dispatchSalesTransaction(
  sales: SalesHeader,
  activeLots: InventoryLot[],
  existingMovements: StockMovement[],
  customer: Party,
  company: CompanySettings,
  nextInvoiceSequence: number,
  actor: string,
  materials?: Material[]
): DispatchSalesResult {
  if (sales.status === 'DISPATCHED' || sales.status === 'INVOICED') {
    throw new Error(`Sales order ${sales.salesNo} has already been dispatched.`);
  }

  if (sales.status === 'CANCELLED') {
    throw new Error(`Cannot dispatch cancelled sales order ${sales.salesNo}.`);
  }

  if (!sales.lines || sales.lines.length === 0) {
    throw new Error(`Sales order ${sales.salesNo} has no material lines.`);
  }

  const now = new Date().toISOString();
  let currentLots = [...activeLots];
  const createdMovements: StockMovement[] = [];
  const allMovements = [...existingMovements];
  let totalOrderCogs = 0;

  const updatedLines = sales.lines.map((line) => {
    let allocationsOut: {
      lotId: string;
      lotNumber: string;
      allocatedQuantity: number;
      unitCost: number;
      totalCost: number;
    }[] = [];

    if (line.lotAllocations && line.lotAllocations.length > 0) {
      const explicit = allocateLotsExplicit(
        currentLots,
        line.lotAllocations.map((a) => ({ lotId: a.lotId, quantity: a.allocatedQuantity })),
        { companyId: sales.companyId, yardId: sales.yardId, materialId: line.materialId }
      );
      if (Math.abs(explicit.totalAllocated - roundTo3(line.quantity)) > 0.005) {
        throw new Error(
          `Explicit lot allocation total (${explicit.totalAllocated} KG) does not match line quantity (${line.quantity} KG).`
        );
      }
      currentLots = explicit.updatedLots;
      totalOrderCogs = roundTo2(totalOrderCogs + explicit.totalCogs);
      allocationsOut = explicit.allocations.map((a) => ({
        lotId: a.lotId,
        lotNumber: a.lotNumber,
        allocatedQuantity: a.allocatedQuantity,
        unitCost: a.unitCost,
        totalCost: a.totalCost,
      }));
    } else {
      const { updatedLots, result } = allocateLotsFifo(
        currentLots,
        line.materialId,
        sales.yardId,
        line.quantity,
        sales.companyId
      );
      currentLots = updatedLots;
      totalOrderCogs = roundTo2(totalOrderCogs + result.totalCogs);
      allocationsOut = result.allocations;
    }

    // Create outward movements for each lot allocation
    for (const alloc of allocationsOut) {
      const outwardMovement = createStockMovement(allMovements, {
        companyId: sales.companyId,
        movementType: 'SALES_DISPATCH',
        transactionRef: sales.salesNo,
        materialId: line.materialId,
        gradeId: line.gradeId,
        yardId: sales.yardId,
        lotId: alloc.lotId,
        quantity: -roundTo3(alloc.allocatedQuantity),
        unitCost: alloc.unitCost,
        notes: `Dispatch for ${sales.salesNo} from Lot ${alloc.lotNumber}`,
        createdBy: actor,
      });

      allMovements.push(outwardMovement);
      createdMovements.push(outwardMovement);
    }

    return {
      ...line,
      lotAllocations: allocationsOut.map((a) => ({
        id: 'sla-' + Math.random().toString(36).substring(2, 9),
        ...a,
      })),
    };
  });

  // Calculate invoice values using actual line GST rate (default 18% if omitted)
  const isInterState = customer.stateCode !== company.stateCode;
  const taxableSum = updatedLines.reduce((sum, l) => sum + l.taxableAmount, 0);
  const effectiveGstRate = updatedLines[0]?.gstRate ?? 18;
  const gstBreakdown = calcGstBreakdown(taxableSum, effectiveGstRate, isInterState);

  const formattedSeq = String(nextInvoiceSequence).padStart(4, '0');
  const invoiceNo = `${company.invoicePrefix || 'YE/'}26-27/${formattedSeq}`;

  const invoiceLines: InvoiceLine[] = updatedLines.map((l, i) => {
    const mat = materials?.find((m) => m.id === l.materialId);
    return {
      id: 'invl-' + Math.random().toString(36).substring(2, 9),
      serialNo: i + 1,
      descriptionOfGoods: mat?.name || 'MS BORING SCRAP',
      hsnSac: mat?.hsnCode || '7204',
      unit: mat?.baseUnit || company.defaultBaseUnit || 'KG',
      quantity: roundTo3(l.quantity),
      rate: roundTo2(l.ratePerUnit),
      taxableValue: roundTo2(l.taxableAmount),
    };
  });

  const invoiceSnapshot: Invoice = {
    id: 'inv-' + Math.random().toString(36).substring(2, 11),
    companyId: sales.companyId || company.id,
    invoiceNo,
    invoiceDate: now.split('T')[0],
    salesHeaderId: sales.id,
    customerPartyId: customer.id,
    customerName: customer.legalName,
    billingAddress: `${customer.addressLine1}, ${customer.city}, ${customer.stateName} - ${customer.stateCode}`,
    shippingAddress: `${customer.addressLine1}, ${customer.city}, ${customer.stateName} - ${customer.stateCode}`,
    customerGstin: customer.gstin,
    customerStateName: customer.stateName,
    customerStateCode: customer.stateCode,
    placeOfSupply: `${customer.stateName} (${customer.stateCode})`,
    ewayBillNo: '5618 1991 ' + Math.floor(1000 + Math.random() * 9000),
    deliveryNote: 'Delivery Note - ' + sales.salesNo,
    vehicleRegistration: sales.vehicleRegistration,
    lines: invoiceLines,
    subtotalTaxable: gstBreakdown.taxableAmount,
    cgstRate: gstBreakdown.cgstRate,
    cgstAmount: gstBreakdown.cgstAmount,
    sgstRate: gstBreakdown.sgstRate,
    sgstAmount: gstBreakdown.sgstAmount,
    igstRate: gstBreakdown.igstRate,
    igstAmount: gstBreakdown.igstAmount,
    roundOff: gstBreakdown.roundOff,
    grandTotal: gstBreakdown.grandTotal,
    amountInWords: numberToIndianWords(gstBreakdown.grandTotal),
    taxAmountInWords: numberToIndianWords(gstBreakdown.totalTax),
    paymentStatus: 'UNPAID',
    amountPaid: 0.0,
    outstandingBalance: gstBreakdown.grandTotal,
    immutableSnapshotJson: '', // assigned below
    isCancelled: false,
    createdBy: actor,
    createdAt: now,
  };

  // Embed the permanent immutable snapshot
  invoiceSnapshot.immutableSnapshotJson = JSON.stringify(invoiceSnapshot);

  const updatedSales: SalesHeader = {
    ...sales,
    lines: updatedLines,
    status: 'DISPATCHED',
    allocatedCogs: totalOrderCogs,
    invoiceId: invoiceSnapshot.id,
    dispatchedAt: now,
  };

  return {
    updatedSales,
    updatedLots: currentLots,
    newMovements: createdMovements,
    generatedInvoice: invoiceSnapshot,
  };
}
