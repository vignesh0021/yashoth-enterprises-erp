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
1. **Live Staging Supabase Execution (`qruqcqwgwlrroevqtnax.supabase.co`):** Blocked locally because `psql` and `supabase` CLI are not installed in Termux. Run `.github/workflows/staging-supabase-deploy.yml` (requires GitHub Secrets `STAGING_SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_REF`) or apply `012` -> `013` via Supabase SQL Editor and deploy `verify-and-commit-attachment`.
2. **Android APK Build & Device UI Acceptance:** Blocked locally because `java`, `gradle`, `adb`, and `ANDROID_HOME` are unavailable in Termux (`gh` CLI also absent). Pushing to `audit/owner-operator-complete-architecture` triggers `.github/workflows/build-android-apk.yml` to build `Yashoth-Enterprises-ERP.apk` and print its SHA-256; install on a clean test device, restore `YE_FULL_BACKUP_2026-11-20T02-14-42.json`, and attach UI screenshots.
3. **CI Real-Backup Secret:** Add `YE_REAL_BACKUP_B64` (base64 of the backup JSON) to GitHub Secrets so `.github/workflows/build-android-apk.yml` executes `pnpm test:real-backup` via `YE_BACKUP_FILE` in CI.
4. **Owner Reclassification Approval:** Obtain explicit owner sign-off to reclassify the 5 existing `CUSTOMER_RECEIPT` transactions (`₹29,000` top-ups + `₹960` lunch).

---

## FINAL ERP IMPLEMENTATION AND RELEASE ACCEPTANCE

- **Branch:** `audit/owner-operator-complete-architecture`
- **CI Run #44 (`44849500599`) Root Cause & Resolution:**
  - **Root Cause:** `.github/workflows/build-android-apk.yml` failed at YAML workflow-parse time (`jobs: []`, `check_runs: []`, `name: '.github/workflows/build-android-apk.yml'`) because `secrets.YE_REAL_BACKUP_B64` was referenced in a step-level `if:` expression (`if: ${{ secrets.YE_REAL_BACKUP_B64 != '' }}`), which GitHub Actions rejects.
  - **Resolution:** Moved the check into shell `if [ -n "$YE_REAL_BACKUP_B64" ]` inside `run:` with `env:` binding.
- **Owner Summary Reports Implemented & Verified:**
  - Engine: `backend/business-rules/ownerReportsEngine.ts` (`computeOwnerBusinessOverview`, `computeOwnerPeriodSummary`, `getPeriodDateRange`, `generateOwnerReportCsv`)
  - UI & Routing: `src/modules/reports/OwnerSummaryReportsView.tsx`, `/owner-reports` in `src/app/router.tsx` & `src/components/layout/AppLayout.tsx`
  - Covers: 9 Business Overview KPIs, Daily/Weekly/Monthly/Annual/Custom filters, Yard filter, Cash/Bank/Expense/Salary/Labour/Contractor/Purchase/Customer/Supplier/Attendance/Yard reports, Monthly P&L trend bars, Alerts, Transaction Drill-Down, Excel/CSV (UTF-8 BOM), PDF/Print (`window.print()`), and Web Share.
- **Exact Automated Verification Results (Exit Code `0`):**
  - `pnpm typecheck`: **PASS** (`0` errors)
  - `pnpm test:vitest`: **PASS** (`32 / 32` test files, `330 / 330` tests passed, `0` failed, `0` skipped)
  - `pnpm test:real-backup`: **PASS** (`1 / 1` test file, `1 / 1` test passed on `YE_FULL_BACKUP_2026-11-20T02-14-42.json`, SHA-256 `1a4b54c314781e164f8d746f47cbe9838f541fa1f43a4b667a9ec24d7df0351b`, `PETTY CASH` = `₹6,020`, `IMOP_Nov_PO.pdf` `1/1`)
  - `pnpm build`: **PASS** (`2173` modules built in `19.10s`)
- **Android APK Metadata (`android/app/build.gradle`):**
  - `applicationId`: `com.yashothenterprises.erp`, `versionCode`: `1`, `versionName`: `"1.0"`, build variant: `debug` (`Yashoth-Enterprises-ERP.apk`).
  - **Local APK Build & Artifact Status:** Pending GitHub Actions CI run on this push (`java`, `gradle`, `adb`, `psql`, `supabase` CLI unavailable in Termux).
- **Overall Release Status:** **`BLOCKED`** *(Code, unit tests, real-backup reconciliation, web build, and Owner Summary Reports are verified; final release remains blocked on: (1) CI Android APK build artifact & SHA-256 verification from the newly pushed workflow fix, (2) running `.github/workflows/staging-supabase-deploy.yml` to apply `012`/`013` & `verify-and-commit-attachment` on staging `qruqcqwgwlrroevqtnax.supabase.co`, and (3) Android device UI acceptance + owner approval for the 5 `₹29,000`/`₹960` transactions).*

---

## CI Run #45 (`44854195991`) Remediation & Owner Summary Reports Hardening

- **CI Run #45 Root Cause & Fix (`.github/workflows/build-android-apk.yml`):**
  - **Root Cause:** `.github/workflows/build-android-apk.yml` ran `cp .env.staging.example .env` BEFORE `pnpm test:vitest`. Because Vitest loads `.env` into `import.meta.env` (unlike `scripts/test-runner.mjs`), `dbRepository.isRemoteDatabaseAvailable()` returned `true` and the three offline RPC tests in `tests/finance_module.test.ts` (`fn_post_contractor_payment_atomic`, `fn_post_salary_disbursement_atomic`, `fn_post_contractor_work_atomic`) hit live staging Supabase over HTTP as `anon`, receiving `"permission denied for function ..."` instead of `"Remote Supabase database is not configured"`.
  - **Fix:** Moved `Provision Staging Environment Configuration` (`cp .env.staging.example .env`) to run AFTER `Run Typecheck & Automated Test Suite` and `Run Mandatory Real-Backup Acceptance Gate`, immediately before `Build Production Web Bundle & Sync Capacitor Android`.
- **Owner Summary Reports Hardening (`backend/business-rules/ownerReportsEngine.ts`, `src/modules/reports/OwnerSummaryReportsView.tsx`, `tests/owner_summary_reports.test.ts`):**
  - Enforced strict company isolation and ID deduplication (`scopeOwnerReportInput`) across all 18 collections when `companyId` is provided.
  - Completed `drillDownTransactions` across `ACCOUNT_TX`, `EXPENSE`, `INVOICE`, `PURCHASE`, `PAYMENT`, and `JOURNAL` with `${source}:${id}` deduplication.
  - Added `reconciliationCheck` and partial-journal-coverage warnings in `computeOwnerBusinessOverview`.
  - Added genuine OpenXML `.xlsx` export (`generateOwnerSummaryWorkbook` via `buildXlsxArchive`) alongside UTF-8 BOM CSV export and clearly labeled `Print / Save as PDF` (`window.print()`), plus clear `Period` vs `Current` labels on KPI cards.
- **Re-Verified Automated Results (Exit Code `0`):**
  - `pnpm typecheck`: **PASS** (`0` errors)
  - `pnpm test:vitest`: **PASS** (`32 / 32` test files, `335 / 335` tests passed, `0` failed, `0` skipped; `tests/owner_summary_reports.test.ts`: `8 / 8`, `tests/finance_module.test.ts`: `56 / 56`)
  - `pnpm test:real-backup`: **PASS** (`1 / 1` test passed)
  - `pnpm build`: **PASS** (`2173` modules built in `17.73s`)

