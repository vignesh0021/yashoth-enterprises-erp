# TEST COVERAGE GAP REPORT

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Existing Test Suites:** 29 `.test.ts` files (`312` passing tests across `114` suites via `node scripts/test-runner.mjs`)  
**Audited Commit:** `dc078c16ee6d81790dacb1ea07c352807caca1c4`

---

## 1. Current Coverage Assessment

Existing tests (`accounting_and_documents.test.ts`, `audit_defects.test.ts`, `finance.test.ts`, `finance_module.test.ts`, `negative_security_and_rbac.test.ts`, `financial_direct_write_and_balance_integrity.test.ts`, `vehicle_ewaybill_po.test.ts`) thoroughly cover:
- Standard Sales/Purchase/Payment/Expense balanced journals
- FIFO lot allocation & stock reversal
- Salary/Labour/Contractor accruals & advance recovery
- Vehicle document expiry & E-Way Bill NIC v1.03
- Static RBAC & migration 009/010/011 checks

**Zero tests currently exist** for any of the 8 Owner-Operator scenarios or the 8 accounting integrity risks identified in this audit.

---

## 2. Required Regression & Negative Test Matrix

| # | Test Area | Severity | Required Assertions | Target Test File |
| :-: | :--- | :---: | :--- | :--- |
| 1 | **Multi-role person & owner-driver payroll guard** | **HIGH** | Person holding `OWNER` + `DRIVER` + `SUPPLIER` roles resolves uniquely; marking attendance/trip for an `isOwner` / `payrollEligible=false` person accrues **₹0** salary (`calculateMonthlySalary` / payroll guard). | `tests/owner_operator_and_trips.test.ts` (new) |
| 2 | **Vehicle ownership & driver separation** | **HIGH** | `OWNED`, `SUPPLIER_VEHICLE`, and `HIRED` vehicles store `ownerPartyId` independently from `driverPersonId` / `isOwnerDriven`; supplier-owned vehicle driven by owner does not auto-credit hire charges to supplier unless configured. | `tests/owner_operator_and_trips.test.ts` |
| 3 | **Multi-load trip header** | **CRITICAL** | One `VehicleTrip` links 2+ `Weighment`s and 2+ `PurchaseHeader`s from different suppliers; trip-level fuel/toll expenses allocate/report per trip without mutating material unit costs. | `tests/owner_operator_and_trips.test.ts` |
| 4 | **Freight duplication guard** | **HIGH** | Recording freight on a `VehicleTrip` / `Expense` (`5030`) and attempting to also add `otherCharges` freight on a linked `PurchaseHeader` is rejected or warned so `5030` is never double-debited. | `tests/owner_operator_and_trips.test.ts` |
| 5 | **Owner personal expense & reimbursement** | **CRITICAL** | `Expense` with `paidByType='OWNER_PERSONAL'` posts `Dr. 5060/5030` / `Cr. 2150 Due to Owner` (company cash `1010`/`1020` untouched); reimbursing posts `Dr. 2150` / `Cr. 1010/1020` and sets `reimbursementStatus='REIMBURSED'`. | `tests/owner_operator_and_trips.test.ts` |
| 6 | **Owner drawings vs operating expenses** | **CRITICAL** | `OWNER_DRAWING` cashbook entry posts `Dr. 3030 Owner Drawings` / `Cr. 1010/1020` (never `5xxx` P&L expense); `OWNER_INJECTION` posts `Dr. 1010/1020` / `Cr. 3010`; P&L net profit is unaffected. | `tests/owner_operator_and_trips.test.ts` |
| 7 | **Recipient vs Beneficiary & Payment Authorization** | **CRITICAL** | Outflow payment to an authorized driver/owner (`recipientId`) on behalf of a supplier/transporter (`beneficiaryPartyId`) settles `beneficiaryPartyId`'s AP (`2010` or `2015`) while recording `recipientId` and `authorizationId`; unauthorized third-party recipient is rejected. | `tests/owner_operator_and_trips.test.ts` |
| 8 | **Failed / Pending UPI payment isolation** | **CRITICAL** | `postPaymentVoucher` with `paymentMethod='UPI'` and `status='FAILED'` or `'PENDING'` must **NOT** reduce `invoice.outstandingBalance` / `purchase.outstandingBalance`, must **NOT** create `AccountTransaction`, and must **NOT** post `JournalEntry`. | `tests/owner_operator_and_trips.test.ts` |
| 9 | **Duplicate journal entry idempotency** | **HIGH** | Calling `postPurchase` / `recordPayment` / `recordExpense` twice for the same `sourceId` throws or no-ops; `journal_entries` contains exactly **1** active `POSTED` entry for `(sourceType, sourceId)`. | `tests/owner_operator_and_trips.test.ts` |
| 10 | **Backward-compatible backup/restore** | **MEDIUM** | Restoring a legacy backup JSON lacking `persons`, `vehicleTrips`, and `paymentAuthorizations` succeeds without throwing. | `tests/backup_and_restore.test.ts` |
| 11 | **PostgreSQL RLS & tenant isolation (DB integration)** | **CRITICAL** | Verify `persons`, `vehicle_trips`, `payment_authorizations` enforce `company_id` RLS (`auth_is_company_member`) and reject cross-company reads/writes. | `tests/staging_pg_integration.test.ts` |
