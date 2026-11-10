import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Invoice, InvoiceLine, Party, Material } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { InvoiceRenderer } from '../../components/invoice/InvoiceRenderer.tsx';
import { EwayBillRenderer } from '../../components/invoice/EwayBillRenderer.tsx';
import { verifyGstin } from '../../../backend/business-rules/ewayBillEngine.ts';
import { 
  formatINR, 
  formatWeight, 
  formatTon, 
  roundTo2, 
  roundTo3, 
  calcGstBreakdown, 
  numberToIndianWords, 
  kgToTon, 
  tonToKg 
} from '../../utils/calculations.ts';
import { 
  FileText, 
  Printer, 
  Eye, 
  Search, 
  Plus, 
  Trash2, 
  Edit2,
  CheckCircle, 
  AlertCircle, 
  ArrowRightLeft, 
  Calculator,
  ShieldCheck,
  Truck,
  Upload,
  FileUp,
  Download
} from 'lucide-react';

interface EditableInvoiceLine {
  id: string;
  materialName: string;
  hsnSac: string;
  unit: 'KG' | 'TON';
  quantity: number;
  rate: number;
  taxableValue: number;
}

export const InvoicesView: React.FC = () => {
  const { 
    invoices, 
    company, 
    parties, 
    materials, 
    vehicles, 
    vehicleDocuments, 
    createTaxInvoice, 
    updateTaxInvoice, 
    deleteTaxInvoice,
    uploadedDocuments,
    createUploadedDocument,
    deleteUploadedDocument
  } = useERP();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [ewayBillInvoice, setEwayBillInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upload Previous Invoice state
  const [isUploadInvoiceModalOpen, setIsUploadInvoiceModalOpen] = useState(false);
  const [uploadInvRefNo, setUploadInvRefNo] = useState('');
  const [uploadInvTitle, setUploadInvTitle] = useState('');
  const [uploadInvParty, setUploadInvParty] = useState('TEJAS STEEL');
  const [uploadInvDate, setUploadInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadInvAmount, setUploadInvAmount] = useState<number>(0);
  const [uploadInvNotes, setUploadInvNotes] = useState('');
  const [uploadInvFileData, setUploadInvFileData] = useState<{
    name: string;
    type: string;
    size: number;
    dataUrl: string;
  } | null>(null);

  // Form State for creating direct Tax Invoice
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [customCustomerName, setCustomCustomerName] = useState('TEJAS STEEL');
  const [billingAddress, setBillingAddress] = useState('SERV.NO: 596/3B1B, SHOP.NO.7, G.N.T ROAD, ALINJIVAKKAM, CHENNAI, Tamil Nadu - 600067');
  const [shippingAddress, setShippingAddress] = useState('SERV.NO: 596/3B1B, SHOP.NO.7, G.N.T ROAD, ALINJIVAKKAM, CHENNAI, Tamil Nadu - 600067');
  const [customerGstin, setCustomerGstin] = useState('33ADFP06345L1ZA');
  const [customerStateCode, setCustomerStateCode] = useState('33');
  const [customerStateName, setCustomerStateName] = useState('Tamil Nadu');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [vehicleReg, setVehicleReg] = useState('TN 05 Y 1936');
  const [destination, setDestination] = useState('Alinjivakkam, Chennai');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isInterState, setIsInterState] = useState(false);

  // Multi-line scrap materials state
  const [lines, setLines] = useState<EditableInvoiceLine[]>([
    {
      id: 'line-1',
      materialName: 'MS SCRAP',
      hsnSac: '7204',
      unit: 'KG',
      quantity: 4430,
      rate: 28.00,
      taxableValue: 124040.00,
    },
  ]);

  const customerParties = parties.filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH');

  const uploadedInvoiceDocs = uploadedDocuments.filter((d) => d.category === 'PREVIOUS_INVOICE');

  const filteredInvoices = invoices.filter((inv) => {
    if (filterStatus !== 'ALL' && filterStatus !== 'UPLOADED_INVOICES' && inv.paymentStatus !== filterStatus) return false;
    if (searchTerm) {
      const matchNo = inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCust = inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchNo || matchCust;
    }
    return true;
  });

  const handleUploadInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadInvFileData({
        name: file.name,
        type: file.type || 'application/pdf',
        size: file.size,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUploadedInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadInvRefNo.trim()) {
      alert('Please enter an Invoice Reference Number.');
      return;
    }
    createUploadedDocument({
      category: 'PREVIOUS_INVOICE',
      referenceNo: uploadInvRefNo.trim(),
      title: uploadInvTitle.trim() || `Previous Invoice #${uploadInvRefNo.trim()}`,
      partyName: uploadInvParty.trim() || 'TEJAS STEEL',
      documentDate: uploadInvDate,
      amount: uploadInvAmount || 0,
      fileName: uploadInvFileData?.name || 'Scanned_Invoice.pdf',
      fileType: uploadInvFileData?.type || 'application/pdf',
      fileSize: uploadInvFileData?.size || 150000,
      fileDataUrl: uploadInvFileData?.dataUrl || '',
      notes: uploadInvNotes.trim(),
    });
    setFeedbackMsg({
      type: 'success',
      text: `Previous Invoice (${uploadInvRefNo}) uploaded and stored safely!`,
    });
    setIsUploadInvoiceModalOpen(false);
    setUploadInvRefNo('');
    setUploadInvFileData(null);
  };

  const handleOpenCreateModal = () => {
    const nextSeq = invoices.length + 1;
    setInvoiceNo(String(nextSeq).padStart(2, '0'));
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setEwayBillNo(`5417 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`);
    setVehicleReg('TN 05 Y 1936');
    setDestination('Alinjivakkam, Chennai');
    setDeliveryNote('');
    setIsInterState(false);

    // Pre-fill Tejas Steel if available, or first customer
    const tejas = parties.find((p) => p.legalName.toUpperCase().includes('TEJAS'));
    if (tejas) {
      setSelectedPartyId(tejas.id);
      setCustomCustomerName(tejas.legalName);
      setBillingAddress(`${tejas.addressLine1}, ${tejas.city}, ${tejas.stateName}`);
      setShippingAddress(`${tejas.addressLine1}, ${tejas.city}, ${tejas.stateName}`);
      setCustomerGstin(tejas.gstin || '33ADFP06345L1ZA');
      setCustomerStateCode(tejas.stateCode || '33');
      setCustomerStateName(tejas.stateName || 'Tamil Nadu');
    } else if (customerParties.length > 0) {
      const first = customerParties[0];
      setSelectedPartyId(first.id);
      setCustomCustomerName(first.legalName);
      setBillingAddress(`${first.addressLine1}, ${first.city}, ${first.stateName}`);
      setShippingAddress(`${first.addressLine1}, ${first.city}, ${first.stateName}`);
      setCustomerGstin(first.gstin || '');
      setCustomerStateCode(first.stateCode || '33');
      setCustomerStateName(first.stateName || 'Tamil Nadu');
    }

    setLines([
      {
        id: 'line-' + Math.random().toString(36).substring(2, 7),
        materialName: 'MS SCRAP',
        hsnSac: '7204',
        unit: 'KG',
        quantity: 4430,
        rate: 28.00,
        taxableValue: 124040.00,
      },
    ]);

    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setSelectedPartyId(inv.customerPartyId || '');
    setCustomCustomerName(inv.customerName);
    setBillingAddress(inv.billingAddress);
    setShippingAddress(inv.shippingAddress);
    setCustomerGstin(inv.customerGstin || '');
    setCustomerStateCode(inv.customerStateCode || '33');
    setCustomerStateName(inv.customerStateName || 'Tamil Nadu');
    setInvoiceNo(inv.invoiceNo);
    setInvoiceDate(inv.invoiceDate);
    setEwayBillNo(inv.ewayBillNo || '');
    setVehicleReg(inv.vehicleRegistration || 'TN 05 Y 1936');
    setDestination(inv.destination || 'Alinjivakkam, Chennai');
    setDeliveryNote(inv.deliveryNote || '');
    setIsInterState(inv.igstAmount > 0);

    setLines(
      inv.lines.map((l) => ({
        id: l.id,
        materialName: l.descriptionOfGoods,
        hsnSac: l.hsnSac,
        unit: (l.unit as 'KG' | 'TON') || 'KG',
        quantity: l.quantity,
        rate: l.rate,
        taxableValue: l.taxableValue,
      }))
    );

    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingInvoice(null);
  };

  const handleDeleteInvoice = (inv: Invoice) => {
    if (window.confirm(`Are you sure you want to delete Tax Invoice #${inv.invoiceNo} for ${inv.customerName}?`)) {
      const res = deleteTaxInvoice(inv.id);
      if (res.success) {
        if (selectedInvoice?.id === inv.id) {
          setSelectedInvoice(null);
        }
        setFeedbackMsg({ type: 'success', text: res.message || 'Invoice deleted.' });
        setTimeout(() => setFeedbackMsg(null), 5000);
      } else {
        alert(res.message);
      }
    }
  };

  const handleCustomerChange = (partyId: string) => {
    setSelectedPartyId(partyId);
    const p = parties.find((item) => item.id === partyId);
    if (p) {
      setCustomCustomerName(p.legalName);
      setBillingAddress(`${p.addressLine1}, ${p.city}, ${p.stateName}`);
      setShippingAddress(`${p.addressLine1}, ${p.city}, ${p.stateName}`);
      setCustomerGstin(p.gstin || '');
      setCustomerStateCode(p.stateCode || '33');
      setCustomerStateName(p.stateName || 'Tamil Nadu');
      setIsInterState(p.stateCode !== company.stateCode);
    }
  };

  // Line item handlers
  const handleAddLine = () => {
    const newLine: EditableInvoiceLine = {
      id: 'line-' + Math.random().toString(36).substring(2, 7),
      materialName: materials[0]?.name || 'HEAVY MELTING SCRAP (HMS-1)',
      hsnSac: '7204',
      unit: 'KG',
      quantity: 1000,
      rate: 32.00,
      taxableValue: 32000.00,
    };
    setLines([...lines, newLine]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineUpdate = (idx: number, updates: Partial<EditableInvoiceLine>) => {
    setLines((prev) => {
      const copy = [...prev];
      const cur = { ...copy[idx], ...updates };

      // Recalculate taxable value
      // Rate is per unit (per KG or per TON)
      cur.taxableValue = roundTo2(cur.quantity * cur.rate);
      copy[idx] = cur;
      return copy;
    });
  };

  const handleUnitToggle = (idx: number) => {
    setLines((prev) => {
      const copy = [...prev];
      const cur = copy[idx];
      if (cur.unit === 'KG') {
        // Convert KG to TON
        const newQty = kgToTon(cur.quantity);
        const newRate = roundTo2(cur.rate * 1000);
        copy[idx] = {
          ...cur,
          unit: 'TON',
          quantity: newQty,
          rate: newRate,
          taxableValue: roundTo2(newQty * newRate),
        };
      } else {
        // Convert TON to KG
        const newQty = tonToKg(cur.quantity);
        const newRate = roundTo2(cur.rate / 1000);
        copy[idx] = {
          ...cur,
          unit: 'KG',
          quantity: newQty,
          rate: newRate,
          taxableValue: roundTo2(newQty * newRate),
        };
      }
      return copy;
    });
  };

  // Calculations
  const taxableSum = lines.reduce((sum, l) => sum + (l.taxableValue || 0), 0);
  const gstBreakdown = calcGstBreakdown(taxableSum, 18, isInterState);
  const totalTax = gstBreakdown.cgstAmount + gstBreakdown.sgstAmount + gstBreakdown.igstAmount;

  const handleCreateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCustomerName.trim() || lines.length === 0) return;

    const formattedInvoiceLines: InvoiceLine[] = lines.map((l, index) => ({
      id: l.id.startsWith('invl-') ? l.id : ('invl-' + Math.random().toString(36).substring(2, 9)),
      serialNo: index + 1,
      descriptionOfGoods: l.materialName.toUpperCase(),
      hsnSac: l.hsnSac || '7204',
      unit: l.unit,
      quantity: roundTo3(l.quantity),
      rate: roundTo2(l.rate),
      taxableValue: roundTo2(l.taxableValue),
    }));

    if (editingInvoice) {
      updateTaxInvoice(editingInvoice.id, {
        invoiceNo: invoiceNo.trim() || editingInvoice.invoiceNo,
        invoiceDate: invoiceDate,
        customerPartyId: selectedPartyId || editingInvoice.customerPartyId,
        customerName: customCustomerName.trim().toUpperCase(),
        billingAddress: billingAddress.trim(),
        shippingAddress: shippingAddress.trim(),
        customerGstin: customerGstin.trim().toUpperCase(),
        customerStateName: customerStateName.trim(),
        customerStateCode: customerStateCode.trim(),
        placeOfSupply: `${customerStateName.trim()} (${customerStateCode.trim()})`,
        ewayBillNo: ewayBillNo.trim() || undefined,
        deliveryNote: deliveryNote.trim() || undefined,
        vehicleRegistration: vehicleReg.trim().toUpperCase() || undefined,
        destination: destination.trim() || undefined,
        lines: formattedInvoiceLines,
        subtotalTaxable: gstBreakdown.taxableAmount,
        cgstRate: gstBreakdown.cgstRate,
        cgstAmount: gstBreakdown.cgstAmount,
        sgstRate: gstBreakdown.sgstRate,
        sgstAmount: gstBreakdown.sgstAmount,
        igstRate: gstBreakdown.igstRate,
        igstAmount: gstBreakdown.igstAmount,
        roundOff: gstBreakdown.roundOff,
        grandTotal: gstBreakdown.grandTotal,
        amountInWords: numberToIndianWords(gstBreakdown.grandTotal),
        taxAmountInWords: numberToIndianWords(totalTax),
        outstandingBalance: Math.max(0, gstBreakdown.grandTotal - editingInvoice.amountPaid),
      });

      const updatedInv: Invoice = {
        ...editingInvoice,
        invoiceNo: invoiceNo.trim() || editingInvoice.invoiceNo,
        invoiceDate,
        customerPartyId: selectedPartyId || editingInvoice.customerPartyId,
        customerName: customCustomerName.trim().toUpperCase(),
        billingAddress: billingAddress.trim(),
        shippingAddress: shippingAddress.trim(),
        customerGstin: customerGstin.trim().toUpperCase(),
        customerStateName: customerStateName.trim(),
        customerStateCode: customerStateCode.trim(),
        placeOfSupply: `${customerStateName.trim()} (${customerStateCode.trim()})`,
        ewayBillNo: ewayBillNo.trim() || undefined,
        deliveryNote: deliveryNote.trim() || undefined,
        vehicleRegistration: vehicleReg.trim().toUpperCase() || undefined,
        destination: destination.trim() || undefined,
        lines: formattedInvoiceLines,
        subtotalTaxable: gstBreakdown.taxableAmount,
        cgstRate: gstBreakdown.cgstRate,
        cgstAmount: gstBreakdown.cgstAmount,
        sgstRate: gstBreakdown.sgstRate,
        sgstAmount: gstBreakdown.sgstAmount,
        igstRate: gstBreakdown.igstRate,
        igstAmount: gstBreakdown.igstAmount,
        roundOff: gstBreakdown.roundOff,
        grandTotal: gstBreakdown.grandTotal,
        amountInWords: numberToIndianWords(gstBreakdown.grandTotal),
        taxAmountInWords: numberToIndianWords(totalTax),
      };

      setIsCreateModalOpen(false);
      setEditingInvoice(null);
      setSelectedInvoice(updatedInv);
      setFeedbackMsg({
        type: 'success',
        text: `Tax Invoice #${updatedInv.invoiceNo} successfully updated!`,
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
      return;
    }

    const newInv = createTaxInvoice({
      invoiceNo: invoiceNo.trim() || `${company.invoicePrefix || 'YE/'}26-27/${String(invoices.length + 1).padStart(4, '0')}`,
      invoiceDate: invoiceDate,
      customerPartyId: selectedPartyId || 'pty-cust-manual',
      customerName: customCustomerName.trim().toUpperCase(),
      billingAddress: billingAddress.trim(),
      shippingAddress: shippingAddress.trim(),
      customerGstin: customerGstin.trim().toUpperCase(),
      customerStateName: customerStateName.trim(),
      customerStateCode: customerStateCode.trim(),
      placeOfSupply: `${customerStateName.trim()} (${customerStateCode.trim()})`,
      ewayBillNo: ewayBillNo.trim() || undefined,
      deliveryNote: deliveryNote.trim() || undefined,
      vehicleRegistration: vehicleReg.trim().toUpperCase() || undefined,
      destination: destination.trim() || undefined,
      lines: formattedInvoiceLines,
      subtotalTaxable: gstBreakdown.taxableAmount,
      cgstRate: gstBreakdown.cgstRate,
      cgstAmount: gstBreakdown.cgstAmount,
      sgstRate: gstBreakdown.sgstRate,
      sgstAmount: gstBreakdown.sgstAmount,
      igstRate: gstBreakdown.igstRate,
      igstAmount: gstBreakdown.igstAmount,
      roundOff: gstBreakdown.roundOff,
      grandTotal: gstBreakdown.grandTotal,
      amountInWords: numberToIndianWords(gstBreakdown.grandTotal),
      taxAmountInWords: numberToIndianWords(totalTax),
      paymentStatus: 'UNPAID',
      amountPaid: 0,
      outstandingBalance: gstBreakdown.grandTotal,
      immutableSnapshotJson: '',
      isCancelled: false,
      createdBy: 'Yasoth Admin',
    });

    setIsCreateModalOpen(false);
    setSelectedInvoice(newInv);
    setFeedbackMsg({
      type: 'success',
      text: `Tax Invoice #${newInv.invoiceNo} successfully generated! Ready to Print & Dispatch.`,
    });
    setTimeout(() => setFeedbackMsg(null), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>GST Tax Invoices & e-Way Bills</span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 rounded-full">
              Verified Format
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rendered with YASHOTH ENTERPRISES letterhead, multi-line scrap materials, Ton/KG conversion, and inbuild GST calculations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsUploadInvoiceModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer min-h-[44px]"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            <span>+ Upload Previous Invoice</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Tax Invoice</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'UPLOADED_INVOICES'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                filterStatus === status
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status === 'UPLOADED_INVOICES' ? `Uploaded Invoices (${uploadedInvoiceDocs.length})` : status}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice #, customer, e-way..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Mobile Card Layout (<= 768px) — Android-First 44px+ Touch Targets */}
      <div className="md:hidden flex flex-col gap-3">
        {filterStatus === 'UPLOADED_INVOICES' ? (
          uploadedInvoiceDocs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
              No uploaded historical invoices found. Tap "+ Upload Previous Invoice" above to add one.
            </div>
          ) : (
            uploadedInvoiceDocs.map((doc) => (
              <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900">{doc.referenceNo}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        HISTORICAL INVOICE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Date: {doc.documentDate} · Party: {doc.partyName}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-slate-900 block">
                      {formatINR(doc.amount || 0)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 block">
                      {doc.fileName ? 'FILE ATTACHED' : 'RECORD'}
                    </span>
                  </div>
                </div>

                {doc.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {doc.notes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  {doc.fileDataUrl ? (
                    <a
                      href={doc.fileDataUrl}
                      download={doc.fileName}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold min-h-[44px] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download File</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No File Uploaded</span>
                  )}
                  <button
                    onClick={() => deleteUploadedDocument(doc.id)}
                    className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    title="Delete Uploaded Invoice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
            No issued invoices found. Tap "+ Create Tax Invoice" above.
          </div>
        ) : (
          filteredInvoices.map((inv) => (
            <div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-slate-900">#{inv.invoiceNo}</span>
                    <StatusBadge status={inv.paymentStatus} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Date: {inv.invoiceDate} · {inv.lines.length} {inv.lines.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-sm text-slate-900 block">
                    {formatINR(inv.grandTotal)}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 block">
                    GST: {formatINR(inv.cgstAmount + inv.sgstAmount + inv.igstAmount)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Buyer</span>
                  <span className="font-bold text-slate-900 block truncate">{inv.customerName}</span>
                  <span className="text-[10px] font-mono text-slate-500 block">{inv.customerGstin || 'Unregistered'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Vehicle & e-Way</span>
                  <span className="font-mono font-bold text-slate-800 block">{inv.vehicleRegistration || 'TN 05 Y 1936'}</span>
                  <span className="text-[10px] font-mono text-emerald-700 font-semibold block">{inv.ewayBillNo || 'Ready to Generate'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => setSelectedInvoice(inv)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold min-h-[44px] cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Invoice A4 / Print</span>
                </button>
                <button
                  onClick={() => setEwayBillInvoice(inv)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold min-h-[44px] cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>e-Way Bill / JSON</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEditModal(inv)}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold flex items-center gap-1 min-h-[38px] cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Invoice</span>
                </button>
                <button
                  onClick={() => handleDeleteInvoice(inv)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold flex items-center gap-1 min-h-[38px] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Invoices List (> 768px) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Dated</th>
                <th className="py-3 px-4">Buyer (Bill to)</th>
                <th className="py-3 px-4">Vehicle & e-Way Bill</th>
                <th className="py-3 px-4 text-right">Taxable Value</th>
                <th className="py-3 px-4 text-right">GST (18%)</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filterStatus === 'UPLOADED_INVOICES' ? (
                uploadedInvoiceDocs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                      No uploaded historical invoices found. Click "+ Upload Previous Invoice" to add one.
                    </td>
                  </tr>
                ) : (
                  uploadedInvoiceDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 text-xs">{doc.referenceNo}</td>
                      <td className="py-3 px-4 text-slate-600">{doc.documentDate}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{doc.partyName}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{doc.notes || 'Previous Scanned Invoice'}</td>
                      <td className="py-3 px-4 text-right text-slate-400 font-mono">-</td>
                      <td className="py-3 px-4 text-right text-slate-400 font-mono">-</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-xs">
                        {formatINR(doc.amount || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          UPLOADED
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {doc.fileDataUrl ? (
                            <a
                              href={doc.fileDataUrl}
                              download={doc.fileName}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Download Attached Document"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No File</span>
                          )}
                          <button
                            onClick={() => deleteUploadedDocument(doc.id)}
                            className="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors cursor-pointer"
                            title="Delete Uploaded Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    No issued invoices found. Click "+ Create Tax Invoice" to create a new multi-line invoice.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 block text-xs">{inv.invoiceNo}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {inv.lines.length} {inv.lines.length === 1 ? 'item' : 'items'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{inv.invoiceDate}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{inv.customerName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{inv.customerGstin || 'Unregistered'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col text-[10px]">
                        <span className="font-semibold text-slate-800">{inv.vehicleRegistration || 'TN 05 Y 1936'}</span>
                        <span className="font-mono text-slate-500">{inv.ewayBillNo || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">{formatINR(inv.subtotalTaxable)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatINR(inv.cgstAmount + inv.sgstAmount + inv.igstAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-xs">
                      {formatINR(inv.grandTotal)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={inv.paymentStatus} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          title="View Tax Invoice & e-Way Bill"
                        >
                          <Eye className="w-3.5 h-3.5 text-red-400" />
                          <span>View A4</span>
                        </button>
                        <button
                          onClick={() => setEwayBillInvoice(inv)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Generate Form GST EWB-01 & Download NIC JSON"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>e-Way Bill</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setTimeout(() => {
                              window.print();
                            }, 150);
                          }}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Instant 1-Click Print"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(inv)}
                          className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors cursor-pointer"
                          title="Edit Tax Invoice"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(inv)}
                          className="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors cursor-pointer"
                          title="Delete Tax Invoice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* CREATE / EDIT TAX INVOICE MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        title={editingInvoice ? `Edit Tax Invoice — #${editingInvoice.invoiceNo}` : "Create GST Tax Invoice"}
        subtitle={editingInvoice ? "Update multi-line scrap materials, rates, vehicle registration, and GST breakdown." : "Add multi-line scrap materials row-by-row with automatic Ton <-> KG conversions and inbuild GST calculations matching INVOICE_03.pdf."}
        maxWidth="6xl"
      >
        <form onSubmit={handleCreateInvoiceSubmit} className="space-y-5 text-xs">
          {/* Header & Customer Selection */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                1. Buyer & Invoice Details
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-semibold">Tax Type:</span>
                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="taxType"
                    checked={!isInterState}
                    onChange={() => setIsInterState(false)}
                  />
                  <span>Intra-State (CGST 9% + SGST 9%)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer ml-2">
                  <input
                    type="radio"
                    name="taxType"
                    checked={isInterState}
                    onChange={() => setIsInterState(true)}
                  />
                  <span>Inter-State (IGST 18%)</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Customer / Buyer</label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold text-slate-900"
                >
                  <option value="">— Or Enter Custom Buyer Below —</option>
                  {customerParties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.legalName} ({p.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Buyer Legal Name *</label>
                <input
                  type="text"
                  value={customCustomerName}
                  onChange={(e) => setCustomCustomerName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg uppercase font-semibold"
                  placeholder="e.g. TEJAS STEEL"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Buyer GSTIN / UIN</label>
                <input
                  type="text"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono uppercase"
                  placeholder="33ADFP06345L1ZA"
                />
                {customerGstin.trim().length > 0 && (() => {
                  const gstCheck = verifyGstin(customerGstin);
                  return (
                    <span className={`block text-[10px] font-bold mt-1 ${
                      gstCheck.isChecksumValid ? 'text-emerald-700' : gstCheck.isValidFormat ? 'text-amber-700' : 'text-red-600'
                    }`}>
                      {gstCheck.isChecksumValid
                        ? `✓ Verified GSTIN (${gstCheck.stateName} - ${gstCheck.stateCode} · ${gstCheck.entityTypeDescription})`
                        : gstCheck.isValidFormat
                        ? `⚠ Format OK (${gstCheck.stateName}) — Checksum digit mismatch`
                        : `✕ Invalid GSTIN Format (${gstCheck.registrationStatus})`}
                    </span>
                  );
                })()}
              </div>

              <div className="col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Billing & Shipping Address</label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => {
                    setBillingAddress(e.target.value);
                    setShippingAddress(e.target.value);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="Street, Area, City, State - Pincode"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">State Code</label>
                  <input
                    type="text"
                    value={customerStateCode}
                    onChange={(e) => setCustomerStateCode(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-center"
                    placeholder="33"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">State Name</label>
                  <input
                    type="text"
                    value={customerStateName}
                    onChange={(e) => setCustomerStateName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    placeholder="Tamil Nadu"
                  />
                </div>
              </div>
            </div>

            {/* Logistics & Invoice Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Invoice No. *</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                  placeholder="03"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">e-Way Bill No.</label>
                <input
                  type="text"
                  value={ewayBillNo}
                  onChange={(e) => setEwayBillNo(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  placeholder="5417 9765 5717"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Vehicle Registration</label>
                <input
                  type="text"
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono uppercase font-bold"
                  placeholder="TN 05 Y 1936"
                />
              </div>
            </div>
          </div>

          {/* 2. Multi-Line Scrap Materials Entry Grid ("next to next column / row-by-row") */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-red-400" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  2. Scrap Materials Line Items (Multi-Material Row-by-Row)
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Material Row</span>
              </button>
            </div>

            <div className="overflow-x-auto bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-2 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Description of Scrap Goods</th>
                    <th className="py-2.5 px-2 w-20 text-center">HSN/SAC</th>
                    <th className="py-2.5 px-3 w-32 text-center">Unit Mode</th>
                    <th className="py-2.5 px-3 w-32 text-right">Quantity / Weight</th>
                    <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2 w-16 text-center">Per</th>
                    <th className="py-2.5 px-3 w-32 text-right">Line Taxable (₹)</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-slate-50/80">
                      <td className="py-2 px-2 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Material selector or text */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={line.materialName}
                            onChange={(e) => handleLineUpdate(idx, { materialName: e.target.value })}
                            className="w-full p-1.5 border border-slate-300 rounded font-bold uppercase text-slate-900"
                            placeholder="e.g. MS SCRAP"
                            required
                          />
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                const m = materials.find((mat) => mat.id === e.target.value);
                                if (m) {
                                  handleLineUpdate(idx, {
                                    materialName: m.name,
                                    hsnSac: m.hsnCode || '7204',
                                    rate: line.unit === 'TON' ? m.defaultSalesRate * 1000 : m.defaultSalesRate,
                                  });
                                }
                              }
                            }}
                            className="p-1.5 border border-slate-300 rounded bg-slate-50 text-[10px]"
                            title="Pick from registered materials"
                          >
                            <option value="">Quick Pick</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* HSN */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={line.hsnSac}
                          onChange={(e) => handleLineUpdate(idx, { hsnSac: e.target.value })}
                          className="w-full p-1.5 border border-slate-300 rounded text-center font-mono"
                          placeholder="7204"
                        />
                      </td>

                      {/* Unit Mode Toggle (KG <-> TON) */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleUnitToggle(idx)}
                          className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold w-full transition-all border ${
                            line.unit === 'TON'
                              ? 'bg-amber-100 border-amber-300 text-amber-900'
                              : 'bg-blue-100 border-blue-300 text-blue-900'
                          }`}
                          title="Click to toggle between Metric Ton and Kilogram calculation"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>{line.unit === 'TON' ? 'TON / MT' : 'KILOGRAM (KG)'}</span>
                        </button>
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step={line.unit === 'TON' ? '0.001' : '1'}
                          value={line.quantity}
                          onChange={(e) => handleLineUpdate(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold text-right text-slate-900"
                          min="0"
                          required
                        />
                        <span className="block text-[9px] text-slate-400 text-right mt-0.5">
                          {line.unit === 'KG'
                            ? `(= ${kgToTon(line.quantity)} MT)`
                            : `(= ${tonToKg(line.quantity).toLocaleString('en-IN')} KG)`}
                        </span>
                      </td>

                      {/* Rate */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          value={line.rate}
                          onChange={(e) => handleLineUpdate(idx, { rate: parseFloat(e.target.value) || 0 })}
                          className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold text-right text-slate-900"
                          min="0"
                          required
                        />
                        <span className="block text-[9px] text-slate-400 text-right mt-0.5">
                          {line.unit === 'KG'
                            ? `(₹${(line.rate * 1000).toLocaleString('en-IN')}/Ton)`
                            : `(₹${(line.rate / 1000).toFixed(2)}/KG)`}
                        </span>
                      </td>

                      {/* Per */}
                      <td className="py-2 px-2 text-center font-bold text-slate-600">
                        {line.unit}
                      </td>

                      {/* Taxable Value */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                        ₹ {line.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Delete Action */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lines.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Inbuild GST & Totals Summary Panel */}
          <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">
                3. Amount in Words (Live Generation)
              </span>
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Amount in Words:</span>
                  <p className="font-extrabold text-slate-900 text-xs">
                    {numberToIndianWords(gstBreakdown.grandTotal)}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Tax Amount in Words:</span>
                  <p className="font-bold text-slate-700 text-xs">
                    {numberToIndianWords(totalTax)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between font-medium text-slate-600">
                <span>Taxable Value (Subtotal):</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹ {taxableSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {!isInterState ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Central Tax (CGST 9%):</span>
                    <span className="font-mono font-semibold">
                      ₹ {gstBreakdown.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>State Tax (SGST 9%):</span>
                    <span className="font-mono font-semibold">
                      ₹ {gstBreakdown.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>Integrated Tax (IGST 18%):</span>
                  <span className="font-mono font-semibold">
                    ₹ {gstBreakdown.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {gstBreakdown.roundOff !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Round Off:</span>
                  <span className="font-mono">
                    {gstBreakdown.roundOff < 0 ? `(-)${Math.abs(gstBreakdown.roundOff).toFixed(2)}` : gstBreakdown.roundOff.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t-2 border-slate-900 font-black text-sm text-slate-900">
                <span className="uppercase tracking-wider">Grand Total:</span>
                <span className="font-mono text-base text-red-600">
                  ₹ {gstBreakdown.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{editingInvoice ? 'Save & Update Tax Invoice' : 'Generate & View Tax Invoice'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice Renderer Modal (Full A4 Print & e-Way Bill Viewer) */}
      {selectedInvoice && (
        <Modal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`Tax Invoice #${selectedInvoice.invoiceNo} — ${selectedInvoice.customerName}`}
          subtitle="A4 Official Tax Invoice and e-Way Bill Document with 1-Click Print & PDF export."
          maxWidth="6xl"
        >
          <InvoiceRenderer
            invoice={selectedInvoice}
            company={company}
            onClose={() => setSelectedInvoice(null)}
            onOpenEwayBill={() => {
              const inv = selectedInvoice;
              setSelectedInvoice(null);
              setEwayBillInvoice(inv);
            }}
          />
        </Modal>
      )}

      {/* Official Form GST EWB-01 & NIC JSON Export Modal */}
      {ewayBillInvoice && (
        <Modal
          isOpen={!!ewayBillInvoice}
          onClose={() => setEwayBillInvoice(null)}
          title={`Form GST EWB-01 (e-Way Bill) — Invoice #${ewayBillInvoice.invoiceNo}`}
          subtitle="Official NIC e-Way Bill Slip, Vehicle Insurance & RTO Compliance Check, and NIC JSON (v1.03) Export."
          maxWidth="6xl"
        >
          <EwayBillRenderer
            invoice={ewayBillInvoice}
            company={company}
            vehicles={vehicles}
            vehicleDocuments={vehicleDocuments}
            onUpdateInvoiceEwb={(ewbNo, vehicleReg) => {
              updateTaxInvoice(ewayBillInvoice.id, { ewayBillNo: ewbNo, vehicleRegistration: vehicleReg });
              setEwayBillInvoice({ ...ewayBillInvoice, ewayBillNo: ewbNo, vehicleRegistration: vehicleReg });
            }}
            onClose={() => setEwayBillInvoice(null)}
          />
        </Modal>
      )}

      {/* Upload Previous / Scanned Invoice Modal */}
      {isUploadInvoiceModalOpen && (
        <Modal
          isOpen={isUploadInvoiceModalOpen}
          onClose={() => setIsUploadInvoiceModalOpen(false)}
          title="Upload Previous Invoice / Historical Bill"
          subtitle="Upload scanned customer/supplier bills, tax invoices, and delivery challans (PDF, JPG, PNG) into the ERP registry."
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveUploadedInvoice} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Invoice / Bill Reference No *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. YE/24-25/089 or INV-8921"
                  value={uploadInvRefNo}
                  onChange={(e) => setUploadInvRefNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Document Date *
                </label>
                <input
                  type="date"
                  required
                  value={uploadInvDate}
                  onChange={(e) => setUploadInvDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Buyer / Customer / Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TEJAS STEEL or M/S IMOP PVT LTD"
                  value={uploadInvParty}
                  onChange={(e) => setUploadInvParty(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Invoice Grand Total (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 146367.00"
                  value={uploadInvAmount || ''}
                  onChange={(e) => setUploadInvAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Document Description / Title
              </label>
              <input
                type="text"
                placeholder="e.g. March 2025 Heavy Melting Scrap Dispatch"
                value={uploadInvTitle}
                onChange={(e) => setUploadInvTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Attach Scanned File / Photo (PDF or Image)
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleUploadInvoiceFileChange}
                  className="hidden"
                  id="invoice-file-upload-input"
                />
                <label
                  htmlFor="invoice-file-upload-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <FileUp className="w-8 h-8 text-red-500" />
                  <span className="font-bold text-slate-700">
                    {uploadInvFileData ? uploadInvFileData.name : 'Click to select PDF or Invoice Photo'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Supports PDF, JPG, PNG from device storage or mobile camera
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Notes & Remarks (HSN, Weights, Vehicle No)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. MS Scrap 4.430 Tons, Truck TN 05 Y 1936, e-Way Bill generated"
                value={uploadInvNotes}
                onChange={(e) => setUploadInvNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsUploadInvoiceModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md shadow-red-600/20 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <Upload className="w-4 h-4 text-amber-300" />
                <span>Save to Registry</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
