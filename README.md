# Yasoth Enterprises — Production Scrap ERP

[![Build Status](https://img.shields.io/badge/Build-Passing-emerald)](file:///c:/Users/USER/Downloads/YE/dist)
[![Tests Status](https://img.shields.io/badge/Tests-21%20Passed-emerald)](file:///c:/Users/USER/Downloads/YE/tests)
[![Architecture](https://img.shields.io/badge/Stack-React%2018%20%2B%20TypeScript%20%2B%20Vite%20%2B%20PostgreSQL-blue)](file:///c:/Users/USER/Downloads/YE/ARCHITECTURE.md)

Production-oriented Scrap Enterprise Resource Planning (ERP) application engineered specifically for **Yasoth Enterprises**, a scrap-metal purchasing, collection, stock management, sales dispatch, and billing business based in Gummidipoondi, Tamil Nadu.

The platform eliminates duplicate manual data entry, calculation discrepancies, inventory leaks, and spreadsheet inaccuracies by uniting gate weighments, immutable FIFO inventory ledgers, GST tax invoicing, customer/supplier ledgers, and cash/bank reconciliation into an authoritative system.

---

## Key Modules & Capabilities

1. **Dashboard:** Live owner KPI cards (inward weight, outward weight, stock on hand, cash/bank balance, estimated gross margin), operational alerts (overdue payments, weighment exceptions, expiring documents), and scrap valuation breakdown.
2. **Purchases & Intake:** Gate intake, multi-tier approval workflow (Draft → Submitted → Verified → Approved → Posted), rate snapshots, and idempotent stock inward generation.
3. **Collection Management:** External factory pickup scheduling, vehicle/driver assignment, and separation of estimated quantity from actual weighbridge receipt.
4. **Weighment Engine:** Manual scale and public weighbridge slip capture, gross/tare/deduction rules (`Net = Gross - Tare`, `Payable = Net - Deductions`), duplicate slip warnings, and decimal precision enforcement.
5. **Inventory & Stock Ledger:** Append-only immutable stock movements, yard separation, First-In First-Out (FIFO) lot allocation with COGS tracking, and periodic physical stock count reconciliation with auditable variance movements.
6. **Sales & Dispatch:** Customer order entry, real-time available stock validation (prevents negative inventory), FIFO lot consumption, and automated Tax Invoice issuance.
7. **Invoices & Bills:** Faithful reproduction of the company's verified Tax Invoice layout matching `TEJAS_INVOICE_TEMPLATE.xlsm.xlsx` with genuine letterhead branding, HSN 7204, CGST 9% + SGST 9% (or IGST), rounding, Indian numbering words, and A4 print/PDF download.
8. **Suppliers & Customers:** Unified party master supporting dual-role entities (acting as both supplier and customer) with reconciled net balances.
9. **Payments & Outstanding:** Multi-invoice allocations, customer receipts (Debit), supplier payments (Credit), unallocated funds tracking, and ageing breakdown.
10. **Funds & Expenses:** Cashbook, bankbook, operating expense categorization, and cash-to-bank contra transfers (`Debit` destination, `Credit` source with zero income/expense recognition).
11. **Vehicles & Compliance:** Vehicle fleet registry, color-coded document expiry warnings (Insurance, Fitness, RC, Permit), and trip/maintenance costs.
12. **Employees & Attendance:** Yard staff registry, wage structure, daily check-in attendance, and overtime tracking.
13. **Reports & Registers:** Filterable daily purchase register, sales register, weighment register, stock valuation, and CSV export.
14. **Settings & Migration:** Company tax configuration, RBAC permissions matrix, backup/restore JSON, and CSV data migration wizard with dry-run validation.

---

## Quick Start & Local Execution

### Prerequisites
- Node.js >= 18.0 (tested on v24.12.0)
- npm >= 9.0 (tested on v11.6.2)

### Installation
```bash
# Clone or navigate to the workspace
cd c:\Users\USER\Downloads\YE

# Install dependencies
npm install
```

### Running the Development Server
```bash
npm run dev
```
The application will launch at `http://localhost:5173`.

### Running Automated Test Suite
```bash
npm test
```
Executes 21 Vitest business-critical tests spanning weighment math, negative stock guards, FIFO lot consumption, invoice generation, contra transfers, and data migration.

### Building for Production
```bash
npm run build
```
Generates a type-checked, optimized production bundle in `dist/`.

---

## Documentation Index

- [Project Status & DoD Verification](file:///c:/Users/USER/Downloads/YE/PROJECT_STATUS.md)
- [System Architecture](file:///c:/Users/USER/Downloads/YE/ARCHITECTURE.md)
- [PostgreSQL Database Schema & Migrations](file:///c:/Users/USER/Downloads/YE/DATABASE_SCHEMA.md)
- [Core Business Rules & Accounting Controls](file:///c:/Users/USER/Downloads/YE/BUSINESS_RULES.md)
- [Automated Test Report](file:///c:/Users/USER/Downloads/YE/TEST_REPORT.md)
- [Deployment & Security Guide](file:///c:/Users/USER/Downloads/YE/DEPLOYMENT.md)
- [Operator & User Manual](file:///c:/Users/USER/Downloads/YE/USER_GUIDE.md)
