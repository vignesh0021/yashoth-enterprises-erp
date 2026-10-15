// Yasoth Enterprises Scrap ERP — Global Application State & Business Orchestration Context
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  CompanySettings, 
  UserRole, 
  Yard, 
  Material, 
  MaterialGrade, 
  Party, 
  Vehicle, 
  VehicleDocument, 
  Employee, 
  AttendanceEntry, 
  CashBankAccount, 
  AccountTransaction, 
  Expense, 
  Weighment, 
  CollectionJob, 
  PurchaseHeader, 
  InventoryLot, 
  StockMovement, 
  SalesHeader, 
  Invoice, 
  Payment, 
  StockCount, 
  AuditLog, 
  CollectionStatus, 
  AttendanceStatus 
} from '../types/index.ts';

import { 
  INITIAL_COMPANY_SETTINGS, 
  INITIAL_YARDS, 
  INITIAL_MATERIALS, 
  INITIAL_MATERIAL_GRADES, 
  INITIAL_PARTIES, 
  INITIAL_VEHICLES, 
  INITIAL_VEHICLE_DOCS, 
  INITIAL_EMPLOYEES, 
  INITIAL_ACCOUNTS, 
  INITIAL_LOTS, 
  INITIAL_STOCK_MOVEMENTS, 
  INITIAL_ACCOUNT_TRANSACTIONS 
} from '../services/mockData.ts';

import { postPurchaseTransaction } from '../../backend/business-rules/purchaseEngine.ts';
import { dispatchSalesTransaction } from '../../backend/business-rules/salesEngine.ts';
import { postPaymentVoucher, executeContraTransfer } from '../../backend/business-rules/financeEngine.ts';
import { migrateParties, migrateOpeningStock } from '../../backend/business-rules/dataMigration.ts';
import { createStockMovement } from '../../backend/business-rules/inventoryEngine.ts';
import { calcNetWeight, calcPayableWeight, roundTo2, roundTo3 } from '../utils/calculations.ts';

interface ERPContextType {
  currentUser: { id: string; fullName: string; role: UserRole };
  switchRole: (role: UserRole) => void;
  company: CompanySettings;
  updateCompanySettings: (settings: Partial<CompanySettings>) => void;
  yards: Yard[];
  materials: Material[];
  materialGrades: MaterialGrade[];
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
  sales: SalesHeader[];
  invoices: Invoice[];
  payments: Payment[];
  stockCounts: StockCount[];
  auditLogs: AuditLog[];

  // Core Business Actions
  addParty: (partyData: Omit<Party, 'id'>) => Party;
  addMaterial: (matData: Omit<Material, 'id'>) => Material;
  recordWeighment: (data: Omit<Weighment, 'id' | 'weighmentNo' | 'netWeight' | 'payableWeight' | 'createdAt'>) => Weighment;
  createPurchase: (purchaseData: Omit<PurchaseHeader, 'id' | 'purchaseNo' | 'createdAt'>) => PurchaseHeader;
  postPurchase: (purchaseId: string) => void;
  createCollectionJob: (jobData: Omit<CollectionJob, 'id' | 'jobNo' | 'createdAt'>) => CollectionJob;
  updateCollectionStatus: (jobId: string, status: CollectionStatus, actualWeight?: number, transportExpenses?: number) => void;
  createSalesOrder: (salesData: Omit<SalesHeader, 'id' | 'salesNo' | 'createdAt'>) => SalesHeader;
  dispatchSalesOrder: (salesId: string) => Invoice;
  recordPayment: (paymentParams: Parameters<typeof postPaymentVoucher>[0]) => Payment;
  recordContraTransfer: (sourceAccountId: string, destAccountId: string, amount: number, referenceNo: string) => void;
  recordExpense: (expenseData: Omit<Expense, 'id' | 'voucherNo' | 'createdAt'>) => Expense;
  markAttendance: (employeeId: string, date: string, status: AttendanceStatus, overtimeHours?: number, remarks?: string) => void;
  reconcileStockCount: (yardId: string, lines: { materialId: string; physicalQuantity: number; reason?: string }[], notes?: string) => StockCount;
  
  // Data Migration & Backups
  importParties: (rows: any[], dryRun: boolean) => ReturnType<typeof migrateParties>;
  importOpeningStock: (rows: any[], dryRun: boolean) => ReturnType<typeof migrateOpeningStock>;
  resetToDemoData: () => void;
  exportBackup: () => string;
  restoreBackup: (jsonStr: string) => boolean;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

const STORAGE_PREFIX = 'yasoth_erp_v1_';

export const ERPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string; role: UserRole }>({
    id: 'usr-admin-1',
    fullName: 'Yasoth Admin',
    role: 'owner_admin',
  });

  const load = <T,>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  };

  const [company, setCompany] = useState<CompanySettings>(() => load('company', INITIAL_COMPANY_SETTINGS));
  const [yards, setYards] = useState<Yard[]>(() => load('yards', INITIAL_YARDS));
  const [materials, setMaterials] = useState<Material[]>(() => load('materials', INITIAL_MATERIALS));
  const [materialGrades, setMaterialGrades] = useState<MaterialGrade[]>(() => load('materialGrades', INITIAL_MATERIAL_GRADES));
  const [parties, setParties] = useState<Party[]>(() => load('parties', INITIAL_PARTIES));
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => load('vehicles', INITIAL_VEHICLES));
  const [vehicleDocuments, setVehicleDocuments] = useState<VehicleDocument[]>(() => load('vehicleDocuments', INITIAL_VEHICLE_DOCS));
  const [employees, setEmployees] = useState<Employee[]>(() => load('employees', INITIAL_EMPLOYEES));
  const [attendance, setAttendance] = useState<AttendanceEntry[]>(() => load('attendance', []));
  const [accounts, setAccounts] = useState<CashBankAccount[]>(() => load('accounts', INITIAL_ACCOUNTS));
  const [accountTransactions, setAccountTransactions] = useState<AccountTransaction[]>(() => load('accountTransactions', INITIAL_ACCOUNT_TRANSACTIONS));
  const [expenses, setExpenses] = useState<Expense[]>(() => load('expenses', []));
  const [weighments, setWeighments] = useState<Weighment[]>(() => load('weighments', []));
  const [collectionJobs, setCollectionJobs] = useState<CollectionJob[]>(() => load('collectionJobs', []));
  const [purchases, setPurchases] = useState<PurchaseHeader[]>(() => load('purchases', []));
  const [inventoryLots, setInventoryLots] = useState<InventoryLot[]>(() => load('inventoryLots', INITIAL_LOTS));
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => load('stockMovements', INITIAL_STOCK_MOVEMENTS));
  const [sales, setSales] = useState<SalesHeader[]>(() => load('sales', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => load('invoices', []));
  const [payments, setPayments] = useState<Payment[]>(() => load('payments', []));
  const [stockCounts, setStockCounts] = useState<StockCount[]>(() => load('stockCounts', []));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => load('auditLogs', []));

  // Persist state updates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'company', JSON.stringify(company));
      localStorage.setItem(STORAGE_PREFIX + 'yards', JSON.stringify(yards));
      localStorage.setItem(STORAGE_PREFIX + 'materials', JSON.stringify(materials));
      localStorage.setItem(STORAGE_PREFIX + 'parties', JSON.stringify(parties));
      localStorage.setItem(STORAGE_PREFIX + 'vehicles', JSON.stringify(vehicles));
      localStorage.setItem(STORAGE_PREFIX + 'vehicleDocuments', JSON.stringify(vehicleDocuments));
      localStorage.setItem(STORAGE_PREFIX + 'employees', JSON.stringify(employees));
      localStorage.setItem(STORAGE_PREFIX + 'attendance', JSON.stringify(attendance));
      localStorage.setItem(STORAGE_PREFIX + 'accounts', JSON.stringify(accounts));
      localStorage.setItem(STORAGE_PREFIX + 'accountTransactions', JSON.stringify(accountTransactions));
      localStorage.setItem(STORAGE_PREFIX + 'expenses', JSON.stringify(expenses));
      localStorage.setItem(STORAGE_PREFIX + 'weighments', JSON.stringify(weighments));
      localStorage.setItem(STORAGE_PREFIX + 'collectionJobs', JSON.stringify(collectionJobs));
      localStorage.setItem(STORAGE_PREFIX + 'purchases', JSON.stringify(purchases));
      localStorage.setItem(STORAGE_PREFIX + 'inventoryLots', JSON.stringify(inventoryLots));
      localStorage.setItem(STORAGE_PREFIX + 'stockMovements', JSON.stringify(stockMovements));
      localStorage.setItem(STORAGE_PREFIX + 'sales', JSON.stringify(sales));
      localStorage.setItem(STORAGE_PREFIX + 'invoices', JSON.stringify(invoices));
      localStorage.setItem(STORAGE_PREFIX + 'payments', JSON.stringify(payments));
      localStorage.setItem(STORAGE_PREFIX + 'stockCounts', JSON.stringify(stockCounts));
      localStorage.setItem(STORAGE_PREFIX + 'auditLogs', JSON.stringify(auditLogs));
    } catch (e) {
      console.warn('Error saving to localStorage', e);
    }
  }, [
    company, yards, materials, parties, vehicles, vehicleDocuments,
    employees, attendance, accounts, accountTransactions, expenses,
    weighments, collectionJobs, purchases, inventoryLots, stockMovements,
    sales, invoices, payments, stockCounts, auditLogs
  ]);

  const logAudit = (action: string, entityType: string, entityId: string, oldState?: any, newState?: any) => {
    const entry: AuditLog = {
      id: 'aud-' + Math.random().toString(36).substring(2, 11),
      actorId: currentUser.id,
      actorName: `${currentUser.fullName} (${currentUser.role})`,
      action,
      entityType,
      entityId,
      oldState: oldState ? JSON.stringify(oldState) : undefined,
      newState: newState ? JSON.stringify(newState) : undefined,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  const switchRole = (role: UserRole) => {
    setCurrentUser((prev) => ({
      ...prev,
      role,
      fullName: role === 'owner_admin' ? 'Yasoth Admin' : role.replace('_', ' ').toUpperCase(),
    }));
    logAudit('SWITCH_ROLE', 'USER', currentUser.id, null, { role });
  };

  const updateCompanySettings = (settings: Partial<CompanySettings>) => {
    setCompany((prev) => ({ ...prev, ...settings }));
    logAudit('UPDATE_SETTINGS', 'COMPANY', company.id, null, settings);
  };

  const addParty = (partyData: Omit<Party, 'id'>) => {
    const newParty: Party = {
      ...partyData,
      id: 'pty-' + Math.random().toString(36).substring(2, 11),
    };
    setParties((prev) => [newParty, ...prev]);
    logAudit('CREATE_PARTY', 'PARTY', newParty.id, null, newParty);
    return newParty;
  };

  const addMaterial = (matData: Omit<Material, 'id'>) => {
    const newMat: Material = {
      ...matData,
      id: 'mat-' + Math.random().toString(36).substring(2, 11),
    };
    setMaterials((prev) => [newMat, ...prev]);
    logAudit('CREATE_MATERIAL', 'MATERIAL', newMat.id, null, newMat);
    return newMat;
  };

  const recordWeighment = (data: Omit<Weighment, 'id' | 'weighmentNo' | 'netWeight' | 'payableWeight' | 'createdAt'>) => {
    const netWeight = calcNetWeight(data.grossWeight, data.tareWeight);
    const payableWeight = calcPayableWeight(data.grossWeight, data.tareWeight, data.approvedDeductions);
    const seq = weighments.length + 1;
    const weighmentNo = `WM-26-${String(seq).padStart(4, '0')}`;

    const newWeighment: Weighment = {
      ...data,
      id: 'wm-' + Math.random().toString(36).substring(2, 11),
      weighmentNo,
      netWeight,
      payableWeight,
      createdAt: new Date().toISOString(),
    };

    setWeighments((prev) => [newWeighment, ...prev]);
    logAudit('RECORD_WEIGHMENT', 'WEIGHMENT', newWeighment.id, null, newWeighment);
    return newWeighment;
  };

  const createPurchase = (purchaseData: Omit<PurchaseHeader, 'id' | 'purchaseNo' | 'createdAt'>) => {
    const seq = purchases.length + 1;
    const purchaseNo = `PUR-26-${String(seq).padStart(4, '0')}`;
    const newPurchase: PurchaseHeader = {
      ...purchaseData,
      id: 'pur-' + Math.random().toString(36).substring(2, 11),
      purchaseNo,
      createdAt: new Date().toISOString(),
    };
    setPurchases((prev) => [newPurchase, ...prev]);
    logAudit('CREATE_PURCHASE', 'PURCHASE', newPurchase.id, null, newPurchase);
    return newPurchase;
  };

  const postPurchase = (purchaseId: string) => {
    const purchase = purchases.find((p) => p.id === purchaseId);
    if (!purchase) throw new Error('Purchase record not found');

    const result = postPurchaseTransaction(purchase, stockMovements, currentUser.fullName);

    setPurchases((prev) => prev.map((p) => (p.id === purchaseId ? result.updatedPurchase : p)));
    setInventoryLots((prev) => [...result.newLots, ...prev]);
    setStockMovements((prev) => [...result.newMovements, ...prev]);

    logAudit('POST_PURCHASE', 'PURCHASE', purchaseId, purchase, result.updatedPurchase);
  };

  const createCollectionJob = (jobData: Omit<CollectionJob, 'id' | 'jobNo' | 'createdAt'>) => {
    const seq = collectionJobs.length + 1;
    const jobNo = `COL-26-${String(seq).padStart(4, '0')}`;
    const newJob: CollectionJob = {
      ...jobData,
      id: 'col-' + Math.random().toString(36).substring(2, 11),
      jobNo,
      createdAt: new Date().toISOString(),
    };
    setCollectionJobs((prev) => [newJob, ...prev]);
    logAudit('CREATE_COLLECTION', 'COLLECTION_JOB', newJob.id, null, newJob);
    return newJob;
  };

  const updateCollectionStatus = (
    jobId: string, 
    status: CollectionStatus, 
    actualWeight?: number, 
    transportExpenses?: number
  ) => {
    setCollectionJobs((prev) =>
      prev.map((job) => {
        if (job.id === jobId) {
          const updated = {
            ...job,
            status,
            actualWeight: actualWeight !== undefined ? actualWeight : job.actualWeight,
            transportExpenses: transportExpenses !== undefined ? transportExpenses : job.transportExpenses,
          };
          logAudit('UPDATE_COLLECTION_STATUS', 'COLLECTION_JOB', jobId, job, updated);
          return updated;
        }
        return job;
      })
    );
  };

  const createSalesOrder = (salesData: Omit<SalesHeader, 'id' | 'salesNo' | 'createdAt'>) => {
    const seq = sales.length + 1;
    const salesNo = `SO-26-${String(seq).padStart(4, '0')}`;
    const newSales: SalesHeader = {
      ...salesData,
      id: 'so-' + Math.random().toString(36).substring(2, 11),
      salesNo,
      createdAt: new Date().toISOString(),
    };
    setSales((prev) => [newSales, ...prev]);
    logAudit('CREATE_SALES_ORDER', 'SALES_HEADER', newSales.id, null, newSales);
    return newSales;
  };

  const dispatchSalesOrder = (salesId: string) => {
    const salesOrder = sales.find((s) => s.id === salesId);
    if (!salesOrder) throw new Error('Sales order not found');

    const customer = parties.find((p) => p.id === salesOrder.customerPartyId);
    if (!customer) throw new Error('Customer party not found');

    const nextInvoiceSeq = invoices.length + 10; // Start aligned with verified sample invoice 10

    const result = dispatchSalesTransaction(
      salesOrder,
      inventoryLots,
      stockMovements,
      customer,
      company,
      nextInvoiceSeq,
      currentUser.fullName
    );

    setSales((prev) => prev.map((s) => (s.id === salesId ? result.updatedSales : s)));
    setInventoryLots(result.updatedLots);
    setStockMovements((prev) => [...result.newMovements, ...prev]);
    setInvoices((prev) => [result.generatedInvoice, ...prev]);

    logAudit('DISPATCH_SALES', 'SALES_HEADER', salesId, salesOrder, result.updatedSales);
    logAudit('GENERATE_INVOICE', 'INVOICE', result.generatedInvoice.id, null, result.generatedInvoice);

    return result.generatedInvoice;
  };

  const recordPayment = (params: Parameters<typeof postPaymentVoucher>[0]) => {
    const result = postPaymentVoucher({
      ...params,
      allInvoices: invoices,
      allPurchases: purchases,
      actor: currentUser.fullName,
    });

    setPayments((prev) => [result.updatedPayment, ...prev]);
    setAccountTransactions((prev) => [result.newAccountTransaction, ...prev]);

    if (result.updatedInvoices.length > 0) {
      setInvoices((prev) =>
        prev.map((inv) => {
          const match = result.updatedInvoices.find((u) => u.id === inv.id);
          return match || inv;
        })
      );
    }

    if (result.updatedPurchases.length > 0) {
      setPurchases((prev) =>
        prev.map((pur) => {
          const match = result.updatedPurchases.find((u) => u.id === pur.id);
          return match || pur;
        })
      );
    }

    logAudit('RECORD_PAYMENT', 'PAYMENT', result.updatedPayment.id, null, result.updatedPayment);
    return result.updatedPayment;
  };

  const recordContraTransfer = (
    sourceAccountId: string,
    destAccountId: string,
    amount: number,
    referenceNo: string
  ) => {
    const source = accounts.find((a) => a.id === sourceAccountId);
    const dest = accounts.find((a) => a.id === destAccountId);
    if (!source || !dest) throw new Error('Accounts not found for contra transfer');

    const { outflowTx, inflowTx } = executeContraTransfer(
      source,
      dest,
      amount,
      new Date().toISOString().split('T')[0],
      referenceNo,
      currentUser.fullName
    );

    setAccountTransactions((prev) => [inflowTx, outflowTx, ...prev]);
    logAudit('CONTRA_TRANSFER', 'ACCOUNT_TRANSACTION', `${sourceAccountId}->${destAccountId}`, null, {
      amount,
      referenceNo,
    });
  };

  const recordExpense = (expenseData: Omit<Expense, 'id' | 'voucherNo' | 'createdAt'>) => {
    const seq = expenses.length + 1;
    const voucherNo = `EXP-26-${String(seq).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const newExpense: Expense = {
      ...expenseData,
      id: 'exp-' + Math.random().toString(36).substring(2, 11),
      voucherNo,
      createdAt: now,
    };

    const accountTx: AccountTransaction = {
      id: 'atx-' + Math.random().toString(36).substring(2, 11),
      accountId: expenseData.accountId,
      transactionDate: expenseData.expenseDate,
      transactionType: 'OPERATING_EXPENSE',
      direction: 'CREDIT', // Money leaves account
      amount: expenseData.amount,
      referenceNo: voucherNo,
      description: `Expense: ${expenseData.category} - ${expenseData.paidTo}`,
      createdBy: currentUser.fullName,
      createdAt: now,
    };

    setExpenses((prev) => [newExpense, ...prev]);
    setAccountTransactions((prev) => [accountTx, ...prev]);
    logAudit('RECORD_EXPENSE', 'EXPENSE', newExpense.id, null, newExpense);
    return newExpense;
  };

  const markAttendance = (
    employeeId: string, 
    date: string, 
    status: AttendanceStatus, 
    overtimeHours: number = 0, 
    remarks?: string
  ) => {
    setAttendance((prev) => {
      const existing = prev.find((a) => a.employeeId === employeeId && a.attendanceDate === date);
      if (existing) {
        return prev.map((a) =>
          a.employeeId === employeeId && a.attendanceDate === date
            ? { ...a, status, overtimeHours, remarks, isCorrected: true, correctionReason: 'Amended by Supervisor' }
            : a
        );
      } else {
        const newEntry: AttendanceEntry = {
          id: 'att-' + Math.random().toString(36).substring(2, 9),
          employeeId,
          attendanceDate: date,
          status,
          overtimeHours,
          remarks,
          markedBy: currentUser.fullName,
          isCorrected: false,
        };
        return [newEntry, ...prev];
      }
    });
    logAudit('MARK_ATTENDANCE', 'ATTENDANCE', `${employeeId}-${date}`, null, { status, overtimeHours });
  };

  const reconcileStockCount = (
    yardId: string,
    lines: { materialId: string; physicalQuantity: number; reason?: string }[],
    notes?: string
  ) => {
    const seq = stockCounts.length + 1;
    const countNo = `STK-CNT-${String(seq).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const countLines = lines.map((l) => {
      const movementsForMat = stockMovements.filter((m) => m.materialId === l.materialId && m.yardId === yardId);
      const systemQty = roundTo3(movementsForMat.reduce((sum, m) => sum + m.quantity, 0));
      const variance = roundTo3(l.physicalQuantity - systemQty);

      return {
        id: 'scl-' + Math.random().toString(36).substring(2, 9),
        materialId: l.materialId,
        systemQuantity: systemQty,
        physicalQuantity: roundTo3(l.physicalQuantity),
        varianceQuantity: variance,
        reason: l.reason || 'Periodic Physical Stock Audit',
      };
    });

    const newStockCount: StockCount = {
      id: 'sc-' + Math.random().toString(36).substring(2, 11),
      countNo,
      countDate: now.split('T')[0],
      yardId,
      conductedBy: currentUser.fullName,
      status: 'APPROVED',
      approvedBy: currentUser.fullName,
      notes,
      lines: countLines,
      createdAt: now,
    };

    // If there are variances, create approved adjustment stock movements
    const adjustmentMovements: StockMovement[] = [];
    for (const cl of countLines) {
      if (Math.abs(cl.varianceQuantity) > 0.001) {
        const mat = materials.find((m) => m.id === cl.materialId);
        const unitCost = mat?.defaultPurchaseRate || 0;
        const mov = createStockMovement([...stockMovements, ...adjustmentMovements], {
          movementType: cl.varianceQuantity > 0 ? 'STOCK_ADJUSTMENT' : 'STOCK_LOSS',
          transactionRef: countNo,
          materialId: cl.materialId,
          yardId,
          quantity: cl.varianceQuantity,
          unitCost,
          notes: `Stock count reconciliation adjustment: ${cl.reason}`,
          createdBy: currentUser.fullName,
        });
        adjustmentMovements.push(mov);
      }
    }

    setStockCounts((prev) => [newStockCount, ...prev]);
    if (adjustmentMovements.length > 0) {
      setStockMovements((prev) => [...adjustmentMovements, ...prev]);
    }

    logAudit('RECONCILE_STOCK', 'STOCK_COUNT', newStockCount.id, null, newStockCount);
    return newStockCount;
  };

  const importParties = (rows: any[], dryRun: boolean) => {
    const res = migrateParties(rows, parties, dryRun);
    if (!dryRun && res.importedRecords.length > 0) {
      setParties((prev) => [...res.importedRecords, ...prev]);
      logAudit('IMPORT_PARTIES', 'PARTY_MIGRATION', 'CSV_BATCH', null, { count: res.importedRecords.length });
    }
    return res;
  };

  const importOpeningStock = (rows: any[], dryRun: boolean) => {
    const res = migrateOpeningStock(rows, materials, yards, currentUser.fullName, dryRun);
    if (!dryRun && res.importedRecords.length > 0) {
      const lots = res.importedRecords.map((r) => r.lot);
      const movs = res.importedRecords.map((r) => r.movement);
      setInventoryLots((prev) => [...lots, ...prev]);
      setStockMovements((prev) => [...movs, ...prev]);
      logAudit('IMPORT_STOCK', 'STOCK_MIGRATION', 'CSV_BATCH', null, { count: lots.length });
    }
    return res;
  };

  const resetToDemoData = () => {
    setCompany(INITIAL_COMPANY_SETTINGS);
    setYards(INITIAL_YARDS);
    setMaterials(INITIAL_MATERIALS);
    setMaterialGrades(INITIAL_MATERIAL_GRADES);
    setParties(INITIAL_PARTIES);
    setVehicles(INITIAL_VEHICLES);
    setVehicleDocuments(INITIAL_VEHICLE_DOCS);
    setEmployees(INITIAL_EMPLOYEES);
    setAttendance([]);
    setAccounts(INITIAL_ACCOUNTS);
    setAccountTransactions(INITIAL_ACCOUNT_TRANSACTIONS);
    setExpenses([]);
    setWeighments([]);
    setCollectionJobs([]);
    setPurchases([]);
    setInventoryLots(INITIAL_LOTS);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setSales([]);
    setInvoices([]);
    setPayments([]);
    setStockCounts([]);
    setAuditLogs([]);
    localStorage.clear();
  };

  const exportBackup = () => {
    const backup = {
      timestamp: new Date().toISOString(),
      company,
      yards,
      materials,
      parties,
      vehicles,
      vehicleDocuments,
      employees,
      attendance,
      accounts,
      accountTransactions,
      expenses,
      weighments,
      collectionJobs,
      purchases,
      inventoryLots,
      stockMovements,
      sales,
      invoices,
      payments,
      stockCounts,
      auditLogs,
    };
    return JSON.stringify(backup, null, 2);
  };

  const restoreBackup = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.company) setCompany(data.company);
      if (data.yards) setYards(data.yards);
      if (data.materials) setMaterials(data.materials);
      if (data.parties) setParties(data.parties);
      if (data.vehicles) setVehicles(data.vehicles);
      if (data.vehicleDocuments) setVehicleDocuments(data.vehicleDocuments);
      if (data.employees) setEmployees(data.employees);
      if (data.attendance) setAttendance(data.attendance);
      if (data.accounts) setAccounts(data.accounts);
      if (data.accountTransactions) setAccountTransactions(data.accountTransactions);
      if (data.expenses) setExpenses(data.expenses);
      if (data.weighments) setWeighments(data.weighments);
      if (data.collectionJobs) setCollectionJobs(data.collectionJobs);
      if (data.purchases) setPurchases(data.purchases);
      if (data.inventoryLots) setInventoryLots(data.inventoryLots);
      if (data.stockMovements) setStockMovements(data.stockMovements);
      if (data.sales) setSales(data.sales);
      if (data.invoices) setInvoices(data.invoices);
      if (data.payments) setPayments(data.payments);
      if (data.stockCounts) setStockCounts(data.stockCounts);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <ERPContext.Provider
      value={{
        currentUser,
        switchRole,
        company,
        updateCompanySettings,
        yards,
        materials,
        materialGrades,
        parties,
        vehicles,
        vehicleDocuments,
        employees,
        attendance,
        accounts,
        accountTransactions,
        expenses,
        weighments,
        collectionJobs,
        purchases,
        inventoryLots,
        stockMovements,
        sales,
        invoices,
        payments,
        stockCounts,
        auditLogs,
        addParty,
        addMaterial,
        recordWeighment,
        createPurchase,
        postPurchase,
        createCollectionJob,
        updateCollectionStatus,
        createSalesOrder,
        dispatchSalesOrder,
        recordPayment,
        recordContraTransfer,
        recordExpense,
        markAttendance,
        reconcileStockCount,
        importParties,
        importOpeningStock,
        resetToDemoData,
        exportBackup,
        restoreBackup,
      }}
    >
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = () => {
  const context = useContext(ERPContext);
  if (!context) {
    throw new Error('useERP must be used within an ERPProvider');
  }
  return context;
};
