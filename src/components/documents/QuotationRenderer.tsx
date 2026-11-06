import React, { useRef, useState } from 'react';
import { CommercialDocument, CompanySettings } from '../../types/index.ts';
import { Printer, ShieldCheck, ZoomIn, ZoomOut, Maximize2, Download, CheckCircle2 } from 'lucide-react';

interface QuotationRendererProps {
  document?: CommercialDocument | null;
  company?: CompanySettings;
  onClose?: () => void;
}

export const QuotationRenderer: React.FC<QuotationRendererProps> = ({
  document,
  company,
  onClose
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  // Fallback / default data matching the official IMOP PVT LTD Quotation (Doc 65-2026)
  const docNo = document?.documentNo || '65-2026';
  const docDate = document?.documentDate || '02-11-2026';
  const refNo = document?.referenceNo || 'MAIL';
  const partyName = document?.partyName || 'M/S IMOP PVT LTD';
  const partyAddress = document?.partyAddress || 'SRICITY,ANDHRAPRADESH';
  const partyPincode = '517646';

  // Default 11 items matching user's official quotation document
  const defaultItems = [
    { slNo: 1, partName: 'Machining boring scrap', code: '9997', unit: 'ton', qty: '35 MT', pricePerKg: '₹31.00' },
    { slNo: 2, partName: 'Bevelling slag', code: '9996', unit: 'ton', qty: '20 MT', pricePerKg: '₹08.00' },
    { slNo: 3, partName: 'Wooden scrap box', code: '9977', unit: 'ton', qty: '20 MT', pricePerKg: '₹02.00' },
    { slNo: 4, partName: 'RM packing cover', code: '9962', unit: 'ton', qty: '3 MT', pricePerKg: '₹03.00' },
    { slNo: 5, partName: 'Packing Steel Strip', code: '9988', unit: 'ton', qty: '4 MT', pricePerKg: '₹28.00' },
    { slNo: 6, partName: 'MS Cutting Scrap-Painted', code: '9995', unit: 'ton', qty: '20 MT', pricePerKg: '₹32.00' },
    { slNo: 7, partName: 'Commercial scrap others', code: '9954', unit: 'ton', qty: '30 MT', pricePerKg: '₹30.00' },
    { slNo: 8, partName: 'Equipment Metal Scrap', code: '9978', unit: 'ton', qty: '10 MT', pricePerKg: '₹35.00' },
    { slNo: 9, partName: 'Electrical Cables', code: '9979', unit: 'ton', qty: '0.5 MT', pricePerKg: '₹180.00' },
    { slNo: 10, partName: 'Equipment Plastic tray', code: '9929', unit: 'ton', qty: '1 MT', pricePerKg: '₹05.00' },
    { slNo: 11, partName: 'Welding Spool Bobbin (Good)', code: '9972', unit: 'Nos', qty: '5000 No', pricePerKg: '₹17.00' }
  ];

  // Map from document lines if provided, else use the official 11 items
  const items = document?.lines && document.lines.length > 0
    ? document.lines.map((l, idx) => ({
        slNo: idx + 1,
        partName: l.description,
        code: l.hsnSac || '9997',
        unit: l.unit.toLowerCase(),
        qty: `${l.quantity} ${l.unit}`,
        pricePerKg: `₹${l.rate.toFixed(2)}`
      }))
    : defaultItems;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-3.5 rounded-xl print:hidden border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block text-slate-100">
              Official Quotation #{docNo}
            </span>
            <span className="text-[10px] text-slate-400">
              YASHOTH ENTERPRISES · 100% Authentic Quotation Format (Letterhead & Seal)
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mobile Zoom Controls */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setZoomLevel((prev) => Math.max(0.6, prev - 0.1))}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[10px] font-mono text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(1.4, prev + 0.1))}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white ml-0.5"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF (A4)</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Print CSS Rules: Single A4 Sheet Print Only */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #quotation-single-sheet, #quotation-single-sheet * {
              visibility: visible !important;
            }
            #quotation-single-sheet {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 6mm 10mm !important;
              background: white !important;
              box-shadow: none !important;
              border: none !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `
      }} />

      {/* Scrollable Container with Zoom scaling for Mobile & Desktop */}
      <div className="w-full overflow-x-auto pb-4 flex justify-center bg-slate-200/50 p-2 sm:p-4 rounded-xl border border-slate-300/80">
        <div
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
          className="transition-transform duration-150"
        >
          {/* ========================================================================= */}
          {/* EXACT 1000% OFFICIAL YASHOTH ENTERPRISES QUOTATION DOCUMENT              */}
          {/* ========================================================================= */}
          <div
            ref={printRef}
            id="quotation-single-sheet"
            className="bg-white text-black p-6 sm:p-8 rounded-lg shadow-xl border border-slate-300 mx-auto w-[210mm] min-h-[297mm] text-[11px] leading-tight font-sans print:shadow-none print:border-none print:p-0 print:m-0"
            style={{ boxSizing: 'border-box' }}
          >
            {/* ------------------------------------------------------------- */}
            {/* 1. OFFICIAL RED LETTERHEAD                                    */}
            {/* ------------------------------------------------------------- */}
            <div className="w-full mb-2">
              {/* Top row: Proprietor / GSTIN on left, Contacts on right */}
              <div className="flex justify-between items-start text-[#c92127] font-serif font-bold text-xs sm:text-[13px] tracking-wide">
                <div className="flex flex-col">
                  <span>Prop.P.NANDHA KUMAR</span>
                  <span className="font-sans font-bold text-[11px] tracking-normal mt-0.5">
                    GSTIN : 33AXVPN9382L1ZF
                  </span>
                </div>
                <div className="flex flex-col items-end text-right font-sans font-bold text-[12px]">
                  <span>CONTACT : 9600910944</span>
                  <span className="tracking-wide">9790247961</span>
                </div>
              </div>

              {/* Center Company Banner with 3D Embossed Red Styling */}
              <div className="flex items-center justify-center gap-2 mt-2 mb-1">
                {/* Red Wing Icon Logo */}
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 100 100" className="w-10 h-10 fill-red-600">
                    <path d="M15,20 C35,15 65,30 85,15 C75,35 60,50 40,55 C55,50 75,55 85,45 C70,65 50,75 25,75 C22,75 20,65 25,60 C35,50 55,45 65,35 C50,40 30,35 20,25 Z" />
                    <rect x="25" y="70" width="8" height="20" rx="2" />
                  </svg>
                </div>

                {/* 3D Extruded Bold Text */}
                <h1
                  className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-[#d32f2f] text-center"
                  style={{
                    fontFamily: "'Arial Black', 'Impact', sans-serif",
                    textShadow: '2px 2px 0px #9ca3af, 3px 3px 0px #6b7280',
                    letterSpacing: '1px'
                  }}
                >
                  YASHOTH ENTERPRISES
                </h1>
              </div>

              {/* Registered Address & Email in Bold Red */}
              <div className="text-center text-[#c92127] font-bold text-[10px] sm:text-[11px] leading-snug px-4">
                <p>
                  #128/40, Abethkar Street, Peruvoyal(Pudhuvoyal), Kavarapettai Post, Gummidipoondi Tk, Thiruvallur Dist, TN -601 206.
                </p>
                <p className="mt-0.5">
                  E-mail: nandhakumar4290@gmail.com
                </p>
              </div>

              {/* Double Horizontal Red Lines Divider */}
              <div className="my-2 border-t-2 border-b-2 border-red-600 h-1 w-full"></div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 2. SALUTATION & PREAMBLE                                      */}
            {/* ------------------------------------------------------------- */}
            <div className="mb-2 text-slate-800 text-[11px] font-medium leading-relaxed">
              <p className="font-bold">Dear IMOP,</p>
              <p>
                We thank you very much for your esteemed enquiry. We are pleased to quote our best price in the market as per the terms and conditions mentioned below.
              </p>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 3. QUOTATION HEADER TABLE GRID                                */}
            {/* ------------------------------------------------------------- */}
            <div className="border border-black mb-1">
              {/* Top QUOTATION Banner */}
              <div className="border-b border-black text-center font-bold text-sm tracking-widest py-1 bg-white uppercase">
                QUOTATION
              </div>

              {/* 2-Column Split: Buyer vs Quotation Metadata */}
              <div className="grid grid-cols-2 divide-x divide-black text-[11px]">
                {/* Left: To Buyer Address */}
                <div className="p-2 space-y-0.5 font-bold">
                  <div>To</div>
                  <div className="text-slate-900 uppercase">{partyName}</div>
                  <div className="text-slate-800 uppercase">{partyAddress}</div>
                  <div className="text-slate-800">PINCODE:{partyPincode}</div>
                </div>

                {/* Right: Date, Ref No, Your Ref */}
                <div className="divide-y divide-black font-bold">
                  <div className="grid grid-cols-12 px-2 py-1">
                    <span className="col-span-7">DATE</span>
                    <span className="col-span-5 text-right font-normal">{docDate}</span>
                  </div>
                  <div className="grid grid-cols-12 px-2 py-1">
                    <span className="col-span-7">REF.NO-QUOTATION</span>
                    <span className="col-span-5 text-right font-normal">{docNo}</span>
                  </div>
                  <div className="grid grid-cols-12 px-2 py-1">
                    <span className="col-span-7">YOURREF</span>
                    <span className="col-span-5 text-right font-normal uppercase">{refNo}</span>
                  </div>
                  <div className="grid grid-cols-12 px-2 py-1">
                    <span className="col-span-7">DATED</span>
                    <span className="col-span-5 text-right font-normal">{docDate}</span>
                  </div>
                </div>
              </div>

              {/* Sub-bar: Kindly Attend & Equity Acknowledgement */}
              <div className="border-t border-black p-2 bg-slate-50/50 text-[11px] font-medium leading-tight">
                <p className="font-bold text-slate-900">Kindly Attend</p>
                <p className="text-slate-800 mt-0.5">
                  We thank you very much for your esteemed equity. We are pleased to quote our best price as per teams and conditions.
                </p>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 4. ITEMS & RATES TABLE                                        */}
            {/* ------------------------------------------------------------- */}
            <div className="border-x border-t border-black">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-black text-slate-900">
                    <th className="border-r border-black py-1.5 px-2 text-center w-12">SLNO.</th>
                    <th className="border-r border-black py-1.5 px-2 text-left">PARTNAME/MODEL</th>
                    <th className="border-r border-black py-1.5 px-2 text-center w-16">CODE</th>
                    <th className="border-r border-black py-1.5 px-2 text-center w-14">UNIT</th>
                    <th className="border-r border-black py-1.5 px-2 text-right w-20">QTY</th>
                    <th className="py-1.5 px-2 text-right w-24">PRICE/Kg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {items.map((item) => (
                    <tr key={item.slNo} className="hover:bg-slate-50/60 transition-colors">
                      <td className="border-r border-black py-1.5 px-2 text-center font-bold text-slate-700">
                        {item.slNo}
                      </td>
                      <td className="border-r border-black py-1.5 px-2 text-left font-semibold text-slate-900">
                        {item.partName}
                      </td>
                      <td className="border-r border-black py-1.5 px-2 text-center font-mono text-slate-800">
                        {item.code}
                      </td>
                      <td className="border-r border-black py-1.5 px-2 text-center text-slate-800">
                        {item.unit}
                      </td>
                      <td className="border-r border-black py-1.5 px-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {item.qty}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.pricePerKg}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 5. TEAMS AND CONDITIONS                                       */}
            {/* ------------------------------------------------------------- */}
            <div className="border border-black p-2.5 mt-0 font-bold text-[11px] space-y-1">
              <div className="uppercase underline">TEAMS AND CONDITIONS:</div>
              <div className="flex gap-4">
                <span>TAX</span>
                <span className="font-normal">: Taxes Extra</span>
              </div>
              <div className="flex gap-4">
                <span>PAYMENT</span>
                <span className="font-normal">: Immediate</span>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 6. AUTHENTIC SIGNATURE & RUBBER STAMP                         */}
            {/* ------------------------------------------------------------- */}
            <div className="mt-4 flex justify-between items-end">
              <div className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                <p>This is a certified official commercial quotation from Yashoth Enterprises.</p>
                <p className="font-mono text-[9px] text-slate-400 mt-1">Generated by YE ERP v1.0.0 Production</p>
              </div>

              {/* Right Signature Block with Authentic Stamp */}
              <div className="flex flex-col items-center text-center">
                <div className="font-bold text-xs uppercase tracking-wide text-slate-900 mb-1">
                  For YASHOTH ENTERPRISES
                </div>

                {/* Real Stamp Vector Replica (Blue Ink Rubber Stamp) */}
                <div className="relative my-1 p-2 border-2 border-blue-700 rounded-md bg-blue-50/20 shadow-xs rotate-[-2deg] flex flex-col items-center justify-center min-w-[180px] min-h-[70px]">
                  {/* Top stamp text */}
                  <span className="text-[11px] font-black uppercase text-blue-900 tracking-wider">
                    For YASHOTH ENTERPRISES
                  </span>

                  {/* Cursive Handwriting Signature */}
                  <div className="my-0.5">
                    <svg viewBox="0 0 160 40" className="w-36 h-10 text-blue-800 stroke-current fill-none">
                      <path
                        d="M 10 25 C 20 10, 30 5, 35 25 C 38 35, 45 15, 55 20 C 65 25, 75 10, 85 22 C 95 30, 105 12, 115 18 C 125 22, 135 15, 145 28 C 150 32, 155 25, 158 20"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 25 28 C 40 32, 80 34, 130 31"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* Bottom stamp title */}
                  <span className="text-[10px] font-black uppercase text-blue-900 tracking-widest">
                    Proprietor
                  </span>
                </div>

                {/* Subtext */}
                <div className="font-bold text-xs text-slate-900 mt-1">
                  Authorized Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
