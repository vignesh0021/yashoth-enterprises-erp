// Yasoth Enterprises — Production Scrap ERP
// Canonical Double-Entry Accounting Engine & Financial Statement Derivation
// Strictly enforces double-entry balance: SUM(Debits) === SUM(Credits) across all posted journals.

import { roundTo2 } from '../../src/utils/calculations.ts';
import type { 
  Company, 
  Invoice, 
  PurchaseHeader, 
  Payment, 
  AccountTransaction, 
  Expense,
  Party 
} from '../../src/types/index.ts';

export type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export interface ChartOfAccount {
  code: string;
  name: string;
  category: AccountCategory;
  normalBalance: 'DEBIT' | 'CREDIT';
  isSystem: boolean;
}

export interface JournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  partyId?: string;
  partyName?: string;
  lineNarration?: string;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  entryNo: string;
  entryDate: string;
  sourceType: 
    | 'SALES_INVOICE' 
    | 'PURCHASE_INVOICE' 
    | 'PAYMENT' 
    | 'CONTRA' 
    | 'EXPENSE' 
    | 'CREDIT_NOTE' 
    | 'DEBIT_NOTE' 
    | 'MANUAL'
    | 'MANUAL_JOURNAL' 
    | 'OPENING_BALANCE';
  sourceId?: string;
  referenceNo?: string;
  narration: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  isPosted: boolean;
  createdBy: string;
  createdAt: string;
}

export class AccountingImbalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingImbalanceError';
  }
}

/**
 * Standard Scrap Industry Chart of Accounts (COA)
 */
export const STANDARD_CHART_OF_ACCOUNTS: ChartOfAccount[] = [
  // Assets (1000 - 1999)
  { code: '1010', name: 'Cash on Hand', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1020', name: 'Bank Accounts (Current/OD)', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1050', name: 'Scrap Metal Inventory', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1100', name: 'Sundry Debtors (Customers A/R)', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1150', name: 'Input Tax Credit — CGST', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1160', name: 'Input Tax Credit — SGST', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1170', name: 'Input Tax Credit — IGST', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1200', name: 'Fixed Assets (Weighbridges & Trucks)', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },

  // Liabilities (2000 - 2999)
  { code: '2010', name: 'Sundry Creditors (Suppliers A/P)', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2050', name: 'Output Tax Liability — CGST', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2060', name: 'Output Tax Liability — SGST', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2070', name: 'Output Tax Liability — IGST', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2100', name: 'Employee Wages & Advances Payable', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },

  // Equity (3000 - 3999)
  { code: '3010', name: 'Proprietor / Partners Capital', category: 'EQUITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '3020', name: 'Retained Earnings / Prior P&L', category: 'EQUITY', normalBalance: 'CREDIT', isSystem: true },

  // Revenue / Income (4000 - 4999)
  { code: '4010', name: 'Scrap Sales Revenue', category: 'INCOME', normalBalance: 'CREDIT', isSystem: true },
  { code: '4020', name: 'Demolition Contract Services', category: 'INCOME', normalBalance: 'CREDIT', isSystem: true },
  { code: '4050', name: 'Other Direct Income', category: 'INCOME', normalBalance: 'CREDIT', isSystem: true },

  // Direct & Indirect Expenses (5000 - 5999)
  { code: '5010', name: 'Scrap Raw Material Purchases', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5020', name: 'Demolition Direct Labor & Cutting', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5030', name: 'Freight, Haulage & Crane Charges', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5040', name: 'Yard Utilities & Maintenance', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5050', name: 'Salaries & Staff Wages', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5060', name: 'Vehicle Running & Diesel Cost', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5090', name: 'Round-Off & Decimal Variance', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
];

export const DEFAULT_CHART_OF_ACCOUNTS = STANDARD_CHART_OF_ACCOUNTS;

/**
 * Validates double-entry mathematical balance.
 */
export function validateJournalEntry(entry: JournalEntry): void {
  if (!entry.lines || entry.lines.length === 0) {
    throw new AccountingImbalanceError(`Journal Entry "${entry.entryNo}" must contain at least one line item.`);
  }

  const sumDebits = roundTo2(entry.lines.reduce((s, l) => s + (l.debit || 0), 0));
  const sumCredits = roundTo2(entry.lines.reduce((s, l) => s + (l.credit || 0), 0));

  if (sumDebits === 0 && sumCredits === 0) {
    throw new AccountingImbalanceError(`Journal Entry "${entry.entryNo}" cannot have zero debits and zero credits.`);
  }

  if (Math.abs(sumDebits - sumCredits) > 0.05) {
    throw new AccountingImbalanceError(
      `Journal Entry "${entry.entryNo}" is unbalanced: Total Debits (₹${sumDebits}) != Total Credits (₹${sumCredits}). Difference: ₹${roundTo2(sumDebits - sumCredits)}`
    );
  }
}

/**
 * Generates double-entry posting for a Sales Tax Invoice:
 * Dr. Sundry Debtors (Customer)   [Grand Total]
 *   Cr. Scrap Sales Revenue       [Taxable Value]
 *   Cr. Output CGST               [CGST Amount]
 *   Cr. Output SGST               [SGST Amount]
 *   Cr. Output IGST               [IGST Amount]
 *   Cr/Dr. Round-Off              [Difference]
 */
export function createSalesInvoiceJournal(invoice: Invoice, company: Company): JournalEntry {
  const lines: JournalLine[] = [];
  const grandTotal = roundTo2(invoice.grandTotal);
  const taxable = roundTo2(invoice.subtotalTaxable);
  const cgst = roundTo2((invoice as any).cgstAmount ?? (invoice as any).cgstTotal ?? 0);
  const sgst = roundTo2((invoice as any).sgstAmount ?? (invoice as any).sgstTotal ?? 0);
  const igst = roundTo2((invoice as any).igstAmount ?? (invoice as any).igstTotal ?? 0);
  const roundOff = roundTo2(invoice.roundOff || 0);

  // 1. Debit Sundry Debtors (Customer A/R)
  lines.push({
    id: `jl-${invoice.id}-dr-ar`,
    accountCode: '1100',
    accountName: 'Sundry Debtors (Customers A/R)',
    debit: grandTotal,
    credit: 0,
    partyId: invoice.customerPartyId,
    partyName: invoice.customerName,
    lineNarration: `Invoice ${invoice.invoiceNo} issued to ${invoice.customerName}`,
  });

  // 2. Credit Sales Revenue
  lines.push({
    id: `jl-${invoice.id}-cr-sales`,
    accountCode: '4010',
    accountName: 'Scrap Sales Revenue',
    debit: 0,
    credit: taxable,
    lineNarration: `Taxable scrap sales under ${invoice.invoiceNo}`,
  });

  // 3. Credit Output Taxes
  if (cgst > 0) {
    lines.push({
      id: `jl-${invoice.id}-cr-cgst`,
      accountCode: '2050',
      accountName: 'Output Tax Liability — CGST',
      debit: 0,
      credit: cgst,
      lineNarration: `Output CGST on ${invoice.invoiceNo}`,
    });
  }

  if (sgst > 0) {
    lines.push({
      id: `jl-${invoice.id}-cr-sgst`,
      accountCode: '2060',
      accountName: 'Output Tax Liability — SGST',
      debit: 0,
      credit: sgst,
      lineNarration: `Output SGST on ${invoice.invoiceNo}`,
    });
  }

  if (igst > 0) {
    lines.push({
      id: `jl-${invoice.id}-cr-igst`,
      accountCode: '2070',
      accountName: 'Output Tax Liability — IGST',
      debit: 0,
      credit: igst,
      lineNarration: `Output IGST on ${invoice.invoiceNo}`,
    });
  }

  // 4. Handle Round-Off
  if (roundOff !== 0) {
    if (roundOff > 0) {
      // Positive roundoff adds to grand total -> Credit roundoff income
      lines.push({
        id: `jl-${invoice.id}-cr-ro`,
        accountCode: '5090',
        accountName: 'Round-Off & Decimal Variance',
        debit: 0,
        credit: Math.abs(roundOff),
        lineNarration: 'Invoice round-off adjustment',
      });
    } else {
      // Negative roundoff subtracts from total -> Debit roundoff expense
      lines.push({
        id: `jl-${invoice.id}-dr-ro`,
        accountCode: '5090',
        accountName: 'Round-Off & Decimal Variance',
        debit: Math.abs(roundOff),
        credit: 0,
        lineNarration: 'Invoice round-off adjustment',
      });
    }
  }

  const computedTotalDebit = roundTo2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const computedTotalCredit = roundTo2(lines.reduce((s, l) => s + (l.credit || 0), 0));

  const entry: JournalEntry = {
    id: `je-sal-${invoice.id}`,
    companyId: company.id,
    entryNo: `JV-SAL-${invoice.invoiceNo.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate: invoice.invoiceDate,
    sourceType: 'SALES_INVOICE',
    sourceId: invoice.id,
    referenceNo: invoice.invoiceNo,
    narration: `Tax Invoice ${invoice.invoiceNo} for ${invoice.customerName} (Grand Total: ₹${grandTotal})`,
    lines,
    totalDebit: computedTotalDebit,
    totalCredit: computedTotalCredit,
    isPosted: true,
    createdBy: invoice.createdBy || 'system',
    createdAt: invoice.createdAt || new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Generates double-entry posting for a Purchase Invoice:
 * Dr. Scrap Raw Material Purchases [Taxable Value]
 * Dr. Input CGST                   [CGST Amount]
 * Dr. Input SGST                   [SGST Amount]
 * Dr. Input IGST                   [IGST Amount]
 *   Cr. Sundry Creditors (Supplier)[Total Amount]
 */
export function createPurchaseInvoiceJournal(
  purchase: PurchaseHeader, 
  supplierParty: Party | undefined,
  company: Company
): JournalEntry {
  const lines: JournalLine[] = [];
  const totalAmount = roundTo2(purchase.totalAmount ?? (purchase as any).grandTotal ?? 0);
  const taxable = roundTo2(purchase.subtotalAmount ?? (purchase as any).subtotalTaxable ?? 0);
  const taxAmount = roundTo2(
    purchase.taxAmount ?? 
    (((purchase as any).cgstAmount || 0) + ((purchase as any).sgstAmount || 0) + ((purchase as any).igstAmount || 0))
  );
  const partyName = supplierParty?.legalName || 'Supplier';
  const entryDate = purchase.transactionDate || (purchase as any).purchaseDate || new Date().toISOString().split('T')[0];

  // 1. Debit Scrap Purchases
  lines.push({
    id: `jl-${purchase.id}-dr-purch`,
    accountCode: '5010',
    accountName: 'Scrap Raw Material Purchases',
    debit: taxable,
    credit: 0,
    lineNarration: `Scrap purchase inward under ${purchase.purchaseNo}`,
  });

  // 2. Debit Input Tax Credits (assumes intra-state default if state code matches)
  if (taxAmount > 0) {
    const isInterState = supplierParty?.stateCode && supplierParty.stateCode !== company.stateCode;
    if (isInterState) {
      lines.push({
        id: `jl-${purchase.id}-dr-igst`,
        accountCode: '1170',
        accountName: 'Input Tax Credit — IGST',
        debit: taxAmount,
        credit: 0,
        lineNarration: `Input IGST on ${purchase.purchaseNo}`,
      });
    } else {
      const halfTax = roundTo2(taxAmount / 2);
      const remainingTax = roundTo2(taxAmount - halfTax);
      lines.push({
        id: `jl-${purchase.id}-dr-cgst`,
        accountCode: '1150',
        accountName: 'Input Tax Credit — CGST',
        debit: halfTax,
        credit: 0,
        lineNarration: `Input CGST on ${purchase.purchaseNo}`,
      });
      lines.push({
        id: `jl-${purchase.id}-dr-sgst`,
        accountCode: '1160',
        accountName: 'Input Tax Credit — SGST',
        debit: remainingTax,
        credit: 0,
        lineNarration: `Input SGST on ${purchase.purchaseNo}`,
      });
    }
  }

  // 3. Credit Sundry Creditors (Supplier A/P)
  lines.push({
    id: `jl-${purchase.id}-cr-ap`,
    accountCode: '2010',
    accountName: 'Sundry Creditors (Suppliers A/P)',
    debit: 0,
    credit: totalAmount,
    partyId: purchase.supplierPartyId,
    partyName,
    lineNarration: `Purchase ${purchase.purchaseNo} from ${partyName}`,
  });

  const entry: JournalEntry = {
    id: `je-pur-${purchase.id}`,
    companyId: company.id,
    entryNo: `JV-PUR-${purchase.purchaseNo.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate,
    sourceType: 'PURCHASE_INVOICE',
    sourceId: purchase.id,
    referenceNo: purchase.purchaseNo,
    narration: `Purchase ${purchase.purchaseNo} from ${partyName} (Total: ₹${totalAmount})`,
    lines,
    totalDebit: totalAmount,
    totalCredit: totalAmount,
    isPosted: true,
    createdBy: purchase.createdBy || 'system',
    createdAt: purchase.createdAt || new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Generates double-entry posting for a Customer Receipt or Supplier Payment:
 * Receipt (Inflow):
 *   Dr. Bank/Cash [Amount]
 *     Cr. Sundry Debtors (Customer) [Amount]
 * Payment (Outflow):
 *   Dr. Sundry Creditors (Supplier) [Amount]
 *     Cr. Bank/Cash [Amount]
 */
export function createPaymentJournal(
  payment: Payment, 
  party: Party | undefined, 
  accountCode: string = '1020',
  company: Company
): JournalEntry {
  const lines: JournalLine[] = [];
  const amount = roundTo2(payment.totalAmount ?? (payment as any).amount ?? 0);
  const partyName = party?.legalName || (payment as any).partyName || 'Party';
  const isReceipt = payment.direction === 'INFLOW_RECEIPT' || (payment as any).paymentType === 'RECEIVED';
  const method = payment.paymentMethod || (payment as any).paymentMode || 'BANK';
  const paymentNo = payment.paymentNo || (payment as any).referenceNumber || `PAY-${payment.id}`;

  if (isReceipt) {
    // Dr. Bank/Cash
    lines.push({
      id: `jl-${payment.id}-dr-cashbank`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: amount,
      credit: 0,
      lineNarration: `Receipt from ${partyName} via ${method}`,
    });
    // Cr. Sundry Debtors
    lines.push({
      id: `jl-${payment.id}-cr-ar`,
      accountCode: '1100',
      accountName: 'Sundry Debtors (Customers A/R)',
      debit: 0,
      credit: amount,
      partyId: payment.partyId,
      partyName,
      lineNarration: `Payment receipt applied to customer account`,
    });
  } else {
    // Dr. Sundry Creditors
    lines.push({
      id: `jl-${payment.id}-dr-ap`,
      accountCode: '2010',
      accountName: 'Sundry Creditors (Suppliers A/P)',
      debit: amount,
      credit: 0,
      partyId: payment.partyId,
      partyName,
      lineNarration: `Disbursement to supplier ${partyName}`,
    });
    // Cr. Bank/Cash
    lines.push({
      id: `jl-${payment.id}-cr-cashbank`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amount,
      lineNarration: `Disbursed to ${partyName} via ${method}`,
    });
  }

  const entry: JournalEntry = {
    id: `je-pay-${payment.id}`,
    companyId: company.id,
    entryNo: `JV-PAY-${paymentNo.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate: payment.paymentDate,
    sourceType: 'PAYMENT',
    sourceId: payment.id,
    referenceNo: paymentNo,
    narration: `${isReceipt ? 'Receipt from' : 'Payment to'} ${partyName} of ₹${amount} (${method})`,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    isPosted: true,
    createdBy: payment.createdBy || 'system',
    createdAt: payment.createdAt || new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Generates double-entry posting for an Operating Expense:
 * Dr. Specific Expense Account (Fuel, Maintenance, Wages, etc.) [Amount]
 *   Cr. Cash or Bank Account [Amount]
 */
export function createExpenseJournal(
  expense: Expense, 
  accountCode: string = '1010',
  company: Company
): JournalEntry {
  const lines: JournalLine[] = [];
  const amount = roundTo2(expense.amount);
  const voucherNo = expense.voucherNo || (expense as any).expenseNo || expense.id;
  const paidTo = expense.paidTo || (expense as any).description || 'Vendor';

  // Map category to COA code
  let expenseAccountCode = '5040'; // Yard Utilities & Maintenance default
  let expenseAccountName = 'Yard Utilities & Maintenance';

  const cat = (expense.category || '').toLowerCase();
  if (cat.includes('fuel') || cat.includes('diesel')) {
    expenseAccountCode = '5060';
    expenseAccountName = 'Vehicle Running & Diesel Cost';
  } else if (cat.includes('wage') || cat.includes('salary') || cat.includes('labor')) {
    expenseAccountCode = '5020';
    expenseAccountName = 'Demolition Direct Labor & Cutting';
  } else if (cat.includes('transport') || cat.includes('freight') || cat.includes('crane') || cat.includes('maintenance')) {
    expenseAccountCode = '5030';
    expenseAccountName = 'Freight, Haulage & Crane Charges';
  }

  lines.push({
    id: `jl-${expense.id}-dr-exp`,
    accountCode: expenseAccountCode,
    accountName: expenseAccountName,
    debit: amount,
    credit: 0,
    lineNarration: `Expense: ${expense.category} - ${paidTo}`,
  });

  lines.push({
    id: `jl-${expense.id}-cr-cb`,
    accountCode,
    accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
    debit: 0,
    credit: amount,
    lineNarration: `Paid to ${paidTo}`,
  });

  const entry: JournalEntry = {
    id: `je-exp-${expense.id}`,
    companyId: company.id,
    entryNo: `JV-EXP-${voucherNo.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate: expense.expenseDate,
    sourceType: 'EXPENSE',
    sourceId: expense.id,
    referenceNo: voucherNo,
    narration: `Expense voucher ${voucherNo} for ${paidTo} (${expense.category})`,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    isPosted: true,
    createdBy: expense.createdBy || 'system',
    createdAt: expense.createdAt || new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Generates double-entry posting for a Contra Inter-Account Transfer:
 * Dr. Destination Cash/Bank Account [Amount]
 *   Cr. Source Cash/Bank Account [Amount]
 */
export function createContraJournal(
  amount: number,
  sourceCode: string,
  destCode: string,
  date: string,
  ref: string,
  company: Company
): JournalEntry {
  const amt = roundTo2(amount);
  const lines: JournalLine[] = [
    {
      id: `jl-contra-dr-${Date.now()}`,
      accountCode: destCode,
      accountName: destCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: amt,
      credit: 0,
      lineNarration: `Contra funds received from ${sourceCode === '1010' ? 'Cash' : 'Bank'}`,
    },
    {
      id: `jl-contra-cr-${Date.now()}`,
      accountCode: sourceCode,
      accountName: sourceCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amt,
      lineNarration: `Contra funds transferred to ${destCode === '1010' ? 'Cash' : 'Bank'}`,
    }
  ];

  const entry: JournalEntry = {
    id: `je-contra-${Date.now().toString(36)}`,
    companyId: company.id,
    entryNo: `JV-CON-${ref.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate: date,
    sourceType: 'CONTRA',
    sourceId: ref,
    referenceNo: ref,
    narration: `Contra transfer of ₹${amt} between internal accounts`,
    lines,
    totalDebit: amt,
    totalCredit: amt,
    isPosted: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

// ---------------------------------------------------------
// OFFICIAL FINANCIAL STATEMENT BUILDERS
// ---------------------------------------------------------

export interface LedgerRow {
  date: string;
  entryNo: string;
  sourceType: string;
  referenceNo?: string;
  narration: string;
  partyName?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface GeneralLedgerReport {
  accountCode: string;
  accountName: string;
  openingBalance: number;
  rows: LedgerRow[];
  closingDebit: number;
  closingCredit: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

/**
 * Builds General Ledger with running balances.
 */
export function generateGeneralLedger(
  entries: JournalEntry[],
  targetAccountCode: string,
  normalBalance: 'DEBIT' | 'CREDIT' = 'DEBIT',
  openingBalance: number = 0
): GeneralLedgerReport {
  const accountInfo = STANDARD_CHART_OF_ACCOUNTS.find((a) => a.code === targetAccountCode);
  const accountName = accountInfo?.name || `Account ${targetAccountCode}`;

  const rows: LedgerRow[] = [];
  let running = openingBalance;
  let totalDr = 0;
  let totalCr = 0;

  // Chronological sort
  const sorted = [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate));

  for (const entry of sorted) {
    for (const line of entry.lines) {
      if (line.accountCode === targetAccountCode) {
        totalDr += line.debit;
        totalCr += line.credit;

        if (normalBalance === 'DEBIT') {
          running += (line.debit - line.credit);
        } else {
          running += (line.credit - line.debit);
        }

        rows.push({
          date: entry.entryDate,
          entryNo: entry.entryNo,
          sourceType: entry.sourceType,
          referenceNo: entry.referenceNo,
          narration: line.lineNarration || entry.narration,
          partyName: line.partyName,
          debit: line.debit,
          credit: line.credit,
          runningBalance: roundTo2(running),
        });
      }
    }
  }

  return {
    accountCode: targetAccountCode,
    accountName,
    openingBalance: roundTo2(openingBalance),
    rows,
    closingDebit: roundTo2(totalDr),
    closingCredit: roundTo2(totalCr),
    closingBalance: roundTo2(running),
    totalDebit: roundTo2(totalDr),
    totalCredit: roundTo2(totalCr),
  };
}

export interface TrialBalanceItem {
  code: string;
  name: string;
  category: AccountCategory;
  debitBalance: number;
  creditBalance: number;
  accountCode?: string;
  accountName?: string;
}

export interface TrialBalanceReport {
  asOfDate: string;
  items: TrialBalanceItem[];
  rows: TrialBalanceItem[];
  totalDebit: number;
  totalCredit: number;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  variance: number;
  difference: number;
}

/**
 * Generates official Trial Balance from double-entry journals.
 */
export function generateTrialBalance(
  entries: JournalEntry[],
  asOfDate: string = new Date().toISOString().split('T')[0]
): TrialBalanceReport {
  const filtered = entries.filter((e) => e.entryDate <= asOfDate);
  const balances: Record<string, { debit: number; credit: number }> = {};

  for (const coa of STANDARD_CHART_OF_ACCOUNTS) {
    balances[coa.code] = { debit: 0, credit: 0 };
  }

  for (const entry of filtered) {
    for (const line of entry.lines) {
      if (!balances[line.accountCode]) {
        balances[line.accountCode] = { debit: 0, credit: 0 };
      }
      balances[line.accountCode].debit += line.debit;
      balances[line.accountCode].credit += line.credit;
    }
  }

  const items: TrialBalanceItem[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const coa of STANDARD_CHART_OF_ACCOUNTS) {
    const bal = balances[coa.code];
    if (!bal || (bal.debit === 0 && bal.credit === 0)) continue;

    let netDebit = 0;
    let netCredit = 0;

    if (coa.normalBalance === 'DEBIT') {
      const net = bal.debit - bal.credit;
      if (net >= 0) netDebit = roundTo2(net);
      else netCredit = roundTo2(Math.abs(net));
    } else {
      const net = bal.credit - bal.debit;
      if (net >= 0) netCredit = roundTo2(net);
      else netDebit = roundTo2(Math.abs(net));
    }

    totalDebit += netDebit;
    totalCredit += netCredit;

    items.push({
      code: coa.code,
      name: coa.name,
      category: coa.category,
      debitBalance: netDebit,
      creditBalance: netCredit,
      accountCode: coa.code,
      accountName: coa.name,
    });
  }

  totalDebit = roundTo2(totalDebit);
  totalCredit = roundTo2(totalCredit);
  const variance = roundTo2(Math.abs(totalDebit - totalCredit));

  return {
    asOfDate,
    items,
    rows: items,
    totalDebit,
    totalCredit,
    totalDebits: totalDebit,
    totalCredits: totalCredit,
    isBalanced: variance <= 0.05,
    variance,
    difference: variance,
  };
}

export interface ProfitAndLossReport {
  fromDate: string;
  toDate: string;
  revenueLines: { code: string; name: string; amount: number }[];
  totalRevenue: number;
  cogsLines: { code: string; name: string; amount: number }[];
  totalCOGS: number;
  totalCogs: number;
  grossProfit: number;
  operatingExpenseLines: { code: string; name: string; amount: number }[];
  totalOperatingExpenses: number;
  netProfit: number;
}

/**
 * Builds official Profit and Loss Statement.
 * Gross Profit = Total Revenue - Cost of Goods Sold.
 * Net Profit = Gross Profit - Operating Expenses.
 */
export function generateProfitAndLoss(
  entries: JournalEntry[],
  fromDate: string,
  toDate: string
): ProfitAndLossReport {
  const filtered = entries.filter((e) => e.entryDate >= fromDate && e.entryDate <= toDate);
  const accountTotals: Record<string, number> = {};

  for (const entry of filtered) {
    for (const line of entry.lines) {
      accountTotals[line.accountCode] = (accountTotals[line.accountCode] || 0) + (line.credit - line.debit);
    }
  }

  // 1. Revenue
  const revenueCodes = ['4010', '4020', '4050'];
  const revenueLines = revenueCodes.map((code) => {
    const coa = STANDARD_CHART_OF_ACCOUNTS.find((a) => a.code === code);
    const amount = roundTo2(accountTotals[code] || 0);
    return { code, name: coa?.name || 'Revenue', amount };
  }).filter((l) => l.amount !== 0);

  const totalRevenue = roundTo2(revenueLines.reduce((s, l) => s + l.amount, 0));

  // 2. Cost of Goods Sold (Direct Costs)
  const cogsCodes = ['5010', '5020', '5030'];
  const cogsLines = cogsCodes.map((code) => {
    const coa = STANDARD_CHART_OF_ACCOUNTS.find((a) => a.code === code);
    // For expenses, net debit = line.debit - line.credit = -accountTotals[code]
    const amount = roundTo2(-(accountTotals[code] || 0));
    return { code, name: coa?.name || 'COGS', amount };
  }).filter((l) => l.amount !== 0);

  const totalCOGS = roundTo2(cogsLines.reduce((s, l) => s + l.amount, 0));
  const grossProfit = roundTo2(totalRevenue - totalCOGS);

  // 3. Operating Expenses
  const opexCodes = ['5040', '5050', '5060', '5090'];
  const operatingExpenseLines = opexCodes.map((code) => {
    const coa = STANDARD_CHART_OF_ACCOUNTS.find((a) => a.code === code);
    const amount = roundTo2(-(accountTotals[code] || 0));
    return { code, name: coa?.name || 'Operating Expense', amount };
  }).filter((l) => l.amount !== 0);

  const totalOperatingExpenses = roundTo2(operatingExpenseLines.reduce((s, l) => s + l.amount, 0));
  const netProfit = roundTo2(grossProfit - totalOperatingExpenses);

  return {
    fromDate,
    toDate,
    revenueLines,
    totalRevenue,
    cogsLines,
    totalCOGS,
    totalCogs: totalCOGS,
    grossProfit,
    operatingExpenseLines,
    totalOperatingExpenses,
    netProfit,
  };
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: { code: string; name: string; amount: number }[];
  totalAssets: number;
  liabilities: { code: string; name: string; amount: number }[];
  totalLiabilities: number;
  equity: { code: string; name: string; amount: number }[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  variance: number;
  difference: number;
}

/**
 * Builds official Balance Sheet:
 * Total Assets === Total Liabilities + Total Equity (including Net P&L).
 */
export function generateBalanceSheet(
  entries: JournalEntry[],
  asOfDate: string,
  currentNetProfit: number
): BalanceSheetReport {
  const filtered = entries.filter((e) => e.entryDate <= asOfDate);
  const accountTotals: Record<string, number> = {};

  for (const entry of filtered) {
    for (const line of entry.lines) {
      accountTotals[line.accountCode] = (accountTotals[line.accountCode] || 0) + (line.debit - line.credit);
    }
  }

  // 1. Assets (Normal Debit: amount = debit - credit)
  const assetCodes = ['1010', '1020', '1050', '1100', '1150', '1160', '1170', '1200'];
  const assets = assetCodes.map((code) => {
    const coa = STANDARD_CHART_OF_ACCOUNTS.find((a) => a.code === code);
    const amount = roundTo2(accountTotals[code] || 0);
    return { code, name: coa?.name || 'Asset', amount };
  }).filter((l) => l.amount !== 0);

  const totalAssets = roundTo2(assets.reduce((s, a) => s + a.amount, 0));

  // 2. Liabilities (Normal Credit: amount = credit - debit = -accountTotals)
  const liabCodes = ['2010', '2050', '2060', '2070', '2100'];
  const liabilities = liabCodes.map((code) => {
    const coa = STANDARD_CHART_OF_ACCOUNTS.find((a) => a.code === code);
    const amount = roundTo2(-(accountTotals[code] || 0));
    return { code, name: coa?.name || 'Liability', amount };
  }).filter((l) => l.amount !== 0);

  const totalLiabilities = roundTo2(liabilities.reduce((s, l) => s + l.amount, 0));

  // 3. Equity
  const equityCodes = ['3010', '3020'];
  const equity = equityCodes.map((code) => {
    const coa = STANDARD_CHART_OF_ACCOUNTS.find((a) => a.code === code);
    const amount = roundTo2(-(accountTotals[code] || 0));
    return { code, name: coa?.name || 'Equity', amount };
  }).filter((l) => l.amount !== 0);

  // Add Net Profit to Equity
  if (currentNetProfit !== 0) {
    equity.push({
      code: '3099',
      name: 'Current Period Net Profit / (Loss)',
      amount: roundTo2(currentNetProfit),
    });
  }

  const totalEquity = roundTo2(equity.reduce((s, e) => s + e.amount, 0));
  const totalLiabilitiesAndEquity = roundTo2(totalLiabilities + totalEquity);
  const variance = roundTo2(Math.abs(totalAssets - totalLiabilitiesAndEquity));

  return {
    asOfDate,
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced: variance <= 0.05,
    variance,
    difference: variance,
  };
}

export interface PartyStatementItem {
  date: string;
  documentRef: string;
  documentType: string;
  narration: string;
  debit: number;   // Invoiced to customer / Payment to supplier
  credit: number;  // Receipt from customer / Bill from supplier
  runningBalance: number;
}

export interface PartyStatementReport {
  partyId: string;
  partyName: string;
  partyType: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  openingBalance: number;
  items: PartyStatementItem[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

/**
 * Builds chronological Customer or Supplier Statement of Account with running balances.
 */
export function generatePartyStatement(
  party: Party,
  entries: JournalEntry[],
  fromDate?: string,
  toDate?: string
): PartyStatementReport {
  const items: PartyStatementItem[] = [];
  let initialOpening = roundTo2(party.openingBalance || 0);
  let totalDebit = 0;
  let totalCredit = 0;

  const sorted = [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate));

  for (const entry of sorted) {
    for (const line of entry.lines) {
      if (line.partyId === party.id) {
        if (entry.sourceType === 'OPENING_BALANCE' || (fromDate && entry.entryDate < fromDate)) {
          if (party.partyType === 'CUSTOMER') {
            initialOpening += (line.debit - line.credit);
          } else {
            initialOpening += (line.credit - line.debit);
          }
          continue;
        }

        if (toDate && entry.entryDate > toDate) continue;

        totalDebit += line.debit;
        totalCredit += line.credit;

        const currentRunning = initialOpening + (party.partyType === 'CUSTOMER' ? (totalDebit - totalCredit) : (totalCredit - totalDebit));

        items.push({
          date: entry.entryDate,
          documentRef: entry.referenceNo || entry.entryNo,
          documentType: entry.sourceType,
          narration: line.lineNarration || entry.narration,
          debit: line.debit,
          credit: line.credit,
          runningBalance: roundTo2(currentRunning),
        });
      }
    }
  }

  const closing = roundTo2(
    initialOpening + (party.partyType === 'CUSTOMER' ? (totalDebit - totalCredit) : (totalCredit - totalDebit))
  );

  return {
    partyId: party.id,
    partyName: party.legalName,
    partyType: party.partyType,
    openingBalance: roundTo2(initialOpening),
    items,
    totalDebit: roundTo2(totalDebit),
    totalCredit: roundTo2(totalCredit),
    closingBalance: closing,
  };
}
