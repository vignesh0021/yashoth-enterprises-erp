// Data Migration Engine Tests
import { describe, it, expect } from 'vitest';
import { migrateParties, migrateOpeningStock } from '../backend/business-rules/dataMigration.ts';
import type { Party, Material, Yard } from '../src/types/index.ts';

describe('Data Migration Engine', () => {
  const existingParty: Party = {
    id: 'p-1',
    partyCode: 'SUP-001',
    legalName: 'Existing Supplier',
    partyType: 'SUPPLIER',
    contactPerson: 'Manager',
    phone: '9840000000',
    addressLine1: 'Address',
    city: 'City',
    stateName: 'Tamil Nadu',
    stateCode: '33',
    paymentTerms: 'Immediate',
    creditLimit: 0,
    openingBalance: 0,
    openingBalanceDate: '2026-10-01',
    isActive: true,
  };

  it('should flag duplicate party codes and invalid types in dry run mode without importing', () => {
    const rawRows = [
      { party_code: 'SUP-001', legal_name: 'Duplicate Company', party_type: 'SUPPLIER', phone: '9999999999' },
      { party_code: 'CUST-002', legal_name: 'Valid Customer', party_type: 'CUSTOMER', phone: '8888888888' },
      { party_code: 'SUP-003', legal_name: 'Invalid Type', party_type: 'UNKNOWN_TYPE', phone: '7777777777' },
    ];

    const result = migrateParties(rawRows, [existingParty], true);

    expect(result.dryRun).toBe(true);
    expect(result.totalRows).toBe(3);
    expect(result.validRowsCount).toBe(1);
    expect(result.invalidRowsCount).toBe(2);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].message).toContain('Duplicate party code');
    expect(result.errors[1].message).toContain('Party type must be');
    expect(result.importedRecords.length).toBe(0); // dry-run should not return records
  });

  it('should validate and create opening stock lots with audit trails on commit', () => {
    const materials: Material[] = [
      {
        id: 'mat-1',
        code: 'MAT-MS-BORING',
        name: 'MS Boring Scrap',
        category: 'Steel',
        baseUnit: 'KG',
        hsnCode: '7204',
        defaultPurchaseRate: 28,
        defaultSalesRate: 31,
        defaultGstRate: 18,
        minStockAlert: 1000,
        isActive: true,
      },
    ];

    const yards: Yard[] = [
      {
        id: 'yd-1',
        code: 'YARD-01',
        name: 'Main Yard',
        locationAddress: 'Gummidipoondi',
        isActive: true,
      },
    ];

    const rawRows = [
      { material_code: 'MAT-MS-BORING', yard_code: 'YARD-01', quantity: 5000, unit_cost: 27.50 },
    ];

    const result = migrateOpeningStock(rawRows, materials, yards, 'admin', false);

    expect(result.dryRun).toBe(false);
    expect(result.validRowsCount).toBe(1);
    expect(result.errors.length).toBe(0);
    expect(result.importedRecords.length).toBe(1);

    const { lot, movement } = result.importedRecords[0];
    expect(lot.initialQuantity).toBe(5000);
    expect(lot.unitCost).toBe(27.50);
    expect(movement.movementType).toBe('OPENING_STOCK');
    expect(movement.quantity).toBe(5000);
  });
});
