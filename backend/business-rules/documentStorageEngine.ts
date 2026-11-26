// Yasoth Enterprises Scrap ERP — Phases 7 & 9 Document Management, Compression,
// Safe Base64-to-Google-Drive Migration, Duplicate Detection & Supabase Quota Monitor

import type {
  ManagedDocument,
  ManagedDocumentType,
  UploadedDocument,
  StorageQuotaConfig,
  StorageMonitorSnapshot,
  QuotaAlertLevel,
  BackupHistoryItem,
  BackupDatabasePayload,
} from '../../src/types/index.ts';
import { calculateSHA256 } from './backupEngine.ts';
import { roundTo2 } from '../../src/utils/calculations.ts';

export const DEFAULT_STORAGE_QUOTA_CONFIG: StorageQuotaConfig = {
  postgresLimitMb: 500, // Configurable assumption (~500 MB free-tier PostgreSQL)
  fileStorageLimitMb: 1024, // Configurable assumption (~1 GB free-tier Storage)
  egressLimitMb: 5120, // Configurable assumption (~5 GB free-tier Egress)
  warningThresholdPct: 70,
  criticalThresholdPct: 85,
  adminAlertThresholdPct: 95,
  restrictUploadsAtAdminAlert: true,
};

export interface DuplicateDocumentResult {
  isDuplicate: boolean;
  sameTransaction: boolean;
  matchedDocumentId?: string;
  reason?: string;
}

/**
 * Checks for duplicate documents using Company ID, SHA-256 Checksum, Document Number,
 * Document Type, and Transaction Reference.
 * NEVER auto-merges documents from different transactions.
 */
export function detectDuplicateDocument(
  candidate: {
    companyId: string;
    sha256Checksum: string;
    documentNumber?: string;
    documentType: ManagedDocumentType;
    transactionRef?: string;
  },
  existingDocuments: ManagedDocument[]
): DuplicateDocumentResult {
  for (const doc of existingDocuments) {
    if (doc.companyId !== candidate.companyId) continue;

    const sameChecksum = doc.sha256Checksum === candidate.sha256Checksum;
    const sameDocNo =
      Boolean(candidate.documentNumber) &&
      Boolean(doc.documentNumber) &&
      doc.documentNumber!.trim().toUpperCase() === candidate.documentNumber!.trim().toUpperCase() &&
      doc.documentType === candidate.documentType;
    const sameTx =
      Boolean(candidate.transactionRef) &&
      Boolean(doc.transactionRef) &&
      doc.transactionRef!.trim().toUpperCase() === candidate.transactionRef!.trim().toUpperCase();

    if (sameChecksum && sameTx) {
      return {
        isDuplicate: true,
        sameTransaction: true,
        matchedDocumentId: doc.id,
        reason: `Identical file (SHA-256 match) already attached to transaction ${doc.transactionRef}.`,
      };
    }

    if (sameChecksum) {
      return {
        isDuplicate: true,
        sameTransaction: false,
        matchedDocumentId: doc.id,
        reason: `Same file binary (SHA-256 match) already exists under ${doc.documentType} ${doc.documentNumber || doc.originalFileName} (${doc.transactionRef || 'unlinked'}). Not auto-merged because transaction reference differs.`,
      };
    }

    if (sameDocNo && sameTx) {
      return {
        isDuplicate: true,
        sameTransaction: true,
        matchedDocumentId: doc.id,
        reason: `Document ${doc.documentType} #${doc.documentNumber} already exists for transaction ${doc.transactionRef}.`,
      };
    }
  }

  return { isDuplicate: false, sameTransaction: false };
}

export interface WebPPreviewResult {
  previewDataUrl: string;
  previewMimeType: 'image/webp' | 'image/jpeg';
  originalSizeBytes: number;
  previewSizeBytes: number;
  compressionRatio: number;
  originalUntouched: true;
}

/**
 * Generates an adaptive compressed WebP preview for image files while keeping the original
 * legal evidence untouched. Preserves readability of invoice numbers, weighments, QR codes & signatures
 * by keeping max dimension at 1600px and adaptive quality (0.78–0.85).
 */
export async function generateWebPPreview(
  originalDataUrl: string,
  options?: { maxDimension?: number; quality?: number }
): Promise<WebPPreviewResult> {
  const originalSizeBytes = estimateDataUrlByteSize(originalDataUrl);
  const maxDimension = options?.maxDimension ?? 1600;
  const quality = options?.quality ?? 0.82;

  // Browser canvas path (with timeout guard so JSDOM/headless environments never hang)
  if (typeof document !== 'undefined' && typeof Image !== 'undefined' && typeof navigator !== 'undefined' && !/jsdom/i.test(navigator.userAgent || '')) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Image decode timeout')), 500);
        const image = new Image();
        image.onload = () => {
          clearTimeout(timer);
          resolve(image);
        };
        image.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Image decode failed'));
        };
        image.src = originalDataUrl;
      });

      const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
      const targetW = Math.max(1, Math.round((img.width || 1) * scale));
      const targetH = Math.max(1, Math.round((img.height || 1) * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const webpUrl = canvas.toDataURL('image/webp', quality);
        if (webpUrl && webpUrl.startsWith('data:image/webp')) {
          const previewSizeBytes = estimateDataUrlByteSize(webpUrl);
          return {
            previewDataUrl: webpUrl,
            previewMimeType: 'image/webp',
            originalSizeBytes,
            previewSizeBytes,
            compressionRatio: originalSizeBytes > 0 ? roundTo2(previewSizeBytes / originalSizeBytes) : 1,
            originalUntouched: true,
          };
        }
      }
    } catch {
      // Fallback safely in headless/JSDOM environments
    }
  }

  // Deterministic preview metadata fallback (preserves original untouched)
  return {
    previewDataUrl: originalDataUrl,
    previewMimeType: originalDataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
    originalSizeBytes,
    previewSizeBytes: originalSizeBytes,
    compressionRatio: 1,
    originalUntouched: true,
  };
}

export function estimateDataUrlByteSize(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIdx = dataUrl.indexOf(',');
  const base64Part = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.floor((base64Part.length * 3) / 4);
}

// ============================================================================
// PHASE 7.5 — SAFE BASE64-TO-GOOGLE-DRIVE MIGRATION WITH VERIFICATION & ROLLBACK
// ============================================================================

export interface DriveMigrationAdapter {
  uploadOriginal: (
    filename: string,
    content: string,
    mimeType: string
  ) => Promise<{ success: boolean; fileId?: string; error?: string }>;
  verifyRemoteFile: (
    fileId: string,
    expectedSha256: string
  ) => Promise<{ verified: boolean; error?: string }>;
}

export interface DocumentMigrationEntry {
  legacyDocumentId: string;
  fileName: string;
  status: 'MIGRATED_VERIFIED' | 'FAILED_RETAINED' | 'SKIPPED';
  remoteFileId?: string;
  sha256Checksum?: string;
  managedDocument?: ManagedDocument;
  error?: string;
}

export interface DocumentMigrationReport {
  totalIdentified: number;
  migratedCount: number;
  failedCount: number;
  retainedOriginalsCount: number;
  entries: DocumentMigrationEntry[];
  rollbackSnapshot: UploadedDocument[];
}

/**
 * Executes the 9-step safe migration of legacy Base64 UploadedDocument records to Google Drive:
 * 1. Identify Base64 records.
 * 2. Snapshot originals for rollback.
 * 3. Compute SHA-256 checksum.
 * 4. Upload original to Google Drive.
 * 5. Verify remote availability & SHA-256 checksum.
 * 6. Create ManagedDocument metadata with remote Drive fileId.
 * 7. Retain legacy Base64 copy if ANY step fails (never delete unverified files).
 */
export async function migrateBase64DocumentsToDrive(params: {
  companyId: string;
  legacyDocuments: UploadedDocument[];
  adapter: DriveMigrationAdapter;
  actor: string;
  purgeBase64AfterVerification?: boolean;
}): Promise<{
  report: DocumentMigrationReport;
  updatedLegacyDocuments: UploadedDocument[];
  newManagedDocuments: ManagedDocument[];
}> {
  const rollbackSnapshot: UploadedDocument[] = params.legacyDocuments.map((d) => ({ ...d }));
  const updatedLegacyDocuments: UploadedDocument[] = params.legacyDocuments.map((d) => ({ ...d }));
  const newManagedDocuments: ManagedDocument[] = [];
  const entries: DocumentMigrationEntry[] = [];

  const base64Docs = updatedLegacyDocuments.filter(
    (d) => (!d.companyId || d.companyId === params.companyId) && Boolean(d.fileDataUrl && d.fileDataUrl.length > 256)
  );

  let migratedCount = 0;
  let failedCount = 0;

  for (const doc of base64Docs) {
    try {
      const sha256Checksum = await calculateSHA256(doc.fileDataUrl);
      const originalSizeBytes = doc.fileSize || estimateDataUrlByteSize(doc.fileDataUrl);

      // Step 2: Upload original to Google Drive
      const uploadRes = await params.adapter.uploadOriginal(
        doc.fileName,
        doc.fileDataUrl,
        doc.fileType || 'application/octet-stream'
      );

      if (!uploadRes.success || !uploadRes.fileId) {
        failedCount++;
        entries.push({
          legacyDocumentId: doc.id,
          fileName: doc.fileName,
          status: 'FAILED_RETAINED',
          sha256Checksum,
          error: uploadRes.error || 'Google Drive upload failed; original retained.',
        });
        continue;
      }

      // Steps 3 & 4: Verify remote availability + SHA-256 checksum
      const verifyRes = await params.adapter.verifyRemoteFile(uploadRes.fileId, sha256Checksum);
      if (!verifyRes.verified) {
        failedCount++;
        entries.push({
          legacyDocumentId: doc.id,
          fileName: doc.fileName,
          status: 'FAILED_RETAINED',
          remoteFileId: uploadRes.fileId,
          sha256Checksum,
          error: verifyRes.error || 'Remote SHA-256 verification failed; original retained.',
        });
        continue;
      }

      // Step 5: Save Drive file ID & metadata
      const docTypeMap: Record<UploadedDocument['category'], ManagedDocumentType> = {
        VEHICLE_DOC: 'VEHICLE_DOC',
        PREVIOUS_INVOICE: 'SALES_INVOICE',
        PREVIOUS_PO: 'PURCHASE_INVOICE',
        PREVIOUS_QUOTATION: 'SUPPORTING_DOC',
        EWAY_BILL: 'GST_DOCUMENT',
      };

      const managedDoc: ManagedDocument = {
        id: 'mdoc-' + Math.random().toString(36).substring(2, 10),
        companyId: doc.companyId || params.companyId,
        documentType: docTypeMap[doc.category] || 'SUPPORTING_DOC',
        documentNumber: doc.referenceNo,
        transactionRef: doc.relatedId || doc.referenceNo,
        partyName: doc.partyName,
        storageProvider: 'GOOGLE_DRIVE',
        remoteFileId: uploadRes.fileId,
        originalFileName: doc.fileName,
        originalMimeType: doc.fileType || 'application/octet-stream',
        originalSizeBytes,
        sha256Checksum,
        uploadStatus: 'VERIFIED',
        migrationStatus: 'MIGRATED',
        legacyDocumentId: doc.id,
        uploadedBy: params.actor,
        uploadedAt: new Date().toISOString(),
      };

      newManagedDocuments.push(managedDoc);

      // Step 8: Retain old copy unless explicitly verified & purge requested
      if (params.purgeBase64AfterVerification) {
        doc.fileDataUrl = `gdrive://${uploadRes.fileId}`;
      }

      migratedCount++;
      entries.push({
        legacyDocumentId: doc.id,
        fileName: doc.fileName,
        status: 'MIGRATED_VERIFIED',
        remoteFileId: uploadRes.fileId,
        sha256Checksum,
        managedDocument: managedDoc,
      });
    } catch (err: any) {
      failedCount++;
      entries.push({
        legacyDocumentId: doc.id,
        fileName: doc.fileName,
        status: 'FAILED_RETAINED',
        error: err?.message || 'Unexpected error during migration; original retained.',
      });
    }
  }

  return {
    report: {
      totalIdentified: base64Docs.length,
      migratedCount,
      failedCount,
      retainedOriginalsCount: params.purgeBase64AfterVerification ? failedCount : base64Docs.length,
      entries,
      rollbackSnapshot,
    },
    updatedLegacyDocuments,
    newManagedDocuments,
  };
}

/**
 * Rollback a document migration cleanly using the pre-migration snapshot.
 */
export function rollbackDocumentMigration(
  rollbackSnapshot: UploadedDocument[],
  managedDocuments: ManagedDocument[]
): {
  restoredLegacyDocuments: UploadedDocument[];
  updatedManagedDocuments: ManagedDocument[];
} {
  const restoredIds = new Set(rollbackSnapshot.map((d) => d.id));
  return {
    restoredLegacyDocuments: rollbackSnapshot.map((d) => ({ ...d })),
    updatedManagedDocuments: managedDocuments.map((m) =>
      m.legacyDocumentId && restoredIds.has(m.legacyDocumentId)
        ? { ...m, migrationStatus: 'ROLLED_BACK' }
        : m
    ),
  };
}

// ============================================================================
// PHASE 9 — SUPABASE FREE-TIER QUOTA & STORAGE MONITOR
// ============================================================================

export function computeStorageMonitorSnapshot(params: {
  databasePayload: BackupDatabasePayload;
  managedDocuments: ManagedDocument[];
  uploadedDocuments: UploadedDocument[];
  backupHistory: BackupHistoryItem[];
  quotaConfig?: Partial<StorageQuotaConfig>;
  observedDatabaseUsedMb?: number;
  observedFileStorageUsedMb?: number;
}): StorageMonitorSnapshot {
  const cfg: StorageQuotaConfig = {
    ...DEFAULT_STORAGE_QUOTA_CONFIG,
    ...(params.quotaConfig || {}),
  };

  // Estimate PostgreSQL JSON footprint from operational collections (excluding raw base64)
  const payloadCopy: Record<string, unknown> = { ...params.databasePayload };
  delete payloadCopy.uploadedDocuments;
  const jsonBytes = JSON.stringify(payloadCopy).length;
  // PostgreSQL row/index overhead factor (~2.5x raw JSON)
  const estimatedDbMb = roundTo2((jsonBytes * 2.5) / (1024 * 1024));
  const databaseUsedMb = params.observedDatabaseUsedMb ?? estimatedDbMb;

  // Compute document & file sizes
  let originalTotalBytes = 0;
  let compressedPreviewTotalBytes = 0;
  let supabaseStorageBytes = 0;
  let failedUploadCount = 0;
  let pendingUploadCount = 0;

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  let monthlyGrowthBytes = 0;

  const allFiles: { id: string; name: string; type: string; sizeBytes: number; provider: string }[] = [];

  for (const doc of params.managedDocuments) {
    originalTotalBytes += doc.originalSizeBytes || 0;
    compressedPreviewTotalBytes += doc.previewSizeBytes || 0;
    if (doc.storageProvider === 'SUPABASE_STORAGE') {
      supabaseStorageBytes += doc.originalSizeBytes || 0;
    }
    if (doc.uploadStatus === 'FAILED') failedUploadCount++;
    if (doc.uploadStatus === 'PENDING_UPLOAD') pendingUploadCount++;
    if (doc.uploadedAt && now - new Date(doc.uploadedAt).getTime() <= thirtyDaysMs) {
      monthlyGrowthBytes += doc.originalSizeBytes || 0;
    }
    allFiles.push({
      id: doc.id,
      name: doc.originalFileName,
      type: doc.documentType,
      sizeBytes: doc.originalSizeBytes || 0,
      provider: doc.storageProvider,
    });
  }

  for (const up of params.uploadedDocuments) {
    const size = up.fileSize || estimateDataUrlByteSize(up.fileDataUrl);
    originalTotalBytes += size;
    if (up.createdAt && now - new Date(up.createdAt).getTime() <= thirtyDaysMs) {
      monthlyGrowthBytes += size;
    }
    allFiles.push({
      id: up.id,
      name: up.fileName,
      type: up.category,
      sizeBytes: size,
      provider: up.fileDataUrl?.startsWith('gdrive://') ? 'GOOGLE_DRIVE' : 'LEGACY_BASE64',
    });
  }

  const backupTotalBytes = params.backupHistory.reduce(
    (sum, b) => sum + (b.compressedSizeBytes || b.fileSizeBytes || 0),
    0
  );

  const estimatedStorageMb = roundTo2(supabaseStorageBytes / (1024 * 1024));
  const fileStorageUsedMb = params.observedFileStorageUsedMb ?? estimatedStorageMb;

  const databaseUsagePct = cfg.postgresLimitMb > 0 ? roundTo2((databaseUsedMb / cfg.postgresLimitMb) * 100) : 0;
  const fileStorageUsagePct = cfg.fileStorageLimitMb > 0 ? roundTo2((fileStorageUsedMb / cfg.fileStorageLimitMb) * 100) : 0;
  const maxPct = Math.max(databaseUsagePct, fileStorageUsagePct);

  let alertLevel: QuotaAlertLevel = 'OK';
  if (maxPct >= cfg.adminAlertThresholdPct) alertLevel = 'ADMIN_ALERT';
  else if (maxPct >= cfg.criticalThresholdPct) alertLevel = 'CRITICAL';
  else if (maxPct >= cfg.warningThresholdPct) alertLevel = 'WARNING';

  const uploadsRestricted = alertLevel === 'ADMIN_ALERT' && cfg.restrictUploadsAtAdminAlert;

  const largestFiles = allFiles.sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 10);
  const compressionSavingsBytes = Math.max(
    0,
    params.managedDocuments.reduce(
      (s, d) => s + (d.previewSizeBytes ? Math.max(0, d.originalSizeBytes - d.previewSizeBytes) : 0),
      0
    )
  );

  return {
    databaseUsedMb,
    databaseLimitMb: cfg.postgresLimitMb,
    databaseUsagePct,
    fileStorageUsedMb,
    fileStorageLimitMb: cfg.fileStorageLimitMb,
    fileStorageUsagePct,
    remainingDatabaseMb: roundTo2(Math.max(0, cfg.postgresLimitMb - databaseUsedMb)),
    remainingFileStorageMb: roundTo2(Math.max(0, cfg.fileStorageLimitMb - fileStorageUsedMb)),
    egressLimitMb: cfg.egressLimitMb,
    documentCount: params.managedDocuments.length + params.uploadedDocuments.length,
    originalTotalBytes,
    compressedPreviewTotalBytes,
    compressionSavingsBytes,
    largestFiles,
    monthlyGrowthBytes,
    backupTotalBytes,
    failedUploadCount,
    pendingUploadCount,
    alertLevel,
    uploadsRestricted,
    evaluatedAt: new Date().toISOString(),
  };
}
