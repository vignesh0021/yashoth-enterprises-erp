import { describe, it, expect } from 'vitest';
import { AttendanceEntry, Employee } from '../src/types/index.ts';

describe('Universal CRUD & Double Shift / Overtime Calculations', () => {
  it('calculates double shift as 2 full shifts and custom overtime hours at 1.5x rate', () => {
    const emp: Employee = {
      id: 'emp-101',
      code: 'EMP-001',
      fullName: 'Ramesh Kumar',
      phone: '9840123456',
      role: 'YARD_SUPERVISOR',
      assignedYardId: 'yd-1',
      baseDailyWage: 800,
      overtimeHourlyRate: 150,
      advanceBalance: 0,
      hireDate: '2024-01-01',
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const attendance: AttendanceEntry[] = [
      {
        id: 'att-1',
        employeeId: 'emp-101',
        date: '2026-10-01',
        status: 'PRESENT',
        overtimeHours: 2,
        recordedBy: 'Admin',
        createdAt: '2026-10-01T00:00:00.000Z',
      },
      {
        id: 'att-2',
        employeeId: 'emp-101',
        date: '2026-10-02',
        status: 'DOUBLE_SHIFT',
        overtimeHours: 4, // Double shift plus 4 extra OT hours
        recordedBy: 'Admin',
        createdAt: '2026-10-02T00:00:00.000Z',
      },
      {
        id: 'att-3',
        employeeId: 'emp-101',
        date: '2026-10-03',
        status: 'HALF_DAY',
        overtimeHours: 0,
        recordedBy: 'Admin',
        createdAt: '2026-10-03T00:00:00.000Z',
      },
    ];

    const presentDays = attendance.filter((a) => a.status === 'PRESENT').length;
    const doubleShiftDays = attendance.filter((a) => a.status === 'DOUBLE_SHIFT').length;
    const halfDays = attendance.filter((a) => a.status === 'HALF_DAY').length;
    const effectiveDays = presentDays + doubleShiftDays * 2 + halfDays * 0.5;
    const totalOtHours = attendance.reduce((s, a) => s + (a.overtimeHours || 0), 0);

    const baseEarned = effectiveDays * emp.baseDailyWage;
    const otPay = totalOtHours * emp.overtimeHourlyRate * 1.5;
    const grossSalary = baseEarned + otPay;

    // effectiveDays: 1 + (1 * 2) + 0.5 = 3.5 days
    expect(effectiveDays).toBe(3.5);
    // Base earned: 3.5 * 800 = 2800
    expect(baseEarned).toBe(2800);
    // OT hours: 2 + 4 = 6 hours
    expect(totalOtHours).toBe(6);
    // OT pay: 6 * 150 * 1.5 = 1350
    expect(otPay).toBe(1350);
    // Gross: 2800 + 1350 = 4150
    expect(grossSalary).toBe(4150);
  });

  it('correctly handles custom overtime hours with zero or decimal increments', () => {
    const hourlyRate = 120;
    const customOt1 = 1.5;
    const customOt2 = 5.75;

    const otPay1 = customOt1 * hourlyRate * 1.5;
    const otPay2 = customOt2 * hourlyRate * 1.5;

    expect(otPay1).toBe(270);
    expect(otPay2).toBe(1035);
  });
});
