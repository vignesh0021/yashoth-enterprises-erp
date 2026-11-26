import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { useNavigate } from 'react-router-dom';
import { formatINR, formatWeight, roundTo2, roundTo3 } from '../../utils/calculations.ts';
import { calculateReconciledAccountBalance } from '../../../backend/business-rules/financeEngine.ts';
import { getLocalDateStr } from '../../utils/visualReportExporter.ts';
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Clock,
  Truck,
  PackageCheck,
  Scale,
  AlertTriangle,
  Wallet,
  Building2,
  Filter,
} from 'lucide-react';

type PendingStatusBadge = 'Pending' | 'In Transit' | 'Partially Received' | 'Received' | 'Disputed' | 'Overdue';

interface PendingMaterialRow {
  id: string;
  refNo: string;
  partyName: string;
  materialName: string;
  quantityKg: number;
  source: string;
  destination: string;
  pendingSince: string;
  status: PendingStatusBadge;
  employee: string;
  expectedDate: string;
  route: string;
  warehouseId?: string;
  materialId?: string;
}

const BADGE_CLASS: Record<PendingStatusBadge, string> = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-200',
  'In Transit': 'bg-sky-50 text-sky-800 border-sky-200',
  'Partially Received': 'bg-orange-50 text-orange-800 border-orange-200',
  Received: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Disputed: 'bg-rose-50 text-rose-800 border-rose-200',
  Overdue: 'bg-red-100 text-red-900 border-red-300',
};

export const PendingOperationsPanel: React.FC = () => {
  const {
    inventoryLots,
    stockMovements,
    purchases,
    sales,
    invoices,
    weighments,
    materialDispatches,
    godownTransfers,
    stockCounts,
    accounts,
    accountTransactions,
    materials,
    yards,
    parties,
  } = useERP();
  const navigate = useNavigate();
  const today = getLocalDateStr();

  // Filter states
  const [dateFilter, setDateFilter] = useState('');
  const [materialFilter, setMaterialFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');

  // All 14 Live Computed KPIs (Zero hardcoded values)
  const kpis = useMemo(() => {
    const totalAvailableStock = roundTo3(inventoryLots.filter((l) => !l.isExhausted).reduce((s, l) => s + l.remainingQuantity, 0));
    const totalPurchaseInward = roundTo3(
      stockMovements
        .filter((m) => m.movementType === 'PURCHASE_RECEIPT' || m.movementType === 'COLLECTION_RECEIPT')
        .reduce((s, m) => s + Math.abs(m.quantity), 0)
    );
    const totalSalesOutward = roundTo3(
      stockMovements
        .filter((m) => m.movementType === 'SALES_DISPATCH')
        .reduce((s, m) => s + Math.abs(m.quantity), 0)
    );
    const totalTransfers = godownTransfers.length;
    const pendingDispatch =
      sales.filter((s) => s.status === 'CONFIRMED' || s.status === 'DRAFT').length +
      materialDispatches.filter((d) => d.status === 'PENDING_DISPATCH').length;
    const inTransitMaterial = roundTo3(
      godownTransfers
        .filter((t) => t.status === 'IN_TRANSIT' || t.status === 'PARTIALLY_RECEIVED')
        .reduce((s, t) => s + Math.max(0, t.quantityDispatched - t.quantityReceived), 0) +
        materialDispatches
          .filter((d) => d.status === 'IN_TRANSIT')
          .reduce((s, d) => s + d.netWeight, 0)
    );
    const pendingReceiving = godownTransfers.filter(
      (t) => t.status === 'IN_TRANSIT' || t.status === 'PARTIALLY_RECEIVED'
    ).length;
    const unloadingPending = materialDispatches.filter((d) => d.unloadingStatus === 'PENDING' && d.status !== 'CANCELLED').length;
    const pendingWeighmentVerification = weighments.filter(
      (w) => w.verificationStatus === 'PENDING' || w.verificationStatus === 'FLAGGED'
    ).length;
    const pendingStockReconciliation =
      stockCounts.filter((c) => c.status === 'DRAFT').length +
      materialDispatches.filter((d) => Math.abs(d.weightDiscrepancy) > 0.001).length;
    const supplierOutstanding = roundTo2(
      purchases.filter((p) => p.status === 'POSTED').reduce((s, p) => s + (p.outstandingBalance || 0), 0)
    );
    const customerOutstanding = roundTo2(
      invoices.filter((i) => !i.isCancelled).reduce((s, i) => s + (i.outstandingBalance || 0), 0)
    );
    const cashBalance = roundTo2(
      accounts
        .filter((a) => a.accountType === 'CASH')
        .reduce((s, a) => s + calculateReconciledAccountBalance(a, accountTransactions), 0)
    );
    const bankBalance = roundTo2(
      accounts
        .filter((a) => a.accountType === 'BANK')
        .reduce((s, a) => s + calculateReconciledAccountBalance(a, accountTransactions), 0)
    );

    return {
      totalAvailableStock,
      totalPurchaseInward,
      totalSalesOutward,
      totalTransfers,
      pendingDispatch,
      inTransitMaterial,
      pendingReceiving,
      unloadingPending,
      pendingWeighmentVerification,
      pendingStockReconciliation,
      supplierOutstanding,
      customerOutstanding,
      cashBalance,
      bankBalance,
    };
  }, [
    inventoryLots,
    stockMovements,
    godownTransfers,
    sales,
    materialDispatches,
    weighments,
    stockCounts,
    purchases,
    invoices,
    accounts,
    accountTransactions,
  ]);

  const pendingRows = useMemo<PendingMaterialRow[]>(() => {
    const rows: PendingMaterialRow[] = [];
    const yardName = (id?: string) => yards.find((y) => y.id === id)?.name || 'Main Yard';
    const matName = (id?: string) => materials.find((m) => m.id === id)?.name || 'Scrap Material';
    const partyName = (id?: string) => parties.find((p) => p.id === id)?.legalName || '—';

    for (const d of materialDispatches) {
      const isOverdue = d.expectedCompletionDate && d.expectedCompletionDate < today && d.status !== 'DELIVERED';
      const status: PendingStatusBadge =
        d.status === 'DISPUTED'
          ? 'Disputed'
          : isOverdue
          ? 'Overdue'
          : d.status === 'DELIVERED'
          ? 'Received'
          : d.status === 'IN_TRANSIT'
          ? 'In Transit'
          : 'Pending';
      rows.push({
        id: d.id,
        refNo: d.dispatchNo,
        partyName: d.destinationName,
        materialName: matName(d.materialId),
        quantityKg: d.netWeight,
        source: yardName(d.sourceYardId),
        destination: d.destinationName,
        pendingSince: d.dispatchDateTime.slice(0, 10),
        status,
        employee: d.dispatchEmployee,
        expectedDate: d.expectedCompletionDate || d.dispatchDateTime.slice(0, 10),
        route: '/sales',
        warehouseId: d.sourceYardId,
        materialId: d.materialId,
      });
    }

    for (const t of godownTransfers) {
      if (t.status === 'CANCELLED') continue;
      const isOverdue = t.expectedDate && t.expectedDate < today && t.status !== 'RECEIVED';
      const status: PendingStatusBadge =
        t.status === 'DISPUTED'
          ? 'Disputed'
          : isOverdue
          ? 'Overdue'
          : t.status === 'PARTIALLY_RECEIVED'
          ? 'Partially Received'
          : t.status === 'RECEIVED'
          ? 'Received'
          : t.status === 'IN_TRANSIT'
          ? 'In Transit'
          : 'Pending';
      rows.push({
        id: t.id,
        refNo: t.transferNo,
        partyName: 'Internal Godown Transfer',
        materialName: matName(t.materialId),
        quantityKg: t.quantityDispatched,
        source: yardName(t.sourceYardId),
        destination: yardName(t.destinationYardId),
        pendingSince: t.transferDate,
        status,
        employee: t.dispatchEmployee,
        expectedDate: t.expectedDate || t.transferDate,
        route: '/inventory',
        warehouseId: t.sourceYardId,
        materialId: t.materialId,
      });
    }

    for (const p of purchases.filter((x) => x.status !== 'POSTED' && x.status !== 'CANCELLED')) {
      rows.push({
        id: p.id,
        refNo: p.purchaseNo,
        partyName: p.supplierName || partyName(p.supplierPartyId),
        materialName: matName(p.lines[0]?.materialId),
        quantityKg: roundTo3(p.lines.reduce((s, l) => s + l.payableWeight, 0)),
        source: p.supplierName || partyName(p.supplierPartyId),
        destination: yardName(p.yardId),
        pendingSince: p.transactionDate.slice(0, 10),
        status: 'Pending',
        employee: p.createdBy,
        expectedDate: p.transactionDate.slice(0, 10),
        route: '/purchases',
        warehouseId: p.yardId,
        materialId: p.lines[0]?.materialId,
      });
    }

    return rows.filter((r) => {
      if (dateFilter && r.pendingSince !== dateFilter) return false;
      if (materialFilter !== 'ALL' && r.materialId !== materialFilter) return false;
      if (warehouseFilter !== 'ALL' && r.warehouseId !== warehouseFilter) return false;
      if (employeeFilter && !r.employee.toLowerCase().includes(employeeFilter.toLowerCase())) return false;
      if (partyFilter && !r.partyName.toLowerCase().includes(partyFilter.toLowerCase())) return false;
      return true;
    });
  }, [materialDispatches, godownTransfers, purchases, yards, materials, parties, today, dateFilter, materialFilter, warehouseFilter, employeeFilter, partyFilter]);

  const kpiCards = [
    { label: 'Available Stock', value: formatWeight(kpis.totalAvailableStock), route: '/inventory', icon: Boxes, tone: 'text-emerald-700' },
    { label: 'Purchase Inward', value: formatWeight(kpis.totalPurchaseInward), route: '/purchases', icon: ArrowDownLeft, tone: 'text-blue-700' },
    { label: 'Sales Outward', value: formatWeight(kpis.totalSalesOutward), route: '/sales', icon: ArrowUpRight, tone: 'text-indigo-700' },
    { label: 'Total Transfers', value: String(kpis.totalTransfers), route: '/inventory', icon: ArrowLeftRight, tone: 'text-purple-700' },
    { label: 'Pending Dispatch', value: String(kpis.pendingDispatch), route: '/sales', icon: Clock, tone: 'text-amber-700' },
    { label: 'In-Transit Material', value: formatWeight(kpis.inTransitMaterial), route: '/inventory', icon: Truck, tone: 'text-sky-700' },
    { label: 'Pending Receiving', value: String(kpis.pendingReceiving), route: '/inventory', icon: PackageCheck, tone: 'text-orange-700' },
    { label: 'Unloading Pending', value: String(kpis.unloadingPending), route: '/sales', icon: Truck, tone: 'text-amber-700' },
    { label: 'Weighment Verify', value: String(kpis.pendingWeighmentVerification), route: '/weighment', icon: Scale, tone: 'text-rose-700' },
    { label: 'Stock Reconcile', value: String(kpis.pendingStockReconciliation), route: '/inventory', icon: AlertTriangle, tone: 'text-rose-700' },
    { label: 'Supplier Due', value: formatINR(kpis.supplierOutstanding), route: '/purchases', icon: Building2, tone: 'text-rose-700' },
    { label: 'Customer Due', value: formatINR(kpis.customerOutstanding), route: '/invoices', icon: Building2, tone: 'text-emerald-700' },
    { label: 'Cash Balance', value: formatINR(kpis.cashBalance), route: '/finance', icon: Wallet, tone: 'text-emerald-800' },
    { label: 'Bank Balance', value: formatINR(kpis.bankBalance), route: '/finance', icon: Wallet, tone: 'text-indigo-800' },
  ];

  return (
    <div className="space-y-4">
      {/* 14 Clickable Owner KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {kpiCards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => navigate(c.route)}
              className="text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-red-400 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-500 uppercase">
                <span className="truncate">{c.label}</span>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${c.tone}`} />
              </div>
              <p className={`text-xs sm:text-sm font-black font-mono mt-1 truncate ${c.tone}`}>{c.value}</p>
            </button>
          );
        })}
      </div>

      {/* Pending Material & Live Operations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Pending Material &amp; Live Operations ({pendingRows.length})
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 text-[11px]">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg bg-slate-50"
              aria-label="Filter by Date"
            />
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg bg-slate-50"
            >
              <option value="ALL">All Materials</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg bg-slate-50"
            >
              <option value="ALL">All Godowns</option>
              {yards.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Party / Supplier / Customer"
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg bg-slate-50"
            />
            <input
              type="text"
              placeholder="Employee"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg bg-slate-50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Ref #</th>
                <th className="py-2.5 px-3">Party</th>
                <th className="py-2.5 px-3">Material</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3">Source → Dest</th>
                <th className="py-2.5 px-3">Pending Since</th>
                <th className="py-2.5 px-3">Employee</th>
                <th className="py-2.5 px-3">Expected</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400 italic">
                    All material movements are reconciled — no pending items match current filters.
                  </td>
                </tr>
              ) : (
                pendingRows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(r.route)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{r.refNo}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{r.partyName}</td>
                    <td className="py-2.5 px-3 text-slate-700">{r.materialName}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{formatWeight(r.quantityKg)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{r.source} → {r.destination}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{r.pendingSince}</td>
                    <td className="py-2.5 px-3 text-slate-600">{r.employee}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{r.expectedDate}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${BADGE_CLASS[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
