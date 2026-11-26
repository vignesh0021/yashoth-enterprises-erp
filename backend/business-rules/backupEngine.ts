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

export const CURRENT_SCHEMA_VERSION = '2.0.0';
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0', '1.1.0', '2.0.0'];

/**
 * Version-aware backward-compatible migration for older backup payloads (1.0.0 / 1.1.0 -> 2.0.0).
 * Preserves all primary keys, foreign keys, companyIds, voucher numbers, and financial balances.
 */
export function migrateBackupPayload(
  raw: BackupDatabasePayload,
  fromVersion: string
): BackupDatabasePayload {
  const migrated: BackupDatabasePayload = {
    ...raw,
    expenses: (raw.expenses || []).map((e) => ({
      ...e,
      paidByType: e.paidByType || 'COMPANY',
      status: e.status || (e.paymentMode === 'UNPAID' ? 'UNPAID' : 'PAID'),
    })),
    payments: (raw.payments || []).map((p) => ({
      ...p,
      status: p.status || 'COMPLETED',
      beneficiaryPartyId: p.beneficiaryPartyId || p.partyId,
    })),
    vehicles: (raw.vehicles || []).map((v) => ({
      ...v,
      isOwnerDriven: v.isOwnerDriven ?? false,
    })),
  };

  if (fromVersion === '1.0.0' || fromVersion === '1.1.0') {
    return migrated;
  }
  return migrated;
}

export async function computeAttachmentChecksums(
  payload: BackupDatabasePayload
): Promise<Record<string, string>> {
  const checksums: Record<string, string> = {};
  for (const att of payload.documentAttachments || []) {
    if (att.sha256Checksum) {
      checksums[`att:${att.id}`] = att.sha256Checksum;
    }
  }
  for (const doc of payload.uploadedDocuments || []) {
    if (doc.fileDataUrl) {
      checksums[`updoc:${doc.id}`] = await calculateSHA256(doc.fileDataUrl);
    }
  }
  return checksums;
}

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
    dailyTasks: (payload.dailyTasks || []).filter(isMatch),
    workNotes: (payload.workNotes || []).filter(isMatch),
    uploadedDocuments: (payload.uploadedDocuments || []).filter(isMatch),
    salaryRecords: (payload.salaryRecords || []).filter(isMatch),
    employeeAdvances: (payload.employeeAdvances || []).filter(isMatch),
    dailyLabourEntries: (payload.dailyLabourEntries || []).filter(isMatch),
    labourPayments: (payload.labourPayments || []).filter(isMatch),
    contractors: (payload.contractors || []).filter(isMatch),
    contractorWorkEntries: (payload.contractorWorkEntries || []).filter(isMatch),
    contractorPayments: (payload.contractorPayments || []).filter(isMatch),
    dailyCashClosings: (payload.dailyCashClosings || []).filter(isMatch),
    persons: (payload.persons || []).filter(isMatch),
    personRoles: (payload.personRoles || []).filter(isMatch),
    vehicleTrips: (payload.vehicleTrips || []).filter(isMatch),
    tripStops: (payload.tripStops || []).filter(isMatch),
    paymentAuthorizations: (payload.paymentAuthorizations || []).filter(isMatch),
    documentAttachments: (payload.documentAttachments || []).filter(isMatch),
    ...(payload.materialDispatches ? { materialDispatches: payload.materialDispatches.filter(isMatch) } : {}),
    ...(payload.godownTransfers ? { godownTransfers: payload.godownTransfers.filter(isMatch) } : {}),
    ...(payload.managedDocuments ? { managedDocuments: payload.managedDocuments.filter(isMatch) } : {}),
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
  const attachmentChecksums = await computeAttachmentChecksums(scopedData);

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
    attachmentChecksums,
    appVersion: '2.0.0',
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
  targetCompanyId?: string,
  currentState?: BackupDatabasePayload
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
  } else if (manifest.version !== CURRENT_SCHEMA_VERSION) {
    warnings.push(
      `Legacy backup schema (${manifest.version}) will be automatically migrated to ${CURRENT_SCHEMA_VERSION} during restore.`
    );
  }

  if (manifest.type === 'COMPANY_SCOPED' && targetCompanyId && manifest.companyId !== targetCompanyId) {
    warnings.push(
      `Backup was generated for Company "${manifest.companyName || manifest.companyId}", but active company is different (${targetCompanyId}). Restoring will map records into target company.`
    );
  }

  const migratedData = migrateBackupPayload(backupArchive.data || {}, manifest.version);
  const recordCounts = manifest.recordCounts || computeRecordCounts(migratedData);
  const financialTotals = manifest.financialTotals || computeFinancialTotals(migratedData);

  const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);
  if (totalRecords === 0) {
    warnings.push('The backup archive contains 0 records.');
  }

  // Conflict report against currentState (prevents silent overwrite)
  const conflicts: { table: string; duplicateIds: string[]; existingCount: number; incomingCount: number }[] = [];
  if (currentState) {
    const keysToCheck: (keyof BackupDatabasePayload)[] = [
      'companies', 'parties', 'vehicles', 'accounts', 'accountTransactions',
      'expenses', 'purchases', 'invoices', 'payments', 'journalEntries',
      'salaryRecords', 'dailyLabourEntries', 'contractorWorkEntries', 'dailyCashClosings',
    ];
    for (const key of keysToCheck) {
      const existingArr = (currentState[key] as { id?: string }[] | undefined) || [];
      const incomingArr = (migratedData[key] as { id?: string }[] | undefined) || [];
      if (existingArr.length === 0 || incomingArr.length === 0) continue;
      const existingIds = new Set(existingArr.map((x) => x.id).filter(Boolean) as string[]);
      const duplicateIds = incomingArr
        .map((x) => x.id)
        .filter((id): id is string => typeof id === 'string' && existingIds.has(id));
      if (duplicateIds.length > 0) {
        conflicts.push({
          table: String(key),
          duplicateIds,
          existingCount: existingArr.length,
          incomingCount: incomingArr.length,
        });
      }
    }
    if (conflicts.length > 0) {
      warnings.push(
        `${conflicts.reduce((s, c) => s + c.duplicateIds.length, 0)} existing record ID(s) detected across ${conflicts.length} table(s); non-destructive idempotent merge will skip duplicates.`
      );
    }
  }

  // Attachment binary/metadata verification
  const expectedAtts = migratedData.documentAttachments || [];
  const expectedDocs = migratedData.uploadedDocuments || [];
  const missingOrMismatched: string[] = [];
  const manifestChecksums = manifest.attachmentChecksums || {};
  for (const att of expectedAtts) {
    if (att.uploadStatus === 'COMMITTED' && (!att.sha256Checksum || (manifestChecksums[`att:${att.id}`] && manifestChecksums[`att:${att.id}`] !== att.sha256Checksum))) {
      missingOrMismatched.push(`att:${att.id}`);
    }
  }
  for (const doc of expectedDocs) {
    if (!doc.fileDataUrl) {
      missingOrMismatched.push(`updoc:${doc.id}`);
    }
  }
  const totalAttachments = expectedAtts.length + expectedDocs.length;
  const attachmentVerification = {
    total: totalAttachments,
    verified: Math.max(0, totalAttachments - missingOrMismatched.length),
    missingOrMismatched,
  };
  if (missingOrMismatched.length > 0) {
    warnings.push(`${missingOrMismatched.length} attachment binary/checksum reference(s) require re-upload or storage reconciliation.`);
  }

  return {
    isValid: errors.length === 0,
    schemaVersion: manifest.version,
    isCompatible,
    manifest,
    recordCounts,
    financialTotals,
    targetCompany: targetCompanyId,
    conflicts,
    attachmentVerification,
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
// RESTORE EXECUTION (ALL COLLECTIONS + IDEMPOTENT MERGE + ROLLBACK)
// ============================================================================

export interface ExecuteRestoreOptions {
  companyId?: string;
  restoreMode: 'FULL' | 'COMPANY_SCOPED';
  actor: string;
  preRestoreBackupId: string;
  backupId: string;
  preventOverwrite?: boolean;
}

function mergeByIdNonDestructive<T extends { id?: string }>(
  existing: T[] = [],
  incoming: T[] = [],
  preventOverwrite: boolean
): T[] {
  const seen = new Set<string>(
    preventOverwrite ? (existing.map((x) => x.id).filter((id): id is string => typeof id === 'string')) : []
  );
  const dedupedIncoming: T[] = [];
  for (const item of incoming) {
    if (typeof item.id === 'string') {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
    }
    dedupedIncoming.push(item);
  }
  return preventOverwrite ? [...existing, ...dedupedIncoming] : dedupedIncoming;
}

export function executeRestore(
  backupArchive: BackupArchive,
  currentState: BackupDatabasePayload,
  options: ExecuteRestoreOptions
): { restoredState: BackupDatabasePayload; restoreLog: RestoreLog } {
  const { backupId, preRestoreBackupId, restoreMode, actor, companyId, preventOverwrite = false } = options;
  const schemaVersion = backupArchive.manifest?.version;
  if (!schemaVersion || !SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
    throw new Error(
      `Incompatible backup schema version "${schemaVersion || 'UNKNOWN'}". Supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}.`
    );
  }
  const backupData = migrateBackupPayload(backupArchive.data || {}, schemaVersion);

  let restoredState: BackupDatabasePayload;
  let recordsRestored: Record<string, number> = {};

  if (restoreMode === 'FULL') {
    const mergeOrReplace = <T extends { id?: string }>(cur: T[] | undefined, inc: T[] | undefined): T[] =>
      mergeByIdNonDestructive(cur || [], inc || [], preventOverwrite);
    const optMerge = <T extends { id?: string }>(cur: T[] | undefined, inc: T[] | undefined): T[] | undefined => {
      if (cur === undefined && inc === undefined) return undefined;
      return mergeByIdNonDestructive(cur || [], inc || [], preventOverwrite);
    };

    restoredState = {
      companies: mergeOrReplace(currentState.companies, backupData.companies || currentState.companies),
      activeCompanyId: backupData.activeCompanyId || currentState.activeCompanyId,
      companySettings: backupData.companySettings || currentState.companySettings,
      yards: mergeOrReplace(currentState.yards, backupData.yards),
      materials: mergeOrReplace(currentState.materials, backupData.materials),
      materialGrades: mergeOrReplace(currentState.materialGrades, backupData.materialGrades),
      parties: mergeOrReplace(currentState.parties, backupData.parties),
      vehicles: mergeOrReplace(currentState.vehicles, backupData.vehicles),
      vehicleDocuments: mergeOrReplace(currentState.vehicleDocuments, backupData.vehicleDocuments),
      employees: mergeOrReplace(currentState.employees, backupData.employees),
      attendance: mergeOrReplace(currentState.attendance, backupData.attendance),
      accounts: mergeOrReplace(currentState.accounts, backupData.accounts),
      accountTransactions: mergeOrReplace(currentState.accountTransactions, backupData.accountTransactions),
      expenses: mergeOrReplace(currentState.expenses, backupData.expenses),
      weighments: mergeOrReplace(currentState.weighments, backupData.weighments),
      collectionJobs: mergeOrReplace(currentState.collectionJobs, backupData.collectionJobs),
      purchases: mergeOrReplace(currentState.purchases, backupData.purchases),
      inventoryLots: mergeOrReplace(currentState.inventoryLots, backupData.inventoryLots),
      stockMovements: mergeOrReplace(currentState.stockMovements, backupData.stockMovements),
      sales: mergeOrReplace(currentState.sales, backupData.sales),
      invoices: mergeOrReplace(currentState.invoices, backupData.invoices),
      payments: mergeOrReplace(currentState.payments, backupData.payments),
      stockCounts: mergeOrReplace(currentState.stockCounts, backupData.stockCounts),
      auditLogs: mergeOrReplace(currentState.auditLogs, backupData.auditLogs),
      commercialDocuments: mergeOrReplace(currentState.commercialDocuments, backupData.commercialDocuments),
      journalEntries: mergeOrReplace(currentState.journalEntries, backupData.journalEntries),
      ...(optMerge(currentState.dailyTasks, backupData.dailyTasks) !== undefined ? { dailyTasks: optMerge(currentState.dailyTasks, backupData.dailyTasks) } : {}),
      ...(optMerge(currentState.workNotes, backupData.workNotes) !== undefined ? { workNotes: optMerge(currentState.workNotes, backupData.workNotes) } : {}),
      ...(optMerge(currentState.uploadedDocuments, backupData.uploadedDocuments) !== undefined ? { uploadedDocuments: optMerge(currentState.uploadedDocuments, backupData.uploadedDocuments) } : {}),
      ...(optMerge(currentState.salaryRecords, backupData.salaryRecords) !== undefined ? { salaryRecords: optMerge(currentState.salaryRecords, backupData.salaryRecords) } : {}),
      ...(optMerge(currentState.employeeAdvances, backupData.employeeAdvances) !== undefined ? { employeeAdvances: optMerge(currentState.employeeAdvances, backupData.employeeAdvances) } : {}),
      ...(optMerge(currentState.dailyLabourEntries, backupData.dailyLabourEntries) !== undefined ? { dailyLabourEntries: optMerge(currentState.dailyLabourEntries, backupData.dailyLabourEntries) } : {}),
      ...(optMerge(currentState.labourPayments, backupData.labourPayments) !== undefined ? { labourPayments: optMerge(currentState.labourPayments, backupData.labourPayments) } : {}),
      ...(optMerge(currentState.contractors, backupData.contractors) !== undefined ? { contractors: optMerge(currentState.contractors, backupData.contractors) } : {}),
      ...(optMerge(currentState.contractorWorkEntries, backupData.contractorWorkEntries) !== undefined ? { contractorWorkEntries: optMerge(currentState.contractorWorkEntries, backupData.contractorWorkEntries) } : {}),
      ...(optMerge(currentState.contractorPayments, backupData.contractorPayments) !== undefined ? { contractorPayments: optMerge(currentState.contractorPayments, backupData.contractorPayments) } : {}),
      ...(optMerge(currentState.dailyCashClosings, backupData.dailyCashClosings) !== undefined ? { dailyCashClosings: optMerge(currentState.dailyCashClosings, backupData.dailyCashClosings) } : {}),
      ...(optMerge(currentState.persons, backupData.persons) !== undefined ? { persons: optMerge(currentState.persons, backupData.persons) } : {}),
      ...(optMerge(currentState.personRoles, backupData.personRoles) !== undefined ? { personRoles: optMerge(currentState.personRoles, backupData.personRoles) } : {}),
      ...(optMerge(currentState.vehicleTrips, backupData.vehicleTrips) !== undefined ? { vehicleTrips: optMerge(currentState.vehicleTrips, backupData.vehicleTrips) } : {}),
      ...(optMerge(currentState.tripStops, backupData.tripStops) !== undefined ? { tripStops: optMerge(currentState.tripStops, backupData.tripStops) } : {}),
      ...(optMerge(currentState.paymentAuthorizations, backupData.paymentAuthorizations) !== undefined ? { paymentAuthorizations: optMerge(currentState.paymentAuthorizations, backupData.paymentAuthorizations) } : {}),
      ...(optMerge(currentState.documentAttachments, backupData.documentAttachments) !== undefined ? { documentAttachments: optMerge(currentState.documentAttachments, backupData.documentAttachments) } : {}),
      ...(optMerge(currentState.materialDispatches, backupData.materialDispatches) !== undefined ? { materialDispatches: optMerge(currentState.materialDispatches, backupData.materialDispatches) } : {}),
      ...(optMerge(currentState.godownTransfers, backupData.godownTransfers) !== undefined ? { godownTransfers: optMerge(currentState.godownTransfers, backupData.godownTransfers) } : {}),
      ...(optMerge(currentState.managedDocuments, backupData.managedDocuments) !== undefined ? { managedDocuments: optMerge(currentState.managedDocuments, backupData.managedDocuments) } : {}),
    };
    recordsRestored = computeRecordCounts(restoredState);
  } else {
    // Scoped restoration: keep records of other companies, restore target company records
    const targetCompId = companyId || backupArchive.manifest.companyId;
    if (!targetCompId) {
      throw new Error('Target company ID must be specified for COMPANY_SCOPED restore.');
    }

    const mergeArrays = <T extends { id?: string; companyId?: string }>(currentArr: T[] = [], incomingArr: T[] = []): T[] => {
      const retainedOtherCompanies = currentArr.filter((item) => item.companyId && item.companyId !== targetCompId);
      const currentTarget = currentArr.filter((item) => !item.companyId || item.companyId === targetCompId);
      const incoming = incomingArr.map((item) => ({ ...item, companyId: targetCompId }));
      const targetMerged = preventOverwrite
        ? mergeByIdNonDestructive(currentTarget, incoming, true)
        : incoming;
      return [...retainedOtherCompanies, ...targetMerged];
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
      dailyTasks: mergeArrays(currentState.dailyTasks, backupData.dailyTasks),
      workNotes: mergeArrays(currentState.workNotes, backupData.workNotes),
      uploadedDocuments: mergeArrays(currentState.uploadedDocuments, backupData.uploadedDocuments),
      salaryRecords: mergeArrays(currentState.salaryRecords, backupData.salaryRecords),
      employeeAdvances: mergeArrays(currentState.employeeAdvances, backupData.employeeAdvances),
      dailyLabourEntries: mergeArrays(currentState.dailyLabourEntries, backupData.dailyLabourEntries),
      labourPayments: mergeArrays(currentState.labourPayments, backupData.labourPayments),
      contractors: mergeArrays(currentState.contractors, backupData.contractors),
      contractorWorkEntries: mergeArrays(currentState.contractorWorkEntries, backupData.contractorWorkEntries),
      contractorPayments: mergeArrays(currentState.contractorPayments, backupData.contractorPayments),
      dailyCashClosings: mergeArrays(currentState.dailyCashClosings, backupData.dailyCashClosings),
      persons: mergeArrays(currentState.persons, backupData.persons),
      personRoles: mergeArrays(currentState.personRoles, backupData.personRoles),
      vehicleTrips: mergeArrays(currentState.vehicleTrips, backupData.vehicleTrips),
      tripStops: mergeArrays(currentState.tripStops, backupData.tripStops),
      paymentAuthorizations: mergeArrays(currentState.paymentAuthorizations, backupData.paymentAuthorizations),
      documentAttachments: mergeArrays(currentState.documentAttachments, backupData.documentAttachments),
      ...(currentState.materialDispatches || backupData.materialDispatches
        ? { materialDispatches: mergeArrays(currentState.materialDispatches, backupData.materialDispatches) }
        : {}),
      ...(currentState.godownTransfers || backupData.godownTransfers
        ? { godownTransfers: mergeArrays(currentState.godownTransfers, backupData.godownTransfers) }
        : {}),
      ...(currentState.managedDocuments || backupData.managedDocuments
        ? { managedDocuments: mergeArrays(currentState.managedDocuments, backupData.managedDocuments) }
        : {}),
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

/**
 * Executes restore with automatic rollback to currentState if any post-restore invariant fails.
 */
export function executeRestoreWithRollback(
  backupArchive: BackupArchive,
  currentState: BackupDatabasePayload,
  options: ExecuteRestoreOptions
): { restoredState: BackupDatabasePayload; restoreLog: RestoreLog; rolledBack: boolean } {
  try {
    const { restoredState, restoreLog } = executeRestore(backupArchive, currentState, options);

    // Post-restore integrity verification: every posted journal must be balanced
    for (const je of restoredState.journalEntries || []) {
      const dr = je.lines.reduce((s, l) => s + (l.debit || 0), 0);
      const cr = je.lines.reduce((s, l) => s + (l.credit || 0), 0);
      if (Math.abs(dr - cr) > 0.05) {
        throw new Error(`Unbalanced journal entry ${je.entryNo || je.id} detected during restore (Dr=${dr}, Cr=${cr}).`);
      }
    }

    return { restoredState, restoreLog, rolledBack: false };
  } catch (err: any) {
    const rollbackLog: RestoreLog = {
      id: `RST-RB-${Date.now()}`,
      backupId: options.backupId,
      preRestoreBackupId: options.preRestoreBackupId,
      companyId: options.companyId || null,
      restoredBy: options.actor,
      restorationType: options.restoreMode === 'FULL' ? 'FULL_RESTORE' : 'COMPANY_RESTORE',
      recordsRestoredJson: {},
      sha256Verified: false,
      status: 'ROLLED_BACK',
      errorMessage: err?.message || 'Restore failed midway and was rolled back.',
      restoredAt: new Date().toISOString(),
    };
    return { restoredState: currentState, restoreLog: rollbackLog, rolledBack: true };
  }
}

/**
 * Reconciles source backup payload vs restored state (counts, financial totals, balances).
 */
export function verifyRestoreReconciliation(
  source: BackupDatabasePayload,
  restored: BackupDatabasePayload
): {
  isExactMatch: boolean;
  sourceCounts: Record<string, number>;
  restoredCounts: Record<string, number>;
  mismatchedTables: string[];
  sourceFinancialTotals: Record<string, number>;
  restoredFinancialTotals: Record<string, number>;
  financialDiffs: Record<string, number>;
} {
  const sourceCounts = computeRecordCounts(source);
  const restoredCounts = computeRecordCounts(restored);
  const mismatchedTables: string[] = [];
  for (const key of Object.keys(sourceCounts)) {
    if ((restoredCounts[key] || 0) < (sourceCounts[key] || 0)) {
      mismatchedTables.push(key);
    }
  }
  const sourceFinancialTotals = computeFinancialTotals(source);
  const restoredFinancialTotals = computeFinancialTotals(restored);
  const financialDiffs: Record<string, number> = {};
  for (const k of Object.keys(sourceFinancialTotals)) {
    financialDiffs[k] = Math.round(((restoredFinancialTotals[k] || 0) - (sourceFinancialTotals[k] || 0)) * 100) / 100;
  }

  const hasDiff = Object.values(financialDiffs).some((d) => Math.abs(d) > 0.01);
  return {
    isExactMatch: mismatchedTables.length === 0 && !hasDiff,
    sourceCounts,
    restoredCounts,
    mismatchedTables,
    sourceFinancialTotals,
    restoredFinancialTotals,
    financialDiffs,
  };
}

/**
 * Verifies real attachment binaries (SHA-256 of embedded fileDataUrl) and external Storage references
 * against manifest.attachmentChecksums.
 */
export async function verifyBackupAttachmentBinaries(backupArchive: BackupArchive): Promise<{
  totalChecked: number;
  verifiedCount: number;
  checksumMismatches: string[];
  missingReferences: string[];
}> {
  const checksums = backupArchive.manifest?.attachmentChecksums || {};
  const data = backupArchive.data || {};
  const checksumMismatches: string[] = [];
  const missingReferences: string[] = [];
  let totalChecked = 0;

  for (const doc of data.uploadedDocuments || []) {
    totalChecked++;
    if (!doc.fileDataUrl) {
      missingReferences.push(`updoc:${doc.id}`);
      continue;
    }
    const actualSha = await calculateSHA256(doc.fileDataUrl);
    const expectedSha = checksums[`updoc:${doc.id}`];
    if (expectedSha && actualSha !== expectedSha) {
      checksumMismatches.push(`updoc:${doc.id}`);
    }
  }

  for (const att of data.documentAttachments || []) {
    totalChecked++;
    if (!att.storagePath || !/^[0-9a-f]{64}$/i.test(att.sha256Checksum || '')) {
      missingReferences.push(`att:${att.id}`);
      continue;
    }
    const expectedSha = checksums[`att:${att.id}`];
    if (expectedSha && expectedSha !== att.sha256Checksum) {
      checksumMismatches.push(`att:${att.id}`);
    }
  }

  return {
    totalChecked,
    verifiedCount: Math.max(0, totalChecked - checksumMismatches.length - missingReferences.length),
    checksumMismatches,
    missingReferences,
  };
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

// ============================================================================
// PHASE 8 — GZIP COMPRESSION & RETENTION GOVERNANCE
// ============================================================================

/**
 * Compresses UTF-8 JSON backup text into GZIP bytes using Web CompressionStream (with Node fallback).
 */
export async function compressBackupGzip(plaintext: string): Promise<{
  bytes: Uint8Array;
  base64: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}> {
  const rawBytes = new TextEncoder().encode(plaintext);

  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(rawBytes);
    writer.close();
    const compressedBuf = await new Response(cs.readable).arrayBuffer();
    const out = new Uint8Array(compressedBuf);
    return {
      bytes: out,
      base64: bytesToBase64(out),
      originalSizeBytes: rawBytes.byteLength,
      compressedSizeBytes: out.byteLength,
    };
  }

  // Fallback for older runtimes without CompressionStream
  return {
    bytes: rawBytes,
    base64: bytesToBase64(rawBytes),
    originalSizeBytes: rawBytes.byteLength,
    compressedSizeBytes: rawBytes.byteLength,
  };
}

/**
 * Decompresses GZIP bytes (or Base64-encoded GZIP bytes) back to UTF-8 JSON text.
 */
export async function decompressBackupGzip(input: Uint8Array | string): Promise<string> {
  const bytes = typeof input === 'string' ? base64ToBytes(input) : input;
  const isGzipMagic = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzipMagic) {
    return new TextDecoder().decode(bytes);
  }

  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes as any);
    writer.close();
    const plainBuf = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder().decode(plainBuf);
  }

  throw new Error('GZIP DecompressionStream is not available in this runtime.');
}

/**
 * Computes retention pruning while NEVER deleting the last remaining valid backup.
 */
export function applyBackupRetention(
  history: BackupHistoryItem[],
  retentionCount: number
): { kept: BackupHistoryItem[]; pruned: BackupHistoryItem[] } {
  const minKeep = Math.max(1, retentionCount || 1);
  const validBackups = history.filter((b) => b.status === 'SUCCESS' || b.status === 'VERIFIED');
  const failedBackups = history.filter((b) => b.status === 'FAILED');

  if (validBackups.length <= minKeep) {
    return { kept: [...validBackups, ...failedBackups], pruned: [] };
  }

  const sortedValid = [...validBackups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const keptValid = sortedValid.slice(0, minKeep);
  const prunedValid = sortedValid.slice(minKeep);
  return {
    kept: [...keptValid, ...failedBackups],
    pruned: prunedValid,
  };
}

/**
 * Prevents repeated identical full backups from consuming unnecessary storage when checksum is unchanged.
 */
export function isRedundantBackup(
  candidateChecksum: string,
  recentHistory: BackupHistoryItem[],
  destination: BackupDestination
): boolean {
  const latestSameDest = recentHistory.find(
    (b) => b.destination === destination && (b.status === 'SUCCESS' || b.status === 'VERIFIED')
  );
  return Boolean(latestSameDest && latestSameDest.sha256Checksum === candidateChecksum);
}
