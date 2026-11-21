import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Share2,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Building2,
  Users,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import { useERP } from '../../context/ERPContext.tsx';
import { formatINR } from '../../utils/calculations.ts';
import {
  computeOwnerBusinessOverview,
  computeOwnerPeriodSummary,
  generateOwnerReportCsv,
} from '../../../backend/business-rules/ownerReportsEngine.ts';

type PeriodFilter = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'CUSTOM';
type ReportSection = 'OVERVIEW' | 'FINANCE' | 'OPERATIONS' | 'DRILLDOWN';

export const OwnerSummaryReportsView: React.FC = () => {
  const {
    activeCompany,
    yards,
    accounts,
    accountTransactions,
    expenses,
    invoices,
    purchases,
    sales,
    payments,
    parties,
    employees,
    attendance,
    salaryRecords,
    dailyLabourEntries,
    labourPayments,
    contractors,
    contractorWorkEntries,
    contractorPayments,
    journalEntries,
  } = useERP();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState<PeriodFilter>('MONTHLY');
  const [anchorDate, setAnchorDate] = useState(todayStr);
  const [customStart, setCustomStart] = useState(todayStr.slice(0, 7) + '-01');
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [yardId, setYardId] = useState<string>('ALL');
  const [section, setSection] = useState<ReportSection>('OVERVIEW');
  const [drillSearch, setDrillSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const reportInput = useMemo(
    () => ({
      companyId: activeCompany.id,
      accounts,
      accountTransactions,
      expenses,
      invoices,
      purchases,
      sales,
      payments,
      parties,
      employees,
      attendance,
      salaryRecords,
      dailyLabourEntries,
      labourPayments,
      contractors,
      contractorWorkEntries,
      contractorPayments,
      journalEntries,
      yards,
    }),
    [
      activeCompany.id,
      accounts,
      accountTransactions,
      expenses,
      invoices,
      purchases,
      sales,
      payments,
      parties,
      employees,
      attendance,
      salaryRecords,
      dailyLabourEntries,
      labourPayments,
      contractors,
      contractorWorkEntries,
      contractorPayments,
      journalEntries,
      yards,
    ]
  );

  const overview = useMemo(() => computeOwnerBusinessOverview(reportInput), [reportInput]);
  const summary = useMemo(
    () => computeOwnerPeriodSummary(reportInput, period, anchorDate, customStart, customEnd, yardId),
    [reportInput, period, anchorDate, customStart, customEnd, yardId]
  );

  const filteredDrillDown = useMemo(() => {
    const q = drillSearch.trim().toLowerCase();
    if (!q) return summary.drillDownTransactions;
    return summary.drillDownTransactions.filter(
      (t) =>
        t.partyOrCategory.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        t.classification.toLowerCase().includes(q)
    );
  }, [summary.drillDownTransactions, drillSearch]);

  const handleExportExcelCsv = () => {
    const headers = ['Date', 'Source', 'Reference', 'Classification', 'Description / Party', 'Debit (INR)', 'Credit (INR)'];
    const rows = filteredDrillDown.map((t) => [
      t.date,
      t.source,
      t.reference,
      t.classification,
      t.partyOrCategory,
      t.debit,
      t.credit,
    ]);
    const csv = generateOwnerReportCsv(
      `YASHOTH ENTERPRISES - OWNER REPORT (${summary.startDate} to ${summary.endDate})`,
      headers,
      rows
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `YE_Owner_Report_${period}_${summary.startDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedback('Excel / CSV report exported.');
  };

  const handleShareSummary = async () => {
    const text = [
      `${activeCompany.companyName} — Owner Summary (${summary.startDate} to ${summary.endDate})`,
      `Business Income: ${formatINR(summary.businessIncome)}`,
      `Business Expenses: ${formatINR(summary.businessExpenses)}`,
      `Net Profit/Loss: ${formatINR(summary.netProfitLoss)}`,
      `Cash Balance: ${formatINR(overview.totalCashBalance)} | Bank: ${formatINR(overview.totalBankBalance)}`,
      `Receivables: ${formatINR(overview.totalCustomerReceivables)} | Payables: ${formatINR(overview.totalSupplierPayables)}`,
    ].join('\n');
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: 'Owner Summary Report', text }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text).catch(() => {});
      setFeedback('Owner summary copied to clipboard for sharing.');
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header & Actions */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-black flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span>Owner Summary Reports (உரிமையாளர் அறிக்கை)</span>
          </h1>
          <p className="text-xs text-slate-300">
            {activeCompany.companyName} • Period: {summary.startDate} to {summary.endDate} • Ledger-Reconciled Live Data
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleExportExcelCsv}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel / CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF / Print</span>
          </button>
          <button
            type="button"
            onClick={handleShareSummary}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2 text-xs print:hidden">
        {(['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL', 'CUSTOM'] as PeriodFilter[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
              period === p ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {p}
          </button>
        ))}
        {period !== 'CUSTOM' ? (
          <input
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-lg" />
            <span>to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-lg" />
          </div>
        )}
        <select
          value={yardId}
          onChange={(e) => setYardId(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold ml-auto"
        >
          <option value="ALL">All Yards ({yards.length})</option>
          {yards.map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {(
          [
            ['OVERVIEW', 'Owner Dashboard & Position'],
            ['FINANCE', 'Finance & Cash/Bank Reports'],
            ['OPERATIONS', 'Operational & Yard Reports'],
            ['DRILLDOWN', `Transaction Drill-Down (${summary.drillDownTransactions.length})`],
          ] as [ReportSection, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              section === key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {summary.alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
          {summary.alerts.map((a, idx) => (
            <div key={idx} className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {section === 'OVERVIEW' && (
        <div className="space-y-4">
          {/* 9 Core Owner KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">Business Income (4xxx)</div>
              <div className="text-lg font-black font-mono text-emerald-700">{formatINR(overview.totalBusinessIncome)}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">Business Expenses (5xxx)</div>
              <div className="text-lg font-black font-mono text-rose-700">{formatINR(overview.totalBusinessExpenses)}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">Net Profit / Loss</div>
              <div className={`text-lg font-black font-mono ${overview.netProfitLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatINR(overview.netProfitLoss)}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Wallet className="w-3 h-3" /> Cash Balance</div>
              <div className="text-lg font-black font-mono text-slate-900">{formatINR(overview.totalCashBalance)}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> Bank Balance</div>
              <div className="text-lg font-black font-mono text-slate-900">{formatINR(overview.totalBankBalance)}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">Customer Receivables</div>
              <div className="text-base font-black font-mono text-sky-700">{formatINR(overview.totalCustomerReceivables)}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">Supplier Payables</div>
              <div className="text-base font-black font-mono text-amber-700">{formatINR(overview.totalSupplierPayables + overview.unpaidExpensePayables)}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" /> Worker Liabilities</div>
              <div className="text-base font-black font-mono text-amber-700">{formatINR(overview.workerSalaryLiabilities)}</div>
            </div>
            <div className="bg-slate-900 text-white p-3.5 rounded-xl col-span-2 sm:col-span-1 lg:col-span-2">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-400" /> Current Financial Position</div>
              <div className="text-lg font-black font-mono text-sky-300">{formatINR(overview.currentFinancialPosition)}</div>
              <div className="text-[10px] text-slate-400">Capital In: {formatINR(overview.ownerCapitalInjected)} • Drawings: {formatINR(overview.ownerDrawings)}</div>
            </div>
          </div>

          {/* Income vs Expenses & Monthly Trend Bars */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800">Monthly Performance Trend (Income vs Expenses)</h3>
            {summary.monthlyTrends.length === 0 ? (
              <p className="text-xs text-slate-500">No posted monthly P&amp;L activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {summary.monthlyTrends.map((m) => {
                  const maxVal = Math.max(1, ...summary.monthlyTrends.flatMap((t) => [t.income, t.expenses]));
                  return (
                    <div key={m.month} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>{m.month}</span>
                        <span>In: {formatINR(m.income)} | Out: {formatINR(m.expenses)} | Net: {formatINR(m.profitLoss)}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full" style={{ width: `${Math.round((m.income / maxVal) * 100)}%` }} />
                        <div className="bg-rose-500 h-full" style={{ width: `${Math.round((m.expenses / maxVal) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'FINANCE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <h3 className="font-extrabold text-slate-900">Period Cash &amp; Bank Summary</h3>
            <div className="flex justify-between"><span>Cash Inflows:</span><span className="font-mono font-bold text-emerald-700">+{formatINR(summary.cashInflows)}</span></div>
            <div className="flex justify-between"><span>Cash Outflows:</span><span className="font-mono font-bold text-rose-700">-{formatINR(summary.cashOutflows)}</span></div>
            <div className="flex justify-between"><span>Bank Inflows:</span><span className="font-mono font-bold text-emerald-700">+{formatINR(summary.bankInflows)}</span></div>
            <div className="flex justify-between"><span>Bank Outflows:</span><span className="font-mono font-bold text-rose-700">-{formatINR(summary.bankOutflows)}</span></div>
            <div className="flex justify-between border-t pt-2"><span>Owner Capital (3010):</span><span className="font-mono font-bold">{formatINR(summary.ownerCapitalInflows)}</span></div>
            <div className="flex justify-between"><span>Owner Drawings (3030):</span><span className="font-mono font-bold">{formatINR(summary.ownerDrawingsOutflows)}</span></div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <h3 className="font-extrabold text-slate-900">Worker Salary, Labour &amp; Party Payments</h3>
            <div className="flex justify-between"><span>Permanent Staff Salary Paid:</span><span className="font-mono font-bold">{formatINR(summary.salaryPaid)}</span></div>
            <div className="flex justify-between"><span>Daily Labour Paid:</span><span className="font-mono font-bold">{formatINR(summary.labourPaid)}</span></div>
            <div className="flex justify-between"><span>Contractor Paid:</span><span className="font-mono font-bold">{formatINR(summary.contractorPaid)}</span></div>
            <div className="flex justify-between border-t pt-2"><span>Customer Payments Received:</span><span className="font-mono font-bold text-emerald-700">{formatINR(summary.customerPaymentsReceived)}</span></div>
            <div className="flex justify-between"><span>Supplier Payments Made:</span><span className="font-mono font-bold text-rose-700">{formatINR(summary.supplierPaymentsMade)}</span></div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs md:col-span-2">
            <h3 className="font-extrabold text-slate-900">Expense Breakdown by Category</h3>
            {summary.expenseByCategory.length === 0 ? (
              <p className="text-slate-500">No expenses recorded in this period.</p>
            ) : (
              summary.expenseByCategory.map((c) => (
                <div key={c.category} className="flex justify-between border-b border-slate-100 py-1">
                  <span>{c.category} ({c.count})</span>
                  <span className="font-mono font-bold">{formatINR(c.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === 'OPERATIONS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <h3 className="font-extrabold text-slate-900">Purchase Summary &amp; Supplier History</h3>
            <div>Purchases: {summary.purchaseSummary.count} • Total: {formatINR(summary.purchaseSummary.totalAmount)} • Outstanding: {formatINR(summary.purchaseSummary.outstanding)}</div>
            {summary.supplierPurchaseHistory.map((s) => (
              <div key={s.partyId} className="flex justify-between border-t pt-1">
                <span>{s.partyName} ({s.count})</span>
                <span className="font-mono font-bold">{formatINR(s.totalAmount)}</span>
              </div>
            ))}
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <h3 className="font-extrabold text-slate-900">Attendance &amp; Yard Operational Summary</h3>
            <div>Attendance: Present {summary.attendanceSummary.present} | Half {summary.attendanceSummary.halfDay} | Absent {summary.attendanceSummary.absent}</div>
            {summary.yardSummary.map((y) => (
              <div key={y.yardId} className="flex justify-between border-t pt-1">
                <span>{y.yardName}</span>
                <span className="font-mono">Pur: {formatINR(y.purchaseTotal)} | Sal: {formatINR(y.salesTotal)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'DRILLDOWN' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={drillSearch}
              onChange={(e) => setDrillSearch(e.target.value)}
              placeholder="Filter transactions by description, reference, or classification..."
              className="w-full text-xs p-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Ref</th>
                  <th className="py-2 pr-2">Classification</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 text-right">Debit</th>
                  <th className="py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrillDown.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{t.date}</td>
                    <td className="py-1.5 pr-2 font-mono">{t.reference}</td>
                    <td className="py-1.5 pr-2">{t.classification}</td>
                    <td className="py-1.5 pr-2">{t.partyOrCategory}</td>
                    <td className="py-1.5 text-right font-mono text-emerald-700">{t.debit > 0 ? formatINR(t.debit) : '-'}</td>
                    <td className="py-1.5 text-right font-mono text-rose-700">{t.credit > 0 ? formatINR(t.credit) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
