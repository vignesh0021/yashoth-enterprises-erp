// Yasoth Enterprises — Production Scrap ERP
// Multi-Company Domain Engine & Tenant Isolation Rules
// Enforces company boundaries across GST, banking, documents, inventory and financial ledgers.

import type { Company, Party, InventoryLot, Invoice, PurchaseHeader, SalesHeader, CashBankAccount, Expense } from '../../src/types/index.ts';

export interface CompanyRegistrationInput {
  code: string;
  name: string;
  legalName?: string;
  tradeName?: string;
  gstin: string;
  pan?: string;
  cin?: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateName?: string;
  stateCode?: string;
  pincode: string;
  bankName: string;
  bankAccountNo: string;
  bankBranch: string;
  bankBranchIfsc?: string;
  invoicePrefix?: string;
  purchasePrefix?: string;
  quotationPrefix?: string;
  defaultBaseUnit?: string;
  currency?: string;
}

export class CompanyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyValidationError';
  }
}

export class CompanyIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyIsolationError';
  }
}

/**
 * Validates Indian GSTIN format (15 characters: 2 state code + 10 PAN + 1 entity number + 'Z' + 1 checksum).
 */
export function validateGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  const cleaned = gstin.trim().toUpperCase();
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(cleaned);
}

/**
 * Validates Indian PAN format (10 characters: 5 letters + 4 digits + 1 letter).
 */
export function validatePAN(pan: string): boolean {
  if (!pan) return false;
  const cleaned = pan.trim().toUpperCase();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(cleaned);
}

/**
 * Validates and sanitizes company registration input.
 */
export function validateCompanyRegistration(
  input: CompanyRegistrationInput,
  existingCompanies: Company[]
): Company {
  if (!input.code || !input.code.trim()) {
    throw new CompanyValidationError('Company code is mandatory (e.g. YE-MAIN, YE-LOGISTICS).');
  }

  const normalizedCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (normalizedCode.length < 2) {
    throw new CompanyValidationError('Company code must be at least 2 characters long.');
  }

  const duplicateCode = existingCompanies.some((c) => c.code.toUpperCase() === normalizedCode);
  if (duplicateCode) {
    throw new CompanyValidationError(`Company code "${normalizedCode}" is already in use.`);
  }

  if (!input.name || !input.name.trim()) {
    throw new CompanyValidationError('Company commercial name is required.');
  }

  if (!input.gstin || !input.gstin.trim()) {
    throw new CompanyValidationError('Company GSTIN is required for scrap tax compliance.');
  }

  const normalizedGSTIN = input.gstin.trim().toUpperCase();
  if (!validateGSTIN(normalizedGSTIN)) {
    throw new CompanyValidationError(`Invalid GSTIN format: "${normalizedGSTIN}". Must be 15 alphanumeric characters.`);
  }

  // Derive PAN from GSTIN (characters 3 to 12)
  const derivedPAN = input.pan ? input.pan.trim().toUpperCase() : normalizedGSTIN.substring(2, 12);
  if (!validatePAN(derivedPAN)) {
    throw new CompanyValidationError(`Invalid PAN: "${derivedPAN}". Must be 10 characters (5 letters, 4 digits, 1 letter).`);
  }

  // State code is characters 1-2 of GSTIN
  const stateCode = input.stateCode || normalizedGSTIN.substring(0, 2);

  if (!input.phone || !input.phone.trim()) {
    throw new CompanyValidationError('Company phone number is required.');
  }

  if (!input.email || !input.email.trim() || !input.email.includes('@')) {
    throw new CompanyValidationError('Valid company email address is required.');
  }

  if (!input.addressLine1 || !input.addressLine1.trim() || !input.city || !input.city.trim() || !input.pincode) {
    throw new CompanyValidationError('Complete registered address (Line 1, City, Pincode) is mandatory.');
  }

  if (!input.bankName || !input.bankAccountNo || !input.bankBranch) {
    throw new CompanyValidationError('Bank details (Bank Name, Account Number, Branch) are mandatory.');
  }

  const id = `comp-${normalizedCode.toLowerCase()}-${Date.now().toString(36)}`;
  const legalName = (input.legalName || input.name).trim().toUpperCase();
  const invoicePrefix = input.invoicePrefix?.trim().toUpperCase() || `${normalizedCode}/`;
  const purchasePrefix = input.purchasePrefix?.trim().toUpperCase() || `PO-${normalizedCode}/`;

  return {
    id,
    code: normalizedCode,
    name: input.name.trim(),
    companyName: legalName,
    legalName,
    tradeName: input.tradeName?.trim() || input.name.trim(),
    gstin: normalizedGSTIN,
    pan: derivedPAN,
    cin: input.cin?.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() || '',
    city: input.city.trim(),
    stateName: input.stateName?.trim() || (stateCode === '33' ? 'Tamil Nadu' : 'State ' + stateCode),
    stateCode,
    pincode: input.pincode.trim(),
    bankName: input.bankName.trim().toUpperCase(),
    bankAccountNo: input.bankAccountNo.trim(),
    bankBranch: input.bankBranch.trim().toUpperCase(),
    bankBranchIfsc: input.bankBranchIfsc?.trim().toUpperCase() || input.bankBranch.trim().toUpperCase(),
    invoicePrefix,
    purchasePrefix,
    quotationPrefix: input.quotationPrefix?.trim().toUpperCase() || `QT-${normalizedCode}/`,
    defaultBaseUnit: input.defaultBaseUnit || 'KG',
    currency: input.currency || 'INR',
    isActive: true,
    isDefault: existingCompanies.length === 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Filter operational records strictly scoped to a target company.
 * Automatically resolves records where companyId matches, or handles legacy records for the primary company.
 */
export function filterByCompany<T extends { companyId?: string }>(
  records: T[],
  activeCompanyId: string,
  primaryCompanyId: string = 'comp-yasoth-01'
): T[] {
  if (!activeCompanyId) return [];
  return records.filter((r) => {
    // Exact match
    if (r.companyId === activeCompanyId) return true;
    // Legacy data created before multi-company was introduced belongs to the primary company
    if (!r.companyId && activeCompanyId === primaryCompanyId) return true;
    return false;
  });
}

/**
 * Asserts that a target record belongs to the active operating company.
 * Throws CompanyIsolationError if cross-tenant leakage is detected.
 */
export function assertCompanyOwnership<T extends { companyId?: string }>(
  record: T,
  activeCompanyId: string,
  entityName: string = 'Record',
  primaryCompanyId: string = 'comp-yasoth-01'
): void {
  const effectiveId = record.companyId || primaryCompanyId;
  if (effectiveId !== activeCompanyId) {
    throw new CompanyIsolationError(
      `Cross-company isolation violation: ${entityName} belongs to company "${effectiveId}", but active session is "${activeCompanyId}". Access denied.`
    );
  }
}

/**
 * Generates company-specific sequential document numbers (e.g. YE/26-27/0001 vs YL/26-27/0001).
 */
export function generateCompanyDocumentNumber(
  company: Company,
  type: 'INVOICE' | 'PURCHASE' | 'QUOTATION',
  sequenceNumber: number,
  financialYear: string = '26-27'
): string {
  const prefix = type === 'INVOICE' 
    ? company.invoicePrefix 
    : type === 'PURCHASE' 
      ? company.purchasePrefix 
      : (company.quotationPrefix || 'QT/');
  const paddedSeq = String(sequenceNumber).padStart(4, '0');
  // Ensure trailing slash on prefix
  const cleanPrefix = prefix.endsWith('/') || prefix.endsWith('-') ? prefix : `${prefix}/`;
  return `${cleanPrefix}${financialYear}/${paddedSeq}`;
}

/**
 * Reconciles financial ledgers for a specific company, ensuring no sister company numbers pollute the totals.
 */
export function calculateCompanyFinancialTotals(
  companyId: string,
  invoices: Invoice[],
  purchases: PurchaseHeader[],
  expenses: Expense[],
  primaryCompanyId: string = 'comp-yasoth-01'
): {
  totalSalesTaxable: number;
  totalGstCollected: number;
  totalInvoiceAmount: number;
  totalPurchasesAmount: number;
  totalExpensesAmount: number;
  netGrossProfit: number;
} {
  const companyInvoices = filterByCompany(invoices, companyId, primaryCompanyId).filter((i) => !i.isCancelled);
  const companyPurchases = filterByCompany(purchases, companyId, primaryCompanyId).filter((p) => p.status === 'POSTED');
  const companyExpenses = filterByCompany(expenses, companyId, primaryCompanyId);

  const totalSalesTaxable = companyInvoices.reduce((sum, inv) => sum + (inv.subtotalTaxable || 0), 0);
  const totalGstCollected = companyInvoices.reduce((sum, inv) => sum + ((inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0)), 0);
  const totalInvoiceAmount = companyInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

  const totalPurchasesAmount = companyPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalExpensesAmount = companyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const netGrossProfit = totalSalesTaxable - totalPurchasesAmount - totalExpensesAmount;

  return {
    totalSalesTaxable: Math.round(totalSalesTaxable * 100) / 100,
    totalGstCollected: Math.round(totalGstCollected * 100) / 100,
    totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
    totalPurchasesAmount: Math.round(totalPurchasesAmount * 100) / 100,
    totalExpensesAmount: Math.round(totalExpensesAmount * 100) / 100,
    netGrossProfit: Math.round(netGrossProfit * 100) / 100
  };
}
