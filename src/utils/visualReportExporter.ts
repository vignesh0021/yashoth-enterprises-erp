import type { Expense, Payment } from '../types';
import type { CashBookPeriodSummary } from '../../backend/business-rules/financeEngine.ts';

export type VisualReportPeriod = 'DAY' | 'WEEK' | 'MONTH';

/** Returns YYYY-MM-DD in the device's local timezone (avoids UTC off-by-one). */
export function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns Monday..Sunday date range and list of 7 YYYY-MM-DD strings for the week containing anchorDate. */
export function getLocalWeekRange(anchorDateStr: string): {
  startDate: string;
  endDate: string;
  days: string[];
} {
  const [y, m, d] = anchorDateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const day = dt.getDay(); // 0=Sun..6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(dt);
  mon.setDate(dt.getDate() + diffToMon);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(mon);
    cur.setDate(mon.getDate() + i);
    days.push(getLocalDateStr(cur));
  }
  return {
    startDate: days[0],
    endDate: days[6],
    days,
  };
}

/** Returns first and last YYYY-MM-DD of the month (YYYY-MM). */
export function getLocalMonthRange(monthStr: string): {
  startDate: string;
  endDate: string;
} {
  const [y, m] = monthStr.split('-').map(Number);
  const lastDay = new Date(y, m || 1, 0).getDate();
  return {
    startDate: `${monthStr}-01`,
    endDate: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

function fmtINR(val: number): string {
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${val < 0 ? '-' : ''}Rs.${formatted}`;
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '...').width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + '...';
}

export interface VisualFinanceReportInput {
  companyName: string;
  period: VisualReportPeriod;
  anchorDate: string; // YYYY-MM-DD
  expenses: Expense[];
  payments: Payment[];
  cashBalance: number;
  bankBalance: number;
  cashBookSummary?: CashBookPeriodSummary;
}

export interface GeneratedVisualReport {
  dataUrl: string;
  filename: string;
  summaryText: string;
  startDate: string;
  endDate: string;
  totalExpenses: number;
  totalIncome: number;
  expenseCount: number;
}

export function generateVisualFinanceReport(input: VisualFinanceReportInput): GeneratedVisualReport {
  const { companyName, period, anchorDate, expenses, payments, cashBalance, bankBalance, cashBookSummary } = input;
  const monthStr = anchorDate.substring(0, 7);

  let startDate = anchorDate;
  let endDate = anchorDate;
  let weekDays: string[] = [];

  if (period === 'WEEK') {
    const wk = getLocalWeekRange(anchorDate);
    startDate = wk.startDate;
    endDate = wk.endDate;
    weekDays = wk.days;
  } else if (period === 'MONTH') {
    const mo = getLocalMonthRange(monthStr);
    startDate = mo.startDate;
    endDate = mo.endDate;
  }

  const activeExpenses = expenses.filter(
    (e) => e.status !== 'REVERSED' && e.expenseDate >= startDate && e.expenseDate <= endDate
  );
  const periodIncome = payments
    .filter((p) => p.direction === 'INFLOW_RECEIPT' && p.paymentDate >= startDate && p.paymentDate <= endDate)
    .reduce((s, p) => s + p.totalAmount, 0);
  const totalExpenses = activeExpenses.reduce((s, e) => s + e.amount, 0);

  const paidCash = activeExpenses.filter((e) => e.paymentMode === 'CASH' && e.status !== 'UNPAID').reduce((s, e) => s + e.amount, 0);
  const paidBank = activeExpenses.filter((e) => e.paymentMode === 'BANK' && e.status !== 'UNPAID').reduce((s, e) => s + e.amount, 0);
  const unpaidTotal = activeExpenses.filter((e) => e.status === 'UNPAID' || e.paymentMode === 'UNPAID').reduce((s, e) => s + e.amount, 0);

  // Category aggregation
  const catMap = new Map<string, number>();
  for (const e of activeExpenses) {
    catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount);
  }
  const topCategories = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Trend bars for WEEK (7 days) or MONTH (W1..W5)
  const trendBars: { label: string; value: number }[] = [];
  if (period === 'WEEK') {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    weekDays.forEach((dStr, idx) => {
      const val = activeExpenses.filter((e) => e.expenseDate === dStr).reduce((s, e) => s + e.amount, 0);
      trendBars.push({ label: `${dayLabels[idx]} ${dStr.slice(8)}`, value: val });
    });
  } else if (period === 'MONTH') {
    const weeks = [
      { label: 'W1 (1-7)', min: 1, max: 7 },
      { label: 'W2 (8-14)', min: 8, max: 14 },
      { label: 'W3 (15-21)', min: 15, max: 21 },
      { label: 'W4 (22-28)', min: 22, max: 28 },
      { label: 'W5 (29+)', min: 29, max: 31 },
    ];
    for (const w of weeks) {
      const val = activeExpenses
        .filter((e) => {
          const dayNum = Number(e.expenseDate.slice(8, 10));
          return dayNum >= w.min && dayNum <= w.max;
        })
        .reduce((s, e) => s + e.amount, 0);
      trendBars.push({ label: w.label, value: val });
    }
  }

  const visibleExpenses = [...activeExpenses]
    .sort((a, b) => (b.expenseDate + b.voucherNo).localeCompare(a.expenseDate + a.voucherNo))
    .slice(0, 10);

  // Compute dynamic canvas height
  const width = 1080;
  let height = 390; // Header + 4 KPI cards + split bar
  if (trendBars.length > 0) height += 250;
  if (topCategories.length > 0) height += 80 + topCategories.length * 42;
  if (cashBookSummary) height += 170;
  height += 95 + Math.max(1, visibleExpenses.length) * 44 + 70;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const periodLabel = period === 'DAY' ? 'DAY-WISE' : period === 'WEEK' ? 'WEEK-WISE' : 'MONTH-WISE';
  const filename = `YE_${periodLabel}_Report_${startDate}.png`;
  const summaryText = [
    `${companyName} — ${periodLabel} EXPENSE & FINANCE REPORT`,
    `Period: ${startDate} to ${endDate}`,
    `Total Expenses (${activeExpenses.length}): ${fmtINR(totalExpenses)} (Cash: ${fmtINR(paidCash)}, Bank: ${fmtINR(paidBank)}, Unpaid: ${fmtINR(unpaidTotal)})`,
    `Income Receipts: ${fmtINR(periodIncome)}`,
    `Cash in Hand: ${fmtINR(cashBalance)} | Bank Balance: ${fmtINR(bankBalance)}`,
  ].join('\n');

  if (!ctx) {
    return {
      dataUrl: '',
      filename,
      summaryText,
      startDate,
      endDate,
      totalExpenses,
      totalIncome: periodIncome,
      expenseCount: activeExpenses.length,
    };
  }

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Header Banner
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, width, 10);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`${companyName.toUpperCase()} — ${periodLabel} VISUAL REPORT`, 40, 60);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Period: ${startDate} to ${endDate}   |   Generated: ${new Date().toLocaleString()}`, 40, 94);

  // 4 KPI Cards
  const kpis: { label: string; value: string; color: string; bg: string }[] = [
    { label: 'TOTAL EXPENSES', value: fmtINR(totalExpenses), color: '#fb7185', bg: '#1e293b' },
    { label: 'TOTAL INCOME', value: fmtINR(periodIncome), color: '#34d399', bg: '#1e293b' },
    { label: 'CASH IN HAND', value: fmtINR(cashBalance), color: '#fbbf24', bg: '#1e293b' },
    { label: 'BANK BALANCE', value: fmtINR(bankBalance), color: '#38bdf8', bg: '#1e293b' },
  ];
  const cardW = 235;
  const gap = 20;
  kpis.forEach((k, i) => {
    const x = 40 + i * (cardW + gap);
    const y = 122;
    ctx.fillStyle = k.bg;
    ctx.fillRect(x, y, cardW, 108);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(k.label, x + 16, y + 30);
    ctx.fillStyle = k.color;
    ctx.font = 'bold 26px monospace';
    ctx.fillText(truncateText(ctx, k.value, cardW - 32), x + 16, y + 78);
  });

  // Payment Mode Split Bar
  let y = 256;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, y, 1000, 96);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(
    `EXPENSE PAYMENT SPLIT (${activeExpenses.length} Vouchers) — Cash: ${fmtINR(paidCash)}  |  Bank: ${fmtINR(paidBank)}  |  Unpaid: ${fmtINR(unpaidTotal)}`,
    58,
    y + 34
  );
  const splitDenom = Math.max(1, totalExpenses);
  const cashW = Math.round((paidCash / splitDenom) * 964);
  const bankW = Math.round((paidBank / splitDenom) * 964);
  const unpaidW = Math.max(0, 964 - cashW - bankW);
  ctx.fillStyle = '#334155';
  ctx.fillRect(58, y + 52, 964, 22);
  if (cashW > 0) {
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(58, y + 52, cashW, 22);
  }
  if (bankW > 0) {
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(58 + cashW, y + 52, bankW, 22);
  }
  if (unpaidW > 0 && unpaidTotal > 0) {
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(58 + cashW + bankW, y + 52, unpaidW, 22);
  }
  y += 120;

  // Trend Vertical Bar Chart (Week / Month)
  if (trendBars.length > 0) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, y, 1000, 225);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(period === 'WEEK' ? 'DAILY EXPENSE TREND (MON - SUN)' : 'WEEKLY EXPENSE BREAKDOWN (THIS MONTH)', 58, y + 32);

    const maxBar = Math.max(1, ...trendBars.map((b) => b.value));
    const slotW = Math.floor(940 / trendBars.length);
    const barW = Math.min(72, slotW - 24);
    const baseLineY = y + 178;
    const maxBarH = 110;

    trendBars.forEach((b, idx) => {
      const cx = 68 + idx * slotW + Math.floor((slotW - barW) / 2);
      const barH = b.value > 0 ? Math.max(8, Math.round((b.value / maxBar) * maxBarH)) : 4;
      ctx.fillStyle = b.value > 0 ? '#fb7185' : '#334155';
      ctx.fillRect(cx, baseLineY - barH, barW, barH);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px sans-serif';
      ctx.fillText(b.label, cx - 4, baseLineY + 22);

      if (b.value > 0) {
        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(fmtINR(b.value), cx - 4, baseLineY - barH - 8);
      }
    });
    y += 248;
  }

  // Category Horizontal Bars
  if (topCategories.length > 0) {
    const boxH = 62 + topCategories.length * 42;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, y, 1000, boxH);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('CATEGORY-WISE EXPENSES', 58, y + 32);

    const maxCat = Math.max(1, topCategories[0][1]);
    let cy = y + 66;
    for (const [cat, amt] of topCategories) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '15px sans-serif';
      ctx.fillText(truncateText(ctx, cat, 250), 58, cy);

      const trackX = 320;
      const trackW = 500;
      const fillW = Math.max(8, Math.round((amt / maxCat) * trackW));
      ctx.fillStyle = '#334155';
      ctx.fillRect(trackX, cy - 14, trackW, 18);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(trackX, cy - 14, fillW, 18);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(fmtINR(amt), 840, cy);
      cy += 42;
    }
    y += boxH + 22;
  }

  // Optional Cash Book Summary Strip
  if (cashBookSummary) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, y, 1000, 148);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('CASH BOOK RECONCILIATION', 58, y + 32);
    const cbCols = [
      { label: 'Opening Cash', val: fmtINR(cashBookSummary.openingCash), color: '#e2e8f0' },
      { label: '+ Inflows', val: fmtINR(cashBookSummary.receipts + cashBookSummary.capitalAndOtherInflows + cashBookSummary.refunds), color: '#34d399' },
      { label: '- Outflows', val: fmtINR(cashBookSummary.paidExpenses + cashBookSummary.salaryLabourContractorPayments + cashBookSummary.drawings + cashBookSummary.otherPayments), color: '#fb7185' },
      { label: '= Closing Cash', val: fmtINR(cashBookSummary.expectedClosingCash), color: '#38bdf8' },
    ];
    cbCols.forEach((c, idx) => {
      const cx = 58 + idx * 242;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText(c.label, cx, y + 68);
      ctx.fillStyle = c.color;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(truncateText(ctx, c.val, 225), cx, y + 102);
    });
    y += 170;
  }

  // Expense Details Table
  const tableH = 74 + Math.max(1, visibleExpenses.length) * 44;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, y, 1000, tableH);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`EXPENSE DETAILS (${visibleExpenses.length} of ${activeExpenses.length} shown)`, 58, y + 32);

  let ty = y + 66;
  if (visibleExpenses.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.fillText('No expenses recorded in this period.', 58, ty);
  } else {
    for (const exp of visibleExpenses) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(54, ty - 24, 972, 36);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px monospace';
      ctx.fillText(exp.expenseDate, 64, ty);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(exp.voucherNo, 178, ty);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '15px sans-serif';
      ctx.fillText(truncateText(ctx, exp.category, 190), 310, ty);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(truncateText(ctx, exp.paidTo, 210), 515, ty);
      ctx.fillStyle = exp.paymentMode === 'BANK' ? '#60a5fa' : exp.status === 'UNPAID' ? '#fb7185' : '#fbbf24';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(exp.paymentMode || 'CASH', 740, ty);
      ctx.fillStyle = '#fb7185';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(fmtINR(exp.amount), 840, ty);
      ty += 44;
    }
  }

  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '14px sans-serif';
  ctx.fillText('Yashoth Enterprises ERP • Tap Share to send directly on WhatsApp or save PNG', 40, height - 24);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    filename,
    summaryText,
    startDate,
    endDate,
    totalExpenses,
    totalIncome: periodIncome,
    expenseCount: activeExpenses.length,
  };
}

/** Shares a PNG dataUrl via Web Share API (works on Android WebView / WhatsApp) or falls back to download. */
export async function shareOrDownloadPng(
  dataUrl: string,
  filename: string,
  title: string,
  text: string
): Promise<'SHARED' | 'DOWNLOADED' | 'PREVIEW_ONLY'> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/png' });

    if (typeof navigator !== 'undefined' && navigator.share) {
      const canShareFiles =
        typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : false;
      if (canShareFiles) {
        await navigator.share({ files: [file], title, text });
        return 'SHARED';
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return 'PREVIEW_ONLY';
  }

  // Web browser fallback
  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return 'DOWNLOADED';
  } catch {
    return 'PREVIEW_ONLY';
  }
}
