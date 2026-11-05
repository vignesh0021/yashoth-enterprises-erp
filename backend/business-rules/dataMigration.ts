// Yasoth Enterprises Scrap ERP — Controlled Data Migration Engine
// Handles CSV/XLSX row validation, duplicate detection, dry-run simulations, and error reporting

import type { Party, Material, Yard, InventoryLot, StockMovement } from '../../src/types/index.ts';
import { roundTo2, roundTo3 } from '../../src/utils/calculations.ts';

export interface MigrationRowError {
  rowNumber: number;
  field: string;
  value: any;
  message: string;
}

export interface MigrationResult<T> {
  dryRun: boolean;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  errors: MigrationRowError[];
  importedRecords: T[];
  summaryNote: string;
}

/**
 * Validates and imports Party records from CSV rows.
 */
export function migrateParties(
  rawRows: Record<string, any>[],
  existingParties: Party[],
  dryRun: boolean = true
): MigrationResult<Party> {
  const errors: MigrationRowError[] = [];
  const validRecords: Party[] = [];
  const seenCodes = new Set(existingParties.map((p) => p.partyCode.toUpperCase()));

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // assuming 1-based index with row 1 as header
    const code = String(row['party_code'] || row['code'] || '').trim().toUpperCase();
    const name = String(row['legal_name'] || row['name'] || '').trim();
    const typeStr = String(row['party_type'] || row['type'] || 'SUPPLIER').trim().toUpperCase();
    const phone = String(row['phone'] || row['mobile'] || '').trim();
    const openingBalance = parseFloat(row['opening_balance'] || '0');

    if (!code) {
      errors.push({ rowNumber: rowNum, field: 'party_code', value: code, message: 'Party code is required.' });
    } else if (seenCodes.has(code)) {
      errors.push({ rowNumber: rowNum, field: 'party_code', value: code, message: `Duplicate party code: ${code}.` });
    }

    if (!name) {
      errors.push({ rowNumber: rowNum, field: 'legal_name', value: name, message: 'Legal name is required.' });
    }

    if (!['SUPPLIER', 'CUSTOMER', 'BOTH'].includes(typeStr)) {
      errors.push({ rowNumber: rowNum, field: 'party_type', value: typeStr, message: 'Party type must be SUPPLIER, CUSTOMER, or BOTH.' });
    }

    if (isNaN(openingBalance)) {
      errors.push({ rowNumber: rowNum, field: 'opening_balance', value: row['opening_balance'], message: 'Opening balance must be a valid number.' });
    }

    if (!errors.some((e) => e.rowNumber === rowNum)) {
      seenCodes.add(code);
      validRecords.push({
        id: 'pty-' + Math.random().toString(36).substring(2, 11),
        partyCode: code,
        legalName: name,
        tradeName: row['trade_name'] || undefined,
        partyType: typeStr as any,
        contactPerson: row['contact_person'] || name,
        phone: phone || '+91 00000 00000',
        email: row['email'] || undefined,
        addressLine1: row['address_line1'] || row['address'] || 'Peruvayal Road',
        city: row['city'] || 'Gummidipoondi',
        stateName: row['state_name'] || 'Tamil Nadu',
        stateCode: row['state_code'] || '33',
        gstin: row['gstin'] || undefined,
        paymentTerms: row['payment_terms'] || 'Immediate',
        creditLimit: parseFloat(row['credit_limit'] || '0') || 0,
        openingBalance: roundTo2(openingBalance),
        openingBalanceDate: row['opening_balance_date'] || new Date().toISOString().split('T')[0],
        isActive: true,
      });
    }
  });

  return {
    dryRun,
    totalRows: rawRows.length,
    validRowsCount: validRecords.length,
    invalidRowsCount: rawRows.length - validRecords.length,
    errors,
    importedRecords: dryRun ? [] : validRecords,
    summaryNote: dryRun 
      ? `Dry-run completed. ${validRecords.length} rows valid, ${errors.length} errors found.`
      : `Import completed. ${validRecords.length} parties added.`,
  };
}

/**
 * Validates and imports Opening Stock records from CSV rows.
 */
export function migrateOpeningStock(
  rawRows: Record<string, any>[],
  materials: Material[],
  yards: Yard[],
  actor: string,
  dryRun: boolean = true
): MigrationResult<{ lot: InventoryLot; movement: StockMovement }> {
  const errors: MigrationRowError[] = [];
  const validPairs: { lot: InventoryLot; movement: StockMovement }[] = [];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const matCode = String(row['material_code'] || row['material'] || '').trim().toUpperCase();
    const yardCode = String(row['yard_code'] || row['yard'] || '').trim().toUpperCase();
    const quantity = parseFloat(row['quantity'] || '0');
    const unitCost = parseFloat(row['unit_cost'] || row['rate'] || '0');

    const material = materials.find((m) => m.code.toUpperCase() === matCode);
    if (!material) {
      errors.push({ rowNumber: rowNum, field: 'material_code', value: matCode, message: `Material ${matCode} not found in master.` });
    }

    const yard = yards.find((y) => y.code.toUpperCase() === yardCode);
    if (!yard) {
      errors.push({ rowNumber: rowNum, field: 'yard_code', value: yardCode, message: `Yard ${yardCode} not found.` });
    }

    if (isNaN(quantity) || quantity <= 0) {
      errors.push({ rowNumber: rowNum, field: 'quantity', value: row['quantity'], message: 'Quantity must be a positive number.' });
    }

    if (isNaN(unitCost) || unitCost < 0) {
      errors.push({ rowNumber: rowNum, field: 'unit_cost', value: row['unit_cost'], message: 'Unit cost must be non-negative.' });
    }

    if (!errors.some((e) => e.rowNumber === rowNum) && material && yard) {
      const now = new Date().toISOString();
      const lotNumber = `OPEN-LOT-${matCode}-${idx + 1}`;
      const lot: InventoryLot = {
        id: 'lot-' + Math.random().toString(36).substring(2, 11),
        lotNumber,
        materialId: material.id,
        yardId: yard.id,
        initialQuantity: roundTo3(quantity),
        remainingQuantity: roundTo3(quantity),
        unitCost: roundTo2(unitCost),
        receivedAt: now,
        isExhausted: false,
      };

      const movement: StockMovement = {
        id: 'mov-' + Math.random().toString(36).substring(2, 11),
        movementType: 'OPENING_STOCK',
        transactionRef: `OPENING-BAL-${matCode}`,
        materialId: material.id,
        yardId: yard.id,
        lotId: lot.id,
        quantity: roundTo3(quantity),
        unitCost: roundTo2(unitCost),
        totalCost: roundTo2(quantity * unitCost),
        notes: `Verified Opening Stock Migration`,
        createdBy: actor,
        createdAt: now,
      };

      validPairs.push({ lot, movement });
    }
  });

  return {
    dryRun,
    totalRows: rawRows.length,
    validRowsCount: validPairs.length,
    invalidRowsCount: rawRows.length - validPairs.length,
    errors,
    importedRecords: dryRun ? [] : validPairs,
    summaryNote: dryRun
      ? `Dry-run completed. ${validPairs.length} stock items valid, ${errors.length} errors found.`
      : `Import completed. ${validPairs.length} opening stock lots recorded.`,
  };
}
