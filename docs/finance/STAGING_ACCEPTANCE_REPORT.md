# STAGING ACCEPTANCE REPORT — YASHOTH ENTERPRISES ERP

**Repository:** `https://github.com/vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Verified Base Commit:** `9414dcd30493c037733f8da70b92425028a8e113`  
**Final Status:** **`STAGING READY — SOME ACCEPTANCE GATES PENDING`**

---

## Phase A — Source Control & Artifact Review
- `git fetch origin && git rev-parse HEAD`: `9414dcd30493c037733f8da70b92425028a8e113` (clean working tree).
- Reviewed `database/migrations/012_finance_hardening_and_owner_operator.sql`, `database/migrations/013_receipt_attachments_and_storage_rls.sql`, `supabase/functions/verify-and-commit-attachment/index.ts`, and `backend/business-rules/backupEngine.ts`.
- **Deployment Dependencies:** `012` must run before `013` (`013` references `vehicle_trips` and `payment_authorizations` created in `012`). Edge Function `verify-and-commit-attachment` requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` server-side secrets.

---

## Phase B & C — Supabase Staging Endpoint & Integrity Status
- **Staging Project URL (`.env.staging`):** `https://qruqcqwgwlrroevqtnax.supabase.co` (anon/publishable keys only; no `service_role` in client).
- **Live Endpoint Probe (Read-Only):**
  - `cash_bank_accounts`: `401` (exists, RLS-protected)
  - `document_attachments`: `404` (**Migration `013` not yet applied on staging**)
  - `vehicle_trips`: `404` (**Migration `012` not yet applied on staging**)
  - `verify-and-commit-attachment`: `404` (**Edge Function not yet deployed on staging**)
- **Blocker:** `psql` and `supabase` CLI are not installed in this Termux workspace (`missing-cli-tools`), so live DDL execution (`012`, `013`), Edge Function deployment, and live staging DB integration tests remain **PENDING** on a workstation/CI with Supabase CLI or SQL Editor access.

---

## Phase D — Build, Typecheck & Test Results (Observed)

| Step | Command | Result | Observed Output |
| :--- | :--- | :---: | :--- |
| Typecheck | `pnpm typecheck` | **PASS** | `0` errors |
| Unit & Engine Suite | `pnpm test:vitest` | **PASS** | `31 / 31` test files passed, `327 / 327` tests passed (`35.76s`) |
| Strict Real-Backup Gate | `pnpm test:real-backup` | **PASS** | `1 / 1` test file passed (`53ms`) on `YE_FULL_BACKUP_2026-11-20T02-14-42.json` |
| Web Production Bundle | `pnpm build` | **PASS** | `2171` modules transformed, built in `16.68s` (`dist/assets/index-7YE3Y6UP.js`) |
| Android APK Build | `which java gradle adb; echo $ANDROID_HOME` | **PENDING** | `missing-cli-tools`, `ANDROID_HOME=unset` (CI workflow exists at `.github/workflows/build-android-apk.yml`) |

---

## Phase E — Real Backup Restore & Financial Reconciliation (`YE_FULL_BACKUP_2026-11-20T02-14-42.json`)
- Original file preserved untouched (`1,160,855` bytes, `sha256: 1a4b54c314781e164f8d746f47cbe9838f541fa1f43a4b667a9ec24d7df0351b`).
- Restored `1.0.0` -> `2.0.0` with exact 1:1 counts (`companies: 2`, `yards: 2`, `employees: 9`, `attendance: 22`, `accounts: 1`, `accountTransactions: 19`, `auditLogs: 3`, `uploadedDocuments: 1`), `PETTY CASH` balance = **`₹6,020`**, `IMOP_Nov_PO.pdf` SHA-256 verified (`1/1`), repeat restore zero duplicates, and automatic rollback verified on unsupported schema & unbalanced journal.
- **₹27,000 / ₹29,000 / ₹960 Policy:** No new `₹27,000` entry created; existing `atx-rp2l11r`, `atx-g8ktcok`, `atx-mzj3dzt`, `atx-bjtqe9h` (`₹29,000` owner top-ups) and `atx-vmewoeg` (`₹960` lunch) left untouched awaiting owner approval.

---

## Phase F — Android Application Acceptance
- **Status:** **PENDING** (Android SDK / `gradle` / `adb` unavailable in Termux; APK must be built via `.github/workflows/build-android-apk.yml` or an Android Studio workstation and tested on a separate Android test device with screenshots).

---

## Remaining Blockers Before `PRODUCTION CANDIDATE`
1. Apply `012_finance_hardening_and_owner_operator.sql` and `013_receipt_attachments_and_storage_rls.sql` + deploy `verify-and-commit-attachment` on staging `qruqcqwgwlrroevqtnax.supabase.co` and execute live RLS/RPC/Storage checks.
2. Build Android APK via `.github/workflows/build-android-apk.yml` (or Android SDK workstation), record APK version/build/SHA-256/size, install on a clean test device, restore `YE_FULL_BACKUP_2026-11-20T02-14-42.json`, and capture UI acceptance screenshots.
3. Obtain explicit owner sign-off to reclassify the 5 existing `CUSTOMER_RECEIPT` transactions (`₹29,000` + `₹960`).
