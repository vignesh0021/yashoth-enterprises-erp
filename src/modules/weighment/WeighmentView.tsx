import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Weighment, WeighingMethod } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatWeight, calcNetWeight, calcPayableWeight } from '../../utils/calculations.ts';
import { 
  Scale, 
  Plus, 
  FileText, 
  AlertTriangle, 
  Clock, 
  Truck,
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const WeighmentView: React.FC = () => {
  const { weighments, recordWeighment, updateWeighment, deleteWeighment, currentUser } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWeighment, setEditingWeighment] = useState<Weighment | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [method, setMethod] = useState<WeighingMethod>('WEIGHBRIDGE_SLIP');
  const [slipRef, setSlipRef] = useState('WB-2026-9901');
  const [vehicleReg, setVehicleReg] = useState('TN 18 BY 0420');
  const [grossWeight, setGrossWeight] = useState(12500);
  const [tareWeight, setTareWeight] = useState(4500);
  const [deductions, setDeductions] = useState(100);
  const [notes, setNotes] = useState('Gummidipoondi Public Weighbridge slip verified');

  let netWeight = 0;
  let payableWeight = 0;
  let errorMsg = '';

  try {
    netWeight = calcNetWeight(grossWeight, tareWeight);
    payableWeight = calcPayableWeight(grossWeight, tareWeight, deductions);
  } catch (err: any) {
    errorMsg = err.message;
  }

  // Duplicate slip reference check
  const duplicateSlipWarning = weighments.some(
    (w) =>
      w.slipReference &&
      w.slipReference.trim().toUpperCase() === slipRef.trim().toUpperCase() &&
      w.id !== editingWeighment?.id
  );

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleOpenAdd = () => {
    setEditingWeighment(null);
    setMethod('WEIGHBRIDGE_SLIP');
    setSlipRef('WB-2026-' + Math.floor(1000 + Math.random() * 9000));
    setVehicleReg('TN 18 BY 0420');
    setGrossWeight(12500);
    setTareWeight(4500);
    setDeductions(100);
    setNotes('Gummidipoondi Public Weighbridge slip verified');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (w: Weighment) => {
    setEditingWeighment(w);
    setMethod(w.weighingMethod);
    setSlipRef(w.slipReference || '');
    setVehicleReg(w.vehicleRegistration || '');
    setGrossWeight(w.grossWeight);
    setTareWeight(w.tareWeight);
    setDeductions(w.approvedDeductions);
    setNotes(w.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (errorMsg) return;

    if (editingWeighment) {
      updateWeighment(editingWeighment.id, {
        weighingMethod: method,
        slipReference: slipRef.trim() || undefined,
        vehicleRegistration: vehicleReg.trim().toUpperCase() || undefined,
        grossWeight: Number(grossWeight),
        tareWeight: Number(tareWeight),
        approvedDeductions: Number(deductions),
        verificationStatus: duplicateSlipWarning ? 'FLAGGED' : 'VERIFIED',
        notes,
      });
      showFeedback('success', `Weighment slip "${editingWeighment.weighmentNo}" updated successfully.`);
    } else {
      const newW = recordWeighment({
        weighingMethod: method,
        slipReference: slipRef.trim() || undefined,
        vehicleRegistration: vehicleReg.trim().toUpperCase() || undefined,
        grossWeight: Number(grossWeight),
        tareWeight: Number(tareWeight),
        approvedDeductions: Number(deductions),
        unit: 'KG',
        firstWeightTime: new Date(Date.now() - 30 * 60000).toISOString(),
        secondWeightTime: new Date().toISOString(),
        operatorName: currentUser.fullName,
        verificationStatus: duplicateSlipWarning ? 'FLAGGED' : 'VERIFIED',
        notes,
      });
      showFeedback('success', `Weighment slip "${newW.weighmentNo}" recorded.`);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (w: Weighment) => {
    if (confirm(`Are you sure you want to delete weighment slip "${w.weighmentNo}"?`)) {
      const res = deleteWeighment(w.id);
      if (res.success) {
        showFeedback('success', res.message || 'Weighment slip deleted.');
      } else {
        showFeedback('error', res.message || 'Failed to delete weighment slip.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="w-6 h-6 text-red-600" />
            <span>Weighment Engine & Slip Register</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full CRUD operations for recording gate weighments, deducting tare, checking duplicate slip numbers, and calculating payable weights.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Weighment Slip</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Live Weights Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Weighment #</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Method & Slip</th>
                <th className="py-3 px-4">Vehicle Reg</th>
                <th className="py-3 px-4 text-right">Gross (KG)</th>
                <th className="py-3 px-4 text-right">Tare (KG)</th>
                <th className="py-3 px-4 text-right">Net (KG)</th>
                <th className="py-3 px-4 text-right">Deductions</th>
                <th className="py-3 px-4 text-right">Payable (KG)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weighments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 italic">
                    No weighment records entered. Click "Record Weighment Slip" to register truck weight.
                  </td>
                </tr>
              ) : (
                weighments.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{w.weighmentNo}</td>
                    <td className="py-3 px-4 text-slate-600">{new Date(w.createdAt).toLocaleTimeString()}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block">{w.weighingMethod.replace('_', ' ')}</span>
                      {w.slipReference && (
                        <span className="text-[10px] text-slate-500 font-mono">Slip: {w.slipReference}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{w.vehicleRegistration || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">{formatWeight(w.grossWeight)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">{formatWeight(w.tareWeight)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatWeight(w.netWeight)}</td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-medium">{formatWeight(w.approvedDeductions)}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-red-600">{formatWeight(w.payableWeight)}</td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={w.verificationStatus} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(w)}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit Weighment Slip"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(w)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Weighment Slip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New / Edit Weighment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingWeighment ? `Edit Weighment: ${editingWeighment.weighmentNo}` : 'Record Weight Entry / Weighbridge Slip'}
        subtitle="Automatic calculation of Net and Payable weight with non-negative constraints."
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {duplicateSlipWarning && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Warning: Weighbridge slip reference '{slipRef}' already exists in ledger!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Weighing Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="WEIGHBRIDGE_SLIP">Weighbridge Slip Entry</option>
                <option value="MANUAL_SCALE">Manual Scale Reading</option>
                <option value="HARDWARE_LINK">Hardware Serial Port (Direct)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Weighbridge Slip Ref #</label>
              <input
                type="text"
                value={slipRef}
                onChange={(e) => setSlipRef(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                placeholder="e.g. WB-2026-9901"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Vehicle Registration #</label>
              <input
                type="text"
                value={vehicleReg}
                onChange={(e) => setVehicleReg(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono uppercase font-bold"
                placeholder="e.g. TN 18 BY 0420"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Gross Weight (Loaded) KG *</label>
              <input
                type="number"
                value={grossWeight}
                onChange={(e) => setGrossWeight(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-sm"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Tare Weight (Empty) KG *</label>
              <input
                type="number"
                value={tareWeight}
                onChange={(e) => setTareWeight(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-sm"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Approved Deductions (Dirt/Water) KG</label>
              <input
                type="number"
                value={deductions}
                onChange={(e) => setDeductions(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono text-rose-600 font-bold text-sm"
              />
            </div>
          </div>

          {/* Mathematical verification card */}
          <div className="p-4 bg-slate-900 text-white rounded-xl grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Gross - Tare = Net Weight</span>
              <span className="text-xl font-mono font-black">{formatWeight(netWeight)}</span>
            </div>
            <div>
              <span className="text-[10px] text-red-400 uppercase tracking-wider block">Net - Deductions = Payable Weight</span>
              <span className="text-xl font-mono font-black text-red-400">{formatWeight(payableWeight)}</span>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Inspector / Yard Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg"
              placeholder="e.g. Moisture detected in borings, 100kg deducted with supplier agreement"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!errorMsg}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-md shadow-red-600/20 cursor-pointer"
            >
              {editingWeighment ? 'Save Changes' : 'Confirm & Save Weighment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
