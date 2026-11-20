# SUPABASE DEPLOYMENT & CUTOVER GUIDE

**Target Migrations:**
1. `database/migrations/012_finance_hardening_and_owner_operator.sql`
2. `database/migrations/013_receipt_attachments_and_storage_rls.sql`

**Target Edge Function:**
- `supabase/functions/verify-and-commit-attachment/index.ts`

---

## 1. Required Environment Variables (Names Only)

### Frontend (`.env` / Vite — Public Anon Only)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Supabase Edge Function Secrets (Server-Side Only — NEVER in Frontend)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Safe Pre-Flight Production Checks (Read-Only)

Before applying migrations or posting the `₹27,000` owner cash entry:
1. Verify no duplicate `₹27,000` `OPENING_BALANCE` or `OWNER_INJECTION` exists:
   ```sql
   SELECT id, account_id, transaction_date, transaction_type, amount, description
   FROM account_transactions
   WHERE amount = 27000 OR transaction_type IN ('OPENING_BALANCE', 'OWNER_INJECTION');
   ```
2. Verify existing `cash_bank_accounts` balances and deactivate unused `BANK` accounts (`is_active = false`) without deleting historical rows.
3. Take a full `pg_dump -Fc` backup + Storage archive before running DDL.

---

## 3. Staging Deployment Steps

1. Apply `012_finance_hardening_and_owner_operator.sql` in staging.
2. Apply `013_receipt_attachments_and_storage_rls.sql` in staging (creates private `erp-receipts` bucket + `document_attachments` + Storage RLS).
3. Deploy Edge Function:
   ```bash
   supabase functions deploy verify-and-commit-attachment --no-verify-jwt
   ```
   *(Function validates caller JWT inside `index.ts` via `userClient.auth.getUser()` and `company_memberships`.)*
4. Schedule `fn_expire_stale_attachments()` every 6 hours via `pg_cron` or Supabase scheduled trigger.
5. After owner confirms `₹27,000` is non-repayable Capital (`3010`) vs. repayable (`2150`), post **once** via `fn_post_account_transaction_atomic` with a deterministic `idempotency_key` (`OPENING-CASH-27000-<company_id>`), then run `fn_reconcile_account_balance(cash_account_id)`.

---

## 4. Rollback & Recovery Considerations

- Migrations `012` and `013` are **additive** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`); existing `009` labour/contractor RPCs and historical balances are untouched.
- Never `DELETE` a posted `journal_entries` or `account_transactions` row; use `reverseExpense` / reversing journals to preserve audit trail.
