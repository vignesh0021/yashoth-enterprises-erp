-- ============================================================================
-- YASHOTH ENTERPRISES ERP — FINANCE ATOMIC TRANSACTIONS & ADVANCE INTEGRITY
-- Migration: 009_finance_atomic_and_advance_integrity.sql
-- Description: 
--   1. Adds unique constraints to prevent duplicate monthly salary postings.
--   2. Ensures backward-compatible view for cash_bank_accounts.
--   3. Creates dedicated tables for Employee Advances, Labour Payments, and Contractor Payments.
--   4. Enables Row-Level Security (RLS) on all new finance tables.
--   5. Creates PostgreSQL atomic RPC functions for contractor payments, salary disbursements,
--      labour settlements, and employee advances with transactional journal + account posting.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Backward-compatibility view: aliases cash_bank_accounts as accounts if queried
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'accounts') AND
       NOT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'accounts') THEN
        CREATE OR REPLACE VIEW accounts AS SELECT * FROM cash_bank_accounts;
    END IF;
END $$;

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
    account_id UUID REFERENCES cash_bank_accounts(id) ON DELETE SET NULL,
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
    account_id UUID REFERENCES cash_bank_accounts(id) ON DELETE SET NULL,
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
    account_id UUID REFERENCES cash_bank_accounts(id) ON DELETE SET NULL,
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_work RECORD;
    v_new_prev NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_payment_id UUID;
    v_journal_id UUID;
    v_account_code VARCHAR(50);
    v_account_name VARCHAR(255);
BEGIN
    -- 1. Authorization check: Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- 2. Verify contractor belongs to the specified company
    PERFORM 1 FROM contractors WHERE id = p_contractor_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contractor % does not belong to company %', p_contractor_id, p_company_id;
    END IF;

    -- 3. If account_id provided, verify cash/bank account belongs to the same company
    IF p_account_id IS NOT NULL THEN
        PERFORM 1 FROM cash_bank_accounts WHERE id = p_account_id AND company_id = p_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %', p_account_id, p_company_id;
        END IF;
    END IF;

    -- 4. Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_payment_id FROM contractor_payments 
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'idempotent', true);
        END IF;
    END IF;

    -- 5. Fetch and lock contractor work row
    SELECT * INTO v_work FROM contractor_work_entries 
    WHERE id = p_work_id AND company_id = p_company_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contractor work entry % not found in company %', p_work_id, p_company_id;
    END IF;

    -- Verify work entry belongs to the specified contractor
    IF v_work.contractor_id <> p_contractor_id THEN
        RAISE EXCEPTION 'Work entry % belongs to contractor %, not %', p_work_id, v_work.contractor_id, p_contractor_id;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    IF p_amount > v_work.remaining_balance THEN
        RAISE EXCEPTION 'Payment amount (₹%) cannot exceed remaining balance (₹%)', p_amount, v_work.remaining_balance;
    END IF;

    v_new_prev := v_work.previous_payments + p_amount;
    v_new_balance := v_work.remaining_balance - p_amount;

    -- 1. Update work entry
    UPDATE contractor_work_entries
    SET previous_payments = v_new_prev,
        remaining_balance = v_new_balance,
        current_payment = p_amount
    WHERE id = p_work_id;

    -- 2. Insert payment record
    INSERT INTO contractor_payments (
        company_id, contractor_id, contractor_work_id, contractor_name,
        amount, payment_mode, account_id, voucher_no, idempotency_key, created_by
    ) VALUES (
        p_company_id, p_contractor_id, p_work_id, p_contractor_name,
        p_amount, p_payment_mode, p_account_id, p_voucher_no, p_idempotency_key, p_actor
    ) RETURNING id INTO v_payment_id;

    -- 3. Insert account transaction (money out) if account_id is provided
    IF p_account_id IS NOT NULL THEN
        INSERT INTO account_transactions (
            account_id, transaction_date, transaction_type, direction,
            amount, reference_no, description, created_at
        ) VALUES (
            p_account_id, CURRENT_DATE, 'OPERATING_EXPENSE', 'CREDIT',
            p_amount, p_voucher_no, 'Contractor Progress Payment: ' || p_contractor_name || ' (' || p_voucher_no || ')', NOW()
        );
    END IF;

    -- 4. Insert zero-tolerance double-entry journal (Dr. 2110, Cr. 1010/1020)
    v_account_code := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN '1020' ELSE '1010' END;
    v_account_name := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;

    INSERT INTO journal_entries (
        company_id, entry_no, entry_date, source_type, source_id,
        reference_no, narration, total_debit, total_credit, is_posted
    ) VALUES (
        p_company_id, 'JV-CPAY-' || p_voucher_no, CURRENT_DATE, 'PAYMENT', p_work_id::TEXT,
        p_voucher_no, 'Contractor progress payment to ' || p_contractor_name, p_amount, p_amount, true
    ) RETURNING id INTO v_journal_id;

    -- Debit 2110 Contractor & Labour Payable
    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_journal_id, '2110', 'Contractor & Labour Payable', p_amount, 0.00, 'Liability reduction: ' || p_contractor_name
    );

    -- Credit 1010/1020 Cash / Bank
    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_journal_id, v_account_code, v_account_name, 0.00, p_amount, 'Payment via ' || p_payment_mode
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'journal_id', v_journal_id,
        'new_balance', v_new_balance
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Atomic RPC Function: Post Daily Labour Settlement Payment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_post_labour_payment_atomic(
    p_company_id UUID,
    p_daily_labour_id UUID,
    p_worker_name_or_group VARCHAR(150),
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_labour RECORD;
    v_new_paid NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_payment_id UUID;
    v_journal_id UUID;
    v_account_code VARCHAR(50);
    v_account_name VARCHAR(255);
BEGIN
    -- 1. Authorization check: Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- 2. Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_payment_id FROM labour_payments 
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'idempotent', true);
        END IF;
    END IF;

    -- 3. If account_id provided, verify cash/bank account belongs to the same company
    IF p_account_id IS NOT NULL THEN
        PERFORM 1 FROM cash_bank_accounts WHERE id = p_account_id AND company_id = p_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %', p_account_id, p_company_id;
        END IF;
    END IF;

    -- 4. Fetch and lock daily labour row
    SELECT * INTO v_labour FROM daily_labour_entries 
    WHERE id = p_daily_labour_id AND company_id = p_company_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Daily labour entry % not found in company %', p_daily_labour_id, p_company_id;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    IF p_amount > v_labour.remaining_balance THEN
        RAISE EXCEPTION 'Payment amount (₹%) exceeds remaining balance (₹%)', p_amount, v_labour.remaining_balance;
    END IF;

    v_new_paid := v_labour.amount_paid + p_amount;
    v_new_balance := v_labour.remaining_balance - p_amount;

    UPDATE daily_labour_entries
    SET amount_paid = v_new_paid,
        remaining_balance = v_new_balance
    WHERE id = p_daily_labour_id;

    INSERT INTO labour_payments (
        company_id, daily_labour_id, worker_name_or_group, amount,
        payment_mode, account_id, voucher_no, idempotency_key, created_by
    ) VALUES (
        p_company_id, p_daily_labour_id, p_worker_name_or_group, p_amount,
        p_payment_mode, p_account_id, p_voucher_no, p_idempotency_key, p_actor
    ) RETURNING id INTO v_payment_id;

    IF p_account_id IS NOT NULL THEN
        INSERT INTO account_transactions (
            account_id, transaction_date, transaction_type, direction,
            amount, reference_no, description, created_at
        ) VALUES (
            p_account_id, CURRENT_DATE, 'OPERATING_EXPENSE', 'CREDIT',
            p_amount, p_voucher_no, 'Daily Labour Settlement: ' || p_worker_name_or_group, NOW()
        );
    END IF;

    v_account_code := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN '1020' ELSE '1010' END;
    v_account_name := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;

    INSERT INTO journal_entries (
        company_id, entry_no, entry_date, source_type, source_id,
        reference_no, narration, total_debit, total_credit, is_posted
    ) VALUES (
        p_company_id, 'JV-LPAY-' || p_voucher_no, CURRENT_DATE, 'PAYMENT', p_daily_labour_id::TEXT,
        p_voucher_no, 'Daily labour settlement for ' || p_worker_name_or_group, p_amount, p_amount, true
    ) RETURNING id INTO v_journal_id;

    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_journal_id, '2100', 'Employee Wages & Advances Payable', p_amount, 0.00, 'Liability reduction: ' || p_worker_name_or_group
    );

    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_journal_id, v_account_code, v_account_name, 0.00, p_amount, 'Settlement via ' || p_payment_mode
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'journal_id', v_journal_id,
        'new_balance', v_new_balance
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Atomic RPC Function: Post Monthly Salary Disbursement Installment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_post_salary_disbursement_atomic(
    p_company_id UUID,
    p_salary_record_id UUID,
    p_employee_name VARCHAR(150),
    p_salary_month VARCHAR(10),
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record RECORD;
    v_new_paid NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_new_status VARCHAR(20);
    v_journal_id UUID;
    v_account_code VARCHAR(50);
    v_account_name VARCHAR(255);
BEGIN
    -- 1. Authorization check: Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- 2. Fetch and lock salary record row
    SELECT * INTO v_record FROM salary_records 
    WHERE id = p_salary_record_id AND company_id = p_company_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Salary record % not found in company %', p_salary_record_id, p_company_id;
    END IF;

    -- 3. Verify employee belongs to the specified company
    PERFORM 1 FROM employees WHERE id = v_record.employee_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % does not belong to company %', v_record.employee_id, p_company_id;
    END IF;

    -- 4. If account_id provided, verify cash/bank account belongs to the same company
    IF p_account_id IS NOT NULL THEN
        PERFORM 1 FROM cash_bank_accounts WHERE id = p_account_id AND company_id = p_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %', p_account_id, p_company_id;
        END IF;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Disbursement amount must be greater than zero';
    END IF;

    IF p_amount > v_record.remaining_balance THEN
        RAISE EXCEPTION 'Disbursement amount (₹%) exceeds remaining balance (₹%)', p_amount, v_record.remaining_balance;
    END IF;

    v_new_paid := v_record.amount_paid + p_amount;
    v_new_balance := v_record.remaining_balance - p_amount;
    v_new_status := CASE WHEN v_new_balance <= 0.001 THEN 'PAID' ELSE 'PARTIALLY_PAID' END;

    UPDATE salary_records
    SET amount_paid = v_new_paid,
        remaining_balance = v_new_balance,
        status = v_new_status,
        payment_date = CURRENT_DATE,
        payment_mode = p_payment_mode,
        account_id = p_account_id
    WHERE id = p_salary_record_id;

    IF p_account_id IS NOT NULL THEN
        INSERT INTO account_transactions (
            account_id, transaction_date, transaction_type, direction,
            amount, reference_no, description, created_at
        ) VALUES (
            p_account_id, CURRENT_DATE, 'OPERATING_EXPENSE', 'CREDIT',
            p_amount, p_voucher_no, 'Salary Disbursement: ' || p_employee_name || ' (' || p_salary_month || ')', NOW()
        );
    END IF;

    v_account_code := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN '1020' ELSE '1010' END;
    v_account_name := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;

    INSERT INTO journal_entries (
        company_id, entry_no, entry_date, source_type, source_id,
        reference_no, narration, total_debit, total_credit, is_posted
    ) VALUES (
        p_company_id, 'JV-SALDISB-' || p_voucher_no, CURRENT_DATE, 'PAYMENT', p_salary_record_id::TEXT,
        p_voucher_no, 'Salary disbursement to ' || p_employee_name || ' (' || p_salary_month || ')', p_amount, p_amount, true
    ) RETURNING id INTO v_journal_id;

    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_journal_id, '2100', 'Employee Wages & Advances Payable', p_amount, 0.00, 'Salary liability reduction: ' || p_employee_name
    );

    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_journal_id, v_account_code, v_account_name, 0.00, p_amount, 'Disbursement via ' || p_payment_mode
    );

    RETURN jsonb_build_object(
        'success', true,
        'journal_id', v_journal_id,
        'new_balance', v_new_balance,
        'status', v_new_status
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Atomic RPC Function: Issue Employee Advance
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_issue_employee_advance_atomic(
    p_company_id UUID,
    p_employee_id UUID,
    p_employee_name VARCHAR(150),
    p_amount NUMERIC(12, 2),
    p_payment_mode VARCHAR(20),
    p_account_id UUID,
    p_voucher_no VARCHAR(50),
    p_actor VARCHAR(100),
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_advance_id UUID;
    v_journal_id UUID;
    v_emp RECORD;
    v_account_code VARCHAR(50);
    v_account_name VARCHAR(255);
BEGIN
    -- 1. Authorization check: Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- 2. If account_id provided, verify cash/bank account belongs to the same company
    IF p_account_id IS NOT NULL THEN
        PERFORM 1 FROM cash_bank_accounts WHERE id = p_account_id AND company_id = p_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %', p_account_id, p_company_id;
        END IF;
    END IF;

    -- 3. Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_advance_id FROM employee_advances
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'advance_id', v_advance_id, 'idempotent', true);
        END IF;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Advance amount must be greater than zero';
    END IF;

    -- 4. Lock employee record
    SELECT * INTO v_emp FROM employees
    WHERE id = p_employee_id AND company_id = p_company_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % not found in company %', p_employee_id, p_company_id;
    END IF;

    -- 1. Insert advance record
    INSERT INTO employee_advances (
        company_id, employee_id, employee_name, advance_date, amount,
        recovered_amount, remaining_balance, status, payment_mode,
        account_id, voucher_no, idempotency_key, notes, created_by
    ) VALUES (
        p_company_id, p_employee_id, p_employee_name, CURRENT_DATE, p_amount,
        0.00, p_amount, 'OPEN', p_payment_mode,
        p_account_id, p_voucher_no, p_idempotency_key, p_notes, p_actor
    ) RETURNING id INTO v_advance_id;

    -- 2. Update employee current advance balance
    UPDATE employees
    SET current_advance_balance = COALESCE(current_advance_balance, 0) + p_amount
    WHERE id = p_employee_id;

    -- 3. Account transaction (Cash / Bank outflow)
    IF p_account_id IS NOT NULL THEN
        INSERT INTO account_transactions (
            account_id, transaction_date, transaction_type, direction,
            amount, reference_no, description, created_at
        ) VALUES (
            p_account_id, CURRENT_DATE, 'OPERATING_EXPENSE', 'CREDIT',
            p_amount, p_voucher_no, 'Employee Advance Issue: ' || p_employee_name || ' (' || p_voucher_no || ')', NOW()
        );
    END IF;

    -- 4. Journal Entry: Dr 1060 Employee Advances, Cr 1010/1020 Cash/Bank
    v_account_code := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN '1020' ELSE '1010' END;
    v_account_name := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;

    INSERT INTO journal_entries (
        company_id, entry_no, entry_date, source_type, source_id,
        reference_no, narration, total_debit, total_credit, is_posted
    ) VALUES (
        p_company_id, 'JV-ADV-' || p_voucher_no, CURRENT_DATE, 'PAYMENT', v_advance_id::TEXT,
        p_voucher_no, 'Employee advance issued to ' || p_employee_name, p_amount, p_amount, true
    ) RETURNING id INTO v_journal_id;

    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_journal_id, '1060', 'Employee Advances & Prepayments', p_amount, 0.00, 'Advance issued to: ' || p_employee_name
    );

    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_journal_id, v_account_code, v_account_name, 0.00, p_amount, 'Advance disbursement via ' || p_payment_mode
    );

    RETURN jsonb_build_object(
        'success', true,
        'advance_id', v_advance_id,
        'journal_id', v_journal_id
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Atomic RPC Function: Post Monthly Salary Accrual
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_post_salary_accrual_atomic(
    p_company_id UUID,
    p_employee_id UUID,
    p_employee_name VARCHAR(150),
    p_designation VARCHAR(100),
    p_salary_month VARCHAR(10),
    p_gross_salary NUMERIC(12, 2),
    p_allowances NUMERIC(12, 2),
    p_deductions NUMERIC(12, 2),
    p_advance_recovery NUMERIC(12, 2),
    p_net_salary_payable NUMERIC(12, 2),
    p_amount_paid NUMERIC(12, 2),
    p_payment_mode VARCHAR(20),
    p_account_id UUID,
    p_actor VARCHAR(100),
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record_id UUID;
    v_accrual_journal_id UUID;
    v_disb_journal_id UUID;
    v_remaining_balance NUMERIC(12, 2);
    v_adv_balance NUMERIC(12, 2);
    v_status VARCHAR(20);
    v_total_expense NUMERIC(12, 2);
    v_voucher_no VARCHAR(50);
    v_account_code VARCHAR(50);
    v_account_name VARCHAR(255);
BEGIN
    -- 1. Authorization check: Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- 2. Verify employee belongs to company
    PERFORM 1 FROM employees WHERE id = p_employee_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % does not belong to company %', p_employee_id, p_company_id;
    END IF;

    -- 3. If account_id provided and payment is made, verify cash/bank account belongs to company
    IF p_account_id IS NOT NULL AND COALESCE(p_amount_paid, 0) > 0 THEN
        PERFORM 1 FROM cash_bank_accounts WHERE id = p_account_id AND company_id = p_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %', p_account_id, p_company_id;
        END IF;
    END IF;

    -- 4. Advance recovery check: Validate advance recovery cannot exceed actual employee advance balance
    IF COALESCE(p_advance_recovery, 0) > 0 THEN
        SELECT COALESCE(SUM(remaining_balance), 0) INTO v_adv_balance
        FROM employee_advances
        WHERE employee_id = p_employee_id AND company_id = p_company_id AND status IN ('OPEN', 'PARTIALLY_RECOVERED');

        IF p_advance_recovery > v_adv_balance THEN
            RAISE EXCEPTION 'Advance recovery (₹%) exceeds available advance balance (₹%) for employee %',
                p_advance_recovery, v_adv_balance, p_employee_name;
        END IF;
    END IF;

    IF p_gross_salary < 0 THEN
        RAISE EXCEPTION 'Gross salary cannot be negative';
    END IF;

    -- Check if salary already accrued for this month
    SELECT id INTO v_record_id FROM salary_records
    WHERE company_id = p_company_id AND employee_id = p_employee_id AND salary_month = p_salary_month;

    IF FOUND THEN
        RAISE EXCEPTION 'Salary for % has already been accrued for month %', p_employee_name, p_salary_month;
    END IF;

    v_total_expense := p_gross_salary + COALESCE(p_allowances, 0);
    v_remaining_balance := p_net_salary_payable - COALESCE(p_amount_paid, 0);
    v_status := CASE 
        WHEN v_remaining_balance <= 0.001 AND p_amount_paid > 0 THEN 'PAID'
        WHEN p_amount_paid > 0 THEN 'PARTIALLY_PAID'
        ELSE 'PENDING'
    END;

    -- 1. Insert salary record
    INSERT INTO salary_records (
        company_id, employee_id, employee_name, designation, salary_month,
        gross_salary, allowances, deductions, advance_recovery, net_salary_payable,
        amount_paid, remaining_balance, payment_date, payment_mode, account_id,
        status, notes, created_by
    ) VALUES (
        p_company_id, p_employee_id, p_employee_name, p_designation, p_salary_month,
        p_gross_salary, COALESCE(p_allowances, 0), COALESCE(p_deductions, 0), COALESCE(p_advance_recovery, 0), p_net_salary_payable,
        COALESCE(p_amount_paid, 0), v_remaining_balance, CASE WHEN p_amount_paid > 0 THEN CURRENT_DATE ELSE NULL END,
        CASE WHEN p_amount_paid > 0 THEN p_payment_mode ELSE NULL END, p_account_id,
        v_status, p_notes, p_actor
    ) RETURNING id INTO v_record_id;

    -- 2. Recover advances if applicable
    IF COALESCE(p_advance_recovery, 0) > 0 THEN
        UPDATE employees
        SET current_advance_balance = GREATEST(0, COALESCE(current_advance_balance, 0) - p_advance_recovery)
        WHERE id = p_employee_id;

        UPDATE employee_advances
        SET recovered_amount = recovered_amount + LEAST(remaining_balance, p_advance_recovery),
            remaining_balance = GREATEST(0, remaining_balance - p_advance_recovery),
            status = CASE WHEN remaining_balance - p_advance_recovery <= 0.01 THEN 'FULLY_RECOVERED' ELSE 'PARTIALLY_RECOVERED' END
        WHERE employee_id = p_employee_id AND company_id = p_company_id AND status != 'FULLY_RECOVERED';
    END IF;

    -- 3. Post Accrual Journal: Dr 5050, Cr 1060 (adv), Cr 2120 (ded), Cr 2100 (net payable)
    INSERT INTO journal_entries (
        company_id, entry_no, entry_date, source_type, source_id,
        reference_no, narration, total_debit, total_credit, is_posted
    ) VALUES (
        p_company_id, 'JV-SALACC-' || p_salary_month || '-' || SUBSTRING(p_employee_id::TEXT FROM 1 FOR 6),
        CURRENT_DATE, 'MANUAL_JOURNAL', v_record_id::TEXT,
        'SAL-' || p_salary_month, 'Salary accrual for ' || p_employee_name || ' (' || p_salary_month || ')',
        v_total_expense, v_total_expense, true
    ) RETURNING id INTO v_accrual_journal_id;

    -- Dr 5050 Salaries & Staff Wages
    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_accrual_journal_id, '5050', 'Salaries & Staff Wages', v_total_expense, 0.00,
        'Salary & allowances: ' || p_employee_name || ' (' || p_salary_month || ')'
    );

    -- Cr 1060 Advance recovery
    IF COALESCE(p_advance_recovery, 0) > 0 THEN
        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_accrual_journal_id, '1060', 'Employee Advances & Prepayments', 0.00, p_advance_recovery,
            'Advance recovery from: ' || p_employee_name
        );
    END IF;

    -- Cr 2120 Deductions
    IF COALESCE(p_deductions, 0) > 0 THEN
        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_accrual_journal_id, '2120', 'Payroll Deductions Payable', 0.00, p_deductions,
            'Salary deductions for: ' || p_employee_name
        );
    END IF;

    -- Cr 2100 Net salary payable
    IF p_net_salary_payable > 0 THEN
        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_accrual_journal_id, '2100', 'Employee Wages & Advances Payable', 0.00, p_net_salary_payable,
            'Net salary payable to: ' || p_employee_name
        );
    END IF;

    -- 4. If immediate payment was made, post disbursement
    IF COALESCE(p_amount_paid, 0) > 0 THEN
        v_voucher_no := 'SAL-' || p_salary_month || '-' || REPLACE(p_employee_name, ' ', '');
        v_account_code := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN '1020' ELSE '1010' END;
        v_account_name := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;

        IF p_account_id IS NOT NULL THEN
            INSERT INTO account_transactions (
                account_id, transaction_date, transaction_type, direction,
                amount, reference_no, description, created_at
            ) VALUES (
                p_account_id, CURRENT_DATE, 'OPERATING_EXPENSE', 'CREDIT',
                p_amount_paid, v_voucher_no, 'Salary Disbursement: ' || p_employee_name || ' (' || p_salary_month || ')', NOW()
            );
        END IF;

        INSERT INTO journal_entries (
            company_id, entry_no, entry_date, source_type, source_id,
            reference_no, narration, total_debit, total_credit, is_posted
        ) VALUES (
            p_company_id, 'JV-SALDISB-' || v_voucher_no, CURRENT_DATE, 'PAYMENT', v_record_id::TEXT,
            v_voucher_no, 'Salary disbursement to ' || p_employee_name || ' (' || p_salary_month || ')', p_amount_paid, p_amount_paid, true
        ) RETURNING id INTO v_disb_journal_id;

        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_disb_journal_id, '2100', 'Employee Wages & Advances Payable', p_amount_paid, 0.00,
            'Salary liability reduction: ' || p_employee_name
        );

        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_disb_journal_id, v_account_code, v_account_name, 0.00, p_amount_paid,
            'Disbursement via ' || p_payment_mode
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'salary_record_id', v_record_id,
        'accrual_journal_id', v_accrual_journal_id,
        'disbursement_journal_id', v_disb_journal_id,
        'remaining_balance', v_remaining_balance,
        'status', v_status
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. Atomic RPC Function: Post Daily Labour Accrual
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_post_daily_labour_accrual_atomic(
    p_company_id UUID,
    p_work_date DATE,
    p_worker_name_or_group VARCHAR(150),
    p_worker_count INTEGER,
    p_working_days NUMERIC(5, 2),
    p_daily_rate NUMERIC(12, 2),
    p_overtime_amount NUMERIC(12, 2),
    p_additional_charges NUMERIC(12, 2),
    p_total_labour_cost NUMERIC(12, 2),
    p_advance_amount NUMERIC(12, 2),
    p_amount_paid NUMERIC(12, 2),
    p_remaining_balance NUMERIC(12, 2),
    p_payment_mode VARCHAR(20),
    p_account_id UUID,
    p_actor VARCHAR(100),
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_labour_id UUID;
    v_accrual_journal_id UUID;
    v_pay_journal_id UUID;
    v_payment_id UUID;
    v_voucher_no VARCHAR(50);
    v_account_code VARCHAR(50);
    v_account_name VARCHAR(255);
BEGIN
    -- 1. Authorization check: Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- 2. If account_id provided and payment is made, verify cash/bank account belongs to company
    IF p_account_id IS NOT NULL AND COALESCE(p_amount_paid, 0) > 0 THEN
        PERFORM 1 FROM cash_bank_accounts WHERE id = p_account_id AND company_id = p_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %', p_account_id, p_company_id;
        END IF;
    END IF;

    -- 3. Balance verification: remaining_balance must equal total - advance - paid
    IF ROUND(p_remaining_balance, 2) <> ROUND(p_total_labour_cost - COALESCE(p_advance_amount, 0) - COALESCE(p_amount_paid, 0), 2) THEN
        RAISE EXCEPTION 'Daily labour remaining balance % does not match calculated balance (total % - advance % - paid %)',
            p_remaining_balance, p_total_labour_cost, COALESCE(p_advance_amount, 0), COALESCE(p_amount_paid, 0);
    END IF;

    -- 4. Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_payment_id FROM labour_payments
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            SELECT daily_labour_id INTO v_labour_id FROM labour_payments WHERE id = v_payment_id;
            RETURN jsonb_build_object('success', true, 'daily_labour_id', v_labour_id, 'payment_id', v_payment_id, 'idempotent', true);
        END IF;
    END IF;

    IF p_total_labour_cost <= 0 THEN
        RAISE EXCEPTION 'Total labour cost must be greater than zero';
    END IF;

    -- 1. Insert daily labour entry
    INSERT INTO daily_labour_entries (
        company_id, work_date, worker_name_or_group, worker_count, working_days,
        daily_rate, overtime_amount, additional_charges, total_labour_cost,
        advance_amount, amount_paid, remaining_balance, payment_mode, account_id,
        notes, created_by
    ) VALUES (
        p_company_id, p_work_date, p_worker_name_or_group, p_worker_count, p_working_days,
        p_daily_rate, COALESCE(p_overtime_amount, 0), COALESCE(p_additional_charges, 0), p_total_labour_cost,
        COALESCE(p_advance_amount, 0), COALESCE(p_amount_paid, 0), p_remaining_balance, p_payment_mode, p_account_id,
        p_notes, p_actor
    ) RETURNING id INTO v_labour_id;

    -- 2. Post Accrual Journal: Dr 5020, Cr 1070 (advance), Cr 2100 (unpaid payable)
    INSERT INTO journal_entries (
        company_id, entry_no, entry_date, source_type, source_id,
        reference_no, narration, total_debit, total_credit, is_posted
    ) VALUES (
        p_company_id, 'JV-DLAB-' || SUBSTRING(v_labour_id::TEXT FROM 1 FOR 8),
        p_work_date, 'EXPENSE', v_labour_id::TEXT,
        'DLAB-' || p_work_date::TEXT, 'Daily labour for ' || p_worker_name_or_group || ' (' || p_work_date::TEXT || ')',
        p_total_labour_cost, p_total_labour_cost, true
    ) RETURNING id INTO v_accrual_journal_id;

    -- Dr 5020 Demolition Direct Labor & Cutting
    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_accrual_journal_id, '5020', 'Demolition Direct Labor & Cutting', p_total_labour_cost, 0.00,
        'Direct labour: ' || p_worker_name_or_group || ' (' || p_work_date::TEXT || ')'
    );

    -- Cr 1070 Advance adjusted
    IF COALESCE(p_advance_amount, 0) > 0 THEN
        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_accrual_journal_id, '1070', 'Contractor & Labour Advances', 0.00, p_advance_amount,
            'Advance adjusted for: ' || p_worker_name_or_group
        );
    END IF;

    -- Cr 2100 Payable (remaining + immediate paid)
    IF (p_total_labour_cost - COALESCE(p_advance_amount, 0)) > 0 THEN
        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_accrual_journal_id, '2100', 'Employee Wages & Advances Payable', 0.00,
            (p_total_labour_cost - COALESCE(p_advance_amount, 0)),
            'Labour payable to: ' || p_worker_name_or_group
        );
    END IF;

    -- 3. If immediate payment was made, post payment settlement
    IF COALESCE(p_amount_paid, 0) > 0 THEN
        v_voucher_no := 'LPAY-' || p_work_date::TEXT || '-' || SUBSTRING(v_labour_id::TEXT FROM 1 FOR 6);
        v_account_code := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN '1020' ELSE '1010' END;
        v_account_name := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;

        INSERT INTO labour_payments (
            company_id, daily_labour_id, worker_name_or_group, amount,
            payment_mode, account_id, voucher_no, idempotency_key, created_by
        ) VALUES (
            p_company_id, v_labour_id, p_worker_name_or_group, p_amount_paid,
            p_payment_mode, p_account_id, v_voucher_no, p_idempotency_key, p_actor
        ) RETURNING id INTO v_payment_id;

        IF p_account_id IS NOT NULL THEN
            INSERT INTO account_transactions (
                account_id, transaction_date, transaction_type, direction,
                amount, reference_no, description, created_at
            ) VALUES (
                p_account_id, p_work_date, 'OPERATING_EXPENSE', 'CREDIT',
                p_amount_paid, v_voucher_no, 'Daily Labour Payment: ' || p_worker_name_or_group, NOW()
            );
        END IF;

        INSERT INTO journal_entries (
            company_id, entry_no, entry_date, source_type, source_id,
            reference_no, narration, total_debit, total_credit, is_posted
        ) VALUES (
            p_company_id, 'JV-LPAY-' || v_voucher_no, p_work_date, 'PAYMENT', v_labour_id::TEXT,
            v_voucher_no, 'Immediate labour settlement for ' || p_worker_name_or_group, p_amount_paid, p_amount_paid, true
        ) RETURNING id INTO v_pay_journal_id;

        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_pay_journal_id, '2100', 'Employee Wages & Advances Payable', p_amount_paid, 0.00,
            'Liability reduction: ' || p_worker_name_or_group
        );

        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_pay_journal_id, v_account_code, v_account_name, 0.00, p_amount_paid,
            'Paid via ' || p_payment_mode
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'daily_labour_id', v_labour_id,
        'accrual_journal_id', v_accrual_journal_id,
        'payment_id', v_payment_id,
        'payment_journal_id', v_pay_journal_id
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. Schema Enrichment: contractor_work_entries status & idempotency columns
-- ----------------------------------------------------------------------------
ALTER TABLE contractor_work_entries ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'REVERSED'));
ALTER TABLE contractor_work_entries ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
ALTER TABLE contractor_work_entries ADD COLUMN IF NOT EXISTS accrual_journal_id UUID;
CREATE INDEX IF NOT EXISTS idx_contractor_work_idempotency ON contractor_work_entries(company_id, idempotency_key);

-- ----------------------------------------------------------------------------
-- 13. Atomic RPC Function: Post Contractor Work Accrual & Immediate Payment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_post_contractor_work_atomic(
    p_company_id UUID,
    p_contractor_id UUID,
    p_contractor_name VARCHAR(150),
    p_work_date DATE,
    p_work_description TEXT,
    p_worker_count INT,
    p_quantity_completed NUMERIC(12, 3),
    p_agreed_rate NUMERIC(12, 2),
    p_total_contract_amount NUMERIC(12, 2),
    p_advance_paid NUMERIC(12, 2),
    p_previous_payments NUMERIC(12, 2),
    p_current_payment NUMERIC(12, 2),
    p_remaining_balance NUMERIC(12, 2),
    p_payment_mode VARCHAR(20),
    p_account_id UUID,
    p_actor VARCHAR(100),
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_work_id UUID;
    v_accrual_journal_id UUID;
    v_pay_journal_id UUID;
    v_payment_id UUID;
    v_voucher_no VARCHAR(50);
    v_account_code VARCHAR(50);
    v_account_name VARCHAR(255);
    v_status VARCHAR(30);
    v_payable_amount NUMERIC(12, 2);
BEGIN
    -- 1. Authorization check: Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- 2. Verify contractor belongs to the specified company
    PERFORM 1 FROM contractors WHERE id = p_contractor_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contractor % does not belong to company %', p_contractor_id, p_company_id;
    END IF;

    -- 3. If account_id provided and payment is made, verify cash/bank account belongs to company
    IF p_account_id IS NOT NULL AND COALESCE(p_current_payment, 0) > 0 THEN
        PERFORM 1 FROM cash_bank_accounts WHERE id = p_account_id AND company_id = p_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %', p_account_id, p_company_id;
        END IF;
    END IF;

    -- 4. Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_work_id FROM contractor_work_entries
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            SELECT id INTO v_payment_id FROM contractor_payments
            WHERE company_id = p_company_id AND contractor_work_id = v_work_id;
            RETURN jsonb_build_object('success', true, 'work_id', v_work_id, 'payment_id', v_payment_id, 'idempotent', true);
        END IF;
    END IF;

    -- 5. Amount validation
    IF p_total_contract_amount <= 0 THEN
        RAISE EXCEPTION 'Total contract amount must be greater than zero';
    END IF;

    IF ROUND(p_remaining_balance, 2) <> ROUND(p_total_contract_amount - COALESCE(p_advance_paid, 0) - COALESCE(p_previous_payments, 0) - COALESCE(p_current_payment, 0), 2) THEN
        RAISE EXCEPTION 'Remaining balance % does not match calculated balance (total % - advance % - prev % - current %)',
            p_remaining_balance, p_total_contract_amount, COALESCE(p_advance_paid, 0), COALESCE(p_previous_payments, 0), COALESCE(p_current_payment, 0);
    END IF;

    v_status := CASE
        WHEN p_remaining_balance <= 0.01 AND (COALESCE(p_advance_paid, 0) + COALESCE(p_previous_payments, 0) + COALESCE(p_current_payment, 0)) > 0 THEN 'PAID'
        WHEN (COALESCE(p_advance_paid, 0) + COALESCE(p_previous_payments, 0) + COALESCE(p_current_payment, 0)) > 0 THEN 'PARTIALLY_PAID'
        ELSE 'PENDING'
    END;

    -- 6. Insert contractor work entry
    INSERT INTO contractor_work_entries (
        company_id, contractor_id, contractor_name, work_date, work_description,
        worker_count, quantity_completed, agreed_rate, total_contract_amount,
        advance_paid, previous_payments, current_payment, remaining_balance,
        payment_mode, account_id, status, idempotency_key, notes, created_by
    ) VALUES (
        p_company_id, p_contractor_id, p_contractor_name, p_work_date, p_work_description,
        p_worker_count, p_quantity_completed, p_agreed_rate, p_total_contract_amount,
        COALESCE(p_advance_paid, 0), COALESCE(p_previous_payments, 0), COALESCE(p_current_payment, 0),
        p_remaining_balance, p_payment_mode, p_account_id, v_status, p_idempotency_key, p_notes, p_actor
    ) RETURNING id INTO v_work_id;

    -- 7. Post Accrual Journal Entry: Dr 5030 Subcontracting, Cr 1070 Advances (if any), Cr 2010 Payables
    INSERT INTO journal_entries (
        company_id, entry_no, entry_date, source_type, source_id,
        reference_no, narration, total_debit, total_credit, is_posted
    ) VALUES (
        p_company_id, 'JV-CWRK-' || SUBSTRING(v_work_id::TEXT FROM 1 FOR 8),
        p_work_date, 'EXPENSE', v_work_id::TEXT,
        'CWRK-' || p_work_date::TEXT, 'Contractor work: ' || p_contractor_name || ' (' || SUBSTRING(p_work_description FROM 1 FOR 40) || ')',
        p_total_contract_amount, p_total_contract_amount, true
    ) RETURNING id INTO v_accrual_journal_id;

    -- Update work entry with accrual journal ID
    UPDATE contractor_work_entries SET accrual_journal_id = v_accrual_journal_id WHERE id = v_work_id;

    -- Dr 5030 Subcontracting & Job Work Direct Expense
    INSERT INTO journal_lines (
        journal_id, account_code, account_name, debit, credit, line_narration
    ) VALUES (
        v_accrual_journal_id, '5030', 'Subcontracting & Job Work Direct Expense', p_total_contract_amount, 0.00,
        'Contract work: ' || p_contractor_name || ' (' || SUBSTRING(p_work_description FROM 1 FOR 40) || ')'
    );

    -- Cr 1070 Advance adjusted (if any)
    IF COALESCE(p_advance_paid, 0) > 0 THEN
        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_accrual_journal_id, '1070', 'Contractor & Labour Advances', 0.00, p_advance_paid,
            'Advance adjusted for: ' || p_contractor_name
        );
    END IF;

    -- Cr 2010 Payables (total - advance)
    v_payable_amount := p_total_contract_amount - COALESCE(p_advance_paid, 0);
    IF v_payable_amount > 0 THEN
        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_accrual_journal_id, '2010', 'Contractor & Subcontractor Payables', 0.00, v_payable_amount,
            'Payable to contractor: ' || p_contractor_name
        );
    END IF;

    -- 8. If immediate payment was made, post payment record, account tx, and payment journal
    IF COALESCE(p_current_payment, 0) > 0 THEN
        v_voucher_no := 'CPAY-' || p_work_date::TEXT || '-' || SUBSTRING(v_work_id::TEXT FROM 1 FOR 6);
        v_account_code := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN '1020' ELSE '1010' END;
        v_account_name := CASE WHEN UPPER(p_payment_mode) = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;

        INSERT INTO contractor_payments (
            company_id, contractor_id, contractor_work_id, contractor_name,
            payment_date, amount, payment_mode, account_id, voucher_no, idempotency_key, created_by
        ) VALUES (
            p_company_id, p_contractor_id, v_work_id, p_contractor_name,
            p_work_date, p_current_payment, p_payment_mode, p_account_id,
            v_voucher_no, p_idempotency_key, p_actor
        ) RETURNING id INTO v_payment_id;

        IF p_account_id IS NOT NULL THEN
            INSERT INTO account_transactions (
                account_id, transaction_date, transaction_type, direction,
                amount, reference_no, description, created_at
            ) VALUES (
                p_account_id, p_work_date, 'OPERATING_EXPENSE', 'CREDIT',
                p_current_payment, v_voucher_no,
                'Contractor Work Payment: ' || p_contractor_name || ' (' || SUBSTRING(p_work_description FROM 1 FOR 30) || ')',
                NOW()
            );
        END IF;

        INSERT INTO journal_entries (
            company_id, entry_no, entry_date, source_type, source_id,
            reference_no, narration, total_debit, total_credit, is_posted
        ) VALUES (
            p_company_id, 'JV-CPAY-' || v_voucher_no, p_work_date, 'PAYMENT', v_work_id::TEXT,
            v_voucher_no, 'Immediate contractor payment for ' || p_contractor_name,
            p_current_payment, p_current_payment, true
        ) RETURNING id INTO v_pay_journal_id;

        -- Dr 2010 Liability reduction
        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_pay_journal_id, '2010', 'Contractor & Subcontractor Payables', p_current_payment, 0.00,
            'Contractor liability reduction: ' || p_contractor_name
        );

        -- Cr Cash / Bank
        INSERT INTO journal_lines (
            journal_id, account_code, account_name, debit, credit, line_narration
        ) VALUES (
            v_pay_journal_id, v_account_code, v_account_name, 0.00, p_current_payment,
            'Paid via ' || p_payment_mode
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'work_id', v_work_id,
        'accrual_journal_id', v_accrual_journal_id,
        'payment_id', v_payment_id,
        'payment_journal_id', v_pay_journal_id,
        'remaining_balance', p_remaining_balance,
        'status', v_status
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. Explicit RPC Function Permissions
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION fn_post_contractor_payment_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_labour_payment_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_salary_disbursement_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_issue_employee_advance_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_salary_accrual_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_daily_labour_accrual_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_contractor_work_atomic TO authenticated, service_role;

