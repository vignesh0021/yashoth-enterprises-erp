# Yashoth Enterprises ERP — Staging Known Issues & Risk Register
**Target Project:** `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`)  
**Commit SHA:** `6f173b5243d38b93de2722b08ff74b55bfc6db2c`  
**Date:** 2026-11-13  
**Status:** ZERO CRITICAL / ZERO HIGH DEFECTS

---

## 1. Risk Register & Severity Classification

| Issue ID | Category | Severity | Description | Status & Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Security / RBAC | **CLOSED (High)** | RPC authorization previously only checked company membership, allowing Supervisors to disburse funds. | **Remediated** in `009`: `auth_has_company_role` enforced for `owner_admin`, `manager`, `accounts_operator`. |
| **SEC-02** | Security / Injection | **CLOSED (High)** | `SECURITY DEFINER` functions in `007`, `009`, and `010` lacked explicit `search_path`. | **Remediated**: All 15 `SECURITY DEFINER` functions now explicitly include `SET search_path = public, pg_temp;`. |
| **SEC-03** | Data Integrity | **CLOSED (Medium)** | Hard deletion of cash/bank accounts could orphan historical transactions or journal lines. | **Remediated** in `010`: Trigger prevents deletion if linked to transactions, payments, expenses, or journals; forces `is_active = false`. |
| **OPS-01** | Operations / Deploy | **Low / Operational** | Supabase client publishable key cannot run raw DDL (`CREATE TABLE`). | **Operational Requirement**: Apply migrations 001–011 via Supabase Dashboard SQL Editor or Supabase CLI with personal access token. |
| **PERF-01** | Frontend / Bundle | **Informational** | Vite build outputs a 2.37MB single JS bundle triggering bundle size warning. | **Recommendation**: Implement React `lazy()` dynamic imports for heavy secondary views (`QuotationRenderer`, `EwayBillRenderer`). Does not impact functionality or security. |

---

## 2. Operational Recommendations for Release
1. Apply migrations 001–011 to `qruqcqwgwlrroevqtnax` via Supabase Dashboard SQL Editor.
2. Seed initial company and Owner user in `auth.users` + `company_memberships`.
3. Conduct multi-user smoke test on staging mobile devices.
4. Schedule final release tagged commit once staging smoke testing is complete.
