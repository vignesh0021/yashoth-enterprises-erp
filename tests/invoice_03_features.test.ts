// Tests for INVOICE_03 exact reproduction, Ton/KG conversions, multi-material lines, and employee salary engine
import { describe, it, expect } from 'vitest';
import { 
  calcGstBreakdown, 
  numberToIndianWords, 
  kgToTon, 
  tonToKg, 
  convertWeight, 
  convertRate, 
  roundTo2 
} from '../src/utils/calculations.ts';
import { INITIAL_INVOICES, INITIAL_ATTENDANCE, INITIAL_EMPLOYEES } from '../src/services/mockData.ts';

describe('INVOICE_03 Exact Match & Formulas', () => {
  it('should match the exact values, GST breakdown, and rounding from INVOICE_03.pdf', () => {
    const qty = 4430; // 4,430 KG MS Scrap
    const rate = 28.00; // ₹28.00 per KG
    const taxableAmount = qty * rate; // ₹1,24,040.00

    expect(taxableAmount).toBe(124040.00);

    const breakdown = calcGstBreakdown(taxableAmount, 18, false); // Intra-state 9% CGST + 9% SGST
    expect(breakdown.cgstRate).toBe(9);
    expect(breakdown.cgstAmount).toBe(11163.60);
    expect(breakdown.sgstRate).toBe(9);
    expect(breakdown.sgstAmount).toBe(11163.60);
    expect(breakdown.roundOff).toBe(-0.20);
    expect(breakdown.grandTotal).toBe(146367.00);

    // Number to words verification
    expect(numberToIndianWords(breakdown.grandTotal)).toBe(
      'INR One Lakh Forty Six Thousand Three Hundred Sixty Seven Only'
    );

    // Tax amount in words with paise
    const totalTax = breakdown.cgstAmount + breakdown.sgstAmount;
    expect(totalTax).toBe(22327.20);
    expect(numberToIndianWords(totalTax)).toBe(
      'INR Twenty Two Thousand Three Hundred Twenty Seven and Twenty Paise Only'
    );
  });

  it('should verify the seeded INITIAL_INVOICES contains INVOICE_03 with e-Way Bill details', () => {
    const inv03 = INITIAL_INVOICES.find((i) => i.invoiceNo === '03');
    expect(inv03).toBeDefined();
    expect(inv03?.customerName).toBe('TEJAS STEEL');
    expect(inv03?.grandTotal).toBe(146367.00);
    expect(inv03?.subtotalTaxable).toBe(124040.00);
    expect(inv03?.ewayBillNo).toBe('5417 9765 5717');
    expect(inv03?.vehicleRegistration).toBe('TN 05 Y 1936');
    expect(inv03?.lines[0].descriptionOfGoods).toBe('MS SCRAP');
    expect(inv03?.lines[0].quantity).toBe(4430.00);
    expect(inv03?.lines[0].rate).toBe(28.00);
  });
});

describe('Metric Ton (MT) Calculations and Inbuild Unit Conversion', () => {
  it('should convert weight between KG and TON correctly', () => {
    expect(kgToTon(4430)).toBe(4.43);
    expect(tonToKg(4.43)).toBe(4430);
    expect(convertWeight(5000, 'KG', 'TON')).toBe(5);
    expect(convertWeight(5, 'TON', 'KG')).toBe(5000);
  });

  it('should convert rate between KG and TON and yield equivalent taxable totals', () => {
    const ratePerKg = 28.00;
    const ratePerTon = convertRate(ratePerKg, 'KG', 'TON'); // ₹28,000 / Ton
    expect(ratePerTon).toBe(28000.00);

    const qtyKg = 4430;
    const qtyTon = kgToTon(qtyKg); // 4.43 Ton

    const totalFromKg = roundTo2(qtyKg * ratePerKg);
    const totalFromTon = roundTo2(qtyTon * ratePerTon);

    expect(totalFromKg).toBe(124040.00);
    expect(totalFromTon).toBe(124040.00);
    expect(totalFromKg).toBe(totalFromTon);
  });

  it('should calculate multi-line items with mixed units accurately', () => {
    const lines = [
      { name: 'MS SCRAP', qty: 4430, rate: 28.00, unit: 'KG' },
      { name: 'ALUMINIUM SCRAP', qty: 1.5, rate: 135000, unit: 'TON' }, // 1.5 Ton @ 1,35,000/Ton = 2,02,500
    ];

    const taxable1 = lines[0].qty * lines[0].rate; // 1,24,040
    const taxable2 = lines[1].qty * lines[1].rate; // 2,02,500
    const totalTaxable = taxable1 + taxable2; // 3,26,540

    expect(totalTaxable).toBe(326540.00);

    const gst = calcGstBreakdown(totalTaxable, 18, false);
    expect(gst.cgstAmount).toBe(29388.60);
    expect(gst.sgstAmount).toBe(29388.60);
    expect(gst.grandTotal).toBe(385317.00);
    expect(gst.roundOff).toBe(-0.20);
  });
});

describe('Individual Employee Performance & Salary Engine', () => {
  it('should track employee attendance history and compute net payable salary correctly', () => {
    const empMurugan = INITIAL_EMPLOYEES.find((e) => e.employeeCode === 'EMP-004');
    expect(empMurugan).toBeDefined();

    const muruganAttendance = INITIAL_ATTENDANCE.filter((a) => a.employeeId === empMurugan?.id);
    expect(muruganAttendance.length).toBeGreaterThanOrEqual(16);

    const presentCount = muruganAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'OVERTIME').length;
    const halfDayCount = muruganAttendance.filter((a) => a.status === 'HALF_DAY').length;
    const absentCount = muruganAttendance.filter((a) => a.status === 'ABSENT').length;
    const totalOtHours = muruganAttendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

    expect(presentCount).toBe(15);
    expect(halfDayCount).toBe(1);
    expect(absentCount).toBe(1);
    expect(totalOtHours).toBe(12);

    // Murugan's Daily Wage is ₹650 / day
    const dailyWage = empMurugan!.dailyWageRate; // 650
    const baseWages = presentCount * dailyWage + halfDayCount * (dailyWage / 2);
    // Overtime: 12 hours at 1.5x normal hourly rate (650 / 8 * 1.5 = 121.875/hr)
    const otPay = Math.round(totalOtHours * (dailyWage / 8) * 1.5);
    const grossEarnings = baseWages + otPay;
    const advance = empMurugan!.currentAdvanceBalance; // 500
    const netSalary = grossEarnings - advance;

    expect(baseWages).toBe(10075);
    expect(otPay).toBe(1463);
    expect(grossEarnings).toBe(11538);
    expect(netSalary).toBe(11038);
  });
});
