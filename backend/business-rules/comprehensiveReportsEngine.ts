// Yasoth Enterprises Scrap ERP — Phase 11 Comprehensive 20-Report Business Intelligence & Export Engine
// Supports Daily, Weekly, Monthly, Annual, and Custom date filters + UTF-8 BOM CSV (Tamil & English safe)

import type {
  PurchaseHeader,
  SalesHeader,
  Invoice,
  Weighment,
  StockMovement,
  InventoryLot,
  Material,
  Yard,
  Party,
  CashBankAccount,
  AccountTransaction,
  Expense,
  MonthlySalaryRecord,
  MaterialDispatch,
  GodownTransfer,
  ManagedDocument,
  UploadedDocument,
  BackupHistoryItem,
  RestoreLog,
  JournalEntry,
} from '../../src/types/index.ts';
import { roundTo2, roundTo3 } from '../../src/utils/calculations.ts';
import { computeStockLedgerSummary } from './inventoryEngine.ts';
import { calculateReconciledAccountBalance } from './financeEngine.ts';
import { generateProfitAndLoss } from './accountingEngine.ts';
import { computeStorageMonitorSnapshot } from './documentStorageEngine.ts';

export type ReportPeriodPreset = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'CUSTOM';

export type BusinessReportId =
  | 'DAILY_PURCHASE'
  | 'DAILY_SALES'
  | 'MATERIAL_INWARD'
  | 'MATERIAL_OUTWARD'
  | 'STOCK_LEDGER'
  | 'SOURCE_WISE_STOCK'
  | 'GODOWN_WISE_STOCK'
  | 'MATERIAL_MOVEMENT'
  | 'PENDING_DISPATCH'
  | 'TRANSFER_REPORT'
  | 'WEIGHBRIDGE_RECONCILIATION'
  | 'SUPPLIER_OUTSTANDING'
  | 'CUSTOMER_OUTSTANDING'
  | 'CASH_BANK_REPORT'
  | 'PROFIT_LOSS'
  | 'WORKER_SALARY'
  | 'EXPENSE_REPORT'
  | 'OWNER_BUSINESS_SUMMARY'
  | 'DOCUMENT_STORAGE'
  | 'BACKUP_RESTORE';

export interface BusinessReportDefinition {
  id: BusinessReportId;
  number: number;
  title: string;
  tamilTitle: string;
  category: 'INVENTORY' | 'OPERATIONS' | 'FINANCE' | 'GOVERNANCE';
}

export const ALL_20_BUSINESS_REPORTS: BusinessReportDefinition[] = [
  { id: 'DAILY_PURCHASE', number: 1, title: 'Daily Purchase Report', tamilTitle: 'தினசரி கொள்முதல் அறிக்கை', category: 'OPERATIONS' },
  { id: 'DAILY_SALES', number: 2, title: 'Daily Sales Report', tamilTitle: 'தினசரி விற்பனை அறிக்கை', category: 'OPERATIONS' },
  { id: 'MATERIAL_INWARD', number: 3, title: 'Material Inward Report', tamilTitle: 'பொருள் வரவு அறிக்கை', category: 'INVENTORY' },
  { id: 'MATERIAL_OUTWARD', number: 4, title: 'Material Outward Report', tamilTitle: 'பொருள் அனுப்புதல் அறிக்கை', category: 'INVENTORY' },
  { id: 'STOCK_LEDGER', number: 5, title: 'Stock Ledger', tamilTitle: 'இருப்புப் பேரேடு', category: 'INVENTORY' },
  { id: 'SOURCE_WISE_STOCK', number: 6, title: 'Source-wise Stock Report', tamilTitle: 'மூல வாரியான இருப்பு அறிக்கை', category: 'INVENTORY' },
  { id: 'GODOWN_WISE_STOCK', number: 7, title: 'Godown-wise Stock Report', tamilTitle: 'கிடங்கு வாரியான இருப்பு அறிக்கை', category: 'INVENTORY' },
  { id: 'MATERIAL_MOVEMENT', number: 8, title: 'Material Movement Report', tamilTitle: 'பொருள் நகர்வு அறிக்கை', category: 'INVENTORY' },
  { id: 'PENDING_DISPATCH', number: 9, title: 'Pending Dispatch Report', tamilTitle: 'நிலுவை அனுப்புதல் அறிக்கை', category: 'OPERATIONS' },
  { id: 'TRANSFER_REPORT', number: 10, title: 'Transfer Report', tamilTitle: 'கிடங்கு மாற்றம் அறிக்கை', category: 'OPERATIONS' },
  { id: 'WEIGHBRIDGE_RECONCILIATION', number: 11, title: 'Weighbridge Reconciliation', tamilTitle: 'வேபிரிட்ஜ் ஒப்பீட்டு அறிக்கை', category: 'OPERATIONS' },
  { id: 'SUPPLIER_OUTSTANDING', number: 12, title: 'Supplier Outstanding', tamilTitle: 'விநியோகஸ்தர் நிலுவை', category: 'FINANCE' },
  { id: 'CUSTOMER_OUTSTANDING', number: 13, title: 'Customer Outstanding', tamilTitle: 'வாடிக்கையாளர் நிலுவை', category: 'FINANCE' },
  { id: 'CASH_BANK_REPORT', number: 14, title: 'Cash and Bank Report', tamilTitle: 'ரொக்கம் மற்றும் வங்கி அறிக்கை', category: 'FINANCE' },
  { id: 'PROFIT_LOSS', number: 15, title: 'Profit and Loss', tamilTitle: 'லாப நட்ட அறிக்கை', category: 'FINANCE' },
  { id: 'WORKER_SALARY', number: 16, title: 'Worker Salary Report', tamilTitle: 'தொழிலாளர் சம்பள அறிக்கை', category: 'FINANCE' },
  { id: 'EXPENSE_REPORT', number: 17, title: 'Expense Report', tamilTitle: 'செலவு அறிக்கை', category: 'FINANCE' },
  { id: 'OWNER_BUSINESS_SUMMARY', number: 18, title: 'Owner Business Summary', tamilTitle: 'உரிமையாளர் வணிகச் சுருக்கம்', category: 'FINANCE' },
  { id: 'DOCUMENT_STORAGE', number: 19, title: 'Document Storage Report', tamilTitle: 'ஆவண சேமிப்பு அறிக்கை', category: 'GOVERNANCE' },
  { id: 'BACKUP_RESTORE', number: 20, title: 'Backup and Restore Report', tamilTitle: 'காப்பு மற்றும் மீட்டெடுப்பு அறிக்கை', category: 'GOVERNANCE' },
];

export function resolveReportDateRange(
  preset: ReportPeriodPreset,
  referenceDateStr: string,
  customFrom?: string,
  customTo?: string
): { fromDate: string; toDate: string } {
  const ref = referenceDateStr.slice(0, 10);
  const dt = new Date(`${ref}T00:00:00`);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'CUSTOM' && customFrom && customTo) {
    return { fromDate: customFrom.slice(0, 10), toDate: customTo.slice(0, 10) };
  }
  if (preset === 'DAILY') {
    return { fromDate: ref, toDate: ref };
  }
  if (preset === 'WEEKLY') {
    const start = new Date(dt);
    start.setDate(dt.getDate() - 6);
    return { fromDate: fmt(start), toDate: ref };
  }
  if (preset === 'MONTHLY') {
    const start = new Date(dt.getFullYear(), dt.getMonth(), 1);
    return { fromDate: fmt(start), toDate: ref };
  }
  // ANNUAL (Indian Financial Year Apr 1 -> Mar 31)
  const fyStartYear = dt.getMonth() >= 3 ? dt.getFullYear() : dt.getFullYear() - 1;
  return { fromDate: `${fyStartYear}-04-01`, toDate: ref };
}

export interface ReportTableResult {
  reportId: BusinessReportId;
  title: string;
  tamilTitle: string;
  fromDate: string;
  toDate: string;
  headers: string[];
  rows: (string | number)[][];
  summaryMetrics: { label: string; value: string | number }[];
}

export interface ComprehensiveReportDataInput {
  companyId: string;
  purchases: PurchaseHeader[];
  sales: SalesHeader[];
  invoices: Invoice[];
  weighments: Weighment[];
  stockMovements: StockMovement[];
  inventoryLots: InventoryLot[];
  materials: Material[];
  yards: Yard[];
  parties: Party[];
  accounts: CashBankAccount[];
  accountTransactions: AccountTransaction[];
  expenses: Expense[];
  salaryRecords: MonthlySalaryRecord[];
  materialDispatches: MaterialDispatch[];
  godownTransfers: GodownTransfer[];
  managedDocuments: ManagedDocument[];
  uploadedDocuments: UploadedDocument[];
  backupHistory: BackupHistoryItem[];
  restoreLogs: RestoreLog[];
  journalEntries: JournalEntry[];
}

function inRange(dateStr: string | undefined, fromDate: string, toDate: string): boolean {
  if (!dateStr) return true;
  const d = dateStr.slice(0, 10);
  return d >= fromDate && d <= toDate;
}

export function buildBusinessReport(
  reportId: BusinessReportId,
  data: ComprehensiveReportDataInput,
  fromDate: string,
  toDate: string
): ReportTableResult {
  const def = ALL_20_BUSINESS_REPORTS.find((r) => r.id === reportId)!;
  const partyName = (id?: string) => data.parties.find((p) => p.id === id)?.legalName || '—';
  const matName = (id?: string) => data.materials.find((m) => m.id === id)?.name || '—';
  const yardName = (id?: string) => data.yards.find((y) => y.id === id)?.name || '—';

  switch (reportId) {
    case 'DAILY_PURCHASE': {
      const list = data.purchases.filter((p) => inRange(p.transactionDate, fromDate, toDate));
      const totalAmt = roundTo2(list.reduce((s, p) => s + p.totalAmount, 0));
      const totalKg = roundTo3(list.reduce((s, p) => s + p.lines.reduce((a, l) => a + l.payableWeight, 0), 0));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Purchase No', 'Date', 'Supplier', 'Invoice No', 'Vehicle', 'Net Weight (KG)', 'Total (INR)', 'Status'],
        rows: list.map((p) => [
          p.purchaseNo,
          p.transactionDate.slice(0, 10),
          p.supplierName || partyName(p.supplierPartyId),
          p.supplierInvoiceNo || '—',
          p.vehicleRegistration || '—',
          roundTo3(p.lines.reduce((a, l) => a + l.payableWeight, 0)),
          roundTo2(p.totalAmount),
          p.status,
        ]),
        summaryMetrics: [
          { label: 'Total Purchases', value: list.length },
          { label: 'Total Weight (KG)', value: totalKg },
          { label: 'Total Value (INR)', value: totalAmt },
        ],
      };
    }

    case 'DAILY_SALES': {
      const list = data.sales.filter((s) => inRange(s.orderDate, fromDate, toDate));
      const totalAmt = roundTo2(list.reduce((a, s) => a + s.totalAmount, 0));
      const totalKg = roundTo3(list.reduce((a, s) => a + s.lines.reduce((x, l) => x + l.quantity, 0), 0));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Sales No', 'Date', 'Customer', 'Vehicle', 'Qty (KG)', 'Taxable (INR)', 'Grand Total (INR)', 'Status'],
        rows: list.map((s) => [
          s.salesNo,
          s.orderDate.slice(0, 10),
          partyName(s.customerPartyId),
          s.vehicleRegistration || '—',
          roundTo3(s.lines.reduce((x, l) => x + l.quantity, 0)),
          roundTo2(s.subtotalAmount),
          roundTo2(s.totalAmount),
          s.status,
        ]),
        summaryMetrics: [
          { label: 'Total Orders', value: list.length },
          { label: 'Total Dispatched (KG)', value: totalKg },
          { label: 'Total Sales (INR)', value: totalAmt },
        ],
      };
    }

    case 'MATERIAL_INWARD': {
      const list = data.stockMovements.filter(
        (m) => m.quantity > 0 && inRange(m.createdAt, fromDate, toDate)
      );
      const totalKg = roundTo3(list.reduce((s, m) => s + m.quantity, 0));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Date', 'Type', 'Ref #', 'Material', 'Godown', 'Inward Qty (KG)', 'Unit Cost', 'Total Cost'],
        rows: list.map((m) => [
          m.createdAt.slice(0, 10),
          m.movementType,
          m.transactionRef,
          matName(m.materialId),
          yardName(m.yardId),
          m.quantity,
          m.unitCost,
          m.totalCost,
        ]),
        summaryMetrics: [
          { label: 'Inward Entries', value: list.length },
          { label: 'Total Inward (KG)', value: totalKg },
        ],
      };
    }

    case 'MATERIAL_OUTWARD': {
      const list = data.stockMovements.filter(
        (m) => m.quantity < 0 && inRange(m.createdAt, fromDate, toDate)
      );
      const totalKg = roundTo3(list.reduce((s, m) => s + Math.abs(m.quantity), 0));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Date', 'Type', 'Ref #', 'Material', 'Godown', 'Outward Qty (KG)', 'Unit Cost', 'Total Cost'],
        rows: list.map((m) => [
          m.createdAt.slice(0, 10),
          m.movementType,
          m.transactionRef,
          matName(m.materialId),
          yardName(m.yardId),
          Math.abs(m.quantity),
          m.unitCost,
          m.totalCost,
        ]),
        summaryMetrics: [
          { label: 'Outward Entries', value: list.length },
          { label: 'Total Outward (KG)', value: totalKg },
        ],
      };
    }

    case 'STOCK_LEDGER': {
      const rows = data.materials.map((mat) => {
        const s = computeStockLedgerSummary(data.stockMovements, {
          companyId: data.companyId,
          materialId: mat.id,
          fromDate,
          toDate,
        });
        return [
          mat.name,
          mat.category,
          s.openingStock,
          s.purchaseInward,
          s.transferIn,
          s.salesOutward,
          s.transferOut,
          roundTo3(s.salesReturn - s.purchaseReturn),
          s.closingStock,
        ];
      });
      const totalClosing = roundTo3(rows.reduce((s, r) => s + Number(r[8]), 0));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Material', 'Category', 'Opening', 'Purchase In', 'Transfer In', 'Sales Out', 'Transfer Out', 'Returns Net', 'Closing (KG)'],
        rows,
        summaryMetrics: [
          { label: 'Materials Tracked', value: data.materials.length },
          { label: 'Consolidated Closing (KG)', value: totalClosing },
        ],
      };
    }

    case 'SOURCE_WISE_STOCK': {
      const rows = data.inventoryLots.map((lot) => [
        lot.lotNumber,
        lot.supplierName || lot.sourceType || 'Opening / Yard Stock',
        lot.originalInvoiceNo || lot.sourcePurchaseId || '—',
        matName(lot.materialId),
        yardName(lot.yardId),
        lot.initialQuantity,
        lot.dispatchedQuantity || roundTo3(lot.initialQuantity - lot.remainingQuantity),
        lot.returnedQuantity || 0,
        lot.remainingQuantity,
        lot.unitCost,
      ]);
      const remTotal = roundTo3(data.inventoryLots.reduce((s, l) => s + l.remainingQuantity, 0));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Lot #', 'Source Supplier', 'Invoice / Ref', 'Material', 'Godown', 'Initial (KG)', 'Dispatched (KG)', 'Returned (KG)', 'Remaining (KG)', 'Rate/KG'],
        rows,
        summaryMetrics: [
          { label: 'Total Stock Lots', value: data.inventoryLots.length },
          { label: 'Active Lots', value: data.inventoryLots.filter((l) => !l.isExhausted).length },
          { label: 'Total Remaining (KG)', value: remTotal },
        ],
      };
    }

    case 'GODOWN_WISE_STOCK': {
      const rows: (string | number)[][] = [];
      for (const yard of data.yards) {
        const yardLots = data.inventoryLots.filter((l) => l.yardId === yard.id && !l.isExhausted);
        const totalKg = roundTo3(yardLots.reduce((s, l) => s + l.remainingQuantity, 0));
        const val = roundTo2(yardLots.reduce((s, l) => s + l.remainingQuantity * l.unitCost, 0));
        rows.push([yard.code, yard.name, yard.locationAddress, yardLots.length, totalKg, val]);
      }
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Godown Code', 'Godown Name', 'Location', 'Active Lots', 'Available Stock (KG)', 'Valuation (INR)'],
        rows,
        summaryMetrics: [
          { label: 'Total Godowns', value: data.yards.length },
          { label: 'Combined Stock (KG)', value: roundTo3(rows.reduce((s, r) => s + Number(r[4]), 0)) },
        ],
      };
    }

    case 'MATERIAL_MOVEMENT': {
      const list = data.stockMovements.filter((m) => inRange(m.createdAt, fromDate, toDate));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Timestamp', 'Movement Type', 'Ref #', 'Material', 'Godown', 'Lot ID', 'Qty (KG)', 'Actor'],
        rows: list.map((m) => [
          m.createdAt.slice(0, 19).replace('T', ' '),
          m.movementType,
          m.transactionRef,
          matName(m.materialId),
          yardName(m.yardId),
          m.lotId || '—',
          m.quantity,
          m.createdBy,
        ]),
        summaryMetrics: [{ label: 'Total Movements', value: list.length }],
      };
    }

    case 'PENDING_DISPATCH': {
      const pendingDispatches = data.materialDispatches.filter((d) =>
        ['PENDING_DISPATCH', 'IN_TRANSIT', 'DISPUTED'].includes(d.status)
      );
      const pendingSales = data.sales.filter((s) => s.status === 'CONFIRMED' || s.status === 'DRAFT');
      const rows: (string | number)[][] = [
        ...pendingDispatches.map((d) => [
          d.dispatchNo,
          d.destinationName,
          matName(d.materialId),
          d.netWeight,
          d.vehicleRegistration,
          d.dispatchEmployee,
          d.status,
        ]),
        ...pendingSales.map((s) => [
          s.salesNo,
          partyName(s.customerPartyId),
          matName(s.lines[0]?.materialId),
          roundTo3(s.lines.reduce((a, l) => a + l.quantity, 0)),
          s.vehicleRegistration || '—',
          s.createdBy,
          s.status,
        ]),
      ];
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Ref #', 'Destination / Customer', 'Material', 'Qty (KG)', 'Vehicle', 'Responsible', 'Status'],
        rows,
        summaryMetrics: [{ label: 'Pending Dispatch Items', value: rows.length }],
      };
    }

    case 'TRANSFER_REPORT': {
      const list = data.godownTransfers.filter((t) => inRange(t.transferDate, fromDate, toDate));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Transfer #', 'Date', 'Source Godown', 'Destination Godown', 'Material', 'Dispatched (KG)', 'Received (KG)', 'Shortage/Excess', 'Status'],
        rows: list.map((t) => [
          t.transferNo,
          t.transferDate,
          yardName(t.sourceYardId),
          yardName(t.destinationYardId),
          matName(t.materialId),
          t.quantityDispatched,
          t.quantityReceived,
          t.shortageQuantity > 0 ? -t.shortageQuantity : t.excessQuantity,
          t.status,
        ]),
        summaryMetrics: [
          { label: 'Transfers', value: list.length },
          { label: 'In Transit', value: list.filter((t) => t.status === 'IN_TRANSIT').length },
        ],
      };
    }

    case 'WEIGHBRIDGE_RECONCILIATION': {
      const dispatches = data.materialDispatches.filter((d) => inRange(d.dispatchDateTime, fromDate, toDate));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Dispatch #', 'Weighbridge Bill #', 'Vehicle', 'Gross (KG)', 'Tare (KG)', 'Net (KG)', 'Allocated (KG)', 'Discrepancy (KG)', 'Sources'],
        rows: dispatches.map((d) => [
          d.dispatchNo,
          d.weighbridgeBillNo || '—',
          d.vehicleRegistration,
          d.grossWeight,
          d.tareWeight,
          d.netWeight,
          d.totalAllocatedWeight,
          d.weightDiscrepancy,
          d.allocations.map((a) => `${a.supplierName || a.lotNumber}: ${a.allocatedQuantity}kg`).join('; '),
        ]),
        summaryMetrics: [
          { label: 'Dispatches Audited', value: dispatches.length },
          { label: 'Discrepancies', value: dispatches.filter((d) => Math.abs(d.weightDiscrepancy) > 0.001).length },
        ],
      };
    }

    case 'SUPPLIER_OUTSTANDING': {
      const suppliers = data.parties.filter((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH');
      const rows = suppliers.map((s) => {
        const due = roundTo2(
          data.purchases
            .filter((p) => p.supplierPartyId === s.id && p.status === 'POSTED')
            .reduce((sum, p) => sum + (p.outstandingBalance || 0), 0)
        );
        return [s.partyCode, s.legalName, s.phone, s.gstin || '—', due];
      });
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Code', 'Supplier Name', 'Mobile', 'GSTIN', 'Outstanding Payable (INR)'],
        rows,
        summaryMetrics: [
          { label: 'Total Supplier Payable (INR)', value: roundTo2(rows.reduce((s, r) => s + Number(r[4]), 0)) },
        ],
      };
    }

    case 'CUSTOMER_OUTSTANDING': {
      const customers = data.parties.filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH');
      const rows = customers.map((c) => {
        const due = roundTo2(
          data.invoices
            .filter((i) => i.customerPartyId === c.id && !i.isCancelled)
            .reduce((sum, i) => sum + (i.outstandingBalance || 0), 0)
        );
        return [c.partyCode, c.legalName, c.phone, c.gstin || '—', due];
      });
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Code', 'Customer Name', 'Mobile', 'GSTIN', 'Outstanding Receivable (INR)'],
        rows,
        summaryMetrics: [
          { label: 'Total Customer Receivable (INR)', value: roundTo2(rows.reduce((s, r) => s + Number(r[4]), 0)) },
        ],
      };
    }

    case 'CASH_BANK_REPORT': {
      const rows = data.accounts.map((acc) => {
        const bal = calculateReconciledAccountBalance(acc, data.accountTransactions);
        return [acc.accountCode, acc.accountName, acc.accountType, acc.openingBalance, bal];
      });
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Code', 'Account Name', 'Type', 'Opening Balance (INR)', 'Current Balance (INR)'],
        rows,
        summaryMetrics: [
          { label: 'Total Cash & Bank (INR)', value: roundTo2(rows.reduce((s, r) => s + Number(r[4]), 0)) },
        ],
      };
    }

    case 'PROFIT_LOSS': {
      const pnl = generateProfitAndLoss(data.journalEntries, fromDate, toDate);
      const rows: (string | number)[][] = [
        ...pnl.revenueLines.map((l) => ['REVENUE', l.code, l.name, l.amount]),
        ...pnl.cogsLines.map((l) => ['COGS', l.code, l.name, -l.amount]),
        ...pnl.operatingExpenseLines.map((l) => ['EXPENSE', l.code, l.name, -l.amount]),
      ];
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Section', 'Account Code', 'Account Name', 'Amount (INR)'],
        rows,
        summaryMetrics: [
          { label: 'Total Revenue', value: pnl.totalRevenue },
          { label: 'Gross Profit', value: pnl.grossProfit },
          { label: 'Net Profit', value: pnl.netProfit },
        ],
      };
    }

    case 'WORKER_SALARY': {
      const list = data.salaryRecords.filter((s) => inRange(s.paymentDate || s.createdAt, fromDate, toDate));
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Month', 'Employee', 'Designation', 'Gross (INR)', 'Deductions', 'Net Payable', 'Paid', 'Balance', 'Status'],
        rows: list.map((s) => [
          s.salaryMonth,
          s.employeeName,
          s.designation,
          s.grossSalary,
          roundTo2(s.deductions + s.advanceRecovery),
          s.netSalaryPayable,
          s.amountPaid,
          s.remainingBalance,
          s.status,
        ]),
        summaryMetrics: [
          { label: 'Total Salary Paid (INR)', value: roundTo2(list.reduce((a, s) => a + s.amountPaid, 0)) },
        ],
      };
    }

    case 'EXPENSE_REPORT': {
      const list = data.expenses.filter(
        (e) => e.status !== 'REVERSED' && inRange(e.expenseDate, fromDate, toDate)
      );
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Voucher #', 'Date', 'Category', 'Paid To', 'Mode', 'Amount (INR)', 'Status'],
        rows: list.map((e) => [
          e.voucherNo,
          e.expenseDate.slice(0, 10),
          e.category,
          e.paidTo,
          e.paymentMode || 'CASH',
          e.amount,
          e.status || 'PAID',
        ]),
        summaryMetrics: [
          { label: 'Active Expenses', value: list.length },
          { label: 'Total Expenses (INR)', value: roundTo2(list.reduce((a, e) => a + e.amount, 0)) },
        ],
      };
    }

    case 'OWNER_BUSINESS_SUMMARY': {
      const totalStock = roundTo3(data.inventoryLots.reduce((s, l) => s + l.remainingQuantity, 0));
      const totalFunds = roundTo2(
        data.accounts.reduce((s, a) => s + calculateReconciledAccountBalance(a, data.accountTransactions), 0)
      );
      const totalSales = roundTo2(
        data.invoices.filter((i) => !i.isCancelled && inRange(i.invoiceDate, fromDate, toDate)).reduce((s, i) => s + i.grandTotal, 0)
      );
      const totalPurchases = roundTo2(
        data.purchases.filter((p) => p.status === 'POSTED' && inRange(p.transactionDate, fromDate, toDate)).reduce((s, p) => s + p.totalAmount, 0)
      );
      const totalExpenses = roundTo2(
        data.expenses.filter((e) => e.status !== 'REVERSED' && inRange(e.expenseDate, fromDate, toDate)).reduce((s, e) => s + e.amount, 0)
      );
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Business Metric', 'Value'],
        rows: [
          ['Available Scrap Stock (KG)', totalStock],
          ['Reconciled Cash & Bank Funds (INR)', totalFunds],
          ['Period Sales Value (INR)', totalSales],
          ['Period Purchase Value (INR)', totalPurchases],
          ['Period Operating Expenses (INR)', totalExpenses],
          ['Active Multi-Source Dispatches', data.materialDispatches.length],
          ['Internal Godown Transfers', data.godownTransfers.length],
        ],
        summaryMetrics: [
          { label: 'Available Stock (KG)', value: totalStock },
          { label: 'Reconciled Funds (INR)', value: totalFunds },
        ],
      };
    }

    case 'DOCUMENT_STORAGE': {
      const snap = computeStorageMonitorSnapshot({
        databasePayload: {
          purchases: data.purchases,
          sales: data.sales,
          invoices: data.invoices,
          stockMovements: data.stockMovements,
          inventoryLots: data.inventoryLots,
        },
        managedDocuments: data.managedDocuments,
        uploadedDocuments: data.uploadedDocuments,
        backupHistory: data.backupHistory,
      });
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Document Name', 'Type', 'Provider', 'Size (Bytes)'],
        rows: snap.largestFiles.map((f) => [f.name, f.type, f.provider, f.sizeBytes]),
        summaryMetrics: [
          { label: 'Total Documents', value: snap.documentCount },
          { label: 'DB Usage (%)', value: snap.databaseUsagePct },
          { label: 'Quota Alert Level', value: snap.alertLevel },
        ],
      };
    }

    case 'BACKUP_RESTORE': {
      const rows: (string | number)[][] = [
        ...data.backupHistory.map((b) => [
          'BACKUP',
          b.createdAt.slice(0, 19).replace('T', ' '),
          b.backupName,
          b.destination,
          b.remoteVerified ? 'REMOTE_VERIFIED' : 'LOCAL_ONLY',
          b.fileSizeBytes,
          b.status,
        ]),
        ...data.restoreLogs.map((r) => [
          'RESTORE',
          r.restoredAt.slice(0, 19).replace('T', ' '),
          r.backupId.slice(0, 16),
          r.restorationType,
          r.sha256Verified ? 'SHA256_OK' : 'UNVERIFIED',
          Object.values(r.recordsRestoredJson || {}).reduce((a, b) => a + b, 0),
          r.status,
        ]),
      ];
      return {
        reportId,
        title: def.title,
        tamilTitle: def.tamilTitle,
        fromDate,
        toDate,
        headers: ['Event', 'Timestamp', 'Archive / Ref', 'Destination / Type', 'Verification', 'Size / Records', 'Status'],
        rows,
        summaryMetrics: [
          { label: 'Total Backups', value: data.backupHistory.length },
          { label: 'Verified Restores', value: data.restoreLogs.filter((r) => r.status === 'COMPLETED').length },
        ],
      };
    }
  }
}

/**
 * Generates UTF-8 BOM CSV string so both Tamil and English text open without mojibake in Excel / Google Sheets.
 */
export function exportReportToUtf8Csv(report: ReportTableResult): string {
  const escape = (val: string | number) => {
    const str = String(val ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };
  const lines = [
    report.headers.map(escape).join(','),
    ...report.rows.map((r) => r.map(escape).join(',')),
  ];
  return '\uFEFF' + lines.join('\n');
}
