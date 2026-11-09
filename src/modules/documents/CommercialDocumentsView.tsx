import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { CommercialDocType, CommercialDocument } from '../../types/index.ts';
import { STANDARD_SCRAP_PRESETS } from '../../../backend/business-rules/commercialDocumentEngine.ts';
import { formatINR } from '../../utils/calculations.ts';
import { 
  FileCheck2, 
  FileText, 
  Plus, 
  Search, 
  ArrowRight, 
  Printer, 
  Trash2, 
  Eye, 
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  Layers
} from 'lucide-react';
import { Modal } from '../../components/common/Modal.tsx';
import { QuotationRenderer } from '../../components/documents/QuotationRenderer.tsx';

export const CommercialDocumentsView: React.FC = () => {
  const { 
    commercialDocuments, 
    parties, 
    company, 
    createCommercialDoc, 
    convertCommercialDoc, 
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
    { description: 'Machining boring scrap', quantity: 35, unit: 'ton', rate: 31000, gstRate: 18 }
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

  const openQuickBuilder = (presetType: CommercialDocType) => {
    setDocType(presetType);
    if (presetType === 'PURCHASE_ORDER') {
      const firstSupplier = parties.find((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH') || parties[0];
      setPartyId(firstSupplier?.id || '');
      setRefNo('VERBAL / YARD CONTRACT');
      setLines([
        { description: 'Heavy Melting Steel Scrap (HMS-1)', quantity: 10, unit: 'TON', rate: 32000, gstRate: 18 },
        { description: 'MS Turning & Boring Scrap', quantity: 5, unit: 'TON', rate: 26000, gstRate: 18 }
      ]);
      setNotes('Weighbridge weight at Yashoth Enterprises Yard (Gummidipoondi) is final.');
    } else {
      const firstCustomer = parties.find((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH') || parties[0];
      setPartyId(firstCustomer?.id || '');
      setRefNo('MAIL');
      setLines([
        { description: 'Machining boring scrap', quantity: 35, unit: 'ton', rate: 31000, gstRate: 18 },
        { description: 'MS scrap (HMS-1&2)', quantity: 25, unit: 'ton', rate: 37000, gstRate: 18 }
      ]);
      setNotes('Rates valid for immediate lifting. GST 18% extra as applicable.');
    }
    setIsCreateModalOpen(true);
  };

  const handleAddPresetItem = (preset: typeof STANDARD_SCRAP_PRESETS[number]) => {
    // If there is only 1 empty line, replace it; otherwise append
    if (lines.length === 1 && !lines[0].description.trim()) {
      setLines([{
        description: preset.description,
        quantity: preset.quantity,
        unit: preset.unit || 'ton',
        rate: preset.rate,
        gstRate: preset.gstRate
      }]);
    } else {
      setLines([
        ...lines,
        {
          description: preset.description,
          quantity: preset.quantity,
          unit: preset.unit || 'ton',
          rate: preset.rate,
          gstRate: preset.gstRate
        }
      ]);
    }
  };

  const handleLoadAllImopItems = () => {
    setLines(
      STANDARD_SCRAP_PRESETS.map((p) => ({
        description: p.description,
        quantity: p.quantity,
        unit: p.unit || 'ton',
        rate: p.rate,
        gstRate: p.gstRate
      }))
    );
  };

  const handleAddLine = () => {
    setLines([...lines, { description: '', quantity: 1, unit: 'ton', rate: 0, gstRate: 18 }]);
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

  // Live Modal Totals Calculation
  const selectedPartyObj = parties.find((p) => p.id === partyId);
  const isInterStatePreview = selectedPartyObj ? selectedPartyObj.stateCode !== company.stateCode : false;
  const previewTaxable = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);
  const previewGst = Math.round(previewTaxable * 0.18);
  const previewGrandTotal = Math.round(previewTaxable + previewGst);

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    const party = parties.find((p) => p.id === partyId);
    if (!party) {
      setFeedback({ type: 'error', text: 'Please select a valid Customer or Supplier.' });
      return;
    }

    try {
      const created = createCommercialDoc({
        party,
        documentType: docType,
        documentDate: docDate,
        dueDate: dueDate || undefined,
        referenceNo: refNo || undefined,
        lines,
        notes: notes || undefined
      });
      setFeedback({ type: 'success', text: `${docType.replace('_', ' ')} (${created.documentNo}) created! Opening print preview...` });
      setIsCreateModalOpen(false);
      setSelectedDoc(created);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create document.' });
    }
  };

  const handleConvert = (docId: string, target: 'PROFORMA_INVOICE' | 'SALES_INVOICE' | 'PURCHASE_INVOICE') => {
    try {
      const res = convertCommercialDoc(docId, target);
      setFeedback({ type: 'success', text: `Converted to ${target.replace('_', ' ')} (${res.documentNo}) successfully!` });
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

  const isLetterheadDoc = (type: CommercialDocType) =>
    type === 'QUOTATION' || type === 'PURCHASE_ORDER' || type === 'PROFORMA_INVOICE';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-red-600" />
            <span>Quotations & Purchase Orders (PO) Made Easy</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            1-Tap Scrap Quotations, Purchase Orders, Proforma Invoices & Credit/Debit Notes with authentic Yashoth Enterprises letterhead & zero-lag printing.
          </p>
        </div>

        {/* 1-Tap Action Buttons (Android-first 44px+ touch targets) */}
        <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 flex-wrap">
          <button
            onClick={() => openQuickBuilder('QUOTATION')}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Quick Quotation</span>
          </button>

          <button
            onClick={() => openQuickBuilder('PURCHASE_ORDER')}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer min-h-[44px]"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>+ Quick Purchase Order (PO)</span>
          </button>

          <button
            onClick={() => {
              const imopDoc = commercialDocuments.find(d => d.documentNo === '65-2026' || d.id === 'doc-quote-imop') || commercialDocuments.find(d => d.documentType === 'QUOTATION');
              if (imopDoc) {
                setSelectedDoc(imopDoc);
              }
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer min-h-[44px]"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Official IMOP Quotation (1000% Replica)</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 ml-4 font-bold text-base">×</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
        {[
          { id: 'ALL', label: `All (${commercialDocuments.length})` },
          { id: 'QUOTATION', label: `Quotations (${commercialDocuments.filter(d => d.documentType === 'QUOTATION').length})` },
          { id: 'PURCHASE_ORDER', label: `Purchase Orders (${commercialDocuments.filter(d => d.documentType === 'PURCHASE_ORDER').length})` },
          { id: 'PROFORMA_INVOICE', label: 'Proforma Invoices' },
          { id: 'CREDIT_NOTE', label: 'Credit Notes' },
          { id: 'DEBIT_NOTE', label: 'Debit Notes' },
          { id: 'PAYMENT_RECEIPT', label: 'Payment Receipts' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl border whitespace-nowrap transition-all min-h-[42px] cursor-pointer ${
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
          placeholder="Search by Quotation #, PO #, or Customer / Supplier name..."
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
            <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm text-slate-900">{doc.documentNo}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      doc.documentType === 'QUOTATION' ? 'bg-amber-100 text-amber-800' :
                      doc.documentType === 'PURCHASE_ORDER' ? 'bg-indigo-100 text-indigo-800' :
                      doc.documentType === 'PROFORMA_INVOICE' ? 'bg-blue-100 text-blue-800' :
                      doc.documentType === 'CREDIT_NOTE' ? 'bg-purple-100 text-purple-800' :
                      doc.documentType === 'DEBIT_NOTE' ? 'bg-orange-100 text-orange-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {doc.documentType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Date: {doc.documentDate} {doc.referenceNo ? `· Ref: ${doc.referenceNo}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-sm text-slate-900 block">
                    {formatINR(doc.grandTotal)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block mt-0.5">
                    {doc.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  {doc.documentType === 'PURCHASE_ORDER' ? 'Supplier / Vendor' : 'Customer / Party'}
                </span>
                <span className="font-bold text-slate-800 block">{doc.partyName}</span>
                <span className="text-[11px] text-slate-500 block truncate">{doc.partyAddress}</span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => setSelectedDoc(doc)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold transition-all min-h-[44px] cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {doc.documentType === 'QUOTATION'
                      ? 'View / Print Quotation'
                      : doc.documentType === 'PURCHASE_ORDER'
                      ? 'View / Print PO'
                      : 'View / Print'}
                  </span>
                </button>

                {doc.documentType === 'QUOTATION' && (
                  <button
                    onClick={() => handleConvert(doc.id, 'PROFORMA_INVOICE')}
                    className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl min-h-[44px] flex items-center justify-center gap-1 text-[11px] font-bold cursor-pointer"
                    title="Convert Quotation to Proforma Invoice"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Proforma</span>
                  </button>
                )}

                {doc.documentType === 'PURCHASE_ORDER' && (
                  <button
                    onClick={() => handleConvert(doc.id, 'PURCHASE_INVOICE')}
                    className="px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl min-h-[44px] flex items-center justify-center gap-1 text-[11px] font-bold cursor-pointer"
                    title="Convert PO to Purchase Bill"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>To Bill</span>
                  </button>
                )}

                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
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
                <th className="p-3 text-right">Taxable Value</th>
                <th className="p-3 text-right">GST Total</th>
                <th className="p-3 text-right">Grand Total</th>
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
                    <td className="p-3 font-mono font-bold text-slate-900">{doc.documentNo}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        doc.documentType === 'QUOTATION' ? 'bg-amber-100 text-amber-800' :
                        doc.documentType === 'PURCHASE_ORDER' ? 'bg-indigo-100 text-indigo-800' :
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
                    <td className="p-3 text-right text-slate-600 font-mono">{formatINR(doc.subtotalTaxable)}</td>
                    <td className="p-3 text-right text-slate-600 font-mono">
                      {formatINR(doc.cgstAmount + doc.sgstAmount + doc.igstAmount)}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900 font-mono">{formatINR(doc.grandTotal)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="View / Print A4 Document"
                        >
                          <Printer className="w-3.5 h-3.5 text-red-400" />
                          <span>View / Print</span>
                        </button>
                        {doc.documentType === 'QUOTATION' && (
                          <button
                            onClick={() => handleConvert(doc.id, 'PROFORMA_INVOICE')}
                            className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Convert to Proforma Invoice"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Proforma</span>
                          </button>
                        )}
                        {doc.documentType === 'PURCHASE_ORDER' && (
                          <button
                            onClick={() => handleConvert(doc.id, 'PURCHASE_INVOICE')}
                            className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Convert PO to Purchase Invoice"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>To Bill</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
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
      {selectedDoc && isLetterheadDoc(selectedDoc.documentType) ? (
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

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Party / Customer Details</span>
              <p className="font-bold text-slate-900 mt-0.5">{selectedDoc.partyName}</p>
              <p className="text-slate-600">{selectedDoc.partyAddress}</p>
              {selectedDoc.partyGstin && <p className="text-slate-600 font-mono mt-0.5">GSTIN: {selectedDoc.partyGstin}</p>}
              <p className="text-slate-500 mt-0.5">Place of Supply: {selectedDoc.placeOfSupply}</p>
            </div>

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
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900 text-sm">
                  <span>Grand Total:</span>
                  <span>{formatINR(selectedDoc.grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold min-h-[42px]"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>

              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold min-h-[42px]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Easy Quotation & Purchase Order Builder Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
          title={
            docType === 'QUOTATION'
              ? 'Quick Scrap Quotation Builder'
              : docType === 'PURCHASE_ORDER'
              ? 'Quick Purchase Order (PO) Builder'
              : 'Create Commercial Document'
          }
          subtitle="Tap any scrap preset chip below to add items in 1 click, or load all 11 official IMOP scrap items automatically."
          maxWidth="3xl"
        >
          <form onSubmit={handleCreateDocument} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Document Type *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as CommercialDocType)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none font-bold text-slate-900 bg-white min-h-[44px]"
                >
                  <option value="QUOTATION">Quotation (Sales / Scrap Offer)</option>
                  <option value="PURCHASE_ORDER">Purchase Order (PO to Supplier)</option>
                  <option value="PROFORMA_INVOICE">Proforma Invoice</option>
                  <option value="CREDIT_NOTE">Credit Note</option>
                  <option value="DEBIT_NOTE">Debit Note</option>
                  <option value="PAYMENT_RECEIPT">Payment Receipt</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {docType === 'PURCHASE_ORDER' ? 'Select Supplier / Vendor *' : 'Select Customer / Party *'}
                </label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none font-bold text-slate-900 bg-white min-h-[44px]"
                >
                  <option value="">— Select Party —</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.legalName} ({p.partyType}) — {p.stateName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Document Date *</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Valid Until / Delivery Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Reference (e.g. MAIL / PO)</label>
                <input
                  type="text"
                  placeholder="e.g. MAIL or VERBAL"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none min-h-[44px]"
                />
              </div>
            </div>

            {/* 1-Tap Scrap Material Preset Chips */}
            <div className="p-3 bg-slate-900 text-white rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  1-Tap Scrap Material Presets (Click to Add Row)
                </span>
                <button
                  type="button"
                  onClick={handleLoadAllImopItems}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Layers className="w-3 h-3" />
                  <span>Load All 11 IMOP Scrap Items</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {STANDARD_SCRAP_PRESETS.slice(0, 8).map((preset) => (
                  <button
                    key={preset.hsnSac}
                    type="button"
                    onClick={() => handleAddPresetItem(preset)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white rounded-lg text-[10px] font-semibold border border-slate-700 transition-colors cursor-pointer"
                  >
                    + {preset.description} (₹{preset.rate.toLocaleString('en-IN')}/{preset.unit})
                  </button>
                ))}
              </div>
            </div>

            {/* Line items form */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-bold text-slate-800 uppercase">
                  Line Items ({lines.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-3 py-1 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 flex items-center gap-1 text-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Custom Row
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-200 p-2.5 rounded-xl bg-slate-50">
                {lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="col-span-12 sm:col-span-5">
                      <input
                        type="text"
                        placeholder="Item description"
                        value={l.description}
                        onChange={(e) => handleUpdateLine(idx, 'description', e.target.value)}
                        required
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        placeholder="Qty"
                        step="any"
                        value={l.quantity}
                        onChange={(e) => handleUpdateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        required
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-right outline-none"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <select
                        value={l.unit}
                        onChange={(e) => handleUpdateLine(idx, 'unit', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none bg-white"
                      >
                        <option value="ton">ton</option>
                        <option value="TON">TON</option>
                        <option value="kg">kg</option>
                        <option value="KG">KG</option>
                        <option value="lot">lot</option>
                        <option value="PCS">PCS</option>
                      </select>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        placeholder="Rate"
                        step="any"
                        value={l.rate}
                        onChange={(e) => handleUpdateLine(idx, 'rate', parseFloat(e.target.value) || 0)}
                        required
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-right outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={lines.length === 1}
                        className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Totals Preview */}
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-600">
                <span className="font-bold text-slate-800">Tax Regime: </span>
                {isInterStatePreview ? 'Inter-State (IGST 18%)' : 'Intra-State (CGST 9% + SGST 9%)'}
              </div>
              <div className="flex items-center gap-4 font-mono text-xs">
                <span>Taxable: <strong>{formatINR(previewTaxable)}</strong></span>
                <span>GST (18%): <strong>{formatINR(previewGst)}</strong></span>
                <span className="text-sm font-black text-red-600">Total: {formatINR(previewGrandTotal)}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Terms / Narration</label>
              <textarea
                rows={2}
                placeholder="Optional notes, delivery schedule, or payment terms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Generate & Preview Document</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
