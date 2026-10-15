# Yasoth Enterprises Scrap ERP — Operator & User Manual

Welcome to the **Yasoth Enterprises Scrap ERP System**. This guide explains day-to-day operations for yard operators, weighbridge clerks, sales coordinators, and accounts staff.

---

## 1. Navigating the ERP

The navigation bar on the left grants quick access to all 14 business areas:
- **Dashboard:** Instant overview of today's tonnage, total yard stock, cash in hand, and urgent alerts.
- **Role Switcher (Top Right):** Allows authorized users to switch between operator profiles (e.g. Weighbridge Clerk, Yard Manager, Accounts) to verify permissions.

---

## 2. Daily Operations Workflow

### Step 1: Incoming Truck & Gate Weighment
1. Navigate to **Weighment** or click **+ Weighment** in the top header.
2. Select the weighing method (e.g., *Weighbridge Slip Entry*).
3. Enter the public weighbridge slip number (e.g. `WB-40291`) and truck number (e.g. `TN 18 BY 0420`).
4. Enter **Gross Weight** (loaded truck) and **Tare Weight** (empty truck).
5. Enter **Approved Deductions** if the load has oil contamination, moisture, or non-metallic waste.
6. The system automatically computes:
   - $\text{Net Weight} = \text{Gross} - \text{Tare}$
   - $\text{Payable Weight} = \text{Net} - \text{Deductions}$
7. Click **Confirm Weighment Slip**.

### Step 2: Creating and Posting Scrap Purchases
1. Navigate to **Purchases** and click **+ New Purchase Order**.
2. Select the **Supplier**, destination **Yard**, and truck registration.
3. Select the material (e.g. *MS Boring Scrap* or *HMS 1*).
4. Enter the agreed rate per KG (the system automatically loads default market purchase rates).
5. Click **Save & Approve Purchase**.
6. When the material is tipped into the yard, click **Post Stock Inward**.
   - *Rule:* The system automatically creates a new FIFO inventory lot and updates yard stock.

### Step 3: Outbound Scrap Sales & Tax Invoices
1. Navigate to **Sales & Dispatch** and click **+ New Sales Order & Dispatch**.
2. Select the **Customer / Buyer** (e.g. *TEJAS STEEL*).
3. Select the material and enter the dispatch weight (KG) and selling rate.
4. *Stock Protection:* The system automatically checks available yard stock. If requested weight exceeds stock, dispatch is blocked.
5. Click **Confirm Dispatch & Generate Invoice**.
   - The system automatically consumes lots using First-In First-Out (FIFO) and displays the official **Tax Invoice**.
6. Click **Print / Save as PDF (A4)** to produce the customer invoice matching Yasoth Enterprises letterhead.

### Step 4: Payments & Cashbook Maintenance
1. Navigate to **Payments & Ledger** $\rightarrow$ **Record Payment Voucher**.
2. To receive customer payments:
   - Direction: `Money Received (Customer Receipt)`
   - Select Customer and account (e.g. *City Union Bank* or *Yard Petty Cash*).
   - Enter amount and select the unpaid invoice to settle.
3. To transfer cash from yard office to bank:
   - Navigate to **Funds & Expenses** $\rightarrow$ **Cash ⇄ Bank Contra Transfer**.
   - Source: *Yard Petty Cash Box*, Destination: *City Union Bank*.
   - Enter amount (e.g. ₹20,000) and challan reference.
   - *Accounting Rule:* Cash decreases by ₹20,000 and bank increases by ₹20,000 without altering revenue or expense.

### Step 5: Monthly Physical Stock Audit
1. Navigate to **Inventory & Lots** $\rightarrow$ **Physical Stock Count Audit**.
2. Enter the actual physical tonnage counted on the ground.
3. The system highlights the variance against the ledger.
4. Enter the reason for variance and click **Approve & Post Reconciliation Adjustments**.
   - The adjustment is permanently audited without erasing historical transactions.
