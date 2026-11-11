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
    | 'OPENING_BALANCE'
    | 'REVERSAL';
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
  { code: '1060', name: 'Employee Advances & Prepayments', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1070', name: 'Contractor & Labour Advances', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1100', name: 'Sundry Debtors (Customers A/R)', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1150', name: 'Input Tax Credit — CGST', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1160', name: 'Input Tax Credit — SGST', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1170', name: 'Input Tax Credit — IGST', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1200', name: 'Fixed Assets (Weighbridges & Trucks)', category: 'ASSET', normalBalance: 'DEBIT', isSystem: true },

  // Liabilities (2000 - 2999)
  { code: '2010', name: 'Sundry Creditors (Suppliers A/P)', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2020', name: 'Unpaid Operational Expenses Payable', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2050', name: 'Output Tax Liability — CGST', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2060', name: 'Output Tax Liability — SGST', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2070', name: 'Output Tax Liability — IGST', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2100', name: 'Employee Wages & Advances Payable', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2110', name: 'Contractor & Labour Payable', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2120', name: 'Payroll Deductions Payable', category: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },

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
  { code: '5025', name: 'Outsourced Contractor Charges', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5030', name: 'Freight, Haulage & Crane Charges', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5040', name: 'Yard Utilities & Maintenance', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5050', name: 'Salaries & Staff Wages', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5060', name: 'Vehicle Running & Diesel Cost', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { code: '5070', name: 'Office, Tea & Food Expenses', category: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
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

  if (Math.abs(sumDebits - sumCredits) > 0.001) {
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

  const preTotalDebit = roundTo2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const preTotalCredit = roundTo2(lines.reduce((s, l) => s + (l.credit || 0), 0));
  const residualDiff = roundTo2(preTotalDebit - preTotalCredit);

  if (Math.abs(residualDiff) > 0.001) {
    if (residualDiff > 0) {
      // Debits exceed credits: credit 5090
      const existingRo = lines.find((l) => l.accountCode === '5090' && l.credit > 0);
      if (existingRo) {
        existingRo.credit = roundTo2(existingRo.credit + residualDiff);
      } else {
        lines.push({
          id: `jl-${invoice.id}-cr-ro-bal`,
          accountCode: '5090',
          accountName: 'Round-Off & Decimal Variance',
          debit: 0,
          credit: residualDiff,
          lineNarration: 'Balancing decimal variance',
        });
      }
    } else {
      // Credits exceed debits: debit 5090
      const absDiff = Math.abs(residualDiff);
      const existingRo = lines.find((l) => l.accountCode === '5090' && l.debit > 0);
      if (existingRo) {
        existingRo.debit = roundTo2(existingRo.debit + absDiff);
      } else {
        lines.push({
          id: `jl-${invoice.id}-dr-ro-bal`,
          accountCode: '5090',
          accountName: 'Round-Off & Decimal Variance',
          debit: absDiff,
          credit: 0,
          lineNarration: 'Balancing decimal variance',
        });
      }
    }
  }

  const finalTotalDebit = roundTo2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const finalTotalCredit = roundTo2(lines.reduce((s, l) => s + (l.credit || 0), 0));

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
    totalDebit: finalTotalDebit,
    totalCredit: finalTotalCredit,
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

  // 3. Other charges (freight, crane, etc.)
  if ((purchase as any).otherCharges && (purchase as any).otherCharges > 0) {
    const oc = roundTo2((purchase as any).otherCharges);
    lines.push({
      id: `jl-${purchase.id}-dr-other`,
      accountCode: '5030',
      accountName: 'Freight, Haulage & Crane Charges',
      debit: oc,
      credit: 0,
      lineNarration: `Other freight & transport charges on ${purchase.purchaseNo}`,
    });
  }

  // 4. Credit Sundry Creditors (Supplier A/P)
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

  const preTotalDebit = roundTo2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const preTotalCredit = roundTo2(lines.reduce((s, l) => s + (l.credit || 0), 0));
  const residualDiff = roundTo2(preTotalDebit - preTotalCredit);

  if (Math.abs(residualDiff) > 0.001) {
    if (residualDiff > 0) {
      lines.push({
        id: `jl-${purchase.id}-cr-ro-bal`,
        accountCode: '5090',
        accountName: 'Round-Off & Decimal Variance',
        debit: 0,
        credit: residualDiff,
        lineNarration: 'Purchase balancing adjustment',
      });
    } else {
      lines.push({
        id: `jl-${purchase.id}-dr-ro-bal`,
        accountCode: '5090',
        accountName: 'Round-Off & Decimal Variance',
        debit: Math.abs(residualDiff),
        credit: 0,
        lineNarration: 'Purchase balancing adjustment',
      });
    }
  }

  const finalTotalDebit = roundTo2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const finalTotalCredit = roundTo2(lines.reduce((s, l) => s + (l.credit || 0), 0));

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
    totalDebit: finalTotalDebit,
    totalCredit: finalTotalCredit,
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
  const paidToText = (expense.paidTo || '').toLowerCase();
  if (cat.includes('fuel') || cat.includes('diesel')) {
    expenseAccountCode = '5060';
    expenseAccountName = 'Vehicle Running & Diesel Cost';
  } else if (cat.includes('daily labour') || cat.includes('wage') || cat.includes('labor') || cat.includes('கூலி')) {
    expenseAccountCode = '5020';
    expenseAccountName = 'Demolition Direct Labor & Cutting';
  } else if (
    cat.includes('loading') ||
    cat.includes('unloading') ||
    cat.includes('transport') ||
    cat.includes('freight') ||
    cat.includes('rent') ||
    cat.includes('crane') ||
    cat === 'yard_maintenance' ||
    paidToText.includes('crane')
  ) {
    expenseAccountCode = '5030';
    expenseAccountName = 'Freight, Haulage & Crane Charges';
  } else if (cat.includes('repair') || cat.includes('maintenance') || cat.includes('electricity')) {
    expenseAccountCode = '5040';
    expenseAccountName = 'Yard Utilities & Maintenance';
  } else if (cat.includes('food') || cat.includes('tea') || cat.includes('water') || cat.includes('office')) {
    expenseAccountCode = '5070';
    expenseAccountName = 'Office, Tea & Food Expenses';
  }

  lines.push({
    id: `jl-${expense.id}-dr-exp`,
    accountCode: expenseAccountCode,
    accountName: expenseAccountName,
    debit: amount,
    credit: 0,
    lineNarration: `Expense: ${expense.category} - ${paidTo}`,
  });

  const isUnpaid = expense.status === 'UNPAID' || expense.paymentMode === 'UNPAID';
  const creditCode = isUnpaid ? '2020' : accountCode;
  const creditName = isUnpaid 
    ? 'Unpaid Operational Expenses Payable' 
    : (creditCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)');

  lines.push({
    id: `jl-${expense.id}-cr-cb`,
    accountCode: creditCode,
    accountName: creditName,
    debit: 0,
    credit: amount,
    lineNarration: isUnpaid ? `Unpaid liability to ${paidTo}` : `Paid to ${paidTo}`,
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
 * Double-entry posting for paying an already accrued unpaid expense:
 * Dr. 2020 Unpaid Operational Expenses Payable
 *   Cr. 1010/1020 Cash or Bank Account
 * Important: Never records expense twice!
 */
export function createPayUnpaidExpenseJournal(
  expense: Expense,
  accountCode: string,
  company: Company,
  actor: string
): JournalEntry {
  const amount = roundTo2(expense.amount);
  const voucherNo = expense.voucherNo || expense.id;
  const lines: JournalLine[] = [
    {
      id: `jl-payexp-dr-${expense.id}`,
      accountCode: '2020',
      accountName: 'Unpaid Operational Expenses Payable',
      debit: amount,
      credit: 0,
      lineNarration: `Clear payable liability for ${expense.voucherNo}`,
    },
    {
      id: `jl-payexp-cr-${expense.id}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amount,
      lineNarration: `Payment for expense voucher ${expense.voucherNo}`,
    }
  ];

  const entry: JournalEntry = {
    id: `je-payexp-${expense.id}`,
    companyId: company.id,
    entryNo: `JV-CLR-${voucherNo.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate: new Date().toISOString().split('T')[0],
    sourceType: 'PAYMENT',
    sourceId: expense.id,
    referenceNo: voucherNo,
    narration: `Pay accrued expense voucher ${voucherNo} (${expense.category})`,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Employee Advance Issue:
 * Dr. 1060 Employee Advances & Prepayments
 *   Cr. 1010/1020 Cash or Bank Account
 */
export function createEmployeeAdvanceJournal(
  advance: {
    id: string;
    employeeName: string;
    advanceDate: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    voucherNo?: string;
  },
  accountCode: string = '1010',
  company: Company,
  actor: string
): JournalEntry {
  const amount = roundTo2(advance.amount);
  const voucherNo = advance.voucherNo || `ADV-${advance.id.slice(-6)}`;
  const lines: JournalLine[] = [
    {
      id: `jl-eadv-dr-${advance.id}`,
      accountCode: '1060',
      accountName: 'Employee Advances & Prepayments',
      debit: amount,
      credit: 0,
      lineNarration: `Advance issued to employee ${advance.employeeName}`,
    },
    {
      id: `jl-eadv-cr-${advance.id}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amount,
      lineNarration: `Advance disbursement via ${accountCode === '1010' ? 'Cash' : 'Bank'}`,
    },
  ];

  const entry: JournalEntry = {
    id: `je-eadv-${advance.id}`,
    companyId: company.id,
    entryNo: `JV-ADV-${advance.id.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
    entryDate: advance.advanceDate,
    sourceType: 'PAYMENT',
    sourceId: advance.id,
    referenceNo: voucherNo,
    narration: `Employee advance payment for ${advance.employeeName}`,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Monthly Staff Salary Accrual (Expense Recognition):
 * Dr. 5050 Salaries & Staff Wages [Gross Salary + Approved Allowances]
 *   Cr. 1060 Employee Advances & Prepayments [Advance Recovery] (if any)
 *   Cr. 2120 Payroll Deductions Payable [Statutory Deductions] (if any)
 *   Cr. 2100 Employee Wages & Advances Payable [Net Salary Payable]
 */
export function createSalaryAccrualJournal(
  record: {
    id: string;
    employeeName: string;
    salaryMonth: string;
    grossSalary: number;
    allowances?: number;
    deductions?: number;
    advanceRecovery?: number;
    netSalaryPayable: number;
  },
  company: Company,
  actor: string
): JournalEntry {
  const totalExpense = roundTo2((record.grossSalary || 0) + (record.allowances || 0));
  const advanceRecovery = roundTo2(record.advanceRecovery || 0);
  const deductions = roundTo2(record.deductions || 0);
  const netPayable = roundTo2(record.netSalaryPayable);
  const lines: JournalLine[] = [];

  // Dr. Salary expense
  lines.push({
    id: `jl-salacc-dr-${record.id}`,
    accountCode: '5050',
    accountName: 'Salaries & Staff Wages',
    debit: totalExpense,
    credit: 0,
    lineNarration: `Monthly Salary & Allowances: ${record.employeeName} (${record.salaryMonth})`,
  });

  // Cr. Advance recovery
  if (advanceRecovery > 0) {
    lines.push({
      id: `jl-salacc-cr-adv-${record.id}`,
      accountCode: '1060',
      accountName: 'Employee Advances & Prepayments',
      debit: 0,
      credit: advanceRecovery,
      lineNarration: `Advance recovery from ${record.employeeName} (${record.salaryMonth})`,
    });
  }

  // Cr. Deductions
  if (deductions > 0) {
    lines.push({
      id: `jl-salacc-cr-ded-${record.id}`,
      accountCode: '2120',
      accountName: 'Payroll Deductions Payable',
      debit: 0,
      credit: deductions,
      lineNarration: `Salary deductions for ${record.employeeName} (${record.salaryMonth})`,
    });
  }

  // Cr. Net salary payable
  if (netPayable > 0) {
    lines.push({
      id: `jl-salacc-cr-pay-${record.id}`,
      accountCode: '2100',
      accountName: 'Employee Wages & Advances Payable',
      debit: 0,
      credit: netPayable,
      lineNarration: `Net salary payable to ${record.employeeName} (${record.salaryMonth})`,
    });
  }

  const entry: JournalEntry = {
    id: `je-salacc-${record.id}`,
    companyId: company.id,
    entryNo: `JV-SALACC-${record.id.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
    entryDate: new Date().toISOString().split('T')[0],
    sourceType: 'MANUAL_JOURNAL',
    sourceId: record.id,
    referenceNo: `SAL-${record.salaryMonth}`,
    narration: `Salary accrual for ${record.employeeName} (${record.salaryMonth})`,
    lines,
    totalDebit: totalExpense,
    totalCredit: roundTo2(advanceRecovery + deductions + netPayable),
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Salary Disbursement (Full or Partial Payment):
 * Dr. 2100 Employee Wages & Advances Payable [Amount Paid]
 *   Cr. 1010/1020 Cash or Bank Account [Amount Paid]
 * Important: NEVER debits 5050 again!
 */
export function createSalaryDisbursementJournal(
  payment: {
    salaryRecordId: string;
    employeeName: string;
    salaryMonth: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    paymentId?: string;
    voucherNo?: string;
    paymentDate?: string;
  },
  accountCode: string = '1010',
  company: Company,
  actor: string
): JournalEntry {
  const amount = roundTo2(payment.amount);
  const voucherNo = payment.voucherNo || `SALPAY-${payment.salaryRecordId.slice(-6)}`;
  const payId = payment.paymentId || `${voucherNo.replace(/[^A-Za-z0-9]/g, '')}-${Math.random().toString(36).substring(2, 7)}`;
  const lines: JournalLine[] = [
    {
      id: `jl-saldisb-dr-${payId}`,
      accountCode: '2100',
      accountName: 'Employee Wages & Advances Payable',
      debit: amount,
      credit: 0,
      lineNarration: `Salary disbursement to ${payment.employeeName} (${payment.salaryMonth})`,
    },
    {
      id: `jl-saldisb-cr-${payId}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amount,
      lineNarration: `Paid via ${accountCode === '1010' ? 'Cash' : 'Bank'}`,
    },
  ];

  const entry: JournalEntry = {
    id: `je-saldisb-${payId}`,
    companyId: company.id,
    entryNo: `JV-SALDISB-${voucherNo.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate: payment.paymentDate || new Date().toISOString().split('T')[0],
    sourceType: 'PAYMENT',
    sourceId: payment.salaryRecordId,
    referenceNo: voucherNo,
    narration: `Salary payment to ${payment.employeeName} (${payment.salaryMonth})`,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Monthly Staff Salary (Combined Accrual + Immediate Payment):
 * Dr. 5050 Salaries & Staff Wages [Gross + Allowances]
 *   Cr. 1060 Employee Advances [Advance Recovery] (if any)
 *   Cr. 2120 Payroll Deductions Payable [Deductions] (if any)
 *   Cr. 1010/1020 Cash or Bank Account [Net Amount Paid] (if any)
 *   Cr. 2100 Employee Wages Payable [Remaining Balance Unpaid] (if any)
 */
export function createSalaryPaymentJournal(
  record: {
    id: string;
    employeeName: string;
    salaryMonth: string;
    grossSalary: number;
    allowances?: number;
    deductions?: number;
    advanceRecovery?: number;
    amountPaid: number;
    paymentMode?: 'CASH' | 'BANK';
    notes?: string;
  },
  accountCode: string = '1010',
  company: Company,
  actor: string
): JournalEntry {
  const amountPaid = roundTo2(record.amountPaid);
  const totalExpense = roundTo2((record.grossSalary || 0) + (record.allowances || 0));
  const advanceRecovery = roundTo2(record.advanceRecovery || 0);
  const deductions = roundTo2(record.deductions || 0);
  const netPayable = roundTo2(Math.max(0, totalExpense - advanceRecovery - deductions));
  const remainingPayable = roundTo2(Math.max(0, netPayable - amountPaid));
  const lines: JournalLine[] = [];

  // Dr. Salary expense
  lines.push({
    id: `jl-sal-dr-${record.id}`,
    accountCode: '5050',
    accountName: 'Salaries & Staff Wages',
    debit: totalExpense,
    credit: 0,
    lineNarration: `Monthly Salary: ${record.employeeName} (${record.salaryMonth})`,
  });

  // Cr. Cash / Bank paid
  if (amountPaid > 0) {
    lines.push({
      id: `jl-sal-cr-cb-${record.id}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amountPaid,
      lineNarration: `Salary paid to ${record.employeeName}`,
    });
  }

  // Cr. Advance recovery
  if (advanceRecovery > 0) {
    lines.push({
      id: `jl-sal-cr-adv-${record.id}`,
      accountCode: '1060',
      accountName: 'Employee Advances & Prepayments',
      debit: 0,
      credit: advanceRecovery,
      lineNarration: `Advance recovery for ${record.employeeName} (${record.salaryMonth})`,
    });
  }

  // Cr. Deductions
  if (deductions > 0) {
    lines.push({
      id: `jl-sal-cr-ded-${record.id}`,
      accountCode: '2120',
      accountName: 'Payroll Deductions Payable',
      debit: 0,
      credit: deductions,
      lineNarration: `Deductions recovery for ${record.employeeName} (${record.salaryMonth})`,
    });
  }

  // Cr. Remaining unpaid salary balance or default payable
  const creditedSoFar = roundTo2(amountPaid + advanceRecovery + deductions);
  const remainingCredit = roundTo2(Math.max(0, totalExpense - creditedSoFar));
  if (remainingCredit > 0.001) {
    lines.push({
      id: `jl-sal-cr-rec-${record.id}`,
      accountCode: '2100',
      accountName: 'Employee Wages & Advances Payable',
      debit: 0,
      credit: remainingCredit,
      lineNarration: `Unpaid salary payable for ${record.employeeName} (${record.salaryMonth})`,
    });
  }

  const entry: JournalEntry = {
    id: `je-sal-${record.id}`,
    companyId: company.id,
    entryNo: `JV-SAL-${record.id.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
    entryDate: new Date().toISOString().split('T')[0],
    sourceType: 'PAYMENT',
    sourceId: record.id,
    referenceNo: `SAL-${record.salaryMonth}`,
    narration: `Salary payment for ${record.employeeName} (${record.salaryMonth})`,
    lines,
    totalDebit: totalExpense,
    totalCredit: roundTo2(creditedSoFar + (remainingCredit > 0.001 ? remainingCredit : 0)),
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Daily Labour Advance:
 * Dr. 1070 Contractor & Labour Advances
 *   Cr. 1010/1020 Cash or Bank Account
 */
export function createLabourAdvanceJournal(
  advance: {
    id: string;
    workerNameOrGroup: string;
    advanceDate: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    voucherNo?: string;
  },
  accountCode: string = '1010',
  company: Company,
  actor: string
): JournalEntry {
  const amount = roundTo2(advance.amount);
  const voucherNo = advance.voucherNo || `LADV-${advance.id.slice(-6)}`;
  const lines: JournalLine[] = [
    {
      id: `jl-ladv-dr-${advance.id}`,
      accountCode: '1070',
      accountName: 'Contractor & Labour Advances',
      debit: amount,
      credit: 0,
      lineNarration: `Advance issued to labour ${advance.workerNameOrGroup}`,
    },
    {
      id: `jl-ladv-cr-${advance.id}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amount,
      lineNarration: `Labour advance disbursement via ${accountCode === '1010' ? 'Cash' : 'Bank'}`,
    },
  ];

  const entry: JournalEntry = {
    id: `je-ladv-${advance.id}`,
    companyId: company.id,
    entryNo: `JV-LADV-${advance.id.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
    entryDate: advance.advanceDate,
    sourceType: 'PAYMENT',
    sourceId: advance.id,
    referenceNo: voucherNo,
    narration: `Labour advance for ${advance.workerNameOrGroup}`,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for subsequent Labour Payment against approved labour payable:
 * Dr. 2100 Employee Wages & Advances Payable [Amount Paid]
 *   Cr. 1010/1020 Cash or Bank Account [Amount Paid]
 * Important: NEVER debits 5020 again!
 */
export function createLabourPaymentJournal(
  payment: {
    dailyLabourId: string;
    workerNameOrGroup: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    paymentId?: string;
    voucherNo?: string;
    paymentDate?: string;
  },
  accountCode: string = '1010',
  company: Company,
  actor: string
): JournalEntry {
  const amount = roundTo2(payment.amount);
  const voucherNo = payment.voucherNo || `LPAY-${payment.dailyLabourId.slice(-6)}`;
  const payId = payment.paymentId || `${voucherNo.replace(/[^A-Za-z0-9]/g, '')}-${Math.random().toString(36).substring(2, 7)}`;
  const lines: JournalLine[] = [
    {
      id: `jl-lpay-dr-${payId}`,
      accountCode: '2100',
      accountName: 'Employee Wages & Advances Payable',
      debit: amount,
      credit: 0,
      lineNarration: `Payment for approved daily labour: ${payment.workerNameOrGroup}`,
    },
    {
      id: `jl-lpay-cr-${payId}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amount,
      lineNarration: `Labour payment via ${accountCode === '1010' ? 'Cash' : 'Bank'}`,
    },
  ];

  const entry: JournalEntry = {
    id: `je-lpay-${payId}`,
    companyId: company.id,
    entryNo: `JV-LPAY-${voucherNo.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate: payment.paymentDate || new Date().toISOString().split('T')[0],
    sourceType: 'PAYMENT',
    sourceId: payment.dailyLabourId,
    referenceNo: voucherNo,
    narration: `Daily labour payment for ${payment.workerNameOrGroup}`,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Daily Wage Labour (Combined Accrual & Immediate Payment):
 * Dr. 5020 Demolition Direct Labor & Cutting [Total Labour Cost]
 *   Cr. 1070 Contractor & Labour Advances [Advance Adjusted] (if any)
 *   Cr. 1010/1020 Cash or Bank [Amount Paid] (if any)
 *   Cr. 2100 Employee Wages Payable [Remaining Balance] (if any)
 */
export function createDailyLabourJournal(
  labour: {
    id: string;
    workerNameOrGroup: string;
    workDate: string;
    totalLabourCost: number;
    advanceAmount?: number;
    amountPaid: number;
    remainingBalance: number;
    paymentMode: 'CASH' | 'BANK' | 'UNPAID';
  },
  accountCode: string = '1010',
  company: Company,
  actor: string
): JournalEntry {
  const totalCost = roundTo2(labour.totalLabourCost);
  const advance = roundTo2(labour.advanceAmount || 0);
  const paid = roundTo2(labour.amountPaid);
  const unpaid = roundTo2(Math.max(0, totalCost - advance - paid));
  const lines: JournalLine[] = [];

  lines.push({
    id: `jl-lab-dr-${labour.id}`,
    accountCode: '5020',
    accountName: 'Demolition Direct Labor & Cutting',
    debit: totalCost,
    credit: 0,
    lineNarration: `Daily Labour: ${labour.workerNameOrGroup} on ${labour.workDate}`,
  });

  if (advance > 0) {
    lines.push({
      id: `jl-lab-cr-adv-${labour.id}`,
      accountCode: '1070',
      accountName: 'Contractor & Labour Advances',
      debit: 0,
      credit: advance,
      lineNarration: `Advance adjustment for ${labour.workerNameOrGroup}`,
    });
  }

  if (paid > 0) {
    lines.push({
      id: `jl-lab-cr-cb-${labour.id}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: paid,
      lineNarration: `Paid to ${labour.workerNameOrGroup}`,
    });
  }

  if (unpaid > 0.001) {
    lines.push({
      id: `jl-lab-cr-unp-${labour.id}`,
      accountCode: '2100',
      accountName: 'Employee Wages & Advances Payable',
      debit: 0,
      credit: unpaid,
      lineNarration: `Pending daily wage balance for ${labour.workerNameOrGroup}`,
    });
  }

  const entry: JournalEntry = {
    id: `je-lab-${labour.id}`,
    companyId: company.id,
    entryNo: `JV-LAB-${labour.id.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
    entryDate: labour.workDate,
    sourceType: 'EXPENSE',
    sourceId: labour.id,
    referenceNo: `LAB-${labour.workDate}`,
    narration: `Daily labour entry for ${labour.workerNameOrGroup} (${labour.workDate})`,
    lines,
    totalDebit: totalCost,
    totalCredit: roundTo2(advance + paid + (unpaid > 0.001 ? unpaid : 0)),
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Contractor Advance Issue:
 * Dr. 1070 Contractor & Labour Advances [Amount]
 *   Cr. 1010/1020 Cash or Bank Account [Amount]
 */
export function createContractorAdvanceJournal(
  advance: {
    id: string;
    contractorName: string;
    advanceDate: string;
    amount: number;
    paymentMode: 'CASH' | 'BANK';
    voucherNo?: string;
  },
  accountCode: string = '1010',
  company: Company,
  actor: string
): JournalEntry {
  const amount = roundTo2(advance.amount);
  const voucherNo = advance.voucherNo || `CADV-${advance.id.slice(-6)}`;
  const lines: JournalLine[] = [
    {
      id: `jl-cadv-dr-${advance.id}`,
      accountCode: '1070',
      accountName: 'Contractor & Labour Advances',
      debit: amount,
      credit: 0,
      lineNarration: `Advance issued to contractor ${advance.contractorName}`,
    },
    {
      id: `jl-cadv-cr-${advance.id}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amount,
      lineNarration: `Contractor advance disbursement via ${accountCode === '1010' ? 'Cash' : 'Bank'}`,
    },
  ];

  const entry: JournalEntry = {
    id: `je-cadv-${advance.id}`,
    companyId: company.id,
    entryNo: `JV-CADV-${advance.id.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
    entryDate: advance.advanceDate,
    sourceType: 'PAYMENT',
    sourceId: advance.id,
    referenceNo: voucherNo,
    narration: `Contractor advance for ${advance.contractorName}`,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Contractor Progress Payment (1st, 2nd, final):
 * Dr. 2110 Contractor & Labour Payable [Payment Amount]
 *   Cr. 1010/1020 Cash or Bank Account [Payment Amount]
 * Important: NEVER debits 5025 again! Recognizes expense strictly once at work approval.
 */
export function createContractorProgressPaymentJournal(
  payment: {
    contractorWorkId: string;
    contractorName: string;
    amount: number;
    paymentDate: string;
    paymentMode: 'CASH' | 'BANK';
    voucherNo: string;
    paymentId?: string;
  },
  accountCode: string = '1010',
  company: Company,
  actor: string
): JournalEntry {
  const amount = roundTo2(payment.amount);
  const payId = payment.paymentId || `${payment.voucherNo.replace(/[^A-Za-z0-9]/g, '')}-${Math.random().toString(36).substring(2, 7)}`;
  const lines: JournalLine[] = [
    {
      id: `jl-cpay-dr-${payId}`,
      accountCode: '2110',
      accountName: 'Contractor & Labour Payable',
      debit: amount,
      credit: 0,
      lineNarration: `Progress payment for contractor work: ${payment.contractorName} (${payment.voucherNo})`,
    },
    {
      id: `jl-cpay-cr-${payId}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: amount,
      lineNarration: `Progress payment via ${accountCode === '1010' ? 'Cash' : 'Bank'}`,
    },
  ];

  const entry: JournalEntry = {
    id: `je-cpay-${payId}`,
    companyId: company.id,
    entryNo: `JV-CPAY-${payment.voucherNo.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate: payment.paymentDate,
    sourceType: 'PAYMENT',
    sourceId: payment.contractorWorkId,
    referenceNo: payment.voucherNo,
    narration: `Contractor progress payment to ${payment.contractorName}`,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Outsourced Contractor Work (Combined Accrual & Immediate Payment):
 * Dr. 5025 Outsourced Contractor Charges [Total Contract Amount]
 *   Cr. 1070 Contractor & Labour Advances [Advance Adjusted] (if any)
 *   Cr. 1010/1020 Cash or Bank [Current Payment] (if any)
 *   Cr. 2110 Contractor & Labour Payable [Remaining Balance] (if any)
 */
export function createContractorWorkJournal(
  work: {
    id: string;
    contractorName: string;
    workDate: string;
    totalContractAmount: number;
    advancePaid?: number;
    currentPayment: number;
    remainingBalance: number;
  },
  accountCode: string = '1010',
  company: Company,
  actor: string
): JournalEntry {
  const totalAmount = roundTo2(work.totalContractAmount);
  const advance = roundTo2(work.advancePaid || 0);
  const paid = roundTo2(work.currentPayment);
  const unpaid = roundTo2(Math.max(0, totalAmount - advance - paid));
  const lines: JournalLine[] = [];

  lines.push({
    id: `jl-cont-dr-${work.id}`,
    accountCode: '5025',
    accountName: 'Outsourced Contractor Charges',
    debit: totalAmount,
    credit: 0,
    lineNarration: `Contractor: ${work.contractorName} on ${work.workDate}`,
  });

  if (advance > 0) {
    lines.push({
      id: `jl-cont-cr-adv-${work.id}`,
      accountCode: '1070',
      accountName: 'Contractor & Labour Advances',
      debit: 0,
      credit: advance,
      lineNarration: `Advance adjustment for contractor ${work.contractorName}`,
    });
  }

  if (paid > 0) {
    lines.push({
      id: `jl-cont-cr-cb-${work.id}`,
      accountCode,
      accountName: accountCode === '1010' ? 'Cash on Hand' : 'Bank Accounts (Current/OD)',
      debit: 0,
      credit: paid,
      lineNarration: `Paid to contractor ${work.contractorName}`,
    });
  }

  if (unpaid > 0.001) {
    lines.push({
      id: `jl-cont-cr-unp-${work.id}`,
      accountCode: '2110',
      accountName: 'Contractor & Labour Payable',
      debit: 0,
      credit: unpaid,
      lineNarration: `Pending contractor balance for ${work.contractorName}`,
    });
  }

  const entry: JournalEntry = {
    id: `je-cont-${work.id}`,
    companyId: company.id,
    entryNo: `JV-CONTR-${work.id.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
    entryDate: work.workDate,
    sourceType: 'EXPENSE',
    sourceId: work.id,
    referenceNo: `CONTR-${work.workDate}`,
    narration: `Contractor work for ${work.contractorName} (${work.workDate})`,
    lines,
    totalDebit: totalAmount,
    totalCredit: roundTo2(advance + paid + (unpaid > 0.001 ? unpaid : 0)),
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(entry);
  return entry;
}

/**
 * Double-entry posting for Cash Closing Discrepancy Adjustment:
 */
export function createCashClosingJournal(
  difference: number,
  date: string,
  reason: string,
  company: Company,
  actor: string
): JournalEntry | null {
  const diff = roundTo2(difference);
  if (Math.abs(diff) < 0.01) return null;

  const lines: JournalLine[] = [];
  const absDiff = Math.abs(diff);

  if (diff < 0) {
    // Shortage
    lines.push({
      id: `jl-cls-dr-${Date.now()}`,
      accountCode: '5090',
      accountName: 'Round-Off & Decimal Variance',
      debit: absDiff,
      credit: 0,
      lineNarration: `Daily Cash Shortage: ${reason || 'Physical cash audit adjustment'}`,
    });
    lines.push({
      id: `jl-cls-cr-${Date.now()}`,
      accountCode: '1010',
      accountName: 'Cash on Hand',
      debit: 0,
      credit: absDiff,
      lineNarration: `Cash drawer shortage written off`,
    });
  } else {
    // Excess
    lines.push({
      id: `jl-cls-dr-${Date.now()}`,
      accountCode: '1010',
      accountName: 'Cash on Hand',
      debit: absDiff,
      credit: 0,
      lineNarration: `Cash drawer excess added`,
    });
    lines.push({
      id: `jl-cls-cr-${Date.now()}`,
      accountCode: '4050',
      accountName: 'Other Direct Income',
      debit: 0,
      credit: absDiff,
      lineNarration: `Daily Cash Excess: ${reason || 'Physical cash audit surplus'}`,
    });
  }

  const entry: JournalEntry = {
    id: `je-cls-${Date.now().toString(36)}`,
    companyId: company.id,
    entryNo: `JV-CLS-${date.replace(/[^A-Za-z0-9]/g, '')}`,
    entryDate: date,
    sourceType: 'MANUAL_JOURNAL',
    sourceId: `closing-${date}`,
    referenceNo: `CLS-${date}`,
    narration: `Daily Cash Closing discrepancy adjustment (${diff > 0 ? 'Excess' : 'Shortage'} ₹${absDiff})`,
    lines,
    totalDebit: absDiff,
    totalCredit: absDiff,
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
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

/**
 * Creates an exact reversing double-entry journal entry where all debits become credits
 * and all credits become debits, ensuring the general ledger is balanced and auditable.
 */
export function createReversingJournal(
  original: JournalEntry,
  reason: string,
  actor: string
): JournalEntry {
  const reversedLines: JournalLine[] = original.lines.map((line, idx) => ({
    id: `jl-rev-${idx}-${line.id.replace(/^jl-/, '')}`,
    accountCode: line.accountCode,
    accountName: line.accountName,
    debit: line.credit, // Invert
    credit: line.debit, // Invert
    lineNarration: `Reversal of [${line.lineNarration || line.accountName}]: ${reason}`,
  }));

  const reversalEntry: JournalEntry = {
    id: `je-rev-${original.id.replace(/^je-/, '')}`,
    companyId: original.companyId,
    entryNo: `REV-${original.entryNo}`,
    entryDate: new Date().toISOString().split('T')[0],
    sourceType: 'REVERSAL',
    sourceId: original.sourceId || original.id,
    referenceNo: `REV-${original.referenceNo || original.entryNo}`,
    narration: `Reversal of ${original.entryNo}: ${reason}`,
    lines: reversedLines,
    totalDebit: original.totalCredit,
    totalCredit: original.totalDebit,
    isPosted: true,
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };

  validateJournalEntry(reversalEntry);
  return reversalEntry;
}
