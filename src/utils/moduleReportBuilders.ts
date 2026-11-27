import type {
  AccountTransaction,
  AttendanceEntry,
  AuditLog,
  BackupHistoryItem,
  CashBankAccount,
  CollectionJob,
  CommercialDocument,
  Company,
  ContractorWorkEntry,
  DailyLabourEntry,
  Employee,
  EmployeeAdvance,
  Expense,
  GodownTransfer,
  InventoryLot,
  Invoice,
  JournalEntry,
  LabourAdvance,
  Material,
  MonthlySalaryRecord,
  Party,
  Payment,
  PurchaseHeader,
  SalesHeader,
  StockMovement,
  Vehicle,
  VehicleDocument,
  Weighment,
  Yard,
} from '../types';
import {
  resolveVisualReportRange,
  type ModuleReportPayload,
  type VisualReportPeriod,
} from './visualReportExporter';

export type ERPModuleReportId =
  | 'DASHBOARD'
  | 'PURCHASES'
  | 'COLLECTIONS'
  | 'WEIGHMENT'
  | 'INVENTORY'
  | 'SALES'
  | 'INVOICES'
  | 'DOCUMENTS'
  | 'PARTIES'
  | 'PAYMENTS'
  | 'FINANCE'
  | 'VEHICLES'
  | 'EMPLOYEES'
  | 'REPORTS'
  | 'OWNER_REPORTS'
  | 'SETTINGS';

export const ALL_ERP_MODULE_REPORT_IDS: readonly ERPModuleReportId[] = [
  'DASHBOARD',
  'PURCHASES',
  'COLLECTIONS',
  'WEIGHMENT',
  'INVENTORY',
  'SALES',
  'INVOICES',
  'DOCUMENTS',
  'PARTIES',
  'PAYMENTS',
  'FINANCE',
  'VEHICLES',
  'EMPLOYEES',
  'REPORTS',
  'OWNER_REPORTS',
  'SETTINGS',
] as const;

export interface ModuleReportContextData {
  company: Pick<Company, 'companyName' | 'gstin'>;
  yards: Yard[];
  materials: Material[];
  parties: Party[];
  vehicles: Vehicle[];
  vehicleDocuments: VehicleDocument[];
  employees: Employee[];
  attendance: AttendanceEntry[];
  accounts: CashBankAccount[];
  accountTransactions: AccountTransaction[];
  expenses: Expense[];
  weighments: Weighment[];
  collectionJobs: CollectionJob[];
  purchases: PurchaseHeader[];
  inventoryLots: InventoryLot[];
  stockMovements: StockMovement[];
  godownTransfers?: GodownTransfer[];
  sales: SalesHeader[];
  invoices: Invoice[];
  payments: Payment[];
  commercialDocuments: CommercialDocument[];
  journalEntries: JournalEntry[];
  salaryRecords: MonthlySalaryRecord[];
  employeeAdvances: EmployeeAdvance[];
  labourAdvances: LabourAdvance[];
  dailyLabourEntries: DailyLabourEntry[];
  contractorWorkEntries: ContractorWorkEntry[];
  backupHistory: BackupHistoryItem[];
  auditLogs: AuditLog[];
  getAccountBalance?: (accountId: string) => number;
}

function fmtRs(val: number): string {
  const n = Number(val) || 0;
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}Rs.${abs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtKg(val: number): string {
  const n = Number(val) || 0;
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`;
}

function toDateOnly(isoOrDate?: string): string {
  if (!isoOrDate) return '';
  return isoOrDate.slice(0, 10);
}

function inRange(dateVal: string | undefined, startDate: string, endDate: string, period: VisualReportPeriod): boolean {
  if (period === 'ALL') return true;
  const d = toDateOnly(dateVal);
  if (!d) return false;
  return d >= startDate && d <= endDate;
}

function computeBalances(data: ModuleReportContextData) {
  const calc = (acc: CashBankAccount) => {
    if (data.getAccountBalance) return data.getAccountBalance(acc.id);
    const txs = data.accountTransactions.filter((t) => t.accountId === acc.id);
    const hasOpening = txs.some((t) => t.transactionType === 'OPENING_BALANCE');
    const net = txs.reduce((s, t) => s + (t.direction === 'DEBIT' ? t.amount : -t.amount), 0);
    return (hasOpening ? 0 : acc.openingBalance || 0) + net;
  };
  let cash = 0;
  let bank = 0;
  for (const a of data.accounts) {
    const b = calc(a);
    if (a.accountType === 'CASH') cash += b;
    else bank += b;
  }
  return { cash, bank };
}

export function buildModuleReportPayload(
  moduleId: ERPModuleReportId,
  data: ModuleReportContextData,
  period: VisualReportPeriod,
  anchorDate: string,
  customEndDate?: string
): ModuleReportPayload {
  const resolved = resolveVisualReportRange(period, anchorDate, customEndDate);
  const { startDate, endDate, label: periodLabel } = resolved;

  const partyMap = new Map(data.parties.map((p) => [p.id, p]));
  const materialMap = new Map(data.materials.map((m) => [m.id, m]));
  const yardMap = new Map(data.yards.map((y) => [y.id, y]));
  const vehicleMap = new Map(data.vehicles.map((v) => [v.id, v]));
  const employeeMap = new Map(data.employees.map((e) => [e.id, e]));

  const base = {
    moduleKey: moduleId,
    companyName: data.company.companyName || 'Yashoth Enterprises',
    companyGstin: data.company.gstin,
    period,
    startDate,
    endDate,
    periodLabel,
  };

  switch (moduleId) {
    case 'DASHBOARD': {
      const { cash, bank } = computeBalances(data);
      const pSales = data.sales.filter((s) => s.status !== 'CANCELLED' && inRange(s.orderDate, startDate, endDate, period));
      const pPurchases = data.purchases.filter((p) => p.status !== 'CANCELLED' && inRange(p.transactionDate, startDate, endDate, period));
      const pExpenses = data.expenses.filter((e) => e.status !== 'REVERSED' && inRange(e.expenseDate, startDate, endDate, period));
      const pPayments = data.payments.filter((p) => p.status !== 'REVERSED' && inRange(p.paymentDate, startDate, endDate, period));
      const pStaffAdv = data.employeeAdvances.filter((a) => a.status !== 'REVERSED' && inRange(a.advanceDate, startDate, endDate, period));
      const pLabourAdv = data.labourAdvances.filter((a) => a.status !== 'REVERSED' && inRange(a.advanceDate, startDate, endDate, period));

      const salesTotal = pSales.reduce((s, x) => s + (x.totalAmount || 0), 0);
      const purchaseTotal = pPurchases.reduce((s, x) => s + (x.totalAmount || 0), 0);
      const expenseTotal = pExpenses.reduce((s, x) => s + (x.amount || 0), 0);
      const advanceOut =
        pStaffAdv.reduce((s, x) => s + x.amount, 0) + pLabourAdv.reduce((s, x) => s + x.amount, 0);
      const inflow = pPayments.filter((p) => p.direction === 'INFLOW_RECEIPT').reduce((s, p) => s + p.totalAmount, 0);

      const rows: (string | number)[][] = [
        ['Sales Orders', pSales.length, fmtRs(salesTotal), 'Active sales orders'],
        ['Purchase Orders', pPurchases.length, fmtRs(purchaseTotal), 'Scrap & metal intake'],
        ['Receipts Inflow', pPayments.filter((p) => p.direction === 'INFLOW_RECEIPT').length, fmtRs(inflow), 'Customer receipts'],
        ['Daily Expenses', pExpenses.length, fmtRs(expenseTotal), 'Operating vouchers'],
        ['Staff & Labour Advances', pStaffAdv.length + pLabourAdv.length, fmtRs(advanceOut), 'Cash/Bank advance outflows'],
        ['Cash in Hand (Live)', data.accounts.filter((a) => a.accountType === 'CASH').length, fmtRs(cash), 'Reconciled cash balance'],
        ['Bank Balance (Live)', data.accounts.filter((a) => a.accountType === 'BANK').length, fmtRs(bank), 'Reconciled bank balance'],
      ];

      return {
        ...base,
        moduleTitle: 'Executive Dashboard Report',
        moduleSubtitle: 'Daily & Period Operations Snapshot',
        recommendedFormats: ['PNG', 'TEXT', 'CSV', 'PDF'],
        kpis: [
          { label: 'Period Sales', value: fmtRs(salesTotal), tone: 'emerald' },
          { label: 'Period Purchases', value: fmtRs(purchaseTotal), tone: 'sky' },
          { label: 'Period Expenses', value: fmtRs(expenseTotal), tone: 'rose' },
          { label: 'Cash in Hand', value: fmtRs(cash), tone: 'amber' },
          { label: 'Bank Balance', value: fmtRs(bank), tone: 'indigo' },
          { label: 'Advances Paid', value: fmtRs(advanceOut), tone: 'slate' },
        ],
        barsTitle: 'Period Financial Mix',
        bars: [
          { label: 'Sales Revenue', value: salesTotal, displayValue: fmtRs(salesTotal) },
          { label: 'Purchase Value', value: purchaseTotal, displayValue: fmtRs(purchaseTotal) },
          { label: 'Customer Receipts', value: inflow, displayValue: fmtRs(inflow) },
          { label: 'Operating Expenses', value: expenseTotal, displayValue: fmtRs(expenseTotal) },
          { label: 'Advances Paid', value: advanceOut, displayValue: fmtRs(advanceOut) },
        ],
        headers: ['Metric', 'Count', 'Amount', 'Notes'],
        rows,
      };
    }

    case 'PURCHASES': {
      const list = data.purchases
        .filter((p) => inRange(p.transactionDate, startDate, endDate, period))
        .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
      const active = list.filter((p) => p.status !== 'CANCELLED');
      const totalAmt = active.reduce((s, p) => s + (p.totalAmount || 0), 0);
      const totalPaid = active.reduce((s, p) => s + (p.amountPaid || 0), 0);
      const totalDue = active.reduce((s, p) => s + (p.outstandingBalance || 0), 0);
      const totalKg = active.reduce(
        (s, p) => s + (p.netWeight ?? p.lines.reduce((ls, l) => ls + (l.netWeight || 0), 0)),
        0
      );

      const supMap = new Map<string, number>();
      active.forEach((p) => {
        const name = p.supplierName || partyMap.get(p.supplierPartyId)?.legalName || 'Supplier';
        supMap.set(name, (supMap.get(name) || 0) + (p.totalAmount || 0));
      });

      return {
        ...base,
        moduleTitle: 'Purchases & Scrap Intake Report',
        recommendedFormats: ['PNG', 'CSV', 'TEXT', 'PDF'],
        kpis: [
          { label: 'Purchase Bills', value: String(active.length), tone: 'sky' },
          { label: 'Total Value', value: fmtRs(totalAmt), tone: 'emerald' },
          { label: 'Total Net Weight', value: fmtKg(totalKg), tone: 'indigo' },
          { label: 'Paid to Suppliers', value: fmtRs(totalPaid), tone: 'slate' },
          { label: 'Balance Payable', value: fmtRs(totalDue), tone: 'rose' },
          { label: 'Avg Rate / Kg', value: totalKg > 0 ? fmtRs(totalAmt / totalKg) : 'Rs.0', tone: 'amber' },
        ],
        barsTitle: 'Top Suppliers by Purchase Value',
        bars: Array.from(supMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, value]) => ({ label, value, displayValue: fmtRs(value) })),
        headers: ['Date', 'Purchase No', 'Supplier', 'Net Wt (kg)', 'Total (INR)', 'Paid (INR)', 'Balance (INR)', 'Status'],
        rows: list.map((p) => [
          p.transactionDate,
          p.purchaseNo,
          p.supplierName || partyMap.get(p.supplierPartyId)?.legalName || p.supplierPartyId,
          p.netWeight ?? p.lines.reduce((ls, l) => ls + (l.netWeight || 0), 0),
          p.totalAmount,
          p.amountPaid,
          p.outstandingBalance,
          p.status,
        ]),
      };
    }

    case 'COLLECTIONS': {
      const list = data.collectionJobs
        .filter((j) => inRange(j.plannedDate, startDate, endDate, period))
        .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate));
      const completed = list.filter((j) => j.status === 'COMPLETED' || j.status === 'WEIGHED').length;
      const pending = list.filter((j) => j.status === 'REQUESTED' || j.status === 'ASSIGNED' || j.status === 'IN_TRANSIT').length;
      const estKg = list.reduce((s, j) => s + (j.estimatedQuantity || 0), 0);
      const actKg = list.reduce((s, j) => s + (j.actualWeight || 0), 0);
      const transCost = list.reduce((s, j) => s + (j.transportExpenses || 0), 0);

      return {
        ...base,
        moduleTitle: 'Yard Collections & Pickup Jobs Report',
        recommendedFormats: ['PNG', 'CSV', 'TEXT', 'PDF'],
        kpis: [
          { label: 'Total Jobs', value: String(list.length), tone: 'sky' },
          { label: 'Completed / Weighed', value: String(completed), tone: 'emerald' },
          { label: 'Pending / In-Transit', value: String(pending), tone: 'amber' },
          { label: 'Estimated Wt', value: fmtKg(estKg), tone: 'slate' },
          { label: 'Actual Weighed', value: fmtKg(actKg), tone: 'indigo' },
          { label: 'Transport Expense', value: fmtRs(transCost), tone: 'rose' },
        ],
        headers: ['Date', 'Job No', 'Supplier', 'Material', 'Location', 'Est Wt (kg)', 'Actual Wt (kg)', 'Status'],
        rows: list.map((j) => [
          j.plannedDate,
          j.jobNo,
          partyMap.get(j.supplierPartyId)?.legalName || j.supplierPartyId,
          materialMap.get(j.materialId)?.name || j.materialId,
          j.pickupLocation,
          j.estimatedQuantity,
          j.actualWeight || 0,
          j.status,
        ]),
      };
    }

    case 'WEIGHMENT': {
      const list = data.weighments
        .filter((w) => inRange(w.weighmentDate || w.createdAt, startDate, endDate, period))
        .sort((a, b) => (b.weighmentDate || b.createdAt).localeCompare(a.weighmentDate || a.createdAt));
      const totalNet = list.reduce((s, w) => s + (w.netWeight || 0), 0);
      const totalPayable = list.reduce((s, w) => s + (w.payableWeight || 0), 0);
      const totalCharges = list.reduce((s, w) => s + (w.weighbridgeCharge || 0), 0);
      const verified = list.filter((w) => w.verificationStatus === 'VERIFIED').length;

      return {
        ...base,
        moduleTitle: 'Weighbridge & Weighment Slips Report',
        recommendedFormats: ['PNG', 'CSV', 'TEXT', 'PDF'],
        kpis: [
          { label: 'Weighment Slips', value: String(list.length), tone: 'sky' },
          { label: 'Total Net Weight', value: fmtKg(totalNet), tone: 'emerald' },
          { label: 'Payable Weight', value: fmtKg(totalPayable), tone: 'indigo' },
          { label: 'Verified Slips', value: `${verified}/${list.length}`, tone: 'amber' },
          { label: 'Bridge Charges', value: fmtRs(totalCharges), tone: 'rose' },
          { label: 'Avg Net / Slip', value: list.length ? fmtKg(totalNet / list.length) : '0 kg', tone: 'slate' },
        ],
        headers: ['Date', 'Slip No', 'Vehicle', 'Party', 'Gross (kg)', 'Tare (kg)', 'Net (kg)', 'Status'],
        rows: list.map((w) => [
          toDateOnly(w.weighmentDate || w.createdAt),
          w.weighmentNo,
          w.vehicleRegistration || '-',
          w.partyName || (w.partyId ? partyMap.get(w.partyId)?.legalName : '-') || '-',
          w.grossWeight,
          w.tareWeight,
          w.netWeight,
          w.verificationStatus,
        ]),
      };
    }

    case 'INVENTORY': {
      const movements = data.stockMovements
        .filter((m) => inRange(m.createdAt, startDate, endDate, period))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const activeLots = data.inventoryLots.filter((l) => !l.isExhausted && l.remainingQuantity > 0);
      const liveQty = activeLots.reduce((s, l) => s + (l.remainingQuantity || 0), 0);
      const liveVal = activeLots.reduce((s, l) => s + (l.remainingQuantity || 0) * (l.unitCost || 0), 0);
      const inwardKg = movements.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0);
      const outwardKg = movements.filter((m) => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0);

      const matStock = new Map<string, number>();
      activeLots.forEach((l) => {
        const name = materialMap.get(l.materialId)?.name || l.materialId;
        matStock.set(name, (matStock.get(name) || 0) + l.remainingQuantity);
      });

      const useMovements = period !== 'ALL' && movements.length > 0;
      return {
        ...base,
        moduleTitle: 'Inventory Stock & Movement Report',
        recommendedFormats: ['PNG', 'CSV', 'TEXT', 'PDF'],
        kpis: [
          { label: 'Live Stock Qty', value: fmtKg(liveQty), tone: 'emerald' },
          { label: 'Live Stock Value', value: fmtRs(liveVal), tone: 'sky' },
          { label: 'Period Inward', value: fmtKg(inwardKg), tone: 'indigo' },
          { label: 'Period Outward', value: fmtKg(outwardKg), tone: 'rose' },
          { label: 'Active Lots', value: String(activeLots.length), tone: 'amber' },
          { label: 'Movements Logged', value: String(movements.length), tone: 'slate' },
        ],
        barsTitle: 'Current Live Stock by Material (kg)',
        bars: Array.from(matStock.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, value]) => ({ label, value, displayValue: fmtKg(value) })),
        headers: useMovements
          ? ['Date', 'Ref No', 'Type', 'Material', 'Yard', 'Qty (kg)', 'Total Cost (INR)']
          : ['Lot No', 'Material', 'Yard', 'Initial (kg)', 'Remaining (kg)', 'Unit Cost', 'Value (INR)'],
        rows: useMovements
          ? movements.map((m) => [
              toDateOnly(m.createdAt),
              m.transactionRef,
              m.movementType,
              materialMap.get(m.materialId)?.name || m.materialId,
              yardMap.get(m.yardId)?.name || m.yardId,
              m.quantity,
              m.totalCost,
            ])
          : activeLots.map((l) => [
              l.lotNumber,
              materialMap.get(l.materialId)?.name || l.materialId,
              yardMap.get(l.yardId)?.name || l.yardId,
              l.initialQuantity,
              l.remainingQuantity,
              l.unitCost,
              Math.round(l.remainingQuantity * l.unitCost),
            ]),
      };
    }

    case 'SALES': {
      const list = data.sales
        .filter((s) => inRange(s.orderDate, startDate, endDate, period))
        .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
      const active = list.filter((s) => s.status !== 'CANCELLED');
      const totalVal = active.reduce((s, x) => s + (x.totalAmount || 0), 0);
      const totalCogs = active.reduce((s, x) => s + (x.allocatedCogs || 0), 0);
      const grossMargin = totalVal - totalCogs;
      const totalQty = active.reduce((s, x) => s + x.lines.reduce((ls, l) => ls + (l.quantity || 0), 0), 0);

      const custMap = new Map<string, number>();
      active.forEach((s) => {
        const name = partyMap.get(s.customerPartyId)?.legalName || 'Customer';
        custMap.set(name, (custMap.get(name) || 0) + (s.totalAmount || 0));
      });

      return {
        ...base,
        moduleTitle: 'Sales & Dispatch Register Report',
        recommendedFormats: ['PNG', 'CSV', 'TEXT', 'PDF'],
        kpis: [
          { label: 'Sales Orders', value: String(active.length), tone: 'sky' },
          { label: 'Total Sales Value', value: fmtRs(totalVal), tone: 'emerald' },
          { label: 'Dispatched Qty', value: fmtKg(totalQty), tone: 'indigo' },
          { label: 'Allocated COGS', value: fmtRs(totalCogs), tone: 'amber' },
          { label: 'Est. Gross Margin', value: fmtRs(grossMargin), tone: grossMargin >= 0 ? 'emerald' : 'rose' },
          { label: 'Invoiced Orders', value: String(active.filter((x) => x.status === 'INVOICED').length), tone: 'slate' },
        ],
        barsTitle: 'Top Customers by Sales Value',
        bars: Array.from(custMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, value]) => ({ label, value, displayValue: fmtRs(value) })),
        headers: ['Date', 'Sales No', 'Customer', 'Vehicle', 'Qty (kg)', 'Total (INR)', 'Status'],
        rows: list.map((s) => [
          s.orderDate,
          s.salesNo,
          partyMap.get(s.customerPartyId)?.legalName || s.customerPartyId,
          s.vehicleRegistration || '-',
          s.lines.reduce((ls, l) => ls + (l.quantity || 0), 0),
          s.totalAmount,
          s.status,
        ]),
      };
    }

    case 'INVOICES': {
      const list = data.invoices
        .filter((inv) => inRange(inv.invoiceDate, startDate, endDate, period))
        .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
      const active = list.filter((i) => !i.isCancelled);
      const taxable = active.reduce((s, i) => s + (i.subtotalTaxable || 0), 0);
      const gst = active.reduce((s, i) => s + (i.cgstAmount || 0) + (i.sgstAmount || 0) + (i.igstAmount || 0), 0);
      const grand = active.reduce((s, i) => s + (i.grandTotal || 0), 0);
      const paid = active.reduce((s, i) => s + (i.amountPaid || 0), 0);
      const due = active.reduce((s, i) => s + (i.outstandingBalance || 0), 0);

      return {
        ...base,
        moduleTitle: 'GST Tax Invoices & Billing Report',
        recommendedFormats: ['PNG', 'CSV', 'PDF', 'TEXT'],
        kpis: [
          { label: 'Active Invoices', value: String(active.length), tone: 'sky' },
          { label: 'Taxable Value', value: fmtRs(taxable), tone: 'slate' },
          { label: 'Total GST', value: fmtRs(gst), tone: 'amber' },
          { label: 'Grand Total', value: fmtRs(grand), tone: 'emerald' },
          { label: 'Collected', value: fmtRs(paid), tone: 'indigo' },
          { label: 'Outstanding Due', value: fmtRs(due), tone: 'rose' },
        ],
        headers: ['Date', 'Invoice No', 'Customer', 'GSTIN', 'Taxable', 'GST', 'Grand Total', 'Balance Due', 'Status'],
        rows: list.map((i) => [
          i.invoiceDate,
          i.invoiceNo,
          i.customerName,
          i.customerGstin || '-',
          i.subtotalTaxable,
          (i.cgstAmount || 0) + (i.sgstAmount || 0) + (i.igstAmount || 0),
          i.grandTotal,
          i.outstandingBalance,
          i.isCancelled ? 'CANCELLED' : i.paymentStatus,
        ]),
      };
    }

    case 'DOCUMENTS': {
      const list = data.commercialDocuments
        .filter((d) => inRange(d.documentDate, startDate, endDate, period))
        .sort((a, b) => b.documentDate.localeCompare(a.documentDate));
      const totalVal = list.filter((d) => d.status !== 'CANCELLED').reduce((s, d) => s + (d.grandTotal || 0), 0);
      const typeCounts = new Map<string, number>();
      list.forEach((d) => typeCounts.set(d.documentType, (typeCounts.get(d.documentType) || 0) + 1));

      return {
        ...base,
        moduleTitle: 'Commercial Documents Register (PO / Quote / CN / DN)',
        recommendedFormats: ['PNG', 'CSV', 'PDF', 'TEXT'],
        kpis: [
          { label: 'Total Documents', value: String(list.length), tone: 'sky' },
          { label: 'Active Value', value: fmtRs(totalVal), tone: 'emerald' },
          { label: 'Purchase Orders', value: String(typeCounts.get('PURCHASE_ORDER') || 0), tone: 'indigo' },
          { label: 'Quotations / PI', value: String((typeCounts.get('QUOTATION') || 0) + (typeCounts.get('PROFORMA_INVOICE') || 0)), tone: 'amber' },
          { label: 'Credit / Debit Notes', value: String((typeCounts.get('CREDIT_NOTE') || 0) + (typeCounts.get('DEBIT_NOTE') || 0)), tone: 'rose' },
          { label: 'Issued / Paid', value: String(list.filter((d) => d.status === 'ISSUED' || d.status === 'PAID').length), tone: 'slate' },
        ],
        headers: ['Date', 'Doc No', 'Type', 'Party', 'Taxable', 'Grand Total', 'Status'],
        rows: list.map((d) => [
          d.documentDate,
          d.documentNo,
          d.documentType,
          d.partyName,
          d.subtotalTaxable,
          d.grandTotal,
          d.status,
        ]),
      };
    }

    case 'PARTIES': {
      const customers = data.parties.filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH');
      const suppliers = data.parties.filter((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH');
      const receivables = data.invoices
        .filter((i) => !i.isCancelled && inRange(i.invoiceDate, startDate, endDate, period))
        .reduce((s, i) => s + (i.outstandingBalance || 0), 0);
      const payables = data.purchases
        .filter((p) => p.status !== 'CANCELLED' && inRange(p.transactionDate, startDate, endDate, period))
        .reduce((s, p) => s + (p.outstandingBalance || 0), 0);

      const rows = data.parties.map((p) => {
        const invAmt = data.invoices
          .filter((i) => !i.isCancelled && i.customerPartyId === p.id && inRange(i.invoiceDate, startDate, endDate, period))
          .reduce((s, i) => s + i.grandTotal, 0);
        const purAmt = data.purchases
          .filter((pu) => pu.status !== 'CANCELLED' && pu.supplierPartyId === p.id && inRange(pu.transactionDate, startDate, endDate, period))
          .reduce((s, pu) => s + pu.totalAmount, 0);
        const recBal = data.invoices
          .filter((i) => !i.isCancelled && i.customerPartyId === p.id)
          .reduce((s, i) => s + i.outstandingBalance, 0);
        const payBal = data.purchases
          .filter((pu) => pu.status !== 'CANCELLED' && pu.supplierPartyId === p.id)
          .reduce((s, pu) => s + pu.outstandingBalance, 0);
        return [
          p.legalName,
          p.partyType,
          p.phone || '-',
          p.gstin || '-',
          invAmt,
          purAmt,
          recBal - payBal,
        ];
      });

      return {
        ...base,
        moduleTitle: 'Parties, Customers & Suppliers Ledger Report',
        recommendedFormats: ['PNG', 'CSV', 'PDF', 'TEXT'],
        kpis: [
          { label: 'Total Parties', value: String(data.parties.length), tone: 'sky' },
          { label: 'Customers', value: String(customers.length), tone: 'emerald' },
          { label: 'Suppliers', value: String(suppliers.length), tone: 'indigo' },
          { label: 'Period Receivables', value: fmtRs(receivables), tone: 'amber' },
          { label: 'Period Payables', value: fmtRs(payables), tone: 'rose' },
          { label: 'Net Position', value: fmtRs(receivables - payables), tone: receivables >= payables ? 'emerald' : 'rose' },
        ],
        headers: ['Party Name', 'Type', 'Phone', 'GSTIN', 'Period Sales', 'Period Purchases', 'Live Net Due (+Recv/-Pay)'],
        rows,
      };
    }

    case 'PAYMENTS': {
      const list = data.payments
        .filter((p) => inRange(p.paymentDate, startDate, endDate, period))
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
      const inflow = list.filter((p) => p.direction === 'INFLOW_RECEIPT' && p.status !== 'REVERSED').reduce((s, p) => s + p.totalAmount, 0);
      const outflow = list.filter((p) => p.direction === 'OUTFLOW_PAYMENT' && p.status !== 'REVERSED').reduce((s, p) => s + p.totalAmount, 0);
      const net = inflow - outflow;

      return {
        ...base,
        moduleTitle: 'Payments & Receipts Voucher Report',
        recommendedFormats: ['PNG', 'CSV', 'TEXT', 'PDF'],
        kpis: [
          { label: 'Total Vouchers', value: String(list.length), tone: 'sky' },
          { label: 'Receipts (Inflow)', value: fmtRs(inflow), tone: 'emerald' },
          { label: 'Payments (Outflow)', value: fmtRs(outflow), tone: 'rose' },
          { label: 'Net Cashflow', value: fmtRs(net), tone: net >= 0 ? 'emerald' : 'rose' },
          { label: 'Cash Mode', value: String(list.filter((p) => p.paymentMethod === 'CASH').length), tone: 'amber' },
          { label: 'Bank / UPI Mode', value: String(list.filter((p) => p.paymentMethod !== 'CASH').length), tone: 'indigo' },
        ],
        headers: ['Date', 'Voucher No', 'Party', 'Direction', 'Method', 'Amount (INR)', 'Status'],
        rows: list.map((p) => [
          p.paymentDate,
          p.paymentNo,
          partyMap.get(p.partyId)?.legalName || p.partyId,
          p.direction === 'INFLOW_RECEIPT' ? 'RECEIPT (+)' : 'PAYMENT (-)',
          p.paymentMethod,
          p.totalAmount,
          p.status || 'COMPLETED',
        ]),
      };
    }

    case 'FINANCE': {
      const { cash, bank } = computeBalances(data);
      const txs = data.accountTransactions
        .filter((t) => inRange(t.transactionDate, startDate, endDate, period))
        .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
      const exps = data.expenses.filter((e) => e.status !== 'REVERSED' && inRange(e.expenseDate, startDate, endDate, period));
      const staffAdvs = data.employeeAdvances.filter((a) => a.status !== 'REVERSED' && inRange(a.advanceDate, startDate, endDate, period));
      const labourAdvs = data.labourAdvances.filter((a) => a.status !== 'REVERSED' && inRange(a.advanceDate, startDate, endDate, period));
      const inflow = txs.filter((t) => t.direction === 'DEBIT').reduce((s, t) => s + t.amount, 0);
      const outflow = txs.filter((t) => t.direction === 'CREDIT').reduce((s, t) => s + t.amount, 0);
      const expTotal = exps.reduce((s, e) => s + e.amount, 0);
      const advTotal =
        staffAdvs.reduce((s, a) => s + a.amount, 0) + labourAdvs.reduce((s, a) => s + a.amount, 0);

      const catMap = new Map<string, number>();
      exps.forEach((e) => catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount));
      if (advTotal > 0) catMap.set('Staff & Labour Advances (Cash Out)', advTotal);

      const accNameMap = new Map(data.accounts.map((a) => [a.id, a.accountName]));

      return {
        ...base,
        moduleTitle: 'Finance, Cash Book & Advances Report',
        recommendedFormats: ['PNG', 'CSV', 'PDF', 'TEXT'],
        kpis: [
          { label: 'Cash in Hand', value: fmtRs(cash), tone: 'amber' },
          { label: 'Bank Balance', value: fmtRs(bank), tone: 'sky' },
          { label: 'Period Inflow', value: fmtRs(inflow), tone: 'emerald' },
          { label: 'Period Outflow', value: fmtRs(outflow), tone: 'rose' },
          { label: 'Daily Expenses', value: fmtRs(expTotal), tone: 'rose' },
          { label: 'Advances Issued', value: fmtRs(advTotal), tone: 'indigo' },
        ],
        barsTitle: 'Expense & Cash Outflow Breakdown',
        bars: Array.from(catMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, value]) => ({ label, value, displayValue: fmtRs(value) })),
        headers: ['Date', 'Account', 'Type', 'Direction', 'Description', 'Amount (INR)'],
        rows: txs.map((t) => [
          t.transactionDate,
          accNameMap.get(t.accountId) || t.accountId,
          t.transactionType,
          t.direction === 'DEBIT' ? 'IN (+)' : 'OUT (-)',
          t.description,
          t.amount,
        ]),
      };
    }

    case 'VEHICLES': {
      const fleetExps = data.expenses.filter(
        (e) =>
          e.status !== 'REVERSED' &&
          inRange(e.expenseDate, startDate, endDate, period) &&
          (Boolean(e.vehicleId) || /diesel|petrol|fuel|vehicle|repair/i.test(e.category || ''))
      );
      const dieselCost = fleetExps
        .filter((e) => /diesel|petrol|fuel/i.test(e.category || ''))
        .reduce((s, e) => s + e.amount, 0);
      const maintCost = fleetExps
        .filter((e) => !/diesel|petrol|fuel/i.test(e.category || ''))
        .reduce((s, e) => s + e.amount, 0);
      const today = anchorDate;
      const expiredDocs = data.vehicleDocuments.filter((d) => d.expiryDate && d.expiryDate < today).length;

      const rows = data.vehicles.map((v) => {
        const vExps = fleetExps.filter((e) => e.vehicleId === v.id).reduce((s, e) => s + e.amount, 0);
        const vWeighs = data.weighments.filter(
          (w) => w.vehicleRegistration === v.registrationNo && inRange(w.weighmentDate || w.createdAt, startDate, endDate, period)
        ).length;
        const vDocs = data.vehicleDocuments.filter((d) => d.vehicleId === v.id).length;
        return [
          v.registrationNo,
          v.vehicleType,
          v.ownershipType,
          v.driverName || '-',
          vWeighs,
          vExps,
          vDocs,
        ];
      });

      return {
        ...base,
        moduleTitle: 'Vehicles, Fleet Trips & Diesel Report',
        recommendedFormats: ['PNG', 'CSV', 'TEXT', 'PDF'],
        kpis: [
          { label: 'Total Vehicles', value: String(data.vehicles.length), tone: 'sky' },
          { label: 'Owned Fleet', value: String(data.vehicles.filter((v) => v.ownershipType === 'OWNED').length), tone: 'emerald' },
          { label: 'Period Diesel/Fuel', value: fmtRs(dieselCost), tone: 'amber' },
          { label: 'Repair & Vehicle Exp', value: fmtRs(maintCost), tone: 'rose' },
          { label: 'Compliance Docs', value: String(data.vehicleDocuments.length), tone: 'indigo' },
          { label: 'Expired Docs', value: String(expiredDocs), tone: expiredDocs > 0 ? 'rose' : 'emerald' },
        ],
        headers: ['Registration No', 'Type', 'Ownership', 'Driver', 'Period Trips', 'Period Expense (INR)', 'Docs'],
        rows,
      };
    }

    case 'EMPLOYEES': {
      const attList = data.attendance
        .filter((a) => inRange(a.attendanceDate, startDate, endDate, period))
        .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
      const presentCnt = attList.filter((a) => a.status === 'PRESENT' || a.status === 'OVERTIME').length;
      const doubleCnt = attList.filter((a) => a.status === 'DOUBLE_SHIFT').length;
      const halfCnt = attList.filter((a) => a.status === 'HALF_DAY').length;
      const woPlCnt = attList.filter((a) => a.status === 'WEEK_OFF' || a.status === 'LEAVE').length;
      const absCnt = attList.filter((a) => a.status === 'ABSENT').length;
      const totalAdvBal = data.employees.reduce((s, e) => s + (e.currentAdvanceBalance || 0), 0);

      const useAttRows = attList.length > 0;
      return {
        ...base,
        moduleTitle: 'Employees Attendance, Payroll & Advances Report',
        recommendedFormats: ['PNG', 'CSV', 'PDF', 'TEXT'],
        kpis: [
          { label: 'Active Staff', value: String(data.employees.filter((e) => e.isActive).length), tone: 'sky' },
          { label: 'Present / 2x', value: `${presentCnt} / ${doubleCnt}`, tone: 'emerald' },
          { label: 'Week Off / Paid Leave', value: String(woPlCnt), tone: 'indigo' },
          { label: 'Half Day / Absent', value: `${halfCnt} / ${absCnt}`, tone: 'amber' },
          { label: 'Total Staff Advances', value: fmtRs(totalAdvBal), tone: 'rose' },
          { label: 'Attendance Logs', value: String(attList.length), tone: 'slate' },
        ],
        headers: useAttRows
          ? ['Date', 'Employee', 'Designation', 'Status', 'OT Hrs', 'Adv Balance (INR)']
          : ['Code', 'Employee Name', 'Designation', 'Monthly Salary', 'Daily Wage', 'Adv Balance (INR)'],
        rows: useAttRows
          ? attList.map((a) => {
              const emp = employeeMap.get(a.employeeId);
              return [
                a.attendanceDate,
                emp?.fullName || a.employeeId,
                emp?.designation || '-',
                a.status,
                a.overtimeHours || 0,
                emp?.currentAdvanceBalance || 0,
              ];
            })
          : data.employees.map((e) => [
              e.employeeCode,
              e.fullName,
              e.designation,
              e.monthlySalary,
              e.dailyWageRate,
              e.currentAdvanceBalance,
            ]),
      };
    }

    case 'REPORTS':
    case 'OWNER_REPORTS': {
      const { cash, bank } = computeBalances(data);
      const pSales = data.sales.filter((s) => s.status !== 'CANCELLED' && inRange(s.orderDate, startDate, endDate, period));
      const pPurchases = data.purchases.filter((p) => p.status !== 'CANCELLED' && inRange(p.transactionDate, startDate, endDate, period));
      const pExpenses = data.expenses.filter((e) => e.status !== 'REVERSED' && inRange(e.expenseDate, startDate, endDate, period));
      const pJournals = data.journalEntries.filter((j) => inRange(j.entryDate, startDate, endDate, period));
      const pLabour = data.dailyLabourEntries.filter((l) => l.status !== 'REVERSED' && inRange(l.workDate, startDate, endDate, period));
      const pStaffAdv = data.employeeAdvances.filter((a) => a.status !== 'REVERSED' && inRange(a.advanceDate, startDate, endDate, period));
      const pLabourAdv = data.labourAdvances.filter((a) => a.status !== 'REVERSED' && inRange(a.advanceDate, startDate, endDate, period));

      const salesVal = pSales.reduce((s, x) => s + (x.totalAmount || 0), 0);
      const purVal = pPurchases.reduce((s, x) => s + (x.totalAmount || 0), 0);
      const expVal = pExpenses.reduce((s, x) => s + (x.amount || 0), 0);
      const labourVal = pLabour.reduce((s, x) => s + (x.totalLabourCost || 0), 0);
      const advVal =
        pStaffAdv.reduce((s, x) => s + x.amount, 0) + pLabourAdv.reduce((s, x) => s + x.amount, 0);
      const estNet = salesVal - purVal - expVal - labourVal;

      return {
        ...base,
        moduleTitle: moduleId === 'OWNER_REPORTS' ? 'Owner Summary Executive Report' : 'Full Business & Accounting Audit Report',
        recommendedFormats: ['PNG', 'CSV', 'XLSX', 'PDF', 'TEXT'],
        kpis: [
          { label: 'Sales Value', value: fmtRs(salesVal), tone: 'emerald' },
          { label: 'Purchases Value', value: fmtRs(purVal), tone: 'sky' },
          { label: 'Expenses + Labour', value: fmtRs(expVal + labourVal), tone: 'rose' },
          { label: 'Cash + Bank (Live)', value: fmtRs(cash + bank), tone: 'amber' },
          { label: 'Advances Paid', value: fmtRs(advVal), tone: 'indigo' },
          { label: 'Operating Spread', value: fmtRs(estNet), tone: estNet >= 0 ? 'emerald' : 'rose' },
        ],
        barsTitle: 'Period Business Summary',
        bars: [
          { label: 'Sales', value: salesVal, displayValue: fmtRs(salesVal) },
          { label: 'Purchases', value: purVal, displayValue: fmtRs(purVal) },
          { label: 'Daily Expenses', value: expVal, displayValue: fmtRs(expVal) },
          { label: 'Daily Labour', value: labourVal, displayValue: fmtRs(labourVal) },
          { label: 'Staff & Labour Adv', value: advVal, displayValue: fmtRs(advVal) },
        ],
        headers: ['Date', 'Journal No', 'Source', 'Narration', 'Debit (INR)', 'Credit (INR)'],
        rows: pJournals.map((j) => [
          j.entryDate,
          j.entryNo,
          j.sourceType,
          j.narration,
          j.totalDebit,
          j.totalCredit,
        ]),
      };
    }

    case 'SETTINGS': {
      const pLogs = data.auditLogs
        .filter((l) => inRange(l.timestamp, startDate, endDate, period))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const totalRecords =
        data.purchases.length +
        data.sales.length +
        data.invoices.length +
        data.expenses.length +
        data.payments.length +
        data.weighments.length +
        data.employees.length +
        data.parties.length +
        data.journalEntries.length;
      const lastBackup = data.backupHistory[0];

      return {
        ...base,
        moduleTitle: 'System Settings, Cloud Backup & Audit Report',
        recommendedFormats: ['PNG', 'CSV', 'PDF', 'TEXT'],
        kpis: [
          { label: 'Total ERP Records', value: String(totalRecords), tone: 'sky' },
          { label: 'Backups Logged', value: String(data.backupHistory.length), tone: 'emerald' },
          { label: 'Period Audit Events', value: String(pLogs.length), tone: 'indigo' },
          { label: 'Active Yards', value: String(data.yards.length), tone: 'amber' },
          { label: 'Last Backup', value: lastBackup ? toDateOnly(lastBackup.createdAt) : 'None', tone: 'slate' },
          { label: 'Journal Entries', value: String(data.journalEntries.length), tone: 'emerald' },
        ],
        headers: ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID'],
        rows: pLogs.map((l) => [
          l.timestamp.slice(0, 19).replace('T', ' '),
          l.actorName,
          l.action,
          l.entityType,
          l.entityId,
        ]),
      };
    }
  }
}
