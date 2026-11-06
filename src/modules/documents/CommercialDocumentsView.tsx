import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { CommercialDocType, CommercialDocument, Party } from '../../types/index.ts';
import { formatINR } from '../../utils/calculations.ts';
import { 
  FileCheck2, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  ArrowRight, 
  Printer, 
  Trash2, 
  Eye, 
  AlertCircle, 
  CheckCircle, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { QuotationRenderer } from '../../components/documents/QuotationRenderer.tsx';

export const CommercialDocumentsView: React.FC = () => {
  const { 
    commercialDocuments, 
    parties, 
    company, 
    invoices, 
    purchases, 
    createCommercialDoc, 
    convertCommercialDoc, 
    issueCreditNote, 
    issueDebitNote, 
    deleteCommercialDoc 
  } = useERP();

  const [activeTab, setActiveTab] = useState<CommercialDocType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<CommercialDocument | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [docType, setDocType] = useState<CommercialDocType>('QUOTATION');
  const [partyId, setPartyId] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [refNo, setRefNo] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{ description: string; quantity: number; unit: string; rate: number; gstRate: number }>>([
    { description: 'Heavy Melting Steel Scrap (HMS 1&2)', quantity: 2.5, unit: 'TON', rate: 38000, gstRate: 18 }
  ]);

  const filteredDocs = commercialDocuments.filter((doc) => {
    if (activeTab !== 'ALL' && doc.documentType !== activeTab) return false;
    if (searchTerm) {
      const matchNo = doc.documentNo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchParty = doc.partyName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchNo || matchParty;
    }
    return true;
  });

  const handleAddLine = () => {
    setLines([...lines, { description: '', quantity: 1, unit: 'KG', rate: 0, gstRate: 18 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const handleUpdateLine = (idx: number, field: string, val: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: val };
    setLines(updated);
  };

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    const party = parties.find((p) => p.id === partyId);
    if (!party) {
      setFeedback({ type: 'error', text: 'Please select a valid Customer or Supplier.' });
      return;
    }

    try {
      createCommercialDoc({
        party,
        documentType: docType,
        documentDate: docDate,
        dueDate: dueDate || undefined,
        referenceNo: refNo || undefined,
        lines,
        notes: notes || undefined
      });
      setFeedback({ type: 'success', text: `${docType.replace('_', ' ')} created successfully.` });
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create document.' });
    }
  };

  const handleConvert = (docId: string, target: 'PROFORMA_INVOICE' | 'SALES_INVOICE') => {
    try {
      const res = convertCommercialDoc(docId, target);
      setFeedback({ type: 'success', text: `Document converted to ${target} (${res.documentNo})` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Conversion failed.' });
    }
  };

  const handleDelete = (docId: string) => {
    if (window.confirm('Are you sure you want to delete this commercial document?')) {
      const res = deleteCommercialDoc(docId);
      if (res.success) {
        setFeedback({ type: 'success', text: res.message || 'Deleted successfully.' });
      } else {
        setFeedback({ type: 'error', text: res.message || 'Failed to delete.' });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-red-600" />
            <span>Commercial Documents & Quotations</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quotations, Proforma Invoices, Credit Notes, Debit Notes & Payment Receipts with double-entry ledger integration.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              const imopDoc = commercialDocuments.find(d => d.documentNo === '65-2026' || d.id === 'doc-quote-imop') || commercialDocuments.find(d => d.documentType === 'QUOTATION');
              if (imopDoc) {
                setSelectedDoc(imopDoc);
              } else {
                setSelectedDoc({
                  id: 'doc-quote-imop-preview',
                  companyId: company?.id || 'comp-yasoth-01',
                  documentType: 'QUOTATION',
                  documentNo: '65-2026',
                  documentDate: '02-11-2026',
                  referenceNo: 'MAIL',
                  partyId: 'pty-cust-imop',
                  partyName: 'M/S IMOP PVT LTD',
                  partyAddress: 'SRICITY,ANDHRAPRADESH - 517646',
                  placeOfSupply: 'Andhra Pradesh (37)',
                  stateCode: '37',
                  lines: [],
                  subtotalTaxable: 3476000,
                  cgstRate: 0,
                  cgstAmount: 0,
                  sgstRate: 0,
                  sgstAmount: 0,
                  igstRate: 18,
                  igstAmount: 625680,
                  roundOff: 0,
                  grandTotal: 4101680,
                  amountPaid: 0,
                  outstandingBalance: 4101680,
                  status: 'ISSUED',
                  createdBy: 'P. NANDHA KUMAR',
                  createdAt: new Date().toISOString()
                } as any);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer min-h-[40px]"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Official IMOP Quotation (1000% Replica)</span>
          </button>

          <button
            onClick={() => {
              setLines([{ description: 'Machining boring scrap', quantity: 35, unit: 'ton', rate: 31000, gstRate: 18 }]);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Commercial Document</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 ml-4 font-bold">×</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
        {[
          { id: 'ALL', label: 'All Documents' },
          { id: 'QUOTATION', label: 'Quotations' },
          { id: 'PROFORMA_INVOICE', label: 'Proforma Invoices' },
          { id: 'CREDIT_NOTE', label: 'Credit Notes' },
          { id: 'DEBIT_NOTE', label: 'Debit Notes' },
          { id: 'PAYMENT_RECEIPT', label: 'Payment Receipts' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 rounded-xl border whitespace-nowrap transition-all min-h-[38px] ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by document number or customer / supplier name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 text-xs outline-none bg-transparent text-slate-800"
        />
      </div>

      {/* Mobile Card Layout (<= 768px) */}
      <div className="md:hidden flex flex-col gap-3">
        {filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
            No commercial documents found matching the filter.
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div key={doc.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{doc.documentNo}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      doc.documentType === 'QUOTATION' ? 'bg-amber-100 text-amber-800' :
                      doc.documentType === 'PROFORMA_INVOICE' ? 'bg-blue-100 text-blue-800' :
                      doc.documentType === 'CREDIT_NOTE' ? 'bg-purple-100 text-purple-800' :
                      doc.documentType === 'DEBIT_NOTE' ? 'bg-orange-100 text-orange-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {doc.documentType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">{doc.documentDate}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-sm text-slate-900 block">
                    {formatINR(doc.grandTotal)}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block mt-0.5">
                    {doc.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Party / Customer</span>
                <span className="font-bold text-slate-800 block">{doc.partyName}</span>
                <span className="text-[11px] text-slate-500 block truncate">{doc.partyAddress}</span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => setSelectedDoc(doc)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-xs font-bold transition-all min-h-[40px] cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>{doc.documentType === 'QUOTATION' ? 'View Official Quotation' : 'View Document'}</span>
                </button>

                {doc.documentType === 'QUOTATION' && (
                  <button
                    onClick={() => handleConvert(doc.id, 'PROFORMA_INVOICE')}
                    className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                    title="Convert to Proforma Invoice"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                  title="Delete Document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Documents Table (> 768px) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-3">Doc Number</th>
                <th className="p-3">Type</th>
                <th className="p-3">Date</th>
                <th className="p-3">Party Name</th>
                <th className="p-3">Taxable Value</th>
                <th className="p-3">GST Total</th>
                <th className="p-3">Grand Total</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    No commercial documents found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{doc.documentNo}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        doc.documentType === 'QUOTATION' ? 'bg-amber-100 text-amber-800' :
                        doc.documentType === 'PROFORMA_INVOICE' ? 'bg-blue-100 text-blue-800' :
                        doc.documentType === 'CREDIT_NOTE' ? 'bg-purple-100 text-purple-800' :
                        doc.documentType === 'DEBIT_NOTE' ? 'bg-orange-100 text-orange-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {doc.documentType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{doc.documentDate}</td>
                    <td className="p-3 font-semibold text-slate-800">{doc.partyName}</td>
                    <td className="p-3 text-slate-600 font-mono">{formatINR(doc.subtotalTaxable)}</td>
                    <td className="p-3 text-slate-600 font-mono">
                      {formatINR(doc.cgstAmount + doc.sgstAmount + doc.igstAmount)}
                    </td>
                    <td className="p-3 font-bold text-slate-900 font-mono">{formatINR(doc.grandTotal)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="p-1 hover:bg-slate-100 text-slate-600 rounded transition-colors cursor-pointer"
                          title="View / Print Document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {doc.documentType === 'QUOTATION' && (
                          <button
                            onClick={() => handleConvert(doc.id, 'PROFORMA_INVOICE')}
                            className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors cursor-pointer"
                            title="Convert to Proforma Invoice"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors cursor-pointer"
                          title="Delete Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document View / Print Modal */}
      {selectedDoc && selectedDoc.documentType === 'QUOTATION' ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="relative w-full max-w-4xl max-h-[100dvh] sm:max-h-[94vh] overflow-y-auto rounded-none sm:rounded-2xl">
            <QuotationRenderer
              document={selectedDoc}
              company={company}
              onClose={() => setSelectedDoc(null)}
            />
          </div>
        </div>
      ) : selectedDoc && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDoc(null)}
          title={`Commercial Document — ${selectedDoc.documentNo}`}
          maxWidth="3xl"
        >
          <div className="space-y-6 text-xs text-slate-800">
            {/* Header info */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h2 className="text-base font-black text-slate-900">{company.legalName}</h2>
                <p className="text-slate-500">{company.addressLine1}, {company.city}, {company.stateName} - {company.stateCode}</p>
                <p className="text-slate-600 font-mono mt-1 font-bold">GSTIN: {company.gstin}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white font-bold text-xs uppercase mb-2">
                  {selectedDoc.documentType.replace('_', ' ')}
                </span>
                <p className="font-bold text-slate-900 font-mono">{selectedDoc.documentNo}</p>
                <p className="text-slate-500">Date: {selectedDoc.documentDate}</p>
                {selectedDoc.referenceNo && (
                  <p className="text-slate-500">Ref: {selectedDoc.referenceNo}</p>
                )}
              </div>
            </div>

            {/* Bill to */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Party / Customer Details</span>
              <p className="font-bold text-slate-900 mt-0.5">{selectedDoc.partyName}</p>
              <p className="text-slate-600">{selectedDoc.partyAddress}</p>
              {selectedDoc.partyGstin && <p className="text-slate-600 font-mono mt-0.5">GSTIN: {selectedDoc.partyGstin}</p>}
              <p className="text-slate-500 mt-0.5">Place of Supply: {selectedDoc.placeOfSupply}</p>
            </div>

            {/* Line items */}
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                  <th className="p-2 border-r">#</th>
                  <th className="p-2 border-r">Item Description</th>
                  <th className="p-2 border-r">HSN/SAC</th>
                  <th className="p-2 border-r text-right">Quantity</th>
                  <th className="p-2 border-r text-right">Rate</th>
                  <th className="p-2 border-r text-right">Taxable</th>
                  <th className="p-2 border-r text-right">GST %</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedDoc.lines.map((l, idx) => (
                  <tr key={l.id}>
                    <td className="p-2 border-r text-slate-400">{idx + 1}</td>
                    <td className="p-2 border-r font-medium">{l.description}</td>
                    <td className="p-2 border-r font-mono">{l.hsnSac}</td>
                    <td className="p-2 border-r text-right font-mono">{l.quantity} {l.unit}</td>
                    <td className="p-2 border-r text-right font-mono">{formatINR(l.rate)}</td>
                    <td className="p-2 border-r text-right font-mono">{formatINR(l.taxableValue)}</td>
                    <td className="p-2 border-r text-right">{l.gstRate}%</td>
                    <td className="p-2 text-right font-mono font-bold">{formatINR(l.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Breakdown */}
            <div className="flex justify-end">
              <div className="w-72 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Taxable:</span>
                  <span>{formatINR(selectedDoc.subtotalTaxable)}</span>
                </div>
                {selectedDoc.cgstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>CGST ({selectedDoc.cgstRate}%):</span>
                    <span>{formatINR(selectedDoc.cgstAmount)}</span>
                  </div>
                )}
                {selectedDoc.sgstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>SGST ({selectedDoc.sgstRate}%):</span>
                    <span>{formatINR(selectedDoc.sgstAmount)}</span>
                  </div>
                )}
                {selectedDoc.igstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST ({selectedDoc.igstRate}%):</span>
                    <span>{formatINR(selectedDoc.igstAmount)}</span>
                  </div>
                )}
                {selectedDoc.roundOff !== 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Round-Off:</span>
                    <span>{formatINR(selectedDoc.roundOff)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900 text-sm">
                  <span>Grand Total:</span>
                  <span>{formatINR(selectedDoc.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Notes & Terms */}
            {selectedDoc.termsAndConditions && (
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-500">
                <span className="font-bold text-slate-700">Terms & Conditions: </span>
                {selectedDoc.termsAndConditions}
              </div>
            )}

            {/* Print & Close */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>

              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Commercial Document"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateDocument} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Document Type *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as CommercialDocType)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                >
                  <option value="QUOTATION">Quotation</option>
                  <option value="PROFORMA_INVOICE">Proforma Invoice</option>
                  <option value="CREDIT_NOTE">Credit Note</option>
                  <option value="DEBIT_NOTE">Debit Note</option>
                  <option value="PAYMENT_RECEIPT">Payment Receipt</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Customer / Supplier *</label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                >
                  <option value="">Select Party</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.legalName} ({p.partyType}) — {p.stateName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Document Date *</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Reference No</label>
                <input
                  type="text"
                  placeholder="e.g. PO-8902 or QT-01"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                />
              </div>
            </div>

            {/* Line items form */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-bold text-slate-700">Line Items</label>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="text-red-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 p-2 rounded-lg bg-slate-50">
                {lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-200">
                    <input
                      type="text"
                      placeholder="Item description"
                      value={l.description}
                      onChange={(e) => handleUpdateLine(idx, 'description', e.target.value)}
                      required
                      className="col-span-5 p-1 border rounded text-xs outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      step="any"
                      value={l.quantity}
                      onChange={(e) => handleUpdateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      required
                      className="col-span-2 p-1 border rounded text-xs outline-none"
                    />
                    <select
                      value={l.unit}
                      onChange={(e) => handleUpdateLine(idx, 'unit', e.target.value)}
                      className="col-span-2 p-1 border rounded text-xs outline-none"
                    >
                      <option value="TON">TON</option>
                      <option value="KG">KG</option>
                      <option value="PCS">PCS</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Rate"
                      step="any"
                      value={l.rate}
                      onChange={(e) => handleUpdateLine(idx, 'rate', parseFloat(e.target.value) || 0)}
                      required
                      className="col-span-2 p-1 border rounded text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      disabled={lines.length === 1}
                      className="col-span-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Notes / Narration</label>
              <textarea
                rows={2}
                placeholder="Optional notes or remarks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
              >
                Generate Document
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
