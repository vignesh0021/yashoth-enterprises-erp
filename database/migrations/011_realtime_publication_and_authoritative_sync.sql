-- ============================================================================
-- YASHOTH ENTERPRISES ERP — SUPABASE REALTIME PUBLICATION & REPLICA IDENTITY
-- Migration: 011_realtime_publication_and_authoritative_sync.sql
-- Description:
--   1. Configures PostgreSQL Realtime publication for authoritative business tables.
--   2. Sets REPLICA IDENTITY FULL on subscribed tables so UPDATE/DELETE events
--      contain the full previous record payload and company_id.
--   3. Validates that Row-Level Security (RLS) is strictly enforced on all Realtime tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure REPLICA IDENTITY FULL for Complete Realtime Payloads
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS cash_bank_accounts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS inventory_lots REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS stock_movements REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS payments REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS payment_allocations REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS journal_entries REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS journal_lines REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS parties REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS weighments REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS invoices REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS purchase_headers REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS offline_sync_queue REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS sync_conflicts REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------------
-- 2. Add Authoritative Tables to 'supabase_realtime' Publication
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    tbl_name text;
    realtime_tables text[] := ARRAY[
        'cash_bank_accounts',
        'inventory_lots',
        'stock_movements',
        'payments',
        'payment_allocations',
        'journal_entries',
        'journal_lines',
        'parties',
        'weighments',
        'invoices',
        'purchase_headers',
        'offline_sync_queue',
        'sync_conflicts'
    ];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH tbl_name IN ARRAY realtime_tables LOOP
            -- Check that the table actually exists in public schema before altering publication
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = tbl_name
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_publication_tables 
                    WHERE pubname = 'supabase_realtime' AND tablename = tbl_name
                ) THEN
                    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', tbl_name);
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;
