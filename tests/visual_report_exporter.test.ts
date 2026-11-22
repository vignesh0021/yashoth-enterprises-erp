import { describe, it, expect } from 'vitest';
import {
  getLocalDateStr,
  getLocalWeekRange,
  getLocalMonthRange,
  generateVisualFinanceReport,
} from '../src/utils/visualReportExporter';
import type { Expense, Payment } from '../src/types';

describe('visualReportExporter', () => {
  it('computes local date, Mon-Sun week range, and month range accurately', () => {
    expect(getLocalDateStr(new Date(2026, 10, 22, 0, 15, 0))).toBe('2026-11-22');
    const wk = getLocalWeekRange('2026-11-22'); // Sunday -> Mon Nov 16..Sun Nov 22
    expect(wk.startDate).toBe('2026-11-16');
    expect(wk.endDate).toBe('2026-11-22');
    expect(wk.days).toHaveLength(7);

    const mo = getLocalMonthRange('2026-11');
    expect(mo.startDate).toBe('2026-11-01');
    expect(mo.endDate).toBe('2026-11-30');
  });

  it('aggregates day-wise, week-wise, and month-wise expenses excluding REVERSED', () => {
    const expenses: Expense[] = [
      {
        id: 'e1',
        companyId: 'c1',
        voucherNo: 'EXP-26-0001',
        expenseDate: '2026-11-21',
        category: 'Diesel / Petrol',
        description: '',
        amount: 500,
        accountId: 'acc-cash',
        paymentMode: 'CASH',
        status: 'PAID',
        paidTo: 'Senga hotel Kiren',
        createdBy: 'Admin',
        createdAt: '2026-11-21T10:00:00Z',
      },
      {
        id: 'e2',
        companyId: 'c1',
        voucherNo: 'EXP-26-0002',
        expenseDate: '2026-11-22',
        category: 'Other Expenses',
        description: '',
        amount: 1000,
        accountId: 'acc-cash',
        paymentMode: 'CASH',
        status: 'PAID',
        paidTo: 'Thiyagu',
        createdBy: 'Admin',
        createdAt: '2026-11-22T09:00:00Z',
      },
      {
        id: 'e3',
        companyId: 'c1',
        voucherNo: 'EXP-26-0003',
        expenseDate: '2026-11-22',
        category: 'Other Expenses',
        description: '',
        amount: 9999,
        accountId: 'acc-cash',
        paymentMode: 'CASH',
        status: 'REVERSED',
        paidTo: 'Wrong Entry',
        createdBy: 'Admin',
        createdAt: '2026-11-22T09:05:00Z',
      },
      {
        id: 'e4',
        companyId: 'c1',
        voucherNo: 'EXP-26-0004',
        expenseDate: '2026-11-05',
        category: 'Office / Utility',
        description: '',
        amount: 300,
        accountId: 'acc-bank',
        paymentMode: 'BANK',
        status: 'PAID',
        paidTo: 'EB',
        createdBy: 'Admin',
        createdAt: '2026-11-05T10:00:00Z',
      },
    ];
    const payments: Payment[] = [];

    const dayRep = generateVisualFinanceReport({
      companyName: 'Yashoth Enterprises',
      period: 'DAY',
      anchorDate: '2026-11-22',
      expenses,
      payments,
      cashBalance: 22690,
      bankBalance: 0,
    });
    expect(dayRep.totalExpenses).toBe(1000);
    expect(dayRep.expenseCount).toBe(1);

    const weekRep = generateVisualFinanceReport({
      companyName: 'Yashoth Enterprises',
      period: 'WEEK',
      anchorDate: '2026-11-22',
      expenses,
      payments,
      cashBalance: 22690,
      bankBalance: 0,
    });
    expect(weekRep.totalExpenses).toBe(1500);
    expect(weekRep.expenseCount).toBe(2);

    const monthRep = generateVisualFinanceReport({
      companyName: 'Yashoth Enterprises',
      period: 'MONTH',
      anchorDate: '2026-11-22',
      expenses,
      payments,
      cashBalance: 22690,
      bankBalance: 0,
    });
    expect(monthRep.totalExpenses).toBe(1800);
    expect(monthRep.expenseCount).toBe(3);
  });
});
