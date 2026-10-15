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
