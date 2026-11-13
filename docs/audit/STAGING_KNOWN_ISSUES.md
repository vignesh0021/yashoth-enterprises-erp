# Yashoth Enterprises ERP — Staging Known Issues & Risk Register
**Target Project:** `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`)  
**Commit SHA:** `1ca5e13cb4feea972e35e954ef86cb35626ebef6`  
**Date:** 2026-11-13  
**Status:** ZERO OPEN CRITICAL / ZERO OPEN HIGH DEFECTS IN SOURCE; LIVE TESTING PENDING REMOTE DEPLOYMENT

---

## 1. Risk Register & Defect Remediation Status

| Issue ID | Category | Severity | Description | Status & Remediating Commit |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Security / RBAC | **CLOSED (Critical / P0)** | Ordinary users could bypass atomic financial RPCs via direct PostgREST DML on financial tables (`account_transactions`, `employee_advances`, `contractor_payments`, `labour_payments`). | **Remediated** in `009`: Revoked direct DML from `authenticated`, enforced `WITH CHECK (false)` on immutable tables, and restricted `payments`/`journal_entries` to authorized roles. |
| **SEC-02** | Data Integrity | **CLOSED (Critical / P0)** | Direct modification of `current_balance` and `opening_balance` on `accounts` view could overwrite authoritative ledger balances. | **Remediated** in `010`: Blocked direct write to `current_balance`, blocked `opening_balance` changes when transactions exist, and added automatic balance sync trigger on `account_transactions`. |
| **SEC-03** | Security / Injection | **CLOSED (High / P1)** | `SECURITY DEFINER` functions lacked explicit `search_path`. | **Remediated**: All 16 `SECURITY DEFINER` functions in `007`, `009`, and `010` explicitly define `SET search_path = public, pg_temp;`. |
| **SEC-04** | Auth / RBAC | **CLOSED (High / P1)** | Auth helper functions previously trusted `auth_current_role() = 'owner_admin'` from JWT claims. | **Remediated** in `007`: Strict bypass restricted to `service_role` only. All application roles must come from authoritative `company_memberships` table. |
| **OPS-01** | Operations / Deploy | **Low / Operational** | Supabase client publishable key cannot execute administrative DDL (`CREATE TABLE`). | **Operational Requirement**: Deploy `database/staging_migration_bundle_001_to_011.sql` via Supabase Dashboard SQL Editor or Supabase CLI. |
| **PERF-01** | Frontend / Bundle | **Informational** | Vite build outputs a 2.38MB bundle triggering rollup chunk size warning. | **Recommendation**: Implement React dynamic imports (`React.lazy`) for heavy secondary modules (`QuotationRenderer`, `EwayBillRenderer`). Functionality is unaffected. |

---

## 2. Evidence Separation & Operational Next Steps
1. **Apply Migrations to Staging:** Apply `database/staging_migration_bundle_001_to_011.sql` to `yashoth-erp-staging` via the Supabase Dashboard SQL Editor.
2. **Execute Live Integration Tests:** Run real queries against staging PostgreSQL tables using Owner, Supervisor, and Accounts JWTs.
3. **Execute Live 3-Device Sync Session:** Verify Realtime event propagation and offline queue recovery across 3 devices.
4. **Conduct Live Google Drive Backup Drill:** Test genuine OAuth upload and restoration on staging.
