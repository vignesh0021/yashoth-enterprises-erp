import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_20_BUSINESS_REPORTS,
  buildBusinessReport,
  exportReportToUtf8Csv,
  resolveReportDateRange,
} from '../backend/business-rules/comprehensiveReportsEngine.ts';
import { enforceAuthorization, AuthorizationError } from '../backend/business-rules/authEngine.ts';
import { postMultiSourceDispatch } from '../backend/business-rules/dispatchAndWeighbridgeEngine.ts';

describe('Phases 11, 12 & 13 — All 20 Reports (UTF-8 Tamil/English), Security, Multi-Company Isolation & Hardening', () => {
  it('generates all 20 integrated business reports with Daily/Weekly/Monthly/Annual/Custom filters & UTF-8 Tamil/English CSV', () => {
    expect(ALL_20_BUSINESS_REPORTS).toHaveLength(20);

    expect(resolveReportDateRange('DAILY', '2026-11-26')).toEqual({ fromDate: '2026-11-26', toDate: '2026-11-26' });
    expect(resolveReportDateRange('WEEKLY', '2026-11-26')).toEqual({ fromDate: '2026-11-20', toDate: '2026-11-26' });
    expect(resolveReportDateRange('MONTHLY', '2026-11-26')).toEqual({ fromDate: '2026-11-01', toDate: '2026-11-26' });
    expect(resolveReportDateRange('ANNUAL', '2026-11-26')).toEqual({ fromDate: '2026-04-01', toDate: '2026-11-26' });
    expect(resolveReportDateRange('CUSTOM', '2026-11-26', '2026-10-01', '2026-10-31')).toEqual({
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    });

    const sampleInput = {
      companyId: 'comp-ye',
      purchases: [],
      sales: [],
      invoices: [],
      weighments: [],
      stockMovements: [],
      inventoryLots: [
        {
          id: 'lot-ta-1',
          companyId: 'comp-ye',
          lotNumber: 'LOT-IMOP-01',
          materialId: 'mat-1',
          yardId: 'yard-1',
          sourceType: 'PURCHASE' as const,
          supplierName: 'யசோத் எண்டர்பிரைசஸ் / IMOP',
          originalInvoiceNo: 'IN4202605071',
          initialQuantity: 1580,
          remainingQuantity: 1580,
          unitCost: 28.56,
          receivedAt: '2026-11-26T08:00:00Z',
          isExhausted: false,
        },
      ],
      materials: [
        {
          id: 'mat-1',
          companyId: 'comp-ye',
          code: '9988',
          name: 'Packing Steel Strip (பேக்கிங் ஸ்டீல்)',
          category: 'Steel' as const,
          baseUnit: 'KG',
          hsnCode: '7204',
          defaultPurchaseRate: 28.56,
          defaultSalesRate: 32,
          defaultGstRate: 18,
          minStockAlert: 100,
          isActive: true,
        },
      ],
      yards: [{ id: 'yard-1', companyId: 'comp-ye', code: 'Y1', name: 'Main Godown', locationAddress: 'Chennai', isActive: true }],
      parties: [],
      accounts: [],
      accountTransactions: [],
      expenses: [],
      salaryRecords: [],
      materialDispatches: [],
      godownTransfers: [],
      managedDocuments: [],
      uploadedDocuments: [],
      backupHistory: [],
      restoreLogs: [],
      journalEntries: [],
    };

    for (const def of ALL_20_BUSINESS_REPORTS) {
      const result = buildBusinessReport(def.id, sampleInput, '2026-11-01', '2026-11-26');
      expect(result.reportId).toBe(def.id);
      expect(result.headers.length).toBeGreaterThan(0);
    }

    // Verify UTF-8 BOM & Tamil + English preservation in CSV
    const srcReport = buildBusinessReport('SOURCE_WISE_STOCK', sampleInput, '2026-11-01', '2026-11-26');
    const csv = exportReportToUtf8Csv(srcReport);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('யசோத் எண்டர்பிரைசஸ் / IMOP');
    expect(csv).toContain('Packing Steel Strip (பேக்கிங் ஸ்டீல்)');
  });

  it('enforces multi-company isolation on multi-source dispatches and RBAC authorization', () => {
    // Cross-company lot allocation must be blocked
    const companyBLot = {
      id: 'lot-comp-b',
      companyId: 'comp-B',
      lotNumber: 'LOT-B-01',
      materialId: 'mat-1',
      yardId: 'yard-1',
      sourceType: 'PURCHASE' as const,
      initialQuantity: 500,
      remainingQuantity: 500,
      unitCost: 30,
      receivedAt: '2026-11-26T08:00:00Z',
      isExhausted: false,
    };

    expect(() =>
      postMultiSourceDispatch(
        {
          companyId: 'comp-A',
          destinationName: 'Vinoth Godown',
          materialId: 'mat-1',
          vehicleRegistration: 'TN18BY0420',
          dispatchDateTime: '2026-11-26T10:00:00Z',
          sourceYardId: 'yard-1',
          grossWeight: 5000,
          tareWeight: 4500,
          lotRequests: [{ lotId: companyBLot.id, quantity: 500 }],
          dispatchEmployee: 'Operator',
        },
        [companyBLot],
        [],
        [],
        'Operator'
      )
    ).toThrow(/Cross-company stock violation/i);

    // Auditor role cannot restore backups or post purchases
    const auditorUser = { id: 'u-aud', email: 'aud@ye.com', fullName: 'Auditor', role: 'auditor' as const, companyId: 'comp-A' };
    expect(() => enforceAuthorization(auditorUser, 'settings:restore', 'comp-A')).toThrow(AuthorizationError);
    expect(() => enforceAuthorization(auditorUser, 'purchase:post', 'comp-A')).toThrow(AuthorizationError);
  });

  it('verifies SQL Migration 014 RLS policies, append-only stock_movements trigger, rollback script, and AndroidManifest hardening', () => {
    const root = process.cwd();
    const mig014 = fs.readFileSync(
      path.join(root, 'database/migrations/014_inventory_traceability_transfers_and_storage.sql'),
      'utf8'
    );
    const rollback014 = fs.readFileSync(path.join(root, 'database/migrations/014_rollback.sql'), 'utf8');
    const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');

    // SQL Migration 014 invariants
    expect(mig014).toContain('trg_stock_movements_append_only');
    expect(mig014).toContain('CREATE TABLE IF NOT EXISTS material_dispatches');
    expect(mig014).toContain('CREATE TABLE IF NOT EXISTS godown_transfers');
    expect(mig014).toContain('CREATE TABLE IF NOT EXISTS managed_documents');
    expect(mig014).toContain('ENABLE ROW LEVEL SECURITY');
    expect(mig014).toContain('auth_is_company_member(company_id)');
    expect(mig014).toContain('fn_post_multi_source_dispatch_atomic');
    expect(mig014).toContain('fn_confirm_godown_transfer_receipt_atomic');

    // Rollback exists & drops new objects safely
    expect(rollback014).toContain('DROP TABLE IF EXISTS godown_transfers');
    expect(rollback014).toContain('DROP TRIGGER IF EXISTS trg_stock_movements_append_only');

    // AndroidManifest security hardening
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
  });
});
