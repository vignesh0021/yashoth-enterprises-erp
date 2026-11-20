# ACCOUNTING POSTING MATRIX — YASHOTH ENTERPRISES ERP

**Branch:** `audit/owner-operator-complete-architecture`  
**Chart of Accounts Source:** `backend/business-rules/accountingEngine.ts`, `database/migrations/005_accounting_and_documents.sql`, `database/migrations/012_finance_hardening_and_owner_operator.sql`

---

## 1. Chart of Accounts Additions

| Code | Account Name | Category | Normal Balance | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `1010` | Cash on Hand | `ASSET` | `DEBIT` | Physical business cash float |
| `1020` | Bank Accounts (Current/OD) | `ASSET` | `DEBIT` | Bank accounts (inactive until transactions begin) |
| `1025` | UPI / Digital Clearing (Pending Settlement) | `ASSET` | `DEBIT` | Optional clearing for pending digital settlements |
| `2010` | Sundry Creditors (Suppliers A/P) | `LIABILITY` | `CREDIT` | Scrap material supplier payables |
| `2015` | Transporter & Freight Payable | `LIABILITY` | `CREDIT` | Outsourced transporter/freight payables |
| `2020` | Unpaid Operational Expenses Payable | `LIABILITY` | `CREDIT` | Accrued unpaid expenses |
| `2150` | Owner Reimbursement Payable (Due to Owner) | `LIABILITY` | `CREDIT` | Repayable owner advances & personal expense reimbursements |
| `3010` | Proprietor / Partners Capital | `EQUITY` | `CREDIT` | Non-repayable owner capital introduced |
| `3030` | Owner Drawings | `EQUITY` | `DEBIT` | Contra-equity personal owner withdrawals |

---

## 2. Authoritative Double-Entry Posting Matrix

| Scenario | Debit (Dr.) | Credit (Cr.) | Cash Book Impact | P&L Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Owner Capital Introduced (Non-repayable, e.g. ₹27,000)** | `1010` Cash on Hand | `3010` Proprietor Capital | `+` Capital Inflow | None (Equity, not Revenue) |
| **Owner Repayable Cash Advance (`OWNER_LOAN_IN`)** | `1010` Cash on Hand | `2150` Due to Owner | `+` Capital/Loan Inflow | None (Liability) |
| **Owner Personal Withdrawal (`OWNER_DRAWING`)** | `3030` Owner Drawings | `1010` Cash on Hand | `-` Drawings | None (Contra-Equity, not Expense) |
| **Paid Cash Expense (`PAID`, `CASH`)** | `50xx` Expense Account | `1010` Cash on Hand | `-` Paid Expense | `-` Operating Expense |
| **Unpaid Expense Recognition (`UNPAID`)** | `50xx` Expense Account | `2020` Unpaid Expenses Payable | **None** | `-` Operating Expense |
| **Unpaid Expense Settlement (`payUnpaidExpense`)** | `2020` Unpaid Expenses Payable | `1010` Cash on Hand | `-` Paid Expense | None (no double expense) |
| **Owner Personal Expense (`OWNER_PERSONAL`)** | `50xx` Expense Account | `2150` Due to Owner | **None** (company cash untouched) | `-` Operating Expense |
| **Owner Reimbursement (`OWNER_REIMBURSEMENT`)** | `2150` Due to Owner | `1010` Cash on Hand | `-` Other Payment | None |
| **Expense Reversal (`REVERSED`)** | `1010` (or `2020`) | `50xx` Expense Account | `+` Refund (if was `PAID`) | `+` Expense Reversal |
| **Transporter Payment (`partyType = 'TRANSPORTER'`)** | `2015` Transporter Payable | `1010`/`1020` Cash/Bank | `-` Other Payment | None |
| **Failed / Pending UPI Payment** | *Blocked* | *Blocked* | **None** | **None** |
