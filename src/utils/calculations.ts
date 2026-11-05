// Yasoth Enterprises Scrap ERP — Arithmetic & Number-to-Words Utility
// Implements Indian numbering system, precision rounding, and GST calculations

export function roundTo2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function roundTo3(num: number): number {
  return Math.round((num + Number.EPSILON) * 1000) / 1000;
}

export function calcNetWeight(gross: number, tare: number): number {
  if (gross < 0 || tare < 0) {
    throw new Error('Gross and tare weights must be non-negative');
  }
  if (tare > gross) {
    throw new Error('Tare weight cannot exceed gross weight');
  }
  return roundTo3(gross - tare);
}

export function calcPayableWeight(gross: number, tare: number, deductions: number = 0): number {
  const net = calcNetWeight(gross, tare);
  if (deductions < 0) {
    throw new Error('Deductions cannot be negative');
  }
  if (deductions > net) {
    throw new Error('Deductions cannot exceed net weight');
  }
  return roundTo3(net - deductions);
}

export function calcMaterialAmount(payableWeight: number, ratePerUnit: number): number {
  if (payableWeight < 0 || ratePerUnit < 0) {
    throw new Error('Weight and rate must be non-negative');
  }
  return roundTo2(payableWeight * ratePerUnit);
}

export interface GstCalculationResult {
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
}

export function calcGstBreakdown(
  taxableAmount: number,
  gstRate: number = 18,
  isInterState: boolean = false
): GstCalculationResult {
  const taxable = roundTo2(taxableAmount);
  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstRate = gstRate;
    igstAmount = roundTo2((taxable * igstRate) / 100);
  } else {
    cgstRate = gstRate / 2;
    sgstRate = gstRate / 2;
    cgstAmount = roundTo2((taxable * cgstRate) / 100);
    sgstAmount = roundTo2((taxable * sgstRate) / 100);
  }

  const totalTax = roundTo2(cgstAmount + sgstAmount + igstAmount);
  const rawTotal = taxable + totalTax;
  const grandTotal = Math.round(rawTotal);
  const roundOff = roundTo2(grandTotal - rawTotal);

  return {
    taxableAmount: taxable,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalTax,
    roundOff,
    grandTotal,
  };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertTwoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const units = n % 10;
  return TENS[tens] + (units > 0 ? ' ' + ONES[units] : '');
}

function convertThreeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  let res = '';
  if (hundreds > 0) {
    res += ONES[hundreds] + ' Hundred';
    if (remainder > 0) res += ' ';
  }
  if (remainder > 0) {
    res += convertTwoDigits(remainder);
  }
  return res;
}

/**
 * Converts numbers to Indian numbering format words (Lakhs, Crores) with Paise support.
 * Example: 273288 -> "INR Two Lakh Seventy Three Thousand Two Hundred Eighty Eight Only"
 * Example: 22327.20 -> "INR Twenty Two Thousand Three Hundred Twenty Seven and Twenty Paise Only"
 */
export function numberToIndianWords(amount: number): string {
  if (amount === 0) return 'INR Zero Only';
  if (amount < 0) return 'Minus ' + numberToIndianWords(Math.abs(amount));

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  const crore = Math.floor(rupees / 10000000);
  let rem = rupees % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(convertThreeDigits(crore) + ' Crore');
  }
  if (lakh > 0) {
    parts.push(convertTwoDigits(lakh) + ' Lakh');
  }
  if (thousand > 0) {
    parts.push(convertTwoDigits(thousand) + ' Thousand');
  }
  if (rem > 0) {
    parts.push(convertThreeDigits(rem));
  }

  const rupeeStr = parts.length > 0 ? parts.join(' ') : 'Zero';

  if (paise > 0) {
    return `INR ${rupeeStr} and ${convertTwoDigits(paise)} Paise Only`.replace(/\s+/g, ' ');
  }

  return `INR ${rupeeStr} Only`.replace(/\s+/g, ' ');
}

export function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(val);
}

export function formatWeight(kg: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(kg) + ' KG';
}

export function formatTon(ton: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(ton) + ' MT';
}

export function kgToTon(kg: number): number {
  return roundTo3(kg / 1000);
}

export function tonToKg(ton: number): number {
  return roundTo3(ton * 1000);
}

export function convertWeight(qty: number, from: 'KG' | 'TON', to: 'KG' | 'TON'): number {
  if (from === to) return qty;
  if (from === 'KG' && to === 'TON') return kgToTon(qty);
  return tonToKg(qty);
}

export function convertRate(rate: number, from: 'KG' | 'TON', to: 'KG' | 'TON'): number {
  if (from === to) return rate;
  if (from === 'KG' && to === 'TON') return roundTo2(rate * 1000);
  return roundTo2(rate / 1000);
}
