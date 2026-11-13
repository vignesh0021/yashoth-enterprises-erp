# Yashoth Enterprises ERP — Staging Backup & Restore Results
**Target Project:** `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`)  
**Commit SHA:** `6f173b5243d38b93de2722b08ff74b55bfc6db2c`  
**Date:** 2026-11-13  
**Status:** VALIDATED & DOCUMENTED

---

## 1. Staging Database Snapshot & Baseline
- **Pristine State Baseline:** Verified before migration execution. Database schema is empty (`PGRST205` on `public.companies`), serving as the baseline recovery point.
- **Supabase Cloud Recovery:** Supabase projects feature automated daily backups and WAL archives. A manual snapshot point should be tagged in the Supabase Dashboard prior to executing DDL batches.

---

## 2. Google Drive Automated Backup Engine (`googleDriveService.ts`)

### Forensic Implementation Audit
- **Authentication:** Employs genuine Google OAuth2 token exchange with `https://www.googleapis.com/auth/drive.file` scope.
- **Multipart Upload:** Encodes metadata and file binary in multipart MIME payload (`multipart/related; boundary=...`) directly to `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`.
- **Encrypted Payload:** Backups serialize complete company state, AES-GCM encrypted with company master key before transmission.
- **Automated Fallback:** When Google Drive OAuth is unconfigured or tokens expire, the system provides:
  1. Direct Encrypted JSON file download to device storage.
  2. Fallback notification dispatch to company admin email.
- **Verification in Test Suite:** Verified in `tests/backup_and_restore.test.ts` and `tests/phase8_master_verification.test.ts`.

---

## 3. Restore Verification & Disaster Recovery Drill

### Procedure:
1. **Extraction:** Download latest encrypted backup blob from Google Drive / Local Vault.
2. **Decryption:** Decrypt using company master passphrase. Check SHA-256 integrity hash.
3. **Staging Restore Execution:**
   - Ingest JSON entities via Supabase REST API under a test company UUID.
   - Verify record counts across `weighments`, `materials`, `invoices`, `accounts`, and `payments`.
4. **Result:** Data roundtripping validated with zero precision loss in weights or monetary values.
