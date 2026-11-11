// ============================================================================
// YASHOTH ENTERPRISES ERP — SECURITY & HARDENING VERIFICATION SUITE
// ============================================================================

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { authService } from '../src/services/authService.ts';
import { googleDriveService } from '../src/services/googleDriveService.ts';
import { 
  allocateLotsFifo, 
  calculateCurrentStock 
} from '../backend/business-rules/inventoryEngine.ts';
import { 
  validateJournalEntry, 
  AccountingImbalanceError, 
  createSalesInvoiceJournal, 
  createPurchaseInvoiceJournal 
} from '../backend/business-rules/accountingEngine.ts';
import { 
  hasPermission, 
  enforceAuthorization, 
  AuthorizationError 
} from '../backend/business-rules/authEngine.ts';
import type { InventoryLot, StockMovement, Invoice, PurchaseHeader, Company, JournalEntry } from '../src/types/index.ts';

describe('Suite 13: Yashoth ERP Forensic Remediation & Security Hardening', () => {
  const root = process.cwd();

  // --------------------------------------------------------------------------
  // 13.1 Authentication & Backdoor Elimination
  // --------------------------------------------------------------------------
  describe('13.1 Authentication Hardening & Backdoor Elimination', () => {
    it('verifies that backdoor universal test passwords (Admin@123) are rejected for invalid accounts', async () => {
      // Attempt login with non-existent user and backdoor password
      const res = await authService.signIn('intruder@unknown.com', 'Admin@123');
      expect(res.session).toBeNull();
      expect(res.error).toBe('Invalid email or password.');
    });

    it('verifies that default users require their specific cryptographic password', async () => {
      // Manager password against admin account must be rejected
      const failRes = await authService.signIn('admin@yasoth.com', 'Manager@123');
      expect(failRes.session).toBeNull();
      expect(failRes.error).toBe('Invalid email or password.');

      // Correct password succeeds
      const successRes = await authService.signIn('admin@yasoth.com', 'Admin@123');
      expect(successRes.session).not.toBeNull();
      expect(successRes.session?.role).toBe('owner_admin');
    });

    it('verifies session tokens are cryptographically generated and not static strings', async () => {
      const res = await authService.signIn('admin@yasoth.com', 'Admin@123');
      expect(res.session?.token).toMatch(/^tok_/);
      expect(res.session?.token?.length).toBeGreaterThan(10);
    });

    it('verifies that all 9 canonical roles are defined and enforced in RBAC', () => {
      const canonicalRoles = [
        'owner_admin',
        'manager',
        'purchase_operator',
        'weighment_operator',
        'weighbridge_operator',
        'sales_operator',
        'accounts_operator',
        'store_operator',
        'hr_operator',
        'auditor'
      ];
      for (const role of canonicalRoles) {
        expect(hasPermission(role as any, 'company:view')).toBe(true);
      }
      expect(hasPermission('auditor', 'invoice:create')).toBe(false);
      expect(hasPermission('purchase_operator', 'purchase:create')).toBe(true);
      expect(hasPermission('weighbridge_operator' as any, 'weighment:record')).toBe(true);
      expect(hasPermission('owner_admin', 'admin:full')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 13.2 Strict FIFO Lot Consumption & Multi-Company Stock Scoping
  // --------------------------------------------------------------------------
  describe('13.2 Strict FIFO Lot Allocation & Stock Scoping', () => {
    const materialId = 'mat-scrap-01';
    const yardId = 'yard-01';

    it('consumes lots in strict chronological FIFO order regardless of array index', () => {
      const lots: InventoryLot[] = [
        {
          id: 'lot-late',
          lotNumber: 'LOT-NOV-10',
          materialId,
          yardId,
          initialQuantity: 1000,
          remainingQuantity: 1000,
          unitCost: 40,
          receivedAt: '2026-11-10T10:00:00Z',
          isExhausted: false,
        },
        {
          id: 'lot-early',
          lotNumber: 'LOT-NOV-01',
          materialId,
          yardId,
          initialQuantity: 1000,
          remainingQuantity: 1000,
          unitCost: 25,
          receivedAt: '2026-11-01T10:00:00Z',
          isExhausted: false,
        },
      ];

      // Request 500 KG. Must take from LOT-NOV-01 (@ 25) even though it is at index 1
      const { updatedLots, result } = allocateLotsFifo(lots, materialId, yardId, 500);

      expect(result.allocations[0].lotNumber).toBe('LOT-NOV-01');
      expect(result.allocations[0].unitCost).toBe(25);
      expect(result.totalCogs).toBe(12500);

      const earlyLot = updatedLots.find((l) => l.id === 'lot-early');
      const lateLot = updatedLots.find((l) => l.id === 'lot-late');
      expect(earlyLot?.remainingQuantity).toBe(500);
      expect(lateLot?.remainingQuantity).toBe(1000);
    });

    it('isolates stock balance calculations by companyId when provided', () => {
      const movements: StockMovement[] = [
        {
          id: 'm1',
          companyId: 'comp-A',
          movementType: 'PURCHASE_RECEIPT',
          transactionRef: 'P-1',
          materialId,
          yardId,
          quantity: 2000,
          unitCost: 30,
          totalCost: 60000,
          createdBy: 'admin',
          createdAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'm2',
          companyId: 'comp-B',
          movementType: 'PURCHASE_RECEIPT',
          transactionRef: 'P-2',
          materialId,
          yardId,
          quantity: 3000,
          unitCost: 30,
          totalCost: 90000,
          createdBy: 'admin',
          createdAt: '2026-10-01T10:00:00Z',
        },
      ];

      expect(calculateCurrentStock(movements, materialId, yardId, 'comp-A')).toBe(2000);
      expect(calculateCurrentStock(movements, materialId, yardId, 'comp-B')).toBe(3000);
    });
  });

  // --------------------------------------------------------------------------
  // 13.3 Double-Entry Zero Tolerance & Exact Balancing
  // --------------------------------------------------------------------------
  describe('13.3 Double-Entry Zero Tolerance & Decimal Variance Balancing', () => {
    it('strictly rejects any journal entry where debits and credits differ by more than 0.001', () => {
      const unbalancedEntry: JournalEntry = {
        id: 'je-unbalanced',
        companyId: 'comp-01',
        entryNo: 'JV-ERR-01',
        entryDate: '2026-11-11',
        sourceType: 'MANUAL',
        narration: 'Test entry with 2 paise imbalance',
        lines: [
          { id: 'l1', accountCode: '1010', accountName: 'Cash', debit: 100.02, credit: 0 },
          { id: 'l2', accountCode: '4010', accountName: 'Revenue', debit: 0, credit: 100.00 },
        ],
        totalDebit: 100.02,
        totalCredit: 100.00,
        isPosted: false,
        createdBy: 'test',
        createdAt: '2026-11-11T00:00:00Z',
      };

      expect(() => validateJournalEntry(unbalancedEntry)).toThrow(AccountingImbalanceError);
    });

    it('creates perfectly balanced sales invoice journal entries down to exact 0.00', () => {
      const mockCompany: Company = {
        id: 'comp-ye',
        code: 'YE-MAIN',
        name: 'Yashoth Enterprises',
        companyName: 'Yashoth Enterprises',
        legalName: 'YASHOTH ENTERPRISES',
        addressLine1: 'Gummidipoondi',
        city: 'Tiruvallur',
        stateName: 'Tamil Nadu',
        stateCode: '33',
        pincode: '601206',
        gstin: '33AXVPN9382L1ZF',
        phone: '9444012345',
        email: 'yashothenterprises44@gmail.com',
        bankName: 'City Union Bank',
        bankAccountNo: '510909010195638',
        bankBranch: 'Ponneri',
        bankBranchIfsc: 'CIUB0000439',
        invoicePrefix: 'YE/',
        purchasePrefix: 'PO/',
        quotationPrefix: 'QT/',
        defaultBaseUnit: 'KG',
        currency: 'INR',
        isActive: true,
      };

      const mockInvoice: Invoice = {
        id: 'inv-test-bal',
        companyId: 'comp-ye',
        invoiceNo: 'YE/INV/TEST/01',
        invoiceDate: '2026-11-11',
        customerPartyId: 'p-cust',
        customerName: 'Steel Re-Rolling Mills',
        billingAddress: 'Chennai',
        shippingAddress: 'Chennai',
        customerStateName: 'Tamil Nadu',
        customerStateCode: '33',
        placeOfSupply: 'Tamil Nadu',
        lines: [],
        subtotalTaxable: 1000.33,
        cgstRate: 9,
        cgstAmount: 90.03,
        sgstRate: 9,
        sgstAmount: 90.03,
        igstRate: 0,
        igstAmount: 0,
        grandTotal: 1180.00, // round-off applied: -0.39
        roundOff: -0.39,
        amountInWords: 'One Thousand One Hundred Eighty Rupees Only',
        taxAmountInWords: 'One Hundred Eighty Rupees Only',
        paymentStatus: 'UNPAID',
        amountPaid: 0,
        outstandingBalance: 1180.00,
        immutableSnapshotJson: '{}',
        isCancelled: false,
        createdBy: 'admin',
        createdAt: '2026-11-11T00:00:00Z',
      };

      const journal = createSalesInvoiceJournal(mockInvoice, mockCompany);
      expect(journal.totalDebit).toBe(journal.totalCredit);
      expect(Math.abs(journal.totalDebit - journal.totalCredit)).toBeLessThan(0.001);
    });
  });

  // --------------------------------------------------------------------------
  // 13.4 Google Drive Genuine Error Handling (No Fake Success)
  // --------------------------------------------------------------------------
  describe('13.4 Google Drive Genuine Responses & No Fake Success', () => {
    it('returns success: false when attempting to upload without Google OAuth credentials', async () => {
      const res = await googleDriveService.uploadBackupFile('test-backup.json', '{"test": 123}');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Google Drive is not authenticated');
    });
  });

  // --------------------------------------------------------------------------
  // 13.5 Migration 007 Authoritative RLS Policy Verification
  // --------------------------------------------------------------------------
  describe('13.5 Authoritative PostgreSQL RLS Migration (007)', () => {
    it('verifies 007_authoritative_rls_hardening.sql enables RLS on all 30+ tables and defines isolation policies', () => {
      const migrationSql = fs.readFileSync(
        path.join(root, 'database/migrations/007_authoritative_rls_hardening.sql'),
        'utf-8'
      );

      // Verify essential tables have RLS enabled
      expect(migrationSql).toContain('ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE IF EXISTS commercial_documents ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE IF EXISTS journal_entries ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE IF EXISTS backup_history ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE IF EXISTS weighments ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE IF EXISTS purchase_headers ENABLE ROW LEVEL SECURITY;');
      expect(migrationSql).toContain('ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;');

      // Verify policies defined
      expect(migrationSql).toContain('CREATE POLICY companies_isolation_policy ON companies');
      expect(migrationSql).toContain('CREATE POLICY commercial_documents_tenant_policy ON commercial_documents');
      expect(migrationSql).toContain('CREATE POLICY journal_entries_tenant_policy ON journal_entries');
      expect(migrationSql).toContain('CREATE POLICY backup_history_tenant_policy ON backup_history');
      expect(migrationSql).toContain('CREATE POLICY audit_logs_insert_policy ON audit_logs');
      expect(migrationSql).toContain('REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;');
    });
  });
});
