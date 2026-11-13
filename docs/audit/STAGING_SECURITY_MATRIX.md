# Yashoth Enterprises ERP — Staging Security Matrix & RBAC Verification
**Target Project:** `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`)  
**Commit SHA:** `6f173b5243d38b93de2722b08ff74b55bfc6db2c`  
**Branch:** `fix/finance-accounting-integrity`  
**Audit Date:** 2026-11-13  
**Status:** ALL GATES PASSED (100% Negative RBAC Verification)

---

## 1. Executive Summary
This document provides the authoritative Role-Based Access Control (RBAC) and Row Level Security (RLS) matrix for Yashoth Enterprises Scrap Management ERP. All database objects, RPCs, views, and triggers have been hardened against unauthorized execution, cross-tenant privilege escalation, and search-path injection.

All 19 negative security tests in automated test suite `tests/negative_security_and_rbac.test.ts` pass cleanly.

---

## 2. Role-to-RPC Financial Authorization Matrix

| RPC Function | Allowed Roles | Disallowed Roles | Cross-Company Guard | search_path Hardening |
| :--- | :--- | :--- | :--- | :--- |
| `fn_post_contractor_payment_atomic` | `owner_admin`, `manager`, `accounts_operator` | `weighment_operator`, `store_operator`, non-member | `company_id` validated | `SET search_path = public, pg_temp;` |
| `fn_post_labour_payment_atomic` | `owner_admin`, `manager`, `accounts_operator` | `weighment_operator`, `store_operator`, non-member | `company_id` validated | `SET search_path = public, pg_temp;` |
| `fn_post_salary_disbursement_atomic`| `owner_admin`, `manager`, `accounts_operator` | `weighment_operator`, `store_operator`, non-member | `company_id` validated | `SET search_path = public, pg_temp;` |
| `fn_issue_employee_advance_atomic` | `owner_admin`, `manager`, `accounts_operator` | `weighment_operator`, `store_operator`, non-member | `company_id` validated | `SET search_path = public, pg_temp;` |
| `fn_post_salary_accrual_atomic` | `owner_admin`, `manager`, `accounts_operator` | `weighment_operator`, `store_operator`, non-member | `company_id` validated | `SET search_path = public, pg_temp;` |
| `fn_post_daily_labour_accrual_atomic` | `owner_admin`, `manager`, `accounts_operator`, `store_operator` (accrual only) | non-member | `company_id` validated | `SET search_path = public, pg_temp;` |
| `fn_post_contractor_work_atomic` | `owner_admin`, `manager`, `accounts_operator`, `store_operator` (accrual only) | non-member | `company_id` validated | `SET search_path = public, pg_temp;` |
| `fn_get_next_voucher_no` | Authenticated member of company (financial vouchers restricted to `owner_admin`, `manager`, `accounts_operator`) | non-member | `p_company_id` validated | `SET search_path = public, pg_temp;` |

---

## 3. Account Trigger Safeguards & Deletion Protection (Migration 010)

| Action on `accounts` View | Enforced Rules & Safeguards |
| :--- | :--- |
| **INSERT** | • Caller must be authenticated (`auth.uid() IS NOT NULL`).<br>• Caller must hold `owner_admin`, `manager`, or `accounts_operator` in target company.<br>• `SET search_path = public, pg_temp;` prevents schema hijacking. |
| **UPDATE** | • Caller must be authenticated and authorized.<br>• Cross-company tenant mutation blocked: `IF NEW.company_id <> OLD.company_id THEN RAISE EXCEPTION 'Cannot transfer account between companies'`. |
| **DELETE** | • Hard deletion permanently blocked if financial history exists:<br>&nbsp;&nbsp;1. `account_transactions` count > 0<br>&nbsp;&nbsp;2. `payments` count > 0<br>&nbsp;&nbsp;3. `expenses` count > 0<br>&nbsp;&nbsp;4. `journal_lines` count > 0<br>• Instead of hard deletion, triggers force soft-deactivation: `UPDATE cash_bank_accounts SET is_active = false`. |

---

## 4. SECURITY DEFINER Functions Audit (15 of 15 Hardened)

Every `SECURITY DEFINER` function explicitly sets `SET search_path = public, pg_temp;`, completely mitigating schema search-path hijack risks:

1. `auth_current_user_id()` — `007_authoritative_rls_hardening.sql`
2. `auth_current_role(cid)` — `007_authoritative_rls_hardening.sql`
3. `auth_is_company_member(cid)` — `007_authoritative_rls_hardening.sql`
4. `auth_has_company_role(cid, r)` — `007_authoritative_rls_hardening.sql`
5. `fn_post_contractor_payment_atomic(...)` — `009_finance_atomic_and_advance_integrity.sql`
6. `fn_post_labour_payment_atomic(...)` — `009_finance_atomic_and_advance_integrity.sql`
7. `fn_post_salary_disbursement_atomic(...)` — `009_finance_atomic_and_advance_integrity.sql`
8. `fn_issue_employee_advance_atomic(...)` — `009_finance_atomic_and_advance_integrity.sql`
9. `fn_post_salary_accrual_atomic(...)` — `009_finance_atomic_and_advance_integrity.sql`
10. `fn_post_daily_labour_accrual_atomic(...)` — `009_finance_atomic_and_advance_integrity.sql`
11. `fn_post_contractor_work_atomic(...)` — `009_finance_atomic_and_advance_integrity.sql`
12. `fn_get_next_voucher_no(...)` — `010_offline_queue_and_account_triggers.sql`
13. `fn_account_view_insert()` — `010_offline_queue_and_account_triggers.sql`
14. `fn_account_view_update()` — `010_offline_queue_and_account_triggers.sql`
15. `fn_account_view_delete()` — `010_offline_queue_and_account_triggers.sql`

---

## 5. Automated Negative Security Test Results (Suite 19)

All 19 automated negative security tests executed and passed:

1. `19.1.1` — Rejects `fn_post_contractor_payment_atomic` invocation without authentication (`PASS`)
2. `19.1.2` — Rejects `fn_post_contractor_payment_atomic` invocation for non-company member (`PASS`)
3. `19.1.3` — Rejects `fn_post_contractor_payment_atomic` invocation for Supervisor (`weighment_operator`) (`PASS`)
4. `19.1.4` — Rejects `fn_post_labour_payment_atomic` invocation for Supervisor (`store_operator`) (`PASS`)
5. `19.1.5` — Rejects `fn_post_salary_disbursement_atomic` invocation for Supervisor (`PASS`)
6. `19.1.6` — Rejects `fn_issue_employee_advance_atomic` invocation for Supervisor (`PASS`)
7. `19.1.7` — Rejects `fn_post_salary_accrual_atomic` invocation for Supervisor (`PASS`)
8. `19.2.1` — Allows `fn_post_contractor_payment_atomic` for Owner (`owner_admin`) (`PASS`)
9. `19.2.2` — Allows `fn_post_contractor_payment_atomic` for Accounts (`accounts_operator`) (`PASS`)
10. `19.2.3` — Allows `fn_post_daily_labour_accrual_atomic` for Supervisor (`store_operator`) (`PASS`)
11. `19.2.4` — Allows `fn_post_contractor_work_atomic` for Supervisor (`store_operator`) (`PASS`)
12. `19.3.1` — Rejects account creation on `accounts` view when unauthenticated (`PASS`)
13. `19.3.2` — Rejects account creation on `accounts` view for unauthorized role (`PASS`)
14. `19.3.3` — Rejects cross-company account transfer in update trigger (`PASS`)
15. `19.3.4` — Blocks hard deletion of account with linked financial transactions (`PASS`)
16. `19.3.5` — Permits account creation for Accounts operator (`PASS`)
17. `19.4.1` — Rejects voucher generation without authentication (`PASS`)
18. `19.4.2` — Rejects voucher generation for non-member company ID (`PASS`)
19. `19.4.3` — Rejects financial voucher generation for Supervisor (`PASS`)

**Verdict:** 100% OF SECURITY CRITERIA SATISFIED.
