import React from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { StatCard } from '../../components/common/StatCard.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { formatINR, formatWeight, roundTo2, roundTo3 } from '../../utils/calculations.ts';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Boxes, 
  Wallet, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculateReconciledAccountBalance } from '../../../backend/business-rules/financeEngine.ts';

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
    vehicleDocuments, 
    invoices 
  } = useERP();

  const navigate = useNavigate();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Today's Inward (Purchases + Collections)
  const todayPurchases = purchases.filter((p) => p.status === 'POSTED' && p.transactionDate.startsWith(todayStr));
  const todayInwardKg = stockMovements
    .filter((m) => m.quantity > 0 && m.createdAt.startsWith(todayStr))
    .reduce((sum, m) => sum + m.quantity, 0);
  const todayPurchaseVal = todayPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

  // 2. Today's Outward (Sales Dispatches)
  const todayDispatchedKg = Math.abs(
    stockMovements
      .filter((m) => m.movementType === 'SALES_DISPATCH' && m.createdAt.startsWith(todayStr))
      .reduce((sum, m) => sum + m.quantity, 0)
  );
  const todaySalesVal = sales
    .filter((s) => s.status === 'DISPATCHED' && s.orderDate.startsWith(todayStr))
    .reduce((sum, s) => sum + s.totalAmount, 0);

  // 3. Stock on Hand & Valuation
  const totalStockKg = stockMovements.reduce((sum, m) => sum + m.quantity, 0);
  const stockValuation = inventoryLots
    .filter((l) => !l.isExhausted)
    .reduce((sum, l) => sum + l.remainingQuantity * l.unitCost, 0);

  // 4. Cash + Bank Reconciled Balances
  const totalReconciledFunds = accounts.reduce((sum, acc) => {
    return sum + calculateReconciledAccountBalance(acc, accountTransactions);
  }, 0);

  // 5. Customer Receivables & Supplier Payables
  const customerReceivables = invoices
    .filter((i) => !i.isCancelled && i.outstandingBalance > 0)
    .reduce((sum, i) => sum + i.outstandingBalance, 0);

  const supplierPayables = purchases
    .filter((p) => p.status === 'POSTED' && p.outstandingBalance > 0)
    .reduce((sum, p) => sum + p.outstandingBalance, 0);

  // 6. Today's Expenses
  const todayExpenses = expenses
    .filter((e) => e.expenseDate.startsWith(todayStr))
    .reduce((sum, e) => sum + e.amount, 0);

  // 7. Estimated Gross Margin (Dispatched Sales Revenue - COGS)
  const totalDispatchedSales = sales
    .filter((s) => s.status === 'DISPATCHED')
    .reduce((sum, s) => sum + s.subtotalAmount, 0);
  const totalAllocatedCogs = sales
    .filter((s) => s.status === 'DISPATCHED')
    .reduce((sum, s) => sum + s.allocatedCogs, 0);
  const estimatedGrossMargin = totalDispatchedSales - totalAllocatedCogs;

  // 8. Operational Alerts (include expiring soon AND expired documents)
  const expiringDocs = vehicleDocuments.filter((d) => {
    const diffDays = Math.ceil((new Date(d.expiryDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
    return diffDays <= d.reminderDaysBefore;
  });

  const pendingApprovals = purchases.filter((p) => p.status === 'SUBMITTED' || p.status === 'VERIFIED');

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome with Company Logo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl shadow-md shrink-0 flex items-center justify-center">
            <img
              src="/yasoth-logo.png"
              alt="Yasoth Logo"
              className="h-12 w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white uppercase tracking-wider">
                Authoritative Yard Operations
              </span>
              <span className="text-xs text-slate-400">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">{company.companyName}</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              GSTIN: <span className="font-mono text-red-300 font-semibold">{company.gstin}</span> · {company.city}, Tamil Nadu · Real-time Scrap Ledger & Dispatch ERP
            </p>
          </div>
        </div>

        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <div className="bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Reconciled Funds</span>
            <span className="text-lg font-bold text-emerald-400">{formatINR(totalReconciledFunds)}</span>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (Answers the 5 core owner questions) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Inward"
          value={formatWeight(todayInwardKg)}
          subtext={`Purchases: ${formatINR(todayPurchaseVal)}`}
          icon={ArrowDownLeft}
          trend={{ label: 'Active intake', positive: true }}
        />
        <StatCard
          title="Today's Outward"
          value={formatWeight(todayDispatchedKg)}
          subtext={`Dispatched: ${formatINR(todaySalesVal)}`}
          icon={ArrowUpRight}
          trend={{ label: 'On schedule', positive: true }}
        />
        <StatCard
          title="Stock On Hand"
          value={formatWeight(totalStockKg)}
          subtext={`Valuation: ${formatINR(stockValuation)}`}
          icon={Boxes}
          highlight={true}
        />
        <StatCard
          title="Gross Margin"
          value={formatINR(estimatedGrossMargin)}
          subtext={`COGS: ${formatINR(totalAllocatedCogs)}`}
          icon={TrendingUp}
        />
      </div>

      {/* Operational Alerts Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Document Expiry Alerts */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Document Expiry Alerts</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {expiringDocs.length} Urgent
            </span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {expiringDocs.length === 0 ? (
              <p className="text-slate-500 italic py-2">All vehicle insurance and fitness records up to date.</p>
            ) : (
              expiringDocs.map((doc) => {
                const diffDays = Math.ceil((new Date(doc.expiryDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
                const isExpired = diffDays < 0;
                return (
                  <div key={doc.id} className={`flex items-center justify-between p-2 rounded-lg border ${
                    isExpired ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-100'
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold block ${isExpired ? 'text-rose-900' : 'text-amber-900'}`}>
                          {doc.documentType} Renewal
                        </span>
                        {isExpired && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-600 text-white">
                            EXPIRED
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] ${isExpired ? 'text-rose-700 font-semibold' : 'text-amber-700'}`}>
                        {isExpired ? `Expired ${Math.abs(diffDays)}d ago (${doc.expiryDate})` : `Due: ${doc.expiryDate} (${diffDays}d left)`}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate('/vehicles')}
                      className={`text-[10px] font-bold underline ${isExpired ? 'text-rose-800 hover:text-rose-900' : 'text-amber-800 hover:text-amber-900'}`}
                    >
                      View
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Pending Approvals</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              {pendingApprovals.length} Awaiting
            </span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {pendingApprovals.length === 0 ? (
              <p className="text-slate-500 italic py-2">No purchases waiting for manager approval.</p>
            ) : (
              pendingApprovals.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-100">
                  <div>
                    <span className="font-semibold text-blue-900 block">{p.purchaseNo}</span>
                    <span className="text-[10px] text-blue-700">{formatINR(p.totalAmount)}</span>
                  </div>
                  <button
                    onClick={() => navigate('/purchases')}
                    className="text-[10px] font-bold text-blue-800 underline hover:text-blue-900"
                  >
                    Review
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Receivables & Payables Snapshot */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span>Outstanding Balances</span>
            </div>
            <button
              onClick={() => navigate('/payments')}
              className="text-[10px] font-bold text-red-600 hover:underline"
            >
              Ledgers →
            </button>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-100">
              <span className="text-emerald-900 font-medium">Customer Receivables</span>
              <span className="font-bold text-emerald-800">{formatINR(customerReceivables)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50 border border-rose-100">
              <span className="text-rose-900 font-medium">Supplier Payables</span>
              <span className="font-bold text-rose-800">{formatINR(supplierPayables)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Materials Stock Breakdown */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Material Stock Balances & Valuations</h3>
            <p className="text-xs text-slate-500 mt-0.5">Authoritative stock derived from immutable movement ledger</p>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            Full Stock Ledger →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                <th className="py-2.5 px-3">Material Code</th>
                <th className="py-2.5 px-3">Material Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Current Stock</th>
                <th className="py-2.5 px-3 text-right">Avg Unit Cost</th>
                <th className="py-2.5 px-3 text-right">Total Valuation</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materials.map((mat) => {
                const stockQty = roundTo3(
                  stockMovements
                    .filter((m) => m.materialId === mat.id)
                    .reduce((sum, m) => sum + m.quantity, 0)
                );
                const isLow = stockQty <= mat.minStockAlert;
                const matLots = inventoryLots.filter(
                  (l) => l.materialId === mat.id && !l.isExhausted
                );
                const valuation = roundTo2(
                  matLots.reduce((sum, l) => sum + l.remainingQuantity * l.unitCost, 0)
                );
                const avgUnitCost = stockQty > 0 ? roundTo2(valuation / stockQty) : mat.defaultPurchaseRate;

                return (
                  <tr key={mat.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">{mat.code}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{mat.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                        {mat.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                      {formatWeight(stockQty)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                      {formatINR(avgUnitCost)}/KG
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                      {formatINR(valuation)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Low Stock Alert
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Optimal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
