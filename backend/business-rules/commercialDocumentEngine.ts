// Yasoth Enterprises — Production Scrap ERP
// Commercial Documents Engine
// Handles Quotations, Proforma Invoices, Credit Notes, Debit Notes, Payment Receipts & GST Validation

import { roundTo2 } from '../../src/utils/calculations.ts';
import type { Company, Party } from '../../src/types/index.ts';

export type CommercialDocType = 
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'QUOTATION'
  | 'PROFORMA_INVOICE'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'PAYMENT_RECEIPT';

export interface CommercialDocLine {
  id: string;
  serialNo: number;
  materialId?: string;
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  rate: number;
  taxableValue: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export interface CommercialDocument {
  id: string;
  companyId: string;
  documentType: CommercialDocType;
  documentNo: string;
  documentDate: string;
  dueDate?: string;
  referenceNo?: string;
  originalDocumentId?: string;
  partyId: string;
  partyName: string;
  partyGstin?: string;
  partyAddress: string;
  placeOfSupply: string;
  stateCode: string;
  lines: CommercialDocLine[];
  subtotalTaxable: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  outstandingBalance: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  notes?: string;
  termsAndConditions?: string;
  createdBy: string;
  createdAt: string;
}

export class CommercialDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommercialDocumentError';
  }
}

export interface CommercialDocInputLine {
  description: string;
  quantity: number;
  unit?: string;
  rate: number;
  gstRate: number;
  materialId?: string;
  hsnSac?: string;
  serialNo?: number;
}

/**
 * Calculates document totals and GST breakdown with intra/inter-state split.
 */
export function calculateDocumentTotals(
  lines: CommercialDocInputLine[],
  isInterState: boolean,
  discountAmount: number = 0
): {
  processedLines: CommercialDocLine[];
  subtotalTaxable: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  roundOff: number;
  grandTotal: number;
} {
  if (lines.length === 0) {
    throw new CommercialDocumentError('Document must contain at least one line item.');
  }

  let subtotal = 0;
  let totalGst = 0;
  let maxGstRate = 0;

  const processedLines: CommercialDocLine[] = lines.map((line, idx) => {
    const qty = Number(line.quantity) || 0;
    const rate = Number(line.rate) || 0;
    const gstRate = Number(line.gstRate) || 18.0;

    if (qty <= 0) throw new CommercialDocumentError(`Line ${idx + 1}: Quantity must be greater than zero.`);
    if (rate <= 0) throw new CommercialDocumentError(`Line ${idx + 1}: Rate must be greater than zero.`);

    const taxable = roundTo2(qty * rate);
    const lineGst = roundTo2((taxable * gstRate) / 100);
    const total = roundTo2(taxable + lineGst);

    subtotal += taxable;
    totalGst += lineGst;
    if (gstRate > maxGstRate) maxGstRate = gstRate;

    return {
      id: `cdl-${Date.now().toString(36)}-${idx}`,
      serialNo: idx + 1,
      materialId: line.materialId,
      description: line.description.trim(),
      hsnSac: line.hsnSac || '7204',
      quantity: qty,
      unit: line.unit || 'KG',
      rate,
      taxableValue: taxable,
      gstRate,
      gstAmount: lineGst,
      totalAmount: total,
    };
  });

  subtotal = roundTo2(Math.max(0, subtotal - discountAmount));
  totalGst = roundTo2(totalGst);

  let cgstRate = 0, cgstAmount = 0;
  let sgstRate = 0, sgstAmount = 0;
  let igstRate = 0, igstAmount = 0;

  if (isInterState) {
    igstRate = maxGstRate;
    igstAmount = totalGst;
  } else {
    cgstRate = roundTo2(maxGstRate / 2);
    sgstRate = roundTo2(maxGstRate / 2);
    cgstAmount = roundTo2(totalGst / 2);
    sgstAmount = roundTo2(totalGst - cgstAmount);
  }

  const rawGrandTotal = subtotal + totalGst;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = roundTo2(roundedGrandTotal - rawGrandTotal);

  return {
    processedLines,
    subtotalTaxable: subtotal,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    roundOff,
    grandTotal: roundedGrandTotal,
  };
}

/**
 * Creates a commercial document (Quotation, Proforma, Credit Note, Debit Note, Receipt)
 */
export function createCommercialDocument(
  params: {
    company: Company;
    party: Party;
    documentType: CommercialDocType;
    documentNo?: string;
    documentDate: string;
    dueDate?: string;
    referenceNo?: string;
    originalDocumentId?: string;
    lines: CommercialDocInputLine[];
    discountAmount?: number;
    notes?: string;
    termsAndConditions?: string;
    sequenceIndex: number;
    financialYear?: string;
    createdBy: string;
  }
): CommercialDocument {
  const { company, party, documentType, documentDate, sequenceIndex, financialYear = '26-27' } = params;

  if (!party) throw new CommercialDocumentError('Party / Customer / Supplier details are required.');
  if (!documentDate) throw new CommercialDocumentError('Document date is mandatory.');

  const isInterState = party.stateCode !== company.stateCode;
  const totals = calculateDocumentTotals(params.lines, isInterState, params.discountAmount || 0);

  // Derive prefix based on document type
  let prefix = company.invoicePrefix || 'YE/';
  if (documentType === 'QUOTATION') prefix = company.quotationPrefix || 'QT/';
  else if (documentType === 'PROFORMA_INVOICE') prefix = 'PI/';
  else if (documentType === 'CREDIT_NOTE') prefix = 'CN/';
  else if (documentType === 'DEBIT_NOTE') prefix = 'DN/';
  else if (documentType === 'PAYMENT_RECEIPT') prefix = 'REC/';
  else if (documentType === 'PURCHASE_INVOICE') prefix = company.purchasePrefix || 'PO/';

  const cleanPrefix = prefix.endsWith('/') || prefix.endsWith('-') ? prefix : `${prefix}/`;
  const generatedNo = params.documentNo || `${cleanPrefix}${financialYear}/${String(sequenceIndex).padStart(4, '0')}`;

  return {
    id: `cd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
    companyId: company.id,
    documentType,
    documentNo: generatedNo,
    documentDate,
    dueDate: params.dueDate,
    referenceNo: params.referenceNo,
    originalDocumentId: params.originalDocumentId,
    partyId: party.id,
    partyName: party.legalName,
    partyGstin: party.gstin,
    partyAddress: `${party.addressLine1}, ${party.city}, ${party.stateName} - ${party.stateCode}`,
    placeOfSupply: `${party.stateName} (${party.stateCode})`,
    stateCode: party.stateCode,
    lines: totals.processedLines,
    subtotalTaxable: totals.subtotalTaxable,
    cgstRate: totals.cgstRate,
    cgstAmount: totals.cgstAmount,
    sgstRate: totals.sgstRate,
    sgstAmount: totals.sgstAmount,
    igstRate: totals.igstRate,
    igstAmount: totals.igstAmount,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    amountPaid: 0,
    outstandingBalance: totals.grandTotal,
    status: 'ISSUED',
    notes: params.notes,
    termsAndConditions: params.termsAndConditions || 'Payment due within agreed terms. Goods once sold will not be taken back without prior inspection.',
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Converts a Quotation into a Proforma Invoice or Sales Tax Invoice.
 */
export function convertDocument(
  sourceDoc: CommercialDocument,
  targetType: 'PROFORMA_INVOICE' | 'SALES_INVOICE',
  company: Company,
  sequenceIndex: number,
  financialYear: string = '26-27',
  actor: string
): CommercialDocument {
  if (sourceDoc.status === 'CANCELLED') {
    throw new CommercialDocumentError('Cannot convert a cancelled document.');
  }

  let prefix = targetType === 'PROFORMA_INVOICE' ? 'PI/' : (company.invoicePrefix || 'YE/');
  const cleanPrefix = prefix.endsWith('/') || prefix.endsWith('-') ? prefix : `${prefix}/`;
  const newDocNo = `${cleanPrefix}${financialYear}/${String(sequenceIndex).padStart(4, '0')}`;

  return {
    ...sourceDoc,
    id: `cd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
    documentType: targetType,
    documentNo: newDocNo,
    documentDate: new Date().toISOString().split('T')[0],
    referenceNo: `Converted from ${sourceDoc.documentType} ${sourceDoc.documentNo}`,
    originalDocumentId: sourceDoc.id,
    status: 'ISSUED',
    createdBy: actor,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates a Credit Note against an original invoice (e.g. scrap weight shortfall or agreed rate reduction).
 */
export function createCreditNote(
  originalInvoice: { id: string; invoiceNo: string; customerPartyId: string; customerName: string; lines: any[] },
  party: Party,
  company: Company,
  reversalReason: string,
  returnedLines: CommercialDocInputLine[],
  sequenceIndex: number,
  actor: string
): CommercialDocument {
  return createCommercialDocument({
    company,
    party,
    documentType: 'CREDIT_NOTE',
    documentDate: new Date().toISOString().split('T')[0],
    referenceNo: originalInvoice.invoiceNo,
    originalDocumentId: originalInvoice.id,
    lines: returnedLines,
    notes: `Credit Note issued for: ${reversalReason}. Against original invoice ${originalInvoice.invoiceNo}`,
    sequenceIndex,
    createdBy: actor,
  });
}

/**
 * Creates a Debit Note against an original purchase (e.g. rejection or supplier overcharge).
 */
export function createDebitNote(
  originalPurchase: { id: string; purchaseNo: string; supplierPartyId: string; lines: any[] },
  party: Party,
  company: Company,
  debitReason: string,
  debitedLines: CommercialDocInputLine[],
  sequenceIndex: number,
  actor: string
): CommercialDocument {
  return createCommercialDocument({
    company,
    party,
    documentType: 'DEBIT_NOTE',
    documentDate: new Date().toISOString().split('T')[0],
    referenceNo: originalPurchase.purchaseNo,
    originalDocumentId: originalPurchase.id,
    lines: debitedLines,
    notes: `Debit Note issued for: ${debitReason}. Against purchase ${originalPurchase.purchaseNo}`,
    sequenceIndex,
    createdBy: actor,
  });
}
