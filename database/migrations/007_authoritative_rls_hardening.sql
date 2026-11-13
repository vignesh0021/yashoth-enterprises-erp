-- ============================================================================
-- YASHOTH ENTERPRISES ERP — PRODUCTION SECURITY & RLS HARDENING
-- Migration: 007_authoritative_rls_hardening.sql
-- Description: Authoritative Row-Level Security (RLS) policies, multi-tenant isolation,
--              nested relationship guards, and role-based operational permissions.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Helper Functions for RLS Authentication & Tenant Membership
-- ----------------------------------------------------------------------------

-- Retrieves current Supabase authenticated user ID
CREATE OR REPLACE FUNCTION auth_current_user_id() 
RETURNS UUID 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Retrieves current Supabase authenticated role
CREATE OR REPLACE FUNCTION auth_current_role() 
RETURNS VARCHAR 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN COALESCE(current_setting('request.jwt.claim.role', true), 'authenticated');
EXCEPTION WHEN OTHERS THEN
    RETURN 'authenticated';
END;
$$;

-- Verifies if current user is an active member of the specified company
CREATE OR REPLACE FUNCTION auth_is_company_member(cid UUID) 
RETURNS BOOLEAN 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF cid IS NULL THEN
        RETURN FALSE;
    END IF;
    -- Service role and owner_admin bypass company membership check
    IF auth_current_role() IN ('service_role', 'owner_admin') THEN
        RETURN TRUE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM company_memberships
        WHERE company_id = cid
          AND user_id = auth_current_user_id()
          AND is_active = true
    );
END;
$$;

-- Verifies if current user has an authorized role within the company
CREATE OR REPLACE FUNCTION auth_has_company_role(cid UUID, VARIADIC allowed_roles TEXT[]) 
RETURNS BOOLEAN 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF cid IS NULL THEN
        RETURN FALSE;
    END IF;
    IF auth_current_role() IN ('service_role', 'owner_admin') THEN
        RETURN TRUE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM company_memberships
        WHERE company_id = cid
          AND user_id = auth_current_user_id()
          AND is_active = true
          AND role = ANY(allowed_roles)
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Enable Row-Level Security on ALL Operational & Financial Tables
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commercial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commercial_document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS backup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS restore_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS yards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS material_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS weighments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS collection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. Tenant Isolation RLS Policies: Companies & Memberships
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS companies_isolation_policy ON companies;
CREATE POLICY companies_isolation_policy ON companies
    FOR ALL
    USING (
        auth_current_role() IN ('owner_admin', 'service_role')
        OR id IN (
            SELECT company_id FROM company_memberships
            WHERE user_id = auth_current_user_id() AND is_active = true
        )
    );

DROP POLICY IF EXISTS company_memberships_policy ON company_memberships;
CREATE POLICY company_memberships_policy ON company_memberships
    FOR ALL
    USING (
        auth_current_role() IN ('owner_admin', 'service_role')
        OR user_id = auth_current_user_id()
        OR company_id IN (
            SELECT company_id FROM company_memberships
            WHERE user_id = auth_current_user_id() AND is_active = true AND role IN ('owner_admin', 'manager')
        )
    );

-- ----------------------------------------------------------------------------
-- 4. Tenant Isolation RLS Policies: Master & Operational Tables
-- ----------------------------------------------------------------------------

-- Yards
DROP POLICY IF EXISTS yards_tenant_policy ON yards;
CREATE POLICY yards_tenant_policy ON yards
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Materials
DROP POLICY IF EXISTS materials_tenant_policy ON materials;
CREATE POLICY materials_tenant_policy ON materials
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Material Grades (Joined via Materials)
DROP POLICY IF EXISTS material_grades_tenant_policy ON material_grades;
CREATE POLICY material_grades_tenant_policy ON material_grades
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM materials m
            WHERE m.id = material_grades.material_id
              AND auth_is_company_member(m.company_id)
        )
    );

-- Parties (Suppliers & Customers)
DROP POLICY IF EXISTS parties_tenant_policy ON parties;
CREATE POLICY parties_tenant_policy ON parties
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Vehicles & Vehicle Documents
DROP POLICY IF EXISTS vehicles_tenant_policy ON vehicles;
CREATE POLICY vehicles_tenant_policy ON vehicles
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS vehicle_documents_tenant_policy ON vehicle_documents;
CREATE POLICY vehicle_documents_tenant_policy ON vehicle_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM vehicles v
            WHERE v.id = vehicle_documents.vehicle_id
              AND auth_is_company_member(v.company_id)
        )
    );

-- Employees & Attendance
DROP POLICY IF EXISTS employees_tenant_policy ON employees;
CREATE POLICY employees_tenant_policy ON employees
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS attendance_tenant_policy ON attendance_entries;
CREATE POLICY attendance_tenant_policy ON attendance_entries
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Cash & Bank Accounts + Account Transactions
DROP POLICY IF EXISTS cash_bank_accounts_tenant_policy ON cash_bank_accounts;
CREATE POLICY cash_bank_accounts_tenant_policy ON cash_bank_accounts
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS account_transactions_tenant_policy ON account_transactions;
CREATE POLICY account_transactions_tenant_policy ON account_transactions
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Weighments
DROP POLICY IF EXISTS weighments_tenant_policy ON weighments;
CREATE POLICY weighments_tenant_policy ON weighments
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Collection Jobs
DROP POLICY IF EXISTS collection_jobs_tenant_policy ON collection_jobs;
CREATE POLICY collection_jobs_tenant_policy ON collection_jobs
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Purchases & Purchase Lines
DROP POLICY IF EXISTS purchase_headers_tenant_policy ON purchase_headers;
CREATE POLICY purchase_headers_tenant_policy ON purchase_headers
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS purchase_lines_tenant_policy ON purchase_lines;
CREATE POLICY purchase_lines_tenant_policy ON purchase_lines
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM purchase_headers ph
            WHERE ph.id = purchase_lines.purchase_id
              AND auth_is_company_member(ph.company_id)
        )
    );

-- Inventory Lots & Stock Movements
DROP POLICY IF EXISTS inventory_lots_tenant_policy ON inventory_lots;
CREATE POLICY inventory_lots_tenant_policy ON inventory_lots
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS stock_movements_tenant_policy ON stock_movements;
CREATE POLICY stock_movements_tenant_policy ON stock_movements
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Sales Orders & Sales Lines
DROP POLICY IF EXISTS sales_headers_tenant_policy ON sales_headers;
CREATE POLICY sales_headers_tenant_policy ON sales_headers
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS sales_lines_tenant_policy ON sales_lines;
CREATE POLICY sales_lines_tenant_policy ON sales_lines
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sales_headers sh
            WHERE sh.id = sales_lines.sales_id
              AND auth_is_company_member(sh.company_id)
        )
    );

-- Invoices & Invoice Lines
DROP POLICY IF EXISTS invoices_tenant_policy ON invoices;
CREATE POLICY invoices_tenant_policy ON invoices
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS invoice_lines_tenant_policy ON invoice_lines;
CREATE POLICY invoice_lines_tenant_policy ON invoice_lines
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM invoices inv
            WHERE inv.id = invoice_lines.invoice_id
              AND auth_is_company_member(inv.company_id)
        )
    );

-- Payments & Allocations
DROP POLICY IF EXISTS payments_tenant_policy ON payments;
CREATE POLICY payments_tenant_policy ON payments
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS payment_allocations_tenant_policy ON payment_allocations;
CREATE POLICY payment_allocations_tenant_policy ON payment_allocations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM payments p
            WHERE p.id = payment_allocations.payment_id
              AND auth_is_company_member(p.company_id)
        )
    );

-- Expenses
DROP POLICY IF EXISTS expenses_tenant_policy ON expenses;
CREATE POLICY expenses_tenant_policy ON expenses
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Stock Counts & Lines
DROP POLICY IF EXISTS stock_counts_tenant_policy ON stock_counts;
CREATE POLICY stock_counts_tenant_policy ON stock_counts
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS stock_count_lines_tenant_policy ON stock_count_lines;
CREATE POLICY stock_count_lines_tenant_policy ON stock_count_lines
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM stock_counts sc
            WHERE sc.id = stock_count_lines.stock_count_id
              AND auth_is_company_member(sc.company_id)
        )
    );

-- Commercial Documents & Lines (Quotations, Proformas, Credit/Debit Notes)
DROP POLICY IF EXISTS commercial_documents_tenant_policy ON commercial_documents;
CREATE POLICY commercial_documents_tenant_policy ON commercial_documents
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS commercial_document_lines_tenant_policy ON commercial_document_lines;
CREATE POLICY commercial_document_lines_tenant_policy ON commercial_document_lines
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM commercial_documents cd
            WHERE cd.id = commercial_document_lines.document_id
              AND auth_is_company_member(cd.company_id)
        )
    );

-- Chart of Accounts & General Ledger Journals
DROP POLICY IF EXISTS chart_of_accounts_tenant_policy ON chart_of_accounts;
CREATE POLICY chart_of_accounts_tenant_policy ON chart_of_accounts
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS journal_entries_tenant_policy ON journal_entries;
CREATE POLICY journal_entries_tenant_policy ON journal_entries
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS journal_lines_tenant_policy ON journal_lines;
CREATE POLICY journal_lines_tenant_policy ON journal_lines
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_lines.journal_entry_id
              AND auth_is_company_member(je.company_id)
        )
    );

-- Backup & Restore Logs
DROP POLICY IF EXISTS backup_history_tenant_policy ON backup_history;
CREATE POLICY backup_history_tenant_policy ON backup_history
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS restore_logs_tenant_policy ON restore_logs;
CREATE POLICY restore_logs_tenant_policy ON restore_logs
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS backup_schedules_tenant_policy ON backup_schedules;
CREATE POLICY backup_schedules_tenant_policy ON backup_schedules
    FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- Rate History
DROP POLICY IF EXISTS rate_history_tenant_policy ON rate_history;
CREATE POLICY rate_history_tenant_policy ON rate_history
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM materials m
            WHERE m.id = rate_history.material_id
              AND auth_is_company_member(m.company_id)
        )
    );

-- ----------------------------------------------------------------------------
-- 5. Immutability Guards: Audit Logs (Strict Append-Only)
-- ----------------------------------------------------------------------------
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

REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
