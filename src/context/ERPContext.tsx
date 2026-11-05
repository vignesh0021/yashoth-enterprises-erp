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
  INITIAL_ACCOUNT_TRANSACTIONS,
  INITIAL_INVOICES,
  INITIAL_ATTENDANCE 
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

  // Core Business Actions & CRUD
  addParty: (partyData: Omit<Party, 'id'>) => Party;
  updateParty: (id: string, updates: Partial<Party>) => void;
  deleteParty: (id: string) => { success: boolean; message?: string };
  addMaterial: (matData: Omit<Material, 'id'>) => Material;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => { success: boolean; message?: string };
  addVehicle: (vehData: Omit<Vehicle, 'id'>) => Vehicle;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => { success: boolean; message?: string };
  addEmployee: (empData: Omit<Employee, 'id'>) => Employee;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => { success: boolean; message?: string };
  updatePurchase: (id: string, updates: Partial<PurchaseHeader>) => void;
  deletePurchase: (id: string) => { success: boolean; message?: string };
  recordWeighment: (data: Omit<Weighment, 'id' | 'weighmentNo' | 'netWeight' | 'payableWeight' | 'createdAt'>) => Weighment;
  createPurchase: (purchaseData: Omit<PurchaseHeader, 'id' | 'purchaseNo' | 'createdAt'>) => PurchaseHeader;
  postPurchase: (purchaseId: string) => void;
  createCollectionJob: (jobData: Omit<CollectionJob, 'id' | 'jobNo' | 'createdAt'>) => CollectionJob;
  updateCollectionStatus: (jobId: string, status: CollectionStatus, actualWeight?: number, transportExpenses?: number) => void;
  createSalesOrder: (salesData: Omit<SalesHeader, 'id' | 'salesNo' | 'createdAt'>) => SalesHeader;
  dispatchSalesOrder: (salesId: string) => Invoice;
  createTaxInvoice: (invoiceData: Omit<Invoice, 'id' | 'createdAt'>) => Invoice;
  recordPayment: (paymentParams: Parameters<typeof postPaymentVoucher>[0]) => Payment;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  deletePayment: (id: string) => { success: boolean; message?: string };
  recordContraTransfer: (sourceAccountId: string, destAccountId: string, amount: number, referenceNo: string) => void;
  recordExpense: (expenseData: Omit<Expense, 'id' | 'voucherNo' | 'createdAt'>) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => { success: boolean; message?: string };
  addAccount: (accData: Omit<CashBankAccount, 'id'>) => CashBankAccount;
  updateAccount: (id: string, updates: Partial<CashBankAccount>) => void;
  deleteAccount: (id: string) => { success: boolean; message?: string };
  updateAccountTransaction: (id: string, updates: Partial<AccountTransaction>) => void;
  deleteAccountTransaction: (id: string) => { success: boolean; message?: string };
  updateWeighment: (id: string, updates: Partial<Weighment>) => void;
  deleteWeighment: (id: string) => { success: boolean; message?: string };
  updateCollectionJob: (id: string, updates: Partial<CollectionJob>) => void;
  deleteCollectionJob: (id: string) => { success: boolean; message?: string };
  updateSalesOrder: (id: string, updates: Partial<SalesHeader>) => void;
  deleteSalesOrder: (id: string) => { success: boolean; message?: string };
  updateTaxInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteTaxInvoice: (id: string) => { success: boolean; message?: string };
  markAttendance: (employeeId: string, date: string, status: AttendanceStatus, overtimeHours?: number, remarks?: string) => void;
  updateAttendanceEntry: (id: string, updates: Partial<AttendanceEntry>) => void;
  deleteAttendanceEntry: (id: string) => { success: boolean; message?: string };
  addAttendanceRecord: (entryData: Omit<AttendanceEntry, 'id'>) => AttendanceEntry;
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
  const [attendance, setAttendance] = useState<AttendanceEntry[]>(() => load('attendance', INITIAL_ATTENDANCE));
  const [accounts, setAccounts] = useState<CashBankAccount[]>(() => load('accounts', INITIAL_ACCOUNTS));
  const [accountTransactions, setAccountTransactions] = useState<AccountTransaction[]>(() => load('accountTransactions', INITIAL_ACCOUNT_TRANSACTIONS));
  const [expenses, setExpenses] = useState<Expense[]>(() => load('expenses', []));
  const [weighments, setWeighments] = useState<Weighment[]>(() => load('weighments', []));
  const [collectionJobs, setCollectionJobs] = useState<CollectionJob[]>(() => load('collectionJobs', []));
  const [purchases, setPurchases] = useState<PurchaseHeader[]>(() => load('purchases', []));
  const [inventoryLots, setInventoryLots] = useState<InventoryLot[]>(() => load('inventoryLots', INITIAL_LOTS));
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => load('stockMovements', INITIAL_STOCK_MOVEMENTS));
  const [sales, setSales] = useState<SalesHeader[]>(() => load('sales', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const loaded = load<Invoice[]>('invoices', []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_INVOICES;
  });
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

  const updateParty = (id: string, updates: Partial<Party>) => {
    const existing = parties.find((p) => p.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setParties((prev) => prev.map((p) => (p.id === id ? updated : p)));
    logAudit('UPDATE_PARTY', 'PARTY', id, existing, updated);
  };

  const deleteParty = (id: string): { success: boolean; message?: string } => {
    const existing = parties.find((p) => p.id === id);
    if (!existing) return { success: false, message: 'Party not found.' };

    const hasPurchases = purchases.some((p) => p.supplierPartyId === id);
    const hasSales = sales.some((s) => s.customerPartyId === id);
    const hasInvoices = invoices.some((i) => i.customerPartyId === id);
    const hasPayments = payments.some((p) => p.partyId === id);

    if (hasPurchases || hasSales || hasInvoices || hasPayments) {
      setParties((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: false } : p)));
      logAudit('DEACTIVATE_PARTY', 'PARTY', id, existing, { isActive: false });
      return {
        success: true,
        message: `Party "${existing.legalName}" has transaction history so it has been marked Inactive to preserve audit trails.`,
      };
    }

    setParties((prev) => prev.filter((p) => p.id !== id));
    logAudit('DELETE_PARTY', 'PARTY', id, existing, null);
    return { success: true, message: `Party "${existing.legalName}" deleted successfully.` };
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

  const updateMaterial = (id: string, updates: Partial<Material>) => {
    const existing = materials.find((m) => m.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setMaterials((prev) => prev.map((m) => (m.id === id ? updated : m)));
    logAudit('UPDATE_MATERIAL', 'MATERIAL', id, existing, updated);
  };

  const deleteMaterial = (id: string): { success: boolean; message?: string } => {
    const existing = materials.find((m) => m.id === id);
    if (!existing) return { success: false, message: 'Material not found.' };

    const hasLots = inventoryLots.some((l) => l.materialId === id && l.remainingQuantity > 0);
    const hasMovements = stockMovements.some((m) => m.materialId === id);
    const hasPurchases = purchases.some((p) => p.lines.some((l) => l.materialId === id));
    const hasSales = sales.some((s) => s.lines.some((l) => l.materialId === id));

    if (hasLots || hasMovements || hasPurchases || hasSales) {
      setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, isActive: false } : m)));
      logAudit('DEACTIVATE_MATERIAL', 'MATERIAL', id, existing, { isActive: false });
      return {
        success: true,
        message: `Material "${existing.name}" is linked to existing stock or transactions. It has been deactivated instead of permanently deleted.`,
      };
    }

    setMaterials((prev) => prev.filter((m) => m.id !== id));
    logAudit('DELETE_MATERIAL', 'MATERIAL', id, existing, null);
    return { success: true, message: `Material "${existing.name}" deleted successfully.` };
  };

  const addVehicle = (vehData: Omit<Vehicle, 'id'>) => {
    const newVeh: Vehicle = {
      ...vehData,
      id: 'veh-' + Math.random().toString(36).substring(2, 11),
    };
    setVehicles((prev) => [newVeh, ...prev]);
    logAudit('CREATE_VEHICLE', 'VEHICLE', newVeh.id, null, newVeh);
    return newVeh;
  };

  const updateVehicle = (id: string, updates: Partial<Vehicle>) => {
    const existing = vehicles.find((v) => v.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setVehicles((prev) => prev.map((v) => (v.id === id ? updated : v)));
    logAudit('UPDATE_VEHICLE', 'VEHICLE', id, existing, updated);
  };

  const deleteVehicle = (id: string): { success: boolean; message?: string } => {
    const existing = vehicles.find((v) => v.id === id);
    if (!existing) return { success: false, message: 'Vehicle not found.' };
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    setVehicleDocuments((prev) => prev.filter((d) => d.vehicleId !== id));
    logAudit('DELETE_VEHICLE', 'VEHICLE', id, existing, null);
    return { success: true, message: `Vehicle "${existing.registrationNo}" deleted successfully.` };
  };

  const addEmployee = (empData: Omit<Employee, 'id'>) => {
    const newEmp: Employee = {
      ...empData,
      id: 'emp-' + Math.random().toString(36).substring(2, 11),
    };
    setEmployees((prev) => [newEmp, ...prev]);
    logAudit('CREATE_EMPLOYEE', 'EMPLOYEE', newEmp.id, null, newEmp);
    return newEmp;
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    const existing = employees.find((e) => e.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setEmployees((prev) => prev.map((e) => (e.id === id ? updated : e)));
    logAudit('UPDATE_EMPLOYEE', 'EMPLOYEE', id, existing, updated);
  };

  const deleteEmployee = (id: string): { success: boolean; message?: string } => {
    const existing = employees.find((e) => e.id === id);
    if (!existing) return { success: false, message: 'Employee not found.' };
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    logAudit('DELETE_EMPLOYEE', 'EMPLOYEE', id, existing, null);
    return { success: true, message: `Employee "${existing.fullName}" deleted successfully.` };
  };

  const updatePurchase = (id: string, updates: Partial<PurchaseHeader>) => {
    const existing = purchases.find((p) => p.id === id);
    if (!existing) return;
    if (existing.status === 'POSTED') {
      throw new Error('Posted purchases cannot be modified as stock has already moved into inventory.');
    }
    const updated = { ...existing, ...updates };
    setPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
    logAudit('UPDATE_PURCHASE', 'PURCHASE', id, existing, updated);
  };

  const deletePurchase = (id: string): { success: boolean; message?: string } => {
    const existing = purchases.find((p) => p.id === id);
    if (!existing) return { success: false, message: 'Purchase not found.' };
    if (existing.status === 'POSTED') {
      return { success: false, message: 'Posted purchases have affected stock ledgers and cannot be deleted.' };
    }
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    logAudit('DELETE_PURCHASE', 'PURCHASE', id, existing, null);
    return { success: true, message: `Purchase "${existing.purchaseNo}" deleted.` };
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

  const createTaxInvoice = (invoiceData: Omit<Invoice, 'id' | 'createdAt'>): Invoice => {
    const now = new Date().toISOString();
    const newInvoice: Invoice = {
      ...invoiceData,
      id: 'inv-' + Math.random().toString(36).substring(2, 11),
      createdAt: now,
      immutableSnapshotJson: '',
    };
    newInvoice.immutableSnapshotJson = JSON.stringify(newInvoice);

    setInvoices((prev) => [newInvoice, ...prev]);
    logAudit('CREATE_TAX_INVOICE', 'INVOICE', newInvoice.id, null, newInvoice);
    return newInvoice;
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

  const updateAttendanceEntry = (id: string, updates: Partial<AttendanceEntry>) => {
    const existing = attendance.find((a) => a.id === id);
    if (!existing) return;
    const updated = {
      ...existing,
      ...updates,
      isCorrected: true,
      correctionReason: updates.correctionReason || 'Amended by Supervisor',
    };
    setAttendance((prev) => prev.map((a) => (a.id === id ? updated : a)));
    logAudit('UPDATE_ATTENDANCE', 'ATTENDANCE', id, existing, updated);
  };

  const deleteAttendanceEntry = (id: string): { success: boolean; message?: string } => {
    const existing = attendance.find((a) => a.id === id);
    if (!existing) return { success: false, message: 'Attendance record not found.' };
    setAttendance((prev) => prev.filter((a) => a.id !== id));
    logAudit('DELETE_ATTENDANCE', 'ATTENDANCE', id, existing, null);
    return { success: true, message: 'Attendance record deleted successfully.' };
  };

  const addAttendanceRecord = (entryData: Omit<AttendanceEntry, 'id'>): AttendanceEntry => {
    const newEntry: AttendanceEntry = {
      ...entryData,
      id: 'att-' + Math.random().toString(36).substring(2, 9),
      markedBy: currentUser.fullName,
      isCorrected: false,
    };
    setAttendance((prev) => [newEntry, ...prev]);
    logAudit('CREATE_ATTENDANCE', 'ATTENDANCE', newEntry.id, null, newEntry);
    return newEntry;
  };

  const addAccount = (accData: Omit<CashBankAccount, 'id'>): CashBankAccount => {
    const newAcc: CashBankAccount = {
      ...accData,
      id: 'acc-' + Math.random().toString(36).substring(2, 9),
    };
    setAccounts((prev) => [...prev, newAcc]);
    logAudit('CREATE_ACCOUNT', 'ACCOUNT', newAcc.id, null, newAcc);
    return newAcc;
  };

  const updateAccount = (id: string, updates: Partial<CashBankAccount>) => {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    logAudit('UPDATE_ACCOUNT', 'ACCOUNT', id, existing, updated);
  };

  const deleteAccount = (id: string): { success: boolean; message?: string } => {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) return { success: false, message: 'Account not found.' };
    const hasTx = accountTransactions.some((tx) => tx.accountId === id);
    if (hasTx) {
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: false } : a)));
      return { success: true, message: `Account "${existing.accountName}" has financial history and was deactivated instead of permanently deleted.` };
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    logAudit('DELETE_ACCOUNT', 'ACCOUNT', id, existing, null);
    return { success: true, message: `Account "${existing.accountName}" deleted.` };
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    const existing = expenses.find((e) => e.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    setAccountTransactions((prev) =>
      prev.map((tx) => {
        if (tx.referenceNo === existing.voucherNo) {
          return {
            ...tx,
            amount: updates.amount !== undefined ? updates.amount : tx.amount,
            accountId: updates.accountId !== undefined ? updates.accountId : tx.accountId,
            transactionDate: updates.expenseDate !== undefined ? updates.expenseDate : tx.transactionDate,
            description: `Expense: ${updates.category || existing.category} - ${updates.paidTo || existing.paidTo}`,
          };
        }
        return tx;
      })
    );
    logAudit('UPDATE_EXPENSE', 'EXPENSE', id, existing, updated);
  };

  const deleteExpense = (id: string): { success: boolean; message?: string } => {
    const existing = expenses.find((e) => e.id === id);
    if (!existing) return { success: false, message: 'Expense voucher not found.' };
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setAccountTransactions((prev) => prev.filter((tx) => tx.referenceNo !== existing.voucherNo));
    logAudit('DELETE_EXPENSE', 'EXPENSE', id, existing, null);
    return { success: true, message: `Expense voucher "${existing.voucherNo}" deleted and ledger reversed.` };
  };

  const updateAccountTransaction = (id: string, updates: Partial<AccountTransaction>) => {
    const existing = accountTransactions.find((tx) => tx.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setAccountTransactions((prev) => prev.map((tx) => (tx.id === id ? updated : tx)));
    logAudit('UPDATE_ACCOUNT_TX', 'ACCOUNT_TRANSACTION', id, existing, updated);
  };

  const deleteAccountTransaction = (id: string): { success: boolean; message?: string } => {
    const existing = accountTransactions.find((tx) => tx.id === id);
    if (!existing) return { success: false, message: 'Transaction not found.' };
    setAccountTransactions((prev) => prev.filter((tx) => tx.id !== id));
    logAudit('DELETE_ACCOUNT_TX', 'ACCOUNT_TRANSACTION', id, existing, null);
    return { success: true, message: 'Transaction record deleted.' };
  };

  const updateWeighment = (id: string, updates: Partial<Weighment>) => {
    const existing = weighments.find((w) => w.id === id);
    if (!existing) return;
    const gross = updates.grossWeight !== undefined ? updates.grossWeight : existing.grossWeight;
    const tare = updates.tareWeight !== undefined ? updates.tareWeight : existing.tareWeight;
    const ded = updates.approvedDeductions !== undefined ? updates.approvedDeductions : existing.approvedDeductions;
    const netWeight = calcNetWeight(gross, tare);
    const payableWeight = calcPayableWeight(gross, tare, ded);
    const updated: Weighment = {
      ...existing,
      ...updates,
      grossWeight: gross,
      tareWeight: tare,
      approvedDeductions: ded,
      netWeight,
      payableWeight,
    };
    setWeighments((prev) => prev.map((w) => (w.id === id ? updated : w)));
    logAudit('UPDATE_WEIGHMENT', 'WEIGHMENT', id, existing, updated);
  };

  const deleteWeighment = (id: string): { success: boolean; message?: string } => {
    const existing = weighments.find((w) => w.id === id);
    if (!existing) return { success: false, message: 'Weighment slip not found.' };
    setWeighments((prev) => prev.filter((w) => w.id !== id));
    logAudit('DELETE_WEIGHMENT', 'WEIGHMENT', id, existing, null);
    return { success: true, message: `Weighment slip "${existing.weighmentNo}" deleted.` };
  };

  const updateCollectionJob = (id: string, updates: Partial<CollectionJob>) => {
    const existing = collectionJobs.find((j) => j.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setCollectionJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
    logAudit('UPDATE_COLLECTION_JOB', 'COLLECTION_JOB', id, existing, updated);
  };

  const deleteCollectionJob = (id: string): { success: boolean; message?: string } => {
    const existing = collectionJobs.find((j) => j.id === id);
    if (!existing) return { success: false, message: 'Collection request not found.' };
    setCollectionJobs((prev) => prev.filter((j) => j.id !== id));
    logAudit('DELETE_COLLECTION_JOB', 'COLLECTION_JOB', id, existing, null);
    return { success: true, message: `Collection request "${existing.jobNo}" deleted.` };
  };

  const updateSalesOrder = (id: string, updates: Partial<SalesHeader>) => {
    const existing = sales.find((s) => s.id === id);
    if (!existing) return;
    if (existing.status === 'DISPATCHED' || existing.status === 'INVOICED') {
      throw new Error('Dispatched sales orders cannot be edited.');
    }
    const updated = { ...existing, ...updates };
    setSales((prev) => prev.map((s) => (s.id === id ? updated : s)));
    logAudit('UPDATE_SALES_ORDER', 'SALES_HEADER', id, existing, updated);
  };

  const deleteSalesOrder = (id: string): { success: boolean; message?: string } => {
    const existing = sales.find((s) => s.id === id);
    if (!existing) return { success: false, message: 'Sales order not found.' };
    if (existing.status === 'DISPATCHED' || existing.status === 'INVOICED') {
      return { success: false, message: 'Dispatched sales orders cannot be deleted as inventory lots have been consumed.' };
    }
    setSales((prev) => prev.filter((s) => s.id !== id));
    logAudit('DELETE_SALES_ORDER', 'SALES_HEADER', id, existing, null);
    return { success: true, message: `Sales order "${existing.salesNo}" deleted.` };
  };

  const updateTaxInvoice = (id: string, updates: Partial<Invoice>) => {
    const existing = invoices.find((inv) => inv.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    updated.immutableSnapshotJson = JSON.stringify(updated);
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
    logAudit('UPDATE_TAX_INVOICE', 'INVOICE', id, existing, updated);
  };

  const deleteTaxInvoice = (id: string): { success: boolean; message?: string } => {
    const existing = invoices.find((inv) => inv.id === id);
    if (!existing) return { success: false, message: 'Invoice not found.' };
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    logAudit('DELETE_TAX_INVOICE', 'INVOICE', id, existing, null);
    return { success: true, message: `Invoice "${existing.invoiceNo}" deleted.` };
  };

  const updatePayment = (id: string, updates: Partial<Payment>) => {
    const existing = payments.find((p) => p.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
    logAudit('UPDATE_PAYMENT', 'PAYMENT', id, existing, updated);
  };

  const deletePayment = (id: string): { success: boolean; message?: string } => {
    const existing = payments.find((p) => p.id === id);
    if (!existing) return { success: false, message: 'Payment voucher not found.' };
    setPayments((prev) => prev.filter((p) => p.id !== id));
    setAccountTransactions((prev) => prev.filter((tx) => tx.referenceNo !== existing.paymentNo));
    logAudit('DELETE_PAYMENT', 'PAYMENT', id, existing, null);
    return { success: true, message: `Payment voucher "${existing.paymentNo}" deleted.` };
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
    setAttendance(INITIAL_ATTENDANCE);
    setAccounts(INITIAL_ACCOUNTS);
    setAccountTransactions(INITIAL_ACCOUNT_TRANSACTIONS);
    setExpenses([]);
    setWeighments([]);
    setCollectionJobs([]);
    setPurchases([]);
    setInventoryLots(INITIAL_LOTS);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setSales([]);
    setInvoices(INITIAL_INVOICES);
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
        updateParty,
        deleteParty,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        updatePurchase,
        deletePurchase,
        recordWeighment,
        createPurchase,
        postPurchase,
        createCollectionJob,
        updateCollectionStatus,
        createSalesOrder,
        dispatchSalesOrder,
        createTaxInvoice,
        recordPayment,
        updatePayment,
        deletePayment,
        recordContraTransfer,
        recordExpense,
        updateExpense,
        deleteExpense,
        addAccount,
        updateAccount,
        deleteAccount,
        updateAccountTransaction,
        deleteAccountTransaction,
        updateWeighment,
        deleteWeighment,
        updateCollectionJob,
        deleteCollectionJob,
        updateSalesOrder,
        deleteSalesOrder,
        updateTaxInvoice,
        deleteTaxInvoice,
        markAttendance,
        updateAttendanceEntry,
        deleteAttendanceEntry,
        addAttendanceRecord,
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
