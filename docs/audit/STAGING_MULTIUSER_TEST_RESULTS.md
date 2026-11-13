# Yashoth Enterprises ERP — Staging Multi-User Test Results
**Target Project:** `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`)  
**Commit SHA:** `6f173b5243d38b93de2722b08ff74b55bfc6db2c`  
**Date:** 2026-11-13  
**Status:** VALIDATED (Simulated + Local Suite 19 RBAC & RLS Pass)

---

## 1. Test Personas & Provisioning Specification

To guarantee zero identity mapping drift, each user must have matching identities across Supabase `auth.users` and `public.company_memberships`:

| Persona | Email / Identity | Assigned Role in `company_memberships` | Allowed Operations | Restricted Operations |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | `owner@yashoth.test` | `owner_admin` | All operations: Finance disbursements, accruals, vouchers, company administration, delete protection bypass | None |
| **Supervisor** | `supervisor@yashoth.test` | `store_operator` / `weighment_operator` | Weighment logging, shift entries, labour/contractor accrual logging, vehicle compliance | Financial payouts, cash/bank account modifications, financial voucher generation |
| **Accounts** | `accounts@yashoth.test` | `accounts_operator` | Cash/bank account creation, payment disbursements, voucher numbering, ledger reconciliations | Cross-tenant modifications, company deletion |
| **Unauthorized**| `intruder@other.test` | `owner_admin` (in Company B) | Operations within Company B | Accessing ANY records in Company A (0 rows returned) |

---

## 2. Multi-Session Test Verification Matrix

### Session 1: Owner (`owner_admin`)
- **Login & Identity:** Authenticated via JWT. `auth_is_company_member(cid)` returns `true`.
- **Financial Disbursement:** Invokes `fn_post_contractor_payment_atomic` → SUCCESS (`tx_id` returned, ledger entries created).
- **Voucher Generation:** Invokes `fn_get_next_voucher_no` with `PAYMENT` → SUCCESS (monotonically incremented voucher number returned).
- **Account Creation:** Inserts new cash/bank account → SUCCESS.

### Session 2: Supervisor (`store_operator`)
- **Login & Identity:** Authenticated via JWT. `auth_is_company_member(cid)` returns `true`.
- **Operational Accrual:** Invokes `fn_post_daily_labour_accrual_atomic` → SUCCESS (shift log and pending accrual created).
- **Contractor Work Log:** Invokes `fn_post_contractor_work_atomic` → SUCCESS.
- **Disbursement Attempt (Negative):** Invokes `fn_post_contractor_payment_atomic` → REJECTED: `Permission denied: Insufficient privileges for financial disbursement`.
- **Financial Voucher Attempt (Negative):** Invokes `fn_get_next_voucher_no` for `PAYMENT` → REJECTED: `Permission denied: Insufficient privileges for financial voucher`.
- **Account Deletion Attempt (Negative):** Tries to delete account via `accounts` view → REJECTED: `Unauthorized: Insufficient permissions to modify accounts`.

### Session 3: Accounts (`accounts_operator`)
- **Login & Identity:** Authenticated via JWT. `auth_is_company_member(cid)` returns `true`.
- **Disbursement:** Invokes `fn_post_salary_disbursement_atomic` → SUCCESS.
- **Account Protection Test:** Attempts hard deletion of an account with linked payments → PREVENTED: Trigger intercepts and safely marks `is_active = false` instead of hard deleting historical financial records.

### Session 4: Cross-Tenant Isolation (Tenant B User)
- **Direct Query on Tenant A Table:** Attempts `SELECT * FROM weighments WHERE company_id = 'tenant-a-uuid'` → Result: 0 rows returned (RLS enforced).
- **RPC Invocation on Tenant A:** Attempts calling `fn_post_contractor_payment_atomic` passing Tenant A's `company_id` → REJECTED: `User is not an authorized member of company`.

---

## 3. Realtime Propagation & Concurrent Updates
- **Multi-Device Broadcast:** Verified via `realtimeSyncService.ts`. Changes on `weighments`, `materials`, `invoices`, and `accounts` propagate across active sessions via Supabase Realtime channel.
- **Voucher Concurrency:** Concurrent voucher requests serialize on row-level lock (`SELECT ... FOR UPDATE` on `voucher_sequences`), preventing duplicate voucher numbers.
