# Yasoth Enterprises Scrap ERP — Automated Test Report

**Execution Command:** `npm test` (`vitest run`)  
**Runner:** Vitest v2.1.9 (Environment: jsdom)  
**Total Test Files:** 6 passed (6 total)  
**Total Tests:** 21 passed (21 total)  
**Total Failures:** 0  
**Status:** **100% PASSING**

---

## 1. Test Suite Summary

```
 RUN  v2.1.9 C:/Users/USER/Downloads/YE

 ✓ tests/finance.test.ts (3 tests)
 ✓ tests/inventory.test.ts (5 tests)
 ✓ tests/sales.test.ts (1 test)
 ✓ tests/migration.test.ts (2 tests)
 ✓ tests/purchases.test.ts (3 tests)
 ✓ tests/weighment.test.ts (7 tests)

 Test Files  6 passed (6)
      Tests  21 passed (21)
   Duration  37.42s
```

---

## 2. Detailed Test Specifications & Results

### 2.1. Weighment Engine (`tests/weighment.test.ts`)
| Test Case | Scenario / Assertion | Status |
|---|---|---|
| `calcNetWeight valid` | 12,500 KG Gross - 4,500 KG Tare = 8,000 KG Net | **PASS** |
| `reject tare > gross` | Tare weight 4,500 KG > Gross weight 4,000 KG throws error | **PASS** |
| `reject negative values` | Negative gross (-100 KG) or tare (-50 KG) throws error | **PASS** |
| `calcPayableWeight` | 8,000 KG Net - 250 KG approved deductions = 7,750 KG Payable | **PASS** |
| `reject deduction > net` | 300 KG deduction on 200 KG net weight throws error | **PASS** |
| `calcMaterialAmount` | 8,000 KG Payable × ₹30.00/KG = ₹2,40,000.00 | **PASS** |
| `decimal precision` | Preserves 3 decimal places for metric ton and gram conversions | **PASS** |

### 2.2. Inventory & Stock Ledger (`tests/inventory.test.ts`)
| Test Case | Scenario / Assertion | Status |
|---|---|---|
| `calculateCurrentStock` | Computes 3,000 KG balance from +5,000 KG inward and -2,000 KG dispatch | **PASS** |
| `reject negative stock` | Rejects -1,500 KG dispatch when current available stock is only 1,000 KG | **PASS** |
| `FIFO lot allocation` | Dispatches 1,500 KG by consuming 1,000 KG from Lot 1 (@ ₹25) and 500 KG from Lot 2 (@ ₹30), computing exact COGS of ₹40,000 | **PASS** |
| `insufficient lot stock` | Rejects allocation when requested dispatch exceeds total unexhausted lots | **PASS** |
| `reversal movement` | Creates positive restoring movement of +500 KG with immutable audit trail | **PASS** |

### 2.3. Purchase Posting & Inward (`tests/purchases.test.ts`)
| Test Case | Scenario / Assertion | Status |
|---|---|---|
| `postPurchaseTransaction` | Transition to `POSTED` generates active lot and inward movement | **PASS** |
| `duplicate posting rejection` | Attempting to post an already posted purchase throws duplicate exception | **PASS** |
| `cancelled purchase rejection` | Rejects posting of cancelled purchase order | **PASS** |

### 2.4. Sales Dispatch & Invoice Renderer (`tests/sales.test.ts`)
| Test Case | Scenario / Assertion | Status |
|---|---|---|
| `dispatch & invoice generation` | Exactly reproduces TEJAS sample numbers: 7,720 KG @ ₹30 = ₹2,31,600 taxable + ₹20,844 CGST + ₹20,844 SGST = ₹2,73,288 total; validates words "INR Two Lakh Seventy Three Thousand Two Hundred Eighty Eight Only" | **PASS** |

### 2.5. Finance & Accounting Controls (`tests/finance.test.ts`)
| Test Case | Scenario / Assertion | Status |
|---|---|---|
| `customer receipt allocation` | Applies ₹50,000 receipt against ₹1,18,000 invoice, reducing outstanding to ₹68,000 and debiting bank | **PASS** |
| `over-allocation rejection` | Rejects ₹25,000 allocation on a ₹20,000 payment voucher | **PASS** |
| `contra transfer non-revenue` | ₹20,000 cash-to-bank atomically credits cash, debits bank, creating ₹0 income/expense | **PASS** |

### 2.6. Data Migration Wizard (`tests/migration.test.ts`)
| Test Case | Scenario / Assertion | Status |
|---|---|---|
| `dry-run validation` | Quarantines duplicate party codes and invalid types without touching live records | **PASS** |
| `opening stock commit` | Creates verified opening stock lots and movements with audit trail | **PASS** |
