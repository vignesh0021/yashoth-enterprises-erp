-- Yasoth Enterprises — Production Scrap ERP
-- Migration 003: Authentication, Multi-Tenant Isolation & Row Level Security (RLS)
-- Authoritative PostgreSQL & Supabase RLS policies ensuring strict tenant separation and RBAC

-- 1. Extend Users with Password Hash & Active Company
ALTER TABLE users_roles 
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS company_id UUID,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- 2. Company Memberships (Maps Users to Companies with Granular Roles)
CREATE TABLE IF NOT EXISTS company_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users_roles(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner_admin', 'manager', 'purchase_operator', 'weighment_operator', 'sales_operator', 'accounts_operator', 'store_operator', 'hr_operator', 'auditor')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_company ON company_memberships(user_id, company_id);

-- 3. Security Helper Functions for Session Context
CREATE OR REPLACE FUNCTION auth_current_user_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION auth_current_role() RETURNS VARCHAR AS $$
BEGIN
    RETURN COALESCE(current_setting('request.jwt.claim.role', true), 'authenticated');
EXCEPTION WHEN OTHERS THEN
    RETURN 'authenticated';
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION auth_current_company_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_company_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Enable Row Level Security (RLS) on Operational Tables
ALTER TABLE users_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE yards ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weighments ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Users & Profiles
DROP POLICY IF EXISTS users_read_policy ON users_roles;
CREATE POLICY users_read_policy ON users_roles
    FOR SELECT
    USING (
        id = auth_current_user_id()
        OR auth_current_role() IN ('owner_admin', 'service_role')
    );

DROP POLICY IF EXISTS users_update_policy ON users_roles;
CREATE POLICY users_update_policy ON users_roles
    FOR UPDATE
    USING (
        id = auth_current_user_id()
        OR auth_current_role() IN ('owner_admin', 'service_role')
    );

-- 6. RLS Policies: Tenant Company Isolation
-- Operational entities are visible only to active members of the corresponding company.
DROP POLICY IF EXISTS company_settings_isolation_policy ON company_settings;
CREATE POLICY company_settings_isolation_policy ON company_settings
    FOR ALL
    USING (
        auth_current_role() IN ('owner_admin', 'service_role')
        OR id IN (
            SELECT company_id FROM company_memberships 
            WHERE user_id = auth_current_user_id() AND is_active = true
        )
    );

-- 7. Audit Logs Security: Append-Only Guard (No Deletions or Edits)
DROP POLICY IF EXISTS audit_logs_insert_policy ON audit_logs;
CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS audit_logs_select_policy ON audit_logs;
CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT
    USING (
        auth_current_role() IN ('owner_admin', 'auditor', 'manager', 'service_role')
    );

-- Prevent unauthorized UPDATE or DELETE on audit logs entirely
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
