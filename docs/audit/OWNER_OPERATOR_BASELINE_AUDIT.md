# OWNER-OPERATOR BASELINE AUDIT

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `fix/finance-accounting-integrity`  
**Audited Commit:** `dc078c16ee6d81790dacb1ea07c352807caca1c4`  
**Audit Mode:** Read-only static source & schema inspection (no code modified, no migrations executed)

---

## 1. Repository & Module Inventory

| Area | Primary Source Files | Existing Database Tables | Current Capability Summary |
| :--- | :--- | :--- | :--- |
| **Vehicles & Compliance** | `src/modules/vehicles/VehiclesView.tsx`, `backend/business-rules/vehicleComplianceEngine.ts`, `src/types/index.ts#L503-L526` | `vehicles`, `vehicle_documents` (`001_initial_schema.sql#L119-L142`) | Tracks registration, type, `ownershipType` (`OWNED`, `HIRED`, `CUSTOMER_VEHICLE`, `SUPPLIER_VEHICLE`), tare weight, compliance docs, and free-text `driverName` / `driverPhone`. |
| **Collection / Pickup Jobs** | `src/modules/collections/CollectionsView.tsx`, `src/context/ERPContext.tsx#L1033-L1068`, `src/types/index.ts#L187-L204` | `collection_jobs` (`001_initial_schema.sql#L216-L232`) | Single-supplier, single-material pickup workflow with `assignedVehicleId`, `assignedStaffId`, `transportExpenses`, and 1:1 `resultingPurchaseId`. |
| **Weighments** | `src/modules/weighment/WeighmentView.tsx`, `src/context/ERPContext.tsx#L976-L994`, `src/types/index.ts#L163-L183` | `weighments` (`001_initial_schema.sql#L192-L213`) | Records gross/tare/net/deductions/payable weight with `vehicleRegistration` string. Not linked to a multi-load trip header. |
| **Purchase Inward** | `src/modules/purchases/PurchasesView.tsx`, `backend/business-rules/purchaseEngine.ts#L14-L90`, `src/context/ERPContext.tsx#L996-L1031` | `purchase_headers`, `purchase_lines`, `inventory_lots`, `stock_movements` (`001_initial_schema.sql#L235-L311`) | Multi-line material inward per purchase, posts FIFO lots, stock movements, and `5010`/`5030`/`2010` journal entry (`createPurchaseInvoiceJournal`). |
| **Parties (Suppliers/Customers)** | `src/modules/parties/PartiesView.tsx`, `src/types/index.ts#L116-L158` | `parties` (`001_initial_schema.sql#L93-L116`) | Unified `SUPPLIER`, `CUSTOMER`, `BOTH` master with GSTIN, credit limit, opening balance. No `TRANSPORTER` or `DRIVER` role. |
| **Employees & Payroll** | `src/modules/employees/EmployeesView.tsx`, `src/context/ERPContext.tsx#L2694-L2757`, `src/types/index.ts#L528-L559` | `employees`, `attendance_entries`, `salary_records`, `employee_advances` (`001`, `008`, `009`) | Staff roster, attendance calendar, overtime/double shift, salary accrual/disbursement, advances. No `is_owner` or `exclude_from_payroll` flag. |
| **Expenses & Cashflow** | `src/modules/finance/FinanceView.tsx`, `backend/business-rules/financeEngine.ts`, `src/context/ERPContext.tsx#L1239-L1306` | `expenses`, `cash_bank_accounts`, `account_transactions` (`001`, `008`, `010`) | Expense vouchers (`PAID`/`UNPAID`), `vehicleId` optional link, cash/bank accounts with `OWNER_INJECTION` / `OWNER_DRAWING` transaction types. |
| **Payments & Allocations** | `src/modules/payments/PaymentsView.tsx`, `backend/business-rules/financeEngine.ts#L28-L149`, `src/context/ERPContext.tsx#L1149-L1191` | `payments`, `payment_allocations` (`001_initial_schema.sql#L406-L429`) | Single-`partyId` inflow/outflow vouchers (`CASH`, `NEFT_RTGS`, `UPI`, `CHEQUE`, `IMPS`) with invoice/purchase allocations. |
| **Double-Entry Accounting** | `backend/business-rules/accountingEngine.ts#L75-L2047` | `chart_of_accounts`, `journal_entries`, `journal_lines` (`005_accounting_and_documents.sql`) | Balanced Debits=Credits journals (`validateJournalEntry`), Trial Balance, P&L, Balance Sheet, Party Statement. |
| **RLS, Auth & Audit/Backup** | `backend/business-rules/authEngine.ts`, `database/migrations/003`, `006`, `007`, `009`, `010`, `011` | `company_memberships`, `audit_logs`, `backup_history`, `restore_logs` | `company_id` tenant isolation (`auth_is_company_member`, `auth_has_company_role`), audit logging (`logAudit`), encrypted backups. |

---

## 2. Owner-Operator Compatibility Audit (8 Required Scenarios)

| # | Scenario | Status | Severity | Actual Source & DB Evidence | Gap & Business/Accounting Risk |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Company owner driving a company-owned vehicle** | **PARTIAL** | **MEDIUM** | `Vehicle` (`src/types/index.ts#L503-L513`, `vehicles` table) has `ownershipType: 'OWNED'` and free-text `driverName` / `driverPhone`. | No `isOwnerDriven` flag or link to `users_roles`/`employees`. If the owner is added to `employees` to appear in `CollectionJob.assignedStaffId`, payroll calculations will accrue wages unless manually zeroed. |
| 2 | **Company owner driving a supplier-owned vehicle** | **PARTIAL / BROKEN** | **HIGH** | `Vehicle.ownershipType` supports `'SUPPLIER_VEHICLE'` (`001_initial_schema.sql#L123`), `VehiclesView.tsx#L109`. | `vehicles` has **no `owner_party_id` FK** to `parties`. Cannot link a supplier-owned truck to the supplier's ledger or track owner-as-driver separately from vehicle ownership. |
| 3 | **Company owner driving an outsourced vehicle** | **PARTIAL / BROKEN** | **HIGH** | `Vehicle.ownershipType` supports `'HIRED'` (`001_initial_schema.sql#L123`). | `vehicles` has **no transporter/owner `party_id` FK** and no hire-rate/trip settlement link. Outsourced vehicle hire charges cannot be tied to a transporter sub-ledger automatically. |
| 4 | **Supplier or transporter also acting as driver** | **MISSING** | **HIGH** | `PartyType` is `'SUPPLIER' \| 'CUSTOMER' \| 'BOTH'` (`src/types/index.ts#L116`, `001_initial_schema.sql#L98`). `Vehicle.driverName` is plain text. | No `'TRANSPORTER'` party type and no FK from `vehicles` or trips to a driver `Party` or unified `Person` record. Driving history and driver authorizations cannot be tracked relationally. |
| 5 | **One person holding multiple roles** | **MISSING** | **CRITICAL** | Separate disconnected tables: `parties`, `employees`, `contractors`, `users_roles`, and free-text `Vehicle.driverName`. | A single real-world individual (e.g., Supplier + Transporter + Driver, or Owner + Driver) must be duplicated across tables with no shared identity (`person_id`), causing fragmented balances and manual reconciliation errors. |
| 6 | **One trip containing multiple purchase loads** | **MISSING** | **CRITICAL** | `CollectionJob` (`src/types/index.ts#L187-L204`) has 1 `supplierPartyId`, 1 `materialId`, 1 `resultingPurchaseId`. `PurchaseHeader` (`#L225-L248`) has 1 `weighmentId`. | Cannot represent a single vehicle trip picking up 3–5 scrap loads from different suppliers or weighing multiple loads under one trip for shared fuel/toll/freight allocation. |
| 7 | **Owner paying fuel and toll from personal funds** | **MISSING** | **CRITICAL** | `recordExpense` (`ERPContext.tsx#L1239-L1306`), `createExpenseJournal` (`accountingEngine.ts#L539-L624`). `Expense` requires `accountId` (company Cash/Bank) or `UNPAID`. | No `paidByType` (`COMPANY` vs `OWNER_PERSONAL`), no `ownerUserId`/`partyId` for reimbursement, and `createExpenseJournal` always credits `1010`/`1020` or `2020` (unallocated payable) instead of an Owner Reimbursement / Capital Injection account. |
| 8 | **Owner receiving authorized payments on behalf of suppliers or transporters** | **MISSING** | **CRITICAL** | `Payment` (`src/types/index.ts#L403-L419`, `payments` table `001_initial_schema.sql#L406-L420`), `postPaymentVoucher` (`financeEngine.ts#L28-L149`). | `Payment` has only one `partyId`. `createPaymentJournal` debits `2010 Sundry Creditors` for `payment.partyId` only. There is no `recipient_party_id` vs `beneficiary_party_id` or driver/owner payment authorization record. |

---

## 3. Readiness Score & Summary Verdict

### Readiness Calculation Methodology
Scored across **8 Owner-Operator Operational Capabilities** (weight 12.5% each):
- **Supported (100%):** 0/8
- **Partial (40%):** Scenarios 1, 2, 3 (basic `vehicles` table + `ownershipType` enum + `driverName` text + `Expense.vehicleId` exist) → `3 × 0.40 = 1.20`
- **Missing (0%):** Scenarios 4, 5, 6, 7, 8 → `5 × 0.00 = 0.00`
- **Current Owner-Operator Readiness:** **`1.20 / 8.00 = 15%`** (foundational ERP modules — multi-company RLS, double-entry accounting, FIFO stock, and vehicle compliance — are strong, but the relational links for multi-role persons, trips, multi-load purchases, owner personal reimbursements, and third-party payment recipients are not yet built).
