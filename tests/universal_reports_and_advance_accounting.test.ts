import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_ERP_MODULE_REPORT_IDS,
  buildModuleReportPayload,
  type ModuleReportContextData,
} from '../src/utils/moduleReportBuilders';
import {
  buildModuleCsv,
  buildModuleWhatsAppText,
  resolveVisualReportRange,
  shiftLocalDateStr,
} from '../src/utils/visualReportExporter';
import {
  createAccountTransactionJournal,
  createDailyLabourJournal,
  createEmployeeAdvanceJournal,
  createLabourAdvanceJournal,
} from '../backend/business-rules/accountingEngine';
import { computeCashBookSummary } from '../backend/business-rules/financeEngine';
import type { AccountTransaction, CashBankAccount, Company } from '../src/types';

const TEST_COMPANY: Company = {
  id: 'comp-ye',
  code: 'YE',
  name: 'Yashoth Enterprises',
  companyName: 'Yashoth Enterprises',
  legalName: 'Yashoth Enterprises',
  addressLine1: 'Chennai, TN',
  city: 'Chennai',
  stateName: 'Tamil Nadu',
  stateCode: '33',
  pincode: '600001',
  gstin: '33ABCDE1234F1Z5',
  phone: '9840000000',
  email: 'yashothenterprises44@gmail.com',
  bankName: 'HDFC Bank',
  bankAccountNo: '1234567890',
  bankBranch: 'Chennai',
  bankBranchIfsc: 'HDFC0000001',
  invoicePrefix: 'YE/26-27/',
  purchasePrefix: 'PUR-',
  defaultBaseUnit: 'KG',
  currency: 'INR',
  isActive: true,
  createdAt: '2026-04-01T00:00:00Z',
};

function makeFixtureData(): ModuleReportContextData {
  const cashAcc: CashBankAccount = {
    id: 'acc-cash',
    companyId: 'comp-ye',
    accountCode: '1010',
    accountName: 'Yard Cash Box',
    accountType: 'CASH',
    openingBalance: 50000,
    openingBalanceDate: '2026-11-01',
    isActive: true,
  };
  const bankAcc: CashBankAccount = {
    id: 'acc-bank',
    companyId: 'comp-ye',
    accountCode: '1020',
    accountName: 'HDFC Current',
    accountType: 'BANK',
    openingBalance: 150000,
    openingBalanceDate: '2026-11-01',
    isActive: true,
  };

  return {
    company: TEST_COMPANY,
    yards: [{ id: 'y1', code: 'Y1', name: 'Main Yard', locationAddress: 'Chennai', isActive: true }],
    materials: [{ id: 'm1', code: 'HMS', name: 'HMS Scrap', category: 'Steel', baseUnit: 'KG', hsnCode: '7204', defaultPurchaseRate: 30, defaultSalesRate: 40, defaultGstRate: 18, minStockAlert: 100, isActive: true }],
    parties: [
      { id: 'p-cust', partyCode: 'C1', legalName: 'Sri Murugan Steels', partyType: 'CUSTOMER', contactPerson: 'Murugan', phone: '9000000001', addressLine1: 'Chennai', city: 'Chennai', stateName: 'Tamil Nadu', stateCode: '33', paymentTerms: 'Net 15', creditLimit: 500000, openingBalance: 0, openingBalanceDate: '2026-04-01', isActive: true },
      { id: 'p-sup', partyCode: 'S1', legalName: 'Kaveri Metals', partyType: 'SUPPLIER', contactPerson: 'Kaveri', phone: '9000000002', addressLine1: 'Chennai', city: 'Chennai', stateName: 'Tamil Nadu', stateCode: '33', paymentTerms: 'Cash', creditLimit: 0, openingBalance: 0, openingBalanceDate: '2026-04-01', isActive: true },
    ],
    vehicles: [
      { id: 'v1', registrationNo: 'TN04AB1234', vehicleType: 'Lorry', ownershipType: 'OWNED', driverName: 'Ravi', tareWeight: 4200, isActive: true },
    ],
    vehicleDocuments: [
      { id: 'vd1', vehicleId: 'v1', documentType: 'INSURANCE', expiryDate: '2026-12-31', reminderDaysBefore: 30 },
    ],
    employees: [
      { id: 'e1', employeeCode: 'EMP-001', fullName: 'Bala', designation: 'Store Keeper', department: 'Yard Operations', phone: '9888888888', joiningDate: '2026-01-01', dailyWageRate: 0, monthlySalary: 30000, currentAdvanceBalance: 2000, isActive: true },
    ],
    attendance: [
      { id: 'att1', employeeId: 'e1', attendanceDate: '2026-11-20', status: 'PRESENT', overtimeHours: 0, markedBy: 'Owner', isCorrected: false },
      { id: 'att2', employeeId: 'e1', attendanceDate: '2026-11-21', status: 'WEEK_OFF', overtimeHours: 0, markedBy: 'Owner', isCorrected: false },
    ],
    accounts: [cashAcc, bankAcc],
    accountTransactions: [
      { id: 'tx1', accountId: 'acc-cash', transactionDate: '2026-11-20', transactionType: 'EMPLOYEE_ADVANCE', direction: 'CREDIT', amount: 2000, referenceNo: 'ADV-26-0001', description: 'Employee advance issued: Bala', createdBy: 'Owner', createdAt: '2026-11-20T10:00:00Z' },
      { id: 'tx2', accountId: 'acc-cash', transactionDate: '2026-11-21', transactionType: 'LABOUR_ADVANCE', direction: 'CREDIT', amount: 500, referenceNo: 'LADV-26-0001', description: 'Labour advance issued: Mani Gang', createdBy: 'Owner', createdAt: '2026-11-21T10:00:00Z' },
    ],
    expenses: [
      { id: 'ex1', voucherNo: 'EXP-01', expenseDate: '2026-11-20', category: 'Diesel / Petrol', amount: 1500, accountId: 'acc-cash', paymentMode: 'CASH', status: 'PAID', paidTo: 'HPCL', createdBy: 'Owner', createdAt: '2026-11-20T09:00:00Z' },
      { id: 'ex2', voucherNo: 'EXP-02', expenseDate: '2026-11-21', category: 'Tea / Drinking Water', amount: 250, accountId: 'acc-cash', paymentMode: 'CASH', status: 'PAID', paidTo: 'Tea Stall', createdBy: 'Owner', createdAt: '2026-11-21T09:00:00Z' },
    ],
    weighments: [
      { id: 'w1', weighmentNo: 'W-01', weighingMethod: 'WEIGHBRIDGE_SLIP', weighmentDate: '2026-11-20', vehicleRegistration: 'TN04AB1234', grossWeight: 14200, tareWeight: 4200, netWeight: 10000, approvedDeductions: 0, payableWeight: 10000, unit: 'KG', operatorName: 'Op', verificationStatus: 'VERIFIED', createdAt: '2026-11-20T08:00:00Z' },
    ],
    collectionJobs: [
      { id: 'cj1', jobNo: 'CJ-01', supplierPartyId: 'p-sup', pickupLocation: 'Ambattur', materialId: 'm1', plannedDate: '2026-11-20', estimatedQuantity: 5000, actualWeight: 4800, transportExpenses: 800, status: 'COMPLETED', createdAt: '2026-11-20T07:00:00Z' },
    ],
    purchases: [
      { id: 'pur1', purchaseNo: 'PUR-01', transactionDate: '2026-11-20', supplierPartyId: 'p-sup', supplierName: 'Kaveri Metals', sourceType: 'DIRECT_SUPPLIER', yardId: 'y1', netWeight: 1000, lines: [], subtotalAmount: 30000, taxAmount: 5400, otherCharges: 0, totalAmount: 35400, amountPaid: 20000, outstandingBalance: 15400, status: 'POSTED', createdBy: 'Owner', createdAt: '2026-11-20T11:00:00Z' },
      { id: 'pur2', purchaseNo: 'PUR-02', transactionDate: '2026-11-21', supplierPartyId: 'p-sup', supplierName: 'Kaveri Metals', sourceType: 'DIRECT_SUPPLIER', yardId: 'y1', netWeight: 500, lines: [], subtotalAmount: 15000, taxAmount: 2700, otherCharges: 0, totalAmount: 17700, amountPaid: 0, outstandingBalance: 17700, status: 'POSTED', createdBy: 'Owner', createdAt: '2026-11-21T11:00:00Z' },
    ],
    inventoryLots: [
      { id: 'lot1', lotNumber: 'LOT-01', materialId: 'm1', yardId: 'y1', initialQuantity: 1000, remainingQuantity: 600, unitCost: 30, receivedAt: '2026-11-20T11:00:00Z', isExhausted: false },
    ],
    stockMovements: [
      { id: 'sm1', movementType: 'PURCHASE_RECEIPT', transactionRef: 'PUR-01', materialId: 'm1', yardId: 'y1', quantity: 1000, unitCost: 30, totalCost: 30000, createdBy: 'Owner', createdAt: '2026-11-20T11:00:00Z' },
    ],
    sales: [
      { id: 'sal1', salesNo: 'SO-01', orderDate: '2026-11-20', customerPartyId: 'p-cust', yardId: 'y1', lines: [], status: 'INVOICED', subtotalAmount: 40000, taxAmount: 7200, totalAmount: 47200, allocatedCogs: 30000, createdBy: 'Owner', createdAt: '2026-11-20T13:00:00Z' },
    ],
    invoices: [
      { id: 'inv1', invoiceNo: 'YE/26-27/001', invoiceDate: '2026-11-20', customerPartyId: 'p-cust', customerName: 'Sri Murugan Steels', billingAddress: 'Chennai', shippingAddress: 'Chennai', customerStateName: 'Tamil Nadu', customerStateCode: '33', placeOfSupply: 'Tamil Nadu', lines: [], subtotalTaxable: 40000, cgstRate: 9, cgstAmount: 3600, sgstRate: 9, sgstAmount: 3600, igstRate: 0, igstAmount: 0, roundOff: 0, grandTotal: 47200, amountInWords: 'Forty Seven Thousand Two Hundred', taxAmountInWords: 'Seven Thousand Two Hundred', paymentStatus: 'PARTIALLY_PAID', amountPaid: 25000, outstandingBalance: 22200, immutableSnapshotJson: '{}', isCancelled: false, createdBy: 'Owner', createdAt: '2026-11-20T14:00:00Z' },
    ],
    payments: [
      { id: 'pay1', paymentNo: 'RCP-01', paymentDate: '2026-11-20', direction: 'INFLOW_RECEIPT', partyId: 'p-cust', accountId: 'acc-bank', totalAmount: 25000, unallocatedAmount: 0, paymentMethod: 'UPI', status: 'COMPLETED', allocations: [], createdBy: 'Owner', createdAt: '2026-11-20T15:00:00Z' },
    ],
    commercialDocuments: [
      { id: 'doc1', companyId: 'comp-ye', documentType: 'QUOTATION', documentNo: 'QT-01', documentDate: '2026-11-20', partyId: 'p-cust', partyName: 'Sri Murugan Steels', partyAddress: 'Chennai', placeOfSupply: 'Tamil Nadu', stateCode: '33', lines: [], subtotalTaxable: 50000, cgstRate: 9, cgstAmount: 4500, sgstRate: 9, sgstAmount: 4500, igstRate: 0, igstAmount: 0, roundOff: 0, grandTotal: 59000, amountPaid: 0, outstandingBalance: 59000, status: 'ISSUED', createdBy: 'Owner', createdAt: '2026-11-20T12:00:00Z' },
    ],
    journalEntries: [],
    salaryRecords: [],
    employeeAdvances: [
      { id: 'ea1', employeeId: 'e1', employeeName: 'Bala', advanceDate: '2026-11-20', amount: 2000, recoveredAmount: 0, remainingBalance: 2000, status: 'OPEN', paymentMode: 'CASH', accountId: 'acc-cash', voucherNo: 'ADV-26-0001', createdAt: '2026-11-20T10:00:00Z', createdBy: 'Owner' },
    ],
    labourAdvances: [
      { id: 'la1', workerNameOrGroup: 'Mani Gang', advanceDate: '2026-11-21', amount: 500, adjustedAmount: 0, remainingBalance: 500, status: 'OPEN', paymentMode: 'CASH', accountId: 'acc-cash', voucherNo: 'LADV-26-0001', createdAt: '2026-11-21T10:00:00Z', createdBy: 'Owner' },
    ],
    dailyLabourEntries: [],
    contractorWorkEntries: [],
    backupHistory: [
      { id: 'bk1', backupName: 'backup-1', backupType: 'FULL_DATABASE', destination: 'SUPABASE_CLOUD', fileSizeBytes: 1024, sha256Checksum: 'abc', isEncrypted: false, schemaVersion: '1.0', totalRecords: 10, recordCountsJson: {}, financialTotalsJson: {}, status: 'SUCCESS', createdBy: 'Owner', createdAt: '2026-11-20T18:00:00Z' },
    ],
    auditLogs: [
      { id: 'al1', actorId: 'u1', actorName: 'Owner', action: 'ISSUE_EMPLOYEE_ADVANCE', entityType: 'EMPLOYEE_ADVANCE', entityId: 'ea1', timestamp: '2026-11-20T10:00:00Z' },
    ],
  };
}

describe('Particular Date, Custom Range & Universal 16-Module Reports', () => {
  it('resolves Particular Date, Week, Month, Custom Range (even reversed), and All Time accurately', () => {
    const dayRange = resolveVisualReportRange('DAY', '2026-11-20');
    expect(dayRange.startDate).toBe('2026-11-20');
    expect(dayRange.endDate).toBe('2026-11-20');
    expect(dayRange.label).toContain('2026-11-20');

    const shifted = shiftLocalDateStr('2026-11-20', -1);
    expect(shifted).toBe('2026-11-19');

    const custom = resolveVisualReportRange('CUSTOM', '2026-11-25', '2026-11-20');
    expect(custom.startDate).toBe('2026-11-20');
    expect(custom.endDate).toBe('2026-11-25');

    const all = resolveVisualReportRange('ALL', '2026-11-20');
    expect(all.startDate).toBe('1970-01-01');
    expect(all.endDate).toBe('2999-12-31');
  });

  it('generates valid report payload, UTF-8 BOM CSV, and WhatsApp text for ALL 16 ERP modules', () => {
    const data = makeFixtureData();
    expect(ALL_ERP_MODULE_REPORT_IDS.length).toBe(16);

    for (const moduleId of ALL_ERP_MODULE_REPORT_IDS) {
      const payload = buildModuleReportPayload(moduleId, data, 'DAY', '2026-11-20');
      expect(payload.moduleTitle.length).toBeGreaterThan(5);
      expect(payload.kpis.length).toBeGreaterThanOrEqual(4);
      expect(payload.headers.length).toBeGreaterThanOrEqual(4);
      expect(payload.recommendedFormats.length).toBeGreaterThanOrEqual(3);

      const csv = buildModuleCsv(payload.headers, payload.rows);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain(payload.headers[0]);

      const waText = buildModuleWhatsAppText(payload);
      expect(waText).toContain('Yashoth Enterprises');
      expect(waText).toContain('2026-11-20');
    }
  });

  it('strictly filters Particular Date records (e.g. 2026-11-20 excludes 2026-11-21)', () => {
    const data = makeFixtureData();

    const purNov20 = buildModuleReportPayload('PURCHASES', data, 'DAY', '2026-11-20');
    expect(purNov20.rows.length).toBe(1);
    expect(purNov20.rows[0][1]).toBe('PUR-01');

    const purNov21 = buildModuleReportPayload('PURCHASES', data, 'DAY', '2026-11-21');
    expect(purNov21.rows.length).toBe(1);
    expect(purNov21.rows[0][1]).toBe('PUR-02');

    const purRange = buildModuleReportPayload('PURCHASES', data, 'CUSTOM', '2026-11-20', '2026-11-21');
    expect(purRange.rows.length).toBe(2);

    const empNov20 = buildModuleReportPayload('EMPLOYEES', data, 'DAY', '2026-11-20');
    expect(empNov20.rows.length).toBe(1);
    expect(empNov20.rows[0][3]).toBe('PRESENT');

    const empNov21 = buildModuleReportPayload('EMPLOYEES', data, 'DAY', '2026-11-21');
    expect(empNov21.rows.length).toBe(1);
    expect(empNov21.rows[0][3]).toBe('WEEK_OFF');
  });

  it('wires SendReportButton into EVERY SINGLE ONE of the 16 module views in src/modules/', () => {
    const moduleFiles: { file: string; moduleId: string }[] = [
      { file: 'src/modules/dashboard/DashboardView.tsx', moduleId: 'DASHBOARD' },
      { file: 'src/modules/purchases/PurchasesView.tsx', moduleId: 'PURCHASES' },
      { file: 'src/modules/collections/CollectionsView.tsx', moduleId: 'COLLECTIONS' },
      { file: 'src/modules/weighment/WeighmentView.tsx', moduleId: 'WEIGHMENT' },
      { file: 'src/modules/inventory/InventoryView.tsx', moduleId: 'INVENTORY' },
      { file: 'src/modules/sales/SalesView.tsx', moduleId: 'SALES' },
      { file: 'src/modules/invoices/InvoicesView.tsx', moduleId: 'INVOICES' },
      { file: 'src/modules/documents/CommercialDocumentsView.tsx', moduleId: 'DOCUMENTS' },
      { file: 'src/modules/parties/PartiesView.tsx', moduleId: 'PARTIES' },
      { file: 'src/modules/payments/PaymentsView.tsx', moduleId: 'PAYMENTS' },
      { file: 'src/modules/finance/FinanceView.tsx', moduleId: 'FINANCE' },
      { file: 'src/modules/vehicles/VehiclesView.tsx', moduleId: 'VEHICLES' },
      { file: 'src/modules/employees/EmployeesView.tsx', moduleId: 'EMPLOYEES' },
      { file: 'src/modules/reports/ReportsView.tsx', moduleId: 'REPORTS' },
      { file: 'src/modules/reports/OwnerSummaryReportsView.tsx', moduleId: 'OWNER_REPORTS' },
      { file: 'src/modules/settings/SettingsView.tsx', moduleId: 'SETTINGS' },
    ];

    for (const m of moduleFiles) {
      const content = fs.readFileSync(path.resolve(process.cwd(), m.file), 'utf-8');
      expect(content, `${m.file} must import SendReportButton`).toContain('SendReportButton');
      expect(content, `${m.file} must render moduleId="${m.moduleId}"`).toContain(`moduleId="${m.moduleId}"`);
    }

    // Also verify IST local date fix in OwnerSummaryReportsView
    const ownerReportsSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/reports/OwnerSummaryReportsView.tsx'),
      'utf-8'
    );
    expect(ownerReportsSrc).toContain('getLocalDateStr()');
    expect(ownerReportsSrc).not.toContain('new Date().toISOString().slice(0, 10)');
  });
});

describe('Zero-Leak Staff & Daily Labour Advance Accounting', () => {
  it('posts balanced double-entry journals for EMPLOYEE_ADVANCE (1060) and LABOUR_ADVANCE (1070)', () => {
    const empTxJe = createAccountTransactionJournal(
      {
        id: 'tx-ea-1',
        transactionDate: '2026-11-27',
        transactionType: 'EMPLOYEE_ADVANCE',
        direction: 'CREDIT',
        amount: 3000,
        referenceNo: 'ADV-26-0001',
        description: 'Employee advance to Bala',
      },
      '1010',
      TEST_COMPANY
    );
    expect(empTxJe.totalDebit).toBe(3000);
    expect(empTxJe.totalCredit).toBe(3000);
    expect(empTxJe.lines.find((l) => l.accountCode === '1060')?.debit).toBe(3000);
    expect(empTxJe.lines.find((l) => l.accountCode === '1010')?.credit).toBe(3000);

    const labTxJe = createAccountTransactionJournal(
      {
        id: 'tx-la-1',
        transactionDate: '2026-11-27',
        transactionType: 'LABOUR_ADVANCE',
        direction: 'CREDIT',
        amount: 1200,
        referenceNo: 'LADV-26-0001',
        description: 'Labour advance to Mani Gang',
      },
      '1010',
      TEST_COMPANY
    );
    expect(labTxJe.totalDebit).toBe(1200);
    expect(labTxJe.totalCredit).toBe(1200);
    expect(labTxJe.lines.find((l) => l.accountCode === '1070')?.debit).toBe(1200);
    expect(labTxJe.lines.find((l) => l.accountCode === '1010')?.credit).toBe(1200);
  });

  it('deducts BOTH Staff Advance and Labour Advance from Cash Book without double-counting in paidExpenses', () => {
    const cashAcc: CashBankAccount = {
      id: 'acc-cash',
      companyId: 'comp-ye',
      accountCode: '1010',
      accountName: 'Yard Cash',
      accountType: 'CASH',
      openingBalance: 20000,
      openingBalanceDate: '2026-11-01',
      isActive: true,
    };

    const txs: AccountTransaction[] = [
      {
        id: 't1',
        accountId: 'acc-cash',
        transactionDate: '2026-11-27',
        transactionType: 'EMPLOYEE_ADVANCE',
        direction: 'CREDIT',
        amount: 2000,
        referenceNo: 'ADV-1',
        description: 'Employee advance issued: Bala',
        createdBy: 'Owner',
        createdAt: '2026-11-27T10:00:00Z',
      },
      {
        id: 't2',
        accountId: 'acc-cash',
        transactionDate: '2026-11-27',
        transactionType: 'LABOUR_ADVANCE',
        direction: 'CREDIT',
        amount: 500,
        referenceNo: 'LADV-1',
        description: 'Labour advance issued: Mani Gang',
        createdBy: 'Owner',
        createdAt: '2026-11-27T11:00:00Z',
      },
      {
        id: 't3',
        accountId: 'acc-cash',
        transactionDate: '2026-11-27',
        transactionType: 'OPERATING_EXPENSE',
        direction: 'CREDIT',
        amount: 1000,
        referenceNo: 'EXP-1',
        description: 'Diesel expense',
        createdBy: 'Owner',
        createdAt: '2026-11-27T12:00:00Z',
      },
    ];

    const summary = computeCashBookSummary({
      cashAccounts: [cashAcc],
      accountTransactions: txs,
      expenses: [],
      startDate: '2026-11-27',
      endDate: '2026-11-27',
    });

    expect(summary.openingCash).toBe(20000);
    expect(summary.paidExpenses).toBe(1000);
    expect(summary.salaryLabourContractorPayments).toBe(2500); // 2000 staff adv + 500 labour adv
    expect(summary.expectedClosingCash).toBe(16500); // 20000 - 1000 - 2500 (every rupee counted!)
  });

  it('clears 1070 Labour Advance to zero when fresh advance + daily labour settlement are both posted', () => {
    const advJe = createLabourAdvanceJournal(
      { id: 'la-1', workerNameOrGroup: 'Mani Gang', advanceDate: '2026-11-27', amount: 500, paymentMode: 'CASH' },
      '1010',
      TEST_COMPANY,
      'Owner'
    );
    const labJe = createDailyLabourJournal(
      {
        id: 'dl-1',
        workerNameOrGroup: 'Mani Gang',
        workDate: '2026-11-27',
        totalLabourCost: 1950,
        advanceAmount: 500,
        amountPaid: 1450,
        remainingBalance: 0,
        paymentMode: 'CASH',
      },
      '1010',
      TEST_COMPANY,
      'Owner'
    );

    const allLines = [...advJe.lines, ...labJe.lines];
    const dr1070 = allLines.filter((l) => l.accountCode === '1070').reduce((s, l) => s + l.debit, 0);
    const cr1070 = allLines.filter((l) => l.accountCode === '1070').reduce((s, l) => s + l.credit, 0);
    const crCash = allLines.filter((l) => l.accountCode === '1010').reduce((s, l) => s + l.credit, 0);
    const drLabourExp = allLines.filter((l) => l.accountCode === '5020').reduce((s, l) => s + l.debit, 0);

    expect(dr1070 - cr1070).toBe(0); // Advance account nets cleanly to 0
    expect(crCash).toBe(1950); // Total Cash out = 500 advance + 1450 settlement
    expect(drLabourExp).toBe(1950); // Total P&L expense = 1950 (zero double-counting!)

    // Also verify Employee advance journal creates balanced Dr 1060 / Cr 1010
    const eAdvJe = createEmployeeAdvanceJournal(
      { id: 'ea-1', employeeName: 'Bala', advanceDate: '2026-11-27', amount: 2000, paymentMode: 'CASH' },
      '1010',
      TEST_COMPANY,
      'Owner'
    );
    expect(eAdvJe.totalDebit).toBe(2000);
    expect(eAdvJe.totalCredit).toBe(2000);
  });

  it('exposes UI flows in EmployeesView and FinanceView so no advance update leaks uncounted cash', () => {
    const empView = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/employees/EmployeesView.tsx'), 'utf-8');
    expect(empView).toContain('issueEmployeeAdvance');
    expect(empView).toContain('+ Give Advance');
    expect(empView).toContain('Opening / Prior Balance');

    const finView = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/finance/FinanceView.tsx'), 'utf-8');
    expect(finView).toContain('issueEmployeeAdvance');
    expect(finView).toContain('issueLabourAdvance');
    expect(finView).toContain('+ Give Staff Advance');
    expect(finView).toContain('+ Give Labour Advance');
    expect(finView).toContain('Cash/Bank Advances Paid Out');
    expect(finView).toContain('Particular Date');
    expect(finView).toContain('Custom Range');
  });
});
