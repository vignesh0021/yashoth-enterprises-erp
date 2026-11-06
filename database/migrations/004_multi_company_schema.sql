-- Yasoth Enterprises — Production Scrap ERP
-- Migration 004: Multi-Company Master Architecture & Operational Table Association
-- Creates canonical companies master, adds company_id FK to all operational tables,
-- migrates existing Yashoth Enterprises baseline data, and enforces tenant scoping.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Canonical Companies Master Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    gstin VARCHAR(15),
    pan VARCHAR(10),
    cin VARCHAR(21),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_name VARCHAR(100) NOT NULL DEFAULT 'Tamil Nadu',
    state_code VARCHAR(10) NOT NULL DEFAULT '33',
    pincode VARCHAR(20) NOT NULL,
    bank_name VARCHAR(255),
    bank_account_no VARCHAR(50),
    bank_branch VARCHAR(100),
    bank_ifsc VARCHAR(50),
    invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'YE/',
    purchase_prefix VARCHAR(20) NOT NULL DEFAULT 'PO/',
    quotation_prefix VARCHAR(20) NOT NULL DEFAULT 'QT/',
    default_base_unit VARCHAR(20) NOT NULL DEFAULT 'KG',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);

-- 2. Seed Baseline Yashoth Enterprises as Primary Default Company (COMPANY_001)
INSERT INTO companies (
    id,
    code,
    name,
    legal_name,
    trade_name,
    gstin,
    pan,
    email,
    phone,
    address_line1,
    address_line2,
    city,
    state_name,
    state_code,
    pincode,
    bank_name,
    bank_account_no,
    bank_branch,
    bank_ifsc,
    invoice_prefix,
    purchase_prefix,
    quotation_prefix,
    default_base_unit,
    currency,
    is_active,
    is_default
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'YE-MAIN',
    'Yashoth Enterprises',
    'YASHOTH ENTERPRISES',
    'Yashoth Scrap Demolition & Trading',
    '33AXVPN9382L1ZF',
    'AXVPN9382L',
    'yashothenterprises2022@gmail.com',
    '+91 94440 12345',
    'NO.128/40, Dr.AMBEDKAR STREET',
    'PERUVAYAL JUNCTION, KAVARAPETTAI',
    'GUMMIDIPOODI, Tiruvallur',
    'Tamil Nadu',
    '33',
    '601206',
    'CITY UNION BANK',
    '510909010195638',
    'PONNERI',
    'CIUB0000439',
    'YE/',
    'PO/',
    'QT/',
    'KG',
    'INR',
    true,
    true
) ON CONFLICT (code) DO UPDATE SET
    legal_name = EXCLUDED.legal_name,
    gstin = EXCLUDED.gstin,
    bank_account_no = EXCLUDED.bank_account_no,
    updated_at = CURRENT_TIMESTAMP;

-- 3. Add company_id and foreign key constraint to all operational tables
DO $$
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'yards',
        'materials',
        'parties',
        'vehicles',
        'employees',
        'attendance_entries',
        'cash_bank_accounts',
        'weighments',
        'collection_jobs',
        'purchase_headers',
        'inventory_lots',
        'stock_movements',
        'sales_headers',
        'invoices',
        'payments',
        'account_transactions',
        'expenses',
        'stock_counts'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        -- Check if table exists before adding column
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id UUID;', tbl);
            
            -- Migrate any existing records without company_id to Yashoth Enterprises
            EXECUTE format('UPDATE %I SET company_id = %L WHERE company_id IS NULL;', tbl, 'a0000000-0000-0000-0000-000000000001');
            
            -- Add foreign key constraint if not present
            BEGIN
                EXECUTE format('ALTER TABLE %I ADD CONSTRAINT fk_%s_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;', tbl, tbl);
            EXCEPTION WHEN duplicate_object THEN
                -- Constraint already exists
                NULL;
            END;

            -- Create company_id index for multi-tenant query acceleration
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_company_id ON %I(company_id);', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- 4. Connect company_memberships FK to companies(id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_memberships') THEN
        BEGIN
            ALTER TABLE company_memberships
                ADD CONSTRAINT fk_company_memberships_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

-- 5. Updated RLS Isolation Helper View
CREATE OR REPLACE VIEW v_active_company_summary AS
SELECT 
    c.id AS company_id,
    c.code,
    c.name,
    c.legal_name,
    c.gstin,
    c.city,
    c.is_active,
    (SELECT COUNT(*) FROM parties p WHERE p.company_id = c.id) AS parties_count,
    (SELECT COUNT(*) FROM yards y WHERE y.company_id = c.id) AS yards_count,
    (SELECT COUNT(*) FROM purchase_headers ph WHERE ph.company_id = c.id) AS purchases_count,
    (SELECT COUNT(*) FROM sales_headers sh WHERE sh.company_id = c.id) AS sales_count,
    (SELECT COUNT(*) FROM invoices inv WHERE inv.company_id = c.id) AS invoices_count
FROM companies c;

-- Rollback instructions (Reversibility):
-- DROP VIEW IF EXISTS v_active_company_summary;
-- (Remove foreign keys and company_id columns from tables if reverting)
-- DROP TABLE IF EXISTS companies;
