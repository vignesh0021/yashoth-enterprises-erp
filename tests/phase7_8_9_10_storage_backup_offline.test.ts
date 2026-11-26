import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ManagedDocument, UploadedDocument, BackupHistoryItem } from '../src/types/index.ts';
import {
  generateBackup,
  compressBackupGzip,
  decompressBackupGzip,
  validateBackupIntegrity,
  executeRestoreWithRollback,
  applyBackupRetention,
  calculateSHA256,
} from '../backend/business-rules/backupEngine.ts';
import {
  detectDuplicateDocument,
  generateWebPPreview,
  migrateBase64DocumentsToDrive,
  rollbackDocumentMigration,
  computeStorageMonitorSnapshot,
} from '../backend/business-rules/documentStorageEngine.ts';
import { googleDriveService } from '../src/services/googleDriveService.ts';
import { teamSyncService } from '../src/services/teamSyncService.ts';
import { offlineSyncService } from '../src/services/offlineSyncService.ts';

describe('Phases 7, 8, 9 & 10 — Storage Optimization, Real Google Drive Backup, Quota Monitor & Offline Sync', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    offlineSyncService.clearAllDataForTesting();
    (googleDriveService as any).accessToken = null;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (googleDriveService as any).accessToken = null;
    vi.restoreAllMocks();
  });

  describe('Phase 7 — Document Duplicate Detection, WebP Preview & Safe Base64-to-Drive Migration + Rollback', () => {
    it('detects SHA-256 duplicates without auto-merging different transactions', () => {
      const existing: ManagedDocument[] = [
        {
          id: 'mdoc-1',
          companyId: 'comp-1',
          documentType: 'WEIGHBRIDGE_SLIP',
          documentNumber: '59',
          transactionRef: 'DSP-001',
          storageProvider: 'GOOGLE_DRIVE',
          remoteFileId: 'gd-file-59',
          originalFileName: 'bill59.pdf',
          originalMimeType: 'application/pdf',
          originalSizeBytes: 51200,
          sha256Checksum: 'a'.repeat(64),
          uploadStatus: 'VERIFIED',
          uploadedBy: 'Admin',
          uploadedAt: '2026-11-26T10:00:00Z',
        },
      ];

      // Same checksum + same transaction -> blocked duplicate
      const sameTx = detectDuplicateDocument(
        { companyId: 'comp-1', sha256Checksum: 'a'.repeat(64), documentType: 'WEIGHBRIDGE_SLIP', transactionRef: 'DSP-001' },
        existing
      );
      expect(sameTx.isDuplicate).toBe(true);
      expect(sameTx.sameTransaction).toBe(true);

      // Same checksum + DIFFERENT transaction -> flagged as duplicate, NOT auto-merged
      const diffTx = detectDuplicateDocument(
        { companyId: 'comp-1', sha256Checksum: 'a'.repeat(64), documentType: 'WEIGHBRIDGE_SLIP', transactionRef: 'DSP-002' },
        existing
      );
      expect(diffTx.isDuplicate).toBe(true);
      expect(diffTx.sameTransaction).toBe(false);
    });

    it('generates preview metadata while keeping original legal evidence untouched', async () => {
      const orig = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
      const preview = await generateWebPPreview(orig);
      expect(preview.originalUntouched).toBe(true);
      expect(preview.originalSizeBytes).toBeGreaterThan(0);
    });

    it('migrates legacy Base64 docs to Drive with SHA-256 verification, retains failed ones, and supports full rollback', async () => {
      const legacyDocs: UploadedDocument[] = [
        {
          id: 'up-1',
          companyId: 'comp-1',
          category: 'PREVIOUS_INVOICE',
          referenceNo: 'IN4202605071',
          title: 'IMOP Invoice',
          documentDate: '2026-11-26',
          fileName: 'IMOP_IN4202605071.pdf',
          fileType: 'application/pdf',
          fileSize: 2048,
          fileDataUrl: 'data:application/pdf;base64,' + 'B'.repeat(600),
          createdAt: '2026-11-26T09:00:00Z',
        },
        {
          id: 'up-2',
          companyId: 'comp-1',
          category: 'VEHICLE_DOC',
          referenceNo: 'RC-TN18',
          title: 'Truck RC',
          documentDate: '2026-11-26',
          fileName: 'RC_TN18.pdf',
          fileType: 'application/pdf',
          fileSize: 2048,
          fileDataUrl: 'data:application/pdf;base64,' + 'C'.repeat(600),
          createdAt: '2026-11-26T09:00:00Z',
        },
      ];

      const stored = new Map<string, string>();
      const migration = await migrateBase64DocumentsToDrive({
        companyId: 'comp-1',
        legacyDocuments: legacyDocs,
        actor: 'Admin',
        purgeBase64AfterVerification: true,
        adapter: {
          uploadOriginal: async (filename, content) => {
            if (filename.includes('RC_TN18')) {
              return { success: false, error: 'Simulated network drop' };
            }
            const id = 'gdrive-doc-' + filename;
            stored.set(id, content);
            return { success: true, fileId: id };
          },
          verifyRemoteFile: async (fileId, expectedSha256) => {
            const content = stored.get(fileId);
            if (!content) return { verified: false, error: 'Missing' };
            const actual = await calculateSHA256(content);
            return { verified: actual === expectedSha256 };
          },
        },
      });

      expect(migration.report.totalIdentified).toBe(2);
      expect(migration.report.migratedCount).toBe(1);
      expect(migration.report.failedCount).toBe(1);
      expect(migration.newManagedDocuments).toHaveLength(1);
      // Verified doc updated to remote ref; failed doc MUST retain its Base64 original!
      expect(migration.updatedLegacyDocuments.find((d) => d.id === 'up-1')!.fileDataUrl).toMatch(/^gdrive:\/\//);
      expect(migration.updatedLegacyDocuments.find((d) => d.id === 'up-2')!.fileDataUrl).toContain('data:application/pdf;base64,');

      // Rollback restores original Base64 copy completely
      const rolled = rollbackDocumentMigration(migration.report.rollbackSnapshot, migration.newManagedDocuments);
      expect(rolled.restoredLegacyDocuments.find((d) => d.id === 'up-1')!.fileDataUrl).toContain('data:application/pdf;base64,');
      expect(rolled.updatedManagedDocuments[0].migrationStatus).toBe('ROLLED_BACK');
    });
  });

  describe('Phase 8 — Real Google Drive GZIP Upload, Remote SHA-256 Verification, Restore & No False Cloud Claims', () => {
    it('fails closed when unauthenticated — NEVER claims localStorage is cloud backup', async () => {
      const res = await teamSyncService.pushToCloud({ parties: [], invoices: [] }, 'Admin');
      expect(res.success).toBe(false);
      expect(res.remoteVerified).toBe(false);
      expect(res.isLocalOnly).toBe(true);
    });

    it('compresses with GZIP, uploads to Drive, verifies remote SHA-256, downloads & restores cleanly', async () => {
      const state = {
        activeCompanyId: 'comp-1',
        companies: [{ id: 'comp-1', code: 'YE', name: 'Yashoth Enterprises', companyName: 'Yashoth Enterprises', legalName: 'Yashoth Enterprises', addressLine1: 'Chennai', city: 'Chennai', stateName: 'Tamil Nadu', stateCode: '33', pincode: '600001', gstin: '33AXVPN9382L1ZF', phone: '9999999999', email: 'yashothenterprises44@gmail.com', bankName: 'SBI', bankAccountNo: '123', bankBranch: 'Main', bankBranchIfsc: 'SBIN0001', invoicePrefix: 'YE/', purchasePrefix: 'PUR/', defaultBaseUnit: 'KG', currency: 'INR', isActive: true }],
        parties: [],
        invoices: [],
        purchases: [],
      };
      const generated = await generateBackup(state as any, { actor: 'Admin', destination: 'GOOGLE_DRIVE' });

      // Test GZIP roundtrip directly
      const gz = await compressBackupGzip(generated.rawJson);
      expect(gz.compressedSizeBytes).toBeLessThan(gz.originalSizeBytes);
      const decompressed = await decompressBackupGzip(gz.base64);
      expect(decompressed).toBe(generated.rawJson);

      // Simulate Google Drive multipart upload & download endpoints
      const remoteVault = new Map<string, string>();
      (googleDriveService as any).accessToken = 'valid-oauth-token-test';
      globalThis.fetch = vi.fn(async (url: any, init?: any) => {
        const u = String(url);
        if (u.includes('/upload/drive/v3/files') && init?.method === 'POST') {
          const bodyStr = String(init.body || '');
          const parts = bodyStr.split('\r\n\r\n');
          const rawTail = parts[parts.length - 1];
          const closeIdx = rawTail.indexOf('\r\n--');
          const fileBody = closeIdx >= 0 ? rawTail.slice(0, closeIdx) : rawTail;
          remoteVault.set('drive-file-verified-001', fileBody);
          return new Response(JSON.stringify({ id: 'drive-file-verified-001' }), { status: 200 });
        }
        if (u.includes('/drive/v3/files/drive-file-verified-001?alt=media')) {
          return new Response(remoteVault.get('drive-file-verified-001') || '', { status: 200 });
        }
        return new Response('{}', { status: 404 });
      }) as any;

      const uploaded = await googleDriveService.uploadBackupFileVerified({
        filename: generated.filename,
        content: generated.rawJson,
        compressGzip: true,
      });
      expect(uploaded.success).toBe(true);
      expect(uploaded.remoteVerified).toBe(true);
      expect(uploaded.fileId).toBe('drive-file-verified-001');
      expect(uploaded.compressionFormat).toBe('GZIP');

      // Download from Drive (transparently decompresses GZIP) & restore
      const downloaded = await googleDriveService.downloadFile('drive-file-verified-001');
      expect(downloaded.success).toBe(true);
      const validation = await validateBackupIntegrity(downloaded.content!);
      expect(validation.isValid).toBe(true);

      const restored = executeRestoreWithRollback(validation.parsedArchive!, {}, {
        backupId: generated.checksum,
        preRestoreBackupId: 'snap-pre-1',
        restoreMode: 'FULL',
        actor: 'Admin',
      });
      expect(restored.rolledBack).toBe(false);
      expect(restored.restoreLog.status).toBe('COMPLETED');
      expect(restored.restoredState.companies).toHaveLength(1);
    });

    it('never deletes the only valid backup under retention pruning', () => {
      const singleValid: BackupHistoryItem[] = [
        {
          id: 'bak-only-1',
          backupName: 'YE_FULL.json.gz',
          backupType: 'FULL_DATABASE',
          destination: 'GOOGLE_DRIVE',
          fileSizeBytes: 1000,
          sha256Checksum: 'abc',
          isEncrypted: false,
          schemaVersion: '2.0.0',
          totalRecords: 10,
          recordCountsJson: {},
          financialTotalsJson: {},
          status: 'VERIFIED',
          createdBy: 'Admin',
          createdAt: '2026-11-26T00:00:00Z',
        },
      ];
      const res = applyBackupRetention(singleValid, 0);
      expect(res.kept).toHaveLength(1);
      expect(res.pruned).toHaveLength(0);
    });
  });

  describe('Phase 9 — Supabase Free-Tier Quota Monitor (70% / 85% / 95% Thresholds)', () => {
    it('classifies OK, WARNING (70%), CRITICAL (85%), and ADMIN_ALERT (95% with upload restriction)', () => {
      const base = { databasePayload: {}, managedDocuments: [], uploadedDocuments: [], backupHistory: [] };
      expect(computeStorageMonitorSnapshot({ ...base, observedDatabaseUsedMb: 200 }).alertLevel).toBe('OK');
      expect(computeStorageMonitorSnapshot({ ...base, observedDatabaseUsedMb: 360 }).alertLevel).toBe('WARNING'); // 72%
      expect(computeStorageMonitorSnapshot({ ...base, observedDatabaseUsedMb: 430 }).alertLevel).toBe('CRITICAL'); // 86%
      const admin = computeStorageMonitorSnapshot({ ...base, observedDatabaseUsedMb: 480 }); // 96%
      expect(admin.alertLevel).toBe('ADMIN_ALERT');
      expect(admin.uploadsRestricted).toBe(true);
    });
  });

  describe('Phase 10 — Offline Queue, Idempotency Keys, Conflict Resolution & Pending Upload Queue', () => {
    it('prevents duplicate posting via idempotencyKey and retries pending uploads on reconnect', async () => {
      const m1 = offlineSyncService.enqueueMutation({
        companyId: 'comp-1',
        entityType: 'DISPATCH',
        entityId: 'dsp-100',
        action: 'CREATE',
        idempotencyKey: 'idem-dsp-100',
        payload: { netWeight: 3530 },
      });
      // Re-enqueueing same idempotencyKey returns existing mutation (no duplicate!)
      const m2 = offlineSyncService.enqueueMutation({
        companyId: 'comp-1',
        entityType: 'DISPATCH',
        entityId: 'dsp-100',
        action: 'CREATE',
        idempotencyKey: 'idem-dsp-100',
        payload: { netWeight: 3530 },
      });
      expect(m2.id).toBe(m1.id);

      let execCount = 0;
      const flush1 = await offlineSyncService.flushQueue(async () => {
        execCount++;
        return { success: true };
      });
      expect(flush1.synced).toBe(1);
      expect(execCount).toBe(1);

      // Pending upload queue retry test
      await offlineSyncService.enqueuePendingUpload({
        companyId: 'comp-1',
        documentType: 'WEIGHBRIDGE_SLIP',
        fileName: 'bill59.jpg',
        mimeType: 'image/jpeg',
        dataBase64: 'abc123',
        sha256Checksum: 'd'.repeat(64),
      });
      expect(offlineSyncService.getPendingUploads('comp-1')).toHaveLength(1);
      const upFlush = await offlineSyncService.flushPendingUploads(async () => ({ success: true }));
      expect(upFlush.uploaded).toBe(1);
      expect(offlineSyncService.getPendingUploads('comp-1')).toHaveLength(0);

      const telemetry = offlineSyncService.getFullTelemetry('comp-1');
      expect(telemetry.history.length).toBeGreaterThanOrEqual(1);
    });
  });
});
