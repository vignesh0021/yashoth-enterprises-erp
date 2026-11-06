# Yashoth Enterprises — Production Scrap ERP

[![Build Status](https://img.shields.io/badge/Build-Passing-emerald)](file:///data/user/0/com.termux/files/home/YE/dist)
[![Tests Status](https://img.shields.io/badge/Tests-147%20Passed%20(100%25)-emerald)](file:///data/user/0/com.termux/files/home/YE/tests)
[![TypeCheck](https://img.shields.io/badge/TypeScript-Clean%20(0%20errors)-blue)](file:///data/user/0/com.termux/files/home/YE)
[![PWA](https://img.shields.io/badge/PWA-Installable%20%2B%20Offline-orange)](file:///data/user/0/com.termux/files/home/YE/public)
[![Security](https://img.shields.io/badge/Security-AES--256%20%7C%20RLS-purple)](file:///data/user/0/com.termux/files/home/YE/docs/SECURITY_AUDIT_REPORT.md)

Production-hardened Enterprise Resource Planning (ERP) application engineered specifically for **Yashoth Enterprises** (`YE-MAIN`), a scrap-metal purchasing, yard weighment, stock processing, factory demolition, sales dispatch, and GST billing company based in Tamil Nadu, with multi-company branch support for **Cauvery Scrap** (`CS-BRANCH`).

The platform eliminates duplicate manual data entry, calculation discrepancies, inventory leaks, and spreadsheet inaccuracies by uniting weighbridge automation, immutable FIFO inventory costing, official GST tax invoicing, double-entry financial statements, AES-256 disaster recovery, and offline mobile PWA execution into an authoritative system.

---

## Key Modules & Capabilities

1. **Dashboard:** Live owner KPI cards (inward weight, outward weight, stock on hand, cash/bank balance, estimated gross margin), operational alerts, and scrap valuation breakdown.
2. **Multi-Company Architecture:** Canonical multi-tenant isolation (`YE-MAIN` and `CS-BRANCH`). Real-time company switcher with strict database-level row isolation.
3. **Purchases & Intake:** Gate intake, multi-tier approval workflow, rate snapshots, and idempotent stock inward lot generation.
4. **Weighment Engine:** Manual scale and weighbridge slip capture, gross/tare/deduction rules (`Net = Gross - Tare`, `Payable = Net - Deductions`), and decimal precision enforcement.
5. **FIFO Inventory & Stock Ledger:** Append-only immutable stock movements, yard separation, First-In First-Out (FIFO) lot allocation with COGS tracking.
6. **Sales & Dispatch:** Customer order entry, real-time stock validation (prevents negative inventory), FIFO lot consumption, and automated Tax Invoice issuance.
7. **Tax Invoices (INVOICE_03 Replica):** Exact 1:1 mathematical formula replica of `INVOICE_03.pdf` (₹1,46,367.20) with genuine letterhead branding, HSN 7204, CGST 9% + SGST 9%, rounding, amount in words, e-Way Bill linkage, and single-sheet A4 print/PDF export.
8. **Double-Entry Accounting & Financials:** Chart of accounts, balanced journal postings ($\sum \text{Debits} \equiv \sum \text{Credits}$), Cash Book, Bank Book, General Ledger, Trial Balance, Profit & Loss, and Balance Sheet.
9. **Commercial Document Lifecycle:** Full generation and workflow tracking for Quotations, Proforma Invoices, Credit Notes, Debit Notes, and Payment Receipts.
10. **Reconciled Excel Export Engine:** Automated generation of 14 independent reconciled company workbooks and a consolidated master workbook (`Consolidated_Master_YE-MAIN.xlsx`).
11. **Backup Manager & Disaster Recovery:** AES-256-GCM encrypted backup archives, SHA-256 checksum integrity verification, pre-restore safety snapshots, local download, and Google Drive OAuth cloud sync.
12. **Mobile Native & Installable PWA:** Installable standalone Progressive Web App with service worker caching, safe area insets for notches, 16px minimum form font size preventing mobile auto-zoom, and non-destructive offline sync with conflict resolution.

---

## Authoritative Documentation & Deliverables

All documentation guides are located in the [`docs/`](file:///data/user/0/com.termux/files/home/YE/docs) directory:

- [Security Audit Report](file:///data/user/0/com.termux/files/home/YE/docs/SECURITY_AUDIT_REPORT.md) — Comprehensive security assessment, RLS policies, RBAC matrix, and vulnerability remediations.
- [Comprehensive Test Report](file:///data/user/0/com.termux/files/home/YE/docs/TEST_REPORT.md) — Detailed results of all 147 automated tests across 63 test suites.
- [Backup & Restore Guide](file:///data/user/0/com.termux/files/home/YE/docs/BACKUP_AND_RESTORE_GUIDE.md) — Disaster recovery manual, encryption, verification, and restoration steps.
- [Mobile & PWA Installation Guide](file:///data/user/0/com.termux/files/home/YE/docs/MOBILE_INSTALLATION_GUIDE.md) — Installation instructions for Android, iOS, Windows/macOS, and offline operation manual.
- [Google Drive OAuth Setup Guide](file:///data/user/0/com.termux/files/home/YE/docs/GOOGLE_DRIVE_SETUP_GUIDE.md) — Secure Google Cloud Console setup with zero client secrets in frontend.
- [Production Deployment Guide](file:///data/user/0/com.termux/files/home/YE/docs/DEPLOYMENT_GUIDE.md) — Server setup, Termux local hosting, Linux Nginx SSL configuration, and Docker deployment.
- [Database Migrations Ledger](file:///data/user/0/com.termux/files/home/YE/docs/DATABASE_MIGRATIONS.md) — Schema documentation for migrations 001 through 006 with rollback scripts.
- [Release Notes v1.0.0](file:///data/user/0/com.termux/files/home/YE/docs/RELEASE_NOTES.md) — Official release notes certifying Phase 0 through Phase 9.

---

## Quick Start & Verification

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Verify TypeScript Compiler
```bash
pnpm tsc --noEmit
```

### 3. Run Full Automated Test Suite
```bash
node scripts/test-runner.mjs
```

### 4. Build Production Bundle
```bash
pnpm build
```

### 5. Launch Local Production Preview
```bash
pnpm preview --host 0.0.0.0 --port 5173
```

---
**Operating Entity:** Yashoth Enterprises Scrap & Demolition Works (`YE-MAIN`)  
**Branch:** Cauvery Scrap (`CS-BRANCH`)  
**License:** Proprietary Industrial Software
