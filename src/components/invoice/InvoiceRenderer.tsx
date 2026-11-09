import React, { useRef } from 'react';
import { Invoice, CompanySettings } from '../../types/index.ts';
import { formatINR, formatWeight } from '../../utils/calculations.ts';
import { Printer, ShieldCheck, Truck } from 'lucide-react';

interface InvoiceRendererProps {
  invoice: Invoice;
  company: CompanySettings;
  onClose?: () => void;
  onOpenEwayBill?: () => void;
}

export const InvoiceRenderer: React.FC<InvoiceRendererProps> = ({ invoice, company, onClose, onOpenEwayBill }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const totalQuantity = invoice.lines.reduce((sum, l) => sum + l.quantity, 0);
  const primaryUnit = invoice.lines[0]?.unit || 'KG';

  return (
    <div className="flex flex-col gap-4">
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-3.5 rounded-xl print:hidden border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block text-slate-100">
              Verified GST Tax Invoice #{invoice.invoiceNo}
            </span>
            <span className="text-[10px] text-slate-400">
              YASHOTH ENTERPRISES · e-Way Bill #{invoice.ewayBillNo || '5417 9765 5717'} (Official 1-Page Tax Invoice)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenEwayBill && (
            <button
              onClick={onOpenEwayBill}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer min-h-[40px]"
            >
              <Truck className="w-4 h-4" />
              <span>Form GST EWB-01 / NIC JSON</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer min-h-[40px]"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF (A4)</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[40px]"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Print CSS Rules: Single A4 Sheet Print Only (Zero-Lag Optimized) */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 5mm;
            }
            body * {
              visibility: hidden;
            }
            #tax-invoice-single-sheet, #tax-invoice-single-sheet * {
              visibility: visible;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #tax-invoice-single-sheet {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 4mm !important;
              background: white !important;
              box-shadow: none !important;
              border: 1px solid black !important;
              transform: none !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `
      }} />

      {/* ========================================================================= */}
      {/* SINGLE-PAGE OFFICIAL TAX INVOICE (Exact 1:1 replica of INVOICE_03.pdf)   */}
      {/* ========================================================================= */}
      <div
        ref={printRef}
        id="tax-invoice-single-sheet"
        className="bg-white text-black p-6 rounded-lg shadow-xl border border-slate-300 mx-auto w-full max-w-[210mm] text-[10px] leading-tight font-sans print:shadow-none print:border-black print:p-0"
      >
        {/* Document Header */}
        <div className="text-center font-bold text-sm tracking-widest border border-black py-1 uppercase bg-slate-50">
          TAX INVOICE
        </div>

        {/* Top Seller & Metadata Grid */}
        <div className="grid grid-cols-2 border-x border-b border-black">
          {/* Seller Profile */}
          <div className="p-3 border-r border-black flex flex-col justify-between">
            <div className="flex items-start gap-2.5">
              <img
                src="/yasoth-logo.png"
                alt="Yasoth Logo"
                decoding="sync"
                loading="eager"
                className="w-13 h-13 object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <h1 className="font-extrabold text-base tracking-wide text-slate-900 leading-tight">
                  {company.companyName}
                </h1>
                <p className="text-[10px] text-slate-700 mt-0.5">{company.addressLine1}</p>
                <p className="text-[10px] text-slate-700">{company.addressLine2}</p>
                <p className="text-[10px] text-slate-700">{company.city}, Tamil Nadu - {company.pincode}</p>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-300 text-[10px] space-y-0.5">
              <p><span className="font-semibold">GSTIN/UIN:</span> {company.gstin}</p>
              <p><span className="font-semibold">State Name:</span> {company.stateName}, Code: {company.stateCode}</p>
              <p><span className="font-semibold">E-Mail:</span> {company.email}</p>
              <p><span className="font-semibold">Contact:</span> {company.phone}</p>
            </div>
          </div>

          {/* Invoice References Grid matching INVOICE_03.pdf */}
          <div className="grid grid-cols-2 text-[9.5px]">
            <div className="p-1.5 border-r border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Invoice No.</span>
              <span className="font-bold text-xs">{invoice.invoiceNo}</span>
            </div>
            <div className="p-1.5 border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Dated</span>
              <span className="font-bold">{invoice.invoiceDate}</span>
            </div>

            <div className="p-1.5 border-r border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Delivery Note</span>
              <span className="font-medium">{invoice.deliveryNote || '—'}</span>
            </div>
            <div className="p-1.5 border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Mode/Terms of Payment</span>
              <span className="font-bold">Immediate Weighment</span>
            </div>

            <div className="p-1.5 border-r border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Reference No. & Date.</span>
              <span className="font-medium">YE/REF/2026</span>
            </div>
            <div className="p-1.5 border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Other References</span>
              <span className="font-medium">SCRAP DISPATCH</span>
            </div>

            <div className="p-1.5 border-r border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Buyer's Order No.</span>
              <span className="font-medium">SO/PO-442</span>
            </div>
            <div className="p-1.5 border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Dated</span>
              <span className="font-medium">{invoice.invoiceDate}</span>
            </div>

            <div className="p-1.5 border-r border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Dispatch Doc No.</span>
              <span className="font-medium">DISP-03</span>
            </div>
            <div className="p-1.5 border-b border-black">
              <span className="text-slate-500 block text-[8.5px]">Delivery Note Date</span>
              <span className="font-medium">{invoice.invoiceDate}</span>
            </div>

            <div className="p-1.5 border-r border-black">
              <span className="text-slate-500 block text-[8.5px]">Dispatched through</span>
              <span className="font-bold">Road Transport</span>
            </div>
            <div className="p-1.5">
              <span className="text-slate-500 block text-[8.5px]">Destination</span>
              <span className="font-bold">Tamil Nadu</span>
            </div>
          </div>
        </div>

        {/* Consignee & Buyer Grid matching INVOICE_03.pdf */}
        <div className="grid grid-cols-2 border-x border-b border-black text-[10px]">
          <div className="p-2.5 border-r border-black">
            <span className="font-bold text-slate-600 uppercase block mb-1 text-[9px]">Consignee (Ship to)</span>
            <p className="font-black text-xs text-slate-900">{invoice.customerName}</p>
            <p className="text-slate-700 mt-0.5 text-[9.5px] leading-snug">{invoice.shippingAddress}</p>
            <div className="mt-2 pt-1 border-t border-slate-200 text-[9.5px] space-y-0.5">
              <p><span className="font-semibold">GSTIN/UIN:</span> {invoice.customerGstin || 'Unregistered'}</p>
              <p><span className="font-semibold">State Name:</span> {invoice.customerStateName}, Code: {invoice.customerStateCode}</p>
            </div>
          </div>

          <div className="p-2.5">
            <span className="font-bold text-slate-600 uppercase block mb-1 text-[9px]">Buyer (Bill to)</span>
            <p className="font-black text-xs text-slate-900">{invoice.customerName}</p>
            <p className="text-slate-700 mt-0.5 text-[9.5px] leading-snug">{invoice.billingAddress}</p>
            <div className="mt-2 pt-1 border-t border-slate-200 text-[9.5px] space-y-0.5">
              <p><span className="font-semibold">GSTIN/UIN:</span> {invoice.customerGstin || 'Unregistered'}</p>
              <p><span className="font-semibold">State Name:</span> {invoice.customerStateName}, Code: {invoice.customerStateCode}</p>
            </div>
          </div>
        </div>

        {/* Goods Line Items Table */}
        <table className="w-full border-x border-b border-black text-left text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black text-center text-[9px]">
              <th className="py-2 px-1 border-r border-black w-10">Sl No.</th>
              <th className="py-2 px-2 border-r border-black text-left">Description of Goods</th>
              <th className="py-2 px-2 border-r border-black w-20">HSN/SAC</th>
              <th className="py-2 px-2 border-r border-black w-24 text-right">Quantity</th>
              <th className="py-2 px-2 border-r border-black w-20 text-right">Rate</th>
              <th className="py-2 px-1 border-r border-black w-14">per</th>
              <th className="py-2 px-2 text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, idx) => (
              <tr key={line.id || idx} className="align-top border-b border-slate-200">
                <td className="py-2 px-1 text-center border-r border-black font-semibold">{idx + 1}</td>
                <td className="py-2 px-2 border-r border-black font-bold text-slate-900">
                  {line.descriptionOfGoods}
                </td>
                <td className="py-2 px-2 text-center border-r border-black">{line.hsnSac}</td>
                <td className="py-2 px-2 text-right border-r border-black font-bold">
                  {line.quantity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} {line.unit}
                </td>
                <td className="py-2 px-2 text-right border-r border-black font-mono">
                  {line.rate.toFixed(2)}
                </td>
                <td className="py-2 px-1 text-center border-r border-black font-semibold">{line.unit}</td>
                <td className="py-2 px-2 text-right font-bold text-slate-900">
                  {line.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}

            {/* CGST Line */}
            {invoice.cgstAmount > 0 && (
              <tr className="border-t border-slate-200 text-slate-800">
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 border-r border-black font-bold text-right italic" colSpan={4}>
                  OUTPUT CGST {invoice.cgstRate}%
                </td>
                <td className="border-r border-black text-center font-bold">{invoice.cgstRate}%</td>
                <td className="py-1 px-2 text-right font-medium">
                  {invoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            )}

            {/* SGST Line */}
            {invoice.sgstAmount > 0 && (
              <tr className="text-slate-800">
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 border-r border-black font-bold text-right italic" colSpan={4}>
                  OUTPUT SGST {invoice.sgstRate}%
                </td>
                <td className="border-r border-black text-center font-bold">{invoice.sgstRate}%</td>
                <td className="py-1 px-2 text-right font-medium">
                  {invoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            )}

            {/* IGST Line */}
            {invoice.igstAmount > 0 && (
              <tr className="text-slate-800">
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 border-r border-black font-bold text-right italic" colSpan={4}>
                  OUTPUT IGST {invoice.igstRate}%
                </td>
                <td className="border-r border-black text-center font-bold">{invoice.igstRate}%</td>
                <td className="py-1 px-2 text-right font-medium">
                  {invoice.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            )}

            {/* Round Off Line */}
            {invoice.roundOff !== 0 && (
              <tr className="text-slate-800">
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 border-r border-black font-bold text-right italic" colSpan={4}>
                  ROUND OFF
                </td>
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 text-right font-medium">
                  {invoice.roundOff < 0 ? `(-)${Math.abs(invoice.roundOff).toFixed(2)}` : invoice.roundOff.toFixed(2)}
                </td>
              </tr>
            )}

            {/* Grand Total Row */}
            <tr className="border-t-2 border-black font-black text-xs bg-slate-50">
              <td className="py-2 text-center border-r border-black"></td>
              <td className="py-2 px-2 border-r border-black uppercase tracking-wider">Total</td>
              <td className="border-r border-black"></td>
              <td className="py-2 px-2 text-right border-r border-black font-mono">
                {totalQuantity.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {primaryUnit}
              </td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="py-2 px-2 text-right text-sm font-black text-slate-900 font-mono">
                ₹ {invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Amount Chargeable in Words */}
        <div className="border-x border-b border-black p-2 bg-slate-50 text-[10px]">
          <span className="font-bold text-slate-500 uppercase block text-[8.5px]">Amount Chargeable (in words)</span>
          <p className="font-extrabold text-xs text-slate-950 mt-0.5">{invoice.amountInWords}</p>
        </div>

        {/* HSN / Tax Breakdown Summary Table */}
        <table className="w-full border-x border-b border-black text-[9.5px] text-center border-collapse">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black">
              <th className="py-1 px-2 border-r border-black w-24">HSN/SAC</th>
              <th className="py-1 px-2 border-r border-black text-right w-28">Taxable Value</th>
              <th className="py-1 px-2 border-r border-black" colSpan={2}>Central Tax</th>
              <th className="py-1 px-2 border-r border-black" colSpan={2}>State Tax</th>
              <th className="py-1 px-2 text-right w-28">Total Tax Amount</th>
            </tr>
            <tr className="border-b border-black text-[8.5px] text-slate-600 bg-slate-50">
              <th className="border-r border-black"></th>
              <th className="border-r border-black"></th>
              <th className="py-0.5 px-1 border-r border-black w-14">Rate</th>
              <th className="py-0.5 px-1 border-r border-black w-20 text-right">Amount</th>
              <th className="py-0.5 px-1 border-r border-black w-14">Rate</th>
              <th className="py-0.5 px-1 border-r border-black w-20 text-right">Amount</th>
              <th className="py-0.5 px-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-1.5 px-2 border-r border-black font-semibold">7204</td>
              <td className="py-1.5 px-2 border-r border-black text-right font-medium">
                {invoice.subtotalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="py-1.5 px-1 border-r border-black">{invoice.cgstRate}%</td>
              <td className="py-1.5 px-1 border-r border-black text-right">
                {invoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="py-1.5 px-1 border-r border-black">{invoice.sgstRate}%</td>
              <td className="py-1.5 px-1 border-r border-black text-right">
                {invoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="py-1.5 px-2 text-right font-bold">
                {(invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
            <tr className="bg-slate-50 font-bold border-t border-black">
              <td className="py-1.5 px-2 border-r border-black uppercase text-left">Total</td>
              <td className="py-1.5 px-2 border-r border-black text-right">
                {invoice.subtotalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="border-r border-black"></td>
              <td className="py-1.5 px-1 border-r border-black text-right">
                {invoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="border-r border-black"></td>
              <td className="py-1.5 px-1 border-r border-black text-right">
                {invoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="py-1.5 px-2 text-right font-black">
                ₹ {(invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tax Amount in Words */}
        <div className="border-x border-b border-black p-2 bg-slate-50 text-[10px]">
          <span className="font-bold text-slate-500 uppercase block text-[8.5px]">Tax Amount (in words):</span>
          <p className="font-bold text-slate-800 mt-0.5">{invoice.taxAmountInWords}</p>
        </div>

        {/* Bank Details & Declaration */}
        <div className="grid grid-cols-2 border-x border-b border-black text-[10px]">
          {/* Bank Info */}
          <div className="p-3 border-r border-black space-y-1">
            <span className="font-black text-xs block text-slate-900 uppercase">Company's Bank Details</span>
            <p><span className="font-semibold">Bank Name:</span> {company.bankName}</p>
            <p><span className="font-semibold">A/c No.:</span> {company.bankAccountNo}</p>
            <p><span className="font-semibold">Branch & IFS Code:</span> {company.bankBranchIfsc}</p>
          </div>

          {/* Declaration and Signatory */}
          <div className="p-3 flex flex-col justify-between">
            <div>
              <span className="font-black text-xs block text-slate-900 uppercase">Declaration</span>
              <p className="text-[9px] text-slate-700 mt-0.5 leading-snug">
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </p>
            </div>
            <div className="text-right mt-6">
              <span className="font-bold text-[10px] text-slate-900 block">for {company.companyName}</span>
              <div className="h-10 flex items-center justify-end">
                <span className="text-[10px] font-mono text-slate-400 italic">Digitally Authorized</span>
              </div>
              <span className="text-[10px] font-bold text-slate-800 border-t border-black pt-1 inline-block min-w-36 text-center">
                Authorised Signatory
              </span>
            </div>
          </div>
        </div>

        {/* Jurisdictional and Footer Note */}
        <div className="flex items-center justify-between py-1.5 px-2 text-[8.5px] text-slate-500 border-x border-b border-black bg-slate-50">
          <span className="font-bold uppercase tracking-wider text-slate-600">SUBJECT TO GUMMIDIPOONDI JURISDICTION</span>
          <span className="italic">This is a Computer Generated Invoice · Yasoth Enterprises Scrap ERP System</span>
        </div>
      </div>
    </div>
  );
};
