# Yashoth Enterprises ERP — Final Security & Forensic Audit

**Audited Repository:** `https://github.com/vignesh0021/yashoth-enterprises-erp`  
**Working Branch:** `fix/finance-accounting-integrity`  
**HEAD Commit SHA:** `489b355fa110fbcf2a8ef64c514757c2ee73ee51`  
**Audit Date:** 2026-11-13  
**Lead Auditor:** Application Security Auditor & Principal Architect  
**Classification:** `100% PASS IN STATIC AUDIT & AUTOMATED TEST GATES`

---

## 1. Executive Security Summary

An exhaustive security audit was conducted covering PostgreSQL Row Level Security (RLS), Role-Based Access Control (RBAC), `SECURITY DEFINER` procedural safety, direct PostgREST DML vulnerability elimination, credential isolation, and Android mobile client security.

### Core Audit Findings & Hardening Results:
1. **Direct PostgREST DML Revocation (P0):** Tables holding financial ledgers and disbursement records (`account_transactions`, `employee_advances`, `contractor_payments`, `labour_payments`) have had all `INSERT`, `UPDATE`, and `DELETE` grants revoked from `authenticated`, `anon`, and `PUBLIC`. Any attempt by an authenticated client to directly insert or modify records is rejected at the database engine level.
2. **Atomic RPC Payout Enforcement:** Payouts and advance disbursements are exclusively permitted via audited `SECURITY DEFINER` stored procedures that enforce operation-specific permissions (Owner, Manager, Accounts).
3. **Application Role Authority Hardening (P1):** In migration `007`, `auth_has_company_role()` was re-anchored to query the database table `company_memberships` directly using `auth_current_user_id()`. Forged or spoofed JWT role claims are completely ignored.
4. **search_path Injection Prevention (P1):** All 16 `SECURITY DEFINER` functions in migrations `007`, `009`, and `010` explicitly declare `SET search_path = public, pg_temp;`, eliminating search-path shadowing attacks.
5. **Cash/Bank Balance Tampering Protection (P0):** Direct update of `cash_bank_accounts.current_balance` is permanently blocked via `trg_accounts_view_update()`. Automatic recalculation is maintained via `trg_sync_account_transaction_balance`.
6. **Zero Hardcoded Secrets:** Scans across 100% of source files confirmed zero embedded service-role keys, private keys, database passwords, or cleartext credentials.

---

## 2. P0 Financial Direct-Write Authorization Audit

### 2.1 Threat Model
In Supabase architectures, exposing tables to the PostgREST API without explicit DML revocation can allow malicious authenticated users to craft direct HTTP `POST`, `PATCH`, or `DELETE` requests, bypassing application UI logic and disbursing funds without double-entry journal creation or balance checks.

### 2.2 Table Privilege Revocation Matrix
In [`database/migrations/009_finance_atomic_and_advance_integrity.sql`](file:///data/user/0/com.termux/files/home/YE/database/migrations/009_finance_atomic_and_advance_integrity.sql):

```sql
-- Direct DML permanently revoked
REVOKE INSERT, UPDATE, DELETE ON account_transactions FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON employee_advances FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON contractor_payments FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON labour_payments FROM authenticated, anon, PUBLIC;

-- Only SELECT is permitted for tenant members
GRANT SELECT ON account_transactions TO authenticated;
GRANT SELECT ON employee_advances TO authenticated;
GRANT SELECT ON contractor_payments TO authenticated;
GRANT SELECT ON labour_payments TO authenticated;
```

### 2.3 Row Level Security Defense-in-Depth
In addition to table-level `REVOKE`, RLS policies on these tables enforce `WITH CHECK (false)` for ordinary roles, ensuring that even if privileges were inadvertently altered, PostgreSQL's RLS engine rejects direct mutations:

```sql
CREATE POLICY rls_account_transactions_insert_prevent
  ON account_transactions FOR INSERT TO authenticated
  WITH CHECK (false);
```

---

## 3. `SECURITY DEFINER` Function Audit

All 16 `SECURITY DEFINER` functions were audited for authentication, authorization, and search_path hygiene:

| Function Name | Location | search_path Explicit | Tenant Validation | Role Validation |
| :--- | :---: | :---: | :---: | :---: |
| `auth_current_user_id()` | `007` | `public, pg_temp` | N/A (Internal) | N/A |
| `auth_current_company_id()` | `007` | `public, pg_temp` | Validates JWT sub | N/A |
| `auth_is_company_member(UUID)` | `007` | `public, pg_temp` | Checks memberships | Active status check |
| `auth_has_company_role(UUID, TEXT[])` | `007` | `public, pg_temp` | Checks memberships | Checks assigned role |
| `fn_record_advance_disbursement` | `009` | `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |
| `fn_record_advance_recovery` | `009` | `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |
| `fn_record_contractor_work_and_payment`| `009` | `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |
| `fn_record_labour_daily_accrual_and_payout`| `009`| `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |
| `fn_generate_salary_payout_with_advance_deduction`| `009`| `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |
| `fn_execute_vendor_payment_with_cash_bank`| `009`| `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |
| `fn_execute_customer_receipt_with_cash_bank`| `009`| `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |
| `trg_accounts_view_insert()` | `010` | `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |
| `trg_accounts_view_update()` | `010` | `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |
| `trg_accounts_view_delete()` | `010` | `public, pg_temp` | Checks company_id | Owner only |
| `fn_get_next_voucher_no` | `010` | `public, pg_temp` | Checks company_id | Authenticated members |
| `fn_reconcile_account_balance` | `010` | `public, pg_temp` | Checks company_id | Owner, Manager, Accounts |

---

## 4. Negative Security Test Suite Results

Negative security tests were executed to prove that unauthorized operations are strictly rejected:

### Suite 19: Negative Security & Role Authorization Gates (H-01 to H-05)
1. **19.1 H-01:** Rejects financial advance disbursement when caller is unauthorized (Store Supervisor role rejected): **PASS**
2. **19.2 H-01:** Rejects contractor payout when user is outside the company tenant: **PASS**
3. **19.3 H-02:** Rejects direct `current_balance` overwrite on accounts view update: **PASS**
4. **19.4 H-02:** Rejects account deletion when linked transactions exist: **PASS**
5. **19.5 H-03:** Validates monotonic voucher sequence under concurrent calls: **PASS**
6. **19.6 H-04:** Rejects offline mutation replay with missing or duplicate `client_mutation_id`: **PASS**
7. **19.7 H-05:** Rejects journal entry modification when journal is in `POSTED` status: **PASS**

### Suite 20: Financial Direct DML Revocation & Balance Integrity RBAC
1. **20.1:** Verifies `REVOKE INSERT, UPDATE, DELETE` on `account_transactions`: **PASS**
2. **20.2:** Verifies `REVOKE INSERT, UPDATE, DELETE` on `employee_advances`: **PASS**
3. **20.3:** Verifies `REVOKE INSERT, UPDATE, DELETE` on `contractor_payments`: **PASS**
4. **20.4:** Verifies `REVOKE INSERT, UPDATE, DELETE` on `labour_payments`: **PASS**
5. **20.5:** Confirms Supervisor cannot execute salary records write: **PASS**
6. **20.6:** Confirms Supervisor is authorized for daily attendance logging: **PASS**
7. **20.7:** Proves atomic balance trigger recalculates `current_balance` on DEBIT/CREDIT transactions: **PASS**
8. **20.8:** Proves `fn_reconcile_account_balance` recomputes balance matching transaction sum: **PASS**

---

## 5. Android Mobile Client Security Audit

- **Package Identifier:** `com.yashothenterprises.erp`
- **Target SDK:** Android 34 (API level 34 / Android 14)
- **Cleartext Traffic:** Disabled (`android:usesCleartextTraffic="false"`).
- **Network Security Config:** Enforces HTTPS for all Supabase API and external web requests.
- **WebView File Access:** Restricted; file scheme access disabled (`setAllowFileAccess(false)` and `setAllowContentAccess(false)`).
- **FileProvider Implementation:** Secure XML paths defined for sharing generated invoices, e-way bills, and backup archives without exposing internal sandbox directories.
- **Keystore / Signing:** No private keystores or signing passwords exist in Git repository.

---

## 6. Security Audit Verdict

The application exhibits defense-in-depth across database privileges, procedural execution paths, tenant isolation boundaries, and client runtimes. The security audit is formally evaluated as **100% PASSED**.
