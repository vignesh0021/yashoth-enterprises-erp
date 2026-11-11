-- ============================================================================
-- YASHOTH ENTERPRISES ERP — SMALL-BUSINESS FINANCE & LABOUR MANAGEMENT
-- Migration: 008_finance_and_labour_management.sql
-- Description: Creates persistent authoritative tables and Row-Level Security (RLS)
--              for Monthly Staff Salaries, Daily Wage Labour, Outsourced Contractors,
--              Daily Expenses with 10 categories & payable tracking, and Guided Daily Cash Closing.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Daily Expenses Register
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    voucher_no VARCHAR(50) NOT NULL UNIQUE,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(100) NOT NULL, -- Daily Labour, Food / Lunch, Tea / Drinking Water, etc.
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    payment_mode VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'BANK', 'UNPAID')),
    status VARCHAR(20) NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'UNPAID', 'REVERSED')),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('APPROVED', 'PENDING', 'REJECTED')),
    entered_by VARCHAR(100),
    paid_to VARCHAR(150) NOT NULL,
    bill_reference VARCHAR(100),
    attachment_url TEXT,
    reversal_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    reversal_reason TEXT,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON expenses(company_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(company_id, status);

-- ----------------------------------------------------------------------------
-- 2. Permanent Staff Monthly Salary Register
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(150) NOT NULL,
    designation VARCHAR(100),
    salary_month VARCHAR(10) NOT NULL, -- YYYY-MM
    gross_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    advance_recovery NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_salary_payable NUMERIC(12, 2) NOT NULL CHECK (net_salary_payable >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE,
    payment_mode VARCHAR(20) DEFAULT 'BANK' CHECK (payment_mode IN ('CASH', 'BANK')),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID')),
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_records_company_month ON salary_records(company_id, salary_month);
CREATE INDEX IF NOT EXISTS idx_salary_records_employee ON salary_records(employee_id);

-- ----------------------------------------------------------------------------
-- 3. Daily Wage Labour Register
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_labour_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    worker_name_or_group VARCHAR(150) NOT NULL,
    worker_count INT NOT NULL DEFAULT 1 CHECK (worker_count > 0),
    working_days NUMERIC(6, 2) NOT NULL DEFAULT 1.0 CHECK (working_days > 0),
    daily_rate NUMERIC(12, 2) NOT NULL CHECK (daily_rate > 0),
    overtime_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    additional_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_labour_cost NUMERIC(12, 2) NOT NULL CHECK (total_labour_cost >= 0),
    advance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_mode VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'BANK', 'UNPAID')),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_labour_company_date ON daily_labour_entries(company_id, work_date);

-- ----------------------------------------------------------------------------
-- 4. Outsourced Contractors Master
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contractor_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    work_description TEXT,
    contract_type VARCHAR(50) NOT NULL DEFAULT 'FIXED_CONTRACT' CHECK (contract_type IN ('DAILY_RATE', 'FIXED_CONTRACT', 'QUANTITY_BASED')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contractors_company ON contractors(company_id);

-- ----------------------------------------------------------------------------
-- 5. Contractor Work Entries & Progress Payments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractor_work_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE,
    contractor_name VARCHAR(150) NOT NULL,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    work_description TEXT NOT NULL,
    worker_count INT NOT NULL DEFAULT 1,
    quantity_completed NUMERIC(12, 3) NOT NULL DEFAULT 1.0,
    agreed_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_contract_amount NUMERIC(12, 2) NOT NULL CHECK (total_contract_amount >= 0),
    advance_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    previous_payments NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_payment NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_mode VARCHAR(20) NOT NULL DEFAULT 'BANK' CHECK (payment_mode IN ('CASH', 'BANK', 'UNPAID')),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contractor_work_company_contractor ON contractor_work_entries(company_id, contractor_id);

-- ----------------------------------------------------------------------------
-- 6. Guided Daily Cash Closing Register
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_cash_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    closing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    today_cash_inflow NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    today_cash_outflow NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    expected_cash_in_hand NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    physically_counted_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discrepancy_reason TEXT,
    notes TEXT,
    closed_by VARCHAR(100) NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_cash_closings_company_date ON daily_cash_closings(company_id, closing_date);

-- ----------------------------------------------------------------------------
-- 7. Enable Row-Level Security (RLS) on All Finance Tables
-- ----------------------------------------------------------------------------
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_labour_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_cash_closings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 8. Multi-Tenant Isolation Policies
-- ----------------------------------------------------------------------------

-- expenses
CREATE POLICY rls_expenses_select ON expenses FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_expenses_insert ON expenses FOR INSERT
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_expenses_update ON expenses FOR UPDATE
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_expenses_delete ON expenses FOR DELETE
    USING (auth_is_company_member(company_id));

-- salary_records
CREATE POLICY rls_salary_records_select ON salary_records FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_salary_records_insert ON salary_records FOR INSERT
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_salary_records_update ON salary_records FOR UPDATE
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_salary_records_delete ON salary_records FOR DELETE
    USING (auth_is_company_member(company_id));

-- daily_labour_entries
CREATE POLICY rls_daily_labour_select ON daily_labour_entries FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_daily_labour_insert ON daily_labour_entries FOR INSERT
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_daily_labour_update ON daily_labour_entries FOR UPDATE
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_daily_labour_delete ON daily_labour_entries FOR DELETE
    USING (auth_is_company_member(company_id));

-- contractors
CREATE POLICY rls_contractors_select ON contractors FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_contractors_insert ON contractors FOR INSERT
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_contractors_update ON contractors FOR UPDATE
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_contractors_delete ON contractors FOR DELETE
    USING (auth_is_company_member(company_id));

-- contractor_work_entries
CREATE POLICY rls_contractor_work_select ON contractor_work_entries FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_contractor_work_insert ON contractor_work_entries FOR INSERT
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_contractor_work_update ON contractor_work_entries FOR UPDATE
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_contractor_work_delete ON contractor_work_entries FOR DELETE
    USING (auth_is_company_member(company_id));

-- daily_cash_closings
CREATE POLICY rls_daily_cash_closings_select ON daily_cash_closings FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_daily_cash_closings_insert ON daily_cash_closings FOR INSERT
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_daily_cash_closings_update ON daily_cash_closings FOR UPDATE
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

CREATE POLICY rls_daily_cash_closings_delete ON daily_cash_closings FOR DELETE
    USING (auth_is_company_member(company_id));
