-- ============================================================================
-- Migration 014: Complete Material Inventory Traceability, Multi-Source Dispatch,
-- Internal Godown Transfers, Document Storage & Quota Governance
-- NOTE: Requires explicit production approval before applying to live Supabase.
-- ============================================================================

-- 1. Extend Material Master with grade, specification, default yard, status
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS default_grade VARCHAR(80),
    ADD COLUMN IF NOT EXISTS specification TEXT,
    ADD COLUMN IF NOT EXISTS default_yard_id UUID REFERENCES yards(id),
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED'));

-- 2. Extend Weighments with weighbridge bill, location, party, charge, checksum & OCR verification
ALTER TABLE weighments
    ADD COLUMN IF NOT EXISTS bill_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS weighbridge_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS weighbridge_location VARCHAR(200),
    ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id),
    ADD COLUMN IF NOT EXISTS party_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS weighbridge_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS weighment_date DATE,
    ADD COLUMN IF NOT EXISTS slip_attachment_id UUID,
    ADD COLUMN IF NOT EXISTS slip_checksum VARCHAR(64),
    ADD COLUMN IF NOT EXISTS ocr_extracted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ocr_verified_by VARCHAR(150),
    ADD COLUMN IF NOT EXISTS ocr_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS linked_transaction_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_weighments_company_checksum
    ON weighments (company_id, slip_checksum)
    WHERE slip_checksum IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_weighments_company_bill_vehicle_date
    ON weighments (company_id, bill_number, vehicle_registration, weighment_date)
    WHERE bill_number IS NOT NULL AND vehicle_registration IS NOT NULL AND weighment_date IS NOT NULL;

-- 3. Extend Purchase Headers with PO, supplier invoice, driver, weighment & verification fields
ALTER TABLE purchase_headers
    ADD COLUMN IF NOT EXISTS po_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(80),
    ADD COLUMN IF NOT EXISTS supplier_invoice_date DATE,
    ADD COLUMN IF NOT EXISTS driver_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(30),
    ADD COLUMN IF NOT EXISTS gross_weight NUMERIC(14,3),
    ADD COLUMN IF NOT EXISTS tare_weight NUMERIC(14,3),
    ADD COLUMN IF NOT EXISTS net_weight NUMERIC(14,3),
    ADD COLUMN IF NOT EXISTS accepted_weight NUMERIC(14,3),
    ADD COLUMN IF NOT EXISTS rejected_weight NUMERIC(14,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS weighbridge_slip_attachment_id UUID,
    ADD COLUMN IF NOT EXISTS invoice_attachment_id UUID,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
        CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    ADD COLUMN IF NOT EXISTS ocr_source BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_user_verified BOOLEAN NOT NULL DEFAULT TRUE;

-- 4. Extend Inventory Lots for complete source-wise traceability
ALTER TABLE inventory_lots
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'PURCHASE'
        CHECK (source_type IN ('PURCHASE', 'OPENING_STOCK', 'TRANSFER_IN', 'SALES_RETURN')),
    ADD COLUMN IF NOT EXISTS source_transfer_id UUID,
    ADD COLUMN IF NOT EXISTS supplier_party_id UUID REFERENCES parties(id),
    ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS purchase_order_no VARCHAR(80),
    ADD COLUMN IF NOT EXISTS original_invoice_no VARCHAR(80),
    ADD COLUMN IF NOT EXISTS grade_name VARCHAR(80),
    ADD COLUMN IF NOT EXISTS allocated_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
    ADD COLUMN IF NOT EXISTS dispatched_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (dispatched_quantity >= 0),
    ADD COLUMN IF NOT EXISTS returned_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0);

-- 5. Enforce Append-Only Immutability on stock_movements (Phase 12)
CREATE OR REPLACE FUNCTION fn_prevent_stock_movement_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'stock_movements is append-only. Use reversal movements instead of %.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_append_only ON stock_movements;
CREATE TRIGGER trg_stock_movements_append_only
    BEFORE UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_stock_movement_mutation();

-- 6. Material Dispatches & Multi-Source Lot Allocations (Phase 2)
CREATE TABLE IF NOT EXISTS material_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    dispatch_no VARCHAR(60) NOT NULL,
    customer_party_id UUID REFERENCES parties(id),
    destination_name VARCHAR(200) NOT NULL,
    destination_yard_id UUID REFERENCES yards(id),
    material_id UUID NOT NULL REFERENCES materials(id),
    grade_id UUID REFERENCES material_grades(id),
    grade_name VARCHAR(80),
    vehicle_registration VARCHAR(40) NOT NULL,
    driver_name VARCHAR(150),
    driver_phone VARCHAR(30),
    dispatch_date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_completion_date DATE,
    source_yard_id UUID NOT NULL REFERENCES yards(id),
    gross_weight NUMERIC(14,3) NOT NULL CHECK (gross_weight >= 0),
    tare_weight NUMERIC(14,3) NOT NULL CHECK (tare_weight >= 0),
    net_weight NUMERIC(14,3) NOT NULL CHECK (net_weight > 0),
    total_allocated_weight NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (total_allocated_weight >= 0),
    weight_discrepancy NUMERIC(14,3) NOT NULL DEFAULT 0,
    weighment_id UUID REFERENCES weighments(id),
    weighbridge_bill_no VARCHAR(80),
    weighbridge_name VARCHAR(150),
    weighbridge_location VARCHAR(200),
    weighbridge_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
    delivery_challan_no VARCHAR(80),
    sales_header_id UUID REFERENCES sales_headers(id),
    invoice_id UUID REFERENCES invoices(id),
    dispatch_employee VARCHAR(150) NOT NULL,
    approval_status VARCHAR(30) NOT NULL DEFAULT 'APPROVED'
        CHECK (approval_status IN ('DRAFT', 'PENDING_VERIFICATION', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'DISPUTED', 'CANCELLED')),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_DISPATCH'
        CHECK (status IN ('PENDING_DISPATCH', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED', 'CANCELLED')),
    unloading_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (unloading_status IN ('PENDING', 'COMPLETED')),
    idempotency_key VARCHAR(120),
    notes TEXT,
    created_by VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, dispatch_no),
    UNIQUE (company_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS material_dispatch_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    dispatch_id UUID NOT NULL REFERENCES material_dispatches(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    lot_number VARCHAR(80) NOT NULL,
    source_type VARCHAR(30) NOT NULL,
    supplier_party_id UUID REFERENCES parties(id),
    supplier_name VARCHAR(200),
    source_purchase_id UUID REFERENCES purchase_headers(id),
    original_invoice_no VARCHAR(80),
    allocated_quantity NUMERIC(14,3) NOT NULL CHECK (allocated_quantity > 0),
    unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Internal Godown Transfers & Receipts (Phase 3)
CREATE TABLE IF NOT EXISTS godown_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    transfer_no VARCHAR(60) NOT NULL,
    source_yard_id UUID NOT NULL REFERENCES yards(id),
    destination_yard_id UUID NOT NULL REFERENCES yards(id),
    material_id UUID NOT NULL REFERENCES materials(id),
    grade_id UUID REFERENCES material_grades(id),
    grade_name VARCHAR(80),
    quantity_dispatched NUMERIC(14,3) NOT NULL CHECK (quantity_dispatched > 0),
    quantity_received NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    shortage_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (shortage_quantity >= 0),
    excess_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (excess_quantity >= 0),
    dispatch_weighment_id UUID REFERENCES weighments(id),
    receiving_weighment_id UUID REFERENCES weighments(id),
    vehicle_registration VARCHAR(40) NOT NULL,
    driver_name VARCHAR(150),
    driver_phone VARCHAR(30),
    dispatch_employee VARCHAR(150) NOT NULL,
    receiving_employee VARCHAR(150),
    transfer_date DATE NOT NULL,
    expected_date DATE,
    receiving_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'APPROVED', 'PENDING', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'DISPUTED', 'CANCELLED')),
    dispute_reason TEXT,
    idempotency_key VARCHAR(120),
    notes TEXT,
    created_by VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (source_yard_id <> destination_yard_id),
    UNIQUE (company_id, transfer_no),
    UNIQUE (company_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS godown_transfer_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    transfer_id UUID NOT NULL REFERENCES godown_transfers(id) ON DELETE CASCADE,
    receipt_no VARCHAR(60) NOT NULL,
    received_date DATE NOT NULL,
    received_quantity NUMERIC(14,3) NOT NULL CHECK (received_quantity > 0),
    shortage_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (shortage_quantity >= 0),
    excess_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (excess_quantity >= 0),
    receiving_weighment_id UUID REFERENCES weighments(id),
    receiving_employee VARCHAR(150) NOT NULL,
    idempotency_key VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, receipt_no),
    UNIQUE (company_id, idempotency_key)
);

-- 8. Managed Documents & Storage Quota Config (Phases 7, 8 & 9)
CREATE TABLE IF NOT EXISTS managed_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    document_type VARCHAR(40) NOT NULL,
    document_number VARCHAR(100),
    transaction_ref VARCHAR(100),
    party_name VARCHAR(200),
    storage_provider VARCHAR(30) NOT NULL
        CHECK (storage_provider IN ('GOOGLE_DRIVE', 'SUPABASE_STORAGE', 'LOCAL_IDB')),
    remote_file_id VARCHAR(200),
    storage_path TEXT,
    original_file_name VARCHAR(255) NOT NULL,
    original_mime_type VARCHAR(100) NOT NULL,
    original_size_bytes BIGINT NOT NULL CHECK (original_size_bytes >= 0),
    preview_mime_type VARCHAR(50),
    preview_size_bytes BIGINT CHECK (preview_size_bytes >= 0),
    sha256_checksum VARCHAR(64) NOT NULL,
    ocr_text TEXT,
    ocr_verified BOOLEAN NOT NULL DEFAULT FALSE,
    upload_status VARCHAR(25) NOT NULL DEFAULT 'PENDING_UPLOAD'
        CHECK (upload_status IN ('PENDING_UPLOAD', 'UPLOADED', 'VERIFIED', 'FAILED')),
    migration_status VARCHAR(25),
    legacy_document_id VARCHAR(120),
    uploaded_by VARCHAR(150) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_managed_documents_dedup
    ON managed_documents (company_id, sha256_checksum, document_type, document_number);

CREATE TABLE IF NOT EXISTS storage_quota_configs (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    postgres_limit_mb NUMERIC(12,2) NOT NULL DEFAULT 500,
    file_storage_limit_mb NUMERIC(12,2) NOT NULL DEFAULT 1024,
    egress_limit_mb NUMERIC(12,2) NOT NULL DEFAULT 5120,
    warning_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 70,
    critical_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 85,
    admin_alert_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 95,
    restrict_uploads_at_admin_alert BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend backup_history with real remote verification metadata
ALTER TABLE backup_history
    ADD COLUMN IF NOT EXISTS remote_file_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS compression_format VARCHAR(20) NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS compressed_size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS remote_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS remote_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS schedule_tag VARCHAR(30) DEFAULT 'MANUAL';

-- 9. Strict Tenant RLS Policies
ALTER TABLE material_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_dispatch_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE godown_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE godown_transfer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_quota_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS material_dispatches_tenant_policy ON material_dispatches;
CREATE POLICY material_dispatches_tenant_policy ON material_dispatches FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS material_dispatch_allocations_tenant_policy ON material_dispatch_allocations;
CREATE POLICY material_dispatch_allocations_tenant_policy ON material_dispatch_allocations FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS godown_transfers_tenant_policy ON godown_transfers;
CREATE POLICY godown_transfers_tenant_policy ON godown_transfers FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS godown_transfer_receipts_tenant_policy ON godown_transfer_receipts;
CREATE POLICY godown_transfer_receipts_tenant_policy ON godown_transfer_receipts FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS managed_documents_tenant_policy ON managed_documents;
CREATE POLICY managed_documents_tenant_policy ON managed_documents FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

DROP POLICY IF EXISTS storage_quota_configs_tenant_policy ON storage_quota_configs;
CREATE POLICY storage_quota_configs_tenant_policy ON storage_quota_configs FOR ALL
    USING (auth_is_company_member(company_id))
    WITH CHECK (auth_is_company_member(company_id));

-- 10. Atomic Multi-Source Dispatch Posting RPC (Prevents partial/duplicate deductions)
CREATE OR REPLACE FUNCTION fn_post_multi_source_dispatch_atomic(
    p_company_id UUID,
    p_dispatch_no VARCHAR,
    p_destination_name VARCHAR,
    p_material_id UUID,
    p_source_yard_id UUID,
    p_vehicle_registration VARCHAR,
    p_gross_weight NUMERIC,
    p_tare_weight NUMERIC,
    p_allocations JSONB,
    p_dispatch_employee VARCHAR,
    p_idempotency_key VARCHAR,
    p_weighment_id UUID DEFAULT NULL,
    p_weighbridge_bill_no VARCHAR DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_existing_id UUID;
    v_dispatch_id UUID;
    v_net_weight NUMERIC := ROUND(p_gross_weight - p_tare_weight, 3);
    v_total_alloc NUMERIC := 0;
    v_alloc JSONB;
    v_lot RECORD;
    v_alloc_qty NUMERIC;
BEGIN
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized company access';
    END IF;

    IF v_net_weight <= 0 THEN
        RAISE EXCEPTION 'Net weight must be positive (Gross % - Tare %)', p_gross_weight, p_tare_weight;
    END IF;

    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id FROM material_dispatches
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    INSERT INTO material_dispatches (
        company_id, dispatch_no, destination_name, material_id, source_yard_id,
        vehicle_registration, gross_weight, tare_weight, net_weight,
        weighment_id, weighbridge_bill_no, dispatch_employee,
        approval_status, status, idempotency_key, created_by
    ) VALUES (
        p_company_id, p_dispatch_no, p_destination_name, p_material_id, p_source_yard_id,
        p_vehicle_registration, p_gross_weight, p_tare_weight, v_net_weight,
        p_weighment_id, p_weighbridge_bill_no, p_dispatch_employee,
        'DISPATCHED', 'IN_TRANSIT', p_idempotency_key, p_dispatch_employee
    ) RETURNING id INTO v_dispatch_id;

    FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
        v_alloc_qty := ROUND((v_alloc->>'allocatedQuantity')::NUMERIC, 3);
        IF v_alloc_qty <= 0 THEN
            RAISE EXCEPTION 'Allocation quantity must be positive';
        END IF;

        SELECT * INTO v_lot FROM inventory_lots
        WHERE id = (v_alloc->>'lotId')::UUID AND company_id = p_company_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Inventory lot % not found in company', v_alloc->>'lotId';
        END IF;

        IF v_lot.remaining_quantity < v_alloc_qty THEN
            RAISE EXCEPTION 'Insufficient stock in lot %. Available: %, Requested: %',
                v_lot.lot_number, v_lot.remaining_quantity, v_alloc_qty;
        END IF;

        UPDATE inventory_lots
        SET remaining_quantity = ROUND(remaining_quantity - v_alloc_qty, 3),
            dispatched_quantity = ROUND(dispatched_quantity + v_alloc_qty, 3),
            is_exhausted = (ROUND(remaining_quantity - v_alloc_qty, 3) <= 0)
        WHERE id = v_lot.id;

        INSERT INTO material_dispatch_allocations (
            company_id, dispatch_id, lot_id, lot_number, source_type,
            supplier_party_id, supplier_name, source_purchase_id, original_invoice_no,
            allocated_quantity, unit_cost, total_cost
        ) VALUES (
            p_company_id, v_dispatch_id, v_lot.id, v_lot.lot_number, v_lot.source_type,
            v_lot.supplier_party_id, v_lot.supplier_name, v_lot.source_purchase_id, v_lot.original_invoice_no,
            v_alloc_qty, v_lot.unit_cost, ROUND(v_alloc_qty * v_lot.unit_cost, 2)
        );

        INSERT INTO stock_movements (
            company_id, movement_type, transaction_ref, material_id, grade_id,
            yard_id, lot_id, quantity, unit_cost, total_cost, notes, created_by
        ) VALUES (
            p_company_id, 'SALES_DISPATCH', p_dispatch_no, v_lot.material_id, v_lot.grade_id,
            v_lot.yard_id, v_lot.id, -v_alloc_qty, v_lot.unit_cost,
            ROUND(v_alloc_qty * v_lot.unit_cost, 2),
            'Multi-source dispatch to ' || p_destination_name || ' from lot ' || v_lot.lot_number,
            p_dispatch_employee
        );

        v_total_alloc := ROUND(v_total_alloc + v_alloc_qty, 3);
    END LOOP;

    UPDATE material_dispatches
    SET total_allocated_weight = v_total_alloc,
        weight_discrepancy = ROUND(v_total_alloc - v_net_weight, 3),
        updated_at = NOW()
    WHERE id = v_dispatch_id;

    RETURN v_dispatch_id;
END;
$$;

-- 11. Atomic Godown Transfer Receipt RPC (Prevents duplicate receipts)
CREATE OR REPLACE FUNCTION fn_confirm_godown_transfer_receipt_atomic(
    p_company_id UUID,
    p_transfer_id UUID,
    p_receipt_no VARCHAR,
    p_received_date DATE,
    p_received_quantity NUMERIC,
    p_receiving_employee VARCHAR,
    p_idempotency_key VARCHAR,
    p_receiving_weighment_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_transfer RECORD;
    v_existing_receipt UUID;
    v_receipt_id UUID;
    v_new_total_received NUMERIC;
    v_shortage NUMERIC := 0;
    v_excess NUMERIC := 0;
    v_next_status VARCHAR(30);
    v_dest_lot_id UUID;
BEGIN
    IF NOT auth_is_company_member(p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized company access';
    END IF;

    IF p_received_quantity <= 0 THEN
        RAISE EXCEPTION 'Received quantity must be positive';
    END IF;

    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_receipt FROM godown_transfer_receipts
        WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
        IF v_existing_receipt IS NOT NULL THEN
            RETURN v_existing_receipt;
        END IF;
    END IF;

    SELECT * INTO v_transfer FROM godown_transfers
    WHERE id = p_transfer_id AND company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Godown transfer not found';
    END IF;

    IF v_transfer.status NOT IN ('IN_TRANSIT', 'PARTIALLY_RECEIVED') THEN
        RAISE EXCEPTION 'Transfer % cannot be received in status %', v_transfer.transfer_no, v_transfer.status;
    END IF;

    v_new_total_received := ROUND(v_transfer.quantity_received + p_received_quantity, 3);
    IF v_new_total_received < v_transfer.quantity_dispatched THEN
        v_shortage := ROUND(v_transfer.quantity_dispatched - v_new_total_received, 3);
        v_next_status := 'PARTIALLY_RECEIVED';
    ELSIF v_new_total_received > v_transfer.quantity_dispatched THEN
        v_excess := ROUND(v_new_total_received - v_transfer.quantity_dispatched, 3);
        v_next_status := 'RECEIVED';
    ELSE
        v_next_status := 'RECEIVED';
    END IF;

    INSERT INTO godown_transfer_receipts (
        company_id, transfer_id, receipt_no, received_date, received_quantity,
        shortage_quantity, excess_quantity, receiving_weighment_id, receiving_employee,
        idempotency_key, notes
    ) VALUES (
        p_company_id, p_transfer_id, p_receipt_no, p_received_date, p_received_quantity,
        v_shortage, v_excess, p_receiving_weighment_id, p_receiving_employee,
        p_idempotency_key, p_notes
    ) RETURNING id INTO v_receipt_id;

    INSERT INTO inventory_lots (
        company_id, lot_number, material_id, grade_id, grade_name, yard_id,
        source_type, source_transfer_id, initial_quantity, remaining_quantity,
        unit_cost, received_at, is_exhausted
    ) VALUES (
        p_company_id, 'LOT-TRF-' || p_receipt_no, v_transfer.material_id, v_transfer.grade_id,
        v_transfer.grade_name, v_transfer.destination_yard_id, 'TRANSFER_IN', p_transfer_id,
        p_received_quantity, p_received_quantity, 0, NOW(), FALSE
    ) RETURNING id INTO v_dest_lot_id;

    INSERT INTO stock_movements (
        company_id, movement_type, transaction_ref, material_id, grade_id,
        yard_id, lot_id, quantity, unit_cost, total_cost, notes, created_by
    ) VALUES (
        p_company_id, 'YARD_TRANSFER_IN', v_transfer.transfer_no, v_transfer.material_id,
        v_transfer.grade_id, v_transfer.destination_yard_id, v_dest_lot_id,
        p_received_quantity, 0, 0,
        'Transfer receipt ' || p_receipt_no || ' at destination godown',
        p_receiving_employee
    );

    UPDATE godown_transfers
    SET quantity_received = v_new_total_received,
        shortage_quantity = v_shortage,
        excess_quantity = v_excess,
        receiving_weighment_id = COALESCE(p_receiving_weighment_id, receiving_weighment_id),
        receiving_employee = p_receiving_employee,
        receiving_date = p_received_date,
        status = v_next_status,
        updated_at = NOW()
    WHERE id = p_transfer_id;

    RETURN v_receipt_id;
END;
$$;
