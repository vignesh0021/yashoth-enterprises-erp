// Sales & Invoicing Rules Engine Tests
import { describe, it, expect } from 'vitest';
import { dispatchSalesTransaction } from '../backend/business-rules/salesEngine.ts';
import type { 
  SalesHeader, 
  InventoryLot, 
  StockMovement, 
  Party, 
  CompanySettings 
} from '../src/types/index.ts';

describe('Sales Dispatch & Invoice Engine', () => {
  const company: CompanySettings = {
    id: 'co-1',
    companyName: 'YASHOTH ENTERPRISES',
    legalName: 'YASHOTH ENTERPRISES',
    addressLine1: 'NO.128/40, Dr.AMBEDKAR STREET',
    addressLine2: 'PERUVAYAL JUNCTION, KAVARAPETTAI',
    city: 'GUMMIDIPOODI',
    stateName: 'Tamil Nadu',
    stateCode: '33',
    pincode: '601206',
    gstin: '33AXVPN9382L1ZF',
    phone: '+91 94440 12345',
    email: 'yashothenterprises2022@gmail.com',
    bankName: 'CITY UNION BANK',
    bankAccountNo: '510909010195638',
    bankBranchIfsc: 'PONNERI & CIUB0000439',
    invoicePrefix: 'YE/',
    defaultBaseUnit: 'KG',
  };

  const customer: Party = {
    id: 'cust-tejas',
    partyCode: 'CUST-TEJAS',
    legalName: 'TEJAS STEEL',
    partyType: 'CUSTOMER',
    contactPerson: 'Mr. Tejas',
    phone: '+91 98800 12345',
    addressLine1: 'Serv.NO. 596/3B1B, Shop.No.7',
    city: 'Gummidipoondi',
    stateName: 'Tamil Nadu',
    stateCode: '33',
    gstin: '33ADFPO6345L1ZA',
    paymentTerms: 'Immediate',
    creditLimit: 500000,
    openingBalance: 0,
    openingBalanceDate: '2026-10-01',
    isActive: true,
  };

  it('should dispatch sales, consume inventory lots using FIFO, and generate invoice matching template formulas', () => {
    // Exactly matching the verified TEJAS invoice sample:
    // 7,720 KG @ ₹30/KG = ₹2,31,600 taxable value
    // Output CGST @ 9% = ₹20,844
    // Output SGST @ 9% = ₹20,844
    // Grand Total = ₹2,73,288
    const salesOrder: SalesHeader = {
      id: 'so-10',
      salesNo: 'SO-10',
      orderDate: '2026-10-15T10:00:00Z',
      customerPartyId: customer.id,
      yardId: 'yard-1',
      vehicleRegistration: 'TN 18 BY 0420',
      status: 'CONFIRMED',
      subtotalAmount: 231600,
      taxAmount: 41688,
      totalAmount: 273288,
      allocatedCogs: 0,
      createdBy: 'operator1',
      createdAt: '2026-10-15T10:00:00Z',
      lines: [
        {
          id: 'sol-1',
          materialId: 'mat-boring',
          quantity: 7720,
          ratePerUnit: 30,
          gstRate: 18,
          taxableAmount: 231600,
          gstAmount: 41688,
          totalAmount: 273288,
          lotAllocations: [],
        },
      ],
    };

    const activeLots: InventoryLot[] = [
      {
        id: 'lot-a',
        lotNumber: 'LOT-PUR-101',
        materialId: 'mat-boring',
        yardId: 'yard-1',
        initialQuantity: 10000,
        remainingQuantity: 10000,
        unitCost: 26.50,
        receivedAt: '2026-10-01T08:00:00Z',
        isExhausted: false,
      },
    ];

    const existingMovements: StockMovement[] = [
      {
        id: 'm-in',
        movementType: 'PURCHASE_RECEIPT',
        transactionRef: 'PUR-101',
        materialId: 'mat-boring',
        yardId: 'yard-1',
        quantity: 10000,
        unitCost: 26.50,
        totalCost: 265000,
        createdBy: 'admin',
        createdAt: '2026-10-01T08:00:00Z',
      },
    ];

    const result = dispatchSalesTransaction(
      salesOrder,
      activeLots,
      existingMovements,
      customer,
      company,
      10, // Invoice sequence #10
      'admin'
    );

    expect(result.updatedSales.status).toBe('DISPATCHED');
    expect(result.newMovements.length).toBe(1);
    expect(result.newMovements[0].quantity).toBe(-7720); // Outward movement

    const inv = result.generatedInvoice;
    expect(inv.invoiceNo).toBe('YE/26-27/0010');
    expect(inv.customerName).toBe('TEJAS STEEL');
    expect(inv.subtotalTaxable).toBe(231600);
    expect(inv.cgstRate).toBe(9);
    expect(inv.cgstAmount).toBe(20844);
    expect(inv.sgstRate).toBe(9);
    expect(inv.sgstAmount).toBe(20844);
    expect(inv.grandTotal).toBe(273288);
    expect(inv.roundOff).toBe(0);

    // Number to words verification
    expect(inv.amountInWords).toBe('INR Two Lakh Seventy Three Thousand Two Hundred Eighty Eight Only');
    expect(inv.taxAmountInWords).toBe('INR Forty One Thousand Six Hundred Eighty Eight Only');

    // Immutable snapshot verification
    expect(inv.immutableSnapshotJson).toBeDefined();
    const parsed = JSON.parse(inv.immutableSnapshotJson);
    expect(parsed.grandTotal).toBe(273288);
  });
});
