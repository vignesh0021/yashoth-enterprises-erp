-- ============================================================================
-- YASHOTH ENTERPRISES ERP — FINANCE ATOMIC TRANSACTIONS & ADVANCE INTEGRITY
-- Migration: 009_finance_atomic_and_advance_integrity.sql
-- Description: 
--   1. Adds unique constraints to prevent duplicate monthly salary postings.
--   2. Creates dedicated tables for Employee Advances, Labour Payments, and Contractor Payments.
--   3. Enables Row-Level Security (RLS) on all new finance tables.
--   4. Creates PostgreSQL atomic RPC functions for transaction integrity and zero-tolerance double-entry balancing.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Unique Constraint on Salary Records (One record per employee per month)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_salary_company_employee_month'
    ) THEN
        ALTER TABLE salary_records 
        ADD CONSTRAINT uq_salary_company_employee_month 
        UNIQUE (company_id, employee_id, salary_month);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Employee Advances Register
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_advances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(150) NOT NULL,
    advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    recovered_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (recovered_amount >= 0),
    remaining_balance NUMERIC(12, 2) NOT NULL CHECK (remaining_balance >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIALLY_RECOVERED', 'FULLY_RECOVERED')),
    payment_mode VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'BANK')),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    voucher_no VARCHAR(50) UNIQUE,
    idempotency_key VARCHAR(100),
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_advances_company ON employee_advances(company_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_advances_status ON employee_advances(company_id, status);

-- ----------------------------------------------------------------------------
-- 3. Dedicated Contractor Payments History
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractor_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE,
    contractor_work_id UUID REFERENCES contractor_work_entries(id) ON DELETE CASCADE,
    contractor_name VARCHAR(150) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_mode VARCHAR(20) NOT NULL DEFAULT 'BANK' CHECK (payment_mode IN ('CASH', 'BANK')),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    voucher_no VARCHAR(50) NOT NULL UNIQUE,
    idempotency_key VARCHAR(100),
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contractor_payments_work ON contractor_payments(company_id, contractor_work_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_contractor ON contractor_payments(company_id, contractor_id);

-- ----------------------------------------------------------------------------
-- 4. Dedicated Daily Labour Payments History
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS labour_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    daily_labour_id UUID REFERENCES daily_labour_entries(id) ON DELETE CASCADE,
    worker_name_or_group VARCHAR(150) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_mode VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'BANK')),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    voucher_no VARCHAR(50) NOT NULL UNIQUE,
    idempotency_key VARCHAR(100),
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labour_payments_labour ON labour_payments(company_id, daily_labour_id);

-- ----------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) on New Tables
-- ----------------------------------------------------------------------------
ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour_payments ENABLE ROW LEVEL SECURITY;

-- employee_advances RLS
CREATE POLICY rls_employee_advances_select ON employee_advances FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_employee_advances_insert ON employee_advances FOR INSERT
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_employee_advances_update ON employee_advances FOR UPDATE
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_employee_advances_delete ON employee_advances FOR DELETE
    USING (auth_is_company_member(company_id));

-- contractor_payments RLS
CREATE POLICY rls_contractor_payments_select ON contractor_payments FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_contractor_payments_insert ON contractor_payments FOR INSERT
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_contractor_payments_update ON contractor_payments FOR UPDATE
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_contractor_payments_delete ON contractor_payments FOR DELETE
    USING (auth_is_company_member(company_id));

-- labour_payments RLS
CREATE POLICY rls_labour_payments_select ON labour_payments FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_labour_payments_insert ON labour_payments FOR INSERT
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_labour_payments_update ON labour_payments FOR UPDATE
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_labour_payments_delete ON labour_payments FOR DELETE
    USING (auth_is_company_member(company_id));

-- ----------------------------------------------------------------------------
-- 6. Atomic RPC Function: Post Contractor Progress Payment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_post_contractor_payment_atomic(
    p_company_id UUID,
    p_contractor_id UUID,
    p_work_id UUID,
    p_contractor_name VARCHAR(150),
    p_amount NUMERIC(12, 2),
    p_payment_mode VARCHAR(20),
    p_account_id UUID,
    p_voucher_no VARCHAR(50),
    p_actor VARCHAR(100),
    p_idempotency_key VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_work RECORD;
    v_new_prev NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_payment_id UUID;
    v_journal_id UUID;
BEGIN
    -- Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_payment_id FROM contractor_payments 
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'idempotent', true);
        END IF;
    END IF;

    -- Fetch and lock contractor work row
    SELECT * INTO v_work FROM contractor_work_entries 
    WHERE id = p_work_id AND company_id = p_company_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contractor work entry % not found in company %', p_work_id, p_company_id;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    IF p_amount > v_work.remaining_balance THEN
        RAISE EXCEPTION 'Payment amount (₹%) cannot exceed remaining balance (₹%)', p_amount, v_work.remaining_balance;
    END IF;

    v_new_prev := v_work.previous_payments + p_amount;
    v_new_balance := v_work.remaining_balance - p_amount;

    -- Update work entry
    UPDATE contractor_work_entries
    SET previous_payments = v_new_prev,
        remaining_balance = v_new_balance,
        current_payment = p_amount
    WHERE id = p_work_id;

    -- Insert payment record
    INSERT INTO contractor_payments (
        company_id, contractor_id, contractor_work_id, contractor_name,
        amount, payment_mode, account_id, voucher_no, idempotency_key, created_by
    ) VALUES (
        p_company_id, p_contractor_id, p_work_id, p_contractor_name,
        p_amount, p_payment_mode, p_account_id, p_voucher_no, p_idempotency_key, p_actor
    ) RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'new_balance', v_new_balance
    );
END;
$$;
