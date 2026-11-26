import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR, formatWeight, roundTo3 } from '../../utils/calculations.ts';
import { getLocalDateStr } from '../../utils/visualReportExporter.ts';
import {
  Truck,
  Plus,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Scale,
  PackageCheck,
} from 'lucide-react';

export const MultiSourceDispatchTab: React.FC = () => {
  const {
    materialDispatches,
    inventoryLots,
    materials,
    yards,
    parties,
    weighments,
    createAndPostDispatch,
    updateDispatchStatus,
    currentUser,
  } = useERP();

  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [destinationName, setDestinationName] = useState('');
  const [customerPartyId, setCustomerPartyId] = useState('');
  const [sourceYardId, setSourceYardId] = useState(yards[0]?.id || '');
  const [materialId, setMaterialId] = useState(materials[0]?.id || '');
  const [vehicleReg, setVehicleReg] = useState('TN18BY0420');
  const [driverName, setDriverName] = useState('');
  const [weighmentId, setWeighmentId] = useState('');
  const [weighbridgeBillNo, setWeighbridgeBillNo] = useState('');
  const [weighbridgeName, setWeighbridgeName] = useState('');
  const [weighbridgeCharge, setWeighbridgeCharge] = useState<number>(100);
  const [grossWeight, setGrossWeight] = useState<number>(0);
  const [tareWeight, setTareWeight] = useState<number>(0);
  const [lotInputs, setLotInputs] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  const eligibleLots = useMemo(
    () =>
      inventoryLots.filter(
        (l) => !l.isExhausted && l.remainingQuantity > 0 && (!sourceYardId || l.yardId === sourceYardId)
      ),
    [inventoryLots, sourceYardId]
  );

  const netWeight = Math.max(0, roundTo3(grossWeight - tareWeight));
  const totalAllocated = roundTo3(
    Object.values(lotInputs).reduce((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0)
  );
  const discrepancy = roundTo3(totalAllocated - netWeight);

  const handleSelectWeighment = (wId: string) => {
    setWeighmentId(wId);
    const w = weighments.find((x) => x.id === wId);
    if (w) {
      setGrossWeight(w.grossWeight);
      setTareWeight(w.tareWeight);
      setVehicleReg(w.vehicleRegistration || vehicleReg);
      setWeighbridgeBillNo(w.billNumber || w.slipReference || '');
      setWeighbridgeName(w.weighbridgeName || '');
      if (w.weighbridgeCharge !== undefined) setWeighbridgeCharge(w.weighbridgeCharge);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lotRequests = Object.entries(lotInputs)
      .filter(([, q]) => Number(q) > 0)
      .map(([lotId, quantity]) => ({ lotId, quantity: Number(quantity) }));

    if (lotRequests.length === 0) {
      setFeedback({ type: 'error', text: 'Allocate quantity from at least one verified stock lot.' });
      return;
    }

    try {
      const linkedWeighment = weighments.find((w) => w.id === weighmentId);
      const res = createAndPostDispatch({
        destinationName: destinationName.trim() || parties.find((p) => p.id === customerPartyId)?.legalName || 'Destination Godown',
        customerPartyId: customerPartyId || undefined,
        materialId,
        vehicleRegistration: vehicleReg,
        driverName: driverName.trim() || undefined,
        dispatchDateTime: `${getLocalDateStr()}T${new Date().toTimeString().slice(0, 8)}`,
        sourceYardId,
        grossWeight: Number(grossWeight),
        tareWeight: Number(tareWeight),
        lotRequests,
        weighment: linkedWeighment,
        weighbridgeBillNo: weighbridgeBillNo.trim() || undefined,
        weighbridgeName: weighbridgeName.trim() || undefined,
        weighbridgeCharge: Number(weighbridgeCharge) || 0,
        dispatchEmployee: currentUser.fullName,
        idempotencyKey: `dsp-${vehicleReg}-${weighbridgeBillNo || Date.now()}`,
        allowDiscrepancy: Math.abs(discrepancy) > 0.001,
        notes: notes.trim() || undefined,
      });
      setIsOpen(false);
      setLotInputs({});
      setDestinationName('');
      setNotes('');
      setFeedback({
        type: 'success',
        text: `Dispatch ${res.dispatch.dispatchNo} posted across ${res.dispatch.allocations.length} source lot(s). Net: ${formatWeight(res.dispatch.netWeight)}, Discrepancy: ${formatWeight(res.discrepancy)}.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Multi-source dispatch failed.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-red-600" />
            <span>Multi-Source Truck Dispatch &amp; Weighbridge Reconciliation</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Combine multiple verified stock lots (e.g. IMOP + IMH + Godown Stock) in one truck dispatch while preserving individual purchase traceability.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Multi-Source Dispatch</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <th className="py-3 px-4">Dispatch #</th>
                <th className="py-3 px-4">Destination</th>
                <th className="py-3 px-4">Vehicle &amp; WB Bill</th>
                <th className="py-3 px-4">Source Lots Allocated</th>
                <th className="py-3 px-4 text-right">Net Weight</th>
                <th className="py-3 px-4 text-right">Allocated</th>
                <th className="py-3 px-4 text-right">Diff</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materialDispatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 italic">
                    No multi-source dispatches recorded yet.
                  </td>
                </tr>
              ) : (
                materialDispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {d.dispatchNo}
                      <span className="block text-[10px] text-slate-400 font-normal">{d.dispatchDateTime.slice(0, 16).replace('T', ' ')}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{d.destinationName}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      <span className="flex items-center gap-1 font-bold"><Truck className="w-3 h-3 text-slate-400" /> {d.vehicleRegistration}</span>
                      {d.weighbridgeBillNo && (
                        <span className="text-[10px] text-slate-500">WB Bill #{d.weighbridgeBillNo} {d.weighbridgeCharge ? `(${formatINR(d.weighbridgeCharge)})` : ''}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {d.allocations.map((a) => (
                          <div key={a.id} className="text-[10px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex justify-between gap-2">
                            <span className="font-semibold text-slate-700 truncate">{a.supplierName || a.lotNumber}</span>
                            <span className="font-mono font-bold text-slate-900 shrink-0">{formatWeight(a.allocatedQuantity)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatWeight(d.netWeight)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">{formatWeight(d.totalAllocatedWeight)}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${Math.abs(d.weightDiscrepancy) < 0.001 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatWeight(d.weightDiscrepancy)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        d.status === 'DELIVERED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : d.status === 'DISPUTED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {d.status !== 'DELIVERED' && (
                        <button
                          type="button"
                          onClick={() => updateDispatchStatus(d.id, { status: 'DELIVERED', approvalStatus: 'DELIVERED', unloadingStatus: 'COMPLETED' })}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <PackageCheck className="w-3 h-3" /> Delivered
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Multi-Source Dispatch Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Multi-Source Truck Dispatch"
        subtitle="Allocate exact quantities across multiple verified stock lots and reconcile with weighbridge net weight."
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Destination / Godown Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Vinoth Godown"
                value={destinationName}
                onChange={(e) => setDestinationName(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Source Godown / Yard</label>
              <select
                value={sourceYardId}
                onChange={(e) => setSourceYardId(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
              >
                {yards.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Link Weighbridge Slip</label>
              <select
                value={weighmentId}
                onChange={(e) => handleSelectWeighment(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
              >
                <option value="">— Manual Entry —</option>
                {weighments.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.weighmentNo} ({w.billNumber || w.slipReference || 'No Bill'} · {w.netWeight} KG)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Vehicle Reg #</label>
              <input
                type="text"
                required
                value={vehicleReg}
                onChange={(e) => setVehicleReg(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Weighbridge Bill #</label>
              <input
                type="text"
                placeholder="e.g. 59"
                value={weighbridgeBillNo}
                onChange={(e) => setWeighbridgeBillNo(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block font-bold text-slate-700 mb-1">First / Gross Weight (KG)</label>
              <input
                type="number"
                step="0.001"
                required
                value={grossWeight || ''}
                onChange={(e) => setGrossWeight(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Second / Tare Weight (KG)</label>
              <input
                type="number"
                step="0.001"
                required
                value={tareWeight || ''}
                onChange={(e) => setTareWeight(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono font-bold"
              />
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-bold"><Scale className="w-4 h-4 text-emerald-400" /> Net Weight</span>
              <span className="font-mono text-sm font-black">{formatWeight(netWeight)}</span>
            </div>
          </div>

          {/* Multi-Lot Source Allocation Grid */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800">Select Quantities from Verified Source Stock Lots</span>
              <span className={`font-mono font-bold text-[11px] ${Math.abs(discrepancy) < 0.001 && netWeight > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                Allocated: {formatWeight(totalAllocated)} / {formatWeight(netWeight)} (Diff: {formatWeight(discrepancy)})
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {eligibleLots.length === 0 ? (
                <p className="p-4 text-center text-slate-400 italic">No available stock lots in selected yard.</p>
              ) : (
                eligibleLots.map((lot) => {
                  const mat = materials.find((m) => m.id === lot.materialId);
                  return (
                    <div key={lot.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{lot.lotNumber}</span>
                        <span className="ml-2 text-slate-700 font-semibold">{lot.supplierName || lot.sourceType || 'Yard Stock'}</span>
                        <span className="block text-[10px] text-slate-500">
                          {mat?.name || lot.materialId} {lot.originalInvoiceNo ? `· Inv ${lot.originalInvoiceNo}` : ''} · Available: <strong className="font-mono text-emerald-700">{formatWeight(lot.remainingQuantity)}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={lot.remainingQuantity}
                          placeholder="0 KG"
                          value={lotInputs[lot.id] || ''}
                          onChange={(e) =>
                            setLotInputs((prev) => ({ ...prev, [lot.id]: Number(e.target.value) }))
                          }
                          className="w-28 p-2 border border-slate-200 rounded-lg font-mono font-bold text-right"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setLotInputs((prev) => ({ ...prev, [lot.id]: lot.remainingQuantity }))
                          }
                          className="px-2 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          Full
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold cursor-pointer">
              Post Consolidated Dispatch
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
