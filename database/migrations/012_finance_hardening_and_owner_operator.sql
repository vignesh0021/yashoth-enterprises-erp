-- ============================================================================
-- YASHOTH ENTERPRISES ERP — FINANCE HARDENING & OWNER-OPERATOR SCHEMA
-- Migration: 012_finance_hardening_and_owner_operator.sql
-- Safe, additive migration:
--   1. Adds COA accounts 1025, 2015, 2150, 3030 (if absent).
--   2. Adds idempotency_key, closed_period_before, payment status/beneficiary,
--      and owner-operator person/trip/authorization tables with RLS.
--   3. Adds uq_journal_active_source partial unique index.
--   4. Adds atomic PostgreSQL RPCs for expenses, unpaid expense settlement,
--      expense reversal, account_transactions (cashflow/capital/drawings),
--      and payment status-guarded settlement.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Closed-period protection on companies
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS closed_period_before DATE;

-- 2. Extend parties type check to allow TRANSPORTER
DO $$
BEGIN
    ALTER TABLE parties DROP CONSTRAINT IF EXISTS parties_party_type_check;
    ALTER TABLE parties ADD CONSTRAINT parties_party_type_check
        CHECK (party_type IN ('SUPPLIER', 'CUSTOMER', 'BOTH', 'TRANSPORTER'));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 3. Extend chart_of_accounts with 1025, 2015, 2150, 3030 per company
INSERT INTO chart_of_accounts (company_id, account_code, account_name, category, normal_balance, is_system)
SELECT c.id, v.account_code, v.account_name, v.category, v.normal_balance, true
FROM companies c
CROSS JOIN (VALUES
    ('1025', 'UPI / Digital Clearing (Pending Settlement)', 'ASSET', 'DEBIT'),
    ('2015', 'Transporter & Freight Payable', 'LIABILITY', 'CREDIT'),
    ('2150', 'Owner Reimbursement Payable (Due to Owner)', 'LIABILITY', 'CREDIT'),
    ('3030', 'Owner Drawings', 'EQUITY', 'DEBIT')
) AS v(account_code, account_name, category, normal_balance)
ON CONFLICT (company_id, account_code) DO NOTHING;

-- 4. Journal active-source uniqueness (prevents duplicate active journals)
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_active_source
    ON journal_entries(company_id, source_type, source_id)
    WHERE status = 'POSTED' AND source_id IS NOT NULL;

-- 5. Additive columns on expenses & account_transactions & payments
ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS paid_by_type VARCHAR(20) NOT NULL DEFAULT 'COMPANY'
    CHECK (paid_by_type IN ('COMPANY', 'OWNER_PERSONAL'));
ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS trip_id UUID;
ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS account_transaction_id UUID;
ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_company_idempotency
    ON expenses(company_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE IF EXISTS account_transactions ADD COLUMN IF NOT EXISTS expense_id UUID;
ALTER TABLE IF EXISTS account_transactions ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
ALTER TABLE IF EXISTS account_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);
ALTER TABLE IF EXISTS account_transactions ADD COLUMN IF NOT EXISTS external_tx_ref VARCHAR(120);
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_tx_company_idempotency
    ON account_transactions(company_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_tx_external_ref
    ON account_transactions(company_id, account_id, external_tx_ref) WHERE external_tx_ref IS NOT NULL;

DO $$
BEGIN
    ALTER TABLE account_transactions DROP CONSTRAINT IF EXISTS account_transactions_transaction_type_check;
    ALTER TABLE account_transactions ADD CONSTRAINT account_transactions_transaction_type_check
        CHECK (transaction_type IN (
            'CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT', 'CONTRA_TRANSFER_IN',
            'CONTRA_TRANSFER_OUT', 'OPERATING_EXPENSE', 'EMPLOYEE_ADVANCE',
            'OWNER_INJECTION', 'OWNER_DRAWING', 'OWNER_LOAN_IN',
            'OWNER_REIMBURSEMENT', 'OPENING_BALANCE', 'ACCOUNT_ADJUSTMENT'
        ));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED'));
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS beneficiary_party_id UUID REFERENCES parties(id);
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS recipient_person_id UUID;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS authorization_id UUID;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_company_idempotency
    ON payments(company_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 6. Owner-Operator Canonical Person, Roles, Trips & Payment Authorizations
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    is_owner BOOLEAN NOT NULL DEFAULT false,
    payroll_eligible BOOLEAN NOT NULL DEFAULT true,
    linked_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    linked_party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_persons_company ON persons(company_id);

CREATE TABLE IF NOT EXISTS person_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role_type VARCHAR(30) NOT NULL CHECK (role_type IN (
        'OWNER', 'DRIVER', 'SUPPLIER', 'TRANSPORTER', 'VEHICLE_OWNER', 'EMPLOYEE', 'AUTHORIZED_AGENT'
    )),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, person_id, role_type)
);

ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS owner_party_id UUID REFERENCES parties(id);
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS transporter_party_id UUID REFERENCES parties(id);
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS driver_person_id UUID REFERENCES persons(id);
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS is_owner_driven BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS vehicle_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    trip_no VARCHAR(50) NOT NULL,
    trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    driver_person_id UUID REFERENCES persons(id),
    is_owner_driven BOOLEAN NOT NULL DEFAULT false,
    transporter_party_id UUID REFERENCES parties(id),
    freight_payable_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
        CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SETTLED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, trip_no)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_trips_company_date ON vehicle_trips(company_id, trip_date);

CREATE TABLE IF NOT EXISTS trip_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES vehicle_trips(id) ON DELETE CASCADE,
    stop_sequence INT NOT NULL CHECK (stop_sequence > 0),
    supplier_party_id UUID REFERENCES parties(id),
    location_name TEXT NOT NULL,
    weighment_id UUID REFERENCES weighments(id),
    purchase_header_id UUID REFERENCES purchase_headers(id),
    material_summary TEXT,
    UNIQUE (trip_id, stop_sequence)
);

ALTER TABLE IF EXISTS purchase_headers ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES vehicle_trips(id);

CREATE TABLE IF NOT EXISTS payment_authorizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    beneficiary_party_id UUID NOT NULL REFERENCES parties(id),
    authorized_recipient_person_id UUID NOT NULL REFERENCES persons(id),
    max_amount NUMERIC(14, 2) CHECK (max_amount IS NULL OR max_amount > 0),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'USED', 'REVOKED', 'EXPIRED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_authorizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS persons_tenant_policy ON persons;
CREATE POLICY persons_tenant_policy ON persons FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS person_roles_tenant_policy ON person_roles;
CREATE POLICY person_roles_tenant_policy ON person_roles FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS vehicle_trips_tenant_policy ON vehicle_trips;
CREATE POLICY vehicle_trips_tenant_policy ON vehicle_trips FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS trip_stops_tenant_policy ON trip_stops;
CREATE POLICY trip_stops_tenant_policy ON trip_stops FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS payment_authorizations_tenant_policy ON payment_authorizations;
CREATE POLICY payment_authorizations_tenant_policy ON payment_authorizations FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- 7. Helper: Closed-Period Check
CREATE OR REPLACE FUNCTION fn_assert_period_open(p_company_id UUID, p_tx_date DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_closed DATE;
BEGIN
    SELECT closed_period_before INTO v_closed FROM companies WHERE id = p_company_id;
    IF v_closed IS NOT NULL AND p_tx_date <= v_closed THEN
        RAISE EXCEPTION 'Accounting period is closed through %. Cannot post date %', v_closed, p_tx_date;
    END IF;
END;
$$;

-- 8. Atomic RPC: Post Account Transaction (Cashflow / Capital / Drawings / Opening)
CREATE OR REPLACE FUNCTION fn_post_account_transaction_atomic(
    p_company_id UUID,
    p_account_id UUID,
    p_tx_date DATE,
    p_tx_type VARCHAR,
    p_direction VARCHAR,
    p_amount NUMERIC,
    p_description TEXT,
    p_reference_no VARCHAR DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL,
    p_actor VARCHAR DEFAULT 'system'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_existing_tx_id UUID;
    v_existing_je_id UUID;
    v_acc RECORD;
    v_tx_id UUID := uuid_generate_v4();
    v_je_id UUID := uuid_generate_v4();
    v_cash_code VARCHAR;
    v_cash_name VARCHAR;
    v_counter_code VARCHAR;
    v_counter_name VARCHAR;
    v_entry_no VARCHAR;
    v_source_type VARCHAR;
BEGIN
    IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'accounts_operator') THEN
        RAISE EXCEPTION 'Unauthorized role for posting financial transactions';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Transaction amount must be greater than zero';
    END IF;

    PERFORM fn_assert_period_open(p_company_id, p_tx_date);

    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, journal_entry_id INTO v_existing_tx_id, v_existing_je_id
        FROM account_transactions
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF v_existing_tx_id IS NOT NULL THEN
            RETURN jsonb_build_object('status', 'IDEMPOTENT_REPLAY', 'transaction_id', v_existing_tx_id, 'journal_id', v_existing_je_id);
        END IF;
    END IF;

    SELECT * INTO v_acc FROM cash_bank_accounts
    WHERE id = p_account_id AND company_id = p_company_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account % not found in company %', p_account_id, p_company_id;
    END IF;
    IF v_acc.is_active = false THEN
        RAISE EXCEPTION 'Account "%" is inactive and cannot accept transactions', v_acc.account_name;
    END IF;

    IF p_direction = 'CREDIT' AND v_acc.account_type = 'CASH' AND (COALESCE(v_acc.current_balance, 0) - p_amount) < -0.01 THEN
        RAISE EXCEPTION 'Insufficient cash balance in "%"', v_acc.account_name;
    END IF;

    v_cash_code := CASE WHEN v_acc.account_type = 'BANK' THEN '1020' ELSE '1010' END;
    v_cash_name := CASE WHEN v_acc.account_type = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;

    CASE p_tx_type
        WHEN 'OWNER_INJECTION', 'OPENING_BALANCE' THEN
            v_counter_code := '3010'; v_counter_name := 'Proprietor / Partners Capital';
        WHEN 'OWNER_DRAWING' THEN
            v_counter_code := '3030'; v_counter_name := 'Owner Drawings';
        WHEN 'OWNER_LOAN_IN', 'OWNER_REIMBURSEMENT' THEN
            v_counter_code := '2150'; v_counter_name := 'Owner Reimbursement Payable (Due to Owner)';
        WHEN 'CUSTOMER_RECEIPT' THEN
            v_counter_code := '1100'; v_counter_name := 'Sundry Debtors (Customers A/R)';
        WHEN 'SUPPLIER_PAYMENT' THEN
            v_counter_code := '2010'; v_counter_name := 'Sundry Creditors (Suppliers A/P)';
        ELSE
            v_counter_code := '5090'; v_counter_name := 'Round-Off & Decimal Variance';
    END CASE;

    v_source_type := CASE WHEN p_tx_type = 'OPENING_BALANCE' THEN 'OPENING_BALANCE' ELSE 'MANUAL_JOURNAL' END;
    v_entry_no := 'JV-CF-' || UPPER(SUBSTRING(REPLACE(v_tx_id::TEXT, '-', ''), 1, 10));

    INSERT INTO journal_entries (
        id, company_id, entry_no, entry_date, source_type, source_id, reference_no,
        narration, total_debit, total_credit, is_posted, status
    ) VALUES (
        v_je_id, p_company_id, v_entry_no, p_tx_date, v_source_type, v_tx_id::TEXT,
        COALESCE(p_reference_no, v_entry_no), p_tx_type || ': ' || p_description,
        p_amount, p_amount, true, 'POSTED'
    );

    IF p_direction = 'DEBIT' THEN
        INSERT INTO journal_lines (journal_id, account_code, account_name, debit, credit, line_narration) VALUES
            (v_je_id, v_cash_code, v_cash_name, p_amount, 0, p_description),
            (v_je_id, v_counter_code, v_counter_name, 0, p_amount, p_description);
    ELSE
        INSERT INTO journal_lines (journal_id, account_code, account_name, debit, credit, line_narration) VALUES
            (v_je_id, v_counter_code, v_counter_name, p_amount, 0, p_description),
            (v_je_id, v_cash_code, v_cash_name, 0, p_amount, p_description);
    END IF;

    INSERT INTO account_transactions (
        id, company_id, account_id, transaction_date, transaction_type, direction,
        amount, reference_no, description, journal_entry_id, idempotency_key
    ) VALUES (
        v_tx_id, p_company_id, p_account_id, p_tx_date, p_tx_type, p_direction,
        p_amount, p_reference_no, p_description, v_je_id, p_idempotency_key
    );

    INSERT INTO audit_logs (company_id, action_type, entity_type, entity_id, new_value, performed_by)
    VALUES (p_company_id, 'POST_ACCOUNT_TX', 'ACCOUNT_TRANSACTION', v_tx_id::TEXT,
            jsonb_build_object('tx_type', p_tx_type, 'amount', p_amount, 'journal_id', v_je_id), p_actor);

    RETURN jsonb_build_object('status', 'POSTED', 'transaction_id', v_tx_id, 'journal_id', v_je_id);
END;
$$;

-- 9. Atomic RPC: Post Expense (PAID / UNPAID / OWNER_PERSONAL)
CREATE OR REPLACE FUNCTION fn_post_expense_atomic(
    p_company_id UUID,
    p_voucher_no VARCHAR,
    p_expense_date DATE,
    p_category VARCHAR,
    p_amount NUMERIC,
    p_account_id UUID,
    p_payment_mode VARCHAR,
    p_paid_by_type VARCHAR DEFAULT 'COMPANY',
    p_paid_to VARCHAR DEFAULT 'Vendor',
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL,
    p_actor VARCHAR DEFAULT 'system'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_existing_id UUID;
    v_exp_id UUID := uuid_generate_v4();
    v_tx_id UUID := NULL;
    v_je_id UUID := uuid_generate_v4();
    v_acc RECORD;
    v_is_unpaid BOOLEAN;
    v_is_owner_personal BOOLEAN;
    v_exp_code VARCHAR := '5040';
    v_exp_name VARCHAR := 'Yard Utilities & Maintenance';
    v_cr_code VARCHAR;
    v_cr_name VARCHAR;
    v_entry_no VARCHAR;
BEGIN
    IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'accounts_operator', 'supervisor') THEN
        RAISE EXCEPTION 'Unauthorized role for posting expenses';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero';
    END IF;
    PERFORM fn_assert_period_open(p_company_id, p_expense_date);

    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id FROM expenses WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object('status', 'IDEMPOTENT_REPLAY', 'expense_id', v_existing_id);
        END IF;
    END IF;

    v_is_owner_personal := (p_paid_by_type = 'OWNER_PERSONAL');
    v_is_unpaid := (p_payment_mode = 'UNPAID') AND NOT v_is_owner_personal;

    IF NOT v_is_unpaid AND NOT v_is_owner_personal THEN
        SELECT * INTO v_acc FROM cash_bank_accounts
        WHERE id = p_account_id AND company_id = p_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Payment account not found'; END IF;
        IF v_acc.is_active = false THEN RAISE EXCEPTION 'Selected payment account is inactive'; END IF;
        IF v_acc.account_type = 'CASH' AND (COALESCE(v_acc.current_balance, 0) - p_amount) < -0.01 THEN
            RAISE EXCEPTION 'Insufficient cash balance in "%"', v_acc.account_name;
        END IF;
        v_cr_code := CASE WHEN v_acc.account_type = 'BANK' THEN '1020' ELSE '1010' END;
        v_cr_name := CASE WHEN v_acc.account_type = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;
    ELSIF v_is_owner_personal THEN
        v_cr_code := '2150'; v_cr_name := 'Owner Reimbursement Payable (Due to Owner)';
    ELSE
        v_cr_code := '2020'; v_cr_name := 'Unpaid Operational Expenses Payable';
    END IF;

    IF LOWER(p_category) ~ 'fuel|diesel' THEN v_exp_code := '5060'; v_exp_name := 'Vehicle Running & Diesel Cost';
    ELSIF LOWER(p_category) ~ 'labour|wage|labor' THEN v_exp_code := '5020'; v_exp_name := 'Demolition Direct Labor & Cutting';
    ELSIF LOWER(p_category) ~ 'loading|unloading|transport|freight|rent|crane' THEN v_exp_code := '5030'; v_exp_name := 'Freight, Haulage & Crane Charges';
    ELSIF LOWER(p_category) ~ 'food|tea|water|office' THEN v_exp_code := '5070'; v_exp_name := 'Office, Tea & Food Expenses';
    END IF;

    v_entry_no := 'JV-EXP-' || UPPER(REGEXP_REPLACE(p_voucher_no, '[^A-Za-z0-9]', '', 'g'));

    INSERT INTO journal_entries (
        id, company_id, entry_no, entry_date, source_type, source_id, reference_no,
        narration, total_debit, total_credit, is_posted, status
    ) VALUES (
        v_je_id, p_company_id, v_entry_no, p_expense_date, 'EXPENSE', v_exp_id::TEXT,
        p_voucher_no, 'Expense ' || p_voucher_no || ': ' || p_category,
        p_amount, p_amount, true, 'POSTED'
    );

    INSERT INTO journal_lines (journal_id, account_code, account_name, debit, credit, line_narration) VALUES
        (v_je_id, v_exp_code, v_exp_name, p_amount, 0, p_category || ' - ' || p_paid_to),
        (v_je_id, v_cr_code, v_cr_name, 0, p_amount, p_paid_to);

    IF NOT v_is_unpaid AND NOT v_is_owner_personal THEN
        v_tx_id := uuid_generate_v4();
        INSERT INTO account_transactions (
            id, company_id, account_id, transaction_date, transaction_type, direction,
            amount, reference_no, description, expense_id, journal_entry_id
        ) VALUES (
            v_tx_id, p_company_id, p_account_id, p_expense_date, 'OPERATING_EXPENSE', 'CREDIT',
            p_amount, p_voucher_no, 'Expense: ' || p_category || ' - ' || p_paid_to, v_exp_id, v_je_id
        );
    END IF;

    INSERT INTO expenses (
        id, company_id, voucher_no, expense_date, category, amount, account_id,
        payment_mode, paid_by_type, status, paid_to, notes,
        account_transaction_id, journal_entry_id, idempotency_key, entered_by, created_by
    ) VALUES (
        v_exp_id, p_company_id, p_voucher_no, p_expense_date, p_category, p_amount,
        CASE WHEN v_is_unpaid OR v_is_owner_personal THEN NULL ELSE p_account_id END,
        p_payment_mode, p_paid_by_type, CASE WHEN v_is_unpaid THEN 'UNPAID' ELSE 'PAID' END,
        p_paid_to, p_notes, v_tx_id, v_je_id, p_idempotency_key, p_actor, p_actor
    );

    RETURN jsonb_build_object('status', 'POSTED', 'expense_id', v_exp_id, 'transaction_id', v_tx_id, 'journal_id', v_je_id);
END;
$$;

-- 10. Atomic RPC: Pay Unpaid Expense (Clears 2020 Payable -> 1010/1020 Cash/Bank; FOR UPDATE lock)
CREATE OR REPLACE FUNCTION fn_pay_unpaid_expense_atomic(
    p_company_id UUID,
    p_expense_id UUID,
    p_account_id UUID,
    p_payment_mode VARCHAR,
    p_actor VARCHAR DEFAULT 'system'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_exp RECORD;
    v_acc RECORD;
    v_tx_id UUID := uuid_generate_v4();
    v_je_id UUID := uuid_generate_v4();
    v_cr_code VARCHAR;
    v_cr_name VARCHAR;
    v_entry_no VARCHAR;
BEGIN
    IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'accounts_operator') THEN
        RAISE EXCEPTION 'Unauthorized role for settling unpaid expenses';
    END IF;

    SELECT * INTO v_exp FROM expenses
    WHERE id = p_expense_id AND company_id = p_company_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Expense % not found', p_expense_id; END IF;
    IF v_exp.status <> 'UNPAID' THEN
        RAISE EXCEPTION 'Expense % is already % (double settlement blocked)', v_exp.voucher_no, v_exp.status;
    END IF;

    PERFORM fn_assert_period_open(p_company_id, CURRENT_DATE);

    SELECT * INTO v_acc FROM cash_bank_accounts
    WHERE id = p_account_id AND company_id = p_company_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment account not found'; END IF;
    IF v_acc.is_active = false THEN RAISE EXCEPTION 'Selected payment account is inactive'; END IF;
    IF v_acc.account_type = 'CASH' AND (COALESCE(v_acc.current_balance, 0) - v_exp.amount) < -0.01 THEN
        RAISE EXCEPTION 'Insufficient cash balance in "%"', v_acc.account_name;
    END IF;

    v_cr_code := CASE WHEN v_acc.account_type = 'BANK' THEN '1020' ELSE '1010' END;
    v_cr_name := CASE WHEN v_acc.account_type = 'BANK' THEN 'Bank Accounts (Current/OD)' ELSE 'Cash on Hand' END;
    v_entry_no := 'JV-CLR-' || UPPER(REGEXP_REPLACE(v_exp.voucher_no, '[^A-Za-z0-9]', '', 'g'));

    INSERT INTO journal_entries (
        id, company_id, entry_no, entry_date, source_type, source_id, reference_no,
        narration, total_debit, total_credit, is_posted, status
    ) VALUES (
        v_je_id, p_company_id, v_entry_no, CURRENT_DATE, 'PAYMENT', v_exp.id::TEXT,
        v_exp.voucher_no, 'Pay accrued expense ' || v_exp.voucher_no,
        v_exp.amount, v_exp.amount, true, 'POSTED'
    );

    INSERT INTO journal_lines (journal_id, account_code, account_name, debit, credit, line_narration) VALUES
        (v_je_id, '2020', 'Unpaid Operational Expenses Payable', v_exp.amount, 0, 'Clear payable ' || v_exp.voucher_no),
        (v_je_id, v_cr_code, v_cr_name, 0, v_exp.amount, v_exp.paid_to);

    INSERT INTO account_transactions (
        id, company_id, account_id, transaction_date, transaction_type, direction,
        amount, reference_no, description, expense_id, journal_entry_id
    ) VALUES (
        v_tx_id, p_company_id, p_account_id, CURRENT_DATE, 'OPERATING_EXPENSE', 'CREDIT',
        v_exp.amount, v_exp.voucher_no, 'Payment for unpaid expense: ' || v_exp.category || ' - ' || v_exp.paid_to,
        v_exp.id, v_je_id
    );

    UPDATE expenses
    SET status = 'PAID', payment_mode = p_payment_mode, account_id = p_account_id,
        account_transaction_id = v_tx_id
    WHERE id = v_exp.id;

    RETURN jsonb_build_object('status', 'PAID', 'expense_id', v_exp.id, 'transaction_id', v_tx_id, 'journal_id', v_je_id);
END;
$$;

-- 11. Atomic RPC: Reverse Expense (Marks REVERSED, refunds account if PAID, posts reversing journal)
CREATE OR REPLACE FUNCTION fn_reverse_expense_atomic(
    p_company_id UUID,
    p_expense_id UUID,
    p_reason TEXT,
    p_actor VARCHAR DEFAULT 'system'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_exp RECORD;
    v_tx_id UUID := NULL;
    v_rev_je_id UUID;
    v_orig_je RECORD;
BEGIN
    IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'accounts_operator') THEN
        RAISE EXCEPTION 'Unauthorized role for reversing expenses';
    END IF;

    SELECT * INTO v_exp FROM expenses
    WHERE id = p_expense_id AND company_id = p_company_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Expense % not found', p_expense_id; END IF;
    IF v_exp.status = 'REVERSED' THEN
        RAISE EXCEPTION 'Expense % is already REVERSED', v_exp.voucher_no;
    END IF;

    PERFORM fn_assert_period_open(p_company_id, CURRENT_DATE);

    IF v_exp.status = 'PAID' AND v_exp.account_id IS NOT NULL THEN
        v_tx_id := uuid_generate_v4();
        INSERT INTO account_transactions (
            id, company_id, account_id, transaction_date, transaction_type, direction,
            amount, reference_no, description, expense_id
        ) VALUES (
            v_tx_id, p_company_id, v_exp.account_id, CURRENT_DATE, 'ACCOUNT_ADJUSTMENT', 'DEBIT',
            v_exp.amount, 'REV-' || v_exp.voucher_no, 'Reversal of expense ' || v_exp.voucher_no || ': ' || COALESCE(p_reason, ''),
            v_exp.id
        );
    END IF;

    FOR v_orig_je IN
        SELECT * FROM journal_entries
        WHERE company_id = p_company_id AND source_id = v_exp.id::TEXT AND status = 'POSTED'
    LOOP
        v_rev_je_id := uuid_generate_v4();
        INSERT INTO journal_entries (
            id, company_id, entry_no, entry_date, source_type, source_id, reference_no,
            narration, total_debit, total_credit, is_posted, status
        ) VALUES (
            v_rev_je_id, p_company_id, 'REV-' || v_orig_je.entry_no, CURRENT_DATE,
            v_orig_je.source_type, 'REV-' || v_orig_je.id::TEXT, 'REV-' || COALESCE(v_orig_je.reference_no, v_exp.voucher_no),
            'Reversal: ' || COALESCE(p_reason, v_orig_je.narration),
            v_orig_je.total_credit, v_orig_je.total_debit, true, 'POSTED'
        );

        INSERT INTO journal_lines (journal_id, account_code, account_name, party_id, debit, credit, line_narration)
        SELECT v_rev_je_id, account_code, account_name, party_id, credit, debit, 'Reversal: ' || COALESCE(line_narration, '')
        FROM journal_lines WHERE journal_id = v_orig_je.id;

        UPDATE journal_entries SET status = 'REVERSED' WHERE id = v_orig_je.id;
    END LOOP;

    UPDATE expenses
    SET status = 'REVERSED', reversal_reason = p_reason
    WHERE id = v_exp.id;

    INSERT INTO audit_logs (company_id, action_type, entity_type, entity_id, new_value, performed_by)
    VALUES (p_company_id, 'REVERSE_EXPENSE', 'EXPENSE', v_exp.id::TEXT,
            jsonb_build_object('reason', p_reason, 'refund_tx_id', v_tx_id), p_actor);

    RETURN jsonb_build_object('status', 'REVERSED', 'expense_id', v_exp.id, 'refund_transaction_id', v_tx_id);
END;
$$;
