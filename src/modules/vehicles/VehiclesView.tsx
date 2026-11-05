import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Vehicle, VehicleDocument } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { formatWeight, formatINR } from '../../utils/calculations.ts';
import { 
  Car, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Clock,
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const VehiclesView: React.FC = () => {
  const { vehicles, vehicleDocuments, expenses, addVehicle, updateVehicle, deleteVehicle } = useERP();
  const todayStr = new Date().toISOString().split('T')[0];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [regNo, setRegNo] = useState('');
  const [vehType, setVehType] = useState('Eicher 17ft Lorry');
  const [ownership, setOwnership] = useState<Vehicle['ownershipType']>('OWNED');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [tareWeight, setTareWeight] = useState<number>(4000);

  const handleOpenAdd = () => {
    setEditingVehicle(null);
    setRegNo('TN 18 BY ');
    setVehType('Eicher 17ft Lorry');
    setOwnership('OWNED');
    setDriverName('');
    setDriverPhone('');
    setTareWeight(4000);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setRegNo(v.registrationNo);
    setVehType(v.vehicleType);
    setOwnership(v.ownershipType);
    setDriverName(v.driverName || '');
    setDriverPhone(v.driverPhone || '');
    setTareWeight(v.tareWeight);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim()) return;

    if (editingVehicle) {
      updateVehicle(editingVehicle.id, {
        registrationNo: regNo.trim().toUpperCase(),
        vehicleType: vehType,
        ownershipType: ownership,
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        tareWeight: Number(tareWeight),
      });
      setFeedbackMsg({ type: 'success', text: `Vehicle "${regNo}" updated successfully.` });
    } else {
      addVehicle({
        registrationNo: regNo.trim().toUpperCase(),
        vehicleType: vehType,
        ownershipType: ownership,
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        tareWeight: Number(tareWeight),
        isActive: true,
      });
      setFeedbackMsg({ type: 'success', text: `Vehicle "${regNo}" added to fleet registry.` });
    }

    setIsModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleDelete = (v: Vehicle) => {
    if (confirm(`Are you sure you want to remove vehicle "${v.registrationNo}" from the registry?`)) {
      const res = deleteVehicle(v.id);
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message || `Vehicle removed.` });
      } else {
        setFeedbackMsg({ type: 'error', text: res.message || 'Failed to remove vehicle.' });
      }
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Vehicles & Document Compliance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fleet registry, tare weights, automated document expiry alerts (RC, Insurance, Fitness), and maintenance history.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Vehicle</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
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

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehicles.map((veh) => {
          const docs = vehicleDocuments.filter((d) => d.vehicleId === veh.id);
          const vehExpenses = expenses.filter((e) => e.vehicleId === veh.id);
          const totalCost = vehExpenses.reduce((s, e) => s + e.amount, 0);

          return (
            <div key={veh.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-mono font-black text-base text-slate-900 tracking-wider">
                      {veh.registrationNo}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{veh.vehicleType}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={veh.ownershipType} />
                  <button
                    onClick={() => handleOpenEdit(veh)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Edit Vehicle"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(veh)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Vehicle"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg">
                <div>
                  <span className="text-slate-500 block">Assigned Driver</span>
                  <span className="font-semibold text-slate-800">{veh.driverName || 'Unassigned'}</span>
                  {veh.driverPhone && <span className="text-[10px] text-slate-500 font-mono block">{veh.driverPhone}</span>}
                </div>
                <div>
                  <span className="text-slate-500 block">Standard Tare Wt</span>
                  <span className="font-mono font-bold text-slate-800">{formatWeight(veh.tareWeight)}</span>
                </div>
              </div>

              {/* Documents List */}
              <div className="space-y-2 text-xs">
                <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 block">
                  Compliance Documents & Renewals
                </span>
                {docs.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px]">No documents attached.</p>
                ) : (
                  docs.map((d) => {
                    const diffDays = Math.ceil((new Date(d.expiryDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
                    const isExpiring = diffDays <= d.reminderDaysBefore && diffDays >= 0;
                    const isExpired = diffDays < 0;

                    return (
                      <div
                        key={d.id}
                        className={`p-2.5 rounded-lg border flex items-center justify-between ${
                          isExpired
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : isExpiring
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <div>
                          <span className="font-bold block">{d.documentType}</span>
                          <span className="text-[10px] font-mono text-slate-500">{d.documentNumber || '—'}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold block">{d.expiryDate}</span>
                          <span className={`text-[10px] font-bold ${
                            isExpired ? 'text-rose-600' : isExpiring ? 'text-amber-700' : 'text-emerald-600'
                          }`}>
                            {isExpired ? 'EXPIRED' : `${diffDays} days left`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Vehicle Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVehicle ? `Edit Vehicle: ${editingVehicle.registrationNo}` : 'Add New Vehicle'}
        subtitle="Register vehicle registration, ownership class, and tare baseline."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Registration Number *</label>
            <input
              type="text"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg font-mono uppercase"
              placeholder="e.g. TN 18 BY 0420"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Vehicle Type *</label>
              <input
                type="text"
                value={vehType}
                onChange={(e) => setVehType(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                placeholder="e.g. Eicher 17ft Lorry"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Ownership Type *</label>
              <select
                value={ownership}
                onChange={(e) => setOwnership(e.target.value as any)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="OWNED">Company Owned</option>
                <option value="HIRED">Hired Contractor</option>
                <option value="CUSTOMER_VEHICLE">Customer Vehicle</option>
                <option value="SUPPLIER_VEHICLE">Supplier Vehicle</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Assigned Driver</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                placeholder="Driver full name"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Driver Phone</label>
              <input
                type="text"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                placeholder="Driver contact no"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Standard Tare Weight (KG) *</label>
            <input
              type="number"
              value={tareWeight}
              onChange={(e) => setTareWeight(parseFloat(e.target.value) || 0)}
              className="w-full p-2 border border-slate-200 rounded-lg font-mono"
              step="10"
              min="0"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm"
            >
              {editingVehicle ? 'Save Vehicle Updates' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
