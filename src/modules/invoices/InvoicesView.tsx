import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Invoice } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { InvoiceRenderer } from '../../components/invoice/InvoiceRenderer.tsx';
import { formatINR, formatWeight } from '../../utils/calculations.ts';
import { FileText, Printer, Eye, Search, Filter, ShieldCheck } from 'lucide-react';

export const InvoicesView: React.FC = () => {
  const { invoices, company } = useERP();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInvoices = invoices.filter((inv) => {
    if (filterStatus !== 'ALL' && inv.paymentStatus !== filterStatus) return false;
    if (searchTerm) {
      const matchNo = inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCust = inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchNo || matchCust;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Invoices & Tax Bills</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Official GST Tax Invoices rendered with Yasoth Enterprises letterhead, bank details, and immutable snapshots.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === status
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice # or buyer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Dated</th>
                <th className="py-3 px-4">Customer (Bill to)</th>
                <th className="py-3 px-4">e-Way Bill #</th>
                <th className="py-3 px-4 text-right">Taxable Value</th>
                <th className="py-3 px-4 text-right">CGST + SGST (18%)</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 italic">
                    No issued invoices found. Dispatch sales orders to generate official invoices.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoiceNo}</td>
                    <td className="py-3 px-4 text-slate-600">{inv.invoiceDate}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{inv.customerName}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{inv.ewayBillNo || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">{formatINR(inv.subtotalTaxable)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatINR(inv.cgstAmount + inv.sgstAmount + inv.igstAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-red-600">{formatINR(inv.grandTotal)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(inv.outstandingBalance)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={inv.paymentStatus} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3 text-red-600" />
                        <span>View / Print A4</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Renderer Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`Tax Invoice — ${selectedInvoice.invoiceNo}`}
          subtitle="Print-friendly A4 Document"
          maxWidth="6xl"
        >
          <InvoiceRenderer
            invoice={selectedInvoice}
            company={company}
            onClose={() => setSelectedInvoice(null)}
          />
        </Modal>
      )}
    </div>
  );
};
