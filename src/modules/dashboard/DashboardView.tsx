import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR, formatWeight, roundTo2, roundTo3, kgToTon } from '../../utils/calculations.ts';
import { calculateReconciledAccountBalance } from '../../../backend/business-rules/financeEngine.ts';
import { evaluateFleetCompliance } from '../../../backend/business-rules/vehicleComplianceEngine.ts';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Boxes, 
  Wallet, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck,
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText,
  CheckSquare,
  StickyNote,
  Truck,
  ExternalLink,
  Mail,
  Plus,
  Trash2,
  Download,
  Upload,
  Printer,
  ArrowRight,
  Eye,
  RefreshCw,
  Send,
  Sparkles,
  Building2,
  CreditCard,
  Scale
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { 
    company, 
    purchases, 
    sales, 
    stockMovements, 
    inventoryLots, 
    materials, 
    accounts, 
    accountTransactions, 
    expenses, 
    parties, 
    vehicles,
    vehicleDocuments, 
    invoices,
    commercialDocuments,
    dailyTasks,
    createDailyTask,
    toggleDailyTask,
    deleteDailyTask,
    workNotes,
    createWorkNote,
    deleteWorkNote,
    uploadedDocuments,
    renewVehicleDocument,
    syncPushToCloud,
    syncPullFromCloud
  } = useERP();

  const navigate = useNavigate();
  const todayStr = new Date().toISOString().split('T')[0];
  const officialEmail = 'nandhakumar4290@gmail.com';
  const ewayBillPortalUrl = 'https://ewaybillgst.gov.in/Login.aspx';

  // Modal State for the 6 Portions
  const [activeDetailModal, setActiveDetailModal] = useState<
    'FINANCE' | 'TASKS' | 'VEHICLES' | 'DOCS' | 'EWAY' | 'STOCK' | null
  >(null);

  // New Daily Task Input State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL'>('HIGH');
  const [newTaskDueDate, setNewTaskDueDate] = useState(todayStr);

  // New Work Note Input State
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<'YARD' | 'CLIENT' | 'ACCOUNTS' | 'DISPATCH' | 'GENERAL'>('YARD');

  // Feedback Toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // 3-Member Multi-Device Cloud Sync Handlers
  const handleCloudPush = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await syncPushToCloud(officialEmail);
      if (res.success) {
        showToast('success', `☁️ Pushed to Cloud Hub (Rev ${res.revision}). All 3 devices now share this live data!`);
      } else {
        showToast('error', res.error || 'Cloud sync failed.');
      }
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleCloudPull = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await syncPullFromCloud();
      if (res.success) {
        showToast('success', `☁️ Pulled latest team data (Rev ${res.revision || 1}) updated by ${res.syncedBy || 'team member'}!`);
      } else {
        showToast('error', res.error || 'Failed to pull cloud update.');
      }
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // 1. Calculations: Financials & Cashflow
  const todayPurchases = purchases.filter((p) => p.status === 'POSTED' && p.transactionDate.startsWith(todayStr));
  const todayPurchaseVal = todayPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

  const todaySales = sales.filter((s) => s.status === 'DISPATCHED' && s.orderDate.startsWith(todayStr));
  const todaySalesVal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

  const todayExpensesList = expenses.filter((e) => e.expenseDate.startsWith(todayStr));
  const todayExpensesVal = todayExpensesList.reduce((sum, e) => sum + e.amount, 0);

  const totalReconciledFunds = accounts.reduce((sum, acc) => {
    return sum + calculateReconciledAccountBalance(acc, accountTransactions);
  }, 0);

  const customerReceivables = invoices
    .filter((i) => !i.isCancelled && i.outstandingBalance > 0)
    .reduce((sum, i) => sum + i.outstandingBalance, 0);

  const supplierPayables = purchases
    .filter((p) => p.status === 'POSTED' && p.outstandingBalance > 0)
    .reduce((sum, p) => sum + p.outstandingBalance, 0);

  // 2. Calculations: Stock & Movements
  const totalStockKg = stockMovements.reduce((sum, m) => sum + m.quantity, 0);
  const totalStockTons = kgToTon(totalStockKg);
  const stockValuation = inventoryLots
    .filter((l) => !l.isExhausted)
    .reduce((sum, l) => sum + l.remainingQuantity * l.unitCost, 0);

  const todayInwardKg = stockMovements
    .filter((m) => m.quantity > 0 && m.createdAt.startsWith(todayStr))
    .reduce((sum, m) => sum + m.quantity, 0);

  const todayDispatchedKg = Math.abs(
    stockMovements
      .filter((m) => m.movementType === 'SALES_DISPATCH' && m.createdAt.startsWith(todayStr))
      .reduce((sum, m) => sum + m.quantity, 0)
  );

  // 3. Calculations: Vehicles & Insurance Alerts
  const fleetCompliance = useMemo(
    () => evaluateFleetCompliance(vehicles, vehicleDocuments),
    [vehicles, vehicleDocuments]
  );
  const urgentVehicleAlerts = fleetCompliance.alerts.filter((a) => a.severity !== 'VALID');

  // 4. Calculations: Tasks & Notes
  const pendingTasks = dailyTasks.filter((t) => t.status !== 'DONE');
  const highPriorityPending = pendingTasks.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT');

  // 5. Calculations: Commercial Docs & Uploaded Files
  const quotationDocs = commercialDocuments.filter((d) => d.documentType === 'QUOTATION');
  const poDocs = commercialDocuments.filter((d) => d.documentType === 'PURCHASE_ORDER');
  const uploadedPoDocs = uploadedDocuments.filter((d) => d.category === 'PREVIOUS_PO');
  const uploadedInvoiceDocs = uploadedDocuments.filter((d) => d.category === 'PREVIOUS_INVOICE');
  const uploadedVehDocs = uploadedDocuments.filter((d) => d.category === 'VEHICLE_DOC');

  // 6. Calculations: Invoices & E-Way Bills
  const activeEwayInvoices = invoices.filter((i) => !i.isCancelled && (i.ewayBillNo || i.vehicleRegistration));

  // Handler: Add Daily Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    createDailyTask({
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      status: 'PENDING',
      dueDate: newTaskDueDate,
      notes: 'Operational yard task'
    });
    setNewTaskTitle('');
    showToast('success', 'Task added to daily operational schedule.');
  };

  // Handler: Add Work Note
  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    createWorkNote({
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      category: newNoteCategory,
      date: todayStr
    });
    setNewNoteTitle('');
    setNewNoteContent('');
    showToast('success', 'Note saved to yard operation log.');
  };

  // Handler: 1-Tap Email Daily Summary to nandhakumar4290@gmail.com
  const handleEmailDailySummary = () => {
    const subject = encodeURIComponent(
      `[YE ERP] Daily Executive Summary — ${new Date().toLocaleDateString('en-IN')}`
    );
    const body = encodeURIComponent(
      `YASHOTH ENTERPRISES — DAILY EXECUTIVE COCKPIT SUMMARY\n` +
      `Proprietor: Prop. P. NANDHA KUMAR\n` +
      `GSTIN: ${company.gstin}\n` +
      `Date: ${new Date().toLocaleString('en-IN')}\n\n` +
      `--- FINANCIAL OVERVIEW ---\n` +
      `• Today's Sales / Inflow: ${formatINR(todaySalesVal)}\n` +
      `• Today's Purchases / Outflow: ${formatINR(todayPurchaseVal)}\n` +
      `• Today's Yard Expenses: ${formatINR(todayExpensesVal)}\n` +
      `• Total Reconciled Funds: ${formatINR(totalReconciledFunds)}\n` +
      `• Customer Receivables Due: ${formatINR(customerReceivables)}\n` +
      `• Supplier Payables Due: ${formatINR(supplierPayables)}\n\n` +
      `--- SCRAP INVENTORY & DISPATCH ---\n` +
      `• Total Stock on Hand: ${totalStockTons.toFixed(3)} Tons (${formatWeight(totalStockKg)})\n` +
      `• Stock Valuation: ${formatINR(stockValuation)}\n` +
      `• Today's Inward: ${formatWeight(todayInwardKg)}\n` +
      `• Today's Dispatched: ${formatWeight(todayDispatchedKg)}\n\n` +
      `--- FLEET & COMPLIANCE ALERTS ---\n` +
      `• Active Fleet: ${vehicles.length} Vehicles\n` +
      `• Compliance Alerts: ${urgentVehicleAlerts.length} urgent\n` +
      urgentVehicleAlerts.map(a => `  - ${a.registrationNo}: ${a.documentType} ${a.statusLabel} (${a.expiryDate})`).join('\n') + `\n\n` +
      `--- E-WAY BILL & DISPATCH ---\n` +
      `• Portal: https://ewaybillgst.gov.in/Login.aspx\n` +
      `• Active Dispatches with e-Way Bills: ${activeEwayInvoices.length}\n\n` +
      `Generated automatically by Yashoth Enterprises ERP.`
    );

    const mailtoUrl = `mailto:${officialEmail}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
    showToast('success', `Daily report email prepared for ${officialEmail}!`);
  };

  return (
    <div className="h-full sm:h-[calc(100vh-80px)] flex flex-col justify-between overflow-y-auto sm:overflow-hidden gap-2.5 p-1 select-none">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 ${
          toastMsg.type === 'success' ? 'bg-emerald-800 text-white' : 'bg-rose-800 text-white'
        }`}>
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <AlertTriangle className="w-4 h-4 text-rose-300" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TOP EXECUTIVE COCKPIT BAR (Fitted, Clean, No Scroll) */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-slate-800 shadow-md shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-xl shadow-xs shrink-0 flex items-center justify-center">
            <img
              src="/yasoth-logo.png"
              alt="Yasoth Logo"
              className="h-8 sm:h-9 w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-black tracking-tight text-white">
                {company.companyName}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-600 text-white uppercase tracking-wider">
                Prop. P. NANDHA KUMAR
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
              <span>GSTIN: <strong className="font-mono text-red-300">{company.gstin}</strong></span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{officialEmail}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Top Bar Actions */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto flex-wrap">
          <button
            onClick={handleCloudPush}
            disabled={isSyncingCloud}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors min-h-[36px] cursor-pointer"
            title="Push data to shared Cloud Hub so all 3 members see identical data with zero lag"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-200 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>Sync Cloud (3 Members)</span>
          </button>

          <a
            href={ewayBillPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors min-h-[36px]"
            title="Open Official National E-Way Bill Portal"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
            <span>e-Way Bill Portal</span>
          </a>

          <button
            onClick={handleEmailDailySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors min-h-[36px] cursor-pointer"
            title={`Send Daily Executive Report to ${officialEmail}`}
          >
            <Mail className="w-3.5 h-3.5 text-indigo-200" />
            <span>Email Report</span>
          </button>
        </div>
      </div>

      {/* THE 6 TAPPABLE EXECUTIVE PORTIONS (Exact Viewport-Fit Front Display) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 flex-1 min-h-0">
        
        {/* PORTION 1: TODAY'S FINANCIAL FLOW & RECONCILED CASH */}
        <div
          onClick={() => setActiveDetailModal('FINANCE')}
          className="bg-white hover:bg-slate-50/80 active:bg-slate-100 p-3 sm:p-4 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 transition-all shadow-xs cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>1. Cashflow & Funds</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Live Reconciled
              </span>
            </div>

            <div className="mt-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Reconciled Bank & Cash</span>
              <p className="text-base sm:text-xl font-black text-slate-900 font-mono mt-0.5">
                {formatINR(totalReconciledFunds)}
              </p>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-medium">
              <div className="bg-emerald-50/60 p-1.5 rounded-lg border border-emerald-100">
                <span className="text-emerald-700 block font-semibold">Today Inflow</span>
                <span className="font-mono font-bold text-emerald-900">{formatINR(todaySalesVal)}</span>
              </div>
              <div className="bg-rose-50/60 p-1.5 rounded-lg border border-rose-100">
                <span className="text-rose-700 block font-semibold">Today Outflow</span>
                <span className="font-mono font-bold text-rose-900">{formatINR(todayPurchaseVal + todayExpensesVal)}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800">
            <span>Tap for full cashflow ledger</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        {/* PORTION 2: DAILY TASKS & YARD WORK NOTES */}
        <div
          onClick={() => setActiveDetailModal('TASKS')}
          className="bg-white hover:bg-slate-50/80 active:bg-slate-100 p-3 sm:p-4 rounded-2xl border-2 border-slate-200 hover:border-amber-400 transition-all shadow-xs cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-amber-600" />
                <span>2. Tasks & Notes</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                {pendingTasks.length} Pending
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {pendingTasks.slice(0, 2).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-[11px] truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    t.priority === 'HIGH' ? 'bg-red-500' : 'bg-amber-400'
                  }`}></span>
                  <span className="font-semibold text-slate-800 truncate">{t.title}</span>
                </div>
              ))}
              {pendingTasks.length === 0 && (
                <p className="text-[11px] text-slate-400 italic">No pending tasks today. All clear!</p>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 text-[10px]">
              <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-600">
                📝 {workNotes.length} Yard Notes
              </span>
              {highPriorityPending.length > 0 && (
                <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-bold">
                  {highPriorityPending.length} Urgent
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-amber-700 group-hover:text-amber-900">
            <span>Tap to check & add tasks</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        {/* PORTION 3: FLEET, INSURANCE & RTO COMPLIANCE */}
        <div
          onClick={() => setActiveDetailModal('VEHICLES')}
          className={`bg-white hover:bg-slate-50/80 active:bg-slate-100 p-3 sm:p-4 rounded-2xl border-2 transition-all shadow-xs cursor-pointer flex flex-col justify-between group ${
            urgentVehicleAlerts.length > 0 ? 'border-rose-300' : 'border-slate-200 hover:border-emerald-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-red-600" />
                <span>3. Fleet & Insurance</span>
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                urgentVehicleAlerts.length > 0 ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {urgentVehicleAlerts.length > 0 ? `${urgentVehicleAlerts.length} Alerts` : 'Compliant'}
              </span>
            </div>

            <div className="mt-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Fleet Size</span>
              <p className="text-base sm:text-xl font-black text-slate-900 mt-0.5">
                {vehicles.length} Vehicles <span className="text-xs font-normal text-slate-500">({fleetCompliance.fullyCompliantVehicles} OK)</span>
              </p>
            </div>

            <div className="mt-2 text-[10px] space-y-1">
              {urgentVehicleAlerts.slice(0, 1).map((a, i) => (
                <div key={i} className="bg-rose-50 p-1.5 rounded-lg border border-rose-200 text-rose-900 flex items-center justify-between">
                  <span className="font-mono font-bold truncate">{a.registrationNo}</span>
                  <span className="text-[9px] font-black uppercase">{a.statusLabel}</span>
                </div>
              ))}
              {urgentVehicleAlerts.length === 0 && (
                <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100 text-emerald-800 font-semibold">
                  ✓ Insurance & FC valid for all trucks
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-red-600 group-hover:text-red-800">
            <span>Tap for RTO alerts & papers</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        {/* PORTION 4: COMMERCIAL DOCS, QUOTATIONS & POS */}
        <div
          onClick={() => setActiveDetailModal('DOCS')}
          className="bg-white hover:bg-slate-50/80 active:bg-slate-100 p-3 sm:p-4 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 transition-all shadow-xs cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>4. Quotations & POs</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                A4 Printable
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 block uppercase font-bold text-[9px]">Quotations</span>
                <span className="text-base font-black text-slate-900 font-mono block mt-0.5">{quotationDocs.length}</span>
                <span className="text-[9px] text-amber-700 font-semibold">Instant Live</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 block uppercase font-bold text-[9px]">Purchase Orders</span>
                <span className="text-base font-black text-slate-900 font-mono block mt-0.5">{poDocs.length}</span>
                <span className="text-[9px] text-indigo-700 font-semibold">{uploadedPoDocs.length} Uploaded</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800">
            <span>Tap to view & preview POs</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        {/* PORTION 5: NATIONAL E-WAY BILL & DISPATCH HUB */}
        <div
          onClick={() => setActiveDetailModal('EWAY')}
          className="bg-white hover:bg-slate-50/80 active:bg-slate-100 p-3 sm:p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 transition-all shadow-xs cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-emerald-600" />
                <span>5. e-Way Bill Hub</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                NIC Portal
              </span>
            </div>

            <div className="mt-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Consignments</span>
              <p className="text-base sm:text-xl font-black text-slate-900 font-mono mt-0.5">
                {activeEwayInvoices.length} Dispatches <span className="text-xs font-normal text-slate-500">with e-Way</span>
              </p>
            </div>

            <div className="mt-2 bg-emerald-50/80 p-2 rounded-xl border border-emerald-100 text-[10px] text-emerald-900">
              <span className="font-bold block truncate">ewaybillgst.gov.in</span>
              <span className="text-[9px] text-emerald-700 block truncate">Linked: {officialEmail}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-emerald-700 group-hover:text-emerald-900">
            <span>Tap for portal login & JSON</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        {/* PORTION 6: SCRAP STOCK & YARD INVENTORY */}
        <div
          onClick={() => setActiveDetailModal('STOCK')}
          className="bg-white hover:bg-slate-50/80 active:bg-slate-100 p-3 sm:p-4 rounded-2xl border-2 border-slate-200 hover:border-amber-400 transition-all shadow-xs cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-amber-600" />
                <span>6. Stock & Yard</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                {materials.length} Materials
              </span>
            </div>

            <div className="mt-2.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Physical Stock</span>
              <p className="text-base sm:text-xl font-black text-slate-900 font-mono mt-0.5">
                {totalStockTons.toFixed(3)} <span className="text-xs font-bold text-slate-600">Tons</span>
              </p>
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px]">
              <span className="text-slate-500 font-semibold">Valuation:</span>
              <span className="font-mono font-black text-slate-900">{formatINR(stockValuation)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-amber-700 group-hover:text-amber-900">
            <span>Tap for material-wise stock</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* COMPLETE DETAIL DRILLDOWN MODALS (Opened instantly when tapping portions) */}
      {/* ========================================================================= */}

      {/* MODAL 1: COMPLETE FINANCIAL BREAKDOWN */}
      {activeDetailModal === 'FINANCE' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveDetailModal(null)}
          title="Daily Cashflow & Reconciled Funds Breakdown"
          subtitle="Detailed inward cash, bank balances, customer dues, supplier payables, and day's ledger."
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Reconciled Funds</span>
                <span className="text-base font-black text-emerald-600 font-mono">{formatINR(totalReconciledFunds)}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Customer Receivables</span>
                <span className="text-base font-black text-slate-900 font-mono">{formatINR(customerReceivables)}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Supplier Payables</span>
                <span className="text-base font-black text-rose-700 font-mono">{formatINR(supplierPayables)}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Today's Expenses</span>
                <span className="text-base font-black text-amber-700 font-mono">{formatINR(todayExpensesVal)}</span>
              </div>
            </div>

            {/* Account wise balance list */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                Reconciled Bank & Cash Accounts
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accounts.map((acc) => {
                  const bal = calculateReconciledAccountBalance(acc, accountTransactions);
                  return (
                    <div key={acc.id} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">{acc.accountName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{acc.accountType} · {acc.accountNumber || 'Primary'}</span>
                      </div>
                      <span className="font-mono font-black text-sm text-slate-900">{formatINR(bal)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                onClick={handleEmailDailySummary}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <Mail className="w-4 h-4 text-indigo-200" />
                <span>Email Summary to {officialEmail}</span>
              </button>

              <button
                onClick={() => {
                  setActiveDetailModal(null);
                  navigate('/accounts');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <span>Open Full Accounts View</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: COMPLETE DAILY TASKS & WORK NOTEPAD */}
      {activeDetailModal === 'TASKS' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveDetailModal(null)}
          title="Daily Operations, Task Checklist & Work Notes"
          subtitle="Manage active yard to-dos, priorities, dispatch checklists, and operational notes."
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Quick Add Task Form */}
            <form onSubmit={handleCreateTask} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                + Add Daily Task
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Task title (e.g. Verify lorry weighbridge slip)..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none"
                />
                <div className="flex gap-2">
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="flex-1 px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="URGENT">Urgent Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="NORMAL">Normal</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-xs min-h-[40px] cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </form>

            {/* Interactive Tasks Checklist */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2 flex items-center justify-between">
                <span>Active Task List ({dailyTasks.length})</span>
                <span className="text-slate-400 font-normal">Tap box to mark completed</span>
              </h4>
              <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                {dailyTasks.map((t) => (
                  <div key={t.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={t.status === 'DONE'}
                        onChange={() => toggleDailyTask(t.id)}
                        className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <div>
                        <span className={`font-semibold block ${
                          t.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}>
                          {t.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Due: {t.dueDate} · {t.priority} priority
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteDailyTask(t.id)}
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Yard Work Notepad Section */}
            <div className="pt-2 border-t border-slate-200">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                Yard Work Notepad & Logs ({workNotes.length})
              </h4>
              <form onSubmit={handleCreateNote} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <input
                  type="text"
                  required
                  placeholder="Note title / topic..."
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder="Details, measurements, party remarks..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs min-h-[40px] cursor-pointer"
                >
                  Save Yard Note
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {workNotes.map((n) => (
                  <div key={n.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{n.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">{n.category}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-1">{n.content}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200/60 text-[9px] text-slate-400">
                      <span>{n.date}</span>
                      <button onClick={() => deleteWorkNote(n.id)} className="text-rose-600 hover:underline cursor-pointer">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: FLEET COMPLIANCE, INSURANCE ALERTS & PAPERS */}
      {activeDetailModal === 'VEHICLES' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveDetailModal(null)}
          title="Vehicle Fleet & Live Insurance Compliance Alert Center"
          subtitle="Real-time insurance expiry alerts, Vahan RTO verification, and uploaded vehicle papers."
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Urgent Alerts Banner */}
            {urgentVehicleAlerts.length > 0 ? (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl space-y-2">
                <span className="font-bold text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Immediate Action Required: {urgentVehicleAlerts.length} Document Alerts</span>
                </span>
                <div className="divide-y divide-rose-100">
                  {urgentVehicleAlerts.map((a, i) => (
                    <div key={i} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-black text-slate-900">{a.registrationNo}</span>
                        <span className="ml-2 font-bold text-rose-800">{a.documentType} ({a.statusLabel})</span>
                        <p className="text-[10px] text-slate-500">Expires: {a.expiryDate} · Policy: {a.documentNumber || 'N/A'}</p>
                      </div>
                      <button
                        onClick={() => {
                          renewVehicleDocument(a.documentId);
                          showToast('success', `${a.documentType} for ${a.registrationNo} renewed!`);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>1-Tap Renew</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-900 font-semibold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>All fleet vehicles have active, fully verified Insurance, Fitness (FC) & PUCC certificates.</span>
              </div>
            )}

            {/* Vehicle List */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                Fleet Registry ({vehicles.length} Lorries)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vehicles.map((v) => (
                  <div key={v.id} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-sm text-slate-900 block">{v.registrationNo}</span>
                      <span className="text-[10px] text-slate-500">{v.vehicleType} · Tare: {formatWeight(v.tareWeight || 4100)}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {v.ownershipType}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Uploaded Vehicle Papers list */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                Uploaded Vehicle Papers & RC Copies ({uploadedVehDocs.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {uploadedVehDocs.map((doc) => (
                  <div key={doc.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 block">{doc.partyName}</span>
                      <span className="text-[10px] text-indigo-700 font-semibold">{doc.title}</span>
                    </div>
                    {doc.fileDataUrl && (
                      <a
                        href={doc.fileDataUrl}
                        download={doc.fileName}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  setActiveDetailModal(null);
                  navigate('/vehicles');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <span>Manage Fleet & Upload Papers</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: COMMERCIAL DOCUMENTS, QUOTATIONS & POS */}
      {activeDetailModal === 'DOCS' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveDetailModal(null)}
          title="Quotations & Purchase Orders Hub"
          subtitle="Generate instant quotations, purchase orders, convert to tax invoice, and manage uploaded historical POs."
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Quotations</span>
                <span className="text-base font-black text-amber-700 font-mono">{quotationDocs.length}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Purchase Orders</span>
                <span className="text-base font-black text-indigo-700 font-mono">{poDocs.length}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Uploaded Historical POs</span>
                <span className="text-base font-black text-purple-700 font-mono">{uploadedPoDocs.length}</span>
              </div>
            </div>

            {/* Recent Documents Table */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                Recent Commercial Documents
              </h4>
              <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden">
                {commercialDocuments.slice(0, 5).map((doc) => (
                  <div key={doc.id} className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{doc.documentNo}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          doc.documentType === 'QUOTATION' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {doc.documentType}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{doc.partyName} · {doc.documentDate}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{formatINR(doc.grandTotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Uploaded Historical Purchase Orders */}
            {uploadedPoDocs.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                  Uploaded Historical Purchase Orders
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {uploadedPoDocs.map((doc) => (
                    <div key={doc.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-slate-900 block">{doc.referenceNo}</span>
                        <span className="text-[10px] text-slate-500">{doc.partyName} · {formatINR(doc.amount || 0)}</span>
                      </div>
                      {doc.fileDataUrl && (
                        <a
                          href={doc.fileDataUrl}
                          download={doc.fileName}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  setActiveDetailModal(null);
                  navigate('/documents');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <span>Open Quotation & PO Builder</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 5: NATIONAL E-WAY BILL PORTAL & DISPATCH HUB */}
      {activeDetailModal === 'EWAY' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveDetailModal(null)}
          title="National e-Way Bill Portal & Dispatch Hub"
          subtitle="Generate Form GST EWB-01, export NIC JSON (v1.03), and connect with official GST portal."
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Direct Portal Banner */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wide">
                    National E-Way Bill System (GST NIC Portal)
                  </h4>
                  <p className="text-[11px] text-emerald-200">
                    Official URL: <span className="underline font-mono">https://ewaybillgst.gov.in/Login.aspx</span>
                  </p>
                </div>
                <a
                  href={ewayBillPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white text-emerald-900 rounded-xl font-black text-xs shadow-md flex items-center gap-1.5 hover:bg-emerald-50 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Launch Portal</span>
                </a>
              </div>
              <div className="pt-2 border-t border-emerald-700/60 flex items-center justify-between text-[10px] text-emerald-100 flex-wrap gap-2">
                <span>Business GSTIN: <strong>{company.gstin}</strong></span>
                <span>Connected Official Email: <strong>{officialEmail}</strong></span>
                <span>Default Transport Truck: <strong>TN 05 Y 1936</strong></span>
              </div>
            </div>

            {/* Active Dispatches Table */}
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                Invoices with E-Way Bill Tracking ({activeEwayInvoices.length})
              </h4>
              <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden">
                {activeEwayInvoices.map((inv) => (
                  <div key={inv.id} className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">Inv #{inv.invoiceNo}</span>
                        <span className="font-mono font-bold text-emerald-700">{inv.ewayBillNo || 'Pending Generation'}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Buyer: {inv.customerName} · Truck: {inv.vehicleRegistration || 'TN 05 Y 1936'} · {formatINR(inv.grandTotal)}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {inv.paymentStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                onClick={handleEmailDailySummary}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>Email Consignment Summary to {officialEmail}</span>
              </button>

              <button
                onClick={() => {
                  setActiveDetailModal(null);
                  navigate('/invoices');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <span>Open Tax Invoices & EWB-01 View</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 6: SCRAP STOCK & MATERIAL-WISE VALUATION */}
      {activeDetailModal === 'STOCK' && (
        <Modal
          isOpen={true}
          onClose={() => setActiveDetailModal(null)}
          title="Material-Wise Scrap Inventory & Yard Valuation"
          subtitle="Real-time physical stock in Tons & KGs, weighted average purchase cost, and yard asset valuation."
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Weight</span>
                <span className="text-base font-black text-slate-900 font-mono">{totalStockTons.toFixed(3)} Tons</span>
                <span className="text-[10px] text-slate-500 font-mono">({formatWeight(totalStockKg)})</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Valuation</span>
                <span className="text-base font-black text-emerald-600 font-mono">{formatINR(stockValuation)}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Today Inward / Outward</span>
                <span className="text-[11px] font-bold text-slate-800 block mt-1">
                  In: {formatWeight(todayInwardKg)} · Out: {formatWeight(todayDispatchedKg)}
                </span>
              </div>
            </div>

            {/* Material breakdown table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Material</th>
                    <th className="p-2.5 text-right">Current Stock</th>
                    <th className="p-2.5 text-right">Avg Rate</th>
                    <th className="p-2.5 text-right">Total Valuation</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {materials.map((mat) => {
                    const stockQty = roundTo3(
                      stockMovements
                        .filter((m) => m.materialId === mat.id)
                        .reduce((sum, m) => sum + m.quantity, 0)
                    );
                    const isLow = stockQty <= mat.minStockAlert;
                    const matLots = inventoryLots.filter((l) => l.materialId === mat.id && !l.isExhausted);
                    const val = roundTo2(matLots.reduce((s, l) => s + l.remainingQuantity * l.unitCost, 0));
                    const avgCost = stockQty > 0 ? roundTo2(val / stockQty) : mat.defaultPurchaseRate;

                    return (
                      <tr key={mat.id} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-mono font-bold text-slate-800">{mat.code}</td>
                        <td className="p-2.5 font-bold text-slate-900">{mat.name}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatWeight(stockQty)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">{formatINR(avgCost)}/KG</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatINR(val)}</td>
                        <td className="p-2.5 text-center">
                          {isLow ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">Low Stock</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">Optimal</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  setActiveDetailModal(null);
                  navigate('/inventory');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <span>Open Full Inventory Ledger</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
