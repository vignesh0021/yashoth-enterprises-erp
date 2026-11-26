import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { getLocalDateStr } from '../../utils/visualReportExporter.ts';
import {
  ALL_20_BUSINESS_REPORTS,
  buildBusinessReport,
  exportReportToUtf8Csv,
  resolveReportDateRange,
  type BusinessReportId,
  type ReportPeriodPreset,
} from '../../../backend/business-rules/comprehensiveReportsEngine.ts';
import { Download, Printer, FileSpreadsheet, Calendar } from 'lucide-react';

export const AllBusinessReportsTab: React.FC = () => {
  const {
    activeCompanyId,
    activeCompany,
    purchases,
    sales,
    invoices,
    weighments,
    stockMovements,
    inventoryLots,
    materials,
    yards,
    parties,
    accounts,
    accountTransactions,
    expenses,
    salaryRecords,
    materialDispatches,
    godownTransfers,
    managedDocuments,
    uploadedDocuments,
    backupHistory,
    restoreLogs,
    journalEntries,
    exportConsolidatedMasterWorkbook,
  } = useERP();

  const today = getLocalDateStr();
  const [selectedReportId, setSelectedReportId] = useState<BusinessReportId>('SOURCE_WISE_STOCK');
  const [preset, setPreset] = useState<ReportPeriodPreset>('MONTHLY');
  const [customFrom, setCustomFrom] = useState(today.slice(0, 8) + '01');
  const [customTo, setCustomTo] = useState(today);

  const range = useMemo(
    () => resolveReportDateRange(preset, today, customFrom, customTo),
    [preset, today, customFrom, customTo]
  );

  const report = useMemo(
    () =>
      buildBusinessReport(
        selectedReportId,
        {
          companyId: activeCompanyId,
          purchases,
          sales,
          invoices,
          weighments,
          stockMovements,
          inventoryLots,
          materials,
          yards,
          parties,
          accounts,
          accountTransactions,
          expenses,
          salaryRecords,
          materialDispatches,
          godownTransfers,
          managedDocuments,
          uploadedDocuments,
          backupHistory,
          restoreLogs,
          journalEntries,
        },
        range.fromDate,
        range.toDate
      ),
    [
      selectedReportId,
      activeCompanyId,
      purchases,
      sales,
      invoices,
      weighments,
      stockMovements,
      inventoryLots,
      materials,
      yards,
      parties,
      accounts,
      accountTransactions,
      expenses,
      salaryRecords,
      materialDispatches,
      godownTransfers,
      managedDocuments,
      uploadedDocuments,
      backupHistory,
      restoreLogs,
      journalEntries,
      range,
    ]
  );

  const handleCsvDownload = () => {
    const csv = exportReportToUtf8Csv(report);
    const filename = `YE_${activeCompany.code || 'ERP'}_${report.reportId}_${range.fromDate}_to_${range.toDate}.csv`;
    if ((window as any).AndroidNative && typeof (window as any).AndroidNative.saveFileToDownloads === 'function') {
      (window as any).AndroidNative.saveFileToDownloads(filename, csv, 'text/csv;charset=utf-8');
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 text-xs">
      {/* Report Picker Grid (All 20 Integrated Business Reports) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
        {ALL_20_BUSINESS_REPORTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedReportId(r.id)}
            className={`text-left px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
              selectedReportId === r.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span className="text-[10px] font-black block truncate">
              {r.number}. {r.title}
            </span>
            <span className={`text-[9px] block truncate ${selectedReportId === r.id ? 'text-slate-300' : 'text-slate-500'}`}>
              {r.tamilTitle}
            </span>
          </button>
        ))}
      </div>

      {/* Period Filter & Export Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-500" />
          {(['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL', 'CUSTOM'] as ReportPeriodPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                preset === p ? 'bg-red-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
          {preset === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded-lg bg-white text-[11px]"
              />
              <span>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded-lg bg-white text-[11px]"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCsvDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> CSV (UTF-8 தமிழ்/EN)
          </button>
          <button
            type="button"
            onClick={() => exportConsolidatedMasterWorkbook()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> XLSX
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> PDF / Print
          </button>
        </div>
      </div>

      {/* Report Title & Summary Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-slate-900">
            {report.title} <span className="text-slate-500 font-semibold">({report.tamilTitle})</span>
          </h3>
          <p className="text-[11px] text-slate-500">
            Period: <strong>{report.fromDate}</strong> to <strong>{report.toDate}</strong> · Rows: <strong>{report.rows.length}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {report.summaryMetrics.map((m) => (
            <div key={m.label} className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
              <span className="text-[10px] text-slate-500 block">{m.label}</span>
              <span className="font-mono font-black text-slate-900">{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Report Data Table */}
      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
              {report.headers.map((h) => (
                <th key={h} className="py-2.5 px-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={report.headers.length} className="py-8 text-center text-slate-400 italic">
                  No records found for this report in the selected period.
                </td>
              </tr>
            ) : (
              report.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-800">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
