// Client-side Receipt Attachment Upload Service & Bank Import Adapter
// Implements the 3-step idempotent state machine:
//   Step 1: fn_reserve_document_attachment -> PENDING_UPLOAD
//   Step 2: Upload binary to private bucket `erp-receipts` (transitions to UPLOAD_FAILED on error)
//   Step 3: Invoke Edge Function `verify-and-commit-attachment` -> COMMITTED | REJECTED

import type {
  AttachmentParentEntityType,
  BankImportAdapter,
  BankImportRecord,
} from '../types';
import { supabase } from './supabaseClient';
import { dbRepository } from './databaseRepository';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB app cap

export async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function uploadReceiptAttachment(params: {
  companyId: string;
  parentEntityType: AttachmentParentEntityType;
  parentEntityId: string;
  file: File;
  replacedAttachmentId?: string;
  authToken?: string;
}): Promise<{
  success: boolean;
  attachmentId?: string;
  uploadStatus: 'COMMITTED' | 'UPLOAD_FAILED' | 'REJECTED';
  storagePath?: string;
  error?: string;
}> {
  const { file } = params;
  const allowedMimes = ['image/webp', 'image/jpeg', 'application/pdf'];
  if (!allowedMimes.includes(file.type)) {
    return { success: false, uploadStatus: 'REJECTED', error: 'Only WebP, JPEG, and PDF files are supported.' };
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    return { success: false, uploadStatus: 'REJECTED', error: 'File size must be between 1 byte and 5 MB.' };
  }

  const buffer = await file.arrayBuffer();
  const sha256 = await computeSha256Hex(buffer);

  // Step 1: Reserve metadata row (idempotent)
  const reservation = await dbRepository.reserveDocumentAttachment(
    {
      companyId: params.companyId,
      parentEntityType: params.parentEntityType,
      parentEntityId: params.parentEntityId,
      sha256Checksum: sha256,
      originalFilename: file.name,
      mimeType: file.type as 'image/webp' | 'image/jpeg' | 'application/pdf',
      fileSizeBytes: file.size,
      replacedAttachmentId: params.replacedAttachmentId,
    },
    params.authToken
  );

  if (!reservation) {
    return { success: false, uploadStatus: 'UPLOAD_FAILED', error: 'Remote database unavailable to reserve attachment.' };
  }
  if (reservation.status === 'ALREADY_COMMITTED') {
    return {
      success: true,
      attachmentId: reservation.attachment_id,
      uploadStatus: 'COMMITTED',
      storagePath: reservation.storage_path,
    };
  }

  const sdk = supabase.client;
  if (!sdk) {
    await dbRepository.markAttachmentUploadFailed(reservation.attachment_id, params.authToken);
    return { success: false, attachmentId: reservation.attachment_id, uploadStatus: 'UPLOAD_FAILED', error: 'Supabase SDK client not initialized.' };
  }

  // Step 2: Upload binary to private bucket `erp-receipts`
  try {
    const { error: uploadErr } = await sdk.storage
      .from('erp-receipts')
      .upload(reservation.storage_path, file, { contentType: file.type, upsert: false });
    if (uploadErr) {
      await dbRepository.markAttachmentUploadFailed(reservation.attachment_id, params.authToken);
      return {
        success: false,
        attachmentId: reservation.attachment_id,
        uploadStatus: 'UPLOAD_FAILED',
        storagePath: reservation.storage_path,
        error: uploadErr.message,
      };
    }
  } catch (err: any) {
    await dbRepository.markAttachmentUploadFailed(reservation.attachment_id, params.authToken);
    return {
      success: false,
      attachmentId: reservation.attachment_id,
      uploadStatus: 'UPLOAD_FAILED',
      storagePath: reservation.storage_path,
      error: err?.message || 'Storage upload failed',
    };
  }

  // Step 3: Trusted server-side Edge Function magic-byte + size verification
  const { data: verifyData, error: fnErr } = await sdk.functions.invoke('verify-and-commit-attachment', {
    body: { attachment_id: reservation.attachment_id },
  });

  if (fnErr || verifyData?.status === 'REJECTED') {
    return {
      success: false,
      attachmentId: reservation.attachment_id,
      uploadStatus: verifyData?.status === 'REJECTED' ? 'REJECTED' : 'UPLOAD_FAILED',
      storagePath: reservation.storage_path,
      error: fnErr?.message || verifyData?.error || 'Server verification failed',
    };
  }

  return {
    success: true,
    attachmentId: reservation.attachment_id,
    uploadStatus: 'COMMITTED',
    storagePath: reservation.storage_path,
  };
}

/**
 * Future Bank Statement CSV / API Import Adapter (ready for when Bank module is activated).
 */
export const csvBankImportAdapter: BankImportAdapter = {
  providerName: 'Generic Bank CSV Adapter',
  parseStatement(rawCsv: string): BankImportRecord[] {
    const lines = rawCsv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length <= 1) return [];
    const records: BankImportRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 5) continue;
      const [externalTxRef, txDate, directionRaw, amountStr, description, counterpartyName] = cols;
      const amount = Number(amountStr);
      if (!externalTxRef || !txDate || !Number.isFinite(amount) || amount <= 0) continue;
      records.push({
        externalTxRef,
        txDate,
        direction: directionRaw.toUpperCase() === 'DEBIT' ? 'DEBIT' : 'CREDIT',
        amount,
        description: description || 'Bank statement entry',
        counterpartyName: counterpartyName || undefined,
        paymentMethod: 'BANK',
      });
    }
    return records;
  },
};
