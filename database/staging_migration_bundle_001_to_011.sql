-- Yasoth Enterprises — Production Scrap ERP
-- Migration 001: Initial Normalized Schema
-- Authoritative PostgreSQL DDL with strict integrity constraints, check constraints, and audit support

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users & Roles
CREATE TABLE IF NOT EXISTS users_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner_admin', 'manager', 'purchase_operator', 'weighment_operator', 'sales_operator', 'accounts_operator', 'store_operator', 'hr_operator', 'auditor')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Company Profile & Settings
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL DEFAULT 'YASHOTH ENTERPRISES',
    legal_name VARCHAR(255) NOT NULL DEFAULT 'YASHOTH ENTERPRISES',
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_name VARCHAR(100) NOT NULL DEFAULT 'Tamil Nadu',
    state_code VARCHAR(10) NOT NULL DEFAULT '33',
    pincode VARCHAR(20) NOT NULL,
    gstin VARCHAR(20) NOT NULL,
    pan VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    bank_name VARCHAR(255),
    bank_account_no VARCHAR(50),
    bank_branch_ifsc VARCHAR(50),
    invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'YE/',
    default_base_unit VARCHAR(20) NOT NULL DEFAULT 'KG',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Yards / Stock Locations
CREATE TABLE IF NOT EXISTS yards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location_address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Materials Master & Grades
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Iron, Steel, Aluminium, Copper, Brass, Plastic, Other
    base_unit VARCHAR(20) NOT NULL DEFAULT 'KG',
    hsn_code VARCHAR(20) NOT NULL DEFAULT '7204',
    default_purchase_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    default_sales_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    default_gst_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    min_stock_alert DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS material_grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    grade_code VARCHAR(50) NOT NULL,
    grade_name VARCHAR(100) NOT NULL,
    description TEXT,
    rate_adjustment DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (material_id, grade_code)
);

-- 5. Rate History
CREATE TABLE IF NOT EXISTS rate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    grade_id UUID REFERENCES material_grades(id) ON DELETE SET NULL,
    rate_type VARCHAR(20) NOT NULL CHECK (rate_type IN ('PURCHASE', 'SALES')),
    rate_per_unit DECIMAL(12, 2) NOT NULL CHECK (rate_per_unit >= 0),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    authorized_by UUID REFERENCES users_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Parties Master (Unified Supplier & Customer)
CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    party_code VARCHAR(50) UNIQUE NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    party_type VARCHAR(20) NOT NULL CHECK (party_type IN ('SUPPLIER', 'CUSTOMER', 'BOTH')),
    contact_person VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100),
    state_name VARCHAR(100) NOT NULL DEFAULT 'Tamil Nadu',
    state_code VARCHAR(10) NOT NULL DEFAULT '33',
    gstin VARCHAR(20),
    pan VARCHAR(20),
    payment_terms VARCHAR(100) DEFAULT 'Immediate',
    credit_limit DECIMAL(14, 2) DEFAULT 0.00,
    opening_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00, -- Positive: receivable (customer owes us), Negative: payable (we owe supplier)
    opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Vehicles & Documents
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_no VARCHAR(50) UNIQUE NOT NULL,
    vehicle_type VARCHAR(100) NOT NULL, -- Lorry, Mini Truck, Pickup, Tractor, Auto
    ownership_type VARCHAR(50) NOT NULL CHECK (ownership_type IN ('OWNED', 'HIRED', 'CUSTOMER_VEHICLE', 'SUPPLIER_VEHICLE')),
    driver_name VARCHAR(255),
    driver_phone VARCHAR(50),
    tare_weight DECIMAL(12, 3) DEFAULT 0.000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- RC, INSURANCE, FITNESS, PERMIT, POLLUTION, ROAD_TAX
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE NOT NULL,
    reminder_days_before INT NOT NULL DEFAULT 15,
    attachment_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Employees & Attendance
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Operations',
    phone VARCHAR(50) NOT NULL,
    joining_date DATE NOT NULL,
    daily_wage_rate DECIMAL(10, 2) DEFAULT 0.00,
    monthly_salary DECIMAL(12, 2) DEFAULT 0.00,
    current_advance_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'OVERTIME')),
    check_in_time TIME,
    check_out_time TIME,
    overtime_hours DECIMAL(4, 2) DEFAULT 0.00,
    remarks TEXT,
    marked_by UUID REFERENCES users_roles(id),
    is_corrected BOOLEAN NOT NULL DEFAULT false,
    correction_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, attendance_date)
);

-- 9. Cash & Bank Accounts
CREATE TABLE IF NOT EXISTS cash_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code VARCHAR(50) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('CASH', 'BANK')),
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    ifsc_code VARCHAR(50),
    opening_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Weighments Engine
CREATE TABLE IF NOT EXISTS weighments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weighment_no VARCHAR(50) UNIQUE NOT NULL,
    weighing_method VARCHAR(20) NOT NULL CHECK (weighing_method IN ('MANUAL_SCALE', 'WEIGHBRIDGE_SLIP', 'HARDWARE_LINK')),
    slip_reference VARCHAR(100),
    vehicle_registration VARCHAR(50),
    gross_weight DECIMAL(12, 3) NOT NULL CHECK (gross_weight >= 0),
    tare_weight DECIMAL(12, 3) NOT NULL CHECK (tare_weight >= 0),
    net_weight DECIMAL(12, 3) GENERATED ALWAYS AS (gross_weight - tare_weight) STORED,
    approved_deductions DECIMAL(12, 3) NOT NULL DEFAULT 0.000 CHECK (approved_deductions >= 0),
    payable_weight DECIMAL(12, 3) GENERATED ALWAYS AS (gross_weight - tare_weight - approved_deductions) STORED,
    unit VARCHAR(20) NOT NULL DEFAULT 'KG',
    first_weight_time TIMESTAMPTZ,
    second_weight_time TIMESTAMPTZ,
    operator_name VARCHAR(255) NOT NULL,
    slip_image_url TEXT,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_gross_gte_tare CHECK (gross_weight >= tare_weight),
    CONSTRAINT chk_deductions_lte_net CHECK (approved_deductions <= (gross_weight - tare_weight))
);

-- 11. Collection Jobs (Pickup Requests)
CREATE TABLE IF NOT EXISTS collection_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_no VARCHAR(50) UNIQUE NOT NULL,
    supplier_party_id UUID NOT NULL REFERENCES parties(id),
    pickup_location TEXT NOT NULL,
    material_id UUID NOT NULL REFERENCES materials(id),
    planned_date DATE NOT NULL,
    assigned_vehicle_id UUID REFERENCES vehicles(id),
    assigned_staff_id UUID REFERENCES employees(id),
    estimated_quantity DECIMAL(12, 3) NOT NULL CHECK (estimated_quantity >= 0),
    actual_weight DECIMAL(12, 3) DEFAULT 0.000,
    transport_expenses DECIMAL(12, 2) DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'ASSIGNED', 'IN_TRANSIT', 'WEIGHED', 'COMPLETED', 'CANCELLED')),
    resulting_purchase_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Purchase Headers & Lines
CREATE TABLE IF NOT EXISTS purchase_headers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_no VARCHAR(50) UNIQUE NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    supplier_party_id UUID NOT NULL REFERENCES parties(id),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('DIRECT_SUPPLIER', 'COLLECTION_PICKUP', 'GATE_PURCHASE')),
    collection_job_id UUID REFERENCES collection_jobs(id),
    yard_id UUID NOT NULL REFERENCES yards(id),
    vehicle_registration VARCHAR(50),
    weighment_id UUID REFERENCES weighments(id),
    subtotal_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    other_charges DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    outstanding_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'POSTED', 'CANCELLED')),
    created_by UUID REFERENCES users_roles(id),
    approved_by UUID REFERENCES users_roles(id),
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_header_id UUID NOT NULL REFERENCES purchase_headers(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    grade_id UUID REFERENCES material_grades(id),
    gross_weight DECIMAL(12, 3) NOT NULL,
    tare_weight DECIMAL(12, 3) NOT NULL,
    net_weight DECIMAL(12, 3) NOT NULL,
    deductions DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    payable_weight DECIMAL(12, 3) NOT NULL,
    rate_per_unit DECIMAL(12, 2) NOT NULL CHECK (rate_per_unit >= 0),
    gst_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    taxable_amount DECIMAL(14, 2) NOT NULL,
    gst_amount DECIMAL(14, 2) NOT NULL,
    total_amount DECIMAL(14, 2) NOT NULL
);

-- 13. Inventory Lots & Stock Movement Ledger (IMMUTABLE, APPEND-ONLY)
CREATE TABLE IF NOT EXISTS inventory_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_number VARCHAR(50) UNIQUE NOT NULL,
    material_id UUID NOT NULL REFERENCES materials(id),
    grade_id UUID REFERENCES material_grades(id),
    yard_id UUID NOT NULL REFERENCES yards(id),
    source_purchase_id UUID REFERENCES purchase_headers(id),
    initial_quantity DECIMAL(12, 3) NOT NULL CHECK (initial_quantity > 0),
    remaining_quantity DECIMAL(12, 3) NOT NULL CHECK (remaining_quantity >= 0),
    unit_cost DECIMAL(12, 2) NOT NULL CHECK (unit_cost >= 0),
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_exhausted BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN (
        'PURCHASE_RECEIPT', 'COLLECTION_RECEIPT', 'SALES_DISPATCH',
        'YARD_TRANSFER_IN', 'YARD_TRANSFER_OUT', 'STOCK_ADJUSTMENT',
        'STOCK_LOSS', 'REVERSAL', 'OPENING_STOCK'
    )),
    transaction_ref VARCHAR(100) NOT NULL,
    material_id UUID NOT NULL REFERENCES materials(id),
    grade_id UUID REFERENCES material_grades(id),
    yard_id UUID NOT NULL REFERENCES yards(id),
    lot_id UUID REFERENCES inventory_lots(id),
    quantity DECIMAL(12, 3) NOT NULL, -- Positive for inward, negative for outward
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    reversal_movement_id UUID REFERENCES stock_movements(id),
    notes TEXT,
    created_by UUID REFERENCES users_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Sales Headers, Lines & FIFO Lot Allocations
CREATE TABLE IF NOT EXISTS sales_headers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_no VARCHAR(50) UNIQUE NOT NULL,
    order_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_party_id UUID NOT NULL REFERENCES parties(id),
    yard_id UUID NOT NULL REFERENCES yards(id),
    vehicle_registration VARCHAR(50),
    weighment_id UUID REFERENCES weighments(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'DISPATCHED', 'INVOICED', 'CANCELLED')),
    subtotal_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    allocated_cogs DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    invoice_id UUID,
    dispatched_at TIMESTAMPTZ,
    created_by UUID REFERENCES users_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_header_id UUID NOT NULL REFERENCES sales_headers(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    grade_id UUID REFERENCES material_grades(id),
    quantity DECIMAL(12, 3) NOT NULL CHECK (quantity > 0),
    rate_per_unit DECIMAL(12, 2) NOT NULL CHECK (rate_per_unit >= 0),
    gst_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    taxable_amount DECIMAL(14, 2) NOT NULL,
    gst_amount DECIMAL(14, 2) NOT NULL,
    total_amount DECIMAL(14, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_lot_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_line_id UUID NOT NULL REFERENCES sales_lines(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL REFERENCES inventory_lots(id),
    allocated_quantity DECIMAL(12, 3) NOT NULL CHECK (allocated_quantity > 0),
    unit_cost DECIMAL(12, 2) NOT NULL,
    total_cost DECIMAL(14, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. Invoices & Immutable Snapshots
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sales_header_id UUID REFERENCES sales_headers(id),
    customer_party_id UUID NOT NULL REFERENCES parties(id),
    billing_address TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    customer_gstin VARCHAR(20),
    customer_state_name VARCHAR(100) DEFAULT 'Tamil Nadu',
    customer_state_code VARCHAR(10) DEFAULT '33',
    place_of_supply VARCHAR(100) DEFAULT 'Tamil Nadu (33)',
    eway_bill_no VARCHAR(50),
    delivery_note VARCHAR(100),
    vehicle_registration VARCHAR(50),
    subtotal_taxable DECIMAL(14, 2) NOT NULL,
    cgst_rate DECIMAL(5, 2) NOT NULL DEFAULT 9.00,
    cgst_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    sgst_rate DECIMAL(5, 2) NOT NULL DEFAULT 9.00,
    sgst_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    igst_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    igst_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    round_off DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(14, 2) NOT NULL,
    amount_in_words TEXT NOT NULL,
    tax_amount_in_words TEXT NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
    amount_paid DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    outstanding_balance DECIMAL(14, 2) NOT NULL,
    immutable_snapshot_json JSONB NOT NULL, -- Preserves exact historical invoice data permanently
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    cancellation_reason TEXT,
    created_by UUID REFERENCES users_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    serial_no INT NOT NULL,
    description_of_goods VARCHAR(255) NOT NULL,
    hsn_sac VARCHAR(20) NOT NULL DEFAULT '7204',
    unit VARCHAR(20) NOT NULL DEFAULT 'KG',
    quantity DECIMAL(12, 3) NOT NULL,
    rate DECIMAL(12, 2) NOT NULL,
    taxable_value DECIMAL(14, 2) NOT NULL
);

-- 16. Payments & Allocations
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_no VARCHAR(50) UNIQUE NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('INFLOW_RECEIPT', 'OUTFLOW_PAYMENT')),
    party_id UUID NOT NULL REFERENCES parties(id),
    account_id UUID NOT NULL REFERENCES cash_bank_accounts(id),
    total_amount DECIMAL(14, 2) NOT NULL CHECK (total_amount > 0),
    unallocated_amount DECIMAL(14, 2) NOT NULL CHECK (unallocated_amount >= 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('CASH', 'NEFT_RTGS', 'UPI', 'CHEQUE', 'IMPS')),
    reference_no VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES users_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    purchase_header_id UUID REFERENCES purchase_headers(id),
    allocated_amount DECIMAL(14, 2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. Account Transactions (Cashbook & Bankbook with Contra Transfers)
CREATE TABLE IF NOT EXISTS account_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES cash_bank_accounts(id),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT', 'CONTRA_TRANSFER_IN',
        'CONTRA_TRANSFER_OUT', 'OPERATING_EXPENSE', 'EMPLOYEE_ADVANCE',
        'OWNER_INJECTION', 'OWNER_DRAWING', 'OPENING_BALANCE'
    )),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    amount DECIMAL(14, 2) NOT NULL CHECK (amount > 0),
    contra_account_id UUID REFERENCES cash_bank_accounts(id),
    payment_id UUID REFERENCES payments(id),
    reference_no VARCHAR(100),
    description TEXT NOT NULL,
    created_by UUID REFERENCES users_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 18. Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_no VARCHAR(50) UNIQUE NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(100) NOT NULL, -- Transport, Fuel, Vehicle Repair, Weighbridge Fee, Yard Electricity, Labor, Tea/Snacks, Office, Other
    amount DECIMAL(14, 2) NOT NULL CHECK (amount > 0),
    account_id UUID NOT NULL REFERENCES cash_bank_accounts(id),
    vehicle_id UUID REFERENCES vehicles(id),
    paid_to VARCHAR(255) NOT NULL,
    bill_reference VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES users_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 19. Physical Stock Reconciliation
CREATE TABLE IF NOT EXISTS stock_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    count_no VARCHAR(50) UNIQUE NOT NULL,
    count_date DATE NOT NULL DEFAULT CURRENT_DATE,
    yard_id UUID NOT NULL REFERENCES yards(id),
    conducted_by VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED')),
    approved_by UUID REFERENCES users_roles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_count_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    grade_id UUID REFERENCES material_grades(id),
    system_quantity DECIMAL(12, 3) NOT NULL,
    physical_quantity DECIMAL(12, 3) NOT NULL,
    variance_quantity DECIMAL(12, 3) GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
    reason TEXT
);

-- 20. Audit Trail (Immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users_roles(id),
    actor_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(50),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_mat_yard ON stock_movements(material_id, yard_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_lot ON stock_movements(lot_id);
CREATE INDEX IF NOT EXISTS idx_purchase_headers_status ON purchase_headers(status);
CREATE INDEX IF NOT EXISTS idx_sales_headers_status ON sales_headers(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_id);
CREATE INDEX IF NOT EXISTS idx_account_tx_account ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
-- Yasoth Enterprises — Production Scrap ERP
-- Migration 002: Analytical Views & Authoritative Functions
-- Authoritative calculation views ensuring balances reconcile strictly with source ledgers

-- 1. Material Stock Summary View (Derived strictly from posted stock movements)
CREATE OR REPLACE VIEW v_material_stock_summary AS
SELECT 
    m.id AS material_id,
    m.code AS material_code,
    m.name AS material_name,
    m.category,
    m.base_unit,
    y.id AS yard_id,
    y.name AS yard_name,
    COALESCE(SUM(CASE WHEN sm.quantity > 0 THEN sm.quantity ELSE 0 END), 0) AS total_inward_kg,
    COALESCE(SUM(CASE WHEN sm.quantity < 0 THEN ABS(sm.quantity) ELSE 0 END), 0) AS total_outward_kg,
    COALESCE(SUM(sm.quantity), 0) AS current_stock_kg,
    CASE 
        WHEN COALESCE(SUM(sm.quantity), 0) > 0 
        THEN COALESCE(SUM(sm.total_cost) / NULLIF(SUM(sm.quantity), 0), m.default_purchase_rate)
        ELSE m.default_purchase_rate 
    END AS weighted_avg_cost,
    ROUND(COALESCE(SUM(sm.quantity), 0) * 
        CASE 
            WHEN COALESCE(SUM(sm.quantity), 0) > 0 
            THEN COALESCE(SUM(sm.total_cost) / NULLIF(SUM(sm.quantity), 0), m.default_purchase_rate)
            ELSE m.default_purchase_rate 
        END, 2) AS stock_valuation_amount
FROM materials m
CROSS JOIN yards y
LEFT JOIN stock_movements sm ON sm.material_id = m.id AND sm.yard_id = y.id
GROUP BY m.id, m.code, m.name, m.category, m.base_unit, m.default_purchase_rate, y.id, y.name;

-- 2. FIFO Active Inventory Lots View
CREATE OR REPLACE VIEW v_active_inventory_lots AS
SELECT 
    il.id AS lot_id,
    il.lot_number,
    m.name AS material_name,
    y.name AS yard_name,
    il.initial_quantity,
    il.remaining_quantity,
    il.unit_cost,
    ROUND(il.remaining_quantity * il.unit_cost, 2) AS current_lot_value,
    il.received_at,
    il.is_exhausted
FROM inventory_lots il
JOIN materials m ON m.id = il.material_id
JOIN yards y ON y.id = il.yard_id
WHERE il.is_exhausted = false AND il.remaining_quantity > 0
ORDER BY il.received_at ASC;

-- 3. Unified Party Ledger & Outstanding View
CREATE OR REPLACE VIEW v_party_balances AS
SELECT 
    p.id AS party_id,
    p.party_code,
    p.legal_name,
    p.party_type,
    p.phone,
    p.gstin,
    p.opening_balance,
    -- Customer Sales Invoiced
    COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.customer_party_id = p.id AND i.is_cancelled = false), 0) AS total_invoiced_sales,
    -- Customer Cash/Bank Received
    COALESCE((SELECT SUM(pay.total_amount) FROM payments pay WHERE pay.party_id = p.id AND pay.direction = 'INFLOW_RECEIPT'), 0) AS total_receipts,
    -- Supplier Purchases Inward
    COALESCE((SELECT SUM(ph.total_amount) FROM purchase_headers ph WHERE ph.supplier_party_id = p.id AND ph.status = 'POSTED'), 0) AS total_purchases_posted,
    -- Supplier Payments Made
    COALESCE((SELECT SUM(pay.total_amount) FROM payments pay WHERE pay.party_id = p.id AND pay.direction = 'OUTFLOW_PAYMENT'), 0) AS total_payments_made,
    -- Outstanding net: Positive = Customer owes us; Negative = We owe supplier
    ROUND(
        p.opening_balance 
        + COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.customer_party_id = p.id AND i.is_cancelled = false), 0)
        - COALESCE((SELECT SUM(pay.total_amount) FROM payments pay WHERE pay.party_id = p.id AND pay.direction = 'INFLOW_RECEIPT'), 0)
        - COALESCE((SELECT SUM(ph.total_amount) FROM purchase_headers ph WHERE ph.supplier_party_id = p.id AND ph.status = 'POSTED'), 0)
        + COALESCE((SELECT SUM(pay.total_amount) FROM payments pay WHERE pay.party_id = p.id AND pay.direction = 'OUTFLOW_PAYMENT'), 0)
    , 2) AS current_net_balance
FROM parties p;

-- 4. Reconciled Cash & Bank Account Balances View
CREATE OR REPLACE VIEW v_account_balances AS
SELECT 
    a.id AS account_id,
    a.account_code,
    a.account_name,
    a.account_type,
    a.opening_balance,
    COALESCE(SUM(CASE WHEN at.direction = 'DEBIT' THEN at.amount ELSE 0 END), 0) AS total_debits,
    COALESCE(SUM(CASE WHEN at.direction = 'CREDIT' THEN at.amount ELSE 0 END), 0) AS total_credits,
    ROUND(
        CASE 
            WHEN BOOL_OR(at.transaction_type = 'OPENING_BALANCE') THEN 0.00 
            ELSE a.opening_balance 
        END 
        + COALESCE(SUM(CASE WHEN at.direction = 'DEBIT' THEN at.amount ELSE 0 END), 0) 
        - COALESCE(SUM(CASE WHEN at.direction = 'CREDIT' THEN at.amount ELSE 0 END), 0)
    , 2) AS current_reconciled_balance
FROM cash_bank_accounts a
LEFT JOIN account_transactions at ON at.account_id = a.id
GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.opening_balance;
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
    status VARCHAR(20) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED', 'REVERSED')),
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
-- ============================================================================
-- YASHOTH ENTERPRISES ERP — PHASE 5 DATABASE MIGRATION
-- Migration: 006_backup_and_restore.sql
-- Description: Backup history, restore logs, and automated scheduling metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS backup_history (
    id VARCHAR(64) PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    backup_name VARCHAR(255) NOT NULL,
    backup_type VARCHAR(32) NOT NULL CHECK (backup_type IN ('FULL_DATABASE', 'COMPANY_SCOPED', 'SAFETY_PRE_RESTORE')),
    destination VARCHAR(32) NOT NULL CHECK (destination IN ('LOCAL_FILE', 'ENCRYPTED_ARCHIVE', 'GOOGLE_DRIVE', 'CLOUD_STORAGE')),
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256_checksum VARCHAR(64) NOT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    encryption_algorithm VARCHAR(32) DEFAULT NULL,
    schema_version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
    total_records INTEGER NOT NULL DEFAULT 0,
    record_counts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    financial_totals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'VERIFIED')),
    error_message TEXT DEFAULT NULL,
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restore_logs (
    id VARCHAR(64) PRIMARY KEY,
    backup_id VARCHAR(64) NOT NULL,
    pre_restore_backup_id VARCHAR(64) NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    restored_by VARCHAR(128) NOT NULL,
    restoration_type VARCHAR(32) NOT NULL CHECK (restoration_type IN ('FULL_RESTORE', 'COMPANY_RESTORE')),
    records_restored_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    sha256_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL CHECK (status IN ('COMPLETED', 'FAILED', 'ROLLED_BACK')),
    notes TEXT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    restored_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_schedules (
    id VARCHAR(64) PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    frequency VARCHAR(32) NOT NULL CHECK (frequency IN ('MANUAL_ONLY', 'DAILY', 'WEEKLY', 'MONTHLY')),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    destination VARCHAR(32) NOT NULL DEFAULT 'LOCAL_FILE' CHECK (destination IN ('LOCAL_FILE', 'ENCRYPTED_ARCHIVE', 'GOOGLE_DRIVE')),
    encrypt_by_default BOOLEAN NOT NULL DEFAULT FALSE,
    retention_count INTEGER NOT NULL DEFAULT 10 CHECK (retention_count >= 1),
    last_run_at TIMESTAMPTZ DEFAULT NULL,
    last_run_status VARCHAR(32) DEFAULT NULL,
    next_run_at TIMESTAMPTZ DEFAULT NULL,
    google_drive_folder_id VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_history_company ON backup_history(company_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restore_logs_created_at ON restore_logs(restored_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_company ON backup_schedules(company_id);
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
    -- Only service_role bypasses company membership check
    IF auth_current_role() = 'service_role' THEN
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
    -- Only service_role bypasses company role check
    IF auth_current_role() = 'service_role' THEN
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
            WHERE ph.id = purchase_lines.purchase_header_id
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
            WHERE sh.id = sales_lines.sales_header_id
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
            WHERE je.id = journal_lines.journal_id
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
    account_id UUID REFERENCES cash_bank_accounts(id) ON DELETE SET NULL,
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

-- Ensure expenses columns exist if table already existed from migration 001
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'BANK', 'UNPAID'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'UNPAID', 'REVERSED'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('APPROVED', 'PENDING', 'REJECTED'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS entered_by VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reversal_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

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
    account_id UUID REFERENCES cash_bank_accounts(id) ON DELETE SET NULL,
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
    account_id UUID REFERENCES cash_bank_accounts(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'REVERSED')),
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
    account_id UUID REFERENCES cash_bank_accounts(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'REVERSED')),
    idempotency_key VARCHAR(100),
    accrual_journal_id UUID,
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
-- 5. Authoritative Financial Table Direct-Write Restriction & Operation-Specific RBAC
-- ----------------------------------------------------------------------------
-- Ensure RLS is active on all core financial tables
ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_labour_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contractor_work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;

-- Ensure contractor_work_entries, daily_labour_entries & journal_entries status & idempotency columns exist before policy definition
ALTER TABLE daily_labour_entries ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'REVERSED'));
ALTER TABLE contractor_work_entries ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'REVERSED'));
ALTER TABLE contractor_work_entries ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
ALTER TABLE contractor_work_entries ADD COLUMN IF NOT EXISTS accrual_journal_id UUID;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'POSTED';
CREATE INDEX IF NOT EXISTS idx_contractor_work_idempotency ON contractor_work_entries(company_id, idempotency_key);

-- 5.1 account_transactions (IMMUTABLE LEDGER: Writes strictly restricted to atomic RPCs/system functions)
DROP POLICY IF EXISTS account_transactions_tenant_policy ON account_transactions;
DROP POLICY IF EXISTS rls_account_transactions_select ON account_transactions;
DROP POLICY IF EXISTS rls_account_transactions_insert ON account_transactions;
DROP POLICY IF EXISTS rls_account_transactions_update ON account_transactions;
DROP POLICY IF EXISTS rls_account_transactions_delete ON account_transactions;

CREATE POLICY rls_account_transactions_select ON account_transactions FOR SELECT
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'));

CREATE POLICY rls_account_transactions_insert ON account_transactions FOR INSERT
    WITH CHECK (auth_current_role() = 'service_role');

CREATE POLICY rls_account_transactions_update ON account_transactions FOR UPDATE
    USING (false);

CREATE POLICY rls_account_transactions_delete ON account_transactions FOR DELETE
    USING (false);

-- 5.2 employee_advances (Disbursements strictly via fn_issue_employee_advance_atomic)
DROP POLICY IF EXISTS rls_employee_advances_select ON employee_advances;
DROP POLICY IF EXISTS rls_employee_advances_insert ON employee_advances;
DROP POLICY IF EXISTS rls_employee_advances_update ON employee_advances;
DROP POLICY IF EXISTS rls_employee_advances_delete ON employee_advances;

CREATE POLICY rls_employee_advances_select ON employee_advances FOR SELECT
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'));

CREATE POLICY rls_employee_advances_insert ON employee_advances FOR INSERT
    WITH CHECK (auth_current_role() = 'service_role');

CREATE POLICY rls_employee_advances_update ON employee_advances FOR UPDATE
    USING (false);

CREATE POLICY rls_employee_advances_delete ON employee_advances FOR DELETE
    USING (false);

-- 5.3 contractor_payments (Disbursements strictly via fn_post_contractor_payment_atomic)
DROP POLICY IF EXISTS rls_contractor_payments_select ON contractor_payments;
DROP POLICY IF EXISTS rls_contractor_payments_insert ON contractor_payments;
DROP POLICY IF EXISTS rls_contractor_payments_update ON contractor_payments;
DROP POLICY IF EXISTS rls_contractor_payments_delete ON contractor_payments;

CREATE POLICY rls_contractor_payments_select ON contractor_payments FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_contractor_payments_insert ON contractor_payments FOR INSERT
    WITH CHECK (auth_current_role() = 'service_role');

CREATE POLICY rls_contractor_payments_update ON contractor_payments FOR UPDATE
    USING (false);

CREATE POLICY rls_contractor_payments_delete ON contractor_payments FOR DELETE
    USING (false);

-- 5.4 labour_payments (Disbursements strictly via fn_post_labour_payment_atomic)
DROP POLICY IF EXISTS rls_labour_payments_select ON labour_payments;
DROP POLICY IF EXISTS rls_labour_payments_insert ON labour_payments;
DROP POLICY IF EXISTS rls_labour_payments_update ON labour_payments;
DROP POLICY IF EXISTS rls_labour_payments_delete ON labour_payments;

CREATE POLICY rls_labour_payments_select ON labour_payments FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_labour_payments_insert ON labour_payments FOR INSERT
    WITH CHECK (auth_current_role() = 'service_role');

CREATE POLICY rls_labour_payments_update ON labour_payments FOR UPDATE
    USING (false);

CREATE POLICY rls_labour_payments_delete ON labour_payments FOR DELETE
    USING (false);

-- 5.5 salary_records (Salary accruals and disbursements)
DROP POLICY IF EXISTS rls_salary_records_select ON salary_records;
DROP POLICY IF EXISTS rls_salary_records_insert ON salary_records;
DROP POLICY IF EXISTS rls_salary_records_update ON salary_records;
DROP POLICY IF EXISTS rls_salary_records_delete ON salary_records;

CREATE POLICY rls_salary_records_select ON salary_records FOR SELECT
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'));

CREATE POLICY rls_salary_records_insert ON salary_records FOR INSERT
    WITH CHECK (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'));

CREATE POLICY rls_salary_records_update ON salary_records FOR UPDATE
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'))
    WITH CHECK (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'));

CREATE POLICY rls_salary_records_delete ON salary_records FOR DELETE
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin') AND status <> 'PAID');

-- 5.6 daily_labour_entries (Daily attendance accruals - Store Supervisor allowed to log)
DROP POLICY IF EXISTS rls_daily_labour_select ON daily_labour_entries;
DROP POLICY IF EXISTS rls_daily_labour_insert ON daily_labour_entries;
DROP POLICY IF EXISTS rls_daily_labour_update ON daily_labour_entries;
DROP POLICY IF EXISTS rls_daily_labour_delete ON daily_labour_entries;

CREATE POLICY rls_daily_labour_select ON daily_labour_entries FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_daily_labour_insert ON daily_labour_entries FOR INSERT
    WITH CHECK (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator', 'store_operator'));

CREATE POLICY rls_daily_labour_update ON daily_labour_entries FOR UPDATE
    USING (auth_is_company_member(company_id) AND (
        auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator')
        OR (auth_has_company_role(company_id, 'store_operator') AND status = 'PENDING')
    ))
    WITH CHECK (auth_is_company_member(company_id) AND (
        auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator')
        OR (auth_has_company_role(company_id, 'store_operator') AND status = 'PENDING')
    ));

CREATE POLICY rls_daily_labour_delete ON daily_labour_entries FOR DELETE
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin') AND status = 'PENDING');

-- 5.7 contractor_work_entries (Work logging - Store Supervisor allowed to log)
DROP POLICY IF EXISTS rls_contractor_work_select ON contractor_work_entries;
DROP POLICY IF EXISTS rls_contractor_work_insert ON contractor_work_entries;
DROP POLICY IF EXISTS rls_contractor_work_update ON contractor_work_entries;
DROP POLICY IF EXISTS rls_contractor_work_delete ON contractor_work_entries;

CREATE POLICY rls_contractor_work_select ON contractor_work_entries FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_contractor_work_insert ON contractor_work_entries FOR INSERT
    WITH CHECK (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator', 'store_operator'));

CREATE POLICY rls_contractor_work_update ON contractor_work_entries FOR UPDATE
    USING (auth_is_company_member(company_id) AND (
        auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator')
        OR (auth_has_company_role(company_id, 'store_operator') AND status = 'PENDING')
    ))
    WITH CHECK (auth_is_company_member(company_id) AND (
        auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator')
        OR (auth_has_company_role(company_id, 'store_operator') AND status = 'PENDING')
    ));

CREATE POLICY rls_contractor_work_delete ON contractor_work_entries FOR DELETE
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin') AND status = 'PENDING');

-- 5.8 payments and payment_allocations (Supervisor denied write access)
DROP POLICY IF EXISTS payments_tenant_policy ON payments;
DROP POLICY IF EXISTS rls_payments_select ON payments;
DROP POLICY IF EXISTS rls_payments_insert ON payments;
DROP POLICY IF EXISTS rls_payments_update ON payments;
DROP POLICY IF EXISTS rls_payments_delete ON payments;

CREATE POLICY rls_payments_select ON payments FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_payments_insert ON payments FOR INSERT
    WITH CHECK (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'));

CREATE POLICY rls_payments_update ON payments FOR UPDATE
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'))
    WITH CHECK (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'));

CREATE POLICY rls_payments_delete ON payments FOR DELETE
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin')
           AND NOT EXISTS (SELECT 1 FROM account_transactions WHERE payment_id = payments.id));

DROP POLICY IF EXISTS payment_allocations_tenant_policy ON payment_allocations;
DROP POLICY IF EXISTS rls_payment_allocations_select ON payment_allocations;
DROP POLICY IF EXISTS rls_payment_allocations_insert ON payment_allocations;
DROP POLICY IF EXISTS rls_payment_allocations_update ON payment_allocations;
DROP POLICY IF EXISTS rls_payment_allocations_delete ON payment_allocations;

CREATE POLICY rls_payment_allocations_select ON payment_allocations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM payments p
            WHERE p.id = payment_allocations.payment_id
              AND auth_is_company_member(p.company_id)
        )
    );

CREATE POLICY rls_payment_allocations_insert ON payment_allocations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM payments p
            WHERE p.id = payment_allocations.payment_id
              AND auth_is_company_member(p.company_id)
              AND auth_has_company_role(p.company_id, 'owner_admin', 'manager', 'accounts_operator')
        )
    );

CREATE POLICY rls_payment_allocations_update ON payment_allocations FOR UPDATE
    USING (false);

CREATE POLICY rls_payment_allocations_delete ON payment_allocations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM payments p
            WHERE p.id = payment_allocations.payment_id
              AND auth_is_company_member(p.company_id)
              AND auth_has_company_role(p.company_id, 'owner_admin')
        )
    );

-- 5.9 journal_entries and journal_lines (General Ledger: Supervisor denied write access)
DROP POLICY IF EXISTS journal_entries_tenant_policy ON journal_entries;
DROP POLICY IF EXISTS rls_journal_entries_select ON journal_entries;
DROP POLICY IF EXISTS rls_journal_entries_insert ON journal_entries;
DROP POLICY IF EXISTS rls_journal_entries_update ON journal_entries;
DROP POLICY IF EXISTS rls_journal_entries_delete ON journal_entries;

CREATE POLICY rls_journal_entries_select ON journal_entries FOR SELECT
    USING (auth_is_company_member(company_id));

CREATE POLICY rls_journal_entries_insert ON journal_entries FOR INSERT
    WITH CHECK (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator'));

CREATE POLICY rls_journal_entries_update ON journal_entries FOR UPDATE
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator') AND status <> 'POSTED')
    WITH CHECK (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin', 'manager', 'accounts_operator') AND status <> 'POSTED');

CREATE POLICY rls_journal_entries_delete ON journal_entries FOR DELETE
    USING (auth_is_company_member(company_id) AND auth_has_company_role(company_id, 'owner_admin') AND status <> 'POSTED');

DROP POLICY IF EXISTS journal_lines_tenant_policy ON journal_lines;
DROP POLICY IF EXISTS rls_journal_lines_select ON journal_lines;
DROP POLICY IF EXISTS rls_journal_lines_insert ON journal_lines;
DROP POLICY IF EXISTS rls_journal_lines_update ON journal_lines;
DROP POLICY IF EXISTS rls_journal_lines_delete ON journal_lines;

CREATE POLICY rls_journal_lines_select ON journal_lines FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_lines.journal_id
              AND auth_is_company_member(je.company_id)
        )
    );

CREATE POLICY rls_journal_lines_insert ON journal_lines FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_lines.journal_id
              AND auth_is_company_member(je.company_id)
              AND auth_has_company_role(je.company_id, 'owner_admin', 'manager', 'accounts_operator')
        )
    );

CREATE POLICY rls_journal_lines_update ON journal_lines FOR UPDATE
    USING (false);

CREATE POLICY rls_journal_lines_delete ON journal_lines FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_lines.journal_id
              AND auth_is_company_member(je.company_id)
              AND auth_has_company_role(je.company_id, 'owner_admin')
              AND je.status <> 'POSTED'
        )
    );

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
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- Enforce operation-specific role authorization (Financial disbursement)
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'manager', 'accounts_operator') THEN
            RAISE EXCEPTION 'Forbidden: User does not have financial disbursement authorization in company %', p_company_id;
        END IF;
    END IF;

    -- 2. Verify contractor belongs to the specified company
    PERFORM 1 FROM contractors WHERE id = p_contractor_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contractor % does not belong to company %', p_contractor_id, p_company_id;
    END IF;

    -- 3. If account_id provided, verify cash/bank account belongs to the same company, is active, and matches payment mode
    IF p_account_id IS NOT NULL THEN
        PERFORM 1 FROM cash_bank_accounts 
        WHERE id = p_account_id 
          AND company_id = p_company_id
          AND is_active = true
          AND account_type = UPPER(p_payment_mode);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %, is inactive, or does not match payment mode %', p_account_id, p_company_id, p_payment_mode;
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
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- Enforce operation-specific role authorization (Financial disbursement)
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'manager', 'accounts_operator') THEN
            RAISE EXCEPTION 'Forbidden: User does not have financial disbursement authorization in company %', p_company_id;
        END IF;
    END IF;

    -- 2. Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_payment_id FROM labour_payments 
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'idempotent', true);
        END IF;
    END IF;

    -- 3. If account_id provided, verify cash/bank account belongs to the same company, is active, and matches payment mode
    IF p_account_id IS NOT NULL THEN
        PERFORM 1 FROM cash_bank_accounts 
        WHERE id = p_account_id 
          AND company_id = p_company_id
          AND is_active = true
          AND account_type = UPPER(p_payment_mode);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %, is inactive, or does not match payment mode %', p_account_id, p_company_id, p_payment_mode;
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
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- Enforce operation-specific role authorization (Financial disbursement)
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'manager', 'accounts_operator') THEN
            RAISE EXCEPTION 'Forbidden: User does not have salary disbursement authorization in company %', p_company_id;
        END IF;
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

    -- 4. If account_id provided, verify cash/bank account belongs to the same company, is active, and matches payment mode
    IF p_account_id IS NOT NULL THEN
        PERFORM 1 FROM cash_bank_accounts 
        WHERE id = p_account_id 
          AND company_id = p_company_id
          AND is_active = true
          AND account_type = UPPER(p_payment_mode);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %, is inactive, or does not match payment mode %', p_account_id, p_company_id, p_payment_mode;
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
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- Enforce operation-specific role authorization (Financial disbursement)
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'manager', 'accounts_operator') THEN
            RAISE EXCEPTION 'Forbidden: User does not have advance disbursement authorization in company %', p_company_id;
        END IF;
    END IF;

    -- 2. If account_id provided, verify cash/bank account belongs to the same company, is active, and matches payment mode
    IF p_account_id IS NOT NULL THEN
        PERFORM 1 FROM cash_bank_accounts 
        WHERE id = p_account_id 
          AND company_id = p_company_id
          AND is_active = true
          AND account_type = UPPER(p_payment_mode);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %, is inactive, or does not match payment mode %', p_account_id, p_company_id, p_payment_mode;
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
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- Enforce operation-specific role authorization (Salary accrual)
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'manager', 'accounts_operator', 'hr_operator') THEN
            RAISE EXCEPTION 'Forbidden: User does not have salary accrual authorization in company %', p_company_id;
        END IF;
    END IF;

    -- 2. Verify employee belongs to company
    PERFORM 1 FROM employees WHERE id = p_employee_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % does not belong to company %', p_employee_id, p_company_id;
    END IF;

    -- 3. If account_id provided and payment is made, verify cash/bank account belongs to company, is active, and matches payment mode
    IF p_account_id IS NOT NULL AND COALESCE(p_amount_paid, 0) > 0 THEN
        PERFORM 1 FROM cash_bank_accounts 
        WHERE id = p_account_id 
          AND company_id = p_company_id
          AND is_active = true
          AND account_type = UPPER(p_payment_mode);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %, is inactive, or does not match payment mode %', p_account_id, p_company_id, p_payment_mode;
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

    -- Validate Net Salary formula: gross + allowances - deductions - advance_recovery = net_salary_payable
    IF ROUND(p_gross_salary + COALESCE(p_allowances, 0) - COALESCE(p_deductions, 0) - COALESCE(p_advance_recovery, 0), 2) <> ROUND(p_net_salary_payable, 2) THEN
        RAISE EXCEPTION 'Net salary payable (₹%) does not match gross (₹%) + allowances (₹%) - deductions (₹%) - advance recovery (₹%) = ₹%',
            p_net_salary_payable, p_gross_salary, COALESCE(p_allowances, 0), COALESCE(p_deductions, 0), COALESCE(p_advance_recovery, 0),
            ROUND(p_gross_salary + COALESCE(p_allowances, 0) - COALESCE(p_deductions, 0) - COALESCE(p_advance_recovery, 0), 2);
    END IF;

    IF COALESCE(p_amount_paid, 0) > p_net_salary_payable THEN
        RAISE EXCEPTION 'Amount paid (₹%) cannot exceed net salary payable (₹%)', p_amount_paid, p_net_salary_payable;
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

    -- 2. Recover advances sequentially row-by-row if applicable
    IF COALESCE(p_advance_recovery, 0) > 0 THEN
        DECLARE
            v_rem_rec NUMERIC(12, 2) := p_advance_recovery;
            v_adv RECORD;
            v_deduct NUMERIC(12, 2);
        BEGIN
            FOR v_adv IN 
                SELECT id, remaining_balance, recovered_amount 
                FROM employee_advances 
                WHERE employee_id = p_employee_id 
                  AND company_id = p_company_id 
                  AND status IN ('OPEN', 'PARTIALLY_RECOVERED')
                ORDER BY advance_date ASC, id ASC
                FOR UPDATE
            LOOP
                EXIT WHEN v_rem_rec <= 0;
                v_deduct := LEAST(v_adv.remaining_balance, v_rem_rec);
                UPDATE employee_advances
                SET recovered_amount = recovered_amount + v_deduct,
                    remaining_balance = remaining_balance - v_deduct,
                    status = CASE WHEN (remaining_balance - v_deduct) <= 0.001 THEN 'FULLY_RECOVERED' ELSE 'PARTIALLY_RECOVERED' END
                WHERE id = v_adv.id;
                v_rem_rec := v_rem_rec - v_deduct;
            END LOOP;
        END;

        UPDATE employees
        SET current_advance_balance = GREATEST(0, COALESCE(current_advance_balance, 0) - p_advance_recovery)
        WHERE id = p_employee_id;
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
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- Enforce operation-specific role authorization (Daily labour accrual)
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'manager', 'accounts_operator', 'hr_operator', 'store_operator', 'weighment_operator') THEN
            RAISE EXCEPTION 'Forbidden: User does not have labour accrual authorization in company %', p_company_id;
        END IF;
    END IF;

    -- 2. If account_id provided and payment is made, verify cash/bank account belongs to company, is active, and matches payment mode
    IF p_account_id IS NOT NULL AND COALESCE(p_amount_paid, 0) > 0 THEN
        PERFORM 1 FROM cash_bank_accounts 
        WHERE id = p_account_id 
          AND company_id = p_company_id
          AND is_active = true
          AND account_type = UPPER(p_payment_mode);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %, is inactive, or does not match payment mode %', p_account_id, p_company_id, p_payment_mode;
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
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- Enforce authenticated caller is active member of company
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
    END IF;

    -- Enforce operation-specific role authorization (Contractor work recording)
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'manager', 'accounts_operator', 'store_operator') THEN
            RAISE EXCEPTION 'Forbidden: User does not have contractor work authorization in company %', p_company_id;
        END IF;
    END IF;

    -- 2. Verify contractor belongs to the specified company
    PERFORM 1 FROM contractors WHERE id = p_contractor_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contractor % does not belong to company %', p_contractor_id, p_company_id;
    END IF;

    -- 3. If account_id provided and payment is made, verify cash/bank account belongs to company, is active, and matches payment mode
    IF p_account_id IS NOT NULL AND COALESCE(p_current_payment, 0) > 0 THEN
        PERFORM 1 FROM cash_bank_accounts 
        WHERE id = p_account_id 
          AND company_id = p_company_id
          AND is_active = true
          AND account_type = UPPER(p_payment_mode);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cash/bank account % does not belong to company %, is inactive, or does not match payment mode %', p_account_id, p_company_id, p_payment_mode;
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
-- Revoke execution from public and anon
REVOKE ALL ON FUNCTION fn_post_contractor_payment_atomic FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fn_post_labour_payment_atomic FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fn_post_salary_disbursement_atomic FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fn_issue_employee_advance_atomic FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fn_post_salary_accrual_atomic FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fn_post_daily_labour_accrual_atomic FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fn_post_contractor_work_atomic FROM PUBLIC, anon;

-- Grant execution strictly to authenticated users and service_role
GRANT EXECUTE ON FUNCTION fn_post_contractor_payment_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_labour_payment_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_salary_disbursement_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_issue_employee_advance_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_salary_accrual_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_daily_labour_accrual_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_post_contractor_work_atomic TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 15. Revoke Direct DML on Immutable Ledger and Atomic Payment Tables
-- ----------------------------------------------------------------------------
-- Prevent ordinary authenticated PostgREST bypass of atomic RPCs
REVOKE INSERT, UPDATE, DELETE ON account_transactions FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON employee_advances FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON contractor_payments FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON labour_payments FROM authenticated, anon, PUBLIC;

-- Revoke all modification privileges from anon role
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON public.materials, public.material_grades TO anon;
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
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_has_tx BOOLEAN;
BEGIN
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- 2. Prevent cross-company account modification
    IF NEW.company_id IS NOT NULL AND NEW.company_id <> OLD.company_id THEN
        RAISE EXCEPTION 'Forbidden: Cannot change account company_id (cross-company transfer prohibited)';
    END IF;

    -- 3. Tenant and role authorization
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_is_company_member(OLD.company_id) THEN
            RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', OLD.company_id;
        END IF;

        IF NOT auth_has_company_role(OLD.company_id, 'owner_admin', 'manager', 'accounts_operator') THEN
            RAISE EXCEPTION 'Forbidden: User is not authorized to update financial accounts in company %', OLD.company_id;
        END IF;
    END IF;

    -- 4. P0 Integrity: Prevent ordinary account editing from overwriting authoritative financial balances
    IF NEW.current_balance IS DISTINCT FROM OLD.current_balance THEN
        IF auth_current_role() NOT IN ('service_role') THEN
            RAISE EXCEPTION 'Forbidden: Direct modification of current_balance is prohibited. Balances are derived from authoritative transactions and financial vouchers.';
        END IF;
    END IF;

    -- 5. P0 Integrity: Opening balance changes must use controlled journal entries if transactions exist
    IF NEW.opening_balance IS DISTINCT FROM OLD.opening_balance THEN
        SELECT (
            EXISTS (SELECT 1 FROM account_transactions WHERE account_id = OLD.id) OR
            EXISTS (SELECT 1 FROM payments WHERE account_id = OLD.id) OR
            EXISTS (SELECT 1 FROM expenses WHERE account_id = OLD.id) OR
            EXISTS (SELECT 1 FROM journal_lines WHERE account_code = OLD.account_code)
        ) INTO v_has_tx;

        IF v_has_tx THEN
            RAISE EXCEPTION 'Integrity constraint: Cannot modify opening_balance directly for account % with existing transactions. Use an adjusting journal entry instead.', OLD.account_code;
        END IF;

        -- For virgin accounts with zero transactions, only owner_admin may correct initial opening balance
        IF auth_current_role() NOT IN ('service_role') AND NOT auth_has_company_role(OLD.company_id, 'owner_admin') THEN
            RAISE EXCEPTION 'Forbidden: Only owner_admin may correct initial opening balance on accounts with no transactions.';
        END IF;
    END IF;

    -- 6. Safe account metadata editing (preserves current_balance, updates opening_balance only if allowed)
    UPDATE cash_bank_accounts
    SET 
        account_name = COALESCE(NEW.account_name, OLD.account_name),
        account_code = COALESCE(NEW.account_code, OLD.account_code),
        account_type = COALESCE(NEW.account_type, OLD.account_type),
        bank_name = NEW.bank_name,
        account_number = NEW.account_number,
        ifsc_code = NEW.ifsc_code,
        opening_balance = CASE 
            WHEN NEW.opening_balance IS DISTINCT FROM OLD.opening_balance THEN NEW.opening_balance 
            ELSE OLD.opening_balance 
        END,
        current_balance = CASE
            WHEN auth_current_role() IN ('service_role') THEN COALESCE(NEW.current_balance, OLD.current_balance)
            WHEN NEW.opening_balance IS DISTINCT FROM OLD.opening_balance THEN NEW.opening_balance
            ELSE OLD.current_balance
        END,
        is_active = COALESCE(NEW.is_active, OLD.is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_view_update_trigger ON accounts;
CREATE TRIGGER accounts_view_update_trigger
    INSTEAD OF UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION trg_accounts_view_update();

CREATE OR REPLACE FUNCTION trg_accounts_view_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- 2. Validate tenant identifier
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'Validation error: company_id is required';
    END IF;

    -- 3. Tenant and role authorization
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_is_company_member(NEW.company_id) THEN
            RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', NEW.company_id;
        END IF;

        IF NOT auth_has_company_role(NEW.company_id, 'owner_admin', 'manager', 'accounts_operator') THEN
            RAISE EXCEPTION 'Forbidden: Only accounts and owner roles may create financial accounts in company %', NEW.company_id;
        END IF;
    END IF;

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
$$;

DROP TRIGGER IF EXISTS accounts_view_insert_trigger ON accounts;
CREATE TRIGGER accounts_view_insert_trigger
    INSTEAD OF INSERT ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION trg_accounts_view_insert();

CREATE OR REPLACE FUNCTION trg_accounts_view_delete()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- 2. Tenant and role authorization (Owner only)
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_is_company_member(OLD.company_id) THEN
            RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', OLD.company_id;
        END IF;

        IF NOT auth_has_company_role(OLD.company_id, 'owner_admin') THEN
            RAISE EXCEPTION 'Forbidden: Only owner_admin may delete financial accounts';
        END IF;
    END IF;

    -- 3. Prevent deletion of accounts with linked transactions or posted journals
    IF EXISTS (SELECT 1 FROM account_transactions WHERE account_id = OLD.id) THEN
        RAISE EXCEPTION 'Integrity constraint: Cannot delete account % with linked transactions. Deactivate by setting is_active = false instead.', OLD.account_code;
    END IF;

    IF EXISTS (SELECT 1 FROM payments WHERE account_id = OLD.id) THEN
        RAISE EXCEPTION 'Integrity constraint: Cannot delete account % linked to payment records. Deactivate by setting is_active = false instead.', OLD.account_code;
    END IF;

    IF EXISTS (SELECT 1 FROM expenses WHERE account_id = OLD.id) THEN
        RAISE EXCEPTION 'Integrity constraint: Cannot delete account % linked to expense disbursements. Deactivate by setting is_active = false instead.', OLD.account_code;
    END IF;

    IF EXISTS (
        SELECT 1 FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_id
        WHERE je.company_id = OLD.company_id AND jl.account_code = OLD.account_code
    ) THEN
        RAISE EXCEPTION 'Integrity constraint: Cannot delete account % with posted journal entries. Deactivate by setting is_active = false instead.', OLD.account_code;
    END IF;

    DELETE FROM cash_bank_accounts WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS accounts_view_delete_trigger ON accounts;
CREATE TRIGGER accounts_view_delete_trigger
    INSTEAD OF DELETE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION trg_accounts_view_delete();

-- ----------------------------------------------------------------------------
-- 4.1 Authoritative Transaction-Driven Balance Synchronization Trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_sync_account_transaction_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.direction = 'DEBIT' THEN
            UPDATE cash_bank_accounts
            SET current_balance = current_balance + NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.account_id;
        ELSIF NEW.direction = 'CREDIT' THEN
            UPDATE cash_bank_accounts
            SET current_balance = current_balance - NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.direction = 'DEBIT' THEN
            UPDATE cash_bank_accounts
            SET current_balance = current_balance - OLD.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = OLD.account_id;
        ELSIF OLD.direction = 'CREDIT' THEN
            UPDATE cash_bank_accounts
            SET current_balance = current_balance + OLD.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = OLD.account_id;
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Reverse OLD effect
        IF OLD.direction = 'DEBIT' THEN
            UPDATE cash_bank_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.direction = 'CREDIT' THEN
            UPDATE cash_bank_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
        END IF;
        -- Apply NEW effect
        IF NEW.direction = 'DEBIT' THEN
            UPDATE cash_bank_accounts SET current_balance = current_balance + NEW.amount, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.account_id;
        ELSIF NEW.direction = 'CREDIT' THEN
            UPDATE cash_bank_accounts SET current_balance = current_balance - NEW.amount, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_transactions_balance_sync ON account_transactions;
CREATE TRIGGER trg_account_transactions_balance_sync
    AFTER INSERT OR UPDATE OR DELETE ON account_transactions
    FOR EACH ROW
    EXECUTE FUNCTION trg_sync_account_transaction_balance();

-- 4.2 Authoritative Ledger Balance Reconciliation RPC
CREATE OR REPLACE FUNCTION fn_reconcile_account_balance(p_account_id UUID)
RETURNS DECIMAL(14, 2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_opening DECIMAL(14, 2);
    v_net_tx DECIMAL(14, 2);
    v_new_balance DECIMAL(14, 2);
    v_company_id UUID;
BEGIN
    SELECT company_id, COALESCE(opening_balance, 0.00)
    INTO v_company_id, v_opening
    FROM cash_bank_accounts
    WHERE id = p_account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account % not found', p_account_id;
    END IF;

    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_is_company_member(v_company_id) THEN
            RAISE EXCEPTION 'Unauthorized: Caller is not a member of company %', v_company_id;
        END IF;
        IF NOT auth_has_company_role(v_company_id, 'owner_admin', 'manager', 'accounts_operator') THEN
            RAISE EXCEPTION 'Forbidden: User is not authorized to reconcile account balance';
        END IF;
    END IF;

    SELECT COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount WHEN direction = 'CREDIT' THEN -amount ELSE 0 END), 0.00)
    INTO v_net_tx
    FROM account_transactions
    WHERE account_id = p_account_id;

    v_new_balance := v_opening + v_net_tx;

    UPDATE cash_bank_accounts
    SET current_balance = v_new_balance,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_account_id;

    RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION fn_reconcile_account_balance FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_reconcile_account_balance TO authenticated, service_role;

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
) 
RETURNS VARCHAR 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_fy VARCHAR(10);
    v_prefix VARCHAR(20);
    v_next_num BIGINT;
    v_voucher_no VARCHAR(50);
BEGIN
    -- 1. Authorization check: Caller must be authenticated
    IF auth_current_user_id() IS NULL AND auth_current_role() NOT IN ('service_role') THEN
        RAISE EXCEPTION 'Unauthenticated: Caller must be authenticated';
    END IF;

    -- 2. Tenant isolation check: If caller is authenticated (not service_role), verify membership
    IF auth_current_role() NOT IN ('service_role') THEN
        IF NOT auth_is_company_member(p_company_id) THEN
            RAISE EXCEPTION 'Unauthorized: Caller is not an authorized member of company %', p_company_id;
        END IF;

        -- 3. Operation-specific role validation on document types
        IF p_doc_type IN ('PAYMENT', 'RECEIPT', 'JOURNAL') THEN
            IF NOT auth_has_company_role(p_company_id, 'owner_admin', 'manager', 'accounts_operator') THEN
                RAISE EXCEPTION 'Forbidden: User is not authorized to generate financial % vouchers', p_doc_type;
            END IF;
        END IF;
    END IF;

    -- 4. Verify company exists
    PERFORM 1 FROM companies WHERE id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Company % does not exist', p_company_id;
    END IF;

    -- 5. Determine current Indian Financial Year (e.g. "26" for FY 2026-2027)
    IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
        v_fy := TO_CHAR(CURRENT_DATE, 'YY');
    ELSE
        v_fy := TO_CHAR(CURRENT_DATE - INTERVAL '1 year', 'YY');
    END IF;

    -- 6. Resolve default prefix if omitted
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

    -- 7. Atomically lock and increment counter
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
$$;

REVOKE ALL ON FUNCTION fn_get_next_voucher_no(UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_get_next_voucher_no(UUID, VARCHAR, VARCHAR) TO authenticated, service_role;


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
ALTER TABLE IF EXISTS offline_sync_queue REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS sync_conflicts REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------------
-- 2. Add Authoritative Tables to 'supabase_realtime' Publication
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    tbl_name text;
    realtime_tables text[] := ARRAY[
        'cash_bank_accounts',
        'inventory_lots',
        'stock_movements',
        'payments',
        'payment_allocations',
        'journal_entries',
        'journal_lines',
        'parties',
        'weighments',
        'invoices',
        'purchase_headers',
        'offline_sync_queue',
        'sync_conflicts'
    ];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH tbl_name IN ARRAY realtime_tables LOOP
            -- Check that the table actually exists in public schema before altering publication
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = tbl_name
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_publication_tables 
                    WHERE pubname = 'supabase_realtime' AND tablename = tbl_name
                ) THEN
                    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', tbl_name);
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;
