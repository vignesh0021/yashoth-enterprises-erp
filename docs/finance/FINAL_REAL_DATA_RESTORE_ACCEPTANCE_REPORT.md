# FINAL REAL-DATA BACKUP & RESTORE ACCEPTANCE REPORT

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Base Commit:** `6f5f4e697cdc15c4a97807b85dfd01f59b245394`  
**Final Decision:** **`STAGING READY`** *(Cannot be marked `PRODUCTION READY` until live staging Supabase migrations `012`/`013`, Edge Function deployment, and live Android APK acceptance tests are executed).*

---

## 1. Source Backup & Schema Details

- **Real Production Backup Inspected (Read-Only):** `/data/user/0/com.termux/files/home/storage/downloads/YE_FULL_BACKUP_2026-11-20T02-14-42.json` (`1,160,855` bytes)
- **Source Application Version:** `1.0.0` | **Source Schema Version:** `1.0.0` | **Target Schema Version:** `2.0.0`
- **Generated At:** `2026-11-20T02:14:42.468Z` | **Actor:** `Yasoth Owner Admin`
- **Manifest SHA-256:** `1a4b54c314781e164f8d746f47cbe9838f541fa1f43a4b667a9ec24d7df0351b` (**Verified Valid**)

### Excluded Device-Local Keys (Intentional)
- `ye_alerts_muted_date`, `ye_erp_dummy_purged_v1`, and ephemeral UI mute/filter flags are excluded from business backups because they are per-device UI state rather than accounting records.

---

## 2. Source vs. Restored Record Counts (Exact 1:1 Match)

| Collection | Source (`1.0.0`) | Restored (`2.0.0`) | Repeat Restore (`preventOverwrite: true`) | Diff |
| :--- | :---: | :---: | :---: | :---: |
| `companies` / `yards` | `2` / `2` | `2` / `2` | `2` / `2` | `0` |
| `employees` / `attendance` | `9` / `22` | `9` / `22` | `9` / `22` | `0` |
| `accounts` | `1` (`PETTY CASH`) | `1` | `1` | `0` |
| `accountTransactions` | `19` | `19` | `19` | `0` |
| `auditLogs` | `3` | `3` | `3` | `0` |
| `uploadedDocuments` | `1` (`IMOP_Nov_PO.pdf`) | `1` | `1` | `0` |
| All other 28 collections | `0` | `0` | `0` | `0` |

---

## 3. Financial Reconciliation & Critical ₹27,000 Discovery

- **Active Cash Account:** `PETTY CASH` (`ACC-26-001`, `CASH`, `openingBalance: ₹0`, `isActive: true`).
- **Expected & Restored Closing Cash Balance:** **`₹6,020`** (`calculateReconciledAccountBalance` across 19 `accountTransactions`: `0` variance).
- **CRITICAL FINDING — Owner Cash Already Present as `CUSTOMER_RECEIPT` Splits (`₹29,000`):**
  - No single `₹27,000` `OWNER_INJECTION` row exists, **HOWEVER** the real backup contains 4 `CUSTOMER_RECEIPT` (`DEBIT`) entries from the owner (`Nandha anna`):
    - `2026-11-13`: `₹10,000` — `Yard petty cash top up form nandha anna`
    - `2026-11-14`: `₹10,000` — `Yard petty cash top up form nandha anna`
    - `2026-11-14`: `₹5,000` — `Yard petty cash top up form nandha anna`
    - `2026-11-17`: `₹4,000` — `Nandha anna given`
  - **Action Required Before Production Cutover:** Do **NOT** auto-post `₹27,000`! Owner must confirm reclassifying these existing `₹29,000` `CUSTOMER_RECEIPT` rows to `OWNER_INJECTION` (`3010`) or `OWNER_LOAN_IN` (`2150`), and reclassifying `2026-11-13 | CUSTOMER_RECEIPT | CREDIT | ₹960 | Lunch 8nos` to `OPERATING_EXPENSE`.
- **Legacy `journalEntries: 0`:** Confirmed `1.0.0` Cashflow entries created `0` journals; `2.0.0` `addAccountTransaction` now generates balanced journals automatically for new entries.

---

## 4. Attachment, Rollback & Test Evidence

- **Attachment Verification:** `IMOP_Nov_PO.pdf` (`425,676` bytes, `application/pdf`) verified `1/1` via `verifyBackupAttachmentBinaries` (`0` mismatches).
- **Automated Test Execution (`pnpm typecheck && pnpm test:vitest && pnpm build`):**
  - `tsc --noEmit`: **0 errors**
  - `vitest run`: **31 / 31** test files passed, **328 / 328** tests passed (`0` failed, `0` skipped), including live-file validation of `YE_FULL_BACKUP_2026-11-20T02-14-42.json`, repeat-restore idempotency, duplicate-ID deduplication, unsupported schema rejection (`9.9.0`), tampered attachment detection, and automatic rollback on unbalanced journals.
  - `vite build`: **2171 modules** built in `18.15s`.

---

## 5. Pending Live Gates (Blocking `PRODUCTION READY`)

1. Apply migrations `012` and `013` and deploy `verify-and-commit-attachment` on a live Supabase staging project (`psql`/`supabase` CLI unavailable in this Termux environment).
2. Execute live Android APK UI acceptance tests (Phase 6) on the installed build after staging restore.
3. Obtain owner sign-off to reclassify the existing `₹29,000` `CUSTOMER_RECEIPT` top-ups into `3010` / `2150` without duplicating cash.
