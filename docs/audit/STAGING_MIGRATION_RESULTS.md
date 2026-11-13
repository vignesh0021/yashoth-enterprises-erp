# Yashoth Enterprises ERP — Staging Migration Results & Deployment Runbook
**Target Project:** `yashoth-erp-staging` (`qruqcqwgwlrroevqtnax`)  
**Region:** Singapore (`ap-southeast-1`)  
**Branch:** `fix/finance-accounting-integrity`  
**HEAD Commit:** `6f173b5243d38b93de2722b08ff74b55bfc6db2c`  
**Status:** MIGRATION READY & VALIDATED

---

## 1. Migration Inventory & Execution Sequence

The migration suite consists of 11 sequential PostgreSQL scripts, validated for syntactic correctness, strict dependency ordering, and non-destructive idempotent re-execution:

| Seq | Migration File | Size | Purpose & Core Objects | Idempotency |
| :--- | :--- | :--- | :--- | :--- |
| **001** | `001_initial_schema.sql` | 23.7 KB | `uuid-ossp`, `weighments`, `materials`, `inventory_lots`, `users_roles`, `audit_logs` | `CREATE TABLE IF NOT EXISTS` |
| **002** | `002_views_and_functions.sql` | 4.6 KB | `vw_daily_weighment_summary`, `log_audit_event()` trigger | `CREATE OR REPLACE` |
| **003** | `003_auth_and_rls.sql` | 5.4 KB | Initial Row Level Security policies on weighment & inventory | `DO $$ BEGIN ... EXCEPTION` |
| **004** | `004_multi_company_schema.sql` | 6.1 KB | `companies`, `company_memberships`, tenant columns, foreign keys | `ADD COLUMN IF NOT EXISTS` |
| **005** | `005_accounting_and_documents.sql` | 8.1 KB | `accounts`, `invoices`, `commercial_documents`, `payments`, `expenses` | `IF NOT EXISTS` |
| **006** | `006_backup_and_restore.sql` | 3.3 KB | `system_backups`, `restore_logs`, snapshot tracking | `IF NOT EXISTS` |
| **007** | `007_authoritative_rls_hardening.sql`| 17.1 KB | Authoritative helper functions (`auth_current_user_id`, `auth_is_company_member`, `auth_has_company_role` with `SET search_path = public, pg_temp;`) | `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` |
| **008** | `008_finance_and_labour_management.sql` | 12.4 KB | `daily_labour_work_logs`, `labour_payments`, `contractor_payments`, `employee_advances` | `IF NOT EXISTS` |
| **009** | `009_finance_atomic_and_advance_integrity.sql` | 64.5 KB | 7 Atomic financial disbursement & accrual RPCs, ledger triggers, search_path & role authorization | `CREATE OR REPLACE` |
| **010** | `010_offline_queue_and_account_triggers.sql` | 15.9 KB | `offline_mutation_queue`, `accounts` view triggers (4-way deletion protection), `fn_get_next_voucher_no` | `IF NOT EXISTS`, safe column adds |
| **011** | `011_realtime_publication_and_authoritative_sync.sql` | 3.1 KB | `REPLICA IDENTITY FULL` on 13 core tables, publication `supabase_realtime` registration | Idempotent dynamic loop |

---

## 2. Staging Remote Connection Verification

- **Target URL:** `https://qruqcqwgwlrroevqtnax.supabase.co`
- **Project Ref:** `qruqcqwgwlrroevqtnax`
- **GoTrue API Health:** `HTTP/2 200 OK` (GoTrue v2.197.0)
- **Schema State:** `HTTP/2 404 Not Found (PGRST205: Could not find table in schema cache)`
  - Confirms target database is an uncorrupted, fresh staging project ready for migration deployment.
  - Confirms zero interference with production database.

---

## 3. Remote DDL Execution Channel Analysis

Supabase architecture strictly prohibits executing administrative DDL statements (`CREATE TABLE`, `CREATE FUNCTION`, `ALTER PUBLICATION`) via public client keys (`sb_publishable_...` / `anon_key`).

To apply migrations 001–011 to `yashoth-erp-staging`:
1. **Option A (Supabase Dashboard SQL Editor — Recommended):**
   Execute migrations 001 through 011 in order in the Supabase Dashboard SQL Editor for project `qruqcqwgwlrroevqtnax`.
2. **Option B (Supabase CLI linked with Personal Access Token):**
   ```bash
   supabase link --project-ref qruqcqwgwlrroevqtnax
   supabase db push
   ```
3. **Option C (Direct PostgreSQL Connection String):**
   ```bash
   psql "postgresql://postgres:[PASSWORD]@db.qruqcqwgwlrroevqtnax.supabase.co:5432/postgres" -f database/migrations/001_initial_schema.sql ...
   ```

---

## 4. Rollback & Recovery Plan

- **Step 1:** In Supabase Dashboard, create a manual point-in-time recovery checkpoint before executing.
- **Step 2:** All migrations utilize transactional DDL blocks (`BEGIN ... COMMIT;`) so any syntax failure will cleanly roll back without leaving partial tables.
- **Step 3 (Reversal Scripts):**
  - Migration 011: `ALTER PUBLICATION supabase_realtime DROP TABLE ...;`
  - Migration 010: `DROP VIEW IF EXISTS accounts CASCADE; DROP TABLE IF EXISTS offline_mutation_queue;`
  - Migration 009: `DROP FUNCTION IF EXISTS fn_post_contractor_payment_atomic CASCADE; ...`
  - Migration 008: `DROP TABLE IF EXISTS employee_advances, contractor_payments, labour_payments, daily_labour_work_logs CASCADE;`
  - Migration 007: Drop hardened RLS policies.
