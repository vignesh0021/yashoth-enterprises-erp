# EXPENSE ATTACHMENT & MOBILE CAMERA ARCHITECTURE

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Base Commit:** `cdf563461d513f9206c39f34651d63a80d1f0b52`  
**Audit Mode:** Architecture & Specification Only (no source code or migrations modified)

---

## 1. Current State & Gaps in the Repository

| Component | Current Implementation | Gap / Risk |
| :--- | :--- | :--- |
| **`UploadedDocument`** (`src/types/index.ts#L878-L894`) | Stores `fileDataUrl: string` (Base64 data URL) in `localStorage` and React state (`ERPContext.tsx#L513`). No PostgreSQL table exists. | Base64 inflates size by ~33%, bloats `localStorage`, and `teamSyncService.ts#L41-L42` strips `attachmentUrl` > 256 chars during cloud sync. |
| **`Expense` & `VehicleDocument`** (`008#L43`, `001#L139`) | Single `attachment_url TEXT` column (`attachmentUrl?: string`). | Cannot attach multiple photos per bill, lacks MIME/size/checksum/uploader metadata, and has no replacement audit history. |
| **Supabase Storage** (`database/migrations/*.sql`) | **Not configured.** Zero `storage.buckets` or `storage.objects` policies exist. | No private bucket, no signed URLs, and no cross-company object isolation. |

---

## 2. Target Relational Metadata & Parent Integrity

### 2.1 `document_attachments` Table (No Denormalized `is_posted_parent`)
Do **not** store a denormalized `is_posted_parent` boolean (which drifts if a draft bill is later posted). Enforce financial lock dynamically via `fn_is_parent_financial_locked(parent_entity_type, parent_entity_id)`.

```
document_attachments
├── id (UUID PK)
├── company_id (UUID NOT NULL FK -> companies.id)
├── parent_entity_type (VARCHAR: 'EXPENSE' | 'PURCHASE' | 'INVOICE' | 'VEHICLE_DOC' | 'TRIP' | 'PAYMENT_AUTH')
├── parent_entity_id (UUID NOT NULL)
├── storage_bucket (VARCHAR NOT NULL DEFAULT 'erp-receipts')
├── storage_path (TEXT NOT NULL UNIQUE)     -- {company_id}/{module}/{parent_id}/{id}.{ext}
├── thumbnail_path (TEXT)                   -- {company_id}/{module}/{parent_id}/{id}_thumb.webp
├── original_filename (VARCHAR(255) NOT NULL)
├── mime_type (VARCHAR(100) NOT NULL)       -- 'image/webp' | 'image/jpeg' | 'application/pdf'
├── file_size_bytes (BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880))
├── width (INT)
├── height (INT)
├── sha256_checksum (CHAR(64) NOT NULL)
├── upload_status (VARCHAR(20) NOT NULL DEFAULT 'PENDING_UPLOAD'
│     CHECK (upload_status IN ('PENDING_UPLOAD', 'COMMITTED', 'REJECTED', 'EXPIRED')))
├── integrity_status (VARCHAR(20) NOT NULL DEFAULT 'OK'
│     CHECK (integrity_status IN ('OK', 'MISSING_OBJECT')))
├── replaced_attachment_id (UUID FK -> document_attachments.id)
├── uploaded_by (UUID NOT NULL REFERENCES auth.users(id))
├── reserved_at (TIMESTAMPTZ NOT NULL DEFAULT NOW())
├── committed_at (TIMESTAMPTZ)
└── deleted_at (TIMESTAMPTZ)
```

### 2.2 Polymorphic Parent Integrity at Database Level
Because a single SQL `FOREIGN KEY` cannot target multiple parent tables based on `parent_entity_type`, enforce referential integrity at the PostgreSQL layer via **Option A (Recommended)** or **Option B**:
- **Option A (`SECURITY DEFINER` Trigger `trg_validate_attachment_parent`)**:
  - `BEFORE INSERT OR UPDATE` on `document_attachments` dispatches on `NEW.parent_entity_type` and verifies `EXISTS (SELECT 1 FROM <table_name> WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id)` across `expenses`, `purchase_headers`, `invoices`, `vehicle_documents`, `vehicle_trips`, and `payment_authorizations`. Rejects missing parents and cross-company UUIDs.
  - Pair with `BEFORE DELETE` triggers on each parent table blocking hard deletion if `COMMITTED` attachments exist.
- **Option B (Typed Nullable FKs)**: Separate nullable FK columns (`expense_id`, `purchase_id`, etc.) with `CHECK (num_nonnulls(...) = 1)` for native `ON DELETE RESTRICT` FKs. *(Option A keeps the schema cleaner if more attachable entities are added later.)*

---

## 3. Single Recoverable, Idempotent Upload State Machine

Replace ad-hoc client uploads with one deterministic **3-step state machine**:

1. **Step 1 — Reserve Metadata Row (`fn_reserve_document_attachment`)**:
   - Client sends `(company_id, parent_entity_type, parent_entity_id, sha256_checksum, original_filename, mime_type, file_size_bytes)`.
   - DB validates membership, parent existence/ownership (`trg_validate_attachment_parent`), and size `<= 5 MB`.
   - **Idempotent Duplicate Check**: If a `COMMITTED` row already exists for `(company_id, parent_entity_type, parent_entity_id, sha256_checksum)` where `deleted_at IS NULL`, return that existing row immediately (no duplicate upload).
   - Otherwise insert/reuse a `PENDING_UPLOAD` row and return `{ attachment_id, storage_path, thumbnail_path }`.
2. **Step 2 — Upload Binary to Private Storage (`erp-receipts`)**:
   - Client uploads compressed WebP/JPEG/PDF to `storage_path` (and `thumbnail_path`) with `upsert: false`.
3. **Step 3 — Trusted Backend Verification & Commit (`Edge Function: verify-and-commit-attachment`)**:
   - Client invokes Edge Function with `{ attachment_id }`.
   - Edge Function verifies caller JWT + `company_id` membership, reads the first 16 bytes of the object in `erp-receipts` using server-side `service_role`, verifies **magic-byte signature** (`RIFF....WEBP`, `FF D8 FF`, `%PDF-`), verifies actual stored size `<= 5,242,880` bytes, and updates `upload_status = 'COMMITTED'`, `committed_at = NOW()`.
   - If signature or size validation fails: Edge Function deletes the object from Storage and marks `upload_status = 'REJECTED'`.

### Failure & Recovery Matrix

| Failure Scenario | System State | Deterministic Recovery |
| :--- | :--- | :--- |
| **DB reservation succeeded, Storage upload failed** (network drop) | Row remains `PENDING_UPLOAD`; no object in bucket | Client retries Step 2 + Step 3 using the **same `attachment_id` & `storage_path`**. Unfinished rows `> 24h` are marked `EXPIRED` by cleanup job. |
| **Storage upload succeeded, Step 3 Commit failed** | Object exists in bucket; row still `PENDING_UPLOAD` | Client retries Step 3 (`verify-and-commit-attachment` is idempotent: if already `COMMITTED`, returns `200 OK`). Abandoned `PENDING_UPLOAD` objects `> 24h` are purged by orphan cleanup. |
| **Duplicate retry** | `COMMITTED` row already exists for same `(parent, sha256)` | Step 1 returns existing `COMMITTED` row; Step 2 & Step 3 are skipped. |
| **Attachment replacement** | New `attachment_id` reserved with `replaced_attachment_id = old.id` | Old row remains in audit history (`deleted_at = NOW()` if non-posted, or retained if posted); `audit_logs` records replacement. |

---

## 4. Authoritative Financial Lock & Mobile Camera Rules

- **Authoritative Lock (`fn_is_parent_financial_locked`)**: Queries the live parent row (`purchase_headers.status = 'POSTED'`, `expenses.status IN ('PAID', 'REVERSED')`, `payments.status = 'COMPLETED'`, `invoices.payment_status IN ('PAID', 'PARTIALLY_PAID')`, `vehicle_trips.status = 'CLOSED'`). `BEFORE DELETE` trigger on `document_attachments` blocks deletion whenever true.
- **Mobile Camera**: In-flow camera capture (`capture="environment"` / Capacitor Camera), gallery/PDF fallback, preview → retake → confirm, multi-page support, client WebP compression (`100–300 KB` receipts, `200–500 KB` complex invoices, `~15 KB` thumbnails, preserving legible GSTIN/amounts). Uploading, replacing, or deleting attachments **never** mutates financial balances.

---

## 5. Complete Backup & Restore (PostgreSQL + Storage)

1. **Backup Manifest (`attachment_manifest.json`)**: Exported alongside `pg_dump` containing `{ id, company_id, parent_entity_type, parent_entity_id, storage_bucket, storage_path, thumbnail_path, sha256_checksum, file_size_bytes, mime_type, upload_status }`.
2. **Object Archive**: Companion tarball/ZIP of `erp-receipts/{company_id}/...` objects verified against `sha256_checksum`.
3. **Restore & Reconciliation (`fn_reconcile_attachments`)**:
   - Restore PostgreSQL first, then upload objects from the object archive to `erp-receipts` matching `storage_path` and `sha256_checksum`.
   - **Database restored without Storage object**: `fn_reconcile_attachments` flags `integrity_status = 'MISSING_OBJECT'` on affected `COMMITTED` rows so financial records remain intact and UI prompts re-upload.
   - **Orphaned Storage object**: Storage objects with no matching `COMMITTED` or active `PENDING_UPLOAD` (`< 24h`) row are listed in `orphan_report` and purged only after grace period / admin confirmation.
