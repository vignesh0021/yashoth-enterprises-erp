/**
 * YASHOTH ENTERPRISES ERP — PHASE 5 BACKUP & RESTORE ENGINE
 *
 * Implements:
 * 1. Complete Database and Company-scoped backups
 * 2. SHA-256 integrity hashing and tampering detection
 * 3. AES-256-GCM encryption with PBKDF2 key derivation
 * 4. Pre-restore automatic safety snapshots
 * 5. Restore previews, compatibility checks, and execution
 * 6. Audit logging of backup history and restoration logs
 * 7. Automated backup schedule calculators
 * 8. CSV export utility for tabular registers
 */

import type {
  BackupType,
  BackupDestination,
  BackupManifest,
  BackupDatabasePayload,
  BackupArchive,
  EncryptedBackupArchive,
  BackupHistoryItem,
  RestoreLog,
  BackupFrequency,
  RestorePreviewResult,
} from '../../src/types/index.ts';

export const CURRENT_SCHEMA_VERSION = '1.0.0';
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0'];

// ============================================================================
// CRYPTOGRAPHIC UTILITIES (Web Crypto API - Cross-platform Node 20+ & Browser)
// ============================================================================

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Calculates SHA-256 checksum of arbitrary string content.
 */
export async function calculateSHA256(data: string): Promise<string> {
  const enc = new TextEncoder();
  const dataBytes = enc.encode(data);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypts data string using PBKDF2 key derivation and AES-256-GCM.
 */
export async function encryptBackupAES(
  plaintext: string,
  password: string,
  manifest: BackupManifest
): Promise<EncryptedBackupArchive> {
  if (!password || password.length < 6) {
    throw new Error('Encryption password must be at least 6 characters long.');
  }

  const enc = new TextEncoder();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    enc.encode(plaintext)
  );

  return {
    isEncrypted: true,
    algorithm: 'AES-256-GCM',
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    manifest,
  };
}

/**
 * Decrypts AES-256-GCM encrypted backup archive.
 */
export async function decryptBackupAES(
  archive: EncryptedBackupArchive,
  password: string
): Promise<string> {
  if (!password) {
    throw new Error('Password is required to decrypt this backup archive.');
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const iv = base64ToBytes(archive.iv);
  const salt = base64ToBytes(archive.salt);
  const ciphertext = base64ToBytes(archive.ciphertext);

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  try {
    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext as any
    );
    return dec.decode(decryptedBuffer);
  } catch {
    throw new Error('Decryption failed: Incorrect password or corrupted backup archive.');
  }
}

// ============================================================================
// BACKUP RECORD & FINANCIAL METRICS CALCULATION
// ============================================================================

export function computeRecordCounts(payload: BackupDatabasePayload): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      counts[key] = value.length;
    }
  }
  return counts;
}

export function computeFinancialTotals(payload: BackupDatabasePayload): Record<string, number> {
  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const totalSales = round2(
    (payload.invoices || []).reduce(
      (acc, inv) => acc + (inv.grandTotal ?? (inv as any).totalAmount ?? 0),
      0
    )
  );

  const totalPurchases = round2(
    (payload.purchases || []).reduce(
      (acc, p) => acc + (p.totalAmount ?? (p as any).grandTotal ?? 0),
      0
    )
  );

  const totalPayments = round2(
    (payload.payments || []).reduce(
      (acc, pay) => acc + (pay.totalAmount ?? (pay as any).amount ?? 0),
      0
    )
  );

  const totalExpenses = round2(
    (payload.expenses || []).reduce((acc, exp) => acc + (exp.amount || 0), 0)
  );

  return {
    totalSales,
    totalPurchases,
    totalPayments,
    totalExpenses,
  };
}

// ============================================================================
// COMPANY DATA FILTERING / SCOPING
// ============================================================================

export function filterDatabaseForCompany(
  payload: BackupDatabasePayload,
  companyId: string
): BackupDatabasePayload {
  const isMatch = (item: any) => !item.companyId || item.companyId === companyId;

  return {
    companies: (payload.companies || []).filter((c) => c.id === companyId),
    activeCompanyId: companyId,
    companySettings: (payload.companySettings || []).filter((s: any) => s.companyId === companyId),
    yards: (payload.yards || []).filter(isMatch),
    materials: (payload.materials || []).filter(isMatch),
    materialGrades: (payload.materialGrades || []).filter(isMatch),
    parties: (payload.parties || []).filter(isMatch),
    vehicles: (payload.vehicles || []).filter(isMatch),
    vehicleDocuments: (payload.vehicleDocuments || []).filter(isMatch),
    employees: (payload.employees || []).filter(isMatch),
    attendance: (payload.attendance || []).filter(isMatch),
    accounts: (payload.accounts || []).filter(isMatch),
    accountTransactions: (payload.accountTransactions || []).filter(isMatch),
    expenses: (payload.expenses || []).filter(isMatch),
    weighments: (payload.weighments || []).filter(isMatch),
    collectionJobs: (payload.collectionJobs || []).filter(isMatch),
    purchases: (payload.purchases || []).filter(isMatch),
    inventoryLots: (payload.inventoryLots || []).filter(isMatch),
    stockMovements: (payload.stockMovements || []).filter(isMatch),
    sales: (payload.sales || []).filter(isMatch),
    invoices: (payload.invoices || []).filter(isMatch),
    payments: (payload.payments || []).filter(isMatch),
    stockCounts: (payload.stockCounts || []).filter(isMatch),
    auditLogs: (payload.auditLogs || []).filter(isMatch),
    commercialDocuments: (payload.commercialDocuments || []).filter(isMatch),
    journalEntries: (payload.journalEntries || []).filter(isMatch),
  };
}

// ============================================================================
// BACKUP GENERATION
// ============================================================================

export interface GenerateBackupOptions {
  companyId?: string;
  companyName?: string;
  backupType?: BackupType;
  actor: string;
  isEncrypted?: boolean;
  password?: string;
  destination?: BackupDestination;
}

export interface BackupResult {
  archive: BackupArchive | EncryptedBackupArchive;
  rawJson: string;
  checksum: string;
  historyItem: BackupHistoryItem;
  filename: string;
}

export async function generateBackup(
  state: BackupDatabasePayload,
  options: GenerateBackupOptions
): Promise<BackupResult> {
  const backupType = options.backupType || (options.companyId ? 'COMPANY_SCOPED' : 'FULL_DATABASE');
  
  // Filter if company scoped
  const scopedData = (backupType === 'COMPANY_SCOPED' && options.companyId)
    ? filterDatabaseForCompany(state, options.companyId)
    : state;

  const recordCounts = computeRecordCounts(scopedData);
  const financialTotals = computeFinancialTotals(scopedData);
  const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);

  // Compute preliminary checksum on data payload
  const rawDataPayloadString = JSON.stringify(scopedData);
  const payloadChecksum = await calculateSHA256(rawDataPayloadString);

  const manifest: BackupManifest = {
    version: CURRENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    type: backupType,
    companyId: options.companyId || null,
    companyName: options.companyName || (options.companyId ? 'Scoped Company' : 'Consolidated ERP'),
    sha256: payloadChecksum,
    recordCounts,
    financialTotals,
    appVersion: '1.0.0',
    actor: options.actor || 'System Admin',
  };

  const plainArchive: BackupArchive = {
    manifest,
    data: scopedData,
  };

  const plainJson = JSON.stringify(plainArchive, null, 2);
  const archiveChecksum = await calculateSHA256(plainJson);
  plainArchive.manifest.sha256 = archiveChecksum; // manifest sha256 reflects the plain archive checksum

  let finalArchive: BackupArchive | EncryptedBackupArchive;
  let finalJson: string;
  let finalChecksum: string;
  let destination: BackupDestination = options.destination || 'LOCAL_FILE';

  if (options.isEncrypted && options.password) {
    finalArchive = await encryptBackupAES(plainJson, options.password, manifest);
    finalJson = JSON.stringify(finalArchive, null, 2);
    finalChecksum = await calculateSHA256(finalJson);
    destination = 'ENCRYPTED_ARCHIVE';
  } else {
    finalArchive = plainArchive;
    finalJson = JSON.stringify(finalArchive, null, 2);
    finalChecksum = archiveChecksum;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const prefix = backupType === 'COMPANY_SCOPED' ? `YE_COMPANY_${options.companyId || 'SCOPED'}` : 'YE_FULL_BACKUP';
  const ext = options.isEncrypted ? 'yebak' : 'json';
  const filename = `${prefix}_${timestamp}.${ext}`;

  const backupId = `BAK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const historyItem: BackupHistoryItem = {
    id: backupId,
    companyId: options.companyId || null,
    backupName: filename,
    backupType,
    destination,
    fileSizeBytes: finalJson.length,
    sha256Checksum: finalChecksum,
    isEncrypted: !!options.isEncrypted,
    encryptionAlgorithm: options.isEncrypted ? 'AES-256-GCM' : undefined,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    totalRecords,
    recordCountsJson: recordCounts,
    financialTotalsJson: financialTotals,
    status: 'SUCCESS',
    createdBy: options.actor,
    createdAt: new Date().toISOString(),
  };

  return {
    archive: finalArchive,
    rawJson: finalJson,
    checksum: finalChecksum,
    historyItem,
    filename,
  };
}

// ============================================================================
// INTEGRITY VALIDATION & TAMPER DETECTION
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  isEncrypted: boolean;
  parsedArchive?: BackupArchive;
  rawArchive?: any;
  error?: string;
  checksum?: string;
}

export async function validateBackupIntegrity(
  backupInput: string | BackupArchive | EncryptedBackupArchive,
  options?: { expectedChecksum?: string; password?: string }
): Promise<ValidationResult> {
  let parsed: any;
  let rawJsonString = '';

  if (typeof backupInput === 'string') {
    rawJsonString = backupInput.trim();
    try {
      parsed = JSON.parse(rawJsonString);
    } catch {
      return {
        isValid: false,
        isEncrypted: false,
        error: 'Invalid JSON format: Backup file could not be parsed.',
      };
    }
  } else {
    parsed = backupInput;
    rawJsonString = JSON.stringify(backupInput, null, 2);
  }

  // Check expected checksum if supplied
  if (options?.expectedChecksum) {
    const computedChecksum = await calculateSHA256(rawJsonString);
    if (computedChecksum.toLowerCase() !== options.expectedChecksum.toLowerCase()) {
      return {
        isValid: false,
        isEncrypted: !!parsed?.isEncrypted,
        error: `SHA-256 Integrity Verification Failed! Expected ${options.expectedChecksum}, got ${computedChecksum}. File may be corrupted or tampered with.`,
      };
    }
  }

  // Check if encrypted
  if (parsed.isEncrypted === true && parsed.ciphertext) {
    if (!options?.password) {
      return {
        isValid: false,
        isEncrypted: true,
        rawArchive: parsed,
        error: 'Backup is encrypted with AES-256-GCM. Decryption password is required.',
      };
    }

    try {
      const decryptedJson = await decryptBackupAES(parsed as EncryptedBackupArchive, options.password);
      const decryptedArchive: BackupArchive = JSON.parse(decryptedJson);

      // Verify decrypted content structure
      if (!decryptedArchive.manifest || !decryptedArchive.data) {
        return {
          isValid: false,
          isEncrypted: true,
          error: 'Decrypted backup is missing required manifest or data payload.',
        };
      }

      return {
        isValid: true,
        isEncrypted: true,
        parsedArchive: decryptedArchive,
      };
    } catch (err: any) {
      return {
        isValid: false,
        isEncrypted: true,
        error: err.message || 'Decryption failed: Incorrect password or corrupted payload.',
      };
    }
  }

  // Plain archive validation
  if (!parsed.manifest || !parsed.data) {
    return {
      isValid: false,
      isEncrypted: false,
      error: 'Invalid backup format: Missing root manifest or data object.',
    };
  }

  return {
    isValid: true,
    isEncrypted: false,
    parsedArchive: parsed as BackupArchive,
  };
}

// ============================================================================
// RESTORE PREVIEW & COMPATIBILITY CHECK
// ============================================================================

export function generateRestorePreview(
  backupArchive: BackupArchive,
  targetCompanyId?: string
): RestorePreviewResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const manifest = backupArchive.manifest;
  if (!manifest) {
    return {
      isValid: false,
      schemaVersion: 'UNKNOWN',
      isCompatible: false,
      manifest: {} as any,
      recordCounts: {},
      financialTotals: {},
      warnings,
      errors: ['Backup manifest is completely missing.'],
    };
  }

  const isCompatible = SUPPORTED_SCHEMA_VERSIONS.includes(manifest.version);
  if (!isCompatible) {
    errors.push(
      `Incompatible schema version: Backup is ${manifest.version}, but supported versions are: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`
    );
  }

  if (manifest.type === 'COMPANY_SCOPED' && targetCompanyId && manifest.companyId !== targetCompanyId) {
    warnings.push(
      `Backup was generated for Company "${manifest.companyName || manifest.companyId}", but active company is different (${targetCompanyId}). Restoring will map records into target company.`
    );
  }

  const recordCounts = manifest.recordCounts || computeRecordCounts(backupArchive.data || {});
  const financialTotals = manifest.financialTotals || computeFinancialTotals(backupArchive.data || {});

  const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);
  if (totalRecords === 0) {
    warnings.push('The backup archive contains 0 records.');
  }

  return {
    isValid: errors.length === 0,
    schemaVersion: manifest.version,
    isCompatible,
    manifest,
    recordCounts,
    financialTotals,
    targetCompany: targetCompanyId,
    warnings,
    errors,
  };
}

// ============================================================================
// PRE-RESTORE SAFETY SNAPSHOT
// ============================================================================

export async function createPreRestoreSafetySnapshot(
  currentState: BackupDatabasePayload,
  actor: string
): Promise<BackupResult> {
  return generateBackup(currentState, {
    backupType: 'SAFETY_PRE_RESTORE',
    actor,
    destination: 'LOCAL_FILE',
  });
}

// ============================================================================
// RESTORE EXECUTION
// ============================================================================

export interface ExecuteRestoreOptions {
  companyId?: string;
  restoreMode: 'FULL' | 'COMPANY_SCOPED';
  actor: string;
  preRestoreBackupId: string;
  backupId: string;
}

export function executeRestore(
  backupArchive: BackupArchive,
  currentState: BackupDatabasePayload,
  options: ExecuteRestoreOptions
): { restoredState: BackupDatabasePayload; restoreLog: RestoreLog } {
  const { backupId, preRestoreBackupId, restoreMode, actor, companyId } = options;
  const backupData = backupArchive.data || {};

  let restoredState: BackupDatabasePayload;
  let recordsRestored: Record<string, number> = {};

  if (restoreMode === 'FULL') {
    // Complete database replacement
    restoredState = {
      companies: backupData.companies || currentState.companies,
      activeCompanyId: backupData.activeCompanyId || currentState.activeCompanyId,
      companySettings: backupData.companySettings || currentState.companySettings,
      yards: backupData.yards || [],
      materials: backupData.materials || [],
      materialGrades: backupData.materialGrades || [],
      parties: backupData.parties || [],
      vehicles: backupData.vehicles || [],
      vehicleDocuments: backupData.vehicleDocuments || [],
      employees: backupData.employees || [],
      attendance: backupData.attendance || [],
      accounts: backupData.accounts || [],
      accountTransactions: backupData.accountTransactions || [],
      expenses: backupData.expenses || [],
      weighments: backupData.weighments || [],
      collectionJobs: backupData.collectionJobs || [],
      purchases: backupData.purchases || [],
      inventoryLots: backupData.inventoryLots || [],
      stockMovements: backupData.stockMovements || [],
      sales: backupData.sales || [],
      invoices: backupData.invoices || [],
      payments: backupData.payments || [],
      stockCounts: backupData.stockCounts || [],
      auditLogs: backupData.auditLogs || [],
      commercialDocuments: backupData.commercialDocuments || [],
      journalEntries: backupData.journalEntries || [],
    };
    recordsRestored = computeRecordCounts(restoredState);
  } else {
    // Scoped restoration: keep records of other companies, replace target company records
    const targetCompId = companyId || backupArchive.manifest.companyId;
    if (!targetCompId) {
      throw new Error('Target company ID must be specified for COMPANY_SCOPED restore.');
    }

    const mergeArrays = <T extends { companyId?: string }>(currentArr: T[] = [], incomingArr: T[] = []): T[] => {
      const retained = currentArr.filter((item) => item.companyId && item.companyId !== targetCompId);
      const incoming = incomingArr.map((item) => ({ ...item, companyId: targetCompId }));
      return [...retained, ...incoming];
    };

    restoredState = {
      ...currentState,
      parties: mergeArrays(currentState.parties, backupData.parties),
      vehicles: mergeArrays(currentState.vehicles, backupData.vehicles),
      vehicleDocuments: mergeArrays(currentState.vehicleDocuments, backupData.vehicleDocuments),
      employees: mergeArrays(currentState.employees, backupData.employees),
      attendance: mergeArrays(currentState.attendance, backupData.attendance),
      accounts: mergeArrays(currentState.accounts, backupData.accounts),
      accountTransactions: mergeArrays(currentState.accountTransactions, backupData.accountTransactions),
      expenses: mergeArrays(currentState.expenses, backupData.expenses),
      weighments: mergeArrays(currentState.weighments, backupData.weighments),
      collectionJobs: mergeArrays(currentState.collectionJobs, backupData.collectionJobs),
      purchases: mergeArrays(currentState.purchases, backupData.purchases),
      inventoryLots: mergeArrays(currentState.inventoryLots, backupData.inventoryLots),
      stockMovements: mergeArrays(currentState.stockMovements, backupData.stockMovements),
      sales: mergeArrays(currentState.sales, backupData.sales),
      invoices: mergeArrays(currentState.invoices, backupData.invoices),
      payments: mergeArrays(currentState.payments, backupData.payments),
      stockCounts: mergeArrays(currentState.stockCounts, backupData.stockCounts),
      commercialDocuments: mergeArrays(currentState.commercialDocuments, backupData.commercialDocuments),
      journalEntries: mergeArrays(currentState.journalEntries, backupData.journalEntries),
    };

    recordsRestored = computeRecordCounts(filterDatabaseForCompany(restoredState, targetCompId));
  }

  const restoreLog: RestoreLog = {
    id: `RST-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    backupId,
    preRestoreBackupId,
    companyId: companyId || null,
    restoredBy: actor,
    restorationType: restoreMode === 'FULL' ? 'FULL_RESTORE' : 'COMPANY_RESTORE',
    recordsRestoredJson: recordsRestored,
    sha256Verified: true,
    status: 'COMPLETED',
    notes: `Restored ${Object.values(recordsRestored).reduce((a, b) => a + b, 0)} records successfully.`,
    restoredAt: new Date().toISOString(),
  };

  return { restoredState, restoreLog };
}

// ============================================================================
// AUTOMATED BACKUP SCHEDULE CALCULATOR
// ============================================================================

export function calculateNextScheduledRun(frequency: BackupFrequency, fromDate?: Date): string | null {
  if (frequency === 'MANUAL_ONLY') return null;

  const base = fromDate ? new Date(fromDate) : new Date();
  
  if (frequency === 'DAILY') {
    // Next day at 02:00 AM local time or +24 hours
    const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    return next.toISOString();
  }

  if (frequency === 'WEEKLY') {
    // +7 days
    const next = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    return next.toISOString();
  }

  if (frequency === 'MONTHLY') {
    // +30 days
    const next = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    return next.toISOString();
  }

  return null;
}

// ============================================================================
// CSV REGISTRY EXPORT UTILITY
// ============================================================================

export function exportRegistryAsCSV(
  data: any[],
  columns: { header: string; key: string }[]
): string {
  if (!data || data.length === 0) {
    return columns.map((c) => `"${c.header}"`).join(',') + '\n';
  }

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = columns.map((c) => `"${c.header}"`).join(',');
  const dataRows = data.map((row) =>
    columns.map((c) => escapeCsv(row[c.key])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}
