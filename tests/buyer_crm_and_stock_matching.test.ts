import { describe, it, expect } from 'vitest';
import {
  calculateMaterialStockTiers,
  matchStockToBuyer,
  validateSaleQuantityAgainstAvailableStock,
  getBuyerFollowUpAlerts,
  generateWhatsAppQuoteLink,
} from '../src/utils/buyerCrmEngine.ts';
import type { Party, Material, InventoryLot, CommercialDocument } from '../src/types/index.ts';

describe('Suite 21: Scrap Buyer & Agent CRM, Stock-to-Buyer Matching & Quoting Engine', () => {
  const mockMaterial: Material = {
    id: 'mat-copper-01',
    companyId: 'comp-1',
    code: 'MAT-CU-01',
    name: 'Copper Armature Scrap',
    category: 'Copper',
    baseUnit: 'KG',
    hsnCode: '74040012',
    defaultPurchaseRate: 700,
    defaultSalesRate: 750,
    defaultGstRate: 18,
    minStockAlert: 100,
    isActive: true,
  };

  const mockLots: InventoryLot[] = [
    {
      id: 'lot-1',
      lotNumber: 'LOT-CU-01',
      materialId: 'mat-copper-01',
      yardId: 'yard-1',
      initialQuantity: 1000,
      remainingQuantity: 800,
      unitCost: 700,
      receivedAt: '2026-11-01',
      isExhausted: false,
    },
    {
      id: 'lot-2',
      lotNumber: 'LOT-CU-02',
      materialId: 'mat-copper-01',
      yardId: 'yard-1',
      initialQuantity: 500,
      remainingQuantity: 500,
      unitCost: 710,
      receivedAt: '2026-11-05',
      isExhausted: false,
    },
  ];

  const mockDocuments: CommercialDocument[] = [
    {
      id: 'doc-quote-01',
      companyId: 'comp-1',
      documentNo: 'QT-2026-001',
      documentType: 'QUOTATION',
      partyId: 'buyer-1',
      partyName: 'Buyer 1',
      partyAddress: 'Chennai',
      placeOfSupply: 'Tamil Nadu',
      stateCode: '33',
      documentDate: '2026-11-10',
      subtotalTaxable: 150000,
      cgstRate: 9,
      cgstAmount: 13500,
      sgstRate: 9,
      sgstAmount: 13500,
      igstRate: 0,
      igstAmount: 0,
      roundOff: 0,
      grandTotal: 177000,
      amountPaid: 0,
      outstandingBalance: 177000,
      status: 'ISSUED',
      createdBy: 'user-1',
      createdAt: '2026-11-10T10:00:00Z',
      lines: [
        {
          id: 'line-1',
          serialNo: 1,
          materialId: 'mat-copper-01',
          description: 'Copper Armature Scrap',
          hsnSac: '74040012',
          quantity: 200,
          unit: 'KG',
          rate: 750,
          taxableValue: 150000,
          gstRate: 18,
          gstAmount: 27000,
          totalAmount: 177000,
        },
      ],
    },
    {
      id: 'doc-po-01',
      companyId: 'comp-1',
      documentNo: 'PO-2026-001',
      documentType: 'PURCHASE_ORDER',
      partyId: 'buyer-2',
      partyName: 'Buyer 2',
      partyAddress: 'Chennai',
      placeOfSupply: 'Tamil Nadu',
      stateCode: '33',
      documentDate: '2026-11-12',
      subtotalTaxable: 225000,
      cgstRate: 9,
      cgstAmount: 20250,
      sgstRate: 9,
      sgstAmount: 20250,
      igstRate: 0,
      igstAmount: 0,
      roundOff: 0,
      grandTotal: 265500,
      amountPaid: 0,
      outstandingBalance: 265500,
      status: 'ISSUED',
      createdBy: 'user-1',
      createdAt: '2026-11-12T10:00:00Z',
      lines: [
        {
          id: 'line-2',
          serialNo: 1,
          materialId: 'mat-copper-01',
          description: 'Copper Armature Scrap',
          hsnSac: '74040012',
          quantity: 300,
          unit: 'KG',
          rate: 750,
          taxableValue: 225000,
          gstRate: 18,
          gstAmount: 40500,
          totalAmount: 265500,
        },
      ],
    },
  ];

  it('21.1 verifies multi-tier stock levels: Physical vs Reserved vs Available', () => {
    const tiers = calculateMaterialStockTiers(mockMaterial, mockLots, mockDocuments);

    // Physical = lot-1 (800) + lot-2 (500) = 1300 KG
    expect(tiers.physicalStockKg).toBe(1300);

    // Reserved = confirmed PO line (300 KG). Quotation (200 KG) does NOT reserve stock!
    expect(tiers.reservedStockKg).toBe(300);

    // Available = Physical (1300) - Reserved (300) = 1000 KG
    expect(tiers.availableStockKg).toBe(1000);
  });

  it('21.2 proves a quotation does NOT reduce physical or available stock', () => {
    const initialTiers = calculateMaterialStockTiers(mockMaterial, mockLots, mockDocuments);

    // Add another quotation for 500 KG
    const moreDocs: CommercialDocument[] = [
      ...mockDocuments,
      {
        id: 'doc-quote-02',
        companyId: 'comp-1',
        documentNo: 'QT-2026-002',
        documentType: 'QUOTATION',
        partyId: 'buyer-3',
        partyName: 'Buyer 3',
        partyAddress: 'Chennai',
        placeOfSupply: 'Tamil Nadu',
        stateCode: '33',
        documentDate: '2026-11-13',
        subtotalTaxable: 375000,
        cgstRate: 9,
        cgstAmount: 33750,
        sgstRate: 9,
        sgstAmount: 33750,
        igstRate: 0,
        igstAmount: 0,
        roundOff: 0,
        grandTotal: 442500,
        amountPaid: 0,
        outstandingBalance: 442500,
        status: 'ISSUED',
        createdBy: 'user-1',
        createdAt: '2026-11-13T10:00:00Z',
        lines: [
          {
            id: 'line-3',
            serialNo: 1,
            materialId: 'mat-copper-01',
            description: 'Copper Armature Scrap',
            hsnSac: '74040012',
            quantity: 500,
            unit: 'KG',
            rate: 750,
            taxableValue: 375000,
            gstRate: 18,
            gstAmount: 67500,
            totalAmount: 442500,
          },
        ],
      },
    ];

    const updatedTiers = calculateMaterialStockTiers(mockMaterial, mockLots, moreDocs);
    expect(updatedTiers.physicalStockKg).toBe(initialTiers.physicalStockKg);
    expect(updatedTiers.availableStockKg).toBe(initialTiers.availableStockKg);
  });

  it('21.3 strictly prevents sales exceeding currently available stock', () => {
    // Available is 1000 KG
    // Valid sale of 400 KG
    const validSale = validateSaleQuantityAgainstAvailableStock(
      'mat-copper-01',
      400,
      [mockMaterial],
      mockLots,
      mockDocuments
    );
    expect(validSale.allowed).toBe(true);

    // Invalid sale of 1200 KG (exceeds available 1000 KG)
    const invalidSale = validateSaleQuantityAgainstAvailableStock(
      'mat-copper-01',
      1200,
      [mockMaterial],
      mockLots,
      mockDocuments
    );
    expect(invalidSale.allowed).toBe(false);
    expect(invalidSale.error).toContain('Insufficient available stock');
  });

  it('21.4 accurately matches yard stock to buyer interested materials', () => {
    const buyer: Party = {
      id: 'pty-buyer-1',
      partyCode: 'BYR-01',
      legalName: 'Chennai Metal Traders',
      partyType: 'CUSTOMER',
      contactPerson: 'Suresh Kumar',
      phone: '9840123456',
      addressLine1: 'Ambattur Industrial Estate',
      city: 'Chennai',
      stateName: 'Tamil Nadu',
      stateCode: '33',
      paymentTerms: 'ADVANCE',
      creditLimit: 500000,
      openingBalance: 0,
      openingBalanceDate: '2026-04-01',
      isActive: true,
      buyerType: 'SCRAP_BUYER',
      interestedMaterials: ['mat-copper-01'],
      preferredQuantity: 500,
    };

    const matches = matchStockToBuyer(buyer, [mockMaterial], mockLots, mockDocuments);
    expect(matches.length).toBe(1);
    expect(matches[0].materialId).toBe('mat-copper-01');
    expect(matches[0].isAvailable).toBe(true);
    expect(matches[0].matchScore).toBe(100); // 50 (interested) + 30 (available) + 20 (quantity >= 500)
  });

  it('21.5 evaluates buyer follow-up dates and flags overdue reminders', () => {
    const today = new Date('2026-11-13');
    const buyers: Party[] = [
      {
        id: 'pty-1',
        partyCode: 'BYR-01',
        legalName: 'Active Buyer',
        partyType: 'CUSTOMER',
        contactPerson: 'Raj',
        phone: '9840111111',
        addressLine1: 'Chennai',
        city: 'Chennai',
        stateName: 'TN',
        stateCode: '33',
        paymentTerms: 'NET30',
        creditLimit: 100000,
        openingBalance: 0,
        openingBalanceDate: '2026-04-01',
        isActive: true,
        nextFollowUpDate: '2026-11-10', // 3 days overdue
      },
      {
        id: 'pty-2',
        partyCode: 'BYR-02',
        legalName: 'Future Buyer',
        partyType: 'CUSTOMER',
        contactPerson: 'Mani',
        phone: '9840222222',
        addressLine1: 'Chennai',
        city: 'Chennai',
        stateName: 'TN',
        stateCode: '33',
        paymentTerms: 'NET30',
        creditLimit: 100000,
        openingBalance: 0,
        openingBalanceDate: '2026-04-01',
        isActive: true,
        nextFollowUpDate: '2026-11-20', // 7 days in future
      },
    ];

    const alerts = getBuyerFollowUpAlerts(buyers, today);
    expect(alerts.length).toBe(2);
    expect(alerts[0].partyCode).toBe('BYR-01');
    expect(alerts[0].isOverdue).toBe(true);
    expect(alerts[0].daysRemaining).toBe(-3);

    expect(alerts[1].partyCode).toBe('BYR-02');
    expect(alerts[1].isOverdue).toBe(false);
    expect(alerts[1].daysRemaining).toBe(7);
  });

  it('21.6 generates valid 1-tap WhatsApp quote link with Indian country code', () => {
    const buyer: Party = {
      id: 'pty-wa',
      partyCode: 'BYR-WA',
      legalName: 'Ramesh Metals',
      partyType: 'CUSTOMER',
      contactPerson: 'Ramesh',
      phone: '9840333333',
      addressLine1: 'Redhills',
      city: 'Chennai',
      stateName: 'TN',
      stateCode: '33',
      paymentTerms: 'IMMEDIATE',
      creditLimit: 0,
      openingBalance: 0,
      openingBalanceDate: '2026-04-01',
      isActive: true,
    };

    const link = generateWhatsAppQuoteLink(buyer, 'Copper Scrap', 750, 1000);
    expect(link).toContain('https://wa.me/919840333333?text=');
    expect(decodeURIComponent(link)).toContain('Vanakkam Ramesh');
    expect(decodeURIComponent(link)).toContain('Rate: ₹750.00/KG');
    expect(decodeURIComponent(link)).toContain('Total: ₹7,50,000');
  });
});
