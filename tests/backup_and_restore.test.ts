import { describe, it, expect } from 'vitest';
import {
  calculateSHA256,
  encryptBackupAES,
  decryptBackupAES,
  generateBackup,
  validateBackupIntegrity,
  generateRestorePreview,
  createPreRestoreSafetySnapshot,
  executeRestore,
  calculateNextScheduledRun,
  exportRegistryAsCSV,
  computeRecordCounts,
  computeFinancialTotals,
  filterDatabaseForCompany,
  CURRENT_SCHEMA_VERSION,
} from '../backend/business-rules/backupEngine.ts';
import { 
  INITIAL_COMPANIES, 
  INITIAL_PARTIES, 
  INITIAL_INVOICES,
  INITIAL_MATERIALS,
  INITIAL_ACCOUNTS,
  INITIAL_JOURNAL_ENTRIES
} from '../src/services/mockData.ts';
import type { BackupDatabasePayload, BackupArchive, EncryptedBackupArchive, Company, Party, Invoice } from '../src/types/index.ts';

describe('Phase 5: Backup & Restore Engine', () => {
  const companyA: Company = INITIAL_COMPANIES[0]; // Yashoth Enterprises
  const companyB: Company = INITIAL_COMPANIES[1]; // Cauvery Scrap

  // Build a realistic test payload
  const mockState: BackupDatabasePayload = {
    companies: [...INITIAL_COMPANIES],
    activeCompanyId: companyA.id,
    parties: [
      { ...INITIAL_PARTIES[0], companyId: companyA.id },
      { ...INITIAL_PARTIES[1], companyId: companyA.id },
      { ...INITIAL_PARTIES[2], id: 'pty-compb-01', companyId: companyB.id, tradeName: 'Cauvery Customer 1' },
    ],
    materials: [...INITIAL_MATERIALS],
    accounts: [...INITIAL_ACCOUNTS],
    invoices: [
      {
        ...INITIAL_INVOICES[0],
        id: 'inv-comp-a-01',
        companyId: companyA.id,
        invoiceNo: 'YE/2026/01',
        grandTotal: 146367.20,
      },
      {
        ...INITIAL_INVOICES[0],
        id: 'inv-comp-b-01',
        companyId: companyB.id,
        invoiceNo: 'CS/2026/01',
        grandTotal: 50000.00,
      },
    ],
    purchases: [
      {
        id: 'po-comp-a-01',
        companyId: companyA.id,
        purchaseNo: 'PO/2026/01',
        purchaseDate: '2026-10-10',
        supplierPartyId: 'pty-supp-01',
        supplierPartyName: 'Local Vendor',
        totalAmount: 95000.00,
        subtotalAmount: 80508.47,
        taxAmount: 14491.53,
        status: 'POSTED',
        createdAt: '2026-10-10T10:00:00Z',
      } as any,
    ],
    payments: [
      {
        id: 'pay-comp-a-01',
        companyId: companyA.id,
        paymentNo: 'PAY-01',
        paymentDate: '2026-10-12',
        partyId: 'pty-cust-01',
        partyName: 'Customer A',
        accountId: 'acc-01',
        totalAmount: 60000.00,
        direction: 'INFLOW_RECEIPT',
        status: 'POSTED',
        createdAt: '2026-10-12T10:00:00Z',
      } as any,
    ],
    expenses: [
      {
        id: 'exp-comp-a-01',
        companyId: companyA.id,
        voucherNo: 'EXP-01',
        expenseDate: '2026-10-14',
        category: 'YARD_MAINTENANCE',
        amount: 2800.00,
        accountId: 'acc-01',
        paidTo: 'Hardware Store',
        createdBy: 'Admin',
        createdAt: '2026-10-14T10:00:00Z',
      },
    ],
    journalEntries: [...INITIAL_JOURNAL_ENTRIES],
  };

  describe('1. SHA-256 Hashing & Cryptographic Primitives', () => {
    it('calculates deterministic SHA-256 checksums correctly', async () => {
      const text = 'Yashoth Enterprises scrap ERP verification data 2026';
      const hash1 = await calculateSHA256(text);
      const hash2 = await calculateSHA256(text);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('detects single-character modifications via SHA-256 mismatch', async () => {
      const orig = 'Yashoth Enterprises Invoice 03 ₹146,367.20';
      const modified = 'Yashoth Enterprises Invoice 03 ₹146,367.21';

      const hashOrig = await calculateSHA256(orig);
      const hashMod = await calculateSHA256(modified);

      expect(hashOrig).not.toBe(hashMod);
    });
  });

  describe('2. Full Database Backup Generation', () => {
    it('generates a full database backup with manifest, record counts, and financial totals', async () => {
      const backupResult = await generateBackup(mockState, {
        actor: 'Senior QA Engineer',
        backupType: 'FULL_DATABASE',
        destination: 'LOCAL_FILE',
      });

      expect(backupResult.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(backupResult.historyItem.status).toBe('SUCCESS');
      expect(backupResult.historyItem.backupType).toBe('FULL_DATABASE');
      expect(backupResult.historyItem.fileSizeBytes).toBeGreaterThan(500);

      const archive = backupResult.archive as BackupArchive;
      expect(archive.manifest.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(archive.manifest.actor).toBe('Senior QA Engineer');
      expect(archive.manifest.recordCounts.parties).toBe(3);
      expect(archive.manifest.recordCounts.invoices).toBe(2);
      expect(archive.manifest.recordCounts.purchases).toBe(1);
      expect(archive.manifest.recordCounts.payments).toBe(1);
      expect(archive.manifest.recordCounts.expenses).toBe(1);

      // Financial totals reconciliation
      // Sales = 146367.20 + 50000 = 196367.20
      expect(archive.manifest.financialTotals.totalSales).toBe(196367.20);
      expect(archive.manifest.financialTotals.totalPurchases).toBe(95000.00);
      expect(archive.manifest.financialTotals.totalPayments).toBe(60000.00);
      expect(archive.manifest.financialTotals.totalExpenses).toBe(2800.00);
    });
  });

  describe('3. Company-Scoped Backup Isolation', () => {
    it('isolates company records strictly in company-scoped backups', async () => {
      const scopedBackup = await generateBackup(mockState, {
        companyId: companyA.id,
        companyName: companyA.companyName,
        backupType: 'COMPANY_SCOPED',
        actor: 'Yard Manager',
      });

      const archive = scopedBackup.archive as BackupArchive;
      expect(archive.manifest.type).toBe('COMPANY_SCOPED');
      expect(archive.manifest.companyId).toBe(companyA.id);

      // Parties belonging to company B should not exist in Company A's backup
      const parties = archive.data.parties || [];
      expect(parties.length).toBe(2);
      expect(parties.every((p) => p.companyId === companyA.id)).toBe(true);
      expect(parties.find((p) => p.tradeName === 'Cauvery Customer 1')).toBeUndefined();

      // Invoices belonging to company B should not exist in Company A's backup
      const invoices = archive.data.invoices || [];
      expect(invoices.length).toBe(1);
      expect(invoices[0].invoiceNo).toBe('YE/2026/01');
      expect(archive.manifest.financialTotals.totalSales).toBe(146367.20);
    });
  });

  describe('4. AES-256-GCM Encryption & Decryption (PBKDF2)', () => {
    it('encrypts backup and successfully decrypts with correct password', async () => {
      const password = 'StrongPassword@2026!';
      const encryptedBackup = await generateBackup(mockState, {
        companyId: companyA.id,
        actor: 'Security Architect',
        isEncrypted: true,
        password,
      });

      expect(encryptedBackup.historyItem.isEncrypted).toBe(true);
      expect(encryptedBackup.historyItem.encryptionAlgorithm).toBe('AES-256-GCM');
      expect(encryptedBackup.filename.endsWith('.yebak')).toBe(true);

      const encArchive = encryptedBackup.archive as EncryptedBackupArchive;
      expect(encArchive.isEncrypted).toBe(true);
      expect(encArchive.ciphertext).toBeDefined();
      expect(encArchive.iv).toBeDefined();
      expect(encArchive.salt).toBeDefined();

      // Decrypt using backupEngine
      const decryptedString = await decryptBackupAES(encArchive, password);
      const parsedDecrypted: BackupArchive = JSON.parse(decryptedString);

      expect(parsedDecrypted.manifest.companyId).toBe(companyA.id);
      expect(parsedDecrypted.data.parties?.length).toBe(2);
    });

    it('rejects decryption when an incorrect password is provided', async () => {
      const password = 'CorrectPassword#1';
      const wrongPassword = 'WrongPassword#999';

      const encryptedBackup = await generateBackup(mockState, {
        actor: 'Security Architect',
        isEncrypted: true,
        password,
      });

      const encArchive = encryptedBackup.archive as EncryptedBackupArchive;
      await expect(decryptBackupAES(encArchive, wrongPassword)).rejects.toThrow(/Decryption failed/i);
    });

    it('validates integrity of encrypted backup automatically via validateBackupIntegrity', async () => {
      const password = 'ValidPassword@123';
      const encResult = await generateBackup(mockState, {
        actor: 'Security Architect',
        isEncrypted: true,
        password,
      });

      // Without password -> flags encryption and asks for password
      const valWithoutPwd = await validateBackupIntegrity(encResult.rawJson);
      expect(valWithoutPwd.isValid).toBe(false);
      expect(valWithoutPwd.isEncrypted).toBe(true);
      expect(valWithoutPwd.error).toMatch(/password is required/i);

      // With correct password -> validates and parses archive
      const valWithPwd = await validateBackupIntegrity(encResult.rawJson, { password });
      expect(valWithPwd.isValid).toBe(true);
      expect(valWithPwd.isEncrypted).toBe(true);
      expect(valWithPwd.parsedArchive).toBeDefined();
      expect(valWithPwd.parsedArchive?.manifest.actor).toBe('Security Architect');
    });
  });

  describe('5. Integrity Verification & Tampering Detection', () => {
    it('detects tampering when archive JSON payload is altered', async () => {
      const plainBackup = await generateBackup(mockState, {
        actor: 'Integrity Auditor',
        destination: 'LOCAL_FILE',
      });

      const originalChecksum = plainBackup.checksum;

      // Tamper with the raw JSON string by altering an amount
      const tamperedJson = plainBackup.rawJson.replace('146367.2', '999999.9');

      const valResult = await validateBackupIntegrity(tamperedJson, {
        expectedChecksum: originalChecksum,
      });

      expect(valResult.isValid).toBe(false);
      expect(valResult.error).toMatch(/SHA-256 Integrity Verification Failed/i);
    });
  });

  describe('6. Restore Preview & Compatibility Checks', () => {
    it('generates a detailed restore preview with entity counts and financial totals', async () => {
      const backupResult = await generateBackup(mockState, {
        actor: 'Release Manager',
      });

      const preview = generateRestorePreview(backupResult.archive as BackupArchive, companyA.id);
      expect(preview.isValid).toBe(true);
      expect(preview.isCompatible).toBe(true);
      expect(preview.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(preview.recordCounts.parties).toBe(3);
      expect(preview.financialTotals.totalSales).toBe(196367.20);
      expect(preview.errors.length).toBe(0);
    });

    it('rejects unsupported future schema versions', () => {
      const incompatibleArchive: BackupArchive = {
        manifest: {
          version: '99.0.0', // Future unsupported schema version
          generatedAt: new Date().toISOString(),
          type: 'FULL_DATABASE',
          sha256: 'abc123',
          recordCounts: {},
          financialTotals: {},
          appVersion: '99.0.0',
          actor: 'Future ERP',
        },
        data: {},
      };

      const preview = generateRestorePreview(incompatibleArchive, companyA.id);
      expect(preview.isValid).toBe(false);
      expect(preview.isCompatible).toBe(false);
      expect(preview.errors.some((e) => e.includes('Incompatible schema version'))).toBe(true);
    });
  });

  describe('7. Pre-Restore Automatic Safety Snapshot', () => {
    it('creates a safety snapshot before restore execution with type SAFETY_PRE_RESTORE', async () => {
      const safetySnapshot = await createPreRestoreSafetySnapshot(mockState, 'Disaster Recovery Automator');
      
      expect(safetySnapshot.historyItem.backupType).toBe('SAFETY_PRE_RESTORE');
      expect(safetySnapshot.historyItem.status).toBe('SUCCESS');
      expect(safetySnapshot.historyItem.totalRecords).toBeGreaterThan(0);
      expect(safetySnapshot.historyItem.createdBy).toBe('Disaster Recovery Automator');
    });
  });

  describe('8. Complete Restore Execution', () => {
    it('restores complete state and generates a verified restore audit log', async () => {
      const backupResult = await generateBackup(mockState, {
        actor: 'Admin',
      });

      // Modify the current state (e.g. wiped invoices and parties)
      const corruptedState: BackupDatabasePayload = {
        ...mockState,
        parties: [],
        invoices: [],
      };

      const { restoredState, restoreLog } = executeRestore(
        backupResult.archive as BackupArchive,
        corruptedState,
        {
          backupId: backupResult.historyItem.id,
          preRestoreBackupId: 'SAFETY-SNAP-01',
          restoreMode: 'FULL',
          actor: 'Disaster Recovery Lead',
        }
      );

      // Verify records are restored
      expect(restoredState.parties?.length).toBe(3);
      expect(restoredState.invoices?.length).toBe(2);
      expect(restoredState.purchases?.length).toBe(1);

      // Verify restore log
      expect(restoreLog.status).toBe('COMPLETED');
      expect(restoreLog.sha256Verified).toBe(true);
      expect(restoreLog.restoredBy).toBe('Disaster Recovery Lead');
      expect(restoreLog.restorationType).toBe('FULL_RESTORE');
      expect(restoreLog.preRestoreBackupId).toBe('SAFETY-SNAP-01');
    });

    it('merges company-scoped restore without overwriting foreign company data', async () => {
      // Company A backup
      const compABackup = await generateBackup(mockState, {
        companyId: companyA.id,
        backupType: 'COMPANY_SCOPED',
        actor: 'Admin A',
      });

      // Current state contains Company B records and an old Company A party
      const currentMixedState: BackupDatabasePayload = {
        parties: [
          { ...INITIAL_PARTIES[0], id: 'old-comp-a-pty', companyId: companyA.id, tradeName: 'Old A' },
          { ...INITIAL_PARTIES[1], id: 'comp-b-pty', companyId: companyB.id, tradeName: 'Permanent Company B Party' },
        ],
        invoices: [
          { ...INITIAL_INVOICES[0], id: 'comp-b-inv', companyId: companyB.id, invoiceNo: 'CS/PERMANENT/01' },
        ],
      };

      const { restoredState, restoreLog } = executeRestore(
        compABackup.archive as BackupArchive,
        currentMixedState,
        {
          backupId: compABackup.historyItem.id,
          preRestoreBackupId: 'SAFETY-02',
          restoreMode: 'COMPANY_SCOPED',
          companyId: companyA.id,
          actor: 'Admin A',
        }
      );

      // Company B's records must remain intact!
      const compBParties = restoredState.parties?.filter((p) => p.companyId === companyB.id) || [];
      expect(compBParties.length).toBe(1);
      expect(compBParties[0].tradeName).toBe('Permanent Company B Party');

      const compBInvoices = restoredState.invoices?.filter((i) => i.companyId === companyB.id) || [];
      expect(compBInvoices.length).toBe(1);
      expect(compBInvoices[0].invoiceNo).toBe('CS/PERMANENT/01');

      // Company A's records replaced with the backup's Company A records
      const compAParties = restoredState.parties?.filter((p) => p.companyId === companyA.id) || [];
      expect(compAParties.length).toBe(2);
      expect(compAParties.find((p) => p.tradeName === 'Old A')).toBeUndefined();

      expect(restoreLog.restorationType).toBe('COMPANY_RESTORE');
      expect(restoreLog.status).toBe('COMPLETED');
    });
  });

  describe('9. Automated Backup Schedule Calculator', () => {
    const baseDate = new Date('2026-10-01T02:00:00Z');

    it('calculates DAILY schedule next run (+24h)', () => {
      const nextRun = calculateNextScheduledRun('DAILY', baseDate);
      expect(nextRun).toBe('2026-10-02T02:00:00.000Z');
    });

    it('calculates WEEKLY schedule next run (+7 days)', () => {
      const nextRun = calculateNextScheduledRun('WEEKLY', baseDate);
      expect(nextRun).toBe('2026-10-08T02:00:00.000Z');
    });

    it('calculates MONTHLY schedule next run (+30 days)', () => {
      const nextRun = calculateNextScheduledRun('MONTHLY', baseDate);
      expect(nextRun).toBe('2026-10-31T02:00:00.000Z');
    });

    it('returns null for MANUAL_ONLY schedule', () => {
      const nextRun = calculateNextScheduledRun('MANUAL_ONLY', baseDate);
      expect(nextRun).toBeNull();
    });
  });

  describe('10. CSV Spreadsheet Registry Exports', () => {
    it('exports customer registry with accurate headers and escaped values', () => {
      const customers = [
        { partyCode: 'CUST-01', tradeName: 'Tejas Steel & "Alloys"', gstin: '33AAACT1111A1Z1', currentBalance: 50000 },
        { partyCode: 'CUST-02', tradeName: 'Kaveri Foundry', gstin: '33AAACK2222B1Z2', currentBalance: -15000 },
      ];

      const csv = exportRegistryAsCSV(customers, [
        { header: 'Party Code', key: 'partyCode' },
        { header: 'Trade Name', key: 'tradeName' },
        { header: 'GSTIN', key: 'gstin' },
        { header: 'Balance', key: 'currentBalance' },
      ]);

      const lines = csv.split('\n');
      expect(lines[0]).toBe('"Party Code","Trade Name","GSTIN","Balance"');
      expect(lines[1]).toContain('"Tejas Steel & ""Alloys"""');
      expect(lines[2]).toContain('"Kaveri Foundry"');
    });
  });
});
