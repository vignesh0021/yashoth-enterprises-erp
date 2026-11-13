# Yashoth Enterprises ERP — Final RLS & RBAC Permission Matrix

**Database:** `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`)  
**Repository:** `https://github.com/vignesh0021/yashoth-enterprises-erp`  
**Branch:** `fix/finance-accounting-integrity`  
**HEAD Commit SHA:** `489b355fa110fbcf2a8ef64c514757c2ee73ee51`  
**Audit Date:** 2026-11-13  
**Status:** 100% VALIDATED IN SECURITY DEFENSE SPECIFICATIONS

---

## 1. Role Definitions & Hierarchy

Yashoth Enterprises ERP defines three authoritative operational roles within each company tenant:

1. **Owner (`OWNER` / `SUPER_ADMIN`):**
   - Full read/write access to all operational, financial, and administrative records.
   - Exclusive authority for company configuration, bank account deletion, and year-end reconciliation.
2. **Accounts (`ACCOUNTS` / `ACCOUNTANT` / `MANAGER`):**
   - Full read/write access to financial ledgers, commercial documents, journal entries, payments, and payroll.
   - Authority to disburse advances and execute atomic financial RPCs.
   - Denied administrative company settings changes and account deletions.
3. **Supervisor (`SUPERVISOR` / `STORE_SUPERVISOR`):**
   - Read/write access to yard operations: weighment tickets, inward/outward scrap lots, daily labour attendance, contractor work records, daily work notes.
   - Strictly **denied** direct financial writes, salary records modification, advance disbursement, and bank transactions.

---

## 2. Table-by-Table RLS & RBAC Matrix

| Table Name | Owner (SELECT/INS/UPD/DEL) | Accounts (SELECT/INS/UPD/DEL) | Supervisor (SELECT/INS/UPD/DEL) | Direct DML Status |
| :--- | :---: | :---: | :---: | :--- |
| `companies` | `ALL / ALL / ALL / NONE` | `SEL / NONE / NONE / NONE` | `SEL / NONE / NONE / NONE` | Standard RLS |
| `company_memberships` | `ALL / ALL / ALL / ALL` | `SEL / NONE / NONE / NONE` | `SEL / NONE / NONE / NONE` | Hardened RLS |
| `materials` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / NONE / NONE / NONE` | Standard RLS |
| `material_grades` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / NONE / NONE / NONE` | Standard RLS |
| `yards` | `ALL / ALL / ALL / ALL` | `SEL / NONE / NONE / NONE` | `SEL / NONE / NONE / NONE` | Standard RLS |
| `parties` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / ALL / ALL / NONE` | Operational RLS |
| `weighment_tickets` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / ALL / ALL / NONE` | Operational RLS |
| `inventory_lots` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / ALL / ALL / NONE` | Operational RLS |
| `stock_movements` | `ALL / ALL / NONE / NONE` | `SEL / ALL / NONE / NONE` | `SEL / ALL / NONE / NONE` | Immutable log |
| `chart_of_accounts` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / NONE / NONE / NONE` | Accounting RLS |
| `cash_bank_accounts` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / NONE / NONE / NONE` | View triggers |
| `account_transactions`| `SEL / NONE / NONE / NONE`| `SEL / NONE / NONE / NONE` | `NONE / NONE / NONE / NONE`| **REVOKED (RPC ONLY)** |
| `journal_entries` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `NONE / NONE / NONE / NONE`| Immutable when posted |
| `journal_lines` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `NONE / NONE / NONE / NONE`| Balanced constraint |
| `commercial_documents`| `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / ALL / NONE / NONE` | Documents RLS |
| `commercial_doc_lines`| `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / ALL / NONE / NONE` | Documents RLS |
| `payments` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `NONE / NONE / NONE / NONE`| Financial RLS |
| `payment_allocations` | `ALL / ALL / NONE / NONE` | `SEL / ALL / NONE / NONE` | `NONE / NONE / NONE / NONE`| Immutable allocations|
| `employee_advances` | `SEL / NONE / NONE / NONE`| `SEL / NONE / NONE / NONE` | `NONE / NONE / NONE / NONE`| **REVOKED (RPC ONLY)** |
| `contractor_payments` | `SEL / NONE / NONE / NONE`| `SEL / NONE / NONE / NONE` | `NONE / NONE / NONE / NONE`| **REVOKED (RPC ONLY)** |
| `labour_payments` | `SEL / NONE / NONE / NONE`| `SEL / NONE / NONE / NONE` | `NONE / NONE / NONE / NONE`| **REVOKED (RPC ONLY)** |
| `salary_records` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `NONE / NONE / NONE / NONE`| Financial RLS |
| `daily_labour_entries`| `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / ALL / ALL / NONE` | Supervisor allowed |
| `contractor_work_entries`|`ALL / ALL / ALL / ALL`| `SEL / ALL / ALL / NONE` | `SEL / ALL / ALL / NONE` | Supervisor allowed |
| `offline_queue` | `ALL / ALL / ALL / ALL` | `SEL / ALL / ALL / NONE` | `SEL / ALL / ALL / NONE` | Tenant-scoped RLS |
| `voucher_sequences` | `SEL / ALL / ALL / NONE` | `SEL / ALL / ALL / NONE` | `SEL / ALL / ALL / NONE` | Monotonic RPC |
| `audit_logs` | `SEL / NONE / NONE / NONE`| `SEL / NONE / NONE / NONE` | `NONE / NONE / NONE / NONE`| System append-only |

---

## 3. Financial RPC Authorization Matrix

| Stored Procedure (RPC) | Purpose | Allowed Roles | Prohibited Roles |
| :--- | :--- | :--- | :--- |
| `fn_record_advance_disbursement` | Disburses employee advance | Owner, Accounts | Supervisor, Anon |
| `fn_record_advance_recovery` | Recovers advance via salary/cash | Owner, Accounts | Supervisor, Anon |
| `fn_record_contractor_work_and_payment`| Logs work & disburses payout | Owner, Accounts | Supervisor, Anon |
| `fn_record_labour_daily_accrual_and_payout`| Logs labour & pays daily wages | Owner, Accounts | Supervisor, Anon |
| `fn_generate_salary_payout_with_advance_deduction`| Processes monthly salary | Owner, Accounts | Supervisor, Anon |
| `fn_execute_vendor_payment_with_cash_bank`| Disburses vendor payment | Owner, Accounts | Supervisor, Anon |
| `fn_execute_customer_receipt_with_cash_bank`| Records customer cash receipt | Owner, Accounts | Supervisor, Anon |
| `fn_get_next_voucher_no` | Generates monotonic voucher no | All company members | Public / Anon |
| `fn_reconcile_account_balance` | Recomputes cash/bank balance | Owner, Accounts | Supervisor, Anon |

---

## 4. Multi-Tenant Cross-Access Prevention Test

PostgreSQL RLS policies enforce `company_id = auth_current_company_id()`. 
Any attempt by a user belonging to Company A to query or mutate Company B's data fails unconditionally:
- For `SELECT`: returns 0 rows (invisible data).
- For `INSERT`: violates `WITH CHECK (company_id = auth_current_company_id())`.
- For `UPDATE` / `DELETE`: affects 0 rows.
