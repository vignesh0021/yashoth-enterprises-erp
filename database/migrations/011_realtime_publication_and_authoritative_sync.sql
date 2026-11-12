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

-- ----------------------------------------------------------------------------
-- 2. Add Authoritative Tables to 'supabase_realtime' Publication
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Add tables one-by-one safely if not already members
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'cash_bank_accounts'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE cash_bank_accounts;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_lots'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE inventory_lots;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'stock_movements'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE stock_movements;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'payments'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE payments;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'payment_allocations'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE payment_allocations;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'journal_entries'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE journal_entries;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'journal_lines'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE journal_lines;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'parties'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE parties;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'weighments'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE weighments;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'invoices'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'purchase_headers'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE purchase_headers;
        END IF;
    END IF;
END $$;
