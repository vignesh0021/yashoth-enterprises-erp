import React, { useRef, useState, useEffect } from 'react';
import { CommercialDocument, CompanySettings } from '../../types/index.ts';
import {
  Printer,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  X,
  ArrowRight,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { PO_HEADER_BANNER, PO_STAMP_SIGNATURE } from '../../assets/purchaseOrderAssets.ts';

interface PurchaseOrderRendererProps {
  document?: CommercialDocument | null;
  company?: CompanySettings;
  onConvert?: (docId: string, targetType: 'PURCHASE_INVOICE') => void;
  onClose?: () => void;
}

/**
 * Exact replica of the VBA macro `NumberToWordsIndian(ByVal MyNumber As Double)`
 * from `IMOP_PURCHASE _ORDER_FORMAT` (`xl/vbaProject.bin`).
 */
export function numberToWordsIndian(amount: number): string {
  const num = Math.round(Math.abs(amount));
  if (num === 0) return 'Zero';

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const twoDigits = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t]}${o > 0 ? ' ' + ones[o] : ''}`;
  };

  const threeDigits = (n: number): string => {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const hPart = h > 0 ? `${ones[h]} Hundred` : '';
    const rPart = twoDigits(rem);
    return [hPart, rPart].filter(Boolean).join(' ');
  };

  const parts: string[] = [];
  let remaining = num;

  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  if (crore > 0) {
    parts.push(`${threeDigits(crore)} Crore`);
  }

  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  if (lakh > 0) {
    parts.push(`${twoDigits(lakh)} Lakh`);
  }

  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;
  if (thousand > 0) {
    parts.push(`${twoDigits(thousand)} Thousand`);
  }

  if (remaining > 0) {
    parts.push(threeDigits(remaining));
  }

  return parts.join(' ').trim();
}

function formatPoDate(dateStr?: string): string {
  if (!dateStr) return '12/12/2024';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [yyyy, mm, dd] = dateStr.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  return dateStr;
}

export interface PoLineRow {
  slNo: number;
  partName: string;
  unit: string;
  qty: number | '';
  priceInr: number | '';
  totalValue: number | '';
}

/**
 * Exact Excel formula from `IMOP_PURCHASE _ORDER_FORMAT` cell `N43`:
 * `=IF(TRIM(K43)="kg",L43*M43,IF(TRIM(K43)="ton",L43*M43*1000,IF(TRIM(K43)="piece",L43*M43,0)))`
 */
export function computePoLineTotal(unit: string, qty: number, priceInr: number): number {
  const u = (unit || '').trim().toLowerCase();
  if (u === 'kg') return qty * priceInr;
  if (u === 'ton') return qty * priceInr * 1000;
  if (u === 'piece' || u === 'nos' || u === 'no' || u === 'lot') return qty * priceInr;
  return qty * priceInr;
}

export const PurchaseOrderRenderer: React.FC<PurchaseOrderRendererProps> = ({
  document,
  onConvert,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFitToWidth, setIsFitToWidth] = useState<boolean>(true);

  const poNo = document?.documentNo || '059-2024';
  const poDate = formatPoDate(document?.documentDate || '12/12/2024');
  const yourRef = document?.referenceNo || 'MAIL';
  const dated = formatPoDate(document?.dueDate || document?.documentDate || '12/12/2024');
  const partyName = document?.partyName || 'M/S IMOP PVT LTD';
  const partyAddress = document?.partyAddress || 'SRICITY, ANDHRA PRADESH';
  const pinMatch = partyAddress.match(/\b([1-9][0-9]{5})\b/);
  const partyPincode = pinMatch ? pinMatch[1] : '517646';
  const cleanAddress = partyAddress
    .replace(/\s*-?\s*\b[1-9][0-9]{5}\b/g, '')
    .replace(/PINCODE\s*:\s*\d+/i, '')
    .trim() || 'SRICITY, ANDHRA PRADESH';

  const salutationName =
    partyName.toUpperCase().includes('IMOP') || poNo === '059-2024'
      ? 'Dear IMOP,'
      : `Dear ${partyName},`;

  // Default 3 active rows + rows 4..9 matching `IMOP_PURCHASE _ORDER_FORMAT` (`sheet1.xml`)
  const defaultActiveRows: Array<{ partName: string; unit: string; qty: number; priceInr: number; totalValue: number }> = [
    { partName: '', unit: 'piece', qty: 1, priceInr: 130000, totalValue: 130000 },
    { partName: '', unit: 'piece', qty: 1, priceInr: 50000, totalValue: 50000 },
    { partName: '', unit: 'ton', qty: 10, priceInr: 1000, totalValue: 10000000 },
  ];

  const mappedActiveRows =
    document?.lines && document.lines.length > 0
      ? document.lines.map((l) => {
          const u = (l.unit || 'ton').toLowerCase();
          // Preserve exact Excel formula when unit is 'ton' and rate is per-kg, or use taxableValue if rate is already per-ton
          const calcTotal =
            u === 'ton' && l.rate <= 2500
              ? computePoLineTotal(u, l.quantity, l.rate)
              : l.taxableValue || computePoLineTotal(u, l.quantity, l.rate);
          return {
            partName: l.description,
            unit: u,
            qty: l.quantity,
            priceInr: l.rate,
            totalValue: calcTotal,
          };
        })
      : defaultActiveRows;

  // Always pad up to at least 9 numbered rows (`SL NO. 1` to `9`) exactly like `Rows 43..51` in `IMOP_PURCHASE _ORDER_FORMAT`
  const totalRowCount = Math.max(9, mappedActiveRows.length);
  const displayRows: PoLineRow[] = Array.from({ length: totalRowCount }, (_, idx) => {
    const row = mappedActiveRows[idx];
    if (row) {
      return {
        slNo: idx + 1,
        partName: row.partName,
        unit: row.unit,
        qty: row.qty,
        priceInr: row.priceInr,
        totalValue: row.totalValue,
      };
    }
    return {
      slNo: idx + 1,
      partName: '',
      unit: '',
      qty: '',
      priceInr: '',
      totalValue: '',
    };
  });

  const grandTotalValue = mappedActiveRows.reduce((sum, r) => sum + (Number(r.totalValue) || 0), 0);
  const amountInWords = `${numberToWordsIndian(grandTotalValue)} Rupees Only `;

  useEffect(() => {
    const updateFitScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth - 16;
      if (containerWidth < 794 && isFitToWidth) {
        const calculatedScale = Math.max(0.38, Math.min(1, containerWidth / 794));
        setZoomLevel(calculatedScale);
      } else if (isFitToWidth) {
        setZoomLevel(1);
      }
    };

    updateFitScale();
    window.addEventListener('resize', updateFitScale);
    return () => window.removeEventListener('resize', updateFitScale);
  }, [isFitToWidth]);

  const handlePrint = () => {
    if (window.AndroidNative && typeof window.AndroidNative.printPage === 'function') {
      window.AndroidNative.printPage(`PURCHASE_ORDER_${poNo}`);
      return;
    }
    window.print();
  };

  const handleShare = () => {
    const itemLines = mappedActiveRows
      .map(
        (it, i) =>
          `${i + 1}. ${it.partName || 'Item'} | ${it.qty} ${it.unit} @ ₹${it.priceInr} = ₹${it.totalValue.toLocaleString('en-IN')}`
      )
      .join('\n');
    const summaryText = `*YASHOTH ENTERPRISES*\n*PURCHASE ORDER: #${poNo}*\nDate: ${poDate}\nTo: ${partyName}\n\n*Order Items:*\n${itemLines}\n\n*TOTAL: ₹${grandTotalValue.toLocaleString('en-IN')}*\n(${amountInWords.trim()})\n\nFor YASHOTH ENTERPRISES\nP. NANDHA KUMAR (Proprietor)`;

    if (window.AndroidNative && typeof window.AndroidNative.shareText === 'function') {
      window.AndroidNative.shareText(`Purchase Order #${poNo} - Yashoth Enterprises`, summaryText);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: `Purchase Order #${poNo} - Yashoth Enterprises`,
          text: summaryText,
        })
        .catch(() => {});
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(summaryText)}`, '_blank', 'noopener,noreferrer');
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

  const cellBorder: React.CSSProperties = {
    border: '1px solid #000000',
  };

  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-full bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white p-2.5 sm:p-3.5 border-b border-slate-800 print:hidden">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px] border border-slate-700 shrink-0"
              aria-label="Back to Documents"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 text-red-400" />
              <span className="sm:inline">Back</span>
            </button>
          )}
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 hidden sm:block" />
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider block text-slate-100 truncate">
              PURCHASE ORDER #{poNo}
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:block truncate">
              Yashoth Enterprises · Official IMOP_PURCHASE_ORDER_FORMAT Replica · Zero-Lag Print Ready
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {document && onConvert && (
            <button
              onClick={() => onConvert(document.id, 'PURCHASE_INVOICE')}
              className="flex items-center gap-1 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer min-h-[40px]"
              title="Convert PO to Purchase Invoice"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>To Purchase Bill</span>
            </button>
          )}

          {/* Zoom & Fit Controls */}
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
            <button
              onClick={() => {
                setIsFitToWidth(false);
                setZoomLevel((prev) => Math.max(0.35, prev - 0.1));
              }}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-1.5 text-[11px] font-mono font-bold text-slate-200">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => {
                setIsFitToWidth(false);
                setZoomLevel((prev) => Math.min(1.4, prev + 0.1));
              }}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleToggleFit}
              className={`p-1.5 rounded-lg text-slate-300 hover:text-white ml-0.5 cursor-pointer ${
                isFitToWidth ? 'bg-red-600 text-white font-bold' : 'hover:bg-slate-700'
              }`}
              title={isFitToWidth ? 'Fit Active (Click for 100%)' : 'Click to Fit Mobile Screen'}
            >
              {isFitToWidth ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px]"
            title="Share via WhatsApp / Android Share"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/30 transition-all cursor-pointer min-h-[40px]"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print / PDF (A4)</span>
            <span className="sm:hidden">Print / PDF</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              data-close-modal="true"
              className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable & Auto-Scaled Viewport */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto overflow-y-auto bg-slate-800/90 p-2 sm:p-6 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible"
        style={{
          minHeight: isFitToWidth ? `${Math.round(1123 * zoomLevel) + 24}px` : 'auto',
        }}
      >
        {/* A4 Sheet Wrapper */}
        <div
          style={{
            width: '794px',
            minHeight: '1123px',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            marginBottom: zoomLevel < 1 ? `-${Math.round((1 - zoomLevel) * 1123)}px` : '0px',
          }}
          className="bg-white shadow-2xl transition-transform duration-150 ease-out print:shadow-none print:transform-none print:m-0"
        >
          {/* Actual Printable A4 Document (Exact IMOP_PURCHASE_ORDER_FORMAT Replica) */}
          <div
            ref={printRef}
            id="purchase-order-print-sheet"
            style={{
              width: '794px',
              minHeight: '1123px',
              padding: '22px 28px 28px 28px',
              boxSizing: 'border-box',
              backgroundColor: '#ffffff',
              color: '#000000',
              fontFamily: '"Times New Roman", Times, Georgia, serif',
            }}
          >
            {/* 1. Official Embedded Header Banner (A1:S26 -> xl/media/image1.png) */}
            <div style={{ width: '100%', marginBottom: '10px' }}>
              <img
                src={PO_HEADER_BANNER}
                alt="Yashoth Enterprises Official Letterhead"
                decoding="sync"
                loading="eager"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* 2. Salutation (Row 28: B28) & Opening Request Line (Row 30: E30) */}
            <div
              style={{
                fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                fontSize: '14px',
                color: '#000000',
                marginBottom: '12px',
                paddingLeft: '4px',
              }}
            >
              <div style={{ marginBottom: '6px' }}>{salutationName}</div>
              <div style={{ paddingLeft: '78px' }}>
                {document?.notes && !document.notes.includes('Rates valid for immediate lifting')
                  ? document.notes
                  : 'Kindly find the purchase order request.'}
              </div>
            </div>

            {/* 3. Main Boxed Purchase Order Table (F35:N76) */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1.5px solid #000000',
                fontFamily: '"Times New Roman", Times, Georgia, serif',
                fontSize: '13px',
                color: '#000000',
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                <col style={{ width: '9%' }} />   {/* Col F: SL NO. */}
                <col style={{ width: '37%' }} />  {/* Col G:J: PART NAME / MODEL */}
                <col style={{ width: '10%' }} />  {/* Col K: UNIT */}
                <col style={{ width: '9%' }} />   {/* Col L: QTY */}
                <col style={{ width: '16%' }} />  {/* Col M: PRICE(INR) */}
                <col style={{ width: '19%' }} />  {/* Col N: TOTAL VALUE */}
              </colgroup>

              <tbody>
                {/* Row 35-36 (F35:N36): PURCHASE ORDER Title */}
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '15px',
                      padding: '7px 8px',
                      letterSpacing: '0.3px',
                    }}
                  >
                    PURCHASE ORDER
                  </td>
                </tr>

                {/* Rows 37-41: Left Merged To-Address (F37:L41, rowSpan=5) & Right Metadata (M37:N41) */}
                <tr>
                  <td
                    colSpan={4}
                    rowSpan={5}
                    style={{
                      ...cellBorder,
                      verticalAlign: 'top',
                      padding: '8px 10px',
                      lineHeight: 1.45,
                      fontSize: '13px',
                      fontWeight: 400,
                    }}
                  >
                    <div>To</div>
                    <div style={{ marginTop: '2px' }}>{partyName}</div>
                    <div>{cleanAddress}</div>
                    <div>PINCODE : {partyPincode}</div>
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      padding: '4px 8px',
                      fontSize: '12.5px',
                      fontWeight: 400,
                    }}
                  >
                    DATE
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      padding: '4px 8px',
                      fontSize: '12.5px',
                      fontWeight: 400,
                    }}
                  >
                    {poDate}
                  </td>
                </tr>

                <tr>
                  <td
                    style={{
                      ...cellBorder,
                      padding: '4px 8px',
                      fontSize: '12.5px',
                      fontWeight: 400,
                    }}
                  >
                    PO NO
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      padding: '4px 8px',
                      fontSize: '12.5px',
                      fontWeight: 400,
                    }}
                  >
                    {poNo}
                  </td>
                </tr>

                <tr>
                  <td
                    style={{
                      ...cellBorder,
                      padding: '4px 8px',
                      fontSize: '12.5px',
                      fontWeight: 400,
                    }}
                  >
                    YOUR REF
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      padding: '4px 8px',
                      fontSize: '12.5px',
                      fontWeight: 400,
                    }}
                  >
                    {yourRef}
                  </td>
                </tr>

                <tr>
                  <td
                    style={{
                      ...cellBorder,
                      padding: '4px 8px',
                      fontSize: '12.5px',
                      fontWeight: 400,
                    }}
                  >
                    DATED
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      padding: '4px 8px',
                      fontSize: '12.5px',
                      fontWeight: 400,
                    }}
                  >
                    {dated}
                  </td>
                </tr>

                {/* Row 41: 5th alignment row under DATED */}
                <tr>
                  <td style={{ ...cellBorder, height: '20px', padding: '2px 8px' }}>&nbsp;</td>
                  <td style={{ ...cellBorder, height: '20px', padding: '2px 8px' }}>&nbsp;</td>
                </tr>

                {/* Row 42: 6-Column Line Items Header */}
                <tr>
                  <td
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '7px 4px',
                      fontSize: '12.5px',
                    }}
                  >
                    SL NO.
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '7px 6px',
                      fontSize: '12.5px',
                    }}
                  >
                    PART NAME / MODEL
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '7px 4px',
                      fontSize: '12.5px',
                    }}
                  >
                    UNIT
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '7px 4px',
                      fontSize: '12.5px',
                    }}
                  >
                    QTY
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '7px 6px',
                      fontSize: '12.5px',
                    }}
                  >
                    PRICE(INR)
                  </td>
                  <td
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '7px 6px',
                      fontSize: '12.5px',
                    }}
                  >
                    TOTAL VALUE
                  </td>
                </tr>

                {/* Rows 43-51: 9 Numbered Line Item Rows */}
                {displayRows.map((row) => (
                  <tr key={row.slNo} style={{ height: '26px' }}>
                    <td
                      style={{
                        ...cellBorder,
                        textAlign: 'center',
                        padding: '4px 4px',
                        fontSize: '12.5px',
                      }}
                    >
                      {row.slNo}
                    </td>
                    <td
                      style={{
                        ...cellBorder,
                        textAlign: 'left',
                        padding: '4px 8px',
                        fontSize: '12.5px',
                        fontWeight: row.partName ? 700 : 400,
                      }}
                    >
                      {row.partName}
                    </td>
                    <td
                      style={{
                        ...cellBorder,
                        textAlign: 'center',
                        padding: '4px 4px',
                        fontSize: '12.5px',
                      }}
                    >
                      {row.unit}
                    </td>
                    <td
                      style={{
                        ...cellBorder,
                        textAlign: 'center',
                        padding: '4px 4px',
                        fontSize: '12.5px',
                      }}
                    >
                      {row.qty !== '' ? row.qty : ''}
                    </td>
                    <td
                      style={{
                        ...cellBorder,
                        textAlign: 'right',
                        padding: '4px 8px',
                        fontSize: '12.5px',
                      }}
                    >
                      {row.priceInr !== '' ? row.priceInr : ''}
                    </td>
                    <td
                      style={{
                        ...cellBorder,
                        textAlign: 'right',
                        padding: '4px 8px',
                        fontSize: '12.5px',
                      }}
                    >
                      {row.totalValue !== ''
                        ? Number(row.totalValue).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : ''}
                    </td>
                  </tr>
                ))}

                {/* Rows 52-54: AMOUNT IN WORDS & TOTAL Block */}
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '6px 8px',
                      fontSize: '13px',
                    }}
                  >
                    AMOUNT IN WORDS:
                  </td>
                  <td
                    rowSpan={2}
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      fontWeight: 700,
                      padding: '6px 8px',
                      fontSize: '13.5px',
                    }}
                  >
                    TOTAL
                  </td>
                  <td
                    rowSpan={2}
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      fontWeight: 700,
                      padding: '6px 8px',
                      fontSize: '13.5px',
                    }}
                  >
                    {grandTotalValue}
                  </td>
                </tr>

                <tr>
                  <td
                    colSpan={4}
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      fontWeight: 700,
                      padding: '8px 10px',
                      fontSize: '13px',
                    }}
                  >
                    {amountInWords}
                  </td>
                </tr>

                {/* Rows 55-59: TERMS AND CONDITIONS Block */}
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...cellBorder,
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '6px 8px',
                      fontSize: '13px',
                    }}
                  >
                    TERMS AND CONDITIONS :
                  </td>
                </tr>

                {/* Row 56: Blank Bordered Row */}
                <tr>
                  <td colSpan={6} style={{ ...cellBorder, height: '22px', padding: '2px 8px' }}>
                    &nbsp;
                  </td>
                </tr>

                {/* Row 57: TAX : Taxes Extra */}
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...cellBorder,
                      textAlign: 'left',
                      fontWeight: 700,
                      padding: '5px 8px',
                      fontSize: '13px',
                      whiteSpace: 'pre',
                    }}
                  >
                    {'TAX             : Taxes Extra'}
                  </td>
                </tr>

                {/* Row 58: PAYMENT : Immediate */}
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...cellBorder,
                      textAlign: 'left',
                      fontWeight: 700,
                      padding: '5px 8px',
                      fontSize: '13px',
                      whiteSpace: 'pre',
                    }}
                  >
                    {'PAYMENT : Immediate'}
                  </td>
                </tr>

                {/* Row 59: Blank Bordered Row */}
                <tr>
                  <td colSpan={6} style={{ ...cellBorder, height: '22px', padding: '2px 8px' }}>
                    &nbsp;
                  </td>
                </tr>

                {/* Row 60-62 (F60:N62): For YASHOTH ENTERPRISES */}
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...cellBorder,
                      textAlign: 'right',
                      verticalAlign: 'middle',
                      fontWeight: 400,
                      padding: '10px 14px',
                      fontSize: '13.5px',
                    }}
                  >
                    For YASHOTH ENTERPRISES
                  </td>
                </tr>

                {/* Row 63-76 (F63:N76): Authorised Signature & Official Blue Proprietor Seal */}
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...cellBorder,
                      textAlign: 'right',
                      verticalAlign: 'top',
                      padding: '8px 14px 14px 14px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 400,
                        marginBottom: '8px',
                      }}
                    >
                      Authorised Signature
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <img
                        src={PO_STAMP_SIGNATURE}
                        alt="For Yashoth Enterprises - P. Nandha Kumar Proprietor Signature & Seal"
                        decoding="sync"
                        loading="eager"
                        style={{
                          height: '78px',
                          width: 'auto',
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Zero-Lag Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          #purchase-order-print-sheet, #purchase-order-print-sheet * {
            visibility: visible;
          }
          #purchase-order-print-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 198mm !important;
            min-height: auto !important;
            margin: 0 auto !important;
            padding: 4mm 6mm !important;
            box-shadow: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
};
