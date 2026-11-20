# DATABASE SCHEMA GAP REPORT

**Repository:** `vignesh0021/yashoth-enterprises-erp`  
**Audited Migrations:** `database/migrations/001_initial_schema.sql` through `011_realtime_publication_and_authoritative_sync.sql`  
**Audited Commit:** `dc078c16ee6d81790dacb1ea07c352807caca1c4`

---

## 1. Existing Schema Strengths (Re-use, Do Not Duplicate)

1. **Multi-tenant `company_id` & RLS (`003`, `004`, `007`, `009`, `010`)**:
   - `auth_is_company_member(cid)` and `auth_has_company_role(cid, VARIADIC allowed_roles)` in `007_authoritative_rls_hardening.sql` already enforce company isolation and role-based access (`owner_admin`, `accounts_operator`, `supervisor`, etc.).
2. **Double-entry GL (`005_accounting_and_documents.sql`)**:
   - `chart_of_accounts`, `journal_entries` (with `chk_journal_balanced`), and `journal_lines` (with `party_id` sub-ledger FK and `chk_line_nonzero`) already exist.
3. **Vehicle & Expense foundations (`001_initial_schema.sql`, `008_finance_and_labour_management.sql`)**:
   - `vehicles` already has `ownership_type` (`OWNED`, `HIRED`, `CUSTOMER_VEHICLE`, `SUPPLIER_VEHICLE`) and `tare_weight`.
   - `expenses` already has `vehicle_id UUID REFERENCES vehicles(id)` (`001_initial_schema.sql#L459`), `payment_mode`, `status`, and `approval_status` (`008_finance_and_labour_management.sql#L23-L25`).

---

## 2. Schema Gap Matrix (8 Required Capabilities)

| # | Capability | Severity | Existing Table(s) Involved | Missing Columns / Tables / Constraints | Recommended Non-Duplicative Change |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Multi-role person identity** | **CRITICAL** | `parties` (`001#L93`), `employees` (`001#L145`), `contractors` (`008#L109`), `users_roles` (`001#L8`) | `parties.party_type` only allows `('SUPPLIER', 'CUSTOMER', 'BOTH')`. No shared person entity linking an individual who is simultaneously Owner/Staff/Supplier/Transporter/Driver. | Add `persons` (or `party_roles` table + expand `parties.party_type` / add `is_transporter`, `is_driver`, `is_owner` role flags) with optional `person_id` FK on `parties`, `employees`, `contractors`, and `company_memberships`. |
| 2 | **Vehicle ownership type** | **LOW** | `vehicles` (`001#L123`) | `ownership_type` already has `'OWNED'`, `'HIRED'`, `'CUSTOMER_VEHICLE'`, `'SUPPLIER_VEHICLE'`. Missing `'OWNER_PERSONAL'` (if owner's personal vehicle is used) or `'TRANSPORTER_VEHICLE'`. | Extend `vehicles.ownership_type` CHECK constraint to include `'OWNER_PERSONAL'` / `'TRANSPORTER_VEHICLE'` (preserving existing 4 values). |
| 3 | **Independent vehicle owner & driver references** | **HIGH** | `vehicles` (`001#L119-L129`) | `driver_name` and `driver_phone` are free-text `VARCHAR` fields; no `owner_party_id` or `default_driver_person_id` / `is_owner_driven` columns. | Add `owner_party_id UUID REFERENCES parties(id)`, `default_driver_id UUID` (FK to `persons`/`parties`), and `is_owner_driven BOOLEAN DEFAULT false` on `vehicles`. Keep `driver_name`/`driver_phone` for backward compatibility. |
| 4 | **Vehicle trip headers** | **CRITICAL** | `collection_jobs` (`001#L216-L232`) | `collection_jobs` is a 1-supplier, 1-material pickup request (`supplier_party_id NOT NULL`, `material_id NOT NULL`). Cannot represent a multi-stop vehicle trip. | Add `vehicle_trips` table (`id`, `company_id`, `trip_no`, `trip_date`, `vehicle_id`, `driver_person_id`, `is_owner_driven`, `transporter_party_id`, `status`, `odometer_start`, `odometer_end`, `notes`) with RLS + `company_id`. |
| 5 | **Multiple loads per trip** | **CRITICAL** | `weighments` (`001#L192`), `purchase_headers` (`001#L235`), `collection_jobs` (`001#L216`) | `purchase_headers` has single `weighment_id` and `collection_job_id`; `weighments` has no `trip_id`; no `trip_loads` join or `trip_id` FK. | Add `trip_id UUID REFERENCES vehicle_trips(id)` to `weighments`, `purchase_headers`, `collection_jobs`, and `expenses`. Optionally add `purchase_weighments` (N:M) if one purchase spans multiple weighments. |
| 6 | **Driver payment authorization** | **HIGH** | `payments` (`001#L406`), `parties` (`001#L93`) | No table or column recording that a supplier/transporter authorized a specific driver or the company owner to collect payment on their behalf. | Add `payment_authorizations` table (`id`, `company_id`, `beneficiary_party_id`, `authorized_recipient_id`, `trip_id`, `valid_from`, `valid_until`, `max_amount`, `proof_url`, `status`) and link `payments.authorization_id`. |
| 7 | **Payment recipient & beneficiary allocation** | **CRITICAL** | `payments` (`001#L406-L420`), `payment_allocations` (`001#L422-L429`) | `payments` has only `party_id` (conflating who received the money with whose AP/AR ledger is settled) and **no `status` column** (`PENDING`, `COMPLETED`, `FAILED`, `REVERSED`). | Add `recipient_party_id` / `recipient_person_id`, `beneficiary_party_id` (defaulting to `party_id`), `authorization_id`, and `status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING','COMPLETED','FAILED','REVERSED'))` on `payments`. |
| 8 | **Owner reimbursements & advances** | **CRITICAL** | `expenses` (`001#L452`, `008#L14`), `account_transactions` (`001#L432`) | `expenses.account_id` is `NOT NULL` in `001` (nullable in `008`), `payment_mode` only allows `('CASH','BANK','UNPAID')` — no `'OWNER_PERSONAL'`, no `paid_by_person_id`, no `reimbursement_status`, no `owner_reimbursements` ledger. | Add `paid_by_type VARCHAR(30) DEFAULT 'COMPANY' CHECK (paid_by_type IN ('COMPANY','OWNER_PERSONAL','DRIVER_ADVANCE'))`, `paid_by_person_id`, `reimbursement_status`, and `trip_id` to `expenses`; add `owner_reimbursements` (or settle via `expenses` + `journal_entries` against `2150 Due to Owner`). |

---

## 3. Additional Database Integrity Gaps Found

1. **Duplicate Journal Entry Prevention (`005_accounting_and_documents.sql#L96-L127`)**:
   - `journal_entries` has `UNIQUE (company_id, entry_no)` and an index `idx_journal_source ON journal_entries(source_type, source_id)`, **but no UNIQUE constraint on `(company_id, source_type, source_id)`** (for active non-reversed entries). A retry or double-click can insert duplicate `journal_entries` with different `entry_no`s.
2. **Employee Payroll Exclusion for Owner (`001_initial_schema.sql#L145-L158`)**:
   - `employees` has no `is_owner` or `payroll_eligible BOOLEAN NOT NULL DEFAULT true` column, nor `UNIQUE` link to `auth.users` / `persons`.
3. **Migration Risks**:
   - `001_initial_schema.sql#L436-L440` CHECK constraint on `account_transactions.transaction_type` does not include `'ACCOUNT_ADJUSTMENT'` (even though `src/types/index.ts#L432` has it).
   - `001_initial_schema.sql#L164` CHECK constraint on `attendance_entries.status` does not include `'DOUBLE_SHIFT'` (even though `src/types/index.ts#L544` has it).
   - New tables (`persons`, `person_roles`, `vehicle_trips`, `trip_stops`, `payment_authorizations`, `document_attachments`) MUST include `company_id UUID NOT NULL REFERENCES companies(id)` and RLS policies using `auth_is_company_member(company_id)` / `auth_has_company_role(...)` matching `007` and `009`, plus `SECURITY DEFINER` RPCs with `SET search_path = public, pg_temp`.

---

## 4. Target Canonical Person Identity & Vehicle-Trip Architecture

### 4.1 Canonical Person & Role Separation (No Duplicate Person Records)
- **`persons`** (`id UUID PK`, `company_id`, `full_name`, `phone`, `email`, `pan`, `auth_user_id UUID NULL REFERENCES auth.users(id)`, `is_active`): Single canonical human identity.
- **`person_roles`** (`id UUID PK`, `company_id`, `person_id FK`, `role_type IN ('OWNER','DRIVER','SUPPLIER','TRANSPORTER','VEHICLE_OWNER','AGENT','EMPLOYEE')`, `UNIQUE (company_id, person_id, role_type)`): One person can hold any combination of roles without implying payroll or liability automatically.
- **Role-Specific Links**: `parties.person_id`, `employees.person_id` (+ `employees.is_owner`, `employees.payroll_eligible`), `vehicles.owner_party_id`, `vehicles.default_driver_person_id`, `vehicles.is_owner_driven`.

### 4.2 Trip → Stops → Loads → Weighments → Purchases → Expenses → Payments Traceability
- **`vehicle_trips`**: `id`, `company_id`, `trip_no`, `trip_date`, `vehicle_id FK`, `driver_person_id FK`, `is_owner_driven`, `transporter_party_id FK`, `freight_liability_party_id FK`, `status ('PLANNED'|'IN_TRANSIT'|'COMPLETED'|'CLOSED')`.
- **`trip_stops`**: `id`, `company_id`, `trip_id FK`, `stop_order INT`, `supplier_party_id FK`, `pickup_location`, `collection_job_id FK NULL`.
- **Multi-Load Linkage**: `weighments.trip_id` + `weighments.trip_stop_id`, `purchase_headers.trip_id` + `purchase_headers.trip_stop_id`, `expenses.trip_id` — allowing 1 trip to contain N stops, N weighments, N purchases, N expenses, and N payments without forcing `1 trip = 1 purchase`.
