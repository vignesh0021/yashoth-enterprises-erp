# Yashoth Enterprises ERP — Staging Multi-User Test Results
**Target Project:** `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`)  
**Commit SHA:** `1ca5e13cb4feea972e35e954ef86cb35626ebef6`  
**Date:** 2026-11-13  
**Status:** LOCAL AUTOMATED SESSIONS VERIFIED (SUITES 19 & 20 PASS); LIVE MULTI-DEVICE STAGING DRILL PENDING

---

## 1. Evidence Classification & Scope

| Verification Category | Environment | Execution Details | Status |
| :--- | :--- | :--- | :--- |
| **Local Automated Session RBAC** | Local Node Test Engine (v26.4.0) | Suite 19 & Suite 20 (18 negative security tests modeling JWT claims and PostgreSQL session contexts) | **PASS (100%)** |
| **Live 3-Device Staging Session** | 3 Physical/Virtual Android/Web Devices | Realtime WebSocket sync across Owner, Supervisor, and Accounts devices on staging project | **PENDING STAGING DEPLOY** |

---

## 2. Multi-Session Test Matrix & Direct DML Verification

### Session 1: Owner (`owner_admin` — `owner@yashoth.test`)
- **Authentication:** `request.jwt.claim.sub` = Owner UUID, `role` = `authenticated`.
- **Financial Disbursement RPC:** Invokes `fn_post_contractor_payment_atomic` → **SUCCESS** (`tx_id` generated, ledger lines posted, balance adjusted).
- **Voucher Generation:** Invokes `fn_get_next_voucher_no` with `PAYMENT` → **SUCCESS** (monotonic sequence incremented).
- **Direct DML on `account_transactions`:** Attempts direct `INSERT INTO account_transactions` → **REJECTED** (Permission denied / RLS `WITH CHECK (false)`). Must use atomic RPC.
- **Account Metadata Edit:** Modifies bank name and branch → **SUCCESS**.
- **Opening Balance Correction (Virgin Account):** Corrects opening balance on an account with 0 transactions → **SUCCESS** (opening and current balance updated).
- **Opening Balance Correction (Active Account):** Attempts to modify opening balance on account with historical transactions → **REJECTED** (`Cannot modify opening_balance directly with existing transactions. Use adjusting journal entry instead`).
- **Direct `current_balance` Overwrite:** Attempts direct update of `current_balance` → **REJECTED** (`Forbidden: Direct modification of current_balance is prohibited`).

### Session 2: Supervisor (`store_operator` / `weighment_operator` — `supervisor@yashoth.test`)
- **Authentication:** `request.jwt.claim.sub` = Supervisor UUID, `role` = `authenticated`.
- **Operational Daily Labour Logging:** Inserts record into `daily_labour_entries` (shift attendance) → **SUCCESS** (authorized for `store_operator`).
- **Operational Contractor Work Logging:** Inserts record into `contractor_work_entries` → **SUCCESS**.
- **Disbursement RPC Attempt (Negative):** Invokes `fn_post_contractor_payment_atomic` → **REJECTED** (`Forbidden: User does not have financial disbursement authorization`).
- **Financial Voucher Attempt (Negative):** Invokes `fn_get_next_voucher_no` for `PAYMENT` → **REJECTED** (`Forbidden: User not authorized to generate financial vouchers`).
- **Direct DML on `payments` (Negative):** Attempts direct `INSERT INTO payments` → **REJECTED** (RLS `WITH CHECK` failed).
- **Account Deletion/Modification (Negative):** Attempts to modify or delete an account → **REJECTED** (`Forbidden: User is not authorized to update financial accounts`).

### Session 3: Accounts (`accounts_operator` — `accounts@yashoth.test`)
- **Authentication:** `request.jwt.claim.sub` = Accounts UUID, `role` = `authenticated`.
- **Salary Disbursement RPC:** Invokes `fn_post_salary_disbursement_atomic` → **SUCCESS**.
- **Account Creation:** Inserts new cash/bank account via `accounts` view → **SUCCESS**.
- **Account Deactivation:** Updates account `is_active = false` → **SUCCESS** (safe soft-deactivation).
- **Hard Deletion Protection:** Attempts hard deletion of account with transaction history → **PREVENTED** (Trigger intercepts and forces deactivation).
- **Company Deletion Attempt (Negative):** Attempts deleting company → **REJECTED** (`Forbidden: Only owner_admin may delete company`).

### Session 4: Foreign Tenant Intruder (`company_id` Mismatch — `intruder@other.test`)
- **Tenant A Data Query:** Executes `SELECT * FROM account_transactions WHERE company_id = 'tenant-a-uuid'` → **0 ROWS RETURNED** (RLS isolation enforced).
- **Tenant A RPC Execution:** Invokes `fn_post_contractor_payment_atomic` with Tenant A's `company_id` → **REJECTED** (`Caller is not an authorized member of company`).
- **Cross-Company Account Transfer:** Attempts setting `company_id` of Company A account to Company B → **REJECTED** (`Forbidden: Cannot change account company_id (cross-company transfer prohibited)`).

---

## 3. Realtime Multi-Device Sync Protocol
- Subscriptions on `weighments`, `materials`, `invoices`, and `accounts` are managed by `realtimeSyncService.ts`.
- Broadcast payloads are scoped by `company_id` and verified against active session JWT.
- Offline mutations are persisted in IndexedDB and replayed through the authoritative queue upon reconnection.
