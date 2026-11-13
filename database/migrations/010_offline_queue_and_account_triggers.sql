-- ============================================================================
-- YASHOTH ENTERPRISES ERP — OFFLINE SYNC QUEUE, VOUCHER SEQUENCES & ACCOUNT TRIGGERS
-- Migration: 010_offline_queue_and_account_triggers.sql
-- Description:
--   1. Creates offline_sync_queue and sync_conflicts tables for multi-device sync.
--   2. Enables Row-Level Security (RLS) on sync tables.
--   3. Adds INSTEAD OF UPDATE and INSERT triggers on accounts view to ensure
--      PostgREST mutations cleanly update the underlying cash_bank_accounts table.
--   4. Creates atomic PostgreSQL sequence generator fn_get_next_voucher_no to
--      prevent duplicate financial and weighment voucher numbers across offline devices.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Offline Synchronization Queue Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_mutation_id VARCHAR(100) NOT NULL UNIQUE,
    idempotency_key VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
        'WEIGHMENT', 'PURCHASE', 'INVOICE', 'EXPENSE', 'PAYMENT', 
        'ATTENDANCE', 'PARTY', 'ACCOUNT', 'SALARY', 'LABOUR', 'CONTRACTOR'
    )),
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    client_timestamp TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SYNCING', 'SYNCED', 'CONFLICT', 'FAILED')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offline_queue_tenant ON offline_sync_queue(company_id, status);
CREATE INDEX IF NOT EXISTS idx_offline_queue_idempotency ON offline_sync_queue(company_id, idempotency_key);

-- ----------------------------------------------------------------------------
-- 2. Synchronization Conflict Ledger Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    mutation_id UUID REFERENCES offline_sync_queue(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    client_timestamp TIMESTAMPTZ NOT NULL,
    server_timestamp TIMESTAMPTZ NOT NULL,
    client_payload JSONB NOT NULL,
    server_snapshot JSONB NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolution_strategy VARCHAR(30) CHECK (resolution_strategy IN ('KEEP_SERVER', 'FORCE_CLIENT', 'SAVE_AS_NEW')),
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_tenant ON sync_conflicts(company_id, is_resolved);

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security (RLS) on Synchronization Tables
-- ----------------------------------------------------------------------------
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offline_queue_tenant_policy ON offline_sync_queue;
CREATE POLICY offline_queue_tenant_policy ON offline_sync_queue
    FOR ALL
    USING (
        auth_current_role() IN ('owner_admin', 'service_role')
        OR auth_is_company_member(company_id)
    )
    WITH CHECK (
        auth_current_role() IN ('owner_admin', 'service_role')
        OR auth_is_company_member(company_id)
    );

DROP POLICY IF EXISTS sync_conflicts_tenant_policy ON sync_conflicts;
CREATE POLICY sync_conflicts_tenant_policy ON sync_conflicts
    FOR ALL
    USING (
        auth_current_role() IN ('owner_admin', 'service_role')
        OR auth_is_company_member(company_id)
    )
    WITH CHECK (
        auth_current_role() IN ('owner_admin', 'service_role')
        OR auth_is_company_member(company_id)
    );

-- ----------------------------------------------------------------------------
-- 4. INSTEAD OF Triggers for PostgREST 'accounts' View & Schema Alignment
-- ----------------------------------------------------------------------------
-- Ensure required balance and audit timestamp columns exist on cash_bank_accounts
ALTER TABLE IF EXISTS cash_bank_accounts ADD COLUMN IF NOT EXISTS current_balance DECIMAL(14, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS cash_bank_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
UPDATE cash_bank_accounts SET current_balance = COALESCE(opening_balance, 0.00) WHERE current_balance IS NULL;

-- Ensure view 'accounts' exists and reflects all columns
CREATE OR REPLACE VIEW accounts AS SELECT * FROM cash_bank_accounts;

CREATE OR REPLACE FUNCTION trg_accounts_view_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cash_bank_accounts
    SET 
        account_name = COALESCE(NEW.account_name, OLD.account_name),
        account_code = COALESCE(NEW.account_code, OLD.account_code),
        account_type = COALESCE(NEW.account_type, OLD.account_type),
        bank_name = NEW.bank_name,
        account_number = NEW.account_number,
        ifsc_code = NEW.ifsc_code,
        opening_balance = COALESCE(NEW.opening_balance, OLD.opening_balance),
        current_balance = COALESCE(NEW.current_balance, OLD.current_balance),
        is_active = COALESCE(NEW.is_active, OLD.is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS accounts_view_update_trigger ON accounts;
CREATE TRIGGER accounts_view_update_trigger
    INSTEAD OF UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION trg_accounts_view_update();

CREATE OR REPLACE FUNCTION trg_accounts_view_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO cash_bank_accounts (
        id,
        company_id,
        account_name,
        account_code,
        account_type,
        bank_name,
        account_number,
        ifsc_code,
        opening_balance,
        current_balance,
        is_active
    ) VALUES (
        COALESCE(NEW.id, uuid_generate_v4()),
        NEW.company_id,
        NEW.account_name,
        NEW.account_code,
        NEW.account_type,
        NEW.bank_name,
        NEW.account_number,
        NEW.ifsc_code,
        COALESCE(NEW.opening_balance, 0),
        COALESCE(NEW.current_balance, NEW.opening_balance, 0),
        COALESCE(NEW.is_active, true)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS accounts_view_insert_trigger ON accounts;
CREATE TRIGGER accounts_view_insert_trigger
    INSTEAD OF INSERT ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION trg_accounts_view_insert();

CREATE OR REPLACE FUNCTION trg_accounts_view_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM cash_bank_accounts WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS accounts_view_delete_trigger ON accounts;
CREATE TRIGGER accounts_view_delete_trigger
    INSTEAD OF DELETE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION trg_accounts_view_delete();

-- ----------------------------------------------------------------------------
-- 5. Atomic PostgreSQL Voucher Sequence Generator Function
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_document_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL,
    prefix VARCHAR(20) NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    current_number BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, doc_type, financial_year)
);

ALTER TABLE company_document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_document_sequences_tenant_policy ON company_document_sequences;
CREATE POLICY company_document_sequences_tenant_policy ON company_document_sequences
    FOR ALL
    USING (
        auth_current_role() IN ('owner_admin', 'service_role')
        OR auth_is_company_member(company_id)
    )
    WITH CHECK (
        auth_current_role() IN ('owner_admin', 'service_role')
        OR auth_is_company_member(company_id)
    );

CREATE OR REPLACE FUNCTION fn_get_next_voucher_no(
    p_company_id UUID,
    p_doc_type VARCHAR,
    p_prefix VARCHAR DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
    v_fy VARCHAR(10);
    v_prefix VARCHAR(20);
    v_next_num BIGINT;
    v_voucher_no VARCHAR(50);
BEGIN
    -- Determine current Indian Financial Year (e.g. "26" for FY 2026-2027)
    IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
        v_fy := TO_CHAR(CURRENT_DATE, 'YY');
    ELSE
        v_fy := TO_CHAR(CURRENT_DATE - INTERVAL '1 year', 'YY');
    END IF;

    -- Resolve default prefix if omitted
    v_prefix := COALESCE(p_prefix, 
        CASE p_doc_type
            WHEN 'WEIGHMENT' THEN 'WM'
            WHEN 'PURCHASE' THEN 'PUR'
            WHEN 'INVOICE' THEN 'YE'
            WHEN 'EXPENSE' THEN 'EXP'
            WHEN 'PAYMENT' THEN 'PAY'
            WHEN 'RECEIPT' THEN 'REC'
            WHEN 'JOURNAL' THEN 'JV'
            ELSE 'DOC'
        END
    );

    -- Atomically lock and increment counter
    INSERT INTO company_document_sequences (company_id, doc_type, prefix, financial_year, current_number)
    VALUES (p_company_id, p_doc_type, v_prefix, v_fy, 1)
    ON CONFLICT (company_id, doc_type, financial_year)
    DO UPDATE SET 
        current_number = company_document_sequences.current_number + 1,
        updated_at = CURRENT_TIMESTAMP
    RETURNING current_number INTO v_next_num;

    v_voucher_no := v_prefix || '-' || v_fy || '-' || LPAD(v_next_num::TEXT, 4, '0');
    RETURN v_voucher_no;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
