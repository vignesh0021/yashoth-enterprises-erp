# OWNER-OPERATOR & RECEIPT UPLOAD ACCEPTANCE TESTS

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Branch:** `audit/owner-operator-complete-architecture`  
**Base Commit:** `0148b7a4a6a1e4a2d2c8272f9c3d3636e8d6f6d9`

---

## 1. Existing Reusable Test Suites (Do Not Duplicate)

- `tests/accounting_and_documents.test.ts` — reuse double-entry balance invariants (`validateJournalEntry`) and financial statement assertions.
- `tests/finance.test.ts` & `tests/finance_module.test.ts` — reuse payment allocation, expense voucher, and payroll calculation helpers.
- `tests/backup_and_restore.test.ts` — extend for backward compatibility with new `persons`, `vehicleTrips`, `paymentAuthorizations`, and `documentAttachments` metadata.
- `tests/negative_security_and_rbac.test.ts` & `tests/staging_pg_integration.test.ts` — extend for PostgreSQL RLS and Supabase Storage RLS cross-tenant denial.

---

## 2. Consolidated Acceptance Test Matrix

### A. Identity & Vehicles (`tests/owner_operator_and_trips.test.ts`)
1. **Multi-Role Person**: Single `Person` holding `OWNER` + `DRIVER` + `SUPPLIER` roles resolves without creating duplicate records.
2. **Owner Driving Company-Owned Vehicle**: Trip assigned to `OWNED` vehicle with `isOwnerDriven = true` succeeds.
3. **Owner Driving Supplier-Owned Vehicle**: `SUPPLIER_VEHICLE` stores `ownerPartyId` independently of `driverPersonId`.
4. **Owner Driving Outsourced Vehicle**: `HIRED` vehicle links `transporterPartyId` independently of `driverPersonId`.
5. **Owner Payroll Exclusion Guard**: Attendance/trip logged for an `isOwner = true` / `payrollEligible = false` person accrues **₹0** salary (`calculateMonthlySalary` / payroll accrual).
6. **Vehicle Ownership & Driver Independence**: Changing a vehicle's driver does not mutate `ownerPartyId` or `ownershipType`.

### B. Trips & Accounting Integrity (`tests/owner_operator_and_trips.test.ts`)
7. **Multiple Loads in One Trip**: Single `VehicleTrip` links `>= 2` suppliers, `>= 2` `Weighment`s, and `>= 2` `PurchaseHeader`s with distinct materials.
8. **Freight Duplication Prevention**: Attempting to add `PurchaseHeader.otherCharges` freight when the linked `VehicleTrip` already has a `5030` freight `Expense` is blocked/warned so `5030` is recognized **once**.
9. **Owner Drawings vs Operating Expenses**: `OWNER_DRAWING` posts `Dr. 3030 Owner Drawings / Cr. 1010/1020`; P&L net profit is unaffected. `OWNER_INJECTION` posts `Dr. 1010/1020 / Cr. 3010`.
10. **Owner Personal Expense & Reimbursement**: `Expense` with `paidByType = 'OWNER_PERSONAL'` posts `Dr. 5060/5030 / Cr. 2150 Due to Owner` (company cash/bank untouched); reimbursement posts `Dr. 2150 / Cr. 1010/1020`.
11. **Separate Supplier & Transporter Ledgers**: Scrap purchase credits `2010 Sundry Creditors`; transporter hire credits `2015 Transporter & Freight Payable`.
12. **Recipient vs Beneficiary & Authorization**: Payment to authorized driver/owner (`recipientId`) on behalf of `beneficiaryPartyId` settles `beneficiaryPartyId` AP and requires valid `authorizationId` when `recipientId !== beneficiaryPartyId`.
13. **Failed / Pending UPI Payment**: `postPaymentVoucher` with `paymentMethod = 'UPI'` and `status = 'FAILED'` or `'PENDING'` does **not** reduce `outstandingBalance` and posts **no** `AccountTransaction` or `JournalEntry`.
14. **Duplicate Journal Prevention**: Re-submitting `postPurchase` / `recordPayment` / `recordExpense` for the same `(sourceType, sourceId)` is idempotent / rejected; SQL `uq_journal_active_source` rejects duplicate DB inserts.

### C. Receipt & Attachment Lifecycle (`tests/receipt_attachments.test.ts` + Mobile/Staging)
15. **Camera Capture & Gallery Upload**: Capturing photo via camera or selecting from gallery produces valid compressed WebP/JPEG attachment.
16. **Multiple Photos & PDF Upload**: Attaching 3+ photos to one expense/bill and uploading original PDF (`application/pdf`) succeed; financial balances remain unchanged.
17. **Compression Readability**: Compressed receipt (`100–300 KB`) / invoice (`200–500 KB`) preserves readable dimensions (`>= 1000px` long edge for invoices).
18. **Duplicate Detection**: Re-uploading identical file (`sha256_checksum` match for same parent) is detected and deduplicated.
19. **Interrupted Upload & Retry / Partial Failure**: Metadata-without-object (`UPLOAD_FAILED`) retries cleanly; object-without-metadata recovers or cleans up orphan.
20. **Attachment Replacement & Posted Retention**: Replacing attachment creates versioned row (`replaced_attachment_id`) + `audit_logs`; deleting attachment on `POSTED` bill / `PAID` expense is rejected.
21. **Cross-Company Storage & DB RLS Denial**: Company A user cannot read Company B `document_attachments` or generate/fetch signed URLs for `{company_b_id}/...` paths.
22. **Backup/Restore & Android Low-Storage Handling**: Legacy backups without new fields restore cleanly; low-storage / camera permission denial falls back gracefully with clear user message.
