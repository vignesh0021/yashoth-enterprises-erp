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
    ROUND(a.opening_balance 
        + COALESCE(SUM(CASE WHEN at.direction = 'DEBIT' THEN at.amount ELSE 0 END), 0) 
        - COALESCE(SUM(CASE WHEN at.direction = 'CREDIT' THEN at.amount ELSE 0 END), 0)
    , 2) AS current_reconciled_balance
FROM cash_bank_accounts a
LEFT JOIN account_transactions at ON at.account_id = a.id
GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.opening_balance;
