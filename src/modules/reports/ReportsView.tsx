import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { formatINR, formatWeight } from '../../utils/calculations.ts';
import { STANDARD_CHART_OF_ACCOUNTS } from '../../../backend/business-rules/accountingEngine.ts';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  FileSpreadsheet, 
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Scale,
  BookOpen,
  Wallet,
  Users,
  Building2,
  FileText,
  Search
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { 
    purchases, 
    sales, 
    weighments, 
    stockMovements, 
    materials, 
    expenses, 
    auditLogs, 
    parties,
    journalEntries,
    getGeneralLedgerReport,
    getTrialBalanceReport,
    getProfitAndLossReport,
    getBalanceSheetReport,
    getPartyStatementReport,
    activeCompany,
    exportSingleExcelWorkbook,
    exportAllExcelWorkbooks,
    exportConsolidatedMasterWorkbook,
  } = useERP();

  const [activeReport, setActiveReport] = useState<
    | 'TRIAL_BALANCE'
    | 'PROFIT_LOSS'
    | 'BALANCE_SHEET'
    | 'GENERAL_LEDGER'
    | 'PARTY_STATEMENTS'
    | 'CASH_BANK_BOOK'
    | 'PURCHASE_REGISTER'
    | 'SALES_REGISTER'
    | 'AUDIT_LOG'
    | 'EXCEL_WORKBOOKS'
  >('TRIAL_BALANCE');

  // Filter states
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountCode, setSelectedAccountCode] = useState('1010');
  const [selectedPartyId, setSelectedPartyId] = useState(parties[0]?.id || '');

  // Derived Accounting Reports
  const trialBalance = useMemo(() => getTrialBalanceReport(asOfDate), [asOfDate, journalEntries]);
  const profitAndLoss = useMemo(() => getProfitAndLossReport(fromDate, toDate), [fromDate, toDate, journalEntries]);
  const balanceSheet = useMemo(() => getBalanceSheetReport(asOfDate), [asOfDate, journalEntries]);
  const generalLedger = useMemo(() => getGeneralLedgerReport(selectedAccountCode), [selectedAccountCode, journalEntries]);
  const partyStatement = useMemo(() => {
    if (!selectedPartyId) return null;
    try {
      return getPartyStatementReport(selectedPartyId, fromDate, toDate);
    } catch {
      return null;
    }
  }, [selectedPartyId, fromDate, toDate, journalEntries]);

  const cashBook = useMemo(() => getGeneralLedgerReport('1010'), [journalEntries]);
  const bankBook = useMemo(() => getGeneralLedgerReport('1020'), [journalEntries]);

  const handleExportCsv = (title: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="w-6 h-6 text-red-600" />
            <span>Financial Statements & Business Registers</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict double-entry financial statements and immutable operational registers.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>Print Current Statement</span>
        </button>
      </div>

      {/* Report Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        {[
          { id: 'TRIAL_BALANCE', label: 'Trial Balance' },
          { id: 'PROFIT_LOSS', label: 'Profit & Loss (P&L)' },
          { id: 'BALANCE_SHEET', label: 'Balance Sheet' },
          { id: 'GENERAL_LEDGER', label: 'General Ledger' },
          { id: 'PARTY_STATEMENTS', label: 'Party Statements' },
          { id: 'CASH_BANK_BOOK', label: 'Cash & Bank Books' },
          { id: 'PURCHASE_REGISTER', label: 'Purchase Register' },
          { id: 'SALES_REGISTER', label: 'Sales Register' },
          { id: 'AUDIT_LOG', label: 'Audit Trail' },
          { id: 'EXCEL_WORKBOOKS', label: '📊 Excel Workbooks (.xlsx)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
              activeReport === tab.id
                ? 'bg-red-600 text-white border-red-600 shadow-sm font-bold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* 1. TRIAL BALANCE */}
        {activeReport === 'TRIAL_BALANCE' && (
          <div className="p-3 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Official Trial Balance</h3>
                <p className="text-xs text-slate-500">As of date: {trialBalance.asOfDate}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs outline-none font-semibold text-slate-800"
                />
                <button
                  onClick={() =>
                    handleExportCsv(
                      'Trial_Balance',
                      ['Account Code', 'Account Name', 'Category', 'Debit (INR)', 'Credit (INR)'],
                      trialBalance.items.map((i) => [i.code, i.name, i.category, i.debitBalance, i.creditBalance])
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Reconciliation Status Badge */}
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold ${
              trialBalance.isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {trialBalance.isBalanced ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />}
                <span>{trialBalance.isBalanced ? 'Trial Balance is Reconciled and Perfectly Balanced' : 'Trial Balance Imbalance Detected!'}</span>
              </div>
              <span className="font-mono shrink-0">Difference: {formatINR(trialBalance.difference)}</span>
            </div>

            <div className="w-full overflow-x-auto touch-pan-x -mx-1 px-1">
              <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Account Description</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5 text-right">Debit Balance (₹)</th>
                    <th className="p-2.5 text-right">Credit Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {trialBalance.items.map((row) => (
                    <tr key={row.code} className="hover:bg-slate-50/70">
                      <td className="p-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">{row.code}</td>
                      <td className="p-2.5 text-slate-900">{row.name}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                          {row.category}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-800 whitespace-nowrap">
                        {row.debitBalance > 0 ? formatINR(row.debitBalance) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-800 whitespace-nowrap">
                        {row.creditBalance > 0 ? formatINR(row.creditBalance) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={3} className="p-3 uppercase">Total Sum</td>
                    <td className="p-3 text-right font-mono text-sm text-emerald-700 whitespace-nowrap">{formatINR(trialBalance.totalDebits)}</td>
                    <td className="p-3 text-right font-mono text-sm text-emerald-700 whitespace-nowrap">{formatINR(trialBalance.totalCredits)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* 2. PROFIT & LOSS STATEMENT */}
        {activeReport === 'PROFIT_LOSS' && (
          <div className="p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Statement of Profit and Loss</h3>
                <p className="text-xs text-slate-500">Period: {profitAndLoss.fromDate} to {profitAndLoss.toDate}</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[11px] font-bold text-emerald-700 uppercase">Total Revenue</span>
                <p className="text-xl font-black text-emerald-900 font-mono mt-1">{formatINR(profitAndLoss.totalRevenue)}</p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-[11px] font-bold text-amber-700 uppercase">Gross Profit</span>
                <p className="text-xl font-black text-amber-900 font-mono mt-1">{formatINR(profitAndLoss.grossProfit)}</p>
                <span className="text-[10px] text-amber-600">Revenue - Cost of Goods Sold</span>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[11px] font-bold text-blue-700 uppercase">Net Profit / (Loss)</span>
                <p className="text-xl font-black text-blue-900 font-mono mt-1">{formatINR(profitAndLoss.netProfit)}</p>
                <span className="text-[10px] text-blue-600">Gross Profit - Operating Expenses</span>
              </div>
            </div>

            {/* P&L Details */}
            <div className="space-y-4">
              {/* Section 1: Revenue */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 font-bold text-xs text-slate-800 border-b">1. REVENUE FROM OPERATIONS</div>
                <div className="p-3 space-y-2 text-xs">
                  {profitAndLoss.revenueLines.map((l) => (
                    <div key={l.code} className="flex justify-between font-medium">
                      <span>{l.code} — {l.name}</span>
                      <span className="font-mono font-bold">{formatINR(l.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-bold text-slate-900">
                    <span>Total Revenue</span>
                    <span className="font-mono">{formatINR(profitAndLoss.totalRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: COGS */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 font-bold text-xs text-slate-800 border-b">2. COST OF GOODS SOLD (DIRECT COSTS)</div>
                <div className="p-3 space-y-2 text-xs">
                  {profitAndLoss.cogsLines.map((l) => (
                    <div key={l.code} className="flex justify-between font-medium">
                      <span>{l.code} — {l.name}</span>
                      <span className="font-mono font-bold text-red-700">{formatINR(l.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-bold text-slate-900">
                    <span>Total COGS</span>
                    <span className="font-mono text-red-700">{formatINR(profitAndLoss.totalCOGS)}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Operating Expenses */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 font-bold text-xs text-slate-800 border-b">3. OPERATING EXPENSES (INDIRECT COSTS)</div>
                <div className="p-3 space-y-2 text-xs">
                  {profitAndLoss.operatingExpenseLines.map((l) => (
                    <div key={l.code} className="flex justify-between font-medium">
                      <span>{l.code} — {l.name}</span>
                      <span className="font-mono font-bold text-red-700">{formatINR(l.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-bold text-slate-900">
                    <span>Total Operating Expenses</span>
                    <span className="font-mono text-red-700">{formatINR(profitAndLoss.totalOperatingExpenses)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. BALANCE SHEET */}
        {activeReport === 'BALANCE_SHEET' && (
          <div className="p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Official Balance Sheet</h3>
                <p className="text-xs text-slate-500">As of: {balanceSheet.asOfDate}</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs outline-none font-semibold text-slate-800"
                />
              </div>
            </div>

            {/* Reconciliation Status Badge */}
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
              balanceSheet.isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Total Assets ({formatINR(balanceSheet.totalAssets)}) === Total Liabilities & Equity ({formatINR(balanceSheet.totalLiabilitiesAndEquity)})</span>
              </div>
              <span className="font-mono">Difference: {formatINR(balanceSheet.difference)}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assets Column */}
              <div className="border border-slate-200 rounded-xl overflow-hidden space-y-0">
                <div className="p-3 bg-slate-900 text-white font-bold text-xs uppercase flex justify-between">
                  <span>Assets</span>
                  <span className="font-mono">{formatINR(balanceSheet.totalAssets)}</span>
                </div>
                <div className="p-4 space-y-2 text-xs divide-y divide-slate-100">
                  {balanceSheet.assets.map((a) => (
                    <div key={a.code} className="flex justify-between pt-2 first:pt-0 font-medium">
                      <span>{a.code} — {a.name}</span>
                      <span className="font-mono font-bold text-slate-900">{formatINR(a.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Liabilities & Equity Column */}
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-slate-900 text-white font-bold text-xs uppercase flex justify-between">
                    <span>Liabilities</span>
                    <span className="font-mono">{formatINR(balanceSheet.totalLiabilities)}</span>
                  </div>
                  <div className="p-4 space-y-2 text-xs divide-y divide-slate-100">
                    {balanceSheet.liabilities.map((l) => (
                      <div key={l.code} className="flex justify-between pt-2 first:pt-0 font-medium">
                        <span>{l.code} — {l.name}</span>
                        <span className="font-mono font-bold text-slate-900">{formatINR(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-slate-800 text-white font-bold text-xs uppercase flex justify-between">
                    <span>Equity & Reserves</span>
                    <span className="font-mono">{formatINR(balanceSheet.totalEquity)}</span>
                  </div>
                  <div className="p-4 space-y-2 text-xs divide-y divide-slate-100">
                    {balanceSheet.equity.map((e) => (
                      <div key={e.code} className="flex justify-between pt-2 first:pt-0 font-medium">
                        <span>{e.code} — {e.name}</span>
                        <span className="font-mono font-bold text-slate-900">{formatINR(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. GENERAL LEDGER */}
        {activeReport === 'GENERAL_LEDGER' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">General Ledger</h3>
                <p className="text-xs text-slate-500">Account: {generalLedger.accountCode} — {generalLedger.accountName}</p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedAccountCode}
                  onChange={(e) => setSelectedAccountCode(e.target.value)}
                  className="p-2 border border-slate-300 rounded-lg text-xs outline-none font-bold text-slate-800"
                >
                  {STANDARD_CHART_OF_ACCOUNTS.map((acc) => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} — {acc.name} ({acc.category})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() =>
                    handleExportCsv(
                      `GL_${generalLedger.accountCode}`,
                      ['Date', 'Entry No', 'Source', 'Ref No', 'Narration', 'Debit', 'Credit', 'Running Balance'],
                      generalLedger.rows.map((r) => [
                        r.date,
                        r.entryNo,
                        r.sourceType,
                        r.referenceNo || '',
                        r.narration,
                        r.debit,
                        r.credit,
                        r.runningBalance,
                      ])
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="flex justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold">
              <div>
                <span className="text-slate-500">Total Debit: </span>
                <span className="font-mono text-emerald-700">{formatINR(generalLedger.closingDebit)}</span>
              </div>
              <div>
                <span className="text-slate-500">Total Credit: </span>
                <span className="font-mono text-emerald-700">{formatINR(generalLedger.closingCredit)}</span>
              </div>
              <div>
                <span className="text-slate-500">Closing Balance: </span>
                <span className="font-mono text-slate-900 text-sm">{formatINR(generalLedger.closingBalance)}</span>
              </div>
            </div>

            <div className="w-full overflow-x-auto touch-pan-x -mx-1 px-1">
              <table className="w-full min-w-[600px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Entry No</th>
                    <th className="p-2.5">Narration</th>
                    <th className="p-2.5 text-right">Debit (₹)</th>
                    <th className="p-2.5 text-right">Credit (₹)</th>
                    <th className="p-2.5 text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {generalLedger.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                        No journal lines posted for this account code yet.
                      </td>
                    </tr>
                  ) : (
                    generalLedger.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{row.date}</td>
                        <td className="p-2.5 font-mono text-slate-800 font-bold whitespace-nowrap">{row.entryNo}</td>
                        <td className="p-2.5 text-slate-700">{row.narration}</td>
                        <td className="p-2.5 text-right font-mono text-slate-800 whitespace-nowrap">
                          {row.debit > 0 ? formatINR(row.debit) : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-800 whitespace-nowrap">
                          {row.credit > 0 ? formatINR(row.credit) : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatINR(row.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. PARTY STATEMENTS */}
        {activeReport === 'PARTY_STATEMENTS' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Party Statement of Account</h3>
                <p className="text-xs text-slate-500">Customer & Supplier chronological ledger statement</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs outline-none font-bold text-slate-800"
                >
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.legalName} ({p.partyType})
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs outline-none"
                />
              </div>
            </div>

            {partyStatement && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block">Opening Balance</span>
                    <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">{formatINR(partyStatement.openingBalance)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Total Invoiced / Debits</span>
                    <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">{formatINR(partyStatement.totalDebit)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Total Payments / Credits</span>
                    <span className="text-base font-black text-blue-700 font-mono mt-0.5 block">{formatINR(partyStatement.totalCredit)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Closing Balance</span>
                    <span className="text-base font-black text-red-700 font-mono mt-0.5 block">{formatINR(partyStatement.closingBalance)}</span>
                  </div>
                </div>

                <div className="w-full overflow-x-auto touch-pan-x -mx-1 px-1">
                  <table className="w-full min-w-[640px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Doc Ref</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Narration</th>
                        <th className="p-2.5 text-right">Debit (₹)</th>
                        <th className="p-2.5 text-right">Credit (₹)</th>
                        <th className="p-2.5 text-right">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {partyStatement.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                            No transactions found for this party in the selected date range.
                          </td>
                        </tr>
                      ) : (
                        partyStatement.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{item.date}</td>
                            <td className="p-2.5 font-mono text-slate-900 font-bold whitespace-nowrap">{item.documentRef}</td>
                            <td className="p-2.5 text-[10px] uppercase font-bold text-slate-500 whitespace-nowrap">{item.documentType}</td>
                            <td className="p-2.5 text-slate-700">{item.narration}</td>
                            <td className="p-2.5 text-right font-mono text-slate-800 whitespace-nowrap">
                              {item.debit > 0 ? formatINR(item.debit) : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-800 whitespace-nowrap">
                              {item.credit > 0 ? formatINR(item.credit) : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {formatINR(item.runningBalance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. CASH & BANK BOOKS */}
        {activeReport === 'CASH_BANK_BOOK' && (
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cash Book */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-900 text-white font-bold text-xs uppercase flex justify-between items-center">
                  <span>Cash on Hand (Account 1010)</span>
                  <span className="font-mono text-sm text-emerald-400 font-black">{formatINR(cashBook.closingBalance)}</span>
                </div>
                <div className="p-3 max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-slate-400 border-b">
                      <tr>
                        <th className="pb-1">Date</th>
                        <th className="pb-1">Narration</th>
                        <th className="pb-1 text-right">Inflow (Dr)</th>
                        <th className="pb-1 text-right">Outflow (Cr)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {cashBook.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1 text-slate-500">{r.date}</td>
                          <td className="py-1 font-sans text-slate-700 truncate max-w-[120px]">{r.narration}</td>
                          <td className="py-1 text-right text-emerald-700">{r.debit > 0 ? formatINR(r.debit) : '-'}</td>
                          <td className="py-1 text-right text-red-700">{r.credit > 0 ? formatINR(r.credit) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bank Book */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-900 text-white font-bold text-xs uppercase flex justify-between items-center">
                  <span>Bank Accounts (Account 1020)</span>
                  <span className="font-mono text-sm text-emerald-400 font-black">{formatINR(bankBook.closingBalance)}</span>
                </div>
                <div className="p-3 max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-slate-400 border-b">
                      <tr>
                        <th className="pb-1">Date</th>
                        <th className="pb-1">Narration</th>
                        <th className="pb-1 text-right">Inflow (Dr)</th>
                        <th className="pb-1 text-right">Outflow (Cr)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {bankBook.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1 text-slate-500">{r.date}</td>
                          <td className="py-1 font-sans text-slate-700 truncate max-w-[120px]">{r.narration}</td>
                          <td className="py-1 text-right text-emerald-700">{r.debit > 0 ? formatINR(r.debit) : '-'}</td>
                          <td className="py-1 text-right text-red-700">{r.credit > 0 ? formatINR(r.credit) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. PURCHASE REGISTER */}
        {activeReport === 'PURCHASE_REGISTER' && (
          <div className="overflow-x-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Purchase & Intake Register</h3>
                <span className="text-[10px] text-slate-500">Total Records: {purchases.length}</span>
              </div>
              <button
                onClick={() =>
                  handleExportCsv(
                    'Purchase_Register',
                    ['Purchase No', 'Date', 'Supplier', 'Subtotal', 'Tax', 'Total Amount', 'Status'],
                    purchases.map((p) => [
                      p.purchaseNo,
                      p.transactionDate.split('T')[0],
                      parties.find((sup) => sup.id === p.supplierPartyId)?.legalName || '',
                      p.subtotalAmount,
                      p.taxAmount,
                      p.totalAmount,
                      p.status,
                    ])
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
            <div className="w-full overflow-x-auto touch-pan-x">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Purchase No</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                    <th className="py-2.5 px-3 text-right">Total Amount (₹)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 font-mono whitespace-nowrap">{p.purchaseNo}</td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{p.transactionDate.split('T')[0]}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {parties.find((sup) => sup.id === p.supplierPartyId)?.legalName || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">{formatINR(p.subtotalAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">{formatINR(p.taxAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{formatINR(p.totalAmount)}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. SALES REGISTER */}
        {activeReport === 'SALES_REGISTER' && (
          <div className="overflow-x-auto touch-pan-x">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Sales & Dispatch Register</h3>
                <span className="text-[10px] text-slate-500">Total Records: {sales.length}</span>
              </div>
              <button
                onClick={() =>
                  handleExportCsv(
                    'Sales_Register',
                    ['Order No', 'Date', 'Customer', 'Subtotal', 'Tax', 'Grand Total', 'Status'],
                    sales.map((s) => [
                      s.salesNo,
                      s.orderDate,
                      parties.find((cust) => cust.id === s.customerPartyId)?.legalName || '',
                      s.subtotalAmount,
                      s.taxAmount,
                      s.totalAmount,
                      s.status,
                    ])
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Order No</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                  <th className="py-2.5 px-3 text-right">GST Total (₹)</th>
                  <th className="py-2.5 px-3 text-right">Grand Total (₹)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900 font-mono whitespace-nowrap">{s.salesNo}</td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{s.orderDate}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {parties.find((cust) => cust.id === s.customerPartyId)?.legalName || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">{formatINR(s.subtotalAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">{formatINR(s.taxAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{formatINR(s.totalAmount)}</td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 9. AUDIT TRAIL */}
        {activeReport === 'AUDIT_LOG' && (
          <div className="overflow-x-auto touch-pan-x">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Immutable Security Audit Trail</h3>
                <span className="text-[10px] text-slate-500">Non-editable system actions log</span>
              </div>
            </div>
            <table className="w-full min-w-[620px] text-left text-xs font-mono">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity Type</th>
                  <th className="py-2.5 px-3">Entity ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">{log.actorName}</td>
                    <td className="py-2.5 px-3 text-red-700 font-semibold whitespace-nowrap">{log.action}</td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{log.entityType}</td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{log.entityId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 10. PHASE 6 EXCEL WORKBOOKS (.XLSX) */}
        {activeReport === 'EXCEL_WORKBOOKS' && (
          <div className="p-5 space-y-6">
            {/* Header / Summary Banner */}
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Phase 6 OpenXML Engine
                  </span>
                  <span className="text-xs text-emerald-200">
                    Company: <strong className="text-white">{activeCompany?.companyName || 'Yashoth Enterprises'}</strong> ({activeCompany?.code || 'YE-MAIN'})
                  </span>
                </div>
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span>Independent & Consolidated Excel Workbooks</span>
                </h2>
                <p className="text-xs text-emerald-100/80 max-w-2xl leading-relaxed">
                  Generated directly in native OpenXML (.xlsx) format. Compatible with Microsoft Excel, Google Sheets, LibreOffice Calc, and Apple Numbers. All figures strictly reconcile with posted double-entry journal entries and database records.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => exportConsolidatedMasterWorkbook()}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Consolidated Master (.xlsx)</span>
                </button>
                <button
                  onClick={() => exportAllExcelWorkbooks()}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs border border-white/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download All 14 Files</span>
                </button>
              </div>
            </div>

            {/* Reconciliation Guarantee Notice */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-semibold">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  <strong>Strict Database Reconciliation:</strong> Customer & Supplier balances, Invoice GST calculations, Inward weighments, Expense vouchers, and Double-entry Trial Balance in these files exactly match system records.
                </span>
              </div>
              <span className="text-[10px] uppercase font-mono tracking-wider bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded">
                Multi-Company Isolated
              </span>
            </div>

            {/* Grid of 14 Individual Workbooks */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  filename: 'Company_Profile.xlsx',
                  title: '1. Company Profile',
                  description: 'Legal identity, registration numbers, GSTIN, PAN, bank account details, and operational yards.',
                  category: 'Master Data',
                  color: 'blue',
                },
                {
                  filename: 'Customers.xlsx',
                  title: '2. Customers Register',
                  description: 'Active buyers and foundries, GSTIN, billing state, contact details, opening & current balances.',
                  category: 'Master Data',
                  color: 'blue',
                },
                {
                  filename: 'Suppliers.xlsx',
                  title: '3. Suppliers Register',
                  description: 'Scrap vendors, demolition contractors, state codes, GSTIN, and current payable balances.',
                  category: 'Master Data',
                  color: 'blue',
                },
                {
                  filename: 'Sales_Register.xlsx',
                  title: '4. Sales Register',
                  description: 'All outbound dispatch orders, material grades, net weighments, rates, GST, and invoice numbers.',
                  category: 'Registers',
                  color: 'amber',
                },
                {
                  filename: 'Purchase_Register.xlsx',
                  title: '5. Purchase Register',
                  description: 'Inward weighment slips, gross/tare/net weight, moisture deduction, payable weight, and vendor cost.',
                  category: 'Registers',
                  color: 'amber',
                },
                {
                  filename: 'Invoice_Register.xlsx',
                  title: '6. Tax Invoice Register',
                  description: 'Sales tax invoices, itemized HSN codes, CGST, SGST, IGST tax breakdown, and payment status.',
                  category: 'Registers',
                  color: 'amber',
                },
                {
                  filename: 'Expenses.xlsx',
                  title: '7. Expense Register',
                  description: 'Demolition transport, site labor, yard machinery, fuel, and operational overhead vouchers.',
                  category: 'Registers',
                  color: 'amber',
                },
                {
                  filename: 'Payments.xlsx',
                  title: '8. Payment Receipts & Vouchers',
                  description: 'Inflow receipts, vendor disbursements, RTGS/NEFT/Cheque references, and party allocations.',
                  category: 'Registers',
                  color: 'amber',
                },
                {
                  filename: 'Customer_Ledger.xlsx',
                  title: '9. Customer Ledger',
                  description: 'Chronological party statement with running balances, invoices, payment receipts, and balance confirmation.',
                  category: 'Ledgers',
                  color: 'purple',
                },
                {
                  filename: 'Supplier_Ledger.xlsx',
                  title: '10. Supplier Ledger',
                  description: 'Vendor account statement showing purchase weighments, advance payments, and net payable balance.',
                  category: 'Ledgers',
                  color: 'purple',
                },
                {
                  filename: 'General_Ledger.xlsx',
                  title: '11. General Ledger',
                  description: 'Double-entry audit trail across all standard chart of accounts with journal voucher references.',
                  category: 'Accounting',
                  color: 'emerald',
                },
                {
                  filename: 'Trial_Balance.xlsx',
                  title: '12. Trial Balance',
                  description: 'Official trial balance verifying Total Debits equals Total Credits across all account classes.',
                  category: 'Accounting',
                  color: 'emerald',
                },
                {
                  filename: 'Profit_Loss.xlsx',
                  title: '13. Profit & Loss Statement',
                  description: 'Operating revenues, cost of scrap goods, gross margin, administrative expenses, and net profit.',
                  category: 'Accounting',
                  color: 'emerald',
                },
                {
                  filename: 'Balance_Sheet.xlsx',
                  title: '14. Balance Sheet',
                  description: 'Assets, current liabilities, and equity reconciled with net retained earnings from P&L.',
                  category: 'Accounting',
                  color: 'emerald',
                },
              ].map((item) => (
                <div
                  key={item.filename}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {item.category}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        .xlsx
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                      {item.filename}
                    </span>
                    <button
                      onClick={() => exportSingleExcelWorkbook(item.filename)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
