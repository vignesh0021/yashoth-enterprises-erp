import { describe, it, expect } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  generateBackup,
  generateRestorePreview,
  executeRestoreWithRollback,
  verifyRestoreReconciliation,
} from '../backend/business-rules/backupEngine.ts';
import type { BackupArchive, BackupDatabasePayload } from '../src/types/index.ts';

describe('Full Backward-Compatible Backup & Restore Verification', () => {
  it('migrates and restores a 1.0.0 production-format backup into 2.0.0 with exact record counts and zero balance drift', async () => {
    const legacyPayload: BackupDatabasePayload = {
      companies: [
        {
          id: 'comp-1',
          code: 'YE-MAIN',
          name: 'Yashoth Enterprises',
          companyName: 'Yashoth Enterprises',
          legalName: 'YASHOTH ENTERPRISES',
          addressLine1: '128/40 Ambedkar St',
          city: 'Ponneri',
          stateName: 'Tamil Nadu',
          stateCode: '33',
          pincode: '601206',
          gstin: '33AXVPN9382L1ZF',
          phone: '9444012345',
          email: 'ye@test.in',
          bankName: 'City Union Bank',
          bankAccountNo: '510909010195638',
          bankBranch: 'Ponneri',
          bankBranchIfsc: 'CIUB0000439',
          invoicePrefix: 'YE/',
          purchasePrefix: 'PO/',
          defaultBaseUnit: 'KG',
          currency: 'INR',
          isActive: true,
        },
      ],
      activeCompanyId: 'comp-1',
      accounts: [
        {
          id: 'acc-cash-1',
          companyId: 'comp-1',
          accountCode: 'CASH-YARD',
          accountName: 'Yard Cash Box',
          accountType: 'CASH',
          openingBalance: 0,
          openingBalanceDate: '2026-10-01',
          isActive: true,
        },
      ],
      accountTransactions: [
        {
          id: 'atx-1',
          companyId: 'comp-1',
          accountId: 'acc-cash-1',
          transactionDate: '2026-10-01',
          transactionType: 'OWNER_INJECTION',
          direction: 'DEBIT',
          amount: 27000,
          referenceNo: 'CAP-1',
          description: 'Owner Cash',
          createdBy: 'Admin',
          createdAt: '2026-10-01T09:00:00Z',
        },
      ],
      expenses: [
        {
          id: 'exp-1',
          companyId: 'comp-1',
          voucherNo: 'EXP-26-0001',
          expenseDate: '2026-10-02',
          category: 'Diesel / Petrol',
          amount: 1200,
          accountId: 'acc-cash-1',
          paymentMode: 'CASH',
          paidTo: 'HP Pump',
          createdBy: 'Admin',
          createdAt: '2026-10-02T10:00:00Z',
        },
      ],
      payments: [
        {
          id: 'pay-1',
          companyId: 'comp-1',
          paymentNo: 'PAY-001',
          paymentDate: '2026-10-03',
          direction: 'OUTFLOW_PAYMENT',
          partyId: 'sup-1',
          accountId: 'acc-cash-1',
          totalAmount: 3000,
          unallocatedAmount: 0,
          paymentMethod: 'CASH',
          allocations: [],
          createdBy: 'Admin',
          createdAt: '2026-10-03T11:00:00Z',
        },
      ],
      journalEntries: [
        {
          id: 'je-1',
          companyId: 'comp-1',
          entryNo: 'JV-001',
          entryDate: '2026-10-01',
          sourceType: 'OPENING_BALANCE',
          sourceId: 'atx-1',
          narration: 'Owner Cash',
          lines: [
            { id: 'jl-1', accountCode: '1010', accountName: 'Cash on Hand', debit: 27000, credit: 0 },
            { id: 'jl-2', accountCode: '3010', accountName: 'Proprietor Capital', debit: 0, credit: 27000 },
          ],
          totalDebit: 27000,
          totalCredit: 27000,
          isPosted: true,
          createdBy: 'Admin',
          createdAt: '2026-10-01T09:00:00Z',
        },
      ],
      dailyCashClosings: [
        {
          id: 'dcc-1',
          companyId: 'comp-1',
          closingDate: '2026-10-02',
          openingCash: 27000,
          todayCashInflow: 0,
          todayCashOutflow: 1200,
          expectedCashInHand: 25800,
          physicallyCountedCash: 25800,
          cashDifference: 0,
          closedBy: 'Admin',
          closedAt: '2026-10-02T19:00:00Z',
        },
      ],
    };

    const legacyArchive: BackupArchive = {
      manifest: {
        version: '1.0.0',
        generatedAt: '2026-10-03T12:00:00Z',
        type: 'FULL_DATABASE',
        companyId: null,
        companyName: 'Consolidated ERP',
        sha256: 'legacy-sha',
        recordCounts: {
          companies: 1,
          accounts: 1,
          accountTransactions: 1,
          expenses: 1,
          payments: 1,
          journalEntries: 1,
          dailyCashClosings: 1,
        },
        financialTotals: { totalSales: 0, totalPurchases: 0, totalPayments: 3000, totalExpenses: 1200 },
        appVersion: '1.0.0',
        actor: 'Admin',
      },
      data: legacyPayload,
    };

    expect(SUPPORTED_SCHEMA_VERSIONS).toContain('1.0.0');
    expect(CURRENT_SCHEMA_VERSION).toBe('2.0.0');

    const preview = generateRestorePreview(legacyArchive, 'comp-1', {});
    expect(preview.isValid).toBe(true);
    expect(preview.isCompatible).toBe(true);
    expect(preview.warnings.some((w) => w.includes('1.0.0'))).toBe(true);

    const { restoredState, restoreLog, rolledBack } = executeRestoreWithRollback(legacyArchive, {}, {
      backupId: 'bkp-legacy-1',
      preRestoreBackupId: 'snap-1',
      restoreMode: 'FULL',
      actor: 'Admin',
    });

    expect(rolledBack).toBe(false);
    expect(restoreLog.status).toBe('COMPLETED');
    expect(restoredState.expenses?.[0].paidByType).toBe('COMPANY');
    expect(restoredState.expenses?.[0].status).toBe('PAID');
    expect(restoredState.payments?.[0].status).toBe('COMPLETED');
    expect(restoredState.dailyCashClosings).toHaveLength(1);

    const recon = verifyRestoreReconciliation(legacyPayload, restoredState);
    expect(recon.isExactMatch).toBe(true);
    expect(recon.mismatchedTables).toHaveLength(0);
    expect(recon.financialDiffs.totalExpenses).toBe(0);
    expect(recon.financialDiffs.totalPayments).toBe(0);
  });

  it('detects conflicts, skips duplicate IDs in non-destructive merge, and verifies attachment checksums', async () => {
    const payload: BackupDatabasePayload = {
      companies: [],
      expenses: [
        {
          id: 'exp-dup',
          companyId: 'comp-1',
          voucherNo: 'EXP-1',
          expenseDate: '2026-10-05',
          category: 'Office Expenses',
          amount: 500,
          accountId: 'acc-1',
          paymentMode: 'CASH',
          status: 'PAID',
          paidTo: 'Shop',
          createdBy: 'Admin',
          createdAt: '2026-10-05T10:00:00Z',
        },
      ],
      documentAttachments: [
        {
          id: 'att-1',
          companyId: 'comp-1',
          parentEntityType: 'EXPENSE',
          parentEntityId: 'exp-dup',
          storageBucket: 'erp-receipts',
          storagePath: 'comp-1/expense/exp-dup/att-1.webp',
          originalFilename: 'receipt.webp',
          mimeType: 'image/webp',
          fileSizeBytes: 120000,
          sha256Checksum: 'a'.repeat(64),
          uploadStatus: 'COMMITTED',
          integrityStatus: 'OK',
          uploadedBy: 'user-1',
          reservedAt: '2026-10-05T10:00:00Z',
        },
      ],
    };

    const generated = await generateBackup(payload, { actor: 'Admin' });
    const archive = generated.archive as BackupArchive;
    expect(archive.manifest.attachmentChecksums?.['att:att-1']).toBe('a'.repeat(64));

    const preview = generateRestorePreview(archive, 'comp-1', payload);
    expect(preview.conflicts?.some((c) => c.table === 'expenses' && c.duplicateIds.includes('exp-dup'))).toBe(true);
    expect(preview.attachmentVerification?.verified).toBe(1);

    const { restoredState } = executeRestoreWithRollback(archive, payload, {
      backupId: archive.manifest.sha256,
      preRestoreBackupId: 'snap-2',
      restoreMode: 'FULL',
      actor: 'Admin',
      preventOverwrite: true,
    });
    expect(restoredState.expenses).toHaveLength(1);
  });

  it('rolls back automatically if restored journal entries are unbalanced', () => {
    const cleanState: BackupDatabasePayload = { expenses: [], journalEntries: [] };
    const corruptedArchive: BackupArchive = {
      manifest: {
        version: '2.0.0',
        generatedAt: '2026-10-05T10:00:00Z',
        type: 'FULL_DATABASE',
        sha256: 'bad',
        recordCounts: { journalEntries: 1 },
        financialTotals: {},
        appVersion: '2.0.0',
        actor: 'Admin',
      },
      data: {
        journalEntries: [
          {
            id: 'je-bad',
            companyId: 'comp-1',
            entryNo: 'JV-BAD',
            entryDate: '2026-10-05',
            sourceType: 'MANUAL',
            narration: 'Corrupted',
            lines: [{ id: 'l1', accountCode: '1010', accountName: 'Cash', debit: 1000, credit: 0 }],
            totalDebit: 1000,
            totalCredit: 0,
            isPosted: true,
            createdBy: 'Admin',
            createdAt: '2026-10-05T10:00:00Z',
          },
        ],
      },
    };

    const res = executeRestoreWithRollback(corruptedArchive, cleanState, {
      backupId: 'bad',
      preRestoreBackupId: 'snap-3',
      restoreMode: 'FULL',
      actor: 'Admin',
    });

    expect(res.rolledBack).toBe(true);
    expect(res.restoreLog.status).toBe('ROLLED_BACK');
    expect(res.restoredState.journalEntries).toHaveLength(0);
  });
});
