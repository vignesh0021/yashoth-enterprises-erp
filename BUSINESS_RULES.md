# Yasoth Enterprises Scrap ERP — Business Rules & Controls

## 1. Weighment Rules

1. **Calculated Net Weight:**  
   $$\text{Net Weight} = \text{Gross Weight} - \text{Tare Weight}$$
   - Both weights must be non-negative real numbers.
   - Tare weight cannot exceed gross weight.
2. **Approved Deductions & Payable Weight:**  
   $$\text{Payable Weight} = \text{Net Weight} - \text{Approved Deductions}$$
   - Contamination, dirt, water, and non-metallic scrap deductions must be authorized.
   - Deductions cannot exceed net weight.
3. **Material Payable Valuation:**  
   $$\text{Material Amount} = \text{Payable Weight} \times \text{Rate per Unit}$$
4. **Duplicate Slip Prevention:**  
   - Public weighbridge slip references are verified across the system; duplicates trigger verification flags and require supervisory override.

---

## 2. Inventory & Stock Ledger Rules

1. **Immutable Append-Only Movements:**  
   - Stock balances cannot be modified via manual edits. All changes require an explicit, dated `StockMovement`.
2. **Draft Isolation:**  
   - Unposted purchase orders, collection requests, and sales drafts never alter available stock balances.
3. **Non-Negative Stock Guard:**  
   - Outward dispatch movements cannot exceed current available stock at the specified yard.
4. **First-In, First-Out (FIFO) Lot Costing:**  
   - Outward sales dispatch consumes active lots in order of their arrival timestamp.
   - Cost of Goods Sold (COGS) equals the weighted sum of consumed lot unit costs:
     $$\text{COGS} = \sum (\text{Allocated Quantity}_i \times \text{Lot Unit Cost}_i)$$
5. **Physical Count Reconciliation:**  
   - Ground count differences generate auditable `STOCK_ADJUSTMENT` (for gains) or `STOCK_LOSS` (for losses) movements with explicit reasons. The existing ledger history is preserved.

---

## 3. GST Invoicing & Taxation Rules

1. **Standard Scrap GST Treatment:**  
   - Scrap metals (HSN 7204 Ferrous waste and scrap, HSN 7404 Copper scrap, HSN 7602 Aluminium scrap) are subject to 18% GST.
   - **Intra-State (Within Tamil Nadu, State Code 33):**
     - CGST: 9.00%
     - SGST: 9.00%
   - **Inter-State (Outside Tamil Nadu):**
     - IGST: 18.00%
2. **Deterministic Rounding:**  
   - The invoice grand total is rounded to the nearest whole rupee; the rounding adjustment is recorded in `round_off`.
3. **Immutable Snapshots:**  
   - Upon issuance, a complete JSON snapshot of the invoice is persisted. Master rate changes cannot alter past invoices.
4. **Indian Numbering Words:**  
   - Converted using Crores, Lakhs, Thousands, and Hundreds:
     - Example: ₹2,73,288.00 $\rightarrow$ `"INR Two Lakh Seventy Three Thousand Two Hundred Eighty Eight Only"`.

---

## 4. Finance & Account Controls

1. **Inter-Account Contra Transfers:**  
   - Moving funds between cash box and bank account creates linked contra transactions:
     - Source account: `CREDIT`
     - Destination account: `DEBIT`
     - Revenue recognized: ₹0.00
     - Expense recognized: ₹0.00
2. **Payment Allocation Limits:**  
   - Allocations cannot exceed the payment voucher amount.
   - Payments applied against invoices update `amount_paid`, `outstanding_balance`, and `payment_status` (`PARTIALLY_PAID` or `PAID`).
3. **Operating Profitability vs Cash Flow:**  
   - Invoiced sales are not equated with collected cash.
   - Gross Margin is defined as:
     $$\text{Gross Margin} = \text{Net Sales Revenue} - \text{COGS}$$

---

## 5. Approval & Authorization Matrix

| Action | Operator | Yard Manager | Owner / Admin |
|---|---|---|---|
| Enter Purchase Order | Create Draft | Review & Verify | Full Access |
| Post Stock Inward | Restricted | Authorize Normal Limit | Full Access |
| Weighbridge Exception Override | Flag Exception | Authorize with Reason | Review & Audit |
| Physical Stock Reconciliation | Enter Ground Count | Approve Adjustment | Full Access |
| Post Payment Voucher | Draft Entry | Approve Up to ₹1,00,000 | Unlimited |
| Inter-Account Contra Transfer | View Only | Execute Transfer | Full Access |
| Modify Master Rates / GSTIN | View Only | Restricted | Full Access |
