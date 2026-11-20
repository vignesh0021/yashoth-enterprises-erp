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
│     CHECK (upload_status IN ('PENDING_UPLOAD', 'UPLOAD_FAILED', 'COMMITTED', 'REJECTED', 'EXPIRED')))
├── integrity_status (VARCHAR(20) NOT NULL DEFAULT 'OK'
│     CHECK (integrity_status IN ('OK', 'MISSING_OBJECT')))
├── replaced_attachment_id (UUID FK -> document_attachments.id)
├── uploaded_by (UUID NOT NULL REFERENCES auth.users(id))
├── reserved_at (TIMESTAMPTZ NOT NULL DEFAULT NOW())
├── committed_at (TIMESTAMPTZ)
└── deleted_at (TIMESTAMPTZ)
```

### 2.2 Polymorphic Parent Integrity at Database Level (Exact `company_id` Ownership Paths)
Because a single SQL `FOREIGN KEY` cannot target multiple parent tables based on `parent_entity_type`, enforce referential integrity at the PostgreSQL layer via **`SECURITY DEFINER` Trigger `trg_validate_attachment_parent`** (`BEFORE INSERT OR UPDATE` on `document_attachments`).

Verified `company_id` ownership paths across all 6 supported parent entities:

| `parent_entity_type` | Target Table | Actual `company_id` Ownership Path (Verified in Migrations) |
| :--- | :--- | :--- |
| `'EXPENSE'` | `expenses` | Direct `expenses.company_id` (`004_multi_company_schema.sql#L127`, `008_finance_and_labour_management.sql#L10`) |
| `'PURCHASE'` | `purchase_headers` | Direct `purchase_headers.company_id` (`004_multi_company_schema.sql#L120`) |
| `'INVOICE'` | `invoices` | Direct `invoices.company_id` (`004_multi_company_schema.sql#L124`) |
| `'VEHICLE_DOC'` | `vehicle_documents` | **Indirect join**: `vehicle_documents` has `vehicle_id` and **NO `company_id`** (`001_initial_schema.sql#L131-L142`; omitted from `004_multi_company_schema.sql#L110-L129`). Must join `vehicle_documents vd JOIN vehicles v ON v.id = vd.vehicle_id WHERE vd.id = NEW.parent_entity_id AND v.company_id = NEW.company_id` (matching `007_authoritative_rls_hardening.sql#L207-L215`). |
| `'TRIP'` | `vehicle_trips` *(proposed)* | Direct `vehicle_trips.company_id` (required in new migration) |
| `'PAYMENT_AUTH'` | `payment_authorizations` *(proposed)* | Direct `payment_authorizations.company_id` (required in new migration) |

```sql
CREATE OR REPLACE FUNCTION fn_validate_attachment_parent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_exists BOOLEAN := false;
BEGIN
    CASE NEW.parent_entity_type
        WHEN 'EXPENSE' THEN
            SELECT EXISTS(SELECT 1 FROM expenses WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        WHEN 'PURCHASE' THEN
            SELECT EXISTS(SELECT 1 FROM purchase_headers WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        WHEN 'INVOICE' THEN
            SELECT EXISTS(SELECT 1 FROM invoices WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        WHEN 'VEHICLE_DOC' THEN
            -- vehicle_documents lacks company_id; validate via parent vehicles.company_id
            SELECT EXISTS(
                SELECT 1
                FROM vehicle_documents vd
                JOIN vehicles v ON v.id = vd.vehicle_id
                WHERE vd.id = NEW.parent_entity_id
                  AND v.company_id = NEW.company_id
            ) INTO v_exists;
        WHEN 'TRIP' THEN
            SELECT EXISTS(SELECT 1 FROM vehicle_trips WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        WHEN 'PAYMENT_AUTH' THEN
            SELECT EXISTS(SELECT 1 FROM payment_authorizations WHERE id = NEW.parent_entity_id AND company_id = NEW.company_id) INTO v_exists;
        ELSE
            RAISE EXCEPTION 'Unsupported parent_entity_type: %', NEW.parent_entity_type;
    END CASE;

    IF NOT v_exists THEN
        RAISE EXCEPTION 'Parent % (%) does not exist in company %', NEW.parent_entity_type, NEW.parent_entity_id, NEW.company_id;
    END IF;
    RETURN NEW;
END;
$$;
```
Pair with `BEFORE DELETE` triggers on each parent table blocking hard deletion if non-deleted `COMMITTED` attachments exist.

---

## 3. Single Authoritative 5-State Upload Machine

All layers (**SQL schema**, **Edge Function**, **Client upload service**, **Cleanup job**, and **Acceptance tests**) MUST use the exact same 5 states:
`PENDING_UPLOAD` | `UPLOAD_FAILED` | `COMMITTED` | `REJECTED` | `EXPIRED`

1. **Step 1 — Reserve Metadata Row (`fn_reserve_document_attachment`)**:
   - Client sends `(company_id, parent_entity_type, parent_entity_id, sha256_checksum, original_filename, mime_type, file_size_bytes)`.
   - DB validates company membership, parent existence/ownership (`fn_validate_attachment_parent`), and `file_size_bytes <= 5242880` (`5 MB`).
   - **Idempotent Duplicate Check**: If a `COMMITTED` row already exists for `(company_id, parent_entity_type, parent_entity_id, sha256_checksum)` where `deleted_at IS NULL`, return that existing row immediately (no duplicate upload).
   - **Retry Reuse**: If a `PENDING_UPLOAD` or `UPLOAD_FAILED` row exists for the same `(company_id, parent_entity_type, parent_entity_id, sha256_checksum)` created within the last 24h, reset `upload_status = 'PENDING_UPLOAD'`, `reserved_at = NOW()` and return `{ attachment_id, storage_path, thumbnail_path }`. Otherwise insert a new `PENDING_UPLOAD` row.
2. **Step 2 — Upload Binary to Private Storage (`erp-receipts`)**:
   - Client uploads compressed WebP/JPEG/PDF to `storage_path` (and `thumbnail_path`) with `upsert: false`.
   - If Storage upload returns an error or network failure: client transitions the row to `UPLOAD_FAILED` via RPC (`fn_mark_attachment_upload_failed(attachment_id)`) so UI displays an explicit retry action.
3. **Step 3 — Trusted Backend Verification & Commit (`Edge Function: verify-and-commit-attachment`)**:
   - Client invokes Edge Function with `{ attachment_id }`.
   - Edge Function verifies caller JWT + `company_id` membership, reads the first 16 bytes of the object in `erp-receipts` using server-side `service_role`, verifies **magic-byte signature** (`RIFF....WEBP`, `FF D8 FF`, `%PDF-`), verifies actual stored size `<= 5,242,880` bytes, and updates `upload_status = 'COMMITTED'`, `committed_at = NOW()`.
   - If signature or size validation fails: Edge Function deletes the object from Storage and marks `upload_status = 'REJECTED'`.

### State Transitions, Retry, Expiry, Replacement & Orphan Cleanup

| Scenario / Transition | Authoritative State | Deterministic Recovery / Cleanup |
| :--- | :--- | :--- |
| **DB reservation succeeded, Storage upload failed** | `PENDING_UPLOAD` -> `UPLOAD_FAILED` | Client retries Step 1/2 using the **same `attachment_id` & `storage_path`** (Step 1 resets `UPLOAD_FAILED` -> `PENDING_UPLOAD`). Unretried `PENDING_UPLOAD` / `UPLOAD_FAILED` rows `> 24h` transition to `EXPIRED`. |
| **Storage upload succeeded, Step 3 Commit failed** | `PENDING_UPLOAD` (object exists in bucket) | Client retries Step 3 (`verify-and-commit-attachment` is idempotent: if already `COMMITTED`, returns `200 OK`). Abandoned `PENDING_UPLOAD` rows `> 24h` transition to `EXPIRED` and their Storage objects are deleted by the orphan cleanup job. |
| **Invalid magic bytes or `> 5 MB` payload** | `REJECTED` | Edge Function immediately deletes the Storage object and marks `upload_status = 'REJECTED'`. Not retried; user must select a valid file. |
| **24-hour TTL exceeded** | `EXPIRED` | Scheduled cleanup job marks `PENDING_UPLOAD` / `UPLOAD_FAILED` rows older than 24h as `EXPIRED` and deletes any partial Storage objects at `storage_path` / `thumbnail_path`. |
| **Duplicate retry** | `COMMITTED` | Step 1 returns existing `COMMITTED` row; Step 2 & Step 3 are skipped. |
| **Attachment replacement** | New row `COMMITTED`, old row soft-deleted or retained | New `attachment_id` reserved with `replaced_attachment_id = old.id`. If parent is unlocked, old row gets `deleted_at = NOW()`; if parent is financially locked, old row remains preserved (`deleted_at IS NULL`) for audit history. |
| **Orphan Storage object** | No matching `COMMITTED` or `< 24h` active row | Listed in `orphan_report`; deleted only after grace period / reconciliation check. |

---

## 4. Authoritative Financial Lock & Concurrency Safety

Every supported parent entity maps to its **actual** status column and allowed values in the schema:

| `parent_entity_type` | Table | Actual Status Column & Allowed Values | Financially Locked Values (Blocks `DELETE` / Hard Purge) |
| :--- | :--- | :--- | :--- |
| `'EXPENSE'` | `expenses` | `status` (`'PAID'`, `'UNPAID'`, `'REVERSED'`) (`008_finance_and_labour_management.sql#L24`) | `status IN ('PAID', 'REVERSED')` |
| `'PURCHASE'` | `purchase_headers` | `status` (`'DRAFT'`, `'SUBMITTED'`, `'VERIFIED'`, `'APPROVED'`, `'POSTED'`, `'CANCELLED'`) (`001_initial_schema.sql#L251`) + `amount_paid` | `status = 'POSTED' OR amount_paid > 0` |
| `'INVOICE'` | `invoices` | `payment_status` (`'UNPAID'`, `'PARTIALLY_PAID'`, `'PAID'`, `'CANCELLED'`) + `is_cancelled` (`001_initial_schema.sql#L383,L387`) | `payment_status IN ('PARTIALLY_PAID', 'PAID')` |
| `'VEHICLE_DOC'` | `vehicle_documents` | No financial status column (`001_initial_schema.sql#L131-L142`) | Non-financial compliance doc; never financially locked (protected by role/company RLS). |
| `'TRIP'` | `vehicle_trips` *(proposed)* | `status` (`'PLANNED'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'SETTLED'`, `'CANCELLED'`) | `status = 'SETTLED'` |
| `'PAYMENT_AUTH'` | `payment_authorizations` *(proposed)* | `status` (`'DRAFT'`, `'ACTIVE'`, `'USED'`, `'REVOKED'`, `'EXPIRED'`) | `status = 'USED'` |

- **Concurrent Posting vs. Attachment Deletion (`FOR UPDATE` Row Lock)**:
  - `fn_is_parent_financial_locked(parent_entity_type, parent_entity_id)` MUST execute `SELECT ... FOR UPDATE` on the parent row (e.g., `SELECT status, amount_paid FROM purchase_headers WHERE id = p_parent_id FOR UPDATE`) inside the `BEFORE DELETE` / soft-delete RPC transaction.
  - Financial posting RPCs (`post_purchase`, `mark_expense_paid`, `settle_trip`) also lock the parent row (`FOR UPDATE`). This serializes concurrent attachment deletion and financial posting so an attachment cannot be deleted mid-post, and prevents permanent deletion of evidence linked to posted/paid records.
- **Mobile Camera**: In-flow camera capture (`capture="environment"` / Capacitor Camera), gallery/PDF fallback, preview → retake → confirm, multi-page support, client WebP compression (`100–300 KB` receipts, `200–500 KB` complex invoices, `~15 KB` thumbnails, preserving legible GSTIN/amounts). Uploading, replacing, or deleting attachments **never** mutates financial balances.

---

## 5. Complete Backup & Restore (PostgreSQL + Storage)

1. **Backup Manifest (`attachment_manifest.json`)**: Exported alongside `pg_dump` containing `{ id, company_id, parent_entity_type, parent_entity_id, storage_bucket, storage_path, thumbnail_path, sha256_checksum, file_size_bytes, mime_type, upload_status }`.
2. **Object Archive**: Companion tarball/ZIP of `erp-receipts/{company_id}/...` objects verified against `sha256_checksum`.
3. **Restore & Reconciliation (`fn_reconcile_attachments`)**:
   - Restore PostgreSQL first, then upload objects from the object archive to `erp-receipts` matching `storage_path` and `sha256_checksum`.
   - **Database restored without Storage object**: `fn_reconcile_attachments` flags `integrity_status = 'MISSING_OBJECT'` on affected `COMMITTED` rows so financial records remain intact and UI prompts re-upload.
   - **Orphaned Storage object**: Storage objects with no matching `COMMITTED` or active `PENDING_UPLOAD` (`< 24h`) row are listed in `orphan_report` and purged only after grace period / admin confirmation.
