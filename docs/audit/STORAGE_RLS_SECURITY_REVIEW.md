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
| **Storage DELETE RLS** | Restricted to `owner_admin` AND `NOT fn_is_parent_financial_locked(...)` (no hard deletion of posted bill/paid expense receipts). | `storage.objects` `FOR DELETE` |
| **Polymorphic Parent Integrity** | `trg_validate_attachment_parent` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`) verifies `parent_entity_id` exists in the matching table with `company_id = NEW.company_id`. | `document_attachments` `BEFORE INSERT OR UPDATE` |
| **Authoritative Posted Lock** | `fn_is_parent_financial_locked(parent_entity_type, parent_entity_id)` queries live parent status (`POSTED`, `PAID`, `COMPLETED`, `CLOSED`) — replaces denormalized `is_posted_parent` boolean. | `document_attachments` `BEFORE UPDATE/DELETE` trigger |
| **Short-Lived Signed URLs** | `createSignedUrl(path, 300)` (5-min TTL) generated on demand; never stored in DB. | Client/Edge service |
| **No Service-Role Key in Frontend** | `VITE_SUPABASE_ANON_KEY` only in frontend bundle. | `src/services/supabaseClient.ts` |

---

## 3. Cross-Tenant & Tampering Prevention

1. **UUID / Path Guessing**: Company A user requesting a signed URL or direct object for `{company_b_id}/...` is blocked by `storage.objects` `FOR SELECT` RLS (`auth_is_company_member`).
2. **Parent Spoofing**: `trg_validate_attachment_parent` rejects inserting a `document_attachments` row pointing to a `parent_entity_id` owned by another company or wrong entity type.
3. **Spoofed Extension / HTML-as-WebP**: Even if a user bypasses client compression and uploads `.html` or `.exe` renamed `.webp`, `verify-and-commit-attachment` inspects the binary magic bytes and deletes the object before commit.
