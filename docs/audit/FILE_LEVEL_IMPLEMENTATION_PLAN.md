# CONSOLIDATED 5-PHASE IMPLEMENTATION PLAN

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Base Commit:** `0148b7a4a6a1e4a2d2c8272f9c3d3636e8d6f6d9`  
**Status:** Proposed Roadmap — **Awaiting Explicit Approval (No Code or Migrations Modified)**

---

## Phase 1 — Database & Identity Foundation
- **Scope:** Canonical `persons` multi-role model, company roles, vehicle ownership/driver separation (`owner_party_id`, `default_driver_person_id`, `is_owner_driven`), `vehicle_trips` + multi-load `trip_id` links, `payment_authorizations`, `payments` recipient/beneficiary/status columns, and `ACCOUNT_ADJUSTMENT` / `DOUBLE_SHIFT` CHECK constraint alignment.
- **Database Changes:** `database/migrations/012_owner_operator_and_trips.sql` (new additive migration with `company_id` RLS using `auth_is_company_member` / `auth_has_company_role`).
- **Files Affected:** `src/types/index.ts`, `database/migrations/012_owner_operator_and_trips.sql`.
- **Dependencies:** Existing migrations `001`–`011`.
- **Risks:** Legacy `Payment` records without `status` must default to `'COMPLETED'`; existing `Vehicle.driverName` free-text must remain readable.
- **Tests:** Multi-role person resolution, vehicle ownership/driver independence, multi-load trip linkage.
- **Completion Criteria:** Migration `012` validates cleanly on staging PostgreSQL; TypeScript compiles with 0 errors; existing 312 tests remain green.

## Phase 2 — Accounting Integrity
- **Scope:** COA `2015` (Transporter Payable), `2150` (Due to Owner), `3030` (Owner Drawings); wire `OWNER_INJECTION`/`OWNER_DRAWING` journals in `addAccountTransaction`; owner reimbursement journals; freight duplication guard (`5030`); `FAILED`/`PENDING` UPI payment settlement guard; active `(company_id, source_type, source_id)` unique journal index + `appendJournalIfAbsent`.
- **Database Changes:** COA seeds + partial unique index `uq_journal_active_source` in `012`.
- **Files Affected:** `backend/business-rules/accountingEngine.ts`, `backend/business-rules/financeEngine.ts`, `src/context/ERPContext.tsx`.
- **Dependencies:** Phase 1 types & schema.
- **Risks:** Existing `mockData.ts` or legacy local storage journals with duplicate `sourceId` must not break on upgrade.
- **Tests:** `tests/owner_operator_and_trips.test.ts` (journal invariants, owner drawings vs P&L, failed UPI guard, freight deduplication, duplicate journal prevention).
- **Completion Criteria:** All accounting invariants pass 100%; `SUM(debit) === SUM(credit)` across every new journal type.

## Phase 3 — Receipt & Attachment Infrastructure
- **Scope:** `document_attachments` PostgreSQL table, private Supabase Storage bucket `erp-receipts`, `storage.objects` company-scoped RLS, client-side WebP/JPEG compression + thumbnail generator + SHA-256 checksums, Android/web camera capture (`preview -> retake -> confirm`), multi-photo + PDF upload, 2-phase retry/recovery, and posted-record deletion lock.
- **Database Changes:** `database/migrations/013_document_attachments_and_storage_rls.sql` (new).
- **Files Affected:** `src/services/attachmentService.ts` (new), `src/components/common/ReceiptCaptureModal.tsx` (new), `src/services/databaseRepository.ts`, `backend/business-rules/backupEngine.ts`.
- **Dependencies:** Phase 1 `company_id` RLS helpers.
- **Risks:** Client compression must preserve readable GSTIN/amounts; interrupted uploads between Storage and PostgreSQL require idempotent retry & orphan cleanup.
- **Tests:** `tests/receipt_attachments.test.ts` + cross-company Storage RLS test.
- **Completion Criteria:** Receipts compress to `100–300 KB` (WebP) with readable text; cross-company signed URLs are denied; uploading/deleting attachments never alters financial balances.

## Phase 4 — ERP Integration (UI Workflows)
- **Scope:** Wire multi-role Person/Transporter into `PartiesView`, `VehiclesView`, `EmployeesView` (`isOwner` payroll exclusion), `CollectionsView` (Trip + multi-load), `WeighmentView` & `PurchasesView` (`tripId` + freight warning), `PaymentsView` (status + beneficiary vs recipient + authorization), and `FinanceView` (Expense Manager camera/gallery attachments + Owner Reimbursements/Drawings).
- **Database Changes:** None (uses Phase 1–3 schema).
- **Files Affected:** `src/modules/vehicles/VehiclesView.tsx`, `src/modules/collections/CollectionsView.tsx`, `src/modules/weighment/WeighmentView.tsx`, `src/modules/purchases/PurchasesView.tsx`, `src/modules/parties/PartiesView.tsx`, `src/modules/employees/EmployeesView.tsx`, `src/modules/payments/PaymentsView.tsx`, `src/modules/finance/FinanceView.tsx`.
- **Dependencies:** Phases 1–3.
- **Risks:** Mobile viewport overflow or camera permission denials on Android WebView.
- **Tests:** Live mobile-viewport browser E2E drills across all updated modules.
- **Completion Criteria:** All 8 Owner-Operator workflows and Expense Manager receipt capture work end-to-end on mobile viewport with 0 console errors.

## Phase 5 — Testing & Production Hardening
- **Scope:** Full regression suite (`node scripts/test-runner.mjs`), staging PostgreSQL RLS + Storage RLS verification, backup/restore backward-compatibility verification, egress/storage consumption validation, and Android APK build verification.
- **Files Affected:** `tests/owner_operator_and_trips.test.ts`, `tests/receipt_attachments.test.ts`, `tests/backup_and_restore.test.ts`, `tests/staging_pg_integration.test.ts`.
- **Dependencies:** Phases 1–4.
- **Completion Criteria:** 0 TypeScript errors, 100% passing unit & staging integration tests, verified cross-tenant isolation, and clean APK build.
