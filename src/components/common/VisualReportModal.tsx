import React, { useMemo, useState } from 'react';
import { Download, Share2, Copy, Check, Calendar, BarChart3, ChevronLeft, ChevronRight, FileSpreadsheet, Printer } from 'lucide-react';
import { Modal } from './Modal';
import type { Expense, Payment } from '../../types';
import type { CashBookPeriodSummary } from '../../../backend/business-rules/financeEngine.ts';
import {
  buildModuleCsv,
  generateVisualFinanceReport,
  getLocalDateStr,
  resolveVisualReportRange,
  shareOrDownloadCsv,
  shareOrDownloadPng,
  shiftLocalDateStr,
  type VisualReportPeriod,
} from '../../utils/visualReportExporter';

interface VisualReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  expenses: Expense[];
  payments: Payment[];
  cashBalance: number;
  bankBalance: number;
  cashBookSummary?: CashBookPeriodSummary;
  initialPeriod?: VisualReportPeriod;
  initialDate?: string;
  onFeedback?: (type: 'success' | 'error', msg: string) => void;
}

export const VisualReportModal: React.FC<VisualReportModalProps> = ({
  isOpen,
  onClose,
  companyName,
  expenses,
  payments,
  cashBalance,
  bankBalance,
  cashBookSummary,
  initialPeriod = 'DAY',
  initialDate,
  onFeedback,
}) => {
  const [period, setPeriod] = useState<VisualReportPeriod>(initialPeriod);
  const [anchorDate, setAnchorDate] = useState<string>(() => initialDate || getLocalDateStr());
  const [customEndDate, setCustomEndDate] = useState<string>(() => initialDate || getLocalDateStr());
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const report = useMemo(() => {
    if (!isOpen) return null;
    return generateVisualFinanceReport({
      companyName,
      period,
      anchorDate,
      customEndDate,
      expenses,
      payments,
      cashBalance,
      bankBalance,
      cashBookSummary,
    });
  }, [isOpen, companyName, period, anchorDate, customEndDate, expenses, payments, cashBalance, bankBalance, cashBookSummary]);

  const handleShare = async () => {
    if (!report) return;
    setSharing(true);
    try {
      const result = await shareOrDownloadPng(
        report.dataUrl,
        report.filename,
        `${companyName} ${period} Visual Report`,
        report.summaryText
      );
      if (result === 'SHARED') {
        onFeedback?.('success', 'Visual PNG report shared.');
      } else if (result === 'DOWNLOADED') {
        onFeedback?.('success', `PNG saved (${report.filename}). If download is blocked on mobile, long-press the image above to save.`);
      } else {
        onFeedback?.('success', 'Use Share or long-press the image above to save/send.');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleDownloadOnly = () => {
    if (!report) return;
    const a = document.createElement('a');
    a.href = report.dataUrl;
    a.download = report.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onFeedback?.('success', `PNG triggered (${report.filename}). On Android, use Share PNG or long-press the image.`);
  };

  const handleExportCsv = async () => {
    if (!report) return;
    const resolved = resolveVisualReportRange(period, anchorDate, customEndDate);
    const filtered = expenses.filter(
      (e) => e.status !== 'REVERSED' && e.expenseDate >= resolved.startDate && e.expenseDate <= resolved.endDate
    );
    const csv = buildModuleCsv(
      ['Date', 'Voucher No', 'Category', 'Paid To', 'Mode', 'Status', 'Amount (INR)', 'Notes'],
      filtered.map((e) => [
        e.expenseDate,
        e.voucherNo,
        e.category,
        e.paidTo,
        e.paymentMode || 'CASH',
        e.status || 'PAID',
        e.amount,
        e.notes || '',
      ])
    );
    const csvName = report.filename.replace(/\.png$/i, '.csv');
    await shareOrDownloadCsv(csv, csvName, `${companyName} Expenses CSV`);
    onFeedback?.('success', `CSV exported (${csvName}).`);
  };

  const handleCopyText = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onFeedback?.('success', 'Report summary copied to clipboard.');
    } catch {
      onFeedback?.('error', 'Clipboard copy not available.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Visual Report Sender (Particular Date / Week / Month / Range)"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Period & Date Controls */}
        <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'DAY', label: 'Particular Date (குறிப்பிட்ட தேதி)' },
                { id: 'WEEK', label: 'Week (வாரம்)' },
                { id: 'MONTH', label: 'Month (மாதம்)' },
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
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
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

        {/* Rendered Visual PNG Preview */}
        {report && report.dataUrl ? (
          <div className="rounded-xl overflow-hidden border border-slate-300 bg-slate-950">
            <img
              src={report.dataUrl}
              alt={`${period} Visual Report`}
              className="w-full h-auto block"
            />
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <BarChart3 className="w-6 h-6 text-slate-400" />
            <span>Generating visual report...</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-slate-500">
            Tip: Tap <strong>Share PNG</strong> to send directly via WhatsApp, export <strong>CSV</strong> for Excel, or long-press the image.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadOnly}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save PNG</span>
            </button>
            <button
              type="button"
              disabled={sharing}
              onClick={handleShare}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{sharing ? 'Sharing...' : 'Share PNG (WhatsApp)'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
