import { describe, it, expect } from 'vitest';
import type {
  InventoryLot,
  StockMovement,
  PurchaseHeader,
  Weighment,
  MaterialDispatch,
  GodownTransfer,
} from '../src/types/index.ts';
import {
  allocateLotsExplicit,
  computeStockLedgerSummary,
  createStockMovement,
  verifyInternalTransferNeutrality,
} from '../backend/business-rules/inventoryEngine.ts';
import { postPurchaseTransaction, postPurchaseReturn } from '../backend/business-rules/purchaseEngine.ts';
import {
  createVerifiedWeighbridgeRecord,
  computeWeighbridgeSlipChecksum,
  detectDuplicateWeighbridgeSlip,
  postMultiSourceDispatch,
  postSalesReturn,
} from '../backend/business-rules/dispatchAndWeighbridgeEngine.ts';
import {
  createGodownTransfer,
  dispatchGodownTransfer,
  receiveGodownTransfer,
  flagTransferDispute,
  cancelGodownTransfer,
} from '../backend/business-rules/transferEngine.ts';

const COMPANY_ID = 'comp-ye-001';
const YARD_MAIN = 'yard-main';
const YARD_NORTH = 'yard-north';
const MAT_MS_STRIP = 'mat-9988-packing-strip';
const MAT_MS_SCRAP = 'mat-ms-scrap';

describe('Phases 1, 2 & 3 — Material Inventory Traceability, Multi-Source Dispatch, Weighbridge & Transfers', () => {
  describe('MANDATORY REAL-WORLD ACCEPTANCE TEST — IMOP Purchase + Vinoth Godown Dispatch (3,530 KG)', () => {
    it('reconciles 3,530 KG Vinoth dispatch across IMOP (1,580 KG) + verified IMH (1,150 KG) + Existing Godown (800 KG) with 0 KG difference', async () => {
      const stockMovements: StockMovement[] = [];
      const lots: InventoryLot[] = [];
      const weighments: Weighment[] = [];
      const dispatches: MaterialDispatch[] = [];

      // 1. Seed verified Opening Godown MS Scrap lot (1,200 KG available)
      const openingGodownLot: InventoryLot = {
        id: 'lot-godown-open-01',
        companyId: COMPANY_ID,
        lotNumber: 'LOT-OPEN-GODOWN-MS-01',
        materialId: MAT_MS_SCRAP,
        yardId: YARD_MAIN,
        sourceType: 'OPENING_STOCK',
        supplierName: 'Existing Godown Stock (Verified Opening)',
        originalInvoiceNo: 'OPEN-FY26-01',
        initialQuantity: 1200,
        allocatedQuantity: 0,
        dispatchedQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 1200,
        unitCost: 27.5,
        receivedAt: '2026-11-01T08:00:00.000Z',
        isExhausted: false,
      };
      lots.push(openingGodownLot);
      stockMovements.push(
        createStockMovement(stockMovements, {
          companyId: COMPANY_ID,
          movementType: 'OPENING_STOCK',
          transactionRef: 'OPEN-FY26-01',
          materialId: MAT_MS_SCRAP,
          yardId: YARD_MAIN,
          lotId: openingGodownLot.id,
          quantity: 1200,
          unitCost: 27.5,
          createdBy: 'Prop. P. Nandha Kumar',
        })
      );

      // 2. Post IMH MS Scrap Purchase Inward (2,000 KG received)
      const imhPurchase: PurchaseHeader = {
        id: 'pur-imh-001',
        companyId: COMPANY_ID,
        purchaseNo: 'PUR-IMH-2026-01',
        poNumber: 'PO-IMH-18',
        supplierInvoiceNo: 'IMH-INV-2026-441',
        supplierInvoiceDate: '2026-11-25',
        transactionDate: '2026-11-25T10:00:00.000Z',
        supplierPartyId: 'party-imh',
        supplierName: 'IMH Steel Scrap Supplier',
        sourceType: 'DIRECT_SUPPLIER',
        yardId: YARD_MAIN,
        vehicleRegistration: 'TN18BY0420',
        grossWeight: 6460,
        tareWeight: 4460,
        netWeight: 2000,
        acceptedWeight: 2000,
        rejectedWeight: 0,
        paymentStatus: 'UNPAID',
        isUserVerified: true,
        lines: [
          {
            id: 'pl-imh-1',
            materialId: MAT_MS_SCRAP,
            grossWeight: 6460,
            tareWeight: 4460,
            netWeight: 2000,
            deductions: 0,
            payableWeight: 2000,
            ratePerUnit: 28.0,
            gstRate: 18,
            taxableAmount: 56000,
            gstAmount: 10080,
            totalAmount: 66080,
          },
        ],
        subtotalAmount: 56000,
        taxAmount: 10080,
        otherCharges: 0,
        totalAmount: 66080,
        amountPaid: 0,
        outstandingBalance: 66080,
        status: 'APPROVED',
        createdBy: 'Prop. P. Nandha Kumar',
        createdAt: '2026-11-25T10:00:00.000Z',
      };
      const imhPosted = postPurchaseTransaction(imhPurchase, stockMovements, 'Prop. P. Nandha Kumar');
      lots.push(...imhPosted.newLots);
      stockMovements.push(...imhPosted.newMovements);
      const imhLot = imhPosted.newLots[0];

      // 3. Post IMOP Purchase Inward (Exact Real-World Data from Phase 2.4)
      // India Metal One Steel Plate Processing Pvt Ltd | 9988 / Packing Steel Strip | TN18BY0420 | IN4202605071 | PO 64-2026
      // Gross: 6,040 KG | Tare: 4,460 KG | Net: 1,580 KG | Invoice Total: ₹53,247.26
      const imopPurchase: PurchaseHeader = {
        id: 'pur-imop-001',
        companyId: COMPANY_ID,
        purchaseNo: 'PUR-IMOP-64-2026',
        poNumber: '64-2026',
        supplierInvoiceNo: 'IN4202605071',
        supplierInvoiceDate: '2026-11-26',
        transactionDate: '2026-11-26T08:30:00.000Z',
        supplierPartyId: 'party-imop',
        supplierName: 'India Metal One Steel Plate Processing Pvt Ltd',
        sourceType: 'DIRECT_SUPPLIER',
        yardId: YARD_MAIN,
        vehicleRegistration: 'TN18BY0420',
        grossWeight: 6040,
        tareWeight: 4460,
        netWeight: 1580,
        acceptedWeight: 1580,
        rejectedWeight: 0,
        invoiceAttachmentId: 'doc-imop-IN4202605071',
        paymentStatus: 'UNPAID',
        isUserVerified: true,
        lines: [
          {
            id: 'pl-imop-1',
            materialId: MAT_MS_STRIP,
            grossWeight: 6040,
            tareWeight: 4460,
            netWeight: 1580,
            deductions: 0,
            payableWeight: 1580,
            ratePerUnit: 28.56,
            gstRate: 18,
            taxableAmount: 45124.8,
            gstAmount: 8122.46,
            totalAmount: 53247.26,
          },
        ],
        subtotalAmount: 45124.8,
        taxAmount: 8122.46,
        otherCharges: 0,
        totalAmount: 53247.26,
        amountPaid: 0,
        outstandingBalance: 53247.26,
        status: 'APPROVED',
        createdBy: 'Prop. P. Nandha Kumar',
        createdAt: '2026-11-26T08:30:00.000Z',
      };

      const imopPosted = postPurchaseTransaction(imopPurchase, stockMovements, 'Prop. P. Nandha Kumar');
      lots.push(...imopPosted.newLots);
      stockMovements.push(...imopPosted.newMovements);
      const imopLot = imopPosted.newLots[0];

      // Verify IMOP lot traceability
      expect(imopLot.supplierName).toBe('India Metal One Steel Plate Processing Pvt Ltd');
      expect(imopLot.originalInvoiceNo).toBe('IN4202605071');
      expect(imopLot.purchaseOrderNo).toBe('64-2026');
      expect(imopLot.initialQuantity).toBe(1580);
      expect(imopLot.remainingQuantity).toBe(1580);

      // 4. Record Verified Weighbridge Slip: Thangavel Electronic Weigh Bridge, Bill #59, 26-11-2026 09:40:04
      // Vehicle TN18BY0420 | First Weight 7,980 KG | Second Weight 4,450 KG | Net 3,530 KG | Charge ₹100
      const wbChecksum = await computeWeighbridgeSlipChecksum('THANGAVEL-WB-BILL-59-TN18BY0420-2026-11-26-7980-4450');
      const vinothWeighment = createVerifiedWeighbridgeRecord(
        {
          companyId: COMPANY_ID,
          billNumber: '59',
          weighbridgeName: 'Thangavel Electronic Weigh Bridge',
          partyName: 'Vinoth Godown',
          vehicleRegistration: 'TN18BY0420',
          firstWeight: 7980,
          secondWeight: 4450,
          weighbridgeCharge: 100,
          weighmentDate: '2026-11-26',
          firstWeightTime: '2026-11-26T09:40:04+05:30',
          operatorName: 'Prop. P. Nandha Kumar',
          slipChecksum: wbChecksum,
          slipAttachmentId: 'doc-wb-59',
          ocrExtracted: true,
          isUserVerified: true,
          transactionType: 'SALES_DISPATCH',
        },
        weighments
      );
      weighments.push(vinothWeighment);
      expect(vinothWeighment.netWeight).toBe(3530);
      expect(vinothWeighment.weighbridgeCharge).toBe(100);

      // 5. Post ONE Consolidated Multi-Source Dispatch to Vinoth Godown (3,530 KG)
      // 3,530 - 1,580 = 1,950 KG allocated across verified IMH (1,150 KG) + Existing Godown Stock (800 KG)
      const dispatchRes = postMultiSourceDispatch(
        {
          companyId: COMPANY_ID,
          destinationName: 'Vinoth Godown',
          materialId: MAT_MS_SCRAP,
          vehicleRegistration: 'TN18BY0420',
          dispatchDateTime: '2026-11-26T09:40:04+05:30',
          sourceYardId: YARD_MAIN,
          grossWeight: 7980,
          tareWeight: 4450,
          lotRequests: [
            { lotId: imopLot.id, quantity: 1580 }, // IMOP Packing Steel Strip
            { lotId: imhLot.id, quantity: 1150 }, // IMH MS Scrap
            { lotId: openingGodownLot.id, quantity: 800 }, // Existing Godown MS Scrap
          ],
          weighment: vinothWeighment,
          weighbridgeBillNo: '59',
          weighbridgeName: 'Thangavel Electronic Weigh Bridge',
          weighbridgeCharge: 100,
          dispatchEmployee: 'Prop. P. Nandha Kumar',
          idempotencyKey: 'vinoth-dispatch-2026-11-26-bill-59',
        },
        lots,
        stockMovements,
        dispatches,
        'Prop. P. Nandha Kumar'
      );

      dispatches.push(dispatchRes.dispatch);

      // Required Acceptance Assertions:
      expect(dispatchRes.dispatch.netWeight).toBe(3530);
      expect(dispatchRes.dispatch.totalAllocatedWeight).toBe(3530);
      expect(dispatchRes.discrepancy).toBe(0);
      expect(dispatchRes.isReconciled).toBe(true);
      expect(dispatchRes.dispatch.weighmentId).toBe(vinothWeighment.id);
      expect(dispatchRes.dispatch.weighbridgeBillNo).toBe('59');
      expect(dispatchRes.dispatch.allocations).toHaveLength(3);

      // Verify IMOP allocation = 1,580 KG & remaining = 0 KG (exhausted)
      const imopAfter = dispatchRes.updatedLots.find((l) => l.id === imopLot.id)!;
      expect(imopAfter.remainingQuantity).toBe(0);
      expect(imopAfter.dispatchedQuantity).toBe(1580);
      expect(imopAfter.isExhausted).toBe(true);
      expect(imopAfter.originalInvoiceNo).toBe('IN4202605071');

      // Verify Other Verified Stock allocation = 1,950 KG (1,150 IMH + 800 Godown) & exact remaining balances
      const imhAfter = dispatchRes.updatedLots.find((l) => l.id === imhLot.id)!;
      const godownAfter = dispatchRes.updatedLots.find((l) => l.id === openingGodownLot.id)!;
      expect(imhAfter.remainingQuantity).toBe(850); // 2000 - 1150
      expect(godownAfter.remainingQuantity).toBe(400); // 1200 - 800

      // Verify 3 separate traceable outward movements (no duplicate movements)
      expect(dispatchRes.newMovements).toHaveLength(3);
      expect(dispatchRes.newMovements.reduce((s, m) => s + Math.abs(m.quantity), 0)).toBe(3530);

      // Verify duplicate posting with same idempotencyKey is blocked
      expect(() =>
        postMultiSourceDispatch(
          {
            companyId: COMPANY_ID,
            destinationName: 'Vinoth Godown',
            materialId: MAT_MS_SCRAP,
            vehicleRegistration: 'TN18BY0420',
            dispatchDateTime: '2026-11-26T09:40:04+05:30',
            sourceYardId: YARD_MAIN,
            grossWeight: 7980,
            tareWeight: 4450,
            lotRequests: [{ lotId: imhAfter.id, quantity: 100 }],
            weighment: vinothWeighment,
            dispatchEmployee: 'Prop. P. Nandha Kumar',
            idempotencyKey: 'vinoth-dispatch-2026-11-26-bill-59',
          },
          dispatchRes.updatedLots,
          [...stockMovements, ...dispatchRes.newMovements],
          dispatches,
          'Prop. P. Nandha Kumar'
        )
      ).toThrow(/Duplicate dispatch prevented/i);
    });
  });

  describe('Inventory, Weighbridge, OCR Guard, Returns & Negative Stock Prevention', () => {
    it('blocks posting unverified OCR purchase invoices automatically to stock', () => {
      const ocrPurchase: PurchaseHeader = {
        id: 'pur-ocr-1',
        companyId: COMPANY_ID,
        purchaseNo: 'PUR-OCR-01',
        transactionDate: '2026-11-26',
        supplierPartyId: 'sup-1',
        sourceType: 'DIRECT_SUPPLIER',
        yardId: YARD_MAIN,
        ocrSource: true,
        isUserVerified: false,
        lines: [
          {
            id: 'l1',
            materialId: MAT_MS_SCRAP,
            grossWeight: 5000,
            tareWeight: 3000,
            netWeight: 2000,
            deductions: 0,
            payableWeight: 2000,
            ratePerUnit: 28,
            gstRate: 18,
            taxableAmount: 56000,
            gstAmount: 10080,
            totalAmount: 66080,
          },
        ],
        subtotalAmount: 56000,
        taxAmount: 10080,
        otherCharges: 0,
        totalAmount: 66080,
        amountPaid: 0,
        outstandingBalance: 66080,
        status: 'APPROVED',
        createdBy: 'OCR Bot',
        createdAt: '2026-11-26T10:00:00Z',
      };
      expect(() => postPurchaseTransaction(ocrPurchase, [], 'OCR Bot')).toThrow(/must be verified by a user/i);
    });

    it('detects duplicate weighbridge slips via SHA-256 checksum and bill+vehicle+date, and enforces vehicle match', async () => {
      const checksum = await computeWeighbridgeSlipChecksum('SLIP-BINARY-DATA-59');
      const existing = [
        createVerifiedWeighbridgeRecord(
          {
            companyId: COMPANY_ID,
            billNumber: '59',
            weighbridgeName: 'Thangavel Electronic Weigh Bridge',
            vehicleRegistration: 'TN 18 BY 0420',
            firstWeight: 7980,
            secondWeight: 4450,
            weighmentDate: '2026-11-26',
            operatorName: 'Operator',
            slipChecksum: checksum,
          },
          []
        ),
      ];

      const dupChecksum = detectDuplicateWeighbridgeSlip(
        { companyId: COMPANY_ID, billNumber: '999', grossWeight: 7980, tareWeight: 4450, slipChecksum: checksum },
        existing
      );
      expect(dupChecksum.isDuplicate).toBe(true);

      const dupDetails = detectDuplicateWeighbridgeSlip(
        {
          companyId: COMPANY_ID,
          billNumber: '59',
          vehicleRegistration: 'TN18BY0420',
          weighmentDate: '2026-11-26',
          grossWeight: 7980,
          tareWeight: 4450,
        },
        existing
      );
      expect(dupDetails.isDuplicate).toBe(true);
    });

    it('enforces negative stock prevention, purchase return, sales return, and full Stock Ledger closing formula', () => {
      const lot: InventoryLot = {
        id: 'lot-test-1',
        companyId: COMPANY_ID,
        lotNumber: 'LOT-T1',
        materialId: MAT_MS_SCRAP,
        yardId: YARD_MAIN,
        sourceType: 'PURCHASE',
        initialQuantity: 1000,
        remainingQuantity: 1000,
        unitCost: 30,
        receivedAt: '2026-11-20T09:00:00Z',
        isExhausted: false,
      };
      const movs: StockMovement[] = [
        createStockMovement([], {
          companyId: COMPANY_ID,
          movementType: 'PURCHASE_RECEIPT',
          transactionRef: 'PUR-01',
          materialId: MAT_MS_SCRAP,
          yardId: YARD_MAIN,
          lotId: lot.id,
          quantity: 1000,
          unitCost: 30,
          createdBy: 'Admin',
        }),
      ];

      // Over-allocation must fail (negative stock prevention)
      expect(() =>
        allocateLotsExplicit([lot], [{ lotId: lot.id, quantity: 1001 }], { companyId: COMPANY_ID, yardId: YARD_MAIN })
      ).toThrow(/Insufficient stock/i);

      // Purchase Return (-100 KG)
      const pret = postPurchaseReturn({
        lot,
        returnQuantity: 100,
        existingMovements: movs,
        reason: 'Excess moisture/slag',
        actor: 'Admin',
      });
      movs.push(pret.movement);
      expect(pret.updatedLot.remainingQuantity).toBe(900);

      // Sales Return (+50 KG)
      const sret = postSalesReturn({
        companyId: COMPANY_ID,
        returnRef: 'SRET-01',
        materialId: MAT_MS_SCRAP,
        yardId: YARD_MAIN,
        returnQuantity: 50,
        unitCost: 30,
        customerName: 'Customer A',
        existingMovements: movs,
        actor: 'Admin',
        reason: 'Grade rejection',
      });
      movs.push(sret.movement);

      // Approved Positive (+20) and Negative (-10) Adjustments
      movs.push(
        createStockMovement(movs, {
          companyId: COMPANY_ID,
          movementType: 'APPROVED_POSITIVE_ADJUSTMENT',
          transactionRef: 'ADJ-POS-01',
          materialId: MAT_MS_SCRAP,
          yardId: YARD_MAIN,
          quantity: 20,
          unitCost: 30,
          createdBy: 'Admin',
        })
      );
      movs.push(
        createStockMovement(movs, {
          companyId: COMPANY_ID,
          movementType: 'APPROVED_NEGATIVE_ADJUSTMENT',
          transactionRef: 'ADJ-NEG-01',
          materialId: MAT_MS_SCRAP,
          yardId: YARD_MAIN,
          quantity: -10,
          unitCost: 30,
          createdBy: 'Admin',
        })
      );

      const ledger = computeStockLedgerSummary(movs, { companyId: COMPANY_ID, materialId: MAT_MS_SCRAP });
      expect(ledger.purchaseInward).toBe(1000);
      expect(ledger.purchaseReturn).toBe(100);
      expect(ledger.salesReturn).toBe(50);
      expect(ledger.approvedPositiveAdjustment).toBe(20);
      expect(ledger.approvedNegativeAdjustment).toBe(10);
      // 0 + 1000 + 0 + 50 + 20 - 0 - 0 - 100 - 0 - 10 = 960 KG
      expect(ledger.closingStock).toBe(960);
    });
  });

  describe('Phase 3 — Internal Godown Transfer Lifecycle, Partial Receipts, Duplicate Guard & Neutrality', () => {
    it('deducts source on dispatch, adds destination only on receipt, supports partial receipts, blocks duplicates, and preserves consolidated company stock', () => {
      const lots: InventoryLot[] = [
        {
          id: 'lot-trf-src',
          companyId: COMPANY_ID,
          lotNumber: 'LOT-SRC-01',
          materialId: MAT_MS_SCRAP,
          yardId: YARD_MAIN,
          sourceType: 'PURCHASE',
          supplierName: 'IMH Supplier',
          originalInvoiceNo: 'IMH-991',
          initialQuantity: 1000,
          remainingQuantity: 1000,
          unitCost: 29,
          receivedAt: '2026-11-20T09:00:00Z',
          isExhausted: false,
        },
      ];
      let movs: StockMovement[] = [
        createStockMovement([], {
          companyId: COMPANY_ID,
          movementType: 'OPENING_STOCK',
          transactionRef: 'OPEN-1',
          materialId: MAT_MS_SCRAP,
          yardId: YARD_MAIN,
          lotId: lots[0].id,
          quantity: 1000,
          unitCost: 29,
          createdBy: 'Admin',
        }),
      ];
      const transfers: GodownTransfer[] = [];

      // Create & Dispatch 500 KG Main -> North
      const trf = createGodownTransfer(
        {
          companyId: COMPANY_ID,
          sourceYardId: YARD_MAIN,
          destinationYardId: YARD_NORTH,
          materialId: MAT_MS_SCRAP,
          quantityDispatched: 500,
          vehicleRegistration: 'TN18BY0420',
          dispatchEmployee: 'Supervisor A',
          transferDate: '2026-11-26',
          createdBy: 'Admin',
        },
        transfers
      );
      transfers.push(trf);

      const disp = dispatchGodownTransfer(trf, lots, movs, 'Supervisor A');
      movs = [...movs, ...disp.newMovements];
      expect(disp.updatedTransfer.status).toBe('IN_TRANSIT');
      expect(disp.updatedLots[0].remainingQuantity).toBe(500);
      // Destination yard must still be 0 KG before receipt!
      expect(computeStockLedgerSummary(movs, { companyId: COMPANY_ID, yardId: YARD_NORTH }).closingStock).toBe(0);

      // Partial Receipt 1: 300 KG
      const rcv1 = receiveGodownTransfer(
        disp.updatedTransfer,
        {
          receivedQuantity: 300,
          receivedDate: '2026-11-26',
          receivingEmployee: 'Supervisor B',
          idempotencyKey: 'trf-rcv-key-1',
        },
        disp.updatedLots,
        movs
      );
      movs.push(rcv1.newMovement);
      expect(rcv1.updatedTransfer.status).toBe('PARTIALLY_RECEIVED');
      expect(rcv1.updatedTransfer.shortageQuantity).toBe(200);
      expect(rcv1.newDestinationLot.supplierName).toContain('IMH Supplier');

      // Duplicate receipt with same idempotency key must fail
      expect(() =>
        receiveGodownTransfer(
          rcv1.updatedTransfer,
          {
            receivedQuantity: 300,
            receivedDate: '2026-11-26',
            receivingEmployee: 'Supervisor B',
            idempotencyKey: 'trf-rcv-key-1',
          },
          [...disp.updatedLots, rcv1.newDestinationLot],
          movs
        )
      ).toThrow(/Duplicate receipt prevented/i);

      // Partial Receipt 2 (Remaining 200 KG) -> RECEIVED
      const rcv2 = receiveGodownTransfer(
        rcv1.updatedTransfer,
        {
          receivedQuantity: 200,
          receivedDate: '2026-11-26',
          receivingEmployee: 'Supervisor B',
          idempotencyKey: 'trf-rcv-key-2',
        },
        [...disp.updatedLots, rcv1.newDestinationLot],
        movs
      );
      movs.push(rcv2.newMovement);
      expect(rcv2.updatedTransfer.status).toBe('RECEIVED');
      expect(rcv2.updatedTransfer.quantityReceived).toBe(500);
      expect(rcv2.updatedTransfer.shortageQuantity).toBe(0);

      // Consolidated company stock MUST remain 1,000 KG (transfer neutrality!)
      const neutrality = verifyInternalTransferNeutrality(movs, COMPANY_ID);
      expect(neutrality.isNeutral).toBe(true);
      expect(computeStockLedgerSummary(movs, { companyId: COMPANY_ID }).closingStock).toBe(1000);
      expect(computeStockLedgerSummary(movs, { companyId: COMPANY_ID, yardId: YARD_MAIN }).closingStock).toBe(500);
      expect(computeStockLedgerSummary(movs, { companyId: COMPANY_ID, yardId: YARD_NORTH }).closingStock).toBe(500);

      // Disputed & Cancelled transitions
      const disputed = flagTransferDispute(rcv1.updatedTransfer, 'Weighbridge variance');
      expect(disputed.status).toBe('DISPUTED');
      const cancelled = cancelGodownTransfer(trf, 'Truck breakdown before loading');
      expect(cancelled.status).toBe('CANCELLED');
      expect(() => cancelGodownTransfer(disp.updatedTransfer)).toThrow(/Cannot cancel transfer/i);
    });
  });
});
