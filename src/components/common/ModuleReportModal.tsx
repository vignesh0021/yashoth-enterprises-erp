import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Send,
  Share2,
} from 'lucide-react';
import { Modal } from './Modal';
import { useERP } from '../../context/ERPContext';
import {
  buildModuleReportPayload,
  type ERPModuleReportId,
} from '../../utils/moduleReportBuilders';
import {
  generateModuleVisualReport,
  getLocalDateStr,
  printModuleReport,
  shareOrCopyReportText,
  shareOrDownloadCsv,
  shareOrDownloadPng,
  shiftLocalDateStr,
  type VisualReportPeriod,
} from '../../utils/visualReportExporter';
import {
  buildXlsxArchive,
  downloadWorkbookInBrowser,
  type ExcelWorkbook,
} from '../../../backend/business-rules/excelEngine.ts';

interface ModuleReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: ERPModuleReportId;
  initialPeriod?: VisualReportPeriod;
  initialDate?: string;
}

export const ModuleReportModal: React.FC<ModuleReportModalProps> = ({
  isOpen,
  onClose,
  moduleId,
  initialPeriod = 'DAY',
  initialDate,
}) => {
  const erp = useERP();
  const [period, setPeriod] = useState<VisualReportPeriod>(initialPeriod);
  const [anchorDate, setAnchorDate] = useState<string>(() => initialDate || getLocalDateStr());
  const [customEndDate, setCustomEndDate] = useState<string>(() => initialDate || getLocalDateStr());
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPeriod(initialPeriod);
      if (initialDate) {
        setAnchorDate(initialDate);
        setCustomEndDate(initialDate);
      }
      setStatusMsg(null);
    }
  }, [isOpen, initialPeriod, initialDate]);

  const payload = useMemo(() => {
    if (!isOpen) return null;
    return buildModuleReportPayload(
      moduleId,
      {
        company: erp.company,
        yards: erp.yards,
        materials: erp.materials,
        parties: erp.parties,
        vehicles: erp.vehicles,
        vehicleDocuments: erp.vehicleDocuments,
        employees: erp.employees,
        attendance: erp.attendance,
        accounts: erp.accounts,
        accountTransactions: erp.accountTransactions,
        expenses: erp.expenses,
        weighments: erp.weighments,
        collectionJobs: erp.collectionJobs,
        purchases: erp.purchases,
        inventoryLots: erp.inventoryLots,
        stockMovements: erp.stockMovements,
        godownTransfers: erp.godownTransfers,
        sales: erp.sales,
        invoices: erp.invoices,
        payments: erp.payments,
        commercialDocuments: erp.commercialDocuments,
        journalEntries: erp.journalEntries,
        salaryRecords: erp.salaryRecords,
        employeeAdvances: erp.employeeAdvances,
        labourAdvances: erp.labourAdvances,
        dailyLabourEntries: erp.dailyLabourEntries,
        contractorWorkEntries: erp.contractorWorkEntries,
        backupHistory: erp.backupHistory,
        auditLogs: erp.auditLogs,
        getAccountBalance: erp.getAccountBalance,
      },
      period,
      anchorDate,
      customEndDate
    );
  }, [isOpen, moduleId, erp, period, anchorDate, customEndDate]);

  const output = useMemo(() => {
    if (!payload) return null;
    return generateModuleVisualReport(payload);
  }, [payload]);

  const flashStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleSharePng = async () => {
    if (!payload || !output) return;
    setBusy(true);
    try {
      const res = await shareOrDownloadPng(
        output.dataUrl,
        output.pngFilename,
        `${payload.companyName} — ${payload.moduleTitle}`,
        output.whatsappText
      );
      flashStatus(
        res === 'SHARED'
          ? 'Visual PNG report shared successfully.'
          : `PNG saved (${output.pngFilename}). On Android, use Share PNG or long-press the preview image.`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPng = () => {
    if (!output?.dataUrl) return;
    const a = document.createElement('a');
    a.href = output.dataUrl;
    a.download = output.pngFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    flashStatus(`PNG triggered (${output.pngFilename}).`);
  };

  const handleExportCsv = async () => {
    if (!payload || !output) return;
    setBusy(true);
    try {
      const res = await shareOrDownloadCsv(
        output.csvContent,
        output.csvFilename,
        `${payload.companyName} — ${payload.moduleTitle} (CSV)`
      );
      flashStatus(
        res === 'SHARED'
          ? `CSV shared (${output.csvFilename}).`
          : `UTF-8 CSV exported (${output.csvFilename}).`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleExportXlsx = async () => {
    if (!payload || !output) return;
    setBusy(true);
    try {
      const xlsxName = output.csvFilename.replace(/\.csv$/i, '.xlsx');
      const workbook: ExcelWorkbook = {
        filename: xlsxName,
        sheets: [
          {
            name: 'Summary',
            headers: ['Metric', 'Value'],
            rows: [
              ['Company', payload.companyName],
              ['Module Report', payload.moduleTitle],
              ['Period', payload.periodLabel],
              ['Total Records', payload.rows.length],
              ...payload.kpis.map((k) => [k.label, k.value]),
            ],
          },
          {
            name: 'Register',
            headers: payload.headers,
            rows: payload.rows,
          },
        ],
      };

      const bytes = buildXlsxArchive(workbook);
      const blob = new Blob([bytes as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      let shared = false;
      try {
        const file = new File([blob], xlsxName, {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        if (
          typeof navigator !== 'undefined' &&
          navigator.share &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            files: [file],
            title: `${payload.companyName} — ${payload.moduleTitle}`,
          });
          shared = true;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }

      if (!shared) {
        downloadWorkbookInBrowser(workbook);
      }
      flashStatus(shared ? `Excel workbook shared (${xlsxName}).` : `Excel workbook exported (${xlsxName}).`);
    } finally {
      setBusy(false);
    }
  };

  const handleShareText = async () => {
    if (!payload || !output) return;
    const res = await shareOrCopyReportText(
      output.whatsappText,
      `${payload.companyName} — ${payload.moduleTitle}`
    );
    if (res === 'COPIED') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      flashStatus('WhatsApp summary text copied to clipboard.');
    } else if (res === 'SHARED') {
      flashStatus('Text summary shared.');
    } else {
      flashStatus('Copy or share cancelled.');
    }
  };

  const handlePrintPdf = () => {
    if (!payload) return;
    printModuleReport(payload);
    flashStatus('Print / Save as PDF view opened.');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={payload ? `Send Report — ${payload.moduleTitle}` : 'Send Module Report'}
      subtitle="Pick a particular date, week, month, or custom date range and send in the best format."
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Date Mode & Particular Date / Range Controls */}
        <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'DAY', label: 'Particular Date' },
                { id: 'WEEK', label: 'Week' },
                { id: 'MONTH', label: 'Month' },
                { id: 'CUSTOM', label: 'Custom Range' },
                { id: 'ALL', label: 'All Time' },
              ] as { id: VisualReportPeriod; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  period === p.id
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period !== 'ALL' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
              <div className="flex flex-wrap items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                {period === 'DAY' && (
                  <button
                    type="button"
                    onClick={() => setAnchorDate((d) => shiftLocalDateStr(d, -1))}
                    className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                    title="Previous Date"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                )}
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(e) => e.target.value && setAnchorDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                />
                {period === 'DAY' && (
                  <button
                    type="button"
                    onClick={() => setAnchorDate((d) => shiftLocalDateStr(d, 1))}
                    className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                    title="Next Date"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                )}
                {period === 'CUSTOM' && (
                  <>
                    <span className="text-xs font-bold text-slate-500">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => e.target.value && setCustomEndDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                    />
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const t = getLocalDateStr();
                    setAnchorDate(t);
                    setCustomEndDate(t);
                  }}
                  className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = shiftLocalDateStr(getLocalDateStr(), -1);
                    setAnchorDate(y);
                    setCustomEndDate(y);
                    setPeriod('DAY');
                  }}
                  className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  Yesterday
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status Toast */}
        {statusMsg && (
          <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            {statusMsg}
          </div>
        )}

        {/* Live Visual PNG Preview */}
        {output && output.dataUrl ? (
          <div className="rounded-xl overflow-hidden border border-slate-300 bg-slate-950">
            <img
              src={output.dataUrl}
              alt={payload?.moduleTitle || 'Module Visual Report'}
              className="w-full h-auto block"
            />
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2 bg-slate-50 rounded-xl border border-slate-200">
            <BarChart3 className="w-6 h-6 text-slate-400" />
            <span>Rendering visual preview ({output?.totalRows ?? 0} records)...</span>
          </div>
        )}

        {/* Recommended Delivery Actions */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500">
              Recommended formats: <strong>{payload?.recommendedFormats.join(' • ')}</strong> ({output?.totalRows ?? 0} rows)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleSharePng}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share PNG</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save PNG</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleExportCsv}
              className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleExportXlsx}
              className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleShareText}
              className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-sky-600" />}
              <span>{copied ? 'Copied' : 'WhatsApp Text'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

interface SendReportButtonProps {
  moduleId: ERPModuleReportId;
  label?: string;
  initialPeriod?: VisualReportPeriod;
  initialDate?: string;
  className?: string;
  compact?: boolean;
}

export const SendReportButton: React.FC<SendReportButtonProps> = ({
  moduleId,
  label = 'Send Report',
  initialPeriod = 'DAY',
  initialDate,
  className,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          `inline-flex items-center justify-center gap-1.5 ${
            compact ? 'px-3 py-1.5 text-[11px]' : 'px-3.5 py-2 min-h-[40px] text-xs'
          } rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold shadow-xs transition-all cursor-pointer select-none`
        }
        title="Pick Particular Date / Range and Send Report (PNG, CSV, Excel, WhatsApp Text, PDF)"
      >
        <Send className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </button>
      <ModuleReportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        moduleId={moduleId}
        initialPeriod={initialPeriod}
        initialDate={initialDate}
      />
    </>
  );
};
