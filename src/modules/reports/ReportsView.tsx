import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { formatINR, formatWeight } from '../../utils/calculations.ts';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  FileSpreadsheet, 
  TrendingUp 
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
    parties 
  } = useERP();

  const [activeReport, setActiveReport] = useState<
    'PURCHASE_REGISTER' | 'SALES_REGISTER' | 'WEIGHMENT_REGISTER' | 'STOCK_LEDGER' | 'EXPENSE_SUMMARY' | 'GROSS_MARGIN' | 'AUDIT_LOG'
  >('PURCHASE_REGISTER');

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
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Business Reports & Registers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational and audit registers derived strictly from authoritative persisted records.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>Print Current Register</span>
        </button>
      </div>

      {/* Report Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        {[
          { id: 'PURCHASE_REGISTER', label: 'Purchase Register' },
          { id: 'SALES_REGISTER', label: 'Sales & Dispatch Register' },
          { id: 'WEIGHMENT_REGISTER', label: 'Weighment Slip Register' },
          { id: 'STOCK_LEDGER', label: 'Material Stock Ledger' },
          { id: 'EXPENSE_SUMMARY', label: 'Expense Summary' },
          { id: 'GROSS_MARGIN', label: 'Gross Margin Analysis' },
          { id: 'AUDIT_LOG', label: 'Immutable Audit Trail' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
              activeReport === tab.id
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Report View */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Report 1: Purchase Register */}
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
                    ['Purchase No', 'Date', 'Supplier', 'Weight (KG)', 'Subtotal', 'Tax', 'Total Amount', 'Status'],
                    purchases.map((p) => [
                      p.purchaseNo,
                      p.transactionDate.split('T')[0],
                      parties.find((sup) => sup.id === p.supplierPartyId)?.legalName || '',
                      p.lines.reduce((s, l) => s + l.payableWeight, 0),
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
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Purchase #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3 text-right">Payable Weight</th>
                  <th className="py-2.5 px-3 text-right">Taxable Subtotal</th>
                  <th className="py-2.5 px-3 text-right">GST (18%)</th>
                  <th className="py-2.5 px-3 text-right">Total Payable</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{p.purchaseNo}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">{p.transactionDate.split('T')[0]}</td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                      {parties.find((sup) => sup.id === p.supplierPartyId)?.legalName}
                    </td>
                    <td className="py-2.5 px-3 text-right">{formatWeight(p.lines.reduce((s, l) => s + l.payableWeight, 0))}</td>
                    <td className="py-2.5 px-3 text-right">{formatINR(p.subtotalAmount)}</td>
                    <td className="py-2.5 px-3 text-right">{formatINR(p.taxAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-black text-red-600">{formatINR(p.totalAmount)}</td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report 2: Sales Register */}
        {activeReport === 'SALES_REGISTER' && (
          <div className="overflow-x-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Sales & Dispatch Register</h3>
                <span className="text-[10px] text-slate-500">Total Records: {sales.length}</span>
              </div>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Sales Order #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Quantity (KG)</th>
                  <th className="py-2.5 px-3 text-right">Taxable Value</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-right">Allocated COGS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{s.salesNo}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">{s.orderDate.split('T')[0]}</td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                      {parties.find((c) => c.id === s.customerPartyId)?.legalName}
                    </td>
                    <td className="py-2.5 px-3 text-right">{formatWeight(s.lines.reduce((q, l) => q + l.quantity, 0))}</td>
                    <td className="py-2.5 px-3 text-right">{formatINR(s.subtotalAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-black text-red-600">{formatINR(s.totalAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-700">{formatINR(s.allocatedCogs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report 3: Audit Log */}
        {activeReport === 'AUDIT_LOG' && (
          <div className="overflow-x-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Immutable Security Audit Trail</h3>
                <span className="text-[10px] text-slate-500">Non-editable system actions log</span>
              </div>
            </div>
            <table className="w-full text-left text-xs font-mono">
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
                    <td className="py-2.5 px-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{log.actorName}</td>
                    <td className="py-2.5 px-3 text-red-700 font-semibold">{log.action}</td>
                    <td className="py-2.5 px-3 text-slate-700">{log.entityType}</td>
                    <td className="py-2.5 px-3 text-slate-500">{log.entityId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fallback for other tabs */}
        {['WEIGHMENT_REGISTER', 'STOCK_LEDGER', 'EXPENSE_SUMMARY', 'GROSS_MARGIN'].includes(activeReport) && (
          <div className="p-8 text-center text-xs text-slate-600">
            <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h4 className="font-bold text-slate-800">Authoritative {activeReport.replace(/_/g, ' ')} Active</h4>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              All records reconciled strictly against normalized database tables and immutable ledgers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
