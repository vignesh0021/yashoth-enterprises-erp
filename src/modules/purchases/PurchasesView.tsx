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
  Eye,
  Trash2,
  Edit3
} from 'lucide-react';
import { ScrapCategory } from '../../types/index.ts';

export const PurchasesView: React.FC = () => {
  const { 
    purchases, 
    parties, 
    materials, 
    yards, 
    createPurchase, 
    updatePurchase,
    postPurchase,
    deletePurchase,
    addMaterial,
    currentUser 
  } = useERP();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseHeader | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseHeader | null>(null);

  // Quick Add Material sub-modal state
  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false);
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState<ScrapCategory>('Steel');
  const [newMatHsn, setNewMatHsn] = useState('7204');
  const [newMatBuyRate, setNewMatBuyRate] = useState<number>(28);
  const [newMatSellRate, setNewMatSellRate] = useState<number>(31.5);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

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

  const handleOpenCreatePurchase = () => {
    setEditingPurchase(null);
    setSupplierId(parties.find((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH')?.id || '');
    setSourceType('DIRECT_SUPPLIER');
    setYardId(yards[0]?.id || '');
    setVehicleReg('TN 18 BY 0420');
    setMaterialId(materials[0]?.id || '');
    setGrossWeight(10000);
    setTareWeight(4000);
    setDeductions(150);
    setRatePerUnit(materials[0]?.defaultPurchaseRate || 28);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditPurchase = (pur: PurchaseHeader) => {
    setEditingPurchase(pur);
    setSupplierId(pur.supplierPartyId);
    setSourceType(pur.sourceType);
    setYardId(pur.yardId);
    setVehicleReg(pur.vehicleRegistration || '');
    if (pur.lines && pur.lines[0]) {
      const line = pur.lines[0];
      setMaterialId(line.materialId);
      setGrossWeight(line.grossWeight);
      setTareWeight(line.tareWeight);
      setDeductions(line.deductions);
      setRatePerUnit(line.ratePerUnit);
    }
    setIsCreateModalOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (errorMsg) return;

    if (editingPurchase) {
      updatePurchase(editingPurchase.id, {
        supplierPartyId: supplierId,
        sourceType,
        yardId,
        vehicleRegistration: vehicleReg,
        lines: [
          {
            id: editingPurchase.lines?.[0]?.id || ('pline-' + Math.random().toString(36).substring(2, 9)),
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
        totalAmount: gstBreakdown.grandTotal,
        outstandingBalance: gstBreakdown.grandTotal,
      });
      setFeedbackMsg(`Purchase order "${editingPurchase.purchaseNo}" updated successfully.`);
    } else {
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
        status: 'APPROVED',
        createdBy: currentUser.fullName,
      });
      setFeedbackMsg('New purchase order created successfully.');
    }

    setIsCreateModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleQuickAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim()) return;
    const nextSeq = materials.length + 1;
    const created = addMaterial({
      code: `MAT-SCRAP-${String(nextSeq).padStart(3, '0')}`,
      name: newMatName.trim(),
      category: newMatCategory,
      baseUnit: 'KG',
      hsnCode: newMatHsn.trim() || '7204',
      defaultPurchaseRate: Number(newMatBuyRate),
      defaultSalesRate: Number(newMatSellRate),
      defaultGstRate: 18,
      minStockAlert: 500,
      isActive: true,
    });
    setMaterialId(created.id);
    setRatePerUnit(created.defaultPurchaseRate);
    setIsAddMaterialModalOpen(false);
    setNewMatName('');
    setFeedbackMsg(`Scrap material "${created.name}" added and selected.`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleDeletePurchase = (pur: PurchaseHeader) => {
    if (confirm(`Are you sure you want to delete purchase order "${pur.purchaseNo}"?`)) {
      const res = deletePurchase(pur.id);
      if (res.success) {
        setFeedbackMsg(res.message || 'Purchase order deleted.');
      } else {
        alert(res.message);
      }
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
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
          onClick={handleOpenCreatePurchase}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all self-start sm:self-auto cursor-pointer"
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
                          {pur.status !== 'POSTED' && (
                            <>
                              <button
                                onClick={() => handleOpenEditPurchase(pur)}
                                className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Edit Purchase Order"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePurchase(pur)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Purchase Order"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-600">Material Scrap Type *</label>
                  <button
                    type="button"
                    onClick={() => setIsAddMaterialModalOpen(true)}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-0.5 hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ New Material</span>
                  </button>
                </div>
                <select
                  value={materialId}
                  onChange={(e) => {
                    const mId = e.target.value;
                    setMaterialId(mId);
                    const mat = materials.find((m) => m.id === mId);
                    if (mat) setRatePerUnit(mat.defaultPurchaseRate);
                  }}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 font-medium"
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
                  {selectedPurchase.lines.map((l, i) => {
                    const lineMat = materials.find((m) => m.id === l.materialId);
                    return (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="p-2 font-semibold">{lineMat?.name || 'Scrap Material'}</td>
                        <td className="p-2 text-right font-mono">{l.grossWeight} KG</td>
                        <td className="p-2 text-right font-mono">{l.tareWeight} KG</td>
                        <td className="p-2 text-right font-mono font-bold">{l.payableWeight} KG</td>
                        <td className="p-2 text-right font-mono">₹{l.ratePerUnit}</td>
                        <td className="p-2 text-right font-bold text-red-600">{formatINR(l.totalAmount)}</td>
                      </tr>
                    );
                  })}
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

      {/* Quick Add Material Sub-Modal */}
      <Modal
        isOpen={isAddMaterialModalOpen}
        onClose={() => setIsAddMaterialModalOpen(false)}
        title="Quick Add Scrap Material"
        subtitle="Define new scrap grade commodity so you can immediately select it for this purchase."
        maxWidth="lg"
      >
        <form onSubmit={handleQuickAddMaterial} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Scrap Material Name *</label>
            <input
              type="text"
              value={newMatName}
              onChange={(e) => setNewMatName(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              placeholder="e.g. Copper Wire Armature Scrap"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Category *</label>
              <select
                value={newMatCategory}
                onChange={(e) => setNewMatCategory(e.target.value as ScrapCategory)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                {['Steel', 'Iron', 'Aluminium', 'Copper', 'Brass', 'Plastic', 'Other'].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">HSN Code *</label>
              <input
                type="text"
                value={newMatHsn}
                onChange={(e) => setNewMatHsn(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                placeholder="7204"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Buy Rate (₹/KG) *</label>
              <input
                type="number"
                value={newMatBuyRate}
                onChange={(e) => setNewMatBuyRate(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                step="0.25"
                min="0"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Sell Rate (₹/KG) *</label>
              <input
                type="number"
                value={newMatSellRate}
                onChange={(e) => setNewMatSellRate(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                step="0.25"
                min="0"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddMaterialModalOpen(false)}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm"
            >
              Save & Select Material
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
