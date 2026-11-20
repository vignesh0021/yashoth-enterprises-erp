# STORAGE & ATTACHMENT RLS SECURITY REVIEW

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Base Commit:** `cdf563461d513f9206c39f34651d63a80d1f0b52`

---

## 1. Security Baseline & Gaps

Existing PostgreSQL RLS (`007_authoritative_rls_hardening.sql`, `009_finance_atomic_and_advance_integrity.sql`) enforces `auth_is_company_member(cid)` and `auth_has_company_role(cid, VARIADIC allowed_roles)`. Currently, **no Supabase Storage bucket or `storage.objects` RLS policy exists** in `database/migrations/`.

---

## 2. Mandatory Storage, Backend & Metadata Controls

| Control | Specification | Enforcement Layer |
| :--- | :--- | :--- |
| **Private Bucket & Size Cap** | Bucket `erp-receipts`: `public = false`, `file_size_limit = 5242880` (5 MB app cap, well within Supabase Free-plan 50 MB global upload max), `allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'application/pdf']`. | `storage.buckets` |
| **Trusted Backend Magic-Byte Validation** | Client MIME checks are UX-only. Edge Function `verify-and-commit-attachment` reads object header bytes from `erp-receipts` (`RIFF....WEBP`, `FF D8 FF`, `%PDF-`), verifies actual byte size `<= 5 MB`, and rejects/deletes spoofed files before setting `upload_status = 'COMMITTED'`. | Supabase Edge Function (server-side `service_role` only; never in frontend) |
| **Company-Scoped Path Prefix** | Every object key MUST match `{company_id}/{module}/{parent_id}/{attachment_id}.{ext}`. | `storage.objects` RLS + `fn_reserve_document_attachment` |
| **Storage SELECT RLS** | `bucket_id = 'erp-receipts'` AND `auth_is_company_member((storage.foldername(name))[1]::uuid)`. | `storage.objects` `FOR SELECT` |
| **Storage INSERT RLS** | `bucket_id = 'erp-receipts'` AND `auth_has_company_role((storage.foldername(name))[1]::uuid, 'owner_admin', 'accounts_operator', 'supervisor')` AND `EXISTS (SELECT 1 FROM document_attachments da WHERE da.storage_path = name AND da.upload_status = 'PENDING_UPLOAD')`. | `storage.objects` `FOR INSERT` |
| **Storage DELETE RLS** | Restricted to `owner_admin` AND `EXISTS (SELECT 1 FROM document_attachments da ... AND NOT fn_is_parent_financial_locked(da.parent_entity_type, da.parent_entity_id))` (no hard deletion of posted bill/paid expense receipts). | `storage.objects` `FOR DELETE` |
| **Polymorphic Parent Integrity** | `trg_validate_attachment_parent` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`) verifies `parent_entity_id` exists in the matching table with `company_id = NEW.company_id` (joining `vehicle_documents -> vehicles` for `VEHICLE_DOC`). | `document_attachments` `BEFORE INSERT OR UPDATE` |
| **Authoritative Posted Lock** | `fn_is_parent_financial_locked(parent_entity_type, parent_entity_id)` queries live parent status (`POSTED`, `PAID`, `REVERSED`, `PARTIALLY_PAID`, `SETTLED`, `USED`) with `FOR UPDATE` row locking — replaces denormalized `is_posted_parent` boolean. | `document_attachments` `BEFORE UPDATE/DELETE` trigger |
| **Short-Lived Signed URLs** | `createSignedUrl(path, 300)` (5-min TTL) generated on demand; never stored in DB. | Client/Edge service |
| **No Service-Role Key in Frontend** | `VITE_SUPABASE_ANON_KEY` only in frontend bundle; `service_role` lives strictly inside Supabase Edge Functions (`verify-and-commit-attachment`) and admin backup jobs. | `src/services/supabaseClient.ts` |

---

## 3. Executable RLS Policies (`document_attachments` & `storage.objects`)

### 3.1 `document_attachments` RLS (Allows Reading Own-Company `PENDING_UPLOAD` Rows)

Because the `storage.objects` `INSERT` policy runs under the **authenticated user's RLS context** (not `service_role`), `document_attachments` `FOR SELECT` MUST allow company members to read their own company's `PENDING_UPLOAD` rows:

```sql
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: Any active company member can view own-company attachment metadata
-- (including PENDING_UPLOAD rows so Storage INSERT RLS subquery succeeds).
CREATE POLICY document_attachments_select_policy ON document_attachments
    FOR SELECT
    TO authenticated
    USING (auth_is_company_member(company_id));

-- INSERT: Only authorized operational roles can reserve metadata rows.
-- Initial status is restricted to PENDING_UPLOAD and uploaded_by must match auth.uid().
CREATE POLICY document_attachments_insert_policy ON document_attachments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth_has_company_role(company_id, 'owner_admin', 'accounts_operator', 'supervisor')
        AND upload_status = 'PENDING_UPLOAD'
        AND uploaded_by = auth.uid()
    );

-- UPDATE: Operational roles can mark UPLOAD_FAILED or soft-delete unlocked rows;
-- transition to COMMITTED / REJECTED is performed only by Edge Function (service_role).
CREATE POLICY document_attachments_update_policy ON document_attachments
    FOR UPDATE
    TO authenticated
    USING (
        auth_has_company_role(company_id, 'owner_admin', 'accounts_operator', 'supervisor')
    )
    WITH CHECK (
        auth_has_company_role(company_id, 'owner_admin', 'accounts_operator', 'supervisor')
        AND upload_status IN ('PENDING_UPLOAD', 'UPLOAD_FAILED')
    );

-- DELETE: Hard delete restricted to owner_admin when parent is NOT financially locked.
CREATE POLICY document_attachments_delete_policy ON document_attachments
    FOR DELETE
    TO authenticated
    USING (
        auth_has_company_role(company_id, 'owner_admin')
        AND NOT fn_is_parent_financial_locked(parent_entity_type, parent_entity_id)
    );
```

### 3.2 `storage.objects` RLS (`erp-receipts` Bucket)

```sql
-- 1. SELECT: Company members can read/sign objects only within their own {company_id}/ prefix
CREATE POLICY erp_receipts_select_policy ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'erp-receipts'
        AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND auth_is_company_member(((storage.foldername(name))[1])::uuid)
    );

-- 2. INSERT: Authorized roles can upload ONLY when a matching PENDING_UPLOAD row exists
-- in document_attachments for the same company_id (readable via document_attachments_select_policy).
CREATE POLICY erp_receipts_insert_policy ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'erp-receipts'
        AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND auth_has_company_role(
            ((storage.foldername(name))[1])::uuid,
            'owner_admin', 'accounts_operator', 'supervisor'
        )
        AND EXISTS (
            SELECT 1
            FROM public.document_attachments da
            WHERE da.company_id = ((storage.foldername(name))[1])::uuid
              AND (da.storage_path = name OR da.thumbnail_path = name)
              AND da.upload_status = 'PENDING_UPLOAD'
              AND da.deleted_at IS NULL
        )
    );

-- 3. DELETE: Only owner_admin can delete objects, and NEVER if the linked parent is financially locked.
-- (Edge Function and cleanup cron use service_role to purge REJECTED/EXPIRED objects.)
CREATE POLICY erp_receipts_delete_policy ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'erp-receipts'
        AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND auth_has_company_role(((storage.foldername(name))[1])::uuid, 'owner_admin')
        AND EXISTS (
            SELECT 1
            FROM public.document_attachments da
            WHERE da.company_id = ((storage.foldername(name))[1])::uuid
              AND (da.storage_path = name OR da.thumbnail_path = name)
              AND NOT public.fn_is_parent_financial_locked(da.parent_entity_type, da.parent_entity_id)
        )
    );
```

---

## 4. Cross-Tenant, Role & Tampering Prevention Verification

1. **Cross-Company Denial (`SELECT` / `INSERT` / `DELETE`)**: A user in Company A attempting to read, upload to, or delete `{company_b_id}/...` fails `auth_is_company_member` / `auth_has_company_role` (`403` / RLS violation).
2. **Unauthorized Role Denial**: A read-only user (`viewer` or `driver`) attempting to insert into `document_attachments` or `storage.objects` is blocked by `auth_has_company_role(..., 'owner_admin', 'accounts_operator', 'supervisor')`. An `accounts_operator` attempting `DELETE` on `storage.objects` is blocked by `'owner_admin'` restriction.
3. **PENDING_UPLOAD Verification Chain**: Because `document_attachments_select_policy` permits `auth_is_company_member(company_id)` on `PENDING_UPLOAD` rows, the `EXISTS (...)` subquery inside `erp_receipts_insert_policy` evaluates cleanly without needing `SECURITY DEFINER` or `service_role` in the browser.
4. **Parent Spoofing**: `trg_validate_attachment_parent` rejects inserting a `document_attachments` row pointing to a `parent_entity_id` owned by another company or wrong entity type.
5. **Spoofed Extension / HTML-as-WebP**: Even if a user bypasses client compression and uploads `.html` or `.exe` renamed `.webp`, `verify-and-commit-attachment` inspects the binary magic bytes and deletes the object before commit (`upload_status = 'REJECTED'`).
