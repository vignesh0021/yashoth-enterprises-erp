# SUPABASE STORAGE & FREE-TIER OPTIMIZATION REPORT

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Base Commit:** `0148b7a4a6a1e4a2d2c8272f9c3d3636e8d6f6d9`

---

## 1. Verified Supabase Free-Plan Quotas

Per Supabase Free Plan specifications:
- **Database Size:** `500 MB` per project
- **File Storage Size:** `1 GB` (`1,024 MB`)
- **Uncached Egress:** `5 GB / month`
- **Cached Egress:** `5 GB / month`
- **Active Projects:** Up to `2` per organization
- **Inactivity Policy:** Free projects pause after `7 days` of inactivity

---

## 2. Storage Growth Assumptions (Transparent Model)

| Asset Class | Format | Assumed Average Size | Notes |
| :--- | :--- | :---: | :--- |
| **Receipt Photo (Standard)** | WebP (`1280px` max) | `180 KB` | Fuel, toll, tea/loading thermal receipts (target `100–300 KB`) |
| **Complex Invoice Photo** | WebP (`1600px` max) | `320 KB` | Multi-line scrap supplier bills (target `200–500 KB`) |
| **Preview Thumbnail** | WebP (`320px` max) | `15 KB` | Used in list views & expense cards |
| **Scanned PDF** | Original PDF | `450 KB` | E-Way Bills, GST invoices (assumed 10% of total volume) |
| **PostgreSQL Metadata Row** | Relational + Index | `~1.2 KB / row` | `document_attachments` + `audit_logs` entry |

*Blended average per photographic receipt (80% standard @ 180 KB + 20% complex @ 320 KB): `208 KB` + `15 KB` thumbnail = **`223 KB` per photo**.*

---

## 3. Storage Estimates (1,000 / 5,000 / 10,000 Receipts)

| Volume Scenario | Receipt Photos (WebP) | Thumbnails (WebP) | PDFs (10% extra count) | Total Object Storage | PostgreSQL Metadata | Free-Tier Status (`1 GB` Storage / `500 MB` DB) |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1,000 Receipts** (+100 PDFs) | `208 MB` | `15 MB` | `45 MB` | **`268 MB`** | `~1.3 MB` | **PASS** (26% of 1 GB Storage; <1% DB) |
| **5,000 Receipts** (+500 PDFs) | `1,040 MB` | `75 MB` | `225 MB` | **`1,340 MB` (`1.31 GB`)** | `~6.6 MB` | **EXCEEDS 1 GB FREE LIMIT** (+316 MB over) |
| **10,000 Receipts** (+1,000 PDFs) | `2,080 MB` | `150 MB` | `450 MB` | **`2,680 MB` (`2.62 GB`)** | `~13.2 MB` | **EXCEEDS 1 GB FREE LIMIT** (2.6× Free quota) |

### 6-Month & 12-Month Growth Projection (Scrap Yard Baseline: ~350 receipts/month + 35 PDFs/month)
- **Monthly Object Storage Growth:** `(350 × 223 KB) + (35 × 450 KB)` ≈ **`93.8 MB / month`**
- **Monthly Database Growth:** Core relational rows (`purchases`, `weighments`, `trips`, `journals`, `attachments` metadata) ≈ **`2.5–4 MB / month`**
- **6 Months:** `~563 MB` Storage (within 1 GB), `~20 MB` DB (well within 500 MB).
- **12 Months:** `~1,126 MB` (`1.10 GB`) Storage (**hits 1 GB Free cap around Month 10–11**), `~45 MB` DB.
- **Monthly Egress Estimate:** Viewing `350` thumbnails (`5.2 MB`) + `150` full previews (`33 MB`) + sync/API queries (`~150 MB`) across 3 devices ≈ **`200–400 MB / month`** (well within `5 GB / month` Free egress, provided thumbnails are used in lists and full images load only on tap).

---

## 4. Concrete Optimization Strategy (Zero Audit/Security Compromise)

1. **Database Storage**:
   - Never store Base64 images in PostgreSQL (`uploaded_documents.fileDataUrl` must NOT be migrated as a DB column).
   - Store normalized relational tables with `NUMERIC(15,2)`, `DATE`, `TIMESTAMPTZ`, `UUID` — reserve `JSONB` strictly for flexible metadata/audit snapshots.
   - Avoid duplicate indexes on already-unique columns.
2. **Object Storage**:
   - Client-side WebP compression (`100–300 KB` receipts) + SHA-256 deduplication so re-uploading the same photo reuses or skips duplicate storage.
   - Archive prior closed fiscal-year receipt binaries (>12 months old) to Google Drive / cold backup while keeping PostgreSQL metadata + checksums intact.
3. **Network Bandwidth (Egress)**:
   - List/card views load **`_thumb.webp` (~15 KB)** only; full-resolution receipt downloads only on explicit user preview/download tap.
   - Cache signed URLs client-side within their short TTL (e.g., 5 minutes) during a session.
4. **Backup Size**:
   - Database backups (`pg_dump -Fc` / compressed JSON) exclude Storage binaries and reference `storage_path` + `sha256_checksum`, keeping DB backups under `10–25 MB`.
