-- Yasoth Enterprises — Production Scrap ERP
-- Migration 005: Commercial Documents & Double-Entry Accounting Architecture
-- Establishes Chart of Accounts, General Ledger Journals, Document Registers, and Financial Statement Views

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Chart of Accounts Master
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
    sub_category VARCHAR(100),
    normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_coa_company_code ON chart_of_accounts(company_id, account_code);
CREATE INDEX IF NOT EXISTS idx_coa_category ON chart_of_accounts(category);

-- 2. Commercial Documents Master Table (Quotations, Proformas, Invoices, Credit/Debit Notes, Receipts)
CREATE TABLE IF NOT EXISTS commercial_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'SALES_INVOICE',
        'PURCHASE_INVOICE',
        'QUOTATION',
        'PROFORMA_INVOICE',
        'CREDIT_NOTE',
        'DEBIT_NOTE',
        'PAYMENT_RECEIPT'
    )),
    document_no VARCHAR(100) NOT NULL,
    document_date DATE NOT NULL,
    due_date DATE,
    reference_no VARCHAR(100),
    original_document_id UUID REFERENCES commercial_documents(id),
    party_id UUID REFERENCES parties(id) ON DELETE RESTRICT,
    party_name VARCHAR(255) NOT NULL,
    party_gstin VARCHAR(20),
    billing_address TEXT,
    shipping_address TEXT,
    place_of_supply VARCHAR(100),
    state_code VARCHAR(10),
    subtotal_taxable NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    cgst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    sgst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    igst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    outstanding_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
    notes TEXT,
    terms_and_conditions TEXT,
    created_by UUID REFERENCES users_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, document_type, document_no)
);

CREATE INDEX IF NOT EXISTS idx_comm_docs_company_type ON commercial_documents(company_id, document_type);
CREATE INDEX IF NOT EXISTS idx_comm_docs_party ON commercial_documents(party_id);
CREATE INDEX IF NOT EXISTS idx_comm_docs_date ON commercial_documents(document_date);

-- 3. Commercial Document Item Lines
CREATE TABLE IF NOT EXISTS commercial_document_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES commercial_documents(id) ON DELETE CASCADE,
    serial_no INT NOT NULL,
    material_id UUID REFERENCES materials(id),
    description TEXT NOT NULL,
    hsn_sac VARCHAR(20) NOT NULL DEFAULT '7204',
    quantity NUMERIC(15,3) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'KG',
    rate NUMERIC(15,2) NOT NULL,
    taxable_value NUMERIC(15,2) NOT NULL,
    gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    gst_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_doc_lines_doc ON commercial_document_lines(document_id);

-- 4. Double-Entry Journal Entries Header
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    entry_no VARCHAR(100) NOT NULL,
    entry_date DATE NOT NULL,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN (
        'SALES_INVOICE',
        'PURCHASE_INVOICE',
        'PAYMENT',
        'CONTRA',
        'EXPENSE',
        'CREDIT_NOTE',
        'DEBIT_NOTE',
        'MANUAL_JOURNAL',
        'OPENING_BALANCE'
    )),
    source_id VARCHAR(100),
    reference_no VARCHAR(100),
    narration TEXT NOT NULL,
    total_debit NUMERIC(15,2) NOT NULL,
    total_credit NUMERIC(15,2) NOT NULL,
    is_posted BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_journal_balanced CHECK (ROUND(total_debit, 2) = ROUND(total_credit, 2)),
    UNIQUE (company_id, entry_no)
);

CREATE INDEX IF NOT EXISTS idx_journal_company_date ON journal_entries(company_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_source ON journal_entries(source_type, source_id);

-- 5. Double-Entry Journal Lines (Debit & Credit Splits)
CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    party_id UUID REFERENCES parties(id),
    debit NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
    credit NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
    line_narration TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_line_nonzero CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_journal ON journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_code);
CREATE INDEX IF NOT EXISTS idx_journal_lines_party ON journal_lines(party_id);

-- 6. Canonical Trial Balance View
CREATE OR REPLACE VIEW v_trial_balance AS
SELECT 
    je.company_id,
    jl.account_code,
    jl.account_name,
    coa.category,
    coa.normal_balance,
    SUM(jl.debit) AS total_debit,
    SUM(jl.credit) AS total_credit,
    CASE 
        WHEN coa.normal_balance = 'DEBIT' THEN (SUM(jl.debit) - SUM(jl.credit))
        ELSE 0
    END AS net_debit_balance,
    CASE 
        WHEN coa.normal_balance = 'CREDIT' THEN (SUM(jl.credit) - SUM(jl.debit))
        ELSE 0
    END AS net_credit_balance
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_id = je.id
LEFT JOIN chart_of_accounts coa ON coa.company_id = je.company_id AND coa.account_code = jl.account_code
WHERE je.is_posted = true
GROUP BY je.company_id, jl.account_code, jl.account_name, coa.category, coa.normal_balance;

-- 7. General Ledger Detail View
CREATE OR REPLACE VIEW v_general_ledger AS
SELECT 
    je.company_id,
    jl.account_code,
    jl.account_name,
    je.entry_date,
    je.entry_no,
    je.source_type,
    je.reference_no,
    COALESCE(jl.line_narration, je.narration) AS narration,
    jl.party_id,
    p.legal_name AS party_name,
    jl.debit,
    jl.credit,
    je.created_at
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_id = je.id
LEFT JOIN parties p ON jl.party_id = p.id
WHERE je.is_posted = true
ORDER BY je.entry_date ASC, je.created_at ASC;

-- Rollback instructions:
-- DROP VIEW IF EXISTS v_general_ledger;
-- DROP VIEW IF EXISTS v_trial_balance;
-- DROP TABLE IF EXISTS journal_lines;
-- DROP TABLE IF EXISTS journal_entries;
-- DROP TABLE IF EXISTS commercial_document_lines;
-- DROP TABLE IF EXISTS commercial_documents;
-- DROP TABLE IF EXISTS chart_of_accounts;
