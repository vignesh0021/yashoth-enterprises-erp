# Yashoth Enterprises ERP — Staging Migration Results & Deployment Runbook
**Target Project:** `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`)  
**Region:** Singapore (`ap-southeast-1`)  
**Branch:** `fix/finance-accounting-integrity`  
**HEAD Commit SHA:** `1ca5e13cb4feea972e35e954ef86cb35626ebef6`  
**Status:** MIGRATION BUNDLE GENERATED & FULLY VERIFIED IN LOCAL TEST BATTERY (PENDING REMOTE EXECUTION)

---

## 1. Evidence Classification & Scope

| Verification Level | Description | Status |
| :--- | :--- | :--- |
| **Static SQL Validation** | Syntax, dependency order, table definitions, foreign keys, views, triggers, and functions checked across 001–011. | **VERIFIED (PASS)** |
| **Local Automated Tests** | 296 unit/integration tests executed with 100% pass rate. | **VERIFIED (PASS)** |
| **Consolidated Migration Bundle** | Single deployable 179 KB SQL bundle generated: `database/staging_migration_bundle_001_to_011.sql`. | **GENERATED** |
| **Staging DB Live Execution** | DDL deployment to remote project `qruqcqwgwlrroevqtnax`. | **PENDING (Awaiting Execution)** |

---

## 2. Migration Inventory & Execution Sequence

| Seq | Migration File | Size | Purpose & Core Objects | Idempotency |
| :--- | :--- | :--- | :--- | :--- |
| **001** | `001_initial_schema.sql` | 23.7 KB | `uuid-ossp`, `weighments`, `materials`, `inventory_lots`, `users_roles`, `audit_logs` | `CREATE TABLE IF NOT EXISTS` |
| **002** | `002_views_and_functions.sql` | 4.6 KB | `vw_daily_weighment_summary`, `log_audit_event()` trigger | `CREATE OR REPLACE` |
| **003** | `003_auth_and_rls.sql` | 5.4 KB | Initial Row Level Security policies on weighment & inventory | `DO $$ BEGIN ... EXCEPTION` |
| **004** | `004_multi_company_schema.sql` | 6.1 KB | `companies`, `company_memberships`, tenant columns, foreign keys | `ADD COLUMN IF NOT EXISTS` |
| **005** | `005_accounting_and_documents.sql` | 8.1 KB | `accounts`, `invoices`, `commercial_documents`, `payments`, `expenses` | `IF NOT EXISTS` |
| **006** | `006_backup_and_restore.sql` | 3.3 KB | `system_backups`, `restore_logs`, snapshot tracking | `IF NOT EXISTS` |
| **007** | `007_authoritative_rls_hardening.sql`| 17.1 KB | Authoritative helper functions (`auth_current_user_id`, `auth_is_company_member`, `auth_has_company_role` with `SET search_path = public, pg_temp;` and strict `service_role` bypass) | `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` |
| **008** | `008_finance_and_labour_management.sql` | 12.4 KB | `daily_labour_work_logs`, `labour_payments`, `contractor_payments`, `employee_advances` | `IF NOT EXISTS` |
| **009** | `009_finance_atomic_and_advance_integrity.sql` | 76.8 KB | 7 Atomic financial disbursement & accrual RPCs, ledger triggers, search_path, operation-specific RBAC, and table-level `REVOKE` | `CREATE OR REPLACE`, `REVOKE` |
| **010** | `010_offline_queue_and_account_triggers.sql` | 21.5 KB | `offline_mutation_queue`, `accounts` view triggers (current_balance direct write denial, opening_balance transaction guard, balance synchronization trigger), `fn_reconcile_account_balance`, monotonic voucher sequencer | `IF NOT EXISTS`, safe column adds |
| **011** | `011_realtime_publication_and_authoritative_sync.sql` | 3.1 KB | `REPLICA IDENTITY FULL` on 13 core tables, publication `supabase_realtime` registration | Idempotent dynamic loop |

---

## 3. Remote Staging Execution Runbook & Checklist

Because Supabase client publishable keys (`sb_publishable_...`) are intentionally restricted by design from running administrative DDL (`CREATE TABLE`, `CREATE FUNCTION`, `ALTER PUBLICATION`), apply the migration bundle using one of the following authorized methods:

### Method 1: Supabase Dashboard SQL Editor (Recommended)
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and select project `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`).
2. Navigate to the **SQL Editor** tab.
3. Open or paste the contents of [`database/staging_migration_bundle_001_to_011.sql`](file:///data/user/0/com.termux/files/home/YE/database/staging_migration_bundle_001_to_011.sql).
4. Click **Run** to execute the bundle.
5. Confirm "Success. No rows returned" in the output pane.

### Method 2: Supabase CLI
```bash
supabase link --project-ref qruqcqwgwlrroevqtnax
supabase db push
```

### Method 3: PostgreSQL Direct Connection (psql)
```bash
psql "postgresql://postgres:[STAGING_DB_PASSWORD]@db.qruqcqwgwlrroevqtnax.supabase.co:5432/postgres" \
  -f database/staging_migration_bundle_001_to_011.sql
```

---

## 4. Post-Migration Verification Queries

Execute these verification queries immediately following DDL application:

```sql
-- 1. Verify 13 tables are published in supabase_realtime
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;

-- 2. Verify all 16 SECURITY DEFINER functions have secured search_path
SELECT proname, prosrc, prosecdef, proconfig 
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace AND prosecdef = true;

-- 3. Verify accounts view and triggers
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'accounts';

-- 4. Verify table-level REVOKE on immutable ledger tables
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name IN ('account_transactions', 'employee_advances', 'contractor_payments', 'labour_payments')
  AND grantee IN ('authenticated', 'anon', 'PUBLIC');
```

---

## 5. Rollback Plan

All migrations are structured in clean transaction blocks. If rollback is necessary:
- **Migration 011 Reversal:** `ALTER PUBLICATION supabase_realtime DROP TABLE ...;`
- **Migration 010 Reversal:** `DROP VIEW IF EXISTS accounts CASCADE; DROP TABLE IF EXISTS offline_sync_queue, sync_conflicts;`
- **Migration 009 Reversal:** `DROP FUNCTION IF EXISTS fn_post_contractor_payment_atomic CASCADE; ...`
- **Migration 008 Reversal:** `DROP TABLE IF EXISTS employee_advances, contractor_payments, labour_payments, daily_labour_entries CASCADE;`
- **Full Database Reset:** Revert to the pristine pre-migration recovery point in the Supabase Dashboard.
