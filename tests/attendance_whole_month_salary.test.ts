import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getCalendarDaysInMonth,
  calculateEmployeeMonthlyAttendancePay,
} from '../backend/business-rules/financeEngine.ts';

describe('Whole-Month Calendar-Day Salary Calculation with Paid Week Off (WO) & Paid Leave (PL)', () => {
  it('computes exact calendar days for 28, 29, 30, and 31-day months', () => {
    expect(getCalendarDaysInMonth('2026-02')).toBe(28);
    expect(getCalendarDaysInMonth('2028-02')).toBe(29);
    expect(getCalendarDaysInMonth('2026-11')).toBe(30);
    expect(getCalendarDaysInMonth('2026-12')).toBe(31);
  });

  it('pays exact 100% monthly salary for salaried staff with Mon-Sat Present + Sunday Week Offs (even in 5-Sunday Nov 2026)', () => {
    const emp = { monthlySalary: 30000, dailyWageRate: 0, currentAdvanceBalance: 0 };
    const entries = [
      ...Array.from({ length: 25 }, () => ({ status: 'PRESENT', overtimeHours: 0 })),
      ...Array.from({ length: 5 }, () => ({ status: 'WEEK_OFF', overtimeHours: 0 })),
    ];

    const res = calculateEmployeeMonthlyAttendancePay(emp, entries, '2026-11');
    expect(res.daysInMonth).toBe(30);
    expect(res.perDayRate).toBe(1000);
    expect(res.presentDays).toBe(25);
    expect(res.weekOffDays).toBe(5);
    expect(res.effectivePaidDays).toBe(30);
    expect(res.basePay).toBe(30000);
    expect(res.netSalaryPayable).toBe(30000);
  });

  it('counts Paid Leave (LEAVE) as a paid day and deducts only Absent (ABSENT) for salaried staff', () => {
    const emp = { monthlySalary: 30000, dailyWageRate: 0, currentAdvanceBalance: 2000 };

    // 23 Present + 1 Paid Leave + 5 Week Off + 1 Absent = 29/30 paid days -> ₹29,000 gross - ₹2,000 advance = ₹27,000 net
    const entries = [
      ...Array.from({ length: 23 }, () => ({ status: 'PRESENT', overtimeHours: 0 })),
      { status: 'LEAVE', overtimeHours: 0 },
      ...Array.from({ length: 5 }, () => ({ status: 'WEEK_OFF', overtimeHours: 0 })),
      { status: 'ABSENT', overtimeHours: 0 },
    ];

    const res = calculateEmployeeMonthlyAttendancePay(emp, entries, '2026-11');
    expect(res.paidLeaveDays).toBe(1);
    expect(res.weekOffDays).toBe(5);
    expect(res.absentDays).toBe(1);
    expect(res.effectivePaidDays).toBe(29);
    expect(res.basePay).toBe(29000);
    expect(res.netSalaryPayable).toBe(27000);
  });

  it('handles 31-day months with Half Day, Double Shift, and Overtime accurately', () => {
    const emp = { monthlySalary: 31000, dailyWageRate: 0, currentAdvanceBalance: 0 };
    // Per day = ₹1,000 (31,000 / 31)
    // 25 Present + 4 Week Off + 1 Paid Leave + 1 Half Day = 30.5 paid days -> ₹30,500 + 8h OT (1000/8 * 1.5 * 8 = ₹1,500) = ₹32,000
    const entries = [
      ...Array.from({ length: 25 }, () => ({ status: 'PRESENT', overtimeHours: 0 })),
      ...Array.from({ length: 4 }, () => ({ status: 'WEEK_OFF', overtimeHours: 0 })),
      { status: 'LEAVE', overtimeHours: 0 },
      { status: 'HALF_DAY', overtimeHours: 8 },
    ];

    const res = calculateEmployeeMonthlyAttendancePay(emp, entries, '2026-12');
    expect(res.daysInMonth).toBe(31);
    expect(res.perDayRate).toBe(1000);
    expect(res.effectivePaidDays).toBe(30.5);
    expect(res.basePay).toBe(30500);
    expect(res.otPay).toBe(1500);
    expect(res.netSalaryPayable).toBe(32000);
  });

  it('calculates daily-wage staff with Paid Leave paid and Week Off tracked as unpaid rest day', () => {
    const emp = { monthlySalary: 0, dailyWageRate: 800, currentAdvanceBalance: 0 };
    const entries = [
      { status: 'PRESENT', overtimeHours: 0 },
      { status: 'LEAVE', overtimeHours: 0 }, // Paid Leave = ₹800
      { status: 'WEEK_OFF', overtimeHours: 0 }, // Rest day = ₹0
      { status: 'DOUBLE_SHIFT', overtimeHours: 0 }, // 2x = ₹1,600
      { status: 'HALF_DAY', overtimeHours: 0 }, // 0.5x = ₹400
    ];

    const res = calculateEmployeeMonthlyAttendancePay(emp, entries, '2026-11');
    expect(res.effectivePaidDays).toBe(4.5);
    expect(res.basePay).toBe(3600);
    expect(res.netSalaryPayable).toBe(3600);
  });

  it('wires Paid Leave (PL), Week Off (WO), and Mark Sundays Week Off controls in EmployeesView', () => {
    const empView = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/employees/EmployeesView.tsx'),
      'utf8'
    );
    expect(empView).toContain('Paid Leave (PL)');
    expect(empView).toContain('Week Off (WO)');
    expect(empView).toContain('Mark Sundays Week Off');
    expect(empView).toContain('calculateEmployeeMonthlyAttendancePay');
  });
});
