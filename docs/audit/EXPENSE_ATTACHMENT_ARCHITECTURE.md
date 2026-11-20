# EXPENSE ATTACHMENT & MOBILE CAMERA ARCHITECTURE

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Base Commit:** `0148b7a4a6a1e4a2d2c8272f9c3d3636e8d6f6d9`  
**Audit Mode:** Architecture & Specification Only (no source code or migrations modified)

---

## 1. Current State & Gaps in the Repository

| Component | Current Implementation | Gap / Risk |
| :--- | :--- | :--- |
| **`UploadedDocument`** (`src/types/index.ts#L878-L894`) | Stores `fileDataUrl: string` (Base64 data URL) in `localStorage` and React state (`ERPContext.tsx#L513`). No PostgreSQL table exists. | Base64 inflates size by ~33%, bloats `localStorage` (5–10 MB browser quota), and `teamSyncService.ts#L41-L42` strips `attachmentUrl` > 256 chars during cloud sync. |
| **`Expense` & `VehicleDocument`** (`008#L43`, `001#L139`) | Single `attachment_url TEXT` column (`attachmentUrl?: string`). | Cannot attach multiple photos for lengthy bills, lacks MIME/size/checksum/uploader metadata, and has no replacement audit history. |
| **Supabase Storage** (`database/migrations/*.sql`) | **Not configured.** Zero `storage.buckets` or `storage.objects` policies exist. | No private bucket, no signed URLs, and no cross-company object isolation. |
| **Mobile Camera Capture** (`InvoicesView`, `VehiclesView`, `CommercialDocumentsView`) | Standard `<input type="file">` only; `FinanceView` (Expense Manager) has no attachment UI at all. | Users cannot capture fuel/toll/purchase receipts directly from the expense or trip entry workflow with preview, retake, and multi-photo support. |

---

## 2. Target Attachment Architecture

### 2.1 Relational Metadata Table (`document_attachments`)
Rather than creating separate attachment tables per module or keeping Base64 blobs, extend the generic attachment concept into one normalized PostgreSQL table:

```
document_attachments
├── id (UUID PK)
├── company_id (UUID NOT NULL FK -> companies.id)
├── parent_entity_type (VARCHAR: 'EXPENSE' | 'PURCHASE' | 'SUPPLIER_BILL' | 'VEHICLE_DOC' | 'TRIP' | 'PAYMENT_AUTH')
├── parent_entity_id (UUID NOT NULL)
├── storage_bucket (VARCHAR NOT NULL DEFAULT 'erp-receipts')
├── storage_path (TEXT NOT NULL)           -- company_id/expenses/<expense_id>/<attachment_id>.webp
├── thumbnail_path (TEXT)                  -- company_id/expenses/<expense_id>/<attachment_id>_thumb.webp
├── original_filename (VARCHAR(255) NOT NULL)
├── mime_type (VARCHAR(100) NOT NULL)      -- image/webp, image/jpeg, application/pdf
├── file_size_bytes (BIGINT NOT NULL)
├── width (INT)                            -- NULL for PDFs
├── height (INT)                           -- NULL for PDFs
├── sha256_checksum (CHAR(64) NOT NULL)    -- duplicate detection & integrity verification
├── is_posted_parent (BOOLEAN NOT NULL DEFAULT false)
├── replaced_attachment_id (UUID FK -> document_attachments.id)
├── uploaded_by (UUID NOT NULL REFERENCES auth.users(id))
├── created_at (TIMESTAMPTZ NOT NULL DEFAULT NOW())
└── deleted_at (TIMESTAMPTZ)               -- soft-delete only; blocked if parent is POSTED
```

### 2.2 Storage Path Convention (Private Bucket: `erp-receipts`)
- Expenses / Fuel / Toll: `{company_id}/expenses/{expense_id}/{attachment_id}.webp`
- Purchases / Supplier Bills: `{company_id}/purchases/{purchase_id}/{attachment_id}.webp`
- PDFs (Invoices / E-Way Bills / Freight Bills): `{company_id}/bills/{bill_id}/{attachment_id}.pdf`
- Thumbnails: `{company_id}/{module}/{parent_id}/{attachment_id}_thumb.webp`

---

## 3. Mobile Camera & Gallery Capture Workflow

1. **In-Flow Capture (No Leaving Screen)**:
   - Inside `FinanceView` (Expense / Cashflow modal), `PurchasesView`, and `CollectionsView` (Trip expenses), provide **Camera Capture** (`<input type="file" accept="image/*" capture="environment">` / Capacitor Camera API fallback) + **Gallery / PDF Picker** (`image/*,application/pdf`, `multiple`).
2. **Preview → Retake → Confirm**:
   - Render local object URL preview before compression/upload, allowing **Retake**, **Rotate**, or **Add Another Page** for multi-page bills.
3. **Client-Side Compression Pipeline (Canvas / WebP)**:
   - Resize max dimension to `1600px` (detailed invoices) or `1280px` (thermal receipts) while preserving legible GSTIN, invoice numbers, dates, and line items.
   - Encode to `image/webp` (`quality: 0.78`, target `100–300 KB` for receipts, `200–500 KB` for complex invoices) with `image/jpeg` fallback if WebP encoding is unsupported.
   - Generate `320px` thumbnail (`~12–20 KB`).
   - Keep PDFs in original format (enforce max size limit, e.g., `5 MB`).
   - **Readability Guard**: Do not over-compress below legibility; if compressed size exceeds target slightly to keep text sharp, allow up to `750 KB` cap.
4. **Android Permissions & Offline / Retry Reliability**:
   - Handle `CAMERA` / `READ_MEDIA_IMAGES` permission denial gracefully with fallback to Android file/gallery picker.
   - **2-Phase Upload State Machine**:
     - `PENDING_UPLOAD` (queued locally in IndexedDB/filesystem if offline) → `UPLOADING` (progress bar) → `UPLOADED` (Storage object written) → `COMMITTED` (PostgreSQL `document_attachments` row inserted).
   - **Partial Failure Recovery**:
     - *Storage succeeded, DB metadata failed*: Retry metadata insert using the same `attachment_id` & `sha256_checksum`; if user cancels, queue orphan cleanup.
     - *DB metadata created, Storage failed*: Mark status `UPLOAD_FAILED` with 1-tap **Retry Upload**; UI shows retry badge instead of broken image.
     - *Duplicate retry*: Check `(company_id, parent_entity_id, sha256_checksum)` before uploading to prevent duplicate objects.
5. **Financial Immutability & Retention Rules**:
   - Uploading, replacing, or soft-deleting an attachment **NEVER** modifies `amount`, `outstanding_balance`, `account_transactions`, or `journal_entries`.
   - Replacing an attachment creates a new `document_attachments` row with `replaced_attachment_id` pointing to the prior record and writes an `audit_logs` entry.
   - Attachments linked to `POSTED` purchases, invoices, or `PAID` expenses **cannot be permanently deleted** (`deleted_at` / hard-delete blocked by RLS + trigger).
