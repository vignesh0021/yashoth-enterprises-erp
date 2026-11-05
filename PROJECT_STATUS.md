# Yasoth Enterprises — Scrap ERP Project Status Report

**Baseline Date:** October 2026  
**Application Version:** 1.0.0  
**Overall Status:** **PHASES 0 THROUGH 5 COMPLETED & VERIFIED**

---

## 1. Phase Status Summary

| Phase | Description | Status | Verification Result |
|---|---|---|---|
| **Phase 0** | Repository Audit, Workspace Setup & Foundations | **COMPLETED** | Verified TEJAS invoice and letterhead logo. Configured React 18, TypeScript, Tailwind CSS, Vitest, and normalized PostgreSQL migrations. |
| **Phase 1** | Core Scrap Operations | **COMPLETED** | Tested Gross/Tare/Net calculations, non-negative stock rejection, append-only stock movement ledger, and FIFO lot tracking. |
| **Phase 2** | Sales, Billing & Financial Controls | **COMPLETED** | Tested sales dispatch, FIFO lot consumption, COGS computation, 18% GST (CGST 9% + SGST 9%), A4 Tax Invoice renderer, payment allocations, and Cash-to-Bank contra transfers. |
| **Phase 3** | Pilot & Data Migration Tools | **COMPLETED** | Tested CSV parser, duplicate party detection, quarantined error reporting, and dry-run execution. |
| **Phase 4** | Supporting Operations | **COMPLETED** | Built Vehicle registry, document expiry countdown alerts, employee daily attendance sheet with overtime logging, and multi-tab registers. |
| **Phase 5** | Hardening, Release & Documentation | **COMPLETED** | Built full documentation suite, passed 21 Vitest automated tests (100% passing), and verified clean production build in `dist/`. |

---

## 2. Definition of Done (DoD) Verification Checklist

- [x] **Authorized user can create and post a purchase:** Implemented with workflow state machine (Draft → Submitted → Verified → Approved → Posted).
- [x] **Verified purchase posting creates correct stock movements:** Generates append-only inward `PURCHASE_RECEIPT` movements and active `InventoryLot` records.
- [x] **Collection transactions recorded separately from estimates:** Pickup requests separate estimated quantities from ground weighbridge receipts; estimates do not alter stock balances.
- [x] **Manual weighment and weighbridge-slip entry supported:** Enforces `Net = Gross - Tare` and `Payable = Net - Deductions` with duplicate slip warnings and non-negative constraints.
- [x] **Authorized user can create and dispatch a sale:** Implemented with customer selection, vehicle details, and available stock validation.
- [x] **Dispatch consumes correct inventory quantity & FIFO lots:** Automatically allocates from unexhausted lots chronologically and computes exact Cost of Goods Sold.
- [x] **Sales invoice PDFs generated using approved document design:** Faithful reproduction of `TEJAS_INVOICE_TEMPLATE.xlsm.xlsx` layout with genuine Yasoth letterhead branding, HSN 7204, CGST/SGST/IGST breakdown, number to Indian words, and print/PDF output.
- [x] **Partial supplier payments and customer receipts reconcile:** Supports multi-invoice allocations and tracks unallocated amounts.
- [x] **Cash and bank balances reconcile to posted account transactions:** Enforces linked debit/credit contra transfers (₹20,000 cash-to-bank creates exactly ₹0 income and ₹0 expense).
- [x] **Stock reports match the stock ledger:** Authoritative stock summaries and valuations derived strictly from posted movements.
- [x] **Purchase, sales, payment, and audit records are traceable:** Immutable audit trail records actor, action, timestamp, and entity ID.
- [x] **Critical business tests pass:** 21 automated tests pass across 6 test suites.
- [x] **Production build succeeds:** Compiled cleanly with Vite and TypeScript compiler.
- [x] **Backup, migration, and deployment instructions exist:** Complete documentation suite generated.

---

## 3. Test & Build Execution Results

### Automated Test Suite (`npm test`)
- **Total Test Files:** 7 passed (7 total)
- **Total Tests:** 29 passed (29 total)
- **Suites:**
  - `tests/audit_defects.test.ts` (8 tests): Defect regression suite (funds double-count guard, lot valuation reconciliation, vehicle expiry filters, purchase posting idempotency, sales FIFO & COGS, stock reversal immutability).
  - `tests/weighment.test.ts` (7 tests): Gross/tare/net, negative rejection, tare > gross rejection, deductions.
  - `tests/inventory.test.ts` (5 tests): Append-only movements, negative stock rejection, FIFO lot consumption & COGS, reversal movements.
  - `tests/purchases.test.ts` (3 tests): Approval workflow, lot creation, duplicate posting rejection.
  - `tests/sales.test.ts` (1 test): Dispatch, TEJAS template exact figures (7,720 KG @ ₹30 = ₹2,31,600 + ₹41,688 GST = ₹2,73,288), number-to-words.
  - `tests/finance.test.ts` (3 tests): Payment allocations, over-allocation rejection, cash-to-bank contra transfers.
  - `tests/migration.test.ts` (2 tests): Dry-run validation, duplicate code quarantine, opening stock lots.

### Production Build (`npm run build`)
- TypeScript typecheck (`tsc --noEmit`): **Clean, 0 errors**.
- Vite production bundle: **Clean, compiled with exit code 0**.

---

## 4. Screenshot-Based Defect Audit Verification Report

### Item 1: Purchase, Stock Valuation & Supplier Payable Reconciliation
- **Posted Purchase:** 5,850 kg MS Boring scrap at ₹28.00/kg taxable base (`PUR-26-0001` / `SUP-001` Sri Balaji Auto Forge Pvt Ltd).
  - Gross: 14,250 kg, Tare: 8,100 kg, Net: 6,150 kg, Deductions: 300 kg, Payable: 5,850 kg.
  - Taxable Amount = 5,850 × ₹28.00 = ₹1,63,800.00.
  - 18% GST (9% CGST ₹14,742 + 9% SGST ₹14,742) = ₹29,484.00.
  - Total Displayed Invoice / Purchase Amount = ₹1,93,284.00.
- **Stock Valuation Addition:**
  - In accordance with AS 2 / GST input tax credit (ITC) rules, inventory is capitalized at net purchase cost excluding recoverable GST: ₹1,63,800.00.
  - Combined with physical opening stock valuation (₹11,52,900.00 across 25,150 kg), total inventory valuation reconciles to ₹13,16,700.00 across 31,000.00 kg.
- **Supplier Payable Balance:**
  - Net liability created: ₹1,93,284.00 (gross invoice payable to supplier).
  - Payments posted: ₹0.00; Net outstanding balance: ₹1,93,284.00.

### Item 2: 31,000 kg Stock & ₹8,00,000 Funds Balance Source Records
- **31,000 kg Stock on Hand:**
  - Authoritative opening balance: 25,150 kg across 4 material lots (`LOT-OPEN-BORING-01`, `LOT-OPEN-HMS1-01`, `LOT-OPEN-AL-01`, `LOT-OPEN-CU-01`) recorded as of 01-Oct-2026.
  - Actual posted purchase: 5,850 kg from `PUR-26-0001` posted on 15-Oct-2026.
  - Total = 25,150 + 5,850 = 31,000.00 kg dynamically derived from the immutable stock movement ledger.
- **₹8,00,000 Funds Balance (Confirmed Defect & Resolution):**
  - **Root Cause:** Opening balances were double-counted. In `mockData.ts`, `INITIAL_ACCOUNTS` defined opening balances (₹50,000 cash + ₹3,50,000 bank = ₹4,00,000), while `INITIAL_ACCOUNT_TRANSACTIONS` simultaneously recorded two `OPENING_BALANCE` debit entries (₹50,000 and ₹3,50,000). The balance calculation added `acc.openingBalance` plus the debit transactions, doubling ₹4,00,000 to ₹8,00,000.
  - **Fix Applied:** `calculateReconciledAccountBalance` in `backend/business-rules/financeEngine.ts` now inspects whether `OPENING_BALANCE` transactions are present in the ledger. If present, the base balance is set to 0 to prevent double-counting. `DashboardView.tsx` now calls `calculateReconciledAccountBalance` directly.

### Item 3: Gross Margin ₹0 Analysis
- **Root Cause:** In financial accounting, inventory purchases and stock holdings are balance sheet asset additions, not revenue/cost events. Gross Margin = Dispatched Sales Revenue minus Allocated COGS.
- Because no sales order dispatches have occurred yet (`sales = []`), sales revenue is ₹0 and COGS is ₹0, resulting in an exact and mathematically correct Gross Margin of ₹0.

### Item 4: Insurance Renewal Alerts & Underlying Records
- **Underlying Records:**
  - `DOC-03`: Vehicle `TN 20 CR 8891` (Tata 407 Mini Truck), Insurance Policy `POL-NEWINDIA-2026-11`, Expiry: `2026-10-24`, 8 days left (Reminder: 15d).
  - `DOC-01`: Vehicle `TN 18 BY 0420` (Ashok Leyland 16-Ton Lorry), Insurance Policy `POL-ICICI-2026-9901`, Expiry: `2026-11-14`, 29 days left (Reminder: 30d).
- **Confirmed Defect & Resolution:**
  - `DashboardView.tsx` previously used `diffDays >= 0 && diffDays <= reminderDaysBefore`. If a document actually expired (`diffDays < 0`), it was silently omitted from the dashboard!
  - **Fix Applied:** Filter updated to `diffDays <= reminderDaysBefore` with an explicit `EXPIRED` badge when `diffDays < 0`, ensuring expired compliance items remain visible.

### Item 5, 6, 7: Core Workflow & Idempotency Testing
- **Purchase Posting:** Idempotent state machine (`APPROVED` → `POSTED`). Generates exactly 1 lot and 1 inward movement per line; duplicate posting throws an error.
- **Sales Dispatch:** Allocates unexhausted lots chronologically via FIFO, computes exact COGS, creates outward stock movement, generates immutable tax invoice with Indian number-to-words, and prevents duplicate dispatch.
- **Stock Reversal:** Compacting compensating movement restores stock with reason and actor tracking; second reversal rejected.

### Item 8: Persistence Mechanism
- Records are stored in browser **`localStorage`** (`yasoth_erp_v1_*`). All state is rehydrated upon reload. PostgreSQL migrations exist for backend deployment.

### Item 9: Runtime & Console Health
- Inspected browser console and network traffic: **0 runtime errors, 0 failed network requests**.

### Item 10: Authoritative Reconciliation between Dashboard & Registers
- **Confirmed Defect:** `InventoryView.tsx` and the bottom table in `DashboardView.tsx` previously calculated valuation by multiplying balance by `defaultPurchaseRate` instead of summing unexhausted lot acquisition costs, creating a valuation drift against the Stock Valuation stat card.
- **Fix Applied:** Both views now calculate material valuation directly from active unexhausted lots, achieving 100% register-to-dashboard reconciliation.

