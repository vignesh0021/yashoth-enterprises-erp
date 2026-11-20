# ACCOUNTING RISK REPORT

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Audited Commit:** `dc078c16ee6d81790dacb1ea07c352807caca1c4`

---

## Summary of Accounting Integrity Findings

| # | Risk Question | Current Behaviour | Severity | Exact Code / Schema Location |
| :-: | :--- | :--- | :---: | :--- |
| 1 | **Does owner driving automatically create driver salary?** | Not from `Vehicle.driverName` (plain string), **but YES if owner is added to `employees`** so they can be assigned to `CollectionJob.assignedStaffId` — `calculateMonthlySalary` / `EmployeesView.tsx#L244-L259` and `fn_post_salary_accrual_atomic` (`009#L965`) will accrue salary on attendance. | **HIGH** | `EmployeesView.tsx#L244-L259`, `ERPContext.tsx#L2694`, `001_initial_schema.sql#L145` |
| 2 | **Can supplier and transporter ledgers get mixed?** | **YES.** `PartyType` lacks `'TRANSPORTER'`. Transporters are entered as `'SUPPLIER'` and posted to the single `2010 Sundry Creditors (Suppliers A/P)` account, mixing scrap material payables with freight/hire payables. | **HIGH** | `src/types/index.ts#L116`, `accountingEngine.ts#L89, L386-L395, L492-L501` |
| 3 | **Is payment recipient distinguishable from actual beneficiary?** | **NO.** `Payment` has only `partyId`. `createPaymentJournal` debits `2010` for `payment.partyId` only. Paying a driver or owner on behalf of a supplier either settles the wrong party ledger or loses recipient auditability. | **CRITICAL** | `src/types/index.ts#L403-L419`, `financeEngine.ts#L104-L141`, `accountingEngine.ts#L491-L511` |
| 4 | **Are owner drawings separated from operating expenses?** | **BROKEN.** `OWNER_DRAWING` / `OWNER_INJECTION` exist in `AccountTransaction` UI (`FinanceView.tsx#L3635-L3636`), **but `addAccountTransaction` (`ERPContext.tsx#L2979-L2988`) posts NO `JournalEntry` at all!** Also `STANDARD_CHART_OF_ACCOUNTS` has only `3010` Capital, no `3030 Owner Drawings` contra-equity account. | **CRITICAL** | `ERPContext.tsx#L2979-L2988`, `accountingEngine.ts#L99-L100`, `FinanceView.tsx#L3635-L3636` |
| 5 | **Can personal expense payments be reimbursed correctly?** | **NO.** `Expense` requires `accountId` (company cash/bank) or `UNPAID`. `createExpenseJournal` (`accountingEngine.ts#L590-L603`) credits `1010`/`1020` or `2020` (unallocated payable) — never `2150 Due to Owner (Personal Reimbursements)` or `3010`. | **HIGH** | `ERPContext.tsx#L1239-L1306`, `accountingEngine.ts#L539-L624` |
| 6 | **Can vehicle freight be duplicated in purchase costs?** | **YES.** Freight can be recorded simultaneously in (a) `PurchaseHeader.otherCharges` → `5030` (`createPurchaseInvoiceJournal`), (b) `CollectionJob.transportExpenses` (stored without GL), and (c) `Expense` voucher → `5030` (`createExpenseJournal`), with zero cross-check or trip linkage. | **HIGH** | `accountingEngine.ts#L373-L383, L561-L572`, `PurchasesView.tsx#L177`, `CollectionsView.tsx#L49` |
| 7 | **Can failed UPI payments incorrectly settle liabilities?** | **YES.** `Payment` and `payments` table have **no `status` field** (`PENDING`/`COMPLETED`/`FAILED`/`REVERSED`). `postPaymentVoucher` (`financeEngine.ts#L69-L102`) immediately reduces `invoice.outstandingBalance` / `purchase.outstandingBalance` and posts a `POSTED` journal on creation. | **CRITICAL** | `src/types/index.ts#L403-L419`, `001_initial_schema.sql#L406-L420`, `financeEngine.ts#L69-L148` |
| 8 | **Are duplicate journal entries prevented?** | **PARTIALLY / WEAK.** `005#L122` only has `UNIQUE (company_id, entry_no)`. `ERPContext.tsx` (`#L1025, #L1115, #L1141, #L1184, #L1231, #L1298`) prepends `[je, ...prev]` without checking existing `(sourceType, sourceId)`. Only `009` labour/contractor RPCs enforce `idempotency_key`. | **HIGH** | `005_accounting_and_documents.sql#L122`, `ERPContext.tsx#L1025, L1184, L1298` |

---

## Detailed Remediation Requirements

1. **Chart of Accounts Additions (`accountingEngine.ts` + `005` seed)**:
   - `2015`: `Transporter & Freight Payable` (LIABILITY) — separates freight AP from `2010` Scrap Supplier AP.
   - `2150`: `Owner Reimbursement Payable (Due to Owner)` (LIABILITY) — tracks personal fuel/toll/trip expenses paid by owner until reimbursed.
   - `3030`: `Owner Drawings` (EQUITY, normalBalance `'DEBIT'`) — separates owner personal withdrawals from `5xxx` operating expenses and `3010` capital injections.
   - `1025`: `UPI / Digital Clearing (Pending Settlement)` (ASSET) — optional clearing for `PENDING` UPI until confirmed `COMPLETED`, or strictly block liability settlement & GL posting until `status === 'COMPLETED'`.
2. **Preventing Duplicate Journals**:
   - Add a central `appendJournalIfAbsent(je)` helper in `ERPContext.tsx` checking `(sourceType, sourceId)` for active `isPosted && status !== 'REVERSED'` entries.
   - Add a partial unique index in SQL: `CREATE UNIQUE INDEX uq_journal_active_source ON journal_entries(company_id, source_type, source_id) WHERE status = 'POSTED' AND source_id IS NOT NULL;`.
3. **Payment Failure & Reversal Guard**:
   - Require `status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'` on `Payment`.
   - `FAILED` or `PENDING` UPI payments must **NOT** reduce `outstandingBalance` on `Invoice`/`PurchaseHeader` and must **NOT** post `AccountTransaction` or `JournalEntry` until marked `COMPLETED`.
