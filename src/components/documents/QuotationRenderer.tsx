import React, { useRef, useState, useEffect } from 'react';
import { CommercialDocument, CompanySettings } from '../../types/index.ts';
import { Printer, ShieldCheck, ZoomIn, ZoomOut, Maximize2, Minimize2, X, FileText } from 'lucide-react';
import {
  QUOTATION_HEADER_BANNER,
  QUOTATION_ADDRESS_BANNER,
  QUOTATION_DIVIDER_BANNER,
  QUOTATION_STAMP_SIGNATURE
} from '../../assets/quotationAssets.ts';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Dynamic zoom state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFitToWidth, setIsFitToWidth] = useState<boolean>(true);

  // Fallback / default data matching the official IMOP PVT LTD Quotation (Doc 65-2026)
  const docNo = document?.documentNo || '65-2026';
  const docDate = document?.documentDate || '02-11-2026';
  const refNo = document?.referenceNo || 'MAIL';
  const partyName = document?.partyName || 'M/S IMOP PVT LTD';
  const partyAddress = document?.partyAddress || 'SRICITY,ANDHRAPRADESH';
  const partyPincode = '517646';

  // Default 11 items matching user's official quotation document (.docx)
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

  // Auto-fit scale calculation on resize
  useEffect(() => {
    const updateFitScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth - 16; // 8px padding each side
      if (containerWidth < 794 && isFitToWidth) {
        const calculatedScale = Math.max(0.38, Math.min(1, containerWidth / 794));
        setZoomLevel(calculatedScale);
      } else if (!isFitToWidth) {
        // Keep user manual zoom
      } else {
        setZoomLevel(1);
      }
    };

    updateFitScale();
    window.addEventListener('resize', updateFitScale);
    return () => window.removeEventListener('resize', updateFitScale);
  }, [isFitToWidth]);

  const handlePrint = () => {
    window.print();
  };

  const handleToggleFit = () => {
    if (isFitToWidth) {
      setIsFitToWidth(false);
      setZoomLevel(1);
    } else {
      setIsFitToWidth(true);
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 16;
        const calculatedScale = Math.max(0.38, Math.min(1, containerWidth / 794));
        setZoomLevel(calculatedScale);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:gap-4 w-full bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex items-center justify-between gap-2 bg-slate-900 text-white p-2.5 sm:p-3.5 border-b border-slate-800 print:hidden">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider block text-slate-100 truncate">
              Quotation #{docNo}
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:block truncate">
              Yashoth Enterprises · 100% Authentic Letterhead & Seal
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Zoom & Fit Controls */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => {
                setIsFitToWidth(false);
                setZoomLevel((prev) => Math.max(0.35, prev - 0.1));
              }}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => {
                setIsFitToWidth(false);
                setZoomLevel((prev) => Math.min(1.4, prev + 0.1));
              }}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleToggleFit}
              className={`p-1 rounded text-slate-300 hover:text-white ml-0.5 ${
                isFitToWidth ? 'bg-red-600 text-white font-bold' : 'hover:bg-slate-700'
              }`}
              title={isFitToWidth ? 'Fit Active (Click for 100%)' : 'Click to Fit Mobile Screen'}
            >
              {isFitToWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer min-h-[36px]"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print / PDF (A4)</span>
            <span className="sm:hidden">Print</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
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
              padding: 5mm 8mm !important;
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

      {/* Outer scrollable viewport */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto overflow-y-auto max-h-[85vh] p-1 sm:p-4 flex justify-center bg-slate-950/60"
      >
        {/* Scaled wrapper */}
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            width: '794px',
            marginBottom: zoomLevel < 1 ? `calc((794px * ${1 - zoomLevel}) * -1.2)` : '0px'
          }}
          className="transition-transform duration-100 ease-out shrink-0"
        >
          {/* ========================================================================= */}
          {/* EXACT 1000% OFFICIAL YASHOTH ENTERPRISES QUOTATION DOCUMENT              */}
          {/* ========================================================================= */}
          <div
            ref={printRef}
            id="quotation-single-sheet"
            className="bg-white text-black p-6 sm:p-8 rounded-sm shadow-2xl mx-auto w-[794px] min-h-[1123px] text-[11px] leading-tight font-sans print:shadow-none print:border-none print:p-0 print:m-0"
            style={{ boxSizing: 'border-box' }}
          >
            {/* ------------------------------------------------------------- */}
            {/* 1. EXACT OFFICIAL LETTERHEAD (Direct from Word Document)      */}
            {/* ------------------------------------------------------------- */}
            <div className="w-full mb-3 select-none">
              {/* Top Banner: Prop. P. NANDHA KUMAR, GSTIN, CONTACT, & 3D Logo */}
              <img
                src={QUOTATION_HEADER_BANNER}
                alt="Yashoth Enterprises Letterhead & Logo"
                className="w-full h-auto object-contain block"
              />

              {/* Address and Email Banner */}
              <img
                src={QUOTATION_ADDRESS_BANNER}
                alt="Registered Address and Email"
                className="w-full h-auto object-contain block mt-1"
              />

              {/* Dual Red Horizontal Line Divider */}
              <img
                src={QUOTATION_DIVIDER_BANNER}
                alt="Red Divider"
                className="w-full h-auto object-contain block my-2"
              />
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 2. SALUTATION & PREAMBLE                                      */}
            {/* ------------------------------------------------------------- */}
            <div className="mb-2 text-black text-[12px] font-normal leading-relaxed">
              <p className="font-bold">Dear IMOP,</p>
              <p className="mt-1">
                We thank you very much for your esteemed enquiry. We are pleased to quote our best price in the market as per the terms and conditions mentioned below.
              </p>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* 3. EXACT 8-COLUMN GRID TABLE (Matching Word XML 100%)         */}
            {/* ------------------------------------------------------------- */}
            <div className="border border-black mb-3">
              <table className="w-full border-collapse text-[11px]">
                <tbody>
                  {/* Row 0: QUOTATION Header */}
                  <tr className="border-b border-black">
                    <td colSpan={8} className="py-1 text-center font-bold text-sm tracking-wider uppercase bg-white">
                      QUOTATION
                    </td>
                  </tr>

                  {/* Row 1: To & Date */}
                  <tr className="border-b border-black">
                    <td colSpan={5} className="p-1.5 border-r border-black font-bold align-top">
                      To
                    </td>
                    <td colSpan={2} className="p-1.5 border-r border-black font-bold">
                      DATE
                    </td>
                    <td colSpan={1} className="p-1.5 font-normal text-right whitespace-nowrap">
                      {docDate}
                    </td>
                  </tr>

                  {/* Row 2: Customer Name & Ref No */}
                  <tr className="border-b border-black">
                    <td colSpan={5} className="p-1.5 border-r border-black font-bold uppercase text-black align-top">
                      {partyName}
                    </td>
                    <td colSpan={2} className="p-1.5 border-r border-black font-bold">
                      REF.NO-QUOTATION
                    </td>
                    <td colSpan={1} className="p-1.5 font-normal text-right whitespace-nowrap">
                      {docNo}
                    </td>
                  </tr>

                  {/* Row 3: City & Your Ref */}
                  <tr className="border-b border-black">
                    <td colSpan={5} className="p-1.5 border-r border-black font-bold uppercase text-black align-top">
                      {partyAddress}
                    </td>
                    <td colSpan={2} className="p-1.5 border-r border-black font-bold">
                      YOURREF
                    </td>
                    <td colSpan={1} className="p-1.5 font-normal text-right uppercase whitespace-nowrap">
                      {refNo}
                    </td>
                  </tr>

                  {/* Row 4: Pincode & Dated */}
                  <tr className="border-b border-black">
                    <td colSpan={5} className="p-1.5 border-r border-black font-bold text-black align-top">
                      PINCODE:{partyPincode}
                    </td>
                    <td colSpan={2} className="p-1.5 border-r border-black font-bold">
                      DATED
                    </td>
                    <td colSpan={1} className="p-1.5 font-normal text-right whitespace-nowrap">
                      {docDate}
                    </td>
                  </tr>

                  {/* Row 5: Kindly Attend */}
                  <tr className="border-b border-black">
                    <td colSpan={8} className="p-1.5 font-bold">
                      Kindly Attend
                    </td>
                  </tr>

                  {/* Row 6: Equity Acknowledgment */}
                  <tr className="border-b border-black">
                    <td colSpan={8} className="p-1.5 font-normal text-[11px] leading-snug">
                      We thank you very much for your esteemed equity. We are pleased to quote our best price as per teams and conditions.
                    </td>
                  </tr>

                  {/* Row 7: Items Table Header */}
                  <tr className="border-b border-black font-bold text-center bg-white">
                    <td className="p-1.5 border-r border-black w-14">SLNO.</td>
                    <td className="p-1.5 border-r border-black text-left">PARTNAME/MODEL</td>
                    <td className="p-1.5 border-r border-black w-16">CODE</td>
                    <td className="p-1.5 border-r border-black w-14">UNIT</td>
                    <td colSpan={2} className="p-1.5 border-r border-black text-right w-24">QTY</td>
                    <td colSpan={2} className="p-1.5 text-right w-24">PRICE/Kg</td>
                  </tr>

                  {/* Rows 8 to 18: Scrap Line Items */}
                  {items.map((item) => (
                    <tr key={item.slNo} className="border-b border-black">
                      <td className="p-1.5 border-r border-black text-center font-normal">
                        {item.slNo}
                      </td>
                      <td className="p-1.5 border-r border-black text-left font-normal">
                        {item.partName}
                      </td>
                      <td className="p-1.5 border-r border-black text-center font-normal">
                        {item.code}
                      </td>
                      <td className="p-1.5 border-r border-black text-center font-normal">
                        {item.unit}
                      </td>
                      <td colSpan={2} className="p-1.5 border-r border-black text-right font-normal whitespace-nowrap">
                        {item.qty}
                      </td>
                      <td colSpan={2} className="p-1.5 text-right font-normal whitespace-nowrap">
                        {item.pricePerKg}
                      </td>
                    </tr>
                  ))}

                  {/* Row 19: Teams and Conditions Header */}
                  <tr className="border-b border-black">
                    <td colSpan={8} className="p-1.5 font-bold uppercase">
                      TEAMS AND CONDITIONS:
                    </td>
                  </tr>

                  {/* Row 20: TAX */}
                  <tr className="border-b border-black">
                    <td colSpan={8} className="p-1.5 font-normal">
                      <span className="font-bold inline-block w-24">TAX</span>: Taxes Extra
                    </td>
                  </tr>

                  {/* Row 21: PAYMENT */}
                  <tr className="border-b border-black">
                    <td colSpan={8} className="p-1.5 font-normal">
                      <span className="font-bold inline-block w-24">PAYMENT</span>: Immediate
                    </td>
                  </tr>

                  {/* Row 22: Spacer */}
                  <tr className="h-4 border-b border-black">
                    <td colSpan={8}></td>
                  </tr>

                  {/* Row 23: Company Name for Signature */}
                  <tr className="border-b-0">
                    <td colSpan={8} className="p-2 text-right font-bold text-xs uppercase pr-6">
                      For YASHOTH ENTERPRISES
                    </td>
                  </tr>

                  {/* Row 24: Real Seal & Real Signature Image */}
                  <tr>
                    <td colSpan={8} className="p-2 pr-4 text-right">
                      <div className="inline-flex flex-col items-center">
                        <img
                          src={QUOTATION_STAMP_SIGNATURE}
                          alt="Official Rubber Stamp & Proprietor Signature"
                          className="w-48 h-auto object-contain block mb-1"
                        />
                        <span className="font-bold text-xs text-black block mt-1">
                          Authorized Signature
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
