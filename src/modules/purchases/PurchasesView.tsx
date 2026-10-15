import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { PurchaseHeader, PurchaseStatus, PurchaseSourceType } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { 
  formatINR, 
  formatWeight, 
  calcNetWeight, 
  calcPayableWeight, 
  calcMaterialAmount, 
  calcGstBreakdown, 
  roundTo2, 
  roundTo3 
} from '../../utils/calculations.ts';
import { 
  Plus, 
  CheckCircle, 
  ArrowRight, 
  Filter, 
  FileCheck, 
  Scale, 
  AlertCircle,
  Eye
} from 'lucide-react';

export const PurchasesView: React.FC = () => {
  const { 
    purchases, 
    parties, 
    materials, 
    yards, 
    createPurchase, 
    postPurchase, 
    currentUser 
  } = useERP();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseHeader | null>(null);

  // Form State for new purchase
  const [supplierId, setSupplierId] = useState(parties.find((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH')?.id || '');
  const [sourceType, setSourceType] = useState<PurchaseSourceType>('DIRECT_SUPPLIER');
  const [yardId, setYardId] = useState(yards[0]?.id || '');
  const [vehicleReg, setVehicleReg] = useState('TN 18 BY 0420');

  // Single line item entry state
  const [materialId, setMaterialId] = useState(materials[0]?.id || '');
  const [grossWeight, setGrossWeight] = useState<number>(10000);
  const [tareWeight, setTareWeight] = useState<number>(4000);
  const [deductions, setDeductions] = useState<number>(150);
  const [ratePerUnit, setRatePerUnit] = useState<number>(materials[0]?.defaultPurchaseRate || 28);

  const suppliers = parties.filter((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH');

  // Calculations for active form
  let netWeight = 0;
  let payableWeight = 0;
  let lineTaxable = 0;
  let gstBreakdown = { totalTax: 0, grandTotal: 0, roundOff: 0 };
  let errorMsg = '';

  try {
    netWeight = calcNetWeight(grossWeight, tareWeight);
    payableWeight = calcPayableWeight(grossWeight, tareWeight, deductions);
    lineTaxable = calcMaterialAmount(payableWeight, ratePerUnit);
    gstBreakdown = calcGstBreakdown(lineTaxable, 18, false);
  } catch (err: any) {
    errorMsg = err.message;
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (errorMsg) return;

    createPurchase({
      transactionDate: new Date().toISOString(),
      supplierPartyId: supplierId,
      sourceType,
      yardId,
      vehicleRegistration: vehicleReg,
      lines: [
        {
          id: 'pline-' + Math.random().toString(36).substring(2, 9),
          materialId,
          grossWeight,
          tareWeight,
          netWeight,
          deductions,
          payableWeight,
          ratePerUnit,
          gstRate: 18,
          taxableAmount: lineTaxable,
          gstAmount: gstBreakdown.totalTax,
          totalAmount: gstBreakdown.grandTotal,
        },
      ],
      subtotalAmount: lineTaxable,
      taxAmount: gstBreakdown.totalTax,
      otherCharges: 0,
      totalAmount: gstBreakdown.grandTotal,
      amountPaid: 0,
      outstandingBalance: gstBreakdown.grandTotal,
      status: 'APPROVED', // Default to approved so operator can directly post stock inward
      createdBy: currentUser.fullName,
    });

    setIsCreateModalOpen(false);
  };

  const filteredPurchases = purchases.filter((p) => {
    if (statusFilter === 'ALL') return true;
    return p.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Purchase & Scrap Intake</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage incoming scrap from suppliers, gate weighments, and post stock inward movements.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase Order</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        {['ALL', 'APPROVED', 'POSTED', 'SUBMITTED', 'DRAFT'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              statusFilter === tab
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Purchases List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Purchase No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4 text-right">Payable Weight</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    No purchase orders recorded yet. Click "+ New Purchase Order" to begin intake.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((pur) => {
                  const supplier = parties.find((p) => p.id === pur.supplierPartyId);
                  const totalPayableKg = pur.lines.reduce((s, l) => s + l.payableWeight, 0);

                  return (
                    <tr key={pur.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{pur.purchaseNo}</td>
                      <td className="py-3 px-4 text-slate-600">{pur.transactionDate.split('T')[0]}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{supplier?.legalName || 'Unknown'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {pur.sourceType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{pur.vehicleRegistration || '—'}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatWeight(totalPayableKg)}</td>
                      <td className="py-3 px-4 text-right font-bold text-red-600">{formatINR(pur.totalAmount)}</td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={pur.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {pur.status === 'APPROVED' && (
                            <button
                              onClick={() => postPurchase(pur.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-sm transition-all flex items-center gap-1"
                              title="Commit stock inward and generate inventory lots"
                            >
                              <FileCheck className="w-3 h-3" />
                              <span>Post Stock Inward</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedPurchase(pur)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Scrap Purchase Order"
        subtitle="Capture gate weighment, material grade, and calculate payable amounts."
        maxWidth="4xl"
      >
        <form onSubmit={handleCreate} className="space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Master Details Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
                required
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.legalName} ({s.partyCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Source Type</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
              >
                <option value="DIRECT_SUPPLIER">Direct Supplier Gate Entry</option>
                <option value="COLLECTION_PICKUP">Collection Pickup Job</option>
                <option value="GATE_PURCHASE">Spot Gate Purchase</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Destination Yard</label>
              <select
                value={yardId}
                onChange={(e) => setYardId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
              >
                {yards.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Vehicle Registration</label>
              <input
                type="text"
                value={vehicleReg}
                onChange={(e) => setVehicleReg(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 font-mono"
                placeholder="e.g. TN 18 BY 0420"
              />
            </div>
          </div>

          {/* Material & Weighment Line Item */}
          <div className="p-4 rounded-xl border border-slate-200 space-y-4">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Scale className="w-4 h-4 text-red-600" />
              <span>Weighment & Material Pricing</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-2">
                <label className="font-semibold text-slate-600 block mb-1">Material Scrap Type</label>
                <select
                  value={materialId}
                  onChange={(e) => {
                    const mId = e.target.value;
                    setMaterialId(mId);
                    const mat = materials.find((m) => m.id === mId);
                    if (mat) setRatePerUnit(mat.defaultPurchaseRate);
                  }}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Gross Wt (KG)</label>
                <input
                  type="number"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  min="0"
                  step="0.5"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Tare Wt (KG)</label>
                <input
                  type="number"
                  value={tareWeight}
                  onChange={(e) => setTareWeight(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  min="0"
                  step="0.5"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Deductions (KG)</label>
                <input
                  type="number"
                  value={deductions}
                  onChange={(e) => setDeductions(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  min="0"
                  step="0.5"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Rate (₹/KG)</label>
                <input
                  type="number"
                  value={ratePerUnit}
                  onChange={(e) => setRatePerUnit(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  min="0"
                  step="0.25"
                  required
                />
              </div>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-red-50/60 rounded-lg border border-red-100 text-[11px]">
              <div>
                <span className="text-slate-500 block">Calculated Net Wt</span>
                <span className="font-bold text-slate-800 text-xs">{formatWeight(netWeight)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Billable Payable Wt</span>
                <span className="font-bold text-red-700 text-xs">{formatWeight(payableWeight)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">GST (18%)</span>
                <span className="font-bold text-slate-800 text-xs">{formatINR(gstBreakdown.totalTax)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Payable Amount</span>
                <span className="font-black text-slate-900 text-sm">{formatINR(gstBreakdown.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!errorMsg}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-sm transition-all"
            >
              Save & Approve Purchase
            </button>
          </div>
        </form>
      </Modal>

      {/* View Details Modal */}
      {selectedPurchase && (
        <Modal
          isOpen={!!selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          title={`Purchase Order ${selectedPurchase.purchaseNo}`}
          subtitle={`Status: ${selectedPurchase.status}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg">
              <div>
                <span className="text-slate-500 block">Date</span>
                <span className="font-bold">{selectedPurchase.transactionDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Vehicle</span>
                <span className="font-mono font-bold">{selectedPurchase.vehicleRegistration || '—'}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2">Material</th>
                    <th className="p-2 text-right">Gross</th>
                    <th className="p-2 text-right">Tare</th>
                    <th className="p-2 text-right">Payable</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchase.lines.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="p-2 font-semibold">MS Boring Scrap</td>
                      <td className="p-2 text-right font-mono">{l.grossWeight} KG</td>
                      <td className="p-2 text-right font-mono">{l.tareWeight} KG</td>
                      <td className="p-2 text-right font-mono font-bold">{l.payableWeight} KG</td>
                      <td className="p-2 text-right font-mono">₹{l.ratePerUnit}</td>
                      <td className="p-2 text-right font-bold text-red-600">{formatINR(l.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedPurchase.status === 'APPROVED' && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    postPurchase(selectedPurchase.id);
                    setSelectedPurchase(null);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  Post Stock Inward Now
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
