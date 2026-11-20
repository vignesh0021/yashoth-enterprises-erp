# STORAGE & ATTACHMENT RLS SECURITY REVIEW

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Base Commit:** `0148b7a4a6a1e4a2d2c8272f9c3d3636e8d6f6d9`

---

## 1. Security Requirements & Current Baseline

Existing PostgreSQL RLS (`007_authoritative_rls_hardening.sql`, `009_finance_atomic_and_advance_integrity.sql`) uses:
- `auth_is_company_member(cid UUID)`
- `auth_has_company_role(cid UUID, VARIADIC allowed_roles TEXT[])`

Currently, **no Supabase Storage bucket or `storage.objects` RLS policy exists** in `database/migrations/`.

---

## 2. Mandatory Storage & Metadata Security Controls

| Control | Specification | Enforcement Layer |
| :--- | :--- | :--- |
| **Private Bucket Only** | Create bucket `erp-receipts` with `public = false`, `file_size_limit = 5242880` (5 MB), `allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'application/pdf']`. | `storage.buckets` configuration |
| **Company-Scoped Path Prefix** | Every object key MUST begin with `{company_id}/...` (first path folder = UUID of company). | `storage.objects` RLS + client/RPC check |
| **Storage SELECT RLS** | Authenticated user can read objects ONLY if `bucket_id = 'erp-receipts'` AND `auth_is_company_member((storage.foldername(name))[1]::uuid)` is true. | `storage.objects` `FOR SELECT` policy |
| **Storage INSERT RLS** | Authenticated user with operational write role (`owner_admin`, `accounts_operator`, `supervisor`) can upload ONLY into their active company's `{company_id}/` folder. | `storage.objects` `FOR INSERT` policy |
| **Storage DELETE / UPDATE Block** | Direct `DELETE` on `storage.objects` restricted to `owner_admin` AND only when no `POSTED`/`PAID` parent record references the path (or handled via soft-delete + retention job). | `storage.objects` `FOR DELETE` policy |
| **PostgreSQL `document_attachments` RLS** | `SELECT`: `auth_is_company_member(company_id)`. `INSERT`: `auth_has_company_role(company_id, 'owner_admin', 'accounts_operator', 'supervisor')` + verify parent record (`expense`/`purchase`/`vehicle_doc`/`trip`) belongs to same `company_id`. `DELETE`: denied for `POSTED`/`PAID` parents. | PostgreSQL RLS + `BEFORE INSERT/DELETE` trigger |
| **Short-Lived Signed URLs** | Generate signed URLs via `supabase.storage.from('erp-receipts').createSignedUrl(path, 300)` (5-minute TTL). Never persist signed URLs in DB. | Client/Edge service |
| **MIME & Magic-Byte Validation** | Validate actual file header bytes (`RIFF..WEBP`, `FF D8 FF`, `%PDF-`) before upload, not just file extension. | Client validator + Bucket MIME allowlist |
| **No Service-Role Key in Frontend** | `VITE_SUPABASE_ANON_KEY` only in frontend; `service_role` key strictly prohibited in client bundle. | `supabaseClient.ts` & CI check |

---

## 3. Cross-Tenant Attack Vectors & Mitigations

1. **UUID / Path Guessing (`company_b_id/expenses/.../att.webp`)**:
   - Blocked by `storage.objects` RLS checking `(storage.foldername(name))[1]::uuid` against `auth_is_company_member(...)`. Even if a Company A user guesses a Company B UUID and path, `createSignedUrl` and direct object download return `403/404`.
2. **Orphaned / Unlinked Parent Spoofing**:
   - `document_attachments` `BEFORE INSERT` trigger verifies `parent_entity_id` exists in the target table with matching `company_id`, preventing attaching Company A metadata to a Company B expense UUID.
3. **Posted Bill Tampering**:
   - `BEFORE UPDATE / DELETE` trigger on `document_attachments` checks parent status (`POSTED` / `PAID`) and blocks hard deletion; replacements create a new versioned row (`replaced_attachment_id`) with immutable `audit_logs`.
