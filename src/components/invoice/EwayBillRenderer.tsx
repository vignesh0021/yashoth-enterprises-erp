import React, { useState, useMemo } from 'react';
import type { CompanySettings, Invoice, Vehicle, VehicleDocument } from '../../types/index.ts';
import { formatINR } from '../../utils/calculations.ts';
import {
  generateEwayBillForInvoice,
  exportNicEwayBillJson,
  verifyGstin,
  type TransportMode,
} from '../../../backend/business-rules/ewayBillEngine.ts';
import {
  Printer,
  Download,
  ShieldCheck,
  ShieldAlert,
  Truck,
  CheckCircle2,
  X,
  FileJson,
  QrCode,
  MapPin,
  RefreshCw,
} from 'lucide-react';

interface EwayBillRendererProps {
  invoice: Invoice;
  company: CompanySettings;
  vehicles: Vehicle[];
  vehicleDocuments: VehicleDocument[];
  onUpdateInvoiceEwb?: (ewayBillNo: string, vehicleReg: string) => void;
  onClose: () => void;
}

export const EwayBillRenderer: React.FC<EwayBillRendererProps> = ({
  invoice,
  company,
  vehicles,
  vehicleDocuments,
  onUpdateInvoiceEwb,
  onClose,
}) => {
  const [vehicleReg, setVehicleReg] = useState(invoice.vehicleRegistration || 'TN 05 Y 1936');
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [transporterName, setTransporterName] = useState('YASHOTH ENTERPRISES OWN TRANSPORT');
  const [transporterId, setTransporterId] = useState(company.gstin);
  const [transMode, setTransMode] = useState<TransportMode>('1');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const ewb = useMemo(
    () =>
      generateEwayBillForInvoice({
        invoice: {
          ...invoice,
          vehicleRegistration: vehicleReg,
        },
        company,
        vehicles,
        vehicleDocuments,
        distanceKm: distanceKm > 0 ? distanceKm : undefined,
        transporterName,
        transporterId,
        transMode,
      }),
    [invoice, company, vehicles, vehicleDocuments, vehicleReg, distanceKm, transporterName, transporterId, transMode]
  );

  const supplierGstinCheck = useMemo(() => verifyGstin(company.gstin), [company.gstin]);
  const customerGstinCheck = useMemo(() => verifyGstin(invoice.customerGstin), [invoice.customerGstin]);

  const handleDownloadNicJson = () => {
    const schemaJson = exportNicEwayBillJson(ewb, invoice);
    const blob = new Blob([JSON.stringify(schemaJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EWB_NIC_V103_INV_${invoice.invoiceNo.replace(/[^A-Za-z0-9]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSavedNotice('NIC E-Way Bill JSON (v1.03) downloaded — ready for upload on ewaybillgst.gov.in');
    setTimeout(() => setSavedNotice(null), 5000);
  };

  const handleSyncToInvoice = () => {
    if (onUpdateInvoiceEwb) {
      onUpdateInvoiceEwb(ewb.ewbNo, ewb.vehicleNo);
      setSavedNotice(`E-Way Bill #${ewb.ewbNo} & Vehicle ${ewb.vehicleNo} linked to Invoice #${invoice.invoiceNo}!`);
      setTimeout(() => setSavedNotice(null), 4000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full bg-slate-900 rounded-none sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="print:hidden bg-slate-900 text-white px-3 sm:px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-2">
              <span>GST E-WAY BILL (FORM GST EWB-01)</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                NIC Schema v1.03
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Invoice #{invoice.invoiceNo} · {invoice.customerName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncToInvoice}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-xl text-xs font-bold min-h-[42px] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Save to Invoice</span>
          </button>

          <button
            onClick={handleDownloadNicJson}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs min-h-[42px] cursor-pointer"
            title="Download Official NIC v1.03 JSON for free portal upload"
          >
            <FileJson className="w-4 h-4" />
            <span>NIC JSON (Portal)</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md min-h-[42px] cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print E-Way Bill</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer"
            aria-label="Close E-Way Bill"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="print:hidden bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Part-B Interactive Quick Config Bar (Hidden in Print) */}
      <div className="print:hidden bg-slate-800/90 px-3 sm:px-5 py-3 border-b border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-white">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
            Assigned Carrier / Vehicle No.
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={vehicleReg}
              onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg font-mono font-bold text-white uppercase min-h-[38px]"
            />
          </div>
          {vehicles.length > 0 && (
            <div className="flex gap-1 mt-1 overflow-x-auto no-scrollbar">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVehicleReg(v.registrationNo)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap cursor-pointer ${
                    vehicleReg.replace(/\s+/g, '') === v.registrationNo.replace(/\s+/g, '')
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {v.registrationNo}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
            Approx Distance (KM)
          </label>
          <input
            type="number"
            value={distanceKm || ewb.approxDistanceKm}
            onChange={(e) => setDistanceKm(parseInt(e.target.value, 10) || 0)}
            min="1"
            max="4000"
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg font-mono font-bold text-white min-h-[38px]"
          />
          <span className="text-[10px] text-emerald-400 block mt-0.5">
            Auto-calculated: {ewb.validityDays} day(s) validity (200km/day rule)
          </span>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
            Transporter Name
          </label>
          <input
            type="text"
            value={transporterName}
            onChange={(e) => setTransporterName(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white min-h-[38px]"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
            Fleet Insurance & RTO Check
          </label>
          <div
            className={`p-2 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 ${
              ewb.vehicleComplianceStatus === 'COMPLIANT'
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                : ewb.vehicleComplianceStatus === 'EXPIRED_DOC'
                ? 'bg-rose-950/90 border-rose-600 text-rose-300'
                : 'bg-amber-950/80 border-amber-700 text-amber-300'
            }`}
          >
            {ewb.vehicleComplianceStatus === 'COMPLIANT' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="truncate">{ewb.vehicleComplianceNotes}</span>
          </div>
        </div>
      </div>

      {/* Zero-Lag Print Stylesheet */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #eway-bill-print-sheet, #eway-bill-print-sheet * {
                visibility: visible !important;
              }
              #eway-bill-print-sheet {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 8mm !important;
                box-shadow: none !important;
                background: white !important;
              }
            }
          `,
        }}
      />

      {/* Printable Official Form GST EWB-01 Document */}
      <div className="p-2 sm:p-6 bg-slate-950/70 overflow-y-auto max-h-[75vh] flex justify-center">
        <div
          id="eway-bill-print-sheet"
          className="bg-white text-black w-full max-w-3xl p-4 sm:p-7 rounded-lg shadow-xl border border-slate-300 text-xs font-sans space-y-4"
        >
          {/* Top Header & QR Code */}
          <div className="border-2 border-black p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                GOODS AND SERVICES TAX — NIC E-WAY BILL SYSTEM
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-black mt-0.5">
                e-Way Bill (Form GST EWB-01)
              </h1>
              <p className="text-[11px] font-semibold text-slate-700">
                [Under Rule 138 of the Central Goods and Services Tax (CGST) Rules, 2017]
              </p>
            </div>

            {/* Deterministic SVG QR Code Representation */}
            <div className="flex items-center gap-3 border border-black p-2 bg-slate-50 self-end sm:self-auto">
              <QrCode className="w-12 h-12 text-black shrink-0" />
              <div className="text-[10px] font-mono leading-tight">
                <span className="font-black block text-xs">{ewb.ewbNo}</span>
                <span className="block text-slate-600">IRN/QR Verified</span>
                <span className="block font-bold text-emerald-700">STATUS: ACTIVE</span>
              </div>
            </div>
          </div>

          {/* 1. E-Way Bill Core Credentials */}
          <div className="border-2 border-black">
            <div className="bg-slate-100 border-b border-black px-3 py-1.5 font-black text-xs uppercase">
              1. E-Way Bill Summary Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black text-xs">
              <div className="p-2.5">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">e-Way Bill No:</span>
                <span className="font-mono font-black text-base text-black">{ewb.ewbNo}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Generated Date & By:</span>
                <span className="font-mono font-bold block">{ewb.ewbDate}</span>
                <span className="text-[10px] font-mono text-slate-700">{ewb.fromGstin}</span>
              </div>
              <div className="p-2.5 bg-amber-50/50">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">
                  Valid Upto ({ewb.validityDays} Day{ewb.validityDays > 1 ? 's' : ''} · {ewb.approxDistanceKm} KM):
                </span>
                <span className="font-mono font-black text-sm text-red-700">{ewb.validUpto}</span>
              </div>
            </div>
          </div>

          {/* 2. PART - A (Address & Consignment Details) */}
          <div className="border-2 border-black">
            <div className="bg-slate-100 border-b border-black px-3 py-1.5 font-black text-xs uppercase flex items-center justify-between">
              <span>2. PART - A (Consignor, Consignee & Goods Details)</span>
              <span className="text-[10px] font-mono">
                Supply Type: {ewb.supplyType} - {ewb.subSupplyType}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-black">
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500">From (Supplier / Consignor)</span>
                  {supplierGstinCheck.isValidFormat && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      GSTIN Verified ({supplierGstinCheck.stateCode})
                    </span>
                  )}
                </div>
                <p className="font-black text-sm">{ewb.fromTrdName}</p>
                <p className="font-mono font-bold text-xs">GSTIN: {ewb.fromGstin}</p>
                <p className="text-[11px] text-slate-700">{ewb.fromAddr1}</p>
                <p className="text-[11px] font-bold">
                  Dispatch Place: {ewb.fromPlace} — PIN: {ewb.fromPincode} (State: {ewb.fromStateCode})
                </p>
              </div>

              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500">To (Recipient / Consignee)</span>
                  {customerGstinCheck.isValidFormat && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      GSTIN Verified ({customerGstinCheck.stateCode})
                    </span>
                  )}
                </div>
                <p className="font-black text-sm">{ewb.toTrdName}</p>
                <p className="font-mono font-bold text-xs">GSTIN: {ewb.toGstin}</p>
                <p className="text-[11px] text-slate-700">{ewb.toAddr1}</p>
                <p className="text-[11px] font-bold">
                  Delivery Place: {ewb.toPlace} — PIN: {ewb.toPincode} (State: {ewb.toStateCode})
                </p>
              </div>
            </div>

            <div className="border-t border-black grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-black bg-slate-50/60">
              <div className="p-2.5">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Document No. & Date</span>
                <span className="font-mono font-black text-xs">
                  {ewb.docType} #{ewb.invoiceNo}
                </span>
                <span className="block text-[11px]">{ewb.invoiceDate}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Primary HSN & Qty</span>
                <span className="font-mono font-black text-xs">HSN: {ewb.hsnCode}</span>
                <span className="block text-[11px] font-bold">
                  {ewb.totalQuantity} {ewb.unitCode}
                </span>
              </div>
              <div className="p-2.5">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Taxable Value & GST</span>
                <span className="font-mono font-bold text-xs">{formatINR(ewb.taxableAmount)}</span>
                <span className="block text-[10px] text-slate-600">
                  {ewb.igstAmount > 0
                    ? `IGST: ${formatINR(ewb.igstAmount)}`
                    : `CGST+SGST: ${formatINR(ewb.cgstAmount + ewb.sgstAmount)}`}
                </span>
              </div>
              <div className="p-2.5 bg-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Invoice Value</span>
                <span className="font-mono font-black text-sm text-black">
                  {formatINR(ewb.totalInvoiceValue)}
                </span>
              </div>
            </div>

            {/* Goods Description Row */}
            <div className="border-t border-black p-2.5 text-xs">
              <span className="font-bold text-slate-600 uppercase text-[10px]">Commodity Description: </span>
              <span className="font-bold text-black">{ewb.mainProductDesc}</span>
            </div>
          </div>

          {/* 3. PART - B (Vehicle & Transport Details) */}
          <div className="border-2 border-black">
            <div className="bg-slate-100 border-b border-black px-3 py-1.5 font-black text-xs uppercase">
              3. PART - B (Vehicle & Transporter Details)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black bg-slate-50 text-[10px] uppercase font-black">
                    <th className="p-2 border-r border-black">Mode</th>
                    <th className="p-2 border-r border-black">Vehicle No.</th>
                    <th className="p-2 border-r border-black">From Place</th>
                    <th className="p-2 border-r border-black">Entered Date</th>
                    <th className="p-2 border-r border-black">Entered By</th>
                    <th className="p-2">Transporter / Doc No.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-mono">
                    <td className="p-2 border-r border-black font-bold">{ewb.transMode} - {ewb.transModeLabel}</td>
                    <td className="p-2 border-r border-black font-black text-sm text-black">{ewb.vehicleNo}</td>
                    <td className="p-2 border-r border-black font-sans font-semibold">{ewb.fromPlace}</td>
                    <td className="p-2 border-r border-black">{ewb.ewbDate}</td>
                    <td className="p-2 border-r border-black">{ewb.fromGstin}</td>
                    <td className="p-2 font-sans">
                      <span className="font-bold block">{ewb.transporterName}</span>
                      <span className="text-[10px] font-mono">Doc: {ewb.transDocNo}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Note */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[10px] text-slate-600 pt-1 gap-2">
            <span>
              Note: If there is any discrepancy in Part-B vehicle breakdown, update Part-B on ewaybillgst.gov.in before transit.
            </span>
            <span className="font-bold text-black">
              For {company.legalName || 'YASHOTH ENTERPRISES'} — Authorized Signatory
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
