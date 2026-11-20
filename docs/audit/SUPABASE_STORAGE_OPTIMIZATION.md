# SUPABASE STORAGE & FREE-TIER OPTIMIZATION REPORT

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Base Commit:** `cdf563461d513f9206c39f34651d63a80d1f0b52`

---

## 1. Verified Supabase Free-Plan Quotas & App Restrictions

| Quota / Limit | Supabase Free-Plan Limit (Official) | Application Restriction (Proposed) | Rationale |
| :--- | :---: | :---: | :--- |
| **Max Single File Upload** | **`50 MB`** (cannot be increased on Free tier) | **`5 MB` (`5,242,880` bytes)** per attachment | Prevents raw phone camera photos (5–12 MB) or unoptimized scans from exhausting the 1 GB project cap. |
| **Total File Storage** | **`1 GB` (`1,024 MiB`)** | Alert at 75% (`768 MiB`); archive >12-month closed years | Protects active operational uploads from hitting hard quota. |
| **Database Size** | **`500 MB`** | Relational metadata only (`~1.2 KB/row`), zero Base64 blobs | Keeps DB well under 50 MB even at 10,000+ receipts. |
| **Uncached / Cached Egress** | **`5 GB / mo` + `5 GB / mo`** | Load `~15 KiB` thumbnails in lists; 5-min signed URL cache | Keeps monthly egress under ~400 MiB across 3 devices. |
| **Active Projects / Pause** | `2` projects; pauses after `7 days` inactivity | N/A | Standard daily ERP sync keeps project active. |

---

## 2. Storage Growth Calculations (Binary Units: `1 MiB = 1,024 KiB`, `1 GiB = 1,024 MiB`)

| Asset Class | Format | Assumed Average Size |
| :--- | :--- | :---: |
| **Standard Receipt Photo** (80% of photos) | WebP (`1280px` max) | `180 KiB` |
| **Complex Invoice Photo** (20% of photos) | WebP (`1600px` max) | `320 KiB` |
| **Blended Photo Average** | WebP | `208 KiB` |
| **Preview Thumbnail** (1 per photo) | WebP (`320px` max) | `15 KiB` |
| **Scanned PDF** (10% extra volume) | Original PDF | `450 KiB` |
| **PostgreSQL Metadata + Index** | Relational row | `1.2 KiB / attachment` |

### Volume Scenarios (Exact Binary Math)

| Scenario | Receipt Photos (`208 KiB`) | Thumbnails (`15 KiB`) | PDFs (`450 KiB`) | Total Object Storage | PostgreSQL Metadata | Free-Tier Status (`1,024 MiB` Storage) |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1,000 Receipts** (+100 PDFs) | `203.1 MiB` | `14.6 MiB` | `43.9 MiB` | **`261.7 MiB`** (`0.26 GiB`) | `~1.3 MiB` | **PASS** (25.6% of 1 GiB) |
| **5,000 Receipts** (+500 PDFs) | `1,015.6 MiB` | `73.2 MiB` | `219.7 MiB` | **`1,308.6 MiB`** (`1.28 GiB`) | `~6.4 MiB` | **EXCEEDS 1 GiB FREE LIMIT** (+284.6 MiB over) |
| **10,000 Receipts** (+1,000 PDFs) | `2,031.3 MiB` | `146.5 MiB` | `439.5 MiB` | **`2,617.2 MiB`** (`2.56 GiB`) | `~12.9 MiB` | **EXCEEDS 1 GiB FREE LIMIT** (2.56× Free quota) |

### 6-Month & 12-Month Projection (Baseline: 350 receipts/mo + 35 PDFs/mo)
- **Monthly Object Growth:** `(350 × 223 KiB + 35 × 450 KiB) / 1,024` = **`91.6 MiB / month`**
- **Monthly DB Growth:** `~3.0 MiB / month` (relational rows + attachment metadata)
- **6 Months:** `~549.6 MiB` Storage (53.7% of 1 GiB), `~18 MiB` DB.
- **12 Months:** `~1,099.2 MiB` (`1.07 GiB`) Storage — **crosses 1 GiB Free cap at Month 11** without cold archival or Pro upgrade; `~36 MiB` DB.
- **Monthly Egress:** `350` list thumbnails (`5.1 MiB`) + `150` full previews (`30.5 MiB`) + API sync (`~150 MiB`) ≈ **`186–350 MiB / month`** (well within `5 GB` Free egress).

---

## 3. Complete Repeatable Backup & Restore Drill (PostgreSQL + Storage)

### Backup Artifact Bundle
1. **PostgreSQL Dump**: `pg_dump -Fc --no-owner --no-acl` (includes `companies`, `document_attachments`, financial tables, and RLS policies).
2. **Attachment Manifest (`attachment_manifest.json`)**: Exported from `document_attachments` (`WHERE upload_status = 'COMMITTED' AND deleted_at IS NULL`) containing `{ id, company_id, parent_entity_type, parent_entity_id, storage_bucket, storage_path, thumbnail_path, sha256_checksum, file_size_bytes, mime_type }`.
3. **Storage Object Archive**: Companion compressed archive of `erp-receipts/{company_id}/...` downloaded via server-side `service_role`.

### Repeatable Restore Drill Steps
1. **Step 1 — Restore PostgreSQL**: Restore `pg_dump -Fc` into a clean target PostgreSQL/Supabase instance and verify schema, triggers (`trg_validate_attachment_parent`), and RLS policies are active.
2. **Step 2 — Restore Storage Objects**: Upload objects from the Storage archive to `erp-receipts` at their exact `storage_path` / `thumbnail_path` keys.
3. **Step 3 — Per-Object SHA-256 Verification**: For every `COMMITTED` row in `attachment_manifest.json` / `document_attachments`:
   - Fetch object metadata and compute/compare SHA-256 of the restored Storage object against `document_attachments.sha256_checksum`.
   - Any checksum mismatch is flagged as `CORRUPTED_OBJECT` in the drill report and quarantined for manual re-upload.
4. **Step 4 — Missing & Orphaned Object Report**:
   - **Missing Objects**: DB `COMMITTED` rows with no object in `erp-receipts` are updated to `integrity_status = 'MISSING_OBJECT'` via `fn_reconcile_attachments()`.
   - **Orphaned Objects**: Objects in `erp-receipts` with no matching `COMMITTED` or `< 24h` `PENDING_UPLOAD` row in `document_attachments` are emitted in `orphan_report.json` (purged only after grace period / admin sign-off).
5. **Step 5 — Post-Restore Company Isolation Verification**: Execute authenticated test queries as Company A user against Company B `document_attachments` rows and `{company_b_id}/...` signed URLs; confirm `0` rows returned and `403`/denied on Storage access.
6. **Step 6 — Financial Record Preservation Guarantee**: Confirm that even when `integrity_status = 'MISSING_OBJECT'` is flagged on attachments, all `purchase_headers`, `expenses`, `invoices`, `payments`, and `journal_entries` remain 100% intact and balanced; UI displays a non-destructive "Receipt binary missing — re-upload" prompt.
