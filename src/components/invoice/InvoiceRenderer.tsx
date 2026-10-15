import React, { useRef } from 'react';
import { Invoice, CompanySettings } from '../../types/index.ts';
import { formatINR, formatWeight } from '../../utils/calculations.ts';
import { Printer, Download, CheckCircle, ShieldCheck } from 'lucide-react';

interface InvoiceRendererProps {
  invoice: Invoice;
  company: CompanySettings;
  onClose?: () => void;
}

export const InvoiceRenderer: React.FC<InvoiceRendererProps> = ({ invoice, company, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Action Bar (hidden in print) */}
      <div className="flex items-center justify-between bg-slate-100 p-4 rounded-xl print:hidden border border-slate-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Immutable Verified Tax Invoice ({invoice.invoiceNo})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF (A4)
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Printable A4 Tax Invoice Document */}
      <div
        ref={printRef}
        id="tax-invoice-sheet"
        className="bg-white text-black p-8 rounded-lg shadow-lg border border-slate-300 mx-auto w-full max-w-[210mm] text-[11px] leading-tight font-sans print:shadow-none print:border-none print:p-0 print:m-0"
        style={{ minHeight: '297mm' }}
      >
        {/* Document Header */}
        <div className="text-center font-bold text-sm tracking-widest border border-black py-1 uppercase bg-slate-50">
          TAX INVOICE
        </div>

        {/* Top Seller & Metadata Grid */}
        <div className="grid grid-cols-2 border-x border-b border-black">
          {/* Seller Profile */}
          <div className="p-3 border-r border-black flex flex-col justify-between">
            <div className="flex items-start gap-3">
              <img
                src="/yasoth-logo.png"
                alt="Yasoth Logo"
                className="w-14 h-14 object-contain"
                onError={(e) => {
                  // Fallback if image not rendered
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <h1 className="font-extrabold text-base tracking-wide text-red-600">
                  {company.companyName}
                </h1>
                <p className="text-[10px] text-slate-700 mt-0.5">{company.addressLine1}</p>
                <p className="text-[10px] text-slate-700">{company.addressLine2}</p>
                <p className="text-[10px] text-slate-700">{company.city}, Tamil Nadu - {company.pincode}</p>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] space-y-0.5">
              <p><span className="font-semibold">GSTIN/UIN:</span> {company.gstin}</p>
              <p><span className="font-semibold">State Name:</span> {company.stateName}, Code: {company.stateCode}</p>
              <p><span className="font-semibold">E-Mail:</span> {company.email}</p>
              <p><span className="font-semibold">Contact:</span> {company.phone}</p>
            </div>
          </div>

          {/* Invoice References Grid */}
          <div className="grid grid-cols-2 text-[10px]">
            <div className="p-2 border-r border-b border-black">
              <span className="text-slate-500 block">Invoice No.</span>
              <span className="font-bold text-xs">{invoice.invoiceNo}</span>
            </div>
            <div className="p-2 border-b border-black">
              <span className="text-slate-500 block">Dated</span>
              <span className="font-bold">{invoice.invoiceDate}</span>
            </div>

            <div className="p-2 border-r border-b border-black">
              <span className="text-slate-500 block">e-Way Bill No.</span>
              <span className="font-bold">{invoice.ewayBillNo || '—'}</span>
            </div>
            <div className="p-2 border-b border-black">
              <span className="text-slate-500 block">Mode/Terms of Payment</span>
              <span className="font-bold">Immediate Weighment</span>
            </div>

            <div className="p-2 border-r border-b border-black">
              <span className="text-slate-500 block">Motor Vehicle No.</span>
              <span className="font-bold">{invoice.vehicleRegistration || '—'}</span>
            </div>
            <div className="p-2 border-b border-black">
              <span className="text-slate-500 block">Destination</span>
              <span className="font-bold">Tamil Nadu</span>
            </div>

            <div className="p-2 border-r border-black">
              <span className="text-slate-500 block">Dispatched through</span>
              <span className="font-bold">Road Transport</span>
            </div>
            <div className="p-2">
              <span className="text-slate-500 block">Terms of Delivery</span>
              <span className="font-bold">Ex-Yard Delivery</span>
            </div>
          </div>
        </div>

        {/* Buyer & Consignee Details */}
        <div className="grid grid-cols-2 border-x border-b border-black text-[10px]">
          <div className="p-2.5 border-r border-black">
            <span className="font-semibold text-slate-500 uppercase block mb-1">Consignee (Ship to)</span>
            <p className="font-bold text-xs">{invoice.customerName}</p>
            <p className="text-slate-700 mt-0.5">{invoice.shippingAddress}</p>
            <p className="mt-1"><span className="font-semibold">GSTIN/UIN:</span> {invoice.customerGstin || 'Unregistered'}</p>
            <p><span className="font-semibold">State Name:</span> {invoice.customerStateName}, Code: {invoice.customerStateCode}</p>
          </div>

          <div className="p-2.5">
            <span className="font-semibold text-slate-500 uppercase block mb-1">Buyer (Bill to)</span>
            <p className="font-bold text-xs">{invoice.customerName}</p>
            <p className="text-slate-700 mt-0.5">{invoice.billingAddress}</p>
            <p className="mt-1"><span className="font-semibold">GSTIN/UIN:</span> {invoice.customerGstin || 'Unregistered'}</p>
            <p><span className="font-semibold">State Name:</span> {invoice.customerStateName}, Code: {invoice.customerStateCode}</p>
          </div>
        </div>

        {/* Goods Line Items Table */}
        <table className="w-full border-x border-b border-black text-left text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black text-center">
              <th className="py-2 px-1 border-r border-black w-10">S.NO</th>
              <th className="py-2 px-2 border-r border-black text-left">DESCRIPTION OF GOODS</th>
              <th className="py-2 px-2 border-r border-black w-20">HSN/SAC</th>
              <th className="py-2 px-2 border-r border-black w-20">QUANTITY</th>
              <th className="py-2 px-1 border-r border-black w-14">UNIT</th>
              <th className="py-2 px-2 border-r border-black w-20 text-right">RATE</th>
              <th className="py-2 px-1 border-r border-black w-14">PER</th>
              <th className="py-2 px-2 text-right w-28">TOTAL VALUE</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, idx) => (
              <tr key={line.id || idx} className="align-top border-b border-slate-200">
                <td className="py-2 px-1 text-center border-r border-black">{idx + 1}</td>
                <td className="py-2 px-2 border-r border-black font-semibold">
                  {line.descriptionOfGoods}
                </td>
                <td className="py-2 px-2 text-center border-r border-black">{line.hsnSac}</td>
                <td className="py-2 px-2 text-right border-r border-black font-medium">
                  {line.quantity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                </td>
                <td className="py-2 px-1 text-center border-r border-black">{line.unit}</td>
                <td className="py-2 px-2 text-right border-r border-black">
                  {line.rate.toFixed(2)}
                </td>
                <td className="py-2 px-1 text-center border-r border-black">{line.unit}S</td>
                <td className="py-2 px-2 text-right font-semibold">
                  {line.taxableValue.toFixed(2)}
                </td>
              </tr>
            ))}

            {/* Tax Subtotals rows */}
            {invoice.cgstAmount > 0 && (
              <tr className="border-t border-slate-200 text-slate-800">
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 border-r border-black font-medium">OUTPUT CGST @ {invoice.cgstRate}%</td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black text-right">{invoice.cgstRate}%</td>
                <td className="border-r border-black text-center">%</td>
                <td className="py-1 px-2 text-right font-medium">{invoice.cgstAmount.toFixed(2)}</td>
              </tr>
            )}

            {invoice.sgstAmount > 0 && (
              <tr className="text-slate-800">
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 border-r border-black font-medium">OUTPUT SGST @ {invoice.sgstRate}%</td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black text-right">{invoice.sgstRate}%</td>
                <td className="border-r border-black text-center">%</td>
                <td className="py-1 px-2 text-right font-medium">{invoice.sgstAmount.toFixed(2)}</td>
              </tr>
            )}

            {invoice.igstAmount > 0 && (
              <tr className="text-slate-800">
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 border-r border-black font-medium">OUTPUT IGST @ {invoice.igstRate}%</td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black text-right">{invoice.igstRate}%</td>
                <td className="border-r border-black text-center">%</td>
                <td className="py-1 px-2 text-right font-medium">{invoice.igstAmount.toFixed(2)}</td>
              </tr>
            )}

            {invoice.roundOff !== 0 && (
              <tr className="text-slate-800">
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 border-r border-black font-medium">ROUND OFF</td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="py-1 px-2 text-right font-medium">{invoice.roundOff.toFixed(2)}</td>
              </tr>
            )}

            {/* Total Row */}
            <tr className="border-t-2 border-black font-extrabold text-xs bg-slate-50">
              <td className="py-2 text-center border-r border-black"></td>
              <td className="py-2 px-2 border-r border-black">TOTAL</td>
              <td className="border-r border-black"></td>
              <td className="py-2 px-2 text-right border-r border-black">
                {invoice.lines.reduce((sum, l) => sum + l.quantity, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className="border-r border-black text-center">{company.defaultBaseUnit}</td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="py-2 px-2 text-right text-sm text-red-700">
                ₹{invoice.grandTotal.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Amount Chargeable in Words */}
        <div className="border-x border-b border-black p-2 bg-slate-50 text-[10px]">
          <span className="font-semibold text-slate-500 uppercase block">Amount Chargeable (in words)</span>
          <p className="font-bold text-xs text-slate-900 mt-0.5">{invoice.amountInWords}</p>
        </div>

        {/* HSN / Tax Breakdown Summary Table */}
        <table className="w-full border-x border-b border-black text-[10px] text-center border-collapse">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black">
              <th className="py-1 px-2 border-r border-black w-24">HSN/SAC</th>
              <th className="py-1 px-2 border-r border-black text-right w-28">Taxable Value</th>
              <th className="py-1 px-2 border-r border-black" colSpan={2}>CGST</th>
              <th className="py-1 px-2 border-r border-black" colSpan={2}>SGST/UTGST</th>
              <th className="py-1 px-2 text-right w-28">Total Tax Amount</th>
            </tr>
            <tr className="border-b border-black text-[9px] text-slate-600 bg-slate-50">
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
                {invoice.subtotalTaxable.toFixed(2)}
              </td>
              <td className="py-1.5 px-1 border-r border-black">{invoice.cgstRate}%</td>
              <td className="py-1.5 px-1 border-r border-black text-right">{invoice.cgstAmount.toFixed(2)}</td>
              <td className="py-1.5 px-1 border-r border-black">{invoice.sgstRate}%</td>
              <td className="py-1.5 px-1 border-r border-black text-right">{invoice.sgstAmount.toFixed(2)}</td>
              <td className="py-1.5 px-2 text-right font-bold">
                {(invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount).toFixed(2)}
              </td>
            </tr>
            <tr className="bg-slate-50 font-bold border-t border-black">
              <td className="py-1.5 px-2 border-r border-black">Total</td>
              <td className="py-1.5 px-2 border-r border-black text-right">{invoice.subtotalTaxable.toFixed(2)}</td>
              <td className="border-r border-black"></td>
              <td className="py-1.5 px-1 border-r border-black text-right">{invoice.cgstAmount.toFixed(2)}</td>
              <td className="border-r border-black"></td>
              <td className="py-1.5 px-1 border-r border-black text-right">{invoice.sgstAmount.toFixed(2)}</td>
              <td className="py-1.5 px-2 text-right">
                {(invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tax Amount in Words */}
        <div className="border-x border-b border-black p-2 bg-slate-50 text-[10px]">
          <span className="font-semibold text-slate-500 uppercase block">Tax Amount (in words):</span>
          <p className="font-bold text-slate-800 mt-0.5">{invoice.taxAmountInWords}</p>
        </div>

        {/* Bank Details & Declaration */}
        <div className="grid grid-cols-2 border-x border-b border-black text-[10px]">
          {/* Bank Info */}
          <div className="p-3 border-r border-black space-y-1">
            <span className="font-bold text-xs block text-slate-800">Company's Bank Details</span>
            <p><span className="font-semibold">Bank Name:</span> {company.bankName}</p>
            <p><span className="font-semibold">A/c No:</span> {company.bankAccountNo}</p>
            <p><span className="font-semibold">Branch & IFS Code:</span> {company.bankBranchIfsc}</p>
          </div>

          {/* Declaration and Signatory */}
          <div className="p-3 flex flex-col justify-between">
            <div>
              <span className="font-bold text-xs block text-slate-800">Declaration</span>
              <p className="text-[9px] text-slate-600 mt-0.5">
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </p>
            </div>
            <div className="text-right mt-6">
              <span className="font-bold text-[10px] text-slate-800 block">for {company.companyName}</span>
              <div className="h-10"></div>
              <span className="text-[10px] font-semibold text-slate-700 border-t border-slate-300 pt-1 inline-block">
                Authorised Signatory
              </span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center py-1.5 text-[9px] text-slate-500 italic">
          This is a Computer Generated Invoice · Yasoth Enterprises Scrap ERP System
        </div>
      </div>
    </div>
  );
};
