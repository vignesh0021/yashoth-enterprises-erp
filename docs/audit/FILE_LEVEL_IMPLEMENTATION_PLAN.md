# FILE-LEVEL IMPLEMENTATION PLAN

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Audited Commit:** `dc078c16ee6d81790dacb1ea07c352807caca1c4`  
**Status:** Proposed Plan — **Awaiting Explicit Approval**

---

## 1. Recommended Implementation Sequence (5 Phases)

1. **Phase 1 — Database Schema & RLS Migration (`012_owner_operator_and_trips.sql`)**
   - Add `persons` (multi-role identity) + link `person_id` on `parties`, `employees`, `contractors`, `company_memberships`.
   - Expand `parties.party_type` (`'SUPPLIER' | 'CUSTOMER' | 'BOTH' | 'TRANSPORTER'`) and `employees.is_owner` / `payroll_eligible`.
   - Add `owner_party_id`, `default_driver_person_id`, `is_owner_driven` on `vehicles`; extend `ownership_type` CHECK.
   - Create `vehicle_trips` table and add `trip_id` FK on `weighments`, `purchase_headers`, `collection_jobs`, `expenses`.
   - Create `payment_authorizations` table; add `status`, `recipient_party_id`, `recipient_person_id`, `beneficiary_party_id`, `authorization_id` on `payments`.
   - Add `paid_by_type`, `paid_by_person_id`, `reimbursement_status` on `expenses`.
   - Add partial unique index `uq_journal_active_source` on `journal_entries(company_id, source_type, source_id)` and new COA accounts (`2015`, `2150`, `3030`).
   - Apply `company_id` RLS policies (`auth_is_company_member`, `auth_has_company_role`) and `SECURITY DEFINER` `SET search_path = public, pg_temp` on any new RPCs.

2. **Phase 2 — Domain Types & Accounting/Finance Rules (`src/types/index.ts`, `accountingEngine.ts`, `financeEngine.ts`)**
   - Update TypeScript interfaces (`Person`, `Vehicle`, `VehicleTrip`, `Payment`, `Expense`, `Party`, `Employee`, `PurchaseHeader`, `Weighment`).
   - Update `accountingEngine.ts`:
     - Add COA codes `2015`, `2150`, `3030`.
     - Add `createOwnerCapitalOrDrawingJournal(...)` and `createOwnerReimbursementJournal(...)`.
     - Update `createPurchaseInvoiceJournal` to prevent freight duplication when `tripId` already carries trip freight expenses.
     - Update `createPaymentJournal` to route `TRANSPORTER` payables to `2015`, record `recipient` in narration, and reject `FAILED` / `PENDING` payments.
     - Update `createExpenseJournal` to credit `2150 Due to Owner` when `paidByType === 'OWNER_PERSONAL'`.
   - Update `financeEngine.ts`:
     - Guard `postPaymentVoucher` against `status === 'FAILED'` or `'PENDING'` (do not settle `outstandingBalance` or create `AccountTransaction`).
     - Add `validatePersonRoles` & `preventOwnerPayrollAccrual` guard.

3. **Phase 3 — Context, Sync & Repository (`ERPContext.tsx`, `databaseRepository.ts`, `backupEngine.ts`)**
   - Add `persons`, `vehicleTrips`, `paymentAuthorizations` state + CRUD + `appendJournalIfAbsent` idempotency guard.
   - Wire `OWNER_INJECTION` (`3010`) and `OWNER_DRAWING` (`3030`) in `addAccountTransaction` to post balanced journals.
   - Add `reimburseOwnerExpense` action (`Dr. 2150 / Cr. 1010/1020`).
   - Update `BackupDatabasePayload` in `src/types/index.ts` & `backupEngine.ts` so backups include the new entities safely with backward compatibility for older backups.

4. **Phase 4 — UI Modules**
   - `VehiclesView.tsx`: Owner Party selector, Default Driver Person selector, `Is Owner Driven` toggle.
   - `CollectionsView.tsx` / **Trips View**: Multi-load Trip Header (`VehicleTrip`), link multiple weighments & purchases to one trip, log trip fuel/toll with `Paid by Company` vs `Paid by Owner (Personal)`.
   - `PurchasesView.tsx` & `WeighmentView.tsx`: Optional `tripId` selector + freight-duplication warning when trip already has freight expense.
   - `PartiesView.tsx`: Support `TRANSPORTER` role + multi-role Person linking.
   - `EmployeesView.tsx`: `Is Owner (Exclude from Salary)` badge/guard.
   - `PaymentsView.tsx`: `Payment Status` (`COMPLETED` / `PENDING` / `FAILED`), `Beneficiary Party` vs `Authorized Recipient` selector, and Authorization reference.
   - `FinanceView.tsx`: Owner Reimbursements queue (`Due to Owner 2150` → 1-tap Reimburse) and Owner Capital/Drawings journal integration.

5. **Phase 5 — Regression & Negative Security Testing**
   - Add unit, accounting-invariant, and RLS negative tests (detailed in `TEST_COVERAGE_GAP_REPORT.md`).

---

## 2. Exact Files Expected to Change

| Layer | Exact File Path | Change Summary |
| :--- | :--- | :--- |
| **Database** | `database/migrations/012_owner_operator_and_trips.sql` (new) | Additive schema, COA seeds, partial unique journal index, RLS policies |
| **Types** | `src/types/index.ts` | Add `Person`, `VehicleTrip`, `PaymentAuthorization`, extend `Vehicle`, `Party`, `Employee`, `Payment`, `Expense`, `PurchaseHeader`, `Weighment`, `BackupDatabasePayload` |
| **Accounting** | `backend/business-rules/accountingEngine.ts` | COA `2015`/`2150`/`3030`, owner drawings/reimbursement journals, transporter AP routing, failed-payment guard |
| **Finance** | `backend/business-rules/financeEngine.ts` | Payment status guard (`FAILED`/`PENDING`), freight-duplication check, owner reimbursement validation |
| **Backup** | `backend/business-rules/backupEngine.ts` | Include `persons`, `vehicleTrips`, `paymentAuthorizations` in backup/restore payload |
| **State** | `src/context/ERPContext.tsx` | State + CRUD for trips/persons/authorizations, `appendJournalIfAbsent`, GL posting on `OWNER_INJECTION`/`OWNER_DRAWING` |
| **Repo** | `src/services/databaseRepository.ts` | Read/write mappers for new columns and tables |
| **UI** | `src/modules/vehicles/VehiclesView.tsx` | Owner party, driver person, owner-driven toggle |
| **UI** | `src/modules/collections/CollectionsView.tsx` | Multi-load Trip management + trip expenses |
| **UI** | `src/modules/weighment/WeighmentView.tsx` | Trip linking for multi-load weighments |
| **UI** | `src/modules/purchases/PurchasesView.tsx` | Trip linking + freight duplication warning |
| **UI** | `src/modules/parties/PartiesView.tsx` | `TRANSPORTER` type + Person link |
| **UI** | `src/modules/employees/EmployeesView.tsx` | `isOwner` / `payrollEligible` guard |
| **UI** | `src/modules/payments/PaymentsView.tsx` | Payment `status` (`COMPLETED`/`PENDING`/`FAILED`), Recipient vs Beneficiary, Authorization |
| **UI** | `src/modules/finance/FinanceView.tsx` | Owner Reimbursements (`2150`) & Owner Drawings (`3030`) |

---

## 3. Potential Breaking Changes & Mitigations

1. **`PartyType` expansion (`'TRANSPORTER'`)**: Existing UI filters in `PartiesView.tsx` (`ALL`, `SUPPLIER`, `CUSTOMER`, `BOTH`) and `PurchasesView.tsx`/`InvoicesView.tsx` must handle `'TRANSPORTER'` gracefully without breaking existing dropdowns.
2. **`Payment` `status` default**: Existing persisted `Payment` records in `localStorage` and Supabase lack `status`; all readers must default `status ?? 'COMPLETED'` so historical settled invoices/purchases remain settled.
3. **`BackupDatabasePayload` backward compatibility**: `previewRestore` and `executeSystemRestore` must treat `persons`, `vehicleTrips`, and `paymentAuthorizations` as optional arrays (`?? []`) so older `.yebak`/JSON backups still restore cleanly.
4. **SQL CHECK constraint updates**: Updating `account_transactions.transaction_type` and `attendance_entries.status` CHECK constraints in `012` must use `DROP CONSTRAINT IF EXISTS ...` followed by `ADD CONSTRAINT ...` idempotently.
