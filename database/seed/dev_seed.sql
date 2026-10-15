-- Yasoth Enterprises — Production Scrap ERP
-- Development Seed Data (DEV MODE ONLY — NOT FOR PRODUCTION)
-- Clearly marked development fixtures for testing and workflow simulation

-- Company Profile (Configured from verified letterhead & template details)
INSERT INTO company_settings (
    id, company_name, legal_name, address_line1, address_line2, 
    city, state_name, state_code, pincode, gstin, phone, email, 
    bank_name, bank_account_no, bank_branch_ifsc, invoice_prefix, default_base_unit
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'YASHOTH ENTERPRISES',
    'YASHOTH ENTERPRISES',
    'NO.128/40, Dr.AMBEDKAR STREET',
    'PERUVAYAL JUNCTION, KAVARAPETTAI',
    'GUMMIDIPOODI, Tiruvallur',
    'Tamil Nadu',
    '33',
    '601206',
    '33AXVPN9382L1ZF',
    '+91 94440 12345',
    'yashothenterprises2022@gmail.com',
    'CITY UNION BANK',
    '510909010195638',
    'PONNERI & CIUB0000439',
    'YE/',
    'KG'
) ON CONFLICT DO NOTHING;

-- Standard Yards
INSERT INTO yards (id, code, name, location_address, is_active) VALUES
('b0000000-0000-0000-0000-000000000001', 'YARD-01', 'Main Yard — Gummidipoondi', 'Peruvayal Junction, Kavarapettai, Gummidipoondi', true),
('b0000000-0000-0000-0000-000000000002', 'YARD-02', 'Storage Yard — Ponneri', 'Bypass Road, Ponneri Industrial Belt', true)
ON CONFLICT (code) DO NOTHING;

-- Materials Master
INSERT INTO materials (id, code, name, category, base_unit, hsn_code, default_purchase_rate, default_sales_rate, default_gst_rate, min_stock_alert) VALUES
('c0000000-0000-0000-0000-000000000001', 'MAT-MS-BORING', 'MS Boring Scrap', 'Steel', 'KG', '7204', 28.00, 31.50, 18.00, 2000.000),
('c0000000-0000-0000-0000-000000000002', 'MAT-HMS1', 'Heavy Melting Scrap (HMS 1)', 'Steel', 'KG', '7204', 33.50, 37.00, 18.00, 3000.000),
('c0000000-0000-0000-0000-000000000003', 'MAT-AL-CAST', 'Aluminium Casting Scrap', 'Aluminium', 'KG', '7602', 135.00, 152.00, 18.00, 500.000),
('c0000000-0000-0000-0000-000000000004', 'MAT-CU-ARMAT', 'Copper Armature Wire Scrap', 'Copper', 'KG', '7404', 680.00, 740.00, 18.00, 200.000),
('c0000000-0000-0000-0000-000000000005', 'MAT-BRASS-HONEY', 'Brass Honey Scrap', 'Brass', 'KG', '7404', 420.00, 465.00, 18.00, 200.000),
('c0000000-0000-0000-0000-000000000006', 'MAT-CI-ROTORS', 'Cast Iron Machinery Scrap', 'Iron', 'KG', '7204', 26.00, 29.50, 18.00, 2000.000),
('c0000000-0000-0000-0000-000000000007', 'MAT-PL-HDPE', 'HDPE Industrial Drum Scrap', 'Plastic', 'KG', '3915', 38.00, 44.00, 18.00, 1000.000)
ON CONFLICT (code) DO NOTHING;

-- Material Grades
INSERT INTO material_grades (id, material_id, grade_code, grade_name, rate_adjustment) VALUES
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'GRADE-A', 'Grade A Clean Machine Boring', 0.00),
('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'GRADE-B', 'Grade B Oil Contaminated Boring', -2.00),
('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'GRADE-HMS1', 'Heavy Melting Steel > 6mm', 0.00),
('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'GRADE-HMS2', 'Heavy Melting Steel < 6mm', -1.50)
ON CONFLICT (material_id, grade_code) DO NOTHING;

-- Realistic Sample Parties
INSERT INTO parties (id, party_code, legal_name, trade_name, party_type, contact_person, phone, email, address_line1, city, state_name, state_code, gstin, opening_balance) VALUES
('e0000000-0000-0000-0000-000000000001', 'SUP-001', 'Sri Balaji Auto Forge Pvt Ltd', 'Sri Balaji Forge', 'SUPPLIER', 'K. Venkat', '+91 98401 23456', 'procurement@balajiforge.com', 'Plot 45, SIPCOT Phase 2', 'Gummidipoondi', 'Tamil Nadu', '33', '33AAACB1234D1Z2', 0.00),
('e0000000-0000-0000-0000-000000000002', 'SUP-002', 'Apex Precision Components', 'Apex Components', 'SUPPLIER', 'R. Sriram', '+91 97902 34567', 'accounts@apexcomponents.in', '78 Industrial Estate', 'Ponneri', 'Tamil Nadu', '33', '33AACCA5678E1Z4', -15000.00),
('e0000000-0000-0000-0000-000000000003', 'CUST-001', 'Metro Steel Re-Rolling Mill', 'Metro Steel', 'CUSTOMER', 'B. Agarwal', '+91 99403 45678', 'orders@metrosteel.com', 'Survey No 102, GNT Road', 'Tiruvallur', 'Tamil Nadu', '33', '33AABCM9876F1Z8', 85000.00),
('e0000000-0000-0000-0000-000000000004', 'CUST-002', 'Premier Castings & Alloys', 'Premier Foundries', 'CUSTOMER', 'V. Natarajan', '+91 98804 56789', 'natarajan@premiercastings.in', '34 Foundry Zone', 'Ambattur', 'Tamil Nadu', '33', '33AAACP4321G1Z6', 42000.00),
('e0000000-0000-0000-0000-000000000005', 'BOTH-001', 'Kavaraipettai Metal Traders', 'KMT Scrap', 'BOTH', 'D. Anand', '+91 94445 67890', 'anand@kmtscrap.com', 'Peruvayal Main Road', 'Kavaraipettai', 'Tamil Nadu', '33', '33AADFK7788H1Z1', 0.00)
ON CONFLICT (party_code) DO NOTHING;

-- Company Vehicles
INSERT INTO vehicles (id, registration_no, vehicle_type, ownership_type, driver_name, driver_phone, tare_weight) VALUES
('f0000000-0000-0000-0000-000000000001', 'TN 18 BY 0420', 'Lorry (16-Ton)', 'OWNED', 'K. Senthil', '+91 94441 11222', 4500.000),
('f0000000-0000-0000-0000-000000000002', 'TN 20 CR 8891', 'Mini Truck (Tata 407)', 'OWNED', 'M. Raman', '+91 94442 22333', 2450.000)
ON CONFLICT (registration_no) DO NOTHING;

-- Vehicle Documents
INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, reminder_days_before) VALUES
('f0000000-0000-0000-0000-000000000001', 'INSURANCE', 'POL-ICICI-2026-9901', '2025-11-15', '2026-11-14', 30),
('f0000000-0000-0000-0000-000000000001', 'FITNESS', 'FIT-TN18-2026-44', '2025-12-01', '2026-11-30', 20),
('f0000000-0000-0000-0000-000000000002', 'INSURANCE', 'POL-NEWINDIA-2026-11', '2025-10-25', '2026-10-24', 15);

-- Accounts
INSERT INTO cash_bank_accounts (id, account_code, account_name, account_type, bank_name, account_number, ifsc_code, opening_balance) VALUES
('10000000-0000-0000-0000-000000000001', 'CASH-YARD', 'Yard Petty Cash Box', 'CASH', NULL, NULL, NULL, 50000.00),
('10000000-0000-0000-0000-000000000002', 'BANK-CUB', 'City Union Bank (Ponneri)', 'BANK', 'City Union Bank', '510909010195638', 'CIUB0000439', 250000.00)
ON CONFLICT (account_code) DO NOTHING;

-- Employees
INSERT INTO employees (id, employee_code, full_name, designation, department, phone, joining_date, daily_wage_rate, monthly_salary) VALUES
('20000000-0000-0000-0000-000000000001', 'EMP-001', 'S. Rajan', 'Yard Supervisor', 'Operations', '+91 94440 55667', '2022-01-15', 0.00, 28000.00),
('20000000-0000-0000-0000-000000000002', 'EMP-002', 'M. Kumar', 'Weighbridge Operator', 'Weighment', '+91 94440 66778', '2022-04-10', 0.00, 22000.00),
('20000000-0000-0000-0000-000000000003', 'EMP-003', 'K. Senthil', 'Senior Heavy Driver', 'Transport', '+91 94441 11222', '2022-06-01', 0.00, 24000.00),
('20000000-0000-0000-0000-000000000004', 'EMP-004', 'P. Murugan', 'Scrap Loader & Sorter', 'Yard Labor', '+91 94440 88990', '2023-02-01', 650.00, 0.00)
ON CONFLICT (employee_code) DO NOTHING;
