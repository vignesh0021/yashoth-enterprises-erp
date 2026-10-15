import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR, formatWeight, roundTo2, roundTo3 } from '../../utils/calculations.ts';
import { 
  Boxes, 
  Layers, 
  History, 
  CheckSquare, 
  AlertTriangle, 
  Filter, 
  ArrowDownLeft, 
  ArrowUpRight 
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { 
    materials, 
    yards, 
    inventoryLots, 
    stockMovements, 
    reconcileStockCount, 
    currentUser 
  } = useERP();

  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'LOTS' | 'MOVEMENTS'>('SUMMARY');
  const [selectedYardId, setSelectedYardId] = useState<string>('ALL');
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);

  // Reconciliation form state
  const [reconcileYardId, setReconcileYardId] = useState(yards[0]?.id || '');
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [reconcileReasons, setReconcileReasons] = useState<Record<string, string>>({});

  const handleOpenReconcile = () => {
    const initialCounts: Record<string, number> = {};
    const initialReasons: Record<string, string> = {};
    materials.forEach((m) => {
      const current = roundTo3(
        stockMovements
          .filter((mov) => mov.materialId === m.id && mov.yardId === reconcileYardId)
          .reduce((sum, mov) => sum + mov.quantity, 0)
      );
      initialCounts[m.id] = current;
      initialReasons[m.id] = 'Monthly physical stock inspection';
    });
    setPhysicalCounts(initialCounts);
    setReconcileReasons(initialReasons);
    setIsReconcileModalOpen(true);
  };

  const handleReconcileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = materials.map((m) => ({
      materialId: m.id,
      physicalQuantity: physicalCounts[m.id] || 0,
      reason: reconcileReasons[m.id] || 'Physical stock audit',
    }));

    reconcileStockCount(reconcileYardId, lines, 'Periodic Yard Audit Reconciliation');
    setIsReconcileModalOpen(false);
  };

  const filteredLots = inventoryLots.filter((lot) => {
    if (selectedYardId !== 'ALL' && lot.yardId !== selectedYardId) return false;
    return true;
  });

  const filteredMovements = stockMovements.filter((mov) => {
    if (selectedYardId !== 'ALL' && mov.yardId !== selectedYardId) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Inventory & Immutable Stock Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Trace where every kilogram came from and where it went. FIFO lot tracking with non-negative constraints.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenReconcile}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>Physical Stock Count Audit</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Tabs & Yard Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('SUMMARY')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'SUMMARY'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Material Balances
          </button>
          <button
            onClick={() => setActiveTab('LOTS')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'LOTS'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Active FIFO Lots
          </button>
          <button
            onClick={() => setActiveTab('MOVEMENTS')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'MOVEMENTS'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Append-Only Movement Log
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Yard:</span>
          <select
            value={selectedYardId}
            onChange={(e) => setSelectedYardId(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none"
          >
            <option value="ALL">All Yards Combined</option>
            {yards.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'SUMMARY' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Total Inward</th>
                <th className="py-3 px-4 text-right">Total Outward</th>
                <th className="py-3 px-4 text-right">Current Balance</th>
                <th className="py-3 px-4 text-right">Avg Unit Cost</th>
                <th className="py-3 px-4 text-right">Stock Valuation</th>
                <th className="py-3 px-4 text-center">Alert Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materials.map((mat) => {
                const movs = stockMovements.filter(
                  (m) => m.materialId === mat.id && (selectedYardId === 'ALL' || m.yardId === selectedYardId)
                );
                const inward = roundTo3(movs.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0));
                const outward = roundTo3(Math.abs(movs.filter((m) => m.quantity < 0).reduce((s, m) => s + m.quantity, 0)));
                const balance = roundTo3(inward - outward);
                const valuation = roundTo2(balance * mat.defaultPurchaseRate);
                const isLow = balance <= mat.minStockAlert;

                return (
                  <tr key={mat.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{mat.name}</span>
                      <span className="font-mono text-[10px] text-slate-500">{mat.code} · HSN {mat.hsnCode}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {mat.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-medium">
                      +{formatWeight(inward)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 font-medium">
                      -{formatWeight(outward)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      {formatWeight(balance)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatINR(mat.defaultPurchaseRate)}/KG
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(valuation)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isLow ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'LOTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Lot Number</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4">Yard</th>
                <th className="py-3 px-4">Received Date</th>
                <th className="py-3 px-4 text-right">Initial Qty</th>
                <th className="py-3 px-4 text-right">Remaining Qty</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th className="py-3 px-4 text-right">Lot Value</th>
                <th className="py-3 px-4 text-center">FIFO Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLots.map((lot) => {
                const mat = materials.find((m) => m.id === lot.materialId);
                const yard = yards.find((y) => y.id === lot.yardId);
                const value = roundTo2(lot.remainingQuantity * lot.unitCost);

                return (
                  <tr key={lot.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{lot.lotNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{mat?.name}</td>
                    <td className="py-3 px-4 text-slate-600">{yard?.name}</td>
                    <td className="py-3 px-4 text-slate-500">{lot.receivedAt.split('T')[0]}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">{formatWeight(lot.initialQuantity)}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">{formatWeight(lot.remainingQuantity)}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">{formatINR(lot.unitCost)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatINR(value)}</td>
                    <td className="py-3 px-4 text-center">
                      {lot.isExhausted ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                          Exhausted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active FIFO
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'MOVEMENTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Movement ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Ref #</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredMovements.map((mov) => {
                const mat = materials.find((m) => m.id === mov.materialId);
                const isInward = mov.quantity > 0;

                return (
                  <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-500">{mov.id}</td>
                    <td className="py-3 px-4 text-slate-600 font-sans">{new Date(mov.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isInward ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {mov.movementType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{mov.transactionRef}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-800">{mat?.name}</td>
                    <td className={`py-3 px-4 text-right font-black ${isInward ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {isInward ? '+' : ''}{formatWeight(mov.quantity)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatINR(mov.unitCost)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">{formatINR(mov.totalCost)}</td>
                    <td className="py-3 px-4 font-sans text-slate-600">{mov.createdBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Count Audit & Reconciliation Modal */}
      <Modal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
        title="Physical Stock Count Audit & Reconciliation"
        subtitle="Compare ground physical stock vs system ledger. Variances create auditable adjustment movements."
        maxWidth="4xl"
      >
        <form onSubmit={handleReconcileSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Authoritative rule: Physical count differences will NOT overwrite history. Approved adjustment movements will be posted to the ledger.
            </span>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-100 font-bold border-b border-slate-200 text-[10px] uppercase">
                <tr>
                  <th className="p-2.5">Material</th>
                  <th className="p-2.5 text-right">System Qty</th>
                  <th className="p-2.5 text-right">Physical Count (KG)</th>
                  <th className="p-2.5 text-right">Variance (KG)</th>
                  <th className="p-2.5">Reason for Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materials.map((m) => {
                  const sysQty = roundTo3(
                    stockMovements
                      .filter((mov) => mov.materialId === m.id && mov.yardId === reconcileYardId)
                      .reduce((sum, mov) => sum + mov.quantity, 0)
                  );
                  const physQty = physicalCounts[m.id] ?? sysQty;
                  const variance = roundTo3(physQty - sysQty);

                  return (
                    <tr key={m.id}>
                      <td className="p-2.5 font-semibold text-slate-900">{m.name}</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">{formatWeight(sysQty)}</td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          value={physQty}
                          onChange={(e) =>
                            setPhysicalCounts((prev) => ({
                              ...prev,
                              [m.id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-28 p-1 border border-slate-300 rounded text-right font-mono"
                          step="0.5"
                          min="0"
                          required
                        />
                      </td>
                      <td className={`p-2.5 text-right font-mono font-bold ${
                        variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {variance > 0 ? '+' : ''}{formatWeight(variance)}
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={reconcileReasons[m.id] || ''}
                          onChange={(e) =>
                            setReconcileReasons((prev) => ({
                              ...prev,
                              [m.id]: e.target.value,
                            }))
                          }
                          className="w-full p-1 border border-slate-300 rounded"
                          placeholder="e.g. Weighbridge moisture drying loss"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsReconcileModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm"
            >
              Approve & Post Reconciliation Adjustments
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
